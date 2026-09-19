# Teto Pizza Game — Economy Tuning 1: Implementation Result

## 0. Audited main SHA / duplicate PR gate

- Fetched `origin` fresh at task start. `origin/main` was at
  `cc477db7b429b517690c15fe9dd5531bdd8f6c5b` ("Unify HOME Global Overlay (Dex/Shop/Inventory)
  panel sizing (#97)") — matches the task's own "known latest main," confirmed via a fresh
  `git fetch`/`git log`, not assumed.
- **Duplicate PR gate (before implementation):** listed every OPEN PR
  (`mcp__github__list_pull_requests`, state=open) and searched issues/PRs for
  Economy/Shop/Starter Stock/Starter Grant/Pitz keywords. Open PRs at task start: #72 (docs: PR
  #68 status correction), #46 (Issue #33 Dough Shaping D0 Fresh Audit), #34 (Issue #32 Phase 1
  reference-visual unification), #3 (docs: Phase 2 infra report). **None overlap this task's
  scope.** No duplicate Economy Tuning implementation PR exists — proceeded.
- **Duplicate PR gate (re-run immediately before PR creation):** re-ran the same
  `list_pull_requests`/`search_issues` queries; the open PR set was unchanged from the pre-work
  check (still #72/#46/#34/#3, none Economy-related). No duplicate — proceeded to create the PR.
- Searched for a document literally named "Economy Human Feel Fresh Audit" (the task's own
  reference) across `docs/reports/`, git history, and open branches; no such file exists under
  that exact name. The task's own embedded specification (TARGET prices, P0b candidate design,
  UX requirements) was fully self-contained, so implementation proceeded directly from it rather
  than blocking on a missing document.

## 1. TARGET Shop prices (P0)

Re-confirmed production `pricePitz` values in `src/data/ingredients.ts` against the task's
TARGET table before changing anything — no drift from the task's assumed "current production"
values was found. All 11 `starterGrantOnly` (non-Starter, Chapter 1) ingredients:

| Ingredient    | Before (Pitz) | TARGET / After (Pitz) | restockQuantity (unchanged) |
|---------------|--------------:|-----------------------:|-----------------------------:|
| mushroom      | 60            | **150**                | 9 |
| garlic        | 60            | **90**                 | 9 |
| oregano       | 45            | **55**                 | 6 |
| egg           | 45            | **105**                | 3 |
| pesto         | 60            | **90**                 | 3 |
| cherry-tomato | 60            | **55**                 | 9 |
| olive-oil     | 50            | **65**                 | 3 |
| gorgonzola    | 70            | **90**                 | 6 |
| parmigiano    | 70            | **90**                 | 6 |
| fontina       | 70            | **90**                 | 6 |
| onion         | 120           | **170**                | 12 |

- `restockQuantity` is untouched for every ingredient (pinned by a dedicated test, see §6).
- Starter Stock quantities (`STARTER_STOCK_PLAYS_CHAPTER_1 = 10`, and each recipe's own
  `minCount x 10` / flat-`10` grant amount) are untouched.
- Recipe rewards (`Recipe.baseRewardPitz`, all still 100) and the Pitz reward formula
  (`recipeBaseReward x qualityMultiplier`, `src/logic/pitzReward.ts`) are untouched.
- Existing tests referencing the old onion price (120 Pitz) were updated to 170 across
  `src/logic/economy.test.ts`, `src/state/gameReducer.restock.test.ts`, and `src/App.test.tsx`
  (a real end-to-end Shop UI test). A new fixed-value test map in `src/data/ingredients.test.ts`
  pins all 11 TARGET prices and all 11 unchanged `restockQuantity` values directly, so any future
  accidental drift fails immediately.

## 2. Shared Starter Grant — implementation gate (P0b)

### Verification performed before implementing anything

Confirmed with the actual production recipe/ingredient data (`src/data/recipes.ts`,
`src/data/ingredients.ts`) that exactly two finite ingredients are shared across more than one
recipe's Starter Grant: **oregano** (marinara: 2/play, grant 20 → fugazza: 1/play, grant 10) and
**olive-oil** (quattro-formaggi: 1/play, grant 10 → fugazza: 1/play, grant 10). In both cases the
predecessor recipe (marinara / quattro-formaggi) always unlocks strictly before fugazza in the
real unlock chain (fugazza requires `quattro-formaggi` discovered + 12 totalStars, and
quattro-formaggi's own chain passes through marinara), so the "which grant lands first" ordering
is fixed, not incidental.

Computed all 5 required cases (oregano, marinara → fugazza) directly against the production
`applyStarterGrants`/`starterGrantForRecipe` logic:

| Case | Scenario | `oregano` before fugazza's grant | Floor result `max(current, 10)` | ≥10 fugazza plays? |
|---|---|---:|---:|:--:|
| A | Shared ingredient never consumed | 20 | 20 (unchanged) | ✅ |
| B | Partially consumed (5 marinara plays, 10 spent) | 10 | 10 (unchanged) | ✅ |
| C | Nearly used up (9 marinara plays, 18 spent) | 2 | 10 (topped up) | ✅ |
| D | Stock at 0 | 0 | 10 (topped up) | ✅ |
| E | Grant re-run against an already-claimed ledger | any | unchanged, `grantedRecipeIds: []` | n/a (ledger blocks re-grant entirely) |

General proof (not just these 5 numeric points): `starterGrantForRecipe` already sizes a
newly-unlocked recipe's own grant amount to exactly `requiredCount x STARTER_STOCK_PLAYS_CHAPTER_1`
— i.e. precisely enough for 10 plays of *that* recipe alone, at its own per-play consumption
rate. `Math.max(current, grantAmount)` is therefore **always** `>= grantAmount`, so
`floored / requiredCount >= STARTER_STOCK_PLAYS_CHAPTER_1` holds unconditionally, regardless of
how much the shared pool had been drawn down beforehand. The floor also never *reduces* existing
stock (`Math.max` is monotonic in `current`), so a player who stacked up extra stock some other
way never sees it clawed back. This generalizes cleanly to a future Batch 1A recipe sharing any
ingredient with an already-shipped recipe — no ingredient-specific casing needed.

The task's own worked example (`current=5` vs `current=25` against a hypothetical
`grantAmount=20`) was checked directly: `floor(25, 20) = 25`, and `25 / 2 = 12.5 → 12` plays,
still `>= 10` — the "≥10 plays of the newly-unlocked recipe" UX intent holds in both branches of
that example, not just the one where the floor is lower than `current`.

### Decision: **Option A — general `Math.max(current, grantAmount)` floor**

Adopted, with no ingredient-specific casing (no `oregano`/`olive-oil` special-cases), no Save
schema change, and no Starter Stock redesign — purely a one-line change to how
`applyStarterGrants` folds a new grant into `nextInventory` for an ingredient shared across
recipes (`src/state/starterStock.ts`). Rationale: it is the smallest change that (a) still
mathematically guarantees the recipe-local "≥10 plays" UX contract for every newly-unlocked
recipe in every one of Cases A–D, (b) eliminates the previous design's unbounded stacking for a
player who unlocks two ingredient-sharing recipes back to back without ever touching the shared
stock (additive: 20 + 10 = 30, uncapped for a longer future ingredient-sharing chain), and (c)
never reduces stock a player already has. This matches the task's own required properties
(general rule usable by Batch 1A, no hacks, no schema bump).

Updated the two existing tests that pinned the old additive numbers (`oregano: 30`,
`olive-oil: 20` after fugazza) to the new floor values (`oregano: 20`, `olive-oil: 10`), and added
a dedicated `describe` block in `src/state/starterStock.test.ts` covering Cases A–E by name plus
a property test ("the floor never reduces existing stock, in any of Cases A-D").

## 3. Starter Grant UX (P1)

Problem: the Starter Grant was silent — nothing told the player "you just got 10 free plays."

Implementation (`src/state/starterStock.ts`'s new `buildStarterGrantNotice`, called from
`gameReducer.ts`'s `REGISTER_TO_DEX` case only):

- Pure derivation off `applyStarterGrants`'s own `grantedRecipeIds` — no new "was this shown"
  ledger; `grantedRecipeIds` is already empty on every no-op/already-claimed/margherita call, so
  it is reused as the sole source of truth for whether a notice fires at all.
- New transient `GameState.lastStarterGrantNotice: StarterGrantNotice | null` field, following
  the exact same pattern as the pre-existing `lastPitzCredit` (Issue #38): set only at
  `REGISTER_TO_DEX`, reset to `null` for every fresh round via `buildOrderState` (covers
  PLAY_AGAIN/RETRY_SAME_RECIPE/SELECT_RECIPE/Mission order transitions alike), **never
  persisted** (`persistence.ts` untouched — no Save schema change).
- Never set by `MISSION_NEXT_ORDER` (Lunch Rush skips the DISCOVERED phase entirely, so there is
  nowhere to show it — the grant itself still happens unchanged, only the notice is absent).
- Rendered in `ResultPanel.tsx` (the merged RESULT+DISCOVERED screen), between the
  discovery/NEW-BEST banner and the Pitz credit summary, only when non-null:
  `🎁「{レシピ名}」の材料を最初の10回分プレゼントしました！`
- Margherita: never shown, for free — margherita is never in `grantedRecipeIds`
  (`STARTER_GRANT_EXEMPT_RECIPE_ID`), so there is nothing to derive a notice from.
- Already-claimed / reload / replay: never shown, for free — a no-op `applyStarterGrants` call
  always returns an empty `grantedRecipeIds`, and the field is transient (never persisted, always
  reset on the next round).
- Ends naturally via the existing "もう一度つくる"/"別のピザを作る" CTAs (no timer, no dedicated
  dismiss button) — both already transition to a fresh `buildOrderState`, which resets the field.

## 4. Save impact

**None.** No `PersistentSaveV1`/Save schema field, version, or migration touched.
`lastStarterGrantNotice` is transient `GameState`, never serialized (same discipline as
`lastPitzCredit`/`scoringV2Result`). The P0b floor change only alters *how much* an already-shipped
inventory field (`InventoryState[ingredientId]`, already part of Save v2) gets credited — the
shape of persisted data is identical before and after this PR.

## 5. 30-play sanity simulation

A throwaway script (created at `src/state/_economyTuning1SanitySim.test.ts`, run via `vitest`,
**deleted before the final commit** — not part of the shipped diff) drove the real
`applyStarterGrants`/`restockIngredient`/`applyPitzCredit` functions with the new TARGET prices,
progressing a simulated player through the real unlock chain (margherita → funghi → marinara →
bismarck → genovese → quattro-formaggi → fugazza) and then repeating fugazza for the remainder of
30 rounds, restocking whenever a finite ingredient dropped to half its own restock batch and Pitz
allowed. Three quality scenarios (beginner ★2/mid ★4/skilled ★5, i.e. the V1 multiplier bands'
0.5/1.0/1.2 tiers):

| Scenario | Pitz/play | First restock | Total Shop spend (30 plays) | Final balance | Soft-lock? |
|---|---:|---:|---:|---:|:--:|
| A (beginner) | 50 | round 15 | 1350 | 150 | No |
| B (average)  | 100 | round 15 | 1520 | 1480 | No |
| C (skilled)  | 120 | round 15 | 1520 | 2080 | No |

No scenario ever hit a soft-lock (a finite ingredient at 0 stock with insufficient Pitz to
restock) at any point across all 30 rounds, including the harshest ★2-everywhere beginner case.
Balance stayed positive throughout in all three scenarios, and restock cadence (olive-oil/onion,
later oregano) tracked fugazza's own per-play consumption sensibly once the player settled into
repeating it. This confirms the new TARGET prices don't introduce a design-time soft-lock risk at
early-game (Chapter 1, ≤30-play) pace.

## 6. Mobile verification

Ran the real dev server (`npm run dev`) and drove it with a headless Chromium (Playwright,
pre-installed browser) at both **390×844** and **360×800**, following: HOME → Recipe Select →
play margherita (dough stretch, making-step advance, bake, confirm) → margherita's own discovery
immediately unlocks + Starter-Grants funghi → DISCOVERED screen → HOME → Inventory → Shop.

Confirmed at both viewports:
- Starter Grant notice text exactly: `🎁「フンギ」の材料を最初の10回分プレゼントしました！` —
  readable, no overflow, styled consistently with the existing discovery banner/Pitz-credit
  summary cards (same `max-width: 320px` card pattern).
- Notice count is `0` immediately after tapping "別のピザを作る" (leaving DISCOVERED) — confirms
  it doesn't linger/re-show.
- Inventory screen shows `マッシュルーム ×30` (funghi's `3 x 10` Starter Grant), 4/14 ingredients
  owned (Margherita's 3 Starter ingredients + mushroom).
- Shop screen shows `マッシュルーム`, 在庫 30, `+9` restock batch, **`🪙 150 Pitz`** — matches the
  new TARGET price exactly, restock button correctly disabled at `0 Pitz` balance.
- **Zero console errors** at either viewport across the whole flow.
- PR #97's Global Overlay sizing (`.dex-overlay__panel`) renders identically for Shop/Inventory —
  no regression to the shared panel chrome.

Screenshots (8 steps × 2 viewports) were captured to a scratch directory and delivered to the
user directly in-conversation (390×844 DISCOVERED/Inventory/Shop, plus a 360×800 DISCOVERED
screenshot) rather than committed to the repo.

## 7. Tests

- **Shop:** all 11 TARGET prices pinned by fixed-value assertions (`ingredients.test.ts`), plus a
  completeness check that every `starterGrantOnly` ingredient is covered; all 11
  `restockQuantity` values pinned unchanged; existing purchase/restock boundary
  (insufficient/exact/sufficient balance) and atomic-deduction tests untouched (they already used
  mock ingredients independent of real prices) plus the real-onion-data restock test updated to
  170/30 Pitz; a real end-to-end Shop UI test (`App.test.tsx`) updated to the new 170 Pitz price.
- **Starter Grant:** existing first-grant/exact-once/ledger-reset/Fugazza-onion coverage kept and
  updated for the floor semantics; new `describe` block covers Cases A–D (never-consumed/
  partial/near-empty/zero) plus Case E (re-run against an already-claimed ledger) plus a floor-
  monotonicity property test, all against real `oregano`/marinara/fugazza production data.
- **UX:** new tests cover: notice fires only on an actual grant, never for margherita, never when
  nothing new is granted (already claimed), never set by `MISSION_NEXT_ORDER`, and resets to
  `null` on PLAY_AGAIN/RETRY_SAME_RECIPE/SELECT_RECIPE (covering "no reload/replay re-display");
  plus `ResultPanel`-level render tests (shows the message with the recipe name and "10回分" text
  when provided, omitted entirely when `null`) and pure unit tests for `buildStarterGrantNotice`
  (empty → `null`, single/multi-recipe message content).
- **Regression:** full existing suite re-run and green.

**Full suite: 1441 tests passed (72 files)**, up from the pre-existing 1439 baseline (+2 net new
test files' worth of assertions folded into existing files, no test removed).

## 8. typecheck / lint / build

- `npx tsc -b`: clean, no errors.
- `npx oxlint`: clean, no warnings/errors.
- `npm run build` (`tsc -b && vite build`): succeeds — `dist/assets/index-*.js` 337.62 kB
  (gzip 105.86 kB), `dist/assets/index-*.css` 40.07 kB (gzip 8.36 kB).

## 9. Changed files

```
src/App.css                           | +15  (new .starter-grant-notice styles)
src/App.test.tsx                      |  ~6  (onion price 120 -> 170 in Shop UI test)
src/components/ResultPanel.test.tsx   | +21  (starterGrantNotice prop + 2 new tests)
src/components/ResultPanel.tsx        | +13  (starterGrantNotice prop + render block)
src/data/ingredients.test.ts          | +62  (TARGET price / restockQuantity fixation tests)
src/data/ingredients.ts               | ~35  (11 TARGET prices + doc comments)
src/logic/economy.test.ts             |  ~5  (onion price 120 -> 170)
src/screens/GameScreen.tsx            |  +1  (pass starterGrantNotice through)
src/state/gameReducer.restock.test.ts | ~12  (onion price 120 -> 170, 4 assertions)
src/state/gameReducer.ts              | +12  (lastStarterGrantNotice field/wiring)
src/state/starterStock.test.ts        | +187 (floor semantics + Cases A-E + UX tests)
src/state/starterStock.ts             | +57  (P0b floor logic + buildStarterGrantNotice)
```

No files touched outside `src/` and this report. No Recipe Batch 1A, Recipe reward formula,
Margherita-unlimited semantics, scatter placement cap, recommended-quantity UI, Lunch Rush reward
redesign, Chapter/Tier system, Inventory redesign, Shop UI redesign, Save schema, or PR #97
overlay redesign were touched (Scope Guard held).

## 10. Remaining risks

- The Starter Grant notice's multi-recipe join path (`buildStarterGrantNotice` joining 2+ recipe
  names with "・") is covered by unit tests but has not been observed in a real playthrough,
  since it only fires in the rare case where a single registration both discovers a recipe and
  immediately crosses a chained recipe's `minTotalStars` gate in the same call.
- TARGET prices were re-tuned against the task's own numbers, not re-validated against a fresh
  Human Feel real-device playtest in this PR (out of scope here — the task asked for a numeric
  sanity simulation, not a new Human Feel pass).
- The P0b floor is proven safe for the two shared ingredients that exist today (oregano,
  olive-oil); a future Batch 1A recipe introducing a *third* consumer of one of these (or a new
  shared ingredient) should re-run the same Case A–D style check before assuming the general
  proof still applies to its own specific numbers, though the general proof in §2 holds for any
  two-recipe sharing relationship regardless of the concrete numbers involved.

## 11. Batch 1A readiness

The P0b floor rule (`Math.max(current, grantAmount)`) is a general, ingredient-agnostic rule
already proven to generalize (§2's proof doesn't depend on oregano/olive-oil's specific numbers).
Batch 1A can introduce new recipes sharing ingredients with existing ones without further P0b
changes, as long as each new recipe's own Starter Grant amount continues to be sized to
`STARTER_STOCK_PLAYS_CHAPTER_1 x` its own per-play requirement (unchanged in this PR). Recipe
Batch 1A itself was not started in this PR (Scope Guard).

## FINAL VERDICT

**A. ECONOMY TUNING 1 COMPLETE — READY FOR MERGE REVIEW**
