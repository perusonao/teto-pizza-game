import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SEAM_BINS } from "../../logic/foldSeal";
import { FoldSealLab } from "./FoldSealLab";

/** jsdom has no layout: the stage reports a 200x200 box at (10, 20), so 1 box unit = 2px. */
const RECT = { left: 10, top: 20, width: 200, height: 200 };
const px = (bx: number, by: number) => ({ clientX: RECT.left + bx * 2, clientY: RECT.top + by * 2 });
const at = (phi: number, off = 0) => px(50 + (48 + off) * Math.cos(Math.PI - phi), 50 + (48 + off) * Math.sin(Math.PI - phi));

beforeEach(() => {
  render(<FoldSealLab />);
  const hit = screen.getByTestId("fsl-hit");
  hit.getBoundingClientRect = () => ({ ...RECT, right: RECT.left + 200, bottom: RECT.top + 200, x: RECT.left, y: RECT.top, toJSON: () => ({}) });
  hit.setPointerCapture = () => {};
});
afterEach(cleanup);

const hit = () => screen.getByTestId("fsl-hit");
const root = () => screen.getByTestId("fsl-root");
const phase = () => root().getAttribute("data-phase");
const sealed = () => Array.from({ length: SEAM_BINS }, (_, i) => screen.queryByTestId(`seam-bin-${i}`)?.getAttribute("data-sealed")).filter((v) => v === "1").length;
const down = (pt: { clientX: number; clientY: number }, pointerId = 1) => fireEvent.pointerDown(hit(), { pointerId, isPrimary: pointerId === 1, ...pt });
const move = (pt: { clientX: number; clientY: number }, pointerId = 1) => fireEvent.pointerMove(hit(), { pointerId, ...pt });
const up = (pt: { clientX: number; clientY: number }, pointerId = 1) => fireEvent.pointerUp(hit(), { pointerId, ...pt });
const dragFold = () => {
  down(px(50, 20));
  move(px(50, 50));
  move(px(50, 80));
  up(px(50, 80));
};
const advance = () => fireEvent.click(screen.getByTestId("btn-next"));
const counts = () => screen.getByTestId("fsl-advance-counts").textContent;

describe("FoldSealLab: drag", () => {
  it("starts idle; a drag past the commit threshold folds on release", () => {
    expect(phase()).toBe("idle");
    down(px(50, 20));
    expect(phase()).toBe("folding");
    move(px(50, 80));
    expect(phase()).toBe("folding");
    up(px(50, 80));
    expect(phase()).toBe("folded");
    expect(root().getAttribute("data-fold-angle")).toBe(Math.PI.toFixed(4));
  });
  it("a short drag springs back to idle", () => {
    down(px(50, 20));
    move(px(50, 45));
    up(px(50, 45));
    expect(phase()).toBe("idle");
    expect(root().getAttribute("data-fold-angle")).toBe("0.0000");
  });
  it("a touch outside the grab zone does nothing", () => {
    down(px(50, 80));
    expect(phase()).toBe("idle");
    up(px(50, 80));
    expect(root().getAttribute("data-contacts")).toBe("0");
  });
});

describe("FoldSealLab: seal = 36 segments", () => {
  it("renders the 36 seam bins only once folded", () => {
    expect(screen.queryByTestId("seam-bin-0")).toBeNull();
    dragFold();
    for (let i = 0; i < SEAM_BINS; i += 1) expect(screen.getByTestId(`seam-bin-${i}`)).toBeTruthy();
    expect(screen.queryByTestId(`seam-bin-${SEAM_BINS}`)).toBeNull();
    expect(sealed()).toBe(0);
  });
  it("a west-to-east stroke along the edge seals every segment", () => {
    dragFold();
    down(at(0.02));
    expect(phase()).toBe("sealing");
    for (let phi = 0.05; phi < Math.PI; phi += 0.05) move(at(Math.min(phi, Math.PI - 0.001)));
    up(at(3));
    expect(phase()).toBe("folded");
    expect(sealed()).toBe(SEAM_BINS);
  });
  it("a partial stroke keeps its progress after release", () => {
    dragFold();
    down(at(0.3));
    move(at(1.0));
    up(at(1.0));
    const n = sealed();
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(SEAM_BINS);
    down(at(2.0));
    move(at(2.4));
    up(at(2.4));
    expect(sealed()).toBeGreaterThan(n);
  });
  it("marks unsealed runs of 3+ bins as visual gaps, and sealed bins are never gaps", () => {
    dragFold();
    down(at(0.02));
    move(at(1.0));
    up(at(1.0));
    const gaps = Array.from({ length: SEAM_BINS }, (_, i) => screen.getByTestId(`seam-bin-${i}`)).filter((el) => el.getAttribute("data-gap") === "1");
    expect(gaps.length).toBeGreaterThan(0);
    for (const el of gaps) expect(el.getAttribute("data-sealed")).toBe("0");
  });
  it("crossing through the middle seals nothing", () => {
    dragFold();
    down(at(0.02));
    move(px(50, 70));
    move(at(1.4, 0));
    const n = sealed();
    move(px(50, 60));
    expect(sealed()).toBe(n);
  });
});

describe("FoldSealLab: buttons converge on the same machine", () => {
  it("折る then とじる x4 seals the whole seam; the buttons track the machine", () => {
    fireEvent.click(screen.getByTestId("btn-fold"));
    expect(phase()).toBe("folded");
    expect(root().getAttribute("data-fold-angle")).toBe(Math.PI.toFixed(4));
    for (let i = 1; i <= 4; i += 1) {
      fireEvent.click(screen.getByTestId("btn-seal"));
      expect(sealed()).toBe(9 * i);
    }
    expect((screen.getByTestId("btn-seal") as HTMLButtonElement).disabled).toBe(true);
  });
  it("button fold and drag fold give the same folded angle and an empty seam", () => {
    fireEvent.click(screen.getByTestId("btn-fold"));
    const buttonAngle = root().getAttribute("data-fold-angle");
    fireEvent.click(screen.getByTestId("btn-reopen"));
    expect(phase()).toBe("idle");
    dragFold();
    expect(root().getAttribute("data-fold-angle")).toBe(buttonAngle);
    expect(sealed()).toBe(0);
  });
  it("あけなおす clears the seal; とじなおす clears only the seal; skip keeps the fold", () => {
    fireEvent.click(screen.getByTestId("btn-fold"));
    fireEvent.click(screen.getByTestId("btn-seal"));
    fireEvent.click(screen.getByTestId("btn-seal-reset"));
    expect(phase()).toBe("folded");
    expect(sealed()).toBe(0);
    fireEvent.click(screen.getByTestId("btn-skip"));
    expect(phase()).toBe("folded");
    fireEvent.click(screen.getByTestId("btn-reopen"));
    expect(phase()).toBe("idle");
    expect(screen.queryByTestId("seam-bin-0")).toBeNull();
  });
  it("前の工程を変える discards the fold and the seal", () => {
    fireEvent.click(screen.getByTestId("btn-fold"));
    fireEvent.click(screen.getByTestId("btn-seal"));
    fireEvent.click(screen.getByTestId("btn-upstream"));
    expect(phase()).toBe("idle");
    expect(screen.queryByTestId("seam-bin-0")).toBeNull();
  });
});

describe("FoldSealLab: no navigation while a pointer is in contact (Owner contract)", () => {
  it("is blocked before the fold, allowed after a committed fold with no contact", () => {
    advance();
    expect(root().getAttribute("data-advanced")).toBe("0");
    expect(counts()).toBe("0／1");
    dragFold();
    advance();
    expect(root().getAttribute("data-advanced")).toBe("1");
    expect(counts()).toBe("1／1");
  });
  it("is blocked while a seal stroke is down (sealing: stepIsComplete is true, a finger is in contact)", () => {
    dragFold();
    down(at(1.5));
    expect(phase()).toBe("sealing");
    advance();
    expect(root().getAttribute("data-advanced")).toBe("0");
    up(at(1.5));
    advance();
    expect(root().getAttribute("data-advanced")).toBe("1");
  });
  it("is blocked by a SECOND finger tapping next while the first holds the stage", () => {
    dragFold();
    down(at(1.5), 1);
    advance();
    expect(root().getAttribute("data-advanced")).toBe("0");
    expect(root().getAttribute("data-contacts")).toBe("1");
  });
  it("does not rely on phase alone: an ignored off-band touch while folded still blocks", () => {
    dragFold();
    expect(phase()).toBe("folded");
    down(px(50, 50), 7);
    expect(phase()).toBe("folded");
    expect(root().getAttribute("data-contacts")).toBe("1");
    advance();
    expect(root().getAttribute("data-advanced")).toBe("0");
    up(px(50, 50), 7);
    advance();
    expect(root().getAttribute("data-advanced")).toBe("1");
  });
  it("the next button reports aria-disabled, never the disabled attribute (so the guard is exercised)", () => {
    const next = screen.getByTestId("btn-next");
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect((next as HTMLButtonElement).disabled).toBe(false);
    dragFold();
    expect(next.getAttribute("aria-disabled")).toBe("false");
  });
});

describe("FoldSealLab: interruptions", () => {
  it("pointercancel of the folding finger springs back; contact is released", () => {
    down(px(50, 20));
    move(px(50, 70));
    fireEvent.pointerCancel(hit(), { pointerId: 1 });
    expect(phase()).toBe("idle");
    expect(root().getAttribute("data-contacts")).toBe("0");
  });
  it("pointercancel of ANOTHER finger does not cancel the active stroke", () => {
    dragFold();
    down(at(0.5), 1);
    down(px(10, 10), 2);
    fireEvent.pointerCancel(hit(), { pointerId: 2 });
    expect(phase()).toBe("sealing");
  });
  it("a cancelled seal stroke keeps its progress", () => {
    dragFold();
    down(at(0.3));
    move(at(1.0));
    const n = sealed();
    fireEvent.pointerCancel(hit(), { pointerId: 1 });
    expect(phase()).toBe("folded");
    expect(sealed()).toBe(n);
  });
  it.each([
    ["blur", () => window.dispatchEvent(new Event("blur"))],
    ["resize", () => window.dispatchEvent(new Event("resize"))],
    ["orientationchange", () => window.dispatchEvent(new Event("orientationchange"))],
  ])("window %s cancels a fold in progress and drops all contacts", (_n, fire) => {
    down(px(50, 20));
    move(px(50, 70));
    act(() => fire());
    expect(phase()).toBe("idle");
    expect(root().getAttribute("data-contacts")).toBe("0");
  });
  it("the page being hidden cancels a seal stroke", () => {
    dragFold();
    down(at(0.5));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    expect(phase()).toBe("folded");
    expect(root().getAttribute("data-contacts")).toBe("0");
  });
  it("removes its window listeners on unmount (no cancel after unmount)", () => {
    cleanup();
    expect(() => window.dispatchEvent(new Event("blur"))).not.toThrow();
  });
});

describe("FoldSealLab: the lab saves nothing", () => {
  it("writes nothing to localStorage / sessionStorage through a full interaction", () => {
    const before = [localStorage.length, sessionStorage.length];
    dragFold();
    down(at(0.3));
    move(at(2.0));
    up(at(2.0));
    fireEvent.click(screen.getByTestId("btn-seal"));
    advance();
    expect([localStorage.length, sessionStorage.length]).toEqual(before);
  });
});
