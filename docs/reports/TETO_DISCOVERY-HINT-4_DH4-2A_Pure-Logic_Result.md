# Discovery Hint 4.0 — DH4-2A Pure Logic: Result Report

> **Scope:** DH4-2A only (Issue #253). Pure, unwired logic.
>
> **Not changed:**
> - production wiring: App, reducer, actions, flag, DEV / Preview;
> - persistence schema, HintSheet, CSS, `e2e/**`;
> - prices (no price is decided here; the ESC ladder is unchanged);
> - Dinner, near-miss.
>
> **Not touched:** PR #255 (including its open Codex P2 thread) and Issue #256.
>
> **Authority:** OD-DH4-2-1…13 (the Final Owner Decision Gate, audit branch `claude/dh4-2-pre-implementation-audit-714isy` @ `2f0ffaa`):
> - `docs/reports/TETO_DISCOVERY-HINT-4_DH4-2_Pre-Implementation-Audit.md` §0;
> - `docs/reports/TETO_DISCOVERY-HINT-4_DH4-2A_Implementation-Plan.md`;
> - the 300-state audit (`tools/dh4_2_topping_count_audit.py`, `finalGate`).
>
> **Verdict: A. DH4-2A PURE LAYER READY FOR REVIEW**

## 1. Audited main

| Item | Value |
|---|---|
| `origin/main` at start (fresh fetch) | **`51e0923`**: Merge PR #252 (DM-3R-2). main moved since the audit (`5a33d85`). |
| Overlap check of `5a33d85..51e0923` with DH4 inputs | **None.** No change in `src/logic/discovery/**`, the recipe / ingredient / ladder / taxonomy data, persistence or the hint sheet. The only hint-related change: `SHOW_HINT` joined `DINNER_BLOCKED_ACTIONS` (Dinner). |
| Branch | `claude/dh4-2a-pure-logic`, created from `51e0923`. It is not the audit branch. |

## 2. Changed files

| Change | File | What |
|---|---|---|
| M | `src/logic/discovery/deductionHint.ts` | **Extraction only.** The existing DH4-1 rule is parameterised as `attributeAnswerForReserve({ recipeIngredientIds, reserveId, ownedIngredientIds })`; `reserveAttributeAnswer` delegates to it. `ownedCatalogIds` is exported. There is no answer change: DH4-1 tests and the DH4-1 audit snapshot are byte-identical. |
| M | `src/logic/discovery/deductionHint.test.ts` | **One line.** The DH4-1 unwired-boundary allowlist now also names the two new modules of the same unwired layer (`deductionGuard.ts`, `deductionRequest.ts`). Production importers stay forbidden (§12). The plan's T-01 had said "untouched"; this is the only deviation, and it is needed because the layer grows. |
| A | `src/logic/discovery/deductionGuard.ts` | The partition guard, strict fallback, TC-G and structure answer |
| A | `src/logic/discovery/deductionRequest.ts` | The 構成 / 特徴 request decision, ownership model and known-fact lines |
| A | `src/logic/discovery/deductionGuard.test.ts` | T-01…T-09, the combined inference test, T-15 (26 tests) |
| A | `src/logic/discovery/deductionRequest.test.ts` | T-10…T-14 (14 tests) |
| A | `src/logic/discovery/deductionGuard.audit.test.ts` | T-16: the 300-state sweep snapshot (2 tests) |
| A | `src/logic/discovery/testSupport/deductionInversion.ts` | A TS port of the audited player model: level inversion and the closure / forced-ingredient model |
| A | `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2A_AUDIT.json` | The machine-readable 300-state sweep (T-16 file snapshot) |
| A | `docs/reports/TETO_DISCOVERY-HINT-4_DH4-2A_Pure-Logic_Result.md` | This report |

## 3. Pure API

**`deductionHint.ts` (DH4-1, extended):**

| Export | Contract |
|---|---|
| `attributeAnswerForReserve(input)` | The unchanged DH4-1 answer rule for any (recipe ingredients, reserve, owned). **Not player-facing on its own**: its level is invertible. |
| `ownedCatalogIds(raw)` | The owned catalog ids (untrusted input; non-strings, unknown ids and duplicates dropped) |

**`deductionGuard.ts`:**

| Export | Contract |
|---|---|
| `TOPPING_TOTAL_FACT_ID` | `"meta:topping-total"`. Stored only when the clause was told. |
| `targetReserveParts(recipeId, ctx)` | A target's recipe ingredients, Rule W reserve and owned ids (catalog order). `null` for a non-target or the Dex-0 onboarding. |
| `privacyPartitionUniverse(parts)` | W: the reserve + owned ingredients outside the recipe, with the one-sauce prior |
| `hypotheticalReserves(parts)` / `hypotheticalParts(parts, x)` | H, and the parts of hypothesis x |
| `partitionAllowsDh41(parts)` | Whether every DH4-1 answer class over H has ≥ 2 members. Depends on H only. |
| `strictAnswerForParts(parts)` | The "level before value" fallback. Classes are total; nothing is guessed. |
| `guardedAnswerForParts(parts)` / **`guardedReserveAttributeAnswer(recipeId, ctx)`** | **The only player-facing 特徴 answer (OD-DH4-2-2)** |
| `toppingClauseAllowedForParts(parts)` / `toppingClauseAllowed(recipeId, ctx)` | TC-G (OD-DH4-2-1) |
| **`structureAnswer(recipeId, ctx)`** | D′: `factIds` (total, + clause), `total`, `toppingTotal` (null, never 0) |

**`deductionRequest.ts`:**

| Export | Contract |
|---|---|
| **`requestDeductionHint(input)`** | The single pure authority for a 構成 / 特徴 request. Outcomes: `ANSWERED` (charge = the caller's price), `EXISTENCE_ONLY` / `GUIDANCE_ONLY` / `ALREADY_OWNED` (charge 0, no ids), and `REJECTED` (`INVALID_FAMILY` / `NOT_A_TARGET` / `INVALID_PRICE` / `STALE` / `INSUFFICIENT_PITZ`). |
| `deductionOwnership(recipeId, stored, legacy)` | From the ledgers only, never from W: total owned (stored or legacy), from-legacy-only, clause owned, attribute owned |
| `deductionKnownLines(recipeId, ctx, stored, legacy)` | The known-fact presentation model: positive lines only, plus the `legacyStructure` flag |
| `parseAttributeFactId`, `toppingClauseTextJa`, `DEDUCTION_FAMILIES` | Helpers |

**Order of evaluation in `requestDeductionHint`:**

1. family;
2. target;
3. price (a whole number ≥ 0, supplied by the caller);
4. STALE;
5. balance;
6. then the answer.

So a refusal never depends on availability, granularity or candidates. Nothing before the request says 「今回は無料」, 「具体的ヒントがない」 or "family answer possible".

## 4. DH4-1 parity

- `attributeAnswerForReserve` equals `reserveAttributeAnswer` in all 300 states (T-01).
- The existing DH4-1 tests pass (27 in `deductionHint.test.ts`; the boundary allowlist is updated as in §2).
- The DH4-1 audit snapshot `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json` is **byte-identical**.
- Mutant M17 (DH4-1 threshold `>=` → `>`) is killed.

## 5. The old leak, reproduced

**DH4-1 alone:** a guard-aware player (with N, which can be bought or seen free through ADD_ONE) names the Rule W reserve in **29 of 300 states (5 recipes)**. The list is identical to the audit JSON (`finalGate.inventorySweep.a_dh41_as_merged`):

| Recipe | Ladder steps | Named reserve |
|---|---|---|
| bismarck | 2–4 | mozzarella |
| funghi | 3–4 | mozzarella |
| breakfast-pizza | 11–24 | egg |
| meat-lovers | 16–24 | sausage |
| quattro-formaggi | 24 | fontina |

## 6. Guarded 300-state result

- **0 of 300 name leaks** with the partition guard.
- **0 of 300** with the guard plus the TC-G clause observed jointly.
- **0** at full ownership in reversed order.
- Each of the 29 old leak states now leaves the named ingredient among ≥ 2 candidates.
- **Levels:** existence 144 · category 155 · group 1. Branches: DH4-1 26 · strict 274.
- **Per target:** ladder-owned category 11 · existence 13; all-owned category 22 · group 1 · existence 1. This equals the audit.
- **W-only decision:** every hypothetical reserve takes the same branch and sees the same W (T-03).
- **Deterministic** under owned order, duplication and junk ids (T-06).

**Cross-check with the audit JSON** (the audit branch, `2f0ffaa`):

- per-target guarded answers: 48 / 48 identical;
- TC-G decisions: 48 / 48 identical;
- the 29-state leak list: identical;
- sweep levels: identical.

## 7. Combined inference

This covers every one of the 300 states × every reachable purchase state (key + per-category prefixes of sellable facts). It uses the total N (bought, or ADD_ONE), plus the clause when TC-G passes, plus / minus the guarded attribute, all with the one-sauce prior.

- **The reserve is newly forced in 0 states.**
- **Unbought-material inference** happens only for mozzarella in breakfast / melanzane / parmigiana. That is the audit's known economy note, and it is pinned as a list.
- **Control:** raw topping counts without TC-G would name the reserve in bismarck, funghi and quattro-formaggi. The guard is load-bearing.

## 8. TC-G

- **Never for T = 0.** This holds at every runtime state. It also holds for a synthetic future-catalog shape where every W side has ≥ 2 members, so only the T ≥ 1 rule prevents 「トッピング0」.
- **Pinned pass counts:** 11 / 24 at the ladder state, 23 / 24 with everything owned, and 156 / 300 in the sweep.
- **Runtime:** a missing clause is always explained by W's sides (player-computable), never by T = 0 alone. So the missing clause does not reveal 「トッピング0」 by inference either.
  - **Watch item for DH4-2D / catalog growth:** with more cheeses on a future catalog, a zero-topping recipe could pass the W-side check. The missing clause would then imply T = 0 as PAID INFERENCE, never a displayed 0.
- **Structure:** in every state, the exact distinct total (≥ 2); the clause only when allowed; no remaining count and no per-category count (T-09).

## 9. GUIDANCE_ONLY, existence-only and legacy semantics

| Case | Outcome | Charge | Fact ids to add | Persistent mutation |
|---|---|---|---|---|
| 特徴, guarded answer = existence (144 states) | `EXISTENCE_ONLY` | **0** | none | **none** (the inputs are deep-equal after the call; `attr:existence` is never stored) |
| 特徴, informative answer already stored | `ALREADY_OWNED` | 0 | none | none |
| 構成, total owned and the clause not allowed or owned | `GUIDANCE_ONLY` (or `ALREADY_OWNED` when both are stored) | 0 | none | none |
| 構成 for a total owner when a later inventory allows the clause | `ANSWERED` `[meta:topping-total]` | the caller's price | the clause only | caller applies |
| Legacy 「材料は全部で○種類」 (25 recipes × H0–H4) | Total owned, never resold | — | never `meta:ingredient-total` again | — |

A legacy line grants nothing else: no clause and no attribute. A hostile stored `attr:existence` does not count as a purchase.

## 10. Known-fact presentation

`deductionKnownLines` returns only positive lines for stored facts:

- 「このピザは全部で○種類の材料を使うよ」;
- 「トッピングは○種類使うよ」;
- the attribute line.

It never returns a recipe or ingredient name, a level label, 「？」, 残り / あと, or 「0種類」. Hostile ids are ignored. A stored clause for a zero-topping recipe prints nothing. Legacy-only ownership is a flag for the DH4-2C archive.

## 11. Taxonomy

- Unchanged (OD-DH4-2-3).
- Family-less reserves (sauce, cheese) never receive family or group answers.
- Mutant M11 (guessing `other` for family-less ingredients) is killed.

## 12. Production import count

**0.** Enforced three ways:

- **T-15:** no module outside the DH4 layer and tests imports `deductionHint` / `deductionGuard` / `deductionRequest` / `ingredientTaxonomy`.
- The DH4-1 boundary test lists exactly the three layer modules.
- The built bundle (`npm run build`) contains no DH4-2A string (`attr:existence`, `meta:topping-total`, `partitionAllowsDh41`, `privacyPartitionUniverse`): 0 files.

## 13. Test results

| Run | Result |
|---|---|
| Focused `src/logic/discovery/deduction*` (DH4-1 + DH4-2A) | 5 files, 71 tests passed |
| Full Vitest (final tree) | 195 files, **4120 passed, 1 skipped** |
| `tsc -b` | clean |
| `oxlint` | 0 warnings |
| `npm run build` | OK (the existing chunk-size notice only) |
| DH4-2 audit tool `--check` (audit branch) | OK: the numbers above equal its `finalGate` |

## 14. Mutation / adversarial results: 18 / 18 killed

The mutation harness is a scratch script: apply a string mutation, run the 5 focused test files with `CI=true`, and restore. The baseline was green.

| # | Mutant | Killed by |
|---|---|---|
| M1 | Partition k ≥ 2 → k ≥ 1 | T-16 snapshot + audit equality |
| M2 | Partition check bypassed (always DH4-1) | T-16 |
| M3 | Check only the actual reserve's class | T-16 |
| M4 | Fallback fixed to family | T-16 |
| M5 | Topping 0 allowed | T-08 synthetic zero-topping parts. It first **survived**; the test was added and it is now killed. |
| M6 | TC-G bypass | T-16 |
| M7 | GUIDANCE_ONLY charges | T-12 |
| M8 | Existence persisted | T-11 |
| M9 | Existence charged | T-11, T-12 |
| M10 | Legacy total resold | T-12 legacy × H0–H4 |
| M11 | Unknown taxonomy guessed as `other` | T-16 |
| M12 | W includes recipe ingredients | T-16 |
| M13 | One-sauce prior dropped | T-16 |
| M14 | Balance checked after resolving | T-10 |
| M15 | Attribute resold | T-12 |
| M16 | Topping total emitted without TC-G | T-09, T-14 |
| M17 | DH4-1 threshold changed (parity) | T-16, DH4-1 audit |
| M18 | Strict fallback k ≥ 2 → k ≥ 1 | T-16 |

**Two harness findings, both fixed before the final run:**

1. **The DH4-1 boundary allowlist** failed the baseline once the two new modules existed. It was updated (§2), and every mutant was re-run on the green baseline.
2. **M5 survived** because the runtime catalog never exercises the T ≥ 1 rule alone. A synthetic-parts test was added.

## 15. CI

Recorded on the PR after push.

## 16. Blockers

**None.** No STOP condition was hit:

- the partition guard leaks 0 / 300;
- combined inference forces the reserve 0 times;
- DH4-1 parity holds;
- no taxonomy, persistence-schema or production-wiring change was needed;
- nothing contradicts OD-DH4-2-1…13.

**Carried forward** (not blockers):

- the TC-G future-catalog watch item (§8), for DH4-2D and each catalog batch;
- the DH4-2 audit branch (`2f0ffaa`) has no PR of its own yet. Its audit docs and tool are the authority used here; whether and how to land them on main is an Owner call.

## 17. Final verdict

**A. DH4-2A PURE LAYER READY FOR REVIEW.** The PR is OPEN for Owner review and not merged. DH4-2B / 2C are not started.
