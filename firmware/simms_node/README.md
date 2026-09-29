# SIMMS classroom node: ESP32 firmware + Wokwi simulation

One firmware, two builds:

| PlatformIO env | Runs on | Inputs |
|---|---|---|
| `sim` (default) | Wokwi simulator in VS Code | Knobs and switches stand in for the PZEM-004T, the CT clamp **and the Raspberry Pi camera** ("virtual camera") |
| `hw` | Real ESP32 DevKit V1 | PZEM-004T v3 (UART2), SCT-013-030 clamp, DHT11, LDR module, 2-channel relay board |

The node publishes the MQTT messages the backend expects (Plan v2 §14.2) and obeys relay commands from the dashboard's **Live monitor** page. `backend/scripts/fake_node.py` sends identical messages from Python, if you want to test without Wokwi.

---

## 1. One-time setup

1. **Mosquitto** (MQTT broker). Install it from <https://mosquitto.org/download/> (Windows x64 installer). Then start it, either:
   - as the "Mosquitto Broker" service in `services.msc`, or
   - in a terminal: `"C:\Program Files\mosquitto\mosquitto.exe" -v`.

   The default config listens on `localhost:1883` without a password, which is all the simulation needs.
2. **VS Code extensions:**
   - **Wokwi Simulator.** Then press `F1` → **Wokwi: Request a new License** and follow the browser steps (free).
   - **PlatformIO IDE.** The first build downloads the ESP32 toolchain, about 500 MB.
3. **Backend and database:** follow `startup.md`, then create the demo room and devices:

   ```powershell
   cd backend
   python -m scripts.seed_demo        # room R101 + "Fan 1", "ESP32 Node", "Camera"
   ```

   The names must match `src/config.h` exactly: `ROOM_NAME`, `FAN_DEVICE_NAME`, and so on.

## 2. Run the simulation

1. Start, in this order: **Mosquitto**, then the backend (`uvicorn main:app --reload`), then the frontend (`npm run dev`).
2. In VS Code: **File → Open Folder… → `firmware/simms_node`**.
3. PlatformIO sidebar → **sim → Build**, or run `pio run -e sim`.
4. Open `diagram.json` (or press `F1` → **Wokwi: Start Simulator**). Press ▶.
5. The serial monitor should show:

   ```
   SIMMS node esp32-R101 (fw 1.0.0, SIMULATION)
   [wifi] connecting to Wokwi-GUEST... connected
   [mqtt] connecting to host.wokwi.internal:1883 ... connected
   [sensor] V=230.0 I=0.570 fan=0.350 ...
   [camera] people=20 fan=rotating board=CLEAN ink=0.02
   ```

   The **green LED** stays on while the node is connected to the broker.
6. Log in as supervisor or admin and open **Live monitor**. R101 shows `esp32-R101` and `vcam-R101` as **ONLINE**, and the readings refresh every 3 s.

After changing the code, build again and restart the simulator. Wokwi loads `.pio/build/sim/firmware.bin`.

### If the node can't reach the broker (`failed (state -2)`)

`host.wokwi.internal` reaches your PC through Wokwi's private gateway, which is built into the VS Code extension. If it doesn't work with your licence, use a public broker instead:

1. Set `MQTT_HOST` to `"broker.hivemq.com"` and `TOPIC_PREFIX` to something unique, e.g. `"simms-yourname"`, in `src/config.h`.
2. Set `MQTT_BROKER_HOST=broker.hivemq.com` and the same `MQTT_TOPIC_PREFIX` in `backend/.env`.
3. Rebuild the firmware and restart the backend.

Anyone can read public-broker topics, so use this for dry runs only.

---

## 3. What each part does

| Part | Pin | Meaning | Start value |
|---|---|---|---|
| Knob 1 (top left) | 34 | **Mains voltage**, 180–260 V. Below 200 V or above 250 V is an electrical fault. | ≈230 V |
| Knob 2 | 35 | **Fan load**. Up to ¾ turn = normal 0.25–0.45 A. The last quarter ramps to 25 A (**overcurrent**). | 0.35 A |
| Knob 3 | 32 | *Virtual camera:* **people in the room**, 0–40 | 20 |
| Knob 4 (bottom left) | 33 | *Virtual camera:* **board ink**, 0–60 %. CLEAN below 5 %, IN_USE 5–25 %, DIRTY above 25 %. | 2 % |
| DHT22 | 15 | Temperature and humidity. Click it to change the values. | 27.5 °C / 55 % |
| Photoresistor | VP (36) | Room light level (click to set lux) | 300 lux |
| Yellow LED | 26 | **Lamp relay** output | on |
| Blue LED | 27 | **Fan relay** output | on |
| Green LED | 4 | Connected to the MQTT broker | — |
| Yellow button (key **L**) | 18 | Lamp wall switch (toggle) | — |
| Blue button (key **F**) | 19 | Fan wall switch (toggle) | — |
| Switch 1 | 13 | *Virtual camera:* **fan blade blocked** (powered but not rotating) | left = off |
| Switch 2 | 14 | *Virtual camera:* **person standing at the board** (board frame skipped) | left = off |
| Switch 3 | 23 | *Virtual camera:* **camera offline** (stops all vision messages) | left = off |

Slide a switch **to the right** to turn it on.

Keyboard shortcuts work when the simulator canvas has focus.

Knob 4 at about 42 % of its travel crosses the 25 % ink threshold, so anything past that reads as DIRTY.

**Dashboard ↔ simulation sync.**
- The Lamp and Fan buttons on the Live monitor switch the LEDs in Wokwi.
- The wall-switch buttons in Wokwi update the dashboard within about 3 s.
- The light state follows the lamp relay. Fan current is zero while the fan relay is off.

---

## 4. Scenario playbook (Plan v2 §16)

**Timing:**
- The node sends readings every 10 s, and a fault needs **4 of the last 5** abnormal readings, so it confirms about 40–50 s after you cause it.
- With the simulation `.env` values (`VACANCY_MINUTES=1`, `COOLDOWN_MINUTES=2`), "vacant" means 1 minute, and the cooldown after closing a ticket is 2 minutes.

| # | Do this | Expect on the dashboard |
|---|---|---|
| T1 | Knob 3 → 0 people, lamp on | After ~1 min vacant + ~50 s: **Lights left on** ticket (LOW) |
| T2 | Knob 2 fully clockwise (overcurrent) | ~50 s: **Electrical abnormality** ticket (**HIGH**) |
| T2b | Switch 1 on (fan blocked), fan relay on | ~50 s: **Fan failure** ticket (MEDIUM). Current flows but the camera sees no rotation. |
| T3 | Knob 3 → 0, knob 4 past ~42 % | After ~1 min vacant + ~50 s: **Board needs cleaning** ticket (LOW) |
| T3 (lecture) | Knob 4 high but people > 0 | **No ticket.** A written board during a lecture is normal. |
| T5 | Switch 1 on for one reading (~10 s), then off | **No ticket.** One abnormal reading never confirms. |
| T6 | Keep switch 1 on for several minutes | Exactly **one** ticket |
| T7 | After a ticket appears, undo the cause before anyone acts | ~30 s: ticket becomes **Auto-resolved** |
| T8 | Re-create the same fault within 2 min of its ticket closing | **No new ticket** (cooldown). If the fault persists, a new ticket appears after the cooldown. |
| T9 | Maintenance marks the ticket **Resolved** while the fault is still present; supervisor verifies | Verification fails and the ticket is **Reopened** |
| T10 | Fix the cause, then Resolved → supervisor verifies | Ticket **Closed**, with the full history on the ticket page |
| — | Fault returns within 24 h of **Resolved** | The same ticket is **reopened** (recurrence). After 3 recurrences in 7 days, priority goes up one level. |
| T11 | Switch 2 on (person at board) | Board shows **Occluded**. Readings are skipped and never raise a ticket. |
| T13 | Stop the simulation (■) | `esp32-R101` **OFFLINE** within ~25 s (MQTT last will), 90 s at most |
| T14 | Lamp on, people > 0 | **No event** |
| T17 | Switch 3 on (camera offline) | `vcam-R101` **OFFLINE**. Fan/board rules pause instead of using stale data. |

Health scores update every 60 s. Supervisors get an in-app notification for every new, reopened, auto-resolved or escalated ticket.

**Not simulated / not implemented yet:**
- T4 (lamp fused: relay on but no current) needs a *light failure* rule.
- T12 (edge buffering during a network loss) is not done.
- T15/T16 (offline PWA queue, Web Push, Telegram) are not done.

---

## 5. Using the real camera code instead of the virtual camera

1. Slide **switch 3 (camera offline)** on, so the virtual camera stops sending people and board data. Or set `VIRTUAL_CAMERA 0` in `src/config.h`.
2. Run the real vision runtime with the laptop standing in for the Raspberry Pi (see `startup.md` §9):

```powershell
cd backend
python -m models.vision_runtime --room-name R101 --source 0 --interval 30 --show
```

The ESP32 simulation keeps providing the electrical data. The camera provides occupancy, the board state and fan rotation.

---

## 6. Moving to real hardware (`env:hw`)

1. In `src/config.h`, set `WIFI_SSID`, `WIFI_PASSWORD`, and `MQTT_HOST` (your PC's LAN IP).
2. Let Mosquitto accept LAN clients by adding to `mosquitto.conf`:

   ```
   listener 1883 0.0.0.0
   allow_anonymous true
   ```

3. Wire it up. **All mains wiring stays on the enclosed, fused demo panel** under a qualified supervisor (Plan v2 §11.3).

   | Part | ESP32 pin |
   |---|---|
   | PZEM-004T v3 TX / RX | GPIO16 (RX2) / GPIO17 (TX2), 5 V supply |
   | SCT-013-030 (fan branch) | GPIO35 through a 3.5 mm jack, biased at 1.65 V (2 × 10 kΩ divider + 10 µF) |
   | DHT11 | GPIO15 (10 kΩ pull-up) |
   | LDR module AO | GPIO36 |
   | Relay IN1 (lamp) / IN2 (fan) | GPIO26 / GPIO27 (active-low boards: `RELAY_ACTIVE_LOW 1`) |
   | Wall push-buttons | GPIO18 / GPIO19 to GND |

4. Build and flash: `pio run -e hw -t upload`. Watch the output with `pio device monitor`.

The `hw` build is compile-checked but has not been tested on real hardware yet. Calibrate `CT_AMPS_PER_VOLT` and `LAMP_CURRENT_A` against a multimeter during commissioning.
