"""
End-to-end evaluation against the held-out test set built by model_loader._build_index.

Runs each held-out image through the live CarClassifier.predict() (the same code path
the API uses — YOLO crop, CLIP embed with test-time augmentation, then classifier/FAISS)
and reports overall top-1/top-5 accuracy plus a per-(make,model) breakdown and the
worst-confused pairs.

Run this after the ai-service has rebuilt reference_embeddings.pt at least once (so
model/held_out_test_set.json exists) and after train_classifier.py has produced an
up-to-date classifier.pkl.

Usage:
    python evaluate.py
    python evaluate.py --no-lora --classifier model/classifier_no_lora.pkl \\
        --cache model/reference_embeddings_no_lora.pt --label no_lora
"""

import argparse
import json
import statistics
from collections import Counter
from pathlib import Path

from src.model_loader import CarClassifier, load_labels_dict, HELD_OUT_PATH, LORA_DIR, CLASSIFIER_PATH, EMBEDDINGS_CACHE

BASE_DIR = Path(__file__).parent


# Mirrors Camera.jsx's isAmbiguous() exactly (frontend/src/pages/Camera.jsx) —
# when this is true, the user sees a confirm-step picker instead of a silent
# auto-add, so a wrong top-1 prediction doesn't necessarily mean a wrong scan
# from the user's point of view.
AMBIGUOUS_RATIO = 0.6
LOW_CONFIDENCE_FLOOR = 0.30


def _is_ambiguous(candidates: list) -> bool:
    if not candidates:
        return False
    if candidates[0]["confidence"] < LOW_CONFIDENCE_FLOOR:
        return True
    return len(candidates) > 1 and candidates[1]["confidence"] >= candidates[0]["confidence"] * AMBIGUOUS_RATIO


def _stats(values: list) -> dict:
    if not values:
        return {}
    s = sorted(values)
    n = len(s)
    return {
        "count":  n,
        "mean":   round(statistics.mean(s), 4),
        "median": round(statistics.median(s), 4),
        "p25":    round(s[int(n * 0.25)], 4),
        "p75":    round(s[int(n * 0.75)], 4),
        "min":    round(s[0], 4),
        "max":    round(s[-1], 4),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--classifier", type=Path, default=CLASSIFIER_PATH)
    parser.add_argument("--cache", type=Path, default=EMBEDDINGS_CACHE)
    parser.add_argument("--no-lora", action="store_true", help="Use base CLIP, ignoring any clip_lora adapter")
    parser.add_argument("--label", default="", help="Suffix for the results filename, e.g. 'no_lora'")
    args = parser.parse_args()

    results_path = BASE_DIR / "model" / (f"eval_results_{args.label}.json" if args.label else "eval_results.json")

    if not HELD_OUT_PATH.exists():
        print("ERROR: held_out_test_set.json not found.")
        print("Start the ai-service once (it builds this file as part of _build_index), then re-run this script.")
        return

    labels_dict = load_labels_dict()
    print("Loading CarClassifier (YOLO + CLIP + classifier/FAISS) …")
    # Constructing this runs _build_index(), which normalizes held_out_test_set.json's
    # paths to the local filesystem (e.g. a file placed here from a Colab run still has
    # Colab-style paths until this runs once) — so load the held-out set only after.
    classifier = CarClassifier(
        labels_dict,
        lora_dir=None if args.no_lora else LORA_DIR,
        classifier_path=args.classifier,
        embeddings_cache=args.cache,
    )

    with HELD_OUT_PATH.open("r", encoding="utf-8") as f:
        held_out: dict = json.load(f)

    print(f"Loaded {len(held_out)} held-out test images.")

    top1_correct = 0
    top5_correct = 0
    make_model_correct = 0       # predicted (make, model) matches, regardless of exact generation
    make_model_top5_correct = 0  # actual (make, model) appears among the top-5 candidates' (make, model)
    total = 0
    skipped = 0

    pair_total: Counter = Counter()
    pair_correct: Counter = Counter()
    confusion: Counter = Counter()   # (actual_pair, predicted_pair) -> count

    # To check whether a confidently-wrong top-1 (no close second place, still
    # incorrect — e.g. BMW M3 G80 confidently called an M4 G82) can be caught
    # by an absolute-confidence floor rather than only a close-second-place
    # ratio, which by definition can't see this failure mode at all.
    correct_top1_conf   : list = []
    incorrect_top1_conf : list = []
    correct_top2_ratio  : list = []  # candidates[1].confidence / candidates[0].confidence
    incorrect_top2_ratio: list = []

    top10_correct = 0
    not_in_candidates: list = []  # true (make, model, genCode) entirely absent from the returned list

    # Does the confirm-step UX (Camera.jsx's isAmbiguous()) actually protect the
    # user from a wrong top-1, or does it silently auto-add the wrong car? Split
    # by same-manufacturer-wrong (the "right brand, wrong model in the lineup"
    # failure mode) vs a completely different manufacturer, since they're
    # different problems with potentially different confirm-UX behavior.
    wrong_same_brand_ambiguous     = 0
    wrong_same_brand_silent        = 0
    wrong_diff_brand_ambiguous     = 0
    wrong_diff_brand_silent        = 0
    # Of the silently-wrong ones (no confirm chance at all), how many at least
    # have the true answer somewhere in the candidates list (recoverable via the
    # "all candidates" picker) vs genuinely absent (not_in_candidates).
    silent_wrong_true_in_top10     = 0
    silent_wrong_true_missing      = 0
    # For the recoverable-but-silent cases specifically: where does the true
    # answer actually rank, and how close were the two isAmbiguous() thresholds
    # to firing? Answers "would a small threshold tweak catch most of these, or
    # are they a fundamentally different shape (true answer ranked low, with a
    # confident, un-close top-1)?"
    silent_recoverable_detail: list = []

    # Calibration data for MIN_RAW_SIMILARITY (out-of-catalogue detection) — every
    # held-out image is a GENUINE catalogue car, so this distribution is "how
    # similar does a real match look, at the low end" — there's no true-negative
    # set to sweep against, so the floor gets set comfortably below this range.
    raw_similarities: list = []
    correct_raw_sim: list = []
    incorrect_raw_sim: list = []

    for key, img_path in held_out.items():
        p = Path(img_path)
        if key not in labels_dict or not p.exists():
            skipped += 1
            continue

        actual_meta = labels_dict[key]
        actual_pair = (actual_meta["manufacturerName"], actual_meta["modelName"])

        image_bytes = p.read_bytes()
        try:
            label, confidence, meta, candidates, no_vehicle_detected, raw_sim = (
                classifier.predict_with_raw_similarity(image_bytes)
            )
        except Exception as exc:
            print(f"  Skipping {p.name}: {exc}")
            skipped += 1
            continue

        total += 1
        pair_total[actual_pair] += 1
        raw_similarities.append(raw_sim)

        predicted_keys_top5 = [c["key"] for c in candidates[:5]]
        all_predicted_keys  = [c["key"] for c in candidates]  # top_k=10 by default
        is_top1 = label == key
        is_top5 = key in predicted_keys_top5
        is_top10 = key in all_predicted_keys
        (correct_raw_sim if is_top1 else incorrect_raw_sim).append(raw_sim)

        if is_top10:
            top10_correct += 1
        else:
            not_in_candidates.append({
                "manufacturerName": actual_meta["manufacturerName"],
                "modelName": actual_meta["modelName"],
                "generationCode": actual_meta["generationCode"],
            })

        predicted_pair = (
            (meta["manufacturerName"], meta["modelName"]) if meta else ("unknown", "unknown")
        )

        if is_top1:
            top1_correct += 1
            pair_correct[actual_pair] += 1
            correct_top1_conf.append(confidence)
        else:
            confusion[(actual_pair, predicted_pair)] += 1
            incorrect_top1_conf.append(confidence)

            same_brand = predicted_pair[0] == actual_pair[0]
            ambiguous = _is_ambiguous(candidates)
            if same_brand:
                if ambiguous: wrong_same_brand_ambiguous += 1
                else:         wrong_same_brand_silent    += 1
            else:
                if ambiguous: wrong_diff_brand_ambiguous += 1
                else:         wrong_diff_brand_silent    += 1
            if not ambiguous:
                if is_top10:
                    silent_wrong_true_in_top10 += 1
                    top1_conf = candidates[0]["confidence"]
                    top2_ratio = (candidates[1]["confidence"] / top1_conf) if len(candidates) > 1 and top1_conf > 0 else None
                    silent_recoverable_detail.append({
                        "trueRank": all_predicted_keys.index(key) + 1,
                        "top1Confidence": round(top1_conf, 4),
                        "top2Ratio": round(top2_ratio, 4) if top2_ratio is not None else None,
                        "sameBrand": same_brand,
                    })
                else:
                    silent_wrong_true_missing += 1

        if len(candidates) > 1 and candidates[0]["confidence"] > 0:
            ratio = candidates[1]["confidence"] / candidates[0]["confidence"]
            (correct_top2_ratio if is_top1 else incorrect_top2_ratio).append(ratio)

        if is_top5:
            top5_correct += 1

        # Right car, possibly wrong model year — a much smaller miss than a
        # completely different make/model, and the thing that actually
        # determines whether a scan "feels" correct to a user.
        if predicted_pair == actual_pair:
            make_model_correct += 1

        top5_pairs = {
            (c["manufacturerName"], c["modelName"]) for c in candidates[:5]
        }
        if actual_pair in top5_pairs:
            make_model_top5_correct += 1

    if total == 0:
        print("No valid held-out images evaluated.")
        return

    top1_acc = top1_correct / total
    top5_acc = top5_correct / total
    top10_acc = top10_correct / total
    make_model_acc = make_model_correct / total
    make_model_top5_acc = make_model_top5_correct / total

    print(f"\nEvaluated {total} held-out images ({skipped} skipped).")
    print(f"Top-1 accuracy (exact generation):        {top1_acc:.3f}")
    print(f"Top-5 accuracy (exact generation):        {top5_acc:.3f}")
    print(f"Top-10 accuracy (exact generation):       {top10_acc:.3f}")
    print(f"Make+model accuracy (any generation):     {make_model_acc:.3f}")
    print(f"Make+model top-5 accuracy (any generation): {make_model_top5_acc:.3f}")
    print(f"\nCompletely missed (true answer not even in the top-10): {len(not_in_candidates)} / {total} ({len(not_in_candidates)/total:.1%})")
    for row in not_in_candidates:
        print(f"  {row['manufacturerName']} {row['modelName']} ({row['generationCode']})")

    correct_conf_stats   = _stats(correct_top1_conf)
    incorrect_conf_stats = _stats(incorrect_top1_conf)
    correct_ratio_stats   = _stats(correct_top2_ratio)
    incorrect_ratio_stats = _stats(incorrect_top2_ratio)

    print("\nTop-1 confidence, correct vs incorrect predictions:")
    print(f"  Correct:   {correct_conf_stats}")
    print(f"  Incorrect: {incorrect_conf_stats}")
    print("\nTop-2/top-1 confidence ratio, correct vs incorrect predictions:")
    print(f"  Correct:   {correct_ratio_stats}")
    print(f"  Incorrect: {incorrect_ratio_stats}")

    # Precision/recall sweep for an absolute-confidence floor: at each
    # candidate threshold, what fraction of WRONG top-1s get caught (flagged
    # for confirmation) vs what fraction of RIGHT top-1s get needlessly
    # flagged too (friction cost). This range calibrates the confirm-UX's
    # LOW_CONFIDENCE_FLOOR (Camera.jsx), not the backend's MIN_CONFIDENCE.
    print("\nAbsolute-confidence floor sweep (flag if top-1 confidence < threshold):")
    print(f"  {'threshold':>9}  {'wrong caught':>13}  {'right flagged':>14}")
    for threshold in [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50]:
        wrong_caught = sum(1 for c in incorrect_top1_conf if c < threshold) / len(incorrect_top1_conf)
        right_flagged = sum(1 for c in correct_top1_conf if c < threshold) / len(correct_top1_conf)
        print(f"  {threshold:>9.2f}  {wrong_caught:>12.1%}  {right_flagged:>13.1%}")

    # Separate, finer-grained sweep for model_loader.py's MIN_CONFIDENCE — a
    # much stricter floor than the confirm-UX's, meant only to catch "no real
    # signal at all" cases (reported as fully unknown, not even a picker) so
    # it must stay well below where genuine correct answers start appearing.
    print("\nMIN_CONFIDENCE floor sweep (backend 'report as unknown' threshold, current 0.04):")
    print(f"  {'threshold':>9}  {'wrong caught':>13}  {'right flagged':>14}")
    for threshold in [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10]:
        wrong_caught = sum(1 for c in incorrect_top1_conf if c < threshold) / len(incorrect_top1_conf)
        right_flagged = sum(1 for c in correct_top1_conf if c < threshold) / len(correct_top1_conf)
        print(f"  {threshold:>9.2f}  {wrong_caught:>12.1%}  {right_flagged:>13.1%}")

    # Calibration data for MIN_RAW_SIMILARITY (out-of-catalogue detection). Every
    # held-out image is a genuine catalogue car, so this is "how similar does a
    # real match look, even at the low end" — there's no true-negative set to
    # sweep against here, so the floor should be set comfortably below this range.
    raw_sim_stats = _stats(raw_similarities)
    correct_raw_sim_stats = _stats(correct_raw_sim)
    incorrect_raw_sim_stats = _stats(incorrect_raw_sim)
    print("\nRaw top-1 FAISS similarity (all held-out images are genuine catalogue cars):")
    print(f"  Overall:   {raw_sim_stats}")
    print(f"  Correct:   {correct_raw_sim_stats}")
    print(f"  Incorrect: {incorrect_raw_sim_stats}")
    sorted_sims = sorted(raw_similarities)
    n = len(sorted_sims)
    for pct in (1, 2, 5, 10):
        idx = max(0, int(n * pct / 100) - 1)
        print(f"  p{pct}: {sorted_sims[idx]:.4f}")

    wrong_total = len(incorrect_top1_conf)
    same_brand_total = wrong_same_brand_ambiguous + wrong_same_brand_silent
    diff_brand_total = wrong_diff_brand_ambiguous + wrong_diff_brand_silent
    silent_total = wrong_same_brand_silent + wrong_diff_brand_silent

    def _pct(n, d):
        return round(n / d, 4) if d else None

    print("\nConfirm-UX protection against wrong top-1 predictions (isAmbiguous() replica):")
    print(f"  Wrong predictions, same manufacturer (e.g. Audi->Audi): {same_brand_total}")
    print(f"    -> caught by confirm-UX (ambiguous, user sees a picker): {wrong_same_brand_ambiguous} ({_pct(wrong_same_brand_ambiguous, same_brand_total):.1%})" if same_brand_total else "    (none)")
    print(f"    -> silently auto-added wrong, no chance to correct:      {wrong_same_brand_silent} ({_pct(wrong_same_brand_silent, same_brand_total):.1%})" if same_brand_total else "")
    print(f"  Wrong predictions, different manufacturer: {diff_brand_total}")
    print(f"    -> caught by confirm-UX: {wrong_diff_brand_ambiguous} ({_pct(wrong_diff_brand_ambiguous, diff_brand_total):.1%})" if diff_brand_total else "    (none)")
    print(f"    -> silently auto-added wrong:            {wrong_diff_brand_silent} ({_pct(wrong_diff_brand_silent, diff_brand_total):.1%})" if diff_brand_total else "")
    print(f"  Overall: {wrong_total - silent_total}/{wrong_total} wrong predictions ({_pct(wrong_total - silent_total, wrong_total):.1%}) are caught by the confirm-UX.")
    print(f"  Of the {silent_total} silently-wrong (no confirm chance at all):")
    print(f"    -> true answer still recoverable somewhere in top-10: {silent_wrong_true_in_top10} ({_pct(silent_wrong_true_in_top10, silent_total):.1%})" if silent_total else "    (none)")
    print(f"    -> true answer genuinely absent from top-10:          {silent_wrong_true_missing} ({_pct(silent_wrong_true_missing, silent_total):.1%})" if silent_total else "")

    if silent_recoverable_detail:
        ranks = [d["trueRank"] for d in silent_recoverable_detail]
        rank_counts = Counter(ranks)
        near_miss_ratio = sum(1 for d in silent_recoverable_detail if d["top2Ratio"] is not None and 0.5 <= d["top2Ratio"] < AMBIGUOUS_RATIO)
        near_miss_conf  = sum(1 for d in silent_recoverable_detail if LOW_CONFIDENCE_FLOOR <= d["top1Confidence"] < LOW_CONFIDENCE_FLOOR + 0.05)
        print(f"\nOf the {len(silent_recoverable_detail)} silent-but-recoverable cases — where does the true answer actually rank?")
        for rank in sorted(rank_counts):
            print(f"  rank #{rank}: {rank_counts[rank]}")
        print(f"  Near-miss on the ratio threshold (top2/top1 in [0.50, {AMBIGUOUS_RATIO})): {near_miss_ratio} ({_pct(near_miss_ratio, len(silent_recoverable_detail)):.1%})")
        print(f"  Near-miss on the confidence floor (top1 in [{LOW_CONFIDENCE_FLOOR}, {LOW_CONFIDENCE_FLOOR+0.05:.2f})): {near_miss_conf} ({_pct(near_miss_conf, len(silent_recoverable_detail)):.1%})")

    per_pair = []
    for pair, n in pair_total.items():
        acc = pair_correct[pair] / n
        per_pair.append({
            "manufacturerName": pair[0],
            "modelName": pair[1],
            "count": n,
            "accuracy": round(acc, 3),
        })
    per_pair.sort(key=lambda r: r["accuracy"])

    worst_confusion = [
        {
            "actual": {"manufacturerName": a[0], "modelName": a[1]},
            "predicted": {"manufacturerName": pr[0], "modelName": pr[1]},
            "count": n,
        }
        for (a, pr), n in confusion.most_common(None)
    ]

    print("\nWorst-performing (make, model) pairs:")
    for row in per_pair[:15]:
        print(f"  {row['manufacturerName']} {row['modelName']}: {row['accuracy']:.2f} ({row['count']} sample(s))")

    results = {
        "total": total,
        "skipped": skipped,
        "top1Accuracy": round(top1_acc, 4),
        "top5Accuracy": round(top5_acc, 4),
        "top10Accuracy": round(top10_acc, 4),
        "makeModelAccuracy": round(make_model_acc, 4),
        "makeModelTop5Accuracy": round(make_model_top5_acc, 4),
        "notInCandidates": not_in_candidates,
        "confidenceStats": {
            "correctTop1":     correct_conf_stats,
            "incorrectTop1":   incorrect_conf_stats,
            "correctTop2Ratio":   correct_ratio_stats,
            "incorrectTop2Ratio": incorrect_ratio_stats,
        },
        "rawSimilarityStats": {
            "overall":   raw_sim_stats,
            "correct":   correct_raw_sim_stats,
            "incorrect": incorrect_raw_sim_stats,
        },
        "confirmUxProtection": {
            "sameBrandWrong": {
                "total": same_brand_total,
                "caughtByConfirmUx": wrong_same_brand_ambiguous,
                "silentlyWrong": wrong_same_brand_silent,
            },
            "diffBrandWrong": {
                "total": diff_brand_total,
                "caughtByConfirmUx": wrong_diff_brand_ambiguous,
                "silentlyWrong": wrong_diff_brand_silent,
            },
            "silentlyWrongBreakdown": {
                "trueAnswerInTop10": silent_wrong_true_in_top10,
                "trueAnswerMissing": silent_wrong_true_missing,
            },
            "silentRecoverableDetail": silent_recoverable_detail,
        },
        "perPair": per_pair,
        "worstConfusion": worst_confusion,
    }
    with results_path.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent="\t")
    print(f"\nSaved detailed results to {results_path}")


if __name__ == "__main__":
    main()
