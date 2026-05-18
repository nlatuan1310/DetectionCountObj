import logging

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.api.websockets import router as ws_router
from app.core.camera import camera_manager
from app.core.config import settings
from app.services.inference_svc import InferenceService
import app.services.inference_svc as inference_module

logger = logging.getLogger(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup & shutdown events."""
    # --- Startup ---
    logger.info("=== VisionAI Backend Starting ===")

    # Init InferenceService với shared lock từ CameraManager
    svc = InferenceService(inference_lock=camera_manager.inference_lock)

    # Load model nếu có
    model_loaded = svc.load_model(settings.YOLO_MODEL_PATH)
    if model_loaded:
        logger.info("YOLO model loaded: %s", settings.YOLO_MODEL_PATH)
    else:
        logger.warning("YOLO model không tìm thấy, chạy ở chế độ Camera Only.")

    # Gán vào module-level variable để các module khác truy cập
    inference_module.inference_service = svc

    logger.info("=== VisionAI Backend Ready ===")

    yield

    # --- Shutdown ---
    logger.info("=== VisionAI Backend Shutting Down ===")
    from app.api.websockets import stop_inference_worker
    stop_inference_worker()
    camera_manager.stop_stream()
    logger.info("Camera stopped.")


app = FastAPI(
    title="DetectionCountObj API",
    version="1.0.0",
    description="VisionAI - Real-time Conveyor Belt Detection & Counting",
    lifespan=lifespan,
)

# CORS middleware - cho phép Frontend kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production nên giới hạn origins cụ thể
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router, prefix="/api/v1")
app.include_router(ws_router)


@app.get("/")
async def root():
    return {"message": "Welcome to DetectionCountObj API"}
