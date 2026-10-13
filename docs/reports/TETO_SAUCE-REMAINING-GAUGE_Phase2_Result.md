# Sauce Remaining Gauge — Phase 2 (PizzaStage wiring) Result

Issue #489 · builds on PR #493 (Phase 1: `sauceRemainingFraction` + `SauceRemainingGauge`, merge `2db1a52`).

## What changed
- `PizzaStage` renders `SauceRemainingGauge` while `makingStep === "SAUCE"` (and `interactive`, not `resultCompact`).
- Remaining = `1 − (committed + pending) / SAUCE_MAX_QUANTITY`. Committed is derived from `pizza.sauceDeposits`
  (canonical, no one-render lag); pending is `pendingTotalRef`, re-read on each `pendingVersion` bump. Switching sauce
  type does not reset it.
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
