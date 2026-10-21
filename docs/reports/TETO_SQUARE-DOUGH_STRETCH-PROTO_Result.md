# Square dough — push-stretch prototype (Preview / DEV only) — Result

Base: `main` `8fc56e0` (independent of PR #581, which stays on HOLD and is not touched). Branch `claude/teto-pizza-square-ux-ptvmd0`.
Follows the Fresh Audit after PR #581's iPhone HV **FAIL** and the Owner's direction 1-6. **iPhone HV not done. Nothing deployed.**

## What was built (flag default OFF)

| | |
|---|---|
| Switch | `?pan=square&squareModel=stretch` (Preview / DEV only). `&squareOk=75` or `85` sets STEP 2's OK-rate target (default 75; **undecided**). Any other value: the current model. |
| Model | `src/logic/pan/squareStretch.ts` (same 16x16 `SquareDough`; no save / round-pizza change) |
| Dispatch | three static `DEV \|\| VITE_PREVIEW_MODE` guards: `squareDoughProgress`, `squareStepGoals`, `applyGestureEffects` (drag). Production bundle keeps none of it (real-build gate `squareModelPreview.gate.test.ts`). |
| UI | `SquareStretchMarks` (STEP 2 overlay), gauge label 「ととのい度」, guide wording (STEP 1 「生地をひろげる」 / STEP 2 「赤い所は押して、青い所は厚い方から伸ばそう」) — all prototype-only |
| Player | `squareStretchPlayer.ts`: a "smart player" used by the simulation and the E2E (not imported by the app) |

Unchanged: tap / hold press (`relaxAt`), the current drag and judgement (flag off), save format, round pizza, scoring.

## Model (Owner points 1-4)

- **Stretch, not film-laying.** A film is laid only on cells connected (8-neighbourhood) to dough already >= 0.09 thick. A stroke that starts farther than the brush from any dough changes nothing; grabbing the edge of the dough and pulling is allowed (point 5). Direction (ahead of the finger full, behind up to 25 % thinner), distance from the lump (film up to 30 % thinner at the far corner) and the start point matter. Mass is conserved exactly like the current drag.
- **What counts as dough.** Corners and coverage are measured on the connected *body* (cells >= 0.09 joined to the thickest cell). A detached or paper-thin film counts for nothing. STEP 1 = four corners + body coverage >= 90 %.
- **STEP 2 = per-cell state.** Target = total mass / on-pan cells (what the dough can give). Each cell is thin (< 0.7 target, bare cells included), thick (> 1.4 target) or OK. Done when the OK share reaches 75 % (or 85 %). THICK is pressed (tap / hold), THIN is stretched in from a thick neighbour. The screen tints thick red, thin blue, OK nothing, plus up to two arrows into thin patches.

Initial values (all for iPhone HV): brush radius 18, film 0.16, taper 0.3, direction 0.25, solid 0.09, thin 0.7, thick 1.4, coverage 0.9.

## Simulation: current vs prototype (`squareStretch.sim.test.ts`, greedy "smart player")

Same openings in both models. A = centre to the four corners, B = full zigzag, C = diagonals, D = cross + ring.

| | current | prototype |
|---|---|---|
| STEP 2 already done when STEP 1 ends | **yes, in all four** (even 68-93 % vs goal 60 %) | **no, in all four** (OK rate 43-68 % vs goal 75 %) |
| A from outside the dough | dough appears from nothing | nothing happens |
| STEP 1 strokes (opening + player) | A 4 + arrows | A 13, B 8, C 14, D 6 |
| STEP 2 operations at **75 %** | 0 | A 17, B 4, C 13, D 5 (target 5-15: 3 of 4 inside; A is above) |
| STEP 2 operations at **85 %** | 0 | A 24+, B 11+, C 19+, D 12+: **none finishes** — the player stalls at 84 % |

So 85 % is out of reach for this player with these operations (the thin rim cannot be raised by pressing alone). **75 % is the workable setting; 85 % needs a stronger STEP 2 operation if the Owner wants it.** Real-browser runs (390x844, opening B): 75 % = 3 operations, 85 % = 8 operations then stuck at 83.7 %.
Sweeps and the parameter search are in `artifacts/square-dough-redesign/` (local, not committed).

## Verification points A-F

| | result |
|---|---|
| A natural from centre to corners | Partly. A stroke now pulls a band of dough that stays connected to the lump and follows the finger; nothing appears from nowhere. It still lays a uniform film along the path rather than pushing a mass ahead of the finger, and a centre-to-corner stroke leaves an X-shaped arm. **Needs the Owner's iPhone feel.** |
| B continuity, mass | Pinned by test: one connected piece through every opening, total conserved (unit: to 1e-9; E2E: within the 3-decimal print). |
| C STEP 1 -> STEP 2 | STEP 2 opens with work left in all four openings (OK rate 43-68 %); the E2E asserts `data-complete=false` on arrival and 「次へ」 disabled. |
| D thick / thin / OK | E2E asserts all three kinds are present and the red / blue tint count equals thick + thin; fine cells are left unmarked. |
| E 75 vs 85 | table above |
| F 390x844 / 360x800 | E2E asserts no scroll, steps / gauge / next line / layer inside the screen and 「次へ」 inside the screen, at STEP 1, STEP 2 and complete (screenshots below). |

Screenshots (committed): `docs/reports/screenshots/square-stretch-proto/` (both viewports: start, four corners with STEP 1 open, STEP 2 opens, STEP 2 complete). Videos (local, **not committed**, delivered to the Owner directly): `artifacts/stretch-proto-hv/`.

## Known limits / open items

- The prototype is Chromium-recorded and simulated; it is **not** iPhone HV evidence.
- STEP 1 takes 6-14 strokes for the smart player (the current model: 4 + arrows). Whether that feels right needs HV.
- A (centre-to-corner) opening needs 17 STEP 2 operations — above the 5-15 target.
- 85 % is not reachable by the simulated player.
- The corner ticks are still the filled green of the current UI while STEP 1 is open (PR #581's outline-ring change is not in this work).
- Files this work shares with PR #581: `SquareDoughLayer.tsx`, `SquareDoughGuide.tsx` (small, separate hunks). Whichever merges second rebases.

## Decisions needed

1. 75 % or 85 % (and, for 85 %, a stronger STEP 2 operation).
2. Brush radius / taper / thin ratio after the iPhone feel.
3. Whether to go to iPhone HV (needs a Preview update approval).
