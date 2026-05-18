---
trigger: always_on
---

# Rule: Tối ưu hiệu năng (Performance)

## Mô tả
Các nguyên tắc đảm bảo ứng dụng chạy mượt mà, hạn chế render dư thừa (re-render) và quản lý tài nguyên (bộ nhớ, network).

## Quy tắc chi tiết

1. **Ngăn chặn Re-render không mong muốn:**
   - Sử dụng `React.memo` để bọc các component tĩnh hoặc nhận lượng lớn props phức tạp nhưng ít thay đổi.
   - Dùng `useMemo` để ghi nhớ kết quả của những hàm tính toán nặng.
   - Dùng `useCallback` để bao bọc các hàm truyền dưới dạng props cho các component con (đặc biệt khi component con đó sử dụng `React.memo`).
   - KHÔNG LẠM DỤNG `useMemo`/`useCallback` ở khắp mọi nơi vì bản thân chúng cũng tốn chi phí. Chỉ dùng khi phát hiện hoặc dự đoán chính xác vấn đề hiệu suất.

2. **Code Splitting (Lazy Loading):**
   - Các trang (`pages`) nên được nạp lười (lazy load) bằng `React.lazy` và `Suspense` thông qua React Router để giảm kích thước bundle file lần đầu tải trang.
   - Tách những thư viện quá nặng ra chunk riêng nếu cần.

3. **Memory Leaks (Rò rỉ bộ nhớ):**
   - Hủy bỏ hoàn toàn các Event listeners, WebSocket connections, Video streams, và Observers trong hàm cleanup của `useEffect` khi component bị unmount.

4. **Tối ưu hình ảnh/Media:**
   - Nạp video/hình ảnh qua chuẩn nén phù hợp.
   - Các component liên quan đến Media nặng (Canvas, Video Stream) nên được tối ưu về Ref thay vì đưa mọi data thay đổi liên tục vào State (nếu chỉ để vẽ ra UI và không cần trigger re-render).
