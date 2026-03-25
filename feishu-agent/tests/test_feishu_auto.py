import pytest
import sys
import argparse
from unittest.mock import MagicMock, patch


class TestParser:
    def test_list_command(self):
        with patch.object(sys, "argv", ["feishu-auto", "list"]):
            from feishu_agent.feishu_auto import build_parser
            args = build_parser().parse_args(["list"])
            assert args.command == "list"

    def test_claim_command(self):
        from feishu_agent.feishu_auto import build_parser
        args = build_parser().parse_args(["claim", "12345"])
        assert args.command == "claim"
        assert args.work_item_id == "12345"

    def test_run_command(self):
        from feishu_agent.feishu_auto import build_parser
        args = build_parser().parse_args(["run", "12345"])
        assert args.command == "run"
        assert args.work_item_id == "12345"

    def test_flow_command(self):
        from feishu_agent.feishu_auto import build_parser
        args = build_parser().parse_args(["flow", "12345"])
        assert args.command == "flow"
        assert args.work_item_id == "12345"

    def test_report_command(self):
        from feishu_agent.feishu_auto import build_parser
        args = build_parser().parse_args(["report", "12345"])
        assert args.command == "report"
        assert args.work_item_id == "12345"

    def test_auto_command(self):
        from feishu_agent.feishu_auto import build_parser
        args = build_parser().parse_args(["auto", "12345"])
        assert args.command == "auto"
        assert args.work_item_id == "12345"
        assert args.yes is False
        assert args.timeout == 60

    def test_auto_with_yes_flag(self):
        from feishu_agent.feishu_auto import build_parser
        args = build_parser().parse_args(["auto", "12345", "--yes"])
        assert args.command == "auto"
        assert args.yes is True

    def test_auto_with_timeout(self):
        from feishu_agent.feishu_auto import build_parser
        args = build_parser().parse_args(["auto", "12345", "--yes", "--timeout", "120"])
        assert args.timeout == 120

    def test_verbose_flag(self):
        from feishu_agent.feishu_auto import build_parser
        args = build_parser().parse_args(["--verbose", "list"])
        assert args.verbose is True

    def test_invalid_command(self, capsys):
        from feishu_agent.feishu_auto import build_parser
        parser = build_parser()
        with pytest.raises(SystemExit):
            parser.parse_args(["invalid_cmd"])

    def test_run_with_role(self):
        from feishu_agent.feishu_auto import build_parser
        args = build_parser().parse_args(["run", "12345", "investigate"])
        assert args.role == "investigate"

    def test_report_with_status(self):
        from feishu_agent.feishu_auto import build_parser
        args = build_parser().parse_args(["report", "12345", "--status", "failure"])
        assert args.status == "failure"
