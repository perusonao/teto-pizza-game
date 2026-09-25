import { describe, expect, it } from "vitest";
import {
  PIECE_RING_POSITIONS,
  REFERENCE_SLOT_MAX_RADIUS,
  REFERENCE_SLOT_MIN_GAP,
  assignReferenceSlots,
  getReferenceSlots,
  minimumSlotGap,
} from "./pizzaReferenceLayout";

/**
 * RT-01a (docs/reports/TETO_RT01_REFERENCE-PIECE-CAPACITY_Fresh-Design.md, Owner Decision
 * RT-01-OD-1): pins `getReferenceSlots(n)` -- exact legacy parity for 1-8, the approved
 * Candidate B multi-ring layout for 9+, determinism, no duplicates, spacing and bounds.
 * Golden coordinates for 9/10/12/15 are the output of tools/rt01_reference_capacity_design.py
 * (`cand_b_multiring`), the prototype the owner approved.
 */

/** The 140px 見本 popover's own piece footprint (App.css: 28px * 0.5 / (140 - 2 * 6)). */
const POPOVER_MIN_GAP = (28 * 0.5) / (140 - 2 * 6) * 100;

const GOLDEN: Record<number, readonly { x: number; y: number }[]> = {
  9: [{ x: 50, y: 50 }, { x: 50, y: 22 }, { x: 69.8, y: 30.2 }, { x: 78, y: 50 }, { x: 69.8, y: 69.8 }, { x: 50, y: 78 }, { x: 30.2, y: 69.8 }, { x: 22, y: 50 }, { x: 30.2, y: 30.2 }],
  10: [{ x: 50, y: 50 }, { x: 50, y: 22 }, { x: 68, y: 28.55 }, { x: 77.57, y: 45.14 }, { x: 74.25, y: 64 }, { x: 59.58, y: 76.31 }, { x: 40.42, y: 76.31 }, { x: 25.75, y: 64 }, { x: 22.43, y: 45.14 }, { x: 32, y: 28.55 }],
  12: [{ x: 50, y: 20 }, { x: 69.28, y: 27.02 }, { x: 79.54, y: 44.79 }, { x: 75.98, y: 65 }, { x: 60.26, y: 78.19 }, { x: 39.74, y: 78.19 }, { x: 24.02, y: 65 }, { x: 20.46, y: 44.79 }, { x: 30.72, y: 27.02 }, { x: 60.39, y: 44 }, { x: 50, y: 62 }, { x: 39.61, y: 44 }],
  15: [{ x: 50, y: 16 }, { x: 68.38, y: 21.4 }, { x: 80.93, y: 35.88 }, { x: 83.65, y: 54.84 }, { x: 75.7, y: 72.27 }, { x: 59.58, y: 82.62 }, { x: 40.42, y: 82.62 }, { x: 24.3, y: 72.27 }, { x: 16.35, y: 54.84 }, { x: 19.07, y: 35.88 }, { x: 31.62, y: 21.4 }, { x: 50, y: 36 }, { x: 64, y: 50 }, { x: 50, y: 64 }, { x: 36, y: 50 }],
};

function distinctCount(slots: readonly { x: number; y: number }[]): number {
  return new Set(slots.map((s) => `${s.x},${s.y}`)).size;
}

describe("getReferenceSlots", () => {
  it("returns PIECE_RING_POSITIONS.slice(0, n) exactly for n = 1..8 (legacy parity)", () => {
    for (let n = 1; n <= 8; n += 1) {
      expect(getReferenceSlots(n)).toEqual(PIECE_RING_POSITIONS.slice(0, n).map((s) => ({ x: s.x, y: s.y })));
    }
  });

  it("keeps PIECE_RING_POSITIONS itself unchanged", () => {
    expect(PIECE_RING_POSITIONS).toEqual([
      { x: 50, y: 24 },
      { x: 73, y: 36 },
      { x: 76, y: 63 },
      { x: 58, y: 79 },
      { x: 38, y: 79 },
      { x: 22, y: 63 },
      { x: 25, y: 36 },
      { x: 50, y: 52 },
    ]);
  });

  it("returns an empty layout for 0 or a negative count", () => {
    expect(getReferenceSlots(0)).toEqual([]);
    expect(getReferenceSlots(-3)).toEqual([]);
  });

  it.each([9, 10, 12, 15])("matches the approved Candidate B golden layout for %i pieces", (n) => {
    expect(getReferenceSlots(n)).toEqual(GOLDEN[n]);
  });

  it("9 and 10 pieces keep the legacy look: one ring plus a centre piece", () => {
    for (const n of [9, 10]) {
      const slots = getReferenceSlots(n);
      expect(slots[0]).toEqual({ x: 50, y: 50 });
      for (const slot of slots.slice(1)) {
        expect(Math.hypot(slot.x - 50, slot.y - 50)).toBeCloseTo(28, 1);
      }
    }
  });

  it("is deterministic and returns fresh copies (callers cannot corrupt the memo)", () => {
    const first = getReferenceSlots(12);
    first[0].x = -1;
    const second = getReferenceSlots(12);
    expect(second).toEqual(GOLDEN[12]);
    expect(getReferenceSlots(12)).toEqual(second);
  });

  it("returns exactly n pairwise-distinct points inside the sauce area for n = 1..40", () => {
    for (let n = 1; n <= 40; n += 1) {
      const slots = getReferenceSlots(n);
      expect(slots).toHaveLength(n);
      expect(distinctCount(slots)).toBe(n);
      for (const slot of slots) {
        expect(Number.isFinite(slot.x) && Number.isFinite(slot.y)).toBe(true);
        expect(Math.hypot(slot.x - 50, slot.y - 50)).toBeLessThanOrEqual(REFERENCE_SLOT_MAX_RADIUS + 0.02);
      }
    }
  });

  it("stays touch-free at the smallest reference view (mini 見本 48px) for every count up to 15", () => {
    for (let n = 2; n <= 15; n += 1) {
      expect(minimumSlotGap(getReferenceSlots(n))).toBeGreaterThanOrEqual(REFERENCE_SLOT_MIN_GAP);
    }
  });

  it("stays touch-free at the 見本 popover size well past any known recipe", () => {
    for (let n = 2; n <= 38; n += 1) {
      expect(minimumSlotGap(getReferenceSlots(n))).toBeGreaterThanOrEqual(POPOVER_MIN_GAP);
    }
  });

  it("has no hard-coded maximum: large counts still get distinct, widest-gap layouts", () => {
    const slots = getReferenceSlots(60);
    expect(slots).toHaveLength(60);
    expect(distinctCount(slots)).toBe(60);
    expect(minimumSlotGap(slots)).toBeGreaterThan(0);
  });
});

describe("assignReferenceSlots", () => {
  it("keeps the legacy consecutive rule for totals up to 8", () => {
    const groups = assignReferenceSlots([
      { ingredientId: "mozzarella", count: 3 },
      { ingredientId: "basil", count: 2 },
    ]);
    expect(groups).toEqual([
      { ingredientId: "mozzarella", positions: PIECE_RING_POSITIONS.slice(0, 3).map((s) => ({ ...s })) },
      { ingredientId: "basil", positions: PIECE_RING_POSITIONS.slice(3, 5).map((s) => ({ ...s })) },
    ]);
  });

  it("interleaves groups for totals of 9+ so each ingredient spreads around the pizza", () => {
    // Parmigiana-shaped composition (#221 W1 authority: mozzarella 2, eggplant 3, parmigiano 2, basil 2).
    const groups = assignReferenceSlots([
      { ingredientId: "mozzarella", count: 2 },
      { ingredientId: "eggplant", count: 3 },
      { ingredientId: "parmigiano", count: 2 },
      { ingredientId: "basil", count: 2 },
    ]);
    expect(groups.map((g) => g.positions.length)).toEqual([2, 3, 2, 2]);
    const all = groups.flatMap((g) => g.positions);
    expect(distinctCount(all)).toBe(9);
    expect(new Set(all.map((p) => `${p.x},${p.y}`))).toEqual(new Set(getReferenceSlots(9).map((p) => `${p.x},${p.y}`)));
    for (const group of groups) {
      if (group.positions.length > 1) expect(minimumSlotGap(group.positions)).toBeGreaterThanOrEqual(28 - 0.01);
    }
  });

  it("is deterministic for the same group order", () => {
    const input = [
      { ingredientId: "mozzarella", count: 2 },
      { ingredientId: "ham", count: 3 },
      { ingredientId: "egg", count: 1 },
      { ingredientId: "onion", count: 2 },
      { ingredientId: "black-olive", count: 2 },
    ];
    expect(assignReferenceSlots(input)).toEqual(assignReferenceSlots(input));
  });
});
