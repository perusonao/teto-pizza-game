import { describe, expect, it } from "vitest";
import {
  STEAM_GAME_LAB_MARK,
  STEAM_GAME_LAB_PARAM,
  fleshLook,
  resolveSteamGameLabOptIn,
  shellOpenness,
  steamGameLabOptedIn,
} from "./steamGameLab";

describe("steamGameLab opt-in (exactly once, value 'on')", () => {
  it.each([
    ["?steamGameLab=on", true],
    ["steamGameLab=on&x=1", true],
    ["?steamGameLab=1", false],
    ["?steamGameLab=ON", false],
    ["?steamGameLab=on&steamGameLab=on", false],
    ["?steamGameLab=", false],
    ["?cookSteamHv=1", false],
    ["", false],
  ])("%s -> %s", (search, want) => expect(resolveSteamGameLabOptIn(search)).toBe(want));
  it("non-string input is off", () => {
    for (const v of [undefined, null, 1, {}, ["?steamGameLab=on"]]) expect(resolveSteamGameLabOptIn(v)).toBe(false);
  });
  it("names are what the Owner types", () => {
    expect(STEAM_GAME_LAB_PARAM).toBe("steamGameLab");
    expect(STEAM_GAME_LAB_MARK).toBe("steam-game-lab-v1");
  });
  it("the page-load read is off without the query (jsdom location has none)", () => {
    expect(steamGameLabOptedIn()).toBe(false);
  });
});

describe("shellOpenness / fleshLook (display only)", () => {
  it("shells open one after another and never go outside 0..1", () => {
    expect(shellOpenness(0)).toEqual([0, 0, 0, 0, 0]);
    expect(shellOpenness(1)).toEqual([1, 1, 1, 1, 1]);
    const mid = shellOpenness(0.45);
    expect(mid[0]).toBe(1);
    expect(mid[1]).toBe(1);
    expect(mid[2]).toBeGreaterThan(0);
    expect(mid[2]).toBeLessThan(1);
    expect(mid[4]).toBe(0);
    for (const l of [Number.NaN, -3, 9, Infinity]) for (const o of shellOpenness(l)) expect(o >= 0 && o <= 1).toBe(true);
  });
  it("the flesh turns orange as steam builds and shrinks / browns when overcooked", () => {
    const raw = fleshLook(0, 0);
    const done = fleshLook(0.78, 0);
    const over = fleshLook(1, 1);
    expect(raw.color).not.toBe(done.color);
    expect(done.color).not.toBe(over.color);
    expect(done.scale).toBeGreaterThan(raw.scale);
    expect(over.scale).toBeLessThan(done.scale);
    expect(over.limp).toBe(1);
    expect(fleshLook(Number.NaN, Number.NaN).scale).toBeGreaterThan(0);
  });
});
