from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ImageResponse(BaseModel):
    """Schema trả về thông tin Image."""
    id: int
    project_id: int
    cloudinary_url: Optional[str] = None
    local_path: str
    original_filename: Optional[str] = None
    is_golden: bool = False
    is_background: bool = False
    uploaded_at: datetime
    annotation_count: int = 0

    model_config = {"from_attributes": True}


class ImageUploadResponse(BaseModel):
    """Schema trả về kết quả upload batch."""
    uploaded: list[ImageResponse]
    failed: list[str] = []
    total_uploaded: int
    total_failed: int


class ImageGoldenToggle(BaseModel):
    """Schema response khi toggle golden status."""
    id: int
    is_golden: bool
