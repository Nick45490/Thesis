"""
End-to-end evaluation against the held-out test set built by model_loader._build_index.

Runs each held-out image through the live CarClassifier.predict() (the same code path
the API uses — YOLO crop, CLIP embed with test-time augmentation, then classifier/FAISS)
and reports overall top-1/top-5 accuracy plus a per-(make,model) breakdown and the
worst-confused pairs.

Run this after the ai-service has rebuilt reference_embeddings.pt at least once (so
model/held_out_test_set.json exists) and after train_classifier.py has produced an
up-to-date classifier.pkl.

Usage:
    python evaluate.py
    python evaluate.py --no-lora --classifier model/classifier_no_lora.pkl \\
        --cache model/reference_embeddings_no_lora.pt --label no_lora
"""

import argparse
import json
from collections import Counter
from pathlib import Path

from src.model_loader import CarClassifier, load_labels_dict, HELD_OUT_PATH, LORA_DIR, CLASSIFIER_PATH, EMBEDDINGS_CACHE

BASE_DIR = Path(__file__).parent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--classifier", type=Path, default=CLASSIFIER_PATH)
    parser.add_argument("--cache", type=Path, default=EMBEDDINGS_CACHE)
    parser.add_argument("--no-lora", action="store_true", help="Use base CLIP, ignoring any clip_lora adapter")
    parser.add_argument("--label", default="", help="Suffix for the results filename, e.g. 'no_lora'")
    args = parser.parse_args()

    results_path = BASE_DIR / "model" / (f"eval_results_{args.label}.json" if args.label else "eval_results.json")

    if not HELD_OUT_PATH.exists():
        print("ERROR: held_out_test_set.json not found.")
        print("Start the ai-service once (it builds this file as part of _build_index), then re-run this script.")
        return

    labels_dict = load_labels_dict()
    print("Loading CarClassifier (YOLO + CLIP + classifier/FAISS) …")
    # Constructing this runs _build_index(), which normalizes held_out_test_set.json's
    # paths to the local filesystem (e.g. a file placed here from a Colab run still has
    # Colab-style paths until this runs once) — so load the held-out set only after.
    classifier = CarClassifier(
        labels_dict,
        lora_dir=None if args.no_lora else LORA_DIR,
        classifier_path=args.classifier,
        embeddings_cache=args.cache,
    )

    with HELD_OUT_PATH.open("r", encoding="utf-8") as f:
        held_out: dict = json.load(f)

    print(f"Loaded {len(held_out)} held-out test images.")

    top1_correct = 0
    top5_correct = 0
    total = 0
    skipped = 0

    pair_total: Counter = Counter()
    pair_correct: Counter = Counter()
    confusion: Counter = Counter()   # (actual_pair, predicted_pair) -> count

    for key, img_path in held_out.items():
        p = Path(img_path)
        if key not in labels_dict or not p.exists():
            skipped += 1
            continue

        actual_meta = labels_dict[key]
        actual_pair = (actual_meta["manufacturerName"], actual_meta["modelName"])

        image_bytes = p.read_bytes()
        try:
            label, confidence, meta, candidates, no_vehicle_detected = classifier.predict(image_bytes)
        except Exception as exc:
            print(f"  Skipping {p.name}: {exc}")
            skipped += 1
            continue

        total += 1
        pair_total[actual_pair] += 1

        predicted_keys_top5 = [c["key"] for c in candidates[:5]]
        is_top1 = label == key
        is_top5 = key in predicted_keys_top5

        if is_top1:
            top1_correct += 1
            pair_correct[actual_pair] += 1
        else:
            predicted_pair = (
                (meta["manufacturerName"], meta["modelName"]) if meta else ("unknown", "unknown")
            )
            confusion[(actual_pair, predicted_pair)] += 1

        if is_top5:
            top5_correct += 1

    if total == 0:
        print("No valid held-out images evaluated.")
        return

    top1_acc = top1_correct / total
    top5_acc = top5_correct / total

    print(f"\nEvaluated {total} held-out images ({skipped} skipped).")
    print(f"Top-1 accuracy: {top1_acc:.3f}")
    print(f"Top-5 accuracy: {top5_acc:.3f}")

    per_pair = []
    for pair, n in pair_total.items():
        acc = pair_correct[pair] / n
        per_pair.append({
            "manufacturerName": pair[0],
            "modelName": pair[1],
            "count": n,
            "accuracy": round(acc, 3),
        })
    per_pair.sort(key=lambda r: r["accuracy"])

    worst_confusion = [
        {
            "actual": {"manufacturerName": a[0], "modelName": a[1]},
            "predicted": {"manufacturerName": pr[0], "modelName": pr[1]},
            "count": n,
        }
        for (a, pr), n in confusion.most_common(30)
    ]

    print("\nWorst-performing (make, model) pairs:")
    for row in per_pair[:15]:
        print(f"  {row['manufacturerName']} {row['modelName']}: {row['accuracy']:.2f} ({row['count']} sample(s))")

    results = {
        "total": total,
        "skipped": skipped,
        "top1Accuracy": round(top1_acc, 4),
        "top5Accuracy": round(top5_acc, 4),
        "perPair": per_pair,
        "worstConfusion": worst_confusion,
    }
    with results_path.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent="\t")
    print(f"\nSaved detailed results to {results_path}")


if __name__ == "__main__":
    main()
