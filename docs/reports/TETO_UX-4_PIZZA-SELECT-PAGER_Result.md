# Teto Pizza Game — UX-4: Pizza Select Mobile Single-Screen Pager — Result

Issue #88: replace Pizza Select's scrolling grid of 7 recipe cards with a single-recipe pager
that fits 390×844 in one screen, buttons-only navigation, clamp-at-ends, chapter-ready for a
future larger catalog.

## 1. Audited main SHA

`f2a455f7a6428c52db6ee321590a5504e8d18f2e` — "UX-1: Lunch Rush continuous per-pizza progression
(#85) (#91)", fetched fresh via `git fetch origin && git rev-parse origin/main` at the start of
this session. This is newer than the task's own reference SHA
(`f2a455f7a6428c52db6ee321590a5504e8d18f2e` — identical; no drift between the task's reference
and the actual latest `main`).

Read in full before implementation: Issue #88, `docs/reports/TETO_GAMEPLAY-UX-NEXT_Fresh-Audit.md`
(§1.3/§5/§8 UX-4 slice, §10 open decisions), `docs/reports/
TETO_INGREDIENT-ECONOMY-UI-SCALABILITY_Fresh-Audit.md` (§9 Recipe Select scalability, §10.2 scale
gates), the pre-change `PizzaSelectScreen.tsx`/`pizzaSelect.ts`/`PizzaSelectScreen.test.tsx`/
`pizzaSelect.test.ts`, `recipes.ts` (unlock chain + `mysteryLock`), `progression.ts`
(`isRecipeAvailable`), and every existing App-level integration test that drives Pizza Select
(`App.test.tsx`, `App.humanFeelFix3.test.tsx`, `App.playerReference.test.tsx`).

One note on the two audits' apparent tension: the Ingredient-Economy audit (§9.2) recommends
grid-based browsing over a carousel *at every scale*, evaluating a hypothetical carousel in
isolation. Issue #88 asks for the pager specifically for today's 7-recipe production catalog
(where a carousel is not "strictly worse," per that same table) and requires the result to be
Chapter-ready rather than requiring grid+carousel to coexist forever — this implementation
follows Issue #88's explicit instruction, and keeps the pager's `recipes` input swappable so a
future Chapter/Tier entry point (per that audit's own §10.2 scale-gate table) can still choose
grid, sectioned grid, or a filtered pager without this component needing a rewrite.

## 2. Previous UI

`PizzaSelectScreen.tsx` rendered a `role="list"` CSS grid (`.pizza-select-grid`, 2 columns) of
all 7 `RECIPES`, each a full-card `<button>` (`RecipeSelectCard`) that was itself the tap target
for `onSelectRecipe`. Locked cards (including フガッサ's `？？？` mystery) were `disabled`
buttons in the same grid. No pager, no position indicator, no per-recipe focus — the whole list
was visible at once via vertical scroll (`overflow-y: auto`) once it exceeded the viewport.

## 3. New UI

A single-recipe pager: one `RecipeDetailPanel` (COMPLETED/NEW/LOCKED, identical data/branches to
before) filling most of the screen, a 前へ/次へ navigation row with a position indicator between
the two buttons, and one shared `作る` CTA (🍕 このピザを作る！) pinned below. The card itself is
no longer a button — selecting a recipe is now always via the one CTA, disabled (never wired to
`onSelectRecipe`) while the current card is LOCKED. Locked/mystery-lock/COMPLETED/NEW rendering
is otherwise the exact same three-way branch as before, just laid out in one large focused panel
instead of one grid cell.

## 4. Pager architecture

`PizzaSelectScreen` owns one `currentIndex` (`useState(0)`), clamped every render via
`clampPagerIndex(index, recipes.length)` (`src/state/pizzaSelect.ts`). Previous/Next call
`setCurrentIndex(i => clampPagerIndex(i ± 1, recipes.length))` — clamp-at-ends, never wraps
(product decision below). `recipeCardState(recipes[index], dex, ownedIngredientIds)` — completely
unchanged — derives what to render; the pager adds zero new derivation logic for lock/availability
state.

**Wrap vs. clamp (Issue #88's own open decision, §8 of the Fresh Audit)**: clamp. Issue #88's
own instructions are explicit — "意図しない無限carouselにはしない" — and clamping is the
lower-risk, more standard mobile-list-end behavior (matches how HOME's own menus/lists behave at
their ends); a 7-item wraparound also risks a first-time player misreading "index 7 → back to
index 1" as a bug rather than a feature. Prev/Next are `disabled` (not hidden) at the ends, so the
row's layout and touch targets never shift.

## 5. `visibleRecipes` strategy

`PizzaSelectScreen` takes an optional `recipes?: readonly Recipe[]` prop, defaulting to the full
`RECIPES` array. All pager arithmetic (`clampPagerIndex`, `pagerIndicatorKind`, boundary
disabling) is pure index/count logic over whatever array is passed in — nothing hard-codes "7."
This is deliberately the `visibleRecipes` seam Issue #88 asks for: a future Chapter/Tier entry
point narrows `RECIPES` down to the recipes unlocked-so-far (or the active chapter) and hands that
filtered array to this same component with no changes to `PizzaSelectScreen.tsx`,
`pizzaSelect.ts`, or their tests. Verified directly by test #16 (a mocked 12-recipe collection).

## 6. Locked recipe handling

Unchanged data path: `recipeCardState` still returns `LOCKED` for both axes (`recipeUnlocked`
gate not met, *or* required ingredients not owned) — the pager renders both identically, exactly
as the pre-existing grid did. The card shows the lock silhouette + (real name or `？？？`) +
unlock hint; the shared CTA is `disabled`/`aria-disabled` and never calls `onSelectRecipe` for a
LOCKED card (confirmed by tests #8, #9, #10).

## 7. Fugazza mystery verification

`fugazza.mysteryLock` still flows through `recipeCardState`/`unlockHintFor` completely unchanged
— this implementation never branches on `recipe.id === "fugazza"` anywhere. Verified:
- `pizzaSelect.test.ts`'s pre-existing mystery-lock assertions (hint never contains
  `たまねぎ`/`フガッサ`) — untouched, still passing.
- `PizzaSelectScreen.test.tsx` test #9: navigates the pager (via Next, exercising the pager's own
  chrome) to fugazza's position and confirms the card reads `？？？`, the hint is the star-count
  line, and the CTA is disabled/non-functional.
- **New pager-chrome-specific check**: the position indicator is index-only by construction
  (`{index + 1} / {total}` or a dot row) — it never reads `recipe.nameJa`/`mystery`, so it cannot
  leak fugazza's identity by construction, not just by the current test's absence of a leak. A
  dedicated test asserts the indicator element's own text/aria-label never contains `フガッサ`
  even when fugazza is the active card.

## 8. Scalability strategy (Scale Gate)

Two new pure helpers in `src/state/pizzaSelect.ts`:
- `clampPagerIndex(index, total)` — used by all pager navigation; verified correct from `total=0`
  up through `total=160` in unit tests.
- `pagerIndicatorKind(total)`: `"dots"` at ≤`PAGER_DOT_INDICATOR_MAX` (10), `"counter"` above —
  guarantees a 53/100/160-recipe future can never render a 53-dot row (explicitly forbidden by
  Issue #88), switching to a compact "N / total" label instead. Verified at 7, 10, 11, 53, 100,
  160.

This intentionally implements only the "~10: pager" rung of Issue #88's own Scale Gate table now
— no Chapter/Category UI, no search/filter/favorites — while keeping the `recipes` prop and the
two pure helpers as the exact seam the later rungs (11–30 pager+chapter entry, 31–80
chapter+pager+quick selector, 80+ chapter+search) would build on top of, per §5 above.

## 9. Mobile measurements

Measured with a real headless-Chromium Playwright session against the Vite dev server (not just
jsdom, which has no layout engine) at both required widths.

| Metric | 390×844 | 360×800 |
|---|---|---|
| `document.documentElement.scrollWidth` | 390 | 360 |
| Horizontal overflow (`scrollWidth > viewportWidth`) | **false** | **false** |
| `document.documentElement.scrollHeight` | 844 | 800 |
| Vertical overflow (`scrollHeight > viewportHeight`) | **false** | **false** |
| Next disabled at last recipe (fugazza) | true | true |
| Prev disabled at first recipe (margherita) | true | true |
| Console errors during the full flow | **none** | **none** |

## 10. 390×844 result

**PASS.** Screenshots captured for HOME → FREE (「ピザを作る」) → Pizza Select at first
(margherita, NEW), middle (bismarck, LOCKED w/ real name + hint), and last (fugazza, mystery
LOCKED, `？？？` + star hint, no leak) positions, plus the nav/CTA row. No vertical scroll for
normal selection, CTA never clipped, no overlapping text, mystery lock never leaked, no console
errors. (One real bug was caught and fixed during this pass, see §17.)

## 11. 360px result

**PASS.** Same flow re-run at 360×800 (narrower than the required minimum check). No horizontal
overflow, no clipped CTA, no overlapping text, identical layout behavior to 390×844 at every
position tested (first/middle/last).

## 12. Changed files

- `src/screens/PizzaSelectScreen.tsx` — rewritten: grid → single-recipe pager.
- `src/screens/PizzaSelectScreen.test.tsx` — rewritten for the pager's own DOM/behavior (18
  tests, covering all 17 items in §13 below plus one extra single-card-at-a-time regression
  guard).
- `src/state/pizzaSelect.ts` — added `clampPagerIndex`, `pagerIndicatorKind`,
  `PAGER_DOT_INDICATOR_MAX`; `recipeCardState`/`unlockHintFor` untouched.
- `src/state/pizzaSelect.test.ts` — added unit tests for the two new pure helpers.
- `src/App.css` — replaced `.pizza-select-grid`/most of `.pizza-select-card`'s old grid-cell
  sizing with pager layout (`.pizza-select-pager`, `.pizza-select-nav*`, `.pizza-select-dot*`,
  `.pizza-select-counter`, `.pizza-select-cta`); removed the now-unused `.pizza-select-footer`
  rules (the old static-tagline footer isn't rendered by the pager). `.pizza-thumbnail`'s own
  base rule (also used by `GameScreen.tsx`'s order preview) is untouched; the pager only scopes
  it larger via `.pizza-select-card .pizza-thumbnail`.
- `src/App.test.tsx`, `src/App.humanFeelFix3.test.tsx`, `src/App.playerReference.test.tsx` —
  updated the handful of integration tests that previously clicked a specific recipe's grid-cell
  button directly; they now page to the target recipe (by `RECIPES`-index) and tap the shared
  CTA, via a small per-file `selectRecipeInPizzaSelect`/`enterMakingWith` helper (matching this
  codebase's existing per-file helper convention, e.g. `completeDoughStep`). No behavior these
  tests actually exercise (Dex, unlock chain, scoring, Lunch Rush, HOME/GAME navigation) changed
  — only how the test drives Pizza Select's now-different DOM.

Not touched: `recipes.ts`, `progression.ts`, `dex.ts`, `inventory.ts`, any Shop/EP3/EP4 file,
`persistence.ts`, `gameReducer.ts`, `lunchRush.ts`, `App.tsx`'s Pizza-Select wiring (still passes
`dex`/`ownedIngredientIds`/`onSelectRecipe`/`onBack` — the new optional `recipes` prop is simply
left at its default there).

## 13. Tests

All 17 requested scenarios are covered (`PizzaSelectScreen.test.tsx` unless noted):

1. Initial recipe display — test 1.
2. Next — test 2.
3. Previous (incl. disabled at start) — test 3.
4. End boundary (clamp, no wrap) — test 4.
5. Position indicator (dots at 7, advances) — test 5.
6. Selected recipe CTA — test 6.
7. Unlocked recipe (bismarck) — test 7.
8. Locked recipe (funghi, real name + hint + disabled CTA) — test 8.
9. Fugazza mystery (no leak via pager chrome) — test 9.
10. Unavailable-by-ingredients recipe (fugazza, chain met, onion not owned) — test 10.
11. Recipe ordering preserved (RECIPES' own declared order, not chain order) — test 11.
12. HOME roundtrip — test 12.
13. FREE recipe selection — test 13.
14. Lunch Rush regression (no Lunch Rush affordance on this screen) — test 14.
15. 7 recipes normal (full forward+back walk) — test 15.
16. Mocked larger (12-recipe) collection doesn't break pager arithmetic, switches to counter
    mode — test 16.
17. Horizontal overflow regression — **not feasible in jsdom** (no real layout engine); covered
    instead by the real-browser Playwright measurement in §9/§10/§11 above.

Plus: two extra regression guards (exactly one `.pizza-select-card` at a time, never
`.pizza-select-grid`; the position indicator's own text never contains the current recipe's
name) and full unit coverage of `clampPagerIndex`/`pagerIndicatorKind` in `pizzaSelect.test.ts`
(6 + `PAGER_DOT_INDICATOR_MAX` cases, from `total=0` through `total=160`).

## 14. Full suite

`npx vitest run`: **65 files, 1313 tests, all passing** (up from 1295 before this change — 18
net new/rewritten Pizza Select tests + 11 new `pizzaSelect.ts` unit tests, minus the old
7-test-shorter grid suite). No test outside `PizzaSelectScreen.test.tsx`/`pizzaSelect.test.ts`
had its *assertions* changed — only the three App-level integration files' *navigation
mechanics* (how a test reaches a given recipe) were updated to match the new pager DOM.

## 15. Typecheck / lint / build

- `npx tsc -b` — clean, no errors.
- `npx oxlint` — clean, no errors.
- `npm run build` (`tsc -b && vite build`) — succeeds; `dist/assets/index-*.css` 37.57 kB
  (gzip 7.88 kB), `dist/assets/index-*.js` 330.32 kB (gzip 104.22 kB) — materially unchanged from
  before this change (a layout/CSS change, no new dependencies).

## 16. Console / overflow

No console errors or warnings during the full Playwright-driven walkthrough (HOME → FREE →
first/middle/last recipe → boundary checks) at either 390×844 or 360×800. No horizontal or
vertical overflow at either width (§9).

## 17. Unresolved items / issues found and fixed during this session

**Found and fixed (not left unresolved)**: the first implementation reused `.cta-button--primary`
for the pager's CTA, which sets `flex: 1` — correct for its usual horizontal-row homes (e.g.
`.home-cta-row`) but, inside this pager's *vertical* flex column, `flex: 1` instead grew the
button to fill all remaining vertical space, rendering as a giant near-full-screen circle (the
button is fully rounded, `border-radius: 999px`). Caught by the first-pass Playwright screenshot
(§10's process), fixed with `.pizza-select-cta { flex: 0 0 auto; ... }`, re-verified with a second
screenshot pass showing the correct compact CTA (see the screenshots delivered alongside this
report).

**Genuinely unresolved / left for a future slice** (none block this PR):
- The old static-tagline footer (「今日はどのピザに挑戦する？」) was removed rather than kept,
  since there's no remaining vertical space for it in a one-screen layout with a large focused
  card — a deliberate scope call, not an oversight, but flagged here since it's visible copy that
  disappeared.
- No swipe gesture (per Issue #88, buttons-only is the explicit Phase 1 scope; swipe is
  future-enhancement-only, layered on the same `currentIndex` state).
- No Chapter/Category entry point, search, or favorites (explicitly out of scope per Issue #88's
  own Scope Guard).

## 18. Future 53/100/160-recipe strategy

Unchanged from the two audits' own recommendations, restated concretely against what this PR
ships:
- **≤10 recipes (today, 7)**: this PR's pager as-is — no further work needed.
- **11–30**: introduce a Chapter/Tier entry screen that computes a `visibleRecipes` subset (e.g.
  "every recipe in the player's current chapter") and passes it to this same
  `PizzaSelectScreen` via its existing `recipes` prop — zero changes to the pager itself.
  `pagerIndicatorKind` already switches away from dots automatically once that subset (or the
  full catalog) exceeds 10.
- **31–80**: add a quick selector/jump control (e.g. a chapter dropdown or grid-of-thumbnails
  jump screen) that sets `currentIndex` directly, layered on top of the same pager — no rewrite
  of the prev/next/CTA/indicator core.
- **80+**: add search/filter ahead of the pager, per the Ingredient-Economy audit's own §10.2 —
  again, feeding the same `recipes` prop, not replacing the pager mechanics.

The two new pure functions (`clampPagerIndex`, `pagerIndicatorKind`) and the `recipes` prop are
the entire seam every later rung needs; nothing in this PR needs to be revisited to add them.

## 19. Scope confirmation

Out of scope per Issue #88's Scope Guard, and not touched: EP4, Ingredient Tray redesign, Making
Step Tabs (#86), Inventory screen, Ranking (#87), Achievement Reset (#89), recipe/ingredient
expansion, Chapter implementation, search, favorites, RESULT redesign. Recipe Unlock conditions,
Dex progression, stars, Pitz, Inventory, EP4 Starter Stock, Shop, Lunch Rush mission recipe
logic, scoring, Save schema, and Fugazza mystery are all unchanged (verified by the full,
unmodified-assertion test suite in §14). `RECIPES`' own declared order is unchanged (verified by
test #11).

## 20. FINAL VERDICT

**A. UX-4 COMPLETE — READY FOR MERGE REVIEW.**

All 17 requested test scenarios pass (16 automated + 1 real-browser measurement in lieu of a
jsdom-infeasible overflow test), the full existing suite of 1313 tests passes with only
navigation-mechanics updates (no assertion changes) in the three App-level integration files,
typecheck/lint/build are all clean, and 390×844/360px are both visually verified via real-browser
screenshots with no scroll, no overflow, no console errors, and no mystery-lock leak. Per the
task's own instruction, this PR is opened for review and is **not merged**.
