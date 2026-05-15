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
    "description": "Rule-based note summarizer with categories and action items for the Mini Notes Anna App.",
    "author": "Mini Notes",
    "homepage": "https://github.com/QinghuaSun1127/anna-mini-notes",
    "license": "MIT",
    "tags": ["notes", "summary", "anna-app"],
    "tools": [
        {
            "name": "summarize",
            "description": "Summarize the current notes with keyword categories, highlights, and action items.",
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
            "tags": [],
            "highlights": [],
            "action_items": [],
            "suggested_next_step": "先添加几条笔记，再生成总结。",
        }

    text = " ".join(note["content"] for note in normalized).lower()
    tags = _collect_tags(normalized)
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

    action_items = _build_action_items(normalized, categories)
    highlights = [note["content"] for note in normalized[:3]]

    return {
        "summary": summary,
        "count": count,
        "categories": categories,
        "tags": tags,
        "highlights": highlights,
        "action_items": action_items,
        "suggested_next_step": _suggest_next_step(categories, normalized, tags),
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
            tags = []
        elif isinstance(note, dict):
            content = str(note.get("content", "")).strip()
            order = note.get("order", index)
            tags = _normalize_tags(note.get("tags", []))
        else:
            continue

        if content:
            normalized.append({"content": content[:240], "order": order, "tags": tags})
    return normalized


def _join_zh(items: list[str]) -> str:
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]}和{items[1]}"
    return f"{'、'.join(items[:-1])}和{items[-1]}"


def _build_action_items(notes: list[dict[str, Any]], categories: list[str]) -> list[str]:
    actions: list[str] = []

    for note in notes:
        content = note["content"]
        lowered = content.lower()
        if _contains_any(lowered, ("bug", "fix", "修复", "登录", "代码", "开发")):
            actions.append(f"处理开发修复事项：{content}")
        elif _contains_any(lowered, ("客户", "follow", "跟进", "会议")):
            actions.append(f"跟进沟通事项：{content}")
        elif _contains_any(lowered, ("workshop", "提纲", "内容", "准备", "想法")):
            actions.append(f"推进内容准备：{content}")
        elif _contains_any(lowered, ("设计", "需求", "协作", "review")):
            actions.append(f"确认协作细节：{content}")

        if len(actions) >= 4:
            break

    if actions:
        return actions

    if categories:
        return [f"围绕{_join_zh(categories)}整理下一步任务。"]

    return [f"先确认优先级：{notes[0]['content']}"]


def _suggest_next_step(categories: list[str], notes: list[dict[str, Any]], tags: list[str]) -> str:
    if "开发修复" in categories:
        return "建议先处理开发修复类笔记，再补充沟通和内容准备事项。"
    if "客户跟进" in categories:
        return "建议先安排客户或会议跟进，避免沟通事项遗漏。"
    if "内容准备" in categories:
        return "建议先把内容准备事项拆成可执行的小步骤。"
    if "协作事项" in categories:
        return "建议先确认需求、设计或 review 的负责人和截止时间。"
    if tags:
        return f"建议先围绕 #{tags[0]} 标签整理优先级。"
    return f"建议先从第 {notes[0]['order']} 条笔记开始整理优先级。"


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword.lower() in text for keyword in keywords)


def _collect_tags(notes: list[dict[str, Any]]) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()
    for note in notes:
        for tag in note.get("tags", []):
            key = tag.lower()
            if key in seen:
                continue
            seen.add(key)
            tags.append(tag)
    return tags[:12]


def _normalize_tags(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    tags: list[str] = []
    seen: set[str] = set()
    for item in value:
        tag = str(item).strip().lstrip("#")[:24]
        if not tag:
            continue
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        tags.append(tag)
    return tags[:6]


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


def _configure_stdio() -> None:
    stdin_reconfigure = getattr(sys.stdin, "reconfigure", None)
    if stdin_reconfigure is not None:
        stdin_reconfigure(encoding="utf-8-sig")

    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8")


def main() -> None:
    _configure_stdio()
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

        if not isinstance(request, dict):
            send(
                {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32600, "message": "request must be an object"},
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
            params = request.get("params")
            if params is None:
                params = {}
            if not isinstance(params, dict):
                send(
                    {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {"code": -32602, "message": "params must be an object"},
                    }
                )
                continue
            result = handler(params)
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
