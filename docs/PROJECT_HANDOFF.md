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
- Feature merge baseline after #29: `466d50eb6fbaf3db5aa0008d647df4f0b10e0001`.
- GitHub Pages deployment succeeded.
- iPhone post-deploy Human Feel passed without a blocking interaction failure.

Sauce rendering remains a follow-up polish/calibration concern, not a blocker for shadow scoring.

## Current priority — Phase 4A-2 Scoring 2.0 Shadow

Issue #30 is the execution issue. The Fresh Audit has been completed against exact main SHA `a80698487bd4f56585a9a1572e0025d726631716` with verdict **B — READY WITH MINOR DESIGN CHANGES**.

Key implementation contracts from the audit:

- Existing 16×16 sauce metrics, tolerant distance scoring and permutation-invariant piece matching should be reused rather than rewritten.
- Margherita is currently the primary authoritative Reference calibration recipe. Recipes without a real Reference fixture must return explicit unavailable/null rather than fabricated targets.
- Shadow scoring must be computed from the canonical pizza at `CONFIRM_BAKE`, including FREE and Lunch Rush; it must not depend on UI-only live-preview gating.
- Scoring outputs must be deterministic, finite and fail-closed. Invalid tolerance bands must not leak NaN/Infinity.
- Verify `PAINT_TEMPORARY` is represented in canonical scoreable sauce data with regression tests.
- Phase 4A-2 remains shadow-only: legacy score, stars, Dex BEST, rewards, progression and save-v1 semantics remain authoritative.

Long-term Scoring 2.0 architecture should remain compatible with four categories: Recipe / Sauce / Pieces / Bake. Margherita-specific calibration component weights are not automatically the permanent global formula.

## Ordered roadmap

### Milestone 1 — Making Game

- [x] Phase 1 — core vertical slice
- [x] Phase 2 — starter content / making polish
- [x] Phase 3A — Sauce Painting
- [x] Phase 3B — starter recipes / Dex / character replay polish
- [x] Phase 3C — scoring/persistence/progression/Lunch Rush/Pitz/Shop
- [x] Phase 4A-1A — Reference Sauce Quantity Prototype
- [x] HOME/GAME separation + App Icon/PWA
- [x] Phase 4A-1B — Cheese & Topping Physical Interaction
- [x] Phase 4A-1B.1/1B.2 — First-Fun + Recipe Sauce Interaction Parity
- [x] iPhone post-deploy Human Feel smoke check
- [x] Phase 4A-2 Fresh Audit
- [ ] Phase 4A-2 Scoring 2.0 Shadow Core — next implementation task
- [ ] Phase 4A-2 Codex independent review
- [ ] Phase 4A-2 Preview + iPhone calibration using deliberately good/normal/poor pizzas
- [ ] Save v2 Migration — safe v1→v2 migration before new persistent semantics
- [ ] Phase 4A-3 — integrate calibrated Scoring 2.0 into authoritative RESULT/stars/Dex BEST/progression
- [ ] Score-based Baked Visual Polish — render-only post-score baked appearance; never feed visual correction back into scoring
- [ ] Sauce Polish — texture, edge response and visual quality after scoring behavior is stable

### Milestone 2 — Pizza Shop / Economy

- [ ] Inventory Foundation — separate consumable stock from permanent ingredient ownership
- [ ] Restock / Shop inventory flow
- [ ] Atomic material consumption at the reviewed bake/confirmation boundary
- [ ] Revenue / ingredient cost / profit foundation
- [ ] Lunch Rush economy integration
- [ ] Dough inventory/consumption after Save v2; Practice remains non-consuming

### Milestone 3 — Replayability

- [ ] Phase 4B — Difficulty / Hint Policy: Practice, Normal, Challenge, Lunch Rush
- [ ] Time Attack — quality-gated count-up challenge, initially small recipe scope
- [ ] Recipe expansion toward 20
- [ ] Pizza Dex expansion — undiscovered → discovered → BEST → MASTER

### Milestone 4 — Content Foundation / Long-term Progression

- [ ] Phase 4C — Content Catalog for safe recipe/ingredient scaling
- [ ] Phase 4D — Recipe / Ingredient Editor + JSON import/export + preview/test-play
- [ ] Recipe expansion 20 → 30
- [ ] Phase 4E — Progression 2.0 / post-Dex-completion motivation
- [ ] Recover/normalize the PIZZA DB-derived larger catalog only from verified source data; do not treat prior 160/181 audit counts as repository truth without source recovery

### Milestone 5 — Character / Final Polish

- [ ] Character Experience — richer Teto/Mito/Blue reactions during making and results
- [ ] Final visual / animation / sound polish
- [ ] Advanced mechanics only after the core making, scoring, economy and replay loops are stable

## Parallel / non-blocking work

- [ ] Issue #27 — accessibility live-region re-announcement for consecutive same-ingredient physical drops. Non-blocking for normal touch gameplay and Phase 4A-2.
- [ ] SSOT documentation cleanup — reconcile stale legacy scoring/UI documents with current code truth.
- [ ] PIZZA DB source recovery / catalog normalization as a separate research/data line; do not block the current Making Game milestone.

## Data/design constraints

Interaction should scale through reusable families such as SPREAD / HOLD_SCATTER / TAP_PLACE / SPRINKLE / DRIZZLE / SPECIAL rather than unique mechanics per ingredient.

Do not present prototype quantity as canonical grams/ml without reliable source-backed data. Use normalized internal quantity.

Reference ingredient, player ingredient and scoring ingredient should represent the same underlying ingredient semantics; baked/result visual transformation is render-only.

## Non-negotiable guards

- Do not break `ORDER → PREPARE → BAKE → RESULT → DISCOVERED`.
- Preserve save compatibility unless a separately reviewed migration is intentionally introduced.
- Scoring 2.0 stays shadow-only until independent review and iPhone calibration pass.
- Do not silently change Dex BEST, stars, totalStars, Mission, Pitz, Shop or progression during Phase 4A-2.
- Do not fabricate Reference targets for recipes that do not have authoritative fixtures.
- Smartphone vertical remains the primary UX target.
- Fresh repository state and tests outrank stale handoff text.

## Preferred workflow

`Codex design/audit → Claude Code implementation → Codex independent review → Claude Code fixes → user iPhone Human Feel/calibration`

Claude Code is the primary implementation agent. Keep implementation tasks around 2–3 hours where practical. Result reports belong under `docs/reports/`.

## New-session startup checklist

1. Inspect fresh GitHub `main`, open PRs, issues and Actions state.
2. Read this file, Issue #22 and the current execution issue.
3. Treat fresh GitHub state as authoritative if anything conflicts.
4. Read the latest phase audit/result report before implementation.
5. Keep Phase 4A-2 shadow-only until independent review and iPhone calibration pass.
6. Whenever priority, completion status, estimates, architecture or direction changes, update both Issue #22 and this file.
