# CUT-S2 Shadow Evaluation — Result (Issue #288)

**Status: straight-line interaction evaluator verified (Owner HV PASS). The evaluation contract is kept for the move to pointer-trajectory input; the interaction-specific parts are carried over to a trajectory HV.** (See the Addendum, sections A-F.)

Base: main `6abddc71f2b71fbd7a04844db390986d709f69e3` (no drift). Branch `claude/cut-scoring-audit-drh1e2`.
Shadow only: nothing here touches `state.score`, ScoringV2, stars, Dex, Pitz, Lunch Rush, ranking, Dinner, RESULT,
save or any production file. PR #275 is OPEN; no file it changes (`gameReducer.ts`, `DinnerGameUi.tsx`,
`dinnerResultDetection.ts`, `dinnerView.ts`, `completionGate.ts`, `App.css`) is touched here.

## What was and was not verified
- **Done:** real pointer input (Playwright mouse) through the real gesture layer at 360x800 and 390x844; the lines the
  game committed were read back from the DOM and fed to `evaluateCut` and `evaluateCutQuality`. The app's own RESULT
  cutScore equalled the harness value (84 = 84 at 360x800, 96 = 96 at 390x844).
- **Not done in the first pass (since done, see Addendum A):** no person operated a device. The "operator" is a seeded noise model (`cutOperatorModel.ts`: press/release
  aim error in px, angle error, centre mis-judgement). It proves the pipeline and gives distributions; it does not
  measure real fingers. The real aim error sigma is the unknown that decides the tolerances (see sensitivity).

## Data
`docs/reports/data/cut-s2/`: `shadow-360x800.json`, `shadow-390x844.json` (24 real-pointer trials x 4 profiles each),
`distribution-and-sweep.json` (400 trials x 4 profiles x 2 stages, 243 tolerance combinations),
`weights-and-sensitivity.json`, `edge-cases.json`. Picture: `docs/reports/screenshots/cut-s2/shadow-cuts-p10-median-p90.png`.
Regenerate: `CUT_S2_WRITE=1 npx vitest run src/logic/cut/quality.s2Shadow` and
`npx playwright test e2e/cut-quality-shadow-s2.spec.ts --project=iphone-360x800 --project=iphone-390x844`.

## Distribution (default tolerances, 400 trials per profile; overall p10 / median / p90; existing cutScore in the same form)

| stage | profile | CutQuality overall | existing cutScore | centre (mean) | uniformity (mean) | slivers present |
|---|---|---|---|---|---|---|
| 360x800 | ideal | 1.00 / 1.00 / 1.00 | 88 / 99 / 99 | 1.00 | 1.00 | 11% |
| 360x800 | normal | 0.96 / 1.00 / 1.00 | 83 / 86 / 96 | 1.00 | 0.97 | 70% |
| 360x800 | sloppy | 0.77 / 0.88 / 0.97 | 73 / 80 / 87 | 0.97 | 0.71 | 86% |
| 360x800 | rough | 0.52 / 0.70 / 0.84 | 63 / 71 / 78 | 0.81 | 0.39 | 92% |
| 390x844 | ideal | 1.00 / 1.00 / 1.00 | 98 / 99 / 99 | 1.00 | 1.00 | 7% |
| 390x844 | normal | 0.96 / 1.00 / 1.00 | 83 / 86 / 96 | 1.00 | 0.97 | 68% |
| 390x844 | sloppy | 0.78 / 0.89 / 0.97 | 74 / 80 / 86 | 0.97 | 0.72 | 86% |
| 390x844 | rough | 0.55 / 0.72 / 0.85 | 63 / 72 / 79 | 0.83 | 0.41 | 92% |

## Case table (A ideal / B normal / C poor / D edge; n/a = NaN input, serialised as null)

| case | cutScore | validity | countFit | centre | uniformity | overall | sliver | pieces |
|---|---|---|---|---|---|---|---|---|
| A ideal | 100 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0 | 6 |
| B finger-width wobble | 83 | 1.00 | 1.00 | 1.00 | 0.92 | 0.97 | 1 | 6 |
| B off-centre ~4% + uneven angles | 78 | 1.00 | 1.00 | 1.00 | 0.68 | 0.87 | 1 | 6 |
| C clear centre miss | 60 | 1.00 | 0.67 | 0.12 | 0.30 | 0.41 | 3 | 4 |
| C parallel cuts | 45 | 0.33 | 0.50 | 0.33 | 0.00 | 0.23 | 2 | 3 |
| D small central sliver (3 cuts ~3% off a common point) | 85 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1 | 6 |
| D near duplicate (2nd cut 5 deg from 1st) | 69 | 0.67 | 0.67 | 1.00 | 0.28 | 0.61 | 2 | 4 |
| D extra line (4th good cut) | 81 | 1.00 | 0.67 | 1.00 | 0.70 | 0.83 | 0 | 8 |
| D degenerate line | 65 | 0.67 | 0.67 | 1.00 | 0.20 | 0.58 | 0 | 4 |
| D NaN line | n/a | 0.67 | 0.67 | 1.00 | 0.20 | 0.58 | 0 | 4 |

## Findings
1. **completeness fixed-20% is resolved in CutQuality**: at confirm `evaluateCut.completeness` is 1 in every case (table
   above, pinned by a test); CutQuality has no such term.
2. **Slivers are the normal case, not an edge case**: 68-70% of natural (aim sigma 6px) cuts leave a central sliver
   because three lines never meet exactly. The existing cutScore reads that as "7 slices" (normal median cutScore 86 for
   a cut that looks perfect); CutQuality ignores it (normal median 1.00). Ignoring slivers is therefore necessary, not
   merely reasonable. The threshold itself is insensitive (0.1 / 0.2 / 0.3 move rough median by <= 0.03).
3. **centerAccuracy is not too strict; it is nearly saturated**: mean 1.00 for ideal/normal, 0.97 sloppy, 0.81-0.83 rough.
   Centre and centre tolerances (2-6 / 15-30) barely move any distribution. Uniformity carries the discrimination.
4. **uniformity is the only sensitive tolerance**: zero-credit deviation 0.4 / 0.6 / 0.8 moves rough median 0.59 / 0.72 / 0.78
   and normal p10 0.94 / 0.96 / 0.97 (390x844).
5. **Ideal and natural cuts are intentionally indistinguishable** (both ~1.00 median): the dead zone absorbs fingertip noise.
   Precision beyond a fingertip earns nothing.
6. **Operator-noise sensitivity (360x800, normal profile scaled)**: normal p10 at aim sigma 4 / 6 / 8 / 10 px =
   1.00 / 0.96 / 0.92 / 0.87 (default tolerance) versus 1.00 / 0.93 / 0.86 / 0.79 (uniformity zero 0.4). The tighter
   setting discriminates better but turns unfair faster if real fingers are noisier than 6px.
7. **Pixels:** the CUT stage is 328px (360x800) and 358px (390x844); the same finger is ~9% noisier in dough-percent on the
   smaller stage. Both stages gave the same ordering; 360x800 was 0.00-0.02 lower.

## Recommendation (candidates, not decisions)
| item | current (S1) | measured | candidate |
|---|---|---|---|
| centre full / zero | 4 / 20 | insensitive | keep 4 / 20 |
| sliver fraction | 0.2 | insensitive | keep 0.2 |
| uniformity full | 0.10 | 0.05: normal p10 0.93; 0.15: 1.00 (but sloppy 0.93) | keep 0.10 |
| uniformity zero | 0.6 | rough median 0.72 (too forgiving?) vs 0.59 at 0.4 | **open**: 0.6 (fairness-first) or 0.4 (discrimination-first) |
| weights | .15/.15/.30/.40 | with zero 0.4: rough 0.57-0.59, normal p10 0.93-0.94; uniformity-led (.10/.10/.20/.60) drops normal p10 to 0.89-0.91; equal weights raise rough to 0.72 | keep provisional |

Only `uniformityZeroCreditDeviation` is undecided, and the choice depends on the real-finger aim sigma, which this
session could not measure.

## Owner Decision / action needed (first-pass list; answered in the Addendum)
- A hands-on session on real 360x800 and 390x844 devices (ideal / normal / careless, several each) to set the real aim
  sigma and confirm that the numbers match how the cuts look. The contact sheet shows the modelled cuts agree with their
  numbers visually; that is not a human judgement.
- uniformity zero 0.6 vs 0.4 (fairness-first vs discrimination-first).
- Whether ideal and natural cuts should stay indistinguishable (finding 5).

---

# Addendum: Owner Human Verification result and Owner Decision (2026-09-30)

Docs/test evidence only. No production scoring, save, UI, Dinner, Lunch Rush, Dex, Pitz or ranking change, and no PR.
Preview page under test: `?cuthv=1` at source `5657019140db1413b1e84989e1edee0c7ab50e62` (record format `cut-hv-preview-v1`).

## A. Owner HV result
- **Verdict: PASS** (Owner Decision 1).
- What the Owner reported (recorded as stated):
  - Every trial the Owner rated **丁寧** or **普通** scored **Q = 1.00 under both** zero-side 0.6 and 0.4.
  - The trial the Owner rated **雑** (#1 of the rough-rated trials) still scored **1.00 under 0.4**.
- The raw 11-trial table is recorded verbatim in A.1 and every figure was **recomputed from its `lines`** (A.2); no figure below is estimated.

### A.1 Raw Owner data (verbatim, `cut-hv-preview-v1`, Owner's iPhone; file `docs/reports/data/cut-s2/owner-hv-raw.tsv`)

| # | 指示 | 自己評価 | Q(0.6) | Q(0.4) | unif 0.6 | unif 0.4 | center | validity | count | cutScore | sliver | pieces | viewport |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 丁寧 | 雑 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 86 | 1 | 6 | 402x714 |
| 2 | 丁寧 | 普通 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 97 | 0 | 6 | 402x714 |
| 3 | 丁寧 | 丁寧 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 97 | 0 | 6 | 402x714 |
| 4 | 普通 | 普通 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 87 | 1 | 6 | 402x714 |
| 5 | 普通 | 普通 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 87 | 1 | 6 | 402x714 |
| 6 | 普通 | 丁寧 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 97 | 0 | 6 | 402x714 |
| 7 | 普通 | 雑 | 0.73 | 0.60 | 0.32 | 0.00 | 0.99 | 1.00 | 1.00 | 71 | 1 | 6 | 402x714 |
| 8 | 普通 | 雑 | 0.57 | 0.50 | 0.19 | 0.00 | 0.67 | 1.00 | 1.00 | 66 | 1 | 6 | 402x714 |
| 9 | 雑 | 雑 | 0.58 | 0.43 | 0.41 | 0.02 | 0.49 | 1.00 | 0.83 | 74 | 1 | 5 | 402x714 |
| 10 | 雑 | 雑 | 0.92 | 0.87 | 0.80 | 0.66 | 1.00 | 1.00 | 1.00 | 81 | 1 | 6 | 402x714 |
| 11 | 雑 | 雑 | 0.74 | 0.64 | 0.64 | 0.40 | 0.60 | 1.00 | 1.00 | 84 | 0 | 6 | 402x714 |

The `lines` column (three chords per trial, dough-percent, 2 decimals) is in the TSV.

**Viewport caveat.** Every trial ran at **402x714** (the iPhone with Safari's browser UI), not at the 390x844 / 360x800 the procedure named. Lines are in
dough-percent so the geometry and every score are viewport-independent, but the finger error in dough-percent depends on stage size, which was not
recorded. The two named viewports are covered by the real-pointer e2e (layout and pipeline) and the simulation, not by a human.

### A.2 Recomputed from the pasted lines (`src/preview/cutHvOwnerData.test.ts`)

All 11 rows reproduce: Q(0.6), Q(0.4), both uniformities, center, validity and count within one rounding step (0.005), and cutScore, sliver and pieces exactly.

**By the Owner's self-rating** (min / mean / max):

| 自己評価 | n (trials) | Q(0.6) | Q(0.4) | Q(0.6) - Q(0.4) mean / max | current cutScore | trials with a sliver |
|---|---|---|---|---|---|---|
| 丁寧 | 2 (#3, #6) | 1.00 / 1.00 / 1.00 | 1.00 / 1.00 / 1.00 | 0.000 / 0.00 | 97 / 96.8 / 97 | 0 / 2 |
| 普通 | 3 (#2, #4, #5) | 1.00 / 1.00 / 1.00 | 1.00 / 1.00 / 1.00 | 0.000 / 0.00 | 87 / 90.3 / 97 | 2 / 3 |
| 雑 | 6 (#1, #7, #8, #9, #10, #11) | 0.57 / 0.76 / 1.00 | 0.43 / 0.67 / 1.00 | 0.085 / 0.16 | 66 / 76.8 / 86 | 5 / 6 |

**By the instruction given** (what the page asked for):

| 指示 | n | Q(0.6) | Q(0.4) | Q(0.6) - Q(0.4) mean / max | current cutScore | trials with a sliver |
|---|---|---|---|---|---|---|
| 丁寧 | 3 | 1.00 / 1.00 / 1.00 | 1.00 / 1.00 / 1.00 | 0.000 / 0.00 | 86 / 93.1 / 97 | 1 / 3 |
| 普通 | 5 | 0.57 / 0.86 / 1.00 | 0.50 / 0.82 / 1.00 | 0.041 / 0.13 | 66 / 81.6 / 97 | 4 / 5 |
| 雑 | 3 | 0.58 / 0.75 / 0.92 | 0.43 / 0.64 / 0.87 | 0.102 / 0.16 | 74 / 79.6 / 84 | 2 / 3 |

**What the data fixes**
- **丁寧 (#3, #6) and 普通 (#2, #4, #5) by the Owner's own rating: all five are Q(0.6) = Q(0.4) = 1.00.** Nothing in the Owner's own 丁寧/普通 set is penalised by either setting.
- **雑 by the Owner's rating (#1, #7, #8, #9, #10, #11): Q(0.6) 0.57-1.00 (mean 0.76), Q(0.4) 0.43-1.00 (mean 0.67).** Five of the six are below 1.00 under both settings; the exception is #1.
- **#1 = Owner 雑, Q(0.6) = Q(0.4) = 1.00** (uniformity 1.00 / 1.00, center 1.00, validity 1.00, count 1.00). Its piece areas are 1193 / 1297 / 1004 / 1318 / 1284 / 1140 plus a 2-unit sliver (of 7238 total): six near-equal wedges. The geometry is good; the Owner's "雑" was about the hand, not the pizza.
- **Q(0.6) versus Q(0.4):** identical on all six trials the Owner did not rate 雑 and on #1; different on #7-#11 only, by 0.13 / 0.07 / 0.15 / 0.05 / 0.10 (0.4 is always lower). 0.4 therefore separates the already-low cuts further (#7 0.73 -> 0.60, #8 0.57 -> 0.50, #9 0.58 -> 0.43) but moves neither #1 nor any 丁寧/普通 trial.
- **Instruction versus feeling:** the instructed "普通" #7 and #8 were rated 雑 by the Owner and are exactly the low-Q ones (0.73 / 0.57); instructed 雑 #10 scored 0.92. Q follows what the finished cut looks like, not what was asked.
- **Current cutScore on the same lines:** the 丁寧/普通-rated trials split into **97 (#2, #3, #6: no sliver)** and **86-87 (#1, #4, #5: a 1-2 unit sliver)** although all six are Q = 1.00 with visually equal wedges. A sliver that is 0.03% of the pizza costs ~10 cutScore points: the artifact found in simulation is present in real-finger data, and it is also why cutScore ranks #1 (86) with the 普通 cuts rather than apart from them. cutScore is 66-84 for the rest (#7-#11).
- **Rank agreement with the Owner's rating (Spearman, 丁寧 < 普通 < 雑):** CutQuality 0.75 (either setting; eight trials tie at 1.00 by design), current cutScore 0.90. The higher cutScore figure comes from the sliver split above, not from better judgement of the cut; it should not be read as cutScore being the better signal.
- **Count signal:** only #9 is below 1.00 (0.83, 5 pieces: two of its three lines cross close together), so validity and count almost never discriminate in practice; centre and uniformity carry the score, as the simulation predicted.
- **Sample size:** 11 trials, one person, one viewport. It supports PASS and the rejection of 0.4; it is not a distribution.

## B. Owner Decision (recorded as authority)
1. CUT-S2 Human Verification: **PASS**.
2. Provisional uniformity zero-side tolerance: **0.6 adopted**.
3. **0.4 not adopted**, because:
   - trials the Owner rated 丁寧 / 普通 were 1.00 under both, so 0.4 adds nothing for them;
   - 0.4 leaves the Owner-rated 雑 trial #1 at 1.00 too, so it does not solve the one real discrimination problem;
   - the S2 simulation showed 0.4 punishes natural cuts harder as operator noise rises (360x800, normal p10 at aim sigma 8 / 10 px:
     0.92 / 0.87 with 0.6 versus 0.86 / 0.79 with 0.4; sections "Findings" 6 and "Recommendation" above);
   - so fairness is preferred for now.
4. Centre tolerance **4 / 20** kept. 5. Sliver threshold **0.2** kept.
6. Provisional weights **validity .15 / count .15 / center .30 / uniformity .40** kept.
7. Ideal and natural hand-shake are **not** forced apart: a finished cut whose geometry is good enough may score full marks.
8. What is evaluated is the **completed cut geometry**, not the jitter of the pointer that drew it.

The adopted values are the S1 defaults, so no code changed; `quality.s2Shadow.test.ts` now pins them ("Owner Decision (HV PASS)") and pins that
drawing direction does not change the result. The Preview page still shows both 0.6 and 0.4 (it is the evidence tool); it is unchanged.

## C. Comparison with the current cutScore
- Simulation (400 trials, default tolerances): natural cuts score a **median cutScore of 86 versus CutQuality 1.00** (85-86 at both stages), because the
  existing score reads a central sliver as a 7th slice and also carries the fixed completeness 20%. Rough cuts: cutScore median 71-72 versus
  CutQuality 0.70-0.72 (see "Distribution").
- **Real data (A.2):** for the Owner's 丁寧/普通-rated trials the current cutScore is 97 or 86-87 depending only on whether a 1-2 unit sliver happened to appear, while CutQuality is 1.00 for all of them. For the 雑-rated trials cutScore is 66-86 (mean 76.8) and Q(0.6) 0.57-1.00 (mean 0.76).

## D. Trial #1: "rated 雑 by the Owner, geometry scored full marks"
- Real data: trial #1 (A.1, A.2). This is the case Decision 7 and 8 accept on purpose: the Owner felt the cut was careless, but the **finished geometry** (three chords through
  the middle, near 60 degrees apart, areas inside the 0.10 dead zone) is good, and CutQuality scores the geometry, not the feeling or the pointer path.
- It is also the case 0.4 could not fix (still 1.00), which is why 0.4 was rejected rather than tuned further.
- Consequence to keep in mind for S3/S4: a full CutQuality does **not** mean "the player was careful". It means "the pizza is cut well". If a
  future design wants to reward care (e.g. time or path smoothness), that is a different signal; Decision 8 says it is not this one.

## E. Evaluation contract (kept) versus interaction (to be re-verified): moving to pointer-trajectory input

Direction from the Cooking Interaction 2.0 Fresh Audit (as communicated; the audit document itself is not in this repository yet):
CUT moves to **pointer-trajectory input**; scoring uses the **final cut geometry / an approximating chord**, not the trajectory itself;
**Undo after a cut is to be abolished, but that is decided only after a trajectory HV**; **4 / 6 / 8 slices stay extensible**.
Nothing below is implemented. The S2 evaluator and HV result are **kept, not discarded**.

### E.1 Retained evaluation contract (input-agnostic: takes the final cut as chords in dough-percent)
- `evaluateCutQuality(lines, config, tolerance, weights)`: signals `lineValidity`, `sliceCountFit`, `centerAccuracy`, `sliceUniformity`, `overall`; no completeness term;
  finite and bounded for any input; order independent; drawing direction irrelevant.
- **Owner-adopted values** (pinned by `quality.s2Shadow.test.ts`): uniformity full / zero 0.10 / 0.6, centre 4 / 20, sliver 0.2, weights .15 / .15 / .30 / .40.
- **Owner principles:** a good finished geometry may score full marks even if the hand was careless (#1); ideal and natural hand-shake are not forced apart; the pointer's jitter is not scored.
- **The "final cut geometry / approximating chord" seam:** if a trajectory is reduced to chords, this evaluator applies unchanged. The reduction is the new piece (E.2), and Decision 8 is what lets it be separate.
- Slice count as data: perfect 4 / 6 / 8 fixtures score 1 (quality.test.ts).
- Evidence and tooling that stay valid: the 11-trial Owner data and its reproduction test, the S2 distributions and sweep, the edge-case table, the Preview HV page shell and its production-isolation gate, the mutation script (30 killed / 9 documented equivalent / 0 survived), the real-pointer e2e pattern.
- A CUT that was skipped (#256, now in main) or not performed has no CutQuality and is not penalised.

### E.2 Interaction parts that need a trajectory HV (not reusable as evidence)
| Area | Why the straight-line evidence does not carry over |
|---|---|
| Trajectory -> chord reduction | New. Which chord a wobbly path becomes (endpoints, least squares, extension to the rim) decides the score; it must be tested with real fingers. |
| Tolerances (centre 4/20, uniformity 0.10/0.6, sliver 0.2) | Set from press/release straight lines; a traced path has a different error profile and the simulation's operator model no longer applies. The values are kept as the starting point only. |
| Pointer jitter vs Decision 8 | The jitter becomes part of the input; a smoothing / straightening rule must make "only the finished cut is scored" true in practice. |
| Line validity, centre accuracy, region count | Assume a straight rim-to-rim chord (`isEdgeToEdgeCutLine`, perpendicular distance, sign-tuple areas). Fine after reduction to chords; not for raw curves. |
| Duplicate gate (15 degrees) and the `requiredCutCount + 2` limit | Defined on chord angles and on press/release gestures. |
| Undo | The 11-trial procedure, the limit and the "1本戻す" button assume recovery; a no-Undo cut makes a slip final, changes how careless input scores, and is to be decided by the trajectory HV. |
| 4 and 8 slices | Verified only as perfect fixtures, never by hand. Ideal area, angular spacing (90 / 60 / 45 degrees against the 15 degree gate) and the sliver fraction of the ideal area shift; they need their own device check. |
| Viewports | The Owner HV ran at 402x714 only; the trajectory HV should state and cover its viewports (390x844, 360x800). |
| HV page | Follows the new gesture layer (it reuses `PizzaStage` and mirrors the reducer's gates today). |

## F. Status
- **S2: straight-line interaction evaluator verification complete; evaluation contract preserved for the trajectory interaction.** No production connection.
- **S3 (production Result UI / scoring connection): not started**; no PR; no merge. Held for the trajectory-interaction decision.
- **main:** this branch now contains main `5c8190ff` (PR #275 merged: #256 CUT skip on a failed bake + Dinner UI Polish) through a merge commit (no rebase, no force push).
  The only main change touching this work's test helpers is `e2e/gestures.ts`, and it is **comment-only** (the diff changes the doc comment of the round helper; the functions are unchanged).
  The CUT-S2 e2e specs bake margherita inside its band (60-80), so the #256 skip never applies to them.
- The Preview slot serves the earlier build `5657019` (it replaced PR #275's Preview build and the `dm3r2-setup.html` helper; #275 is now merged).

## G. Items carried over to the trajectory version
1. Trajectory -> chord reduction rule and its tolerance (E.2 row 1, 3).
2. Re-verification of centre / uniformity / sliver values with trajectory input at 390x844 and 360x800 (and record the viewport).
3. Undo policy (abolish or not) decided by the trajectory HV; adapt the cut limit and duplicate gate.
4. 4 and 8 slice device checks; ideal-area-relative thresholds.
5. A way to express "careless hand, good pizza" to the player in S3 (#1), if the Owner wants it.
6. Re-point the Preview HV page at the new gesture layer; keep the production-isolation gate.
7. Whether the existing `evaluateCut` / `cutScore` (with its sliver artifact, fixed completeness and NaN on malformed lines) stays as a display-only preview or is retired at S3/S4.
