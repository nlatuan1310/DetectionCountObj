from pydantic import BaseModel, Field
from typing import Optional


class CameraConnectRequest(BaseModel):
    """Request body cho kết nối camera Hikvision."""
    ip: str = Field(..., description="Địa chỉ IP camera (VD: 192.168.1.64)")
    username: str = Field(default="admin", description="Tên đăng nhập camera")
    password: str = Field(..., description="Mật khẩu camera")
    channel: int = Field(default=1, description="Kênh camera (mặc định 1)")
    stream_type: int = Field(
        default=1,
        description="Loại stream: 1=main stream, 2=sub stream"
    )


class CameraStatusResponse(BaseModel):
    """Response trạng thái camera."""
    is_connected: bool = False
    source_url: Optional[str] = None
    resolution: Optional[str] = None
    fps: Optional[float] = None
    error: Optional[str] = None


class InferenceConfigRequest(BaseModel):
    """Request cập nhật cấu hình inference."""
    confidence: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="Ngưỡng tin cậy (0.0 - 1.0)"
    )
    inference_enabled: Optional[bool] = Field(
        default=None,
        description="Bật/tắt inference"
    )


class InferenceStatusResponse(BaseModel):
    """Response trạng thái inference."""
    model_loaded: bool = False
    model_name: Optional[str] = None
    device: Optional[str] = None
    confidence: float = 0.5
    inference_enabled: bool = True
    class_names: list[str] = []


class ZoneConfig(BaseModel):
    """Cấu hình vùng nhận diện (ROI, counting line, warning line)."""
    roi_points: Optional[list[list[float]]] = Field(
        default=None,
        description="Danh sách điểm polygon ROI [[x,y], ...] (0.0-1.0 normalized)"
    )
    counting_line: Optional[list[list[float]]] = Field(
        default=None,
        description="2 điểm counting line [[x1,y1], [x2,y2]] (0.0-1.0 normalized)"
    )
    warning_line: Optional[list[list[float]]] = Field(
        default=None,
        description="2 điểm warning line [[x1,y1], [x2,y2]] (0.0-1.0 normalized)"
    )
    warning_flip: bool = Field(
        default=False,
        description="Đảo ngược hướng cảnh báo"
    )


class StreamStatsResponse(BaseModel):
    """Response số liệu thống kê stream."""
    display_fps: float = 0.0
    inference_fps: float = 0.0
    total_detections: int = 0
    class_counts: dict[str, int] = {}
    crossing_counts: dict[str, int] = {}
    warnings: list[str] = []
