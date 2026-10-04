import { ingredientAttributeFamily, type AttributeFamilyId } from "./ingredientTaxonomy";

/**
 * Ingredient Category Tabs 2-tier / FamilyTag: the SINGLE player-facing authority for how a topping family is
 * SHOWN (symbol + label). Display only; reads nothing from game state.
 *
 * Authority: Discovery Hint 5.0 OD-H5-C4 (docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md §7) and the
 * Ingredient Pantry / Category Tabs Owner Decisions OD-2 / OD-3 / OD-A.
 * - The ids are the existing DH4-1 families (./ingredientTaxonomy.ts), unchanged: no new family, no new taxonomy.
 *   Mushroom stays in `vegetable`, so 「きのこ」 is wording only.
 * - H5-INV-2 (gate G18): a symbol here never equals any ingredient's emoji, and a label never contains an ingredient
 *   name. `other` never reads 「その他」 (OD-TAX-8).
 * - Dependency direction: this is a LEAF. `./hintClassDisplay.ts` re-publishes these values for Hint 5.0 (no copy), and
 *   `./ingredientShelf.ts`, the shelf tabs and the cards read it directly. Nothing here imports Hint 5.0, a shelf or a
 *   component, and the catalog layer (src/logic/catalog) must not import it (catalogBoundary.test.ts).
 * - `ATTRIBUTE_FAMILIES.labelJa` (肉 / 魚介 / ...) stays for the legacy 特徴 lines only; it is not what a player sees on a
 *   shelf tab or a card.
 */
export interface FamilyDisplay {
  /** The class symbol. It is not an ingredient glyph (ingredient glyphs render only through IngredientGlyph). */
  symbol: string;
  labelJa: string;
}

export const FAMILY_DISPLAY: Readonly<Record<AttributeFamilyId, FamilyDisplay>> = {
  meat: { symbol: "\u{1F969}", labelJa: "肉系" }, // 🥩
  seafood: { symbol: "\u{1F30A}", labelJa: "魚介系" }, // 🌊 (🦐 is the shrimp ingredient glyph)
  vegetable: { symbol: "\u{1F96C}", labelJa: "野菜・きのこ系" }, // 🥬
  herb: { symbol: "\u{1FAB4}", labelJa: "ハーブ・香味系" }, // 🪴
  spice: { symbol: "\u{1F9C2}", labelJa: "スパイス・薬味系" }, // 🧂
  fruit: { symbol: "\u{1F347}", labelJa: "果物系" }, // 🍇
  other: { symbol: "✨", labelJa: "ちょっと変わった材料" }, // ✨
};

export interface IngredientFamilyDisplay extends FamilyDisplay {
  id: AttributeFamilyId;
}

/**
 * The family display of an ingredient id, or `null` when it has none: a sauce / cheese (they have no family), an
 * unclassified topping or an unknown id (fail-closed, never guessed).
 */
export function ingredientFamilyDisplay(ingredientId: unknown): IngredientFamilyDisplay | null {
  const id = ingredientAttributeFamily(ingredientId);
  return id ? { id, ...FAMILY_DISPLAY[id] } : null;
}
