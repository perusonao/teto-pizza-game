# Topping Size Classes 1.0 — 最終調整 比較・設計レポート (Issue #479, S2b-2 前段)

Base: `main` `7ce7307`（#506 A/B 比較スイッチ・#507 モッツァレラ溶け広がりを含む）。**比較と設計のみ。実装・本番/共有 Preview の変更なし。** 本番の倍率は全クラス 1.0 のまま。チーズ溶融・採点・保存・経済・CUT は未変更。

## 方法
- 既存の `?toppingScale=a|b`（#506）をそのまま使用。新規コードは比較用キャプチャ spec のみ（`e2e/topping-size-final-compare.spec.ts`、`TOPPING_SCALE_CAPTURE_DIR` 未設定ならスキップ。#506 の spec と同じ位置づけ）。
- 8 レシピを **Reference の確定座標**（`referencePizza.ts`）どおりに配置（Chromium / PREPARE / Free Cooking）。ソースは全てトマト（食材サイズ比較のため）。
  - margherita（l+xl）/ capricciosa（密・l/m/s/xs 混在）/ pizza-portuguesa（最多 10 個）/ meat-lovers / jamon-serrano-pizza（xl 多）/ puttanesca-pizza（xs・s 多）/ quattro-formaggi（チーズ 4 種）/ breakfast-pizza（卵+ベーコン）
- 390×844・360×800 × off / A / B = 48 枚。各ピースの描画ボックスと、ピース同士の箱の重なり率（交差面積/小さい方の面積）・ドウ縁超えを計測。
- 画像: `docs/reports/screenshots/topping-size-final/<recipe>-iphone-<viewport>.png`（左から off | A | B）、数値: `.../metrics/*.json`。

## 結果
**はみ出し:** 全 48 ケースでドウ外へ出るピースなし。横オーバーフローなし（390 / 360 とも）。

**重なり（箱ベース、重なり率 0.30 以上のペア数。off → A → B）:**

| レシピ | 390×844 | 360×800 |
|---|---|---|
| margherita | 0 → 2 → 0 | 0 → 2 → 2 |
| capricciosa | 2 → 2 → 2 | 2 → 4 → 2 |
| pizza-portuguesa | 0 → 3 → 1 | 0 → 4 → 3 |
| breakfast-pizza | 0 → 2 → 0 | 0 → 2 → 2 |
| quattro-formaggi | 0 → 2 → 0 | 0 → 2 → 2 |
| meat-lovers / jamon-serrano / puttanesca | 全モード 0（最大 0.22） | 同左 |

- 該当ペアは**ほぼ全て mozzarella の Canvas 箱**との組。箱には透明余白が大きく（生の塊は箱の約 0.4）、**見た目の接触は箱の数値より少ない**。ただし A（箱 88px）は 360 の capricciosa で mozzarella×black-olive 0.72、portuguesa で mozzarella×ham 0.61 と、画像でも隣接が窮屈。B（81px）は最大 0.58 / 0.46。
- off の時点で capricciosa（360）には mozzarella×black-olive 0.41 がある（既存。サイズ導入前から）。

**小さすぎ:**
- A の xs（×0.6）: oregano / rosemary / parsley は約 17〜21px、capers は約 15px で、360 の puttanesca・capricciosa では何の食材か判別しづらい。B（×0.7）は約 21〜25px で許容。
- 現状（off）では capers・oregano がむしろ大きすぎ（28px 相当）で、xs 導入の方向自体は妥当。

**大きすぎ / バランス:**
- A の xl（×1.5）: jamon-serrano で prosciutto / arugula が 55px 級となりサラダ（🥗）が皿状に目立つ。大 mozzarella と並ぶと主役が逆転。B（×1.3、約 45px）は margherita の basil も自然。
- A の l（×1.25）の bacon / egg / feta 系は portuguesa・breakfast で隣接が増える。B（×1.15）は off と同程度。

**サイズ逆転（倍率だけでは直らない）:**
- **black-olive（s）**は A でも B でも暗い円の存在感が強く、mushroom（m）と同等〜やや目立つ（puttanesca / capricciosa の画像）。#506 / Phase 0 の見かけ面積測定（jalapeno・black-olive・pepperoni・salami・capers = 幾何学形が大きく見える、bacon・葉物は小さく見える）と一致。
- **mozzarella（l）**は B でも Canvas の塊が mushroom より小さく見える（margherita の basil と並ぶと B の mozzarella は basil より小さい）。箱の拡大だけでは「大」の見え方にならない。
- prosciutto-crudo が 🍥、arugula が 🥗 の絵文字で描かれる点は、サイズではなく絵柄の問題（本作業の対象外。#503 系の SVG 化で変わる）。

## 提案
**基本は B。A は採用しない**（xs が小さすぎ、xl / l の重なり・主役逆転が大きい）。ただし B にも次の微調整が必要と見る。

| 項目 | 現 B | 提案（要 Owner 判断・HV） |
|---|---|---|
| xs | ×0.7 | **維持**（A の 0.6 は判別性が落ちる。0.7 未満にしない） |
| s | ×0.85 | **維持**。ただし black-olive / jalapeno は**見かけ補正**（追加 ×0.85 程度）で mushroom より小さく見せる |
| m | ×1.0 | 維持。pepperoni / salami（幾何学形で大きく見える）に ×0.9 程度の補正候補 |
| l | ×1.15 | 維持。**bacon は細い絵のため補正 ×1.1 候補**（bacon が mushroom より小さく見える逆転を解消） |
| xl | ×1.3 | 維持。spinach / arugula（面積が小さい絵）は ×1.1 程度の補正候補。xl 同士・xl と mozzarella の隣接は上限として監視 |
| mozzarella | 箱 ×1.15 | クラス倍率とは**別枠**で再評価（箱だけ ×1.3〜1.35 まで試す価値。ただし透明余白が増えるだけで接触の見え方は悪化しない見込み。要 360 実機）。**溶け広がり（#507）の処理・ビットマップ格子は変えない** |

補正値は Noto Color Emoji 上の推定で、**iPhone の Apple Color Emoji では充填率が異なる**（Phase 0 の注記どおり）。数値の確定は実機 HV 後。上表は「どの食材をどちらに寄せるか」の方針であり、確定値ではありません。

## 実装に必要な変更（Owner が方針を承認した後）
1. `toppingSizeClass.ts`: `TOPPING_RANK_SCALE` を B 値に（`xs .7 / s .85 / m 1 / l 1.15 / xl 1.3`）。ID 別補正を入れる場合は `Record<id, number>` の小表を同ファイルに追加し、`toppingRankScale` で乗算（既定 1、表の網羅テストは不要・単調性テストは補正前の class 値に対して維持）。
2. 本番と A/B スイッチの整合: `toppingScalePreview.ts` の候補に「B+補正」を `c` として追加して HV 比較（本番ゲートの bundle スキャンテストも更新）。
3. mozzarella の箱倍率を別枠にする場合のみ `PizzaStage.tsx` の `Math.round(sizePx * rankScale)` 近傍を変更（溶融・格子は不変）。
4. テスト: 既存の class 網羅・境界テストの期待値更新、補正表のテスト（正の有限値・未登録は 1）、本番 DOM golden への影響確認。
5. HV: 390×844 動画（Owner へ直接提出、repo 非コミット）＋ Before/After スクショ（`docs/reports/screenshots/topping-size-final/` の off と新値）、必要なら iPhone 実機。
6. S3（CUT の `TOPPING_REACH` のランク連動、Issue #479 D7）は未着手で、本作業の範囲外。大・xl で CUT 後の半分表示を確認する必要あり。

## 次の作業
1. Owner: 「B を基本」「補正の対象（black-olive / jalapeno / pepperoni / salami / bacon / spinach / arugula）」「mozzarella 別枠の可否」を判断。
2. 承認後、S2c として上の 1〜4 を実装し、Preview（A/B/C 切替）で HV 動画を撮影。
3. S3（CUT reach）と S4（見かけ補正の確定）は #503（SVG 化）のマージ後に再測定してから確定。

## 制約確認
チーズ溶融表現・採点・保存・経済・CUT: 未変更。共有 Preview・本番: 未変更。追加物は spec 1 本・レポート 1 本・画像/JSON のみ。BAKE / CUT / RESULT 時の見え方は今回未確認（PREPARE のみ）。
