from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.dataset_version import DatasetVersionCreate, DatasetVersionResponse
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
