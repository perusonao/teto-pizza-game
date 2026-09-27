import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { getDinnerMission } from "../mission/dinner/dinnerMission";
import { startDinnerRun } from "../mission/dinner/dinnerRun";
import type { DexEntry } from "./dex";
import {
  dinnerBoardRows,
  dinnerMissionCardView,
  dinnerReadiness,
  formatDinnerClock,
  resolveDinnerDurationMs,
} from "./dinnerView";

/** Dinner Mission DM-3 (Issue #242): the pure view models behind the Dinner screens. */

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const DM_A = getDinnerMission("dm-a")!;
const DM_B = getDinnerMission("dm-b")!;
const DM_A_IDS = ["margherita", "bismarck", "breakfast-pizza", "funghi"];
const dexOf = (ids: readonly string[]): DexEntry[] =>
  ids.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));

describe("resolveDinnerDurationMs (OD-DM3-1)", () => {
  it("production (no override search) has no duration while the time limit is untuned", () => {
    expect(resolveDinnerDurationMs(DM_A, "")).toBeNull();
    expect(resolveDinnerDurationMs(DM_A, "?missionDuration=30")).toBeNull();
  });

  it("DEV / Preview may inject ?dinnerDuration=<seconds>", () => {
    expect(resolveDinnerDurationMs(DM_A, "?dinnerDuration=300")).toBe(300_000);
    // 0.0001 s rounds to 0 ms and 1e306 s overflows to Infinity ms: neither may enable START.
    for (const bad of ["?dinnerDuration=0", "?dinnerDuration=-5", "?dinnerDuration=abc", "?dinnerDuration=", "?dinnerDuration=0.0001", "?dinnerDuration=1e306"]) {
      expect(resolveDinnerDurationMs(DM_A, bad), bad).toBeNull();
    }
  });

  it("a mission's own time limit (from DM-5 on) wins over any override", () => {
    expect(resolveDinnerDurationMs({ ...DM_A, timeLimit: { seconds: 240 } }, "?dinnerDuration=5")).toBe(240_000);
  });
});

describe("formatDinnerClock", () => {
  it.each([
    [0, "00:00"],
    [-500, "00:00"],
    [1, "00:01"],
    [59_001, "01:00"],
    [134_000, "02:14"],
    [Number.NaN, "00:00"],
  ])("%d ms -> %s", (ms, text) => expect(formatDinnerClock(ms)).toBe(text));
});

describe("dinnerMissionCardView (privacy)", () => {
  it("a locked card carries counts only -- no target ids or names, discovered or not", () => {
    const card = dinnerMissionCardView(DM_B, dexOf(["margherita", "funghi"]));
    expect(card).toEqual({ missionId: "dm-b", titleJa: "ディナーミッション 2", totalTargets: 4, unlocked: false, undiscoveredCount: 2 });
    const json = JSON.stringify(card);
    for (const r of RECIPES) {
      expect(json, r.id).not.toContain(r.id);
      expect(json, r.id).not.toContain(r.nameJa);
    }
  });

  it("an unlocked card lists its targets by name", () => {
    const card = dinnerMissionCardView(DM_A, dexOf(DM_A_IDS));
    expect(card).toMatchObject({ unlocked: true });
    expect(card.unlocked && card.targets.map((t) => t.nameJa)).toEqual([
      "マルゲリータ",
      "ビスマルク",
      "ブレックファストピザ",
      "フンギ",
    ]);
  });
});

describe("dinnerReadiness", () => {
  const inputs = (inventory: Record<string, number>) => ({ dex: dexOf(DM_A_IDS), ownedIngredientIds: ALL_IDS, inventory });

  it("READY with the duration, SHORTAGE with need / have, NO_TIME_LIMIT without a duration", () => {
    expect(dinnerReadiness(DM_A, inputs({ egg: 2, bacon: 3, mushroom: 3 }), 60_000)).toEqual({ kind: "READY", durationMs: 60_000 });
    expect(dinnerReadiness(DM_A, inputs({ egg: 1, bacon: 3, mushroom: 3 }), 60_000)).toEqual({
      kind: "SHORTAGE",
      shortages: [{ ingredientId: "egg", nameJa: "たまご", need: 2, have: 1 }],
    });
    expect(dinnerReadiness(DM_A, inputs({ egg: 2, bacon: 3, mushroom: 3 }), null)).toEqual({ kind: "NO_TIME_LIMIT" });
  });

  it("a shortage is reported even without a duration (the player can still go refill)", () => {
    expect(dinnerReadiness(DM_A, inputs({}), null).kind).toBe("SHORTAGE");
  });
});

describe("dinnerBoardRows", () => {
  it("lists every target in definition order with its completion", () => {
    const started = startDinnerRun(DM_A, { dex: dexOf(DM_A_IDS), ownedIngredientIds: ALL_IDS, inventory: { egg: 2, bacon: 3, mushroom: 3 } }, 0, 60_000);
    if (!started.ok) throw new Error("start");
    const run = { ...started.state, completedRecipeIds: ["funghi"] };
    expect(dinnerBoardRows(run).map((r) => [r.recipeId, r.completed])).toEqual([
      ["margherita", false],
      ["bismarck", false],
      ["breakfast-pizza", false],
      ["funghi", true],
    ]);
  });
});
