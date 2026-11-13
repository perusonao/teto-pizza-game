# STEP_ORDER Phase 1 Result

Date: 2026-11-13  
Issue: #837 (parent #796)  
Branch: `codex/step-order-phase1`  
Status: Draft / Production OFF / not wired

## Scope and contract

- Added the pure `StepOrderId = "standard" | "cheese-before-sauce"` contract, precedence
  constraints, fail-closed validation and deterministic resolver in `src/logic/stepOrder.ts`.
- `CookingProfile.steps` remains the execution-order SSOT. Unspecified and `standard` return the
  input sequence unchanged by value.
- Strict resolution rejects unknown steps, duplicate steps, unknown/missing constraint endpoints,
  self edges, duplicate edges, cycles and ambiguous topological orders.
- Resolution returns only a permutation of the input. It cannot add or remove a step.
- Partial recipes use a separate explicit adapter, `projectStepOrderContract`: it computes the
  contract's transitive closure before projecting it onto the present steps. Directly passing a
  constraint for an absent step remains an error.
- `requiredIngredients` is neither imported nor read. Its ordering is unchanged.

## Fixtures and compatibility

- Fixtures: `standard` (`DOUGH -> SAUCE -> CHEESE -> TOPPING`) and
  `cheese-before-sauce` (`DOUGH -> CHEESE -> SAUCE -> TOPPING`).
- Partial fixtures covered: no-sauce, no-cheese and no-topping.
- Every existing recipe was enumerated and both unspecified and `standard` were asserted equal to
  its current `getCookingProfile(recipe.id).steps` sequence.
- The repository-wide target remains all 27 cooking-method/process candidates. This slice changes
  no ledger, candidate, recipe, schema or capability count.

## Safety boundaries

- No HOT file changed.
- No Recipe schema, reducer, GameScreen, Research, Hint, Dex, notebook fingerprint or scoring change.
- No recipe activation and no Trenton shipping.
- No Production capability flag or runtime import/call site was added.
- No Preview or Production deployment.

## Verification

| Check | Result |
|---|---|
| Focused Vitest (`stepOrder.test.ts`, architecture test) | PASS — 2 files / 18 tests |
| TypeScript project build (`tsc -b`) | PASS |
| Existing recipe order compatibility | PASS — exhaustive over `RECIPES` in focused suite |
| Architecture guard | PASS — pure/unwired/no recipe-profile dependency |
| Full Vitest attempt | INCOMPLETE — pre-existing heavy suites exceeded the 5s per-test timeout |
| `gameReducer.dinner.test.ts` isolated rerun | 40 PASS / 1 timeout (seeded invariant, 5s limit; no STEP_ORDER import) |

The full run first reported the same seeded Dinner timeout plus downstream `App.test.tsx` timeout
failures while emitting jsdom Canvas warnings. The isolated Dinner rerun reproduced the timeout
with 40/41 passing; the changed module has no runtime consumer and the focused/type checks pass.

## Remaining gates

- Run CI on the Draft PR and record its result.
- Independent reviewer must review the final HEAD; findings, if any, must be fixed and re-reviewed.
- Owner decides whether Phase 2 may wire this contract into recipe data/runtime. That work is not
  authorized by this PR.
- Draft removal and merge require explicit Owner approval.

## Independent review

The first independent review of `cfd526b8` found two issues: non-core steps (`CUT` / `FINISH` /
reserved steps) were rejected by the cheese-before-sauce helper, and the partial-contract transitive
closure was incomplete when two or more intermediate steps were omitted. Both were fixed by
preserving every non-core step while swapping only SAUCE/CHEESE, using a full Floyd-Warshall-style
closure, and adding regressions for `CUT`/`FINISH`/reserved steps and `[DOUGH, TOPPING]` projection.
The amended final HEAD requires a clean re-review before Owner review.
