import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirebaseApp } from "./client";

/**
 * Firebase Ranking 1.0 Phase 1A (Issue #87). Anonymous Auth foundation only -- no Firestore
 * write, no Cloud Function call, no UID ever copied into `PersistentSaveV2` (src/state/
 * persistence.ts stays untouched). Phase 1B's trusted score-submission path is the first
 * consumer of `ensureAnonymousUser()`; nothing calls it from the local save/reset flow, so
 * "reset game progress" (src/state/persistence.ts's `resetSave`) and "delete the Firebase
 * Auth user" stay two independent, never-conflated operations (setup doc section 9).
 */
let cachedAuth: Auth | null | undefined;

function getFirebaseAuth(): Auth | null {
  if (cachedAuth !== undefined) return cachedAuth;
  const app = getFirebaseApp();
  cachedAuth = app ? getAuth(app) : null;
  return cachedAuth;
}

/** The current Firebase Auth user, or `null` when Firebase is unavailable or no user is
 *  signed in yet. Never throws. Not used to display anything -- no UID reaches the UI. */
export function getCurrentAuthUser(): User | null {
  return getFirebaseAuth()?.currentUser ?? null;
}

/** Resolves once Firebase Auth has restored (or confirmed the absence of) a persisted
 *  session, so `ensureAnonymousUser` never races a real returning user into a spurious
 *  duplicate `signInAnonymously` call just because `auth.currentUser` hasn't hydrated yet. */
function waitForInitialAuthState(auth: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      () => {
        unsubscribe();
        resolve(null);
      },
    );
  });
}

let ensureInFlight: Promise<User | null> | null = null;

/**
 * Ensures a signed-in Firebase user exists, reusing an existing (including a just-restored
 * persisted) session before ever calling `signInAnonymously`. Concurrent callers while a
 * sign-in is already underway share the same in-flight promise rather than each triggering
 * their own `signInAnonymously` call. Never throws: Firebase being unconfigured, offline, or
 * actively rejecting the sign-in all resolve to `null` -- callers must treat "no user" as a
 * normal outcome, never a reason to break gameplay.
 */
export function ensureAnonymousUser(): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) return Promise.resolve(null);
  if (ensureInFlight) return ensureInFlight;

  ensureInFlight = (async () => {
    try {
      const existing = auth.currentUser ?? (await waitForInitialAuthState(auth));
      if (existing) return existing;
      const credential = await signInAnonymously(auth);
      return credential.user;
    } catch {
      return null;
    }
  })().finally(() => {
    ensureInFlight = null;
  });

  return ensureInFlight;
}

/** Test-only: clears this module's cached Auth instance and any in-flight `ensureAnonymousUser`
 *  call, mirroring `./client.ts`'s `__resetFirebaseAppForTests`. */
export function __resetFirebaseAuthForTests(): void {
  cachedAuth = undefined;
  ensureInFlight = null;
}
