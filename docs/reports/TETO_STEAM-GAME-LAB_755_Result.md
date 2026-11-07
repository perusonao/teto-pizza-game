# #755 / #756 Steam Gameplay Lab (S5a logic + S5b Preview/DEV lab) — Result

Status: **draft, Preview/DEV only, Production OFF, FINISH/#738 untouched. Not merged, shared Preview not updated.** Emulation only; iPhone real-device HV is the Owner's step.

## What it is
`?steamGameLab=on` (exactly once) opens a standalone screen: put the lid on, choose 弱火 / 強火, read the shells / steam / flesh, 「ふたを開ける」 at the right time, 「やり直す」. Pure model: `src/logic/steam/steamGamePilot.ts` (S5a, PR #756). Lab: `src/preview/steamGameLab.ts`, `SteamGameLab.tsx`, `steamGameLab.css`. Nothing reads or writes the game (no reducer, inventory, score, recipe, Dex, pendingRound, save, storage).

Loop (provisional numbers, for the Owner to feel): low fire fills 0.11/s (all shells open ≈ 7.1 s, ~5.9 s of overcook headroom); high fire 0.20/s (≈ 3.9 s, only ~1.6 s headroom). Early lift → pale, closed shells; right time → plump orange flesh; kept on → brown, shrunken flesh, grey steam. Heat switching cannot add heat by itself (tested).

## Wiring is separate
`src/main.tsx` (HOT; #746 edits the same area) is touched only by one separate commit ("wire ?steamGameLab=on"). Everything else is new files. If it conflicts with #746, drop or re-apply that one commit; the lab itself needs no rebase.

## Verification (Chromium emulation, not iPhone Safari)
- tsc clean; lint 0 errors (no warning in the new files).
- vitest: pilot 14, lab model 13, component 7, bundle gate 2 (real `vite build`, production has none of the lab; Preview has it) — 395 tests across `src/preview` + `src/logic/steam`, all pass. Full vitest not re-run; CI will.
- Playwright Chromium `e2e/steam-game-lab.spec.ts` (390×844 project): 6 passed — one screen with no overflow and ≥44px buttons at 390×844 / 360×800 / 390×664 in idle, cooking and result; tooEarly / overcooked / justRight reachable; low fire slower than high; localStorage unchanged; off unless exact opt-in. WebKit not run here.
- Screenshots: `docs/reports/screenshots/steam-game-lab/`. Video (not committed): 390×844 H.264, 28 s, delivered to the Owner directly.

## Gaps
- Real iPhone feel (tap latency, ghost taps, toolbar) untested. Whether the loop is *fun* is the Owner's call; fire rates and windows are placeholders.
- The scene is a drawn SVG, not the game's pizza/glyph art.
