import base64
import json
import logging
import urllib.request
from pathlib import Path

log = logging.getLogger("smartgully.vlm")

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llava"


def get_vlm_opinion(image_path: str, timeout: float = 3.0) -> str | None:
    """Sends image to local Ollama vision model for a second opinion on yellow reports.
    Fails silently if Ollama is not installed or running.
    """
    try:
        p = Path(image_path)
        if not p.exists():
            return None
        with open(p, "rb") as f:
            b64_image = base64.b64encode(f.read()).decode("utf-8")

        req_data = {
            "model": OLLAMA_MODEL,
            "prompt": "In one concise sentence under 120 characters, describe the road condition and any pothole visible in this photo.",
            "images": [b64_image],
            "stream": False,
        }
        req = urllib.request.Request(
            OLLAMA_URL,
            data=json.dumps(req_data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            opinion = data.get("response", "").strip()
            if opinion:
                # Return single clean line
                return opinion.splitlines()[0][:140]
    except Exception as e:
        log.debug("VLM second opinion skipped: %s", e)
    return None
