# Pilot D2（Issue #703）クリームチーズ C1 — 最終デザイン案（Owner 承認待ち・本番コード未変更）

- 最新 main: `51c24bda1bc5bbf23f8e086a6fac402b73981a36`（PR #701 の squash merge）。Issue #703 は open、コメントは Owner の調査確認 1 件のみ（claim なし）。
- 重複・競合: open PR に `IngredientGlyph.tsx` / `ingredients.ts` / `App.css`（cream-cheese 部分）を触るものはない（#702 は新規の docs 1 ファイルのみ）。main の `src/` は #701 以降未変更。
- 本書は docs のみ。**Style Lock の形・色の変更に当たるため、Owner の明示承認までは実装・Preview 更新・merge をしない。**

比較画像（この branch）: `docs/reports/screenshots/ingredient-visual-pilot-d2-cream-cheese/`
- `C1_compare_20-24-28-result.png`: 20 / 24 / 28 / RESULT≈34px × 焼成後・焼き過ぎ・トレイのチップ・暗い背景・グレースケール 2 種。行は C0・C1 最終案・C1b・C1c・C1a・C2・C3・feta・ricotta・mozzarella（設計図）・白い円（CSS チーズ近似）。
- `C1_hero_C0-vs-C1-vs-neighbours.png`: C0 と C1 最終案を隣のチーズと並べた 160px の拡大（ソース上・チップ上）。
- `candidates/`: 候補 SVG（`C1-final.svg` が推奨）。

## C0 / C1 / C2 / C3 の比較（目視）
| 案 | 内容 | 所見 |
|---|---|---|
| C0（現行） | 青みの銀紙の箱 | ブロックには見えるが、金属の缶・箱に見える。銀紙が主役 |
| **C1（推奨）** | 温かい白の本体＋下半分だけ銀紙（ぎざぎざの折り目） | 本体が主役で、チーズ／バターの塊に読める。箔は下側だけで、缶に見えない。形が箱型で、feta（角切り 2 個）・ricotta（水玉の山）・mozzarella（球）と別 |
| C2 | 温かい白のブロック＋切り身 | 最も食品らしいが、20px で切り身が潰れ、feta の角切りに近づく |
| C3 | 形は現行のまま色だけ温かい白に | 缶感は消えるが、トレイのチップ（クリーム背景）で地との差が小さい |

## C1 最終案の仕様（Style Lock の語彙に合わせた）
- 64×64、足元の影楕円（C0 と同じ）、輪郭 2.4、2 トーン、`id` / gradient / `<defs>` なし。`pieceVisual` の識別子 `cream-cheese-block` と食材 id `cream-cheese` は維持（変更は `CreamCheeseBlock` の描画のみ）。
- 本体: 前面 `#fff1d2`、上面 `#fffaf0`、輪郭 `#7a6548`（ricotta の輪郭 `#7d6a42` と同じ暖色の系統）。上面の淡いハイライト `#f6e6bd`、前面に切り口を示す短い線 `#ecd9aa`（水玉は ricotta と被るので使わない）。
- 銀紙: 前面の下約半分（y≈43〜55）。ぎざぎざの上端、色 `#d3d9df`、輪郭 `#6b7380`（C0 の `#5c6b7c` より弱い）、ハイライト 2 本 `#f1f4f7`。
- 銀紙の面積は C0 の約 1/2 以下で、彩度の低い灰色にして主役にならないようにした。

## 目視の評価（自動撮影の比較シートに基づく。実機ではない）
| 観点 | 判定 | 根拠 |
|---|---|---|
| 本体が温かい白 | PASS | 前面 `#fff1d2` |
| 下半分だけ銀紙 | PASS | 銀紙は前面の下側だけ |
| 銀紙が主役にならない | PASS | 160px・34px とも本体の色が先に目に入る |
| 金属の缶・箱に見えない | PASS（20px は要確認） | 20px では、ぎざぎざが「波線」に見え、チーズ/バターのような塊か、ケーキに見えるかは実機で確認が必要 |
| feta・ricotta・mozzarella と区別 | PASS | 形（箱型）・色・箔の有無が別。グレースケールでも箔の帯で区別できる |
| 小さくてもチーズとして認識 | 要確認 | 20〜24px では細部が潰れ、バターにも見える可能性。チーズの系統（トレイの「チーズ」タブ・family 行）と名前で補える |
| ピザ全体の絵柄と調和 | PASS | 輪郭の太さ・影・2 トーンは他の専用 SVG と同じ。暖色の輪郭はサーモン・ricotta と近い |
| 焼き過ぎ（焦げフィルタ） | PASS | 暗い生地の上でも本体の形と箔の帯が分かる（本体が茶灰に寄る） |

## 限界・未確認
- 実機 iPhone Safari、WebKit / Chromium でのゲーム内描画（今回は SVG 単体の比較のみ。実装後に自動 Visual HV を撮影する）。
- mozzarella はゲーム内では SVG ではなく🧀 / Canvas。比較は設計参照図で代用。
- C1 の色（`#fff1d2` は黄寄りになりすぎないか）は、実機で最終確認が必要。

## Owner の判断が必要な事項
1. C1 最終案（上記仕様）を Style Lock の変更として承認するか。承認する場合は、`docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md` に 2026-10-30 の追記（cream-cheese の A 案を C1 に差し替え）を、実装 PR と同時に docs で行う。
2. 色・箔の面積の調整があるか（例: 箔を下 1/3 にする C1c、箔をやや大きくする C1b）。
3. 承認後の実装 PR の範囲（`IngredientGlyph.tsx` の `CreamCheeseBlock` のみ、テストの色の期待値の更新、必要なら `docs`）と、共有 Preview の利用（毎回 Owner の承認）。
