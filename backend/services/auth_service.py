import bcrypt

from database.repositories.user_repository import (
    create_user,
    get_user_by_email,
)


ALLOWED_ROLES = {
    "ADMIN",
    "SUPERVISOR",
    "MAINTENANCE_STAFF",
}


def validate_role(role):
    if role not in ALLOWED_ROLES:
        raise ValueError(
            "Invalid role. Allowed roles are "
            "ADMIN, SUPERVISOR, and MAINTENANCE_STAFF."
        )


def hash_password(password):
    password_bytes = password.encode("utf-8")

    salt = bcrypt.gensalt()

    hashed_password = bcrypt.hashpw(
        password_bytes,
        salt
    )

    return hashed_password.decode("utf-8")


def verify_password(password, password_hash):
    password_bytes = password.encode("utf-8")
    password_hash_bytes = password_hash.encode("utf-8")

    return bcrypt.checkpw(
        password_bytes,
        password_hash_bytes
    )


def register_user(
    name,
    email,
    password,
    role,
    is_active=True
):
    validate_role(role)

    existing_user = get_user_by_email(email)

    if existing_user is not None:
        raise ValueError("A user with this email already exists.")

    password_hash = hash_password(password)

    return create_user(
        name=name,
        email=email,
        password_hash=password_hash,
        role=role,
        is_active=is_active
    )


def authenticate_user(email, password):
    user = get_user_by_email(email)

    if user is None:
        return None

    user_id = user[0]
    name = user[1]
    user_email = user[2]
    password_hash = user[3]
    role = user[4]
    is_active = user[6]

    if not is_active:
        return None

    if not verify_password(password, password_hash):
        return None

    return {
        "user_id": user_id,
        "name": name,
        "email": user_email,
        "role": role,
        "is_active": is_active
    }