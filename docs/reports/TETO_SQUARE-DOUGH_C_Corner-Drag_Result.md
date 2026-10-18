# Square Dough C — corner drag, STEP 1/2, completion (#536 / Epic #532)

Preview/DEV only (`?pan=square`); production has no square round. Round pizza, scoring, Pitz and Reference are untouched. Owner decisions applied: Q1 A (STEP 1 「四隅まで伸ばす」 -> STEP 2 「厚みを整える」), Q2 mass-conserving drag, Q3 85 % corner threshold kept and a provisional evenness value, Q4 re-editing until 「次へ」, Q5 drag-primary STEP 1 / tap-and-hold-primary STEP 2, and the six approvals of the C plan.

## Rules (all constants isolated; Owner HV adjusts values only)
| Item | Rule | Where |
|---|---|---|
| Corner reached | reach >= 85 % (`CORNER_REACH_THRESHOLD`, A, unchanged) | squareDough.ts |
| STEP 1 done (-> STEP 2) | 4/4 corners AND coverage >= 95 % (`SQUARE_STEP1_COVERAGE_MIN`) | squareDoughProgress.ts |
| Finished (次へ available) | STEP 1 done AND evenness >= 60 % (`SQUARE_COMPLETE_EVENNESS_MIN`, initial value) | squareDoughProgress.ts |
| Display = judgement | the gauge goal is that constant; "reached" is judged on the number as printed (0.1 %) | gauge, progress |
| Step | derived from the dough, never stored: cannot be skipped; coverage and corner reach never decrease (fuzz), so no way back | squareDoughProgress.ts |
| Re-edit | allowed until 「次へ」 (which unmounts the layer and fixes the shape); 次へ follows the live finish | GameScreen |
| Drag model | brush 11 %, film 0.16, donor decay 20; total thickness conserved (error < 1e-9), no covered cell ever uncovered | squareDoughDrag.ts |
| Gesture | STEP 1: movement > 10 px = drag. STEP 2: 24 px, or 16 px within 200 ms = drag; a hold that moves 24 px becomes a drag. A drag reverts the speculative tap (kept if a hold had already spread the dough): never a press and a drag on one stroke | pressGesture.ts |
| Colours | production start has its own ramp (0.05..0.5); the Preview lumpy start keeps B2's ramp | squareDoughView.ts |

## Numbers measured (Chromium, mouse; `scratchpad/measure.cjs`)
- Scripted serpentine sweep (7 strokes + 4 corner pulls) from the ball: 4/4 corners after action 4 (1.5 s), STEP 2 after action 11 (2.9 s, coverage 100 %), evenness already 0.76 -> **finished at action 11 (~3 s) with no STEP 2 action**. Extra holds then raise 0.76 -> 0.77 / 0.79 / 0.80 / 0.81 / 0.82 after 1 / 3 / 6 / 12 / 24 actions.
- Greedy edge pulls then flattening (unit test, deterministic): STEP 1 done, then finished, within 60 moves (simulation: 24 / 27 moves).
- Casual random play (simulation, 60 runs): evenness median 0.41 after 40 actions, 0.77 after 80.
- Gauge reaction: the note appears 16-24 ms after the finger lifts.
- Misoperation guards (unit-tested): a 3-4 px tremble stays a tap; 10-24 px wander in STEP 2 stays a stopped press; a drag after a 700 ms hold keeps the hold; no tap is applied twice.

## Open items for the Owner
1. **The finish is too easy for a sweeping player** (above): a careful painter finishes before STEP 2 starts. A higher evenness value (0.80 is reachable after ~12 actions past the sweep) would make STEP 2 matter. Not changed without approval.
2. The Preview lumpy sheet (evenness 0.739) is already finished at the start (above 60 %), so it cannot show an unfinished STEP 2; making it lumpier is D (on hold).
3. The 見本 thumbnail and the ヒント text still describe a round pizza (#537 / hint system).
4. iOS Safari: drag feel and the SVG blur cost are Owner-HV items (no local WebKit; WebKit CI does not judge feel).

Screenshots: `docs/reports/screenshots/square-dough-c/flow-{390x844,360x800}.png` (start with hints, mid-drag trail, four corners, STEP 2, finished).
