"""
Train a logistic-regression classifier on top of the cached CLIP+LoRA embeddings.
Much faster and more accurate than FAISS nearest-neighbor for distinguishing similar cars.

The embedding cache (reference_embeddings.pt) must already exist — start the ai-service
once to build it, then run this script.

Usage:
    python train_classifier.py
"""

import json
import pickle
from pathlib import Path

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedShuffleSplit

BASE_DIR    = Path(__file__).parent
CACHE_PATH  = BASE_DIR / "model" / "reference_embeddings.pt"
LABELS_PATH = BASE_DIR / "model" / "class_labels.json"
CLF_PATH    = BASE_DIR / "model" / "classifier.pkl"


def main() -> None:
    if not CACHE_PATH.exists():
        print("ERROR: reference_embeddings.pt not found.")
        print("Start the ai-service once to build it, then re-run this script.")
        return

    print("Loading embedding cache …")
    cache = torch.load(CACHE_PATH, weights_only=False)
    all_embeddings: np.ndarray = cache["embeddings"]   # (N, 512)
    all_keys: list[str]        = cache["keys"]          # generation key per row

    print(f"  {len(all_keys)} embeddings loaded")

    with open(LABELS_PATH, encoding="utf-8") as f:
        labels_dict = json.load(f)

    all_label_keys = sorted(labels_dict.keys())
    key_to_idx = {k: i for i, k in enumerate(all_label_keys)}
    idx_to_key = {i: k for k, i in key_to_idx.items()}

    valid = [(i, k) for i, k in enumerate(all_keys) if k in key_to_idx]
    X = all_embeddings[[i for i, _ in valid]]
    y = np.array([key_to_idx[k] for _, k in valid])

    n_classes = len(set(y.tolist()))
    print(f"  {len(y)} samples across {n_classes} classes")

    # Stratified 90/10 train/val split
    sss = StratifiedShuffleSplit(n_splits=1, test_size=0.1, random_state=42)
    train_idx, val_idx = next(sss.split(X, y))
    X_train, X_val = X[train_idx], X[val_idx]
    y_train, y_val = y[train_idx], y[val_idx]

    print(f"  Train: {len(y_train)}   Val: {len(y_val)}")
    print("Training logistic regression … (may take 2–5 minutes)")

    clf = LogisticRegression(
        C        = 10.0,
        max_iter = 1000,
        solver   = "lbfgs",
        n_jobs   = -1,
        verbose  = 0,
    )
    clf.fit(X_train, y_train)

    # Top-1 accuracy
    train_top1 = clf.score(X_train, y_train)
    val_top1   = clf.score(X_val,   y_val)

    # Top-5 accuracy
    probs       = clf.predict_proba(X_val)
    top5_pos    = np.argsort(probs, axis=1)[:, -5:]          # column positions
    top5_labels = clf.classes_[top5_pos]                      # map to actual class labels
    val_top5    = float(np.mean([y_val[i] in top5_labels[i] for i in range(len(y_val))]))

    print(f"\nTrain top-1 : {train_top1:.3f}")
    print(f"Val   top-1 : {val_top1:.3f}")
    print(f"Val   top-5 : {val_top5:.3f}")

    with open(CLF_PATH, "wb") as f:
        pickle.dump({
            "clf":        clf,
            "key_to_idx": key_to_idx,
            "idx_to_key": idx_to_key,
        }, f)

    print(f"\nClassifier saved to {CLF_PATH}")
    print("Restart the ai-service to use it.")


if __name__ == "__main__":
    main()