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
LABELS_PATH      = BASE_DIR / "model" / "class_labels.json"
REF_IMAGES_PATH  = BASE_DIR / "model" / "reference_images.json"
EMBEDDINGS_CACHE = BASE_DIR / "model" / "reference_embeddings.pt"
LORA_DIR         = BASE_DIR / "model" / "clip_lora"
CLASSIFIER_PATH  = BASE_DIR / "model" / "classifier.pkl"

_CLIP_MODEL = "openai/clip-vit-large-patch14"
_YOLO_MODEL = "yolov8n.pt"
_CAR_CLASSES = {2, 5, 7}   # COCO: car, bus, truck


def load_labels_dict() -> Dict[str, dict]:
    with LABELS_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _augment(image: Image.Image) -> List[Image.Image]:
    """2 deterministic augmentations of a reference image."""
    return [
        image,                                 # original
        image.transpose(Image.FLIP_LEFT_RIGHT), # mirror
    ]


def _clip_embed(model: CLIPModel, processor: CLIPProcessor, image: Image.Image) -> np.ndarray:
    enc = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        out = model.vision_model(pixel_values=enc["pixel_values"])
        feat = model.visual_projection(out.pooler_output)
    vec = F.normalize(feat[0], dim=-1).cpu().numpy()   # (512,)
    return vec.astype(np.float32)


class CarClassifier:
    def __init__(self, labels_dict: Dict[str, dict]) -> None:
        logger.info("Loading YOLO …")
        self._yolo = YOLO(_YOLO_MODEL)

        logger.info("Loading CLIP %s …", _CLIP_MODEL)
        self._processor = CLIPProcessor.from_pretrained(_CLIP_MODEL)
        base_clip = CLIPModel.from_pretrained(_CLIP_MODEL)

        if LORA_DIR.exists() and (LORA_DIR / "adapter_config.json").exists():
            try:
                from peft import PeftModel
                self._clip = PeftModel.from_pretrained(base_clip, str(LORA_DIR))
                logger.info("Loaded LoRA adapter from %s", LORA_DIR)
            except Exception as exc:
                logger.warning("Failed to load LoRA adapter (%s) — using base CLIP.", exc)
                self._clip = base_clip
        else:
            logger.info("No LoRA adapter found — using base CLIP.")
            self._clip = base_clip

        self._clip.eval()

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
        if CLASSIFIER_PATH.exists():
            try:
                with open(CLASSIFIER_PATH, "rb") as f:
                    self._clf = pickle.load(f)
                logger.info("Loaded classifier from %s", CLASSIFIER_PATH)
            except Exception as exc:
                logger.warning("Failed to load classifier (%s) — falling back to FAISS.", exc)

        logger.info("CarClassifier ready.")

    # ── car detection ───────────────────────────────────────────────────────────

    def _crop_car(self, image: Image.Image) -> Image.Image:
        results = self._yolo(image, verbose=False)
        boxes = [
            b for b in results[0].boxes
            if int(b.cls[0]) in _CAR_CLASSES
        ]
        if not boxes:
            return image   # no vehicle detected — use full image
        # pick the largest bounding box
        best = max(boxes, key=lambda b: (
            (b.xyxy[0][2] - b.xyxy[0][0]) * (b.xyxy[0][3] - b.xyxy[0][1])
        ))
        x1, y1, x2, y2 = (int(v) for v in best.xyxy[0])
        return image.crop((x1, y1, x2, y2))

    # ── FAISS index build ───────────────────────────────────────────────────────

    def _build_index(self) -> None:
        if not REF_IMAGES_PATH.exists():
            return

        with REF_IMAGES_PATH.open("r", encoding="utf-8") as f:
            ref_map: Dict[str, str] = json.load(f)

        # Collect valid (key, path) pairs — mapping value is now a list
        entries: List[Tuple[str, Path]] = []
        for key, img_paths in ref_map.items():
            if key not in self._labels:
                continue
            path_list = img_paths if isinstance(img_paths, list) else [img_paths]
            for img_path in path_list:
                p = Path(img_path)
                if p.exists():
                    entries.append((key, p))

        if not entries:
            return

        # Load from cache if source image count matches
        if EMBEDDINGS_CACHE.exists():
            cached = torch.load(EMBEDDINGS_CACHE, weights_only=False)
            if cached.get("source_count") == len(entries):
                keys = cached["keys"]
                emb_matrix = cached["embeddings"]
                self._index = faiss.IndexFlatIP(emb_matrix.shape[1])
                self._index.add(emb_matrix)
                self._index_keys = keys
                logger.info(
                    "Loaded %d embeddings (%d source images) from cache.",
                    len(keys), cached["source_count"],
                )
                return

        # Compute embeddings with augmentation (5 variants per source image)
        logger.info("Computing embeddings for %d reference images …", len(entries))
        keys: List[str] = []
        vecs: List[np.ndarray] = []
        for key, p in entries:
            try:
                img = Image.open(p).convert("RGB")
                for aug in _augment(img):
                    vec = _clip_embed(self._clip, self._processor, aug)
                    keys.append(key)
                    vecs.append(vec)
            except Exception as exc:
                logger.warning("Skipping %s: %s", p, exc)

        if not vecs:
            return

        emb_matrix = np.stack(vecs).astype(np.float32)   # (N, 512)
        torch.save({"keys": keys, "embeddings": emb_matrix, "source_count": len(entries)}, EMBEDDINGS_CACHE)
        logger.info("Saved embedding cache.")

        self._index = faiss.IndexFlatIP(emb_matrix.shape[1])
        self._index.add(emb_matrix)
        self._index_keys = keys

    # ── prediction ──────────────────────────────────────────────────────────────

    # Minimum confidence to report a result (4% ≈ 33× random chance across 813 classes).
    # Below this the car is treated as unknown / not in catalogue.
    MIN_CONFIDENCE = 0.04

    def predict(self, image_bytes: bytes, top_k: int = 10) -> Tuple[str, float, dict, List[dict]]:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")

        # 1. YOLO → crop car out of the scene
        cropped = self._crop_car(image)

        # 2. CLIP embedding of the cropped car
        query = _clip_embed(self._clip, self._processor, cropped).reshape(1, -1)

        # 3a. Classifier path (preferred — learns decision boundaries between similar cars)
        if self._clf is not None:
            return self._predict_classifier(query, top_k)

        # 3b. FAISS fallback
        return self._predict_faiss(query, top_k)

    def _predict_classifier(self, query: np.ndarray, top_k: int) -> Tuple[str, float, dict, List[dict]]:
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

    def _predict_faiss(self, query: np.ndarray, top_k: int) -> Tuple[str, float, dict, List[dict]]:
        if self._index is None or self._index.ntotal == 0:
            fallback = next(iter(self._labels))
            return fallback, 0.05, self._labels[fallback], []

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
