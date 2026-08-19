"""
Audits reference images for "detail shot" problems that hurt classification:
images where YOLO fails to detect a vehicle at all, or where the detected
vehicle box fills almost the entire frame (a strong signal of a close-up
grille/badge/headlight shot rather than a full-vehicle photo showing overall
body silhouette — the kind of photo that can't carry body-style information).

Reuses the exact same YOLO model + vehicle-class filtering + box-selection
logic as CarClassifier._crop_car (src/model_loader.py) so results reflect
what the real pipeline actually sees, not a reimplementation that might
behave slightly differently.

Usage:
    python audit_reference_crops.py                  # whole catalogue
    python audit_reference_crops.py --manufacturer Audi
"""

import argparse
import json
from pathlib import Path

from PIL import Image
from ultralytics import YOLO

BASE_DIR = Path(__file__).parent
_CAR_CLASSES = {2, 5, 7}  # COCO: car, bus, truck — matches model_loader.py

TIGHT_CROP_RATIO = 0.85  # box covering >85% of the frame area = likely a close-up


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manufacturer", default=None, help="Only audit this manufacturer (e.g. Audi)")
    parser.add_argument("--tight-ratio", type=float, default=TIGHT_CROP_RATIO)
    args = parser.parse_args()

    with (BASE_DIR / "model" / "reference_images.json").open(encoding="utf-8") as f:
        ref_images: dict = json.load(f)
    with (BASE_DIR / "model" / "class_labels.json").open(encoding="utf-8") as f:
        labels: dict = json.load(f)

    keys = list(ref_images.keys())
    if args.manufacturer:
        keys = [k for k in keys if labels.get(k, {}).get("manufacturerName") == args.manufacturer]

    print(f"Auditing {len(keys)} generations ({sum(len(ref_images[k]) for k in keys)} images)…")

    yolo = YOLO("yolov8n.pt")

    no_detection = []
    tight_crop = []
    total_images = 0

    for key in keys:
        meta = labels.get(key, {})
        for path_str in ref_images[key]:
            p = Path(path_str)
            if not p.exists():
                continue
            total_images += 1
            try:
                img = Image.open(p).convert("RGB")
            except Exception as exc:
                print(f"  Skipping unreadable {p.name}: {exc}")
                continue

            results = yolo(img, verbose=False)
            boxes = [b for b in results[0].boxes if int(b.cls[0]) in _CAR_CLASSES]

            row = {
                "key": key,
                "manufacturerName": meta.get("manufacturerName"),
                "modelName": meta.get("modelName"),
                "generationCode": meta.get("generationCode"),
                "file": p.name,
            }

            if not boxes:
                no_detection.append(row)
                continue

            best = max(boxes, key=lambda b: (b.xyxy[0][2] - b.xyxy[0][0]) * (b.xyxy[0][3] - b.xyxy[0][1]))
            x1, y1, x2, y2 = (float(v) for v in best.xyxy[0])
            box_area = (x2 - x1) * (y2 - y1)
            frame_area = img.width * img.height
            ratio = box_area / frame_area if frame_area else 0

            if ratio > args.tight_ratio:
                tight_crop.append({**row, "boxAreaRatio": round(ratio, 3)})

    print(f"\nAudited {total_images} images.")
    print(f"No vehicle detected at all: {len(no_detection)} ({len(no_detection)/total_images:.1%})")
    print(f"Box covers >{args.tight_ratio:.0%} of frame (likely close-up/detail shot): {len(tight_crop)} ({len(tight_crop)/total_images:.1%})")

    flagged_total = len(no_detection) + len(tight_crop)
    print(f"Total flagged: {flagged_total} ({flagged_total/total_images:.1%})")

    # Per-generation breakdown, most-affected first
    from collections import Counter
    per_gen = Counter()
    for row in no_detection + tight_crop:
        per_gen[row["key"]] += 1

    print("\nMost-affected generations:")
    for key, n in per_gen.most_common(20):
        meta = labels.get(key, {})
        total_for_gen = len(ref_images.get(key, []))
        print(f"  {meta.get('manufacturerName')} {meta.get('modelName')} ({meta.get('generationCode')}): {n}/{total_for_gen} flagged")

    out_path = BASE_DIR / "model" / ("audit_crops_" + (args.manufacturer or "all") + ".json")
    with out_path.open("w", encoding="utf-8") as f:
        json.dump({
            "totalImages": total_images,
            "noDetection": no_detection,
            "tightCrop": tight_crop,
        }, f, indent="\t")
    print(f"\nSaved details to {out_path}")


if __name__ == "__main__":
    main()
