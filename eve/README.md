# EVE 🧠🤖

EVE is a **local-first personal AI assistant** designed to grow into a serious engineering, research, coding, and computer-use copilot.

This repository is intentionally built as a real software project rather than a single prompt. The first goal is a fast, useful local assistant. Later layers can add controlled browser use, project agents, research workflows, vision, a richer UI, and simulation tooling.

## Current core

- 🧠 Local LLM through Ollama
- 💾 Persistent conversation memory
- 🎙️ Local speech-to-text with faster-whisper
- 🔊 Local text-to-speech through Piper
- 📁 Workspace awareness
- 📖 Read-only file inspection
- ✍️ Explicitly approved file writes
- 🖥️ Explicitly approved terminal commands
- 🛡️ Workspace boundary and safe-mode defaults
- ⚡ GPU-aware Whisper configuration
- 🎨 Rich terminal interface

## Architecture

```text
                    EVE
                     │
          ┌──────────┼──────────┐
          │          │          │
       Brain       Memory     Voice
      Ollama       JSON       STT/TTS
          │          │          │
          └──────────┼──────────┘
                     │
                  Tools
          ┌──────────┼──────────┐
          │          │          │
       Files      Terminal   Workspace
          │          │          │
          └──────────┴──────────┘
```

## Voice

STT uses faster-whisper and can use CUDA when the installed backend supports it. `small` is a reasonable quality/speed starting point; smaller models can reduce latency further.

TTS is designed around Piper so generated speech can stay local. Set `EVE_PIPER_MODEL` to an installed Piper voice model. If Piper is not configured, the rest of EVE still works.

## Requirements

- Python 3.12+
- Ollama
- A local Ollama chat model
- For voice input: a working microphone and audio backend
- For local TTS: Piper + a compatible voice model
- NVIDIA GPU is optional but can accelerate Whisper on supported systems

## Quick start

```bash
cd eve
python -m venv .venv
# Windows PowerShell
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
ollama pull qwen3:8b
python eve.py
```

Then try:

```text
/help
/voice
/files
/read README.md
```

## Tool safety

EVE does **not** receive unrestricted host access by default.

- Reads are restricted to the configured workspace.
- File writes require an explicit confirmation.
- Terminal commands require an explicit confirmation.
- Keep secrets, personal documents, and credentials outside the EVE workspace during early testing.
- A VM with snapshots is recommended while testing third-party integrations or computer-control features.

## Roadmap

### 0.3 Agent layer
- structured tool calling
- task planning
- tool result verification
- project-specific memory
- background jobs

### 0.4 JARVIS-style interaction
- wake-word option
- continuous listening mode with local VAD
- streaming speech output
- interruption / barge-in
- desktop HUD
- push-to-talk

### 0.5 Research & engineering
- local document indexing
- source-aware research notes
- Python execution in a restricted environment
- codebase analysis
- simulations
- experiment notebooks

### Later
- controlled browser automation
- computer vision
- 3D visualization
- digital human simulation research tools

EVE should grow through small, testable modules instead of becoming one giant script.
