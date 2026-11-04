import { afterEach, describe, expect, it } from "vitest";
import { PREP_EXPERIENCE_PRODUCTION, prepExperienceEnabled } from "../../data/prepExperienceGate";
import { resetPrepPreviewForTest } from "../../preview/prepPreview";
import { gameReducer } from "../../state/gameReducer";
import { normalised, placeBeefAndBake, toStep } from "./prepFixtures";

/**
 * Cooking Prep Phase 1 PR-A: the production switch is OFF, and with it OFF the reducer refuses PREP_INGREDIENT (Owner decision, 2026-10-28), so
 * the state is exactly what it was before this feature existed (AC-1). The real gate module is used here (no mock).
 */
afterEach(() => {
  window.history.replaceState(null, "", "/");
  resetPrepPreviewForTest();
});

const prep = { type: "PREP_INGREDIENT" as const, ingredientId: "beef" };

describe("production flag OFF", () => {
  it("the shipped literal is false", () => {
    expect(PREP_EXPERIENCE_PRODUCTION).toBe(false);
    expect(prepExperienceEnabled()).toBe(false);
  });

  it.each(["GUIDED", "FREE_COOK"] as const)("%s: PREP_INGREDIENT is refused with the same reference", (kind) => {
    const s = toStep(kind, "TOPPING");
    expect(gameReducer(s, prep)).toBe(s);
  });

  it("a plain round is unaffected (no preparedIngredientIds anywhere in the state)", () => {
    const done = placeBeefAndBake(toStep("GUIDED", "TOPPING"), true); // the dispatch is a no-op
    expect("preparedIngredientIds" in done).toBe(false);
    expect(normalised(done)).toStrictEqual(normalised(placeBeefAndBake(toStep("GUIDED", "TOPPING"), false)));
  });

  it("the Preview / DEV opt-in turns it on (this suite runs as DEV), only with ?cookPrep=on", () => {
    window.history.replaceState(null, "", "/?cookPrep=on");
    resetPrepPreviewForTest();
    expect(prepExperienceEnabled()).toBe(true);
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, prep).preparedIngredientIds).toEqual(["beef"]);
  });
});
