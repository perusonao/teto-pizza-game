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

  it("moves never become history lines: alternating window / layer moves (the real wiring) cannot push the gesture start out", () => {
    const diag = new SquareDoughDiag(clock().now);
    diag.event("win", { type: "pointerdown", pointerType: "touch", pointerId: 1 }, "idle");
    diag.event("layer", { type: "pointerdown", pointerType: "touch", pointerId: 1 }, "idle");
    diag.note("capture ok");
    for (let i = 0; i < 200; i++) {
      // every move reaches the window listener first and then the layer handler
      diag.event("win", { type: "pointermove", pointerType: "touch", pointerId: 1 }, "pressing");
      diag.event("layer", { type: "pointermove", pointerType: "touch", pointerId: 1 }, "pressing");
    }
    diag.event("win", { type: "pointerup", pointerType: "touch", pointerId: 1 }, "pressing");
    diag.event("layer", { type: "pointerup", pointerType: "touch", pointerId: 1 }, "pressing");
    const text = diag.snapshot("env");
    expect(text).toContain("win pointerdown touch id1");
    expect(text).toContain("layer pointerdown touch id1");
    expect(text).toContain("capture ok");
    expect(text).toContain("win pointerup");
    expect(text).toContain("layer pointerup");
    expect(text).not.toContain("pointermove touch id1 ph=pressing -"); // not a history line
    expect(text).toContain("moves since down: win=200 layer=200");
  });

  it("the move counters restart at each pointerdown", () => {
    const diag = new SquareDoughDiag(clock().now);
    for (let i = 0; i < 5; i++) diag.event("layer", { type: "pointermove", pointerType: "touch", pointerId: 1 }, "pressing");
    expect(diag.snapshot("e")).toContain("layer=5");
    diag.event("layer", { type: "pointerdown", pointerType: "touch", pointerId: 2 }, "idle");
    expect(diag.snapshot("e")).toContain("moves since down: win=0 layer=0");
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


describe("the round's operation counts and times (C balance pass)", () => {
  function diagWithClock() {
    let t = 1000;
    const diag = new SquareDoughDiag(() => t);
    return { diag, at: (ms: number) => { t = 1000 + ms; } };
  }

  it("counts operations per step and per kind, and times STEP 1, STEP 2 and the total from the first finger down", () => {
    const { diag, at } = diagWithClock();
    at(500);
    diag.gestureStarted();
    at(900);
    diag.noteOperation("drag", 1, false, false);
    at(2500);
    diag.noteOperation("drag", 1, true, false); // this one reached STEP 2
    at(4000);
    diag.noteOperation("tap", 2, false, false);
    at(7500);
    diag.noteOperation("hold", 2, false, true); // and this one finished the dough
    const [ops, time] = diag.roundLines();
    expect(ops).toBe("手数 STEP1=2 (tap 0 hold 0 drag 2)  STEP2=2 (tap 1 hold 1 drag 0)  合計=4");
    expect(time).toBe("時間 STEP1=2.0s  STEP2=5.0s  合計(完成まで)=7.0s");
  });

  it("the first time only: later passes through STEP 2 / the finish do not move the stamps", () => {
    const { diag, at } = diagWithClock();
    diag.gestureStarted();
    at(1000);
    diag.noteOperation("drag", 1, true, true);
    at(9000);
    diag.noteOperation("tap", 2, true, true);
    expect(diag.round.step1DoneAt).toBe(2000);
    expect(diag.round.completeAt).toBe(2000);
  });

  it("while running the times are shown as ongoing, and a reset forgets the round; the snapshot carries both lines", () => {
    const { diag, at } = diagWithClock();
    at(100);
    diag.gestureStarted();
    at(3100);
    expect(diag.roundLines()[1]).toContain("STEP1=3.0s…");
    expect(diag.snapshot("env")).toContain("手数 STEP1=0 (tap 0 hold 0 drag 0)");
    diag.resetRound();
    expect(diag.round.startedAt).toBeNull();
    expect(diag.roundLines()[1]).toContain("STEP1=-");
  });
});
