# Ingredient Category Tabs 1.0 — Phase 4 (Ingredients) Fresh Audit + Implementation Plan

**docs / data / tools only. No production code changed. No PR.**
Audited `origin/main`: **`cf1c57de51891d3b81c456e78e6926ccfe9229fc`** (fresh fetch; nothing newer). Present on main: Phase 1 `src/data/ingredientShelf.ts`, Phase 3 `src/components/ShelfChips.tsx`, Phase 3 Shop (`ShopOverlay.tsx` uses both).
Data (all reproducible): `docs/reports/data/TETO_INGREDIENT-CATEGORY-TABS_INVENTORY-VISIBILITY.json` (`tools/ingredient-category-tabs/inventory-visibility.mjs`, `--check`), `…_INVENTORY-MEASUREMENTS.json` (`tools/ingredient-category-tabs/inventory-measure.mjs`, needs a served production build).
Owner Decisions in force: OD-CT-3 (`other` = 「その他」), OD-CT-4 (replace 「トッピング」), OD-CT-5 (display filter only), OD-CT-6 (no counts before Phase 5), OD-CT-7 (no new family, fail-closed).

## 1. Current Ingredients architecture (`src/components/InventoryOverlay.tsx`, 113 lines)
- The screen the player sees as 「材料」 (Home menu) is `InventoryOverlay`, mounted at `App.tsx:1219`. Props: `ownedIngredientIds`, `inventory`, `onClose` — **no dispatch, no purchase/restock callback**. It is read-only by type signature.
- Rows: `INGREDIENTS.filter(i => ownedIngredientIds.includes(i.id))`, catalog order (no NEW-first, no stock sort). Card = glyph (cheese uses `IngredientPieceVisual`), name, **category label** (`CATEGORY_LABEL[category]`: ソース / チーズ / トッピング), stock (`remainingStock`: `×N`, `∞` for starters, zero styled).
- Header line 「所持 N/M種」 from `ingredientCollectionCount(owned)` (M = every obtainable ingredient, currently 29). Existing disclosure of the total; unchanged by this phase.
- Local state only: `activeTab`. Layout: bottom-anchored sheet (`.dex-overlay__panel.inventory-overlay__panel`); body is `.dex-overlay__body` (a **block** scroller, `display: block`, `overflow-y: auto`); 3-column `.inventory-grid`; max 29 cards today (scrollH 1036px at 390×844).

## 2. Existing visibility contract
The screen lists **OWNED only**. It never lists LOCKED, Shop-NEW (entitled but unbought), silhouettes or 「???」. Starters (tomato-sauce, mozzarella, basil) are always owned, so the screen is never empty. An owned id unknown to the catalog is ignored (`INGREDIENTS.filter`). This contract is not changed.
Difference from the Shop (Phase 3): Shop "visible" = NEW/OWNED rows; Ingredients "visible" = OWNED rows. Entitled-but-unbought materials (Shop NEW rows) therefore never create an Ingredients chip.

## 3. Existing filter contract
- `type CategoryTab = "ALL" | IngredientCategory` with **private** `TAB_ORDER` / `TAB_LABEL` in `InventoryOverlay.tsx` (a copy of the shape; it does *not* import `CATEGORY_TAB_*`).
- Filter: `owned.filter(i => i.category === activeTab)`; state is the component-local `activeTab` only.
- All four tabs are always rendered, including tabs whose category has no owned row (then 「まだこのカテゴリの材料を持っていません」). The new rule (§6) is stricter than today.
- Semantics: `role="tablist"` / `role="tab"` + `aria-selected`; no tabpanel, no `aria-controls`, no arrow keys. Tabs 33px high, 12px text, `flex-wrap: wrap`, `margin-bottom: 12px`.
- Filter change touches only `activeTab`: no dispatch exists, no selection state exists.

## 4. ShelfChips reuse feasibility — **reusable as is**
`ShelfChips` (`shelves`, `active`, `onChange`, `ariaLabel`) has no Shop-specific dependency: imports are `react` + `ingredientShelf` only, no domain state, `role=group` + `aria-pressed`, 44px, `nowrap` single row with its own horizontal scroll, `flex: 0 0 auto`, active-chip visibility via its own `scrollLeft` (never the page), `"all"` first, order = the `shelves` array it is given (callers pass `shelvesPresent(...)`). **No extension is needed.** Do not add Ingredients logic to it.
One caller-side detail: `.shelf-chips` carries no outer margin (the Shop gets spacing from its flex `gap`). Inventory's old tabs had `margin-bottom: 12px`; the caller should wrap the chips in a spacer element (e.g. `.inventory-overlay__shelves { margin-bottom: 12px }`) rather than changing `ShelfChips`.

## 5. ingredientShelf integration
```
const listed = owned;                                   // the rows the screen already lists
const presentShelves = shelvesPresent(listed);          // authority order, no counts
const shelfFilter = active === "all" || presentShelves.includes(active) ? active : "all";  // derived, no setState in render/effect
const shown = new Set(filterByShelf(listed, shelfFilter).map(i => i.id));
const visible = owned.filter(i => shown.has(i.id));
```
Identical to the Shop wiring (same derived fallback; stored choice written only by a chip tap). No taxonomy or family mapping in the component. All 29 catalog ingredients have a shelf (Phase 1 gate), so `unclassifiedOwnedIds` is empty; an unclassified id would only appear under 「すべて」 (fail-closed).

## 6. Visible-shelf privacy rule
Chips = 「すべて」 + `shelvesPresent(owned rows)`. Nothing else feeds the chip row: not the catalog, not the Shop entitlement, not `unlockedForShopIngredientIds`, not `obtainableIngredientIds`. No counts, no per-chip description, no hidden nodes, constant `aria-label`. The old empty-category sentence becomes unreachable for shelves (only a fully empty `owned`, which starters prevent, would show it — keep the sentence as a defensive fallback).

## 7. Progression audit (deterministic; `INVENTORY-VISIBILITY.json`)
Starters only (nothing bought): rows 3, chips **すべて / ソース / チーズ / ハーブ・香味** (tomato-sauce, mozzarella, basil).
If the player bought every entitled material at each Dex count (the maximum owned set at that step):

| Dex | rows | new chip at this step |
|---:|---:|---|
| 0 | 3 | ソース, チーズ, ハーブ・香味 (starters) |
| 1 | 4 | その他 |
| 2 | 5 | 肉 |
| 3 | 6 | 野菜・きのこ |
| 10 | 13 | 果物 |
| 15 | 19 | 魚介 |
| 23 | 27 | スパイス・薬味 (all 9 shelves) |
| 24 | 29 | – |
A chip appears only when an **owned** row of that shelf exists, i.e. at purchase, never at unlock (Shop NEW rows add nothing: `entitledButNotBoughtAddsChip: false`). Chip position is fixed by the shelf order, so nothing hidden is hinted. Unclassified owned ids: none.

## 8. Mobile measurements (390×844 / 360×800; production build of `cf1c57d`, Chromium)
| | starters only | full ownership (29) |
|---|---|---|
| current tab row | 33px, 12px text, wraps, 4 tabs (role tablist/tab) | same |
| body | `display: block`, `overflow-y: auto`, clientH 180 (sheet sized by content) | clientH 756 (390×844) / 712 (360×800), scrollH 1036 / 1050 |
| prototype (Phase 3 chip row DOM-injected in place of the tabs, no source change) | row 46px, chips ≥44px, one row, inside row, no page overflow; row not scrollable when 4 chips fit… | row 46px, chips ≥44px, **one row, scrollable**, no page overflow |
| cost | +13px content height (46 vs 33); the sheet is bottom-anchored so it grows upward | +13px inside a scrolling body (scrollH 1036 → 1049 / 1050 → 1063) |
(The prototype's `deltaGridTop` of 0 in the starters case is because the sheet grows upward; content height is +13px.)
**Squash risk (Shop's 2px bug)**: the Ingredients body is a block container, not a flex column, so a long list cannot compress the row (prototype: row 46px with 29 cards). `ShelfChips`' own `flex: 0 0 auto` already protects against a flex parent; **no parent CSS is required** beyond the spacing wrapper (§4). No sticky header exists in the Inventory sheet (the header is outside the scrolling body), so there is no sticky interaction; the chip row scrolls away with the list (sticky stays out of scope). 360×800 shows the same 46px row and no overflow.

## 9. Accessibility
Same as Phase 3: `role="group"` + `aria-label` (proposed `材料の分類`, same as Shop), `<button aria-pressed>`, active = fill + underline + `aria-pressed`, ≥44px, 14px, keyboard via native buttons. Replaces a tablist that has no tabpanel. Existing tests query `getByRole("tab")` (selectors change, behavior asserted the same).

## 10. Migration comparison
| | A. Atomic replacement | B. Compatibility layer | C. Coexistence |
|---|---|---|---|
| Result | 「すべて」 + owned-shelf chips; 「トッピング」 removed | 「トッピング」 as parent opening a family sub-row | 「トッピング」 next to family chips |
| Fit with Phase 3 | identical to Shop | two levels / extra row | two axes in one row |
| Height | +13px | +57px | +13px |
| Risk | selectors only | code deleted later | chip deleted later |
**Recommend A** (as in Phase 3). Old → new mapping: 「すべて」→all, 「ソース」→sauce, 「チーズ」→cheese, 「トッピング」→ the family chips (union). `activeTab` is component-local and unsaved: no save migration.

## 11. `CATEGORY_TAB_*` cleanup decision
On main, `CategoryTab`, `CATEGORY_TAB_ORDER`, `CATEGORY_TAB_LABEL` (`data/ingredients.ts:564-571`) have **zero consumers**: the Shop stopped using them in Phase 3 and `InventoryOverlay` uses its own private copies. So there is no remaining consumer today; they are dead code independent of Phase 4. Phase 4 also removes Inventory's private `CategoryTab` / `TAB_ORDER` / `TAB_LABEL`.
Decision (per the rule "delete only if no consumer remains"): **delete both** in the Phase 4 implementation PR as a separate, clearly labelled cleanup commit (grep proves no consumer in `src/`, `e2e/`, `tools/`; the compiler confirms). **Keep** `CATEGORY_ORDER` / `CATEGORY_LABEL` (used by Inventory's card label and by `ingredientShelf.ts`).

## 12. Domain isolation
`InventoryOverlay` has no callbacks besides `onClose`; the filter cannot dispatch. Filter change alters only the local filter value: `ownedIngredientIds`, inventory quantities, unlock, purchase, Pitz, save, discovery, Hint 5, scoring are untouched. There is no selection state to reset (PR #197's page-change reset concerns the Builder tray only).

## 13. Required tests (Phase 4)
1. Chips = 「すべて」 + shelves of the **owned** rows only; 2. a shelf with only unowned/entitled/LOCKED materials has no chip, DOM node or text; 3. 「すべて」 first; 4. authority order; 5. a shelf shows exactly its owned rows (order kept); 6. no 「トッピング」 chip, no tab/tablist; 7. filter keeps stock text (`×N`/`∞`) unchanged; 8. owned/unlock/purchase untouched (props not mutated; component takes no callbacks); 9. only the filter value changes; 10. fallback to 「すべて」 when the active shelf disappears (props rerender); 11. group + `aria-pressed`; 12. no counts in the chip row; 13. unknown/unclassified ids create no chip and appear only under 「すべて」; 14. chip row ≥44px, not squashed (e2e); 15. 390×844 and 16. 360×800 (one row, scrollable when many chips, no page overflow, no clipping); 17. Dex/purchase walk: owned = starters + bought → chips equal `shelvesPresent(owned)`; buying in the Shop then opening Ingredients shows the new chip; 18. `CATEGORY_TAB_*` no longer exported (compile-level).
Existing tests that need selector updates (behavior asserted the same): `InventoryOverlay.test.tsx` (test 6 and the チーズ-tab cases around lines 85-130), `InventoryOverlay.scalability.test.tsx:66`, `App.inventoryOverlay.test.tsx:88`, `App.globalOverlayShellSizing.test.tsx:121-157` (the shell-shape assertions stay; 「トッピング」 becomes a family chip). Line 188 of `InventoryOverlay.test.tsx` pins the per-card 「トッピング」 label; see risk R1.

## 14. Implementation file list
edit `src/components/InventoryOverlay.tsx`, `src/App.css` (remove `.inventory-tabs` / `.inventory-tab*`, add a spacer for the chip row), the four test files above, new `src/components/InventoryOverlay.shelf.test.tsx`, new `e2e/ingredient-shelf-inventory.spec.ts`; cleanup commit: `src/data/ingredients.ts` (remove the three unused exports). Docs: Phase 4 Result report, screenshots under `docs/reports/screenshots/ingredient-category-tabs-inventory/`, and the Phase 3 Result one-line correction (§17). Not touched: `ingredientShelf.ts`, `ShelfChips.tsx`, taxonomy, Shop, Builder, reducer/economy/save, #272.
HV (390×844 video + before/after screenshots, 360×800 smoke): A starters only (4 chips); B mid (buy in Shop, reopen Ingredients: new chip); C full ownership (10 chips, row scrolls); D scroll and pick a late shelf; E close → reopen (filter resets to 「すべて」, nothing else changed); F Shop → Ingredients consistency.

## 15. Open PR interactions
| PR | File overlap | Semantic overlap |
|---|---|---|
| #272 Large Catalog UX (OPEN, stale base) | none | Its plan turns Ingredients into a "browse mode" of a future pantry list (search / family / sort, LC-3), which could later supersede this screen's filter. `catalogQuery` / `familyCounts` overlap the idea of `filterByShelf` / `shelvesPresent`; no authority duplication (family ids injected from DH4-1). Phase 4 does not use it; `familyCounts` returns counts (deferred, OD-CT-6). Not changed. |
| #275 (CUT UX) | `src/App.css` only, hunks at ~L5736+ (hint sheet); Phase 4 edits ~L2762-3000 | none; textual merge should be clean |
| #295 Cooking Steps, #296 HCG, #293, #255 | none | #296 / HCG will add toppings later; the Phase 1 fail-closed audit and `shelvesPresent` pick them up without UI change |
| others (#221, #220, #219, #218, #217, #214, #211, #209, #208, #205, #204, #105, #72, #46, #34, #3) | none of the Phase 4 files | none |

## 16. Risks / blockers
| # | Item | Severity |
|---|---|---|
| R1 | Each topping card still prints the coarse label 「トッピング」 (`inventory-card__category`, pinned by a test). It is an item label, not a filter and leaks nothing; after the filter is replaced it is the last user-visible 「トッピング」. Default: **leave unchanged** in Phase 4. Optionally show the shelf label (肉 …) later — an Owner call, not a blocker | low |
| R2 | 「所持 N/M種」 already discloses M (29). Unchanged; per-shelf denominators are the Phase 5 privacy question | low |
| R3 | +13px content height in the sheet | low |
| R4 | About 10 test selector updates | low |
| R5 | #272/LC-3 may later subsume this screen's list; ShelfChips stays reusable | low |
| R6 | No blockers. | – |

## 17. Docs correction timing
Confirmed: `docs/reports/TETO_INGREDIENT-CATEGORY-TABS_P3_Shop_Result.md` line 10 says active = "filled + **bold** + underline". Base weight is bold (700) on every chip; the real active cues are **fill + underline + `aria-pressed`**. Proposal: fix that single line in the Phase 4 implementation PR (docs commit), because Phase 4's Result restates the same accessibility contract and it avoids a docs-only PR; it is not needed before then (no code depends on it).

## 18. FINAL VERDICT: **A. READY FOR PHASE 4 INGREDIENTS IMPLEMENTATION**
No new Owner Decision is required. Defaults stated for awareness: Migration A; card label 「トッピング」 unchanged (R1); dead `CATEGORY_TAB_*` deleted in a separate cleanup commit (no consumer remains); spacer wrapper in `InventoryOverlay`, no `ShelfChips` change.
