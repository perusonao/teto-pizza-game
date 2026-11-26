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
import { REPUTATION_TABLE } from "./reputationTable";
import { rankAtFloor } from "./shopRank";
import { activeShopCatalog, stageRecipeIds, type ReputationGain, type ShopCatalog } from "./shopProgression";

/** The shop form a stage opens with: stage 2 小さな店, 3 人気店, 4 有名店, 5 伝説の店 (stage 1 屋台). */
export function stageShopForm(chapter: number): string {
  const floor = REPUTATION_TABLE.chapterFloors[chapter - 1];
  return rankAtFloor(typeof floor === "number" ? floor : 0).stage;
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
  /** The adopted recipes of the opened stages not in the Dex yet (they can be developed from now on). */
  newRecipeCount: number;
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
  let newRecipeCount = 0;
  for (let chapter = gain.chapterBefore + 1; chapter <= gain.chapterAfter; chapter++) {
    newRecipeCount += stageRecipeIds(chapter, catalog).filter((id) => !isDiscovered(dexAfter, id)).length;
  }
  return {
    newRecipeCount,
    materialNamesJa: materialIds.map((id) => getIngredient(id)?.nameJa ?? id),
    enteredRecipeNamesJa: enteredRecipeIds.map((id) => getRecipe(id)?.nameJa ?? id),
  };
}
