from app.config import Settings
from app.core.database import get_session
from app.models.webhook_event import WebhookEvent


def log_webhook_event(
    settings: Settings,
    *,
    event_type: str,
    delivery_id: str | None,
    repository: str | None,
    action: str | None,
    sender: str | None,
    payload: dict,
) -> None:
    for session in get_session(settings):
        event = WebhookEvent(
            event_type=event_type,
            delivery_id=delivery_id,
            repository=repository,
            action=action,
            sender=sender,
            payload=payload,
        )
        session.add(event)
        session.commit()
