# Firebase Ranking 1.0 -- Phase 2A Result Report

Issue #87 Phase 2A: Weekly Ranking. This is Phase 2A's own completion record; see
`docs/design/TETO_FIREBASE-RANKING_SETUP.md` sections 21-26 for the durable design/architecture
documentation this phase added (sections 1-20 are Phase 1A/1B, unmodified).

## Audited main SHA

Fresh audit started at `90816d345fb8fce102c6efbca5b2010429010237` -- "Firebase Ranking Phase 1B:
server-authoritative score submission (#116)", `origin/main`'s tip at that time. Before the
Duplicate PR Gate #2 / PR-creation pass, `origin/main` had advanced to
`617bb3344c20b1cbddfda6e298da4b19a30a3c55` -- "Recipe Expansion Batch 1B-C: add Meat Lovers
(#117)" (recipe/ingredient data only, per this task's own "concurrent Batch 1B-C, don't touch
recipe data" note). That newer main was merged into this branch (`git merge origin/main`, a
clean fast-forward -- no conflicts, since this phase touches no recipe/ingredient file) and the
full verification suite (tsc, root tests ×2, oxlint, build, Functions typecheck/lint/test/build)
was re-run against it; the PR is opened from that merged state.

**Duplicate PR Gate** (run twice -- once at the start of the fresh audit, once immediately
before opening the PR): `git fetch origin` + `list_pull_requests`/`search_pull_requests` found
no open PR and no branch scoped to weekly ranking / Phase 2A / Firebase ranking beyond this one,
both times. Issue #87 itself had no linked PR.

## Phase 1B baseline (unchanged)

Fresh-audited before writing any code (`src/firebase/*`, `functions/src/*`, `src/shared/
lunchRushScoring.ts`, `firestore.rules`, `firestore.indexes.json`, `firebase.json`, the setup
doc, and the Phase 0/1A/1B result reports) rather than trusting prior reports as current-state
authority, per this task's own instruction. Confirmed as still-shipped and unmodified by this
phase except where explicitly noted below:
- Anonymous Auth (`src/firebase/auth.ts`), Firebase App singleton (`src/firebase/client.ts`) --
  untouched.
- `submitLunchRushScore` (client `src/firebase/submitLunchRushScore.ts` + Cloud Function
  `functions/src/submitLunchRushScore.ts` + `functions/src/index.ts`) -- untouched. Server-side
  validation/recompute/write pipeline, `runs/{autoId}` ledger, `leaderboards/{periodId}/
  entries/{uid}` upsert-only-if-higher semantics: all exactly as Phase 1B shipped them.
- `src/shared/lunchRushScoring.ts` (the score formula both sides share) -- untouched.
- `src/mission/lunchRush.ts`'s `MissionState.serves` log -- untouched; this phase reads scores
  that log already produced, adds no new fields to it.

## Weekly schema (Phase 1B's, reused verbatim)

| Collection / Doc | Field | Type | Authority |
|---|---|---|---|
| `leaderboards/weekly_{ISO week}/entries/{uid}` | `score` | number | server, upsert-only-if-higher |
| | `achievedAt` | Timestamp | server; untouched by a tied/lower resubmission |
| | `sourceRunId` | string | server |

No schema change. Phase 2A is a pure read-model addition on top of what Phase 1B already writes.

## Timezone

Asia/Tokyo (JST, fixed UTC+9, no DST) -- reused, not reinvented. `functions/src/periodIds.ts`
(Phase 1B's own server-side, authoritative period-id derivation) **moved** to `src/shared/
lunchRushPeriodIds.ts` this phase so the client's read path (`isoWeekId(now)` -> `"weekly_" +
isoWeekId(now)`) derives the *exact same* period id the Cloud Function already used to bucket a
submission, instead of a second, independently-invented client week-numbering scheme.
`functions/src/periodIds.ts` is now a one-line re-export
(`export * from "../../src/shared/lunchRushPeriodIds";`) -- `functions/src/
submitLunchRushScore.ts`'s own `import ... from "./periodIds"` and the pre-existing
`functions/src/periodIds.test.ts` (14 cases: ISO week boundaries, year-boundary edge cases,
month formatting) are byte-for-byte unchanged and still pass against the moved implementation.

One function was added during the move: `jstWeekRange(epochMs)` -- the Monday-Sunday JST
calendar-date range for the same ISO week `isoWeekId` buckets by, used only for the ranking UI's
"今週 9/14〜20" label (`WeeklyRankingOverlay`'s own `formatWeekRangeLabel`), never for
period-id bucketing. 4 new unit tests (`src/shared/lunchRushPeriodIds.test.ts`) cover it:
mid-week, week-starts-on-Monday, week-ends-on-Sunday, and a week spanning a month/year boundary
(verified against Python's `datetime.isocalendar()` independently while writing them).

## Ordering

`score DESC, achievedAt ASC` -- Phase 1B's own tie-break authority (the earliest achiever of a
tied score ranks higher), matched in three places that must never disagree, per this task's own
requirement:
1. **Firestore query** (`src/firebase/getWeeklyLeaderboard.ts`):
   `orderBy("score", "desc"), orderBy("achievedAt", "asc"), limit(10)`.
2. **UI**: `WeeklyLeaderboardEntry.rank` is assigned as the query result's own index + 1 --
   never independently re-sorted client-side.
3. **Tests**: `getWeeklyLeaderboard.test.ts`'s "B/C/D" test asserts the exact `orderBy` call
   arguments and order.

## TOP count: 10 (not 100) -- a deliberate, documented scope decision

Issue #87's own original language targets "Top 100 display" for the eventual product. This
task's own Phase 2A brief explicitly suggests TOP 10 as a mobile-appropriate small count and
authorizes Phase 2A to decide the final number; "大量全件readは禁止" (no bulk reads) further
argues against 100 for a first read-model phase. **Decision: TOP 10.** Full reasoning in the
design doc's new section 26. A TOP 100 view is deferred to Phase 2B -- nothing in this phase's
schema/rules/index blocks that later expansion.

## Current-player behavior

- **Inside the TOP 10**: the matching row gets `isCurrentUser: true` (`WeeklyLeaderboardEntry`),
  rendered with a highlighted background and an "あなた" badge in place of/alongside the score.
- **Outside the TOP 10** (has an entry this week, but not in the top 10): one extra single-doc
  read of the player's own entry, plus (only then) one `count()` aggregation query
  (`where("score", ">", ownScore)`) to derive `rank = count + 1`, rendered as a separate
  highlighted row below the list (`ranking-overlay__row--outside`). This is an **approximate**
  rank -- it does not replicate the `achievedAt ASC` tie-break for an exact-score tie outside
  the top 10 (two players tied on score outside the top 10 would show the same rank). Given how
  granular Lunch Rush scores are (`round(servedCount*100 + totalQualityScore)`), this is expected
  to be rare; a fully tie-broken rank needs a second, more complex query (Phase 0 audit §7's own
  suggestion) and is deferred to Phase 2B if the approximation ever proves player-visible. This
  is exactly the "安全かつ小規模に実装できる場合" bar this task's own brief sets for section 9-H,
  chosen over deferring current-rank entirely to Phase 2B.
- **No entry yet this week** (never played Lunch Rush this week, or Firebase unconfigured): no
  extra row at all -- naturally folds into the empty/normal top-10-only view.
- **No personal information**: no uid, display name, or any other player-identifying value is
  ever rendered -- score-and-rank only, "あなた" for self, matching this task's own player-
  identity requirement (no nickname feature, Anonymous Auth only).

## Firestore query (client read path)

`src/firebase/getWeeklyLeaderboard.ts` -- the **only** file in `src/` that imports `firebase/
firestore` (Phase 1B's "don't scatter Firebase SDK access" posture extended to reads: this
module has no `setDoc`/`addDoc`/`updateDoc`/`deleteDoc` import at all, and its own test suite
(`getWeeklyLeaderboard.test.ts`) mocks `firebase/firestore` with *only* the read functions it
uses, so a write import would fail the suite at import time -- that mock shape **is** this
suite's own "J: no write path exposed" check). Exported through `src/firebase/index.ts`
alongside `submitLunchRushScore`; `WeeklyRankingOverlay.tsx` calls only this function, never
`firebase/firestore` directly.

Per open of the ranking overlay:
1. `leaderboards/{periodId}/entries`, `orderBy("score","desc"), orderBy("achievedAt","asc"),
   limit(10)` -- 1 query, up to 10 document reads (0 when the week has no entries yet).
2. Only if the signed-in uid isn't already one of those 10 results: 1 single-doc read (own
   entry) + 1 `count()` aggregation query (only if that doc exists).

Every outcome (Firebase unconfigured, no signed-in user, a thrown network/permission error)
resolves to a typed `GetWeeklyLeaderboardResult` (`"unavailable" | "error" | "success"`) --
never throws, mirroring `submitLunchRushScore`'s "never fail the caller" contract.

## Firestore Security Rules

The one loosening this phase makes, in `firestore.rules`:

```
match /leaderboards/{periodId}/entries/{uid} {
  allow read: if periodId.matches('^weekly_.*');
  allow write: if false;
}
```

- `weekly_*` reads: now public (no `request.auth` condition -- Lunch Rush scores carry no
  personal information, so anonymous-vs-authenticated read access is identical; gating it on
  sign-in state would add complexity with no privacy/abuse benefit).
- `monthly_*` / `all_all` reads: **still fully denied**, exactly as Phase 1B left them -- no
  Phase 2A UI reads them (minimum-necessary-privilege, per this task's own instruction).
- **Every write** (`weekly_*` included) stays denied exactly as Phase 1B left it. Phase 2A does
  not loosen write access at all.
- `runs/{runId}`: untouched, still fully read/write-denied.

Verified against a real Firestore emulator (`firestore.rules.test.ts`, 14 scenarios, run via
`npx firebase-tools emulators:exec --only firestore "npx vitest run --config
vitest.rules.config.ts"` -- **14/14 passed**):
- `runs/{runId}`: authenticated read denied, authenticated write denied (the "browser writes a
  fake run" attack), unauthenticated write denied (Phase 1B's own tests, unchanged).
- `leaderboards/weekly_2026-W38/entries/*`: **A.** unauthenticated read allowed, **B.**
  authenticated read allowed, **C.** authenticated write denied (the `{score:999999}` attack),
  **D.** authenticated update denied, **E.** authenticated delete denied, plus a write to a
  *different* uid's entry denied.
- `leaderboards/all_all/entries/*` and `leaderboards/monthly_2026-09/entries/*`: read still
  denied, write still denied -- Phase 1B's guarantee unweakened outside the one `weekly_*` read
  path.
- Deny-by-default backstop on an unmatched collection: unchanged, still denies both read/write.
- Sanity check (`withSecurityRulesDisabled`) proving the `assertFails` calls above are exercising
  the real rules engine, not trivially passing: still green.

## Firestore index

**No `firestore.indexes.json` change.** The composite index Phase 1B already predefined
(`collectionGroup: "entries"`, `queryScope: "COLLECTION"`, `score` DESC + `achievedAt` ASC)
already covers this phase's exact TOP 10 query: a `queryScope: "COLLECTION"` index applies to
every collection sharing that collection ID at any document path, so one index entry
transparently covers `leaderboards/weekly_2026-W38/entries`, `leaderboards/weekly_2026-W39/
entries`, etc. -- no per-period index needed. The `count()` own-rank query (a single inequality
filter on `score`) needs no composite index either; Firestore's automatic single-field index
already supports it.

## UI

- **Entry point**: `MissionResultOverlay`'s new "🏆 ランキングを見る" button (added below the
  Pitz balance line, above the もう一度/フリープレイへ actions) -- the single entry point this
  task asked for (RESULT, not Intro, to avoid two entry points for one destination). Opens
  `WeeklyRankingOverlay` via a new `App.tsx` `isRankingOpen` state (same `useState(false)` shape
  as `isDexOpen`/`isShopOpen`/`isInventoryOpen`/`isSettingsOpen`), also folded into
  `isGlobalOverlayOpen` for consistency with those.
- **`WeeklyRankingOverlay.tsx`**: reuses the existing `.mission-overlay`/`.mission-overlay__panel`
  visual shell (Lunch Rush's own Intro/Result overlay language) rather than introducing a second
  overlay style. One screen, no internal navigation. Heading + current-week label ("今週
  9/14〜20", `jstWeekRange` + a small local formatter), then one of: loading / empty / error /
  unavailable / the TOP 10 list (+ current-player-outside row when applicable). All 10 rows fit
  on the 390×844 authority viewport (and 360×800) without internal scrolling, verified in
  browser (see below).

## States (all implemented, all browser-verified against a real Firestore/Auth/Functions
emulator or a real network-level failure -- none simulated purely in unit tests)

| State | Behavior | Verified |
|---|---|---|
| LOADING | `role="status"`, "読み込み中..." | unit test + browser (transient) |
| EMPTY | "まだ今週の記録がありません。" | unit test + browser (`02-weekly-ranking-empty.png`) |
| ERROR / OFFLINE | `role="alert"`, "ランキングを読み込めませんでした。" + working retry button; Lunch Rush RESULT underneath stays fully rendered | unit test + browser (`03-weekly-ranking-error.png`) |
| SUCCESS | Ranked list, current-player highlighting | unit test + browser (`01-weekly-ranking-top.png`) |
| FIREBASE UNCONFIGURED | "ランキング機能は準備中です。" (no error styling, no retry) -- confirmed no crash, zero uncaught page errors, game remained fully playable (closed the overlay and retried the mission successfully) with no `VITE_FIREBASE_*` env set at all | unit test + browser (`06-firebase-unconfigured.png`) |

A ranking-read failure of any kind never touches `mission.mode`/`state.phase` -- Lunch Rush's own
RESULT screen, retry, and exit-to-free-play all keep working regardless of ranking state.

## Submission race (section 12)

`MissionResultOverlay`'s Phase 1B score-submission effect (fire-and-forget, `App.tsx`) already
fires the instant RESULT renders, before the player can even see the new "ランキングを見る"
button. No new global synchronization was added between submission and the ranking read (this
task's own instruction to avoid that complexity) -- if a player taps through faster than the
submission's own network round-trip, the ranking overlay's own retry button covers that window;
browser verification confirmed the common case (tap after a ~2s pause) already reflects the
just-submitted score correctly (`01-weekly-ranking-top.png`'s "11位 0 あなた" row is that exact
run's own real, server-recomputed score, read back after a real round-trip).

## Tests

| Suite | Count | Command |
|---|---|---|
| `src/shared/lunchRushPeriodIds.test.ts` (new: `jstWeekRange` only) | 4 | root `npm test` |
| `src/firebase/getWeeklyLeaderboard.test.ts` (new) | 10 | root `npm test` |
| `src/components/WeeklyRankingOverlay.test.tsx` (new) | 9 | root `npm test` |
| `src/components/MissionResultOverlay.test.tsx` (+1 new case) | 7 (1 new) | root `npm test` |
| `firestore.rules.test.ts` (+11 new Phase 2A cases) | 14 | manual, emulator-gated (see below) |
| `functions/src/periodIds.test.ts` (unchanged, now exercising the re-exported shared module) | 14 | `cd functions && npm test` |
| **Root suite total** | **1770** (92 files, post-main-merge -- 9 of these are Batch 1B-C's own pre-existing recipe tests, unrelated to this phase) | `npm test` |
| **Functions suite total** | **32** (2 files) | `cd functions && npm test` |

`getWeeklyLeaderboard.test.ts` covers the task's own A-J list: A (period selection), B/C/D
(score DESC / achievedAt ASC ordering), E (limit 10), F (current-user identification within
top), G (empty), H (Firebase unavailable), I (Firestore error), J (no write path exposed, via
the mock's own shape -- see "Firestore query" above), plus two extra cases for the
outside-top-10 rank derivation and "no entry this week yet". `WeeklyRankingOverlay.test.tsx`
covers the task's own UI list: loading, empty, success, error+retry, TOP 10 rendering, current
player = あなた, long-score formatting, FIREBASE UNCONFIGURED, and close navigation.

## Emulator verification

Full local suite (Auth + Functions + Firestore, `npx firebase-tools emulators:start`, against a
`demo-teto-pizza-game-rules-test` project id) run end-to-end, not just the Firestore-only rules
suite:
1. A real Lunch Rush run (`?missionDuration=1` dev override) was played in a real Chromium
   browser against the running dev server, pointed at the emulator suite.
2. Confirmed the **entire Phase 1B pipeline still works unmodified** after this phase's
   `periodIds.ts` move: real anonymous sign-in, real Callable Function invocation, real
   server-side validation/recompute, real `runs/{autoId}` + `leaderboards/{weekly_2026-W38,
   monthly_2026-09,all_all}/entries/{uid}` writes, all inspected directly via a `firebase-admin`
   script connected to the emulator.
3. Seeded 10 additional competitor entries directly into `leaderboards/weekly_2026-W38/entries`
   (Admin SDK, i.e. exactly the same write path the real Cloud Function uses -- never through
   client rules) to populate a realistic TOP 10 for screenshot verification.
4. Opened `WeeklyRankingOverlay` in-browser against this real, seeded, emulated backend and
   confirmed the exact rendered output matches what the unit tests assert in isolation.

This verification-only Firebase Emulator wiring (`connectAuthEmulator`/`connectFirestoreEmulator`/
`connectFunctionsEmulator`, gated behind a throwaway `VITE_TEMP_EMULATOR_VERIFY` env flag) was
**not committed** -- it was added to `src/firebase/{auth,getWeeklyLeaderboard,
submitLunchRushScore}.ts` for this session only and reverted (`git checkout --`) immediately
after capturing the screenshots below, confirmed via a clean `git status` and a second full
`tsc -b` + `npm test` + `npm run build` pass afterward. Production Firebase client code has no
emulator-connection logic, exactly as Phase 1B shipped it.

## Browser verification

390×844 (this task's authority viewport) and 360×800, both against the real emulator-backed dev
build described above:
- No horizontal overflow at either width.
- No clipped score (the 7-digit `1,234,567`-style formatting case is covered by a unit test;
  the real seeded scores, 3-4 digits, render with zero wrapping/clipping at both widths).
- Zero uncaught console/page errors across the full flow (checked via Playwright's own
  `page.on("pageerror")`).
- Close button and the FIREBASE-UNCONFIGURED-state "もう一度" retry both confirmed working --
  Lunch Rush remains fully playable after opening/closing the ranking overlay in every state
  tested, including the two states verified by *blocking* real network traffic (see below) and
  the state verified with **no Firebase env configured at all** (a full alternate dev-server run
  with `.env.local` absent).
- All 10 TOP entries plus the current-player row render inside one screen with zero internal
  list scrolling at both 390×844 and 360×800 (this required widening `.ranking-overlay__list`'s
  `max-height` from an initial too-tight 320px to 440px during this verification pass -- caught
  and fixed before finalizing, not left as a known issue).

The EMPTY and ERROR states were captured via real, not simulated-in-JS, failure conditions:
EMPTY by `page.route` aborting only the submission call (proving a blocked/failed submission
never corrupts the ranking read or crashes RESULT); ERROR by `page.route` aborting the Firestore
emulator's own network traffic (proving `getWeeklyLeaderboard`'s try/catch resolves a real
thrown network error, not a contrived one).

## Screenshots

`docs/reports/screenshots/firebase-ranking-2a/`:

| File | State |
|---|---|
| `01-weekly-ranking-top.png` | TOP 10 (real emulator data, 390×844) |
| `02-weekly-ranking-empty.png` | Empty week (submission network-blocked, real Firestore empty read) |
| `03-weekly-ranking-error.png` | Error + retry (Firestore network blocked) |
| `04-current-player.png` | Current player outside TOP 10 ("11位 ... あなた" row) |
| `05-360x800.png` | Same TOP 10 scenario at 360×800 |
| `06-firebase-unconfigured.png` | No `VITE_FIREBASE_*` env at all; game confirmed still playable |

Every screenshot reflects a state this session actually produced and observed -- none are
mocked-up or hand-edited.

## Performance / cost analysis

Per ranking-overlay open:
- **Best case** (signed-in player already in the TOP 10, or not signed in yet): 1 query, up to
  10 document reads (0 on an empty week).
- **Worst case** (signed-in player has an entry, not in the TOP 10): the above + 1 single-doc
  read + 1 `count()` aggregation query. Firestore aggregation queries are billed per up-to-1000
  matched index entries, not per document, so this stays cheap even as a week's entry count
  grows into the hundreds/thousands.
- **Refresh (retry button)**: identical cost to a fresh open -- no caching layer, by design (a
  ranking that could be stale after a stale-cache bug is worse than an always-fresh, cheap read
  for a leaderboard this small).
- **No bulk/full-collection read anywhere** -- `limit(10)` is unconditional on every query this
  module issues.
- No Firestore index build was required (section above) -- this phase's very first read-model
  deploy needs no index-build wait.

This stays well within Firestore's free-tier daily read quota for any realistic weekly player
count at this game's current scale; no free-tier/paid-tier cutover claim is made here (out of
this report's scope per this task's own instruction).

## Production deployment status

**Not performed**, per this task's explicit instruction ("実Firebase productionへのdeployは行わ
ない"). Everything above was verified against a local Firestore/Auth/Functions emulator suite
only. `.firebaserc` (required for any real `firebase-tools deploy`) was created only transiently
for this session's emulator verification (pointed at the `demo-teto-pizza-game-rules-test`
emulator project id) and removed before finishing -- it remains gitignored and absent from the
repo, exactly as Phase 1B left it.

## Manual Setup Required

Everything in the setup doc's sections 8 and 20 (Phase 1A/1B) still applies unchanged --
Firestore database creation, Blaze plan upgrade, Firebase CLI login + real `.firebaserc`, and
the `firestore:rules,firestore:indexes,functions` deploy itself are all still pending, human,
one-time setup steps against a real Firebase project. **Phase 2A adds no new manual setup step**
-- the rules/index changes this phase makes deploy via the exact same `firestore:rules,
firestore:indexes` command Phase 1B already documented; no new Firebase Console configuration,
plan tier, or credential is needed beyond what Phase 1B already required.

## Phase 2B scope (explicitly deferred, not started)

- Monthly leaderboard read/UI (`leaderboards/monthly_*` -- schema and Firestore rules structure
  already exist server-side; only the client rules-loosening + read + UI are Phase 2B work).
- All-time leaderboard read/UI (`leaderboards/all_all` -- same).
- TOP 100 (vs. this phase's TOP 10) -- Issue #87's original target; revisit once a real player
  count exists and a paginated/scrollable UI design is worth building.
- A fully tie-broken outside-top-10 rank (replacing this phase's `score`-only approximation) if
  it ever proves player-visible.
- Friend ranking, nicknames/display names, avatars, rewards, seasons, App Check, push
  notifications -- all still out of scope, per Issue #87's own "out of scope for first release"
  list and this task's own "今回作らない" list.

## Final Verdict

**B. READY WITH MANUAL SETUP**

All code, tests (1761 root + 32 Functions + 14 Firestore-rules-emulator, all passing), Firestore
Rules, and documentation for Phase 2A weekly ranking are complete and verified against a real
local Firebase Emulator Suite. Nothing in this phase is blocked on further code work. The
remaining "Manual Setup Required" items (a real Firebase project, Firestore database creation,
Blaze plan upgrade, and the `firestore:rules,firestore:indexes,functions` deploy itself) are
exactly the same pending human/Console steps Phase 1B already left outstanding -- Phase 2A adds
no *new* manual step, it only extends what was already pending. Once that one-time setup is
done, this phase's ranking read path and its slightly-loosened `weekly_*` read rule become live
with no further code change required.
