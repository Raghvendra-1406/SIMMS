import uuid

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    HTTPException,
    Response,
    status,
)

from dependencies.auth_dependencies import require_admin

from database.repositories.calibration_image_repository import (
    get_calibration_image,
    save_calibration_image,
)

router = APIRouter(
    prefix="/vision/calibration",
    tags=["Vision Calibration"]
)

MAX_IMAGE_BYTES = 10 * 1024 * 1024

# Stored in the database (not on disk), so images survive restarts on
# hosts with an ephemeral filesystem such as Render.
IMAGE_PATH_PREFIX = "vision/calibration/images"


def detect_image_type(contents):
    """
    Identify the image format from its magic bytes.

    The client-supplied content type and filename are not trusted,
    because both are fully controlled by the uploader.
    """

    if contents.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    if contents.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"

    if contents.startswith(b"BM"):
        return "image/bmp"

    if contents[:4] == b"RIFF" and contents[8:12] == b"WEBP":
        return "image/webp"

    return None


@router.post(
    "/image",
    status_code=status.HTTP_201_CREATED
)
async def upload_calibration_image(
    file: UploadFile = File(...),
    current_user=Depends(require_admin)
):
    contents = await file.read(
        MAX_IMAGE_BYTES + 1
    )

    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be 10 MB or smaller."
        )

    content_type = detect_image_type(contents)

    if content_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, BMP and WebP images are allowed."
        )

    image_id = str(uuid.uuid4())

    try:
        save_calibration_image(
            image_id=image_id,
            content_type=content_type,
            data=contents,
            created_by=current_user["user_id"]
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save calibration image."
        )

    return {
        "message": "Calibration image uploaded successfully.",
        # The frontend loads it from <API>/<image_path>.
        "image_path": f"{IMAGE_PATH_PREFIX}/{image_id}"
    }


@router.get("/images/{image_id}")
def download_calibration_image(image_id: uuid.UUID):
    """
    Serve a calibration image. Not behind login because <img> tags
    cannot send the bearer token; the random UUID is the access key.
    Calibration images show the empty classroom (Plan v2 §6.1).
    """

    image = get_calibration_image(str(image_id))

    if image is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found."
        )

    content_type, data = image

    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=86400"},
    )
