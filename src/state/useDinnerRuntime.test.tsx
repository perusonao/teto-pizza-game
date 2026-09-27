import { act, renderHook } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import type { DexEntry } from "./dex";
import { createInitialGameState, gameReducer } from "./gameReducer";
import { DINNER_TICK_MS, useDinnerRuntime } from "./useDinnerRuntime";

/** Dinner Mission DM-2/DM-3/DM-3R-2 (Issues #239, #242, #250): the App-side runtime against the real reducer. */

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const DEX: DexEntry[] = ["margherita", "bismarck", "breakfast-pizza", "funghi"].map((recipeId) => ({
  recipeId,
  discovered: true,
  bestScore: 70,
  bestStars: 3,
  timesMade: 1,
}));
const T0 = 1_000_000;

function setup() {
  return renderHook(() => {
    const [state, dispatch] = useReducer(gameReducer, undefined, () =>
      createInitialGameState(DEX, ALL_IDS, 100, { egg: 2, bacon: 3, mushroom: 3 }, [], FINITE_IDS, {}),
    );
    const runtime = useDinnerRuntime(state, dispatch);
    return { state, dispatch, runtime };
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe("useDinnerRuntime", () => {
  it("starts a run with the given duration and a display clock", () => {
    const { result } = setup();
    act(() => result.current.runtime.startDinner("dm-a", 30_000, 3));
    expect(result.current.runtime).toMatchObject({ active: true, playing: true, now: T0 });
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.runtime.now).toBeGreaterThanOrEqual(T0 + 1_000);
  });

  it("18: the wall-clock TICK ends the run with TIME_UP and then stops ticking", () => {
    const { result } = setup();
    act(() => result.current.runtime.startDinner("dm-a", 2_000, 3));
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.state.dinner!.run.status).toBe("PLAYING");
    act(() => vi.advanceTimersByTime(1_000 + DINNER_TICK_MS));
    expect(result.current.state.dinner!.run.outcome).toMatchObject({ kind: "FAILED", reason: "TIME_UP" });
    expect(result.current.runtime.playing).toBe(false);
    const after = result.current.state;
    act(() => vi.advanceTimersByTime(DINNER_TICK_MS * 8));
    expect(result.current.state).toBe(after);
  });

  it("16/20: HOME on a PLAYING run raises the in-app confirmation; 続ける keeps the run going", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const { result } = setup();
    act(() => result.current.runtime.startDinner("dm-a", 60_000, 3));
    let goHome = true;
    act(() => {
      goHome = result.current.runtime.requestLeave();
    });
    expect(goHome).toBe(false);
    expect(result.current.state.dinner).toMatchObject({ abandonRequested: true, run: { status: "PLAYING" } });
    act(() => result.current.runtime.cancelLeave());
    expect(result.current.state.dinner).toMatchObject({ abandonRequested: false, run: { status: "PLAYING" } });
    expect(confirmSpy).not.toHaveBeenCalled(); // no browser confirm any more
    confirmSpy.mockRestore();
  });

  it("HOME dialog open: the clock keeps running (display and deadline); 続ける returns to the same cooking state", () => {
    const { result } = setup();
    act(() => result.current.runtime.startDinner("dm-a", 5_000, 3));
    const before = result.current.state;
    act(() => {
      result.current.runtime.requestLeave();
    });
    const shownAt = result.current.runtime.now;
    act(() => vi.advanceTimersByTime(2_000));
    // The display clock moved while the dialog stayed up, and the run is still the same pizza.
    expect(result.current.runtime.now).toBeGreaterThanOrEqual(shownAt + 2_000);
    expect(result.current.state.dinner).toMatchObject({ abandonRequested: true, run: { status: "PLAYING" } });
    act(() => result.current.runtime.cancelLeave());
    expect(result.current.state.phase).toBe(before.phase);
    expect(result.current.state.pizza).toBe(before.pizza);
    expect(result.current.state.makingStep).toBe(before.makingStep);
    // The dialog never pauses the deadline: left open past it, the run ends TIME_UP.
    act(() => {
      result.current.runtime.requestLeave();
    });
    act(() => vi.advanceTimersByTime(3_000 + DINNER_TICK_MS));
    expect(result.current.state.dinner!.run.outcome).toMatchObject({ kind: "FAILED", reason: "TIME_UP" });
  });

  it("17/21: やめる -> ABANDONED and exited, no Pitz change", () => {
    const { result } = setup();
    act(() => result.current.runtime.startDinner("dm-a", 60_000, 3));
    act(() => {
      result.current.runtime.requestLeave();
    });
    act(() => result.current.runtime.confirmLeave());
    expect(result.current.state.dinner).toBeNull();
    expect(result.current.state.roundKind).not.toBe("DINNER");
    expect(result.current.state.pitzBalance).toBe(100);
  });

  it("a finished run leaves without asking; no session means nothing to confirm", () => {
    const { result } = setup();
    expect(result.current.runtime.requestLeave()).toBe(true);
    act(() => result.current.runtime.startDinner("dm-a", 1_000, 3));
    act(() => vi.advanceTimersByTime(2_000));
    let goHome = false;
    act(() => {
      goHome = result.current.runtime.requestLeave();
    });
    expect(goHome).toBe(true);
    expect(result.current.state.dinner).toBeNull();
  });

  it("37: the Dinner clock never touches the Lunch Rush state", () => {
    const { result } = setup();
    act(() => result.current.runtime.startDinner("dm-a", 60_000, 3));
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.state.isMissionRound).toBe(false);
    expect(result.current.state.lastClaimedMissionRunId).toBeNull();
    expect(result.current.state.missionSoldOutRecipeIds).toEqual([]);
  });
});
