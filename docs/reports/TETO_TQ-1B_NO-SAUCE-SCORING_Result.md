# TQ-1B — No-sauce scoring foundation: Result Report

Issue #263 · Owner Decision **OD-TQ-S1 = option B (APPROVED)**, which also answers Wave 2 **OD-W2-8** ·
base `main` `7bb0116` (PR #264)
Final Implementation Gate: `docs/design/TETO_COOKING-TECHNIQUES_1.0_FINAL-IMPLEMENTATION-GATE.md` §3.3
(on main since TQ-1C-0, #285; the summary authority is `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`).

## What changed

| File | Change |
|---|---|
| `src/logic/scoringV2/index.ts` | `SCORING_V2_WEIGHT_PROFILES` (STANDARD 52/16/12/20, unchanged; NO_SAUCE 0/68/12/20), `combineWeightedComponents` (the same expression as before, same term order), `computeScoringV2(recipe, pizza, options?)` with `options.reference`. NO_SAUCE is selected only when the Reference has `sauce: null`. A sauce-less Reference for a recipe that requires a sauce fails closed. |
| `src/logic/scoringV2/types.ts` | `ScoringReferencePizza` (`sauce: ReferenceSauce \| null`), `ScoringV2WeightProfile(Id)`, `ScoringV2Result.weightProfile` |
| `src/logic/scoringV2/__fixtures__/scoreParity.main-7bb0116.json` | 25 recipes × 9 pizzas = 225 rows. **Captured on unmodified main in commit `858c287`, before the scoring change.** |
| `src/logic/scoringV2/testSupport/parityPizzas.ts` | Deterministic pizza matrix: ideal / offset / poor / noSauce / halfPieces / extraPiece / raw / burnt / unbaked |
| `src/logic/scoringV2/scoringV2.noSauceParity.test.ts`, `scoringV2.noSauceProfile.test.ts` | New tests: parity, the profile, adversarial References and immutability |
| `src/data/referencePizza.ts` | Integrity only, no data change: the Reference types are deeply `readonly`, the registered References are deep-frozen at load, and `listReferencePizzas()` is added (from the Codex review on #271) |

**Not changed:**

- any Reference value or recipe (the types only gained `readonly`, and `sauce` is still non-null);
- the Completion Gate code;
- the UI, CSS and E2E;
- `SCORING_V2_RULESET_VERSION` and `LUNCH_RUSH_RULESET_VERSION`.

No production recipe reaches NO_SAUCE yet. Aussie ships in TQ-1D, which also widens `ReferencePizza.sauce` and adds the UI null guards.

## Owner absolute conditions → evidence

| Condition | Evidence |
|---|---|
| The existing 25 sauce recipes do not change by a single point | All 225 parity rows equal the pre-change snapshot exactly: total, ★, every component and the quantity factor. The rows span ★1–★5. |
| ★ thresholds unchanged | `starsFromTotal` is pinned at 90 / 75 / 60 / 40 with boundaries. The Pitz bands are pinned too. |
| Completion Gate thresholds unchanged | No code change. A no-sauce recipe passes without sauce, and a missing piece or an overbake still fails. |
| Lunch Rush formula unchanged | No code change. A source scan shows `lunchRushScoring` and `mission/**` never read the profile. |
| Dinner `minimumStars` authority unchanged | No code change. Every S = 1..5 is reachable by a no-sauce pizza. Negative control: today's formula caps a no-sauce pizza at ★2. |
| Scoring and Lunch Rush versions not bumped | Both are pinned. |

## Required tests

| Test | Result |
|---|---|
| Sauce recipe score parity | 225 / 225 exact |
| No-sauce reference accurate | Ideal → 100 / ★5 through NO_SAUCE. The total equals 68·P + 12·R + 20·B times the quantity factor, exactly. |
| Careless pieces degradation | The total drops by 0.68 × the pieces loss |
| Quantity degradation | The quantity factor is below 1 and the total drops |
| Bake cap | Raw or burnt never reads ★5 |
| 11-point comparison | **0 ★ mismatches and 0 Pitz-band mismatches** (the Gate result is reproduced). Negative controls: proportional redistribution gives ★3 and "sauce as full" gives ★4 at zero skill. |
| Adversarial | A sauce-less Reference for a sauce recipe → unavailable. `reference: null` → unavailable. Painting a sauce on a no-sauce recipe never raises the score. Omitting the option equals the production Reference. |

**Injected Reference validation** (the Codex review rounds on #271). `options.reference` is untrusted input, and anything below fails closed:

- A recipe with a production Reference is scored only against data structurally equal to that Reference.
- A recipe without one (the synthetic no-sauce seam) is checked against the recipe itself:
  - the recipe id;
  - piece groups that match the non-sauce requirements one-to-one, with position counts equal to `minCount`;
  - ingredient roles (a piece group is not a sauce, and the sauce target is a sauce);
  - tolerance bands and the sauce target that production uses for that same ingredient;
  - positions inside the reference slot area.
- Options that are not an object also fail closed.
- The production Reference registry and `SCORING_V2_WEIGHT_PROFILES` are frozen, and their types are readonly, so no importer can change a scoring target or weight at runtime.

Production callers never pass the seam.

Mutation check (done by hand, then reverted):

| Mutation | Tests that fail |
|---|---|
| NO_SAUCE weights shifted (64/16/20) | 3 |
| `SAUCE_WEIGHT` changed from 52 to 51 | 4 |
| NO_SAUCE never selected | 3 |

## Revert

Revert this PR alone. No production recipe reaches the new path, and nothing is persisted.
