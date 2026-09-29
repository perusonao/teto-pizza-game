# Ingredient Category Tabs 1.0 — Phase 3 Result (Shop shelf chips)

Base `origin/main`: **`8d963077b82179eacfa0a31ade207505f44f92c6`** (unchanged since the Fresh Audit). Audit: `docs/reports/TETO_INGREDIENT-CATEGORY-TABS_P3_Shop_Fresh-Audit.md` (included in this PR as the plan this change implements; the audit commit `7287e7f` is cherry-picked, docs/data/tools only).
Owner Decisions: Migration A (atomic, Shop only), OD-CT-3/4/5/6/7. Inventory, Builder, #272 untouched.

## What changed
- **Shop filter migration (A)**: the old 「すべて / ソース / チーズ / トッピング」 `role=tablist` is replaced by a shelf chip row: 「すべて」 + the shelves that hold at least one **listed** Shop row (`shelvesPresent`), in `ingredientShelf` authority order. 「トッピング」 is gone (no coexistence, no two-level filter). Filtering uses `filterByShelf`. `CATEGORY_TAB_*` stay for Inventory (Phase 4).
- **Visible-shelf privacy**: chips derive from `shopRows()` (NEW / OWNED) only. A shelf that only holds LOCKED materials has no chip, no DOM node, no text, no count. No counts anywhere (OD-CT-6). An active shelf that is no longer listed reads as 「すべて」 (derived while rendering: no setState during render, no effect-driven reset).
- **`ShelfChips.tsx`** (new, presentational, reusable by Ingredients / FREE Cooking later): props `shelves`, `active`, `onChange`, `ariaLabel`; no domain state; imports only `ingredientShelf` + React. It scrolls only its own row (`scrollLeft`) to keep the active chip visible — never `scrollIntoView`, so the overlay/page does not jump.
- **Accessibility**: `role="group"` + `aria-label="材料の分類"`, native `<button aria-pressed>`; no tablist/tab. Active = filled + bold + underline + `aria-pressed` (not colour alone). Chip `min-height: 44px`, `min-width: 44px`, 14px text.
- **CSS**: `.shelf-chips` one row, `nowrap`, `overflow-x: auto`, `flex: 0 0 auto` (the overlay body is a column flexbox: without it a long list squashed the row to a sliver — caught during HV and now asserted in e2e). Chip padding 12px so that a chip visibly straddles the right edge at both viewports.

## Files
`src/components/ShelfChips.tsx` (new), `src/components/ShopOverlay.tsx`, `src/App.css`, tests: `src/components/ShelfChips.test.tsx` (new), `src/components/ShopOverlay.shelf.test.tsx` (new), `src/App.test.tsx` (Shop tests E/F/G-H/I-J/K + C: selectors/wording), `e2e/ingredient-shelf-shop.spec.ts` (new); docs: audit + this report + screenshots; `tools/ingredient-category-tabs/shop-visibility.mjs` + data (from the audit).
Not touched: `ingredientShelf.ts`, `ingredientTaxonomy.ts`, `ingredients.ts`, `InventoryOverlay*`, its tests, reducer, economy, inventory, save, Builder.

## Tests
- Focused: `ShelfChips.test.tsx` (6), `ShopOverlay.shelf.test.tsx` (13), Shop tests in `App.test.tsx`, `ShopOverlay.test.tsx` — visible-rows-only chips, LOCKED-only shelf absent (chip / DOM / text), 「すべて」 first, authority order, correct filtering, no 「トッピング」, no tab roles, `aria-pressed`, no counts, filter changes dispatch nothing and change no Pitz / stock, purchase under a shelf keeps the row, fallback to 「すべて」, unknown ids create no chip, Dex ladder walk (chips = `shelvesPresent(listed)`, monotone).
- Inventory tests (`InventoryOverlay*.test.tsx`, `App.inventoryOverlay`, `App.globalOverlayShellSizing`) were not edited and pass.
- e2e `ingredient-shelf-shop.spec.ts` (A early / B-C many / D late shelf / E-F buy + reopen) at 390×844 and 360×800: Chromium passed (8/8). WebKit is not installable in this sandbox; WebKit projects run in CI.

## Human Verification (Follow TETO_HUMAN-VERIFICATION-POLICY)
Screenshots (committed): `docs/reports/screenshots/ingredient-category-tabs-shop/` — `before-390x844-{A-early,B-mid,C-max}` (main), `after-390x844-{A-early,B-mid,C-max,D-late-family-selected,D2-other-selected,E1-family-selected,E2-after-buy,F-reopened}`, `after-360x800-{A-early,B-mid,C-max}`.

## Human Verification Videos
| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `ingredient-shelf-shop-hv-390x844.mp4` (H.264, yuv420p, 25 fps) | 390×844 | 26.2 s | 673,423 B | PASS |

Download: delivered directly in the session (not committed, per policy). Recorded on the local dev build of this branch (no Preview deploy).
Video Verification: PASS (file exists, non-zero, decodes to the end, full viewport, target interactions visible).
What to check in the video: A early Shop with only 「すべて」+ the few shelves that have rows; B mid Shop, pick 野菜・きのこ, buy (仕入れる) — the row stays and turns into a refill row, chip row keeps the active chip visible; back to 「すべて」; close and reopen the Shop (filter starts at 「すべて」, balance / stock unchanged); C max Shop, the row scrolls sideways by itself (page does not), pick スパイス・薬味 then その他, back to 「すべて」.
360×800: layout smoke via screenshots + e2e (one row, ≥44px, no page overflow, no clipping).

## Known limits
No single 「all toppings」 chip (accepted, OD-CT-4). Chip row is not sticky (Phase 5 candidate). Counts deferred (OD-CT-6).
