"""
SIMMS end-to-end test: the whole system running, Plan v2 §16 scenarios.

Starts real processes, isolated from your own setup:
  - a throwaway PostgreSQL (pgserver) with schema.sql
  - Mosquitto on port 1884 (your broker on 1883 is not touched)
  - the backend (uvicorn) on port 8001, with short timings
A simulated ESP32 node + camera (scripts/fake_node.FakeNode: the same
MQTT messages as the firmware) drives the scenarios; results are checked
through the REST API (and the database where the API does not expose a
detail). backend/.env is never read.

    cd backend
    python scripts/e2e/run.py            # backend scenarios (~3.5 min)
    python scripts/e2e/run.py --ui       # + browser pass (Playwright)
    python scripts/e2e/run.py --keep     # leave the stack running
    python scripts/e2e/stop.py           # stop a kept stack

See scripts/e2e/README.md.
"""

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import traceback
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parents[1]
FRONTEND = BACKEND.parent / "frontend"
PYTHON = Path(sys.executable)

# Runtime files (database, logs, screenshots, pids): git-ignored.
RUN = HERE / ".run"
RUN.mkdir(exist_ok=True)


def find_mosquitto():
    candidates = [
        os.environ.get("MOSQUITTO_BIN"),
        shutil.which("mosquitto"),
        r"C:\Program Files\mosquitto\mosquitto.exe",
        "/usr/sbin/mosquitto",
        "/opt/homebrew/sbin/mosquitto",
        "/usr/local/sbin/mosquitto",
    ]

    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate

    raise SystemExit("Mosquitto not found: install it or set MOSQUITTO_BIN.")

API_PORT = 8001
MQTT_PORT = 1884
API = f"http://127.0.0.1:{API_PORT}"
PACE = 0.7          # seconds between simulated reading cycles

TEST_ENV = {
    "JWT_SECRET_KEY": "e2e-only-secret",
    "MQTT_BROKER_HOST": "127.0.0.1",
    "MQTT_BROKER_PORT": str(MQTT_PORT),
    "MQTT_TOPIC_PREFIX": "",
    "MQTT_CLIENT_ID": "simms-backend-e2e",
    "VACANCY_MINUTES": "0.1",               # 6 s instead of 10 min
    "COOLDOWN_MINUTES": "0.5",              # 30 s instead of 30 min
    "NODE_OFFLINE_SECONDS": "20",
    "HEALTH_INTERVAL_SECONDS": "15",
    "DEVICE_OFFLINE_FAULT_MINUTES": "0.3",  # 18 s instead of 5 min
    "SLA_HOURS_HIGH": "0.004",              # ~14 s instead of 2 h
    "SLA_HOURS_MEDIUM": "0.05",
    "SLA_HOURS_LOW": "0.1",
    "SLA_CHECK_INTERVAL_SECONDS": "15",
    "CORS_ORIGINS": "http://localhost:5174,http://127.0.0.1:5174",
    "VAPID_PUBLIC_KEY": "",
    "VAPID_PRIVATE_KEY": "",
    "E2E_PORT": str(API_PORT),
}

UI_PORT = 5174

results = []
procs = []


def log(msg):
    print(msg, flush=True)


def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))
    log(f"  {'PASS' if condition else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not condition else ""))
    return bool(condition)


def wait_for(fn, timeout, every=1.0):
    deadline = time.time() + timeout
    value = None
    while time.time() < deadline:
        try:
            value = fn()
            if value:
                return value
        except Exception:
            pass
        time.sleep(every)
    return value


# ---------------------------------------------------------------- stack

KEEP = "--keep" in sys.argv


def start_database():
    import pgserver

    data = RUN / "pgdata"
    if data.exists():
        subprocess.run([str(PYTHON), "-c", f"import pgserver; pgserver.get_server(r'{data}', cleanup_mode='stop').cleanup()"],
                       capture_output=True, timeout=60)
        shutil.rmtree(data, ignore_errors=True)

    # --keep: the database must outlive this script (stop.py stops it).
    server = pgserver.get_server(str(data), cleanup_mode=None if KEEP else "stop")
    url = server.get_uri()

    import psycopg2
    conn = psycopg2.connect(url)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
        cur.execute((BACKEND / "database" / "schema.sql").read_text(encoding="utf-8"))
    conn.close()
    return server, url


def port_open(port):
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def start_stack():
    server, url = start_database()
    (RUN / "db_url.txt").write_text(url)

    os.environ.update(TEST_ENV)
    os.environ["DATABASE_URL"] = url

    # Harness process imports backend modules (seed, FakeNode, DB checks).
    import dotenv
    dotenv.load_dotenv = lambda *a, **k: False
    sys.path.insert(0, str(BACKEND))
    os.chdir(BACKEND)

    if port_open(MQTT_PORT) or port_open(API_PORT):
        raise SystemExit(f"Port {MQTT_PORT} or {API_PORT} already in use: "
                         f"stop the old run first (python scripts/e2e/stop.py).")

    procs.append(subprocess.Popen([find_mosquitto(), "-p", str(MQTT_PORT)],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))

    backend_log = open(RUN / "backend.log", "w", encoding="utf-8")
    procs.append(subprocess.Popen([str(PYTHON), str(HERE / "launch_backend.py")],
                                  env=os.environ.copy(), stdout=backend_log, stderr=subprocess.STDOUT))

    if not wait_for(lambda: port_open(API_PORT), 60):
        raise SystemExit(f"Backend did not start; see {RUN / 'backend.log'}")

    return server


def seed():
    from database.repositories.room_repository import create_room
    from database.repositories.ticket_routing_repository import set_user_team
    from services.auth_service import register_user
    from services.device_service import add_standard_devices

    users = {}
    for key, name, email, role, team in [
        ("admin", "Admin", "admin@simms-e2e.example.com", "ADMIN", None),
        ("supervisor", "Supervisor", "supervisor@simms-e2e.example.com", "SUPERVISOR", None),
        ("electrician", "Ravi (Electrical)", "electrician@simms-e2e.example.com", "MAINTENANCE_STAFF", "ELECTRICAL"),
        ("housekeeper", "Meena (Housekeeping)", "housekeeping@simms-e2e.example.com", "MAINTENANCE_STAFF", "HOUSEKEEPING"),
    ]:
        row = register_user(name=name, email=email, password="password123", role=role)
        if team:
            set_user_team(row[0], team)
        users[key] = {"user_id": row[0], "email": email}

    room = create_room(room_name="R101", room_type="CLASSROOM", building="Main Block", floor=3, capacity=40)
    add_standard_devices(room[0], fan_count=6, light_count=6, include_nodes=True)
    return users, room[0]


# ---------------------------------------------------------------- API / DB

TOKENS = {}


def call(method, path, who=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if who:
        req.add_header("Authorization", "Bearer " + TOKENS[who])
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            return err.code, json.loads(raw)
        except ValueError:
            return err.code, raw.decode(errors="replace")


def q(sql, params=()):
    from database.connection import get_connection
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(sql, params)
        rows = cur.fetchall() if cur.description else cur.rowcount
        conn.commit()
        return rows
    finally:
        cur.close()
        conn.close()


TICKETS_SQL = """
select t.ticket_id, t.status, t.priority, f.fault_type, d.device_name, u.name,
       t.category, t.escalated_at, t.started_at, t.recurrence_count
from tickets t join fault_events f using (fault_id)
left join devices d on d.device_id = f.device_id
left join users u on u.user_id = t.assigned_to
order by t.ticket_id
"""


def tickets(fault_type=None):
    rows = [dict(zip(["id", "status", "priority", "fault", "device", "assignee", "category",
                      "escalated_at", "started_at", "recurrences"], r)) for r in q(TICKETS_SQL)]
    return [r for r in rows if fault_type is None or r["fault"] == fault_type]


def live_body():
    status, body = call("GET", "/live/rooms", "supervisor")
    return body if status == 200 else None


def live_room():
    body = live_body()
    return body["rooms"][0] if body and body.get("rooms") else None


def node_state(node_id):
    room = live_room()
    for node in (room or {}).get("nodes") or []:
        if node["node_id"] == node_id:
            return node["state"]
    return None


# ---------------------------------------------------------------- simulated node

class Sim:
    def __init__(self):
        from scripts.fake_node import FakeNode
        self.args = SimpleNamespace(
            room="R101", interval=PACE, cycles=0, fans_on=6, lights_on=6, blocked_fan=0,
            failed_tube=0, fans_overload=False, voltage=230.0, temperature=27.5, humidity=55.0,
            people=20, board_ink=0.02, person_at_board=False, no_camera=False, clean_exit=False)
        self.node = FakeNode(self.args)
        self.node.client.connect("127.0.0.1", MQTT_PORT, keepalive=15)
        self.node.client.loop_start()
        time.sleep(1)
        self.count = 0

    def normal(self):
        self.set(fans_on=6, lights_on=6, blocked_fan=0, failed_tube=0, fans_overload=False,
                 voltage=230.0, people=20, board_ink=0.02, person_at_board=False, no_camera=False)

    def set(self, **changes):
        for key, value in changes.items():
            setattr(self.args, key, value)

    def cycles(self, n, **changes):
        self.set(**changes)
        for _ in range(n):
            self.count += 1
            self.node.publish_sensors()
            self.node.publish_vision()
            if self.count % 5 == 0:
                self.node.publish_status()
            time.sleep(PACE)

    def drop_connection(self):
        """Vanish without DISCONNECT: the broker publishes the last will."""
        self.node.client.loop_stop()
        sock = self.node.client.socket()
        if sock:
            sock.close()


def cycle_until(sim, n_max, predicate, **changes):
    sim.set(**changes)
    for _ in range(n_max):
        sim.cycles(1)
        if predicate():
            return True
    return predicate()


# ---------------------------------------------------------------- scenarios

def run(users, room_id):
    global TOKENS

    log("\n== Login")
    for who, info in users.items():
        status, body = call("POST", "/auth/login", body={"email": info["email"], "password": "password123"})
        check(f"login {who}", status == 200, status)
        TOKENS[who] = body["access_token"]
    status, _ = call("POST", "/auth/login", body={"email": "supervisor@simms-e2e.example.com", "password": "nope-nope"})
    check("wrong password rejected", status == 401, status)

    sim = Sim()

    log("\n== T14 normal operation (lights on, room occupied)")
    sim.cycles(8)
    room = wait_for(live_room, 10)
    check("backend connected to MQTT", (live_body() or {}).get("mqtt_connected") is True)
    check("ESP32 node ONLINE", wait_for(lambda: node_state("esp32-R101") == "ONLINE", 15))
    check("camera ONLINE", wait_for(lambda: node_state("vcam-R101") == "ONLINE", 15))
    room = live_room()
    check("live readings: electrical + occupancy", room["sensors"] and "ELECTRICAL" in room["sensors"]
          and room["vision"] and "OCCUPANCY" in room["vision"])
    fans = room.get("circuits", {}).get("FANS", {})
    check("fans circuit counts 6 powered", fans.get("powered_units") == 6, fans)
    check("no tickets in normal operation", tickets() == [])

    log("\n== T5 one-reading blip")
    sim.cycles(1, voltage=262.0)
    sim.cycles(6, voltage=230.0)
    check("single bad reading raises nothing", tickets() == [])

    log("\n== T2 supply voltage fault -> T7 auto-resolve")
    ok = cycle_until(sim, 10, lambda: tickets("ELECTRICAL_ABNORMALITY"), voltage=262.0)
    rows = tickets("ELECTRICAL_ABNORMALITY")
    check("persistent overvoltage raises a ticket", ok)
    if rows:
        t = rows[0]
        check("HIGH priority, ELECTRICAL category", (t["priority"], t["category"]) == ("HIGH", "ELECTRICAL"), t)
        check("routed to the electrician", t["assignee"] == "Ravi (Electrical)", t["assignee"])
    sim.cycles(6, voltage=262.0)
    check("still exactly one ticket while it persists (T6)", len(tickets("ELECTRICAL_ABNORMALITY")) == 1)
    status, notes = call("GET", "/notifications", "electrician")
    check("electrician notified of assignment", status == 200 and any(n["notification_type"] == "TICKET_ASSIGNED" for n in notes))
    status, notes = call("GET", "/notifications", "supervisor")
    check("supervisor notified of new ticket", any(n["notification_type"] == "TICKET_CREATED" for n in notes))
    ok = cycle_until(sim, 8, lambda: tickets("ELECTRICAL_ABNORMALITY")[0]["status"] == "AUTO_RESOLVED", voltage=230.0)
    check("fault cleared before anyone acted -> AUTO_RESOLVED", ok, tickets("ELECTRICAL_ABNORMALITY"))
    closed_at = time.time()

    log("\n== T8 cooldown, then fans circuit overload")
    sim.cycles(8, fans_overload=True)
    check("same fault within cooldown raises no new ticket", len(tickets("ELECTRICAL_ABNORMALITY")) == 1)
    remaining = 30 - (time.time() - closed_at)
    ok = cycle_until(sim, int((remaining + 30) / PACE),
                     lambda: len(tickets("ELECTRICAL_ABNORMALITY")) == 2, fans_overload=True)
    check("after the cooldown the overload raises a new ticket", ok)
    ticket = tickets("ELECTRICAL_ABNORMALITY")[-1]

    log("\n== SLA breach and escalation (HIGH response ~14 s)")
    # Keep the node talking while waiting, or it really goes offline.
    esc = wait_for(lambda: (sim.cycles(1) or True) and tickets("ELECTRICAL_ABNORMALITY")[-1]["escalated_at"],
                   60, every=0.1)
    check("missed response deadline escalated by the scheduler", esc)
    status, notes = call("GET", "/notifications", "supervisor")
    check("supervisor told about the missed deadline", any(n["notification_type"] == "SLA_BREACHED" for n in notes))
    status, body = call("GET", f"/tickets/{ticket['id']}", "supervisor")
    check("ticket shows OVERDUE", body.get("sla_state") == "OVERDUE", body.get("sla_state"))

    log("\n== Maintenance: start work, resolve; T9 supervisor verification fails")
    status, body = call("POST", f"/tickets/{ticket['id']}/start", "housekeeper")
    check("other staff cannot start someone else's ticket", status == 403, status)
    status, body = call("POST", f"/tickets/{ticket['id']}/start", "electrician")
    check("assignee starts work (late)", status == 200 and body["sla_state"] == "LATE", body)
    status, body = call("PATCH", f"/tickets/{ticket['id']}/status", "electrician",
                        {"status": "RESOLVED", "maintenance_notes": "Replaced fan capacitor"})
    check("assignee marks it resolved", status == 200 and body["status"] == "RESOLVED", body)
    status, body = call("PATCH", f"/tickets/{ticket['id']}/status", "electrician", {"status": "CLOSED"})
    check("staff cannot close the ticket", status == 403, status)

    sim.cycles(1, fans_overload=True)          # fault still present
    result = None
    for _ in range(6):
        status, result = call("POST", f"/verification/ticket/{ticket['id']}", "supervisor")
        if status != 200 or result.get("status") not in {"VERIFICATION_IN_PROGRESS"}:
            break
    after = tickets("ELECTRICAL_ABNORMALITY")[-1]
    check("verification with the fault still present reopens it", after["status"] == "REOPENED",
          f"{status} {result if isinstance(result, str) else (result or {}).get('status')} -> {after['status']}")
    status, body = call("GET", f"/tickets/{ticket['id']}", "supervisor")
    check("reopen restarts the response deadline", body.get("started_at") is None, body.get("sla_state"))

    log("\n== T10 repair, verify, close")
    sim.cycles(4, fans_overload=False)
    call("POST", f"/tickets/{ticket['id']}/start", "electrician")
    call("PATCH", f"/tickets/{ticket['id']}/status", "electrician", {"status": "RESOLVED", "maintenance_notes": "Fixed for real"})
    sim.cycles(1)
    for _ in range(6):
        status, result = call("POST", f"/verification/ticket/{ticket['id']}", "supervisor")
        if status != 200 or result.get("status") not in {"VERIFICATION_IN_PROGRESS"}:
            break
    check("verification with the fault gone closes it", tickets("ELECTRICAL_ABNORMALITY")[-1]["status"] == "CLOSED",
          tickets("ELECTRICAL_ABNORMALITY")[-1]["status"])
    status, history = call("GET", f"/ticket-history/ticket/{ticket['id']}", "supervisor")
    if status != 200:
        history = q("select new_status from ticket_history where ticket_id=%s order by history_id", (ticket["id"],))
        history = [{"new_status": h[0]} for h in history]
    steps = [h["new_status"] for h in history]
    check("full history recorded", steps[:1] == ["OPEN"] and "REOPENED" in steps and steps[-1] == "CLOSED", steps)

    log("\n== T2b fan powered but not rotating")
    ok = cycle_until(sim, 12, lambda: tickets("FAN_FAILURE"), blocked_fan=3)
    t = (tickets("FAN_FAILURE") or [{}])[0]
    check("fan failure ticket", ok)
    check("pinpoints Fan 3, HIGH, electrician", (t.get("device"), t.get("priority"), t.get("assignee"))
          == ("Fan 3", "HIGH", "Ravi (Electrical)"), t)
    room = live_room()
    fan3 = next((f for f in room.get("fans", []) if f.get("device_name") == "Fan 3"), {})
    check("live monitor shows Fan 3 failed", fan3.get("failed") is True, {k: fan3.get(k) for k in ("state", "suspect", "failed")})
    ok = cycle_until(sim, 10, lambda: tickets("FAN_FAILURE")[0]["status"] == "AUTO_RESOLVED", blocked_fan=0)
    check("fan fixed before anyone acted -> auto-resolved", ok)

    log("\n== T4 tube powered but dark")
    ok = cycle_until(sim, 12, lambda: tickets("LIGHT_FAILURE"), failed_tube=4)
    t = (tickets("LIGHT_FAILURE") or [{}])[0]
    check("light failure pinpoints Tube 4, MEDIUM", ok and (t.get("device"), t.get("priority")) == ("Tube 4", "MEDIUM"), t)
    cycle_until(sim, 10, lambda: tickets("LIGHT_FAILURE")[0]["status"] == "AUTO_RESOLVED", failed_tube=0)

    log("\n== T1 energy wastage (empty room, lights and fans on)")
    ok = cycle_until(sim, 30, lambda: tickets("ENERGY_WASTAGE"), people=0)
    t = (tickets("ENERGY_WASTAGE") or [{}])[0]
    check("energy wastage ticket after the vacancy grace", ok)
    check("MEDIUM, ENERGY category, electrician", (t.get("priority"), t.get("category"), t.get("assignee"))
          == ("MEDIUM", "ENERGY", "Ravi (Electrical)"), t)
    sim.cycles(10, people=0)                    # more wasted energy for the report

    log("\n== Relay command from the dashboard (demo panel)")
    status, body = call("POST", f"/classrooms/{room_id}/commands", "supervisor", {"target": "LIGHTS", "state": "OFF"})
    check("command accepted", status in (200, 202), (status, body))
    check("node switched the lights circuit off", wait_for(lambda: sim.node.relays["lights"] is False, 5))
    ok = cycle_until(sim, 6, lambda: (live_room() or {}).get("circuits", {}).get("LIGHTS", {}).get("powered_units") == 0)
    check("live monitor: 0 tubes powered", ok, (live_room() or {}).get("circuits", {}).get("LIGHTS"))
    call("POST", f"/classrooms/{room_id}/commands", "supervisor", {"target": "LIGHTS", "state": "ON"})
    wait_for(lambda: sim.node.relays["lights"] is True, 5)
    status, _ = call("POST", f"/classrooms/{room_id}/commands", "electrician", {"target": "FANS", "state": "OFF"})
    check("maintenance staff cannot switch circuits", status == 403, status)
    cycle_until(sim, 10, lambda: tickets("ENERGY_WASTAGE")[0]["status"] == "AUTO_RESOLVED", people=20)

    log("\n== T11 person at the board (occluded) -> no board ticket")
    sim.cycles(14, people=0, board_ink=0.4, person_at_board=True, fans_on=0, lights_on=0)
    check("occluded board never raises a ticket", tickets("BOARD_NEEDS_CLEANING") == [])

    log("\n== T3 board left dirty in an empty room")
    ok = cycle_until(sim, 20, lambda: tickets("BOARD_NEEDS_CLEANING"), person_at_board=False)
    t = (tickets("BOARD_NEEDS_CLEANING") or [{}])[0]
    check("board cleaning ticket", ok)
    check("LOW, CLEANING, routed to housekeeping", (t.get("priority"), t.get("category"), t.get("assignee"))
          == ("LOW", "CLEANING", "Meena (Housekeeping)"), t)
    status, mine = call("GET", "/tickets/open?mine=true", "housekeeper")
    check("housekeeper's list has it, not the electrical ones",
          status == 200 and {x["ticket_id"] for x in mine} == {t.get("id")}, [x["ticket_id"] for x in mine] if status == 200 else status)
    sim.normal()
    cycle_until(sim, 10, lambda: tickets("BOARD_NEEDS_CLEANING")[0]["status"] == "AUTO_RESOLVED")

    log("\n== T12 buffered readings replayed after a network loss")
    from mqtt.topics import sensor_topic
    sim.node.publish(sensor_topic("R101"), {"node_id": "esp32-R101", "device_name": "ESP32 Node", "voltage": 262.0,
                     "circuits": {"FANS": {"current": 25.0, "power": 5000, "power_factor": 0.9, "energy": 1}},
                     "age_s": 400, "buffered": True})
    time.sleep(2)
    rows = q("select observed_at from sensor_observations where observed_at < now() - interval '5 minutes'")
    check("replayed reading stored at its real time (~400 s ago)", len(rows) == 1)
    before = len(tickets("ELECTRICAL_ABNORMALITY"))
    sim.cycles(3)
    check("replayed fault reading raised nothing", len(tickets("ELECTRICAL_ABNORMALITY")) == before)

    log("\n== T17 camera offline")
    from mqtt.topics import status_topic
    sim.set(no_camera=True)
    sim.node.publish(status_topic("R101", "vcam-R101"), {"state": "OFFLINE", "kind": "CAMERA"}, retain=True)
    sim.cycles(2)
    check("camera shown OFFLINE", wait_for(lambda: node_state("vcam-R101") == "OFFLINE", 10))
    camera_tickets = lambda: [t for t in tickets("DEVICE_OFFLINE") if t["device"] == "Camera"]  # noqa: E731
    ok = wait_for(lambda: (sim.cycles(1) or True) and camera_tickets(), 70, every=0.1)
    t = (camera_tickets() or [{}])[0]
    check("camera offline raises a Device offline ticket", ok)
    check("on the Camera, MEDIUM, INFRASTRUCTURE", (t.get("device"), t.get("priority"), t.get("category"))
          == ("Camera", "MEDIUM", "INFRASTRUCTURE"), t)
    sim.set(no_camera=False)
    sim.node.publish_status()
    ok = wait_for(lambda: (sim.cycles(1) or True) and camera_tickets()[0]["status"] == "AUTO_RESOLVED", 60, every=0.1)
    check("camera back -> auto-resolved", ok, camera_tickets())
    check("no false Device offline for the ESP32 while it was talking",
          not [t for t in tickets("DEVICE_OFFLINE") if t["device"] == "ESP32 Node"], tickets("DEVICE_OFFLINE"))

    log("\n== T13 ESP32 vanishes (last will)")
    sim.drop_connection()
    check("node OFFLINE via last will", wait_for(lambda: node_state("esp32-R101") == "OFFLINE", 40))
    ok = wait_for(lambda: [t for t in tickets("DEVICE_OFFLINE") if t["device"] == "ESP32 Node"], 70, every=2)
    check("node offline raises a Device offline ticket", ok)

    log("\n== Statistics, energy, health")
    status, overview = call("GET", "/stats/overview?days=1&tz_offset_minutes=-330", "supervisor")
    check("statistics overview", status == 200 and overview["summary"]["tickets"] == len(tickets()),
          (status, overview.get("summary", {}).get("tickets") if status == 200 else overview, len(tickets())))
    first = tickets()[0]["id"]
    status, _ = call("PUT", f"/stats/tickets/{first}/review", "supervisor", {"verdict": "FALSE_ALARM"})
    status2, overview = call("GET", "/stats/overview?days=1", "supervisor")
    check("false-alarm review counted", status == 200 and overview["summary"]["false_alarms"] == 1)
    check("confirmation delay measured (> 0 s)", (overview["latency"]["confirmation"]["median"] or 0) > 0,
          overview["latency"]["confirmation"])
    status, energy = call("GET", "/stats/energy?days=1", "supervisor")
    check("energy report: waste recorded in the empty room", status == 200 and energy["totals"]["wasted_kwh"] > 0,
          energy.get("totals") if status == 200 else energy)
    status, health = call("GET", "/health/classrooms", "supervisor")
    check("health score with CIHS breakdown", status == 200 and health and health[0].get("components"),
          health if status != 200 else health[0].get("health_status"))
    status, _ = call("GET", "/stats/overview", "electrician")
    check("statistics hidden from maintenance staff", status == 403, status)

    log("\n== Backend log")
    text = (RUN / "backend.log").read_text(encoding="utf-8", errors="replace")
    errors = [line for line in text.splitlines() if "Traceback" in line or "ERROR" in line or "failed:" in line]
    check("no tracebacks / errors in the backend log", not errors, errors[:5])


def kill_tree(proc):
    """Stop a process and its children (npx -> node -> esbuild ...)."""
    if proc.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
    else:
        proc.terminate()


def start_frontend():
    if not (FRONTEND / "node_modules").exists():
        raise SystemExit("frontend/node_modules missing: run `npm install` in frontend/ first.")

    env = os.environ.copy()
    env["VITE_API_BASE_URL"] = API
    npx = "npx.cmd" if os.name == "nt" else "npx"
    log_file = open(RUN / "vite.log", "w", encoding="utf-8")
    proc = subprocess.Popen([npx, "vite", "--port", str(UI_PORT), "--strictPort", "--host", "127.0.0.1"],
                            cwd=FRONTEND, env=env, stdout=log_file, stderr=subprocess.STDOUT)
    procs.append(proc)

    if not wait_for(lambda: port_open(UI_PORT), 60):
        raise SystemExit(f"Frontend dev server did not start; see {RUN / 'vite.log'}")


def run_ui():
    """Browser pass: a live node keeps Fan 2 blocked while pages are checked."""
    import threading

    sys.path.insert(0, str(HERE))

    try:
        import ui
    except ImportError as exc:
        check("browser pass (Playwright installed)", False,
              f"{exc}: pip install playwright (uses your installed Chrome)")
        return

    log("\n== Browser pass (headless Chrome)")
    start_frontend()

    sim = Sim()
    sim.normal()
    sim.set(blocked_fan=2)
    stop = threading.Event()

    def feed():
        while not stop.is_set():
            sim.cycles(1)
            stop.wait(2)

    feeder = threading.Thread(target=feed, daemon=True)
    feeder.start()

    try:
        ui.run(check, ui_url=f"http://127.0.0.1:{UI_PORT}", api_url=API, shots=RUN / "shots")
    finally:
        stop.set()
        feeder.join(timeout=10)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ui", action="store_true", help="also run the browser pass (needs Playwright)")
    parser.add_argument("--keep", action="store_true", help="leave the stack running afterwards")
    args = parser.parse_args()

    server = start_stack()
    started = time.time()
    try:
        users, room_id = seed()
        run(users, room_id)
        if args.ui:
            run_ui()
    except Exception:
        traceback.print_exc()
        check("harness ran to completion", False)
    finally:
        passed = sum(1 for _, ok, _ in results if ok)
        log(f"\n{passed}/{len(results)} checks passed in {time.time() - started:.0f} s")
        for name, ok, detail in results:
            if not ok:
                log(f"FAIL: {name}  {detail}")

        if args.keep:
            (RUN / "pids.txt").write_text("\n".join(str(p.pid) for p in procs))
            log(f"\nStack left running: API {API}, MQTT 127.0.0.1:{MQTT_PORT}"
                + (f", dashboard http://127.0.0.1:{UI_PORT}" if args.ui else "")
                + ". Log in as supervisor@simms-e2e.example.com / password123."
                + "\nStop it with: python scripts/e2e/stop.py")
        else:
            for proc in reversed(procs):
                kill_tree(proc)
            server.cleanup()

    sys.exit(0 if results and all(ok for _, ok, _ in results) else 1)


if __name__ == "__main__":
    main()
