/**
 * Player Profile 1.0 Phase 1A (Issue #129). `setDisplayName`'s core logic -- authentication,
 * validation, cooldown enforcement, and the Firestore write it authorizes -- kept as a pure-ish
 * function over an injected `FirestoreLike` port, exactly mirroring
 * ./submitLunchRushScore.ts's own "no `admin`/`functions` types in the signature, so every
 * scenario runs as a fast unit test against an in-memory fake" discipline. `./index.ts` is the
 * only place that wires this to the real Admin SDK and the real `onCall` trigger.
 *
 * Trust boundary (design doc section 8): `uid` comes only from the Callable Function's own auth
 * context (never the payload -- there is no `uid` field in `SetDisplayNameRequestPayload` at
 * all). The actual `displayName` content contract lives in
 * ../../src/shared/displayNameValidation.ts (shared verbatim with the client's own UX-only
 * pre-check) -- this module's own job is auth, the create-vs-rename decision, the 60-second
 * rename cooldown, and deciding what gets written, never the string-content rules themselves.
 */
import {
  DisplayNameValidationError,
  normalizeAndValidateDisplayName,
} from "../../src/shared/displayNameValidation";

/** No client input is ever trusted for timing -- 60 seconds, measured against the existing
 *  document's own server-authoritative `updatedAt`, never any client-reported clock. */
export const RENAME_COOLDOWN_MS = 60_000;

export type SetDisplayNameErrorCode = "unauthenticated" | "invalid-argument" | "resource-exhausted";

export class SetDisplayNameError extends Error {
  readonly code: SetDisplayNameErrorCode;

  constructor(code: SetDisplayNameErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "SetDisplayNameError";
  }
}

/** The only auth fact this handler ever reads -- always the Callable Function's own verified
 *  auth context (`request.auth.uid` in ./index.ts), never anything from the payload. */
export interface SetDisplayNameAuthContext {
  uid: string;
}

/** The wire shape of a request, before validation. */
export interface SetDisplayNameRequestPayload {
  displayName?: unknown;
}

export interface SetDisplayNameAccepted {
  /** The accepted, normalized (trimmed/whitespace-collapsed) name -- never an unconfirmed
   *  local echo of the caller's raw input. */
  displayName: string;
}

/** `users/{uid}`'s existing document, as read inside the transaction -- `updatedAtMillis` is
 *  already resolved to a real epoch-ms number by the adapter (./index.ts), since a Firestore
 *  `Timestamp` read back mid-transaction is no longer the opaque `serverTimestamp()` sentinel
 *  this module writes; it is a concrete, comparable point in time. */
export interface ExistingProfile {
  displayName: string;
  createdAt: unknown;
  updatedAtMillis: number;
}

export interface ProfileWrite {
  displayName: string;
  createdAt: unknown;
  updatedAt: unknown;
}

/**
 * A narrow, purpose-built port over a single `users/{uid}` document's read-check-write cycle --
 * not a generic Transaction/DocumentReference shim, exactly like ./submitLunchRushScore.ts's own
 * `FirestoreLike`. `mutate` receives the existing document (or `null` if none exists yet) and
 * must resolve to `{ write, result }` to accept the call, or throw `SetDisplayNameError` to
 * reject it with no write. The real implementation (./index.ts) runs `mutate` inside a genuine
 * Firestore transaction (`db.runTransaction`), which retries automatically on write-write
 * contention -- re-reading the document and re-invoking `mutate` with fresh data each time. This
 * is what makes the cooldown check race-safe: two concurrent calls can never both read the same
 * stale `updatedAt` and both pass, the way a plain (non-transactional) read-then-write would
 * allow (design doc section 5's own race-condition requirement).
 */
export interface FirestoreLike {
  runTransaction<T>(
    uid: string,
    mutate: (existing: ExistingProfile | null) => Promise<{ write: ProfileWrite; result: T }>,
  ): Promise<T>;
}

export interface SetDisplayNameDeps {
  firestore: FirestoreLike;
  /** The server's own clock (epoch ms) -- the cooldown check reads only this, never any
   *  client-supplied timestamp. */
  now: () => number;
  /** A server-timestamp sentinel (`admin.firestore.FieldValue.serverTimestamp()` in
   *  production) -- opaque to this module, just threaded through to the Firestore write. */
  serverTimestamp: () => unknown;
}

/**
 * `setDisplayName`'s full auth -> validate -> cooldown -> write pipeline, framework-agnostic
 * (no `firebase-functions`/`firebase-admin` types anywhere in its signature). Throws
 * `SetDisplayNameError` for every rejection case; a caller (./index.ts) maps that to the
 * Callable Function's own `HttpsError`.
 */
export async function handleSetDisplayName(
  payload: unknown,
  auth: SetDisplayNameAuthContext | null,
  deps: SetDisplayNameDeps,
): Promise<SetDisplayNameAccepted> {
  // Unauthenticated -> reject. Mirrors handleSubmitLunchRushScore's own first validation branch.
  if (!auth || typeof auth.uid !== "string" || auth.uid.length === 0) {
    throw new SetDisplayNameError("unauthenticated", "Sign-in required.");
  }

  // Malformed payload -> reject.
  if (typeof payload !== "object" || payload === null) {
    throw new SetDisplayNameError("invalid-argument", "Request payload must be an object.");
  }
  const request = payload as SetDisplayNameRequestPayload;

  let normalizedName: string;
  try {
    normalizedName = normalizeAndValidateDisplayName(request.displayName);
  } catch (error) {
    if (error instanceof DisplayNameValidationError) {
      throw new SetDisplayNameError("invalid-argument", error.message);
    }
    throw error;
  }

  // uid is always request.auth.uid (above) -- there is no uid field on the wire payload at all,
  // so there is nothing for a client to spoof (design doc section 8.2).
  return deps.firestore.runTransaction(auth.uid, async (existing) => {
    // Cooldown applies only to a rename (an existing document) -- first-time creation has no
    // prior `updatedAt` to compare against (design doc section 5: "初回作成時はcooldownなし").
    if (existing) {
      const elapsedMs = deps.now() - existing.updatedAtMillis;
      if (elapsedMs < RENAME_COOLDOWN_MS) {
        throw new SetDisplayNameError(
          "resource-exhausted",
          "Renaming is limited to once every 60 seconds.",
        );
      }
    }

    // createdAt is set once, at first creation, and never rewritten by a later rename;
    // updatedAt is server-authoritative on every accepted write (design doc section 5).
    const createdAt = existing ? existing.createdAt : deps.serverTimestamp();
    const updatedAt = deps.serverTimestamp();

    return {
      write: { displayName: normalizedName, createdAt, updatedAt },
      result: { displayName: normalizedName },
    };
  });
}
