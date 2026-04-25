from github import Github

from app.config import Settings


def create_github_client(settings: Settings) -> Github:
    return Github(settings.github_token)
