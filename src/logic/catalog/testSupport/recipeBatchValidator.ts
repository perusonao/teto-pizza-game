/**
 * Recipe Expansion speed-up Phase 1: the minimal Recipe Batch Validator. TEST SUPPORT ONLY (never imported by
 * production code); a function, not a framework. It adds only the CROSS-TABLE checks that no per-table test owns,
 * and reuses the production authorities (`validateDiscoveryLadder`, `researchCohortLetters`, `recipeChapter*`,
 * `isCutEligible`, `participatesInLunchRush`, ...) instead of re-deriving them.
 *
 * Already guaranteed elsewhere, deliberately NOT re-implemented here (a batch still runs them, they are catalog-wide):
 *  - table coverage (ORDERS / sauce profiles / discovery targets+catalog / references = RECIPES ids) and matcher
 *    self-match: `src/state/w1Activation.test.tsx` ("production tables", "exact-set discovery");
 *  - sauce-profile <-> required sauce: `src/data/recipeSauceProfiles.test.ts`;
 *  - Hint role coverage / key-topping shape: `src/logic/discovery/hint5Taxonomy.gate.test.ts` (G17);
 *  - composition collision: `src/mission/dinner/dinnerResultDetection.test.ts` ("32: every recipe has a unique signature");
 *  - ladder structure / reachability / key recipe: `validateLadderProgression` in `src/logic/discoveryLadder.test.ts`
 *    and `src/logic/w1LadderEconomy.test.ts`; frozen steps: `src/logic/discoveryLadder.appendOnly.test.ts`.
 *
 * Added here (all return problem strings; empty = valid):
 *  `validateCatalogTables(view)`  - recipe / ingredient id uniqueness, ingredient existence, finite-material -> ladder,
 *                                   CUT <-> cooking-profile <-> mechanic capability consistency.
 *  `validateBatchManifest(m, view)` - for a PLANNED batch: nothing of it exists yet and it is next in line; for a LANDED
 *                                   batch: appended tail (No. identity), append-only ladder steps, chapter / Research
 *                                   cohort identity of every pre-existing recipe, and explicit Lunch Rush / CUT /
 *                                   ladder-credit / Hint declarations that match the data.
 */
import { MAX_VISIBLE_COOKING_TABS, getCookingProfile, isCutEligible, visibleCookingTabCount, type CookingProfile } from "../../../data/cookingProfiles";
import { RECIPE_DISCOVERY_CATALOG } from "../../../data/discoveryCatalog";
import { DISCOVERY_LADDER, type DiscoveryLadder } from "../../../data/discoveryLadder";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, type Ingredient } from "../../../data/ingredients";
import { RECIPE_HINT_ROLES } from "../../../data/recipeHintRoles";
import { getReferencePizza } from "../../../data/referencePizza";
import { DINNER_MISSIONS } from "../../../mission/dinner/dinnerMission";
import { RECIPES, countsTowardLadder, participatesInLunchRush, type Recipe } from "../../../data/recipes";
import { recipeChapter, recipeChapterSlot } from "../../../state/recipeChapters";
import { isKeyFreeHintRoles } from "../../discovery/hint5Ladder";
import { researchCohortLetters } from "../../discovery/researchEntry";
import { RUNTIME_SUPPORTED_CAPABILITIES } from "../../discovery/signature";
import { validateDiscoveryLadder } from "../../discoveryLadder";

/**
 * Making steps the runtime actually wires (FOLD / SEAL / EDGE_FILL have no recipe or reducer wiring). FINISH is wired since
 * the FIN-A..D engine / UI / reducer work (Issue #294), but only for a recipe that asks for a late addition and only while
 * `validateFinishCatalog` below holds -- no shipped recipe uses it (`finishD2Inert.test.ts`).
 */
const WIRED_STEPS: readonly string[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"];

export interface CatalogView {
  recipes: readonly Recipe[];
  ingredients: readonly Ingredient[];
  starterIds: readonly string[];
  ladder: DiscoveryLadder;
  isCutEligible: (recipeId: string) => boolean;
  cookingSteps: (recipeId: string) => readonly string[];
  /** Capabilities each recipe's discovery target requires, by recipe id. */
  targetCapabilities: (recipeId: string) => readonly string[];
  supportedCapabilities: readonly string[];
  lunchRush: (recipeId: string) => boolean;
  ladderCredit: (recipeId: string) => boolean;
  keyFreeHint: (recipeId: string) => boolean;
  /**
   * FIN-E1 (Issue #294): optional so existing views (and a batch PR's own view builders) keep working; `productionCatalogView`
   * fills them in. Absent = the check that needs it is skipped.
   *  - `dinnerTargetIds`: every recipe id a Dinner mission targets (a late recipe must never be one: UD-I).
   *  - `referencePieceCount`: how many pieces the recipe's Reference pizza places of one ingredient (`null` = no Reference).
   */
  dinnerTargetIds?: readonly string[];
  referencePieceCount?: (recipeId: string, ingredientId: string) => number | null;
}

export function productionCatalogView(): CatalogView {
  return {
    recipes: RECIPES,
    ingredients: INGREDIENTS,
    starterIds: STARTER_INGREDIENT_IDS,
    ladder: DISCOVERY_LADDER,
    isCutEligible: (id) => isCutEligible(id as Recipe["id"]),
    cookingSteps: (id) => getCookingProfile(id as Recipe["id"]).steps,
    targetCapabilities: (id) => RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === id)?.capabilities ?? [],
    supportedCapabilities: RUNTIME_SUPPORTED_CAPABILITIES,
    lunchRush: (id) => participatesInLunchRush(id),
    ladderCredit: (id) => countsTowardLadder(id),
    keyFreeHint: (id) => isKeyFreeHintRoles((RECIPE_HINT_ROLES as Record<string, unknown>)[id]),
    dinnerTargetIds: DINNER_MISSIONS.flatMap((m) => m.targetRecipeIds),
    referencePieceCount: (id, ingredientId) => {
      const reference = getReferencePizza(id);
      if (!reference) return null;
      return reference.pieceGroups.filter((g) => g.ingredientId === ingredientId).reduce((n, g) => n + g.positions.length, 0);
    },
  };
}

const dupes = (ids: readonly string[]): string[] => ids.filter((id, i) => ids.indexOf(id) !== i);

export function validateCatalogTables(view: CatalogView): string[] {
  const problems: string[] = [];
  const recipeIds = view.recipes.map((r) => r.id as string);
  const ingredientIds = new Set(view.ingredients.map((i) => i.id));

  for (const id of new Set(dupes(recipeIds))) problems.push(`RECIPE_ID_DUPLICATE: ${id}`);
  for (const id of new Set(dupes(view.ingredients.map((i) => i.id)))) problems.push(`INGREDIENT_ID_DUPLICATE: ${id}`);

  for (const r of view.recipes) {
    for (const q of r.requiredIngredients) {
      if (!ingredientIds.has(q.ingredientId)) problems.push(`INGREDIENT_UNKNOWN: ${r.id} needs ${q.ingredientId}`);
      if (!Number.isInteger(q.minCount) || q.minCount < 1) problems.push(`INGREDIENT_COUNT: ${r.id} ${q.ingredientId} minCount ${q.minCount}`);
    }
  }

  // Discovery unlock material: every finite material a recipe uses is unlocked by exactly one ladder step.
  const stepOf = new Map<string, number>();
  for (const s of view.ladder.steps) for (const id of s.ingredientIds) stepOf.set(id, s.step);
  for (const p of validateDiscoveryLadder(view.ladder)) problems.push(`LADDER_STRUCTURE: ${p}`);
  const used = new Set(view.recipes.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)));
  for (const ing of view.ingredients) {
    const finite = ing.unlockCondition !== undefined && !ing.starterGrantOnly && !view.starterIds.includes(ing.id);
    if (finite && used.has(ing.id) && !stepOf.has(ing.id)) problems.push(`MATERIAL_NOT_ON_LADDER: ${ing.id}`);
  }

  // CUT / mechanic capability consistency.
  for (const r of view.recipes) {
    const steps = view.cookingSteps(r.id);
    if (view.isCutEligible(r.id) !== steps.includes("CUT")) problems.push(`CUT_PROFILE_MISMATCH: ${r.id}`);
    for (const step of steps) if (!WIRED_STEPS.includes(step)) problems.push(`STEP_NOT_WIRED: ${r.id} uses ${step}`);
    for (const cap of view.targetCapabilities(r.id)) {
      if (!view.supportedCapabilities.includes(cap)) problems.push(`CAPABILITY_UNSUPPORTED: ${r.id} needs ${cap}`);
    }
  }
  problems.push(...validateFinishCatalog(view));
  return problems;
}

/**
 * FIN-E1 (Issue #294): the safety guards a recipe with a late addition (`applicationPhase: "POST_BAKE"`) must satisfy before
 * FINISH can be turned on for it. All of them are vacuous for the shipped catalog (no late recipe), so Production is unchanged;
 * they bite the moment a late recipe is added (a batch PR, E4), in CI, instead of in front of a player.
 *
 *  FINISH_WITHOUT_LATE     a profile has FINISH but the recipe asks for no late addition (an empty step).
 *  LATE_WITHOUT_FINISH     the recipe asks for a late addition but its profile has no FINISH (it could never be met).
 *  LATE_WITH_CUT           FINISH + CUT = 7 tabs: the 6-tab ceiling (OD-CS-9 a) needs CS-4 first.
 *  TAB_CEILING             any recipe's tab strip (PREPARE steps + 焼く + post-bake steps) exceeds the ceiling.
 *  LATE_IN_LUNCH_RUSH      a late recipe must opt out (`lunchRush: false`): the pool opts IN by default and FINISH never runs there.
 *  LATE_IN_DINNER          a Dinner mission targets a late recipe (UD-I: excluded until the Dinner audit).
 *  LATE_NOT_TOPPING        the late ingredient is not a scatter topping (FINISH places toppings only; liquids are #579).
 *  LATE_BOTH_PHASES        one ingredient is required both before and after the bake (the two piece sets cannot be told apart).
 *  LATE_NO_REFERENCE       no Reference pizza, or too few Reference pieces of the late ingredient (Scoring 2.0 reads them).
 */
export function validateFinishCatalog(view: CatalogView): string[] {
  const problems: string[] = [];
  const ingredientById = new Map(view.ingredients.map((i) => [i.id, i]));
  for (const r of view.recipes) {
    const steps = view.cookingSteps(r.id);
    const late = r.requiredIngredients.filter((q) => q.applicationPhase === "POST_BAKE");
    const hasFinish = steps.includes("FINISH");
    if (hasFinish && late.length === 0) problems.push(`FINISH_WITHOUT_LATE: ${r.id}`);
    if (!hasFinish && late.length > 0) problems.push(`LATE_WITHOUT_FINISH: ${r.id}`);
    if (hasFinish && steps.includes("CUT")) problems.push(`LATE_WITH_CUT: ${r.id}`);
    const tabs = visibleCookingTabCount({ steps: steps as CookingProfile["steps"] });
    if (tabs > MAX_VISIBLE_COOKING_TABS) problems.push(`TAB_CEILING: ${r.id} ${tabs} tabs`);
    if (late.length === 0) continue;

    if (view.lunchRush(r.id)) problems.push(`LATE_IN_LUNCH_RUSH: ${r.id}`);
    if (view.dinnerTargetIds?.includes(r.id)) problems.push(`LATE_IN_DINNER: ${r.id}`);
    for (const q of late) {
      const ingredient = ingredientById.get(q.ingredientId);
      if (ingredient && (ingredient.category !== "topping" || ingredient.placement !== "scatter")) problems.push(`LATE_NOT_TOPPING: ${r.id} ${q.ingredientId}`);
      if (r.requiredIngredients.some((o) => o.ingredientId === q.ingredientId && o.applicationPhase !== "POST_BAKE")) problems.push(`LATE_BOTH_PHASES: ${r.id} ${q.ingredientId}`);
      if (view.referencePieceCount) {
        const count = view.referencePieceCount(r.id, q.ingredientId);
        if (count === null || count < q.minCount) problems.push(`LATE_NO_REFERENCE: ${r.id} ${q.ingredientId} (${count ?? "no Reference"} < ${q.minCount})`);
      }
    }
  }
  return problems;
}

export interface BatchRecipe {
  recipeId: string;
  /** The new finite material this recipe is the key recipe of (one appended ladder step per recipe, in manifest order). */
  keyIngredientId: string;
  /** Declared once the batch has landed; required (explicit inclusion / exclusion) and checked against the data then. */
  ladderCredit?: boolean;
  /** A credited recipe that is NOT the key recipe of a ladder step (it only adds to the credited count, restoring ladder slack;
   *  Issue #561). Declared explicitly: the validator then requires that no step names it as key recipe. */
  creditedWithoutStep?: boolean;
  lunchRush?: boolean;
  cut?: boolean;
  hint?: "key-free" | "keyed";
}

export interface RecipeBatchManifest {
  batchId: string;
  status: "planned" | "landed";
  /** The recipe this batch is appended after (the last recipe of the previous catalog). Names the base without a count pin. */
  afterRecipeId: string;
  recipes: readonly BatchRecipe[];
  /**
   * Batch 8a: Research cohort letters that PRE-EXISTING recipes are expected to gain because a non-credit batch recipe joins their
   * cohort (`recipeId -> "<before>-><after>"`, `-` = no letter, so "no letter -> A" is `-->A`). Default none: any shift not listed here is still `COHORT_LETTER_SHIFT`,
   * and a listed shift that does not happen is `ACCEPTED_LETTER_SHIFT_NOT_OBSERVED`. Owner-approved display change only.
   */
  acceptedLetterShifts?: Readonly<Record<string, string>>;
}

export function validateBatchManifest(manifest: RecipeBatchManifest, view: CatalogView): string[] {
  const problems: string[] = [];
  const ids = manifest.recipes.map((r) => r.recipeId);
  const keyIds = manifest.recipes.map((r) => r.keyIngredientId);
  for (const id of new Set(dupes(ids))) problems.push(`MANIFEST_RECIPE_DUPLICATE: ${id}`);
  for (const id of new Set(dupes(keyIds))) problems.push(`MANIFEST_KEY_INGREDIENT_DUPLICATE: ${id}`);

  const recipeIds = view.recipes.map((r) => r.id as string);
  const base = recipeIds.indexOf(manifest.afterRecipeId) + 1;
  if (base === 0) return [...problems, `BASE_UNKNOWN: ${manifest.afterRecipeId}`];

  if (manifest.status === "planned") {
    // Nothing of a planned batch exists, and it is next in line (a recipe landed in between => update the manifest).
    for (const r of manifest.recipes) {
      if (recipeIds.includes(r.recipeId)) problems.push(`PLANNED_RECIPE_EXISTS: ${r.recipeId}`);
      if (view.ingredients.some((i) => i.id === r.keyIngredientId)) problems.push(`PLANNED_INGREDIENT_EXISTS: ${r.keyIngredientId}`);
    }
    if (base !== recipeIds.length) problems.push(`BASE_NOT_LAST: ${manifest.afterRecipeId} is not the last recipe`);
    return problems;
  }

  // LANDED: the recipes are the tail of RECIPES, in manifest order (No. identity).
  const tail = recipeIds.slice(base);
  if (JSON.stringify(tail) !== JSON.stringify(ids)) problems.push(`NO_IDENTITY: tail after ${manifest.afterRecipeId} is [${tail}], manifest [${ids}]`);

  // Append-only ladder: the batch adds steps after the base's, one per recipe, in manifest order.
  const baseSteps = view.ladder.steps.filter((s) => !ids.includes(s.keyRecipeId));
  const addedSteps = view.ladder.steps.filter((s) => ids.includes(s.keyRecipeId));
  const baseStepCount = view.ladder.steps.length - addedSteps.length;
  if (view.ladder.steps.slice(0, baseStepCount).some((s) => ids.includes(s.keyRecipeId))) problems.push("LADDER_NOT_APPENDED: a batch step sits inside the frozen prefix");
  const wantCredited = manifest.recipes.filter((r) => r.ladderCredit !== false && !r.creditedWithoutStep);
  for (const r of manifest.recipes.filter((m) => m.creditedWithoutStep)) {
    if (r.ladderCredit !== true) problems.push(`CREDITED_WITHOUT_STEP_NOT_CREDITED: ${r.recipeId}`);
  }
  if (JSON.stringify(addedSteps.map((s) => s.keyRecipeId)) !== JSON.stringify(wantCredited.map((r) => r.recipeId))) {
    problems.push(`LADDER_ORDER: batch steps [${addedSteps.map((s) => s.keyRecipeId)}] vs credited manifest [${wantCredited.map((r) => r.recipeId)}]`);
  }
  for (const r of wantCredited) {
    const step = addedSteps.find((s) => s.keyRecipeId === r.recipeId);
    if (step && !step.ingredientIds.includes(r.keyIngredientId)) problems.push(`LADDER_MATERIAL: step ${step.step} of ${r.recipeId} does not unlock ${r.keyIngredientId}`);
  }

  // Research cohort / chapter identity: nothing that existed before the batch moves.
  const oldRecipes = view.recipes.slice(0, base);
  const materialsOf = (steps: readonly { ingredientIds: readonly string[] }[]) => [...view.starterIds, ...steps.flatMap((s) => s.ingredientIds)];
  const lettersBefore = researchCohortLetters(materialsOf(baseSteps), oldRecipes);
  const lettersAfter = researchCohortLetters(materialsOf(view.ladder.steps), view.recipes);
  for (const r of oldRecipes) {
    const shift = `${lettersBefore.get(r.id) ?? "-"}->${lettersAfter.get(r.id) ?? "-"}`;
    const accepted = manifest.acceptedLetterShifts?.[r.id];
    if (lettersBefore.get(r.id) !== lettersAfter.get(r.id) && accepted !== shift) problems.push(`COHORT_LETTER_SHIFT: ${r.id} ${lettersBefore.get(r.id) ?? "-"} -> ${lettersAfter.get(r.id) ?? "-"}`);
    if (accepted !== undefined && lettersBefore.get(r.id) === lettersAfter.get(r.id)) problems.push(`ACCEPTED_LETTER_SHIFT_NOT_OBSERVED: ${r.id}`);
    const before = [recipeChapter(r, { populationId: "base", steps: baseSteps }), recipeChapterSlot(r, oldRecipes, { populationId: "base", steps: baseSteps })];
    const after = [recipeChapter(r, view.ladder), recipeChapterSlot(r, view.recipes, view.ladder)];
    if (before.join() !== after.join()) problems.push(`CHAPTER_IDENTITY: ${r.id} chapter/No ${before.join("/")} -> ${after.join("/")}`);
  }
  for (const id of Object.keys(manifest.acceptedLetterShifts ?? {})) if (!oldRecipes.some((r) => r.id === id)) problems.push(`ACCEPTED_LETTER_SHIFT_UNKNOWN_RECIPE: ${id}`);
  // The new recipe's Research cohort is its own new material (it never joins an existing cohort) -- credited batch recipes only.
  const order = materialsOf(view.ladder.steps);
  for (const r of manifest.recipes.filter((m) => m.ladderCredit !== false)) {
    const recipe = view.recipes.find((x) => x.id === r.recipeId);
    if (!recipe) continue;
    const finite = recipe.requiredIngredients.map((q) => q.ingredientId).filter((id) => order.indexOf(id) >= view.starterIds.length);
    const last = finite.sort((x, y) => order.indexOf(x) - order.indexOf(y)).at(-1);
    if (last !== r.keyIngredientId) problems.push(`COHORT_UNLOCK: ${r.recipeId} unlocks on ${last}, manifest key ${r.keyIngredientId}`);
  }

  // Explicit declarations, checked against the data (never inferred from an absent field).
  for (const r of manifest.recipes) {
    for (const field of ["ladderCredit", "lunchRush", "cut", "hint"] as const) {
      if (r[field] === undefined) problems.push(`DECLARATION_MISSING: ${r.recipeId}.${field}`);
    }
    if (r.lunchRush !== undefined && view.lunchRush(r.recipeId) !== r.lunchRush) problems.push(`LUNCH_RUSH_MISMATCH: ${r.recipeId} declared ${r.lunchRush}`);
    if (r.ladderCredit !== undefined && view.ladderCredit(r.recipeId) !== r.ladderCredit) problems.push(`LADDER_CREDIT_MISMATCH: ${r.recipeId} declared ${r.ladderCredit}`);
    if (r.cut !== undefined && view.isCutEligible(r.recipeId) !== r.cut) problems.push(`CUT_MISMATCH: ${r.recipeId} declared ${r.cut}`);
    if (r.hint !== undefined && view.keyFreeHint(r.recipeId) !== (r.hint === "key-free")) problems.push(`HINT_MISMATCH: ${r.recipeId} declared ${r.hint}`);
  }
  return problems;
}
