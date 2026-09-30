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
 * ## Owner decision OD-P2-5 (lead / action split, decided)
 *
 * The lead only states what the pizza is; it carries **no next action**. The next action belongs to
 * the near-miss / FAR line under it (ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE / 「🧪 別の組み合わせも
 * 試してみよう！」), so a far ORIGINAL no longer says 「別の組み合わせも試してみよう」 twice.
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

/**
 * Original Pizza Recovery P3-3b (OD-P3-19): the duplicate notice under the P2 line of an ORIGINAL RESULT. It names only
 * the stable attempt number the Trial Notebook recorded at the commit (the P3-3a record result) -- never the retry count,
 * never a recipe / target / distance / candidate, and never "same result" (quantity, bake and sauce amount are not
 * part of an attempt's identity). `null` for anything that is not a positive integer, so a bad number shows nothing.
 */
export function duplicateTrialNoticeJa(number: unknown): string | null {
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) return null;
  return `\u{1F4D3} 前にも同じ材料の組み合わせで作ったよ（試作#${number}）`;
}

/** OD-P2-1 = A: shared by ORDINARY and AMBIGUOUS. OD-P2-5: no next action in the lead. */
const NEUTRAL_LEAD = "図鑑にはまだ載っていないピザ！";

export const ORIGINAL_LEAD_COPY: Readonly<Record<OriginalResultKind, string>> = {
  ORDINARY: NEUTRAL_LEAD,
  AMBIGUOUS: NEUTRAL_LEAD,
  // H-U4 (Discovery Hint 2.0 229-C): the set matches, so the fix is the sauce amount or the bake.
  INCOMPLETE_MATCH: "図鑑のピザまであと少し…！ソースの量や焼き加減を見直してみよう。",
};
