# Street Scout — Future Improvements

A running list of possible next steps, compiled after the AI pipeline overhaul,
rarity redesign, circuit race mode, and the two-pass backend security/quality
audit (2026-08-17).

## AI / Recognition pipeline

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
- No mechanism to retrain periodically as real user scans accumulate — the
  reference set only grows when someone manually re-runs the fetch scripts.

## Catalogue coverage

- ~~Catalogue was missing most of the current US-market lineup for brands
  already covered~~ — done (2026-09-14/15), first batch of a broader
  "enlarge the data pool" push: research agents found ~450-650 possible
  additions across four dimensions (new manufacturers entirely — Chinese
  EV brands are the single biggest gap at ~100 models; missing models for
  brands already in the catalogue, ~130-140; older/classic generations,
  extrapolated 150-250+; JDM/regional-only models, ~35-45). Started with
  the highest-ROI slice: missing US-market models for the 6 brands with
  the clearest gaps (Toyota, Honda, Nissan, Chevrolet, Ford, Jeep/Dodge/
  Chrysler/RAM) — 59 new models, 117 new generations (813→~921→1038
  total), engines populated via Claude API, 3,013 new reference photos
  fetched from Wikimedia/DDG (avg ~26/generation), embeddings rebuilt
  (94,548 total), classifier retrained. Held-out eval: top-1 63.8%→62.9%
  (-0.9pp, proportional to +12.7% more classes — consistent with earlier
  smaller expansions' noise), top-5 actually improved 84.6%→85.7%,
  confirm-UX protection held at ~74%. Live-tested end to end: a real
  Corvette C6 photo through the actual `/predict` API correctly
  identified it at 85.8% confidence with sensible runner-up candidates.
  Found and fixed a real latent bug along the way: `generate.js` rebuilt
  `data.json` from scratch on every run with no `engines` field at all,
  silently wiping every previously-populated engine out of the file —
  caught immediately after regenerating for this batch (`generations
  with engines: 0/1038`), recovered from a pre-run backup by re-matching
  on content (manufacturer|model|generationCode, since ids aren't stable
  across a mid-file insertion), then fixed `generate.js` itself to
  auto-preserve existing engines by that same content key on every future
  run — verified by re-running it and confirming engines survived with no
  manual intervention. Remaining ~390-590 possible additions (more
  manufacturers, more models, older generations, JDM models) are scoped
  but not started — a decision for whenever this gets picked up again,
  not a queued task.
- Splitting high-performance trims into separate catalogue entries (e.g.
  base Mustang vs. GT500) was explicitly deferred as "post-production" —
  still on the table. Concretely confirmed why this matters (2026-09-13):
  the real Shelby GT500 has exactly one engine (5.2L supercharged V8,
  760hp), but that engine currently lives in the base Mustang S550/S650's
  shared engine pool, so a plain Mustang scan has a real chance of
  surfacing GT500-spec numbers. Decided not to fix now — trimming the
  outlier now vs. properly splitting GT500 into its own entry later are
  both viable, and it's a small, easily-revisited data issue either way.