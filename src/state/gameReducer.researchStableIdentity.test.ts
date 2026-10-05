import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { notebookView } from "../logic/discovery/trialNotebook";
import { researchAttemptContext, researchEntryViews, researchResultView, researchTargetView } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { discoveredDex } from "./testSupport/guidedRound";

/**
 * Research 2.0 Phase 1 (OD-R2-1..5) through the real reducer: the one label authority is shared by the RESULT, the
 * PREPARE / Hint context and the Notebook, and a sibling's discovery moves none of them. Production data: ladder
 * step 12 = aussie (A) / brazilian-calabresa (B) / pizza-portuguesa (C), all unlock = たまねぎ.
 */
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
function step12(): GameState {
  const owned = ladderOwned(12);
  const base = createInitialGameState(discoveredDex(keysBefore(12)), owned, 1000);
  return { ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) };
}
const LABEL = { A: "？？？ピザ A（たまねぎ）", B: "？？？ピザ B（たまねぎ）", C: "？？？ピザ C（たまねぎ）" } as const;
const ID = { A: "aussie", B: "brazilian-calabresa", C: "pizza-portuguesa" } as const;

const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
const spot = (i: number) => ({ x: 30 + (i % 8) * 5, y: 40 + Math.floor(i / 8) * 8 });
const mk = (sauce: string | null, ...tops: string[]): PizzaState => ({
  ...createEmptyPizza(),
  sauceIds: sauce ? [sauce] : [],
  toppings: tops.map((ingredientId, i) => ({ id: `t${i}`, ingredientId, ...spot(i) })),
});
function toResult(s: GameState, pizza: PizzaState, value: number): GameState {
  let t: GameState = { ...s, pizza: { ...pizza, bakeResult: value } };
  t = act(t, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value });
  for (let i = 0; i < 6 && t.phase !== "RESULT"; i += 1) t = act(t, { type: "CONFIRM_MAKING_STEP" });
  return t;
}
const finish = (s: GameState, pizza: PizzaState, v = 68) => act(toResult(s, pizza, v), { type: "REGISTER_TO_DEX" });
const exact = (id: string): PizzaState => {
  const r = RECIPES.find((x) => x.id === id)!;
  return mk(
    r.requiredIngredients.find((q) => isSauce(q.ingredientId))?.ingredientId ?? null,
    ...r.requiredIngredients.filter((q) => !isSauce(q.ingredientId)).flatMap((q) => Array.from({ length: Math.max(1, q.minCount) }, () => q.ingredientId)),
  );
};
const mid = (id: string) => {
  const r = RECIPES.find((x) => x.id === id)!;
  return (r.bakeTarget.start + r.bakeTarget.end) / 2;
};
const research = (s: GameState, id: string) => act(s, { type: "START_FREE_COOK", researchTargetId: id });
/** Tomato + ham: an ORIGINAL for any of the three. */
const probe = () => mk("tomato-sauce", "ham");
const labelsOf = (s: GameState) => Object.fromEntries(researchEntryViews(s).map((v) => [v.recipeId, v.label]));

describe("one label authority across PREPARE, RESULT and the Notebook", () => {
  it("every surface reads the same stable label", () => {
    const started = research(step12(), ID.B);
    expect(researchTargetView(started)?.label).toBe(LABEL.B);
    expect(researchAttemptContext(started)?.labelJa).toBe(LABEL.B);
    const done = finish(started, probe());
    expect(researchResultView(done)?.label).toBe(LABEL.B);
    expect(done.lastResearchRows?.labelJa).toBe(LABEL.B);
    expect(notebookView(done.trialNotebook)[0].feedback?.textJa.startsWith(`${LABEL.B} `)).toBe(true);
  });
});

describe("step 12 end to end: B is discovered first", () => {
  it("A and C keep their letters, the earlier Notebook B line stays B and aliases no current entry", () => {
    // 1. researches B and C (a probe each): two Notebook lines, one per label.
    let s = finish(research(step12(), ID.B), probe());
    s = finish(research(s, ID.C), mk("tomato-sauce", "ham", "egg"));
    const lines = notebookView(s.trialNotebook).map((r) => r.feedback?.textJa ?? "");
    expect(lines.filter((t) => t.startsWith(LABEL.B))).toHaveLength(1);
    expect(lines.filter((t) => t.startsWith(LABEL.C))).toHaveLength(1);
    expect(labelsOf(s)).toEqual({ [ID.A]: LABEL.A, [ID.B]: LABEL.B, [ID.C]: LABEL.C });

    // 2. B is discovered (the exact recipe, a NEW_DISCOVERY).
    const found = finish(research(s, ID.B), exact(ID.B), mid(ID.B));
    expect(found.lastDiscovery?.kind).toBe("NEW_DISCOVERY");
    expect(labelsOf(found)).toEqual({ [ID.A]: LABEL.A, [ID.C]: LABEL.C });

    // 3. The stored B line is unchanged and no current entry carries the label B any more.
    const after = notebookView(found.trialNotebook).map((r) => r.feedback?.textJa ?? "");
    expect(after.filter((t) => t.startsWith(LABEL.B))).toEqual(lines.filter((t) => t.startsWith(LABEL.B)));
    expect(Object.values(labelsOf(found))).not.toContain(LABEL.B);

    // 4. Researching C afterwards still says C (it did not slide up to B).
    const next = research(found, ID.C);
    expect(researchTargetView(next)?.label).toBe(LABEL.C);
    expect(researchAttemptContext(next)?.labelJa).toBe(LABEL.C);
  });

  it("discovering A (the lowest letter) first leaves B and C as B and C", () => {
    const found = finish(research(step12(), ID.A), exact(ID.A), mid(ID.A));
    expect(found.lastDiscovery?.kind).toBe("NEW_DISCOVERY");
    expect(labelsOf(found)).toEqual({ [ID.B]: LABEL.B, [ID.C]: LABEL.C });
  });
});
