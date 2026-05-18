import logging

from fastapi import APIRouter, UploadFile, File

from app.schemas.camera import (
    InferenceConfigRequest,
    InferenceStatusResponse,
    ZoneConfig,
)
from app.core.camera import camera_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status", response_model=InferenceStatusResponse)
async def inference_status():
    """Lấy trạng thái hiện tại của inference service."""
    from app.services.inference_svc import inference_service

    if inference_service is None:
        return InferenceStatusResponse()

    return InferenceStatusResponse(**inference_service.get_status())


@router.post("/config", response_model=InferenceStatusResponse)
async def update_inference_config(request: InferenceConfigRequest):
    """Cập nhật cấu hình inference (confidence, toggle on/off)."""
    from app.services.inference_svc import inference_service

    if inference_service is None:
        return InferenceStatusResponse()

    if request.confidence is not None:
        inference_service.confidence = request.confidence
        logger.info("Confidence updated via REST: %.2f", request.confidence)

    if request.inference_enabled is not None:
        inference_service.inference_enabled = request.inference_enabled
        logger.info("Inference enabled: %s", request.inference_enabled)

    return InferenceStatusResponse(**inference_service.get_status())


@router.post("/zones")
async def update_zones(config: ZoneConfig):
    """Cập nhật zones (ROI, counting line, warning line)."""
    from app.services.inference_svc import inference_service

    if inference_service is None:
        return {"status": "error", "message": "Inference service chưa khởi tạo"}

    frame = camera_manager.get_latest_frame()
    if frame is None:
        return {"status": "error", "message": "Chưa có frame từ camera"}

    h, w = frame.shape[:2]
    inference_service.update_zones(
        frame_width=w,
        frame_height=h,
        roi_points=config.roi_points,
        counting_line=config.counting_line,
        warning_line=config.warning_line,
        warning_flip=config.warning_flip,
    )

    return {"status": "ok", "message": "Zones đã cập nhật"}


@router.post("/swap-model")
async def swap_model(model_path: str):
    """
    Hot-swap model YOLO.

    Stream tạm ngưng inference ~1s trong khi swap.
    """
    from app.services.inference_svc import inference_service

    if inference_service is None:
        return {"status": "error", "message": "Inference service chưa khởi tạo"}

    success = inference_service.swap_model(model_path)

    if success:
        return {
            "status": "ok",
            "message": f"Model đã swap sang: {model_path}",
            **inference_service.get_status(),
        }
    else:
        return {"status": "error", "message": "Swap model thất bại"}
