/**
 * Large Catalog UX LC-R5-b: the Japanese SEARCH-ONLY alias authority (Alias Audit OD-A1 .. OD-A6).
 *
 * An alias is a written form of an ingredient's own name that a player may TYPE (an IME conversion result such
 * as 「玉ねぎ」 for 「たまねぎ」). It is never displayed (the screen keeps `nameJa`), never a reading (`readingJa` and
 * its ordering are untouched), never saved, and carries no recipe / discovery / hint information. This table
 * lives beside, not inside, the ingredient domain data (`Ingredient` has no search field).
 *
 * ONLY the Owner-approved aliases are listed. Nothing here is generated or guessed: a form that is not in this
 * table (「ペペロニ」, 「馬鈴薯」, the `…チーズ` forms of gorgonzola / parmigiano / fontina, ...) is deliberately
 * absent until the Owner approves it. Matching stays the existing normalized substring rule; no reverse
 * (query-contains-name) or fuzzy matching is introduced (OD-A3).
 */
export interface IngredientSearchAlias {
  alias: string;
  provenance: "owner-approved";
}

export const INGREDIENT_SEARCH_ALIASES: Readonly<Record<string, readonly IngredientSearchAlias[]>> = {
  onion: [{ alias: "玉ねぎ", provenance: "owner-approved" }],
  egg: [{ alias: "卵", provenance: "owner-approved" }],
  mozzarella: [{ alias: "モッツァレラチーズ", provenance: "owner-approved" }],
};

/** The alias strings of one ingredient id (empty when it has none). */
export function searchAliasesFor(ingredientId: string): readonly string[] {
  return (INGREDIENT_SEARCH_ALIASES[ingredientId] ?? []).map((entry) => entry.alias);
}
