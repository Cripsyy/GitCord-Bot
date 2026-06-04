from datetime import datetime, timedelta, timezone

from app.config import Settings
from app.core.database import get_session
from app.models.oauth_token import OAuthToken


def save_oauth_token(
    settings: Settings,
    *,
    provider: str,
    subject_id: str,
    access_token: str,
    refresh_token: str | None,
    scopes: str | None,
    expires_in: int | None,
) -> OAuthToken:
    expires_at = None
    if expires_in:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    for session in get_session(settings):
        existing = (
            session.query(OAuthToken)
            .filter(
                OAuthToken.provider == provider,
                OAuthToken.subject_id == subject_id,
            )
            .one_or_none()
        )
        if existing is None:
            token = OAuthToken(
                provider=provider,
                subject_id=subject_id,
                access_token=access_token,
                refresh_token=refresh_token,
                scopes=scopes,
                expires_at=expires_at,
            )
            session.add(token)
        else:
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.scopes = scopes
            existing.expires_at = expires_at
            token = existing
        session.commit()
        session.refresh(token)
        return token
    raise RuntimeError("Database unavailable")


def get_oauth_token(
    settings: Settings,
    *,
    provider: str,
    subject_id: str,
) -> OAuthToken | None:
    for session in get_session(settings):
        token = (
            session.query(OAuthToken)
            .filter(
                OAuthToken.provider == provider,
                OAuthToken.subject_id == subject_id,
            )
            .one_or_none()
        )
        return token
    return None


def get_valid_oauth_token(
    settings: Settings,
    *,
    provider: str,
    subject_id: str,
) -> OAuthToken | None:
    token = get_oauth_token(settings, provider=provider, subject_id=subject_id)
    if token is None:
        return None
    if token.is_expired:
        return None
    return token


def is_token_expired(
    settings: Settings,
    *,
    provider: str,
    subject_id: str,
) -> bool:
    token = get_oauth_token(settings, provider=provider, subject_id=subject_id)
    if token is None:
        return False
    return token.is_expired
