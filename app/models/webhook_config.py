from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class WebhookConfig(Base):
    __tablename__ = "webhook_configs"
    __table_args__ = (
        UniqueConstraint("secret_slug", name="uq_webhook_configs_secret_slug"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    secret_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    webhook_secret: Mapped[str] = mapped_column(String(255), nullable=False)
    repository_full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    subscriptions: Mapped[list["WebhookSubscription"]] = relationship(
        "WebhookSubscription",
        back_populates="config",
        cascade="all, delete-orphan",
    )
    events_rel: Mapped[list["WebhookEvent"]] = relationship(
        "WebhookEvent",
        back_populates="config",
        cascade="all, delete-orphan",
    )
