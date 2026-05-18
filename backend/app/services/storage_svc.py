import uuid
import logging
from pathlib import Path

import cloudinary
import cloudinary.uploader
from fastapi import UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)


def _init_cloudinary() -> None:
    """Khởi tạo Cloudinary SDK từ env config."""
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


class StorageService:
    """Quản lý lưu trữ kép: Cloudinary + Local Cache."""

    @staticmethod
    async def save_to_local_cache(file: UploadFile) -> tuple[str, str]:
        """
        Lưu file ảnh vào local cache với tên UUID.

        Returns:
            tuple: (local_path, uuid_filename)
        """
        cache_dir = Path(settings.LOCAL_CACHE_DIR)
        cache_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(file.filename or "unknown.jpg").suffix or ".jpg"
        uuid_name = f"{uuid.uuid4().hex}{ext}"
        file_path = cache_dir / uuid_name

        content = await file.read()
        file_path.write_bytes(content)
        # Reset file position cho Cloudinary upload
        await file.seek(0)

        logger.info("Saved to local cache: %s", file_path)
        return str(file_path), uuid_name

    @staticmethod
    async def upload_to_cloudinary(file: UploadFile, folder: str = "visionai") -> str | None:
        """
        Upload file lên Cloudinary.

        Returns:
            str | None: Cloudinary URL hoặc None nếu thất bại.
        """
        try:
            _init_cloudinary()
            content = await file.read()
            await file.seek(0)

            result = cloudinary.uploader.upload(
                content,
                folder=folder,
                resource_type="image",
            )
            url = result.get("secure_url", "")
            logger.info("Uploaded to Cloudinary: %s", url)
            return url
        except Exception as e:
            logger.error("Cloudinary upload failed: %s", str(e))
            return None

    @staticmethod
    async def upload_image(file: UploadFile) -> dict:
        """
        Upload kép: Cloudinary + Local Cache (Hybrid Storage).

        Returns:
            dict: {"local_path": str, "cloudinary_url": str | None, "original_filename": str}
        """
        original_filename = file.filename or "unknown.jpg"

        # Validate file size
        content = await file.read()
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if len(content) > max_bytes:
            raise ValueError(
                f"File {original_filename} vượt quá {settings.MAX_UPLOAD_SIZE_MB}MB"
            )
        await file.seek(0)

        # 1. Save to local cache (bắt buộc)
        local_path, _ = await StorageService.save_to_local_cache(file)

        # 2. Upload to Cloudinary (best-effort)
        cloudinary_url = await StorageService.upload_to_cloudinary(file)

        return {
            "local_path": local_path,
            "cloudinary_url": cloudinary_url,
            "original_filename": original_filename,
        }

    @staticmethod
    async def delete_image(local_path: str | None, cloudinary_url: str | None) -> None:
        """Xóa ảnh từ cả Local Cache và Cloudinary."""
        # Xóa local
        if local_path:
            path = Path(local_path)
            if path.exists():
                path.unlink()
                logger.info("Deleted local file: %s", local_path)

        # Xóa Cloudinary
        if cloudinary_url:
            try:
                _init_cloudinary()
                # Extract public_id từ URL
                # URL format: .../folder/filename.ext
                parts = cloudinary_url.split("/")
                # Lấy folder/filename (bỏ extension)
                public_id = "/".join(parts[-2:]).rsplit(".", 1)[0]
                cloudinary.uploader.destroy(public_id, resource_type="image")
                logger.info("Deleted from Cloudinary: %s", public_id)
            except Exception as e:
                logger.error("Cloudinary delete failed: %s", str(e))
