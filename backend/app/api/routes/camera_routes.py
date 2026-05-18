import logging

from fastapi import APIRouter

from app.core.camera import camera_manager, CameraManager
from app.schemas.camera import (
    CameraConnectRequest,
    CameraStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/connect", response_model=CameraStatusResponse)
async def connect_camera(request: CameraConnectRequest):
    """
    Kết nối camera Hikvision qua RTSP.

    Tự động build RTSP URL từ IP/username/password.
    """
    rtsp_url = CameraManager.build_rtsp_url(
        ip=request.ip,
        username=request.username,
        password=request.password,
        channel=request.channel,
        stream_type=request.stream_type,
    )

    success = camera_manager.start_stream(rtsp_url)

    status = camera_manager.get_status()
    if not success:
        status["error"] = status.get("error", "Kết nối thất bại")

    return CameraStatusResponse(**status)


@router.post("/disconnect", response_model=CameraStatusResponse)
async def disconnect_camera():
    """Ngắt kết nối camera."""
    camera_manager.stop_stream()
    return CameraStatusResponse(**camera_manager.get_status())


@router.get("/status", response_model=CameraStatusResponse)
async def camera_status():
    """Lấy trạng thái hiện tại của camera."""
    return CameraStatusResponse(**camera_manager.get_status())
