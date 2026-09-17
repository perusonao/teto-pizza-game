# Teto Pizza Game — Project Handoff / Roadmap SSOT

Updated: 2026-09-17

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
- Issue #32 — Reference / Recipe / Interaction consistency gate before Scoring 2.0 authority.
- Issue #33 — Dough Shaping.
- Issue #37 — parent roadmap for Making Game 2.0 physical pizza-making flow.
- Issue #38 — Scoring 2.0-linked Pitz reward / Economy connection.
- Issue #39 — HOME/FREE navigation redesign + Pizza Select. PS1/PS2/PS3 **complete** (PR #40, PR #41, both merged into `main`); PS4 iPhone Human Feel **PASS**. Remaining HOME visual polish (see "Parallel / non-blocking" below) is tracked as future polish, not an Issue #39 blocker.

Scoring 2.0 Shadow has already been implemented and calibrated. It remains non-authoritative until the remaining consistency/Human Feel gates pass.

### Recent merges

- **PR #40** — HOME navigation + functional Pizza Select. MERGED.
- **PR #41** — HOME + Pizza Select visual reproduction. MERGED. Merge SHA: `1b1ff6c69b837ff7f0da6ab3c14df7843812d8c3`.

Both are reflected in current `main`. **Next priority: Issue #32 Recipe correctness** (see P1 below).

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

### P1 — Scoring consistency gate — Issue #32

1. Recipe correctness Fresh Audit/pinning: missing/wrong/extra ingredient types belong to Recipe; quantity/placement belong primarily to Pieces; avoid double penalty.
2. Resolve remaining sauce interaction parity, olive-oil visibility and tap-vs-drag decisions within scope.
3. Re-calibrate only when concrete Human Feel evidence requires it; do not restart numeric coefficient tuning without a failing behavior.

### P2 — Making Game 2.0 — Issues #33 / #37

1. Dough Shaping prototype + iPhone Human Feel.
2. Preserve exact dough/sauce/cheese/topping choices into baked visual identity; avoid hidden auto-correction.
3. Interactive bake judgment.
4. FINISH step for post-bake basil/finishing oil where recipes require it.
5. RESULT identity: completed pizza as visual hero + descriptive traits/Teto reaction; score/stars secondary.

### P3 — Scoring 2.0 Authority / RESULT

1. Introduce Save v2 migration first if persistent semantics must change.
2. Make calibrated Scoring 2.0 authoritative only after Issue #32 + Making Game Human Feel gates.
3. Integrate stars / Dex BEST / progression without Recipe/Pieces/Dough/Bake/Finish double penalties.
4. Score-based baked visual/sauce polish only after behavior and authority are stable.

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
| 3 | Making Game | #32 → #33 → #37 |
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

Issue #37 remains the parent roadmap for physical pizza-making UX. Issue #39 is the current HOME/FREE navigation execution issue.