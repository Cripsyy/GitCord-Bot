import asyncio
import logging
from datetime import UTC, datetime

from app.bot.client import DiscordAssistantClient
from app.bot.summaries import (
    build_briefing_embed,
    fetch_open_prs_needing_review,
    fetch_unassigned_issues,
    fetch_yesterday_standups,
    get_repos_for_guild,
)
from app.config import Settings
from app.core.database import get_session
from app.models.summary_config import SummaryConfig

logger = logging.getLogger("discord_bot.scheduler")


async def run_summary_scheduler(bot_client: DiscordAssistantClient, settings: Settings) -> None:
    logger.info("Summary scheduler started")
    while True:
        try:
            await _check_and_send_due_summaries(bot_client, settings)
        except Exception:
            logger.exception("Error in summary scheduler cycle")
        await asyncio.sleep(60)


async def _check_and_send_due_summaries(
    bot_client: DiscordAssistantClient,
    settings: Settings,
) -> None:
    now = datetime.now(UTC)
    current_time = now.strftime("%H:%M")

    for session in get_session(settings):
        configs = (
            session.query(SummaryConfig)
            .filter(
                SummaryConfig.enabled == True,
                SummaryConfig.send_time == current_time,
            )
            .all()
        )
        break

    for config in configs:
        try:
            repos = get_repos_for_guild(settings, config.guild_id)

            prs = fetch_open_prs_needing_review(settings, repos) if config.include_prs else []
            issues = fetch_unassigned_issues(settings, repos) if config.include_issues else []
            standups = fetch_yesterday_standups(settings, config.guild_id) if config.include_standups else []

            embed = build_briefing_embed(config, prs, issues, standups)
            await bot_client.send_embed_to_channel(config.channel_id, embed)
            logger.info(
                "Sent daily briefing to channel %s (guild %s): %d PRs, %d issues, %d standups",
                config.channel_id,
                config.guild_id,
                len(prs),
                len(issues),
                len(standups),
            )
        except Exception:
            logger.exception(
                "Failed to send daily briefing for config %s (guild %s)",
                config.id,
                config.guild_id,
            )
