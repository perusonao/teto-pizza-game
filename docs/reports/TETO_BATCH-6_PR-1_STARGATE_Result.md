# Batch 6 PR-1 (#420 / PR-C) — starGate foundation: Result Report

- Base: `main` @ `97afde6b8b166ef8ffc82cd88490fc6f049bdfaf`
- Authority: Issue #420 OD-420-1 (goat-cheese = Step 50 AND 120⭐, spinach = Step 51 AND 130⭐), #422 OD-DISPLAY-1/2. Nothing re-designed.
- Gate: #418 closed/completed via PR #425 (merged).
- Duplicate check: no open PR/Issue implements starGate (open PRs are #391/#321/#296/#295/#293/#255/#219/#218/#217/#214, none related).

## Scope (PR-1 only)
Foundation for star-gated material unlocks. **No ingredient, recipe, ladder step, data row or UI is added** — the production ladder has no `starGates` yet (pinned by a test). The 4 ingredients / 2 recipes and the unlock-notice UI are later PRs.

## Design (案α: per-ingredient gate on the Ladder step)
- `MaterialProgressionStep.starGates?: Record<ingredientId, number>` (`src/data/discoveryLadder.ts`). Listed ingredient unlocks when the step is reached AND `totalStars(dex) >= gate`; unlisted ingredients are unchanged. The legacy `Ingredient.unlockCondition.minTotalStars` path is not reused.
- `ladderUnlockedMaterialIds(ladder, count, totalStars = 0)` + `meetsStarGate` (`src/logic/discoveryLadder.ts`). Default 0 / non-finite / negative → gated stays locked.
- `resolveShopEntitlement` derives `totalStars(dex)` (existing `logic/mastery.ts`, Dex BEST stars sum) on every call.
- `validateDiscoveryLadder`: a gate must name an ingredient of its step and be a positive integer.

## Requirement mapping
| Requirement | How |
|---|---|
| Cumulative-star unlock | `totalStars(dex)` ≥ gate, AND step reached |
| Backward-compatible saves | No save field/schema change; derived from Dex on every load/reducer call, so existing saves are evaluated retroactively. Ungated behaviour byte-identical |
| Persistence & idempotence | Result lands in the existing `unlockedForShopIngredientIds` ledger; feeding it back returns the same reference and no new ids |
| Never re-lock | Entitlement is a union; test lowers stars after unlock → still unlocked |
| Stars not consumed | Read-only derivation; test asserts Dex unchanged |
| Lunch Rush | No Lunch Rush/scoring/reward code touched; all callers (reducer REGISTER_TO_DEX / MISSION_NEXT_ORDER, App load) keep their signature |

## Not done (by design)
Notification UI, the "⭐あと○個" copy, Step 50/51 data, Anti-Oracle/Shop display changes. Duplicate-notice prevention for load/Lunch Rush is deferred to the PR that adds the notice (OD-420-1 asks for detail review before then).

## Tests
`src/state/materialEntitlement.starGate.test.ts` (8): below/at/above gate, step-not-reached, retroactive existing save, idempotence, no re-lock, newly-unlocked reported once, no star consumption, NaN/negative/Infinity safety, production ladder ungated, gate validation.

## Human Verification
Not applicable: no visible UI/UX/gameplay change (pure logic foundation, no gated data in production). No video/screenshots, no Preview.
