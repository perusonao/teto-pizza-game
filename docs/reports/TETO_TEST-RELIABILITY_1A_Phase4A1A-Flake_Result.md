# Test Reliability 1A: `phase4a1a.regression.test.ts` Flake Elimination — Result

## Audited main SHA

Implementation started at `13151e8b2521dd90e7df17e2760e1321fc92be24` — "Firebase ranking
Phase 1A: foundation and anonymous auth (#113)". Before opening the PR, Duplicate PR Gate #2's
`git fetch origin` found main had advanced to `ef00ed744f9a721194efde1c527282d1ba648a74` —
"Recipe Expansion Batch 1B-B: add Capricciosa (#114)", which adds a 14th recipe
(`capricciosa`). Per the task's Gate #2 instructions, this branch merged that commit
(`git merge origin/main`, clean, no conflicts) and **re-ran the target test (60x) and the full
verification suite against the merged result** — see "Full verification" below. All numbers in
this report are from that post-merge state (`ef00ed7`).

Duplicate PR Gate #1 (before implementation): `git fetch origin` + a listing of every open PR
and every `phase4a1a`/`flake`/`flaky`/"test reliability" branch found nothing in scope. Open
PRs at the time were #105 (Dev Automation A1, draft), #72 (docs), #46 (Dough Shaping D0 audit),
#34 (Reference visual unification), #3 (docs) — none touching this test or test reliability.

## Root cause

`src/state/phase4a1a.regression.test.ts`'s first "non-Margherita sauce interaction" test built
its fixture as:

```ts
const owned = ["tomato-sauce", "garlic", "oregano"]; // marinara only
let state = createInitialGameState(EMPTY_DEX, owned);
for (let i = 0; i < 20 && state.recipe.id !== "marinara"; i += 1) {
  state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
}
expect(state.recipe.id).toBe("marinara");
```

This looks like it should reliably land on `marinara` — its three required ingredients
(`tomato-sauce`, `garlic`, `oregano`) are exactly what's owned, and no other recipe's
`requiredIngredients` is a subset of that set. But `marinara` also carries a **Dex-chain
unlock gate** (`src/data/recipes.ts`):

```ts
{
  id: "marinara",
  requiredIngredients: [tomato-sauce, garlic, oregano],
  unlockCondition: { requiresRecipeId: "funghi" },
}
```

`recipeUnlocked` (`src/state/progression.ts`) checks `unlockCondition` against the **Dex**, not
ingredient ownership. Against `EMPTY_DEX`, `funghi` is never discovered, so
`recipeUnlocked(marinara, EMPTY_DEX)` is `false` — `marinara` is LOCKED regardless of what's
owned. Since no other recipe's ingredients are satisfied by `owned` either,
`availableRecipeIds(EMPTY_DEX, owned)` (`src/state/progression.ts`) returns an **empty array**.

`availableOrders` (`src/data/orders.ts`) treats an empty filtered pool as "availability data is
missing" and falls back to the **full 13-recipe `ORDERS` list** — a deliberate production
safety net ("an order phase must never have zero candidates to pick from"), not a bug. From
there, `getNextOrder`'s `pickRandom` (`Math.random()`-based, `src/data/orders.ts:113`) draws
uniformly from all 13 recipes on every `MISSION_RESET_ORDER` dispatch
(`nextMissionOrderState` → `pickMissionOrder` → `getNextOrder`).

**Old probabilistic behavior:** the test retried up to 20 times hoping to draw `marinara` by
chance from that 13-recipe fallback pool. Per attempt, P(miss) ≈ 12/13 (slightly better once
`excludeRecipeId` narrows the pool on a repeat, but the bulk of the mass is the initial
uniform draw). Over 20 independent attempts:

- 13 recipes (today): P(never hits marinara) = (12/13)^20 ≈ **19.9%** expected flake rate.
- 14 recipes: (13/14)^20 ≈ 23.4%.
- 16 recipes: (15/16)^20 ≈ 27.9%.

Recipe-catalog growth strictly worsens the miss probability, exactly matching the reported
symptom ("recipe catalog拡張で成功確率が悪化する").

The test's own random dependency was the bug — not the production `Math.random()` fallback,
which is working exactly as designed (an intentional "never zero candidates" safety net for a
production edge case the test fixture was accidentally triggering).

## Exact fix

Marking `funghi` discovered in the fixture's `dex` directly satisfies marinara's
`unlockCondition: { requiresRecipeId: "funghi" }` — `recipeUnlocked` only checks the Dex flag
for the named recipe id, not a full unlock chain walk, so this doesn't require also
"legitimately" discovering `margherita`/`funghi` through gameplay rounds. Combined with
`owned` already being exactly marinara's three ingredients (verified against all 13
recipes' `requiredIngredients` — no other recipe is a subset), `availableRecipeIds` now
returns exactly `["marinara"]`: a single-entry pool, no fallback, no `Math.random()` in the
selection path at all.

```ts
const owned = ["tomato-sauce", "garlic", "oregano"]; // marinara's own ingredients only
const funghiDiscoveredDex: DexState = [
  { recipeId: "funghi", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
];
let state = createInitialGameState(funghiDiscoveredDex, owned);
expect(state.recipe.id).toBe("marinara");
```

The retry loop was deleted entirely — `createInitialGameState`'s own `preferFirst` order
selection (`pool.find(margherita) ?? pool[0]`) already lands on `marinara` in one call, since
it's the only order in the pool. No `MISSION_RESET_ORDER` dispatch, no iteration, no
`Math.random` mock.

This is Fix Principle A (build the fixture correctly so the intended recipe is guaranteed
available) — no test-only production hook, no mocking of `Math.random`, no change to
`getNextOrder`/`pickRandom`/`availableRecipeIds`/`recipeUnlocked` production behavior.

- **Production files changed: No.**
- **Retry/randomness remaining in this test: No.** The test now reaches its target recipe
  through one deterministic `createInitialGameState` call; nothing in its path calls
  `Math.random`.

## Regression verification

- Target test file run individually: **100/100 runs** at the pre-merge 13-recipe catalog
  (`13151e8b`), plus **60/60 more runs** after merging main's 14-recipe catalog (`ef00ed7`,
  Capricciosa) — **160/160 total**, `8 passed (8)` every time (isolated
  `npx vitest run src/state/phase4a1a.regression.test.ts` invocations, fresh process each
  time — rules out "passing only because an in-process retry loop happened to succeed").
- Related state-layer tests (`src/state/`, 21 files), post-merge: **514/514 passed**.
- No `afterEach`/`Math.random` mock restore concerns apply — the fix uses no mocking.
- No global leakage risk — the fix only changes local fixture construction (a `dex` array and
  removal of a loop), touching no shared/module-level state.

## Recipe-count scalability

Production recipe count freshly confirmed (post-merge, at `ef00ed7`): **14 recipes** in
`src/data/recipes.ts` (`margherita, marinara, quattro-formaggi, genovese, bismarck, funghi,
fugazza, salsiccia, pepperoni, napoletana, tonno-e-cipolla, pizza-bianca, breakfast-pizza,
capricciosa`) — one more than the 13 present when implementation started, since main
advanced mid-task with PR #114 (Recipe Expansion Batch 1B-B). This was a live test of the
scalability requirement, not a hypothetical: `capricciosa` requires `mozzarella`, `mushroom`,
`ham`, and `black-olive`, none of which this test's fixture owns, so it doesn't affect
`availableRecipeIds(funghiDiscoveredDex, owned)` at all — confirmed by re-running the target
test 60x clean against the merged catalog (see below).

The new fixture has no dependency on `RECIPES.length` or catalog composition beyond the two
facts already true today and unrelated to how many recipes exist: (1) marinara's own three
ingredients are not a subset of any other recipe's `requiredIngredients`, and (2) marinara's
`unlockCondition` is satisfied by having `funghi` discovered. Adding recipe #15, #16, or
beyond does not change `availableRecipeIds(funghiDiscoveredDex, owned)`'s result (still
exactly `["marinara"]`) unless some future recipe is deliberately authored to also require only
`{tomato-sauce, garlic, oregano}` (or fewer) with no additional unlock gate — a same-class
design collision this test wasn't previously guarding against either, and outside this PR's
scope. No probabilistic/catalog-length-dependent assertion remains.

## Full verification

All numbers below are from the final, post-merge state (`ef00ed7`, main + Capricciosa merged
in) unless noted otherwise.

- `npx vitest run src/state/phase4a1a.regression.test.ts` × 160 total (100 pre-merge + 60
  post-merge): 160/160 pass.
- `npx vitest run src/state/`: 514/514 pass (21 files).
- `npm test` (full suite), run 1: **87 test files, 1705 tests passed.**
- `npm test` (full suite), run 2: **87 test files, 1705 tests passed** — identical counts both
  runs, no new failures or flakes surfaced by this change or pre-existing elsewhere. (Pre-merge,
  at `13151e8b`, the same full suite ran twice as 87 files / 1682 tests, also identical both
  times; the +23 test delta after merging is Batch 1B-B's own new Capricciosa coverage, not
  something this PR added.) Console shows repeated `Not implemented: HTMLCanvasElement's
  getContext()` jsdom warnings — pre-existing, unrelated to this fix, not test failures.
- `npx tsc -b`: clean, no errors.
- `npm run lint` (oxlint): clean, exit code 0, no warnings.
- `npm run build` (`tsc -b && vite build`): succeeded — 107 modules transformed, build output
  emitted normally.

## Final Verdict

**A. FLAKE ELIMINATED**

The test's only source of nondeterminism (production's `Math.random()` fallback pool,
triggered by an incorrectly-constructed fixture) has been removed by correcting the fixture
to make `marinara` the sole available recipe outright. 100 isolated runs of the target test,
two full-suite runs, `tsc`, `lint`, and `build` all pass cleanly with zero production
behavior change.
