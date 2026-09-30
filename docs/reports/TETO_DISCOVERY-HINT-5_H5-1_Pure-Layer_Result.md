# Discovery Hint 5.0 — H5-1 Pure Layer: Result

- **Issue:** #292.
- **Authority:** `docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md` (Owner Decisions rounds 1–4).
- **Base `main`:** `86b48fd`.

**Scope:** the unwired pure layer and its gates only. Nothing below touches:
- the reducer, the UI or save / persistence;
- a feature flag;
- a taxonomy row or family (the only taxonomy change is a comment);
- P4 / P4b / M2;
- PR #291 / #293 / #295, TQ-1D, #275 or #260.

Human Verification does not apply: there is no UI or gameplay change, and no production module
imports the new layer.

## Files

| File | Change |
|---|---|
| `src/data/recipeHintRoles.ts` (new) | `RECIPE_HINT_ROLES: Readonly<Record<RecipeId, RecipeHintRoles>>`: the 25 key toppings and sub-topping orders (C1a / C1b / C1-P) |
| `src/data/hintClassDisplay.ts` (new) | `HINT_CLASS_DISPLAY`: symbol + label for the 7 existing families (C4 final) |
| `src/logic/discovery/hint5Ladder.ts` (new) | Covers:<br>• `buildHint5Ladder`<br>• `hint5RolesValid` (G17 / G22)<br>• `subToppingClass` (fail-fast)<br>• `hint5Ownership` (§9.1 read-time mapping)<br>• `requestHint5Rung` (the single request authority)<br>• `hint5Presentation` (the privacy-safe view model)<br>• `HINT5_RUNG_PRICE` (P-C) |
| `src/data/ingredientTaxonomy.ts` | **Comment only.** It notes that Hint 5.0 does not coarsen a missing family (PR #293 F-2). |
| `src/logic/discovery/hint5Ladder.test.ts` (new) | Ladder generation, G20, G19, G-PRICE, G21, G9, G10 and requests |
| `src/logic/discovery/hint5Ladder.migration.test.ts` (new) | The §9.1 rows, E3b, M1, G12 / G13 |
| `src/logic/discovery/hint5Taxonomy.gate.test.ts` (new) | The authority pin, G17, G1, **G24**, **G22**, G2, **G23**, G18 and G16 |
| `src/logic/discovery/hint5Production.gate.test.ts` (new) | AC-1 / G4, G3, P1 / P2 singletons, G5, G6, G15, the G7 TQ-1D tripwire, and "unwired" |
| `src/logic/discovery/deductionHint.test.ts`, `deductionGuard.test.ts` | The DH4 import-boundary allowlists add the Hint 5.0 readers (`hint5Ladder.ts`, `hintClassDisplay.ts`), sanctioned by Final Design §14 |

## Behaviour

- **Rungs.** The rungs run SAUCE (every sauce) → CHEESE (every cheese) → KEY_TOPPING → STRUCTURE →
  SUB_CLASS ①..ⓝ.
  - They follow the authored `hintSubToppingOrder`, never `requiredIngredients` order. A test
    reverses that order and checks that the ladder does not change.
  - The rungs are strictly linear: the `expectedRungIndex` echo refuses a stale or double request.
- **Price (P-C).** 10 / 10 / 10 / 5 / 5, by rung kind only, with no cap.
  - Full ladders cost: pepperoni 35, hawaiian 40, capricciosa 50, meat-lovers 50.
  - The Dex-0 Margherita onboarding is 0 and never persisted.
- **Empty fixed rungs.** marinara, fugazza, pizza-bianca, pesto-tonno and puttanesca (CHEESE), and
  quattro-formaggi (KEY_TOPPING), return `RESERVED_EMPTY_RUNG` (0 Pitz, no fact). The rung is **not
  skipped**, so P4 / P4b are not pre-empted.
- **Taxonomy.**
  - A sub-topping without exactly one valid family makes the recipe `NOT_A_TARGET` (0 Pitz, no
    fact). It never becomes existence, group or category.
  - All 25 production recipes are targets.
- **Classification.**
  - It shows the family symbol and label only (for example 「🥩 肉系」).
  - It has no k rule: the answer never depends on the owned set, so the singleton families
    (other = egg, spice = capers, fruit = pineapple) are shown as labels.
- **Stored ids.** Requests only return ids to append (`ing:`, `meta:ingredient-total`,
  `cls:<ingredientId>`), all within the persisted fact grammar.
  - Stored `attr:*` / unknown / future ids are never touched.
  - Coarse `attr:group` / `category` facts grant nothing (E3b), and neither does the Hint 3.0 free
    key (M1).

## Verification

| Check | Result |
|---|---|
| Hint 5.0 tests (4 files) | **47 / 47** |
| Full Vitest | **219 files · 4556 passed · 1 skipped** (the skip is pre-existing) |
| `tsc -b` | clean |
| `oxlint` | 0 errors; the 2 pre-existing warnings in `scoringV2.noSauceProfile.test.ts` |
| `vite build` | OK |
| Mutation check (not committed) | 9 / 9 detected: <br>• a fruit symbol = the pineapple glyph<br>• capricciosa's key reverted to oregano<br>• the SUB_CLASS price set to 0<br>• an empty rung skipped<br>• a missing family coarsened to `other`<br>• the STALE check removed<br>• SUB entries shown before STRUCTURE<br>• the sub id leaked in the class line<br>• a coarse `attr:` fact granting a rung |

**Figures:**
- **AC-1 / G4:** 76 cases. That is 19 sub-toppings of the 13 unblocked recipes that have one, each
  as the last unsettled rung, times 2 ways of settling the other subs (bought classification or
  legacy name), times 2 Dex counts.
- **G16:** of the 120 complete rows in the 172 matrix, 36 (all runtime ingredients) build a ladder.
  The other 84 fail closed.

**E2E:** not run. No UI, DOM or runtime path changed, and the layer is unwired.

## Notes for H5-2 / H5-3

- **pepperoni:** its key-topping name equals the recipe name (ペパロニ). Showing it after the
  KEY_TOPPING rung is bought is an ingredient the player paid for (P3). G6 allows exactly that
  case and nothing else.
- **Partly known multi-cheese rung:** a legacy `ing:mozzarella` on parmigiana leaves the CHEESE rung
  open, as §9.1 says. The open rung tells a player who already knew mozzarella that another cheese
  exists. This comes only from legacy data. G15 covers fresh ledgers only, so H5-3's FREE LEAK
  review should look at it.
- **Still to do:** the reducer wiring, the flag, the economy simulation (H5-2), the UI and its
  Human Verification (H5-3), and the P4 / P4b / M2 enable list (H5-4).
