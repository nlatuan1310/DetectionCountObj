import asyncio
import json
import logging
import time
import threading
from functools import partial

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.camera import camera_manager
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# ═══════════════════════════════════════════════════════════
# Inference Background Worker
# Chạy inference trong thread riêng, không block event loop.
# Kết quả (annotated frame + stats) được lưu vào shared buffer.
# ═══════════════════════════════════════════════════════════

_latest_annotated_frame: bytes | None = None  # JPEG bytes
_latest_stats: dict = {}
_buffer_lock = threading.Lock()
_worker_running = False
_worker_thread: threading.Thread | None = None


def _encode_frame(frame: np.ndarray) -> bytes:
    """Encode frame sang JPEG bytes (giữ nguyên resolution gốc)."""
    encode_params = [cv2.IMWRITE_JPEG_QUALITY, settings.STREAM_JPEG_QUALITY]
    _, buffer = cv2.imencode('.jpg', frame, encode_params)
    return buffer.tobytes()


def _inference_worker():
    """
    Background thread: liên tục lấy frame mới nhất → chạy inference → encode JPEG.
    Kết quả ghi vào shared buffer để WebSocket đọc gửi đi.
    """
    global _latest_annotated_frame, _latest_stats, _worker_running

    from app.services.inference_svc import inference_service

    fps_counter = 0
    fps_time = time.perf_counter()
    display_fps = 0.0

    while _worker_running:
        if not camera_manager.is_running:
            time.sleep(0.1)
            continue

        frame = camera_manager.get_latest_frame()
        if frame is None:
            time.sleep(0.005)
            continue

        # Chạy inference
        if inference_service is not None and inference_service.inference_enabled:
            annotated, stats = inference_service.detect(frame)
        else:
            annotated = frame
            stats = {
                "inference_fps": 0.0,
                "total_detections": 0,
                "class_counts": {},
                "crossing_total": 0,
                "warnings": [],
            }

        # Encode JPEG (trong cùng thread, tránh copy frame)
        jpeg_bytes = _encode_frame(annotated)

        # FPS
        fps_counter += 1
        elapsed = time.perf_counter() - fps_time
        if elapsed >= 1.0:
            display_fps = fps_counter / elapsed
            fps_counter = 0
            fps_time = time.perf_counter()

        stats["display_fps"] = round(display_fps, 1)
        stats["camera_connected"] = True
        stats["type"] = "stats"

        # Ghi vào buffer
        with _buffer_lock:
            _latest_annotated_frame = jpeg_bytes
            _latest_stats = stats

        # Nhường CPU, tránh busy loop
        time.sleep(0.001)


def start_inference_worker():
    """Khởi động inference worker thread."""
    global _worker_running, _worker_thread
    if _worker_running:
        return
    _worker_running = True
    _worker_thread = threading.Thread(target=_inference_worker, daemon=True, name="inference-worker")
    _worker_thread.start()
    logger.info("Inference worker started")


def stop_inference_worker():
    """Dừng inference worker thread."""
    global _worker_running, _worker_thread
    _worker_running = False
    if _worker_thread is not None:
        _worker_thread.join(timeout=3.0)
        _worker_thread = None
    logger.info("Inference worker stopped")


# ═══════════════════════════════════════════════════════════
# WebSocket Connection Manager
# ═══════════════════════════════════════════════════════════

class StreamConnectionManager:
    """Quản lý WebSocket connections cho video streaming."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket client connected. Total: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info("WebSocket client disconnected. Total: %d", len(self.active_connections))


stream_manager = StreamConnectionManager()


# ═══════════════════════════════════════════════════════════
# WebSocket Endpoint
# ═══════════════════════════════════════════════════════════

@router.websocket("/ws/stream")
async def video_stream_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint cho video streaming.

    Protocol:
    - Server → Client (binary): JPEG frame bytes
    - Server → Client (text/json): Stats metadata (mỗi 1s)
    - Client → Server (text/json): Config updates
    """
    from app.services.inference_svc import inference_service

    await stream_manager.connect(websocket)

    # Đảm bảo worker đang chạy
    start_inference_worker()

    # Task lắng nghe config từ client
    async def listen_client():
        try:
            while True:
                data = await websocket.receive_text()
                try:
                    config = json.loads(data)
                    _handle_client_config(config, inference_service)
                except json.JSONDecodeError:
                    logger.warning("Invalid JSON from WebSocket client: %s", data)
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    # Task stream frames từ shared buffer
    async def stream_frames():
        last_stats_time = time.perf_counter()
        prev_frame_id = None  # Tránh gửi frame trùng

        try:
            while True:
                if not camera_manager.is_running:
                    await websocket.send_json({
                        "type": "status",
                        "camera_connected": False,
                    })
                    await asyncio.sleep(1.0)
                    continue

                # Đọc frame từ shared buffer (lock rất nhanh)
                with _buffer_lock:
                    jpeg_bytes = _latest_annotated_frame
                    stats = _latest_stats.copy() if _latest_stats else None

                if jpeg_bytes is None:
                    await asyncio.sleep(0.01)
                    continue

                # Tránh gửi frame trùng (nếu worker chưa kịp xử lý frame mới)
                frame_id = id(jpeg_bytes)
                if frame_id == prev_frame_id:
                    await asyncio.sleep(0.005)
                    continue
                prev_frame_id = frame_id

                # Gửi binary frame
                await websocket.send_bytes(jpeg_bytes)

                # Gửi stats mỗi 1 giây
                now = time.perf_counter()
                if stats and now - last_stats_time >= 1.0:
                    await websocket.send_json(stats)
                    last_stats_time = now

                # Yield cho event loop (~60 FPS max)
                await asyncio.sleep(1 / 60)

        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error("Stream error: %s", str(e))

    listener_task = asyncio.create_task(listen_client())
    stream_task = asyncio.create_task(stream_frames())

    try:
        done, pending = await asyncio.wait(
            [listener_task, stream_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
    finally:
        stream_manager.disconnect(websocket)


def _handle_client_config(config: dict, inference_service):
    """Xử lý config nhận từ WebSocket client."""
    if inference_service is None:
        return

    msg_type = config.get("type")

    if msg_type == "confidence":
        new_conf = config.get("value")
        if new_conf is not None and 0.0 <= new_conf <= 1.0:
            inference_service.confidence = float(new_conf)
            logger.info("Confidence updated: %.2f", new_conf)

    elif msg_type == "toggle_inference":
        inference_service.inference_enabled = bool(config.get("value", True))
        logger.info("Inference enabled: %s", inference_service.inference_enabled)

    elif msg_type == "zones":
        frame = camera_manager.get_latest_frame()
        if frame is not None:
            h, w = frame.shape[:2]
            inference_service.update_zones(
                frame_width=w,
                frame_height=h,
                roi_points=config.get("roi_points"),
                counting_line=config.get("counting_line"),
                warning_line=config.get("warning_line"),
                warning_flip=config.get("warning_flip", False),
            )
