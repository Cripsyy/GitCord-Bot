import logging
from collections.abc import Sequence

import discord
from discord.ext import commands

from app.bot.views import PullRequestActionsView
from app.config import Settings
from app.core.database import get_session
from app.models.channel import ChannelConfig
from app.models.guild import GuildConfig


class DiscordAssistantClient(commands.Bot):
    def __init__(self, *, intents: discord.Intents, settings: Settings):
        super().__init__(command_prefix="!", intents=intents)
        self.logger = logging.getLogger("discord_bot.client")
        self.settings = settings

    async def on_ready(self) -> None:
        if self.user is None:
            self.logger.warning("Discord client is ready without a user object.")
            return

        self.logger.info("Connected to Discord as %s (%s)", self.user, self.user.id)
        await self.sync_guild_channels()

    async def on_guild_join(self, guild: discord.Guild) -> None:
        for session in get_session(self.settings):
            existing = session.get(GuildConfig, str(guild.id))
            if existing is None:
                session.add(GuildConfig(id=str(guild.id), name=guild.name))
                session.commit()
            break
        await self.sync_guild_channels(guild)

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
