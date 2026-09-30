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
