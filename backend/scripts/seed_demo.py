"""
Create the demo classroom and devices used by the simulation.

Safe to run repeatedly: existing rows are kept.

    cd backend
    python -m scripts.seed_demo            # room R101
    python -m scripts.seed_demo --room R102
"""

import argparse

from database.repositories.room_repository import (
    get_room_by_name,
)

from database.repositories.device_repository import (
    get_device_by_room_and_name,
)

from services.room_service import add_room

from services.device_service import add_device


# Names must match firmware/simms_node/src/config.h.
DEMO_DEVICES = [
    ("FAN", "Fan 1"),
    ("SENSOR_NODE", "ESP32 Node"),
    ("CAMERA", "Camera"),
]


def seed(room_name):
    room = get_room_by_name(room_name)

    if room is None:
        room = add_room(
            room_name=room_name,
            room_type="CLASSROOM",
            building="Main Block",
            floor=3,
            capacity=40,
        )
        print(f"Created room {room_name} (room_id {room[0]}).")

    else:
        print(f"Room {room_name} exists (room_id {room[0]}).")

    room_id = room[0]

    for device_type, device_name in DEMO_DEVICES:
        device = get_device_by_room_and_name(room_id, device_name)

        if device is None:
            device = add_device(
                room_id=room_id,
                device_type=device_type,
                device_name=device_name,
            )
            print(
                f"  Created {device_type} '{device_name}' "
                f"(device_id {device[0]})."
            )

        else:
            print(
                f"  {device_type} '{device_name}' exists "
                f"(device_id {device[0]})."
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--room", default="R101")
    seed(parser.parse_args().room)
