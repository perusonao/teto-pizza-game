# Discovery Hint 3.0 — H3-2 Persistence / Legacy Migration: Result (Issue #238)

> Status: **Step 0 Integration Map, recorded before implementation.** The implementation sections
> are appended below once the code lands.

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
