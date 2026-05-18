# Tài Liệu Dự Án: VisionAI - Real-time Conveyor Belt Counting

## 1. Tổng Quan Dự Án
VisionAI là một hệ thống giám sát, đếm và nhận diện đối tượng theo thời gian thực trên băng chuyền. Hệ thống sử dụng mô hình học sâu YOLO để nhận diện và theo dõi các đối tượng, kết hợp với giao diện web hiện đại để cấu hình vùng theo dõi, hiển thị video trực tiếp và báo cáo số liệu thống kê.

## 2. Kiến Trúc Công Nghệ (Technology Stack)
### 2.1. Frontend (Giao diện người dùng)
- **Framework:** React , Vite.
- **Styling & UI:** Tailwind CSS , Sera UI.
- **Icons:** Lucide React.
- **Giao tiếp Dữ liệu:** REST API (Cấu hình và Thống kê) & WebSockets (Nhận luồng video nhị phân thời gian thực).

### 2.2. Backend (Xử lý & AI)
- **Framework:** FastAPI, Uvicorn, Pydantic.
- **Computer Vision:** OpenCV (Xử lý ảnh), Ultralytics YOLO (Object Detection), Supervision (Tracking - ByteTrack, Annotations, Line Crossing).
- **Xử lý luồng (Concurrency):** Sử dụng kiến trúc Đa luồng (Threading) để tách biệt quá trình đọc camera, suy luận AI (Inference) và truyền phát video (WebSocket streaming) nhằm đảm bảo hệ thống không bị nghẽn (blocking) và duy trì FPS cao.

## 3. Các Chức Năng Cốt Lõi (Core Functionalities)

### 3.1. Quản Lý Kết Nối Đầu Vào (Connection Management)
- **Hỗ trợ đa nguồn:** Người dùng có thể kết nối với hệ thống bằng cách tải lên tệp Video nội bộ (`.mp4`, `.avi`,...) hoặc nhập URL luồng Camera IP (RTSP).
- **Tự động cấu hình:** Việc thay đổi thông số kết nối hoặc thông số AI được thực hiện thông qua REST API, áp dụng ngay lập tức mà không cần khởi động lại toàn bộ backend.

### 3.2. Truyền Phát Video Thời Gian Thực (Real-time Video Streaming)
- **WebSocket Streaming độ trễ thấp:** Chuyển đổi các khung hình (frames) thành định dạng JPEG nhị phân và truyền liên tục qua giao thức WebSocket.
- **Tối ưu hóa FPS độc lập:** Tốc độ hiển thị của camera (~30 FPS) được tách rời khỏi tốc độ suy luận của mô hình AI. Nếu AI xử lý chậm hơn, luồng video vẫn duy trì được độ mượt mà.

### 3.3. Nhận Diện và Theo Dõi Đối Tượng (Object Detection & Tracking)
- **YOLO Inference:** Sử dụng mô hình tùy chỉnh (`best.pt`) để phát hiện vật thể. Hỗ trợ tự động chuyển sang chạy trên GPU (CUDA) với chế độ FP16 (Half-precision) nếu phần cứng cho phép.
- **Object Tracking:** Tích hợp thuật toán ByteTrack (thông qua thư viện Supervision) để gán ID duy nhất cho mỗi đối tượng, giúp theo dõi quỹ đạo của đối tượng qua nhiều khung hình, chống đếm trùng hoặc đếm sai.

### 3.4. Cấu Hình Vùng Nhận Diện Tương Tác (Interactive Zones & Lines)
- **Vùng Quan Tâm (ROI - Region of Interest):** Người dùng có thể tự do vẽ một đa giác (polygon) trên video để chỉ định vùng cần theo dõi. AI sẽ áp dụng mask để chỉ xử lý ảnh trong vùng này, loại bỏ nhiễu bên ngoài và tiết kiệm tài nguyên.
- **Đường Đếm (Counting Line):** Cung cấp công cụ vẽ một đoạn thẳng cắt ngang băng chuyền. Hệ thống sẽ theo dõi và đếm số lượng vật thể khi chúng di chuyển cắt qua đường này. Số lượng được phân loại tự động theo từng class (loại vật thể).
- **Đường Cảnh Báo (Warning Line / Split Zone):** Vẽ một đường thẳng để chia khung hình thành "Vùng An Toàn" và "Vùng Cảnh Báo". Hệ thống tự động tính toán vị trí tâm đáy của hộp bao đối tượng để xác định đối tượng đang ở vùng nào. Cung cấp nút chuyển đổi (Flip) để đảo ngược hướng cảnh báo nhanh chóng.

### 3.5. Hệ Thống Thống Kê & Cảnh Báo (Statistics & Alerts)
- **Bảng Chỉ Số (Dashboard):** Hiển thị trực tiếp tốc độ khung hình hiển thị (Display FPS), tốc độ suy luận của AI (Inference FPS) và số đếm từng loại vật thể.
- **Cảnh Báo Thông Minh (Smart Warnings):**
  - **Cảnh báo độ tin cậy thấp (Low Confidence):** Tự động kích hoạt khi độ tin cậy trung bình của các nhận diện trong "Vùng Cảnh Báo" giảm xuống dưới ngưỡng 0.7.
  - **Cảnh báo nhấp nháy (Flickering):** Phát hiện và báo động khi số lượng đối tượng nhận diện liên tục biến động bất thường (độ lệch chuẩn > 0.8) trong một khoảng thời gian ngắn, báo hiệu điều kiện ánh sáng hoặc góc camera có vấn đề.

### 3.6. Giao Diện Tương Tác (UI/UX)
- Thiết kế hiện đại mang phong cách Dark Theme, Glassmorphism tối ưu hóa cho môi trường Dashboard công nghiệp.
- Cho phép kéo thả (Drag & Drop) và điều chỉnh linh hoạt các điểm neo (Anchor points) của ROI, Line ngay trên khung video trực tiếp một cách mượt mà.
- Thanh trượt điều chỉnh Ngưỡng tin cậy (Confidence Threshold) giúp kiểm soát độ nhạy của AI theo thời gian thực.
