/**
 * Discovery Hint 3.0 (Issue #238), H3-1: the Selectable Hint pure layer. UNWIRED: no reducer, save,
 * sheet or near-miss reads this module yet; Hint 2.0 / Economy 1.0 (./hintSteps.ts,
 * ./hintPurchase.ts) stay the runtime authority until later slices connect it.
 *
 * Authority: docs/reports/TETO_DISCOVERY-HINT-3_SELECTABLE_Fresh-Design.md §20 (OD-H3-1..12) and §22
 * (OD-H3-13..16).
 *
 * - A fact is one **positive** ingredient of the target: `ing:<ingredientId>`. The id is the
 *   ingredient itself, never a position (OD-H3-3). No negative fact exists: no "not used", no
 *   "that's all", no count (OD-H3-7, OD-H3-15). Every fact is a real ingredient of the recipe;
 *   none is added to reach a price total.
 * - Key ingredient: free for every target, no per-recipe exception (OD-H3-6, OD-H3-13).
 * - Rule W (OD-H3-5): one reserved ingredient per recipe is never revealed. It is the last non-key
 *   ingredient, in `requiredIngredients` order, of the highest-entropy category present
 *   (topping > cheese > sauce), the same ingredient Hint 2.0's H4 withholds. The player never
 *   chooses it.
 * - So a target sells `distinct - 2` facts. pizza-bianca sells none, which is allowed (OD-H3-13).
 * - Categories are **preferences**, not slots (OD-H3-14): a purchase returns the next unrevealed
 *   fact of the preferred category, or else the next one in the fixed fallback order
 *   sauce -> cheese -> topping. Nothing says whether a category has facts left.
 * - Price (OD-H3-4): the k-th paid fact of a recipe costs 5 / 10 / 20 / 40 (40 from then on), and
 *   the total never exceeds the recipe's current full H1..H4 cost (35 or 75). A batch costs exactly
 *   the sum of buying the same facts one by one, so splitting never changes the price. The rung
 *   counts Hint Economy 1.0 levels already paid (`LegacyHintProgress`, OD-H3-9), so a migrated
 *   buyer never goes back down the ladder.
 * - Presentation (OD-H3-16): before any purchase, every target looks the same apart from its free
 *   key: 3 fixed rows, 3 preferences, and a price that depends only on how many facts were paid.
 *   What a player works out from facts they paid for is theirs.
 * - Dex 0 Margherita (OD-H3-8): every ingredient is free (no reserve, the LK-6 exception) and the
 *   result is never meant to be persisted.
 *
 * Ids from outside (a save, an event) are untrusted: anything that is not a well-formed `ing:` id
 * of this recipe's sellable set is ignored (fail closed). Lookups go through arrays and Sets, never
 * through object keys, so `__proto__` / `constructor` style ids have no effect.
 */
import { getIngredient, INGREDIENTS, type IngredientCategory } from "../../data/ingredients";
import { RECIPES, type Recipe } from "../../data/recipes";
import { DISCOVERY_HINT_PRICES, isHintOnboardingFree, MAX_PURCHASABLE_HINT_LEVEL } from "./hintPurchase";
import { buildHintSteps, hintKeyIngredientId } from "./hintSteps";

export type HintCategory = IngredientCategory;

/** Display order of the rows, and the fallback order when a preferred category has nothing left. */
export const HINT_CATEGORIES: readonly HintCategory[] = ["sauce", "cheese", "topping"];

export type HintFactId = `ing:${string}`;

export interface SelectableHintFact {
  id: HintFactId;
  ingredientId: string;
  category: HintCategory;
}

export interface SelectableHintModel {
  recipeId: string;
  /** Dex 0 Margherita: every fact free, nothing reserved, never persisted. */
  onboarding: boolean;
  /** Shown without payment: the key ingredient (none for a starter-only recipe). */
  freeFacts: readonly SelectableHintFact[];
  /** For sale, in the internal reveal order: per category, `requiredIngredients` order. */
  purchasableFacts: readonly SelectableHintFact[];
  /** Rule W. `null` only for the onboarding. Never a fact. */
  reservedIngredientId: string | null;
  /** Max total Pitz for this recipe: its current full H1..H4 cost (35 / 75). 0 for the onboarding. */
  priceCap: number;
}

/** A batch can ask for at most this many facts (more than any recipe sells). */
export const MAX_HINT_BATCH = 6;

const FACT_ID_PATTERN = /^ing:([a-z0-9][a-z0-9-]{0,63})$/;

export function hintFactId(ingredientId: string): HintFactId {
  return `ing:${ingredientId}`;
}

/** The ingredient id inside a well-formed fact id, or `null`. Any other fact kind (a future
 *  `tech:` / `shape:`...) or a hostile value is `null`: this build cannot show it. */
export function parseHintFactId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = FACT_ID_PATTERN.exec(raw);
  return match ? match[1] : null;
}

function isHintCategory(value: unknown): value is HintCategory {
  return typeof value === "string" && (HINT_CATEGORIES as readonly string[]).includes(value);
}

function distinctIngredientIds(recipe: Recipe): string[] {
  return [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
}

function categoryOf(ingredientId: string): HintCategory | null {
  return getIngredient(ingredientId)?.category ?? null;
}

/** Rule W (OD-H3-5): the reserved ingredient of `recipe` at Dex >= 1. */
export function reservedIngredientId(recipe: Recipe): string {
  const ids = distinctIngredientIds(recipe);
  const key = hintKeyIngredientId(recipe);
  for (const category of ["topping", "cheese", "sauce"] as const) {
    const candidates = ids.filter((id) => id !== key && categoryOf(id) === category);
    if (candidates.length > 0) return candidates[candidates.length - 1];
  }
  return ids[ids.length - 1];
}

/** The recipe's current full Hint 2.0 cost (H1..its last level), the OD-H3-4 parity cap. */
export function selectableHintPriceCap(recipe: Recipe): number {
  const steps = buildHintSteps(recipe, { discoveredCount: 1 });
  const lastLevel = Math.min(steps[steps.length - 1].level, MAX_PURCHASABLE_HINT_LEVEL);
  let cap = 0;
  for (let level = 1; level <= lastLevel; level += 1) cap += DISCOVERY_HINT_PRICES[level as 1 | 2 | 3 | 4];
  return cap;
}

function toFact(ingredientId: string): SelectableHintFact | null {
  const category = categoryOf(ingredientId);
  return category ? { id: hintFactId(ingredientId), ingredientId, category } : null;
}

function byCategory(facts: readonly SelectableHintFact[]): SelectableHintFact[] {
  return HINT_CATEGORIES.flatMap((category) => facts.filter((f) => f.category === category));
}

/** The facts of `recipeId` as a hint target, or `null` for an unknown recipe (fail closed). */
export function buildSelectableHintModel(
  recipeId: unknown,
  options: { discoveredCount: number },
  recipes: readonly Recipe[] = RECIPES,
): SelectableHintModel | null {
  if (typeof recipeId !== "string") return null;
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) return null;
  const facts = distinctIngredientIds(recipe).map(toFact);
  if (facts.some((f) => f === null)) return null;
  const all = facts as SelectableHintFact[];
  if (isHintOnboardingFree(options.discoveredCount, recipe.id)) {
    return { recipeId: recipe.id, onboarding: true, freeFacts: [], purchasableFacts: byCategory(all), reservedIngredientId: null, priceCap: 0 };
  }
  const key = hintKeyIngredientId(recipe);
  const reserved = reservedIngredientId(recipe);
  return {
    recipeId: recipe.id,
    onboarding: false,
    freeFacts: all.filter((f) => f.ingredientId === key),
    purchasableFacts: byCategory(all.filter((f) => f.ingredientId !== key && f.ingredientId !== reserved)),
    reservedIngredientId: reserved,
    priceCap: selectableHintPriceCap(recipe),
  };
}

/** The purchasable facts `raw` really owns, in reveal order, deduplicated. Anything else (unknown
 *  kind, other recipe's ingredient, the key, the reserved ingredient, garbage) is ignored. */
export function ownedPurchasedFacts(model: SelectableHintModel, raw: readonly unknown[] | unknown): SelectableHintFact[] {
  if (!Array.isArray(raw)) return [];
  const owned = new Set<string>();
  for (const value of raw) {
    const ingredientId = parseHintFactId(value);
    if (ingredientId !== null) owned.add(ingredientId);
  }
  return model.purchasableFacts.filter((f) => owned.has(f.ingredientId));
}

/** Rung price of the `k`-th paid fact (k >= 1): 5 / 10 / 20 / 40, then 40. */
function rungPrice(k: number): number {
  return DISCOVERY_HINT_PRICES[Math.min(k, MAX_PURCHASABLE_HINT_LEVEL) as 1 | 2 | 3 | 4];
}

/** Pitz for `count` more facts after `paidCount` already paid, capped at `cap` in total. Buying
 *  them in any split gives the same sum (it only depends on the paid count). */
export function selectableHintBatchPrice(paidCount: number, count: number, cap: number): number {
  let spent = 0;
  for (let k = 1; k <= paidCount; k += 1) spent = Math.min(cap, spent + rungPrice(k));
  let price = 0;
  for (let k = paidCount + 1; k <= paidCount + count; k += 1) {
    const step = Math.max(0, Math.min(rungPrice(k), cap - spent));
    price += step;
    spent += step;
  }
  return price;
}

/** Price of the next single fact. */
export function selectableHintNextPrice(model: SelectableHintModel, paidCount: number): number {
  return model.onboarding ? 0 : selectableHintBatchPrice(paidCount, 1, model.priceCap);
}

/**
 * OD-H3-14: resolves each preference in order to the next unrevealed purchasable fact of that
 * category, or else of the first category in `HINT_CATEGORIES` that still has one. Stops early
 * when nothing is left. Never returns the key, the reserved ingredient, an owned fact or the same
 * fact twice.
 */
export function resolveHintPreferences(
  model: SelectableHintModel,
  owned: readonly SelectableHintFact[],
  preferences: readonly HintCategory[],
): SelectableHintFact[] {
  const taken = new Set(owned.map((f) => f.ingredientId));
  const picked: SelectableHintFact[] = [];
  const next = (category: HintCategory) => model.purchasableFacts.find((f) => f.category === category && !taken.has(f.ingredientId));
  for (const preference of preferences) {
    const fact = next(preference) ?? HINT_CATEGORIES.map(next).find((f) => f !== undefined);
    if (!fact) break;
    taken.add(fact.ingredientId);
    picked.push(fact);
  }
  return picked;
}

export type SelectableHintPurchaseFailure =
  | "NOT_A_TARGET"
  /** Empty, too long, or containing something that is not a category. */
  | "INVALID_PREFERENCES"
  /** The event was built for another paid count (double tap, stale sheet). */
  | "STALE"
  /** The balance does not cover the requested batch. Decided on the request, not on what is left. */
  | "INSUFFICIENT_PITZ"
  /** Nothing unrevealed is for sale. No Pitz is taken. */
  | "NOTHING_TO_REVEAL";

export interface SelectableHintPurchaseInput {
  model: SelectableHintModel | null;
  purchasedFactIds: readonly unknown[] | unknown;
  preferences: readonly unknown[] | unknown;
  /** Hint Economy 1.0 progress carried over (OD-H3-9); omitted = none. */
  legacy?: LegacyHintProgress;
  /** The paid count the sheet showed when the player confirmed. */
  expectedPaidCount: number;
  pitzBalance: number;
}

/**
 * OD-H3-9: what a Hint Economy 1.0 purchaser already paid for, supplied by the migration (H3-2).
 * The price rung must never roll back: an old H1 buyer paid rung 1 for the key, which is now free
 * and therefore not a purchasable fact, so the rung cannot be derived from the facts alone.
 * - `paidRungs`: rungs already paid (the old level). Not a safe integer in 0..4 -> 0.
 * - `grantedFactIds`: the positive facts the old levels showed. They are owned (shown, never sold
 *   again) but add no rung: `paidRungs` already paid for them.
 */
export interface LegacyHintProgress {
  paidRungs: unknown;
  grantedFactIds: readonly unknown[] | unknown;
}

interface PaidProgress {
  /** Every owned purchasable fact (bought or granted), in reveal order. */
  owned: SelectableHintFact[];
  /** Facts bought under Hint 3.0 only -- the new ledger. */
  bought: SelectableHintFact[];
  /** The price rung: legacy rungs + facts bought beyond the legacy grant. */
  paidCount: number;
}

function legacyRungs(raw: unknown): number {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? Math.min(raw, MAX_PURCHASABLE_HINT_LEVEL) : 0;
}

function paidProgress(model: SelectableHintModel, purchasedFactIds: unknown, legacy: LegacyHintProgress | undefined): PaidProgress {
  const bought = ownedPurchasedFacts(model, purchasedFactIds);
  if (model.onboarding) return { owned: bought, bought, paidCount: 0 };
  const granted = new Set(ownedPurchasedFacts(model, legacy?.grantedFactIds).map((f) => f.ingredientId));
  const boughtIds = new Set(bought.map((f) => f.ingredientId));
  return {
    owned: model.purchasableFacts.filter((f) => granted.has(f.ingredientId) || boughtIds.has(f.ingredientId)),
    bought,
    paidCount: legacyRungs(legacy?.paidRungs) + bought.filter((f) => !granted.has(f.ingredientId)).length,
  };
}

export type SelectableHintPurchaseResult =
  | {
      success: true;
      revealed: readonly SelectableHintFact[];
      price: number;
      /** The new ledger: facts bought under Hint 3.0 (legacy grants stay derived, never copied). */
      nextPurchasedFactIds: readonly HintFactId[];
      nextPitzBalance: number;
      /** false for the Dex-0 onboarding: the caller must not write it to the save. */
      persist: boolean;
    }
  | { success: false; reason: SelectableHintPurchaseFailure };

/**
 * The single authority for one Selectable Hint purchase (same "pure rule, the reducer only applies
 * it" pattern as `purchaseDiscoveryHint`). Everything is re-derived from the input. A success
 * debits and records together; any failure changes nothing. Affordability is checked on the
 * requested batch before anything is resolved, so a refusal never depends on what is left.
 */
export function purchaseSelectableHint(input: SelectableHintPurchaseInput): SelectableHintPurchaseResult {
  const { model } = input;
  if (!model) return { success: false, reason: "NOT_A_TARGET" };
  const preferences = input.preferences;
  if (!Array.isArray(preferences) || preferences.length === 0 || preferences.length > MAX_HINT_BATCH || !preferences.every(isHintCategory)) {
    return { success: false, reason: "INVALID_PREFERENCES" };
  }
  const { owned, bought, paidCount } = paidProgress(model, input.purchasedFactIds, input.legacy);
  if (!model.onboarding && input.expectedPaidCount !== paidCount) return { success: false, reason: "STALE" };
  const requestedPrice = model.onboarding ? 0 : selectableHintBatchPrice(paidCount, preferences.length, model.priceCap);
  if (!Number.isFinite(input.pitzBalance) || input.pitzBalance < requestedPrice) return { success: false, reason: "INSUFFICIENT_PITZ" };
  const revealed = resolveHintPreferences(model, owned, preferences);
  if (revealed.length === 0) return { success: false, reason: "NOTHING_TO_REVEAL" };
  const price = model.onboarding ? 0 : selectableHintBatchPrice(paidCount, revealed.length, model.priceCap);
  const ownedIds = new Set([...bought, ...revealed].map((f) => f.ingredientId));
  return {
    success: true,
    revealed,
    price,
    nextPurchasedFactIds: model.purchasableFacts.filter((f) => ownedIds.has(f.ingredientId)).map((f) => f.id),
    nextPitzBalance: input.pitzBalance - price,
    persist: !model.onboarding,
  };
}

export interface SelectableHintChip {
  factId: HintFactId;
  ingredientId: string;
  /** The free key (or an onboarding fact); display only. */
  free: boolean;
}

export interface SelectableHintRow {
  category: HintCategory;
  /** Revealed facts only, in ingredient-catalog order (never purchase or recipe order). */
  revealed: readonly SelectableHintChip[];
}

/**
 * OD-H3-16: what a sheet may render. It carries no remaining count, no per-category availability,
 * no complete / empty flag, no reserved ingredient and no unrevealed fact. Rows and preferences are
 * the same 3 for every target. The price depends only on the paid count.
 */
export interface SelectableHintPresentation {
  kind: "SELECTABLE";
  onboarding: boolean;
  rows: readonly SelectableHintRow[];
  preferences: readonly HintCategory[];
  /** Price of one more fact. */
  nextPrice: number;
  /** The paid count to echo back as `expectedPaidCount`. */
  paidCount: number;
  pitzBalance: number;
  affordable: boolean;
}

const CATALOG_INDEX = new Map(INGREDIENTS.map((ingredient, index) => [ingredient.id, index]));

function catalogOrder(a: SelectableHintChip, b: SelectableHintChip): number {
  return (CATALOG_INDEX.get(a.ingredientId) ?? 0) - (CATALOG_INDEX.get(b.ingredientId) ?? 0);
}

export function selectableHintPresentation(
  model: SelectableHintModel,
  purchasedFactIds: readonly unknown[] | unknown,
  pitzBalance: number,
  legacy?: LegacyHintProgress,
): SelectableHintPresentation {
  const { owned, paidCount } = paidProgress(model, purchasedFactIds, legacy);
  const chips: (SelectableHintChip & { category: HintCategory })[] = [
    ...model.freeFacts.map((f) => ({ factId: f.id, ingredientId: f.ingredientId, category: f.category, free: true })),
    ...owned.map((f) => ({ factId: f.id, ingredientId: f.ingredientId, category: f.category, free: model.onboarding })),
  ];
  const nextPrice = selectableHintNextPrice(model, paidCount);
  const balance = Number.isFinite(pitzBalance) ? pitzBalance : 0;
  return {
    kind: "SELECTABLE",
    onboarding: model.onboarding,
    rows: HINT_CATEGORIES.map((category) => ({
      category,
      revealed: chips
        .filter((c) => c.category === category)
        .map(({ factId, ingredientId, free }) => ({ factId, ingredientId, free }))
        .sort(catalogOrder),
    })),
    preferences: HINT_CATEGORIES,
    nextPrice,
    paidCount,
    pitzBalance: balance,
    affordable: balance >= nextPrice,
  };
}
