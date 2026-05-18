from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.dataset_version import (
    DatasetVersionCreate,
    DatasetVersionResponse,
    DatasetVersionDetailResponse,
    DatasetVersionGenerateRequest,
    DatasetVersionPreviewRequest,
    DatasetVersionPreviewResponse,
)
from app.services.dataset_svc import DatasetService

router = APIRouter()


@router.get("/projects/{project_id}/versions", response_model=list[DatasetVersionResponse])
async def list_versions(project_id: int, db: AsyncSession = Depends(get_db)):
    """Lấy danh sách dataset versions của project."""
    project = await DatasetService.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project không tồn tại")
    return await DatasetService.list_versions(db, project_id)


@router.post("/projects/{project_id}/versions", response_model=DatasetVersionResponse, status_code=201)
async def create_version(
    project_id: int,
    data: DatasetVersionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Tạo dataset version mới với augmentation config."""
    project = await DatasetService.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project không tồn tại")

    version = await DatasetService.create_version(
        db=db,
        project_id=project_id,
        version_name=data.version_name,
        augmentation_config=data.augmentation_config,
    )
    return version


@router.get("/projects/{project_id}/versions/{version_id}", response_model=DatasetVersionDetailResponse)
async def get_version_detail(
    project_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Lấy chi tiết version bao gồm class distribution."""
    detail = await DatasetService.get_version_detail(db, version_id)
    if not detail or detail["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Version không tồn tại")
    return detail


@router.post("/projects/{project_id}/versions/{version_id}/generate", response_model=DatasetVersionResponse)
async def generate_version(
    project_id: int,
    version_id: int,
    data: DatasetVersionGenerateRequest = DatasetVersionGenerateRequest(),
    db: AsyncSession = Depends(get_db),
):
    """Trigger Stratified Split + sinh thư mục YOLO."""
    project = await DatasetService.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project không tồn tại")

    version = await DatasetService.get_version(db, version_id)
    if not version or version.project_id != project_id:
        raise HTTPException(status_code=404, detail="Version không tồn tại")

    # Validate tổng ratio
    total_ratio = data.train_ratio + data.val_ratio + data.test_ratio
    if abs(total_ratio - 1.0) > 0.01:
        raise HTTPException(status_code=400, detail="Tổng tỷ lệ split phải bằng 1.0")

    try:
        result = await DatasetService.generate_version(
            db=db,
            version_id=version_id,
            train_ratio=data.train_ratio,
            val_ratio=data.val_ratio,
            test_ratio=data.test_ratio,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generate thất bại: {str(e)}")


@router.delete("/projects/{project_id}/versions/{version_id}", status_code=204)
async def delete_version(
    project_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Xóa version + cleanup thư mục YOLO."""
    version = await DatasetService.get_version(db, version_id)
    if not version or version.project_id != project_id:
        raise HTTPException(status_code=404, detail="Version không tồn tại")

    deleted = await DatasetService.delete_version(db, version_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Xóa version thất bại")


@router.post("/projects/{project_id}/preview-augmentation", response_model=DatasetVersionPreviewResponse)
async def preview_augmentation(
    project_id: int,
    data: DatasetVersionPreviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """Preview ảnh ngẫu nhiên với augmentation config."""
    project = await DatasetService.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project không tồn tại")

    try:
        base64_img = await DatasetService.preview_augmentation(
            db=db,
            project_id=project_id,
            augmentation_config=data.augmentation_config,
        )
        if not base64_img:
            raise HTTPException(status_code=404, detail="Không tìm thấy ảnh để preview trong project")
        return DatasetVersionPreviewResponse(image_base64=base64_img)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview thất bại: {str(e)}")
