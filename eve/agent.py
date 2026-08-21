from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import ollama


@dataclass
class Tool:
    name: str
    description: str
    fn: Callable[[dict], str]
    schema: dict
    requires_confirmation: bool = True


class EveAgent:
    """Small, explicit tool-calling loop for EVE.

    The model proposes tool calls. Python executes only registered tools,
    and the confirmation callback controls side effects.
    """

    def __init__(self, model: str, host: str, workspace: Path, confirm: Callable[[str, dict], bool]):
        self.client = ollama.Client(host=host)
        self.model = model
        self.workspace = workspace.resolve()
        self.confirm = confirm
        self.tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def definitions(self) -> list[dict]:
        return [{"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.schema}} for t in self.tools.values()]

    def run(self, messages: list[dict], max_steps: int = 8) -> str:
        messages = list(messages)
        for _ in range(max_steps):
            response = self.client.chat(model=self.model, messages=messages, tools=self.definitions())
            msg = response.message
            messages.append(msg)
            calls = getattr(msg, "tool_calls", None) or []
            if not calls:
                return msg.content or ""
            for call in calls:
                name = call.function.name
                args = call.function.arguments or {}
                if name not in self.tools:
                    result = f"Unknown tool: {name}"
                else:
                    tool = self.tools[name]
                    if tool.requires_confirmation and not self.confirm(name, args):
                        result = "Tool call denied by user."
                    else:
                        try:
                            result = tool.fn(args)
                        except Exception as exc:
                            result = f"Tool error: {type(exc).__name__}: {exc}"
                messages.append({"role": "tool", "content": result})
        return "I reached the tool-step limit before completing the task."


def read_text(workspace: Path, rel: str, limit: int = 20000) -> str:
    path = (workspace / rel).resolve()
    if workspace not in path.parents and path != workspace:
        raise ValueError("Path is outside the EVE workspace")
    if not path.is_file():
        raise FileNotFoundError(rel)
    return path.read_text(encoding="utf-8")[:limit]


def list_files(workspace: Path, prefix: str = "") -> str:
    base = (workspace / prefix).resolve()
    if workspace not in base.parents and base != workspace:
        raise ValueError("Path is outside the EVE workspace")
    if not base.exists():
        return "Path does not exist."
    items = [str(p.relative_to(workspace)) for p in base.rglob("*") if p.is_file()]
    return "\n".join(items[:500]) or "(no files)"
