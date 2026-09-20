# Firebase Ranking 1.0 -- Setup & Architecture (Phase 1A)

Issue #87. This document covers **Phase 1A only**: Firebase client foundation + Anonymous
Auth foundation. It is not a leaderboard design doc -- Firestore schema, score submission,
Cloud Functions, and ranking UI are all future-phase work (see "Phase 1B and beyond" below).

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
