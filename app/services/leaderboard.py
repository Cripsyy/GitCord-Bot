from app.core.database import get_session
from app.models.leaderboard_config import LeaderboardConfig
from app.models.leaderboard_entry import LeaderboardEntry
from app.models.oauth_token import OAuthToken
from app.config import Settings

DEFAULT_BASE_XP = 100
DEFAULT_START_INCREMENT = 20
DEFAULT_INCREMENT_STEP = 10


def _xp_for_level(level: int) -> int:
    if level == 0:
        return DEFAULT_BASE_XP
    extra = DEFAULT_START_INCREMENT * level + DEFAULT_INCREMENT_STEP * level * (level - 1) // 2
    return DEFAULT_BASE_XP + extra


def calculate_level_and_surplus(total_xp: int) -> tuple[int, int]:
    level = 0
    while True:
        needed = _xp_for_level(level)
        if total_xp < needed:
            surplus = total_xp
            return level, surplus
        total_xp -= needed
        level += 1


def _map_github_to_discord(settings: Settings, github_user: str) -> str | None:
    for session in get_session(settings):
        discord_tokens = (
            session.query(OAuthToken)
            .filter(OAuthToken.provider == "discord")
            .all()
        )
        github_tokens = {
            t.subject_id
            for t in session.query(OAuthToken)
            .filter(OAuthToken.provider == "github")
            .all()
        }
        break
    return None


def award_xp(
    settings: Settings,
    *,
    guild_id: str,
    github_user: str,
    event_type: str,
    action: str | None,
) -> None:
    for session in get_session(settings):
        config = (
            session.query(LeaderboardConfig)
            .filter(LeaderboardConfig.guild_id == guild_id)
            .one_or_none()
        )
        if config is None or not config.enabled:
            return

        event_key = f"{event_type}.{action}" if action else event_type
        xp_amount = config.xp_settings.get(event_key) or config.xp_settings.get(event_type)
        if not xp_amount:
            return

        entry = (
            session.query(LeaderboardEntry)
            .filter(
                LeaderboardEntry.guild_id == guild_id,
                LeaderboardEntry.github_user == github_user,
            )
            .one_or_none()
        )

        if entry is None:
            entry = LeaderboardEntry(
                guild_id=guild_id,
                github_user=github_user,
                xp=0,
                level=0,
            )
            session.add(entry)

        old_level = entry.level
        entry.xp += xp_amount

        new_level, _ = calculate_level_and_surplus(entry.xp)
        entry.level = new_level
        entry.user_name = github_user

        session.commit()
        return
