from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from services.jwt_service import decode_access_token

from database.repositories.user_repository import get_user_by_id


security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token."
        )

    user_id = payload.get("sub")

    try:
        user_id = int(user_id)

    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token."
        )

    # The token only proves who the caller is. Role and active
    # status are read from the database on every request, so a
    # deactivated or demoted user loses access immediately
    # instead of when the token expires.
    user = get_user_by_id(user_id)

    if user is None or not user[6]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or no longer exists."
        )

    return {
        "user_id": user[0],
        "name": user[1],
        "email": user[2],
        "role": user[4]
    }


def require_admin(
    current_user=Depends(get_current_user)
):
    if current_user["role"] != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required."
        )

    return current_user


def require_supervisor(
    current_user=Depends(get_current_user)
):
    if current_user["role"] != "SUPERVISOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supervisor access required."
        )

    return current_user


def require_maintenance_staff(
    current_user=Depends(get_current_user)
):
    if current_user["role"] != "MAINTENANCE_STAFF":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Maintenance staff access required."
        )

    return current_user


def require_admin_or_supervisor(
    current_user=Depends(get_current_user)
):
    if current_user["role"] not in {
        "ADMIN",
        "SUPERVISOR"
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Supervisor access required."
        )

    return current_user