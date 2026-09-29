# Ingredient Category Tabs 1.0 — Phase 4 Result (Ingredients shelf chips)

Implementation base `origin/main`: **`cf1c57de51891d3b81c456e78e6926ccfe9229fc`** (unchanged since the Fresh Audit). Audit: `docs/reports/TETO_INGREDIENT-CATEGORY-TABS_P4_Ingredients_Fresh-Audit.md` (included in this PR, commits `c723b0e` / `2c5e456`, docs/data/tools only).
Owner Decisions applied: Migration A (Ingredients only), visibility = OWNED only, chip = OWNED rows only, card label 「トッピング」 kept, `ShelfChips` unchanged, spacing wrapper in `InventoryOverlay`, `CATEGORY_TAB_*` cleanup in its own commit, no counts, no sticky.

## Commits (kept separate)
1. `fab8450` **feat** — `InventoryOverlay.tsx`, `App.css`, tests, e2e.
2. `3ee0015` **chore** — removes the unused `CategoryTab`, `CATEGORY_TAB_ORDER`, `CATEGORY_TAB_LABEL` exports from `data/ingredients.ts` (consumer re-check right before deleting: none in `src/`, `e2e/`, `tools/`, `scripts/`; only historical mentions in old reports). `CATEGORY_ORDER` / `CATEGORY_LABEL` stay (card label, `ingredientShelf`).
3. `aafc29e` **docs** — corrects the Phase 3 Result: active chip = fill + underline + `aria-pressed` (bold is the base weight of every chip). Docs only.

## What changed
- **Visibility contract (unchanged)**: the screen lists OWNED ingredients only. No LOCKED, no Shop-NEW, no silhouette, no 「???」. `INGREDIENTS.filter(owned)` as before.
- **Filter migration (A)**: 「すべて / ソース / チーズ / トッピング」 (`role=tablist`) → 「すべて」 + `shelvesPresent(owned rows)` via the shared `ShelfChips`. `filterByShelf` filters. No 「トッピング」 chip; no coexistence. Inventory's private tab constants and `.inventory-tab*` CSS are removed.
- **Privacy**: chips derive from the owned rows only — never from the catalog, the Shop entitlement (`unlockedForShopIngredientIds`), `obtainableIngredientIds` or Shop-NEW rows (a source test pins that `InventoryOverlay.tsx` reads none of them). Unbought Shop NEW materials create no chip. No counts, no hidden nodes, constant `aria-label`. Unknown/unclassified ids get no shelf and show under 「すべて」 only.
- **Display filter only**: `InventoryOverlay` still has no callback except `onClose`; the filter cannot dispatch. Owned ids, stock, unlock, purchase, Pitz, save, discovery, Hint 5 and scoring are untouched. An active shelf that is no longer owned reads as 「すべて」 (derived while rendering; no setState in render or in an effect).
- **ShelfChips**: unchanged (no domain logic added). `InventoryOverlay` adds a `.inventory-overlay__shelves` spacer (`margin-bottom: 12px`).
- **Accessibility**: `role=group` + `aria-label="材料の分類"`, `<button aria-pressed>`, no tab/tablist. Active = fill + underline + `aria-pressed`. Chips ≥44px, 14px, one nowrap row with its own horizontal scroll.

## Progression (matches the Fresh Audit exactly)
Starters: ソース / チーズ / ハーブ・香味. A chip for その他 (Dex 1), 肉 (2), 野菜・きのこ (3), 果物 (10), 魚介 (15), スパイス・薬味 (23) is absent while the shelf's materials are unbought and appears with the first owned one (`InventoryOverlay.shelf.test.tsx`). No expectation had to change.

## Files
`src/components/InventoryOverlay.tsx`, `src/App.css`, `src/data/ingredients.ts` (cleanup commit). Tests: new `InventoryOverlay.shelf.test.tsx` (18); updated `InventoryOverlay.test.tsx` (tests 6–8), `InventoryOverlay.scalability.test.tsx` (mock `getIngredient` too; new fail-closed test 20), `App.inventoryOverlay.test.tsx`, `App.globalOverlayShellSizing.test.tsx` (selectors only, shell assertions unchanged). e2e: new `e2e/ingredient-shelf-inventory.spec.ts`. Docs / data / tools from the audit, this report, screenshots.
Not touched: `ShopOverlay.tsx`, Builder / `IngredientTray`, `ingredientShelf.ts`, `ShelfChips.tsx`, taxonomy, catalog, Hint 5, #272.

## Verification
- Vitest: 233 files / 4725 passed / 1 skipped. `tsc -b` clean, oxlint no new warning, `vite build` OK.
- Chromium e2e (layout-contract, discovery-ladder Shop, Shop shelf spec, Ingredients shelf spec) at 390×844 / 360×800: 40/40. Mutation check: lowering `.shelf-chip` min-height to 30px makes the Ingredients e2e fail (the ≥44px row/chip pin is real).
- Cross-screen e2e: Shop shows mushroom as NEW (Ingredients has no 野菜・きのこ chip) → buy in the Shop → close → Ingredients shows マッシュルーム and, for the first time, the 野菜・きのこ chip → filter → close/reopen leaves the save identical. Pins unlock ≠ ownership and purchase → ownership → shelf appearance.
- WebKit: CI (not installable in the authoring sandbox).

## Human Verification (Follow TETO_HUMAN-VERIFICATION-POLICY)
Screenshots (committed): `docs/reports/screenshots/ingredient-category-tabs-inventory/` — `before-390x844-{A-starter-only,D-mid,E-max}`, `after-390x844-{A-starter-only,B-shop-new-unbought,C1-shop-bought,C2-ingredients-new-chip,C3-filtered,D-mid,E-max,F-late-family,F2-other,G-reopened}`, `after-360x800-{A-starter-only,D-mid,E-max}`.

## Human Verification Videos
| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `ingredient-shelf-ingredients-hv-390x844.mp4` (H.264, yuv420p, 25 fps) | 390×844 | 29.7 s | 785,817 B | PASS |

Download: delivered directly in the session (not committed, per policy). Recorded on the local dev build of this branch (no Preview deploy).
Video Verification: PASS (exists, non-zero, decodes to the end, full viewport, target interactions visible).
What to check: A starter-only Ingredients (4 chips) → B Shop shows the mushroom as NEW (unbought), Ingredients unchanged → C buy in the Shop, reopen Ingredients: マッシュルーム appears together with the 野菜・きのこ chip; pick it → G close/reopen: filter resets to 「すべて」, nothing else changed → D mid ownership → E full ownership: 10 chips, the row scrolls sideways by itself → F pick スパイス・薬味 and その他 → back to 「すべて」.
360×800: layout smoke via screenshots + e2e (one 46px row, chips ≥44px, no page overflow, no clipping).

## Known limits
Topping cards still print the coarse label 「トッピング」 (card metadata, kept by decision). 「所持 N/M種」 unchanged (Phase 5 for per-shelf denominators). Chip row is not sticky. Counts deferred (OD-CT-6). Merge of #295 conflicts with main on its own (`GameScreen.tsx`, `PROJECT_HANDOFF.md`), independent of this PR.
