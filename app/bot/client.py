import logging

import discord


class DiscordAssistantClient(discord.Client):
    def __init__(self, *, intents: discord.Intents):
        super().__init__(intents=intents)
        self.logger = logging.getLogger("discord_bot.client")

    async def on_ready(self) -> None:
        if self.user is None:
            self.logger.warning("Discord client is ready without a user object.")
            return

        self.logger.info("Connected to Discord as %s (%s)", self.user, self.user.id)

    async def on_disconnect(self) -> None:
        self.logger.warning("Discord client disconnected.")
