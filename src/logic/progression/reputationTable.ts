/**
 * B案再構成 (Issue #901): the reputation table. Design §3.2.6 / §6 Q5 / Q12.
 *
 * Phase 1b typed every value as `number | null` and left every one `null`, so a provisional number could never become a
 * default by accident (R8). **Phase 2a fills it with the Owner-approved numbers (2026-11-26)**:
 * - chapter floors 0 / 40 / 110 / 210 / 340;
 * - per served order, by the order's stars: ★1 +1 / ★2 +2 / ★3 +3 / ★4 +5 / ★5 +8;
 * - menu development (a first discovery): reputation +3 (the +50 Pitz bonus itself is unchanged, Q5).
 * Change a value here only on a new Owner decision. ./reputationTable.gate.test.ts pins these exact values.
 *
 * While any value is `null` the shop model cannot run: `isReputationTableComplete` is the one test of that
 * (../progression/progressionModel.ts falls back to legacy). `canEnableShopProgression` additionally needs the curated
 * catalog (`MENU_CATALOG`, Phase 3) and stays the gate for the Production cutover (Phase 4); Phase 2a's Preview-only shop
 * model runs on an interim catalog instead (./shopProgression.ts). Same pattern as Dinner's `timeLimit: { seconds: null }`.
 */
import { MENU_CATALOG, type MenuCatalogEntry } from "../../data/menuCatalog";

/** Q12: five chapters (the curated list's 5 stages x 12 recipes). */
export const SHOP_CHAPTER_COUNT = 5;

/** Stars run ★1..★5 (`QualityStars`). */
export const STAR_LEVEL_COUNT = 5;

export type ChapterFloors = readonly [number | null, number | null, number | null, number | null, number | null];

/** The reputation one served order earns, by its stars (index 0 = ★1 ... index 4 = ★5). */
export type OrderGainByStars = readonly [number | null, number | null, number | null, number | null, number | null];

export interface ReputationTable {
  /** Q12: each chapter's lower bound (chapter 1 first). Five floors, four boundaries between them. */
  chapterFloors: ChapterFloors;
  /** The reputation one served order earns, by its stars (Phase 2a; read through ./serviceQuality.ts). */
  perOrderGain: OrderGainByStars | null;
  /** Q5: the menu-development reputation bonus (the +50 Pitz bonus itself is unchanged). */
  menuDevelopmentBonus: number | null;
}

/** The production table: the Owner-approved numbers (2026-11-26). Never a provisional value. */
export const REPUTATION_TABLE: ReputationTable = Object.freeze({
  chapterFloors: Object.freeze([0, 40, 110, 210, 340]) as unknown as ChapterFloors,
  perOrderGain: Object.freeze([1, 2, 3, 5, 8]) as unknown as OrderGainByStars,
  menuDevelopmentBonus: 3,
});

/** A table with every value set. */
export interface CompleteReputationTable {
  chapterFloors: readonly [number, number, number, number, number];
  perOrderGain: readonly [number, number, number, number, number];
  menuDevelopmentBonus: number;
}

function isSetNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** True only when every value is a finite, non-negative number and the chapter floors do not go down. */
export function isReputationTableComplete(table: ReputationTable): table is ReputationTable & CompleteReputationTable {
  const floors = table.chapterFloors;
  if (floors.length !== SHOP_CHAPTER_COUNT || !floors.every(isSetNumber)) return false;
  for (let i = 1; i < floors.length; i++) {
    if ((floors[i] as number) < (floors[i - 1] as number)) return false;
  }
  const gains = table.perOrderGain;
  if (gains === null || gains.length !== STAR_LEVEL_COUNT || !gains.every(isSetNumber)) return false;
  return isSetNumber(table.menuDevelopmentBonus);
}

/** True when the shop model has what it needs to run: a complete reputation table and a non-empty curated catalog. */
export function canEnableShopProgression(
  table: ReputationTable = REPUTATION_TABLE,
  catalog: readonly MenuCatalogEntry[] = MENU_CATALOG,
): boolean {
  return isReputationTableComplete(table) && catalog.length > 0;
}
