/**
 * Train Kit: the bridge to the REAL catalog (Issue #780; TEST / TOOL SUPPORT ONLY). Reads the shipped catalog and its authorities;
 * writes nothing. Three uses:
 *
 * - `extractTrain`  shipped recipes -> an implementation spec (the reverse of codegen.ts; the round trip is the equivalence proof)
 * - `deriveForApply` what a spec cannot author itself: entitlement floors (derived ladder numbers) and Reference slots (RT-01)
 * - `catalogDump`   one JSON-comparable snapshot of everything a catalog-only train can change (used by the replay)
 */
import { RECIPE_DISCOVERY_TARGET_IDS } from "../../../src/data/discoveryCatalog";
import { DISCOVERY_LADDER } from "../../../src/data/discoveryLadder";
import { ATTRIBUTE_FAMILIES, ingredientAttributeFamily } from "../../../src/data/ingredientTaxonomy";
import { INGREDIENTS } from "../../../src/data/ingredients";
import { ALL_LATE_RECIPE_IDS, LATE_DISCOVERY_TARGET_IDS, LATE_ENTITLEMENT_FLOORS, LATE_INGREDIENTS, LATE_LADDER_STEPS } from "../../../src/data/lateCatalog";
import { ORDERS } from "../../../src/data/orders";
import { RECIPE_HINT_ROLES } from "../../../src/data/recipeHintRoles";
import { RECIPE_SAUCE_PROFILES } from "../../../src/data/recipeSauceProfiles";
import { RECIPES, participatesInLunchRush } from "../../../src/data/recipes";
import { getReferencePizza } from "../../../src/data/referencePizza";
import { TOPPING_SIZE_CLASS_BY_ID } from "../../../src/data/toppingSizeClass";
import { assignReferenceSlots } from "../../../src/logic/pizzaReferenceLayout";
import { buildRecipeChapters } from "../../../src/state/recipeChapters";
import { DEFAULT_PIECE_STYLE, type Derived, type PieceStyle, type ReferenceGroup } from "./codegen";
import type { KitIngredient, KitRecipe, KitSizeClass, KitTrain, ShippedFacts } from "./implSpec";

type AnyRecord = Readonly<Record<string, unknown>>;
const recipeRows = RECIPES as readonly (AnyRecord & { id: string; requiredIngredients: readonly { ingredientId: string; minCount: number; applicationPhase?: "PRE_BAKE" | "POST_BAKE" }[] })[];
const lateIngredientIds = new Set(LATE_INGREDIENTS.map((i) => i.id));
const lateRecipeIds = new Set(ALL_LATE_RECIPE_IDS);
const evidenceIdOf = (id: string): string | null => (RECIPE_DISCOVERY_TARGET_IDS as Record<string, string>)[id] ?? LATE_DISCOVERY_TARGET_IDS[id] ?? null;

export function shippedFacts(): ShippedFacts {
  return {
    recipeIds: recipeRows.map((r) => r.id),
    ingredients: INGREDIENTS.map((i) => ({ id: i.id, category: i.category, emoji: i.emoji })),
    familySymbols: ATTRIBUTE_FAMILIES.map((f) => (f as unknown as { symbol?: string }).symbol).filter((s): s is string => typeof s === "string"),
  };
}

/** Recipe fields the generator writes. A shipped recipe with any other field (pan shape, dough kind, unlock condition...) is outside a catalog-only train. */
const SUPPORTED_RECIPE_FIELDS: readonly string[] = ["id", "nameJa", "description", "requiredIngredients", "bakeTarget", "baseRewardPitz", "ladderCredit", "lunchRush"];
const SUPPORTED_INGREDIENT_FIELDS: readonly string[] = ["id", "category", "nameJa", "color", "emoji", "placement", "unlockCondition", "pieceVisual"];

export interface Extracted {
  readonly recipe: KitRecipe;
  /** Why the shipped recipe is NOT fully expressible by a catalog-only spec (empty = it round-trips exactly). */
  readonly unsupported: readonly string[];
}

export function extractRecipe(id: string): Extracted {
  const r = recipeRows.find((x) => x.id === id);
  if (!r) throw new Error(`not a shipped recipe: ${id}`);
  const unsupported: string[] = Object.keys(r).filter((k) => !SUPPORTED_RECIPE_FIELDS.includes(k)).map((k) => `recipe field ${k}`);
  const order = ORDERS.find((o) => o.recipeId === id);
  if (!order) unsupported.push("no order row");
  else if (order.id !== `order-${id}`) unsupported.push(`order id ${order.id}`);
  const profile = (RECIPE_SAUCE_PROFILES as Record<string, AnyRecord | null | undefined>)[id];
  let sauceProfile: KitRecipe["sauceProfile"] = null;
  if (profile === undefined) unsupported.push("no sauce profile row");
  else if (profile !== null) {
    const extra = Object.keys(profile).filter((k) => !["recipeId", "ingredientId", "interaction"].includes(k));
    if (extra.length > 0) unsupported.push(`sauce profile field ${extra.join(", ")}`);
    sauceProfile = { ingredientId: String(profile.ingredientId), interaction: profile.interaction as "PAINT" | "PAINT_TEMPORARY" };
  }
  const roles = (RECIPE_HINT_ROLES as unknown as Record<string, AnyRecord | undefined>)[id];
  if (!roles || roles.keyFree !== true || Object.keys(roles).length !== 1) unsupported.push("hint roles are not { keyFree: true }");
  const step = DISCOVERY_LADDER.steps.find((s) => s.keyRecipeId === id);
  if (step && (step as unknown as AnyRecord).starGates !== undefined) unsupported.push("ladder step has a star gate");
  const evidenceId = evidenceIdOf(id);
  if (!evidenceId) unsupported.push("no discovery target id");
  const bake = r.bakeTarget as { start: number; end: number };
  return {
    unsupported,
    recipe: {
      id,
      nameJa: String(r.nameJa),
      description: String(r.description),
      placement: lateRecipeIds.has(id) ? "late" : "ordinary",
      requiredIngredients: r.requiredIngredients.map((q) => ({ ingredientId: q.ingredientId, minCount: q.minCount, ...(q.applicationPhase ? { applicationPhase: q.applicationPhase } : {}) })),
      bakeTarget: { start: bake.start, end: bake.end },
      baseRewardPitz: Number(r.baseRewardPitz),
      lunchRush: r.lunchRush !== false,
      ladderCredit: r.ladderCredit !== false,
      evidenceId: evidenceId ?? "",
      order: { requestedBy: String(order?.requestedBy ?? ""), lineJa: String(order?.lineJa ?? "") },
      sauceProfile,
      ladderStep: step ? { ingredientIds: [...step.ingredientIds] } : null,
    },
  };
}

export function extractIngredient(id: string): { ingredient: KitIngredient; unsupported: string[] } {
  const i = INGREDIENTS.find((x) => x.id === id);
  if (!i) throw new Error(`not a shipped ingredient: ${id}`);
  const unsupported = Object.keys(i).filter((k) => !SUPPORTED_INGREDIENT_FIELDS.includes(k)).map((k) => `ingredient field ${k}`);
  const size = (TOPPING_SIZE_CLASS_BY_ID as Record<string, KitSizeClass | undefined>)[id];
  return {
    unsupported,
    ingredient: {
      id, nameJa: i.nameJa, category: i.category as KitIngredient["category"], family: i.category === "topping" ? ingredientAttributeFamily(id) : null, color: i.color, emoji: i.emoji,
      ...(size ? { sizeClass: size } : {}),
      ...(shippedPieceStyles().get(id)?.interaction.landingStyle === "LIGHT_LEAF" ? { landingStyle: "LIGHT_LEAF" as const } : {}),
      // The host component is not catalog data; the two hosts follow their naming convention (a spec for a NEW train states it explicitly).
      ...(i.pieceVisual ? { pieceVisual: i.pieceVisual, glyphHost: i.pieceVisual.endsWith("-dessert") ? ("DessertGlyph" as const) : ("StagedGlyph" as const) } : {}),
    },
  };
}

/** The implementation spec that would have produced the given shipped recipes (in the given order) and the materials their ladder steps unlock. */
export function extractTrain(recipeIds: readonly string[], meta: { train: string; tag: string; label: string; issue: number }): { kit: KitTrain; unsupported: string[] } {
  const unsupported: string[] = [];
  const recipes = recipeIds.map((id) => {
    const x = extractRecipe(id);
    unsupported.push(...x.unsupported.map((u) => `${id}: ${u}`));
    return x.recipe;
  });
  // `newIngredients` order is the order the materials are written to the catalog arrays (an authored order: it need not be the ladder order).
  const catalogIndex = new Map(INGREDIENTS.map((i, n) => [i.id, n]));
  const newIngredients = recipes.flatMap((r) => r.ladderStep?.ingredientIds ?? []).sort((a, b) => (catalogIndex.get(a) ?? 0) - (catalogIndex.get(b) ?? 0)).map((id) => {
    const x = extractIngredient(id);
    unsupported.push(...x.unsupported.map((u) => `${id}: ${u}`));
    return x.ingredient;
  });
  const floors = Object.fromEntries(newIngredients.filter((i) => LATE_ENTITLEMENT_FLOORS[i.id] !== undefined).map((i) => [i.id, LATE_ENTITLEMENT_FLOORS[i.id]]));
  return { kit: { ...meta, recipes, newIngredients, ...(Object.keys(floors).length > 0 ? { floors } : {}) }, unsupported };
}

/** The one interaction / matching style every shipped Reference gives an ingredient (measured: no ingredient has two). */
export function shippedPieceStyles(): Map<string, PieceStyle> {
  const styles = new Map<string, PieceStyle>();
  for (const r of recipeRows) for (const g of getReferencePizza(r.id)?.pieceGroups ?? []) if (!styles.has(g.ingredientId)) styles.set(g.ingredientId, JSON.parse(JSON.stringify({ interaction: g.interaction, matching: g.matching })) as PieceStyle);
  return styles;
}

/** Reference piece groups of a recipe by the real RT-01 layout: the non-sauce requirements in `requiredIngredients` order; a shipped ingredient keeps its shipped style. */
export function referenceGroups(recipe: KitRecipe, categoryOf: (id: string) => string | null, styleOf: (id: string) => PieceStyle | undefined = () => undefined): ReferenceGroup[] {
  const groups = recipe.requiredIngredients.filter((q) => categoryOf(q.ingredientId) !== "sauce").map((q) => ({ ingredientId: q.ingredientId, count: q.minCount }));
  return assignReferenceSlots(groups).map((g) => ({ ingredientId: g.ingredientId, positions: g.positions.map((p) => ({ x: p.x, y: p.y })), ...(styleOf(g.ingredientId) ? { style: styleOf(g.ingredientId) } : {}) }));
}

/**
 * Floors and References for `applyCatalogEdits`, computed against the catalog as it is NOW (before the train).
 * Ladder numbers are derived, never authored: the ordinary steps come first, so a train's late step k gets
 * (ordinary steps + the train's new ordinary steps + the late steps already shipped + k).
 */
export function deriveForApply(kit: KitTrain): Derived {
  const category = new Map<string, string>([...INGREDIENTS.map((i) => [i.id, i.category] as const), ...kit.newIngredients.map((i) => [i.id, i.category] as const)]);
  const shippedLateSteps = DISCOVERY_LADDER.steps.filter((s) => LATE_LADDER_STEPS.some((l) => l.keyRecipeId === s.keyRecipeId)).length;
  const ordinarySteps = DISCOVERY_LADDER.steps.length - shippedLateSteps;
  const newOrdinary = kit.recipes.filter((r) => r.placement === "ordinary" && r.ladderStep).length;
  const floors: Record<string, number> = {};
  kit.recipes.filter((r) => r.placement === "late").forEach((r, k) => {
    for (const id of r.ladderStep?.ingredientIds ?? []) floors[id] = ordinarySteps + newOrdinary + LATE_LADDER_STEPS.length + k + 1;
  });
  const shipped = shippedPieceStyles();
  const fresh = new Map(kit.newIngredients.map((i) => [i.id, i]));
  const styleOf = (id: string): PieceStyle | undefined => shipped.get(id) ?? (fresh.get(id)?.landingStyle ? { ...DEFAULT_PIECE_STYLE, interaction: { ...DEFAULT_PIECE_STYLE.interaction, landingStyle: fresh.get(id)!.landingStyle! } } : undefined);
  return { floors, references: Object.fromEntries(kit.recipes.map((r) => [r.id, referenceGroups(r, (id) => category.get(id) ?? null, styleOf)])) };
}

/** Everything a catalog-only train can change, as plain JSON (key order normalised by the caller's deep-equal, arrays keep catalog order). */
export function catalogDump(): Record<string, unknown> {
  const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  return plain({
    recipes: recipeRows,
    ingredients: INGREDIENTS,
    orders: ORDERS,
    ladder: DISCOVERY_LADDER.steps,
    lateLadder: LATE_LADDER_STEPS,
    lateRecipeIds: ALL_LATE_RECIPE_IDS,
    lateIngredientIds: [...lateIngredientIds],
    floors: LATE_ENTITLEMENT_FLOORS,
    families: Object.fromEntries(INGREDIENTS.map((i) => [i.id, ingredientAttributeFamily(i.id)])),
    sizeClasses: TOPPING_SIZE_CLASS_BY_ID,
    hintRoles: RECIPE_HINT_ROLES,
    sauceProfiles: RECIPE_SAUCE_PROFILES,
    chapterSizes: buildRecipeChapters().map((c) => c.recipes.length),
    lunchRushPool: recipeRows.filter((r) => participatesInLunchRush(r.id)).length,
    evidenceIds: Object.fromEntries(recipeRows.map((r) => [r.id, evidenceIdOf(r.id)])),
    references: Object.fromEntries(recipeRows.map((r) => [r.id, getReferencePizza(r.id)])),
  });
}
