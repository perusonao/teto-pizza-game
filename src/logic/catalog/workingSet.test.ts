import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import { FREE_COOK_RECIPE } from "../../data/freeCook";
import { trayIngredientsFor } from "../prepareDock";
import { runtimeCatalog } from "./catalogSource";
import type { CatalogIngredient, OwnershipView } from "./catalogTypes";
import { NO_DISCLOSED_HINTS } from "./hintDisclosure";
import { emptyUsageSession, type UsageSession } from "./usageSignals";
import { selectWorkingSet, type WorkingSetInput } from "./workingSet";
import { largeCatalogFixture, mulberry32 } from "./testSupport/largeCatalogFixtures";

function toppings(n: number): CatalogIngredient[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${String(i).padStart(2, "0")}`,
    category: "topping" as const,
    nameJa: `具${i}`,
    shelf: "vegetable" as const,
    catalogIndex: i,
  }));
}

function input(over: Partial<WorkingSetInput> = {}, stock: Record<string, number> = {}): WorkingSetInput {
  const catalog = over.catalog ?? toppings(20);
  const ownership: OwnershipView = {
    ownedIds: catalog.map((i) => i.id),
    stock: (id) => stock[id] ?? 5,
  };
  return {
    category: "topping",
    capacity: 6,
    catalog,
    ownership,
    placedIds: [],
    pinnedIds: [],
    disclosedHints: NO_DISCLOSED_HINTS,
    usage: emptyUsageSession(),
    ...over,
  };
}

const ids = (ws: ReturnType<typeof selectWorkingSet>) => ws.items.map((i) => i.id);

describe("selectWorkingSet: activation and capacity (LC-OD-4 capacity is an argument)", () => {
  it("is inactive and identical to today's tray when owned <= capacity (zero stock included)", () => {
    const ws = selectWorkingSet(input({ catalog: toppings(6), capacity: 6 }, { t03: 0 }));
    expect(ws.active).toBe(false);
    expect(ids(ws)).toEqual(["t00", "t01", "t02", "t03", "t04", "t05"]);
  });

  it("accepts 9 and 12 (and any positive integer), never more items than the capacity", () => {
    for (const capacity of [1, 6, 9, 12, 15]) {
      const ws = selectWorkingSet(input({ capacity }));
      expect(ws.active).toBe(20 > capacity);
      expect(ws.items.length).toBe(Math.min(capacity, 20));
    }
  });

  it("rejects a non-positive or fractional capacity", () => {
    for (const capacity of [0, -1, 1.5, Number.NaN]) {
      expect(() => selectWorkingSet(input({ capacity }))).toThrow(RangeError);
    }
  });
});

describe("selectWorkingSet: priority placed > pinned > hint > favorite > recent > new > fill", () => {
  it("orders sources and keeps each id once, at its highest source", () => {
    const usage: UsageSession = { favorites: ["t10", "t05"], recent: ["t11", "t10"], newlyOwned: ["t12"] };
    const ws = selectWorkingSet(
      input({
        capacity: 8,
        placedIds: ["t05"],
        pinnedIds: ["t09", "t05"],
        disclosedHints: { namedIngredientIds: ["t08", "t07"] },
        usage,
      }),
    );
    expect(ws.items).toEqual([
      { id: "t05", source: "placed" },
      { id: "t09", source: "pinned" },
      { id: "t07", source: "hint" },
      { id: "t08", source: "hint" },
      { id: "t10", source: "favorite" },
      { id: "t11", source: "recent" },
      { id: "t12", source: "new" },
      { id: "t00", source: "fill" },
    ]);
  });

  it("LC-OD-17: automatic sources skip zero stock; placed / pinned keep it", () => {
    const ws = selectWorkingSet(
      input(
        {
          placedIds: ["t01"],
          pinnedIds: ["t02"],
          disclosedHints: { namedIngredientIds: ["t03"] },
          usage: { favorites: ["t04"], recent: ["t05"], newlyOwned: ["t06"] },
        },
        { t01: 0, t02: 0, t03: 0, t04: 0, t05: 0, t06: 0, t00: 0 },
      ),
    );
    expect(ids(ws)).toEqual(["t01", "t02", "t07", "t08", "t09", "t10"]);
  });

  it("reports explicit ids that did not fit as overflow", () => {
    const ws = selectWorkingSet(input({ capacity: 2, placedIds: ["t01", "t02"], pinnedIds: ["t03"] }));
    expect(ids(ws)).toEqual(["t01", "t02"]);
    expect(ws.overflowIds).toEqual(["t03"]);
  });

  it("ignores unowned, other-category, unknown and hostile ids", () => {
    const catalog: CatalogIngredient[] = [
      ...toppings(10),
      { id: "cheese-a", category: "cheese", nameJa: "チ", shelf: "cheese", catalogIndex: 99 },
    ];
    const ws = selectWorkingSet({
      ...input({ catalog, capacity: 3 }),
      ownership: { ownedIds: catalog.map((i) => i.id).filter((id) => id !== "t00"), stock: () => 1 },
      placedIds: ["t00", "cheese-a", "nope", "__proto__", 5 as unknown as string],
    });
    expect(ids(ws)).toEqual(["t01", "t02", "t03"]);
  });
});

describe("production equivalence (B-6)", () => {
  it("inactive working set == trayIngredientsFor(freeCook) for every runtime category", () => {
    const catalog = runtimeCatalog();
    const owned = INGREDIENTS.map((i) => i.id);
    for (const category of ["sauce", "cheese", "topping"] as const) {
      const tray = trayIngredientsFor(category, { ownedIngredientIds: owned, freeCook: true, recipe: FREE_COOK_RECIPE });
      const ws = selectWorkingSet({
        ...input({ catalog, capacity: 99 }),
        category,
        ownership: { ownedIds: owned, stock: () => 0 },
      });
      expect(ws.active).toBe(false);
      expect(ids(ws)).toEqual(tray.map((i) => i.id));
    }
  });
});

describe("privacy (B-1 / B-2)", () => {
  const base = () =>
    input({
      catalog: runtimeCatalog() as CatalogIngredient[],
      capacity: 6,
      usage: { favorites: ["bacon"], recent: ["ham"], newlyOwned: [] },
    });
  const withOwnedAll = (i: WorkingSetInput): WorkingSetInput => ({
    ...i,
    ownership: { ownedIds: INGREDIENTS.map((x) => x.id), stock: () => 3 },
  });

  it("P-2: hidden recipe identity (target, matcher result, answer ingredients) cannot change the result", () => {
    const plain = selectWorkingSet(withOwnedAll(base()));
    for (const recipe of RECIPES) {
      const leaky = {
        ...withOwnedAll(base()),
        targetRecipeId: recipe.id,
        matcherResult: { kind: "UNIQUE_MATCH", recipeId: recipe.id },
        nearMiss: { kind: "ADD_ONE", keyUnused: true },
        answerIngredientIds: recipe.requiredIngredients.map((r) => r.ingredientId),
        reservedIngredientId: recipe.requiredIngredients.at(-1)!.ingredientId,
      } as unknown as WorkingSetInput;
      expect(selectWorkingSet(leaky)).toEqual(plain);
    }
  });

  it("P-3: only disclosed hint ids matter -- an undisclosed fact passed any other way has no effect", () => {
    const plain = selectWorkingSet(withOwnedAll(base()));
    const leaky = { ...withOwnedAll(base()), undisclosedFactIds: ["ing:anchovy"], hintModel: { purchasableFacts: ["anchovy"] } };
    expect(selectWorkingSet(leaky as unknown as WorkingSetInput)).toEqual(plain);
  });

  it("P-6 / LC-OD-16b: a Dinner target never auto-inserts its ingredients", () => {
    const plain = selectWorkingSet(withOwnedAll(base()));
    const dinner = {
      ...withOwnedAll(base()),
      dinnerTargetRecipeIds: ["meat-lovers", "capricciosa"],
      dinner: { run: { targets: ["meat-lovers"] }, pending: { identityRecipeId: "capricciosa" } },
    };
    const ws = selectWorkingSet(dinner as unknown as WorkingSetInput);
    expect(ws).toEqual(plain);
    const answer: string[] = RECIPES.find((r) => r.id === "capricciosa")!.requiredIngredients.map((r) => r.ingredientId);
    const nonFill = ws.items.filter((i) => i.source !== "fill").map((i) => i.id);
    expect(nonFill.filter((id) => answer.includes(id) && !["bacon", "ham"].includes(id))).toEqual([]);
  });
});

describe("property: deterministic, order-independent, bounded (200 seeded cases)", () => {
  const fixture = largeCatalogFixture("full-105x172");
  it("holds for random owned / usage / placement on the 105-ingredient fixture", () => {
    const rand = mulberry32(2026);
    const pickSome = (n: number) =>
      Array.from({ length: n }, () => fixture.catalog[Math.floor(rand() * fixture.catalog.length)].id);
    for (let k = 0; k < 200; k++) {
      const owned = fixture.catalog.filter(() => rand() < 0.7).map((i) => i.id);
      const stockMap = new Map(fixture.catalog.map((i) => [i.id, Math.floor(rand() * 4)] as const));
      const capacity = [6, 9, 12, 15][k % 4];
      const inp: WorkingSetInput = {
        category: (["sauce", "cheese", "topping"] as const)[k % 3],
        capacity,
        catalog: fixture.catalog,
        ownership: { ownedIds: owned, stock: (id) => stockMap.get(id) ?? 0 },
        placedIds: pickSome(3),
        pinnedIds: pickSome(3),
        disclosedHints: { namedIngredientIds: pickSome(2) },
        usage: { favorites: pickSome(4), recent: pickSome(6), newlyOwned: pickSome(2) },
      };
      const a = selectWorkingSet(inp);
      // (5) same input -> same output
      expect(selectWorkingSet(inp)).toEqual(a);
      // (1) catalog / owned input order never matters
      const shuffled = { ...inp, catalog: [...inp.catalog].reverse(), ownership: { ...inp.ownership, ownedIds: [...owned].reverse() } };
      expect(selectWorkingSet(shuffled)).toEqual(a);
      // (2) subset of owned, right category; (3) bounded
      const ownedSet = new Set(owned);
      const byId = new Map(fixture.catalog.map((i) => [i.id, i]));
      for (const item of a.items) {
        expect(ownedSet.has(item.id)).toBe(true);
        expect(byId.get(item.id)!.category).toBe(inp.category);
      }
      if (a.active) expect(a.items.length).toBeLessThanOrEqual(capacity);
      expect(new Set(a.items.map((i) => i.id)).size).toBe(a.items.length);
      // (4) placed come first while they fit
      const placed = a.items.filter((i) => i.source === "placed");
      expect(a.items.slice(0, placed.length)).toEqual(placed);
    }
  });
});
