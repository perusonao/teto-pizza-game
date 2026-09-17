# Issue #39 — PS1/PS2 Result: HOME Navigation + Functional Pizza Select

- **Base SHA (origin/main):** `6f609f1a9952d6797f94fdaa7b446e3b2ed63a6f`
- **Fresh Audit commit (cherry-picked onto this branch, docs-only):** `e7ab2998737a570bcf2ffc5fa41b76768ba4a640`
  (`docs/reports/TETO_ISSUE-39_PIZZA-SELECT_Fresh-Audit.md`, originally on
  `claude/teto-issue-39-fresh-audit-t3eq3x`, not yet merged to `main`)
- **Implementation SHA:** `fac135046247c0a980a8dcbb7cb9e7f4896a6118`
- **Branch:** `claude/pizza-select-navigation-mhnxgy`
- **Scope:** PS1 (navigation restructure) + PS2 (functional Pizza Select). PS3 (visual
  reproduction) was explicitly not started, per the task's own stop instruction.

---

## 1. Changed files

```
src/App.css                                        (+CSS: .pizza-select-* rules)
src/App.humanFeelFix3.test.tsx                      (route through Pizza Select in test helper)
src/App.test.tsx                                    (rewritten/added Pizza Select navigation tests)
src/App.tsx                                         (PIZZA_SELECT screen wiring)
src/components/DexOverlay.tsx                        (starLabel moved to shared util)
src/data/orders.ts                                  (+findOrderForRecipe)
src/logic/scoring.ts                                (+starLabel, shared)
src/screens/GameScreen.keyboardOverlay.test.tsx      (drop removed onShowMissionIntro prop)
src/screens/GameScreen.keyboardSpreadRepeat.test.tsx (drop removed onShowMissionIntro prop)
src/screens/GameScreen.physicalDragOverlay.test.tsx  (drop removed onShowMissionIntro prop)
src/screens/GameScreen.tsx                          (removed redundant Lunch Rush button)
src/screens/PizzaSelectScreen.tsx                   (new)
src/screens/PizzaSelectScreen.test.tsx              (new)
src/state/gameReducer.ts                            (+SELECT_RECIPE action)
src/state/gameReducer.test.ts                       (+SELECT_RECIPE tests)
src/state/pizzaSelect.ts                            (new: recipeCardState selector)
src/state/pizzaSelect.test.ts                       (new)
docs/reports/TETO_ISSUE-39_PIZZA-SELECT_Fresh-Audit.md  (cherry-picked, docs-only)
docs/reports/TETO_ISSUE-39_PS1-PS2_Result.md        (this file)
```

No changes to: save schema (`persistence.ts`), Scoring 2.0 (`logic/scoringV2/`),
`data/referencePizza.ts`, Dough/Making Game 2.0 mechanics, Pitz reward logic
(`logic/economy.ts`), Inventory/Shop, `mission/lunchRush.ts`'s own order picking, or any
`unlockCondition`/recipe data.

---

## 2. Navigation — before / after

**Before:**
```
HOME "ピザを作る" -> setScreen("GAME") -> GAME/ORDER
  ORDER action-row: [🍕 フリープレイ] [⏱ Lunch Rush]  <- redundant re-choice
HOME "ランチラッシュ" -> setScreen("GAME") + SHOW_INTRO -> Mission Intro overlay
```

**After:**
```
HOME "ピザを作る" -> setScreen("PIZZA_SELECT") -> Pizza Select
  recipe card tap (unlocked only) -> dispatch(SELECT_RECIPE) + setScreen("GAME") -> GAME/ORDER
  ORDER action-row: [🍕 フリープレイ]  <- single CTA, no redundant picker
  back button -> setScreen("HOME")
HOME "ランチラッシュ" -> setScreen("GAME") + SHOW_INTRO -> Mission Intro overlay  (unchanged)
```

`Screen` is now `"HOME" | "PIZZA_SELECT" | "GAME"` (`src/App.tsx`). Pizza Select's back
button does not reuse `handleGoHome`'s confirm/Mission-exit logic — it's a plain
`setScreen("HOME")`, since Pizza Select can never have an in-progress round of its own to
lose (mirrors leaving ORDER/RESULT today).

---

## 3. SELECT_RECIPE contract

```ts
{ type: "SELECT_RECIPE"; recipeId: RecipeId }
```

Reducer case (`src/state/gameReducer.ts`):
- Looks up the recipe (`getRecipe`) and the order (`findOrderForRecipe`, new in
  `src/data/orders.ts` — a direct `ORDERS.find`, since every recipe maps 1:1 to an order
  today).
- Re-checks `isRecipeAvailable(recipe, state.ownedIngredientIds)` itself — if the recipe
  isn't available (or doesn't exist / has no order), returns `state` unchanged. This means a
  locked recipe can never start a round even via a stray/forced dispatch, independent of the
  UI's own disabled-button guard.
- On success, calls the existing `buildOrderState(order, carry, /*isMissionRound*/ false)` —
  the exact same machinery `PLAY_AGAIN` already uses — carrying `dex`/`ownedIngredientIds`/
  `pitzBalance`/`lastClaimedMissionRunId` forward unchanged and resetting pizza/score/
  bakeState/hint/placement/makingStep to a fresh ORDER-phase round for the chosen recipe.

`App.tsx`'s `handleSelectRecipe(recipeId)` dispatches this then `setScreen("GAME")`.

Mission's own order selection (`MISSION_NEXT_ORDER`/`MISSION_RESET_ORDER` ->
`pickMissionOrder`/`getNextOrder`) is completely untouched — `SELECT_RECIPE` is a new,
separate action in the same reducer, sharing only the pre-existing `buildOrderState` helper.
Verified explicitly by a reducer test that dispatches `SELECT_RECIPE` then
`MISSION_RESET_ORDER` and confirms the Mission path still produces a Mission-flagged round.

---

## 4. COMPLETED / NEW / LOCKED derivation

`src/state/pizzaSelect.ts`:

```ts
function recipeCardState(recipe, dex, ownedIngredientIds): RecipeCardState
```

- `LOCKED` when `isRecipeAvailable` (existing, `src/state/progression.ts`) is `false`.
- `COMPLETED` when available AND a discovered Dex entry exists — carries `bestStars`/
  `bestScore` straight from that entry.
- `NEW` when available but no discovered Dex entry exists yet.

Pure derivation from `RECIPES` (static), `state.dex`, and `state.ownedIngredientIds` — no new
persisted field, no separate "seen"/"unlocked" flag. `PizzaSelectScreen` and `DexOverlay` can
never disagree about what's locked, since both ultimately read `isRecipeAvailable`.

**On a fresh save (Starter Set only, empty Dex), this renders exactly:**
- 6 recipes as **NEW**: マルゲリータ, マリナーラ, クアトロ フォルマッジ, ジェノベーゼ,
  **ビスマルク**, フンギ
- 1 recipe as **LOCKED**: フガッサ (needs `onion`, gated on `totalStars >= 12`)

This matches the Fresh Audit's explicit product decision: real progression truth is
rendered as-is, not a fabricated "2 unlocked + 2 locked" 4-card layout.

---

## 5. Bismarck confirmation

Verified directly (unit + integration + manual browser check):
- `recipeCardState` renders Bismarck as `NEW` on a fresh save (unit test,
  `pizzaSelect.test.ts`).
- Selecting Bismarck's card from Pizza Select dispatches `SELECT_RECIPE` with
  `recipeId: "bismarck"`, lands on GAME/ORDER with `state.recipe.id === "bismarck"`, and
  Teto/Mito's ORDER dialogue both name ビスマルク (integration test, `App.test.tsx`, plus a
  manual Chromium check at 390×844 — screenshot confirms the ORDER dialogue and 🍕 フリープレイ
  CTA for Bismarck).
- Bismarck has no `ReferencePizza` fixture (unaffected by this change; Reference/Scoring 2.0
  untouched) — this does not block selecting or making it.

---

## 6. Save / progression compatibility

- `PersistentSaveV1` (`src/state/persistence.ts`) unchanged — no `schemaVersion` bump, no new
  field, no new sanitize path.
- `SELECT_RECIPE` only ever mutates in-memory `GameState` via the existing
  `buildOrderState`/persistence-effect pipeline (same as `PLAY_AGAIN`) — `persistProgress`'s
  effect still only fires on `dex`/`pitzBalance`/`ownedIngredientIds` changes, none of which
  recipe selection touches.
- `persistence.test.ts` (untouched file) still passes unchanged as part of the full suite.

---

## 7. Test results

```
npm test        -> 48 test files, 853 tests, all passed
npm run build   -> tsc -b (typecheck) + vite build, clean
npm run lint    -> oxlint, clean (exit 0)
```

New/updated coverage (mapped to the Fresh Audit's test plan, section J):

| # | Test | Status |
|---|---|---|
| 1 | HOME「ピザを作る」→ Pizza Select | ✅ `App.test.tsx` |
| 2 | HOME「ランチラッシュ」→ Lunch Rush directly (unchanged) | ✅ `App.test.tsx` (pre-existing, still passes) |
| 3 | HOME→Pizza Select never passes through the old redundant picker; GAME's ORDER row has no Lunch Rush button | ✅ `App.test.tsx` |
| 4 | Unlocked recipe → FREE starts with that exact recipe | ✅ `App.test.tsx`, `gameReducer.test.ts` |
| 5 | Bismarck selection → Bismarck order | ✅ `App.test.tsx` (dialogue text), `gameReducer.test.ts` |
| 6 | Locked Fugazza cannot start a round (UI disabled + reducer rejects forced dispatch) | ✅ `App.test.tsx`, `PizzaSelectScreen.test.tsx`, `gameReducer.test.ts` |
| 7 | Unlocked/unplayed → NEW | ✅ `pizzaSelect.test.ts`, `PizzaSelectScreen.test.tsx` |
| 8 | Completed → stars/BEST | ✅ `pizzaSelect.test.ts`, `PizzaSelectScreen.test.tsx` |
| 9 | Pizza Select → HOME back | ✅ `App.test.tsx` |
| 10 | Selected recipeId reflected correctly in state | ✅ `gameReducer.test.ts` (`SELECT_RECIPE` describe block) |
| 11 | Random `getNextOrder` not substituted for Pizza Select's explicit pick | ✅ `gameReducer.test.ts` ("never touches Mission's own random order selection") |
| 12 | Lunch Rush regression | ✅ full suite green, including `lunchRush.test.ts`/`missionScoring.test.ts` |
| 13 | save-v1 unchanged | ✅ `persistence.test.ts` untouched, still passes |
| 14 | Existing making/scoring regression | ✅ full suite green (`gameReducer.test.ts`, `scoring.test.ts`, `onewayFlow.test.ts`, `GameScreen.*.test.tsx`, etc.) |

Two pre-existing test files that clicked HOME's CTA and assumed an immediate GAME/ORDER
landing (`App.test.tsx`'s own suite, `App.humanFeelFix3.test.tsx`) were updated to route
through an explicit Pizza Select card tap first — their own underlying assertions (compact
PREPARE layout, stale-RESULT-not-resurfacing, Pitz/Dex persisted display, etc.) are otherwise
unchanged and still pass.

---

## 8. 390×844 / 360×800 manual verification

Ran the real dev build in headless Chromium (pre-installed at
`/opt/pw-browsers/chromium`) at both viewport sizes, driving the actual DOM (not jsdom):

```
[390x844 HOME]                      scrollWidth=390 clientWidth=390 overflow-x=false
[390x844 PIZZA_SELECT]              scrollWidth=390 clientWidth=390 overflow-x=false
[390x844 GAME(ORDER, bismarck)]     scrollWidth=390 clientWidth=390 overflow-x=false
[360x800 HOME]                      scrollWidth=360 clientWidth=360 overflow-x=false
[360x800 PIZZA_SELECT]              scrollWidth=360 clientWidth=360 overflow-x=false
[360x800 GAME(ORDER, bismarck)]     scrollWidth=360 clientWidth=360 overflow-x=false
```

No horizontal overflow at either width. Pizza Select renders as a 2-column grid (never the
mockup's 4-across), all 7 recipe labels (including the longest, クアトロ フォルマッジ) fit
without truncation or overflow. Screenshots confirmed: title "作るピザを選ぼう！", 🏠 ホーム back
button, 6 NEW cards + 1 locked ？？？ card, and — after tapping Bismarck — GAME's ORDER phase
with Mito/Teto dialogue naming ビスマルク and a single 🍕 フリープレイ CTA (no second Lunch Rush
button).

The temporary Playwright driver script used for this check was not committed (installed
with `--no-save`, run from a scratch path, removed afterward) — `package.json`/
`package-lock.json` are unmodified.

---

## 9. Remaining PS3 work (not started, per task instruction)

- Visual reproduction: wood/parchment/warm-lighting treatment for HOME + Pizza Select
  (currently plain functional cards, reusing `.home-menu__card`'s sizing convention).
- Adding Mito/Blue character art to HOME's hero (currently Teto-only).
- Any further layout iteration the mockup's visual density implies, beyond the
  already-overflow-safe 2-column grid this PS2 pass ships.

PS3 was explicitly not started in this session.

---

## Blockers

None. Locked-card count (1 of 7, Fugazza) and the removal of the in-round secondary Lunch
Rush button were both called out as product decisions in the Fresh Audit and are reflected
here exactly as that audit recommended (render current progression truth as-is; remove the
redundant picker per `docs/PROJECT_HANDOFF.md`'s Navigation contract).
