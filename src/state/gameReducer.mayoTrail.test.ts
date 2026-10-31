import { describe, expect, it } from "vitest";
import { gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createGuidedInitialState, startGuidedPrepare } from "./testSupport/guidedRound";
import { buildPendingRound, pizzaFromJournal, readStoredPendingRound } from "./pendingRound";
import { consumePizzaInventory } from "./inventory";
import type { PizzaState, PlacedTopping } from "./pizzaState";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import { signatureOfPizza } from "../logic/discovery/signature";
import { computeScoringV2 } from "../logic/scoringV2";
import { getRecipe } from "../data/recipes";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { isInsideDough, type DoughPoint } from "../logic/pizzaCoordinates";
import { SQUEEZE_MAX_LENGTH, trailLength } from "../logic/squeeze";
import { discoveredDex } from "./testSupport/guidedRound";
import { createInitialGameState } from "./gameReducer";
import { freeCookFinishEnabled } from "../data/freeCookFinishGate";

/**
 * Mayo squeeze (Issue #708 / PR #716, Owner-approved plan A): one traced stroke = ONE PlacedTopping (one stock unit) whose trail is
 * drawing-only. These pin that every existing contract -- recognition, Completion Gate, Scoring 2.0, inventory, the pendingRound
 * journal, Undo -- reads the squeezed piece exactly like a tapped one, and that the trail is honoured only for `mayo` in TOPPING.
 */
const act = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);

function toTopping(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 6 && s.makingStep !== "TOPPING"; i += 1) s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  expect(s.makingStep).toBe("TOPPING");
  return s;
}

const STROKE_A: DoughPoint[] = [{ x: 30, y: 30 }, { x: 36, y: 34 }, { x: 42, y: 30 }, { x: 48, y: 34 }, { x: 54, y: 30 }];
const STROKE_B: DoughPoint[] = [{ x: 30, y: 70 }, { x: 37, y: 66 }, { x: 44, y: 70 }, { x: 51, y: 66 }, { x: 58, y: 70 }];
const squeeze = (trail: readonly DoughPoint[], ingredientId = "mayo"): GameAction => ({ type: "PLACE_TOPPING", ingredientId, x: 42, y: 32, trail });
const place = (ingredientId: string, x: number, y: number): GameAction => ({ type: "PLACE_TOPPING", ingredientId, x, y });

/** The potato-mayo pieces other than mayo (cheese in CHEESE, the rest in TOPPING), on the Reference-like ring. */
function cheese(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 6 && s.makingStep !== "CHEESE"; i += 1) s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  return act(s, place("mozzarella", 50, 20), place("mozzarella", 50, 80));
}
function otherToppings(state: GameState): GameState {
  return act(toTopping(state), place("potato", 20, 50), place("potato", 80, 50), place("bacon", 30, 50), place("corn", 70, 50));
}
const mayoPieces = (s: GameState) => s.pizza.toppings.filter((t) => t.ingredientId === "mayo");
const withoutTrail = (pizza: PizzaState): PizzaState => ({ ...pizza, toppings: pizza.toppings.map(({ trail: _t, ...rest }) => rest as PlacedTopping) });

function freeCookPotatoMayo(): GameState {
  const owned = [...new Set([...STARTER_INGREDIENT_IDS, "potato", "bacon", "corn", "mayo"])];
  const inventory = { potato: 10, bacon: 10, corn: 10, mayo: 10 };
  const base = createInitialGameState(discoveredDex(["margherita"]), owned, 0, inventory, [], []);
  return gameReducer(base, { type: "START_FREE_COOK" });
}

describe("mayo squeeze: one traced stroke = one piece with a drawing-only trail", () => {
  it("a stroke in TOPPING places exactly ONE mayo piece, ON its line, carrying the (normalized) trail", () => {
    const s = act(toTopping(startGuidedPrepare("potato-mayo-pizza")), squeeze(STROKE_A));
    const pieces = mayoPieces(s);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].trail).toEqual(STROKE_A);
    expect(pieces[0].stage).toBeUndefined();
    // the anchor is the line's midpoint (free pizza): the stock unit Scoring / identification see sits on the line
    expect(pieces[0].x).toBeCloseTo(42, 6);
    expect(pieces[0].y).toBeCloseTo(30, 6); // the zigzag's middle vertex
    expect(s.placement?.status).toBe("placed");
  });

  it("two strokes are two pieces (the recipe's 2), and CONFIRM_BAKE consumes exactly two mayo -- one per stroke", () => {
    let s = otherToppings(cheese(startGuidedPrepare("potato-mayo-pizza")));
    s = act(s, squeeze(STROKE_A), squeeze(STROKE_B));
    expect(mayoPieces(s)).toHaveLength(2);
    const before = s.inventory.mayo;
    expect(before).toBe(99); // placement never consumes (the bake does)
    s = act(s, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: 68 });
    expect(s.inventory.mayo).toBe(before - 2);
  });

  it("is ignored for every other ingredient: the same action with a trail is the plain tap, byte for byte", () => {
    const base = toTopping(startGuidedPrepare("potato-mayo-pizza"));
    const withTrail = act(base, { type: "PLACE_TOPPING", ingredientId: "potato", x: 42, y: 32, trail: STROKE_A });
    const tapped = act(base, place("potato", 42, 32));
    expect(withTrail.pizza.toppings.map(({ id: _id, ...rest }) => rest)).toEqual(tapped.pizza.toppings.map(({ id: _id, ...rest }) => rest));
    expect(withTrail.pizza.toppings.some((t) => "trail" in t)).toBe(false);
  });

  it("a tap, a too-short or a malformed stroke is the ordinary drop (one piece, no trail) at the given point", () => {
    const base = toTopping(startGuidedPrepare("potato-mayo-pizza"));
    for (const trail of [[], [{ x: 40, y: 40 }, { x: 42, y: 40 }], [{ x: Number.NaN, y: 0 }, { x: 1, y: Number.NaN }]] as DoughPoint[][]) {
      const s = act(base, { type: "PLACE_TOPPING", ingredientId: "mayo", x: 40, y: 40, trail });
      expect(mayoPieces(s)).toEqual([expect.objectContaining({ ingredientId: "mayo", x: 40, y: 40 })]);
      expect("trail" in mayoPieces(s)[0]).toBe(false);
    }
    expect("trail" in mayoPieces(act(base, place("mayo", 40, 40)))[0]).toBe(false);
  });

  it("an over-long or off-pizza trail is cut to the limit and kept on the pizza (the reducer re-applies the gesture rules)", () => {
    const base = toTopping(startGuidedPrepare("potato-mayo-pizza"));
    const wild = [{ x: 4, y: 50 }, ...Array.from({ length: 60 }, (_, i) => ({ x: 6 + i * 2, y: 50 + (i % 2) * 30 }))];
    const piece = mayoPieces(act(base, { type: "PLACE_TOPPING", ingredientId: "mayo", x: 50, y: 50, trail: wild }))[0];
    expect(trailLength(piece.trail!)).toBeLessThanOrEqual(SQUEEZE_MAX_LENGTH + 1e-9);
    for (const p of piece.trail!) expect(isInsideDough(p.x, p.y)).toBe(true);
  });

  it("on a crowded line the piece moves ALONG the line to the first free point instead of disappearing", () => {
    // block the midpoint (42,32) with a potato; the stroke still lands, on a point of its own line
    const base = act(toTopping(startGuidedPrepare("potato-mayo-pizza")), place("potato", 42, 32));
    const s = act(base, squeeze(STROKE_A));
    const piece = mayoPieces(s)[0];
    expect(piece).toBeDefined();
    expect(piece.trail).toEqual(STROKE_A);
    expect(Math.hypot(piece.x - 42, piece.y - 32)).toBeGreaterThanOrEqual(9); // MIN_TOPPING_DISTANCE from the potato
    expect(piece.x).toBeGreaterThanOrEqual(30);
    expect(piece.x).toBeLessThanOrEqual(54);
  });

  it("is refused like a tap when there is no stock left (rejected feedback, no piece)", () => {
    // a Guided round needs the recipe's 2 mayo to start; the third stroke has no stock
    const base = toTopping(startGuidedPrepare("potato-mayo-pizza", { inventory: { potato: 9, bacon: 9, corn: 9, mayo: 2 } }));
    const two = act(base, squeeze(STROKE_A), squeeze(STROKE_B));
    expect(mayoPieces(two)).toHaveLength(2);
    const three = act(two, squeeze([{ x: 30, y: 50 }, { x: 45, y: 50 }]));
    expect(mayoPieces(three)).toHaveLength(2);
    expect(three.placement?.status).toBe("rejected");
  });

  it("Undo takes back exactly the last stroke (its line with it); the earlier stroke stays", () => {
    let s = act(toTopping(startGuidedPrepare("potato-mayo-pizza")), squeeze(STROKE_A), squeeze(STROKE_B));
    s = act(s, { type: "UNDO_LAST_PLACEMENT" });
    expect(mayoPieces(s)).toHaveLength(1);
    expect(mayoPieces(s)[0].trail).toEqual(STROKE_A);
  });

  it("is chosen by ingredient, not by recipe (anti-oracle): a Free Cooking round and another Guided recipe keep the trail too", () => {
    const free = act(toTopping(freeCookPotatoMayo()), squeeze(STROKE_A));
    expect(mayoPieces(free)[0].trail).toEqual(STROKE_A);
    const margherita = act(toTopping(startGuidedPrepare("margherita", { ownedIngredientIds: ["mayo"], inventory: { mayo: 5 } })), squeeze(STROKE_A));
    expect(mayoPieces(margherita)[0].trail).toEqual(STROKE_A);
  });

  it("FINISH keeps its own tap contract: a trail sent there is ignored (post piece, no trail)", () => {
    let s = otherToppings(cheese(freeCookPotatoMayo()));
    s = act(s, place("mayo", 40, 40), place("mayo", 60, 40), { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: 68 });
    if (!freeCookFinishEnabled()) return; // a build without the Free Cooking FINISH step has nothing to check here
    expect(s.makingStep).toBe("FINISH");
    s = act(s, squeeze(STROKE_A));
    const post = s.pizza.toppings.filter((t) => t.stage === "post");
    expect(post).toHaveLength(1);
    expect("trail" in post[0]).toBe(false);
  });
});

describe("mayo squeeze keeps recognition, scoring, inventory and the pendingRound journal exactly as for tapped pieces", () => {
  function squeezedFreeRound(): GameState {
    return act(otherToppings(cheese(freeCookPotatoMayo())), squeeze(STROKE_A), squeeze(STROKE_B));
  }

  it("a Free Cooking pizza squeezed with two strokes is recognized as potato-mayo-pizza, exactly as the same pieces without trails", () => {
    const s = squeezedFreeRound();
    const baked = { ...s.pizza, bakeResult: 68 };
    expect(signatureOfPizza(baked)).toEqual(signatureOfPizza(withoutTrail(baked)));
    const r = resolveFreeCookPizza(baked, s.dex);
    expect(r.kind).toBe("MATCHED");
    if (r.kind === "MATCHED") expect(r.recipe.id).toBe("potato-mayo-pizza");
    expect(resolveFreeCookPizza(withoutTrail(baked), s.dex)).toEqual(r);
  });

  it("Scoring 2.0 and the inventory consumption ignore the trail", () => {
    const s = squeezedFreeRound();
    const baked = { ...s.pizza, bakeResult: 68 };
    const recipe = getRecipe("potato-mayo-pizza")!;
    expect(computeScoringV2(recipe, baked)).toEqual(computeScoringV2(recipe, withoutTrail(baked)));
    expect(consumePizzaInventory(baked, s.inventory)).toEqual(consumePizzaInventory(withoutTrail(baked), s.inventory));
  });

  it("the pendingRound journal never stores the trail; a resumed round (drawn as drops) is recognized, scored and consumed identically", () => {
    const s = squeezedFreeRound();
    const journal = buildPendingRound(s, "round-mayo-1", 68, 1);
    const text = JSON.stringify(journal);
    expect(text).not.toContain("trail");
    const stored = readStoredPendingRound(JSON.parse(text));
    expect(stored.kind).toBe("round");
    if (stored.kind !== "round") return;
    const resumed = { ...pizzaFromJournal(stored.round.pizza), bakeResult: 68 };
    const live = { ...s.pizza, bakeResult: 68 };
    expect(resumed.toppings.some((t) => "trail" in t)).toBe(false);
    expect(resumed.toppings).toEqual(withoutTrail(live).toppings);
    expect(resolveFreeCookPizza(resumed, s.dex)).toEqual(resolveFreeCookPizza(live, s.dex));
    expect(consumePizzaInventory(resumed, s.inventory)).toEqual(consumePizzaInventory(live, s.inventory));
    const recipe = getRecipe("potato-mayo-pizza")!;
    expect(computeScoringV2(recipe, resumed)).toEqual(computeScoringV2(recipe, live));
  });

  it("the journal reader drops a trail written into a stored journal (the existing field whitelist), and still reads the round", () => {
    const s = squeezedFreeRound();
    const raw = JSON.parse(JSON.stringify(buildPendingRound(s, "round-mayo-2", 68, 1)));
    raw.pizza.toppings = raw.pizza.toppings.map((t: Record<string, unknown>) => (t.ingredientId === "mayo" ? { ...t, trail: STROKE_A } : t));
    const stored = readStoredPendingRound(raw);
    expect(stored.kind).toBe("round");
    if (stored.kind === "round") expect(stored.round.pizza.toppings.some((t) => "trail" in t)).toBe(false);
  });

  it("the Guided initial state is untouched by the change (no trail anywhere before a squeeze)", () => {
    expect(createGuidedInitialState("potato-mayo-pizza").pizza.toppings).toEqual([]);
  });
});
