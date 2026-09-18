import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { BakeOverlay } from "./BakeOverlay";
import { computeGuideOpacity } from "../logic/bakeGuideFade";

/**
 * M3A Bake Judgment Phase 6: BakeOverlay drives its needle position *and* its Guide fade from
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

function getGaugeOpacity(): number {
  const gauge = document.querySelector<HTMLElement>(".bake-gauge");
  if (!gauge) throw new Error(".bake-gauge missing");
  return Number(gauge.style.opacity);
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

describe("computeGuideOpacity", () => {
  it("is fully visible before the fade window starts", () => {
    expect(computeGuideOpacity(0)).toBe(1);
    expect(computeGuideOpacity(3.6)).toBe(1);
  });

  it("decreases monotonically across the fade window", () => {
    let previous = Infinity;
    for (let t = 0; t <= 10; t += 0.1) {
      const value = computeGuideOpacity(t);
      expect(value).toBeLessThanOrEqual(previous + 1e-9);
      previous = value;
    }
  });

  it("is fully hidden once the fade window ends", () => {
    expect(computeGuideOpacity(7.2)).toBe(0);
    expect(computeGuideOpacity(100)).toBe(0);
  });
});

describe("BakeOverlay guide visibility", () => {
  it("shows the guide at full opacity at BAKE start", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    expect(getGaugeOpacity()).toBe(1);
  });

  it("fades the guide's opacity down over elapsed BAKE time, deterministically", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);

    advanceSeconds(3.6);
    expect(getGaugeOpacity()).toBeCloseTo(1, 1);

    advanceSeconds(1.8); // now ~5.4s elapsed, mid-fade
    const midOpacity = getGaugeOpacity();
    expect(midOpacity).toBeGreaterThan(0);
    expect(midOpacity).toBeLessThan(1);

    advanceSeconds(1.8); // now ~7.2s elapsed
    expect(getGaugeOpacity()).toBeCloseTo(0, 1);
  });

  it("keeps the guide's opacity monotonically non-increasing across many small frames", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    let previous = Infinity;
    for (let i = 0; i < 90; i += 1) {
      tick(100);
      const current = getGaugeOpacity();
      expect(current).toBeLessThanOrEqual(previous + 1e-9);
      previous = current;
    }
  });

  it("becomes fully hidden and swaps to a neutral, state-independent caption", () => {
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={vi.fn()} />);
    advanceSeconds(8);
    expect(getGaugeOpacity()).toBe(0);
    expect(screen.getByText("見た目で焼き加減を確かめて！")).toBeInTheDocument();
  });

  it("never applies the target-zone glow once the guide is fully hidden", () => {
    // targetStart/targetEnd cover the needle's entire resting range so it is always "in
    // target" -- isolates the glow-gating assertion from needle position timing.
    render(<BakeOverlay targetStart={0} targetEnd={100} onConfirm={vi.fn()} />);
    const button = screen.getByRole("button", { name: "取り出す！" });

    expect(button.className).toContain("cta-button--glow");

    advanceSeconds(8);
    expect(button.className).not.toContain("cta-button--glow");
  });
});

describe("BakeOverlay confirm/finish action", () => {
  it("still confirms the current needle position after the guide has faded", () => {
    const onConfirm = vi.fn();
    render(<BakeOverlay targetStart={40} targetEnd={60} onConfirm={onConfirm} />);
    advanceSeconds(8);

    screen.getByRole("button", { name: "取り出す！" }).click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(typeof onConfirm.mock.calls[0][0]).toBe("number");
  });
});
