# Phần 1: Kiến trúc Hệ thống & Triết lý Thiết kế

## 1. Môi trường & Tech Stack Cụ thể
- **Backend Environment:** Python 3.11+, FastAPI 0.100+, Uvicorn.
- **Database (Metadata):** Neon PostgreSQL Serverless (Quản lý qua SQLAlchemy 2.0 & Alembic).
- **Storage (Image/Media):** **Cloudinary**. Mọi hình ảnh chụp từ băng chuyền hoặc tải lên sẽ được lưu trữ trực tiếp trên Cloudinary để tối ưu tốc độ load trên Web, giảm tải cho Database.
- **Frontend Environment:** Node 20+, React 19, Vite, Tailwind CSS 4.0. Thư viện fetch: `Axios` hoặc `TanStack Query`.
- **Computer Vision:** `ultralytics` (YOLO), `supervision` (ByteTrack).

## 2. Kiến trúc Cơ sở Dữ liệu (PostgreSQL trên Neon)
Hệ thống số hóa toàn bộ quản lý dataset vào Database:
- **Bảng Dự án (Projects):** Đóng vai trò là các "Đợt thu thập dữ liệu" (Batches). Project chứa ảnh gốc và nhãn gốc của đợt đó.
- **Bảng Phiên bản (Dataset Versions):** Nằm bên trong Project. Quản lý việc áp dụng Filters và Augmentations.
- **Kho Golden (Golden Hub):** Quản lý tập trung các ảnh tinh hoa nhất.
- **Bảng Sản phẩm (Classes - Giải quyết Bài toán Ngưng Sản Xuất):** Quản lý các loại sản phẩm. Thêm cờ `is_active = True/False`. Nếu một sản phẩm ngưng sản xuất, chỉ cần chuyển trạng thái thành `False`. Hệ thống Train sẽ tự động bỏ qua sản phẩm này mà không cần xóa vật lý.
- **Bảng Hình ảnh (Images):** Quản lý mọi bức ảnh. **Lưu ý:** Bảng này KHÔNG lưu ảnh dưới dạng nhị phân (BYTEA) mà chỉ lưu **`image_url` (Đường dẫn Cloudinary)**. Các file ảnh trong Local Cache chỉ cần lưu chung 1 thư mục phẳng (đặt tên theo mã Hash `UUID.jpg`), Database sẽ tự động tra cứu xem ảnh đó thuộc sản phẩm nào. Việc "chia thư mục theo sản phẩm" kiểu thủ công không còn cần thiết với hệ thống lõi DB nữa.
- **Bảng Nhãn (Annotations):** Lưu trữ tọa độ toán học Bounding Box.

## 3. Luồng Tương tác & Kiến trúc Phân Tách (Decoupled Architecture)
Mặc dù hiện tại máy Train và máy Chạy nhận diện (Inference) đang chung 1 máy chủ vật lý chia sẻ GPU, nhưng kiến trúc hệ thống được thiết kế **Decoupled (Phân tách hoàn toàn)** để sẵn sàng chia ra 2 máy khác nhau sau này:
1. **Lưu trữ Kép (Hybrid Storage - Local Cache):** 
   - **Cloudinary:** Chỉ dùng để phục vụ hiển thị ảnh tốc độ cao trên giao diện Web (Frontend) cho người dùng thao tác vẽ nhãn.
   - **Local Cache (Ổ cứng/NAS):** Khi nhân viên upload ảnh lên Web, Backend ngoài việc lấy link Cloudinary thì **bắt buộc lưu một bản copy** của ảnh gốc vào thư mục Cache cục bộ trên máy chủ.
2. **Luồng Inference:** Camera truyền ảnh vào *Máy Detection*. Khi có model mới, nó tự động hotswap file `.pt` để chạy.
3. **Luồng Training siêu tốc:** Khi quản trị viên bấm "Train" trên Web, *Máy Train* sẽ kết nối lấy tọa độ từ Neon DB, nhưng **tuyệt đối không tải ảnh từ Cloudinary**. Thay vào đó, nó bốc thẳng ảnh từ **Local Cache** để lắp ráp thành thư mục YOLO vật lý trong tích tắc. Tránh lãng phí băng thông mạng và tối đa hóa tốc độ chuẩn bị dữ liệu.
