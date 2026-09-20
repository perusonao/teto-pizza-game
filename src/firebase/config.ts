/**
 * Firebase Ranking 1.0 Phase 1A (Issue #87). Reads the Firebase Web config from Vite's
 * `VITE_`-prefixed env vars (see `.env.example`), following the same convention
 * `VITE_PREVIEW_MODE` already uses (src/state/persistence.ts). A Firebase Web `apiKey` is not
 * a secret -- it only identifies which Firebase project a request targets, and access is
 * actually enforced by Firestore/Storage security rules and (later phases) App Check, not by
 * hiding this value -- so it is safe to ship in a public client bundle exactly like any other
 * `VITE_` var. Nothing that must stay secret (an Admin SDK service account key) ever belongs
 * here or anywhere in this repo.
 *
 * All four fields are required together: a partially-set config (e.g. only `apiKey` present
 * because someone half-copied a `.env.local`) is treated identically to "fully unset" rather
 * than attempted, so `getFirebaseApp()` (./client.ts) never hands the SDK a config that can't
 * actually authenticate.
 */
export interface FirebaseWebConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly appId: string;
}

/**
 * Returns the Firebase Web config from env, or `null` when any required field is missing --
 * the expected state for local dev, CI, and any build where Firebase hasn't been set up yet
 * (see section 6/11 "Manual Setup Required" in the setup doc). Never throws.
 */
export function getFirebaseConfig(): FirebaseWebConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}
