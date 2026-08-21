from __future__ import annotations
from pathlib import Path

def transcribe_file(audio_path: str, model_size: str = 'small') -> str:
    from faster_whisper import WhisperModel
    model=WhisperModel(model_size,device='auto',compute_type='auto')
    segments,_=model.transcribe(audio_path,vad_filter=True)
    return ' '.join(s.text.strip() for s in segments).strip()

def speak(text: str, output_path: str = 'eve_tts.wav') -> Path:
    import subprocess
    out=Path(output_path)
    subprocess.run(['piper','--output_file',str(out)],input=text,text=True,check=True)
    return out
