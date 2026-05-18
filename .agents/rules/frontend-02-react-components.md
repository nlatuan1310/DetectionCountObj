---
trigger: always_on
---

# Rule: React Components

## Mô tả
Quy định về cách viết, định dạng và chia tách React Components để đảm bảo code sạch (Clean Code) và dễ đọc.

## Quy tắc chi tiết

1. **Functional Components:** 
   - Sử dụng 100% Functional Components với React Hooks. Tuyệt đối KHÔNG sử dụng Class Components.
   - Ưu tiên khai báo component bằng Arrow Function:
     ```jsx
     const MyComponent = ({ propA, propB }) => { ... };
     export default MyComponent;
     ```

2. **Naming Convention (Đặt tên):**
   - **Tên File:** PascalCase (ví dụ: `DatasetVersionsPage.jsx`, `NeonGradientCard.jsx`).
   - **Tên Component:** PascalCase, trùng với tên file.

3. **Single Responsibility Principle (Nguyên tắc đơn trách nhiệm):**
   - Mỗi component chỉ nên thực hiện một chức năng duy nhất (hiển thị UI hoặc xử lý một logic cụ thể).
   - Phân tách component nếu file dài quá 200 - 300 dòng mã.

4. **Props & Destructuring:**
   - Luôn sử dụng destructuring cho props trực tiếp trong tham số hàm.
   - Cung cấp giá trị mặc định cho props khi cần thiết để tránh lỗi `undefined`.
   ```jsx
   // TỐT
   const Button = ({ label, onClick, variant = 'primary' }) => { ... };
   ```

5. **JSX Rules:**
   - Cố gắng giữ cho block return của JSX càng mỏng càng tốt. Đưa các tính toán phức tạp ra ngoài hoặc dùng `useMemo`.
   - Sử dụng toán tử `&&` hoặc Ternary Operator (`? :`) cho Conditional Rendering một cách dễ đọc. Tránh lồng ghép quá sâu (Nested ternaries).
