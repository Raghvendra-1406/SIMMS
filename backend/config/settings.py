import os

from dotenv import load_dotenv


load_dotenv()


DB_HOST = os.getenv("DB_HOST")

DB_PORT = os.getenv("DB_PORT")

DB_NAME = os.getenv("DB_NAME")

DB_USER = os.getenv("DB_USER")

DB_PASSWORD = os.getenv("DB_PASSWORD")

# Full connection string (e.g. from Neon). When set, it is
# used instead of the separate DB_* values above.
DATABASE_URL = os.getenv("DATABASE_URL")

# Maximum pooled database connections (API threads + MQTT
# worker + scheduler share the pool).
DB_POOL_MAX = int(
    os.getenv(
        "DB_POOL_MAX",
        "10"
    )
)


MQTT_BROKER_HOST = os.getenv(
    "MQTT_BROKER_HOST",
    "localhost"
)

MQTT_BROKER_PORT = int(
    os.getenv(
        "MQTT_BROKER_PORT",
        "1883"
    )
)

# Optional namespace in front of every topic, e.g. "simms-team1"
# gives "simms-team1/classroom/<room>/sensors". Must match the
# firmware's TOPIC_PREFIX. Empty means plain "classroom/...".
MQTT_TOPIC_PREFIX = os.getenv(
    "MQTT_TOPIC_PREFIX",
    ""
).strip("/")

MQTT_CLIENT_ID = os.getenv(
    "MQTT_CLIENT_ID",
    "simms-backend"
)

# Hosted brokers (e.g. HiveMQ Cloud, port 8883) need TLS and a
# username / password. Local Mosquitto needs neither.
MQTT_USERNAME = os.getenv("MQTT_USERNAME") or None
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD") or None
MQTT_TLS = os.getenv("MQTT_TLS", "").lower() in {"1", "true", "yes"}


JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

JWT_ALGORITHM = os.getenv(
    "JWT_ALGORITHM",
    "HS256"
)

JWT_EXPIRE_MINUTES = int(
    os.getenv(
        "JWT_EXPIRE_MINUTES",
        "60"
    )
)


POST_REPAIR_VERIFICATION_HOURS = int(
    os.getenv(
        "POST_REPAIR_VERIFICATION_HOURS",
        "24"
    )
)


# ---------------------------------------------------------
# DETECTION RULES
# ---------------------------------------------------------

# Minutes a room must be continuously vacant before lights left on
# or a written board count as a fault (Plan v2 §8.3 / §8.6).
# Use a small value (e.g. 1) for simulation runs.
VACANCY_MINUTES = float(
    os.getenv(
        "VACANCY_MINUTES",
        "10"
    )
)

# Observations below this confidence are stored but do not
# vote in the confirmation window (Plan v2 §7.1).
MIN_VOTE_CONFIDENCE = float(
    os.getenv(
        "MIN_VOTE_CONFIDENCE",
        "0.55"
    )
)

# After a ticket closes, the same fault is suppressed for this
# long (Plan v2 §7.3). Use a small value (e.g. 2) for simulation.
COOLDOWN_MINUTES = float(
    os.getenv(
        "COOLDOWN_MINUTES",
        "30"
    )
)


# ---------------------------------------------------------
# BACKGROUND JOBS
# ---------------------------------------------------------

# A node with no status or data message for this long is marked
# OFFLINE even if its last-will message never arrived.
NODE_OFFLINE_SECONDS = int(
    os.getenv(
        "NODE_OFFLINE_SECONDS",
        "90"
    )
)

# How often classroom health scores are recalculated.
HEALTH_INTERVAL_SECONDS = int(
    os.getenv(
        "HEALTH_INTERVAL_SECONDS",
        "60"
    )
)


# ---------------------------------------------------------
# CIRCUIT MONITORING
#
# Electrical sensing is per circuit, not per appliance: one meter on
# the lights circuit, one on the fans circuit, optionally one on the
# main supply. How many units are powered is derived from circuit
# current / per-unit current; which unit is faulty comes from the
# camera (Plan v2 §8.5).
# ---------------------------------------------------------

# Per-unit current used until a baseline is learned for the room
# (admin: Classroom details -> Circuits -> Learn).
DEFAULT_FAN_CURRENT_A = float(os.getenv("DEFAULT_FAN_CURRENT_A", "0.30"))
DEFAULT_LIGHT_CURRENT_A = float(os.getenv("DEFAULT_LIGHT_CURRENT_A", "0.10"))

# A circuit is overloaded above
#   all units x unit current x OVERLOAD_FACTOR + standby + OVERLOAD_MARGIN_A
CIRCUIT_OVERLOAD_FACTOR = float(os.getenv("CIRCUIT_OVERLOAD_FACTOR", "1.25"))
CIRCUIT_OVERLOAD_MARGIN_A = float(os.getenv("CIRCUIT_OVERLOAD_MARGIN_A", "0.5"))

# Main supply limits (classroom breaker rating).
MAIN_CURRENT_MAX_A = float(os.getenv("MAIN_CURRENT_MAX_A", "32"))

VOLTAGE_MIN_V = float(os.getenv("VOLTAGE_MIN_V", "200"))
VOLTAGE_MAX_V = float(os.getenv("VOLTAGE_MAX_V", "250"))

# Power factor is only judged when the load is large enough to matter.
POWER_FACTOR_MIN = float(os.getenv("POWER_FACTOR_MIN", "0.5"))
POWER_FACTOR_MIN_CURRENT_A = float(os.getenv("POWER_FACTOR_MIN_CURRENT_A", "1.0"))


# ---------------------------------------------------------
# TICKET ROUTING AND SLA (Plan v2 §9)
#
# Response SLA per priority: staff must start work (or resolve) a
# ticket within this many hours of it being raised or reopened.
# HIGH and MEDIUM breaches notify supervisors and the assignee;
# LOW breaches are only flagged as overdue.
# Fractions work, e.g. 0.05 (3 minutes) for a live demo.
# ---------------------------------------------------------

SLA_HOURS = {
    "HIGH": float(os.getenv("SLA_HOURS_HIGH", "2")),
    "MEDIUM": float(os.getenv("SLA_HOURS_MEDIUM", "8")),
    "LOW": float(os.getenv("SLA_HOURS_LOW", "24")),
}

SLA_CHECK_INTERVAL_SECONDS = int(os.getenv("SLA_CHECK_INTERVAL_SECONDS", "60"))


# ---------------------------------------------------------
# BUFFERED READINGS (Plan v2 §16 T12)
#
# Nodes keep readings while offline and replay them on reconnect.
# A reading older than this is stored (history, completeness) but
# does not vote in fault confirmation: stale data must not raise or
# clear tickets after the fact.
# ---------------------------------------------------------

LIVE_READING_MAX_AGE_SECONDS = int(os.getenv("LIVE_READING_MAX_AGE_SECONDS", "90"))

# A sensor node or camera offline this long raises DEVICE_OFFLINE.
DEVICE_OFFLINE_FAULT_MINUTES = float(os.getenv("DEVICE_OFFLINE_FAULT_MINUTES", "5"))


# ---------------------------------------------------------
# ENERGY REPORT (Plan v2 C5: energy wasted in empty rooms)
#
# Tariff and grid emission factor turn kWh into money and CO2.
# Defaults: a typical Indian institutional tariff and the CEA grid
# emission factor (~0.71 kg CO2 / kWh); set your own in .env.
# ---------------------------------------------------------

TARIFF_PER_KWH = float(os.getenv("TARIFF_PER_KWH", "8.0"))
CURRENCY_SYMBOL = os.getenv("CURRENCY_SYMBOL", "₹")
GRID_EMISSION_KG_PER_KWH = float(os.getenv("GRID_EMISSION_KG_PER_KWH", "0.71"))

# Meter readings further apart than this are a gap (node offline):
# the time between them is not integrated, it is reported as unknown.
ENERGY_MAX_GAP_SECONDS = int(os.getenv("ENERGY_MAX_GAP_SECONDS", "120"))

# An occupancy count older than this no longer tells whether the room
# is in use (camera offline): that energy counts as unknown.
OCCUPANCY_MAX_AGE_MINUTES = float(os.getenv("OCCUPANCY_MAX_AGE_MINUTES", "5"))


# ---------------------------------------------------------
# WEB PUSH (Plan v2 C8, T16)
#
# Generate a key pair once with:  python -m scripts.generate_vapid_keys
# Empty keys disable push (in-app notifications still work).
# VAPID_SUBJECT is a contact for the push services (mailto: or https:).
# ---------------------------------------------------------

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@simms.local").strip()


# ---------------------------------------------------------
# DEPLOYMENT
# ---------------------------------------------------------

# Browser origins allowed to call the API, comma separated,
# e.g. "https://simms.vercel.app,http://localhost:5173".
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

# Optional regex for extra origins, e.g. Vercel preview deployments:
# "https://simms-frontend-.*\.vercel\.app"
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX") or None
