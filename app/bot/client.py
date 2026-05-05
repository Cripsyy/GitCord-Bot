import logging
from collections.abc import Sequence

import discord
from discord import app_commands
from discord.ext import commands

from app.bot.views import PullRequestActionsView
from app.config import Settings
from app.core.database import get_session
from app.models.channel import ChannelConfig
from app.models.guild import GuildConfig
from app.models.repository import RepositoryConfig
from app.models.webhook_config import WebhookConfig


class DiscordAssistantClient(commands.Bot):
    def __init__(self, *, intents: discord.Intents, settings: Settings):
        super().__init__(command_prefix="!", intents=intents)
        self.logger = logging.getLogger("discord_bot.client")
        self.settings = settings

    async def setup_hook(self) -> None:
        await self.tree.sync()

    async def on_ready(self) -> None:
        if self.user is None:
            self.logger.warning("Discord client is ready without a user object.")
            return

        self.logger.info("Connected to Discord as %s (%s)", self.user, self.user.id)

    async def on_guild_join(self, guild: discord.Guild) -> None:
        for session in get_session(self.settings):
            existing = session.get(GuildConfig, guild.id)
            if existing is None:
                session.add(GuildConfig(id=guild.id, name=guild.name))
                session.commit()
            break

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
        guild_id: int | None,
    ) -> None:
        view = None
        if pull_request_action != "closed":
            view = PullRequestActionsView(
                settings=self.settings,
                repo_full_name=repo_full_name,
                pull_request_number=pull_request_number,
                guild_id=guild_id,
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


def _upsert_channel(session, guild_id: int, channel: discord.abc.GuildChannel) -> None:
    existing = (
        session.query(ChannelConfig)
        .filter(
            ChannelConfig.guild_id == guild_id,
            ChannelConfig.channel_id == channel.id,
        )
        .one_or_none()
    )
    if existing is None:
        session.add(
            ChannelConfig(
                guild_id=guild_id,
                channel_id=channel.id,
                name=getattr(channel, "name", None),
            )
        )
    else:
        channel_name = getattr(channel, "name", None)
        if channel_name and existing.name != channel_name:
            existing.name = channel_name


def _upsert_repository(session, guild_id: int, repo_full_name: str) -> None:
    existing = (
        session.query(RepositoryConfig)
        .filter(
            RepositoryConfig.guild_id == guild_id,
            RepositoryConfig.full_name == repo_full_name,
        )
        .one_or_none()
    )
    if existing is None:
        session.add(
            RepositoryConfig(
                guild_id=guild_id,
                full_name=repo_full_name,
            )
        )


def _require_guild(interaction: discord.Interaction) -> discord.Guild:
    if interaction.guild is None:
        raise app_commands.CheckFailure("This command must be used in a server.")
    return interaction.guild


def _require_manage_guild(interaction: discord.Interaction) -> bool:
    if interaction.guild is None:
        raise app_commands.CheckFailure("This command must be used in a server.")
    if interaction.user.id == interaction.guild.owner_id:
        return True
    if isinstance(interaction.user, discord.Member):
        if interaction.user.guild_permissions.manage_guild:
            return True
        raise app_commands.CheckFailure("You need Manage Server permission to use this configuration command.")
    permissions = interaction.permissions
    if permissions is not None and permissions.manage_guild:
        return True
    raise app_commands.CheckFailure("You need Manage Server permission to use this configuration command.")


async def _ensure_guild(bot: commands.Bot, guild: discord.Guild) -> GuildConfig:
    for session in get_session(bot.settings):
        existing = session.get(GuildConfig, guild.id)
        if existing is None:
            existing = GuildConfig(id=guild.id, name=guild.name)
            session.add(existing)
            session.commit()
        return existing
    raise app_commands.CheckFailure("Could not load guild configuration.")


@app_commands.command(name="setchannel", description="Set the default notification channel.")
@app_commands.check(_require_manage_guild)
async def set_channel(
    interaction: discord.Interaction, channel: discord.TextChannel | None = None
) -> None:
    guild = _require_guild(interaction)
    await _ensure_guild(interaction.client, guild)
    target = channel or interaction.channel
    if not isinstance(target, discord.TextChannel):
        await interaction.response.send_message("Please choose a text channel.", ephemeral=True)
        return
    for session in get_session(interaction.client.settings):
        _upsert_channel(session, guild.id, target)
        (
            session.query(WebhookConfig)
            .filter(WebhookConfig.guild_id == guild.id)
            .update({WebhookConfig.channel_id: target.id})
        )
        session.commit()
        break
    await interaction.response.send_message(
        f"Notification channel set to {target.mention}.", ephemeral=True
    )


@app_commands.command(name="setrepo", description="Map a repo to the current channel.")
@app_commands.check(_require_manage_guild)
async def set_repo(
    interaction: discord.Interaction, repo_full_name: str, secret_slug: str
) -> None:
    guild = _require_guild(interaction)
    await _ensure_guild(interaction.client, guild)
    if not isinstance(interaction.channel, discord.TextChannel):
        await interaction.response.send_message("Use this in a text channel.", ephemeral=True)
        return
    channel_id = interaction.channel.id
    for session in get_session(interaction.client.settings):
        _upsert_channel(session, guild.id, interaction.channel)
        _upsert_repository(session, guild.id, repo_full_name)
        webhook = (
            session.query(WebhookConfig)
            .filter(
                WebhookConfig.guild_id == guild.id,
                WebhookConfig.secret_slug == secret_slug,
            )
            .one_or_none()
        )
        if webhook is None:
            webhook = WebhookConfig(
                guild_id=guild.id,
                secret_slug=secret_slug,
                webhook_secret=secret_slug,
                repository_full_name=repo_full_name,
                channel_id=channel_id,
                ai_summary_enabled=True,
            )
            session.add(webhook)
        else:
            webhook.repository_full_name = repo_full_name
            webhook.channel_id = channel_id
        session.commit()
        break
    await interaction.response.send_message(
        "Repository mapping saved. "
        f"Webhook: /webhooks/github/{guild.id}/{secret_slug}\n"
        f"Set the secret with /setsecret {secret_slug} <your_secret>",
        ephemeral=True,
    )


@app_commands.command(name="setrepochannel", description="Change channel for a repo webhook.")
@app_commands.check(_require_manage_guild)
async def set_repo_channel(
    interaction: discord.Interaction, secret_slug: str, channel: discord.TextChannel
) -> None:
    guild = _require_guild(interaction)
    for session in get_session(interaction.client.settings):
        webhook = (
            session.query(WebhookConfig)
            .filter(
                WebhookConfig.guild_id == guild.id,
                WebhookConfig.secret_slug == secret_slug,
            )
            .one_or_none()
        )
        if webhook is None:
            await interaction.response.send_message(
                "Webhook config not found. Use /setrepo first.",
                ephemeral=True,
            )
            return
        _upsert_channel(session, guild.id, channel)
        webhook.channel_id = channel.id
        session.commit()
        break
    await interaction.response.send_message(
        f"Notification channel for {secret_slug} set to {channel.mention}.",
        ephemeral=True,
    )


@app_commands.command(name="setsecret", description="Set the webhook secret for a slug.")
@app_commands.check(_require_manage_guild)
async def set_secret(
    interaction: discord.Interaction, secret_slug: str, webhook_secret: str
) -> None:
    guild = _require_guild(interaction)
    for session in get_session(interaction.client.settings):
        webhook = (
            session.query(WebhookConfig)
            .filter(
                WebhookConfig.guild_id == guild.id,
                WebhookConfig.secret_slug == secret_slug,
            )
            .one_or_none()
        )
        if webhook is None:
            session.add(
                WebhookConfig(
                    guild_id=guild.id,
                    secret_slug=secret_slug,
                    webhook_secret=webhook_secret,
                    repository_full_name="unknown/repo",
                    channel_id=interaction.channel_id or 0,
                    ai_summary_enabled=True,
                )
            )
        else:
            webhook.webhook_secret = webhook_secret
        session.commit()
        break
    await interaction.response.send_message("Webhook secret saved.", ephemeral=True)


@app_commands.command(name="setai", description="Enable/disable AI summaries for a slug.")
@app_commands.check(_require_manage_guild)
async def set_ai(
    interaction: discord.Interaction,
    secret_slug: str,
    enabled: bool,
    llm_model: str | None = None,
) -> None:
    guild = _require_guild(interaction)
    for session in get_session(interaction.client.settings):
        webhook = (
            session.query(WebhookConfig)
            .filter(
                WebhookConfig.guild_id == guild.id,
                WebhookConfig.secret_slug == secret_slug,
            )
            .one_or_none()
        )
        if webhook is None:
            await interaction.response.send_message(
                "Webhook config not found. Use /setrepo first.",
                ephemeral=True,
            )
            return
        webhook.ai_summary_enabled = enabled
        if llm_model:
            webhook.llm_model = llm_model
        session.commit()
        break
    status = "enabled" if enabled else "disabled"
    await interaction.response.send_message(
        f"AI summaries {status} for {secret_slug}.", ephemeral=True
    )


@app_commands.command(name="showconfig", description="Show current webhook mappings.")
@app_commands.check(_require_manage_guild)
async def show_config(interaction: discord.Interaction) -> None:
    guild = _require_guild(interaction)
    for session in get_session(interaction.client.settings):
        webhooks: Sequence[WebhookConfig] = (
            session.query(WebhookConfig)
            .filter(WebhookConfig.guild_id == guild.id)
            .all()
        )
        break

    if not webhooks:
        await interaction.response.send_message(
            "No webhook configs found for this server.",
            ephemeral=True,
        )
        return

    lines = [
        f"{wh.secret_slug}: repo={wh.repository_full_name}, channel={wh.channel_id}, ai={wh.ai_summary_enabled}"
        for wh in webhooks
    ]
    await interaction.response.send_message(
        "Configured webhooks:\n" + "\n".join(lines),
        ephemeral=True,
    )


def setup_bot_commands(bot: commands.Bot) -> None:
    bot.tree.add_command(set_channel)
    bot.tree.add_command(set_repo)
    bot.tree.add_command(set_repo_channel)
    bot.tree.add_command(set_secret)
    bot.tree.add_command(set_ai)
    bot.tree.add_command(show_config)

    @bot.tree.error
    async def on_app_command_error(
        interaction: discord.Interaction,
        error: app_commands.AppCommandError,
    ) -> None:
        if isinstance(error, app_commands.CheckFailure):
            message = str(error) or "You do not have permission to use that command."
            if interaction.response.is_done():
                await interaction.followup.send(message, ephemeral=True)
            else:
                await interaction.response.send_message(message, ephemeral=True)
            return

        if interaction.response.is_done():
            await interaction.followup.send("Command failed. Check logs.", ephemeral=True)
        else:
            await interaction.response.send_message("Command failed. Check logs.", ephemeral=True)
