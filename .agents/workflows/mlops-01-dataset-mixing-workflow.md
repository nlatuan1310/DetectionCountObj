---
description: 
---

# Luồng Trộn Dữ Liệu (Data Mixing Workflow)

## 1. Thuật toán Hạn mức (Golden Quota)
Khi User bấm "Generate Version" cho một Project mới, backend tự động áp dụng hàm toán học để kiểm soát số lượng ảnh cũ được rút ra.

**Mã giả Logic Python:**
```python
def calculate_golden_quota(N_new, K, max_cap_per_class=200, min_baseline=50):
    if K == 0: return 0
    
    # 1. Base quota: 25% data mới chia đều cho K class cũ
    base_quota = (N_new * 0.25) / K
    
    # 2. Trần & Sàn cho từng class
    quota = max(base_quota, min_baseline)
    quota = min(quota, max_cap_per_class)
    
    # 3. Global Capping (Chặn Nuốt Chửng)
    # Tổng ảnh cũ không được phép vượt 50% tổng ảnh mới
    if (quota * K) > (N_new * 0.5):
        quota = int((N_new * 0.5) / K)
        
    return int(quota)
```

## 2. Pumping Data & Background Injection
- Backend query Database, lấy ngẫu nhiên `quota` ảnh cho **MỖI** class thỏa mãn (`is_golden=True` VÀ `is_active=True`).
- **Background Injection (Ảnh Trống):** Bơm thêm khoảng 10% lượng Ảnh Trống (băng chuyền chạy không, thu từ kho ảnh có cờ `is_background`) vào tổng hỗn hợp.
