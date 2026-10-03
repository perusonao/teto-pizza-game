# Large Catalog UX — LC-R4 Result (Pantry Shelf Filtering)

Branch `claude/lc-r4-pantry-shelf-filtering`, from `origin/main` `3b0da33b0ca4ebc1deaefcb357b4181511621863` (PR #305 merge). **Status: MERGED / COMPLETE** — PR #306, merge commit `12725eb3461583a5349259868fe2e7163b3eacf0` (PR HEAD `ead02fb0ab82f6c6ca70f1c9c2bd98d1a16af35a`, base main `3b0da33`). Post-merge: Deploy to GitHub Pages #220 success; E2E WebKit #348 success (classify, layout-chromium, WebKit 390×844 and 360×800 shards 1/2 + 2/2, Layout Contract Gate, WebKit Gate). PR CI was 9/9 green including the new spec on WebKit at both widths. Authority: the LC-R4 pre-implementation audit and the Owner-confirmed OD-R4-1 / OD-R4-2 / OD-R4-3.

## What changed (production)
- `src/components/IngredientPantry.tsx`: local `useState<ShelfFilter>("all")`; the active category's OWNED rows are queried once (`queryCatalog`, no shelf) to derive the represented shelves from the descriptors' `shelf` (in `INGREDIENT_SHELF_ORDER`); `ShelfChips` renders only when **>= 2** shelves are represented ("すべて" + represented shelves); a chosen shelf runs `queryCatalog({ shelves: [shelf] })`; a stored shelf that is no longer represented reads as すべて; a filter change sets the list's own `scrollTop = 0`.
- `src/App.css` (append-only): `.pantry-sheet__shelves { flex: 0 0 auto; min-width: 0 }` — the fixed slot. `.shelf-chips` / `.shelf-chip` (Shop / Inventory) are reused untouched.
- Not changed: `GameScreen.tsx`, `IngredientTray.tsx`, `catalogQuery.ts`, `ingredientShelf.ts`, `ShelfChips.tsx`, `handSession.ts`, `App.tsx`, state, save, Dinner, the `dockReserve.pager` gate.

## Contract check
| Rule | Result |
|---|---|
| active-category pantry kept (sauce = sauce, cheese = cheese, topping = shelf filtering) | yes; sauce / cheese steps have one shelf => no chip row |
| chips derived from OWNED rows only; absent shelf has no chip / node / text | yes (unit + e2e); fruit / spice absent in the unit fixture |
| `shelf === null` only under すべて, never a chip | yes (mocked `ingredientShelf` test) |
| reopen => すべて; not saved, not in GameState | yes (local state; sheet unmounts on close) |
| filter change => list scrollTop 0 | yes (unit + e2e at 4 viewports) |
| `selectedIngredientId` not cleared; `selectionAfterVisibleChange` not wired | yes (tests; boundary test forbids the import) |
| no counts / search / picks / hand editing; `HAND_ENFORCEMENT_ENABLED=false` | yes |
| no save, Dinner or pager-gate change | yes (gate pinned by a source-level test) |
| stable height: sheet outer bounds, header, 閉じる, chip row fixed; only the list scrolls | yes (e2e) |

## Mobile measurements (Chromium, real layout)
| viewport | sheet h | list h without chips (sauce) | list h with chips | list cost | chip row width / scroll width | chip h |
|---|---|---|---|---|---|---|
| 390×844 | 590.8 | 489.8 | 435.8 | 54 | 358 / 702 | 44 |
| 360×800 | 560 | 459 | 405 | 54 | 328 / 702 | 44 |
| 390×664 | 464.8 | 363.8 | 309.8 | 54 | 358 / 702 | 44 |
| 360×640 | 448 | 347 | 293 | 54 | 328 / 702 | 44 |
With all 22 toppings owned the row (すべて + 7 shelves) scrolls horizontally at every viewport; chip widths >= 44px; 閉じる 44px; page / body never scroll; pizza stage and dock identical (asserted per filter).

## Verification
- Vitest: 246 files, **4861 passed**, 1 skipped. `tsc -b` clean; `oxlint` no findings in changed files (2 pre-existing warnings in `scoringV2.noSauceProfile.test.ts`); `vite build` OK, no hand / working-set code in `dist/`.
- New: `IngredientPantry.shelves.test.tsx` (3 groups), R4 blocks in `GameScreen.pantryShell.test.tsx` (chips derivation, fixed slot, sauce / cheese no row, per-shelf rows, privacy incl. no digits but ×n, scrollTop reset, reopen reset, Escape from a chip, #197 not applied, Dinner isolation), boundary tests (pantry has no selection / hand / save / taxonomy code; the R3 pager gate string).
- Chromium E2E: new `e2e/large-catalog-pantry-shelves.spec.ts` (4 viewports) + `large-catalog-pantry-shell`, `free-cooking-phase3-2`, `dinner-mission`, `stage-size-stability`, `layout-invariants-lb`, `discovery-hint-sheet`, `inventory-modal-stable-bounds` on 390×844 and 360×800 projects: **57 passed** (17 intentional width skips); Layout Contract (`layout-chromium`, 7 profiles): **12 passed**.
- Mutation gate: **52/52 killed** (M1–M39 baseline + M40–M50: absent-shelf chip, single-shelf chip row, unclassified leak, no scroll reset, filter persistence, chips inside the scroller, #197 wiring, cross-category rows, count leak, no stale-shelf fallback, pager gate change). M50 initially SURVIVED; a source-level gate assertion now kills it.
- WebKit: not runnable in this sandbox; the WebKit Gate / shards run in CI once a PR exists. The new e2e uses only in-run comparisons and generous ranges (no Chromium absolute px baselines) to avoid the R3 cross-engine issue.

## Human Verification (Policy)
- Videos (not committed; delivered directly): `artifacts/review/lc-r4/lc-r4-pantry-shelves-390x844.webm` (971,857 B) and `…-360x800.webm` (925,310 B). WebM / VP8 (EBML header verified) because the sandbox has no H.264 encoder and no ffprobe; duration / codec not probed with ffprobe. Content: FREE cooking → topping step → Builder selection (バジル) → 食材庫 → すべて → list scroll → 肉 (list back at top) → chip row scrolled → その他 → すべて → close → reopen (すべて) → Escape → cooking continues.
- Screenshots (committed) `docs/reports/screenshots/large-catalog-pantry-shelves/`: before (R3 pantry, chip slot hidden) / after at 390×844, 360×800, 390×664, 360×640: all, scrolled, 肉, chips scrolled + その他, reopened, cooking continues.

## Notes / risks
- The chip slot costs 54px of list height (11–16%); the smallest viewport still shows about 3.5 tile rows.
- The pantry entry still depends on the reserved pager row (OD-R4-3: split in R5).
- WebKit result pending until a PR exists.
