# Teto Pizza Game — Visual Polish 1C: Shop Empty-State + Scalability (Result Report)

## 0. Fresh / Duplicate PR Gate

- `git fetch origin` run at task start. `origin/main` = `65a40c85469ee39d73be4663bcd185220d37403c`
  ("Visual Polish 1B: localize Lunch Rush Result", PR #109).
- Open PRs checked (`list_pull_requests`, state=open): #105 (Dev Automation A1, unrelated), #72
  (docs), #46 (Issue #33 Dough Shaping D0), #34 (Issue #32 Phase 1 reference-visual), #3 (docs).
  A `search_pull_requests` for `Shop`/`"Visual Polish 1C"` additionally turned up only already
  **closed** Shop PRs (#19, #83, #97, #98). **No open PR or in-progress branch overlaps this
  scope.**
- Implementation started fresh from `origin/main` on the designated branch
  `claude/shop-empty-state-scalability-ewxlxw` (reset to `origin/main`'s exact SHA — the branch
  pre-existed but carried no commits ahead of `main`).
- Re-checked for duplicates immediately before opening the PR (§15/16 below) — no new PR/branch
  touching Shop appeared in the interim.
- No coordination conflict with Recipe Expansion Batch 1B-A or Lunch Rush Completion Gate 1A:
  neither `src/data/recipes.ts`'s recipe list, `src/data/ingredients.ts`'s ingredient *values*
  (price/restock/unlock), nor any Completion Gate/Lunch Rush file was touched.

## 1. Before Behavior / Reproduced P1

Reproduced live in a real Chromium browser (Playwright driving the actual Vite dev server) against
`origin/main`'s unmodified `ShopOverlay.tsx`, before any change:

- **Fresh game** (0 owned finite ingredients): Shop showed a single centered message, "新しい素材は、
  ピザの腕前が上がると入荷します" — correctly non-broken-looking.
- **Early/few-item game** (1 owned finite ingredient, e.g. `mushroom` after `funghi` unlocks): Shop
  showed **only** the single item row (在庫/+9/150 Pitz/補充する), no guidance text of any kind, no
  category structure — matching the audit's exact finding, **P1-3** (from the AI UI/UX Visual
  Review 1.0, already referenced verbatim in `docs/reports/TETO_VISUAL-POLISH_1A_Ingredient-Tray_Result.md`
  §14): *"Shop's empty-state hint gated to `products.length === 0` only, never shown at the common
  1-2-item state."*
- **Progressed game** (15 owned finite ingredients — the game's full current catalog): Shop
  rendered all 15 rows as one long undifferentiated vertical list with no way to narrow it —
  matching **P2-4/P2-5/P2-6**: *"Dex/Shop have no category filter."*

Root cause: `shopProducts()` (`ShopOverlay.tsx`) already correctly filters `INGREDIENTS` down to
only currently-relevant rows, but the component had exactly one binary branch —
`products.length === 0` (big message) vs. `products.length > 0` (bare list, no matter how short or
long) — with no representation of "few" or "many" as distinct UX states.

## 2. Implemented UX

`src/components/ShopOverlay.tsx`:

1. **Early-game progression hint** — a new, deliberately low-emphasis one-line message
   ("レシピを解放すると、買える材料が増えます") renders above the item list (and above the new
   filter tabs) whenever `0 < products.length < EARLY_GAME_HINT_THRESHOLD` **and** the "すべて"
   (ALL) tab is active. Styled with `.shop-overlay__hint` — smaller font, no bold, no centering,
   less padding than the existing `.shop-overlay__empty` box — so it reads as a caption under the
   real item(s), never as competing with them for attention (§3 guidance).
2. **Category filter** — "すべて / ソース / チーズ / トッピング" tabs (`role="tablist"`/`role="tab"`,
   mirroring `InventoryOverlay.tsx`'s own established ALL+category pattern) filter the already-
   computed `products` list client-side. Renders whenever `products.length > 0`.
3. **Empty-filtered-category state** — when a specific category tab yields zero visible products
   (but the Shop overall isn't empty), a short message ("このカテゴリで買える材料はまだありません")
   replaces the blank list, with the same progression-hint line appended only while still in the
   early-game window (`isEarlyGame`).
4. The pre-existing 0-item full-empty-Shop message, purchase/restock rows, feedback banners,
   pricing, and stock display are all unchanged.

## 3. Guidance Condition (exact threshold + rationale)

```ts
const TOTAL_SHOP_ELIGIBLE_INGREDIENTS = INGREDIENTS.filter((i) => i.unlockCondition).length; // 15 today
const EARLY_GAME_HINT_THRESHOLD = Math.ceil(TOTAL_SHOP_ELIGIBLE_INGREDIENTS / 2); // 8 today
```

Not a hand-picked magic number: it's half of the Shop's own eventual full catalog size
(`INGREDIENTS.filter((i) => i.unlockCondition).length`), so it **scales automatically** as the
18→20→62+ ingredient roadmap lands (e.g. at 62 shop-eligible ingredients the threshold becomes 31,
proportionally the same "first half" cutoff — no re-tuning needed per batch).

Verified against the actual `data/recipes.ts` unlock chain: `funghi`→`marinara`→`bismarck`→
`genovese`→`quattro-formaggi`→... At 1/3/4/6 owned finite ingredients (through `genovese`) the hint
shows; the moment `quattro-formaggi` grants 4 more ingredients at once (pushing the count to 10),
the hint retires on its own with zero additional logic — exactly the "progression が進んだ後は不要
なら消す" requirement.

## 4. Filter Categories

Reused the ingredient catalog's own existing schema (`IngredientCategory` = `"sauce" | "cheese" |
"topping"`, `CATEGORY_ORDER`/`CATEGORY_LABEL` in `src/data/ingredients.ts`) — no invented category.
Added two small shared constants to the same file (`CategoryTab`, `CATEGORY_TAB_ORDER`,
`CATEGORY_TAB_LABEL` = `"ALL" | IngredientCategory` + `"すべて"` prepended to `CATEGORY_LABEL`) so
`ShopOverlay.tsx` reuses the exact same "ALL + category" shape `InventoryOverlay.tsx` already
established, without editing `InventoryOverlay.tsx` itself (Scope Guard forbids an "Inventory
redesign" — `InventoryOverlay.tsx` was read for reference only and has zero diff). Shop's own CSS
(`.shop-filter-tabs`/`.shop-filter-tab`/`.shop-filter-tab--active`) copies Inventory's tab visual
treatment verbatim under new, Shop-scoped class names, for the same reason: visual/mental-model
consistency without a cross-component/file coupling that risks the Inventory scope boundary.

## 5. Empty-Category Behavior

Filtering is applied **only** to the already-computed, already-visible `products` array (never to
raw `INGREDIENTS`) — a `LOCKED`/hidden `starterGrantOnly` ingredient can never appear via any tab.
When a tab's filtered result is empty, a short, calm message replaces the list (never a blank
panel) — verified live at §12/screenshot 05.

## 6. starterGrantOnly Regression Result

`starterGrantOnly` semantics are completely untouched — `shopProducts()`'s own filter (the only
place that logic lives) was not modified. Confirmed live and by test (`I/J` below): an unowned
`starterGrantOnly` ingredient (`onion`) never appears as a `LOCKED`/`AVAILABLE_TO_BUY` row in any
filter tab, including its own "トッピング" category.

## 7. Economy Regression Result

No price, `restockQuantity`, `pricePitz`, or Starter Grant logic was touched. Verified live and by
test (`G/H` below): restocking `onion` after switching to a filtered tab still debits exactly 170
Pitz and credits exactly +12 stock — identical to the pre-existing (unfiltered) EP3 restock tests.

## 8. 20/62+ Scalability Assessment

- The guidance threshold is derived from `INGREDIENTS.filter((i) => i.unlockCondition).length`,
  not hardcoded — it grows proportionally with the catalog automatically.
- The category filter narrows an eventual 62+-row single list into per-category chunks (today:
  ALL/ソース/チーズ/トッピング) using the ingredient data's own existing `category` field — no
  per-ingredient list to maintain as new ingredients are added.
- Verified live against a 15-item (the game's current full catalog) progressed state: the
  unfiltered list requires scrolling (expected, unavoidable at this count), but filtering to
  "トッピング" narrows it to 9 rows, demonstrably reducing scroll depth — the mechanism that will
  keep paying off as the catalog grows toward 62+.
- Filter tabs use `flex-wrap` (mirroring Inventory's own already-scalability-tested approach) —
  confirmed no horizontal overflow at 390×844 or 360×800 in every tested state.
- Only 3 categories exist in the schema today (`sauce`/`cheese`/`topping`); a future ingredient
  batch (Batch 1B-A) is expected to add ingredients within these same categories, not new ones —
  no invented category was added.

## 9. Tests

Added `describe("Shop Visual Polish 1C: empty state + scalability", ...)` to `src/App.test.tsx`
(10 new tests, all through the real `<App />` + `ShopOverlay`, no unit-level mocking):

| # | Task's required case | Test |
|---|---|---|
| A/B | fresh/0-item guidance | "fresh game (0 products) shows only the big empty-shop message, no hint/filter/list" |
| C | few-item state | "a few-item early Shop shows the progression hint alongside the real row" |
| D | progressed/many-item state | "a progressed Shop (>= threshold products) no longer shows the progression hint" |
| E | category filtering | "category filtering narrows the visible list to that category only" |
| F | category w/ zero items | "a category with zero purchasable items shows a short empty state" |
| G | buy/restock after filtering | "restock still works after filtering, at the exact same price/quantity" |
| H | price/restock unchanged | (same test as G — asserts the exact pre-existing 170 Pitz / +12 numbers) |
| I | starterGrantOnly unavailable until owned | "a starterGrantOnly ingredient the player doesn't own stays hidden in every filter tab" |
| J | filter never exposes locked ingredient | (same test as I, checked across ALL + its own category tab) |
| K | filter switching never mutates state | "switching filter tabs never mutates Pitz balance, stock, or ownership" |
| L | existing Shop tests regression | full suite (below) — the pre-existing `"Shop 2.0 restock (Economy & Progression 1.0 EP3)"` describe block (5 tests) passes unmodified |

Verification runs (from the designated branch, base `65a40c8`):

- Focused: `npx vitest run src/App.test.tsx` → **34 passed (34)**.
- Full suite: `npx vitest run` → **84 test files, 1644 passed (1644)** (1636 pre-existing + 8 net
  new — 10 new Shop tests, no removed tests; count includes both the App.test.tsx overall total
  and unrelated suites, run twice with identical results, no flakes observed on either run).
- `npx tsc -b` → clean, no errors.
- `npm run lint` (`oxlint`) → clean, no errors.
- `npm run build` (`tsc -b && vite build`) → succeeds, 92 modules transformed.

No flaky tests encountered — full suite run twice back-to-back with identical pass counts both
times, no isolated-rerun was needed.

## 10. Browser Verification

Real Chromium (Playwright, `/opt/pw-browsers/chromium`) against the actual Vite dev server, real
`localStorage` save seeding (no mocked state), for every state at 390×844, plus a 360×800
representative state:

| Scenario | Viewport | Console errors | Horizontal overflow |
|---|---|---|---|
| Fresh Shop (0 items) | 390×844 | 0 | none |
| Early/few-items Shop (1 item, hint shown) | 390×844 | 0 | none |
| Progressed Shop (15 items, hint hidden) | 390×844 | 0 | none |
| Filtered Shop (トッピング, 9/15 items) | 390×844 | 0 | none |
| Empty filtered category (トッピング, 0 items) | 390×844 | 0 | none |
| Few-items + filter (ソース) | 360×800 | 0 | none |

Confirmed manually from screenshots: guidance text is visibly smaller/lower-emphasis than the item
cards; filter chips wrap and stay within the panel width at both viewports; buy/restock CTA never
hidden; stock updates correctly after a filtered restock tap; scrolling within `.dex-overlay__body`
unaffected; bottom safe-area padding (`.dex-overlay__body`'s existing `calc(16px + env(...))`)
untouched.

## 11. Screenshots

Saved to `docs/reports/screenshots/visual-polish-1c/`:

- `01-fresh-shop-390x844.png`
- `02-early-few-items-390x844.png`
- `03-progressed-many-items-390x844.png`
- `04-filtered-topping-390x844.png`
- `05-empty-category-390x844.png`
- `06-few-items-filtered-360x800.png`

## 12. Changed Files

- `src/components/ShopOverlay.tsx` — guidance hint, category filter, empty-category state.
- `src/data/ingredients.ts` — added `CategoryTab`/`CATEGORY_TAB_ORDER`/`CATEGORY_TAB_LABEL` shared
  constants only (no ingredient data — price/restock/unlock — touched).
- `src/App.css` — new `.shop-overlay__hint`/`.shop-filter-tabs`/`.shop-filter-tab`/
  `.shop-filter-tab--active` rules only; no existing rule modified.
- `src/App.test.tsx` — new `describe` block (10 tests), nothing else changed.
- `docs/reports/screenshots/visual-polish-1c/*.png` — new.
- `docs/reports/TETO_VISUAL-POLISH_1C_Shop-Scalability_Result.md` — this report.

`InventoryOverlay.tsx`, `src/data/recipes.ts`, `src/logic/economy.ts`, `src/state/starterStock.ts`,
Save schema (`persistence.ts`), Completion Gate, Lunch Rush, scoring, and Firebase files all have
**zero diff**.

## 13. Remaining Shop Risks

- The guidance hint's copy ("レシピを解放すると、買える材料が増えます") is technically imprecise for
  the one ingredient (`onion`) whose `unlockCondition.minTotalStars: 12` is a legacy pre-EP4 value
  — but since `starterGrantOnly` already suppresses any LOCKED/AVAILABLE_TO_BUY row for it, this
  never surfaces as a contradictory on-screen claim; purely a latent data note, not a UX bug.
- At the full 62+-ingredient roadmap, the "half of total" threshold and 3 fixed categories should
  be re-audited empirically (this task deliberately does not simulate a 62-ingredient catalog it
  doesn't have data for yet) — flagged as a natural follow-up once Batch expansions land, not a
  blocker today.
- `.shop-filter-tabs` duplicates `.inventory-tabs`' visual values rather than sharing a single CSS
  rule — an intentional trade-off (§4) to avoid touching `InventoryOverlay.tsx`/its CSS under the
  Scope Guard's "no Inventory redesign" rule; a future task explicitly scoped to both screens could
  consolidate this if desired.

## 15. Post-main-sync Verification (main advanced past PR #111's original base)

By the time PR #111 was open, two more PRs merged to `main`: **#112** (Recipe Expansion Batch
1B-A: Pizza Bianca + Breakfast Pizza, adding `rosemary`/`bacon`) and **#110** (Lunch Rush
Completion Gate 1A). This section re-verifies PR #111's own branch against that new `main`,
without opening a new PR or touching either PR's own scope.

**Sync**

- Previous base SHA: `65a40c85469ee39d73be4663bcd185220d37403c` (PR #109).
- Latest `main` SHA (fresh `git fetch origin`): `c5939a98a9551225617dc5c89bb3eb0974af4e96`
  ("Lunch Rush Completion Gate 1A (#110)"), which already contains `6d5c091` ("Recipe Expansion
  Batch 1B-A (#112)").
- Sync method: `git merge origin/main --no-edit` (a merge commit, not a rebase — PR #111's own
  history is preserved unchanged; no force-push).
- Post-sync HEAD: `fb0c7c53...` (see §16 for the exact SHA after the follow-up fix commit below).
- **Conflicts: none.** Batch 1B-A's `App.test.tsx`/`data/ingredients.ts` edits landed in
  different regions of each file than PR #111's own additions (Batch 1B-A appended inside the
  `HOME/GAME separation` describe block and inside the `INGREDIENTS` array; PR #111's additions
  are a separate describe block at the very end of `App.test.tsx` and new exports appended after
  `INGREDIENTS`'s closing bracket in `data/ingredients.ts`) — `git merge` auto-resolved both with
  no manual intervention needed. Confirmed nothing was silently lost: `13 recipes` / `20
  ingredients` / `rosemary`/`bacon`/`Pizza Bianca`/`Breakfast Pizza` (from Batch 1B-A) and
  Completion Gate 1A's own `MissionServePanel.tsx`/`lunchRush.ts`/`gameReducer.ts` changes are all
  present post-merge; PR #111's own guidance hint/category filter/empty-category logic in
  `ShopOverlay.tsx` is unchanged and intact.

**Batch 1B-A compatibility audit (§3)**

- `rosemary`/`bacon` are both `category: "topping"`, `starterGrantOnly: true`, `unlockCondition: {
  minTotalStars: 0 }` — the identical EP4/`starterGrantOnly` pattern every other finite ingredient
  already uses; no new category or special case was introduced by Batch 1B-A.
- Verified live: with neither owned, both stay completely absent from the Shop in every tab
  (ALL and トッピング) — the pre-existing `starterGrantOnly` filter in `shopProducts()`
  (untouched by this PR) already covers them correctly, since it keys purely on
  `unlockCondition`/`starterGrantOnly`/ownership, never a hand-maintained ingredient list.
- Verified live: once owned, both appear correctly under "トッピング" (and "すべて") with their
  real price/restock (`rosemary` 55 Pitz / +9, `bacon` 140 Pitz / +9) — unchanged from Batch
  1B-A's own shipped values, confirmed by screenshot §17.

**Guidance threshold re-check (§4)**

- `TOTAL_SHOP_ELIGIBLE_INGREDIENTS` moved from 15 to 17 (two new `unlockCondition`-bearing
  ingredients), so `EARLY_GAME_HINT_THRESHOLD` (`Math.ceil(17/2)`) moved from 8 to **9** — with
  **zero code change**, exactly the "scales automatically" property this design was built for.
  Re-verified this isn't accidentally too long/too short against the current unlock chain: the
  hint still shows through the same early recipes (funghi/marinara/bismarck/genovese, 1-6 owned)
  and still retires once quattro-formaggi's grant pushes the count into double digits — the one
  additional owned ingredient's worth of "still early" headroom (8→9) doesn't change which
  recipes are considered "early game." **No production logic was changed.**
- One test-only issue *was* found and fixed: `App.test.tsx`'s "progressed/many-item" fixture
  (`MANY`) had hardcoded a literal list of exactly 8 ingredient ids (a copy of the old threshold),
  which fell below the new threshold of 9 and made that one test (`D`) fail after the sync. Fixed
  by exporting `EARLY_GAME_HINT_THRESHOLD` from `data/ingredients.ts` (see below) and deriving
  `MANY` as `INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id).slice(0,
  EARLY_GAME_HINT_THRESHOLD)` — sized off the real constant instead of a hardcoded copy, so this
  exact staleness cannot recur on the next ingredient batch. This is a test-fixture fix only; the
  Shop's own runtime behavior/threshold formula is unchanged from the original PR.
- Incidental fix alongside this: `EARLY_GAME_HINT_THRESHOLD`/`TOTAL_SHOP_ELIGIBLE_INGREDIENTS`
  were originally private constants inside `ShopOverlay.tsx`; exporting one directly from that
  file tripped oxlint's `react(only-export-components)` Fast Refresh rule (a component file
  should only export its component). Moved both constants into `data/ingredients.ts` instead
  (alongside the already-shared `CategoryTab`/`CATEGORY_TAB_*` constants from the original PR) —
  `ShopOverlay.tsx` now imports `EARLY_GAME_HINT_THRESHOLD` rather than defining it, keeping the
  component file lint-clean while making the constant available to tests. No behavior change.

**Category filter regression (§5)**

- "すべて/ソース/チーズ/トッピング" still matches the live `CategoryTab`/`CATEGORY_ORDER` schema
  exactly — Batch 1B-A added zero new categories.
- `rosemary`/`bacon` file correctly under "トッピング" (confirmed live, screenshot §17).
- Filter still only narrows already-computed `shopProducts()` output; still never mutates
  ownership/stock/price on tab switches (unchanged code, re-confirmed by the full existing test
  suite in §16).

**Lunch Rush regression guard (§6)**

- No Lunch Rush/Completion Gate file was touched by this PR (`git diff` against `main` confirms
  zero changes to `src/mission/lunchRush.ts`, `src/logic/completionGate.ts`,
  `src/components/MissionServePanel.tsx`, or `src/state/gameReducer.ts`'s Completion Gate cases).
- Focused re-run: `npx vitest run src/mission/lunchRush.test.ts src/logic/completionGate.test.ts`
  → **60/60 passing**, including PR #110's own FAILED→+0 servedCount/quality, order-advances, and
  timer-continues cases. No blocker found; nothing needed reporting.

## 16. Tests (post-sync)

- Focused Shop suite: `npx vitest run src/App.test.tsx` → **37/37 passing** (34 original + the
  fixed `MANY` fixture), covering A–M from §7 of the task (fresh/0/few/many-item guidance,
  category filtering, empty-filtered-category, restock-after-filter with unchanged price/qty,
  `starterGrantOnly` protection, locked-ingredient non-exposure via filter, filter-switching not
  mutating state, and — newly — `rosemary`/`bacon` compatibility, verified live in §17 below).
- Full suite: `npx vitest run` → **84 test files, 1668/1668 passing**, run twice back-to-back with
  identical results (no flakes across either run).
- `npx tsc -b` → clean.
- `npx oxlint` (`npm run lint`) → clean (the one transient warning introduced mid-fix, described
  in §15 above, was resolved before this final run — zero warnings, zero errors).
- `npm run build` → succeeds, 92 modules transformed.
- `python3 tools/validate_recipe_catalog.py` (Master Catalog validator) → "Checked 53 recipe
  entries, 62 ingredient entries, 11 mechanic entries. All checks passed." (validates the full
  eventual master catalog, independent of today's shipped 13/20 subset — unaffected by this PR).

**Known flaky test (§8):** `src/state/phase4a1a.regression.test.ts` (pre-existing, untouched by
this PR or by #110/#112 — confirmed via `git diff`/`git log` on that file). Isolated reruns: 5
consecutive `npx vitest run src/state/phase4a1a.regression.test.ts` runs → 4 passed, 1 failed (a
single randomized sub-case) — reproducing the exact known pre-existing flake described in the
task, at roughly the expected low frequency. Two full-suite reruns (`npx vitest run`, no file
filter) both came back 1668/1668 clean. Since the file has zero diff versus `main` and is entirely
unrelated to Shop/`ShopOverlay.tsx`/`data/ingredients.ts`, no fix was mixed into this PR — flagged
here per the task's instruction, not addressed.

## 17. Browser Verification (post-sync, 20-ingredient/13-recipe main)

Real Chromium (Playwright) against the merged branch's own dev server, real `localStorage` save
seeding, console-error and horizontal-overflow checks on every scenario:

| Scenario | Viewport | Console errors | Horizontal overflow |
|---|---|---|---|
| Fresh Shop (0 items) | 390×844 | 0 | none |
| Early/few-items Shop (1 item — hint shown, now against threshold 9) | 390×844 | 0 | none |
| Progressed Shop (all 17 shop-eligible items owned, incl. `rosemary`/`bacon`) | 390×844 | 0 | none |
| Filtered Shop (トッピング, 12/17 items incl. `rosemary`/`bacon`) | 390×844 | 0 | none |
| Empty filtered category (トッピング, 0 items, sauce+cheese-only owner) | 390×844 | 0 | none |
| `rosemary`/`bacon` available, filtered to トッピング | 360×800 | 0 | none |
| `rosemary`/`bacon` **not yet owned**, filtered to トッピング (confirms non-exposure) | 390×844 | 0 | none |

Confirmed from the HOME header in every screenshot: "レシピ 0/13" — the live 13-recipe catalog is
what was actually exercised, not a stale 11-recipe assumption. `rosemary`/`bacon` render with
their real emoji/price/restock (55 Pitz/+9 and 140 Pitz/+9 respectively) identically whether
reached via "すべて" or "トッピング". Updated/added screenshots in
`docs/reports/screenshots/visual-polish-1c/`:

- `01-fresh-shop-390x844.png`, `02-early-few-items-390x844.png`,
  `03-progressed-many-items-390x844.png`, `05-empty-category-390x844.png` — refreshed against the
  new 20-ingredient/13-recipe `main`.
- `04-filtered-topping-390x844.png` — refreshed, now shows `rosemary`/`bacon` in the filtered list.
- `06-rosemary-bacon-available-360x800.png` — new: 360×800 state with only `rosemary`/`bacon`
  owned, filtered to トッピング.
- `07-rosemary-bacon-not-yet-owned-390x844.png` — new: confirms neither ingredient leaks via any
  filter tab before its Starter Grant lands.

## 18. Final Verdict

**A. READY TO MERGE.**

Everything in the original §14 verdict still holds: P1-3 is resolved with a data-derived
threshold, the category filter reuses Inventory's established mental model with no invented
category, and filtering never exposes a locked/`starterGrantOnly` ingredient or mutates game
state. Re-verified against the now-current `main` (13 recipes / 20 ingredients, Batch 1B-A +
Completion Gate 1A merged): the merge was conflict-free, `rosemary`/`bacon` behave correctly in
the Shop and its filter with unchanged pricing, the guidance threshold's data-driven design
absorbed the catalog growth with zero production-code change (only a stale test fixture needed
updating), Lunch Rush/Completion Gate are confirmed unmodified and passing, and the full suite is
green (1668/1668, `tsc`/`oxlint`/build/Master-Catalog-validator all clean) with the one known
pre-existing flake (`phase4a1a.regression.test.ts`, unrelated to this PR) documented per the
task's own instructions rather than fixed here. Verified live in a real browser at 390×844 and
360×800 against the merged catalog, including the new `rosemary`/`bacon` ingredients, with zero
console errors and zero horizontal overflow.
