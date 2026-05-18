# VisionAI - Detection Count Object

Dự án đếm và nhận diện đối tượng tích hợp MLOps Pipeline.

## 🚀 Hướng dẫn khởi chạy Backend (Docker)

Backend của dự án được đóng gói hoàn toàn bằng Docker, giúp bạn không cần cài đặt các thư viện phức tạp trên máy tính cá nhân.

### Yêu cầu hệ thống
- Đã cài đặt và bật [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### Các lệnh thao tác cơ bản

Mở terminal ở **thư mục gốc của dự án** (`DetectionCountObj`) và chạy các lệnh sau:

**1. Khởi động hệ thống lần đầu (hoặc khi có cập nhật thư viện)**
Lệnh này sẽ build lại image (nếu cần) và chạy ngầm hệ thống:
```bash
docker-compose up -d --build
```

**2. Khởi động hệ thống hằng ngày**
Nếu bạn không cài thêm thư viện mới, chỉ cần chạy lệnh này để bật server lên ngay lập tức:
```bash
docker-compose up -d
```

**3. Xem log hoạt động**
Để theo dõi các tiến trình, lỗi, hoặc log in ra từ Backend:
```bash
docker-compose logs -f backend
```
*(Nhấn `Ctrl + C` để thoát khỏi màn hình xem log, hệ thống vẫn sẽ tiếp tục chạy ngầm).*

**4. Tắt hệ thống**
Để tắt backend và giải phóng tài nguyên máy tính:
```bash
docker-compose down
```
> **Lưu ý:** Dữ liệu ảnh bạn upload vẫn sẽ được an toàn do đã được cấu hình lưu ở thư mục `backend/data` trên máy thật.

### 🌐 Truy cập API Docs
Sau khi khởi chạy thành công, bạn có thể xem và test các API tại:
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 💻 Hướng dẫn phát triển (Dành cho Developer)

- **Hot-reload:** Hệ thống đã được cấu hình tự động reload. Bất cứ khi nào bạn chỉnh sửa và lưu file mã nguồn `.py` trong thư mục `backend`, server sẽ tự động khởi động lại ngay lập tức.
- **Biến môi trường:** Các cấu hình Database (Neon), Cloudinary,... được đặt trong file `backend/.env`. Hãy copy từ file `.env.example` và điền thông tin tương ứng.

## 🎨 Hướng dẫn khởi chạy Frontend

Mở một terminal khác, di chuyển vào thư mục `frontend` và chạy lệnh:
```bash
cd frontend
npm install   # Chỉ cần chạy lần đầu
npm run dev   # Chạy server frontend
```
Giao diện web sẽ được phục vụ tại `http://localhost:5173`.