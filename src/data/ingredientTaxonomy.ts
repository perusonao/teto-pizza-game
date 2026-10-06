/**
 * Discovery Hint 4.0 (Issue #253), DH4-1: the ingredient attribute taxonomy. Data only; UNWIRED (no
 * reducer, sheet, save or near-miss reads it yet).
 *
 * Authority: OD-DH4-4 (Issue #253, Fresh Design
 * docs/reports/TETO_DISCOVERY-HINT-4_DEDUCTION-HINTS_Fresh-Design.md §7). A 特徴ヒント (attribute hint)
 * may tell the player the *family* of an ingredient they have not identified, never its name.
 *
 * - Two levels, both player-facing: a **family** (about 7) and a coarser **group** (4) that the
 *   k >= 2 privacy guard falls back to (../logic/discovery/deductionHint.ts).
 * - Topping attributes only in DH4-1: sauce and cheese keep their category as their attribute.
 * - No singleton or near-singleton family in the mature (172-recipe) population: egg, nuts and
 *   sweets share `other`, and mushrooms join `vegetable`, so a family never *is* an ingredient name.
 *   At the 25-recipe runtime some families are still small (fruit, spice, other); the k >= 2 guard,
 *   not the table, is what keeps every answer from naming an ingredient.
 * - Data-driven and population-agnostic: a future ingredient (105 / 172 population) adds one row.
 *   An ingredient without a row simply has no family (the guard answers at category level); it is
 *   never guessed. Technique Discovery will get its own table, not a family here.
 * - Hint 5.0 (Issue #292, OD-H5-T-COV) reads the same rows, but does NOT coarsen: a hint-eligible
 *   topping without exactly one family is not a Hint 5.0 target (../logic/discovery/hint5Ladder.ts),
 *   and the gates in hint5Taxonomy.gate.test.ts keep that unreachable in production.
 *
 * Lookups go through a Map, so `__proto__` / `constructor` style ids have no effect.
 */

export type AttributeFamilyId = "meat" | "seafood" | "vegetable" | "herb" | "fruit" | "spice" | "other";
export type AttributeGroupId = "protein" | "produce" | "aroma" | "other";

export interface AttributeGroup {
  id: AttributeGroupId;
  labelJa: string;
}

export interface AttributeFamily {
  id: AttributeFamilyId;
  group: AttributeGroupId;
  labelJa: string;
}

/** Coarse groups, the first fallback of the k >= 2 guard. */
export const ATTRIBUTE_GROUPS: readonly AttributeGroup[] = [
  { id: "protein", labelJa: "肉・魚介" },
  { id: "produce", labelJa: "野菜・果物" },
  { id: "aroma", labelJa: "香り・薬味" },
  { id: "other", labelJa: "その他" },
];

/** The merged ~7 families (OD-DH4-4). */
export const ATTRIBUTE_FAMILIES: readonly AttributeFamily[] = [
  { id: "meat", group: "protein", labelJa: "肉" },
  { id: "seafood", group: "protein", labelJa: "魚介" },
  { id: "vegetable", group: "produce", labelJa: "野菜・きのこ" },
  { id: "fruit", group: "produce", labelJa: "果物" },
  { id: "herb", group: "aroma", labelJa: "ハーブ・香味" },
  { id: "spice", group: "aroma", labelJa: "スパイス・薬味" },
  { id: "other", group: "other", labelJa: "その他" },
];

/** Topping ingredient id -> family, for the runtime catalog (../data/ingredients.ts). */
const TOPPING_FAMILY_ROWS: readonly (readonly [string, AttributeFamilyId])[] = [
  ["sausage", "meat"],
  ["pepperoni", "meat"],
  ["bacon", "meat"],
  ["ham", "meat"],
  ["chicken", "meat"],
  ["anchovy", "seafood"],
  ["tuna", "seafood"],
  ["clam", "seafood"],
  ["shrimp", "seafood"],
  ["mushroom", "vegetable"],
  ["cherry-tomato", "vegetable"],
  ["onion", "vegetable"],
  ["black-olive", "vegetable"],
  ["corn", "vegetable"],
  ["eggplant", "vegetable"],
  ["fresh-tomato", "vegetable"],
  ["potato", "vegetable"],
  ["bell-pepper", "vegetable"],
  ["zucchini", "vegetable"],
  ["pineapple", "fruit"],
  ["basil", "herb"],
  ["oregano", "herb"],
  ["rosemary", "herb"],
  ["garlic", "herb"],
  ["parsley", "herb"],
  ["capers", "spice"],
  ["egg", "other"],
  ["almond", "other"],
];

const FAMILY_BY_INGREDIENT = new Map<string, AttributeFamilyId>(TOPPING_FAMILY_ROWS);
const FAMILY_BY_ID = new Map<AttributeFamilyId, AttributeFamily>(ATTRIBUTE_FAMILIES.map((f) => [f.id, f]));
const GROUP_BY_ID = new Map<AttributeGroupId, AttributeGroup>(ATTRIBUTE_GROUPS.map((g) => [g.id, g]));

/** Every ingredient id that has a family (in table order). */
export const TAXONOMY_INGREDIENT_IDS: readonly string[] = TOPPING_FAMILY_ROWS.map(([id]) => id);

/** The family of `ingredientId`, or `null` when it has none (not a topping, unknown, hostile). */
export function ingredientAttributeFamily(ingredientId: unknown): AttributeFamilyId | null {
  return typeof ingredientId === "string" ? (FAMILY_BY_INGREDIENT.get(ingredientId) ?? null) : null;
}

/** The coarse group of `ingredientId`, or `null` when it has no family. */
export function ingredientAttributeGroup(ingredientId: unknown): AttributeGroupId | null {
  const family = ingredientAttributeFamily(ingredientId);
  return family ? FAMILY_BY_ID.get(family)!.group : null;
}

export function attributeFamily(id: AttributeFamilyId): AttributeFamily {
  return FAMILY_BY_ID.get(id)!;
}

export function attributeGroup(id: AttributeGroupId): AttributeGroup {
  return GROUP_BY_ID.get(id)!;
}
