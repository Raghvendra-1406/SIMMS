#pragma once

// =========================================================
// SIMMS classroom node - configuration
//
// Electrical sensing is PER CIRCUIT, not per appliance:
//   LIGHTS circuit meter  - all tube lights of the room
//   FANS circuit meter    - all fans of the room
//   MAIN meter (optional) - the room's whole supply
// The backend derives how many units are powered from circuit
// current; the camera tells it which unit is faulty.
//
// SIMULATION is set by platformio.ini:
//   env:sim -> SIMULATION=1  (Wokwi: knobs/switches stand in for the
//                             PZEM meters and the camera)
//   env:hw  -> SIMULATION=0  (real ESP32 + PZEM-004T meters + DHT11)
// =========================================================

#ifndef SIMULATION
#define SIMULATION 1
#endif


// ---------------------------------------------------------
// Network
// ---------------------------------------------------------

#if SIMULATION
// Wokwi virtual access point (no password). Channel 6 skips the scan.
#define WIFI_SSID "Wokwi-GUEST"
#define WIFI_PASSWORD ""
#define WIFI_CHANNEL 6

// Wokwi for VS Code forwards host.wokwi.internal to your PC, so this
// reaches the Mosquitto broker running on your computer.
// Cloud deployment (Render + HiveMQ Cloud): set this to your HiveMQ
// cluster host and see MQTT_USE_TLS below; works from browser Wokwi too.
// Fallback if your Wokwi licence has no private gateway: use a public
// broker such as "broker.hivemq.com" here AND in backend/.env
// (MQTT_BROKER_HOST), with a unique TOPIC_PREFIX in both.
#define MQTT_HOST "host.wokwi.internal"

#else
// Real hardware: Wi-Fi and broker come from src/secrets.h, which git
// ignores so passwords never reach the repo. Create it once:
//     copy src\secrets.example.h src\secrets.h   (then edit it)
#if __has_include("secrets.h")
#include "secrets.h"
#else
#error "Create src/secrets.h from src/secrets.example.h (Wi-Fi + broker IP)"
#endif

#ifndef WIFI_CHANNEL
#define WIFI_CHANNEL 0
#endif
#endif

#ifndef MQTT_PORT
#define MQTT_PORT 1883
#endif

// Hosted broker (e.g. HiveMQ Cloud free tier): set MQTT_HOST to the
// cluster URL (xxxx.s1.eu.hivemq.cloud), MQTT_PORT 8883, MQTT_USE_TLS 1
// and the credentials created in the HiveMQ console. The same values go
// in the backend's MQTT_* settings. Local Mosquitto: leave TLS off and
// the credentials empty.
#ifndef MQTT_USE_TLS
#define MQTT_USE_TLS 0
#endif
#ifndef MQTT_USERNAME
#define MQTT_USERNAME ""
#endif
#ifndef MQTT_PASSWORD
#define MQTT_PASSWORD ""
#endif

// Must match MQTT_TOPIC_PREFIX in backend/.env ("" = none).
#ifndef TOPIC_PREFIX
#define TOPIC_PREFIX ""
#endif


// ---------------------------------------------------------
// Classroom identity - must match the dashboard exactly
// (backend/scripts/seed_demo.py creates these).
// Units are named FAN_NAME_PREFIX + number ("Fan 1".."Fan 6") and
// TUBE_NAME_PREFIX + number ("Tube 1".."Tube 6").
// ---------------------------------------------------------

#define ROOM_NAME "R101"
#define NODE_DEVICE_NAME "ESP32 Node"
#define CAMERA_DEVICE_NAME "Camera"
#define FAN_NAME_PREFIX "Fan "
#define TUBE_NAME_PREFIX "Tube "

#define FAN_COUNT 6
#define TUBE_COUNT 6

#define FW_VERSION "2.1.0"


// ---------------------------------------------------------
// Timing
// ---------------------------------------------------------

// Plan v2 uses 5 s sensors / 60 s vision; the simulation uses
// 10 s for both so the 4-of-5 confirmation takes ~50 s.
#define SENSOR_INTERVAL_MS 10000
#define VISION_INTERVAL_MS 10000
#define STATUS_INTERVAL_MS 30000
#define DISPLAY_INTERVAL_MS 500

// MQTT keep-alive: the broker publishes the last-will OFFLINE
// message ~1.5x this long after the node disappears.
#define MQTT_KEEPALIVE_S 15

// Offline buffering (Plan v2 §16 T12): while Wi-Fi or the broker is
// down, sensor readings are kept in RAM and replayed oldest-first on
// reconnect. 2 messages per 10 s cycle -> 200 slots ~ 16 minutes.
// When full, the oldest reading is dropped.
#define BUFFER_CAPACITY 200
#define BUFFER_FLUSH_PER_LOOP 5

// How often to retry Wi-Fi while disconnected (sampling continues).
#define WIFI_RETRY_MS 5000
#define WIFI_BOOT_TIMEOUT_MS 20000


// ---------------------------------------------------------
// Virtual camera (simulation only)
//
// When 1, the node also publishes what the Raspberry Pi camera
// would: people count, board state, each fan's rotation and each
// tube's light, taken from knobs and buttons. Set to 0 (or slide
// "camera offline" ON) when the real vision runtime runs.
// ---------------------------------------------------------

#if SIMULATION
#define VIRTUAL_CAMERA 1
#else
#define VIRTUAL_CAMERA 0
#endif


// ---------------------------------------------------------
// Circuit relays (demo panel only: classrooms are monitored, not
// switched - Plan v2 §5.3). Common opto-isolated relay boards
// switch ON with a LOW input. In the simulation they are LEDs.
// ---------------------------------------------------------

#if SIMULATION
#define RELAY_ACTIVE_LOW 0
#else
#define RELAY_ACTIVE_LOW 1
#endif

#define LIGHTS_ON_AT_BOOT true
#define FANS_ON_AT_BOOT true


// ---------------------------------------------------------
// Meters (hardware): PZEM-004T v3 modules share UART2, each with its
// own Modbus address (set once with pzem.setAddress()).
// ---------------------------------------------------------

#define PZEM_ADDR_LIGHTS 0x01
#define PZEM_ADDR_FANS 0x02
#define PZEM_ADDR_MAIN 0x03

// Set to 0 when no meter is fitted on the main supply.
#define HAS_MAIN_METER 1


// ---------------------------------------------------------
// Pins (ADC1 pins only for analog: ADC2 is unusable with Wi-Fi)
// ---------------------------------------------------------

#define PIN_DHT 15              // DHT22 (sim) / DHT11 (hw) data
#define PIN_LDR 36              // LDR module AO (VP)

// Simulation inputs
#define PIN_POT_VOLTAGE 34      // supply voltage knob
#define PIN_POT_FANS_ON 35      // how many fans are switched on (0-6)
#define PIN_POT_LIGHTS_ON 39    // how many tubes are switched on (0-6) (VN)
#define PIN_POT_PEOPLE 32       // virtual camera: people count
#define PIN_POT_BOARD_INK 33    // virtual camera: board ink

#define PIN_BTN_FAN_FAULT 18    // cycles which fan is blocked (none, 1..6)
#define PIN_BTN_TUBE_FAULT 19   // cycles which tube has failed (none, 1..6)

#define PIN_FANS_OVERLOAD 13    // slide: fans circuit overcurrent
#define PIN_PERSON_AT_BOARD 14  // slide: someone standing at the board
#define PIN_CAMERA_OFFLINE 23   // slide: camera stops delivering frames

// Outputs
#define PIN_LIGHTS_RELAY 26
#define PIN_FANS_RELAY 27
#define PIN_MQTT_LED 4          // on while connected to the broker

// OLED status display (I2C)
#define PIN_I2C_SDA 21
#define PIN_I2C_SCL 22
#define OLED_ADDRESS 0x3C

// hw only: PZEM meters on UART2
#define PIN_PZEM_RX 16
#define PIN_PZEM_TX 17


// ---------------------------------------------------------
// Load model (simulation) - same as backend/scripts/fake_node.py
// ---------------------------------------------------------

#define FAN_CURRENT_A 0.30f
#define STALLED_FAN_CURRENT_A 0.36f   // a seized fan still draws current
#define TUBE_CURRENT_A 0.10f          // ~22 W LED tube
#define CIRCUIT_STANDBY_A 0.02f
#define SOCKETS_CURRENT_A 0.40f       // projector, chargers (main only)
#define OVERLOAD_CURRENT_A 25.0f

#define FANS_POWER_FACTOR 0.85f
#define LIGHTS_POWER_FACTOR 0.95f
#define SOCKETS_POWER_FACTOR 0.90f

// Board thresholds (Plan v2 §8.3), same as backend BoardDetector.
#define BOARD_CLEAN_MAX 0.05f
#define BOARD_IN_USE_MAX 0.25f

#define MAX_PEOPLE 40
#define MAX_BOARD_INK 0.60f
