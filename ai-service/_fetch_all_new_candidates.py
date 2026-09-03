"""One-off: fetch reference images for all 48 newly-added 2020+ catalogue
generations, one at a time, in a single process (avoids reloading YOLO/CLIP
per model) and via fetch_gen() directly (avoids fetch_generation_images.py's
main(), which deletes+re-fetches EVERY generation of a given model -- several
of these 48 are new generations of models that already have good reference
photos for their older generations, e.g. BMW 5 Series F10/G30).

A short delay between generations keeps us under Wikimedia Commons' anonymous
rate limit (we hit a 429 running just 8 of these back-to-back earlier).
Saves reference_images.json after every generation so a crash/interrupt
doesn't lose progress already made.
"""

import json
import time
from pathlib import Path

import fetch_generation_images as fgi

BASE = Path(__file__).parent
LABELS_PATH = BASE / "model" / "class_labels.json"
OUT_PATH = BASE / "model" / "reference_images.json"

DELAY_BETWEEN_GENS = 12  # seconds

# (modelName, generationCode) for all 48 new candidates
TARGETS = [
    ("5 Series", "G60"), ("i5", "G60e"), ("i7", "G70e"), ("iX2", "U11e"), ("XM", "G09"),
    ("X3", "G45"), ("1 Series", "F70"),
    ("ID.Buzz", "I"), ("Amarok", "II"), ("Tayron", "I"),
    ("CLE", "C236"),
    ("Capri", "I"), ("Explorer (EV)", "I"),
    ("5 E-Tech", "I"), ("Symbioz", "I"),
    ("EV3", "I"), ("EV5", "I"),
    ("A6 e-tron", "I"),
    ("Santa Fe", "V"),
    ("3008", "III"), ("5008", "III"),
    ("CX-90", "I"),
    ("Z", "RZ34"),
    ("Swift", "V"),
    ("LBX", "J410"),
    ("C3", "IV"),
    ("Grandland", "II"),
    ("Grande Panda", "I"), ("Topolino", "I"),
    ("Cooper", "F66"),
    ("Smart #5", "HX21"),
    ("Ypsilon", "IV"),
    ("12Cilindri", "I"),
    ("Temerario", "I"),
    ("DB12", "I"), ("Vanquish", "I"),
    ("ASX", "II"), ("Colt", "VII"),
    ("Wagoneer", "I"),
    ("Blazer EV", "I"),
    ("Charger", "VIII"), ("Hornet", "I"),
    ("Escalade IQ", "I"), ("Optiq", "I"),
    ("GR86", "ZN8"), ("GR Corolla", "I"), ("Corolla Cross", "I"), ("Land Cruiser Prado", "J250"),
]

with open(LABELS_PATH, encoding="utf-8") as f:
    labels: dict = json.load(f)

# Build (modelName, generationCode) -> (catalogue_key, meta) lookup
by_model_gen = {}
for key, meta in labels.items():
    by_model_gen[(meta["modelName"], meta["generationCode"])] = (key, meta)

fgi.IMAGES_DIR.mkdir(parents=True, exist_ok=True)

mapping: dict = {}
if OUT_PATH.exists():
    raw = json.load(open(OUT_PATH, encoding="utf-8"))
    for k, v in raw.items():
        mapping[k] = v if isinstance(v, list) else [v]


def save():
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent="\t")


results = []
for i, target in enumerate(TARGETS, 1):
    found = by_model_gen.get(target)
    if not found:
        print(f"[{i}/{len(TARGETS)}] SKIP - not found in class_labels.json: {target}")
        results.append((target, "NOT_FOUND", 0))
        continue
    key, meta = found
    print(f"\n[{i}/{len(TARGETS)}] {meta['manufacturerName']} {meta['modelName']} {meta['generationCode']}")
    try:
        paths = fgi.fetch_gen(
            make=meta["manufacturerName"],
            model=meta["modelName"],
            gen_code=meta["generationCode"],
            start_year=meta.get("startYear"),
            catalogue_key=key,
            mapping=mapping,
        )
        results.append((target, "OK", len(paths)))
    except Exception as e:
        print(f"  ERROR: {type(e).__name__}: {e}")
        results.append((target, "ERROR", 0))
    save()
    if i < len(TARGETS):
        time.sleep(DELAY_BETWEEN_GENS)

print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)
low = [r for r in results if r[1] == "OK" and r[2] < 30]
failed = [r for r in results if r[1] != "OK"]
for target, status, count in results:
    flag = ""
    if status != "OK":
        flag = "  <-- " + status
    elif count < 30:
        flag = f"  <-- only {count}"
    print(f"  {target[0]:24s} {target[1]:8s} {count:3d}{flag}")
print(f"\n{len(results) - len(low) - len(failed)}/{len(results)} got >=30 images, "
      f"{len(low)} got <30, {len(failed)} failed outright.")
