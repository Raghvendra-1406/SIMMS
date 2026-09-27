import os
import uuid

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    HTTPException,
    status,
)

from dependencies.auth_dependencies import require_admin

router = APIRouter(
    prefix="/vision/calibration",
    tags=["Vision Calibration"]
)

UPLOAD_DIRECTORY = os.path.join(
    "uploads",
    "calibration"
)

MAX_IMAGE_BYTES = 10 * 1024 * 1024


def detect_image_extension(contents):
    """
    Identify the image format from its magic bytes.

    The client-supplied content type and filename are not trusted,
    because both are fully controlled by the uploader.
    """

    if contents.startswith(b"\xff\xd8\xff"):
        return ".jpg"

    if contents.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"

    if contents.startswith(b"BM"):
        return ".bmp"

    if contents[:4] == b"RIFF" and contents[8:12] == b"WEBP":
        return ".webp"

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

    extension = detect_image_extension(contents)

    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, BMP and WebP images are allowed."
        )

    os.makedirs(
        UPLOAD_DIRECTORY,
        exist_ok=True
    )

    filename = (
        f"{uuid.uuid4().hex}"
        f"{extension}"
    )

    file_path = os.path.join(
        UPLOAD_DIRECTORY,
        filename
    )

    try:
        with open(
            file_path,
            "wb"
        ) as image_file:
            image_file.write(contents)

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save calibration image."
        )

    return {
        "message": "Calibration image uploaded successfully.",
        "image_path": file_path
    }