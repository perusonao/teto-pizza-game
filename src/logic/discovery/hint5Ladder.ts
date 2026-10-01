/**
 * Discovery Hint 5.0 (Issue #292): the Sub-topping Classification Ladder pure layer (H5-1). The hint
 * state module reads it behind the Hint 5.0 flag (H5-2 / H5-3); H5-4 adds the round-6 empty rungs.
 *
 * Authority: docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md (Owner Decisions OD-H5-P1..P3,
 * C1..C4, C1a / C1b / C1-P, U1, E1..E3, E3b, M1, M3, T-COV, and round 6: P4-CHEESE, P4b, M2 = all 25;
 * P4-SAUCE stays reserved for TQ-1D).
 *
 * ## The ladder (§5)
 *
 *   1 SAUCE (every sauce) -> 2 CHEESE (every cheese) -> 3 KEY_TOPPING -> 4 STRUCTURE
 *   -> 5.. SUB_CLASS ①..ⓝ (one per sub-topping, `hintSubToppingOrder`)
 *
 * - Key-free recipes (Discovery 3.0 PR-3, OD-D3-21; `KeyFreeHintRoles`) build only the applicable
 *   rungs: SAUCE / CHEESE only when the recipe has one, no KEY_TOPPING, no empty or "none" rung,
 *   then STRUCTURE and every topping as SUB_CLASS in catalog order. No production recipe is key-free.
 * - Strictly linear: only the next unsettled rung can be requested (`expectedRungIndex`).
 * - Rungs 1-4 exist for every target, with the same labels and prices (FREE LEAK, H5-INV-5).
 *   The SUB_CLASS rungs are presented only once STRUCTURE is settled.
 * - A sub-topping is **classified, never named** (OD-H5-C3). The classification is its DH4-1 family,
 *   shown through ../../data/hintClassDisplay.ts. There is **no k >= 2 rule** (OD-H5-P1 / P2): the
 *   answer depends on the recipe only, never on the owned set, so it may narrow the candidates to
 *   one. That is deduction, not disclosure.
 * - 0 sub-toppings -> no SUB_CLASS rung (OD-H5-P3).
 * - **An empty fixed rung** is never skipped, and before purchase it looks like any other rung (§5.3):
 *   - no cheese (OD-H5-P4-CHEESE) / no key topping (OD-H5-P4b): a normal paid rung. The answer is
 *     "none" (`none: true` on its board entry), stored as its completion record only;
 *   - no sauce (OD-H5-P4-SAUCE, reserved for TQ-1D): `RESERVED_EMPTY_RUNG` (0 Pitz, no fact). "No
 *     sauce" is the Technique `no-sauce`, so nothing here ever says it (H5-INV-4). The production gates
 *     keep every such recipe out of the target set (`hint5ReservedRungs`, G7).
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
 * ## Stored facts (§6.3, §9) and OD-H5-M3
 *
 * - A bought name rung stores the new `ing:<id>` names (the Hint 3.0 kind) plus its completion
 *   record (`h5:sauce` / `h5:cheese` / `h5:key`).
 * - STRUCTURE stores `meta:ingredient-total` (DH4) when new, plus `h5:structure`.
 * - SUB_CLASS stores `cls:<ingredientId>`, which is its own completion record. That id lives in the
 *   save only: no presentation field carries it (H5-INV-1).
 *
 * M3: existing facts are read, never rewritten, converted or deleted (E3), and they NEVER complete a
 * rung. So the pre-purchase view (next rung, kind, price, purchasable) is the same with or without
 * them. At request time they decide one thing: an affordable request whose rung is ALL known completes
 * for 0 Pitz (ALREADY_KNOWN). A PARTIALLY known or NONE known rung costs the normal price. Legacy
 * facts that count here:
 * - `ing:` names and the legacy Economy 1.0 grants;
 * - `meta:ingredient-total` or the legacy count line;
 * - an `attr:family:<f>` about the Rule W reserve when the reserve is that sub-topping and its
 *   family is still f.
 *
 * Coarse `attr:group` / `attr:category` facts count for nothing (E3b), and neither does the Hint 3.0
 * free key (M1).
 *
 * Inputs from outside are untrusted: lookups use arrays, Sets, Maps and `hasOwnProperty`.
 */
import { HINT_CLASS_DISPLAY } from "../../data/hintClassDisplay";
import { getIngredient, INGREDIENTS, type IngredientCategory } from "../../data/ingredients";
import { ingredientAttributeFamily, type AttributeFamilyId } from "../../data/ingredientTaxonomy";
import { RECIPE_HINT_ROLES, type HintRolesEntry, type KeyFreeHintRoles } from "../../data/recipeHintRoles";
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

export function isKeyFreeRoles(roles: HintRolesEntry | null | undefined): roles is KeyFreeHintRoles {
  return !!roles && (roles as KeyFreeHintRoles).keyFree === true;
}

function rolesOf(recipeId: string, roles: Readonly<Record<string, HintRolesEntry>>): HintRolesEntry | null {
  return Object.prototype.hasOwnProperty.call(roles, recipeId) ? roles[recipeId] : null;
}

/**
 * OD-H5-C1 (G17): the authored roles are consistent with the recipe. `hintKeyToppingId` is a topping of
 * the recipe (null only when it has none), and `hintSubToppingOrder` is exactly its other toppings,
 * each once. Every recipe ingredient is a catalog ingredient (G22), and every sub-topping resolves to
 * one family (T-COV). Anything else is not a target.
 */
export function hint5RolesValid(recipe: Recipe, roles: HintRolesEntry | null): boolean {
  if (!roles) return false;
  const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
  if (isKeyFreeRoles(roles)) {
    // PR-3 key-free: nothing is authored, so only the catalog / T-COV checks apply.
    return ids.every((id) => typeof id === "string" && getIngredient(id)) && ids.filter((id) => getIngredient(id)!.category === "topping").every((id) => subToppingClass(id) !== null);
  }
  if (!Array.isArray(roles.hintSubToppingOrder)) return false;
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
  roles: Readonly<Record<string, HintRolesEntry>> = RECIPE_HINT_ROLES,
): Hint5Ladder | null {
  const recipe = findRecipe(recipeId, recipes);
  if (!recipe) return null;
  const own = rolesOf(recipe.id, roles);
  if (!own || !hint5RolesValid(recipe, own)) return null;
  const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
  const inCategory = (category: IngredientCategory) => byCatalogOrder(ids.filter((id) => getIngredient(id)!.category === category));
  if (isKeyFreeRoles(own)) {
    // PR-3 (OD-D3-21): only the rungs that apply. No KEY_TOPPING, no empty / "none" rung.
    const sauce = inCategory("sauce");
    const cheese = inCategory("cheese");
    const keyFree: [Hint5RungKind, readonly string[]][] = [];
    if (sauce.length > 0) keyFree.push(["SAUCE", sauce]);
    if (cheese.length > 0) keyFree.push(["CHEESE", cheese]);
    keyFree.push(["STRUCTURE", []]);
    const rungsKeyFree: Hint5Rung[] = keyFree.map(([kind, subjectIds], i) => ({ index: i + 1, kind, ordinal: null, subjectIds }));
    inCategory("topping").forEach((id, i) => rungsKeyFree.push({ index: rungsKeyFree.length + 1, kind: "SUB_CLASS", ordinal: i + 1, subjectIds: [id] }));
    return { recipeId: recipe.id, rungs: rungsKeyFree, total: ids.length };
  }
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

/** The fixed rungs of `recipeId` that have no subject; `null` = not a target. */
export function hint5EmptyFixedRungs(recipeId: unknown, recipes?: readonly Recipe[]): Hint5RungKind[] | null {
  const ladder = buildHint5Ladder(recipeId, recipes);
  if (!ladder) return null;
  return ladder.rungs.filter((r) => r.kind !== "STRUCTURE" && r.kind !== "SUB_CLASS" && r.subjectIds.length === 0).map((r) => r.kind);
}

/** Round 6: an empty CHEESE / KEY rung is answered "none" (OD-H5-P4-CHEESE, OD-H5-P4b); only an empty
 *  SAUCE rung stays RESERVED (OD-H5-P4-SAUCE, TQ-1D). */
function isReservedRung(rung: Hint5Rung): boolean {
  return rung.kind === "SAUCE" && rung.subjectIds.length === 0;
}

/** The rungs of `recipeId` a request could only get `RESERVED_EMPTY_RUNG` for; `null` = not a target.
 *  The production gate (M2 condition 3) requires `[]` for every production recipe. */
export function hint5ReservedRungs(recipeId: unknown, recipes?: readonly Recipe[]): Hint5RungKind[] | null {
  const ladder = buildHint5Ladder(recipeId, recipes);
  if (!ladder) return null;
  return ladder.rungs.filter(isReservedRung).map((r) => r.kind);
}

// ---- ownership (Hint 5.0 completion records + the M3 request-time "already known" check) ----------

/**
 * OD-H5-M3 (Owner Decision, round 5): a rung is COMPLETED only by a Hint 5.0 completion record:
 * - `h5:sauce` / `h5:cheese` / `h5:key` / `h5:structure` for the fixed rungs;
 * - `cls:<ingredientId>` for a sub-topping.
 *
 * Legacy facts never complete a rung, so they never change the pre-purchase view (which rung is
 * next, its kind, its price, whether it can be bought). They count only at request time: when
 * everything the requested rung would disclose is already known, the request completes it for
 * 0 Pitz (ALREADY_KNOWN). Legacy facts here are `ing:` names, Economy 1.0 grants,
 * `meta:ingredient-total` / the legacy count line, and the E3 `attr:family` safe mapping.
 */
export const HINT5_RUNG_MARKER: Readonly<Record<Exclude<Hint5RungKind, "SUB_CLASS">, string>> = {
  SAUCE: "h5:sauce",
  CHEESE: "h5:cheese",
  KEY_TOPPING: "h5:key",
  STRUCTURE: "h5:structure",
};

/**
 * - COMPLETED: completed on the Hint 5.0 ladder (bought, or completed free as already known).
 * - EMPTY: an empty SAUCE rung (RESERVED_EMPTY_RUNG; OD-H5-P4-SAUCE, TQ-1D). An empty CHEESE / KEY
 *   rung is a normal rung (OPEN or COMPLETED).
 * - OPEN: not completed. It says nothing about what the player already knows.
 */
export type Hint5RungStatus = "COMPLETED" | "EMPTY" | "OPEN";

export interface Hint5Ownership {
  statuses: readonly Hint5RungStatus[];
  /**
   * INTERNAL, request-time only (never presentation): everything this rung would disclose is
   * already known from stored or legacy facts. Deciding it compares the player's facts against the
   * target's unbought content, so exposing it before a request would be a FREE LEAK.
   */
  allKnown: readonly boolean[];
  /** Ingredient names the player owns from earlier hint versions, catalog order. They come from
   *  the stored `ing:` ids of this recipe's ledger (any catalog id, whether or not it is in the
   *  recipe, so the list never depends on the target) and the lines their legacy Economy 1.0
   *  levels showed. */
  knownNameIds: readonly string[];
  /** 1-based index of the first rung that is not COMPLETED, or `null` when every rung is. */
  nextIndex: number | null;
}

function storedStrings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

function completionFactId(rung: Hint5Rung): string {
  return rung.kind === "SUB_CLASS" ? hint5ClassFactId(rung.subjectIds[0]) : HINT5_RUNG_MARKER[rung.kind];
}

export function hint5Ownership(
  ladder: Hint5Ladder,
  storedFactIds: unknown,
  legacyPurchases: unknown,
  recipes: readonly Recipe[] = RECIPES,
): Hint5Ownership {
  const stored = storedStrings(storedFactIds);
  const storedSet = new Set(stored);
  const recipe = recipes.find((r) => r.id === ladder.recipeId)!;
  const known = new Set<string>();
  for (const id of stored) {
    const name = parseHintFactId(id);
    if (name !== null && getIngredient(name)) known.add(name);
  }
  for (const id of legacyHintMapping(ladder.recipeId, legacyPurchases, recipes)?.grantedFactIds ?? []) {
    const name = parseHintFactId(id);
    if (name !== null && getIngredient(name)) known.add(name);
  }
  const attrFamilies = new Set(stored.map(parseAttributeFactId).flatMap((a) => (a && a.level === "family" ? [a.family] : [])));
  const reserve = reservedIngredientId(recipe);
  const totalKnown = storedSet.has(INGREDIENT_TOTAL_FACT_ID) || legacyOwnsIngredientTotal(ladder.recipeId, legacyPurchases, recipes);

  const statuses: Hint5RungStatus[] = [];
  const allKnown: boolean[] = [];
  for (const rung of ladder.rungs) {
    const reserved = isReservedRung(rung);
    statuses.push(reserved ? "EMPTY" : storedSet.has(completionFactId(rung)) ? "COMPLETED" : "OPEN");
    if (reserved) allKnown.push(false);
    else if (rung.subjectIds.length === 0 && rung.kind === "CHEESE") {
      // OD-H5-P4-CHEESE + M3: the only legacy fact that states "no cheese" is the Economy 1.0 count
      // line (「チーズは使わないみたい」). The DH4 `meta:ingredient-total` line states a total only.
      allKnown.push(legacyOwnsIngredientTotal(ladder.recipeId, legacyPurchases, recipes));
    } else if (rung.subjectIds.length === 0 && rung.kind === "KEY_TOPPING") {
      // OD-H5-P4b: no legacy fact states "no key topping", so it is never already known.
      allKnown.push(false);
    } else if (rung.kind === "STRUCTURE") allKnown.push(totalKnown);
    else if (rung.kind === "SUB_CLASS") {
      const id = rung.subjectIds[0];
      const family = subToppingClass(id);
      // The name implies the classification. E3 safe mapping: an old 特徴 family answer about this
      // exact sub-topping (the Rule W reserve) that still matches its family. Coarse answers never
      // count (E3b).
      allKnown.push(known.has(id) || (id === reserve && family !== null && attrFamilies.has(family)));
    } else allKnown.push(rung.subjectIds.every((id) => known.has(id)));
  }
  const next = statuses.findIndex((s) => s !== "COMPLETED");
  return { statuses, allKnown, knownNameIds: byCatalogOrder([...known]), nextIndex: next < 0 ? null : next + 1 };
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
  /** OD-H5-M3: everything this rung discloses was already known. It is completed for 0 Pitz, and
   *  only its completion record is stored (no known fact is stored twice). */
  | { outcome: "ALREADY_KNOWN"; rungIndex: number; kind: Hint5RungKind; addFactIds: readonly string[]; charge: 0; persist: boolean }
  | { outcome: "RESERVED_EMPTY_RUNG"; rungIndex: number; kind: Hint5RungKind; addFactIds: readonly []; charge: 0 }
  | { outcome: "LADDER_COMPLETE"; addFactIds: readonly []; charge: 0 }
  | { outcome: "REJECTED"; reason: Hint5Rejection };

/**
 * One request, in a fixed order so that a refusal never depends on what is left or what is known:
 * target -> STALE -> complete -> price and balance (the normal P-C price of the rung kind) -> empty
 * rung -> already known (M3) -> answer.
 *
 * - The balance check uses the normal price even when the rung turns out to be already known. So
 *   the 0-Pitz completion can only be discovered by an affordable request, never before one (M3).
 * - ALL known -> ALREADY_KNOWN, 0 Pitz, only the completion record.
 * - PARTIALLY known or NONE known -> ANSWERED at the normal price, with the new facts and the
 *   completion record.
 * - An empty CHEESE / KEY rung (round 6) is ANSWERED like any other; its answer is "none", so it adds
 *   its completion record only.
 * - Rejections, a RESERVED (empty SAUCE) rung and a complete ladder charge 0 and add no fact
 *   (H5-INV-6).
 * - A COMPLETED rung is never offered again.
 */
export function requestHint5Rung(
  input: Hint5RequestInput,
  recipes: readonly Recipe[] = RECIPES,
  roles: Readonly<Record<string, HintRolesEntry>> = RECIPE_HINT_ROLES,
): Hint5RequestResult {
  const ladder = buildHint5Ladder(input.recipeId, recipes, roles);
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
  const stored = new Set(storedStrings(input.storedFactIds));
  const completion = completionFactId(rung);
  if (own.allKnown[rung.index - 1]) {
    return { outcome: "ALREADY_KNOWN", rungIndex: rung.index, kind: rung.kind, addFactIds: [completion], charge: 0, persist: !onboarding };
  }
  const known = new Set(own.knownNameIds);
  let info: string[];
  if (rung.kind === "STRUCTURE") info = stored.has(INGREDIENT_TOTAL_FACT_ID) ? [] : [INGREDIENT_TOTAL_FACT_ID];
  else if (rung.kind === "SUB_CLASS") info = [];
  else info = rung.subjectIds.filter((id) => !known.has(id)).map(hintFactId);
  return { outcome: "ANSWERED", rungIndex: rung.index, kind: rung.kind, addFactIds: [...info, completion], charge: price, persist: !onboarding };
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
  /** `none`: a COMPLETED empty CHEESE / KEY rung (round 6), shown as 「チーズ：なし」 /
   *  「キートッピング：なし」. Only ever on a completed rung, so never before purchase. */
  | { rungIndex: number; kind: "SAUCE" | "CHEESE" | "KEY_TOPPING"; ingredientIds: readonly string[]; none: boolean }
  | { rungIndex: number; kind: "STRUCTURE"; lineJa: string }
  | { rungIndex: number; kind: "SUB_CLASS"; ordinal: number; classView: Hint5ClassView };

export interface Hint5NextOffer {
  rungIndex: number;
  kind: Hint5RungKind;
  /** 「ヒント3: キートッピング」: the kind and index only, never the subject. */
  labelJa: string;
  /** Always the normal P-C price of the kind (M3: never 0 because something is already known). */
  price: number;
  affordable: boolean;
}

export interface Hint5Presentation {
  kind: "HINT5_LADDER";
  onboarding: boolean;
  /** COMPLETED rungs, in ladder order. */
  board: readonly Hint5BoardEntry[];
  /** Names the player already owns from earlier hint versions (catalog order): an archive that
   *  never depends on the target's unbought content. */
  legacyKnownIngredientIds: readonly string[];
  /** The next rung, or `null` once every rung is completed. */
  next: Hint5NextOffer | null;
  /** `HINT5_LADDER_COMPLETE_TEXT` when `next` is null, otherwise null. */
  completeText: string | null;
  pitzBalance: number;
}

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];

export function circledOrdinal(n: number): string {
  return CIRCLED[n - 1] ?? `(${n})`;
}

const RUNG_LABEL_JA: Readonly<Record<Exclude<Hint5RungKind, "SUB_CLASS">, string>> = {
  SAUCE: "ソース",
  CHEESE: "チーズ",
  KEY_TOPPING: "キートッピング",
  STRUCTURE: "構成（材料の数）",
};

export function hint5RungLabelJa(rung: Pick<Hint5Rung, "index" | "kind" | "ordinal">): string {
  const what = rung.kind === "SUB_CLASS" ? `サブトッピング${circledOrdinal(rung.ordinal ?? 0)}の分類` : RUNG_LABEL_JA[rung.kind];
  return `ヒント${rung.index}: ${what}`;
}

/** The display of a family (OD-H5-C4 final). */
export function hint5ClassView(family: AttributeFamilyId): Hint5ClassView {
  const display = HINT_CLASS_DISPLAY[family];
  return { family, symbol: display.symbol, labelJa: display.labelJa, lineJa: `${display.symbol} ${display.labelJa}` };
}

/** The privacy-safe view model of one target's ladder, or `null` when it is not a target. It never
 *  reads `allKnown` (M3): legacy facts change nothing here except the archive of the player's own
 *  names. */
export function hint5Presentation(
  input: Pick<Hint5RequestInput, "recipeId" | "discoveredCount" | "storedFactIds" | "legacyPurchases" | "pitzBalance">,
  recipes: readonly Recipe[] = RECIPES,
  roles: Readonly<Record<string, HintRolesEntry>> = RECIPE_HINT_ROLES,
): Hint5Presentation | null {
  const ladder = buildHint5Ladder(input.recipeId, recipes, roles);
  if (!ladder) return null;
  const own = hint5Ownership(ladder, input.storedFactIds, input.legacyPurchases, recipes);
  const onboarding = isHintOnboardingFree(input.discoveredCount, ladder.recipeId);
  const balance = Number.isFinite(input.pitzBalance) ? input.pitzBalance : 0;
  const board: Hint5BoardEntry[] = [];
  // SUB_CLASS entries appear only once STRUCTURE is completed (§8: the sub-topping count is paid
  // information), even if a `cls:` record were stored earlier.
  const structureCompleted = own.statuses[ladder.rungs.findIndex((r) => r.kind === "STRUCTURE")] === "COMPLETED";
  for (const rung of ladder.rungs) {
    if (own.statuses[rung.index - 1] !== "COMPLETED") continue;
    if (rung.kind === "SUB_CLASS" && !structureCompleted) continue;
    if (rung.kind === "STRUCTURE") board.push({ rungIndex: rung.index, kind: "STRUCTURE", lineJa: deductionHintTextJa({ id: INGREDIENT_TOTAL_FACT_ID, total: ladder.total }) });
    else if (rung.kind === "SUB_CLASS") board.push({ rungIndex: rung.index, kind: "SUB_CLASS", ordinal: rung.ordinal!, classView: hint5ClassView(subToppingClass(rung.subjectIds[0])!) });
    else board.push({ rungIndex: rung.index, kind: rung.kind, ingredientIds: rung.subjectIds, none: rung.subjectIds.length === 0 });
  }
  let next: Hint5NextOffer | null = null;
  if (own.nextIndex !== null) {
    const rung = ladder.rungs[own.nextIndex - 1];
    const price = onboarding ? 0 : HINT5_RUNG_PRICE[rung.kind];
    next = { rungIndex: rung.index, kind: rung.kind, labelJa: hint5RungLabelJa(rung), price, affordable: balance >= price };
  }
  // The archive holds only names the ladder has not shown yet: a name a COMPLETED name rung already
  // shows on the board is not repeated there. Those names are on screen already, so dropping them
  // reveals nothing.
  const onBoard = new Set(board.flatMap((e) => ("ingredientIds" in e ? e.ingredientIds : [])));
  return {
    kind: "HINT5_LADDER",
    onboarding,
    board,
    legacyKnownIngredientIds: own.knownNameIds.filter((id) => !onBoard.has(id)),
    next,
    completeText: next === null ? HINT5_LADDER_COMPLETE_TEXT : null,
    pitzBalance: balance,
  };
}
