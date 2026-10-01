#pragma once

// =========================================================
// SIMMS classroom node - configuration
//
// SIMULATION is set by platformio.ini:
//   env:sim -> SIMULATION=1  (Wokwi: knobs/switches stand in for
//                             the PZEM, CT clamp and the camera)
//   env:hw  -> SIMULATION=0  (real ESP32 + PZEM-004T + SCT-013 + DHT11)
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
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"
#define WIFI_CHANNEL 0

// LAN IP address of the PC running Mosquitto.
#define MQTT_HOST "192.168.1.10"
#endif

#define MQTT_PORT 1883

// Hosted broker (e.g. HiveMQ Cloud free tier): set MQTT_HOST to the
// cluster URL (xxxx.s1.eu.hivemq.cloud), MQTT_PORT 8883, MQTT_USE_TLS 1
// and the credentials created in the HiveMQ console. The same values go
// in the backend's MQTT_* settings. Local Mosquitto: leave TLS off and
// the credentials empty.
#define MQTT_USE_TLS 0
#define MQTT_USERNAME ""
#define MQTT_PASSWORD ""

// Must match MQTT_TOPIC_PREFIX in backend/.env ("" = none).
#define TOPIC_PREFIX ""


// ---------------------------------------------------------
// Classroom identity - must match the dashboard exactly
// (backend/scripts/seed_demo.py creates these).
// ---------------------------------------------------------

#define ROOM_NAME "R101"
#define NODE_DEVICE_NAME "ESP32 Node"
#define CAMERA_DEVICE_NAME "Camera"
#define FAN_DEVICE_NAME "Fan 1"

#define FW_VERSION "1.0.0"


// ---------------------------------------------------------
// Timing
// ---------------------------------------------------------

// Plan v2 uses 5 s sensors / 60 s vision; the simulation uses
// 10 s for both so the 4-of-5 confirmation takes ~50 s.
#define SENSOR_INTERVAL_MS 10000
#define VISION_INTERVAL_MS 10000
#define STATUS_INTERVAL_MS 30000

// MQTT keep-alive: the broker publishes the last-will OFFLINE
// message ~1.5x this long after the node disappears.
#define MQTT_KEEPALIVE_S 15


// ---------------------------------------------------------
// Virtual camera (simulation only)
//
// When 1, the node also publishes what the Raspberry Pi camera
// would: people count, board state and fan rotation, taken from
// knobs and switches. Set to 0 (or slide "camera offline" ON)
// when the real vision runtime runs on a laptop / Pi.
// ---------------------------------------------------------

#if SIMULATION
#define VIRTUAL_CAMERA 1
#else
#define VIRTUAL_CAMERA 0
#endif


// ---------------------------------------------------------
// Relays
//
// Common opto-isolated relay boards switch ON with a LOW input.
// In the simulation the relay outputs are shown on LEDs.
// ---------------------------------------------------------

#if SIMULATION
#define RELAY_ACTIVE_LOW 0
#else
#define RELAY_ACTIVE_LOW 1
#endif

// Relay state after power-up.
#define LAMP_ON_AT_BOOT true
#define FAN_ON_AT_BOOT true


// ---------------------------------------------------------
// Pins (ADC1 pins only for analog: ADC2 is unusable with Wi-Fi)
// ---------------------------------------------------------

#define PIN_DHT 15              // DHT22 (sim) / DHT11 (hw) data
#define PIN_LDR 36              // LDR module AO (VP)

#define PIN_POT_VOLTAGE 34      // sim: mains voltage knob
#define PIN_FAN_CURRENT 35      // sim: fan load knob / hw: SCT-013 clamp
#define PIN_POT_PEOPLE 32       // sim: virtual camera people count
#define PIN_POT_BOARD_INK 33    // sim: virtual camera board ink

#define PIN_LAMP_RELAY 26
#define PIN_FAN_RELAY 27

#define PIN_LAMP_BUTTON 18      // wall switch (push to toggle)
#define PIN_FAN_BUTTON 19

#define PIN_FAN_BLOCKED 13      // sim: fan blade obstructed
#define PIN_PERSON_AT_BOARD 14  // sim: someone standing at the board
#define PIN_CAMERA_OFFLINE 23   // sim: camera stops delivering frames

#define PIN_MQTT_LED 4          // on while connected to the broker

// hw only: PZEM-004T v3 on UART2
#define PIN_PZEM_RX 16
#define PIN_PZEM_TX 17


// ---------------------------------------------------------
// Load model / thresholds
// ---------------------------------------------------------

#define LAMP_CURRENT_A 0.18f    // two LED bulbs on the demo panel
#define BASE_CURRENT_A 0.02f    // panel standby draw
#define POWER_FACTOR 0.92f

// Lamp counts as ON above this branch current.
#define LIGHT_ON_CURRENT_A 0.05f

// SCT-013-030: 1 V output at 30 A.
#define CT_AMPS_PER_VOLT 30.0f

// Board thresholds (Plan v2 §8.3), same as backend BoardDetector.
#define BOARD_CLEAN_MAX 0.05f
#define BOARD_IN_USE_MAX 0.25f

#define MAX_PEOPLE 40
#define MAX_BOARD_INK 0.60f
