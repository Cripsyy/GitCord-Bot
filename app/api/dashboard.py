from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, status

import discord
import secrets
import re

from app.config import Settings
from app.core.database import get_session
from app.models.channel import ChannelConfig
from app.models.guild import GuildConfig
from app.models.leaderboard_config import LeaderboardConfig
from app.models.leaderboard_entry import LeaderboardEntry
from app.models.standup_entry import StandupEntry
from app.models.summary_config import SummaryConfig
from app.models.webhook_config import WebhookConfig
from app.services.github_webhooks import delete_github_webhook, ensure_github_webhook
from app.services.oauth_clients import fetch_discord_identity, fetch_github_repos
from app.services.oauth_tokens import get_oauth_token, is_token_expired

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _get_session(request: Request) -> dict[str, bool]:
    settings: Settings = request.app.state.settings
    discord_user_id = request.cookies.get("discord_user_id")
    github_user_id = request.cookies.get("github_user_id")

    discord_connected = False
    github_connected = False
    discord_expired = False
    github_expired = False

    if discord_user_id:
        discord_connected = (
            get_oauth_token(settings, provider="discord", subject_id=discord_user_id) is not None
        )
        discord_expired = is_token_expired(settings, provider="discord", subject_id=discord_user_id)
    if github_user_id:
        github_connected = (
            get_oauth_token(settings, provider="github", subject_id=github_user_id) is not None
        )
        github_expired = is_token_expired(settings, provider="github", subject_id=github_user_id)

    return {
        "discord_connected": discord_connected,
        "github_connected": github_connected,
        "discord_expired": discord_expired,
        "github_expired": github_expired,
    }


def _require_session(request: Request) -> dict[str, bool]:
    session_info = _get_session(request)
    if not session_info["discord_connected"] and not session_info["github_connected"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OAuth login required",
        )
    return session_info


def _require_full_session(request: Request) -> dict[str, bool]:
    session_info = _get_session(request)
    if not session_info["discord_connected"] or not session_info["github_connected"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Discord and GitHub OAuth required",
        )
    return session_info


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9-]+", "-", value)
    cleaned = re.sub(r"-+", "-", cleaned).strip("-")
    return cleaned.lower() or "repo"


@router.get("/session")
async def get_session_info(request: Request) -> dict[str, bool]:
    return _get_session(request)


@router.get("/profile")
async def get_profile(request: Request) -> dict[str, object | None]:
    settings: Settings = request.app.state.settings
    discord_user_id = request.cookies.get("discord_user_id")

    if not discord_user_id:
        return {"discord": None}

    token = get_oauth_token(settings, provider="discord", subject_id=discord_user_id)
    if token is None:
        return {"discord": None}

    identity = await fetch_discord_identity(token.access_token)
    user_id = str(identity.get("id") or discord_user_id)
    avatar_hash = identity.get("avatar")
    if avatar_hash:
        avatar_url = f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png?size=128"
    else:
        discriminator = str(identity.get("discriminator") or "0")
        avatar_url = f"https://cdn.discordapp.com/embed/avatars/{int(discriminator) % 5}.png"

    username = identity.get("global_name") or identity.get("username") or "Discord User"
    return {
        "discord": {
            "id": user_id,
            "username": username,
            "avatar_url": avatar_url,
        }
    }


@router.get("/overview")
async def dashboard_overview(request: Request) -> dict[str, int]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    github_user_id = request.cookies.get("github_user_id")
    repo_count = 0
    if github_user_id:
        token = get_oauth_token(settings, provider="github", subject_id=github_user_id)
        if token:
            repos = await fetch_github_repos(token.access_token)
            repo_count = len(repos)
    for session in get_session(settings):
        guilds = session.query(GuildConfig).count()
        channels = session.query(ChannelConfig).count()
        webhooks = session.query(WebhookConfig).count()
        leaderboard_entries = session.query(LeaderboardEntry).count()
        break
    return {
        "guilds": guilds,
        "repositories": repo_count,
        "channels": channels,
        "webhook_configs": webhooks,
        "summary_configs": 0,
        "leaderboard_entries": leaderboard_entries,
    }


@router.get("/guilds")
async def list_guilds(request: Request) -> list[dict[str, object]]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    bot_client = request.app.state.bot_client
    await bot_client._sync_guild_configs()
    for session in get_session(settings):
        guilds = session.query(GuildConfig).order_by(GuildConfig.created_at.desc()).all()
        break
    return [
        {
            "id": str(guild.id),
            "name": guild.name,
            "ai_summary_enabled": guild.ai_summary_enabled,
            "ai_max_diff_chars": guild.ai_max_diff_chars,
            "created_at": guild.created_at.isoformat() if guild.created_at else None,
        }
        for guild in guilds
    ]


@router.get("/webhooks")
async def list_webhooks(request: Request) -> list[dict[str, object]]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        webhooks = session.query(WebhookConfig).order_by(WebhookConfig.created_at.desc()).all()
        break
    return [
        {
            "id": str(webhook.id),
            "guild_id": str(webhook.guild_id),
            "secret_slug": webhook.secret_slug,
            "repository_full_name": webhook.repository_full_name,
            "channel_id": str(webhook.channel_id),
            "ai_summary_enabled": webhook.ai_summary_enabled,
            "ai_max_diff_chars": webhook.ai_max_diff_chars,
            "events": webhook.events,
            "created_at": webhook.created_at.isoformat() if webhook.created_at else None,
        }
        for webhook in webhooks
    ]


def _make_unique_slug(session, guild_id: str, desired_slug: str) -> str:
    candidate = desired_slug
    while (
        session.query(WebhookConfig)
        .filter(
            WebhookConfig.guild_id == guild_id,
            WebhookConfig.secret_slug == candidate,
        )
        .first()
        is not None
    ):
        candidate = f"{desired_slug}-{secrets.token_hex(3)}"
    return candidate


@router.post("/webhooks", status_code=status.HTTP_201_CREATED)
async def create_webhook(request: Request, payload: dict[str, object]) -> dict[str, object]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings

    guild_id = str(payload.get("guild_id") or "").strip()
    repository_full_name = str(payload.get("repository_full_name") or "").strip()
    channel_id = str(payload.get("channel_id") or "").strip()
    ai_summary_enabled = bool(payload.get("ai_summary_enabled", True))
    ai_max_diff_chars = int(payload.get("ai_max_diff_chars") or 12000)
    raw_events = payload.get("events")
    events = raw_events if isinstance(raw_events, list) else ["push", "pull_request", "issues"]

    if not guild_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="guild_id is required",
        )

    if not repository_full_name or not channel_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="repository_full_name and channel_id are required",
        )

    github_user_id = request.cookies.get("github_user_id")
    github_token = None
    if github_user_id:
        github_token = get_oauth_token(settings, provider="github", subject_id=github_user_id)

    webhook_url_base = settings.oauth_redirect_base_url.rstrip("/")

    for session in get_session(settings):
        repo_slug = _slugify(repository_full_name)
        secret_slug = _make_unique_slug(session, guild_id, f"{repo_slug}-{secrets.token_hex(3)}")
        webhook_secret = secrets.token_urlsafe(32)
        webhook = WebhookConfig(
            guild_id=guild_id,
            secret_slug=secret_slug,
            webhook_secret=webhook_secret,
            repository_full_name=repository_full_name,
            channel_id=channel_id,
            ai_summary_enabled=ai_summary_enabled,
            ai_max_diff_chars=ai_max_diff_chars,
            events=events,
        )
        session.add(webhook)
        session.commit()
        session.refresh(webhook)

        if github_token:
            webhook_url = f"{webhook_url_base}/webhooks/github/{guild_id}/{secret_slug}"
            webhook_url_prefix = f"{webhook_url_base}/webhooks/github/{guild_id}/"
            try:
                await ensure_github_webhook(
                    access_token=github_token.access_token,
                    repo_full_name=repository_full_name,
                    webhook_url=webhook_url,
                    webhook_secret=webhook_secret,
                    events=events,
                    url_prefix=webhook_url_prefix,
                )
            except Exception:
                pass

        return {
            "id": str(webhook.id),
            "guild_id": str(webhook.guild_id),
            "secret_slug": webhook.secret_slug,
            "repository_full_name": webhook.repository_full_name,
            "channel_id": str(webhook.channel_id),
            "ai_summary_enabled": webhook.ai_summary_enabled,
            "ai_max_diff_chars": webhook.ai_max_diff_chars,
            "events": webhook.events,
        }
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")


@router.put("/webhooks/{webhook_id}")
async def update_webhook(request: Request, webhook_id: str, payload: dict[str, object]) -> dict[str, object]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings

    repository_full_name = payload.get("repository_full_name")
    channel_id = payload.get("channel_id")
    ai_summary_enabled = payload.get("ai_summary_enabled")
    ai_max_diff_chars = payload.get("ai_max_diff_chars")
    raw_events = payload.get("events")

    for session in get_session(settings):
        webhook = session.get(WebhookConfig, int(webhook_id))
        if webhook is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")

        if repository_full_name is not None:
            repo_value = str(repository_full_name).strip()
            if not repo_value:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="repository_full_name cannot be empty",
                )
            webhook.repository_full_name = repo_value

        if channel_id is not None:
            channel_value = str(channel_id).strip()
            if not channel_value:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="channel_id cannot be empty",
                )
            webhook.channel_id = channel_value

        if ai_summary_enabled is not None:
            webhook.ai_summary_enabled = bool(ai_summary_enabled)

        if ai_max_diff_chars is not None:
            webhook.ai_max_diff_chars = int(ai_max_diff_chars)

        if raw_events is not None and isinstance(raw_events, list):
            webhook.events = raw_events

        session.commit()
        session.refresh(webhook)
        return {
            "id": str(webhook.id),
            "guild_id": str(webhook.guild_id),
            "secret_slug": webhook.secret_slug,
            "repository_full_name": webhook.repository_full_name,
            "channel_id": str(webhook.channel_id),
            "ai_summary_enabled": webhook.ai_summary_enabled,
            "ai_max_diff_chars": webhook.ai_max_diff_chars,
            "events": webhook.events,
        }
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")


@router.post("/webhooks/{webhook_id}/test", status_code=status.HTTP_202_ACCEPTED)
async def send_test_webhook_message(request: Request, webhook_id: str, payload: dict[str, object]) -> dict[str, str]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    bot_client = request.app.state.bot_client

    message_text = str(payload.get("message", "")).strip()
    if not message_text:
        message_text = "Test message from the GitCord dashboard."

    for session in get_session(settings):
        webhook = session.get(WebhookConfig, int(webhook_id))
        if webhook is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")

        embed = discord.Embed(
            title="Webhook Test",
            description=message_text,
            color=discord.Color.blurple(),
        )
        embed.add_field(name="Repository", value=webhook.repository_full_name, inline=False)
        embed.add_field(name="Channel ID", value=str(webhook.channel_id), inline=False)
        await bot_client.send_embed_to_channel(webhook.channel_id, embed)
        return {"status": "sent"}
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(request: Request, webhook_id: str) -> None:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    github_user_id = request.cookies.get("github_user_id")
    github_token = None
    if github_user_id:
        github_token = get_oauth_token(settings, provider="github", subject_id=github_user_id)
    for session in get_session(settings):
        webhook = session.get(WebhookConfig, int(webhook_id))
        if webhook is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
        if github_token is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitHub OAuth required")
        webhook_url_base = settings.oauth_redirect_base_url.rstrip("/")
        webhook_url = f"{webhook_url_base}/webhooks/github/{webhook.guild_id}/{webhook.secret_slug}"
        webhook_url_prefix = f"{webhook_url_base}/webhooks/github/{webhook.guild_id}/"
        try:
            await delete_github_webhook(
                access_token=github_token.access_token,
                repo_full_name=webhook.repository_full_name,
                webhook_url=webhook_url,
                url_prefix=webhook_url_prefix,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to remove GitHub webhook for {webhook.repository_full_name}: {exc}",
            ) from exc
        session.delete(webhook)
        session.commit()
        return None
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")


@router.get("/channels")
async def list_channels(request: Request) -> list[dict[str, object]]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    bot_client = request.app.state.bot_client
    await bot_client.sync_guild_channels()
    for session in get_session(settings):
        channels = session.query(ChannelConfig).order_by(ChannelConfig.created_at.desc()).all()
        break
    return [
        {
            "id": str(channel.id),
            "guild_id": str(channel.guild_id),
            "channel_id": str(channel.channel_id),
            "name": channel.name,
            "created_at": channel.created_at.isoformat() if channel.created_at else None,
        }
        for channel in channels
    ]


@router.get("/repositories")
async def list_repositories(request: Request) -> list[dict[str, object]]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    github_user_id = request.cookies.get("github_user_id")
    if not github_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitHub OAuth required")
    token = get_oauth_token(settings, provider="github", subject_id=github_user_id)
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitHub OAuth required")
    repos = await fetch_github_repos(token.access_token)
    return [
        {
            "id": str(repo.get("id")) if repo.get("id") is not None else None,
            "full_name": repo.get("full_name"),
            "private": repo.get("private"),
            "html_url": repo.get("html_url"),
        }
        for repo in repos
        if repo.get("full_name")
    ]


@router.post("/subscriptions")
async def update_subscriptions(request: Request, payload: dict[str, object]) -> dict[str, object]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings

    github_user_id = request.cookies.get("github_user_id")
    if not github_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitHub OAuth required")
    github_token = get_oauth_token(settings, provider="github", subject_id=github_user_id)
    if github_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitHub OAuth required")

    guild_id = str(payload.get("guild_id") or "").strip()
    channel_id = str(payload.get("channel_id") or "").strip()
    repositories = payload.get("repositories")
    if not guild_id or not channel_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="guild_id and channel_id required")
    if not isinstance(repositories, list) or not repositories:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="repositories required")

    repo_list = sorted({str(repo).strip() for repo in repositories if str(repo).strip()})
    if not repo_list:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="repositories required")

    webhook_url_base = settings.oauth_redirect_base_url.rstrip("/")
    webhook_url_prefix = f"{webhook_url_base}/webhooks/github/{guild_id}/"

    results: list[dict[str, object]] = []
    for session in get_session(settings):
        existing = (
            session.query(WebhookConfig)
            .filter(WebhookConfig.guild_id == guild_id)
            .all()
        )
        existing_by_repo = {wh.repository_full_name: wh for wh in existing}

        for webhook in existing:
            if webhook.repository_full_name not in repo_list:
                webhook_url = f"{webhook_url_base}/webhooks/github/{guild_id}/{webhook.secret_slug}"
                try:
                    await delete_github_webhook(
                        access_token=github_token.access_token,
                        repo_full_name=webhook.repository_full_name,
                        webhook_url=webhook_url,
                        url_prefix=webhook_url_prefix,
                    )
                except Exception as exc:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Failed to remove GitHub webhook for {webhook.repository_full_name}: {exc}",
                    ) from exc
                session.delete(webhook)

        for repo_full_name in repo_list:
            webhook = existing_by_repo.get(repo_full_name)
            if webhook is None:
                secret_slug = f"{_slugify(repo_full_name)}-{secrets.token_urlsafe(6)}"
                webhook_secret = secrets.token_urlsafe(32)
                webhook = WebhookConfig(
                    guild_id=guild_id,
                    secret_slug=secret_slug,
                    webhook_secret=webhook_secret,
                    repository_full_name=repo_full_name,
                    channel_id=channel_id,
                    ai_summary_enabled=True,
                )
                session.add(webhook)
            else:
                webhook.channel_id = channel_id
            webhook_url = f"{webhook_url_base}/webhooks/github/{guild_id}/{webhook.secret_slug}"
            try:
                github_result = await ensure_github_webhook(
                    access_token=github_token.access_token,
                    repo_full_name=repo_full_name,
                    webhook_url=webhook_url,
                    webhook_secret=webhook.webhook_secret,
                    events=webhook.events or ["push", "pull_request", "issues"],
                    url_prefix=webhook_url_prefix,
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to sync GitHub webhook for {repo_full_name}: {exc}",
                ) from exc
            results.append(
                {
                    "repository_full_name": repo_full_name,
                    "channel_id": str(channel_id),
                    "secret_slug": webhook.secret_slug,
                    "webhook_url": webhook_url,
                    "github_hook": github_result,
                }
            )

        session.commit()
        break

    return {"subscriptions": results}


@router.get("/summary-configs")
async def list_summary_configs(request: Request) -> list[dict[str, object]]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        configs = session.query(SummaryConfig).order_by(SummaryConfig.created_at.desc()).all()
        break
    return [
        {
            "id": str(c.id),
            "guild_id": str(c.guild_id),
            "channel_id": str(c.channel_id),
            "send_time": c.send_time,
            "include_prs": c.include_prs,
            "include_issues": c.include_issues,
            "include_standups": c.include_standups,
            "enabled": c.enabled,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in configs
    ]


@router.post("/summary-configs", status_code=status.HTTP_201_CREATED)
async def create_summary_config(request: Request, payload: dict[str, object]) -> dict[str, object]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings

    guild_id = str(payload.get("guild_id") or "").strip()
    channel_id = str(payload.get("channel_id") or "").strip()
    send_time = str(payload.get("send_time") or "").strip()
    include_prs = bool(payload.get("include_prs", True))
    include_issues = bool(payload.get("include_issues", True))
    include_standups = bool(payload.get("include_standups", True))
    enabled = bool(payload.get("enabled", True))

    if not guild_id or not channel_id or not send_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="guild_id, channel_id, and send_time are required",
        )

    for session in get_session(settings):
        config = SummaryConfig(
            guild_id=guild_id,
            channel_id=channel_id,
            send_time=send_time,
            include_prs=include_prs,
            include_issues=include_issues,
            include_standups=include_standups,
            enabled=enabled,
        )
        session.add(config)
        session.commit()
        session.refresh(config)
        return {
            "id": str(config.id),
            "guild_id": str(config.guild_id),
            "channel_id": str(config.channel_id),
            "send_time": config.send_time,
            "include_prs": config.include_prs,
            "include_issues": config.include_issues,
            "include_standups": config.include_standups,
            "enabled": config.enabled,
            "created_at": config.created_at.isoformat() if config.created_at else None,
        }
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")


@router.put("/summary-configs/{config_id}")
async def update_summary_config(request: Request, config_id: str, payload: dict[str, object]) -> dict[str, object]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings

    for session in get_session(settings):
        config = session.get(SummaryConfig, int(config_id))
        if config is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Summary config not found")

        channel_id = payload.get("channel_id")
        send_time = payload.get("send_time")
        include_prs = payload.get("include_prs")
        include_issues = payload.get("include_issues")
        include_standups = payload.get("include_standups")
        enabled = payload.get("enabled")

        if channel_id is not None:
            config.channel_id = str(channel_id).strip()
        if send_time is not None:
            config.send_time = str(send_time).strip()
        if include_prs is not None:
            config.include_prs = bool(include_prs)
        if include_issues is not None:
            config.include_issues = bool(include_issues)
        if include_standups is not None:
            config.include_standups = bool(include_standups)
        if enabled is not None:
            config.enabled = bool(enabled)

        session.commit()
        session.refresh(config)
        return {
            "id": str(config.id),
            "guild_id": str(config.guild_id),
            "channel_id": str(config.channel_id),
            "send_time": config.send_time,
            "include_prs": config.include_prs,
            "include_issues": config.include_issues,
            "include_standups": config.include_standups,
            "enabled": config.enabled,
            "created_at": config.created_at.isoformat() if config.created_at else None,
        }
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")


@router.delete("/summary-configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_summary_config(request: Request, config_id: str) -> None:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        config = session.get(SummaryConfig, int(config_id))
        if config is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Summary config not found")
        session.delete(config)
        session.commit()
        return None
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")


@router.get("/standups")
async def list_standups(request: Request, guild_id: str, date: str | None = None) -> list[dict[str, object]]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings

    if date:
        try:
            start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=UTC)
            end = start + timedelta(days=1)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid date format, use YYYY-MM-DD",
            )
    else:
        today_date = datetime.now(UTC).date()
        end = datetime(today_date.year, today_date.month, today_date.day, tzinfo=UTC)
        start = end - timedelta(days=1)

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
        return [
            {
                "id": str(e.id),
                "user_id": str(e.user_id),
                "user_name": e.user_name,
                "content": e.content,
                "submitted_at": e.submitted_at.isoformat() if e.submitted_at else None,
            }
            for e in entries
        ]
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")


@router.get("/leaderboard")
async def list_leaderboard(request: Request, guild_id: str | None = None) -> list[dict[str, object]]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        query = session.query(LeaderboardEntry).order_by(LeaderboardEntry.xp.desc())
        if guild_id:
            query = query.filter(LeaderboardEntry.guild_id == guild_id)
        entries = query.all()
        break
    return [
        {
            "id": str(e.id),
            "guild_id": str(e.guild_id),
            "github_user": e.github_user,
            "discord_user_id": e.discord_user_id,
            "user_name": e.user_name,
            "xp": e.xp,
            "level": e.level,
        }
        for e in entries
    ]


@router.get("/leaderboard/config")
async def get_leaderboard_config(request: Request, guild_id: str) -> dict[str, object] | None:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        config = (
            session.query(LeaderboardConfig)
            .filter(LeaderboardConfig.guild_id == guild_id)
            .one_or_none()
        )
        if config is None:
            return None
        return {
            "id": str(config.id),
            "guild_id": str(config.guild_id),
            "enabled": config.enabled,
            "base_xp": config.base_xp,
            "start_increment": config.start_increment,
            "increment_step": config.increment_step,
            "xp_settings": config.xp_settings,
            "role_milestones": config.role_milestones,
        }
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")


@router.post("/leaderboard/config", status_code=status.HTTP_201_CREATED)
async def upsert_leaderboard_config(request: Request, payload: dict[str, object]) -> dict[str, object]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings

    guild_id = str(payload.get("guild_id") or "").strip()
    if not guild_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="guild_id required")

    for session in get_session(settings):
        config = (
            session.query(LeaderboardConfig)
            .filter(LeaderboardConfig.guild_id == guild_id)
            .one_or_none()
        )
        if config is None:
            config = LeaderboardConfig(guild_id=guild_id)
            session.add(config)

        if "enabled" in payload:
            config.enabled = bool(payload["enabled"])
        if "base_xp" in payload and isinstance(payload["base_xp"], (int, float)):
            config.base_xp = int(payload["base_xp"])
        if "start_increment" in payload and isinstance(payload["start_increment"], (int, float)):
            config.start_increment = int(payload["start_increment"])
        if "increment_step" in payload and isinstance(payload["increment_step"], (int, float)):
            config.increment_step = int(payload["increment_step"])
        if "xp_settings" in payload and isinstance(payload["xp_settings"], dict):
            config.xp_settings = payload["xp_settings"]
        if "role_milestones" in payload and isinstance(payload["role_milestones"], list):
            old_role_names = [m.get("role_name", "") for m in (config.role_milestones or [])]
            config.role_milestones = payload["role_milestones"]

        session.commit()
        session.refresh(config)

        if "role_milestones" in payload and isinstance(payload["role_milestones"], list):
            bot_client = request.app.state.bot_client
            if bot_client is not None:
                await bot_client.sync_milestone_roles(guild_id, payload["role_milestones"], old_role_names)

        return {
            "id": str(config.id),
            "guild_id": str(config.guild_id),
            "enabled": config.enabled,
            "base_xp": config.base_xp,
            "start_increment": config.start_increment,
            "increment_step": config.increment_step,
            "xp_settings": config.xp_settings,
            "role_milestones": config.role_milestones,
        }
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")
