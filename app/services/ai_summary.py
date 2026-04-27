import json
from urllib import error, request

from github import GithubException

from app.config import Settings
from app.services.github_client import create_github_client


def _truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return value[:limit]


def fetch_pull_request_diff(settings: Settings, repo_full_name: str, pull_request_number: int) -> str:
    github_client = create_github_client(settings)

    try:
        repo = github_client.get_repo(repo_full_name)
        pull_request = repo.get_pull(pull_request_number)
        files = list(pull_request.get_files())
    except GithubException as exc:
        message = getattr(exc, "data", {}).get("message") or str(exc)
        raise RuntimeError(f"Could not fetch PR diff: {message}") from exc

    chunks: list[str] = []
    for file in files:
        patch = file.patch or "(No textual patch available)"
        chunks.append(f"FILE: {file.filename}\nSTATUS: {file.status}\nPATCH:\n{patch}\n")

    return _truncate("\n".join(chunks), settings.ai_max_diff_chars)


def summarize_pull_request_diff(
    settings: Settings,
    *,
    pull_request_title: str,
    pull_request_body: str,
    diff_text: str,
) -> str | None:
    if not settings.ai_summary_enabled:
        return None
    if not settings.llm_api_key:
        return "AI summary skipped: LLM_API_KEY is not configured."
    if not diff_text.strip():
        return "No textual diff was available for summarization."

    prompt = (
        "You summarize pull request diffs for engineering teams. "
        "Return exactly 3 concise bullet points about intent, key code changes, and risks."
    )
    user_input = (
        f"PR title: {pull_request_title}\n"
        f"PR description: {pull_request_body or 'No description'}\n"
        f"Diff:\n{diff_text}"
    )

    payload = {
        "model": settings.llm_model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_input},
        ],
    }

    body = json.dumps(payload).encode("utf-8")
    api_url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"
    req = request.Request(
        api_url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.llm_api_key}",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=settings.llm_timeout_seconds) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        return f"AI summary unavailable: {exc}"

    content = (
        result.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )
    return content or "AI summary unavailable: empty model response."
