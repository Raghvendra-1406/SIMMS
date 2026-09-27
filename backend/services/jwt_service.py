from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from config.settings import (
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    JWT_EXPIRE_MINUTES,
)


# Checked here rather than in config.settings so that processes
# which never issue tokens (e.g. the Pi vision runtime) can still
# import the shared settings.
if not JWT_SECRET_KEY or not JWT_SECRET_KEY.strip():
    raise RuntimeError(
        "JWT_SECRET_KEY is not set. Add a long random value to "
        "backend/.env, e.g. the output of: "
        "python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )


def create_access_token(user):
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=JWT_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user["user_id"]),
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "exp": expire,
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )


def decode_access_token(token):
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM]
        )

        return payload

    except JWTError:
        return None