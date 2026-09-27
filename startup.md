# SIMMS – Getting Started

Smart classroom monitoring: detects fan failures, lights left on in empty rooms, and electrical problems, then creates maintenance tickets automatically.

## 1. Install first

| Tool | Version | Why |
|---|---|---|
| Python | 3.10+ | Backend |
| Node.js | 20.19+ or 22.12+ | Frontend |
| PostgreSQL | any recent | Database |
| Mosquitto (MQTT broker) | any | Receives sensor/camera data |

## 2. Database

1. Create a database, e.g. `simms`.
2. Create the tables. **Note:** the repo does not contain a schema file yet, so get it from the project owner.

## 3. Backend (port 8000)

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install fastapi uvicorn psycopg2-binary "python-jose[cryptography]" bcrypt paho-mqtt python-dotenv email-validator python-multipart
copy .env.example .env
```

Fill in `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=simms
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET_KEY=<paste a random string>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

POST_REPAIR_VERIFICATION_HOURS=24

MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
```

Generate `JWT_SECRET_KEY` with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. The server will not start without it.

Check the DB connection, create the first admin (one time only), then start:

```powershell
python test_connection.py
python -c "from services.auth_service import register_user; register_user('Admin', 'admin@simms.com', 'ChangeMe123', 'ADMIN')"
uvicorn main:app --reload
```

- API docs: http://localhost:8000/docs
- Run a **single** server process. Do not use `--workers`.

## 4. MQTT broker

Start Mosquitto (default `localhost:1883`) **before** the backend. If the backend was started first, restart it, or it won't receive any data.

## 5. Frontend (port 5173)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and log in with the admin account.
The frontend expects the backend at `localhost:8000`, and the backend only accepts requests from `localhost:5173`. Keep both ports as they are.

## 6. Using the app

| Role | What they do |
|---|---|
| **ADMIN** | Adds classrooms, devices (fans etc.), users, and draws fan boxes on the camera image (Calibration). |
| **SUPERVISOR** | Watches classrooms, faults and tickets, gets notifications, verifies repairs. |
| **MAINTENANCE_STAFF** | Sees open tickets and marks them **RESOLVED** after fixing. |

**First-time setup (as admin):** Classrooms → Devices → Users → Calibration.

**Ticket flow:** fault detected → ticket **OPEN** → maintenance marks **RESOLVED** → supervisor clicks verify 5 times → **CLOSED** (fixed) or **REOPENED** (still broken).
If the same fault returns within 24 h of being resolved, the ticket reopens automatically.

## 7. Sending data (testing without hardware)

Topic: `classroom/<room_name>/sensors` or `classroom/<room_name>/vision`. The `<room_name>` must exactly match a classroom name in the app.

Run these in Git Bash, because PowerShell breaks the JSON quotes:

```bash
mosquitto_pub -t "classroom/R101/sensors" -m '{"voltage": 230, "current": 3, "fan_current": 1.2}'
mosquitto_pub -t "classroom/R101/sensors" -m '{"light_state": "ON"}'
mosquitto_pub -t "classroom/R101/vision"  -m '{"occupancy_count": 0}'
mosquitto_pub -t "classroom/R101/vision"  -m '{"device_id": 1, "fan_motion": {"running": false, "motion_score": 0, "confidence": 0.9}}'
```

A fault is confirmed when **4 of the last 5** readings are abnormal, so send a message about 5 times to trigger one.

## 8. Camera (Raspberry Pi, optional)

On the Pi, inside `backend/`, with the same `.env`:

```bash
pip install ultralytics opencv-python picamera2 paho-mqtt psycopg2-binary python-dotenv
python -m models.vision_runtime
```

- It asks for the classroom `room_id`.
- The classroom needs an active calibration (set it in the admin Calibration page).
- The Pi must be able to reach both PostgreSQL and the MQTT broker.

## Common problems

| Problem | Fix |
|---|---|
| `JWT_SECRET_KEY is not set` | Add it to `backend/.env`. |
| Login works, but pages show errors | Your token expired (60 min). Log out and log in again. |
| No faults ever appear | Check that Mosquitto is running and that the topic's room name matches exactly. |
| Frontend shows "Failed to fetch" | The backend isn't running on port 8000. |
