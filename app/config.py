from functools import lru_cache

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    discord_bot_token: str
    discord_guild_id: int | None = None
    discord_notifications_channel_id: int | None = None
    github_webhook_secret: str
    github_repo_owner: str
    github_repo_name: str
    github_token: str
    ai_summary_enabled: bool = True
    llm_api_key: str | None = None
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: int = 20
    ai_max_diff_chars: int = 12000
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        details = "; ".join(
            f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in exc.errors()
        )
        raise RuntimeError(f"Invalid configuration. {details}") from exc
