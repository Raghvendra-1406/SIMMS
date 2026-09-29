"""
Delete all runtime data (readings, faults, tickets, notifications,
health scores, node status) before a demo or a fresh test run.

Users, classrooms, devices and calibrations are kept.

    cd backend
    python -m scripts.reset_demo_data --yes

Restart the backend afterwards: its in-memory confirmation windows
still remember the old readings.
"""

import argparse

from database.connection import get_connection, transaction


# Children before parents (foreign keys).
TABLES = [
    "ticket_evidence",
    "ticket_history",
    "notifications",
    "tickets",
    "fault_events",
    "sensor_observations",
    "vision_observations",
    "health_scores",
    "node_status",
]


def reset():
    with transaction():
        cursor = get_connection().cursor()

        for table in TABLES:
            cursor.execute(f"DELETE FROM {table}")
            print(f"  {table}: {cursor.rowcount} rows deleted")

        cursor.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--yes",
        action="store_true",
        help="confirm deleting all runtime data"
    )

    if not parser.parse_args().yes:
        parser.error("add --yes to confirm")

    reset()
    print("Done. Restart the backend.")
