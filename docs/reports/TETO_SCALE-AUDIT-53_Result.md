# 53-recipe Scale Audit — Result Report

Audited main: **`1d601b8`** (`origin/main`, Merge PR #414, Expansion Batch 4; fetched read-only). Branch `claude/scale-audit-prep-readonly-qkd3he`, docs only.
Authority reused from the PREP (Fresh Audit not redone): Anti-Oracle Contract 2.1 §13.1 (re-audit before 53 / 172, sauce 1 per attempt, old §6 / §15 estimates are **not** authority), Research 2.0 §7 (Research identifier compatibility), OD-RB-10 (K = 3 fixed; balance audit if 53 / 172 shows trouble).
Scope: "does the 53 / 172 expansion premise hold under the current Contract / Research design from the 51-recipe Production?" Candidate-specific checks (composition collision, cohort additions, DH4 risk, taxonomy, sauce profile) are **not** done here; they belong to Batch 5 candidate screening. No Batch 5 recipe was selected or assumed.
Verification budget: one read-only derived script (Appendix) + `git fetch`. No Vitest / E2E / WebKit / Preview / HV / Batch Validator / G7 / DH4-PROD re-run (all green at the Batch 4 Final Gate; not duplicated).

## 0. Verdict

| Gate | Verdict |
|---|---|
| **53 Scale Gate (51 → 53)** | **CONDITIONAL GO** — nothing in the Contract / Research design breaks at 53; the conditions in §9 constrain Batch 5 screening. |
| 172 population (beyond ~80–130 recipes) | **NOT CLEARED** — attempt count and refill friction keep growing linearly with the topping pool under K = 3; this needs an Owner Decision before the population goes far past 53 (§7, §8). No change was made or proposed as a decision. |

## 1. Gate 0 (Production / main / counts) — PASS

| item | value | source |
|---|---|---|
| origin/main HEAD | `1d601b8` Merge PR #414 | `git fetch` + `git log` |
| `catalogLedger.test.ts` | recipes 51 / credited 49 / ingredients 55 / toppings 43 / ladder steps 47 / chapters 6, 11, 16, 18 / Lunch Rush pool 25 | file |
| Batch 4 Result §1 totals | 51 / 55 (toppings 43, cheeses 9) / 47 / credited 49 / chapters 6, 11, 16, 18 / pool 25 | file |
| code-derived (script) | `RECIPES` 51, `INGREDIENTS` 55, `DISCOVERY_LADDER.steps` 47, `CATALOG_COUNTS` identical to the ledger; every one of the 52 finite materials is in the ladder | script |
| Production Deploy #298 SUCCESS | stated by the Owner; not independently checkable read-only (no CI access used) | Owner |

Derived extras: categories sauce 3 / cheese 9 / topping 43; NO_SAUCE recipes 10 (`aussie` + Batch 3's 6 + Batch 4's 3, matching the sauce-profile authority).

## 2. Research cohort distribution (code-derived, ladder-order ownership)

| metric | value |
|---|---|
| cohorts | 48 (unlock = last-acquired finite ingredient) |
| size distribution | size 1 × 46, size 2 × 1, size 3 × 1 |
| max size | **3** (`onion`, ladder step 12 — letters A / B / C) |
| lettered cohorts / recipes | 2 cohorts (`onion` 3, `zucchini` 2) / 5 recipes; highest letter in use `C` |
| 26-overflow headroom | 23 (`AA`… is supported by `researchLetter` already, OD-R2-4) |
| purchase-order sensitivity | 45 of 51 recipes have ≥ 2 finite ingredients, so their unlock fact depends on the player's purchase order; the table above is the ladder-order (typical) case |
| worst case under **any** purchase order | largest set of recipes sharing one finite ingredient = **10** (`onion`, `black-olive`), so no order can exceed 10 at 51 |
| dedicated materials | 25 of 52 used finite materials belong to exactly one recipe |

→ At 51 there is no 26-risk and no letter pressure.

## 3. 172 matrix vs current Production

Matrix `rows` = 172 (172 unique evidence ids). The matrix field `shippedRecipeIds` (15) is stale and **not** used.

| item | value |
|---|---|
| rows matching a Production recipe (by `canonicalCandidateId`, its `-pizzadb` strip, `correspondsToExistingCatalogId`, or an equal complete ingredient set) | 52 rows (46 by id, 6 by set only) → 48 Production recipes matched |
| Production recipes with no matching matrix row | `funghi`, `napoletana`, `pizza-bianca` (3) — composition conflicts / naming clusters recorded in the matrix, not resolved here |
| rows with ≥ 1 Production match to the same recipe (many-to-one) | 4 |
| **remaining population** | **120 rows** (172 − 52); the naive `172 − 51` is 121 |
| remaining by `productDecisionStatus` | READY 33 / READY_WITH_REVIEW 11 / **BLOCKED_PRODUCT_DECISION 76** |
| remaining by `currentFlowRepresentability` | FULL 58 / PARTIAL 49 / NOT_REPRESENTABLE 13 |
| remaining FULL **and** (READY or READY_WITH_REVIEW) | **20** (all with complete ingredient identity) |
| remaining with a structural capability required | 57 |
| remaining with ≥ 2 spread layers (conflict with "sauce 1 per attempt") | 24 (of 26 rows in the whole matrix) |
| remaining sauce base `none` | 30 |

Population-level reading (not candidate selection): only **20** of the 120 remaining rows are FULL and decision-ready today. A population far beyond ~71 therefore needs Owner decisions on blocked / partial rows and on mechanics (multi-spread, structural capabilities), independent of any Scale Audit number.

## 4. Unlock-name information density (matrix, candidate-independent)

Computed on the 120 matrix rows with a complete ingredient identity set, excluding the 3 starters (`tomato-sauce`, `mozzarella`, `basil`).

| metric | value |
|---|---|
| distinct non-starter ingredients | 124 |
| used by exactly one row | **71** |
| frequency buckets (rows per ingredient) | 1: 71 / 2: 14 / 3–5: 21 / 6–10: 10 / 11–20: 7 / > 20: 1 |
| most shared | `olive-oil` 24, `onion` 20, `black-olive` 15, `oregano` 14, `fresh-tomato` 12, `garlic` 11, `sausage` 11, `pesto` 11 |
| rows with ≥ 1 dedicated material | 48 of 120 |
| rows with **no** dedicated material | **72 of 120** |
| adversarial cohort upper bound (rows containing one ingredient) | 24 < 26 → no ingredient can force a > 26 cohort. Caveat: 52 rows have incomplete identity sets (21 with unresolved tokens), so this is a bound over resolved ingredients, not strict. |

(The older "98 of 168" figure is not reused; this table is the recomputation on complete rows.)

Reading: the label `？？？ピザ（<unlock>）` identifies a recipe only when the unlock is dedicated. This frequency table spans all 172 rows (including already-shipped rows and rows that may never be selected) and is measured against the **matrix**, not against Production: 72 of 120 complete rows (60%) share every non-starter ingredient with another matrix row, but that does **not** mean they would join an existing Production cohort (e.g. `artichoke` is shared by two matrix rows yet is absent from today's `INGREDIENTS`, so either row alone would bring a new key material and a singleton cohort). It is an information-density indicator only; cohort membership must be computed against Production + the proposed batch (§9-1). If a large part of the population does end up sharing unlock names, entries will rely on the letter, which carries no information (INV-B7 by design). That is within the contract (letters, not content), but information density of the label falls from "almost a name" (46 of 48 cohorts at 51) toward "a shared ingredient plus a letter".

## 5. Research identifier compatibility (Research 2.0 §7)

- **Letter stability:** cohort membership is fixed at the moment the unlock ingredient is acquired (a recipe needing a later-bought finite material joins that later cohort), and discovered siblings keep their slot, so a letter never moves within one save + catalog. It moves only when a **catalog revision** adds a recipe to an existing cohort (documented in `researchEntry.ts`; accepted by the Owner contract). `recipeBatchValidator.ts` already asserts that every pre-existing recipe keeps its letter per batch.
- **Notebook consistency:** the Dex, PREPARE, RESULT, Hint sheet, Notebook and Research Board read the one `researchEntryLabel`; nothing is persisted (OD-R2-2). Within a session the catalog is constant, so the Notebook row and the Dex label cannot disagree. No save mapping is needed or proposed.
- **26 boundary:** headroom 23 today; adversarial bound 24 at 172 (see §4). `researchLetter` already produces `AA`, `AB`…; crossing 26 would not break labelling.
- **Dex vertical list:** simultaneously pending Research Entries peak at 4 (ladder step 28, one discovery per step model) at 51. List / chapter scale at 25–172 recipes is already pinned by `catalogScale.test.ts` / `largeCatalogFixtures.test.ts` (chapters at 172: 39 / 63 / 51 / 19); not re-run.
- **Unlock-name information density:** §4.

→ Compatible at 53. The Research §7 trigger "a revision that adds a recipe to an existing cohort" is the live constraint (§9-1).

## 6. Attempt scaling (sauce 1 per attempt; recomputed, no old figure copied)

Model (derived from code + matrix; Appendix): blind scan with no hints. At the moment recipe *r* becomes researchable the player owns the starters + every ladder material up to *r*'s last material. Sauce axis: one sauce per attempt (expected position (n+1)/2, or all n sauces × for a no-sauce recipe); cheese: all owned cheeses in one attempt; topping: K = 3 unknown per attempt = ⌈unknown / 3⌉. Search = max of the three axes, plus 1 exact final build.

**Calibration.** On the 27-recipe sub-population the model gives 5.2 attempts per recipe (141 total); the Contract / Gate C accepted harness figure for that population is lower (C-1 K = 3, 3.6). The model therefore scans every unknown topping and is a conservative (upper) envelope, about 1.45× the harness; read the **ratios and trends**, not the absolutes. The exact harness (`researchAttempt.sim.test.ts`, real reducer) exists but needs Vitest — outside this budget.

| population | attempts per recipe (mean) | note |
|---|---|---|
| 51 Production (sum 431) | **8.5**, max 15 (tail recipe `pizza-moscow` 15) | the **topping axis is the driver for 51 / 51 recipes** |
| by ladder band (steps 0–10 / 11–24 / 25–37 / 38–47) | 2.9 / 6.6 / 10.8 / 14.3 | owned about 3–13 / 16–18 / 30–45 / 46–55 |
| at 53 (+1–2 topping materials) | tail ≈ **16** (15 now) | +3 toppings = +1 attempt |
| 52–172, end state 105 ingredients (sauce 18 / cheese 16 / topping 71) | mean **20.0**, tail 25 | sauce axis at tail 9.5 |
| 52–172, end state 179 ingredients (sauce 31 / cheese 25 / topping 123; matrix has 169 ids, 38 spread-layer ids) | mean **28.8**, tail 42 | sauce axis at tail 16 |

Whole-run attempts: 431 (51) → ≈ 2,860 (172, 105-model) / ≈ 3,910 (172, 179-model). 

Findings:
1. **"Sauce 1 per attempt" does not bind** at any scale tested: the sauce axis stays at 9.5–16 attempts at the 172 tail while the topping axis needs 24–41. The multi-sauce assumption of the old §6 estimates is therefore not what limits scale; the **topping pool under K = 3 is**.
2. At 53 the step from 51 is about +1 attempt: no discontinuity.

## 7. K = 3 and Pitz economy assessment (OD-RB-10)

**Scope of this section (review-corrected):** the refill figures below are a **first-order indicative estimate, not a simulation and not a bound**. They price exactly K = 3 tested toppings per search attempt (at T4 prices for new materials). The real reducer (`consumePizzaInventory`) charges every finite item actually placed, including tested sauces / cheeses, known-positive toppings repeated across attempts and the final build, and it charges 3 toppings even when fewer than 3 unknowns remain. The net Pitz, replay counts and the recipe-number reference lines are therefore **order-of-magnitude indications for trend and for the Owner's scoping**, not gate evidence; they were not reproduced with the real harness (`researchAttempt.sim.test.ts`, Vitest, outside this budget). The 53 verdict does not rest on them: it rests on the attempt step 51 → 53 (+1 attempt, §6), the cohort / letter constraints (§2, §5, §9) and Gate C's recorded recovery behaviour (Margherita replays always recover).

Prices / rewards come from the code (`materialShop.ts` tiers, `pitzReward.ts`, `baseRewardPitz`): every recipe's `baseRewardPitz` is 100; discovery income at ★3 = 100 × 0.8 + 50 = **130** (★4 150, ★5 170); a Margherita replay (starters only) at ★3 = **80**; new materials are T4 (first pack **120**, refill **60**, 10 pizzas of the key count). Exploration consumes finite stock with no Pitz return (Gate C): per attempt, 3 tested toppings cost ≈ **18 Pitz** at the pack unit (conservative, "FULL") or ≈ **7.5 Pitz** at one piece ("ONE", optimistic) at T4 prices. (Consistency check: 1,600 Pitz of refills over ≈ 97 attempts at 27 recipes in Gate C ≈ 16.5 per attempt.)

| | search attempts / recipe | refill Pitz FULL (ONE) | net per new recipe FULL (ONE) | Margherita replays per new recipe FULL (ONE) |
|---|---|---|---|---|
| Production 51, whole run | — | 5,029 (1,972) total | −3,599 (−542) total | 45 total, 0.9 per recipe |
| Production 51, tail band (steps 38–47, mixed tier prices) | ≈ 14 | ≈ 194 (78) | ≈ −184 | ≈ 2.3 |
| **at 53** | 14–15 | 252 (≈ 105) | −242 | **≈ 3** |
| 172, 105-model, mean / tail | 19 / 24 | 342 / 432 (143 / 180) | −332 / −422 (−132 / −170) | 4.2 / 5.3 (1.7 / 2.1) |
| 172, 179-model, mean / tail | 27.8 / 41 | 500 / 738 (209 / 308) | −490 / −728 (−198 / −297) | 6.1 / 9.1 (2.5 / 3.7) |

Assessment:
- **No deadlock at any scale**: every shortfall is recoverable by Margherita replays (starters only, +80 each), as in Gate C. Nothing here is a progression blocker.
- **53: this estimate shows no breakdown.** About 3 replays per new recipe (2.3 for the current tail band, T4-only prices at 53), i.e. +0–1; inside the Gate C precedent (★1 players 2.5–4.5 per recipe, "recoverable, heavy friction").
- **172: friction grows in this estimate; no threshold exists in the documents.** Illustrative reference lines (not thresholds, and subject to the scope note above): marginal replays per new recipe exceed 4.5 at about recipe **#131** (105-model) / **#79** (179-model) and exceed 6 at **#111** (179-model; not reached by 172 in the 105-model). The 105 / 179 models bracket the real end state (matrix: 169 ingredient ids, 31 sauce-like ids).
- K sensitivity (mean attempts 52 → 172, 105-model / 179-model): K = 3 → 20.0 / 28.8; K = 4 → 15.4 / 22.0; K = 5 → 12.6 / 17.9; K = 6 → 10.8 / 15.1. Tail at 53: K = 3 → 16, K = 4 → 12, K = 5 → 10, K = 6 → 9.
- Hint 5.0: Gate C found SAUCE / CHEESE / KEY rungs save ≈ 0 attempts and STRUCTURE (the total) is what ends the scan; this is why the topping axis is not shortened by the existing hints. Not re-measured.

## 8. Owner Decisions (numbers and options only; nothing was changed)

None is required for 53. Before the population goes far past 53 (the §7 reference lines fall between recipe ≈ 80 and ≈ 130):

- **OD-S1 — K policy:** keep K = 3 (OD-RB-10) vs reconsider; options and consequences in the K-sensitivity row above. (Also: whether K may depend on the owned topping pool.)
- **OD-S2 — friction policy:** the Owner-defined acceptable "Margherita replays per new recipe" line (references 3 / 4.5 / 6) and whether stock-refill pricing or the exploration piece count is the lever. No price was invented.
- **OD-S3 — population scope:** only 20 of the 120 remaining rows are FULL and decision-ready; 24 remaining rows need multi-spread (conflicts with sauce 1 per attempt); 76 are BLOCKED_PRODUCT_DECISION. What "172" means as a target (all rows, or the representable subset) is an Owner scope decision.

## 9. Constraints handed to Batch 5 candidate screening

1. **Cohort identity (Research §7 trigger 2):** a new recipe must create a **new single-member cohort**, i.e. carry a dedicated new key material whose acquisition has not been the unlock of any existing recipe. Joining an existing cohort (any of the 48 — `onion` ×3 and `zucchini` ×2 are already lettered; a join to a singleton would add a letter to a recipe that has none today) changes an existing label and re-triggers this audit; do it only on an explicit Owner decision. `recipeBatchValidator` (`landed` manifest) enforces letter identity for pre-existing recipes.
2. **Topping pool growth:** each +3 topping materials adds one attempt to every later recipe; keep the 51 → 53 step to the minimum needed (one dedicated material per recipe, no side materials). A candidate whose non-starter ingredients are all already in Production brings no new key material and would join an existing cohort → constraint 1. (The matrix-wide count of 72 rows without a matrix-unique ingredient, §4, is not this test: whether a candidate joins a cohort is decided per candidate against Production + the proposed batch, in screening.)
3. **Sauce:** one sauce layer per recipe (the 24 multi-spread rows are out of scope for the current mechanic); NO_SAUCE and single-sauce are both fine for the Scale Gate (sauce axis does not bind).
4. **Pricing:** existing T4 only (first pack 120 / refill 60); no new price, no K change, no hint / reward change.
5. **Candidate-specific checks are still owed by Batch 5 screening:** composition collision (matcher / `dinnerResultDetection` signature), DH4 / OD-DH4-2-9 (`tsukimi-pizza` stays deferred), taxonomy / family (`other` rule), sauce profile, glyph (G18), chapter placement, Lunch Rush / CUT declarations.
6. Do not use the matrix's `shippedRecipeIds`; derive "already shipped" from `RECIPES` (§3 method).

## 10. Not checked (stated, not assumed)

- Candidate-specific collision / cohort / DH4 / taxonomy (by instruction).
- Absolute attempt counts from the real reducer harness (model is a ~1.45× envelope, §6).
- Real-player purchase-order variance beyond the worst-case bound (§2).
- Production Deploy #298 itself (Owner-stated).
- Matrix rows with incomplete identity sets (52) are only partially represented in §4.

## Appendix — derived script (read-only; not committed under `tools/`)

Copy it to `tools/` (it resolves the repo root as `..`) and run from the repo root as `node --experimental-strip-types --import ./register.mjs tools/scale_audit_53_derived.mjs` (Node 22; it imports Production TypeScript directly and writes nothing). Delete the copy afterwards. `register.mjs` = `import { register } from "node:module"; register("./hooks.mjs", import.meta.url);`

<details><summary>hooks.mjs (resolver: extensionless relative imports → .ts)</summary>

```js
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith("./")||spec.startsWith("../")) && !/\.\w+$/.test(spec) ) {
    const base = path.dirname(fileURLToPath(ctx.parentURL));
    for (const ext of [".ts", "/index.ts"]) { const p = path.resolve(base, spec+ext); if (existsSync(p)) return next(pathToFileURL(p).href, ctx); }
  }
  return next(spec, ctx);
}
```

</details>

<details><summary>scale_audit_53_derived.mjs</summary>

```js
// READ-ONLY derived script for the 53-recipe Scale Audit (docs/reports/TETO_SCALE-AUDIT-53_Result.md).
// Run: node --experimental-strip-types --import <resolver registering .ts extension lookup> tools/scale_audit_53_derived.mjs
// Reads production data (src/data, researchEntry) and the 172 matrix JSON. Writes nothing. Not part of the build / tests.
import { readFileSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const { RECIPES } = await import(root + "src/data/recipes.ts");
const { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient } = await import(root + "src/data/ingredients.ts");
const { DISCOVERY_LADDER } = await import(root + "src/data/discoveryLadder.ts");
const { researchCohortLetters } = await import(root + "src/logic/discovery/researchEntry.ts");
const { CATALOG_COUNTS } = await import(root + "src/logic/catalog/testSupport/catalogDerived.ts");
const { FIXTURE_INGREDIENT_SPLITS } = await import(root + "src/logic/catalog/testSupport/largeCatalogFixtures.ts");
const { RECIPE_SAUCE_PROFILES } = await import(root + "src/data/recipeSauceProfiles.ts");
const matrix = JSON.parse(readFileSync(root + "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json", "utf8"));
const out = {};

// ---- 1. Gate 0 -------------------------------------------------------------------------------------------------
out.gate0 = { CATALOG_COUNTS, recipes: RECIPES.length, ingredients: INGREDIENTS.length, ladderSteps: DISCOVERY_LADDER.steps.length };
const cat = (id) => getIngredient(id)?.category;
const finite = (id) => !!getIngredient(id)?.unlockCondition;
const distinct = (r) => [...new Set(r.requiredIngredients.map((x) => x.ingredientId))];
const stepOf = new Map();
for (const s of DISCOVERY_LADDER.steps) for (const id of s.ingredientIds) stepOf.set(id, s.step);
const finiteNotInLadder = INGREDIENTS.filter((i) => i.unlockCondition && !stepOf.has(i.id)).map((i) => i.id);
out.gate0.finiteNotInLadder = finiteNotInLadder;
out.gate0.finiteCount = INGREDIENTS.filter((i) => i.unlockCondition).length;
out.gate0.byCategory = Object.fromEntries(["sauce", "cheese", "topping"].map((c) => [c, INGREDIENTS.filter((i) => i.category === c).length]));
out.gate0.noSauce = Object.entries(RECIPE_SAUCE_PROFILES).filter(([, v]) => v === null).map(([k]) => k).length;

// ---- 2. Research cohorts (ladder-order ownership: starters then every ladder material in step order) -------------
const ownedFull = [...STARTER_INGREDIENT_IDS];
for (const s of DISCOVERY_LADDER.steps) for (const id of s.ingredientIds) if (!ownedFull.includes(id)) ownedFull.push(id);
const unlockOf = (r, owned) => { let last = null; for (const id of distinct(r)) { if (!finite(id)) continue; const i = owned.indexOf(id); if (i < 0) return null; if (!last || i > last.i) last = { id, i }; } return last?.id ?? null; };
const cohorts = new Map();
for (const r of RECIPES) { const u = unlockOf(r, ownedFull) ?? "(starters only)"; (cohorts.get(u) ?? cohorts.set(u, []).get(u)).push(r.id); }
const sizes = [...cohorts.values()].map((m) => m.length);
const dist = {}; for (const n of sizes) dist[n] = (dist[n] ?? 0) + 1;
const lettersMap = researchCohortLetters(ownedFull, RECIPES);
out.cohort = {
  cohortCount: cohorts.size, sizeDistribution: dist, maxSize: Math.max(...sizes),
  letteredCohorts: [...cohorts.values()].filter((m) => m.length >= 2).length,
  letteredRecipes: lettersMap.size, singleMemberCohorts: sizes.filter((n) => n === 1).length,
  multiMember: [...cohorts.entries()].filter(([, m]) => m.length >= 2).map(([k, m]) => ({ unlock: k, size: m.length, step: stepOf.get(k) ?? 0 })),
  maxLetter: [...lettersMap.values()].sort((a, b) => b.length - a.length || (a < b ? 1 : -1))[0],
  headroomTo26: 26 - Math.max(...sizes),
};
// order sensitivity: recipes with >=2 finite ingredients (unlock depends on the player's purchase order)
const multiFinite = RECIPES.filter((r) => distinct(r).filter(finite).length >= 2);
out.cohort.orderSensitive = { recipes: multiFinite.length, ids: multiFinite.map((r) => r.id) };
// worst-case cohort size under ANY purchase order: for each finite ingredient x, the number of recipes containing x
const freqProd = {}; for (const r of RECIPES) for (const id of distinct(r)) if (finite(id)) freqProd[id] = (freqProd[id] ?? 0) + 1;
const topProd = Object.entries(freqProd).sort((a, b) => b[1] - a[1]).slice(0, 6);
out.cohort.worstCaseAnyOrder = { maxRecipesContainingOneFiniteIngredient: topProd[0], top: topProd };
out.cohort.dedicatedMaterials = { finiteIngredientsUsedByExactlyOneRecipe: Object.values(freqProd).filter((n) => n === 1).length, finiteUsed: Object.keys(freqProd).length };
// adversarial order sensitivity at production: a "late-buy" order that makes the most-shared ingredient last.
// cohort for ingredient x if x is bought last among each recipe's finite set = all recipes containing x whose other finite are owned.

// ---- 3. 172 matrix vs production ------------------------------------------------------------------------------
const rows = matrix.rows;
const prodIds = new Set(RECIPES.map((r) => r.id));
const prodSets = new Map(RECIPES.map((r) => [[...distinct(r)].sort().join("|"), r.id]));
const strip = (s) => s.replace(/-pizzadb(-p\d+)?$/, "");
const matchRow = (row) => {
  const hits = new Set();
  if (prodIds.has(row.canonicalCandidateId)) hits.add(row.canonicalCandidateId);
  if (prodIds.has(strip(row.canonicalCandidateId)) ) hits.add(strip(row.canonicalCandidateId));
  const c = row.phase0?.correspondsToExistingCatalogId; if (c && prodIds.has(c)) hits.add(c);
  const key = [...(row.ingredients.identityIngredientSet ?? [])].sort().join("|");
  const byset = prodSets.get(key); 
  return { byId: [...hits], bySet: byset && row.ingredients.complete ? byset : null };
};
const overlapRows = []; 
for (const row of rows) { const m = matchRow(row); if (m.byId.length || m.bySet) overlapRows.push({ evidenceId: row.evidenceId, cand: row.canonicalCandidateId, ...m }); }
const prodMatched = new Set(overlapRows.flatMap((o) => [...o.byId, o.bySet].filter(Boolean)));
out.population = {
  matrixRows: rows.length, uniqueEvidenceIds: new Set(rows.map((r) => r.evidenceId)).size,
  matrixShippedIdsListed: { shippedRecipeIds: matrix.shippedRecipeIds.length, note: "stale; NOT used as authority" },
  overlapRowsByIdOrSet: overlapRows.length,
  overlapByIdOnly: overlapRows.filter((o) => o.byId.length).length,
  overlapBySetOnly: overlapRows.filter((o) => !o.byId.length && o.bySet).length,
  productionRecipesMatchedInMatrix: prodMatched.size,
  productionRecipesNotInMatrix: RECIPES.filter((r) => !prodMatched.has(r.id)).map((r) => r.id),
  remainingRowsMin: rows.length - overlapRows.length,
  rowsWithAnyProdMatchMultiToOne: overlapRows.length - prodMatched.size,
};
const overlapIds = new Set(overlapRows.map((o) => o.evidenceId));
const rem = rows.filter((r) => !overlapIds.has(r.evidenceId));
const cnt = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m; }, {});
out.population.remainingByDecisionStatus = cnt(rem, (r) => r.productDecisionStatus);
out.population.remainingByRepresentability = cnt(rem, (r) => r.currentFlowRepresentability);
out.population.remainingBySauceStatus = cnt(rem, (r) => r.sauceBase.status);
out.population.remainingCompleteIngredientRows = rem.filter((r) => r.ingredients.complete).length;
out.population.remainingNoSauceBaseRows = rem.filter((r) => r.sauceBase.status === "none").length;

// ---- 3b. unlock-name information density (frequency of each ingredient across matrix rows, candidate-independent) ----
const starterSet = new Set(STARTER_INGREDIENT_IDS);
const freq = {};
for (const row of rows) for (const id of new Set(row.ingredients.identityIngredientSet ?? [])) if (!starterSet.has(id)) freq[id] = (freq[id] ?? 0) + 1;
const fv = Object.values(freq);
const bucket = (n) => (n === 1 ? "1" : n === 2 ? "2" : n <= 5 ? "3-5" : n <= 10 ? "6-10" : n <= 20 ? "11-20" : ">20");
out.density = {
  rowsWithCompleteSet: rows.filter((r) => r.ingredients.complete).length,
  nonStarterIngredientsInMatrix: fv.length,
  usedByExactlyOneRow: fv.filter((n) => n === 1).length,
  frequencyBuckets: cnt(fv, bucket),
  top: Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12),
  maxFreq: Math.max(...fv),
};
// rows whose every non-starter ingredient is shared (no dedicated material)
out.density.rowsWithNoDedicatedMaterial = rows.filter((r) => r.ingredients.complete && [...r.ingredients.identityIngredientSet].filter((i) => !starterSet.has(i)).every((i) => freq[i] > 1)).length;
out.density.rowsWithDedicatedMaterial = rows.filter((r) => r.ingredients.complete && [...r.ingredients.identityIngredientSet].filter((i) => !starterSet.has(i)).some((i) => freq[i] === 1)).length;
// worst-case cohort: the number of rows that contain ingredient x is an upper bound on a cohort whose unlock is x
out.density.cohortUpperBoundOver26 = Object.entries(freq).filter(([, n]) => n > 26).map(([k, n]) => [k, n]);
// production share
out.density.productionFiniteUsedOnce = out.cohort.dedicatedMaterials;

// ---- 4. attempt scaling (blind scan, sauce 1 / attempt, cheese all at once, toppings K=3, +1 final build) -------
const K = 3;
function attemptsFor(r, ownedSet, splits) {
  // ownedSet: Set of owned ingredient ids at the moment r becomes researchable (known = its unlock fact only)
  const unlock = unlockOf(r, [...ownedSet]);
  const ids = distinct(r);
  const sauces = [...ownedSet].filter((i) => cat(i) === "sauce");
  const toppings = [...ownedSet].filter((i) => cat(i) === "topping");
  const cheeses = [...ownedSet].filter((i) => cat(i) === "cheese");
  const hasSauce = ids.some((i) => cat(i) === "sauce");
  return model({ nSauce: sauces.length, nTop: toppings.length, nCheese: cheeses.length, hasSauce, knownSauce: unlock && cat(unlock) === "sauce", knownTop: unlock && cat(unlock) === "topping", knownCheese: unlock && cat(unlock) === "cheese" });
}
function model({ nSauce, nTop, nCheese, hasSauce, knownSauce, knownTop, knownCheese }) {
  const unkS = knownSauce ? 0 : nSauce;
  const tS = knownSauce ? 0 : hasSauce ? (unkS + 1) / 2 : unkS; // expected position of the true sauce / all-x for no sauce
  const unkC = nCheese - (knownCheese ? 1 : 0);
  const tC = unkC > 0 ? 1 : 0;
  const unkT = nTop - (knownTop ? 1 : 0);
  const tT = Math.ceil(unkT / K);
  return { search: Math.max(tS, tC, tT), total: Math.max(tS, tC, tT) + 1, tS, tC, tT, drivers: { sauce: tS, cheese: tC, topping: tT } };
}
const per = RECIPES.map((r) => {
  const s = Math.max(0, ...distinct(r).filter(finite).map((i) => stepOf.get(i) ?? 0));
  const owned = new Set(STARTER_INGREDIENT_IDS);
  for (const st of DISCOVERY_LADDER.steps) if (st.step <= s) for (const id of st.ingredientIds) owned.add(id);
  return { id: r.id, step: s, owned: owned.size, ...attemptsFor(r, owned) };
});
const sum = (a) => a.reduce((x, y) => x + y, 0);
out.attempts = {
  method: "blind scan; sauce 1 per attempt (expected position (n+1)/2; no-sauce recipe = all n sauces x); cheese all at once (1 attempt); topping K=3 per attempt = ceil(unknown/3); search = max of axes; +1 exact final build. No hints (profile NONE). Sauce axis uses expectation, others deterministic.",
  production51: { total: sum(per.map((p) => p.total)), mean: sum(per.map((p) => p.total)) / per.length, max: Math.max(...per.map((p) => p.total)), maxId: per.reduce((a, b) => (b.total > a.total ? b : a)).id },
  driverShare: cnt(per, (p) => (p.tT >= p.tS && p.tT >= p.tC ? "topping" : p.tS >= p.tC ? "sauce" : "cheese")),
  firstStepRecipes: per.filter((p) => p.step === 0).length,
};
// calibration: the 27-recipe population = recipes whose finite materials are all within ladder steps 1..25
const pop27 = per.filter((p) => p.step <= 25 && RECIPES.findIndex((r) => r.id === p.id) < 27);
out.attempts.calibration27 = { recipes: pop27.length, total: sum(pop27.map((p) => p.total)), mean: sum(pop27.map((p) => p.total)) / pop27.length };
out.attempts.byBand = {}; for (const [lo, hi] of [[0, 10], [11, 24], [25, 37], [38, 47]]) { const b = per.filter((p) => p.step >= lo && p.step <= hi); out.attempts.byBand[`${lo}-${hi}`] = { n: b.length, mean: +(sum(b.map((p) => p.total)) / b.length).toFixed(2), nOwned: b.length ? [b[0].owned, b[b.length - 1].owned] : [] }; }
// marginal: +1 topping material owned => +1/3 attempt; tail recipe attempts now
const tail = per[per.length - 1]; out.attempts.tailRecipe = { id: tail.id, total: tail.total, drivers: tail.drivers, owned: tail.owned };
// ---- 4b. extrapolation to 172 along linear growth of owned categories (bracketed by the 105 and 179 fixtures) ----
const now = { sauce: out.gate0.byCategory.sauce, cheese: out.gate0.byCategory.cheese, topping: out.gate0.byCategory.topping };
function scale(end, N = 172, noSauceShare = 0) {
  const rowsOut = []; let totalAtt = 0;
  for (let k = 1; k <= N; k++) {
    const f = Math.max(0, (k - 51) / (N - 51));
    const lerp = (a, b) => Math.round(a + (b - a) * (k <= 51 ? 1 : f));
    const n = k <= 51 ? null : { sauce: lerp(now.sauce, end.sauce), cheese: lerp(now.cheese, end.cheese), topping: lerp(now.topping, end.topping) };
    if (!n) continue;
    const m = model({ nSauce: n.sauce, nTop: n.topping, nCheese: n.cheese, hasSauce: true, knownSauce: false, knownTop: true, knownCheese: false });
    rowsOut.push({ k, ...n, total: m.total, drivers: m.drivers });
  }
  const t = rowsOut.map((x) => x.total);
  return { endSplit: end, recipes52to172: rowsOut.length, meanAttempts: +(sum(t) / t.length).toFixed(1), tailAttempts: t[t.length - 1], tailDrivers: rowsOut[rowsOut.length - 1].drivers, at53: { owned: rowsOut[1], total: rowsOut[1].total }, sumAttempts52to172: Math.round(sum(t)), sauceAxisAtTail: rowsOut[rowsOut.length - 1].drivers.sauce };
}
out.attempts.scale172 = { fixture105: scale(FIXTURE_INGREDIENT_SPLITS["105"]), fixture179: scale(FIXTURE_INGREDIENT_SPLITS["179"]) };
// what production-51 produces for the same +2 growth: ingredient count at 53 if two single-use topping materials are added
out.attempts.at53ifTwoToppingMaterials = model({ nSauce: now.sauce, nTop: now.topping + 2, nCheese: now.cheese, hasSauce: false, knownSauce: false, knownTop: true, knownCheese: false });
out.attempts.at53ifTwoToppingMaterials_sauceRecipe = model({ nSauce: now.sauce, nTop: now.topping + 2, nCheese: now.cheese, hasSauce: true, knownSauce: false, knownTop: true, knownCheese: false });
// sauce axis pool at production: the matrix sauce pool
const sauceIds = new Set(); for (const r of rows) for (const s of r.sauceBase.spreadLayers ?? []) sauceIds.add(s);
out.attempts.matrixDistinctSauceSpreadIds = sauceIds.size;
out.attempts.matrixSauceCountPerRow = cnt(rows, (r) => (r.sauceBase.spreadLayerCount ?? 0));

// ---- 5. K=3 / Pitz economy (first order; prices from the Shop authority src/logic/materialShop.ts) ----------------
const { materialOffer, MATERIAL_PRICE_TIERS, MATERIAL_PACK_PIZZAS } = await import(root + "src/logic/materialShop.ts");
const { qualityMultiplierForScore, PITZ_FIRST_DISCOVERY_BONUS, PITZ_QUALITY_FLOOR } = await import(root + "src/logic/pitzReward.ts");
const offers = INGREDIENTS.map((i) => materialOffer(i)).filter(Boolean);
const offerOf = Object.fromEntries(offers.map((o) => [o.ingredientId, o]));
const firstPackSum = sum(offers.map((o) => o.packPrice));
const t4 = MATERIAL_PRICE_TIERS.find((t) => t.tier === "T4");
const meanK_T4 = mean(offers.filter((o) => o.tier === "T4").map((o) => o.k));
const base = RECIPES[0].baseRewardPitz; // all recipes share one base reward (checked below)
const star = { star3_x0p8: qualityMultiplierForScore(65), star4_x1p0: qualityMultiplierForScore(80), star5_x1p2: qualityMultiplierForScore(95) };
const disc = (m) => Math.max(PITZ_QUALITY_FLOOR, Math.round(base * m)) + PITZ_FIRST_DISCOVERY_BONUS;
const replay = Math.round(base * star.star3_x0p8); // Margherita replay (starters only, no first-discovery bonus)
function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
// exploration drain per attempt: K unknown toppings tested; FULL = pack-unit pieces (refill/10 per topping), ONE = 1 piece (refill/(10k))
function drain(ownedToppings) {
  const o = ownedToppings.map((i) => offerOf[i]).filter(Boolean);
  if (!o.length) return { full: 0, one: 0 };
  return { full: K * mean(o.map((x) => x.refillPrice / MATERIAL_PACK_PIZZAS)), one: K * mean(o.map((x) => x.refillPrice / x.packQuantity)) };
}
const perEcon = RECIPES.map((r) => {
  const p = per.find((q) => q.id === r.id);
  const owned = new Set(STARTER_INGREDIENT_IDS); for (const st of DISCOVERY_LADDER.steps) if (st.step <= p.step) for (const id of st.ingredientIds) owned.add(id);
  const d = drain([...owned].filter((i) => cat(i) === "topping"));
  return { id: r.id, step: p.step, search: p.search, full: p.search * d.full, one: p.search * d.one };
});
const income3 = disc(star.star3_x0p8);
out.economy = {
  authority: { MATERIAL_PRICE_TIERS, packPizzas: MATERIAL_PACK_PIZZAS, firstDiscoveryBonus: PITZ_FIRST_DISCOVERY_BONUS, qualityFloor: PITZ_QUALITY_FLOOR, baseRewardAllRecipes: [...new Set(RECIPES.map((r) => r.baseRewardPitz))], star },
  income: { discoveryStar3: disc(star.star3_x0p8), discoveryStar4: disc(star.star4_x1p0), discoveryStar5: disc(star.star5_x1p2), margheritaReplayStar3: replay },
  production51: { materials: offers.length, firstPackSum, firstPackPerRecipe: +(firstPackSum / RECIPES.length).toFixed(1), discoveryIncomeStar3Sum: income3 * RECIPES.length,
    explorationRefillSum: { full: Math.round(sum(perEcon.map((x) => x.full))), one: Math.round(sum(perEcon.map((x) => x.one))) } },
  drainPerAttemptAtTail: (() => { const d = drain([...ownedFull].filter((i) => cat(i) === "topping")); return { full: +d.full.toFixed(1), one: +d.one.toFixed(1) }; })(),
  byBand: Object.fromEntries([[0, 10], [11, 24], [25, 37], [38, 47]].map(([lo, hi]) => { const b = perEcon.filter((x) => x.step >= lo && x.step <= hi); return [`${lo}-${hi}`, { n: b.length, refillFull: Math.round(mean(b.map((x) => x.full))), refillOne: Math.round(mean(b.map((x) => x.one))) }]; })),
};
const ec = out.economy; const pr = ec.production51;
pr.netFull = pr.discoveryIncomeStar3Sum - pr.firstPackSum - pr.explorationRefillSum.full;
pr.netOne = pr.discoveryIncomeStar3Sum - pr.firstPackSum - pr.explorationRefillSum.one;
pr.replaysNeededFull = Math.max(0, Math.ceil(-pr.netFull / replay));
pr.replaysPerRecipeFull = +(pr.replaysNeededFull / RECIPES.length).toFixed(2);
// scale: per NEW recipe (T4 first pack 120 + refills at T4 refill 60), linear-growth attempts from section 4b
function scaleEcon(sc, label) {
  const searchMean = sc.meanAttempts - 1, searchTail = sc.tailAttempts - 1;
  const fullPerAttempt = K * t4.refillPrice / MATERIAL_PACK_PIZZAS; // all-T4 toppings at the pack unit
  const onePerAttempt = K * t4.refillPrice / (MATERIAL_PACK_PIZZAS * meanK_T4);
  const f = (att, per1) => { const refill = att * per1; const net = income3 - t4.packPrice - refill; return { searchAttempts: +att.toFixed(1), refill: Math.round(refill), net: Math.round(net), replaysPerRecipe: +Math.max(0, -net / replay).toFixed(1) }; };
  return { label, meanFull: f(searchMean, fullPerAttempt), meanOne: f(searchMean, onePerAttempt), tailFull: f(searchTail, fullPerAttempt), tailOne: f(searchTail, onePerAttempt) };
}
ec.meanK_T4 = +meanK_T4.toFixed(2);
ec.t4PerAttemptDrain = { full: K * t4.refillPrice / MATERIAL_PACK_PIZZAS, one: +(K * t4.refillPrice / (MATERIAL_PACK_PIZZAS * meanK_T4)).toFixed(1) };
ec.at53 = (() => { const sc = out.attempts.scale172.fixture105; const m = out.attempts.scale172.fixture105.at53.total - 1; const fp = K * t4.refillPrice / MATERIAL_PACK_PIZZAS; const refill = m * fp; const net = income3 - t4.packPrice - refill; return { searchAttempts: m, refillFull: Math.round(refill), net: Math.round(net), replays: +Math.max(0, -net / replay).toFixed(1) }; })();
ec.at172_fixture105 = scaleEcon(out.attempts.scale172.fixture105, "105-ingredient end state");
ec.at172_fixture179 = scaleEcon(out.attempts.scale172.fixture179, "179-ingredient end state");
// time-cost proxy: total attempts over the whole run
out.attempts.totalAttemptsWholeRun = { production51: out.attempts.production51.total, to172_fixture105: out.attempts.production51.total + out.attempts.scale172.fixture105.sumAttempts52to172, to172_fixture179: out.attempts.production51.total + out.attempts.scale172.fixture179.sumAttempts52to172 };
// ---- 6. extras: K sensitivity, pending Research Entries along the ladder, multi-spread rows in the remaining population ----
out.kSensitivity = {};
for (const k of [3, 4, 5, 6]) {
  const g = (end) => { const t = []; for (let n = 52; n <= 172; n++) { const f = (n - 51) / (172 - 51); const L = (a, b) => Math.round(a + (b - a) * f); t.push(Math.max((L(now.sauce, end.sauce) + 1) / 2, 1, Math.ceil((L(now.topping, end.topping) - 1) / k)) + 1); } return +(sum(t) / t.length).toFixed(1); };
  out.kSensitivity[k] = { at53_tail: Math.max(2, 1, Math.ceil((now.topping + 1 - 1) / k)) + 1, mean52to172_fixture105: g(FIXTURE_INGREDIENT_SPLITS["105"]), mean52to172_fixture179: g(FIXTURE_INGREDIENT_SPLITS["179"]) };
}
out.pendingEntries = (() => { let max = 0, at = 0; const stepOfRecipe = RECIPES.map((r) => Math.max(0, ...distinct(r).filter(finite).map((i) => stepOf.get(i) ?? 0))); for (let st = 0; st <= 47; st++) { const reg = stepOfRecipe.filter((x) => x <= st).length; const pend = reg - st; if (pend > max) { max = pend; at = st; } } return { maxPendingIfOneDiscoveryPerStep: max, atStep: at }; })();
out.population.remainingMultiSpreadRows = rem.filter((r) => (r.sauceBase.spreadLayerCount ?? 0) >= 2).length;
out.population.allMultiSpreadRows = rows.filter((r) => (r.sauceBase.spreadLayerCount ?? 0) >= 2).length;
out.population.remainingRequiringStructuralCapability = rem.filter((r) => (r.requiredCapabilities ?? []).length > 0).length;
out.population.remainingFullAndReady = rem.filter((r) => r.currentFlowRepresentability === "FULL" && ["READY", "READY_WITH_REVIEW"].includes(r.productDecisionStatus)).length;
out.population.remainingFullReadyWithCompleteIngredients = rem.filter((r) => r.currentFlowRepresentability === "FULL" && ["READY", "READY_WITH_REVIEW"].includes(r.productDecisionStatus) && r.ingredients.complete).length;
// ---- 7. friction horizon: first recipe count N (52..172) where marginal Margherita replays per new recipe exceed a reference line ----
// Reference lines are NOT thresholds (Owner decides): 3 = about today's tail (Gate C recorded "2.5-4.5 per recipe, recoverable but heavy friction" for a star-1 player), 4.5 = top of that range, 6.
out.horizon = {};
for (const [name, end] of [["fixture105", FIXTURE_INGREDIENT_SPLITS["105"]], ["fixture179", FIXTURE_INGREDIENT_SPLITS["179"]]]) {
  out.horizon[name] = {};
  for (const line of [3, 4.5, 6]) {
    let hit = null;
    for (let n = 52; n <= 172 && hit === null; n++) {
      const f = (n - 51) / (172 - 51); const L = (a, b) => Math.round(a + (b - a) * f);
      const search = Math.max((L(now.sauce, end.sauce) + 1) / 2, 1, Math.ceil((L(now.topping, end.topping) - 1) / K));
      const replays = (search * K * t4.refillPrice / MATERIAL_PACK_PIZZAS + t4.packPrice - income3) / replay;
      if (replays > line) hit = n;
    }
    out.horizon[name][`>${line}`] = hit ?? "not reached by 172";
  }
}
console.log(JSON.stringify(out, null, 1));
```

</details>
