# Discovery Hint 3.0 — H3-2 Persistence / Legacy Migration: Result (Issue #238)

**Verdict: A. H3-2 FINAL GATE PASS — PR READY FOR OWNER REVIEW** (pending the CI rows in §22, which
are filled in once CI finishes on the PR head).

The Step 0 Integration Map (§0) was committed before any code (`cfece82`). Sections 1–26 follow the
order the task asked for.

## 0. Step 0 — Fresh persistence audit (before code)

Audited `main` = `1faa83f` (Merge PR #241, H3-1). A parallel Dinner DM-3 PR (#243) is open; its
diff touches no persistence, hint or discovery file, so it does not overlap with this work.

| Item | Current authority on `main` |
|---|---|
| `CURRENT_SCHEMA_VERSION` | **2** (`src/state/persistence.ts`). Key `teto-pizza-save-v1`, or the preview key. |
| Read path | `loadSave` → `sanitizeSave` → `toIntermediateV2`. A v1 save is migrated forward by `migrateV1toV2`; v2 is validated field by field; any other version falls back to the defaults. `loadSave` **never writes**. |
| Write path | Every write goes through `writeSave`. It re-reads raw storage, `extractForwardCompatExtras`, and merges: known fields win, extras are only appended. |
| Forward compatibility (Phase 3-4B) | An unknown **top-level key** is kept verbatim (`extras.topLevel`, anything not in `KNOWN_SAVE_KEYS`). Well-formed unknown ids (`FORWARD_COMPAT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/`) are kept inside the known ledgers `dex`, `ownedIngredientIds`, `inventory`, `starterGrantClaimedRecipeIds`, `unlockedForShopIngredientIds` and `discoveryHintPurchases`. Malformed values are dropped. |
| Additive fields added without a bump (precedent) | `starterGrantClaimedRecipeIds` (EP4), `unlockedForShopIngredientIds` (I4b-2), `discoveryHintPurchases` (HE-1). Each follows the same rule: an absent or malformed value reads back as an empty default. |
| `discoveryHintPurchases` | `Record<recipeId, positive integer level>`. Only known recipe ids reach `loadSave`; unknown ids survive in extras. It has no upper bound, and gameplay clamps it with `purchasedHintLevel`. `persistProgress` merges it per id with **max**. `writeSave` merges extras first, then `next`. |
| Hint Economy purchase save path | `PURCHASE_DISCOVERY_HINT` in the reducer raises the level, then `App.tsx` `persistProgress({..., discoveryHintPurchases})`. This runtime stays unchanged in H3-2. |
| Full Reset | `resetSave()`, called from `App.tsx:781` via SettingsOverlay, **removes the whole key**. It then verifies the key is gone. |
| No-op write guard | `persistProgress` skips the write when nothing differs from `loadSave`. That protects a save this build doesn't fully recognize on mount. |
| Existing tests | `persistence.test.ts`, `persistence.forwardCompat.test.ts`, `persistence.shopEntitlement.test.ts`, `persistence.discoveryHintPurchases.test.ts`. Storage e2e: `e2e/save-forward-compat-3-4b.spec.ts` plus the hint e2e specs that read the save. |

### 0.1 Plan derived from the audit

- **New optional top-level field `discoveryHintFacts: Record<recipeId, string[]>`** (H3-1 fact ids,
  e.g. `ing:mozzarella`). Absent or malformed reads back as `{}`.
- **schemaVersion stays 2, provided these conditions hold** (§4):
  - the field is additive and optional;
  - an old save loads, with `{}` as the missing-field default;
  - forward compatibility is kept;
  - the old ledger coexists;
  - no existing value changes meaning.
- **Old build (today's `main`) reading a new save:** `discoveryHintFacts` is not in its
  `KNOWN_SAVE_KEYS`, so its `writeSave` carries the whole value verbatim through `extras.topLevel`.
  This is verified by a real round-trip against the `main` persistence module (§17).
- **Unknown ids:**
  - An unknown recipe id and an unknown or future fact id (`tech:…`, `finish:…`) are both kept in
    storage.
  - Pricing and display ignore them (fail closed, as H3-1 already does).
  - Keys are built on null-prototype objects, so `__proto__` / `constructor` / `prototype` cannot
    pollute anything.
- **Legacy `discoveryHintPurchases`:**
  - It stays as a read-compatible legacy authority.
  - It is never deleted or rewritten by the migration.
  - The still-live Hint 2.0 runtime keeps writing it until H3-3 switches the runtime.
  - New Hint 3.0 purchases (from H3-3 on) go to `discoveryHintFacts` only.
- **Migration is a derived view, never a destructive rewrite.**
  - Legacy level L → `LegacyHintProgress { paidRungs: L (clamped), grantedFactIds: the positive
    ingredients actually named by the Hint 2.0 lines ≤ L }`, computed from `buildHintSteps` itself.
  - Nothing is copied into the new ledger, so a repeated migration is idempotent by construction.
- **No runtime wiring:** no reducer, UI, CSS or routing change. `App.tsx` does not pass the new field
  yet (H3-3).

---

## 1. Audited main SHA

`1faa83f` (Merge PR #241, H3-1), re-checked on GitHub at the start of the session. `main` did not
move during implementation. The branch `claude/discovery-hint-3-selectable-audit-w3ebl2` was
restarted from `1faa83f`: its previous history was entirely merged by #241.

## 2. Duplicate Gate

No H3-2 issue or PR exists. A search for "Discovery Hint 3.0 H3-2 persistence migration
discoveryHintFacts" finds only #238 (open, the parent), #232 (closed) and #229 (closed).

- No new parent issue and no sub-issue was created. #238 tracks H3-2.
- The open Dinner DM-3 PR #243 touches no persistence, hint or discovery file, so there is no
  overlap.

## 3. Issue state

#238 stays **OPEN** as the Hint 3.0 parent. Its body was rewritten from the stale
"H3-1 BLOCKED" status to a status table:

- H3-1 = MERGED (#241, `1faa83f`) / post-merge PASS
- **H3-2 = IN PROGRESS**
- H3-3 / H3-4 = not started

## 4. Schema decision: **schemaVersion stays 2**

Every condition for keeping 2 holds, and each is verified by a test:

| Condition | Evidence |
|---|---|
| Additive optional field | `discoveryHintFacts` is a new top-level key; no existing key changes shape or meaning. The three pinned save-key lists (`persistence.test.ts`, `phase4a1b.regression.test.ts`, `gameReducer.discovery.test.ts`) were updated deliberately, exactly as HE-1 updated them for `discoveryHintPurchases`. |
| An old save loads safely | Fixtures 1–13: pre-Economy, H0–H4, mixed, unknown ids, malformed, future level, unknown top-level, missing field. All load through `loadSave`. |
| The missing field has a deterministic default | Absent or malformed → `{}`. A v1 save → `{}` via `migrateV1toV2`. |
| Forward compatibility is kept | The key is added to `KNOWN_SAVE_KEYS`. Unknown recipe ids ride `extractForwardCompatExtras`. Unknown or future fact kinds are kept by the wider stored-id pattern (§13). |
| Old data coexists | The legacy `discoveryHintPurchases` is untouched and still max-merged. Both ledgers load together (fixture 15). |
| No destructive change of meaning | Nothing is reinterpreted. The migration is a derived read (§8); it never writes to either ledger. |

An unrecognized `schemaVersion` still falls back to the defaults (test), which is the unchanged
boundary.

## 5. Old persistence authority

The authority is unchanged. See §0: every write goes through `writeSave`, which merges
forward-compat extras; `loadSave` never writes; `persistProgress` skips no-op writes; `resetSave`
removes the key.

## 6. New field

```ts
discoveryHintFacts: Record<recipeId, string[]>   // e.g. { "napoletana": ["ing:mozzarella"] }
```

- **Values are H3-1 stable fact ids.** They are stored under a deliberately wider pattern
  `^[a-z][a-z0-9-]{0,15}(:[a-z0-9][a-z0-9_-]{0,63}){1,2}$`, so later kinds (`tech:`, `finish:`,
  `shape:`, `pan:`, `cook:` and more) are kept.
- **Normalization:** duplicates are removed in first-occurrence order, each recipe keeps at most 64
  ids (`MAX_STORED_HINT_FACTS_PER_RECIPE`), and empty entries are dropped.
- **Merge:** per-recipe set union, in `persistProgress` and in `writeSave`'s extras merge. An id is
  never removed except by `resetSave`.
- **Object safety:** the record is built on null-prototype objects (`emptyHintFacts`).
- **Snapshot field:** `ProgressionSnapshot.discoveryHintFacts` is optional. Absent means "leave
  stored as is". **No production caller passes it yet**; H3-3 will.

## 7. Legacy field authority

`discoveryHintPurchases` is unchanged in shape, sanitizer, max-merge and forward-compat.

- **Read path:** it is the read-compatible legacy progress. `legacyHintMapping` and
  `selectableHintSavedState` read it and never write it.
- **Write path now:** until H3-3 switches the runtime, the live Hint 2.0 / Economy 1.0 purchase
  (`PURCHASE_DISCOVERY_HINT`) keeps writing levels to it exactly as before. This is an explicit
  no-runtime-change rule for H3-2.
- **Write path from H3-3:** new Hint 3.0 purchases write `discoveryHintFacts` only. The legacy level
  is never advanced by a Hint 3.0 purchase and is never deleted.

## 8. Migration algorithm (`src/logic/discovery/hintFactMigration.ts`, pure, unwired)

1. Read the stored level for the recipe. An own property is required, so hostile or inherited keys
   are ignored. Clamp it to the recipe's last level with `purchasedHintLevel`. Malformed → H0.
2. The visible lines are `buildHintSteps(recipe, { discoveredCount: 1 })` at levels ≤ L. These are
   the paid context: the Dex-0 onboarding is free and was never saved.
3. `grantedFactIds` = every ingredient those lines **named**, as `ing:<id>`, in line order. The key
   is included, and is free under Hint 3.0 anyway.
4. Lines that named no ingredient (H3's count + cheese line, the coarse "not tomato" line) become
   `progressOnlySteps`. **No fact is fabricated for them** (OD-H3-7 forbids count and negative
   facts). Their value is kept twice:
   - as paid progress (`paidRungs`);
   - and, after the Codex P2 review on PR #244, **verbatim as `grandfatheredSteps`** in the saved
     state.

   So the text the player already paid for survives the cutover. These lines only ever exist for a
   player who bought them, are never sold again, and are never a fact.
5. `legacy = { paidRungs: L, grantedFactIds }` is the H3-1 `LegacyHintProgress` input.
   `selectableHintSavedState(recipe, save)` returns `{ purchasedFactIds (the new ledger as stored),
   legacy, grandfatheredSteps }`: H3-3's whole input. `legacy` is typed `MigratedLegacyProgress`
   (well-typed, assignable to H3-1's `unknown`-typed input).
6. Nothing is written. Reading twice gives the same result, so the migration is idempotent by
   construction (tested with frozen inputs).

## 9. 25 recipes × H0–H4 migration matrix

These rows come from the real modules. 116 rows = 125 − 9 clamped duplicates: the 9 recipes whose
last level is H3 have no separate H4.

Column meanings:
- **Visible**: what the old sheet showed. `count+cheese` and `not-tomato` are the lines that named
  no ingredient.
- **Granted**: the positive facts the player owns after migration.
- **Prog-only**: the number of lines kept as paid progress only.
- **Next**: the H3-1 next price.
- **Left**: purchasable facts still unowned.
- **Lost / Dup**: lost information, and facts that could be sold again.

| Recipe | Legacy | Visible (after H0) | Granted facts | Prog-only | Paid rungs | Next | Left | Lost | Dup |
|---|---|---|---|---:|---:|---:|---:|---:|---:|
| margherita | H0 | — | — | 0 | 0 | 5 | 2 | 0 | 0 |
| margherita | H1 | tomato-sauce | tomato-sauce | 0 | 1 | 10 | 1 | 0 | 0 |
| margherita | H2 | tomato-sauce, count+cheese | tomato-sauce | 1 | 2 | 20 | 1 | 0 | 0 |
| margherita | H3 | tomato-sauce, count+cheese, mozzarella | tomato-sauce, mozzarella | 1 | 3 | 0 | 0 | 0 | 0 |
| marinara | H0 | — | — | 0 | 0 | 5 | 1 | 0 | 0 |
| marinara | H1 | garlic | garlic | 0 | 1 | 10 | 1 | 0 | 0 |
| marinara | H2 | garlic, tomato-sauce | garlic, tomato-sauce | 0 | 2 | 20 | 0 | 0 | 0 |
| marinara | H3 | garlic, tomato-sauce, count+cheese | garlic, tomato-sauce | 1 | 3 | 0 | 0 | 0 | 0 |
| quattro-formaggi | H0 | — | — | 0 | 0 | 5 | 3 | 0 | 0 |
| quattro-formaggi | H1 | gorgonzola | gorgonzola | 0 | 1 | 10 | 3 | 0 | 0 |
| quattro-formaggi | H2 | gorgonzola, olive-oil | gorgonzola, olive-oil | 0 | 2 | 20 | 2 | 0 | 0 |
| quattro-formaggi | H3 | gorgonzola, olive-oil, count+cheese | gorgonzola, olive-oil | 1 | 3 | 40 | 2 | 0 | 0 |
| quattro-formaggi | H4 | gorgonzola, olive-oil, count+cheese, mozzarella, parmigiano | gorgonzola, olive-oil, mozzarella, parmigiano | 1 | 4 | 0 | 0 | 0 | 0 |
| genovese | H0 | — | — | 0 | 0 | 5 | 1 | 0 | 0 |
| genovese | H1 | cherry-tomato | cherry-tomato | 0 | 1 | 10 | 1 | 0 | 0 |
| genovese | H2 | cherry-tomato, pesto | cherry-tomato, pesto | 0 | 2 | 20 | 0 | 0 | 0 |
| genovese | H3 | cherry-tomato, pesto, count+cheese | cherry-tomato, pesto | 1 | 3 | 0 | 0 | 0 | 0 |
| bismarck | H0 | — | — | 0 | 0 | 5 | 1 | 0 | 0 |
| bismarck | H1 | egg | egg | 0 | 1 | 10 | 1 | 0 | 0 |
| bismarck | H2 | egg, tomato-sauce | egg, tomato-sauce | 0 | 2 | 20 | 0 | 0 | 0 |
| bismarck | H3 | egg, tomato-sauce, count+cheese | egg, tomato-sauce | 1 | 3 | 0 | 0 | 0 | 0 |
| funghi | H0 | — | — | 0 | 0 | 5 | 1 | 0 | 0 |
| funghi | H1 | mushroom | mushroom | 0 | 1 | 10 | 1 | 0 | 0 |
| funghi | H2 | mushroom, tomato-sauce | mushroom, tomato-sauce | 0 | 2 | 20 | 0 | 0 | 0 |
| funghi | H3 | mushroom, tomato-sauce, count+cheese | mushroom, tomato-sauce | 1 | 3 | 0 | 0 | 0 | 0 |
| fugazza | H0 | — | — | 0 | 0 | 5 | 1 | 0 | 0 |
| fugazza | H1 | olive-oil | olive-oil | 0 | 1 | 10 | 1 | 0 | 0 |
| fugazza | H2 | olive-oil, count+cheese | olive-oil | 1 | 2 | 20 | 1 | 0 | 0 |
| fugazza | H3 | olive-oil, count+cheese, onion | olive-oil, onion | 1 | 3 | 0 | 0 | 0 | 0 |
| salsiccia | H0 | — | — | 0 | 0 | 5 | 1 | 0 | 0 |
| salsiccia | H1 | sausage | sausage | 0 | 1 | 10 | 1 | 0 | 0 |
| salsiccia | H2 | sausage, tomato-sauce | sausage, tomato-sauce | 0 | 2 | 20 | 0 | 0 | 0 |
| salsiccia | H3 | sausage, tomato-sauce, count+cheese | sausage, tomato-sauce | 1 | 3 | 0 | 0 | 0 | 0 |
| pepperoni | H0 | — | — | 0 | 0 | 5 | 1 | 0 | 0 |
| pepperoni | H1 | pepperoni | pepperoni | 0 | 1 | 10 | 1 | 0 | 0 |
| pepperoni | H2 | pepperoni, tomato-sauce | pepperoni, tomato-sauce | 0 | 2 | 20 | 0 | 0 | 0 |
| pepperoni | H3 | pepperoni, tomato-sauce, count+cheese | pepperoni, tomato-sauce | 1 | 3 | 0 | 0 | 0 | 0 |
| napoletana | H0 | — | — | 0 | 0 | 5 | 2 | 0 | 0 |
| napoletana | H1 | anchovy | anchovy | 0 | 1 | 10 | 2 | 0 | 0 |
| napoletana | H2 | anchovy, tomato-sauce | anchovy, tomato-sauce | 0 | 2 | 20 | 1 | 0 | 0 |
| napoletana | H3 | anchovy, tomato-sauce, count+cheese | anchovy, tomato-sauce | 1 | 3 | 40 | 1 | 0 | 0 |
| napoletana | H4 | anchovy, tomato-sauce, count+cheese, mozzarella | anchovy, tomato-sauce, mozzarella | 1 | 4 | 0 | 0 | 0 | 0 |
| tonno-e-cipolla | H0 | — | — | 0 | 0 | 5 | 2 | 0 | 0 |
| tonno-e-cipolla | H1 | tuna | tuna | 0 | 1 | 10 | 2 | 0 | 0 |
| tonno-e-cipolla | H2 | tuna, tomato-sauce | tuna, tomato-sauce | 0 | 2 | 20 | 1 | 0 | 0 |
| tonno-e-cipolla | H3 | tuna, tomato-sauce, count+cheese | tuna, tomato-sauce | 1 | 3 | 40 | 1 | 0 | 0 |
| tonno-e-cipolla | H4 | tuna, tomato-sauce, count+cheese, mozzarella | tuna, tomato-sauce, mozzarella | 1 | 4 | 0 | 0 | 0 | 0 |
| pizza-bianca | H0 | — | — | 0 | 0 | 5 | 0 | 0 | 0 |
| pizza-bianca | H1 | rosemary | rosemary | 0 | 1 | 10 | 0 | 0 | 0 |
| pizza-bianca | H2 | rosemary, not-tomato | rosemary | 1 | 2 | 20 | 0 | 0 | 0 |
| pizza-bianca | H3 | rosemary, not-tomato, count+cheese | rosemary | 2 | 3 | 0 | 0 | 0 | 0 |
| breakfast-pizza | H0 | — | — | 0 | 0 | 5 | 2 | 0 | 0 |
| breakfast-pizza | H1 | bacon | bacon | 0 | 1 | 10 | 2 | 0 | 0 |
| breakfast-pizza | H2 | bacon, tomato-sauce | bacon, tomato-sauce | 0 | 2 | 20 | 1 | 0 | 0 |
| breakfast-pizza | H3 | bacon, tomato-sauce, count+cheese | bacon, tomato-sauce | 1 | 3 | 40 | 1 | 0 | 0 |
| breakfast-pizza | H4 | bacon, tomato-sauce, count+cheese, mozzarella | bacon, tomato-sauce, mozzarella | 1 | 4 | 0 | 0 | 0 | 0 |
| capricciosa | H0 | — | — | 0 | 0 | 5 | 4 | 0 | 0 |
| capricciosa | H1 | oregano | oregano | 0 | 1 | 10 | 4 | 0 | 0 |
| capricciosa | H2 | oregano, tomato-sauce | oregano, tomato-sauce | 0 | 2 | 20 | 3 | 0 | 0 |
| capricciosa | H3 | oregano, tomato-sauce, count+cheese | oregano, tomato-sauce | 1 | 3 | 40 | 3 | 0 | 0 |
| capricciosa | H4 | oregano, tomato-sauce, count+cheese, mozzarella, mushroom, ham | oregano, tomato-sauce, mozzarella, mushroom, ham | 1 | 4 | 0 | 0 | 0 | 0 |
| meat-lovers | H0 | — | — | 0 | 0 | 5 | 4 | 0 | 0 |
| meat-lovers | H1 | ham | ham | 0 | 1 | 10 | 4 | 0 | 0 |
| meat-lovers | H2 | ham, tomato-sauce | ham, tomato-sauce | 0 | 2 | 20 | 3 | 0 | 0 |
| meat-lovers | H3 | ham, tomato-sauce, count+cheese | ham, tomato-sauce | 1 | 3 | 40 | 3 | 0 | 0 |
| meat-lovers | H4 | ham, tomato-sauce, count+cheese, mozzarella, bacon, pepperoni | ham, tomato-sauce, mozzarella, bacon, pepperoni | 1 | 4 | 0 | 0 | 0 | 0 |
| melanzane-pizza | H0 | — | — | 0 | 0 | 5 | 2 | 0 | 0 |
| melanzane-pizza | H1 | eggplant | eggplant | 0 | 1 | 10 | 2 | 0 | 0 |
| melanzane-pizza | H2 | eggplant, tomato-sauce | eggplant, tomato-sauce | 0 | 2 | 20 | 1 | 0 | 0 |
| melanzane-pizza | H3 | eggplant, tomato-sauce, count+cheese | eggplant, tomato-sauce | 1 | 3 | 40 | 1 | 0 | 0 |
| melanzane-pizza | H4 | eggplant, tomato-sauce, count+cheese, mozzarella | eggplant, tomato-sauce, mozzarella | 1 | 4 | 0 | 0 | 0 | 0 |
| parmigiana-pizza | H0 | — | — | 0 | 0 | 5 | 3 | 0 | 0 |
| parmigiana-pizza | H1 | parmigiano | parmigiano | 0 | 1 | 10 | 3 | 0 | 0 |
| parmigiana-pizza | H2 | parmigiano, tomato-sauce | parmigiano, tomato-sauce | 0 | 2 | 20 | 2 | 0 | 0 |
| parmigiana-pizza | H3 | parmigiano, tomato-sauce, count+cheese | parmigiano, tomato-sauce | 1 | 3 | 40 | 2 | 0 | 0 |
| parmigiana-pizza | H4 | parmigiano, tomato-sauce, count+cheese, mozzarella, eggplant | parmigiano, tomato-sauce, mozzarella, eggplant | 1 | 4 | 0 | 0 | 0 | 0 |
| bambino | H0 | — | — | 0 | 0 | 5 | 2 | 0 | 0 |
| bambino | H1 | corn | corn | 0 | 1 | 10 | 2 | 0 | 0 |
| bambino | H2 | corn, tomato-sauce | corn, tomato-sauce | 0 | 2 | 20 | 1 | 0 | 0 |
| bambino | H3 | corn, tomato-sauce, count+cheese | corn, tomato-sauce | 1 | 3 | 40 | 1 | 0 | 0 |
| bambino | H4 | corn, tomato-sauce, count+cheese, mozzarella | corn, tomato-sauce, mozzarella | 1 | 4 | 0 | 0 | 0 | 0 |
| hawaiian | H0 | — | — | 0 | 0 | 5 | 2 | 0 | 0 |
| hawaiian | H1 | pineapple | pineapple | 0 | 1 | 10 | 2 | 0 | 0 |
| hawaiian | H2 | pineapple, tomato-sauce | pineapple, tomato-sauce | 0 | 2 | 20 | 1 | 0 | 0 |
| hawaiian | H3 | pineapple, tomato-sauce, count+cheese | pineapple, tomato-sauce | 1 | 3 | 40 | 1 | 0 | 0 |
| hawaiian | H4 | pineapple, tomato-sauce, count+cheese, mozzarella | pineapple, tomato-sauce, mozzarella | 1 | 4 | 0 | 0 | 0 | 0 |
| pizza-portuguesa | H0 | — | — | 0 | 0 | 5 | 4 | 0 | 0 |
| pizza-portuguesa | H1 | onion | onion | 0 | 1 | 10 | 4 | 0 | 0 |
| pizza-portuguesa | H2 | onion, tomato-sauce | onion, tomato-sauce | 0 | 2 | 20 | 3 | 0 | 0 |
| pizza-portuguesa | H3 | onion, tomato-sauce, count+cheese | onion, tomato-sauce | 1 | 3 | 40 | 3 | 0 | 0 |
| pizza-portuguesa | H4 | onion, tomato-sauce, count+cheese, mozzarella, ham, egg | onion, tomato-sauce, mozzarella, ham, egg | 1 | 4 | 0 | 0 | 0 | 0 |
| pesto-tonno | H0 | — | — | 0 | 0 | 5 | 2 | 0 | 0 |
| pesto-tonno | H1 | pesto | pesto | 0 | 1 | 10 | 2 | 0 | 0 |
| pesto-tonno | H2 | pesto, count+cheese | pesto | 1 | 2 | 20 | 2 | 0 | 0 |
| pesto-tonno | H3 | pesto, count+cheese, tuna | pesto, tuna | 1 | 3 | 40 | 1 | 0 | 0 |
| pesto-tonno | H4 | pesto, count+cheese, tuna, black-olive | pesto, tuna, black-olive | 1 | 4 | 0 | 0 | 0 | 0 |
| new-haven-apizza | H0 | — | — | 0 | 0 | 5 | 2 | 0 | 0 |
| new-haven-apizza | H1 | clam | clam | 0 | 1 | 10 | 2 | 0 | 0 |
| new-haven-apizza | H2 | clam, olive-oil | clam, olive-oil | 0 | 2 | 20 | 1 | 0 | 0 |
| new-haven-apizza | H3 | clam, olive-oil, count+cheese | clam, olive-oil | 1 | 3 | 40 | 1 | 0 | 0 |
| new-haven-apizza | H4 | clam, olive-oil, count+cheese, parmigiano | clam, olive-oil, parmigiano | 1 | 4 | 0 | 0 | 0 | 0 |
| pesto-caprese | H0 | — | — | 0 | 0 | 5 | 2 | 0 | 0 |
| pesto-caprese | H1 | fresh-tomato | fresh-tomato | 0 | 1 | 10 | 2 | 0 | 0 |
| pesto-caprese | H2 | fresh-tomato, pesto | fresh-tomato, pesto | 0 | 2 | 20 | 1 | 0 | 0 |
| pesto-caprese | H3 | fresh-tomato, pesto, count+cheese | fresh-tomato, pesto | 1 | 3 | 40 | 1 | 0 | 0 |
| pesto-caprese | H4 | fresh-tomato, pesto, count+cheese, mozzarella | fresh-tomato, pesto, mozzarella | 1 | 4 | 0 | 0 | 0 | 0 |
| pesto-patate | H0 | — | — | 0 | 0 | 5 | 2 | 0 | 0 |
| pesto-patate | H1 | potato | potato | 0 | 1 | 10 | 2 | 0 | 0 |
| pesto-patate | H2 | potato, pesto | potato, pesto | 0 | 2 | 20 | 1 | 0 | 0 |
| pesto-patate | H3 | potato, pesto, count+cheese | potato, pesto | 1 | 3 | 40 | 1 | 0 | 0 |
| pesto-patate | H4 | potato, pesto, count+cheese, mozzarella | potato, pesto, mozzarella | 1 | 4 | 0 | 0 | 0 | 0 |
| puttanesca-pizza | H0 | — | — | 0 | 0 | 5 | 3 | 0 | 0 |
| puttanesca-pizza | H1 | capers | capers | 0 | 1 | 10 | 3 | 0 | 0 |
| puttanesca-pizza | H2 | capers, tomato-sauce | capers, tomato-sauce | 0 | 2 | 20 | 2 | 0 | 0 |
| puttanesca-pizza | H3 | capers, tomato-sauce, count+cheese | capers, tomato-sauce | 1 | 3 | 40 | 2 | 0 | 0 |
| puttanesca-pizza | H4 | capers, tomato-sauce, count+cheese, anchovy, black-olive | capers, tomato-sauce, anchovy, black-olive | 1 | 4 | 0 | 0 | 0 | 0 |

**Totals: lost information = 0, duplicate-charge candidates = 0.** Lost information now counts
*every* visible line: an ingredient line must come back as a granted fact, and a line that named no
ingredient must come back verbatim in `grandfatheredSteps`. (also asserted in
`hintFactMigration.test.ts` over every recipe × level and, for duplicates, over every 3-step
preference sequence).

## 10. Value preservation

Every ingredient an old level named is shown again after migration, either as the free key or as a
granted fact: **0 lost** out of all 116 rows.

- **Rule W:** the reserve is never granted. Legacy H4 never named it (25/25, pinned in H3-1), so the
  n-1 protection holds after migration.
- **Count and cheese lines:** these are the only legacy lines without a positive equivalent. They
  are kept as `paidRungs`, which keeps the price ladder in place, **and** as their own text
  (`grandfatheredSteps`), so the information is not lost (Codex P2, fixed in this PR). No count or
  negative fact is created. A player who never bought such a line gets nothing grandfathered, so
  nothing is disclosed for free (tested for H0/H1 on all 25 recipes).

## 11. Pricing progress preservation

| Legacy | 75-cap recipe (e.g. napoletana) next | 35-cap recipe (e.g. bismarck) next |
|---|---:|---:|
| H0 | 5 | 5 |
| H1 | **10** | **10** |
| H2 | **20** | **20** |
| H3 | **40** | 0 (the full set is already paid) |
| H4 | 0 (cap reached) | n/a |

- For every recipe and level, the next price is `selectableHintBatchPrice(L, 1, cap)`: the next rung
  of the same ladder.
- Legacy spend plus everything still for sale is ≤ today's full cost (35/75) for all 24 paid
  targets. All three properties are tested.

## 12. Merge semantics

| Case | Rule | Test |
|---|---|---|
| A. Legacy only | The level is max-merged. A fact write never lowers or rewrites it. | merge A |
| B. New facts only | Per-recipe union. A stale or empty snapshot never drops a fact. | merge B/C |
| C. Legacy + new | Both kept. Derived state = legacy rungs + facts bought beyond the grant. | fixture 15, reload test |
| D. Several snapshots | Order-independent union. | merge D |
| E. Unknown recipe ids | Kept in storage by `writeSave` across every write path. | E/F |
| F. Unknown or future fact ids | Kept as stored. Price and display ignore them (not counted). | fixture 14, E/F, migration test |

## 13. Unknown ids

- **Unknown recipe ids** (any ledger) are hidden from gameplay and kept in storage by `persistDex`,
  `persistProgress` and `persistMissionBest`.
- **Unknown fact kinds** stay in the stored ledger (`loadSave` keeps them; H3-1 ignores them).
  Examples: `tech:fold`, `finish:basil-oil:drizzle`, `shape:square`, `pan:cast-iron`,
  `cook:grill`, `none:cheese`.
- **Garbage is dropped:** non-strings, uppercase, an empty value, `__proto__`.

## 14. Hostile ids

- **`__proto__` as a recipe key** in raw JSON is dropped, because it fails the id pattern. It never
  becomes a prototype.
- **`constructor` and `prototype`** are well-formed unknown ids, so they are kept **as data** (own
  keys of a null-prototype record) and written back safely.
- **Fact values** `__proto__`, `constructor` and `ing:__proto__` are dropped; `prototype:x` is a
  well-formed unknown kind and is kept.
- **Snapshots:** a hostile key in a snapshot cannot pollute either.
- `Object.prototype` is verified clean in unit tests and in the browser e2e.

## 15. Full Reset

`resetSave` removes the whole key, so both ledgers are cleared together with everything else.

- After a reset, a write stays empty: no migration data comes back.
- The Dex-0 Margherita model is the free onboarding again (tested).
- The existing e2e "Full Game Reset clears the ledger, purchases and stock" still passes.

## 16. Old saves

Fixtures 1–15 all run through the production path (`loadSave` and `persistProgress` on a storage
fake):
- pre-Economy
- H0 / H1 / H2 / H3 / H4
- mixed levels
- unknown recipe id
- malformed level and malformed facts
- future level
- unknown top-level fields
- unknown recipe, ingredient and inventory data
- the field missing
- facts present
- legacy + new

A real-browser e2e (`e2e/discovery-hint-facts-save.spec.ts`) seeds a save with facts (known and
unknown recipe, future kinds, a hostile key) plus legacy levels. It confirms the real mount-time
write and a reload keep both ledgers verbatim, and that nothing pollutes.

## 17. Old-build compatibility (verified, not assumed)

A real round-trip against **`main`'s own `persistence.ts` at `1faa83f`** (the pre-H3-2 build),
checked out into a scratch test and not committed:

1. This build writes a save with `discoveryHintFacts`: a known recipe, an unknown recipe and
   `tech:` / `finish:` facts.
2. The old build `loadSave`s it. It never reads the field.
3. The old build writes through `persistProgress` (including a legacy level raise), `persistDex`
   and `persistMissionBest`. `discoveryHintFacts` is **still present and byte-identical** after
   every write, through the old build's `extras.topLevel` rule (the key is not in its
   `KNOWN_SAVE_KEYS`).
4. This build reads it back correctly and keeps the unknown recipe on its next write.

So an old build round-trip does **not** lose the new field.

## 18. No double charge

- **Legacy levels:** H1 → next 10, H2 → 20, H3 → 40, H4 → no roll-back (0, cap reached).
- **Legacy + an already-owned fact:** the fact is not re-sold and not counted twice.
- **Reload:** a Hint 3.0 purchase persisted through `persistProgress` and reloaded is never sold
  again. The legacy level stays as stored, and the rung continues (10 → 20).
- **Unknown facts:** not counted toward the price, but still returned as stored.
- **Exhaustive check:** 24 recipes × H0–H4 × every 3-step preference sequence produced 0
  duplicates.

## 19. Mutation tests

**In-test mutants (4), all detected:**
- a naive "H3 = 3 facts" mapping
- a migration that resets paid progress
- a migration that forgets granted facts (which would re-sell them)
- a migration that drops the grandfathered lines

**Source mutants (8):** each was applied temporarily, the two H3-2 suites were run, and the file was
restored (diff-verified). **All 8 were killed.**

| Mutant | Tests failed |
|---|---:|
| `writeSave` drops unknown-recipe facts | 4 |
| Only `ing:` kept (future kinds dropped) | 5 |
| Snapshot replaces instead of union | 2 |
| No write when facts change | 5 |
| `paidRungs` from the fact count | 8 |
| Grant uses level − 1 | 6 |
| Future level not clamped | 3 |
| `grandfatheredSteps` dropped (text lost, price kept) | 4 |

## 20. Regression

Existing Hint Economy, Discovery, Free Cooking, Shop, Inventory, Lunch Rush and Dinner Mission
suites all pass unchanged in the full run.

Two existing expectations were updated, and both were additive-key pins:
- The 3 save-key pins now list `discoveryHintFacts`.
- `App.hintSheet.test.tsx` pinned "a hint purchase changes only Pitz and the purchase ledger". The
  first write now also adds the empty fact ledger, so the pin asserts `discoveryHintFacts` is
  exactly `{}`. A Hint 2.0 purchase never writes facts.

Chromium storage and hint e2e: 19/19 (hint sheet, Dex hint, near-miss, ladder incl. Full Reset,
3-4B forward-compat, new H3-2 spec).

## 21. Full tests

| Check | Result |
|---|---|
| H3-2 focused (`persistence.discoveryHintFacts.test.ts` 24, `hintFactMigration.test.ts` 21) | **45 / 45** |
| Full Vitest | **182 files, 3872 passed, 1 skipped** (base 3827 + 45) |
| `tsc -b` / `oxlint` / `vite build` | exit 0 / 0 / 0 |
| Chromium e2e (storage + hint specs, 390×844; the new spec also at 360×800) | 19/19 and 2/2 |

## 22. CI / WebKit

See the PR checks. This section is updated once CI finishes on the PR head. The storage change makes
WebKit mandatory; the classify job decides whether the full WebKit run applies.

## 23. Changed files

| File | Change |
|---|---|
| `src/state/persistence.ts` | the `discoveryHintFacts` field, sanitizer, forward-compat extras, union merge in `writeSave` / `persistProgress`, defaults |
| `src/logic/discovery/hintFactMigration.ts` | **new**: pure legacy mapping and saved-state reader (unwired) |
| `src/state/persistence.discoveryHintFacts.test.ts` | **new**: 24 tests |
| `src/logic/discovery/hintFactMigration.test.ts` | **new**: 21 tests |
| `e2e/discovery-hint-facts-save.spec.ts` | **new**: real-browser storage round trip |
| `src/state/persistence.test.ts`, `src/state/phase4a1b.regression.test.ts`, `src/state/gameReducer.discovery.test.ts`, `src/App.hintSheet.test.tsx` | additive-key pins / fixtures (§20) |
| `docs/reports/TETO_DISCOVERY-HINT-3_H3-2_Persistence-Migration_Result.md` | this report |

## 24. Scope verification

These are unchanged:
- reducer, including `PURCHASE_DISCOVERY_HINT`
- the Hint sheet UI and CTAs (Dex, Result)
- near-miss runtime
- CSS and routing
- `App.tsx`: it still passes only `discoveryHintPurchases`, never the new field
- Shop, economy, catalogs, matcher
- Dinner Mission files
- #234

Neither `selectableHint` nor `hintFactMigration` is imported by any production module. schemaVersion
stays 2.

## 25. Residual risks

| # | Risk | Status |
|---|---|---|
| R-1 | The first write after H3-2 adds an empty `discoveryHintFacts: {}` to every save | Additive and harmless, the same as HE-1's `discoveryHintPurchases: {}`. Pinned. |
| R-2 | Snapshots sanitize to known recipe ids, so an unknown recipe only survives through storage extras, not through a snapshot | Same model as every other ledger. A snapshot never originates unknown recipes. |
| R-3 | Mixed-version tabs: an old tab can still raise the legacy level while a new tab holds facts | The derived state stays consistent: granted facts are never re-sold. At most one rung of overlap, as noted in the Fresh Design (R-5). |
| R-4 | The legacy count + cheese / coarse sauce lines have no fact equivalent | Kept as paid progress **and** verbatim text (`grandfatheredSteps`). No fact is created (OD-H3-7). |
| **OD (for H3-4)** | How the sheet shows a grandfathered line (e.g. 「材料は全部で4種類。チーズを使うみたい」) to the player who already bought it | The data is preserved, so no information is lost. Showing a count/absence line under Hint 3.0 is the player's own old purchase, not a new sale. The Owner decides at H3-4 whether and how it is displayed (recommendation: display it as a "以前のヒント" line). |

## 26. H3-3 plan (not started)

- **Reducer:** a `PURCHASE_SELECTABLE_HINT` action applies H3-1's `purchaseSelectableHint` using
  `selectableHintSavedState` (the legacy and new ledgers) as input. On success it debits Pitz and
  adds facts to `GameState.discoveryHintFacts`. `GUIDANCE_ONLY` changes nothing.
- **Persistence:** `App.tsx` passes `discoveryHintFacts` in the `persistProgress` snapshot (union).
  `discoveryHintPurchases` stops being advanced by new purchases, but remains readable.
- **Presentation:** `selectableHintPresentation` becomes the sheet's view model, still behind the
  existing sheet until H3-4.
- **Tests:** reducer stale/double-tap handling, reload, and the migration-in-runtime path.
