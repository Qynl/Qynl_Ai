# EVE 0.3

EVE is evolving from a local chatbot into a local-first personal agent. The current release adds a real tool-calling loop, explicit approval gates for side effects, workspace sandboxing, and an optional local voice layer.

## Architecture
- Ollama: local reasoning model
- Agent loop: model -> tools -> observations -> model
- Workspace tools: list/read/write/run
- Approval gate: writes and commands require confirmation
- Voice: faster-whisper STT + Piper TTS adapters

Run early versions in a VM/snapshot and keep secrets outside the workspace.
