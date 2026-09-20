# Lunch Rush Online Ranking 1.0 -- Phase 1B Result Report

Issue #87 ("Lunch Rush Online Ranking 1.0 -- weekly / monthly / all-time (Firebase
architecture)"), Phase 1B slice: **server-authoritative score submission foundation** (Cloud
Function + Firestore + Firestore Security Rules). No ranking UI is added by this PR.

## 1. Audited main SHA

`13151e8` ("Firebase ranking Phase 1A: foundation and anonymous auth (#113)"), fetched fresh
from `origin/main` at the start of this task. `claude/firebase-ranking-phase-1b-v7lfle` was
already at this exact commit (created for this task), so no rebase was needed at the start.

**Duplicate PR Gate #1** (task start): `git fetch origin`, then GitHub checked fresh -- Issue
#87 open (OWNER-authored); zero open PRs touch Firebase/Functions/Firestore/Ranking/Phase 1B
(the only closed PR in that scope is #113, Phase 1A, already merged into the SHA above); no
in-flight branch for this scope beyond this task's own designated branch. Concurrent-scope
branches named in this task's instructions (Recipe Expansion Batch 1B-B, Test Reliability 1A)
were not touched by anything in this PR.

**Duplicate PR Gate #2** (immediately before opening the PR): a fresh `git fetch origin`
showed `main` had advanced to `ef00ed7` ("Recipe Expansion Batch 1B-B: add Capricciosa
(#114)") in the interim. Re-checked GitHub: still zero open PRs in Firebase/Functions/Ranking/
Phase 1B scope. PR #115 ("Test Reliability 1A: eliminate phase4a1a randomized flake") is open
but **not yet merged into `main`**, so per this task's own instruction its known flake fix was
left untouched here -- it will be picked up automatically by a future `main` sync once it
merges. `git diff --name-only 13151e8 ef00ed7` confirmed zero file overlap between #114 and
this PR's own changes (#114 only touches recipe/ingredient data, its own tests, and its own
result report/screenshots). `origin/main` was merged into this branch (a clean, no-conflict
merge commit) and the full verification in section 12 was re-run afterward against the merged
tree.

## 2. Phase 1A baseline (fresh-audited, not assumed from memory)

- `src/firebase/{config,client,auth,index}.ts` exactly as Phase 1A shipped -- **zero
  modifications** to any of the three internal files. `index.ts` gained one new export
  (`submitLunchRushScore`, section 5) alongside its existing two.
- `firebase` npm dependency: `^12.19.0` (client SDK), unchanged. `firebase/functions` (the
  Callable client submodule this PR uses) ships inside that same package -- no new client
  dependency was added.
- Mission score authority pre-existing: `src/logic/missionScoring.ts` (`missionScore`,
  `recordServe`) -- **untouched** by this PR, still the realtime run-metrics accumulator every
  other part of the app reads.
- **Lunch Rush Completion Gate 1A (#110) was already merged** ahead of this task, and its own
  fix already applies: `src/mission/lunchRush.ts`'s `missionRunReducer` SERVE case already
  excludes a FAILED pizza from `servedCount`/`totalQualityScore`/`bestQualityScore` (confirmed
  by fresh-reading the file, not assumed). This closes the exact gap the reference Phase 0 audit
  branch (`claude/lunch-rush-ranking-phase0-cpu5ki`, unmerged, read as reference material only)
  had flagged as P0 in its own section 13/20 -- see section 11 below for the one remaining,
  score-irrelevant asymmetry this task's instructions asked to be freshly confirmed.
- `PersistentSaveV2` schema (`src/state/persistence.ts`): unchanged, no Firebase-related field.
- GitHub Pages base path (`vite.config.ts`) and both workflows
  (`.github/workflows/ci.yml`/`deploy.yml`): unchanged.

## 3. Architecture

```
Lunch Rush RESULT
  -> src/firebase/submitLunchRushScore.ts (ensureAnonymousUser, then a Callable invocation)
  -> Callable Cloud Function "submitLunchRushScore" (functions/src/index.ts)
     -> input validation + server-side score recomputation (functions/src/submitLunchRushScore.ts)
     -> Firestore Admin SDK write (runs/{autoId}, leaderboards/{periodId}/entries/{uid})
```

The client has **no `firebase/firestore` import anywhere in `src/`** -- score submission is a
Callable Function invocation only. The only trusted writer of `runs/*` and
`leaderboards/*/entries/*` is the Cloud Function's own Admin SDK call; `firestore.rules` denies
all client read/write to both collections regardless (defense in depth, not just convention --
section 9/10 below). Full architecture write-up:
`docs/design/TETO_FIREBASE-RANKING_SETUP.md` sections 10-20 (new in this PR).

## 4. Shared scoring authority

New: `src/shared/lunchRushScoring.ts` -- `calculateLunchRushMissionScore(serves[])`, pure,
deterministic, zero Firebase/framework dependency. Bundled into the Cloud Functions deploy via
`functions/`'s own esbuild step (no monorepo/workspace tooling exists in this repo, so a
bundler-time inline of the exact same source file was the simplest correct option for two npm
projects that must never hand-roll two copies of the same formula).

- Formula: `score = round(servedCount * 100 + totalQualityScore)`, matching
  `src/logic/missionScoring.ts`'s existing `missionScore` exactly, generalized to *apply* the
  Completion Gate itself from a raw `serves[]` log (a `FAILED` entry contributes nothing) rather
  than assuming the caller already filtered it.
- `src/mission/lunchRush.ts`'s `MissionState` gained one **additive** field, `serves:
  LunchRushServeRecord[]`, appended in the exact same `SERVE` reducer branch that already
  decides `metrics` (PASS and FAILED alike; a deadline-rejected SERVE appends nothing, same as
  `metrics`) and reset at the same two points `metrics` resets (`START`, `EXIT_TO_FREE`). This
  is what guarantees a submission can never disagree with the score the player already saw
  locally -- both are derived from the same reducer decision, not recomputed independently.
  `metrics`, `missionScore`, and every other existing Mission/gameplay behavior are
  byte-for-byte unchanged; `src/App.tsx`'s `SERVE` dispatch gained one new field
  (`recipeId: state.recipe.id`), already available at that call site.
- `src/logic/missionScoring.ts` itself: **untouched**, confirming this PR did not replace or
  fork the existing realtime accumulator.

## 5. Payload (`ScoreSubmissionV1`-shaped request)

```ts
{
  rulesetVersion: "lunch-rush-v1",
  missionId: "lunch-rush",
  clientDurationMs: number,   // advisory only, never the ranking authority
  serves: Array<{ recipeId: string; qualityTotal: number; completionStatus: "PASS" | "FAILED" }>;
}
```

No `uid` field (taken only from the Callable Function's own `request.auth.uid` -- client
supplied uid is structurally impossible, not merely rejected) and no `score`/`servedCount`/
`totalQualityScore`/`bestQualityScore` fields at all. This is a deliberately stronger property
than "recompute and cross-check the client's claim": there is nothing in this payload shape for
a tampering client to even attempt on those fields, because the server never reads them from the
request in the first place -- any extra field a hand-crafted request adds (`score: 999999`,
etc.) is simply ignored (verified by test, section 12).

## 6. Cloud Function (`submitLunchRushScore`)

`functions/src/submitLunchRushScore.ts` (`handleSubmitLunchRushScore`) -- validate -> recompute
-> write, written against a narrow `FirestoreLike` port (two methods: `createRun`,
`upsertLeaderboardEntryIfHigher`) rather than calling `admin.firestore()` directly.
`functions/src/index.ts` is the only file that wires this to the real Admin SDK
(`initializeApp()`, `getFirestore()`, a transaction per leaderboard upsert) and the real
`onCall` v2 trigger, translating `SubmitLunchRushScoreError` into `HttpsError`.

Validation order (each throws `invalid-argument` or `unauthenticated`, no Firestore write on
any rejection): unauthenticated -> reject; non-object/wrong `rulesetVersion`/wrong
`missionId`/non-array `serves`/oversized `serves` array (>200, defense-in-depth payload guard)
-> reject; negative or implausibly large `clientDurationMs` -> reject; any serve entry with a
non-string/empty `recipeId`, non-finite/negative/`>100` `qualityTotal`, or unknown
`completionStatus` -> reject; recomputed `servedCount` exceeding `MAX_SERVES_PER_RUN` (derived
from the ruleset's fixed 180s duration and a conservative minimum-seconds-per-serve floor) ->
reject. Everything that survives: one `runs/{autoId}` ledger write (Admin-SDK auto-id, never a
client-supplied id), then a per-period (`weekly`/`monthly`/`all-time`) upsert-if-higher into
`leaderboards/{periodId}/entries/{uid}`, in parallel, each inside its own Firestore transaction.

**Node runtime: Node 20.** Matches this repo's own root CI/deploy Node version
(`.github/workflows/ci.yml`/`deploy.yml`) for repo-wide consistency, and is a currently
Firebase-supported Cloud Functions Gen 2 runtime (`nodejs20`). `firebase-admin` was
deliberately pinned to the `^13` major, not the newer `^14` (which requires Node >=22, verified
via `npm view firebase-admin@14 engines`) -- staying on Node 20 avoided introducing a second
Node version into the project just for this one workspace. `firebase-functions ^7` supports
Node >=18 either way.

## 7. Firestore schema

| Collection / Doc | Field | Type | Authority |
|---|---|---|---|
| `runs/{runId}` (Admin SDK auto-id) | `uid` | string | server (`request.auth.uid`) |
| | `rulesetVersion`, `missionId` | string | server-validated |
| | `clientDurationMs` | number | client-reported, range-checked, advisory only |
| | `servedCount`, `totalQualityScore`, `bestQualityScore`, `score` | number | **server-recomputed** from `serves[]`, never trusted from the client |
| | `serves` | array | client-reported, per-entry validated |
| | `submittedAt` | Timestamp | server (`FieldValue.serverTimestamp()`) |
| `leaderboards/{periodId}/entries/{uid}` | `score` | number | server, upsert-only-if-**strictly**-higher |
| | `achievedAt` | Timestamp | server; untouched by a tied/lower resubmission |
| | `sourceRunId` | string | server (the `runs/{runId}` this entry's score came from) |

`periodId` is one of `weekly_{ISO week, e.g. "2026-W38"}`, `monthly_{YYYY-MM}`, or the constant
`all_all` -- all three are upserted on **every** accepted submission, giving weekly/monthly/
all-time the structure to extend into without a future schema change, even though this PR
builds no read/UI path for any of them. `firestore.indexes.json` predefines the `entries`
collection's composite index (`score` DESC, `achievedAt` ASC) ahead of Phase 2A actually
querying it.

Period ids: `functions/src/periodIds.ts`, pure functions, Asia/Tokyo (fixed UTC+9, no DST),
derived **only** from the Cloud Function's own clock (`Date.now()` at submission-processing
time) -- never any client-supplied timestamp. ISO-8601 week numbering correctly resolves the
year-boundary edge case (verified by test: 2025-12-29 JST, a Monday, already belongs to ISO
year 2026's week 1; 2026-12-31/2027-01-01 JST both belong to `2026-W53`, a 53-week year).

## 8. Security Rules

`firestore.rules` (repo root): both `runs/{runId}` and `leaderboards/{periodId}/entries/{uid}`
deny **all** client read and write (`allow read, write: if false;`), plus a deny-by-default
backstop on every other collection. Being authenticated (anonymous or otherwise) is never
treated as "authorized to write a score" -- this rule makes the exact `{ score: 999999 }`
direct-write attack Issue #87 names impossible, independent of and in addition to the
Function's own validation (defense in depth: even a hypothetical bug in the Function's
validation could not be exploited via a direct client write, because Security Rules deny it at
a different layer entirely). Client **reads** are denied too, stricter than the Phase 0 audit's
own original draft -- there is no ranking UI yet to justify opening `leaderboards/*/entries` to
public read, so it stays closed until Phase 2A actually needs it (section 20 marks this as the
one rule change Phase 2A itself must make).

**Verified against a real Firestore emulator, not just read for correctness** (section 12):
`firestore.rules.test.ts` + `vitest.rules.config.ts`, run via
`npx firebase-tools emulators:exec --only firestore "npx vitest run --config vitest.rules.config.ts"`.
**8/8 tests passed**: an authenticated client cannot read or write `runs/*`; cannot read or
write `leaderboards/*/entries/*` (including writing to a *different* uid's own entry); the
deny-by-default backstop rejects reads/writes on an entirely unmatched collection; and a
`withSecurityRulesDisabled` sanity check confirms the test harness itself is actually exercising
the rules engine (not silently no-op-passing).

## 9. Auth handling

`src/firebase/submitLunchRushScore.ts` calls `ensureAnonymousUser()` (Phase 1A, unmodified)
before every Callable invocation, reusing an existing/restored session rather than always
minting a fresh sign-in. `uid` is never read from anywhere in `src/` beyond that -- the
Function itself trusts only `request.auth.uid` (the Callable SDK's own verified auth context,
populated by Firebase, not user-controllable).

## 10. Anti-tamper behavior (Issue #87's core requirement)

- **Client direct Firestore write: structurally impossible.** No `firebase/firestore` import
  exists anywhere in `src/`; even if one were added by a future change, `firestore.rules` would
  still deny it.
- **Client-supplied score is not the authority, and cannot even be smuggled in.** The payload
  shape has no `score`/`servedCount`/`totalQualityScore`/`bestQualityScore` fields at all --
  the server always derives these from `serves[]` via the shared formula. Verified by test
  (`F: a client-supplied score/servedCount field is ignored`): a payload with
  `score: 999999, servedCount: 999, totalQualityScore: 999` added still returns the correctly
  recomputed `score: 180` for a single 80-quality PASS serve, and the `runs/` document records
  `180`, never `999999`.
- **uid spoofing: impossible**, not merely rejected. Verified by test (`E`): a payload with an
  extra `uid: "attacker-controlled-uid"` field is ignored; every Firestore write uses only the
  auth-context uid.
- **Impossible values rejected**: negative/`>100` quality, negative/absurd `clientDurationMs`,
  an oversized `serves` array, and a `servedCount` exceeding the ruleset-duration-derived
  theoretical maximum are all rejected before any Firestore write (tests `C`/`D`).
- **Server timestamp authority**: `achievedAt`/`submittedAt` are always the injected
  `FieldValue.serverTimestamp()` sentinel; period-id derivation reads only the server's own
  clock. Verified by test (`L`).

## 11. FAILED semantics and the Dex/Starter Grant asymmetry (this task's item 11)

Freshly re-confirmed directly in `src/state/gameReducer.ts` (not assumed from any prior report):

- **`MISSION_NEXT_ORDER`'s Dex/`timesMade`/BEST/Starter Grant registration is unconditional on
  `state.completion`** -- a FAILED pizza still registers into the Dex and can still trigger a
  Starter Grant, exactly as the reducer's own comment (lines ~868-875) documents as a
  **deliberate, explicitly-scoped-out** decision, not an oversight: *"FREE-only completion
  gating on Dex itself (REGISTER_TO_DEX above) is untouched scope, not an oversight."*
- **This asymmetry exists.** It was not fixed by this PR, per this task's own instruction not
  to unilaterally fix out-of-scope behavior that doesn't affect ranking score integrity.
- **Competitive score impact: none.** `MISSION_NEXT_ORDER`'s Dex/Starter Grant registration and
  Lunch Rush's own `servedCount`/`totalQualityScore`/`bestQualityScore`/`missionScore` are two
  fully independent code paths -- the former lives in `gameReducer.ts` and touches
  `dex`/`ownedIngredientIds`/`inventory`/`starterGrantClaimedRecipeIds`; the latter lives one
  layer up in `App.tsx`'s `handleMissionServeNext` + `missionRunReducer`'s `SERVE` case (already
  gated on `state.completion`, confirmed unchanged by this PR) and now also
  `src/shared/lunchRushScoring.ts`'s server-side recomputation (section 4/6). Neither
  `calculateLunchRushMissionScore` nor the Cloud Function reads `dex`/Starter Grant state at
  all -- there is no path from this asymmetry into a submitted score.
- **Follow-up needed: none for Phase 1B/ranking.** This remains a legitimate, separate Mission-
  balance/Dex-progression question (should a FAILED Mission pizza register into the Dex at
  all?) that a future phase can decide on its own merits, entirely decoupled from ranking score
  integrity. Not blocking this PR.

## 12. Tests

New/changed test files, all passing:

| File | Tests | Notes |
|---|---|---|
| `src/shared/lunchRushScoring.test.ts` (new) | 21 | A-I from this task's shared-score spec, plus validation edge cases |
| `src/mission/lunchRush.test.ts` (modified: +`serves` field throughout, +new `serves log` describe block) | 46 | All pre-existing behavior re-verified unchanged; 6 new tests for the `serves` log |
| `src/firebase/submitLunchRushScore.test.ts` (new) | 6 | Unavailable/auth-unavailable/success/failure/caching |
| `functions/src/periodIds.test.ts` (new) | 11 | ISO week/month derivation, year-boundary edge cases |
| `functions/src/submitLunchRushScore.test.ts` (new) | 21 | A-L from this task's Function spec, against an in-memory Firestore fake |
| `firestore.rules.test.ts` (new, not part of `npm test`) | 8 | Against a real Firestore emulator (section 8) |

- **Root full suite**: `npx vitest run` -- **1737 passed**, **89 test files**, 0 failed, run
  after the Duplicate PR Gate #2 merge (section 1). Phase 1A baseline was 1682/87 files; this
  PR's own changes add 32 tests/2 files net in `src/` (1714/89 measured pre-merge), and the
  merged-in Recipe Expansion Batch 1B-B (#114) independently adds a further 23 tests to
  existing files (no new files) -- 1682 + 32 + 23 = 1737, reconciling exactly.
- **Root `tsc -b`**: clean, 0 errors.
- **Root `oxlint`**: clean, 0 warnings/errors.
- **Root `npm run build`**: succeeds with zero `VITE_FIREBASE_*` set (unchanged Phase 1A
  property, reverified).
- **`functions/` typecheck** (`tsc --noEmit`, covering `functions/src/**` +
  `src/shared/**` via its own `tsconfig.json`): clean, 0 errors.
- **`functions/` `oxlint src`**: clean, 0 warnings/errors.
- **`functions/` `vitest run`**: **32 passed**, 2 test files, 0 failed.
- **`functions/` `npm run build`** (esbuild bundle): succeeds, `lib/index.js` (7.2kb),
  externalizing `firebase-admin`/`firebase-functions`; smoke-tested with a direct
  `import()` in Node -- loads without error (Admin SDK's `initializeApp()` at module scope does
  not throw synchronously with no credentials present, as expected for a cold-start-safe
  module).

## 13. Emulator status

**Firestore emulator: downloaded and exercised successfully** (`cloud-firestore-emulator-v1.22.0.jar`,
via `npx firebase-tools setup:emulators:firestore`) -- network access to Firebase's emulator
distribution worked in this environment despite an initial CLI MOTD-fetch warning (unrelated,
non-fatal). `firestore.rules.test.ts` ran against it end-to-end (section 8), 8/8 passed.

**Functions/Auth emulators: not exercised** -- not needed, since `functions/src/
submitLunchRushScore.test.ts`'s 21 tests already cover every scenario in this task's Function
spec (A-L) against an in-memory `FirestoreLike` fake (section 6), which is faster and more
deterministic than an emulator-backed integration test for pure validation/business logic, and
the real Admin SDK wiring (`functions/src/index.ts`) is a thin, directly-reviewable adapter
(two methods) rather than logic that itself needs emulator coverage. A full
`firebase emulators:start` (Auth + Functions + Firestore + UI) is documented
(`docs/design/TETO_FIREBASE-RANKING_SETUP.md` section 16) for future manual end-to-end poking
once a real Firebase project id exists, but was not run as part of this PR's own verification.

`@firebase/rules-unit-testing` was installed with `--no-save` specifically so it never becomes
a permanent `package.json`/`package-lock.json` dependency of any workspace -- `git status`
confirms `package.json`/`package-lock.json` are unmodified by this PR.

## 14. Browser verification

Production-equivalent build (`vite preview`, zero `VITE_FIREBASE_*` set) at **390x844**,
Chromium (Playwright, headless):

| Screen | Loaded | Console/page errors | Horizontal overflow |
|---|---|---|---|
| HOME | Yes (buttons: 設定/ピザを作る/ランチラッシュ/図鑑/ショップ/材料/実績) | None | None (scrollWidth == clientWidth == 390) |
| Lunch Rush INTRO (via "ランチラッシュ") | Yes | None | None |
| Lunch Rush PLAYING (via "スタート") | Yes | None | None |

Zero console errors, zero uncaught page errors, zero horizontal overflow across all three
screens -- this exercises the new mount-time-adjacent code paths (`isFirebaseAvailable()`
guards, the new submission `useEffect` in `App.tsx`) with Firebase fully unconfigured, exactly
the state of every build until Manual Setup (section 15) happens. The Mission RESULT screen
itself was **not** reached in-browser (production Mission duration is a real 180s; the
`?missionDuration=` dev-only override is `import.meta.env.DEV`-gated and dead-code-eliminated
from this production-equivalent preview build, matching Phase 1A's own report) -- RESULT-phase
behavior (the submission effect firing once per `runId`, `serves` log correctness) is instead
covered by the reducer/effect-level unit tests in section 12, which is where Phase 1A's own
precedent also drew this same line.

## 15. Manual Setup Required

Everything from Phase 1A's own Manual Setup (still required, unchanged) plus, new in Phase 1B
(`docs/design/TETO_FIREBASE-RANKING_SETUP.md` section 20 has the full walkthrough):

1. **Firestore database creation** (Firebase Console) -- not created by this PR.
2. **Blaze (pay-as-you-go) plan upgrade** -- a Firebase platform requirement for Cloud
   Functions 2nd gen callable functions, not a design choice; a real billing decision only the
   project owner can make.
3. **Firebase CLI login** + a `.firebaserc` (copy `.firebaserc.example`, new in this PR, and
   fill in a real project id) on whichever machine/CI runner will deploy.
4. **Deploy** `firestore.rules` / `firestore.indexes.json` / `functions` -- not run by this PR;
   no code change here can perform an actual deploy without real deploy credentials.
5. **GitHub Actions secrets/deploy wiring for Functions**, only if Functions deploy is to be
   automated later -- out of scope for this PR.

Explicitly **not** required for Phase 1B: App Check registration (Phase 0 audit's own
recommended timing is Phase 3B).

## 16. Deployment status

**Nothing was deployed to any real Firebase project by this PR.** No `firebase deploy` was run;
no real Firebase project credentials exist in this environment (consistent with Phase 1A's own
report and this task's own instructions). All verification in sections 12-14 used either local
unit tests, an in-memory fake, or a local Firestore emulator -- never a live project.

## 17. Phase 2A prerequisites

- The Manual Setup items in section 15, completed by the project owner.
- A real Firebase project with Functions/Firestore actually deployed, so Phase 2A's read model
  has real data to query against.
- `firestore.rules`' current `allow read: if false;` on `leaderboards/*/entries` loosened to a
  public read rule -- deliberately not done ahead of Phase 2A actually needing it (section 8).
- No Firestore schema change anticipated (section 7's schema was already designed with weekly/
  monthly/all-time in mind) -- Phase 2A's own work is a new client-side query module (top100 +
  own-rank) and a ranking UI, both explicitly out of this PR's scope.

## 18. Risks

- **`MAX_SERVES_PER_RUN`'s minimum-seconds-per-serve floor is a judgment call, not measured
  telemetry** (carried forward from the Phase 0 audit's own flagged risk) -- should be
  revisited once real submission data exists, to avoid either false-rejecting a genuinely fast
  player or being too loose to matter.
- **`serves[]` forgery ceiling**: server-side recomputation-and-range-check (this PR) catches
  the "trivial" attack class (raw score/uid tampering, direct Firestore write) but not a
  patient, plausible-looking forged `serves[]` array from a scripted client -- this is an
  accepted, disclosed limitation matching Issue #87's own "risk reduction, not perfect
  prevention" framing; full replay/deterministic-verification is explicitly Phase 3+ scope.
- **Anonymous-account leaderboard stuffing** (sockpuppet accounts): not addressed by this PR
  (App Check is Phase 3B per the Phase 0 audit's own recommended timing) -- an accepted,
  disclosed limitation of a free anonymous-first casual leaderboard, not a Phase 1B blocker.
- **Functions/Auth emulator integration path is undocumented-by-execution** (only Firestore
  rules were emulator-verified, section 13) -- the Admin SDK adapter in `functions/src/
  index.ts` is thin and directly reviewable, but a future phase adding more Firestore
  read/write surface should consider full-stack emulator tests before that surface grows.
- **The Dex/Starter Grant asymmetry (section 11)** remains open as a Mission-balance question,
  confirmed score-irrelevant but still a real product inconsistency (a FAILED pizza can
  currently still unlock ingredients/register Dex progress in Lunch Rush) worth its own
  follow-up issue outside ranking scope.

## 19. Final Verdict

**B. READY WITH MANUAL SETUP**

The code is safe to merge as-is: offline gameplay is provably unaffected (root suite unchanged
in behavior and fully passing -- 1737/1737 post-merge, zero Firebase env build succeeds, byte-for-byte-
unmodified `missionScoring.ts`/save/reset code paths), the server-authoritative submission path
is complete end-to-end in code (validated by 68 new unit tests across three workspaces plus 8
real-emulator Firestore Rules tests), and every anti-tamper requirement from Issue #87's own
security section is either structurally impossible (direct Firestore write, uid spoofing,
score-field tampering) or actively rejected server-side (impossible values, unknown
ruleset/mission id, oversized payload). Nothing is blocking at the code level. The "with Manual
Setup" qualifier reflects exactly what it did in Phase 1A: this PR cannot itself create a
Firestore database, upgrade to Blaze, or deploy Functions/Rules against a real project -- those
remain the project owner's own actions (section 15), and until they happen,
`submitLunchRushScore` stays inert (Firebase unconfigured -> `isFirebaseAvailable()` false ->
the submission call never fires) exactly like Phase 1A's Anonymous Auth did before its own
Manual Setup was completed.
