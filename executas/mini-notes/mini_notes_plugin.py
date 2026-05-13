#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from typing import Any

TOOL_ID = "tool-test-mini-notes-12345678"

MANIFEST: dict[str, Any] = {
    "name": TOOL_ID,
    "display_name": "Mini Notes Summarizer",
    "version": "1.0.0",
    "description": "Rule-based note summarizer for the Mini Notes Anna App.",
    "author": "Mini Notes",
    "homepage": "https://github.com/example/anna-mini-notes",
    "license": "MIT",
    "tags": ["notes", "summary", "anna-app"],
    "tools": [
        {
            "name": "summarize",
            "description": "Summarize the current notes with simple keyword rules.",
            "parameters": [
                {
                    "name": "notes",
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Current notes. Each note should include content and order.",
                    "required": True,
                }
            ],
        }
    ],
    "runtime": {"type": "uv", "min_version": "0.1.0"},
}

CATEGORY_RULES = [
    ("开发修复", ("bug", "fix", "修复", "登录", "代码", "开发")),
    ("客户跟进", ("客户", "follow", "跟进", "会议")),
    ("内容准备", ("workshop", "提纲", "内容", "准备", "想法")),
    ("协作事项", ("设计", "需求", "协作", "review")),
]


def summarize(notes: list[Any]) -> dict[str, Any]:
    normalized = _normalize_notes(notes)
    count = len(normalized)
    if count == 0:
        return {
            "summary": "暂无笔记可总结。",
            "count": 0,
            "categories": [],
        }

    text = " ".join(note["content"] for note in normalized).lower()
    categories = [
        label
        for label, keywords in CATEGORY_RULES
        if any(keyword.lower() in text for keyword in keywords)
    ]

    if categories:
        summary = f"当前共有 {count} 条笔记，主要集中在{_join_zh(categories)}。"
    else:
        preview = "；".join(note["content"] for note in normalized[:3])
        suffix = "等事项" if count > 3 else "这些事项"
        summary = f"当前共有 {count} 条笔记，内容包括：{preview}，建议优先梳理{suffix}。"

    return {
        "summary": summary,
        "count": count,
        "categories": categories,
        "orders": [note["order"] for note in normalized],
    }


def _normalize_notes(notes: list[Any]) -> list[dict[str, Any]]:
    if not isinstance(notes, list):
        raise ValueError("notes must be an array")

    normalized: list[dict[str, Any]] = []
    for index, note in enumerate(notes, start=1):
        if isinstance(note, str):
            content = note.strip()
            order = index
        elif isinstance(note, dict):
            content = str(note.get("content", "")).strip()
            order = note.get("order", index)
        else:
            continue

        if content:
            normalized.append({"content": content[:240], "order": order})
    return normalized


def _join_zh(items: list[str]) -> str:
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]}和{items[1]}"
    return f"{'、'.join(items[:-1])}和{items[-1]}"


def handle_describe(_params: dict[str, Any]) -> dict[str, Any]:
    return MANIFEST


def handle_invoke(params: dict[str, Any]) -> dict[str, Any]:
    tool_name = params.get("tool")
    args = params.get("arguments") or {}
    if tool_name != "summarize":
        return {"success": False, "error": f"unknown tool: {tool_name!r}"}
    if not isinstance(args, dict):
        return {"success": False, "error": "arguments must be an object"}

    try:
        payload = summarize(args.get("notes", []))
    except Exception as exc:
        return {"success": False, "error": f"{type(exc).__name__}: {exc}"}
    return {"success": True, "data": payload}


def handle_health(_params: dict[str, Any]) -> dict[str, str]:
    return {"status": "ok"}


METHODS = {
    "describe": handle_describe,
    "invoke": handle_invoke,
    "health": handle_health,
}


def send(message: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> None:
    print(f"[mini-notes] {MANIFEST['display_name']} ready", file=sys.stderr)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as exc:
            send(
                {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32700, "message": f"parse error: {exc}"},
                }
            )
            continue

        req_id = request.get("id")
        method = request.get("method")
        handler = METHODS.get(method)
        if handler is None:
            send(
                {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"method not found: {method}"},
                }
            )
            continue

        try:
            result = handler(request.get("params") or {})
            send({"jsonrpc": "2.0", "id": req_id, "result": result})
        except Exception as exc:
            send(
                {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32000, "message": str(exc)},
                }
            )


if __name__ == "__main__":
    main()
