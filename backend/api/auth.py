from fastapi import APIRouter, HTTPException

from schemas.user_schema import (
    UserLogin,
    UserLoginResponse,
)

from services.auth_service import (
    authenticate_user,
)

from services.jwt_service import create_access_token


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post(
    "/login",
    response_model=UserLoginResponse
)
def login(user: UserLogin):
    authenticated_user = authenticate_user(
        email=user.email,
        password=user.password
    )

    if authenticated_user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    access_token = create_access_token(
        authenticated_user
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": authenticated_user["user_id"],
        "name": authenticated_user["name"],
        "email": authenticated_user["email"],
        "role": authenticated_user["role"],
        "is_active": authenticated_user["is_active"]
    }