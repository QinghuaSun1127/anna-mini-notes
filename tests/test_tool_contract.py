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
                        {"order": 2, "content": "跟设计沟通需求"},
                        {"order": 3, "content": "准备 workshop 提纲"},
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
        test_invalid_json_rpc_input,
        test_bad_notes_shape_returns_tool_error,
        test_invalid_params_shape,
    ]
    for test in tests:
        test()
    print(f"{len(tests)} tool contract tests passed")


if __name__ == "__main__":
    main()
