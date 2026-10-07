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

export function researchRowsFeedback(input: ResearchRowsFeedbackInput): ResearchRowsFeedback | null {
  if (typeof input.labelJa !== "string" || input.labelJa.length === 0) return null;
  const groups = new Map<ResearchResultCategory, string[]>();
  for (const row of input.rows) {
    const name = getIngredient(row.ingredientId)?.nameJa;
    if (!name) continue; // fail closed: an unknown ingredient is never written
    const mark = row.verdict === "POSITIVE" ? "○" : "×";
    const items = groups.get(row.category) ?? [];
    items.push(`${name}${mark}`);
    groups.set(row.category, items);
  }
  if (groups.size === 0) return null;
  const parts = [...groups].map(([category, items]) => `${CATEGORY_LABEL_JA[category]}: ${items.join(" ")}`);
  return { kind: RESEARCH_ROWS_KIND, textJa: `${input.labelJa} ${parts.join(" ")}` };
}
