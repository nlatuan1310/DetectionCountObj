from pydantic import BaseModel, Field
from typing import Optional


class ClassCreate(BaseModel):
    """Schema tạo Class sản phẩm mới."""
    name: str = Field(..., min_length=1, max_length=100, description="Tên class sản phẩm")


class ClassUpdate(BaseModel):
    """Schema cập nhật Class."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None


class ClassResponse(BaseModel):
    """Schema trả về thông tin Class."""
    id: int
    name: str
    is_active: bool
    annotation_count: int = 0

    model_config = {"from_attributes": True}
