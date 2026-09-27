# Discovery Hint 4.0 — DH4-2A Implementation Plan (pure privacy / structure / attribute logic)

> **Status:** plan only (docs). Nothing here is implemented.
>
> **Authority:** Issue #253 OD-DH4-1…10 and the DH4-2 Owner Decisions OD-DH4-2-1…13. The latter are recorded in `docs/reports/TETO_DISCOVERY-HINT-4_DH4-2_Pre-Implementation-Audit.md` §19 and in `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_PRE-AUDIT.json` `ownerDecisions`.
>
> **Base:** `origin/main` `5a33d85`. DH4-1 is merged and unwired.

## 1. Scope (OD-DH4-2-11: DH4-2A)

DH4-2A adds pure, unwired logic only:

1. the attribute **partition guard** (OD-DH4-2-2);
2. the **structure answer** with the TC-G topping clause (OD-DH4-2-1);
3. the **request authority** for the 構成 and 特徴 families, including the existence no-charge outcome (OD-DH4-2-4);
4. the fixed **display lines** for owned deduction facts, so the UI never re-derives anything.

**Not in DH4-2A:**

- reducer, action, `App.tsx`, `HintSheet.tsx`, CSS, persistence schema;
- pricing (the price is an **input**; OD-DH4-2-5);
- the flag, Dinner, near-miss, taxonomy rows (OD-DH4-2-3).

**Nothing in production imports the new modules.** A test enforces it (T-15).

## 2. Files

| Change | File | What |
|---|---|---|
| **M** | `src/logic/discovery/deductionHint.ts` | Behaviour-preserving extraction only, **no answer change**: <br>- export `attributeAnswerForReserve(input)`, the existing family → group → category → existence logic parameterised by `(recipeIngredientIds, reserveId, owned)`;<br>- `reserveAttributeAnswer` delegates to it;<br>- export `TOPPING_TOTAL_FACT_ID = "meta:topping-total"`.<br>Proven unchanged by the DH4-1 test file and the byte-identical DH4-1 audit snapshot (T-01). |
| **A** | `src/logic/discovery/deductionGuard.ts` | `privacyPartitionUniverse`, `guardedReserveAttributeAnswer`, `strictReserveAttributeAnswer`, `toppingClauseAllowed`, `structureAnswer` (§3) |
| **A** | `src/logic/discovery/deductionRequest.ts` | `requestDeductionHint` (the 構成 / 特徴 request authority) and `deductionKnownLines` (display lines) (§4) |
| **A** | `src/logic/discovery/deductionGuard.test.ts` | T-01…T-09, T-15 |
| **A** | `src/logic/discovery/deductionRequest.test.ts` | T-10…T-14 |
| **A** | `src/logic/discovery/deductionGuard.audit.test.ts` | T-16: the 300-state sweep pinned as a snapshot |
| **A** | `src/logic/discovery/testSupport/deductionInversion.ts` | A TS port of the audit tool's player model: hypothetical recipes, the level-inversion check, and the closure / forced-ingredient check |
| **A** | `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2A_AUDIT.json` | The snapshot of T-16 |
| **A** | `docs/reports/TETO_DISCOVERY-HINT-4_DH4-2A_Result.md` | The Result Report |

Nothing else changes. In particular `selectableHint.ts`, `hintFactMigration.ts`, `persistence.ts`, the reducer, `discoveryHint.ts`, components, CSS and `e2e/**` are untouched.

## 3. Pure API: `deductionGuard.ts`

```ts
/** OD-DH4-2-2: W, the privacy worst-case universe of one target at one owned set.
 *  = [reserve, ...owned catalog ids not in the recipe], de-duplicated, catalog order,
 *  minus sauces when the recipe has a sauce other than the reserve (the one-sauce prior;
 *  dropping candidates the player already excludes can only be conservative for the check
 *  below, because every hypothesis is still evaluated with the same W).
 *  Superset of DH4-1's category-level privacyWorstCaseCandidates for the reserve's category. */
export function privacyPartitionUniverse(recipeId: unknown, context: AttributeContext): readonly string[] | null;

/** The strict ("level before value") answer: the finest level L in family -> group -> category
 *  at which EVERY member of W sits in a class of >= 2 members of W (classes are total: an
 *  ingredient without a family/group is classed by its category), then the reserve's class at L;
 *  else existence. Depends on W only for the level. */
export function strictReserveAttributeAnswer(recipeId: unknown, context: AttributeContext): ReserveAttributeAnswer | null;

/** OD-DH4-2-2, the adopted guard (option c). For every x in W, h(x) = the DH4-1 answer of the
 *  hypothetical recipe (recipe - reserve + x) with reserve x (attributeAnswerForReserve).
 *  If every answer class { x : h(x) = a } has >= 2 members, return the DH4-1 answer of the real
 *  reserve; otherwise return strictReserveAttributeAnswer. The branch taken is a function of W
 *  only, so the answer level never singles out a hypothesis. Deterministic; never a name or id;
 *  no count in the result. `null` = not a target (unknown id, Dex-0 onboarding). */
export function guardedReserveAttributeAnswer(recipeId: unknown, context: AttributeContext): ReserveAttributeAnswer | null;

/** OD-DH4-2-1, TC-G: the topping clause may be told iff the recipe's topping total T >= 1 and every
 *  category side present in W (topping / cheese / sauce) has >= 2 members of W. W-only; never
 *  true for T = 0. */
export function toppingClauseAllowed(recipeId: unknown, context: AttributeContext): boolean;

/** OD-DH4-2-1: the structure answer. Always the total; the topping total only when allowed.
 *  No remaining count, no per-category count, never 0. */
export function structureAnswer(recipeId: unknown, context: AttributeContext):
  | { factIds: readonly ["meta:ingredient-total"] | readonly ["meta:ingredient-total", "meta:topping-total"]; total: number; toppingTotal: number | null }
  | null;
```

**Determinism:**

- Iteration is always in catalog order, with Sets and Maps and never object keys (DH4-1 style).
- Owned input goes through DH4-1's `ownedCatalogIds` (hostile or unknown ids are ignored, duplicates collapse).

**Complexity:** O(|W|²) over 29 ingredients at runtime, and about 105–179 later. That is trivial.

## 4. Pure API: `deductionRequest.ts`

```ts
export type DeductionFamily = "structure" | "attribute";

export interface DeductionRequestInput {
  family: unknown;                       // untrusted
  recipeId: unknown;
  context: AttributeContext;             // discoveredCount + ownedIngredientIds
  storedFactIds: readonly unknown[] | unknown;      // discoveryHintFacts[recipeId]
  legacyPurchases: DiscoveryHintPurchases | unknown; // for ingredientTotalOwned (OD-DH4-8)
  /** Supplied by the caller (DH4-2B: a provisional price behind the flag). NOT an authority here. */
  requestPrice: number;
  paidCount: number;                     // derived by the caller (economy: DH4-ECON)
  expectedPaidCount: number;             // echoed by the sheet
  pitzBalance: number;
}

export type DeductionRequestResult =
  | { outcome: "ANSWERED"; family: DeductionFamily; addFactIds: readonly string[]; charge: number }
  | { outcome: "EXISTENCE_ONLY"; charge: 0 }          // OD-DH4-2-4: nothing stored, nothing charged
  | { outcome: "GUIDANCE_ONLY"; charge: 0 }           // structure with nothing left to tell
  | { outcome: "ALREADY_OWNED"; charge: 0 }           // attribute single-shot / structure fully owned
  | { outcome: "REJECTED"; reason: "NOT_A_TARGET" | "INVALID_FAMILY" | "INVALID_PRICE" | "STALE" | "INSUFFICIENT_PITZ" };

export function requestDeductionHint(input: DeductionRequestInput): DeductionRequestResult;

/** Display lines for the owned deduction facts of one recipe, e.g.
 *  ["このピザは全部で6種類の材料を使うよ", "トッピングは4種類使うよ", "まだわかっていない材料に、肉の仲間があるよ"].
 *  No recipe id, name, level label, count of candidates or availability in the output. */
export function deductionKnownLines(recipeId: unknown, context: AttributeContext, storedFactIds: readonly unknown[] | unknown,
  legacyPurchases: DiscoveryHintPurchases | unknown): { structure: readonly string[]; attribute: readonly string[]; legacyStructure: boolean };
```

**Order of evaluation.** It is fixed so that a refusal never depends on what is left (the H3-1 pattern):

1. `family` valid? Otherwise `INVALID_FAMILY`.
2. Target? Otherwise `NOT_A_TARGET` (unknown id, the Dex-0 onboarding).
3. `requestPrice` a finite integer ≥ 0? Otherwise `INVALID_PRICE`.
4. `expectedPaidCount === paidCount`? Otherwise `STALE`.
5. `pitzBalance ≥ requestPrice`? Otherwise `INSUFFICIENT_PITZ`. This is decided **before** resolving, and is the same for every target at the same paid count.
6. Resolve:
   - **structure:**
     - total not owned (neither a stored `meta:ingredient-total` nor a legacy count line): `ANSWERED` with `structureAnswer.factIds`, charge = `requestPrice`;
     - total owned, the clause allowed and not stored: `ANSWERED` with `["meta:topping-total"]`;
     - otherwise `GUIDANCE_ONLY`.
   - **attribute:**
     - a stored `attr:` id exists: `ALREADY_OWNED`;
     - otherwise a = `guardedReserveAttributeAnswer`. If a is existence: `EXISTENCE_ONLY` (charge 0, `addFactIds` empty, **`attr:existence` is never stored**). Otherwise `ANSWERED` with `[a.factId]`.

**What the caller (DH4-2B) does with the result:**

- `ANSWERED`: debit `charge` and append `addFactIds` in one patch.
- Every other outcome: change nothing persistent; only a transient per-family outcome is set.

**Copy:**

- The DH4-1 lines are reused (`deductionHintTextJa`). The topping clause is 「トッピングは○種類使うよ」.
- The `other` family text stays DH4-1's until OD-DH4-2-9 is settled. The provisional 「ちょっと変わった材料があるよ」 is a DH4-2C Preview copy concern, not a pure-layer change.

## 5. Test matrix

"Universe" below = the 24 targets × owned sets. Both inventories used so far are included, plus every ladder step from the target's own step to step 24. That is the **300-state sweep** of the audit tool (`finalGate.inventorySweep`).

| ID | Area | Test | Oracle |
|---|---|---|---|
| T-01 | DH4-1 unchanged | The existing `deductionHint.test.ts` passes untouched. `deductionHint.audit.test.ts` snapshot is byte-identical. `attributeAnswerForReserve(recipe, reserve, owned)` equals `reserveAttributeAnswer` for all 300 states. | Existing tests + equality |
| T-02 | Guard: inversion | For each state and each hypothesis x ∈ W, the guarded answer of (recipe − reserve + x, reserve x) is computed; the set of x sharing the real answer has ≥ 2 members. Checked **with and without** the TC-G clause as a joint observation. | **0 of 300** (audit tool: 0) |
| T-03 | Guard: W-only decision | For every state, the branch (DH4-1 vs strict) is identical for every hypothetical reserve in W | Equality |
| T-04 | Guard: pinned levels | Level counts over 24 targets: ladder-owned category 11 · existence 13; all-owned category 22 · group 1 · existence 1; 300-state sweep existence 144 · category 155 · group 1 | Audit JSON `finalGate` |
| T-05 | Guard: regression of the known leaks | The 29 DH4-1-as-merged leak states (bismarck 2–4, funghi 3–4, breakfast 11–24, meat-lovers 16–24, quattro 24) are each answered without isolating the named ingredient | The inversion set is ≥ 2 |
| T-06 | Guard: determinism and hostility | Owned order and duplicate permutations, non-arrays, `__proto__` / `constructor` / unknown ids, unknown recipe, the Dex-0 onboarding. Repeated calls are identical. | Equality / `null` |
| T-07 | Guard: output shape | The fact id matches `HINT_FACT_ID_PATTERN` and survives `loadSave`. It never contains an ingredient id or name. No count, candidate or size key. | Regex + key scan |
| T-08 | TC-G | The clause is never allowed for T = 0 (quattro). Pinned counts: 11/24 ladder-owned, 23/24 all-owned. W-only. For all 300 states × every reachable purchase state, N + clause (+ the guarded attribute) never forces the reserve (the closure model, ADD_ONE = N). The only unbought-material inference is mozzarella in breakfast / melanzane / parmigiana. That is an economy note, pinned as a known list. | Audit JSON `finalGate.inventorySweep.tcg_*` (reserve forced: 0) |
| T-09 | Structure | Total ≥ 2 always. No per-category or remaining count id exists. `structureAnswer` returns ids in fixed order, the clause only when allowed. | Enumeration |
| T-10 | Request: order | `INSUFFICIENT_PITZ` and `STALE` are returned before any resolution. With a balance just below the price, every target and family gives the same refusal (the uniform pre-request). | Equality across targets |
| T-11 | Request: existence (OD-DH4-2-4) | For every state whose guarded answer is existence: `EXISTENCE_ONLY`, charge 0, no ids, and the input ledger is deep-equal after the call | Deep equality |
| T-12 | Request: single-shot and legacy | Attribute: after `ANSWERED` → `ALREADY_OWNED` (charge 0). Structure: after total + clause → `GUIDANCE_ONLY`. A legacy `COUNT_CHEESE` owner (all 25 × H0–H4) gets the clause only, or `GUIDANCE_ONLY`. A legacy negative line grants nothing. | Enumeration |
| T-13 | Request: no double fact | `addFactIds` never contains an `ing:` id or an id already stored. Structure and attribute ids are disjoint. | Set checks |
| T-14 | Display lines | `deductionKnownLines` output contains no recipe name or id, no level word, no digits other than the told total / clause, and no 「0」 | String scan over 300 states × owned facts |
| T-15 | Unwired boundary | No production module (`src/**` minus tests and testSupport) imports `deductionGuard` / `deductionRequest` / `deductionHint` / `ingredientTaxonomy` | The DH4-1 boundary glob, extended |
| T-16 | Audit snapshot | The 300-state sweep (answers, branch, clause) is written to `TETO_DISCOVERY-HINT-4_DH4-2A_AUDIT.json` via `toMatchFileSnapshot` and cross-checked against this tool's `finalGate` counts | File snapshot |

## 6. Mutation targets (each must fail at least one test)

| # | Mutation |
|---|---|
| M1 | Drop the partition check (always return DH4-1): T-02, T-05 |
| M2 | Check only the reserve's class (the per-reserve "wrapper", option b): T-02 (funghi), T-03 |
| M3 | Include recipe ingredients in W: T-02 / T-04 |
| M4 | Drop the one-sauce prior filter the other way (sauces always in W): T-04 (levels change) |
| M5 | Allow the clause at T = 0: T-08 |
| M6 | Per-reserve TC-G (the reserve's side only): T-08 |
| M7 | Charge or store the existence outcome: T-11 |
| M8 | Resolve before the affordability check: T-10 |
| M9 | Re-sell the attribute: T-12 |
| M10 | Emit a remaining count or a per-category count: T-09 / T-14 |

## 7. Gates for the DH4-2A PR

- Full Vitest: all green, with `deductionHint.*` untouched and green.
- `tsc -b`, `oxlint` (0 warnings), `npm run build`.
- Mutants M1–M10 are all killed and recorded in the Result Report.
- `python3 tools/dh4_2_topping_count_audit.py --check` stays OK; the TS sweep counts equal the tool's.
- **Diff:** `src/logic/discovery/**` + docs only; `e2e/**`, CSS and components unchanged; production import count 0.
- Not a UI change, so no Human Verification (the policy exempts pure logic). WebKit CI runs as usual.

## 8. Rollback

The slice is unwired. Reverting the one commit or PR removes the 2 new modules, their tests and the extraction. The extraction is behaviour-preserving (T-01), so the revert cannot change DH4-1 behaviour.

## 9. Hand-off to DH4-2B (not in this slice)

DH4-2B consumes `requestDeductionHint` and `deductionKnownLines`. It:

- extends `PURCHASE_SELECTABLE_HINT` with `family`, so the action stays in `DINNER_BLOCKED_ACTIONS`;
- derives `paidCount` and `requestPrice` behind the DEV / Preview flag (provisional ESC rung; production does not enable the families, OD-DH4-2-5);
- applies one patch per `ANSWERED` result;
- keeps outcomes transient.

No schema change is needed: the new ids fit H3-2's forward-compatible store.
