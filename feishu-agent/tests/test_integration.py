import pytest
import os

SKIP_INTEGRATION = not os.getenv("INTEGRATION_TEST")


@pytest.mark.skipif(SKIP_INTEGRATION, reason="Requires INTEGRATION_TEST=1 env var")
class TestMCPIntegration:
    def test_list_workitems_real(self):
        from feishu_client.mcp import MCPClient, MCPConfig
        cfg = MCPConfig()
        cfg.mcp_key = os.getenv("FEISHU_PROJECT_MCP_KEY", "m-7704188c-ef20-451f-89f9-57e4824587a0")
        cfg.user_key = os.getenv("FEISHU_PROJECT_USER_KEY", "7481325171635240962")
        cfg.project_key = os.getenv("FEISHU_PROJECT_KEY", "67fe1cac42e0d54d282a3b4d")
        cfg.project_simple_name = os.getenv("FEISHU_PROJECT_SIMPLE_NAME", "ntv21m")
        client = MCPClient(cfg)
        items = client.list_workitems(page_size=5)
        assert len(items) >= 0

    def test_get_node_detail_real(self):
        from feishu_client.mcp import MCPClient, MCPConfig
        cfg = MCPConfig(
            mcp_key=os.getenv("FEISHU_PROJECT_MCP_KEY", "m-7704188c-ef20-451f-89f9-57e4824587a0"),
            user_key=os.getenv("FEISHU_PROJECT_USER_KEY", "7481325171635240962"),
            project_key=os.getenv("FEISHU_PROJECT_KEY", "67fe1cac42e0d54d282a3b4d"),
        )
        client = MCPClient(cfg)
        detail = client.get_node_detail("6640212074")
        assert "data" in detail

    @pytest.mark.skip(reason="Avoid spamming real API during tests")
    def test_add_comment_real(self):
        from feishu_client.mcp import MCPClient, MCPConfig
        cfg = MCPConfig(
            mcp_key=os.getenv("FEISHU_PROJECT_MCP_KEY", "m-7704188c-ef20-451f-89f9-57e4824587a0"),
            user_key=os.getenv("FEISHU_PROJECT_USER_KEY", "7481325171635240962"),
            project_key=os.getenv("FEISHU_PROJECT_KEY", "67fe1cac42e0d54d282a3b4d"),
        )
        client = MCPClient(cfg)
        result = client.add_comment("6640212074", "test comment")
        assert "data" in result
