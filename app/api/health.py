import logging

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])
_last_status: str | None = None


@router.get("/health")
async def health_check() -> dict[str, str]:
    global _last_status
    status = "ok"
    if _last_status != status:
        logging.getLogger("health").info("Health status changed to %s", status)
        _last_status = status
    return {"status": status}
