import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.config import settings
from app.schemas.image import ImageResponse, ImageUploadResponse, ImageGoldenToggle
from app.services.dataset_svc import DatasetService
from app.services.storage_svc import StorageService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/projects/{project_id}/images", response_model=list[ImageResponse])
async def list_project_images(project_id: int, db: AsyncSession = Depends(get_db)):
    """Lấy danh sách ảnh của project."""
    project = await DatasetService.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project không tồn tại")
    return await DatasetService.list_project_images(db, project_id)


@router.post("/projects/{project_id}/images", response_model=ImageUploadResponse)
async def upload_images(
    project_id: int,
    files: list[UploadFile] = File(...),
    is_background: bool = Query(False, description="Đánh dấu là ảnh trống (background)"),
    db: AsyncSession = Depends(get_db),
):
    """Upload batch ảnh vào project (Hybrid Storage: Cloudinary + Local Cache)."""
    project = await DatasetService.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project không tồn tại")

    if len(files) > settings.MAX_BATCH_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail=f"Tối đa {settings.MAX_BATCH_UPLOAD} ảnh mỗi lần upload",
        )

    uploaded = []
    failed = []

    for file in files:
        try:
            # Validate content type
            if not file.content_type or not file.content_type.startswith("image/"):
                failed.append(f"{file.filename}: Không phải file ảnh")
                continue

            # Upload kép
            storage_result = await StorageService.upload_image(file)

            # Lưu DB record
            image = await DatasetService.create_image(
                db=db,
                project_id=project_id,
                local_path=storage_result["local_path"],
                cloudinary_url=storage_result["cloudinary_url"],
                original_filename=storage_result["original_filename"],
                is_background=is_background,
            )

            uploaded.append({
                "id": image.id,
                "project_id": image.project_id,
                "cloudinary_url": image.cloudinary_url,
                "local_path": image.local_path,
                "original_filename": image.original_filename,
                "is_golden": image.is_golden,
                "is_background": image.is_background,
                "uploaded_at": image.uploaded_at,
                "annotation_count": 0,
            })
        except ValueError as e:
            failed.append(f"{file.filename}: {str(e)}")
        except Exception as e:
            logger.error("Upload failed for %s: %s", file.filename, str(e))
            failed.append(f"{file.filename}: Lỗi hệ thống")

    return {
        "uploaded": uploaded,
        "failed": failed,
        "total_uploaded": len(uploaded),
        "total_failed": len(failed),
    }


@router.delete("/images/{image_id}", status_code=204)
async def delete_image(image_id: int, db: AsyncSession = Depends(get_db)):
    """Xóa ảnh (DB record + file vật lý)."""
    image = await DatasetService.delete_image(db, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Ảnh không tồn tại")
    # Xóa file vật lý
    await StorageService.delete_image(image.local_path, image.cloudinary_url)


@router.patch("/images/{image_id}/golden", response_model=ImageGoldenToggle)
async def toggle_golden(image_id: int, db: AsyncSession = Depends(get_db)):
    """Toggle trạng thái Golden của ảnh."""
    image = await DatasetService.toggle_golden(db, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Ảnh không tồn tại")
    return {"id": image.id, "is_golden": image.is_golden}


@router.get("/background-images", response_model=list[ImageResponse])
async def list_background_images(db: AsyncSession = Depends(get_db)):
    """Lấy danh sách ảnh trống (background images hub)."""
    return await DatasetService.list_background_images(db)
