# #579 DRIZZLE Gesture Lab — Implementation Result (Preview / DEV only prototype)

Status: **PR open, pending Owner review. NOT merged. Shared Preview NOT updated. Production NOT enabled.**
Base: `main` `0016222145c4c88253380d53d5df40607f58e655`. Authority: Issue #579 comment of 2026-11-04 (implementation slice authorised for preparation).
Specs: `docs/reports/TETO_FINISH-DRIZZLE_579_Design-Gate_Draft.md`, `docs/reports/TETO_FINISH-DRIZZLE_579_Gesture-Lab_Spec.md` (branch `claude/drizzle-579-design-gate-20261104`, `db201c58`; read, not modified).

## 1. What was built

A standalone `?drizzleLab=on` screen: a mock baked pizza, a finger-drawn sauce line and a tap fallback (a short deterministic slanted line, never a dot). Labelled **「試作・保存されません」**, with a 44px reset button and a stroke counter.

| File | Role |
|---|---|
| `src/preview/drizzleLab.ts` | opt-in (exactly once, `on`), pure geometry + pure stroke state machine (no React, no game imports) |
| `src/preview/DrizzleLab.tsx` + `drizzleLab.css` | the screen; pointer events on its own SVG; imports nothing from the game |
| `src/main.tsx` | one static-gated branch (`DEV \|\| VITE_PREVIEW_MODE`) that lazily imports the lab and renders it *instead of* `<App />`; the HV seed / disposable-save entries are skipped for it |

Gesture contract implemented: pointerdown inside the dough starts a pending stroke and captures the pointer; a second pointer is ignored; moves are clamped to the dough edge and distance-resampled (min 1.4 units, 160 points/stroke, 24 strokes, oldest dropped); pointerup commits a visual-only stroke; pointercancel / lost capture / tab hidden / pagehide / unmount discards a pending stroke; tap (travel < 3 units) becomes the short line; no `click` handler exists, so no ghost click can add a stroke; `touch-action: none` is on the surface only; reduced motion disables the tap draw-in animation.

## 2. Isolation (what was NOT touched)

No change to: `PizzaStage` or any shared gesture controller, `gameReducer`, inventory, scoring, recipes, Dex, `pendingRound`, save schema, persistence, Steam #738, #394 CI/E2E diagnostics. `git diff main --stat` touches only `src/main.tsx` among existing files. No new ingredient id, no production flag.

Enforced by tests: source-level (the lab imports only `react` and its own model; no storage / dispatch / persist tokens), runtime (`Storage.prototype.setItem` is never called while drawing / leaving; e2e: the localStorage key set is identical before/after, a sentinel save is unchanged), and a **production bundle gate** (real in-memory `vite build`s): the production bundle and its CSS contain none of `drizzleLab`, the mark, the label, the title, the CSS class prefix or the surface test id; the Preview bundle contains all of them (positive control).

## 3. Verification (exact counts)

| Check | Result |
|---|---|
| `tsc -b` | clean |
| `npm run lint` (oxlint) | 0 errors; the warnings listed are pre-existing files, none in the new files |
| `npm run build` | passes |
| New vitest | **34 tests in 3 files** (`drizzleLab.test.ts` 17, `DrizzleLab.test.tsx` 15, `drizzleLab.gate.test.ts` 3 incl. 2 real builds), all pass |
| Full `vitest run` | see §4 |
| Playwright Chromium `e2e/drizzle-lab.spec.ts` | **8 tests x 2 projects (iphone-390x844, iphone-360x800) = 16 passed**; the four profiles 390x844 / 360x800 / 390x664 / 360x640 are each exercised in both (viewport set inside the test): no page scroll/overflow, surface and reset fully on screen, reset >= 44px, stroke + tap + second tap = exactly 3 lines (no duplicate), reset clears; edge clamp; pointercancel discard; off for `=1` / repeat / none; storage untouched + reload empties; `touch-action: none` on the surface only |
| Playwright **WebKit** | **NOT RUN**: this container has Chromium only (WebKit not installed). The spec is browser-neutral; the repo's CI WebKit job runs on PR and its result is reported below if it executes the spec |

Test config note: the container's Playwright expects a different Chromium revision than the installed one, so the E2E was run with an untracked local config that only sets `executablePath`; no repo config was changed.

## 4. Human Verification artefacts

- Screenshots (committed): `docs/reports/screenshots/drizzle-lab/` — 390x844 (drawn, after), 360x800, 390x664, 360x640, edge-of-dough. There is **no "before"**: the lab is a new screen; "before" is the unchanged app at the same URL without the query, which E2E asserts is unaffected.
- Video: 390x844 Chromium-emulated MP4 (drag, curved drag, two taps, edge-leaving drag, reset), delivered directly to the user, not committed.

## 5. Limitations / honest gaps

- **Emulation only.** Mouse-driven drags and `touchscreen.tap` in desktop Chromium. No iPhone Safari, no real touch pressure, toolbar expanded/collapsed, edge-swipe/back-gesture, double-tap or low-FPS behaviour has been observed. **iPhone real-device HV is the Owner's later step and is not claimed.**
- The tap line (16 units, -30 degrees) and sauce style (stroke 3.2, `#b3261e`) are proposals to test, not decisions. Observation for HV: the sauce red has weak contrast against the mock pepperoni; consider a halo / lighter sauce before judging "visibility".
- The mock baked surface is a drawn SVG, not the real baked cheese render, so contrast against real baked cheese is untested.
- Everything stays on HOLD for gameplay: phase-aware identity/scoring, atomic inventory, save-journal compatibility (see the Design Gate).
- A pending stroke is lost if the OS cancels the pointer (intended); no undo beyond reset.

## 6. Gate

Not merged; shared Preview and Production untouched; Owner approval required for merge, any Preview deploy, and any further slice. Codex review requested on the PR; CI state is reported on the PR.
