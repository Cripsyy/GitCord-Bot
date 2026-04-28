import json
import logging
import threading

from fastapi import APIRouter, HTTPException, Request, status

from app.bot.embeds import build_issue_embed, build_pull_request_embed, build_push_embed
from app.config import Settings
from app.services.ai_summary import fetch_pull_request_diff, summarize_pull_request_diff
from app.services.webhook_logger import log_webhook_event
from app.services.signature import is_valid_github_signature

router = APIRouter(prefix="/webhooks", tags=["github"])
logger = logging.getLogger("api.webhooks")


@router.post("/github", status_code=status.HTTP_202_ACCEPTED)
async def github_webhook_listener(request: Request) -> dict[str, str]:
    payload_bytes = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    event_type = request.headers.get("X-GitHub-Event")

    settings: Settings = request.app.state.settings
    bot_client = request.app.state.bot_client

    if not is_valid_github_signature(
        payload=payload_bytes,
        provided_signature=signature,
        secret=settings.github_webhook_secret,
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

    threading.Thread(
        target=log_webhook_event,
        args=(
            settings,
        ),
        kwargs={
            "event_type": event_type,
            "delivery_id": delivery_id,
            "repository": repository_name,
            "action": action,
            "sender": sender,
            "payload": payload,
        },
        daemon=True,
    ).start()

    if settings.discord_notifications_channel_id is None:
        logger.info("Webhook accepted without Discord publish: DISCORD_NOTIFICATIONS_CHANNEL_ID unset")
        return {"message": "Webhook received (Discord channel not configured)"}

    if event_type == "pull_request":
        pull_request_action = payload.get("action")
        pull_request_number = payload.get("pull_request", {}).get("number")
        repo_full_name = payload.get("repository", {}).get("full_name")
        pull_request_title = payload.get("pull_request", {}).get("title", "Untitled pull request")
        pull_request_body = payload.get("pull_request", {}).get("body") or ""

        if not isinstance(pull_request_number, int) or not isinstance(repo_full_name, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing pull request metadata",
            )

        ai_summary: str | None = None
        try:
            diff_text = fetch_pull_request_diff(settings, repo_full_name, pull_request_number)
            ai_summary = summarize_pull_request_diff(
                settings,
                pull_request_title=pull_request_title,
                pull_request_body=pull_request_body,
                diff_text=diff_text,
            )
        except Exception:
            logger.exception("Failed to generate AI summary for PR #%s", pull_request_number)
            ai_summary = "AI summary unavailable due to an internal error."

        embed = build_pull_request_embed(payload, ai_summary=ai_summary)

        try:
            await bot_client.send_pull_request_notification(
                channel_id=settings.discord_notifications_channel_id,
                embed=embed,
                repo_full_name=repo_full_name,
                pull_request_number=pull_request_number,
                pull_request_action=pull_request_action,
            )
        except Exception:
            logger.exception("Failed to send PR notification with interactive controls")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not forward PR event to Discord",
            )

        return {"message": f"Webhook received and forwarded ({event_type})"}
    elif event_type == "issues":
        embed = build_issue_embed(payload)
    elif event_type == "push":
        embed = build_push_embed(payload)
    else:
        logger.info("Webhook accepted for unsupported event type: %s", event_type)
        return {"message": f"Webhook received (event {event_type} ignored)"}

    try:
        await bot_client.send_embed_to_channel(settings.discord_notifications_channel_id, embed)
    except Exception:
        logger.exception("Failed to send webhook event to Discord")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not forward event to Discord",
        )

    return {"message": f"Webhook received and forwarded ({event_type})"}
