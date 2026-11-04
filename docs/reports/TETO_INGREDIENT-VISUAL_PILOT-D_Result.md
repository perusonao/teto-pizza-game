# Ingredient Icons 2.0 — Pilot D Result（salmon / cream-cheese の専用 SVG、#623）

Status: **実装と検証は完了。merge と iPhone Safari 実機 HV の PASS 判定は Owner。** 基準 main `23b50da6`（#699 merge 後）。ブランチ `claude/pilot-d-salmon-cream-cheese-svg`。設計 authority: `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md` §1b A 案 / §10.3（**デザインは変更していない**）。Owner 決定（2026-10-22）: 両食材に個別の 1.2em 補正、`cream-cheese.svg` の無描画 path は移植しない。

## 1. 着手 Gate（2026-10-29 に再確認）
- Owner Gate run 40884185968（main `23b50da6`）success、`repoGaps` なし。同じスクリプトをローカルで実行して再確認: claims は有効 8 / 失効 14 / release 9 / 無効 2。**有効な claim のどれも Pilot D の 4 ファイルを含まない。**
- #623 に claim を投稿した（https://github.com/perusonao/teto-pizza-game/issues/623#issuecomment-6499498003 。session `session_016YrGi2CEsCFdUCyxJPUinq`、期限 2026-11-05）。
- #468 は HOLD 維持・変更なし。`PizzaStage.tsx` / `toppingSizeClass.ts` は未変更。

## 2. 変更
| ファイル | 内容 |
|---|---|
| `src/data/ingredients.ts` | `DedicatedIngredientVisual` に `salmon-fillet` / `cream-cheese-block`。`salmon` と `cream-cheese` に `pieceVisual` を各 1 行（`emoji` はテキストのフォールバックとして残す。DOM には出ない） |
| `src/components/IngredientGlyph.tsx` | `VISUAL_VIEWBOX` に 2 行（64×64）、分岐 2 行、`SalmonFillet` / `CreamCheeseBlock`（参照 SVG の `path` / `ellipse` と一致。`id` / gradient / `<defs>` なし。cream-cheese の無描画 path は移植しない） |
| `src/components/IngredientGlyph.test.tsx` | `PILOT_D_DEDICATED` を `ALL_DEDICATED` に追加。新 describe 9 件（宣言・identity、グリフとピースの SVG、`id` 非依存、`.pizza-cheese--glyph` ラッパー、描画の色、他の SVG との区別、トレイ・在庫、他の未移行チーズの不変） |
| `src/App.css` | `.ingredient-glyph--salmon-fillet, .ingredient-glyph--cream-cheese-block { width/height: 1.2em; margin: -0.1em }`（個別の独立ルール。既存グループは無変更） |
| `src/data/__golden__/lateCatalog.offSurface.json`、`src/data/lateCatalog.offGolden.test.ts`（コメント 1 行） | **#623 の 4 ファイル以外の必須変更。** ingredients の先頭 66 件の SHA-256 は `pieceVisual` を含むため、`salmon` / `cream-cheese` の 2 行追加で digest が変わる。arugula・shrimp と同じ前例（意図的な再生成）。差分が `pieceVisual` の 2 件だけであることを、変更前後の先頭 66 件を JSON 比較して確認した（id・順序・placement・unlock は不変） |

触れていない: `PizzaStage.tsx`、`toppingSizeClass.ts`、保存 schema・採点・レシピ・在庫・Dex、`.pizza-cheese*` の既存 CSS、mozzarella の Canvas、#468、共有 Preview。

## 3. 実寸（Chromium、390×844 / 360×800、DOM の `getBoundingClientRect`）
| 食材 | トレイ（SVG 箱） | 焼成後 FINISH | RESULT（×0.75） |
|---|---|---|---|
| salmon | 31.2px | 38.6px | **29.0px**（受入条件「RESULT で 16px 以上」を満たす） |
| cream-cheese | 見た目は 1.2em（`.pizza-cheese--glyph` の箱は 28px のまま） | — | 33.6px |

390 と 360 でピースの大きさは同じ（生地が縮む分、占有率だけ上がる。Pilot D 前の Fresh Audit と同じ）。

## 4. 検証
- `npx tsc -b`: エラー 0。`oxlint`（変更した 3 ファイル）: 警告・エラーなし。
- focused unit（`IngredientGlyph.test.tsx` / `IngredientPieceVisual.test.tsx` / `ingredients.test.ts` / `lateCatalog.offGolden.test.ts`）: pass。`TETO_PINSA_OFF=1` でも `lateCatalog.offGolden` / `lateCatalog.ikura` / `IngredientGlyph` / `ingredients` が pass。
- `vitest run src/components src/data src/state src/logic/catalog`: 298 files のうち、最初の実行で失敗したのは `lateCatalog.offGolden`（上記の golden）の 1 件だけで、再生成後に pass。
- Chromium E2E（`cooking-tray-family-filter` / `ingredient-shelf-inventory` / `finished-pizza-visual-2.0` / `finish-bar-finc` / `new-sauces-u1`、390×844 と 360×800）: 46 pass / 0 fail（残りは viewport 指定の skip）。E2E が書き出す `docs/reports/screenshots/cooking-tray-family-filter/` の画像は破棄した。
- full Vitest・WebKit の反復はしない（Verification Budget）。WebKit は CI で確認する。

## 5. Owner の iPhone Safari HV 用の比較資料（`docs/reports/screenshots/ingredient-visual-pilot-d/`）
比較画像は **実ゲーム画面**（Chromium、DPR 2、before = main `23b50da6`、after = 本ブランチ、同じ配置・同じ焼成）。**絵文字は Noto Color Emoji（Linux）で、Apple Color Emoji の「before」は異なる。**
| ファイル | 内容 |
|---|---|
| `pd-01_fish-baked_390-360.png` | 焼成後（FINISH）。サーモン・いくら・大葉・エビを並べて、サーモンと近縁の識別 |
| `pd-02_fish-result_390-360.png` | RESULT（×0.75） |
| `pd-03_fish-burnt_390.png` | 焼き過ぎ（失敗カード）。暗い生地の上でサーモンが読めるか |
| `pd-04_cheese-baked_390-360.png` / `pd-05_cheese-result_390-360.png` | クリームチーズ・フェタ・リコッタ・カトゥピリ・ヤギのチーズ・パニール（焼成後・RESULT） |
| `pd-06_trays_390-360.png` | トレイ（サーモン、いくら・大葉、チーズ）。チップの幅・高さ・タップ領域・family 行が変わっていないこと |
| `pd-07_placed-before-bake_390.png` | 配置直後（焼成前） |
| `pd-08_size-strip_red-dough-cheese-gray.png` | 20 / 24 / 28 / 48px、赤ソース・焼けた生地・チーズの 3 背景とグレースケール。サーモンと いくら・大葉・エビ、クリームチーズと フェタ・リコッタ。旧（🍣・白い円）との並び |

### HV の観点（#623 の受入条件に対応）
1. サーモンが「切り身」に読める（旧は寿司）。**サーモンといくら（橙の丸粒の山）が形で区別できる**（グレースケールでも）。後乗せ層（FINISH）のいくらとの並びも確認する。
2. クリームチーズ（銀紙のブロック）が、フェタ（角切り）・リコッタ（山）・モッツァレラ・他の白い丸の CSS チーズと区別できる。
3. 焼き過ぎ（pd-03）で、サーモンの暗い輪郭は焦げた生地に対して弱い（約 1.4:1 の概算）が白い縞が読める。**色は変えていない**（Style Lock 済み）。クリームチーズは焼き過ぎで暗い灰色に寄る点を確認。
4. トレイの 390×844 / 360×800 で、チップ・ページャー・family 行が悪化していない。
5. iPhone Safari（Apple Color Emoji の「現行」との比較を含む）。方式は **V1-LAN**（Owner の PC から限定サーバで配信、別 origin、Firebase なし、保存は空から。共有 Preview は上書きしない。手順 `TETO_PINSA-577_IPHONE-HV_Runbook_2026-10-25.md` と同系）。**PASS の判定は Owner。**

## 6. 既知の限界・未確認
- iPhone Safari・WebKit の描画、Apple Color Emoji の「before」は未確認（Owner HV）。
- 食材どうしの重なり、暗いソース上の見え方は未測定。
- 本番では E5（#654）により ikura-salmon-pizza が有効なため、merge するとサーモン・クリームチーズの SVG 化が即座に出る（merge = 公開。Owner の HV と承認まで merge しない）。
