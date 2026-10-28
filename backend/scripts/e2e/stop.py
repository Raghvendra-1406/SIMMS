"""
Stop a stack left running by `run.py --keep`: exactly the processes it
started (backend, test broker, dev server; listed in .run/pids.txt) and
the throwaway database. Nothing else is touched.

    cd backend
    python scripts/e2e/stop.py
"""

import os
import subprocess
from pathlib import Path

import pgserver

RUN = Path(__file__).resolve().parent / ".run"


def main():
    pids_file = RUN / "pids.txt"

    if pids_file.exists():
        for pid in pids_file.read_text().split():
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", pid, "/T", "/F"], capture_output=True)
            else:
                subprocess.run(["kill", pid], capture_output=True)
        pids_file.unlink()

    if (RUN / "pgdata").exists():
        pgserver.get_server(str(RUN / "pgdata"), cleanup_mode="stop").cleanup()

    print("End-to-end test stack stopped.")


if __name__ == "__main__":
    main()
