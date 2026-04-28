from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    delivery_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    repository: Mapped[str | None] = mapped_column(String(200), nullable=True)
    action: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sender: Mapped[str | None] = mapped_column(String(120), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
