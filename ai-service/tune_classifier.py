"""
Sweep classifier hyperparameters/architectures on the cached embeddings to find a
config that generalizes better than the current logistic regression (C=10), which
shows a large train/val gap (overfitting) on this thin, 813-class dataset.

Uses the same group split as train_classifier.py (same random_state) so results are
directly comparable to its reported numbers. Does NOT overwrite classifier.pkl —
report only. Once you pick a winner, update train_classifier.py's classifier config
to match and re-run that script to produce the final classifier.pkl.

Usage:
    python tune_classifier.py
"""

import json
import time
from pathlib import Path

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupShuffleSplit
from sklearn.neural_network import MLPClassifier

BASE_DIR    = Path(__file__).parent
CACHE_PATH  = BASE_DIR / "model" / "reference_embeddings.pt"
LABELS_PATH = BASE_DIR / "model" / "class_labels.json"


def top_k_accuracy(clf, X_val, y_val, k: int) -> float:
    probs = clf.predict_proba(X_val)
    top_pos = np.argsort(probs, axis=1)[:, -k:]
    top_labels = clf.classes_[top_pos]
    return float(np.mean([y_val[i] in top_labels[i] for i in range(len(y_val))]))


def main() -> None:
    if not CACHE_PATH.exists():
        print("ERROR: reference_embeddings.pt not found.")
        return

    print("Loading embedding cache …")
    cache = torch.load(CACHE_PATH, weights_only=False)
    all_embeddings: np.ndarray = cache["embeddings"]
    all_keys: list[str] = cache["keys"]
    all_source_ids = cache.get("source_ids")

    if all_source_ids is None:
        print("ERROR: cache has no 'source_ids' (stale format). Rebuild it first.")
        return

    with open(LABELS_PATH, encoding="utf-8") as f:
        labels_dict = json.load(f)

    all_label_keys = sorted(labels_dict.keys())
    key_to_idx = {k: i for i, k in enumerate(all_label_keys)}

    valid = [(i, k) for i, k in enumerate(all_keys) if k in key_to_idx]
    X = all_embeddings[[i for i, _ in valid]]
    y = np.array([key_to_idx[k] for _, k in valid])
    groups = np.array([all_source_ids[i] for i, _ in valid])

    print(f"  {len(y)} samples across {len(set(y.tolist()))} classes")

    gss = GroupShuffleSplit(n_splits=1, test_size=0.1, random_state=42)
    train_idx, val_idx = next(gss.split(X, y, groups=groups))
    X_train, X_val = X[train_idx], X[val_idx]
    y_train, y_val = y[train_idx], y[val_idx]
    print(f"  Train: {len(y_train)}   Val: {len(y_val)}\n")

    configs = [
        ("LogisticRegression C=0.1",  lambda: LogisticRegression(C=0.1,  max_iter=1000, solver="lbfgs", n_jobs=-1)),
        ("LogisticRegression C=0.3",  lambda: LogisticRegression(C=0.3,  max_iter=1000, solver="lbfgs", n_jobs=-1)),
        ("LogisticRegression C=1.0",  lambda: LogisticRegression(C=1.0,  max_iter=1000, solver="lbfgs", n_jobs=-1)),
        ("LogisticRegression C=3.0",  lambda: LogisticRegression(C=3.0,  max_iter=1000, solver="lbfgs", n_jobs=-1)),
        ("LogisticRegression C=10.0 (baseline)", lambda: LogisticRegression(C=10.0, max_iter=1000, solver="lbfgs", n_jobs=-1)),
        ("MLP 256 alpha=1e-2", lambda: MLPClassifier(hidden_layer_sizes=(256,), alpha=1e-2, max_iter=200,
                                                       early_stopping=True, n_iter_no_change=10, random_state=42)),
        ("MLP 256 alpha=1e-3", lambda: MLPClassifier(hidden_layer_sizes=(256,), alpha=1e-3, max_iter=200,
                                                       early_stopping=True, n_iter_no_change=10, random_state=42)),
    ]

    results = []
    for name, build in configs:
        t0 = time.time()
        clf = build()
        clf.fit(X_train, y_train)
        train_top1 = clf.score(X_train, y_train)
        val_top1 = clf.score(X_val, y_val)
        val_top5 = top_k_accuracy(clf, X_val, y_val, 5)
        elapsed = time.time() - t0
        print(f"{name:38s}  train={train_top1:.3f}  val_top1={val_top1:.3f}  val_top5={val_top5:.3f}  ({elapsed:.0f}s)")
        results.append((name, train_top1, val_top1, val_top5))

    best = max(results, key=lambda r: r[2])
    print(f"\nBest by val top-1: {best[0]} ({best[2]:.3f})")


if __name__ == "__main__":
    main()
