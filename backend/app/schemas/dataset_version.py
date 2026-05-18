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
    total_images: int = 0
    train_count: int = 0
    val_count: int = 0
    test_count: int = 0
    split_ratio: str = "70/20/10"
    generated_at: Optional[datetime] = None
    yolo_dataset_path: Optional[str] = None

    model_config = {"from_attributes": True}


class DatasetVersionGenerateRequest(BaseModel):
    """Schema cho request generate version (trigger Stratified Split)."""
    train_ratio: float = Field(0.7, ge=0.1, le=0.9, description="Tỷ lệ train (default 70%)")
    val_ratio: float = Field(0.2, ge=0.05, le=0.5, description="Tỷ lệ validation (default 20%)")
    test_ratio: float = Field(0.1, ge=0.0, le=0.5, description="Tỷ lệ test (default 10%)")


class ClassDistribution(BaseModel):
    """Phân bổ ảnh theo class trong một split."""
    class_id: int
    class_name: str
    train: int = 0
    val: int = 0
    test: int = 0
    total: int = 0


class DatasetVersionDetailResponse(BaseModel):
    """Schema chi tiết version bao gồm class distribution."""
    id: int
    project_id: int
    version_name: Optional[str] = None
    augmentation_config: dict[str, Any] = {}
    status: str = "draft"
    created_at: datetime
    total_images: int = 0
    train_count: int = 0
    val_count: int = 0
    test_count: int = 0
    split_ratio: str = "70/20/10"
    generated_at: Optional[datetime] = None
    yolo_dataset_path: Optional[str] = None
    class_distribution: list[ClassDistribution] = []
    labeled_count: int = 0
    background_count: int = 0

    model_config = {"from_attributes": True}


class DatasetVersionPreviewRequest(BaseModel):
    """Schema cho request preview augmentation."""
    augmentation_config: dict[str, Any] = Field(
        default_factory=dict,
        description="Cấu hình augmentation JSON (flip, rotate, brightness...)"
    )


class DatasetVersionPreviewResponse(BaseModel):
    """Schema trả về ảnh preview augmentation."""
    image_base64: str = Field(..., description="Ảnh base64 đã áp dụng augmentation và vẽ bbox")
