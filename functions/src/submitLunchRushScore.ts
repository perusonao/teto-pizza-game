/**
 * Firebase Ranking 1.0 Phase 1B (Issue #87). `submitLunchRushScore`'s core logic -- validation,
 * server-side score recomputation, and the Firestore writes it authorizes -- deliberately kept
 * as a pure-ish function over an injected `FirestoreLike` port (not a direct `admin.firestore()`
 * call) so every scenario in this task's own test list (A-L) can run as a fast unit test against
 * an in-memory fake, with no Firestore/Functions emulator (and therefore no Java dependency)
 * required. `./index.ts` is the only place that wires this to the real Admin SDK and the real
 * `onCall` trigger.
 *
 * Trust boundary (Issue #87's own requirement, Phase 0 audit §3): nothing in the client-supplied
 * payload is ever treated as authoritative. `uid` comes only from the Callable Function's own
 * auth context (never the payload -- there is no `uid` field in
 * `SubmitLunchRushScoreRequestPayload` at all, so there is nothing to spoof). `score`/
 * `servedCount`/`totalQualityScore`/`bestQualityScore` are never accepted from the client either
 * -- they don't appear in the payload shape -- they are always derived here, server-side, from
 * `serves[]` via ../../src/shared/lunchRushScoring.ts's `calculateLunchRushMissionScore`, the
 * exact same formula the client itself used to build its own (never-trusted) local preview.
 */
import {
  calculateLunchRushMissionScore,
  isValidLunchRushServeRecord,
  LUNCH_RUSH_RULESET_DURATION_SECONDS,
  LUNCH_RUSH_RULESET_VERSION,
  MAX_SERVES_ARRAY_LENGTH,
  MAX_SERVES_PER_RUN,
  type LunchRushServeRecord,
} from "../../src/shared/lunchRushScoring";
import {
  DisplayNameValidationError,
  FALLBACK_DISPLAY_NAME,
  normalizeAndValidateDisplayName,
} from "../../src/shared/displayNameValidation";
import { computeLunchRushPeriodIds } from "./periodIds";

const LUNCH_RUSH_MISSION_ID = "lunch-rush";

/** `clientDurationMs` is advisory only (Phase 0 audit §3/§11 -- client timing is never a trust
 *  boundary), so this bound is deliberately loose: it only rejects a value that couldn't
 *  possibly describe a real `LUNCH_RUSH_RULESET_DURATION_SECONDS` run (e.g. a negative number,
 *  or something absurdly large), not a value close to the configured duration. The real,
 *  strict gate against an "impossible orders/minute" pace is `MAX_SERVES_PER_RUN` below, which
 *  is tied to the ruleset's actual fixed duration. */
const CLIENT_DURATION_MS_UPPER_BOUND = LUNCH_RUSH_RULESET_DURATION_SECONDS * 1000 * 2;

export type SubmitLunchRushScoreErrorCode = "unauthenticated" | "invalid-argument";

export class SubmitLunchRushScoreError extends Error {
  readonly code: SubmitLunchRushScoreErrorCode;

  constructor(code: SubmitLunchRushScoreErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "SubmitLunchRushScoreError";
  }
}

/** The only two auth facts this handler ever reads -- `uid` is always the Callable Function's
 *  own verified auth context (`request.auth.uid` in ./index.ts), never anything from the
 *  payload. */
export interface SubmitLunchRushScoreAuthContext {
  uid: string;
}

/** The wire shape of a submission request, before validation -- every field is `unknown` until
 *  proven otherwise below, since this is exactly the boundary between "attacker-controlled
 *  input" and "trusted data" (Phase 0 audit §3's own framing: nothing client-side is a trust
 *  boundary). */
export interface SubmitLunchRushScoreRequestPayload {
  rulesetVersion?: unknown;
  missionId?: unknown;
  clientDurationMs?: unknown;
  serves?: unknown;
}

export interface SubmitLunchRushScoreAccepted {
  score: number;
  servedCount: number;
  totalQualityScore: number;
  bestQualityScore: number;
  isNewWeeklyBest: boolean;
  isNewMonthlyBest: boolean;
  isNewAllTimeBest: boolean;
}

export interface RunDocInput {
  uid: string;
  rulesetVersion: string;
  missionId: string;
  clientDurationMs: number;
  servedCount: number;
  totalQualityScore: number;
  bestQualityScore: number;
  score: number;
  serves: readonly LunchRushServeRecord[];
}

/**
 * A narrow, purpose-built port over Firestore -- not a generic Transaction/DocumentReference
 * shim -- covering exactly the two write operations `submitLunchRushScore` performs. This is
 * what lets ./index.ts's real implementation (Admin SDK, a transaction per leaderboard upsert)
 * and this file's own test fake (an in-memory map, no emulator) both satisfy the same tiny
 * interface.
 */
export interface FirestoreLike {
  /** Creates a new `runs/{autoId}` ledger document and returns its generated id. */
  createRun(input: RunDocInput, submittedAt: unknown): Promise<string>;
  /**
   * Upserts `leaderboards/{periodId}/entries/{uid}` iff `score` strictly beats the entry's
   * existing score (or no entry exists yet) -- ties and lower scores are a no-op, returning
   * `false`, so a tied score's `achievedAt` is never overwritten (tie-break `score DESC,
   * achievedAt ASC`, Phase 0 audit §7, stays meaningful: the earliest achiever of a tied score
   * keeps ranking higher). Returns whether this call actually updated the entry.
   *
   * Player Profile 1.0 Phase 1B (Issue #129): `displayName` is written onto the entry in the
   * exact same conditional branch as `score`/`achievedAt`/`sourceRunId` -- a losing/no-op
   * submission never touches an existing entry's `displayName` either, matching how a rename
   * alone never retroactively rewrites a past entry (design doc section 4.3).
   */
  upsertLeaderboardEntryIfHigher(
    periodId: string,
    uid: string,
    score: number,
    sourceRunId: string,
    achievedAt: unknown,
    displayName: string,
  ): Promise<boolean>;
  /**
   * Reads the submitting user's own `users/{uid}.displayName` (Admin SDK, bypassing
   * `firestore.rules` entirely, exactly like every other read/write this module performs) --
   * `null` when no profile document exists, has no `displayName` field, or the field isn't a
   * string. `uid` is always `auth.uid` (never a payload-suppliable value), so this can never be
   * used to read -- or, combined with the write above, denormalize -- another player's name.
   */
  getDisplayName(uid: string): Promise<string | null>;
}

export interface SubmitLunchRushScoreDeps {
  firestore: FirestoreLike;
  /** The server's own clock (epoch ms) -- period id derivation reads only this, never any
   *  client-supplied timestamp (Issue #87's own "server timestamp is authoritative"
   *  requirement, Phase 0 audit §6). */
  now: () => number;
  /** A server-timestamp sentinel (`admin.firestore.FieldValue.serverTimestamp()` in
   *  production) -- opaque to this module, just threaded through to both Firestore writes. */
  serverTimestamp: () => unknown;
}

function invalid(message: string): never {
  throw new SubmitLunchRushScoreError("invalid-argument", message);
}

/**
 * Player Profile 1.0 Phase 1B (Issue #129): resolves the `displayName` snapshot to denormalize
 * onto this submission's leaderboard entries. `raw` is whatever `deps.firestore.getDisplayName`
 * returned -- a value that was already validated once, at `setDisplayName` write time (Player
 * Profile 1.0 Phase 1A), but is re-validated here rather than trusted unconditionally, since it
 * is read back from Firestore, not received fresh from that trusted write path (design doc
 * section 3's own contract is the single source of truth for what a "safe" name looks like, and
 * this reuses it verbatim rather than re-inventing a second, looser check). Any profile that is
 * missing, empty, or fails that same validation (a legacy/malformed document, however unlikely)
 * falls back to the fixed constant, exactly like every other display-name reader in this
 * codebase (Phase 0 design doc section 2.3).
 */
function resolveDisplayNameSnapshot(raw: string | null): string {
  if (raw === null) return FALLBACK_DISPLAY_NAME;
  try {
    return normalizeAndValidateDisplayName(raw);
  } catch (error) {
    if (error instanceof DisplayNameValidationError) return FALLBACK_DISPLAY_NAME;
    throw error;
  }
}

/**
 * `submitLunchRushScore`'s full validate -> recompute -> write pipeline, framework-agnostic
 * (no `firebase-functions`/`firebase-admin` types anywhere in its signature) so it is exactly
 * as testable as any other pure-ish function in this repo. Throws `SubmitLunchRushScoreError`
 * for every rejection case (A-D below); a caller (./index.ts) maps that to the Callable
 * Function's own `HttpsError`.
 */
export async function handleSubmitLunchRushScore(
  payload: unknown,
  auth: SubmitLunchRushScoreAuthContext | null,
  deps: SubmitLunchRushScoreDeps,
): Promise<SubmitLunchRushScoreAccepted> {
  // A. unauthenticated -> reject.
  if (!auth || typeof auth.uid !== "string" || auth.uid.length === 0) {
    throw new SubmitLunchRushScoreError("unauthenticated", "Sign-in required.");
  }

  // B. malformed payload -> reject.
  if (typeof payload !== "object" || payload === null) {
    invalid("Request payload must be an object.");
  }
  const request = payload as SubmitLunchRushScoreRequestPayload;

  if (request.rulesetVersion !== LUNCH_RUSH_RULESET_VERSION) {
    invalid("Unknown or unsupported rulesetVersion.");
  }
  if (request.missionId !== LUNCH_RUSH_MISSION_ID) {
    invalid("Unknown missionId.");
  }
  if (!Array.isArray(request.serves)) {
    invalid("serves must be an array.");
  }
  // Defense-in-depth payload-size guard, independent of the theoretical-serves-per-run bound
  // below (checked before any per-entry validation runs the cost of iterating it).
  if (request.serves.length > MAX_SERVES_ARRAY_LENGTH) {
    invalid("serves array exceeds the maximum allowed length.");
  }

  // C. negative values -> reject (clientDurationMs is advisory-only, see the constant's own
  // comment, but still bounded to a plausible range).
  if (
    typeof request.clientDurationMs !== "number" ||
    !Number.isFinite(request.clientDurationMs) ||
    request.clientDurationMs < 0 ||
    request.clientDurationMs > CLIENT_DURATION_MS_UPPER_BOUND
  ) {
    invalid("clientDurationMs is missing, negative, or out of range.");
  }

  // D. impossible quality (and any other malformed serve shape) -> reject. Each entry's own
  // qualityTotal in [0, 100] and non-negativity are enforced by isValidLunchRushServeRecord
  // itself (../../src/shared/lunchRushScoring.ts).
  for (const serve of request.serves) {
    if (!isValidLunchRushServeRecord(serve)) {
      invalid("A serve entry is malformed or has an impossible value.");
    }
  }
  const serves = request.serves as LunchRushServeRecord[];

  // G. server recomputes score from serves[] -- the client's own score/servedCount/
  // totalQualityScore/bestQualityScore are never read (they are not even part of
  // SubmitLunchRushScoreRequestPayload's shape), so there is nothing to "tamper" (F): any such
  // field on the wire payload is simply ignored.
  const result = calculateLunchRushMissionScore(serves);

  // Impossible orders/minute: servedCount bounded by what LUNCH_RUSH_RULESET_DURATION_SECONDS
  // could realistically produce (../../src/shared/lunchRushScoring.ts's MAX_SERVES_PER_RUN).
  if (result.servedCount > MAX_SERVES_PER_RUN) {
    invalid("servedCount exceeds what this ruleset's duration allows.");
  }

  const submittedAt = deps.serverTimestamp();
  const runId = await deps.firestore.createRun(
    {
      uid: auth.uid,
      rulesetVersion: LUNCH_RUSH_RULESET_VERSION,
      missionId: LUNCH_RUSH_MISSION_ID,
      clientDurationMs: request.clientDurationMs,
      servedCount: result.servedCount,
      totalQualityScore: result.totalQualityScore,
      bestQualityScore: result.bestQualityScore,
      score: result.score,
      serves,
    },
    submittedAt,
  );

  // Period ids are derived purely from the server's own clock (deps.now()), never any client
  // timestamp -- L. server timestamp authority.
  const periodIds = computeLunchRushPeriodIds(deps.now());
  const achievedAt = deps.serverTimestamp();

  // Player Profile 1.0 Phase 1B (Issue #129): the submitting user's own displayName snapshot,
  // read once per submission (never per-period) and passed to every upsert call below -- never
  // read from the client-supplied payload, which has no displayName field to spoof in the first
  // place (SubmitLunchRushScoreRequestPayload's shape, unchanged by this phase).
  const displayName = resolveDisplayNameSnapshot(await deps.firestore.getDisplayName(auth.uid));

  const [isNewWeeklyBest, isNewMonthlyBest, isNewAllTimeBest] = await Promise.all([
    deps.firestore.upsertLeaderboardEntryIfHigher(periodIds.weekly, auth.uid, result.score, runId, achievedAt, displayName),
    deps.firestore.upsertLeaderboardEntryIfHigher(periodIds.monthly, auth.uid, result.score, runId, achievedAt, displayName),
    deps.firestore.upsertLeaderboardEntryIfHigher(periodIds.allTime, auth.uid, result.score, runId, achievedAt, displayName),
  ]);

  return { ...result, isNewWeeklyBest, isNewMonthlyBest, isNewAllTimeBest };
}
