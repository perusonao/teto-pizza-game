import "../test/legacyProgression";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { activeProgressionModel } from "../logic/progression/progressionModel";
import { SHOP_MODEL_ACTIVE } from "../logic/progression/shopStatus";

/**
 * B案 Phase 3c (legacy side): with legacy selected the shop model is off, so App and GameScreen pass no research point
 * balance or gain to HOME / RESULT / the hint sheet (they pass `SHOP_MODEL_ACTIVE ? ... : null`), and the reducer earns none
 * (../state/gameReducer.shopResearchPoints3c.legacy.test.ts). The real-browser check is e2e/shop-research-points-3c.spec.ts.
 */
describe("legacy: research points stay hidden", () => {
  it("the legacy model runs and the shop model is not active", () => {
    expect(activeProgressionModel().id).toBe("legacy");
    expect(SHOP_MODEL_ACTIVE).toBe(false);
  });
});
