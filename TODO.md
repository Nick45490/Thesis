# Street Scout — Future Improvements

A running list of possible next steps, compiled after the AI pipeline overhaul,
rarity redesign, circuit race mode, and the two-pass backend security/quality
audit (2026-08-17).

## AI / Recognition pipeline

- ~~The LoRA ablation notebook was built but results were never reported
  back~~ — done (2026-08-20): LoRA is a decisive win, +7.6pp top-1 (64.5% vs
  56.9% base CLIP) on the same 812-image held-out set. Keep the adapter.
- Domain-matched training data — the reference set is built from
  catalogue/stock photos, but real scans are phone photos in the wild
  (varied lighting, angles, backgrounds). This gap between training and
  real-world distribution is the single biggest lever left for accuracy.
- Revisit `MIN_CONFIDENCE` (currently 0.04) now that the classifier's been
  retrained on the expanded dataset — trades off false "confident" IDs vs.
  false "unknown"s.
- No mechanism to retrain periodically as real user scans accumulate — the
  reference set only grows when someone manually re-runs the fetch scripts.

## Backend architecture

- catalogue-service reaches directly into ai-service's filesystem for car
  images — fragile if either service moves. Needs a decision: ai-service
  serves them itself, or catalogue-service proxies over HTTP.
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
