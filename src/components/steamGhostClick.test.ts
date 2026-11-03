import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STEAM_GHOST_CLICK_WINDOW_MS, armSteamGhostClickGuard } from "./steamGhostClick";

/** Cooking Steam Phase 1 (#726, S3): the guard that swallows the ONE click which is the ghost of the pill's own touch (no new pointerdown), and nothing else. */
let target: HTMLButtonElement;
let seen: string[];
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  target = document.createElement("button");
  document.body.appendChild(target);
  seen = [];
  // what the app's own handler would see (a bubbling listener: it runs only if the click was not stopped in the capture phase)
  target.addEventListener("click", () => seen.push("click"));
});
afterEach(() => vi.useRealTimers());

const click = (detail = 1) => {
  const e = new MouseEvent("click", { bubbles: true, cancelable: true, detail });
  target.dispatchEvent(e);
  return e;
};
const pointerdown = () => target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));

describe("armSteamGhostClickGuard", () => {
  it("swallows exactly one click that comes with no new pointerdown (the ghost), and the next click passes", () => {
    armSteamGhostClickGuard();
    const ghost = click();
    expect(ghost.defaultPrevented).toBe(true);
    expect(seen).toEqual([]);
    click();
    expect(seen).toEqual(["click"]);
  });

  it("a new pointerdown disarms it: a quick, deliberate second tap is never swallowed (no dead time)", () => {
    armSteamGhostClickGuard();
    vi.advanceTimersByTime(40); // far inside the old "450 ms" idea of a guard
    pointerdown();
    const real = click();
    expect(real.defaultPrevented).toBe(false);
    expect(seen).toEqual(["click"]);
  });

  it("a keyboard click (detail 0) passes and does not use the guard up; the touch ghost after it is still swallowed", () => {
    armSteamGhostClickGuard();
    expect(click(0).defaultPrevented).toBe(false);
    expect(seen).toEqual(["click"]);
    expect(click(1).defaultPrevented).toBe(true);
    expect(seen).toEqual(["click"]);
  });

  it("gives up after the window if no ghost ever came", () => {
    armSteamGhostClickGuard();
    vi.advanceTimersByTime(STEAM_GHOST_CLICK_WINDOW_MS - 1);
    expect(click().defaultPrevented).toBe(true); // still armed just before the end
    armSteamGhostClickGuard();
    vi.advanceTimersByTime(STEAM_GHOST_CLICK_WINDOW_MS);
    expect(click().defaultPrevented).toBe(false);
    expect(seen).toEqual(["click"]);
  });

  it("dispose removes it for good, and calling it twice is harmless", () => {
    const dispose = armSteamGhostClickGuard();
    dispose();
    dispose();
    expect(click().defaultPrevented).toBe(false);
    expect(seen).toEqual(["click"]);
  });

  it("arming again replaces nothing it should not: two guards swallow at most one click each, one at a time", () => {
    const a = armSteamGhostClickGuard();
    a();
    armSteamGhostClickGuard();
    expect(click().defaultPrevented).toBe(true);
    expect(click().defaultPrevented).toBe(false);
  });

  it("the window is a plain, short number (not a general dead time)", () => {
    expect(STEAM_GHOST_CLICK_WINDOW_MS).toBe(600);
  });
});
