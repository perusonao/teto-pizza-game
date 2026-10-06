import { describe, expect, it } from "vitest";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { RECIPES } from "../../data/recipes";
import { discoveredDex } from "../../state/testSupport/guidedRound";
import { deriveResearchBoards, researchBoardOf, type ResearchBoard, type ResearchBoardInputs } from "./researchBoard";
import { deriveResearchEntries, researchEntryLabel } from "./researchEntry";
import { hint5ClassFactId, HINT5_RUNG_MARKER } from "./hint5Ladder";
import { hintFactId } from "./selectableHint";
import { INGREDIENT_TOTAL_FACT_ID } from "./deductionHint";

/**
 * Research 2.0 Phase 2 S1: the Research Board read model. Production data: ladder step 25 = one Research Entry,
 * pesto-pollo (pesto, mozzarella, fresh-tomato, chicken; unlock fact = chicken); step 12 = three siblings.
 */
const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const T = "pesto-pollo";
const single = (extra: Partial<ResearchBoardInputs> = {}): ResearchBoardInputs => ({
  dex: discoveredDex([...keysBefore(25), "brazilian-calabresa", "aussie"]),
  ownedIngredientIds: ladderOwned(25),
  ...extra,
});
const multi = (extra: Partial<ResearchBoardInputs> = {}): ResearchBoardInputs => ({
  dex: discoveredDex(keysBefore(12)),
  ownedIngredientIds: ladderOwned(12),
  ...extra,
});
const board = (inputs: ResearchBoardInputs, id = T): ResearchBoard => researchBoardOf(inputs, id)!;
const flat = (b: ResearchBoard) => b.groups.flatMap((g) => g.rows.map((r) => `${g.category}:${r.ingredientId}:${r.mark}`));

describe("Board content: ✓ known, ✗ disclosed NEGATIVE, △ purchased class / total", () => {
  it("a fresh entry shows the unlock fact as ✓ and nothing else", () => {
    const b = board(single());
    expect(flat(b)).toEqual(["topping:chicken:KNOWN"]);
    expect(b.classes).toEqual([]);
    expect(b.totalIngredientCount).toBeNull();
    expect(b.labelJa).toBe("？？？ピザ（チキン）");
  });
  it("stored ing: facts join ✓; stored exclusions are ✗; groups are sauce -> cheese -> topping, ✓ before ✗", () => {
    const b = board(single({ discoveryHintFacts: { [T]: ["ing:pesto", "ing:mozzarella", "ing:fresh-tomato"] }, researchExclusions: { [T]: ["egg", "tomato-sauce", "cheddar"] } }));
    expect(flat(b)).toEqual([
      "sauce:pesto:KNOWN",
      "sauce:tomato-sauce:EXCLUDED",
      "cheese:mozzarella:KNOWN",
      "cheese:cheddar:EXCLUDED",
      "topping:chicken:KNOWN",
      "topping:fresh-tomato:KNOWN",
      "topping:egg:EXCLUDED",
    ].filter((r) => getIngredient(r.split(":")[1]) !== undefined));
  });
  it("△ appears only for bought cls: facts after STRUCTURE, as the existing family display; the total only when bought", () => {
    const facts = { [T]: [HINT5_RUNG_MARKER.STRUCTURE, hint5ClassFactId("fresh-tomato"), INGREDIENT_TOTAL_FACT_ID] };
    const b = board(single({ discoveryHintFacts: facts }));
    expect(b.classes).toEqual([{ familyId: "vegetable", symbol: "\u{1F96C}", labelJa: "野菜・きのこ系" }]);
    expect(b.totalIngredientCount).toBe(4);
    // a cls: fact without the STRUCTURE marker is not shown; an ing: fact for the same ingredient moves it to ✓
    expect(board(single({ discoveryHintFacts: { [T]: [hint5ClassFactId("fresh-tomato")] } })).classes).toEqual([]);
    const known = board(single({ discoveryHintFacts: { [T]: [HINT5_RUNG_MARKER.STRUCTURE, hintFactId("fresh-tomato"), hint5ClassFactId("fresh-tomato")] } }));
    expect(known.classes).toEqual([]);
    expect(flat(known)).toContain("topping:fresh-tomato:KNOWN");
  });
  it("the local grammar copies equal their owners", () => {
    expect(hintFactId("egg")).toBe("ing:egg");
    expect(hint5ClassFactId("egg")).toBe("cls:egg");
    expect(HINT5_RUNG_MARKER.STRUCTURE).toBe("h5:structure");
    expect(INGREDIENT_TOTAL_FACT_ID).toBe("meta:ingredient-total");
  });
  it("a Board exists only for a registered Research Entry (discovered / unregistered recipes: null)", () => {
    expect(researchBoardOf(single(), "margherita")).toBeNull();
    expect(researchBoardOf(single(), "unknown-recipe")).toBeNull();
    expect(researchBoardOf(single(), null)).toBeNull();
    expect(deriveResearchBoards({ dex: discoveredDex([]), ownedIngredientIds: [...STARTER_INGREDIENT_IDS] })).toEqual([]);
    const discovered = single({ researchExclusions: { [T]: ["egg"] } });
    const after = { ...discovered, dex: discoveredDex([...keysBefore(25), "brazilian-calabresa", "aussie", T]) };
    expect(researchBoardOf(after, T)).toBeNull();
  });
  it("cohort siblings keep their letter; each Board uses the shared label authority", () => {
    const inputs = multi();
    const boards = deriveResearchBoards(inputs);
    const entries = deriveResearchEntries(inputs).entries;
    expect(boards.map((b) => b.recipeId)).toEqual(entries.map((e) => e.recipeId));
    expect(boards.map((b) => b.labelJa)).toEqual(entries.map(researchEntryLabel));
    expect(boards.map((b) => b.labelJa).every((l) => /^？？？ピザ [A-C]（たまねぎ）$/.test(l))).toBe(true);
  });
  it("a ledger of one entry never appears on a sibling's Board", () => {
    const inputs = multi();
    const [first, second] = deriveResearchBoards(inputs);
    const members = new Set<string>(deriveResearchBoards(inputs).flatMap((b) => RECIPES.find((r) => r.id === b.recipeId)!.requiredIngredients.map((q) => q.ingredientId)));
    const outsider = INGREDIENTS.find((i) => i.category === "topping" && !members.has(i.id))!.id;
    const withLedger = { ...inputs, researchExclusions: { [first.recipeId]: [outsider] } };
    const boards = deriveResearchBoards(withLedger);
    expect(flat(boards[0])).toContain(`topping:${outsider}:EXCLUDED`);
    expect(flat(boards[1])).not.toContain(`topping:${outsider}:EXCLUDED`);
    expect(second.recipeId).toBe(boards[1].recipeId);
  });
});

describe("stale exclusions are dropped silently (the ledger is not rewritten)", () => {
  it("a member of the current recipe, an unknown ingredient, a duplicate and a known ✓ are not shown", () => {
    const inputs = single({ researchExclusions: { [T]: ["pesto", "future-ingredient", "egg", "egg", "chicken", "Bad Id", 7 as never] } });
    const frozen = JSON.stringify(inputs);
    expect(flat(board(inputs))).toEqual(["topping:chicken:KNOWN", "topping:egg:EXCLUDED"]);
    expect(JSON.stringify(inputs)).toBe(frozen);
  });
  it("a ledger of an unknown or discovered recipe is ignored", () => {
    expect(deriveResearchBoards(single({ researchExclusions: { "future-recipe": ["egg"], margherita: ["egg"] } })).map(flat)).toEqual([["topping:chicken:KNOWN"]]);
  });
  it("an inherited prototype key is never read as a ledger", () => {
    expect(flat(board(single({ researchExclusions: Object.create({ [T]: ["egg"] }) })))).toEqual(["topping:chicken:KNOWN"]);
  });
});

describe("privacy: only disclosed information, nothing the contract forbids (INV-B3 / B4 / B7, OD-R1-4)", () => {
  const rich = single({
    discoveryHintFacts: { [T]: ["ing:pesto", HINT5_RUNG_MARKER.STRUCTURE, hint5ClassFactId("fresh-tomato"), INGREDIENT_TOTAL_FACT_ID] },
    researchExclusions: { [T]: ["egg", "onion"] },
  });
  const json = JSON.stringify(deriveResearchBoards(rich));
  it("the output has exactly the Board fields: no count, trial, Technique, candidate, hash or recipe fields", () => {
    const b = board(rich);
    expect(Object.keys(b).sort()).toEqual(["classes", "groups", "labelJa", "recipeId", "totalIngredientCount"]);
    for (const g of b.groups) {
      expect(Object.keys(g).sort()).toEqual(["category", "rows"]);
      for (const r of g.rows) expect(Object.keys(r).sort()).toEqual(["ingredientId", "mark"]);
    }
    expect(json).not.toMatch(/trial|technique|remaining|candidate|hash|recipeName|nameJa|number|attempt|last/i);
  });
  it("no recipe name / No.xx appears anywhere in the output", () => {
    const recipe = RECIPES.find((r) => r.id === T)!;
    expect(json).not.toContain(recipe.nameJa);
    expect(json).not.toMatch(/No\.\s*\d|№/);
  });
  it("no category-level conclusion or absence wording is representable or produced", () => {
    expect(json).not.toMatch(/なし|すべて|全部|未確認|除外|ゼロ|0件|none|all|empty/i);
  });
  it("a heading exists only with a row: an empty Board has no group, and a category with no row has no group", () => {
    const sauceFree = board(single({ researchExclusions: { [T]: ["egg"] } }));
    expect(sauceFree.groups.map((g) => g.category)).toEqual(["topping"]);
    for (const b of deriveResearchBoards({ ...multi(), researchExclusions: {} })) for (const g of b.groups) expect(g.rows.length).toBeGreaterThan(0);
  });
  it("no ✗ is generated for an ingredient the ledger does not hold (nothing is inferred)", () => {
    const b = board(single());
    expect(flat(b).filter((r) => r.endsWith("EXCLUDED"))).toEqual([]);
  });
  it("the NO_SAUCE target (aussie) shows only the sauces the player really got ✗ -- never a 'no sauce' statement", () => {
    const owned = ladderOwned(12);
    const inputs: ResearchBoardInputs = { dex: discoveredDex(keysBefore(12)), ownedIngredientIds: owned };
    const aussie = deriveResearchBoards(inputs).find((b) => b.recipeId === "aussie")!;
    expect(aussie.groups.map((g) => g.category)).toEqual(["topping"]);
    const tried = researchBoardOf({ ...inputs, researchExclusions: { aussie: ["tomato-sauce"] } }, "aussie")!;
    expect(flat(tried)).toContain("sauce:tomato-sauce:EXCLUDED");
    expect(JSON.stringify(tried)).not.toMatch(/ソース|sauce.*(none|なし)/);
  });
  it("is deterministic and does not mutate its inputs", () => {
    const inputs = rich;
    const before = JSON.stringify(inputs);
    expect(JSON.stringify(deriveResearchBoards(inputs))).toBe(json);
    expect(JSON.stringify(inputs)).toBe(before);
  });
});
