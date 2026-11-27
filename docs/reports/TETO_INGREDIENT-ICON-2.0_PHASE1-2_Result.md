# Ingredient Icons 2.0 — Phase 1–2 Pilot Result

Issue: #417. Draft PR: #917. Base: `ea379daa`. Scope: Pilot 10 identification UI only.

## Outcome

- The Pilot contract is recorded in `docs/decisions/TETO_INGREDIENT-ICON-2.0_PILOT-CONTRACT.md`.
- Pilot 10: tomato-sauce, mozzarella, basil, bacon, mushroom, salmon, ricotta, hot-dog, pineapple, olive-oil.
- `iconVisual` separates identification UI from pizza-surface art. Selection UI resolves `iconVisual -> pieceVisual -> emoji`; placed pieces continue to resolve only `pieceVisual -> emoji`. This keeps #824 outside this change.
- Mushroom is a brown/beige edible button-mushroom pair without a red cap or white poison spots.
- Hot-dog remains three smooth uniform rounds; sausage remains two irregular coarse-cut pieces.
- Mozzarella is a tied ball; ricotta is a granular mound. The contract reserves jagged aged-cheese geometry for parmigiano.

No ingredient ID, recipe, price, inventory, progression, Research rule, or save schema changed.

## UI and privacy

The shared renderer is already used by Shop, Cooking Tray, Research Board, Hint, Notebook, RESULT ingredient list, Inventory, and Dex. Focused component tests cover those paths. The E2E covers Shop, Dex, Cooking Tray, Hint and Notebook at both required viewports.

Research privacy remains state-authoritative: the SVG is rendered only after the existing projection supplies an ingredient object. Undiscovered recipe identity is still absent in the Dex scenario. `DexOverlay.researchIdentity.test.tsx`, `ResearchBoardPanel.test.tsx`, `HintSheet.test.tsx`, and `TrialNotebookSheet.test.tsx` pass unchanged.

## Visual evidence

Path: `docs/reports/screenshots/ingredient-icons-417-phase1-2/`.

The same Playwright scenario and save were run against base `ea379daa` (`before-*`) and PR head (`after-*`) at 390×844 and 360×800. Screens: Shop, Dex, Cooking Tray, Hint, Notebook. Hint and the empty Notebook are intentionally visually identical before/after because their current authorized state contains no named Pilot ingredient; they prove layout and privacy stability, while named-icon rendering in those components is pinned by focused tests.

The final E2E checks no horizontal document overflow. The 1.2em SVG correction uses a matching negative margin, so the layout box and tap target remain unchanged.

## Verification

| Check | Result |
|---|---|
| Focused Vitest (6 files) | PASS — 307 tests |
| TypeScript (`tsc -b`) | PASS |
| Chromium E2E, 390×844 + 360×800 | PASS — 4 tests |
| Before scenario on base, both viewports | PASS — 4 tests |
| Lint | pending final gate |
| Build | pending final gate |
| Full Vitest | pending final gate |

Existing test changes: `IngredientGlyph.test.tsx` changed its dedicated-selection predicate from `pieceVisual` only to `iconVisual || pieceVisual` and added responsibility-boundary assertions. No test was removed, skipped, or relaxed.

Owner HV remains pending. These automated captures are evidence and do not claim Owner PASS. The PR stays Draft.
