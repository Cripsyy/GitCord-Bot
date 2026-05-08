from fastapi import APIRouter, HTTPException, Request, status

import secrets
import re

from app.config import Settings
from app.core.database import get_session
from app.models.channel import ChannelConfig
from app.models.guild import GuildConfig
from app.models.webhook_config import WebhookConfig
from app.services.github_webhooks import delete_github_webhook, ensure_github_webhook
from app.services.oauth_clients import fetch_discord_identity, fetch_github_repos
from app.services.oauth_tokens import get_oauth_token

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _get_session(request: Request) -> dict[str, bool]:
    settings: Settings = request.app.state.settings
    discord_user_id = request.cookies.get("discord_user_id")
    github_user_id = request.cookies.get("github_user_id")

    discord_connected = False
    github_connected = False

    if discord_user_id:
        discord_connected = (
            get_oauth_token(settings, provider="discord", subject_id=discord_user_id) is not None
        )
    if github_user_id:
        github_connected = (
            get_oauth_token(settings, provider="github", subject_id=github_user_id) is not None
        )

    return {
        "discord_connected": discord_connected,
        "github_connected": github_connected,
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
        break
    return {
        "guilds": guilds,
        "repositories": repo_count,
        "channels": channels,
        "webhook_configs": webhooks,
    }


@router.get("/guilds")
async def list_guilds(request: Request) -> list[dict[str, object]]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        guilds = session.query(GuildConfig).order_by(GuildConfig.created_at.desc()).all()
        break
    return [
        {
            "id": str(guild.id),
            "name": guild.name,
            "ai_summary_enabled": guild.ai_summary_enabled,
            "ai_max_diff_chars": guild.ai_max_diff_chars,
            "llm_model": guild.llm_model,
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
            "llm_model": webhook.llm_model,
            "created_at": webhook.created_at.isoformat() if webhook.created_at else None,
        }
        for webhook in webhooks
    ]


@router.post("/webhooks", status_code=status.HTTP_201_CREATED)
async def create_webhook(request: Request, payload: dict[str, object]) -> dict[str, object]:
    _require_full_session(request)
    settings: Settings = request.app.state.settings

    guild_id = str(payload.get("guild_id") or "").strip()
    secret_slug = str(payload.get("secret_slug") or "").strip()
    webhook_secret = str(payload.get("webhook_secret") or "").strip()
    repository_full_name = str(payload.get("repository_full_name") or "").strip()
    channel_id = str(payload.get("channel_id") or "").strip()
    ai_summary_enabled = bool(payload.get("ai_summary_enabled", True))
    ai_max_diff_chars = int(payload.get("ai_max_diff_chars") or 12000)
    llm_model = payload.get("llm_model")

    if not guild_id or not secret_slug or not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="guild_id, secret_slug, and webhook_secret are required",
        )

    if not repository_full_name or not channel_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="repository_full_name and channel_id are required",
        )

    for session in get_session(settings):
        webhook = (
            session.query(WebhookConfig)
            .filter(
                WebhookConfig.guild_id == guild_id,
                WebhookConfig.secret_slug == secret_slug,
            )
            .one_or_none()
        )
        if webhook is None:
            webhook = WebhookConfig(
                guild_id=guild_id,
                secret_slug=secret_slug,
                webhook_secret=webhook_secret,
                repository_full_name=repository_full_name,
                channel_id=channel_id,
                ai_summary_enabled=ai_summary_enabled,
                ai_max_diff_chars=ai_max_diff_chars,
                llm_model=llm_model if isinstance(llm_model, str) else None,
            )
            session.add(webhook)
        else:
            webhook.webhook_secret = webhook_secret
            webhook.repository_full_name = repository_full_name
            webhook.channel_id = channel_id
            webhook.ai_summary_enabled = ai_summary_enabled
            webhook.ai_max_diff_chars = ai_max_diff_chars
            webhook.llm_model = llm_model if isinstance(llm_model, str) else None
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
            "llm_model": webhook.llm_model,
        }
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
                    events=["push", "pull_request", "issues"],
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
