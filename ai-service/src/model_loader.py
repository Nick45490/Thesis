from __future__ import annotations

import json
import logging
import pickle
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn.functional as F
import faiss
from PIL import Image, ImageEnhance
from transformers import CLIPModel, CLIPProcessor
from ultralytics import YOLO

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[1]
LABELS_PATH        = BASE_DIR / "model" / "class_labels.json"
REF_IMAGES_PATH    = BASE_DIR / "model" / "reference_images.json"
EMBEDDINGS_CACHE   = BASE_DIR / "model" / "reference_embeddings.pt"
LORA_DIR           = BASE_DIR / "model" / "clip_lora"
CLASSIFIER_PATH    = BASE_DIR / "model" / "classifier.pkl"
HELD_OUT_PATH       = BASE_DIR / "model" / "held_out_test_set.json"
NO_CAR_IMAGES_PATH = BASE_DIR / "scripts" / "no_car_images.txt"

_CLIP_MODEL = "openai/clip-vit-large-patch14"
_YOLO_MODEL = "yolov8n.pt"
_CAR_CLASSES = {2, 5, 7}   # COCO: car, bus, truck

# Bump this whenever _augment() or the reference-image preprocessing changes,
# so a stale cache gets invalidated even if the source image count happens to
# stay the same. v3: reference images are now YOLO-cropped before embedding,
# matching what predict() does at inference (previously a train/inference
# mismatch — the classifier trained on uncropped photos but always predicted
# on cropped ones).
_AUG_VERSION = 3

# Generations with fewer images than this keep all of them for training
# (no held-out reservation) rather than shrinking an already-thin class further.
_MIN_IMAGES_FOR_HOLDOUT = 4

# Batch size for CLIP forward passes when building the embedding cache — batching
# roughly halves per-image CPU time versus embedding one image at a time.
_EMBED_BATCH_SIZE = 16


def load_labels_dict() -> Dict[str, dict]:
    with LABELS_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _augment(image: Image.Image) -> List[Image.Image]:
    """6 deterministic augmentations of a reference image."""
    return [
        image,                                                      # original
        image.transpose(Image.FLIP_LEFT_RIGHT),                     # mirror
        ImageEnhance.Brightness(image).enhance(0.85),                # darker
        ImageEnhance.Brightness(image).enhance(1.15),                # brighter
        image.rotate(-8, expand=False, fillcolor=(128, 128, 128)),   # rotated left
        image.rotate(8, expand=False, fillcolor=(128, 128, 128)),    # rotated right
    ]


def _load_no_car_filenames() -> set:
    if not NO_CAR_IMAGES_PATH.exists():
        return set()
    return {
        line.strip()
        for line in NO_CAR_IMAGES_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }


def _load_held_out_map() -> Dict[str, str]:
    if not HELD_OUT_PATH.exists():
        return {}
    try:
        with HELD_OUT_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _clip_embed_batch(model: CLIPModel, processor: CLIPProcessor, images: List[Image.Image], device: "torch.device") -> np.ndarray:
    enc = processor(images=images, return_tensors="pt")
    pixel_values = enc["pixel_values"].to(device)
    with torch.no_grad():
        out = model.vision_model(pixel_values=pixel_values)
        feat = model.visual_projection(out.pooler_output)
    vecs = F.normalize(feat, dim=-1).cpu().numpy()   # (N, 512)
    return vecs.astype(np.float32)


def _clip_embed(model: CLIPModel, processor: CLIPProcessor, image: Image.Image, device: "torch.device") -> np.ndarray:
    return _clip_embed_batch(model, processor, [image], device)[0]


class CarClassifier:
    def __init__(
        self,
        labels_dict: Dict[str, dict],
        *,
        lora_dir: Optional[Path] = LORA_DIR,
        classifier_path: Path = CLASSIFIER_PATH,
        embeddings_cache: Path = EMBEDDINGS_CACHE,
    ) -> None:
        """
        lora_dir/classifier_path/embeddings_cache default to the production paths but
        can be overridden (e.g. lora_dir=None, classifier_path=..._no_lora.pkl,
        embeddings_cache=..._no_lora.pt) to run an isolated comparison — such as
        checking whether the LoRA adapter actually helps — without touching the
        files the live service uses.
        """
        self._embeddings_cache = embeddings_cache

        logger.info("Loading YOLO …")
        self._yolo = YOLO(_YOLO_MODEL)

        logger.info("Loading CLIP %s …", _CLIP_MODEL)
        self._processor = CLIPProcessor.from_pretrained(_CLIP_MODEL)
        base_clip = CLIPModel.from_pretrained(_CLIP_MODEL)

        if lora_dir is not None and lora_dir.exists() and (lora_dir / "adapter_config.json").exists():
            try:
                from peft import PeftModel
                self._clip = PeftModel.from_pretrained(base_clip, str(lora_dir))
                logger.info("Loaded LoRA adapter from %s", lora_dir)
            except Exception as exc:
                logger.warning("Failed to load LoRA adapter (%s) — using base CLIP.", exc)
                self._clip = base_clip
        else:
            logger.info("No LoRA adapter found — using base CLIP.")
            self._clip = base_clip

        self._clip.eval()

        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._clip.to(self._device)
        logger.info("Device: %s", self._device)

        self._labels = labels_dict

        # (make, model) → newest catalogue key
        self._newest: Dict[Tuple[str, str], str] = {}
        for key, data in labels_dict.items():
            pair = (data["manufacturerName"], data["modelName"])
            sy = data.get("startYear") or 0
            existing = self._newest.get(pair)
            if existing is None or sy > (labels_dict[existing].get("startYear") or 0):
                self._newest[pair] = key

        # FAISS index
        self._index: Optional[faiss.IndexFlatIP] = None
        self._index_keys: List[str] = []   # catalogue key per row in the index
        self._build_index()

        if self._index is not None:
            logger.info("FAISS index ready: %d reference embeddings.", self._index.ntotal)
        else:
            logger.warning(
                "No reference images found — run fetch_reference_images.py first."
            )

        # Load logistic-regression classifier if available (preferred over FAISS)
        self._clf: Optional[dict] = None
        if classifier_path.exists():
            try:
                with open(classifier_path, "rb") as f:
                    self._clf = pickle.load(f)
                logger.info("Loaded classifier from %s", classifier_path)
            except Exception as exc:
                logger.warning("Failed to load classifier (%s) — falling back to FAISS.", exc)

        logger.info("CarClassifier ready.")

    # ── car detection ───────────────────────────────────────────────────────────

    def _crop_car(self, image: Image.Image) -> Tuple[Image.Image, bool]:
        results = self._yolo(image, verbose=False)
        boxes = [
            b for b in results[0].boxes
            if int(b.cls[0]) in _CAR_CLASSES
        ]
        if not boxes:
            return image, False   # no vehicle detected — use full image
        # pick the largest bounding box
        best = max(boxes, key=lambda b: (
            (b.xyxy[0][2] - b.xyxy[0][0]) * (b.xyxy[0][3] - b.xyxy[0][1])
        ))
        x1, y1, x2, y2 = (int(v) for v in best.xyxy[0])
        return image.crop((x1, y1, x2, y2)), True

    # ── FAISS index build ───────────────────────────────────────────────────────

    def _build_index(self) -> None:
        if not REF_IMAGES_PATH.exists():
            return

        with REF_IMAGES_PATH.open("r", encoding="utf-8") as f:
            ref_map: Dict[str, object] = json.load(f)

        no_car_names = _load_no_car_filenames()
        held_out_map = _load_held_out_map()

        # Collect valid, non-flagged-as-no-car paths per generation
        per_key_paths: Dict[str, List[Path]] = {}
        for key, img_paths in ref_map.items():
            if key not in self._labels:
                continue
            path_list = img_paths if isinstance(img_paths, list) else [img_paths]
            valid = [
                Path(p) for p in path_list
                if Path(p).exists() and Path(p).name not in no_car_names
            ]
            if valid:
                per_key_paths[key] = valid

        # Reserve one held-out test image per generation (never embedded/trained on).
        # Respects a previously recorded choice (matched by filename, not full path,
        # so a held-out set built elsewhere — e.g. on Colab — still round-trips here)
        # so the split is stable across rebuilds.
        held_out_changed = False
        for key, paths in per_key_paths.items():
            if len(paths) < _MIN_IMAGES_FOR_HOLDOUT:
                continue
            recorded = held_out_map.get(key)
            recorded_name = Path(recorded).name if recorded else None
            match = next((p for p in paths if p.name == recorded_name), None) if recorded_name else None
            held_out_path = match if match is not None else sorted(paths, key=lambda p: p.name)[-1]
            if held_out_map.get(key) != str(held_out_path):
                held_out_map[key] = str(held_out_path)
                held_out_changed = True
            per_key_paths[key] = [p for p in paths if p != held_out_path]

        if held_out_changed or not HELD_OUT_PATH.exists():
            with HELD_OUT_PATH.open("w", encoding="utf-8") as f:
                json.dump(held_out_map, f, indent="\t")

        entries: List[Tuple[str, Path]] = [
            (key, p) for key, paths in per_key_paths.items() for p in paths
        ]

        if not entries:
            return

        # Trust an existing cache built with the current augmentation scheme, but
        # incrementally reconcile it against the current reference set instead of
        # blindly trusting it as-is or recomputing everything from scratch: embed
        # only genuinely new/changed source images, and drop rows whose source
        # image is no longer part of the current valid set (excluded via
        # no_car_images.txt, deleted, or newly held out). This is what makes
        # adding one new car's reference photos fast and local — previously any
        # change required deleting the whole cache and recomputing every
        # embedding (a CPU-only operation impractical without Colab's GPU).
        cached = None
        if self._embeddings_cache.exists():
            loaded = torch.load(self._embeddings_cache, weights_only=False)
            if loaded.get("aug_version") == _AUG_VERSION and "source_ids" in loaded:
                cached = loaded

        if cached is not None:
            # Matched by filename, not full path — a cache built elsewhere (e.g.
            # Colab, which stores paths like /content/reference_images/x.jpg)
            # must still reconcile correctly against local paths. Filenames are
            # unique per reference image by construction (make_model_gencode_
            # index.jpg), same assumption the held-out-set matching above relies on.
            entries_by_filename = {p.name: (key, p) for key, p in entries}
            current_filenames = set(entries_by_filename.keys())
            cached_keys = cached["keys"]
            cached_embeddings = cached["embeddings"]
            cached_source_ids = cached["source_ids"]
            cached_filenames = [Path(s).name for s in cached_source_ids]

            keep_mask = [f in current_filenames for f in cached_filenames]
            new_filenames = current_filenames - set(cached_filenames)

            if all(keep_mask) and not new_filenames:
                self._index = faiss.IndexFlatIP(cached_embeddings.shape[1])
                self._index.add(cached_embeddings)
                self._index_keys = cached_keys
                logger.info("Loaded %d embeddings from cache (up to date).", len(cached_keys))
                return

            keep_idx = [i for i, m in enumerate(keep_mask) if m]
            kept_keys = [cached_keys[i] for i in keep_idx]
            kept_source_ids = [cached_source_ids[i] for i in keep_idx]
            kept_embeddings = cached_embeddings[keep_idx]
            if len(kept_keys) != len(cached_keys):
                logger.info("Dropping %d stale embeddings (source image no longer in the reference set).",
                            len(cached_keys) - len(kept_keys))

            if new_filenames:
                new_entries = [entries_by_filename[f] for f in new_filenames]
                logger.info("Embedding %d new/changed reference image(s) incrementally …", len(new_entries))
                new_keys, new_source_ids, new_vecs = self._embed_entries(new_entries)
                if new_vecs:
                    new_matrix = np.stack(new_vecs).astype(np.float32)
                    merged_embeddings = np.concatenate([kept_embeddings, new_matrix], axis=0)
                    merged_keys = kept_keys + new_keys
                    merged_source_ids = kept_source_ids + new_source_ids
                else:
                    merged_embeddings, merged_keys, merged_source_ids = kept_embeddings, kept_keys, kept_source_ids
            else:
                merged_embeddings, merged_keys, merged_source_ids = kept_embeddings, kept_keys, kept_source_ids

            if not merged_keys:
                return

            torch.save({
                "keys": merged_keys,
                "embeddings": merged_embeddings,
                "source_ids": merged_source_ids,
                "source_count": len(entries),
                "aug_version": _AUG_VERSION,
            }, self._embeddings_cache)
            logger.info("Saved updated embedding cache (%d embeddings).", len(merged_keys))

            self._index = faiss.IndexFlatIP(merged_embeddings.shape[1])
            self._index.add(merged_embeddings)
            self._index_keys = merged_keys
            return

        # No usable cache at all — full compute (e.g. first run, or aug_version changed).
        logger.info("Computing embeddings for %d reference images …", len(entries))
        keys, source_ids, vecs = self._embed_entries(entries)

        if not vecs:
            return

        emb_matrix = np.stack(vecs).astype(np.float32)   # (N, 512)
        torch.save({
            "keys": keys,
            "embeddings": emb_matrix,
            "source_ids": source_ids,
            "source_count": len(entries),
            "aug_version": _AUG_VERSION,
        }, self._embeddings_cache)
        logger.info("Saved embedding cache.")

        self._index = faiss.IndexFlatIP(emb_matrix.shape[1])
        self._index.add(emb_matrix)
        self._index_keys = keys

    def _embed_entries(self, entries: List[Tuple[str, Path]]) -> Tuple[List[str], List[str], List[np.ndarray]]:
        """Crop + augment + CLIP-embed a list of (key, path) reference entries,
        batched for CPU throughput. Shared by the full-rebuild and incremental
        update paths in _build_index() so they can't drift apart."""
        keys: List[str] = []
        source_ids: List[str] = []
        vecs: List[np.ndarray] = []

        pending_imgs: List[Image.Image] = []
        pending_keys: List[str] = []
        pending_sources: List[str] = []

        def _flush() -> None:
            if not pending_imgs:
                return
            batch_vecs = _clip_embed_batch(self._clip, self._processor, pending_imgs, self._device)
            keys.extend(pending_keys)
            source_ids.extend(pending_sources)
            vecs.extend(batch_vecs)
            pending_imgs.clear()
            pending_keys.clear()
            pending_sources.clear()

        done = 0
        for key, p in entries:
            try:
                img = Image.open(p).convert("RGB")
                cropped, _detected = self._crop_car(img)
                for aug in _augment(cropped):
                    pending_imgs.append(aug)
                    pending_keys.append(key)
                    pending_sources.append(str(p))
                    if len(pending_imgs) >= _EMBED_BATCH_SIZE:
                        _flush()
            except Exception as exc:
                logger.warning("Skipping %s: %s", p, exc)
            done += 1
            if done % 200 == 0:
                logger.info("  …%d/%d source images embedded", done, len(entries))
        _flush()

        return keys, source_ids, vecs

    # ── prediction ──────────────────────────────────────────────────────────────

    # Minimum confidence to report a result (4% ≈ 33× random chance across 813 classes).
    # Below this the car is treated as unknown / not in catalogue.
    MIN_CONFIDENCE = 0.04

    # Minimum absolute cosine similarity to the single closest reference embedding
    # of ANY class — catches cars that don't resemble anything in the catalogue at
    # all (e.g. a Lister Storm, genuinely not one of the 813 known generations),
    # which MIN_CONFIDENCE alone can't: that's a *relative* score among the 813
    # classes, so a genuinely novel car can still "win" relatively without
    # actually resembling anything closely in absolute terms.
    # Calibrated in two stages. First pass (0.87) used only the held-out set (812
    # genuine catalogue images, similarity never below 0.8824) with a safety
    # margin below that floor — but live-tested against two real photos of a
    # genuinely out-of-catalogue car (a Lister Storm) and didn't catch either one
    # (0.8700 and 0.8734 — both just above 0.87). The true gap between "known car,
    # worst case" and "this actual unknown car" turned out to be only ~0.01-0.012
    # wide. Retuned to sit in that gap: catches both real unknown examples while
    # staying below the genuine-catalogue floor (0.8824), so it shouldn't newly
    # reject any real catalogue car either. Calibrated against exactly one
    # negative example (two photos of the same car) — a thin sample; revisit if
    # more real "unknown car" cases surface.
    MIN_RAW_SIMILARITY = 0.878

    def _embed_query(self, cropped: Image.Image) -> np.ndarray:
        # CLIP embedding of the cropped car, pooled with its horizontal flip
        # (test-time augmentation — averages out some of the crop/orientation noise)
        flipped = cropped.transpose(Image.FLIP_LEFT_RIGHT)
        vec_orig, vec_flip = _clip_embed_batch(self._clip, self._processor, [cropped, flipped], self._device)
        pooled = vec_orig + vec_flip
        pooled = pooled / np.linalg.norm(pooled)
        return pooled.reshape(1, -1).astype(np.float32)

    def _raw_top1_similarity(self, query: np.ndarray) -> float:
        # Absolute resemblance to the single closest reference embedding of ANY
        # class — independent of the classifier's own (relative) confidence.
        # IndexFlatIP on normalized vectors gives cosine similarity directly.
        if self._index is None or self._index.ntotal == 0:
            return 1.0  # nothing to compare against — don't reject on this signal
        distances, _ = self._index.search(query, k=1)
        return float(distances[0][0])

    def predict(self, image_bytes: bytes, top_k: int = 10) -> Tuple[str, float, dict, List[dict], bool]:
        label, confidence, meta, candidates, no_vehicle_detected, _raw_sim = (
            self._predict_full(image_bytes, top_k)
        )
        return label, confidence, meta, candidates, no_vehicle_detected

    def predict_with_raw_similarity(
        self, image_bytes: bytes, top_k: int = 10
    ) -> Tuple[str, float, dict, List[dict], bool, float]:
        """Diagnostic entry point (see evaluate.py) — same as predict() but also
        returns the raw top-1 FAISS similarity, from the same embedding pass
        predict() already needs internally. A prior version of this diagnostic
        re-embedded the image from scratch (a second full YOLO+CLIP pass per
        image), which roughly doubled evaluate.py's runtime on CPU — this shares
        the single _predict_full() pass instead."""
        return self._predict_full(image_bytes, top_k)

    def _predict_full(
        self, image_bytes: bytes, top_k: int
    ) -> Tuple[str, float, dict, List[dict], bool, float]:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")

        # 1. YOLO → crop car out of the scene
        cropped, detected = self._crop_car(image)

        # 2. CLIP embedding of the cropped car (test-time augmented)
        query = self._embed_query(cropped)

        # 2b. Out-of-catalogue check — a car that doesn't resemble anything in the
        # reference set at all shouldn't get a confident (if relatively-ranked)
        # answer just because it's the "least bad" of 813 known options.
        raw_sim = self._raw_top1_similarity(query)
        if raw_sim < self.MIN_RAW_SIMILARITY:
            return "", 0.0, {}, [], not detected, raw_sim

        # 3a. Classifier path (preferred — learns decision boundaries between similar cars)
        if self._clf is not None:
            label, confidence, meta, candidates = self._predict_classifier(query, top_k)
        else:
            # 3b. FAISS fallback
            label, confidence, meta, candidates = self._predict_faiss(query, top_k)

        return label, confidence, meta, candidates, not detected, raw_sim

    def _predict_classifier(self, query: np.ndarray, top_k: int) -> Tuple[str, float, dict, List[dict]]:
        if isinstance(self._clf, dict) and self._clf.get("format") == "hierarchical_v1":
            return self._predict_hierarchical(query, top_k)

        clf       = self._clf["clf"]
        idx_to_key = self._clf["idx_to_key"]

        probs    = clf.predict_proba(query)[0]          # (n_classes,)
        classes  = clf.classes_                          # integer class indices
        top_idxs = np.argsort(probs)[::-1][:top_k]

        candidates = []
        for rank_idx in top_idxs:
            key  = idx_to_key[int(classes[rank_idx])]
            if key not in self._labels:
                continue
            meta = self._labels[key]
            candidates.append({
                "key":              key,
                "confidence":       round(float(probs[rank_idx]), 4),
                "votes":            1,
                "generationSource": "classifier",
                "generationId":     meta["generationId"],
                "manufacturerName": meta["manufacturerName"],
                "modelName":        meta["modelName"],
                "generationCode":   meta["generationCode"],
            })

        if not candidates:
            return "", 0.0, {}, []

        best = candidates[0]
        if best["confidence"] < self.MIN_CONFIDENCE:
            return "", best["confidence"], {}, candidates

        return best["key"], best["confidence"], self._labels[best["key"]], candidates

    def _predict_hierarchical(self, query: np.ndarray, top_k: int) -> Tuple[str, float, dict, List[dict]]:
        """
        Two-stage prediction: a coarse (make, model) classifier narrows to a pair,
        then either a direct lookup (single-generation pairs) or a small per-pair
        classifier (multi-generation pairs, never more than a handful of classes)
        picks the specific generation. Final confidence is the joint probability
        P(pair) * P(generation | pair).
        """
        stage1_clf       = self._clf["stage1_clf"]
        pair_idx_to_key  = self._clf["pair_idx_to_key"]
        stage2_clfs      = self._clf["stage2_clfs"]
        stage2_label_maps = self._clf["stage2_label_maps"]
        single_gen_map   = self._clf["single_gen_map"]

        pair_probs = stage1_clf.predict_proba(query)[0]
        pair_classes = stage1_clf.classes_
        n_pairs_to_expand = min(len(pair_probs), max(top_k, 8))
        top_pair_idxs = np.argsort(pair_probs)[::-1][:n_pairs_to_expand]

        resolved: List[Tuple[str, float, str]] = []   # (key, confidence, generationSource)
        for rank_idx in top_pair_idxs:
            pair = pair_idx_to_key[int(pair_classes[rank_idx])]
            pair_prob = float(pair_probs[rank_idx])

            if pair in single_gen_map:
                resolved.append((single_gen_map[pair], pair_prob, "hierarchical_single"))
            elif pair in stage2_clfs:
                stage2_clf = stage2_clfs[pair]
                idx_to_key = stage2_label_maps[pair]["idx_to_key"]
                gen_probs = stage2_clf.predict_proba(query)[0]
                gen_classes = stage2_clf.classes_
                for gi in range(len(gen_probs)):
                    key = idx_to_key[int(gen_classes[gi])]
                    resolved.append((key, pair_prob * float(gen_probs[gi]), "hierarchical"))
            # else: a degenerate group with neither a lookup nor a classifier — skip

        resolved.sort(key=lambda t: t[1], reverse=True)

        candidates = []
        for key, confidence, source in resolved[:top_k]:
            if key not in self._labels:
                continue
            meta = self._labels[key]
            candidates.append({
                "key":              key,
                "confidence":       round(confidence, 4),
                "votes":            1,
                "generationSource": source,
                "generationId":     meta["generationId"],
                "manufacturerName": meta["manufacturerName"],
                "modelName":        meta["modelName"],
                "generationCode":   meta["generationCode"],
            })

        if not candidates:
            return "", 0.0, {}, []

        best = candidates[0]
        if best["confidence"] < self.MIN_CONFIDENCE:
            return "", best["confidence"], {}, candidates

        return best["key"], best["confidence"], self._labels[best["key"]], candidates

    def _predict_faiss(self, query: np.ndarray, top_k: int) -> Tuple[str, float, dict, List[dict]]:
        if self._index is None or self._index.ntotal == 0:
            # No reference embeddings to search — report "unknown" rather than
            # fabricating a match. The old fallback (first label in
            # class_labels.json at confidence 0.05) was ABOVE MIN_CONFIDENCE
            # (0.04), so it was reported to the user as a real identification.
            return "", 0.0, {}, []

        k = min(top_k, self._index.ntotal)
        distances, indices = self._index.search(query, k=k)

        pair_total: Dict[Tuple[str, str], float] = {}
        pair_count: Dict[Tuple[str, str], int]   = {}
        gen_votes:  Dict[str, int]               = {}
        gen_score:  Dict[str, float]             = {}

        for dist, idx in zip(distances[0], indices[0]):
            key  = self._index_keys[int(idx)]
            meta = self._labels[key]
            pair = (meta["manufacturerName"], meta["modelName"])

            pair_total[pair] = pair_total.get(pair, 0.0) + float(dist)
            pair_count[pair] = pair_count.get(pair, 0) + 1
            gen_votes[key]   = gen_votes.get(key, 0) + 1
            gen_score[key]   = gen_score.get(key, 0.0) + float(dist)

        ranked_pairs = sorted(
            pair_total.items(),
            key=lambda x: (pair_total[x[0]] / pair_count[x[0]], pair_count[x[0]]),
            reverse=True,
        )

        candidates = []
        for pair, _ in ranked_pairs[:5]:
            avg = pair_total[pair] / pair_count[pair]
            pair_gen_votes = {
                k: gen_votes[k] for k in gen_votes
                if (self._labels[k]["manufacturerName"], self._labels[k]["modelName"]) == pair
            }
            if pair_gen_votes:
                best_key   = max(pair_gen_votes, key=lambda k: (gen_votes[k], gen_score.get(k, 0.0)))
                gen_source = "detected" if len(pair_gen_votes) > 1 else "catalogue"
            else:
                best_key   = self._newest.get(pair, next(iter(self._labels)))
                gen_source = "catalogue"

            meta = self._labels[best_key]
            candidates.append({
                "key":              best_key,
                "confidence":       round(avg, 4),
                "votes":            pair_count[pair],
                "generationSource": gen_source,
                "generationId":     meta["generationId"],
                "manufacturerName": meta["manufacturerName"],
                "modelName":        meta["modelName"],
                "generationCode":   meta["generationCode"],
            })

        best = candidates[0]
        return best["key"], best["confidence"], self._labels[best["key"]], candidates
