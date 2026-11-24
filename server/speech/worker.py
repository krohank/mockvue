"""Local audio transcription. JSON lines on stdin/stdout; never retain recordings."""
import json
import os
import sys
import logging

logging.basicConfig(stream=sys.stderr, level=logging.WARNING)
def reply(payload):
    print(json.dumps(payload, ensure_ascii=True), flush=True)

try:
    from faster_whisper import WhisperModel
    model_name = os.environ.get("WHISPER_MODEL", "base")
    model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=min(4, os.cpu_count() or 4))
    reply({"ready": True, "model": model_name})
except Exception as error:
    reply({"ready": False, "error": "Local speech model could not start. Install server/speech/requirements.txt and retry."})
    print(str(error), file=sys.stderr)
    sys.exit(1)

for line in sys.stdin:
    try:
        request = json.loads(line)
        language = request.get("language", "en")
        segments, info = model.transcribe(
            request["path"], language=None if language == "auto" else language,
            beam_size=3, vad_filter=True, condition_on_previous_text=False,
            vad_parameters={"min_silence_duration_ms": 300},
        )
        if info.duration > 300:
            raise ValueError("Recordings must be five minutes or shorter.")
        text = " ".join(s.text.strip() for s in segments if s.no_speech_prob < 0.65 and s.avg_logprob > -1.2).strip()
        if not text:
            raise ValueError("No clear speech detected. Check your microphone and try again.")
        reply({"id": request["id"], "text": text, "language": info.language, "duration": round(info.duration, 2)})
    except Exception as error:
        reply({"id": request.get("id") if "request" in locals() else None, "error": str(error)})
