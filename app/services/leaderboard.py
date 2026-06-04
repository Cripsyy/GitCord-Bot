from dataclasses import dataclass, field

from app.core.database import get_session
from app.models.account_link import AccountLink
from app.models.leaderboard_config import LeaderboardConfig
from app.models.leaderboard_entry import LeaderboardEntry
from app.config import Settings


@dataclass
class MilestoneAction:
    guild_id: str
    discord_user_id: str
    role_name: str
    action_type: str = "assign"
    color: str = ""
    hoist: bool = True


@dataclass
class AwardXpResult:
    milestone_actions: list[MilestoneAction] = field(default_factory=list)


def _xp_for_level(level: int, base_xp: int, start_increment: int, increment_step: int) -> int:
    if level == 0:
        return base_xp
    extra = start_increment * level + increment_step * level * (level - 1) // 2
    return base_xp + extra


def calculate_level_and_surplus(
    total_xp: int,
    base_xp: int = 100,
    start_increment: int = 20,
    increment_step: int = 10,
) -> tuple[int, int]:
    level = 0
    while True:
        needed = _xp_for_level(level, base_xp, start_increment, increment_step)
        if total_xp < needed:
            return level, total_xp
        total_xp -= needed
        level += 1


def _map_github_to_discord(settings: Settings, github_login: str) -> str | None:
    for session in get_session(settings):
        link = (
            session.query(AccountLink)
            .filter(AccountLink.github_login == github_login)
            .one_or_none()
        )
        if link is not None:
            return link.discord_user_id
        break
    return None


def _get_crossed_milestones(
    role_milestones: list[dict],
    old_level: int,
    new_level: int,
) -> list[dict]:
    return [
        ms for ms in role_milestones
        if old_level < ms.get("level", 0) <= new_level
    ]


def _get_lower_milestone_roles(
    role_milestones: list[dict],
    below_level: int,
) -> list[str]:
    return [
        ms["role_name"]
        for ms in role_milestones
        if ms.get("level", 0) < below_level and ms.get("role_name")
    ]


def award_xp(
    settings: Settings,
    *,
    guild_id: str,
    github_user: str,
    event_type: str,
    action: str | None,
) -> AwardXpResult:
    result = AwardXpResult()

    for session in get_session(settings):
        config = (
            session.query(LeaderboardConfig)
            .filter(LeaderboardConfig.guild_id == guild_id)
            .one_or_none()
        )
        if config is None or not config.enabled:
            return result

        event_key = f"{event_type}.{action}" if action else event_type
        xp_amount = config.xp_settings.get(event_key) or config.xp_settings.get(event_type)
        if not xp_amount:
            return result

        entry = (
            session.query(LeaderboardEntry)
            .filter(
                LeaderboardEntry.guild_id == guild_id,
                LeaderboardEntry.github_user == github_user,
            )
            .one_or_none()
        )

        discord_user_id = _map_github_to_discord(settings, github_user)

        if entry is None:
            entry = LeaderboardEntry(
                guild_id=guild_id,
                github_user=github_user,
                discord_user_id=discord_user_id,
                xp=0,
                level=0,
            )
            session.add(entry)

        old_level = entry.level
        entry.xp += xp_amount

        new_level, _ = calculate_level_and_surplus(
            entry.xp,
            base_xp=config.base_xp,
            start_increment=config.start_increment,
            increment_step=config.increment_step,
        )
        entry.level = new_level
        entry.user_name = github_user

        if discord_user_id and entry.discord_user_id != discord_user_id:
            entry.discord_user_id = discord_user_id

        if old_level != new_level and config.role_milestones:
            discord_id = entry.discord_user_id or discord_user_id
            if discord_id:
                crossed = _get_crossed_milestones(
                    config.role_milestones, old_level, new_level
                )
                for ms in crossed:
                    ms_level = ms.get("level", 0)
                    ms_role_name = ms.get("role_name", "")
                    ms_remove_prev = ms.get("remove_previous", False)
                    ms_color = ms.get("color", "")
                    ms_hoist = ms.get("hoist", True)
                    if ms_role_name:
                        result.milestone_actions.append(
                            MilestoneAction(
                                guild_id=guild_id,
                                discord_user_id=discord_id,
                                role_name=ms_role_name,
                                action_type="assign",
                                color=ms_color,
                                hoist=ms_hoist,
                            )
                        )
                        if ms_remove_prev:
                            for lower_name in _get_lower_milestone_roles(
                                config.role_milestones, ms_level
                            ):
                                result.milestone_actions.append(
                                    MilestoneAction(
                                        guild_id=guild_id,
                                        discord_user_id=discord_id,
                                        role_name=lower_name,
                                        action_type="remove",
                                    )
                                )

        session.commit()
        return result

    return result
