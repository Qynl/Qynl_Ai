from __future__ import annotations
import subprocess
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
    def __init__(self, model: str, host: str, workspace: Path, confirm: Callable[[str, dict], bool]):
        self.client=ollama.Client(host=host); self.model=model; self.workspace=workspace.resolve(); self.confirm=confirm; self.tools={}
    def register(self, tool: Tool): self.tools[tool.name]=tool
    def definitions(self): return [{"type":"function","function":{"name":t.name,"description":t.description,"parameters":t.schema}} for t in self.tools.values()]
    def run(self,messages,max_steps=8):
        messages=list(messages)
        for _ in range(max_steps):
            r=self.client.chat(model=self.model,messages=messages,tools=self.definitions()); m=r.message; messages.append(m)
            calls=getattr(m,"tool_calls",None) or []
            if not calls: return m.content or ""
            for c in calls:
                name=c.function.name; args=c.function.arguments or {}
                if name not in self.tools: result=f"Unknown tool: {name}"
                elif self.tools[name].requires_confirmation and not self.confirm(name,args): result="Tool call denied by user."
                else:
                    try: result=self.tools[name].fn(args)
                    except Exception as e: result=f"Tool error: {type(e).__name__}: {e}"
                messages.append({"role":"tool","content":result})
        return "Tool-step limit reached."
def safe_path(workspace: Path, rel: str)->Path:
    p=(workspace/rel).resolve()
    if workspace not in p.parents: raise ValueError("Path outside EVE workspace")
    return p
def build_tools(workspace: Path):
    def ls(a): return "\n".join(str(p.relative_to(workspace)) for p in workspace.rglob('*') if p.is_file())[:30000] or "(empty)"
    def read(a): return safe_path(workspace,a['path']).read_text(encoding='utf-8')[:int(a.get('limit',20000))]
    def write(a):
        p=safe_path(workspace,a['path']); p.parent.mkdir(parents=True,exist_ok=True); p.write_text(a['content'],encoding='utf-8'); return f"Wrote {p.relative_to(workspace)}"
    def run(a):
        p=subprocess.run(a['command'],cwd=workspace,shell=True,capture_output=True,text=True,timeout=60); return f"exit={p.returncode}\nSTDOUT:\n{p.stdout[-12000:]}\nSTDERR:\n{p.stderr[-12000:]}"
    return [Tool('list_files','List workspace files.',ls,{"type":"object","properties":{}},False),Tool('read_file','Read a workspace text file.',read,{"type":"object","required":["path"],"properties":{"path":{"type":"string"},"limit":{"type":"integer"}}},False),Tool('write_file','Write a workspace text file.',write,{"type":"object","required":["path","content"],"properties":{"path":{"type":"string"},"content":{"type":"string"}}}),Tool('run_command','Run a shell command in the workspace.',run,{"type":"object","required":["command"],"properties":{"command":{"type":"string"}}})]
