import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { RECIPES } from "../data/recipes";
import { getCookingProfile, visibleCookingTabCount, MAX_VISIBLE_COOKING_TABS } from "../data/cookingProfiles";
import { INGREDIENTS } from "../data/ingredients";
import { EMPTY_DEX } from "./dex";
import { roundRunsFinish } from "./finishEngine";
import { createInitialGameState, gameReducer, type GamePhase, type MakingStep } from "./gameReducer";
import { finishStepAvailable, renderedPostBakeStep, selectPostBakeStep } from "../screens/postBakeView";
import { atBake, ROUND_MODES } from "./testSupport/confirmBakeMatrix";
import { ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";
import { FREE_COOK_FINISH_PRODUCTION } from "../data/freeCookFinishGate";

/**
 * FINISH D2-0 (Issue #294): the pure selection / render-class / hint helpers exist, but nothing in Production turns
 * FINISH on. These pin that across every shipped recipe and round kind, and that no Production file consumes the new
 * helpers yet (D2-1+ will, with its own Human Verification).
 */
const PHASES: readonly GamePhase[] = ["ORDER", "PREPARE", "BAKE", "POST_BAKE", "RESULT", "DISCOVERED"];
const STEPS: readonly MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL", "EDGE_FILL", "CUT", "FINISH"];
const ALL_IDS = INGREDIENTS.map((i) => i.id);

describe("FINISH stays inert in Production (D2-0)", () => {
  it("no ordinary RECIPES entry gets FINISH in Guided, Lunch Rush or Dinner, and the selector never offers it", () => {
    // E5: the late recipe (ikura) is the one that has FINISH in Guided; it is pinned in lateCatalog.ikura.test.ts / gameReducer.finishFlow.test.ts.
    // E5: a Free Cooking round runs FINISH (UD-B, gate ON); that is the next test and gameReducer.finishFreeCook.test.ts.
    for (const mode of ROUND_MODES.filter((m) => m !== "free")) {
      for (const recipe of ordinaryRecipes(RECIPES)) {
        const state = atBake(mode, recipe.id);
        const label = `${mode}/${recipe.id}`;
        expect(state.cookingProfile.steps, label).not.toContain("FINISH");
        expect(finishStepAvailable(state, state.cookingProfile.steps), label).toBe(false);
        for (const phase of PHASES) {
          for (const step of STEPS) {
            expect(selectPostBakeStep(phase, step, finishStepAvailable(state, state.cookingProfile.steps)), `${label} ${phase}/${step}`).toBe(
              renderedPostBakeStep(phase, step),
            );
          }
        }
      }
    }
  });

  it("the Free Cooking round (incl. Research) has the FINISH step exactly when the Free Cooking FINISH gate is on (E5: Production ON)", () => {
    const free = gameReducer(createInitialGameState(EMPTY_DEX, ALL_IDS, 0, {}), { type: "START_FREE_COOK" });
    const on = FREE_COOK_FINISH_PRODUCTION;
    expect(free.cookingProfile.steps.includes("FINISH")).toBe(on);
    expect(roundRunsFinish(free)).toBe(on);
    expect(finishStepAvailable(free, free.cookingProfile.steps)).toBe(on);
  });

  it("Lunch Rush and Dinner rounds never run FINISH even when a profile carries it", () => {
    for (const mode of ["lunchRush", "dinner"] as const) {
      const state = atBake(mode, RECIPES[0].id);
      expect(roundRunsFinish(state), mode).toBe(false);
      expect(finishStepAvailable(state, [...state.cookingProfile.steps, "FINISH"]), mode).toBe(false);
    }
  });

  it("every shipped profile keeps the 6-tab ceiling untouched", () => {
    expect(MAX_VISIBLE_COOKING_TABS).toBe(6);
    for (const recipe of RECIPES) expect(visibleCookingTabCount(getCookingProfile(recipe.id)), recipe.id).toBeLessThanOrEqual(6);
  });

  it("only PizzaStage consumes pieceBakeClass (D2-1) and only GameScreen consumes the FINISH view helpers (FIN-A)", () => {
    const helpers = ["pieceBakeClass", "finishHint", "selectPostBakeStep", "finishStepAvailable"];
    const root = join(__dirname, "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(path);
      }
    };
    walk(root);
    const users: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const name of helpers) {
        const defining = file.endsWith(`${name}.ts`) || (name === "selectPostBakeStep" || name === "finishStepAvailable" ? file.endsWith("postBakeView.ts") : false);
        if (!defining && text.includes(name)) users.push(`${relative(root, file)} -> ${name}`);
      }
    }
    // D2-1 (Issue #294): PizzaStage draws post-bake pieces apart from the pre-bake path. FIN-A: GameScreen selects the FINISH view
    // (`selectPostBakeStep` / `finishStepAvailable`) and shows its hint (`finishHint`) -- both are false/absent for every shipped
    // profile and round kind (the tests above). FIN-B: SHOW_HINT answers with the same hint line, only in a FINISH step
    // (`roundRunsFinish`). Nothing else consumes them.
    expect(users).toEqual([
      "components/PizzaStage.tsx -> pieceBakeClass",
      "screens/GameScreen.tsx -> finishHint",
      "screens/GameScreen.tsx -> selectPostBakeStep",
      "screens/GameScreen.tsx -> finishStepAvailable",
      "state/gameReducer.ts -> finishHint",
    ]);
  });
});
