---
description: 
---

# Luồng Xử Lý Cảnh Báo (Warning Zone Workflow)

Đây là quy trình Frontend xử lý tính năng "Đường ranh giới cảnh báo" (Warning Line) dùng để đếm hoặc bắt lỗi sản phẩm đi ngang qua.

## 1. Cấu hình Đường Ranh (Line Configuration)
- User tương tác bằng UI (kéo thả các chấm đỏ "Interaction Points") để vẽ một đường thẳng chia đôi màn hình Video (Split-Zone).
- Tọa độ 2 điểm P1(x1, y1) và P2(x2, y2) của đường thẳng được lưu trữ.
- Màn hình có một nút Toggle "Flip Side" để xác định vùng nào là vùng Cảnh Báo (Warning Zone) và vùng nào là vùng An Toàn (Safe Zone).

## 2. Tính toán Va chạm (Crossing Detection)
- Trong vòng lặp `requestAnimationFrame` của luồng Rendering, với mỗi vật thể (Detection Box) nhận được:
  1. Tính điểm tâm đáy (Bottom-Center) của Bounding Box.
  2. Dùng công thức hình học Đại số (Cross Product) để xác định điểm tâm này đang nằm ở "bên trái" hay "bên phải" của Vector đường thẳng P1-P2.
  3. Đối chiếu với cờ "Flip Side" để kết luận vật thể có đang dẫm vào Warning Zone hay không.

## 3. Kích hoạt Cảnh Báo (Trigger Alerts)
- Nếu vật thể vào vùng cảnh báo:
  - Đổi màu khung Bounding Box của vật thể đó trên Canvas (vd: Xanh $\rightarrow$ Đỏ nhấp nháy).
  - Tăng biến đếm `warningCount`.
  - Cập nhật một state riêng biệt để kích hoạt giao diện cảnh báo (chớp viền màn hình, hoặc hiện Toast Notification "Phát hiện lỗi ở băng chuyền số 1!").
- Frontend định kỳ gửi thông số `warningCount` này về Backend lưu vào Database để phục vụ màn hình thống kê (Statistics).
