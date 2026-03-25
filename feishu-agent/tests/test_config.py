import pytest
import os
from unittest.mock import patch


class TestConfig:
    def test_load_config_default(self):
        from feishu_agent.config import Config
        cfg = Config()
        assert cfg.feishu_project_simple_name == "ntv21m"
        assert cfg.ngrok_port == 8000

    def test_load_config_env_override(self):
        with patch.dict(os.environ, {
            "FEISHU_PROJECT_MCP_KEY": "env-mcp-key",
            "FEISHU_PROJECT_USER_KEY": "env-user-key",
            "FEISHU_APP_ID": "env-app-id",
            "NGROK_PORT": "9000",
        }):
            from feishu_agent.config import Config
            cfg = Config()
            assert cfg.feishu_project_mcp_key == "env-mcp-key"
            assert cfg.feishu_project_user_key == "env-user-key"
            assert cfg.feishu_app_id == "env-app-id"
            assert cfg.ngrok_port == 9000

    def test_get_config_singleton(self):
        from feishu_agent import config
        config._config = None
        c1 = config.get_config()
        c2 = config.get_config()
        assert c1 is c2
