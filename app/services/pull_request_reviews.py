from github import GithubException

from app.config import Settings
from app.services.github_client import create_github_client


def submit_pull_request_review(
    settings: Settings,
    repo_full_name: str,
    pull_request_number: int,
    decision: str,
    reviewer: str,
) -> str:
    expected_repo = f"{settings.github_repo_owner}/{settings.github_repo_name}"
    if repo_full_name != expected_repo:
        raise ValueError(f"Repository mismatch. Expected {expected_repo}, got {repo_full_name}")

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
