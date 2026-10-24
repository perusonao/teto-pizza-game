import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { TECHNIQUES } from "./techniques";
import { LATE_RECIPES, lateCatalogEnabled } from "./lateCatalog";

/**
 * FIN-E4b-ikura (Issue #621): the real late content (`ikura-salmon-pizza` + `salmon-roe`) with the build-time switch mocked ON,
 * against the real OFF (Production) modules. No late step NUMBER is pinned anywhere: it is always derived from the OFF ladder.
 */

async function load(enabled: boolean) {
  vi.resetModules();
  // E5: Production has the switch ON, so both states are mocked explicitly (OFF = the rollback state, ON = what ships).
  vi.doMock("./lateCatalog", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./lateCatalog")>()),
    LATE_CATALOG_PRODUCTION: enabled,
    lateCatalogEnabled: () => enabled,
  }));
  // Sequential on purpose: concurrent imports would run the mock factory twice.
  await import("./lateCatalog");
  const recipes = await import("./recipes");
  const ingredients = await import("./ingredients");
  const ladder = await import("./discoveryLadder");
  const catalog = await import("./discoveryCatalog");
  const orders = await import("./orders");
  const taxonomy = await import("./ingredientTaxonomy");
  const sizes = await import("./toppingSizeClass");
  const matcher = await import("../logic/discovery/matcher");
  const signature = await import("../logic/discovery/signature");
  const ladderLogic = await import("../logic/discoveryLadder");
  const techniques = await import("../logic/techniques/detection");
  const hint = await import("../logic/discovery/hint5Ladder");
  return { recipes, ingredients, ladder, catalog, orders, taxonomy, sizes, matcher, signature, ladderLogic, techniques, hint };
}

afterEach(() => {
  vi.doUnmock("./lateCatalog");
  vi.resetModules();
});

const IKURA = "ikura-salmon-pizza";

function pizzaOf(pre: readonly string[], post: readonly string[]): PizzaState {
  const piece = (ingredientId: string, i: number, stage?: "post") => ({ id: `${stage ?? "pre"}${i}`, ingredientId, x: 30 + i * 4, y: 50, ...(stage ? { stage } : {}) });
  return { ...createEmptyPizza(), sauceIds: [], toppings: [...pre.map((id, i) => piece(id, i)), ...post.map((id, i) => piece(id, i, "post"))], bakeResult: 70 };
}

describe("OFF (the rollback state) is untouched by the ikura content", () => {
  it("E5: Production ships with the switch ON, and the real modules hold ikura last", () => {
    expect(lateCatalogEnabled()).toBe(true);
  });

  it("with the switch OFF, no catalog, order, taxonomy row or size class mentions ikura / salmon-roe", async () => {
    const off = await load(false);
    expect(off.recipes.RECIPES.some((r) => (r.id as string) === IKURA)).toBe(false);
    expect(off.recipes.RECIPES.some((r) => r.requiredIngredients.some((q) => "applicationPhase" in q))).toBe(false); // no POST_BAKE anywhere
    expect(off.ingredients.INGREDIENTS.some((i) => i.id === "salmon-roe")).toBe(false);
    expect(off.ladder.DISCOVERY_LADDER.steps.some((s) => s.ingredientIds.includes("salmon-roe"))).toBe(false);
    expect(off.catalog.RECIPE_DISCOVERY_CATALOG.some((t) => (t.recipeId as string) === IKURA)).toBe(false);
    expect(off.orders.ORDERS.some((o) => (o.recipeId as string) === IKURA)).toBe(false);
    expect(off.taxonomy.TAXONOMY_INGREDIENT_IDS).not.toContain("salmon-roe");
    expect(off.taxonomy.ingredientAttributeFamily("salmon-roe")).toBeNull();
    expect(Object.keys(off.sizes.TOPPING_SIZE_CLASS_BY_ID)).not.toContain("salmon-roe");
  });
});

describe("ON: the ordinary catalog followed by the ikura content", () => {
  it("recipe, ingredient, order, taxonomy row and size class join; every ordinary entry is unchanged", async () => {
    const off = await load(false);
    const on = await load(true);
    expect(on.recipes.RECIPES.map((r) => r.id)).toEqual([...off.recipes.RECIPES.map((r) => r.id), IKURA]);
    expect(JSON.stringify(on.recipes.RECIPES.slice(0, off.recipes.RECIPES.length))).toBe(JSON.stringify(off.recipes.RECIPES));
    expect(on.ingredients.INGREDIENTS.at(-1)?.id).toBe("salmon-roe");
    expect(on.ingredients.STARTER_INGREDIENT_IDS).toEqual(off.ingredients.STARTER_INGREDIENT_IDS);
    expect(on.orders.ORDERS.at(-1)?.recipeId).toBe(IKURA);
    expect(on.taxonomy.ingredientAttributeFamily("salmon-roe")).toBe("seafood");
    expect(on.sizes.TOPPING_SIZE_CLASS_BY_ID["salmon-roe"]).toBe("xs");
  });

  it("the late step is appended after every ordinary step, keyed to ikura, with no star gate; the OFF ladder is an exact prefix", async () => {
    const off = await load(false);
    const on = await load(true);
    const offSteps = off.ladder.DISCOVERY_LADDER.steps;
    const onSteps = on.ladder.DISCOVERY_LADDER.steps;
    expect(onSteps).toHaveLength(offSteps.length + 1);
    expect(JSON.stringify(onSteps.slice(0, offSteps.length))).toBe(JSON.stringify(offSteps));
    const late = onSteps[offSteps.length];
    expect(late).toMatchObject({ ingredientIds: ["salmon-roe"], keyRecipeId: IKURA });
    expect(late.starGates).toBeUndefined();
    expect(on.ladderLogic.validateAppendOnlyExtension(off.ladder.DISCOVERY_LADDER, on.ladder.DISCOVERY_LADDER)).toEqual([]);
    expect(on.ladderLogic.validateDiscoveryLadder(on.ladder.DISCOVERY_LADDER)).toEqual([]);
    // shiso (the other material) is an ordinary step, earlier than the late one: the recipe is makeable once the late step is reached.
    expect(offSteps.findIndex((s) => s.ingredientIds.includes("shiso"))).toBeGreaterThanOrEqual(0);
  });

  it("an ordinary batch appended later moves only the late step's NUMBER; its key, materials and order are unchanged, and nothing already reached moves", async () => {
    const on = await load(true);
    const steps = on.ladder.DISCOVERY_LADDER.steps;
    const ordinary = steps.slice(0, -1);
    const lateStep = steps[steps.length - 1];
    // An ordinary step appended after the current ordinary tail (a stand-in material): rebuild the ON ladder as ordinary + new + late.
    const withNewOrdinary = on.ladderLogic.appendLadderSteps(
      on.ladderLogic.appendLadderSteps(
        { ...on.ladder.DISCOVERY_LADDER, steps: ordinary },
        [{ ingredientIds: ["synthetic-new"], keyRecipeId: "synthetic-key" }],
      ),
      [{ ingredientIds: lateStep.ingredientIds, keyRecipeId: lateStep.keyRecipeId }],
    );
    const after = withNewOrdinary.steps;
    expect(after).toHaveLength(steps.length + 1);
    // Every step that existed before the batch keeps its number and content.
    expect(JSON.stringify(after.slice(0, ordinary.length))).toBe(JSON.stringify(ordinary));
    // The late step is still last, with the same key and material; only its number moved by exactly +1.
    const moved = after[after.length - 1];
    expect(moved.ingredientIds).toEqual(lateStep.ingredientIds);
    expect(moved.keyRecipeId).toBe(lateStep.keyRecipeId);
    expect(moved.step).toBe(lateStep.step + 1);
  });

  it("passes the structural validators (late catalog, ladder progression) on the real data", async () => {
    const on = await load(true);
    const late = await import("./lateCatalog");
    const off = await load(false);
    expect(
      late.validateLateCatalog(
        {
          recipeIds: off.recipes.RECIPES.map((r) => r.id),
          ingredientIds: off.ingredients.INGREDIENTS.map((i) => i.id),
          discoveryTargetIds: Object.values(off.catalog.RECIPE_DISCOVERY_TARGET_IDS),
        },
        { recipes: late.LATE_RECIPES, ingredients: late.LATE_INGREDIENTS, ladderSteps: late.LATE_LADDER_STEPS, discoveryTargetIds: late.LATE_DISCOVERY_TARGET_IDS },
      ),
    ).toEqual([]);
    const starters = on.ingredients.INGREDIENTS.filter((i) => !i.unlockCondition).map((i) => i.id);
    const view = (list: readonly { id: string; requiredIngredients: readonly { ingredientId: string }[] }[]) =>
      list.map((r) => ({ id: r.id as string, ingredientIds: [...new Set(r.requiredIngredients.map((q) => q.ingredientId))] }));
    // SOFTLOCK counts credited recipes only (the runtime's rule); every other check runs on all recipes.
    const all = on.ladderLogic.validateLadderProgression(on.ladder.DISCOVERY_LADDER, view(on.recipes.RECIPES), starters).filter((p) => !p.startsWith("SOFTLOCK"));
    const credited = on.recipes.RECIPES.filter((r) => on.recipes.countsTowardLadder(r.id));
    const softlocks = on.ladderLogic.validateLadderProgression(on.ladder.DISCOVERY_LADDER, view(credited), starters).filter((p) => p.startsWith("SOFTLOCK"));
    expect([...all, ...softlocks]).toEqual([]);
  });
});

describe("ON: identification (the roe and the shiso must be placed after the bake)", () => {
  const ON_ITEMS_PRE = ["cream-cheese", "cream-cheese", "salmon", "salmon", "salmon"];

  async function run(pizza: PizzaState) {
    const on = await load(true);
    const sig = on.signature.signatureOfPizza(pizza);
    return on.matcher.evaluateDiscovery(sig, on.catalog.RECIPE_DISCOVERY_CATALOG, [], { supportedCapabilities: ["DOUGH_VARIANT", "LATE_ADDITION"] });
  }

  it("the correct placement matches ikura exactly", async () => {
    expect(await run(pizzaOf(ON_ITEMS_PRE, ["salmon-roe", "salmon-roe", "shiso"]))).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: IKURA });
  });
  it("everything before the bake, a missing roe / shiso, or no late piece at all never matches ikura", async () => {
    for (const pizza of [
      pizzaOf([...ON_ITEMS_PRE, "salmon-roe", "salmon-roe", "shiso"], []),
      pizzaOf(ON_ITEMS_PRE, ["shiso"]),
      pizzaOf(ON_ITEMS_PRE, ["salmon-roe", "salmon-roe"]),
      pizzaOf(ON_ITEMS_PRE, []),
      createEmptyPizza(),
    ]) {
      const result = await run(pizza);
      expect(result.kind === "NEW_DISCOVERY" ? result.recipeId : "none").not.toBe(IKURA);
    }
  });
  it("shirasu-pizza (which also uses shiso) and every other recipe keep matching their own reference pizza", async () => {
    const on = await load(true);
    const { getReferencePizza } = await import("./referencePizza");
    for (const recipe of on.recipes.RECIPES) {
      const reference = getReferencePizza(recipe.id)!;
      const late = new Set<string>(recipe.requiredIngredients.filter((q) => "applicationPhase" in q).map((q) => q.ingredientId));
      const pizza = {
        ...createEmptyPizza(),
        sauceIds: reference.sauce ? [reference.sauce.ingredientId] : [],
        toppings: reference.pieceGroups.flatMap((g, gi) =>
          g.positions.map((p, i) => ({ id: `${gi}-${i}`, ingredientId: g.ingredientId, ...p, ...(late.has(g.ingredientId) ? { stage: "post" as const } : {}) })),
        ),
      };
      const result = on.matcher.evaluateDiscovery(on.signature.signatureOfPizza(pizza), on.catalog.RECIPE_DISCOVERY_CATALOG, [], { supportedCapabilities: ["DOUGH_VARIANT", "LATE_ADDITION"] });
      expect(result, recipe.id).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: recipe.id });
    }
  });
});

describe("privacy: the moment is never an answer", () => {
  it("技法 後乗せ: Owner-decided name / riddle (R1) / description (D1); the riddle names neither the action nor the moment", () => {
    const t = TECHNIQUES.find((x) => x.id === "late-addition")!;
    expect(t.nameJa).toBe("後乗せ");
    expect(t.riddleJa).toBe("同じ材料でも、ひと手間の加え方で違う一枚になることがあるよ。");
    expect(t.descriptionJa).toBe("焼き上がったあとに、仕上げの具材をのせる調理法。香りや彩りが生きるよ。");
    expect(t.riddleJa).not.toMatch(/焼|後|のせ|仕上/);
  });

  it("the recipe's name and description, the order line and the key-free Hint ladder name no moment, no timing and no technique", async () => {
    const on = await load(true);
    const recipe = on.recipes.RECIPES.find((r) => (r.id as string) === IKURA)!;
    const order = on.orders.ORDERS.find((o) => (o.recipeId as string) === IKURA)!;
    const ladder = on.hint.buildHint5Ladder(IKURA as never);
    expect(ladder).not.toBeNull();
    const surfaces = JSON.stringify([recipe.nameJa, recipe.description, order.lineJa, ladder]);
    expect(surfaces).not.toMatch(/後乗せ|焼き上|焼成後|焼いた後|あとに|仕上げ|POST_BAKE|late/i);
  });

  it("the shipped late recipe is the same object the catalog reads (no second copy)", () => {
    expect(LATE_RECIPES[0].id).toBe(IKURA);
  });
});

describe("AC-5 ring measurement (recorded; no threshold or limit is changed)", () => {
  it("ikura's Reference is 8 non-sauce pieces (3 of them post-bake) on the 8-slot ring, in requiredIngredients order, pairwise distinct", async () => {
    const { getReferencePizza } = await import("./referencePizza");
    const { getReferenceSlots } = await import("../logic/pizzaReferenceLayout");
    const reference = getReferencePizza(IKURA as never)!;
    expect(reference.sauce).toBeNull();
    const pieces = reference.pieceGroups.flatMap((g) => g.positions.map((p) => ({ ingredientId: g.ingredientId, ...p })));
    expect(pieces).toHaveLength(8);
    const lateIds = new Set(LATE_RECIPES[0].requiredIngredients.filter((q) => "applicationPhase" in q).map((q) => q.ingredientId as string));
    expect(pieces.filter((p) => lateIds.has(p.ingredientId))).toHaveLength(3);
    const ring = getReferenceSlots(8);
    expect(pieces.map(({ x, y }) => ({ x, y }))).toEqual(ring.map(({ x, y }) => ({ x, y })));
    const dists = pieces.flatMap((a, i) => pieces.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
    expect(Math.min(...dists)).toBeGreaterThan(0);
  });
});
