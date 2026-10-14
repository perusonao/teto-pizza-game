# Cooking Steps 2.0 — FINISH engine: Owner Decisions (2026-10-14)

Primary record: Issue #294, Owner comment "Owner Decision 確定 — FINISH engine / CS-2 (2026-10-14)"
(https://github.com/perusonao/teto-pizza-game/issues/294#issuecomment-6151628498). This file mirrors it for the repo; the
Issue comment stays the primary record.

| ID | Decision |
|---|---|
| **OD-CS-3 = A** | A late addition is specified on the recipe: `RecipeRequirement.applicationPhase?` (`"POST_BAKE"`). Absent = before the bake. Never a flag on an ingredient and never a new ingredient category, so no category / hint fact can reveal a late addition. |
| **OD-CS-11 = A** | Late pieces are scored by the existing Pieces / Recipe components. No FINISH bonus; the 52/16/12/20 weights, the ruleset and ranking compatibility (`lunch-rush-v1`) do not change. |
| **OD-CS-7 = A** (= UD-H) | When `bakeCompletionFailure()` reports a failed bake (UNDERBAKED / OVERBAKED), FINISH is skipped and the existing failure flow is kept. No new threshold. A composition-only failure does not skip FINISH. |

Unchanged decisions: OD-CS-1 = A, OD-CS-2 = B (provisional at CONFIRM_BAKE, final after FINISH), OD-CS-9 (a) (6-tab ceiling), OD-CS-20.

## Scope of this approval

Approved: the internal engine and its preparation. **Not** approved by it: enabling FINISH on any Production recipe,
TQ-2 / TQ-3, a 7-tab UI, the FREE finish UI (UD-B), Dinner / Lunch Rush handling (UD-I), merge, deploy.
Still open: OD-CS-4..6, 8, 10, 12..19; UD-B, D, E, F, G, I.

## Implementation slices

| Slice | Content | State |
|---|---|---|
| **D1a** | Pure layer: `applicationPhase`, `PlacedTopping.stage`, FINISH step derivation, post-only stock gate / consumption, FINISH-only Undo rule, `withoutPostBakeRequirements`, backward-compatible `finalizeRound({ finalization })`, test-only BBQ-shaped fixture | this PR |
| D1b | Reducer wiring (`PLACE_TOPPING` / `UNDO_LAST_PLACEMENT` / `CONFIRM_BAKE` / `CONFIRM_MAKING_STEP`); transient `bakeValue`; PROVISIONAL at CONFIRM_BAKE, FINAL once on leaving FINISH; Dinner fail-closed. Fixture only, `RECIPES` untouched (Owner approval 2026-10-14) | this PR |
| D2 | Render / UI (`PizzaStage`, `GameScreen`, tray) — after #468 / #487 / #478 settle; Human Verification required | not started |

## D1a guarantees (asserted by `src/state/finishEngine.test.ts`)

- No `RECIPES` entry has a late requirement; no Production profile (guided or Free Cooking) contains FINISH. Lunch Rush and Dinner are excluded fail-closed until UD-I.
- `deriveCoreSteps` is unchanged for every `RECIPES` entry (oracle); `withoutPostBakeRequirements` returns the same object for them; `finalizeRound` with an absent / `SINGLE` / `PROVISIONAL` finalization is deep-equal for every `RECIPES` entry in all four modes.
- Inventory: the FINISH pieces are the only ones charged after the bake (no double count of an ingredient used before and after); provisional + FINISH consumption equals one whole-pizza consumption. The consumption function is pure and not self-idempotent: D1b must apply it once, on the transition that leaves FINISH.
- A recipe with a late requirement is judged without it at CONFIRM_BAKE and with it after FINISH; zero late pieces is a FAILED result, not an inherited success.
