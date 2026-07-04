"""
Score every reference image for each generation using CLIP text-image similarity
and pick the one that best matches a frontal/three-quarter car view.

Saves model/preferred_display_images.json  →  { generation_key: "path/to/best.jpg" }

Run once (takes a few minutes on CPU):
    python scripts/pick_display_images.py

The ai-service routes.py checks this file first when serving /images/:id.
"""

from __future__ import annotations

import json
from pathlib import Path

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

BASE_DIR = Path(__file__).parent.parent
REF_MAP  = BASE_DIR / "model" / "reference_images.json"
OUT_PATH = BASE_DIR / "model" / "preferred_display_images.json"

GOOD_PROMPTS = [
    "a front three-quarter view of a car",
    "a side view of a car",
    "a front view of a car",
]
BAD_PROMPTS = [
    "the rear of a car",
    "the back of a car",
    "a car interior",
    "an engine bay",
    "a car dashboard",
    "a car wheel close-up",
]


def main() -> None:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")
    print("Loading CLIP ViT-B/32 …")

    model     = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    model.eval()

    # Pre-compute text features once
    all_prompts = GOOD_PROMPTS + BAD_PROMPTS
    n_good = len(GOOD_PROMPTS)

    with torch.no_grad():
        text_inputs = processor(text=all_prompts, return_tensors="pt", padding=True).to(device)
        text_feats  = model.get_text_features(**text_inputs)
        text_feats  = text_feats / text_feats.norm(dim=-1, keepdim=True)
        good_feats  = text_feats[:n_good]
        bad_feats   = text_feats[n_good:]

    with open(REF_MAP, encoding="utf-8") as f:
        ref_map: dict[str, list[str]] = json.load(f)

    preferred: dict[str, str] = {}
    total = len(ref_map)

    for i, (key, paths) in enumerate(ref_map.items(), 1):
        candidates = [Path(p) for p in paths if Path(p).exists()]
        if not candidates:
            continue

        best_path  = candidates[0]
        best_score = -999.0

        for p in candidates:
            try:
                img = Image.open(p).convert("RGB")
                inputs = processor(images=img, return_tensors="pt").to(device)
                with torch.no_grad():
                    img_feat = model.get_image_features(**inputs)
                    img_feat = img_feat / img_feat.norm(dim=-1, keepdim=True)
                good = float((img_feat @ good_feats.T).mean())
                bad  = float((img_feat @ bad_feats.T).mean())
                score = good - bad
                if score > best_score:
                    best_score = score
                    best_path  = p
            except Exception:
                continue

        preferred[key] = str(best_path)

        print(f"  {i}/{total}  {key}  score={best_score:.3f}", flush=True)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(preferred, f, indent=2)

    print(f"\nSaved {len(preferred)} entries → {OUT_PATH}")
    print("Restart the ai-service to apply.")


if __name__ == "__main__":
    main()