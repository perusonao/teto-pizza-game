# Teto Pizza Game — Save v2 / Inventory Fresh Audit

Audited `main` SHA: `2da3949de5bd642c709ca6ba343bc57d8101d03d` (PR #51 merge, "Issue #33 Dough D0
revalidation" — the expected/authoritative SHA for this audit).

Scope: **read-only design audit**. No production code was touched. Dough D1 (implemented in a
parallel session) was not read, reviewed, or referenced beyond confirming no Dough/Making files
exist yet on this SHA (`src/logic`/`src/state` has no `dough*`/`making*` module at time of audit).

Related: Issue #22 (roadmap SSOT), `docs/PROJECT_HANDOFF.md` (P5 — Save v2 / Inventory / Shop).
Issue #38 (Pitz reward formula) is being audited in a separate session; this report defines only
the interface boundary Economy needs, per instruction, and proposes no reward formula.

## 1. Current persistence truth

Source: `src/state/persistence.ts` (single module owning all save read/write).

- **Storage key**: `teto-pizza-save-v1` in production, `teto-pizza-preview-save-v1` under
  `VITE_PREVIEW_MODE` (Preview and production share the `perusonao.github.io` origin, so the key
  itself — not a namespaced sub-path — is what keeps a reviewer's Preview save from mixing with a
  real player's `localStorage`).
- **Schema / version**: `CURRENT_SCHEMA_VERSION = 1`. `PersistentSaveV1.schemaVersion` is a literal
  `1`, not a range.
- **Persisted fields** (`PersistentSaveV1`):
  - `dex: DexEntry[]` — `{ recipeId, discovered, bestScore, bestStars, timesMade }[]`.
  - `pitzBalance: number`.
  - `ownedIngredientIds: string[]` — permanent unlock flags, see §2 below. No quantity anywhere.
  - `missionBest: Record<string, number>` — per-mission-id BEST Mission Score.
- **Sanitize/validation behavior** — two distinct tiers, deliberately:
  - **Root shape** (`sanitizeSave`): if the parsed JSON isn't an object, `schemaVersion !== 1`, or
    `dex` isn't an array, the **entire save is discarded** and replaced with
    `createDefaultSave()`. There is no partial trust at the root level and no forward-compat path
    today — any `schemaVersion` other than exactly `1` (including a hypothetical `2`) reads back
    as if no save existed at all.
  - **Per-field, inside an otherwise-valid root** (`sanitizeDex`, `sanitizePitzBalance`,
    `sanitizeOwnedIngredientIds`, `sanitizeMissionBest`): a bad *entry* is dropped, not the whole
    save — e.g. one corrupt Dex record is skipped while every other recipe's BEST survives.
  - `sanitizeOwnedIngredientIds` **unconditionally backfills** `STARTER_INGREDIENT_IDS` into
    whatever was stored, every load — a save can never read back missing a starter ingredient.
- **What happens to old/incompatible saves**: `loadSave` never throws (no storage, storage
  read/JSON error, malformed root, or unrecognized `schemaVersion` all fall back to
  `createDefaultSave()`). This is deliberately safe (`loadSave` doc comment), but for a *version*
  bump specifically it is safe by **erasure**, not by migration — exactly the gap Save v2 must
  close.
- **What is deliberately NOT persisted**: the in-progress round (`GameState`'s
  `phase/order/recipe/pizza/makingStep/...`) is never serialized — only progression survives a
  reload. `scoringV2Shadow` is explicitly never persisted (Scoring 2.0 Shadow boundary). `Mastery`
  (`totalStars`) is deliberately not stored — always re-derived from `dex` (`src/logic/mastery.ts`).
  `persistDex`/`persistProgress` both skip the write entirely when nothing actually changed —
  partly perf, but doc'd primarily as a safety property: a mount-time write must never clobber a
  save this client doesn't fully recognize with a same-shape default.

## 2. Current ingredient ownership / recipe availability model

Source: `src/data/ingredients.ts`, `src/state/progression.ts`, `src/logic/economy.ts`.

- Three-state derivation, **not stored**: `ingredientState(ingredient, ownedIngredientIds,
  totalStars) → "LOCKED" | "AVAILABLE_TO_BUY" | "OWNED"`. No ingredient has a separate
  "unlocked" boolean anywhere — ownership (`ownedIngredientIds`) is the single source of truth.
- **Every current ingredient (all 13) is Starter Set** (`unlockCondition` absent) and therefore
  **always `OWNED`**, unconditionally, even defensively if a caller's `ownedIngredientIds` were
  stale — `ingredientState` returns `OWNED` for any ingredient with no `unlockCondition`
  regardless of the passed-in list.
  - Exactly one ingredient today (`onion`) has an `unlockCondition` (`minTotalStars: 12`) and a
    `pricePitz` (120) — it is `LOCKED` → `AVAILABLE_TO_BUY` → `OWNED` (via
    `PURCHASE_INGREDIENT`/`purchaseIngredient`).
- **A recipe is available iff every `requiredIngredients[].ingredientId` is `OWNED`**
  (`isRecipeAvailable`) — no separate per-recipe unlock flag. 6 of 7 recipes require only Starter
  ingredients and are therefore always available; only `fugazza` requires `onion`.
- **There is no stock/quantity concept anywhere in current code.** `RecipeRequirement.minCount`
  (`src/data/recipes.ts`) is a **scoring/placement threshold** — how many pieces of an ingredient
  the *finished pizza* should have for `scorePizza`/Scoring 2.0 purposes — not an inventory
  deduction. A purchase is a one-time, permanent `ownedIngredientIds` add; nothing is ever
  decremented, and nothing currently reads a "how many do I have left" value. This is the precise
  gap InventoryState (§3) fills.
- Purchase transaction (`purchaseIngredient`, `economy.ts`) is pure and whole-or-nothing: it
  returns either `{ success: true, nextOwnedIngredientIds, nextPitzBalance }` or a typed failure
  reason (`LOCKED`/`ALREADY_OWNED`/`INSUFFICIENT_FUNDS`/`NOT_FOR_SALE`) — never a partial mutation.
  `gameReducer`'s `PURCHASE_INGREDIENT` case applies the whole result in one step or returns
  `state` unchanged.

## 3. Shop (current)

Source: `src/components/ShopOverlay.tsx`.

- `SHOP_PRODUCTS = INGREDIENTS.filter(i => i.unlockCondition)` — Starter ingredients never appear
  in the Shop; they're never for sale (already owned). Today this is exactly `[onion]`.
- Renders LOCKED (with "あと★N" remaining-stars hint) / AVAILABLE_TO_BUY (price + buy button,
  disabled if `pitzBalance < price`) / OWNED ("✓ 購入済み") — no quantity UI exists because there
  is no quantity concept yet.
- `recipesUnlockedByIngredient` drives a presentational-only "buying this unlocks 🍕 Fugazza"
  preview — never used to gate anything (`isRecipeAvailable` is the only gate).

## 4. Save v2 migration — design

### Contract

- Bump `CURRENT_SCHEMA_VERSION` to `2`. Add `PersistentSaveV2` with the same four v1 fields plus
  one new field, `inventory: Record<string, number>` (§5) — a partial map, absent id ⇒ handled by
  the same "Starter ingredients are unconditionally exempt" rule §5 relies on, exactly mirroring
  how `ingredientState` already treats "no `unlockCondition`" as an unconditional `OWNED`
  override today.
- **Migration pipeline** (replaces `sanitizeSave`'s current all-or-nothing root check):
  1. Parse JSON. Anything that throws, or isn't an object → fresh `createDefaultSave()` (v2), same
     as today. This tier of failure is **not** version-specific and stays exactly as strict/safe
     as it is now — a fresh player and a save `loadSave` can't parse must both be indistinguishable
     from a brand-new player, in v1 or v2 alike.
  2. Read `schemaVersion` from the parsed object.
     - `schemaVersion === 1` **and** the rest of the v1 root shape checks out (`dex` is an array —
       same structural check `sanitizeSave` does today) → run `migrateV1toV2`: carry
       `dex`/`pitzBalance`/`ownedIngredientIds`/`missionBest` through **unchanged** (still passed
       through the existing per-field sanitizers), and set `inventory` to
       `backfillInventoryForMigratedSave(ownedIngredientIds)` (§4 "preserve legitimate
       progression" below) rather than `{}`.
     - `schemaVersion === 2` → no migration step; go straight to the (extended) per-field
       sanitizers, same tier-2 behavior as today.
     - Anything else (root not an object, `dex` not an array under a claimed v1, or an unrecognized
       `schemaVersion` — e.g. a future v3 read by this exact build) → fresh `createDefaultSave()`,
       identical to today's fallback. **This is a deliberate, unchanged safety boundary**, not a
       new gap: a build can only migrate *backward-known* versions forward; it was already unable
       to make sense of a version it doesn't recognize, v1 or v2 alike, and erasure-to-default has
       always been the agreed-safe fallback for that case (see `loadSave`'s existing doc comment).
  3. Whatever tier 2 produced is run through the (extended) per-field sanitizers exactly as today,
     producing a validated `PersistentSaveV2`.
- **Preserve legitimate existing progression**: `dex`/`pitzBalance`/`ownedIngredientIds`/
  `missionBest` are copied verbatim by the migration step, not reset — a v1→v2 migration must
  never look like a progression wipe to an existing player.
  - `backfillInventoryForMigratedSave(ownedIngredientIds)`: for every ingredient id already in
    `ownedIngredientIds` that also has an `unlockCondition` (i.e., was actually *purchased*, not
    Starter — today only `onion`), grant it a **fixed default restock quantity** (a small constant
    defined once alongside `MAX_INGREDIENT_PALETTE_SLOTS`-style constants, e.g.
    `DEFAULT_MIGRATION_RESTOCK_QTY`, exact value a Shop-2.0-adjacent implementation decision, not
    an audit-time number to invent) rather than `0`. **A player who already paid Pitz for `onion`
    must not migrate into owning an ingredient they can't currently use** — that would be exactly
    the "silent progression wipe" and "first-pizza-style dead end" this audit is required to avoid,
    just one purchase later than the literal first pizza. Starter ingredients are never written
    into `inventory` at all (§5 — they're unconditionally unlimited, migrated or not).
- **Deterministic / idempotent**: pure function of its input; migrating an already-v2 save is a
  no-op pass-through (tier 2 only); migrating the same v1 save twice yields the same v2 result both
  times (no `Date.now()`/`Math.random()` anywhere in the pipeline, matching every existing
  sanitizer's style).
- **Malformed saves fail safely**: unchanged from today — any shape that isn't a recognizable v1
  or v2 root falls back to a fresh default save, never throws, never partially applies.
- **Version handling explicit**: `schemaVersion` stays a discriminated literal per version (`1`,
  `2`, ...), the same style as today's `PersistentSaveV1.schemaVersion: 1`. Tests should assert the
  full matrix: v1→v2 migration correctness (including the `onion`-owned backfill case and the
  no-`onion` case), v2 pass-through idempotence, and every existing "malformed root" case still
  landing on a fresh default under the new pipeline.
- **Future migration extensible**: structure `migrateV1toV2` as one named step in a small ordered
  chain (`migrate = pipe(migrateV1toV2, migrateV2toV3, ...)`, entered at whatever `schemaVersion`
  the raw save actually reports) so a v3 migration later is an additive function, not a rewrite of
  this one. This audit does not need to build that scaffolding today — v1→v2 is the only step that
  exists — but the migration function should be written as a standalone, independently testable
  unit (`migrateV1toV2(v1: PersistentSaveV1): PersistentSaveV2`) from the start, not inlined into
  `sanitizeSave`, so adding a second step later doesn't require re-deriving this one.

### Files (E0)

`src/state/persistence.ts` (migration pipeline, `PersistentSaveV2`, extended sanitizers),
`src/state/persistence.test.ts` (migration matrix). No `gameReducer.ts`/`GameState` change is
required for E0 alone — E0 only needs to prove the storage layer round-trips correctly; wiring
`inventory` into live `GameState` is E1's job.

## 5. InventoryState — design

### OWNED/UNLOCKED vs. STOCK — the actual split

Current code already keeps a clean "no separate flag, single-source-of-truth" convention
(`ingredientState`'s three-state derivation, §2). InventoryState should extend that same
convention rather than introduce a parallel one:

- **OWNED/UNLOCKED** stays exactly what it is today: `ownedIngredientIds` + `unlockCondition` +
  `totalStars` → `LOCKED | AVAILABLE_TO_BUY | OWNED`. Save v2 does not change this axis at all.
- **STOCK** is new, and applies **only to ingredients that have an `unlockCondition`** (i.e., are
  ever purchasable) — every Starter ingredient (`unlockCondition` absent) is **unconditionally
  unlimited**, the same "absence ⇒ exempt from the gate" pattern `STARTER_INGREDIENT_IDS` already
  uses for ownership. This is the single design decision that makes the whole migration safe: it
  means introducing InventoryState is, by construction, a no-op for every ingredient and every
  recipe that exists in the game today (all 7 recipes require at least one of the 13 Starter
  ingredients as their *primary* requirement type; only `fugazza` additionally requires the one
  currently-finite ingredient, `onion`).

### Representation

```ts
// src/state/inventory.ts (new)
export type InventoryState = Readonly<Record<string, number>>; // ingredientId -> current stock

export const EMPTY_INVENTORY: InventoryState = {};

/** Starter ingredients are unconditionally unlimited and never appear in the stock map at
 *  all -- this mirrors ingredientState's "no unlockCondition -> always OWNED" override, and
 *  is what makes InventoryState a no-op for every ingredient that exists today. */
export function hasStock(
  ingredient: Ingredient,
  inventory: InventoryState,
  alreadyUsedThisRound: number,
): boolean {
  if (!ingredient.unlockCondition) return true; // Starter Set: unlimited
  return (inventory[ingredient.id] ?? 0) - alreadyUsedThisRound > 0;
}

export function remainingStock(
  ingredient: Ingredient,
  inventory: InventoryState,
): number | "UNLIMITED" {
  return ingredient.unlockCondition ? inventory[ingredient.id] ?? 0 : "UNLIMITED";
}
```

`ingredientId → quantity` (a flat `Record<string, number>`) fits current code better than a richer
per-ingredient object: every other ownership-adjacent structure in this codebase
(`ownedIngredientIds: string[]`, `missionBest: Record<string, number>`) is already a flat
id-keyed primitive map, not a struct array, and stock has exactly one property (a count) worth
tracking today.

- **Initial inventory**: `{}` for a fresh save (every finite ingredient starts at 0 stock, matching
  "not yet purchased" exactly as today's `ownedIngredientIds` starts as just the Starter Set) — a
  fresh player is never granted stock of an ingredient they haven't unlocked. For an existing
  (migrated) save, see §4's `backfillInventoryForMigratedSave`.
- **Maximum**: none designed here. A storage cap is explicitly out of scope for this minimal path
  — Shop 2.0 restock (E3) simply adds to stock with no ceiling, and a future cap (if ever wanted)
  is an additive constant later, not a blocker now.
- **Unlimited**: Starter ingredients, unconditionally, forever (see above) — not a per-save flag,
  a structural property of `Ingredient.unlockCondition` being absent, identical in spirit to how
  `OWNED` already works.
- **Stock increase**: only via a future Shop 2.0 restock purchase (E3) — crediting `inventory[id]
  += purchasedQty` in the same single-reducer-step, whole-or-nothing pattern
  `PURCHASE_INGREDIENT` already uses for `ownedIngredientIds`/`pitzBalance`.
- **Stock consumption**: see §6 — atomic, at `CONFIRM_BAKE`, derived from the actual committed
  `PizzaState`, for finite-stock ingredients only.
- **Insufficient-stock behavior**: by design (§6), never reachable as a bake-time failure — gated
  earlier, at placement (Tray availability), so `CONFIRM_BAKE`'s own decrement can be written as
  an unconditional, always-succeeding step (clamped at 0 defensively, matching
  `sanitizePitzBalance`'s existing clamp style, but never expected to actually clamp in practice).

## 6. First-pizza safety

**Exact bootstrap rule**: every ingredient in `STARTER_INGREDIENT_IDS` (today's 13; any current
ingredient with no `unlockCondition`) is **permanently unlimited stock**, unconditionally, forever
— not just "generously pre-stocked," but exempt from the stock check entirely (§5's `hasStock`
returns `true` unconditionally for them). InventoryState/Save v2 must never attach a finite
quantity to a Starter ingredient under any circumstance (fresh save, migrated save, or a future
bug in a migration step).

This makes the safety property hold **by construction**, not by a chosen large number that could
still theoretically run out:

- 6 of the 7 current recipes (`margherita`, `marinara`, `quattro-formaggi`, `genovese`,
  `bismarck`, `funghi`) require **only** Starter ingredients → always makeable, zero Shop
  interaction, zero risk of ever going to 0 stock, exactly matching today's actual behavior
  byte-for-byte.
- `fugazza` requires `onion`, which is **already** gated behind a Shop purchase today (pre-existing
  rule, unrelated to Save v2) — Save v2 does not newly require Shop interaction for any recipe that
  doesn't already require it. The one thing Save v2 **must** add here: §4's migration backfill and
  §3's Shop-2.0-restock (E3) must both **always** grant a nonzero initial stock alongside the
  ownership flag for a purchased ingredient — granting `OWNED` with `0` usable stock would be a
  brand-new kind of dead end (a "bought but can't use it" pizza-select lock) that doesn't exist in
  the game today and must not be introduced by this feature.

## 7. Consumption boundary

**Candidate confirmed correct: atomic consumption at `CONFIRM_BAKE`** (`src/state/gameReducer.ts`).
This is the one reducer transition that:

- computes `score`/`bakeState`/`scoringV2Shadow` from `state.pizza` (the exact canonical,
  already-committed placement/sauce state — nothing new is added or read at this point, only
  interpreted);
- is dispatched identically by FREE and Lunch Rush (`lunchRush.ts`'s own file header: "Mission is a
  thin outer wrapper around ordinary rounds... per-pizza quality scoring stays in scoring.ts
  unchanged") — so wiring consumption here needs no Mission-specific branch at all;
- already sits behind every upstream making-flow guard this audit must not re-litigate
  (`APPLY_SAUCE`/`PLACE_TOPPING`'s existing `makingStep`/ownership gates, Issue #32/#47's Human
  Feel-verified one-way flow).

**One real defect found, must be fixed as part of E2, not a new design choice**: unlike every
other phase-sensitive action in this reducer (`RESET_PIZZA`, `CONFIRM_MAKING_STEP`,
`REGISTER_TO_DEX`, `MISSION_NEXT_ORDER` all explicitly guard `state.phase`), **`CONFIRM_BAKE` has
no `state.phase !== "BAKE"` guard today**. It is harmless today only because
`scorePizza`/`classifyBake`/`computeScoringV2Shadow` are pure and idempotent — recomputing the same
score twice from the same `state.pizza` is a no-op in effect. It stops being harmless the moment a
side-effecting decrement is added inside that same case: a duplicate dispatch (a fast double-tap on
「取り出す！」 before React unmounts `BakeOverlay`, or any future stray dispatch) would double-consume
stock. **E2 must add `if (state.phase !== "BAKE") return state;` to `CONFIRM_BAKE` before or
alongside wiring consumption into it** — this closes the double-consumption risk structurally
(matching every sibling action's existing pattern) rather than via a new ad-hoc flag.

### Consumption quantity — derived, not re-specified

Per finite-stock ingredient id, the quantity consumed at a given `CONFIRM_BAKE` is derived directly
from the just-baked `PizzaState`, using its existing shape — no new "how much was used" tracking
needs to be invented:

- **scatter** ingredients (cheese/topping): `pizza.toppings.filter(t => t.ingredientId ===
  id).length` — the actual placed count, which may be more or less than the recipe's `minCount`
  (placing extra or too few is already legal and already just scores differently — "reasonable
  imperfection should remain viable" per the project's non-negotiable guards, and consumption must
  not silently re-impose a hard minCount rule placement itself never enforced).
- **spread** ingredients (sauce): `pizza.sauceIds.includes(id) ? 1 : 0` — sauce has no discrete
  placed-piece count in current data (`sauceIds`/`sauceDeposits` model *where* sauce was painted,
  not "how many units"), and every current recipe's sauce requirement is `minCount: 1`, so "used at
  all this round" is the correct and only meaningful unit for this category today.

### Requirements, addressed one by one

- **No consumption while merely placing/removing ingredients**: `APPLY_SAUCE`/`PLACE_TOPPING`
  continue to only mutate `state.pizza` (as today) — no reducer path outside `CONFIRM_BAKE` ever
  touches `inventory`. Placement instead **gates** on remaining stock (extending the existing
  ownership gate at the Tray: `IngredientTray` today only offers `ownedIngredientIds.includes`
  ingredients — extend the same filter to also require `hasStock(ingredient, inventory,
  countAlreadyPlacedThisRound(pizza, ingredient.id))`). This means a finite ingredient's tray tile
  simply stops being offered once the player has placed as many as remain in stock *this round* —
  never a bake-time surprise, never a new "can't bake" UI state to invent.
- **No double consumption**: closed by the `CONFIRM_BAKE` phase guard above.
- **RESET_PIZZA before bake does not consume**: already true structurally — `RESET_PIZZA` only ever
  runs `createEmptyPizza()` and is guarded to `phase === "PREPARE"` only; it can't reach
  `CONFIRM_BAKE`'s case, and no code path decrements `inventory` anywhere else. No reducer change
  needed for this requirement specifically — it holds by construction once consumption lives
  solely inside `CONFIRM_BAKE`.
- **Retry behavior explicit**: `PLAY_AGAIN`/`SELECT_RECIPE`/`RETRY_SAME_RECIPE` all build a fresh
  `createEmptyPizza()` round (`buildOrderState`/`startPreparingRecipe`) — the *previous* round's
  consumption (if it baked) already happened at that round's own `CONFIRM_BAKE`; starting a new
  round never re-charges or refunds anything. A round abandoned before reaching `CONFIRM_BAKE`
  (navigated away, backed out) consumes nothing, matching "no consumption while merely placing."
- **Insufficient stock cannot partially mutate state**: by the placement-time gate above, the
  finite-ingredient-insufficient case is structurally unreachable at `CONFIRM_BAKE` — a player can
  never place more of a finite ingredient than remains in stock, so the decrement at `CONFIRM_BAKE`
  always succeeds in full. (Even so, write it as a single object-spread merge exactly like every
  existing `PURCHASE_INGREDIENT`/`persistProgress` write — whole-state-or-untouched, never a
  half-applied per-ingredient loop that could leave some ids decremented and others not.)
- **Lunch Rush behavior explicitly designed**: no Mission-specific branch is needed. Each served
  pizza already goes through its own independent `CONFIRM_BAKE` (App.tsx's `handleMissionServeNext`
  dispatches `SERVE` using the score `CONFIRM_BAKE` already computed, then separately
  `MISSION_NEXT_ORDER`) — consumption happens once per served pizza, identically to FREE. If a
  finite ingredient depletes mid-run, the Tray gate (same mechanism as FREE) simply stops offering
  it for the *next* Mission order within that run; since every recipe's Starter-only requirements
  never deplete, a Mission run can never dead-end into "no makeable recipe left" — at minimum every
  Starter-only recipe stays pickable via `pickMissionOrder`'s existing `availableRecipeIds` filter.

## 8. Shop boundary (Shop 2.0 — not implemented here)

Shop 2.0 owns exactly:

- **Purchase/restock transaction**: extends today's `purchaseIngredient` pattern — Pitz debited,
  either an ownership grant (first purchase of a LOCKED→AVAILABLE_TO_BUY ingredient, exactly as
  today) or a stock credit (a repeat restock of an already-OWNED finite ingredient), computed as a
  single pure function returning a whole-or-nothing result, applied in one reducer step.
- **Price**: `Ingredient.pricePitz`, unchanged mechanism; a restock purchase may reuse the same
  field or (implementation decision, not this audit's to make) define a separate restock price —
  either way it's still "a positive integer or not for sale," same validation shape as
  `isValidPrice` today.
- **Unlock vs. stock distinction**: unlock (`ownedIngredientIds`) is a one-time, permanent,
  Mastery-gated (`totalStars`) transition, unchanged from today. Stock is a repeatable, purely
  Pitz-gated transaction against an already-OWNED ingredient — Shop 2.0 must render these as two
  distinct actions/affordances (first "仕入れ開始" unlock vs. subsequent "追加で仕入れる" restock),
  never conflate a restock tap with re-running the unlock gate.
- **Unavailable ingredients**: LOCKED rendering (remaining-stars hint) is unchanged from today's
  `ShopOverlay`.
- **Quantity display**: show current stock only for OWNED finite ingredients (the "追加で仕入れる"
  row); Starter ingredients continue to render as today's unconditioned "✓ 購入済み" with no
  quantity language at all (they have none, and showing "∞" or similar is a presentational choice
  for the eventual UI slice, not an audit deliverable).

Shop 2.0 does **not** own: consumption (that's `CONFIRM_BAKE`, §7), the Tray placement gate (that's
`IngredientTray` reading `InventoryState` directly, §7), or the reward formula (Issue #38, §9).

## 9. Interface for Economy (Issue #38)

Per instruction, this defines only the boundary Economy needs — no reward formula, no competing
design with the parallel Issue #38 audit.

- **Current balance**: `state.pitzBalance: number` — already exists, unchanged shape.
- **Purchase debit**: the existing `purchaseIngredient`-style pure transaction (§2/§8) — Economy
  never computes a debit itself; it only needs `pitzBalance` to read from and the existing
  `PURCHASE_INGREDIENT`-style single-reducer-step contract to apply against.
- **Inventory credit**: a parallel, equally pure "restock" transaction (§8) that credits
  `inventory[id]` the same way `purchaseIngredient` credits `ownedIngredientIds` — Economy (Issue
  #38) needs no involvement in *how* stock is credited, only that a Mission/Shop credit path exists
  and is atomic.
- **Atomicity requirement**: every credit or debit against `pitzBalance`/`ownedIngredientIds`/
  `inventory` must be a single reducer step, whole-state-or-unchanged — identical to the existing
  `PURCHASE_INGREDIENT` and `CLAIM_MISSION_REWARD` cases today. Save v2/InventoryState introduces
  no new atomicity model; Issue #38's reward formula, whatever it computes, plugs into the same
  `CLAIM_MISSION_REWARD`-style idempotent-per-run grant this codebase already has, unmodified.

## 10. Recommended implementation slices

Recommended sequence: **E0 → E1 → E2 → E3** (Save v2 migration → InventoryState → consumption →
Shop restock). This matches `docs/PROJECT_HANDOFF.md` P5's items 1-2, but **reorders items 3/4**:
P5 lists "Restock / Shop purchasing" before "Atomic material consumption" as scope bullets, not a
strict build order; this audit recommends building consumption (E2) *before* Shop restock (E3)
because Starter-ingredient-unlimited (§5/§6) makes E2 a zero-visible-impact change on its own (every
existing recipe still uses only unlimited ingredients, so no Human Feel regression risk), and it
lets E2 be validated end-to-end against the one ingredient that already exists with an
`unlockCondition` (`onion`) using a fixed test-only stock grant, in isolation from E3's new Shop UI
risk. A Shop 2.0 restock UI shipped before anything ever consumes stock would be a shop that visibly
sells something with no gameplay effect yet — worse sequencing, not safer.

### E0 — Save v2 migration

- **Responsibility**: schema bump to v2, `migrateV1toV2`, extended sanitizers, no gameplay change.
- **Files**: `src/state/persistence.ts`, `src/state/persistence.test.ts`.
- **Tests**: v1→v2 migration (owned-`onion` backfill case + no-`onion` case), v2 idempotence,
  malformed-root fallback matrix (unchanged cases + a new "unrecognized future version" case).
- **Dependency**: none.
- **Risk**: low — pure data-layer extension of an already well-factored, already-tested module;
  no `GameState`/reducer/UI change.
- **Effort**: small (~1 session, well under the project's 2-3h slice target).

### E1 — InventoryState

- **Responsibility**: `src/state/inventory.ts` (or equivalent) — the `Record<string, number>`
  model, `hasStock`/`remainingStock` derivations, and carrying `inventory` through `GameState` the
  same way `ownedIngredientIds` already is (added to `ProgressionSnapshot`, `buildOrderState`,
  `persistProgress`/`loadSave` wiring). No consumption or Shop UI yet — this slice only proves the
  model round-trips through App.tsx/gameReducer.ts exactly like `ownedIngredientIds` does today.
- **Files**: new `src/state/inventory.ts` (+ test), `src/state/gameReducer.ts` (add `stock`/
  `inventory` field + carry-through), `src/state/persistence.ts` (read the E0 field into
  `ProgressionSnapshot`), `App.tsx` (pass `inventory` through the same way `ownedIngredientIds` is
  passed today).
- **Tests**: `inventory.test.ts` (pure derivations), a `gameReducer` carry-through test (survives
  `PLAY_AGAIN`/`SELECT_RECIPE`/`RETRY_SAME_RECIPE` unchanged, same as `ownedIngredientIds` today).
- **Dependency**: E0 (needs the persisted field to hydrate from; can stub a local default without
  it, but shouldn't ship ahead of the schema that backs it).
- **Risk**: low-medium — touches `GameState`'s shape, so every existing carry-through call site
  (`buildOrderState`, `startPreparingRecipe`, `nextMissionOrderState`, `createInitialGameState`)
  needs the new field threaded through consistently; mechanical but must not miss a site.
- **Effort**: small-medium.

### E2 — Consumption at CONFIRM_BAKE

- **Responsibility**: the `CONFIRM_BAKE` phase guard fix (§7) + the actual decrement (derived from
  `PizzaState` per §7) + the `IngredientTray` placement-time stock gate (§7).
- **Files**: `src/state/gameReducer.ts` (`CONFIRM_BAKE` guard + decrement, `APPLY_SAUCE`/
  `PLACE_TOPPING` stock gate alongside the existing ownership gate), `src/components/
  IngredientTray.tsx` (hide/disable zero-remaining finite ingredients), tests.
- **Tests**: `gameReducer` consumption unit tests (scatter count, sauce presence, no-op for
  Starter ingredients, double-`CONFIRM_BAKE`-dispatch no-op via the new guard), an `IngredientTray`
  stock-gating test, a Lunch Rush multi-round depletion test (using a fixed test-only `onion`
  stock grant, since E3 doesn't exist yet to grant one for real).
- **Dependency**: E1.
- **Risk**: medium — the only slice touching the core making-flow reducer paths this project has
  repeatedly fresh-audited for Human Feel (Issue #32, #47); must not regress the one-way flow guard
  or reset/stale-pointer safety already locked in there. Mitigated by the "Starter-unlimited"
  design making this a no-op for every existing recipe.
- **Effort**: medium (~2-3h, the project's preferred slice size).

### E3 — Shop 2.0 restock

- **Responsibility**: the restock purchase transaction (§8/§9) and its UI (successor to
  `ShopOverlay.tsx`), applying the approved rustic visual direction only once the purchase loop is
  functional (per `PROJECT_HANDOFF.md`'s existing instruction).
- **Files**: `src/logic/economy.ts` (restock transaction), `src/state/gameReducer.ts` (new/extended
  purchase action crediting `inventory`), `src/components/ShopOverlay.tsx` (or its redesign).
- **Tests**: restock transaction unit tests (atomicity, price gating), Shop UI stock-display tests.
- **Dependency**: E2 (restock has no gameplay effect without a consumer already wired).
- **Risk**: medium — new UI + visual-direction work, gated by this project's own Preview/Human
  Feel workflow (not audit-only, unlike E0-E2 which could ship without a dedicated Preview pass if
  kept invisible).
- **Effort**: medium.

## 11. Scope guard confirmation

This audit did not read, review, or propose changes to: Dough/Making gesture code (none exists yet
on the audited SHA), Scoring authority (`scoring.ts`/`scoringV2/*` untouched, Scoring 2.0 remains
non-authoritative per existing gate), the Pitz reward formula (`calculateMissionReward` — Issue
#38's own scope), `recipes.ts` data, Reference (`referencePizza.ts`/`playerReference.ts`), or any
visual/CSS redesign. No production code was modified — this report and any `PROJECT_HANDOFF.md`/
Issue #22 synchronization are the only changes in this PR.

## Final verdict

**B. READY WITH MINOR DESIGN DECISIONS.**

No architectural blocker was found. The persistence layer's existing sanitize/version pattern
extends cleanly to a real migration; the ownership model's existing "no `unlockCondition` ⇒
unconditionally exempt" convention extends cleanly to make Starter ingredients unconditionally
unlimited stock, which is what makes first-pizza safety hold by construction rather than by a
chosen buffer number; and `CONFIRM_BAKE` is confirmed the correct, already-shared-by-FREE-and-
Mission consumption boundary, modulo one concrete, well-understood defect (missing phase guard)
that must be fixed as part of wiring consumption in, not a new design question.

Remaining **minor** decisions left to implementation time (deliberately not resolved here, per the
instruction to keep this audit minimal and not pre-empt Shop 2.0/Issue #38 specifics):

- The exact `DEFAULT_MIGRATION_RESTOCK_QTY` constant for §4's owned-`onion` migration backfill.
- Whether a future restock purchase uses `Ingredient.pricePitz` as-is or a separate restock price
  field — not needed until E3.
- Exact Shop 2.0 quantity-per-purchase and any future storage cap (explicitly deferred, §5).

## Report summary

- **Audited main SHA**: `2da3949de5bd642c709ca6ba343bc57d8101d03d`.
- **PR**: this audit's own docs-only PR (see PR description).
- **Current persistence truth**: §1 — `teto-pizza-save-v1`, `schemaVersion: 1`, no migration path
  today (unrecognized version ⇒ full erasure to default).
- **Migration contract**: §4 — versioned pipeline, v1 fields copied verbatim, `inventory` backfilled
  (never zeroed) for already-purchased ingredients, idempotent, extensible chain.
- **InventoryState contract**: §5 — `Record<ingredientId, number>`, Starter ingredients
  unconditionally exempt/unlimited, stock increases only via Shop 2.0, decreases only at
  `CONFIRM_BAKE`.
- **First-pizza safety rule**: §6 — Starter ingredients permanently unlimited by construction; no
  recipe that doesn't already require a Shop purchase today will ever require one under Save v2.
- **Consumption boundary**: §7 — `CONFIRM_BAKE`, confirmed correct, requires adding the missing
  `state.phase !== "BAKE"` guard as part of E2; quantity derived from the committed `PizzaState`
  (scatter count / sauce presence), never re-specified as a separate tracked value.
- **Recommended PR sequence**: §10 — E0 Save v2 migration → E1 InventoryState → E2 consumption → E3
  Shop restock (consumption ordered before restock, a refinement over `PROJECT_HANDOFF.md` P5's
  scope-bullet order, not a contradiction of it).
- **Risks**: §10 per-slice; the only medium-risk slice is E2 (core making-flow reducer paths), and
  its risk is bounded by the Starter-unlimited design making it a no-op for every existing recipe.
- **Exact next implementation recommendation**: proceed with **E0 (Save v2 migration)** as the next
  Claude Code implementation task for this track — it is the only slice with zero dependency on
  anything not yet built, and every later slice depends on its schema existing first.
