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
from app.models.webhook_subscription import WebhookSubscription
from app.services.ai_summary import fetch_pull_request_diff, summarize_pull_request_diff
from app.services.leaderboard import award_xp
from app.services.signature import is_valid_github_signature

router = APIRouter(prefix="/webhooks", tags=["github"])
logger = logging.getLogger("api.webhooks")


@router.post("/github/{secret_slug}", status_code=status.HTTP_202_ACCEPTED)
async def github_webhook_listener(request: Request, secret_slug: str) -> dict[str, str]:
    return await _handle_webhook(request, secret_slug)


@router.post("/github/{guild_id_legacy}/{secret_slug}", status_code=status.HTTP_202_ACCEPTED)
async def github_webhook_listener_legacy(request: Request, guild_id_legacy: str, secret_slug: str) -> dict[str, str]:
    return await _handle_webhook(request, secret_slug)


async def _handle_webhook(request: Request, secret_slug: str) -> dict[str, str]:
    payload_bytes = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    event_type = request.headers.get("X-GitHub-Event")

    settings: Settings = request.app.state.settings
    bot_client = request.app.state.bot_client

    for session in get_session(settings):
        config = (
            session.query(WebhookConfig)
            .filter(WebhookConfig.secret_slug == secret_slug)
            .first()
        )
        if config is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook configuration not found")

        if not is_valid_github_signature(
            payload=payload_bytes,
            provided_signature=signature,
            secret=config.webhook_secret,
        ):
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

        if config.repository_full_name != repository_name:
            logger.info("Webhook repo mismatch for slug %s", secret_slug)
            return {"message": "Webhook received (repository ignored)"}

        subscriptions = session.query(WebhookSubscription).filter(
            WebhookSubscription.webhook_config_id == config.id,
        ).all()

        if not subscriptions:
            logger.info("Webhook received for %s but no subscriptions configured", config.repository_full_name)
            return {"message": "Webhook received (no subscriptions)"}

        sub_dicts = [
            {
                "id": sub.id,
                "guild_id": sub.guild_id,
                "channel_id": sub.channel_id,
                "ai_summary_enabled": sub.ai_summary_enabled,
                "ai_max_diff_chars": sub.ai_max_diff_chars,
                "events": sub.events,
            }
            for sub in subscriptions
        ]
        config_dict = {
            "id": config.id,
            "repository_full_name": config.repository_full_name,
            "webhook_secret": config.webhook_secret,
        }
        break

    seen_guilds: set[str] = set()
    for sub in sub_dicts:
        if sub["guild_id"] not in seen_guilds:
            seen_guilds.add(sub["guild_id"])
            threading.Thread(
                target=_log_webhook_event,
                args=(settings,),
                kwargs={
                    "guild_id": sub["guild_id"],
                    "webhook_config_id": config_dict["id"],
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
            config=config_dict,
            subscriptions=sub_dicts,
            sender=sender,
            action=action,
        )
    )

    return {"message": f"Webhook received and queued ({event_type})"}


async def _process_webhook_event(
    *,
    settings: Settings,
    bot_client,
    event_type: str,
    payload: dict,
    config: dict,
    subscriptions: list[dict],
    sender: str | None,
    action: str | None,
) -> None:
    if sender and event_type:
        seen_guilds: set[str] = set()
        for sub in subscriptions:
            if sub["guild_id"] in seen_guilds:
                continue
            seen_guilds.add(sub["guild_id"])
            result = await asyncio.to_thread(
                award_xp,
                settings,
                guild_id=sub["guild_id"],
                github_user=sender,
                event_type=event_type,
                action=action,
            )
            for ma in result.milestone_actions:
                try:
                    if ma.action_type == "assign":
                        await bot_client.assign_milestone_role(
                            guild_id=ma.guild_id,
                            discord_user_id=ma.discord_user_id,
                            role_name=ma.role_name,
                            color=ma.color,
                            hoist=ma.hoist,
                        )
                    elif ma.action_type == "remove":
                        await bot_client.remove_milestone_role(
                            guild_id=ma.guild_id,
                            discord_user_id=ma.discord_user_id,
                            role_name=ma.role_name,
                        )
                except Exception:
                    logger.exception(
                        "Failed to %s milestone role '%s' for %s in guild %s",
                        ma.action_type, ma.role_name, ma.discord_user_id, ma.guild_id,
                    )

    if event_type == "pull_request":
        pull_request_action = payload.get("action")
        pull_request_number = payload.get("pull_request", {}).get("number")
        repo_full_name = payload.get("repository", {}).get("full_name")
        pull_request_title = payload.get("pull_request", {}).get("title", "Untitled pull request")
        pull_request_body = payload.get("pull_request", {}).get("body") or ""

        if not isinstance(pull_request_number, int) or not isinstance(repo_full_name, str):
            logger.warning("Missing pull request metadata in webhook payload")
            return

        any_ai = any(sub.get("ai_summary_enabled", True) for sub in subscriptions)
        diff_text: str | None = None
        if any_ai:
            try:
                max_chars = max(sub.get("ai_max_diff_chars", 12000) for sub in subscriptions)
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

        for sub in subscriptions:
            ai_summary: str | None = None
            if sub.get("ai_summary_enabled", True):
                try:
                    ai_summary = await asyncio.to_thread(
                        summarize_pull_request_diff,
                        settings,
                        pull_request_title=pull_request_title,
                        pull_request_body=pull_request_body,
                        diff_text=diff_text or "",
                        ai_summary_enabled=True,
                        ai_max_diff_chars=sub.get("ai_max_diff_chars", 12000),
                    )
                except Exception:
                    logger.exception("Failed to generate AI summary for PR #%s", pull_request_number)
                    ai_summary = "AI summary unavailable due to an internal error."

            embed = build_pull_request_embed(payload, ai_summary=ai_summary)
            try:
                await bot_client.send_pull_request_notification(
                    channel_id=sub["channel_id"],
                    embed=embed,
                    repo_full_name=repo_full_name,
                    pull_request_number=pull_request_number,
                    pull_request_action=pull_request_action,
                    guild_id=sub["guild_id"],
                )
            except Exception:
                logger.exception("Failed to send PR notification to channel %s", sub["channel_id"])
        return

    if event_type == "issues":
        embed = build_issue_embed(payload)
    elif event_type == "push":
        embed = build_push_embed(payload)
    else:
        logger.info("Webhook accepted for unsupported event type: %s", event_type)
        return

    for sub in subscriptions:
        try:
            await bot_client.send_embed_to_channel(sub["channel_id"], embed)
        except Exception:
            logger.exception("Failed to send webhook event to channel %s", sub["channel_id"])


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
