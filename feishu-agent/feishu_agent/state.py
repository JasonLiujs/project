import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class StateManager:
    def __init__(self, state_file: str = "~/.feishu-agent/state.json"):
        self.state_file = os.path.expanduser(state_file)

    def load_state(self) -> Dict[str, Any]:
        if not os.path.exists(self.state_file):
            return {}
        try:
            with open(self.state_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}

    def save_state(self, state: Dict[str, Any]) -> None:
        try:
            os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
        except IOError as e:
            logger.error("Failed to save state: %s", e)

    def update_task_status(self, task_id: str, status: str) -> None:
        state = self.load_state()
        tasks = state.get("tasks", [])
        for task in tasks:
            if task.get("id") == task_id:
                task["status"] = status
                task["updated_at"] = datetime.now().isoformat()
                break
        state["tasks"] = tasks
        self.save_state(state)

    def add_task(self, task_id: str, status: str) -> None:
        state = self.load_state()
        tasks = state.get("tasks", [])
        tasks.append({
            "id": task_id,
            "status": status,
            "created_at": datetime.now().isoformat(),
        })
        state["tasks"] = tasks
        self.save_state(state)
