import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAVE_STORAGE_KEY, loadSave, type StorageLike } from "../state/persistence";
import { SEAR_FULL_MS } from "../logic/sear/searHold";
import { CookSearHvStarter } from "./CookSearHvStarter";
import { COOK_SEAR_HV_MARK, COOK_SEAR_HV_PARAM, activateCookSearHv, resetCookSearHvForTest, resolveCookSearHv } from "./cookSearHv";
import { resetSearMsForTest, resetSearPreviewForTest, searFullMsOverride, searPreviewOptedIn } from "./searPreview";

function fakeWindow(search: string, realStorage: StorageLike) {
  const dataset: Record<string, string | undefined> = {};
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
  resetCookSearHvForTest();
  resetSearPreviewForTest();
  resetSearMsForTest();
  window.sessionStorage.clear();
});

describe("Cooking Sear HV entry (?cookSearHv=1)", () => {
  it("is asked for exactly once with the value 1 (the names are what the Owner types)", () => {
    expect(COOK_SEAR_HV_PARAM).toBe("cookSearHv");
    expect(resolveCookSearHv("?cookSearHv=1")).toBe(true);
    for (const q of ["", "?cookSearHv=0", "?cookSearHv=on", "?cookSearHv=1&cookSearHv=1", "?cookSear=on", "?cookPrepHv=1"]) expect(resolveCookSearHv(q)).toBe(false);
    expect(resolveCookSearHv(undefined)).toBe(false);
  });

  it("without the param nothing changes and the sear stays off", () => {
    const real = recordingStorage();
    const { win, dataset } = fakeWindow("?x=1", real);
    expect(activateCookSearHv(win)).toBe(false);
    expect(win.localStorage).toBe(real);
    expect(dataset.cookSearHv).toBeUndefined();
    expect(searPreviewOptedIn()).toBe(false);
  });

  it("swaps in a disposable, well-stocked save, turns the sear on at the 3 s default, and never touches the real storage", () => {
    const real = recordingStorage();
    const { win, dataset } = fakeWindow("?cookSearHv=1", real);
    expect(activateCookSearHv(win)).toBe(true);
    expect(win.localStorage).not.toBe(real);
    expect(dataset.cookSearHv).toBe(COOK_SEAR_HV_MARK);
    expect(real.writes).toBe(0);
    expect(real.getItem(SAVE_STORAGE_KEY)).toBe("REAL-SAVE");
    const disposable = loadSave(win.localStorage as StorageLike);
    expect(disposable.ownedIngredientIds).toContain("sausage");
    expect(disposable.inventory.sausage).toBeGreaterThanOrEqual(3);
    expect(searPreviewOptedIn()).toBe(true);
    expect(searFullMsOverride()).toBeNull();
    expect(SEAR_FULL_MS).toBe(3000);
    // the tab memory (?cookSear=on) is not written by the entry
    expect(window.sessionStorage.getItem("teto:cookSear")).toBeNull();
  });

  it("does not turn on when ?cookPrepHv=1 is also given (the 炒める entry wins)", () => {
    const real = recordingStorage();
    const { win, dataset } = fakeWindow("?cookSearHv=1&cookPrepHv=1", real);
    expect(activateCookSearHv(win)).toBe(false);
    expect(win.localStorage).toBe(real);
    expect(dataset.cookSearHv).toBeUndefined();
    expect(searPreviewOptedIn()).toBe(false);
  });

  it("fails closed when the storage cannot be replaced: no marker, sear off, the real storage untouched", () => {
    const real = recordingStorage();
    const { win, dataset } = fakeWindow("?cookSearHv=1", real);
    Object.defineProperty(win, "localStorage", { value: real, configurable: false });
    expect(activateCookSearHv(win)).toBe(false);
    expect(real.writes).toBe(0);
    expect(dataset.cookSearHv).toBeUndefined();
    expect(searPreviewOptedIn()).toBe(false);
  });

  it("the starter walks the real actions once (sauce and cheese really applied), then selects the sausage at TOPPING; inactive it does nothing", async () => {
    const dispatch = vi.fn();
    const setScreen = vi.fn();
    const select = vi.fn();
    const idle = render(<CookSearHvStarter state={{ phase: "HOME", makingStep: "DOUGH" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    expect(dispatch).not.toHaveBeenCalled();
    idle.unmount();

    const { win } = fakeWindow("?cookSearHv=1", recordingStorage());
    expect(activateCookSearHv(win)).toBe(true);
    const view = render(<CookSearHvStarter state={{ phase: "PREPARE", makingStep: "DOUGH" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    const types = dispatch.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types.slice(0, 5)).toEqual(["START_FREE_COOK", "COMMIT_DOUGH_STRETCH", "CONFIRM_MAKING_STEP", "COMMIT_SAUCE_DISPENSE", "CONFIRM_MAKING_STEP"]);
    expect(types.slice(5, -1).every((t) => t === "PLACE_TOPPING") && types.length > 6).toBe(true);
    expect(types[types.length - 1]).toBe("CONFIRM_MAKING_STEP");
    expect(setScreen).toHaveBeenCalledWith("GAME");
    expect(select).not.toHaveBeenCalled();
    const calls = dispatch.mock.calls.length;
    view.rerender(<CookSearHvStarter state={{ phase: "PREPARE", makingStep: "TOPPING" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    await vi.waitFor(() => expect(select).toHaveBeenCalledWith("sausage"));
    view.rerender(<CookSearHvStarter state={{ phase: "PREPARE", makingStep: "TOPPING" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    expect(dispatch).toHaveBeenCalledTimes(calls);
    expect(select).toHaveBeenCalledTimes(1);
  });
});
