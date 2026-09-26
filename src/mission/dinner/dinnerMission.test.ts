import { describe, expect, it } from "vitest";
import { getRecipe } from "../../data/recipes";
import { packQuantity } from "../../logic/materialShop";
import type { DexEntry, DexState } from "../../state/dex";
import { aggregateFiniteNeed } from "../../state/recipeSetFeasibility";
import {
  DINNER_MISSIONS,
  dinnerMissionUnlock,
  getDinnerMission,
  isDinnerMissionUnlocked,
  resolveDinnerTargets,
  validateDinnerMissions,
  type DinnerMissionDefinition,
} from "./dinnerMission";

function dexOf(ids: readonly string[]): DexState {
  return Object.freeze(
    ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  );
}

const DM_A = getDinnerMission("dm-a")!;
const DM_B = getDinnerMission("dm-b")!;

function mission(patch: Partial<DinnerMissionDefinition>): DinnerMissionDefinition {
  return { ...DM_A, ...patch };
}

describe("Phase 1 definitions (OD-DM-13)", () => {
  it("the shipped list is valid", () => {
    expect(validateDinnerMissions(DINNER_MISSIONS)).toEqual([]);
    expect(DINNER_MISSIONS.map((m) => m.missionId)).toEqual(["dm-a", "dm-b"]);
  });

  it("DM-A / DM-B targets are the Fresh Design §9 sets", () => {
    expect(DM_A.targetRecipeIds).toEqual(["margherita", "bismarck", "breakfast-pizza", "funghi"]);
    expect(DM_B.targetRecipeIds).toEqual(["margherita", "funghi", "melanzane-pizza", "parmigiana-pizza"]);
  });

  it("aggregated needs derive from RECIPES and match the Fresh Design numbers", () => {
    expect(aggregateFiniteNeed(resolveDinnerTargets(DM_A)!)).toEqual({ egg: 2, bacon: 3, mushroom: 3 });
    expect(aggregateFiniteNeed(resolveDinnerTargets(DM_B)!)).toEqual({ mushroom: 3, eggplant: 6, parmigiano: 2 });
  });

  it("every shipped mission can be completed from one Shop pack of each finite material", () => {
    for (const m of DINNER_MISSIONS) {
      for (const [ingredientId, need] of Object.entries(aggregateFiniteNeed(resolveDinnerTargets(m)!))) {
        expect(need, `${m.missionId} ${ingredientId}`).toBeLessThanOrEqual(packQuantity(ingredientId));
      }
    }
  });

  it("time limits and reward amounts are untuned until DM-5", () => {
    for (const m of DINNER_MISSIONS) {
      expect(m.timeLimit.seconds).toBeNull();
      expect(m.reward.tableId).toBe("dinner-phase1-untuned");
    }
  });
});

describe("validateDinnerMissions", () => {
  it("rejects an unknown target, a duplicate target and a wrong target count", () => {
    expect(validateDinnerMissions([mission({ targetRecipeIds: ["margherita", "nope" as never] })])).toContain(
      "mission dm-a: unknown target nope",
    );
    expect(validateDinnerMissions([mission({ targetRecipeIds: ["bismarck", "bismarck"] })])).toContain(
      "mission dm-a: duplicate target",
    );
    expect(validateDinnerMissions([mission({ targetRecipeIds: ["bismarck"] })])).toContain(
      "mission dm-a: needs 2..6 targets",
    );
  });

  it("rejects a title naming any recipe (it would leak an undiscovered target)", () => {
    const problems = validateDinnerMissions([mission({ display: { ...DM_A.display, titleJa: "ビスマルクの夜" } })]);
    expect(problems).toContain("mission dm-a: title names recipe bismarck");
  });

  it("rejects duplicate ids / orders, a bad time limit and an unknown reward table", () => {
    expect(validateDinnerMissions([DM_A, DM_A])).toEqual(
      expect.arrayContaining(["mission dm-a: duplicate missionId", "mission dm-a: duplicate display order"]),
    );
    expect(validateDinnerMissions([mission({ timeLimit: { seconds: 0 } })])).toContain(
      "mission dm-a: time limit must be a positive integer or null",
    );
    expect(validateDinnerMissions([mission({ timeLimit: { seconds: 240 } })])).toEqual([]);
    expect(validateDinnerMissions([mission({ reward: { tableId: "x" } })])).toContain(
      "mission dm-a: unknown reward table x",
    );
  });
});

describe("derived unlock (OD-DM-12)", () => {
  it("locked with nothing discovered; the view names no undiscovered target", () => {
    const view = dinnerMissionUnlock(DM_A, dexOf([]));
    expect(view).toEqual({
      missionId: "dm-a",
      unlocked: false,
      totalTargets: 4,
      discoveredTargetIds: [],
      undiscoveredCount: 4,
    });
  });

  it("3 of 4 discovered: 'あと 1 種類', and the missing target's identity is nowhere in the view", () => {
    const view = dinnerMissionUnlock(DM_A, dexOf(["margherita", "bismarck", "funghi"]));
    expect(view.unlocked).toBe(false);
    expect(view.undiscoveredCount).toBe(1);
    const serialized = JSON.stringify(view);
    const hidden = getRecipe("breakfast-pizza")!;
    for (const secret of [hidden.id, hidden.nameJa, hidden.description]) expect(serialized).not.toContain(secret);
  });

  it("discovering the last target unlocks; other discoveries do not matter", () => {
    const before = dexOf(["margherita", "bismarck", "funghi", "melanzane-pizza"]);
    expect(isDinnerMissionUnlocked(DM_A, before)).toBe(false);
    expect(isDinnerMissionUnlocked(DM_A, dexOf(["margherita", "bismarck", "funghi", "breakfast-pizza"]))).toBe(true);
    expect(isDinnerMissionUnlocked(DM_B, before)).toBe(false);
  });

  it("an undiscovered Dex entry (discovered: false) does not count", () => {
    const dex: DexState = [
      ...dexOf(["margherita", "funghi", "melanzane-pizza"]),
      { recipeId: "parmigiana-pizza", discovered: false, bestScore: 0, bestStars: 1, timesMade: 0 },
    ];
    expect(isDinnerMissionUnlocked(DM_B, dex)).toBe(false);
  });

  it("is derived only: the (frozen) Dex is read, never written", () => {
    const dex = dexOf(["margherita", "bismarck", "funghi", "breakfast-pizza"]);
    const snapshot = JSON.stringify(dex);
    dinnerMissionUnlock(DM_A, dex);
    expect(JSON.stringify(dex)).toBe(snapshot);
  });
});
