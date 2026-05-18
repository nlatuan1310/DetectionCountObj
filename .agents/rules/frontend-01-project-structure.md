---
trigger: model_decision
---

# Rule: Cấu trúc thư mục (Project Structure)

## Mô tả
Cấu trúc dự án cần được tổ chức theo module hóa, phân tách rõ ràng trách nhiệm của từng thư mục để dễ dàng bảo trì và mở rộng. Tất cả code ứng dụng (source code) phải được đặt trong thư mục `src/`.

## Cấu trúc chi tiết

- **`src/assets/`**: Chứa các file tĩnh không qua xử lý của bundler (hình ảnh, icons dạng SVG/PNG, fonts).
- **`src/components/`**: Các thành phần UI có khả năng tái sử dụng.
  - **`components/ui/`**: Các component cơ bản, nguyên thủy (Buttons, Inputs, Modals, Checkbox). Thường là các dumb component không chứa logic nghiệp vụ.
  - **`components/common/`**: Các component dùng chung giữa nhiều trang (ví dụ: `Navbar`, `Footer`, `Sidebar`).
  - **`components/<FeatureName>/`**: Các component đặc thù cho một tính năng cụ thể.
- **`src/layouts/`**: Component làm layout bao bọc các trang (ví dụ: `DashboardLayout`, `AuthLayout`). Các trang sẽ được chèn vào thông qua `children` hoặc `<Outlet />`.
- **`src/pages/`**: Các component đại diện cho một trang hoàn chỉnh. Gắn liền với các route trong hệ thống định tuyến (React Router). KHÔNG chứa logic UI phức tạp tại đây, mà gọi từ `components/`.
- **`src/hooks/`**: Chứa các custom React Hooks (bắt đầu bằng `use...`) để đóng gói logic tái sử dụng.
- **`src/services/`**: Các file định nghĩa gọi API (Axios/Fetch), chia theo tính năng (ví dụ: `video_service.js`, `auth_service.js`).
- **`src/store/` (hoặc `src/context/`)**: Chứa logic quản lý state toàn cục (Context API, Redux, Zustand).
- **`src/utils/`**: Các hàm trợ giúp thuần túy (pure functions), formatter, validation rules.
- **`src/styles/`**: Chứa CSS toàn cục, bao gồm file `index.css` để import Tailwind directives.

## Quy tắc áp dụng
- Không được đặt component trực tiếp trong `src/`, tất cả phải vào đúng thư mục tương ứng.
- Đảm bảo tính đóng gói: Một tính năng phức tạp nên gom nhóm (co-locate) các file liên quan (Component, styles, hook) lại gần nhau thay vì rải rác.