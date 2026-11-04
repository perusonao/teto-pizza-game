import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { searExperienceEnabled } from "../../data/searExperienceGate";
import { STEAM_EXPERIENCE_PRODUCTION, steamExperienceEnabled } from "../../data/steamExperienceGate";
import { resetSearPreviewForTest } from "../../preview/searPreview";
import { resetSteamPreviewForTest } from "../../preview/steamPreview";
import { gameReducer } from "../../state/gameReducer";
import { normalised, placeAndBake, toStep } from "./steamFixtures";

/**
 * Cooking Steam Phase 1 (#726, S2): the production switch is OFF (the shipped default), and with it OFF the reducer refuses STEAM_INGREDIENT. The real gate module
 * is used (no mock). Switching the literal ON is a separate, explicit Owner approval and must edit this file on purpose.
 */
const clean = () => {
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
  resetSteamPreviewForTest();
  resetSearPreviewForTest();
};
beforeEach(clean);
afterEach(clean);

const steam = { type: "STEAM_INGREDIENT" as const, ingredientId: "clam", amount: 0.6 };

describe("production flag OFF", () => {
  it("the shipped literal is false, and with no query nothing is on", () => {
    expect(STEAM_EXPERIENCE_PRODUCTION).toBe(false);
    expect(steamExperienceEnabled()).toBe(false);
  });
  it.each(["GUIDED", "FREE_COOK"] as const)("%s: STEAM_INGREDIENT is refused with the same reference (clam and mussel)", (kind) => {
    const s = toStep(kind, "TOPPING");
    expect(gameReducer(s, steam)).toBe(s);
    expect(gameReducer(s, { ...steam, ingredientId: "mussel" })).toBe(s);
  });
  it("a round that tries to steam is exactly a plain round (no steamedLook anywhere in the state)", () => {
    const tried = placeAndBake(toStep("GUIDED", "TOPPING"), "clam", true); // the dispatch is a no-op
    expect("steamedLook" in tried).toBe(false);
    expect(normalised(tried)).toStrictEqual(normalised(placeAndBake(toStep("GUIDED", "TOPPING"), "clam", false)));
  });
  it("the sear's production switch and opt-in do not turn the steam on", () => {
    expect(searExperienceEnabled()).toBe(true); // the sear is ON in production (#727)
    expect(steamExperienceEnabled()).toBe(false);
    window.history.replaceState(null, "", "/?cookSear=on&cookPrep=on");
    resetSteamPreviewForTest();
    expect(steamExperienceEnabled()).toBe(false);
  });
  it("the Preview / DEV opt-in turns it on (this suite runs as DEV), only with ?cookSteam=on", () => {
    window.history.replaceState(null, "", "/?cookSteam=on");
    resetSteamPreviewForTest();
    expect(steamExperienceEnabled()).toBe(true);
    const s = toStep("GUIDED", "TOPPING");
    expect(gameReducer(s, steam).steamedLook).toEqual({ clam: 0.6 });
  });
  it("?cookSteam=off and an odd value keep it off", () => {
    for (const q of ["?cookSteam=off", "?cookSteam=1", "?cookSteam=on&cookSteam=on"]) {
      clean();
      window.history.replaceState(null, "", `/${q}`);
      resetSteamPreviewForTest();
      expect(steamExperienceEnabled(), q).toBe(false);
    }
  });
});
