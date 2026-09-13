+++++# Street Scout — Future Improvements

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
  Checked real volume (2026-08-21) via new `collection-service/scripts/
  check-real-scans.js` (real, reusable, keep this one — unlike the shelved
  angle-audit tool): `user_collections.scan_photo` already persists every
  real scan, but there are only 14 across 13 generations (out of 813), max
  2 for any single generation, 0 with the >=3 that would plausibly help.
  Not remotely enough yet — expected for a project without a real user base
  so far. The mechanism already works; revisit this exact script once real
  usage grows. Not actionable today.
- ~~Revisit `MIN_CONFIDENCE` (currently 0.04) now that the classifier's been
  retrained on the expanded dataset~~ — done (2026-08-23): extended
  `evaluate.py` with a permanent, finer-grained sweep specifically for this
  threshold (the existing 0.10-0.50 sweep calibrates the confirm-UX's
  separate `LOW_CONFIDENCE_FLOOR`, not this one). Result: 0.04 was
  completely inert on the 921-class held-out set — 0.0% wrong caught, 0.0%
  right flagged, it never fired on real data at all. Raised to 0.09 (best
  cost/benefit in the sweep): catches 10.2% of wrong top-1s as "unknown"
  instead of confidently wrong, at the cost of 1.2% of correct top-1s also
  becoming "unknown" (no picker fallback at this floor, unlike the
  confirm-UX's). Doesn't move the raw top-1 accuracy number itself (wrong
  -> unknown still isn't correct by that metric) — the win is fewer
  silently-confident wrong answers, an orthogonal quality axis.
- No mechanism to retrain periodically as real user scans accumulate — the
  reference set only grows when someone manually re-runs the fetch scripts.
- ~~Adding a new car required a full embedding cache rebuild (~35hrs
  locally, only practical via a Colab GPU round-trip) even for one new
  generation's ~8 photos~~ — done (2026-08-21): `_build_index()`
  (model_loader.py) now reconciles the cache incrementally instead of
  trusting it wholesale or recomputing everything — diffs the current
  reference set against the cache's `source_ids` (matched by **filename**,
  not full path, since a Colab-built cache stores `/content/...` paths that
  never match local ones), embeds only new/changed source images, and drops
  stale rows for images no longer in the set. `fetch_generation_images.py`/
  `fetch_low_count.py`/`fetch_all_images.py`/`fetch_maserati_images.py` no
  longer delete the cache after fetching — the incremental path picks up
  the change on next restart automatically. Live-tested end to end (all
  three paths: drop-stale, add-new, and the unchanged fast path), including
  catching and fixing a real bug the first test run surfaced (full-path
  comparison treated the entire 62,694-embedding Colab-built cache as
  stale, which would have silently triggered exactly the ~35hr recompute
  this was meant to eliminate — caught by testing live rather than trusting
  the code review). New car workflow is now: edit
  catalogue-service/seed/generate.js → fetch photos → restart ai-service
  (seconds, local) → retrain classifier (~1-2 min). Colab is now only
  needed for occasional full-quality rebuilds, not per car.
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
- ~~Angle-filtering for Estate reference photos~~ — tried two approaches,
  both documented, second one measured and reverted (2026-08-21/22):
  1. Zero-shot CLIP (base model, 4 angle-prompt classes) — shelved, tool
     itself was broken. It classified a known dead-on-front example as
     "three_quarter" (good), and confidence scores across the whole
     320-image Estate run clustered in a noise-level 0.17-0.24 range.
     Zero-shot CLIP doesn't cleanly discriminate photographic angle the way
     it discriminates car identity, at least not with these prompts.
     (`audit_reference_angles.py`, left uncommitted deliberately.)
  2. YOLO bounding-box aspect ratio (width/height) as a geometric proxy
     instead — no CLIP, no semantic ambiguity. This one *passed* its sanity
     check: the known dead-on-front example scored 1.26 (bottom ~8% of
     Estate's real distribution), the known good three-quarter example
     scored 1.83 (median). Same pattern held across SUV (14.9% flagged),
     Crossover (15.3%), MPV (17.3%) at the same threshold (`audit_reference_
     aspect_ratio.py`, kept — this one's a real, working tool, committed).
     Piloted on Estate alone before scaling: excluded the 34 flagged images
     (30 genuinely new, 5 already excluded from the earlier crop-cleanup)
     via `no_car_images.txt`, re-embedded incrementally, retrained, ran the
     real held-out eval. Result: Estate accuracy went 50.0% -> 45.5%
     (n=22 — roughly 1 image's worth of noise, not a real regression, but
     certainly not the hoped-for improvement either). Overall catalogue
     numbers similarly flat (64.2% vs 64.5% top-1). **Reverted** — restored
     the pre-pilot embeddings cache, classifier, held-out set, and
     no_car_images.txt from backups, confirmed byte-for-byte back to
     baseline (62,784 embeddings, 715 exclusions) before committing anything.
     Third negative/flat result on a "clean the reference data" hypothesis
     this session (after crop-cleanup and the CLIP tool) — the working
     aspect-ratio *tool* is a real, reusable asset, but exclusion-based
     angle-filtering itself doesn't appear to help generation-level
     discrimination. Not extended to SUV/Crossover/MPV given the pilot's
     purpose was exactly to avoid that 4x-larger commitment on an unproven
     idea. Reference-photo angle quality remains a real, visually-confirmed
     issue, just not one exclusion alone fixes — re-fetching replacements
     (not just excluding) is the one variant still untried if revisited.

## Catalogue coverage

- ~~Catalogue was frozen at whatever snapshot the original 813 generations
  covered — no process existed to catch newer real-world releases~~ — done
  (2026-08-22/23), two-pass expansion:
  1. Memory-researched pass across all 54 manufacturers (7 batches, manual
     automotive-knowledge review) found 48 genuine 2020+ gaps — added to
     `generate.js`, engine data populated via the Claude API, reference
     photos fetched (avg ~24/car), embeddings rebuilt incrementally,
     classifier retrained. Held-out top-1 held steady (64.2% -> 63.8%,
     well within noise for +48 classes).
  2. Live web-search verification pass (4 parallel research agents, real
     WebSearch not memory) against the now-861-generation catalogue found
     74 further gaps the memory-based pass missed or that launched too
     recently to be known — mostly genuine 2025/2026 releases. After
     filtering out not-yet-shipping announcements (kept ultra-limited
     specials like the Bentley Bacalar/Batur per explicit instruction), 60
     were added the same way. Held-out top-1: 63.8% -> 63.8% (flat, zero
     measurable regression from doubling the recent-model coverage).
  Catalogue now: 813 -> 921 generations, 615 models, 54 manufacturers,
  verified via real web research rather than trusting a point-in-time
  memory snapshot. Two known-thin entries flagged for a future top-up:
  Genesis GV80 Coupe (7 reference photos) and GV90 (12) — both below the
  old 20-image baseline, everything else landed high-teens to low-30s.
  Real bug caught mid-pipeline: the reference-image fetch script was being
  run with the system Python (missing ultralytics/YOLO), which silently
  deleted every downloaded image because the outlier filter's "no vehicle
  detected" fallback fires identically whether YOLO is genuinely absent or
  a real detection failure — fixed by using the ai-service venv; also
  added a Commons-rate-limit circuit breaker (a tight burst of per-
  generation category/query calls triggered a real 429 mid-run).
- Splitting high-performance trims into separate catalogue entries (e.g.
  base Mustang vs. GT500) was explicitly deferred as "post-production" —
  still on the table. (Moved here from Features/gameplay — same theme.)

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
  on every push/PR to master, confirmed green on the actual runners.
- ~~CI doesn't run smoke-test.ps1 — only unit tests, so a real integration
  break (gateway routing, JWT flow, the full recognize→collect→leaderboard
  path) could still go green~~ — done (2026-09-13): new `smoke-test` job in
  `.github/workflows/test.yml`, gated on the existing unit-test jobs passing
  first (`needs: [test, ai-service]`). Spins up a real Postgres service
  container, starts all 5 backend services with a throwaway shared
  JWT/internal secret and localhost upstream URLs (the gateway's own code
  still defaults to Docker-style hostnames like `http://auth-service:3001`,
  so CI — like any Docker-free deployment — has to override them), waits on
  each `/health` endpoint, then runs the existing `scripts/smoke-test.ps1`
  via `pwsh` (preinstalled on GitHub's Ubuntu runners). ai-service runs with
  real YOLO+CLIP inference, not a mock — turned out the only genuinely
  required model file (`classifier.pkl`) is already checked into git, so no
  Google-Drive-hosted files are needed to exercise the real `/predict` path;
  CLIP/YOLO base weights download from HuggingFace/Ultralytics on first run
  and are cached (`actions/cache`) afterward. Service logs upload as a build
  artifact on any failure. Live-verified by dry-running the exact same
  script and env-var scheme locally end to end (all 6 services, real
  Postgres) before trusting it in CI — caught and fixed a real false-start
  along the way: a leftover process from earlier manual testing was still
  squatting on auth-service's port with a stale secret, which produced a 401
  that had nothing to do with the new workflow logic once traced down.
- The new smoke-test job's first several real runs on GitHub's own runners
  still failed even after the above, in ways the local dry-run above never
  hit (it has real reference images on disk; CI never will). Chased down
  with `gh` CLI (installed and authenticated mid-session specifically to
  read the actual failure logs — GitHub blocks the logs/artifacts API
  without a token, and every unauthenticated workaround tried first came up
  empty or gave a stale/wrong answer). Two real, distinct bugs found this
  way, both fixed (2026-09-13):
  1. **CI's ai-service unit-test job failed on every run since it was
     added** — `ultralytics` pulls in `opencv-python` (not `-headless`),
     which needs `libGL.so.1` at import time; present on a desktop OS but
     not on GitHub's bare Ubuntu runner, so `pytest` failed at import before
     a single test ran. Fixed with `apt-get install libgl1 libglib2.0-0` in
     both CI jobs that import ai-service code.
  2. **ai-service's own `/health` endpoint was wrong**, not just uncovered
     by tests: it only reported "ok" when the FAISS reference index was
     loaded, but `model_loader.py`'s own `predict()` prefers the classifier
     and doesn't need that index at all when one is present (see the AI
     pipeline section above). CI (and any production deploy that reasonably
     skips shipping the 3.3GB reference-images folder, same as CI) would
     have a fully working `/recognize` behind a `/health` that reports
     perpetually degraded — not a CI-only fake, a real latent bug in
     `ai-service/src/routes.py`'s `health()`. Fixed to report healthy when
     *either* the classifier or the FAISS index is available, matching
     `predict()`'s own preference order; only reports 503 when truly neither
     is loaded. Verified the corrected logic against all four
     classifier/index combinations in isolation before trusting it, since
     reproducing the exact "no reference images" condition locally would
     have meant moving real model files out of the way.

## Features / gameplay

- ~~Circuit mode has exactly one track (Silverstone)~~ — done (2026-08-21):
  added Hockenheimring as a real second track, proving out actual
  multi-track support rather than just swapping data. Hockenheimring's
  track outline was extracted directly from the official Wikimedia Commons
  SVG diagram's vector path (not a raster trace like Silverstone — the
  source was already vector, sampled at 90 uniform-arc-length points,
  verified pixel-for-pixel against the source before use). Corner segment
  lengths use the real vector arc-length proportions (more precise than
  Silverstone's evenly-split approximation). Backend `CIRCUIT_TRACKS`
  registry in performanceEngine.js holds real per-track straights/corner-sum
  constants (Hockenheimring's hand-derived the same way Silverstone's were —
  an automated curvature-based approach was tried first and abandoned, it
  produced implausible straight/corner splits on this hand-drawn diagram).
  `race_challenges` gets a `track` column (defaults to `silverstone`, safe
  for existing rows) so race history always shows the track it was actually
  raced on. Track selector appears in the challenge form for Circuit
  distance. 5 new backend tests. Live-tested: track selector appears,
  animation renders the chosen track, lap-progress shows correct corner
  names for each.
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

## Frontend UX

- ~~Nothing tells existing users *why* their collection's rarity
  distribution changed~~ — done (2026-08-21): dismissible info banner above
  "Your Collection" on the Profile page explaining rarity is now
  power-to-weight-based, not badge prestige. No per-item historical diffing
  (rarity history isn't stored anywhere, would need a schema change) —
  a general one-time explainer instead. Dismissal persists via
  `localStorage` (first use of it in this codebase). Live-tested: appears,
  dismisses, and stays dismissed across a refresh.
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

- ~~No dependency-vulnerability or CORS/rate-limit review had been done~~ —
  done (2026-08-23), grounded in a real code-audit agent's findings (not
  generic advice): bumped `http-proxy-middleware` 3.0.5 -> 3.0.7, fixing
  two real CVEs (CRLF injection into proxied multipart bodies, a
  host-header routing bypass) — the only High/Critical finding across
  every service's `npm audit --production`. Locked CORS down on all 5 Node
  services from wide-open `cors()` to a configurable `CORS_ORIGIN`
  allowlist (defaults to `localhost:5173`). Gave `/recognize` its own
  tighter rate limit (`AI_RATE_LIMIT_MAX`, default 30/15min) instead of
  sharing the generic 300/15min ceiling despite triggering real YOLO+CLIP
  inference per request. Hardened ai-service's multipart upload to read in
  1MB chunks and reject oversized bodies before fully buffering them into
  memory, and capped the base64 JSON endpoint's field length via Pydantic
  so an oversized payload is rejected before it's even decoded. Confirmed
  solid, no change needed: SQL is fully parameterized everywhere, passwords
  use bcrypt correctly, JWT verification fails closed if the secret is
  missing, and no real `.env` files are committed to git. All 4 Node
  services' existing test suites (105 tests total) still pass. Left alone:
  the remaining moderate `qs`/`body-parser` findings are pulled in
  transitively by Express itself — fixing those needs a breaking Express
  major-version bump, not attempted without dedicated testing.
- ~~`INTERNAL_SERVICE_SECRET`/`JWT_SECRET` have no rotation story~~ — done
  (2026-09-13): each now accepts an optional `_PREVIOUS` value alongside the
  current one during verification only (`INTERNAL_SERVICE_SECRET_PREVIOUS` in
  auth/collection/gamification-service's `internalSecret.middleware.js` and
  ai-service's `_require_internal_secret`; `JWT_SECRET_PREVIOUS` in the
  gateway's and auth-service's own JWT verify, via a shared
  `verifyWithRotation` helper). Signing/sending always uses the current
  secret only — a receiver accepts either value, so a new secret can roll out
  to every service one at a time instead of needing a perfectly synchronized
  simultaneous restart; drop `_PREVIOUS` in a final deploy once everything's
  confirmed on the new value. Documented in every affected `.env.example`.
  Covered by new unit tests in all 5 affected services (gateway, auth,
  collection, gamification, ai-service — including a first-ever test file
  for auth-service's `jwt.js` and its internal-secret middleware, neither of
  which had coverage before) and live-verified end-to-end against the
  running stack with a rotated secret pair.
- ~~Rate limiting is IP-based only — no additional per-user limiting on
  authenticated routes~~ — done (2026-09-13): added a second limiter keyed
  by the authenticated user's id (`gateway/src/rateLimit.js`'s
  `userKeyGenerator`/`createUserRateLimiter`), applied after `requireAuth`
  on `/collection`, `/gamification`, and `/recognize` (its own tighter
  `aiUserLimiter`, reusing `AI_RATE_LIMIT_MAX`) — on top of the existing
  IP-based one, not instead of it, so a request must pass both. Closes two
  real gaps the IP-only version left: a single user rotating IPs could
  otherwise dodge their limit entirely, and several legitimate users behind
  one shared IP/NAT would otherwise share one bucket regardless of who's
  actually making the requests. Verified live against the real running
  stack, not just unit tests: registered two real users, confirmed each
  gets an independent `RateLimit-Remaining` count that decrements per
  request (999 -> 995 for user 1 across 4 requests) while a second user's
  first request starts fresh at 999 rather than continuing user 1's count.
