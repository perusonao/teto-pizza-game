# Teto Pizza Game — Project Handoff / Roadmap SSOT

Last updated: 2026-09-15
Baseline main SHA: `45362e210a3e99ecc949706e9d007bf42e558881`
Repository: `perusonao/teto-pizza-game`
Public demo: GitHub Pages (`https://perusonao.github.io/teto-pizza-game/`)

> This document is the entry point for a new development session. Fresh GitHub/main state always wins over historical notes. Update this document whenever phase status, priorities, architecture, or the roadmap materially changes.

## 1. Product vision

A smartphone-first pizza-making game inspired by the pizza knowledge/classification UX of PIZZA DB. The central experience is not simply choosing correct ingredients: **the player sees an ordered pizza/reference and physically recreates it; the closer and more skillfully it is made, the higher the score.**

Core loop:

`ORDER → PREPARE → BAKE → RESULT → DISCOVERED`

Long-term play loop:

`make pizza → quality stars → unlock stock → Lunch Rush → earn Pitz → buy ingredient → unlock new pizza → Dex / mastery → replay`

First-Fun goal: one pizza should already be fun to make. Do not prioritize recipe count over making depth.

## 2. Characters

- Teto: protagonist / pizza maker; black Pomeranian-like dog, apron and burgundy bow tie.
- Mito: order, tutorial and hints; white Pomeranian-like dog.
- Blue: tasting/evaluation character; Siberian Husky with blue bandana.

Canonical in-repo character assets:

- `src/assets/characters/teto.webp`
- `src/assets/characters/mito.webp`
- `src/assets/characters/blue.webp`

Use original assets rather than AI-regenerating these characters.

## 3. Technical architecture

- Vite + React + TypeScript SPA
- `useReducer` state machine
- no backend
- localStorage persistence
- smartphone vertical UI, primary verification size 390×844
- GitHub Pages deployment

Existing authoritative progression save is schema v1. Do not change persistence semantics casually.

## 4. Current implemented game

### Phase 1 — core vertical slice — COMPLETE

Implemented ORDER/PREPARE/BAKE/RESULT/DISCOVERED, ingredient placement, bake gauge, scoring, character assets and recipe Dex.

### Phase 2 — content and making polish — COMPLETE

Expanded Starter recipes and improved sauce/topping/bake feedback. First-Fun review exposed that content alone was not enough; making depth remained the main opportunity.

### Phase 3A — Sauce Painting — COMPLETE

Introduced pointer-based sauce painting. Pointer capture, coordinate conversion, coalesced events and BAKE abort handling became reusable foundations.

### Phase 3B — recipe/Dex expansion — COMPLETE

Starter content reached six recipes and Dex progression. Character/replay polish followed.

### Phase 3C — mastery/progression — COMPLETE

Implemented:

- 100-point legacy scoring with ★1–5
- Dex BEST and timesMade
- localStorage persistence
- totalStars-derived availability
- Lunch Rush mission
- Pitz economy and Shop
- first purchased ingredient/progression unlock

Current first progression unlock on main:

- ingredient: onion / たまねぎ
- unlock: `totalStars >= 12`
- price: 120 Pitz
- unlocked recipe: Fugazza

Progression loop is functional through Dex 7/7.

Phase 3C Final review verdict: complete with minor polish recommended. Major remaining weakness is post-completion replay motivation.

## 5. PIZZA DB catalog research

Audits identified approximately:

- 160 canonical pizzas
- 181 unique ingredients
- broad ingredient categories including sauce, cheese, meat, seafood, vegetables, mushrooms, herbs, fruit, egg, nuts and other
- interaction-family candidates: SPREAD, HOLD_SCATTER, TAP_PLACE, SPRINKLE, DRIZZLE, SPECIAL, NON_INTERACTIVE

Important constraint: source data contains **no canonical quantity evidence for the 181 ingredients**. Do not invent grams/ml and label them as PIZZA DB facts. Prototype quantity must use normalized internal game units until reliable source-backed quantities exist.

The catalog is a future content source, not a mandate to auto-import all recipes. Separate source facts from game-design proposals.

## 6. Phase 4 product direction

Phase 4 is centered on **Reference Pizza + Quantity + Scoring 2.0**.

Desired experience:

1. see the ordered/reference pizza
2. dispense/spread sauce by hand
3. place cheese/toppings with quantity and position awareness
4. bake
5. compare with reference
6. receive tolerant, continuous scoring

Do not require pixel-perfect copying. Identical pieces must be matched permutation-invariantly rather than by placement order.

Difficulty should primarily change information visibility:

- Practice: reference visible + guidance
- Normal: reference can be checked, no placement guide
- Challenge: reference shown before making, then hidden
- Lunch Rush: reproduce under time pressure

## 7. Phase 4A-0 design/audit — COMPLETE LOCALLY, REPOSITORY DOCS PENDING

Design decisions:

- normalized quantity `0.0–1.0`
- tomato sauce: hold-to-dispense + move-to-spread
- sauce evaluation separates quantity / coverage / distribution / overflow
- proposed 16×16 density field
- mozzarella: TAP_PLACE for Margherita; future shredded forms may use HOLD_SCATTER
- basil: TAP_PLACE
- identical-piece reference matching: maximum-weight bipartite/Hungarian style matching
- Phase 4A prototype reference score remains shadow-only; legacy score stays authoritative

The original local documents were reported as:

- `docs/design/PIZZA_GAME_Phase4A_Reference-Quantity-Scoring2_Design.md`
- `docs/reports/PIZZA_GAME_Phase4A_PreImplementation_Audit.md`

They were not committed to main. Preserve them in a docs-only PR before Phase 4A-1B if available locally.

## 8. PR #21 — Phase 4A-1A Reference Sauce Quantity Prototype — OPEN / DO NOT MERGE YET

PR #21 was created from main baseline `45362e2…`.
Initial reviewed HEAD: `1f122797bef281eda20424366e3423a5c92435e4`.

Initial implementation added:

- normalized elapsed-time sauce quantity
- 16×16 sauce density field
- quantity / coverage / evenness / overflow prototype metrics
- compact Margherita reference UI
- FREE Margherita shadow/reference calculation only
- legacy scoring/Dex/Mission/Pitz/Shop/save unchanged

Initial implementation reported 305/305 tests and clean lint/typecheck/build.

### Independent Codex Broad Review of PR #21

Verdict: **C. NEEDS FIX BEFORE USER TEST**

Findings: P0=0 / P1=2 / P2=8 / P3=2.

Critical P1s:

1. Ingredient can change during a dispense gesture; move/up branches depend on current props rather than the gesture-start snapshot, allowing orphan RAF loops and deposits after release/BAKE.
2. `DEPOSIT_SAUCE` reducer boundary accepts stale/out-of-scope deposits; it needs canonical phase/recipe/mode/finite guards so late prototype actions cannot affect authoritative scoring.

Human-feel-relevant P2s include:

- background/frame-stall bulk deposit
- spatial field results still frame-cadence dependent
- discontinuous rim overflow
- current reference quantity/coverage target mathematically unreachable together
- canceled strokes remain committed
- visual full-surface sauce layer can contradict measured coverage
- incomplete mobile termination fallbacks
- tests do not pin several lifecycle failures

P3 includes finite-value validation and future Reference model extensibility.

**Do not run iPhone Human Feel Gate until the P1s and the human-feel-relevant P2s are fixed and independently re-reviewed.**

## 9. Immediate execution plan

### Priority 1 — Fix PR #21

Owner recommendation: Claude Code.

Required correction areas:

- gesture-session snapshot/token; abort on ingredient/reference/BAKE/unmount changes
- reducer canonical scope guards and finite validation
- hidden/blur/frame-stall cancellation/clamp
- timestamped path sampling and fixed-tick spatial interpolation
- continuous kernel/mask overflow accounting
- reachable reference target derived from a canonical prototype fixture
- buffer active stroke and commit on pointerup; discard on cancel/lost capture/unmount
- field-derived visual truth rather than misleading full-surface fill
- mobile fallback termination and long-press safety
- tests for the exact Broad Review failure scenarios

Push fixes to the existing PR #21 branch. Do not create a replacement PR and do not merge directly.

### Priority 2 — Codex re-review PR #21

Required gate before user testing:

- P0 = 0
- P1 = 0
- no remaining P2 that makes Human Feel results invalid or unsafe
- tests/lint/typecheck/build clean
- 390×844 lifecycle verification clean

### Priority 3 — iPhone Human Feel Gate

After technical re-review passes, manually test:

- short dab
- appropriate/even spread
- concentrated over-dispense
- wide/thin spread
- rim/overflow

Main question: **is hold + drag materially more enjoyable and understandable than the old sauce interaction?**

Tune flow rate, field/rendering and reference targets from human feel before merge.

### Priority 4 — Merge Phase 4A-1A

Only after technical + Human Feel gates pass.

### Priority 5 — Phase 4A-1B

Add Margherita mozzarella and basil reference placement plus permutation-invariant matching. Reconcile the Reference data/state contract before introducing Hungarian matching.

### Priority 6 — Phase 4A-2 Scoring 2.0 Prototype

Build a tolerant continuous reference score. Proposed categories are ingredient correctness, quantity, placement/distribution, sauce quality and bake, but weights remain prototype values until calibrated.

Keep the new score shadow-only until it is validated against real play.

### Priority 7 — Phase 4A-3 authoritative Scoring 2.0 integration

Only after Human Feel and scoring calibration. Then migrate Dex BEST/stars/Mission/progression carefully.

### Priority 8 — Phase 4B Difficulty / Hint Policy

Practice / Normal / Challenge / Lunch Rush information policies.

### Priority 9 — Phase 4C Content Catalog

Normalize recipe/ingredient content so 10→20→30 recipes can scale safely. Keep PIZZA DB source facts separate from game fields.

### Priority 10 — Phase 4D Recipe / Ingredient Editor

Dev-facing editor, JSON import/export and preview/test-play. Do not introduce backend infrastructure until there is a real need.

### Priority 11 — Phase 4E Progression 2.0

Improve motivation after Dex completion and create further mastery/unlock goals.

### Later

- recipe expansion to 10, then 20, then 30
- advanced mechanics: post-bake toppings, folding/stuffing, deep-dish/layering, special dough/shape, frying, sectional placement, cut presentation
- final character/visual/sound polish

## 10. Development workflow

Recommended division of labor:

`Codex design/audit → Claude Code implementation → Codex independent review → Claude Code fixes → user iPhone feel test`

Use Claude Code for implementation-heavy React/TypeScript/browser iteration. Use Codex for cross-cutting design audits and independent broad review.

For estimates, use approximate **Claude Code/Codex processing time**, not human engineer-days. Keep tasks small enough to complete in one focused coding session where practical.

## 11. Non-negotiable guards

Until explicitly changed by an approved phase:

- do not break legacy authoritative scoring
- do not silently change Dex BEST semantics
- do not change ★1–5 / totalStars progression semantics
- do not alter Mission/Pitz/Shop/save v1 while Phase 4A is shadow-testing
- do not claim normalized prototype quantities are real recipe grams/ml
- do not expand all 181 ingredients before the core making interaction is fun
- do not merge PR #21 before technical re-review and Human Feel Gate

## 12. Session startup checklist

A new session should:

1. read this document first
2. fresh-fetch GitHub main and open PRs/issues
3. treat current GitHub state as authoritative if it differs from this document
4. inspect PR #21 before doing Phase 4 work
5. update this document and the roadmap issue whenever status/priority materially changes

This file is the project handoff entry point; detailed design/report documents remain authoritative for their specific phases.