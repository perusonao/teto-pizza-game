/**
 * Original Pizza Recovery P3-3a (Owner decisions OD-P3-16..20): the one place a finished Free Cooking
 * ORIGINAL attempt is written to the session-only Trial Notebook. Pure; called from exactly one reducer
 * branch (REGISTER_TO_DEX, free-cook ORIGINAL), whose RESULT -> DISCOVERED phase guard is what makes the
 * record exactly-once. Nothing here renders, reads storage, or runs from an effect.
 *
 * - Identity is the P1 Attempt Fingerprint of the pizza (`attemptFingerprintOfPizza`), never re-derived here.
 * - The model is P3-1's `recordAttempt`; duplicate / `#n` / REVIVE / 50 + 2 000 semantics live there only.
 * - The stored feedback is `{ kind, textJa }` of the P2 line the player is shown (`resultNearMiss`), or `null`;
 *   never the internal near-miss (distance / target / candidate).
 * - Eligible: the ORIGINAL and AMBIGUOUS outcomes (OD-P3-16). INCOMPLETE_MATCH and every other outcome return
 *   the very same state references and record nothing.
 * - `lastTrialAttempt` is the display-only result of THIS commit (`NEW` / `DUPLICATE` with the stable `#n`, no
 *   `retryCount`, OD-P3-19). A later RESULT notice reads it; nothing may re-derive it by a lookup at render time.
 */
import { attemptFingerprintOfPizza } from "../logic/discovery/attemptFingerprint";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import { recordAttempt, type ShownFeedback, type TrialNotebook } from "../logic/discovery/trialNotebook";
import { resultNearMiss, type ResultNearMissInput } from "./resultNearMiss";

/** What the RESULT may later say about this attempt. Never `retryCount`, never an internal outcome. */
export type LastTrialAttempt = { kind: "NEW"; number: number } | { kind: "DUPLICATE"; number: number };

export interface TrialRecordInput extends ResultNearMissInput {
  trialNotebook: TrialNotebook;
}

export interface TrialRecordResult {
  trialNotebook: TrialNotebook;
  lastTrialAttempt: LastTrialAttempt | null;
}

/** OD-P3-16: only an ORIGINAL (or an AMBIGUOUS shown identically) is an attempt that tried a combination. */
export function isTrialRecordEligible(outcome: DiscoveryOutcome): boolean {
  return outcome.kind === "ORIGINAL" || outcome.kind === "AMBIGUOUS";
}

/** Exactly the two fields of the P2 line (OD-P3-18); `null` when P2 shows nothing. */
function shownFeedback(input: TrialRecordInput, outcome: DiscoveryOutcome): ShownFeedback | null {
  const line = resultNearMiss({ ...input, lastDiscovery: outcome });
  return line ? { kind: line.kind, textJa: line.textJa } : null;
}

export function recordTrialAttempt(input: TrialRecordInput, outcome: DiscoveryOutcome): TrialRecordResult {
  if (!isTrialRecordEligible(outcome)) return { trialNotebook: input.trialNotebook, lastTrialAttempt: null };
  const result = recordAttempt(input.trialNotebook, {
    fingerprint: attemptFingerprintOfPizza(input.pizza),
    feedback: shownFeedback(input, outcome),
  });
  switch (result.outcome.kind) {
    case "NEW":
      return { trialNotebook: result.state, lastTrialAttempt: { kind: "NEW", number: result.outcome.number } };
    case "DUPLICATE":
      return { trialNotebook: result.state, lastTrialAttempt: { kind: "DUPLICATE", number: result.outcome.number } };
    case "REJECTED":
      // Fail closed: a rejected input stores nothing (the model returns the same state) and says nothing.
      return { trialNotebook: input.trialNotebook, lastTrialAttempt: null };
  }
}
