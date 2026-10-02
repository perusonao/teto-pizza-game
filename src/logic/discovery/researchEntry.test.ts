import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES, type Recipe } from "../../data/recipes";
import type { ScoreBreakdown } from "../scoring";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../../state/dex";
import { recipeDiscoveryState } from "../../state/recipeDiscoveryState";
import { INGREDIENT_TOTAL_FACT_ID } from "./deductionHint";
import { deriveResearchEntries, isResearchRegistrable, researchStateOf, type ResearchInputs } from "./researchEntry";

const recipe = (id: string): Recipe => RECIPES.find((r) => r.id === id)!;
const finiteOf = (id: string): string[] =>
  [...new Set(recipe(id).requiredIngredients.map((r) => r.ingredientId))].filter((i) => !!getIngredient(i)?.unlockCondition);
const SCORE: ScoreBreakdown = { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 };
const discover = (...ids: string[]): DexState => ids.reduce((dex, id) => registerScoreToDex(dex, id, SCORE).dex, EMPTY_DEX);
const owned = (...finite: string[]): string[] => [...STARTER_INGREDIENT_IDS, ...finite];
const inputs = (o: readonly string[], extra: Partial<ResearchInputs> = {}): ResearchInputs => ({ dex: EMPTY_DEX, ownedIngredientIds: o, ...extra });
/** The production ladder played in order up to `step` (the keys of earlier steps discovered, every
 *  material up to and including `step` owned in ladder order); `alsoDiscovered` closes branches. */
function ladderPlay(step: number, alsoDiscovered: readonly string[] = []): ResearchInputs {
  const steps = DISCOVERY_LADDER.steps.filter((s) => s.step <= step);
  const keys = ["margherita", ...steps.filter((s) => s.step < step).map((s) => s.keyRecipeId), ...alsoDiscovered];
  return { dex: discover(...keys), ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...steps.flatMap((s) => s.ingredientIds)] };
}
const ids = (i: ResearchInputs, session = {}) => deriveResearchEntries(i, session).entries.map((e) => e.recipeId);

describe("Research Entry registration (ownership based)", () => {
  it("registers once every finite material is owned", () => {
    expect(finiteOf("pesto-pollo").sort()).toEqual(["chicken", "fresh-tomato", "pesto"]);
    expect(ids(inputs(owned("pesto", "fresh-tomato", "chicken")))).toContain("pesto-pollo");
  });

  it("does not register while any finite material is not owned", () => {
    expect(ids(inputs(owned("pesto", "fresh-tomato")))).not.toContain("pesto-pollo");
    expect(isResearchRegistrable(recipe("pesto-pollo"), inputs(owned("pesto", "fresh-tomato")))).toBe(false);
  });

  it("keeps the entry at inventory 0: stock is not an input and ownership never shrinks", () => {
    const i = inputs(owned("pesto", "fresh-tomato", "chicken"));
    expect(ids(i)).toContain("pesto-pollo");
    // availability falls back with stock 0, the research axis does not move
    const zero = { dex: EMPTY_DEX, ownedIngredientIds: i.ownedIngredientIds, unlockedForShopIngredientIds: [], inventory: { pesto: 0, "fresh-tomato": 0, chicken: 0 } };
    expect(recipeDiscoveryState(recipe("pesto-pollo"), zero)).toBe("KNOWN_BUT_MISSING_MATERIAL");
    expect(researchStateOf(recipe("pesto-pollo"), i)).toBe("PROVISIONAL");
  });

  it("excludes DISCOVERED recipes", () => {
    const i = inputs(owned("pesto", "fresh-tomato", "chicken"), { dex: discover("pesto-pollo") });
    expect(ids(i)).not.toContain("pesto-pollo");
    expect(researchStateOf(recipe("pesto-pollo"), i)).toBe("DISCOVERED");
  });

  it("never registers a starter-only recipe or an unowned start", () => {
    expect(ids(inputs(owned()))).not.toContain("margherita");
    expect(deriveResearchEntries(inputs(owned())).entries).toEqual([]);
  });

  it("orthogonality: registered entries are never availability UNKNOWN, and DISCOVERABLE implies registrable", () => {
    const all = RECIPES.flatMap((r) => finiteOf(r.id));
    const o = owned(...new Set(all));
    for (const r of RECIPES) {
      const avail = recipeDiscoveryState(r, { dex: EMPTY_DEX, ownedIngredientIds: o, unlockedForShopIngredientIds: [], inventory: Object.fromEntries(all.map((a) => [a, 5])) });
      const state = researchStateOf(r, inputs(o));
      if (state === "PROVISIONAL" || state === "RESEARCHING") expect(["DISCOVERABLE", "KNOWN_BUT_MISSING_MATERIAL"]).toContain(avail);
      if (avail === "DISCOVERABLE" && finiteOf(r.id).length > 0) expect(state).toBe("PROVISIONAL");
    }
  });
});

describe("unlock exact fact (no attempt input)", () => {
  it("is the finite ingredient acquired last, and always a recipe ingredient", () => {
    const e = deriveResearchEntries(inputs(owned("pesto", "fresh-tomato", "chicken"))).entries.find((x) => x.recipeId === "pesto-pollo")!;
    expect(e.unlockIngredientId).toBe("chicken");
    expect(e.knownExactIngredientIds).toEqual(["chicken"]);
    const e2 = deriveResearchEntries(inputs(owned("chicken", "pesto", "fresh-tomato"))).entries.find((x) => x.recipeId === "pesto-pollo")!;
    expect(e2.unlockIngredientId).toBe("fresh-tomato");
    for (const r of RECIPES) {
      for (const entry of deriveResearchEntries(inputs(owned(...new Set(RECIPES.flatMap((x) => finiteOf(x.id)))))).entries) {
        expect(recipe(entry.recipeId).requiredIngredients.map((q) => q.ingredientId)).toContain(entry.unlockIngredientId);
      }
      void r;
    }
  });

  it("never names a starter as the fact", () => {
    for (const e of deriveResearchEntries(inputs(owned(...new Set(RECIPES.flatMap((x) => finiteOf(x.id)))))).entries) {
      expect(STARTER_INGREDIENT_IDS).not.toContain(e.unlockIngredientId);
    }
  });

  it("is derived with no hint ledger and no attempt data", () => {
    const e = deriveResearchEntries({ ...ladderPlay(25), discoveryHintFacts: undefined }).entries.find((x) => x.recipeId === "pesto-pollo")!;
    expect(e.knownExactIngredientIds).toEqual(["chicken"]);
  });
});

describe("STRUCTURE privacy", () => {
  it("reads the same stored fact id as the Deduction Hint layer", () => {
    const e = deriveResearchEntries(inputs(owned("pesto", "fresh-tomato", "chicken"), { discoveryHintFacts: { "pesto-pollo": [INGREDIENT_TOTAL_FACT_ID] } }));
    expect(e.entries.find((x) => x.recipeId === "pesto-pollo")!.totalIngredientCount).toBe(4);
    expect(INGREDIENT_TOTAL_FACT_ID).toBe("meta:ingredient-total");
  });

  const o = owned("pesto", "fresh-tomato", "chicken");
  const entry = (facts?: Record<string, string[]>) =>
    deriveResearchEntries(inputs(o, { discoveryHintFacts: facts })).entries.find((e) => e.recipeId === "pesto-pollo")!;

  it("withholds the total until STRUCTURE is bought", () => {
    expect(entry().totalIngredientCount).toBeNull();
    expect(entry({ "pesto-pollo": ["ing:pesto", "h5:sauce"] }).totalIngredientCount).toBeNull();
    expect(entry({ "other-recipe": [INGREDIENT_TOTAL_FACT_ID] }).totalIngredientCount).toBeNull();
  });

  it("projects the distinct total only after STRUCTURE", () => {
    expect(entry({ "pesto-pollo": [INGREDIENT_TOTAL_FACT_ID, "h5:structure"] }).totalIngredientCount).toBe(4);
  });

  it("does not expose remaining counts or unknown slots at any stage", () => {
    for (const facts of [undefined, { "pesto-pollo": [INGREDIENT_TOTAL_FACT_ID] }]) {
      const keys = Object.keys(entry(facts)).sort();
      expect(keys).toEqual(["knownExactIngredientIds", "recipeId", "state", "totalIngredientCount", "unlockIngredientId"]);
      expect(JSON.stringify(entry(facts))).not.toMatch(/remaining|slot|unknown|candidate|percent|name/i);
    }
  });
});

describe("public projection shape", () => {
  const multi = deriveResearchEntries(inputs(owned("ham", "egg", "black-olive", "sausage", "oregano", "onion")));

  it("is an entries array only: no hidden/unregistered/remaining counts", () => {
    expect(Object.keys(multi)).toEqual(["entries"]);
    expect(JSON.stringify(multi)).not.toMatch(/count"?:\s*\d|hidden|remaining|unregistered|pool/i);
  });

  it("carries no recipe name, No.xx or catalog position", () => {
    for (const e of multi.entries) {
      expect(Object.keys(e)).not.toContain("name");
      expect(Object.keys(e)).not.toContain("no");
      expect(Object.keys(e)).not.toContain("index");
    }
  });
});

describe("single entry: pesto-pollo + chicken (ladder step 25)", () => {
  const play = () => ladderPlay(25, ["brazilian-calabresa"]);

  it("lone entry: chicken is the known fact; RESEARCHING once targeted or a fact is bought", () => {
    const entries = deriveResearchEntries(play()).entries;
    expect(entries.map((e) => e.recipeId)).toEqual(["pesto-pollo"]);
    expect(entries[0].state).toBe("PROVISIONAL");
    expect(entries[0].unlockIngredientId).toBe("chicken");
    expect(deriveResearchEntries(play(), { targetRecipeId: "pesto-pollo" }).entries[0].state).toBe("RESEARCHING");
    expect(deriveResearchEntries({ ...play(), discoveryHintFacts: { "pesto-pollo": ["ing:pesto"] } }).entries[0].state).toBe("RESEARCHING");
  });

  it("a target that is not an entry changes nothing", () => {
    expect(deriveResearchEntries(play(), { targetRecipeId: "margherita" }).entries[0].state).toBe("PROVISIONAL");
  });
});

describe("multiple entries: Step 12 onion", () => {
  const play = () => ladderPlay(12);

  it("registers pizza-portuguesa and brazilian-calabresa together, both with the onion fact", () => {
    const entries = deriveResearchEntries(play()).entries;
    expect(entries.map((e) => e.recipeId).sort()).toEqual(["brazilian-calabresa", "pizza-portuguesa"]);
    for (const e of entries) {
      expect(e.unlockIngredientId).toBe("onion");
      expect(e.knownExactIngredientIds).toEqual(["onion"]);
    }
  });

  it("does not register before the onion is owned", () => {
    const before = ladderPlay(12);
    const without = { ...before, ownedIngredientIds: before.ownedIngredientIds.filter((i) => i !== "onion") };
    expect(ids(without)).toEqual([]);
  });

  it("discovering one leaves the other; a discovered recipe never re-enters", () => {
    const i = { ...play(), dex: discover("margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < 12).map((s) => s.keyRecipeId), "brazilian-calabresa") };
    expect(ids(i)).toEqual(["pizza-portuguesa"]);
  });

  it("targeting one leaves the other PROVISIONAL (target only changes the CTA word)", () => {
    const entries = deriveResearchEntries(play(), { targetRecipeId: "pizza-portuguesa" }).entries;
    expect(Object.fromEntries(entries.map((e) => [e.recipeId, e.state]))).toEqual({ "pizza-portuguesa": "RESEARCHING", "brazilian-calabresa": "PROVISIONAL" });
  });
});

describe("stable anonymous ordering", () => {
  it("is deterministic and independent of catalog order", () => {
    const a = deriveResearchEntries(ladderPlay(12)).entries.map((e) => e.recipeId);
    const b = deriveResearchEntries(ladderPlay(12), {}, [...RECIPES].reverse()).entries.map((e) => e.recipeId);
    expect(b).toEqual(a);
    expect(deriveResearchEntries(ladderPlay(12)).entries.map((e) => e.recipeId)).toEqual(a);
  });

  it("orders by registration (unlock acquisition index) first", () => {
    const entries = deriveResearchEntries(ladderPlay(25)).entries;
    expect(entries.map((e) => e.recipeId)).toEqual(["brazilian-calabresa", "pesto-pollo"]);
  });

  it("ties are not ordered by ingredient count or catalog position", () => {
    const a = recipe("pizza-portuguesa");
    const b = recipe("brazilian-calabresa");
    expect(a.requiredIngredients.length).not.toBe(b.requiredIngredients.length);
    const order = deriveResearchEntries(ladderPlay(12)).entries.map((e) => e.recipeId);
    // Whatever the opaque tie-break chose, it must equal the order for any permutation of the input.
    for (const recipes of [[a, b], [b, a]]) {
      expect(deriveResearchEntries(ladderPlay(12), {}, recipes).entries.map((e) => e.recipeId)).toEqual(order);
    }
  });
});
