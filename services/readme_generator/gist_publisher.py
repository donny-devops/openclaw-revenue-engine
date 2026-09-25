"""
services/readme_generator/gist_publisher.py

Publishes a generated README to a PUBLIC GitHub Gist via PyGithub and returns
(html_url, raw_url). Requires GITHUB_TOKEN with `gist` scope.
"""

from __future__ import annotations

import logging
import os

from github import Github, GithubException
from github.Auth import Token
from github.InputFileContent import InputFileContent
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class GistPublishError(RuntimeError):
    """Raised when the Gist cannot be created."""


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=6),
    reraise=True,
)
def publish_gist(
    *,
    filename: str,
    content: str,
    description: str,
    public: bool = True,
) -> tuple[str, str]:
    """
    Create a public Gist and return (html_url, raw_url).

    The raw_url points at the filename so buyers can `curl` it directly.
    """
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise GistPublishError("GITHUB_TOKEN is not set; cannot publish Gist")

    client = Github(auth=Token(token))
    user = client.get_user()

    try:
        gist = user.create_gist(
            public=public,
            files={filename: InputFileContent(content=content)},
            description=description,
        )
    except GithubException as e:
        raise GistPublishError(f"create_gist failed: {e}") from e

    html_url = gist.html_url
    raw_url = ""
    gist_file = gist.files.get(filename) if gist.files else None
    if gist_file is not None:
        raw_url = gist_file.raw_url or ""

    logger.info("gist published: %s", html_url)
    return html_url, raw_url
