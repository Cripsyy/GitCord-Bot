from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.webhooks import router as webhooks_router


def create_app() -> FastAPI:
    app = FastAPI(title="DevOps GitHub Discord Assistant", version="1.0.0")
    app.include_router(health_router)
    app.include_router(webhooks_router)
    return app
