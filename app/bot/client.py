import logging

import discord

from app.bot.views import PullRequestActionsView
from app.config import Settings


class DiscordAssistantClient(discord.Client):
    def __init__(self, *, intents: discord.Intents, settings: Settings):
        super().__init__(intents=intents)
        self.logger = logging.getLogger("discord_bot.client")
        self.settings = settings

    async def on_ready(self) -> None:
        if self.user is None:
            self.logger.warning("Discord client is ready without a user object.")
            return

        self.logger.info("Connected to Discord as %s (%s)", self.user, self.user.id)

    async def on_disconnect(self) -> None:
        self.logger.warning("Discord client disconnected.")

    async def send_embed_to_channel(self, channel_id: int, embed: discord.Embed) -> None:
        channel = self.get_channel(channel_id)
        if channel is None:
            fetched = await self.fetch_channel(channel_id)
            if not isinstance(fetched, discord.abc.Messageable):
                raise TypeError(f"Channel {channel_id} is not messageable")
            await fetched.send(embed=embed)
            return

        if not isinstance(channel, discord.abc.Messageable):
            raise TypeError(f"Channel {channel_id} is not messageable")

        await channel.send(embed=embed)

    async def send_pull_request_notification(
        self,
        *,
        channel_id: int,
        embed: discord.Embed,
        repo_full_name: str,
        pull_request_number: int,
        pull_request_action: str | None,
    ) -> None:
        view = None
        if pull_request_action != "closed":
            view = PullRequestActionsView(
                settings=self.settings,
                repo_full_name=repo_full_name,
                pull_request_number=pull_request_number,
            )

        channel = self.get_channel(channel_id)
        if channel is None:
            fetched = await self.fetch_channel(channel_id)
            if not isinstance(fetched, discord.abc.Messageable):
                raise TypeError(f"Channel {channel_id} is not messageable")
            if view is None:
                await fetched.send(embed=embed)
            else:
                await fetched.send(embed=embed, view=view)
            return

        if not isinstance(channel, discord.abc.Messageable):
            raise TypeError(f"Channel {channel_id} is not messageable")

        if view is None:
            await channel.send(embed=embed)
        else:
            await channel.send(embed=embed, view=view)
