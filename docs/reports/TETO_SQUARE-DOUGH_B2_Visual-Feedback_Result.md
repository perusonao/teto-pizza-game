# Square Dough B2 — visual feedback (A+B+C) Result

PR #546 / Issue #535. Cause (Owner iPhone Safari diagnostics): input reaches the layer and the reducer accepts it; the per-gesture
visual change was below the perceptual threshold. Only *how* the same numbers are shown changed. D (lumpy data) and E (HOLD_RATE_PER_S,
operation strength) are on hold and untouched. B1 logic, thickness data and the round pizza are untouched.

## What changed
- **A smoothness gauge** (なめらか度, `SquareDoughGauge`): shows the real `squareDoughEvenness` of the dough on screen (equals the layer's
  `data-evenness`), with the real per-gesture change (`+0.2`) or `変化なし`. No fake progress: a press that changes nothing shows no tick.
- **B highlight**: only cells whose thickness really changed (|Δ| > 0.002) are outlined, shown from the moment the finger lifts and
  fading out in 0.5 s; `pointer-events: none`, non-obstructive.
- **C colour**: thickness ramp stretched over the range a sheet really uses (0.3–0.9), cream → dough tan → golden brown (R>G>B always);
  grid softened (faint blur, clipped to the pan).

## Measurements (lumpy Preview sheet, before = d466166)
| metric | before | after |
|---|---|---|
| ΔE76 at the most-changed cell, one tap | 7.1 | 12.3 |
| area with ΔE ≥ 5, six taps | 2.37 % | 5.41 % |
| max ΔE, one hold | 14.9 | 26.5 |
| sheet ΔE p95 | 22.6 | 37.5 |
| edge step / contrast ratio (grid conspicuousness) | 0.129 | 0.077 |
| ΔE per 0.1 thickness | ≈ 5.8 | ≥ 8 (unit test) |
| evenness after tap / six taps / hold | 0.741 / 0.755 / 0.767 | identical (operation unchanged) |

Gauge 0.767 == layer `data-evenness`. First tap highlights 9 cells = exactly the changed cells. Gauge box 24 px high at y654 (390×844)
and y610 (360×800), inside the viewport, no scroll, no overlap with 次へ.

Screenshots: `docs/reports/screenshots/square-dough-b2-visual/montage-*.png` (left = before, right = after).

## Not verified
- iOS Safari performance of the SVG blur filter during a hold, and WebKit rendering: no local WebKit; the WebKit CI cannot judge visuals.
- Final acceptance is the Owner's iPhone Safari HV (currently FAIL, maintained).
