import pytest
import sys
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch, Mock


class TestOrchestratorClaim:
    @patch("feishu_agent.orchestrator.MCPClient")
    def test_claim_task_updates_assignee(self, mock_mcp_cls):
        from feishu_agent.orchestrator import Orchestrator

        mock_client = MagicMock()
        mock_mcp_cls.return_value = mock_client
        mock_client.update_field.return_value = {"data": {"ok": True}}

        orch = Orchestrator()
        orch.mcp_client = mock_client

        result = orch.claim_task("work-item-123", "test-user-key")
        assert result["claimed"] is True
        mock_client.update_field.assert_called_once()

    @patch("feishu_agent.orchestrator.MCPClient")
    def test_claim_task_failure(self, mock_mcp_cls):
        from feishu_agent.orchestrator import Orchestrator
        from feishu_client.mcp import MCPError

        mock_client = MagicMock()
        mock_mcp_cls.return_value = mock_client
        mock_client.update_field.side_effect = MCPError(500, "Server Error")

        orch = Orchestrator()
        orch.mcp_client = mock_client

        result = orch.claim_task("work-item-123", "test-user-key")
        assert result["claimed"] is False
        assert "error" in result


class TestOrchestratorNodeTransition:
    @patch("feishu_agent.orchestrator.MCPClient")
    def test_transition_node_success(self, mock_mcp_cls):
        from feishu_agent.orchestrator import Orchestrator

        mock_client = MagicMock()
        mock_mcp_cls.return_value = mock_client
        mock_client.get_node_detail.return_value = {
            "data": {
                "list": [{
                    "basic": {"node_key": "started", "status": "doing"}
                }]
            }
        }
        mock_client.get_transitable_states.return_value = ["state_1"]
        mock_client.get_transition_required.return_value = []
        mock_client.transition_node.return_value = {"data": {"ok": True}}

        orch = Orchestrator()
        orch.mcp_client = mock_client

        result = orch.transition_node("work-item-123")
        assert result["success"] is True

    @patch("feishu_agent.orchestrator.MCPClient")
    def test_transition_node_no_states(self, mock_mcp_cls):
        from feishu_agent.orchestrator import Orchestrator

        mock_client = MagicMock()
        mock_mcp_cls.return_value = mock_client
        mock_client.get_node_detail.return_value = {
            "data": {
                "list": [{
                    "basic": {"node_key": "started", "status": "doing"}
                }]
            }
        }
        mock_client.get_transitable_states.return_value = []

        orch = Orchestrator()
        orch.mcp_client = mock_client

        result = orch.transition_node("work-item-123")
        assert result["success"] is False
        assert "no transitable state" in result.get("reason", "")


class TestOrchestratorGstackDispatch:
    @patch("feishu_agent.orchestrator.subprocess.run")
    @patch("feishu_agent.orchestrator.MCPClient")
    def test_dispatch_to_gstack(self, mock_mcp_cls, mock_run):
        from feishu_agent.orchestrator import Orchestrator

        mock_client = MagicMock()
        mock_mcp_cls.return_value = mock_client

        mock_run.return_value = MagicMock(
            returncode=0,
            stdout='{"status": "done", "artifacts": []}',
            stderr=""
        )

        orch = Orchestrator()
        result = orch.dispatch_to_gstack("office-hours", "分析这个任务")

        assert result["success"] is True
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        assert any("office-hours" in arg for arg in call_args)

    @patch("feishu_agent.orchestrator.subprocess.run")
    @patch("feishu_agent.orchestrator.MCPClient")
    def test_dispatch_to_gstack_failure(self, mock_mcp_cls, mock_run):
        from feishu_agent.orchestrator import Orchestrator

        mock_client = MagicMock()
        mock_mcp_cls.return_value = mock_client
        mock_run.side_effect = FileNotFoundError("gstack not found")

        orch = Orchestrator()
        result = orch.dispatch_to_gstack("office-hours", "analyze")
        assert result["success"] is False
        assert "error" in result


class TestOrchestratorReport:
    @patch("feishu_agent.orchestrator.MCPClient")
    def test_generate_report(self, mock_mcp_cls):
        from feishu_agent.orchestrator import Orchestrator

        mock_client = MagicMock()
        mock_mcp_cls.return_value = mock_client
        mock_client.add_comment.return_value = {"data": {"comment_id": "c123"}}

        orch = Orchestrator()
        orch.mcp_client = mock_client

        report = orch.generate_report("work-item-123", {
            "status": "success",
            "completed": ["分析需求"],
            "artifacts": [],
            "risks": [],
            "decisions": [],
            "next_action": "流转到下一节点",
        })

        assert report["status"] == "success"
        mock_client.add_comment.assert_called_once()
        comment = mock_client.add_comment.call_args[1].get("comment_content") or mock_client.add_comment.call_args[0][1]
        assert "Agent 执行报告" in comment
        assert "✅" in comment
