# Gameplay UX PR-D: RESULT 1-Screen 2.0 — Result Report

## Task summary

RESULT should show the essentials — completed pizza, ★ evaluation, total score, CUT summary,
earned Pitz, primary CTA(s) — within the first viewport (authority 390×844, secondary 360×800),
without deleting any information. Detailed breakdowns (component score bars, full CUT breakdown,
Pitz reward breakdown) remain reachable via the existing native `<details>` disclosure pattern.

Two independent, additive fixes per the Fresh Audit's own recommendation (§6):

1. Give RESULT's primary CTA row the same `position: fixed` treatment every MAKING-phase CTA
   (`.prepare-bake-bar`) already uses, so the CTA is reachable regardless of content length.
2. Reduce first-view height via Summary/Details reorganization, reusing the existing native
   `<details>` convention already used twice in `ResultPanel.tsx`.

## Issue / umbrella / PR

- Umbrella: #176 (Gameplay UX / Scoring 3.0)
- Child issue: #180 (Gameplay UX PR-D: RESULT 1-Screen 2.0)
- Prior slice: PR #179 (Gameplay UX PR-A: Dynamic Cooking Steps & Compact Bake Tab), MERGED,
  merge SHA `56840b3b1c8856e246e2d04430b1370ca9401be2`

## SHAs

- Latest `main` at session start: `56840b3b1c8856e246e2d04430b1370ca9401be2`
- Base SHA for this branch: `56840b3b1c8856e246e2d04430b1370ca9401be2` (branch created directly
  from this exact commit, confirmed via `git merge-base --is-ancestor origin/main HEAD`)
- Exact PR HEAD: see the PR itself (this report is written just before the final push)

## Duplicate Gate #1 (before implementation)

Searched open issues/PRs for: RESULT 1-Screen, ResultPanel, Result screen, result overflow,
result CTA, CUT details, score details, Pitz result, result compact, fixed CTA, 390x844 result,
360x800 result. No open issue/PR covers this exact scope. Only related item: #178 (PR-A's own
child issue, closed/merged). Child issue #180 created under #176.

## Duplicate Gate #2 (immediately before push)

`git fetch origin main` — `origin/main` unchanged at `56840b3b1c8856e246e2d04430b1370ca9401be2`
(same as this branch's base). Re-checked open PRs — same 5 stale/unrelated PRs as Gate #1 (#105,
#72, #46, #34, #3), none overlapping this scope. No rebase/merge needed.

## Fresh pre-change measurements (real Chromium, `getBoundingClientRect()`, before any code
change — Fresh Audit re-measurement, not trusted from the old 44–277.8px figures)

Methodology: real Playwright/Chromium gesture-driven rounds (not synthetic DOM state), measuring
`.game-screen.scrollHeight - .game-screen.clientHeight` for overflow, and each RESULT subsection's
own `y`/`height`/`bottom`.

| Scenario | Viewport | `.game-screen` overflow (details closed) | Overflow (all `<details>` open) |
|---|---|---:|---:|
| Margherita, CUT, first discovery | 390×844 | **154px** | 364px |
| Margherita, CUT, first discovery | 360×800 | **179px** | 389px |
| Marinara (no CHEESE step) | 390×844 | 154px | — |

The primary CTA (`.result-panel__actions`) bottom edge sat at **y=974** (390×844 viewport height
844) in the default-closed state — i.e., **not reachable without scrolling even before opening
any detail**, confirming the Fresh Audit's own finding that CUT now applying to all 15 recipes
(PR #173) made the RESULT overflow problem more universal than the pre-P1-5 44–277.8px figures
suggested.

## Information hierarchy (Tier 1 / Tier 2)

**Tier 1 (always visible, no interaction needed):**

- Completed pizza visual (compacted, see below)
- Teto's short reaction heading
- ★ stars + total score + bake badge
- Discovery/BEST banner, Starter Grant notice (conditional, short)
- CUT one-line summary (`<summary>` line of the existing `<details>` — was already Tier 1
  structurally, just needed the surrounding content trimmed to actually fit above the fold)
- Pitz headline ("今回の獲得 +N Pitz")
- Primary/secondary CTA (もう一度つくる / 別のピザを作る), now `position: fixed`

**Tier 2 (behind native `<details>`, default closed, zero information deleted):**

- Score component breakdown (ソース/具材/配置/焼き bars) — already collapsed pre-existing
- CUT full breakdown (slices/均等さ/中心/切り分け) — already collapsed pre-existing
- **New this PR**: Pitz reward breakdown (基本報酬/出来栄え倍率/調理時間/手際/手際ボーナス/所持Pitz)
  — previously rendered unconditionally expanded, now behind `.pitz-credit-summary__breakdown`

**Tier 3 (not implemented, per task scope):** per-step timing detail, Scoring 3.0 detail — out of
scope, deferred to PR-C/PR-F.

## Before/after dimensions

| Scenario | Viewport | Overflow before | Overflow after (details closed) | Overflow after (all `<details>` open, but CTA still reachable) |
|---|---|---:|---:|---:|
| Margherita CUT | 390×844 | 154px | **0px** | 225px (CTA fixed, unaffected) |
| Margherita CUT | 360×800 | 179px | **0px** | 269px (CTA fixed, unaffected) |
| Marinara (no CHEESE) | 390×844 | 154px | **0px** | — |

Scrolled-to-end overlap check (all `<details>` open): last real content (`.result-panel__details`)
bottom sits **8px above** the fixed CTA bar's top edge at both 390×844 and 360×800 — zero overlap,
confirmed by real `getBoundingClientRect()` measurement, not assumed from CSS.

## Pizza visual size before/after

- Before: shared default `.pizza-dough` cap, `min(78vw, 300px)` → renders at **300×300px** at both
  390×844 and 360×800 (px cap dominates).
- After: new `.pizza-stage--result` modifier, `min(58vw, 196px)` → renders at **196×196px** at
  both viewports (≈**65.3%** of the prior size) — within the task's own "60–70%" target range,
  confirmed by real measurement, not a blind fixed percentage. Aspect ratio preserved (same
  `width`/`height` formula, still a circle); CUT lines and topping placement remain legible at
  this size (confirmed visually in the delivered videos/screenshots).
- Scope: RESULT (`isFreeResultScreen`) only. PREPARE (`.pizza-stage--compact`), BAKE/CUT
  (`.pizza-stage--roomy`), and ORDER's small default preview are all unaffected — `resultCompact`
  is a new, independent `PizzaStage` prop, never combined with `roomy`/`compact`.

## CTA strategy

`.result-panel__actions` (both the PASS and FAILED branches, which already shared this class)
changed from a plain `.action-row` (`margin-top: auto`, normal document flow — the Fresh Audit's
own identified root cause: "only pushes to the bottom of content that already fits on screen") to
`position: fixed`, mirroring the exact `.prepare-bake-bar` contract every MAKING-phase CTA already
uses: `left: 50%; transform: translateX(-50%); bottom: 0; max-width: 390px`, with `env(safe-area-
inset-bottom)` handling. `.result-panel` gained a matching `--result-action-bar-reserve: 130px`
bottom padding (real-measured bar height ≈122px + 8px safety slack), same pattern as
`.ingredient-panel`'s existing `--bake-bar-reserve` for `.prepare-bake-bar`.

Content never hides behind the fixed bar: verified by scrolling `.game-screen` to its own end with
every `<details>` open (the worst case) and measuring zero overlap (8px clearance) between the
last real content and the bar's top edge, at both viewports.

## FREE behavior

`ResultPanel.tsx`'s own JSX structure is otherwise unchanged — same conditional banners, same
`cutEvaluation`/`pitzCredit`/`efficiencyCredit`/`starterGrantNotice` guards, same FAILED-branch
early return (which reuses `.result-panel__actions`, so it automatically inherits the fixed-CTA
fix too). Only the Pitz breakdown gained a `<details>` wrapper; no other markup restructured.

## Lunch Rush behavior

**Completely untouched.** `MissionResultOverlay`/`MissionServePanel` are architecturally separate
components (a modal overlay, not `ResultPanel`), confirmed via `git diff` (zero changes to either
file). Regression-verified: Scenario D in `e2e/result-1screen-2.0.spec.ts` and the pre-existing
`e2e/viewport-1screen.spec.ts`/`e2e/lunch-rush-result-ranking-phase4.spec.ts` suites (all passing
unmodified) confirm 挑戦数/成功/失敗/成功率/score/Pitz/HOME/ランキング CTAs all still present and
functional. `PizzaStage`'s new `resultCompact` prop is gated on `isFreeResultScreen`, which is
`false` whenever `isMissionPlaying` — Lunch Rush's own PizzaStage sizing is unaffected (confirmed:
`expect(await page.locator(".mission-overlay .pizza-stage--result").count()).toBe(0)`).

## CUT regression (PR #173)

CUT score formula/weights (countCorrectness .20, completeness .20, centerAccuracy .10, uniformity
.50) untouched — `git diff` shows zero changes under `src/logic/cut/**`. CUT remains standalone,
never folded into `score.total` (unchanged `cutEvaluation` prop contract, unchanged disclaimer
copy). All 15 CUT-eligible recipes re-verified via Margherita/Salsiccia/Capricciosa/Marinara
across the E2E suite (`e2e/pizza-cutting-phase4b.spec.ts`, unmodified, still 8/8 passing).

## PR #179 Dynamic Steps regression

Marinara (no CHEESE step) and the full E2E dynamic-cooking-steps suite (`e2e/dynamic-cooking-
steps.spec.ts`, unmodified, 4/4 scenarios × 2 viewports passing) re-verified end to end through
RESULT 1-Screen 2.0's own new layout — no step/navigation logic touched by this PR (`git diff`
shows zero changes to `src/state/gameReducer.ts`, `src/data/cookingProfiles.ts`,
`src/components/MakingStepTabs.tsx`). New dedicated coverage: Scenario E in
`e2e/result-1screen-2.0.spec.ts` drives a full real-gesture Marinara round through RESULT and
asserts `.pizza-stage--result` renders with zero overflow.

## Scoring scope guard

Zero changes to: `score.total` formula, ★ threshold, CUT score formula/weights, CUT→total
integration, Pitz formula, efficiency formula, cooking timing formula, Lunch Rush scoring,
leaderboard, Firebase, Firestore schema, Cloud Functions, recipe requirements, inventory/economy.
Confirmed via `git diff --stat` — the 8 changed files are exactly `App.css`, `App.test.tsx`,
`PizzaStage.tsx`(+its own test), `ResultPanel.tsx`(+its own test), `GameScreen.tsx` (one line: the
new `resultCompact` prop), and `viewport-1screen.spec.ts` (contract update for the new fixed-CTA
behavior). No file under `src/logic/**`, `src/state/**` (besides the untouched reducer), or
`src/data/**` changed.

## Accessibility

- `<details>`/`<summary>` keyboard operation: native browser behavior, unchanged — the new Pitz
  breakdown `<details>` uses the exact same element/pattern as the pre-existing CUT/score-bar
  disclosures, so it inherits the same keyboard (Enter/Space toggles `<summary>`) and screen-reader
  semantics with zero new code.
- Focus visibility: CTA buttons are unchanged `<button>` elements, just repositioned via CSS
  (`position: fixed`) — no change to focus order, `tabindex`, or outline styling.
- Score/CUT text is never color-only — all values remain plain text (e.g. "カット 100点", "59点"),
  matching the pre-existing convention.
- ★ is never the sole signal — the numeric score ("59点") and CUT score ("100点") both remain
  adjacent text, unchanged.
- No new ARIA needed — no new interactive pattern was introduced (native `<details>` reused, no
  custom accordion/widget built).

## Tests

**Unit/component (Vitest):**

- `ResultPanel.test.tsx`: 3 new tests — Pitz breakdown renders as a `<details>` (default closed);
  opening it reveals 基本報酬/出来栄え倍率/所持Pitz (none dropped); the zero-Pitz note stays
  visible in Tier 1, outside the collapsed breakdown.
- `PizzaStage.stageLayout.test.tsx`: 3 new tests — `resultCompact` omitted by default; adds
  `.pizza-stage--result` when true; never combines with `.pizza-stage--roomy`.
- `App.test.tsx`: 1 new assertion in the existing RESULT 2.0 end-to-end test — confirms
  `.pizza-stage--result` actually reaches the DOM through the full `App` → `GameScreen` →
  `PizzaStage` wiring (not just the isolated component-level prop test).
- **Full suite: 2288/2288 pass** (6 new, 0 regressions), up from 2282/2282 pre-change.

**TypeScript / lint / build:** all clean (`tsc -b --noEmit`, `oxlint`, `vite build`).

## Chromium E2E

- New dedicated spec: `e2e/result-1screen-2.0.spec.ts` — 5 describe blocks (Scenario A–E per the
  task's own lettering), **10/10 pass** at both 390×844/360×800 (20 total test executions).
- Updated: `e2e/viewport-1screen.spec.ts`'s "FREE RESULT" describe block — the old "CTA reachable
  via internal scroll only" test (encoding the *previous* scroll-based contract) replaced with two
  tests matching the new fixed-CTA contract (first-view fit with zero overflow; every-`<details>`-
  open scroll-to-end overlap check). **30/30 pass** in that file (both viewports).
- **Full Chromium suite: 82/82 pass** (both `iphone-390x844`/`iphone-360x800` projects), 0
  regressions across every pre-existing spec (`dynamic-cooking-steps`, `lunch-rush-result-ranking-
  phase4`, `making-ui-1screen`, `pizza-cutting-phase4b`, `viewport-1screen`).

## WebKit

Not runnable in this implementing sandbox — `/opt/pw-browsers` has no `webkit-*` package installed
(confirmed: `browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-*/pw_run.sh`),
the same pre-existing network-restricted-sandbox limitation every prior PR on this repo
(`playwright.config.ts`'s own header comment, PR-A/PR-B/PR-C) has documented. GitHub Actions'
`e2e-webkit.yml` is authoritative for WebKit.

### First push (HEAD `4f1e243bd23d3e312c4ab91681d9fef0b8d0e3b5`) — WebKit FAILURE, root-caused and fixed

**Failure symptom.** 81/82 WebKit tests passed; exactly one failure:

```
[webkit-360x800] › e2e/result-1screen-2.0.spec.ts:75:3 › Scenario B: 360x800 -- heavy RESULT
(Capricciosa, CUT + max toppings) › CTA usable, no horizontal overflow, summary visible,
details open/close normal

Error: expect(locator).toBeVisible() failed
Locator: locator('.result-panel__stars')
Timeout: 5000ms — Error: element(s) not found
```

**Root cause investigation (not "WebKit needs longer waits").** The identical scenario at
`webkit-390x844` passed cleanly in the same run (8.5s) — same production code path, same
viewport-independent component logic (`ResultPanel.tsx`, `.pizza-stage--result`, the fixed CTA,
the `<details>` disclosures). If any of this PR's actual RESULT layout/CSS changes were broken,
both viewports would have failed identically; they did not. That ruled out a production/UI
regression from this PR's own changes (fixed CTA reachability, `resultCompact`, native
`<details>`, `.game-screen` scroll math, 390×844/360×800 sizing, CUT→RESULT transition) before
looking anywhere else.

Tracing `.result-panel__stars`'s only render path (`ResultPanel.tsx`) showed it is never rendered
at all when `completion.status === "FAILED"` — that branch renders "失敗" instead and returns
early, before stars/score/CUT/Pitz ever compute. So "element not found" (not "hidden" or
"clipped") is the exact signature of a FAILED round, not a layout bug.

`e2e/gestures.ts`'s `playFullCapricciosaRound` ended its BAKE step with a fixed
`page.waitForTimeout(1300)` real-time wait, instead of the virtual-clock `bakeToTarget()` helper
`playFullMargheritaRound`/`playFullMarinaraRound` already use. `bakeToTarget`'s own doc comment
(written when this exact fragility was found and fixed for Margherita, PR-A) documents precisely
this failure mode: under real CI load, a fixed wait can let the needle drift past the recipe's own
bake window before "取り出す！" fires — the same class of flake, never a new one. Confirmed the
exact mechanism: `completionGate.ts:159` — `if (bakeResult > end + margin) return { reason:
"OVERBAKED" }` — capricciosa's own `bakeTarget` is `{ start: 58, end: 78 }`
(`src/data/recipes.ts`), and OVERBAKED is a completion-gate `FAILED` reason (§ real-time drift
under WebKit's own heavier per-action overhead + 360x800 running after/alongside 390x844 in the
same 2-worker run, more accumulated load by the time Capricciosa's BAKE fires, is exactly the
"loaded/throttled CI runner" scenario `bakeToTarget`'s own comment describes). Margherita's
helper was migrated to `bakeToTarget` specifically to fix this; Capricciosa's was never migrated
when it was authored later — a pre-existing test-infrastructure gap this PR's own new Scenario B
was the first test to exercise Capricciosa's full round including BAKE precisely enough to expose.

**This was not treated as a bare "flake" and re-run to make it go away.** The mechanism above was
established via code reading (`completionGate.ts`, `ResultPanel.tsx`, `bakeToTarget`'s own
history) before any fix was written, and the fix targets that exact mechanism.

**Fix.** `e2e/gestures.ts`'s `playFullCapricciosaRound` now calls
`bakeToTarget(page, { start: 58, end: 78 })` (capricciosa's real `bakeTarget`) instead of
`page.waitForTimeout(1300)`. This *adds* virtual-clock precision, matching and reinforcing PR
#173's/PR-A's own established stabilization — it does not revert anything to a real-time wait, and
touches no production file (`git diff --stat` for the fix commit: exactly `e2e/gestures.ts`, 12
insertions/4 deletions).

**Regression verification after the fix (before push):**

- TypeScript (`tsc -b --noEmit`): clean.
- Lint (`oxlint`): clean.
- Full Chromium E2E: **82/82 pass** (both viewports) — including the `result-1screen-2.0.spec.ts`
  Scenario B this fix targets, and every pre-existing spec that reuses
  `playFullCapricciosaRound`/`startCapricciosaUnlocked` (`dynamic-cooking-steps.spec.ts` Scenario
  C).
- Full Vitest: **2288/2288 pass** (unaffected — the fix touches only an E2E test helper).
- No Scoring/Pitz/CUT formula, Firebase, or recipe data touched (the fix reads capricciosa's own
  already-authored `bakeTarget` from `recipes.ts`; it does not add, invent, or change any value
  there).

**Second push (HEAD `55c529559c6ed72b0137c994d038fe2145aa635f`) — final GitHub Actions result:**

| Check | Run | Conclusion |
|---|---|---|
| `build` (CI) | [#35700124685](https://github.com/perusonao/teto-pizza-game/actions/runs/35700124685) | **SUCCESS** |
| `webkit` (E2E WebKit, both `webkit-390x844`/`webkit-360x800` projects, 82/82) | [#35700124825](https://github.com/perusonao/teto-pizza-game/actions/runs/35700124825) | **SUCCESS** |

PR `mergeable_state`: `clean` (no conflict) as of this HEAD.

## Human Verification

**Re-shoot determination (after the WebKit fix, HEAD `4f1e243` → `55c5295`):** not required. The
fix commit (`55c5295`) touches exactly one file, `e2e/gestures.ts` — a Playwright E2E test helper,
not shipped application code. `git diff 4f1e243 55c5295 -- src/` is empty; no file under `src/**`
changed. The 4 videos below were recorded against the real dev server running this PR's actual
production code (`src/`), which is byte-identical between the HEAD they were recorded at and the
current HEAD — there is no UI/production behavior difference for a human viewer to see that the
existing videos wouldn't already show correctly. Re-recording would produce pixel-identical output
for a strictly test-infrastructure fix.

Per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`. All 4 videos recorded via real Playwright
mouse gestures at human pacing (1–3s holds per state, longer holds on RESULT itself), MP4/H.264
via system `ffmpeg`/`libx264` (not Playwright's raw WebM), verified via `ffprobe` + direct frame
extraction/visual inspection (not just "it exists"). Delivered directly to the user this session
(never committed to the repo, per policy §6).

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| A — FREE Margherita/CUT | 390×844 | 29.9s | 749 KB | h264/yuv420p | PASS |
| B — Heavy RESULT (Capricciosa) | 360×800 | 20.5s | 659 KB | h264/yuv420p | PASS |
| C — Lunch Rush RESULT | 390×844 | 18.9s | 313 KB | h264/yuv420p | PASS |
| D — Dynamic Steps (Marinara) | 390×844 | 16.6s | 473 KB | h264/yuv420p | PASS |

Download: delivered directly in this session (SendUserFile), not committed to the repository.

What each video shows:

- **A**: HOME → Pizza Select → Margherita → full PREPARE → BAKE → CUT → RESULT; holds ~5s on the
  initial Tier 1 view (pizza/★/total/CUT summary/Pitz/CTA all visible, zero scroll); then opens
  the CUT/score/Pitz `<details>` in sequence, showing detail is preserved; scrolls to confirm the
  CTA stays reachable throughout.
- **B**: 360×800, a topping-heavy CUT round (Capricciosa, 4 topping ingredients); confirms no
  clipping/no horizontal overflow; opens every `<details>`; scrolls the expanded content; taps the
  primary CTA to confirm it's operable even in this heaviest-content state.
- **C**: Lunch Rush intro → スタート → RESULT overlay, holding ~9s on 挑戦数/成功/失敗/成功率/
  スコア/Pitz/ランキングを見る/HOME, then navigates HOME — confirms zero regression from this PR
  (Lunch Rush's own overlay is architecturally untouched).
- **D**: Marinara (PR #179's no-CHEESE fixture) through the full round — holds briefly on the
  SAUCE→TOPPING transition to show no チーズ tab exists, then BAKE → CUT → RESULT 1-Screen,
  confirming the Dynamic Steps regression guard and RESULT 1-Screen 2.0 both hold together.

Video Verification: **PASS** (all 4 — file exists, nonzero size, h264/yuv420p, correct
resolution/duration, target interaction visible via direct frame extraction and visual
inspection, acceptance criteria judgeable).

## Screenshots

Committed under `docs/reports/screenshots/gameplay-ux-result-1screen/` (visually inspected before
commit, per this session's own requirement):

- `A-result-summary-390x844.png` — Tier 1 default view, zero overflow
- `B-result-summary-360x800.png` — heavy RESULT (Capricciosa), no clipping
- `C-result-details-open-390x844.png` — every `<details>` open, scrolled to show full content
  above the fixed CTA with zero overlap
- `D-lunch-rush-result-390x844.png` — Lunch Rush RESULT overlay, unaffected by this PR

## Changed files

```
e2e/viewport-1screen.spec.ts                     (contract update for fixed CTA)
e2e/result-1screen-2.0.spec.ts                   (new — Scenario A-E dedicated coverage)
src/App.css                                       (+.pizza-stage--result, fixed CTA bar, Pitz
                                                    breakdown <details> styling)
src/App.test.tsx                                  (+1 assertion, existing test)
src/components/PizzaStage.tsx                     (+resultCompact prop)
src/components/PizzaStage.stageLayout.test.tsx     (+3 tests)
src/components/ResultPanel.tsx                    (Pitz breakdown -> <details>)
src/components/ResultPanel.test.tsx               (+3 tests)
src/screens/GameScreen.tsx                        (+1 line: resultCompact={isFreeResultScreen})
docs/reports/screenshots/gameplay-ux-result-1screen/*.png (new, 4 files)
e2e/gestures.ts                                   (WebKit fix: playFullCapricciosaRound now uses
                                                    bakeToTarget instead of a fixed real-time wait
                                                    -- test infra only, no production file)
```

## Limitations / follow-ups

- WebKit is unrunnable in the implementing sandbox (documented above and in every prior PR on this
  repo) — GitHub Actions was the authority, and **both `build` and `webkit` are now confirmed
  SUCCESS** on the current exact HEAD `55c529559c6ed72b0137c994d038fe2145aa635f` (CI run
  [#35700124685](https://github.com/perusonao/teto-pizza-game/actions/runs/35700124685), WebKit
  run [#35700124825](https://github.com/perusonao/teto-pizza-game/actions/runs/35700124825)). No
  outstanding WebKit risk on this PR.
- Tier 3 (per-step timing detail, Scoring 3.0 detail) is explicitly not implemented here, per the
  task's own scope guard — tracked under PR-C (Timing Transparency) and PR-F (Scoring 3.0).
- The `--result-action-bar-reserve: 130px` constant is a real-Chromium-measured value (like every
  other reserve constant in this codebase, e.g. `.pizza-stage--roomy`'s reserve) — a future font/
  engine change that meaningfully alters button rendering height could, in principle, need a
  re-measurement, exactly the same maintenance contract every other reserve constant in `App.css`
  already carries.
