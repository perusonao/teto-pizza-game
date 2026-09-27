# Discovery Hint 4.0 — DH4-2B Pre-Implementation Gate

> **Status:** Gate report plus a pure safety fix (Issue #266, part of #253).
>
> - Nothing is wired: there is no change to the reducer, App, flag, persistence, HintSheet, CSS, e2e, prices or Dinner.
> - Production imports of the DH4 layer: **0**. Tests now also check dynamic `import(…)`.
>
> **Verdict: B. READY AFTER SMALL PURE FIX.**
> - The fix is in this PR.
> - Once it is merged, the gate is **A. READY FOR DH4-2B**.

## 1. Fresh state (2026-09-27)

| Item | Value |
|---|---|
| `origin/main` | `7bb0116`, Merge PR #264 (DH4-2A) |
| PR #265 (authority) | MERGED. Head `2f0ffaa2ec39d19cfd620e4c90c0c88ef330217b` → merge commit `750a2ea` |
| PR #264 (DH4-2A) | MERGED. Head `31609940e3c8863e6d05567f6335dd25b26066d6` → merge commit `7bb0116` |
| Post-merge CI | `750a2ea` and `7bb0116`: E2E WebKit and Pages deploy both green. CI runs on `pull_request` only; both PR heads were 9 / 9 green. |
| Duplicates | No open PR or issue for DH4-2B. The open PRs #255 / #259 / … are unrelated and not touched. |
| DH4-2A boundary | Unwired. No production module imports `deductionHint` / `deductionGuard` / `deductionRequest` / `ingredientTaxonomy`, and the bundle carries no DH4 string. |

## 2. P2-1: the one-sauce prior

### 2.1 Reproduced

The DH4-2A guard's H has two rules:
- if the known part has a sauce, H holds only non-sauces;
- if it has no sauce, H holds only sauces.

So a sauceless recipe loses its real reserve from H.

**The independent attacker.**
- It lives in `testSupport/deductionAttacker.ts` and never reads `hypotheticalReserves`.
- It takes the candidates from what the player can observe: the owned set, the known part, the free key, N, the clause, the answer, the catalog, the Discovery Ladder, Rule W and the key rule.
- The key rule: the free key is the ingredient with the recipe's key step, so nothing in the recipe is unlocked later than it.
- It tests the candidates with no prior, and separately with one-sauce, not-one-sauce, Rule W, the key rule, Rule W + key, and a known category (alone and with Rule W + key).
- A **leak** is a prior that holds for the real recipe, starts with at least 2 candidates, and is narrowed to 1 by the hint.

| Case | DH4-2A guard (7bb0116) | Hardened guard |
|---|---|---|
| A. Runtime: 300 target × ladder states | **40 leaking states** under the key rule: bismarck and funghi at steps 5–24, where `attr:category:cheese` leaves only mozzarella (found by the Codex review of this PR) | **0** |
| A. Runtime: 24 targets, everything owned | 0 | 0 |
| B. Synthetic sauceless `[mozzarella, egg, mushroom]`, everything owned | **egg named with no prior** (`attr:category:topping`) | 0. Egg is in H. |
| B. The review's example `[mozzarella, basil, egg]` | Rule W picks basil as the reserve under the current ladder key. Egg is the free key, so it is not the reserve. | 0 at every inventory |
| B + C. Synthetic families: sauceless, cheese-base, multi-sauce, zero-topping, no-cheese (141 recipes × 7 inventories = 987 owned states) | **84 leaking states** (48 without the key-rule priors) | **0** |
| D / E. Full and partial ownership (ladder steps 3 … 24 and everything) | included above | 0 |
| E. Partial knowledge: every reachable purchase state × 300; synthetic key-only and one-fact-short | — | 0. At least 2 possible reserves remain. |
| F. Reserve **not** owned (adversarial) | Answers and leaks: the owned and unowned hypotheses split | **Refused** with `NOT_A_TARGET` before anything else. Nothing is disclosed or charged. |
| Future (unranked) category, via a module mock | — | Never in H. An unranked known item or reserve fails closed: existence, no clause. |

### 2.2 Design comparison: `sauceCount === 1` versus H completeness

| | `sauceCount === 1` check | **H completeness (adopted)** |
|---|---|---|
| Depends on | The real recipe. The branch leaks "this recipe breaks the prior". | The known part, key and owned set only. The same for every hypothesis. |
| No-sauce, multi-spread, cheese-base | Would need a new check for each shape | Covered: no catalog prior is used |
| A future sauce, base or spread category | Breaks again | Unranked categories fail closed. Ranked ones are covered by the per-category classes. |
| Usefulness at 25 recipes | Unchanged | Better (§4) |

### 2.3 The hardened rule

The rule lives in `deductionGuard.ts`.

- **H** = { x ∈ owned : x ∉ the known part, x ≠ the key, rank(x) ≥ the rank of every non-key known ingredient, and keyStep(x) ≤ keyStep(key) }.
  - The rank order is sauce < cheese < topping, which is Rule W, OD-H3-5.
  - keyStep is `recipeKeyStep`, the rule behind `hintKeyIngredientId`. An ingredient unlocked after the key would itself have been the key. With no key, every ingredient is a starter (step 0). A tie stays in H, because the ingredient order is not public.
  - Both rules hold for every recipe by construction. They are not catalog assumptions, so the real reserve is always in H.
  - **Consequence:** for a DISCOVERABLE target, owning ingredients unlocked after its key no longer changes anything. DH4-2A counted them as decoys, but a player can rule them out.
- **Partition guard (OD-DH4-2-2, strengthened).** Every DH4-1 answer class must have at least 2 members **within each category side**.
  - So an attacker who adds any category-defined prior still has at least 2 candidates.
  - Examples of such priors: one sauce per pizza, a reserve category learned from T, a future base category.
- **Strict fallback:** the same universe H.
- **Fail closed:**
  - If the real reserve is not in H, the answer is existence and the clause is not told.
  - A recipe the owned set cannot make is not a target, and its request is `NOT_A_TARGET`. This cannot happen at runtime, because every hint target is DISCOVERABLE.

### 2.4 Review round 1 (Codex, P1): the key rule

- **The finding.** The free key is public, but DH4-2A's H (and this PR's first head, `5ccece1`) kept candidates unlocked *after* the key. The key rule excludes those.
- **The example.** Bismarck at step 5: the key is egg, so the real candidates before the hint are mozzarella and basil. `attr:category:cheese` then leaves only mozzarella.
- **Confirmed** with the independent attacker (key-rule priors added): the DH4-2A guard leaks in 40 of the 300 runtime states.
- **Fixed** by the key-consistency condition in H (§2.3). A test pins the 40 states for the DH4-2A reference and 0 for the hardened guard.

## 3. P2-2: TC-G `T ≥ 1`

`T ≥ 1` of the real recipe is not H-only. Once the H sides pass, a missing clause means 「トッピング0」.

| Option | Runtime 300: clause told | Leaks | 「0」 inferred | Ladder 24 | All owned 24 | Synthetic (460 states): told / leaks / 「0」 inferred |
|---|---|---|---|---|---|---|
| A. Real `T ≥ 1` (DH4-2A rule, hardened H) | 177 | 0 | 0 | 13 | 13 | 159 / 0 / **45** |
| B. The known part has at least 1 topping | 177 | 0 | 0 | 13 | 13 | 99 / 0 / 0 |
| **C. Every hypothesis in H has T ≥ 1 (adopted)** | **177** | 0 | 0 | **13** | **13** | 99 / 0 / 0 |
| D. B, and every hypothesis is a topping (T constant) | 130 | 0 | 0 | 9 | 9 | 72 / 0 / 0 |

**C is adopted.**
- It is H-derived.
- It is at least as useful as B by construction.
- It never states 0, and a missing clause never implies 0.
- It keeps OD-DH4-2-1 unchanged: 「トッピングは○種類使うよ」 is told only when TC-G passes, and never for 0.
- A test pins that the decision is identical for every hypothesis in H.

## 4. Usefulness: fixed values that changed

| Measure | DH4-2A (audit `2f0ffaa`) | Hardened |
|---|---|---|
| 300-state levels | existence 144 · category 155 · group 1 | existence **123** · category **164** · group **13** |
| Ladder-owned, 24 targets | category 11 · existence 13 | category 12 · group 1 · existence 11 |
| All owned, 24 targets | category 22 · group 1 · existence 1 | category 12 · group 1 · existence 11 (the same as ladder-owned) |
| TC-G passes, ladder / all | 11 / 23 | **13** / **13** |
| TC-G states, of 300 | 156 | 177 |
| DH4-1 alone, under the audit's player model | 29 / 300 leaks (5 recipes) | unchanged; the DH4-1 function is not touched |
| Guarded leaks, independent attacker with the key rule | **40** (bismarck, funghi) | **0** |

**Why the numbers move.**
- **Early answers rise.** Rule W-consistent H is often *narrower* than the one-sauce H: when the known part has a non-key topping, only toppings can be the reserve. That rule is true and public, so the per-category classes pass more often.
- **The all-owned figures drop to the ladder figures.** The key rule removes the late-unlocked decoys, which were never real (they are how the DH4-2A guard leaked on bismarck and funghi).
- **The old all-owned "23 / 24" TC-G figure overstated safety.** It is 13 / 24 now.

**Regenerated data:**
- `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2A_AUDIT.json` (schema v2). Each row gains `independentAttackerLeaks`, and the summary gains `dh4_2aReference`.
- The Python audit tool and `…DH4-2_PRE-AUDIT.json` are unchanged. They are the historical record of the DH4-2A decision (`--check` still passes). This report supersedes their guarded numbers for runtime.

## 5. P3 watch items

| Item | Result | Where |
|---|---|---|
| 1. Reserve-owned precondition | **Promoted and fixed.** A non-makeable recipe is not a target (`targetReserveParts` returns null; the request returns `NOT_A_TARGET` first). A reserve outside H fails closed. | `deductionGuard.ts`, `deductionRequest.ts`; gate + request tests |
| 2. X5: STALE / balance order | Test added. Stale and unaffordable together gives STALE. **Killed.** | `deductionRequest.test.ts` |
| 3. X8: balance equal to the price | Test added: equal answers; one less refuses. **Killed.** | same |
| 4. X16: NaN balance | Test added: NaN, ±Infinity and non-numbers refuse, even at price 0. **Killed.** | same |
| 5. X15: legacy total / known lines | Test added. A legacy-only total is owned but prints no 構成 line; it sets the archive flag. **Killed.** | same |
| 6. `deductionOwnership` with injected recipes | **Fixed.** It takes `recipes` and passes it through from the request and the known lines. **Killed.** | `deductionRequest.ts` |
| 7. Dynamic-import boundary | **Fixed.** Both boundary regexes also match `import("…")`. Verified with a throw-away `import("./logic/discovery/deductionGuard")` file, which the test caught. | `deductionGuard.test.ts`, `deductionHint.test.ts` |
| 8. Issue #253 freshness | A status comment is posted with this PR | #253 |

**Mutation run on this fix: 18 / 18 killed.** The mutants:
- the one-sauce prior back in H;
- partition classes that ignore the category;
- the TC-G min-over-H rule dropped;
- the makeable precondition dropped, in the guard and in the request;
- the Rule W floor dropped;
- the key rule dropped;
- the TC-G sides check dropped;
- the reserve-in-H check dropped, separately in strict and in partition;
- unranked known ingredients ignored;
- X5, X8, X15 and X16;
- injected recipes ignored.

The first run left three layered reserve-in-H checks alive, because each one masked the others. The fix keeps one check per exported function, and each is tested directly.

## 6. What DH4-2B must keep

- **Call the pure authority only:** `requestDeductionHint`, `deductionKnownLines`, `structureAnswer` and `guardedReserveAttributeAnswer`. Never compute levels, H or TC-G in the reducer or UI.
- **Pass the real hint target**, which is DISCOVERABLE. `NOT_A_TARGET` must be handled as a no-op: no charge, no ledger write.
- **The refusal order stays:** family → target → price → STALE → balance → answer.
- The charge and ledger write happen in one patch. EXISTENCE_ONLY, GUIDANCE_ONLY and ALREADY_OWNED write nothing.
- The purchase path stays behind the DEV / Preview flag, and production has no 0-Pitz price (OD-DH4-2-5).
- The boundary tests will then allow exactly the new wiring modules and nothing else.

## 7. Verification (this PR)

| Check | Result |
|---|---|
| Focused `src/logic/discovery` | green, including the 14 gate tests and 3 future-category tests |
| Full Vitest | 197 files, **4143 passed**, 1 skipped |
| `tsc -b` | clean |
| `oxlint` | 0 warnings |
| `npm run build` | OK; 0 DH4 strings in `dist` |
| Mutation | 18 / 18 killed |

No UI change, so Human Verification does not apply.

## 8. Verdict

**B. READY AFTER SMALL PURE FIX.**
- The fix is pure and fail closed.
- It strengthens OD-DH4-2-1 / -2 without changing any decision: the D′ wording, the guard (c) structure and existence-only are all unchanged.
- No Owner decision is required.
- After this PR merges: **A. READY FOR DH4-2B.**

**Residual, not blocking:**
- Priors that are not category-defined are outside this model, for example "X and Y never appear together". They go to the catalog batch re-audit and DH4-2D.
- The Python audit tool still models the DH4-2A guard. A port is optional and belongs to DH4-2D.
