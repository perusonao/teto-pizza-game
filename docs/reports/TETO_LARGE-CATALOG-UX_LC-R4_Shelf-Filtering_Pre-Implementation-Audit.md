# Large Catalog UX — LC-R4 Shelf Filtering: Fresh Pre-Implementation Audit

Docs/audit only. No production, CSS, e2e or runtime file was changed. PR #305 (branch / files) was read, not touched; not merged; LC-R4 not implemented.

1. **Audited main SHA:** `2d3357e7cf222646624c8ec49e4930472c0083b1`
2. **Audited PR #305 HEAD:** `c0d2b6acd4e9aca44c30939f00c65b7977b46dac` (state at audit: **OPEN**, mergeable_state `unstable` = CI / WebKit Gate pending). All findings below are about that HEAD; re-check that the merge commit equals it before starting R4.

## 3. Pantry current architecture (PR #305 HEAD)
- `GameScreen` owns `pantryOpen` (bool) + `pantryEntryRef`. `pantryAvailable = isLargeCatalogEligible(state) && phase === "PREPARE" && makingStep !== "DOUGH" && dockReserve.pager`. `pantryVisible = pantryOpen && pantryAvailable`. `cookingInputPaused = isGlobalOverlayOpen || pantryVisible`. Leaving the eligible screen resets `pantryOpen` during render.
- `IngredientPantry` is **mounted only while visible** (`{pantryVisible && <IngredientPantry …/>}`), so any `useState` inside it dies on close.
- Props: `category` (= active step category), `ownedIngredientIds`, `inventory`, `onClose`. It calls `queryCatalog(runtimeCatalog(), {ownedIds, stock}, emptyUsageSession())` and then `.filter(item.category === category)`. **No `shelves` is passed yet.**
- Sheet DOM: fixed `.pantry-sheet` (flex column, `overflow:hidden`, one outer height `min(70dvh, 100dvh − safe-top − 20px)`): `.pantry-sheet__header` (title + 閉じる, `flex:none`) → `.pantry-sheet__subtitle` (`flex:none`) → `.pantry-sheet__list` (`flex:1 1 auto; min-height:0; overflow-y:auto`, focusable region) → 3-col `ul.pantry-sheet__grid` of non-interactive `li.pantry-tile`.
- The tiles are **read-only** (no button, no `onSelect`). The pantry never touches `selectedIngredientId`.
- The Builder tray (`IngredientTray`) is fed by `trayIngredientsFor(...)` and its own `page`; it does **not** read any pantry state. `HAND_ENFORCEMENT_ENABLED=false`, working set / hand are unwired.

## 4. ShelfChips integration point
- `src/components/ShelfChips.tsx` (already on main; used by `ShopOverlay` and `InventoryOverlay`): props `shelves`, `active: ShelfFilter`, `onChange`, `ariaLabel`. Stateless; renders 「すべて」 then `shelves` in given order; `role="group"`, `aria-pressed` toggles, `data-shelf`; own row scroll-into-view touches only the row's `scrollLeft`; no counts. CSS `.shelf-chips` / `.shelf-chip` already exists (44px min, 14px, `flex:0 0 auto`, nowrap, `overflow-x:auto`). **No new component and no new CSS class for the chips themselves are needed.**
- Integration: inside `IngredientPantry`, as a `flex:none` child **between the subtitle and the list** (outside the scroll region), wrapped in a pantry-specific spacing wrapper (analogue of `.inventory-overlay__shelves`). Reuse `ariaLabel="材料の分類"` (same as Shop / Inventory).
- Data flow (mirrors `InventoryOverlay`): `ownedRows` (already computed for the category) → `presentShelves = shelvesPresent(ownedRows)` → `shelfFilter = activeShelf==="all"||presentShelves.includes(activeShelf) ? activeShelf : "all"` → rows = `queryCatalog(..., { shelves: shelfFilter==="all" ? undefined : [shelfFilter] })` restricted to the category. Membership stays in `ingredientShelf` (through `CatalogIngredient.shelf`), owned/filter in `catalogQuery`; `IngredientPantry` only holds the UI state. No taxonomy / authority is added. Do **not** use `filterByShelf` alongside `queryCatalog({shelves})` (two filters = drift); pick `queryCatalog` (the R3 pantry already goes through it).

## 5. Shelf state ownership
`useState<ShelfFilter>("all")` **local to `IngredientPantry`** (the same as Shop and Inventory; both keep the choice in the component and derive `"all"` when the stored shelf is no longer listed). Not in `GameScreen`, not in App, not in the save, not in `GameState`. Reason: it is UI-only, the pantry is unmounted on close, and lifting it would create a second owner alongside `pantryOpen`.

## 6. OWNED-only derivation
- `presentShelves` must be derived from the **owned rows of the active category** (the list the player could see with 「すべて」), never from `runtimeCatalog()` / `INGREDIENT_SHELVES` / Shop entitlement / hints. Same construction Inventory uses (`shelvesPresent(owned)`).
- `queryCatalog` already returns owned rows only; `shelves` is ANDed on top. `ShelfChips` renders only what it is handed, so a shelf with no owned row has no chip, DOM node, `data-shelf` or text.
- **Category scoping (important, contradicts the task's candidate list):** the R3 pantry is scoped to the active step's category. On the SAUCE step the only possible shelf is `sauce`; on CHEESE only `cheese`; only the TOPPING step has the 7 family shelves. So 「ソース」「チーズ」 chips can **never appear** with the current R3 scoping, and on SAUCE / CHEESE the row would be 「すべて」+one chip (identical results).
  - Recommendation: render the row only when `presentShelves.length >= 2` (a one-shelf chip row filters nothing and only costs 54px). This is also a privacy-neutral rule (derived from owned rows).
  - Whether the pantry should stay per-category (R3 decision) or become all-category with ソース/チーズ chips is **Owner Decision OD-R4-1**; R4 default = keep R3 scoping, no change.
- Privacy negatives to pin: no chip for an unowned shelf; unowned names / LOCKED / NEW-only / silhouette / `???` / counts absent; a shelf whose only ingredients are owned in *another* category does not appear; chip set is a function of owned rows only (buying nothing changes nothing).

## 7. Unclassified behavior
`shelf === null` (`ingredientShelf` fail-closed; toppings without a taxonomy family): `queryCatalog` already excludes `null` from every `shelves` filter (`item.shelf !== null && …`) and includes it when `shelves` is undefined. `shelvesPresent` skips `null`. So: visible under 「すべて」 only, never gets a chip, no guess. Today `auditShelfAuthority` is ok for the 30 production ingredients, so it is a fail-closed path only (test with an injected descriptor; the runtime catalog cannot produce it). 62-ingredient activation stays out of scope.

## 8. #197 selection behavior (exact code reading)
- `selectedIngredientId` lives in `App.tsx` (`useState`), is passed to `GameScreen` → `IngredientTray`, and is set only by tray taps / physical drop / step change / round change. `IngredientPantry` neither receives it nor has a setter. Pantry tiles are non-interactive.
- `selectionAfterVisibleChange` exists in `handSession.ts` (unwired; it states PR #197's `goToPage` rule for a **Builder** visible set).
- **The pantry's shelf filter changes only the pantry list. The Builder tray's visible set (its owned page, `HAND_ENFORCEMENT_ENABLED=false`) is unchanged by any pantry action.** So a pantry shelf change can never remove `selectedIngredientId` from the set the player can select from; `selectedIngredientId` also cannot be "in" the pantry list in any actionable way (tiles are not selectable).
- **Contract for R4: do NOT clear the selection on pantry shelf change, open or close. Do not wire `selectionAfterVisibleChange` in R4.** Clearing would be an *unneeded* clear (the task said to avoid it) and would also violate the R3 promise "open/close changes nothing".
- The premise "R4 is where the visible set first changes" is true only for the pantry's own list. The Builder's visible set first changes at R5 (hand / picks / enforcement); `selectionAfterVisibleChange(selected, handBefore, handAfter)` is wired there, keyed on the **hand** (`handVisibleIds`), not on the pantry filter. Not to be confused with OD-2 picks (a separate future state, never cleared by filter / search / shelf).
- Test in R4 that pins this non-clearing (see plan).

## 9. Filter reset / reopen recommendation
- Existing precedent: Shop and Inventory both keep the shelf in local state and are unmounted on close ⇒ **reset to 「すべて」 on every open**. `docs/PROJECT_HANDOFF.md` / Revision Gate contain no rule for persisting pantry shelf state, and OD-R2-3 says session-only state without save change (that concerns hand/picks, not the shelf).
- Recommendation: **reset to 「すべて」 on close/reopen (local `useState`), no persistence across steps or rounds.** Persistence would need lifting state to `GameScreen` and a rule per category (a `meat` chip on the TOPPING step means nothing on SAUCE); no authority exists ⇒ report as **OD-R4-2 (low risk, default = reset)**. R4 may proceed with the default without waiting.
- Also: when the stored shelf stops being listed, fall back to `"all"` by derivation (as Inventory does).

## 10. Stable-height layout plan
- Keep the sheet's outer height exactly as R3 (`min(70dvh, 100dvh − safe-top − 20px)`, never `auto`). Do **not** change `.pantry-sheet` height, padding, header or subtitle.
- Structure: header (flex:none, pinned) → subtitle (flex:none) → **chip wrapper (flex:none, outside the scroll region)** → list (flex:1 1 auto, min-height:0, only scroller). Chips are pinned; the list absorbs the height (the list already `flex:1; min-height:0`).
- The chip row is a horizontally scrolling row (`overflow-x:auto; overflow-y:hidden`), never wraps, so it never grows vertically and never adds rows.
- Conditional row: when hidden (<2 shelves) the list simply gets the height back; the outer sheet bounds are identical in all cases.
- Filtering to few / zero rows must not change bounds: the grid lives inside the scroller and the empty text is inside the scroller.
- On chip change reset `list.scrollTop = 0` (the scroller element persists across filters, so the old offset would otherwise strand the user mid-list or on blank space). Touch only the list's own scrollTop, never the page.
- Only CSS additions expected: a `.pantry-sheet__shelves { flex: 0 0 auto }` wrapper (no margin; spacing comes from the sheet's existing `gap: 8px`). `.shelf-chips` untouched.
- Nothing scrolls the page / body: the sheet is `position:fixed; overflow:hidden`, chip row scroll is `overscroll-behavior-x:contain`.

## 11. Mobile layout risk (pre-evaluation; computed from the R3 sheet heights, subtitle ≈ 16px, gaps 8px; must be measured in the R4 e2e)
Sheet outer heights (R3 result): 590.8 / 560 / 464.8 / 448. Sheet inner width = viewport (max 390) − 32.

| viewport | sheet h | list h now | list h with chips (−54: 44 chip + 2 pad + 8 gap) | chip row width |
|---|---|---|---|---|
| 390×844 | 590.8 | ≈ 483 | ≈ 429 (−11%) | 358 |
| 360×800 | 560 | ≈ 452 | ≈ 398 (−12%) | 328 |
| 390×664 | 464.8 | ≈ 357 | ≈ 303 (−15%) | 358 |
| 360×640 | 448 | ≈ 340 | ≈ 286 (−16%) | 328 |

- Tile ≈ 70px tall + 8px gap ⇒ the smallest list shows ≈ 3.5 rows (≈ 10 tiles) with chips; still a real list. Acceptable; no height added to the sheet.
- Chip row horizontal width (14px bold, 12px×2 padding, 8px gap, min 44px), TOPPING step with all 7 families + すべて ≈ 700px > 328–358 ⇒ **the row scrolls horizontally (≈ 2× the width)** at every viewport. That is intended (ShelfChips design) and the cut-off chip at the right edge is the scroll affordance. Pin: `scrollWidth > clientWidth` at 360 with all shelves; `scrollLeft` moves only the row; page `scrollX` stays 0.
- SAUCE / CHEESE (one shelf): row hidden ⇒ no cost.
- 閉じる stays ≥ 44px and pinned (header unchanged). Chips ≥ 44px (`min-height:44px` from `.shelf-chip`), vertically fine: 44 + 2px scrollbar padding.
- No body scroll: unchanged (fixed overlay). Short viewports (640): sheet 448, list 286 ⇒ still ≥ 3 rows; must not go below the 44px close + 44px chip + a visible tile.
- Risk: the 2px `padding-bottom` of `.shelf-chips` plus the 8px gap adds 10px of non-content; acceptable, not to be tuned in R4.

## 12. Entry availability issue (R3 gate: entry only if `dockReserve.pager`)
Cases where the temporary gate matters (R4 must **not** change it):
1. The player owns ≤ 6 in every category ⇒ no pager row ⇒ no entry. Harmless for R4 (a ≤ 6 category needs no filter, and the R4 chip row needs ≥ 2 shelves anyway).
2. Pager exists only because of one category (e.g. 7+ toppings); the entry then appears on SAUCE / CHEESE too (small lists, chip row hidden). Cosmetic only.
3. `pager` is computed per round from `trayIngredientsFor`; a mid-session ownership change is recomputed on the next round; a pantry that could help earlier is not offered until then.
4. A profile / step where the pager row is not reserved (`prepare-dock--no-pager`) has no room for the entry by design.
5. **R5 problem (decision material):** once the hand caps the tray at 9 / 12, the pager can vanish (hand ≤ 6 per page or single page) while the pantry is exactly what the player needs; and the reverse (pager forced by ownership though the hand is small). Coupling pantry availability to pager availability then hides the only way to change the hand.
6. R4 is unaffected because the tray is unchanged; shelves in the pantry are meaningful only when a category has ≥ 2 shelves owned, which in practice is the TOPPING step and also implies ≥ 2 owned toppings.
- Judgement for R5/R6: **split** `pantryAvailable` from `dockReserve.pager` at R5 (pantry availability = eligible round + PREPARE tray step + ≥ 1 owned; pager row = tray-page concern only). The split needs a home for the entry that is not the pager row; if that needs extra height it collides with the stage-size / dock contract ⇒ Owner decision at R5 (OD-R4-3, informational; nothing to decide for R4).

## 13. Accessibility plan
- `ShelfChips` as is: `role="group"` + `aria-label="材料の分類"`, `<button aria-pressed>` toggles (not tablist; no tabpanel), active chip has non-colour cue (underline). Exactly one chip pressed.
- Keep the dialog semantics from R3 (focus on 閉じる on open, Escape, backdrop, focus return to the entry). Chip taps must not move focus out of the sheet or close it.
- Escape while a chip is focused still closes (the `onKeyDown` is on the section).
- List region keeps `role="region"` + `aria-label="所持している材料"` + `tabIndex=0`; consider (implementation detail) that the filter changes list contents without a live announcement — acceptable and consistent with Shop / Inventory; no `aria-live`, no counts announced.
- Tab order: 閉じる → chips → list.
- 44px targets: chips (`min-height:44px`), 閉じる (44 already).

## 14. Privacy result
**PASS by design** provided: (a) `presentShelves` derives from owned rows of the active category only; (b) `queryCatalog` remains the only row source (OWNED-only); (c) no counts; (d) `null`-shelf ingredients never generate a chip; (e) no hidden nodes (`ShelfChips` renders none). Residual inference: a chip for `meat` implies the player owns a meat topping, which is the player's own state, not an unowned ingredient. No LOCKED / NEW-only / silhouette / `???` path exists in the pantry.

## 15. Test plan (R4)
Unit / component (`vitest`, jsdom):
- chips derive from OWNED rows: with owned = {A,B on shelves meat, vegetable}, chips = すべて, 肉, 野菜・きのこ, in `INGREDIENT_SHELF_ORDER`.
- 「すべて」 shows all owned category rows (incl. unclassified); default active is すべて.
- each represented shelf: chip → exactly that shelf's owned rows (ids asserted, catalog order kept, zero-stock-last kept).
- absent shelf: no chip, no `data-shelf`, no label text in the DOM; unowned names absent in every filter state.
- unclassified (`shelf:null` via an injected catalog descriptor / mocked `ingredientShelf`): visible in すべて, in no shelf, no chip.
- `aria-pressed` exactly one true; toggles on tap; group label.
- < 2 shelves ⇒ no chip row (SAUCE / CHEESE steps); ≥ 2 ⇒ row.
- stored shelf no longer present ⇒ falls back to すべて.
- selection: with `selectedIngredientId = X`, changing pantry shelf (X hidden in list) leaves `selectedIngredientId`, tray chip `aria-pressed`, `GameState` JSON, and the dispatch spy untouched (**no clear**); open/close unchanged.
- privacy: no counts (no digits besides `×n` stock), no LOCKED / NEW / `???`, unowned names absent.
- close/reopen ⇒ すべて (reset) — the default recommendation; no persistence across steps.
- Dinner regression: no entry / no pantry / no chips in Dinner (existing R3 gate tests stay green); guided / Lunch Rush unchanged.
- boundary tests: `IngredientPantry.tsx` may additionally import `ShelfChips`, `shelvesPresent`/`ShelfFilter` from `ingredientShelf` only; `handSession` / `selectionAfterVisibleChange` remain unimported by production (mutant: wiring it fails).
- Mutation additions: chips built from catalog not owned rows; unclassified given a shelf; selection cleared on shelf change; chip row inside the scroller; outer height depends on filter.

E2E (Chromium real layout, 390×844, 360×800, 390×664, 360×640; WebKit runs in CI):
- outer pantry bounds (x,y,w,h) identical across all filters, 0 → many rows, and with / without the chip row (given fixed sheet height rule); stage Ø / dock / pager unchanged.
- header / 閉じる position and ≥ 44px unchanged across filter changes.
- chips ≥ 44px tall / ≥ 44px wide, pinned (do not move when the list scrolls).
- chip row scrolls horizontally on TOPPING with all shelves (`scrollWidth > clientWidth`), the page does not (`window.scrollX/Y = 0`, `body` scroll height = viewport); active chip kept in view.
- list is the only vertical scroller; switching shelf resets list `scrollTop` to 0; PageDown scrolls the list only.
- short viewport (390×664, 360×640): at least one tile row visible under the chip row; no body scroll.
- close / Escape / focus return still work after filtering; cooking continues; reopen ⇒ すべて.

## 16. Expected production files
- `src/components/IngredientPantry.tsx` (local shelf state, `shelvesPresent`, `queryCatalog({shelves})`, `<ShelfChips>`, list scroll reset)
- `src/App.css` (append-only: `.pantry-sheet__shelves` wrapper; nothing else)
- No change expected in `GameScreen.tsx`, `IngredientTray.tsx`, `catalogQuery.ts`, `ingredientShelf.ts`, `ShelfChips.tsx`, `handSession.ts`, `App.tsx`, state, save.

## 17. Expected test files
- `src/screens/GameScreen.pantryShell.test.tsx` (extend) or a new `src/components/IngredientPantry.shelves.test.tsx`
- `src/logic/catalog/catalogBoundary.test.ts` (allow-list update for the new imports; `handSession` still unimported)
- `e2e/large-catalog-pantry-shell.spec.ts` (extend) or new `e2e/large-catalog-pantry-shelves.spec.ts`
- `tools/large-catalog-ux/mutation-check.mjs` (new mutants)
- HV video (390×844, delivered directly, not committed) + before/after screenshots under `docs/reports/screenshots/large-catalog-pantry-shelves/` (per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`); R4 Result report.

## 18. Owner Decisions required
None blocking R4 if the defaults below are accepted:
- **OD-R4-1 (default: keep R3 per-category pantry; chip row only when ≥ 2 shelves present):** the task's candidate list includes ソース / チーズ, which can't appear in a per-category pantry. If the Owner wants an all-category pantry with those chips, that is a scope change (R3 scoping + subtitle + stable-height design) and should be decided before R4 starts.
- **OD-R4-2 (default: reset to すべて on every open):** no existing authority for persistence.
- **OD-R4-3 (informational, R5/R6):** split pantry availability from pager availability; needs an entry home that doesn't add height.
- Existing open items unrelated to R4: OD-R2-1 (capacity 9 vs 12), OD-R2-2, OD-R2-3.

## 19. Blockers
- **PR #305 is OPEN** (CI / WebKit Gate pending, not merged). R4 must not start until it is merged; R4 branches from the merge result of main. Re-audit only if the merged HEAD differs from `c0d2b6ac…` in `IngredientPantry.tsx`, `IngredientTray.tsx`, `GameScreen.tsx` or `App.css`.
- No technical blocker inside the code: every dependency (`ShelfChips`, `shelvesPresent`, `queryCatalog({shelves})`, CSS) already exists on main / the PR.
- WebKit for the R3 CSS has not been observed yet; R4 must inherit its result.

## 20. Recommended R4 implementation slices
1. **R4-a (logic wiring, no visual change if <2 shelves):** local `activeShelf`, `presentShelves`, derived fallback, `queryCatalog({shelves})`; component + privacy + unclassified + selection-not-cleared tests.
2. **R4-b (chips + layout):** render `ShelfChips` between subtitle and list (`flex:none` wrapper, ≥ 2 shelves), list scroll reset, CSS append; e2e at 4 viewports (bounds, 44px, horizontal scroll, no body scroll, short viewport).
3. **R4-c (verification):** mutation gate, Dinner / guided regression, HV video + screenshots, Result report, PR (WebKit in CI).
Do not include: search, picks, hand enforcement, capacity, counts, sticky, taxonomy, 62 activation, Dinner, save migration, #295, `CATEGORY_ORDER`, Hint LC-4.

---

**FINAL VERDICT: A. LC-R4 READY AFTER #305 MERGE** — with defaults for OD-R4-1 (per-category pantry, chips only when ≥ 2 shelves) and OD-R4-2 (reset on reopen). If the Owner instead wants an all-category pantry with ソース / チーズ chips, the verdict becomes **B** for that point. R4 must not start while #305 is OPEN.
