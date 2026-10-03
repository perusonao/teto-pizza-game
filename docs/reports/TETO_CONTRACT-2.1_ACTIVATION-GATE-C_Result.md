# Contract 2.1 — Production Activation Gate C (attempt-aware simulation + Economy / Progression)

Audited `main` SHA: `db6ed5a64cd4016870d5806653a009774aa4811d` (= `origin/main`, working tree clean at start).
Scope: evaluation only. **Production flag `RESEARCH_IDENTIFY_ENABLED` stays OFF. No production code changed. No deploy.**
Added (test-only): `src/logic/testSupport/researchAttemptSim.ts`, `src/logic/researchAttempt.sim.test.ts`.
No UI / UX / gameplay change, so the Human Verification video / screenshot rule does not apply to this session.

## Result

**PRODUCTION ACTIVATION GATE C — READY = YES** (after the Owner Decision in §12; this is **not** permission to turn the flag ON).

History: the first evaluation of this report returned READY = NO, solely because of the "★3-FULL replay ≤ 1" item. The Owner Decision (§12) removes that item from the Gate C pass / fail conditions; the fresh re-evaluation (§12.2) found no independent blocker. §1–§11 below are the original evidence and are kept unchanged, including the original §11 "READY = NO" wording, which is superseded by §12.

## 1. Fresh audit (Phase 0)

| Item | Finding |
|---|---|
| main | `db6ed5a`; PR #363 / #364 MERGED. Main CI at `db6ed5a`: Deploy = success, E2E WebKit = success (`60dc604` also success). |
| Population | 27 recipes (25 W1 ladder + non-credit `brazilian-calabresa` + No.27 `pesto-pollo`), 30 ingredients; every recipe has exactly 1 sauce; 0 RESERVED sauce rung. |
| Progression authority | `DISCOVERY_LADDER` = frozen W1 24 steps + step 25 (`chicken`). Research Entry = every finite ingredient owned (ownership, not stock). |
| Inventory / economy | Shop first pack / refill (`PURCHASE_INGREDIENT`, `RESTOCK_INGREDIENT`), finite materials, starters unlimited; Pitz reward with first-discovery bonus. |
| Hint authority | Hint 5.0 ladder is ON in Production (`HINT5_LADDER_PRODUCTION_DEFAULT = true`): SAUCE 10 / CHEESE 10 / KEY 10 / STRUCTURE 5 / SUB_CLASS 5. |
| Contract 2.1 | `researchResultRows` (pure) wired in `REGISTER_TO_DEX` (`researchAttemptResult`), `researchTargetValidAtStart` snapshot, `RESEARCH_ROWS` Notebook line. `persistence.ts` untouched by #363. |
| Existing tools reused | `hint5EconomySim.ts` / `discoveryHintEconomySim.ts` (walk shape, grind rule, shop rules); no equivalent attempt-aware tool existed. |
| Duplicates | No open Issue / PR for Gate C or attempt-aware simulation (searched; 19 open PRs, none related). |

## 2. Reused production authorities (nothing re-implemented)

Real reducer: `START_FREE_COOK{researchTargetId}`, `START_BAKE`, `CONFIRM_BAKE`, `REGISTER_TO_DEX` (matcher, Dex, Ladder, Pitz, inventory consumption, `researchResultRows`, `ing:` persistence, Notebook), `PURCHASE_INGREDIENT`, `RESTOCK_INGREDIENT`, `PURCHASE_HINT5_RUNG`; `researchableEntryIds`, `researchEntryViews`, `hint5SheetView`, `notebookView`. The recipe is read only by the per-attempt invariant checks (as an oracle), never by the player model.

## 3. Method and strategy (deterministic, explicit)

A fresh save is walked to Dex 27 through the reducer. Per stage: buy newly unlocked materials; refill empty finite materials; target = first researchable Research Entry in the game's own anonymous order, kept until the stage ends; attempts until the Dex grows.

Player model (`chooseAttempt`): the pizza always contains every known-positive ingredient (unlock fact + stored `ing:` + ○) plus
- sauce: the known sauce, else the next owned sauce that is not a remembered ×;
- cheese: all owned cheeses that are not known / ×, in one attempt (no cap);
- topping: the first `min(3, unknown)` owned toppings not known / × (K = 3; never over-cap);
- never a remembered ×; known ✓ never counted toward K;
- final build = the known-positive set once nothing is unknown (or STRUCTURE's total equals the known count).

"Tray order" = acquisition order of `ownedIngredientIds`; sensitivity: 100 seeded per-stage permutations. Quantity: every topping at the Shop's pack unit (quantity is never the bottleneck: optimistic for attempts). Exploration stock drain has two bounds: **FULL** = unknown toppings at the pack unit (conservative), **ONE** = 1 piece (enough for a ○× row; optimistic). Shop: new materials bought at unlock; a refill is bought before an attempt that needs stock or when the target is not researchable for lack of stock (player-visible REFILL state); an unaffordable Shop purchase is paid by Margherita replays (`grindBakes`); an unaffordable hint rung is skipped, never ground for. Quality: every scored bake registers ★4 (80) / ★3 (65) / ★1 (30), as the Hint 5.0 Activation Gate harness. Dex 0 = Margherita onboarding (1 guided attempt, not a research attempt).

Hint profiles (the Hint 5.0 harness's own, plus prefixes): NONE, RUNG1–3 (first n rungs before the first attempt), FIXED4 (rungs 1–4), FULL (all rungs). Hint knowledge used: `ing:` names, `h5:cheese` (cheese settled), `meta:ingredient-total` (STRUCTURE). **SUB_CLASS (`cls:`) is not exploited**: its family is deliberately not recoverable from the save ids (H5-INV-1), so FULL is a lower bound of Hint benefit.

Not a calibration: results were not tuned toward the historical values (A 321 / B 64 / C1 97 / 3.3x), which are reference only.

## 4. Attempts (★3, tray order, FULL stock drain; attempts do not depend on quality or stock assumption)

Research recipes = 26 (Margherita is the onboarding). All 27 discovered in every run; no cross-recipe discovery occurred; 0 stuck stages.

| Profile | total (27) | attempts/recipe mean (26) | median | p90 | max |
|---|---|---|---|---|---|
| **NONE (Hint なし)** | **137** (136 research + 1 onboarding) | **5.23** | 5 | 8 | 9 |
| FIXED4 | 98 (97) | 3.73 | 4 | 6 | 9 |
| FULL | 95 (94) | 3.62 | 4 | 6 | 8 |
| (analysis-only) free STRUCTURE total, no paid hint | 107 | 4.08 | – | – | 8 |

Distribution NONE (attempts: recipes): 2:3, 3:5, 4:2, 5:4, 6:4, 7:3, 8:3, 9:2.
Tray-order sweep (100 seeds, ★3): NONE 133–140 (mean 138.6, order barely matters: without a total, the whole unknown pool must be resolved anyway), FIXED4 67–114 (mean 87.8), FULL 65–108 (mean 88.0).
Outliers (≥ p90): pesto-patate 8, pizza-bianca 8, puttanesca-pizza 8, quattro-formaggi 9, pesto-pollo 9 (all late ladder steps).

## 5. Progression-step analysis (NONE)

| Ladder steps (Dex count at start) | recipes | mean attempts | max unknown-topping pool |
|---|---|---|---|
| 1–6 | 6 | 2.50 | 5 |
| 7–12 | 6 | 4.00 | 12 |
| 13–18 | 6 | 5.67 | 16 |
| 19–26 | 8 | 7.88 | 22 |

Attempts correlate with the unknown-topping pool at r = 0.989: the owned pool only grows (starters 3 + one ladder step per discovery), a new recipe's unknown share is almost the whole pool, so attempts ≈ pool/3 + 1–2. Late recipes cost 8–9 attempts. This is a scaling property that matters for the 53 / 172 Scale Audit (not started).

## 6. Economy / Progression (Phase 2)

| Check | Result |
|---|---|
| progression deadlock | **0** in every run (6 hint profiles × ★4/★3/★1 × FULL/ONE stock = 36 matrix walks + 2 free-total walks + 600 sweep walks, all reach Dex 27) |
| Dex reachability | 27/27 every run |
| min Pitz ≥ 0 | **PASS** every run (reducer-enforced; also min Pitz after onboarding ≥ 0) |
| RESERVED | **0** |
| unavoidable inventory deadlock | none: every stock-out (6–18 per walk) was cleared by a refill; the target never became unresearchable without a refillable empty material |
| impossible Pitz recovery | none: Margherita replays (starters only) always recover |
| ★3-FULL replay ≤ 1 (Hint 5.0 Activation Gate) | **NOT MET**: FULL stock 8, ONE stock 3 (1 in the direct-bake baseline). Sweep (100 seeds): FULL 2–12 (mean 7.8, 0% ≤ 1), ONE 0–5 (mean 2.0, 36% ≤ 1) |

Why: exploring consumes finite stock with no Pitz return (only the discovering bake pays). Pitz flow ★3, NONE: rewards 4,070 vs Shop unlocks 2,300 + **refills 1,600** (FULL stock; 790 with ONE) — the direct-bake baseline had 0 refill spend.

| Run (tray order) | attempts | refill Pitz | stock-out refills | Margherita replays |
|---|---|---|---|---|
| ★4 NONE / FULL (FULL stock) | 137 / 90 | 1600 / 840 | 16 / 13 | 0 / 1 |
| ★3 NONE / FULL (FULL stock) | 137 / 95 | 1600 / 890 | 16 / 14 | **7 / 8** |
| ★3 NONE / FULL (ONE stock) | 137 / 98 | 790 / 510 | 11 / 8 | 0 / **3** |
| ★1 NONE / FULL (FULL stock) | 137 / 137 | 1600 / 1690 | 16 / 16 | **104 / 117** |
| ★1 NONE / FULL (ONE stock) | 137 / 137 | 790 / 880 | 11 / 11 | **64 / 80** |
| baseline (no exploration) ★3 / ★1 NONE | – | 0 | – | 0 / 24 (FIXED4 / FULL ★1: 39) |

★1: a struggling player's replays go 24–39 → 64–117 (about 2.5–4.5 per recipe): recoverable, but heavy friction. Not a deadlock.

## 7. Hint interaction (measured; the player model is explicit)

| Profile (★4) | attempts saved vs NONE | hint Pitz |
|---|---|---|
| RUNG1 (SAUCE) | 0 | 240 |
| RUNG2 (+CHEESE) | 0 | 495 |
| RUNG3 (+KEY) | 2 | 575 |
| FIXED4 (+STRUCTURE) | 47 | 700 |
| FULL | 47 | 825 |

Under Contract 2.1 the free ○× row already provides SAUCE / CHEESE / KEY information, so those rungs save ≈ 0 attempts for 10 Pitz each (confirms Contract §10 accepted consequence, quantified). All of the Hint benefit is STRUCTURE (5 Pitz, −47 attempts, because a known total ends the search). Hint purchases compete with refills: ★3 FULL buys 3 insufficient-rung skips + 8 replays; ★1 skips 26 rungs. This is #360's scope, not a Gate blocker.

## 8. Contract invariants (checked on every attempt of all 638 walks, recipe used as test oracle)

0 violations: topping rows ≤ 3 and no rows when over-cap; every row is a placed ingredient; no known ingredient in a row; verdict = membership; persisted `ing:` = disclosed ○ exactly; no non-`ing:` fact written by an attempt; no × / negative in the ledger; no `×` in the save; Notebook line present iff rows exist; no 「なし / 全部 / あと」 wording; no fact stored without a panel (cross-recipe / targetless). The harness has teeth (mutations on `researchResultRows`: persist-negatives, no known exclusion, inverted verdict → detected). The K cap is never stressed by the player model (it never places > 3 unknown toppings), so that mutation survives the sim and is covered, as before, by `researchResultRows.test.ts` / `gameReducer.researchRows.test.ts` (killed: 6 failures).

## 9. Save / schema

`CURRENT_SCHEMA_VERSION = 2` unchanged; `git diff 425a206 db6ed5a -- src/state/persistence.ts` is empty; after a full 27-recipe walk the persisted save contains none of `lastResearchRows / RESEARCH_ROWS / toppingOverCap / researchTest / lastIngredientTest / researchTargetValidAtStart`. **Safe.**

## 10. Assumptions / authority gaps

1. **No authoritative player model.** The strategy is explicit but conservative on stopping (no speculative exact guess); the stop-knowledge bound is 107 attempts with a free total. Real players mix hypotheses; true attempts likely lie between ~90 (FIXED4) and ~137. The Contract's C1 = 97 is **not** comparable (it assumes an early stop without paying for STRUCTURE) and was not used.
2. Pack-unit placement and no quantity failures are optimistic for attempts; FULL-stock vs ONE-stock brackets the Pitz side. The truth depends on how many pieces players actually place while exploring (not observable here).
3. **No flag-OFF (B0) attempt baseline**: without feedback the player model is arbitrary, so no speed-up ratio is claimed.
4. No time / session-length model; progression "speed" is counted in attempts and Pitz, not minutes.
5. SUB_CLASS not exploited (see §3). Hint buying policy is up-front per target (existing harness convention).
6. The "≤ 1" ★3-FULL threshold was set for a direct-bake model with no exploration; whether it still applies to an attempt-aware economy is an **Owner decision**. This session invents no new threshold.

## 11. Gate C

| Part | Status |
|---|---|
| A. Implementation | PASS — #363 merged, main CI + WebKit green, Codex re-review clean (per #363 record, 0 unresolved), save/schema safe (§9) |
| B. Preview | PASS — Owner Preview HV PASS (Preview `60dc604`); Trial Notebook readability is a non-blocking UX follow-up |
| C. Simulation / Economy | **Open**: no deadlock, Pitz recoverable, RESERVED 0, invariants 0 violations; **★3-FULL replay 3–8 > 1** and exploration refill spend 790–1,600 Pitz are new; ★1 replays up 2.5–4.5×; no authoritative player model |

Hard Stop Conditions (deadlock / unavoidable inventory deadlock / impossible Pitz recovery / oracle regression / save incompatibility): none hit. READY = NO because a pre-existing Phase 2 check (★3-FULL replay ≤ 1) fails under both stock assumptions and the simulation cannot tell, within its authority, that the shifted economy is intended.

**To flip to YES** (Owner decisions, not made here): (a) accept ★3-FULL replay > 1 as the intended attempt-aware economy, or re-base the criterion; or (b) adjust the economy (e.g. refill cost / pack size / exploration stock) and re-run `researchAttempt.sim.test.ts`. Re-run: `RESEARCH_ATTEMPT_SIM_SEEDS=100 RESEARCH_ATTEMPT_SIM_OUT=<path> npx vitest run src/logic/researchAttempt.sim.test.ts` (~45 s).

Production flag: **OFF** (`RESEARCH_IDENTIFY_PRODUCTION_DEFAULT = false`, unchanged). Production activation: not done.

> **Erratum (Fresh Authority Audit, same branch):** the "★3-FULL replay ≤ 1" figure is an Owner-accepted *observation* of the direct-bake Hint 5.0 walk (OD-H5-ECON-1), not a defined threshold, and "rewards" in §6's Pitz-flow line include Margherita-replay income (discovery income is 3,510). The verdict above is unchanged pending an Owner Decision. See `TETO_CONTRACT-2.1_STAR3-FULL-REPLAY_Fresh-Authority-Audit.md`.

## 12. Owner Decision and Gate C re-evaluation

### 12.1 Owner Decision — Contract 2.1 Research Economy (2026-10-03)

Option 2 adopted after the Fresh Authority Audit (`TETO_CONTRACT-2.1_STAR3-FULL-REPLAY_Fresh-Authority-Audit.md`, classification B):

- **"★3-FULL replay ≤ 1" is not applied to the Contract 2.1 Production Activation Gate.** It was an observation of the direct-bake (no exploration) Hint 5.0 walk, accepted for that economy (OD-H5-ECON-1); not a Contract 2.1 hard invariant, assert, blocker or CI gate.
- Contract 2.1's ★3-FULL replays (3–8; seed sweep max 12) are **recoverable soft friction** caused mainly by Research-attempt inventory refills, not a progression deadlock.
- This is **not** a new upper limit on replays and **not** a decision that any number of replays is acceptable. It decides exactly one thing: `★3-FULL replay ≤ 1` is not a pass / fail condition of Gate C.
- **Recorded for post-Production re-evaluation (no economy change now):** ★3-FULL replay 3–8 (sweep max 12); refill events 13–23 and refill spend 510–890 Pitz (the two stock bounds, ★3 FULL profile, tray order; over every ★3 profile and the 100-seed sweep: 5–49 refills, 200–1,940 Pitz, replays 0–15); ★1 replays 64–117 (vs 24–39 in the direct-bake walk); Hint rungs SAUCE / CHEESE / KEY saving ≈ 0 attempts (#360 scope).
- Not changed: refill price, pack size, Pitz, Gate criteria. #360 and the 53 / 172 Scale Audit are not started. Production flag stays OFF; **READY = YES is not permission to turn it ON** (separate step).

### 12.2 Fresh re-evaluation (main `db6ed5a`, re-run on this branch)

| Item | Result |
|---|---|
| Sole reason for the earlier NO | **Confirmed**: §11 listed the ★3-FULL replay item as the only unmet criterion; every hard Stop Condition was already "none hit". |
| A. Implementation | PASS: #363 / #364 merged; `origin/main` still `db6ed5a`; main CI at `db6ed5a`: Deploy and E2E WebKit success; #363 review threads 1/1 resolved (Codex P2 fixed in `511ced4`); `persistence.ts` untouched. |
| B. Preview HV | PASS (Owner iPhone, Preview `60dc604`; Research loop complete, no blocker; Notebook readability = non-blocking UX follow-up). |
| C. Simulation, re-run | 638 walks (36 matrix + 2 analysis-only + 600 sweep): all complete, all reach Dex 27 → progression deadlock **0**; min Pitz **≥ 0** (0 observed, never negative); RESERVED stops **0**; Contract invariant violations **0** on every attempt. |
| Inventory recovery | PASS: every stock-out (target not researchable) cleared by a refill; no unavoidable inventory deadlock. |
| Pitz recovery | PASS: every shortfall closed by Margherita replays (starters only; +80 Pitz at ★3); no impossible recovery. |
| Save / schema | PASS: schemaVersion 2, `persistence.ts` diff empty, no transient Research state in the save after a full walk. |
| ★3-FULL replay | Observed 3–8 (sweep max 12), recorded under §12.1; not a Gate C condition. |
| Authority gaps | None is a Stop Condition: no authoritative player model (strategy explicit, conservative on stopping); no flag-OFF attempt baseline (no speed-up ratio claimed); no time model; SUB_CLASS not exploited. They bound the *size* of the soft friction, not the deadlock / recovery / oracle results the hard conditions test. Carried to the post-Production re-evaluation. |
| Independent blockers | **None found.** ★1 replay growth and Hint-rung value are recorded observations, not Stop Conditions and not criteria. |

Corrections to §6 / §11 (the Erratum above still holds and is consistent): "★3-FULL replay ≤ 1" was never a hard gate; "rewards 4,070" included Margherita-replay income (27 × 130 + 7 × 80); discovery income is 3,510.

**PRODUCTION ACTIVATION GATE C — READY = YES.** Production flag `RESEARCH_IDENTIFY_ENABLED` remains OFF (`RESEARCH_IDENTIFY_PRODUCTION_DEFAULT = false`); no deploy, no economy change.
