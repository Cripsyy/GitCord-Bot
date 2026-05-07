from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WebhookConfig(Base):
    __tablename__ = "webhook_configs"
    __table_args__ = (
        UniqueConstraint("guild_id", "secret_slug", name="uq_webhook_configs_guild_slug"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    guild_id: Mapped[str] = mapped_column(String(32), nullable=False)
    secret_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    webhook_secret: Mapped[str] = mapped_column(String(255), nullable=False)
    repository_full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel_id: Mapped[str] = mapped_column(String(32), nullable=False)
    ai_summary_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ai_max_diff_chars: Mapped[int] = mapped_column(BigInteger, nullable=False, default=12000)
    llm_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
