# DRIZZLE #579 — gameplay integration decision brief (2026-11-04)

Status: **design only / HOLD**. Audit base main `0016222145c4c88253380d53d5df40607f58e655`. Parallel with #746 independent gesture lab; do not modify #746.

## Findings from source
- `gameReducer.ts`: FINISH rejects non-topping categories and the squeeze trail normalization is disabled in FINISH.
- `pizzaState.ts`: toppings support `stage: pre|post`, but `sauceIds` and `sauceDeposits` do not have a post-bake liquid role.
- `inventory.ts`: `consumePizzaInventory` charges pre-bake `sauceIds`; `consumePostBakeInventory` charges only post-stage topping pieces.
- `pendingRound.ts`: journal explicitly serializes and validates toppings, sauce IDs and deposits. A new placement collection would not automatically survive a reload.
- `pendingRoundSettle.ts`: recovery retains already-debited stock and does not re-debit. Any FINISH liquid debit must be recorded atomically and idempotently.
- `recipeComponent.ts` and discovery signature: ingredient identity combines sauce IDs with topping IDs but lacks liquid timing semantics.

## Options (not decisions)
| Choice | Benefit | Risk | Recommendation |
|---|---|---|---|
| A: Put late liquid into `sauceIds` | Small initial diff | Misclassifies as base sauce; early stock debit; scoring and signature confusion | Reject |
| B: Represent as `toppings` with `stage:post` | Reuses inventory/late signature | Violates piece vs continuous-liquid semantics; quantity/scoring inaccurate | Avoid as canonical |
| C: Add explicit `postBakeLiquids` to `PizzaState` and journal | Preserves stage, stroke, identity, stock roles | More compatibility and test work | Preferred **design candidate** |

### Proposed C data contract for review
`PostBakeLiquid = { id: string; ingredientId: string; trail: readonly {x:number;y:number}[]; stage:"post" }`. Canonical data should be bounded and sanitized; no DOM event/time/gesture ephemeral state in saves. Choose whether one stroke is one unit or multiple strokes per one application **before** inventory implementation. This is a sketch, not approved TypeScript.

**Save compatibility gate:** demonstrate old v2 save loads with missing `postBakeLiquids` as empty, new v2 journal is readable or safely rejected by older builds without data loss, pendingRound byte cap stays valid, and unknown/future schema never gets overwritten. A root schema bump is not automatically necessary; tests decide.

**Atomic debit gate:** record the post-bake liquid application and its stock debit in one durable state/save transition. Verify retries, HOME-leave settlement, app reload before and after FINISH, and duplicate actions cannot charge twice or grant free ingredients. The current journal settlement preserving base stock makes this mandatory.

**Scoring/identity gate:** define late-liquid role in Reference, recipe component and signature late axis without conflating base sauce. Preserve existing Scoring 2.0 component weights; test PAINT/NO_SAUCE and pre/post coexistence.

## Owner decisions needed
1. First recipe and liquid ingredient (no unverified new ingredient or recipe).
2. Canonical model option (C proposed).
3. Quantity: per stroke, per application, or per ingredient.
4. Save backward/forward compatibility acceptance and whether schema v2 remains.
5. Scoring / Reference and late signature semantics.
6. Tap fallback behavior and accessibility acceptance from actual iPhone #746 HV.
7. Production/Free/Research exposure; Dinner/Lunch Rush remain OFF initially.

## Proposed implementation slices after Owner GO
D1 type + pure geometry/sanitization + tests; D2 journal roundtrip and recovery; D3 stock atomicity; D4 scoring/signature/reference; D5 FINISH UI integration + real-device HV; D6 exact-head CI/Codex and Owner rollout. Each slice separately gated. No merge, Preview update or Production ON is implied.
