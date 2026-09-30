# Ingredient Category Tabs 1.0 — Phase 3 (Shop) Fresh Audit + Implementation Plan

**docs / data / tools only. No production code changed. No PR.**
Audited `origin/main`: **`8d963077b82179eacfa0a31ade207505f44f92c6`** (fresh fetch; Phase 1 `ingredientShelf.ts` merged via #299; #300 Hint 5.0 activation already in).
Data: `docs/reports/data/TETO_INGREDIENT-CATEGORY-TABS_SHOP-VISIBILITY.json` (generator `tools/ingredient-category-tabs/shop-visibility.mjs`, `--check` for drift; loads the real modules through Vite SSR).
Earlier authority: Phase 0 audit on branch `claude/ingredient-category-tabs-audit` (measurements at 390×844 / 360×800 are reused: Shop tab row 33px high, 12px font).

Owner Decisions in force: OD-CT-3 (`other` = 「その他」), OD-CT-4 (replace 「トッピング」), OD-CT-5 (display filter only), OD-CT-6 (no counts before Phase 5), OD-CT-7 (no new family, fail-closed).

## 1. Current Shop architecture (`src/components/ShopOverlay.tsx`, 274 lines)
- Props: `dex`, `ownedIngredientIds`, `unlockedForShopIngredientIds`, `pitzBalance`, `inventory`, `onPurchase`, `onRestock`, `onClose`. Mounted from `App.tsx:1206`.
- `shopRows()` walks `INGREDIENTS` and keeps only `materialShopState` = `NEW` | `OWNED` (`materialShop.ts:147`): starters (no `unlockCondition`) are never sold, `LOCKED` is never listed. Order: NEW first, then OWNED, catalog order within each.
- Local state only: `feedback` (last purchase / refill banner) and `activeTab`. Nothing from the filter reaches the reducer, save, inventory, Pitz or unlock.
- Max rows today: 26 (sauce 2, cheese 3, topping 21). Reached only at Dex 24 (see §5).
- Layout: the list scrolls inside `.dex-overlay__body`; the header, Pitz balance, feedback and the 「あと N つ発見」 line are above the tab row.

## 2. Existing filter contract
- `activeTab: CategoryTab = "ALL" | "sauce" | "cheese" | "topping"` from `data/ingredients.ts` (`CATEGORY_TAB_ORDER` / `CATEGORY_TAB_LABEL`, shared by Inventory).
- Filter = `rows.filter(r => r.ingredient.category === activeTab)`. Comment in code: "can never reveal a LOCKED material" (true: it filters the already-visible rows).
- The tab row renders whenever `rows.length > 0`; all four tabs are always present, **including tabs whose category has no visible row** (then 「このカテゴリで買える材料はまだありません」). So today an empty 「トッピング」 tab is shown in early game — the new rule (§5) is stricter than the current behavior.
- Markup: `role="tablist"` / `role="tab"` + `aria-selected`, but no `tabpanel`, no `aria-controls`, no roving tabindex or arrow keys. CSS: `.shop-filter-tabs` (flex-wrap, gap 6) / `.shop-filter-tab` (12px, `min-height: 32px`, measured 33px) in `App.css`.
- Filter change touches: `activeTab` only. `feedback` is deliberately kept, so a purchase banner survives a filter change (unchanged).

## 3. Shelf integration point
- `import { filterByShelf, shelvesPresent, INGREDIENT_SHELVES, ingredientShelfLabel, type ShelfFilter } from "../data/ingredientShelf"`.
- Visible chips: `shelvesPresent(rows.map(r => r.ingredient))` → `["all", ...present]` in `INGREDIENT_SHELF_ORDER`. Labels from `ingredientShelfLabel`. `filterByShelf` takes `{id}` items, so it needs the row's ingredient (`filterByShelf(rows.map(r => r.ingredient), f)` → ids → keep rows), or the same call on rows via a tiny `{ id: r.ingredient.id }` adapter; no change to `ingredientShelf.ts` needed.
- Shelf membership of an id is static, so a purchase (NEW → OWNED) never moves an item out of the active shelf; the just-bought row stays visible.
- `filterByShelf`'s unknown-filter → `[]` and `ingredientShelf`'s unknown-id → `null` are already fail-closed. A row with no shelf (impossible in production: 29/29; possible only in a future unclassified catalog, which the Phase 1 gate blocks) is reachable via 「すべて」 only.
- **Recommended new tiny component** `src/components/ShelfChips.tsx` (presentational, props: `shelves`, `active`, `onChange`, `ariaLabel`), reused unchanged by Ingredients (Phase 4) and Builder (Phase 2). Not in the Shop file.

## 4. Privacy / progression analysis
| Leak channel | Today | After (proposed rule) |
|---|---|---|
| chip existence | 4 tabs always, incl. empty 「トッピング」 | chip only if ≥1 listed row belongs to that shelf |
| count | none | none (OD-CT-6) |
| empty-category text | shown for an empty tab | unreachable for shelves (empty shelves have no chip); the 「このカテゴリで…」 branch is removed with the old tabs |
| DOM | tab exists even when empty | absent chips are not rendered (no `hidden`, no `display:none`) |
| a11y text | constant `aria-label="材料カテゴリ"` | constant label, no counts, no per-chip descriptions |
| timing | – | a shelf chip appears in the **same** Dex step as the first listed row of that shelf, never earlier (`chipNeverBeforeRow: true` in the data file) |
| stale/hostile state | active tab kept | if the active shelf is no longer present (e.g. state restored), the effective filter falls back to 「すべて」; never renders an empty list for a hidden shelf |
| `unlockedForShopIngredientIds` with unknown ids | ignored (rows come from `INGREDIENTS`) | unchanged |

Progressive visibility, computed from the real ladder with nothing bought (`SHOP-VISIBILITY.json`):

| Dex discovered | rows | chips after 「すべて」 |
|---|---:|---|
| 0 | 0 | (no row; existing empty state) |
| 1 | 1 | その他 |
| 2 | 2 | 肉, その他 |
| 3 | 3 | 肉, 野菜・きのこ, その他 |
| 5 | 5 | チーズ, 肉, 野菜・きのこ, その他 |
| 10 | 10 | + 果物 |
| 11 | 12 | + ハーブ・香味 |
| 13 | 14 | + ソース |
| 15 | 16 | + 魚介 |
| 23 | 24 | + スパイス・薬味 (all 9 shelves) |
| 24 | 26 | all 9 |

Observation: early game shows 「すべて」 plus 1–3 chips. That is honest (it is what can be bought). The order is fixed, so a chip's position never hints at anything hidden.

## 5. Proposed visible-shelf rule
1. `rows` = existing `shopRows(...)` (unchanged).
2. `present = shelvesPresent(rows.map(r => r.ingredient))`.
3. Chip row rendered iff `rows.length > 0` (same condition as today); chips = 「すべて」 + `present`.
4. `effectiveFilter = present.includes(active) || active === "all" ? active : "all"`.
5. Visible rows = `effectiveFilter === "all" ? rows : rows whose ingredient.id ∈ filterByShelf(...)`.
Not adopted: hiding the whole row when only one shelf is present (it changes existing behavior for no privacy gain; revisit in Phase 5).

## 6. Migration comparison (OD-CT-4)
| | A. Atomic replacement in Shop | B. Compatibility layer (keep 「トッピング」 as a parent that opens a family sub-row) | C. Keep 「トッピング」 chip next to families for now |
|---|---|---|---|
| Player-visible | 「トッピング」 gone; toppings via 「すべて」 or a family chip | two rows / two levels (violates the one-row constraint) | 11 chips; 「トッピング」 overlaps the family chips |
| Concepts | one axis | two axes mixed in one UI | two axes in one row |
| Code churn | one component + tests | adds code that is deleted later | adds a chip that is deleted later |
| Risk to Inventory | none: Shop and Inventory share no component; `CATEGORY_TAB_*` constants stay for Inventory until Phase 4 | none | none |
| Height | +11px (44 vs 33) | +44px | +11px |
| Test churn | 6 selector updates (§10) | same, twice | same, twice |
**Recommendation: A**, limited to Shop. Old → new mapping: 「すべて」→all, 「ソース」→sauce, 「チーズ」→cheese, 「トッピング」→ the 7 family chips (union = all toppings). `activeTab` is component-local and never persisted, so there is no save migration. Do **not** delete `CategoryTab` / `CATEGORY_TAB_*` in Phase 3 (Inventory still imports them).
Accepted loss to confirm (not a blocker): there is no single 「all toppings」 chip in the Shop any more.

## 7. Mobile UI proposal (390×844 / 360×800)
- One horizontally scrolling chip row (no wrap, no second row), replacing `.shop-filter-tabs` in the same position.
- Chip: `min-height: 44px`, `padding: 0 14px`, `font-size: 14px`, `gap: 8px`, `white-space: nowrap`, `flex: 0 0 auto`. No text shrinking.
- Container: `overflow-x: auto`, `overscroll-behavior-x: contain`, hidden scrollbar, `scroll-snap` off (mis-taps), right-edge fade as a decorative cue. Page-level horizontal overflow must stay 0.
- Width needed (measured at 14px, 12px padding, 8px gap): 10 chips ≈ 824px vs 328 / 358px content width. About 5 chips are fully visible (すべて, ソース, チーズ, 肉, 魚介 ≈ 323px) and the 6th is cut off, which reads as "more to the right". Early game (≤ 5 chips) fits without scrolling.
- Vertical cost: 33 → 44px (+11px) inside the already-scrolling body; the layout-contract Shop check scrolls to the end of the list, so it is unaffected. Chip row scrolls with the list (not sticky); sticky is a Phase 5 polish candidate.
- Active chip: filled background + bold + `aria-pressed="true"` (not colour alone). On selection, scroll the active chip into view (`scrollIntoView({ inline: "nearest" })`, guarded for jsdom).

## 8. Accessibility proposal
- Semantics: `role="group"` with `aria-label="材料の分類"` and `<button aria-pressed>` chips. Current `role=tab` has no tabpanel, so it over-promises; a wrapping tablist would need `tabpanel` + roving tabindex + arrow keys. `ShelfChips` is also intended for the Builder, whose screen already has a step `tablist`.
- Keyboard: every chip is a native button (Tab / Space / Enter); focus scrolls it into view.
- Announce the result via the existing polite live region pattern only if it adds no count (OD-CT-6): e.g. 「肉で絞り込みました」 (label only).
- Target size ≥ 44px; contrast follows the existing active/inactive palette; `prefers-reduced-motion` respected (no animated scroll).

## 9. PR #272 (Large Catalog UX) overlap
- State: **OPEN**, not merged, `mergeable_state: unknown`, base `e21fbc2` (main is now `8d96307`: heavily stale), 75 files, last updated 2026-09-28.
- Content: pure, unwired `src/logic/catalog/*` (working set, `catalogQuery` with category / family / text / sort, `familyCounts`). **Nothing in production imports it; it does not touch `ShopOverlay`.** It injects the family lookup and forbids importing the taxonomy (static boundary test), so it does not carry its own family table.
- Overlap: `catalogQuery.families` and `familyCounts` overlap the *idea* of `filterByShelf` / `shelvesPresent`, and `familyCounts` returns counts (OD-CT-6 defers them). It is **not** an authority duplication today: both take family ids from DH4-1. It becomes one only if Shop starts using `queryCatalog` **and** `filterByShelf`.
- Decision for Phase 3: Shop uses `ingredientShelf.ts` only. `queryCatalog` (search, sort, favorites) is LC-3 scope. If #272 later merges, a follow-up may re-express `filterByShelf` on top of `queryCatalog` without changing the Shop contract.
- #272 must be re-based before it can merge (stale); not touched here.

## 10. PR #197 relationship
PR #197's rule (a page switch must not leave an invisible selected chip) belongs to the **Builder tray** (`IngredientTray.goToPage` / `onClearSelection`). The Shop has no selection state, so Phase 3 is independent of it. The contract difference with OD-CT-5 is a **Builder-phase** re-audit item.

## 11. Hint 5.0 parity
Shelf family ids = `ATTRIBUTE_FAMILIES` ids = `HINT_CLASS_DISPLAY` keys (gated in `ingredientShelf.test.ts`, on main). `HINT_CLASS_DISPLAY` is **not** an order authority: shelf order comes from DH4-1 `ATTRIBUTE_FAMILIES`. Labels stay per context (shelf 「その他」, Hint 「ちょっと変わった材料」). The Shop needs no Hint import.

## 12. Required tests
**Component / App (updated or new)**
1. Chips = 「すべて」 + present shelves only, in shelf order; absent shelf has no chip, no DOM node (`queryByRole` null), and no text anywhere in the overlay.
2. Ladder walk (like the existing "names no undiscovered recipe" test at every Dex): at each Dex 0..24, chip set equals `shelvesPresent(listed rows)`; no chip before its first row; no count text.
3. Filter never mutates Pitz, stock, ownership, `feedback` (extends existing test K).
4. Restock after filtering: same price / quantity as unfiltered (existing G/H, re-pointed at a family chip).
5. A purchase while a shelf is active keeps the row visible (membership is static).
6. Active shelf missing → falls back to すべて (no empty state, no throw).
7. starterGrantOnly / unowned materials stay hidden under every chip (existing I/J).
8. Semantics: group + `aria-pressed`; keyboard activation; ≥44px height via CSS contract test or Playwright.
9. `LOCKED` never appears through a shelf: property test over Dex 0..24 × every shelf.
**Layout / e2e**
10. Chromium + WebKit: 390×844 and 360×800 — chip row height ≥44, one row, page horizontal overflow 0, 6th chip partially visible with 10 chips, Shop last-row check (`layout-contract.spec.ts:457`) still green.
**Existing tests to update (selector only, behavior asserted the same)**: `src/App.test.tsx` lines ~1109, 1133, 1151, 1175, 1192 (`getByRole("tab", { name: "トッピング" })` and the empty-category text). `App.globalOverlayShellSizing.test.tsx` (「トッピング」 at line 131) is the **Inventory** overlay and stays unchanged in Phase 3. `ShopOverlay.test.tsx` has no tab selectors. `e2e/progression2-discovery-ladder.spec.ts` uses only `.shop-item` and needs no change.

## 13. Implementation file list (Phase 3)
- new `src/components/ShelfChips.tsx` (+ `ShelfChips.test.tsx`)
- edit `src/components/ShopOverlay.tsx` (replace `activeTab`/tablist with shelf filter; keep everything else)
- edit `src/App.css` (replace `.shop-filter-tabs` / `.shop-filter-tab` with the chip-row styles; keep `.inventory-tab*`)
- edit `src/App.test.tsx` (selector updates) + new Shop shelf tests
- new/extend e2e measurement for chip-row layout (390×844 / 360×800)
- docs: Phase 3 Result report; HV video (390×844, delivered to Owner, not committed) + before/after screenshots under `docs/reports/screenshots/ingredient-category-tabs-shop/` (CLAUDE.md / Human Verification policy: this is a UI change)
- **Not touched:** `ingredientShelf.ts`, `ingredientTaxonomy.ts`, `ingredients.ts`, reducer, economy, inventory, Inventory overlay, Builder, #272.

## 14. Risks / blockers
| # | Item | Severity |
|---|---|---|
| R1 | Loss of an all-toppings chip in Shop (accepted by OD-CT-4; confirm) | low |
| R2 | Shop and Inventory will use different filter UI until Phase 4 (independent components; short-lived) | low |
| R3 | Early-game chip row is short (1–3 chips); honest but may look sparse | low, Phase 5 polish |
| R4 | Semantics change `role=tab` → `group`/`aria-pressed` requires selector updates in tests | low |
| R5 | #272 stale/open; possible later refactor, no current conflict | low |
| R6 | Screen-reader wording for the filter announcement (label only, no counts) | low |
| B | Technical blockers | **none** |

## 15. FINAL VERDICT: **A. READY FOR SHOP IMPLEMENTATION**
No new Owner Decision is required: the visible-shelf rule, atomic Shop-only replacement and group/`aria-pressed` semantics are all consistent with OD-CT-3..7. Two low-risk defaults are stated for Owner awareness (R1: no single all-toppings chip; §5: chip row kept whenever any row exists). Start with `ShelfChips` (presentational, unwired) + tests, then the Shop wiring.
