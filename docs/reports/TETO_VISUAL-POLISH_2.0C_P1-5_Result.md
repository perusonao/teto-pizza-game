# Teto Pizza Game — Visual Polish 2.0C / P1-5 Result Report

**Type:** Implementation (P1-5 Option B only). Scope-restricted per task brief: no Firebase/GCP/IAM,
`functions/**`, `firestore.rules`/`firestore.indexes.json`, production-deploy workflow, Player
Profile, ranking backend/query, `setDisplayName`, `submitLunchRushScore`, Recipe Select P1-4,
scoring calculation, CUT evaluation calculation, CUT reducer/state, Completion Gate, Pitz
calculation, economy/progression, or save schema was touched. Only the **display** of an
already-computed CUT evaluation result changed.

## 1. Audited base SHA

`35119d96bcf6784854700decaae5d1800b400cf2` — `docs: Visual Polish 2.0C Fresh Audit (#149)`,
confirmed via `git fetch origin` + `git rev-parse origin/main` at session start, matching the
task brief's expected SHA exactly. Working tree was clean before this session's own changes.

## 2. Duplicate Gate #1 (start of session)

- `git fetch origin` pulled ~150 branches; `origin/main` HEAD confirmed as `35119d96` above.
- **Open PRs** (`state:open`, 6 total): **#150** "docs: Phase 4b SUCCEEDED" (Firebase production
  deploy docs, out of scope, not touched); **#105** (Dev Automation A1, draft, unrelated);
  **#72** (docs status-sync, stale base); **#46** (Issue #33 Dough Shaping D0 audit, stale base,
  unrelated screen); **#34** (Issue #32 Phase 1 reference visuals, stale base, unrelated);
  **#3** (very old infra docs PR). **None of the 6 open PRs touch RESULT, CUT display, or any
  Visual Polish surface.**
- No open branch without a PR duplicated this scope either (the Fresh Audit's own branch,
  `claude/visual-polish-2.0c-audit-shyxxg`, already merged as #149; no other in-flight
  `result`/`cut`/`visual-polish` branch had an open PR).
- **Conclusion:** no duplicate work in flight. Proceeded on a fresh branch created from
  `origin/main` at `35119d96`.

## 3. Fresh Audit baseline numbers (before, from PR #149)

Six scenarios, real Chromium + real pointer gestures (dough stretch, sauce painting, cheese/
topping placement, real bake-needle timing, real CUT drags for margherita):

| Scenario | Viewport | `scrollHeight` | CTA row top/bottom | Fully visible? |
|---|---|---|---|---|
| マルゲリータ CUT, first discovery | 390×844 | 1121px | 959 / 1097 | No |
| マルゲリータ CUT, retry (no discovery) | 390×844 | 1024px | 862 / 1000 | No |
| フンギ no CUT, first discovery | 390×844 | 972px | 810 / 948 | No |
| マルゲリータ CUT, first discovery | 360×800 | 1102px | 939.8 / 1077.8 | No |
| マルゲリータ CUT, retry (no discovery) | 360×800 | 1005px | 842.8 / 980.8 | No |
| フンギ no CUT, first discovery | 360×800 | 953px | 790.8 / 928.8 | No |

The Fresh Audit ranked contributors and found the unconditionally-expanded CUT evaluation block
(`.cut-evaluation-summary`, margherita-only) the single largest lever, ~149–152px, recommending
Option B (collapse it behind `<details>`, mirroring the existing score-bars pattern) as the
first, lowest-risk implementation slice, with re-measurement before deciding whether Option A
(fixed CTA) is still needed.

## 4. Implementation

**P1-5 Option B**: the CUT evaluation block in `ResultPanel.tsx` changed from an always-expanded
`<div>` to a native `<details>`/`<summary>` disclosure, default closed, mirroring the
already-shipped `.result-panel__details`「くわしいスコアを見る」pattern on the same screen.

- The CUT total score (`✂️ カット <strong>{score}点</strong>`) stays on the always-visible
  `<summary>` line — the one number a player who just cut their pizza wants immediately, per the
  Fresh Audit's own Option B trade-off note.
- Slice count, the "※総合スコアとは別の評価です" disclaimer, and the 均等さ/中心/切り分け `<dl>`
  breakdown moved into the collapsed body — unchanged content, unchanged values, unchanged
  order.
- No CUT score/metric calculation touched — `Math.round(cutEvaluation.cutScore)`,
  `cutEvaluation.uniformity`, `.centerAccuracy`, `.completeness`, `.actualPieceCount`,
  `.requestedSliceCount` are read exactly as before, just relocated in JSX.
- No new JS state — native `<details>` open/close, same discipline as the existing score-bars
  disclosure (no `useState`, no click handler).
- No new magic numbers — reused the existing card's own `#eaf1fb`/`#2f5590`/`#1f3d66` colors and
  the existing `.result-panel__details-summary`'s arrow-toggle convention (`▾`/`▴` via
  `::after`/`[open]`), scoped under new `.cut-evaluation-summary__summary` selectors specific to
  this card's own blue palette (not literally reused wholesale, since the two cards use different
  base colors, but the same mechanism/markers).
- Summary copy: kept the exact existing headline text ("✂️ カット **{score}点**") rather than
  inventing new wording — it was already the established in-game phrasing for this screen and
  already reads correctly as a standalone tap target.

### Changed files

- `src/components/ResultPanel.tsx` — CUT evaluation block: `<div>` → `<details>`/`<summary>` +
  `<div className="cut-evaluation-summary__content">` wrapper for the collapsed body.
- `src/App.css` — `.cut-evaluation-summary` rules split into container/`__summary`
  (new, mirrors `.result-panel__details-summary`)/`__content` (new, collapsed-body flex
  wrapper)/existing `__slices`/`__note`/`__details`/`__row` rules (untouched).
- `src/components/ResultPanel.test.tsx` — added focused regression tests (§5 below).
- `docs/reports/screenshots/visual-polish-2.0c-p1-5/{390x844,360x800}/` — after screenshots (new).
- `docs/reports/TETO_VISUAL-POLISH_2.0C_P1-5_Result.md` — this report (new).

No `firestore.rules`/`firestore.indexes.json`/`functions/**`/GitHub Actions production-deploy
workflow/Player Profile/`setDisplayName`/`submitLunchRushScore`/ranking backend/Recipe Select
P1-4/scoring or CUT calculation/CUT reducer-state/Completion Gate/Pitz calculation/economy-
progression/save-schema file was read for editing or touched.

## 5. Tests

Added to `src/components/ResultPanel.test.tsx` (existing CUT/ResultPanel coverage reviewed
first — the pre-existing "renders the CUT evaluation summary...", "never shows raw technical
terms...", "shows the mismatch against the requested slice count...", "omits the CUT evaluation
summary..." tests were confirmed to still pass unchanged, since Testing Library's `getByText`
matches DOM text content regardless of a closed `<details>`'s CSS-hidden state):

- `renders the CUT evaluation as a native <details>, default closed, when a CUT round is
  present` — tag is `DETAILS`, no `open` attribute.
- `shows the CUT total score on the always-visible summary line` — summary text contains
  「カット」 and the score.
- `reveals all existing CUT detail rows once opened (real tap on the summary), none dropped` —
  `fireEvent.click` on the real `<summary>` element, then asserts `open` attribute present and
  every existing detail row (slices, disclaimer, 均等さ/中心/切り分け) is present.
- `passes CUT score/metric values through unchanged -- the disclosure only changes display, not
  calculation` — overridden `cutScore`/`uniformity`/`centerAccuracy`/`completeness` values
  (59/41/62/75) render verbatim after opening, proving the display change carries no calculation
  change.
- `keeps the primary retry CTAs present and wired alongside the CUT disclosure (no RESULT
  retry-flow regression)` — both CTA buttons present and their `onClick` handlers still fire with
  a CUT round rendered.
- (Existing, unchanged) `omits the CUT evaluation summary for a non-CUT recipe` /
  `omits the CUT evaluation summary when the prop is not passed at all` — disclosure element
  itself absent for non-CUT rounds.

`src/App.test.tsx`'s own real-walkthrough CUT test (`cutCard` assertions around line 755) was
re-checked and needed no change — it asserts on `cutCard.textContent`, which includes the
collapsed body's text regardless of open/closed state.

### Full test run (×2, per task instruction)

```
npm test -- --run
```

- **Run 1:** `Test Files  111 passed (111)` / `Tests  2076 passed (2076)` — 64.11s.
- **Run 2:** `Test Files  111 passed (111)` / `Tests  2076 passed (2076)` — 64.69s.

(2076 = the pre-existing suite + this session's 5 new focused tests.) The repeated
`Not implemented: HTMLCanvasElement's getContext()` lines are a pre-existing jsdom/canvas
environment warning unrelated to this change (unchanged from before this session).

### Static checks

- `npx tsc -b --noEmit` — clean, no output, no errors.
- `npm run lint` (`oxlint`) — clean, exit 0, no output.
- `npm run build` — succeeded (`tsc -b && vite build`, 1.15s). The only warning present
  (`Some chunks are larger than 500 kB after minification`) is the pre-existing bundle-size
  advisory, unrelated to and unchanged by this diff (same single-chunk bundle shape as before).

No new warnings from any of the three checks; the one pre-existing build warning is unaffected.

## 6. Browser / Human Feel verification (real Chromium, real pointer gestures)

Method: Playwright against the pre-installed Chromium (`/opt/pw-browsers`), mobile emulation
(`isMobile`, `hasTouch`, `deviceScaleFactor: 2`), `vite` dev server, fresh `localStorage.clear()`
+ reload, then the same three real playthroughs per viewport as the Fresh Audit (dough
stretch via 8 pointer taps around the drop target, real sauce-ring painting, real cheese/topping
taps, real bake-needle timing — confirmed by polling the rendered needle position rather than
stubbing `requestAnimationFrame`, so timing behaves exactly as a real player would experience it
— and, for margherita, three real CUT drags), matching `App.test.tsx`'s own interaction
patterns translated to real browser `PointerEvent`s dispatched against the real (unstubbed)
`getBoundingClientRect()` of the live drop target.

### 6 scenarios, before → after

| Scenario | Viewport | scrollHeight before→after | CTA bottom before→after | Δ | Fully visible? |
|---|---|---|---|---|---|
| マルゲリータ CUT, first discovery | 390×844 | 1121→**1009**px | 1097→**985** | **−112px** | No (985 vs 844, 141px over) |
| マルゲリータ CUT, retry | 390×844 | 1024→**912**px | 1000→**888** | **−112px** | No (888 vs 844, 44px over) |
| フンギ no CUT, first discovery | 390×844 | 972→**972**px | 948→**948** | 0 (expected — untouched) | No (948 vs 844, 104px over, unchanged) |
| マルゲリータ CUT, first discovery | 360×800 | 1102→**990**px | 1077.8→**965.8** | **−112px** | No (965.8 vs 800, 165.8px over) |
| マルゲリータ CUT, retry | 360×800 | 1005→**893**px | 980.8→**868.8** | **−112px** | No (868.8 vs 800, 68.8px over) |
| フンギ no CUT, first discovery | 360×800 | 953→**953**px | 928.8→**928.8** | 0 (expected — untouched) | No (928.8 vs 800, 128.8px over, unchanged) |

Every one of the 4 margherita (CUT) scenarios dropped by exactly **112px** — consistent,
viewport-independent, matching the fixed content height Option B removed from the default-open
state. Both フンギ (no-CUT) scenarios are numerically identical to the Fresh Audit's own before
numbers (972px/810–948 at 390×844, 953px/790.8–928.8 at 360×800) — expected and correct, since
Option B only ever touches the CUT block, which フンギ never renders; this also cross-validates
the playthrough script against the original audit (same inputs reproduce the same scores/
heights).

**No horizontal overflow, zero console errors, zero page errors** in any of the 6 scenarios
(checked via `document.documentElement.scrollWidth` vs. `window.innerWidth`, and Playwright
`console`/`pageerror` listeners across the full session).

### CUT disclosure Human Feel (real tap, both viewports)

For マルゲリータ CUT + first discovery (the scenario exercising the new disclosure):

- **Initial state:** closed (`<details>` has no `open` attribute) at both viewports.
- **Tap to open:** a real `click` on the `<summary>` element sets `open` — confirmed present
  immediately after the tap.
- **Detail readable once open:** 「6等分」「※総合スコアとは別の評価です」「均等さ」「中心」
  「切り分け」 and their numeric values all present and correct after opening (390×844:
  均等さ100/中心100/切り分け100; 360×800: 均等さ99/中心100/切り分け100 — small real-gesture
  variance between the two independent playthroughs, expected, not a defect).
- **Tap to close:** a second real tap on the same `<summary>` removes the `open` attribute again
  — confirmed closed.
- **CTA/other elements unaffected:** 「もう一度つくる」 CTA button still present and visible
  throughout open/close, at both taps.

Screenshots confirm the visual language (blue `.cut-evaluation-summary` card, ▾/▴ arrow toggle
matching the existing 「くわしいスコアを見る」▾/▴ convention) reads consistently with the rest
of RESULT.

## 7. Fixed CTA — not implemented

Per the task's explicit scope and Decision Gate instruction, **Option A (fixed CTA) was not
implemented in this session**, regardless of the §8 Decision Gate outcome below. Only Option B's
display change shipped.

## 8. Firebase / restricted-scope confirmation

This session did not read for editing, modify, or open a PR touching any of: Firebase/GCP/IAM
config, `functions/**`, `firestore.rules`/`firestore.indexes.json`, any GitHub Actions
*production deploy* workflow, Player Profile, `setDisplayName`, `submitLunchRushScore`, ranking
backend/query logic, Recipe Select P1-4, scoring calculation, CUT evaluation calculation, CUT
reducer/state, Completion Gate, Pitz calculation, economy/progression, or save schema.
`git diff --stat` against `origin/main` for this branch contains exactly `src/App.css`,
`src/components/ResultPanel.tsx`, `src/components/ResultPanel.test.tsx`, the new screenshots
under `docs/reports/screenshots/visual-polish-2.0c-p1-5/`, and this report. CUT score/metric
*values* were never recomputed or altered anywhere — every `cutEvaluation.*` field is read
exactly as before, only relocated within the JSX tree (§4, §5's dedicated passthrough test).

## 9. Remaining issue

Option B alone does **not** bring any of the 6 tested scenarios fully within the first viewport.
The best case (マルゲリータ CUT retry, 390×844) is now only 44px short — closer than any
scenario was before — but still short. The residual gap is dominated by the discovery/
starter-grant banners (present only on a first discovery, per the Fresh Audit's own §5 ranking,
item 2, ~97px) plus the Pitz credit `<dl>` and hero/heading content, none of which this P1-5
slice touched (out of scope: Option B was CUT-display-only, per the task brief).

## 10. Final Verdict

**Decision Gate outcome: B — improved, but not resolved.**

- **A (RESOLVED, no fixed CTA):** does not hold — all 6 scenarios still put the primary CTA row
  below the fold after Option B.
- **B (this session's outcome):** Option B measurably and consistently improves every CUT
  scenario (−112px, both viewports, both discovery states) while leaving フンギ (no-CUT)
  completely unaffected, as intended. This PR stops at Option B only, per the task's explicit
  "fixed CTAを追加実装しない" instruction — Option A is **not** implemented here.
- **C (STOP, no benefit):** does not apply — the improvement is real, substantial, and consistent
  across every measured scenario.

**Follow-up recommendation (not implemented in this session):** re-run the Fresh Audit's own
Option A (fixed CTA, reusing the existing `.prepare-bake-bar` `position: fixed` + safe-area
pattern already established for PREPARE/BAKE, confirmed conflict-free with RESULT's own
z-index/mounting in the original Fresh Audit §5) as a future, separate implementation slice, to
close the remaining 44–166px gap across the worst-case scenarios — particularly the
first-discovery cases, where the banner content Option B never touched is now the dominant
remaining contributor. A future slice could also revisit Option C (CTA reorder, matching
`MissionResultOverlay`'s existing precedent) as an alternative if a fixed bar's permanent content
coverage is judged too costly for the already-short フンギ case.
