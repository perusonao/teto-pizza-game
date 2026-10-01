import { describe, expect, it } from "vitest";
import { getIngredient } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import { buildHintSteps } from "../../logic/discovery/hintSteps";
import { discoverableHintCandidates } from "../../logic/discovery/hintTarget";
import { discoveredRecipeIds } from "../dex";
import { selectableHintPriceCap } from "../../logic/discovery/selectableHint";
import { hintSheetView } from "../discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../gameReducer";
import { createEmptyPizza, type PizzaState } from "../pizzaState";
import { recipeDiscoveryState } from "../recipeDiscoveryState";
import { NEAR_MISS_COPY, resultNearMiss } from "../resultNearMiss";

/**
 * Discovery 3.0 PR-4a: the Final Gate walk (Issue #229), moved here unchanged except that it is
 * population-parametric -- the recipe count is `RECIPES.length` (not 25) and "every stage goes through the
 * Shop" became "every stage that OPENS with nothing discoverable goes through the Shop". Two files call it:
 * `discoveryHint.walk.test.ts` over the 25 production recipes and `discoveryHint.walk.synthetic.test.ts`
 * over production + one synthetic branching recipe. Each file must `vi.mock` the Hint 5.0 flag OFF itself.
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

interface StageRecord {
  dex: number;
  hintSpend: number;
  poolAtOpen: number;
  target: string;
  shop: string[];
  steps: number;
  named: number;
  total: number;
  firstResult: string;
  trials: number;
}

export function defineFinalGateWalk(title: string): void {
describe(title, () => {
  it("every stage has a DISCOVERABLE target (or a Shop step), never shows the full answer after Dex 0, and ends in its discovery", () => {
    const TOTAL = RECIPES.length;
    let s = createInitialGameState(undefined, undefined, 1_000_000);
    const records: StageRecord[] = [];

    for (let guard = 0; guard < 80; guard += 1) {
      const dexCount = discoveredRecipeIds(s.dex).length;
      if (dexCount === TOTAL) break;
      const shop: string[] = [];

      // 1. Open the sheet; follow an empty state to the Shop.
      s = act(restockLow(s), { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
      let view = hintSheetView(s);
      // Discovery 3.0 PR-4a: how many recipes are discoverable when the stage opens (several when a recipe
      // branches off a ladder step); the 25 production recipes always start a stage with 0 (Shop) or 1 (Dex 0).
      const poolAtOpen = discoverableHintCandidates(s, RECIPES).length;
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
      expect(view.kind, `Dex ${dexCount}: a target after the Shop`).toBe(dexCount === 0 ? "TARGET" : "SELECTABLE");
      const targetId = s.hintSession!.targetId;
      const target = RECIPES.find((r) => r.id === targetId)!;
      expect(recipeDiscoveryState(target, s), `Dex ${dexCount}`).toBe("DISCOVERABLE");
      const total = new Set(target.requiredIngredients.map((r) => r.ingredientId)).size;

      // 2. Dex 0: unlock every free onboarding level. Dex >= 1: buy facts until the guidance line.
      let hintSpend = 0;
      let named: string[] = [];
      let steps = 0;
      if (dexCount === 0) {
        for (let i = 0; i < 12; i += 1) {
          const offer = hintSheetView(s);
          if (offer.kind !== "TARGET" || !offer.next) break;
          expect(offer.next.free, "Dex 0: onboarding free").toBe(true);
          const before = s.pitzBalance;
          s = act(s, { type: "PURCHASE_DISCOVERY_HINT", level: offer.next.level });
          expect(s.pitzBalance).toBe(before);
        }
        const final = hintSheetView(s);
        if (final.kind !== "TARGET") throw new Error("target view expected");
        expect(final.canRevealMore).toBe(false);
        expect(final.steps).toEqual(buildHintSteps(target, { discoveredCount: 0 }));
        named = final.steps.flatMap((x) => (x.namedIngredientId ? [x.namedIngredientId] : []));
        steps = final.steps.length;
        expect(s.discoveryHintFacts).toEqual({});
      } else {
        const prefs = ["sauce", "cheese", "topping"] as const;
        for (let i = 0; i < 12; i += 1) {
          const offer = hintSheetView(s);
          if (offer.kind !== "SELECTABLE") throw new Error("selectable view expected");
          if (offer.outcome === "GUIDANCE_ONLY") break;
          const before = s.pitzBalance;
          s = act(s, { type: "PURCHASE_SELECTABLE_HINT", preference: prefs[i % 3], expectedPaidCount: offer.presentation.paidCount });
          const after = hintSheetView(s);
          if (after.kind === "SELECTABLE" && after.outcome === "GUIDANCE_ONLY") {
            expect(s.pitzBalance).toBe(before);
          } else {
            expect(before - s.pitzBalance).toBe(offer.presentation.nextPrice);
            steps += 1;
          }
          hintSpend += before - s.pitzBalance;
        }
        const final = hintSheetView(s);
        if (final.kind !== "SELECTABLE") throw new Error("selectable view expected");
        expect(final.outcome).toBe("GUIDANCE_ONLY");
        named = final.presentation.rows.flatMap((r) => r.revealed.map((c) => c.ingredientId));
        // A zero-fact target (key + reserved only, OD-H3-17) answers GUIDANCE_ONLY at once.
        expect(s.discoveryHintFacts[targetId] ?? []).toHaveLength(steps);
        expect(s.discoveryHintPurchases).toEqual({});
      }
      expect(named.length, `Dex ${dexCount}: named ingredients`).toBe(dexCount === 0 ? total : total - 1);
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
        // H3-3 near-miss privacy: the fixed copy only (never an ingredient), and bought facts change nothing.
        expect(Object.values(NEAR_MISS_COPY)).toContain(line!.textJa);
        expect(resultNearMiss({ ...s, discoveryHintFacts: {} } as GameState)).toEqual(line);
        const wantSauce = line!.kind === "SAUCE_ONLY";

        // 4. Try each owned ingredient of the hinted kind until the discovery.
        const pool = s.ownedIngredientIds.filter(
          (id) => !named.includes(id) && isSauce(id) === wantSauce,
        );
        for (const id of pool) {
          trials += 1;
          s = bake(s, wantSauce ? [id, ...named] : [...named, id]);
          if (s.lastDiscovery?.kind === "NEW_DISCOVERY") break;
        }
        expect(s.lastDiscovery, `Dex ${dexCount}: discovery within ${pool.length} tries`).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: targetId });
      }
      expect(discoveredRecipeIds(s.dex).length).toBe(dexCount + 1);
      records.push({ dex: dexCount, poolAtOpen, hintSpend, target: targetId, shop, steps, named: named.length, total, firstResult: first, trials });
    }

    expect(records.map((r) => r.dex)).toEqual(Array.from({ length: TOTAL }, (_, i) => i));
    expect(new Set(records.map((r) => r.target)).size).toBe(TOTAL);
    s = act(s, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(hintSheetView(s)).toEqual({ kind: "COMPLETE" });
    // Every stage that opened with nothing discoverable went through the Shop (one new material per ladder step);
    // with a branching recipe a stage may open with a recipe already discoverable and need no purchase.
    expect(records.slice(1).every((r) => (r.poolAtOpen === 0 ? r.shop.length >= 1 : r.shop.length === 0))).toBe(true);
    // Facts stay after the discovery: every paid recipe with a purchasable fact (Margherita was
    // free), each within its Hint 2.0 cost (OD-H3-4 parity cap 35 / 75); the legacy ledger never moved.
    const paid = records.slice(1).filter((r) => r.steps > 0);
    expect(paid.length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(s.discoveryHintFacts).sort()).toEqual(paid.map((r) => r.target).sort());
    expect(records.slice(1).every((r) => r.hintSpend === 0 ? r.steps === 0 : r.hintSpend <= selectableHintPriceCap(RECIPES.find((x) => x.id === r.target)!))).toBe(true);
    expect(s.discoveryHintPurchases).toEqual({});
    console.info(records.map((r) => `${r.dex}\t${r.target}\thint=${r.hintSpend}\tshop=${r.shop.join("+")}\tsteps=${r.steps}\tnamed=${r.named}/${r.total}\t${r.firstResult}\ttrials=${r.trials}`).join("\n"));
  });
});
}
