---
description: 
---

# Luồng Huấn Luyện (Training Pipeline Workflow)

## 1. Stratified Split Độc Lập (Chống Crash)
Sau khi query Virtual Dataset từ DB, backend tiến hành chia tỷ lệ 70-20-10. Bắt buộc tách 2 rổ dữ liệu độc lập để thuật toán `scikit-learn` không bị crash do nhãn rỗng:

```python
from sklearn.model_selection import train_test_split

# Lọc DB:
labeled = [img for img in dataset if not img.is_background]
bg = [img for img in dataset if img.is_background]

# BƯỚC 1: Split Ảnh Nhãn (Bắt buộc dùng stratify để cân bằng class)
labels = [img.class_id for img in labeled]
train_lab, temp_lab, _, temp_labels = train_test_split(labeled, labels, test_size=0.3, stratify=labels)
val_lab, test_lab = train_test_split(temp_lab, test_size=0.33, stratify=temp_labels)

# BƯỚC 2: Split Ảnh Trống (KHÔNG dùng stratify vì không có labels)
train_bg, temp_bg = train_test_split(bg, test_size=0.3)
val_bg, test_bg = train_test_split(temp_bg, test_size=0.33)

# BƯỚC 3: Gộp (Merge) & Export ra YOLO physical folders
final_train = train_lab + train_bg
# ... tương tự cho val, test
```

## 2. Lựa chọn Training Strategy
Sau khi export ra thư mục vật lý và sinh `data.yaml`, hệ thống gọi hàm train:

```python
from ultralytics import YOLO

if N_new_images < 500:
    # Chiến lược 1: Deep Freezing (Khóa Backbone/Neck, chỉ train Head)
    model = YOLO('best_old.pt')
    model.train(data='data.yaml', freeze=10, lr0=0.001, epochs=50)
else:
    # Chiến lược 2: Global Retrain (Train lại nền tảng)
    model = YOLO('yolov8n.pt')
    model.train(data='data.yaml', epochs=300)
```

Sau khi train xong, ghi metrics vào DB bảng `models` và xóa thư mục vật lý tạm.
