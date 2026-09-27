# Wave 2 W2-A1 — W2-A materials + visuals (catalog-only): Result

Authority: `docs/design/TETO_WAVE2_OWNER-DECISION-LEDGER.md` (OD-W2-5, A5, A6, A7) and the approved values in
`tools/wave2-w2a/w2a_authoring_candidates.json`. Base: `main` `7bb0116`. Branch `claude/wave2-runtime-recipe-design-os06j1`.

## What changed (production)

| File | Change |
|---|---|
| `src/data/ingredients.ts` | 8 finite rows appended last (A7: existing tray order untouched): prosciutto-crudo, fromage-blanc-sauce (`#eef1f4`, A5), arugula, shrimp, chicken, parsley, bell-pepper, zucchini. `DedicatedIngredientVisual` gains `prosciutto-fold` / `parsley-sprig`. Arugula / parsley are `bakeRoastResistant` like basil. No legacy `pricePitz` / `restockQuantity` (priced by the ladder tier, like W1). |
| `src/components/IngredientGlyph.tsx` | Two in-code SVGs (A6): a folded cured slice (not 🥓 bacon / 🍖 ham) and a flat-leaf parsley sprig (not 🌿 basil·pesto / 🍃 oregano / 🌱 rosemary). No external asset. |
| `src/data/ingredientTaxonomy.ts` | 7 topping family rows (OD-W2-5, consistent with PR #255): prosciutto-crudo / chicken → meat, arugula / bell-pepper / zucchini → vegetable, shrimp → seafood, parsley → herb. |
| `src/data/recipeSauceProfiles.ts` | `ingredientId` union adds `fromage-blanc-sauce` (type only; no recipe uses it). |

**Gameplay change: none.** No recipe uses the 8 materials and the ladder does not contain them, so `materialOffer` is null: no Shop row,
no unlock notice, no entitlement, not counted in 所持 N/M (still 29). Saves are untouched (a save that already held these ids kept
them via the P3-4B forward-compat extras; now they are simply known ids).

## Tests

- Pins updated where they counted the catalog (29 → 37 rows; obtainable stays 29): `ingredients.test`, `IngredientGlyph.test`,
  `InventoryOverlay.test`, `economySimulation.test`, `w1LadderEconomy.test`, `ingredientCollectionCount.test`, `App.test` (the 8 have no
  Shop offer). New: W2-A material rows / visuals / colour / taxonomy / no emoji clash (A6).
- DH4 test support (`deductionInversion.ts` `ALL_INGREDIENT_IDS`, `deductionAudit.ts` comparison universe) now means "every catalog
  ingredient a runtime recipe uses" instead of the raw catalog, so catalog-only rows (unownable) do not enter the DH4 universes. The
  committed DH4-1 / DH4-2A audit JSON are byte-identical.
- `npx vitest run`: **195 files / 4141 passed, 1 skipped**. `npx tsc -b` PASS. `npm run lint` PASS.

## Visual verification (static; the materials are not reachable in play yet)

`npx playwright test -c tools/wave2-w2a/playwright.probe.config.ts tools/wave2-w2a/visual.spec.ts` seeds a save that owns the 8 rows and
draws them in the real Free Cooking screen at 390×844 and 360×800: SAUCE tray (4 sauces, 1 page), white sauce painted, TOPPING tray
pages 4–5 of 5, the new pieces on the dough next to bacon / ham / basil / oregano, and RESULT after BAKE.
Screenshots: `docs/reports/screenshots/wave2-w2a1-visual/`. Owner Human Verification of the art happens with W2-A2 (HV gate).

## Revert

Revert the W2-A1 commit alone: the rows are unused, nothing is persisted by this change.
