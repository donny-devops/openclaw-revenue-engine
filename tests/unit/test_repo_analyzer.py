"""
tests/unit/test_repo_analyzer.py

Unit tests for services.readme_generator.repo_analyzer. No real network calls:
PyGithub is mocked at the module boundary via unittest.mock.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Make repo root importable when pytest is run from /home/user/openclaw-revenue-engine
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

pytest.importorskip("github", reason="PyGithub not installed")

from services.readme_generator import repo_analyzer  # noqa: E402
from services.readme_generator.repo_analyzer import RepoFacts, analyze_repo  # noqa: E402


def _fake_tree_entry(path: str, type_: str = "blob") -> MagicMock:
    entry = MagicMock()
    entry.path = path
    entry.type = type_
    return entry


def _fake_repo(
    *,
    full_name: str,
    description: str,
    language: str,
    languages: dict[str, int],
    topics: list[str],
    license_spdx: str | None,
    tree_paths: list[tuple[str, str]],
    files_present: dict[str, str],
) -> MagicMock:
    """
    Build a mock PyGithub Repo.

    files_present maps path -> decoded text content for any files we want
    get_contents to return successfully. Anything else raises GithubException.
    """
    from github import GithubException

    repo = MagicMock()
    repo.full_name = full_name
    repo.description = description
    repo.homepage = ""
    repo.default_branch = "main"
    repo.language = language
    repo.stargazers_count = 123
    repo.forks_count = 45
    repo.open_issues_count = 6

    if license_spdx:
        lic = MagicMock()
        lic.spdx_id = license_spdx
        lic.key = license_spdx.lower()
        repo.license = lic
    else:
        repo.license = None

    repo.get_languages.return_value = languages
    repo.get_topics.return_value = topics

    tree = MagicMock()
    tree.tree = [_fake_tree_entry(p, t) for p, t in tree_paths]
    repo.get_git_tree.return_value = tree

    def fake_get_contents(path: str):
        if path in files_present:
            contents = MagicMock()
            contents.decoded_content = files_present[path].encode("utf-8")
            return contents
        raise GithubException(status=404, data={"message": "Not Found"})

    repo.get_contents.side_effect = fake_get_contents
    return repo


@pytest.fixture(autouse=True)
def _clear_github_token(monkeypatch):
    # Ensure the module uses anonymous-mode path so the Token constructor is
    # never invoked with a real secret during tests.
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)


def test_analyze_node_repo():
    repo = _fake_repo(
        full_name="acme/node-app",
        description="A Node.js web app",
        language="TypeScript",
        languages={"TypeScript": 12000, "JavaScript": 3000},
        topics=["nodejs", "express"],
        license_spdx="MIT",
        tree_paths=[
            ("src", "tree"),
            ("src/index.ts", "blob"),
            ("tests", "tree"),
            ("tests/unit", "tree"),
            ("tests/unit/foo.test.ts", "blob"),
            (".github", "tree"),
            (".github/workflows", "tree"),
            (".github/workflows/ci.yml", "blob"),
            ("package.json", "blob"),
            ("README.md", "blob"),
        ],
        files_present={
            "package.json": '{"name": "acme-node-app", "version": "1.0.0"}',
            "README.md": "# acme-node-app\n\nAn existing readme.",
            "src/index.ts": "console.log('hi');",
        },
    )
    fake_client = MagicMock()
    fake_client.get_repo.return_value = repo

    with patch.object(repo_analyzer, "_get_client", return_value=fake_client):
        facts = analyze_repo("acme", "node-app")

    assert isinstance(facts, RepoFacts)
    assert facts.primary_language == "TypeScript"
    assert facts.license_spdx == "MIT"
    assert facts.manifest_filename == "package.json"
    assert "acme-node-app" in facts.manifest_snippet
    assert facts.entrypoint_filename == "src/index.ts"
    assert facts.has_ci is True
    assert facts.has_tests is True
    assert "TypeScript" in facts.tech_stack_labels
    assert "Node.js" in facts.tech_stack_labels
    assert "existing readme" in facts.existing_readme_excerpt.lower()


def test_analyze_python_repo_without_ci():
    repo = _fake_repo(
        full_name="alice/py-tool",
        description="A Python CLI",
        language="Python",
        languages={"Python": 5000},
        topics=["cli"],
        license_spdx="Apache-2.0",
        tree_paths=[
            ("main.py", "blob"),
            ("requirements.txt", "blob"),
            ("docs", "tree"),
        ],
        files_present={
            "requirements.txt": "requests>=2.0\nclick>=8.0\n",
            "main.py": "print('hi')",
        },
    )
    fake_client = MagicMock()
    fake_client.get_repo.return_value = repo

    with patch.object(repo_analyzer, "_get_client", return_value=fake_client):
        facts = analyze_repo("alice", "py-tool")

    assert facts.primary_language == "Python"
    assert facts.license_spdx == "Apache-2.0"
    assert facts.manifest_filename == "requirements.txt"
    assert "requests" in facts.manifest_snippet
    assert facts.entrypoint_filename == "main.py"
    assert facts.has_ci is False
    assert facts.has_tests is False
    assert facts.existing_readme_excerpt == ""


def test_analyze_rust_repo_prefers_cargo_toml():
    repo = _fake_repo(
        full_name="rusty/thing",
        description="A Rust crate",
        language="Rust",
        languages={"Rust": 8000},
        topics=[],
        license_spdx="MIT",
        tree_paths=[
            ("Cargo.toml", "blob"),
            ("src", "tree"),
            ("src/main.rs", "blob"),
        ],
        files_present={
            "Cargo.toml": "[package]\nname = \"thing\"\nversion = \"0.1.0\"\n",
            "src/main.rs": "fn main() {}",
        },
    )
    fake_client = MagicMock()
    fake_client.get_repo.return_value = repo

    with patch.object(repo_analyzer, "_get_client", return_value=fake_client):
        facts = analyze_repo("rusty", "thing")

    assert facts.manifest_filename == "Cargo.toml"
    assert "name = \"thing\"" in facts.manifest_snippet
    assert facts.entrypoint_filename == "src/main.rs"
    assert "Rust (Cargo)" in facts.tech_stack_labels
