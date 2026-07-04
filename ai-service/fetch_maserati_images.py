"""
Targeted fetch of reference images for all Maserati catalogue entries.

Run from the ai-service directory:
    python fetch_maserati_images.py
"""

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = Path(__file__).parent
LABELS_PATH = BASE / "model" / "class_labels.json"
IMAGES_DIR = BASE / "model" / "reference_images"
OUT_PATH = BASE / "model" / "reference_images.json"
EMBEDDINGS_CACHE = BASE / "model" / "reference_embeddings.pt"

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKI_API = "https://en.wikipedia.org/w/api.php"
UA = "StreetScoutThesis/1.0 (university thesis, contact: student)"

IMAGES_PER_ENTRY = 8

_SKIP = {"logo", "flag", "icon", "map", "symbol", "badge", "coat", "seal",
         "emblem", "sign", "crest", "shield", "wordmark", "schematic",
         "diagram", "interior", "engine", "dashboard", "wheel", "seat",
         "door", "mirror", "detail", "plate"}

# Generation-specific search queries for each catalogue key
MASERATI_QUERIES: dict[str, list[str]] = {
    "Maserati|Ghibli|III": [
        "Maserati Ghibli M157",
        "Maserati Ghibli 2013",
        "Maserati Ghibli III",
        "Maserati Ghibli",
    ],
    "Maserati|GranTurismo|I": [
        "Maserati GranTurismo 2007",
        "Maserati GranTurismo M145",
        "Maserati GranTurismo first generation",
        "Maserati GranTurismo coupe",
    ],
    "Maserati|GranTurismo|II": [
        "Maserati GranTurismo 2022",
        "Maserati GranTurismo Folgore",
        "Maserati GranTurismo 2023",
        "Maserati GranTurismo second generation",
    ],
    "Maserati|Grecale|I": [
        "Maserati Grecale 2022",
        "Maserati Grecale SUV",
        "Maserati Grecale",
    ],
    "Maserati|Levante|I": [
        "Maserati Levante 2016",
        "Maserati Levante SUV",
        "Maserati Levante",
    ],
    "Maserati|Quattroporte|VI": [
        "Maserati Quattroporte VI 2013",
        "Maserati Quattroporte M156",
        "Maserati Quattroporte 2013",
        "Maserati Quattroporte sixth generation",
    ],
}

# Commons categories to try per entry (checked first — most reliable)
MASERATI_CATEGORIES: dict[str, list[str]] = {
    "Maserati|Ghibli|III": ["Maserati Ghibli M157", "Maserati Ghibli"],
    "Maserati|GranTurismo|I": ["Maserati GranTurismo"],
    "Maserati|GranTurismo|II": ["Maserati GranTurismo Folgore", "Maserati GranTurismo (2022)"],
    "Maserati|Grecale|I": ["Maserati Grecale"],
    "Maserati|Levante|I": ["Maserati Levante"],
    "Maserati|Quattroporte|VI": ["Maserati Quattroporte VI", "Maserati Quattroporte"],
}


def _get(base: str, params: dict) -> dict:
    url = base + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def _is_photo(title: str) -> bool:
    tl = title.lower()
    if not any(tl.endswith(ext) for ext in (".jpg", ".jpeg", ".png")):
        return False
    return not any(w in tl for w in _SKIP)


def _imageinfo_url(api: str, title: str) -> str | None:
    try:
        data = _get(api, {
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url",
            "iiurlwidth": 800,
            "format": "json",
        })
        for page in data.get("query", {}).get("pages", {}).values():
            infos = page.get("imageinfo", [])
            if infos:
                return infos[0].get("thumburl") or infos[0].get("url")
    except Exception:
        pass
    return None


def _category_files(cat_name: str, limit: int = 30) -> list[str]:
    try:
        data = _get(COMMONS_API, {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{cat_name}",
            "cmtype": "file",
            "cmlimit": limit,
            "format": "json",
        })
        return [
            m["title"] for m in data.get("query", {}).get("categorymembers", [])
            if _is_photo(m.get("title", ""))
        ]
    except Exception:
        return []


def _search_files(query: str, limit: int = 15) -> list[str]:
    try:
        data = _get(COMMONS_API, {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srnamespace": 6,
            "srlimit": limit,
            "format": "json",
        })
        return [
            r["title"] for r in data.get("query", {}).get("search", [])
            if _is_photo(r.get("title", ""))
        ]
    except Exception:
        return []


def download(url: str, dest: Path) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            dest.write_bytes(r.read())
        return True
    except Exception:
        return False


def collect_titles(key: str, need: int) -> list[str]:
    titles: list[str] = []
    seen: set[str] = set()

    def add(new: list[str]) -> None:
        for t in new:
            if t not in seen and len(titles) < need + 5:
                seen.add(t)
                titles.append(t)

    # 1. Commons categories (most reliable)
    for cat in MASERATI_CATEGORIES.get(key, []):
        add(_category_files(cat))
        time.sleep(0.3)

    # 2. Search queries
    for q in MASERATI_QUERIES.get(key, []):
        add(_search_files(q))
        time.sleep(0.3)

    return titles


def main() -> None:
    with open(LABELS_PATH, encoding="utf-8") as f:
        labels: dict = json.load(f)

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # Load existing mapping
    mapping: dict[str, list[str]] = {}
    if OUT_PATH.exists():
        raw = json.load(open(OUT_PATH, encoding="utf-8"))
        for k, v in raw.items():
            mapping[k] = v if isinstance(v, list) else [v]

    maserati_keys = [k for k in labels if k.startswith("Maserati|")]
    print(f"Processing {len(maserati_keys)} Maserati entries.\n")

    for key in maserati_keys:
        meta = labels[key]
        label = f"{meta['modelName']} · {meta['generationCode']} ({meta.get('startYear', '?')})"
        slug = f"Maserati_{meta['modelName']}_{meta['generationCode']}".replace(" ", "_").replace("/", "-")

        existing = sorted(IMAGES_DIR.glob(f"{slug}*.jpg"))
        have = len(existing)

        print(f"  {label}: ", end="", flush=True)

        if have >= IMAGES_PER_ENTRY:
            mapping[key] = [str(p) for p in existing]
            print(f"already have {have} images ✓")
            continue

        need = IMAGES_PER_ENTRY - have
        titles = collect_titles(key, need)

        new_paths: list[Path] = []
        idx = have
        for title in titles:
            if len(new_paths) >= need:
                break
            url = _imageinfo_url(COMMONS_API, title) or _imageinfo_url(WIKI_API, title)
            if not url:
                continue
            dest = IMAGES_DIR / f"{slug}_{idx}.jpg"
            if not dest.exists() and download(url, dest):
                new_paths.append(dest)
                idx += 1
                time.sleep(0.3)

        all_paths = existing + new_paths
        mapping[key] = [str(p) for p in all_paths]

        with open(OUT_PATH, "w", encoding="utf-8") as f:
            json.dump(mapping, f, indent="\t")

        print(f"downloaded {len(new_paths)} → {len(all_paths)} total")

    # Delete embeddings cache so model_loader recomputes
    if EMBEDDINGS_CACHE.exists():
        EMBEDDINGS_CACHE.unlink()
        print("\nEmbeddings cache deleted — will recompute on next service start.")

    print("\nDone. Restart the AI service to rebuild the FAISS index.")


if __name__ == "__main__":
    main()
