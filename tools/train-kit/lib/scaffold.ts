/**
 * Train Kit: approval spec (#816 `TrainSpec`, already measured by the preflight and answered by the Owner) -> the skeleton of
 * the implementation spec. Everything derivable is filled in; every AUTHORED value is left as the literal `TODO` so that
 * `validateKitTrain` refuses the spec until a person / model has written it (nothing player-visible is ever invented by a tool).
 */
import type { TrainSpec } from "../../../src/contentTrain/trainSpec";
import { KIT_DEFAULTS, type KitTrain } from "./implSpec";

export const TODO = "TODO";

export function scaffoldKit(
  spec: TrainSpec,
  meta: { tag: string; label: string; issue: number },
  facts: { categoryOf: (ingredientId: string) => string | null; evidenceIdOf: (recipeId: string) => string | null },
): { kit: KitTrain; decisions: string[] } {
  const decisions: string[] = [];
  const fresh = new Map(spec.newIngredients.map((i) => [i.id, i]));
  const categoryOf = (id: string) => fresh.get(id)?.category ?? facts.categoryOf(id);
  const claimed = new Set<string>();
  const recipes = spec.recipes.map((r) => {
    // A new material ships with the FIRST train recipe that uses it (spec order = ship order).
    const step = r.requiredIngredients.map((q) => q.ingredientId).filter((id) => fresh.has(id) && !claimed.has(id));
    step.forEach((id) => claimed.add(id));
    const sauce = r.requiredIngredients.find((q) => categoryOf(q.ingredientId) === "sauce" && q.applicationPhase !== "POST_BAKE");
    if (!sauce) decisions.push(`${r.id}: no sauce -> written as NO_SAUCE (sauceProfile null). This needs the Owner's explicit GAMEPLAY decision (D-2).`);
    if (step.length === 0) decisions.push(`${r.id}: adds no new material -> no ladder step, written as ladderCredit false. Confirm with the Owner decision for this recipe (OD-REC04-1 / D-6).`);
    if (step.length === 0 && r.placement === "late") decisions.push(`${r.id}: a late recipe without its own step is not supported by the generator (the late catalog unlocks step by step).`);
    return {
      id: r.id, nameJa: r.nameJa, description: TODO, placement: r.placement,
      requiredIngredients: r.requiredIngredients.map((q) => ({ ingredientId: q.ingredientId, minCount: q.minCount, ...(q.applicationPhase === "POST_BAKE" ? { applicationPhase: "POST_BAKE" as const } : {}) })),
      bakeTarget: { ...KIT_DEFAULTS.bakeTarget }, baseRewardPitz: KIT_DEFAULTS.baseRewardPitz, lunchRush: KIT_DEFAULTS.lunchRush, ladderCredit: step.length > 0,
      evidenceId: facts.evidenceIdOf(r.id) ?? TODO,
      order: { requestedBy: KIT_DEFAULTS.requestedBy, lineJa: TODO },
      // olive-oil is PAINT_TEMPORARY in every shipped recipe that uses it as its own sauce; every other sauce is PAINT.
      sauceProfile: sauce ? { ingredientId: sauce.ingredientId, interaction: sauce.ingredientId === "olive-oil" ? ("PAINT_TEMPORARY" as const) : ("PAINT" as const) } : null,
      ladderStep: step.length > 0 ? { ingredientIds: step } : null,
    };
  });
  const newIngredients = spec.newIngredients.map((i) => ({ id: i.id, nameJa: i.nameJa, category: i.category, family: i.family, color: TODO, emoji: TODO, ...(i.category === "sauce" ? {} : { sizeClass: TODO as never }) }));
  return { kit: { train: spec.train, ...meta, recipes, newIngredients }, decisions };
}

/** Paths of the authored values still left as `TODO`. */
export function todoPaths(value: unknown, path = ""): string[] {
  if (value === TODO) return [path];
  if (Array.isArray(value)) return value.flatMap((v, i) => todoPaths(v, `${path}[${(v as { id?: string })?.id ?? i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => todoPaths(v, path ? `${path}.${k}` : k));
  return [];
}
