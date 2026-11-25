import { describe, expect, it } from "vitest";
import { MENU_CATALOG } from "../../data/menuCatalog";
import {
  REPUTATION_TABLE,
  SHOP_CHAPTER_COUNT,
  canEnableShopProgression,
  isReputationTableComplete,
  type ReputationTable,
} from "./reputationTable";

/**
 * B案 Phase 1b (Issue #901), design §3.2.6 / R8 gate: the reputation numbers are an Owner decision. Until every value is
 * set, the shop model cannot be enabled -- a provisional number can never become a default by accident.
 *
 * When the Owner fixes the table (before Phase 2a), the "still unset" case below is the one expected follow-up: replace
 * it with the approved values' own test. Never fill the table to make this gate pass.
 */
describe("reputation table gate", () => {
  it("has five chapter floors (Q12)", () => {
    expect(SHOP_CHAPTER_COUNT).toBe(5);
    expect(REPUTATION_TABLE.chapterFloors).toHaveLength(SHOP_CHAPTER_COUNT);
  });

  it("Phase 1b: every value is still unset (null) -- the numbers are not decided", () => {
    expect(REPUTATION_TABLE.chapterFloors.every((v) => v === null)).toBe(true);
    expect(REPUTATION_TABLE.perOrderGain).toBeNull();
    expect(REPUTATION_TABLE.menuDevelopmentBonus).toBeNull();
  });

  it("a table with any null is not complete, so the shop model cannot be enabled", () => {
    expect(isReputationTableComplete(REPUTATION_TABLE)).toBe(false);
    expect(canEnableShopProgression()).toBe(false);
    const full: ReputationTable = { chapterFloors: [0, 1, 2, 3, 4], perOrderGain: 1, menuDevelopmentBonus: 1 };
    expect(isReputationTableComplete(full)).toBe(true);
    for (let i = 0; i < SHOP_CHAPTER_COUNT; i++) {
      const floors = [...full.chapterFloors] as Array<number | null>;
      floors[i] = null;
      expect(isReputationTableComplete({ ...full, chapterFloors: floors as unknown as ReputationTable["chapterFloors"] })).toBe(false);
    }
    expect(isReputationTableComplete({ ...full, perOrderGain: null })).toBe(false);
    expect(isReputationTableComplete({ ...full, menuDevelopmentBonus: null })).toBe(false);
  });

  it("a table that is not exactly five floors is not complete", () => {
    const four = { chapterFloors: [0, 1, 2, 3], perOrderGain: 1, menuDevelopmentBonus: 1 } as unknown as ReputationTable;
    expect(isReputationTableComplete(four)).toBe(false);
  });

  it("a complete table alone is not enough: the curated catalog must not be empty (Phase 1b: it is)", () => {
    const full: ReputationTable = { chapterFloors: [0, 1, 2, 3, 4], perOrderGain: 1, menuDevelopmentBonus: 1 };
    expect(MENU_CATALOG).toHaveLength(0);
    expect(canEnableShopProgression(full)).toBe(false);
    expect(canEnableShopProgression(full, [{ recipeId: "margherita", chapter: 1 }])).toBe(true);
    expect(canEnableShopProgression(REPUTATION_TABLE, [{ recipeId: "margherita", chapter: 1 }])).toBe(false);
  });
});
