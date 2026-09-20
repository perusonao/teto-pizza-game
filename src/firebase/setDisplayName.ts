import { getFunctions, httpsCallable, type Functions } from "firebase/functions";
import { getFirebaseApp } from "./client";
import { ensureAnonymousUser } from "./auth";

/**
 * Player Profile 1.0 Phase 1A (Issue #129). The client's one call site for the trusted
 * displayName write path:
 *
 *   Settings "保存" -> ensureAnonymousUser() -> Callable Cloud Function
 *   (setDisplayName, functions/src/) -> server-side validation/cooldown ->
 *   Firestore Admin write
 *
 * This module never writes to Firestore itself, mirroring
 * ./submitLunchRushScore.ts's own security posture exactly -- `users/{uid}` stays writable only
 * through this Callable Function (firestore.rules' own `allow write: if false`).
 */

export interface SetDisplayNameInput {
  displayName: string;
}

export type SetDisplayNameResult =
  /** The server's own accepted, normalized name -- never an unconfirmed echo of the caller's
   *  raw input. */
  | { status: "success"; displayName: string }
  /** Firebase is unconfigured, the Function call is unavailable, or no auth user could be
   *  established. */
  | { status: "unavailable" }
  /** The Function rejected the input itself (see ../shared/displayNameValidation.ts's
   *  contract) -- `message` is the server's own (English, debug-oriented) message; a caller
   *  should show its own localized copy, not this string, to the player. */
  | { status: "invalid-argument"; message: string }
  /** Rejected by the 60-second rename cooldown. */
  | { status: "cooldown"; message: string }
  /** Any other failure (network, unauthenticated, internal, ...) -- never shown verbatim to
   *  the player. */
  | { status: "failed"; message: string };

interface SetDisplayNameRequest {
  displayName: string;
}

interface SetDisplayNameResponse {
  displayName: string;
}

let cachedFunctions: Functions | null | undefined;

// Must match the deployed callable Function's own region (functions/src/index.ts's
// `onCall({ region: ... })`) -- see ./submitLunchRushScore.ts's own comment on why.
const FUNCTIONS_REGION = "asia-northeast1";

function getFirebaseFunctions(): Functions | null {
  if (cachedFunctions !== undefined) return cachedFunctions;
  const app = getFirebaseApp();
  cachedFunctions = app ? getFunctions(app, FUNCTIONS_REGION) : null;
  return cachedFunctions;
}

/** The Firebase JS SDK's `httpsCallable` rejects with a `FunctionsError` carrying a `code`
 *  field matching the server's own `HttpsError` code (e.g. `"invalid-argument"`,
 *  `"resource-exhausted"`) -- narrowed defensively since the thrown value's shape is otherwise
 *  `unknown`. */
function functionsErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Sets the signed-in player's display name via the trusted Callable Function. Never throws --
 * every failure mode resolves to a typed result instead of rejecting, mirroring
 * ./submitLunchRushScore.ts's own "never fail the caller" contract.
 */
export async function setDisplayName(input: SetDisplayNameInput): Promise<SetDisplayNameResult> {
  const functions = getFirebaseFunctions();
  if (!functions) return { status: "unavailable" };

  try {
    const user = await ensureAnonymousUser();
    if (!user) return { status: "unavailable" };

    const callable = httpsCallable<SetDisplayNameRequest, SetDisplayNameResponse>(
      functions,
      "setDisplayName",
    );
    const response = await callable({ displayName: input.displayName });
    return { status: "success", displayName: response.data.displayName };
  } catch (error) {
    const code = functionsErrorCode(error);
    const message = error instanceof Error ? error.message : String(error);
    if (code === "invalid-argument") return { status: "invalid-argument", message };
    if (code === "resource-exhausted") return { status: "cooldown", message };
    return { status: "failed", message };
  }
}

/** Test-only: clears the cached Functions instance, mirroring
 *  ./submitLunchRushScore.ts's own `__resetSubmitLunchRushScoreForTests`. */
export function __resetSetDisplayNameForTests(): void {
  cachedFunctions = undefined;
}
