import type { DexEntry } from "../state/dex";
import { finiteIngredientIds, onboardingRecipeId, productionCatalog, type EditorCatalog } from "./editorCatalog";
import { buildStarState, starTargetsOf } from "./starStates";
import { freshEditableState, normalizeEditableState, type EditableState } from "./stateModel";

/**
 * DEV State Editor (Issue #403) S1: the presets.
 *
 * Every preset is DERIVED from the catalog (./editorCatalog.ts): the ladder order, the starters, the finite
 * ingredients, the recipes. No recipe / ingredient id and no recipe / ingredient count is written here, so a
 * grown catalog (ladder is append-only, LAD-1) changes the presets by itself. Each result is run through
 * `normalizeEditableState`, so the derived parts (Shop entitlement, technique ledger) are what the game
 * would derive on load. A test applies every preset through the real save path and reads it back.
 */

/** Owner Decision OD-4: the finite stock the all-material presets give each material (editable afterwards). */
export const PRESET_FINITE_STOCK = 10;
/** The Pitz the presets give (the same value the Hint 5.0 HV seeds use, src/preview/hvSeeds.ts). */
export const PRESET_PITZ = 300;
/** "Research Step 12": the 12th step of the Discovery Ladder (its materials open the first multi-Entry pool). */
export const RESEARCH_PRESET_STEP = 12;

export type PresetId =
  | "fresh-start"
  | "margherita-discovered"
  | "research-step12-ready"
  | "step12-abc-undiscovered"
  | "step12-b-discovered"
  | "last-step-ready"
  | "all-ingredients"
  | "all-recipes"
  | "everything-unlocked";

/** Issue #441: a star-state preset, `stars-<accumulated stars>`. Which ones exist is derived from the ladder's `starGates`. */
export type StarPresetId = `stars-${number}`;
export type AnyPresetId = PresetId | StarPresetId;

export interface PresetDefinition<Id extends AnyPresetId = PresetId> {
  id: Id;
  labelJa: string;
  descriptionJa: string;
}

export const PRESETS: readonly PresetDefinition[] = [
  { id: "fresh-start", labelJa: "Fresh Start", descriptionJa: "新規セーブ（初期状態）" },
  { id: "margherita-discovered", labelJa: "Margherita discovered", descriptionJa: "最初のピザだけ発見済み" },
  { id: "research-step12-ready", labelJa: "Research Step 12 Ready", descriptionJa: "step 12 の材料を取得する直前（Dex は step 12 到達、材料は Shop 解放済み・未取得）" },
  { id: "step12-abc-undiscovered", labelJa: "Step 12 A/B/C undiscovered", descriptionJa: "step 12 の材料を最後に取得。Research Entry の A/B/C がすべて未発見" },
  { id: "step12-b-discovered", labelJa: "Step 12 B discovered", descriptionJa: "step 12 の cohort のうち B（Brazilian Calabresa）だけ発見済み。残りは A / C のまま（letter は #402 の Research Stable Identity から導出）" },
  { id: "last-step-ready", labelJa: "Last Step Ready", descriptionJa: "最後の ladder step に到達。その step の材料は Shop 解放済み・未購入で、その材料を使うピザだけが未発見（他は全て発見済み）" },
  { id: "all-ingredients", labelJa: "All Ingredients", descriptionJa: "全材料 OWNED（finite 在庫は既定値）" },
  { id: "all-recipes", labelJa: "All Recipes", descriptionJa: "全ピザ発見済み" },
  { id: "everything-unlocked", labelJa: "Everything Unlocked", descriptionJa: "全材料 OWNED + 全ピザ発見済み + 全 Technique" },
];

/**
 * Issue #441: the star-state presets of a catalog's ladder: for each `starGates` threshold, "just below" and "at" it
 * (production: 119 / 120 / 129 / 130). They are a separate list from PRESETS because which ones exist depends on the
 * ladder: a catalog with no star gate has none (PRESETS stays the same fixed, catalog-independent list).
 */
export function starPresetsOf(catalog: EditorCatalog = productionCatalog()): PresetDefinition<StarPresetId>[] {
  return starTargetsOf(catalog.ladder).map(({ stars, gate, side }) => ({
    id: `stars-${stars}` as StarPresetId,
    labelJa: `⭐${stars}`,
    descriptionJa:
      side === "below"
        ? `累計⭐${stars}（${gate.gate}⭐の1つ手前。ladder step ${gate.step} 到達済み、⭐条件付き材料はまだ解放されない）`
        : `累計⭐${stars}（${gate.gate}⭐ちょうど。ladder step ${gate.step} 到達済み、⭐条件付き材料が Shop に解放される・未購入）`,
  }));
}

export const STAR_PRESETS: readonly PresetDefinition<StarPresetId>[] = starPresetsOf();

function isStarPresetId(id: string): id is StarPresetId {
  return /^stars-\d+$/.test(id);
}

function dexEntry(recipeId: string): DexEntry {
  return { recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 };
}

function stockOf(ids: readonly string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, PRESET_FINITE_STOCK]));
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/** Every finite material, in the order the ladder introduces them, then any finite one the ladder never names. */
export function allFiniteInLadderOrder(catalog: EditorCatalog): string[] {
  const finite = new Set(finiteIngredientIds(catalog));
  const fromLadder = catalog.ladder.steps.flatMap((s) => s.ingredientIds).filter((id) => finite.has(id));
  return unique([...fromLadder, ...finiteIngredientIds(catalog)]);
}

interface StepContext {
  /** The recipes discovered when the step is reached: the onboarding recipe + every earlier step's key recipe. */
  dexRecipeIds: string[];
  /** The materials owned before the step's own (ladder order). */
  ownedBefore: string[];
  /** The step's own materials. */
  stepMaterials: string[];
}

function stepContext(catalog: EditorCatalog, step: number): StepContext {
  const index = step - 1;
  const target = catalog.ladder.steps[index];
  if (!target) throw new Error(`the ladder has no step ${step}`);
  const earlier = catalog.ladder.steps.slice(0, index);
  const onboarding = onboardingRecipeId(catalog);
  return {
    dexRecipeIds: unique([...(onboarding ? [onboarding] : []), ...earlier.map((s) => s.keyRecipeId)]),
    ownedBefore: unique(earlier.flatMap((s) => s.ingredientIds)),
    stepMaterials: [...target.ingredientIds],
  };
}

export function buildPreset(id: AnyPresetId, catalog: EditorCatalog = productionCatalog()): EditableState {
  if (isStarPresetId(id)) return buildStarState(catalog, Number(id.slice("stars-".length)));
  // The authority's default save, with the catalog's own starters (for the production catalog they are the same).
  const starters = [...catalog.starterIds];
  const fresh: EditableState = { ...freshEditableState(), ownedIngredientIds: starters };
  const base = (patch: Partial<EditableState>): EditableState => normalizeEditableState({ ...fresh, ...patch }, catalog);
  switch (id) {
    case "fresh-start":
      return base({});
    case "margherita-discovered": {
      const onboarding = onboardingRecipeId(catalog);
      return base({ dex: onboarding ? [dexEntry(onboarding)] : [] });
    }
    case "research-step12-ready": {
      const ctx = stepContext(catalog, RESEARCH_PRESET_STEP);
      return base({
        dex: ctx.dexRecipeIds.map(dexEntry),
        pitzBalance: PRESET_PITZ,
        ownedIngredientIds: [...starters, ...ctx.ownedBefore],
        inventory: stockOf(ctx.ownedBefore),
      });
    }
    case "step12-abc-undiscovered": {
      const ctx = stepContext(catalog, RESEARCH_PRESET_STEP);
      // The step's own materials are acquired LAST: the unlock fact of a Research Entry is the finite material
      // acquired last, so the acquisition order is what makes this the step-12 cohort.
      const owned = [...ctx.ownedBefore, ...ctx.stepMaterials];
      return base({
        dex: ctx.dexRecipeIds.map(dexEntry),
        pitzBalance: PRESET_PITZ,
        ownedIngredientIds: [...starters, ...owned],
        inventory: stockOf(owned),
      });
    }
    case "step12-b-discovered": {
      // The cohort is Research Stable Identity's (#402): the letters come from the game's own derivation over the
      // step-12 state (nothing discovered yet), and "B" is the authority's second letter. Nothing here knows a
      // recipe id, a letter order or a hash: a different catalog gives a different B, and the other letters stay.
      const abc = buildPreset("step12-abc-undiscovered", catalog);
      const stepMaterials = new Set(stepContext(catalog, RESEARCH_PRESET_STEP).stepMaterials);
      const letter = catalog.researchLetter(1);
      const cohort = catalog.researchEntries(abc.dex, abc.ownedIngredientIds).filter((e) => stepMaterials.has(e.unlockIngredientId));
      const target = cohort.find((e) => e.cohortLetter === letter);
      if (!target) throw new Error(`the step-${RESEARCH_PRESET_STEP} cohort has no entry lettered ${letter}`);
      return normalizeEditableState({ ...abc, dex: [...abc.dex, dexEntry(target.recipeId)] }, catalog);
    }
    case "last-step-ready": {
      // The LAST ladder step is reached (every earlier key recipe discovered), its own materials are Shop-unlocked
      // but not bought (entitlement is derived on normalize), and the only undiscovered recipes are the ones that
      // need those materials. Nothing here names a recipe or an ingredient: the next appended step changes it.
      const ctx = stepContext(catalog, catalog.ladder.steps.length);
      const lastMaterials = new Set(ctx.stepMaterials);
      const dex = catalog.recipes.filter((r) => !r.requiredIngredients.some((q) => lastMaterials.has(q.ingredientId))).map((r) => dexEntry(r.id));
      return base({
        dex,
        pitzBalance: PRESET_PITZ,
        ownedIngredientIds: [...starters, ...ctx.ownedBefore],
        inventory: stockOf(ctx.ownedBefore),
      });
    }
    case "all-ingredients": {
      const finite = allFiniteInLadderOrder(catalog);
      return base({ pitzBalance: PRESET_PITZ, ownedIngredientIds: [...starters, ...finite], inventory: stockOf(finite) });
    }
    case "all-recipes":
      return base({ pitzBalance: PRESET_PITZ, dex: catalog.recipes.map((r) => dexEntry(r.id)) });
    case "everything-unlocked": {
      const finite = allFiniteInLadderOrder(catalog);
      return base({
        pitzBalance: PRESET_PITZ,
        dex: catalog.recipes.map((r) => dexEntry(r.id)),
        ownedIngredientIds: [...starters, ...finite],
        inventory: stockOf(finite),
        discoveredTechniqueIds: [...catalog.techniqueIds],
      });
    }
  }
}

/** `buildPreset` for an id that comes from outside (a URL, a list): an unknown id throws. A star-state id is looked up
 *  in the SUPPLIED catalog's own star presets (`starPresetsOf(catalog)`), never in the production list. */
export function buildPresetById(id: string, catalog: EditorCatalog = productionCatalog()): EditableState {
  const def = PRESETS.find((p) => p.id === id) ?? starPresetsOf(catalog).find((p) => p.id === id);
  if (!def) throw new Error(`unknown preset ${id}`);
  return buildPreset(def.id, catalog);
}
