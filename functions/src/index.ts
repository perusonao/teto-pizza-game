/**
 * Firebase Ranking 1.0 Phase 1B (Issue #87). The one real Cloud Functions entry point --
 * everything validation/recompute/write-shaped lives in ./submitLunchRushScore.ts as a pure-ish,
 * `admin`/`functions`-free function; this file's only job is wiring that to the real Admin SDK
 * (`createFirestoreAdapter`) and the real `onCall` trigger, and translating this module's own
 * `SubmitLunchRushScoreError` into the Callable Function's `HttpsError`.
 */
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  handleSubmitLunchRushScore,
  SubmitLunchRushScoreError,
  type FirestoreLike,
  type RunDocInput,
} from "./submitLunchRushScore";

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
    ): Promise<boolean> {
      const ref = db.collection("leaderboards").doc(periodId).collection("entries").doc(uid);
      return db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const existingScore = snapshot.exists ? (snapshot.data()?.score as number | undefined) : undefined;
        // Strictly greater only -- a tie or a lower score is a no-op, so achievedAt (and
        // therefore the score DESC / achievedAt ASC tie-break) is never disturbed by a
        // resubmission of the same or a worse score. See submitLunchRushScore.ts's own comment
        // on this interface method.
        if (existingScore !== undefined && existingScore >= score) return false;
        tx.set(ref, { score, achievedAt, sourceRunId });
        return true;
      });
    },
  };
}

export const submitLunchRushScore = onCall(async (request) => {
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
