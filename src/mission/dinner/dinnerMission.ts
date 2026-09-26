import { getRecipe, RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { isDiscovered, type DexState } from "../../state/dex";
import { getDinnerRewardTable } from "./dinnerReward";

/**
 * Dinner Mission DM-1 (Issue #236): mission definitions and the derived unlock.
 *
 * Authority: docs/reports/TETO_DINNER-MISSION_Phase0_Fresh-Design.md §17 (Owner Decisions). A
 * mission is a fixed set of target recipes; clearing it means completing every target once, in any
 * order, before the time runs out, from the player's own finite stock. A definition names recipes by
 * id only -- what each needs, whether it has a CUT step, which sauce it uses all stay derived from
 * `RECIPES` / cooking profiles at run time, so the catalog can grow (25 -> 101 -> 172) without
 * touching mission data.
 */

export type DinnerMissionUnlockCondition = { kind: "ALL_TARGETS_DISCOVERED" };

export interface DinnerMissionDefinition {
  /** Stable id; never reused (DM-4 keys saved records by it). */
  missionId: string;
  /** Bumped whenever targets or time limit change. */
  revision: number;
  /** The content wave the mission was authored for (same idea as the Discovery Ladder's). */
  populationId: string;
  /** 2..6 distinct recipe ids. */
  targetRecipeIds: readonly RecipeId[];
  /** `seconds: null` = not tuned yet (OD-DM-14: DM-5 measures play time first). */
  timeLimit: { seconds: number | null };
  /** Id of a table in ./dinnerReward.ts; amounts live there, never inline. */
  reward: { tableId: string };
  unlock: DinnerMissionUnlockCondition;
  display: {
    /** Provisional. Must never contain a recipe name (an undiscovered target would leak). */
    titleJa: string;
    order: number;
    band: "EARLY" | "MID" | "LATE";
  };
}

export const DINNER_MISSION_MIN_TARGETS = 2;
export const DINNER_MISSION_MAX_TARGETS = 6;

/**
 * Phase 1 missions (OD-DM-13), exactly the Fresh Design §9 candidates DM-A / DM-B derived from the
 * runtime data at 42feec7. No requirement is restated here -- the targets' needs come from
 * `RECIPES`:
 * - DM-A: egg is shared (bismarck 1 + breakfast-pizza 1); bacon 3, mushroom 3; margherita is
 *   starter-only. Earliest at 4 discoveries (ladder steps 0-3).
 * - DM-B: eggplant is shared (melanzane 3 + parmigiana 3); mushroom 3, parmigiano 2. Earliest at 6.
 * Titles are placeholders until the UI phase names them.
 */
export const DINNER_MISSIONS: readonly DinnerMissionDefinition[] = [
  {
    missionId: "dm-a",
    revision: 1,
    populationId: "w1-25",
    targetRecipeIds: ["margherita", "bismarck", "breakfast-pizza", "funghi"],
    timeLimit: { seconds: null },
    reward: { tableId: "dinner-phase1-untuned" },
    unlock: { kind: "ALL_TARGETS_DISCOVERED" },
    display: { titleJa: "ディナーミッション 1", order: 1, band: "EARLY" },
  },
  {
    missionId: "dm-b",
    revision: 1,
    populationId: "w1-25",
    targetRecipeIds: ["margherita", "funghi", "melanzane-pizza", "parmigiana-pizza"],
    timeLimit: { seconds: null },
    reward: { tableId: "dinner-phase1-untuned" },
    unlock: { kind: "ALL_TARGETS_DISCOVERED" },
    display: { titleJa: "ディナーミッション 2", order: 2, band: "EARLY" },
  },
];

export function getDinnerMission(missionId: string): DinnerMissionDefinition | undefined {
  return DINNER_MISSIONS.find((m) => m.missionId === missionId);
}

/** The target recipes, in definition order; `null` if any id is unknown (fails closed). */
export function resolveDinnerTargets(mission: DinnerMissionDefinition): Recipe[] | null {
  const recipes: Recipe[] = [];
  for (const id of mission.targetRecipeIds) {
    const recipe = getRecipe(id);
    if (!recipe) return null;
    recipes.push(recipe);
  }
  return recipes;
}

const MISSION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Structural problems in the mission list (empty when valid), like `validateDiscoveryLadder`:
 * ids unique and well-formed, 2..6 distinct known targets, no recipe name in any title, a known
 * reward table, and a positive integer time limit or `null`. That every shipped mission can be
 * completed from one Shop pack of each material is pinned by dinnerMission.test.ts instead of
 * here, so this module stays off the material Shop layer (its importers are an allowlist,
 * ../../logic/discoveryLadder.test.ts).
 */
export function validateDinnerMissions(
  missions: readonly DinnerMissionDefinition[],
  recipes: readonly Recipe[] = RECIPES,
): string[] {
  const problems: string[] = [];
  const knownRecipeIds = new Set<string>(recipes.map((r) => r.id));
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  for (const m of missions) {
    const at = `mission ${m.missionId}`;
    if (!MISSION_ID_PATTERN.test(m.missionId)) problems.push(`${at}: malformed missionId`);
    if (seenIds.has(m.missionId)) problems.push(`${at}: duplicate missionId`);
    seenIds.add(m.missionId);
    if (!Number.isInteger(m.revision) || m.revision < 1) problems.push(`${at}: revision must be a positive integer`);
    if (m.populationId === "") problems.push(`${at}: populationId is empty`);
    if (seenOrders.has(m.display.order)) problems.push(`${at}: duplicate display order`);
    seenOrders.add(m.display.order);

    const targets = m.targetRecipeIds;
    if (targets.length < DINNER_MISSION_MIN_TARGETS || targets.length > DINNER_MISSION_MAX_TARGETS) {
      problems.push(`${at}: needs ${DINNER_MISSION_MIN_TARGETS}..${DINNER_MISSION_MAX_TARGETS} targets`);
    }
    if (new Set(targets).size !== targets.length) problems.push(`${at}: duplicate target`);
    for (const id of targets) {
      if (!knownRecipeIds.has(id)) problems.push(`${at}: unknown target ${id}`);
    }

    for (const recipe of recipes) {
      if (m.display.titleJa.includes(recipe.nameJa)) problems.push(`${at}: title names recipe ${recipe.id}`);
    }
    if (m.display.titleJa.trim() === "") problems.push(`${at}: title is empty`);

    const seconds = m.timeLimit.seconds;
    if (seconds !== null && (!Number.isInteger(seconds) || seconds <= 0)) {
      problems.push(`${at}: time limit must be a positive integer or null`);
    }
    if (!getDinnerRewardTable(m.reward.tableId)) problems.push(`${at}: unknown reward table ${m.reward.tableId}`);
    if (m.unlock.kind !== "ALL_TARGETS_DISCOVERED") problems.push(`${at}: unknown unlock kind`);
  }
  return problems;
}

/**
 * What the UI may show about a mission's unlock progress. Deliberately carries no identity of an
 * undiscovered target: only the discovered targets' ids and a count of the rest ("あと N 種類").
 */
export interface DinnerMissionUnlockView {
  missionId: string;
  unlocked: boolean;
  totalTargets: number;
  discoveredTargetIds: string[];
  undiscoveredCount: number;
}

/** Derived from the Dex on every call; nothing about unlocking is ever saved (OD-DM-12). */
export function dinnerMissionUnlock(mission: DinnerMissionDefinition, dex: DexState): DinnerMissionUnlockView {
  const discoveredTargetIds = mission.targetRecipeIds.filter((id) => isDiscovered(dex, id));
  const undiscoveredCount = mission.targetRecipeIds.length - discoveredTargetIds.length;
  return {
    missionId: mission.missionId,
    unlocked: undiscoveredCount === 0,
    totalTargets: mission.targetRecipeIds.length,
    discoveredTargetIds,
    undiscoveredCount,
  };
}

export function isDinnerMissionUnlocked(mission: DinnerMissionDefinition, dex: DexState): boolean {
  return dinnerMissionUnlock(mission, dex).unlocked;
}
