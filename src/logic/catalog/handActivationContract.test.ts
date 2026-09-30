import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../../state/gameReducer";
import { EMPTY_DEX } from "../../state/dex";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { buildIdealSauceFixture } from "../../data/referencePizza";
import { runtimeCatalog } from "./catalogSource";
import { handTrayTransition, trayPageIds } from "./handTray";
import { selectWorkingSet } from "./workingSet";
import { emptyUsageSession } from "./usageSignals";
import { NO_DISCLOSED_HINTS } from "./hintDisclosure";

/**
 * LC-R5-e-h H-5: the "hand inactive -> active within ONE step" contract.
 *
 * App (`App.tsx`, render-phase `trayHandTrack`) treats a hand that APPEARS (null -> ids) as a fresh track, not as a
 * hand change: no #197 evaluation, and the tray (`prevHandKey === null`) keeps its page. That is only safe because
 * the transition is UNREACHABLE today: whether the hand is active depends on ownership (owned per category vs the
 * capacity), the stock and the capacity, and none of them can change while a step is on screen --
 *   (1) no PREPARE action changes `ownedIngredientIds` / `inventory` (this file, reducer level), and
 *   (2) the cooking screen offers no Shop / Dex / inventory entry during PREPARE (App.handActivation.handOn, H-5).
 * The capacity is a build constant. If a future catalog / inventory authority (in-round purchase, a grant, a live
 * capacity switch) breaks (1) or (2), the appearance MUST be evaluated as a hand change: the before-list is today's
 * full tray, and `handTrayTransition` already gives the right answer for it (last test). This file makes that
 * explicit so the gap cannot go unnoticed.
 */
const NOW = 1_700_000_000_000;
const TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping");
const FINITE_TOPPINGS = TOPPINGS.filter((t) => t.unlockCondition);

function freePrepare(): GameState {
  const owned = [...STARTER_INGREDIENT_IDS, ...TOPPINGS.map((t) => t.id)];
  const inventory = Object.fromEntries(FINITE_TOPPINGS.map((t) => [t.id, 3]));
  const initial = createInitialGameState(EMPTY_DEX, owned, 1_000, inventory, []);
  return gameReducer(initial, { type: "START_FREE_COOK", now: NOW });
}

const frozen = (s: GameState) => JSON.stringify({ owned: s.ownedIngredientIds, inventory: s.inventory });

describe("H-5 precondition (1): no PREPARE action changes ownership or stock", () => {
  it("every action a PREPARE step can dispatch keeps ownedIngredientIds and inventory, at every step", () => {
    let s = freePrepare();
    expect(s.phase).toBe("PREPARE");
    const baseline = frozen(s);
    const topping = FINITE_TOPPINGS[0].id;
    const perStep: Record<string, GameAction[]> = {
      DOUGH: [{ type: "RESET_PIZZA" }, { type: "PAUSE_COOKING_TIMING", now: NOW + 1 }, { type: "RESUME_COOKING_TIMING", now: NOW + 2 }],
      SAUCE: [
        { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 },
        { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: buildIdealSauceFixture() },
        { type: "SHOW_HINT" },
        { type: "PURCHASE_DISCOVERY_HINT", level: 1 },
        { type: "CLOSE_HINT" },
      ],
      CHEESE: [{ type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 }],
      TOPPING: [
        { type: "PLACE_TOPPING", ingredientId: topping, x: 45, y: 45 },
        { type: "PLACE_TOPPING", ingredientId: topping, x: 55, y: 55 },
        { type: "PLACE_TOPPING", ingredientId: topping, x: 60, y: 40 },
        { type: "PLACE_TOPPING", ingredientId: topping, x: 35, y: 60 }, // beyond the stock of 3: rejected, never consumed
      ],
    };
    const visited: string[] = [];
    for (const step of ["DOUGH", "SAUCE", "CHEESE", "TOPPING"] as const) {
      expect(s.makingStep).toBe(step);
      visited.push(step);
      for (const action of perStep[step]) {
        s = gameReducer(s, action);
        expect(frozen(s), `${step}: ${action.type}`).toBe(baseline);
      }
      if (step !== "TOPPING") s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
      expect(frozen(s), `${step}: CONFIRM_MAKING_STEP`).toBe(baseline);
    }
    expect(visited).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    // Not vacuous: the placements really happened (3 of the topping = its stock; the 4th was refused).
    expect(s.pizza.toppings.filter((t) => t.ingredientId === topping)).toHaveLength(3);
    expect(s.pizza.toppings.some((t) => t.ingredientId === "mozzarella")).toBe(true);
    expect(s.phase).toBe("PREPARE");
  });
});

describe("H-5 contract: a hand that APPEARS within a step is a hand change (if it ever becomes reachable)", () => {
  it("before = today's full tray, after = the hand: page 0, and a selection that is not on the new page 0 is cleared", () => {
    const catalog = runtimeCatalog();
    const owned = TOPPINGS.map((t) => t.id);
    const ownership = { ownedIds: owned, stock: () => 3 };
    const fullTray = TOPPINGS.map((t) => t.id); // inactive: every owned topping in catalog order
    const hand = selectWorkingSet({
      category: "topping",
      capacity: 9,
      catalog,
      ownership,
      placedIds: [],
      pinnedIds: [],
      disclosedHints: NO_DISCLOSED_HINTS,
      usage: emptyUsageSession(),
    });
    expect(hand.active).toBe(true);
    const after = hand.items.map((i) => i.id);
    // A selection on page 2 of the full tray that is not on page 0 of the new hand.
    const selected = trayPageIds(fullTray, 1)[0];
    expect(trayPageIds(after, 0)).not.toContain(selected);
    expect(handTrayTransition({ before: fullTray, after, selectedIngredientId: selected })).toEqual({
      changed: true,
      page: 0,
      selectedIngredientId: null,
    });
    // A selection that IS on the new page 0 survives.
    const kept = trayPageIds(after, 0)[0];
    expect(handTrayTransition({ before: fullTray, after, selectedIngredientId: kept }).selectedIngredientId).toBe(kept);
  });
});
