import logging
from datetime import UTC, date, datetime, timedelta

import discord

from app.config import Settings
from app.core.database import get_session
from app.models.standup_entry import StandupEntry
from app.models.summary_config import SummaryConfig
from app.services.github_client import create_github_client

logger = logging.getLogger("discord_bot.summaries")


def fetch_open_prs_needing_review(settings: Settings, repos: list[str]) -> list[dict]:
    github_client = create_github_client(settings)
    results: list[dict] = []
    for repo_full_name in repos:
        try:
            repo = github_client.get_repo(repo_full_name)
            pulls = repo.get_pulls(state="open", sort="updated", direction="desc")
            for pr in pulls:
                reviews = pr.get_reviews()
                approved = any(
                    r.state == "APPROVED" for r in reviews
                )
                if not approved:
                    results.append({
                        "number": pr.number,
                        "title": pr.title,
                        "url": pr.html_url,
                        "author": pr.user.login if pr.user else "unknown",
                        "repo": repo_full_name,
                        "created_at": pr.created_at.isoformat() if pr.created_at else None,
                    })
        except Exception:
            logger.exception("Failed to fetch PRs for %s", repo_full_name)
    return results


def fetch_unassigned_issues(settings: Settings, repos: list[str]) -> list[dict]:
    github_client = create_github_client(settings)
    results: list[dict] = []
    for repo_full_name in repos:
        try:
            repo = github_client.get_repo(repo_full_name)
            issues = repo.get_issues(state="open", sort="updated", direction="desc")
            for issue in issues:
                if issue.pull_request is not None:
                    continue
                if issue.assignee is None:
                    results.append({
                        "number": issue.number,
                        "title": issue.title,
                        "url": issue.html_url,
                        "repo": repo_full_name,
                    })
        except Exception:
            logger.exception("Failed to fetch issues for %s", repo_full_name)
    return results


def fetch_yesterday_standups(settings: Settings, guild_id: str) -> list[dict]:
    today = date.today()
    yesterday = today - timedelta(days=1)
    start = datetime(yesterday.year, yesterday.month, yesterday.day, tzinfo=UTC)
    end = datetime(today.year, today.month, today.day, tzinfo=UTC)

    results: list[dict] = []
    for session in get_session(settings):
        entries = (
            session.query(StandupEntry)
            .filter(
                StandupEntry.guild_id == guild_id,
                StandupEntry.submitted_at >= start,
                StandupEntry.submitted_at < end,
            )
            .order_by(StandupEntry.submitted_at.desc())
            .all()
        )
        for entry in entries:
            results.append({
                "user_name": entry.user_name or entry.user_id,
                "content": entry.content,
                "submitted_at": entry.submitted_at.isoformat() if entry.submitted_at else None,
            })
        break
    return results


def get_repos_for_guild(settings: Settings, guild_id: str) -> list[str]:
    from app.models.webhook_config import WebhookConfig
    from app.models.webhook_subscription import WebhookSubscription

    for session in get_session(settings):
        configs = (
            session.query(WebhookConfig)
            .join(WebhookSubscription, WebhookSubscription.webhook_config_id == WebhookConfig.id)
            .filter(WebhookSubscription.guild_id == guild_id)
            .all()
        )
        return list({c.repository_full_name for c in configs if c.repository_full_name})
    return []


def build_briefing_embed(
    config: SummaryConfig,
    prs: list[dict],
    issues: list[dict],
    standups: list[dict],
) -> discord.Embed:
    embed = discord.Embed(
        title="Daily Briefing",
        description=date.today().strftime("%A, %B %d, %Y"),
        color=discord.Color.blurple(),
    )

    if config.include_prs:
        if prs:
            lines = [
                f"• [#{pr['number']}]({pr['url']}) {pr['title']} — {pr['repo']} — @{pr['author']}"
                for pr in prs[:10]
            ]
            if len(prs) > 10:
                lines.append(f"*...and {len(prs) - 10} more*")
            embed.add_field(
                name=f"Open PRs Needing Review ({len(prs)})",
                value="\n".join(lines),
                inline=False,
            )
        else:
            embed.add_field(name="Open PRs Needing Review", value="No open PRs awaiting review.", inline=False)

    if config.include_issues:
        if issues:
            lines = [
                f"• [#{issue['number']}]({issue['url']}) {issue['title']} — {issue['repo']}"
                for issue in issues[:10]
            ]
            if len(issues) > 10:
                lines.append(f"*...and {len(issues) - 10} more*")
            embed.add_field(
                name=f"Unassigned Issues ({len(issues)})",
                value="\n".join(lines),
                inline=False,
            )
        else:
            embed.add_field(name="Unassigned Issues", value="No unassigned issues.", inline=False)

    if config.include_standups:
        if standups:
            lines = [
                f"• **{s['user_name']}**: {s['content'][:200]}"
                for s in standups[:10]
            ]
            if len(standups) > 10:
                lines.append(f"*...and {len(standups) - 10} more*")
            embed.add_field(
                name=f"Yesterday's Standups ({len(standups)})",
                value="\n".join(lines),
                inline=False,
            )
        else:
            embed.add_field(name="Yesterday's Standups", value="No standups recorded yesterday.", inline=False)

    return embed
