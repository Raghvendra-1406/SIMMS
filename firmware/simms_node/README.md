# SIMMS classroom node: ESP32 firmware + Wokwi simulation

The node meters the classroom **per circuit**, not per appliance. There's one meter for all the tube lights, one for all the fans, and optionally one for the main supply. The backend works out *how many* units are on from each circuit's current, and the camera shows *which* unit is faulty.

One firmware, two builds:

| PlatformIO env | Runs on | Inputs |
|---|---|---|
| `sim` (default) | Wokwi simulator in VS Code | Knobs, buttons and switches stand in for the PZEM-004T circuit meters **and the Raspberry Pi camera** ("virtual camera"). An OLED shows all 6 fans and 6 tubes. |
| `hw` | Real ESP32 DevKit V1 | 2–3 PZEM-004T v3 meters on one UART (LIGHTS, FANS, optional MAIN), DHT11, LDR module, 2-channel relay board (demo panel) |

New to the circuit? [COMPONENTS.md](COMPONENTS.md) explains every part, its pin, how it works and why it's there.

The node publishes the MQTT messages the backend expects (Plan v2 §14.2) and obeys circuit-relay commands from the dashboard's **Live monitor**. If you want to test without Wokwi, `backend/scripts/fake_node.py` sends identical messages from Python.

---

## 1. One-time setup

1. **Mosquitto** (MQTT broker). Install it from <https://mosquitto.org/download/> (Windows x64 installer), then start it:
   - as the "Mosquitto Broker" service in `services.msc`, or
   - in a terminal: `"C:\Program Files\mosquitto\mosquitto.exe" -v`.

   The default config listens on `localhost:1883` without a password, which is all the simulation needs.
2. **VS Code extensions:**
   - **Wokwi Simulator.** Then press `F1` → **Wokwi: Request a new License** and follow the browser steps (free).
   - **PlatformIO IDE.** Only needed to rebuild after code or config changes. The first build downloads the ESP32 toolchain, about 500 MB.
3. **Backend and database:** follow `startup.md`, then create the demo room and devices:

   ```powershell
   cd backend
   python -m scripts.seed_demo        # R101: Fan 1-6, Tube 1-6, "ESP32 Node", "Camera"
   ```

   The names must match `src/config.h`: `ROOM_NAME`, plus `FAN_NAME_PREFIX` / `TUBE_NAME_PREFIX` followed by the unit number.

## 2. Run the simulation

1. Start, in this order: **Mosquitto**, then the backend (`uvicorn main:app --reload`), then the frontend (`npm run dev`).
2. In VS Code: **File → Open Folder… → `firmware/simms_node`**.
3. Build the firmware: PlatformIO sidebar → **sim → Build**, or run `pio run -e sim`.
4. Open `diagram.json` (or press `F1` → **Wokwi: Start Simulator**). Press ▶.
5. The serial monitor should show:

   ```
   SIMMS node esp32-R101 (fw 2.0.0, SIMULATION)
   [wifi] connecting to Wokwi-GUEST... connected
   [mqtt] connecting to host.wokwi.internal:1883 ... connected
   [sensor] V=230.0 lights=0.62A fans=1.82A main=2.84A T=27.5 H=55.0
   [camera] people=20 fans 6/6 on (blocked 0) tubes 6/6 on (failed 0)
   ```

   The **green LED** stays on while the node is connected. The **OLED** shows one box per fan and per tube.
6. Log in as supervisor or admin and open **Live monitor**. R101 shows:
   - `esp32-R101` and `vcam-R101` as **ONLINE**;
   - the circuit readings;
   - 6 fan tiles and 6 tube tiles.

   It refreshes every 3 s.

After changing the code, build again and restart the simulator. Wokwi loads `.pio/build/sim/firmware.bin`.

### If the node can't reach the broker (`failed (state -2)`)

`host.wokwi.internal` reaches your PC through Wokwi's private gateway, which is built into the VS Code extension. If it doesn't work with your licence, use a public broker instead:

1. In `src/config.h`, set `MQTT_HOST` to `"broker.hivemq.com"` and `TOPIC_PREFIX` to something unique, e.g. `"simms-yourname"`.
2. In `backend/.env`, set `MQTT_BROKER_HOST=broker.hivemq.com` and the same `MQTT_TOPIC_PREFIX`.
3. Rebuild the firmware and restart the backend.

Anyone can read public-broker topics, so use this for dry runs only.

---

## 3. What each part does

The full explanation is in [COMPONENTS.md](COMPONENTS.md).

| Part | Pin | Meaning | Start value |
|---|---|---|---|
| Knob 1 (top) | 34 | **Supply voltage**, 180–260 V. Below 200 V or above 250 V is a fault. | ≈230 V |
| Knob 2 | 35 | **Fans switched on**, 0–6 (Fan 1…N) | 6 |
| Knob 3 | VN (39) | **Tube lights switched on**, 0–6 (Tube 1…N) | 6 |
| Knob 4 | 32 | *Virtual camera:* **people in the room**, 0–40 | 20 |
| Knob 5 (bottom) | 33 | *Virtual camera:* **board ink**, 0–60 % (DIRTY above 25 %, i.e. past about 42 % of the knob's travel) | 2 % |
| DHT22 | 15 | Temperature and humidity (click to change) | 27.5 °C / 55 % |
| Photoresistor | VP (36) | Room light level (click to set lux) | 300 lux |
| OLED | SDA 21 / SCL 22 | Room overview. A filled box is working, an empty box is off, a crossed box is faulty. | — |
| Yellow LED | 26 | **Lights-circuit relay** (demo panel) | on |
| Blue LED | 27 | **Fans-circuit relay** (demo panel) | on |
| Green LED | 4 | Connected to the MQTT broker | — |
| Blue button (key **F**) | 18 | **Blocked fan**: each press picks the next fan (none → 1 → … → 6 → none) | none |
| Yellow button (key **T**) | 19 | **Failed tube**: each press picks the next tube | none |
| Switch 1 | 13 | **Fans-circuit overload** (+25 A) | left = off |
| Switch 2 | 14 | *Virtual camera:* **person at the board** (board frame skipped) | left = off |
| Switch 3 | 23 | *Virtual camera:* **camera offline** (all vision messages stop) | left = off |

Slide a switch **to the right** to turn it on. Keyboard shortcuts work when the simulator canvas has focus.

**Dashboard ↔ simulation sync:**
- The Live monitor's **Turn lights/fans on/off** buttons switch the circuit relays (the yellow and blue LEDs). With a relay off, every unit on that circuit is off.
- Every knob, button and switch change reaches the dashboard within about 13 s: up to 10 s until the next reading, plus the 3 s refresh.

---

## 4. Scenario playbook (Plan v2 §16)

**Timing:**
- Readings go out every 10 s, and a fault needs **4 of the last 5** abnormal readings, so it confirms about 40–50 s after you cause it.
- With the simulation `.env` values (`VACANCY_MINUTES=1`, `COOLDOWN_MINUTES=2`), "empty room" means 1 minute, and the cooldown after closing a ticket is 2 minutes.

| # | Do this | Expect on the dashboard |
|---|---|---|
| T1 | Knob 4 → 0 people, lights/fans on | After ~1 min empty + ~50 s: **Energy wastage** ticket (MEDIUM), e.g. "Room empty for 1.3 min with 6/6 lights and 6/6 fans on (495 W)" |
| T2 | Switch 1 on (fans overload) | ~50 s: **Electrical abnormality** (HIGH), "fans circuit overcurrent …". The per-fan check pauses. |
| T2b | Press **F** until the OLED crosses Fan 3 (all 6 fans on) | ~50 s: **Fan failure: Fan 3** (HIGH), "6 fans powered, 5 rotating: Fan 3 powered but not rotating" |
| T4 | Press **T** to fail Tube 4 (all tubes on) | ~50 s: **Light failure: Tube 4** (MEDIUM) |
| — | Knob 2 → 5 fans (Fan 6 off) | **No ticket.** A switched-off fan is normal. |
| — | Knob 2 → 5 fans **and** Fan 3 blocked | Room-level **Fan failure: "1 of Fan 3, Fan 6"**. Whether Fan 6 is switched off or broken can't be told apart, so both are named. |
| T3 | Knob 4 → 0, knob 5 past ~42 % | After ~1 min empty + ~50 s: **Board needs cleaning** (LOW) |
| T3 (lecture) | Knob 5 high but people > 0 | **No ticket.** A written board during a lecture is normal. |
| T5 | Block a fan for one reading (~10 s), then clear it | **No ticket.** One abnormal reading never confirms. |
| T6 | Keep a fan blocked for several minutes | Exactly **one** ticket |
| T7 | After a ticket appears, clear the fault before anyone acts | ~30 s: ticket **Auto-resolved** |
| T8 | Re-create the same fault within 2 min of its ticket closing | **No new ticket** (cooldown). A new one appears after the cooldown if the fault persists. |
| T9 | Maintenance marks the ticket **Resolved** while the fault is still present; supervisor verifies | Verification fails and the ticket is **Reopened** |
| T10 | Clear the fault, then Resolved → supervisor verifies | Ticket **Closed**, with the full history on the ticket page |
| T11 | Switch 2 on (person at board) | Board shows **Occluded**. The reading is skipped and never raises a ticket. |
| T12 | Stop Mosquitto (or turn the Wi-Fi hotspot off) for a few minutes, then start it again | The serial monitor shows readings being buffered, then `[buffer] replay complete`. The dashboard history fills the gap with readings at their real times. Replayed readings never raise or clear a ticket. |
| T13 | Stop the simulation (■) | `esp32-R101` **OFFLINE** within ~25 s (last will), 90 s at most. After 5 min offline: a **Device offline** ticket (Medium, routed to General staff), auto-resolved when the node comes back |
| T14 | Lights on, people > 0 | **No event** |
| T17 | Switch 3 on (camera offline) | `vcam-R101` **OFFLINE**. Fan/tube tiles show *No camera*, and the per-unit checks pause instead of guessing. After 5 min: a **Device offline** ticket for the camera. |

**Other behaviour:**
- Health scores update every 60 s.
- Supervisors get an in-app notification for every new, reopened, auto-resolved or escalated ticket.
- The fault's summary ("what was detected") appears on the Live monitor and the fault details page.

**Not implemented yet:**
- T15/T16: the offline app queue and Web Push (Telegram was dropped).
- A tube or fan that fails *without drawing current* (burnt-out tube, open motor winding) looks the same as "switched off" to a circuit meter, so it can't be detected without per-unit switch sensing.

---

## 5. Using the real camera code instead of the virtual camera

1. Slide **switch 3 (camera offline)** on, or set `VIRTUAL_CAMERA 0` in `src/config.h`.
2. In the admin **Calibration** page, draw a box around each fan and each tube light (plus the board and seats).
3. Run the vision runtime, with the laptop standing in for the Raspberry Pi (see `startup.md` §9):

```powershell
cd backend
python -m models.vision_runtime --room-name R101 --source 0 --interval 30 --show
```

The ESP32 simulation keeps providing the circuit readings. The camera provides occupancy, the board state, each fan's rotation and each tube's brightness.

---

## 6. Moving to real hardware (`env:hw`)

1. In `src/config.h`, set `WIFI_SSID`, `WIFI_PASSWORD` and `MQTT_HOST` (your PC's LAN IP). Set `HAS_MAIN_METER 0` if there's no meter on the main supply.
2. Let Mosquitto accept LAN clients by adding to `mosquitto.conf`:

   ```
   listener 1883 0.0.0.0
   allow_anonymous true
   ```

3. **Give each PZEM-004T its own Modbus address, once, one meter connected at a time.** Use the library's `setAddress()` example: 0x01 = lights, 0x02 = fans, 0x03 = main.
4. Wire it up. **All mains wiring stays on the enclosed, fused demo panel** under a qualified supervisor (Plan v2 §11.3).

   | Part | ESP32 pin |
   |---|---|
   | PZEM-004T meters (all three share the bus) TX / RX | GPIO16 (RX2) / GPIO17 (TX2), 5 V supply |
   | PZEM CT coils | One around the lights circuit's live wire, one around the fans circuit's, one around the main supply's |
   | DHT11 | GPIO15 (10 kΩ pull-up) |
   | LDR module DO (or AO) | GPIO34 (D34) |
   | Relay IN1 (lights) / IN2 (fans) | GPIO26 / GPIO27 (active-low boards: `RELAY_ACTIVE_LOW 1`) |
   | SSD1306 OLED (optional) | SDA GPIO21, SCL GPIO22 |

5. Build and flash: `pio run -e hw -t upload`. Watch the output with `pio device monitor`.
6. **Commission it:** in **Admin → Classrooms → R101 → Circuits**, set standby with everything off, then switch on a known number of fans or tubes and press *Learn per-unit current*.

The `hw` build is compile-checked but has not been tested on real hardware yet.
