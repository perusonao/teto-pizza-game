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

## Rebase onto B1 / B2 (main `d0da093`) — the cumulative-carry logic is superseded
`main` gained B1 (#498, per-kind ledger) and B2 (#500, layered painting) after this PR was cut. B1 keeps the whole deposit history on a
switch and caps each kind at 100% (`SAUCE_MAX_QUANTITY`) plus a provisional pizza-wide 200% (`SAUCE_TOTAL_MAX_QUANTITY`); the B1 Result
already recorded that "#494's accumulate-across-switch logic is superseded by the ledger". Merging as-is would have made the gauge
disagree with the real cap, so this branch (merge of `main` into the PR head) replaces it:

- Removed: `advanceSauceCarry` / `SauceCarryState`, the `sauceCarry` render-time state and `committedTotalRef` in `PizzaStage`
  (main's `pizzaRef` + `sauceHeadroom` cap is kept as-is).
- Gauge = the dispenser's own number: `sauceGaugeUsed(pizza, activeKind) = SAUCE_MAX_QUANTITY − sauceHeadroom(pizza, activeKind, 0)`,
  plus the in-progress stroke (`pendingTotalRef`). `min(kind's own 100%, pizza-wide total)` — whichever binds — so gauge and cap cannot disagree.
- Behaviour with several sauces: a sauce not yet used starts at its own full bottle; switching back shows that sauce's remaining bottle
  (no refill); a drained sauce stays at 0% for its own kind while another kind still has its bottle. One-sauce pizzas are unchanged.
- This supersedes the earlier "one bottle across switches" Owner Decision wording on this PR (it predates B1's per-kind design).
  The pizza-wide 200% value is B1's provisional constant and is untouched.
- Tests: `sauceGaugeUsed` unit tests; `PizzaStage.sauceGauge.perKind.test.tsx` (replaces `…sauceCumulative.test.tsx`); a multi-sauce case in
  `PizzaStage.sauceGauge.test.tsx`; E2E multi-sauce case in `e2e/sauce-gauge-489.spec.ts`.
- B2 single-source rendering golden: only the two scenarios that press the dough on the SAUCE step (`tomatoPending`,
  `firstStrokePending`) changed hash — they now contain the gauge element; heatmap / overflow canvas counts and every other scenario are unchanged.
  Regenerated on purpose (`UPDATE_SAUCE_B2_GOLDEN=1`).

## Human Verification
The two videos recorded for the earlier cumulative design (A margherita, B switch) no longer describe the behaviour and are **withdrawn**.
Re-recording at 390×844 for the per-kind design (single sauce drain → switch to a fresh sauce shows full → switch back shows the remainder
→ drain to 0%) is **pending**; videos are delivered to the Owner directly and not committed (policy §6). Owner iPhone HV is also pending.
Screenshots (committed): `screenshots/sauce-gauge-phase2/` (single-sauce flow, unchanged by the rebase).
