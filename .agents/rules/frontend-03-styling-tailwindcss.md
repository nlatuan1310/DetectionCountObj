---
trigger: model_decision
---

# Rule: Styling với Tailwind CSS

## Mô tả
Quy định về cách áp dụng CSS, sử dụng Tailwind CSS và duy trì sự nhất quán của giao diện (Aesthetics/UI).

## Quy tắc chi tiết

1. **Ưu tiên sử dụng Tailwind CSS:**
   - Sử dụng tối đa các utility classes của Tailwind để dựng UI.
   - KHÔNG viết inline styles (`style={{...}}`) trừ khi giá trị thuộc tính phải tính toán động tại runtime (như tọa độ chuột, kích thước động).
   - KHÔNG tạo file `.css` thuần để định dạng component (trừ khi cần khai báo @keyframes phức tạp hoặc import thư viện ngoại lệ).

2. **Xử lý ghép nối Class linh hoạt (Dynamic Classes):**
   - Bắt buộc sử dụng hàm tiện ích `cn` (kết hợp `clsx` và `tailwind-merge`) khi muốn merge hoặc override class từ bên ngoài truyền vào.
   - File `utils/cn.js` (hoặc `lib/utils.js`) luôn có hàm:
     ```javascript
     import { clsx } from "clsx";
     import { twMerge } from "tailwind-merge";

     export function cn(...inputs) {
       return twMerge(clsx(inputs));
     }
     ```
   - Ví dụ sử dụng: `<div className={cn("bg-blue-500 text-white rounded-md", className)}>`

3. **Thiết kế giao diện (Design System):**
   - Tuân thủ thiết kế hiện đại, ưu tiên phong cách dark theme (nếu có yêu cầu từ dự án), sử dụng các hiệu ứng như Glassmorphism (`backdrop-blur`, `bg-opacity-*`).
   - Khai báo các màu sắc tùy chỉnh, cấu hình typography trong `tailwind.config.js` để tránh việc hardcode giá trị màu thô (`#1a2b3c`) trong class.

4. **Trạng thái UI (Interactive States):**
   - Phải thiết lập đầy đủ các hiệu ứng tương tác: `hover:`, `focus:`, `active:`, `disabled:`.
   - Có class transition mặc định cho các chuyển đổi mềm mại: `transition-all duration-200 ease-in-out`.