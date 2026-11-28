import { describe, expect, it } from "vitest";
import { steamClearanceToCircle, steamPillNeedsCorner, type Box } from "./steamPillPlacement";

const box = (l: number, t: number, r: number, b: number): Box => ({ left: l, top: t, right: r, bottom: b });
/** A stage of `w` x `h` with a round dough of `d` centred in it (how the game lays it out). */
function layout(w: number, h: number, d: number) {
  return { stage: box(0, 100, w, 100 + h), dough: box((w - d) / 2, 100 + (h - d) / 2, (w + d) / 2, 100 + (h + d) / 2) };
}

describe("steamPillNeedsCorner: measured from the live rects", () => {
  it.each([
    // [label, stage w, stage h, dough, expected]  (numbers measured in the real layout, e2e/cooking-steam.spec.ts)
    ["390x844 authority", 390, 450, 290, false],
    ["360x800 authority (4px clear)", 360, 406, 274, false],
    ["390x760", 390, 366, 290, true],
    ["390x750", 390, 356, 290, true],
    ["390x664", 390, 282, 274, true],
    ["360x700", 360, 318, 274, true],
    ["360x640", 360, 258, 250, true],
  ])("%s", (_label, w, h, d, expected) => {
    const { stage, dough } = layout(w, h, d);
    expect(steamPillNeedsCorner(stage, dough)).toBe(expected);
  });

  it("the boundary is the geometry, not a magic height: just tall enough -> band, a few px shorter -> corner", () => {
    const d = 290;
    // the band is clear when the stage is >= dough + 2 * (18 + 44) plus the clearance margin
    expect(steamPillNeedsCorner(layout(390, 420, d).stage, layout(390, 420, d).dough)).toBe(false);
    expect(steamPillNeedsCorner(layout(390, 410, d).stage, layout(390, 410, d).dough)).toBe(true);
  });

  it("not laid out yet (zero / non-finite rects) keeps the band", () => {
    expect(steamPillNeedsCorner(box(0, 0, 0, 0), box(0, 0, 0, 0))).toBe(false);
    expect(steamPillNeedsCorner(box(0, 0, 390, NaN), box(50, 0, 340, 290))).toBe(false);
  });

  it("steamClearanceToCircle: negative when overlapping, positive when apart", () => {
    const c = { cx: 100, cy: 100, r: 50 };
    expect(steamClearanceToCircle(box(90, 90, 110, 110), c)).toBeLessThan(0);
    expect(steamClearanceToCircle(box(200, 200, 220, 220), c)).toBeGreaterThan(0);
    expect(steamClearanceToCircle(box(160, 90, 180, 110), c)).toBeCloseTo(10, 5);
  });
});
