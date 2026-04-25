import asyncio
import logging

import discord

from app.config import Settings
from app.services.pull_request_reviews import submit_pull_request_review


class PullRequestActionsView(discord.ui.View):
    def __init__(
        self,
        *,
        settings: Settings,
        repo_full_name: str,
        pull_request_number: int,
    ):
        super().__init__(timeout=None)
        self.settings = settings
        self.repo_full_name = repo_full_name
        self.pull_request_number = pull_request_number
        self.logger = logging.getLogger("discord_bot.pr_actions")

    async def _submit_review(self, interaction: discord.Interaction, decision: str) -> None:
        if interaction.user is None:
            await interaction.response.send_message(
                "Could not identify the reviewer.",
                ephemeral=True,
            )
            return

        reviewer = interaction.user.name

        await interaction.response.defer(ephemeral=True)

        try:
            pr_url = await asyncio.to_thread(
                submit_pull_request_review,
                self.settings,
                self.repo_full_name,
                self.pull_request_number,
                decision,
                reviewer,
            )
        except Exception as exc:
            self.logger.exception("PR review action failed")
            await interaction.followup.send(
                f"GitHub review action failed: {exc}",
                ephemeral=True,
            )
            return

        if interaction.message is not None:
            try:
                await interaction.message.edit(view=None)
            except Exception:
                self.logger.exception("Failed to remove PR action buttons after review")

        status_text = "approved" if decision == "approve" else "marked as changes requested"
        await interaction.followup.send(
            f"PR #{self.pull_request_number} {status_text}. {pr_url}",
            ephemeral=True,
        )

    @discord.ui.button(label="Approve PR", style=discord.ButtonStyle.success)
    async def approve_button(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        _ = button
        await self._submit_review(interaction, "approve")

    @discord.ui.button(label="Request Changes", style=discord.ButtonStyle.danger)
    async def reject_button(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        _ = button
        await self._submit_review(interaction, "request_changes")
