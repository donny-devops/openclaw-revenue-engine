"""
main.py — openclaw-revenue-engine polling entry point.

Invoked by `.github/workflows/poll.yml` on a 5-minute cron:

    python main.py --once --direct-api --poll-only [--lane SLUG] [--dry-run]

Loads config/lanes.yaml (lane slug -> handler path), optionally filters to a
single lane, and dispatches each slug to its registered handler.

Handlers are imported lazily via dotted path (e.g. "lanes.quick_question:handle")
so adding a new lane only requires editing config/lanes.yaml + dropping a
handler file into lanes/.
"""

from __future__ import annotations

import argparse
import importlib
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Callable

import yaml
from dotenv import load_dotenv

logger = logging.getLogger("revenue-engine")

LANE_CONFIG_PATH = Path(__file__).parent / "config" / "lanes.yaml"


def _configure_logging() -> None:
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, level_name, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def _load_lane_handlers() -> dict[str, str]:
    """Read config/lanes.yaml and return {lane_slug: handler_path}."""
    if not LANE_CONFIG_PATH.exists():
        raise FileNotFoundError(f"lane config not found: {LANE_CONFIG_PATH}")
    with LANE_CONFIG_PATH.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    handlers = data.get("handlers") or {}
    if not isinstance(handlers, dict):
        raise ValueError("config/lanes.yaml: 'handlers' must be a mapping")
    return {str(k): str(v) for k, v in handlers.items()}


def _resolve_handler(handler_path: str) -> Callable[..., Any]:
    """Resolve a 'module.path:function' string to a callable."""
    if ":" not in handler_path:
        raise ValueError(f"handler path must be 'module:function', got {handler_path!r}")
    module_name, func_name = handler_path.split(":", 1)
    module = importlib.import_module(module_name)
    return getattr(module, func_name)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="revenue-engine",
        description="Poll Moltgate lanes and dispatch to MaxClaw-backed handlers.",
    )
    parser.add_argument("--once", action="store_true", help="Run one poll cycle then exit (required).")
    parser.add_argument(
        "--direct-api",
        action="store_true",
        help="Use direct Moltgate REST API (currently the only supported mode).",
    )
    parser.add_argument(
        "--poll-only",
        action="store_true",
        help="Only poll + dispatch; no other side effects. Currently implied.",
    )
    parser.add_argument(
        "--lane",
        default="",
        help="If set, only poll this lane slug (defaults to all configured lanes).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run handlers with publish=False and no Moltgate status mutations.",
    )
    return parser.parse_args(argv)


def run(argv: list[str] | None = None) -> int:
    load_dotenv()
    _configure_logging()
    args = _parse_args(argv if argv is not None else sys.argv[1:])

    if not args.once:
        logger.error("main.py currently requires --once; continuous loop not implemented")
        return 2

    try:
        handlers = _load_lane_handlers()
    except Exception as e:  # noqa: BLE001
        logger.error("failed to load lane config: %s", e)
        return 3

    if args.lane:
        handlers = {k: v for k, v in handlers.items() if k == args.lane}
        if not handlers:
            logger.warning("no handler registered for lane %r; nothing to do", args.lane)
            return 0

    total_processed = 0
    total_errors = 0

    for lane_slug, handler_path in handlers.items():
        logger.info("dispatching lane=%s -> %s", lane_slug, handler_path)
        try:
            handler = _resolve_handler(handler_path)
        except Exception as e:  # noqa: BLE001
            logger.error("failed to resolve %s: %s", handler_path, e)
            total_errors += 1
            continue

        try:
            result = handler(lane_slug=lane_slug, dry_run=args.dry_run)
        except Exception:  # noqa: BLE001
            logger.exception("handler %s crashed", handler_path)
            total_errors += 1
            continue

        # Best-effort result reporting; each handler returns its own shape.
        summary: dict[str, Any] = {}
        if hasattr(result, "__dict__"):
            summary = {
                k: v for k, v in result.__dict__.items()
                if k in {"processed", "skipped", "errors"}
            }
            total_processed += int(getattr(result, "processed", 0) or 0)
            total_errors += int(getattr(result, "errors", 0) or 0)
        logger.info("lane=%s result=%s", lane_slug, json.dumps(summary, default=str))

    logger.info(
        "poll cycle done: lanes=%d processed=%d errors=%d dry_run=%s",
        len(handlers),
        total_processed,
        total_errors,
        args.dry_run,
    )
    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(run())
