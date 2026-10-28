#pragma once

// Local settings for the real ESP32 (env:hw).
// Copy this file to secrets.h (same folder) and fill it in.
// secrets.h is git-ignored: never commit real passwords.

// 2.4 GHz network shared with the laptop and the Raspberry Pi
// (the ESP32 cannot join 5 GHz). Case-sensitive.
#define WIFI_SSID "your-hotspot-name"
#define WIFI_PASSWORD "your-hotspot-password"

// IPv4 address of the laptop running Mosquitto (ipconfig -> Wi-Fi).
#define MQTT_HOST "192.168.1.10"

// Optional second network, tried when the first is out of range
// (e.g. home Wi-Fi + phone hotspot at the demo venue). With a local
// broker the laptop has a different IP on it: set MQTT_HOST_2.
// With a cloud broker leave MQTT_HOST_2 out (same host everywhere).
// #define WIFI_SSID_2 "phone-hotspot-name"
// #define WIFI_PASSWORD_2 "phone-hotspot-password"
// #define MQTT_HOST_2 "192.168.43.10"

// No PZEM on the room's main supply (only lights/fans meters):
// #define HAS_MAIN_METER 0

// Optional: must match MQTT_TOPIC_PREFIX in backend/.env.
// #define TOPIC_PREFIX ""

// Hosted broker (HiveMQ Cloud) instead of the laptop:
// #define MQTT_HOST "xxxx.s1.eu.hivemq.cloud"
// #define MQTT_PORT 8883
// #define MQTT_USE_TLS 1
// #define MQTT_USERNAME "simms-node"
// #define MQTT_PASSWORD "..."
