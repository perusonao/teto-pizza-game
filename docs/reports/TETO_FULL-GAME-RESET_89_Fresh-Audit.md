# Full Game Reset / はじめから — Issue #89 Fresh Pre-Implementation Audit

- **Audited `main` SHA:** `2ae37f1e022acb9fcf4bac644e38bd00fb1ff5f7` ("Human Feel Tuning 1A: clarify
  insufficient sauce guidance (#103)") — confirmed via `git fetch origin && git rev-parse origin/main`
  at session start.
- **Branch:** `claude/teto-pizza-reset-audit-w5pdem` (fast-forwarded to the SHA above; no production
  code touched).
- **Scope:** READ-ONLY audit. No production code changed. No save schema changed. No PR opened.
  Issue #89 not edited.

---

## 0. Fresh GitHub / Duplicate Gate

- `git fetch origin` pulled ~20 new branches; none is a reset/save/new-game/delete-data audit or
  implementation branch other than this session's own `claude/teto-pizza-reset-audit-w5pdem`.
- **Issue #89** (open, updated `2026-09-19T16:15:39Z`): "Full Game Reset / はじめから — reset all
  local progression safely." Body supersedes an earlier Dex-only reset proposal; requires one
  confirmation-gated action that clears local progression and recreates state through the same
  canonical initialization path a true first launch uses ("prefer clearing the save and invoking
  canonical initialization over manually zeroing individual fields"). Explicitly separates local
  reset from #87's future Firebase leaderboard. No comments on the issue.
- **Open PRs** (4 total, none targeting #89 or reset/save work): #72 (docs status fix), #46 (Dough
  Shaping D0 audit), #34 (Issue #32 reference visuals), #3 (old Phase 2 docs). None overlaps this task.
- **Open issues** (14 total): #104 (dev automation), #89 (this one), #88 (Pizza Select pager UX),
  #87 (Lunch Rush Online Ranking — Firebase, tracked separately per #89's own text), #47/#39/#38/#37/
  #33/#32/#30/#27/#24/#22 — none is a competing reset/save-wipe effort.
- **No duplicate audit report** exists under `docs/reports/` (checked for `*reset*`/`*89*`).
- **Verdict: no duplicate in-flight work. Proceeding.**

---

## 1. Baseline

Dependencies were not yet installed in this fresh session (`npm install` run once, 124 packages,
0 vulnerabilities). All checks below ran clean on SHA `2ae37f1e0`:

```
npx vitest run
  Test Files  81 passed (81)
       Tests  1604 passed (1604)

npx tsc -b        # clean, no output
npx oxlint        # clean, no output
npm run build     # tsc -b && vite build — ✓ built in 487ms
```

No production file was modified to reach this baseline (only `node_modules` was populated).

---

## 2. Persistence Fresh Inventory

**One storage mechanism, one key, no others exist.** Grepped the whole `src/` tree for
`localStorage`/`sessionStorage`/`indexedDB`/`STORAGE_KEY`: every non-test hit is
`src/state/persistence.ts`; every other hit is a test file seeding/clearing `window.localStorage`
directly for test setup. No `sessionStorage`, no `IndexedDB`, no second storage key, no
settings/preferences storage of any kind exists anywhere in the codebase today.

- **Storage key:** `SAVE_STORAGE_KEY` = `"teto-pizza-save-v1"` (production) or
  `"teto-pizza-preview-save-v1"` (`VITE_PREVIEW_MODE` build) — origin-scoped separation between
  production and the shared Preview deployment, unrelated to reset.
- **Schema:** `PersistentSaveV2`, `schemaVersion: 2` (bumped once, at Save v2/E0; EP4's
  `starterGrantClaimedRecipeIds` field was added to v2's shape *without* a further version bump,
  per that task's own explicit no-bump decision).
- **Write paths:** `persistDex`, `persistProgress` (the canonical GameState-fields writer, used by
  App.tsx for every dex/pitz/owned/inventory/starterGrant change), `persistMissionBest` — all in
  `src/state/persistence.ts`, all read-modify-write against the *same* single key, all swallow
  storage errors (quota/disabled), all skip no-op writes.
- **Read path:** `loadSave()` — parses JSON, migrates v1→v2 if needed (`toIntermediateV2`/
  `migrateV1toV2`), then runs every field through a dedicated per-field sanitizer
  (`sanitizeDex`/`sanitizePitzBalance`/`sanitizeOwnedIngredientIds`/`sanitizeMissionBest`/
  `sanitizeInventory`/`sanitizeStarterGrantClaimedRecipeIds`). Never throws — any failure (no
  storage, malformed JSON, unrecognized root shape, unrecognized `schemaVersion`) falls back to
  `createDefaultSave()`.
- **Already-existing reset primitive:** `clearSave(storage)` (persistence.ts:615) —
  `storage.removeItem(SAVE_STORAGE_KEY)`, swallows errors, already has its own test coverage
  (`persistence.test.ts` `describe("clearSave", ...)`). **Not called from any production code path
  today** — its own doc comment says it was "kept for tests and future dev/reset use ... Phase 3C-2
  does not add a user-facing Reset UI (out of scope)." This is exactly the primitive #89 needs.

### Persisted State Inventory

| State | Storage location/key | Default (fresh) | How initialized | How mutated | Reset? | Reason |
|---|---|---|---|---|---|---|
| `schemaVersion` | `PersistentSaveV2.schemaVersion` | `2` | `createDefaultSave()` | never (constant) | A (implicit) | Not real progression; always `2` on any write. |
| `dex` (discovered/bestScore/bestStars/timesMade per recipe) | `PersistentSaveV2.dex` | `[]` | `createDefaultSave()` | `registerScoreToDex` via `REGISTER_TO_DEX` | **A. RESET** | Core progression (issue explicitly lists Dex/BEST/timesMade). |
| `pitzBalance` | `PersistentSaveV2.pitzBalance` | `0` | `createDefaultSave()` | Mission reward claim, purchases, restocks | **A. RESET** | Core economy (issue explicitly lists Pitz). |
| `ownedIngredientIds` | `PersistentSaveV2.ownedIngredientIds` | `[...STARTER_INGREDIENT_IDS]` (`tomato-sauce`,`mozzarella`,`basil`) | `createDefaultSave()` | `PURCHASE_INGREDIENT`, `applyStarterGrants` | **A. RESET** | Core progression (owned-ingredient state). |
| `inventory` (finite stock per non-Starter ingredient) | `PersistentSaveV2.inventory` | `{}` | `createDefaultSave()` | `consumePizzaInventory` (CONFIRM_BAKE), `restockIngredient`, `applyStarterGrants` | **A. RESET** | Core economy (finite inventory). |
| `starterGrantClaimedRecipeIds` | `PersistentSaveV2.starterGrantClaimedRecipeIds` | `[]` | `createDefaultSave()` | `applyStarterGrants` (exactly-once ledger) | **A. RESET** | Must reset atomically with `inventory`/`ownedIngredientIds` — see §6. |
| `missionBest` (Lunch Rush BEST score) | `PersistentSaveV2.missionBest` | `{}` | `createDefaultSave()` | `persistMissionBest` (monotonic, never-decreasing) | **A. RESET** | Issue explicitly lists local Lunch Rush/mission records. |
| In-progress round (`phase`/`order`/`pizza`/`makingStep`/...) | none — `GameState`, in-memory only | n/a | `createInitialGameState` | `gameReducer` | D. NOT PERSISTED | Never serialized (persistence.ts's own header comment: "the round in progress never persists"). |
| Mission run state (`mode`/`clock`/`metrics`/`runId`) | none — `App.tsx` `useReducer(missionRunReducer, INITIAL_MISSION_STATE)`, in-memory only | n/a | `INITIAL_MISSION_STATE` | `missionRunReducer` | D. NOT PERSISTED | Only the derived `missionBest` is persisted, never the live run. |
| Settings (volume/BGM/SE/accessibility/language/tutorial) | **none exist** | n/a | n/a | n/a | D. NOT PERSISTED | No Settings screen exists yet — HOME's ⚙️ button is `disabled`, tooltip "設定は近日公開" (`HomeScreen.tsx`). Nothing to reset or keep today. |
| Build/version info | none persisted | n/a | n/a | n/a | D. NOT PERSISTED | Not tracked in save; `schemaVersion` is the only versioning concept. |

**No field exists today that would fall into category B (KEEP) or C (Product Decision Required) —**
every currently-persisted field is unconditionally game progression, and every currently-existing
non-progression concept (settings, tutorial) is not persisted at all yet. This significantly
simplifies #89: **there is no split logic to implement today.** §12 still records the forward-looking
product decision for when a Settings screen ships.

---

## 3. Fresh Player Canonical State — where it's actually generated

The canonical fresh-player state is **not a separate "reset" construction** — it is the same code
path a genuine first launch already runs, driven by two functions plus one load-time catch-up call:

1. **`createDefaultSave()`** (`persistence.ts:322`) — the canonical fresh `PersistentSaveV2`:
   `{ schemaVersion: 2, dex: [], pitzBalance: 0, ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
   missionBest: {}, inventory: {}, starterGrantClaimedRecipeIds: [] }`. This is what `loadSave()`
   returns whenever storage is empty, unreadable, or unrecognized — i.e. **exactly what a first
   launch and a cleared save both produce, by construction, no special-casing needed.**

2. **`createInitialGameState(dex, ownedIngredientIds, pitzBalance, inventory,
   starterGrantClaimedRecipeIds)`** (`gameReducer.ts:403`) — every parameter defaults to the fresh
   value (`EMPTY_DEX`, `STARTER_INGREDIENT_IDS`, `0`, `EMPTY_INVENTORY`, `[]`). Builds the in-memory
   `GameState` via `nextOrderState(..., { preferFirst: true })`, which is what makes Margherita the
   round the player lands on first (see §7).

3. **App.tsx's mount-time lazy initializer** (`App.tsx:101-128`, `useReducer(gameReducer, undefined,
   () => {...})`) is the **one call site** that wires 1+2 together for every real app load, fresh or
   returning:
   ```ts
   const save = loadSave();
   const grant = applyStarterGrants(save.dex, save.ownedIngredientIds, save.inventory,
                                     save.starterGrantClaimedRecipeIds);
   return createInitialGameState(save.dex, grant.ownedIngredientIds, save.pitzBalance,
                                  grant.inventory, grant.claimedRecipeIds);
   ```
   For a fresh/cleared save, `save.dex` is `[]`, so `applyStarterGrants` finds no unlocked recipe
   and returns its inputs back unchanged (its own documented no-op fast path) — the grant call is
   inert for a fresh player, but running it unconditionally is what makes this **the same exact
   function call for both a true first launch and a post-reset reload.**

**Consequence for #89's architecture (see §13): there is no second "fresh state" implementation to
build or keep in sync.** `createDefaultSave()` + this mount-time initializer already *is* the
canonical fresh-player path. A reset that clears storage and reloads the app runs through this exact
same code, by construction — not a re-implementation of it.

### Confirmed starter values (from `src/data/ingredients.ts`, `src/data/recipes.ts`, `src/state/gameReducer.ts`)

- **Unlimited (Starter) ingredients:** exactly `tomato-sauce`, `mozzarella`, `basil` —
  `STARTER_INGREDIENT_IDS` is *derived*, not hand-listed: `INGREDIENTS.filter(i =>
  !i.unlockCondition)`. Every other ingredient (13 of 16 total) now carries an `unlockCondition`
  and `starterGrantOnly: true` (Economy & Progression 1.0 EP4) — first-owned only via a recipe's
  Starter Grant, never unconditionally owned.
- **Starting Pitz:** `0`.
- **Starting inventory:** `{}` (empty — no finite ingredient is owned yet, so none has stock).
- **Starting recipe:** Margherita only (`unlockCondition` absent — "Start recipe... always
  unlocked", `recipes.ts:66`). All 10 other recipes chain-gate on `requiresRecipeId` +
  `minTotalStars`, both derived purely from `dex` (`recipeUnlocked`, `progression.ts:50`) — with
  `dex: []`, `totalStars(dex) === 0` and nothing is discovered, so every chained recipe is locked.
- **Starter Grant claimed ledger:** `[]` — nothing claimed yet.

This is **not** "everything zeroed" — it is a specific, asymmetric starting basket (3 unlimited
ingredients, 1 available recipe, 0 Pitz, 0 finite inventory) that already exists in code and must be
reproduced exactly, not approximated.

---

## 4. Reset Scope Matrix

| Category | Fields |
|---|---|
| **A. RESET** | `dex`, `pitzBalance`, `ownedIngredientIds`, `inventory`, `starterGrantClaimedRecipeIds`, `missionBest` — i.e. all six fields of `PersistentSaveV2`. |
| **B. KEEP** | *(none exist today — no settings/preference persistence has been built yet; see §2, §12.)* |
| **C. PRODUCT DECISION REQUIRED** | *(none today; forward-looking note in §12 for when Settings ships — specifically whether a future tutorial/onboarding-completion flag should RESET or KEEP.)* |
| **D. NOT PERSISTED** | In-round `GameState` (phase/order/pizza/makingStep/...), live Mission run state (`mode`/`clock`/`metrics`/`runId`), all App-level UI `useState` (screen, overlay open/closed, drag/gesture transients — see §13). |

Because every persisted field is category A, **"reset everything the save currently holds" and
"clear the one storage key" are the same operation today.** This is a favorable, low-risk starting
condition for #89, not a coincidence to design around — it's a direct consequence of this codebase
never having shipped non-progression persistence yet.

---

## 5. Starter State Verification

Confirmed directly from `src/data/ingredients.ts`/`src/data/recipes.ts`/`src/state/gameReducer.ts`
(not inferred): see §3's "Confirmed starter values." Reset must reproduce this *exact* basket
(3 unlimited ingredients tied to Margherita, 0 Pitz, empty finite inventory, Margherita-only
availability) — not a blanket zero-out, matching the issue's own explicit instruction.

---

## 6. Starter Grant Safety

`applyStarterGrants` (`starterStock.ts:110`) is the **one** function that ever moves a recipe from
"unlocked, ungranted" to "owns its finite ingredients with stock" — and it already has the exact
atomicity property #89 needs, because it always writes `inventory`, `ownedIngredientIds`, and
`starterGrantClaimedRecipeIds` from the **same transaction**:

- It reads `claimedRecipeIds` as the *sole* gate ("only the latter gates this function" — its own
  doc comment) — `recipeUnlocked` being true again after a reset is irrelevant once a recipe id is
  in the ledger. Since reset clears `starterGrantClaimedRecipeIds` to `[]` *and* `dex` to `[]` *and*
  `inventory`/`ownedIngredientIds` to their fresh values *in the same single-key write*
  (`clearSave()` removes the whole `PersistentSaveV2` object at once — see §14), **all three of the
  failure modes the audit brief calls out are structurally impossible from a single atomic clear**:
  - **A (inventory gone, claimed stays true → grant lost forever):** impossible — `clearSave()`
    can't partially clear one field of one JSON blob; `removeItem` deletes the whole key.
  - **B (claimed gone, inventory stays → duplicate grant):** same reasoning — inventory and the
    ledger live in the same object, cleared together.
  - **C (unlock gone, inventory/ownership stays → unfair head start):** `ownedIngredientIds` resets
    to exactly `STARTER_INGREDIENT_IDS` and `inventory` to `{}` in the same clear; there is no
    partial-field write path in `persistProgress`/`persistDex`/`persistMissionBest` that could leave
    one of these three fields stale while the others reset (every one of those writers reads
    `loadSave()` fresh and writes the *entire* `PersistentSaveV2` object back, never a sub-key).
- After reset, on the very next load, `applyStarterGrants(dex: [], STARTER_INGREDIENT_IDS, {}, [])`
  is a true no-op (no recipe unlocked, since `dex` is empty) — margherita is exempt from grants
  entirely (`STARTER_GRANT_EXEMPT_RECIPE_ID`), so the player correctly starts with **zero** Starter
  Grant activity, exactly like a true first launch.
- **Acceptance-relevant:** re-unlocking a recipe post-reset (e.g. playing Margherita enough to
  discover `funghi`) must trigger a **fresh** Starter Grant for it, since `starterGrantClaimedRecipeIds`
  is empty again — verified by inspection of `applyStarterGrants`'s gate logic (claimed-ledger only,
  no other memory of "was this ever granted before the reset"). See test M in §19.

**Conclusion: Starter Grant safety is a property of "clear the single storage key atomically," not
something a reset feature needs to build new logic for.** The existing `PersistentSaveV2` design
(one object, one key, whole-object read-modify-write) already gives this for free.

---

## 7. Recipe Progression Safety

All 11 recipes and their unlock chain, read directly from `src/data/recipes.ts`:

| Recipe | `unlockCondition` |
|---|---|
| `margherita` | none — always unlocked |
| `funghi` | `requiresRecipeId: "margherita"` |
| `marinara` | `requiresRecipeId: "funghi"` |
| `bismarck` | `requiresRecipeId: "marinara"` |
| `genovese` | `requiresRecipeId: "bismarck"` |
| `quattro-formaggi` | `requiresRecipeId: "genovese", minTotalStars: 8` |
| `fugazza` | `requiresRecipeId: "quattro-formaggi", minTotalStars: 12` |
| `salsiccia` | `requiresRecipeId: "fugazza", minTotalStars: 16` |
| `pepperoni` | `requiresRecipeId: "salsiccia", minTotalStars: 20` |
| `napoletana` | `requiresRecipeId: "pepperoni", minTotalStars: 24` |
| `tonno-e-cipolla` | `requiresRecipeId: "napoletana", minTotalStars: 28` |

`recipeUnlocked` (`progression.ts:50`) is purely `f(dex)`: `requiresRecipeId` checks
`isDiscovered(dex, ...)`, `minTotalStars` checks `totalStars(dex) >= N`. With `dex: []`,
`totalStars === 0` and nothing discovered → **only `margherita` is unlocked immediately after
reset**, confirmed from the actual unlock predicate, not inferred. `isRecipeAvailable` additionally
requires every required ingredient OWNED (`ingredientsOwned`) — Margherita's three ingredients are
Starter/always-owned, so it's also immediately playable, not just "unlocked."

`fugazza` additionally has a `mysteryLock`-style Pizza Select treatment (per its own doc comment,
"the one deliberate 'big reveal' of Chapter 1") — this is Dex-driven UI state, not separately
persisted, so it resets correctly for free once `dex` is empty.

**Acceptance criteria (matches §19 L/M):** post-reset, only Margherita is selectable/playable, and
this must survive a reload (it will, trivially — `dex` is empty in storage either way).

---

## 8. Dex / Record Reset

`DexEntry` (`dex.ts:13`): `{ recipeId, discovered, bestScore, bestStars, timesMade }` — one entry
per *discovered* recipe (no entry at all for an undiscovered recipe, rather than a zeroed entry).
`registerScoreToDex` is the only writer; `bestScore`/`bestStars` only move up ("BEST never goes
down"), `timesMade` increments every completed round regardless of score.

There is no separate "FAILED" record — `discovered`/BEST/`timesMade` are all written together at
`REGISTER_TO_DEX`, gated on the Completion Gate (`FAILED` pizzas don't reach this dispatch per
`GameState.completionResult`'s own doc comment, not audited further here as out of #89's scope).

Post-reset: `dex: []` means `getDexEntry`/`isDiscovered`/`discoveredRecipeIds` all read back exactly
as a true first launch (no entries, nothing discovered) — verified from the functions' own
implementations, not assumed.

---

## 9. Economy Reset

- **Pitz:** `pitzBalance: 0` post-reset (§3).
- **Ingredient stock:** `inventory: {}` — every finite ingredient reads `remainingStock() === 0`
  (`inventory.ts:40`, absent key convention).
- **Owned ingredients:** exactly `STARTER_INGREDIENT_IDS` (3 ids).
- **Shop state:** `ShopOverlay`/`purchaseIngredient`/`restockIngredient` (`logic/economy.ts`) are
  pure functions of `ownedIngredientIds`/`inventory`/`pitzBalance` — no independent Shop-only
  persisted state exists (not audited line-by-line beyond confirming no extra storage key exists,
  per §2's exhaustive grep).
- **Starter Grant:** `starterGrantClaimedRecipeIds: []` (§6).

All four match a true first launch's economy exactly, by the same "one object, one key" argument
as §6.

---

## 10. Lunch Rush / Mission

- **Persisted:** only `missionBest[LUNCH_RUSH_MISSION_ID]` (a single monotonic BEST score), inside
  the same `PersistentSaveV2` object, written by `persistMissionBest` (`persistence.ts:591`),
  read by `loadMissionBest`.
- **Not persisted:** the live `MissionState` (`mode`/`clock`/`metrics`/`runId`) — `App.tsx`'s
  `useReducer(missionRunReducer, INITIAL_MISSION_STATE)` is purely in-memory, reset on every reload
  regardless of #89.
- **Issue #87 (Firebase Online Ranking, Phase 0) separation:** confirmed no Firebase
  SDK/dependency/config exists anywhere in this repo today (`package.json` has no `firebase`
  dependency; no `firebase*.ts`/config files found). #87 is tracked entirely separately and has not
  landed any code yet. **This audit's recommendation (§11, §13) is that Full Local Reset must only
  ever call `clearSave()` against `SAVE_STORAGE_KEY` — it has no way to reach, and must never be
  designed to reach, any future server-side identity/leaderboard record.** Local reset is
  local-only by construction (one `localStorage` key), which already satisfies the issue's own
  requirement that this not be assumed to delete server-side data.

---

## 11. Anonymous Firebase Future Compatibility

No Firebase code exists in this repo yet (verified: no `firebase` in `package.json` dependencies,
no Firebase config/SDK files anywhere under `src/`) — this audit does not pretend otherwise.

**Forward-looking design note (not a requirement of today's implementation):** when a future
anonymous Firebase `uid` is introduced (per #87), Full Game Reset should be scoped to
`clearSave()`-equivalent operations against local `PersistentSaveV2` state only, and must **not**
call any Firebase Auth sign-out/delete-identity API. This keeps "local progression reset" and
"leaderboard identity" as two independently-designed concerns from day one of #87's own
implementation, exactly as #89's issue body already states. No code or design commitment is made
here beyond recording this as the expected direction for whichever session implements #87's
identity model.

---

## 12. Settings Classification

**Nothing to classify yet — confirmed no settings are persisted anywhere in this codebase (§2).**
The HOME screen's ⚙️ button is `disabled`/`aria-disabled="true"`, tooltip "設定は近日公開" ("Settings
coming soon") — `HomeScreen.tsx`'s own doc comment: "there is no settings screen to open yet."

**Product Decision (forward-looking, recorded for whichever task ships Settings):** when
volume/BGM/SE/accessibility/language preferences are eventually persisted, they should default to
**KEEP** on Full Game Reset (pure UI/accessibility preference, not game progression) — matching
#89's own "原則：ゲーム進行ではないユーザー設定はKEEP候補" guidance. **Tutorial/onboarding-completion
state, if/when it exists, is flagged by #89 itself as a plausible RESET exception** ("はじめから"
implies re-experiencing onboarding) — this remains an explicit open product decision for that future
task, not resolved here since no such flag exists yet to decide about.

---

## 13. Reset Implementation Architecture

| Option | Description | Correctness | Future-schema compat | Atomicity | Testability | Forgotten-field risk |
|---|---|---|---|---|---|---|
| **A. Manual per-field reset** | Reducer/UI code sets each of 6 save fields to its default individually. | Error-prone — must be kept in sync with `PersistentSaveV2` by hand. | **Bad** — every future field needs a matching manual reset line added at the same time it's added to the schema. | Only atomic if wrapped in one write, but still requires hand-listing every field. | Needs its own "does this match `createDefaultSave()`" test, duplicating logic. | **High** — exactly the failure mode #89's own issue text explicitly warns against. |
| **B. Clear storage key → reload → canonical init runs naturally** | Call `clearSave()` (already exists, already tested), then force a full app reload (`window.location.reload()` or equivalent). | **Best** — reuses `loadSave()`'s existing "no data → `createDefaultSave()`" fallback and App.tsx's existing mount-time `createInitialGameState`/`applyStarterGrants` call, both already exercised by every real first-launch player. | **Best** — a reset never needs to know the save shape at all; whatever `createDefaultSave()`/`loadSave()`'s fallback produces *is* correct by definition, automatically, for every current and future field. | `clearSave()`'s `removeItem` is a single atomic storage op; the reload guarantees no stale in-memory App/Mission/UI state survives (see below). | Trivial — assert `localStorage.getItem(SAVE_STORAGE_KEY) === null` before reload, and that post-reload state equals a true fresh session's state. | **None** — no field list to maintain; a schema change never needs a matching reset-code change. |
| **C. In-app `RESET_GAME` reducer action, no reload** | Dispatch an action that calls `createInitialGameState()` defaults directly into `GameState`, plus `clearSave()` for storage. | Correct for `GameState` itself, but **App.tsx owns 10+ other `useState`/`useReducer` hooks** not part of `GameState` at all — `screen`, `isDexOpen`/`isShopOpen`/`isInventoryOpen`/`isReferencePopoverOpen`, `pendingSauceDeposits`, `pendingDoughShape`, `selectedIngredientId`, `mission` (`useReducer(missionRunReducer, ...)`), `missionBestAtStartOfRun`, `lastOrderId`/`lastMakingStep`/`lastPhase`, etc. (`App.tsx:132-313`). None of these are touched by a `RESET_GAME` dispatch into `gameReducer` alone. | Same schema-compat strength as B for the *save* fields, but **no such guarantee for App-level UI state** — a future `useState` added to `App.tsx` silently escapes a `RESET_GAME` action unless someone remembers to add it there too. | Storage write is atomic (same `clearSave()` call), but **in-memory state is not** — a reset that only dispatches to `gameReducer` leaves every other hook exactly as it was (e.g. `isShopOpen` staying `true`, `mission.runId` not resetting). | Requires enumerating and asserting every one of App.tsx's ~13 non-`GameState` hooks individually. | **High for UI state** — the exact same "risk of forgotten fields" #89 warns about, just relocated from the save schema to App.tsx's hook list, which is *harder* to audit exhaustively than a typed `PersistentSaveV2` interface. |
| **D. Hybrid (clear storage + manual GameState reset, no reload)** | Combines B's storage clear with C's in-place `GameState` reset, still no reload. | Inherits C's UI-state gap. | Inherits C's UI-state gap. | Inherits C's UI-state gap. | Inherits C's UI-state gap. | Inherits C's UI-state gap. |

### Recommendation: **Option B — `clearSave()` + full reload.**

This is not a close call for this specific codebase: `clearSave()` already exists, is already
tested, and the mount-time lazy initializer (`App.tsx:101-128`) already *is* the canonical
fresh-player construction, run unconditionally on every real mount. A reload is what makes it
"the same code path a first launch takes," literally, not just in spirit — it re-executes
`useReducer`'s lazy initializer from scratch, which sidesteps every one of the ~13 App-level
`useState`/`useReducer` hooks individually, for free, with zero enumeration risk. This directly
satisfies #89's own explicit instruction: "Prefer clearing the save and invoking canonical
initialization over manually zeroing individual fields, to reduce future reset omissions" — and
extends that same reasoning to in-memory UI state, which the issue text doesn't explicitly mention
but is an equally real source of "forgotten fields" in this specific app's architecture.

---

## 14. Atomicity / Failure Safety

- **Storage write:** `clearSave()`'s `storage.removeItem(SAVE_STORAGE_KEY)` is a single native
  `Storage` API call — there is no multi-key, multi-step write sequence to interleave with a
  mid-operation failure (unlike, say, a multi-document database transaction). The existing
  try/catch already swallows a storage error (disabled/quota) as a no-op, matching every other
  writer in this module.
- **Reload interrupted (browser killed mid-reload, offline, etc.):** the storage clear already
  completed before the reload was requested (clear-then-reload, not reload-then-clear), so the
  worst case is the *reload* not completing — the player simply sees a blank/loading page until
  they reopen the app, at which point `loadSave()` finds the (already-cleared) key absent and
  returns `createDefaultSave()` exactly as designed. There is no state where "Pitz is 0 but Dex
  survived" or similar, because the write itself is one atomic key removal, not six separate field
  writes.
- **Double-tap / repeated invocation:** `clearSave()` on an already-cleared key is idempotent
  (`removeItem` on an absent key is a no-op) — no exception, no special-casing needed. The
  confirmation-modal UX (§17) is the primary defense against an accidental double-trigger; the
  underlying operation is safe to call twice regardless.
- **Conclusion:** given this codebase's single-key storage model, **no additional
  atomicity/rollback machinery is needed** — building a two-phase-commit-style safeguard here would
  be over-engineering a problem the existing storage model doesn't actually have. This matches the
  audit brief's own "do not over-design" instruction.

---

## 15. Save Migration Interaction

- `loadSave()`'s fallback chain (`sanitizeSave` → `toIntermediateV2` → per-field sanitizers) is
  unconditionally re-run on every load regardless of whether the save is fresh, migrated, or
  post-reset — there is no separate "reset save" code path to keep in sync with migration logic.
- **Old save → migration → reset:** a pre-reset v1 save loads, migrates to v2 in memory
  (`migrateV1toV2`), and is used to hydrate `GameState` — then reset calls `clearSave()`, which
  deletes the key outright (not "delete the migrated v2 bytes" vs. "delete the original v1 bytes" —
  there's only ever one key on disk at a time; migration is in-memory-only until the next real
  write, per E0's own documented "lazy write-back" behavior). Reset after this is unaffected by
  whether the deleted bytes were still v1-shaped or already migrated to v2 on disk — `removeItem`
  doesn't care about the shape of what it deletes.
- **Reset → reload → migration:** after `clearSave()`, the key is absent, so `loadSave()` takes its
  "no storage / no item" branch straight to `createDefaultSave()` — the migration branches
  (`toIntermediateV2`'s `schemaVersion === 1`/`=== 2` checks) are never reached at all. No stale v1
  data can "come back," because there is nothing left to migrate.
- **`schemaVersion` of the canonical fresh save:** `createDefaultSave()` always stamps
  `CURRENT_SCHEMA_VERSION` (currently `2`) — a reset produces a save indistinguishable in shape from
  any other fresh v2 save; no special "reset schema version" concept is needed or should be
  invented.

**Conclusion: reset and migration are already orthogonal by construction** — reset operates one
level below migration (it deletes the raw bytes migration would otherwise read), so there is no
interaction to design for beyond confirming (as done here) that `clearSave()` truly removes the
whole key rather than leaving a partial/old-shaped remnant, which it does.

---

## 16. UI Entry Point

No layout decision is made here (AI UI/UX Visual Review 1.0 is tracked separately, per the task
brief's own instruction not to fix layout this session). Observed candidate anchor, for context
only: HOME's header already has a `disabled` ⚙️ "設定" button (`app-header__settings-button`,
`HomeScreen.tsx:68-76`) reserved for a future Settings screen — the most natural long-term home for
"ゲームデータをリセット / はじめから" once Settings ships. Until then, whichever session implements
#89 needs *some* entry point (a temporary HOME-level control, a debug-adjacent location, or landing
directly under the reserved gear icon ahead of full Settings) — left as an implementation-time
decision per the visual-review track, not fixed here.

**Required UX properties regardless of final placement** (from §17-18, non-negotiable): reachable
from HOME without being one accidental tap away from firing.

---

## 17. Destructive Confirmation UX

Minimum two-stage flow, matching #89's own suggested copy:

1. **Trigger:** a "ゲームデータをリセット" (or "はじめから") control — never itself destructive, only
   opens the confirmation.
2. **Confirmation modal:**
   - **Title:** ゲームデータをリセットしますか？
   - **Body:** Pitz・材料・レシピ解放・ピザ図鑑・ベスト記録など、すべての進行状況を最初からやり直します。
   - **Buttons:** キャンセル / 最初からやり直す

Requirements to verify at implementation time (not built here):
- Destructive action (「最初からやり直す」) must be visually distinct from キャンセル (never styled as
  the default/primary-looking action in a way that invites a mistap).
- Tapping outside the modal (overlay) must **not** confirm — cancel-equivalent only, mirroring how
  `DexOverlay`/`ShopOverlay`/`InventoryOverlay` already handle outside-tap in this codebase (worth
  reusing the same overlay-dismiss convention rather than inventing a new one).
- Double-tap / rapid repeated taps on 「最初からやり直す」 must not fire the reset twice — trivially
  safe given `clearSave()`'s idempotency (§14), but the button itself should still disable/debounce
  after first tap for a clean single reload rather than racing multiple `reload()` calls.
- No accidental one-tap path anywhere (e.g. no keyboard-Enter-default landing on the destructive
  button).

---

## 18. Post-Reset UX

**Recommended: full app reload after `clearSave()` completes**, landing on HOME — this is the same
mechanism §13 recommends for state correctness, not a separate UX-only decision layered on top of
it. A reload is safe here specifically because:
- HOME is already unconditionally the first screen on every load (`App.tsx:129-131`'s own comment:
  "HOME is always the first screen shown ... regardless of what round hydration produced") — no
  extra "navigate to HOME" step is needed beyond letting the normal mount sequence run.
- The alternative (manually resetting `screen`/overlay state in place without a reload) reintroduces
  exactly the forgotten-field risk §13 rejected Option C/D for.

**Success feedback:** a brief, non-blocking confirmation (e.g. a toast/snackbar reading
"ゲームデータをリセットしました") shown once HOME re-renders post-reload is reasonable and matches
the issue's own suggested tone — but must not gate or delay landing on HOME, and must not resemble
onboarding/tutorial UI in a way that "邪魔" (interferes with) a genuinely fresh player's first-time
experience, per the brief's own caution. Left as an implementation-time detail, not fixed here.

---

## 19. Acceptance Test Matrix

All of the following are new tests to write in the implementation phase; none exist yet
(`clearSave` currently only has its own low-level storage tests, not an integration-level reset
flow test). Recommended locations: `persistence.test.ts` (A-C, F, K, O — storage-level) and a new
`App.*.test.tsx` (D, E, G-J, L-N — integration-level, following this codebase's existing
`App.<feature>.test.tsx` convention).

| # | Scenario | Expected result |
|---|---|---|
| A | Heavily progressed save → reset | Every `PersistentSaveV2` field matches `createDefaultSave()` exactly. |
| B | Pitz reset | `pitzBalance === 0`. |
| C | Finite inventory reset | `inventory` deep-equals `{}`. |
| D | Unlimited starter ingredients correct | `tomato-sauce`/`mozzarella`/`basil` placeable with no stock gate (never read `inventory`). |
| E | Recipe unlock reset | Only Margherita `isRecipeAvailable`; all 10 others locked. |
| F | Starter Grant claimed reset | `starterGrantClaimedRecipeIds` deep-equals `[]`. |
| G | Dex reset | `dex` deep-equals `[]`; every recipe `isDiscovered === false`. |
| H | BEST/stars/timesMade reset | No `DexEntry` exists for any recipe (not merely zeroed — see §8). |
| I | Lunch Rush local record reset | `missionBest[LUNCH_RUSH_MISSION_ID] === undefined` → `loadMissionBest` returns `0`. |
| J | Settings KEEP/RESET per decision | N/A today (§2/§12: no settings exist) — placeholder test to add once Settings ships. |
| K | Reload after reset stays fresh | Re-mounting `App` (or re-calling `loadSave()`) after reset still yields `createDefaultSave()` — no resurrection. |
| L | Margherita playable post-reset | A full ORDER→PREPARE→BAKE→RESULT round on Margherita succeeds with only Starter ingredients. |
| M | Starter Grant fires exactly once post-reset | After reset, discovering `funghi` for the first time (again) triggers its Starter Grant exactly once — proves §6's claimed-ledger gate isn't left in a stale "already granted" state by the reset. |
| N | Reset double-click → no corruption | Firing the confirmed reset action twice in immediate succession leaves storage in the same valid fresh state as a single reset (§14). |
| O | Old (v1) / migrated save → reset → fresh | Seed a raw `schemaVersion: 1` save, mount (triggers migration), then reset — final state matches `createDefaultSave()`, not a migrated-but-reset hybrid. |

---

## 20. Browser Verification Plan

To run once implementation lands (not performed this session — read-only audit). Viewports:
**390×844** and **360×800**, per this project's established mobile-first verification convention
(seen throughout prior Result reports in `docs/reports/`).

**Flow 1 — Cancel path (state must be provably unchanged):**
progressed save (some Dex/Pitz/inventory state) → open reset entry point → confirmation modal
appears → tap キャンセル → modal closes → HOME still shows the same Pitz/Dex numbers as before →
reload → same numbers still present (proves cancel never touched storage).

**Flow 2 — Confirm path (full verification sweep):**
same progressed save → reset entry point → confirmation modal → tap 最初からやり直す → land on HOME
→ Pitz shows `0` → Recipe Select shows only Margherita available, all others locked/mystery →
Inventory screen shows no finite ingredients owned → Dex shows nothing discovered → reload → repeat
every check above, confirming persistence across reload (not just in-memory).

---

## 21. Implementation Slice

Given this audit's central finding (§13: `clearSave()` already exists and tested; canonical
initialization already runs unconditionally on mount; the only new work is a UI trigger + a reload
call + tests), **one slice is sufficient** — the task does not need splitting into a "core" and a
"UI" slice the way a from-scratch persistence feature would.

### Reset 1A — Full Game Reset (confirmation UI + reload + tests)

- **Scope:** a HOME-reachable trigger → two-stage confirmation modal (§17 copy) → on confirm, call
  `clearSave()` then force a full reload (§13 Option B, §18). No changes to `persistence.ts`'s save
  shape, no new schema version, no changes to `gameReducer.ts`'s action set (no `RESET_GAME` action
  needed — the reload *is* the reset mechanism, per §13's recommendation).
- **Files likely affected:**
  - `src/screens/HomeScreen.tsx` (or a new small overlay component, following the existing
    `DexOverlay`/`ShopOverlay`/`InventoryOverlay` pattern) — trigger + confirmation modal.
  - `src/App.tsx` — wires the trigger's confirm callback to `clearSave()` + reload; no reducer
    changes.
  - `src/state/persistence.ts` — likely untouched (`clearSave()` already exists as needed) unless
    the implementer wants to export a small `resetAndReload()` convenience wrapper alongside it.
  - New test file(s) per §19's matrix.
- **Estimated time:** well within the target 2-3 hours — this is primarily UI + integration tests
  around an already-existing, already-tested storage primitive, not new persistence design.
- **Risk:** low. The main risk is entry-point placement colliding with the concurrent AI UI/UX
  Visual Review 1.0 work (§16) — mitigated by keeping the entry point minimal/temporary if Visual
  Review hasn't landed a Settings screen yet, per that track's own ownership of final layout.
- **Dependencies:** none blocking — `clearSave()` is already merged to `main`. Soft dependency:
  ideally sequenced after (or coordinated with) the Visual Review track if a real Settings screen
  is about to land, to avoid building a throwaway entry point immediately before Settings replaces
  it — a scheduling note, not a technical blocker.
- **Tests:** full §19 matrix (A-O), plus the two Human-Feel browser flows in §20 before merge.
- **Acceptance criteria:** every §19 test passes; both §20 flows verified at both viewports; no
  regression in the existing 1604-test suite; `tsc -b`/`oxlint`/`vite build` all stay clean.

No second slice is recommended — splitting "core reset" from "UI confirmation" would only
reintroduce the coordination overhead this audit's whole point (§13) is to avoid, given how thin the
actual new surface area is once `clearSave()` is reused rather than reinvented.

---

## 22. Risks

- **P1 — Entry-point churn:** whatever HOME location Reset 1A picks may need to move once the AI
  UI/UX Visual Review 1.0 track lands its own HOME layout. Mitigated by keeping the entry point a
  simple, easily-relocated control rather than deeply integrating it into HOME's current markup.
- **P1 — Future Settings KEEP/RESET decision left open (§12):** not a risk to Reset 1A itself (no
  settings exist to get wrong today), but the *next* task that adds any persisted setting must
  re-consult #89/this report's §12 guidance rather than defaulting to "reset everything," or a
  future regression could wipe a pure UI preference unintentionally.
- **P2 — Firebase-identity conflation (§10-11):** not a risk today (no Firebase code exists), but a
  real risk for whichever future task wires up #87's anonymous auth if that task's author doesn't
  read this report's §11 note and accidentally routes Full Game Reset through a Firebase sign-out
  call. Recommend cross-referencing this report from #87's own eventual implementation task.
- **P2 — Reload UX on a slow device:** a full reload is the recommended mechanism (§13/§18), which
  necessarily means a brief blank/loading flash on the confirm path — not a correctness risk, but
  worth a human-feel check at implementation time (not audited further here, out of scope for a
  read-only pre-implementation pass).

---

## 23. Recommended Next Task

**Implement Reset 1A** (§21) directly — no further audit or design-decision task is needed first.
This session found no open product decision that blocks implementation (§4's Scope Matrix has zero
Category-C items today), no architecture ambiguity (§13's Option B is a clear, low-risk choice given
what already exists in this codebase), and no duplicate in-flight work (§0).

---

## 24. Final Verdict

# **A. READY FOR IMPLEMENTATION**

Every persisted field today is unconditionally in-scope for reset (§4); the canonical fresh-player
construction already exists and runs on every real app mount (§3); the atomic clear primitive
(`clearSave()`) already exists and is already tested (§2, §14); Starter Grant/recipe/economy
atomicity all fall out for free from this codebase's single-storage-key design (§6, §7, §9); no
Firebase code exists to conflate with (§10-11); and no settings exist yet to require a KEEP/RESET
product decision (§12). The recommended architecture (§13, Option B: `clearSave()` + reload) is a
thin UI+integration slice around existing, already-verified primitives — not a new persistence
design — which is exactly the "reduce future reset omissions" outcome #89's issue text asks for.
