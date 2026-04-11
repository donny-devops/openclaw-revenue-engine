"""
tests/unit/test_quick_question_lane.py

End-to-end mock of the Quick Question lane handler. Fakes the Moltgate
client and the readme_generator.generate() function and asserts that:
  - Messages with a valid sender_url get processed and marked PROCESSED
  - Messages with a missing/invalid sender_url get skipped + archived
  - Messages whose generate() raises get counted as errors (not crashes)
  - In dry-run mode, no mutations are sent to Moltgate
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from lanes import quick_question  # noqa: E402
from services.moltgate_client import MoltgateMessage  # noqa: E402


def _msg(
    *,
    id_: str,
    sender_url: str | None,
    lane_slug: str = "quick-question",
) -> MoltgateMessage:
    return MoltgateMessage(
        id=id_,
        subject="Please review my repo",
        sender_name="Test Sender",
        sender_email="test@example.com",
        lane_name="Quick Question | Agent Contact",
        lane_slug=lane_slug,
        amount_cents=500,
        status="NEW",
        inbox_status="NEW",
        is_read=False,
        triage_output=None,
        created_at="2026-04-11T00:00:00Z",
        sanitized_body="ignored body",
        sender_url=sender_url,
    )


def _fake_generated(repo_url: str):
    result = MagicMock()
    result.repo_url = repo_url
    result.owner = "acme"
    result.repo = "demo"
    result.markdown = "# acme/demo\n\n..."
    result.gist_url = "https://gist.github.com/fake/abc123"
    result.gist_raw_url = "https://gist.githubusercontent.com/fake/abc123/raw/README.md"
    return result


@pytest.fixture(autouse=True)
def _isolate_deliveries_log(tmp_path, monkeypatch):
    monkeypatch.setattr(
        quick_question,
        "DELIVERIES_LOG_PATH",
        tmp_path / "deliveries.jsonl",
    )


def test_happy_path_processes_and_marks_processed():
    client = MagicMock()
    stub = _msg(id_="m1", sender_url="https://github.com/acme/demo")
    client.list_new_messages.return_value = [stub]
    client.get_message.return_value = stub

    with patch.object(
        quick_question,
        "generate",
        return_value=_fake_generated("https://github.com/acme/demo"),
    ) as mock_generate:
        result = quick_question.handle(client=client)

    assert result.processed == 1
    assert result.skipped == 0
    assert result.errors == 0
    assert len(result.deliveries) == 1
    record = result.deliveries[0]
    assert record["gist_url"] == "https://gist.github.com/fake/abc123"
    assert record["repo_url"] == "https://github.com/acme/demo"
    assert record["dry_run"] is False

    mock_generate.assert_called_once_with("https://github.com/acme/demo", publish=True)
    client.mark_processed.assert_called_once_with("m1")
    client.mark_archived.assert_not_called()


def test_missing_sender_url_is_skipped_and_archived():
    client = MagicMock()
    stub = _msg(id_="m2", sender_url=None)
    client.list_new_messages.return_value = [stub]
    client.get_message.return_value = stub

    with patch.object(quick_question, "generate") as mock_generate:
        result = quick_question.handle(client=client)

    assert result.processed == 0
    assert result.skipped == 1
    assert result.errors == 0
    mock_generate.assert_not_called()
    client.mark_archived.assert_called_once_with("m2")
    client.mark_processed.assert_not_called()


def test_non_github_sender_url_is_skipped_and_archived():
    client = MagicMock()
    stub = _msg(id_="m3", sender_url="https://gitlab.com/acme/demo")
    client.list_new_messages.return_value = [stub]
    client.get_message.return_value = stub

    with patch.object(quick_question, "generate") as mock_generate:
        result = quick_question.handle(client=client)

    assert result.skipped == 1
    mock_generate.assert_not_called()
    client.mark_archived.assert_called_once_with("m3")


def test_generate_failure_is_counted_as_error_not_crash():
    client = MagicMock()
    stub = _msg(id_="m4", sender_url="https://github.com/acme/demo")
    client.list_new_messages.return_value = [stub]
    client.get_message.return_value = stub

    with patch.object(
        quick_question,
        "generate",
        side_effect=RuntimeError("upstream API down"),
    ):
        result = quick_question.handle(client=client)

    assert result.processed == 0
    assert result.errors == 1
    client.mark_processed.assert_not_called()
    # We do NOT archive on transient errors — let the next poll retry.
    client.mark_archived.assert_not_called()


def test_dry_run_does_not_mutate_moltgate():
    client = MagicMock()
    stub = _msg(id_="m5", sender_url="https://github.com/acme/demo")
    client.list_new_messages.return_value = [stub]
    client.get_message.return_value = stub

    with patch.object(
        quick_question,
        "generate",
        return_value=_fake_generated("https://github.com/acme/demo"),
    ) as mock_generate:
        result = quick_question.handle(client=client, dry_run=True)

    assert result.processed == 1
    mock_generate.assert_called_once_with("https://github.com/acme/demo", publish=False)
    client.mark_processed.assert_not_called()
    client.mark_archived.assert_not_called()
    assert result.deliveries[0]["dry_run"] is True
