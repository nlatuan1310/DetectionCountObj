---
description: 
---

# Luồng Triển Khai (Deployment / Hot-Swap Workflow)

Luồng hoạt động thay đổi cấu trúc "não bộ" của AI đang chạy theo thời gian thực trên băng chuyền. Yêu cầu: Không được làm crash API hay mất kết nối stream.

## Mã giả kiến trúc Hot-Swap (Backend Python)
Sử dụng `threading.Lock()` để chặn đồng bộ:

```python
import torch
from threading import Lock
from ultralytics import YOLO

model_lock = Lock()
inference_model = YOLO('current_best.pt')

# Luồng 1: Vòng lặp đọc Camera
def inference_loop():
    while True:
        frame = camera.get_frame()
        with model_lock: # Chờ ở đây nếu Lock đang bị giữ bởi API Hot-Swap
            results = inference_model.predict(frame)
        emit_to_web(results)

# Luồng 2: API kích hoạt Deployment
def trigger_hotswap(new_model_path):
    global inference_model
    with model_lock: # Chặn Inference Loop (~1-2s)
        # 1. Rửa VRAM GPU
        del inference_model
        torch.cuda.empty_cache()
        import gc; gc.collect()
        
        # 2. Nạp file .pt mới
        inference_model = YOLO(new_model_path)
    
    # 3. Lock đã nhả, báo cho Frontend React (bằng WebSocket/SSE)
    # React sẽ tự gọi `queryClient.invalidateQueries` để fetch ID class mới vào Dropdown
    notify_frontend_sync()
```
