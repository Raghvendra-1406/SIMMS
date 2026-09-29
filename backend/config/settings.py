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