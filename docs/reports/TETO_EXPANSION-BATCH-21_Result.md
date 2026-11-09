# Expansion Batch 21 / RB-01 — taco-pizza・okonomiyaki-style-pizza Result Report（#780、暫定仕様・原典未確認）

> **2026-11-09 追記（重複の解消）:** 本書は、この PR（#798）の最初のコミット `8694b3f4` に含まれていた **B21 の独立実装の記録**です。同じ B21 の実装が別 session の PR #799（lettuce／cabbage の専用 SVG 配線を #797 から行う側）にもあり、2 本は同じファイル 50 本を触って 59 箇所で衝突するため、Owner の「同じ変更を二重に実装しない」に従い、**B21 のコード（`src/**` の B21 部分・golden・E2E・スクリーンショット）を本 PR から取り除きました（履歴には残る）。B21 のコードの正本は #799。** 本書の測定値（Q-2 の 3 層測定、逸脱 3 件、テスト結果、staged の最小編集）は #799 側の確認材料として有効で、そのまま記録として残します。「本 PR に含まれる」と読める記述は、すべて `8694b3f4` 時点のものです。後続の Owner 判断（Q-2 の 6 箇所の個別承認、tortilla-chips = vegetable・cheddar = l の追認、lettuce／cabbage の専用 SVG 採用）は #799 で反映されます。


**状態: Draft PR・Gate HOLD（merge 不可）。** Owner の Q-1〜Q-5 承認（2026-11-09）に基づく実装。**Q-2 の停止条件に当たる測定結果が 1 件あり（§3）、Owner の再承認が出るまで merge しない。** Production ON・共有 Preview 更新はしていない。
**ブランチ:** `claude/teto-pizza-content-master-plan-k8jmjv`（main `348b1e4` 基準。作業中に main は動いていない）。
**claim:** #790 の release 済み（6721260429／6724920776）を再確認 → #780 に B21 claim（コメント 6729748927）。#417 に B23（デザート SVG、未配線）claim（6729791686。別 session の B21／B22 13 種の claim 6724929630 とは重ならない）。

## 1. 実装内容（件数は実測）

| 項目 | 内容 |
|---|---|
| 新レシピ | `taco-pizza`（タコピザ）／`okonomiyaki-style-pizza`（お好み焼き風ピザ）。**late カタログ**、credited、key-free Hint、`lunchRush:false`、CUT なし、焼成窓 58–78、報酬 100 Pitz |
| taco-pizza | tomato-sauce 1（PAINT）／cheddar 2／beef 3／fresh-tomato 2／lettuce 2＋tortilla-chips 2（後乗せ） |
| okonomiyaki-style-pizza | okonomiyaki-sauce 1（PAINT）／cabbage 3／pork 3／mayo 1／bonito-flakes 2／nori 1（後乗せ）。チーズなし |
| 新食材 6 | cheddar（cheese）・lettuce・tortilla-chips・cabbage・bonito-flakes（topping）・okonomiyaki-sauce（sauce）。すべて T4（120／60 Pitz）、late step 79（cheddar・lettuce・tortilla-chips）／80（okonomiyaki-sauce・cabbage・bonito-flakes）、互換下限 79／80。専用 SVG なし（絵文字がそのまま描画） |
| 注文文 | `order-taco-pizza`／`order-okonomiyaki-style-pizza`（承認された 2 行） |
| Reference | taco 11 個・okonomiyaki 10 個。8 スロットを超えるため RT-01 の複数リング配置（`assignReferenceSlots`、pizza-portuguesa と同じ方式）。lettuce・cabbage も HEAVY_SQUASH（LIGHT_LEAF は葉ハーブだけ、既存テストが固定） |
| 件数（実測） | recipes 95（Pinsa 開）／94、credited 83、ingredients 106、toppings 73、ladder steps 80、章サイズ [6, 12, 19, 58]、棚: sauce 17・cheese 16・vegetable 27・seafood 12・other 3。スラック（credited − steps − 直接ゲート 2）は 1 のまま（+2 / +2） |

変更したファイル（HOT）: `lateCatalog.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`（union に `okonomiyaki-sauce`）・`referencePizza.ts`。`recipes.ts`・`ingredients.ts`・`discoveryLadder.ts`・`persistence.ts` は不変。late の step・floor・taxonomy・size class・discovery target・order は `lateCatalog.ts` 内。
テスト・golden: 件数 pin（catalogLedger ほか約 25 ファイル）、`lateCatalog.b21.test.ts`（新規 23 件）、hint5 ladders／alphaFamilyOnly golden（追記のみ）、DH4-1 audit、`techniqueAllowlists`（`LATE_ADDITION_RECIPE_IDS` に 2 ID、DH4／Hint 5.0 privacy ゲートの再実行を伴う）、`recipeBatchManifest`（`B21_BATCH`）。

## 2. Owner 承認からの逸脱（3 件。いずれもテストが強制したもので、Owner の追認が必要）

| # | 承認内容 | 実装 | 理由（実測） |
|---|---|---|---|
| D-1 | lettuce 🪴／cabbage 🥬 | lettuce 🥙／cabbage 🥘 | 🪴・🥬 は Hint 5.0 の family 記号（herb／vegetable、`familyDisplay.ts`）。G18 が「食材の絵文字は family 記号と一致してはならない」を固定。staged の事前検証は食材どうしの重複しか見ていなかった。専用 SVG（#417）が入れば絵文字は不要になる |
| D-2 | tortilla-chips family `other` | `vegetable` | `other` は DH4-PROD gate（OD-DH4-2-9「その他は到達不能」）が不合格になる（B20-A の walnut と同じ実測）。corn（vegetable）に倣った |
| D-3 | cheddar のサイズ「既存の個別サイズ」 | `l`（mozzarella／fontina と同じ） | 散らす食材はサイズ表への登録が必須（網羅テスト）。決定パッケージの記述が不正確だった |

## 3. Research（Q-2）— **停止条件に該当する結果が 1 件**

| 項目 | 結果 |
|---|---|
| 正準順の既存ラベル変化 | **0 件**（全 prefix、late 込み。テストで固定） |
| 承認表（17 ID）の再現 | 承認表を測定した時と同じ標本（B21 前のラダー）で測ると、**17 ID・変更文字列とも完全一致**（`lateCatalog.b21.test.ts`） |
| **本番のラダーで測ると** | 同じ 17 ID だが、**4 ID に承認表に無い変更文字列が計 6 つ**: pesto-burrata-pizza `I->J`・`K->L`／pizza-feta-eliniki `H->I`・`J->K`／potato-mayo-pizza `B->C`／wasabi-beef-pizza `D->E`。**新しい ID・正準順の変更はなし** |
| 原因 | 承認表は staged の mock（新 6 食材がラダーに無い）で測定されたため、「全ラダー食材所有」や乱数順の標本に新食材が含まれなかった。本番では含まれ、fresh-tomato／mayo／beef／pork を共有するコホートの人数が増えて同じレシピが 1 文字深くずれる |
| 対応 | Owner の Q-2 条件（「変更内容が増えた場合は停止」）に従い、**増えた 6 件を「再承認待ち」として固定**（テスト名に STOP CONDITION と明記。承認表と一致しない変更が他にあれば落ちる）。**本 PR は Owner の再承認まで merge しない**（Draft／Gate HOLD） |

過去バッチ（B18／B19／B20-A）の監査テストは、自バッチ時点の範囲に固定するため「B21 のレシピと late step を除いた標本」で測るよう `researchLabelAudit.ts` に任意引数（`ladderSteps`）を追加（既定は不変）。各バッチの承認表は無改変で再現される。

## 4. staged（T-FX 領域）への最小編集

taco・okonomiyaki と新 6 食材を staged から外した（84→82 レシピ、70→64 食材）。#783／#792 と同じ扱い: `stagedCatalog.ts` の in-flight 表、`whatIfSupport.ts`、`testSupport/*` の 2＋6 行（`usedBy`・`inFlightIngredients` の追従）、期待値、golden（decisions／rejudge／stagedGate／whatIf.*）を再生成。`stagedPromotion.firstTrain.test.ts` は「dossier = 出荷データ」の一致を固定する形に書き換え（モックは不要になった）。T-FX の担当へ通知（#780 コメント）。生成器 `stage-gen.py.txt` の除外表も追従（入力の #781 rows は未取得のため再生成はしていない）。

## 5. テスト結果

| 項目 | 結果 |
|---|---|
| `npx tsc -b` | エラー 0 |
| `npm run lint` | エラー 0（警告は既存ファイル） |
| `npm run build` | 成功 |
| 全 Vitest（最終実行） | **641 ファイル合格／1 skipped、11,776 件合格／13 skipped／2 todo、失敗 0**（1,358 秒、Pinsa 開の本番設定） |
| 新規 `lateCatalog.b21.test.ts` | 23 件合格（OFF の巻き戻し、データ一致、Reference、識別、ladder／Shop／floor、Research 3 層、`B21_BATCH` の検証、実 reducer での Free Cooking 2 品×2 ケース） |
| Playwright（Chromium、390×844 と 360×800、`e2e/b21.spec.ts`） | 6／6 合格（各レシピ: Research から新ソースを塗る→具材→焼成→FINISH で後乗せ→NEW DISCOVERY→Dex。未起動セーブで 6 食材が付与される） |
| WebKit E2E・CI・Codex | PR 作成後に実施（結果は PR に記録） |

## 6. 見た目（390×844、`docs/reports/screenshots/b21/`）
絵文字がそのままピース／チップとして描画される（専用 SVG なし）。気づき: lettuce の 🥙 はラップに、cabbage の 🥘 は鍋料理に見える（Owner 承認の 🪴／🥬 が使えないための暫定）。後乗せの 3 種（レタス・チップス・のり）は仕上げ段で置ける。

## 7. HV（iPhone Safari）依頼
共有 Preview は更新しない（Owner 承認なし）。動画（390×844）はユーザーへ直接送付済み、スクリーンショットは上記ディレクトリ。実機 HV の確認項目: ①Shop に 6 食材が NEW で並ぶ ②okonomiyaki-sauce の色（#5a3420）が生地と見分けられる ③レタス／キャベツの絵文字の見え方（SVG を待つか差し替えるか）④10〜11 個のピースを置いても操作できる ⑤NEW DISCOVERY と図鑑。専用 URL の準備は Owner の指示を待つ（B19 の LAN 方式の先例あり）。

## 8. 未実施・Owner 判断
- Q-2 の再承認（§3、6 件）／D-1〜D-3 の追認（§2）。
- 食材 6 種の専用 SVG は別 session が #417 で claim 済み（B21 分）。配線は別 PR。
- 原典（pizzadb.jp）は全値未確認のまま。
