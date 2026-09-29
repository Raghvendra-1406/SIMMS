from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.auth_dependencies import (
    get_current_user,
    require_admin,
)

from schemas.vision_schema import (
    VisionObservationCreate,
    VisionObservationResponse,
)

from services.vision_service import (
    create_observation,
    get_observation,
    get_room_observations,
    get_device_observations,
    get_latest_observation,
    get_recent_observations,
)


router = APIRouter(
    prefix="/vision",
    tags=["Vision Observations"],
    dependencies=[Depends(get_current_user)]
)


@router.post(
    "",
    dependencies=[Depends(require_admin)],
    response_model=VisionObservationResponse,
    status_code=status.HTTP_201_CREATED
)
def create_vision_observation(
    observation: VisionObservationCreate
):
    try:
        created_observation = create_observation(
            room_id=observation.room_id,
            device_id=observation.device_id,
            observed_at=observation.observed_at,
            observation_type=observation.observation_type,
            observation_data=observation.observation_data
        )

        return {
            "vision_observation_id": created_observation[0],
            "room_id": created_observation[1],
            "device_id": created_observation[2],
            "observed_at": created_observation[3],
            "observation_type": created_observation[4],
            "observation_data": created_observation[5],
            "created_at": created_observation[6]
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


@router.get(
    "/room/{room_id}",
    response_model=list[VisionObservationResponse]
)
def get_vision_observations_for_room(room_id: int):
    try:
        observations = get_room_observations(room_id)

        return [
            {
                "vision_observation_id": observation[0],
                "room_id": observation[1],
                "device_id": observation[2],
                "observed_at": observation[3],
                "observation_type": observation[4],
                "observation_data": observation[5],
                "created_at": observation[6]
            }
            for observation in observations
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


@router.get(
    "/device/{device_id}",
    response_model=list[VisionObservationResponse]
)
def get_vision_observations_for_device(device_id: int):
    try:
        observations = get_device_observations(device_id)

        return [
            {
                "vision_observation_id": observation[0],
                "room_id": observation[1],
                "device_id": observation[2],
                "observed_at": observation[3],
                "observation_type": observation[4],
                "observation_data": observation[5],
                "created_at": observation[6]
            }
            for observation in observations
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )


@router.get(
    "/room/{room_id}/latest",
    response_model=VisionObservationResponse
)
def get_latest_vision_observation(
    room_id: int,
    observation_type: str | None = None
):
    try:
        observation = get_latest_observation(
            room_id=room_id,
            observation_type=observation_type
        )

        if observation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No vision observation found."
            )

        return {
            "vision_observation_id": observation[0],
            "room_id": observation[1],
            "device_id": observation[2],
            "observed_at": observation[3],
            "observation_type": observation[4],
            "observation_data": observation[5],
            "created_at": observation[6]
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


@router.get(
    "/room/{room_id}/recent",
    response_model=list[VisionObservationResponse]
)
def get_recent_vision_observations(
    room_id: int,
    observation_type: str | None = None,
    limit: int = 10
):
    try:
        observations = get_recent_observations(
            room_id=room_id,
            observation_type=observation_type,
            limit=limit
        )

        return [
            {
                "vision_observation_id": observation[0],
                "room_id": observation[1],
                "device_id": observation[2],
                "observed_at": observation[3],
                "observation_type": observation[4],
                "observation_data": observation[5],
                "created_at": observation[6]
            }
            for observation in observations
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )


@router.get(
    "/{vision_observation_id}",
    response_model=VisionObservationResponse
)
def get_vision_observation(
    vision_observation_id: int
):
    try:
        observation = get_observation(
            vision_observation_id
        )

        return {
            "vision_observation_id": observation[0],
            "room_id": observation[1],
            "device_id": observation[2],
            "observed_at": observation[3],
            "observation_type": observation[4],
            "observation_data": observation[5],
            "created_at": observation[6]
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc)
        )