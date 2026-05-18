from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost/dbname"

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Inference
    YOLO_MODEL_PATH: str = "best.pt"
    YOLO_CONFIDENCE: float = 0.5
    YOLO_DEVICE: str = ""  # Auto-detect: "cuda:0" or "cpu"

    # Storage
    LOCAL_CACHE_DIR: str = "data/local_cache"
    MAX_UPLOAD_SIZE_MB: int = 10
    MAX_BATCH_UPLOAD: int = 20

    # Camera
    DEFAULT_CAMERA_SOURCE: str = ""  # Optional default RTSP URL
    STREAM_JPEG_QUALITY: int = 85
    CAMERA_RECONNECT_ATTEMPTS: int = 5
    CAMERA_RECONNECT_DELAY: float = 3.0

    class Config:
        env_file = ".env"


settings = Settings()
