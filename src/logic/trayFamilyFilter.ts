import { MAX_INGREDIENT_PALETTE_SLOTS } from "../data/ingredients";
import { familiesPresent, filterBySelection, type FamilyFilter } from "../data/ingredientShelf";

type AttributeFamilyId = Exclude<FamilyFilter, "all">;

/**
 * Cooking Tray family filter (Issue #396): the pure rules for the 具材 step's family chips, so the tray and the dock's
 * height reservation (prepareDock.ts) read ONE definition.
 *
 * Display only. The population handed in is already the tray's own list (eligible ownership -> HAND / pin), the filter
 * runs after that and before pagination, and nothing here reads or writes inventory, pins, discovery or save. Families
 * are the existing DH4-1 ids shown through `familyDisplay` (via `ingredientShelf`); no new taxonomy.
 */

/**
 * The family chips exist only when they save the player something: the list needs more than one page (otherwise
 * nothing pages) and holds at least two families (otherwise there is nothing to choose). A short guided / Lunch /
 * Dinner list therefore keeps today's tray, height and DOM.
 */
export function trayFamilyChoices(population: readonly { id: string }[]): AttributeFamilyId[] {
  if (population.length <= MAX_INGREDIENT_PALETTE_SLOTS) return [];
  const families = familiesPresent(population);
  return families.length >= 2 ? families : [];
}

/** A stored family read against the population now listed: one no row holds reads as 「すべて」. */
export function resolveTrayFamily(family: FamilyFilter, choices: readonly AttributeFamilyId[]): FamilyFilter {
  return family !== "all" && choices.includes(family) ? family : "all";
}

/** The tray list after the family filter (input order kept, always a new array). */
export function applyTrayFamily<T extends { id: string }>(population: readonly T[], family: FamilyFilter): T[] {
  return filterBySelection(population, { major: "topping", family });
}

/**
 * The ids the tray shows on its first page for `population` under `family`: the same population -> family filter ->
 * page 1 the tray renders (IngredientTray), as ids. App reads it when a Pantry pin changes the HAND, to keep a selection
 * that is still on the page the player is looking at; it never changes the hand.
 */
export function familyFirstPageIds(population: readonly string[], family: FamilyFilter): string[] {
  const items = population.map((id) => ({ id }));
  const shown = applyTrayFamily(items, resolveTrayFamily(family, trayFamilyChoices(items)));
  return shown.slice(0, MAX_INGREDIENT_PALETTE_SLOTS).map((i) => i.id);
}
