"""One-off: trigger CarClassifier's incremental _build_index() reconciliation
after adding 48 new generations' reference images, then confirm the resulting
embeddings cache actually contains them.
"""

import sys
import logging

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(message)s")

print("starting imports...", flush=True)
import json
print("  json ok", flush=True)
from pathlib import Path
print("  pathlib ok", flush=True)
import numpy as np
print("  numpy ok", flush=True)
import torch
print("  torch ok", flush=True)
import faiss
print("  faiss ok", flush=True)
from PIL import Image
print("  PIL ok", flush=True)
from transformers import CLIPModel, CLIPProcessor
print("  transformers ok", flush=True)
from ultralytics import YOLO
print("  ultralytics ok", flush=True)

from src.model_loader import CarClassifier, EMBEDDINGS_CACHE, CLASSIFIER_PATH, LORA_DIR
print("  src.model_loader ok", flush=True)

BASE_DIR = Path(__file__).parent
LABELS_PATH = BASE_DIR / "model" / "class_labels.json"

with LABELS_PATH.open(encoding="utf-8") as f:
    labels_dict = json.load(f)

print(f"Loaded {len(labels_dict)} catalogue generations.", flush=True)
print("Constructing CarClassifier (triggers incremental _build_index)...", flush=True)
sys.stdout.flush()
classifier = CarClassifier(
    labels_dict,
    lora_dir=LORA_DIR,
    classifier_path=CLASSIFIER_PATH,
    embeddings_cache=EMBEDDINGS_CACHE,
)

if classifier._index is not None:
    print(f"\nFAISS index ready: {classifier._index.ntotal} reference embeddings.", flush=True)
else:
    print("\nNo index built - something is wrong.", flush=True)
