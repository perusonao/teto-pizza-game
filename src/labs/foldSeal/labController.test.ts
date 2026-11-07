import { describe, expect, it } from "vitest";
import { circleGeometry, createInitialFoldSealState, foldSealReduce, type FoldSealEvent, type FoldSealState } from "../../logic/foldSeal";
import { EMPTY_METRICS, NO_CONTACTS, addContact, canAdvance, clientToBox, recordLabEvent, removeContact, type LabMetrics } from "./labController";

const G = circleGeometry();
const run = (s: FoldSealState, ...es: FoldSealEvent[]) => es.reduce((a, e) => foldSealReduce(a, e, G), s);
const fresh = () => createInitialFoldSealState(0);
const dragFolded = () =>
  run(fresh(), { type: "FOLD_DOWN", pointerId: 1, x: 50, y: 20 }, { type: "FOLD_MOVE", pointerId: 1, x: 50, y: 80 }, { type: "FOLD_UP", pointerId: 1 });

describe("clientToBox", () => {
  const rect = { left: 20, top: 100, width: 200, height: 200 };
  it("maps client pixels to 0..100 box percent", () => {
    expect(clientToBox(rect, 20, 100)).toEqual({ x: 0, y: 0 });
    expect(clientToBox(rect, 120, 200)).toEqual({ x: 50, y: 50 });
    expect(clientToBox(rect, 220, 300)).toEqual({ x: 100, y: 100 });
  });
  it("does not clamp (points outside the box stay outside) and rejects degenerate input", () => {
    expect(clientToBox(rect, 0, 0)).toEqual({ x: -10, y: -50 });
    expect(clientToBox({ ...rect, width: 0 }, 5, 5)).toBeNull();
    expect(clientToBox(rect, NaN, 5)).toBeNull();
    expect(clientToBox({ ...rect, top: Infinity }, 5, 5)).toBeNull();
  });
});

describe("canAdvance: stepIsComplete AND no pointer in contact (tracked explicitly)", () => {
  it("false before the fold, true after a committed fold with no contact", () => {
    expect(canAdvance(fresh(), 0)).toBe(false);
    expect(canAdvance(dragFolded(), 0)).toBe(true);
  });
  it("false while any pointer is in contact, even if the phase is already `folded`", () => {
    const folded = dragFolded();
    expect(folded.phase).toBe("folded");
    expect(canAdvance(folded, 1)).toBe(false);
    expect(canAdvance(folded, 2)).toBe(false);
  });
  it("false while sealing (stepIsComplete is true there, but a finger is down)", () => {
    const sealing = run(dragFolded(), { type: "SEAL_DOWN", pointerId: 1, x: 50, y: 98 });
    expect(sealing.phase).toBe("sealing");
    expect(canAdvance(sealing, 1)).toBe(false);
    expect(canAdvance(run(sealing, { type: "SEAL_UP", pointerId: 1 }), 0)).toBe(true);
  });
  it("false while the fold is only being dragged", () => {
    const folding = run(fresh(), { type: "FOLD_DOWN", pointerId: 1, x: 50, y: 20 }, { type: "FOLD_MOVE", pointerId: 1, x: 50, y: 80 });
    expect(canAdvance(folding, 0)).toBe(false);
  });
});

describe("contact set", () => {
  it("adds and removes immutably, ignores repeats and non-finite ids", () => {
    const a = addContact(NO_CONTACTS, 1);
    expect(a.size).toBe(1);
    expect(addContact(a, 1)).toBe(a);
    expect(addContact(a, NaN)).toBe(a);
    expect(NO_CONTACTS.size).toBe(0);
    expect(removeContact(a, 9)).toBe(a);
    expect(removeContact(a, 1).size).toBe(0);
    expect(a.size).toBe(1);
  });
});

describe("recordLabEvent (display-only counters)", () => {
  const step = (m: LabMetrics, s: FoldSealState, e: FoldSealEvent, now: number): [LabMetrics, FoldSealState] => {
    const after = foldSealReduce(s, e, G);
    return [recordLabEvent(m, e, s, after, now), after];
  };
  it("counts a grab miss, a short release, then a first-try-false commit with its time", () => {
    let m = EMPTY_METRICS;
    let s = fresh();
    [m, s] = step(m, s, { type: "FOLD_DOWN", pointerId: 1, x: 50, y: 60 }, 0);
    expect(m.foldGrabMisses).toBe(1);
    [m, s] = step(m, s, { type: "FOLD_DOWN", pointerId: 1, x: 50, y: 20 }, 100);
    [m, s] = step(m, s, { type: "FOLD_MOVE", pointerId: 1, x: 50, y: 40 }, 150);
    [m, s] = step(m, s, { type: "FOLD_UP", pointerId: 1 }, 200);
    expect(m.foldReleasedShort).toBe(1);
    expect(m.foldFirstTry).toBe(false);
    [m, s] = step(m, s, { type: "FOLD_DOWN", pointerId: 1, x: 50, y: 20 }, 300);
    [m, s] = step(m, s, { type: "FOLD_MOVE", pointerId: 1, x: 50, y: 80 }, 350);
    [m, s] = step(m, s, { type: "FOLD_UP", pointerId: 1 }, 400);
    expect(m.foldCommits).toBe(1);
    expect(m.foldFirstTry).toBe(false);
    expect(m.foldMs).toBe(300);
    expect(s.phase).toBe("folded");
  });
  it("a first release that commits is a first try", () => {
    let m = EMPTY_METRICS;
    let s = fresh();
    for (const [e, t] of [[{ type: "FOLD_DOWN", pointerId: 1, x: 50, y: 20 }, 10], [{ type: "FOLD_MOVE", pointerId: 1, x: 50, y: 80 }, 20], [{ type: "FOLD_UP", pointerId: 1 }, 30]] as const) [m, s] = step(m, s, e, t);
    expect(m.foldFirstTry).toBe(true);
    expect(m.foldMs).toBe(20);
  });
  it("counts button folds / seals / resets / skips / cancels / invalidates only when they change the state", () => {
    let m = EMPTY_METRICS;
    let s = fresh();
    [m, s] = step(m, s, { type: "CANCEL" }, 1);
    expect(m.cancels).toBe(0);
    [m, s] = step(m, s, { type: "FOLD_BUTTON" }, 2);
    [m, s] = step(m, s, { type: "FOLD_BUTTON" }, 3);
    expect(m.buttonFolds).toBe(1);
    [m, s] = step(m, s, { type: "SEAL_BUTTON" }, 4);
    expect(m.buttonSeals).toBe(1);
    [m, s] = step(m, s, { type: "SEAL_SKIP" }, 5);
    [m, s] = step(m, s, { type: "SEAL_SKIP" }, 6);
    expect(m.sealSkips).toBe(1);
    [m, s] = step(m, s, { type: "SEAL_RESET" }, 7);
    expect(m.sealResets).toBe(1);
    [m, s] = step(m, s, { type: "INVALIDATE", revision: 1 }, 8);
    [m, s] = step(m, s, { type: "INVALIDATE", revision: 1 }, 9);
    expect(m.invalidates).toBe(1);
    expect(s).toEqual(createInitialFoldSealState(1));
  });
  it("counts band exits and records the full-seam time once", () => {
    const at = (phi: number, off = 0) => ({ x: 50 + (48 + off) * Math.cos(Math.PI - phi), y: 50 + (48 + off) * Math.sin(Math.PI - phi) });
    let m = EMPTY_METRICS;
    let s = dragFolded();
    [m, s] = step(m, s, { type: "SEAL_DOWN", pointerId: 1, ...at(0.02) }, 1000);
    [m, s] = step(m, s, { type: "SEAL_MOVE", pointerId: 1, x: 50, y: 70 }, 1100);
    expect(m.sealBandExits).toBe(1);
    [m, s] = step(m, s, { type: "SEAL_MOVE", pointerId: 1, ...at(0.1) }, 1200);
    for (let phi = 0.15; phi < Math.PI; phi += 0.05) [m, s] = step(m, s, { type: "SEAL_MOVE", pointerId: 1, ...at(Math.min(phi, Math.PI - 0.001)) }, 2000);
    expect(m.sealMs).toBe(1000);
    const first = m.sealMs;
    [m, s] = step(m, s, { type: "SEAL_MOVE", pointerId: 1, ...at(1) }, 5000);
    expect(m.sealMs).toBe(first);
  });
});
