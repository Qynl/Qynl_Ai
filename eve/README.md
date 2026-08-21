# EVE 0.1

EVE is a local-first personal AI agent designed as a general engineering and research copilot.

## Goals
- Local LLM through Ollama
- Persistent local memory
- Safe tool execution with explicit permission gates
- Project/workspace awareness
- Extensible tool architecture
- No API key required for the core chat loop

## Requirements
- Python 3.12+
- Ollama installed and running
- A local chat model available in Ollama

## Quick start

```bash
cd eve
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
ollama pull qwen3:8b
python eve.py
```

Set `EVE_MODEL` in `.env` if you use another installed model.

## Safety model
EVE starts in **safe mode**. Read-only tools can run automatically. Actions that can modify files or execute commands require explicit approval. EVE does not receive unrestricted access to the host by default.

For early testing, use a dedicated workspace and preferably a VM/snapshot.
