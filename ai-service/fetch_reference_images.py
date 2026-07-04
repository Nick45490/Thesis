"""
Fetch multiple reference images per car model from Wikimedia Commons + Wikipedia.

Run once from the ai-service directory:
    python fetch_reference_images.py

Resumes automatically — already-downloaded images are skipped.
Target: IMAGES_PER_MODEL diverse photos per make+model.
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

WIKI_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
UA = "StreetScoutThesis/1.0 (university thesis, contact: student)"

IMAGES_PER_MODEL = 8   # target number of reference images per make+model

_SKIP = {"logo", "flag", "icon", "map", "symbol", "badge", "coat", "seal",
         "emblem", "sign", "crest", "shield", "wordmark", "schematic",
         "diagram", "interior", "engine", "dashboard", "wheel", "trunk",
         "detail", "badge", "plate", "seat", "door", "mirror", "light"}


# ── low-level ─────────────────────────────────────────────────────────────────

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
            "iiurlwidth": 640,
            "format": "json",
        })
        for page in data.get("query", {}).get("pages", {}).values():
            infos = page.get("imageinfo", [])
            if infos:
                return infos[0].get("thumburl") or infos[0].get("url")
    except Exception:
        pass
    return None


# ── Commons ────────────────────────────────────────────────────────────────────

def _commons_category_files(cat_name: str, limit: int = 20) -> list[str]:
    """Return up to `limit` photo file titles from a Commons category."""
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


def _commons_search_files(query: str, limit: int = 10) -> list[str]:
    """Full-text search in Commons file namespace; return photo titles."""
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


# ── Wikipedia ─────────────────────────────────────────────────────────────────

def _wiki_thumbnail(title: str) -> str | None:
    try:
        data = _get(WIKI_API, {
            "action": "query",
            "titles": title,
            "prop": "pageimages",
            "pithumbsize": 640,
            "pilimit": 1,
            "format": "json",
        })
        for page in data.get("query", {}).get("pages", {}).values():
            if "missing" not in page:
                thumb = page.get("thumbnail", {}).get("source")
                if thumb:
                    return thumb
    except Exception:
        pass
    return None


def _wiki_search_title(query: str) -> str | None:
    try:
        data = _get(WIKI_API, {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": 3,
            "format": "json",
        })
        results = data.get("query", {}).get("search", [])
        return results[0]["title"] if results else None
    except Exception:
        return None


def _wiki_article_image_titles(article_title: str) -> list[str]:
    try:
        data = _get(WIKI_API, {
            "action": "query",
            "titles": article_title,
            "prop": "images",
            "imlimit": 20,
            "format": "json",
        })
        for page in data.get("query", {}).get("pages", {}).values():
            if "missing" not in page:
                return [
                    img["title"] for img in page.get("images", [])
                    if _is_photo(img.get("title", ""))
                ]
    except Exception:
        pass
    return []


# ── combined: collect up to N file titles for a make+model ────────────────────

def collect_file_titles(make: str, model: str, target: int) -> list[str]:
    titles: list[str] = []
    seen: set[str] = set()

    def add(new_titles: list[str]) -> None:
        for t in new_titles:
            if t not in seen and len(titles) < target:
                seen.add(t)
                titles.append(t)

    # 1. Commons category (best source — curated photos)
    add(_commons_category_files(f"{make} {model}", limit=target))

    if len(titles) >= target:
        return titles

    # 2. Commons search variants
    for q in [f"{make} {model}", f"{make} {model} automobile"]:
        add(_commons_search_files(q, limit=target))
        if len(titles) >= target:
            return titles

    # 3. Wikipedia article images → resolved from Commons
    for q in [f"{make} {model}", f"{make} {model} automobile"]:
        wiki_title = _wiki_search_title(q) or f"{make} {model}"
        add(_wiki_article_image_titles(wiki_title))
        if len(titles) >= target:
            return titles

    return titles


def download(url: str, dest: Path) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            dest.write_bytes(r.read())
        return True
    except Exception:
        return False


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    with open(LABELS_PATH, encoding="utf-8") as f:
        labels: dict = json.load(f)

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # mapping: catalogue_key → list of local image paths
    mapping: dict[str, list[str]] = {}
    if OUT_PATH.exists():
        raw = json.load(open(OUT_PATH, encoding="utf-8"))
        # Support both old (str) and new (list) format
        for k, v in raw.items():
            mapping[k] = v if isinstance(v, list) else [v]

    seen: set = set()
    pairs: list[tuple[str, str]] = []
    for data in labels.values():
        pair = (data["manufacturerName"], data["modelName"])
        if pair not in seen:
            seen.add(pair)
            pairs.append(pair)

    total = len(pairs)
    print(f"Target: {IMAGES_PER_MODEL} images per model, {total} models.\n")

    for i, (make, model) in enumerate(pairs):
        slug = f"{make}_{model}".replace(" ", "_").replace("/", "-")

        # Find keys for this make+model
        keys = [
            k for k, d in labels.items()
            if d["manufacturerName"] == make and d["modelName"] == model
        ]

        # How many images already downloaded for this pair?
        existing = [
            p for p in IMAGES_DIR.glob(f"{slug}_*.jpg")
            if p.exists()
        ]
        # Also count the old single-image format
        old_path = IMAGES_DIR / f"{slug}.jpg"
        if old_path.exists() and old_path not in existing:
            existing.append(old_path)

        have = len(existing)

        if have >= IMAGES_PER_MODEL:
            for key in keys:
                mapping[key] = [str(p) for p in existing[:IMAGES_PER_MODEL]]
            print(f"[{i+1}/{total}] {make} {model}  ({have} images, skipping)")
            continue

        need = IMAGES_PER_MODEL - have
        print(f"[{i+1}/{total}] {make} {model}  (have {have}, fetching {need} more) … ", end="", flush=True)

        file_titles = collect_file_titles(make, model, target=need + 5)  # fetch extra in case some fail

        new_paths: list[Path] = []
        idx = have  # start numbering after existing images
        for title in file_titles:
            if len(new_paths) >= need:
                break
            url = _imageinfo_url(COMMONS_API, title) or _imageinfo_url(WIKI_API, title)
            if not url:
                continue
            dest = IMAGES_DIR / f"{slug}_{idx}.jpg"
            if download(url, dest):
                new_paths.append(dest)
                idx += 1
            time.sleep(0.3)

        all_paths = existing + new_paths
        for key in keys:
            mapping[key] = [str(p) for p in all_paths]

        total_now = len(all_paths)
        print(f"+{len(new_paths)} → {total_now} total")

        with open(OUT_PATH, "w", encoding="utf-8") as f:
            json.dump(mapping, f, indent="\t")

        time.sleep(0.3)

    covered = sum(1 for k, v in mapping.items() if v)
    print(f"\nDone. {covered}/{len(labels)} catalogue entries have reference images.")
    print(f"Mapping saved → {OUT_PATH}")


if __name__ == "__main__":
    main()
