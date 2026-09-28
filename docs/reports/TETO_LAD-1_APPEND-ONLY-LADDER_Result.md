# LAD-1 — Append-only Discovery Ladder foundation: Result Report

Issue #261 · Owner Decision **OD-W2-1 (APPROVED)** · base `main` `7bb0116` (PR #264)
Final Implementation Gate: `docs/design/TETO_COOKING-TECHNIQUES_1.0_FINAL-IMPLEMENTATION-GATE.md` §3.1
(on main since TQ-1C-0, #285; the summary authority is `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`).

## What changed

| File | Change |
|---|---|
| `src/logic/discoveryLadder.ts` | New pure API: `appendLadderSteps`, `validateAppendOnlyExtension`, `validateLadderProgression` (SOFTLOCK / UNREACHABLE / STARTER_IN_LADDER / UNUSED_MATERIAL / KEY_RECIPE) |
| `src/data/discoveryLadder.ts` | `W1_FIXED_STEP_COUNT = 24`, `POST_W1_APPENDED_STEPS = []`, `DISCOVERY_LADDER = appendLadderSteps(W1_25_DISCOVERY_LADDER, POST_W1_APPENDED_STEPS)` |
| `src/logic/testSupport/discoveryLadderRule.ts` | `buildAppendOnlyLadder`: the REC-04 key-recipe rule, run only for recipes that the starters plus the W1 materials still cannot make. It appends after the fixed steps. |
| `src/logic/discoveryLadder.appendOnly.test.ts` | New: 18 tests (§Tests) |
| `src/data/discoveryLadder.test.ts`, `src/logic/w1LadderEconomy.test.ts`, `src/state/ingredientCollectionCount.test.ts` | Two pins changed. The `toBe(W1_25_DISCOVERY_LADDER)` identity pin became `toEqual`, because the ladder is now composed and is an equal copy. The "whole-ladder regeneration equals production" pin became the append-only rule. |

**Gameplay change: none.** `DISCOVERY_LADDER` is deep-equal to the W1 24-step ladder, because nothing is appended. There is no save, UI, CSS or E2E change, and no recipe was added.

## Owner requirements → evidence

| Requirement | Evidence |
|---|---|
| W1 steps 1–24 fully fixed | The first 24 steps equal `W1_25_DISCOVERY_LADDER` and the REC-04 fixture. `validateAppendOnlyExtension` catches a reorder, an edit, a key-recipe change and a removal. |
| No regeneration or reordering when content is added | A synthetic all-W1-material recipe (the Aussie shape) adds 0 steps. Negative control: a full regeneration would insert `onion → syn-all-w1` at step 3. |
| Future steps are appended | A synthetic Wave-2-shaped population appends steps 25 and 26 only. No W1 material is unlocked again. |
| Existing save semantics | For every count 0–23, the next unlock, the unlocked materials and the reached step are identical. A W1-complete save (25 discoveries) reaches step 25. An older ladder never re-locks an appended material. |
| softlock 0 / duplicate 0 / unreachable 0 | `validateDiscoveryLadder` and `validateLadderProgression` both return `[]` for production. Adversarial tests show each class is detected. |
| Unknown future ID preservation | A future material id in the stored `unlockedForShopIngredientIds` survives a load and a write of this build. This uses the existing forward-compat merge. |

## Tests

- Mutation check, done by hand and reverted:
  - Weakening the SOFTLOCK condition (`< step - 1`) fails 1 test.
  - Renumbering appended steps from base + 2 fails 6 tests.
- Full suite (Vitest), `tsc -b`, `oxlint` and `vite build`: see the PR for the final numbers on the head commit.

## Revert

Revert this PR alone. The ladder content is identical either way, and nothing is persisted by this change.

## Not in scope

- Aussie or any recipe addition (TQ-1D).
- Wave 2 content.
- The pre-existing `tools/progression2_mechanic_matrix.py --check` drift (Issue #260).
