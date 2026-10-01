# Discovery 3.0 PR-4a: Population-Parametric Tests — Result Report (PARTIAL, STOPPED)

Branch `claude/discovery3-pr4a-population-parametric`, from `origin/main` `a0201e35473ea0f7d27bf9d1c054587b4cfe23e2`
(re-fetched fresh; `#322` / `#323` / `#324` merge commits are all on `main`). No PR opened.

## 0. Status — read this first

**PR-4a is NOT complete.** Two required inputs could not be satisfied:

1. **The Pre-PR4 Gate / dry-run-B documents are not accessible to this session.** They are not in the repo
   (`docs/`, `docs/reports/`), not an issue, not a PR (searched `perusonao/teto-pizza-game`). The figures
   "14 files / 75 semantic failures / 140 unit / 29 E2E" exist only in the task message, with no failure list.
2. **The scratch dry-run (task §13, and the way to rebuild the §3 target list) was blocked.** My attempt to
   add `brazilian-calabresa` as a 26th recipe to `src/data/recipes.ts` (scratch, never to be committed) was
   denied by the permission classifier ("Modify Shared Resources"). I did not work around it (no mock-based or
   copied-tree equivalent). Nothing was changed in `recipes.ts`.

Consequently the **before → after failure counts (75 / 140 / 29) cannot be reported**, and §3 was done only for
what could be identified statically. PR-4b readiness is therefore **not established**.

## 1. What was done (all tests / test-support; production behaviour diff = 0)

| § | Item | Result |
|---|---|---|
| 2 | Synthetic branching population | `src/logic/testSupport/syntheticPopulation.ts` (A = `pizza-portuguesa`, B = `synthetic-branch-b`, `ladderCredit:false`, same key step 12), `discoveryWalk.ts` (enumerates **every** legal discovery order), `syntheticModuleMocks.ts` (`vi.mock` factories that extend the population inside one test file's module graph — no production file edited). |
| 2 | pool 0 / 1 / 2+, A→B, B→A | `syntheticBranching.test.ts` (pure, 11 tests) and `gameReducer.syntheticBranching.test.ts` (**real reducer**, REGISTER_TO_DEX, 3 tests). Checked: discoverable pool, remaining UNKNOWN, ladder count, Shop entitlement, termination, no softlock. |
| 9 | Simulation, multiple legal orders | The Final Gate walk is now a shared, population-parametric suite (`src/state/testSupport/finalGateWalk.ts`). `discoveryHint.walk.test.ts` runs it over the 25 production recipes; `discoveryHint.walk.synthetic.test.ts` runs the same walk over 26 recipes (pool = 2 at the A/B step) and completes. The enumerator finds >1 legal order, 0 softlocks, every order ends with 26 discovered / ladder count 25. |
| 6 | Hint5 invariant | G15 ("before STRUCTURE every target is identical") is kept as-is for the 25 production recipes (they are one rung-signature group), and replaced for mixed populations by G15′/G15″ in `hint5Production.gate.test.ts`: targets are grouped by their **pre-STRUCTURE rung signature** (which of SAUCE / CHEESE / KEY exist — a function of recipe structure only); within a group offers and boards are identical, no SUB_CLASS appears before STRUCTURE, and two key-free recipes with different toppings are byte-identical. Compatible with OD-D3-21 (absent rungs are never placeholders). The golden `hint5.production25.json` is untouched and still passes. |
| 7 | `RECIPE_HINT_ROLES` type | Now `Record<RecipeId, HintRoles>` (key-free allowed). 25 entries are all keyed; a new gate asserts zero key-free production recipes. `keyedHintRoles(id)` gives tests the keyed fields. |
| 8 | Fixture id collision | `brazilian-calabresa` → `future-synthetic-recipe`, `calabresa` → `future-synthetic-ingredient` in 8 unit files and 2 E2E specs. Both E2E specs pass (Chromium, iphone-390x844). `tools/progression2_mechanic_matrix.py` / design JSON mention the real recipe and were not touched. |
| 4 | Auto target | `hintTarget.autoPolicy.test.ts` pins the **current** order (key step → fewest distinct ingredients → declaration index), shows four alternative policies disagree on the same pool. No production code changed. |
| 5 | Dex 🎨 | `DexOverlay` got an optional `recipes` prop (default `RECIPES`, no visible effect) as a test seam. `DexOverlay.syntheticPool.test.tsx` characterises pool = 2. |

## 2. Verification (this branch)

- Unit: **5498 passed**, 1 skipped (baseline on `a0201e3`: 5471 passed, 1 skipped; +27 new tests, 0 regressions).
- `tsc -b` clean · `vite build` OK · `oxlint` 2 warnings (identical to baseline).
- E2E (Chromium, iphone-390x844): the two edited specs pass. **Not run**: the full Chromium/WebKit E2E suites
  (left to CI).
- existing-25 parity: the walk's 25 per-stage rows (target, Shop, hint spend, steps, named, first result, trials)
  are byte-identical before/after the refactor (diffed); hint5 golden unchanged.
- Player-visible production behaviour diff: none. Production source changes: `recipeHintRoles.ts` (type + accessor),
  `DexOverlay.tsx` (optional prop). Human Verification not required.

## 3. Owner Decisions (NOT decided in PR-4a)

### OD-D3-24-AUTO-TARGET — which recipe the hint sheet talks about when the pool is 2+
Current deterministic behaviour (`compareHintCandidates`): key step asc → **fewest distinct ingredients** → `RECIPES`
declaration index. With the real calabresa this makes calabresa (fewer ingredients) the auto target over
portuguesa. This is an accident of sort keys, not an authored rule; PR-4a does **not** adopt it.
Options: (a) keep; (b) declaration order; (c) most ingredients first; (d) id order; (e) a per-recipe authored
priority. Player-visible consequences: which recipe the Free Cooking hint sheet (and sticky target) steers toward
first; a Dex 🎨 pin and a sticky target override it in every option. Tests pin (a) as "current", not "intended".

### OD-D3-24-DEX-CARDS — Dex 🎨 card count with a pool of 2
Findings: (1) one card per undiscovered recipe, CTA bound to that recipe in a closure — the architecture (and the
existing "several DISCOVERABLE cards (legacy save)" test) already allows N cards; (2) the **count** equals the
pool size, i.e. it reveals how many recipes are makeable now (not which: no id / name / ingredient in the DOM —
pinned as a privacy invariant); (3) slot numbers/chapters are already visible per card; (4) merging into one card is
possible only by dropping the per-card pin (each card = one recipe slot; the pin comes from the card).
Decide: keep N cards / one aggregate card / cap the tag. PR-4a changes no UI.

### Lunch Rush
Not investigated in this session (no Lunch Rush code touched). The question of how a non-credit / second
discoverable recipe interacts with Lunch Rush order pools remains an open Owner Decision.

## 4. Not done / remaining

- §3 full migration of the 14 premise-sensitive files: **not enumerable without the dry-run**. Statically
  identified and migrated: the walk, the G15 invariant, fixture ids. Still premise-bound (candidates, unverified):
  `DexOverlay.hint.test.tsx` ("Dex %i … exactly the DISCOVERABLE card"), `discoveryHint.test.ts`
  (`ladder(count)` / "only target" loops), `resultNearMiss*.test.ts`, `hintTarget.test.ts` ("the only target is the
  next ladder key recipe"), `nearMiss*.test.ts`. Many other `25` pins are mechanical production-count pins (PR-4b).
- §13 dry-run and the 75 / 140 / 29 before→after: **blocked** (see §0).
- Full E2E on Chromium + WebKit: CI.
- TQ-1D re-audit note (§10): `SAUCE_ONLY` 44→77 is NOT addressed. Before TQ-1D ships, re-audit SAUCE_ONLY with the
  26th recipe present. Cooking Techniques authority untouched.
- OD-D3-24 authoring (the 26th recipe's per-recipe data: target id, sauce profile, reference, `DESIGN_P_C` /
  `ROUND6_P_C` rows, hint roles, etc.) — remains for PR-4b.

## 5. To unblock

Either (a) grant the scratch edit so the dry-run can be repeated and the failure list drives the rest of §3, or
(b) provide the Pre-PR4 Gate / dry-run-B failure list (file → test) so §3 can be finished without it.
