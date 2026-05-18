---
trigger: always_on
---

# Cấu trúc Thư mục Backend (FastAPI + YOLO)

Để đảm bảo nguyên tắc Decoupled Architecture và dễ dàng mở rộng, source code của backend cần tuân thủ cấu trúc sau:

```text
backend/
├── app/
│   ├── api/
│   │   ├── routes/          # Các REST API (vd: projects.py, images.py, models.py)
│   │   └── websockets.py    # Xử lý WebSocket connection để sync UI (Tên class mới)
│   ├── core/
│   │   ├── config.py        # Quản lý Environment variables (DB URL, Cloudinary keys)
│   │   ├── camera.py        # Module quản lý luồng đọc Camera độc lập (Thread/Process)
│   │   └── exceptions.py    # Các Custom Error Handler
│   ├── db/
│   │   ├── database.py      # SQLAlchemy Async Engine, Session local
│   │   └── models.py        # Định nghĩa các Entity (Classes, Images, Annotations,...)
│   ├── schemas/             # Pydantic models (Dùng validate Input/Output API)
│   ├── services/            # Tầng xử lý Logic (Business Logic Layer)
│   │   ├── storage_svc.py   # Gọi Cloudinary API và lưu local_cache
│   │   ├── dataset_svc.py   # Logic tính Golden Quota, Stratified Split bằng scikit-learn
│   │   └── inference_svc.py # Logic Lock Thread, Hot-swap VRAM, gọi YOLO predict
│   └── main.py              # File chạy chính, init FastAPI app, include routers
├── data/                    # Thư mục chứa data vật lý (Nên thêm vào .gitignore)
│   ├── local_cache/         # Chứa toàn bộ ảnh copy khi upload (UUID.jpg)
│   └── yolo_dataset/        # Thư mục tạm thời sinh ra khi bắt đầu Training
├── alembic/                 # Thư mục chứa các script migrate database của Alembic
├── alembic.ini              # Cấu hình Alembic
└── requirements.txt         # Danh sách thư viện (fastapi, ultralytics, sqlalchemy...)
```

## Các Quy tắc Tương tác:
1. **API Router (`api/routes`)** tuyệt đối không được chứa logic xử lý data hoặc ML. Mọi lệnh gọi phải chuyển xuống tầng `services/`.
2. **Database Models (`db/models.py`)** và **Pydantic Schemas (`schemas/`)** phải tách biệt.
3. Luồng **Camera (`core/camera.py`)** phải được thiết kế để nhận một biến `threading.Lock()` từ `inference_svc.py` nhằm phục vụ việc Hot-swap mô hình mà không làm sập stream.
