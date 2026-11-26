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
 * Phase 2a: the Owner fixed the table (2026-11-26). The Phase 1b "still unset" case is replaced, as that case's own note
 * asked, by the approved values' own test -- it pins every number exactly, so no value can drift without a new decision.
 */
describe("reputation table gate", () => {
  it("has five chapter floors (Q12)", () => {
    expect(SHOP_CHAPTER_COUNT).toBe(5);
    expect(REPUTATION_TABLE.chapterFloors).toHaveLength(SHOP_CHAPTER_COUNT);
  });

  it("Phase 2a: holds exactly the Owner-approved numbers (2026-11-26)", () => {
    expect([...REPUTATION_TABLE.chapterFloors]).toEqual([0, 40, 110, 210, 340]);
    expect(REPUTATION_TABLE.perOrderGain && [...REPUTATION_TABLE.perOrderGain]).toEqual([1, 2, 3, 5, 8]);
    expect(REPUTATION_TABLE.menuDevelopmentBonus).toBe(3);
    expect(isReputationTableComplete(REPUTATION_TABLE)).toBe(true);
    expect(Object.isFrozen(REPUTATION_TABLE)).toBe(true);
  });

  it("a table with any null is not complete, so the shop model cannot be enabled", () => {
    const full: ReputationTable = { chapterFloors: [0, 1, 2, 3, 4], perOrderGain: [1, 1, 1, 1, 1], menuDevelopmentBonus: 1 };
    expect(isReputationTableComplete(full)).toBe(true);
    for (let i = 0; i < SHOP_CHAPTER_COUNT; i++) {
      const floors = [...full.chapterFloors] as Array<number | null>;
      floors[i] = null;
      expect(isReputationTableComplete({ ...full, chapterFloors: floors as unknown as ReputationTable["chapterFloors"] })).toBe(false);
    }
    expect(isReputationTableComplete({ ...full, perOrderGain: null })).toBe(false);
    for (let i = 0; i < 5; i++) {
      const gains = [1, 1, 1, 1, 1] as Array<number | null>;
      gains[i] = null;
      expect(isReputationTableComplete({ ...full, perOrderGain: gains as unknown as ReputationTable["perOrderGain"] })).toBe(false);
    }
    expect(isReputationTableComplete({ ...full, menuDevelopmentBonus: null })).toBe(false);
  });

  it("a table that is not exactly five floors is not complete", () => {
    const four = { chapterFloors: [0, 1, 2, 3], perOrderGain: [1, 1, 1, 1, 1], menuDevelopmentBonus: 1 } as unknown as ReputationTable;
    expect(isReputationTableComplete(four)).toBe(false);
  });

  it("a complete table alone is not enough: the curated catalog must not be empty", () => {
    const full: ReputationTable = { chapterFloors: [0, 1, 2, 3, 4], perOrderGain: [1, 1, 1, 1, 1], menuDevelopmentBonus: 1 };
    expect(canEnableShopProgression(full, [])).toBe(false);
    expect(canEnableShopProgression(REPUTATION_TABLE, [])).toBe(false);
    // Phase 3a: the curated 60 landed, so the production table and catalog together pass the gate. The Production default
    // stays legacy (progressionModelFlag.ts); this gate is a precondition of the Phase 4 cutover, not the cutover itself.
    expect(MENU_CATALOG).toHaveLength(60);
    expect(canEnableShopProgression()).toBe(true);
    expect(canEnableShopProgression(full)).toBe(true);
    expect(canEnableShopProgression(full, [{ recipeId: "margherita", chapter: 1 }])).toBe(true);
    // An incomplete table still blocks it with a catalog.
    expect(canEnableShopProgression(REPUTATION_TABLE, [{ recipeId: "margherita", chapter: 1 }])).toBe(true);
    expect(canEnableShopProgression({ ...full, menuDevelopmentBonus: null }, [{ recipeId: "margherita", chapter: 1 }])).toBe(false);
  });
});
