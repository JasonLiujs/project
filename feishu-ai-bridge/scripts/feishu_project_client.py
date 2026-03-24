#!/usr/bin/env python3
"""
飞书项目 MCP 客户端封装
用于飞书 AI 自动化系统的 API 调用
"""

import os
import json
import requests
from typing import Any, Optional, List, Dict, Union
from datetime import datetime


class FeishuProjectClient:
    """飞书项目 MCP 客户端"""
    
    def __init__(
        self,
        mcp_url: str = "https://project.feishu.cn/mcp_server/v1",
        mcp_key: Optional[str] = None,
        user_key: Optional[str] = None,
        project_key: Optional[str] = None
    ):
        self.mcp_url = mcp_url
        self.mcp_key = mcp_key or os.getenv("FEISHU_PROJECT_MCP_KEY", "m-7704188c-ef20-451f-89f9-57e4824587a0")
        self.user_key = user_key or os.getenv("FEISHU_PROJECT_USER_KEY", "7481325171635240962")
        self.project_key = project_key or os.getenv("FEISHU_PROJECT_KEY", "ntv21m")
        
    def _build_url(self) -> str:
        return f"{self.mcp_url}?mcpKey={self.mcp_key}&userKey={self.user_key}"
    
    def call_tool(self, tool_name: str, arguments: dict) -> dict:
        """调用 MCP 工具"""
        url = self._build_url()
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    
    def create_workitem(
        self,
        work_item_type: str,
        fields: List[Dict],
        project_key: Optional[str] = None
    ) -> dict:
        """创建工作项"""
        return self.call_tool("create_workitem", {
            "project_key": project_key or self.project_key,
            "work_item_type": work_item_type,
            "fields": fields
        })
    
    def update_workitem(
        self,
        work_item_id: str,
        fields: List[Dict],
        work_item_type: Optional[str] = None,
        project_key: Optional[str] = None
    ) -> dict:
        """更新工作项"""
        return self.call_tool("update_workitem", {
            "project_key": project_key or self.project_key,
            "work_item_id": work_item_id,
            "work_item_type": work_item_type,
            "fields": fields
        })
    
    def update_workitem_fields(
        self,
        work_item_id: str,
        fields: List[Dict],
        work_item_type: Optional[str] = None,
        project_key: Optional[str] = None
    ) -> dict:
        """更新工作项字段"""
        return self.call_tool("update_workitem_fields", {
            "project_key": project_key or self.project_key,
            "work_item_id": work_item_id,
            "work_item_type": work_item_type,
            "fields": fields
        })
    
    def update_workitem_schedule(
        self,
        work_item_id: str,
        schedule: Optional[str] = None,
        schedule_start: Optional[str] = None,
        schedule_end: Optional[str] = None,
        work_item_type: Optional[str] = None,
        project_key: Optional[str] = None
    ) -> dict:
        """更新工作项排期"""
        params = {
            "project_key": project_key or self.project_key,
            "work_item_id": work_item_id,
            "work_item_type": work_item_type
        }
        if schedule:
            params["schedule"] = schedule
        if schedule_start:
            params["schedule_start"] = schedule_start
        if schedule_end:
            params["schedule_end"] = schedule_end
        return self.call_tool("update_workitem_schedule", params)
    
    def get_workitem_brief(
        self,
        work_item_id: str,
        fields: Optional[List[str]] = None,
        project_key: Optional[str] = None
    ) -> dict:
        """获取工作项概要"""
        return self.call_tool("get_workitem_brief", {
            "project_key": project_key or self.project_key,
            "work_item_id": work_item_id,
            "fields": fields
        })
    
    def list_workitems(
        self,
        work_item_type: Optional[str] = None,
        filters: Optional[List[Dict]] = None,
        orders: Optional[List[Dict]] = None,
        page_size: int = 50,
        page_num: int = 1,
        project_key: Optional[str] = None
    ) -> dict:
        """列出工作项"""
        params = {
            "project_key": project_key or self.project_key,
            "page_size": page_size,
            "page_num": page_num
        }
        if work_item_type:
            params["work_item_type"] = work_item_type
        if filters:
            params["filters"] = filters
        if orders:
            params["orders"] = orders
        return self.call_tool("list_workitems", params)
    
    def list_workitem_field_config(
        self,
        work_item_type: str,
        field_keys: Optional[List[str]] = None,
        field_types: Optional[List[str]] = None,
        project_key: Optional[str] = None
    ) -> dict:
        """获取工作项字段配置"""
        params: Dict[str, Any] = {
            "project_key": project_key or self.project_key,
            "work_item_type": work_item_type
        }
        if field_keys:
            params["field_keys"] = field_keys
        if field_types:
            params["field_types"] = field_types
        return self.call_tool("list_workitem_field_config", params)
    
    def get_transitable_states(
        self,
        work_item_id: str,
        work_item_type: str,
        user_key: Optional[str] = None,
        project_key: Optional[str] = None
    ) -> dict:
        """获取可流转状态"""
        return self.call_tool("get_transitable_states", {
            "project_key": project_key or self.project_key,
            "work_item_id": work_item_id,
            "work_item_type": work_item_type,
            "user_key": user_key or self.user_key
        })
    
    def get_transition_required(
        self,
        work_item_id: str,
        state_key: str,
        mode: Optional[str] = None,
        project_key: Optional[str] = None
    ) -> dict:
        """获取流转必填信息"""
        params = {
            "project_key": project_key or self.project_key,
            "work_item_id": work_item_id,
            "state_key": state_key
        }
        if mode:
            params["mode"] = mode
        return self.call_tool("get_transition_required", params)
    
    def add_comment(
        self,
        work_item_id: str,
        comment_content: str,
        project_key: Optional[str] = None
    ) -> dict:
        """添加评论"""
        return self.call_tool("add_comment", {
            "project_key": project_key or self.project_key,
            "work_item_id": work_item_id,
            "comment_content": comment_content
        })
    
    def list_schedule(
        self,
        user_keys: List[str],
        start_time: str,
        end_time: str,
        work_item_type_keys: Optional[List[str]] = None,
        project_key: Optional[str] = None
    ) -> dict:
        """获取排期"""
        params = {
            "project_key": project_key or self.project_key,
            "user_keys": user_keys,
            "start_time": start_time,
            "end_time": end_time
        }
        if work_item_type_keys:
            params["work_item_type_keys"] = work_item_type_keys
        return self.call_tool("list_schedule", params)


def datetime_to_ms(dt: datetime) -> int:
    """datetime 转毫秒时间戳"""
    return int(dt.timestamp() * 1000)


def ms_to_datetime(ms: int) -> datetime:
    """毫秒时间戳转 datetime"""
    return datetime.fromtimestamp(ms / 1000)


def format_schedule(start: datetime, end: datetime) -> str:
    """格式化排期字符串"""
    return f"{start.strftime('%Y-%m-%d')},{end.strftime('%Y-%m-%d')}"


def parse_schedule(schedule: str) -> tuple:
    """解析排期字符串"""
    parts = schedule.split(",")
    return datetime.strptime(parts[0], "%Y-%m-%d"), datetime.strptime(parts[1], "%Y-%m-%d")


# 便捷函数
client = FeishuProjectClient()


def create_story(title: str, template_id: str, **fields) -> dict:
    """创建需求工作项"""
    fields_list = [{"field_key": "title", "field_value": title}]
    fields_list.append({"field_key": "template", "field_value": template_id})
    for key, value in fields.items():
        fields_list.append({"field_key": key, "field_value": value})
    return client.create_workitem("story", fields_list)


def set_dependencies(work_item_id: str, dependency_ids: list) -> dict:
    """设置依赖关系"""
    return client.update_workitem_fields(work_item_id, [
        {"field_key": "field_19320a", "field_value": dependency_ids}
    ])


def get_today_sprint() -> dict:
    """获取今日迭代"""
    today = datetime.now().strftime("%Y-%m-%d")
    result = client.list_workitems(
        work_item_type="sprint",
        filters=[{
            "field_key": "name",
            "operator": "contains",
            "field_value": today
        }]
    )
    return result


if __name__ == "__main__":
    # 测试连接
    print("测试飞书项目 MCP 客户端...")
    
    # 获取字段配置
    result = client.list_workitem_field_config("story")
    print(f"获取字段配置: {json.dumps(result, ensure_ascii=False)[:500]}...")
