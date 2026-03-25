import os
import sys
import json
import logging
import signal
import subprocess
import time
import threading
from typing import Optional
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from feishu_agent.config import get_config
from feishu_agent.orchestrator import Orchestrator

logger = logging.getLogger("feishu-agent.webhook")


class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if not self.path.startswith("/webhook/feishu"):
            self.send_error(404)
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            event = json.loads(body.decode("utf-8"))
            logger.info("收到事件: %s", json.dumps(event, ensure_ascii=False)[:200])
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"code": 0, "msg": "ok"}).encode())

            threading.Thread(target=self._handle_event, args=(event,), daemon=True).start()
        except Exception as e:
            logger.error("处理 webhook 失败: %s", e)
            self.send_response(500)
            self.end_headers()

    def _handle_event(self, event: dict):
        try:
            event_type = event.get("event", {}).get("type", "")
            if event_type == "workitem.status_changed":
                work_item_id = event.get("event", {}).get("work_item", {}).get("id", "")
                logger.info("工作项状态变更: %s", work_item_id)
            elif event_type == "workitem.updated":
                work_item_id = event.get("event", {}).get("work_item", {}).get("id", "")
                logger.info("工作项更新: %s", work_item_id)
            else:
                logger.info("未处理的事件类型: %s", event_type)
        except Exception as e:
            logger.exception("处理事件失败: %s", e)

    def log_message(self, format, *args):
        logger.info(format, *args)


def find_available_port(start: int = 8000) -> int:
    import socket
    for port in range(start, start + 100):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind(("127.0.0.1", port))
            s.close()
            return port
        except OSError:
            continue
    raise RuntimeError("无可用端口")


class NgrokManager:
    def __init__(self, port: int, auth_token: str = ""):
        self.port = port
        self.auth_token = auth_token
        self.process: Optional[subprocess.Popen] = None
        self.public_url: Optional[str] = None

    def start(self) -> str:
        import requests
        cmd = ["ngrok", "http", str(self.port), "--log", "stdout"]
        if self.auth_token:
            cmd.extend(["--authtoken", self.auth_token])

        log_file = open("/tmp/ngrok.log", "w")
        self.process = subprocess.Popen(
            cmd,
            stdout=log_file,
            stderr=subprocess.DEVNULL,
        )

        logger.info("ngrok 启动中，PID: %d", self.process.pid)

        for _ in range(30):
            try:
                resp = requests.get("http://localhost:4040/api/tunnels", timeout=2)
                tunnels = resp.json().get("tunnels", [])
                for t in tunnels:
                    if t.get("proto") == "https":
                        self.public_url = t["public_url"]
                        logger.info("ngrok 公网地址: %s", self.public_url)
                        return self.public_url
            except Exception:
                pass
            time.sleep(1)

        raise RuntimeError("ngrok 启动超时")

    def stop(self):
        if self.process:
            self.process.terminate()
            self.process.wait(timeout=5)
            logger.info("ngrok 已停止")


def setup_logging(verbose: bool = False):
    cfg = get_config()
    level = logging.DEBUG if verbose else getattr(logging, cfg.feishu_agent_log_level, logging.INFO)
    log_file = os.path.expanduser(cfg.feishu_agent_log_file)
    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    logging.basicConfig(
        level=level,
        format="%(asctime)s — %(levelname)s — %(name)s — %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stderr),
        ],
    )


def main():
    import argparse
    parser = argparse.ArgumentParser(description="飞书 AI Agent Webhook 服务")
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--no-ngrok", action="store_true", help="不启动 ngrok（仅本地测试）")
    parser.add_argument("--port", type=int, default=0, help="监听端口（0=自动）")
    args = parser.parse_args()

    setup_logging(args.verbose)
    cfg = get_config()

    port = args.port or find_available_port(cfg.ngrok_port)
    logger.info("启动 Webhook 服务，端口: %d", port)

    server = HTTPServer(("0.0.0.0", port), WebhookHandler)

    ngrok: Optional[NgrokManager] = None
    if not args.no_ngrok:
        if not cfg.ngrok_auth_token:
            logger.warning("未配置 NGROK_AUTH_TOKEN，跳过 ngrok 启动")
        else:
            ngrok = NgrokManager(port, cfg.ngrok_auth_token)
            public_url = ngrok.start()
            logger.info("=" * 50)
            logger.info("公网 Webhook 地址: %s/webhook/feishu", public_url)
            logger.info("在飞书开放平台配置此地址")
            logger.info("=" * 50)

    def shutdown(signum, frame):
        logger.info("收到退出信号，正在关闭...")
        if ngrok:
            ngrok.stop()
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    logger.info("服务运行中，http://localhost:%d/webhook/feishu", port)
    server.serve_forever()


if __name__ == "__main__":
    main()
