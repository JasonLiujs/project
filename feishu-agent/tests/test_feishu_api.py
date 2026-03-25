import pytest
import json
from unittest.mock import MagicMock, patch, Mock
from feishu_client.feishu_api import FeishuAPIClient, FeishuAPIConfig, FeishuAPIError


class TestFeishuAPIInit:
    def test_init_default(self):
        client = FeishuAPIClient()
        assert client._tenant_token == ""
        assert client._token_expires_at is None

    def test_init_custom_config(self, mock_feishu_config):
        client = FeishuAPIClient(mock_feishu_config)
        assert client.config.app_id == "test-app-id"
        assert client.config.app_secret == "test-app-secret"


class TestTenantToken:
    @patch("feishu_client.feishu_api.requests.Session")
    def test_get_token_success(self, mock_session_cls, mock_feishu_config):
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.post.return_value.json.return_value = {
            "code": 0,
            "msg": "success",
            "tenant_access_token": "test-token-abc",
            "expire": 7200,
        }

        client = FeishuAPIClient(mock_feishu_config)
        token = client._get_tenant_token()

        assert token == "test-token-abc"
        assert client._tenant_token == "test-token-abc"
        mock_session.post.assert_called_once()

    @patch("feishu_client.feishu_api.requests.Session")
    def test_get_token_cached(self, mock_session_cls, mock_feishu_config):
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.post.return_value.json.return_value = {
            "code": 0,
            "msg": "success",
            "tenant_access_token": "cached-token",
            "expire": 7200,
        }

        client = FeishuAPIClient(mock_feishu_config)
        client._tenant_token = "already-cached"
        from datetime import datetime, timedelta
        client._token_expires_at = datetime.now() + timedelta(hours=2)

        token = client._get_tenant_token()
        assert token == "already-cached"
        mock_session.post.assert_not_called()

    @patch("feishu_client.feishu_api.requests.Session")
    def test_get_token_expired_refreshes(self, mock_session_cls, mock_feishu_config):
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.post.return_value.json.return_value = {
            "code": 0,
            "tenant_access_token": "new-token",
            "expire": 7200,
        }

        client = FeishuAPIClient(mock_feishu_config)
        client._tenant_token = "old-token"
        from datetime import datetime, timedelta
        client._token_expires_at = datetime.now() - timedelta(minutes=1)

        token = client._get_tenant_token()
        assert token == "new-token"
        mock_session.post.assert_called_once()

    @patch("feishu_client.feishu_api.requests.Session")
    def test_get_token_force_refresh(self, mock_session_cls, mock_feishu_config):
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.post.return_value.json.return_value = {
            "code": 0,
            "tenant_access_token": "forced-token",
            "expire": 7200,
        }

        client = FeishuAPIClient(mock_feishu_config)
        client._tenant_token = "cached-token"
        from datetime import datetime, timedelta
        client._token_expires_at = datetime.now() + timedelta(hours=2)

        token = client._get_tenant_token(force_refresh=True)
        assert token == "forced-token"

    @patch("feishu_client.feishu_api.requests.Session")
    def test_get_token_api_error(self, mock_session_cls, mock_feishu_config):
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.post.return_value.json.return_value = {
            "code": 999,
            "msg": "invalid app",
        }

        client = FeishuAPIClient(mock_feishu_config)
        with pytest.raises(FeishuAPIError) as exc_info:
            client._get_tenant_token()
        assert exc_info.value.code == 999


class TestSearchUser:
    @patch("feishu_client.feishu_api.FeishuAPIClient._request")
    def test_search_user(self, mock_request, mock_feishu_config):
        mock_request.return_value = [
            {"user_id": "u123", "name": "Test User"}
        ]

        client = FeishuAPIClient(mock_feishu_config)
        users = client.search_user("test user")

        assert len(users) == 1
        assert users[0]["name"] == "Test User"
        mock_request.assert_called_once()

    @patch("feishu_client.feishu_api.FeishuAPIClient._request")
    def test_search_user_empty(self, mock_request, mock_feishu_config):
        mock_request.return_value = []

        client = FeishuAPIClient(mock_feishu_config)
        users = client.search_user("nonexistent")
        assert users == []


class TestSendMessage:
    @patch("feishu_client.feishu_api.FeishuAPIClient._request")
    def test_send_text_message(self, mock_request, mock_feishu_config):
        mock_request.return_value = {"message_id": "msg-123"}

        client = FeishuAPIClient(mock_feishu_config)
        result = client.send_text_message("user-abc", "Hello!")

        assert result == {"message_id": "msg-123"}
        call_args = mock_request.call_args
        assert call_args[1]["body"]["msg_type"] == "text"
        assert "Hello" in call_args[1]["body"]["content"]


class TestCreateTask:
    @patch("feishu_client.feishu_api.FeishuAPIClient._request")
    def test_create_task(self, mock_request, mock_feishu_config):
        mock_request.return_value = {"task_id": "task-456"}

        client = FeishuAPIClient(mock_feishu_config)
        result = client.create_task("Test Task", members=[{"user_id": "u123"}])

        assert result == {"task_id": "task-456"}
        call_args = mock_request.call_args
        assert call_args[1]["body"]["summary"] == "Test Task"
