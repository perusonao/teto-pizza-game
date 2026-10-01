/** Discovery 3.0 IP-1: the OPEN_POOL next-action guidance. Fixed copy: it names no ingredient, family or recipe and
 *  reads nothing of the hidden pool (OD-IP1-1). The notebook is the header entry that is always there; the pantry is the
 *  existing 食材庫 (OD-IP1-2), opened without any category chosen for the player (OD-IP1-4). */
export const OPEN_POOL_ACTIONS = {
  notebook: "\u{1F4D3} これまでの試作は、上の「試作ノートを見る」で見返せるよ。",
  pantryOpen: "\u{1F9FA} 食材庫で、持っている材料をさがしてみよう。",
  pantryLater: "\u{1F9FA} 生地のあと、材料をえらぶ画面で「食材庫」から材料をさがせるよ。",
  pantryButton: "\u{1F9FA} 食材庫で材料を探す",
} as const;
