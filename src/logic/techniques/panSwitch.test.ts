import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import type { DexEntry, DexState } from "../../state/dex";
import { ingredientUnlockStep } from "../../state/materialEntitlement";
import type { GamePhase, MakingStep } from "../../state/gameReducer";
import type { RecipeDiscoveryTarget } from "../discovery/matcher";
import { DEFAULT_IDENTITY_DIMENSIONS } from "../discovery/signature";
import { W1_ORDER } from "../testSupport/branchingFixture";
import { techniqueAffordanceStep } from "./registration";
import { productionTechniqueContext, techniqueRoundEligibility, type TechniqueRoundEligibility, type TechniqueRuntimeContext } from "./runtime";
import { isPanSwitchVisible, isTrayAffordanceOpen } from "./panSwitch";

/** Square Dough F4-a: when the DOUGH step may offer the ○/□ switch. Synthetic tray target only -- no production recipe needs the tray (INV-TQ-4). */
const dexOf = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));

const SYN_TRAY: RecipeDiscoveryTarget = {
  targetId: "syn:tray-pizza",
  recipeId: "syn-tray" as RecipeDiscoveryTarget["recipeId"],
  items: ["garlic", "mozzarella", "olive-oil", "tomato-sauce"],
  sauceBase: ["olive-oil", "tomato-sauce"],
  capabilities: [],
  identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, pan: "tray" },
  eligibility: { status: "ELIGIBLE" },
};
const TRAY_CONTEXT: TechniqueRuntimeContext = { ...productionTechniqueContext(), catalog: [...RECIPE_DISCOVERY_CATALOG, SYN_TRAY] };
const STEP = techniqueAffordanceStep("tray", TRAY_CONTEXT.catalog, TRAY_CONTEXT.materialStep)!;

describe("isTrayAffordanceOpen", () => {
  it("is closed for every Dex when no catalog target requires the tray (INV-TQ-4)", () => {
    const NO_TRAY: TechniqueRuntimeContext = { ...productionTechniqueContext(), catalog: RECIPE_DISCOVERY_CATALOG.filter((t) => t.recipeId !== "grandma-pizza") };
    for (let n = 0; n <= W1_ORDER.length; n++) expect(isTrayAffordanceOpen(dexOf(W1_ORDER.slice(0, n)), NO_TRAY)).toBe(false);
  });

  it("in Production the one requiring target is grandma-pizza (Square Dough E-2): the affordance opens at the step DERIVED from its materials, never earlier", () => {
    const production = productionTechniqueContext();
    const step = techniqueAffordanceStep("tray", production.catalog, production.materialStep)!;
    const grandma = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === "grandma-pizza")!;
    expect(step).toBe(Math.max(...grandma.items.map((id) => ingredientUnlockStep(id) ?? Infinity)));
    expect(isTrayAffordanceOpen(dexOf(W1_ORDER.slice(0, step - 1)))).toBe(false);
    expect(isTrayAffordanceOpen(dexOf(W1_ORDER.slice(0, step)))).toBe(true);
  });

  it("opens at the derived step of a requiring target, not at a number written here", () => {
    expect(STEP).toBe(Math.max(...SYN_TRAY.items.map((id) => ingredientUnlockStep(id) ?? Infinity)));
    expect(isTrayAffordanceOpen(dexOf(W1_ORDER.slice(0, STEP - 1)), TRAY_CONTEXT)).toBe(false);
    expect(isTrayAffordanceOpen(dexOf(W1_ORDER.slice(0, STEP)), TRAY_CONTEXT)).toBe(true);
  });

  it("moves with materialStep (the step is derived)", () => {
    const later: TechniqueRuntimeContext = { ...TRAY_CONTEXT, materialStep: (id) => (id === "garlic" ? STEP + 3 : TRAY_CONTEXT.materialStep(id)) };
    expect(isTrayAffordanceOpen(dexOf(W1_ORDER.slice(0, STEP)), later)).toBe(false);
    expect(isTrayAffordanceOpen(dexOf(W1_ORDER.slice(0, STEP + 3)), later)).toBe(true);
  });

  it("counts only ladder-credited recipes (OD-TQ1D-2)", () => {
    const dex = dexOf(W1_ORDER.slice(0, STEP));
    const uncredited: TechniqueRuntimeContext = { ...TRAY_CONTEXT, countsTowardLadder: () => false };
    expect(isTrayAffordanceOpen(dex, TRAY_CONTEXT)).toBe(true);
    expect(isTrayAffordanceOpen(dex, uncredited)).toBe(false);
  });
});

describe("isPanSwitchVisible", () => {
  const ELIGIBILITIES: TechniqueRoundEligibility[] = ["FREE_COOK", "FREE_GUIDED", "NONE"];
  const PHASES: GamePhase[] = ["ORDER", "PREPARE", "BAKE", "POST_BAKE", "RESULT", "DISCOVERED"];
  const STEPS: MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL", "EDGE_FILL", "CUT", "FINISH"];

  it("is visible only in a free-cook round's DOUGH step with the affordance open (full truth table)", () => {
    for (const eligibility of ELIGIBILITIES)
      for (const phase of PHASES)
        for (const makingStep of STEPS)
          for (const affordanceOpen of [false, true]) {
            const expected = eligibility === "FREE_COOK" && phase === "PREPARE" && makingStep === "DOUGH" && affordanceOpen;
            expect(isPanSwitchVisible({ phase, makingStep, eligibility, affordanceOpen }), `${eligibility}/${phase}/${makingStep}/${affordanceOpen}`).toBe(expected);
          }
  });

  it("is hidden before the affordance opens (Technique not unlocked)", () => {
    expect(isPanSwitchVisible({ phase: "PREPARE", makingStep: "DOUGH", eligibility: "FREE_COOK", affordanceOpen: false })).toBe(false);
  });

  it.each([
    ["guided Recipe Select", { isMissionRound: false, isDinnerRound: false, freeCook: false }],
    ["Lunch Rush", { isMissionRound: true, isDinnerRound: false, freeCook: false }],
    ["Dinner", { isMissionRound: false, isDinnerRound: true, freeCook: false }],
  ])("is hidden in %s even with the affordance open", (_name, round) => {
    const eligibility = techniqueRoundEligibility(round);
    expect(isPanSwitchVisible({ phase: "PREPARE", makingStep: "DOUGH", eligibility, affordanceOpen: true })).toBe(false);
  });

  it("is shown in Free Cooking / Research (freeCook) once open", () => {
    const eligibility = techniqueRoundEligibility({ isMissionRound: false, isDinnerRound: false, freeCook: true });
    expect(isPanSwitchVisible({ phase: "PREPARE", makingStep: "DOUGH", eligibility, affordanceOpen: true })).toBe(true);
  });
});

describe("Anti-Oracle: the switch never reads a Research target, a hint or a match", () => {
  const sources = import.meta.glob<string>(["./panSwitch.ts", "../pan/effectivePan.ts"], { query: "?raw", import: "default", eager: true });
  it("panSwitch.ts / effectivePan.ts import no Research, hint, matcher or discovery-target module", () => {
    expect(Object.keys(sources)).toHaveLength(2);
    for (const [path, source] of Object.entries(sources)) {
      const imports = source.split("\n").filter((l) => /^\s*(import|export) .* from /.test(l)).join("\n");
      expect(imports, path).not.toMatch(/research|hint|matcher|discovery\/|deduction/i);
    }
  });
});
