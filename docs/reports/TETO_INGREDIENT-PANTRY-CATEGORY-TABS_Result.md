# Ingredient Pantry / Category Tabs — Result Report

Branch `claude/ingredient-category-tabs-impl`, from `origin/main` **`c62db170df02e87bf78bf952a146f0cc872ee666`** (fresh-checked at start; Expansion Wave 2 / #389 merged). PR open, **not merged** (no auto-merge). Owner Decisions OD-1…OD-8 (Fresh Audit / Preflight) and OD-A…OD-F are closed; this report implements them as decided.

## 1. What changed (final UI behavior)

| Screen | Behavior |
|---|---|
| **Inventory / Shop** (OD-1, OD-8) | One shared two-tier `ShelfTabs`. Tier 1: `すべて / ソース / チーズ / 具材` (only the majors the listed rows hold). Tier 2: `すべて` + the families the listed rows hold, **only while 具材 is selected**, one horizontally scrolling row. Both are `role="group"` + `aria-pressed` (OD-7): `aria-label="材料の大分類"` / `"具材の分類"`. Moving to another major resets the family to すべて; re-tapping the active 具材 keeps the family (OD-5 / OD-D). A stored tab no row holds reads as すべて (derived while rendering, as before). |
| **Pantry** (OD-1) | Still per active category (not cross-category). Sauce / cheese: own rows only, no tab row, **no subtitle** (OD-B). 具材: subtitle 「具材」, one family row (`aria-label="具材の分類"`, only when ≥ 2 families are owned, as before), search ANDed with the family, pin / HAND untouched. |
| **Cards** (OD-3, OD-C, OD-F) | Every 具材 card shows a `FamilyTag` (symbol + label) **always, also while a family is filtered**: Pantry tile (under the name), Inventory card (replaces the old category line), Shop item (its own line under the name row, not beside it). Sauce / cheese cards show **no** family tag and Inventory sauce / cheese cards no category line. |
| **Labels** (OD-2, OD-A) | Family labels are the Hint 5.0 labels: 肉系 / 魚介系 / 野菜・きのこ系 / 果物系 / ハーブ・香味系 / スパイス・薬味系 / ちょっと変わった材料. Symbols are the existing Hint symbols (🥩🌊🥬🍇🪴🧂✨; G18 intact). Family ids (`meat … other`) and `Ingredient.category` are unchanged. |
| **「具材」** (OD-4) | `CATEGORY_LABEL.topping` = 「具材」 (internal id `topping` unchanged). All consumers audited: only the Pantry subtitle and the Inventory card used it for `topping` (both reworked here); `ingredientShelf.ts` reads only `sauce` / `cheese`. Hint / Research / dialogue 「トッピング」 / 「キートッピング」 / 「サブトッピング」 are separate strings and were **not** touched (they remain by design). |

### Dependency direction (OD-A)
`src/data/familyDisplay.ts` is the single player-facing family authority and a **leaf** (imports only `ingredientTaxonomy`). `hintClassDisplay.ts` now re-publishes it (`HINT_CLASS_DISPLAY === FAMILY_DISPLAY`, same record, no copied value; API and G18 unchanged). `ingredientShelf.ts` and the components read `familyDisplay` directly, never `hintClassDisplay`, so the Hint-import contract and the H5-3 / catalogBoundary gates hold; the catalog layer (`catalogQuery` / `catalogSource` / `catalogTypes`) is untouched and forbidden from importing `familyDisplay`.

### 具材すべて semantics
OR over the 7 family shelves, ANDed with owned and search. A topping with no family row (never the case in production) is reachable only under 「すべて」 (fail-closed, OD-CT-7); `auditShelfAuthority` stays the gate.

## 2. Changed files

New: `src/data/familyDisplay.ts`(+test), `src/components/ShelfTabs.tsx`(+test), `ShelfChipRow.tsx`, `FamilyTag.tsx`, `IngredientPantry.family.test.tsx`; tools `tools/ingredient-category-tabs/{hv-category-tabs.mjs, pantry-family-geometry.measure.spec.ts, playwright.pantry-family-geometry.config.ts}`; data `docs/reports/data/TETO_INGREDIENT-PANTRY-CATEGORY-TABS_GEOMETRY.json`; screenshots `docs/reports/screenshots/ingredient-pantry-category-tabs/`.
Changed: `src/data/{ingredientShelf.ts (selection helpers; family labels from familyDisplay), hintClassDisplay.ts (re-publish), ingredients.ts (CATEGORY_LABEL.topping)}`, `src/components/{ShelfChips.tsx (now the Pantry's family row over ShelfChipRow), IngredientPantry.tsx, InventoryOverlay.tsx, ShopOverlay.tsx}`, `src/App.css`, the golden `docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R6b_PRODUCTION-DOM-GOLDEN.json`, `e2e/lc-hand-preview-activation.spec.ts` (`LC_GOLDEN_WRITE=1` re-capture switch), and tests re-pointed at the new labels / structure (see §3). **Not changed:** `catalogQuery/Source/Types`, pin / HAND logic, `Ingredient.category`, family ids, tablist semantics.

## 3. Test results (risk-based; one full run on the final tree)

- `tsc -p tsconfig.app.json` clean; `oxlint` no errors (the 2 pre-existing warnings in `scoringV2.noSauceProfile.test.ts` are on main too); `npm run build` OK.
- **Vitest (full, final tree): 341 files, 6181 passed, 1 skipped.** Focused: `familyDisplay`, `ShelfTabs`, shelf mapping / selection (`ingredientShelf.test.ts`), `IngredientPantry.{family,shelves,search,pins,pinNotice}`, `InventoryOverlay*`, `ShopOverlay*`, `catalogBoundary` (+`familyDisplay` forbidden in the catalog layer), `hint5Production` / `hint5Taxonomy` gates, `deductionHint` / `deductionGuard` importer lists (+`familyDisplay.ts`, the sanctioned taxonomy reader), `GameScreen.pantryShell`, `App` Shop / overlay-shell tests. The old "labels stay context-separate" / "label + 系" drift tests encoded the superseded design and were replaced by "shelf label = `FAMILY_DISPLAY` = `HINT_CLASS_DISPLAY` (same object)".
- **Chromium E2E** (iphone-390x844 + iphone-360x800 + layout-chromium): ingredient-shelf-inventory / -shop, inventory-modal-stable-bounds, large-catalog-pantry-{shelves,search,shell}, large-catalog-production-pantry, lc-hand-pin-ui, lc-hand-preview-activation (golden), layout-contract, expansion1 / expansion2, discovery3-ip1-open-pool-nav — all pass. The pantry / inventory / shop / golden / layout-contract specs passed on the final tree (runs of 41 passed / 3 skipped and 18 passed / 8 skipped); expansion1 / expansion2 / discovery3-ip1-open-pool-nav passed in the earlier 68-pass set, taken before the last pantry-tile CSS line (`.pantry-tile__family`) and not repeated since it cannot reach them. History, honestly: the first E2E pass had 6 failures — 4 were the new specs' own assumptions (a hard-coded sauce-name list, an edge-straddle check) fixed in the specs; 2 were the **measured** 360×640 keyboard floor (below). One intermediate CSS variant (hiding the subtitle while the sheet is keyboard-fitted) was tried, broke the R5-b "list viewport identical when the field takes the focus" contract and was **reverted** before the final CSS.
- WebKit E2E was not run locally (not required here; CI runs it).

## 4. Geometry (measured; before = main, after = branch; px; K = 338 simulated keyboard)

| viewport | pantry 具材 list (normal) | tile row h | wrapped 「ちょっと変わった材料」 tile | list @K=338 | full rows @K=338 | sauce-step list | Inventory list: すべて → 具材 (tabs h) |
|---|---|---|---|---|---|---|---|
| 390×844 | 617 → 617 | 75.2 → 84.2 | 93.2 | 291 → 291 | 3 → 3 | 723 → 748 | 655 → 601 (100) |
| 360×800 | 573 → 573 | 75.2 → 84.2 | 93.2 | 247 → 247 | 3 → 2 | 679 → 704 | 611 → 557 (100) |
| 390×664 | 437 → 437 | 75.2 → 84.2 | 93.2 | 111 → 111 | 1 → 1 | 543 → 568 | 475 → 421 (100) |
| 360×640 | 413 → 413 | 75.2 → 84.2 | 93.2 | 87 → 87 | 1 → 1 | 519 → 544 | 451 → 397 (100) |

- The Pantry's family row was already in the baseline (no new row cost); the cost is the tile family line. Sauce step gains 25px (no subtitle).
- **The one measured shortfall (OD-6):** the first version (family line with a 12.8px box) took 360×640 @K=338 to a row of 88px in a list of 87px (0 full rows; the 4 floors in `large-catalog-pantry-search` / `large-catalog-production-pantry` failed). Only then a minimal fix was added: inside the pantry tile the family line sits flush under the name with a 9px line box (`.pantry-tile__family`, +9px per row). No UI was hidden; the family row, search field and tags are all present. Result: 360×640 @K=338 = 1 full row with a **2.8px margin (was 11.8px)**.
- Unchanged-or-worse points: 360×800 @K=338 shows 2 full rows (was 3; 247px list vs 84.2px rows); 360×640 @K=380 and 390×664 @K=380 are 0 full rows — they were already 0 before this change (sensitivity beyond the 338px real-iPhone figure).
- Inventory / Shop: the 具材 state costs +54px (tier 2: 46px chip row + 8px gap); lists keep 4+ full card rows at every viewport. Tier 1 (4 chips) fits without scrolling; tier 2 (8 chips, ≈ 860px of chips) scrolls inside its own row at all four widths with a chip visibly continuing off the right edge.
- Known cosmetic: 「ちょっと変わった材料」 wraps to two lines inside a 3-column tile (mid-word, no break opportunity in the Japanese text).

## 5. Production DOM golden

`free22.topping.pantry` is the only snapshot that changed (12 others byte-identical, including every dock snapshot, sauce / cheese steps and all `free6.*`). Reason, verified item by item: removing the 27 added `FamilyTag` spans and reversing (1) subtitle 「トッピング」 → 「具材」, (2) group aria-label 「材料の分類」 → 「具材の分類」, (3) the 7 family chip labels reproduces the previous golden byte for byte. Re-captured with `LC_GOLDEN_WRITE=1` from the rollback build (Chromium); the reason is recorded in the file as `rebaselineNote3`. `lc-hand-preview-activation` passes against it in normal (non-write) mode on the final tree.

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `ingredient-pantry-category-tabs-390x844.mp4` (H.264, yuv420p) | 390×844 | 46.9 s | 905,075 B | PASS |

Download: delivered directly in the session (not committed; `artifacts/` is gitignored, per the Policy).

What the video shows: HOME → 材料(在庫): すべて → ソース (3 sauces, no tags) → チーズ → 具材 → family row (肉系, scroll to ちょっと変わった材料, すべて) → leave 具材 and return (family back at すべて) → ショップ: 具材 → 魚介系 (NEW rows keep their purchase UI, family tag on its own line) → FREE Cooking: sauce-step pantry (no chips, no subtitle) → topping pantry: family row, tile tags, 肉系 filter, pin (HAND active) kept when switching to 魚介系, search ANDed with the family, simulated keyboard, close → keep placing toppings.

Video Verification: PASS (ffprobe: h264 390×844, 46.92 s; contact-sheet frames checked).

Screenshots (committed, `docs/reports/screenshots/ingredient-pantry-category-tabs/`, `before-` = main, `after-` = branch, at 390×844, 360×800, 390×664, 360×640): inventory-all / -sauce / -topping / -topping-meat, shop-all / -topping-seafood, pantry-sauce, pantry-topping, -meat, -seafood-pin-kept, -search, -keyboard-338.

## 6. Remaining risks

1. **360×640 keyboard margin is thin** (2.8px, one full row of 84.2px in an 87px list at K=338, simulated). Needs the real-device 小型端末 check; if it fails, the next measured option is yielding the subtitle line while keyboard-like (not while merely focused).
2. The 360×800 keyboard state shows 2 rather than 3 full rows.
3. Cosmetic mid-word wrap of 「ちょっと変わった材料」 in the 3-column tile.
4. The Pantry family row still appears only when ≥ 2 families are owned (unchanged rule); Inventory / Shop keep their always-on tier 1.
5. WebKit-specific pixel metrics were not measured locally; CI's WebKit shards are the authority.
6. The accessible name of an editable pantry tile now includes the family label ("ベーコン 肉系 ×9").
7. Several tests and one golden track label strings; future label changes go through `familyDisplay` only.
