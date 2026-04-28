import asyncio
import logging

import discord
import uvicorn

from app.bot.client import DiscordAssistantClient
from app.config import get_settings
from app.core.database import init_database
from app.logging_config import configure_logging
from app.server import create_app


async def run() -> None:
    settings = get_settings()
    configure_logging(settings.log_level, database_url=settings.database_url)
    logger = logging.getLogger("runtime")

    init_database(settings)

    intents = discord.Intents.default()
    intents.guilds = True
    bot_client = DiscordAssistantClient(intents=intents, settings=settings)

    app = create_app(settings=settings, bot_client=bot_client)
    uvicorn_config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=8000,
        log_level=settings.log_level.lower(),
    )
    server = uvicorn.Server(config=uvicorn_config)

    server_task = asyncio.create_task(server.serve(), name="fastapi_server")
    bot_task = asyncio.create_task(
        bot_client.start(settings.discord_bot_token),
        name="discord_bot",
    )

    done, pending = await asyncio.wait(
        {server_task, bot_task},
        return_when=asyncio.FIRST_EXCEPTION,
    )

    for task in done:
        if task.exception() is not None:
            logger.error("Task %s failed: %s", task.get_name(), task.exception())

    for task in pending:
        task.cancel()

    if not bot_client.is_closed():
        await bot_client.close()
