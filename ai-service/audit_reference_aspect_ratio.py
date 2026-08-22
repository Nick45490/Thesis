"""
Audits reference images for body-style-defining camera angle, using YOLO
bounding-box aspect ratio (width/height) as a geometric proxy instead of
zero-shot CLIP classification — a dead-on front/rear shot of a car produces a
boxy, near-square-or-taller crop (you're looking at the narrow front/rear
face); a side or three-quarter shot produces a much wider crop (you see the
car's full length). No semantic classification involved, just geometry
already computed by the same YOLO crop CarClassifier._crop_car uses.

Built after a zero-shot-CLIP version of this same idea (audit_reference_angles.py)
failed its own sanity check — noise-level, tightly-clustered confidence scores,
and it misclassified a known dead-on-front example as a good angle. This
aspect-ratio version was validated against that same known example before use:
the dead-on-front Golf Variant photo scores 1.26 (bottom ~8% of the Estate
distribution), the good three-quarter-angle photo scores 1.83 (median).

Usage:
    python audit_reference_aspect_ratio.py --segment Estate
    python audit_reference_aspect_ratio.py --segment SUV --segment Crossover --segment MPV
"""

import argparse
import json
from pathlib import Path

from PIL import Image
from ultralytics import YOLO

BASE_DIR = Path(__file__).parent
CATALOGUE_DATA_PATH = BASE_DIR.parent / "catalogue-service" / "seed" / "data.json"

_CAR_CLASSES = {2, 5, 7}  # COCO: car, bus, truck — matches model_loader.py

# Below this w/h ratio, a crop is "too face-on to show body-style-defining
# shape" — calibrated against the one real known example (see docstring).
LOW_RATIO_THRESHOLD = 1.45


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument("--segment", action="append", dest="segments", required=True,
	                     help="Only audit this segment (repeatable), e.g. --segment SUV")
	parser.add_argument("--threshold", type=float, default=LOW_RATIO_THRESHOLD)
	args = parser.parse_args()
	segments = set(args.segments)

	with (BASE_DIR / "model" / "reference_images.json").open(encoding="utf-8") as f:
		ref_images: dict = json.load(f)
	with (BASE_DIR / "model" / "class_labels.json").open(encoding="utf-8") as f:
		labels: dict = json.load(f)
	with CATALOGUE_DATA_PATH.open(encoding="utf-8") as f:
		catalogue = json.load(f)
	segment_by_model = {m["name"]: m.get("segment") for m in catalogue["models"]}

	keys = [k for k, meta in labels.items() if segment_by_model.get(meta["modelName"]) in segments]
	print(f"Auditing {len(keys)} generations across segments {sorted(segments)} "
	      f"({sum(len(ref_images.get(k, [])) for k in keys)} images)…")

	yolo = YOLO("yolov8n.pt")

	rows = []
	no_detection = []
	for key in keys:
		meta = labels.get(key, {})
		for path_str in ref_images.get(key, []):
			p = Path(path_str)
			if not p.exists():
				continue
			try:
				img = Image.open(p).convert("RGB")
			except Exception as exc:
				print(f"  Skipping unreadable {p.name}: {exc}")
				continue

			results = yolo(img, verbose=False)
			boxes = [b for b in results[0].boxes if int(b.cls[0]) in _CAR_CLASSES]
			if not boxes:
				no_detection.append({"key": key, "file": p.name, **meta})
				continue

			best = max(boxes, key=lambda b: (b.xyxy[0][2] - b.xyxy[0][0]) * (b.xyxy[0][3] - b.xyxy[0][1]))
			x1, y1, x2, y2 = (float(v) for v in best.xyxy[0])
			w, h = x2 - x1, y2 - y1
			ratio = w / h if h else 0
			rows.append({
				"key": key,
				"manufacturerName": meta.get("manufacturerName"),
				"modelName": meta.get("modelName"),
				"generationCode": meta.get("generationCode"),
				"file": p.name,
				"ratio": round(ratio, 3),
			})

	ratios = sorted(r["ratio"] for r in rows)
	n = len(ratios)
	print(f"\nAudited {n} images ({len(no_detection)} with no detection).")
	print("Percentiles:")
	for pct in (5, 10, 25, 50, 75, 90, 95):
		idx = min(n - 1, int(n * pct / 100))
		print(f"  p{pct}: {ratios[idx]:.3f}")

	flagged = [r for r in rows if r["ratio"] < args.threshold]
	print(f"\nFlagged (ratio < {args.threshold}): {len(flagged)} ({len(flagged)/n:.1%})")

	from collections import defaultdict
	per_gen_total = defaultdict(int)
	per_gen_flagged = defaultdict(int)
	for key in keys:
		per_gen_total[key] = len(ref_images.get(key, []))
	for r in flagged:
		per_gen_flagged[r["key"]] += 1

	worst = sorted(
		((key, per_gen_flagged[key], per_gen_total[key]) for key in keys if per_gen_total[key] > 0),
		key=lambda t: t[1] / t[2],
		reverse=True,
	)
	print("\nMost flagged-heavy generations (top 20):")
	for key, flagged_count, total_count in worst[:20]:
		if flagged_count == 0:
			continue
		meta = labels.get(key, {})
		print(f"  {meta.get('manufacturerName')} {meta.get('modelName')} ({meta.get('generationCode')}): "
		      f"{flagged_count}/{total_count} flagged ({flagged_count/total_count:.0%})")

	out_path = BASE_DIR / "model" / ("audit_aspect_" + "_".join(sorted(segments)) + ".json")
	with out_path.open("w", encoding="utf-8") as f:
		json.dump({
			"segments": sorted(segments),
			"threshold": args.threshold,
			"totalImages": n,
			"noDetection": no_detection,
			"flagged": flagged,
			"all": rows,
		}, f, indent="\t")
	print(f"\nSaved details to {out_path}")


if __name__ == "__main__":
	main()
