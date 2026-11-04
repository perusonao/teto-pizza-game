import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleLab } from "./DrizzleLab";
import { readFileSync } from "node:fs";
import labSrc from "./DrizzleLab.tsx?raw";
import modelSrc from "./drizzleLab.ts?raw";
import { DRIZZLE_LAB_LABEL, DRIZZLE_LAB_MARK } from "./drizzleLab";

/** A 200x200 surface at (0,0): client px / 2 = surface units. */
function setup() {
  const view = render(<DrizzleLab />);
  const svg = screen.getByTestId("drizzle-surface") as unknown as SVGSVGElement;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
  svg.setPointerCapture = vi.fn();
  return { svg, ...view };
}
const ev = (clientX: number, clientY: number, pointerId = 1) => ({ clientX, clientY, pointerId, pointerType: "touch", button: 0 });
const strokes = () => screen.getByTestId("drizzle-strokes").querySelectorAll('[data-stroke="drag"], [data-stroke="tap"]');

let setItem: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  setItem = vi.spyOn(Storage.prototype, "setItem");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DrizzleLab component", () => {
  it("shows the '試作・保存されません' label and the mark", () => {
    const { container } = setup();
    expect(screen.getByRole("note").textContent).toBe(DRIZZLE_LAB_LABEL);
    expect(container.querySelector(`[data-lab="${DRIZZLE_LAB_MARK}"]`)).not.toBeNull();
  });

  it("a finger drag draws a stroke and captures the pointer", () => {
    const { svg } = setup();
    fireEvent.pointerDown(svg, ev(60, 100));
    expect(svg.setPointerCapture).toHaveBeenCalledWith(1);
    fireEvent.pointerMove(svg, ev(100, 100));
    fireEvent.pointerMove(svg, ev(140, 110));
    expect(screen.getByTestId("drizzle-strokes").querySelector('[data-stroke="pending"]')).not.toBeNull();
    expect(strokes()).toHaveLength(0); // not committed before pointerup
    fireEvent.pointerUp(svg, ev(140, 110));
    expect(strokes()).toHaveLength(1);
    expect(strokes()[0].getAttribute("data-stroke")).toBe("drag");
    expect(screen.getByTestId("drizzle-count").textContent).toContain("1");
  });

  it("a tap draws a short line, not a dot", () => {
    const { svg } = setup();
    fireEvent.pointerDown(svg, ev(100, 100));
    fireEvent.pointerUp(svg, ev(100, 100));
    expect(strokes()).toHaveLength(1);
    const el = strokes()[0];
    expect(el.getAttribute("data-stroke")).toBe("tap");
    expect(el.tagName.toLowerCase()).toBe("polyline");
    expect(el.getAttribute("points")!.split(" ")).toHaveLength(2);
  });

  it("pointercancel discards the pending stroke", () => {
    const { svg } = setup();
    fireEvent.pointerDown(svg, ev(60, 100));
    fireEvent.pointerMove(svg, ev(120, 100));
    fireEvent.pointerCancel(svg, ev(120, 100));
    fireEvent.pointerUp(svg, ev(120, 100));
    expect(strokes()).toHaveLength(0);
    expect(screen.getByTestId("drizzle-strokes").querySelector('[data-stroke="pending"]')).toBeNull();
  });

  it("a lost pointer capture before pointerup discards the pending stroke", () => {
    const { svg } = setup();
    fireEvent.pointerDown(svg, ev(60, 100));
    fireEvent.pointerMove(svg, ev(120, 100));
    fireEvent.lostPointerCapture(svg, ev(120, 100));
    expect(strokes()).toHaveLength(0);
  });

  it("the lost capture that follows a normal pointerup does not undo the committed stroke", () => {
    const { svg } = setup();
    fireEvent.pointerDown(svg, ev(60, 100));
    fireEvent.pointerMove(svg, ev(120, 100));
    fireEvent.pointerUp(svg, ev(120, 100));
    fireEvent.lostPointerCapture(svg, ev(120, 100));
    expect(strokes()).toHaveLength(1);
  });

  it("multi-touch: the second finger is ignored while the first draws", () => {
    const { svg } = setup();
    fireEvent.pointerDown(svg, ev(60, 100, 1));
    fireEvent.pointerDown(svg, ev(140, 100, 2));
    fireEvent.pointerMove(svg, ev(150, 140, 2));
    fireEvent.pointerUp(svg, ev(150, 140, 2));
    expect(strokes()).toHaveLength(0);
    fireEvent.pointerMove(svg, ev(120, 100, 1));
    fireEvent.pointerUp(svg, ev(120, 100, 1));
    expect(strokes()).toHaveLength(1);
  });

  it("a ghost click after a tap or stroke adds nothing (pointer events only)", () => {
    const { svg } = setup();
    fireEvent.pointerDown(svg, ev(100, 100));
    fireEvent.pointerUp(svg, ev(100, 100));
    fireEvent.click(svg, { clientX: 100, clientY: 100 });
    fireEvent.click(svg, { clientX: 100, clientY: 100, detail: 2 });
    expect(strokes()).toHaveLength(1);
  });

  it("a press outside the dough draws nothing; a drag leaving the dough stays inside it", () => {
    const { svg } = setup();
    fireEvent.pointerDown(svg, ev(4, 4));
    fireEvent.pointerUp(svg, ev(4, 4));
    expect(strokes()).toHaveLength(0);
    fireEvent.pointerDown(svg, ev(160, 100));
    fireEvent.pointerMove(svg, ev(900, 100));
    fireEvent.pointerUp(svg, ev(900, 100));
    const pts = strokes()[0].getAttribute("points")!.split(" ").map((p) => p.split(",").map(Number));
    for (const [x, y] of pts) expect(Math.hypot(x - 50, y - 50)).toBeLessThanOrEqual(44.01);
  });

  it("a non-primary mouse button does not draw", () => {
    const { svg } = setup();
    fireEvent.pointerDown(svg, { ...ev(100, 100), pointerType: "mouse", button: 2 });
    fireEvent.pointerUp(svg, { ...ev(100, 100), pointerType: "mouse", button: 2 });
    expect(strokes()).toHaveLength(0);
  });

  it("reset clears the strokes", () => {
    const { svg } = setup();
    fireEvent.pointerDown(svg, ev(100, 100));
    fireEvent.pointerUp(svg, ev(100, 100));
    expect(strokes()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "リセット" }));
    expect(strokes()).toHaveLength(0);
    expect(screen.getByTestId("drizzle-count").textContent).toContain("0");
  });

  it("leaving the lab with a pending stroke leaves nothing behind and writes no storage", () => {
    const { svg, unmount } = setup();
    fireEvent.pointerDown(svg, ev(60, 100));
    fireEvent.pointerMove(svg, ev(120, 100));
    expect(() => unmount()).not.toThrow();
    expect(setItem).not.toHaveBeenCalled();
    const { container } = render(<DrizzleLab />);
    expect(container.querySelectorAll('[data-stroke]')).toHaveLength(0); // a fresh mount starts empty
  });

  it("drawing writes no storage at all (no save, no persistence)", () => {
    const { svg } = setup();
    fireEvent.pointerDown(svg, ev(60, 100));
    fireEvent.pointerMove(svg, ev(120, 100));
    fireEvent.pointerUp(svg, ev(120, 100));
    expect(setItem).not.toHaveBeenCalled();
  });

  it("reduced motion is reflected on the root (the tap animation is also disabled in CSS)", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
    const { container } = render(<DrizzleLab />);
    expect(container.querySelector('[data-reduced-motion="1"]')).not.toBeNull();
    vi.unstubAllGlobals();
    expect(readFileSync("src/preview/drizzleLab.css", "utf8")).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none/);
  });
});

describe("isolation from gameplay (source level)", () => {
  it("neither the lab nor its model imports the game: reducer, state, persistence, inventory, scoring, recipes, Dex, App", () => {
    for (const [f, src] of [["./DrizzleLab.tsx", labSrc], ["./drizzleLab.ts", modelSrc]] as const) {
      const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const spec of imports) expect(spec.startsWith("./") || spec === "react", `${f} imports ${spec}`).toBe(true);
      expect(imports.filter((s) => s.startsWith("./")).every((s) => s === "./drizzleLab" || s === "./drizzleLab.css"), `${f} imports a sibling other than the model`).toBe(true);
      expect(/localStorage|sessionStorage|indexedDB|dispatch|persist/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), `${f} touches storage/dispatch`).toBe(false);
    }
  });
});
