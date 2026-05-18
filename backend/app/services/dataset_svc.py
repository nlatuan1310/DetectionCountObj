import logging
import os
import shutil
import base64
import cv2
import numpy as np
import albumentations as A
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from sklearn.model_selection import train_test_split
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Project, Class, Image, Annotation, DatasetVersion, DatasetVersionImage
from app.core.config import settings

logger = logging.getLogger(__name__)


class DatasetService:
    """Business logic cho Dataset Management."""

    # ======================== PROJECTS ========================

    @staticmethod
    async def list_projects(db: AsyncSession) -> list[dict]:
        """Lấy danh sách projects kèm thống kê."""
        # Subquery đếm tổng số ảnh
        subq_images = (
            select(Image.project_id, func.count(Image.id).label("image_count"))
            .group_by(Image.project_id)
            .subquery()
        )

        # Subquery đếm số ảnh đã được gán nhãn
        subq_annotated = (
            select(Image.project_id, func.count(func.distinct(Image.id)).label("annotated_count"))
            .join(Annotation, Annotation.image_id == Image.id)
            .group_by(Image.project_id)
            .subquery()
        )

        stmt = (
            select(
                Project,
                func.coalesce(subq_images.c.image_count, 0).label("image_count"),
                func.coalesce(subq_annotated.c.annotated_count, 0).label("annotated_count"),
            )
            .outerjoin(subq_images, Project.id == subq_images.c.project_id)
            .outerjoin(subq_annotated, Project.id == subq_annotated.c.project_id)
            .order_by(Project.created_at.desc())
        )
        result = await db.execute(stmt)
        rows = result.all()

        return [
            {
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "created_at": project.created_at,
                "image_count": image_count,
                "annotated_count": annotated_count,
            }
            for project, image_count, annotated_count in rows
        ]
    @staticmethod
    async def create_project(db: AsyncSession, name: str, description: str | None = None) -> Project:
        """Tạo project mới (đợt thu thập dữ liệu)."""
        project = Project(name=name, description=description)
        db.add(project)
        await db.commit()
        await db.refresh(project)
        logger.info("Created project: %s (id=%d)", project.name, project.id)
        return project

    @staticmethod
    async def get_project(db: AsyncSession, project_id: int) -> Project | None:
        """Lấy project theo ID."""
        stmt = select(Project).where(Project.id == project_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def delete_project(db: AsyncSession, project_id: int) -> bool:
        """Xóa project và cascade xóa images, annotations."""
        project = await DatasetService.get_project(db, project_id)
        if not project:
            return False
        await db.delete(project)
        await db.commit()
        logger.info("Deleted project id=%d", project_id)
        return True

    # ======================== CLASSES ========================

    @staticmethod
    async def list_classes(db: AsyncSession) -> list[dict]:
        """Lấy danh sách classes kèm annotation count."""
        stmt = (
            select(
                Class,
                func.count(Annotation.id).label("annotation_count"),
            )
            .outerjoin(Annotation, Annotation.class_id == Class.id)
            .group_by(Class.id)
            .order_by(Class.name)
        )
        result = await db.execute(stmt)
        rows = result.all()
        return [
            {
                "id": cls.id,
                "name": cls.name,
                "is_active": cls.is_active,
                "annotation_count": count,
            }
            for cls, count in rows
        ]

    @staticmethod
    async def create_class(db: AsyncSession, name: str) -> Class:
        """Tạo class sản phẩm mới."""
        cls = Class(name=name)
        db.add(cls)
        await db.commit()
        await db.refresh(cls)
        logger.info("Created class: %s (id=%d)", cls.name, cls.id)
        return cls

    @staticmethod
    async def update_class(
        db: AsyncSession, class_id: int, name: str | None = None, is_active: bool | None = None
    ) -> Class | None:
        """Cập nhật class (tên hoặc toggle is_active)."""
        stmt = select(Class).where(Class.id == class_id)
        result = await db.execute(stmt)
        cls = result.scalar_one_or_none()
        if not cls:
            return None

        if name is not None:
            cls.name = name
        if is_active is not None:
            cls.is_active = is_active

        await db.commit()
        await db.refresh(cls)
        logger.info("Updated class id=%d: name=%s, is_active=%s", cls.id, cls.name, cls.is_active)
        return cls

    @staticmethod
    async def delete_class(db: AsyncSession, class_id: int) -> bool:
        """Xóa class."""
        stmt = select(Class).where(Class.id == class_id)
        result = await db.execute(stmt)
        cls = result.scalar_one_or_none()
        if not cls:
            return False
        
        await db.delete(cls)
        await db.commit()
        logger.info("Deleted class id=%d", class_id)
        return True

    # ======================== IMAGES ========================

    @staticmethod
    async def list_project_images(db: AsyncSession, project_id: int) -> list[dict]:
        """Lấy danh sách ảnh của project kèm annotation count."""
        stmt = (
            select(
                Image,
                func.count(Annotation.id).label("annotation_count"),
            )
            .outerjoin(Annotation, Annotation.image_id == Image.id)
            .where(Image.project_id == project_id)
            .group_by(Image.id)
            .order_by(Image.uploaded_at.desc())
        )
        result = await db.execute(stmt)
        rows = result.all()
        return [
            {
                "id": img.id,
                "project_id": img.project_id,
                "cloudinary_url": img.cloudinary_url,
                "local_path": img.local_path,
                "original_filename": img.original_filename,
                "is_golden": img.is_golden,
                "is_background": img.is_background,
                "uploaded_at": img.uploaded_at,
                "annotation_count": count,
            }
            for img, count in rows
        ]

    @staticmethod
    async def create_image(
        db: AsyncSession,
        project_id: int,
        local_path: str,
        cloudinary_url: str | None,
        original_filename: str | None,
        is_background: bool = False,
    ) -> Image:
        """Tạo record ảnh trong DB."""
        image = Image(
            project_id=project_id,
            local_path=local_path,
            cloudinary_url=cloudinary_url,
            original_filename=original_filename,
            is_background=is_background,
        )
        db.add(image)
        await db.commit()
        await db.refresh(image)
        return image

    @staticmethod
    async def get_image(db: AsyncSession, image_id: int) -> Image | None:
        """Lấy image theo ID."""
        stmt = select(Image).where(Image.id == image_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def delete_image(db: AsyncSession, image_id: int) -> Image | None:
        """Xóa image record (trả về object để caller xóa file vật lý)."""
        image = await DatasetService.get_image(db, image_id)
        if not image:
            return None
        await db.delete(image)
        await db.commit()
        return image

    @staticmethod
    async def toggle_golden(db: AsyncSession, image_id: int) -> Image | None:
        """Toggle trạng thái golden của ảnh."""
        image = await DatasetService.get_image(db, image_id)
        if not image:
            return None
        image.is_golden = not image.is_golden
        await db.commit()
        await db.refresh(image)
        logger.info("Toggled golden for image id=%d: %s", image_id, image.is_golden)
        return image

    # ======================== ANNOTATIONS ========================

    @staticmethod
    async def get_image_annotations(db: AsyncSession, image_id: int) -> list[dict]:
        """Lấy annotations của ảnh kèm tên class."""
        stmt = (
            select(Annotation, Class.name.label("class_name"))
            .outerjoin(Class, Annotation.class_id == Class.id)
            .where(Annotation.image_id == image_id)
            .order_by(Annotation.id)
        )
        result = await db.execute(stmt)
        rows = result.all()
        return [
            {
                "id": ann.id,
                "image_id": ann.image_id,
                "class_id": ann.class_id,
                "class_name": class_name,
                "bbox_x": ann.bbox_x,
                "bbox_y": ann.bbox_y,
                "bbox_w": ann.bbox_w,
                "bbox_h": ann.bbox_h,
            }
            for ann, class_name in rows
        ]

    @staticmethod
    async def create_annotations(
        db: AsyncSession, image_id: int, annotations_data: list[dict]
    ) -> list[Annotation]:
        """Tạo bulk annotations cho 1 ảnh."""
        annotations = []
        for data in annotations_data:
            ann = Annotation(
                image_id=image_id,
                class_id=data["class_id"],
                bbox_x=data["bbox_x"],
                bbox_y=data["bbox_y"],
                bbox_w=data["bbox_w"],
                bbox_h=data["bbox_h"],
            )
            db.add(ann)
            annotations.append(ann)

        await db.commit()
        for ann in annotations:
            await db.refresh(ann)
        logger.info("Created %d annotations for image id=%d", len(annotations), image_id)
        return annotations

    @staticmethod
    async def update_annotation(db: AsyncSession, annotation_id: int, data: dict) -> Annotation | None:
        """Cập nhật annotation bbox."""
        stmt = select(Annotation).where(Annotation.id == annotation_id)
        result = await db.execute(stmt)
        ann = result.scalar_one_or_none()
        if not ann:
            return None

        for field in ("class_id", "bbox_x", "bbox_y", "bbox_w", "bbox_h"):
            if field in data and data[field] is not None:
                setattr(ann, field, data[field])

        await db.commit()
        await db.refresh(ann)
        return ann

    @staticmethod
    async def delete_annotation(db: AsyncSession, annotation_id: int) -> bool:
        """Xóa annotation."""
        stmt = select(Annotation).where(Annotation.id == annotation_id)
        result = await db.execute(stmt)
        ann = result.scalar_one_or_none()
        if not ann:
            return False
        await db.delete(ann)
        await db.commit()
        return True

    # ======================== DATASET VERSIONS ========================

    @staticmethod
    async def list_versions(db: AsyncSession, project_id: int) -> list[DatasetVersion]:
        """Lấy danh sách versions của project."""
        stmt = (
            select(DatasetVersion)
            .where(DatasetVersion.project_id == project_id)
            .order_by(DatasetVersion.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def create_version(
        db: AsyncSession,
        project_id: int,
        version_name: str | None,
        augmentation_config: dict,
    ) -> DatasetVersion:
        """Tạo dataset version mới."""
        # Auto-generate version name nếu null
        if not version_name:
            existing = await DatasetService.list_versions(db, project_id)
            version_name = f"v{len(existing) + 1}"

        version = DatasetVersion(
            project_id=project_id,
            version_name=version_name,
            augmentation_config=augmentation_config,
            status="draft",
        )
        db.add(version)
        await db.commit()
        await db.refresh(version)
        logger.info("Created version %s for project id=%d", version_name, project_id)
        return version

    # ======================== BACKGROUND IMAGES ========================

    @staticmethod
    async def list_background_images(db: AsyncSession) -> list[dict]:
        """Lấy danh sách ảnh trống (background) — không thuộc project nào cụ thể."""
        stmt = (
            select(Image)
            .where(Image.is_background == True)
            .order_by(Image.uploaded_at.desc())
        )
        result = await db.execute(stmt)
        images = result.scalars().all()
        return [
            {
                "id": img.id,
                "project_id": img.project_id,
                "cloudinary_url": img.cloudinary_url,
                "local_path": img.local_path,
                "original_filename": img.original_filename,
                "is_background": True,
                "uploaded_at": img.uploaded_at,
                "annotation_count": 0,
            }
            for img in images
        ]

    @staticmethod
    def calculate_golden_quota(n_new: int, k_active_classes: int) -> int:
        """
        Tính Golden Quota theo công thức chuẩn PLAN_03.
        Quota = MAX( (N * 0.25) / K , 50 )
        Ceiling cap: 200 ảnh/class
        """
        if k_active_classes == 0:
            return 0
        quota = max((n_new * 0.25) / k_active_classes, 50)
        quota = min(quota, 200)  # Ceiling capping
        return int(quota)

    # ======================== VERSION OPERATIONS ========================

    @staticmethod
    async def get_version(db: AsyncSession, version_id: int) -> DatasetVersion | None:
        """Lấy version theo ID."""
        stmt = select(DatasetVersion).where(DatasetVersion.id == version_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def generate_version(
        db: AsyncSession,
        version_id: int,
        train_ratio: float = 0.7,
        val_ratio: float = 0.2,
        test_ratio: float = 0.1,
    ) -> DatasetVersion:
        """
        Thực hiện Stratified Split + sinh thư mục YOLO từ local_cache.
        Tuân thủ MLOps rules:
        - Tách riêng labeled images và background images
        - Dùng stratify cho labeled, KHÔNG stratify cho background
        - Gộp kết quả thành train/val/test
        """
        version = await DatasetService.get_version(db, version_id)
        if not version:
            raise ValueError("Version không tồn tại")

        # Cập nhật status
        version.status = "generating"
        await db.commit()

        try:
            project_id = version.project_id

            # 1. Query ảnh labeled (có ít nhất 1 annotation)
            labeled_stmt = (
                select(Image)
                .join(Annotation, Annotation.image_id == Image.id)
                .where(Image.project_id == project_id)
                .distinct()
            )
            labeled_result = await db.execute(labeled_stmt)
            labeled_images = list(labeled_result.scalars().all())

            # 2. Query ảnh background
            bg_stmt = (
                select(Image)
                .where(Image.project_id == project_id, Image.is_background == True)
            )
            bg_result = await db.execute(bg_stmt)
            bg_images = list(bg_result.scalars().all())

            total = len(labeled_images) + len(bg_images)
            if total == 0:
                version.status = "failed"
                await db.commit()
                raise ValueError("Project không có ảnh nào để generate")

            # 3. Lấy dominant class cho mỗi labeled image (để stratify)
            labeled_labels = []
            for img in labeled_images:
                ann_stmt = (
                    select(Annotation.class_id)
                    .where(Annotation.image_id == img.id)
                    .limit(1)
                )
                ann_result = await db.execute(ann_stmt)
                class_id = ann_result.scalar_one_or_none()
                labeled_labels.append(class_id or 0)

            # 4. Split labeled images (có stratify)
            train_labeled, val_labeled, test_labeled = [], [], []
            if len(labeled_images) >= 3:
                # Kiểm tra mỗi class có đủ sample cho stratify không
                from collections import Counter
                label_counts = Counter(labeled_labels)
                can_stratify = all(c >= 3 for c in label_counts.values())

                val_test_ratio = val_ratio + test_ratio
                stratify_arg = labeled_labels if can_stratify else None

                if len(labeled_images) >= 4 and val_test_ratio > 0:
                    train_labeled, val_test = train_test_split(
                        labeled_images,
                        test_size=val_test_ratio,
                        random_state=42,
                        stratify=stratify_arg,
                    )
                    # Split val_test thành val và test
                    if test_ratio > 0 and len(val_test) >= 2:
                        relative_test = test_ratio / val_test_ratio
                        # Tái tạo stratify labels cho val_test
                        if can_stratify:
                            vt_labels = [
                                labeled_labels[labeled_images.index(img)]
                                for img in val_test
                            ]
                            vt_counts = Counter(vt_labels)
                            vt_stratify = vt_labels if all(c >= 2 for c in vt_counts.values()) else None
                        else:
                            vt_stratify = None

                        val_labeled, test_labeled = train_test_split(
                            val_test,
                            test_size=relative_test,
                            random_state=42,
                            stratify=vt_stratify,
                        )
                    else:
                        val_labeled = val_test
                        test_labeled = []
                else:
                    train_labeled = labeled_images
            else:
                train_labeled = labeled_images

            # 5. Split background images (KHÔNG stratify — MLOps rule)
            train_bg, val_bg, test_bg = [], [], []
            if len(bg_images) >= 3:
                val_test_ratio = val_ratio + test_ratio
                if val_test_ratio > 0:
                    train_bg, val_test_bg = train_test_split(
                        bg_images, test_size=val_test_ratio, random_state=42
                    )
                    if test_ratio > 0 and len(val_test_bg) >= 2:
                        relative_test = test_ratio / val_test_ratio
                        val_bg, test_bg = train_test_split(
                            val_test_bg, test_size=relative_test, random_state=42
                        )
                    else:
                        val_bg = val_test_bg
                else:
                    train_bg = bg_images
            elif bg_images:
                train_bg = bg_images

            # 6. Gộp kết quả
            train_imgs = train_labeled + train_bg
            val_imgs = val_labeled + val_bg
            test_imgs = test_labeled + test_bg

            # 7. Xóa snapshot cũ (nếu re-generate)
            await db.execute(
                delete(DatasetVersionImage).where(DatasetVersionImage.version_id == version_id)
            )

            # 8. Lưu snapshot vào DB
            for img in train_imgs:
                db.add(DatasetVersionImage(version_id=version_id, image_id=img.id, split="train"))
            for img in val_imgs:
                db.add(DatasetVersionImage(version_id=version_id, image_id=img.id, split="val"))
            for img in test_imgs:
                db.add(DatasetVersionImage(version_id=version_id, image_id=img.id, split="test"))

            # 9. Sinh thư mục YOLO
            yolo_base = Path(settings.LOCAL_CACHE_DIR).parent / "yolo_dataset" / str(version_id)
            if yolo_base.exists():
                shutil.rmtree(yolo_base)

            # Lấy active classes để build mapping
            classes_stmt = select(Class).where(Class.is_active == True).order_by(Class.id)
            classes_result = await db.execute(classes_stmt)
            active_classes = list(classes_result.scalars().all())
            class_id_to_idx = {cls.id: idx for idx, cls in enumerate(active_classes)}

            for split_name, split_imgs in [("train", train_imgs), ("val", val_imgs), ("test", test_imgs)]:
                img_dir = yolo_base / split_name / "images"
                lbl_dir = yolo_base / split_name / "labels"
                img_dir.mkdir(parents=True, exist_ok=True)
                lbl_dir.mkdir(parents=True, exist_ok=True)

                for img in split_imgs:
                    src = Path(img.local_path)
                    if src.exists():
                        dst = img_dir / src.name
                        shutil.copy2(str(src), str(dst))

                        # Sinh label file
                        ann_stmt = select(Annotation).where(Annotation.image_id == img.id)
                        ann_result = await db.execute(ann_stmt)
                        anns = ann_result.scalars().all()

                        label_path = lbl_dir / f"{src.stem}.txt"
                        with open(label_path, "w") as f:
                            for ann in anns:
                                if ann.class_id in class_id_to_idx:
                                    idx = class_id_to_idx[ann.class_id]
                                    cx = ann.bbox_x + ann.bbox_w / 2
                                    cy = ann.bbox_y + ann.bbox_h / 2
                                    f.write(f"{idx} {cx:.6f} {cy:.6f} {ann.bbox_w:.6f} {ann.bbox_h:.6f}\n")

            # 10. Sinh data.yaml
            yaml_path = yolo_base / "data.yaml"
            with open(yaml_path, "w") as f:
                f.write(f"path: {yolo_base.resolve()}\n")
                f.write("train: train/images\n")
                f.write("val: val/images\n")
                f.write("test: test/images\n\n")
                f.write(f"nc: {len(active_classes)}\n")
                f.write(f"names: [{', '.join(repr(c.name) for c in active_classes)}]\n")

            # 11. Cập nhật version record
            ratio_str = f"{int(train_ratio*100)}/{int(val_ratio*100)}/{int(test_ratio*100)}"
            version.total_images = total
            version.train_count = len(train_imgs)
            version.val_count = len(val_imgs)
            version.test_count = len(test_imgs)
            version.split_ratio = ratio_str
            version.generated_at = datetime.now(timezone.utc)
            version.yolo_dataset_path = str(yolo_base.resolve())
            version.status = "generated"

            await db.commit()
            await db.refresh(version)
            logger.info(
                "Generated version id=%d: train=%d, val=%d, test=%d",
                version_id, len(train_imgs), len(val_imgs), len(test_imgs),
            )
            return version

        except ValueError:
            raise
        except Exception as e:
            version.status = "failed"
            await db.commit()
            logger.error("Generate version %d failed: %s", version_id, str(e))
            raise

    @staticmethod
    async def get_version_detail(db: AsyncSession, version_id: int) -> dict | None:
        """Lấy chi tiết version bao gồm class distribution."""
        version = await DatasetService.get_version(db, version_id)
        if not version:
            return None

        # Lấy snapshot images
        vi_stmt = (
            select(DatasetVersionImage)
            .where(DatasetVersionImage.version_id == version_id)
        )
        vi_result = await db.execute(vi_stmt)
        version_images = list(vi_result.scalars().all())

        # Đếm labeled vs background
        labeled_ids = set()
        bg_ids = set()
        for vi in version_images:
            img_stmt = select(Image).where(Image.id == vi.image_id)
            img_result = await db.execute(img_stmt)
            img = img_result.scalar_one_or_none()
            if img and img.is_background:
                bg_ids.add(vi.image_id)
            else:
                labeled_ids.add(vi.image_id)

        # Tính class distribution
        class_dist = {}
        for vi in version_images:
            if vi.image_id in bg_ids:
                continue
            ann_stmt = (
                select(Annotation.class_id, Class.name)
                .join(Class, Annotation.class_id == Class.id)
                .where(Annotation.image_id == vi.image_id)
            )
            ann_result = await db.execute(ann_stmt)
            for class_id, class_name in ann_result.all():
                if class_id not in class_dist:
                    class_dist[class_id] = {
                        "class_id": class_id,
                        "class_name": class_name,
                        "train": 0, "val": 0, "test": 0, "total": 0,
                    }
                class_dist[class_id][vi.split] += 1
                class_dist[class_id]["total"] += 1

        return {
            "id": version.id,
            "project_id": version.project_id,
            "version_name": version.version_name,
            "augmentation_config": version.augmentation_config or {},
            "status": version.status,
            "created_at": version.created_at,
            "total_images": version.total_images,
            "train_count": version.train_count,
            "val_count": version.val_count,
            "test_count": version.test_count,
            "split_ratio": version.split_ratio,
            "generated_at": version.generated_at,
            "yolo_dataset_path": version.yolo_dataset_path,
            "class_distribution": list(class_dist.values()),
            "labeled_count": len(labeled_ids),
            "background_count": len(bg_ids),
        }

    @staticmethod
    async def delete_version(db: AsyncSession, version_id: int) -> bool:
        """Xóa version + cleanup thư mục YOLO vật lý."""
        version = await DatasetService.get_version(db, version_id)
        if not version:
            return False

        # Cleanup thư mục YOLO
        if version.yolo_dataset_path:
            yolo_path = Path(version.yolo_dataset_path)
            if yolo_path.exists():
                shutil.rmtree(yolo_path)
                logger.info("Cleaned up YOLO dir: %s", yolo_path)

        await db.delete(version)
        await db.commit()
        logger.info("Deleted version id=%d", version_id)
        return True

    @staticmethod
    async def preview_augmentation(
        db: AsyncSession, project_id: int, augmentation_config: dict
    ) -> str | None:
        """
        Lấy ngẫu nhiên 1 ảnh (có annotation) trong project, áp dụng augmentation config
        và trả về ảnh kèm bounding box dưới dạng base64 string.
        """
        # 1. Query random labeled image
        stmt = (
            select(Image)
            .join(Annotation, Annotation.image_id == Image.id)
            .where(Image.project_id == project_id)
            .order_by(func.random())
            .limit(1)
        )
        result = await db.execute(stmt)
        image = result.scalar_one_or_none()

        if not image:
            # Fallback to any image if no labeled image
            stmt = select(Image).where(Image.project_id == project_id).order_by(func.random()).limit(1)
            result = await db.execute(stmt)
            image = result.scalar_one_or_none()

        if not image or not os.path.exists(image.local_path):
            return None

        # 2. Get annotations
        ann_stmt = (
            select(Annotation, Class.name)
            .join(Class, Annotation.class_id == Class.id)
            .where(Annotation.image_id == image.id)
        )
        ann_result = await db.execute(ann_stmt)
        annotations = ann_result.all()

        # 3. Read image
        img_arr = cv2.imread(image.local_path)
        if img_arr is None:
            return None
        img_arr = cv2.cvtColor(img_arr, cv2.COLOR_BGR2RGB)
        h, w, _ = img_arr.shape

        # 4. Prepare bboxes [x_min, y_min, x_max, y_max, class_name]
        bboxes = []
        for ann, class_name in annotations:
            x_min = max(0.0, ann.bbox_x)
            y_min = max(0.0, ann.bbox_y)
            x_max = min(1.0, ann.bbox_x + ann.bbox_w)
            y_max = min(1.0, ann.bbox_y + ann.bbox_h)
            
            # Đảm bảo box hợp lệ cho albumentations
            if x_max > x_min and y_max > y_min:
                bboxes.append([x_min, y_min, x_max, y_max, class_name])

        # 5. Build albumentations transforms
        transforms = []
        if augmentation_config.get("horizontal_flip"):
            transforms.append(A.HorizontalFlip(p=1.0))
        if augmentation_config.get("vertical_flip"):
            transforms.append(A.VerticalFlip(p=1.0))
        if augmentation_config.get("safe_rotate"):
            transforms.append(A.SafeRotate(limit=15, p=1.0))
        if augmentation_config.get("brightness_contrast"):
            transforms.append(A.RandomBrightnessContrast(p=1.0))
        if augmentation_config.get("blur"):
            transforms.append(A.GaussianBlur(blur_limit=(3, 5), p=1.0))
        if augmentation_config.get("gaussian_noise"):
            transforms.append(A.GaussNoise(var_limit=(10.0, 50.0), p=1.0))

        if transforms:
            transform = A.Compose(
                transforms,
                bbox_params=A.BboxParams(format='albumentations', min_area=0, min_visibility=0, label_fields=['class_labels'])
            )
            class_labels = [b[4] for b in bboxes]
            bboxes_only = [b[:4] for b in bboxes]

            try:
                transformed = transform(image=img_arr, bboxes=bboxes_only, class_labels=class_labels)
                out_img = transformed['image']
                out_bboxes = transformed['bboxes']
                out_labels = transformed['class_labels']
            except Exception as e:
                logger.error("Augmentation failed: %s", str(e))
                out_img = img_arr
                out_bboxes = bboxes_only
                out_labels = class_labels
        else:
            out_img = img_arr
            out_bboxes = [b[:4] for b in bboxes]
            out_labels = [b[4] for b in bboxes]

        # 6. Draw bboxes
        out_img_bgr = cv2.cvtColor(out_img, cv2.COLOR_RGB2BGR)
        for bbox, label in zip(out_bboxes, out_labels):
            x_min = int(bbox[0] * w)
            y_min = int(bbox[1] * h)
            x_max = int(bbox[2] * w)
            y_max = int(bbox[3] * h)
            cv2.rectangle(out_img_bgr, (x_min, y_min), (x_max, y_max), (0, 255, 0), 2)
            cv2.putText(out_img_bgr, label, (x_min, max(0, y_min - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        # 7. Encode base64
        _, buffer = cv2.imencode('.jpg', out_img_bgr)
        base64_str = base64.b64encode(buffer).decode('utf-8')
        return base64_str

