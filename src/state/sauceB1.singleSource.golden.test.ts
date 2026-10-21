import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import { classifyNearMiss } from "../logic/discovery/nearMiss";
import { signatureOfPizza } from "../logic/discovery/signature";
import { computeScoringV2 } from "../logic/scoringV2";
import { executionAdviceJa } from "./executionAdvice";
import { consumePizzaInventory } from "./inventory";
import {
  commit,
  finishedPizza,
  hashOf,
  otherSauceKind,
  recipeSauceKind,
  RECIPES,
  ringBatch,
  run,
  sauceStepState,
} from "./testSupport/sauceKindFixtures";
import type { GameAction } from "./gameReducer";

/**
 * Sauce B1 (per-kind sauce ledger): the SINGLE-SOURCE Golden pin. This was generated on the logic BEFORE B1 and is the
 * acceptance condition for B1: every one-sauce-kind pizza must still produce byte-identical state, Scoring 2.0,
 * Completion Gate, Research signature (the attempt fingerprint is a pure function of it; the fingerprint module is
 * deliberately not imported here, see attemptFingerprint.gate.test.ts) / near-miss / Free Cooking outcome, advice and inventory
 * consumption. The golden file must never be edited to make B1 pass; a diff means B1 changed single-source behaviour.
 *
 * Keyed by recipe id so a later recipe batch does not touch it: recipes absent from the golden are skipped here (they are
 * covered by the structural properties in the B1 suites); every id in the golden must still exist.
 * Regenerate ONLY on purpose, with UPDATE_SAUCE_B1_GOLDEN=1.
 */
const GOLDEN_PATH = resolve(__dirname, "__golden__/sauceB1.singleSource.json");

/**
 * The inventory the `consume` hash was pinned against: EXACTLY the 58 finite (unlockCondition-bearing) ingredient ids of the
 * catalog this golden was generated on, in `INGREDIENTS` order, each seeded at the fixture's generous 99. Source of the list:
 * `INGREDIENTS.filter((i) => i.unlockCondition)` at commit fca018e1 (the commit that introduced this golden; its parent
 * f780c4e has the identical 61-ingredient catalog -- #498 did not touch src/data/ingredients.ts). The `consume` hash covers the
 * WHOLE inventory after consumption, so it depends on which ingredients exist; deriving the input from the live `INGREDIENTS`
 * made every later ingredient batch (Batch 7a added mint / lamb / sweet-potato) change all 550 pinned hashes. It is an explicit,
 * frozen constant on purpose: a newly added ingredient must NOT extend it, and nothing here is excluded to make a test pass.
 * The consumption LOGIC (`consumePizzaInventory`) is unchanged; consumption of newer materials is covered by
 * `inventory.batch7a.test.ts`. The golden's expected values, scenarios and every other field are untouched.
 */
const PINNED_FINITE_INGREDIENT_IDS: readonly string[] = [
  "olive-oil",
  "pesto",
  "gorgonzola",
  "parmigiano",
  "fontina",
  "garlic",
  "oregano",
  "cherry-tomato",
  "egg",
  "mushroom",
  "onion",
  "sausage",
  "pepperoni",
  "anchovy",
  "tuna",
  "rosemary",
  "bacon",
  "ham",
  "black-olive",
  "capers",
  "clam",
  "corn",
  "eggplant",
  "fresh-tomato",
  "pineapple",
  "potato",
  "chicken",
  "shrimp",
  "parsley",
  "bell-pepper",
  "zucchini",
  "almond",
  "pine-nuts",
  "prosciutto-crudo",
  "green-pepper",
  "cashew-cheese",
  "salami",
  "arugula",
  "grana-padano",
  "cream-cheese",
  "lemon",
  "salmon",
  "salt-cod",
  "baked-beans",
  "palm-heart",
  "sauerkraut",
  "pork",
  "friarielli",
  "catupiry",
  "jalapeno",
  "feta",
  "sardine",
  "ricotta",
  "hot-dog",
  "avocado",
  "goat-cheese",
  "artichoke",
  "spinach",
];
const PINNED_INVENTORY: Record<string, number> = Object.fromEntries(PINNED_FINITE_INGREDIENT_IDS.map((id) => [id, 99]));


type Scenario = { name: string; actions: (own: string, wrong: string) => GameAction[] };
const SCENARIOS: Scenario[] = [
  { name: "none", actions: () => [] },
  { name: "oneStroke", actions: (own) => [commit(own, ringBatch(50, 50, 25, 46))] },
  {
    name: "twoStrokes",
    actions: (own) => [commit(own, ringBatch(50, 50, 25, 20)), commit(own, ringBatch(50, 50, 18, 20))],
  },
  {
    name: "threeStrokes",
    actions: (own) => [
      commit(own, ringBatch(40, 50, 10, 10)),
      commit(own, ringBatch(60, 50, 10, 10)),
      commit(own, ringBatch(50, 40, 10, 10)),
    ],
  },
  { name: "thin", actions: (own) => [commit(own, ringBatch(50, 50, 20, 2))] },
  { name: "overflow", actions: (own) => [commit(own, ringBatch(50, 50, 62, 30))] },
  { name: "wrongSingle", actions: (_own, wrong) => [commit(wrong, ringBatch(50, 50, 25, 40))] },
  { name: "oneShotApply", actions: (own) => [{ type: "APPLY_SAUCE", ingredientId: own, x: 50, y: 50 }] },
  { name: "rejectedInvalid", actions: (own) => [commit(own, [{ x: 50, y: 50, amount: 0 }])] },
  { name: "afterReset", actions: (own) => [commit(own, ringBatch(50, 50, 25, 20)), { type: "RESET_PIZZA" }] },
];

function snapshotOf(recipe: (typeof RECIPES)[number], scenario: Scenario) {
  const own = recipeSauceKind(recipe) ?? "tomato-sauce";
  const wrong = otherSauceKind(own);
  const start = sauceStepState(recipe);
  const end = run(start, scenario.actions(own, wrong));
  const pizza = finishedPizza(recipe, end.pizza);
  const completion = evaluatePizzaCompletion(recipe, pizza);
  const scoring = computeScoringV2(recipe, pizza);
  const signature = signatureOfPizza(pizza);
  const near = classifyNearMiss(signature, RECIPES);
  const free = resolveFreeCookPizza(pizza, start.dex);
  return {
    state: hashOf({
      sauceIds: end.pizza.sauceIds,
      sauceOrigin: end.pizza.sauceOrigin,
      sauceToken: end.pizza.sauceToken,
      sauceDeposits: end.pizza.sauceDeposits,
      hint: end.hint,
      makingStep: end.makingStep,
    }),
    completion: hashOf(completion),
    completionStatus: completion.status,
    scoring: hashOf(scoring),
    totalScore: scoring.available ? scoring.totalScore : null,
    // FIN-E2 (#604): the `late` axis became OBSERVED (its value is `[]` for these pre-FINISH pizzas). The golden was pinned with the axis
    // FIXED_BY_FLOW, so the hash is taken with that one status restored: any other change to the signature still fails here.
    signature: hashOf({ ...signature, dimensions: { ...signature.dimensions, late: { status: "FIXED_BY_FLOW", value: signature.dimensions.late.value } } }),
    near: hashOf(near),
    free: hashOf(free.kind === "FAILED" ? { kind: free.kind, completion: free.completion } : { kind: free.kind }),
    advice: executionAdviceJa(pizza),
    consume: hashOf(consumePizzaInventory(pizza, PINNED_INVENTORY)),
  };
}

function build() {
  const golden: Record<string, Record<string, ReturnType<typeof snapshotOf>>> = {};
  for (const recipe of RECIPES) {
    golden[recipe.id] = {};
    for (const scenario of SCENARIOS) golden[recipe.id][scenario.name] = snapshotOf(recipe, scenario);
  }
  return golden;
}

describe("Sauce B1 single-source Golden (pinned before B1)", () => {
  if (process.env.UPDATE_SAUCE_B1_GOLDEN === "1") {
    it("regenerates the golden (opt-in only)", () => {
      writeFileSync(GOLDEN_PATH, JSON.stringify(build(), null, 1) + "\n");
    });
    return;
  }

  const golden: Record<string, Record<string, unknown>> = existsSync(GOLDEN_PATH)
    ? JSON.parse(readFileSync(GOLDEN_PATH, "utf8"))
    : {};

  it("the golden exists and every pinned recipe still exists", () => {
    expect(Object.keys(golden).length).toBeGreaterThan(0);
    const ids = new Set(RECIPES.map((r) => r.id));
    for (const id of Object.keys(golden)) expect(ids.has(id as never), `recipe ${id} removed`).toBe(true);
  });

  for (const recipe of RECIPES) {
    if (!golden[recipe.id]) continue;
    for (const scenario of SCENARIOS) {
      it(`${recipe.id} / ${scenario.name}: single-source behaviour is unchanged`, () => {
        expect(snapshotOf(recipe, scenario)).toEqual(golden[recipe.id][scenario.name]);
      });
    }
  }
});
