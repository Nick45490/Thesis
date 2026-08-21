# Street Scout — Future Improvements

A running list of possible next steps, compiled after the AI pipeline overhaul,
rarity redesign, circuit race mode, and the two-pass backend security/quality
audit (2026-08-17).

## AI / Recognition pipeline

- ~~The LoRA ablation notebook was built but results were never reported
  back~~ — done (2026-08-20): LoRA is a decisive win, +7.6pp top-1 (64.5% vs
  56.9% base CLIP) on the same 812-image held-out set. Keep the adapter.
- ~~Classifier hyperparameter sweep (`tune_classifier.py`) was built but
  never acted on~~ — run (2026-08-20), negative result: the current
  production config (logistic regression, C=10) already wins the entire
  sweep (val top-1 0.656) against 4 weaker-regularization variants (val
  top-1 0.171–0.608) and two MLP architectures (0.629, 0.642, both slower to
  train too). The large train/val gap (0.912 vs 0.656) is real but doesn't
  look fixable within this model family — looks like an inherent property of
  813-way classification on ~77 samples/class, not overfitting a
  differently-tuned model could resolve. Third negative result this session
  in the same vein as the crop-cleanup and the pre-existing (2026-08-14)
  hierarchical-classifier attempt (`classifier_hierarchical.pkl`,
  63.7%/85.5% — also a wash). No further action here unless the underlying
  data situation changes (see domain-matched training data, below).
- Domain-matched training data — the reference set is built from
  catalogue/stock photos, but real scans are phone photos in the wild
  (varied lighting, angles, backgrounds). This gap between training and
  real-world distribution is the single biggest lever left for accuracy.
- Revisit `MIN_CONFIDENCE` (currently 0.04) now that the classifier's been
  retrained on the expanded dataset — trades off false "confident" IDs vs.
  false "unknown"s.
- No mechanism to retrain periodically as real user scans accumulate — the
  reference set only grows when someone manually re-runs the fetch scripts.
- ~~Deep-dive on what's actually driving the accuracy gap and whether the
  confirm-UX already covers it~~ — done (2026-08-20/21), `evaluate.py`
  permanently extended with two new diagnostics (not one-off scripts):
  1. **Error breakdown**: of 288 wrong top-1s, only 17.7% are "right
     make+model, wrong generation" — 82.3% are a genuinely different car.
     Real per-segment top-1 accuracy ranges from Supercar 40% / Estate 50%
     up to Convertible/Pickup 100% (small n). Two distinct failure modes:
     same-brand-lineup confusion (Supercar 78%, SUV/Crossover 50% of their
     own errors — a real, inherent visual-similarity limit) vs. Estate not
     being recognized as its own body style at all (91% of Estate errors go
     to a different segment entirely — visually confirmed: reference photos
     mix dead-on front shots, which hide a wagon's defining feature, the
     extended roofline, with good 3/4-angle shots that show it clearly, no
     filtering between them). The Estate case is a genuinely fixable
     reference-photo problem; the same-brand case isn't.
  2. **Confirm-UX protection analysis** (new `confirmUxProtection` block in
     `eval_results.json`): 75.3% of all wrong top-1s are already caught by
     the existing confirm-step UX (`isAmbiguous()` in Camera.jsx) — user
     sees a picker, not a silent wrong add. Practical/felt accuracy is
     closer to ~91% (741/812) than the raw 64.5% top-1 suggests. Checked
     whether a threshold tweak could close the remaining silent-wrong gap
     (65 cases): no — 57% have the true answer at rank #3+ (structurally
     invisible to a top-1-vs-top-2 ratio check), and only ~12-14% are near
     either existing threshold. Confirmed: this validates the earlier
     decision to build the confirm-UX instead of chasing raw top-1, and
     there's no cheap further win here.
  Net: no code/behavior change from this item itself (pure diagnostics),
  but it rules out further classifier-side or threshold-side tuning as
  worthwhile, and leaves two live threads — angle-filtering reference
  photos for profile-defined segments (Estate/MPV/Crossover, untested) and
  domain-matched training data (still the biggest lever, still blocked).
- Angle-filtering for Estate reference photos — attempted (2026-08-21),
  shelved: built `audit_reference_angles.py` (uncommitted, in
  ai-service/) using zero-shot CLIP (base model, 4 angle-prompt classes) to
  flag dead-on front/rear reference photos, since one was visually
  confirmed to hide a wagon's defining silhouette. The tool failed its own
  sanity check — it classified that exact known dead-on-front image as
  "three_quarter" (good), and every confidence score across the whole
  320-image Estate run clustered tightly in a noise-level 0.17-0.24 range.
  Zero-shot CLIP doesn't cleanly discriminate photographic angle the way it
  discriminates car identity, at least not with these prompts. The reported
  8.1% dead-on rate can't be trusted given that. Not pursued further for
  now (better prompts, or manual human review of a sample, are the two
  options if revisited) — reference-photo angle remains a plausible but
  now-unconfirmed hypothesis, not a validated fix.

## Backend architecture

- ~~catalogue-service reaches directly into ai-service's filesystem for car
  images~~ — done (2026-08-20): turned out to be dead code, not a live
  coupling — the `/car-images` static route's only consumer (`carImageUrl()`
  in Race.jsx) was defined but never called anywhere. Everywhere car images
  actually render uses ai-service's own `/recognize/images/:id` route
  instead. Deleted both sides rather than picking an architecture, since
  neither was actually needed.
- ~~gamification-service directly `JOIN`s auth-service's `users` table
  across a service boundary~~ — done (2026-08-20): replaced with a batch
  `GET /internal/users?ids=...` endpoint on auth-service, fail-closed HTTP
  call from gamification-service, same pattern as the existing
  `checkFriends`/`isFriendOf` internal-secret flow.
- ~~No automated test suite anywhere~~ — done (2026-08-20): Jest unit tests
  across all four Node services — gamification-service (race/points
  formulas, internal-secret middleware, username-merge logic), gateway (JWT
  auth, proxy identity-header handling), auth-service (users-by-ids internal
  endpoint), and collection-service (internal-secret middleware, rarity
  tiers, collection-payload validation, the achievement/completionist/country
  catalogue logic) — 87 tests total.
- ~~No CI~~ — done (2026-08-20): GitHub Actions runs all four test suites
  on every push/PR to master, confirmed green on the actual runners. Doesn't
  run smoke-test.ps1 yet — that needs Postgres + all 5 services up in CI, a
  bigger lift than the unit tests were.

## Features / gameplay

- Circuit mode has exactly one track (Silverstone) — multi-track support was
  the natural next step when it was designed, never built.
- ~~`DELETE /friends/:friendId` exists in the backend but has zero UI
  surface~~ — done (2026-08-20): Remove button on each Friends page row,
  with a confirm step. Live-tested.
- ~~Leaderboard is all-time only — no weekly/monthly reset~~ — done
  (2026-08-20): turned out there was no leaderboard page in the frontend at
  all (the API existed, nothing called it) — built one from scratch rather
  than just adding a toggle. `races.created_at` already existed, so periods
  are a query filter (`period=weekly|monthly|all`), no schema change or
  archival needed — old leaders aren't erased, they just stop dominating the
  shorter views. New nav link, medal ranks, username resolution via the same
  authClient pattern as race challenges. Live-tested.
- Splitting high-performance trims into separate catalogue entries (e.g.
  base Mustang vs. GT500) was explicitly deferred as "post-production" —
  still on the table.

## Frontend UX

- Nothing tells existing users *why* their collection's rarity distribution
  changed when it flipped from make-based to power-to-weight-based — a
  returning user could be confused their "legendary" Ferrari is now "epic."
- ~~The circuit track view shows a marker moving along Silverstone but no
  lap-progress indicator~~ — done (2026-08-20): each car now shows live
  %-complete and current corner name (e.g. "42% · Maggotts") during the
  animation. Corner lengths are evenly split from the real 5,891m lap minus
  the 3 straights' known lengths — an approximation, not sourced telemetry.
  Live-tested.
- ~~No user-facing messaging for the censoring-fails-closed behavior~~ —
  done (2026-08-20): the answer was "looks like a generic error, and a
  misleading one" — a censoring crash was caught by the same handler as an
  actually-bad image and returned `400 "Invalid image: <raw exception>"`.
  Split into its own handler on ai-service (`503`, honest message); no
  frontend change needed, `apiFetch`/Camera.jsx already surface `detail`
  correctly. Live-tested by temporarily forcing `_detect` to raise, sending
  a real scan, confirming the actual HTTP response was `503` with the new
  message (not the old `400 "Invalid image"`), then reverting the fault.

## Security / ops (lower priority)

- `INTERNAL_SERVICE_SECRET`/`JWT_SECRET` have no rotation story — fine for a
  personal project, but worth knowing if this ever goes further.
- Rate limiting is IP-based only — no additional per-user limiting on
  authenticated routes.
