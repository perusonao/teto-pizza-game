# Teto Pizza Game — Gameplay UX Phase 2: Lunch Rush RESULT「ホームへ」導線 Result Report

**Type:** Implementation. UI/UX/gameplay change — Human Verification Policy applies in full
(`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`).

**Audited main SHA (original implementation):** `d0085a35c7a5f932deda11ebc5fa74b421ddc86a`
(origin/main HEAD at the start of the first session — `docs: PR #154 Human Verification Videos
-- ingredient selection, CUT regression, edge case (#156)`).

**Re-based onto (2nd continuation session):** `ea9bb48ba4ad23dd18944df98ce9453d5b13c02b` —
`Cooking UI 1-Screen 2.0 PR-A: Real-device layout (#169)`, merged after ChatGPT Fresh Review,
plus five further `main`-only commits since the 1st continuation's base (`f8e461a`): #162
(Node 22 migration Fresh Audit, docs-only), #164/#165/#166 (Node 22 migration Phase A/B-C/D-E),
#163 (CUT full-recipe expansion Fresh Audit, docs-only), #168 (Cooking UI 1-Screen 2.0 Phase 0
Fresh Audit, docs-only). Merged (not rebased, to avoid a force-push) with `git merge origin/main`
— auto-merged cleanly, no conflicts, despite PR #169 also touching `src/App.css` (119 lines) and
`src/screens/GameScreen.tsx` (10 lines). Confirmed after the merge: `git merge-base HEAD
origin/main` == `origin/main`'s HEAD. Node version in the verification environment is already
22.22.2, matching the Node 22 migration.

**Semantic diff review (not just "no git conflict"):** `git diff origin/main HEAD` after the
merge shows exactly this task's own 10 files (`MissionResultOverlay.tsx/.test.tsx`,
`GameScreen.tsx` +1 line, `App.css` +21 lines, `e2e/viewport-1screen.spec.ts`, the Result Report,
4 screenshots) — zero diff against `origin/main` on every PR #169-owned file
(`e2e/making-ui-1screen.spec.ts`, `playwright.config.ts`, `src/components/IngredientTray.tsx`,
`src/components/MakingStepTabs.tsx` (untouched by this branch at all), `src/data/hints.ts`,
`src/index.css`, `functions/package.json`, `.github/workflows/*`). The `App.css`/`GameScreen.tsx`
diffs against `origin/main` are confirmed to be exactly this task's own `.mission-result__nav-row`/
`.mission-result__nav-button` addition and the single `onGoHome={onGoHome}` line respectively —
nothing from PR #169 (6-step tab layout, vertical 1-screen safety margin, PizzaStage
height-aware sizing, ingredient UI compaction, CUT progress copy, short-height regression,
WebKit project definitions) was reverted, narrowed, or modified by this branch.

**Original re-base onto `f8e461a` (1st continuation session):** `Issue #159: Cooking UI
1-Screen Polish (#160)` — superseded by the above, kept here for history. Also a clean
auto-merge, no conflicts, PR #160 scope (`IngredientTray`, `MakingStepTabs`, olive-oil visuals,
CUT/making-step nav) fully preserved.

**Issue:** [#157 — Lunch Rush結果画面への🏠ホームへCTA追加（Phase 2）](https://github.com/perusonao/teto-pizza-game/issues/157)
(created in the original session — Duplicate Gate #1 confirmed no existing open issue/PR covers
this; re-confirmed in this continuation session, still the sole open issue/PR for this scope).

**Design basis:** `docs/reports/TETO_GAMEPLAY-UX_4ITEMS_Fresh-Audit.md` §3 / §6 Phase 2. The
Fresh Audit's own recommendation (2x2-pair フリープレイへ/🏠ホームへ, reuse `handleGoHome`) was
followed as-is — no design deviation was needed once implementation started.

---

## 1. Implementation Summary

Added a 4th navigation CTA (`🏠 ホームへ`) to Lunch Rush's `MissionResultOverlay`, reusing
`App.tsx`'s existing `handleGoHome()` — no new navigation/reset logic. `フリープレイへ` and
`🏠 ホームへ` are paired into one row (`.mission-result__nav-row`, mirrors HOME's own
`.home-cta-row` flex:1-pair pattern) instead of stacking a 4th button vertically, so the RESULT
panel's height increases by ~0px and the existing "RESULT fits without page scroll" e2e
assertions (both viewports) keep holding.

### Navigation design

- CTA order (top to bottom): ランキングを見る (secondary, standalone) → もう一度 (primary) →
  [フリープレイへ | 🏠 ホームへ] (secondary pair, one row).
- `onGoHome` is the *same* callback (`App.tsx`'s `handleGoHome`) already wired into
  `GameScreen`'s header home button — `GameScreen.tsx` now also threads it into
  `MissionResultOverlay` as a new required prop.
- `handleGoHome`'s existing behavior handles this case correctly with zero changes:
  `isRoundInProgress()` is false while `mission.mode === "RESULT"` (RESULT/DISCOVERED both
  reflect a completed round, not one worth confirming before discarding), so tapping
  🏠ホームへ never shows the leave-confirmation dialog; `mission.mode !== "FREE"` is true, so
  `exitMissionToFree()` runs first (tidies the Mission state back to FREE, discarding the
  finished run) before `setScreen("HOME")`.

### Stale-state handling

Confirmed via e2e (`e2e/viewport-1screen.spec.ts`, new "🏠 ホームへ navigates to HOME with no
stale mission/result overlay" test): after tapping 🏠ホームへ, `.mission-overlay` (RESULT) and
`.mission-serve-panel` both have zero DOM matches (fully unmounted, not just visually hidden),
`.home-screen` is visible, the page never grows past the viewport, and HOME's own primary CTA
(`ピザを作る`) is hoverable/clickable and opens Pizza Select correctly. Zero console errors
captured during the flow.

### Layout tuning (found during screenshot review, not in the original design)

The Fresh Audit's `.home-cta-row`-pattern pairing was implemented as specified, but at the
paired-button width (~150px at 390px viewport, 2-up with 8px gap), `.secondary-button`'s shared
14px horizontal padding + 13px font-size wrapped 「フリープレイへ」 onto an orphan 2nd line
(`フリープレイ` / `へ`) — legible but visually awkward. Fixed with a small
`.mission-result__nav-button` override (8px padding, 12px font-size, `white-space: nowrap`);
touch-target height is unaffected (`.secondary-button`'s 44px `min-height` is untouched). Both
labels now render on one line at both 390×844 and 360×800 — confirmed via before/after
screenshots below.

---

## 2. Changed Files

- `src/components/MissionResultOverlay.tsx` — new `onGoHome` prop, `🏠 ホームへ` button, paired
  into `.mission-result__nav-row` with the existing `フリープレイへ` button.
- `src/components/MissionResultOverlay.test.tsx` — `onGoHome` added to `baseProps()`; new tests
  for the ホームへ button's presence/callback/no-cross-wiring, plus explicit もう一度/フリープレイへ
  regression tests that didn't exist before.
- `src/screens/GameScreen.tsx` — threads the already-existing `onGoHome` prop (GameScreen already
  received it for its own header home button) into `MissionResultOverlay`. No new prop added to
  `GameScreen`'s own interface.
- `src/App.css` — `.mission-result__nav-row` / `.mission-result__nav-button` (new classes only;
  no existing rule changed).
- `e2e/viewport-1screen.spec.ts` — new "Lunch Rush RESULT: four navigation CTAs" describe block
  (5 tests: layout/overflow at both viewports, HOME navigation + stale-state check, もう一度
  regression, フリープレイへ regression) + one added assertion to the existing ranking
  stack test (close returns to an intact RESULT panel).
- `docs/reports/screenshots/gameplay-ux-phase2/*.png` — before/after screenshots (new).
- This report (new).

**Not changed** (per task Scope Guard): scoring, Lunch Rush score formula, `servedCount`,
Firebase, Cloud Functions, Firestore, ranking persistence schema, CUT, ingredient selection,
economy, recipe data, Player Profile. Confirmed by diff review — zero touches to
`src/logic/scoringV2/**`, `src/mission/lunchRush.ts`, `functions/**`, `firestore.rules`.

---

## 3. Tests

### Unit / component (Vitest)

- `MissionResultOverlay.test.tsx`: renders `🏠 ホームへ`, calls `onGoHome` exactly once per
  click, does not cross-fire `onExit`/`onRetry`/`onShowRanking`; explicit もう一度/フリープレイへ
  regression (each still fires its own callback exactly once).
- Full suite (all `src/**/*.test.ts(x)`), re-run after merging PR #160's Cooking UI changes:
  **2092/2092 passed**, 112 test files (up from 2080/111 pre-merge — the 12 new tests/1 new file
  are PR #160's own `GameScreen.makingStepNav.test.tsx` etc., unrelated to this task).

### Playwright e2e (real Chromium, `e2e/viewport-1screen.spec.ts`)

New "Lunch Rush RESULT: four navigation CTAs (Gameplay UX Phase 2)" describe block, run at both
390×844 and 360×800 projects:

1. ランキング/もう一度/フリープレイへ/🏠ホームへ all visible, no page/document overflow, both
   paired nav buttons ≥44px touch-target height, row never clipped off-viewport.
2. 🏠 ホームへ → HOME: no stale `.mission-overlay`/`.mission-serve-panel`, HOME visible and
   operable (hover + click → Pizza Select), zero console errors, no page overflow.
3. もう一度 restarts Lunch Rush (regression): RESULT overlay gone, `.mission-hud` (live-run
   timer) reappears.
4. フリープレイへ enters FREE flow (regression): RESULT/serve-panel gone, still on `.game-screen`
   (not bounced to HOME).
5. Added to the pre-existing ranking-stack test: closing ランキング returns to an intact RESULT
   panel with 🏠ホームへ still present.

Full Playwright suite, re-run after the merge (both projects, both spec files —
`viewport-1screen.spec.ts` plus PR #160's new `making-ui-1screen.spec.ts`, 38 tests total, up
from 28/28 pre-merge): **38/38 passed**, including PR #160's own Cooking UI tests (margherita
one-screen fit, sauce lock, reference thumbnail/popover parity, full-round regression) — confirms
the merge introduced no regressions in either direction.

---

## 4. Viewport Measurements

### 390×844 (authority)

- RESULT fit: `docScrollHeight <= innerHeight` — confirmed (Playwright assertion + screenshot).
- Horizontal overflow: none (`docScrollWidth <= innerWidth`, confirmed both before any
  interaction and with the ranking overlay stacked on top).
- Page overflow: none.
- Both paired buttons (フリープレイへ / 🏠 ホームへ) render on one line, ≥44px tall, fully
  within the viewport.

### 360×800 (secondary)

- RESULT fit: `docScrollHeight <= innerHeight` — confirmed.
- Horizontal overflow: none.
- Page overflow: none.
- Same one-line/no-clipping result as 390×844 after the padding/font-size tuning (§1).

---

## 5. Regression

| CTA | Scenario | Result |
|---|---|---|
| A. ランキング | RESULT → ランキング → close → RESULT | **PASS** — ranking overlay stacks correctly (pre-existing test), closes back to an intact RESULT panel with all 4 CTAs still present (new assertion). |
| B. もう一度 | RESULT → 新しいLunch Rush開始 | **PASS** — `mission.mode` returns to `PLAYING`, live-run HUD reappears, RESULT overlay fully unmounted. |
| C. フリープレイへ | RESULT → FREE flow | **PASS** — FREE's own fresh PREPARE round starts, still on GAME screen (not HOME), RESULT/serve-panel fully unmounted. |
| D. ホームへ（新規） | RESULT → HOME | **PASS** — HOME renders, no stale mission/result overlay, HOME CTA operable, zero console errors. |

---

## 6. Verification Sequence (in order)

| Step | Original session (base `d0085a3`) | 1st continuation (base `f8e461a`) | 2nd continuation (base `ea9bb48`) |
|---|---|---|---|
| Focused tests | PASS — 32/32 | covered by full suite | covered by full suite |
| Full Vitest (`npx vitest run`) | PASS — 2080/2080, 111 files | PASS — 2092/2092, 112 files | **PASS — 2092/2092, 112 files** (unchanged; PR #169 added e2e tests only, no new unit tests) |
| Playwright, Chromium projects (`npx playwright test --project=iphone-390x844 --project=iphone-360x800`) | PASS — 28/28 | PASS — 38/38 | **PASS — 40/40** (up from 38 — PR #169 added the "PizzaStage height-aware sizing: shrink path" test to `making-ui-1screen.spec.ts`; includes both this task's Lunch Rush RESULT tests and PR #169's Cooking UI tests) |
| `tsc --noEmit` | PASS — clean | PASS — clean | **PASS — clean** |
| `npm run lint` (oxlint) | PASS — clean | PASS — clean | **PASS — clean** |
| `npm run build` (`tsc -b && vite build`) | PASS — clean | PASS — clean | **PASS — clean** (same pre-existing >500kB chunk-size warning only) |

**Playwright WebKit projects:** `playwright.config.ts` gained two WebKit projects
(`webkit-390x844`/`webkit-360x800`) via PR #169, for real-Safari-closer local verification (see
that PR's own Result Report). This session's sandbox has only the Chromium browser installed
(`/opt/pw-browsers` — no WebKit binary), and the task's own instruction (§4) scoped this round's
verification to "Playwright Chromium full" — so only the two Chromium projects were run here.
This is an environment limitation, not a test failure; WebKit was never part of this task's own
scope (Lunch Rush RESULT navigation) or introduced by it.

---

## 7. Screenshots

`docs/reports/screenshots/gameplay-ux-phase2/`:

- `before-result-390x844.png` / `after-result-390x844.png`
- `before-result-360x800.png` / `after-result-360x800.png`

Before = pre-existing 3-CTA RESULT (origin/main HEAD). After = 4-CTA RESULT with the
フリープレイへ/🏠ホームへ pair, post layout tuning (one line each, no clipping, either viewport).

---

## 8. Human Verification Videos

**Re-recorded in the 1st continuation session** against the merged branch (base `f8e461a`, this
task's own diff on top), so the videos reflect the exact code that shipped at that point, not
the pre-merge state.

**Reused (not re-recorded) in the 2nd continuation session** (base `ea9bb48`, after merging PR
#169): confirmed via a fresh live render (Playwright + real Chromium against the merged code,
not just diff inspection) that the RESULT panel is pixel-identical to the videos' own content at
both viewports — same `.mission-overlay__panel` bounding box (479px height at both 390×844 and
360×800), same `.mission-result__nav-row` position/size, same 🏠ホームへ button geometry, and a
direct screenshot comparison against the committed `after-result-390x844.png`/
`after-result-360x800.png` showed no visible difference. `git diff f8e461a ea9bb48 --
src/App.css` confirms PR #169 touched no `.mission-*`/`.action-row`/`.cta-button`/
`.secondary-button` rule (only a `.mission-overlay` mention inside an unrelated z-index comment).
Per the task's own instruction (§5): "既存のpost-f8e461a動画と最新main統合後のRESULT UIが
pixel/structure上実質同一なら、既存動画を再利用してよい" — none of the re-record triggers (panel
layout, CTA position, viewport fit, font/wrapping, HOME navigation behavior) changed, so the
existing MP4s were re-delivered as-is rather than re-recorded.

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| A. Home navigation (`390x844-lunch-rush-home-navigation.mp4`) | 390×844 | 34.96s | 324,171 bytes (317 KB) | h264 | PASS |
| B. Result regression (`390x844-lunch-rush-result-regression.mp4`) | 390×844 | 28.92s | 355,040 bytes (347 KB) | h264 | PASS |
| C. Small viewport (`360x800-lunch-rush-result-layout.mp4`) | 360×800 | 16.60s | 181,513 bytes (177 KB) | h264 | PASS |

All three recorded with Playwright + real Chromium against the local dev build, converted from
WebM to MP4/H.264 with the full system `ffmpeg` (`apt-get install ffmpeg`, `libx264` available —
the bundled Playwright ffmpeg is `libvpx`-only and cannot produce H.264; confirmed via
`ffmpeg -encoders | grep 264`) using `-c:v libx264 -pix_fmt yuv420p -movflags +faststart`, and
validated with `ffprobe` (`codec_name=h264`, resolution, duration, and size all confirmed above)
plus a manual frame-by-frame visual check (extracted PNG frames at several timestamps per video,
reviewed directly — not just ffprobe metadata). Human-paced: 2–5s holds on every state that
matters, ~0.5–1s after each click, no automated high-speed clicking.

**What each video shows:**

- **A (home navigation):** HOME → tap ランチラッシュ → INTRO overlay → tap スタート → the mission
  runs to completion → RESULT (held ~5s, all 4 CTAs visible) → tap ランキングを見る → ranking
  overlay open (held ~4s) → close → back to an intact RESULT → tap 🏠 ホームへ → HOME (held ~5s,
  no leftover overlay) → hover HOME's own ピザを作る CTA to show it's genuinely operable
  post-navigation.
- **B (regression):** Two independent RESULT reaches. Scenario 1: RESULT → もう一度 → the live
  Lunch Rush timer HUD reappears (proof the run actually restarted, not just that the overlay
  closed). Scenario 2: a fresh RESULT → フリープレイへ → FREE's own PREPARE round starts (still on
  the GAME screen, not bounced to HOME).
- **C (360×800 layout):** Static hold on RESULT at 360×800 (~4.5s) — score, reward, ランキング,
  もう一度, フリープレイへ, and 🏠ホームへ all visible with no button clipping — then tap
  🏠ホームへ and hold on HOME (~3.5s).

**Download:** delivered directly to the user via this interactive session (`SendUserFile`) three
times: the original session (pre-merge cut), the 1st continuation (post-`f8e461a` re-record),
and the 2nd continuation (re-delivery of the same post-`f8e461a` files, confirmed still accurate
against `ea9bb48` per the reuse analysis above). Not committed to the repository — `artifacts/`
(including the raw/final video working directory and the fresh post-merge verification
screenshots used to justify reuse) is gitignored, per the pre-existing repository rule.

**Video Verification: PASS** (all three — file exists, size > 0, full duration playable per
ffprobe, correct viewport resolution recorded end-to-end, target operations visible, Acceptance
Criteria human-judgeable from the video alone).

---

## 9. Firebase / Scoring Impact

- **Firebase changes: NONE.** No `functions/**`, `firestore.rules`, or ranking-write-path files
  touched. The pre-existing ランキング CTA/overlay is unchanged.
- **Scoring changes: NONE.** No `src/logic/scoringV2/**`, `src/logic/missionScoring.ts`, or
  `src/mission/lunchRush.ts` touched. `servedCount`/score/Pitz reward display values are
  unchanged (same props, same computation, only the new CTA and its layout are new).
- **PR #160 (Cooking UI 1-Screen Polish) impact: NONE.** Merged into this branch, not reverted or
  modified — `IngredientTray`, `MakingStepTabs`, `PizzaStage`, `ReferenceThumbnail`, CUT,
  olive-oil visuals, recipe data are all untouched by this task's own diff.
- **PR #169 (Cooking UI 1-Screen 2.0 PR-A: Real-device layout) impact: NONE.** Merged into this
  branch (`ea9bb48`), not reverted or modified — the 6-step tab layout, vertical 1-screen safety
  margin, `PizzaStage` height-aware sizing, ingredient UI compaction, CUT progress copy, the new
  short-height regression test, and the new WebKit `playwright.config.ts` project definitions
  are all confirmed untouched by this task's own diff (`git diff origin/main HEAD` shows zero
  changes to any PR #169-owned file — see the Semantic diff review above), and PR #169's own
  Playwright suite (`making-ui-1screen.spec.ts`, including its new PizzaStage height-aware-sizing
  test) passes 40/40 alongside this task's tests post-merge.

---

## 10. Remaining Phases

Per `docs/reports/TETO_GAMEPLAY-UX_4ITEMS_Fresh-Audit.md` §6, this task was Phase 2 of 5:

- **Phase 1** (材料選択UX, ピザステージ縮小 + 閾値付き横スクロール) — already merged via PR #154
  (Gameplay UX Phase 1) before this session started; unrelated to and unaffected by this Phase 2.
- **Phase 2** (this task) — **done**, PR pending human review per this report.
- **Phase 3** (CUT対象レシピの14レシピ拡張) — not started, independent of Phase 2.
- **Phase 4** (Lunch Rush結果画面: 成功/失敗/総枚数の今回表示 + ランキング`achievedAt`表示) — not
  started, independent of Phase 2. Explicitly out of this task's scope per the task's own Scope
  Guard (§7): "次Phase予定の: 成功/失敗枚数表示 / 達成日時表示 も今回混ぜない."
  Kept out of the `MissionResultOverlay`/`App.css` diff in this PR.
- **Phase 5** (ランキングへの成功/失敗/総枚数の永続化, Cloud Functions変更あり) — separate PR per
  the audit's own instruction, not started.
