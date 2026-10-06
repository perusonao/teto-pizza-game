# All-Owned Cooking Tray (食材庫廃止) — Targeted Audit + Result

Audited `main` SHA: `ec434dc2768e698ff6d2632aeb23bb1606009520` (PR #406 merge). Branch: `claude/pantry-removal-owned-tray-z1bpql`.
Verdict: **GO** (no HOLD condition). PR #407 (Recipe Expansion) was not touched or read.

## 1. Targeted Audit

| # | Question | Finding |
|---|---|---|
| 1 | 「食材庫」 state | App-level `handSession` (`useState`, session-only): the ingredients the player pinned into the 「手元」 (HAND, capacity 12, OD-5) per category. `HAND_ENFORCEMENT_PRODUCTION = true` since LC-R6-e. |
| 2 | save / persistence | **None.** `handSession` is never in `GameState` or the save (pinned by `catalogBoundary.test.ts`). **No schema migration is needed**; `schemaVersion` stays 2. A save carrying `handSession` / `pantry*` keys loads identically and the runtime ignores them (`persistence.legacyPantry.test.ts`). |
| 3 | Pantry UI | `IngredientPantry` sheet (search + shelf chips + stock tiles + pin toggles / 「選択中」 strip) opened from a 食材庫 button in the tray's utility row and from the Hint sheet's OPEN_POOL. Outside the pin UI it was a read-only duplicate of the tray + the Inventory overlay. Inventory / Shop keep their own screens. |
| 4 | Tray source | `trayIngredientsFor` (owned, recipe-limited unless free) → in FREE Cooking only, `resolveTrayHandIds` cut it to the HAND (≤ 12 per category). |
| 5 | Family Filter | Runs on the tray population after ownership / HAND and before pagination. Unchanged; with the whole owned list it now filters all of it. |
| 6 | Research | Research is a `FREE_COOK` round (same tray). The hand / pantry never read hint, Research Board, FAILED data or the hidden pool. |
| 7 | Guided / FREE / Lunch Rush | HAND was FREE-only (`isLargeCatalogEligible`); Guided, Lunch Rush and Dinner already had the recipe-limited (or owned-all) tray. Unchanged. |
| 8 | Onboarding | No coupling (the pantry entry needed > 6 owned in a category). |
| 9 | Inventory consumption | Display only; `CONFIRM_BAKE` / Stock Gate (`canPlaceIngredient`) untouched. Owned + 0 stock stays listed and disabled with ×0 (existing EP3 contract, `FreeCook.ui.test.tsx`). |
| 10 | DEV State Editor | No pantry / hand fields; edits `ownedIngredientIds` / `inventory`, which the tray derives from. Its unit + e2e tests pass. |
| 11 | Tests presupposing pantry selection | See §4. |

## 2. What changed (production)

- `HAND_ENFORCEMENT_PRODUCTION = false` (`handPolicy.ts`): the Cooking Tray is every OWNED ingredient of the step (paged 6 per page, Family Filter on 具材). The mode filter (Guided / Lunch Rush recipe-limited tray) is applied exactly as before. 0-stock owned stays listed / disabled.
- The pantry is removed from the cooking screen: `IngredientPantry`, `pantryViewportFit`, `pantrySearchIme`, `pantryAvailability` and their CSS are deleted; the tray's 食材庫 entry, the dock's `pantryWorthwhile` / `utilityRow` (now just `pager`, layout Δ0 — they were equal for every FREE round) and the Hint OPEN_POOL pantry route / copy are gone. The Hint sheet keeps its notebook line and the 研究するピザを選ぶ button.
- The utility row under the tray now holds the pager alone (centred; same 28px row, same 44px hit areas).
- Dormant, left on purpose: the hand machinery (`handSession`, `handTray`, `workingSet`, `pinEdit`, `resolveTrayHandIds`) behind the false flag, App's never-written `handSession`. Follow-up cleanup candidate.
- No change to inventory consumption, purchase rules, progression unlocks, Research privacy, scoring or the save.

## 3. Tray derivation

`tray(category) = OWNED(category)` → mode filter (`freeCook` ? all : recipe-required) → Family Filter → pagination. Unowned / LOCKED never appear. Stock never adds or hides an entry.

| Mode | Behaviour |
|---|---|
| FREE / Research | every owned ingredient, paged; family chips on 具材 |
| Guided | recipe-required owned only (unchanged) |
| Lunch Rush | recipe-required owned only (unchanged) |
| Dinner | owned-all (unchanged) |

## 4. Tests

Run (focused only; no full Vitest, no WebKit): tray derivation (`prepareDock.test.ts`: owned / unowned / mode / stock-independence), `IngredientTray*`, `trayFamilyFilter`, `GameScreen*` (incl. new all-owned + Research privacy assertions in `GameScreen.openPoolNav.test.tsx`), `App.allOwnedTray.test.tsx` (27 toppings, 5 pages, no 食材庫), `src/logic/catalog/*` (hand-on 9 / 12, hand-off, preview, production-policy projects), persistence (`persistence.legacyPantry.test.ts` + all `persistence*`), `src/devtools/*`, `src/logic/discovery/*`, App hint / dinner / inventory / reset suites; `tsc -b`, `oxlint` (only pre-existing warnings), `vite build`. Chromium e2e at 390×844 and 360×800: family filter / expanded / layout contract, free-cooking-phase3-2, Discovery IP-1 nav, Research rows, FAILED Research, TQ-1D, contract-2-1-final, expansion 1 / 2, `layout-contract` (layout-chromium), DEV State Editor UI.

Removed (they exercised the retired pantry / pin UI): `IngredientPantry.*`, `pantryViewportFit`, `pantrySearchIme`, `pantryAvailability`, `GameScreen.pantryShell`, `IngredientTray.pantryEntryRow`, `App.handPins / handPinUi / handActivation / handTray / handTray.familyFilter .handOn`, e2e `large-catalog-pantry-{search,shell,shelves}`, `large-catalog-production-pantry`, `lc-hand-pin-ui`, `lc-hand-preview-activation`, `support/lcHandDom`. Rewritten: `handTray.handOff` → `App.allOwnedTray`, `handPolicy.*`, `catalogBoundary`, openPoolNav (unit + e2e), family e2e specs, `chipOnTrayOrPin` (pages the tray only).

Stale, not touched: `tools/large-catalog-ux/*` and `tools/ingredient-category-tabs/*` HV / mutation scripts that name the pantry.

## 5. Catalog Count Pins (recorded only, not cleaned up)

Heuristic grep: ~24 dex-pill style (`/32`, `/33`) pins in 15 spec / test files (mostly e2e), and ~58 `toBe/toHaveLength/toEqual(27|28|32|33|34)` count literals on recipe / ingredient / ladder assertions (some legitimate). Separate small task.

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `all-owned-cooking-tray-390x844.mp4` (H.264, not committed) | 390×844 | 31s | 394 KB | PASS |

Download: delivered directly in the session.

Video Verification: PASS

Watch for: HOME → FREE cooking → 具材 step shows 1/5 pages with the family row and **no 食材庫** → each family chip → page to the last page (late-catalog items that used to be behind the 食材庫 are right there) → place one → 焼く → 取り出す → RESULT. Screenshots: `docs/reports/screenshots/all-owned-cooking-tray/` (`before-*` = main, `after-*` = this branch, 390×844 and 360×800).
