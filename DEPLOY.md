# Deploying SIMMS (free tier)

```
 ESP32 / Wokwi / Pi camera ──MQTT over TLS──► HiveMQ Cloud (broker)
                                                   ▲
                                                   │ MQTT over TLS
                           Vercel (dashboard) ──HTTPS──► Render (FastAPI backend) ──► Neon (PostgreSQL)
                                                   ▲
                                 UptimeRobot pings /health every 5 min
```

| Piece | Service | Free tier (check the provider's current limits) |
|---|---|---|
| Dashboard (React) | **Vercel** | Hobby plan |
| Backend (FastAPI + MQTT subscriber + scheduler) | **Render** web service | Free: 512 MB RAM, sleeps after 15 min without HTTP traffic, 750 h/month |
| MQTT broker | **HiveMQ Cloud Serverless** | 100 connections, 10 GB/month, TLS on 8883 |
| Database | **Neon** | Already in use |
| Keep-awake pings | **UptimeRobot** | 5-minute HTTP monitor |

**Why these services:**
- The backend must run all the time: the MQTT subscriber, the scheduler and the in-memory confirmation windows. Render runs it as a normal process. Serverless platforms such as Vercel functions can't.
- The UptimeRobot ping stops Render's free instance from sleeping. One service running around the clock uses about 744 of the 750 free hours a month.

Deploys are automated by `.github/workflows/deploy.yml`:
- every PR and push runs checks: frontend build, backend imports, firmware builds;
- **pushes to `main`** deploy the dashboard to Vercel (production) and trigger the Render deploy;
- PRs get a Vercel preview URL.

---

## 1. MQTT broker: HiveMQ Cloud

1. Sign up at <https://www.hivemq.com/mqtt/public-mqtt-broker/> → **HiveMQ Cloud** → create a **Serverless** (free) cluster.
2. **Access Management → Credentials:** create a username and password with *Publish and Subscribe* permission. One set for the backend and one for devices is fine; a single set also works.
3. Note the **cluster URL** (e.g. `abc123.s1.eu.hivemq.cloud`). The port is **8883** (TLS).

## 2. Database: Neon

It's already set up. Apply any migrations the database doesn't have yet (safe to re-run):

```powershell
psql "<DATABASE_URL>" -f backend/database/migrations/001_node_status.sql
psql "<DATABASE_URL>" -f backend/database/migrations/002_ticket_reliability.sql
psql "<DATABASE_URL>" -f backend/database/migrations/004_calibration_images.sql
```

For a brand-new database, run `backend/database/schema.sql` instead.

## 3. Backend: Render

1. Push this repository to GitHub, including `render.yaml`.
2. On <https://dashboard.render.com>: **New → Blueprint →** select the repo. Render reads `render.yaml` and creates **simms-backend** (free, Singapore region).
3. Fill in the secrets it asks for:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string (the **pooled** one, host containing `-pooler`, is fine here) |
   | `MQTT_BROKER_HOST` | HiveMQ cluster URL |
   | `MQTT_USERNAME` / `MQTT_PASSWORD` | HiveMQ credentials |
   | `CORS_ORIGINS` | Your Vercel URL, e.g. `https://simms-frontend.vercel.app` (add more, comma separated) |
   | `CORS_ORIGIN_REGEX` | Optional, for PR previews: `https://simms-frontend-.*\.vercel\.app` |

   `JWT_SECRET_KEY` is generated automatically. The detection settings default to the plan's values. For quick demos, set `VACANCY_MINUTES=1` and `COOLDOWN_MINUTES=2`.
4. After the first deploy, open `https://<service>.onrender.com/health`. It should return `{"status":"healthy"}`.

   The **Logs** tab should show:
   ```
   [mqtt] Connected to <cluster>:8883, subscribed to classroom/+/sensors, …
   ```
5. **Settings → Deploy Hook:** copy the URL; it becomes the `RENDER_DEPLOY_HOOK_URL` secret in step 5.
6. Create the first admin, once, from your PC with the Neon `DATABASE_URL` in `backend/.env`:

   ```powershell
   cd backend
   python -c "from services.auth_service import register_user; register_user('Admin', 'admin@simms.com', 'ChangeMe123', 'ADMIN')"
   python -m scripts.seed_demo
   ```

## 4. Dashboard: Vercel

1. On <https://vercel.com/new>, import the repository.
2. **Root Directory:** `frontend`. Framework: Vite, detected automatically; `frontend/vercel.json` sets the build and the page-refresh rewrite.
3. **Environment Variables:** `VITE_API_BASE_URL` = `https://<service>.onrender.com`, for **Production** and **Preview**.
4. Get the IDs for GitHub by installing the Vercel CLI once and linking the project from the repo root:

   ```powershell
   npm install --global vercel
   vercel login
   vercel link          # choose the project you just created
   type .vercel\project.json
   ```

   Copy `orgId` and `projectId`. `.vercel/` is git-ignored.
5. Turn off Vercel's own Git auto-deploys so the workflow is the only deployer: **Project → Settings → Git → Ignored Build Step**: `exit 0`. Or leave them on and delete the `deploy-frontend` job from the workflow.
6. Back on Render, make sure `CORS_ORIGINS` contains the final Vercel production URL.

## 5. GitHub secrets

**Repository → Settings → Secrets and variables → Actions → New repository secret:**

| Secret | Where from |
|---|---|
| `VERCEL_TOKEN` | vercel.com → Account Settings → **Tokens** → Create |
| `VERCEL_ORG_ID` | `orgId` in `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `projectId` in `.vercel/project.json` |
| `RENDER_DEPLOY_HOOK_URL` | Render → simms-backend → Settings → Deploy Hook |

Push to `main`; the **Actions** tab shows the checks, then both deploys.

## 6. Keep the backend awake: UptimeRobot

On <https://uptimerobot.com>: **Add New Monitor**:
- **type:** HTTP(s);
- **URL:** `https://<service>.onrender.com/health`;
- **interval:** 5 minutes.

Without it, Render's free instance sleeps after 15 minutes without HTTP traffic. That also stops the MQTT subscriber, and readings sent during that time are lost.

## 7. Point the devices at the cloud broker

**Wokwi / ESP32** (`firmware/simms_node/src/config.h`):

```c
#define MQTT_HOST "abc123.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_USE_TLS 1
#define MQTT_USERNAME "your-hivemq-user"
#define MQTT_PASSWORD "your-hivemq-password"
```

- Rebuild with `pio run -e sim` and restart the simulator.
- The simulation now works from **browser Wokwi** too (wokwi.com), since the broker is on the public internet: no Mosquitto and no private gateway needed.
- Don't commit real passwords. Keep them in your local copy or a git-ignored file.

**Fake node / Pi camera / laptop camera:** set these in their `backend/.env`:

```env
MQTT_BROKER_HOST=abc123.s1.eu.hivemq.cloud
MQTT_BROKER_PORT=8883
MQTT_TLS=1
MQTT_USERNAME=your-hivemq-user
MQTT_PASSWORD=your-hivemq-password
```

## 8. Check it end to end

1. Open the Vercel URL and log in.
2. Start the Wokwi simulation, or run `python -m scripts.fake_node` with the cloud settings.
3. The **Live monitor** shows `esp32-R101` ONLINE within about 10 s.

---

## Limits and trade-offs

- **Render free tier:**
  - About 1 minute cold start after a sleep or a redeploy.
  - A redeploy restarts the backend, which clears the in-memory confirmation windows. They refill within 5 readings.
  - 512 MB RAM is plenty for this backend.
- **One backend instance only.** Don't scale Render beyond 1 instance: the confirmation windows are in memory.
- **Latency:** Render (Singapore) to Neon (Singapore) is a few milliseconds, much faster than running the backend on your PC against Neon.
- **The camera runtime** (YOLO) is not deployed. It runs on the Raspberry Pi or a laptop and only needs the broker and database settings.
- **Security:**
  - Use strong HiveMQ credentials and change the demo passwords (`Admin@123` and so on).
  - Calibration images are served by an unguessable ID without login, because `<img>` tags can't send the token.

## Local development is unchanged

With no MQTT/CORS settings, the backend uses local Mosquitto on `localhost:1883` and allows `localhost:5173`, exactly as in `startup.md`.
