# T25 I-7 — yogurt-sauce presence-dab implementation specification

Date: 2026-11-15  
Status: **NEEDS_OWNER** — implementation is prohibited until the Owner approves I-7.  
Measurement base: `main` `dba7d7331cad49a9dff068a9a23d79ba1cb37ee4`

This document specifies one bounded use of the existing SAUCE line. It does not approve the value, add T25 content, change the runtime, or authorize PR #853 to merge.

## Proposed player flow

1. `pizza-salad` keeps `tomato-sauce` as its primary sauce and Reference/scoring target.
2. The existing SAUCE step presents `yogurt-sauce` as a secondary required sauce after tomato sauce. No new cooking step or parallel runtime mechanic is introduced.
3. Selecting yogurt sauce and tapping the pizza commits exactly one existing starter deposit at the tap coordinate.
4. That one deposit records yogurt-sauce presence and renders a visible white/cool dab. It is not quantity-, coverage-, or evenness-scored; the primary tomato layer remains the only sauce Reference target.
5. Yogurt input ends immediately after the first committed deposit. Hold, drag, pointer-move ticks, and a second dab are ignored for yogurt sauce. Reset removes it through the existing sauce reset path.
6. Inventory consumption remains one sauce use by presence, matching the current secondary-sauce rule. Research identity remains ingredient presence only.

## Concrete upper-bound proposal

**Proposed cap: 1 deposit / normalized quantity `0.02` / 2% per pizza.**

Measured basis on current main:

- `SAUCE_RATE_PER_TICK = 0.02` and the dispenser creates one starter dab immediately on pointer start.
- `COVERAGE_THRESHOLD = 0.015`, deliberately below one `0.02` tick, so one isolated dab is visibly registered.
- `multiSauce.guards.test.ts` pins the current Owner policy that a single faint dab of a secondary sauce passes presence with no amount floor.
- A full paint layer is capped at `1.0` per sauce and the pizza-wide provisional cap is `2.0`; allowing the yogurt layer to use those caps would contradict the requested presence-dab identity and make a second full paint pass possible.

The `0.02` cap is therefore the smallest existing atomic, renderable, presence-valid amount. It introduces no new analog calibration. A cap above `0.02` has no measured requirement; a cap below `0.02` would require a new fractional deposit path and could fall below the existing visible/touched-cell threshold.

## Required implementation guards (after Owner approval only)

- Data: yogurt-sauce remains a sauce ingredient and a required secondary sauce; it is not added to `RECIPE_SAUCE_PROFILES` as the primary Reference target.
- Reducer/controller: commit at most one yogurt deposit of exactly `0.02`; no later tick from the same press and no later yogurt press may add quantity.
- Rendering: use the existing layered sauce canvas and ingredient color; do not create a new renderer or gesture family.
- Scoring/completion: presence passes with the one dab; tomato sauce alone owns sauce-quality scoring. Missing yogurt fails required-ingredient presence; extra yogurt quantity cannot be created through the UI.
- Stage: yogurt is applied in the existing pre-finish SAUCE line. Lettuce remains POST_BAKE/FINISH; no post-bake sauce mechanic is implied.
- Tests: exact `0.02` maximum, one-deposit maximum, hold/drag/second-tap no-op, reset/retry, persistence boundary, inventory one-use, missing/present completion, primary tomato score unchanged, Research presence identity, two-layer render order, and 390×844/360×800 HV after implementation.

## Owner decision still required

Approve, reject, or replace all of: presence-dab interaction; cap `0.02`; pre-finish placement in the existing SAUCE line; proposed color/art treatment. Until then T25 remains HOLD and this document is measurement-backed advice only.
