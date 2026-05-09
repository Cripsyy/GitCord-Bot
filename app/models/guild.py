from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GuildConfig(Base):
    __tablename__ = "guilds"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, autoincrement=False)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ai_summary_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ai_max_diff_chars: Mapped[int] = mapped_column(BigInteger, nullable=False, default=12000)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
