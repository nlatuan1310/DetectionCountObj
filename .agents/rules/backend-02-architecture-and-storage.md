---
trigger: always_on
---

# Architecture & Storage Rules

## 1. Decoupled Architecture
- Luồng **Inference (Camera)** và luồng **Web/Training API** phải chạy hoàn toàn độc lập (dùng `multiprocessing` hoặc `Threading` riêng rẽ). Tránh việc luồng training làm sập stream camera.

## 2. Hybrid Storage (Lưu Trữ Kép)
- **Cloudinary:** Toàn bộ ảnh phục vụ hiển thị trên Web Frontend bắt buộc lưu trên Cloudinary để giảm tải băng thông server. DB chỉ lưu `cloudinary_url`.
- **Local Cache:** Mọi ảnh upload phải được copy một bản vào thư mục `local_cache/` (lưu file dưới tên UUID.jpg) trên ổ đĩa server.
- **Rule Mạng:** Luồng Training **TUYỆT ĐỐI KHÔNG** được tải ảnh trực tiếp từ Cloudinary (sẽ gây thắt cổ chai mạng). Phải đọc file vật lý trực tiếp từ `local_cache`.

## 3. Database Schema (Virtual Dataset Core)
Hệ thống không duy trì vĩnh viễn cấu trúc thư mục YOLO (`train/`, `val/`, `test/`). 
Mọi quan hệ hình ảnh, nhãn đều lưu trong Database. Thiết kế Schema bắt buộc phải có các Entity sau:
- **`classes`**: `id`, `name`, `is_active` (boolean, default=True)
- **`projects`**: `id`, `name`, `created_at`
- **`images`**: `id`, `project_id`, `cloudinary_url`, `local_path`, `is_golden` (boolean), `is_background` (boolean)
- **`annotations`**: `id`, `image_id`, `class_id`, `bbox_x`, `bbox_y`, `bbox_w`, `bbox_h` (float 0-1 chuẩn YOLO)
- **`dataset_versions`**: `id`, `project_id`, `augmentation_config` (JSON)
- **`models`**: `id`, `version_name`, `file_path` (.pt), `map50`, `is_active_model` (boolean)
