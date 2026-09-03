"""
Fetch per-generation reference images for a specific make + model.

Usage:
    python fetch_generation_images.py "Alfa Romeo" "147"
    python fetch_generation_images.py "Volkswagen" "Golf"

Downloads IMAGES_PER_GEN images per generation using generation-specific
search queries. Leaves the embeddings cache alone — _build_index() (see
src/model_loader.py) reconciles it incrementally on the next ai-service
startup, embedding only the new/changed images rather than recomputing the
whole reference set.
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    from ddgs import DDGS
    _DDG_AVAILABLE = True
except ImportError:
    _DDG_AVAILABLE = False

BASE = Path(__file__).parent
LABELS_PATH = BASE / "model" / "class_labels.json"
IMAGES_DIR = BASE / "model" / "reference_images"
OUT_PATH = BASE / "model" / "reference_images.json"

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKI_API = "https://en.wikipedia.org/w/api.php"
UA = "StreetScoutThesis/1.0 (university thesis, contact: student)"

IMAGES_PER_GEN = 35
ANGLE_SLOTS = {"front": 6, "rear": 6, "side": 6, "three_quarter": 6}  # 24 guaranteed
GENERAL_SLOTS = IMAGES_PER_GEN - sum(ANGLE_SLOTS.values())             # 11 from Commons + DDG fill

_SKIP = {"logo", "flag", "icon", "map", "symbol", "coat", "seal",
         "emblem", "crest", "shield", "wordmark", "schematic",
         "diagram", "interior", "engine", "dashboard",
         "infographic", "brochure", "advertisement"}


# -─ API helpers -───────────────────────────────────────────────────────────────

_commons_blocked_until = 0.0


def _get(base: str, params: dict) -> dict:
    global _commons_blocked_until
    if time.time() < _commons_blocked_until:
        return {}
    url = base + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt == 0:
                print("  Commons rate-limited (429), backing off 15s...", flush=True)
                time.sleep(15)
                continue
            if e.code == 429:
                # Still limited after one retry -- stop hammering it for a while
                # and let the rest of this run fall back to DDG-only sourcing.
                _commons_blocked_until = time.time() + 180
                print("  Still rate-limited -- pausing Commons calls for 3 min.", flush=True)
                return {}
            raise
    return {}


def _is_photo(title: str) -> bool:
    tl = title.lower()
    if not any(tl.endswith(ext) for ext in (".jpg", ".jpeg", ".png")):
        return False
    return not any(w in tl for w in _SKIP)


def _imageinfo_url(api: str, title: str) -> str | None:
    try:
        data = _get(api, {
            "action": "query", "titles": title,
            "prop": "imageinfo", "iiprop": "url",
            "iiurlwidth": 800, "format": "json",
        })
        for page in data.get("query", {}).get("pages", {}).values():
            infos = page.get("imageinfo", [])
            if infos:
                return infos[0].get("thumburl") or infos[0].get("url")
    except Exception:
        pass
    return None


def _category_files(cat_name: str, limit: int = 50) -> list[str]:
    """Return photo titles from a category, including two levels of subcategories."""
    results: list[str] = []
    try:
        # Direct files
        data = _get(COMMONS_API, {
            "action": "query", "list": "categorymembers",
            "cmtitle": f"Category:{cat_name}", "cmtype": "file",
            "cmlimit": limit, "format": "json",
        })
        results += [m["title"] for m in data.get("query", {}).get("categorymembers", [])
                    if _is_photo(m.get("title", ""))]

        # Level-1 subcategories
        data2 = _get(COMMONS_API, {
            "action": "query", "list": "categorymembers",
            "cmtitle": f"Category:{cat_name}", "cmtype": "subcat",
            "cmlimit": 15, "format": "json",
        })
        subcats = [m["title"].replace("Category:", "")
                   for m in data2.get("query", {}).get("categorymembers", [])]
        for sub in subcats[:8]:
            try:
                sub_data = _get(COMMONS_API, {
                    "action": "query", "list": "categorymembers",
                    "cmtitle": f"Category:{sub}", "cmtype": "file",
                    "cmlimit": 25, "format": "json",
                })
                results += [m["title"] for m in sub_data.get("query", {}).get("categorymembers", [])
                            if _is_photo(m.get("title", ""))]
                time.sleep(0.2)

                # Level-2 subcategories
                sub2_data = _get(COMMONS_API, {
                    "action": "query", "list": "categorymembers",
                    "cmtitle": f"Category:{sub}", "cmtype": "subcat",
                    "cmlimit": 5, "format": "json",
                })
                sub2cats = [m["title"].replace("Category:", "")
                            for m in sub2_data.get("query", {}).get("categorymembers", [])]
                for sub2 in sub2cats[:3]:
                    try:
                        sub2_files = _get(COMMONS_API, {
                            "action": "query", "list": "categorymembers",
                            "cmtitle": f"Category:{sub2}", "cmtype": "file",
                            "cmlimit": 15, "format": "json",
                        })
                        results += [m["title"] for m in sub2_files.get("query", {}).get("categorymembers", [])
                                    if _is_photo(m.get("title", ""))]
                        time.sleep(0.2)
                    except Exception:
                        pass
            except Exception:
                pass
    except Exception:
        pass
    return results


def _search_files(query: str, limit: int = 30) -> list[str]:
    try:
        data = _get(COMMONS_API, {
            "action": "query", "list": "search",
            "srsearch": query, "srnamespace": 6,
            "srlimit": limit, "format": "json",
        })
        return [r["title"] for r in data.get("query", {}).get("search", [])
                if _is_photo(r.get("title", ""))]
    except Exception:
        return []


def _wiki_article_images(article_title: str) -> list[str]:
    try:
        data = _get(WIKI_API, {
            "action": "query", "titles": article_title,
            "prop": "images", "imlimit": 20, "format": "json",
        })
        for page in data.get("query", {}).get("pages", {}).values():
            if "missing" not in page:
                return [img["title"] for img in page.get("images", [])
                        if _is_photo(img.get("title", ""))]
    except Exception:
        pass
    return []


def _ddg_image_urls(query: str, max_results: int = 20) -> list[str]:
    """Return direct image URLs from DuckDuckGo image search."""
    if not _DDG_AVAILABLE:
        return []
    try:
        with DDGS() as ddgs:
            results = list(ddgs.images(
                query,
                max_results=max_results,
                type_image="photo",
                size="Medium",
            ))
        return [r["image"] for r in results if r.get("image")]
    except Exception:
        return []


def _download_url(url: str, dest: Path) -> bool:
    """Download a URL directly to dest. Returns True on success."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        if len(data) < 8_000:   # skip tiny/corrupt files (< 8 KB)
            return False
        dest.write_bytes(data)
        return True
    except Exception:
        return False


# -─ YOLO vehicle detector -─────────────────────────────────────────────────────

_yolo_cache = None
_CAR_CLASSES = {2, 5, 7}   # COCO: car, bus, truck


def _get_yolo():
    global _yolo_cache
    if _yolo_cache is not None:
        return _yolo_cache
    try:
        from ultralytics import YOLO as _YOLO
        print("  Loading YOLO for vehicle detection...", flush=True)
        _yolo_cache = _YOLO(str(BASE / "yolov8n.pt"))
        print("  YOLO ready.", flush=True)
    except Exception as e:
        print(f"  YOLO unavailable ({e}) - skipping vehicle crop", flush=True)
        _yolo_cache = False
    return _yolo_cache


def _yolo_crop(img):
    """Return the largest vehicle crop from a PIL image, or None if no vehicle found."""
    yolo = _get_yolo()
    if not yolo:
        return None
    try:
        results = yolo(img, verbose=False)
        boxes = [b for b in results[0].boxes if int(b.cls[0]) in _CAR_CLASSES]
        if not boxes:
            return None
        best = max(boxes, key=lambda b: (
            (b.xyxy[0][2] - b.xyxy[0][0]) * (b.xyxy[0][3] - b.xyxy[0][1])
        ))
        x1, y1, x2, y2 = (int(v) for v in best.xyxy[0])
        return img.crop((x1, y1, x2, y2))
    except Exception:
        return None


# -─ CLIP visual filter -────────────────────────────────────────────────────────

_clip_cache = None


def _get_clip():
    global _clip_cache
    if _clip_cache is not None:
        return _clip_cache
    try:
        import torch
        from transformers import CLIPModel, CLIPProcessor
        print("  Loading CLIP for visual filtering...", flush=True)
        proc = CLIPProcessor.from_pretrained("openai/clip-vit-large-patch14")
        mdl = CLIPModel.from_pretrained("openai/clip-vit-large-patch14")
        mdl.eval()
        _clip_cache = (mdl, proc)
        print("  CLIP ready.", flush=True)
    except Exception as e:
        print(f"  CLIP unavailable ({e}) - skipping visual filter", flush=True)
        _clip_cache = (None, None)
    return _clip_cache


def _clip_embed_img(path: Path):
    import numpy as np
    import torch
    import torch.nn.functional as F
    from PIL import Image as PILImage
    mdl, proc = _get_clip()
    if mdl is None:
        return None
    try:
        full = PILImage.open(path).convert("RGB")
        img = _yolo_crop(full) or full   # embed the vehicle crop, not the full scene
        enc = proc(images=img, return_tensors="pt")
        with torch.no_grad():
            out = mdl.vision_model(pixel_values=enc["pixel_values"])
            feat = mdl.visual_projection(out.pooler_output)
        return F.normalize(feat[0], dim=-1).cpu().numpy().astype("float32")
    except Exception:
        return None


def _clip_text_embed(text: str):
    import torch
    import torch.nn.functional as F
    mdl, proc = _get_clip()
    if mdl is None:
        return None
    try:
        enc = proc(text=[text], return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            out = mdl.text_model(input_ids=enc["input_ids"],
                                 attention_mask=enc["attention_mask"])
            feat = mdl.text_projection(out.pooler_output)
        return F.normalize(feat[0], dim=-1).cpu().numpy().astype("float32")
    except Exception:
        return None


def _filter_outliers(
    paths: list[Path],
    make: str = "",
    model: str = "",
    gen_code: str = "",
    start_year: int | None = None,
) -> list[Path]:
    import numpy as np
    from PIL import Image as PILImage

    if len(paths) < 3:
        return paths
    mdl, _ = _get_clip()
    if mdl is None:
        return paths
    print("  Checking visual consistency...", flush=True)

    # Pre-filter: reject images where YOLO detects no vehicle
    vehicle_paths: list[Path] = []
    for p in paths:
        try:
            full = PILImage.open(p).convert("RGB")
            crop = _yolo_crop(full)
        except Exception:
            crop = None
        if crop is None:
            print(f"    removed {p.name} (no vehicle detected)", flush=True)
            p.unlink()
        else:
            vehicle_paths.append(p)
    paths = vehicle_paths

    if len(paths) < 3:
        return paths

    embeddings: list[np.ndarray] = []
    embeddable: list[Path] = []
    unembeddable: list[Path] = []
    for p in paths:
        emb = _clip_embed_img(p)
        if emb is not None:
            embeddings.append(emb)
            embeddable.append(p)
        else:
            unembeddable.append(p)
    if len(embeddings) < 3:
        return paths

    n = len(embeddings)
    E = np.array(embeddings)   # (n, 512)

    # --- Gate 1: pairwise visual consistency ---
    sim = E @ E.T
    pair_scores = (sim.sum(axis=1) - 1.0) / max(n - 1, 1)
    pair_thr = max(0.55, float(pair_scores.mean() - 1.5 * pair_scores.std()))

    # --- Gate 2: text-anchor similarity ---
    # Builds prompts from the car's identity so images of the wrong model are
    # penalised even when they happen to look visually consistent with each other.
    text_scores: np.ndarray | None = None
    text_thr: float | None = None
    if make and model:
        named_gen = gen_code and gen_code not in (
            "I", "II", "III", "IV", "V", "VI", "VII", "VIII"
        )
        prompts = [
            f"a photo of a {make} {model} car",
            f"exterior view of a {make} {model} automobile",
        ]
        if start_year:
            prompts.append(f"a {start_year} {make} {model}")
        if named_gen:
            prompts.append(f"a {make} {model} {gen_code}")
            if start_year:
                prompts.append(f"a {start_year} {make} {model} {gen_code}")

        tvecs = [_clip_text_embed(p) for p in prompts]
        tvecs = [v for v in tvecs if v is not None]
        if tvecs:
            T = np.mean(tvecs, axis=0).astype(np.float32)
            T /= np.linalg.norm(T)
            text_scores = E @ T   # (n,)
            # CLIP zero-shot text-image similarity runs low for narrow, specific prompts
            # like "a 2012 Volkswagen Golf Mk6" — a 0.26 floor was rejecting >50% of most
            # batches (hitting the max_drop cap below and capping nearly every generation
            # at ~10/20 kept regardless of actual photo quality). 0.20 still catches clearly
            # wrong-car photos (observed well below this) without discarding plausible ones.
            text_thr = max(0.20, float(text_scores.mean() - 1.2 * text_scores.std()))

    # --- Combine: collect candidates that fail either gate, evict worst first ---
    max_drop = n // 2
    candidates: list[tuple[float, int]] = []
    for i in range(n):
        fails_pair = pair_scores[i] < pair_thr
        fails_text = text_scores is not None and text_scores[i] < text_thr
        if fails_pair or fails_text:
            candidates.append((pair_scores[i], i))   # sort by pair score ascending

    candidates.sort()
    drop_indices: set[int] = set(idx for _, idx in candidates[:max_drop])

    kept: list[Path] = []
    dropped: list[tuple[Path, str]] = []
    for i, p in enumerate(embeddable):
        if i not in drop_indices:
            kept.append(p)
        else:
            parts: list[str] = []
            if pair_scores[i] < pair_thr:
                parts.append(f"pair={pair_scores[i]:.3f}<{pair_thr:.3f}")
            if text_scores is not None and text_scores[i] < text_thr:
                parts.append(f"text={text_scores[i]:.3f}<{text_thr:.3f}")
            dropped.append((p, ", ".join(parts)))

    for p, reason in dropped:
        print(f"    removed {p.name} ({reason})", flush=True)
        p.unlink()
    if dropped:
        print(f"  {len(dropped)} outlier(s) removed, {len(kept)} kept", flush=True)
    return kept + unembeddable


# -─ generation-aware query builder -────────────────────────────────────────────

def build_queries(make: str, model: str, gen_code: str, start_year: int | None) -> list[str]:
    """Return Commons search queries, specific-first then broader fallbacks."""
    queries = []
    named_gen = gen_code and gen_code not in ("I", "II", "III", "IV", "V", "VI", "VII", "VIII")

    # Most specific: year + gen_code anchored
    if start_year and named_gen:
        queries.append(f"{make} {model} {gen_code} {start_year}")
    if start_year:
        queries.append(f"{make} {model} {start_year}")
        queries.append(f'"{make}" "{model}" {start_year}')
        queries.append(f"{make} {model} {start_year} side")
        queries.append(f"{make} {model} {start_year} rear")
    if named_gen:
        queries.append(f"{make} {model} {gen_code}")
        queries.append(f"{make} {model} {gen_code} side")
        queries.append(f"{make} {model} {gen_code} rear")

    # Generic fallbacks (Commons categories already filtered by generation,
    # so these mostly add extra photos from the same-named category)
    queries.append(f"{make} {model}")
    queries.append(f"{make} {model} automobile")
    queries.append(f"{make} {model} car")
    queries.append(f"{model} {make}")

    return queries


def build_categories(make: str, model: str, gen_code: str, start_year: int | None) -> list[str]:
    cats = []
    if start_year:
        cats.append(f"{make} {model} ({start_year})")
        cats.append(f"{start_year} {make} {model}")
    if gen_code and gen_code not in ("I", "II", "III", "IV", "V"):
        cats.append(f"{make} {model} {gen_code}")
        cats.append(f"{make} {model} ({gen_code})")
    cats.append(f"{make} {model}")
    cats.append(f"{model} ({make})")
    return cats


# -─ fetch for one generation -──────────────────────────────────────────────────

def fetch_gen(make: str, model: str, gen_code: str, start_year: int | None,
              catalogue_key: str, mapping: dict,
              target: int = IMAGES_PER_GEN) -> list[Path]:
    slug = f"{make}_{model}_{gen_code}".replace(" ", "_").replace("/", "-")

    # Always replace: delete all existing images for this generation
    for p in list(IMAGES_DIR.glob(f"{slug}*.jpg")):
        p.unlink()
    old_single = IMAGES_DIR / f"{slug}.jpg"
    if old_single.exists():
        old_single.unlink()
    mapping.pop(catalogue_key, None)

    idx = 0
    new_paths: list[Path] = []

    print(f"    {gen_code}: fetching {target} images ...", end="", flush=True)

    # Build a generation-specific search prefix (most specific possible)
    named_gen = gen_code not in ("I", "II", "III", "IV", "V", "VI", "VII", "VIII")
    year_str = str(start_year) if start_year else ""
    if named_gen and year_str:
        prefix = f"{make} {model} {gen_code} {year_str}"
    elif named_gen:
        prefix = f"{make} {model} {gen_code}"
    elif year_str:
        prefix = f"{make} {model} {year_str}"
    else:
        prefix = f"{make} {model}"

    # -─ Phase 1: Wikimedia Commons — fill the general slots (open-licence) -──
    titles: list[str] = []
    seen_titles: set[str] = set()

    def add_title(new: list[str]) -> None:
        for t in new:
            if t not in seen_titles:
                seen_titles.add(t)
                titles.append(t)

    for cat in build_categories(make, model, gen_code, start_year):
        add_title(_category_files(cat, limit=50))
        time.sleep(0.3)
    for q in build_queries(make, model, gen_code, start_year):
        add_title(_search_files(q, limit=30))
        time.sleep(0.3)
    for q in build_queries(make, model, gen_code, start_year)[:4]:
        add_title(_wiki_article_images(q))
        time.sleep(0.3)

    for title in titles:
        if len(new_paths) >= GENERAL_SLOTS:
            break
        url = _imageinfo_url(COMMONS_API, title) or _imageinfo_url(WIKI_API, title)
        if not url:
            continue
        dest = IMAGES_DIR / f"{slug}_{idx}.jpg"
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                dest.write_bytes(r.read())
            new_paths.append(dest)
            idx += 1
        except Exception:
            pass
        time.sleep(0.3)

    # -─ Phase 2: DuckDuckGo — angle-specific dedicated slots -────────────────
    if _DDG_AVAILABLE:
        seen_urls: set[str] = set()

        def _ddg_fill(queries: list[str], max_count: int) -> None:
            nonlocal idx
            count = 0
            for q in queries:
                if count >= max_count:
                    break
                for url in _ddg_image_urls(q, max_results=20):
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)
                    dest = IMAGES_DIR / f"{slug}_{idx}.jpg"
                    ok = dest.exists() or _download_url(url, dest)
                    if ok:
                        new_paths.append(dest)
                        idx += 1
                        count += 1
                    if count >= max_count:
                        break
                    time.sleep(0.25)
                time.sleep(0.5)

        # 3 front-view slots
        _ddg_fill([
            f"{prefix} front view",
            f"{prefix} front",
            f"{prefix} front three quarter",
        ], ANGLE_SLOTS["front"])

        # 3 rear-view slots
        _ddg_fill([
            f"{prefix} rear view",
            f"{prefix} rear",
            f"{prefix} back view",
            f"{prefix} rear three quarter",
        ], ANGLE_SLOTS["rear"])

        # 3 side/profile slots
        _ddg_fill([
            f"{prefix} side view",
            f"{prefix} profile",
            f"{prefix} side",
        ], ANGLE_SLOTS["side"])

        # 3 three-quarter slots
        _ddg_fill([
            f"{prefix} three quarter view",
            f"{prefix} three quarter front",
            f"{prefix} three quarter rear",
            f"{prefix} exterior",
        ], ANGLE_SLOTS["three_quarter"])

        # Fill any remaining general slots not covered by Commons
        remaining = max(0, target - len(new_paths))
        if remaining > 0:
            _ddg_fill([
                f"{prefix} exterior",
                f"{prefix} car",
                f"{prefix}",
            ], remaining)

    # -─ Phase 3: CLIP visual-consistency filter (stricter thresholds) -───────
    all_paths = _filter_outliers(
        new_paths,
        make=make, model=model, gen_code=gen_code, start_year=start_year,
    )
    mapping[catalogue_key] = [str(p) for p in all_paths]
    got = len(all_paths)
    suffix = "" if got >= IMAGES_PER_GEN else f" ! only {got}/{IMAGES_PER_GEN}"
    print(f" -> {got} total{suffix}")
    return all_paths


# -─ main -─────────────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python fetch_generation_images.py <Make> <Model>")
        print('Example: python fetch_generation_images.py "Alfa Romeo" "147"')
        sys.exit(1)

    make = sys.argv[1]
    model = sys.argv[2]

    with open(LABELS_PATH, encoding="utf-8") as f:
        labels: dict = json.load(f)

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    mapping: dict = {}
    if OUT_PATH.exists():
        raw = json.load(open(OUT_PATH, encoding="utf-8"))
        for k, v in raw.items():
            mapping[k] = v if isinstance(v, list) else [v]

    # Find all generations for this make+model
    gens = {
        k: v for k, v in labels.items()
        if v["manufacturerName"].lower() == make.lower()
        and v["modelName"].lower() == model.lower()
    }

    if not gens:
        print(f"No catalogue entries found for '{make} {model}'.")
        sys.exit(1)

    print(f"\n{make} {model} -{len(gens)} generation(s)\n")

    for key, meta in sorted(gens.items(), key=lambda x: x[1].get("startYear") or 0):
        fetch_gen(
            make=meta["manufacturerName"],
            model=meta["modelName"],
            gen_code=meta["generationCode"],
            start_year=meta.get("startYear"),
            catalogue_key=key,
            mapping=mapping,
        )

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent="\t")

    print(f"\nDone. Restart the AI service — it will pick up the new/changed images "
          f"incrementally (only they get embedded, not the whole reference set).")


if __name__ == "__main__":
    main()
