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

/**
 * FINISH D2-0 (Issue #294): the pure selection / render-class / hint helpers exist, but nothing in Production turns
 * FINISH on. These pin that across every shipped recipe and round kind, and that no Production file consumes the new
 * helpers yet (D2-1+ will, with its own Human Verification).
 */
const PHASES: readonly GamePhase[] = ["ORDER", "PREPARE", "BAKE", "POST_BAKE", "RESULT", "DISCOVERED"];
const STEPS: readonly MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL", "EDGE_FILL", "CUT", "FINISH"];
const ALL_IDS = INGREDIENTS.map((i) => i.id);

describe("FINISH stays inert in Production (D2-0)", () => {
  it("no RECIPES entry gets FINISH in Guided, Lunch Rush or Dinner, and the selector never offers it", () => {
    for (const mode of ROUND_MODES) {
      for (const recipe of RECIPES) {
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

  it("the Free Cooking round (incl. Research) has no FINISH, runs no FINISH, and the selector never offers it", () => {
    const free = gameReducer(createInitialGameState(EMPTY_DEX, ALL_IDS, 0, {}), { type: "START_FREE_COOK" });
    expect(free.cookingProfile.steps).not.toContain("FINISH");
    expect(roundRunsFinish(free)).toBe(false);
    expect(finishStepAvailable(free, free.cookingProfile.steps)).toBe(false);
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

  it("only PizzaStage consumes pieceBakeClass (D2-1); nothing consumes the other D2-0 helpers yet", () => {
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
    // D2-1 (Issue #294): PizzaStage draws post-bake pieces apart from the pre-bake path. Every other helper stays unused until D2-2.
    expect(users).toEqual(["components/PizzaStage.tsx -> pieceBakeClass"]);
  });
});
