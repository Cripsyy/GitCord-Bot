from functools import lru_cache

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    discord_bot_token: str
    github_token: str
    database_url: str
    llm_api_key: str | None = None
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: int = 20
    log_level: str = "INFO"
    dashboard_api_key: str | None = None
    discord_client_id: str | None = None
    discord_client_secret: str | None = None
    github_client_id: str | None = None
    github_client_secret: str | None = None
    oauth_redirect_base_url: str = "http://localhost:8000"

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
