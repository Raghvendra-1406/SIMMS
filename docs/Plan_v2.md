# Smart Classroom Infrastructure Monitoring and Maintenance System Using Computer Vision and IoT

**Project Plan — Version 2.2 (Revised Scope, Web Client, Reduced Budget)**
Date: 14 August 2026

---

## 0. About This Revision

Version 1 of this plan established the concept and the end-to-end vision. Version 2 keeps that
vision but makes the project **buildable within one academic year** by tightening scope, replacing
high-risk techniques with reliable ones, and adding the engineering detail that separates a working
system from a demonstration.

### 0.1 Summary of Changes from Version 1

| # | Change | Reason |
|---|--------|--------|
| 1 | Objectives split into **Core (must ship)** and **Extended (if time permits)** | Ten equal-weight objectives is three capstones' worth of work |
| 2 | Empty-seat detection now uses **pretrained person detection + per-classroom seat ROIs** instead of a trained seat detector | Removes an entire dataset-and-training workload; more robust across seating layouts |
| 3 | Furniture damage detection reframed as **reference-based anomaly detection** and moved to Extended | Damaged furniture is rare; a balanced dataset cannot realistically be collected |
| 4 | Board condition uses **classical image processing**, not a neural network | Deterministic, explainable, tunable, zero training cost |
| 5 | Fan operation monitored by **branch current (Core)**, with **visual rotation verification as an Extended objective (E1)** | A shared circuit cannot identify *which* fan is faulty; rotation detection adds that capability but depends on camera geometry confirmed only at P0, so it must not gate the Core deliverable |
| 6 | All mains-voltage work confined to a **supervised demonstration panel** | Safety, and institutional electrical approval is otherwise impractical |
| 7 | Added §7 **Event Confirmation, Debouncing and De-duplication** | Single-frame detections must never create tickets; this is the core reliability contribution |
| 8 | Added §11 **Privacy, Ethics and Institutional Approval** | Cameras in occupied classrooms require a written policy and prior approval |
| 9 | Added §6.1 **Classroom Calibration Workflow** | Seat, board and fan regions are per-classroom and must be configurable |
| 10 | System reframed as **periodic inspection (30–60 s interval)**, not real-time video | Eliminates the need for a Jetson-class device; FPS removed as a metric |
| 11 | Technology stack **committed to a single choice** per layer | v1 listed four databases and three mobile frameworks |
| 12 | Performance targets replaced with **measurable, defensible** ones, including a false-ticket rate | ">90% accuracy" was asserted for tasks where it is not achievable |

### 0.2 Changes in Version 2.1

| # | Change | Reason |
|---|--------|--------|
| 13 | Flutter native app replaced by an **installable Progressive Web App (PWA)** | One codebase for phone and desktop, no Android Studio/Dart toolchain, faster to build, demonstrable from any browser; still installs to the home screen with an icon and supports push |
| 14 | Firebase Cloud Messaging replaced by **standards-based Web Push (VAPID)** plus a **Telegram bot** as a redundant channel | No vendor account required, no cost, and Telegram guarantees the notification objective is met on every phone regardless of browser support |
| 15 | Calibration tool merged into the web application as an **HTML canvas ROI editor** | Previously a separate desktop tool; as a web app it is one screen in the existing client |
| 16 | Bill of materials reduced from **≈ ₹21,750 to ≈ ₹5,460** (worst case ₹11,400) | Original BOM over-specified the edge device, camera and sensor set for a single-classroom prototype |
| 17 | Added §12.3 **Deployment and Hosting Cost** (₹0 target) | Hosting was previously unbudgeted |
| 18 | Fan rotation verification moved from **Core C5 → Extended E1**; Core objectives renumbered C5–C11; §18 novelty reordered so the primary claims rest entirely on Core deliverables | The capability depends on the fans being within the camera's field of view, which is confirmed only by the P0 site survey. No headline claim may depend on unverified camera geometry. |

---

## 1. Title

Smart Classroom Infrastructure Monitoring and Maintenance System Using Computer Vision and IoT

## 2. Introduction

Educational institutions operate large numbers of classrooms, laboratories, seminar halls and
tutorial rooms that require regular inspection and maintenance. At present this inspection is
performed manually by faculty, laboratory staff, housekeeping personnel and electrical supervisors.
The process is labour-intensive, intermittent, and dependent on someone noticing and reporting a
problem. Even when a problem is noticed, the report is usually verbal or written in a register, so
there is no reliable record of when it was raised, who it was assigned to, or whether it was fixed.

The proposed system automates two distinct things:

1. **Detection** — periodically observing classroom condition using a camera and IoT sensors.
2. **Resolution management** — converting a confirmed problem into a tracked maintenance ticket
   that is automatically classified, prioritised, assigned, notified, and followed through to
   closure.

The second half is as important as the first. A system that only detects problems produces a
dashboard nobody acts on. The contribution of this project is the complete chain:

> **Observe → Confirm → Classify → Ticket → Assign → Notify → Repair → Verify → Close**

A camera and an IoT node are installed in the classroom. An edge computing device performs the
image analysis locally and transmits only derived information — never raw video — to a central
server. The server applies confirmation logic, creates tickets, and pushes notifications to the
web application used by the supervisor and the maintenance staff. The client is delivered as an
installable Progressive Web App, so it behaves as a phone application (home-screen icon, full
screen, offline capability, push notifications) while remaining a single codebase that also runs on
a desktop browser for supervisor use.

## 3. Problem Statement

Institutions require an automated system that can:

1. Determine classroom occupancy without identifying individual students.
2. Assess whether the classroom board is ready for the next lecture.
3. Determine whether lights and fans are ON, OFF, or faulty.
4. Correlate occupancy with electrical load to identify energy wastage.
5. Convert confirmed abnormalities into tracked maintenance tickets automatically.
6. Route each ticket to the correct category of staff and notify them.
7. Track every ticket from detection to verified closure.
8. Maintain a historical record for preventive maintenance planning.

Critically, the system must do this **without generating false alarms**. A monitoring system that
raises spurious tickets is worse than no system at all, because staff stop trusting it. Reliability
of ticket generation is therefore treated as a first-class design requirement, not an afterthought.

## 4. Aim

To develop an IoT-enabled classroom infrastructure monitoring system that uses edge-based computer
vision and sensor monitoring to reliably detect classroom infrastructure and electrical problems,
and to manage those problems through a complete digital maintenance workflow accessible via an
installable web application on both phone and desktop.

## 5. Objectives

### 5.1 Core Objectives (committed deliverables)

| ID | Objective |
|----|-----------|
| C1 | Periodically capture and analyse classroom condition on an edge device |
| C2 | Determine seat-level occupancy using person detection over calibrated seat regions |
| C3 | Assess board cleanliness and classify board readiness for the next lecture |
| C4 | Monitor light and fan ON/OFF status and electrical parameters using IoT sensors |
| C5 | Detect energy wastage by correlating occupancy with active electrical load |
| C6 | Confirm, de-duplicate and debounce detections before raising a ticket |
| C7 | Automatically classify, prioritise and assign maintenance tickets |
| C8 | Deliver push notifications to the assigned staff member |
| C9 | Provide an installable web application (PWA) for supervisor monitoring and staff ticket handling |
| C10 | Compute and display a Classroom Infrastructure Health Score |
| C11 | Maintain a complete, queryable history of all events and tickets |

### 5.2 Extended Objectives (attempted only after Core is stable)

| ID | Objective |
|----|-----------|
| E1 | **Vision-based fan rotation verification** — flag fans that draw current but do not rotate (§8.5) |
| E2 | Reference-based furniture anomaly detection (missing, overturned or displaced furniture) |
| E3 | Visible furniture damage detection as a small-dataset proof of concept |
| E4 | Historical analytics: recurring-fault identification and preventive maintenance suggestions |
| E5 | Automated daily / weekly / monthly reports |
| E6 | Multi-classroom scale demonstration beyond the prototype room |

**Note on E1.** Fan rotation verification is inexpensive to implement (frame differencing over a
calibrated region) but depends on the fans being within the camera's field of view, which is only
confirmed by the Phase P0 site survey. It is therefore classified as Extended rather than Core: the
project must not depend on a camera geometry that has not yet been verified. If P0 confirms the fans
are in frame, E1 is the first Extended objective to be attempted, because it produces the strongest
diagnostic capability in the system for the least implementation effort.

### 5.3 Explicit Non-Goals

These are stated so that scope does not expand during development:

- **No facial recognition or student identification.** Occupancy is counted, never attributed.
- **No continuous video recording, streaming or cloud upload of raw frames.**
- **No automatic switching of live loads.** Relay control is demonstrated on the isolated demo
  panel only, and never on classroom mains.
- **No attendance system.** Occupancy is an infrastructure-utilisation metric.
- **No per-fan fault isolation from a shared circuit** using load disaggregation (NILM). This is
  acknowledged as a research problem and listed under Future Scope.

---

## 6. System Architecture

```
┌──────────────────────── CLASSROOM (Edge) ────────────────────────┐
│                                                                   │
│   Camera (fixed, wide angle)          IoT Node (ESP32)            │
│         │                                   │                     │
│         │ frame every 30–60 s               │ sample every 5 s    │
│         ▼                                   │                     │
│   ┌──────────────────────────┐              │                     │
│   │  Raspberry Pi 5 (Edge AI)│              │ PZEM-004T (V,I,P,E) │
│   │  ├ Person detection      │              │ CT clamps (per-load)│
│   │  ├ Seat ROI occupancy    │              │ BH1750 (lux)        │
│   │  ├ Board ink-ratio       │              │ AHT20 (temp/RH)     │
│   │  ├ Fan rotation (E1)     │              │                     │
│   │  └ Evidence crop (blur)  │              │                     │
│   └──────────┬───────────────┘              │                     │
│              │  JSON observations only      │  JSON telemetry     │
└──────────────┼──────────────────────────────┼─────────────────────┘
               │                              │
               └──────────► MQTT (Mosquitto) ◄┘
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │  Backend Server — FastAPI (Python)        │
        │  ├ Ingest & persist observations          │
        │  ├ Confirmation / debounce / dedup engine │  ← §7
        │  ├ Rule engine → issue classification     │
        │  ├ Ticket lifecycle & assignment          │
        │  ├ Health score computation               │
        │  ├ REST API + Web Push (VAPID) dispatch   │
        │  └ Telegram bot (redundant notification)  │
        └───────────────┬───────────────────────────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
      PostgreSQL              Web App — React PWA
      (state + history)       ├ Supervisor: dashboard, verify, close
                              ├ Staff: assigned tickets, update status
                              └ Admin: classroom calibration (ROI editor)
                              (installable to phone home screen; also
                               runs on desktop browser)
```

**Key architectural decision — periodic inspection, not real-time video.**
Classroom infrastructure changes on a timescale of minutes to hours, not milliseconds. The edge
device analyses one frame every 30–60 seconds. This single decision:

- removes the need for a Jetson-class accelerator (a Raspberry Pi 5 is sufficient),
- reduces power and thermal load to something that can run unattended,
- makes frames-per-second an irrelevant metric, and
- makes the privacy posture defensible, since no continuous stream exists.

### 6.1 Classroom Calibration Workflow

Seat positions, board location and fan positions differ in every room. A one-time calibration step
is therefore required per classroom, performed through an admin screen in the application:

1. The edge device captures a reference frame of the empty classroom.
2. The administrator draws **seat regions** (one polygon per seat or per bench), **the board
   region** (four corners, used for perspective correction), and **fan regions** (one box per fan).
3. Each region is labelled (`seat_01…seat_40`, `board_main`, `fan_01…fan_05`).
4. The reference frame is stored as the baseline for furniture anomaly detection (Extended).
5. The calibration is versioned — if furniture is rearranged, a new calibration version is created
   and old observations remain interpretable.

Because the client is a web application, this editor is an **HTML canvas overlaid on the reference
image** inside the existing admin screen — polygons are drawn with the mouse on a laptop or by touch
on a tablet, and saved directly to the API as coordinate arrays. No separate desktop tool has to be
written or distributed, which removes a component that the previous plan treated as its own
deliverable.

This calibration data is what allows the vision modules to be simple and reliable. It is a
deliberate trade: a few minutes of one-time human setup per room buys away a large amount of
machine-learning risk.

---

## 7. Event Confirmation, Debouncing and De-duplication

**This section describes the most important reliability mechanism in the system.**

A raw detection is not an event, and an event is not a ticket. A person standing momentarily in
front of the board, a hand passing in front of a fan, or a single low-confidence frame must never
produce a maintenance request. Three mechanisms are applied in sequence.

### 7.1 Temporal Confirmation (N-of-M Sliding Window)

Each detector emits an **observation** at every sampling interval, carrying a state and a
confidence. The confirmation engine maintains a sliding window of the last *M* observations per
`(classroom, detector, target)` triple.

| Parameter | Value | Meaning |
|-----------|-------|---------|
| Sampling interval | 60 s (vision), 5 s (sensors) | How often an observation is produced |
| Window size *M* | 5 observations | ~5 minutes of vision history |
| Fault threshold *N* | 4 of 5 | Observations that must agree before a fault is *confirmed* |
| Recovery threshold | 3 of 5 clear | Observations required before a fault is considered *cleared* |
| Minimum confidence | 0.55 | Observations below this are recorded but do not vote |

Asymmetric thresholds are intentional: the system is deliberately slower to raise a fault than to
clear one, which biases it against false tickets.

### 7.2 De-duplication by Issue Signature

Every confirmed fault is reduced to a signature:

```
signature = (classroom_id, issue_type, target_id, calibration_version)
```

Before creating a ticket the engine checks for an existing ticket with the same signature in any
open state (`NEW`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`). If one exists:

- **no new ticket is created**;
- the existing ticket's `recurrence_count` is incremented;
- the observation is appended to that ticket's evidence trail;
- if `recurrence_count` crosses a threshold, priority is escalated one level.

This is what prevents the system from producing forty tickets for one broken fan over one day.

### 7.3 Post-Closure Cooldown and Auto-Resolution

- **Cooldown:** after a ticket is closed, the same signature is suppressed for 30 minutes. This
  prevents a ticket from immediately reopening while a technician is still working in the room.
- **Auto-resolution:** if a fault clears while its ticket is still in `NEW` (nobody has acted yet),
  the ticket is closed automatically with status `AUTO_RESOLVED` and a note. This handles transient
  conditions — for example, a board cleaned by the next lecturer before housekeeping arrived.
- **Stale-ticket escalation:** a ticket that remains in `NEW` beyond its priority SLA is escalated
  to the supervisor.

### 7.4 Why This Matters

The false-ticket rate is the metric that determines whether staff trust the system. It is measured
explicitly in §16 and reported as a primary result, alongside detection accuracy. To the best of
our knowledge, comparable student projects report detection accuracy but not operational false-alarm
rate; reporting both is a genuine contribution of this work.

---

## 8. Functional Modules

### 8.1 Module 1 — Classroom Registry

Each classroom has a unique identifier (6301, 6302, 6304, 6305, 6309, 6310), with building, floor,
seat capacity, installed light count, installed fan count, and current calibration version.

### 8.2 Module 2 — Occupancy Detection

**Approach:** pretrained YOLO (person class only, COCO) → bounding boxes → for each calibrated seat
ROI, test whether a person box centroid or sufficient overlap falls within it.

**Why not train a seat detector:** seat appearance varies with layout, viewing angle and occlusion,
and would require a large annotated dataset for a task that geometry solves exactly. Person
detection is one of the most mature and reliable capabilities in object detection, and the seat
geometry is already known from calibration. This eliminates the largest annotation workload in the
project at no cost to accuracy.

**Outputs:**
```json
{ "classroom": "6309", "total_seats": 40, "occupied": 28, "empty": 12,
  "occupancy_ratio": 0.70, "ts": "2026-08-14T10:32:00+05:30" }
```

**Handling of edge cases:** students standing, students seated between marked seats, and partial
occlusion in rear rows are recorded as known limitations and quantified during evaluation.

### 8.3 Module 3 — Board Condition Monitoring

**Approach — classical image processing, no neural network:**

1. Extract the board region using the four calibration corners.
2. Apply a perspective transform to obtain a rectified, front-facing board image.
3. Convert to greyscale and apply adaptive thresholding (compensates for uneven lighting and glare).
4. Apply morphological opening to remove speckle noise.
5. Compute **ink ratio** = (marked pixels) / (total board pixels).
6. Suppress frames where a person overlaps the board region — a lecturer standing at the board
   would otherwise be counted as writing.

**Classification:**

| Ink Ratio | Board State | Action |
|-----------|-------------|--------|
| < 5 % | Clean | None |
| 5 – 25 % | In use | None (writing is expected during a lecture) |
| > 25 % **and** classroom vacant **and** vacant for ≥ 10 min | Requires cleaning | Raise cleaning ticket |

The occupancy condition is essential — a board full of writing during an active lecture is normal,
not a fault. This coupling between two modules is exactly the kind of multimodal reasoning that
justifies the combined CV + IoT architecture.

**Justification for the classical approach:** the task is a well-posed measurement, not a perception
problem. A threshold on ink ratio is deterministic, explainable to a maintenance supervisor, tunable
on site without retraining, and runs in milliseconds. Introducing a CNN here would add training
cost, dataset cost and opacity for no accuracy benefit.

### 8.4 Module 4 — Electrical Monitoring

A **PZEM-004T v3** module on the demo panel provides voltage, current, active power, power factor
and cumulative energy over UART to the ESP32. Individual **SCT-013 current transformer clamps**
provide per-load current for the demonstration loads (lamp circuit, fan circuit).

**Derived states:**

| Condition | Interpretation |
|-----------|----------------|
| Current below no-load threshold | Load OFF |
| Current within expected band | Load ON, normal |
| Current above expected band | Abnormal draw — possible fault |
| Current present but fan not rotating (§8.5) | **Mechanical fault** — high priority *(Extended, E1)* |
| Load ON while classroom vacant ≥ 10 min | Energy wastage |

Expected current bands are learned from a short baseline period during commissioning rather than
hard-coded, so the system adapts to the actual loads installed.

### 8.5 Module 5 — Fan Rotation Verification *(Extended, E1)*

**Problem with a purely electrical approach:** in a real classroom all fans share one circuit. A
single current measurement cannot identify *which* fan has failed. Per-fan current sensing requires
per-device CT clamps, which is feasible only on a purpose-built panel.

**Solution — verify rotation visually.** Within each calibrated fan ROI, compute the mean absolute
difference between consecutive frames captured a few tens of milliseconds apart. A rotating fan
produces high inter-frame difference in its region; a stationary fan produces near-zero difference.

```
motion_score = mean(|frame_t − frame_(t+Δ)|)  within fan ROI
rotating = motion_score > threshold
```

**The high-value fault this enables:**

> Current is flowing to the fan circuit, but Fan No. 3 shows no rotation
> → *seized motor or broken blade coupling* → **High priority electrical ticket.**

This cross-modal check (electrical signal says ON, visual signal says not moving) is a stronger
diagnostic than either sensor alone, requires no mains modification in the classroom, and directly
demonstrates the value of combining computer vision with IoT. It is a central novelty claim of the
project.

Thresholds are calibrated per fan during commissioning to account for distance, lighting and blade
contrast.

### 8.6 Module 6 — Energy Wastage Detection

A rule evaluated on the server, combining two independent modalities:

```
IF occupancy == 0
   FOR at least 10 continuous minutes
   AND (light_power > threshold OR fan_power > threshold)
THEN raise ENERGY_WASTAGE event (Medium priority, routed to Electrical Supervisor)
```

The system computes and reports classroom-wise daily energy consumption, estimated wasted energy
(power drawn during confirmed-vacant intervals), and monthly totals.

### 8.7 Module 7 — Furniture Anomaly Detection *(Extended, E2)*

**Reference-based change detection rather than damage classification.** The calibration reference
frame of the empty classroom is compared against the current frame during confirmed-vacant periods:

1. Align current frame to reference (the camera is fixed, so alignment is minor).
2. Compute structural difference restricted to furniture regions.
3. Flag regions exceeding a change threshold as *furniture anomaly — inspection required*.

This detects missing chairs, overturned chairs and significantly displaced furniture — conditions
that are common, visible and actionable — without requiring a dataset of damaged furniture.

**Visible damage classification (E3)** is attempted only as a small-dataset proof of concept, with
deliberately staged damage collected under institutional permission. It will be reported honestly
as a limited feasibility study **with no accuracy target claimed**, since a representative dataset
of damaged classroom furniture cannot be collected at the scale required for a reliable classifier.

---

## 9. Issue Classification, Routing and Priority

### 9.1 Category → Assignee Mapping

| Category | Example Issues | Routed To |
|----------|----------------|-----------|
| Electrical | Light not working, fan not rotating, abnormal current | Electrical Maintenance Staff |
| Cleaning | Board requires cleaning, classroom cleanliness | Housekeeping Staff |
| Furniture | Missing / overturned / damaged furniture | Furniture Maintenance Staff |
| Energy | Loads active in vacant classroom | Electrical Supervisor |
| Infrastructure | Board surface damage, fixture damage | Infrastructure Coordinator |

### 9.2 Priority Assignment and SLA

| Priority | Trigger | Response SLA | Escalation |
|----------|---------|--------------|------------|
| **High** | Abnormal current, fan powered but not rotating, potential electrical hazard | 2 hours | Supervisor after SLA breach |
| **Medium** | Light not working, fan not working, furniture anomaly, energy wastage | 8 hours | Supervisor after SLA breach |
| **Low** | Board requires cleaning, minor cleanliness | 24 hours | Digest notification only |

Priority is escalated one level automatically when `recurrence_count` for a signature exceeds three
within seven days, since a repeatedly recurring fault indicates an incomplete previous repair.

### 9.3 Ticket Lifecycle

```
NEW ──► ASSIGNED ──► IN_PROGRESS ──► RESOLVED ──► VERIFIED ──► CLOSED
 │                                       │
 │                                       └──► REOPENED (supervisor rejects the repair)
 └──► AUTO_RESOLVED (fault cleared before anyone acted)
```

Every transition records actor, timestamp and optional note. `RESOLVED → VERIFIED` requires
supervisor action; staff cannot close their own tickets. This separation is what makes the
maintenance record trustworthy as an accountability trail.

---

## 10. Classroom Infrastructure Health Score (CIHS)

A single 0–100 score per classroom, computed hourly:

```
CIHS = 100 − (w_e·P_electrical + w_f·P_furniture + w_b·P_board + w_m·P_maintenance)
```

| Component | Penalty basis | Weight |
|-----------|---------------|--------|
| `P_electrical` | Fraction of lights and fans faulty | 0.40 |
| `P_furniture` | Fraction of furniture anomalies vs. reference | 0.20 |
| `P_board` | Board pending cleaning, scaled by duration | 0.15 |
| `P_maintenance` | Open tickets weighted by priority and age | 0.25 |

| Score | Status |
|-------|--------|
| 85 – 100 | **Normal** (green) |
| 60 – 84 | **Warning** (amber) |
| below 60 | **Critical** (red) |

Weights are configurable and will be tuned with input from the institution's maintenance staff
rather than fixed arbitrarily. The score gives the supervisor an immediate ranking of which rooms
need attention first.

---

## 11. Privacy, Ethics and Institutional Approval

Cameras are being installed in rooms occupied by students. This section is a **prerequisite for
data collection**, not documentation written afterwards. No images will be captured before written
approval is obtained.

### 11.1 Technical Privacy Controls

1. **No raw video leaves the classroom.** The edge device transmits JSON observations only. There is
   no video streaming capability in the system.
2. **No frame storage by default.** Frames are held in memory, analysed, and discarded. Nothing is
   written to disk during normal operation.
3. **Evidence images are the sole exception**, and are subject to all of the following:
   - captured only when a fault is *confirmed* (§7), never routinely;
   - cropped to the region of interest (the fan, the board, the furniture);
   - all detected person regions blurred irreversibly **before** the image is written or transmitted;
   - retained for 30 days, then deleted automatically.
4. **No facial recognition, biometric processing, or identity attribution** is implemented anywhere
   in the system. Occupancy is an integer count.
5. **No audio capture.** Microphones are not part of the hardware design.
6. Camera placement points at seating and board areas only, avoiding doorways and corridors.

### 11.2 Institutional and Procedural Controls

- Written permission from the Head of Department and Institute administration before installation.
- Visible signage in the instrumented classroom stating that automated infrastructure monitoring is
  in operation and that no personal identification is performed.
- Access to the system is role-restricted; no role can retrieve raw images of identifiable persons
  because none exist.
- A written data policy is included as an appendix to the final report.

### 11.3 Electrical Safety

- All mains-voltage work is performed on a **purpose-built demonstration panel**: enclosed, with a
  6 A MCB, fuse protection, insulated terminal blocks, and proper earthing.
- **No connection is made to classroom mains wiring at any point.**
- The panel is assembled and inspected under the supervision of a qualified electrical staff member
  before energising, and is never left energised unattended.
- Relay-based load switching is demonstrated on the panel only, and is explicitly excluded from the
  classroom deployment (§5.3).

---

## 12. Hardware Requirements and Budget

### 12.1 Bill of Materials

| # | Item | Qty | Purpose | Cost (₹) |
|---|------|-----|---------|----------|
| 1 | **Edge compute** — Raspberry Pi 4 (2 GB) borrowed from the institute IoT laboratory, or a team member's laptop | 1 | Edge AI processing | **0** |
| 2 | microSD 32 GB (only if a Pi is used) | 1 | Edge OS and storage | 400 |
| 3 | **Camera** — spare Android phone running an IP-camera application over Wi-Fi | 1 | Classroom capture | **0** |
| 4 | ESP32 DevKit V1 | 1 | IoT sensing node | 400 |
| 5 | PZEM-004T v3 energy module | 1 | Voltage, current, power, PF, energy over UART | 1,200 |
| 6 | SCT-013-030 CT clamp | 1 | Independent fan-branch current | 500 |
| 7 | DHT11 sensor | 1 | Temperature and humidity | 80 |
| 8 | LDR light sensor module | 1 | Coarse light-state cross-check | 30 |
| 9 | 2-channel opto-isolated relay module | 1 | Demo-panel load switching | 150 |
| 10 | Demo panel: enclosure, 6 A MCB, fuse holder, terminal blocks, 3-core cable, earthing | 1 | Safe mains demonstration | 1,200 |
| 11 | Small 230 V table fan | 1 | Demonstration load | 800 |
| 12 | LED bulb with holder | 2 | Demonstration load | 150 |
| 13 | Jumper wires, perfboard, connectors, fasteners | — | Assembly | 400 |
| 14 | 5 V USB supply for ESP32 | 1 | Node power | 150 |
| | **Estimated Total** | | | **≈ ₹5,460** |

**Contingency**, if borrowed or existing items are unavailable:

| Item | Cost (₹) |
|------|----------|
| Raspberry Pi 4 (2 GB) + PSU + case, if the lab cannot lend one | 4,700 |
| USB 1080p webcam, if no spare phone is available | 800 |
| Spare ESP32 (recommended — development boards do fail) | 400 |
| **Worst-case total** | **≈ ₹11,400** |

Wi-Fi uses existing institutional infrastructure. Costs are indicative as of August 2026 and will be
confirmed at procurement.

### 12.2 Cost-Reduction Decisions and Their Technical Justification

Each reduction is a considered engineering choice, not simply a cheaper substitute. This section
exists so the decisions can be defended during review.

| Change | Saving (₹) | Justification |
|--------|-----------|---------------|
| Raspberry Pi 5 (4 GB) → **Pi 4 (2 GB), borrowed** | 9,200 | At a 60 s inference interval, one YOLO-nano pass takes roughly 2–4 s on a Pi 4, giving a duty cycle under 7 %. The Pi 5, its 27 W PSU and its active cooler were specified for a throughput this architecture never demands (§6). Most departments running an IoT minor already hold Raspberry Pis in the laboratory. |
| Camera Module 3 → **spare Android phone as an IP camera** | 3,000 | A mid-range phone camera has better optics, autofocus and low-light performance than the Pi module. It streams MJPEG over Wi-Fi, which additionally decouples camera placement from edge-device placement — the Pi no longer has to sit within ribbon-cable distance of the camera. This is a technically superior arrangement that also happens to be free. |
| 3 × SCT-013 CT clamps → **1 clamp + PZEM-004T** | 1,000 | The demo-panel loads are switched by the system's own relays, so the server already knows which load is energised and can attribute PZEM current readings by switching state. Only the fan branch requires continuous independent sensing, so that an abnormal fan current is distinguishable from the lamp branch without relying on relay state — and so that the E1 rotation cross-check, if attempted, has a simultaneous current reading to compare against. |
| BH1750 → **LDR module** | 170 | Ambient light is used only as a coarse corroboration of light ON/OFF state; calibrated lux values are never consumed by any rule. |
| AHT20/DHT22 → **DHT11** | 220 | Temperature is contextual metadata for the classroom record. ±2 °C accuracy is entirely sufficient; no rule depends on precise temperature. |
| 4-channel relay → **2-channel** | 200 | The demo panel drives exactly two loads. |
| 2 × ESP32 → **1** | 400 | One node serves the single prototype classroom. A spare is listed under contingency. |
| OLED display removed | 300 | The web application displays all node status, including uptime, RSSI and firmware version via the retained MQTT status topic (§14.2). A local display duplicates this. |
| Ceiling fan → **small table fan** | 700 | A table fan is a 230 V AC induction load with the same electrical signature and visible blade rotation, and it is portable for the demonstration. |
| **Total reduction** | **≈ ₹15,190** | **₹21,750 → ₹5,460** |

**Deliberately excluded:** NVIDIA Jetson (unnecessary at a 30–60 s inference interval — see §6);
discrete voltage sensor (superseded by PZEM-004T); Firebase (superseded by self-hosted Web Push).

### 12.3 Deployment and Hosting Cost — Target ₹0

| Component | Approach | Cost |
|-----------|----------|------|
| Backend, database, MQTT broker, web client | Single Docker Compose stack on a laboratory PC or team laptop on the college LAN | ₹0 |
| Public access (optional) | Cloudflare Tunnel — exposes the LAN server over HTTPS with no public IP, no port forwarding, no paid hosting | ₹0 |
| Always-on cloud host (optional alternative) | Oracle Cloud Always Free ARM instance, or Render/Fly.io free tier | ₹0 |
| Push notifications | Self-hosted Web Push using VAPID keys generated by the team | ₹0 |
| Redundant notification channel | Telegram Bot API | ₹0 |
| Domain name | Not required — LAN hostname, or the free subdomain provided by Cloudflare Tunnel | ₹0 |

**Running the demonstration on the local network is a deliberate choice, not only a cost measure.**
It removes any dependency on campus internet connectivity during the viva, which is a common cause
of failed live demonstrations.

**Important constraint:** service workers and the Web Push API require a *secure context* — HTTPS,
or `localhost`. A plain-HTTP LAN address will silently fail to register push. This is resolved by
the Cloudflare Tunnel (which terminates HTTPS), and the Telegram channel provides a fallback that
has no such requirement. This must be validated in Phase P1, not discovered during P8.

---

## 13. Software Stack (Committed)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Edge vision | Python, OpenCV, Ultralytics YOLO (nano), ONNX Runtime | Mature, Pi-deployable, pretrained person detection available |
| IoT firmware | C++ / Arduino framework on ESP32 | Standard, well-documented, adequate for the sensor set |
| Messaging | MQTT via Eclipse Mosquitto | Lightweight, topic-based, standard for IoT telemetry |
| Backend | Python + FastAPI | Async, automatic OpenAPI docs, shares the language of the vision code |
| Database | PostgreSQL 16 | Relational integrity for ticket state; time-series-capable; JSONB for flexible observation payloads |
| Web client | React 18 + Vite + TypeScript | Fast build tooling, large ecosystem, no mobile-specific toolchain required |
| Styling | Tailwind CSS | Rapid UI construction without writing a design system |
| Charts | Recharts | Energy consumption and historical trend views |
| PWA layer | `vite-plugin-pwa` (Workbox) | Service worker, installability, offline application shell |
| Offline queue | IndexedDB (`idb`) | Staff can update ticket status where signal is poor; writes sync on reconnect |
| Push notifications | Web Push API with VAPID keys; `pywebpush` server-side | Standards-based, self-hosted, no vendor account, no cost |
| Redundant notification | Telegram Bot API | Guarantees delivery on any phone regardless of browser push support |
| Authentication | JWT access/refresh tokens, bcrypt password hashing | Self-contained; no external identity provider |
| Deployment | Docker Compose on a laboratory PC; Cloudflare Tunnel for HTTPS | Reproducible, demonstrable offline, zero hosting cost (§12.3) |

**One choice per layer.** Version 1 listed four databases and three mobile frameworks; that
optionality was a planning artefact and has been resolved here.

### 13.1 Justification for a Web Application Rather Than a Native Application

Objective C9 requires supervisors and maintenance staff to access the system from their phones. An
installable Progressive Web App satisfies this while being materially cheaper to build:

1. **It presents as a phone application.** Once installed to the home screen it has its own icon and
   splash screen, launches full-screen without browser chrome, works offline through its service
   worker, and receives push notifications. The user-visible characteristics that define "an app"
   are all present.
2. **One codebase serves two genuinely different form factors.** Maintenance staff use a phone in
   the field; the supervisor reviews dashboards and verifies repairs at a desk. A native Android
   application would have served the second case poorly, or required a second web client anyway.
3. **The calibration ROI editor (§6.1) demands a large canvas and precise pointer input.** It is
   substantially better on a desktop browser and would have been awkward to build in a phone-first
   native framework — or would have needed to be written twice.
4. **It removes an entire toolchain.** No Android Studio, Dart, Gradle, emulator images, or APK
   signing. The team already works in Python and JavaScript, so no new language is introduced.
5. **Distribution is trivial.** Installing on an evaluator's phone during the demonstration is
   opening a URL and tapping "Add to Home Screen" — no sideloading, no store submission.
6. **Development time saved is redirected to the reliability work** in §7, which is the project's
   actual contribution.

**Limitations, stated honestly:**

- **iOS push is constrained.** Safari supports Web Push only on iOS 16.4 or later, and only when the
  app has been installed to the home screen. The Telegram channel exists specifically to cover this
  gap, and Android Chrome — what the maintenance staff will realistically use — has full support
  including delivery when the browser is closed.
- **HTTPS is mandatory** for service workers and push (§12.3). Addressed by Cloudflare Tunnel and
  validated in Phase P1.
- **No native background services or device sensors.** Neither is required: the client is a thin
  view over the REST API, and all sensing happens on the edge device and the ESP32 node.

---

## 14. Data Model

### 14.1 Core Tables

```sql
classrooms(
  id, room_no, building, floor, seat_capacity,
  light_count, fan_count, active_calibration_id, created_at)

calibrations(
  id, classroom_id, version, reference_image_path,
  regions_json,          -- seat / board / fan polygons
  created_by, created_at, is_active)

observations(               -- raw, high volume, partitioned by date
  id, classroom_id, source,        -- 'vision' | 'sensor'
  detector,                        -- 'occupancy' | 'board' | 'fan_rotation' | 'electrical'
  target_id,                       -- 'fan_03', 'board_main', NULL
  state, confidence, payload_jsonb, observed_at)

confirmed_events(           -- output of the §7 confirmation engine
  id, classroom_id, issue_type, target_id, severity,
  first_observed_at, confirmed_at, cleared_at,
  supporting_observation_ids, evidence_image_path)

tickets(
  id, classroom_id, event_id, signature,
  category, priority, status, title, description,
  assigned_to, assigned_at, sla_due_at,
  resolved_at, resolved_by, verified_at, verified_by,
  closed_at, recurrence_count, created_at)

ticket_transitions(
  id, ticket_id, from_status, to_status,
  actor_id, note, created_at)

users(
  id, name, role,          -- supervisor | electrical | housekeeping | furniture | admin
  phone, email, telegram_chat_id, is_active)

push_subscriptions(         -- one row per installed browser/device per user
  id, user_id, endpoint, p256dh_key, auth_key,
  user_agent, created_at, last_success_at, failure_count)

energy_readings(            -- time series, partitioned by date
  id, classroom_id, voltage, current, active_power,
  power_factor, energy_kwh, recorded_at)

health_scores(
  id, classroom_id, score, component_breakdown_jsonb, computed_at)
```

`signature` on `tickets` carries a partial unique index over open statuses, so de-duplication (§7.2)
is enforced by the database and not only by application logic.

### 14.2 MQTT Topic Design

```
classroom/{room}/vision/occupancy       → {total, occupied, empty, ts}
classroom/{room}/vision/board           → {ink_ratio, state, ts}
classroom/{room}/vision/fan/{n}         → {rotating, motion_score, ts}
classroom/{room}/sensor/electrical      → {voltage, current, power, pf, energy, ts}
classroom/{room}/sensor/environment     → {temp, humidity, lux, ts}
classroom/{room}/node/status            → {device, uptime, rssi, fw_version, ts}   [retained]
server/{room}/command                   → {action, params}                          [demo panel only]
```

Node status uses MQTT retained messages plus a last-will-and-testament so the server detects an
offline node rather than silently showing stale data — an important operational detail that also
demonstrates correct use of the protocol.

---

## 15. Development Plan

**Assumption:** two-semester final-year project, August 2026 – April 2027. Phase I review at the end
of November 2026; final submission in April 2027. Dates are adjusted if the institutional calendar
differs.

| Phase | Work | Dates |
|-------|------|-------|
| **P0** | Institutional approval (camera installation, data policy, electrical supervision), classroom site survey, camera placement trial | 14 Aug – 5 Sep 2026 |
| **P1** | Requirements freeze, architecture finalisation, component procurement; **connectivity spike** — verify MQTT works on campus Wi-Fi and that the HTTPS/Web Push path registers on a real phone | 20 Aug – 12 Sep 2026 |
| **P2** | Calibration ROI editor (canvas screen in the web client), reference image capture, baseline data collection | 6 Sep – 10 Oct 2026 |
| **P3** | Vision pipeline: occupancy, board ink-ratio; edge deployment on the Pi | 20 Sep – 7 Nov 2026 |
| **P4** | Demo panel construction (supervised), ESP32 firmware, sensor calibration, MQTT publishing | 1 Oct – 14 Nov 2026 |
| **P5** | Backend: schema, ingestion, confirmation engine (§7), ticket lifecycle, REST API | 15 Oct – 28 Nov 2026 |
| **— ** | **Phase I review — working edge + backend, tickets generated, CLI/web verification** | **late Nov 2026** |
| **P6** | Web client (PWA): auth, supervisor dashboard, classroom detail, ticket screens, staff views, service worker, Web Push + Telegram | 5 Dec 2026 – 30 Jan 2027 |
| **P7** | Full system integration, health score, energy analytics, extended objectives if time permits | 31 Jan – 13 Mar 2027 |
| **P8** | Testing (§16), multi-day continuous run, false-ticket measurement, tuning | 14 Mar – 3 Apr 2027 |
| **P9** | Report, research paper draft, demonstration rehearsal, final submission | 4 Apr – 25 Apr 2027 |

**Sequencing rationale:** the backend confirmation engine (P5) is scheduled before the client
(P6) deliberately. The client is the visible deliverable but the least technically risky; building
it early is a common failure mode that leaves the hard reliability work under-tested. A multi-day
continuous run (P8) is scheduled explicitly, because the false-ticket rate cannot be measured in a
one-hour demonstration.

Moving from a native application to a PWA shortens P6 by roughly two weeks. That time is absorbed
into P7, giving integration and the Extended objectives more room — it is **not** reallocated to
additional scope.

### 15.1 Suggested Work Allocation

| Track | Responsibility |
|-------|----------------|
| Vision | Calibration ROI definitions, occupancy, board analysis, edge deployment; fan rotation (E1) and furniture anomaly (E2) in P7 |
| IoT | Demo panel, ESP32 firmware, sensor calibration, MQTT, node reliability |
| Backend | Schema, ingestion, confirmation engine, ticket lifecycle, API, notifications |
| Application | React PWA for both roles, calibration ROI editor, push integration, UI/UX, reports |

Integration is a shared responsibility from P7 onward, with a common API contract frozen at the end
of P5 so tracks can proceed in parallel.

---

## 16. Testing and Evaluation

### 16.1 Functional Test Scenarios

| # | Scenario | Expected Result |
|---|----------|-----------------|
| T1 | Vacant classroom, lights and fan ON for 10+ min | Energy wastage event, Medium priority, routed to supervisor |
| T2 | Fan branch drawing abnormal current | High-priority electrical ticket |
| T2b | *(E1)* Fan powered but blade physically obstructed | High-priority ticket citing rotation failure alongside normal current |
| T3 | Board covered in writing, classroom vacant 10+ min | Low-priority cleaning ticket |
| T4 | Lamp circuit disconnected | Light-not-working ticket |
| T5 | Fault present in a single frame only (transient) | **No ticket** — confirmation window not satisfied |
| T6 | Same fault persisting across 3 hours | Exactly **one** ticket; recurrence counter increments |
| T7 | Board cleaned before staff acts on the ticket | Ticket auto-closes as `AUTO_RESOLVED` |
| T8 | Ticket closed, same fault reappears within 30 min | Suppressed by cooldown |
| T9 | Staff marks Resolved, supervisor rejects | Ticket returns to `REOPENED` |
| T10 | Staff marks Resolved, supervisor verifies | Ticket reaches `CLOSED`, full transition history recorded |
| T11 | Person walks in front of the board during a lecture | Board frame suppressed; no spurious reading |
| T12 | Edge device loses network for 15 minutes | Observations buffered locally and replayed on reconnect |
| T13 | ESP32 node powered off | Server marks node offline via MQTT last-will within 60 s |
| T14 | Lights ON, classroom occupied | **No event** — normal operation correctly ignored |
| T15 | Staff phone offline; staff marks ticket `IN_PROGRESS` | Update queued in IndexedDB, synced on reconnect, no data loss and no duplicate transition |
| T16 | Ticket raised while the staff phone is locked and the browser closed | Web Push delivered to the installed PWA; Telegram message received as the redundant channel |
| T17 | Camera (phone) stops delivering frames | `camera_offline` event raised within two cycles; vision detectors suspended rather than reporting stale state |

Scenarios T5–T8 and T11–T14 test the system's ability to *not* act, which is where most monitoring
systems fail and where most student projects are never evaluated.

### 16.2 Performance Parameters

| Parameter | Target | Measurement Method |
|-----------|--------|--------------------|
| Occupancy count error | MAE ≤ 2 seats | Compared against manual count, 100+ frames across sessions |
| Seat-level occupancy accuracy | ≥ 92 % | Per-ROI ground truth on a held-out labelled set |
| Board state agreement | ≥ 85 % vs. human judgement | 3-class labelling by two independent annotators |
| Light ON/OFF detection | ≥ 98 % | Controlled switching trials |
| Fan rotation detection *(E1, if attempted)* | ≥ 95 % | Controlled stop/start trials, varied lighting |
| **False ticket rate** | **≤ 1 per classroom per day** | 7-day continuous unattended run |
| Missed fault rate | ≤ 5 % | Injected fault trials |
| Detection-to-ticket latency | ≤ 6 min from physical onset | Timestamped fault injection (includes the 5-min confirmation window by design) |
| Ticket-to-notification latency | ≤ 10 s | Server log vs. device receipt timestamp |
| Edge inference time | ≤ 3 s per cycle on Pi 5 | Instrumented timing |
| Data logging completeness | 100 % of confirmed events | Database audit against edge logs |

**Note on targets.** These are design targets to be validated experimentally, not claimed results.
Where a target is not met, the measured value will be reported honestly with analysis of the cause.
No accuracy target is claimed for visible furniture damage classification (E3), for the dataset
reasons stated in §8.7.

**Frames per second is deliberately not a metric.** The system samples once per 30–60 s by design
(§6); reporting FPS would misrepresent the architecture.

---

## 17. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Institutional approval for camera installation is delayed or refused | Blocks all data collection | P0 starts immediately; fallback is a laboratory mock classroom with the team acting as occupants |
| Damaged-furniture dataset cannot be collected | E3 fails | Already de-scoped to Extended with no accuracy claim; E2 anomaly detection does not need it |
| P0 site survey finds ceiling fans outside the camera field of view | E1 not attemptable | Already classified as Extended for exactly this reason; Core fan monitoring via branch current (§8.4) is unaffected |
| Rear-row occlusion degrades occupancy accuracy | Reduced accuracy | Camera height/angle optimised during P0 site survey; limitation quantified and reported |
| Lighting variation breaks board thresholding | Board module unreliable | Adaptive thresholding, plus per-room threshold calibration and a daytime/artificial-light baseline |
| Mains work causes a safety incident | Serious | All work on an isolated, fused, enclosed demo panel under qualified supervision; no classroom mains contact |
| Pi 5 thermal throttling during continuous operation | Missed observation cycles | Active cooler; 30–60 s duty cycle leaves large thermal headroom; monitored during P8 |
| Institutional Wi-Fi blocks MQTT or isolates clients | No telemetry | Test early in P1; fallback to a dedicated local router for the prototype |
| Team over-invests in the client | Core reliability untested | Backend scheduled before client; Phase I review gate requires working ticket generation without a UI |
| Web Push fails to register (no HTTPS, or iOS restrictions) | Notification objective C8 unmet | Connectivity spike in P1 validates the full push path on a real phone; Telegram bot provides an independent channel with no HTTPS or browser dependency |
| Phone-as-camera sleeps, overheats or the IP-camera app is killed by the OS | Vision pipeline stalls | Keep the phone on mains power with screen-timeout disabled and battery optimisation off for the app; the edge device raises a `camera_offline` event if no frame is retrieved for two consecutive cycles; a ₹800 USB webcam is the budgeted fallback (§12.1 contingency) |
| Institute IoT laboratory cannot lend a Raspberry Pi | ₹4,700 unbudgeted | Development proceeds on a team laptop, which is a valid edge device for the prototype; Pi purchase is listed as contingency and decided at P1, not at P8 |
| Scope creep back toward v1 | Nothing finishes | Non-goals in §5.3 are binding; Extended objectives start only after Core is stable |

---

## 18. Novelty and Contribution

The contribution is not object detection in a classroom, which is well established. It is:

1. **Reliability engineering for automated ticketing.** An explicit confirmation, de-duplication and
   cooldown mechanism (§7), with the resulting false-alarm rate measured over a multi-day unattended
   run and reported as a primary result alongside detection accuracy (§16.2). Comparable systems
   report how well they detect; this one also reports how rarely it cries wolf.
2. **Context-aware, cross-modal rule evaluation.** No rule thresholds a single sensor. Writing on a
   board during a lecture is normal; the same board with the room vacant for ten minutes is a
   cleaning task. Power drawn in an occupied room is normal; the same power in a confirmed-vacant
   room is waste. Every rule consumes a vision signal *and* a sensor signal, which is the operative
   justification for combining the two modalities.
3. **A complete, auditable detection-to-closure workflow** with enforced separation between the
   staff member who resolves and the supervisor who verifies (§9.3).
4. **Privacy-preserving by architecture, not by policy.** The system has no video streaming or
   storage capability to disable; evidence images are cropped and person-blurred before they are
   ever written (§11).
5. **A composite Classroom Infrastructure Health Score** enabling maintenance prioritisation across
   many rooms at a glance (§10).
6. **Cross-modal mechanical fault diagnosis** *(Extended, E1)* — combining an electrical signal
   (current flowing) with a visual signal (no rotation) to identify a seized fan motor, a fault
   neither modality can diagnose alone (§8.5). Classified as Extended because it depends on camera
   geometry confirmed only at P0; if realised, it is the sharpest illustration of the multimodal
   argument in item 2.

## 19. Expected Outcomes

- A working single-classroom prototype performing automated periodic inspection.
- Automatic generation of correctly classified, prioritised and routed maintenance tickets.
- An installable web application (PWA) serving both supervisor and maintenance-staff roles on phone
  and desktop, with push notifications.
- Measured detection accuracy **and** measured operational false-alarm rate.
- Demonstrated energy-wastage detection with quantified estimated wastage.
- A complete digital audit trail from detection to verified closure.
- A dataset, calibration tooling and codebase that extends to additional classrooms without retraining.

## 20. Final Demonstration

A single instrumented classroom (or laboratory mock-up) with camera, Raspberry Pi, ESP32 node and
demonstration panel. The live demonstration will:

1. Show the supervisor dashboard with live classroom status and health score — projected from a
   laptop browser, and simultaneously on a phone with the PWA installed to the home screen.
2. Disconnect the fan branch → show the High-priority electrical ticket appearing after
   confirmation, with the evidence image and the current trace attached.
   *(If E1 was realised: instead physically obstruct the blade, and show the ticket citing normal
   current alongside absent rotation — a fault diagnosable only by combining both modalities.)*
3. Show that a momentary obstruction produces **no** ticket (the confirmation window working).
4. Show the ticket assigned and notified to the electrical staff account on a second phone — as a
   Web Push notification on the installed PWA, and as a Telegram message.
5. Staff device updates `IN_PROGRESS → RESOLVED`; supervisor verifies and closes.
6. Show the complete transition history and the updated health score.
7. Show the board-cleaning and energy-wastage flows.
8. Show the 7-day continuous-run statistics: events detected, tickets raised, false tickets.

Step 3 and step 8 are given equal weight to the detection demonstration, because reliability is the
claimed contribution.

## 21. Future Scope

- Non-intrusive load monitoring (NILM) for per-fan fault isolation on a shared circuit.
- Predictive maintenance from historical current-signature drift.
- Automated load switching subject to institutional and safety approval.
- Multi-building centralised monitoring and campus-level energy analytics.
- Integration with institutional ERP and Building Management Systems.
- QR/NFC-based on-site maintenance verification.
- Digital twin of the building.

## 22. Conclusion

The revised system combines edge computer vision, IoT sensing and a digital maintenance workflow
into a single platform for automated classroom infrastructure monitoring. Version 2 preserves the
complete Detect → Confirm → Ticket → Assign → Notify → Repair → Verify → Close vision of the
original proposal, while replacing the highest-risk technical choices with reliable alternatives,
adding the confirmation logic required for the system to be trusted in practice, and committing to a
scope that can be delivered and honestly evaluated within one academic year.

The distinguishing characteristic of this work is that it is engineered to be *trusted*: it is
designed and measured not only on how well it detects problems, but on how rarely it reports
problems that do not exist.
