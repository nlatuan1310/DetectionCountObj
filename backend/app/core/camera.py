import threading
import time
import logging
from urllib.parse import quote_plus
from typing import Optional

import cv2
import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)


class CameraManager:
    """
    Quản lý luồng đọc Camera RTSP trong thread riêng.

    Thread-safe: Sử dụng Lock để đảm bảo an toàn khi truy cập frame
    từ nhiều consumer (WebSocket clients) đồng thời.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self.inference_lock = threading.Lock()  # Shared với InferenceService cho Hot-swap
        self._frame: Optional[np.ndarray] = None
        self._cap: Optional[cv2.VideoCapture] = None
        self._thread: Optional[threading.Thread] = None
        self.is_running = False
        self.source_url: Optional[str] = None
        self._stop_event = threading.Event()

        # Metadata
        self._fps: float = 0.0
        self._resolution: Optional[tuple[int, int]] = None
        self._error: Optional[str] = None

    @staticmethod
    def build_rtsp_url(ip: str, username: str, password: str,
                       channel: int = 1, stream_type: int = 1) -> str:
        """
        Xây dựng RTSP URL chuẩn Hikvision từ thông tin đăng nhập.

        Format: rtsp://user:password@ip:554/Streaming/Channels/{channel}0{stream_type}
        - channel: 1=kênh 1, 2=kênh 2...
        - stream_type: 1=main stream (cao), 2=sub stream (thấp)
        """
        # Normalize IP: loại bỏ http://, https://, trailing slash, port
        clean_ip = ip.strip()
        for prefix in ("http://", "https://", "rtsp://"):
            if clean_ip.lower().startswith(prefix):
                clean_ip = clean_ip[len(prefix):]
        clean_ip = clean_ip.rstrip("/")
        # Loại bỏ port nếu có (VD: 192.168.1.64:80)
        if ":" in clean_ip:
            clean_ip = clean_ip.split(":")[0]

        encoded_user = quote_plus(username)
        encoded_pass = quote_plus(password)
        channel_id = f"{channel}0{stream_type}"
        return f"rtsp://{encoded_user}:{encoded_pass}@{clean_ip}:554/Streaming/Channels/{channel_id}"

    def start_stream(self, source: str) -> bool:
        """
        Khởi động luồng đọc camera.

        Args:
            source: RTSP URL hoặc đường dẫn file video

        Returns:
            True nếu kết nối thành công, False nếu thất bại
        """
        if self.is_running:
            self.stop_stream()

        self.source_url = source
        self._stop_event.clear()
        self._error = None

        # Thử kết nối trước khi spawn thread
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            self._error = f"Không thể kết nối tới camera: {source}"
            logger.error(self._error)
            cap.release()
            return False

        # Lấy metadata
        self._resolution = (
            int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        )
        self._fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        cap.release()

        # Spawn daemon thread để đọc liên tục
        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self.is_running = True
        self._thread.start()
        logger.info("Camera stream started: %s (Resolution: %s)", source, self._resolution)
        return True

    def stop_stream(self):
        """Dừng luồng đọc camera và giải phóng tài nguyên."""
        self._stop_event.set()
        self.is_running = False

        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=5.0)
            self._thread = None

        with self._lock:
            if self._cap is not None:
                self._cap.release()
                self._cap = None
            self._frame = None

        self.source_url = None
        self._resolution = None
        self._fps = 0.0
        self._error = None
        logger.info("Camera stream stopped.")

    def get_latest_frame(self) -> Optional[np.ndarray]:
        """
        Lấy frame mới nhất (thread-safe).

        Returns:
            Copy của frame hiện tại, hoặc None nếu chưa có frame
        """
        with self._lock:
            if self._frame is not None:
                return self._frame.copy()
            return None

    def get_status(self) -> dict:
        """Trả về trạng thái hiện tại của camera."""
        return {
            "is_connected": self.is_running,
            "source_url": self.source_url,
            "resolution": f"{self._resolution[0]}x{self._resolution[1]}" if self._resolution else None,
            "fps": self._fps,
            "error": self._error,
        }

    def _read_loop(self):
        """
        Vòng lặp đọc frame liên tục (chạy trong daemon thread).

        Tự động reconnect khi mất kết nối (max N lần, delay Xs).
        """
        max_retries = settings.CAMERA_RECONNECT_ATTEMPTS
        retry_delay = settings.CAMERA_RECONNECT_DELAY
        retry_count = 0

        cap = cv2.VideoCapture(self.source_url)
        if not cap.isOpened():
            self._error = "Không thể mở kết nối RTSP"
            self.is_running = False
            return

        with self._lock:
            self._cap = cap

        consecutive_failures = 0

        while not self._stop_event.is_set():
            ret, frame = cap.read()

            if not ret:
                consecutive_failures += 1
                if consecutive_failures >= 30:  # ~1 giây không đọc được frame
                    logger.warning("Camera mất kết nối, thử reconnect... (lần %d/%d)",
                                   retry_count + 1, max_retries)
                    retry_count += 1

                    if retry_count > max_retries:
                        self._error = "Đã vượt quá số lần thử kết nối lại"
                        logger.error(self._error)
                        break

                    cap.release()
                    time.sleep(retry_delay)

                    cap = cv2.VideoCapture(self.source_url)
                    if cap.isOpened():
                        with self._lock:
                            self._cap = cap
                        consecutive_failures = 0
                        logger.info("Reconnect camera thành công!")
                    else:
                        continue

                continue

            # Frame đọc thành công
            consecutive_failures = 0
            retry_count = 0

            with self._lock:
                self._frame = frame

        # Cleanup
        cap.release()
        with self._lock:
            self._cap = None
        self.is_running = False
        logger.info("Camera read loop exited.")


# Singleton instance
camera_manager = CameraManager()
