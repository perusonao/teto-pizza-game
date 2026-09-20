/**
 * Firebase Ranking 1.0 (Issue #87) public surface. Deliberately small -- this is the only
 * entry point App.tsx (or any future phase) should import from; `./config.ts` / `./client.ts`
 * / `./auth.ts` / `./submitLunchRushScore.ts` internals stay private to this folder so the
 * Firebase SDK is never called directly from outside it.
 */
export { isFirebaseAvailable } from "./client";
export { ensureAnonymousUser, getCurrentAuthUser } from "./auth";
export {
  submitLunchRushScore,
  type SubmitLunchRushScoreInput,
  type SubmitLunchRushScoreResult,
} from "./submitLunchRushScore";
