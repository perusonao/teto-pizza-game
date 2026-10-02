import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { getIngredient } from "../data/ingredients";
import { countsTowardLadder, getRecipe, RECIPES, type RecipeId } from "../data/recipes";
import { DexOverlay } from "../components/DexOverlay";
import { evaluateDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { selectHintTarget } from "../logic/discovery/hintTarget";
import { poolOf, walkState, W1_ORDER, type WalkState } from "../logic/testSupport/branchingFixture";
import { discoveredRecipeCount } from "../logic/discoveryLadder";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { discoveredRecipeIds } from "./dex";
import { hintSheetView, resolveHintSession, type DiscoveryHintState } from "./discoveryHint";
import { resolveShopEntitlement } from "./materialEntitlement";

/**
 * Discovery 3.0 PR-4b-B: the FIRST production Discovery pool > 1. At the onion step (the W1 step
 * that makes pizza-portuguesa DISCOVERABLE) the 26th recipe, brazilian-calabresa, is makeable too:
 * a pool of 2 on real production data. D-1 / D-2 / D-3 hold; both orders (A -> B, B -> A) finish
 * with no softlock and a consistent ledger; the non-credit recipe never moves the W1 ladder.
 */

afterEach(() => cleanup());

const A = "pizza-portuguesa";
const B = "brazilian-calabresa";
const ONION_STEP = DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes("onion"))!.step;
const BEFORE_ONION = W1_ORDER.slice(0, ONION_STEP); // 12 found: the key recipe of step 12 is next
const ALL_26 = [...W1_ORDER, B];
/** The 26 recipes of this PR-4b-B slice: production minus No.27 pesto-pollo (appended step 25 -- its own
 *  pool behaviour is pinned in the No.27 vertical-slice test, not here). */
const RECIPES_26 = RECIPES.filter((r) => r.id !== "pesto-pollo");

const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
function pizzaOf(ids: readonly string[]): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ids.filter(isSauce),
    toppings: ids.filter((id) => !isSauce(id)).map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 3, y: 50 })),
    bakeResult: 68,
  };
}
const idsOf = (id: string) => [...new Set(getRecipe(id as RecipeId)!.requiredIngredients.map((r) => r.ingredientId))];

function hintState(w: WalkState): DiscoveryHintState {
  return {
    dex: w.dex,
    ownedIngredientIds: w.ownedIngredientIds,
    unlockedForShopIngredientIds: w.unlockedForShopIngredientIds,
    inventory: w.inventory,
    preDiscoveryFreeCookAttempts: 0,
    hintSession: null,
    pitzBalance: 1000,
    discoveryHintPurchases: {},
    discoveryHintFacts: {},
  };
}

describe("production pool 2 at the onion step", () => {
  const w = walkState(BEFORE_ONION);

  it("pizza-portuguesa and brazilian-calabresa are both DISCOVERABLE: the pool is exactly 2", () => {
    expect(ONION_STEP).toBe(12);
    expect(w.ladderCount).toBe(12);
    expect(poolOf(w).sort()).toEqual([B, A].sort());
  });

  it("D-1: no auto-target, whatever the order of RECIPES or a pin", () => {
    expect(selectHintTarget(w)).toEqual({ kind: "OPEN_POOL" });
    expect(selectHintTarget(w, { recipes: [...RECIPES].reverse() })).toEqual({ kind: "OPEN_POOL" });
    for (const pinnedRecipeId of [A, B, "margherita"]) {
      expect(selectHintTarget(w, { pinnedRecipeId }), pinnedRecipeId).toEqual({ kind: "OPEN_POOL" });
    }
  });

  it("D-1: the sheet names no recipe, opens no session, and offers no per-candidate hint", () => {
    const s = hintState(w);
    expect(resolveHintSession(s)).toBeNull();
    expect(resolveHintSession(s, A)).toBeNull();
    expect(resolveHintSession(s, B)).toBeNull();
    const view = hintSheetView(s);
    expect(view).toEqual({ kind: "OPEN_POOL" });
    expect(Object.keys(view)).toEqual(["kind"]); // no candidate id / name / count can ride along
  });

  it("D-2: the Dex shows ONE aggregated unknown, with no count, name, identity, slot number or hint entrance", () => {
    const onShowHint = vi.fn();
    render(
      <DexOverlay
        dex={w.dex}
        newlyDiscoveredId={null}
        newBestRecipeId={null}
        onClose={() => {}}
        ownedIngredientIds={w.ownedIngredientIds}
        unlockedForShopIngredientIds={w.unlockedForShopIngredientIds}
        inventory={w.inventory}
        onGoFreeCook={() => {}}
        onOpenShop={() => {}}
        onShowHint={onShowHint}
      />,
    );
    const aggregated = document.querySelectorAll("[data-dex-aggregated]");
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].textContent).not.toMatch(/[0-9０-９]/);
    expect(document.querySelectorAll('.dex-overlay__chapter [data-dex-state="DISCOVERABLE"]')).toHaveLength(0);
    expect(document.querySelectorAll(".dex-card__tag-cta--hint")).toHaveLength(0);
    const text = [...document.querySelectorAll(".dex-card--locked")].map((c) => c.textContent ?? "").join("|");
    const attrs = [...document.body.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => a.value));
    for (const id of [A, B]) {
      const r = getRecipe(id as RecipeId)!;
      expect(text).not.toContain(r.nameJa);
      expect(text).not.toContain(r.description);
      expect(attrs.filter((v) => v.split(/[\s:]/).includes(id))).toEqual([]);
    }
    expect(onShowHint).not.toHaveBeenCalled();
  });

  it("FREE Cooking can find either one: the real matcher answers NEW_DISCOVERY for each pizza", () => {
    const found = discoveredRecipeIds(w.dex);
    for (const id of [A, B]) {
      const outcome = evaluateDiscovery(signatureOfPizza(pizzaOf(idsOf(id))), RECIPE_DISCOVERY_CATALOG, found);
      expect(outcome, id).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: id });
    }
  });
});

describe("both orders from the onion step: no softlock, a consistent ledger, the ladder never moved by the non-credit recipe", () => {
  /** Walks `order`, checking at every prefix the invariants that must hold on any path. */
  function checkPath(order: readonly string[]) {
    const ledgers: (readonly string[])[] = [];
    for (let n = 0; n <= order.length; n += 1) {
      const prefix = order.slice(0, n);
      const state = walkState(prefix);
      const credited = prefix.filter((id) => countsTowardLadder(id)).length;
      expect(state.ladderCount, `${n}`).toBe(credited);
      // The ledger is the ladder's: nothing but the credited count decides it.
      expect(state.unlockedForShopIngredientIds, `${n}`).toEqual(
        resolveShopEntitlement(walkState(prefix.filter((id) => countsTowardLadder(id))).dex, [], []).unlockedForShopIngredientIds,
      );
      // No softlock: until all 26 are found, something is always DISCOVERABLE.
      if (n < order.length) expect(poolOf(state, RECIPES_26).length, `${n}: ${prefix.join(",")}`).toBeGreaterThanOrEqual(1);
      else expect(poolOf(state, RECIPES_26)).toEqual([]);
      ledgers.push(state.unlockedForShopIngredientIds);
    }
    return ledgers;
  }

  it("B -> A (calabresa first): the ladder stays at 12, no early entitlement, then portuguesa is the lone target", () => {
    const afterB = walkState([...BEFORE_ONION, B]);
    const before = walkState(BEFORE_ONION);
    expect(afterB.ladderCount).toBe(12); // calabresa credits nothing
    expect(afterB.unlockedForShopIngredientIds).toEqual(before.unlockedForShopIngredientIds); // W1 entitlement not hastened
    expect(afterB.unlockedForShopIngredientIds).not.toContain("olive-oil"); // step 13's material is still locked
    expect(poolOf(afterB)).toEqual([A]);
    expect(selectHintTarget(afterB)).toEqual({ kind: "TARGET", recipeId: A, source: "auto" });
    const afterA = walkState([...BEFORE_ONION, B, A]);
    expect(afterA.ladderCount).toBe(13);
    expect(afterA.unlockedForShopIngredientIds).toContain("olive-oil");
  });

  it("A -> B (portuguesa first): the W1 ladder advances as before; calabresa stays beside the next key recipe", () => {
    const afterA = walkState([...BEFORE_ONION, A]);
    expect(afterA.ladderCount).toBe(13); // exactly the existing-25 progression
    expect(afterA.unlockedForShopIngredientIds).toContain("olive-oil");
    expect(poolOf(afterA).sort()).toEqual([B, "fugazza"].sort()); // still a pool of 2, so still no auto-target
    expect(selectHintTarget(afterA)).toEqual({ kind: "OPEN_POOL" });
    const afterB = walkState([...BEFORE_ONION, A, B]);
    expect(afterB.ladderCount).toBe(13);
    expect(selectHintTarget(afterB)).toEqual({ kind: "TARGET", recipeId: "fugazza", source: "auto" });
  });

  it("every insertion point of calabresa (0..25 W1 recipes found first) finishes at 26 with the same final ledger", () => {
    const reference = walkState(ALL_26).unlockedForShopIngredientIds;
    for (let at = ONION_STEP; at <= W1_ORDER.length; at += 1) {
      const order = [...W1_ORDER.slice(0, at), B, ...W1_ORDER.slice(at)];
      const ledgers = checkPath(order);
      expect(ledgers[ledgers.length - 1], `insert at ${at}`).toEqual(reference);
      expect(discoveredRecipeCount(walkState(order).dex, countsTowardLadder)).toBe(25); // credited population unchanged
      expect(discoveredRecipeIds(walkState(order).dex)).toHaveLength(26);
    }
  });

  it("the final ledger equals the existing-25 final ledger: calabresa unlocks no material of its own", () => {
    expect(walkState(ALL_26).unlockedForShopIngredientIds).toEqual(walkState(W1_ORDER).unlockedForShopIngredientIds);
  });
});
