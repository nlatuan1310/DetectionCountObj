from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.annotation import (
    AnnotationCreate,
    AnnotationBulkCreate,
    AnnotationUpdate,
    AnnotationResponse,
)
from app.services.dataset_svc import DatasetService

router = APIRouter()


@router.get("/images/{image_id}/annotations", response_model=list[AnnotationResponse])
async def get_annotations(image_id: int, db: AsyncSession = Depends(get_db)):
    """Lấy tất cả annotations của ảnh."""
    image = await DatasetService.get_image(db, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Ảnh không tồn tại")
    return await DatasetService.get_image_annotations(db, image_id)


@router.post("/images/{image_id}/annotations", response_model=list[AnnotationResponse], status_code=201)
async def create_annotations(
    image_id: int,
    data: AnnotationBulkCreate,
    db: AsyncSession = Depends(get_db),
):
    """Tạo annotations cho ảnh (bulk support)."""
    image = await DatasetService.get_image(db, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Ảnh không tồn tại")

    annotations_data = [ann.model_dump() for ann in data.annotations]
    annotations = await DatasetService.create_annotations(db, image_id, annotations_data)

    # Fetch lại kèm class_name
    return await DatasetService.get_image_annotations(db, image_id)


@router.put("/annotations/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: int,
    data: AnnotationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật bbox annotation."""
    update_data = data.model_dump(exclude_unset=True)
    ann = await DatasetService.update_annotation(db, annotation_id, update_data)
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation không tồn tại")

    # Fetch lại kèm class_name
    annotations = await DatasetService.get_image_annotations(db, ann.image_id)
    return next((a for a in annotations if a["id"] == annotation_id), None)


@router.delete("/annotations/{annotation_id}", status_code=204)
async def delete_annotation(annotation_id: int, db: AsyncSession = Depends(get_db)):
    """Xóa annotation."""
    deleted = await DatasetService.delete_annotation(db, annotation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Annotation không tồn tại")
