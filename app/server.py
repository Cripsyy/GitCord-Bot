from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.responses import FileResponse

from app.api.health import router as health_router
from app.api.oauth import router as oauth_router
from app.api.dashboard import router as dashboard_router
from app.api.webhooks import router as webhooks_router
from app.bot.client import DiscordAssistantClient
from app.config import Settings


def create_app(settings: Settings, bot_client: DiscordAssistantClient) -> FastAPI:
    app = FastAPI(title="DevOps GitHub Discord Assistant", version="1.0.0")
    app.state.settings = settings
    app.state.bot_client = bot_client
    app.include_router(health_router)
    app.include_router(oauth_router)
    app.include_router(dashboard_router)
    app.include_router(webhooks_router)

    web_root = Path(__file__).resolve().parent / "web" / "dist"
    if web_root.exists():
        @app.get("/", include_in_schema=False)
        async def dashboard_root() -> RedirectResponse:
            return RedirectResponse(url="/dashboard", status_code=302)

        @app.get("/dashboard", include_in_schema=False)
        async def dashboard_index() -> FileResponse:
            return FileResponse(web_root / "index.html")

        @app.get("/dashboard/", include_in_schema=False)
        async def dashboard_index_slash() -> FileResponse:
            return FileResponse(web_root / "index.html")

        @app.get("/dashboard/{full_path:path}", include_in_schema=False)
        async def dashboard_assets(full_path: str) -> FileResponse:
            file_path = web_root / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(web_root / "index.html")

        @app.get("/configurations", include_in_schema=False)
        async def configurations_index() -> FileResponse:
            return FileResponse(web_root / "index.html")

        @app.get("/configurations/{full_path:path}", include_in_schema=False)
        async def configurations_assets(full_path: str) -> FileResponse:
            file_path = web_root / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(web_root / "index.html")

        @app.get("/configurations/webhooks", include_in_schema=False)
        async def configurations_webhooks_index() -> FileResponse:
            return FileResponse(web_root / "index.html")

        @app.get("/configurations/webhooks/{full_path:path}", include_in_schema=False)
        async def configurations_webhooks_assets(full_path: str) -> FileResponse:
            file_path = web_root / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(web_root / "index.html")

        @app.get("/configurations/summaries", include_in_schema=False)
        async def configurations_summaries_index() -> FileResponse:
            return FileResponse(web_root / "index.html")

        @app.get("/configurations/summaries/{full_path:path}", include_in_schema=False)
        async def configurations_summaries_assets(full_path: str) -> FileResponse:
            file_path = web_root / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(web_root / "index.html")

        @app.get("/leaderboard", include_in_schema=False)
        async def leaderboard_index() -> FileResponse:
            return FileResponse(web_root / "index.html")

        @app.get("/leaderboard/{full_path:path}", include_in_schema=False)
        async def leaderboard_assets(full_path: str) -> FileResponse:
            file_path = web_root / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(web_root / "index.html")

        @app.get("/configurations/leaderboard", include_in_schema=False)
        async def configurations_leaderboard_index() -> FileResponse:
            return FileResponse(web_root / "index.html")

        @app.get("/configurations/leaderboard/{full_path:path}", include_in_schema=False)
        async def configurations_leaderboard_assets(full_path: str) -> FileResponse:
            file_path = web_root / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(web_root / "index.html")
    else:
        @app.get("/", include_in_schema=False)
        async def dashboard_root_unavailable() -> dict[str, str]:
            return {"status": "dashboard_build_missing"}
    return app
