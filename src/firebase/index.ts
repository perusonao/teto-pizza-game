/**
 * Firebase Ranking 1.0 Phase 1A (Issue #87) public surface. Deliberately small -- this is
 * the only entry point later phases (1B's score submission, 2A's ranking UI) or App.tsx
 * should import from; `./config.ts` / `./client.ts` / `./auth.ts` internals stay private to
 * this folder so the Firebase SDK is never called directly from outside it.
 */
export { isFirebaseAvailable } from "./client";
export { ensureAnonymousUser, getCurrentAuthUser } from "./auth";
