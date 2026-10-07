import {
  ingredientsByCategory,
  MAX_INGREDIENT_PALETTE_SLOTS,
  type Ingredient,
  type IngredientCategory,
} from "../data/ingredients";
import type { Recipe } from "../data/recipes";
import { trayFamilyChoices } from "./trayFamilyFilter";
import type { MakingStep } from "../state/gameReducer";

/**
 * DM-3R-0 Cooking Stage Size Stability (Issue #245).
 *
 * The pizza stage is the only flex-grow item of `.game-screen--cooking`, so whatever sits below
 * it in each PREPARE step used to take height from the dough: nothing in DOUGH, the sauce
 * readout plus the tray in SAUCE, a one- or two-row tray in CHEESE / TOPPING. On a short visible
 * height (Safari 390x664) that made the dough jump 290 -> 240 -> 287px between steps (Lunch Rush
 * TOPPING: 158px).
 *
 * The fix reserves one constant-height "PREPARE dock" under the stage for the whole round, sized
 * for the tallest step of *this* round. Everything it depends on is fixed when the round starts:
 * the recipe, free-cook or not, the owned ingredients and whether the sauce readout shows.
 */

/** Chips per tray row (`.ingredient-tray`'s `grid-template-columns: repeat(3, 1fr)`). */
export const TRAY_COLUMNS = 3;

/** The ingredients the tray offers in `category`: every owned one in a free-cook round,
 *  otherwise only the owned ones the recipe requires (Issue #159 P0 / Issue #194). The single
 *  source for both `IngredientTray` and the dock reservation, so the two cannot disagree. */
export function trayIngredientsFor(
  category: IngredientCategory,
  options: { ownedIngredientIds: readonly string[]; freeCook: boolean; recipe: Recipe },
): Ingredient[] {
  const { ownedIngredientIds, freeCook, recipe } = options;
  return ingredientsByCategory(category).filter(
    (i) =>
      ownedIngredientIds.includes(i.id) &&
      (freeCook || recipe.requiredIngredients.some((requirement) => requirement.ingredientId === i.id)),
  );
}

const STEP_CATEGORY: Partial<Record<MakingStep, IngredientCategory>> = {
  SAUCE: "sauce",
  CHEESE: "cheese",
  TOPPING: "topping",
};

/** The tray categories of a round's PREPARE steps (steps without a tray are skipped). */
export function prepareStepCategories(steps: readonly MakingStep[]): IngredientCategory[] {
  return steps.flatMap((step) => STEP_CATEGORY[step] ?? []);
}

export interface PrepareDockReserve {
  /** Chip rows of the SAUCE step's page (0 when the round has no SAUCE step). */
  sauceRows: number;
  /** The most chip rows any CHEESE / TOPPING step shows on one page. */
  otherRows: number;
  /** Some step of this round has more than one tray page: every step keeps the pager row (`--dock-pager`). */
  pager: boolean;
  /** The SAUCE step shows the ソースのでき readout above the tray. */
  readout: boolean;
  /** Issue #399: the 具材 step shows the family filter row ABOVE the tray (the tray lists more than one page and spans
   *  >= 2 families, read from the same owned list the tray starts from), so every step keeps that row's height and
   *  the pizza does not change size when it appears. Drives `--dock-family`. */
  familyRow: boolean;
}

/** What the family filter above the tray adds to the dock (App.css `--family-h`): the row 28px + a 10px gap to the tray
 *  (the chips' 44px hit area reaches 8px past the row, so the first card keeps a 2px gap), + 4px more gap above the
 *  pager row for the same reason. */
export const FAMILY_ROW_PX = 42;

/** DM-3R-0's short-height media query (App.css `@media (max-height: 700px)`: Safari with its toolbars, 390x664 / 360x640).
 *  The family row never takes its own row on a viewport this short: the stage has nothing to spare there, and the pizza
 *  minimum (LC-S3) is not up for trade. App.css guards that this is the same query. */
export const SHORT_HEIGHT_QUERY = "(max-height: 700px)";

/**
 * Issue #399: may the family filter take its own row above the tray without making the pizza any smaller than it is
 * with the filter in the utility row? Yes exactly while the stage keeps `FAMILY_ROW_PX` more than the pizza's cap needs
 * (the cap is read from CSS, the same `--pizza-cap-*` the dough uses), and never on a short viewport.
 * `contentHeight` is the stage's content height as measured NOW (= the dough's `100cqh`); when the row is already above,
 * its height is already out of that number, so it is added back and the rule reads the same in both placements (no
 * flip-flop: the pizza is at its cap in both, and a 2px margin applies only to the switch above).
 */
export function familyRowFits(options: { contentHeight: number; pizzaCap: number; placedAbove: boolean; shortViewport?: boolean }): boolean {
  const { contentHeight, pizzaCap, placedAbove, shortViewport = false } = options;
  if (shortViewport) return false;
  if (!Number.isFinite(contentHeight) || !Number.isFinite(pizzaCap)) return false; // no layout (or no probe): keep the one-row layout
  const spareInline = contentHeight + (placedAbove ? FAMILY_ROW_PX : 0) - pizzaCap;
  return spareInline >= FAMILY_ROW_PX + (placedAbove ? 0 : 2);
}

function rowsFor(count: number): number {
  return Math.ceil(Math.min(count, MAX_INGREDIENT_PALETTE_SLOTS) / TRAY_COLUMNS);
}

/** What the dock must hold so that no PREPARE step of this round is taller than it. */
export function prepareDockReserve(options: {
  steps: readonly MakingStep[];
  ownedIngredientIds: readonly string[];
  freeCook: boolean;
  recipe: Recipe;
  sauceReadout: boolean;
}): PrepareDockReserve {
  const { steps, sauceReadout, ...trayOptions } = options;
  const reserve: PrepareDockReserve = {
    sauceRows: 0,
    otherRows: 0,
    pager: false,
    readout: false,
    familyRow: false,
  };
  for (const step of steps) {
    const category = STEP_CATEGORY[step];
    if (!category) continue;
    const count = trayIngredientsFor(category, trayOptions).length;
    if (count > MAX_INGREDIENT_PALETTE_SLOTS) reserve.pager = true;
    if (category === "topping" && trayFamilyChoices(trayIngredientsFor(category, trayOptions)).length > 0) reserve.familyRow = true;
    if (step === "SAUCE") {
      reserve.sauceRows = Math.max(reserve.sauceRows, rowsFor(count));
      reserve.readout = reserve.readout || sauceReadout;
    } else {
      reserve.otherRows = Math.max(reserve.otherRows, rowsFor(count));
    }
  }
  return reserve;
}
