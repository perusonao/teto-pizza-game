import type { AttributeFamilyId } from "./ingredientTaxonomy";

/**
 * Discovery Hint 5.0 (Issue #292), H5-1: how a sub-topping classification is SHOWN. Display only;
 * UNWIRED (only ../logic/discovery/hint5Ladder.ts reads it).
 *
 * Authority: docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md §7 (OD-H5-C4 final).
 * - The ids are the existing DH4-1 families (./ingredientTaxonomy.ts), unchanged: no new family.
 *   Mushroom stays in `vegetable`, so 「きのこ」 is wording only.
 * - H5-INV-2: a symbol here never equals any ingredient's emoji (🐟 anchovy, 🌿 basil / pesto,
 *   🍍 pineapple, 🍄 mushroom and 🦐 shrimp are excluded), and a label never contains an ingredient name.
 *   Gate G18 (hint5Taxonomy.gate.test.ts) enforces both.
 * - The DH4 `labelJa` of `ATTRIBUTE_FAMILIES` stays for the legacy 特徴 lines. `other` never reads
 *   「その他」 (OD-TAX-8).
 */
export interface HintClassDisplay {
  /** The class symbol. It is not an ingredient glyph (ingredient glyphs render only through
   *  IngredientGlyph), and it never equals one (G18). */
  symbol: string;
  labelJa: string;
}

export const HINT_CLASS_DISPLAY: Readonly<Record<AttributeFamilyId, HintClassDisplay>> = {
  meat: { symbol: "\u{1F969}", labelJa: "肉系" }, // 🥩
  seafood: { symbol: "\u{1F30A}", labelJa: "魚介系" }, // 🌊 (🦐 is the shrimp ingredient glyph)
  vegetable: { symbol: "\u{1F96C}", labelJa: "野菜・きのこ系" }, // 🥬
  herb: { symbol: "\u{1FAB4}", labelJa: "ハーブ・香味系" }, // 🪴
  spice: { symbol: "\u{1F9C2}", labelJa: "スパイス・薬味系" }, // 🧂
  fruit: { symbol: "\u{1F347}", labelJa: "果物系" }, // 🍇
  other: { symbol: "✨", labelJa: "ちょっと変わった材料" }, // ✨
};
