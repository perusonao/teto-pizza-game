# Issue #419 — Bake Human Feel: one-way bake (Result Report)

Status: implementation PR open, **awaiting Owner HV** (not merged). Base: main `8cb5d72`.
Decisions: Issue #419 comments "READ-ONLY 再監査 + Owner 判断依頼" (D-0..D-7) and "Owner 決定の記録".

## What changed

| Area | Change |
|---|---|
| `src/logic/bakeProgress.ts` (new) | The pure one-way clock: `BAKE_DURATION_S` (provisional, Owner HV retunes it — the only place to change it; **10s in `92db3d9`, 7s in `3e22563`, 5s in the current comparison candidate below**), `bakePositionAt`, `clampBakeFrameDt` (cap 0.1s/frame), BAKE-only zone fade constants and `computeBakeZoneOpacity`. |
| `src/components/BakeOverlay.tsx` | Needle position = f(elapsed active time): 0→100 in 10s, holds at 100, never reverses. The clock pauses on `visibilitychange` hidden and window `blur`, restarts from "now" on return, and one frame adds at most 0.1s. Only the target zone (with its raw/burnt flanks) is in a fading layer: 0–3s shown, 3–5s fade, removed from 5s. Track + needle always visible. Needle is one neutral colour, the caption is always the neutral line, the CTA glow is gone. No input lock. |
| `src/App.css` | `.bake-gauge__zones` layer, neutral needle colour, dead `.cta-button--glow` removed. |
| Tests | New `bakeProgress.test.ts`, rewritten `BakeOverlay.test.tsx`, new `e2e/bake-one-way.spec.ts`; the rAF needle drivers in `App.test.tsx`, `App.cookingTimingBackground.test.tsx`, `App.techniques.test.tsx`, `App.freeCookTrayPaging.test.tsx` and the e2e helpers (`gestures.ts` landing, speed 55 → 10, one-way landing; `cut-skip-failed-bake`, `dinner`, `layout-contract`, `gestures-helper` windows) were updated for the new speed. |

## Unchanged (diff-verified)

`gameReducer` / `CONFIRM_BAKE`, `src/logic/scoringV2/**`, `bake.ts` (`classifyBake`), `bakeVisual.ts`, `PizzaStage.tsx`, `bakeGuideFade.ts` (CUT's shared fade constants 3.6s / 7.2s), economy, save schema, Research, CUT.
`CONFIRM_BAKE` still receives the raw 0..100 needle position.

## Why the bake look cannot reverse

`PizzaStage` derives dough colour, cheese, toppings, char and sheen from `computeBakeHeat(liveBake)`, which is monotonic in the position; the position is now monotonic in time, so every bake visual is too (e2e asserts the char layer never decreases).

## Open items for the Owner

- D-7 (HV): the zone is gone while the needle is still at ~50% (before most windows, 45–85, start) in both versions.
- Duration is provisional (`BAKE_DURATION_S`). Owner HV on the iPhone found 10s "long overall" and then 7s still long; **5s is the current comparison candidate, not a decision** (see "5s comparison candidate" below).
- Known, pre-existing, not changed here: `PizzaStage` still applies the discrete `pizza-dough--raw/--perfect/--burnt` class (crust border colour and sauce-layer filter) from `classifyBake`, so there is a small visual step at the window boundary during BAKE. It was already present after M3A and is not a reversal, but it is a faint "you are in the window" tell. Removing it touches `PizzaStage` and the finished-pizza look, so it is left for an Owner decision (separate Issue if wanted).
- The Reference popover / global overlays are not a pause reason for BAKE (they were not before either); only hidden/blur pause the bake.

## Verification

- Unit: full vitest suite green after updating the rAF needle drivers (see PR for the final run); typecheck / oxlint clean on the touched files.
- e2e (local, Chromium 390×844 + layout-chromium, the 44 bake-touching specs): all pass; the multi-round `original-result-duplicate-notice.spec.ts` got a 120s budget because a bake is now a 10s run (it timed out at 30s on WebKit CI and locally). New `e2e/bake-one-way.spec.ts` passes on 390×844 and 360×800.
- Screenshots (before = main `8cb5d72`, after = this branch) at 390×844 and 360×800, taken 1s / 4s / 6.5s into BAKE and at RESULT: `docs/reports/screenshots/bake-human-feel-419/{before,after}/`.
- Human Verification video (390×844, delivered directly to the Owner, not committed): `issue-419-bake-human-feel-390x844.mp4`, H.264, 390×844, ~45.8s, ~0.8MB. Round 1 shows the full 10s bake (zone visible, fading at 3–5s, gone, needle only moving right, pizza browning), a take-out at ~7s, CUT and RESULT; round 2 lets the needle run to the right end, sit there while the pizza is burnt, then take out.

Video Verification: PASS

## 7s comparison candidate (follow-up to Owner HV feedback)

Owner comment on PR #466 (2026-10-11) asked for a 7s version on this branch for iPhone comparison; it is **not** an approval of 10s or of 7s and not a merge approval.

- `BAKE_DURATION_S` 10 → 7 (0→100, one-way, stops at the right end). Zone fade scaled to 0–2s shown / 2–3.5s fade / hidden from 3.5s (needle and track stay).
- Unchanged: neutral needle colour and caption, no CTA glow, hidden/blur pause, 0.1s frame cap, no input lock; CUT's shared fade constants, `CONFIRM_BAKE`, Scoring 2.0, economy, save, Research.
- Tests and e2e helpers now derive from `src/logic/bakeProgress.ts` (speed, duration, fade) instead of hard-coded 10s/55%/s numbers, so the next retune is a one-constant change.
- Rollback to the 10s version = reset the three constants (`BAKE_DURATION_S = 10`, fade 3 / 5) or use HEAD `92db3d9`.

## 5s comparison candidate (follow-up to Owner HV on the 7s version)

Owner iPhone HV on the 7s version (2026-10-11): bake time **too long** (needs improvement); gauge movement **PASS**; operation after the bake **PASS**; the target zone **may disappear earlier**. This is a comparison candidate, **not a final specification and not a merge approval**.

- `src/logic/bakeProgress.ts`: `BAKE_DURATION_S` 7 → **5**; `BAKE_ZONE_FADE_START_S` 2 → **1**, `BAKE_ZONE_FADE_END_S` 3.5 → **2** (target zone shown 0-1s, fades 1-2s, hidden from 2s; needle and track stay). That is the whole behaviour change (3 constants).
- Unchanged: the one-way gauge, the neutral needle colour and caption, no CTA glow, hidden/blur pause (a hidden tab or a blurred window stops the clock and it restarts from "now"), the 0.1s per-frame cap, no input lock; `CONFIRM_BAKE`, Scoring 2.0 (`classifyBake`), CUT (and its shared fade constants 3.6s / 7.2s), economy, save, Research, the operation after the bake.
- Needle speed is now 20 pt/s (was 14.3). At the moment the zone is gone (2s) the needle is at 40%, before most target windows start.
- Time-dependent tests updated: `bakeProgress.test.ts` (5s / 1s / 2s pinned, fade 1.5s = 0.5), `BakeOverlay.test.tsx` (titles, half duration 2.5s, 1.5s mid-fade, zone gone at 2.2s, 3s = 60%), `e2e/bake-one-way.spec.ts` (every sample time derived from the constants, so the next retune is a constant change), `e2e/gestures-helper.spec.ts` (needle parking 800 / 1500 / 2400 ms = 16 / 30 / 48, still short of the 60-80 window), `e2e/layout-contract.spec.ts` (`AFTER_GUIDE_FADE_MS` 3.7s -> 2.7s, needle ~54%). The pause tests and the other App-level needle drivers are duration-agnostic and needed no change.
- Rollback to 7s = reset the three constants (`BAKE_DURATION_S = 7`, fade 2 / 3.5) or use HEAD `3e22563`; to 10s: HEAD `92db3d9`.
- The before/after screenshots and the HV video above are from the 10s version; no new HV video or screenshot set was made for the 5s candidate (the Preview is awaiting Owner approval).
