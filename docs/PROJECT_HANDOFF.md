# Teto Pizza Game — Project Handoff / Roadmap SSOT

Updated: 2026-09-17 (Scoring 2.0 Authority Fresh Audit)

> Fresh GitHub/main state always wins if this document becomes stale.

## Product goal

> See the ordered/reference pizza, recreate it physically by hand, bake it, and score higher the closer/better it is made.

Making Game 2.0 target: `DOUGH → SAUCE → CHEESE → TOPPING → BAKE → FINISH → RESULT`.

Core experience principle:

> 操作 → 見た目が変わる → その状態を次工程へ持ち越す → 完成した一枚に個性として残る

Progression target:

`choose pizza → make → improve stars/BEST → unlock/discover → Lunch Rush → earn Pitz → buy ingredients → make new pizza → Dex/mastery → replay`

Primary device: smartphone vertical. Verification baseline: 390×844.

## Current roadmap issues

- Issue #22 — overall development roadmap / session handoff SSOT.
- Issue #32 — Reference / Recipe / Interaction consistency gate before Scoring 2.0 authority. **Complete** — Recipe correctness, Interaction Consistency Fresh Audit, and the sauce-parity/olive-oil-visibility fix (PR #45) have all landed.
- **Issue #47 — Making UX Cleanup (実機レビュー導線・見本・再挑戦・操作性改善). Complete.** Fresh Audit — see `docs/reports/TETO_ISSUE-47_MAKING-UX_Fresh-Audit.md` (audited SHA `6e554918c42fc4d8ed267b715992e5ed5cf68e4f`). Verdict: **B. READY — 3 IMPLEMENTATION SLICES**. Slice A (PR #49, Findings A/B/C/D/E/K) and Slice B (PR #50, Findings F/H) are both **merged**, Human Feel **PASS**. Slice C's own findings: I (sauce repaint vs. one-way flow) confirmed already correct, no code change needed; J (Cheese/Topping drag scope) explicitly handed to **Issue #37 M2** rather than implemented here, per Issue #47's own "don't double-implement" scope guard — this hand-off is not unfinished Issue #47 work, it is Issue #47's own decision.
- **Issue #33 — Dough Shaping. Current active priority**, now that Issue #47's Human Feel PASS gate is satisfied. D0 Fresh Audit done and **revalidated** against `main` SHA `45fdf1a3ceae305f34dd1a8637b1a306f27dbfd5` (post Issue #47 Slice A/B) — see `docs/reports/TETO_ISSUE-33_DOUGH-D0_Fresh-Audit.md`'s appended "Revalidation" section. Revalidation verdict: **B. PR #46 NEEDS MINOR D0 UPDATE — READY AFTER UPDATE** — the original gesture (drag-from-center-outward radial stretch), shape model (8-point radial array), state design (`PizzaState.doughShape`, no Save schema change) and completion threshold (size-only, ≥75% provisional) all remain valid; only two additive `gameReducer.ts` literal-edit clarifications were added (see report §R.4). **D1 implementation may now proceed.**
- Issue #37 — parent roadmap for Making Game 2.0 physical pizza-making flow. Its own M0 gate is satisfied (Issue #32 P1 done); M1 (Dough Shaping, #33) is now active per the above. Issue #47 Slice C's Finding J hand-off remains tracked under this issue's M2 checklist.
- Issue #38 — Scoring 2.0-linked Pitz reward / Economy connection.
- Issue #39 — HOME/FREE navigation redesign + Pizza Select. PS1/PS2/PS3 **complete** (PR #40, PR #41, both merged into `main`); PS4 iPhone Human Feel **PASS**. Remaining HOME visual polish (see "Parallel / non-blocking" below) is tracked as future polish, not an Issue #39 blocker.

Scoring 2.0 Shadow has already been implemented and calibrated. It remains non-authoritative until the remaining consistency/Human Feel gates pass. **Scoring 2.0 Authority Fresh Audit done** — see `docs/reports/TETO_SCORING2_AUTHORITY_Fresh-Audit.md` (audited SHA `2da3949de5bd642c709ca6ba343bc57d8101d03d`). Verdict: **D. BLOCKED BY ANOTHER SYSTEM** — not by Dough (that dependency is explicitly cleared), but by two findings internal to Scoring 2.0 itself: it has **no Bake component at all** (any recipe, always unavailable — legacy's heaviest weight, 30/100), and it has **Reference coverage for exactly 1 of 7 recipes** (Margherita only), so a literal authority cutover today would break RESULT/stars/BEST/Dex/progression for 6 of 7 recipes. The Recipe/Sauce/Pieces invariants, the reducer-boundary cutover design, and every Dex/Mission/progression/save-compatibility question are otherwise confirmed ready — no further coefficient tuning required. Recommended sequence: **B1 (add a Bake similarity component) and B2 (Reference coverage for the remaining 6 recipes), in parallel, both gating A1 (authority adapter at `gameReducer.ts`'s `CONFIRM_BAKE`) → A2 (cutover verification) → A3 (legacy cleanup)**.

### Recent merges

- **PR #40** — HOME navigation + functional Pizza Select. MERGED.
- **PR #41** — HOME + Pizza Select visual reproduction. MERGED. Merge SHA: `1b1ff6c69b837ff7f0da6ab3c14df7843812d8c3`.
- **PR #45** — Issue #32 sauce parity + olive-oil visibility. MERGED.
- **PR #49** — Issue #47 Slice A (Navigation/Retry/HOME, Findings A/B/C/D/E/K). MERGED.
- **PR #50** — Issue #47 Slice B (Reference UX, Findings F/H). MERGED. Current `main` SHA as of this Issue #33 D0 revalidation: `45fdf1a3ceae305f34dd1a8637b1a306f27dbfd5`.

**Next priority: Issue #33 Dough Shaping D1 implementation** (D0 design revalidated and confirmed ready — see `docs/reports/TETO_ISSUE-33_DOUGH-D0_Fresh-Audit.md`'s Revalidation section, verdict B, minor `gameReducer.ts` literal clarifications only).

## Navigation contract

HOME is the hub; do not use a redundant second FREE/Lunch Rush mode picker after 「ピザを作る」.

Target routes:

- `HOME → ピザを作る → Pizza Select → selected recipe → Making Game`
- `HOME → ランチラッシュ → Lunch Rush`
- `HOME → ピザ図鑑 → Pizza Dex`
- `HOME → ショップ → Shop`

### Pizza Select

Purpose: choose **what to make now** in FREE.

Target state semantics:

- completed recipe: name + highest stars/BEST
- unlocked but unplayed: `NEW`
- locked: `？？？` + lock

Example visual target only: マルゲリータ ⭐️⭐️⭐️⭐️⭐️ / ビスマルク 🆕 / ？？？ / ？？？.

Actual recipe availability, Bismarck data, unlock rules and References must come from current-main Fresh Audit. Never fabricate missing recipe/reference/progression data.

### Pizza Dex

Purpose: collection/record view — what has been discovered and achieved. It is distinct from Pizza Select but must reuse the same recipe/progression SSOT rather than duplicate state.

### Shop

Purpose: spend Pitz / obtain ingredients. Full functional redesign waits for Save v2 / Inventory / Economy contracts so the project does not build a decorative dead-end shop first.

## Approved visual direction

The target direction for HOME, Pizza Select, Pizza Dex and Shop is a warm rustic pizza-shop presentation: wood, brick, oven warmth, wooden signs and parchment-like cards.

Implementation rules:

- use official repository Teto/Mito/Blue assets; generated substitute dogs are not official characters
- keep text, stars, BEST, NEW, locks, counters and buttons as real HTML/CSS UI where practical rather than baking them into a single image
- adapt visual references to 390×844; do not shrink wide/four-column mockups until unreadable
- preserve touch target size, accessibility and no horizontal overflow

## Re-prioritized ordered roadmap

### P0 — HOME / FREE clarity — Issue #39

1. PS0 Fresh Audit: HOME/mode navigation, FREE recipe selection, recipe/unlock/Dex/BEST SSOT and official character assets. **Done** (merged via PR #40).
2. PS1 Navigation restructure: HOME 「ピザを作る」 → Pizza Select; HOME 「ランチラッシュ」 → Lunch Rush. **Done** (merged via PR #40).
3. PS2 Functional Pizza Select: completed / NEW / locked cards and correct selected-recipe handoff into Making Game. **Done** (merged via PR #40).
4. PS3 Visual reproduction: HOME + Pizza Select toward the approved rustic pizza-shop direction using official assets. **Done** (PR #41 — see `docs/reports/TETO_ISSUE-39_PS3_Visual-Result.md`), pending PS4 iPhone Human Feel.
5. PS4 Preview + real iPhone 390×844 Human Feel. **Done — PASS.** The user confirmed PS3 on a real iPhone at 390×844.

Issue #39's navigation/functional/visual work (PS1–PS4) is complete. Two HOME visual items remain as **non-blocking future polish** (not an Issue #39 gate, not a Human Feel failure):

- HOME's lower half has more empty space than ideal.
- Pizza thumbnail representation on cards could be strengthened further.

These are tracked under "Parallel / non-blocking" below and do not block moving on to Issue #32.

### P1 — Scoring consistency gate — Issue #32 (COMPLETE)

1. Recipe correctness Fresh Audit/pinning: missing/wrong/extra ingredient types belong to Recipe; quantity/placement belong primarily to Pieces; avoid double penalty. **Done.**
2. Interaction Consistency Fresh Audit (see `docs/reports/TETO_ISSUE-32_INTERACTION-CONSISTENCY_Fresh-Audit.md`, audited SHA `6dced18c8bc0da93276c5fd0822eafa636853201`) found golden-path sauce parity/tap-vs-drag already correct, plus two P1 defects (off-recipe sauce fallback; olive-oil heatmap visibility). **Both fixed and merged via PR #45** (see `docs/reports/TETO_ISSUE-32_SAUCE-PARITY_Result.md`). **Done.**
3. Re-calibrate only when concrete Human Feel evidence requires it; do not restart numeric coefficient tuning without a failing behavior.

### P1.5 — Making UX Cleanup — Issue #47 (COMPLETE)

Fresh Audit — see `docs/reports/TETO_ISSUE-47_MAKING-UX_Fresh-Audit.md` (audited SHA
`6e554918c42fc4d8ed267b715992e5ed5cf68e4f`). Verdict: **B. READY — 3 IMPLEMENTATION SLICES**.

1. **Slice A — Navigation/Retry/HOME** (lowest risk, no new data): HOME message-bubble z-index
   occlusion fix; Lunch Rush button flex-ratio wrap fix; remove/relabel the redundant FREE-mode
   ORDER→PREPARE gate after Pizza Select; add a same-recipe retry action + a second "別のピザを
   作る" button (今の「もう一度作る」は`excludeRecipeId`で毎回別レシピを選ぶ設計だったと判明);
   remove Shop/Pizza Dex navigation from the Making header; bump the Next CTA's touch-target
   height to match HOME's own primary CTA. **Done** (merged via PR #49 — see
   `docs/reports/TETO_ISSUE-47_SLICE-A_Result.md`). Human Feel **PASS**.
2. **Slice B — Reference UX**: a persistent mini Reference thumbnail during Making, and a
   player-facing completed-pizza reference for every playable recipe. **Done** (merged via
   PR #50 — see `docs/reports/TETO_ISSUE-47_SLICE-B_REFERENCE_Result.md`). Built as
   a deliberately separate `src/data/playerReference.ts` (generic, deterministic, generated
   purely from `Recipe.requiredIngredients`/ingredients, available for all 7 recipes) rather
   than expanding `referencePizza.ts` itself — that file remains Scoring 2.0's own
   Margherita-only authoritative target geometry, unchanged and untouched by this slice, per
   the explicit instruction not to fabricate Scoring 2.0 target coordinates. Margherita's
   existing `ReferencePreview` popover (Scoring 2.0-derived, precise bars) is unchanged and
   still used for Margherita specifically; every other recipe uses the new generic popover
   (identity + approximate placement, no numeric precision). Human Feel **PASS**.
3. **Slice C — Making controls**: sauce repaint-within-step and the one-way step guard are
   already correct (documented, no code change needed — **Done**, no PR needed). Cheese/Topping
   drag scope (today's real tray drag-and-drop is Margherita/mozzarella/basil-only; every other
   recipe/ingredient only has single-point tap/drag-release commit) is handed to **Issue #37
   M2**, which already owns this exact system — this hand-off, not an implementation, is Slice
   C's complete deliverable for Finding J.

Issue #47 is complete; Issue #33 is now the active priority (see below).

### P2 — Making Game 2.0 — Issues #33 / #37 (ACTIVE — Issue #47 Human Feel PASS gate satisfied)

1. Dough Shaping prototype + iPhone Human Feel. D0 Fresh Audit done and **revalidated** against
   `main` SHA `45fdf1a3ceae305f34dd1a8637b1a306f27dbfd5` (post Issue #47 Slice A/B) — see
   `docs/reports/TETO_ISSUE-33_DOUGH-D0_Fresh-Audit.md`'s appended Revalidation section.
   Revalidation verdict **B** (minor `gameReducer.ts` literal clarifications only; gesture/
   shape-model/state-design recommendations unchanged). **D1 implementation may now proceed.**
2. Preserve exact dough/sauce/cheese/topping choices into baked visual identity; avoid hidden auto-correction.
3. Interactive bake judgment.
4. FINISH step for post-bake basil/finishing oil where recipes require it.
5. RESULT identity: completed pizza as visual hero + descriptive traits/Teto reaction; score/stars secondary.

### P3 — Scoring 2.0 Authority / RESULT

Fresh Audit **done** — see `docs/reports/TETO_SCORING2_AUTHORITY_Fresh-Audit.md` (audited SHA
`2da3949de5bd642c709ca6ba343bc57d8101d03d`). Verdict: **D. BLOCKED BY ANOTHER SYSTEM** — blocked
by two findings internal to Scoring 2.0 itself (no Bake component exists yet, for any recipe;
Reference coverage exists for only 1 of 7 recipes), **not** by Dough, which is explicitly cleared
as a dependency. Recommended sequence, refining the steps below: **B1 Bake component + B2
Reference coverage (parallel) → A1 authority adapter (`gameReducer.ts` `CONFIRM_BAKE`) → A2
cutover verification → A3 legacy cleanup**.

1. Add a reviewed Bake similarity component to Scoring 2.0 (**B1** — does not exist today).
2. Extend Reference coverage from Margherita-only to the remaining 6 recipes (**B2**), via
   whatever reviewed-fixture-authoring path Issue #32's own P1 acceptance criterion specifies.
3. Introduce Save v2 migration first only if persistent semantics must change (this audit found
   none required for the cutover itself — Dex's `bestScore`/`bestStars` schema is already
   formula-agnostic).
4. Make calibrated Scoring 2.0 authoritative only after B1+B2 close, Issue #32 (done), and
   Making Game Human Feel gates.
5. Integrate stars / Dex BEST / progression without Recipe/Pieces/Dough/Bake/Finish double
   penalties — confirmed to need zero code changes at cutover (`dex.ts`/`missionScoring.ts`/
   `progression.ts` already only depend on `ScoreBreakdown`'s shape, not which formula produced
   it).
6. Score-based baked visual/sauce polish only after behavior and authority are stable.

### P4 — Pitz / Economy — Issue #38

1. Fresh Audit existing Pitz/save/shop contracts.
2. Deterministic score-based reward core. Current design candidate: `recipeBaseReward × qualityMultiplier = earnedPitz`; exact balance values remain provisional until playtesting.
3. RESULT one-time credit + before→after Pitz display; prevent reload/re-entry double credit.
4. iPhone Human Feel / reward balance.

Currency contract: **Pitz**. Do not introduce ¥/円 as the game currency.

### P5 — Save v2 / Inventory / Shop

1. Safe v1→v2 migration before new persistent semantics.
2. Consumable inventory separate from permanent ingredient ownership.
3. Restock / Shop purchasing.
4. Atomic material consumption at the reviewed confirmation boundary.
5. Revenue / ingredient cost / profit foundation.
6. Lunch Rush economy integration.
7. Dough inventory/consumption only after Save v2; Practice remains non-consuming.
8. Apply the approved Shop visual direction once the purchase loop is functional.

### P6 — Replayability / Content

- Difficulty / Hint Policy: Practice, Normal, Challenge, Lunch Rush.
- Time Attack after quality/authority contracts stabilize.
- Recipe expansion toward 20 using reviewed References rather than fabricated targets.
- Content Catalog + Recipe/Ingredient Editor before large-scale expansion.
- Pizza Dex visual overhaul and expansion: undiscovered → discovered → BEST → MASTER.
- Progression 2.0 / post-Dex-completion motivation.
- Recover/normalize larger PIZZA DB-derived catalog only from verified source data.

### P7 — Character / Final Polish

- richer official Teto/Mito/Blue reactions coordinated with Making Game/RESULT traits
- final animation / sound / visual polish
- advanced mechanics only after making, scoring, economy and replay loops are stable

## Screen implementation timing

| Order | Screen | Timing |
|---|---|---|
| 1 | HOME | Issue #39 now |
| 2 | Pizza Select | Issue #39 now |
| 3 | Making Game | #32 (done) → #47 (done) → **#33 (current)** → #37 |
| 4 | RESULT | Scoring 2.0 Authority / Making Game 2.0 |
| 5 | Pizza Dex | after score/BEST authority stabilizes, before broad recipe expansion |
| 6 | Lunch Rush | after Making Game 2.0 stabilizes |
| 7 | Pitz reward UI | Issue #38 after authority |
| 8 | Shop | after Save v2 / Inventory |
| 9 | Achievements / final progression | Progression 2.0 |

## Parallel / non-blocking

- Issue #27 accessibility live-region follow-up.
- SSOT docs cleanup against fresh code truth.
- PIZZA DB source recovery/catalog normalization as separate research/data work.
- HOME visual polish (future, non-blocking, not an Issue #39 gate): reduce HOME's lower-half
  empty space; strengthen pizza thumbnail representation on Pizza Select cards.

## Non-negotiable guards

- preserve the playable making loop and reset/stale-pointer safety
- preserve save compatibility unless a separately reviewed migration is intentionally introduced
- Scoring 2.0 remains non-authoritative until its gates pass
- do not silently change Dex BEST, stars, totalStars, Mission, Pitz, Shop or progression during navigation/visual-only work
- do not fabricate Reference targets, recipes, unlocks or catalog data
- player-made shape/placement should remain visibly identifiable through later steps; avoid silent normalization
- reasonable imperfection should remain viable
- official repository character assets are authoritative for Teto/Mito/Blue appearance
- smartphone vertical remains primary
- fresh repository state/tests outrank stale handoff text

## Preferred workflow

While Codex availability is limited:

`Fresh Audit/design → Claude Code implementation → tests/review → Preview → user iPhone Human Feel`

Use Codex for important independent reviews when available; do not block routine progress waiting for it.

Claude Code implementation tasks should generally stay around 2–3 hours where practical. Result reports belong under `docs/reports/`.

### Standard completion rule (Issue #39 PS3 onward)

A change is not "改修完了" (done) until every one of these steps has actually run, in order:

`Fresh Audit/design → implementation → focused/full tests → typecheck/lint/build → commit/push → PR → CI → dedicated Preview deployment → Preview smoke test → targeted 390×844 Review Playthrough → MP4 video output → Human Feel review → merge`

Rules for this sequence:

- Do not report a task "implementation complete" before its dedicated Preview deployment has
  finished. CI green on `perusonao/teto-pizza-game` alone is not enough, since the separate
  `perusonao/teto-pizza-game-preview` pipeline (manual `deploy-from-source.yml` + `pages.yml`
  dispatch, see the Issue #39 PS1/PS2 Preview-Gate report for the exact commands) is what the
  user actually opens on a real device. If Preview deploy genuinely cannot be completed in a
  session (e.g. sandboxed network policy blocking the dispatch itself), say so explicitly as a
  blocker rather than silently skipping the step.
- The Review Playthrough is not a fixed, always-identical script — design it each time around
  the specific review question this change needs answered (what changed, what could have
  regressed, what the user needs to actually see).
- Video: 390×844 is the primary viewport. Hold 1–3 seconds on every screen/state that matters
  for review. Prefer MP4 output (convert from the capture tool's native format if needed) for
  playback compatibility.
- Never commit a large review video into the repository. `artifacts/` (including
  `artifacts/review/`) is gitignored; deliver video directly to the user instead of committing
  it.
- **Audit-only tasks are exempt from Preview deployment and video capture** — a read-only
  Fresh Audit that changes no production code has nothing to deploy or play through.

## New-session startup checklist

1. Inspect fresh GitHub `main`, open PRs, issues and Actions state.
2. Read this file, Issue #22 and the current execution issue.
3. Treat fresh GitHub state as authoritative if anything conflicts.
4. Read the latest relevant audit/result report before implementation.
5. Keep Scoring 2.0 non-authoritative until the defined gates pass.
6. Whenever priority, completion status, estimates, architecture, navigation or visual direction changes, update both Issue #22 and this file.

Issue #37 remains the parent roadmap for physical pizza-making UX. Issue #39's HOME/FREE navigation work is complete. Issue #47 (Making UX Cleanup) is complete (Slice A/B merged, Human Feel PASS; Slice C's Finding J handed to Issue #37 M2). **Issue #33 (Dough Shaping) D1 is the current execution issue** — D0 design revalidated and ready, see `docs/reports/TETO_ISSUE-33_DOUGH-D0_Fresh-Audit.md`.