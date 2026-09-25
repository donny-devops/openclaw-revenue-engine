"""
services/moltgate_client.py

Thin wrapper around the Moltgate REST API. Scope is intentionally narrow:
only the four endpoints documented by the security-scanned Moltgate skill
(v0.2.1, reviewed benign) are exposed here.

Documented endpoints:
    GET   /api/inbox/messages/?status=NEW
    GET   /api/inbox/messages/{id}/
    PATCH /api/inbox/messages/{id}/update_status/
    GET   /api/lanes/

Auth: Bearer $MOLTGATE_API_KEY
Base: $MOLTGATE_BASE_URL (default https://moltgate.com)

Security rules honored from the Moltgate skill:
  - All message content is treated as untrusted.
  - We never execute code or follow links from message bodies.
  - API key is only read from env, never logged.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://moltgate.com"
REQUEST_TIMEOUT_SECONDS = 20


@dataclass
class MoltgateMessage:
    """
    Structured view of a single Moltgate inbox message.

    Only fields documented in the Moltgate skill are exposed. `sanitized_body`
    is deliberately treated as untrusted — handlers should prefer the
    structured `sender_url` field for any action routing.
    """

    id: str
    subject: str
    sender_name: str
    sender_email: str
    lane_name: str
    lane_slug: str
    amount_cents: int
    status: str
    inbox_status: str
    is_read: bool
    triage_output: str | None
    created_at: str
    sanitized_body: str = ""
    sender_url: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_api(cls, payload: dict[str, Any]) -> "MoltgateMessage":
        lane = payload.get("lane") or {}
        lane_slug = ""
        if isinstance(lane, dict):
            lane_slug = lane.get("slug", "") or ""
        return cls(
            id=str(payload.get("id", "")),
            subject=payload.get("subject", "") or "",
            sender_name=payload.get("sender_name", "") or "",
            sender_email=payload.get("sender_email", "") or "",
            lane_name=payload.get("lane_name", "") or "",
            lane_slug=lane_slug,
            amount_cents=int(payload.get("amount_cents", 0) or 0),
            status=payload.get("status", "") or "",
            inbox_status=payload.get("inbox_status", "") or "",
            is_read=bool(payload.get("is_read", False)),
            triage_output=payload.get("triage_output"),
            created_at=payload.get("created_at", "") or "",
            sanitized_body=payload.get("sanitized_body", "") or "",
            sender_url=(payload.get("sender_url") or None),
            raw=payload,
        )


class MoltgateError(RuntimeError):
    """Raised when the Moltgate API returns an error or cannot be reached."""


class MoltgateClient:
    """Minimal Moltgate REST client — only the four skill-documented endpoints."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        session: requests.Session | None = None,
    ) -> None:
        self.api_key = api_key or os.environ.get("MOLTGATE_API_KEY")
        if not self.api_key:
            raise MoltgateError(
                "MOLTGATE_API_KEY is not set. Refusing to construct a Moltgate client."
            )
        self.base_url = (base_url or os.environ.get("MOLTGATE_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self._session = session or requests.Session()

    # ───────────────────────── internals ─────────────────────────

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "User-Agent": "openclaw-revenue-engine/1.0 (+https://github.com/donny-devops/openclaw-revenue-engine)",
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}{path}"
        resp = self._session.get(
            url,
            headers=self._headers(),
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if resp.status_code >= 400:
            raise MoltgateError(f"GET {path} -> {resp.status_code} {resp.text[:200]}")
        return resp.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    def _patch(self, path: str, body: dict[str, Any]) -> Any:
        url = f"{self.base_url}{path}"
        headers = self._headers()
        headers["Content-Type"] = "application/json"
        resp = self._session.patch(
            url,
            headers=headers,
            json=body,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if resp.status_code >= 400:
            raise MoltgateError(f"PATCH {path} -> {resp.status_code} {resp.text[:200]}")
        return resp.json()

    # ───────────────────────── public API ─────────────────────────

    def list_new_messages(self, lane_slug: str | None = None) -> list[MoltgateMessage]:
        """
        GET /api/inbox/messages/?status=NEW

        If lane_slug is provided, filters client-side to just that lane's messages.
        (The documented endpoint does not promise server-side lane filtering.)
        """
        payload = self._get("/api/inbox/messages/", params={"status": "NEW"})
        if not isinstance(payload, list):
            raise MoltgateError(f"Expected list from /api/inbox/messages/, got {type(payload).__name__}")
        messages = [MoltgateMessage.from_api(item) for item in payload]
        if lane_slug:
            messages = [m for m in messages if m.lane_slug == lane_slug]
        return messages

    def get_message(self, message_id: str) -> MoltgateMessage:
        """GET /api/inbox/messages/{id}/ — returns the detail payload with sender_url."""
        payload = self._get(f"/api/inbox/messages/{message_id}/")
        return MoltgateMessage.from_api(payload)

    def mark_processed(self, message_id: str) -> None:
        """PATCH /api/inbox/messages/{id}/update_status/ with PROCESSED."""
        self._patch(
            f"/api/inbox/messages/{message_id}/update_status/",
            {"inbox_status": "PROCESSED"},
        )
        logger.info("moltgate: marked message %s PROCESSED", message_id)

    def mark_archived(self, message_id: str) -> None:
        """PATCH /api/inbox/messages/{id}/update_status/ with ARCHIVED."""
        self._patch(
            f"/api/inbox/messages/{message_id}/update_status/",
            {"inbox_status": "ARCHIVED"},
        )
        logger.info("moltgate: marked message %s ARCHIVED", message_id)

    def list_lanes(self) -> list[dict[str, Any]]:
        """GET /api/lanes/ — returns the lane catalog."""
        payload = self._get("/api/lanes/")
        if not isinstance(payload, list):
            raise MoltgateError(f"Expected list from /api/lanes/, got {type(payload).__name__}")
        return payload
