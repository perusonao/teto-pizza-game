import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirebaseConfig } from "./config";

/**
 * Firebase Ranking 1.0 Phase 1A (Issue #87). Lazily initializes (and caches) the Firebase App
 * singleton, only when a full config is present -- see ./config.ts. `undefined` (not yet
 * decided) is kept distinct from `null` (decided: unavailable) so a config-less build never
 * repeats the "no config" check on every call, and reuses `getApp()` instead of calling
 * `initializeApp()` twice if some other Firebase-consuming code (none exists yet in Phase 1A)
 * already initialized it first -- `initializeApp()` throws if called twice with an app of the
 * same (default) name.
 */
let cachedApp: FirebaseApp | null | undefined;

export function getFirebaseApp(): FirebaseApp | null {
  if (cachedApp !== undefined) return cachedApp;

  const config = getFirebaseConfig();
  if (!config) {
    cachedApp = null;
    return null;
  }

  cachedApp = getApps().length > 0 ? getApp() : initializeApp(config);
  return cachedApp;
}

/** True when a Firebase App is available (a full config was found). Never throws. */
export function isFirebaseAvailable(): boolean {
  return getFirebaseApp() !== null;
}

/** Test-only: clears the cached App so a test's env/config stubbing takes effect on the next
 *  call. Firebase itself has no supported "deinitialize" API, so this only resets this
 *  module's own cache -- tests that need a truly fresh SDK state mock `firebase/app` instead. */
export function __resetFirebaseAppForTests(): void {
  cachedApp = undefined;
}
