# Completion Gate Phase 1: Failed Pizza / Minimum Quality Rules — Result Report

- **Base main SHA**: `37c11d3d4d0416654c41087d2c64ef1b4b467d27` (Recipe Expansion Batch 1A — 7 → 11 recipes, #100)
- **Branch**: `claude/completion-gate-failed-pizza-xwvfhj`
- **Scope note**: PR #101 (Cooking Time CT2) is OPEN and was deliberately **not** touched, merged, or
  rebased onto. This work is based on `origin/main` at the SHA above only.

## 1. Purpose

Before this change, any pizza — including an empty one — was scored by Scoring 2.0 and floored at
★1 with some Pitz reward. This conflates two different questions:

- **"Did this become a real dish at all?"** (Completion Gate — this PR)
- **"How well was it made?"** (Scoring 2.0 — unchanged)

A pizza that fails the Completion Gate is not a ★1 pizza. It is not scored at all: 0 Pitz, no
Dex/BEST/progression credit, and a distinct "失敗" (FAILED) RESULT screen instead of the normal
score/stars UI.

## 2. Duplicate Gate

Searched OPEN PRs/issues in `perusonao/teto-pizza-game` for "Completion Gate", "Failed Pizza",
"pizza failure", "minimum ingredient", "underbaked", "burnt", "completion", "bake failure",
"recipe failure" before starting, and again immediately before opening the PR. Only 4 OPEN PRs
existed at either check (docs status-sync PR #72, Dough Shaping D0 PR #46, Reference Visual PR
#34, Phase 1 infra PR #3) — none overlap this scope. No duplicate found either time.

## 3. Fresh Audit (pre-implementation)

Read before writing any code:
`src/logic/scoringV2/*`, `src/logic/scoring.ts`, `src/logic/bake.ts`, `src/state/gameReducer.ts`,
`src/state/pizzaState.ts`, `src/data/recipes.ts`, `src/data/referencePizza.ts`,
`src/data/recipeSauceProfiles.ts`, `src/logic/sauceField.ts`, `src/logic/sauceEvaluation.ts`,
`src/state/inventory.ts`, `src/state/dex.ts`, `src/state/progression.ts`, `src/state/starterStock.ts`,
`src/logic/pitzReward.ts`, `src/components/ResultPanel.tsx`, `src/screens/GameScreen.tsx`,
`src/App.tsx`, `src/components/PizzaStage.tsx`, `src/components/BakeOverlay.tsx`,
`src/logic/sauceDispenseController.ts`.

Key findings that shaped the design:

- **`Recipe.requiredIngredients[].minCount` already exists** for all 11 recipes — Scoring 2.0's
  own Recipe component (`recipeComponent.ts`) deliberately only checks *presence* (`>= 1`), never
  `minCount` (that's `matchScore`'s pre-existing gap, and exactly what the task calls out). The
  Completion Gate is the first place `minCount` is actually enforced as a hard floor.
- **Every one of the 11 recipes now has a Reference fixture** (`getReferencePizza`), including a
  `ReferenceSauce.quantity`/`.coverage` target — this was true even before this PR (B2 "Reference
  coverage" landed earlier), so the sauce-minimum rule below can be derived per-recipe instead of
  hand-picking new numbers.
- **Every `Recipe.bakeTarget` zone is exactly 20 points wide** (`{start, end}` with `end - start
  === 20` for all 11 recipes) — a uniform, ratio-based margin around this zone works cleanly
  without per-recipe tuning.
- **CONFIRM_BAKE is the single canonical scoring call site** (`gameReducer.ts`), already computing
  `scoringV2Result` and consuming finite inventory (`consumePizzaInventory`) unconditionally. This
  is exactly where the Completion Gate needed to be computed too — no new consumption boundary.
- **REGISTER_TO_DEX (FREE) and MISSION_NEXT_ORDER (Lunch Rush)** are the only two places Dex/
  BEST/Starter Grant/Pitz are actually applied, both guarded on `phase === "RESULT" && state.score`.
  Gating REGISTER_TO_DEX specifically is what makes FAILED semantics apply to FREE.
- **`ResultPanel`/`GameScreen`** already have a structural seam for "phase stays at RESULT instead
  of advancing to DISCOVERED" (a pre-existing comment anticipated "a stray dispatch that somehow
  leaves phase at RESULT" continuing to render a complete screen) — the FAILED RESULT UI reuses
  this seam directly rather than inventing a new phase.
- **The legacy one-shot `APPLY_SAUCE` action is effectively unreachable from the real touch/mouse
  UI** — `PizzaStage.tsx`'s `isPaintMode` starts an incremental `COMMIT_SAUCE_DISPENSE` dispense
  session unconditionally on pointerdown for any spread ingredient, even a plain tap (which lays
  down exactly one "starter tick" — see `sauceDispenseController.ts`'s own `start()` doc comment).
  This directly informed the sauce-minimum design (§6) and was confirmed empirically while fixing
  `App.test.tsx`'s own end-to-end fixtures (a single tap on the sauce step measurably fails the
  gate's own floor).

## 4. Architecture

New pure module: **`src/logic/completionGate.ts`**, exporting
`evaluatePizzaCompletion(recipe, pizza): PizzaCompletionResult`.

```ts
type PizzaCompletionResult =
  | { status: "PASS" }
  | {
      status: "FAILED";
      reason: CompletionFailureReason;   // the ONE primary reason to show
      ingredientId?: string;
      failures: readonly CompletionFailureDetail[]; // every failure found, primary first
    };

type CompletionFailureReason =
  | "MISSING_REQUIRED_INGREDIENT"
  | "INSUFFICIENT_REQUIRED_AMOUNT"
  | "INSUFFICIENT_SAUCE"
  | "UNDERBAKED"
  | "OVERBAKED";
```

Deliberately independent of Scoring 2.0 (`../logic/scoringV2/`): neither module imports the
other, and `computeScoringV2` is completely unmodified. `evaluatePizzaCompletion` is pure, total
(never throws — fails closed on malformed input the same way Scoring 2.0's own boundary layer
does, reusing `sanitizeStringArray`/`sanitizeToppings`/`sanitizeSauceDeposits`), and reads only
`recipe`/`pizza`.

Player-facing Japanese copy lives in a **separate** module, **`src/data/completionMessages.ts`**
(`buildCompletionFailureMessage`) — the logic module never emits display text, matching the "UI
用の日本語メッセージとロジック上のreason codeは分離すること" requirement.

## 5. Required-ingredient minimum rule (§4)

For every `req` in `recipe.requiredIngredients`:

- `countUsedIngredient(pizza, req.ingredientId) === 0` → **FAILED, `MISSING_REQUIRED_INGREDIENT`**
- `0 < count < req.minCount` → **FAILED, `INSUFFICIENT_REQUIRED_AMOUNT`**
- `count >= req.minCount` → passes this check (Scoring 2.0's Pieces component still grades *how
  well* extra/exact amounts are placed)

`countUsedIngredient` (`../logic/scoring.ts`) is the existing primitive already used by legacy
`matchScore`/Dex — reused as-is, not reimplemented. Unlimited ingredients (tomato-sauce,
mozzarella, basil, …) are never exempted: the check is purely "how many are actually on this
`PizzaState` right now," independent of stock/ownership.

## 6. Sauce minimum rule (§6)

Applies only to the recipe's own sauce/oil ingredient (`getReferencePizza(recipe.id).sauce.ingredientId`
— tomato-sauce/olive-oil/pesto depending on the recipe), and only once that ingredient has already
passed the generic presence check above (§5). Computes `computeSauceMetrics(sauceDeposits)` (the
same primitive Scoring 2.0's own Sauce component uses) and compares against the Reference's own
`quantity`/`coverage` targets as **ratios**, never absolute numbers:

```
SAUCE_MIN_RATIO = COVERAGE_POOR_RATIO / 2   // 0.275
FAIL if (metrics.quantity / reference.quantity) < SAUCE_MIN_RATIO
     OR (metrics.coverage / reference.coverage) < SAUCE_MIN_RATIO
```

`COVERAGE_POOR_RATIO` (0.55) is the *existing* boundary between the "good" and "poor" 広さ tiers
players already see (`sauceEvaluation.ts`). Half of that floor is the rationale: anything that
would still read as a genuine (if bad) "poor" sauce application stays a completable pizza for
Scoring 2.0 to grade down; only something meaningfully thinner than "poor" — a single dab, "1回
触っただけ" — fails outright. This is a single global ratio, not a per-recipe magic number, and it
is reachable for all 11 recipes because every recipe's `ReferenceSauce` already exists.

One deliberate exemption: an empty `sauceDeposits` log with the sauce ingredient present (the
legacy one-shot `APPLY_SAUCE` action, which always applies full coverage instantly and never
populates a deposit log) is read as "applied via the instant-fill path," not "barely touched." As
noted in §3, this path is effectively unreachable from the real UI today, so this exemption is a
defensive/compatibility branch, not the primary real-world behavior — a real single-tap dispense
session (one starter tick's worth of deposits) is **not** exempted and correctly fails.

## 7. Bake Completion Gate (§7, the most important rule)

Reuses `Recipe.bakeTarget` (`{start, end}`) as the center of a three-zone model, derived — not
hand-authored per recipe:

```
margin = (end - start) * BAKE_ACCEPTABLE_MARGIN_RATIO   // ratio = 0.5
FAIL LOW:  bakeResult < start - margin   -> UNDERBAKED
PASS:      start - margin <= bakeResult <= end + margin
FAIL HIGH: bakeResult > end + margin     -> OVERBAKED
```

Since every recipe's `bakeTarget` is exactly 20 points wide, `margin` is 10 for all 11 recipes
today (e.g. margherita `{60, 80}` → PASS range `[50, 90]`). The PASS range is double the width of
the original "perfect" zone, split evenly as an "acceptable but degraded" band on each side.

**Inside the PASS range, this gate makes no scoring decision at all.** `../logic/scoringV2/bakeComponent.ts`
(pre-existing, completely unmodified) already computes a continuous 0–100 Bake Score from the
exact same `bakeTarget`, using distance-from-nearest-edge — 100 inside the original perfect zone,
degrading smoothly toward either edge of the acceptable margin. That score still feeds the
existing 20/100 Bake weight in Scoring 2.0's total exactly as before. The Completion Gate only
decides the two hard boundaries; everything between them is Scoring 2.0's unchanged job.

Test 15 (`completionGate.test.ts`) pins this directly: a bake at the acceptable-underbake edge
(52) and a bake at the ideal center (70) both PASS, but the ideal one's `components.bake.score`
is strictly higher (100 vs. a real degraded number) — the gate and the score are independent.

## 8. Priority order for multiple simultaneous failures (§16)

```
1. MISSING_REQUIRED_INGREDIENT
2. INSUFFICIENT_REQUIRED_AMOUNT
3. INSUFFICIENT_SAUCE
4. UNDERBAKED / OVERBAKED
```

Rationale: composition failures ("this isn't even the right dish") are more fundamental than a
bake mistake ("the right dish, baked a bit wrong"). A completely missing ingredient outranks a
merely-insufficient one. The sauce-quality check only ever fires once the sauce ingredient's own
presence/amount has already passed, so it never competes with §5 for the same ingredient. Every
failure is still recorded in `failures` (for a possible future "詳細を見る" expansion) — Phase 1
itself only ever surfaces the one primary reason, per its own Scope Guard.

## 9. FAILED semantics

- **Reward**: `REGISTER_TO_DEX` is a complete no-op when `state.completion?.status === "FAILED"`
  (returns `state` unchanged, before Dex/Starter-Grant/Pitz are touched at all) — `state.lastPitzCredit`
  stays at its fresh-round `null`, not a `{ earnedPitz: 0 }` snapshot.
- **Quality stars**: never computed for display — `ResultPanel`'s FAILED branch renders no stars
  and no numeric score at all, never a fabricated/implied "★☆☆☆☆".
- **RESULT display**: a distinct "失敗" heading, the one primary failure reason
  (`buildCompletionFailureMessage`), an explicit "今回の獲得 +0 Pitz" line, and the same
  もう一度つくる／別のピザを作る CTAs as a normal RESULT (reused, not reinvented).
- **Inventory**: unaffected by the gate. `consumePizzaInventory` runs unconditionally at
  CONFIRM_BAKE, before the gate result is even known to any caller — a finite ingredient placed
  on a FAILED pizza is consumed exactly like on a PASSing one, never refunded (test 23).
- **Dex/progression**: no discovery, no BEST update (no entry created at all, not even a floor —
  tests 17/19/20), `justDiscovered`/`justGotNewBest` stay `false`, and any recipe chained to this
  one's discovery stays locked (test 21).
- **Starter Grant**: never applied — `applyStarterGrants` is simply never called on the FAILED
  path (test 22), confirmed against a PASSing contrast case that *does* grant it (test 22b).
- **Lunch Rush**: see §11 below — deliberately **not** gated in Phase 1.

## 10. PASS semantics (unchanged)

Scoring 2.0's formula/weights, the ★ thresholds (0/40/60/75/90 → ★1–★5), the Pitz reward formula
(`baseRewardPitz × qualityMultiplier`), Dex BEST/timesMade, and Starter Grant all apply exactly as
before a PASSing round. Zero changes to `scoringV2/*`, `scoring.ts`, `pitzReward.ts`, `dex.ts`,
`progression.ts`, or `starterStock.ts`. Tests 24–26 pin this directly against the same
`playToResultForRecipe` harness the FAILED tests use.

## 11. Lunch Rush decision

**Deferred.** `state.completion` is computed unconditionally at CONFIRM_BAKE for Mission rounds
too (harmless, pure), but `MISSION_NEXT_ORDER`'s own registration logic does **not** read it —
Lunch Rush keeps its exact pre-existing behavior this phase.

Rationale: applying the gate to Lunch Rush changes Mission balance in a way this task's own Scope
Guard (§20, "Efficiency Bonus/timer/reward/balance変更禁止") explicitly puts out of scope to
decide unilaterally. A FAILED pizza mid-run would still consume the run's own elapsed time and any
finite ingredients for zero served credit — that's a real design decision (does a FAILED serve
count against the run? should the player get a distinct "salvage" message mid-timer?) that needs
its own Human Feel pass against Lunch Rush's timer pressure, not a Phase 1 side effect. §15
explicitly permits "FREEのみPhase 1適用、Lunch Rushはdefer." This report is that explicit
decision record; a follow-up phase should re-evaluate Lunch Rush once FREE's own gate has real
play data behind it.

## 12. 11-recipe verification

`completionGate.test.ts`'s test 27 loops every recipe in `RECIPES` (all 11): an ideal,
Reference-matching pizza PASSes for every one, and a genuinely empty pizza FAILS for every one.
`gameReducer.scoringV2Authority.test.ts` (pre-existing, now-adjusted `poorPizzaForRecipe` fixture)
continues to exercise Margherita specifically end-to-end through the reducer; `completionGate.test.ts`
covers the ingredient-minimum/sauce/bake boundary logic directly for all 11 without needing a
full reducer round-trip per recipe.

## 13. Changed files

**New:**
- `src/logic/completionGate.ts` — the gate itself
- `src/logic/completionGate.test.ts` — pure gate-logic tests (19 tests)
- `src/data/completionMessages.ts` — Japanese failure-reason copy
- `src/state/gameReducer.completionGate.test.ts` — FAILED/PASS reducer-integration tests (14 tests)
- `docs/reports/screenshots/completion-gate-phase1/` — Human Feel screenshots (this report)

**Modified:**
- `src/state/gameReducer.ts` — `GameState.completion` field; computed at `CONFIRM_BAKE`; gates
  `REGISTER_TO_DEX`; documents the deliberate `MISSION_NEXT_ORDER` non-gating
- `src/components/ResultPanel.tsx` — new `completion` prop; a distinct FAILED render branch
- `src/screens/GameScreen.tsx` — passes `completion`; suppresses the quality-based heading line
  for a FAILED round
- `src/components/ResultPanel.test.tsx` — `baseProps()` now includes `completion: { status: "PASS" }`
- `src/state/gameReducer.pitzReward.test.ts` — the pre-existing "minimal pizza" fixture is now a
  FAILED round (that *is* the point of this phase); test repurposed to assert FAILED semantics
  instead of a `0-39 score band` PASS
- `src/state/gameReducer.cookingTiming.test.ts` — its "DISCOVERED" fixture now builds a real
  PASSing pizza (an empty one no longer reaches DISCOVERED at all)
- `src/state/gameReducer.scoringV2Authority.test.ts` — `poorPizzaForRecipe` now places every
  required piece at its own `minCount` and uses a sauce ring that clears the gate's floor, so a
  "worse but real" round for the Dex-BEST comparison test stays PASSing rather than becoming
  FAILED (which would have made that test's own assertions meaningless)
- `src/App.test.tsx` — one end-to-end test ("RESULT 2.0: auto-registers…") now actually builds a
  real pizza (sauce ring-painted via repeated taps, cheese/topping placed, bake needle driven to a
  controlled value via a stubbed `requestAnimationFrame`/`performance.now`) instead of relying on
  an empty pizza, since that round must now genuinely PASS for the discovery banner to appear

No changes to `src/logic/scoringV2/*`, `src/logic/scoring.ts`, `src/logic/pitzReward.ts`,
`src/state/dex.ts`, `src/state/progression.ts`, `src/state/starterStock.ts`,
`src/state/persistence.ts`, or `src/mission/*`.

## 14. Tests

**`src/logic/completionGate.test.ts`** (19 tests, pure `evaluatePizzaCompletion` coverage):
covers spec tests 1–15 (ideal PASS; missing/insufficient/exact/extra ingredient; no/thin/minimal/
ideal sauce; clear/acceptable underbake; ideal bake; acceptable/clear overbake; PASS-range Bake
Score variance), plus a PASS/FAIL boundary-exactness check, a multi-failure priority check, a
malformed-input fail-closed check, and spec test 27 (all 11 recipes).

**`src/state/gameReducer.completionGate.test.ts`** (14 tests, reducer integration): covers spec
tests 16–23 (reward=0; never ★1; no Dex/BEST/timesMade; no recipe unlock; no Starter Grant, with
a PASSing contrast case; finite inventory still consumed) and 24–26 (PASS regression: real score,
real reward, real Dex registration), plus one extra sauce-boundary regression check.

**Spec tests 28–30** (Scoring V2 regression / CT1 regression / Save schema unchanged): verified by
the full suite staying green with zero changes to `scoringV2/*`, `cookingTiming.ts`, or
`persistence.ts` — see §16 below for the exact before/after counts.

## 15. Mobile Human Feel (390×844 / 360×800)

Ran the real Vite dev build in a headless Chromium browser (Playwright, the pre-installed
`/opt/pw-browsers` binary) at both viewports, playing real rounds through the actual UI (dough
gesture, ingredient-chip selection, sauce paint drag / repeated taps, real bake-needle timing) —
not synthetic reducer dispatches. Scenarios and outcomes (screenshots in
`docs/reports/screenshots/completion-gate-phase1/`):

| Scenario | Result | Reason shown | Bake badge |
|---|---|---|---|
| A. Missing ingredients (no sauce/cheese/topping) | **FAILED** | トマトソースが入っていません | 生焼け |
| B. Clear underbake (real ingredients, ~raw) | **FAILED** | 生焼けで提供できません | 生焼け |
| C. Clear overbake (real ingredients, ~burnt) | **FAILED** | 焦げすぎて提供できません | 焦げ |
| D. Acceptable-but-underbaked | **PASS**, ★4 / 80点 | (Teto: "もう少し焼いてもよかったかもな…") | 生焼け |
| E. Acceptable-but-overbaked | **PASS**, ★4 / 78点 | | 焦げ |
| G. Ideal | **PASS**, ★4 / 80点, discovery + Starter Grant + Pitz | (Teto: positive line) | いい焼き加減 |

Confirmed at both viewports for every scenario:
- No horizontal overflow (`document.documentElement.scrollWidth === clientWidth` in every case)
- FAILED reason text fully readable, never truncated
- "+0 Pitz" explicitly shown on every FAILED screen — no star row rendered at all (never a
  misleading "★☆☆☆☆")
- もう一度つくる／別のピザを作る both present and clickable on every FAILED screen
- Zero browser console errors/pageerrors across all 12 runs (6 scenarios × 2 viewports)
- D/E specifically confirm the spec's central requirement: a real but imperfect bake still PASSes
  with a visibly lower score and a mild, non-blaming character line — "avoiding the failure
  conditions is not the same as scoring well," and the reverse also holds (a technically-imperfect
  bake is not automatically a failure)

## 16. Verification

Baseline (recorded before any change, at `origin/main` SHA `37c11d3d...`): **74 test files / 1507
tests, all passing.**

After this change:

```
npx vitest run   -> 76 test files / 1540 tests, all passing (74+2 files, 1507+33 tests)
npx tsc -b        -> clean, no errors
npx oxlint        -> clean, no warnings
npm run build     -> succeeds (vite build, 90 modules transformed)
```

Test count increased (never decreased) — the +33 are the two new Completion Gate test files
(19 + 14); every pre-existing test file's own test count is unchanged except the handful of
fixture updates listed in §13, which repurpose an existing test's assertions rather than removing
it.

## 17. Known risks / follow-ups

1. **Lunch Rush is explicitly out of scope this phase** (§11) — a FAILED pizza mid-Mission-run
   still registers and advances exactly as before. This is a deliberate, documented deferral, not
   an oversight, but it does mean Lunch Rush and FREE now have visibly different failure
   semantics for the same underlying pizza until a follow-up phase addresses it.
2. **Starter Grant interaction with a harder failure floor**: a player who repeatedly fails a
   newly-unlocked recipe now spends its Starter Grant stock (finite ingredients are still
   consumed on FAILED, §9) without ever registering a completed round. Since the Completion
   Gate's own PASS floor (minCount, a real sauce application, a bake inside a ±10-point-wide
   margin) is well inside what a reasonably careful first attempt should clear, this is judged a
   low risk for Chapter 1's existing 11 recipes — but it is a real interaction Economy Tuning 2 (if
   one happens) should re-examine with actual play data, not just this report's own reasoning.
   Per the task's own Scope Guard, `STARTER_STOCK_PLAYS_CHAPTER_1` (10) is unchanged in this PR.
3. **The APPLY_SAUCE-empty-deposits exemption** (§6) is a defensive branch for an action that is
   effectively unreachable from the real UI today. It is safe (never produces a false PASS in
   real play) but is worth removing in a later cleanup once/if `APPLY_SAUCE` is retired outright,
   so the exemption's own justification does not silently rot into "reachable again" without
   review.
4. **Bake margin ratio (0.5) and sauce ratio (0.275/2) are Phase 1's own first calibration**, not
   the product of dedicated Human Feel iteration the way the *existing* Sauce/Bake tier
   boundaries were — both are explicitly derived from pre-existing evidence (the zone's own
   width; half of the existing "poor" tier boundary) rather than freehand numbers, but real player
   data may still want to adjust them later.

## Final Verdict

**A. COMPLETION GATE READY TO MERGE**

All spec requirements implemented and verified: the gate is pure and independent of Scoring 2.0,
every threshold is derived from existing recipe/Reference data (no per-recipe magic numbers),
FAILED semantics are enforced exactly as specified (0 Pitz, no ★, no Dex/progression/Starter
Grant, inventory still consumed), PASS semantics are byte-for-byte unchanged, all 11 recipes are
covered, Lunch Rush's deferral is an explicit and justified decision rather than a gap, the full
test suite is green with a net test-count increase, and mobile Human Feel across both target
viewports confirms the FAILED RESULT screen is legible, honest about the 0 Pitz outcome, and never
misread as a normal ★1 result.
