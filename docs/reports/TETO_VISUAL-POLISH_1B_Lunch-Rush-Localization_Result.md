# Visual Polish 1B: Lunch Rush Result Localization -- Result Report

## 0. Scope

AI UI/UX Visual Review 1.0 flagged the Lunch Rush Result screen (`MissionResultOverlay`) as
the last screen with English UI copy. This PR localizes that screen's display copy to
Japanese only -- no scoring, Completion Gate, timer, persistence, or any other Lunch Rush
gameplay logic was touched.

**Audited main SHA:** `c95036b5543be527ab004d7eb4f6b73dea60931c`

## 1. Duplicate PR Gate

Checked before any implementation work (and again immediately before opening the PR):

- `git fetch origin` -- up to date.
- Open PRs (`perusonao/teto-pizza-game`, state=open): #105 (Dev Automation A1), #72 (docs:
  PROJECT_HANDOFF status), #46 (Dough Shaping D0), #34 (Reference visuals Phase 1), #3 (docs:
  Phase 2 report). None relate to Lunch Rush Result / localization / Visual Polish 1B.
- Remote branches matching `lunch|localiz|visual|polish`: only this session's own
  `claude/lunch-rush-result-localization-10hctl` and unrelated branches (`pizza-phase-2b-polish`,
  `sauce-visual-polish-fix4`, `teto-issue-39-ps3-visual`, `teto-pizza-reference-visual`,
  `teto-pizza-visual-audit`, `codex/issue-32-phase1-reference-visual`).

No duplicate found in either gate. Proceeded with implementation.

## 2. Fresh Audit (code + browser)

The audit's P1 list (LUNCH RUSH RESULT / SCORE / NEW BEST!) was re-verified directly against
`src/components/MissionResultOverlay.tsx` (the actual Lunch Rush Result screen, rendered from
`GameScreen.tsx` when `mission.mode === "RESULT"`) and confirmed live in a real browser. One
additional English string not called out by the original audit was also found in the same
screen: the "BEST" label on the best-quality row.

**Before copy (Lunch Rush Result only):**

| Element | Before |
|---|---|
| Heading | `LUNCH RUSH RESULT` |
| Best-quality row label | `BEST` (e.g. `🏆 BEST 91点`) |
| Score row label | `SCORE` (e.g. `🎯 SCORE 412`) |
| New-best badge | `NEW BEST!` |

Note: `ResultPanel.tsx` (the separate FREE-round RESULT/DISCOVERED screen) also contains a
`NEW BEST!` string, but that screen is explicitly out of scope -- its own header comment
states "Lunch Rush is unaffected -- see MissionServePanel/MissionResultOverlay". It was left
untouched.

Also out of scope but noted for awareness: `MissionIntroOverlay.tsx` (the screen shown
*before* a Lunch Rush run starts) still shows `⏱ LUNCH RUSH` as its heading. That is a
different screen from "Lunch Rush Result," so it was not touched here, per this task's scope
guard -- flagging it as a candidate for a future, equally narrow localization pass.

## 3. Localization (after copy)

Changed only `src/components/MissionResultOverlay.tsx`:

| Element | Before | After |
|---|---|---|
| Heading | `LUNCH RUSH RESULT` | `ランチラッシュ結果` |
| Best-quality row label | `BEST` | `最高` (parallels `平均`/`提供`'s existing two-character Japanese labels on the same rows) |
| Score row label | `SCORE` | `スコア` |
| New-best badge | `NEW BEST!` | `ベスト更新！` |

`Pitz` (the currency name) was deliberately left as-is -- it is used untranslated as a proper
noun everywhere else in the game (Shop, Settings, ResultPanel, tests), so translating it only
here would break consistency rather than improve it. Game-internal identifiers, test ids, type
names, and action names (`MissionResultOverlay`, `mission-result__new-best`, `isNewBest`,
`CLAIM_MISSION_REWARD`, etc.) were left untouched, as instructed.

## 4. Changed Files

- `src/components/MissionResultOverlay.tsx` -- 4 string literals changed (heading + 2 row
  labels + badge text). No prop types, logic, or structure changed.
- `src/components/MissionResultOverlay.test.tsx` -- new regression test file (this component
  had no dedicated test file before).

No other files were changed. No CSS changes were needed -- the Japanese strings fit within
the existing `.mission-overlay__title` / `.mission-result__row` / `.mission-result__new-best`
layout at both target viewports with zero horizontal overflow (verified in section 6).

## 5. Scoring/Gameplay/Completion Gate: confirmed unchanged

- `MissionResultOverlay` is a pure presentational component -- all values it renders
  (`servedCount`, `averageQuality`, `bestQuality`, `score`, `isNewBest`, `pitzReward`,
  `pitzBalance`) are still passed through unchanged from `GameScreen.tsx`/`App.tsx`.
- No prop, no prop type, and no conditional-rendering logic was touched -- only JSX string
  literals.
- `src/state/gameReducer.ts`, `src/mission/lunchRush.ts`, `src/logic/missionScoring.ts`,
  `src/logic/economy.ts`, `src/logic/completionGate.ts`, and `src/state/persistence.ts` were
  not touched.
- `git diff --stat` for this PR touches exactly one production file
  (`MissionResultOverlay.tsx`), confirmed above.

## 6. Tests

New file `src/components/MissionResultOverlay.test.tsx` (6 tests, all new):

1. Renders `ランチラッシュ結果`, not the old `LUNCH RUSH RESULT`.
2. Score row renders `スコア` + the numeric score, not the old `SCORE`.
3. Best-quality row renders `最高` + the numeric value, not the old `BEST`.
4. `isNewBest` shows `ベスト更新！`, not the old `NEW BEST!`.
5. `isNewBest={false}` shows neither the old nor the new badge.
6. Unrelated rows (served count, average quality, Pitz reward/balance) render unchanged --
   confirms the localization touched only the intended strings.

### Full verification run

```
npx vitest run     -> 1 file failed (phase4a1a.regression.test.ts), 1635/1636 passed
npx tsc -b         -> clean, no errors
npx oxlint         -> clean, no errors/warnings
npm run build      -> clean (tsc -b && vite build)
```

The one failing test (`phase4a1a.regression.test.ts`, "APPLY_SAUCE for marinara's tomato-sauce
still works exactly as before") is a **pre-existing flake unrelated to this change**: it
depends on which recipe a randomized order picks, fails intermittently only in a full
`vitest run` (never in isolation), and reproduces identically on unmodified `main`
(`c95036b`) with this change stashed out -- confirmed by running the full suite twice, once
with and once without this PR's diff. Focused run of just this file (in isolation, both with
and without the diff) passes 8/8 every time.

## 7. Browser Verification

Real Chromium (Playwright, `/opt/pw-browsers/chromium`) against the dev server, navigating
Home -> "ランチラッシュ" -> intro -> "スタート", using the existing dev-only
`?missionDuration=1` override (`src/App.tsx`, already gated behind `import.meta.env.DEV` and
dead-code-eliminated from production builds) so the run's timer expires in ~1s and the Result
overlay renders without needing to actually cook a pizza.

| Viewport | Horizontal overflow | Console errors | Heading rendered |
|---|---|---|---|
| 390×844 | 0px | 0 | `ランチラッシュ結果` |
| 360×800 | 0px | 0 | `ランチラッシュ結果` |

No text clipping, no overlap, no horizontal scroll at either width.

For the "NEW BEST" state: reaching it via real end-to-end gameplay requires actually
completing and serving at least one pizza inside a Lunch Rush run (the mission's starting
`missionBest` is 0, so any served pizza with a non-zero score already trips `isNewBest`).
Scripting the full physical dough-stretch/sauce-paint gesture flow reliably under Playwright
was judged disproportionate effort for a copy-only PR, so this state was instead verified by
mounting the real, unmodified `MissionResultOverlay` component (imported straight from
`src/components/MissionResultOverlay.tsx`, with the same `App.css`) in a temporary, untracked
Vite entry point, in the same real Chromium browser, with `isNewBest` passed as `true`. The
temporary harness files were deleted before finishing and are not part of this PR's diff
(confirmed via `git status`). This exercises the exact same component/CSS the game ships,
just with a directly-supplied prop instead of a full gameplay path to reach it.

| Viewport | Horizontal overflow | Console errors* | Badge rendered |
|---|---|---|---|
| 390×844 | 0px | 1 (harness page's own missing `favicon.ico` -- not present in the real app) | `ベスト更新！` |
| 360×800 | 0px | -- | `ベスト更新！` |

\* The one console error is Chromium's automatic `favicon.ico` request against the bare
temporary harness HTML file (which, unlike `index.html`, declares no icon links) -- not an
error from the app or from `MissionResultOverlay` itself.

## 8. Screenshots

Saved under `docs/reports/screenshots/visual-polish-1b/`:

- `lunch-rush-result-390x844.png` -- real gameplay path, ordinary (non-new-best) result.
- `lunch-rush-result-360x800.png` -- same, at 360×800.
- `lunch-rush-result-new-best-390x844.png` -- NEW BEST state (see methodology above).
- `lunch-rush-result-new-best-360x800.png` -- same, at 360×800.

## 9. Final Verdict

**PASS.** All three flagged English strings (`LUNCH RUSH RESULT`, `SCORE`, `NEW BEST!`) plus
one additional one found during fresh audit (`BEST`) are now Japanese
(`ランチラッシュ結果` / `スコア` / `ベスト更新！` / `最高`). `Pitz` intentionally kept
untranslated for consistency with the rest of the game. No scoring, Completion Gate, timer,
persistence, or other gameplay logic was touched -- confirmed by diff scope, full test suite
(1635/1636 passing, the one failure being a pre-existing, reproducible-on-`main` flake), clean
`tsc -b`/`oxlint`/`npm run build`, and real-browser verification at 390×844 and 360×800 with
zero horizontal overflow and zero app console errors in both the ordinary and NEW BEST states.

Out-of-scope finding for a possible future pass: `MissionIntroOverlay.tsx`'s heading (`⏱ LUNCH
RUSH`) is still English -- a different screen from Lunch Rush Result, intentionally left
untouched here.
