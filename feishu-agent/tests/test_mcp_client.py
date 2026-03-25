import pytest
import json
from unittest.mock import MagicMock, patch, Mock, call
from feishu_client.mcp import MCPClient, MCPConfig, MCPError, RateLimitError


def make_response(content, is_error=False):
    if isinstance(content, dict):
        text = json.dumps(content)
    else:
        text = content
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "content": [{"type": "text", "text": text}],
            "isError": is_error,
        }
    }


class TestMCPClientInit:
    def test_init_default_config(self):
        client = MCPClient()
        assert client.config.mcp_key == ""
        assert client.config.user_key == ""
        assert client.config.timeout == 30
        assert client.config.max_retries == 3

    def test_init_custom_config(self, mock_config):
        client = MCPClient(mock_config)
        assert client.config.mcp_key == "test-mcp-key"
        assert client.config.timeout == 5

    @patch("feishu_client.mcp.MCPClient._resolve_host")
    @patch("feishu_client.mcp.requests.Session")
    def test_build_url(self, mock_session_cls, mock_resolve, mock_config):
        mock_resolve.return_value = None
        client = MCPClient(mock_config)
        url = client._build_url()
        assert "mcpKey=test-mcp-key" in url
        assert "userKey=test-user-key" in url
        assert "project.feishu.cn" in url


class TestMCPCall:
    @patch("feishu_client.mcp.MCPClient._call_raw")
    def test_call_success(self, mock_raw, mock_config):
        mock_raw.return_value = make_response({"ok": True})
        client = MCPClient(mock_config)
        result = client._call("test_tool", {"arg": "val"})
        assert result == {"data": {"ok": True}}

    @patch("feishu_client.mcp.MCPClient._call_raw")
    def test_call_mcp_error(self, mock_raw, mock_config):
        mock_raw.return_value = make_response("id=500,code=500,message=Test Error", is_error=True)
        client = MCPClient(mock_config)
        with pytest.raises(MCPError) as exc_info:
            client._call("test_tool", {})
        assert exc_info.value.code == 500

    @patch("feishu_client.mcp.MCPClient._call_raw")
    def test_call_rpc_error(self, mock_raw, mock_config):
        mock_raw.return_value = {"jsonrpc": "2.0", "id": 1, "error": {"code": -1, "message": "RPC Error"}}
        client = MCPClient(mock_config)
        with pytest.raises(MCPError) as exc_info:
            client._call("test_tool", {})
        assert exc_info.value.code == -1

    @patch("feishu_client.mcp.MCPClient._call_raw")
    def test_call_rate_limit_error(self, mock_raw, mock_config):
        mock_raw.return_value = make_response("id=429,code=429,message=Rate Limited", is_error=True)
        client = MCPClient(mock_config)
        with pytest.raises(RateLimitError):
            client._call("test_tool", {})

    @patch("feishu_client.mcp.MCPClient._call")
    @patch("feishu_client.mcp.time.sleep")
    def test_call_timeout_retries(self, mock_sleep, mock_call, mock_config):
        import requests
        mock_call.side_effect = [requests.exceptions.Timeout("timeout"), {"data": {"ok": True}}]
        client = MCPClient(mock_config)
        result = client._retry_call("test_tool", {})
        assert result == {"data": {"ok": True}}
        assert mock_call.call_count == 2

    @patch("feishu_client.mcp.MCPClient._call")
    @patch("feishu_client.mcp.time.sleep")
    def test_call_timeout_exhausted(self, mock_sleep, mock_call, mock_config):
        import requests
        mock_call.side_effect = requests.exceptions.Timeout("timeout")
        client = MCPClient(mock_config)
        with pytest.raises(requests.exceptions.Timeout):
            client._retry_call("test_tool", {})
        assert mock_call.call_count == 2

    @patch("feishu_client.mcp.MCPClient._call")
    @patch("feishu_client.mcp.time.sleep")
    def test_call_network_error_retries(self, mock_sleep, mock_call, mock_config):
        import requests
        mock_call.side_effect = [
            requests.exceptions.ConnectionError("conn error"),
            {"data": {"ok": True}}
        ]
        client = MCPClient(mock_config)
        result = client._retry_call("test_tool", {})
        assert result == {"data": {"ok": True}}
        assert mock_call.call_count == 2

    @patch("feishu_client.mcp.MCPClient._call_raw")
    def test_call_no_content_returns_empty_data(self, mock_raw, mock_config):
        mock_raw.return_value = {"jsonrpc": "2.0", "id": 1, "result": {"content": [], "isError": False}}
        client = MCPClient(mock_config)
        result = client._call("test_tool", {})
        assert result == {"data": {}}


class TestListWorkitems:
    @patch("feishu_client.mcp.MCPClient._retry_call")
    def test_list_workitems_parses_mql_response(self, mock_retry, mock_config):
        mock_retry.return_value = {
            "data": {
                "list": [
                    {
                        "group_infos": [{"group_id": "1", "group_name": "Group 1"}],
                        "count": 2,
                    }
                ],
                "data": {
                    "1": [
                        {
                            "moql_field_list": [
                                {"key": "name", "name": "Name", "value_type": "string_value", "value": {"string_value": "Task 1"}},
                            ]
                        },
                        {
                            "moql_field_list": [
                                {"key": "name", "name": "Name", "value_type": "string_value", "value": {"string_value": "Task 2"}},
                            ]
                        }
                    ]
                }
            }
        }
        client = MCPClient(mock_config)
        items = client.list_workitems(page_size=50)
        assert len(items) == 2
        assert items[0]["name"] == "Task 1"
        assert items[1]["name"] == "Task 2"
        mock_retry.assert_called_once()

    @patch("feishu_client.mcp.MCPClient._retry_call")
    def test_list_workitems_empty(self, mock_retry, mock_config):
        mock_retry.return_value = {"data": {"list": [], "data": {}}}
        client = MCPClient(mock_config)
        items = client.list_workitems()
        assert items == []

    @patch("feishu_client.mcp.MCPClient._retry_call")
    def test_list_workitems_mql_contains_filter(self, mock_retry, mock_config):
        mock_retry.return_value = {"data": {"list": [], "data": {}}}
        client = MCPClient(mock_config)
        client.list_workitems(filters=[{"field_key": "status", "operator": "contains", "field_value": "open"}])
        call_args = mock_retry.call_args[0]
        mql = call_args[1]["mql"]
        assert "like" in mql or "IS NOT NULL" in mql

    @patch("feishu_client.mcp.MCPClient._retry_call")
    def test_list_workitems_with_type(self, mock_retry, mock_config):
        mock_retry.return_value = {"data": {"list": [], "data": {}}}
        client = MCPClient(mock_config)
        client.list_workitems(work_item_type="story")
        call_args = mock_retry.call_args[0]
        mql = call_args[1]["mql"]
        assert "testproj.story" in mql


class TestOtherTools:
    @patch("feishu_client.mcp.MCPClient._retry_call")
    def test_get_transitable_states(self, mock_retry, mock_config):
        mock_retry.return_value = {"data": {"states": ["state_1", "state_2"]}}
        client = MCPClient(mock_config)
        states = client.get_transitable_states("work-item-123")
        assert states == ["state_1", "state_2"]

    @patch("feishu_client.mcp.MCPClient._retry_call")
    def test_get_transition_required(self, mock_retry, mock_config):
        mock_retry.return_value = {"data": {"required_fields": [{"field_key": "name"}]}}
        client = MCPClient(mock_config)
        required = client.get_transition_required("work-item-123", "state_1")
        assert required == [{"field_key": "name"}]

    @patch("feishu_client.mcp.MCPClient._retry_call")
    def test_add_comment(self, mock_retry, mock_config):
        mock_retry.return_value = {"data": {"comment_id": "12345"}}
        client = MCPClient(mock_config)
        result = client.add_comment("work-item-123", "test comment")
        assert result == {"data": {"comment_id": "12345"}}
        call_args = mock_retry.call_args[0]
        assert call_args[1]["comment_content"] == "test comment"

    @patch("feishu_client.mcp.MCPClient._retry_call")
    def test_update_field(self, mock_retry, mock_config):
        mock_retry.return_value = {"data": {"ok": True}}
        client = MCPClient(mock_config)
        result = client.update_field("work-item-123", [{"field_key": "name", "field_value": "New Name"}])
        call_args = mock_retry.call_args[0]
        assert call_args[1]["fields"] == [{"field_key": "name", "field_value": "New Name"}]

    @patch("feishu_client.mcp.MCPClient._retry_call")
    def test_transition_node(self, mock_retry, mock_config):
        mock_retry.return_value = {"data": {"ok": True}}
        client = MCPClient(mock_config)
        client.transition_node("work-item-123", node_key="started", action="confirm")
        call_args = mock_retry.call_args[0]
        assert call_args[1]["node_id"] == "started"
        assert call_args[1]["action"] == "confirm"

    def test_get_current_node(self, mock_config):
        client = MCPClient(mock_config)
        detail = {
            "list": [
                {"basic": {"node_key": "started", "status": "finished"}},
                {"basic": {"node_key": "state_0", "status": "doing"}},
                {"basic": {"node_key": "state_1", "status": "not_started"}},
            ]
        }
        result = client.get_current_node(detail)
        assert result["basic"]["node_key"] == "state_0"

    def test_get_current_node_no_doing(self, mock_config):
        client = MCPClient(mock_config)
        detail = {"list": [{"basic": {"node_key": "started", "status": "finished"}}]}
        result = client.get_current_node(detail)
        assert result is None

    @patch("feishu_client.mcp.MCPClient._retry_call")
    def test_get_transition_required_form_items(self, mock_retry, mock_config):
        mock_retry.return_value = {
            "data": {
                "form_items": [
                    {"key": "field_1", "field_type_key": "bool"},
                    {"key": "field_2", "field_type_key": "text"},
                ]
            }
        }
        client = MCPClient(mock_config)
        result = client.get_transition_required("work-item-123", "state_0")
        assert len(result) == 2
        assert result[0]["key"] == "field_1"
