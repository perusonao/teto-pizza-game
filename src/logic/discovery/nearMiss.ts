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
 *
 * Original Pizza Recovery P2 hardening (docs/reports/TETO_ORIGINAL-PIZZA-RECOVERY_P2_RESULT-FEEDBACK_Result.md):
 * - **Unreachable targets are never candidates.** A target whose identity (items + sauceBase) is
 *   shared with another catalog target is AMBIGUOUS in the matcher, so "add one" toward it would end
 *   as an ORIGINAL again -- a lie. Such a target is skipped (an exact match with it still means "no
 *   near-miss statement", never a line about some other recipe). Production has none today.
 * - **A sauce-only difference names its step** (`sauceStep`): CHANGE when both sides have a sauce,
 *   ADD when the pizza has none, REMOVE when the target has none. The kind stays `SAUCE_ONLY`; the
 *   line's wording is chosen from the step (../../state/resultNearMiss.ts), so a sauce-less pizza or
 *   a sauce-less recipe is never told to "change the sauce".
 * - Nothing here reads hint facts, Pitz or the Hint 5.0 ladder: the classes carry no component
 *   identity, so they cannot stand in for a paid rung.
 */
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { RECIPES, type Recipe } from "../../data/recipes";
import { compareHintCandidates } from "./hintTarget";
import { hintKeyIngredientId } from "./hintSteps";
import type { DiscoveryTarget } from "./matcher";
import type { RuntimeSignature } from "./signature";

/** `LATE_ONLY` (FIN-E2, #604): the ingredients and the base are right and only WHEN a piece was placed (the `late` axis) differs.
 *  Internal classification only: no production RESULT line reads it (the RESULT near-miss is the single neutral line). */
export type NearMissKind = "ADD_ONE" | "REMOVE_ONE" | "SAUCE_ONLY" | "LATE_ONLY" | "CLOSE" | "FAR";

/** SAUCE_ONLY only: what the sauce difference actually is (drives the wording, never shown). */
export type SauceStep = "CHANGE" | "ADD" | "REMOVE";

export interface NearMiss {
  kind: NearMissKind;
  distance: number;
  /** SAUCE_ONLY only. */
  sauceStep?: SauceStep;
  /** FAR only: the nearest candidate's key ingredient is not on the pizza (drives the
   *  「新しく入荷した材料は使ってみた？」 line). A flag, never the ingredient itself. */
  keyUnused?: boolean;
}

export interface NearMissOptions {
  /** Identity source; the runtime catalog in production, injectable for synthetic tests. */
  catalog?: readonly (Pick<DiscoveryTarget, "items" | "sauceBase"> & { recipeId: string; identityDimensions?: Partial<Pick<DiscoveryTarget["identityDimensions"], "late" | "pan">> })[];
  /** Declaration order for the tie-break; `RECIPES` in production. */
  recipes?: readonly Recipe[];
}

interface Distance {
  missing: number;
  extra: number;
  sauceWrong: boolean;
  /** Which way the sauce differs (only meaningful when `sauceWrong`). */
  sauceStep: SauceStep;
  /** The `late` axis differs (FIN-E2). Counts 1 toward `total`; always false for a pizza and a target that both have no late piece. */
  lateWrong: boolean;
  total: number;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

function distance(signature: RuntimeSignature, items: readonly string[], sauceBase: readonly string[], targetLate: unknown = []): Distance {
  const pizzaSauces = signature.sauceBase.value;
  const pizza = signature.ingredientSet.value.filter((id) => !pizzaSauces.includes(id));
  const target = items.filter((id) => !sauceBase.includes(id));
  const missing = target.filter((id) => !pizza.includes(id)).length;
  const extra = pizza.filter((id) => !target.includes(id)).length;
  const sauceWrong = !sameList(pizzaSauces, sauceBase);
  const sauceStep: SauceStep = pizzaSauces.length === 0 ? "ADD" : sauceBase.length === 0 ? "REMOVE" : "CHANGE";
  // Same comparison the matcher makes (canonical JSON), on the one observed `late` axis; a non-observed axis is assumed default.
  const lateAxis = signature.dimensions?.late; // optional: a hand-built partial signature has no dimensions
  const lateWrong = lateAxis !== undefined && lateAxis.status !== "UNAVAILABLE" && JSON.stringify(lateAxis.value) !== JSON.stringify(targetLate);
  return { missing, extra, sauceWrong, sauceStep, lateWrong, total: missing + extra + (sauceWrong ? 1 : 0) + (lateWrong ? 1 : 0) };
}

const identityKey = (t: Pick<DiscoveryTarget, "items" | "sauceBase"> & { identityDimensions?: { late?: unknown } }) =>
  JSON.stringify([[...t.items].sort(), [...(t.sauceBase ?? [])].sort(), t.identityDimensions?.late ?? []]);

/** Identity keys shared by two or more catalog targets: the matcher answers AMBIGUOUS for them. */
function collidingIdentityKeys(catalog: readonly Parameters<typeof identityKey>[0][]): Set<string> {
  const seen = new Set<string>();
  const colliding = new Set<string>();
  for (const t of catalog) {
    const key = identityKey(t);
    if (seen.has(key)) colliding.add(key);
    seen.add(key);
  }
  return colliding;
}

function classify(d: Distance): NearMissKind {
  if (d.total === 1) return d.missing === 1 ? "ADD_ONE" : d.extra === 1 ? "REMOVE_ONE" : d.lateWrong ? "LATE_ONLY" : "SAUCE_ONLY";
  return d.total === 2 ? "CLOSE" : "FAR";
}

export function classifyNearMiss(
  signature: RuntimeSignature,
  discoverableRecipes: readonly Recipe[],
  options: NearMissOptions = {},
): NearMiss | null {
  const catalog = options.catalog ?? RECIPE_DISCOVERY_CATALOG;
  const recipes = options.recipes ?? RECIPES;
  const colliding = collidingIdentityKeys(catalog);
  const ordered = [...discoverableRecipes].sort((a, b) => compareHintCandidates(a, b, recipes));
  // Square Dough E-2: a target on another pan (grandma-pizza declares `pan: "tray"`) cannot be reached by adding / removing an ingredient, so it is never a near-miss
  // candidate for a pizza cooked on a different pan -- the line would otherwise promise a discovery the matcher refuses. A pizza and a target both without a pan (every
  // other recipe) compare equal, so their behaviour is unchanged. (The pan itself is never hinted at: the pan axis is not a distance.)
  const panAxis = signature.dimensions?.pan; // optional: a hand-built partial signature has no dimensions
  const pizzaPan = panAxis !== undefined && panAxis.status === "OBSERVED" ? panAxis.value : null;

  let best: { recipe: Recipe; d: Distance } | null = null;
  for (const recipe of ordered) {
    for (const target of catalog.filter((t) => t.recipeId === recipe.id)) {
      if ((target.identityDimensions?.pan ?? null) !== pizzaPan) continue;
      const d = distance(signature, target.items, target.sauceBase ?? [], target.identityDimensions?.late ?? []);
      if (d.total === 0) return null;
      if (colliding.has(identityKey(target))) continue; // unreachable: the matcher says AMBIGUOUS
      if (!best || d.total < best.d.total) best = { recipe, d };
    }
  }
  if (!best) return null;

  const kind = classify(best.d);
  if (kind === "SAUCE_ONLY") return { kind, distance: best.d.total, sauceStep: best.d.sauceStep };
  if (kind !== "FAR") return { kind, distance: best.d.total };
  const keyId = hintKeyIngredientId(best.recipe);
  return { kind, distance: best.d.total, keyUnused: keyId !== null && !signature.ingredientSet.value.includes(keyId) };
}
