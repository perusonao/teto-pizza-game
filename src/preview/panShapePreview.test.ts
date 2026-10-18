import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRecipe } from "../data/recipes";
import {
  PAN_PARAM,
  PAN_SHAPE_PREVIEW_MARK,
  PREVIEW_PAN_VALUE,
  PREVIEW_SQUARE_START_VALUE,
  SQUARE_START_PARAM,
  activePanShape,
  getPreviewPanShape,
  getPreviewSquareStart,
  panShapeBadgeLabel,
  resetPreviewPanShapeForTest,
  resolvePreviewPanShape,
  resolvePreviewSquareStart,
  wantsLumpySquareStart,
} from "./panShapePreview";

const MARGHERITA = getRecipe("margherita")!;

function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
  resetPreviewPanShapeForTest();
}

beforeEach(() => setSearch(""));
afterEach(() => setSearch(""));

describe("the switch's names are what the Owner types (a rename here must be deliberate)", () => {
  it("?pan=square and ?squareStart=lumpy", () => {
    expect(PAN_PARAM).toBe("pan");
    expect(PREVIEW_PAN_VALUE).toBe("square");
    expect(SQUARE_START_PARAM).toBe("squareStart");
    expect(PREVIEW_SQUARE_START_VALUE).toBe("lumpy");
    expect(PAN_SHAPE_PREVIEW_MARK).toBe("pan-shape-preview-v1");
  });
});

describe("resolvePreviewPanShape / resolvePreviewSquareStart: only the exact, single value is honoured", () => {
  it("honours ?pan=square once", () => {
    expect(resolvePreviewPanShape("?pan=square")).toBe("square");
    expect(resolvePreviewPanShape("?a=1&pan=square&b=2")).toBe("square");
  });

  it("anything else is no override: other values, other case, a repeat, none, a non-string", () => {
    for (const search of ["", "?", "?pan=round", "?pan=Square", "?pan=", "?pan", "?pan=square&pan=square", "?pan=square&pan=round", "?panShape=square", "?x=pan=square"]) {
      expect(resolvePreviewPanShape(search), search).toBeNull();
    }
    for (const bad of [undefined, null, 5, {}, ["?pan=square"]]) expect(resolvePreviewPanShape(bad)).toBeNull();
  });

  it("honours ?squareStart=lumpy once, and nothing else", () => {
    expect(resolvePreviewSquareStart("?squareStart=lumpy")).toBe("lumpy");
    expect(resolvePreviewSquareStart("?pan=square&squareStart=lumpy")).toBe("lumpy");
    for (const search of ["", "?squareStart=ball", "?squareStart=Lumpy", "?squareStart=lumpy&squareStart=lumpy", "?squarestart=lumpy"]) {
      expect(resolvePreviewSquareStart(search), search).toBeNull();
    }
    expect(resolvePreviewSquareStart(undefined)).toBeNull();
  });
});

describe("the page-load value is read once and kept", () => {
  it("reads the query on first use and ignores later changes until reset", () => {
    setSearch("?pan=square&squareStart=lumpy");
    expect(getPreviewPanShape()).toBe("square");
    expect(getPreviewSquareStart()).toBe("lumpy");
    window.history.replaceState(null, "", "/");
    expect(getPreviewPanShape()).toBe("square");
    resetPreviewPanShapeForTest();
    expect(getPreviewPanShape()).toBeNull();
    expect(getPreviewSquareStart()).toBeNull();
  });
});

describe("activePanShape: the one place the override is applied", () => {
  it("with no switch every recipe -- and no recipe at all -- is the round pan, exactly as before", () => {
    expect(activePanShape(MARGHERITA)).toBe("round");
    expect(activePanShape(undefined)).toBe("round");
    expect(activePanShape(null)).toBe("round");
  });

  it("a recipe's own pan is honoured when there is no switch", () => {
    expect(activePanShape({ ...MARGHERITA, panShape: "square" })).toBe("square");
    expect(activePanShape({ ...MARGHERITA, panShape: "round" })).toBe("round");
  });

  it("?pan=square makes every round square (Preview / DEV), including the free-cook sentinel's", () => {
    setSearch("?pan=square");
    expect(activePanShape(MARGHERITA)).toBe("square");
    expect(activePanShape(undefined)).toBe("square");
  });

  it("an invalid switch changes nothing", () => {
    for (const search of ["?pan=round", "?pan=circle", "?pan=square&pan=square"]) {
      setSearch(search);
      expect(activePanShape(MARGHERITA), search).toBe("round");
    }
  });
});

describe("wantsLumpySquareStart", () => {
  it("only with ?squareStart=lumpy", () => {
    expect(wantsLumpySquareStart()).toBe(false);
    setSearch("?squareStart=lumpy");
    expect(wantsLumpySquareStart()).toBe(true);
    setSearch("?squareStart=ball");
    expect(wantsLumpySquareStart()).toBe(false);
  });
});

describe("panShapeBadgeLabel", () => {
  it("shows nothing without the override, and which start with it", () => {
    expect(panShapeBadgeLabel(null, null)).toBeNull();
    expect(panShapeBadgeLabel(null, "lumpy")).toBeNull();
    expect(panShapeBadgeLabel("square", null)).toBe("PAN square");
    expect(panShapeBadgeLabel("square", "lumpy")).toBe("PAN square (lumpy)");
  });
});
