from github import GithubException

from app.config import Settings
from app.services.github_client import create_github_client


def submit_pull_request_review(
    settings: Settings,
    repo_full_name: str,
    pull_request_number: int,
    decision: str,
    reviewer: str,
    guild_id: int | None,
) -> str:
    if guild_id is None:
        raise ValueError("Guild context is required for PR reviews.")

    review_event = "APPROVE" if decision == "approve" else "REQUEST_CHANGES"
    review_body = (
        f"{decision.replace('_', ' ').title()} from Discord reviewer @{reviewer}."
    )

    github_client = create_github_client(settings)

    try:
        repo = github_client.get_repo(repo_full_name)
        pull_request = repo.get_pull(pull_request_number)
        pull_request.create_review(event=review_event, body=review_body)
    except GithubException as exc:
        message = getattr(exc, "data", {}).get("message") or str(exc)
        raise RuntimeError(f"GitHub review request failed: {message}") from exc

    return pull_request.html_url
