import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { FREE_COOK_RECIPE } from "../../data/freeCook";
import { getRecipe, type RecipeId } from "../../data/recipes";
import { createInitialGameState, gameReducer, type GameState } from "../../state/gameReducer";
import { loadSave, type StorageLike } from "../../state/persistence";
import { purchaseFirstPack } from "../materialShop";
import { trayIngredientsFor } from "../prepareDock";
import { runtimeCatalog } from "./catalogSource";
import type { CatalogIngredient, OwnershipView } from "./catalogTypes";
import { isLargeCatalogEligible } from "./freeEligibility";
import { HAND_CAPACITY_CANDIDATES, HAND_ENFORCEMENT_ENABLED, handCapacityFor, isHandCapacityCandidate } from "./handPolicy";
import {
  addToHand,
  emptyHandSession,
  handVisibleIds,
  pruneHand,
  recentlyAcquiredIds,
  removeFromHand,
  replaceHand,
  resolveHand,
  sanitizeHandSession,
  selectionAfterVisibleChange,
  type HandContext,
  type ResolveHandInput,
} from "./handSession";
import { emptyUsageSession, recordNewlyOwned, recordUse } from "./usageSignals";
import { selectWorkingSet } from "./workingSet";

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const catalog = runtimeCatalog();
const toppingIds = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
const ownAll: OwnershipView = { ownedIds: ALL_IDS, stock: () => 5 };
const ctx = (over: Partial<HandContext> = {}): HandContext => ({ category: "topping", catalog, ownership: ownAll, ...over });

function base(): GameState {
  return createInitialGameState([], ALL_IDS, 500, {}, [], FINITE_IDS, {});
}
const freeRound = () => gameReducer(base(), { type: "START_FREE_COOK" });
function guidedRound(): GameState {
  const dex = [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3 as const, timesMade: 1 }];
  const s = gameReducer(createInitialGameState(dex, ALL_IDS, 500, {}, [], FINITE_IDS, {}), { type: "SELECT_RECIPE", recipeId: "margherita" as RecipeId });
  if (s.roundKind !== "GUIDED") throw new Error(`expected a guided round, got ${s.roundKind}`);
  return s;
}
function dinnerRound(): GameState {
  const dex = ["margherita", "bismarck", "breakfast-pizza", "funghi", "marinara"].map((recipeId) => ({
    recipeId,
    discovered: true,
    bestScore: 70,
    bestStars: 3 as const,
    timesMade: 1,
  }));
  const s = gameReducer(createInitialGameState(dex, ALL_IDS, 500, { egg: 2, bacon: 3, mushroom: 3 }, [], FINITE_IDS, {}), {
    type: "DINNER_START",
    missionId: "dm-a",
    now: 1_000_000,
    durationMs: 600_000,
    minimumStars: 3,
  });
  if (s.dinner === null) throw new Error("Dinner did not start");
  return s;
}
const resolve = (over: Partial<ResolveHandInput> & { round: ResolveHandInput["round"] }) =>
  resolveHand({ category: "topping", catalog, ownership: ownAll, session: emptyHandSession(), usage: emptyUsageSession(), candidateCapacity: 9, ...over });

describe("LC-R2 FREE-only eligibility (OD-1)", () => {
  it("FREE Cooking (roundKind FREE_COOK, dinner null) is eligible", () => {
    const s = freeRound();
    expect(s.roundKind).toBe("FREE_COOK");
    expect(s.dinner).toBeNull();
    expect(isLargeCatalogEligible(s)).toBe(true);
  });

  it("Dinner is NOT eligible, although the tray treats it as recipe-free (recipeFreeTray is true there)", () => {
    const s = dinnerRound();
    expect(s.roundKind).toBe("DINNER");
    expect(s.freeCook).toBe(false);
    expect(s.freeCook || s.dinner !== null).toBe(true); // GameScreen's recipeFreeTray
    expect(isLargeCatalogEligible(s)).toBe(false);
  });

  it("guided, Lunch Rush and every other kind are not eligible; a forged flag cannot make them eligible", () => {
    expect(isLargeCatalogEligible(guidedRound())).toBe(false);
    expect(isLargeCatalogEligible({ roundKind: "LUNCH_RUSH", dinner: null })).toBe(false);
    expect(isLargeCatalogEligible({ roundKind: "GUIDED", dinner: null, freeCook: true } as never)).toBe(false);
    expect(isLargeCatalogEligible({ ...freeRound(), freeCook: true, roundKind: "DINNER" } as never)).toBe(false);
  });

  it("FREE kind with a dinner session, or with `dinner` absent / unknown, fails closed", () => {
    expect(isLargeCatalogEligible({ roundKind: "FREE_COOK", dinner: {} })).toBe(false);
    expect(isLargeCatalogEligible({ roundKind: "FREE_COOK", dinner: undefined })).toBe(false);
    expect(isLargeCatalogEligible({ roundKind: "FREE_COOK" } as never)).toBe(false);
  });

  it("resolveHand is OFF (null = keep the current paged tray) for Dinner, guided and Lunch Rush; ON for FREE", () => {
    expect(resolve({ round: dinnerRound() })).toBeNull();
    expect(resolve({ round: guidedRound() })).toBeNull();
    expect(resolve({ round: { roundKind: "LUNCH_RUSH", dinner: null } })).toBeNull();
    expect(resolve({ round: freeRound() })).not.toBeNull();
  });

  it("the other rounds keep their existing tray: guided stays recipe-only, Dinner / FREE stay all-owned", () => {
    const recipe = getRecipe("margherita" as RecipeId)!;
    const guided = trayIngredientsFor("topping", { ownedIngredientIds: ALL_IDS, freeCook: false, recipe });
    expect(guided.map((i) => i.id).sort()).toEqual(recipe.requiredIngredients.map((r) => r.ingredientId).filter((id) => toppingIds.includes(id)).sort());
    expect(trayIngredientsFor("topping", { ownedIngredientIds: ALL_IDS, freeCook: true, recipe: FREE_COOK_RECIPE })).toHaveLength(27);
  });
});

// LC-R6-e: this file runs in the `hand-off` project (the production flag literal compiled back to false = the rollback state).
describe("LC-R2 capacity policy: 9 and 12 are both supported; with enforcement OFF (rollback state) nothing is hidden", () => {
  it("candidates are exactly 9 and 12, enforcement is off", () => {
    expect([...HAND_CAPACITY_CANDIDATES]).toEqual([9, 12]);
    expect(HAND_ENFORCEMENT_ENABLED).toBe(false);
    expect(isHandCapacityCandidate(9) && isHandCapacityCandidate(12)).toBe(true);
    expect([10, 0, "9", null].some(isHandCapacityCandidate)).toBe(false);
  });

  it("with enforcement off the hand never hides an owned ingredient: it equals today's tray for 9 and 12", () => {
    const recipe = getRecipe("margherita" as RecipeId)!;
    for (const category of ["sauce", "cheese", "topping"] as const) {
      const today = trayIngredientsFor(category, { ownedIngredientIds: ALL_IDS, freeCook: true, recipe: FREE_COOK_RECIPE }).map((i) => i.id);
      for (const candidateCapacity of HAND_CAPACITY_CANDIDATES) {
        const hand = resolve({ round: freeRound(), category, candidateCapacity })!;
        expect(hand.active).toBe(false);
        expect(handVisibleIds(hand)).toEqual(today);
        expect(hand.overflowIds).toEqual([]);
      }
    }
    void recipe;
  });

  it("handCapacityFor is always >= the owned count (never hides) and >= 1", () => {
    for (const n of [0, 1, 6, 9, 12, 22, 105]) for (const c of HAND_CAPACITY_CANDIDATES) expect(handCapacityFor(n, c)).toBeGreaterThanOrEqual(Math.max(1, n));
    expect(handCapacityFor(Number.NaN, 9)).toBe(1);
  });

  it("the underlying working set already supports capacity 9 and 12 (logic ready for the Owner's choice)", () => {
    const input = {
      category: "topping" as const,
      catalog,
      ownership: ownAll,
      placedIds: [] as string[],
      pinnedIds: [] as string[],
      disclosedHints: { namedIngredientIds: [] as string[] },
      usage: emptyUsageSession(),
    };
    for (const capacity of HAND_CAPACITY_CANDIDATES) {
      const ws = selectWorkingSet({ ...input, capacity });
      expect(ws.active).toBe(true);
      expect(ws.items).toHaveLength(capacity);
      // catalog-order fill, deterministic
      expect(ws.items.map((i) => i.id)).toEqual(toppingIds.slice(0, capacity));
    }
    // 9 leaves 3 free cells on page 2 of a 6-per-page tray; 12 fills both pages exactly.
    expect(Math.ceil(9 / 6)).toBe(Math.ceil(12 / 6));
  });
});

describe("LC-R2 hand operations (add / remove / replace) are pure, OWNED-only and order-stable", () => {
  it("add appends acceptable ids in order, de-duplicates, keeps existing order", () => {
    let s = addToHand(emptyHandSession(), ["pineapple", "bacon"], ctx());
    s = addToHand(s, ["onion", "bacon", "mushroom", "pineapple"], ctx());
    expect(s.topping).toEqual(["pineapple", "bacon", "onion", "mushroom"]); // insertion order, not alphabetical / catalog
  });

  it("rejects unowned, other-category, unknown and hostile ids; accepts zero stock (explicit choice)", () => {
    const owned: OwnershipView = { ownedIds: ["bacon", "tomato-sauce"], stock: () => 0 };
    const s = addToHand(emptyHandSession(), ["bacon", "onion", "tomato-sauce", "nope", "__proto__", 3 as never, ""], ctx({ ownership: owned }));
    expect(s.topping).toEqual(["bacon"]);
  });

  it("remove and replace", () => {
    let s = addToHand(emptyHandSession(), ["bacon", "onion", "mushroom"], ctx());
    s = removeFromHand(s, "onion", "topping");
    expect(s.topping).toEqual(["bacon", "mushroom"]);
    expect(removeFromHand(s, "nothing", "topping").topping).toEqual(["bacon", "mushroom"]);
    s = replaceHand(s, ["mushroom", "basil", "bacon", "mushroom"], ctx());
    expect(s.topping).toEqual(["mushroom", "basil", "bacon"]);
    expect(replaceHand(s, [], ctx()).topping).toEqual([]);
  });

  it("operations never mutate their input and touch only their own category", () => {
    const start = addToHand(emptyHandSession(), ["mozzarella"], ctx({ category: "cheese" }));
    const frozen = JSON.stringify(start);
    const next = addToHand(start, ["bacon"], ctx());
    expect(JSON.stringify(start)).toBe(frozen);
    expect(next.cheese).toEqual(["mozzarella"]);
    expect(next.topping).toEqual(["bacon"]);
  });

  it("prune drops pins that are no longer owned (e.g. after a reset)", () => {
    const s = addToHand(emptyHandSession(), ["bacon", "onion"], ctx());
    const fewer: OwnershipView = { ownedIds: ["onion"], stock: () => 1 };
    expect(pruneHand(s, ctx({ ownership: fewer })).topping).toEqual(["onion"]);
  });

  it("sanitize turns untrusted shapes into a well-formed session (own properties only)", () => {
    expect(sanitizeHandSession(null)).toEqual(emptyHandSession());
    expect(sanitizeHandSession({ topping: ["a", 1, "a", "b"], cheese: "x" })).toEqual({ sauce: [], cheese: [], topping: ["a", "b"] });
    expect(sanitizeHandSession(JSON.parse('{"__proto__":{"topping":["evil"]}}')).topping).toEqual([]);
  });

  it("pinned ids win over automatic sources and are kept at zero stock; automatic sources skip zero stock", () => {
    const stock: Record<string, number> = { bacon: 0, onion: 0 };
    const own: OwnershipView = { ownedIds: ALL_IDS, stock: (id) => stock[id] ?? 5 };
    const pinned = addToHand(emptyHandSession(), ["bacon"], ctx({ ownership: own }));
    const hand = resolve({ round: freeRound(), ownership: own, session: pinned, candidateCapacity: 9 })!;
    expect(hand.items.map((i) => i.id)).toContain("bacon"); // explicit + zero stock stays (inactive: everything is shown)
    const forced = selectWorkingSet({ category: "topping", capacity: 9, catalog, ownership: own, placedIds: [], pinnedIds: ["bacon"], disclosedHints: { namedIngredientIds: [] }, usage: emptyUsageSession() });
    expect(forced.items[0]).toEqual({ id: "bacon", source: "pinned" });
    expect(forced.items.map((i) => i.id)).not.toContain("onion"); // zero stock, automatic fill only
  });
});

describe("LC-R2 initial hand contract (FREE start; deterministic, OWNED only, no recommendation engine)", () => {
  const forced = (over: Partial<Parameters<typeof selectWorkingSet>[0]> = {}) =>
    selectWorkingSet({ category: "topping", capacity: 9, catalog, ownership: ownAll, placedIds: [], pinnedIds: [], disclosedHints: { namedIngredientIds: [] }, usage: emptyUsageSession(), ...over });

  it("empty session, first launch: catalog-order fill of OWNED, starters included, deterministic", () => {
    const starters = new Set<string>(STARTER_INGREDIENT_IDS);
    const own: OwnershipView = { ownedIds: [...STARTER_INGREDIENT_IDS], stock: (id) => (starters.has(id) ? "UNLIMITED" : 0) };
    const ws = forced({ ownership: own });
    expect(ws.active).toBe(false);
    expect(ws.items.map((i) => i.id)).toEqual(INGREDIENTS.filter((i) => i.category === "topping" && starters.has(i.id)).map((i) => i.id));
    expect(forced()).toEqual(forced());
  });

  it("previous hand (pins) first, then recent, then newly acquired, then catalog fill; unowned pins are ignored", () => {
    const usage = recordNewlyOwned(recordUse(emptyUsageSession(), ["mushroom", "onion"]), "pineapple");
    const own: OwnershipView = { ownedIds: ALL_IDS.filter((id) => id !== "black-olive"), stock: () => 5 };
    const ws = forced({ pinnedIds: ["black-olive", "sausage", "pepperoni"], usage, ownership: own });
    const order = ws.items.map((i) => i.id);
    expect(order.slice(0, 2)).toEqual(["sausage", "pepperoni"]);
    expect(order).not.toContain("black-olive");
    expect(ws.items.map((i) => i.source).slice(0, 2)).toEqual(["pinned", "pinned"]);
    expect(order.indexOf("mushroom")).toBeLessThan(order.indexOf("pineapple"));
  });

  it("newly purchased ingredient is placed above catalog fill when it is known (session usage)", () => {
    const last = toppingIds[toppingIds.length - 1];
    const ws = forced({ usage: recordNewlyOwned(emptyUsageSession(), last) });
    expect(ws.items.map((i) => i.id)).toContain(last);
    expect(forced().items.map((i) => i.id)).not.toContain(last);
  });

  it("save / reload: the session is not persisted, so the hand falls back to the same deterministic fill", () => {
    const before = forced({ pinnedIds: ["sausage"] });
    const afterReload = forced({ pinnedIds: emptyHandSession().topping });
    expect(afterReload.items.map((i) => i.id)).toEqual(toppingIds.slice(0, 9));
    expect(before.items[0].id).toBe("sausage");
  });

  it("acquisition order is already in the save: purchases append, load keeps the order (no new field needed)", () => {
    let owned: readonly string[] = [...STARTER_INGREDIENT_IDS];
    const buy = FINITE_IDS.slice(0, 3);
    for (const id of buy) {
      const r = purchaseFirstPack({
        ingredient: INGREDIENTS.find((i) => i.id === id)!,
        ownedIngredientIds: owned,
        unlockedForShopIngredientIds: FINITE_IDS,
        inventory: {},
        pitzBalance: 100000,
      });
      if (!r.success) throw new Error(`purchase failed: ${id}`);
      owned = r.nextOwnedIngredientIds;
    }
    expect(owned.slice(-3)).toEqual(buy);
    const store = new Map<string, string>();
    const storage: StorageLike = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) };
    storage.setItem(
      "teto-pizza-save-v1",
      JSON.stringify({ schemaVersion: 2, dex: [], pitzBalance: 0, ownedIngredientIds: owned, missionBest: {} }),
    );
    const loaded = loadSave(storage).ownedIngredientIds;
    expect(loaded.slice(-3)).toEqual(buy);
    expect(recentlyAcquiredIds(loaded, STARTER_INGREDIENT_IDS)).toEqual([...buy].reverse());
    expect(recentlyAcquiredIds(loaded, STARTER_INGREDIENT_IDS, 2)).toEqual([...buy].reverse().slice(0, 2));
    expect(recentlyAcquiredIds(["a", "a", "b"], [])).toEqual(["b", "a"]);
  });
});

describe("LC-R2 selection safety (PR #197) as a pure rule; independent of pantry picks (OD-2)", () => {
  it("clears a selection that leaves the visible set; keeps one that stays or was never visible", () => {
    expect(selectionAfterVisibleChange("bacon", ["bacon", "onion"], ["onion"])).toBeNull();
    expect(selectionAfterVisibleChange("bacon", ["bacon", "onion"], ["onion", "bacon"])).toBe("bacon");
    expect(selectionAfterVisibleChange("basil", ["bacon"], ["onion"])).toBe("basil"); // another step's category
    expect(selectionAfterVisibleChange(null, ["a"], [])).toBeNull();
  });

  it("works on real hand changes: dropping the selected pin from an active hand clears it; other pins stay", () => {
    const own: OwnershipView = { ownedIds: ALL_IDS, stock: () => 5 };
    const c = ctx({ ownership: own });
    const hand = (pinned: readonly string[]) =>
      handVisibleIds(selectWorkingSet({ category: "topping", capacity: 9, catalog, ownership: own, placedIds: [], pinnedIds: pinned, disclosedHints: { namedIngredientIds: [] }, usage: emptyUsageSession() }));
    const [a, b] = [toppingIds[15], toppingIds[16]]; // beyond the first-9 catalog fill: visible only because pinned
    const pins = replaceHand(emptyHandSession(), [a, b], c);
    const before = hand(pins.topping);
    expect(before).toContain(a);
    const after = hand(removeFromHand(pins, a, "topping").topping);
    expect(after).not.toContain(a);
    expect(selectionAfterVisibleChange(a, before, after)).toBeNull();
    expect(selectionAfterVisibleChange(b, before, after)).toBe(b);
  });

  it("pantry picks are a different concept: the hand API has no picks state and never reads one", () => {
    const keys = Object.keys(emptyHandSession()).sort();
    expect(keys).toEqual(["cheese", "sauce", "topping"]);
  });
});

describe("LC-R2 save and ownership are untouched", () => {
  it("operations return new sessions and never accept ownership / stock changes", () => {
    const own: OwnershipView = { ownedIds: ALL_IDS, stock: () => 5 };
    const ownedSnapshot = JSON.stringify(own.ownedIds);
    addToHand(emptyHandSession(), ["bacon"], ctx({ ownership: own }));
    resolve({ round: freeRound(), ownership: own });
    expect(JSON.stringify(own.ownedIds)).toBe(ownedSnapshot);
  });

  it("the catalog descriptors the hand reads are unchanged by any hand operation", () => {
    const before: CatalogIngredient[] = JSON.parse(JSON.stringify(catalog));
    addToHand(emptyHandSession(), ["bacon"], ctx());
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(before);
  });
});
