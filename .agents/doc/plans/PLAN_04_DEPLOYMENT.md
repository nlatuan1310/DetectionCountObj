# Phần 4: Ý tưởng Triển khai Động (Hot-Swap) và Quản lý Phiên bản

## 1. Khái niệm Quản lý Phiên bản (Versioning)
Sau mỗi lần huấn luyện thành công, hệ thống không ghi đè lên "bộ não" cũ.
- Một phiên bản mô hình mới sẽ được lưu lại kèm theo các chỉ số sức khỏe (như độ chính xác mAP, thời gian train, dữ liệu đã dùng).
- Quản trị viên có thể xem lịch sử các mô hình và chọn một mô hình ưng ý nhất để đưa lên băng chuyền (Rollback hoặc Upgrade).

## 2. Ý tưởng Triển khai Động (Hot-Swap)
Trong môi trường nhà máy, băng chuyền chạy liên tục. Nếu phải tắt server web để cập nhật mô hình AI, chúng ta sẽ bỏ lỡ việc đếm rất nhiều sản phẩm.
- **Ý tưởng Hot-Swap:** Cập nhật bộ não khi hệ thống đang thức.
- **Luồng hoạt động:** 
  1. Khi người quản trị bấm "Cập nhật Model", luồng xử lý Camera (Inference) sẽ được phát tín hiệu "Tạm ngưng".
  2. Băng chuyền video vẫn chảy, nhưng AI sẽ nhắm mắt trong khoảng ~1 giây.
  3. Hệ thống tiến hành "rửa" sạch bộ nhớ Card đồ họa (VRAM) để dọn chỗ.
  4. "Bộ não" mới được nạp vào VRAM.
  5. AI mở mắt và tiếp tục nhận diện, đếm sản phẩm với kiến thức mới ngay lập tức. Toàn bộ quá trình diễn ra ngầm, giao diện Web không hề bị đứng hay sập.

## 3. Tự động Đồng bộ Giao diện (UI Sync)
Khi "bộ脑" mới được lắp vào, nó sẽ mang theo danh sách tên các sản phẩm mới (Classes).
- Hệ thống backend sẽ tự động phát tín hiệu báo cho màn hình Giao diện điều khiển (Frontend).
- Ngay lập tức, trong mục cài đặt cảnh báo và đếm số lượng của người dùng, các tên sản phẩm mới sẽ tự động xuất hiện để nhân viên có thể cấu hình ngay mà không cần làm mới (F5) trang web.
