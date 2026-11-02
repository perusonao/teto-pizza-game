import { afterEach, describe, expect, it } from "vitest";
import { PREP_EXPERIENCE_PRODUCTION, prepExperienceEnabled } from "../../data/prepExperienceGate";
import { SEAR_EXPERIENCE_PRODUCTION, searExperienceEnabled } from "../../data/searExperienceGate";
import { resetSearPreviewForTest } from "../../preview/searPreview";
import { gameReducer } from "../../state/gameReducer";
import { normalised, placeSausageAndBake, toStep } from "./searFixtures";

/**
 * Cooking Sear Production ON (#727, after #724 Phase 1): the production switch is pinned ON, and with it ON the reducer accepts SEAR_INGREDIENT with NO query
 * opt-in at all. The real gate module is used (no mock). Rollback = set the literal back to `false`; changing it must be a deliberate edit of this file too.
 * The reducer's refusals (round kind, step, phase, non-target, not owned, once) are pinned in ./searIngredient.reducer.test.ts.
 */
afterEach(() => {
  window.history.replaceState(null, "", "/");
  resetSearPreviewForTest();
});

const sear = { type: "SEAR_INGREDIENT" as const, ingredientId: "sausage", amount: 0.6 };

describe("production flag ON", () => {
  it("the shipped literal is true, and the experience is on with no query and no tab memory", () => {
    window.history.replaceState(null, "", "/");
    window.sessionStorage.clear();
    resetSearPreviewForTest();
    expect(SEAR_EXPERIENCE_PRODUCTION).toBe(true);
    expect(searExperienceEnabled()).toBe(true);
  });
  it("?cookSear=off (the Preview / DEV tab-memory switch) cannot turn the production sear off", () => {
    window.history.replaceState(null, "", "/?cookSear=off");
    resetSearPreviewForTest();
    expect(searExperienceEnabled()).toBe(true);
  });
  it.each(["GUIDED", "FREE_COOK"] as const)("%s: SEAR_INGREDIENT is accepted without any opt-in", (kind) => {
    const s = toStep(kind, "TOPPING");
    expect(gameReducer(s, sear).searedLook).toEqual({ sausage: 0.6 });
  });
  it("a seared round scores, consumes and completes exactly like the plain round (only the display look differs)", () => {
    const plain = placeSausageAndBake(toStep("GUIDED", "TOPPING"), false);
    const seared = placeSausageAndBake(toStep("GUIDED", "TOPPING"), true);
    expect("searedLook" in plain).toBe(false);
    expect("searedLook" in seared).toBe(true);
    expect(normalised(seared)).toStrictEqual(normalised(plain));
  });
  it("the 炒める prep stays OFF in production (this change does not touch it), and the sear does not depend on it", () => {
    window.history.replaceState(null, "", "/");
    window.sessionStorage.clear();
    resetSearPreviewForTest();
    expect(PREP_EXPERIENCE_PRODUCTION).toBe(false);
    expect(prepExperienceEnabled()).toBe(false);
    expect(searExperienceEnabled()).toBe(true);
  });
});
