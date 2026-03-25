import pytest
import os
from unittest.mock import MagicMock, patch


@pytest.fixture
def mock_config():
    from feishu_client.mcp import MCPConfig
    cfg = MCPConfig(
        mcp_key="test-mcp-key",
        user_key="test-user-key",
        project_key="test-project-key",
        project_simple_name="testproj",
        timeout=5,
        max_retries=2,
        base_delay=0.01,
    )
    return cfg


@pytest.fixture
def mock_response():
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "content": [],
            "isError": False,
        }
    }


@pytest.fixture
def mock_error_response():
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "content": [
                {"type": "text", "text": "id=100,name=Test Error"}
            ],
            "isError": True,
        }
    }


@pytest.fixture
def mock_feishu_config():
    from feishu_client.feishu_api import FeishuAPIConfig
    return FeishuAPIConfig(
        app_id="test-app-id",
        app_secret="test-app-secret",
        timeout=5,
    )
