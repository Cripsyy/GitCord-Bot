import asyncio
import json
import logging
import threading

from fastapi import APIRouter, HTTPException, Request, status

from app.bot.embeds import build_issue_embed, build_pull_request_embed, build_push_embed
from app.config import Settings
from app.core.database import get_session
from app.models.webhook_config import WebhookConfig
from app.models.webhook_event import WebhookEvent
from app.services.ai_summary import fetch_pull_request_diff, summarize_pull_request_diff
from app.services.leaderboard import award_xp
from app.services.signature import is_valid_github_signature

router = APIRouter(prefix="/webhooks", tags=["github"])
logger = logging.getLogger("api.webhooks")


@router.post("/github/{guild_id}/{secret_slug}", status_code=status.HTTP_202_ACCEPTED)
async def github_webhook_listener(request: Request, guild_id: str, secret_slug: str) -> dict[str, str]:
    payload_bytes = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    event_type = request.headers.get("X-GitHub-Event")

    settings: Settings = request.app.state.settings
    bot_client = request.app.state.bot_client

    webhook_configs: list[WebhookConfig] = []
    for session in get_session(settings):
        webhook_configs = (
            session.query(WebhookConfig)
            .filter(
                WebhookConfig.secret_slug == secret_slug,
                WebhookConfig.repository_full_name.isnot(None),
            )
            .all()
        )
        break

    if not webhook_configs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook configuration not found")

    matching_configs = [
        config
        for config in webhook_configs
        if is_valid_github_signature(
            payload=payload_bytes,
            provided_signature=signature,
            secret=config.webhook_secret,
        )
    ]

    if not matching_configs:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    if not event_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-GitHub-Event header",
        )

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload") from exc

    delivery_id = request.headers.get("X-GitHub-Delivery")
    repository_name = payload.get("repository", {}).get("full_name")
    action = payload.get("action")
    sender = payload.get("sender", {}).get("login")

    matching_configs = [
        config for config in matching_configs if config.repository_full_name == repository_name
    ]
    if not matching_configs:
        logger.info("Webhook repo mismatch for slug %s", secret_slug)
        return {"message": "Webhook received (repository ignored)"}
    for config in matching_configs:
        threading.Thread(
            target=_log_webhook_event,
            args=(
                settings,
            ),
            kwargs={
                "guild_id": config.guild_id,
                "webhook_config_id": config.id,
                "event_type": event_type,
                "delivery_id": delivery_id,
                "repository": repository_name,
                "action": action,
                "sender": sender,
                "payload": payload,
            },
            daemon=True,
        ).start()

    asyncio.create_task(
        _process_webhook_event(
            settings=settings,
            bot_client=bot_client,
            event_type=event_type,
            payload=payload,
            matching_configs=matching_configs,
        )
    )

    return {"message": f"Webhook received and queued ({event_type})"}


async def _process_webhook_event(
    *,
    settings: Settings,
    bot_client,
    event_type: str,
    payload: dict,
    matching_configs: list[WebhookConfig],
) -> None:
    if event_type == "pull_request":
        pull_request_action = payload.get("action")
        pull_request_number = payload.get("pull_request", {}).get("number")
        repo_full_name = payload.get("repository", {}).get("full_name")
        pull_request_title = payload.get("pull_request", {}).get("title", "Untitled pull request")
        pull_request_body = payload.get("pull_request", {}).get("body") or ""

        if not isinstance(pull_request_number, int) or not isinstance(repo_full_name, str):
            logger.warning("Missing pull request metadata in webhook payload")
            return

        needs_ai = any(config.ai_summary_enabled for config in matching_configs)
        diff_text: str | None = None
        if needs_ai:
            try:
                max_chars = max(config.ai_max_diff_chars for config in matching_configs)
                diff_text = await asyncio.to_thread(
                    fetch_pull_request_diff,
                    settings,
                    repo_full_name,
                    pull_request_number,
                    ai_max_diff_chars=max_chars,
                )
            except Exception:
                logger.exception("Failed to fetch PR diff for #%s", pull_request_number)
                diff_text = None

        for config in matching_configs:
            ai_summary: str | None = None
            if config.ai_summary_enabled:
                try:
                    ai_summary = await asyncio.to_thread(
                        summarize_pull_request_diff,
                        settings,
                        pull_request_title=pull_request_title,
                        pull_request_body=pull_request_body,
                        diff_text=diff_text or "",
                        ai_summary_enabled=config.ai_summary_enabled,
                        ai_max_diff_chars=config.ai_max_diff_chars,
                    )
                except Exception:
                    logger.exception("Failed to generate AI summary for PR #%s", pull_request_number)
                    ai_summary = "AI summary unavailable due to an internal error."

            embed = build_pull_request_embed(payload, ai_summary=ai_summary)
            try:
                await bot_client.send_pull_request_notification(
                    channel_id=config.channel_id,
                    embed=embed,
                    repo_full_name=repo_full_name,
                    pull_request_number=pull_request_number,
                    pull_request_action=pull_request_action,
                    guild_id=config.guild_id,
                )
            except Exception:
                logger.exception("Failed to send PR notification for guild %s", config.guild_id)
        return

    if event_type == "issues":
        embed = build_issue_embed(payload)
    elif event_type == "push":
        embed = build_push_embed(payload)
    else:
        logger.info("Webhook accepted for unsupported event type: %s", event_type)
        return

    for config in matching_configs:
        try:
            await bot_client.send_embed_to_channel(config.channel_id, embed)
        except Exception:
            logger.exception("Failed to send webhook event for guild %s", config.guild_id)


def _log_webhook_event(
    settings: Settings,
    *,
    guild_id: str,
    webhook_config_id: int | None,
    event_type: str,
    delivery_id: str | None,
    repository: str | None,
    action: str | None,
    sender: str | None,
    payload: dict,
) -> None:
    for session in get_session(settings):
        event = WebhookEvent(
            guild_id=guild_id,
            webhook_config_id=webhook_config_id,
            event_type=event_type,
            delivery_id=delivery_id,
            repository=repository,
            action=action,
            sender=sender,
            payload=payload,
        )
        session.add(event)
        session.commit()
        break

    if sender and event_type:
        award_xp(
            settings,
            guild_id=guild_id,
            github_user=sender,
            event_type=event_type,
            action=action,
        )
