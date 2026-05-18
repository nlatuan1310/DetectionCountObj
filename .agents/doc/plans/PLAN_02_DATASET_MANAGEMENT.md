# Phần 2: Quản trị Dữ liệu & Triết lý Golden Dataset

## 1. Vòng đời của một bức ảnh sản phẩm mới
- **Thu thập:** Thay vì hệ thống tự động chụp bừa bãi sinh ra nhiều ảnh rác, nhân viên sẽ chủ động thu thập những bức ảnh rõ nét, đại diện tốt nhất cho sản phẩm mới.
- **Phân loại (Triage):** Ảnh tải lên mặc định sẽ mang thẻ "New Arrival". Nó được đưa vào hàng đợi chờ nhân viên gán nhãn.
- **Gán nhãn:** Thông qua giao diện web, nhân viên vẽ Box quanh sản phẩm. Tọa độ được chuẩn hóa và lưu thẳng vào Database.

## 2. Triết lý "Golden Dataset" (Kho dữ liệu tinh hoa)
Mô hình AI rất dễ bị hội chứng "Catastrophic Forgetting" (Học cái mới thì quên cái cũ). Golden Dataset là giải pháp chống lại điều này.
- **Định nghĩa:** Đây là một kho chứa các bức ảnh chuẩn mực nhất, đầy đủ góc độ nhất của các sản phẩm cũ đã từng được nhận diện tốt.
- **Tuyển chọn:** Hệ thống cung cấp một màn hình quản trị để Quản lý (Admin) lướt xem các ảnh đã gán nhãn. Những ảnh nào có chất lượng ánh sáng tốt, góc chụp đẹp sẽ được đánh dấu đặc biệt đưa vào kho "Golden".
- **Bảo trì:** Kho này cần được kiểm soát dung lượng (ví dụ duy trì ở mức 1000 ảnh) để tránh việc lưu trữ quá nhiều dữ liệu không cần thiết, nhưng vẫn phải đảm bảo tính đại diện.

## 3. Khái niệm "Dataset Ảo" (Virtual Dataset)
Hệ thống KHÔNG lưu trữ cấu trúc thư mục YOLO (train/val/test) vĩnh viễn trên ổ cứng.
- Mọi thứ chỉ tồn tại dưới dạng dữ liệu trong PostgreSQL.
- Khi có lệnh bắt đầu huấn luyện, hệ thống mới tự động "rút" dữ liệu từ DB và "lắp ráp" (export) ra cây thư mục vật lý chuẩn YOLO.
- Huấn luyện xong, cây thư mục vật lý này có thể được xóa đi để dọn dẹp hệ thống.

## 4. Quản lý Cấu trúc Project & Version (Luồng Xử lý Lô Dữ liệu)
Định nghĩa "Project" ở đây sẽ đóng vai trò là một **đợt thu thập và xử lý dữ liệu mới**, chứ không phải là kho chứa toàn bộ mọi thứ.

- **Cấp độ Project (Đợt thu thập dữ liệu):**
  - Giả sử hôm nay có sản phẩm mới. Bạn sẽ tạo một Project mới (Ví dụ: `Thêm Sản Phẩm A - 15/05`).
  - Bạn tải ảnh Sản phẩm A vào Project này và tiến hành gán nhãn.
  
- **Cấp độ Version (Áp dụng Bộ lọc & Tăng cường Dữ liệu):**
  - Trong Project đó, bạn tạo ra các Version (v1, v2...).
  - **Mục đích:** Chọn các **Filters** (Cân bằng sáng) và **Augmentations** (Lật, xoay, nhiễu).
  - **Nhân bản ảnh:** Số lượng ảnh sẽ được tự động nhân lên theo cấu hình Augmentations (dùng thư viện `Albumentations`).
  - **Export (Đóng băng lô dữ liệu mới):** Khi bấm Generate Version, lô dữ liệu mới này (đã được nhân bản) sẽ được xuất ra và "đóng băng" thành một khối dữ liệu độc lập.

- **Luồng Trộn Dữ liệu (Data Mixing) Tự động:**
  - Sau khi Version của Project mới được xuất ra thành công, khối dữ liệu này sẽ đóng vai trò là **80% dữ liệu học mới**.
  - Hệ thống lúc này mới móc nối sang **Kho Golden Dataset** (kho trung tâm chứa ảnh cũ) để rút ra **20% dữ liệu cũ** và hòa trộn lại với khối dữ liệu mới.
  - Hỗn hợp 100% này cuối cùng được đẩy qua luồng **Stratified Split (70-20-10)** để sinh ra bộ Dataset hoàn chỉnh đưa vào Train.
