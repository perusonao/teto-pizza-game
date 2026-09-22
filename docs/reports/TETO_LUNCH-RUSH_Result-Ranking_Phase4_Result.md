# Lunch Rush Phase 4: Result Summary & Ranking achievedAt — Result Report

## SHAs

- Latest `origin/main` at task start: `4a3e6048de8a784477407a1b4f0ae26b2c36504d`
- Base SHA (this branch's base, same commit): `4a3e6048de8a784477407a1b4f0ae26b2c36504d`
- Implementation HEAD: see the PR — this branch (`claude/lunch-rush-phase4-results-3pucjd`) contains
  no other commits ahead of the base besides this task's own commit(s).

## PR #173 state at task start

`Pizza Cutting Phase 4B: Full Recipe Expansion` (closes Issue #172) — **open**, not merged, `mergeable_state: unstable`.
Scope is `src/data/cookingProfiles.ts` (CUT eligibility allowlist) plus its own tests/E2E/docs —
entirely disjoint from this task's files (Mission Result / Weekly Ranking). This branch is based
on latest `main` directly, not on PR #173, and does not modify any file PR #173 touches. No
conflict/semantic interaction.

## Duplicate Gate #1

Searched open Issues/PRs for "Lunch Rush result", "result summary", "attempt/success/failure
count", "success rate", "weekly ranking", "achievedAt", "ranking date/timestamp":

- Open PRs: only #173 (Pizza Cutting Phase 4B, unrelated), plus stale/unrelated PRs (#105, #72,
  #46, #34, #3). No PR touches Mission Result stats or Weekly Ranking achievedAt display.
- Open Issues: #87 ("Lunch Rush Online Ranking 1.0 — weekly/monthly/all-time, Firebase
  architecture") is the overarching parent architecture issue for the whole ranking feature
  (Phase 0 audit, still open) — it does not itself specify this exact Phase 4 display scope
  (result stats derivation, achievedAt formatting). No dedicated implementation issue for this
  exact scope existed. No other open issue matched.

**No duplicate found.** Continued, and created a dedicated Issue (see below) after this Fresh
Audit established final scope.

## Fresh Audit — Lunch Rush Result Data

Traced `src/mission/lunchRush.ts` (`MissionState`), `src/logic/missionScoring.ts`
(`MissionMetrics`), `src/shared/lunchRushScoring.ts` (`LunchRushServeRecord`, Firebase Ranking
1.0 Phase 1B submission authority), `src/components/MissionServePanel.tsx`, and
`src/components/MissionResultOverlay.tsx`.

- **`serves[]`**: `MissionState.serves: readonly LunchRushServeRecord[]` — already exists
  (Firebase Ranking 1.0 Phase 1B), populated by `missionRunReducer`'s `SERVE` case for *every*
  accepted serve attempt, PASS or FAILED alike (a deadline-rejected serve after mission expiry is
  the only kind never appended). Each entry: `{ recipeId, qualityTotal, completionStatus: "PASS"
  | "FAILED" }`.
- **PASS/FAILED semantics**: `completionStatus` is set directly from the Completion Gate
  (`src/logic/completionGate.ts`'s `evaluatePizzaCompletion`, computed at `CONFIRM_BAKE`) via
  `App.tsx`'s `completionFailed` flag threaded into the `SERVE` action. A FAILED entry always has
  `qualityTotal: 0` (never independently scored) and never increments `MissionMetrics.servedCount`.
- **Result state already shown**: `mission.metrics.servedCount` (PASS-only count),
  `averageQualityScore(metrics)`, `metrics.bestQualityScore`, `missionScore(metrics)`,
  `isNewMissionBest`, `calculateMissionReward(metrics)` (Pitz), `state.pitzBalance`.
- **Derivability confirmed**: attempts/successes/failures/success rate are all purely derivable
  client-side from the existing `mission.serves` array — no new state, no Firebase read/write
  needed.

Preferred definitions from the task prompt matched actual semantics exactly, no adjustment
needed:

```
attempts   = serves.length                         (every accepted serve, PASS or FAILED)
successes  = serves.filter(s => s.completionStatus === "PASS").length
failures   = attempts - successes
successRate = attempts > 0 ? round(successes / attempts * 100) : 0
```

## Fresh Audit — Weekly Ranking

Traced `src/firebase/getWeeklyLeaderboard.ts` (the one Firestore read path for the leaderboard)
and `src/components/WeeklyRankingOverlay.tsx`.

- **Leaderboard fields actually read**: `score` (number), `achievedAt` (Firestore `Timestamp` on
  the wire), `displayName` (string, Player Profile 1.0 Phase 1B). No `sourceRunId` field is read
  or displayed anywhere in the client today (Phase 1B/2A scope never needed it client-side) — the
  historical expectation in the task prompt is not currently accurate for the client read path;
  documented here rather than invented.
- **`achievedAt` type at every boundary**: Firestore `Timestamp` in the document →
  `toAchievedAtMillis()` converts to `number | null` (`null` only for the vanishingly rare case a
  just-written `serverTimestamp()` sentinel hasn't resolved yet) at the `getWeeklyLeaderboard.ts`
  read boundary → `WeeklyLeaderboardEntry.achievedAt: number | null` is what every UI component
  actually receives. **No raw `Timestamp` ever reaches a React component.**
  `WeeklyLeaderboardCurrentUserRank` (the outside-TOP10 "own rank" shape) did **not** carry
  `achievedAt` before this task — the field exists on the same Firestore document
  (`ownSnapshot`) but was never read into that result shape. Added it (same
  `toAchievedAtMillis` resolution as the TOP10 path) — this is a client-side result-shape
  addition only, no Firestore schema change, no new field written anywhere.
- **Legacy/missing/invalid entries**: an entry written before `achievedAt` existed, or with any
  other malformed shape, safely resolves to `null` via `toAchievedAtMillis`'s own type guard
  (`value instanceof Timestamp ? value.toMillis() : null`) — already handled pre-Phase-4, this
  task's new `formatAchievedAt` builds on top of that same `number | null` contract and adds its
  own defensive `NaN`/`Infinity`/non-number guards for extra safety at the display boundary.
- **"あなた" row formatting**: prior to this task, `achievedAt` was not rendered anywhere in
  `WeeklyRankingOverlay.tsx` at all (present in the data, absent from the UI). Both the TOP10 rows
  and the current-user outside-TOP10 row now go through the exact same `formatAchievedAt`
  formatter.

## Implementation

### Result stats derivation

New pure module `src/logic/missionResultStats.ts`:

```ts
export interface MissionResultStats {
  attempts: number;
  successes: number;
  failures: number;
  successRatePercent: number;
}
export function deriveMissionResultStats(
  serves: readonly LunchRushServeRecord[],
): MissionResultStats
```

Deliberately separate from `src/shared/lunchRushScoring.ts` (the Mission Score *submission*
authority, also bundled into Cloud Functions) — this is display-only derivation for
`MissionResultOverlay`, with no reason to be part of that server-trusted bundle. `GameScreen.tsx`
calls it once per RESULT render: `deriveMissionResultStats(mission.serves)`, passed to
`MissionResultOverlay` as a single `stats` prop (replacing the old standalone `servedCount` prop,
which carried the exact same value `stats.successes` now does — no duplicated PASS/FAILED
interpretation across components).

### Success rate rule

`Math.round(successes / attempts * 100)`, `0` when `attempts === 0` (never `NaN`). Matches the
task's preferred rule exactly; no existing convention conflicted with it. Pinned in
`src/logic/missionResultStats.test.ts` (0 outcomes, 1 PASS, 1 FAILED, 2 PASS + 1 FAILED → 67%,
1 PASS + 2 FAILED → 33%, all PASS, all FAILED).

### achievedAt formatter

New pure module `src/shared/formatAchievedAt.ts`:

```ts
export function formatAchievedAt(achievedAtMs: number | null | undefined): string
```

Input is exactly the boundary type `getWeeklyLeaderboard.ts` already produces (`number | null`) —
this module never touches `firebase/firestore` or sees a raw `Timestamp`. Format: `M/D HH:mm`
(e.g. `9/22 08:41`), month/day unpadded matching `WeeklyRankingOverlay`'s existing week-range
label convention, hour/minute zero-padded via `Intl.DateTimeFormat` with `hourCycle: "h23"`
(avoids the historical "24:00 at midnight" ICU quirk some engines exhibit with `hour12: false`).
No year — the ranking is weekly, so every entry falls within the already-displayed week header.
Any non-finite/non-number/invalid-date input safely falls back to `"-"` (`ACHIEVED_AT_FALLBACK`),
never throws.

### Timezone decision

**Always explicit `Asia/Tokyo`**, regardless of the viewer's browser timezone. Rationale: this
ranking's own weekly period boundaries are already explicit JST (`src/shared/
lunchRushPeriodIds.ts`'s `isoWeekId`/`jstWeekRange`, used both client- and server-side) — showing
`achievedAt` in a different, viewer-local zone could make a timestamp look like it falls outside
the very week header it's listed under. A fixed zone also keeps the formatter (and its unit tests)
fully deterministic regardless of CI/host timezone, with nothing to stub or mock. Documented in
the formatter module's own header comment.

### Fallback behavior

- Missing (`null`/`undefined`) → `"-"`.
- Invalid (`NaN`, `Infinity`, non-number, unparseable) → `"-"`.
- Never crashes, never fabricates a plausible-looking date for a legacy/missing entry.

## UI

### MissionResultOverlay (`src/components/MissionResultOverlay.tsx`)

Added a compact two-line stats block inside the existing `.mission-result__stats` container,
*replacing* the old single "提供 N枚" row (which carried the same value `successes` now does,
so no information was lost — just superseded by strictly more detail):

```
🍕 2枚挑戦
[成功 1] [失敗 1] [成功率 50%]   ← three inline chips, one row
⭐ 平均 59点
🏆 最高 59点
🎯 スコア 159  [ベスト更新!]
🥙 +70 Pitz
```

All pre-existing rows (average/best/score/new-best banner/Pitz reward/balance) and all four CTAs
(ランキングを見る/もう一度/フリープレイへ/🏠ホームへ) are unchanged and still present. New CSS:
`.mission-result__row--attempts`, `.mission-result__attempt-grid`,
`.mission-result__attempt-chip(--success|--failure|--rate)` in `src/App.css`.

### WeeklyRankingOverlay (`src/components/WeeklyRankingOverlay.tsx`)

Each row's name is now wrapped in a new `.ranking-overlay__identity` flex column containing the
existing `.ranking-overlay__name` plus a new `.ranking-overlay__achieved-at` span directly below
it — a **second line under the name**, not a new column competing with rank/score/badge for
horizontal room (task's own "achievedAt must not crowd out identity/score" requirement). Applies
identically to TOP10 rows and the current-user outside-TOP10 row.

### 390×844

See `docs/reports/screenshots/lunch-rush-result-phase4/result-390x844.png` and
`ranking-390x844.png`. RESULT (2 attempts/1 success/1 failure/50%) and Weekly Ranking (8 rows +
achievedAt, current-user row highlighted) both render fully within the viewport, no clipping.

### 360×800

See `docs/reports/screenshots/lunch-rush-result-phase4/result-360x800.png` — the 0-attempt edge
case (mission expired before any serve) at the more constrained viewport: `0枚挑戦` / `成功0` /
`失敗0` / `成功率0%`, all four CTAs visible, no overflow.

## Scope guard

- Firebase leaderboard **write** schema: **unchanged**. No new Firestore field written anywhere.
- Cloud Functions (`functions/src/*`): **untouched** — no file under `functions/` modified.
- `submitLunchRushScore` payload: **unchanged** — still `{ clientDurationMs, serves }`, same
  shape as before this task.
- Score formula (`missionScore`, `calculateLunchRushMissionScore`): **unchanged**.
- Pitz reward (`calculateMissionReward`): **unchanged**.
- Completion Gate (`evaluatePizzaCompletion`): **unchanged** — only *read*, never modified.
- CUT scoring / recipe / economy data: **untouched**.
- The one client-side (not Firestore-schema) addition: `WeeklyLeaderboardCurrentUserRank` gained
  an `achievedAt` field, populated from a Firestore field (`ownSnapshot`'s own `achievedAt`) that
  already existed on every leaderboard entry document — this is a client read-shape addition, not
  a write-schema or Cloud Function change.

## Tests

- **Focused** (new): `src/logic/missionResultStats.test.ts` (8 tests: 0 outcomes, 1 PASS, 1
  FAILED, 2 PASS + 1 FAILED, 1 PASS + 2 FAILED, all PASS, all FAILED, quality-total irrelevance),
  `src/shared/formatAchievedAt.test.ts` (8 tests: valid, missing null/undefined, invalid
  NaN/Infinity/non-number, JST-midnight boundary, cross-day timezone conversion, epoch 0).
- **Component** (updated/added): `MissionResultOverlay.test.tsx` (+4 new stats-block tests, all
  regression tests retained), `WeeklyRankingOverlay.test.tsx` (+8 new achievedAt tests: valid,
  legacy/null, invalid/NaN, current-user in-TOP10, current-user outside-TOP10, 10 distinct rows,
  long display name), `getWeeklyLeaderboard.test.ts` (+1 new legacy-achievedAt test, existing
  outside-TOP10 test updated for the new field).
- **Full Vitest**: `npm test -- --run` → **2175/2175 pass**.
- **TypeScript**: `npx tsc -b` → clean, no errors.
- **Lint**: `npm run lint` (oxlint) → clean.
- **Build**: `npm run build` → clean (`tsc -b && vite build`).
- **Chromium E2E** (new `e2e/lunch-rush-result-ranking-phase4.spec.ts` + `e2e/gestures.ts`
  additions `startLunchRushMission`/`failMissionOrderMissingSauce`): **4 new tests**, plus the
  full existing `e2e/*.spec.ts` suite — **54/54 pass** on both `iphone-390x844` and
  `iphone-360x800` Playwright projects. Notably Scenario A produces a **genuine** PASS serve
  (real `playFullMargheritaRound` gestures) and a **genuine** FAILED serve (real UI: skips the
  SAUCE step's own ingredient entirely, tripping the real `MISSING_REQUIRED_INGREDIENT`
  Completion Gate check) inside one real, wall-clock 25s Mission run — no production-only debug
  hook was needed; `MissionState.serves` cannot be pre-seeded via localStorage (it is pure
  in-memory reducer state, not part of the persisted Save v2 schema), so this was produced via
  real UI interaction as the task's own fallback plan anticipated.
- **WebKit**: not runnable in this sandbox (no browser binary — same limitation every prior
  PR in this repo has documented). The new spec file has no path filter excluding it from
  `.github/workflows/e2e-webkit.yml`, which runs every `e2e/*.spec.ts` file on every PR to
  `main` — **GitHub Actions' own WebKit run on this PR is authoritative**; see the PR for its
  actual run link/status once available.

## Human Verification

Per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`. All three videos recorded via Playwright
(`e2e/gestures.ts`'s own proven `playFullMargheritaRound`/`failMissionOrderMissingSauce`/
`startLunchRushMission` helpers driving a real dev-server browser session), converted
WebM→MP4/H.264 with system `ffmpeg`/`libx264`, validated with both `ffprobe` (codec/resolution/
duration) and direct frame-by-frame visual inspection. Delivered directly to the user this
session (not committed — `docs/PROJECT_HANDOFF.md`'s existing "videos are never committed to the
repo" rule).

| Video | Viewport | Duration | Encoded resolution | Codec | Size | Verification |
|---|---|---:|---|---|---:|---|
| A: Lunch Rush → PASS+FAILED → RESULT | 390×844 | 36.4s | 390×844 | H.264/yuv420p | 527 KB | PASS |
| B: HOME → Weekly Ranking (achievedAt) | 390×844 | 14.2s | 390×844 | H.264/yuv420p | 214 KB | PASS |
| C: 360×800 constrained (Result+Ranking stack) | 360×800 | 15.4s | 360×800 | H.264/yuv420p | 205 KB | PASS |

What each video shows:

- **Video A**: starts a real 25s Mission, plays one full genuine PASS round (Margherita, real
  DOUGH→SAUCE→CHEESE→TOPPING→BAKE gestures), advances to the next order, plays one genuine
  FAILED round (skips the SAUCE ingredient entirely → real `MISSING_REQUIRED_INGREDIENT`
  Completion Gate rejection), lets the real wall-clock Mission timer expire naturally into
  RESULT — **visibly showing 2枚挑戦/成功1/失敗1/成功率50%/スコア159/+70 Pitz/ベスト更新!** — then
  taps ランキングを見る (opens Weekly Ranking stacked on top), 閉じる, and 🏠ホームへ (confirms
  HOME navigation).
- **Video B**: HOME → 週間ランキング, showing 8 synthetic rows each with displayName, score, and
  the new compact achievedAt date (`M/D HH:mm`), the current-user row highlighted with the
  「あなた」badge, scrolls through the list, then closes.
- **Video C**: 360×800, a 0-attempt Mission run (expires before any order is completed) landing
  on RESULT showing the `0` edge case (`0枚挑戦`/`成功0`/`失敗0`/`成功率0%`) with no crash/NaN,
  opens Weekly Ranking stacked on top of RESULT (confirms no horizontal/vertical overflow at the
  more constrained viewport), closes, and returns HOME.

Video Verification: **PASS** for all three (exists, nonzero size, playable to end per `ffprobe`
duration, H.264, correct viewport/resolution, changed information readable in extracted frames,
relevant interaction visible, no clipping/overflow observed).

## Screenshots

Committed under `docs/reports/screenshots/lunch-rush-result-phase4/`:

- `result-390x844.png` — Mission RESULT with 2/1/1/50% stats.
- `ranking-390x844.png` — Weekly Ranking with achievedAt per row.
- `result-360x800.png` — 360×800 constrained RESULT, 0-attempt edge case.

## Known limitations

- WebKit was not runnable in this implementing sandbox; GitHub Actions' `e2e-webkit.yml` run on
  the PR is the authority (per repo convention, unchanged by this task).
- `WeeklyLeaderboardCurrentUserRank.achievedAt` is a client-side result-shape addition read from
  an already-existing Firestore field — verified against the emulator-style mock test suite only
  (no live Firestore project configured in this sandbox), consistent with how every other field
  on that type was already tested.
- Success/failure counts are **not** persisted to Firebase in this phase (explicitly out of
  scope, see Phase 5 below) — a player who retries or reloads mid-run loses the in-memory
  `serves[]` log the same way `mission.metrics` already resets today; this is existing behavior,
  unchanged by this task.

## Phase 5 recommendation

- Persist per-run attempts/successes/failures/success-rate to the Firestore leaderboard entry
  (schema change + `submitLunchRushScore` Cloud Function payload change — explicitly deferred
  from this phase) so historical/cross-device result stats survive beyond the current in-memory
  run and can appear in a future "my recent runs" or profile view.
- Consider a tie-broken exact rank for a current-user entry outside TOP10 sharing an exact score
  with another player (already flagged as a Phase 2B follow-up in `getWeeklyLeaderboard.ts`'s own
  comments, independent of achievedAt display).
