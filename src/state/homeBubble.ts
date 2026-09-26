/** Progression 2.0 W1 Discovery 2.0 (W1-e) HOME bubble: one line, priority Dex 0 -> NEW Shop material -> DISCOVERABLE -> default. Never a
 *  recipe name (L1). */
export function homeBubbleJa(p: {
  lunchRushLocked: boolean;
  newShopMaterialCount: number;
  discoverableCount: number;
}): string {
  if (p.lunchRushLocked) return "まずはフリークッキングで最初の1枚を見つけよう！";
  if (p.newShopMaterialCount > 0) return "ショップに新しい材料が入ったよ！";
  if (p.discoverableCount > 0) return "今の材料で新しいピザが作れるかも！";
  return "今日はどんなピザを作ろう？";
}
