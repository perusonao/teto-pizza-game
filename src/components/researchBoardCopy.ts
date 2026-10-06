/** Research Board (Phase 2 / S4) copy: fixed strings, the same for every target. */
export const BOARD_COPY = {
  title: "\u{1F4CB} これまでにわかったこと",
  note: "これまでの試作で確定して、保存された情報だよ",
  known: "✓ わかっている材料",
  excluded: "✗ 違うとわかった材料",
  unsure: "△ まだ絞り込めない情報",
  total: (n: number) => `全部で${n}種類`,
} as const;
