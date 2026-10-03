/**
 * Discovery Progression Inspector (DEV / Preview only): the read-only model behind
 * ./DiscoveryProgressionInspector.tsx. It answers "this ingredient unlocks -> which undiscovered
 * recipes newly become DISCOVERABLE -> how large is the pool -> can it be an OPEN_POOL?".
 *
 * **No second authority.** Nothing here re-implements a rule. Every judgement is a call into the
 * production modules the game itself uses:
 * - the ladder (`DISCOVERY_LADDER`) and the entitlement bridge (`resolveShopEntitlement`),
 * - the ladder credit rule (`countsTowardLadder`) and the Lunch Rush rule (`participatesInLunchRush`),
 * - the per-recipe discovery state (`recipeDiscoveryState`, i.e. the DISCOVERABLE predicate),
 * - the hint target selection (`selectHintTarget`, whose OPEN_POOL it reuses verbatim),
 * - the Dex numbering (`buildRecipeChapters`) and `registerScoreToDex` for the Dex itself.
 * Nothing is hardcoded: ids, names, steps and counts all come from production data.
 *
 * **Read-only.** Pure functions over production constants. No save, storage, reducer, inventory,
 * Pitz or Dex of a real player is read or written: the Dex built here is a local simulation value.
 *
 * **The walked path** is the canonical Discovery Ladder order (the same one the production26 pool
 * tests walk): the recipe found first is the one with no finite material, then each step's key
 * recipe in step order. Non-credit recipes (`ladderCredit: false`) are never found on that path,
 * so they stay in the pool from the step that makes them makeable (a different discovery order
 * changes which recipes are still undiscovered, never the step at which one becomes DISCOVERABLE).
 */
import { DISCOVERY_LADDER, type DiscoveryLadder } from "../data/discoveryLadder";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { countsTowardLadder, participatesInLunchRush, RECIPES, type Recipe } from "../data/recipes";
import { selectHintTarget } from "../logic/discovery/hintTarget";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../state/dex";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import { buildRecipeChapters } from "../state/recipeChapters";
import { recipeDiscoveryState, type RecipeDiscoveryInputs } from "../state/recipeDiscoveryState";

/** Ascending severity of what the hint target selection can do at a step. */
export type HintClassification =
  /** No DISCOVERABLE recipe (nothing to find right now). */
  | "NO_POOL"
  /** Exactly one DISCOVERABLE recipe: `selectHintTarget` picks it automatically. */
  | "NORMAL"
  /** 2+ DISCOVERABLE and at least one was already DISCOVERABLE before this unlock: with no maintained
   *  (sticky / purchased) target it is OPEN_POOL, but a kept target would still be honoured. */
  | "OPEN_POOL_POSSIBLE"
  /** 2+ DISCOVERABLE and every one is new at this step: nothing can be maintained, so OPEN_POOL. */
  | "OPEN_POOL";

export const HINT_CLASSIFICATION_LABEL: Record<HintClassification, string> = {
  NO_POOL: "NO POOL",
  NORMAL: "NORMAL",
  OPEN_POOL_POSSIBLE: "OPEN_POOL POSSIBLE",
  OPEN_POOL: "OPEN_POOL",
};

export interface InspectorIngredient {
  id: string;
  nameJa: string;
}

export interface InspectorRecipeRequirement extends InspectorIngredient {
  minCount: number;
  /** An onboarding starter (always usable). */
  starter: boolean;
  /** Usable in the BEFORE state (starter, or entitled + owned + stocked). */
  usableBefore: boolean;
  /** This step's unlock (🆕). */
  isNewThisStep: boolean;
}

export interface InspectorNewRecipe {
  recipeId: string;
  nameJa: string;
  /** Dex slot, as the Dex shows it: chapter and the 1-based number inside it. */
  chapter: number;
  no: number;
  requirements: readonly InspectorRecipeRequirement[];
  /** Required ingredients not usable before this step (all of them are 🆕 materials of this step). */
  missingBefore: readonly InspectorIngredient[];
  /** `countsTowardLadder`: false means discovering it does not advance the ladder. */
  ladderCredit: boolean;
  /** `participatesInLunchRush`. */
  lunchRush: boolean;
  /** This step is the recipe's own key step (it is the ladder step's `keyRecipeId`). */
  isKeyRecipeOfThisStep: boolean;
}

export interface InspectorPoolMember {
  recipeId: string;
  nameJa: string;
  /** Already DISCOVERABLE before this step's unlock (a carry-over), as opposed to newly so. */
  carriedOver: boolean;
  /** Requires one of this step's 🆕 materials. */
  usesNewMaterial: boolean;
  /** Every distinct required ingredient id (for the 🆕-clue view). */
  requiredIngredientIds: readonly string[];
}

export interface InspectorStep {
  step: number;
  /** The unlocked materials (🆕), in ladder order. */
  unlocked: readonly InspectorIngredient[];
  /** Recipes discovered by this point on the walked path (what the Dex holds, ids). */
  discoveredRecipeIds: readonly string[];
  /** The Dex count the ladder reads (credited discoveries only) = this step's number. */
  ladderCount: number;
  beforeOwned: readonly InspectorIngredient[];
  afterOwned: readonly InspectorIngredient[];
  newlyDiscoverable: readonly InspectorNewRecipe[];
  beforePool: readonly InspectorPoolMember[];
  afterPool: readonly InspectorPoolMember[];
  classification: HintClassification;
  /** What `selectHintTarget` returns with no maintained target (kind, plus the recipe when TARGET). */
  hintTargetKind: string;
  /** Carried-over pool members that, kept as a sticky (purchased / revealed) target, make
   *  `selectHintTarget` return them instead of OPEN_POOL (checked through `selectHintTarget`). */
  maintainableTargetIds: readonly string[];
}

export interface InspectorNonCreditRecipe {
  recipeId: string;
  nameJa: string;
  /** First step at which it is DISCOVERABLE. */
  firstDiscoverableStep: number | null;
  /** Steps whose pool holds it while undiscovered (on the walked path). */
  poolSteps: readonly number[];
  /** Ladder count is the same with or without discovering it (credit rule, from the production predicate). */
  advancesLadder: boolean;
  lunchRush: boolean;
}

export interface InspectorModel {
  recipeCount: number;
  ingredientCount: number;
  starterIngredientIds: readonly string[];
  /** The recipes already makeable from the starters alone (found first). */
  startingPool: readonly InspectorPoolMember[];
  steps: readonly InspectorStep[];
  populationId: string;
  stepCount: number;
  multiRecipeStepNumbers: readonly number[];
  openPoolStepNumbers: readonly number[];
  openPoolPossibleStepNumbers: readonly number[];
  nonCreditRecipes: readonly InspectorNonCreditRecipe[];
}

const SCORE = { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 } as const;
/** Stock of every owned finite material: any value >= 1 makes it usable (one unit finds a recipe). */
const SIMULATED_STOCK = 10;

function nameOf(id: string): InspectorIngredient {
  return { id, nameJa: getIngredient(id)?.nameJa ?? id };
}

function dexOf(recipeIds: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of recipeIds) dex = registerScoreToDex(dex, id, SCORE).dex;
  return dex;
}

/** The simulated save-shaped inputs of the production predicate: every entitled material bought. */
function inputsOf(dex: DexState, materialIds: readonly string[]): RecipeDiscoveryInputs {
  return {
    dex,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...materialIds],
    unlockedForShopIngredientIds: materialIds,
    inventory: Object.fromEntries(materialIds.map((id) => [id, SIMULATED_STOCK])),
  };
}

function discoverableOf(inputs: RecipeDiscoveryInputs): Recipe[] {
  return RECIPES.filter((r) => recipeDiscoveryState(r, inputs) === "DISCOVERABLE");
}

function materialsAt(dex: DexState, ladder: DiscoveryLadder): readonly string[] {
  return resolveShopEntitlement(dex, [], [], ladder).unlockedForShopIngredientIds;
}

export function buildInspectorModel(ladder: DiscoveryLadder = DISCOVERY_LADDER): InspectorModel {
  const slotOf = new Map<string, { chapter: number; no: number }>();
  for (const chapter of buildRecipeChapters(RECIPES, ladder)) {
    chapter.recipes.forEach((r, i) => slotOf.set(r.id, { chapter: chapter.chapter, no: i + 1 }));
  }
  const poolMember = (r: Recipe, before: ReadonlySet<string>, unlocked: ReadonlySet<string>): InspectorPoolMember => ({
    recipeId: r.id,
    nameJa: r.nameJa,
    carriedOver: before.has(r.id),
    usesNewMaterial: r.requiredIngredients.some((req) => unlocked.has(req.ingredientId)),
    requiredIngredientIds: [...new Set(r.requiredIngredients.map((req) => req.ingredientId))],
  });

  // The recipe found first: whatever is makeable from the onboarding starters alone.
  const startInputs = inputsOf(EMPTY_DEX, []);
  const startRecipes = discoverableOf(startInputs);
  const startIds = new Set<string>();
  const startingPool = startRecipes.map((r) => poolMember(r, startIds, startIds));
  const walkOrder = [...startRecipes.map((r) => r.id), ...ladder.steps.map((s) => s.keyRecipeId)];

  const steps: InspectorStep[] = ladder.steps.map((ladderStep) => {
    const s = ladderStep.step;
    // Step s is reached at ladder count s: the recipes found so far are the first s of the walk.
    const dex = dexOf(walkOrder.slice(0, s));
    const afterMaterials = materialsAt(dex, ladder);
    const beforeMaterials = materialsAt(dexOf(walkOrder.slice(0, s - 1)), ladder);
    const after = inputsOf(dex, afterMaterials);
    // BEFORE = the same Dex, without this step's unlock: isolates the unlock's own effect.
    const before = inputsOf(dex, beforeMaterials);
    const unlockedIds = new Set(afterMaterials.filter((id) => !beforeMaterials.includes(id)));
    const beforePoolRecipes = discoverableOf(before);
    const afterPoolRecipes = discoverableOf(after);
    const beforeIds = new Set(beforePoolRecipes.map((r) => r.id));
    const newlyRecipes = afterPoolRecipes.filter((r) => !beforeIds.has(r.id));
    const beforeUsable = new Set([...STARTER_INGREDIENT_IDS, ...beforeMaterials]);

    const newlyDiscoverable: InspectorNewRecipe[] = newlyRecipes.map((r) => {
      const requirements = r.requiredIngredients.map((req) => ({
        ...nameOf(req.ingredientId),
        minCount: req.minCount,
        starter: STARTER_INGREDIENT_IDS.includes(req.ingredientId),
        usableBefore: beforeUsable.has(req.ingredientId),
        isNewThisStep: unlockedIds.has(req.ingredientId),
      }));
      const slot = slotOf.get(r.id) ?? { chapter: 0, no: 0 };
      return {
        recipeId: r.id,
        nameJa: r.nameJa,
        chapter: slot.chapter,
        no: slot.no,
        requirements,
        missingBefore: requirements.filter((q) => !q.usableBefore).map(({ id, nameJa }) => ({ id, nameJa })),
        ladderCredit: countsTowardLadder(r.id),
        lunchRush: participatesInLunchRush(r.id),
        isKeyRecipeOfThisStep: r.id === ladderStep.keyRecipeId,
      };
    });

    const undecided = selectHintTarget(after);
    // Only a recipe that was already DISCOVERABLE before this unlock could have a purchase / reveal
    // behind it; a brand-new one cannot be a maintained target yet.
    const maintainableTargetIds = afterPoolRecipes
      .filter((r) => beforeIds.has(r.id))
      .filter((r) => {
        const kept = selectHintTarget(after, { stickyRecipeId: r.id });
        return kept.kind === "TARGET" && kept.recipeId === r.id;
      })
      .map((r) => r.id);
    const carried = afterPoolRecipes.filter((r) => beforeIds.has(r.id));
    let classification: HintClassification;
    if (afterPoolRecipes.length === 0) classification = "NO_POOL";
    else if (undecided.kind === "TARGET") classification = "NORMAL";
    else if (undecided.kind === "OPEN_POOL") classification = carried.length > 0 ? "OPEN_POOL_POSSIBLE" : "OPEN_POOL";
    else classification = "NO_POOL";

    return {
      step: s,
      unlocked: ladderStep.ingredientIds.map(nameOf),
      discoveredRecipeIds: walkOrder.slice(0, s),
      ladderCount: s,
      beforeOwned: beforeMaterials.map(nameOf),
      afterOwned: afterMaterials.map(nameOf),
      newlyDiscoverable,
      beforePool: beforePoolRecipes.map((r) => poolMember(r, beforeIds, unlockedIds)),
      afterPool: afterPoolRecipes.map((r) => poolMember(r, beforeIds, unlockedIds)),
      classification,
      hintTargetKind: undecided.kind === "TARGET" ? `TARGET:${undecided.recipeId}` : undecided.kind,
      maintainableTargetIds,
    };
  });

  const nonCreditRecipes: InspectorNonCreditRecipe[] = RECIPES.filter((r) => !countsTowardLadder(r.id)).map((r) => ({
    recipeId: r.id,
    nameJa: r.nameJa,
    firstDiscoverableStep: steps.find((st) => st.afterPool.some((m) => m.recipeId === r.id))?.step ?? null,
    poolSteps: steps.filter((st) => st.afterPool.some((m) => m.recipeId === r.id)).map((st) => st.step),
    advancesLadder: countsTowardLadder(r.id),
    lunchRush: participatesInLunchRush(r.id),
  }));

  return {
    recipeCount: RECIPES.length,
    ingredientCount: INGREDIENTS.length,
    starterIngredientIds: STARTER_INGREDIENT_IDS,
    startingPool,
    steps,
    populationId: ladder.populationId,
    stepCount: steps.length,
    multiRecipeStepNumbers: steps.filter((st) => st.newlyDiscoverable.length >= 2).map((st) => st.step),
    openPoolStepNumbers: steps.filter((st) => st.classification === "OPEN_POOL").map((st) => st.step),
    openPoolPossibleStepNumbers: steps.filter((st) => st.classification === "OPEN_POOL_POSSIBLE").map((st) => st.step),
    nonCreditRecipes,
  };
}

/** Free-text match over ingredient id / name and recipe id / name of everything a step shows. */
export function stepMatchesQuery(step: InspectorStep, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay: string[] = [];
  for (const i of [...step.unlocked, ...step.beforeOwned, ...step.afterOwned]) hay.push(i.id, i.nameJa);
  for (const r of step.newlyDiscoverable) {
    hay.push(r.recipeId, r.nameJa);
    for (const q2 of r.requirements) hay.push(q2.id, q2.nameJa);
  }
  for (const m of step.afterPool) hay.push(m.recipeId, m.nameJa);
  return hay.some((h) => h.toLowerCase().includes(q));
}

export type InspectorFilter = "all" | "multi" | "open-pool";

export function stepMatchesFilter(step: InspectorStep, filter: InspectorFilter): boolean {
  if (filter === "multi") return step.newlyDiscoverable.length >= 2;
  if (filter === "open-pool") return step.classification === "OPEN_POOL" || step.classification === "OPEN_POOL_POSSIBLE";
  return true;
}
