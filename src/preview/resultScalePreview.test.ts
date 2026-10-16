import { afterEach, describe, expect, it } from "vitest";
import {
  activeResultToppingScale,
  getPreviewResultScale,
  resetPreviewResultScaleForTest,
  RESULT_SCALE_CANDIDATES,
  RESULT_TOPPING_SCALE,
  resolveResultScale,
  resultScaleBadgeLabel,
  toppingPhaseScale,
} from "./resultScalePreview";

afterEach(() => {
  window.history.replaceState(null, "", "/");
  resetPreviewResultScaleForTest();
});

describe("resolveResultScale", () => {
  it.each([
    ["?resultScale=0.65", 0.65],
    ["?resultScale=0.75", 0.75],
    ["?resultScale=0.85", 0.85],
    ["?resultScale=1.0", 1],
    ["?resultScale=1", 1],
    ["?x=1&resultScale=0.75", 0.75],
  ])("%s -> %s", (q, v) => expect(resolveResultScale(q)).toBe(v));

  it.each(["", "?resultScale=", "?resultScale=0.7", "?resultScale=0.750", "?resultScale=2", "?resultScale=-1", "?resultScale=NaN", "?resultScale=0.75&resultScale=0.65", "?resultscale=0.75"])(
    "%j -> no override",
    (q) => expect(resolveResultScale(q)).toBeNull(),
  );

  it("non-string input is no override", () => {
    expect(resolveResultScale(undefined)).toBeNull();
    expect(resolveResultScale(0.75)).toBeNull();
  });

  it("the candidates are exactly the four the Owner named", () => {
    expect([...RESULT_SCALE_CANDIDATES]).toEqual([0.65, 0.75, 0.85, 1]);
  });
});

describe("the production value and the page-load cache", () => {
  it("production RESULT scale is 1 (today's size) until the Owner decides on an iPhone", () => {
    expect(RESULT_TOPPING_SCALE).toBe(1);
    expect(activeResultToppingScale()).toBe(1);
  });

  it("reads the query once per page load; a later URL change does not move it", () => {
    window.history.replaceState(null, "", "/?resultScale=0.75");
    resetPreviewResultScaleForTest();
    expect(getPreviewResultScale()).toBe(0.75);
    expect(activeResultToppingScale()).toBe(0.75);
    window.history.replaceState(null, "", "/?resultScale=0.65");
    expect(getPreviewResultScale()).toBe(0.75);
  });

  it("the badge label names the candidate, nothing without one", () => {
    expect(resultScaleBadgeLabel(0.75)).toBe("RESULT x0.75");
    expect(resultScaleBadgeLabel(null)).toBeNull();
  });
});

describe("toppingPhaseScale", () => {
  it("is 1 off the RESULT, and for the exempt mozzarella everywhere", () => {
    window.history.replaceState(null, "", "/?resultScale=0.75");
    resetPreviewResultScaleForTest();
    expect(toppingPhaseScale("basil", false)).toBe(1);
    expect(toppingPhaseScale("mozzarella", true)).toBe(1);
    expect(toppingPhaseScale("mozzarella", false)).toBe(1);
    expect(toppingPhaseScale("basil", true)).toBe(0.75);
    expect(toppingPhaseScale("pepperoni", true)).toBe(0.75);
  });
});
