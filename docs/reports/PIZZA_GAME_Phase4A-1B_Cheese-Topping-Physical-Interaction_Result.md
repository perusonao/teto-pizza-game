# PIZZA GAME Phase 4A-1B — Cheese & Topping Physical Interaction Result

- Status: implementation complete; PR-ready
- Date: 2026-09-15 JST
- Repository: `perusonao/teto-pizza-game`
- Branch: `codex/phase-4a-1b-physical-interaction`
- Baseline: main `0c880f6f655d8549d244fda0f15e8463f2c32b49`
- Baseline proof: PR #21 merge commit and current `origin/main` were identical at implementation start
- Excluded work: PR #25 HEAD `b6b0c395f8d82d7e88ee3decab3b0f0000f6ed11`
- Adopted audit verdict: **B. READY WITH MINOR DESIGN CHANGES**

## Result

FREE Margherita now supports physical tray-to-pizza placement for Mozzarella and Basil. The
catalog family remains `TAP_PLACE`; `DRAG_FROM_TRAY` is its primary input variant and the
existing `TAP_ON_PIZZA` path remains available as an accessibility/usability fallback.

The implementation preserves the Phase 4 boundaries:

- Sauce hold+drag and its timestamp/gesture model are unchanged.
- The sauce “thick red line” finding remains separate Visual Polish scope.
- `PizzaState.toppings` and `PLACE_TOPPING` remain canonical placement state/action.
- legacy `scorePizza`, stars, Dex, Mission, Pitz, Shop, progression and persistence remain
  authoritative and unchanged.
- Reference Placement is calculated only for the developer Prototype Metrics panel.
- save schema remains v1 with exactly `schemaVersion`, `dex`, `pitzBalance`,
  `ownedIngredientIds` and `missionBest`.

## Interaction implementation

### Mozzarella

- Upward tray drag starts after a 6 CSS px intent threshold on touch.
- Horizontal touch movement stays available to the tray scroller.
- Mouse/pen can start in any deliberate direction.
- A fixed, finger-offset preview shows drop validity.
- Successful drop commits exactly one existing `PLACE_TOPPING` action.
- Canonical landing uses a 220 ms squash/bounce CSS animation.

### Basil

- Uses the same single-piece transport and cancellation safety, not a second input system.
- Preview/shadow reads lighter than Mozzarella.
- Canonical landing uses a 280 ms falling/settling animation.
- Rotation is derived from a stable hash of ingredient and canonical x/y; `Math.random()` and
  animation state never enter scoring.

### Lifecycle and fallback

- First primary pointer wins; another pointer cannot replace the active session.
- Pointer capture is attempted, with window-level pointerup/pointercancel completion.
- lost capture, blur, hidden document, Escape, category/ingredient change and leaving the
  eligible interaction mode cancel without a commit.
- Drop rect is read fresh at release. Dough radius 48 is direct-valid, 48–52 is finger-size
  rim grace clamped to the dough, and farther drops cancel.
- Short chip tap selects the ingredient; pizza tap, Enter or Space places it using the existing
  path. A drag-generated click is suppressed to prevent duplicates.
- `prefers-reduced-motion` reduces landing animations to 1 ms without changing state.

## Reference Placement shadow model

Game-authored Margherita targets live beside the existing sauce Reference fixture:

| Ingredient | Target | Positions | Full / zero radius |
|---|---:|---|---:|
| Mozzarella | 3 | `(35,35)`, `(65,36)`, `(50,66)` | 8 / 22 |
| Basil | 2 | `(31,62)`, `(69,62)` | 8 / 22 |

Matching uses a dependency-free rectangular Hungarian assignment over Euclidean distance.
Player order and piece IDs do not matter. If counts differ, the smaller side is matched to the
best subset of the larger side. Quantity and matched-piece placement are displayed separately,
so missing/extra pieces are not punished twice. Placement has a full-credit plateau through 8
dough units and a smooth falloff to zero at 22.

## Automated verification

All checks passed on the final working tree:

- Vitest: **26 files, 382 tests passed**
- TypeScript: `tsc -b --pretty false` passed
- oxlint: passed
- Vite production build: passed
- `git diff --check`: passed

Coverage added for drag intent, coordinate conversion, rim grace, outside/invalid drops,
deterministic rotation, PREPARE/BAKE reducer guards, exact and boundary matching, permutation
invariance, natural minimum assignment, duplicate positions, missing/extra quantity separation,
shadow/legacy isolation and unchanged save-v1 root shape. The full pre-existing sauce, scoring,
Dex, Mission, economy, Shop/progression and persistence suites also stayed green.

## Browser verification

Verified in the local production UI through a browser viewport of 390×844:

- Mozzarella 3-piece tray drag/drop succeeded.
- Basil 2-piece tray drag/drop succeeded with stable distinct rotations.
- Drops at all five authored targets produced 100% placement similarity for both ingredients.
- Far outside drop was cancelled and did not change the Mozzarella count (3 before / 3 after).
- Short chip tap followed by pizza tap placed exactly one Mozzarella fallback piece.
- Prototype Metrics explicitly stated that Reference values do not affect stars/score.
- Existing BAKE → retrieve → RESULT flow completed and showed the legacy breakdown.
- No horizontal document overflow was present at the mobile viewport.
- Browser console contained no warnings or errors.

## Physical iPhone Human Feel Gate

The prior sauce Human Feel result remains the SSOT: hold+drag **PASS**, physical-making direction
adopted, sauce visual polish out of scope. A real-device gate for the new pieces is still required
before broad rollout. Check repeated 3+2 placement, horizontal-scroll arbitration, rim forgiveness,
rapid inputs, app/background cancellation, orientation change, VoiceOver, reduced motion and whether
three Mozzarella transports feel satisfying rather than laborious. Confirm that Mozzarella reads
heavy and Basil light without sacrificing input latency.

## Scope and scalability

The implementation is deliberately enabled only for Margherita Reference mode and only for
Mozzarella/Basil. It does not runtime-map the full catalog. Future whole-piece ingredients can reuse
`TAP_PLACE` with `DRAG_FROM_TRAY`; scatter, sprinkle, drizzle and special materials retain their own
families. Normalized positions, group matching and presentation-only landing styles scale without a
save migration. Scoring 2.0 adoption remains a separate Phase 4A-2 decision.

## Risks and severity

- P0: 0
- P1: 0
- P2: 0
- P3: 2 — real-iPhone Human Feel for new piece drag is pending; the sauce thick-red-line Visual
  Polish candidate remains separately recorded.

## Final verdict

**A. READY FOR IMPLEMENTATION REVIEW / PHYSICAL IPHONE GATE**

Production implementation, automated tests and desktop mobile-viewport browser verification are
complete. No technical blocker remains for PR review. Merge/broad rollout should retain the explicit
physical-iPhone gate for the new Mozzarella/Basil feel.
