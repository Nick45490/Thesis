"""
Retry fetching images for all generations that have fewer than MIN_COUNT photos.

Strategy:
  - Deletes the existing (low-quality) images for each under-count generation.
  - Re-fetches with a higher target (OVERSAMPLE) so CLIP has more candidates to
    score against both pairwise consistency AND a text anchor for the model name.
  - Saves progress after every generation so the run is safe to interrupt.

Usage:
    python fetch_low_count.py                        # full pass, all gens with < MIN_COUNT images
    python fetch_low_count.py --min 4                 # only retry gens with < 4 images
    python fetch_low_count.py --resume                 # continue after the last completed generationId
    python fetch_low_count.py --start-after 10553      # explicitly start after a given generationId
"""

import json
import sys
from pathlib import Path

from fetch_generation_images import (
    IMAGES_DIR,
    IMAGES_PER_GEN,
    LABELS_PATH,
    OUT_PATH,
    fetch_gen,
)

MIN_COUNT = 20     # retry generations below this threshold
OVERSAMPLE = 20    # fetch_gen target (angle slots + general fill)

# Tracks progress through a single pass over the catalogue (by generationId) so a
# restart resumes where it left off instead of re-scanning everything from the top
# every time — most generations never reach exactly MIN_COUNT even after being
# processed (the quality filter has a real ceiling below 20 for most cars), so
# without this a "resume" would otherwise reprocess the entire catalogue again.
CHECKPOINT_PATH = Path(__file__).parent / "model" / "fetch_low_count_progress.json"


def load_checkpoint() -> int | None:
    if not CHECKPOINT_PATH.exists():
        return None
    try:
        return json.load(open(CHECKPOINT_PATH, encoding="utf-8")).get("last_completed_generation_id")
    except Exception:
        return None


def save_checkpoint(generation_id: int) -> None:
    json.dump({"last_completed_generation_id": generation_id}, open(CHECKPOINT_PATH, "w", encoding="utf-8"))


def main() -> None:
    global MIN_COUNT
    if "--min" in sys.argv:
        try:
            MIN_COUNT = int(sys.argv[sys.argv.index("--min") + 1])
        except (IndexError, ValueError):
            pass

    start_after: int | None = None
    if "--start-after" in sys.argv:
        try:
            start_after = int(sys.argv[sys.argv.index("--start-after") + 1])
        except (IndexError, ValueError):
            pass
    elif "--resume" in sys.argv:
        start_after = load_checkpoint()

    labels: dict = json.load(open(LABELS_PATH, encoding="utf-8"))

    mapping: dict = {}
    if OUT_PATH.exists():
        raw = json.load(open(OUT_PATH, encoding="utf-8"))
        for k, v in raw.items():
            mapping[k] = v if isinstance(v, list) else [v]

    # Find under-count generations, preserving catalogue order
    targets: list[tuple[str, dict, int]] = []
    for key, meta in sorted(labels.items(), key=lambda x: x[1]["generationId"]):
        if start_after is not None and meta["generationId"] <= start_after:
            continue
        existing = [p for p in mapping.get(key, []) if Path(p).exists()]
        if len(existing) < MIN_COUNT:
            targets.append((key, meta, len(existing)))

    total = len(targets)
    if start_after is not None:
        print(f"Resuming after generationId {start_after}.")
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

        save_checkpoint(meta["generationId"])

    # Reached the end of the catalogue in this pass — clear the checkpoint so a
    # future deliberate re-run starts fresh from the top rather than finding
    # nothing left to do.
    if CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()

    print(f"\nDone. Restart the AI service — it will pick up the new/changed images "
          f"incrementally (only they get embedded, not the whole reference set).")


if __name__ == "__main__":
    main()
