/**
 * B案再構成 Phase 3d (Issue #901, shop model only): hints bought with research points. Owner decisions (2026-11-27, design §6):
 * one shared research point pool, Pitz never buys a hint in the shop model, sauces and cheeses are hint subjects, and what a hint
 * reveals shows in the Dex and on the cooking screen.
 *
 * ## What can be bought, per target recipe
 *
 * - `INGREDIENT`: one ingredient slot (a cheese or a topping; a cheese is a slot like any other). Slots open in a fixed order,
 *   the most widely used ingredient first (how many adopted recipes use it), the recipe's KEY_TOPPING (the Hint 5.0 role data) last.
 *   Each purchase reveals the next unrevealed slot's ingredient.
 * - `SAUCE`: the sauce(s), or that there is none.
 * - `SHAPE`: the dough's shape (a round pizza, or a square one on the tray).
 * - `METHOD`: how it is cooked (an ordinary bake, a special dough, toppings added after the bake -- and then which ones).
 * - `COUNT`: how many pieces of each ingredient (the Completion Gate's `minCount`).
 *
 * Buying every item reaches the whole answer the matcher compares (ingredient set, sauce, pan, dough, late) plus the counts
 * (./shopHints.test.ts pins it for every adopted recipe). There is no cap: buying on always gets there.
 *
 * ## Price (PROVISIONAL, Phase 3f tunes it here and only here)
 *
 * `SHOP_HINT_BASE_PRICE_BY_STAGE[stage - 1] + SHOP_HINT_PRICE_STEP * (items already revealed on that recipe by the shop ledger)`.
 * Items carried over from the Pitz hints (below) cost nothing and do not raise the price. The free Margherita hint (R4 #16):
 * while nothing has been developed yet (no Dex entry), every Margherita item is free.
 *
 * ## Carried over from the Pitz hints (Owner: never charged twice)
 *
 * A name the player bought before (an `ing:` fact in `discoveryHintFacts`, or an Economy 1.0 level's named line) counts as a
 * revealed ingredient slot; the sauce counts as revealed once every sauce of the recipe was named. The ingredient a Research
 * Entry already tells (its unlock fact) counts the same way, as the Hint 5.0 ladder treats it. Nothing is copied: the
 * legacy ledgers are read as they are and never written by the shop model. A classification (`cls:`) or a total names no
 * ingredient and carries nothing over.
 *
 * ## Targets
 *
 * Adopted recipes (`MENU_CATALOG`) whose stage is open (the Phase 3b stage rule), developed or not.
 */
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import { RECIPES, type Recipe } from "../../data/recipes";
import { resolvePanShape, type PanShape } from "../pan/panShape";
import { resolveDoughKind, type DoughKind } from "../dough/doughKind";
import { legacyHintMapping } from "../discovery/hintFactMigration";
import { parseHintFactId } from "../discovery/selectableHint";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { SHOP_CHAPTER_COUNT } from "./reputationTable";
import type { CompleteReputationTable } from "./reputationTable";
import { catalogChapterOf, isRecipeStageOpenAt, type ShopCatalog } from "./shopProgression";
import {
  hintRevealsByRecipeOf,
  hintRevealsOf,
  researchPointBalanceOf,
  researchPointsSpentOf,
  type ShopProgressState,
} from "./shopProgress";

/** Base price of one hint item, by the recipe's stage (index 0 = stage 1). Provisional (Phase 3f). */
export const SHOP_HINT_BASE_PRICE_BY_STAGE: readonly [number, number, number, number, number] = Object.freeze([1, 1, 2, 3, 4]) as unknown as readonly [
  number,
  number,
  number,
  number,
  number,
];

/** What each earlier purchase on the same recipe adds to the next one's price. Provisional (Phase 3f). No cap. */
export const SHOP_HINT_PRICE_STEP = 1;

/** R4 #16: the recipe whose hints are free while nothing has been developed yet. */
export const SHOP_FREE_HINT_RECIPE_ID = "margherita";

export type ShopHintItemKind = "INGREDIENT" | "SAUCE" | "SHAPE" | "METHOD" | "COUNT";

/** Display order of the items (the board and the buy buttons). */
export const SHOP_HINT_ITEM_KINDS: readonly ShopHintItemKind[] = ["SHAPE", "METHOD", "SAUCE", "INGREDIENT", "COUNT"];

/** Ledger ids of the single items; an ingredient slot is stored as `ing:<ingredientId>`. */
export const SHOP_HINT_ITEM_ID: Readonly<Record<Exclude<ShopHintItemKind, "INGREDIENT">, string>> = {
  SAUCE: "sauce",
  SHAPE: "shape",
  METHOD: "method",
  COUNT: "count",
};

export function shopHintIngredientItemId(ingredientId: string): string {
  return `ing:${ingredientId}`;
}

/** INTERNAL: the full answer of one target. Never presentation as a whole (only revealed parts reach the view). */
export interface ShopHintAnswer {
  recipeId: string;
  stage: number;
  /** Sauce ids in catalog order (empty = no sauce). */
  sauceIds: readonly string[];
  /** The cheese / topping slots, in the order they open (most widely used first, KEY_TOPPING last). */
  slotIngredientIds: readonly string[];
  /** The KEY_TOPPING, or `null` (key-free, or no topping). */
  keyToppingId: string | null;
  shape: PanShape;
  dough: DoughKind;
  /** Ingredients placed after the bake (the `late` identity), catalog order. */
  lateIngredientIds: readonly string[];
  /** Pieces per ingredient (`minCount`), every required ingredient. */
  counts: Readonly<Record<string, number>>;
  /** Distinct ingredients, sauce included: the existing hints' 「全部で○種類」 total. */
  totalKinds: number;
}

const CATALOG_INDEX = new Map(INGREDIENTS.map((ingredient, index) => [ingredient.id, index]));
const catalogIndex = (id: string) => CATALOG_INDEX.get(id) ?? Number.MAX_SAFE_INTEGER;

/** How many adopted recipes use each ingredient (the "widely used" measure of the slot order). */
function usageCounts(catalog: ShopCatalog, recipes: readonly Recipe[]): Map<string, number> {
  const adopted = new Set(catalog.entries.map((e) => e.recipeId as string));
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    if (!adopted.has(recipe.id)) continue;
    for (const id of new Set(recipe.requiredIngredients.map((r) => r.ingredientId))) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * The KEY_TOPPING of a recipe (`null`: key-free or no topping). Supplied by the caller (../../state/discoveryHint.ts's
 * `hintKeyToppingIdOf`): the Hint 5.0 role data keeps its one wiring boundary (hint5Production.gate.test.ts).
 */
export type KeyToppingLookup = (recipeId: string) => string | null;

function lateIdsOf(recipeId: string): string[] {
  const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === recipeId);
  const late = target?.identityDimensions.late ?? [];
  return [...new Set(late.flatMap(([, ids]) => ids))].sort((a, b) => catalogIndex(a) - catalogIndex(b));
}

/**
 * The answer of an adopted recipe, or `null` when the catalog does not adopt it or its data does not resolve (fail closed: no
 * item is ever sold for it).
 */
export function shopHintAnswer(
  recipeId: unknown,
  catalog: ShopCatalog,
  keyOf: KeyToppingLookup,
  recipes: readonly Recipe[] = RECIPES,
): ShopHintAnswer | null {
  if (typeof recipeId !== "string") return null;
  const stage = catalogChapterOf(recipeId, catalog);
  const recipe = recipes.find((r) => r.id === recipeId);
  if (stage === null || !recipe) return null;
  const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
  if (!ids.every((id) => getIngredient(id))) return null;
  const counts: Record<string, number> = {};
  for (const req of recipe.requiredIngredients) counts[req.ingredientId] = Math.max(counts[req.ingredientId] ?? 0, req.minCount);
  const sauceIds = ids.filter((id) => getIngredient(id)!.category === "sauce").sort((a, b) => catalogIndex(a) - catalogIndex(b));
  const key = keyOf(recipe.id);
  const keyToppingId = key !== null && ids.includes(key) ? key : null;
  const usage = usageCounts(catalog, recipes);
  const slots = ids
    .filter((id) => getIngredient(id)!.category !== "sauce")
    .sort((a, b) => {
      if (a === keyToppingId) return 1;
      if (b === keyToppingId) return -1;
      return (usage.get(b) ?? 0) - (usage.get(a) ?? 0) || catalogIndex(a) - catalogIndex(b);
    });
  return {
    recipeId: recipe.id,
    stage,
    sauceIds,
    slotIngredientIds: slots,
    keyToppingId,
    shape: resolvePanShape(recipe),
    dough: resolveDoughKind(recipe),
    lateIngredientIds: lateIdsOf(recipe.id),
    counts,
    totalKinds: ids.length,
  };
}

/** Whether `recipeId` is a hint target at this reputation: adopted, and its stage open (the Phase 3b stage rule). */
export function isShopHintTargetAt(
  recipeId: string,
  reputation: number,
  floors: CompleteReputationTable["chapterFloors"],
  catalog: ShopCatalog,
): boolean {
  return catalogChapterOf(recipeId, catalog) !== null && isRecipeStageOpenAt(recipeId, reputation, floors, catalog);
}

/** The price of the next item on a recipe of `stage` after `revealedSoFar` shop purchases on it. */
export function shopHintPrice(stage: number, revealedSoFar: number, table: readonly number[] = SHOP_HINT_BASE_PRICE_BY_STAGE): number {
  const index = Math.min(SHOP_CHAPTER_COUNT, Math.max(1, Math.floor(stage))) - 1;
  return (table[index] ?? 0) + SHOP_HINT_PRICE_STEP * Math.max(0, Math.floor(revealedSoFar));
}

/** What the shop hint layer reads (a `GameState` satisfies it). */
export interface ShopHintInputs {
  shop: ShopProgressState;
  /** Dex discovered count 0 = nothing developed yet (the free Margherita hint). */
  discoveredCount: number;
  /** The legacy Pitz hint ledgers, read only (carried-over reveals). */
  discoveryHintFacts: Readonly<Record<string, readonly string[]>>;
  discoveryHintPurchases: unknown;
  /**
   * The ingredient a recipe's Research Entry already tells the player (its unlock fact, 「？？？ピザ（ソーセージ）」), if any. The Hint
   * 5.0 ladder treats it as known too (a rung it completes costs 0). Optional: absent = none.
   */
  researchKnownIngredientIdOf?: (recipeId: string) => string | null;
}

/** Whether every item of `recipeId` is free right now (R4 #16). */
export function isShopHintFree(recipeId: string, discoveredCount: number): boolean {
  return discoveredCount === 0 && recipeId === SHOP_FREE_HINT_RECIPE_ID;
}

/** The ingredient names the Pitz hints gave for this recipe (only names that are ingredients of it). */
function carriedOverNames(
  answer: ShopHintAnswer,
  inputs: Pick<ShopHintInputs, "discoveryHintFacts" | "discoveryHintPurchases" | "researchKnownIngredientIdOf">,
): Set<string> {
  const facts = inputs.discoveryHintFacts;
  const stored = Object.prototype.hasOwnProperty.call(facts, answer.recipeId) ? facts[answer.recipeId] : undefined;
  const names = new Set<string>();
  const inRecipe = (id: string | null): id is string => id !== null && Object.prototype.hasOwnProperty.call(answer.counts, id);
  for (const id of Array.isArray(stored) ? stored : []) {
    const name = parseHintFactId(id);
    if (inRecipe(name)) names.add(name);
  }
  const researchKnown = inputs.researchKnownIngredientIdOf?.(answer.recipeId) ?? null;
  if (inRecipe(researchKnown)) names.add(researchKnown);
  const legacy = legacyHintMapping(answer.recipeId, inputs.discoveryHintPurchases);
  if (legacy && legacy.legacyLevel > 0) {
    for (const id of legacy.grantedFactIds) {
      const name = parseHintFactId(id);
      if (inRecipe(name)) names.add(name);
    }
  }
  return names;
}

/** What is known of one target, and how (INTERNAL: the view below is what may be rendered). */
export interface ShopHintKnowledge {
  answer: ShopHintAnswer;
  /** Items revealed by research point purchases (the shop ledger), as stored. */
  shopItemIds: readonly string[];
  revealedSlotIngredientIds: ReadonlySet<string>;
  sauce: boolean;
  shape: boolean;
  method: boolean;
  count: boolean;
  /** The items that came from the Pitz hints (free, never charged). */
  carriedOverSlotIngredientIds: readonly string[];
  carriedOverSauce: boolean;
}

export function shopHintKnowledge(answer: ShopHintAnswer, inputs: ShopHintInputs): ShopHintKnowledge {
  const shopItemIds = hintRevealsOf(inputs.shop, answer.recipeId);
  const mine = new Set(shopItemIds);
  const carried = carriedOverNames(answer, inputs);
  const revealed = new Set<string>();
  const carriedSlots: string[] = [];
  for (const id of answer.slotIngredientIds) {
    if (mine.has(shopHintIngredientItemId(id))) revealed.add(id);
    else if (carried.has(id)) {
      revealed.add(id);
      carriedSlots.push(id);
    }
  }
  const carriedSauce = answer.sauceIds.length > 0 && answer.sauceIds.every((id) => carried.has(id)) && !mine.has(SHOP_HINT_ITEM_ID.SAUCE);
  return {
    answer,
    shopItemIds,
    revealedSlotIngredientIds: revealed,
    sauce: mine.has(SHOP_HINT_ITEM_ID.SAUCE) || carriedSauce,
    shape: mine.has(SHOP_HINT_ITEM_ID.SHAPE),
    method: mine.has(SHOP_HINT_ITEM_ID.METHOD),
    count: mine.has(SHOP_HINT_ITEM_ID.COUNT),
    carriedOverSlotIngredientIds: carriedSlots,
    carriedOverSauce: carriedSauce,
  };
}

/** The shop purchases already made on the recipe (they raise the price): the recipe's shop ledger entries this layer knows. */
function purchasesSoFar(knowledge: ShopHintKnowledge): number {
  const { answer } = knowledge;
  const known = new Set<string>([
    ...Object.values(SHOP_HINT_ITEM_ID),
    ...answer.slotIngredientIds.map(shopHintIngredientItemId),
  ]);
  return knowledge.shopItemIds.filter((id) => known.has(id)).length;
}

/** The next slot a purchase would reveal, or `null` once every slot is revealed. */
function nextSlot(knowledge: ShopHintKnowledge): string | null {
  return knowledge.answer.slotIngredientIds.find((id) => !knowledge.revealedSlotIngredientIds.has(id)) ?? null;
}

function isRevealed(knowledge: ShopHintKnowledge, kind: ShopHintItemKind): boolean {
  switch (kind) {
    case "INGREDIENT":
      return nextSlot(knowledge) === null;
    case "SAUCE":
      return knowledge.sauce;
    case "SHAPE":
      return knowledge.shape;
    case "METHOD":
      return knowledge.method;
    case "COUNT":
      return knowledge.count;
  }
}

/** The price of the next purchase on this target right now (0 while it is free). */
export function shopHintNextPrice(knowledge: ShopHintKnowledge, discoveredCount: number): number {
  return isShopHintFree(knowledge.answer.recipeId, discoveredCount) ? 0 : shopHintPrice(knowledge.answer.stage, purchasesSoFar(knowledge));
}

// ---- the purchase authority ---------------------------------------------------------------------------------------------

export interface ShopHintRequest {
  recipeId: unknown;
  kind: unknown;
  /** The price the board showed (a double tap or a stale board is refused: the price rises after every purchase). */
  expectedPrice: unknown;
}

export type ShopHintRejection = "NOT_A_TARGET" | "UNKNOWN_ITEM" | "ALREADY_REVEALED" | "STALE" | "INSUFFICIENT_POINTS";

export type ShopHintResult =
  | { ok: true; itemId: string; charge: number; shop: ShopProgressState }
  | { ok: false; reason: ShopHintRejection };

const ITEM_KINDS = new Set<string>(SHOP_HINT_ITEM_KINDS);

/**
 * One research point hint purchase, in a fixed order: target -> item -> already revealed -> stale price -> balance -> reveal.
 * Every refusal changes nothing. A success adds exactly one item id to the recipe's ledger and raises the spent total by the
 * price in the same new state, so the balance never goes below 0 and an item is never bought twice.
 */
export function purchaseShopHint(
  request: ShopHintRequest,
  inputs: ShopHintInputs,
  isTarget: (recipeId: string) => boolean,
  catalog: ShopCatalog,
  keyOf: KeyToppingLookup,
): ShopHintResult {
  if (typeof request.recipeId !== "string" || !isTarget(request.recipeId)) return { ok: false, reason: "NOT_A_TARGET" };
  const answer = shopHintAnswer(request.recipeId, catalog, keyOf);
  if (!answer) return { ok: false, reason: "NOT_A_TARGET" };
  if (typeof request.kind !== "string" || !ITEM_KINDS.has(request.kind)) return { ok: false, reason: "UNKNOWN_ITEM" };
  const kind = request.kind as ShopHintItemKind;
  const knowledge = shopHintKnowledge(answer, inputs);
  if (isRevealed(knowledge, kind)) return { ok: false, reason: "ALREADY_REVEALED" };
  const price = shopHintNextPrice(knowledge, inputs.discoveredCount);
  if (request.expectedPrice !== price) return { ok: false, reason: "STALE" };
  if (researchPointBalanceOf(inputs.shop) < price) return { ok: false, reason: "INSUFFICIENT_POINTS" };
  const itemId = kind === "INGREDIENT" ? shopHintIngredientItemId(nextSlot(knowledge)!) : SHOP_HINT_ITEM_ID[kind];
  const ledger: Record<string, readonly string[]> = { ...hintRevealsByRecipeOf(inputs.shop) };
  ledger[answer.recipeId] = [...hintRevealsOf(inputs.shop, answer.recipeId), itemId];
  const spent = researchPointsSpentOf(inputs.shop) + price;
  const shop: ShopProgressState = {
    ...inputs.shop,
    hintRevealsByRecipe: ledger,
    ...(spent > 0 ? { researchPointsSpent: spent } : {}),
  };
  return { ok: true, itemId, charge: price, shop };
}

// ---- presentation ---------------------------------------------------------------------------------------------------------

export interface ShopHintSlotView {
  /** The ingredient, once revealed; `null` = a 「？」 slot. */
  ingredientId: string | null;
  /** The piece count, once COUNT is revealed (shown on 「？」 slots too). */
  count: number | null;
  /** Placed after the bake (shown once both the slot and METHOD are revealed). */
  late: boolean;
  /** Came from the Pitz hints. */
  carriedOver: boolean;
}

export interface ShopHintBoardView {
  recipeId: string;
  stage: number;
  /** `null` = not revealed; `[]` = no sauce. */
  sauceIds: readonly string[] | null;
  /** `null` = not revealed. */
  shape: PanShape | null;
  /** `null` = not revealed. */
  method: { dough: DoughKind; lateCount: number } | null;
  /** One entry per cheese / topping slot, in opening order. */
  slots: readonly ShopHintSlotView[];
  countRevealed: boolean;
  /** The existing hints' 「全部で○種類」 (sauce included), shown only once the sauce is revealed (else the slot count plus the
   *  total would tell whether there is a sauce). */
  totalKinds: number | null;
  /** The items still for sale, in display order. */
  forSale: readonly ShopHintItemKind[];
  /** The price of the next purchase (the same for every item of this recipe). */
  price: number;
  free: boolean;
  balance: number;
  affordable: boolean;
  /** Something is revealed (anything to show on the cooking screen / the Dex). */
  anyRevealed: boolean;
  /** Every item is revealed. */
  complete: boolean;
}

export function shopHintBoardView(answer: ShopHintAnswer, inputs: ShopHintInputs): ShopHintBoardView {
  const knowledge = shopHintKnowledge(answer, inputs);
  const carried = new Set(knowledge.carriedOverSlotIngredientIds);
  const late = new Set(answer.lateIngredientIds);
  const slots: ShopHintSlotView[] = answer.slotIngredientIds.map((id) => {
    const revealed = knowledge.revealedSlotIngredientIds.has(id);
    return {
      ingredientId: revealed ? id : null,
      count: knowledge.count ? answer.counts[id] : null,
      late: revealed && knowledge.method && late.has(id),
      carriedOver: revealed && carried.has(id),
    };
  });
  const forSale = SHOP_HINT_ITEM_KINDS.filter((kind) => !isRevealed(knowledge, kind));
  const price = shopHintNextPrice(knowledge, inputs.discoveredCount);
  const balance = researchPointBalanceOf(inputs.shop);
  const anyRevealed = knowledge.sauce || knowledge.shape || knowledge.method || knowledge.count || knowledge.revealedSlotIngredientIds.size > 0;
  return {
    recipeId: answer.recipeId,
    stage: answer.stage,
    sauceIds: knowledge.sauce ? answer.sauceIds : null,
    shape: knowledge.shape ? answer.shape : null,
    method: knowledge.method ? { dough: answer.dough, lateCount: answer.lateIngredientIds.length } : null,
    slots,
    countRevealed: knowledge.count,
    totalKinds: knowledge.sauce ? answer.totalKinds : null,
    forSale,
    price,
    free: isShopHintFree(answer.recipeId, inputs.discoveredCount),
    balance,
    affordable: balance >= price,
    anyRevealed,
    complete: forSale.length === 0,
  };
}
