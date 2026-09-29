# Large Catalog UX — LC-R3 Result (Pantry Sheet Shell)

The first slice that changes the running game: a 「食材庫」 entry and a pantry sheet SHELL on the FREE Cooking cooking screen. **No** ShelfChips, shelf filter, search, picks, hand enforcement, counts, Dinner change, save change or `selectedIngredientId` change. `HAND_ENFORCEMENT_ENABLED` stays `false`. #295, taxonomy, 62 activation, Phase 5, `CATEGORY_ORDER`, LC-4 and the frozen #272 (`f5b0ab5`) untouched. No PR.

1. **Source:** `origin/main` `2d3357e7cf222646624c8ec49e4930472c0083b1` (unchanged); LC-R2 HEAD `b827445140e7da66efb6b4aefb197301663f3b7d` (unchanged; tree clean; `ingredientShelf` unchanged; #295 branch not present / untouched).
2. **Branch:** `claude/lc-r3-pantry-shell` (from the LC-R2 HEAD). HEAD: see the branch tip.

## Cooking-screen eligibility gate (GameScreen)
`pantryAvailable = isLargeCatalogEligible(state) && state.phase === "PREPARE" && state.makingStep !== "DOUGH" && dockReserve.pager`
- `isLargeCatalogEligible` = `roundKind === "FREE_COOK"` and `dinner === null` (OD-1; never `freeCook` / `recipeFreeTray`).
- `PREPARE` + a non-DOUGH step = the tray is actually on screen. The R2 finding is covered: `createInitialGameState()` (empty Dex) is a `FREE_COOK` round in `ORDER` — no tray, no entry (tested).
- `dockReserve.pager` = the pager row the dock already reserves for the round (some step has > 6 owned). No reserved row ⇒ no room ⇒ no entry (a player who owns ≤ 6 per category cannot need a pantry, and no row is ever added).
Dinner, guided, Lunch Rush, ORDER-only and DOUGH states never show it; a FREE-kind state that still carries a Dinner session does not either.

## Entry placement and stage
The entry is a sibling inside the **existing 28px pager row**, pinned to the row's left edge, left of the (centred) pager; one page or many. No new row, no height change. The visual button is 28px; an `::after` extends the hit area to **44px** (8px below = exactly the fixed spacer above the bake bar; 8px above = the 6px row margin plus ≤ 2px into the first chip column's bottom edge — the only way to reach 44px without adding height).

**Stage before / after** (before = LC-R2 harness numbers on the code without the entry, `TETO_LARGE-CATALOG-UX_HAND-CAPACITY-COMPARISON.json`, hand22 = today's full tray; after = asserted in `e2e/large-catalog-pantry-shell.spec.ts` on this branch):

| viewport | pizza stage Ø | dock height | pager row | sheet height (open) |
|---|---|---|---|---|
| 390×844 | 290 → 290 | 174 → 174 | 28 → 28 | 590.8 |
| 360×800 | 273.6 → 273.6 | 174 → 174 | 28 → 28 | 560 |
| 390×664 | 269.1 → 269.1 | 162 → 162 | 28 → 28 | 464.8 |
| 360×640 | 245.1 → 245.1 | 162 → 162 | 28 → 28 | 448 |
The stage also stays at that size while the sheet is open and after it closes.

## Architecture
- `src/components/IngredientPantry.tsx` (new, pantry-specific; `InventoryOverlay` is NOT reused: it is read-only by type). Props: `category`, `ownedIngredientIds`, `inventory`, `onClose`. Rows come from `queryCatalog(runtimeCatalog(), owned, emptyUsageSession())` filtered to the active step's category — OWNED-only by construction.
- `IngredientTray.tsx`: optional `pantryEntry` prop; only when present does the pager row use the with-entry structure. Without it the DOM is byte-for-byte what it was (guided / Dinner / Lunch Rush and every non-eligible state).
- `GameScreen.tsx`: `pantryOpen` (UI state only), the gate, `cookingInputPaused = isGlobalOverlayOpen || pantryVisible` (the same input pause the global overlays use), focus return effect, and the sheet render next to the hint sheet. Leaving the eligible screen resets `pantryOpen` (no self re-open).
- Production importers of `src/logic/catalog` are now allow-listed per file and per module: `IngredientPantry.tsx` → `catalogQuery`, `catalogSource`, `usageSignals`; `GameScreen.tsx` → `freeEligibility`. The working set, hand operations, hand policy and hint disclosure stay unwired (boundary test + mutant M39/M15).

## Stable-height sheet (PR #304 contract, pantry-specific CSS)
Fixed viewport overlay in the hint sheet's centred column (z 25, above the bake bar); **one outer height** `min(70dvh, 100dvh − safe-top − 20px)` regardless of row count (3 sauces and 22 toppings give the same height, asserted); header (title + 閉じる ≥ 44px) pinned; a single scroller `.pantry-sheet__list` (`role="region"`, labelled, `tabIndex=0`, focus ring, `overscroll-behavior: contain`); bottom padding includes `env(safe-area-inset-bottom)`; page / body never scroll.

## OWNED-only / privacy
Only owned rows of the active category: no LOCKED, NEW-only / unpurchased, silhouette, `???`, hidden name, and **no counts** (no category count, no "n種"). Zero-stock owned rows are last with `×0` (LC-OD-17). Tested with 10 owned of 22 toppings: exactly those tiles, and no unowned name appears anywhere in the dialog.

## State, focus, keyboard, selection
- State added: `pantryOpen` + the entry ref. No picks, shelf, search or hand state; nothing dispatched; no save field.
- Open: dialog (`role="dialog"`, `aria-modal`, labelled) and focus enters on 閉じる. Close (button / backdrop tap / Escape inside the dialog) returns focus to the entry.
- Keyboard: the list is a focusable region; `PageDown` scrolls the list and not the page (measured); Escape closes.
- Selection: open / close changes nothing (`selectedIngredientId`, tray chips, game state JSON are identical before / after; no #197 clear — nothing is filtered yet). #197 applies from R4 / R5.
- While open the cooking inputs are paused (a dough tap places nothing); after closing they work again.
- Hand enforcement: OFF; the tray's reachability is unchanged (every owned topping is still on its pages).

## Verification
- Focused: `GameScreen.pantryShell.test.tsx` 20 tests (eligibility incl. ORDER-only / DOUGH / Dinner / guided / Lunch Rush / forged, open / close / Escape / backdrop / focus, OWNED-only privacy, input pause, "opening changes nothing", enforcement off, reachability); boundary updated. Full Vitest **245 files, 4843 passed, 1 skipped**.
- `tsc -b` clean; `oxlint` no findings in changed files; `vite build` OK (no working-set / hand / enforcement code in `dist/`).
- Chromium E2E (real layout): `e2e/large-catalog-pantry-shell.spec.ts` at all four viewports (390×844, 390×664 on the 390 project; 360×800, 360×640 on the 360 project) — stage / dock / pager unchanged, entry inside the row with a 44px hit area, sheet fixed height, close visible ≥ 44px, list scroll ownership, PageDown, Escape, focus return, cooking continues: **pass**. Regression on the same run: `free-cooking-phase3-2`, `dinner-mission`, `stage-size-stability`, `layout-invariants-lb`, `discovery-hint-sheet`: **47 passed** (15 intentional skips); Layout Contract on `layout-chromium` (7 profiles): **12 passed**.
- **WebKit:** the CI classifier (`scripts/ci/classify-webkit-pr.sh`) resolves any `src/**` runtime change to `webkit_required=true`; only Chromium exists in this sandbox, so the WebKit Gate and the WebKit shards run in CI once a PR exists. Not run here.
- Mutation gate: **41/41 killed** (34 + M33 Dinner entry, M34 pantry lists unowned, M35 no focus return, M36 input not paused, M37 no focus entry, M38 Escape dead, M39 hand wired early).

## 44px entry hit-box audit (pre-PR, fresh)
Tool `tools/large-catalog-ux/entry-hitbox-audit.mjs` → `docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R3_ENTRY-HITBOX-AUDIT.json`: 0.5px-grid `elementFromPoint` sampling around the entry and the chip row above it, on the SAUCE / CHEESE / TOPPING steps, at 390×844, 360×800, 390×664, 360×640.
- Geometry (identical at all four viewports): chips end 6px above the row, the entry's visual box is the 28px row, the fixed bake bar starts 8px below the row (e.g. 390×844: chips end 732, entry 738–766, bar 774). Total free height = 6 + 28 + 8 = **42px**, so a 44px target is only possible by overlapping something by ≥ 2px.
- DOM / z-order: the tray section precedes the pager row in the DOM; the entry is `position:absolute` (paints above the non-positioned chips); the bake bar is above both (z-index 10), so the hit area cannot extend below the spacer.
- Result: the entry hit area takes **≤ 2px (sampled 2.5px) of the bottom edge of ONE chip** — the bottom-row first chip, in the entry's own column — about 238 px² of chip box. **0 sampled points over chip content** (emoji / name / stock / cheese slot). A point 3px above that chip's bottom edge, the chip centre and the content band all resolve to the chip; the neighbouring chip is untouched; nothing else is affected. The band is the chip's border; a mis-tap there opens the pantry (a read-only, closable sheet: no state change).
- Decision: **no change**. Removing the overlap would shrink the target to 42px (< the required 44px) and any other fix needs extra height (stage / dock), which is forbidden. Pinned by `e2e/large-catalog-pantry-shell.spec.ts` (≤ 2.5px overlap; chip centre, chip content band and "3px above the bottom" stay on the chip).

## Human Verification
390×844 and 360×800, HOME → FREE → cooking → 食材庫 open → scroll → close → cooking continues. Script `tools/large-catalog-ux/hv-pantry-shell.mjs`.
- Video (not committed; delivered directly): `artifacts/review/lc-r3/lc-r3-pantry-shell-390x844.webm` (≈ 0.6 MB) and `…-360x800.webm` (≈ 0.6 MB); WebM / VP8 because the sandbox has no H.264 encoder.
- Screenshots (committed) `docs/reports/screenshots/large-catalog-pantry-shell/`: before / after tray with the entry, pantry open, pantry scrolled, cooking continues, at both viewports ("before" = same state with the entry hidden by CSS; the entry is absolutely positioned so this reproduces the pre-R3 layout exactly).

## Runtime diff (intentional)
`IngredientTray.tsx` (optional prop + with-entry row), `GameScreen.tsx` (gate, state, sheet, input pause), new `IngredientPantry.tsx`, `App.css` (entry + sheet rules appended). Eligible players (FREE Cooking with > 6 owned in some category) will see the entry once this is merged; the sheet is a read-only shell until R4 / R5.

## Remaining risks
- The entry appears in production for FREE Cooking as soon as this merges, while the sheet is only a read-only list (Owner decides merge timing; nothing hides it behind a flag).
- 44px hit area overlaps the first chip column's bottom edge by ≤ 2px (documented; pinned by the spec).
- No entry when no step pages (by design: no room without a new row).
- WebKit not run locally; real-device thumb check still owed (capacity decision at R5 / R6).
- The dialog is modal by `aria-modal` + backdrop only (same as the hint sheet); no focus trap.

## R4 prerequisites
Met: shell, gate, focus / scroll contract, OWNED-only rows, `queryCatalog` wired. R4 adds `ShelfChips` (present shelves from the owned rows), the `shelves` filter, and — because the visible set then changes — the #197 selection-clear rule (`selectionAfterVisibleChange`). Counts stay Phase 5.

**Recommended next action:** Owner review of this branch (PR on request; CI will then run the WebKit gate), then R4 on Owner go.
