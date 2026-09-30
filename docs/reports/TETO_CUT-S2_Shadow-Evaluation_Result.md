# CUT-S2 Shadow Evaluation — Result (Issue #288)

Base: main `6abddc71f2b71fbd7a04844db390986d709f69e3` (no drift). Branch `claude/cut-scoring-audit-drh1e2`.
Shadow only: nothing here touches `state.score`, ScoringV2, stars, Dex, Pitz, Lunch Rush, ranking, Dinner, RESULT,
save or any production file. PR #275 is OPEN; no file it changes (`gameReducer.ts`, `DinnerGameUi.tsx`,
`dinnerResultDetection.ts`, `dinnerView.ts`, `completionGate.ts`, `App.css`) is touched here.

## What was and was not verified
- **Done:** real pointer input (Playwright mouse) through the real gesture layer at 360x800 and 390x844; the lines the
  game committed were read back from the DOM and fed to `evaluateCut` and `evaluateCutQuality`. The app's own RESULT
  cutScore equalled the harness value (84 = 84 at 360x800, 96 = 96 at 390x844).
- **Not done:** no person operated a device. The "operator" is a seeded noise model (`cutOperatorModel.ts`: press/release
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

## Owner Decision / action needed
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
- **Not yet in this report:** the raw 11-trial table (`cut-hv-preview-v1`: instructed style, self-rating, Q 0.6 / Q 0.4, uniformity,
  center, validity, count, current cutScore, sliver, pieces, viewport, lines). It was announced to follow the Owner's message but did not
  arrive with it. It must be appended **verbatim** under "A.1" below; nothing has been reconstructed or estimated here, and every
  per-trial figure in this addendum other than the three statements above is therefore deliberately absent.

### A.1 Raw Owner data (to be pasted verbatim)
_Pending: paste the `cut-hv-preview-v1` block here. The committed `lines` column lets every number be reproduced with
`computeHvMetrics` (src/preview/cutHvSession.ts)._

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
- The Owner's own cutScore values are in the pending raw table (A.1); no figure is asserted here.

## D. Trial #1: "rated 雑 by the Owner, geometry scored full marks"
- This is the case Decision 7 and 8 accept on purpose: the Owner felt the cut was careless, but the **finished geometry** (three chords through
  the middle, near 60 degrees apart, areas inside the 0.10 dead zone) is good, and CutQuality scores the geometry, not the feeling or the pointer path.
- It is also the case 0.4 could not fix (still 1.00), which is why 0.4 was rejected rather than tuned further.
- Consequence to keep in mind for S3/S4: a full CutQuality does **not** mean "the player was careful". It means "the pizza is cut well". If a
  future design wants to reward care (e.g. time or path smoothness), that is a different signal; Decision 8 says it is not this one.

## E. Reusable if the CUT interaction changes (Cooking Interaction 2.0)
The Owner raised three ideas: cut by a **finger-traced trajectory** instead of a press/release straight line, **no Undo** once cut, and a check that
**4 / 6 / 8 slices** still work. Nothing below is implemented; this is an impact note for the separate Cooking Interaction 2.0 Fresh Audit.

**Reusable as is**
- The contract's shape and the Owner-adopted tolerance philosophy: per-signal 0-1 credit with a full-credit dead zone, sliver exclusion, line validity,
  no completeness term, malformed-input safety, order independence, and `CutQualityTolerance` / weights as adjustable authorities.
- Area-based uniformity and sliver handling **if** the cut is still turned into a set of regions (the piece areas are what the Owner judged).
- 4 / 6 / 8: the engine takes `requestedSliceCount` as data and perfect 4- and 8-slice fixtures already score 1 (quality.test.ts).
- The harness: seeded operator model, real-pointer Playwright spec, distribution/sweep probe, the Preview HV page shell and its production-isolation
  gate, the layout check at 390x844 / 360x800, and the mutation script.
- The decision that only finished geometry is scored (8) is what makes a trajectory input workable: the trajectory must be reduced to a cut shape first.
- Since PR #275 merged (main `5c8190f`), a CUT skipped for a failed bake has **no** CutQuality (neutral), consistent with S1's "not performed = no value".

**Needs re-work if cuts become traced trajectories**
- Line validity, centre accuracy and the region count all assume a **straight rim-to-rim chord** (`isEdgeToEdgeCutLine`, perpendicular distance from
  the centre, sign-tuple piece areas in geometry.ts). A curved or polyline path needs a reduction rule (straighten / fit a chord / keep the curve),
  a curve-aware centre measure and a region computation that can split a disc by curves.
- The pointer jitter that Decision 8 says not to score becomes the geometry itself; a smoothing / straightening policy must be chosen and tested.
- Sliver and duplicate rules (`MIN_CUT_ANGULAR_SEPARATION_RADIANS`, the 15 degree duplicate gate) are defined on chord angles.
- **No Undo** removes the recovery path that the 11-trial procedure, the `requiredCutCount + 2` limit and the "1本戻す" button rely on; a mistaken cut
  would be final, so the score spread for careless input and the retry model change.

**Needs a new Human Verification if the operation changes**
- All tolerances (centre 4/20, uniformity 0.10/0.6, sliver 0.2) were set from **straight-line** finger operation; a traced trajectory has a different
  error profile and the operator model no longer applies.
- 4 and 8 slices were verified only as perfect fixtures, never by hand. Ideal piece area (1/4, 1/6, 1/8 of the disc), the angular spacing (90 / 60 /
  45 degrees against the 15 degree duplicate gate) and the sliver threshold as a fraction of the ideal area all shift, so they need their own
  real-device check on 360x800 and 390x844.
- The Preview HV page (PizzaStage CUT layer, reducer-mirroring gates) would have to follow the new gesture layer.

## F. Status and blockers
- **S3 (production Result UI / scoring connection): STOPPED** until the Cooking Interaction 2.0 Fresh Audit reports. Not started; no PR; no merge.
- **main moved:** `6abddc71` -> `5c8190ff` (PR #275 merged: #256 CUT skip on a failed bake + Dinner UI Polish). A dry merge of this branch
  (`git merge-tree`) is clean and no file of this work (`src/logic/cut/*`, `src/preview/*`, `src/main.tsx`, the e2e specs) is touched by main.
  `e2e/gestures.ts` changed on main, so the two CUT-S2 e2e specs should be re-run after the branch is brought up to date; this session did not merge main.
- The Preview slot currently serves this branch's build (it replaced PR #275's Preview build and the `dm3r2-setup.html` helper; #275 is now merged).
