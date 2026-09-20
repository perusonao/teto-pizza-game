# Firebase Ranking 1.0 -- Setup & Architecture (Phase 1A + Phase 1B)

Issue #87. Sections 1-9 below cover **Phase 1A** (Firebase client foundation + Anonymous Auth)
exactly as shipped, unmodified by Phase 1B. Section 10 onward covers **Phase 1B**: the trusted
score-submission path (Cloud Function, shared scoring authority, Firestore schema, security
rules). Ranking UI (Top 100, weekly/monthly display, result-screen rank feedback) is still not
in scope -- see section 19 ("Phase 2A connection point") for what's deliberately deferred.

## 1. Architecture (Phase 1A)

```
src/firebase/
  config.ts   -- reads VITE_FIREBASE_* env vars, returns a FirebaseWebConfig or null
  client.ts   -- lazily initializes (and caches) the Firebase App, only when config is present
  auth.ts     -- Anonymous Auth: ensureAnonymousUser(), getCurrentAuthUser()
  index.ts    -- the only public surface: isFirebaseAvailable, ensureAnonymousUser,
                 getCurrentAuthUser
```

Nothing outside `src/firebase/` imports `firebase/app` or `firebase/auth` directly -- every
other module (App.tsx included) goes through `src/firebase/index.ts`'s three functions. This
keeps the Firebase SDK's surface area to one small, replaceable folder.

`App.tsx` calls `ensureAnonymousUser()` once on mount, fire-and-forget, purely to establish an
identity in the background ahead of Phase 1B actually needing one. It is a no-op whenever
Firebase is unconfigured, and never throws or surfaces an error to the player on any failure.

## 2. Phase boundaries

**In Phase 1A:**
- Firebase client initialization foundation (config-gated, lazy, cached)
- Environment/config abstraction (`VITE_FIREBASE_*`)
- Anonymous Auth foundation (`ensureAnonymousUser`, `getCurrentAuthUser`)
- Firebase-unavailable / unconfigured fallback (offline gameplay unaffected)
- Local development safety (build succeeds with no Firebase env at all)
- Unit tests + this setup doc

**Explicitly NOT in Phase 1A** (Phase 1B and beyond):
- Firestore leaderboard / any Firestore read or write
- Cloud Functions (trusted score submission/validation path)
- `submitLunchRushScore` or any score-submission call
- Weekly / monthly / all-time ranking
- Ranking UI (result-screen rank feedback, Top 100, etc.)
- Firebase App Check
- Provider linking / account migration
- Production Firebase project creation (see "Manual Setup Required" below -- that's a human
  task, not a Phase 1A code deliverable)

## 3. Security posture

The client (this GitHub Pages app) is never trusted to write an authoritative score anywhere.
Phase 1A does not write anything to Firestore at all -- there is no Firestore usage yet. The
intended future path (Phase 1B+), documented here so no later phase "temporarily" shortcuts
it, is:

```
GitHub Pages client -> Firebase Auth (anonymous) -> Callable Cloud Function
  -> server-side validation/recompute -> Firestore Admin write
```

A client SDK writing a score directly into Firestore is explicitly out of scope forever for
*authoritative* ranking data, not just deferred past Phase 1A.

## 4. Environment variables

Vite's standard `VITE_`-prefixed env var convention (same one `VITE_PREVIEW_MODE` already
uses, see `src/state/persistence.ts`). All four are required together -- see `.env.example`
at the repo root for the authoritative list and comments:

| Variable | Firebase Console source |
|---|---|
| `VITE_FIREBASE_API_KEY` | Project settings -> General -> Your apps -> Web app -> SDK config `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | same panel, `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | same panel, `projectId` |
| `VITE_FIREBASE_APP_ID` | same panel, `appId` |

A Firebase Web `apiKey` is not a server secret -- see `.env.example`'s own comment for why
it's safe in a public bundle. An Admin SDK service account / private key must never appear in
this repo, in any env file, or in GitHub Actions secrets used by this client build.

## 5. Local development

```bash
cp .env.example .env.local   # then fill in real values, or leave blank to stay unconfigured
npm run dev
```

`.env.local` is already covered by the repo's `*.local` gitignore pattern -- no new gitignore
entry was needed. Leaving `.env.local` absent (or blank) is a fully supported, first-class
state: `npm run dev` / `npm run build` / `npm test` all succeed with zero Firebase env set, and
the game is 100% playable offline exactly as before this phase.

## 6. GitHub Pages / CI

`npm run build` succeeds with no Firebase env set (verified in CI, which sets none). No dummy
Firebase secret is required in `.github/workflows/ci.yml` or `deploy.yml`. When a production
Firebase project exists (see Manual Setup below), add the four `VITE_FIREBASE_*` values as
GitHub Actions repository secrets and reference them as `env:` in `deploy.yml`'s build step --
that wiring itself is a Phase 1B (or later) change, not made here, since there is nothing yet
that uses a live Firebase project.

## 7. Anonymous Auth behavior

- `ensureAnonymousUser()` reuses an existing session (including one Firebase Auth is still
  asynchronously restoring from its own persistence) before ever calling `signInAnonymously`.
- Concurrent calls while a sign-in is already in flight share one promise/one
  `signInAnonymously` call.
- Never throws. Firebase being unconfigured, offline, or actively rejecting the sign-in all
  resolve to `null`.
- No UID is ever shown in the UI, logged, or copied into `PersistentSaveV2`
  (`src/state/persistence.ts` is untouched by this phase). Firebase Auth owns its own session
  persistence entirely; this app's local save schema and Firebase Auth's user record are two
  independent things.
- **Full Game Reset** (`resetSave` / Issue #89) only ever clears the local save
  (`localStorage`) and reloads. It does not call, and Phase 1A adds no code path that could
  call, anything that deletes or signs out the Firebase Auth user. "Reset game progress" and
  "delete Firebase account" are deliberately kept as two unrelated operations for now.

## 8. Manual Setup Required (human, Firebase Console)

Everything below must be done by a human with access to the Firebase Console/GitHub repo
settings -- none of it is a Claude Code / Phase 1A code deliverable:

1. Create (or select) a Firebase project.
2. Register a Web App inside that project (Project settings -> Add app -> Web).
3. Enable **Anonymous** sign-in under Authentication -> Sign-in method.
4. Copy the Web app's config values into `VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` /
   `_PROJECT_ID` / `_APP_ID` -- either a local `.env.local` for development, or GitHub Actions
   repository secrets for the Pages deploy build once Phase 1B needs a live production
   Firebase project.
5. Confirm **Authorized domains** (Authentication -> Settings -> Authorized domains) includes
   `perusonao.github.io` (production) and, if used, the preview deployment's origin -- same
   origin as noted in `src/state/persistence.ts`'s `VITE_PREVIEW_MODE` doc comment.

**Deliberately NOT required for Phase 1A** (these belong to Phase 1B+, once Firestore/
Functions are actually used):
- Firestore database creation
- Blaze plan upgrade
- Cloud Functions deployment
- App Check registration

## 9. Phase 1B connection point

Phase 1B's score-submission path starts from `src/firebase/index.ts`'s existing
`ensureAnonymousUser()` (to get a signed-in `User`/uid) and adds its own new files (a
Firestore client wrapper, a Callable Function client, or both) -- it should not need to modify
`config.ts` / `client.ts` / `auth.ts` themselves, only add alongside them.

## 10. Phase 1B architecture

```
Lunch Rush RESULT
  -> src/firebase/submitLunchRushScore.ts (ensureAnonymousUser, then a Callable invocation)
  -> Callable Cloud Function "submitLunchRushScore" (functions/src/index.ts)
     -> input validation + server-side score recomputation (functions/src/submitLunchRushScore.ts)
     -> Firestore Admin SDK write (runs/{autoId}, leaderboards/{periodId}/entries/{uid})
```

The client **never** writes to Firestore directly -- there is no `firebase/firestore` import
anywhere in `src/`. The only trusted writer of `runs/*` and `leaderboards/*/entries/*` is the
Cloud Function's own Admin SDK call, enforced by `firestore.rules` denying all client
read/write to both collections (section 15). This is Phase 1A's section 3 promise, now made
real rather than aspirational.

## 11. Shared scoring authority

`src/shared/lunchRushScoring.ts` is a new, deliberately Firebase-free, framework-free pure
module -- `calculateLunchRushMissionScore(serves[])` is the one formula both the browser and
the Cloud Function run, so they can never hand-roll two copies that drift apart. It is bundled
into the Functions deploy by `functions/`'s own esbuild step (section 13) rather than published
as a separate package -- this repo has no monorepo/workspace tooling, so a bundler-time inline
was the simplest correct option for two npm projects that need the exact same tiny module.

It intentionally does **not** replace `src/logic/missionScoring.ts` (untouched, still the
realtime run-metrics accumulator every other part of the app reads) -- see the shared module's
own file header for the full reasoning.

`src/mission/lunchRush.ts`'s `MissionState` gained one additive field, `serves`
(`LunchRushServeRecord[]`), appended in the exact same `SERVE` reducer branch that already
decides `metrics` -- a PASS or FAILED alike, deadline-rejected excluded -- so the submitted
log can never disagree with what the player's own realtime score already showed. `metrics`
itself, `missionScore`, and every other existing Mission behavior are byte-for-byte unchanged.

## 12. Payload (`ScoreSubmissionV1`-shaped request)

```ts
{
  rulesetVersion: "lunch-rush-v1",  // functions/src rejects any other value
  missionId: "lunch-rush",
  clientDurationMs: number,          // advisory only, never the ranking authority
  serves: Array<{
    recipeId: string;
    qualityTotal: number;            // 0-100
    completionStatus: "PASS" | "FAILED";
  }>;
}
```

No `uid` field (taken only from the Callable Function's own `request.auth.uid`) and no
`score`/`servedCount`/`totalQualityScore`/`bestQualityScore` fields at all -- there is nothing
in this payload shape for a client to tamper with, because the server never reads those values
from the client in the first place. This is a stronger property than "recompute and cross-check
against the client's claim" (Phase 0 audit's own original design) -- the client's own local
preview (built with the exact same shared formula) simply has nothing to disagree with.

## 13. Cloud Function (`submitLunchRushScore`)

`functions/src/submitLunchRushScore.ts` (`handleSubmitLunchRushScore`) is the full validate ->
recompute -> write pipeline, written against a narrow `FirestoreLike` port rather than calling
`admin.firestore()` directly -- `functions/src/index.ts` is the only file that wires it to the
real Admin SDK and the real `onCall` trigger. This is what lets every rejection/acceptance
scenario run as a fast unit test (an in-memory Firestore fake, `functions/src/
submitLunchRushScore.test.ts`) with no Firestore/Functions emulator required for day-to-day
development, while `firestore.rules.test.ts` (section 16) separately verifies the real rules
against a real emulator.

Validation order: unauthenticated -> reject; malformed payload (wrong `rulesetVersion`/
`missionId`, non-array `serves`, oversized `serves` array) -> reject; negative/out-of-range
`clientDurationMs` -> reject; any malformed or impossible (`qualityTotal` outside [0, 100])
serve entry -> reject; `servedCount` (after recomputation) exceeding
`MAX_SERVES_PER_RUN` (a theoretical-max derived from the ruleset's fixed 180s duration and a
conservative minimum-seconds-per-serve floor, `src/shared/lunchRushScoring.ts`) -> reject.
Everything that survives is written: one `runs/{autoId}` ledger document (Admin SDK auto-id,
not a client-supplied id), then a per-period upsert-if-higher into
`leaderboards/{periodId}/entries/{uid}` for weekly/monthly/all-time in parallel.

**Node runtime: Node 20.** Matches this repo's own root CI/deploy Node version
(`.github/workflows/ci.yml`/`deploy.yml`) for repo-wide consistency, and is a currently
Firebase-supported Cloud Functions Gen 2 runtime. `firebase-admin` was deliberately pinned to
the `^13` major (not the newer `^14`, which requires Node >=22) specifically so the Functions
runtime could stay on Node 20 rather than forcing a second Node version onto the project just
for this one workspace; `firebase-functions ^7` supports Node >=18 either way.

## 14. Firestore schema

| Collection / Doc | Field | Type | Authority |
|---|---|---|---|
| `runs/{runId}` (Admin SDK auto-id) | `uid` | string | server (`request.auth.uid`) |
| | `rulesetVersion`, `missionId` | string | server-validated |
| | `clientDurationMs` | number | client-reported, range-checked, advisory |
| | `servedCount`, `totalQualityScore`, `bestQualityScore`, `score` | number | **server-recomputed** from `serves[]`, never trusted from the client |
| | `serves` | array | client-reported, per-entry validated |
| | `submittedAt` | Timestamp | server (`FieldValue.serverTimestamp()`) |
| `leaderboards/{periodId}/entries/{uid}` | `score` | number | server, upsert-only-if-higher |
| | `achievedAt` | Timestamp | server; untouched by a tied/lower resubmission |
| | `sourceRunId` | string | server (the `runs/{runId}` this entry came from) |

`periodId` is one of `weekly_{ISO week, e.g. 2026-W38}`, `monthly_{YYYY-MM}`, or the constant
`all_all` -- all three are upserted on every accepted submission (Phase 0 audit §7/§8's design,
carried through unmodified), giving weekly/monthly/all-time ranking the structure to extend
into without a schema change, even though Phase 1B builds no read/UI path for any of them yet.

Write semantics (`functions/src/index.ts`'s `upsertLeaderboardEntryIfHigher`, inside a Firestore
transaction): a new entry is created if none exists; an existing entry is overwritten **only**
if the new score is **strictly greater** -- a tie or a lower score is a no-op, so `achievedAt`
for a tied score is never disturbed. This is what keeps a future `score DESC, achievedAt ASC`
ranking query's tie-break meaningful (the earliest achiever of a tied score keeps ranking
higher) -- verified directly in `functions/src/submitLunchRushScore.test.ts` ("K: tie handling
deterministic").

Period ids are server-side pure functions (`functions/src/periodIds.ts`), Asia/Tokyo (JST,
fixed UTC+9, no DST), derived only from the Cloud Function's own clock
(`Date.now()` at submission-processing time) -- never any client-supplied timestamp. ISO-8601
week numbering (`YYYY-Www`) is used for `weekly`, matching Issue #87's own Monday-start
weekly-leaderboard requirement and correctly resolving the year-boundary edge case (a JST
Monday in early January can still belong to the *previous* ISO year's week 53) without any
special-cased boundary logic -- see that file's own tests for worked examples.

## 15. Firestore Security Rules

`firestore.rules` (repo root): both `runs/{runId}` and
`leaderboards/{periodId}/entries/{uid}` deny **all** client read and write --
`allow read, write: if false;` on each, plus a deny-by-default backstop match on everything
else. Being authenticated (anonymous or otherwise) is never treated as "authorized to write a
score" -- this is the rule that makes the client-writes-`{score: 999999}` attack Issue #87
names explicitly impossible, independent of and in addition to the Function's own validation.

Phase 1B denies client **reads** too (not only writes), stricter than Phase 0's own original
draft rules -- there is no ranking UI yet to justify opening `leaderboards/*/entries` to public
read, so it stays closed until Phase 2A's top100/own-rank UI actually needs it. Only the Cloud
Function's Admin SDK calls (which are not subject to Security Rules at all) can read or write
either collection today.

`firestore.indexes.json` predefines the `entries` collection's composite index (`score`
DESCENDING, `achievedAt` ASCENDING) ahead of Phase 2A actually querying it, so a first read-model
deploy doesn't also need an index-build wait.

## 16. Local / emulator setup

```bash
# One-time, only when you need to run the emulator (not a project dependency -- see below):
npm install --no-save @firebase/rules-unit-testing

# Functions: install, typecheck, lint, test, build (all emulator-free -- functions/src/
# submitLunchRushScore.test.ts uses an in-memory Firestore fake, not a real emulator):
cd functions && npm install
npm run typecheck && npm run lint && npm test && npm run build

# Firestore rules, against a real local emulator (from the repo root; requires a JDK -- the
# emulator itself is downloaded by firebase-tools, `npx firebase-tools setup:emulators:firestore`):
npx firebase-tools emulators:exec --only firestore \
  "npx vitest run --config vitest.rules.config.ts"

# Full local emulator suite (Auth + Functions + Firestore, with the Emulator UI), for manual
# end-to-end poking once a Firebase project id exists (copy .firebaserc.example -> .firebaserc
# and fill in a real or "demo-"-prefixed project id first):
npx firebase-tools emulators:start
```

`firestore.rules.test.ts` and `vitest.rules.config.ts` are committed (they document and prove
the rules work), but `@firebase/rules-unit-testing` itself is deliberately **not** a
`package.json` dependency of any workspace in this repo -- it is only ever needed for this one
manual verification, never for `npm test`/CI/the app itself, so it stays a `--no-save` local
install rather than permanent weight in every `npm ci`.

## 17. Deploy procedure (documentation only -- not run by this PR)

```bash
npx firebase-tools login                    # once, interactively
cp .firebaserc.example .firebaserc           # fill in your real Firebase project id
npx firebase-tools deploy --only firestore:rules,firestore:indexes,functions
```

`firebase.json`'s `functions[0].predeploy` runs `npm run build` inside `functions/` (the
esbuild bundle, section 13) automatically before every `functions` deploy -- there is no
separate manual build step. Deploying `firestore:rules`/`firestore:indexes` requires the
Firestore database to already exist for the target project (Manual Setup, section 20.2).

## 18. FAILED-serve semantics carried into the server

A `FAILED` completion (`src/logic/completionGate.ts`) never contributes to `servedCount`/
`totalQualityScore`/`bestQualityScore`/`score` -- both client-side (`missionRunReducer`'s
`SERVE` case, unchanged) and now server-side too:
`calculateLunchRushMissionScore` (`src/shared/lunchRushScoring.ts`) independently re-derives
this from the raw `serves[]` log rather than trusting a client-supplied count that already
excludes them. A `FAILED` entry is still included in the submitted `serves[]` (`qualityTotal`
forced to 0) rather than silently dropped, specifically so the server enforces this rule from
first principles instead of trusting the client's own prior filtering.

## 19. Phase 2A connection point (superseded by sections 21-26 below)

Phase 2A (first read model) reads `leaderboards/{periodId}/entries` directly from the client --
top100 (`orderBy("score", "desc"), orderBy("achievedAt", "asc"), limit(100)`) and an own-rank
query (Phase 0 audit §7 recommends Firestore's `count()` aggregation query) -- and will need to
loosen `firestore.rules`' current `allow read: if false;` on that collection to a public read
rule at that point, not before. No Firestore schema change is anticipated for Phase 2A itself
(section 14's schema was already designed with weekly/monthly/all-time in mind); the work is a
new client-side query module and a ranking UI, both explicitly out of Phase 1B's scope.

This section is the Phase 1B-era *plan*; see section 21 for what Phase 2A actually shipped
(weekly-only, TOP 10 rather than top100 -- a deliberate, documented scope narrowing for a
390px mobile screen and minimal Firestore reads, monthly/all-time/TOP 100 deferred to Phase 2B).

## 20. Manual Setup Required (Phase 1B additions)

Everything in section 8 (Phase 1A) still applies. Phase 1B adds:

1. **Firestore database creation** (Firebase Console -> Firestore Database -> Create database)
   -- Native mode, any region; not created by this PR.
2. **Blaze (pay-as-you-go) plan upgrade** -- Cloud Functions (2nd gen, callable) requires Blaze
   even at near-zero usage; this is a Firebase platform requirement, not a design choice, and
   is a real billing decision only the project owner can make.
3. **Firebase CLI login** (`npx firebase-tools login`) and a `.firebaserc` (copy
   `.firebaserc.example`, fill in the real project id) on whichever machine/CI runner will
   deploy.
4. **Deploy** `firestore.rules` / `firestore.indexes.json` / `functions` (section 17) -- not
   run by this PR; no code change in this repo can perform an actual deploy against a real
   Firebase project without real deploy credentials.
5. **GitHub Actions secrets/deploy wiring for Functions**, if Functions deploy is to be
   automated via CI -- out of scope for this PR (a Functions deploy needs its own credential
   (a service account or `firebase login:ci` token), never the client's own public
   `VITE_FIREBASE_*` values from section 4/Phase 1A, and never committed to this repo).

**Deliberately NOT required for Phase 1B**: App Check registration (Phase 0 audit's own
recommended timing is Phase 3B, once there's an actual public leaderboard worth scripting
against); any ranking UI Firebase Hosting/Pages change (GitHub Pages hosting is unchanged).

## 21. Phase 2A: weekly ranking (first read model)

Issue #87 Phase 2A. The first Lunch Rush ranking a player can actually see in-game: a weekly
TOP 10, opened from the RESULT screen's own "🏆 ランキングを見る" button. Monthly ranking,
all-time ranking, TOP 100, friend ranking, nicknames, avatars, rewards, seasons, App Check, and
push notifications are all explicitly out of scope for this phase -- see the Phase 2A Result
Report (`docs/reports/TETO_FIREBASE-RANKING_Phase2A_Result.md`) for the full scope decision.

```
Lunch Rush RESULT
  -> "🏆 ランキングを見る" button (MissionResultOverlay's own onShowRanking prop)
  -> WeeklyRankingOverlay (src/components/WeeklyRankingOverlay.tsx)
  -> src/firebase/getWeeklyLeaderboard.ts (this phase's one new client API)
     -> Firestore client read: leaderboards/{periodId}/entries
        (periodId = "weekly_" + isoWeekId(now), src/shared/lunchRushPeriodIds.ts)
```

## 22. Period id authority moved to `src/shared/`

`functions/src/periodIds.ts` (Phase 1B's own JST period-id derivation) moved to
`src/shared/lunchRushPeriodIds.ts` in this phase, alongside `./lunchRushScoring.ts` -- the
client's weekly leaderboard read needs to derive the exact same "which weekly period is 'this
week'" answer the server already computes at submission time, so this became the second module
both the Cloud Function and the browser share, instead of the client inventing a second,
potentially-drifting week-numbering implementation (this task's own "no client-invented period
ids" requirement). `functions/src/periodIds.ts` is now a one-line re-export of the moved file --
`functions/src/submitLunchRushScore.ts`'s own `import ... from "./periodIds"` and
`functions/src/periodIds.test.ts` are both unchanged and still pass. One function was added
during the move, `jstWeekRange(epochMs)` -- the Monday-Sunday JST calendar-date range for the
same ISO week `isoWeekId` already buckets by, used only for the ranking UI's "今週 9/14〜20"
label, never for period-id bucketing itself.

## 23. `getWeeklyLeaderboard()` (src/firebase/getWeeklyLeaderboard.ts)

The only new client API this phase adds, alongside `submitLunchRushScore` in `src/firebase/
index.ts`'s public surface. Deliberately the only file in `src/` that imports `firebase/
firestore` -- Phase 1B's "the client never writes to Firestore directly" posture is unchanged
(this module contains no `setDoc`/`addDoc`/`updateDoc`/`deleteDoc` at all, only reads), and no
other component/module should import `firebase/firestore` directly either -- everything goes
through this one function.

Read shape, per call:
1. `leaderboards/{periodId}/entries` (`periodId = "weekly_" + isoWeekId(now)`), `orderBy("score",
   "desc"), orderBy("achievedAt", "asc"), limit(10)` -- the exact `score DESC, achievedAt ASC`
   tie-break Phase 1B's own `upsertLeaderboardEntryIfHigher` was designed around (section 14),
   matched here in the Firestore query, the returned `top[]`'s own `rank` ordering, and this
   module's test suite alike (per this task's own "ordering must match everywhere" requirement).
2. Only when the signed-in uid's own entry is *not* already one of those 10 results: one
   single-doc read of the player's own `leaderboards/{periodId}/entries/{uid}`, plus (only if
   that doc exists) one `count()` aggregation query (`where("score", ">", ownScore)`) to derive
   an *approximate* rank -- see `WeeklyLeaderboardCurrentUserRank`'s own doc comment in that file
   for exactly why this doesn't replicate the `achievedAt ASC` tie-break for an outside-top-10
   exact score tie (a deliberately-scoped simplification, not a bug -- Phase 0 audit §7's own
   fully tie-broken design is deferred to Phase 2B if this approximation ever proves
   player-visible).

Every outcome -- Firebase unconfigured, no signed-in user, a network/permission error thrown by
the SDK -- resolves to a typed `GetWeeklyLeaderboardResult` (`"unavailable" | "error" |
"success"`) instead of throwing, mirroring `submitLunchRushScore`'s own "never fail the caller"
contract: a ranking-read failure can never be treated as a Lunch Rush gameplay failure.

## 24. Firestore Security Rules (Phase 2A loosening)

The one rule change this phase makes: `leaderboards/{periodId}/entries/{uid}` reads are now
allowed **only** when `periodId` starts with `"weekly_"` --

```
match /leaderboards/{periodId}/entries/{uid} {
  allow read: if periodId.matches('^weekly_.*');
  allow write: if false;
}
```

`monthly_*`/`all_all` stay exactly as read-denied as Phase 1B left them (no Phase 2A UI reads
them -- this task's own "必要最小限" / minimum-necessary-privilege requirement), and **every**
write (`weekly_*` included) stays denied exactly as Phase 1B left it -- Phase 2A does not loosen
write access at all, only this one narrow read path. The condition depends only on the
`periodId` path segment, never on `request.auth` -- Lunch Rush scores carry no personal
information (no uid is ever rendered in the UI), so a public weekly leaderboard's read access is
identical whether the requester is anonymous or authenticated. Verified against a real Firestore
emulator in `firestore.rules.test.ts` (14 scenarios total, see the Result Report for the full
list) -- run via:

```bash
npm install --no-save @firebase/rules-unit-testing   # once
npx firebase-tools emulators:exec --only firestore \
  "npx vitest run --config vitest.rules.config.ts"
```

## 25. Firestore index (no change needed)

`firestore.indexes.json`'s existing composite index (`entries` collection, `queryScope:
"COLLECTION"`, `score` DESCENDING + `achievedAt` ASCENDING -- predefined back in Phase 1B ahead
of Phase 2A actually needing it) already covers this phase's TOP 10 query as-is: a `queryScope:
"COLLECTION"` composite index applies to every collection sharing that collection ID at any
document path, so the single index entry transparently covers `leaderboards/weekly_2026-W38/
entries`, `leaderboards/weekly_2026-W39/entries`, etc., without one index per period. The
`getCountFromServer` own-rank query (`where("score", ">", ownScore)`, a single inequality filter
on one field) needs no composite index either -- Firestore's automatic single-field index
already supports it. **No `firestore.indexes.json` change was needed for Phase 2A.**

## 26. TOP 10, not TOP 100 (scope decision)

Issue #87's own original language says "Top 100 display" for the eventual Lunch Rush Ranking 1.0
product; this task's own Phase 2A brief explicitly asks for "スマホUIに適した小さな件数" (a small
count suited to a mobile UI) with TOP 10 as its own suggested candidate, "大量全件readは禁止"
(no bulk full-collection reads), and permits Phase 2A to decide the final count itself. TOP 10
was chosen: it fits the 390×844 (and 360×800) authority viewport in one screen with zero internal
scrolling (`WeeklyRankingOverlay`'s own `.ranking-overlay__list`, verified in browser -- see the
Result Report's screenshots), keeps every leaderboard read to at most 10 + 1 (own entry) + 1
(count aggregation) Firestore operations per open, and needs no pagination UI at all. A TOP 100
view (Issue #87's original, eventual target) is deferred to Phase 2B alongside monthly/all-time
ranking -- nothing in this phase's schema, rules, or index design blocks that later expansion
(section 25 above).
