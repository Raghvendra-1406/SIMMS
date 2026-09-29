// =========================================================
// SIMMS classroom IoT node (ESP32)
//
// Publishes to MQTT (Plan v2 §14.2), under an optional prefix:
//   classroom/<room>/sensors            electrical, environment, light
//   classroom/<room>/vision             virtual camera (simulation only)
//   classroom/<room>/status/<node_id>   retained ONLINE heartbeat,
//                                       last-will OFFLINE
// Subscribes to:
//   classroom/<room>/command            {"target":"LAMP|FAN","state":"ON|OFF"}
//
// Message shapes match backend/scripts/fake_node.py.
// =========================================================

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHTesp.h>

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

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
DHTesp dht;

#if !SIMULATION
PZEM004Tv30 pzem(Serial2, PIN_PZEM_RX, PIN_PZEM_TX);
#endif

bool lampOn = LAMP_ON_AT_BOOT;
bool fanOn = FAN_ON_AT_BOOT;

double energyKwh = 0.0;
unsigned long lastEnergyUpdateMs = 0;

unsigned long lastSensorMs = 0;
unsigned long lastVisionMs = 0;
unsigned long lastStatusMs = 0;
unsigned long lastMqttAttemptMs = 0;

// Set by commands / wall switches: publish the new state now.
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

Button lampButton = {PIN_LAMP_BUTTON, HIGH, HIGH, 0};
Button fanButton = {PIN_FAN_BUTTON, HIGH, HIGH, 0};

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
  writeRelay(PIN_LAMP_RELAY, lampOn);
  writeRelay(PIN_FAN_RELAY, fanOn);
}

void setRelay(const String &target, bool on, const char *source) {
  if (target == "LAMP") {
    lampOn = on;
  } else if (target == "FAN") {
    fanOn = on;
  } else {
    return;
  }

  applyRelays();
  reportNow = true;

  Serial.printf("[relay] %s -> %s (%s)\n", target.c_str(), on ? "ON" : "OFF", source);
}


// ---------------------------------------------------------
// Measurements
// ---------------------------------------------------------

struct Electrical {
  float voltage;
  float current;
  float power;
  float powerFactor;
  float fanCurrent;
  bool valid;
};

#if SIMULATION

// Knob -> fan branch current. Up to 3/4 turn is a normal table fan
// (0.25-0.45 A); the last quarter ramps to 25 A (overcurrent fault).
float simulatedFanLoad() {
  float fraction = adcFraction(PIN_FAN_CURRENT);

  if (fraction <= 0.75f) {
    return 0.25f + (fraction / 0.75f) * 0.20f;
  }

  return 0.45f + ((fraction - 0.75f) / 0.25f) * 24.55f;
}

Electrical readElectrical() {
  Electrical e;

  e.voltage = 180.0f + adcFraction(PIN_POT_VOLTAGE) * 80.0f;
  e.fanCurrent = fanOn ? simulatedFanLoad() : 0.0f;

  float lampCurrent = lampOn ? LAMP_CURRENT_A : 0.0f;

  e.current = e.fanCurrent + lampCurrent + BASE_CURRENT_A;
  e.powerFactor = POWER_FACTOR;
  e.power = e.voltage * e.current * e.powerFactor;
  e.valid = true;

  return e;
}

#else

// RMS current from the SCT-013-030 (voltage output, 1 V = 30 A),
// biased at mid-supply on the ADC pin.
float readCtCurrent() {
  const int samples = 1000;
  float sum = 0;
  float sumSquares = 0;

  for (int i = 0; i < samples; i++) {
    float volts = analogReadMilliVolts(PIN_FAN_CURRENT) / 1000.0f;
    sum += volts;
    sumSquares += volts * volts;
  }

  float mean = sum / samples;
  float variance = sumSquares / samples - mean * mean;
  float vrms = variance > 0 ? sqrtf(variance) : 0;
  float amps = vrms * CT_AMPS_PER_VOLT;

  return amps < 0.05f ? 0.0f : amps;
}

Electrical readElectrical() {
  Electrical e;

  e.voltage = pzem.voltage();
  e.current = pzem.current();
  e.power = pzem.power();
  e.powerFactor = pzem.pf();
  e.fanCurrent = readCtCurrent();
  e.valid = !isnan(e.voltage) && !isnan(e.current);

  float kwh = pzem.energy();
  if (!isnan(kwh)) {
    energyKwh = kwh;
  }

  return e;
}

#endif

float lampBranchCurrent(const Electrical &e) {
#if SIMULATION
  return lampOn ? LAMP_CURRENT_A : 0.0f;
#else
  // Total minus the independently measured fan branch.
  float lamp = e.current - e.fanCurrent - BASE_CURRENT_A;
  return lamp > 0 ? lamp : 0;
#endif
}

// 0-100 %, brighter = higher. The LDR module's AO voltage falls
// as light increases.
int readLightLevel() {
  return (int)roundf((1.0f - adcFraction(PIN_LDR)) * 100.0f);
}


// ---------------------------------------------------------
// MQTT publishing
// ---------------------------------------------------------

bool publishJson(const String &topic, JsonDocument &doc, bool retain = false) {
  char buffer[512];
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
  relays["lamp"] = lampOn;
  relays["fan"] = fanOn;

  publishJson(NODE_STATUS_TOPIC, doc, true);
}

void publishSensors() {
  unsigned long now = millis();

  Electrical e = readElectrical();

#if SIMULATION
  // Integrate energy (the PZEM does this itself on real hardware).
  if (lastEnergyUpdateMs != 0) {
    energyKwh += e.power * (now - lastEnergyUpdateMs) / 3600000000.0;
  }
  lastEnergyUpdateMs = now;
#endif

  if (e.valid) {
    JsonDocument doc;
    doc["node_id"] = NODE_ID;
    doc["device_name"] = NODE_DEVICE_NAME;
    doc["voltage"] = roundf(e.voltage * 10) / 10;
    doc["current"] = roundf(e.current * 1000) / 1000;
    doc["power"] = roundf(e.power * 10) / 10;
    doc["power_factor"] = roundf(e.powerFactor * 100) / 100;
    doc["energy"] = energyKwh;
    doc["fan_current"] = roundf(e.fanCurrent * 1000) / 1000;
    publishJson(SENSOR_TOPIC, doc);
  } else {
    Serial.println("[sensor] PZEM not responding, electrical reading skipped");
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

  {
    JsonDocument doc;
    doc["node_id"] = NODE_ID;
    doc["device_name"] = NODE_DEVICE_NAME;
    doc["light_state"] = lampBranchCurrent(e) > LIGHT_ON_CURRENT_A ? "ON" : "OFF";
    publishJson(SENSOR_TOPIC, doc);
  }

  Serial.printf(
    "[sensor] V=%.1f I=%.3f fan=%.3f P=%.1f lamp=%s fanRelay=%s T=%.1f H=%.1f light=%d%%\n",
    e.voltage, e.current, e.fanCurrent, e.power,
    lampOn ? "ON" : "off", fanOn ? "ON" : "off",
    climate.temperature, climate.humidity, readLightLevel());
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

  int people = (int)roundf(adcFraction(PIN_POT_PEOPLE) * MAX_PEOPLE);
  bool blocked = switchActive(PIN_FAN_BLOCKED);
  bool personAtBoard = switchActive(PIN_PERSON_AT_BOARD);
  float ink = roundf(adcFraction(PIN_POT_BOARD_INK) * MAX_BOARD_INK * 1000) / 1000;

  {
    JsonDocument doc;
    doc["node_id"] = CAMERA_ID;
    doc["device_name"] = CAMERA_DEVICE_NAME;
    doc["occupancy_count"] = people;
    publishJson(VISION_TOPIC, doc);
  }

  bool running = fanOn && !blocked;

  {
    JsonDocument doc;
    doc["node_id"] = CAMERA_ID;
    doc["device_name"] = FAN_DEVICE_NAME;
    JsonObject motion = doc["fan_motion"].to<JsonObject>();
    motion["running"] = running;
    motion["motion_score"] = running ? 0.3 : 0.0;
    motion["confidence"] = 0.95;
    publishJson(VISION_TOPIC, doc);
  }

  {
    JsonDocument doc;
    doc["node_id"] = CAMERA_ID;
    doc["device_name"] = CAMERA_DEVICE_NAME;
    JsonObject board = doc["board"].to<JsonObject>();

    if (personAtBoard) {
      board["state"] = "OCCLUDED";
      board["ink_ratio"] = nullptr;
      board["confidence"] = 0.0;
    } else {
      board["state"] = boardState(ink);
      board["ink_ratio"] = ink;
      board["confidence"] = 0.95;
    }

    publishJson(VISION_TOPIC, doc);
  }

  Serial.printf(
    "[camera] people=%d fan=%s board=%s ink=%.2f\n",
    people, running ? "rotating" : "stopped",
    personAtBoard ? "OCCLUDED" : boardState(ink), ink);
}

#endif


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

  bool ok = mqtt.connect(
    clientId.c_str(),
    nullptr, nullptr,
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

  pinMode(PIN_LAMP_RELAY, OUTPUT);
  pinMode(PIN_FAN_RELAY, OUTPUT);
  pinMode(PIN_MQTT_LED, OUTPUT);

  pinMode(PIN_LAMP_BUTTON, INPUT_PULLUP);
  pinMode(PIN_FAN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_FAN_BLOCKED, INPUT_PULLUP);
  pinMode(PIN_PERSON_AT_BOARD, INPUT_PULLUP);
  pinMode(PIN_CAMERA_OFFLINE, INPUT_PULLUP);

  analogReadResolution(12);

  applyRelays();

#if SIMULATION
  dht.setup(PIN_DHT, DHTesp::DHT22);
#else
  dht.setup(PIN_DHT, DHTesp::DHT11);
#endif

  connectWifi();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(512);
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

  // Wall switches toggle the relays locally.
  if (buttonPressed(lampButton)) {
    setRelay("LAMP", !lampOn, "wall switch");
  }

  if (buttonPressed(fanButton)) {
    setRelay("FAN", !fanOn, "wall switch");
  }

  if (!mqtt.connected()) {
    return;
  }

  unsigned long now = millis();

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
