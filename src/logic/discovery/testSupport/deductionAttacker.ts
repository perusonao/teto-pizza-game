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
 * (categories, taxonomy) and the public rules (Rule W: the reserve is in the highest category among
 * the non-key ingredients, topping > cheese > sauce; the key is known).
 *
 * No one-sauce prior is assumed by the base universe. Stronger attackers add a public prior
 * (category-defined): the candidate set is narrowed by it, and a leak is counted only when the prior
 * holds for the real recipe (a refuted prior names nothing).
 */
import { getIngredient, INGREDIENTS } from "../../../data/ingredients";
import type { Recipe } from "../../../data/recipes";
import type { ReserveAttributeAnswer } from "../deductionHint";
import type { ReserveParts } from "../deductionGuard";
import { hintKeyIngredientId } from "../hintSteps";

export type Category = "sauce" | "cheese" | "topping";
const RANK: Readonly<Record<Category, number>> = { sauce: 0, cheese: 1, topping: 2 };

export function categoryOf(id: string): Category | null {
  return (getIngredient(id)?.category as Category | undefined) ?? null;
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

/** A public, category-defined prior an attacker may hold: may x be the reserve, given K? */
export type Prior = { name: string; allows: (x: string, known: readonly string[], keyId: string | null) => boolean };

const knownHasSauce = (known: readonly string[]) => known.some((id) => categoryOf(id) === "sauce");

export const PRIORS: readonly Prior[] = [
  { name: "none", allows: () => true },
  // Every pizza has exactly one sauce (true for the 25 runtime recipes).
  { name: "one-sauce", allows: (x, known) => (categoryOf(x) === "sauce") !== knownHasSauce(known) },
  // The attacker has learned the one-sauce prior is wrong for this recipe.
  { name: "not-one-sauce", allows: (x, known) => (categoryOf(x) === "sauce") === knownHasSauce(known) },
  // Rule W: the reserve is in the highest category among the non-key ingredients.
  {
    name: "rule-w",
    allows: (x, known, keyId) => {
      const top = Math.max(...[...known, x].filter((id) => id !== keyId).map((id) => RANK[categoryOf(id)!]));
      return x !== keyId && RANK[categoryOf(x)!] === top;
    },
  },
  // The strongest category prior: the reserve's category is known (e.g. from T and N).
  ...(["sauce", "cheese", "topping"] as const).map((c) => ({ name: `category:${c}`, allows: (x: string) => categoryOf(x) === c })),
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
): EndgameResult[] {
  const known = state.recipeIngredientIds.filter((id) => id !== state.reserveId);
  const partsFor = (x: string): ReserveParts => ({ recipeIngredientIds: [...known, x], reserveId: x, keyId: state.keyId, owned: state.owned });
  const seen = observation(guard, partsFor(state.reserveId));
  // Hint targets are DISCOVERABLE (every ingredient owned), so an attacker assumes the reserve is
  // owned. An input whose reserve is NOT owned breaks that precondition: that attacker then has to
  // consider every catalog ingredient outside K.
  const pool = state.owned.includes(state.reserveId) ? state.owned : INGREDIENTS.map((i) => i.id);
  const universe = pool.filter((id) => !known.includes(id));
  const obs = new Map(universe.map((x) => [x, observation(guard, partsFor(x))]));
  return PRIORS.map((prior) => {
    const priorHolds = prior.allows(state.reserveId, known, state.keyId);
    const allowed = universe.filter((x) => prior.allows(x, known, state.keyId));
    const candidates = allowed.filter((x) => obs.get(x) === seen);
    // A prior that alone leaves < 2 candidates names the reserve without any Deduction Hint (Hint 3.0
    // paid inference); the hint leaks only when it narrows a set of >= 2 down to 1.
    return { prior: prior.name, before: allowed.length, candidates, priorHolds, leak: priorHolds && allowed.length >= 2 && candidates.length < 2 };
  });
}

export interface PartialResult {
  /** Distinct reserve ids some consistent hypothesis can have (the search stops at 2: enough to
   *  prove there is no leak). */
  reserveCandidates: string[];
  leak: boolean;
}

/**
 * The partial-knowledge attacker: K is any subset of the known part (always containing the key).
 * A hypothesis is (U, r): U = owned unknown ingredients with |K| + |U| = N, r in U a Rule W-consistent
 * reserve, such that the system's joint observation for (K + U, r) equals the real one. No sauce
 * prior. A leak is a single possible reserve.
 */
export function partialAttack(guard: GuardUnderAttack, state: AttackState, known: readonly string[]): PartialResult {
  const n = state.recipeIngredientIds.length;
  const realKnown = state.recipeIngredientIds.filter((id) => id !== state.reserveId);
  const realParts: ReserveParts = { recipeIngredientIds: [...realKnown, state.reserveId], reserveId: state.reserveId, keyId: state.keyId, owned: state.owned };
  const seen = observe(guard, realParts);
  const pool = state.owned.filter((id) => !known.includes(id));
  const reserves = new Set<string>();
  const tried = new Set<string>();
  // Cheapest first: the real reserve's own hypotheses are consistent by construction, so look for a
  // second reserve r' != real one and stop as soon as one is found.
  reserves.add(state.reserveId);
  const need = n - known.length;
  const walk = (start: number, acc: string[]): boolean => {
    if (acc.length === need) {
      const recipe = [...known, ...acc];
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
