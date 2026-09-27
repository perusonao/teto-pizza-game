/**
 * Discovery Hint 4.0 DH4-2A (Issue #253): the audited player model, ported from
 * tools/dh4_2_topping_count_audit.py (audit commit 2f0ffaa) so the privacy invariants of the DH4-2
 * partition guard are tested on the real TypeScript modules. Test/analysis support only.
 *
 * Player model (worst case, a smart player):
 * - The player knows K (the free key + the material facts they bought) and assumes every pizza has
 *   exactly one sauce (true for all 25 runtime recipes).
 * - N (the ingredient total) is known whenever it is modelled: bought, or free through near-miss
 *   ADD_ONE on a pizza made of exactly the known facts.
 * - A hypothesis is a set U of owned, unknown ingredients such that K + U fits every given fact.
 *   An ingredient is FORCED when it is in every hypothesis: the player can name it.
 * - Level inversion: at the endgame (every ingredient but the reserve known) the player tests every
 *   hypothetical reserve x: "would x have produced what I observed?". A name leak is an observation
 *   that only the real reserve can produce.
 */
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../../data/ingredients";
import { ingredientAttributeFamily, ingredientAttributeGroup } from "../../../data/ingredientTaxonomy";
import { RECIPES } from "../../../data/recipes";
import { attributeAnswerForReserve, type ReserveAttributeAnswer } from "../deductionHint";
import {
  guardedAnswerForParts,
  hypotheticalParts,
  hypotheticalReserves,
  targetReserveParts,
  toppingClauseAllowedForParts,
  type ReserveParts,
} from "../deductionGuard";
import { buildSelectableHintModel } from "../selectableHint";

/** The part of a Discovery Ladder the sweep reads (structurally `DiscoveryLadder`). */
export interface SweepLadder {
  steps: readonly { step: number; ingredientIds: readonly string[]; keyRecipeId: string }[];
}

export interface SweepState {
  recipeId: string;
  /** Ladder index of the target (1..24). */
  targetIndex: number;
  /** The ladder step whose owned set is used (targetIndex..24): a Dex-pinned or late target. */
  step: number;
  owned: string[];
}

export const ALL_INGREDIENT_IDS: readonly string[] = INGREDIENTS.map((i) => i.id);

export function ladderTargets(ladder: SweepLadder): string[] {
  return ["margherita", ...ladder.steps.map((s) => s.keyRecipeId)];
}

export function ownedAt(step: number, ladder: SweepLadder): string[] {
  return [...STARTER_INGREDIENT_IDS, ...ladder.steps.filter((s) => s.step <= step).flatMap((s) => [...s.ingredientIds])];
}

/** The 300-state sweep: each of the 24 targets at its own ladder step and every later one. */
export function sweepStates(ladder: SweepLadder): SweepState[] {
  const targets = ladderTargets(ladder);
  const last = ladder.steps.length;
  const out: SweepState[] = [];
  targets.forEach((recipeId, targetIndex) => {
    if (targetIndex === 0) return;
    for (let step = targetIndex; step <= last; step += 1) out.push({ recipeId, targetIndex, step, owned: ownedAt(step, ladder) });
  });
  return out;
}

export function partsOf(state: SweepState): ReserveParts {
  return targetReserveParts(state.recipeId, { discoveredCount: state.step, ownedIngredientIds: state.owned })!;
}

// ---- observations -------------------------------------------------------------------------------

export type Observation = (parts: ReserveParts) => string;

const answerKey = (a: ReserveAttributeAnswer | null) => (a ? a.factId : "none");

export const observeDh41: Observation = (parts) =>
  answerKey(attributeAnswerForReserve({ recipeIngredientIds: parts.recipeIngredientIds, reserveId: parts.reserveId, ownedIngredientIds: parts.owned }));

export const observeGuarded: Observation = (parts) => answerKey(guardedAnswerForParts(parts));

const toppingTotal = (ids: readonly string[]) => ids.filter((id) => getIngredient(id)?.category === "topping").length;

/** The guarded answer plus what the structure answer shows (clause told or not, and its value). */
export const observeGuardedWithClause: Observation = (parts) => {
  const allowed = toppingClauseAllowedForParts(parts);
  return `${observeGuarded(parts)}|${allowed ? `T${toppingTotal(parts.recipeIngredientIds)}` : "noT"}`;
};

/** The hypothetical reserves whose observation equals the real one. Fewer than 2 = a name leak. */
export function inversionCandidates(
  parts: ReserveParts,
  observe: Observation,
  universe: (parts: ReserveParts) => string[] = hypotheticalReserves,
): string[] {
  const seen = observe(parts);
  return universe(parts).filter((x) => observe(hypotheticalParts(parts, x)) === seen);
}

// ---- closure / forced-ingredient model (the combined inference test) ------------------------------

type Category = "sauce" | "cheese" | "topping";

function cat(id: string): Category {
  return getIngredient(id)!.category as Category;
}

function matches(answer: ReserveAttributeAnswer, id: string): boolean {
  switch (answer.level) {
    case "family":
      return cat(id) === "topping" && ingredientAttributeFamily(id) === answer.family;
    case "group":
      return cat(id) === "topping" && ingredientAttributeGroup(id) === answer.group;
    case "category":
      return cat(id) === answer.category;
    case "existence":
      return true;
  }
}

function combinations<T>(pool: readonly T[], k: number): T[][] {
  if (k < 0 || k > pool.length) return [];
  if (k === 0) return [[]];
  const out: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < pool.length; i += 1) {
      acc.push(pool[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

export interface Facts {
  N?: number;
  T?: number;
  A?: ReserveAttributeAnswer;
}

/** The ingredients every hypothesis contains (the player can name them). */
export function forcedIngredients(owned: readonly string[], known: ReadonlySet<string>, facts: Facts): Set<string> {
  const unknown = [...new Set(owned)].filter((id) => !known.has(id) && getIngredient(id));
  const pools: Record<Category, string[]> = { sauce: [], cheese: [], topping: [] };
  for (const id of unknown) pools[cat(id)].push(id);
  const knownCount = (c: Category) => [...known].filter((id) => cat(id) === c).length;
  const sauceNeed = knownCount("sauce") >= 1 ? 0 : 1;
  if (sauceNeed > pools.sauce.length) return new Set();
  const aOk = (u: readonly string[]) => !facts.A || (facts.A.level === "existence" ? u.length > 0 : u.some((id) => matches(facts.A!, id)));

  if (facts.N === undefined && facts.T === undefined) {
    // Topping subsets are unconstrained: only a single-candidate attribute or sauce can be forced.
    const forced = new Set<string>();
    if (sauceNeed === 1 && pools.sauce.length === 1) forced.add(pools.sauce[0]);
    if (facts.A) {
      const cand = unknown.filter((id) => facts.A!.level === "existence" || matches(facts.A!, id));
      if (cand.length === 1) forced.add(cand[0]);
    }
    return forced;
  }

  const hypotheses: string[][] = [];
  const tRange = facts.T !== undefined ? [facts.T - knownCount("topping")] : [...Array(pools.topping.length + 1).keys()];
  for (const t of tRange) {
    if (t < 0 || t > pools.topping.length) continue;
    const cRange = facts.N !== undefined ? [facts.N - known.size - sauceNeed - t] : [...Array(pools.cheese.length + 1).keys()];
    for (const c of cRange) {
      if (c < 0 || c > pools.cheese.length) continue;
      for (const su of combinations(pools.sauce, sauceNeed))
        for (const cu of combinations(pools.cheese, c))
          for (const tu of combinations(pools.topping, t)) {
            const u = [...su, ...cu, ...tu];
            if (aOk(u)) hypotheses.push(u);
          }
    }
  }
  if (hypotheses.length === 0) return new Set();
  return new Set(hypotheses[0].filter((id) => hypotheses.every((u) => u.includes(id))));
}

/** Every purchase state the player can reach: the key plus a per-category prefix of sellable facts. */
export function reachableKnownSets(state: SweepState): Set<string>[] {
  const model = buildSelectableHintModel(state.recipeId, { discoveredCount: state.step })!;
  const byCat = new Map<Category, string[]>();
  for (const f of model.purchasableFacts) byCat.set(f.category as Category, [...(byCat.get(f.category as Category) ?? []), f.ingredientId]);
  const cats = [...byCat.keys()];
  const out: Set<string>[] = [];
  const walk = (i: number, acc: string[]) => {
    if (i === cats.length) {
      out.push(new Set([...model.freeFacts.map((f) => f.ingredientId), ...acc]));
      return;
    }
    const list = byCat.get(cats[i])!;
    for (let n = 0; n <= list.length; n += 1) walk(i + 1, [...acc, ...list.slice(0, n)]);
  };
  walk(0, []);
  return out;
}

/** Recipe-level helpers for the tests. */
export function recipeCounts(recipeId: string): { total: number; toppings: number } {
  const ids = [...new Set(RECIPES.find((r) => r.id === recipeId)!.requiredIngredients.map((r) => r.ingredientId))];
  return { total: ids.length, toppings: toppingTotal(ids) };
}
