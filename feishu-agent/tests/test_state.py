import pytest
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch, Mock


class TestStateSave:
    def test_save_state_creates_file(self):
        from feishu_agent.state import StateManager
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "state.json")
            sm = StateManager(state_file)
            sm.save_state({"tasks": [{"id": "123", "status": "done"}]})
            assert os.path.exists(state_file)
            with open(state_file) as f:
                data = json.load(f)
            assert data["tasks"][0]["id"] == "123"

    def test_save_state_overwrites(self):
        from feishu_agent.state import StateManager
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "state.json")
            sm = StateManager(state_file)
            sm.save_state({"count": 1})
            sm.save_state({"count": 2})
            with open(state_file) as f:
                data = json.load(f)
            assert data["count"] == 2

    def test_save_state_cannot_read_returns_empty(self):
        from feishu_agent.state import StateManager
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "state.json")
            sm = StateManager(state_file)
            sm.save_state({"data": "test"})
            loaded = sm.load_state()
            assert loaded.get("data") == "test"


class TestStateLoad:
    def test_load_state_empty_file(self):
        from feishu_agent.state import StateManager
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "state.json")
            Path(state_file).touch()
            sm = StateManager(state_file)
            state = sm.load_state()
            assert state == {}

    def test_load_state_missing_file(self):
        from feishu_agent.state import StateManager
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "nonexistent.json")
            sm = StateManager(state_file)
            state = sm.load_state()
            assert state == {}

    def test_load_state_corrupted_json(self):
        from feishu_agent.state import StateManager
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "corrupt.json")
            with open(state_file, "w") as f:
                f.write("{invalid json")
            sm = StateManager(state_file)
            state = sm.load_state()
            assert state == {}

    def test_load_state_valid_json(self):
        from feishu_agent.state import StateManager
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "state.json")
            with open(state_file, "w") as f:
                json.dump({"tasks": [{"id": "456"}]}, f)
            sm = StateManager(state_file)
            state = sm.load_state()
            assert state["tasks"][0]["id"] == "456"


class TestStateUpdate:
    def test_update_task_status(self):
        from feishu_agent.state import StateManager
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "state.json")
            sm = StateManager(state_file)
            sm.save_state({"tasks": [{"id": "1", "status": "pending"}]})
            sm.update_task_status("1", "running")
            state = sm.load_state()
            task = next(t for t in state["tasks"] if t["id"] == "1")
            assert task["status"] == "running"

    def test_update_nonexistent_task(self):
        from feishu_agent.state import StateManager
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "state.json")
            sm = StateManager(state_file)
            sm.save_state({"tasks": []})
            sm.update_task_status("999", "running")
            state = sm.load_state()
            assert state["tasks"] == []

    def test_add_task(self):
        from feishu_agent.state import StateManager
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "state.json")
            sm = StateManager(state_file)
            sm.save_state({"tasks": []})
            sm.add_task("task-123", "pending")
            state = sm.load_state()
            assert len(state["tasks"]) == 1
            assert state["tasks"][0]["id"] == "task-123"
