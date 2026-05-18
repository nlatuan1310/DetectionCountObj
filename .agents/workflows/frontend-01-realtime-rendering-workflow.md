---
description: 
---

# Luồng Hiển Thị Real-time (Inference Rendering Workflow)

Luồng hoạt động từ lúc Frontend bắt đầu kết nối đến luồng nhận diện AI và vẽ kết quả lên giao diện.

## 1. Khởi tạo Kết nối
- Khi User vào trang Dashboard, Frontend (React) mở 2 kết nối song song:
  1. **Kết nối Video:** Thẻ `<img src="http://[backend_ip]/api/stream" />` để hứng luồng MJPEG.
  2. **Kết nối Data:** Mở `WebSocket` tới `ws://[backend_ip]/api/ws/detections` để hứng luồng tọa độ JSON.

## 2. Xử lý Dữ liệu Tọa độ (JSON Parsing)
- JSON trả về từ Backend (thông qua ByteTrack/YOLO) có dạng: `[{id: 1, class: "Banh_A", box: [x, y, w, h]}]`. Tọa độ `box` là dạng chuẩn hóa từ `0.0` đến `1.0`.
- Đẩy dữ liệu này vào một biến `useRef(detections)` thay vì `useState` để không làm Component cha re-render liên tục.

## 3. Vẽ đè Canvas (Overlay Drawing)
- Đặt một thẻ `<canvas>` nằm đè lên trên thẻ `<img>` (dùng CSS `position: absolute`, `z-index`).
- Kích hoạt vòng lặp `requestAnimationFrame`:
  1. Lấy kích thước hiện tại của `<canvas>` (`width`, `height`).
  2. Clear frame cũ: `ctx.clearRect(0, 0, width, height)`.
  3. Lấy dữ liệu mới nhất từ `useRef(detections)`.
  4. Duyệt mảng `detections`, nhân tọa độ với `width` và `height` để vẽ khung chữ nhật (Bounding Box) và Text (Tên + ID Track).

## 4. Disconnect (Dọn dẹp)
- Khi User rời trang hoặc bấm "Disconnect", hook `useEffect` phải gọi cleanup function: đóng WebSocket (`ws.close()`), clear luồng MJPEG (`img.src=""`), và `cancelAnimationFrame` để giải phóng bộ nhớ RAM của trình duyệt.
