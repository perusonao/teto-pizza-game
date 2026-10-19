# Square-Pan Dough B2 — SquareDoughLayer, pointer wiring, E2E — Result

Issue #535 (B) under Epic #532, second of two PRs. **Depends on B1 (PR #545)**: this branch is stacked on `claude/square-dough-b1-spread-logic`; its PR targets that branch until B1 merges.
**Not merged, not deployed, shared Preview untouched.** Reachable only with `?pan=square` in Preview / DEV; production has no square-pan round, so nothing changes for players.

## What a player (in Preview) gets
`?pan=square&squareStart=lumpy` → the DOUGH step shows a square pan with a 16×16 sheet of dough (pale = thin, deep brown = thick).

| Gesture | What happens |
|---|---|
| **Tap** | A local push-in under the finger the instant it lands (a ring pulses at the brush size). |
| **Long press** (still ≥ 200 ms) | A continuing spread: the brush grows 11% → 22% over 700 ms while held; a dashed ring shows the reach and a small progress ring sits *above* the finger so a fingertip never hides it. |
| Finger moves > 10 px | The spread stops (nothing smears). The drag is C's (#536). |
| Release | The result is committed once (`COMMIT_SQUARE_DOUGH`) and stays. |
| pointercancel / lost capture / window blur / hidden tab / step change | The whole gesture is discarded. |
| Second finger | Ignored while one is down. |

Outline and corners never change (thickness only). 「次へ」 stays disabled for the square DOUGH step (completion is C's). The one-line readout under the pan says 「タップでおす・長おしでのばす」 (provisional wording, `data-status="SQUARE"`).

## Files
| File | Change |
|---|---|
| `src/components/SquareDoughLayer.tsx` (new) | The layer + its pointer handling. Events stop in the layer, so the round dough's handlers never see them. `touch-action: none`, no selection / callout / context menu. |
| `src/components/PizzaStage.tsx` | Additive: optional `squareDough` prop; renders the layer inside `.pizza-dough` for DOUGH, adds `pizza-dough--square-pan`, hides the round target ring there. Absent prop → identical to before. |
| `src/screens/GameScreen.tsx`, `src/App.tsx` | Optional `onSquareDoughCommit`; `squareDoughRound = activePanShape(recipe) === "square"`; 「次へ」 gated off for it; readout text. |
| `src/App.css` | One new block appended at the end (new classes only; no existing rule and no bake-filter rule edited). |
| `e2e/square-dough-b.spec.ts` (new) | 8 tests, Chromium and WebKit, 390×844 and 360×800. |

Round dough: the round path, its scoring and its progress are not changed (`squareDough` is `undefined` for every round recipe).

## E2E (hold lengths exact via Playwright's clock)
shows pan + 196 cells, 「次へ」 disabled, `touch-action: none`, no scroll · tap raises evenness and it persists after lift · hold keeps improving while held, more than the tap alone, ring visible, ring gone after release · drift past the slop stops spreading · `pointercancel` discards · blur discards · a second finger is ignored · no `?pan=square` → no square layer (round untouched).

## Human Verification (Owner, iPhone Safari)
Video (390×844) delivered directly to the Owner, not committed. Screenshots under `docs/reports/screenshots/square-dough-b2/`:
`01-before-lumpy` · `02-tap-ring` · `03-after-tap` · `04-hold-ring-0.7s` · `05-hold-ring-1.5s` · `06-after-hold` · `07-after-both`.
Measured evenness in the capture run (lumpy start 0.739): after one tap 0.743; hold 0.15 s 0.746, 0.7 s 0.752, 1.5 s 0.757 (on a different lump from the tap); all four lumps worked on → 0.773.

Every number (tap radius 11%, strength 0.9, hold start 200 ms, growth 700 ms, rate 2.2/s, slop 10 px, colours, ring offsets) is provisional and is tuned only after the Owner's iPhone Safari HV.

## Conflicts
#474 / #518: no PR; the `PizzaStage.tsx` edit is additive and does not touch the dough branch or bake-filter CSS. #540 and #527 untouched. #536 (C): no corner drag here.
