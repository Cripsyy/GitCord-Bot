from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    guild_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("guilds.id"),
        nullable=False,
    )
    webhook_config_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("webhook_configs.id"),
        nullable=True,
    )
    config: Mapped["WebhookConfig"] = relationship("WebhookConfig", back_populates="events")
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
