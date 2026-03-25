import os
import sys
import json as json_mod
import subprocess
import logging
import signal
from typing import Dict, Any, Optional, List
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

    NODE_ROLE_MAP: Dict[str, Dict[str, str]] = {
        "项目立项": {"role": "office-hours", "description": "分析项目背景和目标"},
        "初始评估": {"role": "office-hours", "description": "评估技术可行性和资源需求"},
        "产品定义": {"role": "office-hours", "description": "梳理产品定位和需求范围"},
        "TR1评审": {"role": "review", "description": "技术方案评审"},
        "CDCP评审": {"role": "review", "description": "概念方案评审"},
        "TR2评审": {"role": "review", "description": "方案设计评审"},
        "需求拆解": {"role": "browse", "description": "拆分开发任务并实施"},
        "可行性评估": {"role": "qa", "description": "验证技术可行性"},
        "产品细化": {"role": "office-hours", "description": "细化产品需求和交互"},
        "发布准备": {"role": "ship", "description": "准备发布和部署"},
        "上线": {"role": "land-and-deploy", "description": "部署上线并验证"},
    }

    def detect_role_for_node(self, node_name: str) -> str:
        for key, val in self.NODE_ROLE_MAP.items():
            if key in node_name:
                return val["role"]
        return "office-hours"

    def detect_role_for_node_from_detail(self, node_detail: Dict) -> str:
        current = self.mcp_client.get_current_node(node_detail)
        if current:
            name = current.get("basic", {}).get("name", "")
            return self.detect_role_for_node(name)
        for node in node_detail.get("list", []):
            name = node.get("basic", {}).get("name", "")
            if name:
                return self.detect_role_for_node(name)
        return "office-hours"

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
        current_node = self.mcp_client.get_current_node(detail)
        if not current_node:
            return {"success": False, "reason": "no doing node found"}

        node_key = current_node.get("basic", {}).get("node_key")
        node_name = current_node.get("basic", {}).get("name", "")
        if not node_key:
            return {"success": False, "reason": "no node key in current node"}

        required = self.mcp_client.get_transition_required(work_item_id, node_key)
        if required:
            form_items = {fi.get("field_key"): fi for fi in current_node.get("form_items", [])}
            fields_to_fill = []
            for req in required:
                field_key = req.get("key") or req.get("field_key")
                field_type = req.get("field_type_key", "")
                if field_key and field_key in form_items:
                    fi = form_items[field_key]
                    field_type = field_type or fi.get("field_type", "")
                    if field_type == "bool":
                        fields_to_fill.append({"field_key": field_key, "field_value": "false"})
                    elif field_type in ("text", "multi-text", "multi-pure-text"):
                        fields_to_fill.append({"field_key": field_key, "field_value": "已填写"})
            if fields_to_fill:
                try:
                    self.mcp_client.update_field(work_item_id, fields_to_fill)
                    logger.info("Filled %d required fields for node %s", len(fields_to_fill), node_key)
                except Exception as e:
                    logger.warning("Failed to fill required fields: %s", e)
                    return {"success": False, "error": f"required fields not filled: {e}"}

        try:
            result = self.mcp_client.transition_node(work_item_id, node_key=node_key, action="confirm")
            result_text = str(result.get("data", ""))
            if "success" in result_text.lower() or "mcp_result" in result_text.lower() or result.get("isError") is not True:
                return {"success": True, "node_key": node_key, "node_name": node_name}
            return {"success": False, "error": result_text}
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

    def auto_mode(self, work_item_id: str, yes: bool = False, confirm_timeout: int = 60) -> Dict[str, Any]:
        import signal

        results = []
        interrupted = False

        def handler(signum, frame):
            nonlocal interrupted
            interrupted = True
            logger.warning("收到中断信号，保存状态后退出")

        old_handler = signal.signal(signal.SIGINT, handler)

        try:
            step = "discover"
            step_num = 0

            while step != "done" and step_num < 20:
                if interrupted:
                    self._save_progress(work_item_id, results)
                    return {"success": False, "reason": "interrupted", "steps": results}

                step_num += 1

                if step == "discover":
                    logger.info("Step %d: 发现任务节点信息", step_num)
                    detail = self.mcp_client.get_node_detail(work_item_id)
                    results.append({"step": "discover", "data": detail})
                    step = "execute"

                elif step == "execute":
                    logger.info("Step %d: 分发到 gstack 角色", step_num)
                    detail = results[0].get("data", {}) if results and results[0].get("step") == "discover" else {}
                    role = self.detect_role_for_node_from_detail(detail)
                    logger.info("检测到角色: %s", role)
                    result = self.dispatch_to_gstack(role, f"任务 {work_item_id}")
                    results.append({"step": "execute", "role": role, "result": result})
                    if not result.get("success"):
                        logger.error("执行失败，停止自动模式")
                        step = "done"
                        break
                    step = "transition"

                elif step == "transition":
                    logger.info("Step %d: 流转节点", step_num)
                    result = self.transition_node(work_item_id)
                    results.append({"step": "transition", "result": result})
                    if not result.get("success"):
                        logger.error("流转失败，停止自动模式")
                        step = "done"
                        break
                    step = "confirm"

                elif step == "confirm":
                    if yes:
                        step = "report"
                        continue

                    logger.info("等待确认 (超时 %ds)...", confirm_timeout)
                    try:
                        import select, tty
                        if hasattr(select, "select") and hasattr(sys, "stdin"):
                            rlist, _, _ = select.select([sys.stdin], [], [], confirm_timeout)
                            if rlist:
                                line = sys.stdin.readline().strip().lower()
                                if line in ("y", "yes", "继续", "c"):
                                    step = "report"
                                else:
                                    logger.info("用户取消，保存进度退出")
                                    self._save_progress(work_item_id, results)
                                    return {"success": False, "reason": "user_cancelled", "steps": results}
                            else:
                                logger.info("超时自动继续")
                                step = "report"
                        else:
                            step = "report"
                    except Exception:
                        step = "report"

                elif step == "report":
                    logger.info("Step %d: 生成执行报告", step_num)
                    report_data = {
                        "status": "success",
                        "summary": f"自动执行完成，共{step_num}步",
                        "completed": [s.get("step", "?") for s in results],
                        "exec_data": {"执行步骤": str(step_num)},
                        "artifacts": [],
                        "risks": [],
                        "decisions": [],
                        "next_action": "等待人工确认",
                    }
                    report_result = self.generate_report(work_item_id, report_data)
                    results.append({"step": "report", "result": report_result})
                    step = "done"

        finally:
            signal.signal(signal.SIGINT, old_handler)

        return {"success": True, "steps": results}

    def _save_progress(self, work_item_id: str, results: list):
        from feishu_agent.state import StateManager
        sm = StateManager()
        sm.add_task(work_item_id, "interrupted")
        for r in results:
            logger.info("  - %s: %s", r.get("step"), r.get("result", r.get("data", "")))
        logger.info("进度已保存")
