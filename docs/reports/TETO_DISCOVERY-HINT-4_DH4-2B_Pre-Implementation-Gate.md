# Discovery Hint 4.0 — DH4-2B Pre-Implementation Gate

> **Status:** Gate report plus a pure safety fix (Issue #266, part of #253).
>
> - Nothing is wired: there is no change to the reducer, App, flag, persistence, HintSheet, CSS, e2e, prices or Dinner.
> - Production imports of the DH4 layer: **0**. Tests now also check dynamic `import(…)`.
>
> **Verdict: B → A after merge. The Owner decided T1a for P1-1** (§11), and it is implemented in this PR.
> - The pure hardening in this PR covers P2-1, P2-2, the key rule, the P3 items and T1a. All of it is strictly safer than DH4-2A.
> - Once this PR is merged: **A. READY FOR DH4-2B**.
> - The earlier verdict C (§9, §10) is kept below as history.

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
- It is only partly independent. It re-implements Rule W and the key rule through the same `recipeKeyStep` / `hintKeyIngredientId` the guard uses, so it shares the guard's world model. That is how both missed P1-1 until the independent review.
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
| Focused `src/logic/discovery` | green, including the 14 gate tests, 3 future-category tests and 2 timing tests (P1-1, pinned as OPEN) |
| Full Vitest | 198 files, **4145 passed**, 1 skipped |
| `tsc -b` | clean |
| `oxlint` | 0 warnings |
| `npm run build` | OK; 0 DH4 strings in `dist` |
| Mutation | 18 / 18 killed |

No UI change, so Human Verification does not apply.

## 8. Independent review of the hardened guard (HEAD `172144a`)

The review ran full Vitest (4143 passed) and wrote its own attacker code. It found:

| ID | Severity | Finding | Status |
|---|---|---|---|
| P1-1 | **P1** | **Purchase timing.** A hint target is DISCOVERABLE, and the player sees it: the free key chip, a Dex pin, a sticky target. Any ingredient bought **after** the player saw the target cannot be the reserve. The guard's H and the DH4-1 decoys still count such ingredients, so a late purchase makes the answer finer while the player can discount it. | **OPEN: Owner Decision** (§9) |
| P2-1 | P2, pre-existing | **Ladder pairs** (Hint 3.0 / ladder generation, not DH4). When a ladder step unlocks two ingredients and one of them is the free key, the other must be in the target too. Rule W then makes it the reserve: capricciosa (black-olive), quattro-formaggi (fontina). No hint is needed. | Recorded for Hint 3.0; DH4 adds nothing to it |
| P3-1 | P3 | Discovered-recipe exclusion: if the known part + x is a recipe the player has already discovered, x is ruled out. On the 25 runtime recipes this excludes nothing beyond the key rule. | Residual, re-checked at each catalog batch |
| P3-2 | P3 | TC-G's `toppingTotalOf(recipe) < 1` check was dead (an equivalent mutant) | **Fixed**: removed. The min-over-H rule implies T ≥ 1. |
| P3-3 | P3 | The attacker is only partly independent | Recorded (§2.1) |
| P3-4 | P3 | The post-balance `NOT_A_TARGET` branches in the request authority are unreachable | Harmless; kept as fail-closed defaults |

**P1-1, reproduced** (`deductionGuard.timing.test.ts`):
- **The case.** Pepperoni at step 6 with parmigiano not bought: the answer is `attr:existence`. After parmigiano is bought, it is `attr:category:cheese`. Parmigiano was bought after the target was makeable, so the reserve is mozzarella: **named**.
- **Size.** 300 states × one late decoy (not a starter, unlocked no later than the key): **44 leaking (state, decoy) pairs** in pepperoni (19), salsiccia (18) and genovese (7).
  - The reviewer's sweep with 1–2 late decoys found 772 states in the same 3 recipes.
  - DH4-2A leaks identically, so this is not a regression of this PR.

## 9. Owner Decision required: the purchase-timing threat model (P1-1)

| Option | What it does | Usefulness (300-state ladder model: states with an informative 特徴) | Persistence | Privacy |
|---|---|---|---|---|
| **T1. Snapshot at makeable** (recommended) | H and the DH4-1 decoys come from the owned set **at the moment the target became makeable**, not from today's inventory. | **177 / 300**, the same as now: in the ladder model nothing bought later ever counted | **T1a:** derived from the order of `ownedIngredientIds`. It is append order today (starters first, then purchases; the localStorage forward-compat merge appends), so there is **no schema change**. The order becomes a guaranteed contract, pinned by tests.<br>**T1b:** a stored per-target snapshot (schema addition, migration) | Closes P1-1. A player's timing knowledge (what they owned when the target appeared) is exactly the snapshot. |
| T2. Restrictive, pure | Informative 特徴 and the clause only when **nothing was acquired after the latest known-part ingredient**; otherwise existence (free) | **13 / 300** (only the step where the target became makeable) | none | Closes P1-1 |
| T3. Accept | Keep today's inventory as H; document P1-1 as accepted interaction inference | 177 / 300 | none | 44+ named states in 3 recipes |

**Also for the Owner to note, pre-existing and not DH4:**
- **The moment a target becomes DISCOVERABLE is observable.** The Dex `？？？` card gains its hint button, and HOME says 「作れそう」. So the purchase that made it DISCOVERABLE is in the recipe.
- **The same leak in both T1 and today's code.** When that last purchase is the reserve and the rest is known, the reserve is named without any hint. T1 and today's code behave the same here.
- **Ladder pairs** (P2-1 above).

**Recommendation: T1a.**
- It keeps the Owner-decided usefulness.
- It needs no schema change.
- The ordering contract gets tests: purchase appends, load keeps order, the localStorage forward-compat merge appends.

## 10. Verdict

**C. OWNER DECISION REQUIRED.**
- **This PR** is a safe, pure strengthening of the DH4-2A authority: P2-1, P2-2, the key rule and the P3 items. Its tests pin the P1-1 leak as OPEN, so nothing hides it.
- **DH4-2B does not start** until the Owner decides T1 / T2 / T3.
- **With T1a or T2,** that is a further small pure change in this gate before DH4-2B.

**Residual, not blocking:**
- Priors that are not category-defined are outside this model, for example "X and Y never appear together" and the discovered-recipe exclusion. They go to the catalog batch re-audit and DH4-2D.
- The Python audit tool still models the DH4-2A guard. A port is optional and belongs to DH4-2D.

## 11. Owner Decision P1-1: T1a adopted (Owner Authority, 2026-09-27)

| ID | Owner Decision |
|---|---|
| **OD-DH4-2B-G1 (P1-1)** | **T1a.**<br>- For a target, only the ingredients that were **owned when the target became makeable** are candidates or decoys in H. An ingredient bought later is never a reserve candidate or a decoy for that target.<br>- **No per-target snapshot field is added.** The ownership prefix is rebuilt deterministically from the stored `ownedIngredientIds` append order.<br>- **The append-order invariant must be explicit**, never implicit.<br>- **A malformed or ambiguous order fails closed**, toward privacy; candidates are never added by guessing.<br>- T1b (a snapshot field), T2 (the restrictive rule) and T3 (accept the leak) are **rejected**. |

### 11.1 The append-order invariant (explicit contract)

> `ownedIngredientIds` is the **acquisition order**. It lists the starter ingredients first (they are owned together from the start), then every later acquisition in the order it happened. Every writer appends. Load, migration, normalization and the forward-compatible merge never sort the list, and never move a known id earlier.

| Writer / reader | Behaviour | Pinned by |
|---|---|---|
| `purchaseFirstPack`, `PURCHASE_INGREDIENT` | `[...owned, id]` (append) | `persistence.ownedOrder.test.ts` |
| `applyStarterGrants` | A Set in insertion order, so a grant appends | same |
| `sanitizeOwnedIngredientIds` (load / persist) | Drops non-string and non-catalog ids, keeps the first occurrence of a duplicate, puts the starters first. **Never sorts.** | same; mutant T8 (a sort on load) is killed |
| `migrateV1toV2` | Copies the list | same |
| Forward-compat merge (`writeSave`, localStorage) | **Fixed in this PR (Codex P1 / independent review P2-1).** `mergeOwnedOrder` keeps the stored order as it is, with ids this build does not know left in their acquisition position, and appends only new ids.<br>The old merge carried unknown ids *after* every known id. Moving a **known-part** id (a key) later pulls later purchases into the makeable prefix, which reopened P1-1 after a rollback. | same (exact positions, rollback scenario); mutant killed |
| The invariant, at its source | Documented on `sanitizeOwnedIngredientIds` | `persistence.ts` |

### 11.2 The rule (`deductionGuard.ts`)

- **`ownedAcquisitionOrder(owned)`.** Returns the owned ids in acquisition order, or `null` when the order cannot be trusted. That case is **fail closed**: `targetReserveParts` returns `null`, and the request is `NOT_A_TARGET`, so nothing is disclosed and nothing is charged. The untrusted cases:
  - the value is not an array;
  - an entry is not a string or not a catalog id;
  - an id is duplicated;
  - a starter appears after a purchased ingredient.

  A sanitized save never hits any of these, because load normalizes to a valid order. So this only catches corrupted in-memory data.
- **`makeablePrefix(parts)`.** The owned prefix up to the last-acquired ingredient of the **known part** (everything but the reserve, the key included).
  - The starters count as acquired together at time 0.
  - **H and every DH4-1 decoy are read from this prefix only.**
- **Why the prefix is taken over the known part.**
  - It makes the prefix identical for every hypothesis, so the guard stays H-only.
  - When the reserve itself was the **last** recipe ingredient acquired (the purchase that made the target makeable), it is outside the prefix. The guard then **fails closed**: existence, no clause.
  - What that reveals is only "the target became makeable when this ingredient was bought". The UI already shows that moment (the Dex card's hint button, HOME 「作れそう」), and T1a presumes it is known.
  - An onset-unaware attacker can single out a reserve **only** in that reserve-last case. A test pins this: every onset-unaware leak is a reserve-last state.
  - It never happens on the 300 runtime ladder states, where the key is acquired last.

**Further residuals (independent review of `ed6f2ac`, P3):**
- **A starter added in a future catalog** would read as owned from time 0. The invariant therefore adds a catalog rule: the starter set never grows. A new starter needs its own migration decision.
- **Two tabs writing at once** can lose a purchase, an older behaviour of `persistProgress`. Buying it again places it later, with the same effect as a moved id. This is an edge case, recorded.

### 11.3 Owner checklist

| # | Requirement | Result |
|---|---|---|
| 1 | Record T1a in the Owner Decision Ledger / this report | §11 (above); Issue #253 status comment |
| 2 | The append-order invariant is explicit | §11.1; the `persistence.ts` doc comment |
| 3 | Save / load round trip keeps the order | `persistence.ownedOrder.test.ts` |
| 4 | Unknown / future ids never break the order | same (interleaved future ids) |
| 5 | Migration / normalization never sort or dedupe-reorder | same (v1 → v2, junk + duplicates, starters) |
| 6 | Purchase boundary before / after makeable | `deductionGuard.timing.test.ts`: parmigiano one purchase before vs one after pepperoni |
| 7 | A late purchase never strengthens an answer | Same file. Answer, clause and structure are identical with and without the late decoy, for every (state, decoy), and with everything after the key moved late. |
| 8 | Pepperoni / parmigiano regression | Same file: `existence` before and after. DH4-2A gave `category:cheese`. |
| 9 | The confirmed 44 pairs go to 0 | Same file: the full late-decoy case set (it contains the 44). **T1a: 0 leaks.** DH4-2A: 85. |
| 10 | Re-run the 300-state privacy audit | `TETO_DISCOVERY-HINT-4_DH4-2A_AUDIT.json` regenerated. Guarded inversion leaks 0; the independent attacker (onset-aware, all priors) finds 0; DH4-1 alone is still 29 / 300. |
| 11 | Usefulness stays at 177 / 300 | **Yes.** Levels: existence 123 · category 164 · group 13, i.e. 177 / 300 informative, unchanged. TC-G: 177 states, 13 / 24 on the ladder and 13 / 24 with everything owned, unchanged. Only the internal branch counts moved (DH4-1 branch 20 → 118), because the decoys now come from the prefix. |
| 12 | Sauceless / multi-sauce synthetic attacker tests | Kept. Synthetic states now acquire the key last, as in play: DH4-2A leaks in 84, T1a in 0. A reserve-last variant (>100 states) fails closed with 0 leaks. |
| 13 | P2-2 option C: 0 leaks | Kept (TC-G H-only tests, synthetic 「0」 inference 0) |
| 14 | Reserve-unowned / `NOT_A_TARGET` fail closed | Kept (gate + request tests) |

**Mutation gate: 25 / 25 killed.** (After the review round, W1 was added: the writer moving unknown ids to the end.)
- The 16 earlier mutants.
- Eight new T1a mutants:
  - no prefix (today's inventory);
  - a prefix over the whole recipe (reserve-dependent);
  - DH4-1 decoys from today's inventory;
  - a starter after a purchase accepted;
  - duplicates merged silently;
  - owned sorted by catalog;
  - starters not simultaneous;
  - load sorting owned.

**Verification on this head:**
- Full Vitest: 199 files, **4160 passed**, 1 skipped (after the review round).
- `tsc -b` clean; `oxlint` 0 warnings; `npm run build` OK.
- 0 DH4 strings in `dist`.

**Fail-closed cases (reported per the Owner's instruction):**

| Case | When | Behaviour |
|---|---|---|
| Untrusted order in memory (not an array, junk, a duplicate, a starter after a purchase) | Never from a loaded save, which load normalizes | `NOT_A_TARGET`: no answer, no clause, no total, no charge |
| The reserve was the last recipe ingredient acquired | A player buys the reserve after every other ingredient, key included | 特徴: `EXISTENCE_ONLY` (free, nothing stored). 構成: the total only, no clause. |
| A save written by a build from **before** this PR while it held unknown ingredient ids | Only after a rollback to such a build. No shipped build has ever written an unknown ingredient id: Preview uses its own save key, and no newer catalog has shipped. | **Residual.** Those builds moved unknown ids to the end. From this PR on, the merge keeps positions. |

**Verdict: B. READY AFTER SMALL PURE FIX.** The fix is this PR. After its review, CI and merge: **A. READY FOR DH4-2B.**
