# Save v2 / Inventory E0 — Result Report

- **Audited `main` SHA:** `142a18252db56d9ee4c236cc80062673d5e68c80` (PR #55 merge, "Scoring 2.0
  Authority Fresh Audit (docs-only)" — matches the expected/authoritative SHA given for this
  session; confirmed via `git fetch origin && git rev-parse origin/main`).
- **Branch:** `claude/teto-e0-save-v2-migration-ly42xe`.
- **HEAD SHA:** `1aa61485dd3f3c1d6eb11f69aba1416061e6d65a`.
- **PR:** [#56 — Save v2 / Inventory E0: safe v1→v2 persistence migration](https://github.com/perusonao/teto-pizza-game/pull/56).
  **DO NOT MERGE** — open, pending ChatGPT Human Feel review per this session's instructions.
- **Design source:** `docs/reports/TETO_SAVE-V2_INVENTORY_Fresh-Audit.md` sec. 4-6 (audited SHA
  `2da3949de5bd642c709ca6ba343bc57d8101d03d`, verdict B — READY WITH MINOR DESIGN DECISIONS).
- **Scope:** persistence/migration only, per the audit's own E0 slice definition and this
  session's explicit scope guard. No `InventoryState`/`GameState` wiring (E1), no consumption
  (E2), no Shop 2.0 (E3), no Scoring/B1/B2, no Pitz reward changes, no Making changes.

---

## 1. What changed

Three files, all under `src/state/`:

- `persistence.ts` — the migration itself.
- `persistence.test.ts` — the migration test matrix.
- `phase4a1b.regression.test.ts` — one pre-existing assertion (`createDefaultSave()`'s exact key
  set) updated to include the new `inventory` field; no other change.

No `gameReducer.ts`, `GameState`, `App.tsx`, or UI file was touched — confirmed by inspection
before implementation (`App.tsx` only ever reads `save.dex`/`save.ownedIngredientIds`/
`save.pitzBalance`, never `save.inventory`), and by the full test suite passing unmodified
everywhere else.

## 2. Final `PersistentSaveV2` contract

```ts
const CURRENT_SCHEMA_VERSION = 2;

export interface PersistentSaveV2 {
  schemaVersion: 2;
  dex: DexEntry[];
  pitzBalance: number;
  ownedIngredientIds: string[];
  missionBest: Record<string, number>;
  inventory: Record<string, number>; // ingredientId -> stock, finite-stock ingredients only
}
```

- `dex` / `pitzBalance` / `ownedIngredientIds` / `missionBest`: unchanged in shape and meaning
  from `PersistentSaveV1` — same sanitizers, same semantics, carried through migration verbatim.
- `inventory` (new): a partial `ingredientId -> stock` map. Only ingredients with an
  `unlockCondition` (today: just `onion`) may appear as a key — `sanitizeInventory` strips any
  Starter ingredient id even if one is present in raw storage, so a Starter ingredient can never
  acquire finite stock semantics under any load path (fresh, migrated, or a future malformed
  save). An absent id reads back as 0 stock (InventoryState's job, E1 — not read by any
  gameplay code yet).

### Migration pipeline (`loadSave`)

1. Parse JSON. Anything that throws, or isn't an object → fresh `createDefaultSave()` (v2) —
   unchanged from v1's existing behavior.
2. `toIntermediateV2` dispatches on `schemaVersion`:
   - `1` + `dex` is an array → `migrateV1toV2` (below), producing a v2-shaped record.
   - `2` + `dex` is an array → passed through as-is.
   - anything else (root not an object, `dex` not an array under a claimed v1/v2, or an
     unrecognized version, e.g. a future v3) → `null` → fresh default. Unchanged safety
     boundary: a build can only migrate backward-known versions forward.
3. The result (migrated-or-passthrough) is run through the same per-field sanitizers
   (`sanitizeDex`, `sanitizePitzBalance`, `sanitizeOwnedIngredientIds`, `sanitizeMissionBest`,
   and the new `sanitizeInventory`) exactly as a v2 save already would be, regardless of which
   branch produced it.

### `migrateV1toV2` (standalone, deterministic)

```ts
export function migrateV1toV2(v1: PersistentSaveV1): PersistentSaveV2 {
  return {
    schemaVersion: 2,
    dex: v1.dex,
    pitzBalance: v1.pitzBalance,
    ownedIngredientIds: v1.ownedIngredientIds,
    missionBest: v1.missionBest,
    inventory: backfillInventoryForMigratedSave(v1.ownedIngredientIds),
  };
}
```

Exported, independently callable and testable — not inlined into the load pipeline, per the
audit's explicit instruction, so a future `migrateV2toV3` can be added the same way. Pure
function of its input (no `Date.now()`/`Math.random()`); calling it twice with the same input
returns an equal result both times.

### Write-back timing (existing behavior, unchanged)

`loadSave` itself never writes to storage — only `persistDex`/`persistProgress`/
`persistMissionBest` do, and each already skips a no-op write (this predates E0: see
`persistDex`'s "never overwrites a save with an unrecognized schemaVersion" regression test).
Consequence for E0: **a v1 save's on-disk bytes stay `schemaVersion: 1` until something in
`GameState` actually changes** (a new Dex entry, a Pitz change, a purchase) — every *load*
already returns the fully migrated v2 shape in memory (proven in the Review Playthrough, §6),
and the very next real write persists that migrated shape, `inventory` included, because
`persistProgress`/`persistMissionBest` both spread `...current` (the in-memory, already-migrated
`loadSave()` result) into what they write. This is the same "don't clobber a save you can't
fully make sense of on mere mount" property the module already had for `schemaVersion: 999`
saves before E0 — E0 does not change it, and no requirement in the audit calls for an eager
write-back.

## 3. Migration backfill quantity — value and rationale

```ts
export const DEFAULT_MIGRATION_RESTOCK_QTY = 4;
```

The audit deliberately left this exact value unresolved, instructing implementation time to
"inspect current ingredient/recipe quantities and choose the smallest defensible nonzero
compatibility value that prevents an existing purchased ingredient from becoming immediately
unusable," with no broader economy balancing.

- `onion` (`src/data/ingredients.ts`) is today's **only** ingredient with an `unlockCondition` —
  the only ingredient a migration backfill could ever apply to.
- `fugazza` (`src/data/recipes.ts`) is `onion`'s **only** consuming recipe, and requires
  `{ ingredientId: "onion", minCount: 4 }`.
- A backfill smaller than 4 (e.g. 1) would migrate an existing purchaser of `onion` into a save
  that still nominally "owns" it but can never place enough of it for a fully on-recipe Fugazza
  — exactly the "bought but can't use it" dead end the audit's §6 requires E0 to avoid, just one
  purchase later than the literal first pizza.
- `4` is therefore the smallest quantity that lets the one real recipe requiring a purchased
  ingredient be prepared at its designed quantity immediately after migration. This is reading
  existing data, not an economy/balance judgment — no broader tuning was performed, per
  instruction.

Starter ingredients never receive a backfill entry at all — `backfillInventoryForMigratedSave`
skips any id in `STARTER_INGREDIENT_IDS`, so they remain structurally unlimited (no `inventory`
key at all, not merely a large number) through migration, exactly as required.

## 4. Migration test matrix

All in `src/state/persistence.test.ts` (new describe blocks), plus one updated pre-existing
assertion in `phase4a1b.regression.test.ts`.

| Requirement | Test(s) | Result |
|---|---|---|
| Standalone `migrateV1toV2` unit, carries fields through unchanged | `migrateV1toV2 (Save v2 / Inventory E0, standalone unit)` — 5 tests | ✅ pass |
| Existing valid v1 progression migrates intact | `loadSave: v1 -> v2 migration pipeline` — "migrates an existing valid v1 progression intact" | ✅ pass |
| v1 with purchased onion receives migration stock | same block — "a v1 save with a purchased onion migrates into a nonzero onion stock" | ✅ pass |
| v1 without onion does not incorrectly receive finite stock | same block — "a v1 save that never purchased onion does not incorrectly receive finite onion stock" | ✅ pass |
| Starter ingredients never get finite stock via migration | same block — "never attaches finite stock to a Starter ingredient via migration" | ✅ pass |
| Migration deterministic/idempotent | `migrateV1toV2(...)` pure-function test + "migrating the same stored v1 save repeatedly (no write-back) is deterministic/idempotent" | ✅ pass |
| v2 round-trip | `loadSave: v2 sanitize/pass-through` — "round-trips an already-v2 save unchanged" + idempotent re-load test | ✅ pass |
| Sanitization of invalid inventory entries | same block — "sanitizes invalid inventory entries: drops unknown ids, negative/non-integer values, and Starter ids" + malformed-inventory-shape test | ✅ pass |
| Malformed JSON/root fallback | `loadSave: malformed/unrecognized-schema fallback` — malformed JSON test (+ all pre-existing v1-era malformed-root tests, unmodified, still pass) | ✅ pass |
| Unsupported future schema fallback | same block — "falls back to fresh on an unrecognized future schemaVersion (e.g. a hypothetical v3)" | ✅ pass |
| Preview/production storage namespace isolation | `Preview/production storage namespace isolation` — 2 tests, `vi.resetModules()` + dynamic re-import (required since `SAVE_STORAGE_KEY` is fixed at module load) | ✅ pass |
| Existing persistence regression suite | every pre-existing test in `persistence.test.ts` (unmodified) | ✅ pass |

## 5. Tests / typecheck / lint / build

```
npx vitest run src/state/persistence.test.ts src/state/phase4a1b.regression.test.ts
  Test Files  2 passed (2)
       Tests  72 passed (72)

npx vitest run   (full suite)
  Test Files  54 passed (54)
       Tests  999 passed (999)

npx tsc -b        # clean, no output
npx oxlint        # clean, no output
npx vite build    # ✓ built in 183ms
```

(One typecheck-only fix was needed and is included in the commit: `migrateV1toV2(v1)`'s return
value needed an explicit cast to `Record<string, unknown>` inside `toIntermediateV2`, since
`PersistentSaveV2` — correctly — has no index signature. No runtime behavior change.)

## 6. CI

PR #56, head SHA `1aa61485dd3f3c1d6eb11f69aba1416061e6d65a`: `build` check run —
**completed / success**
([run 35294694496](https://github.com/perusonao/teto-pizza-game/actions/runs/35294694496)).

## 7. Preview deployment

**Preview repo:** `perusonao/teto-pizza-game-preview`
**Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/

Dispatched the existing manual pipeline (unchanged, no workflow files touched):

1. `deploy-from-source.yml` (`workflow_dispatch`, `ref=1aa61485dd3f3c1d6eb11f69aba1416061e6d65a`,
   `pr_number=56`) — **success**. Confirmed via the repo's `README.md` immediately after the run:
   `Source ref: 1aa61485...`, `Source commit: 1aa61485...`, `Source PR: #56`.
2. **Contention note:** this Preview repo has a single shared `site/` slot with no per-PR
   isolation, and other sessions were deploying their own previews to it concurrently (observed
   `pages.yml` runs for `b17db55` and a `claude/scoring2-bake-component-383kgw` branch landing
   within ~2 minutes of this session's own dispatch — consistent with parallel B1/B2/other work
   this session was explicitly told not to disturb). The live site can therefore show a
   different branch's build again by the time a human opens it, through no code defect — this is
   the shared preview infrastructure's own current limitation, not something E0 introduced or
   can fix from a persistence-only PR. Re-dispatching `deploy-from-source.yml` for this exact
   commit/PR immediately before handing off is the practical mitigation available.
3. `pages.yml` dispatched as the publish step, **success**.

**Preview badge expected:** `PREVIEW · PR#56 · 1aa6148` if this exact deploy is still the live
one at the time it's opened — re-run `deploy-from-source.yml` with the inputs above if a
concurrent session's deploy has since overwritten it (see contention note above).

**Network access caveat (session-local, not a product issue):** this sandbox's outbound network
policy blocks arbitrary internet hosts, including `perusonao.github.io` itself (`curl` to the
live Preview URL returns a proxy `403`/`CONNECT tunnel failed`) — the same limitation prior
sessions' Preview-Gate reports recorded (see `docs/reports/TETO_ISSUE-39_PS1-PS2_Preview-Gate.md`
§3). Verified instead via the GitHub API: both `deploy-from-source.yml` (run
[35295152959's predecessor build]) and the final `pages.yml` publish
([run 35295152959](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35295152959),
head_sha `b869209...`, commit message `Deploy preview: 1aa61485... (1aa6148)`) completed
successfully against this exact commit, and confirmed the repo's own `README.md` reflects
`Source PR: #56` / `Source commit: 1aa61485...`. This does not replace the Human Feel gate — the
user should still open the real Preview URL to confirm on a real device before merging.

## 8. Review Playthrough

Given the shared Preview slot's contention risk (§7) and that a 390×844 headless-Chromium
smoke test against `npm run dev`'s local server is byte-for-byte the same application code path
(the only difference from the deployed Preview build is `VITE_PREVIEW_MODE`, which affects only
the on-screen badge and the storage key namespace — see `src/state/persistence.ts`'s own
`SAVE_STORAGE_KEY` gate, untouched by this PR), this session drove the actual dev server directly
at viewport 390×844 for a reliable, reproducible capture, and separately re-dispatched the
Preview deploy for the user to open on a real device.

**Scenario** (script: seeds a real pre-E0 `PersistentSaveV1` directly into `localStorage`, then
drives the real, unmodified `App.tsx` — no debug UI added):

1. Seed `teto-pizza-save-v1` with a structurally-valid v1 save: Dex (`margherita` BEST 91★5,
   `funghi` BEST 74★3), `pitzBalance: 250`, `ownedIngredientIds` including `onion`,
   `missionBest: { "lunch-rush": 640 }`.
2. Reload — HOME renders, Pitz badge shows `🪙 250`.
3. HOME → Pizza Select — マルゲリータ card renders `最高評価5つ星、BEST 91` (Dex/BEST survived).
4. Select マルゲリータ → lands on `.game-screen` (ordinary pizza flow still starts).
5. Reload again — Pitz badge still `🪙 250`, マルゲリータ card still `5つ星、BEST 91`
   (progression retained across reload).
6. Direct integration check: dynamically imported the real served `persistence.ts` module and
   called the shipped `loadSave()`/`persistProgress()` — confirmed in-memory `loadSave()` already
   returns `schemaVersion: 2` with `inventory: { onion: 4 }` and every v1 field intact, and that
   a real write (a `pitzBalance` change) persists that exact v2 shape, `inventory` included, to
   `localStorage` (see §2's write-back timing note for why the raw bytes stay v1 until this
   point).
7. Zero console/page errors observed throughout.

**MP4:** `artifacts/review/TETO_SAVE-V2_E0_Review-Playthrough.mp4` (390×844, H.264, ~9.4s) —
delivered directly to the user, **not committed** (`artifacts/` is gitignored per project
convention).

## 9. Remaining risks

- **Shared Preview slot contention** (§7) — not an E0 defect, but the Preview URL's live content
  can change out from under any single PR at any time while multiple sessions work in parallel.
  Re-dispatch `deploy-from-source.yml` with this PR's exact `ref`/`pr_number` immediately before
  a human opens it if in doubt.
- **Lazy write-back** (§2) — a migrated save's on-disk bytes stay `schemaVersion: 1` until an
  actual progression change triggers a write. This is pre-existing, intentional behavior
  (predates E0), proven correct in-memory and at the next real write (§8 step 6), but is worth
  flagging explicitly since it means inspecting raw `localStorage` alone right after a mere
  reload is not, by itself, proof migration ran — the app's rendered state and the next real
  write are the correct places to look, both demonstrated above.
- **E1 dependency**: `inventory` is fully round-trippable but inert — nothing reads it yet. This
  is by design (E0's own scope boundary) but means E0 alone has no player-visible effect; that is
  expected and matches "safe migration without changing gameplay."

## 10. E0 Human Feel / review readiness

E0 is persistence/migration-only and, by design, has no visible gameplay effect — the Review
Playthrough above exists to demonstrate exactly that "nothing changed" claim is true for a real
returning player's save, not to surface a new interaction to judge for feel. Per this session's
instructions: **implementation, focused/full tests, typecheck/lint/build, commit/push, PR, CI,
Preview deploy, Preview smoke test, and the targeted Review Playthrough are all complete.**
**STOPPING here for ChatGPT review, as instructed — PR #56 is explicitly marked DO NOT MERGE**
pending that review.
