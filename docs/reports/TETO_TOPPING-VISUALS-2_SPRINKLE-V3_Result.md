# Topping Visuals 2.0 — parmigiano rev. 3（削りたての薄片への作り直し、PR #875）

状態: **実装済み・ローカル検証済み・Draft/HOLD（視覚品質 HOLD は Owner の再 HV まで継続）。** merge・Draft 解除・Production ON・共有 Preview 更新は未承認。
根拠: Owner の iPhone Safari HV [#875 comment 7000534304](https://github.com/perusonao/teto-pizza-game/pull/875#issuecomment-7000534304)（`pr-875-ddc2413`: 米粒・種・小葉のように見え、局所的な塊に集まる）。

## 1. Issue の役割分担
- **#825（配置方法）**: 1 タップ 1 配置のまま「振りかけ」に見せる。本 PR では**ルールを変えず**、ピースの座標・件数・在庫・Undo・採点・保存は前の PR のまま。
- **#824（見た目）**: 配置後の削り片の形・色・質感・分布。本 PR rev. 3 の変更は全てここ（`placedVisuals/` の描画のみ）。

## 2. 実装前の確認（記録）
- 最新 main `6954a874`（#873）。main は進んでおらず、#875 の base は #874 の head `8dfb99ea`（`Depends-on: #874`）。#875 は #874 の上に重なっていて、#874 側のファイルは触っていない。
- open PR（62 件）で `placedVisuals/`・`IngredientPieceVisual` を触るのは #874・#875 のみ。claim は #825 の自分の claim（comment 6994513148）の範囲内（`placedVisuals/**`・`IngredientPieceVisual*`）。`PizzaStage.tsx`・`App.css`・`ingredients.ts` は未編集。
- `docs/PROJECT_HANDOFF.md`・`CLAUDE.md`・HV Policy を確認。HV 動画（390×844）は Owner の iPhone で実施（本 PR では撮影できない）。変更前後のスクリーンショットはリポジトリに置く。

## 3. 変更（描画のみ）
| ファイル | 内容 |
|---|---|
| `parmigianoShavingsData.ts` | 形状の型を 3 種に: `flake`（幅広・不規則）／`ribbon`（細長い薄片、少しカール）／`fragment`（欠片） |
| `parmigianoShavingPaths.ts`（新規） | 輪郭の生成。flake は 7 角の不規則な多角形（直線の辺・角だけ丸め、id ごとに別の輪郭）、ribbon は弧に沿った帯（端は切り口で鈍い）、fragment は 5 角 |
| `ParmigianoShavings.tsx` | 各片: 薄い接地影 → 半透明のアイボリー（`#f7efd5 #f2e7c4 #f9f3e0`、不透明度 .86）＋細い暖色の縁取り → flake は明るく不透明な芯（薄い縁が透けて見える）、ribbon は上縁のハイライト。id／gradient／defs／url なし |
| `sprinkleLayout.ts` | 9〜11 片（flake 4 片以上・ribbon 2〜3・欠片 2〜3）。**ランダムな回転・オフセット・揺らぎを加えた格子**から間引く（ブルーノイズ風）ため、ダーツ方式のような塊にならない。大きさは 4〜22 単位（flake は長さ 10.5〜17・幅は長さの 50〜80%、ribbon は長さ 14〜21・幅 3〜4.6）。箱 76→**96px**（皿幅の約 3 割）、場の半径 24。外周の寄せの上限 18→**40 単位**、寄せを**ラッパーの回転（−18°）で打ち消す**（独立レビュー P2 の対応） |
| テスト | `sprinkleLayout.test.ts`（種別の内訳・米粒禁止＝flake の幅が長さの 50% 以上・ribbon の長さ／幅・均等性＝近傍距離と四象限・形の多様性・外周で皿の内側＋回転の打ち消し）、`ParmigianoShavings.test.tsx`（SVG の制約・3 種の描画・低彩度・影・半透明・パス生成）、`ParmigianoSprinkle.test.tsx`、`IngredientPieceVisual.test.tsx`（箱を定数で固定）、E2E（外周タップの皿内確認を、配置直後と RESULT の両方で、新規追加） |

**変更していない**: ピース座標・件数・在庫・Undo・採点・保存・選択アイコン・Reference・Dex・他食材・`PizzaStage.tsx`・`App.css`・`ingredients.ts`・Fry。焼成の見た目は既存の `.pizza-cheese` の melt／filter のまま（工程ごとの差の追加設計はしていない。§6）。

## 4. 見た目（`docs/reports/screenshots/topping-visuals-2/sprinkle-v3/`）
BEFORE（ddc2413）／AFTER の同倍率ボード（390×844・360×800、Owner の 3 か所タップと外周 4 か所、配置直後と焼成後 RESULT）。
- **所見**: BEFORE は細い米粒状。AFTER は、幅のある不規則な薄片＋細長い薄片＋欠片が混ざり、輪状・同一スタンプ・局所的な塊にはならない。外周タップでも皿の内側に収まる。焼成後はモッツァレラの白い塊の上でも、薄片の影と縁取りで形が読める。
- **正直な限界**: ①実寸（約 40〜50 CSS px の散布）では薄片は 1 つ 8〜14px で、実物の削りたてチーズとの質感の差（透け感・カール）は小さい。②トマトソースの上では半透明が桃色がかる（不透明度を .74→.86 に上げて抑えた）。③ribbon は「バナナ型」に見える場合がある。④**実物写真との比較シートは未作成**（環境が外部画像を取得できず、著作権のある写真をリポジトリに置かない。Owner が参考写真を #875 に添付すれば同倍率で並べる）。⑤四角パン・焼きすぎ・CUT・WebKit の画像・実機は未確認。

## 5. 検証
| 項目 | 結果 |
|---|---|
| `tsc -b`／`oxlint` | エラー・警告なし |
| focused（placedVisuals・`IngredientPieceVisual`＋architecture・`PizzaVisualPieces`・`IngredientGlyph`・契約テスト・fry architecture） | 9 files・308 tests passed |
| E2E（Chromium、390×844・360×800） | `topping-visuals-parmigiano` 4 件（2 テスト×2 viewport）通過 |
| 全 Vitest・CI・WebKit・独立レビュー・Preview | PR #875 のコメントに記録 |

## 6. Owner 判断・次の候補（推奨つき）
| ID | 論点 | 推奨 |
|---|---|---|
| V1 | 散布の大きさ（箱 96px・場の半径 24）と片数（9〜11） | HV で「広すぎ／小さすぎ」を聞いてから調整 |
| V2 | 焼成前後・RESULT の工程別の差（焼き色に合わせた縁の色づけ・溶け始めの透け感） | HV で必要と判断された場合のみ。`placedVisuals/` に stage を渡す `surface` の拡張が必要で、`PizzaStage` への配線を伴うため別 Gate |
| V3 | 参考写真の提供（実物比較シートの作成） | #875 に添付 |
| V4 | ribbon の形（バナナ型に見える場合）と、カール表現の追加 | HV の結果次第 |

## 7. 次のプロンプト往復の見積り
- 本 PR の仕上げ（CI・WebKit・独立レビュー・Preview 更新、再 HV の依頼）: 約 2〜3 往復
- 再 HV 後の調整（V1・V4）と再 Preview: 約 2〜4 往復
- 工程別の差（V2）を採る場合: Gate 1 往復＋実装 約 4〜6 往復
