import { afterEach, describe, expect, it } from "vitest";
import {
  TOPPING_SCALE_PARAM,
  TOPPING_SCALE_PREVIEW_MARK,
  activeToppingRankScale,
  getPreviewToppingScaleCandidate,
  resetPreviewToppingScaleForTest,
  resolveToppingScaleCandidate,
  toppingScaleBadgeLabel,
} from "./toppingScalePreview";
import { TOPPING_RANK_SCALE, TOPPING_SIZE_CLASSES, TOPPING_SIZE_SCALE_CANDIDATES, toppingRankScale, toppingSizeClass } from "../data/toppingSizeClass";

/** the six pilot ingredients of the S2b comparison: one or two per class, every render route (emoji, thin emoji, CSS cheese / Canvas, leaf) */
const PILOT = ["corn", "black-olive", "mushroom", "mozzarella", "bacon", "basil"] as const;

function visit(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  resetPreviewToppingScaleForTest();
}

afterEach(() => {
  visit("");
});

describe("resolveToppingScaleCandidate", () => {
  it("names the query parameter the Owner types", () => {
    expect(TOPPING_SCALE_PARAM).toBe("toppingScale");
  });

  it("maps a / b, and nothing else, to a candidate", () => {
    expect(resolveToppingScaleCandidate("?toppingScale=a")).toBe("A");
    expect(resolveToppingScaleCandidate("?toppingScale=b")).toBe("B");
    for (const search of ["", "?toppingScale=", "?toppingScale=off", "?toppingScale=A", "?toppingScale=c", "?toppingScale=a&toppingScale=b", "?other=a", "?toppingScale=ab"]) {
      expect(resolveToppingScaleCandidate(search), search).toBeNull();
    }
    expect(resolveToppingScaleCandidate(undefined)).toBeNull();
    expect(resolveToppingScaleCandidate(42)).toBeNull();
  });
});

describe("activeToppingRankScale (this DEV build allows the switch)", () => {
  it("without the query every ingredient is exactly 1 (the production value)", () => {
    visit("");
    for (const id of [...PILOT, "tomato-sauce", "no-such-ingredient"]) expect(activeToppingRankScale(id), id).toBe(1);
  });

  it("?toppingScale=a / b gives the six pilot ingredients the candidate multipliers of their class", () => {
    for (const [query, key] of [["a", "A"], ["b", "B"]] as const) {
      visit(`?toppingScale=${query}`);
      expect(getPreviewToppingScaleCandidate()).toBe(key);
      const set = TOPPING_SIZE_SCALE_CANDIDATES[key];
      for (const id of PILOT) expect(activeToppingRankScale(id), `${key} ${id}`).toBe(set[toppingSizeClass(id)]);
    }
    visit("?toppingScale=a");
    expect(PILOT.map((id) => activeToppingRankScale(id))).toEqual([0.6, 0.8, 1, 1.25, 1.25, 1.5]);
    visit("?toppingScale=b");
    expect(PILOT.map((id) => activeToppingRankScale(id))).toEqual([0.7, 0.85, 1, 1.15, 1.15, 1.3]);
  });

  it("the reference class (mushroom) is 1 in every mode, and the six rise with their class", () => {
    for (const search of ["", "?toppingScale=a", "?toppingScale=b"]) {
      visit(search);
      expect(activeToppingRankScale("mushroom")).toBe(1);
      const byClass = TOPPING_SIZE_CLASSES.map((c) => PILOT.find((id) => toppingSizeClass(id) === c)).filter((id): id is (typeof PILOT)[number] => id !== undefined);
      const values = byClass.map((id) => activeToppingRankScale(id));
      for (let i = 1; i < values.length; i += 1) expect(values[i], search).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it("a sauce, an unknown id and an empty id stay 1 under a candidate", () => {
    visit("?toppingScale=a");
    for (const id of ["tomato-sauce", "olive-oil", "no-such-ingredient", ""]) expect(activeToppingRankScale(id), id).toBe(1);
  });

  it("the value is read once per page load: changing the URL later does not change it until reset", () => {
    visit("?toppingScale=a");
    expect(activeToppingRankScale("basil")).toBe(1.5);
    window.history.replaceState(null, "", "/?toppingScale=b");
    expect(activeToppingRankScale("basil")).toBe(1.5);
  });

  it("the production value is untouched by the switch module", () => {
    visit("?toppingScale=a");
    for (const id of PILOT) expect(toppingRankScale(id)).toBe(TOPPING_RANK_SCALE[toppingSizeClass(id)]);
    expect(Object.values(TOPPING_RANK_SCALE).every((v) => v === 1)).toBe(true);
  });
});

describe("badge label", () => {
  it("names the variant, and nothing when there is none", () => {
    expect(toppingScaleBadgeLabel("A")).toBe("SIZE A");
    expect(toppingScaleBadgeLabel("B")).toBe("SIZE B");
    expect(toppingScaleBadgeLabel(null)).toBeNull();
    expect(TOPPING_SCALE_PREVIEW_MARK).toBe("topping-scale-preview-v1");
  });
});
