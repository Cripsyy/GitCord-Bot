import secrets
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.responses import RedirectResponse

from app.config import Settings
from app.services.oauth_clients import (
    build_discord_authorize_url,
    build_github_authorize_url,
    exchange_discord_code,
    exchange_github_code,
    fetch_discord_identity,
    fetch_github_identity,
)
from app.services.oauth_tokens import save_oauth_token

router = APIRouter(prefix="/api/oauth", tags=["oauth"])


def _base_url(request: Request, settings: Settings) -> str:
    if settings.oauth_redirect_base_url:
        return settings.oauth_redirect_base_url.rstrip("/")
    forwarded_host = request.headers.get("x-forwarded-host")
    forwarded_proto = request.headers.get("x-forwarded-proto")
    if forwarded_host:
        scheme = forwarded_proto or request.url.scheme
        return f"{scheme}://{forwarded_host}"
    return str(request.base_url).rstrip("/")


def _is_canonical_host(request: Request, settings: Settings) -> bool:
    if not settings.oauth_redirect_base_url:
        return True
    canonical = urlparse(settings.oauth_redirect_base_url).netloc
    if not canonical:
        return True
    return request.url.netloc == canonical


def _callback_url(request: Request, settings: Settings, provider: str) -> str:
    return f"{_base_url(request, settings)}/api/oauth/{provider}/callback"


def _set_oauth_cookies(response: RedirectResponse, *, state: str, provider: str, redirect_uri: str) -> None:
    response.set_cookie(f"{provider}_oauth_state", state, httponly=True, samesite="lax", path="/")
    response.set_cookie(
        f"{provider}_oauth_redirect",
        redirect_uri,
        httponly=True,
        samesite="lax",
        path="/",
    )


@router.get("/discord/login")
async def discord_login(request: Request) -> RedirectResponse:
    settings: Settings = request.app.state.settings
    if not settings.discord_client_id or not settings.discord_client_secret:
        raise HTTPException(status_code=500, detail="Discord OAuth is not configured")
    if not _is_canonical_host(request, settings):
        return RedirectResponse(
            url=f"{_base_url(request, settings)}/api/oauth/discord/login",
            status_code=302,
        )
    state = secrets.token_urlsafe(24)
    redirect_uri = _callback_url(request, settings, "discord")
    url = build_discord_authorize_url(settings, state, redirect_uri)
    response = RedirectResponse(url=url, status_code=302)
    _set_oauth_cookies(response, state=state, provider="discord", redirect_uri=redirect_uri)
    return response


@router.get("/discord/callback")
async def discord_callback(request: Request, code: str | None = None, state: str | None = None) -> RedirectResponse:
    settings: Settings = request.app.state.settings
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing OAuth parameters")
    cookie_state = request.cookies.get("discord_oauth_state")
    if (not cookie_state or cookie_state != state) and not _is_canonical_host(request, settings):
        return RedirectResponse(
            url=f"{_base_url(request, settings)}/api/oauth/discord/callback?code={code}&state={state}",
            status_code=302,
        )
    if not cookie_state or cookie_state != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    redirect_uri = request.cookies.get("discord_oauth_redirect") or _callback_url(request, settings, "discord")
    token_payload = await exchange_discord_code(settings, code, redirect_uri)
    access_token = token_payload.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Discord OAuth failed")
    identity = await fetch_discord_identity(access_token)
    subject_id = str(identity.get("id"))
    if not subject_id:
        raise HTTPException(status_code=400, detail="Discord identity missing")

    save_oauth_token(
        settings,
        provider="discord",
        subject_id=subject_id,
        access_token=access_token,
        refresh_token=token_payload.get("refresh_token"),
        scopes=token_payload.get("scope"),
        expires_in=token_payload.get("expires_in"),
    )
    response = RedirectResponse(url="/dashboard", status_code=302)
    response.set_cookie("discord_user_id", subject_id, httponly=True, samesite="lax", path="/")
    response.set_cookie("discord_oauth_state", "", max_age=0, path="/")
    response.set_cookie("discord_oauth_redirect", "", max_age=0, path="/")
    return response


@router.get("/github/login")
async def github_login(request: Request) -> RedirectResponse:
    settings: Settings = request.app.state.settings
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(status_code=500, detail="GitHub OAuth is not configured")
    if not _is_canonical_host(request, settings):
        return RedirectResponse(
            url=f"{_base_url(request, settings)}/api/oauth/github/login",
            status_code=302,
        )
    state = secrets.token_urlsafe(24)
    redirect_uri = _callback_url(request, settings, "github")
    url = build_github_authorize_url(settings, state, redirect_uri)
    response = RedirectResponse(url=url, status_code=302)
    _set_oauth_cookies(response, state=state, provider="github", redirect_uri=redirect_uri)
    return response


@router.get("/github/callback")
async def github_callback(request: Request, code: str | None = None, state: str | None = None) -> RedirectResponse:
    settings: Settings = request.app.state.settings
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing OAuth parameters")
    cookie_state = request.cookies.get("github_oauth_state")
    if (not cookie_state or cookie_state != state) and not _is_canonical_host(request, settings):
        return RedirectResponse(
            url=f"{_base_url(request, settings)}/api/oauth/github/callback?code={code}&state={state}",
            status_code=302,
        )
    if not cookie_state or cookie_state != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    redirect_uri = request.cookies.get("github_oauth_redirect") or _callback_url(request, settings, "github")
    token_payload = await exchange_github_code(settings, code, redirect_uri)
    access_token = token_payload.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="GitHub OAuth failed")
    identity = await fetch_github_identity(access_token)
    subject_id = str(identity.get("id"))
    if not subject_id:
        raise HTTPException(status_code=400, detail="GitHub identity missing")

    save_oauth_token(
        settings,
        provider="github",
        subject_id=subject_id,
        access_token=access_token,
        refresh_token=token_payload.get("refresh_token"),
        scopes=token_payload.get("scope"),
        expires_in=None,
    )
    response = RedirectResponse(url="/dashboard", status_code=302)
    response.set_cookie("github_user_id", subject_id, httponly=True, samesite="lax", path="/")
    response.set_cookie("github_oauth_state", "", max_age=0, path="/")
    response.set_cookie("github_oauth_redirect", "", max_age=0, path="/")
    return response


@router.post("/disconnect/discord")
async def disconnect_discord() -> JSONResponse:
    response = JSONResponse({"ok": True})
    response.set_cookie("discord_user_id", "", max_age=0, path="/")
    response.set_cookie("discord_oauth_state", "", max_age=0, path="/")
    response.set_cookie("discord_oauth_redirect", "", max_age=0, path="/")
    return response


@router.post("/disconnect/github")
async def disconnect_github() -> JSONResponse:
    response = JSONResponse({"ok": True})
    response.set_cookie("github_user_id", "", max_age=0, path="/")
    response.set_cookie("github_oauth_state", "", max_age=0, path="/")
    response.set_cookie("github_oauth_redirect", "", max_age=0, path="/")
    return response


@router.post("/reset")
async def reset_oauth_session() -> JSONResponse:
    response = JSONResponse({"ok": True})
    response.set_cookie("discord_user_id", "", max_age=0, path="/")
    response.set_cookie("github_user_id", "", max_age=0, path="/")
    response.set_cookie("discord_oauth_state", "", max_age=0, path="/")
    response.set_cookie("github_oauth_state", "", max_age=0, path="/")
    response.set_cookie("discord_oauth_redirect", "", max_age=0, path="/")
    response.set_cookie("github_oauth_redirect", "", max_age=0, path="/")
    return response
