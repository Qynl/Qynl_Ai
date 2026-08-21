from __future__ import annotations

import os
import subprocess
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

WORKSPACE = Path(os.getenv("EVE_WORKSPACE", "./workspace")).resolve()
MAX_READ_BYTES = int(os.getenv("EVE_MAX_READ_BYTES", str(256 * 1024)))


class ToolApprovalRequired(RuntimeError):
    pass


def _inside_workspace(path: str | Path) -> Path:
    target = Path(path).expanduser().resolve()
    try:
        target.relative_to(WORKSPACE)
    except ValueError as exc:
        raise PermissionError("EVE can only access paths inside its workspace") from exc
    return target


def list_files() -> list[str]:
    return [str(p.relative_to(WORKSPACE)) for p in WORKSPACE.rglob("*") if p.is_file()][:500]


def read_file(path: str) -> str:
    target = _inside_workspace(path)
    if not target.is_file():
        raise FileNotFoundError(target)
    if target.stat().st_size > MAX_READ_BYTES:
        raise ValueError("File is larger than the configured read limit")
    return target.read_text(encoding="utf-8", errors="replace")


def write_file(path: str, content: str, approved: bool = False) -> str:
    if not approved:
        raise ToolApprovalRequired("Writing files requires explicit approval")
    target = _inside_workspace(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return str(target)


def run_command(command: str, approved: bool = False) -> str:
    if not approved:
        raise ToolApprovalRequired("Running commands requires explicit approval")
    result = subprocess.run(
        command,
        shell=True,
        cwd=WORKSPACE,
        capture_output=True,
        text=True,
        timeout=60,
        env={**os.environ, "EVE_WORKSPACE": str(WORKSPACE)},
    )
    output = (result.stdout + "\n" + result.stderr).strip()
    return f"exit_code={result.returncode}\n{output[-12000:]}"
