import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from app.config import CLIP_MODEL, CLIP_PROMPTS, ROAD_PROMPT_COUNT

_processor = CLIPProcessor.from_pretrained(CLIP_MODEL)
_model = CLIPModel.from_pretrained(CLIP_MODEL)
_model.eval()


def road_score(image_path: str) -> float:
    image = Image.open(image_path).convert("RGB")
    inputs = _processor(text=CLIP_PROMPTS, images=image, return_tensors="pt", padding=True)
    with torch.no_grad():
        outputs = _model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1)[0]
    return float(probs[:ROAD_PROMPT_COUNT].sum())
