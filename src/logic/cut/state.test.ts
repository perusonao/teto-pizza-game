import { describe, expect, it } from "vitest";
import { createDiameterCutLine, createIdealSliceFixtureLines } from "./fixtures";
import { addCutLine, createCutState, evaluateCutState, resetCutState } from "./state";

describe("createCutState", () => {
  it("starts with the default 6-slice config, no lines, and no evaluation", () => {
    const state = createCutState();
    expect(state.config.requestedSliceCount).toBe(6);
    expect(state.lines).toEqual([]);
    expect(state.evaluation).toBeNull();
  });

  it("accepts an explicit config", () => {
    const state = createCutState({ requestedSliceCount: 8 });
    expect(state.config.requestedSliceCount).toBe(8);
  });
});

describe("addCutLine", () => {
  it("appends the line and invalidates any prior evaluation", () => {
    const line = createDiameterCutLine(0);
    const withOneLine = addCutLine(createCutState(), line);
    expect(withOneLine.lines).toEqual([line]);
    expect(withOneLine.evaluation).toBeNull();

    const evaluated = evaluateCutState(withOneLine);
    const secondLine = createDiameterCutLine(60);
    const withTwoLines = addCutLine(evaluated, secondLine);
    expect(withTwoLines.lines).toEqual([line, secondLine]);
    expect(withTwoLines.evaluation).toBeNull();
  });

  it("does not mutate the original state (pure)", () => {
    const original = createCutState();
    const next = addCutLine(original, createDiameterCutLine(0));
    expect(original.lines).toEqual([]);
    expect(next.lines).toHaveLength(1);
  });
});

describe("resetCutState", () => {
  it("clears lines and evaluation while keeping the same config", () => {
    let state = createCutState({ requestedSliceCount: 8 });
    for (const line of createIdealSliceFixtureLines(8)) {
      state = addCutLine(state, line);
    }
    state = evaluateCutState(state);
    expect(state.lines).toHaveLength(4);
    expect(state.evaluation).not.toBeNull();

    const reset = resetCutState(state);
    expect(reset.lines).toEqual([]);
    expect(reset.evaluation).toBeNull();
    expect(reset.config.requestedSliceCount).toBe(8);
  });
});

describe("evaluateCutState (evaluation refresh)", () => {
  it("computes and stores the evaluation matching the current lines/config", () => {
    const withLines = createIdealSliceFixtureLines(6).reduce(
      (state, line) => addCutLine(state, line),
      createCutState(),
    );
    const evaluated = evaluateCutState(withLines);
    expect(evaluated.evaluation).not.toBeNull();
    expect(evaluated.evaluation?.actualPieceCount).toBe(6);
    expect(evaluated.evaluation?.requestedSliceCount).toBe(6);
  });

  it("is safe to call with zero lines (no NaN/Infinity)", () => {
    const evaluated = evaluateCutState(createCutState());
    expect(evaluated.evaluation).not.toBeNull();
    expect(Number.isFinite(evaluated.evaluation?.cutScore)).toBe(true);
  });

  it("re-evaluating after adding a further line reflects the new line set", () => {
    let state = createCutState({ requestedSliceCount: 4 });
    state = addCutLine(state, createDiameterCutLine(0));
    state = evaluateCutState(state);
    expect(state.evaluation?.completedCutCount).toBe(1);

    state = addCutLine(state, createDiameterCutLine(90));
    expect(state.evaluation).toBeNull();
    state = evaluateCutState(state);
    expect(state.evaluation?.completedCutCount).toBe(2);
    expect(state.evaluation?.actualPieceCount).toBe(4);
  });
});
