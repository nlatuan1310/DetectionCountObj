---
trigger: model_decision
---

# Rule: Quản lý State và Custom Hooks

## Mô tả
Quy định cách quản lý state (trạng thái) trong component và việc tái sử dụng logic thông qua Custom Hooks.

## Quy tắc chi tiết

1. **Quản lý State cục bộ (Local State):**
   - Chỉ giữ state ở mức thấp nhất có thể. Đừng đưa state lên cha nếu không có component anh em nào khác cần dùng.
   - Sử dụng `useState` cho state đơn giản. Đối với state phức tạp bao gồm nhiều field hoặc logic thay đổi liên kết, nên cân nhắc `useReducer`.

2. **Custom Hooks:**
   - Bất kỳ logic xử lý nào (gọi API liên tục, tính toán phức tạp, quản lý event listener) vượt ra khỏi phạm vi UI phải được tách ra thành custom hook.
   - **Tên Hook:** Bắt buộc sử dụng camelCase và bắt đầu bằng tiền tố `use` (ví dụ: `useVideoFeed.js`, `useDataset.js`).
   - Custom hook phải có tính tái sử dụng và trả về đúng những dữ liệu/hàm mà component cần.

3. **Global State:**
   - Hạn chế sử dụng Global State cho những dữ liệu không thực sự "global".
   - Dùng Global State (Redux, Zustand, Context) cho dữ liệu như: Thông tin người dùng (Auth), Cấu hình ứng dụng (Theme, Ngôn ngữ), hoặc state chia sẻ trên diện rộng giữa các page khác biệt.

4. **Hiệu ứng phụ (Side Effects / useEffect):**
   - Giữ mảng phụ thuộc (dependency array) đầy đủ và chính xác. Không bỏ qua cảnh báo của linter (exhaustive-deps).
   - MỌI `useEffect` tạo ra side effects (ví dụ: `setInterval`, `addEventListener`, WebSocket connection) PHẢI có hàm dọn dẹp (cleanup function) ở mệnh đề `return`.