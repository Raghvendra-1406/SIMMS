"""
Device-offline faults (Plan v2 §16 T13 / T17).

A sensor node or camera that stays OFFLINE for DEVICE_OFFLINE_FAULT_MINUTES
raises a DEVICE_OFFLINE fault through the normal pipeline (one ticket,
cooldown, recurrence). When it is heard from again the fault clears:
an untouched ticket auto-resolves, a ticket staff already started goes
through verification as usual.

Offline time counts from the node's last_seen (the last time it was
actually heard), so last-will, staleness and a camera reporting itself
OFFLINE are all handled the same way. Brief network blips stay below the
threshold and never reach a ticket.
"""

from datetime import datetime, timezone

from config.settings import DEVICE_OFFLINE_FAULT_MINUTES

from database.repositories.device_repository import get_devices_by_room

from services.fault_detector import get_active_fault

from database.repositories.node_status_repository import get_all_nodes

from services.fault_types import FAULT_DEVICE_OFFLINE


# node_status.kind -> devices.device_type
NODE_DEVICE_TYPES = {
    "SENSOR_NODE": "SENSOR_NODE",
    "CAMERA": "CAMERA",
}

KIND_LABELS = {
    "SENSOR_NODE": "Sensor node",
    "CAMERA": "Camera",
}


def device_for_node(room_id, kind):
    """
    The room's device row for this kind of node (first match), or None.
    """

    device_type = NODE_DEVICE_TYPES.get(kind)

    if device_type is None:
        return None

    for device in get_devices_by_room(room_id):
        if device[2] == device_type:
            return device

    return None


def node_for_device(room_id, device_id):
    """
    The node_status row matching a device (by kind), or None.
    """

    for device in get_devices_by_room(room_id):
        if device[0] != device_id:
            continue

        kinds = {
            kind for kind, device_type in NODE_DEVICE_TYPES.items()
            if device_type == device[2]
        }

        nodes = [
            node for node in get_all_nodes()
            if node["room_id"] == room_id and node["kind"] in kinds
        ]

        return nodes[0] if nodes else None

    return None


def offline_minutes(node, now=None):
    now = now or datetime.now(timezone.utc)

    return (now - node["last_seen"]).total_seconds() / 60


def describe_offline(node, device):
    label = device[3] if device else KIND_LABELS.get(node["kind"], "Device")

    minutes = offline_minutes(node)

    return (
        f"{label} ({node['node_id']}) not heard from for "
        f"{minutes:.0f} min"
    )


def device_condition(room_id, device_id):
    """
    For verification: (abnormal, details) like fault_conditions.
    """

    node = node_for_device(room_id, device_id)

    if node is None:
        return None, {"summary": "No status reported for this device."}

    return (
        node["state"] == "OFFLINE",
        {
            "node_id": node["node_id"],
            "state": node["state"],
            "last_seen": node["last_seen"].isoformat(),
        },
    )


def check_offline_devices():
    """
    Scheduler job. Returns [(action, node_id)] for logging.
    """

    # Imported here: fault_processing_service imports a lot at load.
    from services.fault_processing_service import (
        handle_confirmed_fault,
        handle_recovered_fault,
    )

    actions = []

    for node in get_all_nodes():
        kind = node["kind"]

        if kind not in NODE_DEVICE_TYPES:
            continue

        room_id = node["room_id"]
        device = device_for_node(room_id, kind)
        device_id = device[0] if device else None

        offline_long = (
            node["state"] == "OFFLINE"
            and offline_minutes(node) >= DEVICE_OFFLINE_FAULT_MINUTES
        )

        active = get_active_fault(
            room_id=room_id,
            fault_type=FAULT_DEVICE_OFFLINE,
            device_id=device_id
        )

        if offline_long and active is None:
            result = handle_confirmed_fault(
                fault_type=FAULT_DEVICE_OFFLINE,
                room_id=room_id,
                device_id=device_id,
                abnormal_count=None,
                details={
                    "summary": describe_offline(node, device),
                    "node_id": node["node_id"],
                    "kind": kind,
                    "last_seen": node["last_seen"].isoformat(),
                },
                detected_at=node["last_seen"]
            )

            actions.append((result["action"], node["node_id"]))

        elif node["state"] == "ONLINE" and active is not None:
            result = handle_recovered_fault(
                fault_type=FAULT_DEVICE_OFFLINE,
                room_id=room_id,
                device_id=device_id
            )

            if result:
                actions.append((result["action"], node["node_id"]))

    return actions
