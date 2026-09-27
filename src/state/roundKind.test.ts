import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { EMPTY_DEX, type DexEntry } from "./dex";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import {
  completionPolicyForRound,
  isDinnerRound,
  isFreeCookingRound,
  isGuidedRound,
  isLunchRushRound,
  registersToDexAtResult,
  roundKindFor,
  type RoundKind,
} from "./roundKind";

/** Dinner Mission DM-2 (Issue #239): the explicit round authority and its agreement with the
 *  flags Lunch Rush / Free Cooking already read. */

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const FULL = Object.fromEntries(FINITE_IDS.map((id) => [id, 99]));

function dexOf(ids: readonly string[]): DexEntry[] {
  return ids.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
}

function expectConsistent(state: GameState, label: string) {
  expect(state.isMissionRound, `${label}: isMissionRound`).toBe(state.roundKind === "LUNCH_RUSH");
  expect(state.freeCook, `${label}: freeCook`).toBe(state.roundKind === "FREE_COOK");
  expect(state.dinner !== null, `${label}: dinner`).toBe(state.roundKind === "DINNER");
}

describe("round kind predicates", () => {
  it.each([
    ["GUIDED", [false, false, false, true], "recipe", true],
    ["FREE_COOK", [false, false, true, false], "recipe", true],
    ["LUNCH_RUSH", [false, true, false, false], "order", false],
    ["DINNER", [true, false, false, false], "order", false],
  ] as const)("%s", (kind, flags, policy, registers) => {
    const s = { roundKind: kind as RoundKind };
    expect([isDinnerRound(s), isLunchRushRound(s), isFreeCookingRound(s), isGuidedRound(s)]).toEqual(flags);
    expect(completionPolicyForRound(s)).toBe(policy);
    expect(registersToDexAtResult(s)).toBe(registers);
  });

  it("roundKindFor maps the legacy (isMissionRound, freeCook) pair", () => {
    expect(roundKindFor(true, false)).toBe("LUNCH_RUSH");
    expect(roundKindFor(false, true)).toBe("FREE_COOK");
    expect(roundKindFor(false, false)).toBe("GUIDED");
  });
});

describe("every existing round path sets a kind that agrees with its flags", () => {
  it("initial states, guided / free-cook / Lunch Rush rounds and a Dinner run", () => {
    const dex0 = createInitialGameState(EMPTY_DEX, ALL_IDS, 0, FULL);
    expect(dex0.roundKind).toBe("FREE_COOK"); // Dex 0 starts on Free Cooking
    const base = createInitialGameState(dexOf(["margherita", "bismarck", "breakfast-pizza", "funghi"]), ALL_IDS, 100, FULL, [], FINITE_IDS);
    expect(base.roundKind).toBe("GUIDED");
    const actions: [string, GameAction][] = [
      ["PLAY_AGAIN", { type: "PLAY_AGAIN" }],
      ["SELECT_RECIPE", { type: "SELECT_RECIPE", recipeId: "funghi", now: 1 }],
      ["START_FREE_COOK", { type: "START_FREE_COOK", now: 1 }],
      ["MISSION_RESET_ORDER", { type: "MISSION_RESET_ORDER" }],
      ["DINNER_START", { type: "DINNER_START", missionId: "dm-a", now: 1, durationMs: 60_000 }],
    ];
    for (const s of [dex0, base]) expectConsistent(s, "initial");
    for (const [label, action] of actions) {
      const next = gameReducer(base, action);
      expectConsistent(next, label);
      // and again from the resulting round
      for (const [label2, action2] of actions) expectConsistent(gameReducer(next, action2), `${label} -> ${label2}`);
    }
  });
});
