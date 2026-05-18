---
trigger: model_decision
---

# Dataset Management Rules

## 1. Quản lý Vòng đời Sản phẩm
- **Không Xóa Vật Lý:** Khi một sản phẩm ngưng sản xuất, **tuyệt đối không xóa** dữ liệu liên quan để tránh ảnh hưởng lịch sử hệ thống.
- **Dùng Cờ (Flag):** Chỉ cập nhật đổi `is_active = False` trong bảng `classes`.
- Mô hình YOLO mới sẽ tự động lọc bỏ thông tin từ class vô hiệu hóa, "chặt bỏ" Head phân loại cũ, từ chối dự đoán class bị vô hiệu hóa.

## 2. Quy tắc Chia Tách Dữ liệu (Split Rules)
- Tỷ lệ chuẩn: **70% Train - 20% Val - 10% Test**.
- **Chống Crash thuật toán Stratify:**
  - Bắt buộc phải **tách riêng biệt** rổ "Ảnh Có Nhãn" và rổ "Ảnh Trống" (Background Images) thành 2 list khác nhau.
  - Đối với rổ "Ảnh Có Nhãn": Dùng hàm `train_test_split(..., stratify=labels)`.
  - Đối với rổ "Ảnh Trống": Dùng `train_test_split(...)` bình thường, TUYỆT ĐỐI không có tham số stratify (vì nhãn rỗng).
  - Sau khi split độc lập xong mới tiến hành GỘP (Merge) lại tương ứng thành các tập `train`, `val`, `test`.

## 3. Golden Hub Limit
- Kho ảnh tinh hoa (Golden Hub) phải được giới hạn dung lượng tổng (ví dụ: tối đa 5000 ảnh) để tránh làm phình to chi phí ổ đĩa. 
- Chỉ những ảnh có cờ `is_golden = True` mới được tham gia vào luồng bốc ngẫu nhiên (mix data) cho các Project huấn luyện mới.
