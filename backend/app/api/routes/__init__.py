from fastapi import APIRouter

router = APIRouter()

from .camera_routes import router as camera_router
from .inference_routes import router as inference_router
from .classes_routes import router as classes_router
from .projects_routes import router as projects_router
from .images_routes import router as images_router
from .annotations_routes import router as annotations_router
from .dataset_versions_routes import router as dataset_versions_router

router.include_router(camera_router, prefix="/camera", tags=["camera"])
router.include_router(inference_router, prefix="/inference", tags=["inference"])
router.include_router(classes_router, prefix="/classes", tags=["classes"])
router.include_router(projects_router, prefix="/projects", tags=["projects"])
router.include_router(images_router, tags=["images"])
router.include_router(annotations_router, tags=["annotations"])
router.include_router(dataset_versions_router, tags=["dataset-versions"])

