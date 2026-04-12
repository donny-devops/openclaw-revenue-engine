"""
services/readme_generator/readme_builder.py

Calls MaxClaw (Anthropic Claude) with the system prompt in prompts.py and a
structured dump of RepoFacts, and returns the raw generated Markdown.

Mirrors the import pattern from test_api.py at the repo root so we stay
consistent with the rest of the codebase.
"""

from __future__ import annotations

import logging
import os

import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

from .prompts import SYSTEM_PROMPT, build_user_message
from .repo_analyzer import RepoFacts

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096


def _escape_fences(text: str) -> str:
    """Escape triple-backtick sequences and angle brackets in untrusted text.

    Prevents both Markdown fence breakouts and XML tag injection (e.g. a
    manifest containing ``</untrusted-data>`` could otherwise close the
    wrapper tag prematurely).
    """
    text = text.replace("```", "` ` `")
    text = text.replace("<", "&lt;").replace(">", "&gt;")
    return text


def _render_facts_markdown(facts: RepoFacts) -> str:
    """Render RepoFacts as a compact Markdown block for the user message."""
    lines: list[str] = []
    lines.append(f"- full_name: `{facts.full_name}`")
    lines.append(f"- description: {facts.description or '(none)'}")
    lines.append(f"- homepage: {facts.homepage or '(none)'}")
    lines.append(f"- default_branch: `{facts.default_branch}`")
    lines.append(f"- primary_language: {facts.primary_language or '(unknown)'}")
    lines.append(f"- license_spdx: {facts.license_spdx or '(unknown)'}")
    lines.append(f"- stars: {facts.stars} | forks: {facts.forks} | open_issues: {facts.open_issues}")
    lines.append(f"- has_ci: {facts.has_ci} | has_tests: {facts.has_tests}")
    lines.append(f"- topics: {', '.join(facts.topics) if facts.topics else '(none)'}")
    lines.append(f"- tech_stack_labels: {', '.join(facts.tech_stack_labels) or '(none)'}")

    if facts.languages:
        lines.append("- languages (bytes):")
        for lang, size in sorted(facts.languages.items(), key=lambda kv: -kv[1])[:6]:
            lines.append(f"    - {lang}: {size}")

    lines.append(f"- entrypoint_filename: {facts.entrypoint_filename or '(none detected)'}")
    lines.append(f"- manifest_filename: {facts.manifest_filename or '(none detected)'}")
    if facts.manifest_snippet:
        lines.append(f"- manifest_snippet ({facts.manifest_filename or ''}):")
        lines.append('<untrusted-data source="manifest">')
        lines.append(_escape_fences(facts.manifest_snippet))
        lines.append("</untrusted-data>")

    lines.append("- tree_depth2:")
    for path in facts.tree_depth2[:60]:
        lines.append(f"    {path}")
    if len(facts.tree_depth2) > 60:
        lines.append(f"    ... ({len(facts.tree_depth2) - 60} more omitted)")

    if facts.existing_readme_excerpt:
        lines.append("- existing_readme_excerpt (for style reference only, do not copy):")
        lines.append('<untrusted-data source="existing_readme">')
        lines.append(_escape_fences(facts.existing_readme_excerpt))
        lines.append("</untrusted-data>")

    return "\n".join(lines)


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=2, min=2, max=10),
    reraise=True,
)
def build_readme(facts: RepoFacts, *, client: anthropic.Anthropic | None = None) -> str:
    """
    Call MaxClaw and return the raw Markdown README body.

    The caller is responsible for publishing/persisting the result.
    """
    if client is None:
        client = anthropic.Anthropic()

    model = os.environ.get("README_GENERATOR_MODEL", DEFAULT_MODEL)
    facts_md = _render_facts_markdown(facts)
    user_message = build_user_message(facts_md)

    logger.info(
        "maxclaw: generating README for %s via model=%s (facts=%d chars)",
        facts.full_name,
        model,
        len(facts_md),
    )

    response = client.messages.create(
        model=model,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    # Concatenate any text blocks the model returned
    parts: list[str] = []
    for block in response.content:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    markdown = "\n".join(parts).strip()

    if not markdown:
        raise RuntimeError("MaxClaw returned no text content")
    if not markdown.lstrip().startswith("#"):
        logger.warning("MaxClaw output does not start with a heading; first 80 chars: %r", markdown[:80])

    return markdown
