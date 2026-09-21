/**
 * Firebase Ranking 1.0 Phase 1B (Issue #87). The one real Cloud Functions entry point --
 * everything validation/recompute/write-shaped lives in ./submitLunchRushScore.ts as a pure-ish,
 * `admin`/`functions`-free function; this file's only job is wiring that to the real Admin SDK
 * (`createFirestoreAdapter`) and the real `onCall` trigger, and translating this module's own
 * `SubmitLunchRushScoreError` into the Callable Function's `HttpsError`.
 */
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  handleSubmitLunchRushScore,
  SubmitLunchRushScoreError,
  type FirestoreLike,
  type RunDocInput,
} from "./submitLunchRushScore";
import {
  handleSetDisplayName,
  SetDisplayNameError,
  type ExistingProfile,
  type FirestoreLike as ProfileFirestoreLike,
  type ProfileWrite,
} from "./setDisplayName";

initializeApp();

function createFirestoreAdapter(): FirestoreLike {
  const db = getFirestore();

  return {
    async createRun(input: RunDocInput, submittedAt: unknown): Promise<string> {
      const ref = db.collection("runs").doc();
      await ref.set({ ...input, submittedAt });
      return ref.id;
    },

    async upsertLeaderboardEntryIfHigher(
      periodId: string,
      uid: string,
      score: number,
      sourceRunId: string,
      achievedAt: unknown,
      displayName: string,
    ): Promise<boolean> {
      const ref = db.collection("leaderboards").doc(periodId).collection("entries").doc(uid);
      return db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const existingScore = snapshot.exists ? (snapshot.data()?.score as number | undefined) : undefined;
        // Strictly greater only -- a tie or a lower score is a no-op, so achievedAt (and
        // therefore the score DESC / achievedAt ASC tie-break) is never disturbed by a
        // resubmission of the same or a worse score. See submitLunchRushScore.ts's own comment
        // on this interface method. displayName rides the same conditional branch (Player
        // Profile 1.0 Phase 1B) -- a losing/no-op submission never touches an existing entry's
        // name either.
        if (existingScore !== undefined && existingScore >= score) return false;
        tx.set(ref, { score, achievedAt, sourceRunId, displayName });
        return true;
      });
    },

    // Player Profile 1.0 Phase 1B (Issue #129). A plain (non-transactional) read is sufficient
    // here -- unlike setDisplayName's own read-check-write cycle, this has no race to close: it
    // only ever informs what gets denormalized onto *this* submission's leaderboard entries, is
    // never itself the source of truth for `users/{uid}`, and a submission racing a concurrent
    // rename simply snapshots whichever name was current at the moment this read happened
    // (already-documented "name at time of achievement" behavior, design doc section 4.3).
    async getDisplayName(uid: string): Promise<string | null> {
      const snapshot = await db.collection("users").doc(uid).get();
      const data = snapshot.data();
      const displayName = data?.displayName;
      return typeof displayName === "string" ? displayName : null;
    },
  };
}

// Firestore is pinned to asia-northeast1 (Tokyo, Manual Setup) -- the callable Function is
// deployed to the same region rather than the 2nd-gen default (us-central1) so a submission
// never crosses regions between the Function and its Firestore writes. The client's own
// getFunctions() call (src/firebase/submitLunchRushScore.ts) must target this same region.
export const submitLunchRushScore = onCall({ region: "asia-northeast1" }, async (request) => {
  try {
    return await handleSubmitLunchRushScore(
      request.data,
      request.auth ? { uid: request.auth.uid } : null,
      {
        firestore: createFirestoreAdapter(),
        now: () => Date.now(),
        serverTimestamp: () => FieldValue.serverTimestamp(),
      },
    );
  } catch (error) {
    if (error instanceof SubmitLunchRushScoreError) {
      throw new HttpsError(error.code, error.message);
    }
    throw error;
  }
});

/**
 * Player Profile 1.0 Phase 1A (Issue #129). `users/{uid}` is writable only through this
 * Function -- `firestore.rules`' own `users/{uid}` match denies every direct client write
 * unconditionally, mirroring `runs`/`leaderboards` above. `db.runTransaction` is what makes
 * ./setDisplayName.ts's 60-second rename cooldown race-safe: on write-write contention the
 * Admin SDK re-runs the whole callback (re-reading the document fresh) rather than committing
 * against stale data, so two concurrent renames from the same uid can never both read the same
 * pre-write `updatedAt` and both pass the cooldown check.
 */
function createProfileFirestoreAdapter(): ProfileFirestoreLike {
  const db = getFirestore();

  return {
    async runTransaction<T>(
      uid: string,
      mutate: (existing: ExistingProfile | null) => Promise<{ write: ProfileWrite; result: T }>,
    ): Promise<T> {
      const ref = db.collection("users").doc(uid);
      return db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const data = snapshot.data();
        const existing: ExistingProfile | null =
          snapshot.exists && data
            ? {
                displayName: typeof data.displayName === "string" ? data.displayName : "",
                createdAt: data.createdAt,
                updatedAtMillis: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0,
              }
            : null;
        const { write, result } = await mutate(existing);
        tx.set(ref, write);
        return result;
      });
    },
  };
}

// Same region as submitLunchRushScore above, for the same reason -- see that Function's own
// comment. The client's own getFunctions() call (src/firebase/setDisplayName.ts) must target
// this same region.
export const setDisplayName = onCall({ region: "asia-northeast1" }, async (request) => {
  try {
    return await handleSetDisplayName(
      request.data,
      request.auth ? { uid: request.auth.uid } : null,
      {
        firestore: createProfileFirestoreAdapter(),
        now: () => Date.now(),
        serverTimestamp: () => FieldValue.serverTimestamp(),
      },
    );
  } catch (error) {
    if (error instanceof SetDisplayNameError) {
      throw new HttpsError(error.code, error.message);
    }
    throw error;
  }
});
