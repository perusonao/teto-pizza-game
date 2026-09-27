# PR #255 docs diff proposal: DH4-1 level inversion and the DH4-2 partition guard (OD-DH4-2-12)

> **Status:** proposal only. PR #255 (head `e221e36`, OPEN, not merged) is **not** changed by this file.
>
> - It lists where PR #255's audit documents should be amended, and with what text, per OD-DH4-2-12.
> - The change is documentation only. **No production taxonomy logic changes. No DH4-1 row changes** (OD-DH4-2-3). The Human Classification Gate (OD-TAX-7) stays.
> - Evidence: `docs/reports/TETO_DISCOVERY-HINT-4_DH4-2_Pre-Implementation-Audit.md` §5.3 and `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_PRE-AUDIT.json` (`finalGate.attributeGuardOptions`, reproducible with `python3 tools/dh4_2_topping_count_audit.py --check`).

## 1. The finding to carry into PR #255

**The DH4-1 guard protects the reserve's own class. It does not stop singleton classes elsewhere in the privacy worst-case universe W from answering at a different level.**

A player who knows the rule and holds the total (bought, or through a free near-miss ADD_ONE) can test each remaining owned ingredient x: "would x as the reserve have produced this answer level?" This names the Rule W reserve. At the two sampled inventories it does so in 5 cases on the 25-recipe runtime:

| Recipe | Inventory | DH4-1 answer | Named reserve |
|---|---|---|---|
| funghi | ladder-owned | existence | mozzarella |
| quattro-formaggi | ladder-owned | existence | fontina |
| quattro-formaggi | all owned | existence | fontina |
| breakfast-pizza | all owned | category:topping | egg |
| meat-lovers | all owned | group:protein | sausage |

**These 5 cases come from two sampled inventories** (each target's own ladder step, and all 29 owned). A full **inventory sweep** was also run: every target at its own step and at every later ladder step, as with a Dex-pinned or late target, 300 states in all (JSON `finalGate.inventorySweep`). It finds **29 states in 5 recipes**:

| Recipe | Ladder steps | Named reserve |
|---|---|---|
| bismarck | 2–4 | mozzarella |
| funghi | 3–4 | mozzarella |
| breakfast-pizza | 11–24 | egg |
| meat-lovers | 16–24 | sausage |
| quattro-formaggi | 24 | fontina |

The partition guard gives **0 in all 300 states**, with and without the topping clause. `tools/dh4_2_topping_count_audit.py --check` enforces this.

**Owner decision OD-DH4-2-2:**

- DH4-2 adds a **partition guard** outside the unchanged DH4-1 answer function.
- The decision is made from W alone: every hypothetical reserve's DH4-1 answer must share its class with at least one other member, otherwise every hypothesis gets the strict (coarser) answer.
- Measured result: 0 name leaks at both inventories and across the 300-state sweep.

**The cost on the 25-recipe runtime:** family answers go from 13 to 0 on the ladder and from 15 to 0 with everything owned. The runtime singleton families (fruit = pineapple, spice = capers, other = egg) make the partition check fall back.

**The owner does not fix this by moving ingredients** (OD-DH4-2-3). Family answers return by data as the catalog grows (PR #255 §11 / §12 class sizes), or after the Human Classification Gate decides the boundaries on their meaning.

## 2. Proposed hunks for `docs/reports/TETO_DISCOVERY-HINT-4_INGREDIENT-TAXONOMY-172_Fresh-Audit.md`

Line numbers refer to PR #255 head `e221e36`.

### 2.1 §5, the "Runtime 25" row (line 115)

```diff
-| Runtime 25 | Privacy is sound. The DH4-1 guard, not the table, is what protects the 3 runtime singleton families (fruit = pineapple, spice = capers, other = egg; §8). |
+| Runtime 25 | The table is sound. The 3 runtime singleton families (fruit = pineapple, spice = capers, other = egg; §8) are **not** fully protected by the DH4-1 guard alone. The guard checks the reserve's own class, but the *answer level* can be inverted. This names the reserve in 29 of 300 target × inventory states (5 recipes) (§13.1). Privacy at runtime therefore needs the **DH4-2 partition guard** (OD-DH4-2-2). The table is not changed for privacy (OD-DH4-2-3). |
```

### 2.2 §6, "Display ≠ data" (line 140)

```diff
-**Display ≠ data.** The ingredient row stores the finest layer (subfamily). The hint *displays* at most the family, and only when the k ≥ 2 guard passes. The guard can always coarsen further, to group, then category, then existence.
+**Display ≠ data.** The ingredient row stores the finest layer (subfamily). The hint *displays* at most the family, and only when the k ≥ 2 guard **and the DH4-2 partition guard** pass. Either can coarsen further, to group, then category, then existence. The partition guard decides from the privacy worst-case universe alone, so the answer level cannot be inverted (§13.1).
```

### 2.3 §10, "Answer levels" (after line 223): add a note

```diff
   - cheese: category 20 · existence 4 (quattro-formaggi uses all 4 cheeses).
+- **Note (DH4-2 Final Owner Decision Gate):** these levels are the DH4-1 guard alone. With the DH4-2 partition guard (OD-DH4-2-2), the runtime answers become category / group / existence until the singleton families grow. Measured on the 24 targets:
+  - ladder-owned: category 11 · existence 13;
+  - all owned: category 22 · group 1 · existence 1.
+  
+  See the DH4-2 audit §5.3.
```

### 2.4 §13: replace the sentence at line 265, and add §13.1

```diff
-- DH4-1 sells exactly one attribute answer about the reserve. Its worst-case universe already excludes every other recipe ingredient, so material facts and the structure total add nothing for the reserve. **No change is needed for DH4-1.**
+- DH4-1 sells exactly one attribute answer about the reserve. Its worst-case universe already excludes every other recipe ingredient, so material facts and the structure total add nothing to the reserve's **pool**. **However, the answer *level* is itself information** (§13.1). DH4-1's answer function stays unchanged. DH4-2 wraps it in a partition guard (OD-DH4-2-2).
+
+### 13.1 Answer-level inversion (found at the DH4-2 Final Owner Decision Gate)
+
+- **The attack.** A player who knows the fallback rule, and knows the total (bought, or through a free near-miss ADD_ONE), can test each remaining owned ingredient: "would it, as the reserve, have produced this level?"
+- **Where it names the reserve** on the 25-recipe runtime: 29 of 300 target × inventory states (every target at its own and every later ladder step):
+  - bismarck (steps 2–4): mozzarella;
+  - funghi (steps 3–4): mozzarella;
+  - breakfast-pizza (steps 11–24): egg;
+  - meat-lovers (steps 16–24): sausage;
+  - quattro-formaggi (step 24): fontina.
+- **Cause.** Singleton classes elsewhere in the worst-case universe W answer at a different level than the reserve's class.
+- **The rule that follows (OD-DH4-2-2).** The level must be decided from W alone: the DH4-1 answer is kept only if every hypothetical reserve in W shares its DH4-1 answer with at least one other member; otherwise every hypothesis gets the strict (coarser) answer. Inversion name leak = 0 in all 300 states.
+- **Generalization.** OD-TAX-4 / FR-3 (joint k on intersected axes) and this rule are the same principle: whatever the player can observe (answer value **or** level) must not isolate one hypothesis.
+- Evidence: `docs/reports/TETO_DISCOVERY-HINT-4_DH4-2_Pre-Implementation-Audit.md` §5.3; `…DH4-2_PRE-AUDIT.json` `finalGate.attributeGuardOptions`.
```

### 2.5 §14: the FR-4 row (line 300)

```diff
-| **FR-4** coverage test | When the runtime catalog grows, add a test that every runtime topping has a family and every family has at least N members in the runtime catalog. Before that, singleton families rely on the guard (as documented in DH4-1). |
+| **FR-4** coverage test | When the runtime catalog grows, add a test that every runtime topping has a family and every family has at least N members in the runtime catalog. Before that, singleton families rely on the DH4-1 guard **plus the DH4-2 partition guard** (§13.1). The DH4-1 guard alone does not prevent answer-level inversion. |
```

### 2.6 §18: the near-singleton row of the open-items table (line 403)

```diff
-| Near-singleton fruit (3) and spice (≤ 5) at the 105 stage | **Open** as a note. The k ≥ 2 guard (OD-TAX-4) covers privacy. |
+| Near-singleton fruit (3) and spice (≤ 5) at the 105 stage | **Open** as a note. Privacy is covered by the k ≥ 2 guard (OD-TAX-4) **together with the DH4-2 partition guard** (OD-DH4-2-2, §13.1). Singleton or near-singleton families reduce how often family answers are given, but they never make a name leak. No reclassification is made for privacy alone (OD-DH4-2-3). |
```

### 2.7 §19, step 1 (line 408)

```diff
-1. **Now:** nothing to implement. DH4-1 is merged and unchanged. DH4-2 proceeds without taxonomy scope (OD-TAX-9). It receives only the 「ちょっと変わった材料があるよ」 copy candidate (OD-TAX-8).
+1. **Now:** nothing to implement in the taxonomy. DH4-1 is merged and unchanged.
+   - DH4-2 proceeds without taxonomy scope (OD-TAX-9).
+   - It adds the partition guard outside DH4-1 (OD-DH4-2-2) and receives the 「ちょっと変わった材料があるよ」 copy candidate as **provisional, Preview only** (OD-TAX-8, OD-DH4-2-9).
```

### 2.8 Final verdict: add one bullet

```diff
 - **DH4-1:** unchanged. Its 7 family and 4 group ids and labels match this audit exactly.
+- **DH4-2 dependency:** the runtime singleton families need the DH4-2 partition guard (§13.1, OD-DH4-2-2). The taxonomy itself needs no production change.
```

## 3. Proposed addition to `docs/reports/data/TETO_INGREDIENT-TAXONOMY_172_FRESH-AUDIT.json`

This is an additive key. The generator (`tools/ingredient_taxonomy_audit.py`) would emit it so that `--check` stays green.

```json
"dh4_2PartitionGuardNote": {
  "source": "docs/reports/TETO_DISCOVERY-HINT-4_DH4-2_Pre-Implementation-Audit.md §5.3 (OD-DH4-2-2)",
  "finding": "DH4-1 answer level is invertible when W contains singleton classes; 29 of 300 target x ladder-inventory states (5 recipes) name the reserve",
  "sweep": {"states": 300, "named": 29, "recipes": ["bismarck", "breakfast-pizza", "funghi", "meat-lovers", "quattro-formaggi"], "partitionGuardNamed": 0},
  "sampledCases": [
    {"recipeId": "funghi", "inventory": "ladderOwned", "answer": "existence", "named": "mozzarella"},
    {"recipeId": "quattro-formaggi", "inventory": "ladderOwned", "answer": "existence", "named": "fontina"},
    {"recipeId": "quattro-formaggi", "inventory": "allOwned", "answer": "existence", "named": "fontina"},
    {"recipeId": "breakfast-pizza", "inventory": "allOwned", "answer": "category:topping", "named": "egg"},
    {"recipeId": "meat-lovers", "inventory": "allOwned", "answer": "group:protein", "named": "sausage"}
  ],
  "rule": "DH4-2 partition guard: keep the DH4-1 answer only if every hypothetical reserve in W shares its DH4-1 answer class with >= 1 other member; else strict answer for all. Decided from W only.",
  "taxonomyChange": "none (OD-DH4-2-3)"
}
```

**Optional follow-up** (it does not block anything): §11's 105-pool guard simulation could add a column with the partition guard, to show how often family answers survive at 105 and 172. That would need a W model per recipe in the pool. It is an audit extension, not a correction.

## 4. Other PR #255 state noticed (not part of OD-DH4-2-12)

- **One unresolved review thread** (Codex, P2) on `tools/ingredient_taxonomy_audit.py` lines 755–758.
  - It says the cross-axis tag buckets count `false` values as if they were sold positive attributes. Example: lemon is reported as the `family+sweet` singleton only because it is the sole *non-sweet* fruit.
  - This affects the §13 cross-axis singleton counts, not the DH4-2 decisions (OD-TAX-9 keeps multi-axis out of DH4-2).
  - It should be answered or fixed in PR #255's own session.
