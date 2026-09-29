"""
Software stand-in for the ESP32 node + virtual camera.

Publishes exactly the MQTT messages the firmware in
firmware/simms_node publishes, so the backend and dashboard can be
tested without Wokwi or hardware. It also obeys relay commands
from the dashboard.

    cd backend
    python -m scripts.fake_node                          # normal room
    python -m scripts.fake_node --people 0 --lamp on     # lights left on
    python -m scripts.fake_node --blocked                # fan failure
    python -m scripts.fake_node --people 0 --board-ink 0.4
    python -m scripts.fake_node --voltage 260            # electrical fault

Stop with Ctrl+C (the node then goes OFFLINE via its last will).
"""

import argparse
import json
import random
import threading
import time

import paho.mqtt.client as mqtt

from config.settings import MQTT_BROKER_HOST, MQTT_BROKER_PORT
from mqtt.topics import (
    command_topic,
    sensor_topic,
    status_topic,
    vision_topic,
)


FW_VERSION = "fake-1.0"

# Same load model as the firmware (firmware/simms_node/src/main.cpp).
LAMP_CURRENT_A = 0.18
BASE_CURRENT_A = 0.02
POWER_FACTOR = 0.92

# Board thresholds (Plan v2 §8.3), same as models/board_detector.py.
BOARD_CLEAN_MAX = 0.05
BOARD_IN_USE_MAX = 0.25


def board_state(ink_ratio):
    if ink_ratio < BOARD_CLEAN_MAX:
        return "CLEAN"

    if ink_ratio <= BOARD_IN_USE_MAX:
        return "IN_USE"

    return "DIRTY"


class FakeNode:
    def __init__(self, args):
        self.args = args
        self.room = args.room
        self.node_id = f"esp32-{self.room}"
        self.camera_id = f"vcam-{self.room}"

        self.relays = {
            "lamp": args.lamp == "on",
            "fan": args.fan == "on",
        }

        self.energy_kwh = 0.0
        self.started = time.monotonic()
        self.lock = threading.Lock()

        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"{self.node_id}-{random.randint(0, 99999)}",
        )

        self.client.will_set(
            status_topic(self.room, self.node_id),
            json.dumps({"state": "OFFLINE", "kind": "SENSOR_NODE"}),
            qos=1,
            retain=True,
        )

        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message

    # -------------------------------------------------------
    # MQTT
    # -------------------------------------------------------

    def on_connect(self, client, userdata, flags, reason_code, properties):
        print(f"Connected to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
        client.subscribe(command_topic(self.room), qos=1)
        self.publish_status()

    def on_message(self, client, userdata, message):
        if message.topic != command_topic(self.room):
            return

        try:
            command = json.loads(message.payload)
            target = command["target"].lower()
            state = command["state"] == "ON"

        except (ValueError, KeyError, AttributeError):
            print(f"Ignoring bad command: {message.payload!r}")
            return

        if target not in self.relays:
            return

        with self.lock:
            self.relays[target] = state

        print(f"Command: {target} -> {'ON' if state else 'OFF'}")

        # Report the new state straight away.
        self.publish_status()
        self.publish_sensors()

    def publish(self, topic, payload, retain=False):
        self.client.publish(
            topic,
            json.dumps(payload),
            qos=1,
            retain=retain,
        )

    # -------------------------------------------------------
    # MESSAGES (same shape as the firmware)
    # -------------------------------------------------------

    def publish_status(self):
        with self.lock:
            relays = dict(self.relays)

        self.publish(
            status_topic(self.room, self.node_id),
            {
                "state": "ONLINE",
                "kind": "SENSOR_NODE",
                "rssi": -55,
                "uptime_s": int(time.monotonic() - self.started),
                "fw_version": FW_VERSION,
                "relays": relays,
            },
            retain=True,
        )

        if not self.args.no_camera:
            self.publish(
                status_topic(self.room, self.camera_id),
                {
                    "state": "ONLINE",
                    "kind": "CAMERA",
                    "fw_version": FW_VERSION,
                    "virtual": True,
                },
                retain=True,
            )

    def publish_sensors(self):
        args = self.args

        with self.lock:
            relays = dict(self.relays)

        fan_current = args.fan_load if relays["fan"] else 0.0
        lamp_current = LAMP_CURRENT_A if relays["lamp"] else 0.0
        current = fan_current + lamp_current + BASE_CURRENT_A
        power = args.voltage * current * POWER_FACTOR

        self.energy_kwh += power * args.interval / 3_600_000

        common = {
            "node_id": self.node_id,
            "device_name": "ESP32 Node",
        }

        self.publish(sensor_topic(self.room), {
            **common,
            "voltage": round(args.voltage, 1),
            "current": round(current, 3),
            "power": round(power, 1),
            "power_factor": POWER_FACTOR,
            "energy": round(self.energy_kwh, 5),
            "fan_current": round(fan_current, 3),
        })

        self.publish(sensor_topic(self.room), {
            **common,
            "temperature": args.temperature,
            "humidity": args.humidity,
            "light_level": 80 if relays["lamp"] else 15,
        })

        self.publish(sensor_topic(self.room), {
            **common,
            "light_state": "ON" if lamp_current > 0.05 else "OFF",
        })

    def publish_vision(self):
        if self.args.no_camera:
            return

        args = self.args

        with self.lock:
            fan_on = self.relays["fan"]

        common = {"node_id": self.camera_id}

        self.publish(vision_topic(self.room), {
            **common,
            "device_name": "Camera",
            "occupancy_count": args.people,
        })

        running = fan_on and not args.blocked

        self.publish(vision_topic(self.room), {
            **common,
            "device_name": "Fan 1",
            "fan_motion": {
                "running": running,
                "motion_score": 0.3 if running else 0.0,
                "confidence": 0.95,
            },
        })

        if args.person_at_board:
            board = {
                "state": "OCCLUDED",
                "ink_ratio": None,
                "confidence": 0.0,
            }

        else:
            board = {
                "state": board_state(args.board_ink),
                "ink_ratio": args.board_ink,
                "confidence": 0.95,
            }

        self.publish(vision_topic(self.room), {
            **common,
            "device_name": "Camera",
            "board": board,
        })

    # -------------------------------------------------------
    # MAIN LOOP
    # -------------------------------------------------------

    def run(self):
        self.client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, keepalive=15)
        self.client.loop_start()

        cycle = 0

        try:
            while self.args.cycles == 0 or cycle < self.args.cycles:
                cycle += 1

                self.publish_sensors()
                self.publish_vision()

                if cycle % 3 == 1:
                    self.publish_status()

                with self.lock:
                    relays = dict(self.relays)

                print(
                    f"[{cycle}] lamp={'ON' if relays['lamp'] else 'off'} "
                    f"fan={'ON' if relays['fan'] else 'off'} "
                    f"people={self.args.people} "
                    f"blocked={self.args.blocked} "
                    f"board={self.args.board_ink} "
                    f"V={self.args.voltage}"
                )

                time.sleep(self.args.interval)

        except KeyboardInterrupt:
            pass

        finally:
            if self.args.clean_exit:
                self.publish(
                    status_topic(self.room, self.node_id),
                    {"state": "OFFLINE", "kind": "SENSOR_NODE"},
                    retain=True,
                )
                time.sleep(0.5)
                self.client.disconnect()

            self.client.loop_stop()


def main():
    parser = argparse.ArgumentParser(
        description="Fake SIMMS classroom node (ESP32 + virtual camera)."
    )
    parser.add_argument("--room", default="R101")
    parser.add_argument("--interval", type=float, default=10.0)
    parser.add_argument("--cycles", type=int, default=0,
                        help="0 = run until Ctrl+C")
    parser.add_argument("--lamp", choices=["on", "off"], default="on")
    parser.add_argument("--fan", choices=["on", "off"], default="on")
    parser.add_argument("--voltage", type=float, default=230.0)
    parser.add_argument("--fan-load", type=float, default=0.35,
                        help="fan branch current in A when the fan is on")
    parser.add_argument("--temperature", type=float, default=27.5)
    parser.add_argument("--humidity", type=float, default=55.0)
    parser.add_argument("--people", type=int, default=20)
    parser.add_argument("--blocked", action="store_true",
                        help="fan powered but not rotating")
    parser.add_argument("--board-ink", type=float, default=0.02)
    parser.add_argument("--person-at-board", action="store_true")
    parser.add_argument("--no-camera", action="store_true",
                        help="do not send virtual camera messages")
    parser.add_argument("--clean-exit", action="store_true",
                        help="publish OFFLINE on exit instead of "
                             "relying on the last will")

    FakeNode(parser.parse_args()).run()


if __name__ == "__main__":
    main()
