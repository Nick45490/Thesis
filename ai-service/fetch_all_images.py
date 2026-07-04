"""
Fetch reference images for every make+model in class_labels.json, in catalogue order.
Skips any make+model that already has >= IMAGES_PER_GEN images for every generation.
Saves progress to reference_images.json after each model so the run can be interrupted.

Usage:
    python fetch_all_images.py
    python fetch_all_images.py --start-from "BMW"          # skip to this manufacturer
    python fetch_all_images.py --start-from "BMW 3 Series" # skip to specific model
"""

import json
import sys
from pathlib import Path

# Re-use everything from the per-model script
from fetch_generation_images import (
    LABELS_PATH,
    IMAGES_DIR,
    OUT_PATH,
    EMBEDDINGS_CACHE,
    IMAGES_PER_GEN,
    fetch_gen,
)


def main() -> None:
    start_from = ""
    if len(sys.argv) >= 3 and sys.argv[1] == "--start-from":
        start_from = sys.argv[2].strip().lower()

    with open(LABELS_PATH, encoding="utf-8") as f:
        labels: dict = json.load(f)

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    mapping: dict = {}
    if OUT_PATH.exists():
        raw = json.load(open(OUT_PATH, encoding="utf-8"))
        for k, v in raw.items():
            mapping[k] = v if isinstance(v, list) else [v]

    # Build ordered list of unique (make, model) pairs
    seen_pairs: set[tuple[str, str]] = set()
    ordered_pairs: list[tuple[str, str]] = []
    for meta in sorted(labels.values(), key=lambda x: x["generationId"]):
        pair = (meta["manufacturerName"], meta["modelName"])
        if pair not in seen_pairs:
            seen_pairs.add(pair)
            ordered_pairs.append(pair)

    total = len(ordered_pairs)
    print(f"Catalogue: {total} unique make+model pairs.\n")

    skipping = bool(start_from)

    for idx, (make, model) in enumerate(ordered_pairs, 1):
        label = f"{make} {model}"

        if skipping:
            if start_from in label.lower() or start_from in make.lower():
                skipping = False
            else:
                continue

        # Find all generations for this pair
        gens = {
            k: v for k, v in labels.items()
            if v["manufacturerName"] == make and v["modelName"] == model
        }

        print(f"\n[{idx}/{total}] {label} - {len(gens)} generation(s)")

        for key, meta in sorted(gens.items(), key=lambda x: x[1].get("startYear") or 0):
            fetch_gen(
                make=meta["manufacturerName"],
                model=meta["modelName"],
                gen_code=meta["generationCode"],
                start_year=meta.get("startYear"),
                catalogue_key=key,
                mapping=mapping,
            )

        # Save progress after each model
        with open(OUT_PATH, "w", encoding="utf-8") as f:
            json.dump(mapping, f, indent="\t")

    # Delete embeddings cache so service rebuilds on next restart
    if EMBEDDINGS_CACHE.exists():
        EMBEDDINGS_CACHE.unlink()
        print("\nEmbeddings cache deleted - will recompute on next restart.")

    print(f"\nAll done. Restart the AI service to rebuild the FAISS index.")


if __name__ == "__main__":
    main()
