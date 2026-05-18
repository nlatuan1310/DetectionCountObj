import logging
from typing import Sequence

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Project, Class, Image, Annotation, DatasetVersion

logger = logging.getLogger(__name__)


class DatasetService:
    """Business logic cho Dataset Management."""

    # ======================== PROJECTS ========================

    @staticmethod
    async def list_projects(db: AsyncSession) -> list[dict]:
        """Lấy danh sách projects kèm thống kê."""
        stmt = (
            select(
                Project,
                func.count(Image.id).label("image_count"),
            )
            .outerjoin(Image, Image.project_id == Project.id)
            .group_by(Project.id)
            .order_by(Project.created_at.desc())
        )
        result = await db.execute(stmt)
        rows = result.all()

        projects = []
        for project, image_count in rows:
            # Count ảnh đã có annotation
            ann_stmt = (
                select(func.count(func.distinct(Image.id)))
                .join(Annotation, Annotation.image_id == Image.id)
                .where(Image.project_id == project.id)
            )
            ann_result = await db.execute(ann_stmt)
            annotated_count = ann_result.scalar() or 0

            projects.append({
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "created_at": project.created_at,
                "image_count": image_count,
                "annotated_count": annotated_count,
            })
        return projects

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
