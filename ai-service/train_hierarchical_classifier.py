"""
Train a two-stage hierarchical classifier as an isolated alternative to the flat
classifier (train_classifier.py). Never touches classifier.pkl / reference_embeddings.pt.

Motivation: the flat classifier's top-5 accuracy is far higher than its top-1
(86.2% vs 65.4% on the held-out set), suggesting most errors are "right make/model,
wrong generation" (e.g. a facelift) rather than wildly incorrect guesses. Grouping
the 813 generations by (make, model) yields only 525 distinct groups, 311 of which
(59%) have exactly one generation — no disambiguation needed at all once the group
is right — and the largest group has just 4 generations. So:

  Stage 1: one classifier over 525 (make, model) pairs (down from 813 generations).
  Stage 2: a small classifier per multi-generation pair (never harder than 4-way),
           or a direct lookup for the 311 single-generation pairs.

Usage:
    python train_hierarchical_classifier.py
    python train_hierarchical_classifier.py --cache model/reference_embeddings_no_lora.pt --output model/classifier_hierarchical_no_lora.pkl
"""

import argparse
import json
import pickle
from pathlib import Path

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupShuffleSplit

BASE_DIR    = Path(__file__).parent
CACHE_PATH  = BASE_DIR / "model" / "reference_embeddings.pt"
LABELS_PATH = BASE_DIR / "model" / "class_labels.json"
CLF_PATH    = BASE_DIR / "model" / "classifier_hierarchical.pkl"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, default=CACHE_PATH, help="Embedding cache to train on")
    parser.add_argument("--output", type=Path, default=CLF_PATH, help="Where to save the trained classifier")
    args = parser.parse_args()
    cache_path, clf_path = args.cache, args.output

    if not cache_path.exists():
        print(f"ERROR: {cache_path} not found.")
        return

    print(f"Loading embedding cache from {cache_path} …")
    cache = torch.load(cache_path, weights_only=False)
    all_embeddings: np.ndarray = cache["embeddings"]
    all_keys: list[str] = cache["keys"]
    all_source_ids = cache.get("source_ids")

    if all_source_ids is None:
        print("ERROR: cache has no 'source_ids' (stale format). Rebuild it first.")
        return

    print(f"  {len(all_keys)} embeddings loaded")

    with open(LABELS_PATH, encoding="utf-8") as f:
        labels_dict = json.load(f)

    # Generation-level label maps (same as train_classifier.py, for consistency)
    all_label_keys = sorted(labels_dict.keys())
    key_to_idx = {k: i for i, k in enumerate(all_label_keys)}

    # (make, model) pair label maps — built from the FULL catalogue, not just what's
    # in the training cache, so stage 1 always covers all 525 pairs.
    def pair_of(gen_key: str) -> tuple[str, str]:
        meta = labels_dict[gen_key]
        return (meta["manufacturerName"], meta["modelName"])

    all_pairs = sorted({pair_of(k) for k in all_label_keys})
    pair_key_to_idx = {p: i for i, p in enumerate(all_pairs)}
    pair_idx_to_key = {i: p for p, i in pair_key_to_idx.items()}
    print(f"  {len(all_pairs)} (make,model) pairs across {len(all_label_keys)} generations")

    # Which pairs have only one generation (direct lookup, no stage-2 classifier needed)
    gens_per_pair: dict[tuple[str, str], list[str]] = {}
    for k in all_label_keys:
        gens_per_pair.setdefault(pair_of(k), []).append(k)
    single_gen_map = {p: gens[0] for p, gens in gens_per_pair.items() if len(gens) == 1}
    multi_gen_pairs = [p for p, gens in gens_per_pair.items() if len(gens) >= 2]
    print(f"  {len(single_gen_map)} single-generation pairs, {len(multi_gen_pairs)} multi-generation pairs")

    valid = [(i, k) for i, k in enumerate(all_keys) if k in key_to_idx]
    X = all_embeddings[[i for i, _ in valid]]
    y = np.array([key_to_idx[k] for _, k in valid])                        # generation-level
    y_pair = np.array([pair_key_to_idx[pair_of(k)] for _, k in valid])     # pair-level
    groups = np.array([all_source_ids[i] for i, _ in valid])

    print(f"  {len(y)} samples across {len(set(y.tolist()))} generation classes")

    gss = GroupShuffleSplit(n_splits=1, test_size=0.1, random_state=42)
    train_idx, val_idx = next(gss.split(X, y, groups=groups))
    X_train, X_val = X[train_idx], X[val_idx]
    y_train, y_val = y[train_idx], y[val_idx]
    y_pair_train, y_pair_val = y_pair[train_idx], y_pair[val_idx]

    print(f"  Train: {len(y_train)}   Val: {len(y_val)}")

    # ── Stage 1: (make, model) pair classifier ──────────────────────────────────
    print("\nTraining stage 1 (pair classifier) …")
    stage1_clf = LogisticRegression(C=10.0, max_iter=1000, solver="lbfgs", verbose=0)
    stage1_clf.fit(X_train, y_pair_train)

    stage1_train_top1 = stage1_clf.score(X_train, y_pair_train)
    stage1_val_top1 = stage1_clf.score(X_val, y_pair_val)
    probs = stage1_clf.predict_proba(X_val)
    top5_pos = np.argsort(probs, axis=1)[:, -5:]
    top5_labels = stage1_clf.classes_[top5_pos]
    stage1_val_top5 = float(np.mean([y_pair_val[i] in top5_labels[i] for i in range(len(y_pair_val))]))

    print(f"  Stage 1 train top-1 : {stage1_train_top1:.3f}")
    print(f"  Stage 1 val   top-1 : {stage1_val_top1:.3f}")
    print(f"  Stage 1 val   top-5 : {stage1_val_top5:.3f}")

    # ── Stage 2: per-group generation classifiers ───────────────────────────────
    print(f"\nTraining stage 2 ({len(multi_gen_pairs)} per-group classifiers) …")
    idx_to_key = {i: k for k, i in key_to_idx.items()}
    stage2_clfs: dict[tuple[str, str], LogisticRegression] = {}
    stage2_label_maps: dict[tuple[str, str], dict] = {}
    skipped_groups = 0

    for pair in multi_gen_pairs:
        pair_idx = pair_key_to_idx[pair]
        group_gen_keys = gens_per_pair[pair]
        group_key_to_local = {k: i for i, k in enumerate(group_gen_keys)}
        local_idx_to_key = {i: k for k, i in group_key_to_local.items()}

        # rows in the TRAIN split belonging to this pair
        mask = y_pair_train == pair_idx
        X_group = X_train[mask]
        y_group = np.array([group_key_to_local[idx_to_key[gi]] for gi in y_train[mask]])

        if len(set(y_group.tolist())) < 2:
            # only one generation survived the split for this group — no classifier
            # needed/possible; fall back to direct lookup for whichever one is present.
            skipped_groups += 1
            fallback_key = local_idx_to_key[y_group[0]] if len(y_group) else group_gen_keys[0]
            single_gen_map[pair] = fallback_key
            continue

        try:
            clf = LogisticRegression(C=10.0, max_iter=1000, solver="lbfgs", verbose=0)
            clf.fit(X_group, y_group)
        except Exception as exc:
            print(f"  Skipping {pair}: {exc}")
            skipped_groups += 1
            continue

        stage2_clfs[pair] = clf
        stage2_label_maps[pair] = {"idx_to_key": local_idx_to_key}

    print(f"  Trained {len(stage2_clfs)} stage-2 classifiers ({skipped_groups} groups fell back to direct lookup)")

    # ── Diagnostic: stage-2 accuracy conditional on stage-1 being correct ──────
    stage1_val_pred = stage1_clf.predict(X_val)
    correct_mask = stage1_val_pred == y_pair_val
    n_correct = int(correct_mask.sum())
    stage2_hits = 0
    for i in np.where(correct_mask)[0]:
        pair = pair_idx_to_key[int(y_pair_val[i])]
        true_key = idx_to_key[int(y_val[i])]
        if pair in single_gen_map:
            pred_key = single_gen_map[pair]
        elif pair in stage2_clfs:
            local_pred = stage2_clfs[pair].predict(X_val[i:i+1])[0]
            pred_key = stage2_label_maps[pair]["idx_to_key"][int(local_pred)]
        else:
            pred_key = None
        if pred_key == true_key:
            stage2_hits += 1

    if n_correct:
        print(f"\n  Given stage-1 correct ({n_correct} val rows): stage-2 top-1 = {stage2_hits/n_correct:.3f}")

    # ── Save ─────────────────────────────────────────────────────────────────
    with open(clf_path, "wb") as f:
        pickle.dump({
            "format": "hierarchical_v1",
            "stage1_clf": stage1_clf,
            "pair_key_to_idx": pair_key_to_idx,
            "pair_idx_to_key": pair_idx_to_key,
            "stage2_clfs": stage2_clfs,
            "stage2_label_maps": stage2_label_maps,
            "single_gen_map": single_gen_map,
        }, f)

    print(f"\nClassifier saved to {clf_path}")
    print(f"Evaluate with: python evaluate.py --classifier {clf_path} --label hierarchical")


if __name__ == "__main__":
    main()
