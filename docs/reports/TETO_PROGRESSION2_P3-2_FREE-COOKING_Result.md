# Progression 2.0 Phase 3-2: Free Cooking / Owned Ingredient Selection (Fresh Audit + Result)

Issue #194 (parent #182). Branch `claude/phase-3-2-free-cooking-1ziqao`, cut from `main`.
**The PR stays OPEN for review. It is not merged.**

| Item | Value |
|---|---|
| Audited `main` | `5cf59f94309288ebcf9c02f0310f1f47ef6c74f2` (the PR #193 Phase 3-1 merge), matching the expected SHA |
| Scope decision | **One PR.** The Fresh Audit found no reason to split into 3-2A/3-2B (§1.4) |
| Save schema | **Unchanged** (v2). There is no migration and no new persisted field |
| Visible UI change | Yes: a HOME entry, the free-cook PREPARE card and tray, and the NEW / KNOWN / ORIGINAL result |

---

## 1. Fresh Audit (done before implementation)

### 1.1 GitHub state

- `origin/main` HEAD is `5cf59f9`, as expected. Issue #194 was read in full.
- Open PRs: #105, #72, #46, #34, #3. None of them touches the tray, the reducer or discovery, so
  nothing overlaps. Open issues: none duplicates #194. #88 (UX-4 pager) and #39 (HOME/FREE UX)
  are older, related UX tracks that are not started.

### 1.2 Phase 3-1 foundation (what 3-2 builds on)

| Piece | State at `5cf59f9` | Consequence |
|---|---|---|
| `signatureOfPizza` / `matchDiscovery` / `evaluateDiscovery` | Pure and deterministic, exact match only. Outcomes: `ORIGINAL`, `AMBIGUOUS`, `NEW_DISCOVERY`, `ALREADY_DISCOVERED`, plus `INCOMPLETE_MATCH` from the registration writer | Reused unchanged |
| `RECIPE_DISCOVERY_CATALOG` | 15 production recipes, 0 signature collisions | Reused unchanged |
| `REGISTER_TO_DEX` | Evaluates discovery against the pre-round Dex and writes `lastDiscovery`. The `phase === "RESULT"` guard makes it exactly once | Reused. A MATCHED free-cook pizza goes through it unchanged |
| `lastDiscovery` | Transient, never rendered | Now rendered by the free-cook result |

### 1.3 Current implementation (recipe-first)

| Area | Finding |
|---|---|
| HOME → PizzaSelect → `SELECT_RECIPE` | Every round needs a selected recipe (Phase-2 X-1). |
| `IngredientTray` | Lists only `recipe.requiredIngredients ∩ owned` (Issue #159 P0). A free combination cannot be tapped (X-2). |
| Reducer ownership gate | `APPLY_SAUCE` / `COMMIT_SAUCE_DISPENSE` / `PLACE_TOPPING` already reject non-owned ids and gate on step category, **not** on recipe membership. So the engine already allows any owned ingredient; only the UI filters. |
| Stock (EP3) | `canPlaceIngredient` rejects placement past remaining stock. The tray **shows** an owned 0-stock chip, disabled, with `×0`. `CONFIRM_BAKE` is the only consumption point, and it is exactly once. |
| OWNED vs stock | `ownedIngredientIds` is permanent. `inventory` is the consumable count. Starter ingredients have no `unlockCondition`, so they are unlimited (`∞`). |
| `GameState.recipe` | Non-null everywhere: hints, BAKE gauge, `PizzaStage`, cooking profile, completion gate, scoring. |
| `getCookingProfile(unknownId)` | Returns `DEFAULT_COOKING_PROFILE` (DOUGH → SAUCE → CHEESE → TOPPING, no CUT). `getReferencePizza(unknownId)` returns null. |
| Completion gate / scoring | Recipe-relative (X-3). The Phase-2 design says a free cook needs a recipe-free rule (dough, ≥1 item, a generic bake window) and that "scoring happens only after a match". |
| Lunch Rush | `MISSION_*` goes through `buildOrderState` and registers via `MISSION_NEXT_ORDER`. It never runs discovery. |

### 1.4 Why one PR

The engine already supports ownership-gated, recipe-free placement. The matcher, catalog and Dex
writer already exist. What is missing is a round without a recipe, a recipe-free completion
check, the tray filter switch and the result UI. That is about 300 lines of production code in
the reducer, the tray, the result card and the HOME entry. None of it needs a save migration. A
3-2A/3-2B split would have shipped an entry point with no result, or a result with no entry
point. Neither half would be verifiable alone.

---

## 2. Design (what was implemented)

### 2.1 Free-cook round: a sentinel recipe, not a type change

`src/data/freeCook.ts` defines `FREE_COOK_RECIPE`, an inert sentinel:

- The id is `free-cook`. It is not in `RECIPES`, so `getRecipe`, `getReferencePizza` and the Dex
  sanitizer never resolve it.
- `requiredIngredients` is empty.
- `getCookingProfile` falls back to the default 4 steps with no CUT, so every category is
  reachable and each step can be skipped with 次へ.
- The bake window is `FREE_COOK_BAKE_TARGET = {58, 78}`. It is the **median start and median
  end of the 15 shipped `bakeTarget`s**, derived in code rather than hand-picked.

It is paired with `FREE_COOK_ORDER` and the new transient flag `GameState.freeCook`. The new action
`START_FREE_COOK` builds a fresh round through the same `buildOrderState` every round uses, so
pizza, score, `lastDiscovery`, `lastPitzCredit` and the other fields are all reset. It lands at
PREPARE like `SELECT_RECIPE`. `buildOrderState` sets `freeCook: false` for every other path:
`SELECT_RECIPE`, `PLAY_AGAIN`/HOME, `MISSION_*` and the initial state.

The sentinel avoids widening `GameState.recipe` to `Recipe | null`. That type is read by roughly
20 call sites across the reducer and UI, and none of them needs to change behaviour.

### 2.2 OWNED ingredient selection

`IngredientTray` gets a `freeCook` prop. When it is set, the tray lists **every OWNED ingredient in
the active step's category** instead of the recipe subset. The minimal, extensible structure
reuses what exists:

| Concern | How it is handled |
|---|---|
| category | The making-step tabs are the category filter: ソース, チーズ, 具材. |
| volume | Each page holds 6 chips (`MAX_INGREDIENT_PALETTE_SLOTS`), switched with ◀ ▶ page buttons, never scrolled. That avoids the drag/scroll conflict. At full ownership (15 toppings) that is 3 pages. |
| LOCKED / AVAILABLE_TO_BUY | Never listed (the `ownedIngredientIds` filter). The reducer gate rejects them too. |
| quantity = 0 | **The existing EP3 contract is kept.** The chip stays listed, disabled and greyed, with `×0`. It is never hidden, which matches Phase-2 §7 item 5. The reducer rejects placement. |
| stock display | `∞` for starters and `×N` for finite ingredients (unchanged badge). |
| selected state | The unchanged `ingredient-chip--selected` style. |
| touch target | 64 px chips (unchanged). The E2E asserts that chips are at least 44 × 44. |
| one screen | Verified at 390×844 and 360×800 for DOUGH, SAUCE (3 owned), CHEESE (4) and TOPPING pages 1–3. |
| recipe-guided tray | Unchanged (Issue #159 subset). |

This slice deliberately leaves out recent/favourites, search, sub-category chips and a 4×2 grid.
Phase-2 §7 schedules those for P3-4, once more than 16 owned ingredients make them necessary.
Because category plus paging already holds the whole 22-ingredient catalog on one screen, they
were not added here.

### 2.3 Completion → matcher → NEW / KNOWN / ORIGINAL

`src/logic/discovery/freeCook.ts` `resolveFreeCookPizza(pizza, dex)` is pure. It is called once, from
`CONFIRM_BAKE`, and follows Phase-2 X-3:

1. **Recipe-free completion**: at least one item (a sauce or a piece) and the generic bake window.
   The window uses the same ±50% margin as the recipe gate. Failing this gives **FAILED**, the
   existing "失敗" card: an empty pizza is 「材料が入っていません」, and raw or burnt pizzas get
   the existing copy. This is "not a dish", not "original".
2. **Phase 3-1 matcher** against the pre-round Dex.
3. The matched recipe's own Completion Gate (`minCount`s, sauce amount and its own bake window).
   This is the same rule as P3-1's cross-recipe discovery.

| Result | State after CONFIRM_BAKE | REGISTER_TO_DEX |
|---|---|---|
| **MATCHED** (NEW or KNOWN) | `recipe` becomes the matched recipe. The round is scored, gated, stock-consumed and bake-classified **as that recipe**. | The **unchanged** recipe path: Dex (BEST, ★, timesMade), Pitz, Efficiency and Starter Grant. `lastDiscovery` = `NEW_DISCOVERY` or `ALREADY_DISCOVERED`. |
| **ORIGINAL** (no match, ambiguous, or `INCOMPLETE_MATCH`) | `recipe` stays the sentinel. `score` is `null`, `completion` is `PASS`, and stock is consumed. | Goes to `DISCOVERED` with `lastDiscovery` set. **No Dex write and no Pitz.** |
| **FAILED** | `completion` is FAILED and `score` is `null`. | No-op, like every FAILED round. |

**NEW is exactly once.** It comes from the same `phase === "RESULT"` guard as P3-1, and a repeat
`REGISTER_TO_DEX` returns the identical state object. The same pizza on the next round evaluates
against a Dex that already has it, so it is `ALREADY_DISCOVERED`: `justDiscovered` is false, no
new Starter Grant is given, and `timesMade` goes to 2. Normal per-bake Pitz still applies, the same
as a recipe-guided repeat.

**ORIGINAL is not a failure.** The purple 「🎨 オリジナルピザ完成！」 card lists the ingredients
used, shows the bake badge and a line that encourages matching a Dex pizza, and offers the same
two CTAs. A near miss (`INCOMPLETE_MATCH`) says 「図鑑のピザまであと少し…」 **without naming the
recipe**, so it does not spoil it.

### 2.4 Result copy and navigation

| Case | Card |
|---|---|
| NEW | Stars and score, then 「NEW PIZZA! ✨ マルゲリータを発見しました！」. This replaces the default discovery banner, so the message appears once. |
| KNOWN | Stars and score, then 「📖 マルゲリータができた！（発見済み）」, plus NEW BEST! when it applies. |
| ORIGINAL | §2.3 |
| CTAs (free cook) | 「もう一度じゆうに作る」 dispatches `RETRY_SAME_RECIPE`, which starts a new free cook when `freeCook` is set. It never switches to guided mode for the matched recipe. 「レシピを選んで作る」 goes to Pizza Select. Recipe-guided copy is unchanged. |
| HOME | A new full-width 「🎨 フリークッキング」 row sits under the unchanged ピザを作る / ランチラッシュ pair. |
| PREPARE card | 「🎨 フリークッキング」 plus a step hint that names no recipe ingredient. There is no 見本 thumbnail, because there is no target (Phase-2 §3). |

---

## 3. Inventory consistency

- OWNED (permanent) decides what is listed. Stock decides whether a chip is enabled and whether the
  reducer lets it be placed. The two are never mixed.
- Consumption stays in `CONFIRM_BAKE` only (`consumePizzaInventory`), exactly once through the
  BAKE-phase guard. It applies to MATCHED **and** ORIGINAL pizzas, because an ingredient used on
  an original pizza was still used. Unlimited starters are never consumed.
- A 0-stock owned ingredient cannot be placed (`canPlaceIngredient`). This is pinned by both a
  reducer test and an E2E test.

## 4. Regression boundaries

| Flow | Status |
|---|---|
| Recipe-guided (`SELECT_RECIPE`/`RETRY_SAME_RECIPE`) | Unchanged. `freeCook` is false, the tray is still the #159 subset, and the copy is unchanged. Existing unit and E2E suites are green. |
| Lunch Rush | Unchanged. `MISSION_*` gives `freeCook: false`, the round is a Mission round, and `lastDiscovery` is null (tested). |
| Scoring | Scoring 2.0 is untouched. A MATCHED pizza is scored by the same `computeScoringV2(recipe, pizza)` call, with the matched recipe. |
| Bake / cut / result | BAKE, CUT and the RESULT layout are unchanged for guided rounds. The free-cook profile has no CUT step. |
| Economy | The Pitz formula, prices and unlock curve are unchanged. ORIGINAL pays nothing (§6). |

## 5. Verification

| Check | Result |
|---|---|
| Focused: `gameReducer.freeCook.test.ts` (18), `FreeCook.ui.test.tsx` (11) | 29/29 |
| Full unit suite | **2409/2409**. The baseline at `5cf59f9` was 2377. 32 tests are new (3 added by the review fix below), and none was changed or removed. |
| `tsc -b` | clean |
| `oxlint` | clean (exit 0) |
| `npm run build` | OK (only the existing chunk-size warning) |
| Chromium E2E, all specs (`iphone-390x844` and `iphone-360x800`) | **106/106**: 102 existing and 4 new |
| New `e2e/free-cooking-phase3-2.spec.ts` | Scenarios A–F end to end, plus the owned-set paging / one-screen / 0-stock check at both viewports |
| WebKit E2E | Cannot run in this sandbox: the WebKit download is blocked, as in P3-1. The PR's `e2e-webkit.yml` CI job runs every spec, including the new one, on `webkit-390x844` and `webkit-360x800`. That job is the authority. |

Required tests from the task and where each is covered:

| Required | Test |
|---|---|
| Only OWNED ingredients are free-cook candidates | `FreeCook.ui` "offers every OWNED …" and "never lists LOCKED …"; reducer "never places a LOCKED …"; E2E B |
| Not the recipe subset | `FreeCook.ui` "offers every OWNED … not a recipe subset"; reducer "accepts ones no recipe subset would name"; E2E paging (15 toppings) |
| NEW discovery | reducer "NEW: …"; `FreeCook.ui` NEW; E2E C |
| KNOWN recipe | reducer "KNOWN: …"; `FreeCook.ui` KNOWN; E2E D |
| ORIGINAL pizza | reducer "ORIGINAL …", near-miss and superset tests; `FreeCook.ui` ORIGINAL; E2E E |
| NEW exactly once | reducer "NEW is exactly-once" (identical state) and KNOWN (no second event or grant); E2E save check (`timesMade: 2`, 1 discovered) |
| No inventory-consumption regression | reducer inventory block (consumed once, 0-stock rejected, starters unconsumed) and the existing EP2/EP3 suites |
| No Lunch Rush regression | reducer "Lunch Rush … normal Mission round" and the existing Lunch Rush suites and E2E |
| No recipe-guided regression | reducer "SELECT_RECIPE starts a normal recipe-guided round"; `FreeCook.ui` guided tray and CTA copy; existing suites |
| No stale discovery after reset, retry or HOME | reducer retry (every transient field reset) and HOME via `PLAY_AGAIN`; E2E F |

## Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `TETO_P3-2_FreeCooking_HV_390x844.mp4` | 390×844 | 49.8 s | 828 KB | H.264 High, yuv420p, 25 fps | PASS |
| `TETO_P3-2_FreeCooking_HV_360x800.mp4` | 360×800 | 49.9 s | 788 KB | H.264 High, yuv420p, 25 fps | PASS |

Download: both files were delivered directly in the session. They are not committed, because
`artifacts/` is gitignored.

Video Verification: PASS. Both files exist, are non-empty and decode fully (`ffmpeg -f null`). They
record the full viewport at the native size, and each state is held for about 1–2.5 s. A contact
sheet of frames at 6-second intervals was reviewed.

What each video shows, on a fresh save:

1. **A.** HOME, with the new 「🎨 フリークッキング」 row, leads straight to the free-cook PREPARE.
   There is no Pizza Select and no 見本.
2. **B.** Each step's tray shows only the OWNED starter trio. It is then reset.
3. **C.** Tomato, mozzarella ×3 and basil ×2 are baked. The result is 「NEW PIZZA! ✨
   マルゲリータを発見しました！」 with ★ and Pitz.
4. **D.** 「もう一度じゆうに作る」 with the same pizza gives 「📖 マルゲリータができた！（発見済み）」,
   with no discovery banner.
5. **E.** The same pizza without basil gives 「🎨 オリジナルピザ完成！」, which is not 失敗.
6. **F.** 🏠 HOME shows レシピ 1/15, then the Dex (マルゲリータ, 2回), then フリークッキング again,
   which starts on a clean DOUGH step. Finally the recipe-guided Margherita is opened through
   Pizza Select as a regression check.

Screenshots are in `docs/reports/screenshots/progression2-p3-2-free-cooking/`. There is one set
per viewport:

- before, from `main`: `before-1-home`, `before-2-pizza-select-required`,
  `before-3-guided-cheese-tray`;
- after: `after-1-home` through `after-11-guided-margherita-unchanged`;
- heavy-owned tray (19 owned, onion at 0 stock): `after-12-heavy-sauce`,
  `after-13-heavy-topping-page1`, `after-14-heavy-topping-page2-zero-stock`.

Real-viewport review found one layout bug, which was fixed before the final capture. The first
HOME build put three CTAs in one row and wrapped 「ピザを作る」, which is the Issue #47 Finding B
failure mode. フリークッキング now has its own row, and the original pair is byte-identical.

### 5.1 Review fix (PR #197, Codex P2)

A page switch in the tray left a selected chip from the previous page active but hidden. The
next pizza tap then placed an ingredient the player could no longer see, which consumed finite
stock and changed what the pizza matched.

- **Fix.** `IngredientTray.goToPage` now calls the new `onClearSelection` when the target page
  does not contain the selected ingredient. App wires that to `setSelectedIngredientId(null)`.
  Paging while the selection stays visible, or pressing a disabled nav button, keeps it.
- **Unchanged.** The drag-session abort on page change and the guided tray are unchanged.
- **Tests.** `src/App.freeCookTrayPaging.test.tsx` renders the real App and reducer:
  - select finite garlic on page 1, page away, then tap: nothing is placed;
  - the same sequence during a full Margherita bake still gives NEW Margherita, and garlic
    stock stays at 3.
- **Mutation check.** With the clear call disabled, 2 of these 3 tests fail.

## 6. Known limitations and remaining risks

1. **ORIGINAL pays no Pitz.** Phase-2 says original pizzas pay Pitz, but the amount is part of
   the still-open economy decisions (A-05 and the FLOOR reward table, slice P3-3). This slice does
   not invent a number. There is no deadlock today, because guided Margherita remains available.
   P3-3 must add the reward before any zero-recipe onboarding ships.
2. **The generic bake window is shown during BAKE.** A MATCHED pizza is then judged against its
   own recipe window, as P3-1 already does for a cross-recipe match. For recipes whose window sits
   far from 58–78 (marinara 45–65), a pizza baked to the gauge's centre can score lower on bake or
   become an `INCOMPLETE_MATCH`. The pizza's baked tint can also shift slightly between BAKE and
   RESULT for the same reason.
3. **No CUT in free cook.** The default profile has no CUT step, so a free-cooked Margherita skips
   the (standalone, unscored) cut evaluation.
4. **No Teto hint tiers or onboarding.** Near-miss wording is generic. Hint tiers 1–3,
   zero-recipe onboarding and the Lunch Rush lock (Phase-2's own "P3-2" slice) are **not** in
   Issue #194's scope and are not implemented. Owner decisions A-01…A-05 are still open.
5. **The catalog is still the 15 production recipes.** Combinations that are Phase-2 targets
   without a `RecipeId` (aussie, portuguesa, …) read as ORIGINAL until content work adds them.
6. **Tray scale.** Category plus paging covers today's 22 ingredients. Recent/favourites, search
   and sub-categories are P3-4 work for 40+ owned ingredients.
7. **WebKit** was not executed locally. The CI job is the authority.
8. **Recipe-subset tray supersession is scoped to free cook only.** Guided rounds keep Issue
   #159's subset, which is deliberate so that the guided flow does not regress.

## 7. Phase 3-2 completion assessment

All Issue #194 acceptance items are implemented and verified locally. The only exception is the
WebKit run, which is pending on the PR's CI job. The PR is ready for review, with PR CI, the
WebKit job and the Final Merge Gate still to pass.
