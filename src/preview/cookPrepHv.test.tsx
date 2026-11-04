import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SAVE_STORAGE_KEY, loadSave, type StorageLike } from "../state/persistence";
import { CookPrepHvStarter } from "./CookPrepHvStarter";
import { COOK_PREP_HV_MARK, COOK_PREP_HV_PARAM, activateCookPrepHv, resetCookPrepHvForTest, resolveCookPrepHv } from "./cookPrepHv";

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

describe("Cooking Prep HV entry", () => {
  it("is asked for exactly once with the value 1", () => {
    expect(COOK_PREP_HV_PARAM).toBe("cookPrepHv");
    expect(resolveCookPrepHv("?cookPrepHv=1")).toBe(true);
    for (const q of ["", "?cookPrepHv=0", "?cookPrepHv=on", "?cookPrepHv=1&cookPrepHv=1", "?x=1"]) expect(resolveCookPrepHv(q)).toBe(false);
    expect(resolveCookPrepHv(undefined)).toBe(false);
  });

  it("without the param nothing changes", () => {
    resetCookPrepHvForTest();
    const real = recordingStorage();
    const { win, dataset } = fakeWindow("?cookPrep=on", real);
    expect(activateCookPrepHv(win)).toBe(false);
    expect(win.localStorage).toBe(real);
    expect(dataset.cookPrepHv).toBeUndefined();
  });

  it("swaps in a disposable save with the beef owned and never touches the real storage", () => {
    resetCookPrepHvForTest();
    const real = recordingStorage();
    const { win, dataset } = fakeWindow("?cookPrepHv=1&cookPrep=on", real);
    expect(activateCookPrepHv(win)).toBe(true);
    expect(win.localStorage).not.toBe(real);
    expect(dataset.cookPrepHv).toBe(COOK_PREP_HV_MARK);
    expect(real.writes).toBe(0);
    expect(real.getItem(SAVE_STORAGE_KEY)).toBe("REAL-SAVE");
    const disposable = loadSave(win.localStorage as StorageLike);
    expect(disposable.ownedIngredientIds).toContain("beef");
    expect(disposable.inventory.beef).toBeGreaterThan(0);
  });

  it("fails closed when the storage cannot be replaced: no marker, the real storage untouched", () => {
    resetCookPrepHvForTest();
    const real = recordingStorage();
    const { win, dataset } = fakeWindow("?cookPrepHv=1", real);
    Object.defineProperty(win, "localStorage", { value: real, configurable: false });
    expect(activateCookPrepHv(win)).toBe(false);
    expect(win.localStorage).toBe(real);
    expect(real.writes).toBe(0);
    expect(dataset.cookPrepHv).toBeUndefined();
  });

  it("the starter walks the real actions once, then selects the beef at TOPPING; inactive it does nothing", async () => {
    resetCookPrepHvForTest();
    const dispatch = vi.fn();
    const setScreen = vi.fn();
    const select = vi.fn();
    const idle = render(<CookPrepHvStarter state={{ phase: "HOME", makingStep: "DOUGH" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    expect(dispatch).not.toHaveBeenCalled();
    idle.unmount();

    const { win } = fakeWindow("?cookPrepHv=1", recordingStorage());
    expect(activateCookPrepHv(win)).toBe(true);
    const view = render(<CookPrepHvStarter state={{ phase: "PREPARE", makingStep: "DOUGH" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    expect(dispatch.mock.calls.map((c) => (c[0] as { type: string }).type)).toEqual(["START_FREE_COOK", "COMMIT_DOUGH_STRETCH", "CONFIRM_MAKING_STEP", "CONFIRM_MAKING_STEP", "CONFIRM_MAKING_STEP"]);
    expect(setScreen).toHaveBeenCalledWith("GAME");
    expect(select).not.toHaveBeenCalled();
    view.rerender(<CookPrepHvStarter state={{ phase: "PREPARE", makingStep: "TOPPING" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    await vi.waitFor(() => expect(select).toHaveBeenCalledWith("beef"));
    view.rerender(<CookPrepHvStarter state={{ phase: "PREPARE", makingStep: "TOPPING" } as never} dispatch={dispatch} setScreen={setScreen} setSelectedIngredientId={select} />);
    expect(dispatch).toHaveBeenCalledTimes(5);
    expect(select).toHaveBeenCalledTimes(1);
  });
});
