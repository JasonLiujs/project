import os
import time
import json
import random
import logging
import requests
from typing import Any, Optional, List, Dict, Generator
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class MCPConfig:
    url: str = "https://project.feishu.cn/mcp_server/v1"
    mcp_key: str = ""
    user_key: str = ""
    project_key: str = ""
    project_simple_name: str = "ntv21m"
    timeout: int = 30
    max_retries: int = 3
    base_delay: float = 1.0

    def __post_init__(self):
        self.mcp_key = self.mcp_key or os.getenv("FEISHU_PROJECT_MCP_KEY", "")
        self.user_key = self.user_key or os.getenv("FEISHU_PROJECT_USER_KEY", "")
        self.project_key = self.project_key or os.getenv("FEISHU_PROJECT_KEY", "")
        self.project_simple_name = self.project_simple_name or os.getenv("FEISHU_PROJECT_SIMPLE_NAME", "ntv21m")


class MCPError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"MCP Error {code}: {message}")


class RateLimitError(MCPError):
    pass


class MCPClient:
    def __init__(self, config: Optional[MCPConfig] = None):
        self.config = config or MCPConfig()
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})

    def _build_url(self) -> str:
        return f"{self.config.url}?mcpKey={self.config.mcp_key}&userKey={self.config.user_key}"

    def _call_raw(self, method: str, params: dict) -> dict:
        url = self._build_url()
        payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
        response = self._session.post(url, json=payload, timeout=self.config.timeout)
        response.raise_for_status()
        return response.json()

    def _call(self, tool_name: str, arguments: dict) -> dict:
        result = self._call_raw("tools/call", {"name": tool_name, "arguments": arguments})
        if "error" in result:
            error = result["error"]
            code = error.get("code", -1)
            msg = error.get("message", str(error))
            if code == 429:
                raise RateLimitError(code, msg)
            raise MCPError(code, msg)

        rpc_result = result.get("result", {})
        content_list = rpc_result.get("content", [])
        is_error = rpc_result.get("isError", False)

        if is_error and content_list:
            text = content_list[0].get("text", "")
            code_match = text.split(",")[0] if text else "-1"
            code = int(code_match.split("=")[1]) if "=" in code_match else -1
            raise MCPError(code, text)

        if content_list:
            text = content_list[0].get("text", "")
            try:
                return {"data": json.loads(text)}
            except (json.JSONDecodeError, TypeError):
                return {"data": text}
        return rpc_result

    def _retry_call(self, tool_name: str, arguments: dict) -> dict:
        for attempt in range(self.config.max_retries):
            try:
                return self._call(tool_name, arguments)
            except RateLimitError:
                delay = min(self.config.base_delay * (2 ** attempt) + random.uniform(0, 1), 60)
                logger.warning(f"Rate limited, retrying in {delay:.1f}s")
                time.sleep(delay)
            except MCPError:
                raise
            except requests.exceptions.Timeout:
                if attempt < self.config.max_retries - 1:
                    delay = self.config.base_delay * (2 ** attempt)
                    logger.warning(f"Timeout, retrying in {delay:.1f}s")
                    time.sleep(delay)
                else:
                    raise
            except requests.exceptions.RequestException as e:
                if attempt < self.config.max_retries - 1:
                    delay = self.config.base_delay * (2 ** attempt)
                    logger.warning(f"Request error: {e}, retrying in {delay:.1f}s")
                    time.sleep(delay)
                else:
                    raise
        raise MCPError(-1, "Max retries exceeded")

    def list_workitems_mql(
        self,
        work_item_type: Optional[str] = None,
        filters: Optional[List[Dict]] = None,
        orders: Optional[List[Dict]] = None,
        page_size: int = 50,
        project_key: Optional[str] = None,
    ) -> List[Dict]:
        project_key = project_key or self.config.project_key
        project_simple_name = self.config.project_simple_name or "ntv21m"
        all_items = []
        page_token = ""

        while True:
            table = f"{project_simple_name}.{work_item_type or 'story'}"
            where_clauses = []
            if filters:
                for f in filters:
                    field = f.get("field_key", "")
                    op = f.get("operator", "=")
                    val = str(f.get("field_value", ""))
                    if op == "contains":
                        where_clauses.append(f'{field} like "%{val}%"')
                    elif op == "=":
                        where_clauses.append(f'{field} = "{val}"')
                    elif op == "!=":
                        where_clauses.append(f'{field} != "{val}"')
                    elif op == "in":
                        vals = ",".join(f'"{v}"' for v in f.get("field_value", []))
                        where_clauses.append(f"{field} in ({vals})")

            mql = f"SELECT name FROM {table}"
            if where_clauses:
                mql += " WHERE " + " AND ".join(where_clauses)
            if orders:
                order_parts = []
                for o in orders:
                    field = o.get("field_key", "")
                    direction = o.get("direction", "asc").upper()
                    order_parts.append(f"{field} {direction}")
                mql += " ORDER BY " + ", ".join(order_parts)
            mql += f" LIMIT {page_size}"

            arguments: Dict[str, Any] = {
                "project_key": project_key,
                "mql": mql,
            }
            if page_token:
                arguments["page_token"] = page_token

            result = self._retry_call("search_by_mql", arguments)
            parsed = result.get("data", {})
            all_group_ids = set()
            list_data = parsed.get("list", []) if isinstance(parsed, dict) else []

            for group in list_data:
                for gi in group.get("group_infos", []):
                    all_group_ids.add(str(gi.get("group_id", "")))

            rows_map = parsed.get("data", {}) if isinstance(parsed, dict) else {}
            for gid in all_group_ids:
                rows = rows_map.get(gid, [])
                if isinstance(rows, list):
                    for row in rows:
                        item = {}
                        for field_entry in row.get("moql_field_list", []):
                            k = field_entry.get("key", "")
                            v = field_entry.get("value", {})
                            if isinstance(v, dict):
                                val = v.get("string_value") or v.get("int_value") or v.get("bool_value") or str(v)
                            else:
                                val = v
                            item[k] = val
                        if item:
                            all_items.append(item)

            page_token = parsed.get("page_token", "") if isinstance(parsed, dict) else ""
            if not page_token:
                break

            time.sleep(random.uniform(0.1, 0.3))

        logger.info(f"Fetched {len(all_items)} workitems via MQL")
        return all_items

    def list_workitems(
        self,
        work_item_type: Optional[str] = None,
        filters: Optional[List[Dict]] = None,
        orders: Optional[List[Dict]] = None,
        page_size: int = 50,
        project_key: Optional[str] = None,
    ) -> List[Dict]:
        return self.list_workitems_mql(work_item_type, filters, orders, page_size, project_key)

    def get_workitem_brief(
        self,
        work_item_id: str,
        fields: Optional[List[str]] = None,
        project_key: Optional[str] = None,
    ) -> Dict:
        return self._retry_call("get_workitem_brief", {
            "project_key": project_key or self.config.project_key,
            "work_item_id": work_item_id,
            "fields": fields,
        })

    def update_field(
        self,
        work_item_id: str,
        fields: List[Dict],
        work_item_type: Optional[str] = None,
        project_key: Optional[str] = None,
    ) -> Dict:
        return self._retry_call("update_field", {
            "project_key": project_key or self.config.project_key,
            "work_item_id": work_item_id,
            "work_item_type": work_item_type,
            "fields": fields,
        })

    def get_transitable_states(
        self,
        work_item_id: str,
        work_item_type: Optional[str] = None,
        project_key: Optional[str] = None,
    ) -> List[str]:
        result = self._retry_call("get_transitable_states", {
            "project_key": project_key or self.config.project_key,
            "work_item_id": work_item_id,
            "work_item_type": work_item_type,
            "user_key": self.config.user_key,
        })
        return result.get("data", {}).get("states", [])

    def get_transition_required(
        self,
        work_item_id: str,
        state_key: str,
        project_key: Optional[str] = None,
    ) -> List[Dict]:
        result = self._retry_call("get_transition_required", {
            "project_key": project_key or self.config.project_key,
            "work_item_id": work_item_id,
            "state_key": state_key,
        })
        return result.get("data", {}).get("required_fields", [])

    def add_comment(
        self,
        work_item_id: str,
        comment_content: str,
        project_key: Optional[str] = None,
    ) -> Dict:
        return self._retry_call("add_comment", {
            "project_key": project_key or self.config.project_key,
            "work_item_id": work_item_id,
            "comment_content": comment_content,
        })

    def get_node_detail(
        self,
        work_item_id: str,
        mode: str = "_all",
        project_key: Optional[str] = None,
    ) -> Dict:
        return self._retry_call("get_node_detail", {
            "project_key": project_key or self.config.project_key,
            "work_item_id": work_item_id,
        })

    def transition_node(
        self,
        work_item_id: str,
        target_state: str,
        work_item_type: Optional[str] = None,
        project_key: Optional[str] = None,
    ) -> Dict:
        return self._retry_call("transition_node", {
            "project_key": project_key or self.config.project_key,
            "work_item_id": work_item_id,
            "work_item_type": work_item_type,
            "target_state": target_state,
        })

    def list_workitem_field_config(
        self,
        work_item_type: str,
        field_keys: Optional[List[str]] = None,
        project_key: Optional[str] = None,
    ) -> Dict:
        params: Dict[str, Any] = {
            "project_key": project_key or self.config.project_key,
            "work_item_type": work_item_type,
        }
        if field_keys:
            params["field_keys"] = field_keys
        return self._retry_call("list_workitem_field_config", params)

    def search_user_info(
        self,
        user_ids: Optional[List[str]] = None,
        emails: Optional[List[str]] = None,
        project_key: Optional[str] = None,
    ) -> List[Dict]:
        params: Dict[str, Any] = {"project_key": project_key or self.config.project_key}
        if user_ids:
            params["user_ids"] = user_ids
        if emails:
            params["emails"] = emails
        result = self._retry_call("search_user_info", params)
        data = result.get("data", {})
        if isinstance(data, list):
            return data
        return data.get("users", [])

    def list_workitem_types(
        self,
        project_key: Optional[str] = None,
    ) -> List[Dict]:
        result = self._retry_call("list_workitem_types", {
            "project_key": project_key or self.config.project_key,
        })
        return result.get("data", {}).get("work_item_types", [])
