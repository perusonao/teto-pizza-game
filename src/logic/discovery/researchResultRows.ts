/**
 * Anti-Oracle Contract 2.1 (docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md) S1: the pure `researchResultRows` domain.
 * UNWIRED: no reducer, state, save, Notebook, UI or flag reads this module (S2 / S4 / S5 wire it).
 *
 * Given the pizza the player actually made, the ingredients already known (check-marked) for the Research Target
 * and the target id, it returns the membership rows that may be disclosed on the RESULT panel (Contract §3).
 *
 * - **Authority**: membership is `getRecipe(targetId).requiredIngredients`. Sauce, cheese
 *   and topping are one list; the category only decides which row group and cap an ingredient belongs to.
 * - **Category order**: sauce -> cheese -> topping. **Within a category: the player's own placement order**
 *   (first appearance, distinct). Never the canonical recipe order, an id sort or the catalog order.
 * - **Sauce / cheese**: every used, not-yet-known ingredient is judged (no cap, OD-RB-12). Production puts exactly one
 *   sauce on a pizza, but nothing here assumes that: the sauce list is simply read as given.
 * - **Topping**: distinct used toppings that are not known are "unknown". At most `RESEARCH_TOPPING_CAP` (K = 3) are
 *   judged; with 4 or more NO individual topping row is returned and `toppingOverCap` is set (the copy is S5).
 *   Known toppings are neither rows nor counted toward K.
 * - **Known ingredients** never appear as rows and never as persistence candidates.
 * - **Persistence candidates** are the positive rows' `ing:<id>` only (INV-D2: disclosure = persist). A negative and an
 *   over-capped topping persist nothing.
 * - **Independence (INV-D6)**: the input has no matcher / cooking-quality / outcome field, so membership cannot depend
 *   on them. Whether to call this for ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH is the caller's gate (S4).
 * - **Anti-Oracle**: the result carries no count, distance, similarity, remaining / missing figure and no recipe
 *   identity. `toppingOverCap` is a function of the player's own pizza and `known(T)` only (INV-D4).
 * - No sauce-less / reserved population is special-cased: row groups are never conditionally omitted by target (Contract §3).
 *   `aussie`, the one production recipe without a sauce (TQ-1D, Expansion Gate A CLOSED), is judged by exactly this rule: a sauce
 *   row exists only because the PLAYER used a sauce (an ordinary NEGATIVE when it is not a member), never as a statement about
 *   the target, and nothing here ever says "no sauce".
 */
import { getIngredient } from "../../data/ingredients";
import { getRecipe, type RecipeId } from "../../data/recipes";
import { sanitizeStringArray, sanitizeToppings } from "../scoringV2/boundary";
import { hintFactId, parseHintFactId } from "./selectableHint";

/** OD-RB-10: at most this many unknown toppings are judged per attempt (a player-facing game rule, not a per-recipe value). */
export const RESEARCH_TOPPING_CAP = 3;

export type ResearchResultCategory = "sauce" | "cheese" | "topping";
export type ResearchResultVerdict = "POSITIVE" | "NEGATIVE";

export interface ResearchResultRow {
  ingredientId: string;
  category: ResearchResultCategory;
  verdict: ResearchResultVerdict;
}

/** The pizza shape this module reads: only the ingredients actually placed, in placement order. */
export interface ResearchResultPizza {
  sauceIds?: unknown;
  toppings?: unknown;
}

export interface ResearchResultRowsInput {
  /** Internal only: the Research Target the attempt ran against. Never echoed in the result. */
  targetRecipeId: string;
  pizza: ResearchResultPizza;
  /** Ingredient ids already known (check-marked) for the target: stored `ing:` facts and the derived unlock fact. */
  knownIngredientIds: readonly string[];
}

export interface ResearchResultRows {
  /** Disclosable rows: sauce, then cheese, then topping; each group in the player's placement order. */
  rows: readonly ResearchResultRow[];
  /** True when 4+ unknown toppings were used: no individual topping row is disclosed. */
  toppingOverCap: boolean;
  /** `ing:<id>` for the POSITIVE rows only, in row order. Negatives and over-capped toppings are never here. */
  persistFactIds: readonly string[];
  /** Research 2.0 Phase 2 (INV-B1 / B2): the bare ingredient ids of the NEGATIVE rows only -- exactly the rows the RESULT
   *  discloses, so "disclosed = stored" holds by construction. A known ingredient, an untried one and an over-capped
   *  topping are never rows and therefore never here. Never an `ing:` fact (INV-B9). */
  persistExclusionIds: readonly string[];
}

/** The ingredient ids carried by a ledger's `ing:<id>` facts (any other fact kind is ignored). */
export function knownIngredientIdsFromFacts(factIds: readonly unknown[] | undefined): string[] {
  const ids = new Set<string>();
  for (const raw of factIds ?? []) {
    const id = parseHintFactId(raw);
    if (id !== null) ids.add(id);
  }
  return [...ids];
}

function distinct(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function researchResultRows(input: ResearchResultRowsInput): ResearchResultRows {
  const recipe = getRecipe(input.targetRecipeId as RecipeId);
  const members = new Set((recipe?.requiredIngredients ?? []).map((r) => r.ingredientId));
  const known = new Set(input.knownIngredientIds);

  const sauces: string[] = [];
  const cheeses: string[] = [];
  const toppings: string[] = [];
  const placed = [
    ...sanitizeStringArray(input.pizza.sauceIds),
    ...sanitizeToppings(input.pizza.toppings).map((t) => t.ingredientId),
  ];
  // `sauceIds` come first, then toppings in placement order; the ingredient's own category picks the group.
  for (const id of distinct(placed)) {
    if (known.has(id)) continue;
    const category = getIngredient(id)?.category;
    if (category === "sauce") sauces.push(id);
    else if (category === "cheese") cheeses.push(id);
    else if (category === "topping") toppings.push(id);
  }

  const toppingOverCap = toppings.length > RESEARCH_TOPPING_CAP;
  const judged: Array<[ResearchResultCategory, string[]]> = [
    ["sauce", sauces],
    ["cheese", cheeses],
    ["topping", toppingOverCap ? [] : toppings],
  ];
  const rows: ResearchResultRow[] = [];
  for (const [category, ids] of judged) {
    for (const ingredientId of ids) {
      rows.push({ ingredientId, category, verdict: members.has(ingredientId) ? "POSITIVE" : "NEGATIVE" });
    }
  }
  return {
    rows,
    toppingOverCap,
    persistFactIds: rows.filter((r) => r.verdict === "POSITIVE").map((r) => hintFactId(r.ingredientId)),
    persistExclusionIds: rows.filter((r) => r.verdict === "NEGATIVE").map((r) => r.ingredientId),
  };
}
