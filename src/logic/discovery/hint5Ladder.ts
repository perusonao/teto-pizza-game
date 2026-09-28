/**
 * Discovery Hint 5.0 (Issue #292), H5-1: the Sub-topping Classification Ladder pure layer. UNWIRED:
 * no reducer, sheet, save writer or flag reads this module yet (H5-2 wires it behind a flag).
 *
 * Authority: docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md (Owner Decisions OD-H5-P1..P3,
 * C1..C4, C1a / C1b / C1-P, U1, E1..E3, E3b, M1, T-COV; P4 / P4b and M2 are still open).
 *
 * ## The ladder (§5)
 *
 *   1 SAUCE (every sauce) -> 2 CHEESE (every cheese) -> 3 KEY_TOPPING -> 4 STRUCTURE
 *   -> 5.. SUB_CLASS ①..ⓝ (one per sub-topping, `hintSubToppingOrder`)
 *
 * - Strictly linear: only the next unsettled rung can be requested (`expectedRungIndex`).
 * - Rungs 1-4 exist for every target, with the same labels and prices (FREE LEAK, H5-INV-5).
 *   The SUB_CLASS rungs are presented only once STRUCTURE is settled.
 * - A sub-topping is **classified, never named** (OD-H5-C3). The classification is its DH4-1 family,
 *   shown through ../../data/hintClassDisplay.ts. There is **no k >= 2 rule** (OD-H5-P1 / P2): the
 *   answer depends on the recipe only, never on the owned set, so it may narrow the candidates to
 *   one. That is deduction, not disclosure.
 * - 0 sub-toppings -> no SUB_CLASS rung (OD-H5-P3).
 * - **An empty fixed rung** (no sauce, no cheese, no key topping) is not skipped and never answered:
 *   a request for it is `RESERVED_EMPTY_RUNG` (0 Pitz, no fact). OD-H5-P4 / P4b are undecided, so
 *   nothing here says "none", and nothing reveals a Technique (H5-INV-4).
 *
 * ## Taxonomy: fail fast, never coarsen (OD-H5-T-COV, H5-INV-7)
 *
 * A sub-topping must resolve to exactly one valid family. If any of a recipe's sub-toppings does not
 * (unknown id, not a topping, no family row), or its roles are inconsistent, the recipe is
 * **not a target** (`NOT_A_TARGET`, 0 Pitz, no fact). Unlike the DH4 path, nothing falls back to
 * group / category / existence. The production gates keep that state unreachable.
 *
 * ## Price (OD-H5-E1 = P-C, E2 = no cap)
 *
 * SAUCE 10 · CHEESE 10 · KEY_TOPPING 10 · STRUCTURE 5 · SUB_CLASS 5. The price depends on the rung
 * kind only. The Dex-0 Margherita onboarding is free and never persisted (OD-HE-5).
 *
 * ## Stored facts (§6.3, §9)
 *
 * - The name rungs store `ing:<id>` (the Hint 3.0 kind).
 * - STRUCTURE stores `meta:ingredient-total` (DH4).
 * - SUB_CLASS stores `cls:<ingredientId>`. That id lives in the save only: no presentation field
 *   carries it (H5-INV-1).
 *
 * Existing facts are read, never rewritten, converted or deleted (E3). Only these map to a rung:
 * - `ing:` names;
 * - the legacy Economy 1.0 grants;
 * - `meta:ingredient-total` or the legacy count line;
 * - an `attr:family:<f>` about the Rule W reserve when the reserve is that sub-topping and its
 *   family is still f.
 *
 * Coarse `attr:group` / `attr:category` facts grant nothing (E3b). The Hint 3.0 free key grants
 * nothing (M1).
 *
 * Inputs from outside are untrusted: lookups use arrays, Sets, Maps and `hasOwnProperty`.
 */
import { HINT_CLASS_DISPLAY } from "../../data/hintClassDisplay";
import { getIngredient, INGREDIENTS, type IngredientCategory } from "../../data/ingredients";
import { ingredientAttributeFamily, type AttributeFamilyId } from "../../data/ingredientTaxonomy";
import { RECIPE_HINT_ROLES, type RecipeHintRoles } from "../../data/recipeHintRoles";
import { RECIPES, type Recipe } from "../../data/recipes";
import { deductionHintTextJa, INGREDIENT_TOTAL_FACT_ID, legacyOwnsIngredientTotal } from "./deductionHint";
import { parseAttributeFactId } from "./deductionRequest";
import { legacyHintMapping } from "./hintFactMigration";
import { isHintOnboardingFree } from "./hintPurchase";
import { hintFactId, parseHintFactId, reservedIngredientId } from "./selectableHint";

export type Hint5RungKind = "SAUCE" | "CHEESE" | "KEY_TOPPING" | "STRUCTURE" | "SUB_CLASS";

/** OD-H5-E1 (P-C): the price of one rung, by kind only. No per-recipe cap (OD-H5-E2). */
export const HINT5_RUNG_PRICE: Readonly<Record<Hint5RungKind, number>> = {
  SAUCE: 10,
  CHEESE: 10,
  KEY_TOPPING: 10,
  STRUCTURE: 5,
  SUB_CLASS: 5,
};

/** The fixed rungs every target has, in order (FREE LEAK: the same for every target). */
export const HINT5_FIXED_RUNG_KINDS: readonly Hint5RungKind[] = ["SAUCE", "CHEESE", "KEY_TOPPING", "STRUCTURE"];

/** The generic line after the last rung: the same text for every target (never a count). */
export const HINT5_LADDER_COMPLETE_TEXT = "ここまでのヒントで、推理してみよう！";

/** The Hint 5.0 fact kind for a sub-topping classification. */
export type Hint5ClassFactId = `cls:${string}`;

export function hint5ClassFactId(ingredientId: string): Hint5ClassFactId {
  return `cls:${ingredientId}`;
}

const CLASS_FACT_PATTERN = /^cls:([a-z0-9][a-z0-9-]{0,63})$/;

/** The ingredient id inside a well-formed `cls:` id, or `null`. */
export function parseHint5ClassFactId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = CLASS_FACT_PATTERN.exec(raw);
  return match ? match[1] : null;
}

/** INTERNAL: one rung with its subjects. Never presentation (the subjects of an unsettled rung are
 *  the answer). */
export interface Hint5Rung {
  /** 1-based position in the ladder. */
  index: number;
  kind: Hint5RungKind;
  /** SUB_CLASS only: 1..n. */
  ordinal: number | null;
  /** The ingredients this rung is about (empty for STRUCTURE, or for an empty fixed rung). */
  subjectIds: readonly string[];
}

export interface Hint5Ladder {
  recipeId: string;
  rungs: readonly Hint5Rung[];
  /** Distinct ingredient total (the STRUCTURE answer). */
  total: number;
}

/**
 * OD-H5-T-COV / H5-INV-7: the one valid family of a hint-eligible topping, or `null` when the id is
 * not a catalog topping with exactly one family row. Never a guess and never a coarser class.
 */
export function subToppingClass(ingredientId: unknown): AttributeFamilyId | null {
  if (typeof ingredientId !== "string") return null;
  if (getIngredient(ingredientId)?.category !== "topping") return null;
  return ingredientAttributeFamily(ingredientId);
}

const CATALOG_INDEX = new Map(INGREDIENTS.map((ingredient, index) => [ingredient.id, index]));

function byCatalogOrder(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => CATALOG_INDEX.get(a)! - CATALOG_INDEX.get(b)!);
}

function findRecipe(recipeId: unknown, recipes: readonly Recipe[]): Recipe | null {
  if (typeof recipeId !== "string") return null;
  return recipes.find((r) => r.id === recipeId) ?? null;
}

function rolesOf(recipeId: string, roles: Readonly<Record<string, RecipeHintRoles>>): RecipeHintRoles | null {
  return Object.prototype.hasOwnProperty.call(roles, recipeId) ? roles[recipeId] : null;
}

/**
 * OD-H5-C1 (G17): the authored roles are consistent with the recipe. `hintKeyToppingId` is a topping of
 * the recipe (null only when it has none), and `hintSubToppingOrder` is exactly its other toppings,
 * each once. Every recipe ingredient is a catalog ingredient (G22), and every sub-topping resolves to
 * one family (T-COV). Anything else is not a target.
 */
export function hint5RolesValid(recipe: Recipe, roles: RecipeHintRoles | null): boolean {
  if (!roles || !Array.isArray(roles.hintSubToppingOrder)) return false;
  const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
  if (!ids.every((id) => typeof id === "string" && getIngredient(id))) return false;
  const toppings = ids.filter((id) => getIngredient(id)!.category === "topping");
  const key = roles.hintKeyToppingId;
  if (key === null) {
    if (toppings.length > 0) return false;
  } else if (typeof key !== "string" || !toppings.includes(key)) {
    return false;
  }
  const order = roles.hintSubToppingOrder;
  const expected = toppings.filter((id) => id !== key);
  if (order.length !== expected.length || new Set(order).size !== order.length) return false;
  if (!order.every((id) => typeof id === "string" && expected.includes(id))) return false;
  return order.every((id) => subToppingClass(id) !== null);
}

/** The ladder of `recipeId`, or `null` when it is not a Hint 5.0 target (fail closed). */
export function buildHint5Ladder(
  recipeId: unknown,
  recipes: readonly Recipe[] = RECIPES,
  roles: Readonly<Record<string, RecipeHintRoles>> = RECIPE_HINT_ROLES,
): Hint5Ladder | null {
  const recipe = findRecipe(recipeId, recipes);
  if (!recipe) return null;
  const own = rolesOf(recipe.id, roles);
  if (!own || !hint5RolesValid(recipe, own)) return null;
  const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
  const inCategory = (category: IngredientCategory) => byCatalogOrder(ids.filter((id) => getIngredient(id)!.category === category));
  const fixed: [Hint5RungKind, readonly string[]][] = [
    ["SAUCE", inCategory("sauce")],
    ["CHEESE", inCategory("cheese")],
    ["KEY_TOPPING", own.hintKeyToppingId === null ? [] : [own.hintKeyToppingId]],
    ["STRUCTURE", []],
  ];
  const rungs: Hint5Rung[] = fixed.map(([kind, subjectIds], i) => ({ index: i + 1, kind, ordinal: null, subjectIds }));
  own.hintSubToppingOrder.forEach((id, i) => rungs.push({ index: rungs.length + 1, kind: "SUB_CLASS", ordinal: i + 1, subjectIds: [id] }));
  return { recipeId: recipe.id, rungs, total: ids.length };
}

/** The fixed rungs of `recipeId` that have no subject (awaiting OD-H5-P4 / P4b); `null` = not a target. */
export function hint5EmptyFixedRungs(recipeId: unknown, recipes?: readonly Recipe[]): Hint5RungKind[] | null {
  const ladder = buildHint5Ladder(recipeId, recipes);
  if (!ladder) return null;
  return ladder.rungs.filter((r) => r.kind !== "STRUCTURE" && r.kind !== "SUB_CLASS" && r.subjectIds.length === 0).map((r) => r.kind);
}

// ---- ownership (read-time mapping of the stored ledgers, §9.1) ------------------------------------

/**
 * - OWNED: bought (or mapped from an old purchase).
 * - ALREADY_KNOWN: a sub-topping whose NAME the player already owns (a Hint 3.0 purchase).
 * - EMPTY: a fixed rung with no subject.
 * - OPEN: not settled.
 */
export type Hint5RungStatus = "OWNED" | "ALREADY_KNOWN" | "EMPTY" | "OPEN";

export interface Hint5Ownership {
  statuses: readonly Hint5RungStatus[];
  /** Ingredient names the player owns (`ing:` stored or legacy-granted), catalog order. */
  knownNameIds: readonly string[];
  /** 1-based index of the first unsettled rung (EMPTY counts as unsettled), or `null` when complete. */
  nextIndex: number | null;
}

function storedStrings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

function isSettled(status: Hint5RungStatus): boolean {
  return status === "OWNED" || status === "ALREADY_KNOWN";
}

export function hint5Ownership(
  ladder: Hint5Ladder,
  storedFactIds: unknown,
  legacyPurchases: unknown,
  recipes: readonly Recipe[] = RECIPES,
): Hint5Ownership {
  const stored = storedStrings(storedFactIds);
  const recipe = recipes.find((r) => r.id === ladder.recipeId)!;
  const recipeIds = new Set(recipe.requiredIngredients.map((r) => r.ingredientId));
  const known = new Set<string>();
  for (const id of stored) {
    const name = parseHintFactId(id);
    if (name !== null && recipeIds.has(name)) known.add(name);
  }
  for (const id of legacyHintMapping(ladder.recipeId, legacyPurchases, recipes)?.grantedFactIds ?? []) {
    const name = parseHintFactId(id);
    if (name !== null && recipeIds.has(name)) known.add(name);
  }
  const classified = new Set(stored.map(parseHint5ClassFactId).filter((id): id is string => id !== null));
  const attrFamilies = new Set(stored.map(parseAttributeFactId).flatMap((a) => (a && a.level === "family" ? [a.family] : [])));
  const reserve = reservedIngredientId(recipe);
  const structureOwned = stored.includes(INGREDIENT_TOTAL_FACT_ID) || legacyOwnsIngredientTotal(ladder.recipeId, legacyPurchases, recipes);

  const statuses = ladder.rungs.map((rung): Hint5RungStatus => {
    if (rung.kind === "STRUCTURE") return structureOwned ? "OWNED" : "OPEN";
    if (rung.kind === "SUB_CLASS") {
      const id = rung.subjectIds[0];
      if (known.has(id)) return "ALREADY_KNOWN";
      if (classified.has(id)) return "OWNED";
      // E3 safe mapping: an old 特徴 family answer about this exact sub-topping (the Rule W reserve)
      // that still matches its current family. Anything coarser maps to nothing (E3b).
      const family = subToppingClass(id);
      if (id === reserve && family !== null && attrFamilies.has(family)) return "OWNED";
      return "OPEN";
    }
    if (rung.subjectIds.length === 0) return "EMPTY";
    return rung.subjectIds.every((id) => known.has(id)) ? "OWNED" : "OPEN";
  });
  const next = statuses.findIndex((s) => !isSettled(s));
  return { statuses, knownNameIds: byCatalogOrder([...known]), nextIndex: next < 0 ? null : next + 1 };
}

// ---- request (the single pure authority for one Hint 5.0 purchase) --------------------------------

export interface Hint5RequestInput {
  recipeId: unknown;
  /** Dex discovered count (0 + margherita = the free onboarding). */
  discoveredCount: number;
  /** The recipe's stored fact ids (`discoveryHintFacts[recipeId]`), untrusted. */
  storedFactIds: unknown;
  /** The legacy Economy 1.0 ledger (`discoveryHintPurchases`), untrusted. */
  legacyPurchases: unknown;
  /** The rung index the sheet showed as "next" (a double tap or a stale sheet is refused). */
  expectedRungIndex: unknown;
  pitzBalance: number;
}

export type Hint5Rejection = "NOT_A_TARGET" | "STALE" | "INSUFFICIENT_PITZ";

export type Hint5RequestResult =
  | { outcome: "ANSWERED"; rungIndex: number; kind: Hint5RungKind; addFactIds: readonly string[]; charge: number; persist: boolean }
  | { outcome: "RESERVED_EMPTY_RUNG"; rungIndex: number; kind: Hint5RungKind; addFactIds: readonly []; charge: 0 }
  | { outcome: "LADDER_COMPLETE"; addFactIds: readonly []; charge: 0 }
  | { outcome: "REJECTED"; reason: Hint5Rejection };

/**
 * One request, in a fixed order so that a refusal never depends on what is left:
 * target -> STALE -> complete -> price and balance (the price is public: it depends on the rung
 * kind only) -> empty rung -> answer.
 *
 * Only ANSWERED charges (0 during the onboarding, which is never persisted). Rejections, EMPTY
 * rungs and a complete ladder charge 0 and add no fact (H5-INV-6). Settled rungs (owned or known)
 * are never offered, so nothing is ever sold twice.
 */
export function requestHint5Rung(input: Hint5RequestInput, recipes: readonly Recipe[] = RECIPES): Hint5RequestResult {
  const ladder = buildHint5Ladder(input.recipeId, recipes);
  if (!ladder) return { outcome: "REJECTED", reason: "NOT_A_TARGET" };
  const own = hint5Ownership(ladder, input.storedFactIds, input.legacyPurchases, recipes);
  const expectedNext = own.nextIndex ?? ladder.rungs.length + 1;
  if (input.expectedRungIndex !== expectedNext) return { outcome: "REJECTED", reason: "STALE" };
  if (own.nextIndex === null) return { outcome: "LADDER_COMPLETE", addFactIds: [], charge: 0 };
  const rung = ladder.rungs[own.nextIndex - 1];
  const onboarding = isHintOnboardingFree(input.discoveredCount, ladder.recipeId);
  const price = onboarding ? 0 : HINT5_RUNG_PRICE[rung.kind];
  if (!Number.isFinite(input.pitzBalance) || input.pitzBalance < price) return { outcome: "REJECTED", reason: "INSUFFICIENT_PITZ" };
  if (own.statuses[rung.index - 1] === "EMPTY") return { outcome: "RESERVED_EMPTY_RUNG", rungIndex: rung.index, kind: rung.kind, addFactIds: [], charge: 0 };
  const known = new Set(own.knownNameIds);
  let addFactIds: string[];
  if (rung.kind === "STRUCTURE") addFactIds = [INGREDIENT_TOTAL_FACT_ID];
  else if (rung.kind === "SUB_CLASS") addFactIds = [hint5ClassFactId(rung.subjectIds[0])];
  else addFactIds = rung.subjectIds.filter((id) => !known.has(id)).map(hintFactId);
  return { outcome: "ANSWERED", rungIndex: rung.index, kind: rung.kind, addFactIds, charge: price, persist: !onboarding };
}

// ---- presentation (what a sheet may render: H5-INV-1..5) -------------------------------------------

export interface Hint5ClassView {
  family: AttributeFamilyId;
  /** The class symbol (never an ingredient glyph, G18). */
  symbol: string;
  labelJa: string;
  /** 「🥩 肉系」: never an ingredient name, id or glyph. */
  lineJa: string;
}

export type Hint5BoardEntry =
  | { rungIndex: number; kind: "SAUCE" | "CHEESE" | "KEY_TOPPING"; ingredientIds: readonly string[] }
  | { rungIndex: number; kind: "STRUCTURE"; lineJa: string }
  | { rungIndex: number; kind: "SUB_CLASS"; ordinal: number; classView: Hint5ClassView }
  /** A sub-topping whose name the player already bought under Hint 3.0 (their own fact). */
  | { rungIndex: number; kind: "SUB_CLASS"; ordinal: number; knownIngredientId: string };

export interface Hint5NextOffer {
  rungIndex: number;
  kind: Hint5RungKind;
  /** 「ヒント3: キートッピング」: the kind and index only, never the subject. */
  labelJa: string;
  price: number;
  affordable: boolean;
}

export interface Hint5Presentation {
  kind: "HINT5_LADDER";
  onboarding: boolean;
  /** Settled rungs, in ladder order. SUB_CLASS entries only once STRUCTURE is settled. */
  board: readonly Hint5BoardEntry[];
  /** Names the player already owns from earlier hint versions (catalog order). */
  legacyKnownIngredientIds: readonly string[];
  /** The next rung, or `null` once every rung is settled. */
  next: Hint5NextOffer | null;
  /** `HINT5_LADDER_COMPLETE_TEXT` when `next` is null, otherwise null. */
  completeText: string | null;
  pitzBalance: number;
}

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];

function circled(n: number): string {
  return CIRCLED[n - 1] ?? `(${n})`;
}

const RUNG_LABEL_JA: Readonly<Record<Exclude<Hint5RungKind, "SUB_CLASS">, string>> = {
  SAUCE: "ソース",
  CHEESE: "チーズ",
  KEY_TOPPING: "キートッピング",
  STRUCTURE: "構成（材料の数）",
};

export function hint5RungLabelJa(rung: Pick<Hint5Rung, "index" | "kind" | "ordinal">): string {
  const what = rung.kind === "SUB_CLASS" ? `サブトッピング${circled(rung.ordinal ?? 0)}の分類` : RUNG_LABEL_JA[rung.kind];
  return `ヒント${rung.index}: ${what}`;
}

/** The display of a family (OD-H5-C4 final). */
export function hint5ClassView(family: AttributeFamilyId): Hint5ClassView {
  const display = HINT_CLASS_DISPLAY[family];
  return { family, symbol: display.symbol, labelJa: display.labelJa, lineJa: `${display.symbol} ${display.labelJa}` };
}

/** The privacy-safe view model of one target's ladder, or `null` when it is not a target. */
export function hint5Presentation(
  input: Pick<Hint5RequestInput, "recipeId" | "discoveredCount" | "storedFactIds" | "legacyPurchases" | "pitzBalance">,
  recipes: readonly Recipe[] = RECIPES,
): Hint5Presentation | null {
  const ladder = buildHint5Ladder(input.recipeId, recipes);
  if (!ladder) return null;
  const own = hint5Ownership(ladder, input.storedFactIds, input.legacyPurchases, recipes);
  const onboarding = isHintOnboardingFree(input.discoveredCount, ladder.recipeId);
  const balance = Number.isFinite(input.pitzBalance) ? input.pitzBalance : 0;
  const structureSettled = isSettled(own.statuses[HINT5_FIXED_RUNG_KINDS.indexOf("STRUCTURE")]);
  const board: Hint5BoardEntry[] = [];
  for (const rung of ladder.rungs) {
    const status = own.statuses[rung.index - 1];
    if (!isSettled(status)) continue;
    if (rung.kind === "STRUCTURE") board.push({ rungIndex: rung.index, kind: "STRUCTURE", lineJa: deductionHintTextJa({ id: INGREDIENT_TOTAL_FACT_ID, total: ladder.total }) });
    else if (rung.kind === "SUB_CLASS") {
      if (!structureSettled) continue;
      const id = rung.subjectIds[0];
      const ordinal = rung.ordinal!;
      if (status === "ALREADY_KNOWN") board.push({ rungIndex: rung.index, kind: "SUB_CLASS", ordinal, knownIngredientId: id });
      else board.push({ rungIndex: rung.index, kind: "SUB_CLASS", ordinal, classView: hint5ClassView(subToppingClass(id)!) });
    } else board.push({ rungIndex: rung.index, kind: rung.kind, ingredientIds: rung.subjectIds });
  }
  let next: Hint5NextOffer | null = null;
  if (own.nextIndex !== null) {
    const rung = ladder.rungs[own.nextIndex - 1];
    const price = onboarding ? 0 : HINT5_RUNG_PRICE[rung.kind];
    next = { rungIndex: rung.index, kind: rung.kind, labelJa: hint5RungLabelJa(rung), price, affordable: balance >= price };
  }
  return {
    kind: "HINT5_LADDER",
    onboarding,
    board,
    legacyKnownIngredientIds: own.knownNameIds,
    next,
    completeText: next === null ? HINT5_LADDER_COMPLETE_TEXT : null,
    pitzBalance: balance,
  };
}
