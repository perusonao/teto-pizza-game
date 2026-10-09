import type { DexEntry } from "../state/dex";
import { onboardingRecipeId, type EditorCatalog } from "./editorCatalog";

/** The ladder as the editor catalog carries it (read only through ./editorCatalog.ts, the sanctioned bridge). */
type Ladder = EditorCatalog["ladder"];
import { canonicalSaveObject, normalizeEditableState, freshEditableState, type EditableState } from "./stateModel";

/**
 * DEV State Editor (Issue #441): the star-state presets (the Dex BEST stars at / just below a `starGates` threshold).
 *
 * Nothing here names a threshold, a material or a recipe of the shipped game. The thresholds are read from the ladder
 * (`MaterialProgressionStep.starGates`, the authority of Batch 6 / #420), the Dex that reaches the gated step is
 * derived the way the other presets derive a step, and the stars are spread by `distributeStars`. The result goes
 * through `normalizeEditableState`, so the Shop entitlement is what the game derives on load, and the preset never
 * writes a field the game would rewrite. Stars are NOT a save field: `totalStars(dex)` is the sum of the Dex rows.
 */

export const STAR_MIN = 1;
export const STAR_MAX = 5;
/** The Pitz and finite stock the star presets give (the same values the other presets give). */
export const STAR_PRESET_PITZ = 300;
export const STAR_PRESET_STOCK = 10;

/**
 * A score inside each star band of `starsFromTotal` (src/logic/scoring.ts), so a row's `bestScore` agrees with its
 * `bestStars`. A test pins every entry to the real scoring function.
 */
export const SCORE_FOR_STARS: Readonly<Record<number, number>> = { 1: 30, 2: 50, 3: 70, 4: 80, 5: 95 };

export interface StarGate {
  /** The accumulated-star threshold. */
  gate: number;
  /** The ladder step the gated material belongs to (the step must be reached too). */
  step: number;
  ingredientId: string;
}

/** Every `starGates` entry of the ladder, ascending by threshold, then step, then ingredient order. */
export function starGatesOf(ladder: Ladder): StarGate[] {
  const gates: StarGate[] = [];
  for (const step of ladder.steps) {
    for (const [ingredientId, gate] of Object.entries(step.starGates ?? {})) gates.push({ gate, step: step.step, ingredientId });
  }
  return gates.sort((a, b) => a.gate - b.gate || a.step - b.step || (a.ingredientId < b.ingredientId ? -1 : 1));
}

export interface StarTarget {
  /** The accumulated stars the preset stands for. */
  stars: number;
  /** The gate this target is the "just below" or "at" side of. */
  gate: StarGate;
  side: "below" | "at";
}

/** For each distinct threshold `g`: `g - 1` (just below) and `g` (at). Ascending, no duplicates. */
export function starTargetsOf(ladder: Ladder): StarTarget[] {
  const out: StarTarget[] = [];
  const seen = new Set<number>();
  for (const gate of starGatesOf(ladder)) {
    for (const [stars, side] of [[gate.gate - 1, "below"], [gate.gate, "at"]] as const) {
      if (stars < STAR_MIN || seen.has(stars)) continue;
      seen.add(stars);
      out.push({ stars, gate, side });
    }
  }
  return out;
}

/**
 * Spreads `target` stars over `count` recipes, deterministically and as evenly as possible: every recipe starts at
 * STAR_MIN, then one star at a time goes round the list in order (the first recipes get the remainder), never past
 * STAR_MAX. The sum is exactly `target`; the same input always gives the same output. Out of range throws.
 */
export function distributeStars(count: number, target: number): number[] {
  if (!Number.isInteger(count) || count < 0) throw new Error(`distributeStars: invalid recipe count ${count}`);
  if (!Number.isInteger(target) || target < count * STAR_MIN || target > count * STAR_MAX) {
    throw new Error(`distributeStars: ${target} stars cannot be spread over ${count} recipes (${count * STAR_MIN}..${count * STAR_MAX})`);
  }
  const base = Math.floor(target / count || 0);
  const remainder = count === 0 ? 0 : target - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

function dexRow(recipeId: string, stars: number): DexEntry {
  return { recipeId, discovered: true, bestScore: SCORE_FOR_STARS[stars], bestStars: stars as DexEntry["bestStars"], timesMade: 1 };
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/**
 * The state with `target` Dex BEST stars, at the ladder step of the nearest gate at or above `target`:
 * - the Dex holds the onboarding recipe + the key recipe of every earlier step (the ladder's own derivation), which is
 *   the number of recipes the step needs to be reached,
 * - the materials of the earlier steps are owned and stocked, except the star-gated ones (those are entitled by the
 *   stars alone, so the Shop shows them as NEW and unbought),
 * - the stars are `distributeStars` over the Dex in catalog order.
 * Fails loudly when the catalog has no gate at or above `target`, or the step cannot be reached from the ladder's own Dex.
 */
export function buildStarState(catalog: EditorCatalog, target: number): EditableState {
  const targets = starTargetsOf(catalog.ladder);
  const entry = targets.find((t) => t.stars === target);
  if (!entry) throw new Error(`the catalog has no star-gate target of ${target} stars`);
  const stepNumber = entry.gate.step;
  const index = catalog.ladder.steps.findIndex((s) => s.step === stepNumber);
  const earlier = catalog.ladder.steps.slice(0, index);
  const onboarding = onboardingRecipeId(catalog);
  const dexIds = unique([...(onboarding ? [onboarding] : []), ...earlier.map((s) => s.keyRecipeId)]);
  const credited = dexIds.filter((id) => catalog.countsTowardLadder(id)).length;
  if (credited < stepNumber) throw new Error(`step ${stepNumber} is not reached by the ladder's own Dex (${credited} credited recipes)`);

  const gated = new Set(starGatesOf(catalog.ladder).map((g) => g.ingredientId));
  const owned = unique(earlier.flatMap((s) => s.ingredientIds)).filter((id) => !gated.has(id));
  const stars = distributeStars(dexIds.length, target);
  const starters = [...catalog.starterIds];
  const fresh: EditableState = { ...freshEditableState(), ownedIngredientIds: starters };
  return normalizeEditableState(
    {
      ...fresh,
      dex: dexIds.map((id, i) => dexRow(id, stars[i])),
      pitzBalance: STAR_PRESET_PITZ,
      ownedIngredientIds: [...starters, ...owned],
      inventory: Object.fromEntries(owned.map((id) => [id, STAR_PRESET_STOCK])),
    },
    catalog,
  );
}

/**
 * The canonical save OBJECT of a star state: what the editor applies (`applyEditableState` merges it into the stored
 * save) and what an E2E writes as its starting save. One builder for both, so they cannot drift apart. It is the
 * authority's own writer's output (`canonicalSaveObject`), never a hand-built JSON.
 */
export function starSaveObject(catalog: EditorCatalog, target: number): Record<string, unknown> {
  const save = canonicalSaveObject(buildStarState(catalog, target));
  if (save === null) throw new Error(`the ${target}-star state is the default save`);
  return save;
}
