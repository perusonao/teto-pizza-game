import { describe, expect, it } from "vitest";
import { capStarsForBake, starsFromTotal } from "./scoring";

describe("starsFromTotal", () => {
  const cases: Array<[number, 1 | 2 | 3 | 4 | 5]> = [
    [0, 1],
    [39, 1],
    [40, 2],
    [59, 2],
    [60, 3],
    [74, 3],
    [75, 4],
    [89, 4],
    [90, 5],
    [100, 5],
  ];

  for (const [total, expected] of cases) {
    it(`total ${total} -> ${expected} star(s)`, () => {
      expect(starsFromTotal(total)).toBe(expected);
    });
  }
});

describe("capStarsForBake", () => {
  it("keeps 5 stars for a perfect bake", () => {
    expect(capStarsForBake(5, "perfect")).toBe(5);
  });

  it("caps 5 stars down to 4 for a raw bake", () => {
    expect(capStarsForBake(5, "raw")).toBe(4);
  });

  it("caps 5 stars down to 4 for a burnt bake", () => {
    expect(capStarsForBake(5, "burnt")).toBe(4);
  });

  it("never raises stars below 5, and leaves them untouched when bake isn't perfect", () => {
    expect(capStarsForBake(4, "raw")).toBe(4);
    expect(capStarsForBake(3, "burnt")).toBe(3);
    expect(capStarsForBake(1, "raw")).toBe(1);
  });
});
