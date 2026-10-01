# Discovery 3.0 PR-4a: Population-Parametric Tests — Result Report

Branch `claude/discovery3-pr4a-population-parametric`, from `origin/main` `a0201e35473ea0f7d27bf9d1c054587b4cfe23e2`
(#322 / #323 / #324 are on `main`). **Test / test-support only; production-visible behaviour diff = 0.** No PR opened,
nothing merged. Owner authorised a scratch-worktree-only dry-run with a temporary `brazilian-calabresa`
(not a production approval); this report records it.

## 1. What PR-4a changes (and what it does not)

Production source touched: `src/data/recipeHintRoles.ts` (type widened to `Record<RecipeId, HintRoles>` + a `keyedHintRoles`
accessor; zero key-free production recipes) and `src/components/DexOverlay.tsx` (optional `recipes` prop, default `RECIPES`,
test seam, no visible effect). Everything else is tests / test-support / E2E seeds. `src/data` carries **no** calabresa data.

| § | Item | Result |
|---|---|---|
| 2 | Synthetic branching population | `testSupport/syntheticPopulation.ts` (A = `pizza-portuguesa`, B = synthetic non-credit, same key step 12; built on a frozen 25-id base so a later production recipe cannot change fixture meaning), `discoveryWalk.ts` (enumerates every legal discovery order), `syntheticModuleMocks.ts` (`vi.mock` factories, no production file edited). Pool 0 / 1 / 2+ and A→B / B→A checked on the pure layer and the **real reducer**: pool, UNKNOWN count, ladder count, Shop entitlement, termination, no softlock. |
| 9 | Simulation | Final Gate walk is a shared population-parametric suite (production25 file + synthetic-26 file). Economy sims end on "all recipes discovered" (was "Dex == 25": with a pool of 2 they stopped with a recipe undiscovered) and the hint-spend prefix-sum check is per **hinted** target (the pizza found can differ from the one hinted). Production25 walk output is byte-identical to before (25 rows diffed). |
| 3 | Premise-bound tests | `hintTarget`, `nearMiss` (reachability walk over every candidate as a target), `discoveryHint`, `DexOverlay.hint`, `w1LadderEconomy` (ladder derivation excludes non-credit recipes), hint5 gates, hint economy sims, and E2E seeds (`discovery-hint5-ladder`, `discovery-hint-sheet` COMPLETE) now derive expectations from the population (credit flag, key step, rung structure), not from "one discoverable recipe / 25 = complete". Identical assertions when no non-credit recipe exists. |
| 6 | Hint5 invariant | "Every target identical before STRUCTURE" → identical within a **pre-STRUCTURE rung signature** (which of SAUCE / CHEESE / KEY exist; recipe-structure only), no SUB_CLASS before STRUCTURE, key-free recipes with different toppings byte-identical (OD-D3-21). Golden `hint5.production25.json` unchanged. Purchase-order gate is structure-aware. |
| 7 | `RECIPE_HINT_ROLES` | type only; a gate asserts 0 key-free production recipes. |
| 8 | Fixture ids | `brazilian-calabresa` / `calabresa` → `future-synthetic-recipe` / `future-synthetic-ingredient` (unit + E2E). |
| 4 / 5 | auto target / Dex 🎨 | characterised only (current deterministic behaviour pinned as "current, not authority"); no policy decided. |

## 2. Verification of PR-4a itself (production 25)

- Unit: **5498 passed**, 1 skipped (baseline on `a0201e3`: 5471; +27 new, 0 regressions). `tsc -b` clean, `vite build` OK,
  `oxlint` 2 warnings (same as baseline).
- Relevant Chromium E2E (iphone-390x844): 11 specs / **40 passed, 0 failed** (hint5-ladder, hint-sheet, dex-hint, near-miss,
  oracle-neutralization, duplicate-notice, rt01, hint-facts-save, forward-compat, onboarding, lunch-rush shortage).
  `discovery-hint-sheet.spec.ts` alone: 7/7.
- An earlier production-25 E2E run was **invalid** (Playwright reused a leftover scratch dev server on :5183, i.e. it ran the
  26-recipe tree). It was discarded and is not a result; the run above used the repo's own server.

## 3. Temporary 26-recipe dry-run (scratch worktree only, never committed)

Method: detached worktree at the PR-4a HEAD, `node_modules` symlinked; a placeholder `brazilian-calabresa` added as the 26th
recipe: `ladderCredit: false`, key-free roles, discovery target id, sauce profile (tomato), placeholder reference geometry,
order, CUT-eligible. Ingredients tomato-sauce / sausage ×3 / onion ×2 / black-olive ×2 / oregano ×1, **no cheese**
(black-olive uncertainty kept). Quantity / bake / placement are measurement placeholders, **not authority**. This is not the
Pre-PR4 data (that document was never available); numbers below are a fresh measurement, not a reproduction of 75 / 140 / 29.

### Unit (full suite)
| Stage | Failures | Files | Notes |
|---|---|---|---|
| PR-4a first partial HEAD `b5c09ae` + temp26 data | 144 | 44 | included 15 failures in PR-4a's own then-fragile fixtures and many premise-bound tests |
| PR-4a HEAD + temp26 data only (pre-pin) | **60** | 34 | **MECHANICAL 51, AUTHORING 9, SEMANTIC 0** |
| + MECHANICAL pins + AUTHORING placeholders (scratch) | **0** | 0 | 5515 tests (5514 pass, 1 skip) |

The 144 → 60 difference is the semantic work PR-4a already did (and the fragile-fixture fixes); the remaining 60 are all
count pins / authored per-recipe data. Pre-PR4's 75 semantic failures are therefore not directly comparable (different
temporary data, different counting).

AUTHORING (9): CUT profile ×2 (`cookingProfiles`), hint5 P-C price row ×2, hintSteps no-cheese list ×1, `unlockCondition`
list ×1 (`progression`), frozen score-parity snapshot rows ×2, TQ-1D `SAUCE_ONLY` 44→77 / k<2 12→13 ×1 (see §6).

### E2E (Chromium)
| Run | 390×844 | Notes |
|---|---|---|
| 1 (temp26 data, no pins) | 29 failed | 26 MECHANICAL (Dex pill `N/25`, rt01 count), 3 SEMANTIC (below) |
| 2 (pill sed, missed 10 template-literal pills) | 12 failed | 10 MECHANICAL, 2 SEMANTIC |
| 3 (+ hint5-ladder seed fix `9972013`) | 1 failed | `empty state COMPLETE` SEMANTIC — **newly exposed**: it had been masked by its pill failure |
| 4 (+ COMPLETE seed fix `7e5d8c0`) | **0 failed**, 157 passed, 11 skipped | FINAL |
| 360×800 (same tree) | **0 failed**, 137 passed, 31 skipped (width-guarded) | FINAL |

Final E2E classification (29 distinct failing tests at the data-only stage): **MECHANICAL 26, SEMANTIC 3, AUTHORING 0,
FLAKE/INFRA 0.** SEMANTIC = `discovery-hint5-ladder` ×2 (the hint sheet's automatic target became the non-credit recipe, so the
seeded `marinara` / `quattro-formaggi` ladder was not the one shown) and `discovery-hint-sheet` `empty state COMPLETE`
("25 ladder recipes discovered = complete"). All three were test premises, fixed in PR-4a (seed marks non-credit recipes
discovered); production code unchanged. **Remaining SEMANTIC = 0.**

## 4. Measured player-visible behaviour with the temporary recipe (facts only; no policy decided)

- **pool = 2** at ladder count 12: `{brazilian-calabresa, pizza-portuguesa}`; enumerator over 26 recipes: 14 legal orders,
  0 softlocks, every order ends with 26 discovered / ladder count 25.
- **auto target** (current deterministic order: key step → fewest distinct ingredients → declaration): calabresa.
- **Dex 🎨**: 2 cards (one per discoverable recipe; each CTA bound to its own recipe; no id / name / ingredient in the DOM).
- **Lunch Rush**: once discovered (and its materials owned, and an `ORDERS` entry exists) calabresa **enters the candidate pool
  automatically** and was picked within 300 draws; undiscovered, it is not in the pool. No recipe-specific gate exists.
- **Dinner**: unchanged. Missions list explicit `targetRecipeIds`; neither `dm-a` nor `dm-b` contains calabresa.

## 5. Owner Decisions (not decided in PR-4a)

- **OD-D3-24-AUTO-TARGET**: calabresa becomes the auto target only because of the "fewest ingredients" tie-break; not adopted
  as a rule. Options: keep / declaration order / most ingredients / id / authored priority. A Dex pin or sticky target overrides
  every option.
- **OD-D3-24-DEX-CARDS**: the 🎨 count equals the pool size (reveals how many recipes are makeable now, not which). Keep N cards /
  one aggregate card / cap the tag.
- **Lunch Rush**: whether a non-credit / second discoverable recipe should enter Lunch Rush automatically (currently it does).

## 6. Remaining for PR-4b (not started)

OD-D3-24 authoring (the 26th recipe's real data: quantity / bake / placement / reference, CUT profile, `unlockCondition`,
hint5 P-C row, hintSteps list, score-parity rows, order line), flipping the production count pins (25→26, chapters
6/9/10 → 6/10/10, `ladderCredit` / key-free production gates), and the **TQ-1D re-audit**: `SAUCE_ONLY` 44→77 is NOT solved
here (Cooking Techniques authority untouched).

## 7. Scratch vs PR-4a

Scratch only (deleted with the worktree; never committed or pushed): the calabresa recipe / catalog target id / roles /
sauce profile / reference / order / CUT entry, every 25→26 pin, the placeholder authoring rows, `scratch_edits.py` and
`calabresa_scratch.patch` (kept outside the repo). In PR-4a: §1 only.
