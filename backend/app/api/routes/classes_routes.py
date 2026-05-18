from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.class_schema import ClassCreate, ClassUpdate, ClassResponse
from app.services.dataset_svc import DatasetService

router = APIRouter()


@router.get("/", response_model=list[ClassResponse])
async def list_classes(db: AsyncSession = Depends(get_db)):
    """Lấy danh sách tất cả classes sản phẩm."""
    return await DatasetService.list_classes(db)


@router.post("/", response_model=ClassResponse, status_code=201)
async def create_class(data: ClassCreate, db: AsyncSession = Depends(get_db)):
    """Tạo class sản phẩm mới."""
    try:
        cls = await DatasetService.create_class(db, name=data.name)
        return {
            "id": cls.id,
            "name": cls.name,
            "is_active": cls.is_active,
            "annotation_count": 0,
        }
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=409, detail=f"Class '{data.name}' đã tồn tại")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: int,
    data: ClassUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật tên hoặc toggle is_active của class."""
    cls = await DatasetService.update_class(
        db, class_id=class_id, name=data.name, is_active=data.is_active
    )
    if not cls:
        raise HTTPException(status_code=404, detail="Class không tồn tại")

    # Lấy annotation count
    classes_list = await DatasetService.list_classes(db)
    cls_data = next((c for c in classes_list if c["id"] == class_id), None)
    annotation_count = cls_data["annotation_count"] if cls_data else 0

    return {
        "id": cls.id,
        "name": cls.name,
        "is_active": cls.is_active,
        "annotation_count": annotation_count,
    }

@router.delete("/{class_id}", status_code=204)
async def delete_class(class_id: int, db: AsyncSession = Depends(get_db)):
    """Xóa class sản phẩm."""
    try:
        success = await DatasetService.delete_class(db, class_id)
        if not success:
            raise HTTPException(status_code=404, detail="Class không tồn tại")
    except Exception as e:
        if "foreign key" in str(e).lower() or "reference" in str(e).lower():
            raise HTTPException(status_code=400, detail="Không thể xóa class đang được sử dụng (có annotations)")
        raise HTTPException(status_code=500, detail=str(e))
