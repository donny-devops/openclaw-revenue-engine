import sys
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import main


class PollRunnerTests(unittest.TestCase):
    def test_dry_run_exits_zero(self) -> None:
        self.assertEqual(main.main(["--once", "--direct-api", "--poll-only", "--dry-run"]), 0)

    def test_extract_messages_from_dict_and_list(self) -> None:
        self.assertEqual(main.extract_messages({"results": [{"id": "1"}]}), [{"id": "1"}])
        self.assertEqual(main.extract_messages([{"id": "2"}]), [{"id": "2"}])
        self.assertEqual(main.extract_messages("nope"), [])

    def test_localhost_engine_url_is_allowed(self) -> None:
        self.assertEqual(main.normalize_engine_url("http://localhost:3000/"), "http://localhost:3000")

    def test_remote_http_engine_url_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            main.normalize_engine_url("http://example.com")

    def test_load_config_includes_engine_url(self) -> None:
        args = Namespace(lane="real-offer", dry_run=True)
        with patch.dict("os.environ", {"REVENUE_ENGINE_URL": "https://engine.example", "MOLTGATE_BASE_URL": "https://moltgate.com"}, clear=False):
            config = main.load_config(args)
        self.assertEqual(config.engine_url, "https://engine.example")
        self.assertEqual(config.lane, "real-offer")

    def test_engine_egress_endpoint_defaults_https_port(self) -> None:
        self.assertEqual(main.engine_egress_endpoint("https://engine.example/revenue"), "engine.example:443")

    def test_engine_egress_endpoint_keeps_explicit_port(self) -> None:
        self.assertEqual(main.engine_egress_endpoint("https://engine.example:8443"), "engine.example:8443")

    def test_engine_egress_endpoint_allows_localhost_http(self) -> None:
        self.assertEqual(main.engine_egress_endpoint("http://localhost:3000/"), "localhost:3000")

    def test_engine_egress_endpoint_empty_is_none(self) -> None:
        self.assertIsNone(main.engine_egress_endpoint(""))
        self.assertIsNone(main.engine_egress_endpoint(None))


if __name__ == "__main__":
    unittest.main()
