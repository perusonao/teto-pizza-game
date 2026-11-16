/**
 * Anti-Oracle Contract 2.1 S2 (docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md §7): the pure Trial Notebook feedback
 * for the RESULT rows. Wired: the reducer records its feedback in the Trial Notebook (ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH and bake-FAILED).
 *
 * One direction only: S1's `researchResultRows(...).rows` + the already-fixed target label -> a feedback
 * `{ kind: "RESEARCH_ROWS", textJa }`, or `null`. This module never reads a recipe or a membership list and never
 * recomputes a verdict; the rows are the authority, and only rows that were disclosed are recorded (INV-D2).
 *
 * - `labelJa` is the label fixed when the Research Entry was registered (`？？？ピザ B（<unlock ingredient>）` / `？？？ピザ（<unlock ingredient>）`, the stable Research 2.0 label). It is
 *   stored byte for byte and never recomputed here. No recipe id / name / hash is an input or an output.
 * - Format: `<labelJa> ソース: A○ チーズ: B○ トッピング: C× D○` (single half-width spaces). Groups follow the order of
 *   the rows (S1: sauce -> cheese -> topping); items inside a group keep the row order (placement order). No sorting.
 * - A group with no row is omitted. No rows -> `null` (the over-cap state alone is never recorded: it is not a
 *   judgment). No count, total, absence wording ("なし"), or known-ingredient text exists.
 * - No truncation: a text over the notebook's 200-char limit is returned as is, and `recordAttempt` rejects it
 *   (INVALID_FEEDBACK, nothing stored). Growth beyond the limit is a schema / design decision, not a silent cut.
 */
import { getIngredient } from "../../data/ingredients";
import type { ResearchResultCategory, ResearchResultRow } from "./researchResultRows";

/**
 * Structurally the notebook's existing `{ kind, textJa }` feedback shape. Declared here (not imported) so this unwired
 * module adds no importer to the notebook model, whose wiring gate is deliberately closed until S4.
 */
export interface ResearchRowsFeedback {
  kind: string;
  textJa: string;
}

export const RESEARCH_ROWS_KIND = "RESEARCH_ROWS";

const CATEGORY_LABEL_JA: Readonly<Record<ResearchResultCategory, string>> = {
  sauce: "ソース",
  cheese: "チーズ",
  topping: "トッピング",
};

export interface ResearchRowsFeedbackInput {
  /** The already-public label fixed at registration. Used verbatim. */
  labelJa: string;
  /** `researchResultRows(...).rows`, in S1's order. */
  rows: readonly ResearchResultRow[];
}

/**
 * The Trial Notebook stores a feedback line of at most this many characters (`MAX_FEEDBACK_TEXT`; a longer line is
 * REJECTED and the whole attempt would silently not be recorded). Pinned to that constant by `researchResultFeedback.test.ts`.
 */
export const RESEARCH_ROWS_MAX_TEXT = 200;

/**
 * Batch 25 C-1 (Owner-approved P): the line is unchanged while it fits. Only when it would exceed the Notebook limit
 * are the NEGATIVE rows of each category collapsed into `ほかN件×` (N = that category's negatives); every POSITIVE row
 * is always kept. Nothing but a count of rows the player was already shown is added, and the Research judgement,
 * the stored facts and the save format are untouched.
 */
export function researchRowsFeedback(input: ResearchRowsFeedbackInput): ResearchRowsFeedback | null {
  if (typeof input.labelJa !== "string" || input.labelJa.length === 0) return null;
  const positives = new Map<ResearchResultCategory, string[]>();
  const negatives = new Map<ResearchResultCategory, string[]>();
  const order: ResearchResultCategory[] = [];
  for (const row of input.rows) {
    const name = getIngredient(row.ingredientId)?.nameJa;
    if (!name) continue; // fail closed: an unknown ingredient is never written
    if (!positives.has(row.category) && !negatives.has(row.category)) order.push(row.category);
    const bucket = row.verdict === "POSITIVE" ? positives : negatives;
    const items = bucket.get(row.category) ?? [];
    items.push(row.verdict === "POSITIVE" ? `${name}○` : `${name}×`);
    bucket.set(row.category, items);
  }
  if (order.length === 0) return null;
  const build = (collapse: boolean): string => {
    const parts = order.map((category) => {
      // S1's order inside a category is preserved by building from the original row order below.
      const items: string[] = [];
      let collapsedNegatives = 0;
      for (const row of input.rows) {
        if (row.category !== category) continue;
        const name = getIngredient(row.ingredientId)?.nameJa;
        if (!name) continue;
        if (row.verdict === "POSITIVE") items.push(`${name}○`);
        else if (collapse) collapsedNegatives += 1;
        else items.push(`${name}×`);
      }
      if (collapse && collapsedNegatives > 0) items.push(`ほか${collapsedNegatives}件×`);
      return `${CATEGORY_LABEL_JA[category]}: ${items.join(" ")}`;
    });
    return `${input.labelJa} ${parts.join(" ")}`;
  };
  const full = build(false);
  return { kind: RESEARCH_ROWS_KIND, textJa: full.length <= RESEARCH_ROWS_MAX_TEXT ? full : build(true) };
}
