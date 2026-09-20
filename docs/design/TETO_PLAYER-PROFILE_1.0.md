# Player Profile 1.0 -- Fresh Design / Security Audit (Phase 0)

Issue #129. This is a **design/audit-only** document -- no production code changes ship with
it. It defines the schema, validation contract, ranking-integration approach, UX flow, security
model, and Phase 1A/1B/1C implementation slices for Player Profile 1.0: letting a player set and
change a display name, and showing it on the weekly ranking, on top of the already-production
Firebase Ranking 1.0 foundation (Issue #87).

## 0. Fresh Sync -- current state audited

Audited at `origin/main` SHA `9c972e11786665a0663ebc05d053c7e2d63c4da1`, branch
`claude/player-profile-phase0-design-u4s2p1` (created from that same commit; no divergence).

- Issue #129 (this task) and Issue #87 (Lunch Rush Online Ranking 1.0, the dependency this
  design builds on) both read directly from GitHub, not from any prior local report.
- Firebase-related code read directly from source: `firestore.rules`,
  `firestore.rules.test.ts`, `firestore.indexes.json`, `functions/src/index.ts`,
  `functions/src/submitLunchRushScore.ts`, `functions/src/periodIds.ts`,
  `src/firebase/{client,config,auth,submitLunchRushScore,getWeeklyLeaderboard,index}.ts`,
  `src/components/WeeklyRankingOverlay.tsx`, `src/components/SettingsOverlay.tsx`,
  `src/state/persistence.ts`, `src/App.tsx`, `docs/design/TETO_FIREBASE-RANKING_SETUP.md`.
- **Pizza Cutting Phase 3** is confirmed out of scope here: no file under its ownership was
  read for editing, and this task touches no production code at all, so there is no
  overlap risk with that in-flight branch/PR by construction.

Current production baseline, confirmed from code (not assumed from any prior report):

- **Anonymous Auth** (`src/firebase/auth.ts`): `ensureAnonymousUser()` reuses an existing
  session before ever calling `signInAnonymously`; called once, fire-and-forget, from
  `App.tsx`'s mount effect, only when `isFirebaseAvailable()`. No UID ever reaches the UI, is
  logged, or is written into `PersistentSaveV2` (`src/state/persistence.ts` is untouched by
  Firebase entirely).
- **Trusted score submission** (`functions/src/submitLunchRushScore.ts` +
  `functions/src/index.ts`): a Callable Cloud Function (`asia-northeast1`) is the **only**
  writer of `runs/*` and `leaderboards/*/entries/*`. `uid` is taken exclusively from
  `request.auth.uid` -- there is no `uid` field in the request payload shape at all. Score/
  servedCount/quality are always server-recomputed from `serves[]`, never read from the client.
- **Firestore Rules** (`firestore.rules`): `runs/{runId}` denies all client read/write.
  `leaderboards/{periodId}/entries/{uid}` allows client **read** only when
  `periodId` matches `^weekly_.*` (Phase 2A's one loosening); all writes to it are denied for
  every client, always -- only the Function's Admin SDK path (which bypasses rules) writes it.
  A deny-by-default backstop (`match /{document=**} { allow read, write: if false; }`) closes
  every other, not-yet-defined collection, `users/{uid}` included today.
- **Weekly ranking UI** (`src/components/WeeklyRankingOverlay.tsx` +
  `src/firebase/getWeeklyLeaderboard.ts`): reads `leaderboards/{"weekly_"+isoWeekId(now)}/
  entries`, `orderBy(score desc, achievedAt asc)`, TOP 10 + an approximate own-rank query when
  the signed-in player's entry isn't already in the TOP 10. Shows rank/medal, score, and an
  "あなた" badge on the current user's row. **No display name field exists anywhere in this
  path today.**
- **Settings** (`src/components/SettingsOverlay.tsx`): opened from HOME's existing ⚙️ button;
  today holds exactly one section ("ゲームデータ" / Full Game Reset). This is the natural,
  already-established insertion point for a "プレイヤー名" section (see section 5).
- **Local save** (`src/state/persistence.ts`): `PersistentSaveV2`
  (`schemaVersion: 2`) holds `dex` / `pitzBalance` / `ownedIngredientIds` / `missionBest` /
  `inventory`. Entirely local (`localStorage`), entirely independent of Firebase Auth/Firestore.
  Player Profile 1.0 does not read, write, or migrate this schema in any phase below.

## 1. Firebase structure audit -- trust boundary confirmed

The one property Issue #129 requires re-confirming before adding anything new: **a client
cannot write or read another user's authoritative data by supplying an arbitrary UID or
value.** Confirmed true today:

| Question | Answer (from code) |
|---|---|
| Can a client supply its own UID to a write path? | No. `handleSubmitLunchRushScore` reads `auth.uid` only from the Callable Function's own verified `request.auth`; `SubmitLunchRushScoreRequestPayload` has no `uid` field to spoof. |
| Can a client write an arbitrary score directly to Firestore? | No. `firestore.rules` denies all client writes to `runs/*` and `leaderboards/*/entries/*` unconditionally; only the Function's Admin SDK path (not subject to Security Rules) writes either. |
| Can a client read another collection it wasn't explicitly granted? | No. The deny-by-default `match /{document=**}` backstop denies read/write on everything not explicitly matched -- this already covers a not-yet-existing `users/{uid}` collection today, before this design adds anything. |
| Is there a current-user check anywhere client-side that matters for trust? | `getCurrentAuthUser()?.uid` is used only to decide whether a *rendered* leaderboard row gets the "あなた" badge and whether to run the own-rank query -- purely a UI/read convenience, never a write authority. |
| Does anything let a client overwrite someone else's document? | No document is client-writable at all today (`runs`, `leaderboards/*/entries/*` both `allow write: if false`). |

Conclusion: the existing trust boundary is intact and sets the precedent this design follows
exactly -- **the client is never the authority for anything written to Firestore that another
player, or the ranking itself, will see.** Player Profile 1.0's own write path (section 2/8)
is designed to preserve this without exception.

## 2. `users/{uid}` schema

### 2.1 Fields (Phase 1 minimal set)

| Field | Type | Authority | Notes |
|---|---|---|---|
| `displayName` | string | server (validated, see section 3) | 1-20 Unicode codepoints after normalization; never empty |
| `createdAt` | Timestamp | server (`FieldValue.serverTimestamp()`), set once | immutable after document creation |
| `updatedAt` | Timestamp | server, rewritten on every accepted `displayName` change | also backs the rename cooldown (section 3.10) |

`lastPlayedAt` (an Issue #129 candidate field) is **deliberately not included** in Phase 1: no
current or Phase-1A/1B feature reads it, and this design follows the repo's own "不要な
フィールドは追加しない" / "don't add fields nothing uses yet" convention (matching how
`PersistentSaveV1`'s own future-reserved fields were added only when Phase 3C-3+ actually
started reading them, not speculatively ahead of time). If a future phase needs a
last-active signal (e.g. profile staleness cleanup, an activity badge), it is a one-field
additive change to this document -- no migration, since Firestore documents are schemaless
and an absent field simply reads back as absent.

No email, no real name, no IP, no device id, no auth provider metadata is ever written to this
document -- see section 2.4.

### 2.2 Document identity and ownership

- Document id **is** the Firebase Auth `uid` (`users/{uid}`), exactly mirroring
  `leaderboards/{periodId}/entries/{uid}`'s existing id-is-the-uid convention -- no separate
  "profile id" is invented.
- **Creation ownership**: the document is created lazily, on the first successful
  `setDisplayName` call for that `uid` (there is no separate "create profile" step or
  onboarding-triggered document write -- see section 5). A player who never opens Settings and
  never sets a name simply never has a `users/{uid}` document, forever. This is a first-class,
  permanently supported state (section 2.3).
- **Update ownership**: only the same `uid`'s own document, and only through the trusted
  `setDisplayName` Callable Function (section 8) -- never a direct client Firestore write, and
  never any other `uid`'s document.
- **Field allow-list**: `setDisplayName`'s request payload has exactly one meaningful field
  (`displayName`); the Function itself decides `createdAt`/`updatedAt`, so there is no field on
  the wire a client could use to inject or overwrite anything else (e.g. no client-suppliable
  `uid`, no arbitrary-field merge). This mirrors `submitLunchRushScore`'s own "the payload
  shape has nothing to tamper with" design (section 12 of the ranking setup doc).

### 2.3 Legacy / missing profile fallback

Every read path that touches a player's display name (Settings' own current-name display, the
ranking's denormalized snapshot -- section 4) must treat "no `users/{uid}` document exists" as
a normal, permanent, non-error state, not a transient/loading one. This covers:

- every player who existed before Player Profile 1.0 ships (100% of current production
  players),
- any player who simply never opens Settings,
- the vanishingly rare case a `setDisplayName` call's Firestore write fails after passing
  validation.

The fallback display value is a fixed constant, `ななしピザ職人` (matching Issue #129's own
suggested example) -- used both as the Settings screen's "現在の名前" placeholder and as the
value denormalized onto a leaderboard entry when the submitting player has no profile document
or an (impossible, but defensively handled) empty `displayName` field.

### 2.4 Privacy

`users/{uid}` never stores email, phone number, real name, IP address, device identifiers, or
Firebase Auth provider metadata. Firebase Auth's own user record (which *can* carry an email
once Phase 3 account linking exists) is never copied into this document or into any
Firestore-readable location -- this document exists solely to carry the one public-facing
field, `displayName`, plus its own audit timestamps. This also means Phase 3 account linking
(section 7) needs no `users/{uid}` schema change purely to stay privacy-safe.

### 2.5 Future schema evolution

Because `displayName`/`createdAt`/`updatedAt` are the only fields Phase 1 readers depend on,
later phases can add fields additively (e.g. `lastPlayedAt`, an avatar/icon selection id, a
moderation-flag field) without a schema version bump or migration -- Firestore documents are
schemaless, and every reader here already treats an absent optional field as its documented
default. If a future phase needs a breaking reshape (unlikely for a document this small), the
repo's own `PersistentSaveV1`→`V2` precedent (an explicit `schemaVersion` field + a pure
migration function) is the model to follow -- not designed further here since nothing in Phase
1 needs it.

## 3. `displayName` validation contract

Enforced **server-side only** (inside the `setDisplayName` Callable Function, section 8) --
Firestore Rules' expression language cannot express Unicode-category checks (control/format
character detection, codepoint-aware length counting) precisely enough to be the sole gate, so
rules stay a coarse backstop (deny all direct writes, full stop) while the Function is the one
place the actual contract below is enforced and unit-testable exactly like
`submitLunchRushScore.ts`'s own validation pipeline.

| Case | Rule |
|---|---|
| Trimming | Leading/trailing whitespace (Unicode `White_Space` codepoints) is trimmed before every other check. |
| Internal whitespace | Runs of 2+ internal whitespace codepoints collapse to one halfwidth space. |
| Empty / whitespace-only | Rejected (after trim, length must be >= 1). |
| Min length | 1 codepoint (post-trim). |
| Max length | 20 codepoints, counted via `Array.from(name).length` (Unicode-codepoint-aware, not UTF-16 `.length`, so a single emoji or CJK codepoint outside the BMP counts as one character, not two). A raw-input hard ceiling of 200 UTF-16 code units is checked *before* codepoint counting, mirroring `submitLunchRushScore`'s own `MAX_SERVES_ARRAY_LENGTH` "cheap bound before expensive validation" pattern -- bounds the cost of validating a pathological input. |
| Japanese (hiragana/katakana/kanji) | Allowed, no restriction. |
| Alphanumeric (ASCII + fullwidth) | Allowed, no restriction. |
| Emoji / pictographic symbols | **Rejected in Phase 1.** Deliberately simple, deterministic scope: avoids cross-device emoji-width/font-rendering inconsistencies on a 390px leaderboard row and avoids the ambiguity between a legitimate emoji ZWJ sequence and the zero-width-character ban below. Revisit as a Phase 1C+/2 UX enhancement if requested, not a security concern either way. |
| Line breaks (`\n`, `\r`, etc.) | Rejected (subset of the control-character rule below, called out explicitly since a name is always rendered as a single line). |
| Control characters (`U+0000`-`U+001F`, `U+007F`-`U+009F`) | Rejected outright -- not silently stripped, so a rejection is always explainable and deterministic (Issue #129's own "無効な名前は決定的に拒否される" requirement). |
| Zero-width characters (`U+200B` ZWSP, `U+200C` ZWNJ, `U+200D` ZWJ, `U+FEFF` BOM, and the Unicode `Cf` "format" category generally) | Rejected -- these can render as an apparently-empty or spoofed-length name and have no legitimate use in Phase 1's plain-text-only name. |
| Duplicate names across different players | **Not enforced unique in Phase 1.** Uniqueness would require a separate name-reservation collection/transaction (extra collection, extra write path, extra rules surface) for a property that is cosmetic, not a security or fairness issue (a leaderboard entry's row is still keyed by `uid`, not by name). Explicitly out of scope; revisit only if real product feedback asks for it. |
| Reserved words | The exact strings `あなた` / `Anata` / `You` (case-insensitive on the ASCII variants) are rejected, since `あなた` is the own-row badge text the ranking UI already renders (section 4) -- a player named literally "あなた" would be visually indistinguishable from the badge itself on someone else's screen. No broader reserved-word list in Phase 1. |
| Offensive-name moderation | **Out of Phase 1 scope entirely**, by Issue #129's own instruction ("過剰なmoderationシステムはPhase 1へ入れない"). Documented as a deferred Phase 1C-or-later candidate (a static blocklist and/or a player-report affordance), not a security gap -- a leaderboard already displays scores from anonymous, unverified accounts; a name is no larger a moderation surface than that. |
| Rename frequency / rate limiting | **Yes, enforced.** A `setDisplayName` call is rejected with `resource-exhausted` if less than 60 seconds have elapsed since the existing document's `updatedAt` (server-timestamp comparison inside the Function, read-before-write). This is a scripted-abuse/Function-invocation-flood guard, not a UX limiter -- 60 seconds is invisible to any real player editing their name, and is far looser than a "renames per day" business rule, which is deliberately not imposed in Phase 1. |

Every rejection above is a distinct, unit-testable branch, mirroring
`functions/src/submitLunchRushScore.ts`'s own A-through-L validation-order structure and test
list (`functions/src/submitLunchRushScore.test.ts`) -- Phase 1A's own test suite
(section 9) is expected to cover each row above as its own scenario.

## 4. Ranking integration design

### 4.1 Options compared

**A. Denormalize a `displayName` snapshot onto the leaderboard entry document itself**
(`leaderboards/{periodId}/entries/{uid}.displayName`, written by the trusted
`submitLunchRushScore` Function at submission time, reading the submitter's own
`users/{uid}.displayName` first).

- Firestore reads: **zero** extra reads on the client ranking-read path (`getWeeklyLeaderboard`
  already fetches the `entries` documents; the name rides along as one more field on each).
- TOP 10 / TOP 100 scalability: best possible -- read cost is identical to today's, regardless
  of how many rows are shown.
- Rename reflection: **not retroactive.** An existing leaderboard entry keeps the name that was
  current at the moment that entry was last written (i.e. the last time that player beat their
  own best for that period). A rename only appears on a *future* submission's entry. Documented
  limitation, not a bug -- see 4.3.
- Consistency: eventually consistent in the same sense every other field on that entry already
  is (score/achievedAt are also only as fresh as the last accepted submission).
- Security: no new read surface at all -- `firestore.rules`' existing
  `leaderboards/{periodId}/entries/{uid}` read/write rules are completely unchanged; the write
  still happens exclusively through the Function's Admin SDK path.
- Implementation complexity: **low** -- one additional `users/{uid}` read inside
  `handleSubmitLunchRushScore`'s existing write path (only on the already-conditional "new
  best" branch, so it does not run on a losing/no-op submission), no new collection, no new
  trigger, no new rules.
- Cost: one extra Firestore read per accepted (new-best) submission -- submissions are already
  the expensive/rare operation relative to leaderboard reads, so this is the cheapest place to
  pay it.

**B. Look up `users/{uid}` client-side after fetching leaderboard entries (a join)**

- Firestore reads: **N extra reads per leaderboard open**, where N is the number of rows
  rendered (10 for today's TOP 10; would be 100 at a future TOP 100). Directly conflicts with
  this repo's own already-established "大量全件readは禁止" / no-bulk-read principle
  (`TETO_FIREBASE-RANKING_SETUP.md` section 26) and would materially increase Firestore billing
  every time any player opens the ranking overlay, not just on submission.
- Rename reflection: immediate/live (always current).
- Consistency: strongest of the three.
- Security: requires opening `users/{uid}` to **public** read (any signed-in-or-not client
  reading any other uid's profile document), a meaningfully larger read-surface than option A,
  which needs no `users/*` public read rule at all (section 8.2 keeps `users/{uid}` read scoped
  to the document's own owner). Widens the enumeration/scraping surface for no functional gain
  over A for this product's actual scale.
- Implementation complexity: moderate (new batched-get query, new rules surface, new tests).
- Cost: highest of the three, and scales with both leaderboard-open frequency and rows shown.

**C. Server-side materialization (an `onWrite` trigger on `users/{uid}` that fans the new name
out to that uid's existing weekly/monthly/all-time leaderboard entries)**

- Firestore reads: zero extra client reads, same as A, at read time.
- Rename reflection: can be made to update *existing* entries (up to 3 -- weekly/monthly/
  all-time -- per rename), closing option A's staleness gap.
- Consistency: eventually consistent, with a small, bounded fan-out per rename event rather
  than per submission.
- Security: unchanged read/write surface from today, same as A.
- Implementation complexity: **highest** -- a new Cloud Functions trigger, idempotency/race
  handling against a concurrent `submitLunchRushScore` write to the same entry document, and a
  new class of "which of 3 period documents currently exist for this uid" lookup logic that
  doesn't exist anywhere in the codebase today.
- Cost: cheaper than A in the steady state (renames are rarer than submissions), but the
  implementation/audit cost is materially higher for a Phase 1 feature.

### 4.2 Recommendation: **Option A**

Denormalize `displayName` onto the leaderboard entry at submission time. It is the cheapest and
simplest option that satisfies every Phase 1 acceptance criterion in Issue #129 ("leaderboard
shows display names", "own row still identifies あなた", "missing/legacy profile does not break
ranking"), needs **zero** Firestore Rules changes, and adds exactly one new read to an already
server-trusted, already-tested write path. It does not block a later move toward Option C if
rename-staleness ever becomes a real player complaint -- see 4.3.

### 4.3 Documented limitation and Phase 2B evolution path

Because A only refreshes a name on the entry a player's *next accepted submission* touches, a
player who renames but does not immediately beat their existing best score for a given period
keeps showing their old name on that period's leaderboard until they do. This is the same
"name at time of achievement" behavior common to many leaderboard products and is considered
acceptable for Phase 1. If it proves player-visible/undesirable, Phase 2B's recommended fix is
exactly Option C, scoped narrowly: an `onWrite` trigger on `users/{uid}` that patches
`displayName` on that uid's *current* weekly/monthly/all-time entry documents only (at most 3
writes per rename, using `set(..., { merge: true })` so it can never race-overwrite a
concurrent `score`/`achievedAt` write from `submitLunchRushScore`). Not built now.

## 5. Profile UX

### 5.1 Flow: HOME -> 設定 -> プレイヤー名 (not a forced first-run gate)

**Recommended**: extend the existing `SettingsOverlay.tsx` (opened from HOME's already-shipped
⚙️ button) with a new "プレイヤー名" section, following the same section/heading pattern its
existing "ゲームデータ" (Full Game Reset) section already establishes. **Not** a
forced-on-first-launch name prompt blocking gameplay.

Rationale:

- `ensureAnonymousUser()` already runs silently, fire-and-forget, on `App.tsx` mount -- no name
  is needed to establish identity, and Issue #129 explicitly keeps Anonymous Auth as the
  baseline (no mandatory login).
- A name only becomes *visible to anyone* once a score is submitted and shown in the weekly
  ranking -- there is no product reason to demand it before a player has even played once.
  Forcing a name-entry screen ahead of the very first game session adds first-session friction
  for zero immediate value, and risks a bad first name (typed in a rush, or skipped with a
  low-effort placeholder) that the player then has to notice and fix later anyway.
- The repo already has exactly the right shaped precedent for an optional, discoverable,
  non-blocking settings control: `SettingsOverlay`'s existing Full Game Reset section. A new
  "プレイヤー名" section slots in with no new overlay/navigation pattern invented.
- **Score submission never blocks on having a display name.** `submitLunchRushScore` continues
  to succeed with no `users/{uid}` document at all -- the ranking entry simply denormalizes the
  fallback name (section 2.3) in that case. This preserves the existing, already-shipped
  invariant that a ranking-related failure/gap can never be treated as a Lunch Rush gameplay
  failure (`submitLunchRushScore.ts` / `getWeeklyLeaderboard.ts`'s own "never fail the caller"
  contract, unchanged).
- Existing players (100% of current production users) never had a profile and must not be
  broken by this feature shipping -- the Settings-based, opt-in flow means an existing player
  who never opens Settings sees literally no behavior change at all.

### 5.2 Whether to force name entry -- evaluated and rejected

Issue #129 explicitly asks this to be evaluated. Rejected for Phase 1 for the reasons in 5.1.
A **non-blocking, dismissible, one-time nudge** (e.g. a small banner the first time
`WeeklyRankingOverlay` is opened with no `users/{uid}` document yet, "プレイヤー名を設定して
ランキングに表示しよう") is noted as an optional Phase 1C UX polish candidate -- not required
for Phase 1A/1B acceptance, not designed further here.

### 5.3 Settings UI shape (390x844 authority viewport)

- New `settings-overlay__section` (matching the existing "ゲームデータ" section's own
  heading/description/control shape): heading "プレイヤー名", a text input pre-filled with the
  current `displayName` if a profile exists (fetched via `getMyProfile`, section 8.3) or empty
  with the fallback shown as placeholder text if it doesn't, a save button, and inline
  validation-error text reusing the same `role="alert"` pattern `SettingsOverlay`'s own reset
  confirmation already uses.
- Save is disabled while a request is in flight (mirrors the existing
  `resetInFlightRef`/`isResetting` double-submit guard).
- A successful save updates the input's own displayed value from the Function's own response
  (the accepted, normalized -- trimmed/whitespace-collapsed -- name), never from an
  unconfirmed local echo, so the player always sees exactly what the server accepted.

## 6. Cloud Save boundary (Phase 2 design memo only -- no implementation)

**`users/{uid}` (profile) and a future cloud game save are deliberately kept as separate
documents/collections, never one combined document.** Recommendation, with rationale:

- **Read/write frequency mismatch**: profile is tiny and rarely written (a rename is a rare,
  human-paced event); a cloud game save (Pitz, recipe unlocks, inventory, Dex, achievements,
  settings) is comparatively large and would be written far more often (every purchase, every
  recipe unlock, every Dex entry). Combining them means every save write also risks touching --
  and needing to re-validate -- the profile fields, and vice versa.
- **Blast radius / validation ownership**: `setDisplayName`'s validation contract (section 3)
  has nothing to do with save-schema validation (versioning, migration, conflict resolution --
  a much larger surface). Keeping them separate means the profile's own Cloud Function and
  rules never need to know anything about save schema, and a future save-schema migration bug
  can never corrupt or block a profile read/write.
- **Read cost**: option A's ranking denormalization (section 4) reads `users/{uid}` on every
  accepted score submission. If that document also carried a large save blob, every submission
  would pay to read (and every rename fan-out, under a future Option C, would risk touching)
  far more data than the one field it actually needs.

Recommended future shape: `users/{uid}` stays exactly as scoped in section 2, and a future cloud
save lives at its own path, e.g. `users/{uid}/gameSave/{saveId}` (a subcollection, keeping the
uid linkage without merging documents) or a top-level `saves/{uid}`, decided by Phase 2's own
Fresh Audit -- not decided here since Issue #129 explicitly scopes that audit out of Phase 0.

**Phase 2 design notes (memo only):**

- **Versioning**: mirror `PersistentSaveV2`'s own `schemaVersion` field/migration-function
  precedent (`src/state/persistence.ts`'s `migrateV1toV2`) rather than inventing a new pattern.
- **Migration**: a cloud save migration should run under the same trusted-server-side posture
  established here and in Issue #87 (client input is never the authority) -- likely a Callable
  Function, not a client-side Firestore write, for anything that recomputes/validates.
- **Conflict resolution**: a naive last-write-wins (by server timestamp) risks silently losing
  progress on concurrent multi-device play. This repo's own existing "BEST never goes down"
  monotonic-merge precedent (`missionBest`, Dex `BEST` quality) is a stronger candidate model
  per-field than whole-document last-write-wins, and should be the starting point for Phase 2's
  own audit.
- **Offline**: must degrade to local-save-only exactly like today's "Firebase unconfigured/
  unavailable" fallback (`isFirebaseAvailable()` gating throughout `src/firebase/`) -- cloud
  save failure must never block or corrupt local gameplay, matching every existing Firebase
  integration's own "never fail the caller" contract.

No implementation, no schema, no migration code ships in this phase.

## 7. Account recovery (Phase 3 design boundary only -- no implementation)

Anonymous Auth alone cannot survive a cleared browser/device, a new iPhone, or a different
browser -- the `uid` (and everything keyed by it, profile and any future cloud save alike) is
lost. Recommended Phase 3 boundary, **not implemented now**:

- Firebase Auth's `linkWithCredential` API links a real provider credential (Google/Apple/etc.)
  to the **existing anonymous user**, preserving the same `uid` -- this is the preferred path
  over creating a new, separate authenticated account, since it needs **zero** data migration:
  `users/{uid}` and any future cloud save keep working unchanged, because the uid never changes.
- The one case that needs an explicit product decision (not made here): the target credential
  (e.g. a specific Apple ID) may already be linked to a *different* existing Firebase Auth user
  (e.g. the player played anonymously on two separate devices before ever linking either one).
  Firebase's own `linkWithCredential` throws `auth/credential-already-in-use` in that case --
  Phase 3 must decide a merge-or-abort UX and, if merge is chosen, which of the two profiles/
  saves wins (or how they combine). This is a real product decision, deliberately deferred.
- Google/Apple login is **not** a Phase 1 requirement (Issue #129's own explicit statement,
  matching Issue #87's original "allow future account linking" framing) -- Anonymous Auth
  remains fully sufficient and unmodified through Phase 1A/1B/1C.

## 8. Security -- threat audit

Firestore Rules and Cloud Functions responsibilities, stated explicitly (mirrors the split
Issue #87 already established for score submission):

- **Firestore Rules' job**: a coarse, always-on backstop -- deny every client write to
  `users/{uid}` unconditionally (only the Function's Admin SDK path, which bypasses rules,
  writes it), and allow client read **only** for a document's own owner. Rules cannot and do
  not attempt the fine-grained string-content validation in section 3.
- **Cloud Function's (`setDisplayName`) job**: the actual trust boundary for *content* --
  authentication, the full validation contract (section 3), the rename cooldown, and the
  server-timestamp-authoritative write.

### 8.1 Recommended `firestore.rules` addition (design only -- not written to the repo by Phase 0)

```
match /users/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false;
}
```

Placed alongside the existing `runs/{runId}` and `leaderboards/{periodId}/entries/{uid}`
matches, ahead of the existing deny-by-default backstop (which already covers `users/{uid}`
today, before this rule exists). This is Phase 1A's own rules change to make, together with a
`firestore.rules.test.ts` extension (own-doc read allowed, another uid's doc read denied,
every write denied for every actor including the document's own owner) mirroring the existing
test file's scenario style exactly.

### 8.2 Threat -> mitigation table

| Threat | Mitigation |
|---|---|
| Overwrite another player's profile | `setDisplayName` always writes `users/{request.auth.uid}` -- there is no `uid` field in its request payload to spoof (same pattern as `submitLunchRushScore`); rules independently deny 100% of direct client writes regardless. |
| displayName spoofing (impersonating another *named* player) | Not a security vulnerability (no account/data takeover); a cosmetic namespace-collision concern explicitly out of Phase 1 scope (section 3, "duplicate names"). The reserved-word rule (section 3) prevents the one collision that *would* be confusing -- naming yourself literally "あなた". |
| Leaderboard name spoofing (writing a fake name onto someone else's leaderboard entry) | `leaderboards/*/entries/*` write stays `allow write: if false` for every client, unchanged; the only writer remains the trusted Function, which denormalizes a name using only the *submitting* user's own `auth.uid` and that uid's own `users/{uid}.displayName` -- never attacker-suppliable. |
| Arbitrary UID | `uid` is read only from `request.auth.uid` in both `setDisplayName` and the ranking-snapshot read inside `submitLunchRushScore`, exactly matching the existing, audited pattern -- never from any payload field. |
| Arbitrary score | Unchanged, out of this feature's surface -- already mitigated by Issue #87's existing server-side recomputation (section 1). |
| Firestore direct write | `users/{uid}` rules deny all client write unconditionally (8.1) -- defense in depth alongside the Function's own auth check, so even a hypothetical Function bug cannot be bypassed by a client writing Firestore directly. |
| Oversized string | Function-side raw-length ceiling (200 UTF-16 units) checked before codepoint-aware validation, then the 20-codepoint max (section 3) -- mirrors `submitLunchRushScore`'s own `MAX_SERVES_ARRAY_LENGTH` "cheap bound first" pattern. |
| Malicious Unicode / control characters | Explicit control-character, zero-width-character, and Unicode `Cf`-category rejection (section 3), enforced deterministically server-side. |
| Rapid rename abuse | 60-second server-side cooldown, keyed off the document's own `updatedAt` (section 3), independent of any client-reported timestamp. |
| Missing auth | `setDisplayName` rejects with `unauthenticated` when `request.auth` is absent, mirroring `handleSubmitLunchRushScore`'s own first validation branch exactly. |
| Deleted / missing profile | A first-class, permanently supported state everywhere a name is read (section 2.3) -- never an error, never a broken render. |
| Old (pre-Profile-1.0) leaderboard entries | Same fallback handling as "missing profile" -- `WeeklyRankingOverlay`/`getWeeklyLeaderboard` must treat an entry with no `displayName` field exactly like one carrying the fallback name, with no assumption the field exists (section 2.3, section 4.3). |

### 8.3 Client read surface added

`src/firebase/` gains one new read (`getMyProfile()`, returning the signed-in user's own
`users/{uid}` document or `null`) for Settings' own current-name display (section 5.3) -- the
**only** new Firestore read path this design introduces, scoped to the caller's own document by
rules (8.1), matching `getWeeklyLeaderboard.ts`'s existing "one dedicated read module, nothing
else in `src/` imports `firebase/firestore` directly" discipline.

### 8.4 Alignment with Issue #87's future App Check (Phase 3 of #87)

`setDisplayName` is an authenticated write endpoint of the same class as
`submitLunchRushScore` (a Callable Cloud Function, currently protected only by Firebase Auth).
When Issue #87 Phase 3 (App Check / abuse hardening) ships, `setDisplayName` should be brought
under the same App Check enforcement at the same time, for the same reason -- not a separate
audit, just an additional Function name added to that phase's existing enforcement scope. No
App Check work is proposed or required for Player Profile Phase 1A/1B/1C themselves.

## 9. Implementation slices

Each slice is sized to a single ~2-3 hour Claude Code unit, matching Issue #129's own request.

### Phase 1A -- Profile foundation

- **Scope**: `users/{uid}` schema live; `firestore.rules` addition (8.1); Callable Function
  `setDisplayName` (`functions/src/setDisplayName.ts`, a pure `handleSetDisplayName` over an
  injected Firestore-like port + `functions/src/index.ts` wiring, mirroring
  `submitLunchRushScore.ts`/`index.ts`'s existing split exactly) implementing the full
  validation contract (section 3) and the write (create-if-absent / update-if-present,
  `createdAt` set once, `updatedAt` always refreshed); client `src/firebase/setDisplayName.ts`
  + `src/firebase/getMyProfile.ts` (or one combined `profile.ts`), exported from
  `src/firebase/index.ts`; `SettingsOverlay.tsx`'s new "プレイヤー名" section (5.3).
- **Changed files (candidate)**: `firestore.rules`, `firestore.rules.test.ts`,
  `functions/src/setDisplayName.ts` (+ `.test.ts`), `functions/src/index.ts`,
  `src/firebase/setDisplayName.ts` (+ `.test.ts`), `src/firebase/getMyProfile.ts`
  (+ `.test.ts`), `src/firebase/index.ts`, `src/components/SettingsOverlay.tsx`
  (+ `.test.tsx`), `App.css` (new `.settings-overlay__` rules for the new section).
- **Tests**: a full validation-matrix unit-test suite for `setDisplayName` (one scenario per
  section 3 row, mirroring `submitLunchRushScore.test.ts`'s A-L scenario style), a
  `firestore.rules.test.ts` extension (own-doc read allowed, other-doc read denied, every write
  denied for every actor), `SettingsOverlay` component tests for the new save/error/loading
  flow.
- **Migration**: none -- new collection, no existing data touched.
- **Deployment**: `firestore:rules,functions` deploy (same manual procedure as Issue #87's
  existing Phase 1B/2A deploys, section 17 of the setup doc); no `PersistentSaveV2` schema
  version bump (fully independent of local save).
- **Rollback**: revert the PR. `users/{uid}` becomes unreachable again (rules deny-by-default
  reasserts itself once the new `match` block is removed); no other collection is touched.
- **Dependency**: none beyond the already-production Firebase Ranking 1.0 foundation (Issue
  #87 Phase 1A-3A, already shipped and smoke-verified).

### Phase 1B -- Ranking display-name integration

- **Scope**: `submitLunchRushScore.ts` reads the submitting user's `users/{uid}.displayName`
  (one extra Admin SDK read, only on the already-conditional "new best" branch) and denormalizes
  it (falling back to the constant from 2.3 when absent/empty) into the weekly/monthly/
  all-time `leaderboards/{periodId}/entries/{uid}` upsert (Option A, section 4.2);
  `getWeeklyLeaderboard.ts` maps the new `displayName` field through (defaulting missing values
  to the same fallback constant); `WeeklyRankingOverlay.tsx` renders the name alongside rank/
  score, "あなた" badge behavior unchanged.
- **Changed files (candidate)**: `functions/src/submitLunchRushScore.ts` (+ `.test.ts`),
  `src/firebase/getWeeklyLeaderboard.ts` (+ `.test.ts`),
  `src/components/WeeklyRankingOverlay.tsx` (+ `.test.tsx`), `App.css` (name-row styling).
- **Tests**: extend `submitLunchRushScore.test.ts` with denormalization scenarios (profile
  present, absent, empty `displayName`); extend `getWeeklyLeaderboard.test.ts` with
  present-field and legacy-missing-field entries; extend `WeeklyRankingOverlay.test.tsx` for the
  rendered name row.
- **Migration**: none -- existing entries simply lack `displayName`; every read path already
  treats that as the fallback (2.3/4.3), forward-only, no backfill.
- **Deployment**: `functions` deploy only; no rules change (`leaderboards/*/entries/*`'s rules
  are untouched by Option A, section 4.2).
- **Rollback**: revert the PR; old and new-shaped entries coexist safely either way.
- **Dependency**: Phase 1A must ship and deploy first (`users/{uid}.displayName` must exist to
  read).

### Phase 1C -- Human Feel / production smoke (include only if warranted at Phase 1B's own close)

- **Scope**: real-device (390x844 iPhone, matching the existing production-smoke precedent) E2E
  pass: set name in Settings -> play -> weekly ranking shows the name -> rename -> resubmit ->
  confirm the documented 4.3 staleness behavior (old entry keeps old name, new entry shows new
  name) -- plus any copy/spacing polish the real device reveals.
- **Changed files (candidate)**: mostly a result report + screenshots; at most minor CSS/copy
  tweaks discovered during the smoke pass.
- **Tests**: manual E2E smoke, screenshots; no new unit-test surface expected.
- **Migration**: none.
- **Deployment**: none new -- exercises what Phase 1A/1B already deployed.
- **Rollback**: n/a (polish-only).
- **Dependency**: Phase 1A + 1B merged and deployed to the production Firebase project
  (`teto-pizza-game`).

### Phase 2 -- Cloud Save Fresh Audit (not scoped here)

A separate, dedicated Fresh Audit, per section 6's memo -- out of Player Profile 1.0's own
implementation scope. Not sliced further in this document.

### Phase 3 -- Account recovery / linking (not scoped here)

A separate, dedicated audit/implementation, per section 7's boundary -- out of Player Profile
1.0's own implementation scope. Not sliced further in this document.
