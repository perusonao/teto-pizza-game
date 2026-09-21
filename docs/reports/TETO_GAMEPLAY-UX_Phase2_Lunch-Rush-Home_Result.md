# Teto Pizza Game — Gameplay UX Phase 2: Lunch Rush RESULT「ホームへ」導線 Result Report

**Type:** Implementation. UI/UX/gameplay change — Human Verification Policy applies in full
(`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`).

**Audited main SHA:** `d0085a35c7a5f932deda11ebc5fa74b421ddc86a` (origin/main HEAD at session
start — `docs: PR #154 Human Verification Videos -- ingredient selection, CUT regression, edge
case (#156)`).

**Issue:** [#157 — Lunch Rush結果画面への🏠ホームへCTA追加（Phase 2）](https://github.com/perusonao/teto-pizza-game/issues/157)
(new, created this session — Duplicate Gate #1 confirmed no existing open issue/PR covers this).

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
- Full suite (all `src/**/*.test.ts(x)`): **2080/2080 passed**, 111 test files.

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

Full Playwright suite (both projects, 28 tests total — this repo's only e2e spec file):
**28/28 passed.**

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

| Step | Result |
|---|---|
| Focused tests (`MissionResultOverlay.test.tsx`, `GameScreen.*.test.tsx`) | **PASS** — 32/32 |
| Full Vitest (`npx vitest run`) | **PASS** — 2080/2080, 111 files |
| Playwright, both viewport projects (`npx playwright test`) | **PASS** — 28/28 |
| `tsc --noEmit` | **PASS** — clean |
| `npm run lint` (oxlint) | **PASS** — clean |
| `npm run build` (`tsc -b && vite build`) | **PASS** — clean (pre-existing >500kB chunk-size warning only, unrelated to this change) |

---

## 7. Screenshots

`docs/reports/screenshots/gameplay-ux-phase2/`:

- `before-result-390x844.png` / `after-result-390x844.png`
- `before-result-360x800.png` / `after-result-360x800.png`

Before = pre-existing 3-CTA RESULT (origin/main HEAD). After = 4-CTA RESULT with the
フリープレイへ/🏠ホームへ pair, post layout tuning (one line each, no clipping, either viewport).

---

## 8. Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| A. Home navigation (`390x844-lunch-rush-home-navigation.mp4`) | 390×844 | 34.9s | 332 KB | H.264 | PASS |
| B. Result regression (`390x844-lunch-rush-result-regression.mp4`) | 390×844 | 29.0s | 368 KB | H.264 | PASS |
| C. Small viewport (`360x800-lunch-rush-result-layout.mp4`) | 360×800 | 16.6s | 212 KB | H.264 | PASS |

All three recorded with Playwright + real Chromium against the local dev build, converted from
WebM to MP4/H.264 with ffmpeg (`-c:v libx264 -pix_fmt yuv420p -movflags +faststart`), and
validated with `ffprobe` (codec/resolution/duration/size all confirmed above) plus a manual
frame-by-frame visual check (extracted PNG frames reviewed directly, not just ffprobe metadata).
Human-paced: 2–5s holds on every state that matters, ~0.5–1s after each click, no automated
high-speed clicking.

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

**Download:** delivered directly to the user via this interactive session (`SendUserFile`), per
the Human Verification Policy §16's preferred method. Not committed to the repository —
`artifacts/` (including the raw/final video working directory used this session) is gitignored,
per the pre-existing repository rule.

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
