from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.webhooks import router as webhooks_router
from app.bot.client import DiscordAssistantClient
from app.config import Settings


def create_app(settings: Settings, bot_client: DiscordAssistantClient) -> FastAPI:
    app = FastAPI(title="DevOps GitHub Discord Assistant", version="1.0.0")
    app.state.settings = settings
    app.state.bot_client = bot_client
    app.include_router(health_router)
    app.include_router(webhooks_router)
    return app
