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

- `src/state/persistence.forwardCompat.test.ts` (19): current save round-trip, unknown recipe/Dex,
  ingredient, inventory, ledger, top-level preservation through all three write paths, repeated
  downgrade → save → reload round-trips (no duplicates), no-op mount write, malformed/negative/NaN/
  invalid-shape handling, `__proto__`, v1 migration, unrecognized schema fallback, reset, fresh
  player shape, and **runtime hydration (`loadSave` → `applyStarterGrants` →
  `createInitialGameState`) identical with or without future data**.
  - B-2 (Final Preflight, 5 tests): the future entitlement field PR #217 names,
    `unlockedForShopIngredientIds`, survives `persistDex`, `persistProgress`, `persistMissionBest`
    and a downgrade → mount grant (EP4) → play → mission → reload → write sequence verbatim, and
    `loadSave` never exposes it. 4 of these 5 fail against main's `persistence.ts`.
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

## 5. Deploy constraints (Final Preflight)

### Rollback floor

- **Before any Progression 2.0 build has shipped:** rolling back from this build to main
  (`dff233c` or earlier) is safe. For a save without future data (empty, default, full v2, v1,
  corrupt JSON, v3 root) main and this build write byte-identical saves on every write path.
- **After a Progression 2.0 build has shipped even once:** the floor is **this build** (any build
  containing `writeSave`). Rolling back below it (main, a revert of this PR, or a `workflow_dispatch`
  of an older SHA) erases the future data on the first write, and upgrading again does not restore it.
- So this PR has to ship on its own and soak **before** Progression 2.0. After that, keep it as the
  rollback floor.

### Old-tab limitation (not fixed here; pre-existing)

- A tab still open from **before this deploy** runs the old code and acts like a rollback. Its first
  write erases future data. There is no service worker or forced reload, so these tabs only go away
  with time (soak).
- A tab of **this build** left open while a newer build writes keeps the unknown data. For **known**
  fields, though, the last tab to write wins. That tab can undo a newer build's `pitzBalance` change
  (e.g. give back an unlock fee while the entitlement stays) or roll back Dex BEST/timesMade.
  Resolving that is Progression 2.0 work (cross-tab coordination / fee ledger), not this PR's.
- Extra fields inside a Dex entry, ids outside `^[a-z0-9][a-z0-9_-]{0,63}$`, non-integer values, a changed
  meaning of an existing field, and a `schemaVersion` bump are **not** preserved. Progression 2.0
  must add new data as new top-level keys on schemaVersion 2.

## 6. I0 Final Merge Gate (2026-09-25)

Audited main `1e53baa`. PR head `edfca8b` was brought up to date with main via merge commit
`1672d95` (tree identical to a local `edfca8b` + `1e53baa` merge). `persistence.ts` is unchanged
on main since this PR's base `d6b6ef9`.

| # | Check | Result |
|---|---|---|
| 1 | Diff scope | 4 files: `persistence.ts`, its unit test, one e2e spec, this report. No content/UI/economy change. |
| 2 | Migration semantics | v1 → v2 unchanged; unrecognized `schemaVersion` still falls back to defaults and contributes no extras. |
| 3 | Unknown id preservation | Dex / owned / inventory / claimed-ledger unknown ids kept (well-formed only). |
| 4 | Known-id behavior | `loadSave` output unchanged; known ids validated as before and win on merge. |
| 5 | Malformed data | Bad ids, NaN, negative/fractional, wrong shapes, `__proto__` dropped. |
| 6 | Rollback | Floor as in §5; a save without future data is written byte-identically. |
| 7 | Starter grant ledger | Unknown claimed ids appended after known ones, deduplicated. |
| 8 | `unlockedForShopIngredientIds` | Kept verbatim through all three write paths; never exposed by `loadSave`. |
| 9 | Unknown top-level fields | Kept as-is; known keys always overwrite. |
| 10 | Write paths | `persistDex` / `persistProgress` / `persistMissionBest` all go through `writeSave`; the only other storage op is reset's `removeItem`. |

Verification on `1672d95`'s tree:

- Local: `vitest` 126 files / 2435 tests pass (persistence: 104). `oxlint`, `tsc -b` and `npm run build` pass.
- Chromium (local): `save-forward-compat-3-4b` passes at 390×844 and 360×800; the full Chromium e2e suite passes (116/116).
- WebKit (CI run 36107402994): Full WebKit, 2 projects × 2 shards all pass, and WebKit Gate PASS with coverage verified, `tested_base=1e53baa`.

Verdict: **PASS**, so the PR merges to main.

Deploy: `deploy.yml` automatically publishes GitHub Pages (production) on every push to `main`.
This save protection must reach production, and soak, before any build carrying new
recipe/ingredient ids (I5a/I5b) ships.
