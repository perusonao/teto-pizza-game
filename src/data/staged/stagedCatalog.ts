/**
 * Staged Catalog checks (Issue #780 plan §7-§8, E0). Pure functions over an injected view of the shipped catalog, so the
 * same code runs on the real catalog (stagedCatalog.test.ts) and on a what-if catalog (stagedWhatIf.*.test.ts). STAGED ONLY:
 * never imported by production code.
 */
import { STAGED_INGREDIENTS } from "./testSupport/stagedIngredients";
import { stagedMechanic } from "./stagedMechanics";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";
import type { StagedIngredient, StagedRecipe } from "./stagedTypes";

export interface ShippedView {
  readonly recipes: readonly { readonly id: string; readonly requiredIngredients: readonly { readonly ingredientId: string }[] }[];
  readonly ingredientIds: readonly string[];
}

/** Ids owned by in-flight work and therefore never registered here (plan §2; PR #783 = Batch 19, B20-A = #780 T5). */
export const IN_FLIGHT_RECIPE_IDS: Readonly<Record<string, string>> = {
  "pesto-burrata-pizza": "PR #783",
  "pizza-alla-crudaiola": "PR #783",
  "pesto-noci-pizza": "B20-A",
};
export const IN_FLIGHT_INGREDIENT_IDS: Readonly<Record<string, string>> = { burrata: "PR #783", honey: "B20-A", walnut: "B20-A" };

export const STAGED_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const distinct = (r: { readonly requiredIngredients: readonly { readonly ingredientId: string }[] }) =>
  [...new Set(r.requiredIngredients.map((q) => q.ingredientId))].sort();

/** Structural problems; empty = valid. */
export function validateStagedCatalog(
  shipped: ShippedView,
  recipes: readonly StagedRecipe[] = STAGED_RECIPES,
  ingredients: readonly StagedIngredient[] = STAGED_INGREDIENTS,
): string[] {
  const problems: string[] = [];
  const shippedRecipeIds = new Set(shipped.recipes.map((r) => r.id));
  const shippedIngIds = new Set(shipped.ingredientIds);
  const stagedIng = new Map(ingredients.map((i) => [i.id, i]));
  const seenR = new Set<string>();
  for (const r of recipes) {
    if (!STAGED_ID_PATTERN.test(r.id)) problems.push(`recipe id format: ${r.id}`);
    if (seenR.has(r.id)) problems.push(`duplicate staged recipe id: ${r.id}`);
    seenR.add(r.id);
    if (shippedRecipeIds.has(r.id)) problems.push(`staged recipe id collides with shipped: ${r.id}`);
    if (r.id in IN_FLIGHT_RECIPE_IDS) problems.push(`staged recipe id is owned by in-flight work: ${r.id}`);
    if (r.requiredIngredients.length === 0) problems.push(`recipe without ingredients: ${r.id}`);
    const ids = r.requiredIngredients.map((q) => q.ingredientId);
    if (new Set(ids).size !== ids.length) problems.push(`repeated ingredient in ${r.id}`);
    for (const q of r.requiredIngredients) {
      if (!Number.isInteger(q.minCount) || q.minCount < 1) problems.push(`minCount ${r.id}/${q.ingredientId}`);
      const known = shippedIngIds.has(q.ingredientId) || q.ingredientId in IN_FLIGHT_INGREDIENT_IDS;
      const st = stagedIng.get(q.ingredientId);
      if (!known && !st) problems.push(`unknown ingredient ${q.ingredientId} in ${r.id}`);
      if (st && st.status !== "ACTIVE") problems.push(`${r.id} references non-ACTIVE staged ingredient ${q.ingredientId}`);
      if (q.ingredientId in IN_FLIGHT_INGREDIENT_IDS && !r.inFlightIngredients.includes(q.ingredientId)) problems.push(`${r.id}: undeclared in-flight ingredient ${q.ingredientId}`);
    }
    for (const m of r.mechanics) if (!stagedMechanic(m)) problems.push(`unknown mechanic ${m} in ${r.id}`);
    const expectedLane = r.mechanics.length > 0 ? "R-C" : ids.some((i) => stagedIng.has(i) || i in IN_FLIGHT_INGREDIENT_IDS) ? "R-B" : "R-A";
    if (r.lane !== expectedLane) problems.push(`lane of ${r.id}: ${r.lane} != ${expectedLane}`);
  }
  const seenI = new Set<string>();
  for (const i of ingredients) {
    if (!STAGED_ID_PATTERN.test(i.id)) problems.push(`ingredient id format: ${i.id}`);
    if (seenI.has(i.id)) problems.push(`duplicate staged ingredient id: ${i.id}`);
    seenI.add(i.id);
    if (shippedIngIds.has(i.id)) problems.push(`staged ingredient collides with shipped: ${i.id}`);
    if (i.id in IN_FLIGHT_INGREDIENT_IDS) problems.push(`staged ingredient is owned by in-flight work: ${i.id}`);
    if ((i.category === "sauce") !== (i.placement === "spread")) problems.push(`placement of ${i.id}`);
    if ((i.category === "topping") !== (i.family !== null)) problems.push(`family of ${i.id}`);
    const users = recipes.filter((r) => r.requiredIngredients.some((q) => q.ingredientId === i.id)).map((r) => r.id).sort();
    if (JSON.stringify(users) !== JSON.stringify([...i.usedBy].sort())) problems.push(`usedBy of ${i.id} is stale`);
    if ((i.status === "ACTIVE") !== (users.length > 0)) problems.push(`status of ${i.id} (${i.status}) vs ${users.length} users`);
    if (i.status === "ALIASED_PROVISIONAL" && (!i.aliasCandidate || !shippedIngIds.has(i.aliasCandidate))) problems.push(`alias target of ${i.id}`);
    if (i.status === "MERGED_PROVISIONAL" && !ingredients.some((o) => o.mergedFrom.includes(i.id))) problems.push(`merge target of ${i.id}`);
  }
  return problems;
}

export type DuplicateKind = "IDENTICAL" | "SUBSET" | "SUPERSET" | "ONE_DIFF" | "JACCARD_GT_0_4";

export interface DuplicateHit {
  readonly against: string;
  readonly againstStaged: boolean;
  readonly kind: DuplicateKind;
  readonly jaccard: number;
}

function compareSets(a: readonly string[], b: readonly string[]): { kind: DuplicateKind | null; jaccard: number } {
  const A = new Set(a);
  const B = new Set(b);
  const inter = a.filter((x) => B.has(x)).length;
  const union = new Set([...a, ...b]).size;
  const jaccard = Math.round((inter / union) * 1000) / 1000;
  const aInB = inter === A.size;
  const bInA = inter === B.size;
  if (aInB && bInA) return { kind: "IDENTICAL", jaccard };
  if (aInB) return { kind: "SUBSET", jaccard };
  if (bInA) return { kind: "SUPERSET", jaccard };
  if (A.size === B.size && A.size - inter === 1) return { kind: "ONE_DIFF", jaccard };
  if (jaccard > 0.4) return { kind: "JACCARD_GT_0_4", jaccard };
  return { kind: null, jaccard };
}

/** Duplicate gate of every staged recipe against every shipped recipe and every other staged recipe (ingredient-id sets). */
export function stagedDuplicateGate(shipped: ShippedView, recipes: readonly StagedRecipe[] = STAGED_RECIPES): Record<string, DuplicateHit[]> {
  const out: Record<string, DuplicateHit[]> = {};
  for (const r of recipes) {
    const mine = distinct(r);
    const hits: DuplicateHit[] = [];
    for (const s of shipped.recipes) {
      const c = compareSets(mine, distinct(s));
      if (c.kind) hits.push({ against: s.id, againstStaged: false, kind: c.kind, jaccard: c.jaccard });
    }
    for (const o of recipes) {
      if (o.id === r.id) continue;
      const c = compareSets(mine, distinct(o));
      if (c.kind) hits.push({ against: o.id, againstStaged: true, kind: c.kind, jaccard: c.jaccard });
    }
    hits.sort((a, b) => (a.against < b.against ? -1 : 1));
    out[r.id] = hits;
  }
  return out;
}

export type DependencyKind =
  | "OWNER_RULE" | "MECHANIC" | "INGREDIENT_IN_FLIGHT" | "INGREDIENT_STAGED" | "UNRESOLVED_TOKEN" | "SAUCE_UNSPECIFIED" | "DUPLICATE_GATE" | "ID_SUFFIXED";

export interface Dependency {
  readonly kind: DependencyKind;
  readonly id: string;
}

/**
 * Open dependencies of one staged recipe. `INGREDIENT_STAGED` is registered here and resolves by promotion in the same train;
 * every other kind blocks promotion (`isBlocking`).
 */
export function stagedDependencies(r: StagedRecipe, dup: readonly DuplicateHit[], ingredients: readonly StagedIngredient[] = STAGED_INGREDIENTS): Dependency[] {
  const staged = new Set(ingredients.map((i) => i.id));
  const deps: Dependency[] = [];
  for (const rule of r.ownerRules) deps.push({ kind: "OWNER_RULE", id: rule });
  for (const m of r.mechanics) deps.push({ kind: "MECHANIC", id: m });
  for (const i of r.inFlightIngredients) deps.push({ kind: "INGREDIENT_IN_FLIGHT", id: i });
  for (const q of r.requiredIngredients) if (staged.has(q.ingredientId)) deps.push({ kind: "INGREDIENT_STAGED", id: q.ingredientId });
  for (const t of r.unresolvedTokens) deps.push({ kind: "UNRESOLVED_TOKEN", id: t });
  if (r.sauce.status === "unspecified") deps.push({ kind: "SAUCE_UNSPECIFIED", id: r.id });
  // One dependency per (gate kind, shipped|staged) -- the individual hits stay in the golden for review.
  const dupKeys = [...new Set(dup.map((h) => `${h.kind}${h.againstStaged ? "@staged" : "@shipped"}`))].sort();
  for (const k of dupKeys) deps.push({ kind: "DUPLICATE_GATE", id: k });
  if (/-pizzadb(-p\d+|-row)?$/.test(r.id)) deps.push({ kind: "ID_SUFFIXED", id: r.id });
  return deps;
}

export const isBlocking = (d: Dependency) => d.kind !== "INGREDIENT_STAGED";
