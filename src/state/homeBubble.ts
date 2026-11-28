/** Progression 2.0 W1 Discovery 2.0 (W1-e) HOME bubble: one line, priority Dex 0 -> NEW Shop material -> DISCOVERABLE -> default. Never a
 *  recipe name (L1). */
import { shopCopy } from "../logic/progression/shopCopy";

export function homeBubbleJa(p: {
  lunchRushLocked: boolean;
  newShopMaterialCount: number;
  discoverableCount: number;
}): string {
  if (p.lunchRushLocked) return shopCopy("まずはレシピ発見で最初の1枚を見つけよう！", "まずはメニュー開発で最初の1枚を見つけよう！");
  if (p.newShopMaterialCount > 0) return "お店に新しい材料が入ったよ！";
  if (p.discoverableCount > 0) return "今の材料で新しいピザが作れるかも！";
  return "今日はどんなピザを作ろう？";
}
