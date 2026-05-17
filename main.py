#!/usr/bin/env python3
"""Revenue Engine poll runner.

This script is intentionally defensive: scheduled GitHub Actions should not fail
just because optional Moltgate secrets are not configured yet. Real API or auth
errors still fail fast so operators see actionable breakage.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

DEFAULT_BASE_URL = "https://moltgate.com"
REQUEST_TIMEOUT_SECONDS = 20


@dataclass(frozen=True)
class PollConfig:
    api_key: str | None
    base_url: str
    profile_handle: str | None
    lane: str | None
    dry_run: bool


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Poll Moltgate inbox for revenue-engine work.")
    parser.add_argument("--once", action="store_true", help="Run one polling pass and exit.")
    parser.add_argument("--direct-api", action="store_true", help="Use Moltgate direct API mode.")
    parser.add_argument("--poll-only", action="store_true", help="Poll only; do not run long-lived workers.")
    parser.add_argument("--lane", default=None, help="Optional lane slug to poll.")
    parser.add_argument("--dry-run", action="store_true", help="Validate configuration without calling Moltgate.")
    return parser.parse_args(argv)


def load_config(args: argparse.Namespace) -> PollConfig:
    return PollConfig(
        api_key=os.getenv("MOLTGATE_API_KEY"),
        base_url=(os.getenv("MOLTGATE_BASE_URL") or DEFAULT_BASE_URL).rstrip("/"),
        profile_handle=os.getenv("MOLTGATE_PROFILE_HANDLE"),
        lane=args.lane.strip() if args.lane else None,
        dry_run=bool(args.dry_run),
    )


def build_inbox_url(config: PollConfig) -> str:
    params: dict[str, str] = {"status": "NEW"}
    if config.lane:
        params["lane"] = config.lane
    if config.profile_handle:
        params["profile"] = config.profile_handle

    query_string = urllib.parse.urlencode(params)
    return f"{config.base_url}/api/inbox/messages/?{query_string}"


def read_json(url: str, api_key: str) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "User-Agent": "openclaw-revenue-engine-poll/1.0",
        },
        method="GET",
    )

    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        body = response.read().decode("utf-8")
        return json.loads(body) if body else {}


def poll_inbox(config: PollConfig) -> int:
    if config.dry_run:
        logging.info("Dry run enabled; validated poll configuration without API call.")
        return 0

    if not config.api_key:
        logging.warning("MOLTGATE_API_KEY is not configured; skipping scheduled poll without failure.")
        return 0

    payload = read_json(build_inbox_url(config), config.api_key)
    if isinstance(payload, dict):
        messages = payload.get("results") or payload.get("messages") or []
    elif isinstance(payload, list):
        messages = payload
    else:
        messages = []

    logging.info("Poll completed: %s new message(s)%s.", len(messages), f" for lane {config.lane}" if config.lane else "")
    return len(messages)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(message)s",
    )

    args = parse_args(argv or sys.argv[1:])
    config = load_config(args)

    if not args.once:
        logging.warning("Long-running mode is not implemented; executing one poll pass.")

    try:
        poll_inbox(config)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            logging.error("Moltgate API authentication failed. Check MOLTGATE_API_KEY.")
        elif exc.code == 403:
            logging.error("Moltgate API authorization failed. Check token scopes/profile access.")
        elif exc.code == 404:
            logging.error("Moltgate inbox endpoint was not found at %s.", exc.url)
        else:
            logging.error("Moltgate API request failed with HTTP %s: %s", exc.code, exc.reason)
        return 1
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        logging.error("Moltgate poll request failed: %s", exc)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
