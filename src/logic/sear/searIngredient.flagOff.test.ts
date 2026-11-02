import { afterEach, describe, expect, it } from "vitest";
import { SEAR_EXPERIENCE_PRODUCTION, searExperienceEnabled } from "../../data/searExperienceGate";
import { resetSearPreviewForTest } from "../../preview/searPreview";
import { gameReducer } from "../../state/gameReducer";
import { normalised, placeSausageAndBake, toStep } from "./searFixtures";

/** Cooking Sear Phase 1 (#724): the production switch is OFF, and with it OFF the reducer refuses SEAR_INGREDIENT. The real gate module is used (no mock). */
afterEach(() => {
  window.history.replaceState(null, "", "/");
  resetSearPreviewForTest();
});

const sear = { type: "SEAR_INGREDIENT" as const, ingredientId: "sausage", amount: 0.6 };

describe("production flag OFF", () => {
  it("the shipped literal is false", () => {
    expect(SEAR_EXPERIENCE_PRODUCTION).toBe(false);
    expect(searExperienceEnabled()).toBe(false);
  });
  it.each(["GUIDED", "FREE_COOK"] as const)("%s: SEAR_INGREDIENT is refused with the same reference", (kind) => {
    const s = toStep(kind, "TOPPING");
    expect(gameReducer(s, sear)).toBe(s);
  });
  it("a plain round is unaffected (no searedLook anywhere in the state)", () => {
    const done = placeSausageAndBake(toStep("GUIDED", "TOPPING"), true); // the dispatch is a no-op
    expect("searedLook" in done).toBe(false);
    expect(normalised(done)).toStrictEqual(normalised(placeSausageAndBake(toStep("GUIDED", "TOPPING"), false)));
  });
  it("?cookPrep=on (the 炒める prep opt-in) does NOT turn the sear on", () => {
    window.history.replaceState(null, "", "/?cookPrep=on");
    resetSearPreviewForTest();
    expect(searExperienceEnabled()).toBe(false);
  });
  it("the Preview / DEV opt-in turns it on (this suite runs as DEV), only with ?cookSear=on", () => {
    window.history.replaceState(null, "", "/?cookSear=on");
    resetSearPreviewForTest();
    expect(searExperienceEnabled()).toBe(true);
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, sear).searedLook).toEqual({ sausage: 0.6 });
  });
});
