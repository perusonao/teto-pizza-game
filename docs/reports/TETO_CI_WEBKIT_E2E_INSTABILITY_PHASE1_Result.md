# #394 Phase 1 — WebKit cooking E2E instability: E2E helper state sync (Result)

- Base SHA: `8f6e68ea854d6eb5a7129cd6abb876ad3834b2f5` (main, #390; #392 not included)
- Scope: `e2e/` helper + test only. Production files changed = **0**. Config / workflow changed = **0**.
- Not done (Owner Decisions): timeout increase, retries, skip, WebKit Gate relaxation, #392 change, full shard rerun, merge.
- Human Verification video / screenshots: not required (no production UI/UX/gameplay change).

## Root cause / hypothesis (code audit + deterministic reproduction; no real-CI artifact was available)

A and B are separate mechanisms and are fixed separately.

**A. `bakeToTarget` / `landNeedleAndTakeOut`** — the landing was planned from `.bake-gauge__needle`'s
`style.left`, read after a fixed `waitForTimeout(50)`. That style is written by a React render
(Scheduler `MessageChannel` task), while 取り出す！ scores `BakeOverlay`'s `positionRef`. On a slow
runner the committed style is stale, so the start position and the direction probe
(`next >= position`, equal => "up") are wrong, and the needle lands off the band. No post-condition
checked the landing. Symptom matches run 527 ("生焼け") and candidate C.

**B. `doughBox` / `paintSauceRing`** — `locator.boundingBox()` does not auto-wait and was read once
(null => `Pizza dough missing`, the exact message of evidence B). Separately, `PizzaStage`'s
pointerdown silently drops presses when the dough is not `interactive`, or is covered, and the
helper never checked either. The real-CI cause of the null box is still unconfirmed (see below).

## Fix

- A: `landNeedleAndTakeOut` is now a closed loop: flush React's commit (a `MessageChannel` round
  trip, twice — `page.clock` does not fake `MessageChannel`) -> read committed position ->
  `runFor` -> flush -> read -> **verify inside `target`** (widened to >= 1.5 pt each side of its
  center for single-point targets) -> only then click 取り出す！. A miss re-plans from the real
  position; max 5 attempts, then an explicit error listing the committed positions.
  `waitForTimeout(50)` removed. The `pauseAt` buffer retry is unchanged.
- B: new `waitForDoughReady` (used by `doughBox`): `.pizza-dough--interactive` visible, then
  `hover()` (Playwright actionability: stable + receives events at the center), then a usable
  `boundingBox()`. No sleep, no timeout change.
- Not unified into one helper; the only shared idea is "wait on a state signal".

## Spike (Step 1)

With `page.clock` installed and paused: `MessageChannel` is native and not faked; a flush resolves
under the paused clock; with React commits delayed, the immediate read was one step stale while
flush/flush/late reads were identical (15/15 steps). Premise holds; no production hook needed.

## RED -> GREEN (`e2e/gestures-helper.spec.ts`, Chromium 390×844)

Delays are injected by test-only init scripts (real `setTimeout` captured before the fake clock),
so they do not depend on runner speed.

| Test | Old helper | New helper |
|---|---|---|
| bake landing, commit 250ms late, parked after 2500ms (descending) | RED: 焼き加減 生焼け | GREEN |
| bake landing, commit 250ms late, parked after 3300ms (descending) | RED: 焼き加減 生焼け | GREEN |
| bake landing, commit 250ms late, parked after 1200ms (ascending) | green (control) | GREEN |
| `paintSauceRing`, dough `display:none` for 1500ms | RED: `Pizza dough missing` | GREEN |
| `paintSauceRing`, dough covered for 1500ms | RED: no sauce registered | GREEN |
| `paintSauceRing`, dough non-interactive (見本 popover, click-through backdrop) for 1500ms | RED: no sauce registered | GREEN |

New spec also GREEN on 360×800 (12/12 across both viewports).

## Verification

- Focused (Chromium iphone-390x844 / iphone-360x800 / layout-chromium, 2 workers):
  `discovery3-oracle-neutralization`, `expansion2-wave2`, `result-1screen-2.0`,
  `finished-pizza-visual-2.0`, `cut-skip-failed-bake`, `pizza-cutting-phase4b`, `layout-contract`:
  **57 passed, 3 skipped, 0 failed** (skips are the specs' own `runOnlyOnWidth`).
- **Targeted WebKit: NOT RUN — not executable here.** `/opt/pw-browsers/webkit-2215` does not exist
  in this environment; per Owner Decision no install / network workaround / config change was
  attempted. WebKit remains unverified; the planned `--repeat-each=20` on webkit-390x844 /
  webkit-360x800 for the new spec and the specs above still needs to run (CI or a WebKit-capable env).
- Chromium CPU 10x throttle (`Emulation.setCPUThrottlingRate`, ad-hoc throwaway spec, not
  committed; margherita 60–80, n=10 each, 390×844). This is **not** WebKit evidence:
  - old helper: 4/10 UNDER (生焼け), 6/10 PERFECT
  - new helper: 0/10 UNDER/OVER, 10/10 PERFECT

## Remaining uncertainty

- No WebKit run; whether this removes the real WebKit flake rate is unproven.
- B's real-CI null-box cause (evidence B, pre-#390 `result-1screen-2.0:109`) is not identified;
  the readiness wait covers the plausible mechanisms but the pre-#390 case also had a 60s timeout.
- Evidence A (`discovery3-no27-pesto-pollo` `.result-panel--discovery` not found) and C
  (`finished-pizza-visual-2.0` sepia) are only addressed insofar as they depend on bake landing.
- `doughBox` now waits for `.pizza-dough--interactive`; any spec that intentionally taps a
  non-interactive dough would now wait instead of failing fast (none found; 57 Chromium tests pass).
- Sample sizes are small; the #390-after-bias in shard 1 is not explained by this change.

## #392 impact / #394 status

- #392 untouched; this branch does not include it. No overlap (`e2e/gestures.ts` was unchanged by #392).
- Recommendation: keep #394 **open** until the targeted WebKit repeat-each (and a few CI runs of
  webkit-360x800 shard 1/2) are green; then close or re-assess B's root cause.

## Changed files

- `e2e/gestures.ts`
- `e2e/gestures-helper.spec.ts` (new)
- `docs/reports/TETO_CI_WEBKIT_E2E_INSTABILITY_PHASE1_Result.md` (new)
