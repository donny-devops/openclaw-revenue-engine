"""
services.readme_generator

MaxClaw-backed README generator. Given a GitHub repo URL, fetches repo facts
via the GitHub API, asks Claude to generate a portfolio-quality README.md,
and returns the markdown plus a public Gist URL.

Public entry point: `generate(repo_url) -> GeneratedReadme`.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from .gist_publisher import publish_gist
from .readme_builder import build_readme
from .repo_analyzer import RepoFacts, analyze_repo

logger = logging.getLogger(__name__)

# Only accept canonical GitHub URLs. No gitlab/bitbucket/self-hosted, no SSH.
_GITHUB_URL_RE = re.compile(
    r"^https?://github\.com/(?P<owner>[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/(?P<repo>[A-Za-z0-9._-]{1,100})/?$"
)


class InvalidRepoURLError(ValueError):
    """Raised when the provided input is not a valid public GitHub repo URL."""


@dataclass
class GeneratedReadme:
    repo_url: str
    owner: str
    repo: str
    markdown: str
    gist_url: str
    gist_raw_url: str
    facts: RepoFacts


def parse_repo_url(repo_url: str) -> tuple[str, str]:
    """Parse a GitHub repo URL into (owner, repo). Raises InvalidRepoURLError."""
    if not repo_url:
        raise InvalidRepoURLError("repo_url is empty")
    cleaned = repo_url.strip().rstrip("/")
    # Strip trailing .git if present
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]
    match = _GITHUB_URL_RE.match(cleaned)
    if not match:
        raise InvalidRepoURLError(
            f"Not a canonical https://github.com/<owner>/<repo> URL: {repo_url!r}"
        )
    return match.group("owner"), match.group("repo")


def generate(repo_url: str, *, publish: bool = True) -> GeneratedReadme:
    """
    End-to-end: parse URL -> fetch facts -> call MaxClaw -> publish Gist.

    Set publish=False in dry-run mode to skip the Gist upload (returns empty
    gist URLs). All other steps still run.
    """
    owner, repo = parse_repo_url(repo_url)
    logger.info("readme_generator: analyzing %s/%s", owner, repo)
    facts = analyze_repo(owner, repo)

    logger.info("readme_generator: calling MaxClaw for %s/%s", owner, repo)
    markdown = build_readme(facts)

    gist_url = ""
    gist_raw_url = ""
    if publish:
        logger.info("readme_generator: publishing Gist for %s/%s", owner, repo)
        gist_url, gist_raw_url = publish_gist(
            filename="README.md",
            content=markdown,
            description=f"Auto-generated README for {owner}/{repo} (openclaw-revenue-engine)",
        )

    return GeneratedReadme(
        repo_url=f"https://github.com/{owner}/{repo}",
        owner=owner,
        repo=repo,
        markdown=markdown,
        gist_url=gist_url,
        gist_raw_url=gist_raw_url,
        facts=facts,
    )


__all__ = [
    "GeneratedReadme",
    "InvalidRepoURLError",
    "RepoFacts",
    "generate",
    "parse_repo_url",
]
