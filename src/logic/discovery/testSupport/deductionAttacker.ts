/**
 * Discovery Hint 4.0 (Issue #253), DH4-2B Pre-Implementation Gate: an INDEPENDENT attacker model
 * for the 特徴 / 構成 privacy guard. Test/analysis support only.
 *
 * Independence: this module never reads the guard's own hypothesis sets (`hypotheticalReserves`,
 * `privacyPartitionUniverse`, `hypotheticalParts`). It enumerates the reserve candidates itself,
 * from what a player can observe, and only calls the system's player-facing outputs (the guarded
 * answer and the TC-G decision) as the black box under attack.
 *
 * Observable facts: the owned ingredients O; the known part K (the free key + bought material
 * facts); the ingredient total N; the topping clause (told with its value, or not told); the guarded
 * attribute outcome (an informative fact id, or the existence outcome); the public catalog
 * (categories, taxonomy, the Discovery Ladder) and the public rules (Rule W: the reserve is in the
 * highest category among the non-key ingredients, topping > cheese > sauce; the free key is the
 * ingredient with the recipe's key step, so nothing unlocked later than it is in the recipe).
 *
 * No one-sauce prior is assumed by the base universe. Stronger attackers add a public prior
 * (category-defined): the candidate set is narrowed by it, and a leak is counted only when the prior
 * holds for the real recipe (a refuted prior names nothing).
 */
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../../data/ingredients";
import { ingredientCategory } from "../ingredientCategoryIndex";
import type { Recipe } from "../../../data/recipes";
import type { ReserveAttributeAnswer } from "../deductionHint";
import type { ReserveParts } from "../deductionGuard";
import { recipeKeyStep } from "../../../state/recipeChapters";
import { hintKeyIngredientId } from "../hintSteps";

const STARTERS = new Set(STARTER_INGREDIENT_IDS);

export type Category = "sauce" | "cheese" | "topping";
const RANK: Readonly<Record<Category, number>> = { sauce: 0, cheese: 1, topping: 2 };

export function categoryOf(id: string): Category | null {
  return (ingredientCategory(id) as Category | undefined) ?? null;
}

/** The system under attack: its player-facing outputs for any (real or hypothetical) parts. */
export interface GuardUnderAttack {
  answer: (parts: ReserveParts) => ReserveAttributeAnswer | null;
  clauseAllowed: (parts: ReserveParts) => boolean;
}

export interface AttackState {
  /** Every distinct ingredient of the real recipe. */
  recipeIngredientIds: readonly string[];
  reserveId: string;
  keyId: string | null;
  owned: readonly string[];
}

export function attackStateOf(recipe: Recipe, reserveId: string, owned: readonly string[]): AttackState {
  return {
    recipeIngredientIds: [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))],
    reserveId,
    keyId: hintKeyIngredientId(recipe),
    owned: [...new Set(owned)].filter((id) => categoryOf(id) !== null),
  };
}

const toppings = (ids: readonly string[]) => ids.filter((id) => categoryOf(id) === "topping").length;

/** What a player observes after buying 構成 and 特徴 (the joint observation). */
export function observe(guard: GuardUnderAttack, parts: ReserveParts): string {
  const a = guard.answer(parts);
  const clause = guard.clauseAllowed(parts) ? `T${toppings(parts.recipeIngredientIds)}` : "noT";
  return `${a ? a.factId : "none"}|${clause}`;
}

export function observeAnswerOnly(guard: GuardUnderAttack, parts: ReserveParts): string {
  const a = guard.answer(parts);
  return a ? a.factId : "none";
}

/** A public prior an attacker may hold: may x be the reserve, given K and the key? */
export type Prior = { name: string; allows: (x: string, known: readonly string[], keyId: string | null) => boolean };

const knownHasSauce = (known: readonly string[]) => known.some((id) => categoryOf(id) === "sauce");

/** The key step one ingredient gives on its own (the free-key rule, `hintKeyIngredientId`). */
export function keyStepOf(id: string): number {
  return recipeKeyStep({ requiredIngredients: [{ ingredientId: id }] } as unknown as Recipe);
}

type Allows = Prior["allows"];
// Rule W: the reserve is in the highest category among the non-key ingredients.
const ruleW: Allows = (x, known, keyId) => {
  const top = Math.max(...[...known, x].filter((id) => id !== keyId).map((id) => RANK[categoryOf(id)!]));
  return x !== keyId && RANK[categoryOf(x)!] === top;
};
// The free key is the ingredient with the recipe's key step: x may not be unlocked after the key.
const keyRule: Allows = (x, _known, keyId) => keyStepOf(x) <= (keyId === null ? 0 : keyStepOf(keyId));
// Every pizza has exactly one sauce (true for the 25 runtime recipes).
const oneSauce: Allows = (x, known) => (categoryOf(x) === "sauce") !== knownHasSauce(known);
const notOneSauce: Allows = (x, known) => (categoryOf(x) === "sauce") === knownHasSauce(known);
const inCategory = (c: Category): Allows => (x) => categoryOf(x) === c;
const both = (a: Allows, b: Allows): Allows => (x, k, key) => a(x, k, key) && b(x, k, key);
const structural = both(ruleW, keyRule);

export const PRIORS: readonly Prior[] = [
  { name: "none", allows: () => true },
  { name: "one-sauce", allows: oneSauce },
  { name: "not-one-sauce", allows: notOneSauce },
  { name: "rule-w", allows: ruleW },
  { name: "key-rule", allows: keyRule },
  { name: "rule-w+key", allows: structural },
  { name: "rule-w+key+one-sauce", allows: both(structural, oneSauce) },
  { name: "rule-w+key+not-one-sauce", allows: both(structural, notOneSauce) },
  // The strongest category prior: the reserve's category is known (e.g. from T and N).
  ...(["sauce", "cheese", "topping"] as const).flatMap((c) => [
    { name: `category:${c}`, allows: inCategory(c) },
    { name: `rule-w+key+category:${c}`, allows: both(structural, inCategory(c)) },
  ]),
];

export interface EndgameResult {
  prior: string;
  /** The prior's candidates before the observation. */
  before: number;
  /** Candidates left after the observation (the real reserve included when the prior holds). */
  candidates: string[];
  priorHolds: boolean;
  leak: boolean;
}

/**
 * The endgame attacker: K = every ingredient but the reserve (bought facts + key), N known.
 * Candidates = owned catalog ingredients outside K (any category) allowed by the prior, whose
 * hypothetical recipe K + x (reserve x) produces the same observation as the real one.
 */
export function endgameAttack(
  guard: GuardUnderAttack,
  state: AttackState,
  observation: (guard: GuardUnderAttack, parts: ReserveParts) => string = observe,
  options: { onsetAware?: boolean } = {},
): EndgameResult[] {
  const known = state.recipeIngredientIds.filter((id) => id !== state.reserveId);
  const partsFor = (x: string): ReserveParts => ({ recipeIngredientIds: [...known, x], reserveId: x, keyId: state.keyId, owned: state.owned });
  const seen = observation(guard, partsFor(state.reserveId));
  // Hint targets are DISCOVERABLE (every ingredient owned), so an attacker assumes the reserve is
  // owned. An input whose reserve is NOT owned breaks that precondition: that attacker then has to
  // consider every catalog ingredient outside K.
  const reserveOwned = state.owned.includes(state.reserveId);
  const pool = reserveOwned ? state.owned : INGREDIENTS.map((i) => i.id);
  let universe = pool.filter((id) => !known.includes(id));
  // Owner Decision T1a threat model (worst case): the player knows WHEN the target became makeable
  // (the Dex card / HOME show it; purchases are the player's own history). A hypothesis x is only
  // possible if K + x would have become makeable at that same moment.
  if ((options.onsetAware ?? true) && reserveOwned) {
    const onset = makeableMoment(state.owned, state.recipeIngredientIds);
    universe = universe.filter((x) => makeableMoment(state.owned, [...known, x]) === onset);
  }
  const obs = new Map(universe.map((x) => [x, observation(guard, partsFor(x))]));
  return PRIORS.map((prior) => {
    const priorHolds = prior.allows(state.reserveId, known, state.keyId);
    const allowed = universe.filter((x) => prior.allows(x, known, state.keyId));
    const candidates = allowed.filter((x) => obs.get(x) === seen);
    // A prior that alone leaves < 2 candidates names the reserve without any Deduction Hint (Hint 3.0
    // paid inference, or the makeable moment itself); the hint leaks only when it narrows >= 2 to 1.
    return { prior: prior.name, before: allowed.length, candidates, priorHolds, leak: priorHolds && allowed.length >= 2 && candidates.length < 2 };
  });
}

/** The acquisition index at which `ids` were all owned (`owned` is in acquisition order), or -1. */
export function makeableMoment(owned: readonly string[], ids: readonly string[]): number {
  // The starters are owned together from the start: they all count as acquired at the same moment.
  let last = owned.filter((id) => STARTERS.has(id)).length - 1;
  for (const id of ids) {
    const i = owned.indexOf(id);
    if (i < 0) return -1;
    last = Math.max(last, i);
  }
  return last;
}

/** The reserve was the last recipe ingredient acquired: the purchase that made the target makeable. */
export function reserveAcquiredLast(state: AttackState): boolean {
  const known = state.recipeIngredientIds.filter((id) => id !== state.reserveId);
  return makeableMoment(state.owned, known) < state.owned.indexOf(state.reserveId);
}

export interface PartialResult {
  /** Distinct reserve ids some consistent hypothesis can have (the search stops at 2: enough to
   *  prove there is no leak). */
  reserveCandidates: string[];
  leak: boolean;
}

/**
 * The partial-knowledge attacker: K is any subset of the known part (always containing the key).
 * A hypothesis is (U, r): U = owned unknown ingredients with |K| + |U| = N that keep the known key
 * the key and the observed makeable moment, r in U a Rule W-consistent reserve, such that the system's joint observation for (K + U, r) equals the real one. No sauce
 * prior. A leak is a single possible reserve.
 */
export function partialAttack(guard: GuardUnderAttack, state: AttackState, known: readonly string[]): PartialResult {
  const n = state.recipeIngredientIds.length;
  const realKnown = state.recipeIngredientIds.filter((id) => id !== state.reserveId);
  const realParts: ReserveParts = { recipeIngredientIds: [...realKnown, state.reserveId], reserveId: state.reserveId, keyId: state.keyId, owned: state.owned };
  const seen = observe(guard, realParts);
  // The free key is public: an unknown ingredient unlocked after it would have been the key.
  const keyStep = state.keyId === null ? 0 : keyStepOf(state.keyId);
  const pool = state.owned.filter((id) => !known.includes(id) && keyStepOf(id) <= keyStep);
  const onset = makeableMoment(state.owned, state.recipeIngredientIds);
  const reserves = new Set<string>();
  const tried = new Set<string>();
  // Cheapest first: the real reserve's own hypotheses are consistent by construction, so look for a
  // second reserve r' != real one and stop as soon as one is found.
  reserves.add(state.reserveId);
  const need = n - known.length;
  const walk = (start: number, acc: string[]): boolean => {
    if (acc.length === need) {
      const recipe = [...known, ...acc];
      // Onset-aware (T1a): the hypothetical recipe must have become makeable at the observed moment.
      if (makeableMoment(state.owned, recipe) !== onset) return false;
      const top = Math.max(...recipe.filter((id) => id !== state.keyId).map((id) => RANK[categoryOf(id)!]));
      for (const r of acc) {
        if (reserves.has(r) || r === state.keyId || RANK[categoryOf(r)!] !== top) continue;
        const knownPart = recipe.filter((id) => id !== r).sort();
        const key = `${knownPart.join(",")}>${r}`;
        if (tried.has(key)) continue;
        tried.add(key);
        if (observe(guard, { recipeIngredientIds: [...knownPart, r], reserveId: r, keyId: state.keyId, owned: state.owned }) === seen) {
          reserves.add(r);
          return true;
        }
      }
      return false;
    }
    for (let i = start; i < pool.length; i += 1) {
      acc.push(pool[i]);
      const done = walk(i + 1, acc);
      acc.pop();
      if (done) return true;
    }
    return false;
  };
  walk(0, []);
  return { reserveCandidates: [...reserves], leak: reserves.size < 2 };
}

/**
 * The purchase-timing attacker (independent review of PR #267, P1-1; OPEN, pending an Owner
 * Decision). A player who saw the target (its free key chip, a Dex pin) before buying `lateIds`
 * knows those ingredients are not the reserve: the target was already makeable without them. The
 * endgame attacker with that knowledge simply drops them from its candidates.
 */
export function timingAttack(guard: GuardUnderAttack, state: AttackState, lateIds: readonly string[]): EndgameResult[] {
  const late = new Set(lateIds);
  return endgameAttack(guard, state).map((r) => {
    const candidates = r.candidates.filter((id) => !late.has(id));
    const before = r.before - lateIds.length;
    return { ...r, candidates, before, leak: r.priorHolds && !late.has(state.reserveId) && before >= 2 && candidates.length < 2 };
  });
}
