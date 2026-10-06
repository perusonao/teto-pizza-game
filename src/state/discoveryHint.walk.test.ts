import { describe, expect, it, vi } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient } from "../data/ingredients";
import { RECIPES, countsTowardLadder } from "../data/recipes";
import { buildHintSteps } from "../logic/discovery/hintSteps";
import { discoveredRecipeIds } from "./dex";
import { selectableHintPriceCap } from "../logic/discovery/selectableHint";
import { hintSheetView } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { recipeDiscoveryState } from "./recipeDiscoveryState";
import { NEAR_MISS_COPY, legacyResultNearMiss as resultNearMiss } from "./resultNearMiss";


// Hint 5.0 is ON in production (H5-6). This suite pins the pre-Hint-5.0 purchase behaviour, which is the
// rollback path, so it runs with the ladder flag OFF.
vi.mock("../logic/discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: false }));
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
 * Discovery Hint 3.0 (Issue #238, H3-3): from Dex 1 step 2 buys Selectable Hint facts through the
 * real PURCHASE_SELECTABLE_HINT (rotating the category preference) until the sheet answers with
 * the generic guidance; the walk checks the Pitz charged (never above the recipe's Hint 2.0 cost),
 * the fact ledger, and that the legacy `discoveryHintPurchases` never moves. Dex 0 keeps the free
 * Hint 2.0 onboarding.
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

// The walk follows whatever target the sheet offers until nothing is left, so it holds for any
// number of legal discovery orders (a non-credit branching recipe can be the target beside a W1
// one). The population size is pinned once, explicitly, not re-derived per assertion.
const TOTAL = RECIPES.length;

describe("Final Gate: the 25-recipe ladder from a new save to a complete Dex, hints only", () => {
  it("the production population is the 25-recipe W1 ladder + the non-credit calabresa + No.27 pesto-pollo + Expansion's pesto-gamberi + Wave 2's 3 + TQ-1D's non-credit aussie (32)", () => {
    expect(TOTAL).toBe(33);
  });

  it("every stage has a DISCOVERABLE target (or a Shop step), never shows the full answer after Dex 0, and ends in its discovery", () => {
    let s = createInitialGameState(undefined, undefined, 1_000_000);
    const records: StageRecord[] = [];

    for (let guard = 0; guard < 80; guard += 1) {
      const dexCount = discoveredRecipeIds(s.dex).length;
      if (dexCount === TOTAL) break;
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
      if (view.kind === "OPEN_POOL" || view.kind === "CHOOSE_RESEARCH") {
        // #353: two registered Research Entries and no target is CHOOSE_RESEARCH (was OPEN_POOL); same blind pick.
        // PR-4b-B (D-1): pizza-portuguesa and brazilian-calabresa are both DISCOVERABLE and nothing is
        // sticky or bought, so the sheet names no recipe and sells nothing: it says only that
        // something can still be found. The player cooks without a hint; finding the non-credit
        // recipe first leaves one candidate again, which brings the hint back for every later stage.
        expect(Object.keys(view)).toEqual(["kind"]);
        expect(s.hintSession).toBeNull();
        const pool = RECIPES.filter((r) => recipeDiscoveryState(r, s) === "DISCOVERABLE");
        expect(pool.length, `Dex ${dexCount}: a pool of 2+`).toBeGreaterThanOrEqual(2);
        // Expansion Wave 2 (step 28): pesto-vegetariana and ratatouille-pizza are BOTH credited and discoverable at once
        // (the intended Branching Discovery); there is no non-credit one to find first, so the walk finds the first blind.
        const pick = pool.find((r) => !countsTowardLadder(r.id)) ?? pool[0];
        s = act(s, { type: "CLOSE_HINT" });
        s = bake(s, [...new Set(pick.requiredIngredients.map((r) => r.ingredientId))]);
        expect(s.lastDiscovery, `Dex ${dexCount}: the blind pool pick`).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: pick.id });
        expect(discoveredRecipeIds(s.dex).length).toBe(dexCount + 1);
        expect(s.discoveryHintFacts).not.toHaveProperty(pick.id);
        records.push({ dex: dexCount, hintSpend: 0, target: pick.id, shop, steps: 0, named: 0, total: new Set(pick.requiredIngredients.map((r) => r.ingredientId)).size, firstResult: s.lastDiscovery?.kind ?? "none", trials: 1 });
        continue;
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
      records.push({ dex: dexCount, hintSpend, target: targetId, shop, steps, named: named.length, total, firstResult: first, trials });
    }

    expect(records.map((r) => r.dex)).toEqual(Array.from({ length: TOTAL }, (_, i) => i));
    expect(new Set(records.map((r) => r.target)).size).toBe(TOTAL);
    s = act(s, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(hintSheetView(s)).toEqual({ kind: "COMPLETE" });
    // Every ladder step's new material is bought through the Shop, at the FIRST stage that runs
    // at that ladder count. A non-credit discovery does not advance the ladder, so a stage run at
    // an unchanged count may reuse a material an earlier stage already bought (a branching pool
    // lets either recipe be the one that triggers the purchase). On a single-path ladder every
    // stage has its own count, so this is "every stage after the first visits the Shop".
    // Expansion Wave 2: the ladder ends at step 28, and its pair (pesto-vegetariana / ratatouille-pizza) is a
    // branching pool, so the last stage runs at count 29 with no step of its own: only counts that ARE a ladder step sell.
    // Expansion Slice 3: step 29 (almond) is reached while ratatouille-pizza is still the one recipe that needs no new
    // material, so that stage never visits the Shop for it; the almond purchase is the pesto-trapanese stage's (checked below).
    const seenCounts = new Set<number>();
    let credited = 0;
    for (const r of records) {
      if (r.dex >= 1 && !seenCounts.has(credited) && DISCOVERY_LADDER.steps.some((l) => l.step === credited) && r.target !== "ratatouille-pizza") expect(r.shop.length, `Dex ${r.dex} ${r.target}: first stage at ladder count ${credited}`).toBeGreaterThanOrEqual(1);
      seenCounts.add(credited);
      if (countsTowardLadder(r.target)) credited += 1;
    }
    expect(records.find((r) => r.target === "pesto-trapanese")!.shop.length, "pesto-trapanese buys almond in the Shop").toBeGreaterThanOrEqual(1);
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
