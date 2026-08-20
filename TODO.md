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
- gamification-service directly `JOIN`s auth-service's `users` table across
  a service boundary. Now that the internal-secret infrastructure exists
  (from the security fixes), exposing a proper "usernames by ids" endpoint
  on auth-service is more feasible than when this was first flagged.
- ~~No automated test suite anywhere~~ — started (2026-08-20): Jest unit
  tests for gamification-service (race/points formulas, internal-secret
  middleware) and gateway (JWT auth, proxy identity-header handling), 39
  tests total. Still no coverage for auth-service or collection-service.
- ~~No CI~~ — done (2026-08-20): GitHub Actions runs both test suites on
  every push/PR to master (not yet pushed as of this writing). Doesn't run
  smoke-test.ps1 yet — that needs Postgres + all 5 services up in CI, a
  bigger lift than the unit tests were.

## Features / gameplay

- Circuit mode has exactly one track (Silverstone) — multi-track support was
  the natural next step when it was designed, never built.
- `DELETE /friends/:friendId` exists in the backend but has zero UI surface
  (called out in CLAUDE.md as a known gap).
- Leaderboard is all-time only — no weekly/monthly reset, so early players
  entrench a permanent lead.
- Splitting high-performance trims into separate catalogue entries (e.g.
  base Mustang vs. GT500) was explicitly deferred as "post-production" —
  still on the table.

## Frontend UX

- Nothing tells existing users *why* their collection's rarity distribution
  changed when it flipped from make-based to power-to-weight-based — a
  returning user could be confused their "legendary" Ferrari is now "epic."
- The circuit track view shows a marker moving along Silverstone but no
  lap-progress indicator (% complete, corner names) beyond the dot itself.
- No user-facing messaging for the censoring-fails-closed behavior — if a
  scan gets rejected because censoring crashed, does the UI explain why, or
  does it look like a generic error?

## Security / ops (lower priority)

- `INTERNAL_SERVICE_SECRET`/`JWT_SECRET` have no rotation story — fine for a
  personal project, but worth knowing if this ever goes further.
- Rate limiting is IP-based only — no additional per-user limiting on
  authenticated routes.
