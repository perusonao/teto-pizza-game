import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { RECIPES } from "../../data/recipes";
import type { DexEntry, DexState } from "../../state/dex";
import type { RecipeDiscoveryTarget } from "../discovery/matcher";
import { DEFAULT_IDENTITY_DIMENSIONS } from "../discovery/signature";
import { DOUGH_TECHNIQUE_ID } from "./detection";
import { doughChipOtherLabel, isDoughAffordanceOpen, isDoughSwitchVisible } from "./doughSwitch";
import { isTrayAffordanceOpen } from "./panSwitch";
import { techniqueAffordanceStep } from "./registration";
import { productionTechniqueContext, techniqueRoundEligibility, type TechniqueRuntimeContext } from "./runtime";

/** Dough Kind P2 (#577): when the DOUGH step may offer the dough-kind chips. Synthetic Pinsa target only -- Production has none (P3 on HOLD). */
const dexOf = (n: number): DexState =>
  RECIPES.filter((r) => !("ladderCredit" in r))
    .slice(0, n)
    .map((r): DexEntry => ({ recipeId: r.id, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
const SYN_PINSA: RecipeDiscoveryTarget = {
  targetId: "syn:pinsa",
  recipeId: "syn-pinsa" as RecipeDiscoveryTarget["recipeId"],
  items: ["arugula", "mozzarella", "prosciutto-crudo", "tomato-sauce"],
  sauceBase: ["tomato-sauce"],
  capabilities: ["DOUGH_VARIANT"],
  identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, dough: "material-multigrain-long-ferment" },
  eligibility: { status: "ELIGIBLE" },
};
const CONTEXT: TechniqueRuntimeContext = { ...productionTechniqueContext(), catalog: [...RECIPE_DISCOVERY_CATALOG, SYN_PINSA] };
const STEP = techniqueAffordanceStep(DOUGH_TECHNIQUE_ID, CONTEXT.catalog, CONTEXT.materialStep)!;

describe("isDoughAffordanceOpen", () => {
  it("is closed for every Dex in Production: no catalog target requires the dough technique (INV-TQ-4)", () => {
    for (let n = 0; n <= RECIPES.length; n++) expect(isDoughAffordanceOpen(dexOf(n)), `credited ${n}`).toBe(false);
  });

  it("with a Pinsa target it opens at the derived step and stays open", () => {
    expect(STEP).toBeGreaterThan(0);
    expect(isDoughAffordanceOpen(dexOf(STEP - 1), CONTEXT)).toBe(false);
    expect(isDoughAffordanceOpen(dexOf(STEP), CONTEXT)).toBe(true);
    expect(isDoughAffordanceOpen(dexOf(STEP + 3), CONTEXT)).toBe(true);
  });

  it("is independent of the tray's affordance (neither opens the other)", () => {
    expect(isTrayAffordanceOpen(dexOf(STEP), CONTEXT)).toBe(false);
    expect(isDoughAffordanceOpen(dexOf(STEP), CONTEXT)).toBe(true);
  });
});

describe("isDoughSwitchVisible: PREPARE x DOUGH x Free Cooking / Research x the affordance", () => {
  const ok = { phase: "PREPARE", makingStep: "DOUGH", eligibility: "FREE_COOK", affordanceOpen: true } as const;
  it("shows only when all four hold", () => {
    expect(isDoughSwitchVisible(ok)).toBe(true);
    expect(isDoughSwitchVisible({ ...ok, affordanceOpen: false })).toBe(false);
    expect(isDoughSwitchVisible({ ...ok, makingStep: "SAUCE" })).toBe(false);
    expect(isDoughSwitchVisible({ ...ok, phase: "BAKE" })).toBe(false);
    for (const eligibility of ["FREE_GUIDED", "NONE"] as const) expect(isDoughSwitchVisible({ ...ok, eligibility })).toBe(false);
  });

  it("Guided / Lunch Rush / Dinner rounds never get it (eligibility from the round kind)", () => {
    expect(techniqueRoundEligibility({ isMissionRound: false, isDinnerRound: false, freeCook: true })).toBe("FREE_COOK");
    expect(isDoughSwitchVisible({ ...ok, eligibility: techniqueRoundEligibility({ isMissionRound: false, isDinnerRound: false, freeCook: false }) })).toBe(false);
    expect(isDoughSwitchVisible({ ...ok, eligibility: techniqueRoundEligibility({ isMissionRound: true, isDinnerRound: false, freeCook: true }) })).toBe(false);
    expect(isDoughSwitchVisible({ ...ok, eligibility: techniqueRoundEligibility({ isMissionRound: false, isDinnerRound: true, freeCook: true }) })).toBe(false);
  });
});

describe("doughChipOtherLabel (Owner, 2026-10-20)", () => {
  it("is the neutral label until the technique is in the ledger, then the technique's name -- selection never matters", () => {
    expect(doughChipOtherLabel([], "ほかの生地")).toBe("ほかの生地");
    expect(doughChipOtherLabel(["no-sauce", "tray"], "ほかの生地")).toBe("ほかの生地");
    expect(doughChipOtherLabel([DOUGH_TECHNIQUE_ID], "ほかの生地")).toBe("ピンサ生地");
    expect(doughChipOtherLabel(["no-sauce", DOUGH_TECHNIQUE_ID], "ほかの生地")).toBe("ピンサ生地");
  });
});
