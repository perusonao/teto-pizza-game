# Cooking Steps 2.0 — PR-C (CS-1b `finalizeRound`) Result

Base: `main` @ `cbf3e37829405a29bb9fe5a9cab5fb9b9e79fb85`.
Authority: `docs/design/TETO_COOKING-STEPS-2.0_AUTHORITY-INDEX.md` §3 (PR-C row); Issue #294 (OD-CS-20), Issue #465 item 8.
Owner decisions kept as-is: OD-CS-1 = A, **OD-CS-2 = B (not implemented here; only left possible)**, OD-CS-9 (a), OD-CS-20.
No open decision (OD-CS-3 / 7 / 11 …) was filled in.

## 見た目・操作・結果は変わりません

This is an internal refactor. **Nothing the player sees or does changes**: no component, CSS, copy, layout, e2e spec,
recipe, ingredient, ladder, save or scoring file is touched; the reducer returns the same values it returned before.
Evidence is the byte-identical before/after below, not a screenshot. Human Verification is not required
(`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` §2: 内部 refactor のみ（見た目/操作が変化しない）).

## Scope

| File | Change |
|---|---|
| `src/state/finalizeRound.ts` (new) | Pure `finalizeRound(input)`: free-cook identification, Scoring 2.0 + legacy `ScoreBreakdown`, Completion Gate, bake classification, the one `consumePizzaInventory`. Returns `SCORED` or `UNMATCHED_FREE_COOK`. No input is mutated. |
| `src/state/gameReducer.ts` | `CONFIRM_BAKE` calls `finalizeRound` once. The finalization code that was inline is removed (and its now-unused imports). |
| `src/state/finalizeRound.test.ts` (new) | Equivalence test (below), 22 tests. |
| `src/state/testSupport/confirmBakeMatrix.ts` (new) | Test-only builder: every recipe's Reference pizza on a BAKE-phase round of each mode. |

## Stays in `CONFIRM_BAKE` (unchanged, by design)

- the phase / making-step transition, including the #256 post-BAKE skip (`bakeCompletionFailure(completion) ? [] : postBakeSteps(...)`);
- cooking-timing (`advanceStepTiming`);
- the non-MATCHED Free Cooking side effects: the `preDiscoveryFreeCookAttempts` counter and the failed Research trial / Trial Notebook record;
- the `state.phase !== "BAKE"` guard that makes consumption exactly-once;
- the Dinner wrapper (`dinnerGuardedReducer`, `dinnerStartBake`, `cutWaivedFor`), which still reads the base reducer's result.

`finalizeRound` takes the recipe, pizza, bake value, round kind, Dex and inventory as arguments; it does not read `GameState`, and has no
provisional / final parameter. OD-CS-2 = B can later be added without changing the existing call (not implemented).

## Before / after proof (one-time, on the original code)

The original `gameReducer.ts` and the extracted one were each run through the same scenario builder and the **entire `GameState` after
`CONFIRM_BAKE`** was serialized:

- 55 recipes (`RECIPES`, derived) × 4 modes (guided, Free Cooking, Lunch Rush, Dinner) × 2 pizzas (full Reference; one piece per ingredient) × 3 bakes (raw, good, burnt) = 1320 cases;
- plus 4 Free Cooking pizzas the matcher does not resolve (empty, lone piece, sauce only, odd mix) × 3 bakes = 12 cases (the non-MATCHED branch, which Reference pizzas cannot reach);
- **1332 cases, byte-identical** (`sha256 8ed73286…5e02` on both sides; before = original `gameReducer.ts` with the change stashed).

Outcome coverage of the matrix (so the equality is not vacuous): FAILED and PASS completions in every mode; `RESULT` and `POST_BAKE` (CUT kept
for a composition-only failure, skipped for a bake failure); Dinner resolved at RESULT and held at POST_BAKE; Lunch Rush's "order" policy failing a short pizza that guided passes.

This is a transitional proof and is **not** committed as a snapshot (see next section).

## No snapshot to regenerate when a recipe is added

`finalizeRound.test.ts` keeps the pre-extraction algorithm as a test-only oracle (`legacyFinalize`, built from the same primitives) and compares it with
`finalizeRound` and with the real reducer for every entry of `RECIPES` in all four modes. The recipe list, the mode list and the bake list are derived;
no fixture file, no count (the `RECIPES.length > 0` check is the only size assertion). A new recipe joins the matrix automatically, and a recipe PR never has to regenerate anything.

Other invariants asserted: the #256 skip and the first post-BAKE step; a repeated `CONFIRM_BAKE` returns the same state (nothing consumed twice); purity.

Mutation checks (each fails the suite, then reverted): Lunch Rush "order" policy replaced by "recipe" (2 failures); inventory consumed twice (1 failure); matched free-cook judged by the recipe window (1 failure).

## Verification

| Check | Result |
|---|---|
| `vitest run src/state/finalizeRound.test.ts` | 22 passed |
| related regression: `vitest run src/state src/mission src/logic src/data src/screens` | see PR (filled after the run) |
| `tsc -b` | pass |
| `npm run build` | pass |
| `oxlint` | no findings in the changed files (pre-existing warnings in unrelated files only) |
| Chromium / WebKit E2E, Layout Contract | CI on this PR (no e2e spec is modified; no UI file is touched) |

## Conflict check (before starting)

Open PRs #487, #478, #468, #391, #321 and #295 were checked by file list: none touches `gameReducer.ts`. #295 and #478 touch `GameScreen.tsx` / `cookingProfiles.ts`;
this PR touches neither. None of those PRs is changed.

## Not done (out of scope)

FINISH / TQ-2 / TQ-3, `applicationPhase`, any recipe / ingredient / ladder change, any CUT judgment change, OD-CS-2 = B itself, a PROJECT_HANDOFF addendum
(left to a single later docs update, as recommended in the Authority Index, to avoid the handoff conflict hotspot).

Next (Issue #465 item 10): FINISH engine — blocked on OD-CS-3, OD-CS-11 and OD-CS-7 (= UD-H).
