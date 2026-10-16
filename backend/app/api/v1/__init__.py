from fastapi import APIRouter

from app.api.v1 import health, images, jobs

router = APIRouter(prefix="/api/v1")
router.include_router(health.router)
router.include_router(images.router)
router.include_router(jobs.router)
