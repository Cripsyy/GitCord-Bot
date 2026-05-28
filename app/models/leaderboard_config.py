from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class LeaderboardConfig(Base):
    __tablename__ = "leaderboard_configs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    guild_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    base_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    start_increment: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    increment_step: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    xp_settings: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {
            "push": 10,
            "pull_request.opened": 30,
            "pull_request.reviewed": 20,
            "pull_request.closed": 50,
            "issues.opened": 25,
        },
    )
    role_milestones: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: [
            {"level": 5, "role_name": "Level 5", "remove_previous": True},
            {"level": 10, "role_name": "Level 10", "remove_previous": True},
            {"level": 20, "role_name": "Level 20", "remove_previous": True},
        ],
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
