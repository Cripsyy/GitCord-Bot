import discord


def _truncate(value: str, limit: int = 1024) -> str:
    if len(value) <= limit:
        return value
    return value[: limit - 1] + "..."


def build_pull_request_embed(payload: dict, ai_summary: str | None = None) -> discord.Embed:
    action = payload.get("action", "updated")
    pr = payload.get("pull_request", {})
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})

    title = pr.get("title", "Untitled pull request")
    number = pr.get("number", "?")
    url = pr.get("html_url")
    repo_name = repo.get("full_name", "unknown/repo")
    user_login = sender.get("login", "unknown")
    body = pr.get("body") or "No description provided."

    embed = discord.Embed(
        title=f"PR #{number}: {title}",
        url=url,
        description=_truncate(body, 350),
        color=discord.Color.blurple(),
    )
    embed.add_field(name="Action", value=action, inline=True)
    embed.add_field(name="Repository", value=repo_name, inline=True)
    embed.add_field(name="Author", value=user_login, inline=True)

    head_ref = pr.get("head", {}).get("ref")
    base_ref = pr.get("base", {}).get("ref")
    if head_ref and base_ref:
        embed.add_field(name="Branch", value=f"{head_ref} -> {base_ref}", inline=False)

    if ai_summary:
        embed.add_field(name="AI Diff Summary", value=_truncate(ai_summary, 1024), inline=False)

    return embed


def build_issue_embed(payload: dict) -> discord.Embed:
    action = payload.get("action", "updated")
    issue = payload.get("issue", {})
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})

    title = issue.get("title", "Untitled issue")
    number = issue.get("number", "?")
    url = issue.get("html_url")
    repo_name = repo.get("full_name", "unknown/repo")
    user_login = sender.get("login", "unknown")
    body = issue.get("body") or "No description provided."

    embed = discord.Embed(
        title=f"Issue #{number}: {title}",
        url=url,
        description=_truncate(body, 350),
        color=discord.Color.dark_teal(),
    )
    embed.add_field(name="Action", value=action, inline=True)
    embed.add_field(name="Repository", value=repo_name, inline=True)
    embed.add_field(name="Author", value=user_login, inline=True)

    state = issue.get("state")
    if state:
        embed.add_field(name="State", value=state, inline=False)

    return embed

def build_push_embed(payload: dict) -> discord.Embed:
    ref = payload.get("ref", "unknown")
    repo = payload.get("repository", {})
    sender = payload.get("sender", {})
    commits = payload.get("commits", [])

    repo_name = repo.get("full_name", "unknown/repo")
    user_login = sender.get("login", "unknown")

    embed = discord.Embed(
        title=f"Push to {repo_name}",
        description=f"{user_login} pushed {len(commits)} commit(s) to {ref}.",
        color=discord.Color.green(),
    )
    embed.add_field(name="Repository", value=repo_name, inline=True)
    embed.add_field(name="Pusher", value=user_login, inline=True)

    if commits:
        commit_messages = "\n".join(f"- {commit.get('message', 'No message')}" for commit in commits)
        embed.add_field(name="Commits", value=_truncate(commit_messages, 1024), inline=False)

    return embed