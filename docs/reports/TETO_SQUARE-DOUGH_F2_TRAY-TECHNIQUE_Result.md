# Square Dough F2 — Technique 「天板焼き」(`tray`) (Issue #538 / Epic #532)

Owner decisions 2026-10-18: Technique id `tray` ↔ pan value `"tray"`; display name 天板焼き; discovered when the technique is **unlocked** and a **formal `pan: "tray"`** cook is completed; Grandma (the recipe) is **not** required; a Preview query alone is never a discovery; the affordance step is **derived** from the latest ladder; no new ladder step. F2 only — the RESULT line / technique stage (F3), the ○□ switch (F4) and the Grandma recipe (E, #521) are **not** here.

## Approved Dex copy
| | |
|---|---|
| 未発見（なぞかけ） | 丸くなくても、ピザは焼ける。四つの角まで生地を広げてみよう。 |
| 発見後（説明） | 四角い天板に生地を広げて焼く調理法。指で押し広げ、四隅まで伸ばして形を整えよう。 |

The OD-TQ-5/6 exception is limited to this **general, same-for-every-player description of the Dex**. It names no recipe, ingredient, count or target. A test pins that the copy exists in exactly one source file (`src/data/techniques.ts`, a named allowlist), so Research, Hint 5.0, the RESULT near-miss and the recipes cannot repeat it.

## Changes
| File | Change |
|---|---|
| `src/data/techniques.ts` | `TechniqueId = "no-sauce" \| "tray"`; optional `descriptionJa`; `tray` registered after `no-sauce`. |
| `src/logic/techniques/detection.ts` | Used: pan axis OBSERVED and `"tray"` (explicit `PizzaState.pan` only, F1). Required: a target whose identity declares `pan: "tray"` (not `deep-pan` / `shallow-pan` / `null`). `dimensions` optional on the signature view, so every existing caller is unchanged. |
| `src/logic/techniques/dexView.ts`, `src/components/DexOverlay.tsx`, `src/App.css` | A discovered technique with a description shows it under the name; `no-sauce` has none (its view is unchanged). |
| `registration.ts` / `runtime.ts` | **No logic change.** The existing path already gives: usage path = Free Cooking + Completion Gate PASS + affordance open (INV-TQ-6); recipe path records the tray for any discovered tray recipe (INV-TQ-1) without ever requiring it (INV-TQ-NB). |
| `persistence.ts`, devtools | **No change needed**: they derive from `KNOWN_TECHNIQUE_IDS`; unknown ids are still preserved (a save written by this build opens in an older build, and an older save is untouched). Coverage is pinned by the existing devtools / persistence suites and the updated registry tests. |

## Affordance step (re-derived, not authored)
`techniqueAffordanceStep("tray", …)` = the max unlock step of a requiring recipe's materials. With the provisional Grandma materials and the **current** `DISCOVERY_LADDER` (53 steps): tomato-sauce 0, mozzarella 0, olive-oil 13, garlic 14 → **14**. No ladder step is added. The test computes it from `ingredientUnlockStep` instead of hard-coding it, and also pins today's value (14) so a ladder change is noticed. **No production recipe requires the tray, so the affordance is `null` and the technique cannot open or be discovered in production (INV-TQ-4)** — F2 is inert until E lands a tray recipe (whose materials and step are then re-derived).

## Anti-Oracle
* **G7 (`hint5Production.gate`) and INV-TQ-4 (`deductionProduction.gate`)**: the technique-requiring set is now the named allowlist `NO_SAUCE ∪ PAN_TRAY_RECIPE_IDS` (the latter empty until E); both are asserted equal to the catalog's requiring recipes in both directions, and `tray`'s affordance is asserted `null` iff the tray allowlist is empty. Nothing was removed or loosened.
* The Hint 5.0 / deduction privacy sweeps now also forbid the tray's id, name, riddle and description in every request, stored id and line.
* The Hint 5.0 and deduction modules still must not import techniques or read the ledger (unchanged tests).
* Research candidates and RESULT were not touched.

## Compatibility
* Round cooks and every existing recipe: `pan` stays `null`; no signature, fingerprint, discovery outcome or save changes.
* Old saves: `discoveredTechniqueIds` of `[]` / `["no-sauce"]` load and round-trip as before; `tray` is added only by a completed tray cook.

## Verification (local)
| Item | Result |
|---|---|
| `tsc -b` / `npm run build` / oxlint | pass / pass / existing warnings only (no new) |
| Vitest (full) | 440 files passed / 1 skipped, 8399 tests passed / 2 skipped, 0 failed |
| New tests | `techniques.tray.test.ts` (registry copy, detection, affordance, discovery rules, ledger, Dex views, copy-location allowlist), 3 Dex component cases in `TechniqueUi.test.tsx` |
| Updated pins | `techniques.test.ts` registry (`["no-sauce","tray"]`); G7 / INV-TQ-4 allowlists (above); privacy sweeps include the tray copy |
| Gate re-run (full) | `deductionProduction.gate` + `hint5Production.gate`: 29 tests passed unchanged in shape; the DH4 privacy sweep covers **4,836 seeded states** over the **56** non-onboarding production recipes (57 recipes), every Hint 5.0 purchase state of all 57 recipes, no technique / pan word in any request, stored id or line |
| Chromium 390×844 E2E | `tq-1d-no-sauce`, `discovery-research-target` (see the PR) |

**Not done here (by scope):** `GATE_STATES` pan-axis (○ / □) seeding and the tray recipe's Hint 5.0 ladder assertion (audit §7) need a production tray recipe, so they land with Square Dough E (#521). The RESULT technique stage / neutral line (F3), the ○□ switch (F4) and Grandma are untouched.

Human Verification: not required — the tray technique cannot open in production (no recipe requires it) and the only UI addition is a description line that renders only for a discovered tray technique.
