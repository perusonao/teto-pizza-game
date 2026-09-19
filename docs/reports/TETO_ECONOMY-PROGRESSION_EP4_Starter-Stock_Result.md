# Teto Pizza Game — Economy & Progression 1.0 EP4: Starter Stock / Exactly-Once Grant (Result)

**Scope: EP4 only — the free starter-stock grant on recipe unlock, its exactly-once ledger, and
the v2→v3 save migration it requires.** Recipe Unlock conditions (EP1), CONFIRM_BAKE consumption
(EP2), Shop restock/Stock Gate (EP3), Pitz reward formula, RESULT UI, Ingredient Tray/Making Step
redesign, Recipe Select redesign, Achievement Reset UI (#89), and any new recipe/ingredient
content were **not** touched, per instruction.

---

## 1. Audited `main` SHA

`f2a455f7a6428c52db6ee321590a5504e8d18f2e` — "UX-1: Lunch Rush continuous per-pizza progression
(#85) (#91)". Confirmed fresh via `git fetch origin` at session start; matches the task's own
reference SHA exactly, no drift. Branch `claude/ep4-starter-stock-grant-f7djvg` was created fresh
from this commit (0 commits ahead of `origin/main` at session start).

Read directly before any code change: `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`,
`docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md`,
`docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md`,
`docs/reports/TETO_INGREDIENT-ECONOMY-UI-SCALABILITY_Fresh-Audit.md`,
`docs/reports/TETO_ECONOMY-PROGRESSION_EP1_Recipe-Unlock_Result.md`,
`docs/reports/TETO_ECONOMY-PROGRESSION_EP3_Shop-Restock_Result.md`,
`docs/reports/TETO_INVENTORY-E1_Implementation-Result.md`,
`docs/reports/TETO_INVENTORY-E2_Consumption_Implementation-Result.md`, plus the full production
source: `src/data/recipes.ts`, `src/data/ingredients.ts`, `src/state/progression.ts`,
`src/state/inventory.ts`, `src/state/dex.ts`, `src/state/gameReducer.ts`,
`src/state/persistence.ts`, `src/logic/economy.ts`, `src/components/ShopOverlay.tsx`,
`src/App.tsx`.

---

## 2. Architecture

Three new pieces, each additive to already-shipped EP1/EP2/EP3 machinery, none of which was
modified beyond what wiring the new pieces in requires:

1. **`src/data/economyConfig.ts`** (new) — the single named constant
   `STARTER_STOCK_PLAYS_CHAPTER_1 = 10`.
2. **`src/state/starterGrant.ts`** (new) — the pure starter-grant transaction:
   `applyStarterGrantsOnDexChange(prevDex, nextDex, carry)`, where `carry` bundles
   `ownedIngredientIds` / `inventory` / `starterGrantClaimedRecipeIds` (the permanent ledger) and
   is returned as one atomic next value. Internally folds `grantStarterStockFor(recipe, carry)`
   over every recipe that newly crosses `recipeUnlocked` false→true between the two Dex
   snapshots (EP1's own `recipeUnlocked`, `src/state/progression.ts`, untouched).
3. **`src/data/ingredients.ts`** — 10 ingredients (`mushroom`/`garlic`/`oregano`/`egg`/`pesto`/
   `cherry-tomato`/`olive-oil`/`gorgonzola`/`parmigiano`/`fontina`) gain `unlockCondition`/
   `pricePitz`/`restockQuantity` for the first time (previously only `onion` had them).
   `STARTER_INGREDIENT_IDS` shrinks from 13 to exactly 3 (`tomato-sauce`/`mozzarella`/`basil`,
   margherita's own ingredients) — this is the MATRIX's own already-flagged, intended
   consequence, not a side effect.

**Trigger point**: the grant is applied inside the reducer, at the two places `dex` itself
changes — `REGISTER_TO_DEX` (FREE) and `MISSION_NEXT_ORDER` (Lunch Rush) in
`src/state/gameReducer.ts` — immediately after `registerScoreToDex` computes the round's new
`dex`, using the round's own before/after `dex` pair as `prevDex`/`nextDex`. This is the "reducer
transaction, not a UI `useEffect`" boundary the task asked for: no component ever computes or
dispatches the grant, and it is atomic with the same state transition that also updates
`justDiscovered`/`pitzBalance`/`phase`.

`purchaseIngredient`/`restockIngredient` (EP3, `src/logic/economy.ts`) were **not modified** —
the starter grant is a third, structurally separate transaction (recipe-triggered, never
Pitz-gated, can credit several ingredients at once), reusing the same "one file, one clear
transaction" discipline EP3 already established between purchase and restock.

---

## 3. Grant trigger

`REGISTER_TO_DEX` and `MISSION_NEXT_ORDER` both now:

```ts
const { dex, wasNewDiscovery, isNewBest } = registerScoreToDex(state.dex, state.recipe.id, state.score);
const starterGrant = applyStarterGrantsOnDexChange(state.dex, dex, {
  ownedIngredientIds: state.ownedIngredientIds,
  inventory: state.inventory,
  starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
});
return { ...state, dex, ownedIngredientIds: starterGrant.ownedIngredientIds,
         inventory: starterGrant.inventory,
         starterGrantClaimedRecipeIds: starterGrant.starterGrantClaimedRecipeIds, ... };
```

No new `GameAction` was added — the grant is an implicit, atomic side effect of the one dispatch
that already changes `dex`, never a separate action a UI component could omit, double-fire, or
race.

---

## 4. `starterStockPlays`

`STARTER_STOCK_PLAYS_CHAPTER_1 = 10` (`src/data/economyConfig.ts`) — a single named constant,
read only by `src/state/starterGrant.ts`. Never inlined as a literal `10` at any call site, per
the Fresh Design's own explicit requirement (§4.3).

---

## 5. Quantity derivation

For every required ingredient of a newly-crossed recipe that has `unlockCondition` (i.e. is
finite, not one of margherita's 3 permanent Starter ingredients):

- **scatter** (cheese/topping): `minCount × 10`.
- **spread/sauce**: `10` uses flat (never multiplied by `minCount`, which is always 1 for a
  sauce anyway — this matches the already-ratified inventory unit model, EP1/EP2/EP3
  unchanged).

No per-recipe magic numbers exist anywhere in the diff — every quantity is computed from the
recipe's own already-authored `requiredIngredients` data at grant time.

---

## 6. Finite ingredient coverage (EP4b)

Per the Ingredient Economy Fresh Audit's own slice recommendation (#1 mechanism, #2 "EP4b: give
the other 10 ingredients real data"), this session did **both** in one PR, since the task
explicitly requires all of #2–#7 to grant on unlock: `mushroom`, `garlic`, `oregano`, `egg`,
`pesto`, `cherry-tomato`, `olive-oil`, `gorgonzola`, `parmigiano`, `fontina` all gained
`unlockCondition`/`pricePitz`/`restockQuantity`, values taken verbatim from
`TETO_ECONOMY-PROGRESSION-1_MATRIX.md` §2's already-decided restock table (unchanged by this
session — EP3's restock mechanism required no code change to pick these up, exactly as that
audit predicted).

`unlockCondition.minTotalStars` for these 10 (a genuine, undocumented-by-any-SSOT gap — see §22
"Unresolved issues"): set to `0` for every chain-only-gated recipe's ingredient
(mushroom/garlic/oregano/egg/pesto/cherry-tomato) and to `8` for quattro-formaggi's four
(olive-oil/gorgonzola/parmigiano/fontina, mirroring that recipe's own `minTotalStars: 8` gate).
`onion` keeps its already-shipped `12`, unchanged. This value only matters for the (normally
moot, since the starter grant auto-owns the ingredient first) direct-Shop-purchase path the same
field also gates — see §22.

---

## 7. Margherita behavior

Margherita has no `unlockCondition` and is therefore **never** evaluated by
`grantStarterStockFor` at all (the function's first guard returns `carry` unchanged for any
recipe without one) — it can never appear in `starterGrantClaimedRecipeIds`, by construction, not
by a special case. Its own 3 ingredients (`tomato-sauce`/`mozzarella`/`basil`) remain
`STARTER_INGREDIENT_IDS`, permanently, unconditionally unlimited (`hasStock` returns `true`
unconditionally for any ingredient with no `unlockCondition` — unchanged since Phase 3C).
Verified live (§18) and by dedicated regression tests (§20).

---

## 8. #2–#7 behavior

Verified exactly per `TETO_ECONOMY-PROGRESSION-1_MATRIX.md` §1, both in pure unit tests
(`starterGrant.test.ts`) and live in the browser (§18):

| # | Recipe | Grants on unlock |
|---|---|---|
| 2 | funghi | mushroom ×30 |
| 3 | marinara | garlic ×30, oregano ×20 |
| 4 | bismarck | egg ×10 |
| 5 | genovese | pesto ×10 uses, cherry-tomato ×30 |
| 6 | quattro-formaggi | olive-oil ×10 uses, gorgonzola ×20, parmigiano ×20, fontina ×20 |
| 7 | fugazza | onion ×40 (+ additive top-ups to oregano/olive-oil, see §9) |

One subtlety confirmed by both unit tests and the live walkthrough: because each recipe's
`unlockCondition` chains to the **previous** recipe's own discovery (EP1), a recipe's starter
grant fires the instant the *previous* recipe is discovered — e.g. funghi's mushroom grant lands
during margherita's own `REGISTER_TO_DEX`, not funghi's. This is exactly the SSOT's own
"the instant X is completed" wording, not a bug.

---

## 9. Fugazza / Onion behavior

`fugazza` grants `onion ×40` (its own `minCount: 4 × 10`) — no exception versus any other
recipe, exactly as the Fresh Design's §4 product decision requires ("the previous design's
'real 120-Pitz purchase required' exception is removed"). Verified live via a seeded pre-EP4 v2
save (§18): after migration, Shop shows `たまねぎ 在庫 40 / +12 補充する (120 Pitz)` — the 40-unit
starter grant and the 12-unit/120-Pitz restock pack rendering as two structurally and visually
distinct numbers on the same row, confirming the task's explicit "Starter +40 と Shop +12 が意図的
に別単位であること" requirement holds in the running app, not just in code comments.

---

## 10. Shared ingredient behavior

`oregano` (marinara ×2 → 20, fugazza ×1 → +10) and `olive-oil` (quattro-formaggi ×1 use → 10,
fugazza ×1 use → +10) both land at their correctly-summed additive totals (30 and 20
respectively) — confirmed by:
- Pure unit tests (`starterGrant.test.ts`'s "Additive shared ingredients" describe block,
  including a case that pre-seeds a *partially consumed* oregano stock to prove the top-up lands
  on top of whatever's left, never resetting to the original grant amount).
- The live pre-EP4-migration walkthrough (§18): Shop shows `オレガノ 在庫 30`, `オリーブオイル 在庫
  20`, matching the two-recipe-sum exactly.

Each contributing recipe gets its **own** ledger entry (`"marinara"` and `"fugazza"` both appear
in `starterGrantClaimedRecipeIds`) — never one shared "oregano granted" flag — so each recipe's
own exactly-once guarantee is independent of the other's, per the Ingredient Economy Fresh
Audit's own §4.3 recommendation (confirmed, not re-litigated).

---

## 11. Exactly-once mechanism

A permanent, persisted ledger (`starterGrantClaimedRecipeIds: readonly string[]`) is the sole
source of truth for "has this recipe's grant already fired" — **not** derived from
`recipeUnlocked`'s current boolean, and **not** derived from `ownedIngredientIds` alone (both
were explicitly flagged by the task as insufficient, and confirmed insufficient here too: an
ingredient can be owned via a real EP3 Shop purchase completely independent of whether its
introducing recipe's grant has ever fired, and a future Achievement Reset rewinding `dex` would
make `recipeUnlocked` lie about history).

`grantStarterStockFor`'s guard order:
1. `!recipe.unlockCondition` → no-op (margherita).
2. `carry.starterGrantClaimedRecipeIds.includes(recipe.id)` → no-op, checked **before** touching
   `ownedIngredientIds`/`inventory` at all.

This makes every one of the task's required duplicate-prevention scenarios hold structurally,
not by convention:

| Scenario | Why it can't double-grant |
|---|---|
| reload / save-load | `starterGrantClaimedRecipeIds` is itself persisted (Save v3) and re-hydrated into `GameState` on every load — no in-memory-only state exists for it. |
| HOME / Dex / Shop open-close | None of these dispatch any `GameAction` at all (they are local React screen/overlay state in `App.tsx`) — `GameState` is provably untouched by them. |
| RETRY_SAME_RECIPE / PLAY_AGAIN / SELECT_RECIPE | None of these three actions ever call `registerScoreToDex` or touch `dex` — the grant trigger (§3) is unreachable from any of them. |
| FREE ↔ Lunch Rush | Both trigger points (`REGISTER_TO_DEX`, `MISSION_NEXT_ORDER`) write into the **same** `starterGrantClaimedRecipeIds` field on the **same** `GameState` — there is no separate FREE-ledger vs. Mission-ledger to fall out of sync. |
| Recipe re-lock/re-unlock, Achievement Reset (#89) | The ledger is never cleared by `recipeUnlocked` going false→true→false→true again — only `clearSave` (a full save wipe, never wired to any in-game action) can remove an entry. |

Verified by 17 dedicated reducer-integration tests (`gameReducer.starterGrant.test.ts`) plus 20
pure-function tests (`starterGrant.test.ts`), including an explicit Achievement Reset simulation
(§13) and a live double-tap-equivalent replay in the browser (§18: funghi discovered twice,
second bake leaves `garlic`/`oregano` unchanged).

---

## 12. Persistent ledger

`starterGrantClaimedRecipeIds: readonly string[]` lives on `GameState` (`src/state/gameReducer.ts`)
and `PersistentSaveV3.starterGrantClaimedRecipeIds: string[]` (`src/state/persistence.ts`).
Sanitized on every load (`sanitizeStarterGrantClaimedRecipeIds`: unknown-recipe-id and duplicate
entries dropped, matching every other sanitizer's per-entry-tolerant style). Written by
`persistProgress`'s existing read-modify-write path (`App.tsx`'s persistence `useEffect` now also
depends on `state.starterGrantClaimedRecipeIds`), never a separate write path.

---

## 13. Save/schema decision

**Schema bump: v2 → v3.** `PersistentSaveV3` adds exactly one field
(`starterGrantClaimedRecipeIds: string[]`) to `PersistentSaveV2`'s shape, unchanged otherwise.
This was necessary (not merely convenient) because the ledger's entire purpose — surviving a
Dex rewind — cannot be satisfied by any already-existing field: `dex` itself is exactly what a
future Achievement Reset would rewind, and `ownedIngredientIds`/`inventory` can't distinguish "an
EP3 Shop purchase" from "an EP4 starter grant."

---

## 14. Migration (v2→v3)

`migrateV2toV3` (`src/state/persistence.ts`), reusing `applyStarterGrantsOnDexChange` with the
"as-if crossing from `EMPTY_DEX`" trick (`prevDex = EMPTY_DEX`, `nextDex = <existing save's real
Dex>`):

- **Every recipe already unlocked** under the existing save's `dex` (i.e. `recipeUnlocked(recipe,
  existingDex)` is already `true`) is treated exactly as if its grant had fired the instant it
  unlocked: claimed in the ledger (so it can never re-grant, including after a future Achievement
  Reset) **and** its full starter-grant quantity is additively credited into `inventory` — an
  existing player who already unlocked, say, genovese pre-EP4 ends up with the *same* generous
  stock a brand-new player unlocking it today would get, not stranded at 0 for an ingredient
  (pesto/cherry-tomato) that used to be unconditionally unlimited (Starter) and has never been
  finite before this migration.
- **A recipe not yet unlocked** is left unclaimed — it receives its real, live starter grant the
  first time it naturally unlocks during play, identically to a brand-new player.
- `ownedIngredientIds` is **never stripped**: a pre-EP4 save's now-finite ingredient ids that
  happen to belong to a not-yet-unlocked recipe are left in place rather than removed, so no
  existing capability is ever visibly taken away (the "safe side" choice required when this genuine
  ambiguity has no single obviously-correct answer — see §22 for the one narrow, cosmetic
  follow-up this leaves).
- `onion`'s pre-existing real inventory/ownership (an actual EP3 purchase/restock) is preserved
  and only ever additively topped up, never overwritten or reset — confirmed by a dedicated test
  seeding `{ onion: 8 }` pre-migration and asserting `48` post-migration (8 existing + 40 grant).

`toIntermediateSave` (renamed from `toIntermediateV2`) now chains v1→v2→v3 and v2→v3 uniformly;
schemaVersion 3 passes through unchanged; any other value still falls back to a fresh default
save, unchanged from the pre-existing "unrecognized schema" contract.

**One documented, deliberate lazy-write property (pre-existing since Save v2, re-confirmed live,
not an EP4 regression)**: `loadSave` is read-only — it never writes the migrated shape back to
`localStorage` itself (this was already the accepted contract for v1→v2, per that migration's own
"raw v1 JSON in storage is untouched by either read" test). A player who loads a pre-EP4 save and
takes no further action will keep seeing the *correct* migrated in-memory state on every load
(the migration is pure and deterministic, so re-deriving it is always safe and always identical),
but the on-disk file itself only becomes v3-shaped once some other real change (a purchase, a
new discovery, a restock) triggers `persistProgress`'s own write. Confirmed live (§18): the
in-memory/rendered state (Shop, Pizza Select) reflected the full migration correctly and
immediately, while the raw file only updated schemaVersion after a subsequent write — exactly
mirroring the pre-existing v1→v2 precedent, not a new gap this session introduced.

---

## 15. Achievement Reset (#89) compatibility

Not implemented this session (out of scope, confirmed). The invariant the task requires — "a
future reset that clears Dex/Mastery must never be able to re-trigger a grant" — is guaranteed
structurally today because:

1. `starterGrantClaimedRecipeIds` lives in a **separate** persisted field from `dex`, and nothing
   in this session's diff ever clears it from anywhere but `clearSave` (a full wipe).
2. `grantStarterStockFor`'s ledger check is independent of `recipeUnlocked`'s current value — it
   only ever asks "is this recipe id already in the list," never "is it currently unlocked."

A dedicated unit test (`starterGrant.test.ts`, "Achievement Reset simulation (#89 compatibility...)")
pins this explicitly: a ledger already containing `"funghi"`, replayed against `dex` reset to
`EMPTY_DEX` and then re-discovering margherita (re-crossing funghi false→true→false→true), yields
`result === claimedLedgerSurvivingReset` (reference-stable no-op) and `inventory.mushroom` stays
`30`, never doubling to `60`. When #89 is eventually implemented, its own reset logic must simply
never touch this field — no code in this diff needs to change for that to hold.

---

## 16. EP2 consumption regression

`consumePizzaInventory` (`src/state/inventory.ts`) — **0 lines changed**. `CONFIRM_BAKE` still
consumes finite ingredients by placed-piece-count/1-per-sauce-id, clamped to 0, exactly as EP2
shipped it. Verified: the starter grant never fires from `CONFIRM_BAKE` itself (a dedicated test
asserts `starterGrantClaimedRecipeIds` stays `[]` through a full PREPARE→BAKE→RESULT round with
no `REGISTER_TO_DEX` dispatched), and the live walkthrough (§18) shows funghi's own bake
correctly consuming exactly 3 mushroom from the just-granted 30 (30→27), landing on the same
value a fresh `CONFIRM_BAKE` consumption always would.

## 17. EP3 Shop regression

`purchaseIngredient`/`restockIngredient`/`canPlaceIngredient` (`src/logic/economy.ts`,
`src/state/inventory.ts`) — **0 lines changed**. `onion.restockQuantity` stays `12`,
`onion.pricePitz` stays `120`, both pinned by a dedicated regression test and reconfirmed live in
Shop (`たまねぎ 在庫 40 / +12 補充する 🪙120 Pitz`). `ShopOverlay.tsx` — **0 lines changed**: since
`SHOP_PRODUCTS` was already generic over `INGREDIENTS.filter(i => i.unlockCondition)` (EP3's own
design), the 10 newly-finite ingredients simply started appearing with zero new UI code, exactly
as the Ingredient Economy Fresh Audit predicted.

---

## 18. Tests

### 18.1 New test files

- **`src/data/economyConfig.ts`** has no test file of its own (a single constant); its value is
  pinned by `starterGrant.test.ts`'s first test.
- **`src/state/starterGrant.ts`** — 20 tests (`starterGrant.test.ts`): the constant, Margherita's
  permanent exclusion, all 7 recipes' exact grant quantities (via a `stepThroughChain` helper
  that isolates each recipe's own newly-crossed delta rather than a compound "as if migrating"
  snapshot), additive shared-ingredient math (including a partially-consumed-stock top-up case),
  exactly-once/no-op reference-stability, the Achievement Reset simulation, and atomicity
  (ownership+inventory+ledger always move together, never partially).
- **`src/state/gameReducer.starterGrant.test.ts`** — 17 tests: live reducer-dispatch integration
  for the full required duplicate-prevention family (reload/save-load, HOME/Dex/Shop no-op,
  RETRY_SAME_RECIPE, PLAY_AGAIN, SELECT_RECIPE, a genuine second real discovery of an
  already-unlocked recipe, FREE↔Lunch Rush both directions), Margherita's unlimited/normal-Pitz
  regression, the CONFIRM_BAKE-never-triggers-it regression, and the onion Starter-vs-Shop-pack
  distinction.
- **`src/state/persistence.test.ts`** — a new `migrateV2toV3` describe block (4 tests): an
  already-unlocked recipe backfills correctly, a not-yet-unlocked one doesn't, an existing real
  onion purchase is additively preserved (not overwritten), and purity/determinism.

### 18.2 Existing tests updated (premise changed by the Starter Set shrink, not a regression)

Every file below needed its `ownedIngredientIds` test fixtures updated from "pass
`STARTER_INGREDIENT_IDS` to mean *everything is owned*" (valid when it had 13 members) to
explicitly owning whichever now-finite ingredient(s) that specific test actually exercises — the
same category of change EP3's own report flagged for a single test ("PLACE_TOPPING succeeds for
onion once it is OWNED"), just at wider scope since 10 more ingredients moved off Starter:
`progression.test.ts`, `pizzaSelect.test.ts`, `PizzaSelectScreen.test.tsx`, `orders.test.ts`,
`recipes.test.ts`, `ingredients.test.ts` (the "exactly 13 Starter ingredients" regression test
now pins "exactly 3", explicitly, as this session's own intended change),
`gameReducer.test.ts` (SELECT_RECIPE/order-availability/inventory-carry-through — the last of
these also gained the correct "+mushroom" delta since discovering margherita in these fixtures
now legitimately also crosses funghi), `gameReducer.commitSauceDispense.test.ts`,
`gameReducer.restock.test.ts` (fugazza's `olive-oil` sauce is now also consumed at
`CONFIRM_BAKE`, clamped to 0 from an absent stock — a real, correct new consumption, not a bug),
`phase4a1a.regression.test.ts`, `phase4a1b.regression.test.ts` (save-schema key-set pin),
`IngredientTray.palette.test.tsx` (the "exactly 6 owned toppings" boundary fixture),
`PizzaStage.sauceReset.test.tsx`, `GameScreen.keyboardOverlay.test.tsx`,
`GameScreen.keyboardSpreadRepeat.test.tsx` (all three needed the specific sauce/topping ingredient
their own test targets to be explicitly owned **and** stocked, since EP3's Stock Gate now also
applies to them), `App.tsx` itself (persistence effect + `createInitialGameState` call site).

### 18.3 Required scenario checklist (task's own 32-item list)

1. `starterStockPlays = 10` ✅ (`starterGrant.test.ts`)
2. Margherita grant なし ✅
3. Margherita unlimited維持 ✅
4–9. #2–#7 unlock でgrant ✅ (both unit tests and live walkthrough, §18)
10. requirement × 10 ✅ (derivation, no magic numbers)
11. sauce/spread unit semantics (flat 10 uses) ✅
12. scatter unit semantics (minCount × 10) ✅
13. Fugazza Onion +40 ✅
14. Onion Shop +12 unchanged ✅
15. same recipe duplicate grant 禁止 ✅
16. different recipes shared ingredient additive ✅
17–18. reload / save-load duplicate 禁止 ✅
19. HOME roundtrip duplicate 禁止 ✅ (no action exists to even attempt it)
20–21. retry / play again duplicate 禁止 ✅
22. FREE/Lunch Rush duplicate 禁止 ✅
23–24. Dex/Shop open-close duplicate 禁止 ✅ (same "no action" argument)
25–26. re-lock/re-unlock, Achievement-Reset-shaped duplicate 禁止 ✅
27. inventory + claim atomic ✅
28. existing save migration ✅ (unit tests + live pre-EP4 v2 fixture walkthrough)
29. CONFIRM_BAKE consumption unchanged ✅
30. Shop paid restock unchanged ✅
31. Recipe Unlock conditions unchanged ✅ (0 lines changed in `recipes.ts`'s `unlockCondition`
    data or `progression.ts`'s `recipeUnlocked`)
32. Pitz reward unchanged ✅ (0 lines changed in `pitzReward.ts`; dedicated regression test)

---

## 19. Full suite count

**1341/1341 pass**, 67 test files — up from EP3+Ingredient-Economy-audit's own last-reported
baseline of **1298/1298** (the audit session was docs-only, so 1298 is still accurate as this
session's true starting point) — **+43 net new tests, 0 regressions** (every pre-existing
behavior this diff could plausibly affect is either unchanged-and-still-green or explicitly
updated with a documented reason, per §18.2).

---

## 20. Typecheck / lint / build

- **typecheck** (`npx tsc -b`): ✅ clean, 0 errors.
- **lint** (`npx oxlint`): ✅ clean, exit 0.
- **build** (`npx tsc -b && npx vite build`): ✅ succeeds — `dist/assets/index-*.js` 332.32 kB
  (gzip 104.41 kB), no warnings.

---

## 21. 390×844 verification (live, Playwright/Chromium against `vite dev`)

**Flow 1 — fresh save → Margherita → Funghi unlock → consume → HOME → reload:**

1. Cleared `localStorage`, loaded HOME. `🍕 ピザを作る` → Pizza Select: only マルゲリータ selectable;
   フンギ renders `🔒` with its real name + `マルゲリータを1枚完成させると解禁` hint (EP1, unaffected).
2. Played マルゲリータ live (real radial dough-stretch drag gesture, real sauce-paint drag, real
   tap-to-place cheese/topping, real bake-gauge timing) through BAKE → RESULT.
3. On registration, `localStorage`'s save (already reflecting the in-memory migrated/granted
   state) showed:
   `{"schemaVersion":3,...,"ownedIngredientIds":[...,"mushroom"],"inventory":{"mushroom":30},"starterGrantClaimedRecipeIds":["funghi"]}`
   — the starter grant fired for real, from a real gameplay dispatch, not a seeded fixture.
4. Selected フンギ (now unlocked, real name, playable) from Pizza Select, played it live, baked
   it. Save updated to
   `{"...","dex":[margherita,funghi both discovered],"ownedIngredientIds":[...,"garlic","oregano"],"inventory":{"mushroom":27,"garlic":30,"oregano":20},"starterGrantClaimedRecipeIds":["funghi","marinara"]}`
   — mushroom correctly consumed 30→27 (3 pieces placed and baked), and funghi's own first
   discovery correctly, additionally crossed marinara (chained unlock, granting garlic/oregano)
   in the same dispatch.
5. Tapped `🏠 ホーム`, then reloaded the page (`page.reload()`, a real full navigation).
   `localStorage` after reload was **byte-identical** to before reload — no duplicate grant, no
   lost stock, no lost ledger entry. Confirmed programmatically (`JSON.stringify` equality) and
   visually (HOME screen: `🪙 100`, `レシピ 2/7`, no console/page errors throughout).

**Flow 2 — pre-EP4 v2 save migration → Fugazza unlock → Onion +40 vs. Shop +12:**

1. Seeded `localStorage` directly with a realistic pre-EP4 `schemaVersion: 2` save (old 13-strong
   Starter ownership list, chain discovered through quattro-formaggi, `totalStars` well past
   fugazza's 12-star gate, `onion` never purchased, no `starterGrantClaimedRecipeIds` field at
   all — that field didn't exist pre-EP4).
2. Reloaded. Pizza Select rendered **フガッサ** for the first time with its real name and a `NEW`
   badge (previously only ever shown as `？？？`) — confirming the migration's grant correctly
   satisfied both `isRecipeAvailable` axes (recipe-unlock chain, already true, **and** onion now
   OWNED via the migration grant).
3. Opened Shop: every one of the 10 EP4b ingredients rendered with the exact expected migrated
   stock — `オリーブオイル 在庫20` (10+10 additive), `オレガノ 在庫30` (20+10 additive), `ゴルゴンゾーラ/
   パルミジャーノ/フォンティーナ 在庫20` each, `にんにく 在庫30`, `チェリートマト 在庫30`, `たまご 在庫10`,
   `ジェノベーゼソース 在庫10`, `マッシュルーム 在庫30` — and, the task's own explicitly-required check,
   **`たまねぎ 在庫40` with a separate `+12 🪙120 Pitz 補充する` restock row** on the same line,
   visually confirming the Starter-grant-vs-Shop-pack unit distinction in the running app.
4. No horizontal overflow, no console/page errors, at 390×844 throughout both flows (screenshots
   captured at every step).

---

## 22. Changed files

**Production code** (11 files): `src/data/economyConfig.ts` (new), `src/state/starterGrant.ts`
(new), `src/data/ingredients.ts` (10 ingredients gain `unlockCondition`/`pricePitz`/
`restockQuantity`; `STARTER_INGREDIENT_IDS` shrinks to 3), `src/state/gameReducer.ts`
(`starterGrantClaimedRecipeIds` field + wiring into `REGISTER_TO_DEX`/`MISSION_NEXT_ORDER`/every
carry-object call site), `src/state/persistence.ts` (Save v3, `migrateV2toV3`,
`sanitizeStarterGrantClaimedRecipeIds`, `toIntermediateSave` pipeline update), `src/App.tsx`
(hydrate + persist the new field).

**Tests** (17 files modified, 3 new): see §18.1/§18.2 for the full list and reasons.

**Docs** (1 file, this report).

No `ShopOverlay.tsx`, `IngredientTray.tsx`, `PizzaSelectScreen.tsx`, `logic/economy.ts`,
`state/inventory.ts`, `logic/pitzReward.ts`, or `data/recipes.ts` changes — confirmed by `git
diff --stat` against `origin/main`.

---

## 23. Unresolved issues

1. **Ingredient-level `minTotalStars` for the 10 EP4b ingredients is a judgment call, not a
   value any SSOT document specifies** (§6). The chosen values (`0` for chain-only recipes, `8`
   mirroring quattro-formaggi's own gate) create a narrow, low-severity cosmetic loophole: since
   `IngredientUnlockCondition` has no `requiresRecipeId` field (only `minTotalStars`), a player
   with unusually high `totalStars` from very few recipes (e.g. a single ★5 margherita) could see
   an ingredient like `mushroom` listed `AVAILABLE_TO_BUY` in Shop slightly before funghi's own
   chain condition is met. This never causes a duplicate grant, inventory loss, or crash — at
   worst a player spends Pitz slightly early on an ingredient not yet useful. Explicitly flagged
   rather than silently absorbed, per instruction. A future fix (out of EP4's own scope, since it
   touches Shop UI/`IngredientUnlockCondition`'s type) would add chain awareness to that type.
2. **The lazy-migration-write property** (§14): a migrated save's schemaVersion/ledger/inventory
   only physically reach `localStorage` once some other real progression change triggers a write.
   Confirmed pre-existing (same as v1→v2) and functionally harmless (the in-memory/rendered state
   is always correct, since re-deriving the migration is pure and deterministic), but noted
   explicitly since it was directly observed during live verification (§21) and is easy to
   mistake for a bug on a superficial read of raw storage.
3. **`ownedIngredientIds` is never stripped during migration** (§14) for a not-yet-unlocked
   recipe's ingredient that was artifactually "owned" under the old, larger Starter set — this is
   the documented, deliberate "safe side" choice, with the one narrow, cosmetic consequence
   already spelled out there (the ingredient can appear selectable in the Tray with 0 stock until
   its recipe naturally unlocks, at which point the real grant tops it up correctly).

None of these three block merge — each is an ordinary implementation-time judgment call with a
low-severity, fully-understood, non-destructive worst case, explicitly recorded per instruction
rather than silently decided.

---

## 24. Follow-up recommendations

1. Resolve unresolved issue #1 above in a future, small, docs-first slice (add
   `requiresRecipeId` support to `IngredientUnlockCondition`, or explicitly decide the current
   behavior is acceptable) — not urgent, no player-facing harm observed.
2. The Ingredient Economy Fresh Audit's own remaining slices (#4 Ingredient Tray "Recommended +
   Other", #5 Inventory screen, #6 topping subcategory taxonomy, #7 Recipe Select tier sections)
   remain exactly as that audit scoped them — unaffected by, and not prerequisites for, this
   session.
3. When #89 (Achievement Reset) is implemented, its own PR should add a direct regression test
   asserting `starterGrantClaimedRecipeIds` is excluded from whatever fields the reset clears —
   this report's own simulation test (§15) is the reference behavior to preserve.

---

## FINAL VERDICT

**A. EP4 COMPLETE — READY FOR MERGE REVIEW.**

The starter-stock grant is implemented as an atomic, exactly-once reducer transaction (never a
UI effect), covers all 7 recipes with quantities derived from a single named constant and each
recipe's own already-authored data, correctly handles the additive shared-ingredient case,
survives every required duplicate-prevention scenario (reload, save/load, HOME, retry, play
again, FREE↔Lunch Rush, Dex/Shop toggling, and an explicit Achievement-Reset-shaped simulation),
ships a documented, safe-by-default v2→v3 save migration for existing players, and leaves EP1
(Recipe Unlock), EP2 (CONFIRM_BAKE consumption), EP3 (Shop restock/Stock Gate), and the Pitz
reward formula byte-for-byte unchanged. Verified by 1341/1341 passing tests (+43 net new, 0
regressions), a clean typecheck/lint/build, and two live 390×844 walkthroughs — one a real,
first-hand gameplay discovery of the grant firing, the other a seeded pre-EP4 save proving the
migration and the Fugazza/Onion Starter-vs-Shop-pack distinction both render correctly in the
running app. Per instruction, this PR is left **OPEN**, not merged, regardless of verdict.
