import os
import json as json_mod
import subprocess
import logging
from typing import Dict, Any, Optional
from feishu_client.mcp import MCPClient, MCPConfig
from feishu_client.feishu_api import FeishuAPIClient, FeishuAPIConfig

logger = logging.getLogger(__name__)

REPORT_TEMPLATE = """
## Agent 执行报告

**工作项**: [{work_item_id}](https://project.feishu.cn/ntv21m/work_items/{work_item_id})
**执行时间**: {timestamp}
**执行状态**: {status_icon} {status}

---

### 执行摘要
{executor_summary}

### 完成内容
{completed_items}

### 执行数据
| 指标 | 值 |
|------|-----|
{exec_data}

### 产物
{artifacts}

### 风险项
{risks}

### 决策记录
{decisions}

### 下一步
> {next_action}
"""


class Orchestrator:
    def __init__(self):
        self.mcp_client = MCPClient()
        self.feishu_client = FeishuAPIClient()

    def list_tasks(self, filters: Optional[Dict] = None) -> list:
        items = self.mcp_client.list_workitems()
        return items

    def claim_task(self, work_item_id: str, user_key: str) -> Dict[str, Any]:
        try:
            self.mcp_client.update_field(work_item_id, [
                {"field_key": "field_assigned", "field_value": user_key}
            ])
            return {"claimed": True, "work_item_id": work_item_id}
        except Exception as e:
            logger.error("Failed to claim task %s: %s", work_item_id, e)
            return {"claimed": False, "error": str(e)}

    def transition_node(self, work_item_id: str) -> Dict[str, Any]:
        detail = self.mcp_client.get_node_detail(work_item_id)
        data = detail.get("data", {})
        node_list = data.get("list", [])
        if not node_list:
            return {"success": False, "reason": "no node info"}

        states = self.mcp_client.get_transitable_states(work_item_id)
        if not states:
            return {"success": False, "reason": "no transitable state"}

        try:
            self.mcp_client.transition_node(work_item_id, states[0])
            return {"success": True, "target_state": states[0]}
        except Exception as e:
            logger.error("Failed to transition node %s: %s", work_item_id, e)
            return {"success": False, "error": str(e)}

    def dispatch_to_gstack(self, role: str, task_description: str) -> Dict[str, Any]:
        import subprocess
        import json as json_mod

        cmd = ["gstack", role, task_description]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
            )
            if result.returncode == 0:
                try:
                    output = json_mod.loads(result.stdout)
                except json_mod.JSONDecodeError:
                    output = {"raw": result.stdout}
                return {"success": True, "result": output}
            else:
                return {"success": False, "error": result.stderr}
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "gstack timeout"}
        except (FileNotFoundError, OSError):
            return {"success": False, "error": "gstack not found in PATH"}

    def generate_report(self, work_item_id: str, report_data: Dict[str, Any]) -> Dict[str, Any]:
        from datetime import datetime

        status = report_data.get("status", "success")
        status_icon_map = {
            "success": "✅",
            "partial": "⚠️",
            "failure": "❌",
            "timeout": "⏳",
            "interrupted": "🔄",
        }
        status_icon = status_icon_map.get(status, "❓")

        completed_items = "\n".join(f"- [x] {c}" for c in report_data.get("completed", []))
        exec_data = "\n".join(f"| {k} | {v} |" for k, v in report_data.get("exec_data", {}).items())
        artifacts = "\n".join(f"- [{a.get('type', 'link')}]({a.get('url', '#')})" for a in report_data.get("artifacts", []))
        risks = "\n".join(f"- {r}" for r in report_data.get("risks", []))
        decisions = "\n".join(f"- {d}" for d in report_data.get("decisions", []))

        body = REPORT_TEMPLATE.format(
            work_item_id=work_item_id,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M"),
            status_icon=status_icon,
            status=status.upper(),
            executor_summary=report_data.get("summary", ""),
            completed_items=completed_items or "- 无",
            exec_data=exec_data or "| — | — |",
            artifacts=artifacts or "- 无",
            risks=risks or "- 无",
            decisions=decisions or "- 无",
            next_action=report_data.get("next_action", "—"),
        )

        try:
            self.mcp_client.add_comment(work_item_id, body)
            return {"success": True, "status": status, "report": body}
        except Exception as e:
            logger.error("Failed to post report: %s", e)
            return {"success": False, "error": str(e), "status": status, "report": body}

    def auto_mode(self, work_item_id: str, yes: bool = False) -> Dict[str, Any]:
        step = "discover"
        results = []

        for _ in range(10):
            if step == "discover":
                detail = self.mcp_client.get_node_detail(work_item_id)
                step = "execute"
                results.append({"step": "discover", "detail": detail})

            elif step == "execute":
                role = "office-hours"
                result = self.dispatch_to_gstack(role, f"任务 {work_item_id}")
                results.append({"step": "execute", "result": result})
                if not result.get("success"):
                    break
                step = "transition"

            elif step == "transition":
                result = self.transition_node(work_item_id)
                results.append({"step": "transition", "result": result})
                if not result.get("success"):
                    break
                step = "report"

            elif step == "report":
                report_data = {
                    "status": "success",
                    "summary": "自动执行完成",
                    "completed": ["分析任务", "流转节点"],
                    "exec_data": {"执行步骤": str(len(results))},
                    "artifacts": [],
                    "risks": [],
                    "decisions": [],
                    "next_action": "等待人工确认",
                }
                report_result = self.generate_report(work_item_id, report_data)
                results.append({"step": "report", "result": report_result})
                break

        return {"success": True, "steps": results}
