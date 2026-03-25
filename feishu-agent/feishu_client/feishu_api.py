import os
import time
import logging
import requests
from typing import Any, Optional, Dict, List
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

FEISHU_OPEN_API_BASE = "https://open.feishu.cn"


@dataclass
class FeishuAPIConfig:
    app_id: str = ""
    app_secret: str = ""
    timeout: int = 30

    def __post_init__(self):
        self.app_id = self.app_id or os.getenv("FEISHU_APP_ID", "")
        self.app_secret = self.app_secret or os.getenv("FEISHU_APP_SECRET", "")


class FeishuAPIError(Exception):
    def __init__(self, code: int, msg: str):
        self.code = code
        self.msg = msg
        super().__init__(f"FeishuAPI Error {code}: {msg}")


class FeishuAPIClient:
    _TOKEN_EXPIRY_SECONDS = 7200

    def __init__(self, config: Optional[FeishuAPIConfig] = None):
        self.config = config or FeishuAPIConfig()
        self._tenant_token: str = ""
        self._token_expires_at: Optional[datetime] = None
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})

    def _get_tenant_token(self, force_refresh: bool = False) -> str:
        if not force_refresh and self._tenant_token:
            if self._token_expires_at and datetime.now() < self._token_expires_at - timedelta(minutes=5):
                return self._tenant_token

        url = f"{FEISHU_OPEN_API_BASE}/open-apis/auth/v3/tenant_access_token/internal"
        payload = {
            "app_id": self.config.app_id,
            "app_secret": self.config.app_secret,
        }

        response = self._session.post(url, json=payload, timeout=self.config.timeout)
        response.raise_for_status()
        result = response.json()

        if result.get("code") != 0:
            raise FeishuAPIError(result.get("code", -1), result.get("msg", "Failed to get token"))

        self._tenant_token = result["tenant_access_token"]
        expires_in = result.get("expire", self._TOKEN_EXPIRY_SECONDS)
        self._token_expires_at = datetime.now() + timedelta(seconds=expires_in)
        logger.info("Tenant token refreshed, expires at %s", self._token_expires_at)
        return self._tenant_token

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        body: Optional[Dict] = None,
        token: Optional[str] = None,
    ) -> Dict:
        url = f"{FEISHU_OPEN_API_BASE}{path}"
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        else:
            headers["Authorization"] = f"Bearer {self._get_tenant_token()}"

        response = self._session.request(
            method=method,
            url=url,
            params=params,
            json=body,
            headers=headers,
            timeout=self.config.timeout,
        )
        response.raise_for_status()
        result = response.json()

        if result.get("code") != 0:
            raise FeishuAPIError(result.get("code", -1), result.get("msg", "API request failed"))

        return result.get("data", {})

    def search_user(
        self,
        query: str,
        page_size: int = 10,
        user_id_type: str = "open_id",
    ) -> List[Dict]:
        data = self._request(
            "POST",
            "/contact/v3/users/search",
            body={
                "query": query,
                "page_size": page_size,
                "user_id_type": user_id_type,
            }
        )
        if isinstance(data, list):
            return data
        return data.get("users", []) if isinstance(data, dict) else []

    def send_message(
        self,
        receive_id: str,
        msg_type: str,
        content: str,
        receive_id_type: str = "open_id",
    ) -> Dict:
        return self._request(
            "POST",
            "/im/v1/messages",
            params={"receive_id_type": receive_id_type},
            body={
                "receive_id": receive_id,
                "msg_type": msg_type,
                "content": content,
            }
        )

    def send_text_message(self, receive_id: str, text: str, receive_id_type: str = "open_id") -> Dict:
        return self.send_message(receive_id, "text", f'{{"text":"{text}"}}', receive_id_type)

    def create_task(
        self,
        summary: str,
        members: Optional[List[Dict]] = None,
        due: Optional[Dict] = None,
        origin: Optional[Dict] = None,
    ) -> Dict:
        body: Dict[str, Any] = {"summary": summary}
        if members:
            body["members"] = members
        if due:
            body["due"] = due
        if origin:
            body["origin"] = origin
        return self._request("POST", "/task/v2/tasks", body=body)

    def get_node_transitions(self, work_item_id: str) -> List[Dict]:
        data = self._request(
            "GET",
            f"/project/v2/workitems/{work_item_id}/transitions",
        )
        if isinstance(data, list):
            return data
        return []
