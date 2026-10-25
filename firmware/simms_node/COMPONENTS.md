# SIMMS Wokwi circuit: component guide

Every part of the Wokwi simulation (`diagram.json`): what it is, which ESP32 pin it uses, what the firmware does with it, and why it is there. For setup and running, see [README.md](README.md).

> The screenshot `docs/wokwi-circuit.png` shows the earlier per-appliance version of the circuit and will be replaced with the circuit-level version.

## The idea

A real classroom has around **6 fans and 6 tube lights**. Putting a voltage sensor, a current sensor and a relay on each would mean 12 of each: expensive and impractical. SIMMS meters **circuits** instead:

```
Main supply ──[ meter: MAIN ]── lights MCB ──[ meter: LIGHTS ]── Tube 1 … Tube 6
                               fans MCB   ──[ meter: FANS ]──── Fan 1 … Fan 6
                               sockets MCB (projector, chargers)
```

- **The circuit current says how many units are on.** Each unit draws a known current, learned during commissioning. For example, 1.82 A on the fans circuit at 0.30 A per fan means 6 fans are on.
- **The camera says which unit is working.** It checks each fan's rotation and each tube's brightness inside its calibrated box.
- **Comparing the two finds the faulty unit:**
  - "6 fans powered but only 5 rotating, and Fan 3 is the stopped one" means **Fan 3 has failed**.
  - A stopped fan that isn't drawing current is simply switched off, which is normal.

This is Plan v2 §8.5: a shared circuit cannot tell which fan failed, so the camera identifies it.

**What the simulation stands in for:**
- **The ESP32** runs exactly the firmware that goes into the real demo panel (`src/main.cpp`).
- **Knobs and buttons** stand in for the three **PZEM-004T circuit meters** and the **Raspberry Pi camera** (the *virtual camera*).

---

## 1. The controller

### ESP32 DevKit (centre)

| | |
|---|---|
| **What it is** | A Wi-Fi microcontroller: the same board used in the real classroom |
| **Runs** | `src/main.cpp` (configuration in `src/config.h`) |
| **Network** | Joins Wokwi's virtual Wi-Fi `Wokwi-GUEST`, then connects to Mosquitto on your PC at `host.wokwi.internal:1883` |

**Every 10 seconds it:**
1. Reads every knob, button, switch and sensor.
2. Works out each circuit's current, power, power factor and energy (kWh).
3. Publishes JSON to MQTT (see §8).

**Also:**
- **Every 30 s** it sends an *ONLINE* heartbeat with Wi-Fi signal strength, uptime, firmware version and circuit-relay states.
- **It registers an MQTT "last will"**, so if the simulation stops the broker announces it *OFFLINE*.
- **It listens for dashboard commands** that switch the demo-panel circuit relays.

---

## 2. Left column: five knobs (potentiometers)

A potentiometer outputs 0–3.3 V depending on how far it is turned; the ESP32 reads that as 0–4095.

**Wiring (all five):** red to 3.3 V, black to GND, signal wire to an ESP32 input. All use analog pins (ADC1) that keep working with Wi-Fi on.

| Knob (top to bottom) | Pin | Simulates | What the firmware does | What it tests |
|---|---|---|---|---|
| **1: Supply voltage** | GPIO 34 | Voltage measured by the PZEM meters | **180–260 V** (starts at about 230 V) | Below 200 V or above 250 V gives an **Electrical abnormality** ticket (HIGH) |
| **2: Fans switched on** | GPIO 35 | Wall switches of the fans | **0–6 fans on** (Fan 1…N). Sets the fans-circuit current. | Fans left on in an empty room gives **Energy wastage** |
| **3: Tubes switched on** | GPIO 39 (VN) | Wall switches of the tube lights | **0–6 tubes on** (Tube 1…N). Sets the lights-circuit current. | Lights left on in an empty room gives **Energy wastage** |
| **4: People count** *(virtual camera)* | GPIO 32 | YOLO person detection on the Pi | **0–40 people** | 0 people is the "room empty" condition for energy wastage and board cleaning |
| **5: Board ink** *(virtual camera)* | GPIO 33 | The Pi's board-cleanliness check | **0–60 % ink**; above 25 % (about 42 % of the knob's travel) is DIRTY | A dirty board in an empty room gives **Board needs cleaning** (LOW) |

---

## 3. Top right: sensors and display

### DHT22: temperature and humidity

| | |
|---|---|
| **Pin** | Data on GPIO 15 (green wire), plus 3.3 V and GND |
| **Works by** | Sending digital temperature and humidity readings (DHTesp library) |
| **Use it** | Click it during the simulation to set the values (starts at 27.5 °C and 55 %) |
| **Purpose** | Feeds the **classroom health score**: temperature outside 18–35 °C or humidity outside 30–70 % lowers it |
| **Real hardware** | A DHT11 |

### Photoresistor (LDR) light-sensor module

| | |
|---|---|
| **Pin** | Analog output (AO) on GPIO 36 (VP) in the simulation. Real hardware: DO (or AO) on GPIO 34 (D34) |
| **Works by** | Its output voltage falls as light increases; the firmware flips that into a 0–100 % `light_level` |
| **Purpose** | Room light level shown on the Live monitor (context only; no rule depends on it) |

### OLED display (SSD1306, 128 × 64)

| | |
|---|---|
| **Pins** | I2C: SDA on GPIO 21, SCL on GPIO 22 (cyan wires), plus 3.3 V and GND |
| **Shows** | Room and connection state, supply voltage, **one box per fan and per tube**, people count, board ink and relay states |
| **Box legend** | **Filled** = on and working. **Empty** = switched off. **Crossed** = on but faulty (blocked fan or failed tube). |
| **Purpose** | See the whole simulated room at a glance and compare it with the dashboard |

---

## 4. Middle right: three LEDs (outputs)

| LED | Pin | Meaning |
|---|---|---|
| **Yellow** | GPIO 26 | **Lights-circuit relay** (demo panel): off cuts every tube |
| **Blue** | GPIO 27 | **Fans-circuit relay** (demo panel): off cuts every fan |
| **Green** | GPIO 4 | **Connected to the MQTT broker** |

**What the relays are for:** classrooms are **monitored, not switched** (Plan v2 §5.3), so the relays exist only on the demonstration panel. The dashboard's *Turn lights/fans on/off* buttons switch them, which shows two-way sync.

**Real hardware:** a 2-channel relay board, switched on by a low signal (`RELAY_ACTIVE_LOW`).

---

## 5. Lower right: two push buttons (fault injection)

| Button | Pin | Key | Each press |
|---|---|---|---|
| **Blue** | GPIO 18 | **F** | Moves the **blocked fan** to the next one: none → Fan 1 → … → Fan 6 → none |
| **Yellow** | GPIO 19 | **T** | Moves the **failed tube** to the next one: none → Tube 1 → … → Tube 6 → none |

**What a blocked fan does:**
- It still draws current: 0.36 A, slightly more than a healthy fan's 0.30 A.
- The camera reports it **not rotating**.
- If it's switched on, the backend pinpoints it: "6 fans powered, 5 rotating: **Fan 3** powered but not rotating". That gives a **Fan failure** ticket (HIGH).

**What a failed tube does:**
- It still draws current (a faulty driver).
- The camera reports it **dark**, which gives a **Light failure** ticket (MEDIUM).

**A blocked fan that is switched off is not a fault**, because nothing says it should be turning.

The OLED shows a cross on the faulty unit. Keyboard keys work while the simulator canvas has focus.

---

## 6. Bottom right: three slide switches

Slide a switch **to the right** to turn it on.

| Switch (left to right) | Pin | Simulates | Effect |
|---|---|---|---|
| **1: Fans overload** | GPIO 13 | A short circuit or seized motors on the fans circuit | Adds 25 A to the fans circuit. That gives **Electrical abnormality** ("fans circuit overcurrent 26.8 A (max 2.8 A)"). The per-fan check pauses, because the current no longer tells how many fans are on. |
| **2: Person at board** *(virtual camera)* | GPIO 14 | A lecturer in front of the board | The board reading becomes **OCCLUDED** and is skipped (test T11) |
| **3: Camera offline** *(virtual camera)* | GPIO 23 | The camera stops delivering frames | All vision messages stop and `vcam-R101` shows **OFFLINE**. The per-unit checks pause instead of guessing (T17). Also use this when running the real camera code. |

---

## 7. How faults are decided (per unit)

| Circuit says | Camera says | Result |
|---|---|---|
| 6 fans powered | 6 rotating | Normal |
| 6 fans powered | Fan 3 stopped | **Fan failure: Fan 3** |
| 5 fans powered | Fan 6 stopped | Normal (Fan 6 is switched off) |
| 5 fans powered | Fans 3 and 6 stopped | **Fan failure: "1 of Fan 3, Fan 6"**. It can't tell which of the two is off and which is broken, so one room-level ticket names both. |
| Any | Camera offline / unit not visible | No per-unit verdict (never guesses) |
| Circuit overloaded | — | Electrical abnormality only |

The same table applies to tube lights ("lit" instead of "rotating").

**Per-unit current:** the backend uses 0.30 A per fan and 0.10 A per tube until it learns the real value. To learn it:
1. Open **Admin → Classrooms → R101 → Circuits**.
2. Switch everything off and press *Set standby*.
3. Switch on a known number of units, enter that number, and press *Learn per-unit current*.

---

## 8. How it all connects

```
knobs / buttons / switches / sensors ──► ESP32 firmware (every 10 s)
   ├─ classroom/R101/sensors   {"voltage", "circuits": {MAIN, LIGHTS, FANS}} + environment
   ├─ classroom/R101/vision    occupancy · board · {"fans": [6 fans]} · {"lights": [6 tubes]}
   └─ classroom/R101/status/…  ONLINE heartbeat / OFFLINE last will
                 │
                 ▼
        Mosquitto broker (your PC)
                 │
                 ▼
        SIMMS backend: circuit count vs camera → 4-of-5 confirmation → ticket
                 │
                 ▼
        Dashboard Live monitor (every 3 s): circuits, 6 fan tiles, 6 tube tiles
                 │
   Lights / Fans buttons ──► classroom/R101/command ──► ESP32 switches the relay LED
```

**Timing: what to expect when you change something**
- The ESP32 includes the change in its next reading, at most **10 s** later.
- The dashboard shows it within **3 s** after that.
- A fault needs **4 of the last 5** readings to be abnormal, so a ticket appears about **40–50 s** after you cause it.
- **A single-reading glitch never creates a ticket.**
- If the fault clears before anyone acts, the ticket closes itself as **Auto-resolved**.

### Wire colours

| Colour | Meaning |
|---|---|
| Red | 3.3 V power |
| Black | Ground (GND) |
| Orange / blue / gold / violet | Knob signals |
| Green | Sensor data |
| Cyan | OLED (I2C) |
| Yellow / blue | Buttons and LEDs |
| Grey | Slide switches |

---

## 9. Simulation vs real hardware

| In the simulation | In the real classroom / demo panel |
|---|---|
| Knob 1 (voltage) | Measured by every PZEM-004T meter |
| Knobs 2–3 (units switched on) + fault buttons | Real wall switches and real faults; the meters measure the resulting circuit currents |
| — | **PZEM-004T v3** on the lights circuit (Modbus address 0x01), the fans circuit (0x02) and optionally the main supply (0x03), all sharing UART2 (GPIO 16/17) |
| Knobs 4–5, switches 2–3, per-unit states (virtual camera) | Raspberry Pi + camera running `backend/models/vision_runtime.py`: YOLO people count, board check, fan rotation and tube brightness per calibrated box |
| Switch 1 (overload) | A real fault on the circuit |
| DHT22 | DHT11 |
| Yellow / blue LEDs | 2-channel relay board on the enclosed, fused demo panel |
| `Wokwi-GUEST`, `host.wokwi.internal` | Institute Wi-Fi, PC's LAN IP address |

**Hardware per classroom:** 1 ESP32, 2–3 PZEM-004T meters (instead of 12 sensors), 1 DHT11, 1 LDR module. The relays are for the demo panel only.

To build for hardware, use the `hw` environment. [README.md](README.md) §6 has the wiring and safety notes.
