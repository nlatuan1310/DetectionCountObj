---
description: 
---

# Luồng Thu Thập & Quản Lý Dữ Liệu (Data Curation Workflow)

1. **Upload Kép (Dual-Storage):** 
   - Nhân viên/Admin tải ảnh của lô hàng vào Web UI.
   - Frontend gửi file (form-data) lên cho Backend xử lý.
   - Backend đẩy ảnh song song lên hệ thống **Cloudinary** $\rightarrow$ Lấy về đường link `secure_url`.
   - Backend đồng thời lưu file vật lý vào ổ đĩa máy chủ tại thư mục `local_cache/` (rename thành chuỗi UUID.jpg an toàn).
   - Lưu 1 record vào Database (bảng `images`) tích hợp cả 2 trường URL Cloud và Local path.
2. **Triage & Annotate:** 
   - Các ảnh mới tải lên lập tức vào trạng thái chờ nhãn (New Arrival).
   - User sử dụng Web Bounding-Box Tool trên frontend để khoanh vùng sản phẩm.
   - Tọa độ BBox được backend đón nhận và lưu vào bảng `annotations` theo chuẩn float (từ 0 đến 1, tâm x, tâm y, w, h).
3. **Golden Selection (Tuyển chọn tinh hoa):**
   - Định kỳ, chuyên viên lướt lại các bức ảnh đã gán nhãn, chọn ra những ảnh có ánh sáng và góc độ đẹp nhất.
   - Nhấn "Tuyển chọn" $\rightarrow$ Backend cập nhật trường `is_golden = True` ở bảng `images`, đưa bức ảnh đó vào "Golden Hub" để chống hiện tượng quên của AI.
