# Issue #421 — Canvas モッツァレラ 焼成後の溶け広がり Result

背景: Owner 実機 HV（main 05c82ed の共有 Preview）で、Canvas 表示は正常だが焼成後も白い塊のままで溶け広がりが不十分だった。#468 / #501 の調査・実装を引き継ぎ、再調査・複数案の試作はしていない。

## 変更（最小差分）
| ファイル | 内容 |
|---|---|
| `src/logic/cheesePool.ts` | 溶けた輪郭（melt>0.3 のみ）: 丸め `OUTLINE_ROUND_MIX` 0.85→0.55。塊と湾（広域平滑を除いた成分）を `OUTLINE_MELT_EXAGGERATION`(0.4) × fx で誇張。最遠点は保持（フレーム余白を維持）。伸長・重心の成分は触らない |
| `src/components/CheesePoolCanvas.tsx` | 溶け広がり: canvas の CSS を melt>0.3 で中心基準に最大 ×1.45 へ拡大（`cheesePoolSpreadScale`）。レイアウト不変 |
| テスト | `cheesePool.test.ts` の輪郭許容を意図した変更に合わせ最小限に緩和（aspect 上限、eqd 下限、solidity 下限、slit/spike、3 ローブ率など）。`CheesePoolCanvas.test.tsx` に spread スケールのテスト |

不変: 焼成前（melt ≤ 0.3）の画素（既存のバイト一致ハッシュのテストが通る）、採点・保存・経済・CUT 形状、`PizzaStage.tsx`（#494 と同ファイルのため未変更）、共有 Preview（deploy していない）。

## 比較画像（`docs/reports/screenshots/mozzarella-melt-shape-421/`、Chromium・DPR 2）
390×844 / 360×800 × spread / cluster: `*-1-before-bake`（焼成前）、`*-2-after-bake-OLD`（main 05c82ed）、`*-3-after-bake-NEW`（本 PR）。
目視: 焼成前は白い丸い塊のまま。焼成後は OLD の小さな豆形に対し、NEW は輪郭が崩れ、不規則に広がる。密集配置では隣と溶け合って一つの塊に見える。

## 残リスク
- 実機 iPhone Safari は未確認（Owner HV 待ち）。WebKit 画像は目視していない。
- 広がりで隣接チーズ・バジルと重なって見える配置がある。
- 動画（Human Verification Policy）は Owner 実機 HV の動画で代替する想定。この PR では撮っていない。
