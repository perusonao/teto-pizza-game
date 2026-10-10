# Discovery 3.0 PR-4a: Branching / pool > 1 test foundation — Result Report

> **2026-10-10 supersede note:** OD-D3-21 ("a key-free ladder omits a rung that does not apply"; defined in this report and in code comments) is **amended by OD-H5-BASE-1** (`docs/decisions/TETO_HINT-5_BASE-RUNG_OWNER-DECISIONS.md`): the key-free ladder becomes `BASE → STRUCTURE → SUB_CLASS…` for every key-free recipe. This report is a historical record and is not otherwise edited. The change takes effect when PR-E merges.


Branch `claude/discovery3-pr4a-pool-foundation`, from `origin/main` `a0201e3` (PR-1 #322, PR-2 #323, PR-3 #324 merged; #295 still open and untouched).
Authority: Pre-PR4 Gate (`TETO_DISCOVERY-3_PRE-PR4_Gate.md`, audit branch), Owner review of that gate (PR-4a = GO, PR-4b = NO-GO).

## 1. Production behaviour change

**None.** The diff contains only test files, test-support modules (`src/logic/testSupport/`), two e2e specs and this report.
No production module under `src/` (data, logic, state, components) changed; `recipes.ts` still has 25 recipes, and no
quantity / bake / placement / CUT / Lunch Rush / Dinner / save-schema / `cookingProfiles` change was made.
`branchingPool.test.ts` guards this: no production module imports the new test support, and the synthetic recipe is not in `RECIPES`.

## 2. What changed

| area | change |
|---|---|
| `testSupport/branchingFixture.ts` (new) | synthetic non-credit branching recipe B (production ingredients only, `ladderCredit: false`), `W1_RECIPES` (credited population), `walkState()` (state after discovering an arbitrary ordered list, derived with the real entitlement authority), `poolOf` / `remainingOf` / `branchPoint` |
| `testSupport/hintRoles.ts` (new) | `KEYED_RECIPES` / `KEY_FREE_RECIPES` / `authoredRoles()` so tests that pin the authored key table do not read a key a key-free recipe does not have |
| `branchingPool.test.ts` (new, 29 tests) | pool 0 / 1 / 2+, **A → B and B → A**, both-orders-same-end-state, hint target contract, near-miss and Notebook privacy, simulation termination under 5 choice policies |
| harnesses (`discoveryHintEconomySim`, `hint5EconomySim`) | the walk stops when **every recipe is discovered**, not at a hard-coded 25 (no unique-next / single-path assumption) |
| existing tests | made pool-aware (see §4); 25 W1 behaviour unchanged |

## 3. The pool = 2 contract (what the new tests pin)

At the branch point A (W1) and B (non-credit) are both DISCOVERABLE. For each discovery order:
- the pool shrinks by the discovered recipe and **never hides the other** (finding B first leaves `[A]`; finding A first leaves `[B, next W1]`);
- **ladder count and reached step advance only for the credited recipe** (B first: count/step unchanged; A first: +1);
- **entitlement**: a non-credit discovery never unlocks the next material early (B first: identical to before; the second discovery moves it only if it is credited);
- both orders end in the same ladder count, entitlement, pool and remaining set;
- the auto hint target is a pool member, deterministic for the same state whatever the Dex / owned / **population array order**; every pool member can be pinned (Dex card path); array order is not authority;
- near-miss results carry only `kind / distance / sauceStep / keyUnused`, never a recipe id or name; each pool member's own pizza is `distance 0 → null`;
- an INCOMPLETE attempt for A and for B record **identically** in the Trial Notebook, with no recipe in the record;
- 5 choice policies (first / last / alternating / B-early / B-late) all terminate with every recipe found exactly once, same final count and entitlement.

## 4. Pre-PR4 semantic failures: before → after

Dry-run = scratch worktree with a placeholder `brazilian-calabresa` (never committed). Before: 44 files / 140 tests failed. After PR-4a (same dry-run): **31 files / 44 tests**; the production (25) world: **288 files, 5506 tests, all pass**.

| area (Pre-PR4 SEMANTIC) | before | after |
|---|---|---|
| `hintTarget.test` | 26 | 0 — W1 walk asserted on the credited population; full-pool target is a pool member (pool-aware) |
| `nearMiss.test` T-20 | 13 | 0 — every pool member reached through its own pinned hint |
| `DexOverlay.hint.test` | 15 | 1 (mechanical: "25 slots") |
| `discoveryHint.test` | 3 | 0 — pinned W1 target; `complete()` includes non-credit |
| `discoveryHint.walk.test` | 1 | 1 (explicit population pin only); Shop-visit rule restated as "first stage at each ladder count" |
| `hintSteps.test` / `selectableHint.test` | 1 / 1 | 0 / 0 |
| `discoveryHintEconomy.sim.test` | 1 | 1 (explicit pin only); per-hinted-recipe prefix-sum rule |
| `hint5Economy.sim.test` | 3 | 1 (explicit pin only); design table scoped to its 25 recipes, others priced by rung rules |
| `persistence.*` (3 files) | 10 | 0 — "unknown future recipe id" fixtures no longer use `brazilian-calabresa` |
| `w1LadderEconomy` / `w1Reachability` | 3 / 8 | 1 / 1 (explicit pin only) |
| `techniques.tq1c` | 1 | 0 — audit baseline scoped to the credited population |
| `hint5Ladder` / `Production.gate` / `Taxonomy.gate` / `HintSheet.hint5` | 3 / 5 / 4 / 1 | 0 / 1 / 1 / 0 — key-free aware; FREE LEAK compared within the keyed group or a key-free recipe's sauce/cheese pattern (OD-D3-21) |
| PR-2 / PR-3 own invariants (`ladderCredit`, key-free golden) | 5 | 0 — scoped to the 25 W1 / authored-key recipes |

**Parity (production 25):** all 126 simulation runs (both harnesses, 3 qualities × profiles × curves / transactions) are **byte-identical** to `main` (1,207,531-byte JSON compared with `cmp`). The golden Hint 5.0 snapshot from PR-3 still matches.

## 5. Remaining 26-recipe dry-run failures (44 tests, 31 files)

Re-classification:
- **A. mechanical 25 → 26 migration:** count / chapter pins (`6/9/10` → `6/10/10`), `N/25` in App / Dex / PizzaSelect, `recipes.test` lists, `referencePizza.w1`, `recipeSauceProfiles`, `completionGate`, `economySimulation`, `efficiency`, `largeCatalogFixtures`, `deductionGuard` / `deductionProduction` counts, `progression` / `recipeDiscoveryState` fresh-save counts, and the explicit "production population is 25" tripwires in the two sims and the walk. Update the number explicitly in PR-4b (intentional pins).
- **B. remaining semantic failure: 0.**
- **C. authoring / data incomplete:** `scoringV2.noSauceParity` (snapshot needs the new recipe's rows), `dinnerResultDetection` bake-window count, `cookingProfiles` (CUT eligibility + step table: OD-D3-22, after #295), reference placement / quantity / bake (OD-D3-24).

## 6. Verification
Focused tests; full unit **5506 passed / 1 skipped** (288 files); `tsc -b`, `oxlint` (no new findings), `vite build` OK; changed e2e specs (`discovery-hint-facts-save`, `save-forward-compat-3-4b`: the unknown-recipe fixture id only) pass at 390×844; required CI / WebKit on the PR. No Human Verification (no production-visible change).
