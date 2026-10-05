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
 * that makes pizza-portuguesa DISCOVERABLE) the 26th recipe, brazilian-calabresa, is makeable too, and since
 * TQ-1D so is the no-sauce `aussie` (also non-credit, made of bacon / egg / mozzarella / onion): a pool of 3
 * on real production data. D-1 / D-2 / D-3 hold; every order finishes with no softlock and a consistent
 * ledger; the non-credit recipes never move the W1 ladder.
 */

afterEach(() => cleanup());

const A = "pizza-portuguesa";
const B = "brazilian-calabresa";
const C = "aussie"; // TQ-1D: the second non-credit recipe makeable at the onion step
const ONION_STEP = DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes("onion"))!.step;
const BEFORE_ONION = W1_ORDER.slice(0, ONION_STEP); // 12 found: the key recipe of step 12 is next
const ALL_27 = [...W1_ORDER, B, C];
/** The 27 recipes of this slice (25 W1 + the two non-credit onion-step recipes): production minus the appended-step
 *  recipes (No.27 pesto-pollo and later -- their own pool behaviour is pinned in their vertical-slice tests, not here). */
const RECIPES_27 = RECIPES.filter((r) => ALL_27.includes(r.id));

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

  it("pizza-portuguesa, brazilian-calabresa and aussie are all DISCOVERABLE: the pool is exactly 3", () => {
    expect(ONION_STEP).toBe(12);
    expect(w.ladderCount).toBe(12);
    expect(poolOf(w).sort()).toEqual([A, B, C].sort());
  });

  it("D-1: no auto-target, whatever the order of RECIPES or a pin", () => {
    expect(selectHintTarget(w)).toEqual({ kind: "OPEN_POOL" });
    expect(selectHintTarget(w, { recipes: [...RECIPES].reverse() })).toEqual({ kind: "OPEN_POOL" });
    for (const pinnedRecipeId of [A, B, C, "margherita"]) {
      expect(selectHintTarget(w, { pinnedRecipeId }), pinnedRecipeId).toEqual({ kind: "OPEN_POOL" });
    }
  });

  it("D-1: the sheet names no recipe, opens no session, and offers no per-candidate hint", () => {
    const s = hintState(w);
    expect(resolveHintSession(s)).toBeNull();
    // #353: without a choice nothing is picked; a Dex pin of a registered entry is the player's own choice.
    expect(resolveHintSession(s, A)).toMatchObject({ targetId: A, fromDex: true });
    expect(resolveHintSession(s, B)).toMatchObject({ targetId: B, fromDex: true });
    expect(resolveHintSession(s, C)).toMatchObject({ targetId: C, fromDex: true });
    const view = hintSheetView(s);
    expect(view).toEqual({ kind: "CHOOSE_RESEARCH" }); // #353: both are registered Research Entries
    expect(Object.keys(view)).toEqual(["kind"]); // no candidate id / name / count can ride along
  });

  it("D-2 / S4: the Dex shows no aggregate card (both are Research Entries), with no count, name, identity, slot number or hint entrance", () => {
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
    expect(document.querySelectorAll("[data-dex-aggregated]")).toHaveLength(0);
    const research = document.querySelector(".dex-overlay__research") as HTMLElement;
    expect(research.textContent).not.toMatch(/[0-9０-９]/); // ①② are circled numerals, not digits
    expect(document.querySelectorAll('.dex-overlay__chapter [data-dex-state="DISCOVERABLE"]')).toHaveLength(0);
    expect(document.querySelectorAll(".dex-card__tag-cta--hint")).toHaveLength(0);
    const text = [...document.querySelectorAll(".dex-card--locked")].map((c) => c.textContent ?? "").join("|");
    const attrs = [...document.body.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => a.value));
    for (const id of [A, B, C]) {
      const r = getRecipe(id as RecipeId)!;
      expect(text).not.toContain(r.nameJa);
      expect(text).not.toContain(r.description);
      expect(attrs.filter((v) => v.split(/[\s:]/).includes(id))).toEqual([]);
    }
    expect(onShowHint).not.toHaveBeenCalled();
  });

  it("FREE Cooking can find any of them: the real matcher answers NEW_DISCOVERY for each pizza", () => {
    const found = discoveredRecipeIds(w.dex);
    for (const id of [A, B, C]) {
      const outcome = evaluateDiscovery(signatureOfPizza(pizzaOf(idsOf(id))), RECIPE_DISCOVERY_CATALOG, found);
      expect(outcome, id).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: id });
    }
  });
});

describe("every order from the onion step: no softlock, a consistent ledger, the ladder never moved by the non-credit recipe", () => {
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
      // No softlock: until all 27 are found, something is always DISCOVERABLE.
      if (n < order.length) expect(poolOf(state, RECIPES_27).length, `${n}: ${prefix.join(",")}`).toBeGreaterThanOrEqual(1);
      else expect(poolOf(state, RECIPES_27)).toEqual([]);
      ledgers.push(state.unlockedForShopIngredientIds);
    }
    return ledgers;
  }

  it("B, C -> A (the non-credit pair first): the ladder stays at 12, no early entitlement, then portuguesa is the lone target", () => {
    const afterB = walkState([...BEFORE_ONION, B]);
    const before = walkState(BEFORE_ONION);
    expect(afterB.ladderCount).toBe(12); // calabresa credits nothing
    expect(poolOf(afterB).sort()).toEqual([A, C].sort()); // still a pool of 2, so still no auto-target
    expect(selectHintTarget(afterB)).toEqual({ kind: "OPEN_POOL" });
    const afterBC = walkState([...BEFORE_ONION, B, C]);
    expect(afterBC.ladderCount).toBe(12); // neither non-credit recipe credits anything
    expect(afterBC.unlockedForShopIngredientIds).toEqual(before.unlockedForShopIngredientIds); // W1 entitlement not hastened
    expect(afterBC.unlockedForShopIngredientIds).not.toContain("olive-oil"); // step 13's material is still locked
    expect(poolOf(afterBC)).toEqual([A]);
    expect(selectHintTarget(afterBC)).toEqual({ kind: "TARGET", recipeId: A, source: "auto" });
    const afterA = walkState([...BEFORE_ONION, B, C, A]);
    expect(afterA.ladderCount).toBe(13);
    expect(afterA.unlockedForShopIngredientIds).toContain("olive-oil");
  });

  it("A -> B -> C (portuguesa first): the W1 ladder advances as before; the non-credit pair stays beside the next key recipe", () => {
    const afterA = walkState([...BEFORE_ONION, A]);
    expect(afterA.ladderCount).toBe(13); // exactly the existing-25 progression
    expect(afterA.unlockedForShopIngredientIds).toContain("olive-oil");
    expect(poolOf(afterA).sort()).toEqual([B, C, "fugazza"].sort()); // a pool of 3, so still no auto-target
    expect(selectHintTarget(afterA)).toEqual({ kind: "OPEN_POOL" });
    const afterB = walkState([...BEFORE_ONION, A, B]);
    expect(afterB.ladderCount).toBe(13);
    expect(poolOf(afterB).sort()).toEqual([C, "fugazza"].sort());
    expect(selectHintTarget(afterB)).toEqual({ kind: "OPEN_POOL" });
    const afterC = walkState([...BEFORE_ONION, A, B, C]);
    expect(afterC.ladderCount).toBe(13);
    expect(selectHintTarget(afterC)).toEqual({ kind: "TARGET", recipeId: "fugazza", source: "auto" });
  });

  it("every insertion point of the non-credit pair (12..25 W1 recipes found first, either order) finishes at 27 with the same final ledger", () => {
    const reference = walkState(ALL_27).unlockedForShopIngredientIds;
    for (let at = ONION_STEP; at <= W1_ORDER.length; at += 1) {
      for (const pair of [[B, C], [C, B]]) {
        const order = [...W1_ORDER.slice(0, at), ...pair, ...W1_ORDER.slice(at)];
        const ledgers = checkPath(order);
        expect(ledgers[ledgers.length - 1], `insert at ${at}`).toEqual(reference);
        expect(discoveredRecipeCount(walkState(order).dex, countsTowardLadder)).toBe(25); // credited population unchanged
        expect(discoveredRecipeIds(walkState(order).dex)).toHaveLength(27);
      }
    }
  });

  it("the final ledger equals the existing-25 final ledger: the non-credit recipes unlock no material of their own", () => {
    expect(walkState(ALL_27).unlockedForShopIngredientIds).toEqual(walkState(W1_ORDER).unlockedForShopIngredientIds);
  });
});
