from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class DatasetVersionCreate(BaseModel):
    """Schema tạo Dataset Version mới."""
    version_name: Optional[str] = Field(None, max_length=100, description="Tên version (auto-generate nếu null)")
    augmentation_config: dict[str, Any] = Field(
        default_factory=dict,
        description="Cấu hình augmentation JSON (flip, rotate, brightness...)"
    )


class DatasetVersionResponse(BaseModel):
    """Schema trả về thông tin Dataset Version."""
    id: int
    project_id: int
    version_name: Optional[str] = None
    augmentation_config: dict[str, Any] = {}
    status: str = "draft"
    created_at: datetime

    model_config = {"from_attributes": True}
