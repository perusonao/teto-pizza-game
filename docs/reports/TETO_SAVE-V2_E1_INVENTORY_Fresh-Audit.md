# Teto Pizza Game — Save v2 / Inventory E1 (InventoryState) Fresh Audit

**Scope: read-only design audit. No production code was touched in this session.**

- **Audited `main` SHA**: `27818efb4876d9220e425ffe65afdc9a9288e62a` (PR #69 merge, "Roadmap/SSOT
  Fresh Sync — sync Issue #22/#33/#37 + PROJECT_HANDOFF to fresh GitHub state"). Fetched fresh via
  `git fetch origin main` at session start; confirmed via `git rev-parse origin/main`.
- **CI on audited SHA**: green (`build` check, `conclusion: success`, PR #69's own check run).
- **Recommended model**: Claude Code, normal (non-Opus) tier — confirmed appropriate; this slice
  is mechanical carry-through of an already-designed, already-reserved field, not a fresh design
  problem.

## 1. PR #56 verification (E0 — must not be re-implemented)

Confirmed via GitHub: **PR #56, "Save v2 / Inventory E0: safe v1→v2 persistence migration," is
MERGED** (`merged: true`, `merged_at: 2026-09-18T01:42:51Z`, merge commit `556376c` in `main`'s
history, base `142a182`).

What E0 actually shipped (verified by reading `src/state/persistence.ts` on the audited SHA
directly, not just trusting the PR description):

- `CURRENT_SCHEMA_VERSION = 2`.
- `PersistentSaveV2` = the four `PersistentSaveV1` fields (`dex`, `pitzBalance`,
  `ownedIngredientIds`, `missionBest`) unchanged, plus `inventory: Record<string, number>`.
- `migrateV1toV2`: pure, deterministic, carries all four v1 fields through verbatim, backfills
  `inventory` via `backfillInventoryForMigratedSave` (grants `DEFAULT_MIGRATION_RESTOCK_QTY = 4` to
  every already-owned non-Starter ingredient — today only `onion` — never `0`).
- `sanitizeInventory`: per-key tolerant; drops unknown ids, non-integer/negative values, and
  **unconditionally drops any Starter ingredient id even if present in raw storage**.
- `loadSave` dispatches on `schemaVersion` (1 → migrate then sanitize, 2 → sanitize/pass-through,
  anything else → fresh default). This is unchanged since E0 landed.

**Confirmed: E0 is fully done and correct as designed. Nothing in E0 needs redoing.** Two later
merges (`PR #60` Scoring 2.0 Authority Cutover, `PR #62` Shadow-naming cleanup) landed on top of
E0 and do not touch `persistence.ts`, `PersistentSaveV2`, or any inventory-adjacent field —
confirmed by reading the current file and by `git log --oneline -- '*persistence*'` showing no
commits on this path after `556376c` (E0's own merge).

**Confirmed: `inventory` is still write-only from `persistence.ts`'s point of view — nothing in
`GameState`/`gameReducer.ts`/`App.tsx`/any component reads or writes it yet.** Verified by
grepping `inventory` (case-insensitive) across `src/`: only `persistence.ts`,
`persistence.test.ts`, and `phase4a1b.regression.test.ts` (an existing assertion updated to
include the new key in `createDefaultSave()`'s key set) match. E1 has not been started.

## 2. Current save schema (as of this SHA)

```ts
// src/state/persistence.ts
export interface PersistentSaveV2 {
  schemaVersion: 2;
  dex: DexEntry[];                       // { recipeId, discovered, bestScore, bestStars, timesMade }[]
  pitzBalance: number;
  ownedIngredientIds: string[];          // permanent OWNED flags — no quantity
  missionBest: Record<string, number>;   // per-mission-id BEST Mission Score
  inventory: Record<string, number>;     // ingredientId -> stock, non-Starter ingredients only
}
```

`sanitizeInventory`'s two gates (both required per entry): id must be in `KNOWN_INGREDIENT_IDS`
**and not** in `STARTER_INGREDIENT_ID_SET`; value must be a non-negative integer. This is the
enforcement point that keeps Starter ingredients out of the stock map on every load, not just at
migration time.

## 3. Current Shop / ownership model

Unchanged from the E0-era design and still exactly matches what's in the code today:

- `ingredientState(ingredient, ownedIngredientIds, totalStars)` (`src/state/progression.ts`) is
  the single three-state derivation (`LOCKED | AVAILABLE_TO_BUY | OWNED`). No ingredient has a
  separate stored "unlocked" boolean.
- Every current ingredient with no `unlockCondition` (all 13 today, `STARTER_INGREDIENT_IDS`,
  `src/data/ingredients.ts`) is **unconditionally `OWNED`**, regardless of what's in
  `ownedIngredientIds` — a deliberate safety net, not just the common case.
- Exactly **one** ingredient (`onion`) has `unlockCondition: { minTotalStars: 12 }` and
  `pricePitz: 120`. It is the only ingredient that is ever `LOCKED`/`AVAILABLE_TO_BUY`, and the
  only ingredient legally allowed to appear as a key in `inventory`.
- `isRecipeAvailable` (`progression.ts`): a recipe is available iff every
  `requiredIngredients[].ingredientId` is `OWNED`. 6 of 7 recipes require only Starter ingredients
  (always available); only `fugazza` requires `onion`.
- `purchaseIngredient` (`src/logic/economy.ts`): pure, whole-or-nothing. Returns
  `{ success: true, nextOwnedIngredientIds, nextPitzBalance }` or a typed failure reason
  (`LOCKED`/`ALREADY_OWNED`/`INSUFFICIENT_FUNDS`/`NOT_FOR_SALE`). **It only ever grants
  ownership — it does not touch, and today cannot touch, `inventory`.** There is no restock
  transaction anywhere in the codebase yet.
- `ShopOverlay.tsx`: `SHOP_PRODUCTS = INGREDIENTS.filter(i => i.unlockCondition)` — today exactly
  `[onion]`. Renders LOCKED (remaining-★ hint) / AVAILABLE_TO_BUY (price + buy button) / OWNED
  ("✓ 購入済み"). No quantity UI exists anywhere — there is nothing to show yet.
- `IngredientTray.tsx` (verified directly, line 85-87): still gates purely on
  `ownedIngredientIds.includes(i.id)`. No stock-based filtering exists.

**"所有している材料" vs. "消費可能な材料在庫" — confirmed NOT confused in the current code.**
These are two structurally separate concepts today, on two separate fields:
`ownedIngredientIds: string[]` (a permanent, one-time unlock flag — "can this ever be placed at
all") vs. `inventory: Record<string, number>` (a consumable scalar — "how many uses remain," E0's
reserved field, currently unread). Nothing conflates them. The risk this audit was asked to check
for does not exist in the current codebase.

## 4. Proposed InventoryState (unchanged from the prior Fresh Audit's design — re-verified, still correct)

```ts
// src/state/inventory.ts (new, E1)
export type InventoryState = Readonly<Record<string, number>>; // ingredientId -> current stock

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

A flat `ingredientId -> number` map matches every other ownership-adjacent structure in this
codebase (`ownedIngredientIds: string[]`, `missionBest: Record<string, number>`) — no richer
per-ingredient struct is justified by anything in current data. This re-audit found no code change
since the prior audit's SHA that would alter this recommendation.

**E1 itself needs none of `hasStock`/`remainingStock`'s callers to exist yet** — the scope guard
below is explicit that placement gating is E2's job. E1 only needs the type and these two pure
derivations to exist and be tested in isolation, so E2 has them ready to import.

## 5. Starter / unlimited policy (confirmed, not invented here)

- **Starter (no `unlockCondition`, today all 13 non-`onion` ingredients)**: permanently,
  unconditionally unlimited stock. Not "a large number" — structurally exempt from the stock check
  entirely (`hasStock` returns `true` unconditionally when `unlockCondition` is absent). This must
  never change for a Starter ingredient under any save state (fresh, migrated, or corrupt).
- **Purchased/finite (`unlockCondition` present, today only `onion`)**: stock-tracked via
  `inventory[id]`, defaults to `0` when absent (mirrors `ownedIngredientIds`'s own "absent = not
  owned" convention).
- **Locked**: irrelevant to `inventory` — a `LOCKED` ingredient can't be placed regardless of
  stock (gated by `ownedIngredientIds`, an orthogonal axis), and `sanitizeInventory` would strip
  its id from storage even if a bug somehow wrote one there before purchase, since ownership and
  ability to appear in `inventory` are the same "has `unlockCondition`" gate today.
- **First-pizza safety, confirmed by construction, not by a chosen buffer**: 6 of 7 recipes require
  only Starter ingredients → always makeable regardless of `inventory`'s contents. `fugazza`
  requires `onion`, which is *already* gated behind a Shop purchase today, independent of Save v2.
  E1 introduces no new case where a recipe that's makeable today becomes unmakeable. This audit did
  not find any way for E1's proposed wiring to violate "no first-pizza dead end."

## 6. Inventory unit semantics — audited, not newly decided here

The task asks specifically whether "UI piece count" and "economic ingredient quantity" may safely
be treated as the same unit, using the "5 mozzarella pieces placed ≠ 5 stock consumed" example.
Two findings from reading the actual data/reducer code (`src/data/recipes.ts`,
`src/state/gameReducer.ts`'s `PLACE_TOPPING`/`APPLY_SAUCE` cases, `src/state/pizzaState.ts`):

1. **The example ingredient itself (`mozzarella`) is Starter** — it has no `unlockCondition`, so
   under §5's policy it is unconditionally unlimited and would never consume `inventory` stock at
   all, regardless of how many pieces are placed. The literal case in the prompt cannot occur under
   the current data (only `onion` — a `scatter`-placement topping, `fugazza`'s `minCount: 4` — is
   ever finite-stock today).
2. **For the general (future) case**, this codebase already has two distinct placement mechanics
   that don't reduce to one unit automatically:
   - `placement: "scatter"` (every cheese/topping, including `onion`): `state.pizza.toppings` is an
     array of discrete placed pieces (`{ id, ingredientId, x, y }`, confirmed at
     `gameReducer.ts` line ~403). A **placed piece count** (`toppings.filter(t => t.ingredientId
     === id).length`) is a real, already-existing, directly-readable number — "1 placed piece = 1
     economic unit" is a coherent, derivable rule for this category, requiring no new tracked
     state.
   - `placement: "spread"` (every sauce): `state.pizza.sauceIds`/`sauceDeposits` model **where**
     sauce was painted (a heatmap/coverage concept, confirmed unchanged at
     `gameReducer.ts` lines ~310-360), not a discrete "how many units" count. There is no
     "5 units of sauce" in current data — every current recipe's sauce requirement is
     `minCount: 1`. "1 pizza uses sauce once" (binary presence, `sauceIds.includes(id) ? 1 : 0`)
     is the only meaningful unit for this category today; treating painted-area as an economic
     quantity would require inventing a metric that doesn't exist anywhere else in the codebase.

**Conclusion: "UI piece count = economic quantity" is safe and correct for `scatter` ingredients
only, and is not a meaningful question for `spread` (sauce) ingredients, which have no piece count
to begin with.** This is a real, already-identified design point — but it is **E2's decision, not
E1's**. `InventoryState` itself (`Record<string, number>`) is a plain scalar-per-id store; it does
not encode or need to encode *what a unit means* to exist, load, save, or carry through
`GameState`. E1 can and should ship without resolving this, exactly as E0 shipped the storage field
without resolving it. It must be resolved before E2 writes the actual decrement, and it should be
written down once, in E2's own audit-or-design step, as: **scatter = placed-piece count, spread /
sauce = binary "used this round" (1 or 0), never re-specified as a separately tracked value** — this
matches the prior Fresh Audit's §7 exactly, re-verified here against the current
`gameReducer.ts`/`pizzaState.ts` shapes and found still accurate.

## 7. Schema migration requirement for E1

**No `schemaVersion` bump. `PersistentSaveV2` (v2, already shipped by E0) is sufficient for E1
as designed.**

Rationale: `inventory: Record<string, number>` already exists on the persisted shape, already
round-trips through `loadSave`/`sanitizeInventory` correctly, and already enforces the Starter
exemption at the sanitizer level. E1's job is purely to **read** an already-correct, already-tested
field into runtime `GameState` and **write** it back out through the existing
`persistProgress`-style read-modify-write pattern — no new field, no shape change, no new
sanitizer. This is architecturally identical to how Phase 3C-3 "activated" `ownedIngredientIds`
(a field reserved since Phase 3C-2) without a schema bump, and how Phase 3C-4 activated
`missionBest` the same way — both are cited directly in `persistence.ts`'s own file header as the
precedent this exact pattern follows.

## 8. E1 exact file scope

**New:**

- `src/state/inventory.ts` — `InventoryState` type, `EMPTY_INVENTORY`, `hasStock`,
  `remainingStock` (§4). Pure, no reducer/UI import.
- `src/state/inventory.test.ts` — unit tests for the two derivations (Starter always `true`/
  `"UNLIMITED"`; finite ingredient below/at/above `alreadyUsedThisRound`; absent key reads as 0).

**Touched:**

- `src/state/gameReducer.ts`:
  - `GameState.inventory: InventoryState` (new field).
  - `ProgressionCarry` (currently `dex`/`ownedIngredientIds`/`pitzBalance`/
    `lastClaimedMissionRunId`, lines 174-179) — add `inventory`.
  - Five call sites must thread it through, all confirmed by reading the file directly (no other
    site constructs a full `GameState`/`ProgressionCarry` literal):
    `buildOrderState` (line 189, via `...carry`), `nextOrderState` (line 220),
    `nextMissionOrderState` (line 233, builds its own carry object explicitly — must add
    `inventory: state.inventory` there), `startPreparingRecipe` (line 257), and
    `createInitialGameState` (line 273, gains a fourth parameter, default `EMPTY_INVENTORY`).
  - **No other reducer case may read or write `inventory` in E1** — every other `case` must carry
    it through unchanged via `{ ...state, ... }`, same as `ownedIngredientIds` already does for
    every non-`PURCHASE_INGREDIENT` action today.
- `src/state/persistence.ts`:
  - `ProgressionSnapshot` (currently `dex`/`pitzBalance`/`ownedIngredientIds`, lines 451-455) — add
    `inventory: InventoryState`.
  - `persistProgress` — patch `inventory` into the same single read-modify-write merge, with a
    fourth "unchanged" comparison (set-equality is wrong here since values matter, not just keys —
    a plain per-key value comparison, matching `sanitizeInventory`'s own shape, is needed) added to
    the existing `dexUnchanged && pitzUnchanged && ownedUnchanged` no-op-skip guard.
  - No change to `loadSave`/`sanitizeSave`/`sanitizeInventory`/`migrateV1toV2` — all already
    correct from E0.
- `src/App.tsx`:
  - Pass `save.inventory` into `createInitialGameState` (currently called with
    `save.dex, save.ownedIngredientIds, save.pitzBalance` only, line 100).
  - Add `inventory: state.inventory` to the `persistProgress({...})` call (line 197) and its
    `useEffect` dependency array (line 202, currently `[state.dex, state.pitzBalance,
    state.ownedIngredientIds]`).
  - **No prop needs to reach `IngredientTray`/`ShopOverlay`/any component in E1** — no consumer
    exists yet; this is a round-trip-only slice.

**Tests:** see §11.

## 9. What E1 must NOT do (scope guard, confirmed against current code)

Verified none of the following exist anywhere in `src/` today, and confirmed they must stay that
way until their own slice:

- **Ingredient consumption** — no reducer case decrements `inventory`. `CONFIRM_BAKE`
  (`gameReducer.ts` line 488) still only sets `pizza`/`bakeState`/`scoringV2Result`/`score`/
  `phase`; it does not touch `inventory` and must not start to in E1.
- **Shop restock** — `purchaseIngredient` (`economy.ts`) still only returns
  `nextOwnedIngredientIds`/`nextPitzBalance`; no restock transaction exists.
- **Shop 2.0 UI** — `ShopOverlay.tsx` is unchanged from the E0-era description in §3; no quantity
  display, no restock button.
- **Shortage blocking** — `IngredientTray.tsx` still gates purely on `ownedIngredientIds.includes`
  (confirmed line 85-87); no stock-based filter.
- **Recipe locking beyond today's `isRecipeAvailable`** — unchanged.
- **Scoring / Making changes** — `gameReducer.ts`'s `CONFIRM_BAKE` now calls `computeScoringV2`
  (Scoring 2.0, authoritative since PR #60's A1 cutover) instead of the retired legacy
  `scorePizza` — this landed **after** the prior Fresh Audit but **before** this session, and does
  not change anything relevant to E1: `PizzaState.toppings`/`sauceIds`/`sauceDeposits` (the shapes
  §6's consumption-quantity derivation reads) are untouched by the cutover. Confirmed by reading
  the current `CONFIRM_BAKE` case directly. E1 does not touch scoring at all either way.

## 10. E2 consumption boundary (unchanged from the prior audit, re-verified against current code)

Confirmed still accurate on this SHA:

- **Boundary**: `CONFIRM_BAKE` (`gameReducer.ts` line 488) remains the single correct atomic
  consumption point — shared identically by FREE and Lunch Rush, sits behind all existing
  making-flow guards.
- **Open defect, unchanged, still present**: `CONFIRM_BAKE` still has **no
  `state.phase !== "BAKE"` guard** (confirmed by reading the current case body — it unconditionally
  computes and returns a new state). Harmless today only because `computeScoringV2`/`classifyBake`
  are pure/idempotent. **E2 must add this guard when wiring the decrement in**, exactly as the
  prior audit specified — this is not a new finding, but this session re-confirms the defect is
  still live on `main` and has not been incidentally fixed by PR #60/#62.
- **Consumption quantity**: derived from the committed `PizzaState`, not re-specified (§6):
  scatter = placed-piece count, sauce = binary presence.
- **Placement-time gate**: `IngredientTray` extends its existing `ownedIngredientIds.includes`
  filter with `hasStock(...)` (§4) — no new "can't bake" UI state, a finite ingredient's tile
  simply stops being offered once depleted this round.

E1 builds none of this — it only needs `hasStock`/`remainingStock` to exist as pure functions
E2 can import unchanged.

## 11. E3 Shop relationship (unchanged from the prior audit)

Shop 2.0 (not this slice, not E2 either) owns: the restock purchase transaction (credits
`inventory[id]`, parallel to how `purchaseIngredient` credits `ownedIngredientIds`, same
whole-or-nothing pure-function/single-reducer-step pattern), and its own UI (successor to
`ShopOverlay.tsx`). It depends on E2 existing first — a restock UI with nothing consuming stock yet
would sell something with no gameplay effect. E1 does not need to anticipate E3's price/quantity
decisions; `InventoryState`'s shape (§4) already accommodates a future credit the same way it
accommodates E2's future debit — both are just `inventory[id] = n`.

## 12. Tests

**E0 already covers** (unchanged, re-verified present): `persistence.test.ts`'s migration matrix
(v1→v2 owned-`onion` vs. no-`onion` backfill, v2 idempotence, malformed-root fallback, invalid-
inventory sanitization, Preview/production namespace isolation) — E1 does not need to re-test any
of this.

**E1 should add:**

- `src/state/inventory.test.ts` (new) — `hasStock`/`remainingStock` pure-function matrix: Starter
  ingredient always unlimited regardless of `inventory` contents; finite ingredient at/below/above
  `alreadyUsedThisRound`; absent key reads as 0/`"UNLIMITED"`-appropriately.
- `gameReducer.test.ts` (extend existing file, matching the file's current per-concern style,
  e.g. `gameReducer.pitzReward.test.ts`'s pattern) — carry-through matrix: `inventory` survives
  `PLAY_AGAIN`/`SELECT_RECIPE`/`RETRY_SAME_RECIPE`/`MISSION_NEXT_ORDER`/`MISSION_RESET_ORDER`
  unchanged, exactly the existing `ownedIngredientIds` carry-through tests' shape (search
  `gameReducer.test.ts` for its existing `ownedIngredientIds` assertions and mirror them 1:1 for
  `inventory`). `createInitialGameState` defaults to `EMPTY_INVENTORY` when not passed.
- `persistence.test.ts` (extend) — `persistProgress` round-trips `inventory` (write then
  `loadSave` reads it back), and the no-op-skip guard correctly treats an unchanged `inventory` as
  "nothing to write" (mirroring `dexUnchanged`/`pitzUnchanged`/`ownedUnchanged`'s existing style).
- `App.test.tsx` (extend, if it currently asserts on `save.dex`/`save.pitzBalance`/
  `save.ownedIngredientIds` hydration — confirm at implementation time) — a smoke assertion that
  `save.inventory` hydrates into initial `GameState` the same way the other three fields do.

No UI/visual test is needed — E1 has no rendered surface.

## 13. Risks

- **Low overall.** This is the same risk profile the prior audit assigned E1: "low-medium," driven
  entirely by needing to hit every `GameState`/`ProgressionCarry` construction site, not by any
  design uncertainty.
- **Mechanical-miss risk**: five `GameState`-construction sites in `gameReducer.ts`
  (§8) plus two in `App.tsx`/`persistence.ts` each. A missed site would silently reset `inventory`
  to `undefined`/default on some transition (e.g. Mission's `nextMissionOrderState`, which builds
  its `ProgressionCarry` object literal by hand rather than spreading an existing one — the one
  site most likely to be missed, since it's the only one that doesn't destructure `...carry`).
  Mitigated by the carry-through test matrix in §12 covering every transition explicitly.
- **Type-checker as a safety net**: adding a required field to `GameState`/`ProgressionCarry`
  makes `tsc -b` itself catch any missed call site (TypeScript will refuse to compile an object
  literal missing a required property) — this is a structural mitigation already present in how
  this codebase is typed, not something E1 needs to add.
- **No Human-Feel/UI regression risk** — confirmed no rendered component reads `inventory` in E1
  (§8), so there is no gameplay-visible surface for this slice to regress.
- **Test suite not independently re-run in this session.** This audit is read-only and the sandbox
  has no `node_modules` installed; `npm ci && npx vitest run` was not executed here. Confidence in
  "main is currently green" instead rests on: (a) PR #69's own CI check run on this exact SHA
  (`build`, `conclusion: success`), and (b) direct reading of every file this report cites, not on
  a locally-reproduced test count. An implementer should run the full suite before and after E1's
  change as usual; this was not a substitute for that.

## 14. Estimated Claude Code time

**Small (roughly comparable to E0's own "~1 session, well under the project's 2-3h slice
target").** E1 is mechanical carry-through of an already-fully-designed, already-persisted field
into five known reducer call sites plus one persistence read-modify-write plus two `App.tsx` call
sites, backed by a type system that will flag any missed site at compile time. No new design
decision, no UI, no consumption logic. Estimate: **under 1.5 hours** including the test matrix in
§12.

## Final verdict

**A. E1 READY — NO SCHEMA BUMP.**

- E0 (PR #56) is confirmed merged and correct; `PersistentSaveV2`'s `inventory` field is already
  shaped, sanitized, and migration-safe exactly as designed.
- The "owned vs. stock" confusion this audit was asked to check for does not exist in the current
  codebase — `ownedIngredientIds` and `inventory` are already two separate, non-conflated fields.
- The proposed `InventoryState` model (`Record<ingredientId, number>` + `hasStock`/
  `remainingStock`) from the prior Fresh Audit is re-verified against the current SHA and remains
  architecturally correct — nothing that landed since (`PR #60` Scoring 2.0 cutover, `PR #62`
  rename cleanup) changes any of the shapes this design depends on
  (`PizzaState.toppings`/`sauceIds`, `Ingredient.unlockCondition`, `ownedIngredientIds`).
- The inventory-unit-semantics question (§6) is real and unresolved in code, but it is **E2's**
  decision (the decrement formula), not a blocker for E1 (a unit-agnostic scalar store). E1 can and
  should proceed without resolving it, exactly as E0 shipped its storage field before E1 exists to
  read it.
- No new `schemaVersion` is needed: E1 reads/writes a field E0 already persists correctly.

## Report summary

- **Audited SHA**: `27818efb4876d9220e425ffe65afdc9a9288e62a` (`main`, PR #69 merge), CI green.
- **PR #56 (E0)**: confirmed MERGED, correct, not re-implemented; `inventory` field exists,
  sanitized, migration-tested, still unread by any gameplay code.
- **Current schema**: `PersistentSaveV2`, `schemaVersion: 2` — no change needed for E1.
- **Ownership/Shop model**: `ownedIngredientIds` (permanent unlock) and `inventory` (consumable
  stock) are already cleanly separated; no confusion found.
- **InventoryState design**: `Record<ingredientId, number>` + `hasStock`/`remainingStock`,
  unchanged and re-confirmed correct from the prior audit.
- **Starter/unlimited policy**: every ingredient without `unlockCondition` (13 of 14 today) is
  unconditionally, structurally unlimited; only `onion` is ever finite-stock.
- **Unit semantics**: scatter = placed-piece count, sauce = binary "used this round" — an E2
  decision, does not block E1's unit-agnostic scalar store.
- **Migration requirement**: none — v2 is sufficient.
- **E1 file scope**: `src/state/inventory.ts` (new) + `gameReducer.ts` (5 carry-through sites) +
  `persistence.ts` (`ProgressionSnapshot`/`persistProgress`) + `App.tsx` (2 call sites) + tests.
- **E2 boundary**: `CONFIRM_BAKE`, still missing its `phase !== "BAKE"` guard (unchanged defect,
  re-confirmed present) — E2's job, not E1's.
- **E3 relationship**: Shop 2.0 restock credits `inventory[id]`, depends on E2, not this slice.
- **Risks**: low; mechanical carry-through, no UI surface, type-checker catches missed sites.
- **Estimated time**: under 1.5 hours.
- **Final verdict**: **A. E1 READY — NO SCHEMA BUMP.**
