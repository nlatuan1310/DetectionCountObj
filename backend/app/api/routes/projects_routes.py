from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse
from app.services.dataset_svc import DatasetService

router = APIRouter()


@router.get("/", response_model=ProjectListResponse)
async def list_projects(db: AsyncSession = Depends(get_db)):
    """Lấy danh sách tất cả projects kèm thống kê."""
    projects = await DatasetService.list_projects(db)
    return {"projects": projects, "total": len(projects)}


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    """Tạo project mới (đợt thu thập dữ liệu)."""
    project = await DatasetService.create_project(db, name=data.name, description=data.description)
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at,
        "image_count": 0,
        "annotated_count": 0,
    }


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    """Lấy thông tin chi tiết project."""
    project = await DatasetService.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project không tồn tại")

    # Lấy stats từ list (tối ưu sau)
    projects_list = await DatasetService.list_projects(db)
    project_data = next((p for p in projects_list if p["id"] == project_id), None)

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at,
        "image_count": project_data["image_count"] if project_data else 0,
        "annotated_count": project_data["annotated_count"] if project_data else 0,
    }


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    """Xóa project và toàn bộ ảnh, annotations liên quan."""
    deleted = await DatasetService.delete_project(db, project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project không tồn tại")
