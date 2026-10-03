import { describe, expect, it } from "vitest";
import { getIngredient } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import { knownIngredientIdsFromFacts, RESEARCH_TOPPING_CAP, researchResultRows } from "./researchResultRows";

/** Anti-Oracle Contract 2.1 S1: the pure RESULT-row rule. Targets are real Production recipes. */
const MEAT = "meat-lovers"; // tomato-sauce, mozzarella, bacon, ham, pepperoni, sausage
const CAPRI = "capricciosa"; // tomato-sauce, mozzarella, mushroom, oregano, ham, black-olive

const t = (ingredientId: string, i = 0) => ({ id: `p${i}-${ingredientId}`, ingredientId, x: 40 + i, y: 40 + i });
const pizza = (sauceIds: string[], placed: string[]) => ({ sauceIds, toppings: placed.map((id, i) => t(id, i)) });
const run = (targetRecipeId: string, p: object, knownIngredientIds: string[] = []) =>
  researchResultRows({ targetRecipeId, pizza: p, knownIngredientIds });
const view = (r: ReturnType<typeof run>) => r.rows.map((x) => `${x.category}:${x.ingredientId}:${x.verdict}`);

describe("sauce", () => {
  it("positive: the target's sauce is judged POSITIVE", () => {
    expect(view(run(MEAT, pizza(["tomato-sauce"], [])))).toEqual(["sauce:tomato-sauce:POSITIVE"]);
  });
  it("negative: another sauce is judged NEGATIVE", () => {
    expect(view(run(MEAT, pizza(["pesto"], [])))).toEqual(["sauce:pesto:NEGATIVE"]);
  });
});

describe("cheese", () => {
  it("positive and negative cheeses are all judged (no cap)", () => {
    const r = run(MEAT, pizza([], ["mozzarella", "gorgonzola", "parmigiano", "fontina"]));
    expect(view(r)).toEqual([
      "cheese:mozzarella:POSITIVE",
      "cheese:gorgonzola:NEGATIVE",
      "cheese:parmigiano:NEGATIVE",
      "cheese:fontina:NEGATIVE",
    ]);
    expect(r.toppingOverCap).toBe(false);
  });
});

describe("topping cap (K = 3)", () => {
  it("K is 3", () => expect(RESEARCH_TOPPING_CAP).toBe(3));
  it("one unknown topping is judged", () => {
    expect(view(run(MEAT, pizza([], ["ham"])))).toEqual(["topping:ham:POSITIVE"]);
  });
  it("three unknown toppings are all judged, positive and negative", () => {
    const r = run(MEAT, pizza([], ["ham", "egg", "pepperoni"]));
    expect(view(r)).toEqual(["topping:ham:POSITIVE", "topping:egg:NEGATIVE", "topping:pepperoni:POSITIVE"]);
    expect(r.toppingOverCap).toBe(false);
  });
  it("four unknown toppings: no individual topping row and the over-cap state", () => {
    const r = run(MEAT, pizza(["tomato-sauce"], ["mozzarella", "ham", "egg", "pepperoni", "bacon"]));
    expect(r.toppingOverCap).toBe(true);
    expect(r.rows.filter((x) => x.category === "topping")).toEqual([]);
    // sauce / cheese rows are unaffected by the topping cap
    expect(view(r)).toEqual(["sauce:tomato-sauce:POSITIVE", "cheese:mozzarella:POSITIVE"]);
    expect(r.persistFactIds).toEqual(["ing:tomato-sauce", "ing:mozzarella"]);
  });
  it("the same topping placed many times counts once", () => {
    const r = run(MEAT, pizza([], ["ham", "ham", "ham", "egg", "egg", "pepperoni", "ham"]));
    expect(r.toppingOverCap).toBe(false);
    expect(view(r)).toEqual(["topping:ham:POSITIVE", "topping:egg:NEGATIVE", "topping:pepperoni:POSITIVE"]);
  });
});

describe("known check-marked ingredients", () => {
  it("a known topping is not a row", () => {
    const r = run(MEAT, pizza([], ["ham", "egg"]), ["ham"]);
    expect(view(r)).toEqual(["topping:egg:NEGATIVE"]);
  });
  it("known toppings do not count toward K: known 2 + unknown 3 -> all 3 judged", () => {
    const r = run(MEAT, pizza([], ["ham", "bacon", "egg", "onion", "pepperoni"]), ["ham", "bacon"]);
    expect(r.toppingOverCap).toBe(false);
    expect(view(r)).toEqual(["topping:egg:NEGATIVE", "topping:onion:NEGATIVE", "topping:pepperoni:POSITIVE"]);
  });
  it("known 2 + unknown 4 -> over-cap, zero individual topping rows", () => {
    const r = run(MEAT, pizza([], ["ham", "bacon", "egg", "onion", "pepperoni", "sausage"]), ["ham", "bacon"]);
    expect(r.toppingOverCap).toBe(true);
    expect(r.rows).toEqual([]);
    expect(r.persistFactIds).toEqual([]);
  });
  it("a known sauce / cheese is not a row either, and is never a persistence candidate", () => {
    const r = run(MEAT, pizza(["tomato-sauce"], ["mozzarella", "ham"]), ["tomato-sauce", "mozzarella"]);
    expect(view(r)).toEqual(["topping:ham:POSITIVE"]);
    expect(r.persistFactIds).toEqual(["ing:ham"]);
  });
  it("an all-known pizza yields nothing", () => {
    const r = run(MEAT, pizza(["tomato-sauce"], ["ham"]), ["tomato-sauce", "ham"]);
    expect(r).toEqual({ rows: [], toppingOverCap: false, persistFactIds: [] });
  });
  it("known ids are read from `ing:` facts only", () => {
    expect(knownIngredientIdsFromFacts(["ing:ham", "ing:ham", "cls:meat", "meta:ingredient-total", 3, undefined])).toEqual(["ham"]);
    expect(knownIngredientIdsFromFacts(undefined)).toEqual([]);
  });
});

describe("order", () => {
  it("categories are sauce -> cheese -> topping whatever the placement order", () => {
    const r = run(MEAT, pizza(["tomato-sauce"], ["ham", "mozzarella", "egg"]));
    expect(view(r)).toEqual([
      "sauce:tomato-sauce:POSITIVE",
      "cheese:mozzarella:POSITIVE",
      "topping:ham:POSITIVE",
      "topping:egg:NEGATIVE",
    ]);
  });
  it("within a category the player's placement order is kept: not id order, catalog order or recipe order", () => {
    const placed = ["sausage", "bacon", "ham"]; // recipe order is bacon, ham, pepperoni, sausage; ids sort bacon < ham < sausage
    expect(view(run(MEAT, pizza([], placed)))).toEqual(["topping:sausage:POSITIVE", "topping:bacon:POSITIVE", "topping:ham:POSITIVE"]);
    const reversed = [...placed].reverse();
    expect(view(run(MEAT, pizza([], reversed)))).toEqual(["topping:ham:POSITIVE", "topping:bacon:POSITIVE", "topping:sausage:POSITIVE"]);
    const cheeses = ["fontina", "mozzarella", "gorgonzola"]; // catalog order is mozzarella, gorgonzola, ..., fontina
    expect(view(run(MEAT, pizza([], cheeses))).map((s) => s.split(":")[1])).toEqual(cheeses);
  });
});

describe("persistence candidates", () => {
  it("are the positive rows only, as ing:<id>, in row order", () => {
    const r = run(MEAT, pizza(["tomato-sauce"], ["mozzarella", "gorgonzola", "ham", "egg"]));
    expect(r.persistFactIds).toEqual(["ing:tomato-sauce", "ing:mozzarella", "ing:ham"]);
  });
  it("a negative is never a persistence candidate", () => {
    const r = run(MEAT, pizza(["pesto"], ["gorgonzola", "egg"]));
    expect(view(r).every((v) => v.endsWith("NEGATIVE"))).toBe(true);
    expect(r.persistFactIds).toEqual([]);
  });
  it("every persisted id is a disclosed positive row (disclosure = persist)", () => {
    const r = run(CAPRI, pizza(["tomato-sauce"], ["mozzarella", "mushroom", "ham", "egg", "pepperoni"]));
    const disclosedPositive = r.rows.filter((x) => x.verdict === "POSITIVE").map((x) => `ing:${x.ingredientId}`);
    expect(r.persistFactIds).toEqual(disclosedPositive);
  });
});

describe("Anti-Oracle shape", () => {
  const FORBIDDEN = /count|total|distance|similar|missing|remaining|candidate|correct|score|near|far|recipe|target|name|rate|ratio|percent/i;
  it("exposes only rows / toppingOverCap / persistFactIds, with no counting or identity field", () => {
    const r = run(CAPRI, pizza(["tomato-sauce"], ["mozzarella", "mushroom", "egg"]));
    expect(Object.keys(r).sort()).toEqual(["persistFactIds", "rows", "toppingOverCap"]);
    for (const row of r.rows) expect(Object.keys(row).sort()).toEqual(["category", "ingredientId", "verdict"]);
    for (const key of [...Object.keys(r), ...r.rows.flatMap((x) => Object.keys(x))]) expect(key).not.toMatch(FORBIDDEN);
  });
  it("does not leak the target: identical pizzas give structurally identical output shape for any target", () => {
    const p = pizza(["tomato-sauce"], ["mozzarella", "ham"]);
    expect(JSON.stringify(run(MEAT, p))).not.toContain(MEAT);
    expect(JSON.stringify(run(CAPRI, p))).not.toContain(CAPRI);
  });
  it("the over-cap state depends only on the player's own pizza and known set, never on the target", () => {
    const p = pizza([], ["ham", "egg", "onion", "pepperoni"]);
    for (const r of RECIPES) expect(run(r.id, p).toppingOverCap).toBe(true);
    const q = pizza([], ["ham", "egg", "onion"]);
    for (const r of RECIPES) expect(run(r.id, q).toppingOverCap).toBe(false);
  });
});

describe("independence from cooking / matcher quality (INV-D6)", () => {
  it("accepts no outcome, matcher or quality input; extra keys cannot change the result", () => {
    const p = pizza(["tomato-sauce"], ["mozzarella", "ham", "egg"]);
    const base = run(MEAT, p);
    for (const outcomeKind of ["ORIGINAL", "AMBIGUOUS", "INCOMPLETE_MATCH"]) {
      const withExtras = researchResultRows({
        targetRecipeId: MEAT,
        pizza: p,
        knownIngredientIds: [],
        ...({ outcomeKind, stars: 1, bakeQuality: "OVERBAKED", matcher: { kind: outcomeKind } } as object),
      });
      expect(withExtras).toEqual(base);
    }
  });
  it("amounts (piece counts), positions and doneness-like fields do not change membership", () => {
    const thin = { sauceIds: ["tomato-sauce"], toppings: [t("ham", 0)], bakeProgress: 0.1 };
    const heavy = { sauceIds: ["tomato-sauce"], toppings: [t("ham", 0), t("ham", 1), t("ham", 2), { ...t("ham", 3), x: 1, y: 99 }], bakeProgress: 99 };
    expect(run(MEAT, thin)).toEqual(run(MEAT, heavy));
  });
  it("is pure and repeatable and does not mutate its input", () => {
    const p = pizza(["tomato-sauce"], ["ham", "egg"]);
    const known = ["bacon"];
    const snap = JSON.stringify([p, known]);
    expect(run(MEAT, p, known)).toEqual(run(MEAT, p, known));
    expect(JSON.stringify([p, known])).toBe(snap);
  });
});

describe("robustness (fail closed)", () => {
  it("malformed pizza containers, unknown ingredient ids and an unknown target never throw", () => {
    expect(run(MEAT, { sauceIds: null, toppings: "x" })).toEqual({ rows: [], toppingOverCap: false, persistFactIds: [] });
    expect(view(run(MEAT, { sauceIds: [1, "tomato-sauce"], toppings: [null, { ingredientId: 3 }, t("no-such-ingredient"), t("ham")] }))).toEqual([
      "sauce:tomato-sauce:POSITIVE",
      "topping:ham:POSITIVE",
    ]);
    // an unknown target has no members: every judged row is NEGATIVE, nothing is persisted
    const r = run("no-such-recipe", pizza(["tomato-sauce"], ["ham"]));
    expect(r.persistFactIds).toEqual([]);
  });
});

describe("Production constraints (Contract §3 / §10 / §13.1)", () => {
  const sauceCount = (id: string) =>
    RECIPES.find((r) => r.id === id)!.requiredIngredients.filter((q) => getIngredient(q.ingredientId)?.category === "sauce").length;

  it("Production fixture: every one of the 27 recipes uses exactly one sauce (no multi-sauce, no no-sauce target)", () => {
    expect(RECIPES).toHaveLength(27);
    for (const r of RECIPES) expect(sauceCount(r.id), r.id).toBe(1);
  });
  it("there is no reserved / no-sauce target in the current Production 27: a sauce row is always possible", () => {
    const noSauce = RECIPES.filter((r) => sauceCount(r.id) === 0).map((r) => r.id);
    expect(noSauce).toEqual([]);
  });
  it("a one-sauce pizza (the reducer replaces sauceIds with one element) yields exactly one sauce row for every target", () => {
    for (const r of RECIPES) {
      const sauceRows = run(r.id, pizza(["tomato-sauce"], [])).rows.filter((x) => x.category === "sauce");
      expect(sauceRows, r.id).toHaveLength(1);
    }
  });
  it("membership agrees with requiredIngredients for every ingredient of every recipe", () => {
    for (const r of RECIPES) {
      for (const q of r.requiredIngredients) {
        const category = getIngredient(q.ingredientId)!.category;
        const p = category === "sauce" ? pizza([q.ingredientId], []) : pizza([], [q.ingredientId]);
        const rows = run(r.id, p).rows;
        expect(rows, `${r.id}/${q.ingredientId}`).toEqual([{ ingredientId: q.ingredientId, category, verdict: "POSITIVE" }]);
      }
    }
  });
});
