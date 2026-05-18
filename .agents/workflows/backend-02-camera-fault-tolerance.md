---
description: 
---

# Luồng Xử lý Lỗi Camera (Fault Tolerance Workflow)

Trong môi trường nhà máy, camera băng chuyền có thể chập chờn điện, đứt mạng tạm thời. Hệ thống Backend tuyệt đối không được phép crash FastAPI khi mất luồng RTSP.

## Quy trình Tự phục hồi (Auto-Reconnect)

1. **Phát hiện Mất kết nối:**
   - Trong vòng lặp Thread `camera.py`, nếu `cv2.VideoCapture.read()` trả về `False` hoặc `None` liên tiếp (ví dụ 50 frames), xác định camera đã rớt.
2. **Kích hoạt Cơ chế Backoff:**
   - Giải phóng bộ nhớ `cap.release()`.
   - Thread không chết mà chuyển sang trạng thái Sleep.
   - Thử kết nối lại `cv2.VideoCapture(RTSP_URL)` sau 2 giây. Nếu thất bại, chờ 4 giây, 8 giây... (Exponential Backoff).
3. **Cảnh báo Frontend:**
   - Trong thời gian chờ kết nối, Backend gửi một Frame ảnh chờ (ảnh tĩnh ghi chữ "Camera Disconnected") hoặc gửi tín hiệu JSON qua WebSocket để Frontend hiển thị màn hình nhiễu sọc đỏ báo lỗi cho công nhân.
4. **Phục hồi:**
   - Khi kết nối thành công, khởi tạo lại các Queue đệm và vòng lặp tiếp tục đẩy frame vào mô hình AI.
