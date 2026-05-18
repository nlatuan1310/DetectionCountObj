import threading
import time
import logging
from typing import Optional

import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

from app.core.config import settings

logger = logging.getLogger(__name__)


class InferenceService:
    """
    Service xử lý YOLO Inference + ByteTrack Tracking.

    Thiết kế thread-safe với Lock để hỗ trợ Hot-swap model
    mà không làm sập stream camera đang chạy.
    """

    def __init__(self, inference_lock: threading.Lock):
        self._lock = inference_lock
        self.model: Optional[YOLO] = None
        self.model_name: str = ""
        self.device: str = ""
        self.confidence: float = settings.YOLO_CONFIDENCE
        self.inference_enabled: bool = True

        # Tracking
        self.tracker = sv.ByteTrack(
            track_activation_threshold=0.25,
            lost_track_buffer=30,
            minimum_matching_threshold=0.8,
            frame_rate=30,
        )

        # Annotators
        self.box_annotator = sv.BoxAnnotator(
            thickness=2,
        )
        self.label_annotator = sv.LabelAnnotator(
            text_scale=0.5,
            text_thickness=1,
            text_padding=5,
        )

        # Zone config (ROI, counting line, warning line)
        self._roi_polygon: Optional[np.ndarray] = None
        self._roi_zone: Optional[sv.PolygonZone] = None
        self._counting_line_start: Optional[sv.Point] = None
        self._counting_line_end: Optional[sv.Point] = None
        self._line_zone: Optional[sv.LineZone] = None
        self._warning_line_start: Optional[sv.Point] = None
        self._warning_line_end: Optional[sv.Point] = None
        self._warning_flip: bool = False

        # Stats
        self._last_inference_time: float = 0.0
        self._crossing_total: int = 0
        self._prev_crossed_ids: set = set()  # Track IDs đã qua vạch

        # Frame dimensions (cần để convert normalized coords)
        self._frame_width: int = 0
        self._frame_height: int = 0

    def load_model(self, model_path: Optional[str] = None) -> bool:
        """
        Load YOLO model. Tự động detect CUDA/CPU.

        Args:
            model_path: Đường dẫn file .pt. Mặc định dùng config.

        Returns:
            True nếu load thành công
        """
        path = model_path or settings.YOLO_MODEL_PATH

        try:
            with self._lock:
                self.model = YOLO(path)

                # Auto-detect device
                if settings.YOLO_DEVICE:
                    self.device = settings.YOLO_DEVICE
                else:
                    import torch
                    self.device = "cuda:0" if torch.cuda.is_available() else "cpu"

                # Warm-up inference
                self.model.to(self.device)
                self.model_name = path

                logger.info("Model loaded: %s on device: %s", path, self.device)
                return True

        except Exception as e:
            logger.error("Lỗi load model '%s': %s", path, str(e))
            self.model = None
            return False

    def update_zones(self, frame_width: int, frame_height: int,
                     roi_points: Optional[list[list[float]]] = None,
                     counting_line: Optional[list[list[float]]] = None,
                     warning_line: Optional[list[list[float]]] = None,
                     warning_flip: bool = False):
        """
        Cập nhật cấu hình zones (ROI, counting line, warning line).

        Tọa độ đầu vào là normalized (0.0-1.0), sẽ convert sang pixel.
        """
        self._frame_width = frame_width
        self._frame_height = frame_height

        # ROI polygon
        if roi_points and len(roi_points) >= 3:
            polygon_px = np.array([
                [int(p[0] * frame_width), int(p[1] * frame_height)]
                for p in roi_points
            ], dtype=np.int32)
            self._roi_polygon = polygon_px
            self._roi_zone = sv.PolygonZone(
                polygon=polygon_px,
            )
            logger.info("ROI zone updated: %d points", len(roi_points))
        else:
            self._roi_polygon = None
            self._roi_zone = None

        # Counting line
        if counting_line and len(counting_line) == 2:
            start = sv.Point(
                x=int(counting_line[0][0] * frame_width),
                y=int(counting_line[0][1] * frame_height)
            )
            end = sv.Point(
                x=int(counting_line[1][0] * frame_width),
                y=int(counting_line[1][1] * frame_height)
            )
            self._counting_line_start = start
            self._counting_line_end = end
            self._line_zone = sv.LineZone(
                start=start,
                end=end,
            )
            # Reset counting khi vẽ lại line
            self._crossing_total = 0
            self._prev_crossed_ids = set()
            logger.info("Counting line updated")
        else:
            self._line_zone = None

        # Warning line
        if warning_line and len(warning_line) == 2:
            self._warning_line_start = sv.Point(
                x=int(warning_line[0][0] * frame_width),
                y=int(warning_line[0][1] * frame_height)
            )
            self._warning_line_end = sv.Point(
                x=int(warning_line[1][0] * frame_width),
                y=int(warning_line[1][1] * frame_height)
            )
            self._warning_flip = warning_flip
            logger.info("Warning line updated")
        else:
            self._warning_line_start = None
            self._warning_line_end = None

    def detect(self, frame: np.ndarray) -> tuple[np.ndarray, dict]:
        """
        Chạy inference trên một frame.

        Args:
            frame: BGR frame từ camera

        Returns:
            Tuple (annotated_frame, stats_dict)
        """
        stats = {
            "inference_fps": 0.0,
            "total_detections": 0,
            "class_counts": {},
            "crossing_counts": {},
            "warnings": [],
        }

        # Nếu inference tắt hoặc model chưa load → trả frame gốc
        if not self.inference_enabled or self.model is None:
            return frame, stats

        h, w = frame.shape[:2]
        if self._frame_width != w or self._frame_height != h:
            self._frame_width = w
            self._frame_height = h

        start_time = time.perf_counter()

        with self._lock:
            if self.model is None:
                return frame, stats

            # --- YOLO Inference ---
            results = self.model(
                frame,
                conf=self.confidence,
                device=self.device,
                verbose=False,
            )[0]

        # Convert sang supervision Detections
        detections = sv.Detections.from_ultralytics(results)

        # --- ROI Filter ---
        if self._roi_zone is not None:
            mask = self._roi_zone.trigger(detections=detections)
            detections = detections[mask]

        # --- ByteTrack ---
        detections = self.tracker.update_with_detections(detections)

        # --- Counting Line (chỉ tính tổng qua vạch) ---
        if self._line_zone is not None:
            self._line_zone.trigger(detections=detections)
            # Đếm tổng: mỗi tracker_id chỉ tính 1 lần khi qua vạch
            if detections.tracker_id is not None:
                for i, tid in enumerate(detections.tracker_id):
                    tid_int = int(tid)
                    # Kiểm tra bottom center có qua line không bằng cross product
                    if self._counting_line_start and self._counting_line_end:
                        bbox = detections.xyxy[i]
                        bottom_center = np.array([
                            (bbox[0] + bbox[2]) / 2, bbox[3]
                        ])
                        line_s = np.array([self._counting_line_start.x, self._counting_line_start.y])
                        line_e = np.array([self._counting_line_end.x, self._counting_line_end.y])
                        cross = np.cross(line_e - line_s, bottom_center - line_s)
                        # Nếu cross < 0 → đã qua phía bên kia
                        if cross < 0 and tid_int not in self._prev_crossed_ids:
                            self._crossing_total += 1
                            self._prev_crossed_ids.add(tid_int)

        # --- Tính class counts ---
        class_names = results.names
        class_counts: dict[str, int] = {}
        for class_id in detections.class_id:
            name = class_names.get(int(class_id), f"class_{class_id}")
            class_counts[name] = class_counts.get(name, 0) + 1

        # --- Warning zone logic ---
        warnings: list[str] = []
        if self._warning_line_start is not None and self._warning_line_end is not None:
            warning_detections = self._check_warning_zone(detections, class_names)
            if warning_detections:
                warnings.extend(warning_detections)

        # --- Annotate frame ---
        annotated = frame.copy()

        # NOTE: ROI, counting line, warning line được vẽ bởi frontend canvas overlay
        # Backend chỉ vẽ bbox + label + chấm đỏ

        # Vẽ bounding boxes + labels + chấm đỏ ở đáy bbox
        labels = []
        for i in range(len(detections)):
            class_id = detections.class_id[i]
            name = class_names.get(int(class_id), f"class_{class_id}")
            conf = detections.confidence[i]
            tracker_id = detections.tracker_id[i] if detections.tracker_id is not None else ""
            labels.append(f"#{tracker_id} {name} {conf:.2f}")

            # Chấm đỏ ở bottom center (sát mép dưới bounding box)
            bbox = detections.xyxy[i]
            bottom_center_x = int((bbox[0] + bbox[2]) / 2)
            bottom_center_y = int(bbox[3])
            cv2.circle(annotated, (bottom_center_x, bottom_center_y), 6, (0, 0, 255), -1)
            cv2.circle(annotated, (bottom_center_x, bottom_center_y), 8, (0, 0, 200), 2)

        annotated = self.box_annotator.annotate(scene=annotated, detections=detections)
        annotated = self.label_annotator.annotate(
            scene=annotated, detections=detections, labels=labels
        )

        # --- Tính FPS ---
        inference_time = time.perf_counter() - start_time
        self._last_inference_time = inference_time

        stats = {
            "inference_fps": round(1.0 / inference_time, 1) if inference_time > 0 else 0.0,
            "total_detections": len(detections),
            "class_counts": class_counts,
            "crossing_total": self._crossing_total,
            "warnings": warnings,
        }

        return annotated, stats

    def _check_warning_zone(self, detections: sv.Detections,
                            class_names: dict) -> list[str]:
        """
        Kiểm tra xem đối tượng nào nằm trong vùng cảnh báo.

        Sử dụng vị trí tâm đáy bounding box (bottom center)
        để xác định đối tượng ở phía nào của warning line.
        """
        warnings = []
        if len(detections) == 0:
            return warnings

        line_start = np.array([self._warning_line_start.x, self._warning_line_start.y])
        line_end = np.array([self._warning_line_end.x, self._warning_line_end.y])
        line_vec = line_end - line_start

        for i in range(len(detections)):
            bbox = detections.xyxy[i]
            # Tâm đáy bounding box
            bottom_center = np.array([
                (bbox[0] + bbox[2]) / 2,
                bbox[3]
            ])
            point_vec = bottom_center - line_start
            cross = np.cross(line_vec, point_vec)

            # Xác định phía dựa vào cross product
            is_warning_side = (cross < 0) if not self._warning_flip else (cross > 0)

            if is_warning_side:
                class_id = detections.class_id[i]
                name = class_names.get(int(class_id), f"class_{class_id}")
                conf = detections.confidence[i]
                warnings.append(f"{name} (conf: {conf:.2f}) trong vùng cảnh báo")

        return warnings

    def swap_model(self, new_model_path: str) -> bool:
        """
        Hot-swap model mới mà không làm sập stream.

        Quy trình:
        1. Acquire lock (stream tạm ngưng inference ~1s)
        2. Clear VRAM
        3. Load model mới
        4. Release lock → stream tiếp tục
        """
        logger.info("Bắt đầu hot-swap model: %s", new_model_path)

        try:
            with self._lock:
                # Clear model cũ
                if self.model is not None:
                    del self.model
                    self.model = None

                    # Clear VRAM nếu dùng CUDA
                    if "cuda" in self.device:
                        import torch
                        torch.cuda.empty_cache()
                        logger.info("VRAM cleared.")

                # Load model mới
                self.model = YOLO(new_model_path)
                self.model.to(self.device)
                self.model_name = new_model_path

                # Reset tracker
                self.tracker.reset()

            logger.info("Hot-swap hoàn tất: %s", new_model_path)
            return True

        except Exception as e:
            logger.error("Hot-swap thất bại: %s", str(e))
            return False

    def get_status(self) -> dict:
        """Trả về trạng thái hiện tại của inference service."""
        class_names = []
        if self.model is not None:
            try:
                class_names = list(self.model.names.values())
            except Exception:
                pass

        return {
            "model_loaded": self.model is not None,
            "model_name": self.model_name,
            "device": self.device,
            "confidence": self.confidence,
            "inference_enabled": self.inference_enabled,
            "class_names": class_names,
        }


# Sẽ được init trong main.py với shared lock từ CameraManager
inference_service: Optional[InferenceService] = None
