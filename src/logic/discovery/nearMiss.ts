/**
 * Discovery Hint 2.0 (Issue #229, slice 229-A): how close a finished pizza is to a recipe the
 * player could discover right now ("おしい" feedback). Pure and unwired -- 229-C decides where
 * a class is shown (ORIGINAL / ALREADY_DISCOVERED; never AMBIGUOUS; no FAILED signal, OD-HINT-5
 * is OFF).
 *
 * Authority: docs/reports/TETO_DISCOVERY-HINT-2_FRESH-AUDIT.md §4 (on the audit branch).
 *
 * - A display-only classification after the matcher. It never changes `resolveFreeCookPizza` /
 *   `evaluateDiscovery` / the Dex; it compares the same identity the matcher does
 *   (`RECIPE_DISCOVERY_CATALOG` items + sauceBase) on the two OBSERVED axes only:
 *     d = |missing non-sauce| + |extra non-sauce| + (sauceBase differs ? 1 : 0)
 * - Only against the DISCOVERABLE recipes the caller passes (never UNKNOWN / DISCOVERED).
 * - d = 0 against any candidate is an exact match -> `null` (discovery always wins; that is also
 *   what an ambiguous duplicate target resolves to). Nearest candidate wins, ties broken by the
 *   hint-target order (`compareHintCandidates`).
 * - The result says only the class: never the recipe, never which ingredient to add or remove.
 */
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { RECIPES, type Recipe } from "../../data/recipes";
import { compareHintCandidates } from "./hintTarget";
import { hintKeyIngredientId } from "./hintSteps";
import type { DiscoveryTarget } from "./matcher";
import type { RuntimeSignature } from "./signature";

export type NearMissKind = "ADD_ONE" | "REMOVE_ONE" | "SAUCE_ONLY" | "CLOSE" | "FAR";

export interface NearMiss {
  kind: NearMissKind;
  distance: number;
  /** FAR only: the nearest candidate's key ingredient is not on the pizza (drives the
   *  「新しく入荷した材料は使ってみた？」 line). A flag, never the ingredient itself. */
  keyUnused?: boolean;
}

export interface NearMissOptions {
  /** Identity source; the runtime catalog in production, injectable for synthetic tests. */
  catalog?: readonly (Pick<DiscoveryTarget, "items" | "sauceBase"> & { recipeId: string })[];
  /** Declaration order for the tie-break; `RECIPES` in production. */
  recipes?: readonly Recipe[];
}

interface Distance {
  missing: number;
  extra: number;
  sauceWrong: boolean;
  total: number;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

function distance(signature: RuntimeSignature, items: readonly string[], sauceBase: readonly string[]): Distance {
  const pizzaSauces = signature.sauceBase.value;
  const pizza = signature.ingredientSet.value.filter((id) => !pizzaSauces.includes(id));
  const target = items.filter((id) => !sauceBase.includes(id));
  const missing = target.filter((id) => !pizza.includes(id)).length;
  const extra = pizza.filter((id) => !target.includes(id)).length;
  const sauceWrong = !sameList(pizzaSauces, sauceBase);
  return { missing, extra, sauceWrong, total: missing + extra + (sauceWrong ? 1 : 0) };
}

function classify(d: Distance): NearMissKind {
  if (d.total === 1) return d.missing === 1 ? "ADD_ONE" : d.extra === 1 ? "REMOVE_ONE" : "SAUCE_ONLY";
  return d.total === 2 ? "CLOSE" : "FAR";
}

export function classifyNearMiss(
  signature: RuntimeSignature,
  discoverableRecipes: readonly Recipe[],
  options: NearMissOptions = {},
): NearMiss | null {
  const catalog = options.catalog ?? RECIPE_DISCOVERY_CATALOG;
  const recipes = options.recipes ?? RECIPES;
  const ordered = [...discoverableRecipes].sort((a, b) => compareHintCandidates(a, b, recipes));

  let best: { recipe: Recipe; d: Distance } | null = null;
  for (const recipe of ordered) {
    for (const target of catalog.filter((t) => t.recipeId === recipe.id)) {
      const d = distance(signature, target.items, target.sauceBase ?? []);
      if (d.total === 0) return null;
      if (!best || d.total < best.d.total) best = { recipe, d };
    }
  }
  if (!best) return null;

  const kind = classify(best.d);
  if (kind !== "FAR") return { kind, distance: best.d.total };
  const keyId = hintKeyIngredientId(best.recipe);
  return { kind, distance: best.d.total, keyUnused: keyId !== null && !signature.ingredientSet.value.includes(keyId) };
}
