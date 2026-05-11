import asyncio
import logging

import discord
import uvicorn

from app.bot.client import DiscordAssistantClient
from app.bot.scheduler import run_summary_scheduler
from app.config import get_settings
from app.core.database import init_database
from app.logging_config import configure_logging
from app.server import create_app


async def _run_bot(bot_client: DiscordAssistantClient, token: str, logger: logging.Logger) -> None:
    retry_delay = 5
    max_retry_delay = 300
    while True:
        try:
            await bot_client.start(token)
            return
        except Exception as exc:
            logger.error("Discord bot failed: %s. Retrying in %ds...", exc, retry_delay)
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, max_retry_delay)
            if not bot_client.is_closed():
                await bot_client.close()


async def run() -> None:
    settings = get_settings()
    configure_logging(settings.log_level, database_url=settings.database_url)
    logger = logging.getLogger("runtime")

    init_database(settings)

    intents = discord.Intents.default()
    intents.guilds = True
    bot_client = DiscordAssistantClient(intents=intents, settings=settings)

    app = create_app(settings=settings, bot_client=bot_client)
    dashboard_url = f"{settings.oauth_redirect_base_url.rstrip('/')}/dashboard"
    logger.info("Dashboard available at %s", dashboard_url)
    uvicorn_config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=8000,
        log_level=settings.log_level.lower(),
    )
    server = uvicorn.Server(config=uvicorn_config)

    summary_task = asyncio.create_task(
        run_summary_scheduler(bot_client, settings),
        name="summary_scheduler",
    )

    server_task = asyncio.create_task(server.serve(), name="fastapi_server")
    bot_task = asyncio.create_task(
        _run_bot(bot_client, settings.discord_bot_token, logger),
        name="discord_bot",
    )

    await server_task

    bot_task.cancel()
    try:
        await bot_task
    except asyncio.CancelledError:
        pass

    if not bot_client.is_closed():
        await bot_client.close()
