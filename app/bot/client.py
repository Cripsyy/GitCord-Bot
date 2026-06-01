import logging
from collections.abc import Sequence
from datetime import UTC, datetime

import discord
from discord import app_commands
from discord.ext import commands

from app.bot.views import PullRequestActionsView
from app.config import Settings
from app.core.database import get_session
from app.models.channel import ChannelConfig
from app.models.guild import GuildConfig
from app.models.leaderboard_config import LeaderboardConfig
from app.models.leaderboard_entry import LeaderboardEntry
from app.models.standup_entry import StandupEntry


class DiscordAssistantClient(commands.Bot):
    def __init__(self, *, intents: discord.Intents, settings: Settings):
        super().__init__(command_prefix="!", intents=intents)
        self.logger = logging.getLogger("discord_bot.client")
        self.settings = settings

    async def setup_hook(self) -> None:
        self.tree.clear_commands(guild=None)
        for guild in self.guilds:
            self.tree.clear_commands(guild=guild)
        self.tree.add_command(standup_command)
        await self.tree.sync()
        self.logger.info("Slash commands synced (stale commands cleared)")

    async def on_ready(self) -> None:
        if self.user is None:
            self.logger.warning("Discord client is ready without a user object.")
            return

        self.logger.info("Connected to Discord as %s (%s)", self.user, self.user.id)
        await self._sync_guild_configs()
        await self.sync_guild_channels()

    async def on_guild_join(self, guild: discord.Guild) -> None:
        for session in get_session(self.settings):
            existing = session.get(GuildConfig, str(guild.id))
            if existing is None:
                session.add(GuildConfig(id=str(guild.id), name=guild.name))
                session.commit()
            break
        await self.sync_guild_channels(guild)

    async def _sync_guild_configs(self) -> None:
        for guild in self.guilds:
            for session in get_session(self.settings):
                existing = session.get(GuildConfig, str(guild.id))
                if existing is None:
                    session.add(GuildConfig(id=str(guild.id), name=guild.name))
                elif guild.name and existing.name != guild.name:
                    existing.name = guild.name
                session.commit()
                break

    async def sync_guild_channels(self, guild: discord.Guild | None = None) -> None:
        guilds = [guild] if guild else list(self.guilds)
        for current_guild in guilds:
            if current_guild is None:
                continue
            await self._sync_single_guild_channels(current_guild)

    async def _sync_single_guild_channels(self, guild: discord.Guild) -> None:
        for session in get_session(self.settings):
            existing_channels = (
                session.query(ChannelConfig)
                .filter(ChannelConfig.guild_id == str(guild.id))
                .all()
            )
            existing_by_id = {channel.channel_id: channel for channel in existing_channels}

            for channel in guild.text_channels:
                permissions = channel.permissions_for(guild.me) if guild.me else None
                if not permissions or not permissions.send_messages:
                    continue
                channel_id = str(channel.id)
                if channel_id in existing_by_id:
                    existing = existing_by_id.pop(channel_id)
                    if channel.name and existing.name != channel.name:
                        existing.name = channel.name
                    continue
                session.add(
                    ChannelConfig(
                        guild_id=str(guild.id),
                        channel_id=channel_id,
                        name=channel.name,
                    )
                )

            for stale in existing_by_id.values():
                session.delete(stale)

            session.commit()
            break

    async def assign_milestone_role(
        self,
        guild_id: str,
        discord_user_id: str,
        role_name: str,
        color: str = "",
        hoist: bool = True,
    ) -> bool:
        guild = self.get_guild(int(guild_id))
        if guild is None:
            self.logger.warning("Guild %s not found for milestone role assignment", guild_id)
            return False

        member = guild.get_member(int(discord_user_id))
        if member is None:
            self.logger.warning(
                "Member %s not found in guild %s for milestone role assignment",
                discord_user_id, guild_id,
            )
            return False

        colour = discord.Colour(int(color.lstrip("#"), 16)) if color else discord.Colour.default()

        role = discord.utils.get(guild.roles, name=role_name)
        if role is None:
            self.logger.warning(
                "Role '%s' not found in guild %s. Creating it.", role_name, guild_id,
            )
            try:
                role = await guild.create_role(
                    name=role_name,
                    colour=colour,
                    hoist=hoist,
                    reason="Leaderboard milestone",
                )
            except Exception:
                self.logger.exception("Failed to create role '%s' in guild %s", role_name, guild_id)
                return False
        else:
            try:
                if role.colour != colour or role.hoist != hoist:
                    await role.edit(colour=colour, hoist=hoist)
            except Exception:
                self.logger.exception("Failed to update role '%s' colour/hoist in guild %s", role_name, guild_id)

        try:
            await member.add_roles(role, reason=f"Leaderboard milestone level reached")
            self.logger.info(
                "Assigned milestone role '%s' to %s in guild %s",
                role_name, discord_user_id, guild_id,
            )

            for session in get_session(self.settings):
                config = (
                    session.query(LeaderboardConfig)
                    .filter(LeaderboardConfig.guild_id == guild_id)
                    .one_or_none()
                )
                if config is not None and config.role_milestones:
                    await self._fix_milestone_role_order(guild, config.role_milestones)
                break

            return True
        except Exception:
            self.logger.exception(
                "Failed to assign role '%s' to %s in guild %s",
                role_name, discord_user_id, guild_id,
            )
            return False

    async def remove_milestone_role(
        self,
        guild_id: str,
        discord_user_id: str,
        role_name: str,
    ) -> bool:
        guild = self.get_guild(int(guild_id))
        if guild is None:
            return False

        member = guild.get_member(int(discord_user_id))
        if member is None:
            return False

        role = discord.utils.get(guild.roles, name=role_name)
        if role is None:
            return False

        try:
            await member.remove_roles(role, reason="Leaderboard milestone surpassed")
            self.logger.info(
                "Removed previous milestone role '%s' from %s in guild %s",
                role_name, discord_user_id, guild_id,
            )
            return True
        except Exception:
            self.logger.exception(
                "Failed to remove role '%s' from %s in guild %s",
                role_name, discord_user_id, guild_id,
            )
            return False

    async def sync_milestone_roles(
        self, guild_id: str, role_milestones: list[dict], old_role_names: list[str] | None = None,
    ) -> None:
        guild = self.get_guild(int(guild_id))
        if guild is None:
            self.logger.warning("Guild %s not found for milestone role sync", guild_id)
            return

        old_names = set(old_role_names or [])
        old_names.discard("")
        new_names = {ms.get("role_name", "") for ms in role_milestones}
        new_names.discard("")

        created_or_updated: set[str] = set()

        for ms in role_milestones:
            role_name = ms.get("role_name", "")
            if not role_name:
                continue

            ms_color = ms.get("color", "")
            ms_hoist = ms.get("hoist", True)
            colour = discord.Colour(int(ms_color.lstrip("#"), 16)) if ms_color else discord.Colour.default()

            role = discord.utils.get(guild.roles, name=role_name)
            if role is not None:
                try:
                    if role.colour != colour or role.hoist != ms_hoist:
                        await role.edit(colour=colour, hoist=ms_hoist)
                        self.logger.info("Updated milestone role '%s' in guild %s", role_name, guild_id)
                except Exception:
                    self.logger.exception("Failed to update role '%s' in guild %s during sync", role_name, guild_id)
                created_or_updated.add(role_name)
                continue

            renamed_from = None
            for old_name in old_names - new_names:
                candidate = discord.utils.get(guild.roles, name=old_name)
                if candidate is not None and old_name not in created_or_updated:
                    renamed_from = candidate
                    break

            if renamed_from is not None:
                try:
                    old_name_value = renamed_from.name
                    await renamed_from.edit(name=role_name, colour=colour, hoist=ms_hoist)
                    self.logger.info(
                        "Renamed milestone role '%s' -> '%s' in guild %s",
                        old_name_value, role_name, guild_id,
                    )
                    created_or_updated.add(role_name)
                    created_or_updated.add(old_name_value)
                except Exception:
                    self.logger.exception("Failed to rename role to '%s' in guild %s", role_name, guild_id)
            else:
                try:
                    await guild.create_role(
                        name=role_name,
                        colour=colour,
                        hoist=ms_hoist,
                        reason="Leaderboard milestone sync",
                    )
                    self.logger.info("Created milestone role '%s' in guild %s", role_name, guild_id)
                    created_or_updated.add(role_name)
                except Exception:
                    self.logger.exception("Failed to create role '%s' in guild %s during sync", role_name, guild_id)

        for old_name in old_names - new_names:
            if old_name in created_or_updated:
                continue
            role = discord.utils.get(guild.roles, name=old_name)
            if role is not None:
                try:
                    await role.delete(reason="Milestone removed from leaderboard config")
                    self.logger.info("Deleted milestone role '%s' in guild %s", old_name, guild_id)
                except Exception:
                    self.logger.exception("Failed to delete role '%s' in guild %s", old_name, guild_id)

        await self._fix_milestone_role_order(guild, role_milestones)
        await self._sync_milestone_members(guild, guild_id, role_milestones)

    async def _fix_milestone_role_order(self, guild: discord.Guild, role_milestones: list[dict]) -> None:
        milestone_roles: list[tuple[int, int, discord.Role]] = []
        for ms in role_milestones:
            role_name = ms.get("role_name", "")
            if not role_name:
                continue
            role = discord.utils.get(guild.roles, name=role_name)
            if role is not None:
                milestone_roles.append((ms.get("level", 0), role.position, role))

        if len(milestone_roles) < 2:
            return

        by_level = sorted(milestone_roles, key=lambda x: x[0])
        ordered = True
        for i in range(1, len(by_level)):
            if by_level[i][1] <= by_level[i - 1][1]:
                ordered = False
                break
        if ordered:
            return

        by_level_desc = sorted(milestone_roles, key=lambda x: x[0], reverse=True)
        max_pos = max(r[1] for r in milestone_roles)
        anchor = max(max_pos, len(milestone_roles))

        positions: dict[discord.Role, int] = {}
        for i, (_level, _pos, role) in enumerate(by_level_desc):
            positions[role] = anchor - i

        try:
            await guild.edit_role_positions(positions)
            self.logger.info("Reordered milestone roles in guild %s", guild.id)
        except Exception:
            self.logger.exception("Failed to reorder milestone roles in guild %s", guild.id)

    async def _sync_milestone_members(
        self, guild: discord.Guild, guild_id: str, role_milestones: list[dict],
    ) -> None:
        milestone_names = {ms.get("role_name", "") for ms in role_milestones}
        milestone_names.discard("")
        if not milestone_names:
            return

        level_to_name: dict[int, str] = {}
        sorted_levels: list[int] = []
        for ms in role_milestones:
            name = ms.get("role_name", "")
            level = ms.get("level", 0)
            if name and level > 0:
                level_to_name[level] = name
                sorted_levels.append(level)
        sorted_levels.sort()

        role_objects: dict[str, discord.Role] = {}
        for name in milestone_names:
            role = discord.utils.get(guild.roles, name=name)
            if role is not None:
                role_objects[name] = role

        remove_previous = role_milestones[0].get("remove_previous", False) if role_milestones else False

        if remove_previous:
            for member in guild.members:
                member_milestones: list[tuple[int, discord.Role]] = []
                for role in member.roles:
                    if role.name in role_objects:
                        for ms_level, ms_name in level_to_name.items():
                            if ms_name == role.name:
                                member_milestones.append((ms_level, role))
                                break

                if len(member_milestones) < 2:
                    continue

                member_milestones.sort(key=lambda x: x[0], reverse=True)
                to_remove = [role for _level, role in member_milestones[1:]]
                try:
                    await member.remove_roles(*to_remove, reason="Leaderboard milestone cleanup")
                    self.logger.info(
                        "Cleaned up %d lower milestone roles from %s in guild %s",
                        len(to_remove), member.id, guild.id,
                    )
                except Exception:
                    self.logger.exception(
                        "Failed to clean up milestone roles for %s in guild %s", member.id, guild.id,
                    )
        else:
            entries: dict[str, int] = {}
            for session in get_session(self.settings):
                for entry in (
                    session.query(LeaderboardEntry)
                    .filter(LeaderboardEntry.guild_id == guild_id)
                    .all()
                ):
                    if entry.discord_user_id:
                        entries[entry.discord_user_id] = entry.level
                break

            if not entries:
                return

            for member in guild.members:
                user_level = entries.get(str(member.id))
                if user_level is None or user_level <= 0:
                    continue

                missing_roles: list[discord.Role] = []
                for ms_level in sorted_levels:
                    if ms_level <= user_level:
                        role_name = level_to_name.get(ms_level)
                        if role_name and role_name in role_objects:
                            role = role_objects[role_name]
                            if role not in member.roles:
                                missing_roles.append(role)

                if missing_roles:
                    try:
                        await member.add_roles(*missing_roles, reason="Leaderboard milestone sync")
                        self.logger.info(
                            "Added %d missing milestone roles to %s in guild %s",
                            len(missing_roles), member.id, guild.id,
                        )
                    except Exception:
                        self.logger.exception(
                            "Failed to add milestone roles to %s in guild %s", member.id, guild.id,
                        )

    async def on_disconnect(self) -> None:
        self.logger.warning("Discord client disconnected.")

    async def send_embed_to_channel(self, channel_id: str | int, embed: discord.Embed) -> None:
        channel_int = int(channel_id)
        channel = self.get_channel(channel_int)
        if channel is None:
            fetched = await self.fetch_channel(channel_int)
            if not isinstance(fetched, discord.abc.Messageable):
                raise TypeError(f"Channel {channel_int} is not messageable")
            await fetched.send(embed=embed)
            return

        if not isinstance(channel, discord.abc.Messageable):
            raise TypeError(f"Channel {channel_int} is not messageable")

        await channel.send(embed=embed)

    async def send_pull_request_notification(
        self,
        *,
        channel_id: str | int,
        embed: discord.Embed,
        repo_full_name: str,
        pull_request_number: int,
        pull_request_action: str | None,
        guild_id: str | None,
    ) -> None:
        view = None
        if pull_request_action != "closed":
            view = PullRequestActionsView(
                settings=self.settings,
                repo_full_name=repo_full_name,
                pull_request_number=pull_request_number,
                guild_id=guild_id,
            )

        channel_int = int(channel_id)
        channel = self.get_channel(channel_int)
        if channel is None:
            fetched = await self.fetch_channel(channel_int)
            if not isinstance(fetched, discord.abc.Messageable):
                raise TypeError(f"Channel {channel_int} is not messageable")
            if view is None:
                await fetched.send(embed=embed)
            else:
                await fetched.send(embed=embed, view=view)
            return

        if not isinstance(channel, discord.abc.Messageable):
            raise TypeError(f"Channel {channel_int} is not messageable")

        if view is None:
            await channel.send(embed=embed)
        else:
            await channel.send(embed=embed, view=view)


@app_commands.command(name="standup", description="Submit your daily standup")
async def standup_command(interaction: discord.Interaction, message: str) -> None:
    if interaction.guild is None:
        await interaction.response.send_message("This command can only be used in a server.", ephemeral=True)
        return
    if len(message) > 2000:
        await interaction.response.send_message("Standup message must be 2000 characters or fewer.", ephemeral=True)
        return

    settings: Settings = interaction.client.settings
    for session in get_session(settings):
        entry = StandupEntry(
            guild_id=str(interaction.guild.id),
            user_id=str(interaction.user.id),
            user_name=interaction.user.display_name,
            content=message,
        )
        session.add(entry)
        session.commit()
        break

    await interaction.response.send_message(
        "Your standup has been recorded!", ephemeral=True
    )
