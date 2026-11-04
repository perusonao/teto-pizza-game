# #579 DRIZZLE — isolated Preview/DEV gesture prototype specification

Status: SPEC ONLY / IMPLEMENTATION NOT STARTED. Audited main: `0016222145c4c88253380d53d5df40607f58e655`. Authority: #579. Companion: `TETO_FINISH-DRIZZLE_579_Design-Gate_Draft.md`.

## Purpose
Validate whether drawing a sauce line is enjoyable and usable on iPhone without coupling the experiment to FINISH scoring, inventory, persistence, or recipes. This is a non-gameplay prototype; do not imply the applied sauce is saved or scored.

## Isolation boundary
- Use a new Preview/DEV-only entry, e.g. `?drizzleLab=on`, with explicit build-time gating analogous to `src/preview/freeFinishPreview.ts`. No production URL/query recognition or bundled production strings; add a production bundle gate test.
- Prefer a **standalone lab component** rather than modifying the shared `PizzaStage` event controller for the first slice. The existing `PizzaStage.tsx` contains shared PAINT, mayo squeeze, CUT, dough and other gesture handlers; integrating there prematurely risks regressions.
- No `GameState` action, `PLACE_TOPPING`, `COMMIT_SAUCE_DISPENSE`, `PizzaState` mutation, `pendingRound`, inventory debit, Dex, score, or save writes. Clear lab state on leave/reload. Use a mock pizza/dough surface and a clearly labeled non-scoring test material, not a newly invented ingredient ID.
- Do not update shared Preview or enable any production flag without Owner GO.

## Gesture contract
1. Pointerdown inside dough starts a pending stroke and captures that pointer; another pointer does not commit.
2. Pointermove adds clamped points only inside dough. Show continuous visual feedback with bounded point count and distance resampling; no allocation or rendering storm on 60/120Hz devices.
3. Pointerup commits a **visual-only** stroke; pointercancel, lost capture, leaving lab, or ingredient mode change discards the pending stroke. No ghost click or duplicate tap commit.
4. A tap (short movement) makes a short deterministic line segment, **not a dot**, so tap and stroke communicate the same technique. This is a proposal to test, not an Owner-approved gameplay rule.
5. Provide a visible reset button and a clear '試作・保存されません' label; respect reduced motion.
6. Keep interaction inside the dough and avoid Safari back-swipe/scroll gestures; avoid disabling scrolling on the entire document.

## Visual and HV contract
- Responsive 390x844 and 360x800 without scrolling the primary interaction off-screen; separately test short viewport 390x664 / 360x640.
- Draw a sauce trail with stable contrast against baked cheese and dough. A/B compare short stroke, curved stroke, repeated taps, edge-of-dough, and one-handed thumb reach.
- Record touch-only video after implementation and test Safari toolbar expanded/collapsed, pointercancel, edge gestures, double-tap, and low FPS.
- User-facing questions: Is the line understandable? Is the tap fallback useful? Is there accidental browser navigation? Is the gesture tiring? Is it more fun than ordinary placement?
- Automated tests: production bundle gate, opt-in query exact-once, no reducer dispatch/save call, pointercancel/ghost click, geometry clamp, two viewports.

## Implementation Gate
No source changes until Owner approves an isolated lab implementation. This spec does not authorize shared Preview update, gameplay feature wiring, new sauce item, scoring, save migration, PR merge, or Production ON.

## Dependencies / non-goals
- Full gameplay remains blocked on phase-tagged liquid model, idempotent stock consumption, journal compatibility and phase-aware signature/Reference scoring (see companion design gate).
- Do not alter Steam S3 PR #738 or #394 CI/E2E diagnostics.
