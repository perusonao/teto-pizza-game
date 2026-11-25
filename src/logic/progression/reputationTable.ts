/**
 * B案再構成 Phase 1b (Issue #901): the reputation table, typed and left unset. Design §3.2.6 / §6 Q5 / Q12.
 *
 * Every value is `number | null` and Phase 1b leaves every one `null`: the numbers are an Owner decision (to be fixed
 * before Phase 2a) and must never become defaults by accident (R8). While any value is `null` the shop model cannot be
 * enabled -- `isReputationTableComplete` is the one test of that, and ./reputationTable.gate.test.ts pins it for the
 * production table (`canEnableShopProgression` also needs a non-empty curated catalog). Same pattern as Dinner's
 * `timeLimit: { seconds: null }` (unset = cannot START).
 */
import { MENU_CATALOG, type MenuCatalogEntry } from "../../data/menuCatalog";

/** Q12: five chapters (the curated list's 5 stages x 12 recipes). */
export const SHOP_CHAPTER_COUNT = 5;

export type ChapterFloors = readonly [number | null, number | null, number | null, number | null, number | null];

export interface ReputationTable {
  /** Q12: each chapter's lower bound (chapter 1 first). Five floors, four boundaries between them. */
  chapterFloors: ChapterFloors;
  /** The reputation one served order earns (Phase 2a; quality-linked through ./serviceQuality later). */
  perOrderGain: number | null;
  /** Q5: the menu-development reputation bonus (the +50 Pitz bonus itself is unchanged). */
  menuDevelopmentBonus: number | null;
}

/** The production table. Unset by design until the Owner fixes the numbers (do not fill in a provisional value here). */
export const REPUTATION_TABLE: ReputationTable = Object.freeze({
  chapterFloors: Object.freeze([null, null, null, null, null]) as unknown as ChapterFloors,
  perOrderGain: null,
  menuDevelopmentBonus: null,
});

/** A table with every value set. */
export interface CompleteReputationTable {
  chapterFloors: readonly [number, number, number, number, number];
  perOrderGain: number;
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
  return isSetNumber(table.perOrderGain) && isSetNumber(table.menuDevelopmentBonus);
}

/** True when the shop model has what it needs to run: a complete reputation table and a non-empty curated catalog. */
export function canEnableShopProgression(
  table: ReputationTable = REPUTATION_TABLE,
  catalog: readonly MenuCatalogEntry[] = MENU_CATALOG,
): boolean {
  return isReputationTableComplete(table) && catalog.length > 0;
}
