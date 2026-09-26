import { act, renderHook } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import type { DexEntry } from "./dex";
import { createInitialGameState, gameReducer } from "./gameReducer";
import { DINNER_ABANDON_CONFIRM_MESSAGE, DINNER_TICK_MS, useDinnerRuntime } from "./useDinnerRuntime";

/** Dinner Mission DM-2 (Issue #239): the App-side runtime against the real reducer. */

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
  it("starts a run only with an injected duration (no production time limit yet)", () => {
    const { result } = setup();
    act(() => result.current.runtime.startDinner("dm-a"));
    expect(result.current.state.dinner).toBeNull();
    act(() => result.current.runtime.startDinner("dm-a", 30_000));
    expect(result.current.runtime).toMatchObject({ active: true, playing: true });
  });

  it("18: the wall-clock TICK ends the run with TIME_UP and then stops ticking", () => {
    const { result } = setup();
    act(() => result.current.runtime.startDinner("dm-a", 2_000));
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.state.dinner!.run.status).toBe("PLAYING");
    act(() => vi.advanceTimersByTime(1_000 + DINNER_TICK_MS));
    expect(result.current.state.dinner!.run.outcome).toMatchObject({ kind: "FAILED", reason: "TIME_UP" });
    expect(result.current.runtime.playing).toBe(false);
    const after = result.current.state;
    act(() => vi.advanceTimersByTime(DINNER_TICK_MS * 8));
    expect(result.current.state).toBe(after);
  });

  it("20: HOME cancelled -> the run continues, no abandon pending", () => {
    const { result } = setup();
    act(() => result.current.runtime.startDinner("dm-a", 60_000));
    const confirm = vi.fn(() => false);
    let goHome = true;
    act(() => {
      goHome = result.current.runtime.leaveDinner(confirm);
    });
    expect(confirm).toHaveBeenCalledWith(DINNER_ABANDON_CONFIRM_MESSAGE);
    expect(goHome).toBe(false);
    expect(result.current.state.dinner).toMatchObject({ abandonRequested: false, run: { status: "PLAYING" } });
  });

  it("21: HOME confirmed -> ABANDONED, exited, no Pitz change", () => {
    const { result } = setup();
    act(() => result.current.runtime.startDinner("dm-a", 60_000));
    let goHome = false;
    act(() => {
      goHome = result.current.runtime.leaveDinner(() => true);
    });
    expect(goHome).toBe(true);
    expect(result.current.state.dinner).toBeNull();
    expect(result.current.state.roundKind).not.toBe("DINNER");
    expect(result.current.state.pitzBalance).toBe(100);
  });

  it("a finished run leaves without asking; no session means nothing to confirm", () => {
    const { result } = setup();
    const confirm = vi.fn(() => true);
    expect(result.current.runtime.leaveDinner(confirm)).toBe(true);
    act(() => result.current.runtime.startDinner("dm-a", 1_000));
    act(() => vi.advanceTimersByTime(2_000));
    act(() => {
      result.current.runtime.leaveDinner(confirm);
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(result.current.state.dinner).toBeNull();
  });

  it("37: the Dinner clock never touches the Lunch Rush state", () => {
    const { result } = setup();
    act(() => result.current.runtime.startDinner("dm-a", 60_000));
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.state.isMissionRound).toBe(false);
    expect(result.current.state.lastClaimedMissionRunId).toBeNull();
    expect(result.current.state.missionSoldOutRecipeIds).toEqual([]);
  });
});
