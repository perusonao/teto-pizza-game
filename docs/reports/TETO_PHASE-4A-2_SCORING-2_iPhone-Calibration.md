# PR #31 — Scoring 2.0 Shadow — iPhone Human Calibration Analysis

## Scope and source

- Repository: `perusonao/teto-pizza-game`
- PR: `#31`
- Exact calibrated Preview source: `1ef4814abc7a8e363161866648eb04645963363c`
- Mode: read-only calibration analysis
- Evidence: six manually made pizzas on a real iPhone against the deployed PR #31 Preview
- Existing gate: `A. VALIDATION VERIFIED — READY FOR IPHONE CALIBRATION`

This report does not repeat validation or security review and does not change code, fixtures, weights, gates, legacy scoring, stars, Dex BEST, rewards, progression, persistence, Bake scoring, Reference data, or production authority. The only repository change is this report.

The Preview panel rounds every displayed number with `Math.round`. Therefore the formulas below are exact for source SHA `1ef4814…`, while arithmetic reconstructed from the screenshots is necessarily approximate: the scorer combines unrounded internal values and only then the UI rounds the component and total. A one-point discrepancy between a hand calculation from displayed integers and the displayed total is expected and is not a second formula.

## Real-iPhone observations

| Case | Construction / human assessment | Legacy | Shadow | Recipe | Sauce | Pieces |
|---|---|---:|---:|---:|---:|---:|
| A | Carefully made; clearly the best | 100 | **94** | 100 | 92 | 99 |
| B | Sauce deficient; one mozzarella missing; pieces misplaced; clearly flawed | 88 | **50** | 100 | 37 | 55 |
| C | Extremely little sauce; correct topping counts; clearly bad | 100 | **38** | 100 | 13 | 71 |
| D | Correct counts; sauce concentrated instead of spread; noticeably worse than A | 99 | **72** | 100 | 64 | 76 |
| E | About 3× mozzarella and basil, visibly clustered; major construction failure | 98 | **74** | 100 | 78 | 43 |
| F | Almost unmade and underbaked; clearly worst or near-worst | 68 | **30** | 100 | 13 | 33 |

Observed ordering is `A (94) > E (74) > D (72) > B (50) > C (38) > F (30)`. The model is directionally much better than legacy: A is isolated at the top and the near-missing-sauce cases C/F are low. The calibration defect is local rather than architectural: E narrowly outranks D even though E is the more serious construction failure.

## Exact formula decomposition

### Total

For the three available Phase 4A-2 components:

```text
Total = 0.65 × Sauce + 0.20 × Pieces + 0.15 × Recipe
Bake  = unavailable and excluded
```

The 65/20/15 split is explicitly provisional. It makes Sauce the dominant axis; all topping-count and topping-placement failures combined can remove at most 20 total points. Recipe type correctness can contribute 15 points independently of construction quality.

Using the displayed component integers (not the hidden unrounded values):

| Case | Approximate displayed-value decomposition | Result |
|---|---|---:|
| A | `0.65×92 + 0.20×99 + 0.15×100` | 94.6 → displayed 94 from unrounded inputs |
| B | `0.65×37 + 0.20×55 + 0.15×100` | 50.1 → 50 |
| C | `0.65×13 + 0.20×71 + 0.15×100` | 37.65 → 38 |
| D | `0.65×64 + 0.20×76 + 0.15×100` | 71.8 → 72 |
| E | `0.65×78 + 0.20×43 + 0.15×100` | 74.3 → 74 |
| F | `0.65×13 + 0.20×33 + 0.15×100` | 30.05 → 30 |

### Recipe

Recipe is presence-only:

```text
Recipe = 100 × (number of required ingredient types present at least once)
               / (number of required ingredient types)
```

For Margherita the types are tomato sauce, mozzarella, and basil. Counts, amount, placement, clustering, and bake do not enter this component. All six pizzas contain at least one instance of each required type, so all six correctly receive Recipe 100.

This is doing its intended job. In particular, E's 9/3 and 6/2 over-count must not also lower Recipe: quantity already belongs to Pieces. Reducing Recipe merely because this calibration set happens to hold it constant would blur the clean type-vs-construction responsibility boundary and weaken the penalty for a genuinely missing ingredient type. Recipe 100 is constant credit here, but it is not duplicated quantity credit.

### Sauce

The Sauce component is additive:

```text
Sauce = 30 × quantitySimilarity
      + 30 × coverageSimilarity
      + 20 × evennessScore
      + 20 × rimScore
```

Quantity and coverage use the same smooth tolerance band (`fullCreditDistance=0.08`, `zeroCreditDistance=0.40`) against the reachable Margherita Reference. Evenness is read directly. Rim is a smooth score from edge ratio using the existing `EDGE_GREAT=0.03` and `EDGE_POOR=0.12` thresholds. Evenness and rim are presence-gated only while normalized sauce quantity is below `0.05`; once that floor is reached, neither is gated by coverage.

The screenshot values explain the observed Sauce scores directly:

| Case | Calculation from displayed sub-scores | Sauce |
|---|---|---:|
| A | `30×1.00 + 30×0.78 + 20×0.92 + 20×1.00` | 91.8 → 92 |
| B | `30×0 + 30×0 + 20×0.86 + 20×1.00` | 37.2 → 37 |
| C | `30×0 + 30×0 + 20×0.26 + 20×0.40` | 13.2 → 13 |
| D | `30×1.00 + 30×0 + 20×0.69 + 20×1.00` | 63.8 → 64 |
| E | `30×0.84 + 30×0.47 + 20×0.91 + 20×1.00` | 77.5 → 78 |
| F | same displayed sub-scores as C | 13.2 → 13 |

### Pieces

For each ingredient group:

```text
Q = playerCount == 0
    ? 0
    : clamp01(1 - abs(playerCount - targetCount) / (targetCount + 1))

P = mean similarity of the minimum-distance Hungarian assignment
    between min(playerCount, targetCount) same-type pieces and Reference positions

Group = 30 × Q + 70 × P
Pieces = mean(mozzarella Group, basil Group)
```

Hungarian matching preserves same-type permutation invariance. Extra pieces are not included in the placement mean when player count exceeds target count; the matcher selects the best target-sized subset. The intended separation was: Q handles missing/extra count and P handles locations of the matched pieces. The defect is that those two signals are then added with no interaction, so placement can dominate even after a catastrophic count failure.

Reconstruction from displayed values:

| Case | Mozzarella group | Basil group | Approx. Pieces |
|---|---|---|---:|
| A | `30×1 + 70×0.99 = 99.3` | `30×1 + 70×0.97 = 97.9` | 98.6 → 99 |
| B | `30×0.75 + 70×0.45 = 54.0` | `30×1 + 70×0.37 = 55.9` | 55.0 → 55 |
| C | `30×1 + 70×0.83 = 88.1` | `30×1 + 70×0.35 = 54.5` | 71.3 → 71 |
| D | `30×1 + 70×0.83 = 88.1` | `30×1 + 70×0.50 = 65.0` | 76.6 (unrounded inputs display 76) |
| E | `30×0 + 70×0.32 = 22.4` | `30×0 + 70×0.92 = 64.4` | 43.4 → 43 |
| F | `30×0.50 + 70×0.42 = 44.4` | `30×0.667 + 70×0.02 = 21.4` | 32.9 → 33 |

## Case E root cause: severe over-quantity

For mozzarella 9/3:

```text
Q = clamp01(1 - |9-3|/(3+1)) = clamp01(-0.5) = 0
P ≈ 0.32
Group = 30×0 + 70×0.32 = 22.4 → 22
```

For basil 6/2:

```text
Q = clamp01(1 - |6-2|/(2+1)) = clamp01(-1/3) = 0
P ≈ 0.92
Group = 30×0 + 70×0.92 = 64.4 → 64
```

Basil can score 64 with quantity 0 because placement evaluates only the best two of six basil pieces. Four unmatched extras do not reduce P; their only penalty is Q, whose entire influence is the smaller 30% term. With enough pieces clustered around or spanning a Reference location, the best subset can be excellent even while the pizza has triple the requested count. Thus `Q=0` does not gate or cap the 70 placement points.

This is not a Recipe-weight defect. The direct cause lies inside Pieces: an invalid amount can retain most of the placement credit. The aggregate weights amplify the symptom: Pieces is only 20% of Total, so the observed Pieces 43 costs E only `0.20×57 = 11.4` points relative to perfect Pieces. Sauce 78 contributes 50.7 and Recipe contributes 15, producing 74.

Quantity should gate placement contribution for over-quantity. It should do so inside the Pieces group, where count and placement semantics meet, rather than by making Recipe re-count pieces or by adding an opaque global exception.

## Case D: concentrated sauce

D has quantity 100, coverage 0, evenness 69, and rim 100:

```text
Sauce = 30 + 0 + 13.8 + 20 = 63.8 → 64
Total ≈ 0.65×64 + 0.20×76 + 0.15×100 = 72
```

The formula treats these as four independently additive qualities. Correct total quantity and a clean rim guarantee 50/100 before spread quality is considered; moderate evenness adds about 14 more. Coverage 0 can remove only its 30-point allocation and does not gate the otherwise perfect rim score.

This behavior is internally consistent with the current design and its documented Golden Matrix: the existing `concentrated dump` fixture scores Sauce 63.1 and Total 76.0 with perfect pieces, while `good` under-quantity scores Sauce 43.4 and Total 63.2. The result report already calls out that ordering as a known calibration nuance. Real-iPhone D reproduces it almost exactly, so this is not a measurement anomaly.

Human-feel assessment: Sauce 64 is generous for coverage 0, but D's Total 72 is still 22 points below A and D remains a middle-range pizza with correct ingredient types and correct topping counts. The six-pizza evidence does not require a simultaneous Sauce rewrite to resolve the primary failure. Changing Sauce now would also move B/C/F, which are already directionally correct, and risks overfitting one concentrated example. This should remain a monitored secondary calibration issue; add a stronger Golden assertion for distribution before changing it.

## Golden Matrix implications

The current checked ordering is only:

```text
perfect (99.4) > good (63.2) > poor (40.0) > empty (0)
```

Other documented rows are concentrated 76.0, too-little 52.5, and edge/overflow 46.9, but the test does not assert a complete ordering among all of them. There is no severe-overquantity Golden row. Consequently the current suite can stay green while E-like construction remains too generous.

The iPhone set adds important ordering evidence without defining hard score targets:

- A must remain clearly first.
- C/F must remain low because near-missing sauce is a major failure.
- D must remain materially below A.
- E must not outrank D merely because its sauce is broader while both topping groups are catastrophically over-counted.
- B should remain a plausible flawed middle-low result.

## Bounded calibration options

### Option 1 — asymmetric over-quantity gate inside Pieces (recommended)

Exact change per group:

```text
overQuantityGate = playerCount <= targetCount ? 1 : quantitySimilarity
Group = 30 × quantitySimilarity
      + 70 × placementSimilarity × overQuantityGate
```

`placementSimilarity ?? 0` remains unchanged for no matches. Hungarian matching, tolerance radii, equal group averaging, Recipe, Sauce, and total weights remain unchanged.

Rationale: placement of the best subset remains meaningful at or below the target count, so missing pieces are not punished a second time. Above target, placement credit fades continuously with count correctness. At 9/3 and 6/2, `Q=0`, so both placement contributions are gated to zero. This is local, understandable, permutation-invariant, and directly repairs the demonstrated interaction defect.

Expected A–F effect from displayed metrics:

- A, B, C, D, F: unchanged because no group exceeds its target count.
- E: mozzarella `22→0`, basil `64→0`, Pieces `43→0`; Total falls by about 8.6 points, `74→about 66`.
- Expected qualitative ordering: `A > D > E > B > C > F`. Exact integers are not targets.

Golden Matrix risk: low. Existing perfect/good/poor/empty fixtures contain no over-target group, so their scores and asserted ordering should remain unchanged. The main risk is a discontinuity in player feel immediately above target caused by using the existing Q curve as a multiplier; targeted 4/3, 5/3, 6/3 and 3/2, 4/2 counts should be inspected. No Reference or matcher change is needed.

Implementation scope: one formula in `src/logic/scoringV2/piecesComponent.ts`, ruleset-version bump, focused tests, and result-report calibration note. Estimated model-processing time: **25–40 minutes** including test authoring and focused regression execution.

Required regressions:

- 9/3 mozzarella and 6/2 basil with high placement similarity cannot retain placement points.
- Slight overage decays continuously: 4/3 is penalized less than 5/3, which is penalized less than 6/3.
- Exact counts and all existing Golden fixtures are numerically unchanged.
- Missing-count cases (2/3, 1/3, 1/2) are numerically unchanged.
- Same-type input permutation remains invariant.
- New qualitative matrix assertion: excellent > concentrated-correct-count > severe-overquantity > deficient/poor as justified by named fixtures, without hard-coding the six screenshots.

### Option 2 — reweight Total to Sauce 60 / Pieces 30 / Recipe 10

Exact change:

```text
Total = 0.60 × Sauce + 0.30 × Pieces + 0.10 × Recipe
```

Rationale: raises the maximum consequence of all topping construction failures and reduces constant Recipe credit while keeping Sauce dominant.

Approximate effects from displayed values:

| Case | Current | Approx. option 2 |
|---|---:|---:|
| A | 94 | 95 |
| B | 50 | 49 |
| C | 38 | 39 |
| D | 72 | 71 |
| E | 74 | 70 |
| F | 30 | 28 |

This likely restores `D > E`, but only narrowly and without fixing the underlying basil `quantity 0 → group 64` contradiction. It also changes every pizza and weakens Recipe's valid missing-type signal based on a sample where no type is missing.

Golden Matrix risk: medium. Existing top-level values all move and the complete documented-but-not-asserted row ordering may change. Implementation scope is small (three constants and version bump), but calibration scope is broad. Estimated model-processing time: **35–55 minutes** with matrix recalculation and expanded missing-type tests.

Required regressions:

- Recalculate every Golden Matrix row under the new weights.
- Preserve perfect > good > poor > empty and finite/clamped totals.
- Add missing-required-type cases so lowering Recipe weight is an explicit product decision.
- Recheck sauce-dominant cases, especially near-missing sauce and concentrated sauce.
- Preserve legacy/shadow isolation.

### Option 3 — severe-overquantity cap at final aggregation

Exact example change:

```text
rawTotal = 0.65 × Sauce + 0.20 × Pieces + 0.15 × Recipe
if any piece group has playerCount >= 2 × targetCount:
    Total = min(rawTotal, 60)
else:
    Total = rawTotal
```

Rationale: guarantees that a clearly severe construction failure cannot present as a high score, regardless of Sauce/Recipe credit.

Expected effect: A/B/C/D/F unchanged; E `74→60`. Ordering becomes `A > D > E > B > C > F` with a larger separation than option 1.

Golden Matrix risk: medium-high. The threshold and cap are abrupt, game-specific policy; 5/3 and 6/3 can fall on opposite sides of a cliff, and the formula becomes less compositional and less understandable. It masks rather than repairs the inconsistent Pieces group score. Implementation scope is still bounded, but requires cap-boundary and monotonicity tests. Estimated model-processing time: **40–65 minutes**.

Required regressions:

- Boundary cases immediately below/at/above `2×` for every group.
- Multiple-group interactions and permutation invariance.
- Monotonicity around the cap and absence of score increases from adding extras.
- Full Golden Matrix plus explicit capped-severe-overquantity fixtures.

## Recommended minimum change

Implement **Option 1: the asymmetric over-quantity gate inside Pieces**.

It is the smallest conceptual change that addresses the evidence at its source. Recipe remains a clean binary/type-correctness component; missing pieces are not double-penalized; valid exact-count placement and the existing Golden Matrix remain stable; same-type permutation invariance and forgiving spatial tolerances are untouched. It corrects E without tuning A–F individually and without pulling the already-plausible B/C/F results into a broader recalibration.

Do not combine Option 1 with a Recipe-weight change in the first tuning pass. Do not tune Sauce simultaneously. After Option 1, rerun a targeted Golden Matrix extended with mild overage, severe overage, and concentrated-correct-count rows, then repeat only the minimum human-feel spot checks needed to confirm `A > D > E` qualitatively. If D still feels too generous across additional concentrated-sauce samples, treat Sauce distribution coupling as a separate calibration decision with its own evidence.

## Risks and implementation estimate

- Primary regression risk: the existing quantity curve reaches zero at different absolute excess counts for target 3 vs target 2; tests must express ratios and monotonicity, not only one literal case.
- Golden risk: low for the checked matrix, because current fixtures are not over-counted; currently absent severe-overquantity coverage must be added.
- Human-feel risk: E remains around the mid-60s because Sauce is correctly still worth 65% and Recipe type presence still earns 15%. This is acceptable for the minimum pass if E falls below D; a desired hard ceiling would be a separate policy decision, not inferred from six samples.
- Architecture risk: low. No matcher, Reference fixture, persistence, authority, legacy path, or production UI is involved.
- Estimated implementation plus focused model-run verification: **25–40 minutes of model-processing time**. A subsequent real-iPhone spot calibration remains human/device time and is not included.

B. CALIBRATION TUNING REQUIRED — IMPLEMENT RECOMMENDED MINIMUM CHANGE

## Implementation — Asymmetric Over-Quantity Gate

Implemented on 2026-09-16 from calibrated source `1ef4814abc7a8e363161866648eb04645963363c`.

### Exact formula implemented

For each authoritative Reference piece group:

```text
overQuantityGate = playerCount <= targetCount ? 1 : quantitySimilarity

Group = 30 × quantitySimilarity
      + 70 × placementSimilarity × overQuantityGate
```

`placementSimilarity ?? 0` remains unchanged when there are no matches. The named
`overQuantityPlacementGate` helper contains the asymmetric rule. It leaves placement fully
influential for exact-count and under-count pizzas, and applies the existing continuous quantity
similarity only when the player exceeds the target. Hungarian assignment, matching tolerances,
equal group averaging, Recipe scoring, Sauce scoring, and the 65/20/15 total weights are unchanged.
The Shadow ruleset version is bumped from `phase-4a-2-shadow-1` to
`phase-4a-2-shadow-2` so results from the two formulas cannot be confused.

### Files changed

- `src/logic/scoringV2/piecesComponent.ts`
- `src/logic/scoringV2/scoringV2.test.ts`
- `src/logic/scoringV2/index.ts`
- `docs/reports/TETO_PHASE-4A-2_SCORING-2_iPhone-Calibration.md`

No Reference fixtures, Recipe/Sauce/Bake scoring, matching implementation, legacy score,
stars, Dex BEST, rewards, progression, persistence, or Preview/Production authority paths changed.

### Regression cases

Focused Pieces coverage now pins:

- exact target count with excellent placement: unchanged at group score `100`;
- exact target count with poor placement: still uses the ungated `30Q + 70P` formula;
- under-quantity (`2/3`) with an excellent matched subset: unchanged at `92.5`;
- one extra (`4/3`) with an excellent matched subset;
- moderate over-quantity (`5/3`) with an excellent matched subset;
- severe over-quantity (`9/3`, three times target) with an excellent matched subset;
- declining placement influence as over-quantity increases; and
- severe-overquantity permutation invariance.

The severe case explicitly proves that Hungarian matching may still return placement similarity
`1.0` for the best subset while the group score is `0` when quantity similarity is `0`. The
matcher remains permutation-invariant and is not modified.

### Representative before/after scores

These are formula-level, non-screenshot-specific examples using an excellent matched subset:

| Count / target | Quantity | Placement | Before group | After group |
|---|---:|---:|---:|---:|
| `3/3` exact | 1.00 | 1.00 | 100.0 | 100.0 |
| `2/3` under | 0.75 | 1.00 | 92.5 | 92.5 |
| `4/3` one extra | 0.75 | 1.00 | 92.5 | 75.0 |
| `5/3` moderate over | 0.50 | 1.00 | 85.0 | 50.0 |
| `9/3` severe over | 0.00 | 1.00 | 70.0 | 0.0 |

Applying the formula to the real-iPhone Case E component evidence (not hard-coding its total):

- mozzarella `9/3`: displayed `Q=0`, `P≈0.32`, group `≈22 → 0`;
- basil `6/2`: displayed `Q=0`, `P≈0.92`, group `≈64 → 0`;
- Pieces `≈43 → 0`; and
- displayed-value total estimate `≈74 → 65.7`, expected to display approximately `66` subject
  to the same hidden unrounded-input caveat documented above.

Cases A, B, C, D, and F contain no over-target group in the calibration evidence and therefore
remain formula-identical. Expected qualitative ordering becomes `A > D > E > B > C > F`.

### Golden Matrix impact

The existing Scoring V2 Golden ordering remains unchanged:
`perfect > good > poor > empty`. Its fixtures do not exceed authoritative target counts, so their
scores are numerically unchanged by construction. The focused Golden run passed `1/1`; the
malformed/adversarial suite also re-confirmed its separate permutation/Golden protections.

### Verification totals

All commands ran with Node `24.19.0` because the machine's system Node `20.8.1` lacks the
`node:util.styleText` export required by the installed Vite/Vitest toolchain.

| Verification | Exact result |
|---|---|
| Focused Pieces tests | 1 file, 12 passed, 22 skipped (34 collected) |
| Scoring V2 Golden ordering | 1 file, 1 passed, 33 skipped (34 collected) |
| Malformed/adversarial regressions | 1 file, 191 passed |
| FREE/Lunch Rush integration filter | 1 file, 2 passed, 45 skipped (47 collected) |
| Full Vitest suite | 42 files, 758 passed |
| Typecheck (`tsc -b --pretty false`) | passed, 0 errors |
| Lint (`oxlint`) | passed, 0 warnings/errors |
| Production build (`vite build`) | passed, 71 modules transformed |

`git diff --check` is recorded after the final report update and before commit.
