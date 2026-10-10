import type { DexEntry } from "../state/dex";
import { onboardingRecipeId, type EditorCatalog } from "./editorCatalog";
import { canonicalSaveObject, normalizeEditableState, freshEditableState, type EditableState } from "./stateModel";

/** The ladder as the editor catalog carries it (read only through ./editorCatalog.ts, the sanctioned bridge). */
type Ladder = EditorCatalog["ladder"];

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

/** One gate a star target stands next to: `at` = the target reaches it, `below` = the target is one star short of it. */
export interface StarTargetGate {
  gate: StarGate;
  side: "below" | "at";
}

export interface StarTarget {
  /** The accumulated stars the preset stands for. */
  stars: number;
  /**
   * EVERY gate this star count stands for, in gate order. One count can stand for several: equal thresholds (both are
   * "at" / "below" it), or adjacent ones (`g` is the "at" of one gate and the "below" of the gate at `g + 1`).
   */
  gates: StarTargetGate[];
  /** The ladder step the state must reach: the highest step of the gates it stands for (a lower one would leave a represented material step-locked). */
  step: number;
}

/**
 * The CANDIDATE targets of a ladder: for each distinct threshold `g`, `g - 1` (just below) and `g` (at), ascending by
 * stars, one entry per star count that keeps ALL the gates it stands for (`step` = the highest of their steps). A count
 * below STAR_MIN (a Dex row holds at least one star) is not a target. Candidates are not yet checked against the Dex a
 * catalog can build: `planStarState` / `buildableStarTargets` keep only the gates (and targets) that can be built.
 */
export function starTargetsOf(ladder: Ladder): StarTarget[] {
  const byStars = new Map<number, StarTargetGate[]>();
  const add = (stars: number, entry: StarTargetGate) => {
    if (stars < STAR_MIN) return;
    byStars.set(stars, [...(byStars.get(stars) ?? []), entry]);
  };
  for (const gate of starGatesOf(ladder)) {
    add(gate.gate - 1, { gate, side: "below" });
    add(gate.gate, { gate, side: "at" });
  }
  return [...byStars]
    .sort(([a], [b]) => a - b)
    .map(([stars, gates]) => ({ stars, gates, step: Math.max(...gates.map((g) => g.gate.step)) }));
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

export type StarStatePlan =
  | { ok: true; target: StarTarget; dexIds: string[]; earlier: Ladder["steps"][number][] }
  | { ok: false; reason: string };

type DexPlan = { ok: true; dexIds: string[]; earlier: Ladder["steps"][number][] } | { ok: false; reason: string };

/**
 * The Dex that reaches ladder step `step` (the ladder's own derivation: the onboarding recipe + the key recipe of every
 * step BEFORE it) and whether it is valid for `stars`: the step must be reachable (`credited >= step`) and the stars must
 * fit the Dex (1..5 per row).
 */
function dexPlanForStep(catalog: EditorCatalog, step: number, stars: number): DexPlan {
  const earlier = [...catalog.ladder.steps].filter((s) => s.step < step).sort((a, b) => a.step - b.step);
  const onboarding = onboardingRecipeId(catalog);
  const dexIds = unique([...(onboarding ? [onboarding] : []), ...earlier.map((s) => s.keyRecipeId)]);
  const credited = dexIds.filter((id) => catalog.countsTowardLadder(id)).length;
  if (credited < step) return { ok: false, reason: `${stars} stars: step ${step} is not reached by the ladder's own Dex (${credited} credited recipes)` };
  if (stars < dexIds.length * STAR_MIN || stars > dexIds.length * STAR_MAX) {
    return { ok: false, reason: `${stars} stars cannot be held by the ${dexIds.length} recipes step ${step} needs (${dexIds.length * STAR_MIN}..${dexIds.length * STAR_MAX})` };
  }
  return { ok: true, dexIds, earlier };
}

/**
 * What a star target needs and whether the ladder's own Dex can supply it. The FINAL STATE is the standard:
 * 1. the final step is the highest step among the represented gates whose own step can be built with these stars
 *    (`dexPlanForStep`); none = the target is unreachable and is not offered;
 * 2. every represented gate whose step the final state has reached (`gate.step <= final step`) is kept, whether or not its
 *    OWN step could hold the stars: in the final state it is reached, so the stars alone decide it (`at` = unlocked,
 *    `below` = still locked, by the game's own entitlement rule);
 * 3. a represented gate above the final step is not reached in the final state and is not kept.
 * The Dex is the final step's, valid for the stars by construction (it is the Dex of one of the seeding gates).
 */
export function planStarState(catalog: EditorCatalog, stars: number): StarStatePlan {
  const candidate = starTargetsOf(catalog.ladder).find((t) => t.stars === stars);
  if (!candidate) return { ok: false, reason: `the catalog has no star-gate target of ${stars} stars` };
  const seeds = candidate.gates.filter((g) => dexPlanForStep(catalog, g.gate.step, stars).ok);
  if (seeds.length === 0) {
    const first = dexPlanForStep(catalog, candidate.step, stars);
    return { ok: false, reason: first.ok ? `${stars} stars: no gate of this count can be built` : first.reason };
  }
  const step = Math.max(...seeds.map((g) => g.gate.step));
  const plan = dexPlanForStep(catalog, step, stars);
  if (!plan.ok) return { ok: false, reason: plan.reason };
  const kept = candidate.gates.filter((g) => g.gate.step <= step);
  return { ok: true, target: { stars, gates: kept, step }, dexIds: plan.dexIds, earlier: plan.earlier };
}

/** The star targets of the catalog that `buildStarState` can build, with only the gates that were kept (the presets the editor lists). */
export function buildableStarTargets(catalog: EditorCatalog): StarTarget[] {
  return starTargetsOf(catalog.ladder).flatMap((t) => {
    const plan = planStarState(catalog, t.stars);
    return plan.ok ? [plan.target] : [];
  });
}

/**
 * The state with `target` Dex BEST stars, at the ladder step the target needs (`StarTarget.step`):
 * - the Dex is the plan's (onboarding + the key recipe of every earlier step),
 * - the materials of the earlier steps are owned and stocked, except the star-gated ones (those are entitled by the
 *   stars alone, so the Shop shows them as NEW and unbought),
 * - the stars are `distributeStars` over the Dex in catalog order.
 * The Shop entitlement is the game's own derivation (`normalizeEditableState`): a material whose gate the stars do not
 * reach stays locked whatever step is reached. Fails loudly when the target is not buildable (`planStarState`).
 */
export function buildStarState(catalog: EditorCatalog, target: number): EditableState {
  const plan = planStarState(catalog, target);
  if (!plan.ok) throw new Error(plan.reason);
  const gated = new Set(starGatesOf(catalog.ladder).map((g) => g.ingredientId));
  const owned = unique(plan.earlier.flatMap((s) => s.ingredientIds)).filter((id) => !gated.has(id));
  const stars = distributeStars(plan.dexIds.length, target);
  const starters = [...catalog.starterIds];
  const fresh: EditableState = { ...freshEditableState(), ownedIngredientIds: starters };
  return normalizeEditableState(
    {
      ...fresh,
      dex: plan.dexIds.map((id, i) => dexRow(id, stars[i])),
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
