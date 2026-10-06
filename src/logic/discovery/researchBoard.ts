import { getIngredient } from "../../data/ingredients";
import { FAMILY_DISPLAY, ingredientFamilyDisplay } from "../../data/familyDisplay";
import { getRecipe, RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { deriveResearchEntries, researchEntryLabel, type ResearchEntry, type ResearchInputs } from "./researchEntry";

/**
 * Research 2.0 Phase 2 (OD-R1-1 / R1-3 / R1-4): the Research Board READ MODEL. UNWIRED: no reducer, UI, save or
 * Notebook reads this module yet (the Notebook UI is Phase 3 / S4). Pure; reads no storage and dispatches nothing.
 *
 * The Board re-shows only what the player was actually told, per Research Entry:
 *   ✓ known positive   the unlock fact and the bought exact-name `ing:` facts,
 *   ✗ disclosed NEGATIVE   the persisted `researchExclusions` ledger (INV-B1),
 *   △ purchased class / total   bought `cls:` classes and the bought ingredient total.
 *
 * Inputs are disclosed information only: the Dex, `ownedIngredientIds`, the stored `discoveryHintFacts` and the stored
 * `researchExclusions`. It imports no Hint layer (discoveryHint / hint5Ladder / selectableHint / deductionHint), no
 * Technique module and no Trial Notebook module; the two stored-id grammars it needs are local copies pinned equal to
 * their owners by `researchBoard.test.ts` (the `researchEntry.ts` precedent).
 *
 * Forbidden and therefore not representable in the output type (INV-B3 / B4 / B7, OD-R1-4): trial count, last trial,
 * Technique, remaining candidates, a hidden candidate count, a recipe name / number / hash, a category-level conclusion
 * ("all excluded", "none") and an empty category note. A group exists only when it holds at least one row, so a
 * heading cannot be generated for nothing. `recipeId` is an opaque wiring key (as in `ResearchEntry`), never rendered.
 *
 * Stale exclusions (an id that the current recipe definition contradicts, i.e. it is a member, or that this build does
 * not know) are dropped here, silently, at display time; the stored ledger is never rewritten.
 */

/** A local copy of `parseHintFactId`'s grammar (./selectableHint.ts): `ing:<ingredient id>`. */
const ING_FACT_PATTERN = /^ing:([a-z0-9][a-z0-9-]{0,63})$/;
/** A local copy of `hint5ClassFactId`'s grammar (./hint5Ladder.ts): `cls:<ingredient id>`. */
const CLS_FACT_PATTERN = /^cls:([a-z0-9][a-z0-9-]{0,63})$/;
/** A local copy of `HINT5_RUNG_MARKER.STRUCTURE` (./hint5Ladder.ts): the class lines are shown only after it. */
const STRUCTURE_MARKER = "h5:structure";

export type ResearchBoardCategory = "sauce" | "cheese" | "topping";
export type ResearchBoardMark = "KNOWN" | "EXCLUDED";

export interface ResearchBoardRow {
  ingredientId: string;
  mark: ResearchBoardMark;
}

/** One category group. The tuple type makes an empty group (and so a heading with nothing under it) unrepresentable. */
export interface ResearchBoardGroup {
  category: ResearchBoardCategory;
  rows: readonly [ResearchBoardRow, ...ResearchBoardRow[]];
}

export interface ResearchBoardClass {
  /** The existing attribute family id (meat / seafood / ...); never an ingredient. */
  familyId: string;
  symbol: string;
  labelJa: string;
}

export interface ResearchBoard {
  /** Opaque key for wiring (target pick). NEVER rendered. */
  recipeId: string;
  /** The shared stable label (`researchEntryLabel`): unlock ingredient + cohort letter only (INV-B7). */
  labelJa: string;
  /** Category groups in sauce -> cheese -> topping order; only groups that hold a row. Known rows, then excluded rows. */
  groups: readonly ResearchBoardGroup[];
  /** Bought `cls:` classes, one per fact; empty until the STRUCTURE rung was bought. */
  classes: readonly ResearchBoardClass[];
  /** The distinct ingredient total, only after it was bought; else `null`. */
  totalIngredientCount: number | null;
}

export interface ResearchBoardInputs extends ResearchInputs {
  /** The stored negative ledger (`researchExclusions`): `recipeId -> bare ingredient ids`. Optional: absent = none. */
  researchExclusions?: Readonly<Record<string, readonly string[]>>;
}

const CATEGORY_ORDER: readonly ResearchBoardCategory[] = ["sauce", "cheese", "topping"];

function ownList(record: Readonly<Record<string, readonly string[]>> | undefined, key: string): readonly string[] {
  if (!record || !Object.prototype.hasOwnProperty.call(record, key)) return [];
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function boardOf(entry: ResearchEntry, recipe: Recipe | undefined, inputs: ResearchBoardInputs): ResearchBoard {
  const members = new Set(recipe?.requiredIngredients.map((r) => r.ingredientId) ?? []);
  const facts = ownList(inputs.discoveryHintFacts, entry.recipeId);

  // ✓: the unlock fact, then the player's own bought `ing:` names -- recipe-checked, catalog-checked, distinct.
  const known: string[] = [...entry.knownExactIngredientIds];
  for (const fact of facts) {
    const id = typeof fact === "string" ? ING_FACT_PATTERN.exec(fact)?.[1] : undefined;
    if (id && members.has(id) && getIngredient(id) && !known.includes(id)) known.push(id);
  }

  // ✗: the persisted ledger, minus the stale (a member now, or unknown to this build) and anything already ✓.
  const excluded: string[] = [];
  for (const id of ownList(inputs.researchExclusions, entry.recipeId)) {
    if (typeof id !== "string" || !getIngredient(id) || members.has(id) || known.includes(id) || excluded.includes(id)) continue;
    excluded.push(id);
  }

  const rowsByCategory = new Map<ResearchBoardCategory, ResearchBoardRow[]>();
  const push = (id: string, mark: ResearchBoardMark) => {
    const category = getIngredient(id)?.category;
    if (category !== "sauce" && category !== "cheese" && category !== "topping") return;
    const rows = rowsByCategory.get(category) ?? [];
    rows.push({ ingredientId: id, mark });
    rowsByCategory.set(category, rows);
  };
  for (const id of known) push(id, "KNOWN");
  for (const id of excluded) push(id, "EXCLUDED");
  const groups: ResearchBoardGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const rows = rowsByCategory.get(category);
    if (rows && rows.length > 0) groups.push({ category, rows: rows as [ResearchBoardRow, ...ResearchBoardRow[]] });
  }

  // △: bought `cls:` classes, only once STRUCTURE was bought (the Hint sheet's own rule), only for a topping of this
  // recipe that is not already shown as ✓. Existing family display only; never the ingredient.
  const classes: ResearchBoardClass[] = [];
  if (facts.includes(STRUCTURE_MARKER)) {
    for (const fact of facts) {
      const id = typeof fact === "string" ? CLS_FACT_PATTERN.exec(fact)?.[1] : undefined;
      if (!id || !members.has(id) || known.includes(id)) continue;
      const family = ingredientFamilyDisplay(id);
      if (family && getIngredient(id)?.category === "topping") {
        classes.push({ familyId: family.id, symbol: FAMILY_DISPLAY[family.id].symbol, labelJa: FAMILY_DISPLAY[family.id].labelJa });
      }
    }
  }

  return {
    recipeId: entry.recipeId,
    labelJa: researchEntryLabel(entry),
    groups,
    classes,
    totalIngredientCount: entry.totalIngredientCount,
  };
}

/** The Board of every registered Research Entry, in the stable anonymous entry order. */
export function deriveResearchBoards(inputs: ResearchBoardInputs, recipes: readonly Recipe[] = RECIPES): readonly ResearchBoard[] {
  return deriveResearchEntries(inputs, {}, recipes).entries.map((entry) =>
    boardOf(entry, recipes.find((r) => r.id === entry.recipeId) ?? getRecipe(entry.recipeId as RecipeId), inputs),
  );
}

/** The Board of one registered entry, or `null` for a recipe that is not a registered Research Entry (fail closed). */
export function researchBoardOf(
  inputs: ResearchBoardInputs,
  recipeId: string | null | undefined,
  recipes: readonly Recipe[] = RECIPES,
): ResearchBoard | null {
  if (!recipeId) return null;
  return deriveResearchBoards(inputs, recipes).find((b) => b.recipeId === recipeId) ?? null;
}
