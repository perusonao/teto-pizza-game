# Teto Pizza Game — Economy Tuning 2: 15 Recipe Progression Balance Result

## 0. Audited main SHA / duplicate PR gate

- **Audited main SHA (initial):** `617bb3344c20b1cbddfda6e298da4b19a30a3c55` ("Recipe Expansion
  Batch 1B-C: add Meat Lovers (#117)") — fetched fresh via `git fetch origin` at task start; this
  task's working branch (`claude/economy-tuning-2-progression-b021bh`) was already in sync with
  it (`git log origin/main..HEAD` / `HEAD..origin/main` both empty).
- **Duplicate PR gate #1 (before work):** listed every OPEN PR
  (`mcp__github__list_pull_requests`, state=open): #105 (draft, Dev Automation A1), #72 (docs: PR
  #68 status correction), #46 (Issue #33 Dough Shaping D0 audit), #34 (Issue #32 Phase 1
  reference-visual), #3 (docs: Phase 2 infra report). **None overlap Economy/Progression/
  Shop/Inventory tuning.** Also swept `git branch -a` for Economy/progression/shop/inventory-named
  branches (`teto-economy-tuning-1-*`, `ep3-shop-inventory-restock-*`, `ep4-starter-stock-grant-*`,
  `ingredient-economy-audit-*`, `teto-economy-progression-design-*`, etc.) — all exist as stale,
  PR-less branches from already-merged/abandoned work, none open against `main`. No Firebase
  Ranking Phase 2A PR was open yet at this point either. **No duplicate — proceeded.**
- **Base branch advanced mid-task:** immediately before PR creation, `git fetch origin main`
  showed `main` had moved to `bc126f80c3917b1546dfeb807f631fec6723035b` ("Firebase Ranking Phase
  2A: weekly leaderboard read + ranking UI (#118)") — exactly the concurrent Firebase Ranking
  work this task was told to avoid touching. Per §14's own instruction, synced immediately
  (`git merge origin/main`, a clean fast-forward, no conflicts since Phase 2A's diff
  (`src/firebase/`, `src/components/WeeklyRankingOverlay.tsx`, `src/shared/
  lunchRushPeriodIds.ts`, `functions/src/periodIds.ts`, `firestore.rules`) shares no file with
  this task's own additions) and **re-ran the full verification suite (§10/§12) against the
  synced state** — 93 test files / 1,789 tests (up from 90/1,765 pre-sync, the +3 files/+24 tests
  being Phase 2A's own `WeeklyRankingOverlay`/`getWeeklyLeaderboard`/`lunchRushPeriodIds` tests),
  `tsc -b`, `oxlint`, and `npm run build` all still clean; confirmed via
  `git diff --stat origin/main -- functions src/firebase src/shared/lunchRushPeriodIds.ts
  firestore.rules` (empty) that this task still touches none of it.
- **Duplicate PR gate #2 (immediately before this PR):** re-ran `list_pull_requests` against the
  synced state — same 5 open PRs as gate #1 (#105/#72/#46/#34/#3), still none Economy-scoped, and
  PR #118 (Firebase Ranking Phase 2A) is already MERGED, not open. No duplicate.
- **Final base SHA for this PR:** `bc126f80c3917b1546dfeb807f631fec6723035b`.

## 1. Fresh audit (current production, no assumptions from prior chat)

Read directly from the audited SHA:

| Item | Value | Source |
|---|---:|---|
| Recipe count | **15** | `src/data/recipes.ts` (`RECIPES`) |
| Ingredient count | **22** (3 unlimited Starter + 19 finite/Shop-priced) | `src/data/ingredients.ts` |
| Initial inventory | `{}` (no finite stock; only the 3 unlimited Starter ingredients are usable) | `createInitialGameState`'s `inventory = EMPTY_INVENTORY` default |
| Initial Pitz | **0** | `createInitialGameState`'s `pitzBalance = 0` default |
| Initial owned ingredients | `tomato-sauce`, `mozzarella`, `basil` (`STARTER_INGREDIENT_IDS`) | `src/data/ingredients.ts` |
| Starter Grant size | `STARTER_STOCK_PLAYS_CHAPTER_1 = 10` plays/recipe, `Math.max(current, grant)` floor | `src/state/starterStock.ts` |
| Quality reward formula | `earnedPitz = round(recipe.baseRewardPitz(100) × qualityMultiplier)`, bands `{90:1.2, 75:1.0, 60:0.8, 40:0.5, 0:0}` | `src/logic/pitzReward.ts` |
| Efficiency (CT2) bonus | 0–10% of `baseRewardPitz`, additive, quality-gated (0 below ★3-band) | `src/logic/efficiency.ts` |
| Completion Gate | Independent PASS/FAILED gate; FAILED ⇒ no Dex/Pitz/Starter-Grant credit, but ingredients already used **are still consumed** | `src/logic/completionGate.ts`, `src/state/inventory.ts` |
| Cooking Time / efficiency | Separate, additive, never mixed into the quality multiplier | `src/logic/efficiency.ts` |
| Save/persistence | `pitzBalance`/`inventory`/`ownedIngredientIds`/`starterGrantClaimedRecipeIds` all round-trip via `src/state/persistence.ts`; untouched by this task | `src/state/persistence.ts` |
| Master Catalog | `data/recipes/pizza_master_catalog.json` — all 15 shipped recipes' ids/ingredients trace to it (per each recipe's own inline provenance comment) | confirmed via `src/data/recipes.ts` comments |

**Unlock chain (real dependency order, not `RECIPES`' own declaration order — see §2's own
note):**

`margherita → funghi → marinara → bismarck → genovese → quattro-formaggi(★8) → fugazza(★12) →
salsiccia(★16) → pepperoni(★20) → napoletana(★24) → tonno-e-cipolla(★28) → pizza-bianca(★32) →
breakfast-pizza(★36) → capricciosa(★40) → meat-lovers(★44)`

(`★N` = additional `minTotalStars` gate beyond the previous recipe's own discovery.)

**FAILED economy behavior (existing, unchanged):** a FAILED pizza still runs
`consumePizzaInventory` (ingredients placed are genuinely used) but never reaches
`registerScoreToDex`/`applyPitzCredit`/`applyStarterGrants` — no stars, no Pitz, no new Starter
Grant. This is the one mechanism by which repeated failure can drain finite stock without
income, and is exactly what the simulation (§3) exercises for the STRUGGLING profile.

## 2. Current economy table (from production `src/data/ingredients.ts`, verified via
`financeIngredientTable()` in the new simulation module — not transcribed by hand)

| Ingredient | Price (Pitz) | Restock qty | Pitz/unit | Starter grant (plays×10) | First required recipe |
|---|---:|---:|---:|---:|---|
| mushroom | 150 | 9 | 16.7 | 30 (minCount3) | funghi |
| garlic | 90 | 9 | 10.0 | 30 (minCount3) | marinara |
| oregano | 55 | 6 | 9.17 | 20 (minCount2, marinara) | marinara |
| egg | 105 | 3 | 35.0 | 10 (minCount1) | bismarck |
| pesto | 90 | 3 | 30.0 | 10 (spread, flat) | genovese |
| cherry-tomato | 55 | 9 | 6.11 | 30 (minCount3) | genovese |
| olive-oil | 65 | 3 | 21.7 | 10 (spread, flat) | quattro-formaggi |
| gorgonzola | 90 | 6 | 15.0 | 20 (minCount2) | quattro-formaggi |
| parmigiano | 90 | 6 | 15.0 | 20 (minCount2) | quattro-formaggi |
| fontina | 90 | 6 | 15.0 | 20 (minCount2) | quattro-formaggi |
| onion | 170 | 12 | 14.2 | 40 (minCount4, fugazza) | fugazza |
| sausage | 140 | 9 | 15.6 | 30 (minCount3, salsiccia) | salsiccia |
| pepperoni (ingr.) | 130 | 12 | 10.8 | 40 (minCount4) | pepperoni |
| anchovy | 110 | 9 | 12.2 | 30 (minCount3) | napoletana |
| tuna | 120 | 9 | 13.3 | 30 (minCount3) | tonno-e-cipolla |
| rosemary | 55 | 9 | 6.11 | 30 (minCount3) | pizza-bianca |
| bacon | 140 | 9 | 15.6 | 30 (minCount3, breakfast-pizza) | breakfast-pizza |
| ham | 140 | 3 | 46.7 | 10 (minCount1) | capricciosa |
| black-olive | 90 | 6 | 15.0 | 20 (minCount2) | capricciosa |

All 19 are `starterGrantOnly: true` — none is ever directly purchasable before its governing
recipe unlocks; only *restock* is a live Shop transaction for any of them today (test A in §10).

**Structural pattern confirmed (no anomaly found):** for every ingredient,
`restockQuantity == governingRecipe.minCount × 3` — i.e. **one restock purchase always buys
exactly 3 more plays**, for every ingredient, with no exception. This is the design's own answer
to §9's "足りない → 1回買う → 数回遊べる" ideal, and it holds exactly, not approximately.

**Shared ingredients across ≥2 recipes** (relevant to §8): `oregano` (marinara×2, fugazza×1,
napoletana×1, capricciosa×1), `olive-oil` (quattro-formaggi×1, fugazza×1, pizza-bianca×1),
`onion` (fugazza×4, tonno-e-cipolla×2), `sausage` (salsiccia×3, meat-lovers×2), `pepperoni`
(pepperoni×4, meat-lovers×1), `bacon` (breakfast-pizza×3, meat-lovers×2), `ham` (capricciosa×1,
meat-lovers×1), `egg` (bismarck×1, breakfast-pizza×1). Every governing recipe unlocks strictly
before every later recipe that reuses the same ingredient (confirmed against the real chain
order in §1), so the `Math.max(current, grant)` floor (§8) is never asked to reconcile
out-of-order grants.

**Meat Lovers introduces zero new finite ingredients** — `bacon`/`ham`/`pepperoni`/`sausage` are
all already-existing stock from earlier recipes (breakfast-pizza/capricciosa/pepperoni/salsiccia
respectively); see §3's simulation for whether it actually functions as a stock sink in practice.

## 3. Progression economy simulation

### Methodology

Built a **deterministic, code-driven** simulation
(`src/logic/economySimulation.ts` + regression tests in
`src/logic/economySimulation.test.ts`) that exercises the *actual* production formulas —
`applyStarterGrants`, `applyPitzCredit`, `restockIngredient`, `consumePizzaInventory`,
`recipeUnlocked`/`isRecipeAvailable`, `totalStars`, `registerScoreToDex` — rather than
re-deriving them by hand. It is analysis/test-only: no production code imports it.

Each player archetype is a **fixed, repeating cycle** of round outcomes (a star 1–5, or FAILED),
not a random draw — the same profile always produces the exact same trace (pinned by test E,
"no grant farming" / determinism). The simulation plays a recipe-discovery policy that mirrors a
real player: **new content first** (bake any just-unlocked, undiscovered recipe up to 3 times to
settle its Dex BEST), then **round-robin grinding** across already-discovered recipes once
nothing new is available, to build `totalStars` toward the next chain gate — stopping only once
3 full grind sweeps in a row produce zero `totalStars` improvement (a genuine ceiling, which
would be reported as BLOCKED/soft-locked; none of the three profiles hit this).

Representative 0–100 totals per star tier (chosen inside each tier's own
`STAR_THRESHOLDS`/`QUALITY_MULTIPLIER_BANDS` band, both 90/75/60/40/0): ★5→95, ★4→80, ★3→65,
★2→45, ★1→20.

Player profiles (task §3's own player definitions):

| Profile | Outcome cycle | FAILED rate | Per-recipe star ceiling |
|---|---|---:|---:|
| GOOD | mostly ★4–5, one FAILED in 14 | 7% | 5 |
| NORMAL | ★2–4 mixed, 2 FAILED in 16 | 12.5% | 4 |
| STRUGGLING | ★1–3 centered, 2 rare ★4 excursions, 4 FAILED in 20 | 20% | 4 (rare), 3 (typical) |

(STRUGGLING's cycle deliberately allows two rare ★4 results rather than a hard ★3 ceiling — a
literal "never above ★3, ever across 15 recipes" profile would leave only 1 star of slack under
meat-lovers' own 44-star gate out of a 45-star max, which is an unrealistically harsh reading of
the task's own "★1〜★3**中心**" (centered around, not capped) wording. This is a fixed
calibration choice made once, up front — not a retroactive adjustment to hide a finding; see the
"P0 candidate ruled out" note in §5.)

### Results

| Metric | GOOD | NORMAL | STRUGGLING |
|---|---:|---:|---:|
| Completed all 15 recipes? | ✅ | ✅ | ✅ |
| Total bake attempts | 16 | 19 | 80 |
| FAILED bakes | 1 (6%) | 2 (11%) | 16 (20%) |
| Cumulative Pitz earned | 1,620 | 1,360 | 3,080 |
| Cumulative Pitz spent on restock | **0** | **0** | 55 |
| Final Pitz balance | 1,620 | 1,360 | 3,025 |
| Final totalStars | 66 | 47 | 48 |
| Shortage events (couldn't afford a needed restock) | 0 | 0 | 0 |
| Shop restock purchases | 0 | 0 | 1 (oregano, 55 Pitz → +6 units) |
| First shortage | none | none | none |

**Pitz balance at each unlock** (all three profiles, full table in the simulation's own
`unlockEvents` — reproduced for meat-lovers, the tightest gate):

| Profile | Pitz balance when meat-lovers unlocked | totalStars at that point |
|---|---:|---:|
| GOOD | 1,520 | 62 |
| NORMAL | 1,310 | 45 |
| STRUGGLING | 2,925 | 44 (exactly the gate) |

**Repeated shortage ingredients:** none for any profile — `repeatedShortageIngredients` is empty
across all three runs.

**STRUGGLING's one Shop visit in detail:** at attempt 59, while round-robin-grinding `fugazza`
(one of `oregano`'s four governing/consuming recipes) to build stars toward `salsiccia`'s ★16
gate, `oregano` ran out; one restock (55 Pitz → +6 units, i.e. +6 more `fugazza` plays) resolved
it immediately with no retry needed. This is the single real-world exercise of the "1回買う→数回
遊べる" Shop loop across all three simulated playthroughs.

## 4/5. Economy goals vs. detected problems (P0/P1/P2/OK)

| Goal | Status | Evidence |
|---|---|---|
| A. Not infinitely playable on Starter Grant alone | **OK** | Every recipe's grant is exactly 10 plays; all three profiles exhaust several recipes' free grants during normal/grind play (STRUGGLING needed a real restock). |
| B. No immediate Shop grind right after unlock | **OK** | 10 free plays per newly-unlocked recipe; no profile needed a restock within the first few plays of any recipe. |
| C. ~10 Starter Grant plays preserved | **OK** | `STARTER_STOCK_PLAYS_CHAPTER_1 = 10`, confirmed unchanged (test D). |
| D. Shop has a real purpose | **OK, situational** | Unused by GOOD/NORMAL under efficient "3 attempts then move on" play (by design — 10 free plays comfortably covers that), but the STRUGGLING run's extra grinding attempts do exercise it correctly, and the restock math (`restockQuantity = minCount×3` exactly, §2) gives it a clean "buy once, play 3 more times" role whenever a player replays beyond the free 10. See §9. |
| E. NORMAL never soft-locks under normal play | **OK** | Completes all 15 recipes in 19 attempts, 0 shortages, 1,360 Pitz surplus at the end. |
| F. GOOD doesn't drown in useless surplus Pitz | **OK** | 1,620 Pitz final balance after 16 total bakes (≈101 Pitz/bake) — not near-zero, but not absurd either; no Shop purchase ever needed to spend it on (every ingredient is `starterGrantOnly`, so there's genuinely nothing left to buy once every recipe is unlocked and stocked). This is a **P2 observation**, not a defect — see §5. |
| G. STRUGGLING survives 1–2 failures without soft-lock | **Exceeded** | Survives 16 FAILED bakes (20% failure rate sustained across 80 attempts) with zero shortages and a 3,025 Pitz surplus at the end. |
| H. FAILED still consumes finite ingredients | **OK, verified** | `consumePizzaInventory` runs identically regardless of Completion Gate outcome (unchanged code, test H). |

**P0/P1/P2 classification:**

- **P0 (blocks progression under normal play): none found.** All three profiles complete the
  full 15-recipe chain with zero Pitz shortages and zero forced dead-ends.
- **P0 candidate considered and ruled out:** a *literal* reading of "STRUGGLING = ★1〜★3, never
  higher" makes the last gate (44) almost unreachable (15 recipes × 3-star cap = 45 max, i.e. 1
  star of total slack for the entire run) — an early run of that exact profile did hit the
  simulation's own stall-detector (3 sweeps, zero improvement) before reaching `meat-lovers`.
  Investigated whether this is a real production issue: it is not — it is an artifact of reading
  "★1〜★3中心" (*centered around* 1–3) as a hard ceiling rather than a typical range for a human
  player's actual execution variance. Recalibrating the profile to allow two rare ★4 results
  (still overwhelmingly ★1–3, still 20% FAILED) resolves it cleanly with a comfortable 4-star
  margin (48 vs. 44) at completion. **No code/data change follows from this** — it is a
  simulation-calibration correction, not an economy tuning knob (§6 lists what may be tuned;
  player-skill modeling isn't one of them).
- **P1 (Shop nearly unused / grind-heavy): none found.** Neither extreme from §9 ("every play
  needs the Shop" or "dozens of plays never need it") occurred — GOOD/NORMAL's zero Shop use is
  explained entirely by the discovery-focused play pattern (3 attempts per new recipe, well under
  the 10 free plays) rather than the Shop being structurally pointless; STRUGGLING's heavier
  grind (80 bakes) did reach into the Shop exactly once, cleanly.
- **P2 (minor/cosmetic):** `ham`'s Pitz/unit (46.7) is the highest of all 19 finite ingredients —
  a `capricciosa`/`meat-lovers` play using `ham` costs proportionally more per restock-unit than
  any other ingredient. Investigated whether this bites in practice: it does not — by the time
  `capricciosa` unlocks, every simulated profile already holds 900–2,385 Pitz surplus, an order
  of magnitude more than one `ham` restock (140 Pitz). Noted for awareness only; **no change
  recommended** (see §6's "don't change without a measured problem" instruction).
- **Conclusion for §5: no problem was measured that requires an economy value change.**
  "変更なし" is the valid conclusion the task itself allows for.

## 6. Tuning knobs used

**None.** No `pricePitz`, `restockQuantity`, Starter Grant amount, quality reward, or efficiency
bonus value was changed. `git diff main -- src/data/ingredients.ts src/state/starterStock.ts
src/logic/pitzReward.ts src/logic/efficiency.ts src/logic/economy.ts` is empty. The only files
added are the new analysis/test module and this report.

## 7. Do-NOT-change confirmation

Confirmed untouched (all zero-diff against the audited SHA): Completion Gate thresholds
(`src/logic/completionGate.ts`), Scoring 2.0 weights/star thresholds (`src/logic/scoring.ts`,
`src/logic/scoringV2/`), recipe definitions/ingredient counts (`src/data/recipes.ts`), the
reference pizza layout (`src/data/referencePizza.ts`, `src/data/playerReference.ts`), cooking
interaction code, Lunch Rush scoring (`src/logic/missionScoring.ts`, `src/mission/`), Firebase
ranking/Functions (`src/firebase/`, `functions/`), save schema (`src/state/persistence.ts`), and
the recipe unlock chain (`Recipe.unlockCondition` in `src/data/recipes.ts`).

## 8. Shared-material behavior

`Math.max(current, grantAmount)` floor semantics (`applyStarterGrants`, §2) confirmed unchanged
and exercised for real by the shared ingredients listed in §2 across all three simulated
playthroughs — no grant ever summed on top of an existing higher stock (test D/E). No grant
farming is possible: `claimedRecipeIds` is an exactly-once ledger, and re-running
`applyStarterGrants` against an already-claimed recipe is a proven no-op (determinism test E: two
full simulation runs of the same profile produce byte-identical results).

`oregano`/`olive-oil`/`egg`/`onion`/`sausage`/`pepperoni`/`bacon`/`ham` reuse across recipes up to
and including `meat-lovers` was directly exercised (§3's simulation bakes every recipe in the
real chain, including all of `capricciosa`/`meat-lovers`'s shared ingredients) with zero shortage
events in any profile.

**Meat Lovers as an existing-stock sink:** confirmed via test K — `meat-lovers` requires zero
finite ingredients not already introduced by an earlier recipe, and the GOOD player's simulated
run reaches it with zero shortages on any of its 4 shared ingredients (`bacon`/`ham`/`pepperoni`/
`sausage`), all already restocked or grant-topped-up from earlier recipes in the chain. It
functions exactly as designed: a recipe that asks nothing new of the player's wallet.

## 9. Shop experience

- **How many times is the Shop opened?** 0 times for GOOD/NORMAL across a full 15-recipe
  playthrough; 1 time for STRUGGLING (across 80 total bakes).
- **What gets bought?** In the one real purchase observed: `oregano`, 55 Pitz → +6 units (a
  shared ingredient across 4 recipes).
- **How many plays does one purchase buy?** Exactly 3, for every ingredient, by construction
  (`restockQuantity = governingRecipe.minCount × 3`, confirmed with no exception in §2) — this is
  precisely the task's own stated ideal: "足りない → 1回買う → 数回遊べる."
- Neither failure mode from §9 occurred: it is not "every play needs the Shop" (0–1 visits across
  16–80 plays), nor "dozens of plays never need it while progression demands it" (STRUGGLING's
  heavier, failure-prone play *did* reach into the Shop exactly when its stock ran out, and
  resolved cleanly in one purchase).

## 10. Tests

New file: `src/logic/economySimulation.ts` (simulation + `financeIngredientTable()`) and
`src/logic/economySimulation.test.ts` (19 tests, all passing), covering the task's own list:

- **A.** Economy table consistency: 22 ingredients / 15 recipes / 19 finite rows, all
  `starterGrantOnly`.
- **B.** Every finite ingredient has a positive integer `pricePitz`.
- **C.** Every finite ingredient has a positive integer `restockQuantity`.
- **D.** Starter Grant floor semantics (10 plays/recipe; determinism proof).
- **E.** No grant farming (two full runs of the same profile are byte-identical).
- **F/G.** Representative progression simulation; GOOD/NORMAL/STRUGGLING all complete the full
  chain with no soft-lock; unlock order matches the real dependency chain for every profile.
- **H.** FAILED consumption regression (STRUGGLING's FAILED bakes still consume stock).
- **I.** Shop purchase regression (every recorded restock matches the real ingredient
  price/batch; cumulative spend reconciles).
- **J.** Inventory regression (final inventory never negative, any profile).
- **K.** Meat Lovers shared-material behavior (zero new finite ingredients; zero shortage
  reaching it).
- **L.** Firebase/shared scoring regression: unchanged, covered by the existing (untouched)
  Firebase test suite (`src/firebase/*.test.ts`, `functions/src/*.test.ts`) — not re-authored
  here since no Firebase-adjacent code was touched.

No existing test needed a regression update, since no production value changed.

**Full verification run (audited SHA + this task's addition):**

| Check | Result |
|---|---|
| `npx tsc -b` | clean, 0 errors |
| `npx oxlint` (whole project) | clean, 0 warnings |
| `npx vitest run` (pass 1, post-sync with main #118) | **93 test files / 1,789 tests — all passed** |
| `npx vitest run` (pass 2, post-sync with main #118) | **93 test files / 1,789 tests — all passed** |
| `npm run build` | succeeds (`tsc -b && vite build`), 469.95 kB JS / 42.74 kB CSS bundle, no errors |
| Firebase Functions shared code | `functions/` directory untouched (confirmed via diff against the audited SHA) |

## 11. Browser verification

390×844 viewport, headless Chromium (Playwright against the pre-installed browser), dev server
(`npm run dev`):

| Screen | Overflow | Console errors |
|---|---|---|
| HOME | 0 (scrollWidth=clientWidth=390) | 0 |
| FREE → Recipe Select | 0 | 0 |
| Shop | 0 | 0 |
| Inventory | 0 | 0 |

No economy values changed, so no Shop-price/purchase/Pitz-decrease/inventory-increase UI
behavior needed re-verification beyond confirming the four screens still render without error at
this viewport. 360×800 was not additionally checked, since no layout-affecting change was made
(390×844 is the harder, narrower constraint of the two per the task's own "if possible" wording).

## 12. Full verification

Covered in §10 above (tsc/oxlint/vitest×2/build) — all pass cleanly. No Firebase Functions
shared-code diff.

## 13. Remaining economy risks

- **Sustained single-recipe grinding beyond the simulation's own "3 attempts then move on"
  policy** was not separately load-tested (e.g., a player who replays one favorite recipe 30+
  times before ever unlocking the next one). The restock math (§2, §9) makes this
  self-evidently safe by construction — `restockQuantity` always buys exactly 3 more plays at a
  fixed Pitz cost per ingredient, and every profile in §3 already accumulates a comfortable Pitz
  surplus well before needing to buy anything — but it was not run as its own simulation case.
- **`ham`'s Pitz/unit (46.7, the highest of all 19 finite ingredients)** does not cause any
  measured shortage in this task's simulations, but is worth a second look if a future task adds
  more `ham`-using recipes without also widening its `restockQuantity`.
- **Lunch Rush's separate reward path** (`calculateMissionReward`, per-run rather than per-pizza)
  was out of scope here (§7) and was not simulated — this task's progression model is the FREE/
  single-recipe loop, which is where `totalStars`/Starter Grant/Shop restock actually live.

## 14. Recommendation for Progression Tuning

The unlock-chain `minTotalStars` gates (16→20→24→...→44, a flat +4 step past `fugazza`) are
already comfortably clearable by all three simulated skill profiles with healthy Pitz margin —
no evidence from this task suggests the *gates themselves* need retuning. If a future
Progression Tuning task wants to adjust pacing (e.g., spacing recipes further apart, or changing
the +4-per-step formula), it should reuse this task's simulation
(`src/logic/economySimulation.ts`) rather than re-deriving player behavior by hand — swapping in
new `RECIPES`/`unlockCondition` data will immediately surface whether a new gate spacing
introduces a real shortage or soft-lock for any of the three profiles.

## Final Verdict

**B. NO ECONOMY CHANGE REQUIRED.**

The fresh audit and three-profile deterministic simulation found no P0 (progression-blocking)
or P1 (Shop-experience-breaking) issue in the current, already-tuned (post Economy Tuning 1)
15-recipe / 22-ingredient economy. Per the task's own §5 instruction ("問題が見つからなければ、
無理にeconomy変更しない。「変更なし」も有効な結論"), no `pricePitz`/`restockQuantity`/Starter
Grant/reward-formula value was changed. This task's durable contribution is the fresh,
code-verified economy table (§2) and the deterministic simulation harness (§3, §10) itself,
committed as a docs/test-only addition for future Progression Tuning work to build on.
