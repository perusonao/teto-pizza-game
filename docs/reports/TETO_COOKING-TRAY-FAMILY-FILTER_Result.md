# Cooking Tray Family Filter — Result Report (Issue #396)

Base `origin/main` **`28fcabbab119a71d4c7338aca6ee66d931097f45`** (PR #392 merged). Branch `claude/cooking-tray-ingredient-filter-6hv038`. PR open, **not merged** (no auto-merge).

## 0. Fresh Audit (main 28fcabb, nothing changed first)

| # | Question | Finding |
|---|---|---|
| 1 | Who builds the normal tray list? | `IngredientTray.tsx`: `handIds` (HAND) if given, else `trayIngredientsFor(category, {owned, freeCook, recipe})` (`logic/prepareDock.ts`). |
| 2 | 6 slots / pagination authority | `MAX_INGREDIENT_PALETTE_SLOTS = 6` (`data/ingredients.ts`); paging is local state in `IngredientTray` (`page`, `goToPage`). |
| 3 | HAND / pin | App resolves `resolveTrayHandIds` (pins + priority, capacity 12) and passes the resulting ids as `handIds`; the tray only slices them. So HAND/pin is already applied **before** the tray sees the list. |
| 4 | FREE / Research / guided / Lunch / Dinner | Guided / Lunch / Research lists are recipe-required subsets (≤ 6 per category, no pager). FREE and Dinner list every owned ingredient and can page. |
| 5 | #392 reuse | `ingredientShelf` (`familiesPresent`, `filterBySelection`, `ingredientShelfLabel`) + `familyDisplay` labels + `ShelfChipRow` are reused as-is. `ShelfTabs` / `FamilyTag` are Pantry/Inventory/Shop widgets and are not used by the tray. |
| 6 | Order | population (ownership) → HAND/pin → **family filter** → pagination. The filter never feeds back into HAND capacity or pins. |
| 7 | Vertical room | The dock reserves one 28px utility row (食材庫 · pager) per round, and `layout-contract` / `LC-R3` pin the dock and the short-viewport pizza floors. **A new row fails them** (measured: first attempt, dock +34px, 390×664 pizza 262 → 236). |
| 8 | sauce / cheese | No family row (the row exists only when `activeCategory === "topping"`). |
| 9 | Gestures / selectors | New chips use their own classes (`tray-family-chip*`), `data-tray-family`, group `aria-label` 「具材の絞り込み」 and per-chip aria-labels, so no Pantry / Inventory / Shop selector (`.shelf-chip`, `data-shelf`, 「具材の分類」, "すべて", "肉系") can match them. Tray chips, drag and `aria-pressed` selectors are untouched. |
| 10 | #392 Pantry | Untouched (Pantry / Inventory / Shop DOM snapshots byte-identical; pantryShell unit tests only scoped to the dialog). |

**Duplicate Gate:** no open Issue / PR with this purpose. #380 is the Pantry pin-affordance (inside 食材庫), a different problem → new Issue **#396**.

## 1. What changed

- `src/logic/trayFamilyFilter.ts` (pure): `trayFamilyChoices` (chips exist only when the tray list needs paging, i.e. > 6, and spans ≥ 2 families), `resolveTrayFamily`, `applyTrayFamily` (over `ingredientShelf`; no new taxonomy / family id).
- `IngredientTray`: family state; filtered list → pagination. Family change: page → 1, in-flight drag ended, a selection the filter hides is cleared (same contract as a page switch, PR #197 P2). Category change → すべて.
- **Placement:** inside the existing utility row — `[🧺 食材庫] [すべて 肉系 魚介系 …(scrolls sideways)] [◀ 1 / 2 ▶]` (`ingredient-page-nav--with-family`). No new row, **dock height Δ0**. The pager keeps its place (idle, invisible) when the filtered list fits one page, so the chips never change width.
- Scroll affordance: a chip cut by the row's right edge + a 22px right fade (`tray-family-chips--more-right`, set from scroll state), 28px compact chips, 6px gaps.
- `ShelfChipRow`: optional `compact` variant + `option.ariaLabel`; default path unchanged.
- Production DOM golden re-baselined (`rebaselineNote4`): only `free22.topping.page1–4` / `afterPantry` change (class + the added chip group, verified by line diff); everything else byte-identical.

Not changed: recipe data, progression, Research membership, Hint 5.0, save schema, inventory, HAND capacity / pin logic, #392 Pantry / Inventory / Shop, TQ-1D, Wave 3, Lunch Rush v2, Dinner Mission, #391 / #394.

## 2. When the filter appears

Only on the 具材 step, only when the tray list (after ownership and HAND) has more than 6 items and ≥ 2 families. So guided / Lunch / Research / a small Dinner list keep today's DOM exactly; FREE with a large owned set (the case that pages) gets the chips. HAND ON (≥ 13 owned, hand 12) and HAND OFF (7–12 toppings) are both covered.

## 3. Before / after (390×844 and 360×800, FREE, 具材 step on arrival)

| | before | after |
|---|---|---|
| Tray | 6 cards + `[食材庫] 1 / 2` | 6 cards + `[食材庫] [すべて｜肉系｜魚介系｜…] [◀ 1 / 2 ▶]` |
| Pizza diameter DOUGH / SAUCE / CHEESE / TOPPING | 290 / 290 / 290 / 290 (390) · 274 ×4 (360) | identical |
| Tray top y | 598 (390) · 554 (360) | identical |
| Dock height | pinned by LC-R3 | Δ0 (LC-R3 passes at 1.5px) |

Screenshots: `docs/reports/screenshots/cooking-tray-family-filter/` (`before-*`, `after-*-topping-arrival`, `after-*-filtered`, HAND on / off).

## 4. Tests (risk-based; the final tree)

- `tsc -b` clean, `oxlint` only the 2 pre-existing warnings on main, `npm run build` OK.
- **Vitest full: 343 files, 6207 passed, 1 skipped.** New: `trayFamilyFilter.test.ts`, `IngredientTray.familyFilter.test.tsx` (row presence, sauce/cheese none, one-page none, filter + page reset + すべて restore, HAND population, selection clear/keep, category reset, idle pager). Updated: `GameScreen.pantryShell.test.tsx` (chip helper scoped to the dialog).
- **Chromium E2E** (iphone-390x844, iphone-360x800, layout-chromium): new `e2e/cooking-tray-family-filter.spec.ts` (390 + 360 × HAND on/off, pagination reset, pin kept through a filter, Pantry family row unchanged, sauce/cheese none, pizza size stable across steps, no page scroll); plus layout-contract, large-catalog-pantry-{shell,shelves,search}, lc-hand-preview-activation (golden), lc-hand-pin-ui, stage-size-stability, making-ui-1screen, free-cooking-phase3-2, ingredient-shelf-{inventory,shop}, large-catalog-production-pantry, layout-invariants-lb, dinner-mission — pass.
- History, honestly: the first design (a separate chip row above the tray) **failed** layout-contract / LC-R3 (dock +34px; short-viewport pizza −26px) and was replaced by the in-row layout; a first try with 30px pager buttons broke the registered `36x28` tap-target finding and was reverted to 36px; same-name chips clashed with Pantry selectors and got distinct classes / aria-labels. No gate, timeout, retry or skip was changed.
- WebKit was not run locally (CI runs it). Test-gap: the Human Verification **video** is not produced here (screenshots only, as requested).

## 5. Residual risks

- Chip height is 28px (the row's existing control height). The dock / pizza contracts forbid more; the pager next to it is 36×28 on the same registered finding.
- The row is tight: at 390 the visible chips are すべて · 肉系 · part of 魚介系; at 360 すべて · 肉系 · a sliver. When the filtered list fits one page the idle pager leaves a short empty gap where the fade is less obvious.
- The Pantry and the tray behind it both expose family chips; tray chips have their own accessible names (`…の具材だけ表示`) to keep them distinct.

## 6. Codex P2 follow-up (fix on a new HEAD)

Finding: a Pantry pin that changes the HAND judged the selection with `handTrayTransition` against the **unfiltered** first page, while a family-filtered tray shows the **filtered** first page, so a selection still visible there was cleared.

Fix (no state lifted, helper and HAND/pin authority unchanged): the tray publishes its current family through a write-only ref (`familyRef`, passed App → GameScreen → tray). When the existing transition decides to clear, App re-checks the same pure rule the tray renders (`familyFirstPageIds`: population → family filter → page 1) and keeps the selection if it is still on that page. A filtered position is never later than the unfiltered one, so this only ever keeps more; a selection that left the hand or the filtered page is cleared as before, and an unfiltered tray is byte-identical in behavior. Family switch pruning and pagination pruning (`changeFamily` / `goToPage`) are untouched.

Tests: `App.handTray.familyFilter.handOn.test.tsx` (hand-on 9 and 12) — keep on filtered page 1 (fails without the fix at both capacities), clear when truly displaced, unfiltered rule unchanged, family switch still clears a hidden selection and keeps the pin; `trayFamilyFilter.test.ts` (`familyFirstPageIds`). Re-run on this change only: tsc, oxlint, the focused Vitest suites (App.handTray*, tray, catalog, screens: 463 passed) and Chromium `cooking-tray-family-filter` + `lc-hand-pin-ui` + `lc-hand-preview-activation` (golden unchanged). Full Vitest was not repeated (the change is confined to App's transition, the tray ref and a new pure helper).
