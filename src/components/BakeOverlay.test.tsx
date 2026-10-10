import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { BakeOverlay } from "./BakeOverlay";

/**
 * Issue #419: BakeOverlay drives its one-way needle position *and* its target-zone fade from
 * its own internal `requestAnimationFrame` loop (see that component's own file header), so
 * these tests stub `requestAnimationFrame`/`performance.now` and drive the loop by hand,
 * one controlled frame at a time, rather than waiting on real wall-clock time.
 */
let rafCallback: FrameRequestCallback | null = null;
let now = 0;

function tick(deltaMs: number) {
  now += deltaMs;
  const callback = rafCallback;
  rafCallback = null;
  act(() => {
    callback?.(now);
  });
}

/** Advances the loop in small steps so the internal `dt` per frame stays realistic (mirrors a
 *  real ~60fps rAF cadence) rather than one giant single-frame jump. */
function advanceSeconds(totalSeconds: number, stepMs = 100) {
  const totalMs = totalSeconds * 1000;
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
    tick(Math.min(stepMs, totalMs - elapsed));
  }
}

function zonesOpacity(): number | null {
  const zones = document.querySelector<HTMLElement>(".bake-gauge__zones");
  return zones ? Number(zones.style.opacity) : null;
}

function needleLeft(): number {
  const needle = document.querySelector<HTMLElement>(".bake-gauge__needle");
  if (!needle) throw new Error(".bake-gauge__needle missing");
  return parseFloat(needle.style.left);
}

beforeEach(() => {
  now = 0;
  rafCallback = null;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    rafCallback = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("performance", { now: () => now });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BakeOverlay one-way needle", () => {
  it("moves 0 -> 100 in 10s, stops at the right end and never returns", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    expect(needleLeft()).toBe(0);

    let previous = 0;
    for (let i = 0; i < 150; i += 1) {
      tick(100); // 15s total, past the end
      const current = needleLeft();
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
    expect(previous).toBe(100);
  });

  it("is at ~50% after 5s and at 100% after 10s", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    advanceSeconds(5);
    expect(needleLeft()).toBeCloseTo(50, 0);
    advanceSeconds(5);
    expect(needleLeft()).toBeCloseTo(100, 5);
    advanceSeconds(1);
    expect(needleLeft()).toBe(100);
  });

  it("reports the same monotonic position through onTick", () => {
    const onTick = vi.fn();
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} onTick={onTick} />);
    advanceSeconds(12);
    const values = onTick.mock.calls.map((call) => call[0] as number);
    expect(values.length).toBeGreaterThan(10);
    for (let i = 1; i < values.length; i += 1) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    expect(values[values.length - 1]).toBe(100);
  });
});

describe("BakeOverlay target-zone visibility (OD-419)", () => {
  it("shows the zone at full opacity for the first 3s", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    expect(zonesOpacity()).toBe(1);
    advanceSeconds(3);
    expect(zonesOpacity()).toBeCloseTo(1, 1);
  });

  it("fades the zone between 3s and 5s", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    advanceSeconds(4);
    const mid = zonesOpacity();
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
  });

  it("removes the zone from 5s on and never brings it back, while track and needle stay", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    advanceSeconds(5.2);
    expect(zonesOpacity()).toBeNull();
    advanceSeconds(10);
    expect(zonesOpacity()).toBeNull();
    expect(document.querySelector(".bake-gauge")).not.toBeNull();
    expect(document.querySelector(".bake-gauge__needle")).not.toBeNull();
  });

  it("uses the same fade for every target window (not recipe dependent)", () => {
    const { unmount } = render(<BakeOverlay targetStart={45} targetEnd={65} onConfirm={vi.fn()} />);
    advanceSeconds(4);
    const a = zonesOpacity();
    unmount();
    now = 0;
    render(<BakeOverlay targetStart={65} targetEnd={85} onConfirm={vi.fn()} />);
    advanceSeconds(4);
    expect(zonesOpacity()).toBeCloseTo(a as number, 5);
  });
});

describe("BakeOverlay does not reveal the correct position", () => {
  it("keeps one needle colour, a neutral caption and no CTA glow at every position", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    const button = screen.getByRole("button", { name: "取り出す！" });
    const needle = document.querySelector<HTMLElement>(".bake-gauge__needle")!;
    const seenInline = new Set<string>();
    for (let i = 0; i < 110; i += 1) {
      tick(100); // sweeps raw -> target -> burnt
      seenInline.add(needle.getAttribute("style")!.replace(/left:[^;]+;?/, ""));
      expect(button.className).not.toContain("glow");
      expect(screen.getByText("見た目で焼き加減を確かめて！")).toBeInTheDocument();
    }
    expect(seenInline.size).toBe(1);
    expect([...seenInline][0]).not.toContain("background");
  });
});

describe("BakeOverlay background / blur safety", () => {
  function setHidden(hidden: boolean) {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event("visibilitychange"));
  }

  afterEach(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  });

  it("does not advance while hidden, and resumes without a jump", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    advanceSeconds(2);
    const before = needleLeft();

    act(() => setHidden(true));
    advanceSeconds(30); // rAF may still fire in tests; the clock must not move
    expect(needleLeft()).toBe(before);

    now += 120_000; // a long gap while away
    act(() => setHidden(false));
    tick(16);
    expect(needleLeft() - before).toBeLessThan(1);
  });

  it("pauses on window blur and resumes on focus", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    advanceSeconds(2);
    const before = needleLeft();
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    advanceSeconds(20);
    expect(needleLeft()).toBe(before);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    advanceSeconds(1);
    expect(needleLeft()).toBeGreaterThan(before);
  });

  it("stays paused when a hidden tab is shown again while the window is still blurred", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    advanceSeconds(2);
    const before = needleLeft();
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    act(() => setHidden(true));
    act(() => setHidden(false)); // visible again, but still not focused
    advanceSeconds(10);
    expect(needleLeft()).toBe(before);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    advanceSeconds(1);
    expect(needleLeft()).toBeGreaterThan(before);
  });

  it("caps a single huge frame (no jump to 100%)", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    tick(60_000);
    expect(needleLeft()).toBeLessThanOrEqual(1.01);
  });
});

describe("BakeOverlay confirm/finish action", () => {
  it("confirms the raw current needle position (0..100) with no input lock", () => {
    const onConfirm = vi.fn();
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={onConfirm} />);
    screen.getByRole("button", { name: "取り出す！" }).click(); // immediately: not locked
    expect(onConfirm).toHaveBeenCalledWith(0);

    advanceSeconds(6);
    screen.getByRole("button", { name: "取り出す！" }).click();
    expect(onConfirm.mock.calls[1][0]).toBeCloseTo(60, 0);

    advanceSeconds(10);
    screen.getByRole("button", { name: "取り出す！" }).click();
    expect(onConfirm.mock.calls[2][0]).toBe(100);
  });
});
