/**
 * B案再構成 Phase 3b (Issue #901, Owner 2026-11-27): what the player is told about the shop's stages -- the copy for a recipe that is
 * identified before its stage opens, the Dex's 「○○でメニュー入り」 line, and what the promotion banner lists when a stage opens.
 *
 * The player never reads a system word like 「保留」: a recipe waits because the shop is not big enough yet (its preparation and
 * equipment), and it joins the menu when the shop grows into the stage's form (小さな店 / 人気店 / 有名店 / 伝説の店, the shop form of
 * the title the stage opens with: ./shopRank.ts). Shop model only: nothing here is read under the legacy model.
 */
import { getIngredient } from "../../data/ingredients";
import { getRecipe, type RecipeId } from "../../data/recipes";
import { isDiscovered, type DexState } from "../../state/dex";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { REPUTATION_TABLE, isReputationTableComplete } from "./reputationTable";
import { rankAtFloor } from "./shopRank";
import {
  activeShopCatalog,
  isMaterialOpenAt,
  materialOpenReputationOf,
  stageRecipeIds,
  type ReputationGain,
  type ShopCatalog,
} from "./shopProgression";

/** The shop form a stage opens with: stage 2 小さな店, 3 人気店, 4 有名店, 5 伝説の店 (stage 1 屋台). */
export function stageShopForm(chapter: number): string {
  const floor = REPUTATION_TABLE.chapterFloors[chapter - 1];
  return rankAtFloor(typeof floor === "number" ? floor : 0).stage;
}

/**
 * PR #915 Muse play check (2026-11-27): the Dex heading of a stage that is not open yet says what opens it -- the title the stage opens
 * with and its reputation floor, e.g. 「一人前（評判40）で解放」. Both come from the title ladder and `REPUTATION_TABLE.chapterFloors`
 * (stages 1-5 at 0 / 40 / 110 / 210 / 340; 駆け出し 15 opens no stage, so it never appears here). `null` for stage 1 or an unknown one.
 */
export function stageUnlockLabel(chapter: number): string | null {
  const floor = REPUTATION_TABLE.chapterFloors[chapter - 1];
  if (chapter <= 1 || typeof floor !== "number") return null;
  return `${rankAtFloor(floor).title}（評判${floor}）で解放`;
}

/** RESULT: an exact match for a recipe whose stage is not open yet. */
export function identifiedAwaitingCopy(recipeNameJa: string, chapter: number, firstTime: boolean): { titleJa: string; bodyJa: string } {
  const form = stageShopForm(chapter);
  return {
    titleJa: firstTime ? `${recipeNameJa}のレシピが判明した！` : `${recipeNameJa}ができた！（レシピ判明ずみ）`,
    bodyJa: `でも今のお店では、仕込みも設備もまだ追いつかなくて、お店には出せないみたい。${form}になったらメニューに載せよう！`,
  };
}

/** The Dex card's line for an identified recipe waiting for its stage. */
export function identifiedAwaitingDexLine(chapter: number): string {
  return `${stageShopForm(chapter)}でメニュー入り`;
}

/** What the promotion banner lists when this round opened one or more stages. */
export interface StageOpeningView {
  /** The adopted recipes of the opened stages not in the Dex yet whose materials are all open now (developable from now on). */
  newRecipeCount: number;
  /**
   * Owner decision 2026-11-27: the opened stages' recipes not in the Dex yet that still wait for a material (stage 4's last four
   * until reputation 275), counted from the materials open at this reputation -- never a fixed number. 0 = none waits.
   */
  waitingRecipeCount: number;
  /** The reputations the waiting recipes' last materials arrive at, ascending (e.g. [275]). Empty when none waits. */
  waitingArrivalReputations: readonly number[];
  /** The materials that arrived with it (this round's material notice), in notice order. */
  materialNamesJa: readonly string[];
  /** Identified recipes that joined the menu now. */
  enteredRecipeNamesJa: readonly string[];
}

/**
 * `null` unless this round's reputation crossed a stage floor (40 / 110 / 210 / 340). 駆け出し (15) is a title-only promotion, so it
 * opens nothing and gets no list (its banner stays the one line). Reputation 275 (stage 4's second-half materials) is not a stage
 * floor either: those materials are announced by the ordinary material notice.
 */
export function stageOpeningView(
  gain: ReputationGain | null,
  dexAfter: DexState,
  materialIds: readonly string[],
  enteredRecipeIds: readonly RecipeId[],
  catalog: ShopCatalog = activeShopCatalog(),
): StageOpeningView | null {
  if (!gain || gain.chapterAfter <= gain.chapterBefore) return null;
  const table = isReputationTableComplete(REPUTATION_TABLE) ? REPUTATION_TABLE : null;
  let newRecipeCount = 0;
  let waitingRecipeCount = 0;
  const arrivals = new Set<number>();
  for (let chapter = gain.chapterBefore + 1; chapter <= gain.chapterAfter; chapter++) {
    for (const id of stageRecipeIds(chapter, catalog)) {
      if (isDiscovered(dexAfter, id)) continue;
      const items = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === id)?.items ?? [];
      const closed = table ? items.filter((m) => !isMaterialOpenAt(m, gain.after, table, catalog)) : [];
      if (closed.length === 0) {
        newRecipeCount += 1;
        continue;
      }
      waitingRecipeCount += 1;
      const at = Math.max(...closed.map((m) => (table ? materialOpenReputationOf(m, table, catalog) ?? 0 : 0)));
      if (at > 0) arrivals.add(at);
    }
  }
  return {
    newRecipeCount,
    waitingRecipeCount,
    waitingArrivalReputations: [...arrivals].sort((a, b) => a - b),
    materialNamesJa: materialIds.map((id) => getIngredient(id)?.nameJa ?? id),
    enteredRecipeNamesJa: enteredRecipeIds.map((id) => getRecipe(id)?.nameJa ?? id),
  };
}
