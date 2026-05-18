# Tài Liệu Tổng Quan Dự Án: Web Dataset (YOLO Data Preparation & Management)

Dự án này là một hệ thống ứng dụng web chuyên dụng cho việc **chuẩn bị, quản lý, gán nhãn (annotation) và tăng cường dữ liệu (data augmentation)** để huấn luyện các mô hình Computer Vision, đặc biệt tối ưu cho dòng mô hình **YOLO (You Only Look Once)**.

Hệ thống được thiết kế không chỉ mạnh mẽ về mặt chức năng AI mà còn sở hữu **giao diện UI/UX cực kỳ hiện đại (Glassmorphism, Neon, Particle Effects)**.

Dưới đây là chi tiết toàn diện về kiến trúc, các công nghệ sử dụng, cấu trúc thư mục và phân tích chức năng chuyên sâu của dự án.

---

## 1. Kiến Trúc Hệ Thống (Architecture)
Dự án áp dụng kiến trúc **Client-Server** phân tách hoàn toàn, giao tiếp qua RESTful API và Streaming:
- **Frontend (Client):** Single Page Application (SPA) xử lý UI phức tạp, tương tác thời gian thực (vẽ box, kéo thả slider) và quản lý luồng hiển thị (React Router).
- **Backend (Server):** Xử lý các tác vụ tiêu tốn tài nguyên phần cứng như giải mã video, nén video, filter ảnh ma trận và đóng gói file zip.

---

## 2. Công Nghệ Sử Dụng (Tech Stack) Chi Tiết

### 2.1. Frontend (Giao diện người dùng)
Hệ thống Frontend được đầu tư rất mạnh về mặt hiệu ứng thị giác và trải nghiệm người dùng:
- **Framework Core:** **React 19** kết hợp với **Vite** (Build tool siêu tốc độ).
- **Ngôn ngữ:** JavaScript / JSX.
- **Styling & CSS:** 
  - **TailwindCSS v4**: Sử dụng các class tiện ích thế hệ mới.
  - **shadcn/ui & Radix UI**: Core components cho tính năng (Dialog, Tabs, Slider, Checkbox...).
- **Hiệu Ứng & Animation (Đặc biệt):**
  - **Framer Motion (`motion`)** & `@paper-design/shaders`: Thư viện xử lý chuyển động mượt mà.
  - Hệ thống sở hữu bộ Custom UI Components đồ sộ tạo hiệu ứng thị giác như: `neon-gradient-card` (thẻ phát sáng), `particles` (hạt chuyển động), `meteors` (sao băng), `moving-grid` (lưới động không gian), `shimmer-button`, `spotlight-card`.
- **Routing:** **React Router v7** (`react-router-dom`) để định tuyến trang.
- **Icons:** **Lucide React**.

### 2.2. Backend (Máy chủ xử lý AI & Media)
- **Framework Core:** **FastAPI** (Hỗ trợ Async/Await chuẩn ASGI, tự động hóa tài liệu Swagger/Redoc).
- **Web Server:** **Uvicorn**.
- **Xử lý Ảnh & Computer Vision:**
  - **OpenCV (`cv2`)**: Đọc/ghi ảnh, trích xuất frame, proxy stream camera.
- **Xử lý Video chuyên sâu:**
  - **FFmpeg (`imageio_ffmpeg`)** & `subprocess`: Chạy ngầm tiến trình FFmpeg để convert video về chuẩn web (H.264, xóa kênh âm thanh để nhẹ file).
- **Data Augmentation:**
  - **Albumentations**: Xử lý nhiễu ảnh, lật xoay và tự động scale/xoay lại tọa độ các Bounding Box theo ma trận biến đổi.

---

## 3. Phân Tích Các Chức Năng Cốt Lõi (Core Features)

### 3.1. Trích Xuất & Xử Lý Video (Video Extractor) - `video_service.py`
- **Tính năng:** Upload video thô và convert/chia tách.
- **Bên trong hoạt động:** 
  - Sử dụng module `imageio_ffmpeg` để gọi `FFmpeg` ở dưới backend.
  - Convert video sang chuẩn `libx264` (codec tiêu chuẩn cho trình duyệt) và loại bỏ âm thanh (`-an`) để giảm kích thước.
  - Hệ thống đọc output log của FFmpeg (dùng biểu thức chính quy Regex) để tính % tiến độ (Frames processed / Total frames) và lưu trữ vào bộ nhớ, cho phép Frontend gọi API `/convert-status/{task_id}` để lấy thanh tiến trình realtime.

### 3.2. Kết Nối Camera IP Thời Gian Thực - `camera.py`
- **Tính năng:** Truy cập luồng stream trực tiếp từ Camera IP (đặc biệt hỗ trợ tốt cho Hikvision) vào giao diện Web.
- **Bên trong hoạt động:**
  - Tự động chuẩn hóa URL (bỏ `http`, parse lại user/password encode) -> tạo chuỗi kết nối RTSP (`rtsp://.../Streaming/Channels/101`).
  - Dùng `cv2.VideoCapture` để đọc luồng.
  - Nén frame sang `.jpg` chất lượng cao và proxy (bơm) thẳng luồng MJPEG (Multipart X-Mixed-Replace) về Frontend qua API `/camera/stream`. Giúp xem camera độ trễ siêu thấp trên trình duyệt.

### 3.3. Gán Nhãn Dữ Liệu (Annotation / Labeling)
- **Tính năng:** Công cụ gắn nhãn vật thể trên ảnh.
- **Chi tiết:** 
  - Quản lý danh sách các Class name (nhãn).
  - Cho phép dùng chuột vẽ Bounding Boxes.
  - Tự động quy đổi từ tọa độ màn hình (pixel) sang tọa độ chuẩn YOLO: `[x_center, y_center, width, height]` dạng số thực (0.0 -> 1.0) không phụ thuộc vào kích thước ảnh.

### 3.4. Tăng Cường Dữ Liệu (Data Augmentation) - `augmentation.py`
- **Tính năng:** Biến hóa bộ dữ liệu hạn chế thành tập dataset lớn.
- **Các bộ lọc (Filters):** Lật ngang/dọc (Flip), Xoay an toàn (SafeRotate), Tương phản sáng tối (BrightnessContrast), Làm mờ (Blur), Nhiễu hạt (Gaussian Noise).
- **Điểm ưu việt:** Nhờ tích hợp pipeline của thư viện `Albumentations`, mọi thay đổi cấu trúc không gian (xoay, lật) sẽ được áp dụng trực tiếp lên tọa độ các thẻ nhãn (Boxes). Nếu ảnh xoay 90 độ, hộp nhãn sẽ tự xoay 90 độ theo vật thể.

### 3.5. Đóng Gói & Xuất Dataset (Export Dataset) - `export.py`
- **Tính năng:** Đóng gói toàn bộ cấu trúc thư mục ra chuẩn YOLO format để training.
- **Bên trong hoạt động:**
  - Chức năng tự động chia tỉ lệ tập dữ liệu (Split Ratio) thành 3 tập: `Train`, `Val` (Validation), và `Test`.
  - Tự động tạo cấu trúc thư mục khắt khe của YOLO:
    ```
    dataset/
      images/
        train/, val/, test/
      labels/
        train/, val/, test/
    ```
  - Tạo file YAML cấu hình (`data.yaml`) khai báo danh sách Class tự động.
  - Nén tất cả thành file ZIP (`shutil.make_archive`) và trả thẳng về trình duyệt cho người dùng (`FileResponse`).

### 3.6. Quản Lý Phiên Bản Dataset (Dataset Versions)
- Giao diện thống kê, tổ chức các cụm dữ liệu đã lưu trữ, cho phép quản lý vòng đời dataset từ lúc mới gán nhãn cho đến khi export xong, tránh thất thoát hoặc lẫn lộn dữ liệu giữa các model.

---

## 4. Đặc Trưng Nổi Bật (Highlights)
- **UI/UX Đỉnh Cao:** Không giống các tool chuẩn bị dữ liệu mã nguồn mở thông thường với giao diện cũ kỹ, hệ thống này tích hợp sẵn các animations và design systems (Neon Card, Background Particles) tạo cảm giác cực kỳ chuyên nghiệp và tương lai.
- **Hiệu Năng Tối Ưu:** Sử dụng các tác vụ bất đồng bộ (Background Tasks) ở Backend để những công việc nặng nhọc như FFmpeg Convert Video hay Nén thư mục ZIP không làm đơ trang web.
- **Toàn Diện (All-in-One):** Đi từ khâu kết nối Camera RTSP -> Thu thập ảnh -> Gán nhãn -> Tăng cường dữ liệu -> Xuất ra file YAML/TXT chỉ trên một màn hình ứng dụng duy nhất.
