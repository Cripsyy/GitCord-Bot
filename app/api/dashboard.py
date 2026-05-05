from fastapi import APIRouter, HTTPException, Request, status

from app.config import Settings
from app.core.database import get_session
from app.models.channel import ChannelConfig
from app.models.guild import GuildConfig
from app.models.repository import RepositoryConfig
from app.models.webhook_config import WebhookConfig

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _require_key(request: Request) -> None:
    settings: Settings = request.app.state.settings
    if not settings.dashboard_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dashboard API key is not configured",
        )
    provided = request.headers.get("X-Dashboard-Key")
    if not provided or provided != settings.dashboard_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid dashboard key",
        )


@router.get("/overview")
async def dashboard_overview(request: Request) -> dict[str, int]:
    _require_key(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        guilds = session.query(GuildConfig).count()
        repos = session.query(RepositoryConfig).count()
        channels = session.query(ChannelConfig).count()
        webhooks = session.query(WebhookConfig).count()
        break
    return {
        "guilds": guilds,
        "repositories": repos,
        "channels": channels,
        "webhook_configs": webhooks,
    }


@router.get("/guilds")
async def list_guilds(request: Request) -> list[dict[str, object]]:
    _require_key(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        guilds = session.query(GuildConfig).order_by(GuildConfig.created_at.desc()).all()
        break
    return [
        {
            "id": guild.id,
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
    _require_key(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        webhooks = session.query(WebhookConfig).order_by(WebhookConfig.created_at.desc()).all()
        break
    return [
        {
            "id": webhook.id,
            "guild_id": webhook.guild_id,
            "secret_slug": webhook.secret_slug,
            "repository_full_name": webhook.repository_full_name,
            "channel_id": webhook.channel_id,
            "ai_summary_enabled": webhook.ai_summary_enabled,
            "ai_max_diff_chars": webhook.ai_max_diff_chars,
            "llm_model": webhook.llm_model,
            "created_at": webhook.created_at.isoformat() if webhook.created_at else None,
        }
        for webhook in webhooks
    ]


@router.post("/webhooks", status_code=status.HTTP_201_CREATED)
async def create_webhook(request: Request, payload: dict[str, object]) -> dict[str, object]:
    _require_key(request)
    settings: Settings = request.app.state.settings

    guild_id = int(payload.get("guild_id") or 0)
    secret_slug = str(payload.get("secret_slug") or "").strip()
    webhook_secret = str(payload.get("webhook_secret") or "").strip()
    repository_full_name = str(payload.get("repository_full_name") or "").strip()
    channel_id = int(payload.get("channel_id") or 0)
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
            "id": webhook.id,
            "guild_id": webhook.guild_id,
            "secret_slug": webhook.secret_slug,
            "repository_full_name": webhook.repository_full_name,
            "channel_id": webhook.channel_id,
            "ai_summary_enabled": webhook.ai_summary_enabled,
            "ai_max_diff_chars": webhook.ai_max_diff_chars,
            "llm_model": webhook.llm_model,
        }
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(request: Request, webhook_id: int) -> None:
    _require_key(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        webhook = session.get(WebhookConfig, webhook_id)
        if webhook is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
        session.delete(webhook)
        session.commit()
        return None
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database unavailable")


@router.get("/channels")
async def list_channels(request: Request) -> list[dict[str, object]]:
    _require_key(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        channels = session.query(ChannelConfig).order_by(ChannelConfig.created_at.desc()).all()
        break
    return [
        {
            "id": channel.id,
            "guild_id": channel.guild_id,
            "channel_id": channel.channel_id,
            "name": channel.name,
            "created_at": channel.created_at.isoformat() if channel.created_at else None,
        }
        for channel in channels
    ]


@router.get("/repositories")
async def list_repositories(request: Request) -> list[dict[str, object]]:
    _require_key(request)
    settings: Settings = request.app.state.settings
    for session in get_session(settings):
        repos = session.query(RepositoryConfig).order_by(RepositoryConfig.created_at.desc()).all()
        break
    return [
        {
            "id": repo.id,
            "guild_id": repo.guild_id,
            "full_name": repo.full_name,
            "created_at": repo.created_at.isoformat() if repo.created_at else None,
        }
        for repo in repos
    ]
