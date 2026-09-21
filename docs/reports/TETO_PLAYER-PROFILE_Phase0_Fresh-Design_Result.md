# Player Profile 1.0 -- Phase 0 Fresh Design / Security Audit -- Result

Issue #129. **Design/audit-only.** No production code changed. No merge to `main`. Full design
lives in `docs/design/TETO_PLAYER-PROFILE_1.0.md`; this report records what was audited, what
was decided, and the verification performed.

## Scope confirmation

- Audited `origin/main` at SHA `9c972e11786665a0663ebc05d053c7e2d63c4da1`.
- Branch: `claude/player-profile-phase0-design-u4s2p1`, created from that same commit.
- Read directly from current source (not from any prior report): `firestore.rules`,
  `firestore.rules.test.ts`, `firestore.indexes.json`, `functions/src/index.ts`,
  `functions/src/submitLunchRushScore.ts`, `functions/src/periodIds.ts`,
  `src/firebase/{client,config,auth,submitLunchRushScore,getWeeklyLeaderboard,index}.ts`,
  `src/components/WeeklyRankingOverlay.tsx`, `src/components/SettingsOverlay.tsx`,
  `src/state/persistence.ts`, `src/App.tsx`, `docs/design/TETO_FIREBASE-RANKING_SETUP.md`,
  Issue #129, Issue #87.
- **Pizza Cutting Phase 3** (in progress in a separate session): not touched. This task made no
  code changes at all, so there is no overlap by construction.
- Only files added: `docs/design/TETO_PLAYER-PROFILE_1.0.md` (new),
  `docs/reports/TETO_PLAYER-PROFILE_Phase0_Fresh-Design_Result.md` (this file, new). No other
  file in the repository was modified.

## Key decisions (full rationale in the design doc)

1. **Schema**: `users/{uid}` with exactly `displayName`, `createdAt`, `updatedAt`.
   `lastPlayedAt` audited and deliberately excluded from Phase 1 -- nothing reads it yet.
2. **Ownership**: document id = Firebase Auth `uid`; created lazily on first `setDisplayName`
   call; only the Function can write it; Firestore Rules allow read only to the document's own
   owner and deny all client writes unconditionally.
3. **`displayName` contract**: 1-20 Unicode codepoints post-trim, internal whitespace
   collapsed, control/zero-width/format characters and emoji rejected, `あなた`/variants
   reserved, no uniqueness enforcement, no offensive-word filter (explicitly deferred per
   Issue #129's own instruction), 60-second server-side rename cooldown.
4. **Ranking integration**: **Option A** (denormalize a `displayName` snapshot onto the
   leaderboard entry at trusted-submission time) recommended over lookup-join (B, rejected --
   scales badly and needs a public `users/*` read rule) and server-side materialization (C,
   deferred to a possible Phase 2B if rename staleness becomes a real complaint). Zero
   Firestore Rules changes needed for A; one extra read inside the already-trusted
   `submitLunchRushScore` write path.
5. **UX flow**: HOME -> 設定 (existing `SettingsOverlay.tsx`) -> プレイヤー名. No forced
   first-run name gate (evaluated and explicitly rejected, section 5.2 of the design doc).
   Score submission never blocks on a missing profile; fallback display name
   `ななしピザ職人` covers every legacy/missing-profile case.
6. **Cloud Save boundary**: `users/{uid}` (profile) and a future cloud game save are
   recommended to stay separate documents/collections, never merged into one large document --
   rationale and a Phase 2 versioning/migration/conflict/offline design memo recorded, no
   implementation.
7. **Account recovery**: Phase 3 boundary recorded (`linkWithCredential` preserving the
   existing anonymous `uid`, with the `auth/credential-already-in-use` merge case flagged as an
   explicit future product decision) -- not implemented.
8. **Security**: full threat table (section 8.2 of the design doc) covering profile overwrite,
   displayName/leaderboard spoofing, arbitrary UID, arbitrary score, direct Firestore write,
   oversized/malicious-Unicode input, rename abuse, missing auth, and missing/legacy profiles.
   Recommended `firestore.rules` addition specified (not yet applied to the repo -- Phase 1A's
   own change). Flagged for inclusion in Issue #87 Phase 3's future App Check enforcement scope
   once that ships.
9. **Implementation slices**: Phase 1A (profile foundation), Phase 1B (ranking integration),
   optional Phase 1C (human-feel/production smoke) each sized to ~2-3 hours, with Phase 2
   (Cloud Save Fresh Audit) and Phase 3 (account recovery) explicitly left for their own
   separate, dedicated audits -- not scoped further here.

## Verification performed

### Duplicate Gate -- pass 1 (scope / architecture / security / dependency)

- Confirmed the recommended design does not contradict any current production code path: the
  trust-boundary table in design-doc section 1 was built by reading the actual
  `handleSubmitLunchRushScore` / `firestore.rules` source, not assumed.
- Confirmed alignment with the real, production Firebase architecture (Anonymous Auth,
  Callable-Function-only writes, `asia-northeast1`, the existing `leaderboards`/`runs` schema)
  as it exists today, not an earlier/aspirational version of it.
- Confirmed no overlap/dependency conflict with Issue #87's own remaining phases (App Check is
  explicitly cross-referenced, not duplicated -- section 8.4) and no interference with Pizza
  Cutting Phase 3 (no shared files, no code touched).
- Confirmed the recommended design never proposes starting a local-save migration (section 6
  is a memo-only Phase 2 boundary, explicitly "no implementation, no schema, no migration code
  ships in this phase") and never proposes writing to `PersistentSaveV2` from any Firebase path.
- Confirmed the existing Anonymous Auth flow (`ensureAnonymousUser`, fire-and-forget on mount)
  and existing weekly ranking (`getWeeklyLeaderboard`/`WeeklyRankingOverlay`) are both designed
  to remain fully functional, unmodified in their current-production form, until Phase 1A/1B
  actually ships -- Phase 0 itself changes no runtime behavior at all.

### Duplicate Gate -- pass 2 (git diff / changed files / diff against main / accidental production change)

Verified directly via `git status` / `git diff` against `origin/main` after writing the design
docs (see "Changed files" below) -- confirmed docs-only, two new files, zero modified/deleted
files, no source/config/rules/functions file touched.

## Changed files

- `docs/design/TETO_PLAYER-PROFILE_1.0.md` (new)
- `docs/reports/TETO_PLAYER-PROFILE_Phase0_Fresh-Design_Result.md` (new, this file)

## Status

Phase 0 complete. PR opened against `main`, left **OPEN**, not merged, no auto-merge configured.
Issue #129 updated with a summary comment linking both documents. Phase 1A is unblocked and
ready to be sliced into its own Claude Code session per section 9 of the design doc.
