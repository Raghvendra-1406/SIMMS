# Presentation Script — Review I

**Smart Classroom Infrastructure Monitoring and Maintenance System (SIMMS)**
9 slides · target 11 minutes speaking · 4–6 minutes questions

---

## Speaker allocation

| Slides | Speaker | Section |
|---|---|---|
| 1–3 | Raghvendra | Opening, problem, literature |
| 4–6 | Anuj | Objectives, architecture, detection |
| 7–9 | Prasanna | Reliability, outcomes, conclusion |

Swap freely, but keep the handovers at slide boundaries — the written transitions below sit at slides 4 and 7.

**Before you start:** deck open in presenter view, laptop on the projector, synopsis open on a second device at page 12 (hardware) and page 15 (references) in case a question needs it.

---

## Slide 1 — Title *(30 seconds)*

> Good morning. I am Raghvendra Kotgire, and with me are Anuj Chandak and Prasanna Pawar. Our guide is Dr. Sonawane.
>
> Our project is a Smart Classroom Infrastructure Monitoring and Maintenance System — SIMMS — built using computer vision and IoT.
>
> In one sentence: the system watches a classroom, decides when something is actually wrong, and then carries that problem through to a repair that a supervisor has verified. Not just detection — the full loop.

*Don't read the names off the slide; they can see them. Move on quickly.*

---

## Slide 2 — Motivation and Problem Statement *(75 seconds)*

> Every institution, including ours, runs dozens of classrooms. The lights, fans, boards and furniture in them are inspected manually, and irregularly. That produces three problems.
>
> First, inspection is intermittent. Nobody can watch every room continuously, so a faulty fan can stay faulty for days before anyone reports it.
>
> Second, reporting is informal — someone tells someone, or writes it in a register. There is no reliable record of when it was raised, who it went to, or whether it was fixed.
>
> Third, and this follows from the second: there is no accountability trail. Because resolution is never recorded, recurring faults stay invisible, and preventive maintenance cannot be planned.

*Pause. Point at the amber bar.*

> Now, the important observation. Existing systems already detect things. Sensor systems put readings on a dashboard that nobody is obliged to act on. Vision systems detect objects but connect the detection to no particular person. So the gap is not detection capability — it is the absence of a closed loop from observation to verified repair.
>
> That loop is what we are building: observe, confirm, classify, ticket, assign, notify, repair, verify, close. Every stage on that line is something the system does automatically, except the repair itself.

---

## Slide 3 — Literature Survey and Research Gap *(90 seconds)*

> We reviewed fourteen papers. Seven of them are the closest existing classroom and building systems — those are in the table.

*Don't read the table row by row. Pick three.*

> Muzayanah and colleagues use OpenCV face detection for attendance, with an alert if a student is absent for a fixed time. It works, but it is vision only — a detection is never checked against any other signal.
>
> Niveditha and colleagues do the opposite: PIR, LDR and temperature sensors switching lights and fans. Also works, but on fixed thresholds, with no visual context — so it cannot tell a genuinely empty room from one with a student sitting still.
>
> Kumar and colleagues are the closest to our thinking. They fuse PIR, ultrasonic and camera data with probabilistic confirmation before raising an alert — but that is railway obstruction detection, and it ends at an alert.
>
> The remaining seven references are the enabling work — edge computing, YOLOv7, CNN defect detection, machine learning for predictive maintenance, and the MQTT protocol comparison that justifies our transport choice.

*Point right.*

> Three gaps come out of this. Modalities are not fused for the actual decision — sensor data is usually shown alongside vision output, not combined into one rule. Detection is not connected to resolution — detection papers end at an accuracy figure, and maintenance systems begin at manual data entry. And false-alarm behaviour is not reported — papers report mAP on curated test sets, almost never how many spurious alerts the system raises when left running unattended.
>
> Our project addresses all three.

---

## Handover to Anuj

> Anuj will now take you through what we are actually building.

---

## Slide 4 — Aim, Objectives and Scope *(60 seconds)*

> Thank you. Our aim is to detect classroom infrastructure and electrical faults using edge-based computer vision and IoT sensing, and to manage every confirmed fault through a digital workflow to supervisor-verified closure.
>
> We have eleven committed objectives. They fall into three groups: sensing — periodic capture, seat-level occupancy, board condition, light and fan status, energy wastage; reliability — confirming and de-duplicating detections before a ticket is raised; and management — classifying, prioritising, assigning, notifying, and keeping a queryable history.
>
> Six further objectives are extended — fan rotation verification, furniture anomaly detection, analytics — and we will attempt them only once the core is stable. We would rather deliver eleven objectives well than seventeen partially.

*Point at the non-goals box. This pre-empts the privacy question.*

> The non-goals matter as much. No facial recognition and no identification of any student. No continuous recording, no streaming, no cloud upload of frames. This is not an attendance system — occupancy is a count, never attributed to a person. And we do not switch live classroom loads; relay control is demonstrated only on an isolated panel.

---

## Slide 5 — System Architecture *(105 seconds)*

> The system has three parts.
>
> Inside the classroom, a fixed camera and a Raspberry Pi 4. The Pi captures one frame every thirty to sixty seconds and analyses it locally — person detection, seat-level occupancy over calibrated regions, and board ink-ratio analysis. Alongside it, an ESP32 node samples every five seconds using a PZEM-004T energy module and a current-transformer clamp, giving voltage, current, power, power factor and energy.
>
> Both publish over MQTT to the server — and this is the important part — **only derived JSON observations**. No image and no video ever leaves the classroom. There is no streaming capability anywhere in the system.
>
> The backend is FastAPI with PostgreSQL. It ingests and persists observations, runs the confirmation and de-duplication engine, applies the rule engine, manages the ticket lifecycle and assignment, computes the health score, and pushes notifications.
>
> The client is a React progressive web app with three roles: supervisors see the dashboard and verify repairs, maintenance staff see their assigned tickets, and an admin does the one-time classroom calibration.

*Point at the amber bar. Say this clearly — it is the design decision examiners test.*

> One decision underpins all of it. We inspect periodically; we do not process real-time video. Classroom infrastructure changes over minutes and hours, not milliseconds. Sampling once a minute keeps the Pi under seven percent duty cycle, removes any need for a GPU, and makes the privacy position defensible, because a continuous video stream does not exist to begin with.

---

## Slide 6 — Detection Modules *(90 seconds)*

> Four detection modules, and each was chosen to reduce risk.
>
> Occupancy uses a pretrained YOLO model, person class only, tested against the seat regions marked during calibration. Because seat geometry comes from calibration, we do not train a seat detector at all — that removes the largest annotation workload in the project.
>
> Board condition is deliberately not a learning problem. We perspective-warp the board region, apply adaptive thresholding and morphological opening, and compute the ratio of ink pixels. It is a measurement. It is explainable to a supervisor, it runs in milliseconds, and it can be tuned on site without retraining anything.
>
> Electrical status comes from the PZEM module and the clamp. Expected current bands are learned during commissioning rather than hard-coded, so the system adapts to whatever loads are actually installed.
>
> Energy wastage is the rule that needs both: occupancy zero for at least ten continuous minutes, **and** measured load above threshold.

*Pause on the bottom card.*

> That last rule is the operative idea of the whole project. A board covered in writing during a lecture is completely normal and raises nothing. The same board, with the room confirmed vacant for ten minutes, becomes a cleaning task. Occupancy gives context to board state, and occupancy gives context to electrical load. No rule in this system thresholds a single sensor — that is why we need both modalities rather than either one alone.

---

## Handover to Prasanna

> Prasanna will explain how we stop the system from crying wolf.

---

## Slide 7 — Confirmation, De-duplication and Ticket Lifecycle *(120 seconds)*

> Thank you. This slide is the core of our reliability work, and it starts from a claim: a raw detection is not an event, and an event is not a ticket.
>
> First, temporal confirmation. Every detector emits an observation with a state and a confidence. We keep a sliding window of the last five observations for each classroom, detector and target. Four out of five must agree before we call it a fault — but only three out of five to clear it. Those thresholds are deliberately asymmetric: the system is slower to raise a problem than to drop one, which biases it against false tickets. Observations below 0.55 confidence do not get a vote.
>
> Second, de-duplication. Every confirmed fault reduces to a signature — classroom, issue type, target, calibration version. If an open ticket already carries that signature, we do not create a second one. We increment a recurrence counter, append the evidence, and escalate priority if it keeps recurring. Without this, one broken fan would generate forty tickets in a day.
>
> Third, cooldown. After a ticket closes, its signature is suppressed for thirty minutes, so it cannot reopen while the technician is still standing there. And if a fault clears before anyone acts on it — a lecturer cleans the board before housekeeping arrives — the ticket auto-closes as AUTO_RESOLVED.

*Move to the lifecycle strip.*

> The ticket then moves through six states: new, assigned, in progress, resolved, verified, closed. Two branches leave that path — reopened, if the supervisor rejects the repair, and auto-resolved, as I described.
>
> One rule makes the whole thing worth having: **staff cannot close their own tickets.** Moving from resolved to verified requires a supervisor. That single separation is what turns a log into an accountability trail.
>
> Routing is by category, each with its own service level — electrical faults to electrical maintenance within two to eight hours, cleaning to housekeeping within a day, and so on.

---

## Slide 8 — Expected Outcomes and Performance Targets *(75 seconds)*

> These are our targets. Seat-level occupancy accuracy of at least ninety-two percent, board state agreement of at least eighty-five percent against two independent human annotators, detection to ticket within six minutes, edge inference within three seconds per cycle.
>
> The one we consider most important is on the left: at most one false ticket per classroom per day, measured over a seven-day continuous unattended run. We chose that as a headline result because of the third research gap. An automated ticketing system does not fail by missing faults — it fails by raising false ones, after which the staff stop trusting it and go back to the register.

*Be explicit about this next sentence; it protects you later.*

> We want to be clear that these are design targets to be validated experimentally, not results we are claiming. Where we miss a target, we will report the measured value along with an analysis of why.
>
> On cost: the prototype comes to roughly five and a half thousand rupees, because the Raspberry Pi is borrowed from the IoT lab and the camera is a spare phone. Hosting is nil — the whole stack runs on one machine on the college LAN, which also means the demonstration does not depend on campus internet.

---

## Slide 9 — Conclusion *(45 seconds)*

> To conclude, two contributions.
>
> First, every decision rule in this system fuses a vision signal with a sensor signal. Occupancy gives context to board state and to electrical load, so the system can separate legitimate use from a genuine fault in a way that neither modality manages alone.
>
> Second, the system is engineered and evaluated to be trusted — through explicit confirmation, de-duplication and cooldown logic, and by reporting how rarely it raises problems that do not exist alongside how well it detects the ones that do.
>
> Detecting objects in a classroom is well established, and that is not our claim. Our contribution is the closed loop, and the evidence that the loop can be trusted.
>
> Thank you. We are happy to take questions.

---

## Anticipated questions

**Why do you need both a camera and sensors? Wouldn't one do?**
Neither alone can distinguish waste from legitimate use. Power drawn in an occupied room is normal; the same power in a vacant room is waste — you need occupancy and load together. Same with the board: writing during a lecture is normal, the same writing in an empty room is a cleaning task.

**Isn't this a privacy problem — you are putting cameras on students?**
Frames are analysed in memory on the Pi and discarded; only JSON observations leave the room, and the system has no streaming capability at all. Evidence images are captured only on a confirmed fault, cropped to the region, with every detected person region irreversibly blurred before the file is written, and deleted after thirty days. There is no facial recognition, no biometrics, no audio. We obtain written permission from the HOD and administration before installation and display signage in the room.

**Why one frame a minute? Why not real-time?**
Because nothing we are measuring changes in under a minute. A higher frame rate would need a GPU, would generate a continuous video stream we do not want to exist, and would buy us nothing. We deliberately exclude frames per second as a metric for the same reason.

**YOLO is off the shelf. What is actually novel here?**
We agree that person detection is a solved problem, and that is exactly why we use a pretrained model rather than training one. The contribution is the fusion rules, the confirmation logic that decides what becomes a ticket, and spanning detection all the way to verified closure — which no reviewed system does.

**How will you actually measure the false-ticket rate?**
By leaving the system running unattended for seven days on a real classroom, logging every ticket it raises, and manually classifying each as genuine or spurious. That cannot be measured in a one-hour demonstration, which is why phase P8 in our plan schedules it explicitly.

**What happens if the furniture is rearranged or the camera moves?**
Calibrations are versioned. A rearrangement means a new calibration version, and older observations stay interpretable against the version they were recorded under. Re-calibration is a few minutes of drawing regions on a reference image — no retraining.

**What about lighting changes, or evening classes?**
Board analysis uses adaptive thresholding rather than a fixed one, which handles gradual illumination change. The LDR gives an independent read on the lighting state as a cross-check. Extreme cases — a dark room with lights off — are a known limitation, and the confirmation window prevents a transient bad frame from raising a ticket.

**How does this scale to fifty classrooms?**
The backend and database are already multi-classroom; every observation is keyed by classroom. The per-room cost is the camera, the ESP32 node and the sensors. The real cost of scaling is calibration time, a few minutes per room, and that is a deliberate trade — that manual step is what removes the machine-learning risk.

**Why a progressive web app rather than an Android app?**
One codebase serves phone and desktop, it installs to the home screen, works offline, and receives push notifications. It also removes an entire toolchain from the project, and we redirected that time into the reliability work. The known limitation is that iOS supports web push only from 16.4 and only when installed — the Telegram channel covers that gap.

**You are working with mains voltage. Is that safe?**
We make no connection to classroom mains wiring at any point. All mains-voltage work is confined to a purpose-built enclosed demonstration panel with a 6 A MCB, fuse protection and earthing, assembled and inspected under qualified supervision.

**Where did the accuracy figures on your literature slide come from?**
Name the specific paper. *Before the review, confirm each figure against the source — you cite 95–99 % (Candanedo), 56.8 % AP (YOLOv7) and ~98 % (Cha) on slide 3, and you should be able to say which paper and which table each came from.*

**What if you cannot collect enough data for furniture damage detection?**
We have already scoped that as an extended objective and a proof of concept, not a committed deliverable, and we set no accuracy target for it — precisely because a representative dataset of damaged classroom furniture cannot be collected at the scale a reliable classifier needs.

---

## If you are running short on time

Cut in this order:

1. Slide 3 — describe one paper instead of three, and read the three gaps straight (saves ~30 s)
2. Slide 4 — drop the objective-group breakdown, keep only the aim and the non-goals (saves ~25 s)
3. Slide 8 — drop the cost sentence (saves ~15 s)

Do not cut slides 5, 6 or 7. They are the project.

---

## Rehearsal notes

- Read it aloud twice with a timer before rehearsing with the slides.
- The three transition lines are written for you — say them, don't improvise, or the handover stalls.
- Two places to slow down deliberately: the amber bar on slide 5, and "staff cannot close their own tickets" on slide 7.
- If a question goes beyond what you have prepared, say what you do know and that you will confirm the rest. That reads better than an invented answer.
