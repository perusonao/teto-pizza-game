# TQ-1C — Cooking Technique runtime wiring: Result Report

Issue #287 · Owner Decisions OD-TQ1C-1 / 2 / 3 (APPROVED, 2026-09-28).
Authority: `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md` and
`docs/design/TETO_COOKING-TECHNIQUES_1.0_TQ-1C_PRE-IMPLEMENTATION-GATE.md` (both landed on main via TQ-1C-0, #286).

## What changed

| File | Change |
|---|---|
| `src/logic/techniques/runtime.ts` (new, pure) | `resolveRoundTechniques`: the per-round technique step. `techniqueRoundEligibility`, `initialTechniqueLedger` (INV-TQ-1 at load), and `productionTechniqueContext` (the runtime catalog plus the ladder, injectable in tests) |
| `src/state/gameReducer.ts` | `GameState.discoveredTechniqueIds` (known ids) and `lastTechniqueDiscovery` (transient). Both are carried through every round, and the reveal is reset every fresh round. REGISTER_TO_DEX runs the technique step at **both exits** (ORIGINAL and matched recipe), in the same transition as the Dex. `createInitialGameState` gets a trailing `discoveredTechniqueIds` parameter |
| `src/App.tsx` | Hydrates the ledger through `initialTechniqueLedger(save.discoveredTechniqueIds, save.dex)`. The persistence effect passes `discoveredTechniqueIds` in **the same snapshot** as the Dex and re-runs when it changes |
| `src/state/discoveryReveal.ts` (new, pure) | `discoveryRevealOrder` → `["TECHNIQUE", "RECIPE"]` (SSOT P5). It is not rendered yet; TQ-1D renders it |
| `src/state/materialEntitlement.ts` | `ingredientUnlockStep`: the technique affordance reads the ladder through this existing bridge, so the ladder boundary test is unchanged |

The technique step (SSOT P8, OD-TQ1C-3):

- **Usage path:** Free Cooking only. Also requires a Completion Gate PASS and an open affordance. The affordance reads the Dex *before* the round.
- **Recipe path (INV-TQ-1):** every FREE round, guided included. It follows the Dex this transition wrote.
- **Lunch Rush and Dinner:** nothing on either path. Dinner is also refused REGISTER_TO_DEX by two existing reducer guards.

**Not changed:**

- the near-miss copy, and no k-rule wiring (OD-TQ1C-2: TQ-1D with HV);
- scoring, Reference, recipes and the catalog;
- `ReferencePizza.sauce`;
- UI, CSS and E2E specs;
- #275 and #260.

## INV-TQ-4: inert in production

With the production context, **no catalog target requires a technique**. So the NO_SAUCE affordance is `null`, the usage path never opens and the recipe path adds nothing.

Verified by:

- **Reducer:** Free Cooking with every one of the 25 recipes' ideal pizzas, plus a no-sauce original pizza.
- **Pure level:** every eligibility × signature combination, with every recipe discovered.
- **App:** a real Free Cooking round through the UI; the save has no new id.

### UI-visible change: 0

- No component or screen reads technique state. An architecture test pins that the only readers are the reducer, App (hydrate + persist), the reveal selector and persistence.
- The App test asserts no technique copy appears on screen.
- The existing E2E specs all pass.

Under `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` this change has no UI/UX/gameplay effect, so **no new Human Verification is needed**. The first visible change is TQ-1D, which carries the HV.

## Tests (gate §8)

| # | Test |
|---|---|
| T1 / T2 / T3 | First discovery (ORIGINAL, affordance open; Dex, ★ and Pitz unchanged). The next round starts with no reveal and no rediscovery. A duplicate REGISTER_TO_DEX changes nothing. File: `gameReducer.techniques.test.ts` |
| T4 | A requiring recipe records its technique in the same transition, even with the affordance closed. The recipe side equals the production baseline exactly. An already-known technique is not revealed again |
| T5 | `discoveryRevealOrder`: every combination (`runtime.test.ts`, reducer T4 / T10) |
| T6 | Affordance closed → nothing recorded (INV-TQ-6) |
| T7 | Nothing recorded for: raw or burnt (Completion Gate FAILED) on both paths; an empty pizza; a missing completion on the ORIGINAL and matched paths |
| T8 | Lunch Rush: REGISTER_TO_DEX and MISSION_NEXT_ORDER leave the ledger unchanged |
| T9 | Dinner: a no-sauce pizza and a requiring recipe → ledger unchanged, REGISTER_TO_DEX refused (also with an injected score + PASS), `DINNER_EXIT` unchanged |
| T10 | A guided FREE round that discovers another recipe (Breakfast on Bismarck) records that recipe's technique. A guided round of a known recipe records nothing |
| T11 | One save write. After a reload the ledger is kept, the reveal is not replayed and nothing is rediscovered |
| T12 | Full Reset clears the ledger |
| T13 | A future id stays in storage; gameplay reads known ids only (reducer and App) |
| T14 | DM-4-3: a refused Dinner record stores nothing, the new technique included. After the reconcile, the ledger and the Dex are stored together |
| T15 / T15a | The near-miss copy is unchanged and `resultNearMiss` has no k-rule wiring. The audit baseline is pinned: **44 SAUCE_ONLY cases, 12 with k < 2**, all forgotten-sauce pizzas at steps 1–12 (`techniques.tq1c.test.ts`) |
| T16 | INV-TQ-4, as above |
| T17 | The whole existing suite passes unchanged, plus the Chromium E2E listed below |
| T18 | The 25-recipe × 9 parity (225 rows) passes unchanged |
| T19 | `initialTechniqueLedger` repairs a save; a no-op for every production save |
| T20 | Architecture: UI never mentions technique state; only 4 runtime readers (see above) |
| App | `App.techniques.test.tsx`: a real Free Cooking round through the UI, then the save (synthetic and production context) |

## Mutation check

Done by hand, then reverted. Each mutation was run against the new tests.

| Mutation | Tests that fail |
|---|---|
| M1: usage-path affordance ignored | 4 (T6, T16 ×2, affordance-timing) |
| M2: Lunch Rush guard removed | 2 (T8, eligibility) |
| M3: Dinner guards removed (eligibility, per-case backstop and the Dinner action guard) | 2 (injected-PASS Dinner, eligibility) |
| M4: reveal not reset per round | 2 (T2, T11) |
| M5: ledger dropped from the persist deps | 1 (App wiring) |
| M6: completion forced to PASS | 1 (T7, missing completion on the matched path) |
| M7: recipe path removed | 6 (T4, T10, T14, App, pure ×2) |

M5 and M6 first survived. Fixing them tightened two tests, and changed the design in one place: the recipe path no longer depends on the completion, because INV-TQ-1 must hold for whatever the Dex says.

## Verification (local)

- **`npx vitest run`:** 214 files, 4489 passed, 1 skipped.
- **`tsc -b`:** OK.
- **`oxlint`:** only the 2 existing `erasing-op` warnings in `scoringV2.noSauceProfile.test.ts`.
- **`vite build`:** OK.
- **Chromium E2E (`iphone-390x844`):** 37 / 37 passed. Specs: free-cooking-phase3-2, discovery-near-miss-result, discovery-dex-hint, dinner-mission, dinner-settlement-dm4-3, save-dinner-records-dm4-2, save-forward-compat-3-4b, progression2-discovery-ladder, lunch-rush-material-shortage, result-1screen-2.0.
- **WebKit:** runs in CI.

## Revert

Revert this PR alone. It is inert in production, and a ledger key it may have written is kept by the forward-compat merge of older builds.
