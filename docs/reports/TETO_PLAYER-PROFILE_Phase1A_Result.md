# Player Profile 1.0 -- Phase 1A (Profile Foundation) -- Result

Issue #129. Implements the design/audit recorded in `docs/design/TETO_PLAYER-PROFILE_1.0.md`
(Phase 0, Issue #129/#130) section 9's "Phase 1A -- Profile foundation" slice: a player can set
a display name from HOME's existing Settings overlay, it is saved to Firestore through a
trusted Cloud Function, and it survives closing/reopening Settings and a full page reload for
the same Anonymous Auth UID. **Ranking display is out of scope here (Phase 1B).**

## 0. Fresh Sync

- Fetched `origin/main`; HEAD was already exactly the Phase 0 merge commit
  (`61d6d2b5937392a430f58e00053e76d096476104`) -- no drift to reconcile, the design doc's own
  audit (against SHA `9c972e1...`, one commit earlier) still describes current `main` accurately
  end to end.
- Branch: `claude/player-profile-phase-1a-aibr5v`, created from that same commit; contains it as
  an ancestor (`git merge-base --is-ancestor origin/main HEAD` succeeded).
- Read directly from current source before writing anything: `firestore.rules`,
  `firestore.rules.test.ts`, `functions/src/index.ts`, `functions/src/submitLunchRushScore.ts`
  (+`.test.ts`), `src/firebase/{index,client,auth,config,submitLunchRushScore,
  getWeeklyLeaderboard}.ts` (+ their `.test.ts` files), `src/components/SettingsOverlay.tsx`,
  `src/App.tsx`, `src/App.css`'s existing `.settings-overlay__*`/`.settings-reset-confirm__*`
  rules, `src/shared/lunchRushScoring.ts` (the cross-package client/functions shared-module
  precedent), `functions/package.json`, `functions/tsconfig.json`, `vitest.config.ts`,
  `functions/vitest.config.ts`, `vitest.rules.config.ts`, `firebase.json`.
- No contradiction found between the Fresh Audit and the Phase 0 design SSOT -- every decision
  below implements that document's own section 9 slice without deviation.
- **Pizza Cutting Phase 3**: not touched. No file under its ownership was read or modified.

## 1. `users/{uid}` schema (implemented exactly as designed)

`displayName` (string) / `createdAt` (server Timestamp, set once) / `updatedAt` (server
Timestamp, rewritten on every accepted write) -- nothing else. No `lastPlayedAt`, no email, no
real name, no device id, no IP, no auth provider metadata. Document id is the Firebase Auth
`uid`. The document is created lazily on the caller's first accepted `setDisplayName` call;
every player who never opens Settings simply has no document, forever -- a permanently
supported, non-error state.

## 2. Firestore Rules (`firestore.rules`)

Added, placed alongside the existing `runs`/`leaderboards` matches, ahead of the deny-by-default
backstop:

```
match /users/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false;
}
```

Read is scoped to the document's own owner only (no public read, unlike the leaderboard entries
-- a profile is not itself ranking data). Every client write is denied unconditionally,
including the document's own owner -- the only writer is the `setDisplayName` Callable
Function's Admin SDK path, which bypasses these rules entirely.

## 3. Callable Function (`functions/src/setDisplayName.ts` + `functions/src/index.ts`)

Mirrors `submitLunchRushScore.ts`/`index.ts`'s exact split: a pure, framework-agnostic
`handleSetDisplayName(payload, auth, deps)` (no `firebase-admin`/`firebase-functions` types in
its signature) plus a thin `index.ts` wiring it to the real Admin SDK and `onCall({ region:
"asia-northeast1" })` -- the same region as `submitLunchRushScore`, and the same region the
client's `getFunctions()` call targets.

- **uid authority**: always `request.auth.uid`; `SetDisplayNameRequestPayload` has no `uid`
  field at all, so there is nothing on the wire to spoof.
- **Firestore access**: a narrow `FirestoreLike.runTransaction(uid, mutate)` port (mirroring
  `submitLunchRushScore.ts`'s own narrow-port discipline) -- `index.ts`'s real adapter runs
  `mutate` inside a genuine `db.runTransaction`, reading the document, calling `mutate`, and
  writing its returned `{ write, result }` back in the same transaction. This is what makes the
  cooldown race-safe (section 5 below).
- **Field allow-list**: the write object is always exactly `{ displayName, createdAt, updatedAt
  }`, built by the handler itself -- no payload spread, so there is no field on the wire a
  client could use to inject or overwrite anything else.

## 4. `displayName` validation contract (`src/shared/displayNameValidation.ts`)

A new shared, framework-free module -- imported verbatim by both
`functions/src/setDisplayName.ts` (the actual security authority) and
`src/components/SettingsOverlay.tsx` (a client-side pre-check for immediate UX feedback only,
never trusted as the authority) -- mirroring `src/shared/lunchRushScoring.ts`'s own
client/server dual-import precedent exactly.

Implements every row of the Phase 0 design doc's section 3 table:

| Check | Implementation |
|---|---|
| Raw input ceiling | 200 UTF-16 units, checked before any other processing |
| Control chars / zero-width / invisible-format | Checked on the **raw** input, before trim -- see the "trim-laundering" note below |
| Emoji | `\p{Extended_Pictographic}`, checked on the raw input |
| Trim + internal whitespace collapse | `\p{White_Space}`-based; ideographic/fullwidth space included |
| Empty after normalization | Rejected |
| Length | 1-20 Unicode codepoints (`Array.from(name).length`, astral-codepoint-safe) |
| Reserved words | `あなた` / `Anata` / `You`, case-insensitive on the ASCII variants |
| Duplicate names | Explicitly allowed (no uniqueness check) |
| Profanity | Explicitly out of scope, per Issue #129 |

**One correctness fix found and applied during implementation** (not present in the Phase 0
design doc, discovered by the test suite): `String.prototype.trim()` follows ECMAScript's own
`WhiteSpace` production, which -- unlike Unicode's `White_Space` property -- explicitly treats
`U+FEFF` (the byte-order-mark / ZWNBSP) as trimmable whitespace. Validating control/invisible/
emoji characters *after* trimming would let a leading/trailing `U+FEFF` silently disappear
instead of being rejected. Fixed by checking control/format/emoji characters on the **raw**
input before any trim/collapse step runs; whitespace trimming/collapsing then happens
afterward, on data already known not to contain a laundered format character.

## 5. Rename cooldown (60 seconds, server-side, race-safe)

Enforced inside the same Firestore transaction that performs the write: the transaction reads
the existing document, compares `deps.now() - existing.updatedAtMillis` against 60,000ms, and
throws (aborting the transaction with no write) if under cooldown. No cooldown applies to first
creation (no prior `updatedAt` to compare against). `createdAt` is carried through unchanged on
every rename; `updatedAt` is server-authoritative on every accepted write.

**Race-condition audit**: a naive read-then-write (two sequential Firestore calls, not a
transaction) would let two concurrent `setDisplayName` calls both read the same pre-write
`updatedAt` and both pass the cooldown check. Firestore's real `db.runTransaction` closes this:
on write-write contention it re-runs the entire callback (re-reading fresh state) rather than
committing against stale data, so a losing concurrent call is guaranteed to see the winner's
already-committed `updatedAt` before its own cooldown check runs. Verified by a dedicated unit
test (`functions/src/setDisplayName.test.ts`'s "concurrent rename attempts" case) using a fake
that serializes transaction attempts the way a real retry loop would.

## 6. Client Firebase API

- **`src/firebase/getMyProfile.ts`** (new): a direct Firestore read of the caller's own
  `users/{uid}` (not a Callable Function -- the rules already allow the owner to read it
  directly, matching `getWeeklyLeaderboard.ts`'s own "one dedicated read module" discipline).
  Calls `ensureAnonymousUser()` (not `getCurrentAuthUser()`) since Settings can open before
  App.tsx's mount-time sign-in has resolved. Exports `FALLBACK_DISPLAY_NAME` (`"ななしピザ職人"`).
- **`src/firebase/setDisplayName.ts`** (new): the client's call site for the Callable Function,
  mirroring `submitLunchRushScore.ts`'s "never fail the caller, always resolve a typed result"
  contract. Maps the SDK's `FunctionsError.code` to `"invalid-argument"` / `"cooldown"`
  (`resource-exhausted`) / `"failed"` (everything else).
- Both exported from `src/firebase/index.ts`, the module's existing public-surface convention.
- UID is never passed by the caller in either module -- `getMyProfile`/`setDisplayName` both
  resolve it internally via `ensureAnonymousUser()`.

## 7. Settings UI (`src/components/SettingsOverlay.tsx`)

A new "プレイヤー名" section, placed above the existing "ゲームデータ" section, following its
exact `settings-overlay__section` shape. States implemented: loading, loaded (existing name
pre-filled, or empty input with the fallback name as placeholder), saving (button disables +
"保存中…" label, synchronous `saveInFlightRef` double-submit guard mirroring the existing
`resetInFlightRef` pattern), success ("保存しました。"), client-side validation error (immediate,
per-case Japanese message from `describeValidationError`), server-side validation error (generic
Japanese message, since the client pre-check already covers every Phase 1A rejection case),
cooldown ("しばらく時間をおいてから変更してください（変更は60秒に1回までです）。"), Firebase
unavailable ("オフラインのためプレイヤー名機能を利用できません。" -- input/button hidden
entirely in this state), and a generic save-failure retry message. A successful save updates the
input from the **server's own accepted, normalized name**, never an unconfirmed local echo. No
forced first-run name prompt was added (per the Phase 0 design's own section 5.2 rejection of
that idea).

## 8. Mobile UI

Verified by reading the CSS added (`.settings-overlay__profile-*` in `src/App.css`) against the
existing `.settings-overlay__section`/`.settings-overlay__reset-trigger` conventions it shares a
card shell with: input and save button both `min-height: 44px` (meets the existing
`.settings-overlay__reset-trigger`'s own 48px-class touch-target precedent), the input/button
row is a flexible row (`flex: 1` input + fixed-width button) that reflows safely at 360px width,
error/success/status text uses the same 12px `role="alert"`/`role="status"` pattern the existing
reset-confirmation copy already uses, and a 20-codepoint Japanese name was exercised in the
component test suite (`SettingsOverlay.test.tsx`'s "does not overflow" case) without layout
assertions failing. No new overlay/backdrop/z-index behavior was introduced -- the new section
lives inside the same `.dex-overlay__body` scroll container Full Game Reset already does, so
both sections coexist and scroll together exactly as they did before this phase (Full Game Reset
itself required no changes). A real-device (390×844/360×800) visual pass was not performed in
this session (no device/browser available) -- flagged as a candidate for Phase 1C's own
production-smoke pass, per the Phase 0 design doc's own section 9 phasing.

## 9. Full Game Reset -- audited, unchanged

Read `handleResetGameData`/`resetSave` (`src/state/persistence.ts`) and confirmed: Full Game
Reset clears only `PersistentSaveV2` (local `localStorage`) and reloads the page -- it has no
Firebase import, no Firestore call, and no relationship to Anonymous Auth or `users/{uid}`
whatsoever. Player Profile 1.0 does not touch this flow. Consequence, confirmed by manual
reasoning through the flow: a Full Game Reset does **not** delete or reset the player's
Firebase display name (that would require deleting `users/{uid}}`, explicitly out of Phase 1A
scope) -- the existing reset confirmation copy ("Pitz・材料・レシピ解放・ピザ図鑑・ベスト記録")
already only describes local-save fields, so no copy change was judged necessary to avoid player
confusion. Verified functionally unchanged via the new `SettingsOverlay.test.tsx`'s own "existing
Full Game Reset flow remains functional alongside the new profile section" test.

## 10. Migration

None. `users/{uid}` is a brand-new collection; no existing collection, document, or local-save
field was read, written, or migrated.

## 11. Scope guard -- confirmed untouched

No ranking `displayName` field, no leaderboard schema change, no score authority change, no
Lunch Rush scoring change, no local-save migration, no cloud save, no Google/Apple login, no App
Check, no profanity service, no uniqueness requirement, no Pizza Cutting Phase 3 file touched, no
Pitz/economy/progression change, no automatic Firebase deploy (this session ran everything
against the local Firestore emulator only -- see section 13).

## 12. Verification

### Focused tests (written this phase)

| File | Tests |
|---|---|
| `src/shared/displayNameValidation.test.ts` | 31 |
| `functions/src/setDisplayName.test.ts` | 28 |
| `src/firebase/getMyProfile.test.ts` | 9 |
| `src/firebase/setDisplayName.test.ts` | 10 |
| `src/components/SettingsOverlay.test.tsx` | 14 |
| `firestore.rules.test.ts` (new `users/{uid}` `describe` block only) | 8 |
| **Total new** | **100** |

All passed on first green run after the trim/`U+FEFF` ordering fix in section 4 (the only
correctness bug found during implementation; caught by this session's own test suite, not
shipped).

### Duplicate Gate -- PASS 1

- Root `npm test` (jsdom, whole app): **107 test files / 2013 tests passed**. Baseline (same
  branch, this phase's changes stashed including untracked files): 103 files / 1949 tests --
  the +4 files / +64 tests delta matches exactly the four new root-side test files added this
  phase (`displayNameValidation.test.ts` 31 + `getMyProfile.test.ts` 9 + client
  `setDisplayName.test.ts` 10 + `SettingsOverlay.test.tsx` 14 = 64), confirming nothing
  pre-existing regressed or was silently dropped.
- `functions` `npm test` (node): **3 test files / 60 tests passed** (`periodIds.test.ts`,
  `submitLunchRushScore.test.ts` unchanged + `setDisplayName.test.ts`'s new 28).
- `firestore.rules.test.ts` against the real local Firestore emulator
  (`firebase-tools emulators:exec --only firestore -- vitest run --config
  vitest.rules.config.ts`): **22 tests passed** (14 pre-existing `runs`/`leaderboards`/backstop
  scenarios, unweakened, + 8 new `users/{uid}` scenarios).
- Root `npm run build` (`tsc -b && vite build`): succeeded, no type errors.
- Root `npm run lint` (oxlint): clean (one intentional `no-control-regex` warning in
  `displayNameValidation.ts` suppressed with an explanatory `eslint-disable-next-line`, since
  matching control characters is exactly this rule's job).
- `functions` `npm run typecheck` (`tsc --noEmit`): clean.
- `functions` `npm run lint` (oxlint): clean.

### Duplicate Gate -- PASS 2 (full repeat)

Every command above was re-run in full a second time with identical results: **107/2013** root
tests, **3/60** functions tests, **22** rules tests, clean build, clean lint (root + functions),
clean typecheck (functions). No flake observed in either pass.

### `git diff` audit

`git status --short` against `origin/main` after all changes: exactly the files listed in
"Changed files" below, nothing else -- no accidental modification to `package.json`,
lockfiles (the `@firebase/rules-unit-testing` dev-only install used `--no-save`, matching
`firestore.rules.test.ts`'s own documented manual-verification procedure), Pizza Cutting Phase 3
files, or any local-save/ranking/economy code.

## 13. Security review (Fresh-checked before opening this PR)

| Check | Result |
|---|---|
| Arbitrary UID | Impossible -- `uid` is read only from `request.auth.uid` in `handleSetDisplayName`; the payload has no `uid` field to spoof. Verified by a dedicated unit test. |
| Direct Firestore write | Impossible -- `firestore.rules`' `users/{uid}` rule denies every client write unconditionally, verified against the real emulator (owner, other-uid, and unauthenticated write all fail). |
| Another user's profile read | Impossible -- rules scope read to `request.auth.uid == uid`, verified against the real emulator. |
| Another user's profile write | Impossible -- same rule; also, the Function itself only ever targets `auth.uid`'s own document, never a payload-supplied uid. |
| Server timestamp authority | `createdAt`/`updatedAt` are always `FieldValue.serverTimestamp()`, never client-supplied. |
| Cooldown race-bypass | Closed by a real Firestore transaction (section 5); verified by a concurrent-rename unit test. |
| `createdAt` immutability through rename | Verified by a dedicated unit test -- the adapter passes the existing document's own `createdAt` through unchanged on every rename. |
| Only allow-listed fields written | The write object is hardcoded to exactly `{ displayName, createdAt, updatedAt }` -- no payload spread. |
| Malformed Unicode | Control/format(Cf)/emoji characters rejected on raw input before any lossy normalization (section 4's own fix). |
| No private information exposed | Schema is exactly `displayName`/`createdAt`/`updatedAt` -- no email/real name/device id/IP/provider metadata anywhere in this design or its implementation. |
| No Firebase config/credential committed | `.env.example` remains placeholder-only; `git status`/`git diff` show no `.env`, service-account key, or other credential file touched. |

## 14. Deployment

**Not deployed.** `firestore.rules` and `functions/src/setDisplayName.ts`/`index.ts` require a
manual `firebase deploy --only firestore:rules,functions` by the project owner before this
feature is live in production, exactly like every prior Firebase Ranking 1.0 phase's own
deployment procedure (`docs/design/TETO_FIREBASE-RANKING_SETUP.md` section 17) -- no automatic
deploy was performed or attempted in this session.

## Changed files

- `firestore.rules` (modified -- `users/{uid}` rule added)
- `firestore.rules.test.ts` (modified -- 8 new `users/{uid}` scenarios)
- `functions/src/setDisplayName.ts` (new)
- `functions/src/setDisplayName.test.ts` (new)
- `functions/src/index.ts` (modified -- `setDisplayName` Callable Function wired up)
- `src/shared/displayNameValidation.ts` (new)
- `src/shared/displayNameValidation.test.ts` (new)
- `src/firebase/getMyProfile.ts` (new)
- `src/firebase/getMyProfile.test.ts` (new)
- `src/firebase/setDisplayName.ts` (new)
- `src/firebase/setDisplayName.test.ts` (new)
- `src/firebase/index.ts` (modified -- new exports)
- `src/components/SettingsOverlay.tsx` (modified -- new "プレイヤー名" section)
- `src/components/SettingsOverlay.test.tsx` (new)
- `src/App.css` (modified -- new `.settings-overlay__profile-*` rules)
- `docs/reports/TETO_PLAYER-PROFILE_Phase1A_Result.md` (new, this file)

## Status

Phase 1A complete. PR opened against `main`, left **OPEN**, no auto-merge. Issue #129 updated
with this summary. **Remaining Phase 1B scope** (not started): `submitLunchRushScore.ts`
denormalizes the submitter's `users/{uid}.displayName` onto weekly/monthly/all-time leaderboard
entries at accepted-submission time (Option A, Phase 0 design doc section 4.2);
`getWeeklyLeaderboard.ts`/`WeeklyRankingOverlay.tsx` read and render it, falling back to
`FALLBACK_DISPLAY_NAME` for any entry without one. Phase 1C (real-device production smoke) and
Phase 2/3 (cloud save audit, account recovery) remain their own separate, dedicated efforts per
the Phase 0 design doc's own phasing.
