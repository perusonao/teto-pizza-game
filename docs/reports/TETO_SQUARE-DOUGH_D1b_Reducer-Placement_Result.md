# Square-Pan Dough D1-b — reducer placement boundary and no-CUT — Result

Issue #537 (D) under Epic #532. Base: `origin/main` `82731f4` (A, B1, F1, D1-a merged). **Not merged, not deployed, shared Preview untouched.**
No player-visible change in Production: every shipped recipe resolves to the round pan (`activePanShape`), so each branch below takes the round path.

## Scope (independent of B2 #546, F2 #548 and C)
Uses only what is on main: `activePanShape(recipe)` (B1; the recipe's `panShape` or the Preview/DEV `?pan=square` switch), `getPanGeometry` (A) and the D1-a primitives.

| Change | File |
|---|---|
| `PLACE_TOPPING` checks the drop against the round's pan (`getPanGeometry(activePanShape(recipe)).contains`; the round pan's `contains` **is** `isInsideDough`) and, on the square pan only, finds the open spot with `findOpenSpotOnPan`. Round still calls `findOpenSpot`. | `src/state/gameReducer.ts` |
| A square-pan round has no CUT: `cookingProfileForPan` drops `CUT` and `cutConfig` once, where a round is built (`buildOrderState`). The round pan returns the same profile object. | `src/logic/pan/panProfile.ts`, `gameReducer.ts` |
| `resolvePieceDropForPan(shape, …)`: round = `resolvePieceDrop` itself, square = `resolveGeometryPieceDrop`. **Not wired** (see below). | `src/logic/pan/panPlacement.ts` |

## What is deliberately not done
- **Dinner is not changed.** A Dinner round is recipe-free: its CUT requirement is decided by `planDinnerBake` / `resolveDinnerAttempt` (Dinner's own authority, `dinnerResultDetection.ts`). Stripping CUT from its profile alone would leave `resolveDinnerAttempt` still requiring it (Codex P2 on #552), and propagating the exemption widens into Dinner's resolver. The square pan is reachable only by the Preview/DEV `?pan=square` switch (and later by grandma-pizza, never in Dinner), so Dinner x square is left as is and recorded here.
- **`App.tsx` `resolvePhysicalDrop` is not rewired.** B2 (#546) edits `App.tsx`; the finger-to-dough step belongs to D2-a after B2 lands. Until then a square round's reducer accepts corner drops but the physical drag still resolves with the round rule.
- **Sauce:** `APPLY_SAUCE` / `COMMIT_SAUCE_DISPENSE` have no boundary check in the reducer (sauce may overshoot by design; overflow is a metric). The square metrics (`computeSquareSauceMetrics`, D1-a) are therefore not routed anywhere: they feed Scoring 2.0 / Reference, which D4 keeps unchanged until the square recipe (E) exists.
- No dependency on C (completion predicate) or B2's component; the square dough → SAUCE step gate is untouched.

## Why the round pizza cannot change
- Round placement: `pan.contains === isInsideDough` (asserted by reference in panGeometry.test.ts) and `findOpenSpot` is still the function called.
- Round profile: `cookingProfileForPan(profile, "round") === profile` (same object, tested).
- Tests: `gameReducer.squarePlacement.test.ts` pins that a round margherita still rejects the corners and a point past the rim and still has CUT; the square round accepts the four corners, rejects off-pan points, nudges on-pan, and has no CUT (also under `?pan=square`).

## Follow-ups (not in this PR)
D2-a (App.tsx drop wiring, sauce canvas / cheese / topping in `PizzaStage.tsx`, after B2) and D2-b (bake / RESULT / thumbnails CSS, after #518 or without its blocks; HV required).
