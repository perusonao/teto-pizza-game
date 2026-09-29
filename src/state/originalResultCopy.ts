/**
 * Original Pizza Recovery P2-A: the lead line of the ORIGINAL result card, keyed by *what kind* of
 * original it is. Pure.
 *
 * The three kinds are distinguished **internally** only:
 * - `ORDINARY`         -- NO_MATCH: nothing in the catalog has this identity.
 * - `AMBIGUOUS`        -- two or more catalog targets share this exact identity (a data collision,
 *                         e.g. the 172-authority groups). The pizza *is* a recipe identity, so the
 *                         ordinary "あなただけのピザ！" is not strictly true for it.
 * - `INCOMPLETE_MATCH` -- exactly one recipe identity, but that recipe's own Completion Gate failed.
 *
 * ## Owner decision OD-P2-1 (AMBIGUOUS wording) -- PENDING
 *
 * The player-facing AMBIGUOUS copy is not decided, so today it is **byte-identical** to the ordinary
 * copy: production behaviour is unchanged. That is safe *now* because production has no identity
 * collision (`originalResultCopy.gate.test.ts` pins it: AMBIGUOUS is unreachable in production and
 * the test fails the moment a colliding recipe is added, forcing the decision).
 *
 * Privacy: any wording that differs from the ordinary one tells the player "this exact ingredient
 * set is a hidden recipe identity" (the same class of fact INCOMPLETE_MATCH already discloses), and
 * must never carry a candidate count or id. The kind is never rendered as a class, attribute, aria
 * text or test id (the gate compares the AMBIGUOUS DOM with the ordinary DOM).
 */
import type { DiscoveryOutcome } from "../logic/discovery/matcher";

export type OriginalResultKind = "ORDINARY" | "AMBIGUOUS" | "INCOMPLETE_MATCH";

/** The kind of ORIGINAL a free-cook outcome is. Anything that is not AMBIGUOUS / INCOMPLETE_MATCH
 *  (including a missing outcome) is ordinary. */
export function originalResultKind(discovery: DiscoveryOutcome | null | undefined): OriginalResultKind {
  if (discovery?.kind === "AMBIGUOUS") return "AMBIGUOUS";
  if (discovery?.kind === "INCOMPLETE_MATCH") return "INCOMPLETE_MATCH";
  return "ORDINARY";
}

const ORDINARY_LEAD = "図鑑にはない、あなただけのピザ！";

export const ORIGINAL_LEAD_COPY: Readonly<Record<OriginalResultKind, string>> = {
  ORDINARY: ORDINARY_LEAD,
  // OD-P2-1 pending: same text as ORDINARY on purpose (see the header).
  AMBIGUOUS: ORDINARY_LEAD,
  // H-U4 (Discovery Hint 2.0 229-C): the set matches, so the fix is the sauce amount or the bake.
  INCOMPLETE_MATCH: "図鑑のピザまであと少し…！ソースの量や焼き加減を見直してみよう。",
};

/** Whether OD-P2-1 has been decided. `false` keeps AMBIGUOUS identical to ORDINARY. */
export const AMBIGUOUS_COPY_DECIDED = false;

export interface AmbiguousCopyCandidate {
  id: "A" | "B" | "C";
  textJa: string;
  /** What the player can infer from it (privacy class). */
  discloses: string;
}

/**
 * Owner options for OD-P2-1. **Not wired.** Every candidate is true for an AMBIGUOUS pizza.
 */
export const AMBIGUOUS_COPY_CANDIDATES: readonly AmbiguousCopyCandidate[] = [
  {
    id: "A",
    textJa: "図鑑にはまだ載っていないピザ！別の組み合わせも試してみよう。",
    discloses: "nothing: usable for ORDINARY and AMBIGUOUS alike (identical), but replaces today's ordinary copy",
  },
  {
    id: "B",
    textJa: "この組み合わせは、まだ図鑑には載せられないみたい。",
    discloses: "that this exact set is a recipe identity that cannot be registered (same class as INCOMPLETE_MATCH); no count, no id",
  },
  {
    id: "C",
    textJa: ORDINARY_LEAD,
    discloses: "nothing (today's copy); keeps the ordinary claim of uniqueness",
  },
];
