#!/usr/bin/env bash
# Install the SIMMS camera node as a systemd service on the Raspberry Pi:
# starts vision_runtime at boot, restarts it if it crashes or the
# network / database is not ready yet. No SSH session needed.
#
# Usage (on the Pi, from anywhere):
#     bash ~/SIMMS/backend/scripts/pi/install_camera_service.sh [ROOM] [SOURCE] [INTERVAL]
#     defaults:                                                  R101   0        30
#
# Afterwards:
#     systemctl status simms-camera          # running?
#     journalctl -u simms-camera -f          # live log (Ctrl+C to stop watching)
#     sudo systemctl restart simms-camera    # after git pull / .env change
#     sudo systemctl disable --now simms-camera   # remove autostart

set -euo pipefail

ROOM="${1:-R101}"
SOURCE="${2:-0}"
INTERVAL="${3:-30}"

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PYTHON="$BACKEND_DIR/.venv/bin/python"
SERVICE=/etc/systemd/system/simms-camera.service
RUN_USER="$(id -un)"

if [ ! -x "$PYTHON" ]; then
    echo "Missing $PYTHON - create the venv first:"
    echo "    cd $BACKEND_DIR && python3 -m venv .venv && .venv/bin/pip install --no-cache-dir -r requirements-pi.txt"
    exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "Missing $BACKEND_DIR/.env - copy it from the laptop (scp) and set MQTT_BROKER_HOST."
    exit 1
fi

echo "Installing $SERVICE"
echo "  user: $RUN_USER   room: $ROOM   source: $SOURCE   interval: ${INTERVAL}s"

sudo tee "$SERVICE" > /dev/null <<EOF
[Unit]
Description=SIMMS camera node (room $ROOM)
Wants=network-online.target
After=network-online.target
# Keep retrying forever (e.g. Wi-Fi or the database not reachable yet).
StartLimitIntervalSec=0

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$BACKEND_DIR
Environment=PYTHONUNBUFFERED=1
ExecStart=$PYTHON -m models.vision_runtime --room-name $ROOM --source $SOURCE --interval $INTERVAL
Restart=always
RestartSec=15

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now simms-camera

sleep 5
systemctl --no-pager --lines=15 status simms-camera || true

echo
echo "Done. Live log: journalctl -u simms-camera -f"
