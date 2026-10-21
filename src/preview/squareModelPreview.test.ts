import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SQUARE_OK_RATE,
  resolveSquareOkRate,
  resolveSquareStretch,
  setSquareStretchForTest,
  squareStretchActive,
  squareStretchOkRate,
} from "./squareModelPreview";

describe("square model prototype switch", () => {
  afterEach(() => setSquareStretchForTest(null));

  it("is on only for ?squareModel=stretch given exactly once", () => {
    expect(resolveSquareStretch("?squareModel=stretch")).toBe(true);
    expect(resolveSquareStretch("?pan=square&squareModel=stretch")).toBe(true);
    expect(resolveSquareStretch("")).toBe(false);
    expect(resolveSquareStretch("?squareModel=other")).toBe(false);
    expect(resolveSquareStretch("?squareModel=stretch&squareModel=stretch")).toBe(false);
    expect(resolveSquareStretch(undefined)).toBe(false);
  });

  it("reads the OK rate as 75 or 85, anything else is 75", () => {
    expect(resolveSquareOkRate("?squareOk=85")).toBe(85);
    expect(resolveSquareOkRate("?squareOk=75")).toBe(75);
    expect(resolveSquareOkRate("?squareOk=90")).toBe(DEFAULT_SQUARE_OK_RATE);
    expect(resolveSquareOkRate("?squareOk=85&squareOk=75")).toBe(DEFAULT_SQUARE_OK_RATE);
    expect(resolveSquareOkRate("")).toBe(DEFAULT_SQUARE_OK_RATE);
  });

  it("defaults OFF with an empty page (the current model runs)", () => {
    expect(squareStretchActive()).toBe(false);
    expect(squareStretchOkRate()).toBe(0.75);
  });

  it("the test seam switches the prototype and its OK rate", () => {
    setSquareStretchForTest({ stretch: true, ok: 85 });
    expect(squareStretchActive()).toBe(true);
    expect(squareStretchOkRate()).toBe(0.85);
  });
});
