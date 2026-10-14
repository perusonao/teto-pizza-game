# Sauce Remaining Gauge — Phase 2 (PizzaStage wiring) Result

Issue #489 · builds on PR #493 (Phase 1: `sauceRemainingFraction` + `SauceRemainingGauge`, merge `2db1a52`).

## What changed
- `PizzaStage` renders `SauceRemainingGauge` while `makingStep === "SAUCE"` (and `interactive`, not `resultCompact`).
- Remaining = `1 − (consumed + pending) / SAUCE_MAX_QUANTITY`, where `consumed` = the current sauce's canonical
  deposits + the usage of every sauce replaced by a switch (`advanceSauceCarry`). Pending is `pendingTotalRef`.
- Placement: `.pizza-stage__sauce-gauge`, absolutely positioned in the stage's right gutter (`right: 4px`, vertically
  centred), `pointer-events: none`. Out of flow → pizza size/centre, hit area and pointer math are unchanged.
- No reducer / save / scoring / inventory / props change. No numeric text, animation or haptics (Owner plan, #489 comment).

## Conflict check (before implementing)
- #487 (Canvas cheese) and #468 (mozzarella melt) touch `PizzaStage.tsx` only in imports and around the cheese/bake render
  (lines ~956 and ~1191). Phase 2 edits the SAUCE-derived block (~1047), the final JSX tail and one import line: no
  overlapping hunks expected; a trivial import-line merge is the worst case. #468 also edits `App.css` (different region).
- #478 (tray drag, draft) does not touch `PizzaStage.tsx` / `App.css`.
- No other open PR or branch implements the gauge wiring.

## Verification
- Vitest: `PizzaStage.sauceGauge.test.tsx` (9 tests: full / committed / empty, absent on DOUGH/CHEESE/TOPPING/CUT and result stage,
  outside the dough hit area).
- E2E `e2e/sauce-gauge-489.spec.ts` at 390×844 and 360×800: gauge right of the pizza, inside the viewport, ≤14×96px,
  not hit-testable, drains while holding and keeps its value after commit, pizza box identical, gone after leaving SAUCE.
- Screenshots: `docs/reports/screenshots/sauce-gauge-phase2/` (before / after-full / after-drained per viewport).
- Human Verification video (390×844) is delivered directly to the Owner per policy and is NOT committed; it has not been
  recorded in this cloud session — **Owner iPhone HV pending**.

## Not done (by instruction)
No merge, no deploy, no shared Preview replacement.

## Owner Decision (PR #494): cumulative consumption across sauce switches
Investigation (read-only, before this change): `COMMIT_SAUCE_DISPENSE` replaces `sauceDeposits` on a sauce switch, and the
dispense cap (`committedTotalRef`) was synced from that array. So the cap forgot the replaced sauce's usage at commit
(while still counting it during the first stroke of the new sauce), and the gauge — once it carried usage — showed 0%
while a further stroke still dispensed. Owner decided: manage usage cumulatively, make the gauge match the real limit, fix in #494.

- `committedTotalRef` (the cap's base) and the gauge now both read `sauceConsumedTotal = committed deposits + carried`.
  One source, so they cannot disagree. No reducer / save / props change; `sauceDeposits` is still replaced on a switch,
  so Scoring 2.0 / Completion Gate / Pitz still see only the latest sauce's deposits (unchanged).
- Behaviour change (intended): after a switch the new sauce can only use what is left of the single bottle
  (e.g. 0.5 of tomato used → at most 0.5 of pesto). Previously the second stroke after a switch got a fresh 1.0.
  A pizza that never switches sauce is unaffected. At 0% a press deposits nothing; selecting another sauce is still allowed.
- Tests: `advanceSauceCarry` unit tests; `PizzaStage.sauceCumulative.test.tsx` (normal, switch mid-way, switch back and forth,
  cap after a switch, 0% blocks both sauces, 1.0 of one sauce blocks the other, fresh pizza); E2E hold-to-empty at 390×844 / 360×800.
  The 0% test fails on the previous code and passes now.
