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
