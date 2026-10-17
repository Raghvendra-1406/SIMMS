# SIMMS – Getting Started

Smart classroom monitoring. It detects failed fans and tube lights, energy wasted in empty rooms, boards left dirty, and electrical problems, then creates maintenance tickets automatically.

Electricity is metered **per circuit** (one meter for all tube lights, one for all fans, optionally one for the main supply), not per appliance. Circuit current says how many units are on; the camera says which unit has failed.

```
ESP32 node (Wokwi or real)   ──MQTT──►  Mosquitto  ◄──MQTT──  camera: Raspberry Pi / laptop
                                            │
                                            ▼
                         FastAPI backend (+ PostgreSQL)  ◄──REST──  React dashboard
```

To put it online (Vercel + Render + HiveMQ Cloud + Neon, all free), see **[DEPLOY.md](DEPLOY.md)**.

## 1. Install first

| Tool | Version | Why |
|---|---|---|
| Python | 3.10+ | Backend (3.11 tested) |
| Node.js | 20.19+ or 22.12+ | Frontend |
| PostgreSQL | 16+ | Database: local install, Docker, or Neon (cloud) |
| Mosquitto | 2.x | MQTT broker for sensor and camera data (<https://mosquitto.org/download/>) |
| VS Code + **Wokwi Simulator** + **PlatformIO IDE** | latest | Only for the ESP32 simulation (`firmware/simms_node/README.md`) |

## 2. Database

1. Create a database, e.g. `simms` (or a Neon project).
2. Create the tables on an empty database (run from the project root):

```powershell
psql -U postgres -d simms -f backend/database/schema.sql
```

A database created from an **older** `schema.sql` needs the migrations applied in order:

```powershell
psql -d simms -f backend/database/migrations/001_node_status.sql
psql -d simms -f backend/database/migrations/002_ticket_reliability.sql
psql -d simms -f backend/database/migrations/003_circuit_monitoring.sql
```

## 3. Backend (port 8000)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Fill in `backend/.env`. Either paste one connection string (e.g. from Neon) or the separate `DB_*` values:

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
# or: DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD

JWT_SECRET_KEY=<paste a random string>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

POST_REPAIR_VERIFICATION_HOURS=24

MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
MQTT_TOPIC_PREFIX=

# Plan values. For simulation dry runs use VACANCY_MINUTES=1, COOLDOWN_MINUTES=2.
VACANCY_MINUTES=10
COOLDOWN_MINUTES=30
NODE_OFFLINE_SECONDS=90
HEALTH_INTERVAL_SECONDS=60
```

Generate `JWT_SECRET_KEY` with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. The server will not start without it.

Check the DB connection, create the first admin (one time only), create the demo classroom, then start:

```powershell
python test_connection.py
python -c "from services.auth_service import register_user; register_user('Admin', 'admin@simms.com', 'ChangeMe123', 'ADMIN')"
python -m scripts.seed_demo        # room R101: Fan 1-6, Tube 1-6, "ESP32 Node", "Camera"
uvicorn main:app --reload
```

- API docs: http://localhost:8000/docs
- Run a **single** server process. Do not use `--workers`: the confirmation windows live in memory.
- The backend retries the MQTT broker forever, so Mosquitto can be started before or after it.
- Background jobs start with the server. They recompute health scores every `HEALTH_INTERVAL_SECONDS` and mark silent nodes OFFLINE after `NODE_OFFLINE_SECONDS`.

## 4. MQTT broker

Start Mosquitto, either from `services.msc` (the "Mosquitto Broker" service) or with `"C:\Program Files\mosquitto\mosquitto.exe" -v`. The default config accepts connections from this PC on port 1883, which is all the simulation needs.

For a real ESP32 or Raspberry Pi on the LAN, add this to `mosquitto.conf` and restart the broker:

```
listener 1883 0.0.0.0
allow_anonymous true
```

## 5. Frontend (port 5173)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and log in.

The frontend expects the backend at `http://localhost:8000`. To use another address, e.g. from a phone on the LAN, create `frontend/.env.local` with `VITE_API_BASE_URL=http://<pc-ip>:8000`. Add that origin to `allow_origins` in `backend/main.py` as well.

## 6. Using the app

| Role | What they do |
|---|---|
| **ADMIN** | Adds classrooms, devices, users. Draws the board, seat, fan and tube-light areas on the camera image (Calibration). Learns each circuit's per-unit current (Classrooms → room → Circuits). Can see the Live monitor. |
| **SUPERVISOR** | Watches the **Live monitor** (switches the demo-panel lights/fans circuit relays), classrooms, faults and tickets. Gets notifications and verifies repairs. |
| **MAINTENANCE_STAFF** | Sees open tickets and marks them **RESOLVED** after fixing. |

**First-time setup (as admin):** Classrooms → Devices (one FAN per fan, one LIGHT per tube) → Users → Calibration → Circuits (learn per-unit current). `scripts/seed_demo.py` does the first two for room R101.

**Fault types:**

| Fault | How it's detected | Priority |
|---|---|---|
| Fan failure | Fans circuit says N fans powered, camera sees fewer rotating: the stopped one is named (or "1 of Fan 3, Fan 6" when ambiguous) | HIGH |
| Light failure | Lights circuit says N tubes powered, camera sees fewer lit | MEDIUM |
| Energy wastage | Lights or fans powered while the room has been empty for `VACANCY_MINUTES` | MEDIUM |
| Electrical abnormality | Supply voltage out of range, circuit overcurrent, low power factor | HIGH |
| Board needs cleaning | Board ink > 25 % while the room has been empty for `VACANCY_MINUTES` | LOW |

**Ticket flow:**
- A fault is confirmed (4 of 5 readings), and the ticket is **OPEN**.
- Maintenance marks it **RESOLVED**. The supervisor then verifies it five times, and it becomes **CLOSED** (fixed) or **REOPENED** (still broken).
- If the fault clears before anyone acts (3 of 5 readings normal), the ticket closes itself as **AUTO_RESOLVED**.
- If the same fault returns within 24 h of RESOLVED, the same ticket **reopens**. Three recurrences in 7 days raise its priority one level.
- After a ticket closes, the same fault is suppressed for `COOLDOWN_MINUTES`.

**The dashboard updates by itself.**
- **Live monitor:** every 3 s.
- **Dashboards, lists and classroom pages:** every 10 s.
- **Notification badge:** every 15 s.

## 7. Simulation without hardware

Three options, from most to least realistic:

1. **Wokwi ESP32 simulation**, with knobs and switches for every sensor and a "virtual camera". See `firmware/simms_node/README.md` for setup, the part list and a scenario playbook covering the plan's test cases T1–T17.
2. **Fake node** (Python, no Wokwi): sends exactly the same messages.

   ```powershell
   cd backend
   python -m scripts.fake_node                              # 6 fans + 6 tubes on, 20 people
   python -m scripts.fake_node --blocked-fan 3              # fan failure: Fan 3
   python -m scripts.fake_node --failed-tube 4              # light failure: Tube 4
   python -m scripts.fake_node --fans-on 4                  # 4 fans on: no fault
   python -m scripts.fake_node --people 0                   # energy wastage
   python -m scripts.fake_node --people 0 --board-ink 0.4   # board needs cleaning
   python -m scripts.fake_node --fans-overload              # circuit overcurrent
   python -m scripts.fake_node --voltage 260                # supply voltage fault
   ```

3. **Single messages** with `mosquitto_pub`. Run these in Git Bash, because PowerShell breaks the JSON quotes:

   ```bash
   mosquitto_pub -t "classroom/R101/sensors" -m '{"voltage": 230, "circuits": {"LIGHTS": {"current": 0.62, "power": 135}, "FANS": {"current": 1.82, "power": 356}}}'
   mosquitto_pub -t "classroom/R101/vision"  -m '{"occupancy_count": 0}'
   mosquitto_pub -t "classroom/R101/vision"  -m '{"fans": [{"device_name": "Fan 1", "running": false, "confidence": 0.9}]}'
   mosquitto_pub -t "classroom/R101/vision"  -m '{"lights": [{"device_name": "Tube 1", "lit": true, "confidence": 0.9}]}'
   mosquitto_pub -t "classroom/R101/vision"  -m '{"board": {"state": "DIRTY", "ink_ratio": 0.4, "confidence": 1.0}}'
   ```

**Rules to keep in mind:**
- A fault is confirmed when **4 of the last 5** readings are abnormal.
- Energy wastage and board cleaning also need the room to be empty for `VACANCY_MINUTES`.
- A fan / tube that is off and not drawing current is normal; only a unit the circuit says is powered but the camera sees not working is faulty.
- Units the camera can't see are never blamed.
- A full board while people are present is normal.
- Readings with `"state": "OCCLUDED"` or a confidence below 0.55 do not count.

## 8. Topics

All topics sit under an optional `MQTT_TOPIC_PREFIX`. The firmware's `TOPIC_PREFIX` must match it.

| Topic | Direction | Content |
|---|---|---|
| `classroom/<room>/sensors` | node → server | `{"voltage", "circuits": {"MAIN", "LIGHTS", "FANS"}}` (current, power, power_factor, energy each); environment |
| `classroom/<room>/vision` | camera → server | `occupancy_count` (+ seats), `board`, `{"fans": [...]}` and `{"lights": [...]}` batches (one entry per unit) |
| `classroom/<room>/status/<node_id>` | node → server, retained | `{"state": "ONLINE"/"OFFLINE", ...}`; the last will sends OFFLINE |
| `classroom/<room>/command` | server → node | `{"target": "LIGHTS"/"FANS", "state": "ON"/"OFF"}` (demo-panel circuit relays) |

Messages may name devices with `device_name` ("Fan 1", "Tube 4") instead of `device_id`. `<room>` must match the classroom name exactly.

## 9. Camera (Raspberry Pi, or a laptop standing in for it)

The same code runs on both. Only `--source` changes.

```powershell
cd backend
pip install -r requirements-vision.txt      # ultralytics, OpenCV (about 2 GB with PyTorch)

# Save a frame of the empty room, then upload it on the admin Calibration page
python -m models.camera_capture --source 0 --snapshot room.jpg

python -m models.vision_runtime --room-name R101 --source 0 --interval 30 --show
```

| `--source` | Camera |
|---|---|
| `picamera` | Raspberry Pi Camera Module (on the Pi: `sudo apt install python3-picamera2`) |
| `0`, `1`, … | USB / laptop webcam |
| `http://<phone-ip>:8080/video` | Phone running the "IP Webcam" app |
| `clip.mp4` / `photos\` | Video file (looped) or folder of images: repeatable dry runs |

- `--show` opens a debug window with people, seats, the board and fans drawn on the image. Press Q to quit.
- Without a calibration, only the people count is published.
- If frames stop for two cycles, the camera is reported OFFLINE (T17).
- The camera machine needs this `.env` (for the database and the broker).
- While the real camera runs, turn off the Wokwi virtual camera (switch 3).

## 10. Running the tests

The backend has a pytest suite (`backend/tests`) covering the confirmation window, the fault pipeline, routing and response SLA, offline buffering, Device offline, Web Push, the energy report, the health score and the API's role checks.

```powershell
cd backend
.venv\Scriptsctivate
pip install -r requirements-dev.txt
python -m pytest
```

It runs against a **throwaway PostgreSQL**, never your real database:

- By default it starts an embedded PostgreSQL (`pgserver`) in a temporary folder and deletes it afterwards.
- Or set `TEST_DATABASE_URL` to a local PostgreSQL database you don't mind being wiped.
- It refuses to run against anything that isn't `localhost`, and it doesn't read `backend/.env`.

GitHub Actions runs the same suite on every push and pull request (with a PostgreSQL service container). Deploys only happen when it passes.

## Common problems

| Problem | Fix |
|---|---|
| `JWT_SECRET_KEY is not set` | Add it to `backend/.env`. |
| Login works, but pages show errors | Your token expired (60 min). Log out and log in again. |
| Live monitor: "not connected to the MQTT broker" | Start Mosquitto. The backend reconnects on its own. |
| `Message ignored. Room not found` in the backend log | The room name in the topic must match the classroom name exactly (case-sensitive). |
| `Unknown device_name 'Fan 1'` | Create the device in that room (Devices page, or `scripts.seed_demo`). |
| Frontend shows "Failed to fetch" | The backend isn't running on port 8000. |
| Slow updates with a cloud database | Each query goes over the internet (≈0.2 s to Neon). Use a local PostgreSQL for the demo. |
