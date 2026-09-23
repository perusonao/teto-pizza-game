# Progression 2.0 Phase 3-4B — Save forward-compat: Result

- Audited main: `d6b6ef90097617e1efb4096ec6415b8f134caa93`
- Branch: `claude/progression-2-0-phase-3-4b-y8g73a`
- SSOT: PR #204 (Phase 3-4 Pre-Implementation Audit), row **3-4B** / risk **R-04**
- Scope: `src/state/persistence.ts` only. No runtime/UI/gameplay change. No schema version bump.
  OD-03 not decided. 3-4A (PR #205) not wired. PR #202 untouched.

## 1. Data-loss audit (before the change)

`loadSave()` sanitizes every field down to ids this build knows, and every write path re-serialized
that sanitized view, so a single write from an older build erased anything a newer build had stored.

| # | Path (main) | What was lost |
|---|---|---|
| 1 | `sanitizeDexEntry` → `isKnownRecipeId` (via `sanitizeDex`) | Dex entry (discovery, BEST, timesMade) of a future recipe |
| 2 | `sanitizeOwnedIngredientIds` (`KNOWN_INGREDIENT_IDS` filter) | purchase (OWNED) of a future ingredient |
| 3 | `sanitizeInventory` (`KNOWN_INGREDIENT_IDS` filter) | stock of a future ingredient |
| 4 | `sanitizeStarterGrantClaimedRecipeIds` (`isKnownRecipeId`) | EP4 grant ledger entry of a future recipe (→ a later re-grant) |
| 5 | `sanitizeSave` builds a fixed-key object | any top-level field a newer build adds without a bump (EP4 precedent) |
| 6 | `persistDex` / `persistProgress` / `persistMissionBest` write `{ ...loadSave(), … }` | all of 1–5 on the first write after load |
| 7 | `migrateV1toV2` → `backfillInventoryForMigratedSave` | unknown owned id gets no inventory backfill (not a loss; unchanged) |
| — | `sanitizeMissionBest` | already kept unknown mission ids (no change needed) |

Not a loss path (by design, unchanged):

- The no-op skip in `persistProgress`/`persistDex`/`persistMissionBest`: mount alone never writes.
- `resetSave` / `clearSave`: removes the key; the next load is `createDefaultSave()`.
- `toIntermediateV2`: an unrecognized `schemaVersion` (e.g. 3) still falls back to defaults, and the
  next real write replaces it. Progression 2.0 must therefore **not** bump `schemaVersion` (the PR
  #204 matrix already says "schema bump なし").

The loss was reproduced before the fix: 5 of the 14 new unit tests and the new Chromium spec fail
against main's `persistence.ts`.

## 2. Change

Every write now goes through `writeSave()`, which re-reads raw storage, extracts the
forward-compatible extras (`extractForwardCompatExtras`) and appends them to the known data being
written. `loadSave()`'s result is unchanged, so `GameState` never sees unknown data.

Save compatibility policy:

- **Known ids:** validated exactly as before (Starter ids still never get inventory, etc.).
- **Unknown but well-formed ids are kept:** id matches `^[a-z0-9][a-z0-9_-]{0,63}$` (every id in
  `src/data`, `data/recipes/pizza_master_catalog.json` and `ingredient_master_catalog.json` matches).
  - Dex entry: must also pass the same field checks as a known entry (discovered boolean, bestScore
    0–100, bestStars 1–5 integer, timesMade non-negative integer). First entry per id wins.
  - `ownedIngredientIds`, `starterGrantClaimedRecipeIds`: deduplicated.
  - `inventory`: value must be a non-negative integer.
- **Unknown top-level keys:** kept verbatim, never read. `__proto__` is dropped.
- **Corrupt data is still dropped:** non-string/empty/uppercase/spaced/over-long ids, NaN/negative/
  fractional/string stock, invalid Dex shapes, non-array/non-object fields.
- **Known always wins:** extras are only appended; an id already in the write is never duplicated.
- Only a recognized root (schemaVersion 1 or 2 with an array `dex`) contributes extras.
- No schema version bump. Reset/new game unchanged.

## 3. Tests

- `src/state/persistence.forwardCompat.test.ts` (14): current save round-trip, unknown recipe/Dex,
  ingredient, inventory, ledger, top-level preservation through all three write paths, repeated
  downgrade → save → reload round-trips (no duplicates), no-op mount write, malformed/negative/NaN/
  invalid-shape handling, `__proto__`, v1 migration, unrecognized schema fallback, reset, fresh
  player shape, and **runtime hydration (`loadSave` → `applyStarterGrants` →
  `createInitialGameState`) identical with or without future data**.
- `e2e/save-forward-compat-3-4b.spec.ts` (Chromium 390×844 / 360×800): future-data save loads with
  Dex pill `1/15`, the real mount-time write (EP4 catch-up grant) keeps the future data, and it
  survives a reload.
- Existing `persistence.test.ts` unchanged and green.

## 4. Left for 3-4C

- Inventory unit transition (piece → portion) and the 3-4C transition rules (owned kept, EP4 ledger
  inert, stock kept) applied at cutover.
- When a future build *learns* an id preserved here, the id is validated by that build's rules at
  that point (e.g. a preserved inventory value becomes live stock).
- An unknown owned id migrated from v1 gets no inventory backfill (economy for it is unknown here).
- A future `schemaVersion` bump would still be erased by an older build's write — keep "no bump" or
  design a read-only policy first.
