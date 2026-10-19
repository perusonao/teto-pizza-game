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

## STEP 1 -> STEP 2 -> finished -> 次へ, measured on both phones (Chromium, mouse, real clock; casual play: four corner pulls, then wandering strokes until the screen says STEP 2, then taps with every third a 0.8 s hold on the darkest place; `scratchpad/measure3.cjs`)
| viewport / seed | STEP 1 (actions, time) | evenness when STEP 2 opens | STEP 2 (actions) | total (actions, time) | 次へ |
|---|---|---|---|---|---|
| 390x844 / 11 | 29, 5.7 s | 58.3 % | 3 | 32, 7.3 s | enabled at 60.4 %, tap -> SAUCE |
| 360x800 / 11 | 29, 5.7 s | 58.3 % | 4 | 33, 8.1 s | same |
| 390x844 / 29 | 16, 3.3 s | 44.8 % | **118** | 134, 40.2 s | same |
| 360x800 / 29 | 16, 3.3 s | 44.8 % | **111** | 127, 37.2 s | same |

The gauge answers within 16-24 ms of a lift; each gesture shows its real change (+0.1 .. +1.6, or 変化なし when it moved nothing). **Seed 29 is the slow case**: from 44.8 % the player's taps and holds move the evenness only +0.1..+0.8 points per action, and many do nothing visible (変化なし), so ~110 actions (~35 s) were needed to reach 60 %. The simulations (which know the true thickness) needed 24-27 moves, so the gap is partly the player (this script picks the darkest *drawn* colour, and the ball ramp is flat above 0.5) and partly the weak per-action effect of the unchanged B1 spread (HOLD_RATE_PER_S / strength, "E", on hold). Nothing was changed: see the open items.

STEP 2 mid-state images (evenness below 60 %, the gauge moving): `docs/reports/screenshots/square-dough-c/step2-{390x844,360x800}.png` = STEP 2 opens at 44.8 % -> a long press in progress (ring and reach circle, 50.8 %) -> after the lift (51.0 %, +1.6) -> finished (60.3 %, 次へ lit) -> after 次へ (the round moved on).

## Open items for the Owner
0. **STEP 2 can take ~110 actions (~35 s) for a casual player who reaches it at 44.8 %** (table above), against 3-4 actions at 58.3 %. Options, none applied: (a) a lower finish value (e.g. 50 %: the 44.8 % case needs ~25 actions); (b) a stronger tap / hold (E, on hold); (c) a colour ramp that shows thickness above 0.5 (ramp range only, no operation change) so a player can see where to press; (d) let STEP 2 start from a higher evenness by raising STEP 1's coverage bar. Measure first, decide with HV.
1. **The finish is too easy for a sweeping player** (above): a careful painter finishes before STEP 2 starts. A higher evenness value (0.80 is reachable after ~12 actions past the sweep) would make STEP 2 matter. Not changed without approval.
2. The Preview lumpy sheet (evenness 0.739) is already finished at the start (above 60 %), so it cannot show an unfinished STEP 2; making it lumpier is D (on hold).
3. The 見本 thumbnail and the ヒント text still describe a round pizza (#537 / hint system).
4. iOS Safari: drag feel and the SVG blur cost are Owner-HV items (no local WebKit; WebKit CI does not judge feel).

Screenshots: `docs/reports/screenshots/square-dough-c/flow-{390x844,360x800}.png` (start with hints, mid-drag trail, four corners, STEP 2, finished) and `step2-*.png` (above). After 次へ the SAUCE step still draws a round dough: the square pan in later steps is D2 (#537), not this PR.

## Balance pass (Owner GO after the iPhone HV of 167cbfb): operation balance (STEP A) and a smooth sheet (STEP B)
Owner-approved changes, nothing else moved: **mass conservation, corners 85 %, coverage 95 %, evenness 60 % unchanged.** The round pizza, the 60 recipes, F4-b, D2 and Grandma are untouched; the Preview lumpy start keeps B2's SVG look.

### STEP A -- the numbers behind it (model, 24 seeds of casual play; `docs` table below; time = 0.35 s aim per action + 0.8 s per hold + finger travel)
| | STEP 1 actions | finish 60 %: actions p50 / p90, time | 70 % | 80 % |
|---|---|---|---|---|
| 167cbfb | 29 | 44 / 58, 27 s | 132 / 172 | 0 of 24 |
| after (drag brush 16, thick-first donors, tap/hold E2) | 17 | **21 / 23, 13 s** | 33 / 40, 20 s | 11 of 24 |

Why the old balance was slow (measured): after STEP 1 the leftover lump of the ball (21-35 % of all the dough, 22-32 cells) carries 47-69 % of the unevenness and the old push moved 0-1.9 points per action; the old colour ramp showed nothing above 0.5, so the lump was invisible. And the evenness definition caps a perfectly flat sheet at `1 - sqrt((1-c)/c)` for coverage c: 0.771 at the 95 % bar, so **80 % is unreachable at a 95 % bar** (it needs 96.2 %); 60 % needs >= 86.2 %, 70 % >= 91.7 %.

Same scripted player, real browser (Chromium, mouse, wall-clock without aim time), before = 167cbfb, after = this HEAD:

| | complete (actions) | time to complete |
|---|---|---|
| before, 8 runs (390x844 seeds 11 29 3 7 13 17, 360x800 seeds 11 29) | 30, 33, 33, 48, 51, 51, 104, 112 | 7.0 - 37.9 s |
| after, same 8 runs | 14, 14, 15, 21, 22, 23, 23, 24 | 3.3 - 5.8 s |

(Add ~0.35 s of aiming per action for a person: 14-24 actions is ~8-15 s.) STEP 1 alone: 10-24 actions (before 16-38). A careful painter can still finish at STEP 1's last stroke (evenness is already above 60 %): that is the evenness value's choice, not changed.

### STEP A -- what changed (constants only, tests updated)
Drag brush 11 -> 16 %; donor weight ~ spare thickness squared (`DRAG_DONOR_POWER = 2`); tap push radius 11 -> 16, hold radius up to 34 (was 22), hold rate 4.0 per second (was 2.2); push strength 0.9, film 0.16 and donor decay 20 as before.

### STEP B -- the sheet
16x16 thicknesses are interpolated (bicubic, separable) to 128x128 and drawn on a `<canvas>` (scaled up smoothly by the browser), lit as a relief (light from the top left), with a **two-zone ramp**: the thin film 0.05-0.30 gets 60 % of the colour travel (dE ~3 per 0.02), the thick remnant 0.30-1.0 the other 40 % (dE ~3.4-4 per 0.1). The changed-cell marks are one soft merged shape (opacity on the group), not outlined squares. No SVG blur filter is used on this path. Fallbacks: no 2D context, a draw that throws -> SVG cells (B2's drawing); the page coming back (visibilitychange / pageshow / focus / resize / orientationchange / contextrestored) -> redrawn. The Preview lumpy start keeps B2's SVG look unchanged.

Frame times while dragging (headless Chromium, 60 Hz, 3 strokes x 40 moves): before p95 16.8 ms and after p95 16.8 ms at normal CPU; with the CPU throttled 6x, 2 frames over 33 ms before and 1 after. This says there is no regression in headless Chromium; iPhone Safari's own cost is an Owner-HV item.

### Preview/DEV diagnostics (`?diag=1`, never in production -- the production-bundle gate test passes)
Two lines on the panel: operations per step (tap / hold / drag) and the times (STEP 1, STEP 2, total to the finish) from the first finger down, counted per committed gesture.

Screenshots: `docs/reports/screenshots/square-dough-c-balance/{before,after}-{390x844,360x800}-seed29.png` (start, mid-drag, STEP 2 start, a long press in STEP 2, finished).
