from __future__ import annotations

import os
import queue
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np
import sounddevice as sd
from dotenv import load_dotenv
from faster_whisper import WhisperModel

load_dotenv()

SAMPLE_RATE = int(os.getenv("EVE_STT_SAMPLE_RATE", "16000"))
STT_MODEL = os.getenv("EVE_STT_MODEL", "small")
STT_DEVICE = os.getenv("EVE_STT_DEVICE", "auto")
STT_COMPUTE = os.getenv("EVE_STT_COMPUTE", "int8")
PIPER_BIN = os.getenv("EVE_PIPER_BIN", "piper")
PIPER_MODEL = os.getenv("EVE_PIPER_MODEL", "")


class VoiceIO:
    """Low-latency local voice layer.

    STT uses faster-whisper. TTS uses Piper when configured, keeping speech local.
    """

    def __init__(self) -> None:
        self._whisper: WhisperModel | None = None

    def _model(self) -> WhisperModel:
        if self._whisper is None:
            device = "cuda" if STT_DEVICE == "auto" and _cuda_available() else STT_DEVICE
            if device == "auto":
                device = "cpu"
            compute = STT_COMPUTE if device == "cpu" else os.getenv("EVE_STT_GPU_COMPUTE", "float16")
            self._whisper = WhisperModel(STT_MODEL, device=device, compute_type=compute)
        return self._whisper

    def record(self, seconds: float = 6.0) -> np.ndarray:
        frames = int(seconds * SAMPLE_RATE)
        audio = sd.rec(frames, samplerate=SAMPLE_RATE, channels=1, dtype="float32")
        sd.wait()
        return audio[:, 0]

    def transcribe(self, audio: np.ndarray) -> str:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = Path(f.name)
        try:
            with wave.open(str(path), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                pcm = np.clip(audio, -1, 1)
                wf.writeframes((pcm * 32767).astype(np.int16).tobytes())
            segments, _ = self._model().transcribe(str(path), vad_filter=True, beam_size=1)
            return " ".join(s.text.strip() for s in segments).strip()
        finally:
            path.unlink(missing_ok=True)

    def listen_once(self, seconds: float = 6.0) -> str:
        return self.transcribe(self.record(seconds))

    def speak(self, text: str) -> bool:
        if not PIPER_MODEL:
            return False
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            out = Path(f.name)
        try:
            subprocess.run(
                [PIPER_BIN, "--model", PIPER_MODEL, "--output_file", str(out)],
                input=text.encode("utf-8"),
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            with wave.open(str(out), "rb") as wf:
                data = wf.readframes(wf.getnframes())
                audio = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
                sd.play(audio, wf.getframerate())
                sd.wait()
            return True
        except (OSError, subprocess.CalledProcessError):
            return False
        finally:
            out.unlink(missing_ok=True)


def _cuda_available() -> bool:
    try:
        import ctranslate2
        return "cuda" in ctranslate2.get_supported_compute_types("cuda")
    except Exception:
        return False
