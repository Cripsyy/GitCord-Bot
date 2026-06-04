from __future__ import annotations

from typing import Any

import httpx


async def ensure_github_webhook(
    *,
    access_token: str,
    repo_full_name: str,
    webhook_url: str,
    webhook_secret: str,
    events: list[str],
    url_prefix: str | None = None,
) -> dict[str, object]:
    if "/" not in repo_full_name:
        raise ValueError("Invalid repo_full_name")
    owner, repo = repo_full_name.split("/", 1)
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        hooks: list[dict[str, Any]] = []
        list_url = f"https://api.github.com/repos/{owner}/{repo}/hooks"
        params = {"per_page": 100}
        response = await client.get(list_url, headers=headers, params=params)
        response.raise_for_status()
        hooks_payload = response.json()
        hooks = hooks_payload if isinstance(hooks_payload, list) else []

        match = None
        for hook in hooks:
            config = hook.get("config") or {}
            url = config.get("url")
            if not isinstance(url, str):
                continue
            if url == webhook_url:
                match = hook
                break
            if url_prefix and url.startswith(url_prefix):
                match = hook
                break

        payload = {
            "config": {
                "url": webhook_url,
                "content_type": "json",
                "secret": webhook_secret,
                "insecure_ssl": "0",
            },
            "events": events,
            "active": True,
        }

        if match is None:
            create_payload = {"name": "web", **payload}
            create_response = await client.post(list_url, headers=headers, json=create_payload)
            if create_response.status_code >= 400:
                detail = _extract_github_error(create_response)
                raise httpx.HTTPStatusError(detail, request=create_response.request, response=create_response)
            created = create_response.json()
            return {"action": "created", "hook_id": created.get("id")}

        hook_id = match.get("id")
        update_url = f"https://api.github.com/repos/{owner}/{repo}/hooks/{hook_id}"
        update_response = await client.patch(update_url, headers=headers, json=payload)
        if update_response.status_code >= 400:
            detail = _extract_github_error(update_response)
            raise httpx.HTTPStatusError(detail, request=update_response.request, response=update_response)
    return {"action": "updated", "hook_id": hook_id}


async def delete_github_webhook(
    *,
    access_token: str,
    repo_full_name: str,
    webhook_url: str,
    url_prefix: str | None = None,
) -> dict[str, object]:
    if "/" not in repo_full_name:
        raise ValueError("Invalid repo_full_name")
    owner, repo = repo_full_name.split("/", 1)
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        list_url = f"https://api.github.com/repos/{owner}/{repo}/hooks"
        params = {"per_page": 100}
        response = await client.get(list_url, headers=headers, params=params)
        response.raise_for_status()
        hooks_payload = response.json()
        hooks = hooks_payload if isinstance(hooks_payload, list) else []

        match = None
        for hook in hooks:
            config = hook.get("config") or {}
            url = config.get("url")
            if not isinstance(url, str):
                continue
            if url == webhook_url:
                match = hook
                break
            if url_prefix and url.startswith(url_prefix):
                match = hook
                break

        if match is None:
            return {"action": "not_found"}

        hook_id = match.get("id")
        delete_url = f"https://api.github.com/repos/{owner}/{repo}/hooks/{hook_id}"
        delete_response = await client.delete(delete_url, headers=headers)
        if delete_response.status_code >= 400:
            detail = _extract_github_error(delete_response)
            raise httpx.HTTPStatusError(detail, request=delete_response.request, response=delete_response)
        return {"action": "deleted", "hook_id": hook_id}


def _extract_github_error(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = None
    if isinstance(payload, dict):
        message = payload.get("message")
        errors = payload.get("errors")
        if message and errors:
            return f"GitHub API error: {message} ({errors})"
        if message:
            return f"GitHub API error: {message}"
    text = response.text
    if text:
        return f"GitHub API error: {text}"
    return f"GitHub API error: {response.status_code}"
