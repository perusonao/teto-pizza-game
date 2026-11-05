import { describe, expect, it } from "vitest";
import { createInitialSquareDough, isSquareCellOnPan, squareCellIndex, type SquareDough } from "./squareDough";
import { dragAlong } from "./squareDoughDrag";
import { GAP_ARROW_MIN_LENGTH, GAP_MAX_ARROWS, isGapGuideActive, squareGapGuide } from "./squareDoughGaps";
import { squareDoughProgress } from "./squareDoughProgress";
import { CORNER_MARKS } from "./squareDoughView";

const C = { x: 50, y: 50 };
/** The state the Owner HV hit: the four corner pulls the screen asks for (centre -> each mark). All corners reached, coverage far from 95 %. */
function fourCornerPulls(): SquareDough {
  return CORNER_MARKS.reduce((d, mark) => dragAlong(d, C, mark), createInitialSquareDough());
}
function fullSheet(): { thickness: number[] } {
  const thickness = new Array<number>(256).fill(0);
  for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) if (isSquareCellOnPan(r, c)) thickness[squareCellIndex(r, c)] = 0.3;
  return { thickness };
}
const onPanCount = () => {
  let n = 0;
  for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) if (isSquareCellOnPan(r, c)) n++;
  return n;
};

describe("the state to guide: 4/4 corners, STEP 1 still open (measured: 75.5 % coverage after four corner pulls)", () => {
  const stuck = fourCornerPulls();
  const progress = squareDoughProgress(stuck);

  it("is the stuck state: every corner reached, STEP 1 not done", () => {
    expect(progress.cornersReached).toBe(4);
    expect(progress.step1Done).toBe(false);
    expect(progress.step).toBe(1);
    expect(isGapGuideActive(progress, 1)).toBe(true);
  });

  it("tints exactly the bare on-pan cells (their count is the uncovered share of the pan)", () => {
    const guide = squareGapGuide(stuck);
    expect(guide.bareCells.length).toBeGreaterThan(0);
    expect(guide.bareCells.length).toBeCloseTo((1 - progress.coverage) * onPanCount(), 6);
    for (const index of guide.bareCells) {
      expect(isSquareCellOnPan(Math.floor(index / 16), index % 16)).toBe(true);
      expect(stuck.thickness[index]).toBeLessThan(0.05);
    }
    expect(new Set(guide.bareCells).size).toBe(guide.bareCells.length);
  });

  it("points at no more than GAP_MAX_ARROWS gaps, largest first, each arrow ending IN a bare cell and starting ON dough", () => {
    const guide = squareGapGuide(stuck);
    expect(guide.gaps.length).toBeGreaterThanOrEqual(1);
    expect(guide.gaps.length).toBeLessThanOrEqual(GAP_MAX_ARROWS);
    for (let i = 1; i < guide.gaps.length; i++) expect(guide.gaps[i - 1].cells.length).toBeGreaterThanOrEqual(guide.gaps[i].cells.length);
    const cellAt = (p: { x: number; y: number }) => squareCellIndex(Math.floor((p.y / 100) * 16), Math.floor((p.x / 100) * 16));
    for (const gap of guide.gaps) {
      expect(stuck.thickness[cellAt(gap.aim)]).toBeLessThan(0.05);
      expect(gap.cells).toContain(cellAt(gap.aim));
      expect(stuck.thickness[cellAt(gap.from)]).toBeGreaterThanOrEqual(0.05);
      expect(Math.hypot(gap.aim.x - gap.from.x, gap.aim.y - gap.from.y)).toBeGreaterThanOrEqual(GAP_ARROW_MIN_LENGTH - 1e-9);
    }
  });

  it("the gaps partition no cell twice and never include a covered cell", () => {
    const guide = squareGapGuide(stuck);
    const all = guide.gaps.flatMap((g) => [...g.cells]);
    expect(new Set(all).size).toBe(all.length);
    for (const index of all) expect(guide.bareCells).toContain(index);
  });

  it("is derived and pure: the same dough gives the same guide, and the dough and its progress are untouched", () => {
    const before = JSON.stringify(stuck.thickness);
    const a = squareGapGuide(stuck);
    const b = squareGapGuide(stuck);
    expect(b).toEqual(a);
    expect(JSON.stringify(stuck.thickness)).toBe(before);
    expect(squareDoughProgress(stuck)).toEqual(progress);
  });
});

describe("when the guide is NOT active", () => {
  it("not before all four corners are reached", () => {
    const start = squareDoughProgress(createInitialSquareDough());
    expect(isGapGuideActive(start, 1)).toBe(false);
    const oneCorner = squareDoughProgress(dragAlong(createInitialSquareDough(), C, CORNER_MARKS[0]));
    expect(oneCorner.cornersReached).toBe(1);
    expect(isGapGuideActive(oneCorner, 1)).toBe(false);
  });

  it("not once STEP 2 has opened (the COMMITTED step decides), even though the corners stay reached", () => {
    const done = squareDoughProgress(fullSheet());
    expect(done.step1Done).toBe(true);
    expect(isGapGuideActive(done, 2)).toBe(false);
  });

  it("a full sheet has no gaps at all", () => {
    expect(squareGapGuide(fullSheet())).toEqual({ bareCells: [], gaps: [] });
  });
});

describe("edge shapes", () => {
  it("a single bare cell still gets a readable arrow (it starts far enough away)", () => {
    const sheet = fullSheet();
    const hole = squareCellIndex(8, 8);
    sheet.thickness[hole] = 0;
    const guide = squareGapGuide(sheet);
    expect(guide.bareCells).toEqual([hole]);
    expect(guide.gaps).toHaveLength(1);
    const gap = guide.gaps[0];
    expect(Math.hypot(gap.aim.x - gap.from.x, gap.aim.y - gap.from.y)).toBeGreaterThanOrEqual(GAP_ARROW_MIN_LENGTH - 1e-9);
  });

  it("a U-shaped gap aims inside the gap, not at its centre of mass in the middle of the dough", () => {
    const sheet = fullSheet();
    // bare U: left column, bottom row, right column of a 6 x 6 block
    for (let r = 3; r <= 8; r++) {
      sheet.thickness[squareCellIndex(r, 3)] = 0;
      sheet.thickness[squareCellIndex(r, 8)] = 0;
    }
    for (let c = 3; c <= 8; c++) sheet.thickness[squareCellIndex(8, c)] = 0;
    const guide = squareGapGuide(sheet);
    const gap = guide.gaps[0];
    const cellAt = (p: { x: number; y: number }) => squareCellIndex(Math.floor((p.y / 100) * 16), Math.floor((p.x / 100) * 16));
    expect(gap.cells).toContain(cellAt(gap.aim));
    expect(sheet.thickness[cellAt(gap.aim)]).toBe(0);
  });

  it("many isolated holes: still at most GAP_MAX_ARROWS arrows, every bare cell tinted", () => {
    const sheet = fullSheet();
    const holes = [squareCellIndex(4, 4), squareCellIndex(4, 11), squareCellIndex(11, 4), squareCellIndex(11, 11), squareCellIndex(8, 8)];
    for (const h of holes) sheet.thickness[h] = 0;
    const guide = squareGapGuide(sheet);
    expect([...guide.bareCells].sort((a, b) => a - b)).toEqual([...holes].sort((a, b) => a - b));
    expect(guide.gaps).toHaveLength(GAP_MAX_ARROWS);
  });
});
