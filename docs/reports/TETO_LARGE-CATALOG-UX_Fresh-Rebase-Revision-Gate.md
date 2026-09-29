# Large Catalog UX (#272) — Fresh Rebase / Revision Gate

**docs / audit only. production code 0 / e2e 0 / runtime 0 changes. PR #272 and its branch are not rebased, changed or merged. #295 not touched. No PR created.**
Human Verification: not applicable (no visible / interaction change; policy §2).

Builds on `docs/reports/TETO_LARGE-CATALOG-UX_x_CATEGORY-TABS_Fresh-Reconciliation-Audit.md` (verdict B, OD-B1〜B5). Where the older #272 design docs disagree with main's SSOT or the Owner Decisions, main wins.

## 0. Fresh state

| Item | Value |
|---|---|
| Audited `origin/main` | **`2d3357e7cf222646624c8ec49e4930472c0083b1`** (PR #304 Inventory Modal Stable Height merged; fresh fetch, main had not moved) |
| PR #272 | **OPEN**, not draft, title "Large Catalog UX LC-1 / LC-1b: pure catalog model + scale fixtures (unwired) (#269)" |
| #272 head | `f5b0ab54e06ed0794e48aee9eb10e399f9b5cf57` (`claude/large-catalog-ux-design-sq8saf`), last updated 2026-09-28 |
| #272 base (recorded) | `e21fbc284d41f9ed30055bae06279c3237d5e98a` = merge-base with main |
| main vs #272 | **behind 93 / ahead 11** commits |
| Changed files | 75 (+6,897): `src/logic/catalog/**` 8 modules + 8 tests + fixtures, `tools/large-catalog-ux/*`, `tools/large_catalog_ux_scale_model.py`, 6 docs, 5 data JSON, 39 PNG screenshots, `docs/PROJECT_HANDOFF.md` (+26) |
| Mergeability | GitHub API `mergeable_state: "unknown"` (not computed). **Local trial merge into main: clean** (only `docs/PROJECT_HANDOFF.md` auto-merged; no conflict markers) |
| Open review threads | **0** (2 threads, both resolved and outdated; scale-model fixes already applied) |
| CI on #272 head | 9 / 9 green (WebKit Gate, Layout Contract Gate, layout-chromium, webkit ×4 shards, build, classify) — but run on 2026-09-28 against the stale base, so it says nothing about current main |
| Trial-merge verification (throw-away worktree, removed) | `tsc -b --noEmit` clean; 37 test files / 664 tests pass (`src/logic/catalog`, `logic/discovery`, `ingredientShelf`, `ShelfChips`, `InventoryOverlay.shelf`), 1 skipped |

Conclusion: nothing is broken mechanically. The staleness is semantic: 93 commits of SSOT moved (Hint 5.0, `ingredientShelf`, Shop/Inventory shelf chips, #304, Owner decisions OD-B1〜B5).

## 1. SSOT read on main (priority over the old #272 design)

`docs/PROJECT_HANDOFF.md` (Category Tabs Builder decision section, Hint 5.0 section), the Reconciliation Audit §9, `ingredientShelf.ts` (+ P1 result), `ShelfChips.tsx`, `ShopOverlay.tsx` (Phase 3), `InventoryOverlay.tsx` + `App.css` `.inventory-overlay__*` (Phase 4 + #304), `IngredientTray.tsx` (#197 `goToPage` / `onClearSelection`), `GameScreen.tsx` (`recipeFreeTray`), `state/roundKind.ts`, `logic/prepareDock.ts`, DM-3R-0 stage-size report, `hintClassDisplay.ts` / `HintSheetView`; and on #272: the 8 catalog modules, boundary test, Owner Decision Gate (§17 authority), Fresh Design (§7 wireframes), LC-1 Implementation Gate.

## 2. Existing #272: valuable vs stale / superseded

**Valuable (keep, port as-is first)**
- `workingSet.ts` (placed > pinned > hint > favorite > recent > new > fill; inactive when owned ≤ capacity ⇒ equals today's tray; zero stock skipped for automatic sources).
- `catalogQuery.ts` skeleton: OWNED-only, total order ending in catalog order, input-order independent; `catalogText.ts` (NFKC / kana normalisation); `usageSignals.ts` (session-only).
- `dexActionSummary.ts` (permanent-ownership basis, LC-OD-8b) — unrelated to the pantry; keep for the Dex slice.
- `hintDisclosure.ts` privacy pattern (only what the sheet has shown) — reusable idea, but see §11 (Hint 5).
- Privacy regressions and the 19-mutant gate, `catalogBoundary.test.ts` technique, LC-1b scale fixtures (29 / 37 / 40 / 62 / 105 / 179), scale model, Owner Authority JSON.

**Stale / superseded**
- `category` + `families` as two filter axes and `CatalogFamilyId = string` (duplicates `ingredientShelf`).
- Injected-taxonomy design and the boundary rule that forbids `../../data/ingredientShelf` (was needed only while DH4-1 was unwired; obsolete).
- `familyCounts` (keyed on family only, sauce / cheese invisible; counts are Phase 5, OD-CT-6).
- Fresh Design wireframes: the "🧺 食材庫 71" count, "肉 12 / 野菜 18" style counts, "family タブ" wording, a 🔎 inside the tray bar, and "Shop / Inventory reuse the library as their own mode" (Shop and Inventory are now separate and already have shelf chips).
- 39 PNGs under `docs/reports/screenshots/large-catalog-ux/`: captured before Phase 3 / 4 / #304 (old Shop / Inventory tabs); do not carry them into a new branch.
- `PROJECT_HANDOFF.md` #272 addendum (describes an OPEN PR at `e21fbc2`).

## 3. Responsibility split (target)

```
ingredientShelf  = ingredient -> shelf membership authority (ids, order, labels, fail-closed null, audit)   [main, unchanged]
catalogQuery     = owned scope / shelf predicate / text / sort / zero-stock ordering                        [#272, revised]
workingSet       = which owned items are on the hand (手元); never classifies                              [#272]
ShelfChips       = presentation only; caller derives shelves from the rows it lists                        [main, unchanged]
Pantry sheet     = the large-catalog UI: owns filter / search / picks state; composes the four above
```

### 3.1 Reconciliation candidates (Owner §4)

1. **One filter input — yes.** `CatalogQuery.shelves?: readonly IngredientShelfId[]` (array, so a future group-level hint can open several shelves; the chip UI stays single-select). `category?` and `families?` are removed as filter inputs.
2. **Free-string family → `ingredientShelf` — yes.** `CatalogIngredient.shelf: IngredientShelfId | null` is filled by `catalogSource.ts` from `ingredientShelf(id)`; nothing stores an ingredient→shelf table (same rule as `ingredientShelf.ts`).
3. **`CatalogFamilyId` — delete it.** If a type is wanted it is `import type { IngredientShelfId }`. No second id vocabulary. `CatalogCategory` stays only as the `workingSet` per-step category (it is the making-step category, not a shelf).
4. **Boundary test.** Allow one more value import, `../../data/ingredientShelf`, and keep forbidding `ingredientTaxonomy`, `hintClassDisplay`, recipes, matcher, hint model, state, mission. The DH4 taxonomy allow-lists in `deductionHint.test.ts` / `deductionGuard.test.ts` already name `ingredientShelf.ts` as the sanctioned reader, so the taxonomy stays reachable only through it. Keep the B-6 "no production importer outside `logic/catalog`" rule until the wiring slice deliberately lifts it for named files.
5. **`familyCounts`** — remove from `catalogQuery.ts` in the revision (dead API keyed on the wrong authority). Phase 5 adds a `shelfCounts` built on the same owned scope. No UI, `aria-label`, chip suffix or sheet header may show counts before Phase 5. A test asserts no non-test file references a counts function.
6. **Shop NEW+OWNED vs pantry OWNED-only.** `queryCatalog` remains OWNED-only; it must never gain a "listed" or "NEW" scope. Shop keeps `shopRows()` + `filterByShelf`.

## 4. Pantry visibility contract

OWNED only. Source rows = `ownedIngredientIds` ∩ production `INGREDIENTS`. Never rendered: LOCKED, NEW / unpurchased, silhouettes, `???`, hidden names, "n more to discover". Shelf chips come from the owned rows (`shelvesPresent(ownedRows)`), so a shelf with no owned ingredient has no chip, DOM node or text — exactly the Phase 4 rule (`InventoryOverlay.tsx`). No conflict with Phase 4: the pantry is a different surface with the same visibility set. Zero-stock owned rows are shown (last, grey, `×0`, LC-OD-17) because they are owned.

## 5. #197 selection contract (Builder pantry)

Rule: **a filter / search / page / hand / visible-set change must never leave the active selection on something the player cannot see; if it would, clear it** (`onClearSelection`, the same callback `IngredientTray.goToPage` uses).
- Applies to: pantry shelf change, search change, pantry page/scroll-window change (if paged), hand recomposition, sheet close/confirm.
- Does **not** change Phase 4 Inventory or Phase 3 Shop (display-only filters, no selection state; OD-CT-5 stays there). It is not a Builder-*tray* chip rule (no tray chips exist, OD-B1).
- The tray's existing page-switch clear stays as is.
- Open point (Owner, §12 OD-2): the sheet's ✓ multi-pick (LC-OD-3) is a pending set, not the tray's `selectedIngredientId`.

## 6. Stable modal contract from PR #304 — what to reuse

The #304 contract (`App.css` ~2965 and ~6188): fixed shell height (`calc(100dvh − safe-area-top − 20px)`), body `display:flex; flex-direction:column; overflow-y:hidden`, pinned summary / `ShelfChips` (`flex:0 0 auto`), a single scroller `.inventory-overlay__list` (`flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior-y:contain`) that is `role="region"`, labelled, `tabIndex=0`, with a `:focus-visible` ring; page/body never scroll; PageDown scrolls the list only.

| Option | Verdict |
|---|---|
| Reuse `InventoryOverlay` component | **No.** It is read-only by type (no picks / search / dispatch), owns a 3-column stock card and a summary line; making it dual-mode would erase its structural read-only guarantee. |
| Reuse `ShelfChips` | **Yes, unchanged** (44px targets, `aria-pressed`, `group`, row-only scroll). |
| Reuse the layout authority / CSS | **Yes, by extraction.** Add neutral shared classes (fixed-height panel, pinned rows, single scroll list with focus ring) that `.inventory-overlay__*` and the pantry both use, or copy the rules under a pantry prefix in the first slice and dedupe after. Do this in the pantry shell slice, not before, and keep Inventory's e2e/unit tests unchanged. |
| Reuse the shell host | The pantry is an in-cooking sheet, not a HOME overlay; the precedent is the Hint sheet (`isHintSheetOpen` in the `isGlobalOverlayOpen` expression, `App.tsx:1132`). The pantry opens through the same input-pause path. |
| Sheet height | LC-3 assumed 70dvh. Under the #304 contract use **the fixed shell height** so that filtering to one item never resizes the sheet; decide 70dvh vs full ceiling at the shell slice by Human Feel. |

## 7. Pizza stage floor (OD-B3)

- No tray row is added. The pantry is an overlay; nothing new is laid out under the stage.
- The hand is active only when a category has more owned items than capacity (12 candidate), hence > 6, hence `prepareDockReserve` already reserves the **34px pager row** for the round (`prepareDock.ts:77`, `--pager-h: 34px`). The entry button (🧺 食材庫, no count) replaces / shares that existing row: **Δ stage height = 0px**. When no step exceeds 6 owned items there is no hand and no pantry entry (nothing to browse), so small catalogs are byte-for-byte today's layout.
- Search does **not** go in the tray row; it lives in the sheet only.
- The DM-3R-0 floors (Free 269px at 390×664 in the earlier measurement; Dinner ≈ 236px) must stay as pinned by `e2e/stage-size-stability.spec.ts` and `layout-contract.spec.ts`. Required viewports: 390×844, 360×800 (minimum), 390×664, 360×640 (audit). I did not re-measure stage pixels in this docs-only pass; the Δ = 0 argument follows from the existing reservation, and the wiring slice must prove it with the existing stage-size spec, unchanged.
- Hand size vs page count: tray page = 6 (`MAX_INGREDIENT_PALETTE_SLOTS`), 3 columns; a hand of 12 = exactly 2 pages, so the reserved "2 rows + pager" dock is unchanged.

## 8. FREE vs Dinner (OD-B4)

Facts on main:
- `GameScreen.tsx:306`: `const recipeFreeTray = state.freeCook || state.dinner !== null;` — **the tray is already recipe-free for Dinner.** A gate written as `freeCook` would be false for Dinner today, but any gate derived from `recipeFreeTray` would include Dinner.
- Dinner rounds are built with `freeCook: false` and `roundKind: "DINNER"` (`gameReducer.ts:613-614`); Free Cooking is `roundKind: "FREE_COOK"` (`state/roundKind.ts`, `isFreeCookingRound`).

Required gate authority: **`isFreeCookingRound(state)` (roundKind === "FREE_COOK") and `state.dinner === null`**, evaluated once in `GameScreen` and passed down as a single boolean (`pantryEnabled`). Never `freeCook` alone, never `recipeFreeTray`. Add a test that pins Dinner ⇒ `pantryEnabled === false` and that `recipeFreeTray` is not used for this. Guided and Lunch Rush are already excluded (recipe-only trays).

Tension to settle (Owner, §12 OD-1): Owner Authority LC-OD-16b already discusses a Dinner hand ("Dinner でも player が自分で手元を構成する"), while OD-B4 says FREE-specific features exclude Dinner. Dinner uses the same all-owned paged tray and has the tightest stage (≈236px at 390×664 with HUD).

## 9. Scale audit (measured on main `2d3357e` with the real modules)

| | production (29) | 62 catalog (`ingredient_master_catalog.json`) |
|---|---|---|
| total | 29 | 62 |
| sauce / cheese / topping | 3 / 4 / 22 | 10 / 10 / 42 |
| classified toppings | 22 (`auditShelfAuthority().ok = true`) | **19** |
| **unclassified toppings** | 0 | **23** (`shelf === null`) |
| shelf distribution | sauce 3, cheese 4, meat 4, seafood 3, vegetable 8, fruit 1, herb 4, spice 1, other 1 | sauce 10, cheese 10, meat 4, seafood 2, vegetable 7, fruit 1, herb 4, other 1, spice 0, **none 23** |
| starters (no unlock) | 3 | n/a |
| OWNED max | 29 (all) | 62 |
| hand ≤ 12 (candidate) | topping 22 > 12 ⇒ hand active only near full ownership; sauce 3, cheese 4 inactive | topping 42 ⇒ active; sauce 10, cheese 10 inactive (≤ 12) |
| pantry list size (all shown) | ≤ 29 | ≤ 62 |

Notes: the 62 catalog is not a superset of production (36 ids new, 3 production ids absent), so it is a design target, not a drop-in. **Unclassified = fail-closed**: `shelf: null`, reachable only under 「すべて」, never guessed into a family. With 62, 23 of 42 toppings (55%) would be reachable only through 「すべて」, so **62-catalog activation must wait for HCG (#293 / #296) classification** (already the position of `ingredientShelf`'s audit gate); nothing in this plan activates 62. At 29 the pantry is fully classified.

## 10. Counts / Search

- **Counts:** deferred to Phase 5 (OD-CT-6). No count in the entry button, sheet header, chips, `aria-label` or empty text. Internal count functions are out of the revision (§3.1-5); if one is re-added in Phase 5 it counts owned × shelf only (never recipe-derived, H-H).
- **Search (existing #272 spec, no new features):** matches `nameJa` (and optional `readingJa`, LC-OD-15 already approved; production has no `readingJa` yet, so display-name only at first), normalised (NFKC, kana, long-vowel/space removal), **OWNED-only, AND-combined with the shelf filter**. No new operators, no ingredient-attribute or recipe search, no fuzzy match. Changing the query re-evaluates the selection rule (§5). Empty result shows a neutral empty line that names no unowned ingredient.

## 11. Hint 5 (OD-B5) impact

`hintDisclosure.ts` reads `HintSheetView.presentation` / `grandfatheredSteps` and DH4 attribute fact ids. Main now also carries the Hint 5.0 ladder (class symbols/labels in `hintClassDisplay.ts`, `deduction` view, production default ON). #272's disclosure code typechecks and passes, but it was **not** audited against the ladder's displayed classes. Consequences: (a) the hint → pantry connection (LC-4) is **out of the first slices**; (b) when it is built, it may only re-show what the sheet displayed, at the displayed granularity, and introduces **no new k≥2 rule**; (c) a group-level answer opens several shelves, which the single-select chip row cannot show as "pressed" — the `shelves[]` query input (§3.1-1) is the future-proofing, the UI for it is undecided.

## 12. Accessibility (design requirements for the pantry)

- Entry: a real `<button>` in the pager row, ≥ 44px hit area, label 「食材庫」 (no count), `aria-haspopup="dialog"`.
- Sheet: `role="dialog"` `aria-modal="true"` with `aria-label`; focus moves to the sheet (heading or first control) on open; **on close, focus returns to the entry button**; background input is paused (global overlay path); Escape closes.
- `ShelfChips`: existing `role="group"` + `aria-label` + `aria-pressed`, 44px targets, row-only horizontal scroll.
- List: `role="region"`, `aria-label`, `tabIndex=0`, visible `:focus-visible` ring, list-only PageDown/arrow scroll (the #304 e2e pattern is the model).
- Close button pinned and reachable at 360×640 without scrolling; safe-area bottom padding kept.
- Tiles: ≥ 44px; ✓ toggle exposed as `aria-pressed`; stock text not the only cue for `×0`.

## 13. Implementation slices (each its own PR; #272 is not the vehicle)

Existing slice authority: Owner Decision Gate §17 + LC-1 Implementation Gate (LC-1 / LC-1b done in #272; LC-2 hand + すべて; LC-3 pantry; LC-4 hint; #270 undo separate). The requested R-slices map onto it:

| Slice | = LC | Goal | Files expected | Tests expected |
|---|---|---|---|---|
| **LC-R0** authority / port | LC-1 carry-over | New branch from main; port `src/logic/catalog/**`, `tools/large-catalog-ux/mutation-check.mjs`, scale model + data JSON, fixtures **as-is**; port docs with a "superseded in part" banner (counts, tray-tab wording, screenshots dropped); handoff addendum replaced by a short current-state entry. #272 closed only by the Owner. | add `src/logic/catalog/*` (+ tests, `testSupport`), `tools/large-catalog-ux/mutation-check.mjs`, `tools/large_catalog_ux_scale_model.py`, `docs/reports/*LARGE-CATALOG*`, `docs/reports/data/*LARGE-CATALOG*`, `docs/PROJECT_HANDOFF.md` | the existing 12 catalog test files pass unchanged; `tsc -b`; lint; full `npm test`; mutation 19/19 |
| **LC-R1** shelf reconciliation | LC-1 revision | §3.1 items 1–6 | `catalogTypes.ts`, `catalogSource.ts`, `catalogQuery.ts` (+test), `hintDisclosure.ts` (filter type only; ladder audit deferred), `catalogBoundary.test.ts`, `largeCatalogFixtures.ts`, mutation-check (taxonomy mutants) | shelf-equivalence property (`queryCatalog({shelves:[X]})` ids == `filterByShelf(owned, X)` for production, 62 and harness fixtures); unclassified only under all; owned-only; no taxonomy / `hintClassDisplay` import; no counts symbol referenced by non-test code; determinism / order independence kept |
| **LC-R2** hand foundation | LC-2 (logic part) | Route tray items through `workingSet` with capacity ≥ owned (**no visible change**); add `pantryEnabled = FREE_COOK ∧ dinner === null` (§8); dock reserve computed from hand size | `GameScreen.tsx`, `prepareDock.ts`, `IngredientTray.tsx` (input only), `usageSignals` session wiring | equivalence with `trayIngredientsFor` for every category at 29; Dinner/Guided/Lunch ⇒ disabled; `prepareDock` reserve unchanged; existing tray / `App.freeCookTrayPaging` / stage-size / layout-contract specs unchanged and green |
| **LC-R3** pantry shell | LC-3 (shell) | Sheet opened from the pager row; OWNED-only list; #304-style fixed shell; input pause; focus entry/return | new `IngredientPantry.tsx`, `GameScreen.tsx`, `App.tsx` (`isGlobalOverlayOpen`), `App.css` (shared stable-modal rules) | 1-item and many-item lists have identical shell size; list-only scroll; keyboard/PageDown; no LOCKED/NEW text (anti-spoiler); `App.globalOverlayShellSizing`; Inventory tests untouched |
| **LC-R4** pantry ShelfChips | LC-3 (filter) | `ShelfChips` (present shelves from owned rows) + `queryCatalog` shelf filter; 「すべて」 first; unclassified only under all | `IngredientPantry.tsx` | shelf with 0 owned has no chip/DOM/text; filter = `filterByShelf`; chip ≥ 44px / `aria-pressed`; no counts |
| **LC-R5** search / picks / selection | LC-3 (interaction) | Search (§10), ✓ picks → hand, #197 clear rule (§5) | `IngredientPantry.tsx`, hand state, `GameScreen.tsx` | selection cleared iff it becomes invisible (shelf / search / hand / close); AND-semantics; owned-only search; Hint privacy tests unchanged |
| **LC-R6** mobile / a11y / HV | LC-3 (closing) | 4 viewports, Human Verification video 390×844 + screenshots, e2e | `e2e/*` (new pantry spec), reports | stage size identical before/after at 390×844, 360×800, 390×664, 360×640; WebKit gate |
| (later) LC-4 hint → pantry | LC-4 | After a Hint 5 ladder audit (§11) | — | — |
| (later) Phase 5 counts | — | `shelfCounts`, chip counts | — | — |

R2 must not be activated (capacity < owned) in production until R3–R5 exist, otherwise ingredients beyond the hand are unreachable. R2 lands as an equivalence refactor; the capacity switch is enabled with R3–R5.

## 14. Owner Decisions still required (none block R0 / R1)

- **OD-1 — Dinner.** Does the hand + pantry apply to Dinner (LC-OD-16b's "player composes own hand") or is it FREE-only for now (OD-B4)? **Recommendation: FREE-only first; Dinner keeps the paged tray** until a Dinner-specific decision (tight ≈236px stage, Dinner HUD).
- **OD-2 — ✓ picks vs #197.** The sheet's multi-select is a pending set. **Recommendation:** picks survive shelf/search changes but are always shown in a pinned "選択中" row (so none is invisible); the tray's `selectedIngredientId` is cleared per #197 whenever it would leave the hand. If the Owner wants "clear when hidden" for picks too, LC-OD-3 (multi-pick) should change to single-pick.
- **OD-3 — capacity 9 vs 12.** Already an Owner-designated Human Feel decision at the hand slice (LC-OD-4). "12" is only the candidate; no value is fixed here and `capacity` stays an argument.
- **OD-4 — vehicle for #272.** Because the request forbids rebasing the existing branch, **recommendation:** LC-R0 as a fresh branch from main that ports the files; the Owner closes #272 as superseded afterwards (or keeps it as archive). No action on #272 by Claude.

## 15. Risks / blockers

- No hard blocker for R0 / R1 (pure logic; green on main).
- 62-catalog: 23 unclassified toppings ⇒ pantry chips useless for most toppings until HCG (#293 / #296); do not activate 62 before that.
- R2 dormant-capacity discipline (unreachable items otherwise).
- Hint 5 ladder never audited against `hintDisclosure` (deferred with LC-4).
- Dinner / stage floor ambiguity (OD-1).
- Screenshots / wireframes in the old docs are stale; they must not be treated as authority.
- Shared-CSS extraction touches Inventory styles; do it with Inventory tests as the guard.

## 16. FINAL VERDICT

**A. READY TO REBASE / REVISE #272** — as a **fresh-branch port (LC-R0) followed by the shelf revision (LC-R1)**, not an in-place rebase of the existing branch. OD-1 / OD-2 gate the hand / pantry wiring slices (R2+), not R0 / R1. Recommended next action: Owner answers OD-1 / OD-2 / OD-4, then run LC-R0.

STOP. No rebase, implementation, PR update or merge performed.

## 17. Owner Decisions (2026-09-29) — OD-1 / OD-2 / OD-4 ADOPTED

These resolve §14. OD-3 (capacity 9 vs 12) stays an Owner Human-Feel decision at the hand slice; `capacity` remains an argument.

| ID | Decision |
|---|---|
| **OD-1** | The Large Catalog UX hand (手元) + pantry (食材庫) is introduced for **FREE Cooking only**. **Dinner is out of scope and keeps the current paged tray.** The FREE gate is the explicit authority `isFreeCookingRound(state)` (`roundKind === "FREE_COOK"`) **and** `dinner === null`; never `freeCook` alone and never `recipeFreeTray`. Introducing it to Dinner is a separate audit after the FREE version is complete. |
| **OD-2** | Pantry multi-**picks** and the Builder's **`selectedIngredientId` are separate states**, never conflated. *Picks:* kept across filter, search and shelf changes; always visible in a pinned 「選択中」 area; never a hidden state. *`selectedIngredientId`:* PR #197 authority — cleared when a filter / search / page / working-set change removes it from the current visible set. |
| **OD-4** | The existing #272 branch (`f5b0ab5`) is **not rebased in place**; it is frozen as the porting source / historical reference. A new implementation branch is cut from latest main and only the needed #272 artifacts are ported and revised slice by slice. #272 need not be closed now; whether to close it as superseded is decided after the new branch is safely established. |

Consequences: §8 tension is resolved (Dinner excluded). §13 slices are unchanged; R2+ wiring must use the OD-1 gate and the OD-2 state split. LC-OD-16b (Dinner hand) is deferred, not adopted.
