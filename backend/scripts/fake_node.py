"""
Software stand-in for the ESP32 node + virtual camera.

Publishes exactly the MQTT messages the firmware in
firmware/simms_node publishes (circuit-level metering: one reading
for the LIGHTS circuit, one for the FANS circuit, one for the main
supply), so the backend and dashboard can be tested without Wokwi or
hardware. It also obeys circuit relay commands from the dashboard.

    cd backend
    python -m scripts.fake_node                          # 6 fans, 6 tubes on
    python -m scripts.fake_node --blocked-fan 3          # Fan 3 powered, not rotating
    python -m scripts.fake_node --failed-tube 4          # Tube 4 powered, dark
    python -m scripts.fake_node --people 0               # energy wastage
    python -m scripts.fake_node --people 0 --board-ink 0.4
    python -m scripts.fake_node --fans-overload          # fans circuit overcurrent
    python -m scripts.fake_node --voltage 260            # supply voltage fault

Stop with Ctrl+C (the node then goes OFFLINE via its last will).
"""

import argparse
import json
import random
import threading
import time

import paho.mqtt.client as mqtt

from config.settings import MQTT_BROKER_HOST, MQTT_BROKER_PORT
from mqtt.connection import configure_client
from mqtt.topics import (
    command_topic,
    sensor_topic,
    status_topic,
    vision_topic,
)


FW_VERSION = "fake-2.0"

UNITS = 6

# Same load model as the firmware (firmware/simms_node/src/main.cpp).
FAN_CURRENT_A = 0.30
STALLED_FAN_CURRENT_A = 0.36   # a seized fan still draws current
TUBE_CURRENT_A = 0.10
CIRCUIT_STANDBY_A = 0.02
SOCKETS_CURRENT_A = 0.40       # projector, chargers (main supply only)
OVERLOAD_CURRENT_A = 25.0

FANS_POWER_FACTOR = 0.85
LIGHTS_POWER_FACTOR = 0.95
SOCKETS_POWER_FACTOR = 0.90

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

        # Demo-panel circuit relays (classrooms themselves are not
        # switched: Plan v2 §5.3).
        self.relays = {"lights": True, "fans": True}

        self.energy_kwh = {"MAIN": 0.0, "LIGHTS": 0.0, "FANS": 0.0}
        self.started = time.monotonic()
        self.lock = threading.Lock()

        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"{self.node_id}-{random.randint(0, 99999)}",
        )

        configure_client(self.client)

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

        print(f"Command: {target} circuit -> {'ON' if state else 'OFF'}")

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
    # MODEL
    # -------------------------------------------------------

    def units_on(self):
        with self.lock:
            relays = dict(self.relays)

        fans_on = self.args.fans_on if relays["fans"] else 0
        lights_on = self.args.lights_on if relays["lights"] else 0

        return fans_on, lights_on, relays

    def fan_running(self, number, fans_on):
        return number <= fans_on and number != self.args.blocked_fan

    def tube_lit(self, number, lights_on):
        return number <= lights_on and number != self.args.failed_tube

    # -------------------------------------------------------
    # MESSAGES (same shape as the firmware)
    # -------------------------------------------------------

    def publish_status(self):
        _, _, relays = self.units_on()

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

    def circuit(self, name, current, power_factor):
        power = self.args.voltage * current * power_factor

        self.energy_kwh[name] += power * self.args.interval / 3_600_000

        return {
            "current": round(current, 3),
            "power": round(power, 1),
            "power_factor": power_factor,
            "energy": round(self.energy_kwh[name], 5),
        }

    def publish_sensors(self):
        args = self.args

        fans_on, lights_on, _ = self.units_on()

        fans_current = CIRCUIT_STANDBY_A + sum(
            STALLED_FAN_CURRENT_A if n == args.blocked_fan else FAN_CURRENT_A
            for n in range(1, fans_on + 1)
        )

        if args.fans_overload:
            fans_current += OVERLOAD_CURRENT_A

        # A failed tube (faulty driver) still draws current.
        lights_current = CIRCUIT_STANDBY_A + lights_on * TUBE_CURRENT_A

        fans = self.circuit("FANS", fans_current, FANS_POWER_FACTOR)
        lights = self.circuit("LIGHTS", lights_current, LIGHTS_POWER_FACTOR)

        main_current = fans_current + lights_current + SOCKETS_CURRENT_A
        main_power = (
            fans["power"] + lights["power"]
            + args.voltage * SOCKETS_CURRENT_A * SOCKETS_POWER_FACTOR
        )

        main = self.circuit(
            "MAIN",
            main_current,
            round(main_power / (args.voltage * main_current), 2),
        )

        common = {
            "node_id": self.node_id,
            "device_name": "ESP32 Node",
        }

        self.publish(sensor_topic(self.room), {
            **common,
            "voltage": round(args.voltage, 1),
            "circuits": {
                "MAIN": main,
                "LIGHTS": lights,
                "FANS": fans,
            },
        })

        self.publish(sensor_topic(self.room), {
            **common,
            "temperature": args.temperature,
            "humidity": args.humidity,
            "light_level": 80 if lights_on else 15,
        })

    def publish_vision(self):
        if self.args.no_camera:
            return

        args = self.args

        fans_on, lights_on, _ = self.units_on()

        common = {"node_id": self.camera_id}

        self.publish(vision_topic(self.room), {
            **common,
            "device_name": "Camera",
            "occupancy_count": args.people,
        })

        self.publish(vision_topic(self.room), {
            **common,
            "fans": [
                {
                    "device_name": f"Fan {n}",
                    "running": self.fan_running(n, fans_on),
                    "motion_score": 0.3 if self.fan_running(n, fans_on) else 0.0,
                    "confidence": 0.95,
                }
                for n in range(1, UNITS + 1)
            ],
        })

        self.publish(vision_topic(self.room), {
            **common,
            "lights": [
                {
                    "device_name": f"Tube {n}",
                    "lit": self.tube_lit(n, lights_on),
                    "brightness": 0.9 if self.tube_lit(n, lights_on) else 0.1,
                    "confidence": 0.95,
                }
                for n in range(1, UNITS + 1)
            ],
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

                fans_on, lights_on, relays = self.units_on()

                print(
                    f"[{cycle}] fans {fans_on}/{UNITS} "
                    f"(blocked {self.args.blocked_fan or '-'}) "
                    f"lights {lights_on}/{UNITS} "
                    f"(failed {self.args.failed_tube or '-'}) "
                    f"people={self.args.people} "
                    f"board={self.args.board_ink} V={self.args.voltage}"
                    f"{' OVERLOAD' if self.args.fans_overload else ''}"
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
    parser.add_argument("--fans-on", type=int, default=UNITS,
                        choices=range(0, UNITS + 1),
                        help="fans switched on (Fan 1..N)")
    parser.add_argument("--lights-on", type=int, default=UNITS,
                        choices=range(0, UNITS + 1),
                        help="tube lights switched on (Tube 1..N)")
    parser.add_argument("--blocked-fan", type=int, default=0,
                        help="fan number that is powered but not rotating")
    parser.add_argument("--failed-tube", type=int, default=0,
                        help="tube number that is powered but dark")
    parser.add_argument("--fans-overload", action="store_true",
                        help="add 25 A to the fans circuit")
    parser.add_argument("--voltage", type=float, default=230.0)
    parser.add_argument("--temperature", type=float, default=27.5)
    parser.add_argument("--humidity", type=float, default=55.0)
    parser.add_argument("--people", type=int, default=20)
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
