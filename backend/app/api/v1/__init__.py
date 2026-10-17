from fastapi import APIRouter

from app.api.v1 import (
    completion,
    health,
    images,
    jobs,
    marketplace,
    speech,
    tracking,
    translate,
    workers,
)

router = APIRouter(prefix="/api/v1")
router.include_router(health.router)
router.include_router(images.router)
router.include_router(jobs.router)
router.include_router(marketplace.router)
router.include_router(completion.router)
router.include_router(speech.router)
router.include_router(tracking.router)
router.include_router(translate.router)
router.include_router(workers.router)
