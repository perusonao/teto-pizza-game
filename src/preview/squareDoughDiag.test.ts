import { describe, expect, it } from "vitest";
import { DIAG_PARAM, SQUARE_DOUGH_DIAG_MARK, SquareDoughDiag, describeTarget, resolveDiagEnabled } from "./squareDoughDiag";

/** #535 B2 on-device diagnostics (temporary): the recorder is pure bookkeeping; it must be cheap, bounded and never throw. */
describe("resolveDiagEnabled (?diag=1, Preview / DEV only)", () => {
  it("is on only for exactly one diag=1", () => {
    expect(DIAG_PARAM).toBe("diag");
    expect(resolveDiagEnabled("?diag=1")).toBe(true);
    expect(resolveDiagEnabled("?pan=square&squareStart=lumpy&diag=1")).toBe(true);
  });
  it("is off for anything else: absent, other values, repeats, a non-string", () => {
    for (const search of ["", "?pan=square", "?diag=0", "?diag=true", "?diag=", "?diag=1&diag=1", "?diag=1&diag=0", "?xdiag=1"]) {
      expect(resolveDiagEnabled(search), search).toBe(false);
    }
    expect(resolveDiagEnabled(undefined)).toBe(false);
    expect(resolveDiagEnabled(null)).toBe(false);
    expect(resolveDiagEnabled(1)).toBe(false);
  });
});

describe("describeTarget", () => {
  it("names tag, first class and test id on one short line", () => {
    const el = document.createElement("div");
    el.className = "square-dough-layer extra";
    el.setAttribute("data-testid", "x");
    expect(describeTarget(el)).toBe("DIV.square-dough-layer#x");
  });
  it("handles an SVG element (className is an object), null and junk", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    svg.setAttribute("class", "pan-rect");
    expect(describeTarget(svg)).toBe("rect.pan-rect");
    expect(describeTarget(null)).toBe("-");
    expect(describeTarget(5)).toBe("-");
    expect(describeTarget({})).toBe("?");
  });
  it("truncates a long name", () => {
    const el = document.createElement("div");
    el.className = "x".repeat(80);
    expect(describeTarget(el).length).toBeLessThanOrEqual(26);
  });
});

describe("SquareDoughDiag recorder", () => {
  const clock = () => {
    let t = 1000;
    return { now: () => t, advance: (ms: number) => (t += ms) };
  };

  it("records events in order with type / pointerType / id / phase / target, relative to its own start", () => {
    const c = clock();
    const diag = new SquareDoughDiag(c.now);
    const el = document.createElement("div");
    el.className = "square-dough-layer";
    c.advance(120);
    diag.event("win", { type: "pointerdown", pointerType: "touch", pointerId: 3, target: el }, "idle");
    c.advance(5);
    diag.event("layer", { type: "pointerdown", pointerType: "touch", pointerId: 3, target: el }, "idle");
    const text = diag.snapshot("env");
    expect(text).toContain("#1 +120 win pointerdown touch id3 ph=idle DIV.square-dough-layer");
    expect(text).toContain("#2 +125 layer pointerdown touch id3 ph=idle DIV.square-dough-layer");
    expect(text.indexOf("#1")).toBeLessThan(text.indexOf("#2"));
  });

  it("folds a stream of moves into one counted line, so they cannot push the interesting lines out", () => {
    const diag = new SquareDoughDiag(clock().now);
    diag.event("layer", { type: "pointerdown", pointerType: "touch", pointerId: 1 }, "idle");
    for (let i = 0; i < 50; i++) diag.event("layer", { type: "pointermove", pointerType: "touch", pointerId: 1 }, "pressing");
    diag.event("layer", { type: "pointerup", pointerType: "touch", pointerId: 1 }, "pressing");
    const text = diag.snapshot("env");
    expect(text).toContain("pointermove touch id1 ph=pressing - x50");
    expect(text).toContain("pointerdown");
    expect(text).toContain("pointerup");
  });

  it("keeps only the last 10 lines", () => {
    const diag = new SquareDoughDiag(clock().now);
    for (let i = 0; i < 40; i++) diag.note(`line-${i}`);
    const text = diag.snapshot("env");
    expect(text).toContain("line-39");
    expect(text).toContain("line-30");
    expect(text).not.toContain("line-29");
    expect(text).not.toContain("line-0 ");
  });

  it("counts, status and the version the panel polls", () => {
    const diag = new SquareDoughDiag(clock().now);
    const v0 = diag.version;
    diag.count("pressApplied");
    diag.count("holdTicks", 4);
    diag.count("commitIssued");
    diag.count("reducerAccepted");
    diag.setStatus({ interactive: true, phase: "holding", capture: "FAIL NotFoundError" });
    expect(diag.version).toBeGreaterThan(v0);
    const text = diag.snapshot("env-line");
    expect(text).toContain("SQUARE DIAG " + SQUARE_DOUGH_DIAG_MARK);
    expect(text).toContain("env-line");
    expect(text).toContain("interactive=true phase=holding");
    expect(text).toContain("capture FAIL NotFoundError");
    expect(text).toContain("press=1 hold=4 commit=1 accepted=1 discard=0");
  });

  it("never throws, whatever it is given", () => {
    const diag = new SquareDoughDiag(clock().now);
    const hostile = { get type(): string { throw new Error("boom"); } } as unknown as { type: string };
    expect(() => diag.event("win", hostile, "idle")).not.toThrow();
    expect(() => diag.event("win", { type: "click", target: { get tagName(): string { throw new Error("x"); } } as unknown as EventTarget }, "idle")).not.toThrow();
  });

  it("attachWindow listens passively in the capture phase, can neither stop nor cancel an event, and cleans up", () => {
    const diag = new SquareDoughDiag(clock().now);
    const detach = diag.attachWindow(() => "pressing");
    const event = new Event("pointerdown", { cancelable: true, bubbles: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(diag.snapshot("e")).toContain("win pointerdown");
    detach();
    const before = diag.snapshot("e");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(diag.snapshot("e")).toBe(before);
  });
});
