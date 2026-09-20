import { doc, getDoc, getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseApp } from "./client";
import { ensureAnonymousUser } from "./auth";

/**
 * Player Profile 1.0 Phase 1A (Issue #129). The client's one read path for a player's own
 * `users/{uid}` document -- a direct Firestore read (not a Callable Function), since
 * `firestore.rules`' own `users/{uid}` rule already allows a document's own owner to read it
 * (design doc section 8.1/8.3). Deliberately the only file besides
 * ./getWeeklyLeaderboard.ts that imports `firebase/firestore` -- no write path exists here or
 * should ever be added here; `users/{uid}` stays writable only through ./setDisplayName.ts's
 * Callable Function (firestore.rules' own `allow write: if false`).
 *
 * `ensureAnonymousUser()` (not `getCurrentAuthUser()`) is used deliberately: Settings can be
 * opened before App.tsx's own fire-and-forget mount-time sign-in has resolved, and a profile
 * read genuinely needs a signed-in uid (unlike ./getWeeklyLeaderboard.ts's public read path) --
 * this reuses whatever sign-in is already in flight rather than risking a spurious "no user
 * yet" result on a fast tap into Settings.
 */

/** Every player who existed before Player Profile 1.0 shipped, and any player who simply never
 *  opens Settings, has no `users/{uid}` document -- this is a first-class, permanently
 *  supported state, not an error. Every reader of a player's name (Settings' own display, and
 *  Phase 1B's future ranking denormalization) falls back to this exact string. */
export const FALLBACK_DISPLAY_NAME = "ななしピザ職人";

export interface PlayerProfile {
  displayName: string;
}

export type GetMyProfileResult =
  | { status: "unavailable" }
  | { status: "error"; message: string }
  /** `profile: null` means no `users/{uid}` document exists yet -- a normal, permanent state
   *  (design doc section 2.3), never treated as an error. */
  | { status: "success"; profile: PlayerProfile | null };

let cachedFirestore: Firestore | null | undefined;

function getFirebaseFirestore(): Firestore | null {
  if (cachedFirestore !== undefined) return cachedFirestore;
  const app = getFirebaseApp();
  cachedFirestore = app ? getFirestore(app) : null;
  return cachedFirestore;
}

/**
 * Reads the signed-in player's own profile. Never throws -- every failure mode (Firebase
 * unconfigured, no auth user, network/permission error) resolves to a typed result, mirroring
 * ./getWeeklyLeaderboard.ts's own "never fail the caller" contract.
 */
export async function getMyProfile(): Promise<GetMyProfileResult> {
  const db = getFirebaseFirestore();
  if (!db) return { status: "unavailable" };

  try {
    const user = await ensureAnonymousUser();
    if (!user) return { status: "unavailable" };

    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (!snapshot.exists()) return { status: "success", profile: null };

    const data = snapshot.data();
    const displayName = typeof data.displayName === "string" ? data.displayName : null;
    return { status: "success", profile: displayName ? { displayName } : null };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

/** Test-only: clears the cached Firestore instance, mirroring ./getWeeklyLeaderboard.ts's own
 *  `__resetGetWeeklyLeaderboardForTests`. */
export function __resetGetMyProfileForTests(): void {
  cachedFirestore = undefined;
}
