import os
import uuid

from fastapi import APIRouter, UploadFile, File, HTTPException, status

router = APIRouter(
    prefix="/vision/calibration",
    tags=["Vision Calibration"]
)

UPLOAD_DIRECTORY = os.path.join(
    "uploads",
    "calibration"
)


@router.post(
    "/image",
    status_code=status.HTTP_201_CREATED
)
async def upload_calibration_image(
    file: UploadFile = File(...)
):
    if not file.content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image type could not be determined."
        )

    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed."
        )

    os.makedirs(
        UPLOAD_DIRECTORY,
        exist_ok=True
    )

    original_extension = os.path.splitext(
        file.filename or ""
    )[1].lower()

    if not original_extension:
        original_extension = ".jpg"

    filename = (
        f"{uuid.uuid4().hex}"
        f"{original_extension}"
    )

    file_path = os.path.join(
        UPLOAD_DIRECTORY,
        filename
    )

    try:
        contents = await file.read()

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