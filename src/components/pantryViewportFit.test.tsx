import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import {
  computePantryFit,
  KEYBOARD_LIKE_MIN_SHRINK_PX,
  PANTRY_FIT_BOTTOM_VAR,
  PANTRY_FIT_CLASS,
  PANTRY_FIT_VV_HEIGHT_VAR,
  usePantryViewportFit,
} from "./pantryViewportFit";

describe("computePantryFit (pure)", () => {
  const base = { layoutHeight: 844, vvHeight: 844, vvOffsetTop: 0, fieldFocused: false };

  it("does nothing without a keyboard-like shrink and without focus (CSS baseline)", () => {
    expect(computePantryFit(base)).toBeNull();
    expect(computePantryFit({ ...base, vvHeight: 844 - (KEYBOARD_LIKE_MIN_SHRINK_PX - 1) })).toBeNull(); // a toolbar-sized change
  });

  it("fits a keyboard-like shrink even when the field lost focus (the keyboard can outlive a blur)", () => {
    expect(computePantryFit({ ...base, vvHeight: 506 })).toEqual({ vvHeight: 506, bottom: 338 });
  });

  it("fits while the field is focused; with no shrink it is a no-op geometry (bottom 0, full height)", () => {
    expect(computePantryFit({ ...base, fieldFocused: true })).toEqual({ vvHeight: 844, bottom: 0 });
  });

  it("accounts for a panned visual viewport and never returns a negative bottom", () => {
    expect(computePantryFit({ layoutHeight: 844, vvHeight: 400, vvOffsetTop: 100, fieldFocused: true })).toEqual({ vvHeight: 400, bottom: 344 });
    expect(computePantryFit({ layoutHeight: 700, vvHeight: 400, vvOffsetTop: 500, fieldFocused: true })!.bottom).toBe(0);
  });

  it("garbage input never fits (fallback to the CSS baseline)", () => {
    for (const bad of [
      { vvHeight: NaN },
      { vvHeight: Infinity },
      { vvHeight: 0 },
      { vvHeight: -5 },
      { layoutHeight: 0 },
      { layoutHeight: NaN },
      { vvOffsetTop: -1 },
      { vvOffsetTop: NaN },
    ]) {
      expect(computePantryFit({ ...base, fieldFocused: true, ...bad }), JSON.stringify(bad)).toBeNull();
    }
    expect(computePantryFit({ ...base, vvHeight: "300" as unknown as number, fieldFocused: true })).toBeNull();
  });
});

class FakeViewport extends EventTarget {
  height = 844;
  offsetTop = 0;
  width = 390;
}

function Probe({ focused }: { focused: boolean }) {
  const ref = useRef<HTMLElement>(null);
  usePantryViewportFit(ref, focused);
  return <section ref={ref} data-testid="sheet" />;
}
const sheet = () => document.querySelector<HTMLElement>("[data-testid=sheet]")!;

describe("usePantryViewportFit (lifecycle)", () => {
  let vv: FakeViewport;
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    vv = new FakeViewport();
    frames = [];
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
    Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 844 });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
      frames = [];
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
  });
  const flush = () => {
    const pending = frames;
    frames = [];
    pending.forEach((cb) => cb(0));
  };

  it("applies nothing at rest and follows the visual viewport when it shrinks (coalesced to one frame)", () => {
    render(<Probe focused={false} />);
    expect(sheet().classList.contains(PANTRY_FIT_CLASS)).toBe(false);
    vv.height = 376;
    vv.dispatchEvent(new Event("resize"));
    vv.dispatchEvent(new Event("scroll"));
    expect(frames).toHaveLength(1);
    flush();
    expect(sheet().classList.contains(PANTRY_FIT_CLASS)).toBe(true);
    expect(sheet().style.getPropertyValue(PANTRY_FIT_VV_HEIGHT_VAR)).toBe("376px");
    expect(sheet().style.getPropertyValue(PANTRY_FIT_BOTTOM_VAR)).toBe("468px");
  });

  it("releases everything when the keyboard goes away", () => {
    render(<Probe focused={false} />);
    vv.height = 376;
    vv.dispatchEvent(new Event("resize"));
    flush();
    vv.height = 844;
    vv.dispatchEvent(new Event("resize"));
    flush();
    expect(sheet().classList.contains(PANTRY_FIT_CLASS)).toBe(false);
    expect(sheet().style.getPropertyValue(PANTRY_FIT_VV_HEIGHT_VAR)).toBe("");
    expect(sheet().style.getPropertyValue(PANTRY_FIT_BOTTOM_VAR)).toBe("");
  });

  it("re-evaluates when focus changes (focused: applies immediately at mount)", () => {
    vv.height = 376;
    const { rerender } = render(<Probe focused />);
    expect(sheet().classList.contains(PANTRY_FIT_CLASS)).toBe(true);
    // blur while the keyboard is still up: the shrink alone keeps the fit
    rerender(<Probe focused={false} />);
    expect(sheet().classList.contains(PANTRY_FIT_CLASS)).toBe(true);
  });

  it("unmount removes the listeners, cancels a pending frame and clears the sheet", () => {
    const remove = vi.spyOn(vv, "removeEventListener");
    const { unmount } = render(<Probe focused={false} />);
    vv.height = 376;
    vv.dispatchEvent(new Event("resize"));
    expect(frames).toHaveLength(1);
    unmount();
    expect(remove.mock.calls.map((c) => c[0]).sort()).toEqual(["resize", "scroll"]);
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("without window.visualViewport nothing is applied and nothing throws (CSS fallback)", () => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
    expect(() => render(<Probe focused />)).not.toThrow();
    expect(sheet().classList.contains(PANTRY_FIT_CLASS)).toBe(false);
  });

  it("an abnormal value falls back to the CSS baseline instead of applying it", () => {
    vv.height = NaN;
    render(<Probe focused />);
    expect(sheet().classList.contains(PANTRY_FIT_CLASS)).toBe(false);
    expect(sheet().style.getPropertyValue(PANTRY_FIT_VV_HEIGHT_VAR)).toBe("");
  });

  it("a throwing viewport getter is contained", () => {
    Object.defineProperty(vv, "height", {
      get() {
        throw new Error("boom");
      },
    });
    expect(() => render(<Probe focused />)).not.toThrow();
    expect(sheet().classList.contains(PANTRY_FIT_CLASS)).toBe(false);
  });
});
