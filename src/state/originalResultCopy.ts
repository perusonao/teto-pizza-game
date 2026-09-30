/**
 * Original Pizza Recovery P2-A: the lead line of the ORIGINAL result card, keyed by *what kind* of
 * original it is. Pure.
 *
 * The three kinds are distinguished **internally** only:
 * - `ORDINARY`         -- NO_MATCH: nothing in the catalog has this identity.
 * - `AMBIGUOUS`        -- two or more catalog targets share this exact identity (a data collision,
 *                         e.g. the 172-authority groups). The pizza *is* a recipe identity.
 * - `INCOMPLETE_MATCH` -- exactly one recipe identity, but that recipe's own Completion Gate failed.
 *
 * ## Owner decision OD-P2-1 = A (decided)
 *
 * AMBIGUOUS keeps its internal kind, but its player-facing copy is the **same neutral sentence as the
 * ordinary original** (`NEUTRAL_LEAD`). The sentence claims no uniqueness ("あなただけの" is gone),
 * carries no recipe name / id / candidate count, and says nothing about an "unregistrable" identity or
 * any other internal reason. The kind is never rendered as a class, attribute, aria text or test id
 * (the privacy gate compares the AMBIGUOUS DOM with the ordinary DOM byte for byte).
 *
 * Recipe collisions are NOT resolved by P2. Production has no identity collision today, so AMBIGUOUS is
 * unreachable in production; `originalResultCopy.test.ts` keeps a canary that fails the moment a
 * colliding recipe is added, so the wording must be **re-decided before any collision recipe ships**.
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

/** OD-P2-1 = A: shared by ORDINARY and AMBIGUOUS. */
const NEUTRAL_LEAD = "図鑑にはまだ載っていないピザ！別の組み合わせも試してみよう。";

export const ORIGINAL_LEAD_COPY: Readonly<Record<OriginalResultKind, string>> = {
  ORDINARY: NEUTRAL_LEAD,
  AMBIGUOUS: NEUTRAL_LEAD,
  // H-U4 (Discovery Hint 2.0 229-C): the set matches, so the fix is the sauce amount or the bake.
  INCOMPLETE_MATCH: "図鑑のピザまであと少し…！ソースの量や焼き加減を見直してみよう。",
};
