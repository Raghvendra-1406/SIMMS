// =========================================================
// SIMMS classroom IoT node (ESP32) - circuit-level metering
//
// Publishes to MQTT (Plan v2 §14.2), under an optional prefix:
//   classroom/<room>/sensors            {"voltage", "circuits": {MAIN, LIGHTS, FANS}}
//                                       and environment (temperature, humidity)
//   classroom/<room>/vision             virtual camera (simulation only):
//                                       occupancy, board, {"fans": [...]},
//                                       {"lights": [...]}
//   classroom/<room>/status/<node_id>   retained ONLINE heartbeat,
//                                       last-will OFFLINE
// Subscribes to:
//   classroom/<room>/command            {"target":"LIGHTS|FANS","state":"ON|OFF"}
//
// Message shapes match backend/scripts/fake_node.py.
// =========================================================

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHTesp.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#include "config.h"

#if !SIMULATION
#include <PZEM004Tv30.h>
#endif


// ---------------------------------------------------------
// Identity and topics
// ---------------------------------------------------------

const String NODE_ID = String("esp32-") + ROOM_NAME;
const String CAMERA_ID = String("vcam-") + ROOM_NAME;

String baseTopic() {
  String prefix = TOPIC_PREFIX;

  if (prefix.length() > 0) {
    return prefix + "/classroom/" + ROOM_NAME;
  }

  return String("classroom/") + ROOM_NAME;
}

const String SENSOR_TOPIC = baseTopic() + "/sensors";
const String VISION_TOPIC = baseTopic() + "/vision";
const String COMMAND_TOPIC = baseTopic() + "/command";
const String NODE_STATUS_TOPIC = baseTopic() + "/status/" + NODE_ID;
const String CAMERA_STATUS_TOPIC = baseTopic() + "/status/" + CAMERA_ID;


// ---------------------------------------------------------
// State
// ---------------------------------------------------------

#if MQTT_USE_TLS
// Encrypted connection to a hosted broker. setInsecure() skips the
// certificate check (fine for dry runs); for production load the
// broker's CA certificate with wifiClient.setCACert(...).
WiFiClientSecure wifiClient;
#else
WiFiClient wifiClient;
#endif
PubSubClient mqtt(wifiClient);
DHTesp dht;
Adafruit_SSD1306 display(128, 64, &Wire, -1);
bool displayReady = false;

#if !SIMULATION
PZEM004Tv30 pzemLights(Serial2, PIN_PZEM_RX, PIN_PZEM_TX, PZEM_ADDR_LIGHTS);
PZEM004Tv30 pzemFans(Serial2, PIN_PZEM_RX, PIN_PZEM_TX, PZEM_ADDR_FANS);
#if HAS_MAIN_METER
PZEM004Tv30 pzemMain(Serial2, PIN_PZEM_RX, PIN_PZEM_TX, PZEM_ADDR_MAIN);
#endif
#endif

// Demo-panel circuit relays.
bool lightsRelayOn = LIGHTS_ON_AT_BOOT;
bool fansRelayOn = FANS_ON_AT_BOOT;

// Simulation fault injection: 0 = none, otherwise the unit number.
int blockedFan = 0;
int failedTube = 0;

// Energy per circuit (kWh), integrated in the simulation.
double energyMain = 0, energyLights = 0, energyFans = 0;
unsigned long lastEnergyUpdateMs = 0;

unsigned long lastSensorMs = 0;
unsigned long lastVisionMs = 0;
unsigned long lastStatusMs = 0;
unsigned long lastDisplayMs = 0;
unsigned long lastMqttAttemptMs = 0;

// Set by commands / buttons: publish the new state now.
bool reportNow = false;

bool cameraWasOffline = false;


// ---------------------------------------------------------
// Inputs
// ---------------------------------------------------------

struct Button {
  uint8_t pin;
  bool lastReading;
  bool stableState;
  unsigned long lastChangeMs;
};

Button fanFaultButton = {PIN_BTN_FAN_FAULT, HIGH, HIGH, 0};
Button tubeFaultButton = {PIN_BTN_TUBE_FAULT, HIGH, HIGH, 0};

// Returns true once per press (debounced, active LOW).
bool buttonPressed(Button &button) {
  bool reading = digitalRead(button.pin);

  if (reading != button.lastReading) {
    button.lastChangeMs = millis();
    button.lastReading = reading;
  }

  if (millis() - button.lastChangeMs > 40 && reading != button.stableState) {
    button.stableState = reading;
    return reading == LOW;
  }

  return false;
}

// Slide switches: slid right connects the pin to GND = active.
bool switchActive(uint8_t pin) {
  return digitalRead(pin) == LOW;
}

// Averaged ADC reading as a 0..1 fraction.
float adcFraction(uint8_t pin) {
  uint32_t total = 0;

  for (int i = 0; i < 8; i++) {
    total += analogRead(pin);
  }

  return (total / 8.0f) / 4095.0f;
}


// ---------------------------------------------------------
// Relays
// ---------------------------------------------------------

void writeRelay(uint8_t pin, bool on) {
  bool level = RELAY_ACTIVE_LOW ? !on : on;
  digitalWrite(pin, level ? HIGH : LOW);
}

void applyRelays() {
  writeRelay(PIN_LIGHTS_RELAY, lightsRelayOn);
  writeRelay(PIN_FANS_RELAY, fansRelayOn);
}

void setRelay(const String &target, bool on, const char *source) {
  if (target == "LIGHTS") {
    lightsRelayOn = on;
  } else if (target == "FANS") {
    fansRelayOn = on;
  } else {
    return;
  }

  applyRelays();
  reportNow = true;

  Serial.printf("[relay] %s circuit -> %s (%s)\n", target.c_str(), on ? "ON" : "OFF", source);
}


// ---------------------------------------------------------
// Units (simulation): which fans / tubes are on and working
// ---------------------------------------------------------

// Switched-on units are Fan 1..N / Tube 1..N.
int fansSwitchedOn() {
#if SIMULATION
  int n = (int)roundf(adcFraction(PIN_POT_FANS_ON) * FAN_COUNT);
  return fansRelayOn ? n : 0;
#else
  return 0;  // unknown on hardware: the backend derives it from current
#endif
}

int tubesSwitchedOn() {
#if SIMULATION
  int n = (int)roundf(adcFraction(PIN_POT_LIGHTS_ON) * TUBE_COUNT);
  return lightsRelayOn ? n : 0;
#else
  return 0;
#endif
}

bool fanPowered(int number) { return number <= fansSwitchedOn(); }
bool fanRotating(int number) { return fanPowered(number) && number != blockedFan; }
bool tubePowered(int number) { return number <= tubesSwitchedOn(); }
bool tubeLit(int number) { return tubePowered(number) && number != failedTube; }


// ---------------------------------------------------------
// Measurements
// ---------------------------------------------------------

struct Circuit {
  float current;
  float power;
  float powerFactor;
  double energy;
  bool valid;
};

struct Electrical {
  float voltage;
  Circuit main;
  Circuit lights;
  Circuit fans;
  bool hasMain;
};

#if SIMULATION

Circuit simulatedCircuit(float voltage, float current, float powerFactor, double &energy, unsigned long elapsedMs) {
  Circuit c;
  c.current = current;
  c.powerFactor = powerFactor;
  c.power = voltage * current * powerFactor;
  energy += c.power * elapsedMs / 3600000000.0;  // W*ms -> kWh
  c.energy = energy;
  c.valid = true;
  return c;
}

Electrical readElectrical() {
  unsigned long now = millis();
  unsigned long elapsed = lastEnergyUpdateMs ? now - lastEnergyUpdateMs : 0;
  lastEnergyUpdateMs = now;

  Electrical e;
  e.voltage = 180.0f + adcFraction(PIN_POT_VOLTAGE) * 80.0f;

  float fansCurrent = CIRCUIT_STANDBY_A;
  for (int n = 1; n <= fansSwitchedOn(); n++) {
    fansCurrent += (n == blockedFan) ? STALLED_FAN_CURRENT_A : FAN_CURRENT_A;
  }
  if (switchActive(PIN_FANS_OVERLOAD)) {
    fansCurrent += OVERLOAD_CURRENT_A;
  }

  // A failed tube (faulty driver) still draws current.
  float lightsCurrent = CIRCUIT_STANDBY_A + tubesSwitchedOn() * TUBE_CURRENT_A;

  e.fans = simulatedCircuit(e.voltage, fansCurrent, FANS_POWER_FACTOR, energyFans, elapsed);
  e.lights = simulatedCircuit(e.voltage, lightsCurrent, LIGHTS_POWER_FACTOR, energyLights, elapsed);

  float mainCurrent = fansCurrent + lightsCurrent + SOCKETS_CURRENT_A;
  float mainPower = e.fans.power + e.lights.power + e.voltage * SOCKETS_CURRENT_A * SOCKETS_POWER_FACTOR;
  e.main = simulatedCircuit(e.voltage, mainCurrent, mainPower / (e.voltage * mainCurrent), energyMain, elapsed);
  e.hasMain = true;

  return e;
}

#else

Circuit readPzem(PZEM004Tv30 &meter) {
  Circuit c;
  c.current = meter.current();
  c.power = meter.power();
  c.powerFactor = meter.pf();
  c.energy = meter.energy();
  c.valid = !isnan(c.current) && !isnan(c.power);
  return c;
}

Electrical readElectrical() {
  Electrical e;

  e.lights = readPzem(pzemLights);
  e.fans = readPzem(pzemFans);
  e.voltage = pzemLights.voltage();

  if (isnan(e.voltage)) {
    e.voltage = pzemFans.voltage();
  }

#if HAS_MAIN_METER
  e.main = readPzem(pzemMain);
  e.hasMain = e.main.valid;
#else
  e.hasMain = false;
#endif

  return e;
}

#endif

// 0-100 %, brighter = higher. The LDR module's AO voltage falls
// as light increases.
int readLightLevel() {
  return (int)roundf((1.0f - adcFraction(PIN_LDR)) * 100.0f);
}


// ---------------------------------------------------------
// MQTT publishing
// ---------------------------------------------------------

bool publishJson(const String &topic, JsonDocument &doc, bool retain = false) {
  char buffer[1024];
  size_t length = serializeJson(doc, buffer, sizeof(buffer));

  bool ok = mqtt.publish(topic.c_str(), (const uint8_t *)buffer, length, retain);

  if (!ok) {
    Serial.printf("[mqtt] publish failed on %s\n", topic.c_str());
  }

  return ok;
}

void publishNodeStatus() {
  JsonDocument doc;

  doc["state"] = "ONLINE";
  doc["kind"] = "SENSOR_NODE";
  doc["rssi"] = WiFi.RSSI();
  doc["uptime_s"] = millis() / 1000;
  doc["fw_version"] = FW_VERSION;
  doc["ip"] = WiFi.localIP().toString();
  doc["simulation"] = (bool)SIMULATION;

  JsonObject relays = doc["relays"].to<JsonObject>();
  relays["lights"] = lightsRelayOn;
  relays["fans"] = fansRelayOn;

  publishJson(NODE_STATUS_TOPIC, doc, true);
}

void addCircuit(JsonObject circuits, const char *name, const Circuit &c) {
  if (!c.valid) {
    return;
  }

  JsonObject o = circuits[name].to<JsonObject>();
  o["current"] = roundf(c.current * 1000) / 1000;
  o["power"] = roundf(c.power * 10) / 10;
  o["power_factor"] = roundf(c.powerFactor * 100) / 100;
  o["energy"] = c.energy;
}

void publishSensors() {
  Electrical e = readElectrical();

  if (e.lights.valid || e.fans.valid || e.hasMain) {
    JsonDocument doc;
    doc["node_id"] = NODE_ID;
    doc["device_name"] = NODE_DEVICE_NAME;
    doc["voltage"] = roundf(e.voltage * 10) / 10;

    JsonObject circuits = doc["circuits"].to<JsonObject>();
    if (e.hasMain) addCircuit(circuits, "MAIN", e.main);
    addCircuit(circuits, "LIGHTS", e.lights);
    addCircuit(circuits, "FANS", e.fans);

    publishJson(SENSOR_TOPIC, doc);
  } else {
    Serial.println("[sensor] no meter responding, electrical reading skipped");
  }

  TempAndHumidity climate = dht.getTempAndHumidity();

  if (!isnan(climate.temperature) && !isnan(climate.humidity)) {
    JsonDocument doc;
    doc["node_id"] = NODE_ID;
    doc["device_name"] = NODE_DEVICE_NAME;
    doc["temperature"] = roundf(climate.temperature * 10) / 10;
    doc["humidity"] = roundf(climate.humidity * 10) / 10;
    doc["light_level"] = readLightLevel();
    publishJson(SENSOR_TOPIC, doc);
  } else {
    Serial.println("[sensor] DHT read failed, environment reading skipped");
  }

  Serial.printf(
    "[sensor] V=%.1f lights=%.2fA fans=%.2fA main=%.2fA T=%.1f H=%.1f\n",
    e.voltage, e.lights.current, e.fans.current, e.main.current,
    climate.temperature, climate.humidity);
}


// ---------------------------------------------------------
// Virtual camera (simulation only)
// ---------------------------------------------------------

#if VIRTUAL_CAMERA

void publishCameraStatus(bool online) {
  JsonDocument doc;
  doc["state"] = online ? "ONLINE" : "OFFLINE";
  doc["kind"] = "CAMERA";
  doc["fw_version"] = FW_VERSION;
  doc["virtual"] = true;
  publishJson(CAMERA_STATUS_TOPIC, doc, true);
}

const char *boardState(float inkRatio) {
  if (inkRatio < BOARD_CLEAN_MAX) return "CLEAN";
  if (inkRatio <= BOARD_IN_USE_MAX) return "IN_USE";
  return "DIRTY";
}

int peopleCount() {
  return (int)roundf(adcFraction(PIN_POT_PEOPLE) * MAX_PEOPLE);
}

float boardInk() {
  return roundf(adcFraction(PIN_POT_BOARD_INK) * MAX_BOARD_INK * 1000) / 1000;
}

void publishVision() {
  bool offline = switchActive(PIN_CAMERA_OFFLINE);

  if (offline) {
    if (!cameraWasOffline) {
      publishCameraStatus(false);
      Serial.println("[camera] offline: vision messages stopped");
    }
    cameraWasOffline = true;
    return;
  }

  if (cameraWasOffline) {
    publishCameraStatus(true);
    Serial.println("[camera] back online");
    cameraWasOffline = false;
  }

  {
    JsonDocument doc;
    doc["node_id"] = CAMERA_ID;
    doc["device_name"] = CAMERA_DEVICE_NAME;
    doc["occupancy_count"] = peopleCount();
    publishJson(VISION_TOPIC, doc);
  }

  // One message for every fan: rotation seen in each fan's region.
  {
    JsonDocument doc;
    doc["node_id"] = CAMERA_ID;
    JsonArray fans = doc["fans"].to<JsonArray>();

    for (int n = 1; n <= FAN_COUNT; n++) {
      JsonObject fan = fans.add<JsonObject>();
      bool rotating = fanRotating(n);
      fan["device_name"] = String(FAN_NAME_PREFIX) + n;
      fan["running"] = rotating;
      fan["motion_score"] = rotating ? 0.3 : 0.0;
      fan["confidence"] = 0.95;
    }

    publishJson(VISION_TOPIC, doc);
  }

  // One message for every tube light: brightness in each tube's region.
  {
    JsonDocument doc;
    doc["node_id"] = CAMERA_ID;
    JsonArray lights = doc["lights"].to<JsonArray>();

    for (int n = 1; n <= TUBE_COUNT; n++) {
      JsonObject tube = lights.add<JsonObject>();
      bool lit = tubeLit(n);
      tube["device_name"] = String(TUBE_NAME_PREFIX) + n;
      tube["lit"] = lit;
      tube["brightness"] = lit ? 0.9 : 0.1;
      tube["confidence"] = 0.95;
    }

    publishJson(VISION_TOPIC, doc);
  }

  {
    JsonDocument doc;
    doc["node_id"] = CAMERA_ID;
    doc["device_name"] = CAMERA_DEVICE_NAME;
    JsonObject board = doc["board"].to<JsonObject>();

    if (switchActive(PIN_PERSON_AT_BOARD)) {
      board["state"] = "OCCLUDED";
      board["ink_ratio"] = nullptr;
      board["confidence"] = 0.0;
    } else {
      float ink = boardInk();
      board["state"] = boardState(ink);
      board["ink_ratio"] = ink;
      board["confidence"] = 0.95;
    }

    publishJson(VISION_TOPIC, doc);
  }

  Serial.printf(
    "[camera] people=%d fans %d/%d on (blocked %d) tubes %d/%d on (failed %d)\n",
    peopleCount(), fansSwitchedOn(), FAN_COUNT, blockedFan,
    tubesSwitchedOn(), TUBE_COUNT, failedTube);
}

#endif


// ---------------------------------------------------------
// OLED status display
// ---------------------------------------------------------

// One box per unit: filled = working, outline = off,
// cross = powered but faulty (blocked fan / failed tube).
void drawUnits(int y, const char *label, int count, bool (*powered)(int), bool (*working)(int)) {
  display.setCursor(0, y);
  display.print(label);

  for (int n = 1; n <= count; n++) {
    int x = 44 + (n - 1) * 14;

    if (working(n)) {
      display.fillRect(x, y, 10, 8, SSD1306_WHITE);
    } else if (powered(n)) {
      display.drawRect(x, y, 10, 8, SSD1306_WHITE);
      display.drawLine(x, y, x + 9, y + 7, SSD1306_WHITE);
      display.drawLine(x + 9, y, x, y + 7, SSD1306_WHITE);
    } else {
      display.drawRect(x, y, 10, 8, SSD1306_WHITE);
    }
  }
}

void updateDisplay() {
  if (!displayReady) {
    return;
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  display.setCursor(0, 0);
  display.printf("%s %s", ROOM_NAME, mqtt.connected() ? "online" : "offline");

#if SIMULATION
  display.setCursor(86, 0);
  display.printf("%3.0fV", 180.0f + adcFraction(PIN_POT_VOLTAGE) * 80.0f);

  drawUnits(14, "Fans", FAN_COUNT, fanPowered, fanRotating);
  drawUnits(26, "Tubes", TUBE_COUNT, tubePowered, tubeLit);

  display.setCursor(0, 40);
  display.printf("People %2d  Board %2.0f%%", peopleCount(), boardInk() * 100);

  display.setCursor(0, 52);
  display.printf("Relay L:%s F:%s%s",
                 lightsRelayOn ? "on" : "off",
                 fansRelayOn ? "on" : "off",
                 switchActive(PIN_FANS_OVERLOAD) ? " OVL" : "");
#else
  display.setCursor(0, 20);
  display.printf("Relay L:%s F:%s", lightsRelayOn ? "on" : "off", fansRelayOn ? "on" : "off");
#endif

  display.display();
}


// ---------------------------------------------------------
// Commands from the dashboard
// ---------------------------------------------------------

void onMqttMessage(char *topic, byte *payload, unsigned int length) {
  if (COMMAND_TOPIC != topic) {
    return;
  }

  JsonDocument doc;

  if (deserializeJson(doc, payload, length)) {
    Serial.println("[mqtt] ignoring malformed command");
    return;
  }

  const char *target = doc["target"] | "";
  const char *state = doc["state"] | "";

  if (strcmp(state, "ON") != 0 && strcmp(state, "OFF") != 0) {
    Serial.println("[mqtt] ignoring command without ON/OFF state");
    return;
  }

  setRelay(String(target), strcmp(state, "ON") == 0, "dashboard");
}


// ---------------------------------------------------------
// Connectivity
// ---------------------------------------------------------

void connectWifi() {
  Serial.printf("[wifi] connecting to %s", WIFI_SSID);

  WiFi.mode(WIFI_STA);

  if (WIFI_CHANNEL > 0) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL);
  } else {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }

  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }

  Serial.printf(" connected, IP %s\n", WiFi.localIP().toString().c_str());
}

void connectMqtt() {
  if (millis() - lastMqttAttemptMs < 3000 && lastMqttAttemptMs != 0) {
    return;
  }

  lastMqttAttemptMs = millis();

  String clientId = NODE_ID + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);

  // Last will: the broker marks the node OFFLINE if it vanishes.
  JsonDocument will;
  will["state"] = "OFFLINE";
  will["kind"] = "SENSOR_NODE";
  char willPayload[64];
  serializeJson(will, willPayload, sizeof(willPayload));

  Serial.printf("[mqtt] connecting to %s:%d ... ", MQTT_HOST, MQTT_PORT);

  const char *username = strlen(MQTT_USERNAME) ? MQTT_USERNAME : nullptr;
  const char *password = strlen(MQTT_PASSWORD) ? MQTT_PASSWORD : nullptr;

  bool ok = mqtt.connect(
    clientId.c_str(),
    username, password,
    NODE_STATUS_TOPIC.c_str(), 1, true, willPayload);

  if (!ok) {
    Serial.printf("failed (state %d), retrying in 3 s\n", mqtt.state());
    return;
  }

  Serial.println("connected");

  mqtt.subscribe(COMMAND_TOPIC.c_str(), 1);

  publishNodeStatus();

#if VIRTUAL_CAMERA
  cameraWasOffline = switchActive(PIN_CAMERA_OFFLINE);
  publishCameraStatus(!cameraWasOffline);
#endif

  lastStatusMs = millis();
}


// ---------------------------------------------------------
// Setup / loop
// ---------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.printf("\nSIMMS node %s (fw %s, %s)\n",
                NODE_ID.c_str(), FW_VERSION,
                SIMULATION ? "SIMULATION" : "HARDWARE");
  Serial.printf("Topics: %s/...\n", baseTopic().c_str());

  pinMode(PIN_LIGHTS_RELAY, OUTPUT);
  pinMode(PIN_FANS_RELAY, OUTPUT);
  pinMode(PIN_MQTT_LED, OUTPUT);

  pinMode(PIN_BTN_FAN_FAULT, INPUT_PULLUP);
  pinMode(PIN_BTN_TUBE_FAULT, INPUT_PULLUP);
  pinMode(PIN_FANS_OVERLOAD, INPUT_PULLUP);
  pinMode(PIN_PERSON_AT_BOARD, INPUT_PULLUP);
  pinMode(PIN_CAMERA_OFFLINE, INPUT_PULLUP);

  analogReadResolution(12);

  applyRelays();

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  displayReady = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);

  if (!displayReady) {
    Serial.println("[display] SSD1306 not found, continuing without it");
  }

#if SIMULATION
  dht.setup(PIN_DHT, DHTesp::DHT22);
#else
  dht.setup(PIN_DHT, DHTesp::DHT11);
#endif

  updateDisplay();

  connectWifi();

#if MQTT_USE_TLS
  wifiClient.setInsecure();
#endif

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(1024);
  mqtt.setKeepAlive(MQTT_KEEPALIVE_S);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(PIN_MQTT_LED, LOW);
    connectWifi();
  }

  if (!mqtt.connected()) {
    digitalWrite(PIN_MQTT_LED, LOW);
    connectMqtt();
  }

  mqtt.loop();

  digitalWrite(PIN_MQTT_LED, mqtt.connected() ? HIGH : LOW);

#if SIMULATION
  // Fault injection: each press moves the fault to the next unit
  // (none -> 1 -> 2 ... -> 6 -> none).
  if (buttonPressed(fanFaultButton)) {
    blockedFan = (blockedFan + 1) % (FAN_COUNT + 1);
    Serial.printf("[fault] blocked fan: %d\n", blockedFan);
    reportNow = true;
  }

  if (buttonPressed(tubeFaultButton)) {
    failedTube = (failedTube + 1) % (TUBE_COUNT + 1);
    Serial.printf("[fault] failed tube: %d\n", failedTube);
    reportNow = true;
  }
#endif

  unsigned long now = millis();

  if (now - lastDisplayMs >= DISPLAY_INTERVAL_MS) {
    lastDisplayMs = now;
    updateDisplay();
  }

  if (!mqtt.connected()) {
    return;
  }

  if (reportNow) {
    reportNow = false;
    publishNodeStatus();
    publishSensors();
    lastSensorMs = now;
    lastStatusMs = now;
  }

  if (now - lastSensorMs >= SENSOR_INTERVAL_MS || lastSensorMs == 0) {
    lastSensorMs = now;
    publishSensors();
  }

#if VIRTUAL_CAMERA
  if (now - lastVisionMs >= VISION_INTERVAL_MS || lastVisionMs == 0) {
    lastVisionMs = now;
    publishVision();
  }

  // Report "camera offline" as soon as the switch moves.
  if (switchActive(PIN_CAMERA_OFFLINE) != cameraWasOffline) {
    publishVision();
  }
#endif

  if (now - lastStatusMs >= STATUS_INTERVAL_MS) {
    lastStatusMs = now;
    publishNodeStatus();

#if VIRTUAL_CAMERA
    if (!cameraWasOffline) {
      publishCameraStatus(true);
    }
#endif
  }
}
