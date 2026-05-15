from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "executas" / "mini-notes" / "mini_notes_plugin.py"


def rpc(message: dict) -> dict:
    process = subprocess.run(
        [sys.executable, str(PLUGIN)],
        input=json.dumps(message, ensure_ascii=False) + "\n",
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
    )
    return json.loads(process.stdout)


def rpc_raw(payload: str) -> dict:
    process = subprocess.run(
        [sys.executable, str(PLUGIN)],
        input=payload + "\n",
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
    )
    return json.loads(process.stdout)


def test_describe() -> None:
    response = rpc({"jsonrpc": "2.0", "id": 1, "method": "describe"})
    result = response["result"]
    assert result["name"] == "tool-test-mini-notes-12345678"
    assert result["homepage"] == "https://github.com/QinghuaSun1127/anna-mini-notes"
    assert result["tools"][0]["name"] == "summarize"


def test_invoke_summarize() -> None:
    response = rpc(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "invoke",
            "params": {
                "tool": "summarize",
                "arguments": {
                    "notes": [
                        {"order": 1, "content": "修复登录 bug"},
                        {"order": 2, "content": "跟设计沟通需求", "tags": ["work", "design"]},
                        {"order": 3, "content": "准备 workshop 提纲", "tags": ["work"]},
                    ]
                },
            },
        }
    )
    result = response["result"]
    assert result["success"] is True
    assert result["data"]["count"] == 3
    assert "开发修复" in result["data"]["categories"]
    assert "内容准备" in result["data"]["categories"]
    assert "协作事项" in result["data"]["categories"]
    assert result["data"]["highlights"] == [
        "修复登录 bug",
        "跟设计沟通需求",
        "准备 workshop 提纲",
    ]
    assert result["data"]["tags"] == ["work", "design"]
    assert len(result["data"]["action_items"]) == 3
    assert result["data"]["suggested_next_step"]


def test_empty_notes_returns_structured_empty_state() -> None:
    response = rpc(
        {
            "jsonrpc": "2.0",
            "id": 5,
            "method": "invoke",
            "params": {
                "tool": "summarize",
                "arguments": {"notes": []},
            },
        }
    )
    data = response["result"]["data"]
    assert data["count"] == 0
    assert data["categories"] == []
    assert data["tags"] == []
    assert data["highlights"] == []
    assert data["action_items"] == []
    assert data["suggested_next_step"] == "先添加几条笔记，再生成总结。"


def test_string_notes_are_supported() -> None:
    response = rpc(
        {
            "jsonrpc": "2.0",
            "id": 6,
            "method": "invoke",
            "params": {
                "tool": "summarize",
                "arguments": {"notes": ["follow up 客户", "review 设计稿"]},
            },
        }
    )
    data = response["result"]["data"]
    assert data["count"] == 2
    assert data["orders"] == [1, 2]
    assert "客户跟进" in data["categories"]
    assert "协作事项" in data["categories"]
    assert len(data["action_items"]) == 2


def test_tags_can_drive_next_step_without_categories() -> None:
    response = rpc(
        {
            "jsonrpc": "2.0",
            "id": 7,
            "method": "invoke",
            "params": {
                "tool": "summarize",
                "arguments": {
                    "notes": [
                        {"order": 1, "content": "整理资料", "tags": ["research", "work"]},
                        {"order": 2, "content": "列出问题", "tags": ["research"]},
                    ]
                },
            },
        }
    )
    data = response["result"]["data"]
    assert data["categories"] == []
    assert data["tags"] == ["research", "work"]
    assert data["suggested_next_step"] == "建议先围绕 #research 标签整理优先级。"


def test_invalid_json_rpc_input() -> None:
    response = rpc_raw("[]")
    assert response["error"]["code"] == -32600


def test_bad_notes_shape_returns_tool_error() -> None:
    response = rpc(
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "invoke",
            "params": {
                "tool": "summarize",
                "arguments": {"notes": "not an array"},
            },
        }
    )
    result = response["result"]
    assert result["success"] is False
    assert "notes must be an array" in result["error"]


def test_invalid_params_shape() -> None:
    response = rpc(
        {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "invoke",
            "params": [],
        }
    )
    assert response["error"]["code"] == -32602


def main() -> None:
    tests = [
        test_describe,
        test_invoke_summarize,
        test_empty_notes_returns_structured_empty_state,
        test_string_notes_are_supported,
        test_tags_can_drive_next_step_without_categories,
        test_invalid_json_rpc_input,
        test_bad_notes_shape_returns_tool_error,
        test_invalid_params_shape,
    ]
    for test in tests:
        test()
    print(f"{len(tests)} tool contract tests passed")


if __name__ == "__main__":
    main()
