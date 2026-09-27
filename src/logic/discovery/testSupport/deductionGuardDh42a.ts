/**
 * Discovery Hint 4.0 (Issue #253): a FROZEN reference copy of the DH4-2A guard as merged in PR #264
 * (`deductionGuard.ts` @ 7bb0116), kept only so the DH4-2B Pre-Implementation Gate tests can show
 * the P2-1 leak it had and that the hardened guard removes it. Test/analysis support only; never
 * imported by production code. Do not "fix" this file.
 *
 * Its hypothesis set used the one-sauce prior (every pizza has exactly one sauce): when the rest of
 * the recipe has a sauce no sauce is a hypothesis, when it has none only sauces are. A sauceless
 * recipe therefore dropped its real reserve from H.
 */
import { getIngredient } from "../../../data/ingredients";
import { ingredientAttributeFamily, ingredientAttributeGroup } from "../../../data/ingredientTaxonomy";
import { attributeAnswerForReserve, MIN_ATTRIBUTE_CANDIDATES, type ReserveAttributeAnswer } from "../deductionHint";
import type { ReserveParts } from "../deductionGuard";

const categoryOf = (id: string) => getIngredient(id)?.category ?? null;
const knownPart = (p: ReserveParts) => p.recipeIngredientIds.filter((id) => id !== p.reserveId);

function universeW(p: ReserveParts): string[] {
  const inRecipe = new Set(p.recipeIngredientIds);
  const otherSauce = knownPart(p).some((id) => categoryOf(id) === "sauce");
  const keep = (id: string) => categoryOf(id) !== null && !(otherSauce && categoryOf(id) === "sauce");
  return [p.reserveId, ...p.owned.filter((id) => !inRecipe.has(id))].filter(keep);
}

function hypotheses(p: ReserveParts): string[] {
  const known = new Set(knownPart(p));
  const knownHasSauce = [...known].some((id) => categoryOf(id) === "sauce");
  return [...new Set([p.reserveId, ...p.owned])].filter((id) => !known.has(id) && categoryOf(id) !== null && (categoryOf(id) === "sauce") !== knownHasSauce);
}

const dh41 = (p: ReserveParts) => attributeAnswerForReserve({ recipeIngredientIds: p.recipeIngredientIds, reserveId: p.reserveId, ownedIngredientIds: p.owned });

function classOf(level: "family" | "group" | "category", id: string): string {
  const category = categoryOf(id) ?? "unknown";
  if (level !== "category" && category === "topping") {
    const family = ingredientAttributeFamily(id);
    if (family) return level === "family" ? `family:${family}` : `group:${ingredientAttributeGroup(id)}`;
  }
  return `category:${category}`;
}

function strict(p: ReserveParts): ReserveAttributeAnswer {
  const w = universeW(p);
  for (const level of ["family", "group", "category"] as const) {
    const sizes = new Map<string, number>();
    for (const id of w) sizes.set(classOf(level, id), (sizes.get(classOf(level, id)) ?? 0) + 1);
    if ([...sizes.values()].every((n) => n >= MIN_ATTRIBUTE_CANDIDATES)) {
      const [lv, value] = classOf(level, p.reserveId).split(":");
      return { level: lv, [lv]: value, factId: `attr:${lv}:${value}` } as never;
    }
  }
  return { level: "existence", factId: "attr:existence" };
}

/** DH4-2A `guardedAnswerForParts` (7bb0116). */
export function dh42aGuardedAnswer(p: ReserveParts): ReserveAttributeAnswer | null {
  if (categoryOf(p.reserveId) === null) return null;
  const sizes = new Map<string, number>();
  for (const x of hypotheses(p)) {
    const a = dh41({ ...p, recipeIngredientIds: [...knownPart(p), x], reserveId: x });
    sizes.set(a ? a.factId : "none", (sizes.get(a ? a.factId : "none") ?? 0) + 1);
  }
  return [...sizes.values()].every((n) => n >= MIN_ATTRIBUTE_CANDIDATES) ? dh41(p) : strict(p);
}

/** DH4-2A `toppingClauseAllowedForParts` (7bb0116): T >= 1 of the REAL recipe + W sides. */
export function dh42aToppingClauseAllowed(p: ReserveParts): boolean {
  if (p.recipeIngredientIds.filter((id) => categoryOf(id) === "topping").length < 1) return false;
  const sides = new Map<string, number>();
  for (const id of universeW(p)) sides.set(categoryOf(id)!, (sides.get(categoryOf(id)!) ?? 0) + 1);
  return [...sides.values()].every((n) => n >= MIN_ATTRIBUTE_CANDIDATES);
}
