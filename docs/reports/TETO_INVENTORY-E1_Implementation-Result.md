# Teto Pizza Game — Inventory E1 (InventoryState) Implementation Result

**Scope: production implementation. Foundation-only, per task scope guard — no ingredient
consumption, no `CONFIRM_BAKE` decrement, no shortage UI, no Shop changes.**

- **Base SHA**: `5d28c5dc996c0ea76aa6428f158a766165477213` (`main`, PR #76 merge — "docs: Pizza DB
  160 catalog recovery audit (read-only, verdict D)"). Fetched fresh via `git fetch origin` at
  session start; the pre-created remote branch
  (`claude/inventory-e1-production-28q492`) was byte-identical to `origin/main` at this SHA (no
  prior work on it), so the implementation branch was reset to fresh `origin/main` directly.
- **Head SHA**: see the commit this report ships with (single commit on
  `claude/inventory-e1-production-28q492`).
- **Drift check against the Preflight** (`docs/reports/TETO_INVENTORY-E1_Implementation-Preflight.md`,
  audited SHA `aaf56ed`): `git diff aaf56ed origin/main --stat` for
  `gameReducer.ts`/`persistence.ts`/`App.tsx`/`ingredients.ts`/`progression.ts` showed only
  `App.tsx` changed (PR #75, RESULT 2.0 Slice 1) — a new `handleConfirmBake` orchestration
  function and a prop rewire, both well clear of the hydration/persistence call sites the
  Preflight cited. No re-audit was needed; implementation proceeded directly per the Preflight's
  own file scope.

## 1. Changed files

```
 src/App.tsx                              |   5 +-
 src/state/gameReducer.pitzReward.test.ts |   2 +
 src/state/gameReducer.test.ts            | 132 +++++++++++++++++++++++++++++++
 src/state/gameReducer.ts                 |  15 +++-
 src/state/persistence.test.ts            |  40 +++++++---
 src/state/persistence.ts                 |  19 ++++-
 src/state/inventory.ts                   | new
 src/state/inventory.test.ts              | new
 8 files changed
```

No production file outside `src/state/*` and `src/App.tsx` was touched. No component
(`IngredientTray.tsx`, `ShopOverlay.tsx`, or any other) was touched — none reads `inventory` in
E1, matching the Preflight's scope exactly.

## 2. InventoryState definition

```ts
// src/state/inventory.ts (new)
export type InventoryState = Readonly<Record<string, number>>;
export const EMPTY_INVENTORY: InventoryState = {};

export function hasStock(
  ingredient: Ingredient,
  inventory: InventoryState,
  alreadyUsedThisRound: number,
): boolean {
  if (!ingredient.unlockCondition) return true; // Starter Set: unconditionally unlimited
  return (inventory[ingredient.id] ?? 0) - alreadyUsedThisRound > 0;
}

export function remainingStock(
  ingredient: Ingredient,
  inventory: InventoryState,
): number | "UNLIMITED" {
  return ingredient.unlockCondition ? (inventory[ingredient.id] ?? 0) : "UNLIMITED";
}
```

A flat `ingredientId -> number` map, exactly as designed by the Fresh Audit/Preflight — matches
`ownedIngredientIds: string[]`/`missionBest: Record<string, number>`'s existing shape family, no
richer per-ingredient struct. **`hasStock`/`remainingStock` have zero callers in this PR** — they
exist as pure, independently tested functions for E2 to import unchanged; no reducer case or
component calls either of them yet.

## 3. Ownership vs. stock invariant

- **`ownedIngredientIds: readonly string[]`** (unchanged) — permanent unlock flag, "can this
  ingredient ever be placed at all."
- **`inventory: InventoryState`** (new `GameState` field) — consumable stock, "how many units
  remain," irrelevant to whether placement is *allowed*.
- **Starter ingredients (13 of 14) are structurally exempt from the stock check.** `hasStock`
  returns `true` unconditionally when `Ingredient.unlockCondition` is absent — not "defaulted to
  a large number," genuinely exempt. No code path in this PR can make a Starter ingredient stop
  being placeable.
- **The legal "owned but out of stock" combination is exercised directly by a test**
  (`gameReducer.test.ts`, "ownedIngredientIds and inventory vary independently — an ingredient
  can be owned/unlocked with zero stock"): `onion` added to `ownedIngredientIds` with
  `EMPTY_INVENTORY` still round-trips as `owned === true` / `inventory.onion === 0` with no
  cross-field coupling.
- **A second test pins the reverse direction**: `PURCHASE_INGREDIENT` (the one existing reducer
  case that mutates `ownedIngredientIds`) leaves `inventory` completely untouched, confirming the
  two fields' write paths stay disjoint.

## 4. All reducer carry-through sites

The Preflight's own re-verification (§2/§5 of that report) listed **5** `GameState`/
`ProgressionCarry` construction sites. Adding `inventory` as a **required** field to both
interfaces let `tsc -b` itself surface **3 additional hand-built carry-object literals** the
Preflight's line-by-line citation had not called out (`PLAY_AGAIN`, `SELECT_RECIPE`,
`RETRY_SAME_RECIPE` each build their own `{ dex, ownedIngredientIds, pitzBalance,
lastClaimedMissionRunId }` object rather than spreading an existing `ProgressionCarry`) — exactly
the failure mode the Preflight's own §10 "type-checker as a safety net" risk note predicted and
was designed to catch. All 8 sites are fixed:

| # | Site | Fix |
|---|---|---|
| 1 | `buildOrderState` | No edit needed — spreads `...carry` already. |
| 2 | `nextOrderState` | No edit needed — forwards `carry` to `buildOrderState`. |
| 3 | `nextMissionOrderState` | **Edited** — added `inventory: state.inventory` to its hand-built carry literal (the single highest miss-risk site per both audits, since it's the only one of the original 5 that doesn't spread). |
| 4 | `startPreparingRecipe` | No edit needed — forwards `carry`. |
| 5 | `createInitialGameState` | **Edited** — gained a 4th parameter `inventory: InventoryState = EMPTY_INVENTORY`. |
| 6 | `PLAY_AGAIN` case | **Edited** (not in Preflight's list) — added `inventory: state.inventory` to its hand-built literal. |
| 7 | `SELECT_RECIPE` case | **Edited** (not in Preflight's list) — same fix. |
| 8 | `RETRY_SAME_RECIPE` case | **Edited** (not in Preflight's list) — same fix. |

Every other `case` in the reducer switch carries `inventory` through automatically via its
existing `{ ...state, ... }` pattern (confirmed by `tsc -b` passing with `inventory` required on
`GameState` — a missed site would be a compile error, not a silent runtime drop). Verified
directly with dedicated carry-through tests (§6) for `CONFIRM_MAKING_STEP`, `CONFIRM_BAKE`,
`REGISTER_TO_DEX`, `RESET_PIZZA`, `MISSION_RESET_ORDER`, `MISSION_NEXT_ORDER`, `PLAY_AGAIN`,
`SELECT_RECIPE`, `RETRY_SAME_RECIPE`, and `PURCHASE_INGREDIENT`.

## 5. Persistence / hydration flow

- **`src/state/persistence.ts`**:
  - `ProgressionSnapshot` gained `inventory: InventoryState`.
  - `persistProgress` now sanitizes the incoming inventory via the existing (E0) private
    `sanitizeInventory`, adds a new `sameInventory` per-key value comparator (a plain `sameStringSet`
    key-only check is the wrong tool here since *values* matter, not just which ids are tracked —
    an absent key reads as `0` on both sides, matching `sanitizeInventory`/`hasStock`'s own
    convention), and folds `inventoryUnchanged` into the existing
    `dexUnchanged && pitzUnchanged && ownedUnchanged` no-op-skip guard.
  - **No change to `loadSave`/`sanitizeSave`/`sanitizeInventory`/`migrateV1toV2`** — all already
    correct from E0 (PR #56), confirmed unchanged in this diff.
- **`src/App.tsx`**:
  - Mount-time hydration: `createInitialGameState(save.dex, save.ownedIngredientIds,
    save.pitzBalance, save.inventory)` — 4th argument added.
  - The `persistProgress({...})` effect call gained `inventory: state.inventory`; its dependency
    array gained `state.inventory`.
  - **No prop reaches any component** — no consumer of `inventory` exists yet, confirmed by
    grepping `inventory` (case-insensitive) across `src/components/` and `src/App.tsx`: zero
    matches outside the two edited lines above.

## 6. Save schema decision

**No `schemaVersion` bump — stayed on `PersistentSaveV2` (v2, unchanged since E0/PR #56).** The
`inventory: Record<string, number>` field, its sanitizer, and its migration backfill all already
existed and were already correct; E1's entire job was reading an already-persisted field into
runtime `GameState` and writing it back through the existing read-modify-write pattern. No new
field, no shape change, no new sanitizer was needed or added.

## 7. Migration verification

E0's existing migration/sanitization test suite (`persistence.test.ts`) was **not modified** and
re-ran green unmodified as part of the full suite:

- `migrateV1toV2` backfill matrix (owned-`onion` vs. no-`onion`, `DEFAULT_MIGRATION_RESTOCK_QTY`
  grant, Starter ingredients never backfilled).
- `sanitizeInventory` per-key tolerance (unknown ids, non-integer/negative values, Starter ids
  unconditionally stripped even if present in raw storage).
- Malformed (non-object) `inventory` falls back to `{}` instead of throwing.
- `loadSave`'s schema-version dispatch (1 → migrate+sanitize, 2 → sanitize/pass-through, unknown →
  fresh default) is byte-identical to pre-E1.

This is the exact "E0 already covers this, E1 does not need to re-test" boundary the Fresh
Audit/Preflight both called out (§12/§6 respectively) — confirmed still true by running the full
suite, not merely cited.

## 8. Tests

**New (`src/state/inventory.test.ts`, 6 tests)**: `hasStock`/`remainingStock` pure-function
matrix — Starter ingredient always unlimited regardless of inventory contents; finite ingredient
below/at/above `alreadyUsedThisRound`; absent key reads as `0`/`"UNLIMITED"`.

**New (`src/state/gameReducer.test.ts`, 13 tests, one new `describe` block)**:

1. `createInitialGameState` defaults `inventory` to `EMPTY_INVENTORY`.
2. Hydrated `inventory` carries into the initial state.
3. A normal in-round action (`CONFIRM_MAKING_STEP`) carries `inventory` through unchanged.
4. `CONFIRM_BAKE`/RESULT carries `inventory` through unchanged.
5. `REGISTER_TO_DEX`/DISCOVERED carries `inventory` through unchanged.
6. FREE retry (`RETRY_SAME_RECIPE`) carries `inventory` through unchanged.
7. `PLAY_AGAIN` carries `inventory` through unchanged.
8. `SELECT_RECIPE` carries `inventory` through unchanged.
9. `RESET_PIZZA` carries `inventory` through unchanged.
10. `MISSION_RESET_ORDER` carries `inventory` through unchanged.
11. `MISSION_NEXT_ORDER` (`nextMissionOrderState`, the highest-miss-risk hand-built site) carries
    `inventory` through unchanged — Lunch Rush's own "next order" regression.
12. `ownedIngredientIds`/`inventory` vary independently (owned + zero-stock is legal).
13. `PURCHASE_INGREDIENT` never leaks into `inventory` (ownership and stock write paths stay
    disjoint).

**Extended (`src/state/persistence.test.ts`)**: every existing `persistProgress(...)` call site
updated to pass `inventory: EMPTY_INVENTORY` (import added) so `ProgressionSnapshot`'s new
required field doesn't silently default anywhere in the existing round-trip/no-op-skip/
Dex-doesn't-clobber-Pitz test matrix — those tests' own assertions are otherwise unchanged.

**Extended (`src/state/gameReducer.pitzReward.test.ts`)**: the two `persistProgress` calls in its
"credited pitzBalance round-trips" describe block gained `inventory: discovered.inventory`.

Full suite: **1217/1217 pass** (1198 baseline + 6 + 13 new), 0 regressions.

## 9. RESULT 2.0 regression (PR #75)

Confirmed via the dedicated carry-through test "`REGISTER_TO_DEX`/DISCOVERED carries `inventory`
through unchanged" (built on `playToResultWithInventory`, which exercises the identical
`PREPARE → BAKE(CONFIRM_BAKE) → RESULT → REGISTER_TO_DEX → DISCOVERED` path PR #75's merged Hero
result screen depends on) plus the full existing RESULT 2.0/Scoring 2.0 Authority test files
(`gameReducer.scoringV2Authority.test.ts`, `gameReducer.bakeGuideRegression.test.ts`,
`gameReducer.pitzReward.test.ts`) re-running green unmodified except for the `inventory`-field
additions to `persistProgress` calls noted in §8. `REGISTER_TO_DEX`'s own Dex/BEST/Pitz reducer
body is untouched — zero diff inside its `case` block.

## 10. Lunch Rush regression

Confirmed via the dedicated `MISSION_NEXT_ORDER` carry-through test (built through the same
`PREPARE → BAKE → RESULT → MISSION_NEXT_ORDER` path Lunch Rush's mission-order-to-next-order flow
uses) plus the full pre-existing Mission suite (`nextMissionOrderState`'s
`MISSION_RESET_ORDER`/`MISSION_NEXT_ORDER` tests, Mission scoring/economy tests) re-running green
unmodified.

## 11. Deferred E2 scope (confirmed not implemented)

Verified none of the following exist anywhere in this diff:

- No reducer case decrements `inventory` — `CONFIRM_BAKE` still only sets
  `pizza`/`bakeState`/`scoringV2Result`/`score`/`phase` (confirmed by `git diff` showing zero
  change inside that `case` block).
- `hasStock`/`remainingStock` have zero callers.
- No Shop restock transaction — `purchaseIngredient` (`economy.ts`) is untouched, still only
  returns `nextOwnedIngredientIds`/`nextPitzBalance`.
- No Shop UI change — `ShopOverlay.tsx` untouched.
- No shortage/stock-based filter — `IngredientTray.tsx` untouched, still gates purely on
  `ownedIngredientIds.includes`.
- No recipe-unlock, scoring, Pitz-formula, RESULT, Cooking Time, or Pizza DB change — none of
  those files appear in this diff at all.

## 12. Known risks

- **Low, mechanical.** The only real risk category (missed `GameState`/`ProgressionCarry`
  construction sites) was structurally caught by the type checker during implementation — 3 sites
  beyond the Preflight's own citation were found and fixed this way, confirming the mitigation
  works as designed rather than being a theoretical claim.
- **No UI/gameplay-visible risk** — no rendered component reads `inventory` in this PR; confirmed
  by grep, not just by design intent.
- **`App.test.tsx` was not extended** with a dedicated v2-inventory hydration smoke test (the
  Preflight flagged this as "not a blocker either way," since that file seeds saves via a v1
  fixture and relies on `migrateV1toV2`'s already-tested backfill path, and `gameReducer.test.ts`'s
  own "carries a hydrated inventory through into the initial state" test plus
  `persistence.test.ts`'s round-trip tests already cover both halves of the hydration path
  directly). Not re-litigated here; flagged as the one preflight-noted item taken as-is.

## 13. Next recommended slice

**E2: atomic material consumption at `CONFIRM_BAKE`.** Per the Fresh Audit/Preflight's own
sequencing (§10 of each): add the `state.phase !== "BAKE"` guard `CONFIRM_BAKE` has always been
missing (confirmed still absent, unrelated to E1, pre-existing since before Save v2 work began),
then wire the decrement using this PR's `hasStock`/`remainingStock`, with unit semantics per the
Fresh Audit §6 (scatter ingredients = placed-piece count, sauce = binary "used this round" —
already decided, not re-opened here). `IngredientTray` would then extend its existing
`ownedIngredientIds.includes` filter with `hasStock(...)`. E3 (Shop 2.0 restock) follows E2.

## Report summary

- **Base SHA**: `5d28c5dc996c0ea76aa6428f158a766165477213` (fresh `main`, PR #76 merge).
- **Changed files**: `src/state/inventory.ts` (new), `src/state/inventory.test.ts` (new),
  `src/state/gameReducer.ts`, `src/state/gameReducer.test.ts`,
  `src/state/gameReducer.pitzReward.test.ts`, `src/state/persistence.ts`,
  `src/state/persistence.test.ts`, `src/App.tsx`.
- **InventoryState**: `Readonly<Record<string, number>>` + `EMPTY_INVENTORY`/`hasStock`/
  `remainingStock`, zero callers of the latter two in this PR (E2's job).
- **Invariant**: `ownedIngredientIds` (permanent unlock) and `inventory` (consumable stock)
  confirmed independent by dedicated tests in both directions.
- **Carry-through**: 8 `GameState`/`ProgressionCarry` construction sites fixed (5 predicted by
  the Preflight + 3 the type checker caught during implementation), confirmed by `tsc -b` and 13
  dedicated reducer tests.
- **Persistence**: `ProgressionSnapshot`/`persistProgress` extended with a value-based
  `sameInventory` no-op-skip comparator; `loadSave`/`sanitizeInventory`/`migrateV1toV2` untouched.
- **Schema**: no bump — `PersistentSaveV2` (v2) unchanged.
- **Migration**: E0's existing v1→v2/sanitization suite re-ran green, unmodified.
- **Tests**: 1217/1217 pass (19 new: 6 pure-function + 13 reducer carry-through), 0 regressions.
- **Typecheck/lint/build**: all clean.
- **UI change**: none. No component reads `inventory`.
- **Preview**: not needed — no visual change (see below).
- **Deferred E2 scope**: confirmed absent from this diff (consumption, restock, Shop UI,
  shortage gating, recipe/scoring/Pitz/RESULT/Cooking-Time/Pizza-DB changes).
- **Known risks**: low, mechanical; the one deliberately-not-extended file (`App.test.tsx`) is
  the Preflight's own accepted "not a blocker" item.
- **Next recommended slice**: E2 (atomic consumption at `CONFIRM_BAKE`, including its
  long-standing missing `phase !== "BAKE"` guard).

## Preview / video

**Not applicable — no production UI changed.** This is foundation-only mechanical carry-through
of an already-persisted, already-designed field through `GameState`/persistence with zero
rendered consumers (`hasStock`/`remainingStock` have no callers; no component imports
`state.inventory`). Confirmed by grep across `src/components/` and `src/App.tsx`'s JSX. Per the
project's "audit/foundation-only tasks are exempt from Preview deployment" rule, and the task's
own "NO HUMAN UI CHANGE EXPECTED" section, no dedicated Preview deploy or Review Playthrough video
was produced for this PR.
