# Teto Pizza Game — Recipe Select 2.0A — Implementation Result

**Audited `main` SHA:** `4bb065caaaf647f932d79977f98b5b13b633b677` (merge of PR #137, the docs-only
Phase 0 Fresh Audit / UX Design — this branch's own merge-base with `origin/main`)
**Branch:** `claude/recipe-select-2-0a-6tzrq6`
**Companion design docs:** `docs/design/TETO_RECIPE-SELECT_2.0.md`,
`docs/reports/TETO_RECIPE-SELECT_2.0_Phase0_Fresh-Audit.md`

---

## 1. Fresh sync / Duplicate gates

- `git fetch origin` run at session start and again immediately before finalizing this report.
  `origin/main` HEAD was `4bb065caaaf647f932d79977f98b5b13b633b677` both times — no drift, no
  rebase needed either gate.
- **Duplicate Gate #1 (before implementation):** searched open PRs/branches for any existing
  Recipe Select grid/sectioned-select/recipe-card/detail work. The only match was PR #137 itself
  (the already-merged, docs-only Phase 0 audit this task's own branch is based on). No open PR or
  branch implements the grid — proceeded.
- **Duplicate Gate #2 (after implementation):** re-fetched `origin/main` (unchanged SHA) and
  re-listed open PRs — still only #105 (dev automation), #72/#46/#34/#3 (unrelated docs/other
  features). No overlapping Recipe Select work landed on `main` or any other branch while this
  session ran. No rebase/merge-forward needed.

## 2. Before UX

Single-recipe pager (Issue #88 UX-4): one `RecipeDetailPanel` on screen at a time, 前へ/次へ
paging, a `N / 15` counter with zero visibility into neighboring recipes. Reaching recipe #15
from #1 required 14 consecutive 次へ taps. `PAGER_DOT_INDICATOR_MAX`/`pagerIndicatorKind`/
`clampPagerIndex` in `src/state/pizzaSelect.ts` implemented this; `PizzaSelectScreen.tsx` rendered
exactly one `.pizza-select-card` with no grid.

## 3. After UX

Primary navigation is now a 2-column, section-headed browse grid (`.pizza-select-body` /
`.pizza-select-grid`), reached the same way (HOME → 「ピザを作る」). Tapping any grid card (locked
or unlocked) opens a focused single-recipe detail/confirm view (`.pizza-select-detail`, the same
big parchment-card look the old pager's single panel had, minus 前へ/次へ, plus a `← 一覧へ戻る`
button). The grid stays mounted (`display: none` while hidden, never unmounted) so returning from
detail keeps the exact scroll position the player left. No 前へ/次へ chrome exists anywhere in the
new implementation — Recipe Select's primary operation is tap-a-card, not paging.

Flow: `HOME → Recipe Select grid → Recipe detail/confirm → Game`, matching the task's required
shape exactly. Every existing entry/exit point into this screen (`HOME`'s 「ピザを作る」,
`DISCOVERED`'s 「別のピザを作る」) is unchanged — both still land on `PIZZA_SELECT`, which now
renders the grid first.

## 4. Grid architecture

`PizzaSelectScreen` holds one piece of local state: `selectedRecipeId: RecipeId | null`.
`null` → grid is the active view (detail unmounted); non-null → the matching recipe's detail
renders on top, with the grid hidden (not unmounted) behind it via inline
`style={{ display: "none" }}` on the grid's own scroll container. This is the entire "remember
where I was" mechanism — no saved scroll-offset state, no extra routing layer, matching the
task's "no large-scale architecture change" constraint. `RecipeGridCard` is a semantic `<button>`
(the whole card is the tap target, natively focusable/keyboard-operable) reusing the existing
`recipeCardState`/`PizzaThumbnail`/`starLabel` machinery unchanged — a card's COMPLETED/NEW/LOCKED
content is produced by the exact same `CardStatusContent` component the focused detail view uses,
so the two can never render conflicting information for the same state.

## 5. Section strategy

Position-based, per the design doc's own recommendation (no `category` field added to `Recipe`).
`src/state/pizzaSelect.ts` adds a single named configuration (`RECIPE_SECTION_BOUNDARIES`,
`RECIPE_SECTION_FALLBACK_CHUNK_SIZE`) and one pure function, `buildRecipeSections`, rather than
scattering index math through the UI component:

- Two authored boundaries reflect today's real production data: index 0 → 第1章 (the original 7
  Issue #88 recipes), index 7 → 第2章 (Batch 1A's salsiccia onward, 8 recipes).
- Any recipe collection longer than the last authored boundary is grouped automatically into
  further `RECIPE_SECTION_FALLBACK_CHUNK_SIZE`-sized (8) sections (第3章, 第4章, ...) — a future
  Batch that grows the catalog to 23/30/38/50 needs **no edit to this file** to get section
  headers; verified by a 38-recipe fixture test producing 第1章..第5章 with every recipe accounted
  for exactly once.
- Never reorders input — sections are sliced directly from `RECIPES`' own declared array order
  (verified test: "preserves RECIPES' own declared order across sections").

## 6. Card states

Unchanged semantics, reused verbatim from `recipeCardState`/`unlockHintFor` (neither function was
touched): `COMPLETED` (★ + BEST score), `NEW` (badge + 未挑戦), `LOCKED` (silhouette + real name +
hint, or `？？？` + hint for the one `mysteryLock` recipe, fugazza). Grid cards show the same
content as before, at a compact size (76px thumbnail vs. the detail panel's 128px, smaller type
scale) via scoped CSS overrides — no information was added or removed from what Phase 0's design
doc (§6) specified for the select card (name/thumbnail/lock state/NEW badge/★BEST/hint only; no
description, ingredient list, or `timesMade`, which stay Dex-only).

## 7. Detail/confirm behavior

Opened by tapping any card (locked or unlocked) — `RecipeDetail` renders `RecipeDetailPanel` (the
same content component the grid card and the old pager panel both share) plus a `← 一覧へ戻る`
back button and the `このピザを作る！` CTA. `disabled`/`aria-disabled` on the CTA for any LOCKED
card, wired the same way the old pager did (`if (!isLocked) onSelectRecipe(...)`) — a disabled
button's click is a no-op, never dispatching `SELECT_RECIPE`. No 前へ/次へ affordance was kept in
detail (Fresh Design §17's open question resolved: dropped entirely, 戻る-only) — this is
deliberately not a re-introduction of serial browsing at a smaller scope.

## 8. Lock/mystery behavior

Byte-for-byte reuse of `recipeCardState`/`isRecipeAvailable`/`unlockHintFor` — none of these
functions were modified. `fugazza`'s `mysteryLock` still renders `？？？` with only a star-progress
hint (never its name or `たまねぎ`) whenever the recipe is LOCKED, whichever axis blocks it (chain,
stars, or ingredient ownership) — confirmed both by unit test (`pizzaSelect.test.ts`, unchanged
assertions) and by a real running-app browser check: a save whose chain+star gate for fugazza is
satisfied but predates the Starter Grant catch-up still needs the ingredient axis to also clear
before the mystery card reveals its name; this session's own browser verification instead hit the
easier, real-world path (an already-progressed save whose Starter Grant already covers fugazza)
and confirmed the reveal there (`09-detail-new-fugazza.png`). A locked card never wires the
CTA/`onSelectRecipe` regardless of the reason it's locked — verified by unit test and by clicking
a disabled CTA in the browser twice (mystery-locked and chain-locked) with no `SELECT_RECIPE`
navigation resulting.

## 9. Progression/unlock unchanged confirmation

`src/state/progression.ts`, `src/data/recipes.ts` (unlock chain/`minTotalStars`/
`mysteryLock`/`requiredIngredients`), `src/state/dex.ts`, `src/logic/mastery.ts`, and
`src/state/persistence.ts` (save schema) were **read, never edited**. `git diff --stat` (§13)
confirms zero touched lines in any of these files. `recipeCardState` itself (the single function
translating that unchanged progression truth into a card's displayed state) is also unmodified —
only its two callers (a grid card, a detail panel) changed, both reusing it exactly as the old
pager did.

## 10. 15-recipe verification

Both automated and live-browser:

- `src/state/pizzaSelect.test.ts`: `buildRecipeSections(RECIPES)` produces exactly 第1章 (7) /
  第2章 (8) with `RECIPES`' own order preserved, no recipe dropped/duplicated.
- `src/screens/PizzaSelectScreen.test.tsx`: all 15 production recipes render as grid cards;
  section headers present; every card state (COMPLETED/NEW/LOCKED/mystery-LOCKED) rendered and
  asserted against real `RECIPES` entries (margherita/funghi/bismarck/fugazza/salsiccia); grid →
  detail → CTA → `onSelectRecipe(exact id)` for both the first (margherita) and last
  (meat-lovers) recipe; locked/mystery-locked cards never invoke `onSelectRecipe`; a chain-
  unlocked-but-ingredient-missing recipe (fugazza before onion) still renders LOCKED.
- Live browser (both viewports): fresh save (margherita NEW, chapter 1 chain-locked, fugazza
  mystery-locked) and a progressed save (chapter 1 COMPLETED with real BEST/★, fugazza NEW via
  Starter Grant, chapter 2 chain-locked with hints) both render correctly; CTA→PREPARE handoff
  confirmed working end to end.

## 11. 30–50 scalability verification

Dev-only test fixtures only — **no production recipe was added or duplicated** (`RECIPES.length`
is still 15, confirmed by test assertion; `src/data/recipes.ts` has zero diff).

- `pizzaSelect.test.ts`: a 38-mock-recipe fixture produces 第1章..第5章 (7+8+8+8+7), every recipe
  accounted for exactly once; a loop over [1, 7, 8, 15, 16, 23, 50] confirms `buildRecipeSections`
  never drops/duplicates a recipe at any of those sizes.
- `PizzaSelectScreen.test.tsx`: a 38-recipe mocked catalog renders exactly 38 `.pizza-select-grid-card`
  elements across the auto-generated sections; the last card is present in the DOM and its CTA
  fires `onSelectRecipe` with its exact id (no truncation/virtualization needed at this scale, per
  the design doc's own §14 recommendation); a 50-recipe fixture confirms the grid stays a fixed
  2-column layout regardless of item count.
- No virtualization/windowing was introduced, per the design doc's explicit guidance (§14: not
  warranted below the 80+ recipe band; no measured performance problem exists at 15 or the tested
  30–50 fixture sizes).

## 12. 390×844 result

Verified live (Playwright + the environment's pre-installed Chromium) against a running
`npm run dev` build, both a fresh save and a progressed save. Screenshots:
`docs/reports/screenshots/recipe-select-2.0a/390x844-*.png` (15 files, indexed 01–15, see §16).

- No horizontal overflow at any captured state (`document.documentElement.scrollWidth ===
  clientWidth === 390` at every checkpoint — grid top, an open detail, PREPARE handoff, and the
  scrolled-to-bottom last recipe).
- No console errors/page errors at any point in the full scripted walkthrough (`CONSOLE_ERRORS: []`).
- Section headers (第1章/第2章) render legibly in the existing warm/cream typographic style, not a
  plain admin-panel label.
- Locked cards show silhouette + 🔒 + real name + hint (or `？？？` + hint for fugazza specifically)
  identically to the old pager's own per-card treatment, just at compact size.
- CTA never clips; back button (`← 一覧へ戻る`) and the detail's CTA are both comfortably sized
  touch targets (≥44px min-height by CSS, well under the ~174×168px grid card itself).
- Scrolling to the last recipe (ミートラヴァーズ) works via native scroll, no custom scroll
  mechanism, and its card is fully reachable and selectable.

## 13. 360×800 result

Identical behavior to 390×844 at every captured state (fresh save, progressed save, all card
states, PREPARE handoff, last-recipe scroll) — no horizontal overflow, no console errors, no
clipped text/buttons at the narrower/shorter viewport. Screenshots:
`docs/reports/screenshots/recipe-select-2.0a/360x800-*.png` (15 files, same index as 390×844).

## 14. Tests

- `npm test` (full suite): **2066 passed, 0 failed**, 109 test files (canvas `getContext` warnings
  in output are pre-existing jsdom noise from unrelated components, not new failures).
- `npx tsc -b`: clean, no errors.
- `npx oxlint`: clean, no errors/warnings, exit 0.
- `npm run build`: succeeds (`vite build`); the pre-existing "chunk larger than 500kB" advisory is
  unrelated to this change (same single JS bundle the project already produces).

New/rewritten test coverage (`src/state/pizzaSelect.test.ts`, `src/screens/PizzaSelectScreen.test.tsx`)
covers every item on the task's own minimum list: grid renders all 15 recipes; unlocked recipe
selectable; locked recipe cannot start a game; mystery-locked recipe stays hidden appropriately
(including the ingredient-locked-but-chain-clear edge case); NEW state; completed/BEST state;
section headers; card → detail; detail → grid back (with the grid's own DOM node proven to persist,
not remount); detail → game start; last recipe reachable; existing progression semantics
unchanged (dex/unlock fixtures identical to the old pager suite's own); plus a 30–50-recipe
scalability/structural fixture suite.

Five other integration test files exercised Pizza Select's own now-removed pager UI (前へ/次へ) as
part of their own unrelated setup helpers (Cooking Time CT2 background pause, Full Game Reset,
Human Feel Fix 3 PREPARE layout, Reference popover coverage, and the main App HOME/GAME
integration suite). Each was updated in place to drive the new grid+detail flow instead (tap the
recipe's own grid card, then the shared CTA) — no test assertions about *those* features'
own behavior were changed, only how they reach PREPARE via Recipe Select.

## 15. Changed files

```
 src/App.cookingTimingBackground.test.tsx |   9 +-   (helper: grid card tap instead of pager)
 src/App.css                              | 198 +++++++++++------  (new grid/section/detail CSS; removed dead pager-nav/dots/counter CSS)
 src/App.fullGameReset.test.tsx           |  17 +-   (helper + 2 tests: grid card tap instead of pager)
 src/App.humanFeelFix3.test.tsx           |   8 +-   (helper: grid card tap instead of pager)
 src/App.playerReference.test.tsx         |  19 +-   (helper: grid card tap instead of pager)
 src/App.test.tsx                         |  24 +-   (helper + 1 test: grid card tap instead of pager)
 src/screens/PizzaSelectScreen.test.tsx   | 366 +++++++++++++++----------------  (rewritten: grid+detail coverage)
 src/screens/PizzaSelectScreen.tsx        | 253 +++++++++++++--------  (rewritten: grid+detail, pager removed)
 src/state/pizzaSelect.test.ts            |  77 ++++---  (pager-helper tests removed; buildRecipeSections tests added)
 src/state/pizzaSelect.ts                 |  83 +++++--  (pager helpers removed; section config/helper added)
 docs/reports/screenshots/recipe-select-2.0a/*.png (new, 30 files: 15 states x 2 viewports)
 docs/reports/TETO_RECIPE-SELECT_2.0A_Result.md (new, this file)
```

Not touched (confirmed via `git diff --stat`, zero lines): `src/data/recipes.ts`,
`src/state/progression.ts`, `src/state/dex.ts`, `src/logic/mastery.ts`,
`src/state/persistence.ts`, `functions/**`, `.github/workflows/**`, any Firebase config.

## 16. Screenshot index

`docs/reports/screenshots/recipe-select-2.0a/{viewport}-{NN}-{description}.png`, both `390x844-*`
and `360x800-*` covering the same 15 states:

| # | Content |
|---|---|
| 01 | HOME (fresh save) |
| 02 | Grid, fresh save, 第1章 fully visible (margherita NEW, rest chain-locked, fugazza mystery-locked) |
| 03 | Detail: margherita, NEW, fresh save |
| 04 | Grid after 戻る from detail — confirms the grid (and its scroll position) survives the round trip |
| 05 | Detail: funghi, chain-LOCKED, real name + hint, disabled CTA |
| 06 | Grid: fugazza's mystery-locked (？？？) card, fresh save |
| 07 | Detail: fugazza, mystery-locked, ？？？ + star-progress hint, disabled CTA |
| 08 | Grid, progressed save: 第1章 all COMPLETED with ★/BEST, fugazza NEW (Starter Grant unlocked it) |
| 09 | Detail: fugazza, NEW (now revealed, chain+ingredient both satisfied) |
| 10 | Detail: margherita, COMPLETED, ★★★★★ BEST 92 |
| 11 | PREPARE screen immediately after CTA — confirms the Game handoff still works unchanged |
| 12 | Grid, 第2章 chain-locked-with-hint recipes (salsiccia onward) |
| 13 | Detail: salsiccia, chain-LOCKED, disabled CTA |
| 14 | Grid scrolled to the last recipe (ミートラヴァーズ), reachable via native scroll |
| 15 | Detail: ミートラヴァーズ (the last recipe), confirms end-of-list is a fully working, non-degenerate case |

## 17. Known limitations

- The "chain+stars satisfied but ingredient not yet owned" LOCKED state for a `mysteryLock`
  recipe (fugazza before its Starter Grant lands `onion`) is exercised by unit test but not by a
  live-browser screenshot — the real app's own Starter Grant catch-up (Economy & Progression 1.0
  EP4) closes this gap automatically the instant the chain/star gate clears, making the pure
  "chain-clear, ingredient-missing" state a narrow, largely synthetic window in real play. This is
  pre-existing app behavior, not something this task changed or needs to change.
- No 前へ/次へ affordance was kept anywhere in the detail view (Fresh Design §17's open question).
  If a future pass wants lightweight adjacent-recipe browsing from within an open detail (without
  returning to the grid first), that would be new scope, not a 2.0A regression — it was never a
  requirement here and the task explicitly said "不要なら削除."
- 2.0B/2.0C (category tabs, search, favorites, save-schema bump) are explicitly out of this
  phase's scope per the task's own stop conditions, and remain unimplemented.

## 18. Recommended next phase

Per the design doc's own §15 phasing: 2.0B (real category tabs) only once/if a `category` field is
actually authored (e.g. alongside a future recipe-content expansion phase, not speculatively now),
or 2.0C (search/favorite/Dex quick-link) once recipe count nears the 80-recipe band or a real
findability problem is observed. Neither is warranted by today's 15-recipe catalog or the tested
30–50-recipe fixture range.
