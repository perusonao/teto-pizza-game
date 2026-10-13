import { describe, expect, it } from "vitest";
import { cheesePoolBakeParams } from "./cheesePoolBake";

describe("cheesePoolBakeParams (bake heat -> melt / toast / char of the Canvas mozzarella)", () => {
  it("is the raw lump before baking and at the start of the bake", () => {
    expect(cheesePoolBakeParams(null)).toEqual({ melt: 0, toast: 0, char: 0 });
    expect(cheesePoolBakeParams(0)).toEqual({ melt: 0, toast: 0, char: 0 });
  });

  it("is fully melted and golden at the target centre (heat 1; S2-B3a: toast reaches 1 there), and not charred", () => {
    const p = cheesePoolBakeParams(1);
    expect(p.melt).toBe(1);
    expect(p.toast).toBeGreaterThan(0.9);
    expect(p.char).toBe(0);
  });

  it("only ever increases with heat and stays in 0..1; burnt is fully toasted and charred", () => {
    let last = { melt: 0, toast: 0, char: 0 };
    for (let h = 0; h <= 2.0001; h += 0.05) {
      const p = cheesePoolBakeParams(h);
      for (const k of ["melt", "toast", "char"] as const) {
        expect(p[k]).toBeGreaterThanOrEqual(last[k] - 1e-12);
        expect(p[k]).toBeGreaterThanOrEqual(0);
        expect(p[k]).toBeLessThanOrEqual(1);
      }
      last = p;
    }
    const burnt = cheesePoolBakeParams(2);
    expect([burnt.melt, burnt.toast]).toEqual([1, 1]);
    expect(burnt.char).toBeCloseTo(1, 9);
  });
});
