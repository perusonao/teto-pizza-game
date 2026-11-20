import { afterEach, describe, expect, it } from "vitest";
import {
  MID_BAKE_LAB_DEFAULT_STOCK,
  MID_BAKE_LAB_HOLD_MS_PARAM,
  MID_BAKE_LAB_MARK,
  MID_BAKE_LAB_PARAM,
  MID_BAKE_LAB_STOCK_PARAM,
  midBakeLabOptedIn,
  resetMidBakeLabForTest,
  resolveMidBakeLabHoldMs,
  resolveMidBakeLabOptIn,
  resolveMidBakeLabStock,
} from "./midBakeLab";

afterEach(() => resetMidBakeLabForTest());

describe("MID_BAKE Lab entry (?cookMidBakeHv=1)", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect(MID_BAKE_LAB_PARAM).toBe("cookMidBakeHv");
    expect(MID_BAKE_LAB_MARK).toBe("mid-bake-lab-v1");
    expect(MID_BAKE_LAB_HOLD_MS_PARAM).toBe("cookMidBakeHoldMs");
    expect(MID_BAKE_LAB_STOCK_PARAM).toBe("cookMidBakeStock");
  });

  it("is asked for exactly once with the value 1", () => {
    expect(resolveMidBakeLabOptIn("?cookMidBakeHv=1")).toBe(true);
    expect(resolveMidBakeLabOptIn("?x=1&cookMidBakeHv=1")).toBe(true);
    for (const q of ["", "?cookMidBakeHv=0", "?cookMidBakeHv=on", "?cookMidBakeHv=", "?cookMidBakeHv=1&cookMidBakeHv=1", "?cookMidBake=1"]) {
      expect(resolveMidBakeLabOptIn(q), q).toBe(false);
    }
    expect(resolveMidBakeLabOptIn(undefined)).toBe(false);
    expect(resolveMidBakeLabOptIn(null)).toBe(false);
    expect(resolveMidBakeLabOptIn(1)).toBe(false);
  });

  it("stands aside whenever another dev / HV entry that seeds or swaps the save is asked for", () => {
    for (const other of ["hv=calabresa-key-free", "cookPrepHv=1", "cookSearHv=1", "cookSteamHv=1", "inspector=discovery", "dev=state", "dev=postlayer", "drizzleLab=on"]) {
      expect(resolveMidBakeLabOptIn(`?cookMidBakeHv=1&${other}`), other).toBe(false);
    }
  });

  it("the optional hold timeout accepts only a single integer in range (a PROVISIONAL Lab knob)", () => {
    expect(resolveMidBakeLabHoldMs("?cookMidBakeHoldMs=500")).toBe(500);
    expect(resolveMidBakeLabHoldMs("?cookMidBakeHoldMs=100")).toBe(100);
    expect(resolveMidBakeLabHoldMs("?cookMidBakeHoldMs=60000")).toBe(60000);
    for (const q of ["", "?cookMidBakeHoldMs=99", "?cookMidBakeHoldMs=60001", "?cookMidBakeHoldMs=1.5", "?cookMidBakeHoldMs=-5", "?cookMidBakeHoldMs=abc", "?cookMidBakeHoldMs=5&cookMidBakeHoldMs=6"]) {
      expect(resolveMidBakeLabHoldMs(q), q).toBeNull();
    }
    expect(resolveMidBakeLabHoldMs(undefined)).toBeNull();
  });

  it("the optional stand-in stock is 1..9 and falls back to the default", () => {
    expect(resolveMidBakeLabStock("?cookMidBakeStock=1")).toBe(1);
    expect(resolveMidBakeLabStock("?cookMidBakeStock=9")).toBe(9);
    for (const q of ["", "?cookMidBakeStock=0", "?cookMidBakeStock=10", "?cookMidBakeStock=x", "?cookMidBakeStock=2&cookMidBakeStock=3"]) {
      expect(resolveMidBakeLabStock(q), q).toBe(MID_BAKE_LAB_DEFAULT_STOCK);
    }
  });

  it("is read once per page load and follows the current query in a DEV build", () => {
    window.history.replaceState({}, "", "/?cookMidBakeHv=1");
    expect(midBakeLabOptedIn()).toBe(true);
    window.history.replaceState({}, "", "/");
    expect(midBakeLabOptedIn()).toBe(true); // cached for the page load
    resetMidBakeLabForTest();
    expect(midBakeLabOptedIn()).toBe(false);
  });
});
