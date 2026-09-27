from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.auth_dependencies import require_admin

from schemas.user_schema import (
    UserCreate,
    UserResponse,
    UserUpdate,
    UserStatusUpdate,
)

from database.repositories.user_repository import (
    get_all_users,
    get_user_by_id,
    update_user,
    update_user_status,
)

from services.auth_service import (
    register_user,
    validate_role,
)


router = APIRouter(
    prefix="/users",
    tags=["User Management"]
)


def user_row_to_response(user):
    return {
        "user_id": user[0],
        "name": user[1],
        "email": user[2],
        "role": user[4],
        "created_at": user[5],
        "is_active": user[6],
    }


@router.get(
    "",
    response_model=list[UserResponse]
)
def get_users(
    current_user=Depends(require_admin)
):
    users = get_all_users()

    return [
        user_row_to_response(user)
        for user in users
    ]


@router.get(
    "/{user_id}",
    response_model=UserResponse
)
def get_user(
    user_id: int,
    current_user=Depends(require_admin)
):
    user = get_user_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    return user_row_to_response(user)


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def create_user_endpoint(
    user: UserCreate,
    current_user=Depends(require_admin)
):
    try:
        created_user = register_user(
            name=user.name,
            email=user.email,
            password=user.password,
            role=user.role,
            is_active=user.is_active
        )

        return user_row_to_response(created_user)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


@router.put(
    "/{user_id}",
    response_model=UserResponse
)
def update_user_endpoint(
    user_id: int,
    user: UserUpdate,
    current_user=Depends(require_admin)
):
    existing_user = get_user_by_id(user_id)

    if existing_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    try:
        validate_role(user.role)

        updated_user = update_user(
            user_id=user_id,
            name=user.name,
            email=user.email,
            role=user.role,
            is_active=user.is_active
        )

        return user_row_to_response(updated_user)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )

    except Exception as exc:
        if "unique" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists."
            )

        raise


@router.patch(
    "/{user_id}/status",
    response_model=UserResponse
)
def update_user_status_endpoint(
    user_id: int,
    user_status: UserStatusUpdate,
    current_user=Depends(require_admin)
):
    existing_user = get_user_by_id(user_id)

    if existing_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    updated_user = update_user_status(
        user_id=user_id,
        is_active=user_status.is_active
    )

    return user_row_to_response(updated_user)
