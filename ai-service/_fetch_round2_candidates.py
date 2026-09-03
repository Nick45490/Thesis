"""One-off: fetch reference images for the 60 round-2 catalogue candidates
(found via live web-search verification after the first 48-item batch), one
at a time in a single process, via fetch_gen() directly so generations of
already-covered models (Mercedes CLA/GLA/GLB, Subaru Forester) don't get
their existing older-generation photos deleted and re-fetched.

A short delay between generations keeps us under Wikimedia Commons' rate
limit. Saves reference_images.json after every generation.
"""

import json
import time
from pathlib import Path

import fetch_generation_images as fgi

BASE = Path(__file__).parent
LABELS_PATH = BASE / "model" / "class_labels.json"
OUT_PATH = BASE / "model" / "reference_images.json"

DELAY_BETWEEN_GENS = 12  # seconds

# (modelName, generationCode) for all 60 round-2 candidates
TARGETS = [
    ("iX3 (Neue Klasse)", "NA5"), ("i3 (Neue Klasse)", "NA0"),
    ("CLA", "C299"), ("GLA", "H248"), ("GLB", "X248"), ("GLC with EQ Technology", "X540"),
    ("4 E-Tech", "I"),
    ("Epiq", "I"),
    ("Q9", "I"),
    ("XC70", "I"), ("ES90", "I"),
    ("Cayenne Electric", "I"),
    ("Smart #6", "I"),
    ("N°8", "I"),
    ("Raval", "I"),
    ("MC20", "I"), ("GranCabrio", "II"),
    ("Bacalar", "I"), ("Batur", "I"),
    ("Valkyrie", "I"), ("Valhalla", "I"),
    ("Elva", "I"), ("Solus GT", "I"), ("W1", "I"),
    ("Evija", "I"), ("Emeya", "I"),
    ("Polestar 5", "I"),
    ("MG7", "I"), ("IM5", "I"), ("IM6", "I"),
    ("Yaris Cross", "I"), ("Crown", "S20"), ("Grand Highlander", "I"), ("Century", "I"),
    ("Elevate", "I"), ("Prelude", "VI"),
    ("Casper", "I"), ("Staria", "I"),
    ("EV4", "I"), ("Tasman", "I"), ("K4", "I"),
    ("Magnite", "I"), ("Kicks", "II"),
    ("CX-50", "I"), ("CX-80", "I"),
    ("Destinator", "I"),
    ("Fronx", "I"), ("eVitara", "I"),
    ("Forester", "SL"),
    ("TX", "K1"), ("GX", "J250"),
    ("Wagoneer S", "I"), ("Recon", "I"),
    ("Trailblazer", "II"), ("Equinox EV", "I"), ("Silverado EV", "I"),
    ("Vistiq", "I"), ("Celestiq", "I"),
    ("GV80 Coupe", "I"), ("GV90", "I"),
]

with LABELS_PATH.open(encoding="utf-8") as f:
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
    print(f"  {target[0]:26s} {target[1]:8s} {count:3d}{flag}")
print(f"\n{len(results) - len(low) - len(failed)}/{len(results)} got >=30 images, "
      f"{len(low)} got <30, {len(failed)} failed outright.")
