from sqlalchemy import BigInteger, Boolean, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"
    __table_args__ = (
        UniqueConstraint("webhook_config_id", "guild_id", "channel_id", name="uq_webhook_sub_config_guild_channel"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    webhook_config_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("webhook_configs.id"), nullable=False
    )
    guild_id: Mapped[str] = mapped_column(String(32), nullable=False)
    channel_id: Mapped[str] = mapped_column(String(32), nullable=False)
    ai_summary_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ai_max_diff_chars: Mapped[int] = mapped_column(BigInteger, nullable=False, default=12000)
    events: Mapped[list] = mapped_column(JSON, nullable=False, default=lambda: ["push", "pull_request", "issues"])

    config: Mapped["WebhookConfig"] = relationship("WebhookConfig", back_populates="subscriptions")
