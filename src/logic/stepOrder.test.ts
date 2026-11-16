import { describe, expect, it } from "vitest";
import { RECIPES } from "../data/recipes";
import { getCookingProfile } from "../data/cookingProfiles";
import {
  STEP_ORDER_FIXTURES,
  StepOrderValidationError,
  projectStepOrderContract,
  resolveStepOrder,
  resolveStepOrderId,
  type StepOrderErrorCode,
} from "./stepOrder";
import type { MakingStep } from "../state/gameReducer";

const codeOf = (run: () => unknown): StepOrderErrorCode | undefined => {
  try {
    run();
  } catch (error) {
    if (error instanceof StepOrderValidationError) return error.code;
    throw error;
  }
  return undefined;
};

describe("STEP_ORDER fixtures", () => {
  it("resolves standard and cheese-before-sauce deterministically", () => {
    expect(resolveStepOrder(STEP_ORDER_FIXTURES.standard.steps, STEP_ORDER_FIXTURES.standard.precedence))
      .toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect(resolveStepOrder(
      STEP_ORDER_FIXTURES["cheese-before-sauce"].steps,
      STEP_ORDER_FIXTURES["cheese-before-sauce"].precedence,
    )).toEqual(["DOUGH", "CHEESE", "SAUCE", "TOPPING"]);
  });

  it("keeps unspecified and standard order byte-for-byte equivalent by value", () => {
    const input = ["DOUGH", "SAUCE", "TOPPING", "FINISH"] as const;
    expect(resolveStepOrderId(undefined, input)).toEqual(input);
    expect(resolveStepOrderId("standard", input)).toEqual(input);
  });

  it.each([
    ["no-sauce", ["DOUGH", "CHEESE", "TOPPING"]],
    ["no-cheese", ["DOUGH", "SAUCE", "TOPPING"]],
    ["no-topping", ["DOUGH", "CHEESE", "SAUCE"]],
  ] as const)("projects cheese-before-sauce for %s", (_name, steps) => {
    const contract = projectStepOrderContract(STEP_ORDER_FIXTURES["cheese-before-sauce"], steps);
    expect(resolveStepOrder(contract.steps, contract.precedence)).toEqual(steps);
  });

  it("projects through multiple omitted intermediate steps", () => {
    const contract = projectStepOrderContract(
      STEP_ORDER_FIXTURES["cheese-before-sauce"],
      ["DOUGH", "TOPPING"],
    );
    expect(resolveStepOrder(contract.steps, contract.precedence)).toEqual(["DOUGH", "TOPPING"]);
  });

  it("preserves non-core steps while moving only CHEESE before SAUCE", () => {
    expect(resolveStepOrderId(
      "cheese-before-sauce",
      ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"],
    )).toEqual(["DOUGH", "CHEESE", "SAUCE", "TOPPING", "FINISH", "CUT"]);
    expect(resolveStepOrderId(
      "cheese-before-sauce",
      ["DOUGH", "FOLD", "SAUCE", "CHEESE", "SEAL", "EDGE_FILL", "CUT"],
    )).toEqual(["DOUGH", "FOLD", "CHEESE", "SAUCE", "SEAL", "EDGE_FILL", "CUT"]);
  });
});

describe("fail-closed validation", () => {
  const core = ["DOUGH", "SAUCE", "CHEESE"] as const;
  it.each([
    ["unknown input", () => resolveStepOrder(["DOUGH", "NOPE"] as unknown as MakingStep[], []), "UNKNOWN_STEP"],
    ["duplicate input", () => resolveStepOrder(["DOUGH", "DOUGH"], []), "DUPLICATE_STEP"],
    ["unknown constraint", () => resolveStepOrder(core, [{ before: "DOUGH", after: "NOPE" as MakingStep }]), "UNKNOWN_CONSTRAINT_STEP"],
    ["missing constraint endpoint", () => resolveStepOrder(["DOUGH"], [{ before: "DOUGH", after: "SAUCE" }]), "MISSING_CONSTRAINT_STEP"],
    ["self edge", () => resolveStepOrder(core, [{ before: "DOUGH", after: "DOUGH" }]), "SELF_EDGE"],
    ["duplicate edge", () => resolveStepOrder(core, [{ before: "DOUGH", after: "SAUCE" }, { before: "DOUGH", after: "SAUCE" }]), "DUPLICATE_EDGE"],
    ["cycle", () => resolveStepOrder(core, [{ before: "DOUGH", after: "SAUCE" }, { before: "SAUCE", after: "CHEESE" }, { before: "CHEESE", after: "DOUGH" }]), "CYCLE"],
    ["ambiguous", () => resolveStepOrder(core, [{ before: "DOUGH", after: "SAUCE" }, { before: "DOUGH", after: "CHEESE" }]), "AMBIGUOUS_ORDER"],
  ] as const)("rejects %s", (_name, run, code) => expect(codeOf(run)).toBe(code));
});

describe("existing catalog compatibility", () => {
  it("leaves every existing CookingProfile.steps sequence unchanged when STEP_ORDER is unspecified", () => {
    for (const recipe of RECIPES) {
      const steps = getCookingProfile(recipe.id).steps;
      expect(resolveStepOrderId(undefined, steps), recipe.id).toEqual(steps);
      expect(resolveStepOrderId("standard", steps), recipe.id).toEqual(steps);
    }
  });

  it("does not read or mutate requiredIngredients", () => {
    for (const recipe of RECIPES) {
      const before = recipe.requiredIngredients.map((requirement) => ({ ...requirement }));
      resolveStepOrderId(undefined, getCookingProfile(recipe.id).steps);
      expect(recipe.requiredIngredients, recipe.id).toEqual(before);
    }
  });
});
