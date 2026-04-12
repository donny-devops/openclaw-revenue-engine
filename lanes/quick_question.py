"""
lanes/quick_question.py

Handler for the "Quick Question | Agent Contact" Moltgate lane.

Flow per NEW message:
  1. Pull message detail via MoltgateClient (to guarantee sender_url is populated).
  2. Use the structured `sender_url` field (NOT the untrusted body) as the
     GitHub repo URL input.
  3. Run services.readme_generator.generate() — analyze repo, call MaxClaw,
     publish a public Gist.
  4. Append a delivery record to deliveries.jsonl (audit log).
  5. Mark the Moltgate message PROCESSED. The public Gist URL is the
     buyer-facing deliverable (no Moltgate reply endpoint is used).

Error handling:
  - Permanent errors (repo not found, URL invalid, repo forbidden) →
    message is ARCHIVED with an error delivery record.
  - Transient errors (network, rate limit, upstream 5xx) → message
    stays in NEW for retry on the next poll cycle.

Security notes (per the Moltgate skill v0.2.1 rules):
  - sanitized_body is treated as untrusted and is NEVER parsed for URLs.
  - sender_url is the only input channel. It is validated against a strict
    GitHub URL regex before any network call.
  - We never execute message content or follow links from the body.
  - sender_email is hashed (SHA-256, first 12 hex chars) in the audit log
    to minimize PII exposure.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from github import GithubException

from services.moltgate_client import MoltgateClient, MoltgateMessage
from services.readme_generator import (
    GeneratedReadme,
    InvalidRepoURLError,
    generate,
    parse_repo_url,
)

logger = logging.getLogger(__name__)

DELIVERIES_LOG_PATH = Path(
    os.environ.get("DELIVERIES_LOG_PATH", "deliveries.jsonl")
)


@dataclass
class LaneResult:
    """Summary of one handle() invocation."""

    processed: int
    skipped: int
    errors: int
    deliveries: list[dict[str, Any]]


def _hash_email(email: str) -> str:
    """Return first 12 hex chars of SHA-256 hash of lowercased email."""
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()[:12]


def _is_permanent_error(exc: BaseException) -> bool:
    """Return True if the error is permanent and the message should be archived."""
    if isinstance(exc, (InvalidRepoURLError, ValueError)):
        return True
    if isinstance(exc, GithubException):
        return exc.status in (404, 403, 451)
    return False


def _record_delivery(
    message: MoltgateMessage,
    result: GeneratedReadme | None = None,
    dry_run: bool = False,
    status: str = "delivered",
    error_reason: str = "",
) -> dict[str, Any]:
    """Append an audit record to deliveries.jsonl and return the record."""
    record: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message_id": message.id,
        "lane_slug": message.lane_slug,
        "sender_email_hash": _hash_email(message.sender_email),
        "amount_cents": message.amount_cents,
        "status": status,
        "dry_run": dry_run,
    }
    if result is not None:
        record["repo_url"] = result.repo_url
        record["gist_url"] = result.gist_url
        record["gist_raw_url"] = result.gist_raw_url
    if error_reason:
        record["error_reason"] = error_reason
    if not dry_run:
        try:
            DELIVERIES_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with DELIVERIES_LOG_PATH.open("a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
        except OSError as e:
            logger.warning("deliveries log write failed: %s", e)
    return record


def _validate_sender_url(message: MoltgateMessage) -> tuple[str, str] | None:
    """Return (owner, repo) if sender_url is a valid GitHub URL, else None."""
    if not message.sender_url:
        logger.info(
            "quick_question: message %s has no sender_url; skipping. "
            "(Lane must be configured with allow_sender_url=true and sender_url_required=true.)",
            message.id,
        )
        return None
    try:
        return parse_repo_url(message.sender_url)
    except InvalidRepoURLError as e:
        logger.info("quick_question: message %s rejected: %s", message.id, e)
        return None


def handle(
    lane_slug: str = "quick-question-readme-generator",
    *,
    client: MoltgateClient | None = None,
    dry_run: bool = False,
) -> LaneResult:
    """
    Entry point for the Quick Question lane.

    Called by main.py once per poll cycle (every 5 min via .github/workflows/poll.yml).
    """
    client = client or MoltgateClient()
    new_messages = client.list_new_messages(lane_slug=lane_slug)
    logger.info("quick_question: %d NEW message(s) on lane %s", len(new_messages), lane_slug)

    processed = 0
    skipped = 0
    errors = 0
    deliveries: list[dict[str, Any]] = []

    for stub in new_messages:
        # Fetch detail so we get the sender_url + sanitized_body fields
        try:
            message = client.get_message(stub.id)
        except Exception as e:  # noqa: BLE001 — bubble to audit log, don't crash the poll
            logger.exception("quick_question: get_message(%s) failed: %s", stub.id, e)
            errors += 1
            continue

        parsed = _validate_sender_url(message)
        if parsed is None:
            if not dry_run:
                try:
                    client.mark_archived(message.id)
                except Exception:  # noqa: BLE001
                    logger.exception("quick_question: mark_archived(%s) failed", message.id)
            skipped += 1
            continue

        owner, repo_name = parsed
        repo_url = f"https://github.com/{owner}/{repo_name}"

        try:
            result = generate(repo_url, publish=not dry_run)
        except Exception as e:  # noqa: BLE001
            if _is_permanent_error(e):
                logger.warning("quick_question: permanent error for %s: %s", repo_url, e)
                _record_delivery(
                    message, status="error_permanent",
                    error_reason=f"{type(e).__name__}: {e}",
                )
                if not dry_run:
                    try:
                        client.mark_archived(message.id)
                    except Exception:  # noqa: BLE001
                        logger.exception("quick_question: mark_archived(%s) failed", message.id)
            else:
                logger.exception("quick_question: transient error for %s: %s", repo_url, e)
                _record_delivery(
                    message, status="error_transient",
                    error_reason=f"{type(e).__name__}: {e}",
                )
            errors += 1
            continue

        record = _record_delivery(message, result, dry_run=dry_run)
        deliveries.append(record)

        if not dry_run:
            try:
                client.mark_processed(message.id)
            except Exception:  # noqa: BLE001
                logger.exception("quick_question: mark_processed(%s) failed", message.id)
                errors += 1
                continue

        processed += 1
        logger.info(
            "quick_question: delivered README for %s -> %s (message=%s)",
            repo_url,
            result.gist_url or "(dry-run)",
            message.id,
        )

    return LaneResult(
        processed=processed,
        skipped=skipped,
        errors=errors,
        deliveries=deliveries,
    )


def result_to_dict(result: LaneResult) -> dict[str, Any]:
    return asdict(result)
