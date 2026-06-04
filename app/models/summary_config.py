from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SummaryConfig(Base):
    __tablename__ = "summary_configs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    guild_id: Mapped[str] = mapped_column(String(32), nullable=False)
    channel_id: Mapped[str] = mapped_column(String(32), nullable=False)
    send_time: Mapped[str] = mapped_column(String(5), nullable=False)
    include_prs: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    include_issues: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    include_standups: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
