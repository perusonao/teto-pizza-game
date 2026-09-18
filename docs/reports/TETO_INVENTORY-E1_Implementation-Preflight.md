# Teto Pizza Game — Inventory E1 (InventoryState) Implementation Preflight

**Scope: read-only preflight. No production code was touched in this session.**

- **Audited `main` SHA**: `aaf56edaea533f9efc63b3ba623bf1ae8425a6b5` ("M3A Bake Judgment: fading
  bake guide + continuous bake visuals (#68)"). Fetched fresh via `git fetch origin main` at
  session start; this session's own branch (`claude/teto-inventory-e1-preflight-7kkjnb`) was
  already `0 behind / 0 ahead` of this SHA (`git rev-list --left-right --count HEAD...origin/main`
  → `0 0`), so no rebase was needed.
- **PR #56 (E0)**: confirmed **MERGED** (`556376c` in `main`'s history).
- **PR #70 (E1 Fresh Audit, read-only)**: confirmed **MERGED** (`2c86763`,
  `docs/reports/TETO_SAVE-V2_E1_INVENTORY_Fresh-Audit.md`).
- **Verified suite health on the audited SHA (not just cited from a prior doc)**: this session ran
  `npm ci`, then `npx vitest run`, `npx tsc -b`, `npx oxlint` directly —
  **1188/1188 tests pass, typecheck clean, lint clean.** The prior Fresh Audit (PR #70) explicitly
  noted it had *not* run the suite locally; this session closes that gap and confirms `main` is
  genuinely green at the SHA E1 would build on, not just green per its own CI run.
- **Recommended model**: Claude Code, normal tier — unchanged from the Fresh Audit's own
  recommendation; nothing found here changes that.

## 1. What landed on `main` since the Fresh Audit's own SHA

The Fresh Audit (PR #70) audited `27818ef` (PR #69 merge). Three PRs merged after that, before
this SHA:

- **PR #70** itself (`2c86763`) — docs-only (the Fresh Audit report).
- **PR #71** (`494486a`) — docs-only, 428 insertions, 0 production files
  (`docs/reports/TETO_RESULT-2_Fresh-Audit.md`, a **read-only** RESULT 2.0 design audit; see §6
  below).
- **PR #68** (`aaf56ed`, this SHA's own HEAD) — **production code**, "M3A Bake Judgment: fading
  bake guide + continuous bake visuals." Touched `src/logic/bakeGuideFade.ts` (new),
  `src/logic/bakeVisual.ts` (new), `PizzaStage`/`BakeGauge`-adjacent rendering, and added
  `gameReducer.bakeGuideRegression.test.ts`. **Confirmed by `git log --oneline -- <file>` that PR
  #68 did not touch `src/state/persistence.ts`, `src/state/gameReducer.ts`, or `src/App.tsx`** —
  the last commits on each of those three files remain, respectively, `556376c` (E0, PR #56),
  `2a2b9b1` (PR #64, Pitz Reward), and `2a2b9b1` also for `App.tsx`. `CONFIRM_BAKE` itself
  (`gameReducer.ts` line 488) is unchanged by PR #68 beyond what the Fresh Audit already read: it
  still only sets `pizza`/`bakeState`/`scoringV2Result`/`score`/`phase`, still has no
  `phase !== "BAKE"` guard.

**Conclusion: nothing that landed after the Fresh Audit's SHA touches any file, line, or shape
E1's design depends on.** The Fresh Audit's file-scope, line-number, and behavior claims are
verified fully current on today's `main`, not just "probably still true."

## 2. Fresh Audit assumption-by-assumption re-verification

Each claim below was independently re-read against `aaf56ed`, not copied from PR #70's own text.

| # | Fresh Audit claim | Re-verified on `aaf56ed` |
|---|---|---|
| 1 | `schemaVersion 2`, `PersistentSaveV2` has `inventory: Record<string, number>` (`persistence.ts` line ~119) | **Confirmed**, byte-identical. `CURRENT_SCHEMA_VERSION` still 2. |
| 2 | `sanitizeInventory` drops unknown ids / non-owned-Starter ids / negative-or-non-integer values | **Confirmed**, unchanged since E0 (`556376c`). |
| 3 | `inventory` is write-only — no `GameState`/reducer/component reads it | **Confirmed**: grep for `inventory` (case-insensitive) across `src/` still returns only `persistence.ts`, `persistence.test.ts`, `phase4a1b.regression.test.ts`. |
| 4 | `GameState`'s `ProgressionCarry` (lines 174-179) = `dex`/`ownedIngredientIds`/`pitzBalance`/`lastClaimedMissionRunId` | **Confirmed**, exact fields, exact line range. |
| 5 | 5 carry-through construction sites: `buildOrderState` (`...carry` spread, line 189/208), `nextOrderState` (line 220), `nextMissionOrderState` (hand-built carry object, lines 233-246 — **does not** spread `...carry`), `startPreparingRecipe` (line 257), `createInitialGameState` (line 273) | **Confirmed, all 5, at the exact or off-by-one-line locations cited.** `nextMissionOrderState` is still the one site that builds `{ dex, ownedIngredientIds, pitzBalance, lastClaimedMissionRunId }` by hand rather than spreading an existing `ProgressionCarry` — still the single highest miss-risk site, exactly as the Fresh Audit flagged. |
| 6 | `persistence.ts`'s `ProgressionSnapshot` (lines 451-455) = `dex`/`pitzBalance`/`ownedIngredientIds`; `persistProgress`'s no-op-skip guard = `dexUnchanged && pitzUnchanged && ownedUnchanged` (line 488) | **Confirmed**, exact lines, exact guard expression. |
| 7 | `App.tsx` line 100: `createInitialGameState(save.dex, save.ownedIngredientIds, save.pitzBalance)`; line 197-201 `persistProgress({...})`; line 202 effect deps `[state.dex, state.pitzBalance, state.ownedIngredientIds]` | **Confirmed at the exact cited lines** (100, 197-201, 202). |
| 8 | `CONFIRM_BAKE` (line 488) still has no `phase !== "BAKE"` guard; still doesn't touch `inventory`; still calls `computeScoringV2` | **Confirmed**, unchanged by PR #68 (which only touches render-time bake visuals, not `CONFIRM_BAKE`'s reducer body). |
| 9 | `IngredientTray.tsx` gates purely on `ownedIngredientIds.includes(i.id)` (cited lines 85-87) | **Confirmed** at lines 85-87 exactly. No stock-based filter exists. |
| 10 | `ShopOverlay.tsx`: `SHOP_PRODUCTS` = ingredients with `unlockCondition` (today `[onion]`); no quantity UI | **Confirmed**, unchanged. |
| 11 | `progression.ts`'s `ingredientState`/`isRecipeAvailable`, `economy.ts`'s `purchaseIngredient` (ownership-only, never touches `inventory`) | **Confirmed**, unchanged since E0. |
| 12 | Ownership (`ownedIngredientIds`) vs. stock (`inventory`) are not conflated anywhere in current code | **Confirmed** — re-derived independently from the same grep, same conclusion. |

**No drift found anywhere.** Every load-bearing claim in the Fresh Audit is still true, at the
same or an off-by-a-line-or-two location, on today's `main`.

## 3. Invariant re-confirmation (ownership vs. inventory)

- **ownership** (`ownedIngredientIds: string[]`) = "can this ingredient ever be placed at all" —
  a permanent, one-time unlock flag. Unrelated to quantity.
- **inventory** (`inventory: Record<string, number>`, E0-reserved, E1's job to wire up) =
  "how many consumable units remain" — irrelevant to whether placement is *allowed*, only to
  whether it's *possible right now*.
- **Starter/unlimited safety, re-confirmed structurally, not by convention**: every ingredient
  with no `unlockCondition` (13 of 14 today) is unconditionally `OWNED` per `ingredientState`
  regardless of `ownedIngredientIds`'s contents, and the proposed `hasStock` (Fresh Audit §4)
  returns `true` unconditionally when `unlockCondition` is absent — Starter ingredients are
  structurally exempt from the stock check, not merely defaulted to a large number. E1 introduces
  no code path that can make a Starter ingredient stop being placeable. `E1` ships **zero**
  callers of `hasStock`/`remainingStock` (that's E2's job) — even the theoretical risk surface is
  absent in this slice.
- **Confirmed no confusion exists today**: `ownedIngredientIds.includes(...)` (ownership) and
  `inventory[...]` (stock) are still two syntactically and semantically separate fields, never
  read from or written to each other, anywhere in `src/`.

## 4. Schema decision

**No `schemaVersion` bump.** Re-confirmed: `PersistentSaveV2`'s `inventory` field already exists,
is already sanitized (`sanitizeInventory`), already migration-tested
(`migrateV1toV2`/`backfillInventoryForMigratedSave`), and round-trips correctly through
`loadSave`/`persistProgress`'s existing pattern today. E1 is a pure "read an already-correct
persisted field into runtime state, write it back out" slice — architecturally identical to how
`ownedIngredientIds` (Phase 3C-3) and `missionBest` (Phase 3C-4) were each activated from a
previously-reserved field without a schema bump. No new fact surfaced in this session (or in PR
#68/#70/#71) creates a need for schema v3.

## 5. E1 exact file scope (re-verified against current line numbers)

**New:**

- `src/state/inventory.ts` — `InventoryState` (`Readonly<Record<string, number>>`),
  `EMPTY_INVENTORY`, `hasStock(ingredient, inventory, alreadyUsedThisRound)`,
  `remainingStock(ingredient, inventory)`. Pure, no reducer/UI import. (Design unchanged from
  Fresh Audit §4; re-verified `Ingredient.unlockCondition` shape in `src/data/ingredients.ts` is
  unchanged.)
- `src/state/inventory.test.ts` — pure-function matrix per Fresh Audit §12.

**Touched — 5 `gameReducer.ts` call sites, all reconfirmed present at the cited lines today:**

- `GameState` — add `inventory: InventoryState` (near line 58, alongside `score`/`bakeState`).
- `ProgressionCarry` (lines 174-179) — add `inventory: InventoryState`.
- `buildOrderState` (line 189) — carries automatically via its existing `...carry` spread (line
  208); **no separate edit needed here beyond the interface change**, confirmed by reading the
  function body directly.
- `nextOrderState` (line 220) — no separate edit needed; it only forwards `carry` to
  `buildOrderState`.
- `nextMissionOrderState` (lines 233-246) — **must** add `inventory: state.inventory` to its
  hand-built carry object literal (lines 238-243). This remains the single highest miss-risk site
  since it's the only one of the five that doesn't destructure/spread an existing
  `ProgressionCarry`.
- `startPreparingRecipe` (line 257) — no separate edit needed; forwards `carry` to
  `buildOrderState` same as `nextOrderState`.
- `createInitialGameState` (lines 273-282) — gains a fourth parameter,
  `inventory: InventoryState = EMPTY_INVENTORY`, passed into the `carry` object at line ~279.
- **No other `case` in the `gameReducer` switch may read or write `inventory`** — every other case
  must carry it through unchanged via its existing `{ ...state, ... }` pattern (already true by
  construction for any field added to `GameState`, needs no per-case edit — TypeScript will not
  force one, but no case among `PURCHASE_INGREDIENT`/`CONFIRM_BAKE`/`REGISTER_TO_DEX`/etc.
  constructs a full new `GameState` literal instead of spreading `state`, confirmed by reading
  every `case` body).

**Touched — `src/state/persistence.ts`:**

- `ProgressionSnapshot` (lines 451-455) — add `inventory: InventoryState`.
- `persistProgress` (lines 474+) — patch `inventory` into the same read-modify-write merge (the
  `next: PersistentSaveV2` literal around line 490), and add a fourth "unchanged" comparison
  (per-key value comparison — `sameStringSet`, line 441, is the wrong tool since it's a
  keys-only-equality helper and inventory values matter) into the
  `dexUnchanged && pitzUnchanged && ownedUnchanged` guard (line 488).
- No change to `loadSave`/`sanitizeSave`/`sanitizeInventory`/`migrateV1toV2` — all already correct
  from E0, re-confirmed unchanged since `556376c`.

**Touched — `src/App.tsx`:**

- Line 100: `createInitialGameState(save.dex, save.ownedIngredientIds, save.pitzBalance)` → add
  `save.inventory` as the 4th argument.
- Lines 197-201 (`persistProgress({...})`): add `inventory: state.inventory`.
- Line 202 (effect deps): add `state.inventory` to
  `[state.dex, state.pitzBalance, state.ownedIngredientIds]`.
- **No prop needs to reach any component in E1** — reconfirmed no consumer of `inventory` exists
  yet (`IngredientTray`/`ShopOverlay` both still gate on `ownedIngredientIds` only).

## 6. Exact tests

- `src/state/inventory.test.ts` (new) — Starter ingredient always `true`/`"UNLIMITED"` regardless
  of `inventory` contents; finite ingredient (`onion`) at/below/above `alreadyUsedThisRound`;
  absent key reads as `0`/`"UNLIMITED"`-appropriate value.
- `src/state/gameReducer.test.ts` (extend) — mirror the file's own existing
  `ownedIngredientIds` carry-through assertions 1:1 for `inventory`, at the same call sites already
  proven to exist in this file:
  - lines 99-107 (`createInitialGameState` default / hydrated-value pass-through) →
    add `EMPTY_INVENTORY` default + hydrated-inventory pass-through cases.
  - lines 202-215 (`PLAY_AGAIN` "carries dex/pitzBalance/ownedIngredientIds forward unchanged") →
    extend to assert `inventory` too.
  - lines 284-295 (`RETRY_SAME_RECIPE` progression-preservation) → extend the same way.
  - lines 482-486 (`PLAY_AGAIN` carries `ownedIngredientIds` forward) → extend or add a sibling
    assertion for `inventory`.
  - lines 133-150 / 491-576 (`MISSION_RESET_ORDER`/`MISSION_NEXT_ORDER` carry-through and
    exactly-once-registration tests) → add an `inventory`-carries-forward assertion specifically
    here, since `nextMissionOrderState` is the one hand-built-carry site (§5) most likely to be
    missed; this is the test that would actually catch that specific miss.
- `src/state/persistence.test.ts` (extend) — mirror the existing `persistProgress` describe block
  (line 332+): round-trip `inventory` (write then `loadSave` reads it back), and confirm the
  no-op-skip guard treats an unchanged `inventory` as "nothing to write" (same shape as the
  existing `dexUnchanged`/`pitzUnchanged`/`ownedUnchanged` tests around lines 335-425).
- `src/App.test.tsx` (extend, if practical) — **note**: this file currently seeds saves via
  `seedSave()` (line 39-49) using `PersistentSaveV1` (`schemaVersion: 1`, no `inventory` field) and
  relies on `migrateV1toV2` to backfill `inventory` at load time; it does **not** currently seed a
  `PersistentSaveV2` directly. A hydration smoke assertion for E1 should either (a) seed a v2 save
  with a non-empty `inventory` and assert it round-trips through the running `App`, or (b) confirm
  the existing v1-seed-plus-migration path still produces the expected backfilled `inventory` in
  the resulting `GameState` (already implicitly covered by `persistence.test.ts`'s migration
  matrix — this file's addition would be a thin integration confirmation, not new coverage). Not a
  blocker either way; confirm the simpler option at implementation time as the Fresh Audit itself
  flagged.

No UI/visual test needed — no rendered surface changes in E1.

## 7. Implementation order (single PR, sequential)

1. `src/state/inventory.ts` + `inventory.test.ts` (standalone, no dependents yet — safest first
   step, fully testable in isolation).
2. `gameReducer.ts`: add `inventory` to `GameState`/`ProgressionCarry`, the
   `nextMissionOrderState` literal, and `createInitialGameState`'s 4th parameter. Let `tsc -b`
   surface any missed construction site (the Fresh Audit's own structural mitigation — this
   session independently reconfirmed the current code has exactly the 5 sites and no more that
   construct a `GameState`/`ProgressionCarry` literal from scratch).
3. `gameReducer.test.ts` extensions (§6) — run immediately after step 2, before touching
   persistence, so the reducer-level carry-through is proven correct in isolation first.
4. `persistence.ts`: `ProgressionSnapshot` + `persistProgress`'s merge + no-op guard.
5. `persistence.test.ts` extensions (§6).
6. `App.tsx`: the 3 call-site edits (hydration argument, `persistProgress` call, effect deps).
7. `App.test.tsx` — confirm existing tests still pass; add the hydration smoke assertion if
   practical within the time budget (§6 note).
8. Full suite (`npx vitest run`) + `npx tsc -b` + `npx oxlint` + `npm run build`.

## 8. Estimated Claude Code time

**Under 1.5 hours**, unchanged from the Fresh Audit's own estimate — re-confirmed realistic by
this session's direct reading of every touched line: the change is additive-field-plus-5-known-
call-sites with no new design decision, backed by a type system that will hard-fail compilation on
any missed `GameState`/`ProgressionCarry` construction site. Comfortably inside the
project's 2-3 hour target with margin for the full test/typecheck/lint/build pass.

## 9. Conflicts with current RESULT work

- **No open implementation PR touches `gameReducer.ts`, `persistence.ts`, or `App.tsx` right now.**
  Checked live GitHub state: the only open PRs against this repo are #72 (docs-only, PROJECT_HANDOFF
  status correction), and three stale pre-Issue-#47-era PRs (#46, #34, #3) based on old, superseded
  `main` SHAs with no relation to RESULT, Save v2, or Inventory. None are in flight against current
  `main`.
- **RESULT 2.0 (PR #71) is a read-only design audit, not an implementation.** It proposes (not yet
  built) collapsing the RESULT/DISCOVERED phase split into one screen, and separately floats a
  possible future `cookingEfficiency` field needing "a round-start timestamp captured somewhere in
  `GameState`" (explicitly undecided even as a field name/site in that audit). **This means a
  future RESULT 2.0 implementation PR would likely also edit `GameState`, `ProgressionCarry`-
  adjacent construction sites, and `App.tsx` — the same files E1 touches.**
- **This is a sequencing note, not a blocker.** E1's change is small, additive, and orthogonal in
  meaning to anything RESULT 2.0 proposes (inventory carry-through vs. RESULT-phase UI/reducer
  restructuring). Recommendation: **land E1 first** (it's already fully scoped and small) rather
  than let it sit and become a rebase burden against a future, larger RESULT 2.0 PR that will touch
  the same `GameState`/`buildOrderState`/`App.tsx` regions. No design coupling exists between the
  two — this is purely about minimizing merge-conflict surface by sequencing the smaller, already-
  ready slice first.

## 10. Risks (re-confirmed from Fresh Audit, unchanged)

- **Low overall.** Mechanical carry-through, not a design problem.
- **Mechanical-miss risk**: `nextMissionOrderState` (the one hand-built carry-object site) remains
  the most likely spot to miss `inventory` — mitigated by both the type checker (TypeScript will
  refuse to compile a `ProgressionCarry`-shaped object literal missing a required field once
  `inventory` is added to the interface) and the dedicated Mission carry-through test added in §6.
- **No UI/gameplay regression risk** — no rendered component reads `inventory` in E1.
- **Verified, not assumed, this time**: this session actually ran the full suite/typecheck/lint on
  the audited SHA (§0), closing the one gap the Fresh Audit flagged as unverified in its own
  session.

## 11. Stop conditions

Stop and re-audit (do not proceed under this Preflight) if, at implementation start, any of the
following has changed on fresh `main`:

- `origin/main`'s HEAD SHA is no longer `aaf56edaea533f9efc63b3ba623bf1ae8425a6b5` **and** the diff
  between that SHA and the new HEAD touches any of `src/state/gameReducer.ts`,
  `src/state/persistence.ts`, `src/App.tsx`, `src/data/ingredients.ts`, or `src/state/progression.ts`.
- Any of the 5 `gameReducer.ts` carry-through sites (§2 row 5) has moved, been removed, or a 6th
  `GameState`/`ProgressionCarry`-constructing site has been added.
- `PersistentSaveV2`'s shape, `sanitizeInventory`, or `migrateV1toV2` has changed in any way.
- A RESULT 2.0 implementation PR has been opened and already merged changes into `GameState`/
  `ProgressionCarry`/`App.tsx` — in that case, redo §5's line citations against the new state
  rather than assuming they still apply; the *design* (§3-§4) would not need re-litigating, only
  the exact line numbers.
- The full suite (`npx vitest run`), `tsc -b`, or `oxlint` no longer passes cleanly on fresh `main`
  before E1's own changes are made.

None of these conditions are currently true.

## Final verdict

**A. IMPLEMENT E1.**

- E0 (PR #56) and the E1 Fresh Audit (PR #70) are both confirmed merged; nothing since has drifted
  from either.
- Every file/line/behavior claim this Preflight re-checked against today's `aaf56ed` matches the
  Fresh Audit exactly, including the 5 `gameReducer.ts` carry-through sites and the
  `nextMissionOrderState` miss-risk site.
- Main is independently confirmed green in this session: 1188/1188 tests, clean typecheck, clean
  lint — not merely cited from a prior CI run.
- No schema bump needed; `PersistentSaveV2`'s `inventory` field is already correct and
  migration-safe.
- No open PR conflicts with E1's file scope; RESULT 2.0 is design-only and not yet implemented —
  landing E1 first is the lower-conflict sequencing choice, not a blocker either way.
- Scope, tests, and implementation order above are ready to execute as a single ~2-3 hour PR.

## Report summary

- **Audited SHA**: `aaf56edaea533f9efc63b3ba623bf1ae8425a6b5` (`main`, PR #68 merge).
- **Suite health**: 1188/1188 tests pass, `tsc -b` clean, `oxlint` clean — verified live in this
  session (`npm ci && npx vitest run && npx tsc -b && npx oxlint`).
- **Fresh Audit re-verification**: all 12 checked assumptions confirmed unchanged (§2).
- **Invariant**: ownership (`ownedIngredientIds`) vs. inventory (`inventory`) remain cleanly
  separated; Starter ingredients remain structurally, unconditionally unlimited.
- **Schema**: no bump — v2 already sufficient.
- **E1 file scope**: `src/state/inventory.ts` (new) + `gameReducer.ts` (5 known sites,
  `nextMissionOrderState` highest-risk) + `persistence.ts` (`ProgressionSnapshot`/
  `persistProgress`) + `App.tsx` (3 call sites) + tests.
- **Conflicts**: none open against current `main`; RESULT 2.0 (PR #71) is audit-only — sequencing
  note only, land E1 first.
- **Estimated time**: under 1.5 hours, comfortably inside the 2-3h slice target.
- **Final verdict**: **A. IMPLEMENT E1.**
