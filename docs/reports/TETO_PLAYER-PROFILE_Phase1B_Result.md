# Player Profile 1.0 -- Phase 1B (Ranking Display-Name Integration) -- Result

Issue #129. Implements the design/audit recorded in `docs/design/TETO_PLAYER-PROFILE_1.0.md`
(Phase 0) section 9's "Phase 1B -- Ranking display-name integration" slice, on top of Phase 1A
(`docs/reports/TETO_PLAYER-PROFILE_Phase1A_Result.md`, PR #131): the submitting player's own
`users/{uid}.displayName` is denormalized onto their weekly/monthly/all-time leaderboard entries
at trusted-submission time, and the weekly ranking overlay renders it alongside rank and score.

## 0. Fresh Sync / Duplicate Gate

- Fetched `origin/main`. HEAD was already exactly the Phase 1A merge commit
  (`fbac50da7b3a6da8e31c3399b8986e5d692e2f7b`) -- no drift to reconcile; `git diff --stat
  origin/main` against this branch shows only this phase's own 10 changed files.
- Branch: `claude/ranking-display-name-snapshot-brclvx`, created from that same commit.
- Searched for an already-open PR against Issue #129/Phase 1B before writing any code
  (`mcp__github__list_pull_requests`, state `open`): none exists. Two stale, differently-scoped
  branches share a similar name (`claude/firebase-ranking-phase-1b-v7lfle`,
  `claude/weekly-ranking-phase-2a-v8hrwa`) but both predate and are unrelated to Issue #129 --
  they implement Issue #87's own (already-shipped, already-merged) Phase 1B/2A score-submission
  and ranking-read foundation, not this issue's display-name work. **No duplicate implementation
  found; proceeded.**
- Read directly from current source before writing anything: Issue #129 (GitHub), PR #131
  (GitHub), `docs/design/TETO_PLAYER-PROFILE_1.0.md`,
  `docs/reports/TETO_PLAYER-PROFILE_Phase1A_Result.md`, `functions/src/submitLunchRushScore.ts`
  (+`.test.ts`), `functions/src/index.ts`, `functions/src/setDisplayName.ts`,
  `src/shared/displayNameValidation.ts`, `src/firebase/{getWeeklyLeaderboard,getMyProfile,
  index}.ts` (+ their `.test.ts` files), `src/components/WeeklyRankingOverlay.tsx` (+
  `.test.tsx`), `firestore.rules`, `src/App.css`'s existing `.ranking-overlay__*` rules.
- **Pizza Cutting Phase 3**: not touched. No file under its ownership was read or modified.

## 1. Leaderboard schema

### 1.1 Previous shape (Phase 1A and earlier)

`leaderboards/{periodId}/entries/{uid}`:

| Field | Type |
|---|---|
| `score` | number |
| `achievedAt` | Timestamp |
| `sourceRunId` | string |

No name of any kind.

### 1.2 New, backward-compatible shape (this phase)

| Field | Type | Notes |
|---|---|---|
| `score` | number | unchanged |
| `achievedAt` | Timestamp | unchanged |
| `sourceRunId` | string | unchanged |
| `displayName` | string | **new** -- written only when this call's entry write actually happens (the existing "new best" conditional branch, unchanged); a pre-existing entry that never becomes a new best again keeps no `displayName` field at all, forever, until it does. |

Every existing production entry (100% of current leaderboard data) has no `displayName` field
and is never migrated -- both `getWeeklyLeaderboard.ts` and the underlying entry-read path treat
a missing/empty/malformed field as `FALLBACK_DISPLAY_NAME` (section 3), not an error.

## 2. Server-side denormalization (Option A, design doc section 4.2)

`functions/src/submitLunchRushScore.ts`:

- `FirestoreLike` gained one new read method, `getDisplayName(uid): Promise<string | null>`,
  and `upsertLeaderboardEntryIfHigher` gained one new parameter, `displayName: string`.
- Inside `handleSubmitLunchRushScore`, **after** score computation and the `runs` ledger write,
  and **before** the three (weekly/monthly/all-time) `Promise.all` upsert calls: one single call
  to `deps.firestore.getDisplayName(auth.uid)` -- always keyed by the Callable Function's own
  verified `auth.uid`, never any payload field (there is no `displayName` field in
  `SubmitLunchRushScoreRequestPayload`'s shape at all, so there is nothing on the wire to spoof).
  The resolved name is then passed to all three upsert calls -- **one read per submission, not
  one read per period.**
- `functions/src/index.ts`'s real Admin SDK adapter implements `getDisplayName` as a plain
  (non-transactional) `db.collection("users").doc(uid).get()`, and writes `displayName` inside
  the same `tx.set(ref, { score, achievedAt, sourceRunId, displayName })` call the existing
  "new best" transaction already performs -- a losing/no-op submission's transaction branch is
  unchanged (returns `false`, writes nothing), so `displayName` is written on exactly the same
  occasions `score`/`achievedAt`/`sourceRunId` already are, never more often.

## 3. Snapshot authority and fallback resolution

`resolveDisplayNameSnapshot` (new, `submitLunchRushScore.ts`):

```
raw === null                                    -> FALLBACK_DISPLAY_NAME
normalizeAndValidateDisplayName(raw) succeeds    -> the normalized value
normalizeAndValidateDisplayName(raw) throws      -> FALLBACK_DISPLAY_NAME
```

`FALLBACK_DISPLAY_NAME` (`"ななしピザ職人"`) moved from `src/firebase/getMyProfile.ts` to
`src/shared/displayNameValidation.ts` (framework-free, so `functions/` can import it without
pulling in any Firebase client SDK) and re-exported from `getMyProfile.ts` unchanged, so
`SettingsOverlay.tsx`'s existing import (`../firebase`'s `FALLBACK_DISPLAY_NAME`) needed no
change.

This reuses Phase 1A's own `src/shared/displayNameValidation.ts` validation contract verbatim on
the **read-back** path, per this task's own instruction not to trust a Firestore value
unconditionally just because it came from Firestore -- a `users/{uid}` document can in practice
only ever contain an already-validated name (it is only ever written by `setDisplayName`'s own
validated write path), but this re-validates defensively anyway, covering a legacy/corrupted
document however unlikely. Verified by dedicated tests (section 7): a profile displayName that
now fails validation (e.g. contains a stray control character, or exceeds 20 codepoints because
the contract itself were ever loosened/tightened out of sync) falls back cleanly instead of
propagating a bad value or crashing the submission.

## 4. Legacy compatibility

- **Server**: `getDisplayName` returns `null` for any `users/{uid}` document that doesn't exist,
  has no `displayName` field, or has a non-string `displayName` -- resolved to
  `FALLBACK_DISPLAY_NAME` by `resolveDisplayNameSnapshot`, same as every other "no profile"
  case already handled since Phase 1A.
- **Client**: `getWeeklyLeaderboard.ts`'s new `resolveEntryDisplayName` treats a missing,
  non-string, or empty-string `displayName` field on an entry document identically --
  `FALLBACK_DISPLAY_NAME`. A pre-Phase-1B leaderboard entry (no field at all) and a
  Phase-1B-written entry for a nameless player (field present, value `"ななしピザ職人"`) render
  identically.
- **No migration, no backfill.** Every existing leaderboard document is left exactly as-is;
  it only gains a `displayName` field the next time its own player beats their existing best for
  that period (unchanged personal-best semantics, section 5).

## 5. Rename / personal-best interaction (Fresh Audit against current code)

Audited `upsertLeaderboardEntryIfHigher`'s existing semantics directly from
`functions/src/index.ts` before changing anything: **personal-best-only entry update**, strictly
greater score required (`existingScore >= score` is a no-op, ties included) -- this phase changes
none of that comparison logic, only adds `displayName` to the same conditional write.

Consequences, verified by dedicated tests (section 7):

- **A rename alone never retroactively rewrites a past entry.** `setDisplayName` (Phase 1A)
  writes only `users/{uid}`; it has no leaderboard-entry write path at all, so an existing
  `leaderboards/*/entries/{uid}` document is untouched by a rename with no accompanying score
  submission, exactly as Phase 0's design doc section 4.3 documents.
- **A losing (non-best) submission does not overwrite an existing entry's `displayName`** with a
  name that changed in between -- the whole write (score, achievedAt, sourceRunId, displayName)
  is one atomic no-op together, not four independently-conditional fields.
- **A new-best submission always picks up whatever `users/{uid}.displayName` is current at that
  moment** -- "name at time of achievement," matching the already-documented, accepted staleness
  limitation (design doc section 4.3; a future Phase 2B `onWrite` trigger, Option C, remains the
  documented fix if this ever becomes a real complaint -- not built here).
- **Renaming never changes score, ordering, or which submission counts as a new personal best.**
  `calculateLunchRushMissionScore`, the `score DESC, achievedAt ASC` tie-break, and the
  strictly-greater comparison are entirely untouched by this phase -- verified by a dedicated
  test asserting two submissions with the same score under two different names produce the same
  `score`/`isNewAllTimeBest` outcome as before this phase shipped.

## 6. Client fetch / types

`src/firebase/getWeeklyLeaderboard.ts`:

- `WeeklyLeaderboardEntry` and `WeeklyLeaderboardCurrentUserRank` both gain a **required**
  `displayName: string` field -- always a renderable, non-empty string (fallback already
  resolved inside this module), so no caller needs its own null-check/fallback branch.
- `resolveEntryDisplayName(value: unknown): string` -- a type/presence guard only (not a second
  content-validation pass; see section 3), applied to both the TOP-10 mapping and the
  outside-TOP-10 own-rank mapping.
- **No new Firestore read.** The name rides the already-fetched `leaderboards/*/entries` document
  fields exactly like `score`/`achievedAt` always have -- confirmed by a dedicated test
  (`resolving displayName performs no extra users/{uid} profile read (no N+1)`) asserting
  `getDocs` is called exactly once for a 10-row TOP-10 fetch and `getDoc` (the single-doc,
  profile-shaped read) is never called on that path at all.

## 7. Focused tests (written this phase)

| File | New tests | What they cover |
|---|---|---|
| `functions/src/submitLunchRushScore.test.ts` | 12 | profile present -> denormalized; no profile -> fallback; empty-string profile -> fallback; malformed/control-character profile -> fallback (submission still succeeds, score unaffected); 21-codepoint legacy profile -> fallback; client-supplied `displayName` payload field ignored; user A's submission can never denormalize user B's name; rename alone doesn't retroactively alter an existing entry; a losing submission doesn't overwrite displayName; a new-best submission after a rename picks up the latest name; displayName never influences score/ordering/personal-best; `getDisplayName` called exactly once per submission (not once per period). |
| `src/firebase/getWeeklyLeaderboard.test.ts` | 5 | present displayName parsed through; legacy missing field -> fallback; malformed (non-string) field -> fallback; empty-string field -> fallback; no N+1 profile read; existing F/outside-top-10 tests extended with displayName assertions. |
| `src/components/WeeklyRankingOverlay.test.tsx` | 6 | Japanese name; ASCII name; 20-codepoint (max-length) name renders without breaking layout markup; fallback name; own-row name alongside あなた badge; Firebase-unavailable renders no name markup; existing TOP-10/current-user/outside-top-10/long-score tests extended with displayName assertions. |

**Total new: 23** (12 functions-side + 11 root-side) -- matches the root suite's own +11 delta
(2013 -> 2024) and the functions suite's own +12 delta (60 -> 72) exactly (section 10).

## 8. Security review

| Check | Result |
|---|---|
| Client cannot choose ranking displayName | `SubmitLunchRushScoreRequestPayload` has no `displayName` field; even if a client sends one (tested explicitly), it is never read. The only source is the trusted Function's own `getDisplayName(auth.uid)` read. |
| Client cannot choose UID | Unchanged from Phase 0/1A/Issue #87 -- `uid` is always `request.auth.uid`; verified again in this phase's own "user A cannot cause user B's name" test. |
| `request.auth.uid` authority maintained | `getDisplayName` is called with exactly `auth.uid`, never any payload-suppliable value. |
| `users` collection not made public | **No `firestore.rules` change in this phase.** The new read (`functions/src/index.ts`'s `getDisplayName`) is an Admin SDK read, which bypasses Security Rules entirely -- the existing `users/{uid}` rule (owner-only read, all writes denied) is completely untouched and still fully enforced for every client. |
| Direct leaderboard writes remain denied | `firestore.rules`' `leaderboards/{periodId}/entries/{uid}` rule (`allow write: if false` for every client) is untouched; the only writer remains the Function's Admin SDK transaction. |
| displayName cannot alter score | Verified by a dedicated test: two submissions with the same `serves[]` but different profile names at write time produce identical `score`. |
| displayName cannot alter rank | The upsert's score-comparison logic (`existingScore >= score`) is untouched by this phase; `displayName` is not part of that comparison at all. |
| No score authority regression | `calculateLunchRushMissionScore` and every A-L validation branch in `handleSubmitLunchRushScore` are unmodified; all of Phase 1B (Issue #87)'s own pre-existing test scenarios pass unchanged. |
| No N+1 profile reads (ranking read path) | Confirmed by test (section 6) -- `getWeeklyLeaderboard` performs the same `getDocs`/`getDoc`/`getCountFromServer` call counts as before this phase, regardless of how many rows carry a `displayName`. |
| Malformed/legacy leaderboard documents safe | `resolveEntryDisplayName` (client) and `resolveDisplayNameSnapshot`'s own re-validation (server, on the profile read-back path) both fail closed to `FALLBACK_DISPLAY_NAME` rather than throwing or rendering a raw/unsafe value. |
| No Firebase secret / credential committed | `git status`/`git diff` against `origin/main` show only this phase's own 10 source/doc files -- no `.env`, service-account key, or other credential file touched. |

## 9. UI result

`src/components/WeeklyRankingOverlay.tsx`: a new `.ranking-overlay__name` `<span>` inserted
between rank and score on every row (TOP-10 rows and the own-rank-outside-TOP-10 row), carrying
a `title` attribute (native browser tooltip for a truncated name) equal to the full,
un-truncated name.

`src/App.css`: `.ranking-overlay__name` is `flex: 1; min-width: 0; overflow: hidden;
text-overflow: ellipsis; white-space: nowrap;` -- this is what lets a long name truncate with an
ellipsis instead of wrapping the row or pushing score/rank off-screen. `.ranking-overlay__rank`,
`.ranking-overlay__score`, and `.ranking-overlay__you-badge` all gained `flex-shrink: 0` so none
of them is ever squeezed illegibly by a long name -- rank, score, and the あなた badge stay at
their full, fixed width regardless of name length. Information hierarchy: rank (bold, fixed-width,
leftmost) -> name (flexible, truncates) -> score (bold, fixed-width, right-aligned) -> あなた badge
(fixed-width, rightmost) -- score's own visual weight (font-weight 700, unchanged from before this
phase) is unaffected by the new name column.

### 390x844 (authority viewport)

- TOP-10, mixed Japanese/ASCII/emoji/20-codepoint names, current-user highlight + あなた badge:
  `docs/reports/screenshots/player-profile-1b/ranking-top10-390x844.png`
- Own rank outside TOP-10, long own-name truncation:
  `docs/reports/screenshots/player-profile-1b/ranking-outside-390x844.png`
- No records this week:
  `docs/reports/screenshots/player-profile-1b/ranking-empty-390x844.png`

### 360x800 (secondary viewport)

- TOP-10: `docs/reports/screenshots/player-profile-1b/ranking-top10-360x800.png`
- Own rank outside TOP-10: `docs/reports/screenshots/player-profile-1b/ranking-outside-360x800.png`
- No records: `docs/reports/screenshots/player-profile-1b/ranking-empty-360x800.png`

Verified in-browser (Chromium, `vite dev`, a temporary mock of `getWeeklyLeaderboard`'s return
value reverted before commit -- see section 12 for exactly how):

- names visible, score visible, rank visible -- confirmed in every screenshot above.
- あなた visible on the current user's row, both inside and outside TOP-10.
- 20-codepoint Japanese name (`"ピ".repeat(20)`) truncates with an ellipsis, does not wrap or
  push the score off-screen.
- A name containing an emoji-adjacent grapheme (`"こねこ🍕を消したい"`, included only to visually
  stress-test truncation/rendering of an already-rejected-at-write-time character class; a real
  `setDisplayName` call would reject emoji per section 3's contract) truncates the same way,
  confirming the client-side renderer degrades safely even for a value that should never reach
  it in practice.
- fallback name (`ななしピザ職人`) renders identically to any other name.
- `.ranking-overlay__panel`'s `scrollWidth === clientWidth` (`320 === 320`) at both viewports,
  across all three scenarios (TOP-10 / outside-TOP-10 / empty) -- **no horizontal overflow**.
- no clipping beyond the intentional ellipsis truncation; no console errors or page errors
  observed (`page.on("console")`/`page.on("pageerror")` both silent across every scenario).
- loading and Firebase-unavailable/error states are unchanged by this phase (no new field is
  read on those paths) and are already covered by `WeeklyRankingOverlay.test.tsx`'s existing A/D/
  E/FIREBASE-UNCONFIGURED component tests, extended this phase with an explicit assertion that no
  `.ranking-overlay__name` element renders in the unavailable state.

## 10. Focused tests -- PASS 1

| Suite | Result |
|---|---|
| Root `npx vitest run` | **107 test files / 2024 tests passed** (baseline before this phase: 107/2013 -- the +11 delta is this phase's own root-side additions net of edits to existing tests, see section 7) |
| `functions` `npx vitest run` | **3 test files / 72 tests passed** (baseline: 3/60 -- the +12 delta is this phase's own `submitLunchRushScore.test.ts` additions) |
| `firestore.rules.test.ts` (real local Firestore emulator via `firebase-tools emulators:exec`) | **22 tests passed**, identical count to Phase 1A -- **no rules change in this phase**, so no new scenario was added or expected. |
| Root `npm run build` (`tsc -b && vite build`) | succeeded, no type errors |
| Root `npm run lint` (oxlint) | clean |
| `functions` `npm run typecheck` (`tsc --noEmit`) | clean |
| `functions` `npm run lint` (oxlint) | clean |

## 11. Focused tests -- PASS 2 (full repeat)

Every command above was re-run in full a second time with identical results: **107/2024** root
tests, **3/72** functions tests, **22** rules tests, clean build, clean lint (root + functions),
clean typecheck (functions). No flake observed in either pass.

## 12. Browser verification (390x844 / 360x800)

Performed against a local `vite dev` server (no Firebase project connectivity in this sandboxed
environment -- production Firebase deploy is explicitly out of scope for this phase regardless).
`src/firebase/getWeeklyLeaderboard.ts`'s exported function was **temporarily** given three
`window.location.search`-gated early returns (`?mockRanking=top10|outside|empty`) so the real
`WeeklyRankingOverlay` component (unmodified) could render each scenario's real Phase-1B-shaped
data end to end through the actual UI, not a component-test harness. Screenshots were captured
with Playwright (Chromium at `/opt/pw-browsers/chromium`) at both required viewports, per-scenario
horizontal-overflow (`scrollWidth`/`clientWidth`) and console/page-error checks ran alongside each
screenshot (section 9's results). **The temporary mock was fully reverted before this phase's own
commit** -- `git diff src/firebase/getWeeklyLeaderboard.ts` against this phase's committed state
contains no trace of it (re-applied from a clean diff and re-verified with a full PASS 1 repeat,
identical 107/2024 + build/lint clean, after the revert). `git status --short` at commit time
shows exactly this phase's 10 intended files, nothing else.

Not performed: a real-device (physical iPhone) production smoke test against the live Firebase
project -- out of this phase's scope per the design doc's own Phase 1C boundary, and per this
task's explicit "Firebase production deploy禁止" instruction.

## 13. Deployment requirements (after merge, not performed in this session)

`functions` deploy only:

```
firebase deploy --only functions
```

**No `firestore:rules` deploy needed** -- this phase makes zero `firestore.rules` changes (section
8). No client-only deploy step beyond the repository's existing GitHub Pages build/publish flow
for `src/`'s changes (`getWeeklyLeaderboard.ts`, `WeeklyRankingOverlay.tsx`, `App.css`,
`displayNameValidation.ts`, `getMyProfile.ts`'s re-export) -- no new environment variable, secret,
or Firebase project configuration is introduced.

## 14. Known limitations

- **Rename staleness** (design doc section 4.3, inherited unchanged from Phase 0's own design,
  not introduced by this phase): a player who renames but doesn't immediately beat their existing
  best score for a given period keeps showing their old name on that period's leaderboard until
  they do. Documented, accepted-for-Phase-1 behavior; Phase 2B's `onWrite`-trigger fix (Option C)
  remains the recommended path if this ever becomes a real complaint.
- **No real-device production smoke test** performed this session (section 12) -- deferred to
  Phase 1C, per the design doc's own phasing, and per this session's explicit "Firebase production
  deploy禁止" instruction.
- **Emoji-adjacent test name in the browser-verification mock data** (section 9) exercises only
  the client renderer's truncation robustness for an out-of-contract value; it is not a claim that
  `setDisplayName` would ever accept such a name (it rejects `\p{Extended_Pictographic}` outright,
  unchanged by this phase).

## 15. Future Cloud Save / account-linking separation

Unchanged from Phase 0/1A's own design (`docs/design/TETO_PLAYER-PROFILE_1.0.md` sections 6/7):
Cloud Save (Phase 2) and account recovery/linking (Phase 3) remain their own separate, dedicated
Fresh Audits, out of this phase's scope. This phase touches only `functions/src/
submitLunchRushScore.ts`, `functions/src/index.ts`, `src/shared/displayNameValidation.ts`,
`src/firebase/{getMyProfile,getWeeklyLeaderboard}.ts`, `src/components/WeeklyRankingOverlay.tsx`,
and `src/App.css` -- no `users/{uid}` schema change, no new collection, no Cloud Save/account
linking code of any kind.

## Changed files

- `src/shared/displayNameValidation.ts` (modified -- `FALLBACK_DISPLAY_NAME` added, moved here
  from `src/firebase/getMyProfile.ts`)
- `src/firebase/getMyProfile.ts` (modified -- re-exports `FALLBACK_DISPLAY_NAME` from the shared
  module instead of defining it locally; public surface unchanged)
- `functions/src/submitLunchRushScore.ts` (modified -- `FirestoreLike.getDisplayName` +
  `displayName` param on `upsertLeaderboardEntryIfHigher`; `resolveDisplayNameSnapshot`; wired
  into `handleSubmitLunchRushScore`)
- `functions/src/submitLunchRushScore.test.ts` (modified -- 12 new Phase 1B scenarios)
- `functions/src/index.ts` (modified -- `getDisplayName` Admin SDK adapter; `displayName` written
  inside the existing upsert transaction)
- `src/firebase/getWeeklyLeaderboard.ts` (modified -- `displayName` field on
  `WeeklyLeaderboardEntry`/`WeeklyLeaderboardCurrentUserRank`; `resolveEntryDisplayName`)
- `src/firebase/getWeeklyLeaderboard.test.ts` (modified -- 6 new Phase 1B scenarios + existing
  tests extended)
- `src/components/WeeklyRankingOverlay.tsx` (modified -- renders `.ranking-overlay__name`)
- `src/components/WeeklyRankingOverlay.test.tsx` (modified -- 7 new Phase 1B scenarios + existing
  tests extended)
- `src/App.css` (modified -- `.ranking-overlay__name` + `flex-shrink: 0` on rank/score/you-badge)
- `docs/reports/screenshots/player-profile-1b/*.png` (new -- 6 browser-verification screenshots)
- `docs/reports/TETO_PLAYER-PROFILE_Phase1B_Result.md` (new, this file)

## Status

Phase 1B complete. PR to be opened against `main`, left **OPEN**, no auto-merge, no Firebase
production deploy performed. Issue #129 to be updated with this summary. **Remaining Issue #129
scope** (not started, per the design doc's own phasing): Phase 1C (real-device production smoke),
Phase 2 (Cloud Save Fresh Audit), Phase 3 (account recovery / device transfer linking).

## 16. Fresh Merge Follow-up -- catch-up to main after Pizza Cutting Phase 3 (#132)

PR #132 ("Pizza Cutting 1.0 Phase 3 evaluation and result feedback") squash-merged to `main`
while PR #133 (this phase) was open, making PR #133 `mergeable: false` against the new `main`.
This section documents catching PR #133's branch up to the new `main`, with no scope change to
either phase.

### Previous / new base

- **Previous base** (this PR's original merge-base): `fbac50da7b3a6da8e31c3399b8986e5d692e2f7b`
  (Phase 1A merge commit -- see section 0 above).
- **New `main` SHA** (fetched fresh before starting): `24cee828664e4ac34aa806157f3c8df69c02b8d1`
  ("feat: Pizza Cutting 1.0 Phase 3 evaluation and result feedback (#132)").

### Conflict audit

`git diff --stat fbac50d..24cee82` (i.e. exactly what #132 added) touched 27 files: Pizza
Cutting Phase 3's own result report, 18 new screenshots, `src/App.css` (+104 lines), 6 new/
modified source and test files (`src/App.test.tsx`, `src/components/{CutDebugPanel,
ResultPanel}.tsx` + their `.test.tsx`, `src/screens/GameScreen.tsx`,
`src/state/gameReducer.cutResultDisplay.test.ts`). Cross-referenced against this PR's own 10
changed files (section "Changed files" above): **exactly one file overlaps, `src/App.css`** --
both phases only ever *appended* new, distinctly-named rule blocks to it (Phase 3's own result-
panel/cut-debug-panel rules; this phase's own `.ranking-overlay__name` +
`flex-shrink: 0` additions), never touching the same existing line.

### Resolution

`git merge origin/main -m "Merge origin/main (Pizza Cutting Phase 3, #132) into Player Profile
Phase 1B"` (merge commit, not a rebase -- this PR's own branch, but a merge keeps the already-
pushed, already-CI-green PR #133 commit history intact rather than rewriting it, and needs no
force-push). Git's `ort` merge strategy resolved `src/App.css` automatically with **zero
conflict markers** (`git diff` confirms the two `"======="`-looking matches in the file are its
own pre-existing decorative section-divider comments, not `git` conflict markers) -- both
phases' rule blocks are present in full, byte-identical to each phase's own original addition.
No other file required any resolution at all (no overlap).

**Conflicted files: none** (auto-merged cleanly; only `src/App.css` was touched by both sides,
and git's own merge resolved it without any manual edit).

### Verification that neither phase was accidentally deleted

- `git diff origin/main HEAD -- src/components/ResultPanel.tsx src/components/CutDebugPanel.tsx src/screens/GameScreen.tsx` --
  **empty** (byte-identical to `main`): Pizza Cutting Phase 3's CUT UI / `CutDebugPanel` /
  Result UI is untouched.
- `git diff origin/main...HEAD --stat` (i.e. this branch's own changes *on top of* the now-
  current `main`, three-dot diff) lists **exactly this phase's original 17 files** (10 source/
  test + 1 result report + 6 screenshots) -- nothing Phase-3-owned appears in that list, and
  every Phase 1B file (`getWeeklyLeaderboard.ts`, `WeeklyRankingOverlay.tsx`, `App.css`,
  `submitLunchRushScore.ts`, etc.) is still present with its full diff against the new `main`.
- Manual read of the merged `src/App.css`: `.ranking-overlay__name` (line ~2054) and
  `.ranking-overlay__panel` (line ~1989, Phase 2A's own pre-existing rule, unaffected) both
  present; `.result-panel__*` and `.cut-debug-panel` (Phase 3's own rules) both present.

### Verification -- full re-run after the merge

| Check | Result |
|---|---|
| Root `npx vitest run` | **109 test files / 2045 tests passed** (up from this phase's own pre-merge 107/2024 -- the +2 files / +21 tests delta is exactly Phase 3's own new test files (`App.test.tsx`, `CutDebugPanel.test.tsx`, `ResultPanel.test.tsx`, `gameReducer.cutResultDisplay.test.ts`), confirming nothing from either phase was lost) |
| `functions` `npx vitest run` | **3 test files / 72 tests passed**, unchanged from pre-merge (Phase 3 touches no `functions/` file) |
| `firestore.rules.test.ts` (real local Firestore emulator) | **22 tests passed**, unchanged (neither phase touches `firestore.rules`) |
| Root `npm run build` (`tsc -b && vite build`) | succeeded, no type errors |
| Root `npm run lint` (oxlint) | clean |
| `functions` `npm run typecheck` | clean |
| `functions` `npm run lint` (oxlint) | clean |

### Browser re-smoke (390x844 / 360x800)

Since the only conflict was in `App.css` and the merge introduced no change to
`WeeklyRankingOverlay.tsx`'s own structure, a brief re-smoke (not a full repeat of every
scenario in section 9) was performed using the same temporary-mock-and-revert method as before
(section 12): TOP-10 with mixed Japanese/ASCII/20-codepoint/fallback names and the current-user
あなた highlight, at both required viewports. Rank/name/score/badge layout is pixel-identical to
the pre-merge screenshots in section 9 -- confirming Phase 3's own additive `App.css` rules did
not alter the Ranking overlay's cascade. No horizontal overflow (`scrollWidth === clientWidth`,
`320 === 320`) at either viewport; no console/page errors. The temporary mock was reverted
before this follow-up commit (`git status` clean; `grep -c "mockRanking"
src/firebase/getWeeklyLeaderboard.ts` → `0`).

### Scope confirmation

No file outside this phase's original 10 (+2 result-report/screenshots) was modified by this
merge follow-up. `firestore.rules`, `.github/workflows/deploy.yml`, Lunch Rush scoring, and
Firebase score/profile authority are all untouched -- the merge commit itself changes nothing
beyond what `git merge`'s own conflict resolution required (`src/App.css`), and that resolution
is purely additive (both phases' rule blocks, nothing rewritten).

### New HEAD

`e19be9450ae41aa68d324b3ef919a590713f0398` (merge commit, pushed to the same PR #133 branch,
`claude/ranking-display-name-snapshot-brclvx` -- no new PR opened).

## 17. Fresh Merge Follow-up 2 -- catch-up to main after Firebase GitHub Actions Phase 0 docs (#135)

PR #135 ("Firebase Production Deploy via GitHub Actions -- Phase 0 Fresh Design (Issue #134)")
merged to `main` while PR #133 was open (again), making it `mergeable: false` against the newer
`main`. This section documents the second catch-up, with no scope change to either phase.

### Previous / new base

- **Previous base** (this PR's base going into this follow-up): `24cee828664e4ac34aa806157f3c8df69c02b8d1`
  (Pizza Cutting Phase 3 merge, #132 -- see section 16 above).
- **New `main` SHA** (fetched fresh before starting): `1b0b764b0c09d0f74215a04f303095bea577a572`
  ("docs: Firebase Production Deploy via GitHub Actions -- Phase 0 Fresh Design (Issue #134) (#135)").

### Conflict audit

`git diff --stat 24cee82..1b0b764` (exactly what #135 added) touched **2 files, both new,
both docs-only**: `docs/design/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_1.0.md` and
`docs/reports/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase0_Fresh-Design_Result.md` --
712 insertions, 0 deletions, no path under this PR's own 17 changed files. **Zero overlap.**

### Resolution

`git merge origin/main -m "Merge origin/main (Firebase GitHub Actions Phase 0 docs, #135) into
Player Profile Phase 1B"` -- a clean merge with **no conflicts at all** (two brand-new files,
nothing to resolve).

**Conflicted files: none.**

### Verification that nothing was accidentally broken

- `git diff origin/main HEAD -- src/components/ResultPanel.tsx src/components/CutDebugPanel.tsx src/screens/GameScreen.tsx src/state/gameReducer.cutResultDisplay.test.ts` --
  **empty**: Pizza Cutting Phase 3 (#132) remains untouched.
- `docs/design/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_1.0.md` and its Phase 0 result
  report are both present on this branch, unmodified from #135's own merge.
- `git diff origin/main HEAD -- .github/workflows/deploy.yml` -- **empty**: this PR touches no
  deployment workflow, consistent with this phase's own scope guard and with #135 itself being
  docs-only (no workflow file changed by #135 either).
- `git diff origin/main...HEAD --stat` (three-dot diff, this branch's changes *on top of* the
  now-current `main`) lists **exactly this PR's original 17 files** -- identical file list and
  line-count deltas to the pre-#135 three-dot diff (section 16), confirming the Phase 1B code
  itself did not change, only the merge base did.

### Verification -- full re-run after the merge

| Check | Result |
|---|---|
| Root `npx vitest run` | **109 test files / 2045 tests passed** -- identical to the post-#132 count (section 16); #135 adds no test |
| `functions` `npx vitest run` | **3 test files / 72 tests passed**, unchanged |
| Root `npm run build` (`tsc -b && vite build`) | succeeded; output asset hashes (`index-BRwIqujU.css`, `index-CdMnj1OA.js`) are **byte-identical** to the pre-#135 build, confirming the production bundle is unaffected |
| Root `npm run lint` (oxlint) | clean |
| `functions` `npm run typecheck` | clean |
| `functions` `npm run lint` (oxlint) | clean |

`firestore.rules.test.ts` was not re-run this follow-up -- #135 touches no Firestore rule, no
Firestore-adjacent code, and no test file; the emulator run from section 16 (22/22) still
accurately describes the current state, unchanged since.

### Browser re-smoke

**Not performed for this follow-up**, per instruction: the merge introduced zero changes to any
Phase 1B source file (three-dot diff identical to the prior, fully-verified state; production
build output byte-identical), so the 390x844/360x800 screenshots already captured in section 16
(and section 9) remain an accurate, current representation of the Weekly Ranking overlay.

### Scope confirmation

No file outside `docs/reports/TETO_PLAYER-PROFILE_Phase1B_Result.md` (this report) was modified
by this merge follow-up beyond what `git merge` itself brought in from #135 (two new, untouched
docs files). `firestore.rules`, `.github/workflows/deploy.yml`, Lunch Rush scoring, and Firebase
score/profile authority remain untouched.

### New HEAD

`969b2d966dbe36a9334df11e7c058b16562a2a65` (merge commit, pushed to the same PR #133 branch,
`claude/ranking-display-name-snapshot-brclvx` -- no new PR opened).
