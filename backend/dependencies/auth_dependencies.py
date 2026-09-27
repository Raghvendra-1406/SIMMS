from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from services.jwt_service import decode_access_token


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
    role = payload.get("role")

    if user_id is None or role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token."
        )

    return {
        "user_id": int(user_id),
        "name": payload.get("name"),
        "email": payload.get("email"),
        "role": role
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