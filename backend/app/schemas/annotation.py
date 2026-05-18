from pydantic import BaseModel, Field


class AnnotationCreate(BaseModel):
    """Schema tạo Annotation — bbox YOLO normalized (0.0-1.0)."""
    class_id: int = Field(..., description="ID của class sản phẩm")
    bbox_x: float = Field(..., ge=0.0, le=1.0, description="X center (normalized)")
    bbox_y: float = Field(..., ge=0.0, le=1.0, description="Y center (normalized)")
    bbox_w: float = Field(..., gt=0.0, le=1.0, description="Width (normalized)")
    bbox_h: float = Field(..., gt=0.0, le=1.0, description="Height (normalized)")


class AnnotationBulkCreate(BaseModel):
    """Schema tạo nhiều annotations cùng lúc cho 1 ảnh."""
    annotations: list[AnnotationCreate]


class AnnotationUpdate(BaseModel):
    """Schema cập nhật bbox của annotation."""
    class_id: int | None = None
    bbox_x: float | None = Field(None, ge=0.0, le=1.0)
    bbox_y: float | None = Field(None, ge=0.0, le=1.0)
    bbox_w: float | None = Field(None, gt=0.0, le=1.0)
    bbox_h: float | None = Field(None, gt=0.0, le=1.0)


class AnnotationResponse(BaseModel):
    """Schema trả về thông tin Annotation."""
    id: int
    image_id: int
    class_id: int
    class_name: str | None = None
    bbox_x: float
    bbox_y: float
    bbox_w: float
    bbox_h: float

    model_config = {"from_attributes": True}
