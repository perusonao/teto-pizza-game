import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { buildIdealSauceFixture } from "../data/referencePizza";
import { TECHNIQUES } from "../data/techniques";
import { deriveResearchEntries } from "../logic/discovery/researchEntry";
import { notebookView } from "../logic/discovery/trialNotebook";
import { hint5SheetView, researchEntryViews } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { NEAR_MISS_FAR_GENERIC_COPY, resultNearMiss } from "./resultNearMiss";
import { discoveredDex } from "./testSupport/guidedRound";

/**
 * Cooking Techniques 1.0 TQ-1D / Contract 2.1 Expansion Gate A (CLOSED, OD-TQ1D-1): Aussie, the one no-sauce recipe,
 * must not be told apart from any other Research Target before its Technique is discovered from a finished pizza.
 * The Research RESULT rows, the Notebook, the Research Entry card, the Hint 5.0 view and the RESULT's near-miss
 * line are all functions of the PLAYER's pizza and the known facts -- never of the target's own sauce -- and none
 * of them ever says "no sauce". The Technique's name is revealed only by `lastTechniqueDiscovery`, which only
 * REGISTER_TO_DEX writes from the finished pizza.
 */

const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const ladderOwned = (step: number) => [...STARTER_INGREDIENT_IDS, ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds)];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
/** Step 12 (the onion): three registered Research Entries (pizza-portuguesa, brazilian-calabresa, aussie). */
function save12(stock = 10): GameState {
  const owned = ladderOwned(12);
  const base = createInitialGameState(discoveredDex(keysBefore(12)), owned, 1000);
  return { ...base, inventory: Object.fromEntries(owned.map((id) => [id, stock])) };
}
const spot = (i: number) => ({ x: 30 + (i % 8) * 5, y: 40 + Math.floor(i / 8) * 8 });
const mk = (sauce: string | null, ...tops: string[]): PizzaState => ({
  ...createEmptyPizza(),
  sauceIds: sauce ? [sauce] : [],
  sauceDeposits: sauce ? buildIdealSauceFixture() : [],
  toppings: tops.map((ingredientId, i) => ({ id: `t${i}`, ingredientId, ...spot(i) })),
});
function finish(s: GameState, pizza: PizzaState, value = 60): GameState {
  let t: GameState = { ...s, pizza: { ...pizza, bakeResult: value } };
  t = act(t, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value });
  for (let i = 0; i < 6 && t.phase !== "RESULT"; i += 1) t = act(t, { type: "CONFIRM_MAKING_STEP" });
  return act(t, { type: "REGISTER_TO_DEX" });
}
const entries = (s: GameState) => deriveResearchEntries(s).entries.map((e) => e.recipeId);
const startOn = (s: GameState, id: string) => act(s, { type: "START_FREE_COOK", researchTargetId: id });

/** Every phrase that would state or hint at the absence of a sauce, or name the Technique. */
const ABSENCE = /ソースなし|ソース不要|ソースを使わ|ソースがない|ソース[:：]\s*なし|sauce-?less|no-sauce|NO_SAUCE|調理法|ぬるもの/i;
const TECHNIQUE_WORDS = TECHNIQUES.flatMap((t) => [t.id, t.nameJa, t.riddleJa]);

describe("Aussie is a Research Entry like any other (onion step 12)", () => {
  it("is registered beside the other two onion recipes, and nobody can tell which is the no-sauce one", () => {
    const s = save12();
    const ids = entries(s);
    expect([...ids].sort()).toEqual(["aussie", "brazilian-calabresa", "pizza-portuguesa"]);
    const views = researchEntryViews(s);
    expect(views).toHaveLength(3);
    for (const v of views) {
      expect(Object.keys(v).sort()).toEqual(Object.keys(views[0]).sort());
      expect(v.knownExactIngredientIds).toEqual(["onion"]); // the same unlock fact for all three
      expect(v.totalIngredientCount).toBeNull();
    }
    expect(JSON.stringify(views)).not.toMatch(ABSENCE);
  });

  it("the Hint 5.0 view of Aussie names no absence, no Technique and no sauce rung (it simply starts at CHEESE)", () => {
    const s = act(startOn(save12(), "aussie"), { type: "SHOW_HINT" });
    expect(s.hintSession?.targetId).toBe("aussie");
    const view = hint5SheetView(s)!;
    expect(view.next).toMatchObject({ rungIndex: 1, kind: "CHEESE" });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toMatch(ABSENCE);
    for (const w of TECHNIQUE_WORDS) expect(serialized).not.toContain(w);
  });
});

describe("Research RESULT and Notebook never depend on the target's own sauce (Gate A)", () => {
  const targets = () => entries(save12());
  const sauceFree = () => mk(null, "mozzarella", "bacon", "egg", "ham");
  const sauced = () => mk("tomato-sauce", "mozzarella", "egg", "onion");
  const shape = (s: GameState) => (s.lastResearchRows?.rows ?? []).map((r) => `${r.category}:${r.ingredientId}`);

  it("a sauce-free pizza has no sauce row for ANY target; the row structure is the same for every target", () => {
    const results = targets().map((t) => ({ t, done: finish(startOn(save12(), t), sauceFree()) }));
    for (const { t, done } of results) {
      expect(done.lastResearchRows, t).not.toBeNull();
      expect(shape(done).filter((r) => r.startsWith("sauce:")), t).toEqual([]);
    }
    expect(new Set(results.map(({ done }) => JSON.stringify(shape(done)))).size).toBe(1);
  });

  it("a sauced pizza always has exactly one sauce row, for every target: an ordinary ○ or ×, never a statement about the target", () => {
    for (const t of targets()) {
      const done = finish(startOn(save12(), t), sauced());
      const sauceRows = (done.lastResearchRows?.rows ?? []).filter((r) => r.category === "sauce");
      expect(sauceRows, t).toHaveLength(1);
      expect(sauceRows[0].verdict, t).toBe(t === "aussie" ? "NEGATIVE" : "POSITIVE");
    }
  });

  it("the rows, the Notebook and the persisted facts never carry an absence or a Technique word, whatever the target and pizza", () => {
    for (const t of targets()) {
      for (const pizza of [sauceFree(), sauced(), mk(null, "onion"), mk("pesto", "bacon", "egg", "onion", "mozzarella")]) {
        const done = finish(startOn(save12(), t), pizza);
        const surfaces = JSON.stringify([done.lastResearchRows, notebookView(done.trialNotebook), done.discoveryHintFacts, researchEntryViews(done)]);
        expect(surfaces, t).not.toMatch(ABSENCE);
        for (const w of TECHNIQUE_WORDS) expect(surfaces, `${t}: ${w}`).not.toContain(w);
      }
    }
  });

  it("what the finished pizza discovers (the Technique) is the same for every target: it is derived from the pizza, not the target", () => {
    const outcomes = targets().map((t) => {
      const done = finish(startOn(save12(), t), sauceFree());
      return { t, ledger: done.discoveredTechniqueIds, shown: done.lastTechniqueDiscovery, kind: done.lastDiscovery?.kind };
    });
    expect(new Set(outcomes.map((o) => JSON.stringify([o.ledger, o.shown, o.kind]))).size).toBe(1);
    // A sauce-free pizza is a no-sauce pizza whichever target is hidden: the reveal is earned by composition.
    expect(outcomes[0].shown).toEqual(["no-sauce"]);
    // And a sauced pizza reveals nothing, for every target.
    for (const t of targets()) {
      const done = finish(startOn(save12(), t), sauced());
      expect(done.lastTechniqueDiscovery, t).toEqual([]);
      expect(done.discoveredTechniqueIds, t).toEqual([]);
    }
  });
});

describe("the RESULT's near-miss line cannot point at the no-sauce recipe (no production near-miss wiring)", () => {
  it("every unmatched pizza gets the one byte-identical line, whether or not it is made of Aussie's pieces", () => {
    const base = save12();
    const aussiePieces = mk("tomato-sauce", "mozzarella", "mozzarella", "bacon", "bacon", "egg", "onion", "onion");
    const unrelated = mk("pesto", "pineapple", "ham");
    const lines = [aussiePieces, unrelated].map((pizza) => {
      const done = finish(act(base, { type: "START_FREE_COOK" }), pizza);
      return resultNearMiss({ ...done, freeCook: true });
    });
    expect(lines.map((l) => l?.textJa)).toEqual([NEAR_MISS_FAR_GENERIC_COPY, NEAR_MISS_FAR_GENERIC_COPY]);
    expect(JSON.stringify(lines)).not.toMatch(/ソース/);
  });
});
