import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAVE_STORAGE_KEY, loadSave, type StorageLike } from "../state/persistence";
import { STEAM_LID_FULL_MS } from "../logic/steam/steamLid";
import { CookSteamHvStarter } from "./CookSteamHvStarter";
import { COOK_STEAM_HV_MARK, COOK_STEAM_HV_PARAM, activateCookSteamHv, resetCookSteamHvForTest, resolveCookSteamHv } from "./cookSteamHv";
import { resetSteamPreviewForTest, steamFullMsOverride, steamPreviewOptedIn, steamVariantChoice } from "./steamPreview";

function fakeWindow(search: string, realStorage: StorageLike, dataset: Record<string, string | undefined> = {}) {
  const win = { location: { search }, document: { documentElement: { dataset } }, localStorage: realStorage } as {
    location: { search: string };
    document: { documentElement: { dataset: Record<string, string | undefined> } };
    localStorage: StorageLike;
  };
  return { win, dataset };
}
function recordingStorage(): StorageLike & { writes: number } {
  const map = new Map<string, string>([[SAVE_STORAGE_KEY, "REAL-SAVE"]]);
  const s = { writes: 0, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { s.writes += 1; map.set(k, v); }, removeItem: (k: string) => { s.writes += 1; map.delete(k); } };
  return s;
}

beforeEach(() => {
  resetCookSteamHvForTest();
  resetSteamPreviewForTest();
  window.sessionStorage.clear();
});

describe("Cooking Steam HV entry (?cookSteamHv=1)", () => {
  it("is asked for exactly once with the value 1 (the names are what the Owner types)", () => {
    expect(COOK_STEAM_HV_PARAM).toBe("cookSteamHv");
    expect(resolveCookSteamHv("?cookSteamHv=1")).toBe(true);
    for (const q of ["", "?cookSteamHv=0", "?cookSteamHv=on", "?cookSteamHv=1&cookSteamHv=1", "?cookSteam=on"]) expect(resolveCookSteamHv(q)).toBe(false);
    expect(resolveCookSteamHv(undefined)).toBe(false);
  });

  it("without the param nothing changes and the steam stays off", () => {
    const real = recordingStorage();
    const { win, dataset } = fakeWindow("?x=1", real);
    expect(activateCookSteamHv(win)).toBe(false);
    expect(win.localStorage).toBe(real);
    expect(dataset.cookSteamHv).toBeUndefined();
    expect(steamPreviewOptedIn()).toBe(false);
  });

  it("swaps in a disposable, well-stocked save (clam AND mussel), turns the steam on with both operations, and never touches the real storage", () => {
    const real = recordingStorage();
    const { win, dataset } = fakeWindow("?cookSteamHv=1", real);
    expect(activateCookSteamHv(win)).toBe(true);
    expect(win.localStorage).not.toBe(real);
    expect(dataset.cookSteamHv).toBe(COOK_STEAM_HV_MARK);
    expect(real.writes).toBe(0);
    expect(real.getItem(SAVE_STORAGE_KEY)).toBe("REAL-SAVE");
    const disposable = loadSave(win.localStorage as StorageLike);
    for (const id of ["clam", "mussel"]) {
      expect(disposable.ownedIngredientIds).toContain(id);
      expect(disposable.inventory[id]).toBeGreaterThanOrEqual(3);
    }
    expect(steamPreviewOptedIn()).toBe(true);
    expect(steamVariantChoice()).toBe("both");
    expect(steamFullMsOverride()).toBeNull();
    expect(STEAM_LID_FULL_MS).toBe(4500);
    // the tab memory (?cookSteam=on) is not written by the entry
    expect(window.sessionStorage.getItem("teto:cookSteam")).toBeNull();
  });

  it("stands aside when another cooking HV entry has already taken the page (its mark is on <html>)", () => {
    for (const mark of ["cookPrepHv", "cookSearHv"]) {
      resetSteamPreviewForTest();
      const real = recordingStorage();
      const { win, dataset } = fakeWindow("?cookSteamHv=1", real, { [mark]: "x" });
      expect(activateCookSteamHv(win), mark).toBe(false);
      expect(win.localStorage).toBe(real);
      expect(dataset.cookSteamHv).toBeUndefined();
      expect(steamPreviewOptedIn()).toBe(false);
    }
  });

  it("fails closed when the storage cannot be replaced: no marker, steam off, the real storage untouched", () => {
    const real = recordingStorage();
    const { win, dataset } = fakeWindow("?cookSteamHv=1", real);
    Object.defineProperty(win, "localStorage", { value: real, configurable: false });
    expect(activateCookSteamHv(win)).toBe(false);
    expect(real.writes).toBe(0);
    expect(dataset.cookSteamHv).toBeUndefined();
    expect(steamPreviewOptedIn()).toBe(false);
  });

  it("the starter walks the real actions once (sauce and cheese really applied), then selects the clam at TOPPING; inactive it does nothing", async () => {
    const dispatch = vi.fn();
    const setScreen = vi.fn();
    const select = vi.fn();
    const idle = render(<CookSteamHvStarter state={{ phase: "HOME", makingStep: "DOUGH" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    expect(dispatch).not.toHaveBeenCalled();
    idle.unmount();

    const { win } = fakeWindow("?cookSteamHv=1", recordingStorage());
    expect(activateCookSteamHv(win)).toBe(true);
    const view = render(<CookSteamHvStarter state={{ phase: "PREPARE", makingStep: "DOUGH" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    const types = dispatch.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types.slice(0, 5)).toEqual(["START_FREE_COOK", "COMMIT_DOUGH_STRETCH", "CONFIRM_MAKING_STEP", "COMMIT_SAUCE_DISPENSE", "CONFIRM_MAKING_STEP"]);
    expect(types.slice(5, -1).every((t) => t === "PLACE_TOPPING") && types.length > 6).toBe(true);
    expect(types[types.length - 1]).toBe("CONFIRM_MAKING_STEP");
    expect(setScreen).toHaveBeenCalledWith("GAME");
    expect(select).not.toHaveBeenCalled();
    const calls = dispatch.mock.calls.length;
    view.rerender(<CookSteamHvStarter state={{ phase: "PREPARE", makingStep: "TOPPING" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    await vi.waitFor(() => expect(select).toHaveBeenCalledWith("clam"));
    view.rerender(<CookSteamHvStarter state={{ phase: "PREPARE", makingStep: "TOPPING" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    expect(dispatch).toHaveBeenCalledTimes(calls);
    expect(select).toHaveBeenCalledTimes(1);
  });
});
