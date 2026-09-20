# Lunch Rush Online Ranking 1.0 -- Phase 1A Result Report

Issue #87 ("Lunch Rush Online Ranking 1.0 -- weekly / monthly / all-time (Firebase
architecture)"), Phase 1A slice: **Firebase Foundation + Anonymous Auth only**.

## 1. Audited main SHA

`4a42868a8392dbf6f82bd53fd8defcaf0f564cc9` ("Visual Polish 1C: improve Shop scalability
(#111)"), fetched fresh from `origin/main` at the start of this task. This branch was created
directly from that commit (no rebase needed).

Confirms the task's stated context: `c5939a9` ("Lunch Rush Completion Gate 1A (#110)") is
present on `main` at this SHA.

## 2. Issue #87 status

Open. No open PR or in-flight branch targets Firebase/Anonymous Auth/Ranking for Phase 1A at
task start (Duplicate PR Gate #1) or immediately before this PR was opened (Gate #2). One
unmerged, PR-less reference branch exists:
`claude/lunch-rush-ranking-phase0-cpu5ki` (commit `fc395e6`, "Phase 0 fresh architecture/threat
audit", `docs/reports/TETO_LUNCH-RUSH_ONLINE-RANKING_Phase0_Fresh-Audit.md`, 480 lines,
read-only/no code). It was never merged and has no PR, so it is not a duplicate in flight --
it was read as reference material per this task's instructions, not treated as authoritative
(fresh main audit was authoritative instead, per this task's own instructions).

## 3. Phase 0 vs. this Phase 1A audit -- notable differences

The Phase 0 audit (written 2026-09-19) already flagged that Completion Gate Phase 1 (`ecb5c8c`,
merged before Phase 0's audit) was "computed but not applied to Mission's serve path (a FAILED
pizza still counts fully today)". This task's own instructions independently reconfirm that
same known gap exists post-merge of "Lunch Rush Completion Gate 1A" (`c5939a9`, #110). **This
Phase 1A explicitly does not fix that** -- it is a Lunch Rush scoring/Completion Gate
integration concern, entirely outside this phase's Firebase-foundation scope (see Architecture
Boundary item J below: Completion Gate integration is required to stay *unchanged*, not
corrected, by this PR). It remains open for whichever phase actually wires Completion Gate
into Mission scoring.

No other material change to the fresh-audit facts below versus Phase 0's account.

## 4. Fresh audit findings (start of this task)

- No `firebase` (or any Firebase-adjacent) dependency existed in `package.json`.
- No existing auth abstraction of any kind.
- Env handling convention: Vite `VITE_`-prefixed vars, precedent set by `VITE_PREVIEW_MODE`
  (`src/state/persistence.ts`) and `VITE_PREVIEW_PR`/`VITE_PREVIEW_SHA`
  (`src/components/PreviewBadge.tsx`).
- GitHub Pages base path: `base: '/teto-pizza-game/'` (`vite.config.ts`), unchanged by this PR.
- Mission score authority: `src/logic/missionScoring.ts` (`missionScore`,
  `isNewMissionBest`), fed from `src/mission/lunchRush.ts`'s `recordServe`. Untouched.
- `missionBest` persistence: `PersistentSaveV2.missionBest`, written monotonically via
  `persistMissionBest` (`src/state/persistence.ts`). Untouched.
- Completion Gate integration: computed in `src/state/gameReducer.ts` but (per section 3
  above) not yet applied to Mission's serve/score path. Untouched by this PR either way.
- Save schema: `PersistentSaveV2` (`schemaVersion: 2`), fields `dex` / `pitzBalance` /
  `ownedIngredientIds` / `missionBest` / `inventory` / `starterGrantClaimedRecipeIds`. No
  Firebase-related field added; schema version not bumped (no schema change at all).
- Full Game Reset (`src/App.tsx`'s `handleResetGameData`, Issue #89): calls `resetSave()`
  (clears the one `localStorage` key) then `window.location.reload()`. No Firebase interaction
  existed before this PR and none was added -- confirmed by not touching `persistence.ts` or
  `handleResetGameData` at all.

## 5. Architecture (this PR)

```
src/firebase/
  config.ts   -- getFirebaseConfig(): FirebaseWebConfig | null, from VITE_FIREBASE_* env
  client.ts   -- getFirebaseApp() (lazy, cached, config-gated), isFirebaseAvailable()
  auth.ts     -- ensureAnonymousUser(), getCurrentAuthUser()
  index.ts    -- public surface: isFirebaseAvailable, ensureAnonymousUser, getCurrentAuthUser
```

`App.tsx` calls `ensureAnonymousUser()` once on mount (fire-and-forget, empty-deps
`useEffect`, guarded by `isFirebaseAvailable()`) so a Firebase identity is established in the
background ahead of Phase 1B needing one, with zero UI and zero coupling to gameplay state.
Full details, including the Phase 1B connection point, in
`docs/design/TETO_FIREBASE-RANKING_SETUP.md`.

Nothing outside `src/firebase/` imports `firebase/app` or `firebase/auth` directly.

## 6. Added dependency

`firebase` `^12.19.0` (installed: `12.19.0`), the official modular Firebase Web SDK. Only
`firebase/app` and `firebase/auth` submodules are imported anywhere in this PR -- no
`firebase/firestore`, `firebase/functions`, `firebase/analytics`, etc.

## 7. Firebase initialization

`getFirebaseApp()` (`src/firebase/client.ts`) reads config via `getFirebaseConfig()`; if any
of the four required fields is missing, it caches and returns `null` without calling
`initializeApp`. When config is present, it reuses `getApp()` if a default app already exists
(defensive, for whenever the app has more than one Firebase-consuming module in the future)
rather than calling `initializeApp()` twice. Never throws.

## 8. Anonymous Auth abstraction

`ensureAnonymousUser()` (`src/firebase/auth.ts`):
- Returns `auth.currentUser` immediately if already hydrated.
- Otherwise waits for Firebase Auth's own `onAuthStateChanged` to report its restored
  persisted session (or `null`) before deciding whether a sign-in is actually needed -- this
  is what lets a *returning* anonymous user be reused instead of minted fresh on every reload,
  since `auth.currentUser` is not synchronously populated before persistence restoration
  completes.
- Calls `signInAnonymously` only if no existing/restored user was found.
- Concurrent callers while a sign-in is in flight share one promise and one
  `signInAnonymously` call (no duplicate sign-ins).
- Resolves to `null` (never throws/rejects) on any failure: Firebase unconfigured, offline, or
  the SDK call itself rejecting.
- No UID is ever logged, displayed, or written into `PersistentSaveV2`.

## 9. Environment variables

`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_APP_ID` -- all four required together (a partial set is treated as fully
unset). See `.env.example` (new, placeholder-only, no real values) and
`docs/design/TETO_FIREBASE-RANKING_SETUP.md` section 4. `.env.local` was already covered by
the existing `*.local` `.gitignore` pattern -- no gitignore change was needed.

## 10. Fallback behavior

- No env set (today's state for local dev, CI, and production): `isFirebaseAvailable()` is
  `false`, `ensureAnonymousUser()`'s mount-time call is skipped entirely, `getCurrentAuthUser()`
  returns `null`. No error, no modal, no console error.
- Valid config but the SDK/network fails: `ensureAnonymousUser()` catches and resolves `null`;
  nothing in `App.tsx` awaits or branches on its result, so gameplay is unaffected either way.

## 11. Save / reset boundary

`PersistentSaveV2` (`src/state/persistence.ts`) was not modified. No Firebase uid field was
added to it. `resetSave()` / `handleResetGameData()` (Full Game Reset, Issue #89) were not
modified and contain no call into `src/firebase/*` -- "reset game progress" (local save only)
and "delete the Firebase Auth user" remain two independent, unconflated operations, as this
task requires. This boundary is also documented explicitly in
`docs/design/TETO_FIREBASE-RANKING_SETUP.md` section 7.

## 12. GitHub Pages compatibility

`vite.config.ts` (`base: '/teto-pizza-game/'`) and both workflows
(`.github/workflows/ci.yml`, `deploy.yml`) are unmodified. `npm run build` succeeds with zero
Firebase env vars set (verified below) -- no dummy secret was added to either workflow.

## 13. Tests

- New: `src/firebase/config.test.ts` (3), `src/firebase/client.test.ts` (3),
  `src/firebase/auth.test.ts` (8) -- 14 tests total, covering scenarios A-G from this task's
  spec (env unset -> unavailable; valid mock config -> initializes once/caches/reuses existing
  app; existing/restored user reused without a duplicate `signInAnonymously`; no user -> signs
  in; sign-in failure resolves `null`; concurrent `ensureAnonymousUser` calls share one
  sign-in; a later call after resolution does not re-sign-in). All via `vi.mock("firebase/app")`
  / `vi.mock("firebase/auth")` -- no real network/Firebase project used anywhere in the suite.
- Full suite: **1682 passed** (1668 pre-existing + 14 new), **87 test files**, 0 failed.
- `src/state/phase4a1a.regression.test.ts` (documented pre-existing flaky) re-run in isolation:
  8/8 passed, no flake observed this run. Not modified by this PR.
- `src/App.fullGameReset.test.tsx` (H), `src/mission/lunchRush.test.ts` (I),
  `src/state/gameReducer.completionGate*.test.ts` (J): all pass unmodified, confirming Full
  Game Reset, Lunch Rush mission scoring, and Completion Gate behavior are all byte-for-byte
  unchanged by this PR (none of those source files were touched).
- `tsc -b` (typecheck): clean, 0 errors.
- `oxlint`: clean, 0 warnings/errors.

## 14. Build

- `npm run build` with **no** `VITE_FIREBASE_*` set: succeeds.
- `npm run build` with a **mock** full config set (`VITE_FIREBASE_API_KEY=mock-api-key` etc.):
  succeeds, output size effectively identical (env values are just embedded strings; no
  different code path is taken at build time -- config presence is a runtime check).

## 15. Browser verification

Production-equivalent build (`vite preview`, no Firebase env set) at **390x844**, Chromium
(Playwright, headless):

| Screen | Loaded | Console/page errors | Horizontal overflow |
|---|---|---|---|
| HOME | Yes (buttons: 設定/ピザを作る/ランチラッシュ/図鑑/ショップ/材料/実績) | None | None (scrollWidth == clientWidth == 390) |
| FREE (Pizza Select, via "ピザを作る") | Yes | None | None |
| Lunch Rush (via "ランチラッシュ") | Yes | None | None |

No blank screen, no Firebase error modal (none exists -- Ranking UI is out of scope), no
uncaught console/page error on any of the three screens. Real Anonymous Auth network calls
were **not** exercised in the browser (no real Firebase project credentials available in this
environment, per this task's own instruction) -- Anonymous Auth's actual sign-in behavior is
covered by the mocked unit tests in section 13 instead, and real end-to-end verification is
listed under Manual Setup Required / Phase 1B prerequisites below.

## 16. Bundle impact

Production build, `dist/assets/*.js` (single chunk):

| | Before | After | Delta |
|---|---|---|---|
| Raw | 358.66 kB | 456.04 kB | +97.38 kB |
| Gzip | 110.39 kB | 140.00 kB | +29.61 kB |

The increase is `firebase/app` + `firebase/auth` shipping unconditionally (they're imported
from `App.tsx` via the mount-time `ensureAnonymousUser()` call, so they're not tree-shaken
away even though they're a no-op at runtime without a configured project). This was a
deliberate tradeoff to make Anonymous Auth actually functional end-to-end the moment a project
is configured (see section 5) rather than shipping fully inert code; if a smaller Phase 1A
footprint is preferred instead, removing the `App.tsx` mount-time call (keeping `src/firebase/`
itself as an unused, and therefore tree-shaken, foundation until Phase 1B imports it) would
bring the delta close to zero.

## 17. Security assessment

- No Firestore/Functions usage exists yet in this codebase -- there is nothing for a client to
  write an authoritative score into. The "no client-authoritative score write" rule (Issue #87,
  this task's section 3) is trivially satisfied because Phase 1A adds no Firestore code at all.
- `VITE_FIREBASE_API_KEY` is a public identifier, not a secret (see `.env.example`'s comment
  and setup doc section 4) -- it is safe in a public GitHub Pages bundle. No Admin SDK
  credential, service account, or private key was added anywhere in this repo.
- No UID reaches local storage, the UI, or any log.
- `.env.example` contains only empty placeholders, no real project values.

## 18. Manual Setup Required

See `docs/design/TETO_FIREBASE-RANKING_SETUP.md` section 8 for the full walkthrough. Summary
(all human/Firebase-Console actions, none of which this PR can or does perform):

1. Create/select a Firebase project.
2. Register a Web App in it.
3. Enable Anonymous sign-in (Authentication -> Sign-in method).
4. Set `VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` (local `.env.local`
   and/or GitHub Actions secrets, once a live deploy needs them).
5. Confirm `perusonao.github.io` (and any preview origin) is in Authorized domains.

Explicitly **not** required for Phase 1A: Firestore database creation, Blaze plan upgrade,
Cloud Functions deployment, App Check registration.

## 19. Phase 1B prerequisites

- A real Firebase project + the Manual Setup above, to exercise Anonymous Auth against a live
  backend (this PR's own verification used mocks only, per section 15).
- Firestore schema / security rules design for `ScoreSubmissionV1` (see the Phase 0 audit
  doc for a prior draft of this) -- not started in this PR.
- A decision on the Completion Gate / Mission scoring gap (section 3) before treating any
  submitted score as competitively meaningful, per Issue #87's own "Important dependencies"
  section.
- A Callable Cloud Function as the only trusted write path into Firestore (Issue #87's
  security requirement) -- no Functions code exists yet.

## 20. Remaining risks

- The mount-time `ensureAnonymousUser()` call in `App.tsx` has no real-network coverage in
  this environment (see section 15/16's tradeoff note) -- its correctness against an actual
  Firebase project should be spot-checked once Manual Setup is done, even though its logic is
  fully unit-tested against the mocked SDK.
- `src/state/phase4a1a.regression.test.ts`'s documented pre-existing flake was not reproduced
  in this task's runs, but remains a known, unrelated risk per this task's own instructions
  (not something this PR fixes or masks).
- The Completion Gate / FAILED-pizza-scoring gap (section 3) remains open; it is out of scope
  here but blocks treating Lunch Rush scores as ranking-ready in a later phase.

## 21. Final Verdict

**B. READY WITH MANUAL SETUP**

The code is safe to merge as-is: offline gameplay is provably unaffected (fresh-audit
regression suite unchanged and passing, byte-for-byte-unmodified Mission/Completion
Gate/save/reset code paths, build succeeds with zero Firebase env), and everything Firebase-
related is inert until a human completes the Manual Setup Required steps in section 18. No
code change is blocking; the "with Manual Setup" qualifier reflects that Anonymous Auth has no
live-project verification yet (mocked-only, section 15/20) and that Phase 1B cannot start
building score submission until that Firebase project exists.
