#!/usr/bin/env python3
"""
Moltgate poll worker — stub placeholder for Milestone 5.

This script is invoked by `.github/workflows/poll.yml` every 5 minutes.
The real implementation will be added when Milestone 4 (Invoice Generation)
is complete and Moltgate API credentials are provisioned.

Usage:
    python main.py --once --direct-api --poll-only [--lane LANE_SLUG]
"""
import argparse
import os
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Moltgate inbox poll worker")
    parser.add_argument("--once", action="store_true", help="Run a single poll cycle and exit")
    parser.add_argument("--direct-api", action="store_true", help="Use Moltgate REST API directly")
    parser.add_argument("--poll-only", action="store_true", help="Skip processing; only read inbox")
    parser.add_argument("--lane", default="", help="Lane slug to poll (blank = all)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    api_key = os.getenv("MOLTGATE_API_KEY", "")
    base_url = os.getenv("MOLTGATE_BASE_URL", "https://moltgate.com")

    if not api_key:
        print(
            "[poll] MOLTGATE_API_KEY is not set — skipping poll (stub mode).",
            file=sys.stderr,
        )
        return 0

    lane_info = f" (lane: {args.lane})" if args.lane else ""
    print(f"[poll] Would poll {base_url}/inbox{lane_info} — implementation pending (Milestone 5).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
