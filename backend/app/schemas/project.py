from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    """Schema tạo Project mới (đợt thu thập dữ liệu)."""
    name: str = Field(..., min_length=1, max_length=200, description="Tên project")
    description: Optional[str] = Field(None, max_length=500, description="Mô tả ngắn")


class ProjectUpdate(BaseModel):
    """Schema cập nhật Project."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)


class ProjectResponse(BaseModel):
    """Schema trả về thông tin Project."""
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    image_count: int = 0
    annotated_count: int = 0

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    """Schema trả về danh sách Projects."""
    projects: list[ProjectResponse]
    total: int
