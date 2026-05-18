from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, JSON, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    images = relationship("Image", back_populates="project", cascade="all, delete-orphan")
    dataset_versions = relationship("DatasetVersion", back_populates="project", cascade="all, delete-orphan")


class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    is_active = Column(Boolean, default=True)

    # Relationships
    annotations = relationship("Annotation", back_populates="class_ref")


class Image(Base):
    __tablename__ = "images"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    cloudinary_url = Column(String, nullable=True)
    local_path = Column(String)
    original_filename = Column(String, nullable=True)
    is_golden = Column(Boolean, default=False)
    is_background = Column(Boolean, default=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="images")
    annotations = relationship("Annotation", back_populates="image", cascade="all, delete-orphan")


class Annotation(Base):
    __tablename__ = "annotations"
    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("images.id", ondelete="CASCADE"))
    class_id = Column(Integer, ForeignKey("classes.id"))
    bbox_x = Column(Float)
    bbox_y = Column(Float)
    bbox_w = Column(Float)
    bbox_h = Column(Float)

    # Relationships
    image = relationship("Image", back_populates="annotations")
    class_ref = relationship("Class", back_populates="annotations")


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    version_name = Column(String, nullable=True)
    augmentation_config = Column(JSON)
    status = Column(String, default="draft")  # draft | generating | generated | failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Thống kê split
    total_images = Column(Integer, default=0)
    train_count = Column(Integer, default=0)
    val_count = Column(Integer, default=0)
    test_count = Column(Integer, default=0)
    split_ratio = Column(String, default="70/20/10")
    generated_at = Column(DateTime(timezone=True), nullable=True)
    yolo_dataset_path = Column(String, nullable=True)  # Đường dẫn thư mục YOLO output

    # Relationships
    project = relationship("Project", back_populates="dataset_versions")
    version_images = relationship(
        "DatasetVersionImage", back_populates="version", cascade="all, delete-orphan"
    )


class DatasetVersionImage(Base):
    """Bảng snapshot trung gian: track ảnh nào thuộc version nào + split assignment."""
    __tablename__ = "dataset_version_images"
    __table_args__ = (
        UniqueConstraint("version_id", "image_id", name="uq_version_image"),
    )

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("dataset_versions.id", ondelete="CASCADE"), index=True)
    image_id = Column(Integer, ForeignKey("images.id", ondelete="CASCADE"), index=True)
    split = Column(String, nullable=False)  # "train" | "val" | "test"

    # Relationships
    version = relationship("DatasetVersion", back_populates="version_images")
    image = relationship("Image")


class Model(Base):
    __tablename__ = "models"
    id = Column(Integer, primary_key=True, index=True)
    version_name = Column(String)
    file_path = Column(String)
    map50 = Column(Float)
    is_active_model = Column(Boolean, default=False)
