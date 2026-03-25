import os
from dataclasses import dataclass


@dataclass
class Config:
    feishu_project_mcp_key: str = ""
    feishu_project_user_key: str = ""
    feishu_project_key: str = ""
    feishu_project_simple_name: str = "ntv21m"
    feishu_app_id: str = ""
    feishu_app_secret: str = ""
    feishu_agent_state_file: str = "~/.feishu-agent/state.json"
    feishu_agent_log_file: str = "~/.feishu-agent/feishu-agent.log"
    feishu_agent_log_level: str = "INFO"
    ngrok_auth_token: str = ""
    ngrok_port: int = 8000

    def __post_init__(self):
        self.feishu_project_mcp_key = os.getenv("FEISHU_PROJECT_MCP_KEY", self.feishu_project_mcp_key)
        self.feishu_project_user_key = os.getenv("FEISHU_PROJECT_USER_KEY", self.feishu_project_user_key)
        self.feishu_project_key = os.getenv("FEISHU_PROJECT_KEY", self.feishu_project_key)
        self.feishu_project_simple_name = os.getenv("FEISHU_PROJECT_SIMPLE_NAME", self.feishu_project_simple_name)
        self.feishu_app_id = os.getenv("FEISHU_APP_ID", self.feishu_app_id)
        self.feishu_app_secret = os.getenv("FEISHU_APP_SECRET", self.feishu_app_secret)
        self.feishu_agent_state_file = os.getenv("FEISHU_AGENT_STATE_FILE", self.feishu_agent_state_file)
        self.feishu_agent_log_file = os.getenv("FEISHU_AGENT_LOG_FILE", self.feishu_agent_log_file)
        self.feishu_agent_log_level = os.getenv("FEISHU_AGENT_LOG_LEVEL", self.feishu_agent_log_level)
        self.ngrok_auth_token = os.getenv("NGROK_AUTH_TOKEN", self.ngrok_auth_token)
        ngrok_port = os.getenv("NGROK_PORT")
        if ngrok_port:
            self.ngrok_port = int(ngrok_port)


def load_config() -> Config:
    return Config()


_config: Config = None  # type: ignore


def get_config() -> Config:
    global _config
    if _config is None:
        _config = load_config()
    return _config
