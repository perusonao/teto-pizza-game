# Issue #419 — Bake Human Feel: one-way bake (Result Report)

Status: implementation PR open, **awaiting Owner HV** (not merged). Base: main `8cb5d72`.
Decisions: Issue #419 comments "READ-ONLY 再監査 + Owner 判断依頼" (D-0..D-7) and "Owner 決定の記録".

## What changed

| Area | Change |
|---|---|
| `src/logic/bakeProgress.ts` (new) | The pure one-way clock: `BAKE_DURATION_S = 10` (provisional, Owner HV may retune — the only place to change it), `bakePositionAt`, `clampBakeFrameDt` (cap 0.1s/frame), BAKE-only zone fade constants (3s / 5s) and `computeBakeZoneOpacity`. |
| `src/components/BakeOverlay.tsx` | Needle position = f(elapsed active time): 0→100 in 10s, holds at 100, never reverses. The clock pauses on `visibilitychange` hidden and window `blur`, restarts from "now" on return, and one frame adds at most 0.1s. Only the target zone (with its raw/burnt flanks) is in a fading layer: 0–3s shown, 3–5s fade, removed from 5s. Track + needle always visible. Needle is one neutral colour, the caption is always the neutral line, the CTA glow is gone. No input lock. |
| `src/App.css` | `.bake-gauge__zones` layer, neutral needle colour, dead `.cta-button--glow` removed. |
| Tests | New `bakeProgress.test.ts`, rewritten `BakeOverlay.test.tsx`, new `e2e/bake-one-way.spec.ts`; the rAF needle drivers in `App.test.tsx`, `App.cookingTimingBackground.test.tsx`, `App.techniques.test.tsx`, `App.freeCookTrayPaging.test.tsx` and the e2e helpers (`gestures.ts` landing, speed 55 → 10, one-way landing; `cut-skip-failed-bake`, `dinner`, `layout-contract`, `gestures-helper` windows) were updated for the new speed. |

## Unchanged (diff-verified)

`gameReducer` / `CONFIRM_BAKE`, `src/logic/scoringV2/**`, `bake.ts` (`classifyBake`), `bakeVisual.ts`, `PizzaStage.tsx`, `bakeGuideFade.ts` (CUT's shared fade constants 3.6s / 7.2s), economy, save schema, Research, CUT.
`CONFIRM_BAKE` still receives the raw 0..100 needle position.

## Why the bake look cannot reverse

`PizzaStage` derives dough colour, cheese, toppings, char and sheen from `computeBakeHeat(liveBake)`, which is monotonic in the position; the position is now monotonic in time, so every bake visual is too (e2e asserts the char layer never decreases).

## Open items for the Owner

- D-7 (HV): at 5s the needle is at ~50%, before most windows (45–85) start, so the zone is gone before the player reaches it.
- `10s` is provisional (`BAKE_DURATION_S`).
- Known, pre-existing, not changed here: `PizzaStage` still applies the discrete `pizza-dough--raw/--perfect/--burnt` class (crust border colour and sauce-layer filter) from `classifyBake`, so there is a small visual step at the window boundary during BAKE. It was already present after M3A and is not a reversal, but it is a faint "you are in the window" tell. Removing it touches `PizzaStage` and the finished-pizza look, so it is left for an Owner decision (separate Issue if wanted).
- The Reference popover / global overlays are not a pause reason for BAKE (they were not before either); only hidden/blur pause the bake.

## Verification

- Unit: full vitest suite green after updating the rAF needle drivers (see PR for the final run); typecheck / oxlint clean on the touched files.
- e2e (local, Chromium 390×844 + layout-chromium, the 44 bake-touching specs): all pass; the multi-round `original-result-duplicate-notice.spec.ts` got a 120s budget because a bake is now a 10s run (it timed out at 30s on WebKit CI and locally). New `e2e/bake-one-way.spec.ts` passes on 390×844 and 360×800.
- Screenshots (before = main `8cb5d72`, after = this branch) at 390×844 and 360×800, taken 1s / 4s / 6.5s into BAKE and at RESULT: `docs/reports/screenshots/bake-human-feel-419/{before,after}/`.
- Human Verification video (390×844, delivered directly to the Owner, not committed): `issue-419-bake-human-feel-390x844.mp4`, H.264, 390×844, ~45.8s, ~0.8MB. Round 1 shows the full 10s bake (zone visible, fading at 3–5s, gone, needle only moving right, pizza browning), a take-out at ~7s, CUT and RESULT; round 2 lets the needle run to the right end, sit there while the pizza is burnt, then take out.

Video Verification: PASS
