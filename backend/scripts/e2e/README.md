# End-to-end test

Runs the **whole system** as it runs for real (database, MQTT broker, backend, optionally the dashboard in a browser) and drives it with a simulated ESP32 node and camera, then checks every outcome. Use it before a demo, after a big change, or before merging to `main`.

It is fully isolated from your own setup:

| Part | Test instance | Your setup (untouched) |
|---|---|---|
| Database | throwaway PostgreSQL (`pgserver`), deleted afterwards | Neon / your `DATABASE_URL` |
| MQTT broker | Mosquitto on port **1884** | your broker on 1883 |
| Backend | port **8001**, short timings | port 8000 |
| Dashboard (`--ui`) | Vite dev server on port **5174** | port 5173 |

`backend/.env` is never read.

## Run

```powershell
cd backend
.venv\Scripts\activate
pip install -r requirements-dev.txt        # pytest + pgserver (once)

python scripts/e2e/run.py                  # backend scenarios, ~3.5 min
python scripts/e2e/run.py --ui             # + browser pass, ~5 min
python scripts/e2e/run.py --ui --keep      # leave everything running to click around
python scripts/e2e/stop.py                 # stop a kept stack
```

Needs Mosquitto installed (found automatically, or set `MOSQUITTO_BIN`). `--ui` also needs `pip install playwright`, `npm install` done in `frontend/`, and Chrome (or `python -m playwright install chromium`).

The exit code is 0 only when every check passes. Logs, the database and screenshots go to `scripts/e2e/.run/` (git-ignored).

With `--keep`, log in at <http://127.0.0.1:5174> as `supervisor@simms-e2e.example.com` / `password123` (also `admin@…`, `electrician@…`, `housekeeping@…`).

## What it checks

Timings are shortened (empty-room grace 6 s, cooldown 30 s, High response deadline ~14 s, device offline after 18 s) so the scenarios finish in minutes.

| Plan §16 | Scenario | Expected |
|---|---|---|
| — | Log in as each role; wrong password | Logged in; rejected |
| T14 | Normal room, lights on, people present | Node and camera online, live readings, no tickets |
| T5 | One bad voltage reading | Nothing raised |
| T2, T6 | Supply voltage out of range | One HIGH ticket routed to the electrician, notifications sent, still one ticket while it persists |
| T7 | Fault clears before anyone acts | AUTO_RESOLVED |
| T8 | Same fault again within the cooldown | Suppressed; a new ticket after the cooldown |
| C7 | Nobody starts the HIGH ticket | Missed deadline escalated, supervisor notified, shown OVERDUE |
| C7 | Other staff try to start it; assignee starts, resolves, tries to close | 403; started (late); resolved; closing refused |
| T9 | Supervisor verifies with the fault still present | REOPENED, response deadline restarted |
| T10 | Repaired, verified | CLOSED, full history recorded |
| T2b | Fan powered but not rotating | FAN_FAILURE pinpointed to that fan; live monitor shows it failed |
| T4 | Tube powered but dark | LIGHT_FAILURE pinpointed to that tube |
| T1 | Lights and fans on in an empty room | ENERGY_WASTAGE after the grace period, routed to the electrician |
| — | Dashboard relay command | Node switches the circuit; staff are refused |
| T11 | Person in front of the board | No board ticket |
| T3 | Dirty board in an empty room | LOW ticket routed to housekeeping, only on their list |
| T12 | Reading replayed after a network loss | Stored at its real time, raises nothing |
| T17 | Camera goes offline | Shown offline; Device offline ticket; auto-resolved when it is back |
| T13 | ESP32 vanishes | Offline via MQTT last will; Device offline ticket |
| §16.2 | Statistics, false-alarm review, energy, health | Counts match, review counted, confirmation delay measured, waste recorded, health breakdown present |
| — | Backend log | No errors or tracebacks |

`--ui` then opens every page for admin, supervisor and maintenance staff in headless Chrome (plus a phone-width pass). It fails on uncaught exceptions, console errors, failed API calls or missing key content, and exercises Start work, the false-alarm review, the Team field, dark mode and access control.

Not covered here: the real ESP32 / camera hardware, Web Push delivery to a phone (covered by `tests/test_push.py` against a fake push service) and the unit-level edge cases in `backend/tests`.
