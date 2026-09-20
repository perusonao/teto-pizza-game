# HOME → 週間ランキング導線 Result Report

Issue #87 follow-up. Adds a direct HOME entry point into the already-shipped
`WeeklyRankingOverlay` (Firebase Ranking 1.0 Phase 2A, `#118`). This is not a new ranking
system: no Firebase backend, Firestore rules/indexes, Cloud Function, scoring, or period
calculation was touched -- see "Scope Guard" below.

## Audited main SHA

Fresh audit started at `d62d535305dd65bf5f45c847363c38f421a40e23` -- "Recipe Cooking Steps 1.0
Phase 1A-T: Step Timing instrumentation (#125)", `origin/main`'s tip at audit start. The
designated branch (`claude/home-weekly-ranking-route-n3ft5f`) was already based on this exact
SHA (`git merge-base HEAD origin/main` == `origin/main`), so no merge/rebase was needed before
implementation.

**Duplicate PR Gate #1** (before any code): `git fetch origin` + `list_pull_requests` (state:
open) found 6 open PRs -- `#121` (Firebase Production Connection), `#105` (Dev Automation A1),
`#72` (docs: PROJECT_HANDOFF status), `#46` (Dough Shaping D0), `#34` (Reference ingredient
visuals), `#3` (docs: Pages result). None touch HOME, HomeScreen, WeeklyRankingOverlay, or any
ranking scope. No duplicate branch/PR found. `#121` (Firebase Production Connection) and the
Pizza Cutting / Cooking Steps PRs (`#122`-`#125`, already merged) were left untouched.

**Duplicate PR Gate #2** (immediately before opening the PR): `git fetch origin` re-run;
`origin/main` was still at `d62d535` (no new commits landed during this task). One new PR had
opened since Gate #1 -- `#126` "Pizza Cutting 1.0 Phase 1: Geometry / Evaluation foundation" --
out of this task's scope (Pizza Cutting), left untouched. No new HOME/ranking-scoped PR among
the 7 open PRs, and no merge conflict arose against `main`.

## Fresh Audit -- existing ranking architecture

Re-confirmed directly against the files below, on the audited SHA, rather than trusting any
prior report as current-state authority:

- **`src/App.tsx`**: `isRankingOpen`/`setRankingOpen` (`useState`, line ~167) already existed,
  mounted alongside `isDexOpen`/`isShopOpen`/`isInventoryOpen`/`isSettingsOpen`.
  `<WeeklyRankingOverlay onClose={() => setRankingOpen(false)} />` was already rendered once,
  outside the `screen` switch (same pattern as Dex/Shop/Inventory/Settings), gated only by
  `isRankingOpen`. The only existing opener was `onShowRanking={() => setRankingOpen(true)}`,
  threaded into `GameScreen` for Lunch Rush RESULT's own "🏆 ランキングを見る" button
  (`MissionResultOverlay.tsx`). `isRankingOpen` was already included in the
  `isGlobalOverlayOpen` union GameScreen uses to suppress its own gestures under any overlay.
  **HOME had no route into this state at all.**
- **`src/screens/HomeScreen.tsx`**: pure-presentational view, all state via props/callbacks from
  App.tsx, confirmed unchanged in shape since Issue #24/#39. Sub-nav grid (`.home-menu`) had
  exactly 4 cards: 📖 ピザ図鑑, 🏪 ショップ, 🧺 材料, and a disabled 🏅 実績 ("近日公開")
  placeholder with no backing feature.
- **`src/components/WeeklyRankingOverlay.tsx`**: confirmed already implements, in full: the
  current JST week range header, TOP 10 list, medal glyphs for rank 1-3 (`🥇🥈🥉`), formatted
  (`toLocaleString`) scores, an "あなた" badge + highlighted row for the current user inside
  TOP 10, a **separate own-rank row when the current user is outside TOP 10**
  (`currentUserOutsideTop`), loading (`role="status"`), Firebase-unconfigured `unavailable`
  ("ランキング機能は準備中です。"), `error` + `role="alert"` + a working 再読み込み retry
  button, and an empty state ("まだ今週の記録がありません。"). Nothing here needed to change.
- **`src/components/MissionResultOverlay.tsx`**: confirmed its own "🏆 ランキングを見る" button
  still calls `onShowRanking` exactly as before -- untouched by this task.
- **`docs/design/TETO_FIREBASE-RANKING_SETUP.md`** / Phase 1A/1B/2A result reports: read for
  architecture context only, not modified.

This matches the task brief's stated "current recognition" exactly: HOME → 週間ランキング had
no existing route; Lunch Rush RESULT → ランキングを見る → WeeklyRankingOverlay was the only one.

## Ranking 2B audit

**自分の順位表示は既にPhase 2Aで実装済み.** `WeeklyRankingOverlay.tsx` already renders:
- the current user's own row inside TOP 10, highlighted (`ranking-overlay__row--you`) with an
  "あなた" badge, when they rank in the top 10 (`entry.isCurrentUser`), and
- a separate own-rank row below the TOP 10 list, also badged "あなた", when they rank outside
  the top 10 (`result.currentUserOutsideTop`, e.g. "42位" / their score).

Both paths are covered by `WeeklyRankingOverlay.test.tsx` (tests G and "current player outside
TOP 10"), which this task left unmodified. No Phase 2B work was implemented here; per the task
brief, Phase 2B's future scope is only listed as candidates, not built:
- ranking history (past weeks)
- monthly / all-time rankings
- a self-centered view (rows around the player's own rank, not just TOP 10 + one extra row)
- nickname / avatar display
- general ranking UX polish (animations, filters, etc.)

## Previous entry route (unchanged)

HOME → ランチラッシュ → プレイ終了 → ランチラッシュ結果 →「🏆 ランキングを見る」→
`WeeklyRankingOverlay`. `GameScreen.tsx` and `MissionResultOverlay.tsx` were not modified; this
route's own component-level test (`MissionResultOverlay.test.tsx`, "Firebase Ranking Phase 2A:
the ranking entry point calls onShowRanking") and the full regression suite (below) confirm it
still works exactly as before.

## New HOME entry route

`HomeScreen` gained one new prop, `onOpenRanking: () => void`, wired in `App.tsx` as
`onOpenRanking={() => setRankingOpen(true)}` -- the exact same `isRankingOpen`/`setRankingOpen`
state and the exact same `<WeeklyRankingOverlay>` element Lunch Rush RESULT already used. No new
`useState`, no new overlay component, no new Firebase read path, and no new navigation/"return
to screen X" state: because `WeeklyRankingOverlay` is rendered once outside the `screen` switch
(same as Dex/Shop/Inventory/Settings), closing it simply reveals whichever screen (HOME or GAME)
was already showing underneath, with zero extra plumbing. This was verified directly rather than
assumed -- see "Firebase behavior unchanged" and "HOME/Lunch Rush regression" below.

## Exact UI decision and why

**Decision: swap the 4th sub-nav card, 🏅 実績 ("近日公開"), for 🏆 ランキング, instead of
adding a 5th card.**

`.home-menu` is a strict 2-column CSS grid (`grid-template-columns: repeat(2, 1fr)`). With the
existing 4 cards it renders as a clean 2×2 block. The task brief's own first-candidate proposal
(5 cards: 図鑑/ショップ/材料/ランキング/実績) was implemented and screenshotted first; it
leaves an odd 5th card alone in a 3rd row, with an empty visual "hole" in that row's 2nd column
-- an orphaned card that unbalances the grid at both audited viewports, exactly the failure mode
the task brief flagged as a reason to reconsider. The swap instead:
- keeps the 2×2 grid pixel-identical (no CSS layout change needed at all -- no new grid rows,
  no resized cards, no touched hero/CTA/footer),
- reuses the exact position/size 実績 already occupied (same tap-target size, same visual
  weight), and
- is a real, working feature (今週のTOP10) replacing a placeholder that has said "近日公開"
  since Issue #24 with no backing feature planned for this task.

実績 itself is **not deleted or spec'd out** -- only its one HOME grid slot is reused for now.
`HomeScreen.tsx`'s doc comment and this report both record that it returns to HOME once it has
real content; nothing about the Achievements feature/spec was touched, removed, or redefined.

Final `.home-menu` (all 4 cards, in order): 📖 ピザ図鑑 / 🏪 ショップ / 🧺 材料 /
🏆 ランキング (label "ランキング", sub-label "今週のTOP10", opens `WeeklyRankingOverlay` via
`onOpenRanking`).

## 390×844 result (authority viewport)

Verified with a real Chromium (Playwright) render against the dev server, not just code review:
- HOME: hero (Teto + Mito/Blue sidekicks) unshrunk, 「ピザを作る」primary / 「ランチラッシュ」
  secondary CTA row unchanged, 2×2 sub-nav grid renders 図鑑/ショップ/材料/ランキング with no
  wrapping or clipping, footer message visible, no scrollbar.
- `document.documentElement`: `scrollWidth === clientWidth === 390`,
  `scrollHeight === clientHeight === 844` -- zero horizontal or vertical overflow.
- Tapping 🏆 ランキング opens the same `.mission-overlay`/`.ranking-overlay__panel` shell Lunch
  Rush RESULT already uses, showing "ランキング機能は準備中です。" (expected -- no Firebase
  project is configured in this dev environment, exercising the real `unavailable` path, not a
  stub). No overflow introduced by the overlay either (`scrollWidth`/`scrollHeight` unchanged).
- Closing (閉じる) removes the overlay and returns to the exact same HOME screen underneath
  (`.home-screen` still present, `.ranking-overlay__panel` gone) -- no navigation glitch.

Screenshots: `docs/reports/screenshots/home-weekly-ranking-route/home-390x844.png`,
`docs/reports/screenshots/home-weekly-ranking-route/ranking-390x844.png` (also sent to the user
directly).

## 360×800 result (secondary viewport)

Same script, same assertions, same outcome:
- `document.documentElement`: `scrollWidth === clientWidth === 360`,
  `scrollHeight === clientHeight === 800` -- zero overflow, before and after opening the
  overlay.
- 2×2 grid, CTA row, and hero all remain unbroken at the narrower width; ランキング card's
  label/sub-label do not wrap awkwardly or truncate.
- Close → HOME confirmed the same way as 390×844.

Screenshots: `docs/reports/screenshots/home-weekly-ranking-route/home-360x800.png`,
`docs/reports/screenshots/home-weekly-ranking-route/ranking-360x800.png`.

## Firebase behavior unchanged (confirmation)

`WeeklyRankingOverlay` itself was not modified, and this dev-environment screenshot pass
directly exercised its real `unavailable` branch (no Firebase project configured here) end to
end from the new HOME entry point, rendering "ランキング機能は準備中です。" -- the exact same
message/branch Lunch Rush RESULT's route already produced before this change. `loading` / `error`
+ retry / `empty` / `success` (TOP 10 + current-user highlighting) are unchanged in code and
remain covered by the pre-existing `WeeklyRankingOverlay.test.tsx` suite, reused as-is.

## Lunch Rush regression result

No file under Lunch Rush's own ownership (`GameScreen.tsx`, `MissionResultOverlay.tsx`,
mission/scoring/completion-gate logic) was touched. `MissionResultOverlay.test.tsx`'s existing
"the ranking entry point calls onShowRanking" test and the full suite (below) both pass
unmodified, confirming Lunch Rush RESULT →「ランキングを見る」→ `WeeklyRankingOverlay` still
works exactly as before this change.

## Tests

Reused existing coverage wherever it already satisfied a checklist item, per the task's own "no
duplicated Firebase tests" instruction:

| # | Requirement | Covered by |
|---|---|---|
| 1 | HOME shows a ranking entry point | `App.test.tsx` (new) "HOME Weekly Ranking route: 実績 is temporarily off HOME's menu, not deleted as a feature" + screenshot |
| 2/3 | Tap HOME ranking button → `WeeklyRankingOverlay` opens | `App.test.tsx` (new) "...opens WeeklyRankingOverlay from HOME without leaving HOME underneath" |
| 4 | Close → back to HOME | `App.test.tsx` (new) "...closing the overlay returns to HOME" |
| 5 | Lunch Rush RESULT route still works | `MissionResultOverlay.test.tsx` (unmodified, reused) |
| 6 | Firebase unavailable | `WeeklyRankingOverlay.test.tsx` "FIREBASE UNCONFIGURED" (unmodified, reused) + live screenshot |
| 7 | loading | `WeeklyRankingOverlay.test.tsx` test A (reused) |
| 8 | success TOP10 | `WeeklyRankingOverlay.test.tsx` tests C/F (reused) |
| 9 | current user in TOP10 | `WeeklyRankingOverlay.test.tsx` test G (reused) |
| 10 | current user outside TOP10 | `WeeklyRankingOverlay.test.tsx` "current player outside TOP 10" (reused) |
| 11 | empty | `WeeklyRankingOverlay.test.tsx` test B (reused) |
| 12 | error | `WeeklyRankingOverlay.test.tsx` test D/E (reused) |
| 13 | retry | `WeeklyRankingOverlay.test.tsx` test D/E (reused) |

The only pre-existing test that had to change was `App.test.tsx`'s "renders 実績 (Achievements)
disabled instead of fake progress" -- replaced with an equivalent assertion that 実績 is simply
off HOME's menu (not that the feature/spec was deleted), since that HOME grid slot is now
ランキング (see "Exact UI decision" above).

- **Focused run** (`App.test.tsx`, `screens/`, `WeeklyRankingOverlay.test.tsx`,
  `MissionResultOverlay.test.tsx`): 7 files, **95 passed**, 0 failed.
- **Full suite ×2** (`npx vitest run`, full repo): **97 files / 1857 tests passed**, both runs,
  no flakes, no retries.

## Typecheck / Lint / Build

- `npx tsc -b` -- clean, no errors.
- `npm run lint` (`oxlint`) -- clean, exit 0, no warnings.
- `npm run build` (`tsc -b && vite build`) -- succeeds. The only build output is a pre-existing
  "chunk larger than 500 kB" advisory (unrelated to this change; the app has always been a
  single JS bundle).

## Changed files

- `src/screens/HomeScreen.tsx` -- new `onOpenRanking` prop; 4th sub-nav card swapped from
  disabled 実績 to active 🏆 ランキング; doc comment updated to record the swap and its
  rationale.
- `src/App.tsx` -- `<HomeScreen>` now receives `onOpenRanking={() => setRankingOpen(true)}`;
  `isRankingOpen`'s doc comment updated to describe both entry points and why no new navigation
  state was needed.
- `src/App.test.tsx` -- replaced the now-stale "実績 disabled" assertion with one confirming
  it's off HOME's menu (not deleted as a feature); added two new HOME-level tests (open from
  HOME stays on HOME underneath; close returns to HOME).
- `docs/reports/TETO_HOME-WEEKLY-RANKING_Result.md` -- this report.
- `docs/reports/screenshots/home-weekly-ranking-route/*.png` -- the 4 viewport-verification
  screenshots referenced above.

No Firebase backend, Firestore rules/indexes, Cloud Function, `firebase.json`,
`WeeklyRankingOverlay.tsx`, `MissionResultOverlay.tsx`, `GameScreen.tsx`, scoring, period-id, or
any Pizza Cutting / Cooking Steps / Economy / Progression / Shop / Inventory / recipe / Dex /
save-schema / App Check file was touched.

## Remaining risks

- The 実績 grid slot is now occupied by ランキング; when Achievements gets real content, its
  HOME placement will need a fresh decision (new 5th card vs. another swap) -- flagged in
  `HomeScreen.tsx`'s doc comment for whoever picks that up.
- Visual verification ran against a dev server with no Firebase project configured, so the
  `success`/TOP 10 render path was only screenshotted for Lunch Rush RESULT historically, not
  freshly re-screenshotted from the HOME route in this pass (the code path is identical and
  covered by unit tests, but a live-data screenshot from HOME specifically was not taken).

## Future ranking candidates (not implemented)

- Ranking history (past weeks)
- Monthly / all-time rankings
- A self-centered view (rows around the player's own rank)
- Nickname / avatar display
- General ranking UX polish

## Final Verdict

**Shipped.** HOME now has a direct, minimal-diff route into the existing
`WeeklyRankingOverlay` (Firebase Ranking 1.0 Phase 2A), reusing 100% of its existing
state/fetch/UI. The Lunch Rush RESULT route is unmodified and regression-tested. No ranking
backend, scoring, or unrelated-scope file was touched. All requested checks (focused tests, full
suite ×2, typecheck, lint, build, two-viewport visual verification) pass clean.
