---
trigger: always_on
---

# Rule: Giao tiếp API và Xử lý lỗi

## Mô tả
Quy định cách thức gọi dữ liệu từ backend, cấu trúc các HTTP request và bắt lỗi an toàn để không làm sập ứng dụng.

## Quy tắc chi tiết

1. **Phân tách lớp Data Fetching:**
   - KHÔNG gọi trực tiếp `fetch` hoặc `axios` có chứa base URL trong các component React.
   - TẤT CẢ request đều phải được định nghĩa trong thư mục `src/services/` (ví dụ: `src/services/video_service.js`).
   - Tạo ra instance `axios` chung trong (ví dụ: `apiClient.js`) để quản lý chung Base URL, Headers và Interceptors (bắt lỗi 401, gắn token).

2. **Xử lý Bất đồng bộ (Asynchronous):**
   - Luôn sử dụng `async/await` thay vì `.then().catch()` (Promises chèn lồng) để code dễ đọc.
   - Mọi khối `async/await` phải được bọc trong khối `try/catch`.

3. **Hiển thị trạng thái (Loading & Error States):**
   - Mọi tính năng fetch dữ liệu bắt buộc phải xử lý 3 trạng thái: Đang tải (`isLoading`), Dữ liệu trả về (`data`), và Lỗi (`error`).
   - Ứng dụng phải có cơ chế hiển thị Toast/Notification/Alert rõ ràng với người dùng khi có lỗi xảy ra (ví dụ: "Mất kết nối mạng", "Không tìm thấy dữ liệu").

4. **Error Boundaries:**
   - Sử dụng React Error Boundaries để bao bọc các phân đoạn UI quan trọng (hoặc toàn bộ App) nhằm đảm bảo lỗi tại một component không làm treo toàn bộ ứng dụng (White screen of death).
