import { describe, expect, it } from "vitest";
import { getIngredient } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { buildHintSteps } from "../logic/discovery/hintSteps";
import { discoveredRecipeIds } from "./dex";
import { hintSheetView } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { recipeDiscoveryState } from "./recipeDiscoveryState";
import { resultNearMiss } from "./resultNearMiss";

/**
 * Discovery Hint 2.0 (Issue #229) Final Gate: the whole 25-recipe ladder played through the real
 * reducer, from a brand-new save to a complete Dex, using only what a player sees:
 *
 *  1. Free Cooking + 「ヒント」: the sheet's empty state (SHOP_NEW / REFILL) sends the player to the
 *     Shop, which the walk does through the real PURCHASE_INGREDIENT / RESTOCK_INGREDIENT actions.
 *  2. With a target: reveal every step (the sheet stops by itself), read the named ingredients.
 *  3. Bake exactly the named ingredients: at Dex 0 that is the Margherita discovery (the one
 *     onboarding exception); otherwise the RESULT shows a one-step near-miss (never the answer).
 *  4. Try the owned ingredients of the hinted kind one at a time until the real matcher reports
 *     NEW_DISCOVERY -- which must be the hint's own target -- and move on.
 *
 * Discovery Hint Economy 1.0 (Issue #232, HE-2): step 2 buys each level through the real
 * PURCHASE_DISCOVERY_HINT (Dex 0 free, then Candidate B 5/10/20/40), and the walk checks the Pitz
 * charged and the purchase ledger at every stage.
 *
 * No recipe id is ever read from the sheet: the walk only uses `hintSheetView`'s steps (ingredient
 * ids + text) and the RESULT's near-miss class. The target id is read from `hintSession` for the
 * assertions only.
 */

const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
const isFinite = (id: string) => !!getIngredient(id)?.unlockCondition;
const BAKE = 68;

function pizzaOf(ids: readonly string[]): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ids.filter(isSauce).slice(0, 1),
    toppings: ids.filter((id) => !isSauce(id)).map((ingredientId, i) => ({ id: `w${i}`, ingredientId, x: 30 + i * 3, y: 50 })),
    bakeResult: BAKE,
  };
}

const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);

/** Keeps every owned finite material stocked, as a player refilling in the Shop would. */
function restockLow(s: GameState): GameState {
  for (const id of s.ownedIngredientIds) {
    if (isFinite(id) && (s.inventory[id] ?? 0) < 3) s = act(s, { type: "RESTOCK_INGREDIENT", ingredientId: id });
  }
  return s;
}

/** One Free Cooking round with exactly `ids`, baked and registered; returns the RESULT state. */
function bake(s: GameState, ids: readonly string[]): GameState {
  s = restockLow(s);
  s = { ...act(s, { type: "START_FREE_COOK" }), pizza: pizzaOf(ids) };
  s = act(s, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: BAKE });
  for (let i = 0; i < 6 && s.phase !== "RESULT"; i += 1) s = act(s, { type: "CONFIRM_MAKING_STEP" });
  expect(s.phase).toBe("RESULT");
  return act(s, { type: "REGISTER_TO_DEX" });
}

const PRICES = [0, 5, 10, 20, 40];

interface StageRecord {
  dex: number;
  hintSpend: number;
  target: string;
  shop: string[];
  steps: number;
  named: number;
  total: number;
  firstResult: string;
  trials: number;
}

describe("Final Gate: the 25-recipe ladder from a new save to a complete Dex, hints only", () => {
  it("every stage has a DISCOVERABLE target (or a Shop step), never shows the full answer after Dex 0, and ends in its discovery", () => {
    let s = createInitialGameState(undefined, undefined, 1_000_000);
    const records: StageRecord[] = [];

    for (let guard = 0; guard < 80; guard += 1) {
      const dexCount = discoveredRecipeIds(s.dex).length;
      if (dexCount === 25) break;
      const shop: string[] = [];

      // 1. Open the sheet; follow an empty state to the Shop.
      s = act(restockLow(s), { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
      let view = hintSheetView(s);
      if (view.kind === "SHOP_NEW" || view.kind === "REFILL") {
        for (const id of s.unlockedForShopIngredientIds) {
          if (!s.ownedIngredientIds.includes(id)) {
            s = act(s, { type: "PURCHASE_INGREDIENT", ingredientId: id });
            shop.push(id);
          }
        }
        s = act(restockLow(s), { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
        view = hintSheetView(s);
      }
      expect(view.kind, `Dex ${dexCount}: a target after the Shop`).toBe("TARGET");
      if (view.kind !== "TARGET") return;
      const targetId = s.hintSession!.targetId;
      const target = RECIPES.find((r) => r.id === targetId)!;
      expect(recipeDiscoveryState(target, s), `Dex ${dexCount}`).toBe("DISCOVERABLE");

      // 2. Unlock every level the sheet offers, in order, until it stops.
      let hintSpend = 0;
      for (let i = 0; i < 12; i += 1) {
        const offer = hintSheetView(s);
        if (offer.kind !== "TARGET" || !offer.next) break;
        expect(offer.next.free, `Dex ${dexCount}: onboarding free`).toBe(dexCount === 0);
        expect(offer.next.price).toBe(dexCount === 0 ? 0 : PRICES[offer.next.level]);
        const before = s.pitzBalance;
        s = act(s, { type: "PURCHASE_DISCOVERY_HINT", level: offer.next.level });
        expect(before - s.pitzBalance).toBe(offer.next.price);
        hintSpend += before - s.pitzBalance;
      }
      const final = hintSheetView(s);
      if (final.kind !== "TARGET") throw new Error("target view expected");
      expect(final.canRevealMore).toBe(false);
      expect(final.steps).toEqual(buildHintSteps(target, { discoveredCount: dexCount }));
      const named = final.steps.flatMap((x) => (x.namedIngredientId ? [x.namedIngredientId] : []));
      const total = new Set(target.requiredIngredients.map((r) => r.ingredientId)).size;
      expect(named.length, `Dex ${dexCount}: named ingredients`).toBe(dexCount === 0 ? total : total - 1);
      const maxLevel = final.steps.at(-1)!.level;
      // Dex 0 is free and session-only; from Dex 1 the ledger holds the target's last level.
      expect(s.discoveryHintPurchases[targetId]).toBe(dexCount === 0 ? undefined : maxLevel);
      expect(hintSpend).toBe(dexCount === 0 ? 0 : PRICES.slice(1, maxLevel + 1).reduce((a, b) => a + b, 0));
      const notTomato = final.steps.some((x) => x.textJa === "ソースはトマトじゃないみたい");
      s = act(s, { type: "CLOSE_HINT" });

      // 3. Bake exactly what the hints named.
      s = bake(s, named);
      const first = s.lastDiscovery?.kind ?? "none";
      let trials = 0;
      if (dexCount === 0) {
        expect(s.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: "margherita" });
      } else {
        const line = resultNearMiss(s);
        expect(["ADD_ONE", "SAUCE_ONLY"], `Dex ${dexCount}: near-miss after the named pizza`).toContain(line?.kind);
        const wantSauce = line!.kind === "SAUCE_ONLY";

        // 4. Try each owned ingredient of the hinted kind until the discovery.
        const pool = s.ownedIngredientIds.filter(
          (id) => !named.includes(id) && isSauce(id) === wantSauce && !(wantSauce && notTomato && id === "tomato-sauce"),
        );
        for (const id of pool) {
          trials += 1;
          s = bake(s, wantSauce ? [id, ...named] : [...named, id]);
          if (s.lastDiscovery?.kind === "NEW_DISCOVERY") break;
        }
        expect(s.lastDiscovery, `Dex ${dexCount}: discovery within ${pool.length} tries`).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: targetId });
      }
      expect(discoveredRecipeIds(s.dex).length).toBe(dexCount + 1);
      records.push({ dex: dexCount, hintSpend, target: targetId, shop, steps: final.steps.length, named: named.length, total, firstResult: first, trials });
    }

    expect(records.map((r) => r.dex)).toEqual(Array.from({ length: 25 }, (_, i) => i));
    expect(new Set(records.map((r) => r.target)).size).toBe(25);
    s = act(s, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(hintSheetView(s)).toEqual({ kind: "COMPLETE" });
    // Every stage after the first went through the Shop (one new material per ladder step).
    expect(records.slice(1).every((r) => r.shop.length >= 1)).toBe(true);
    // Purchases stay after the discovery: 24 paid recipes (Margherita was free), each at H3 or H4.
    expect(Object.keys(s.discoveryHintPurchases).sort()).toEqual(records.slice(1).map((r) => r.target).sort());
    expect(records.slice(1).every((r) => r.hintSpend === 35 || r.hintSpend === 75)).toBe(true);
    console.info(records.map((r) => `${r.dex}\t${r.target}\thint=${r.hintSpend}\tshop=${r.shop.join("+")}\tsteps=${r.steps}\tnamed=${r.named}/${r.total}\t${r.firstResult}\ttrials=${r.trials}`).join("\n"));
  });
});
