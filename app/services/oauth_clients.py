from typing import Any

import httpx

from app.config import Settings


def build_discord_authorize_url(settings: Settings, state: str, redirect_uri: str) -> str:
    params = {
        "client_id": settings.discord_client_id or "",
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "identify guilds",
        "state": state,
        "prompt": "consent",
    }
    return str(httpx.URL("https://discord.com/api/oauth2/authorize", params=params))


async def exchange_discord_code(settings: Settings, code: str, redirect_uri: str) -> dict[str, Any]:
    data = {
        "client_id": settings.discord_client_id or "",
        "client_secret": settings.discord_client_secret or "",
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post("https://discord.com/api/oauth2/token", data=data, headers=headers)
        response.raise_for_status()
        return response.json()


async def fetch_discord_identity(access_token: str) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get("https://discord.com/api/users/@me", headers=headers)
        response.raise_for_status()
        return response.json()


def build_github_authorize_url(settings: Settings, state: str, redirect_uri: str) -> str:
    params = {
        "client_id": settings.github_client_id or "",
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": "repo admin:repo_hook",
        "allow_signup": "true",
    }
    return str(httpx.URL("https://github.com/login/oauth/authorize", params=params))


async def exchange_github_code(settings: Settings, code: str, redirect_uri: str) -> dict[str, Any]:
    data = {
        "client_id": settings.github_client_id or "",
        "client_secret": settings.github_client_secret or "",
        "code": code,
        "redirect_uri": redirect_uri,
    }
    headers = {"Accept": "application/json"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post("https://github.com/login/oauth/access_token", data=data, headers=headers)
        response.raise_for_status()
        return response.json()


async def fetch_github_identity(access_token: str) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get("https://api.github.com/user", headers=headers)
        response.raise_for_status()
        return response.json()


async def fetch_github_repos(access_token: str) -> list[dict[str, Any]]:
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
    repos: list[dict[str, Any]] = []
    url = "https://api.github.com/user/repos?per_page=100&sort=updated"
    async with httpx.AsyncClient(timeout=10) as client:
        while url:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            repos.extend(response.json())
            link_header = response.headers.get("Link")
            next_url = None
            if link_header:
                for segment in link_header.split(","):
                    if 'rel="next"' in segment:
                        next_url = segment.split(";")[0].strip().strip("<>")
                        break
            url = next_url
    return repos
