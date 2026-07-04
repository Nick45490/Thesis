"""
Retry fetching images for all generations that have fewer than MIN_COUNT photos.

Strategy:
  - Deletes the existing (low-quality) images for each under-count generation.
  - Re-fetches with a higher target (OVERSAMPLE) so CLIP has more candidates to
    score against both pairwise consistency AND a text anchor for the model name.
  - Saves progress after every generation so the run is safe to interrupt.

Usage:
    python fetch_low_count.py              # retry all gens with < 6 images
    python fetch_low_count.py --min 4      # only retry gens with < 4 images
"""

import json
import sys
from pathlib import Path

from fetch_generation_images import (
    EMBEDDINGS_CACHE,
    IMAGES_DIR,
    IMAGES_PER_GEN,
    LABELS_PATH,
    OUT_PATH,
    fetch_gen,
)

MIN_COUNT = 20     # retry generations below this threshold
OVERSAMPLE = 20    # fetch_gen target (angle slots + general fill)


def main() -> None:
    global MIN_COUNT
    if "--min" in sys.argv:
        try:
            MIN_COUNT = int(sys.argv[sys.argv.index("--min") + 1])
        except (IndexError, ValueError):
            pass

    labels: dict = json.load(open(LABELS_PATH, encoding="utf-8"))

    mapping: dict = {}
    if OUT_PATH.exists():
        raw = json.load(open(OUT_PATH, encoding="utf-8"))
        for k, v in raw.items():
            mapping[k] = v if isinstance(v, list) else [v]

    # Find under-count generations, preserving catalogue order
    targets: list[tuple[str, dict, int]] = []
    for key, meta in sorted(labels.items(), key=lambda x: x[1]["generationId"]):
        existing = [p for p in mapping.get(key, []) if Path(p).exists()]
        if len(existing) < MIN_COUNT:
            targets.append((key, meta, len(existing)))

    total = len(targets)
    print(f"Found {total} generation(s) with < {MIN_COUNT} images (target oversample={OVERSAMPLE}).\n")

    for i, (key, meta, have) in enumerate(targets, 1):
        make = meta["manufacturerName"]
        model = meta["modelName"]
        gen_code = meta["generationCode"]
        start_year = meta.get("startYear")

        print(f"[{i}/{total}] {make} {model} {gen_code}  (currently {have} images)")

        # fetch_gen always deletes and re-fetches from scratch
        fetch_gen(
            make=make,
            model=model,
            gen_code=gen_code,
            start_year=start_year,
            catalogue_key=key,
            mapping=mapping,
            target=OVERSAMPLE,
        )

        with open(OUT_PATH, "w", encoding="utf-8") as f:
            json.dump(mapping, f, indent="\t")

    if EMBEDDINGS_CACHE.exists():
        EMBEDDINGS_CACHE.unlink()
        print("\nEmbeddings cache deleted - will recompute on next restart.")

    print(f"\nDone. Restart the AI service to rebuild the FAISS index.")


if __name__ == "__main__":
    main()
