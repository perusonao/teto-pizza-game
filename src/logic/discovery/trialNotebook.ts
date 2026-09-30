/**
 * Original Pizza Recovery P3-1 (Trial Notebook pure model): the session-only record of what the
 * *player* tried -- "have I made this combination before, and what did I see when I did?".
 *
 * **Pure and UNWIRED.** Nothing in production imports this module (trialNotebook.gate.test.ts pins
 * that). No UI, RESULT, Dex, Builder, reducer, save or persistence is touched. The state is a plain
 * JSON-shaped value; every function returns a new state and never mutates its input.
 *
 * Authority: docs/reports/TETO_ORIGINAL-PIZZA-RECOVERY_P3_DISCOVERY-ASSISTANCE_Fresh-Audit.md
 * (Owner decisions OD-P3-1..12) and the Attempt Fingerprint (./attemptFingerprint.ts, P1), which is the
 * one identity authority. The only import is that module.
 *
 * ## What an entry may hold (OD-P3-4)
 *
 * - the attempt fingerprint (and so its version): identity, compared with `===`;
 * - a stable session attempt number `#n` and a retry count;
 * - the combination the player actually used (`sauceBase` / `ingredientSet`, parsed from the
 *   fingerprint: it *is* the player's own composition);
 * - the P2 feedback line exactly as it was shown (`kind` + `textJa`, nothing else), or `null`.
 *
 * It never holds, and has no field for: a recipe id or name, a target, a matcher distance, a
 * collision candidate, a Hint fact, a hidden ingredient answer, a technique, or an inferred recipe
 * association. The notebook records what the player tried; it never guesses an answer.
 *
 * ## Two structures, two limits (OD-P3-12)
 *
 * - **identity index** (up to 2 000 unique fingerprints): `{ fp, number, retryCount }`, ordered by
 *   recent activity. It is what duplicate detection reads.
 * - **display history** (up to 50 unique attempts): the detail rows (`combination`, `feedback`),
 *   newest activity first. Always a subset of the identity index.
 *
 * Both limits are injectable (`createTrialNotebook`) so tests can use tiny ones; the production
 * values are `TRIAL_NOTEBOOK_DISPLAY_LIMIT` / `TRIAL_NOTEBOOK_IDENTITY_LIMIT`.
 *
 * ## Rules
 *
 * - **Retry.** The same fingerprint never makes a second entry: `retryCount` goes up by one. `#n` never
 *   changes. A retry counts as the newest activity: its row (when shown) moves to the top and its
 *   identity becomes the last one to be evicted. Order is activity, `#n` is creation: they differ by
 *   design, and the view always carries `#n`. This reveals nothing beyond the player's own actions.
 *   The row's feedback is replaced by the feedback shown for the retry (the latest thing the player
 *   saw); the original line is not kept.
 * - **Numbers.** `#n` is a session-wide counter that only ever grows. It is never reused, so an evicted
 *   identity that is tried again is a NEW attempt with a NEW number, and a stale `#n` is never returned.
 * - **Display overflow.** The 51st unique attempt pushes the row with the oldest activity out of the
 *   display history. Its identity stays, so a retry is still detected as a duplicate of the original `#n`.
 *   What is shown for such a retry is an unresolved design question (`EvictedRetryPolicy`).
 * - **Identity overflow.** The 2 001st unique fingerprint evicts the identity with the oldest activity
 *   (and its row, if it still has one). Trying an evicted combination again is a first attempt.
 *   Eviction only makes the notebook forget; it never produces a false duplicate.
 * - **Fail closed.** A fingerprint that is not a canonical version-1 string (malformed, another
 *   version, not a string) and a feedback that is not exactly `null` or `{ kind, textJa }` are
 *   rejected: the state is returned unchanged and nothing is stored.
 *
 * ## Open question: retrying a combination whose detail row left the display (OD-P3-13)
 *
 * The model supports both answers behind one switch and does not pick for the player:
 * - `NOTICE_ONLY` (default until decided): the retry is reported as a duplicate of `#n` and counts,
 *   but no detail row is created. Nothing is reconstructed.
 * - `REVIVE`: the retry also puts a row back at the top, built only from the combination in the
 *   fingerprint and the feedback shown just now. The old feedback is gone and is not reconstructed.
 * Neither option reads anything hidden: a row is always built from the fingerprint and the feedback
 * the player was just shown.
 */
import { attemptFingerprintVersion, parseAttemptFingerprint } from "./attemptFingerprint";

/** Phase 1 authority (OD-P3-12): the detail rows shown. */
export const TRIAL_NOTEBOOK_DISPLAY_LIMIT = 50;
/** Phase 1 authority (OD-P3-12): the unique fingerprints remembered for duplicate detection. */
export const TRIAL_NOTEBOOK_IDENTITY_LIMIT = 2000;

export interface TrialNotebookLimits {
  /** Most detail rows kept (1..identity). */
  display: number;
  /** Most unique fingerprints remembered. */
  identity: number;
}

export const DEFAULT_TRIAL_NOTEBOOK_LIMITS: TrialNotebookLimits = Object.freeze({
  display: TRIAL_NOTEBOOK_DISPLAY_LIMIT,
  identity: TRIAL_NOTEBOOK_IDENTITY_LIMIT,
});

/** The P2 line exactly as the player was shown it. Nothing else of P2 is ever stored. */
export interface ShownFeedback {
  kind: string;
  textJa: string;
}

/** The combination the player used: the two lists the fingerprint is made of. */
export interface TrialCombination {
  /** Sorted, de-duplicated sauce ids. */
  sauceBase: readonly string[];
  /** Sorted, de-duplicated ids of every sauce and piece (includes `sauceBase`). */
  ingredientSet: readonly string[];
}

interface IdentityRecord {
  readonly fp: string;
  readonly number: number;
  readonly retryCount: number;
}

interface DisplayRow {
  readonly fp: string;
  readonly number: number;
  readonly combination: TrialCombination;
  readonly feedback: ShownFeedback | null;
}

export interface TrialNotebook {
  readonly schema: 1;
  readonly limits: TrialNotebookLimits;
  /** The number the next NEW attempt gets. Only ever grows. */
  readonly nextNumber: number;
  /** Least recently active first, most recently active last. */
  readonly identities: readonly IdentityRecord[];
  /** Most recently active first. A subset of `identities`. */
  readonly display: readonly DisplayRow[];
}

/** What a screen may read of one row. No fingerprint, no recipe, no distance. */
export interface TrialEntryView {
  number: number;
  retryCount: number;
  combination: TrialCombination;
  feedback: ShownFeedback | null;
}

export type EvictedRetryPolicy = "NOTICE_ONLY" | "REVIVE";

export interface RecordOptions {
  /** What a retry of an identity that has no detail row does (OD-P3-13, undecided). */
  evictedRetry?: EvictedRetryPolicy;
}

export type RejectReason = "MALFORMED" | "UNSUPPORTED_VERSION" | "INVALID_FEEDBACK";

export interface AttemptInput {
  /** A version-1 attempt fingerprint (`fp1:...`). Anything else is rejected. */
  fingerprint: unknown;
  /** The P2 line shown for this attempt, or `null` when no line was shown. */
  feedback: unknown;
}

export type RecordOutcome =
  | { kind: "NEW"; number: number }
  | {
      kind: "DUPLICATE";
      /** The number of the original attempt. */
      number: number;
      /** The retry count after this attempt. */
      retryCount: number;
      /** Whether the original had a detail row before this attempt. */
      hadDetail: boolean;
      /** Whether it has one now. */
      hasDetail: boolean;
    }
  | { kind: "REJECTED"; reason: RejectReason };

export interface RecordResult {
  state: TrialNotebook;
  outcome: RecordOutcome;
}

export type LookupResult =
  | { kind: "UNTRIED" }
  | { kind: "TRIED"; number: number; retryCount: number; hasDetail: boolean }
  | { kind: "REJECTED"; reason: Exclude<RejectReason, "INVALID_FEEDBACK"> };

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/** An empty notebook. Invalid limits are a programming error and throw. */
export function createTrialNotebook(limits: TrialNotebookLimits = DEFAULT_TRIAL_NOTEBOOK_LIMITS): TrialNotebook {
  if (!isPositiveInteger(limits.display) || !isPositiveInteger(limits.identity) || limits.display > limits.identity) {
    throw new RangeError("trial notebook limits must be positive integers with display <= identity");
  }
  return { schema: 1, limits: { display: limits.display, identity: limits.identity }, nextNumber: 1, identities: [], display: [] };
}

const KIND_PATTERN = /^[A-Z][A-Z0-9_]{0,31}$/;
const MAX_FEEDBACK_TEXT = 200;

/** Copies exactly `kind` and `textJa`; anything else (extra keys, wrong types) is rejected. */
function sanitizeFeedback(raw: unknown): { ok: true; value: ShownFeedback | null } | { ok: false } {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false };
  const keys = Object.keys(raw);
  if (keys.length !== 2 || !keys.includes("kind") || !keys.includes("textJa")) return { ok: false };
  const { kind, textJa } = raw as Record<string, unknown>;
  if (typeof kind !== "string" || !KIND_PATTERN.test(kind)) return { ok: false };
  if (typeof textJa !== "string" || textJa.length === 0 || textJa.length > MAX_FEEDBACK_TEXT) return { ok: false };
  return { ok: true, value: { kind, textJa } };
}

function parseFingerprint(raw: unknown): { ok: true; fp: string; combination: TrialCombination } | { ok: false; reason: "MALFORMED" | "UNSUPPORTED_VERSION" } {
  const parts = parseAttemptFingerprint(raw);
  if (parts) {
    return { ok: true, fp: raw as string, combination: { sauceBase: [...parts.sauceBase], ingredientSet: [...parts.ingredientSet] } };
  }
  const version = attemptFingerprintVersion(raw);
  return { ok: false, reason: version !== null && version !== 1 ? "UNSUPPORTED_VERSION" : "MALFORMED" };
}

function rejected(state: TrialNotebook, reason: RejectReason): RecordResult {
  return { state, outcome: { kind: "REJECTED", reason } };
}

/**
 * Records one attempt. NEW fingerprint -> a new entry with the next number; a known fingerprint ->
 * a retry of the original. A rejected input returns the very same state.
 */
export function recordAttempt(notebook: TrialNotebook, input: AttemptInput, options: RecordOptions = {}): RecordResult {
  const parsed = parseFingerprint(input?.fingerprint);
  if (!parsed.ok) return rejected(notebook, parsed.reason);
  const feedback = sanitizeFeedback(input.feedback);
  if (!feedback.ok) return rejected(notebook, "INVALID_FEEDBACK");

  const { fp, combination } = parsed;
  const row: DisplayRow = { fp, number: 0, combination, feedback: feedback.value };
  const at = notebook.identities.findIndex((r) => r.fp === fp);

  if (at < 0) {
    const number = notebook.nextNumber;
    let identities = [...notebook.identities, { fp, number, retryCount: 0 }];
    let display: readonly DisplayRow[] = notebook.display;
    while (identities.length > notebook.limits.identity) {
      const evicted = identities[0].fp;
      identities = identities.slice(1);
      display = display.filter((r) => r.fp !== evicted);
    }
    display = [{ ...row, number }, ...display].slice(0, notebook.limits.display);
    return { state: { ...notebook, nextNumber: number + 1, identities, display }, outcome: { kind: "NEW", number } };
  }

  const known = notebook.identities[at];
  const updated: IdentityRecord = { fp, number: known.number, retryCount: known.retryCount + 1 };
  const identities = [...notebook.identities.slice(0, at), ...notebook.identities.slice(at + 1), updated];
  const hadDetail = notebook.display.some((r) => r.fp === fp);
  const revive = options.evictedRetry === "REVIVE";
  let display: readonly DisplayRow[] = notebook.display;
  if (hadDetail || revive) {
    display = [{ ...row, number: known.number }, ...notebook.display.filter((r) => r.fp !== fp)].slice(0, notebook.limits.display);
  }
  return {
    state: { ...notebook, identities, display },
    outcome: { kind: "DUPLICATE", number: known.number, retryCount: updated.retryCount, hadDetail, hasDetail: display.some((r) => r.fp === fp) },
  };
}

/**
 * Whether a fingerprint was tried, without recording anything (for a future "tried before" notice
 * that must not count as an attempt). Silent for an untried combination: an absence is never a claim.
 */
export function lookupAttempt(notebook: TrialNotebook, fingerprint: unknown): LookupResult {
  const parsed = parseFingerprint(fingerprint);
  if (!parsed.ok) return { kind: "REJECTED", reason: parsed.reason };
  const known = notebook.identities.find((r) => r.fp === parsed.fp);
  if (!known) return { kind: "UNTRIED" };
  return { kind: "TRIED", number: known.number, retryCount: known.retryCount, hasDetail: notebook.display.some((r) => r.fp === parsed.fp) };
}

/** The display history, newest activity first, as a screen may read it. */
export function notebookView(notebook: TrialNotebook): TrialEntryView[] {
  const retries = new Map(notebook.identities.map((r) => [r.fp, r.retryCount]));
  return notebook.display.map((r) => ({
    number: r.number,
    retryCount: retries.get(r.fp) ?? 0,
    combination: { sauceBase: [...r.combination.sauceBase], ingredientSet: [...r.combination.ingredientSet] },
    feedback: r.feedback ? { kind: r.feedback.kind, textJa: r.feedback.textJa } : null,
  }));
}

/** Counts only (no content): how many rows are shown and how many identities are remembered. */
export function notebookSize(notebook: TrialNotebook): { display: number; identities: number; nextNumber: number } {
  return { display: notebook.display.length, identities: notebook.identities.length, nextNumber: notebook.nextNumber };
}

/** Every structural rule the model must keep; an empty list means the notebook is consistent. */
export function trialNotebookViolations(notebook: TrialNotebook): string[] {
  const out: string[] = [];
  const { display, identity } = notebook.limits;
  if (notebook.identities.length > identity) out.push("identities exceed the identity limit");
  if (notebook.display.length > display) out.push("display exceeds the display limit");
  const fps = notebook.identities.map((r) => r.fp);
  const numbers = notebook.identities.map((r) => r.number);
  if (new Set(fps).size !== fps.length) out.push("duplicate fingerprint in the identity index");
  if (new Set(numbers).size !== numbers.length) out.push("duplicate attempt number");
  if (numbers.some((n) => !(n >= 1 && n < notebook.nextNumber))) out.push("attempt number out of range");
  if (notebook.identities.some((r) => !(Number.isInteger(r.retryCount) && r.retryCount >= 0))) out.push("bad retry count");
  const byFp = new Map(notebook.identities.map((r) => [r.fp, r]));
  const shown = new Set<string>();
  for (const r of notebook.display) {
    const id = byFp.get(r.fp);
    if (!id) out.push("display row without an identity");
    else if (id.number !== r.number) out.push("display row number differs from its identity");
    if (shown.has(r.fp)) out.push("duplicate display row");
    shown.add(r.fp);
    if (!parseAttemptFingerprint(r.fp)) out.push("display row fingerprint is not canonical v1");
  }
  return out;
}
