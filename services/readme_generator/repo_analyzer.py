"""
services/readme_generator/repo_analyzer.py

Fetches just enough structured facts about a public GitHub repo to give
MaxClaw a solid prompt. Uses PyGithub (authenticated via GITHUB_TOKEN) so
we benefit from the 5000/hr rate limit instead of the 60/hr anonymous limit.

What we collect:
  - name, description, default branch, primary language, topics
  - language breakdown (bytes per language)
  - license (spdx_id or key)
  - depth-2 folder tree (filenames only, no content) via non-recursive BFS
  - the first matching manifest among: package.json, requirements.txt,
    pyproject.toml, Cargo.toml, go.mod, Gemfile, composer.json
  - the first matching entry-point file among common candidates

We intentionally do NOT fetch file contents beyond manifest snippets and the
existing README (for "don't repeat what's already there" heuristics).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field

from github import Github, GithubException
from github.Auth import Token

logger = logging.getLogger(__name__)

# Manifest files to sniff (in priority order — first hit wins)
_MANIFEST_CANDIDATES = (
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "Cargo.toml",
    "go.mod",
    "Gemfile",
    "composer.json",
)

# Entry-point files to sniff (in priority order)
_ENTRYPOINT_CANDIDATES = (
    "src/index.ts",
    "src/index.js",
    "src/main.py",
    "main.py",
    "app.py",
    "src/main.rs",
    "cmd/main.go",
    "main.go",
    "index.js",
    "server.js",
)

MAX_TREE_ENTRIES = 80
MAX_MANIFEST_CHARS = 4000
MAX_EXISTING_README_CHARS = 2000


@dataclass
class RepoFacts:
    """All the structured facts we hand to MaxClaw as the generation prompt."""

    owner: str
    repo: str
    full_name: str
    description: str
    homepage: str
    default_branch: str
    primary_language: str
    languages: dict[str, int]
    topics: list[str]
    license_spdx: str
    stars: int
    forks: int
    open_issues: int
    tree_depth2: list[str]
    manifest_filename: str
    manifest_snippet: str
    entrypoint_filename: str
    existing_readme_excerpt: str
    has_ci: bool
    has_tests: bool
    extras: dict[str, str] = field(default_factory=dict)

    @property
    def tech_stack_labels(self) -> list[str]:
        """Short list of techs inferred from languages + manifest filename."""
        labels: list[str] = []
        if self.primary_language:
            labels.append(self.primary_language)
        for lang, _bytes in list(self.languages.items())[:5]:
            if lang != self.primary_language and lang not in labels:
                labels.append(lang)
        manifest_hints = {
            "package.json": "Node.js",
            "pyproject.toml": "Python (PEP 621)",
            "requirements.txt": "Python",
            "Cargo.toml": "Rust (Cargo)",
            "go.mod": "Go modules",
            "Gemfile": "Ruby (Bundler)",
            "composer.json": "PHP (Composer)",
        }
        hint = manifest_hints.get(self.manifest_filename)
        if hint and hint not in labels:
            labels.append(hint)
        return labels


def _get_client() -> Github:
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        return Github(auth=Token(token))
    # Fall back to anonymous — still works for public repos, just rate-limited.
    logger.warning("GITHUB_TOKEN not set; using anonymous GitHub API (60 req/hr)")
    return Github()


def _read_text_contents(repo, path: str, max_chars: int) -> str:
    try:
        contents = repo.get_contents(path)
    except GithubException:
        return ""
    if contents is None:
        return ""
    try:
        raw = contents.decoded_content.decode("utf-8", errors="replace")
    except (AttributeError, UnicodeDecodeError):
        return ""
    if len(raw) > max_chars:
        return raw[:max_chars] + f"\n... [truncated at {max_chars} chars]"
    return raw


def _collect_tree_depth2(repo, default_branch: str) -> list[str]:
    """Return up to MAX_TREE_ENTRIES paths, depth <= 2, using non-recursive BFS.

    Instead of fetching the entire recursive tree (which can be huge for
    monorepos and may be truncated at 100k entries), we fetch the root tree
    non-recursively and then selectively fetch one more level for each
    directory found at root.
    """
    try:
        root_tree = repo.get_git_tree(default_branch, recursive=False)
    except GithubException as e:
        logger.warning("get_git_tree failed for %s: %s", repo.full_name, e)
        return []

    paths: list[str] = []
    subtree_queue: list[tuple[str, str]] = []  # (parent_path, tree_sha)

    for entry in root_tree.tree:
        if entry.type == "tree":
            paths.append(entry.path + "/")
            subtree_queue.append((entry.path, entry.sha))
        else:
            paths.append(entry.path)

    # Fetch depth-1 subtrees (gives us depth-2 total)
    for parent_path, tree_sha in subtree_queue:
        if len(paths) >= MAX_TREE_ENTRIES:
            break
        try:
            subtree = repo.get_git_tree(tree_sha, recursive=False)
        except GithubException as e:
            logger.warning(
                "get_git_tree failed for %s at %s: %s",
                repo.full_name, parent_path, e,
            )
            continue
        for entry in subtree.tree:
            child_path = f"{parent_path}/{entry.path}"
            if entry.type == "tree":
                paths.append(child_path + "/")
            else:
                paths.append(child_path)
            if len(paths) >= MAX_TREE_ENTRIES:
                break

    paths.sort()
    return paths[:MAX_TREE_ENTRIES]


def _detect_first(tree_paths: set[str], candidates: tuple[str, ...]) -> str:
    """Find the first candidate present in the pre-fetched tree paths (zero API calls)."""
    for candidate in candidates:
        if candidate in tree_paths:
            return candidate
    return ""


def analyze_repo(owner: str, repo_name: str) -> RepoFacts:
    """Fetch and return RepoFacts for the given public GitHub repo."""
    client = _get_client()
    repo = client.get_repo(f"{owner}/{repo_name}")

    default_branch = repo.default_branch or "main"
    primary_language = repo.language or ""

    try:
        languages = repo.get_languages() or {}
    except GithubException:
        languages = {}

    try:
        topics = list(repo.get_topics() or [])
    except GithubException:
        topics = []

    license_spdx = ""
    if repo.license is not None:
        license_spdx = repo.license.spdx_id or repo.license.key or ""

    tree = _collect_tree_depth2(repo, default_branch)

    # Build a set of bare paths (strip trailing "/" from dirs) for O(1) lookup
    tree_set = {p.rstrip("/") for p in tree}

    # Detect manifest/entrypoint/README using the tree instead of extra API calls
    manifest_filename = _detect_first(tree_set, _MANIFEST_CANDIDATES)
    manifest_snippet = ""
    if manifest_filename:
        manifest_snippet = _read_text_contents(repo, manifest_filename, MAX_MANIFEST_CHARS)

    entrypoint_filename = _detect_first(tree_set, _ENTRYPOINT_CANDIDATES)

    existing_readme_excerpt = ""
    readme_candidates = ("README.md", "README.rst", "README.txt", "README")
    for candidate in readme_candidates:
        if candidate in tree_set:
            excerpt = _read_text_contents(repo, candidate, MAX_EXISTING_README_CHARS)
            if excerpt:
                existing_readme_excerpt = excerpt
                break

    has_ci = any(p.startswith(".github/workflows/") for p in tree)
    has_tests = any(
        p.startswith("tests/") or p.startswith("test/") or p.startswith("__tests__/")
        for p in tree
    )

    return RepoFacts(
        owner=owner,
        repo=repo_name,
        full_name=repo.full_name,
        description=repo.description or "",
        homepage=repo.homepage or "",
        default_branch=default_branch,
        primary_language=primary_language,
        languages=languages,
        topics=topics,
        license_spdx=license_spdx,
        stars=repo.stargazers_count,
        forks=repo.forks_count,
        open_issues=repo.open_issues_count,
        tree_depth2=tree,
        manifest_filename=manifest_filename,
        manifest_snippet=manifest_snippet,
        entrypoint_filename=entrypoint_filename,
        existing_readme_excerpt=existing_readme_excerpt,
        has_ci=has_ci,
        has_tests=has_tests,
    )
