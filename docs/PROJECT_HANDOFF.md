# Teto Pizza Game — Project Handoff / Roadmap SSOT

Updated: 2026-09-16

> Fresh GitHub/main state always wins if this document becomes stale.

## Product goal

The game is not merely about selecting the correct recipe ingredients. The target experience is:

> See the ordered/reference pizza, recreate it physically by hand, bake it, and score higher the closer/better it is made.

Core loop: `ORDER → PREPARE → BAKE → RESULT → DISCOVERED`.

Progression loop: `make → stars → stock unlock → Lunch Rush → Pitz → buy ingredient → new pizza → Dex/mastery → replay`.

Primary device: smartphone vertical. Verification baseline: 390×844.

## Current production baseline

Current feature baseline after PR #29:

- PR #21 — Phase 4A-1A Reference Sauce Quantity Prototype: merged.
- PR #25 — HOME/GAME separation + App Icon/PWA: merged.
- PR #26 — Phase 4A-1B Cheese & Topping Physical Interaction: merged.
- PR #28 First-Fun fixes are incorporated through PR #29; do not merge #28 separately.
- PR #29 — Phase 4A-1B.2 Recipe Sauce Interaction Parity: merged.
- PR #29 reviewed head: `19a7957baa4817d1dce9a035bff479bb050aae77`.
- PR #29 blocker fix: `b9ed315b4fbd5afb3198c30a225086e68d8d458a`.
- Merge/main baseline after #29: `466d50eb6fbaf3db5aa0008d647df4f0b10e0001`.
- Exact-head PR CI passed. Focused tests 20/20; full suite 39 files / 518 tests.
- GitHub Pages deployment Run #23 completed successfully.

## Phase 4A-1B Human Feel result

2026-09-16 iPhone Public Demo screen recording was reviewed after deployment.

Observed working end-to-end:

- HOME → pizza making
- sauce painting
- mozzarella / topping placement
- bake → RESULT
- RESULT → HOME
- switching to other recipes
- Margherita reached 99 points / 5 stars during the recording
- Genovese and Funghi recipe transitions were also observed

No Human-Feel-blocking interaction failure was identified in that recording. Phase 4A-1B can therefore move forward as the production interaction baseline.

Visual follow-up remains desirable: sauce can still read as a blurred color field rather than convincing liquid sauce, and some intermediate tomato strokes can show rectangular/white-band artifacts. Treat this as polish/calibration work, not a blocker to the next scoring prototype.

## Remaining known issue

Issue #27 tracks accessibility live-region re-announcement for consecutive same-ingredient physical drops. This does not block normal touch/pointer gameplay or Phase 4A-2, but should be fixed in a focused accessibility follow-up.

## Next priority — Phase 4A-2 Scoring 2.0 shadow prototype

Goal: move from primarily recipe correctness toward rewarding how well the player physically recreates the reference pizza.

Phase 4A-2 must remain shadow-only until calibrated. Do not silently replace authoritative legacy scoring/progression.

Candidate scoring dimensions:

- sauce coverage / quantity
- sauce evenness
- sauce edge/rim control
- topping quantity
- topping placement / distribution
- bake quality

Requirements:

1. Audit the current scoring/reference/state contracts on fresh main before implementation.
2. Define tolerant continuous metrics rather than brittle exact matching.
3. Keep order/permutation invariance where ingredient placement order should not matter.
4. Keep legacy Dex BEST, ★1–5, totalStars, Mission, Pitz, Shop and save v1 authoritative during the shadow phase.
5. Add a preview/debug comparison surface only where appropriate; production should not expose raw prototype metrics unnecessarily.
6. Test representative good/acceptable/bad physical pizzas and edge cases.
7. Run independent review before any authoritative scoring integration.
8. Use iPhone Human Feel/calibration before Phase 4A-3.

## Ordered roadmap

- [x] Phase 1 — core vertical slice
- [x] Phase 2 — Starter content / making polish
- [x] Phase 3A — Sauce Painting
- [x] Phase 3B — Starter recipes / Dex / character replay polish
- [x] Phase 3C — scoring/persistence/progression/Lunch Rush/Pitz/Shop
- [x] Phase 4A-1A — Reference Sauce Quantity Prototype
- [x] HOME/GAME separation + App Icon/PWA
- [x] Phase 4A-1B — Cheese & Topping Physical Interaction
- [x] Phase 4A-1B.1/1B.2 — First-Fun + Recipe Sauce Interaction Parity
- [x] iPhone post-deploy Human Feel smoke check — no blocking interaction failure observed
- [ ] Focused accessibility follow-up — Issue #27
- [ ] Phase 4A-2 — tolerant continuous Scoring 2.0 shadow prototype
- [ ] Independent review + calibration
- [ ] Phase 4A-3 — integrate Scoring 2.0 into authoritative progression only after calibration
- [ ] Phase 4B — Difficulty / Hint Policy: Practice, Normal, Challenge, Lunch Rush
- [ ] Phase 4C — Content Catalog for safe 10→20→30 recipe scaling
- [ ] Phase 4D — Recipe / Ingredient Editor + JSON import/export + preview/test-play
- [ ] Phase 4E — Progression 2.0 / post-Dex-completion motivation
- [ ] Recipe expansion 10 → 20 → 30
- [ ] Advanced mechanics and final character/visual/sound polish

## Data/design constraints

PIZZA DB audit found roughly 160 canonical pizzas and 181 unique ingredients. Interaction should be covered by reusable families such as SPREAD / HOLD_SCATTER / TAP_PLACE / SPRINKLE / DRIZZLE / SPECIAL rather than unique mechanics per ingredient.

Quantity evidence in the audited source data was 0/181. Do not present prototype quantity as canonical grams/ml. Use normalized internal quantity until reliable source-backed data exists.

## Non-negotiable guards

- Do not break the core `ORDER → PREPARE → BAKE → RESULT → DISCOVERED` loop.
- Preserve existing save compatibility unless a separately reviewed migration is intentionally introduced.
- Scoring 2.0 stays shadow-only until calibration is explicitly complete.
- Do not silently change Dex BEST, stars, totalStars, Mission, Pitz, Shop or progression semantics during Phase 4A-2.
- Smartphone vertical remains the primary UX target.
- Fresh repository state and tests outrank stale handoff text.

## Preferred workflow

`Codex design/audit → Claude Code implementation → Codex independent review → Claude Code fixes → user iPhone Human Feel test`

Claude Code is the primary implementation agent. Keep tasks small enough to complete efficiently, generally around 2–3 hours of Claude Code work where practical. Result reports should be written to `docs/reports/` for implementation/review phases.

## New-session startup checklist

1. Inspect fresh GitHub `main`, open PRs, open issues and Actions state.
2. Read this file and Issue #22.
3. Treat fresh GitHub state as authoritative if anything conflicts.
4. Confirm whether Issue #27 is still open.
5. For Phase 4A-2, audit current scoring/reference/state code before proposing implementation changes.
6. Keep Scoring 2.0 shadow-only until independent review and iPhone calibration pass.
