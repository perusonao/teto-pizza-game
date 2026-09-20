# Lunch Rush Completion Gate Integration 1A — Result Report

## Audited / implementation state

- **Audited main SHA**: `c95036b5543be527ab004d7eb4f6b73dea60931c` (`Full Game Reset 1A (#106)`, `origin/main` at the start of this work)
- **Duplicate PR Gate #1 (before starting)**: `git fetch origin` + `list_pull_requests` (open) + a scan of every `claude/*lunch*`/`*completion*` branch found no open PR and no other in-flight branch covering "Lunch Rush + Completion Gate" together. The closest name, `claude/completion-gate-failed-pizza-xwvfhj`, turned out to be the **already-merged** FREE-only Completion Gate Phase 1 work (`ecb5c8c`, PR #102) — a stale local mirror of history already on `main`, not a duplicate of this task. `claude/lunch-rush-ranking-phase0-cpu5ki` is a docs-only Firebase Online Ranking #87 audit (a different, later scope this task explicitly precedes) and was not touched.
- **Implementation HEAD**: `3cd5998b148dacf53851f99e2ce33ffa55967fbf` on `claude/lunch-rush-completion-gate-723h9h` — this work's own commit (`46abf5e`) merged forward onto `origin/main` after it advanced mid-session to `65a40c8` (`Visual Polish 1B: localize Lunch Rush Result (#109)`, `Sync Recipe Master with shipped Batch 1A (#108)` — neither overlaps this change's files; a clean merge, no conflicts).
- **Duplicate PR Gate #2 (immediately before opening the PR)**: re-ran `git fetch origin` + `list_pull_requests` (open) against the post-merge state above — still no open PR or new branch covering this scope.

## Post-main-sync update (PR #110, after Batch 1B-A merged to `main`)

`main` advanced again after PR #110 was opened: **Recipe Expansion Batch 1B-A (`#112`, `Pizza Bianca` + `Breakfast Pizza`)** squash-merged, which made `#110` briefly `mergeable=false`. Per instruction, this reused `#110`'s existing branch — no new PR was opened.

- **Latest `origin/main` SHA**: `6d5c0912611d2117974a9f2801f06fe4a68b9e0c` (`Recipe Expansion Batch 1B-A: Pizza Bianca + Breakfast Pizza (#112)`)
- **New implementation HEAD**: `97e73a8` on `claude/lunch-rush-completion-gate-723h9h` (`git merge origin/main --no-edit`, merged directly onto the branch's prior head `01714d9`)
- **Conflicts**: **none.** `git merge` resolved automatically (`ort` strategy) — Batch 1B-A's changes (`data/recipes/*_master_catalog.json`, `src/data/recipes.ts`/`ingredients.ts`/`orders.ts`/`referencePizza.ts`/`recipeSauceProfiles.ts` additions, their own test files, and its own new screenshots/Result Report) touch entirely different lines/files than this PR's Lunch Rush integration (`App.tsx`, `MissionServePanel.tsx`, `lunchRush.ts`, `gameReducer.ts` comments). The only file both branches touched was `src/App.test.tsx`, and even there the two changes landed in non-overlapping regions (Batch 1B-A added assertions elsewhere in the file; this PR's Lunch Rush tests are untouched) — Git auto-merged it with no manual resolution needed. Verified no leftover `<<<<<<<`/`=======`/`>>>>>>>` markers anywhere in `src/`/`data/` after the merge.
- **Batch 1B-A content preserved**: confirmed 13 recipes present post-merge, including `pizza-bianca` and `breakfast-pizza` (`node -e` scan of `src/data/recipes.ts`'s `id:` fields).
- **PR #109's Lunch Rush Result localization preserved**: `MissionResultOverlay.tsx`/`.test.tsx` (merged into this branch back at `3cd5998`, the first main-sync) carried through this second merge untouched — no conflicting change to that file in Batch 1B-A.
- **Unrelated changes**: none introduced by this sync — the merge commit brings in exactly Batch 1B-A's own files plus this PR's own pre-existing files, nothing hand-edited beyond the merge itself.

### Re-verification after the sync

- **Lunch Rush Completion Gate focused tests** (`src/mission/lunchRush.test.ts`, `src/App.test.tsx`, `src/state/gameReducer.completionGate.test.ts`, `src/state/gameReducer.completionGateEfficiency.test.ts`, `src/logic/completionGate.test.ts`, `src/components/ResultPanel.test.tsx`): **134/134 passed**.
  - PASS → `servedCount +1`, quality added: confirmed (`"Lunch Rush: 次の注文へ skips the redundant ORDER gate..."` and others).
  - FAILED → `servedCount +0`, quality `+0`, order advances: confirmed (`"...a Completion FAILED order shows the failure reason and never counts as served"`).
  - Repeated FAILED: confirmed (`"...repeated Completion FAILED orders never inflate servedCount or loop the same order"`).
  - FAILED → PASS: confirmed (`"...a PASS order right after a FAILED one still counts as exactly +1 served"`).
  - `missionBest`: unaffected — still derives purely from `mission.metrics`, which the above confirm is correct.
  - FREE regression: `gameReducer.completionGate.test.ts`/`completionGateEfficiency.test.ts`/`completionGate.test.ts`/`ResultPanel.test.tsx` all pass unmodified.
- **Full `npm test`**: **1660/1660 passed**, 84 test files (up from 1643/83 pre-sync — the 17 new tests are Batch 1B-A's own, carried in by the merge). No flaky tests observed (single deterministic run, all green).
- **`npx tsc -b`**: clean.
- **`npm run lint`** (oxlint): clean.
- **`npm run build`**: succeeds.
- **Browser re-verification** (Playwright/Chromium, 390×844, fresh `localStorage`): re-ran the exact same PASS → FAILED → next-order flow against the merged code. Identical result to the pre-sync run — PASS scores normally, FAILED shows `トマトソースが入っていません` with `servedCount` frozen at `1` both before and after advancing past the FAILED order, timer keeps counting (`2:58` → `2:56`), **0 console errors**, **0 horizontal overflow**. Screenshots re-captured in place (`docs/reports/screenshots/lunch-rush-completion-gate-1a/*_390x844.png`).
- **Push**: `git push origin claude/lunch-rush-completion-gate-723h9h` (same branch, same PR #110) — not auto-merged.

## Fresh audit (this session, against the SHA above)

Traced `CONFIRM_BAKE → evaluatePizzaCompletion → Scoring 2.0 → Lunch Rush SERVE → missionScore → persistMissionBest` directly in code:

- `evaluatePizzaCompletion` (`src/logic/completionGate.ts`) is computed **unconditionally** at `CONFIRM_BAKE` (`src/state/gameReducer.ts`) for both FREE and Lunch Rush, from the exact same canonical `pizza` Scoring 2.0 also scores. Independent of Scoring 2.0 — no drift risk between the two.
- FREE's `REGISTER_TO_DEX` already gated on it (Completion Gate Phase 1, PR #102): a `FAILED` round returns `state` unchanged — no Dex/BEST/timesMade, no Starter Grant, no Pitz credit.
- **Confirmed the prior audit's finding still held**: Lunch Rush's `MISSION_NEXT_ORDER` (`gameReducer.ts`) computed `state.completion` but never read it — its own comment said so explicitly ("deliberately not read here... explicitly deferred to a later phase"). Its Dex/BEST/timesMade/Starter Grant registration ran unconditionally either way.
- The actual per-pizza serve counting/scoring for Lunch Rush does **not** live in `gameReducer.ts` at all — it lives one layer up, in `App.tsx`'s `handleMissionServeNext` and `src/mission/lunchRush.ts`'s `missionRunReducer` `SERVE` case. That `SERVE` dispatch always called `recordServe(metrics, state.score.total)` regardless of `state.completion`, so a Completion-FAILED pizza (missing required ingredient / insufficient sauce / under- or over-baked) still incremented `servedCount` and added its raw quality score to `totalQualityScore` — exactly the "未完成ピザでも通常得点できる" bug this task targets.
- `missionScore = servedCount * 100 + totalQualityScore` (`src/logic/missionScoring.ts`) — unchanged formula, confirmed still current.
- Ingredient consumption (`consumePizzaInventory`, called at `CONFIRM_BAKE`) was already unconditional on `completion` for both modes — a FAILED pizza's used finite ingredients were never refunded, even before this change (already covered by `gameReducer.completionGate.test.ts`'s own test #23).
- Cooking Time CT1/CT2 (Efficiency Bonus) were already gated on `!state.isMissionRound`, so Lunch Rush never picked those up regardless of this change.
- `persistMissionBest`/`CLAIM_MISSION_REWARD` (App.tsx effects) both derive purely from `mission.metrics` — fixing `metrics` accumulation was sufficient to fix these downstream, no separate change needed.

## Root cause and fix

The gap was entirely in the **Mission-metrics layer** (`App.tsx` + `src/mission/lunchRush.ts`), not in `gameReducer.ts`'s Dex/Starter-Grant registration (left untouched — see Scope Guard below).

1. **`src/mission/lunchRush.ts`**: `MissionRunAction`'s `SERVE` variant gained an optional `completionFailed?: boolean`. `missionRunReducer`'s `SERVE` case now returns `state` unchanged (metrics untouched) when `completionFailed` is true, before ever calling `recordServe`. The one-shot deadline-expiry check (Codex review P2-1) still runs first and is unaffected.
2. **`src/App.tsx`**: `handleMissionServeNext` now reads `state.completion?.status === "FAILED"` (the exact same field FREE's `ResultPanel`/`REGISTER_TO_DEX` already read) and passes `completionFailed`/a forced `qualityTotal: 0` into the `SERVE` dispatch. The order-advance dispatches (`MISSION_NEXT_ORDER`, `BEGIN_PREPARE`) are **unconditional** on completion, same as before — the order is still consumed and the run still advances to a fresh PREPARE regardless of PASS/FAILED.
3. **`src/components/MissionServePanel.tsx`**: gained a `completion: PizzaCompletionResult` prop. A `FAILED` completion renders a compact failure card (reusing `buildCompletionFailureMessage` from `src/data/completionMessages.ts` — the exact same reason copy FREE's `ResultPanel` shows, no new/independent message) instead of the stars/score/+1 SERVED card. The "次の注文へ" CTA stays in both variants.
4. **`src/screens/GameScreen.tsx`**: passes `state.completion` into `MissionServePanel`.
5. **`src/state/gameReducer.ts`**: comments only — updated the two stale "deferred to a later phase" comments on `CONFIRM_BAKE` and `MISSION_NEXT_ORDER` to point at where the gating now actually lives, since leaving them as-is after this change would have been actively misleading to a future reader.

No new completion-check logic was written anywhere — every PASS/FAILED decision still flows through the single `evaluatePizzaCompletion` call at `CONFIRM_BAKE`; Lunch Rush and FREE can never drift on what counts as a completed dish.

## Before / after behavior

| | Before | After |
|---|---|---|
| FAILED order's quality | Full raw `ScoreBreakdown.total` added to `totalQualityScore` | `0` added |
| FAILED order's servedCount | `+1` | `+0` |
| FAILED order's `missionScore` contribution | `100 + quality` | `0` |
| FAILED order feedback | None (looked identical to a real low-score PASS) | Same short failure-reason copy FREE shows (e.g. 「トマトソースが入っていません」/「◯◯をもう少し広くぬろう！」/「生焼けで提供できません」/「焦げすぎて提供できません」) |
| Order/timer/ingredient handling on FAILED | Order consumed, ingredients not refunded, timer continues, next order begins | **Unchanged** — same as before |
| Retry behavior on FAILED | N/A (was indistinguishable from PASS) | Never retries the same order — always advances to a new order, exactly like PASS |

## PASS / FAILED semantics (final)

- **PASS**: unchanged. Normal serve, quality added, `servedCount +1`, next order.
- **FAILED**: order consumed and advances to a new order; `servedCount +0`; `totalQualityScore +0`; `missionScore` unaffected; finite ingredients used are **not** refunded (pre-existing, unconditional `consumePizzaInventory` behavior); Lunch Rush's own timer is unaffected; no FREE-only Cooking Time/Efficiency Bonus is applied (already gated on `!isMissionRound`); never a retry loop — each FAILED order still consumes one of the run's own order slots/time.

## servedCount / quality / missionScore / missionBest semantics

- `servedCount`, `totalQualityScore`, `bestQualityScore` (`src/logic/missionScoring.ts`'s `MissionMetrics`) now only ever move on a genuine PASS serve — verified directly in `src/mission/lunchRush.test.ts`'s new `"SERVE with completionFailed"` suite.
- `missionScore = servedCount * 100 + totalQualityScore` — formula itself **unchanged** (not touched, per Scope Guard); its inputs are now correct.
- `missionBest` (`persistMissionBest`, an `App.tsx` effect keyed on `mission.mode === "RESULT"`) derives purely from `mission.metrics`, so it automatically inherits the fix with no code change of its own — a run padded with FAILED orders can no longer inflate a persisted Mission BEST.
- Dex/BEST/timesMade/Starter Grant registration in `MISSION_NEXT_ORDER` is **intentionally left exactly as it already was** (unconditional on `state.completion`) — see Scope Guard.

## Ingredient consumption / timer behavior

Both were already correct and are **unchanged** by this work:
- `consumePizzaInventory` runs unconditionally at `CONFIRM_BAKE`, before/independent of the Completion Gate result — a finite ingredient used on a FAILED pizza was already not refunded, for both FREE and Lunch Rush, prior to this change (covered by `gameReducer.completionGate.test.ts`'s existing test #23, which exercises this exact reducer step both modes share).
- Lunch Rush's own mission clock (`src/mission/lunchRush.ts`'s `MissionClock`/`TICK`) is untouched; a FAILED `SERVE` still passes through the same one-shot deadline check as a PASS `SERVE` before returning early.

## FREE regression

`src/logic/completionGate.ts`, `src/data/completionMessages.ts`, `src/components/ResultPanel.tsx`, the Completion Gate thresholds (`SAUCE_MIN_RATIO`, `BAKE_ACCEPTABLE_MARGIN_RATIO`), and FREE's `REGISTER_TO_DEX` gating are all **byte-for-byte unchanged**. The full existing FREE-focused Completion Gate test suite (`gameReducer.completionGate.test.ts`, `gameReducer.completionGateEfficiency.test.ts`, `completionGate.test.ts`, `ResultPanel.test.tsx`) still passes unmodified.

## Scope guard notes (what was deliberately *not* touched)

Per the task's own Scope Guard (section 9): FREE Completion Gate rules, thresholds, `SAUCE_MIN_RATIO`, Scoring 2.0 weights, star thresholds, Cooking Time thresholds, Economy, Recipe data/unlocks, Starter Grants, Shop, Inventory, Dex, Firebase, Online Ranking, Master Catalog, Batch 1B were all left untouched. Concretely:
- `MISSION_NEXT_ORDER`'s `registerScoreToDex`/`applyStarterGrants` calls are unconditional exactly as before — this task only gates Lunch Rush's own `servedCount`/quality/`missionScore` metrics, not Dex/Starter Grant registration, which the Scope Guard explicitly excludes.
- `missionScore`'s formula, `isNewMissionBest`, `calculateMissionReward` (`src/logic/economy.ts`) are unchanged — only their *inputs* were corrected.
- No Save schema change, no Firebase/Online Ranking code added, no new FAILED-history persistence.

## Test coverage added

- `src/mission/lunchRush.test.ts`: new `"SERVE with completionFailed"` describe block (4 tests) — metrics stay untouched on a FAILED serve regardless of the `qualityTotal` passed, a FAILED serve doesn't reset metrics a prior PASS accumulated, and the one-shot deadline-expiry behavior is preserved for a FAILED serve too.
- `src/App.test.tsx`: real end-to-end (real reducers, real `App`) coverage —
  - Updated the two pre-existing Lunch Rush tests to bake a genuine PASS pizza (they previously baked an empty pizza, which is itself now a FAILED round under the already-merged FREE Completion Gate — those tests were incidentally asserting on FAILED-round behavior without realizing it, since Lunch Rush had no FAILED-aware branching yet).
  - New: a Completion FAILED order shows the reused failure-reason text, never bumps `servedCount`, and still advances to a fresh PREPARE.
  - New: two consecutive FAILED orders never inflate `servedCount` and never loop the same order.
  - New: a PASS order served immediately after a FAILED one still counts as exactly `+1`, confirming the two never bleed into each other's counts.

**Full suite**: `npm test` → **1637 tests passed, 0 failed** (83 test files). `npx tsc -b` → clean. `npm run lint` (oxlint) → clean. `npm run build` → succeeds.

No flaky tests were observed in any of the above runs (each ran once, deterministically green).

## Browser verification

Ran the real built app (`vite dev`) in a real Chromium (Playwright-driven, `/opt/pw-browsers/chromium`) at both required viewports, fresh `localStorage` each time:

1. Started Lunch Rush, baked a genuine margherita (sauce ring + 3× mozzarella + 2× basil, needle inside the perfect zone) → **PASS**: stars/score/+1 SERVED shown, `servedCount` badge → 1.
2. Tapped 次の注文へ → next order appears, timer keeps counting.
3. Baked a second order with **zero ingredients placed** → **Completion FAILED**: shown reason `トマトソースが入っていません` (reused FREE copy, unchanged component), no score/stars/+1 SERVED shown.
4. `servedCount` badge stayed at `1` (unchanged from before this FAILED order).
5. Tapped 次の注文へ → advanced to a fresh PREPARE screen (DOUGH step), not a retry of the same order.
6. `servedCount` badge stayed at `1` after advancing (still didn't count the FAILED order).
7. Timer continued counting down throughout (`2:58` → `2:56`).
8. Console errors: **0** at both viewports.
9. Horizontal overflow (`scrollWidth - clientWidth`): **0** at every checkpoint, both viewports.

Verified at **390×844** and **360×800**.

## Screenshots

`docs/reports/screenshots/lunch-rush-completion-gate-1a/`:
- `A-lunch-rush-PASS_390x844.png` / `A-lunch-rush-PASS_360x800.png` — PASS result state
- `B-next-order-after-PASS_390x844.png` / `B-next-order-after-PASS_360x800.png` — next order after a PASS
- `C-lunch-rush-FAILED_390x844.png` / `C-lunch-rush-FAILED_360x800.png` — FAILED feedback state
- `D-next-order-after-FAILED_390x844.png` / `D-next-order-after-FAILED_360x800.png` — next order after a FAILED order (servedCount unchanged, timer continuing)

## Remaining risks

- `MISSION_NEXT_ORDER` still registers **every** order (PASS or FAILED) to the Dex/BEST/timesMade and evaluates Starter Grants unconditionally, per the Scope Guard above. This means a FAILED Lunch Rush order can still mark a recipe "discovered" and unlock a Starter Grant chain (e.g. baking an empty margherita order still discovers margherita and immediately unlocks/grants funghi's Starter Stock) — this is pre-existing behavior, not introduced or changed by this work, but it is a real asymmetry against FREE's own `REGISTER_TO_DEX` (which skips all of this on FAILED). Flagging it explicitly since it surfaced directly during this task's own test-writing (a FAILED first order changes which recipe the very next order can be). Left out of scope deliberately (Dex/Starter Grants are explicitly listed as untouched in section 9) — a natural follow-up for a future phase if this asymmetry needs closing.
- No changes were made to `missionScore`'s formula or `calculateMissionReward` — a Lunch Rush run's Pitz reward and displayed average/best quality were already correct in shape and now also correct in the numbers feeding them.

## Firebase Online Ranking #87 readiness

Competitive scoring semantics for Lunch Rush are now fixed and consistent with FREE's Completion Gate: a `missionScore`/`missionBest` value can no longer be inflated by an incomplete pizza. This was the explicit prerequisite this task set out to close before Online Ranking #87 begins. No Firebase/ranking code was added or touched here.

## Final Verdict

**A. READY TO MERGE**
