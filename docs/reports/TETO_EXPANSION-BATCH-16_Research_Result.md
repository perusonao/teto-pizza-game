# Expansion Batch 16 — 梅しそピザ（ume-shiso-pizza）調査・実装計画 Result（docs-only）

Status: **調査と実装計画のみ。** コード・テスト・データ・保存仕様・ladder は未変更。実装・PR 作成・merge・共有 Preview / Production 更新・scratch 実装・CI 再実行・Monitor 作成なし。
基準 `origin/main` = `079da33`（#730 炙り Production ON / #729 蒸す S1 まで）。**Batch 15 #731 は open（未 merge）**。branch `claude/expansion-batch-16-research`（main から）。
UI/UX の実装ではないため HV 動画・スクリーンショットは対象外。

## 0. 原典の扱い（最初に）

**pizzadb.jp は引き続き到達不可で未確認。** 根拠は repo 内の証跡だけ（比較表 p14 の 1 行、ChatGPT 中継 2026-09-22、独立再取得なし、corroboration 0、`docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json`）:

| 項目 | 証跡 |
|---|---|
| 名称 | 梅しそピザ（日本 / 各地） |
| 食材（原文） | **梅肉 / 大葉 / モッツァレラ / しらす**（canonical: `umeboshi-paste` / `shiso` / `mozzarella` / `whitebait`。`umeboshi-paste` は repo の canonicalizer が 梅肉 に付けた id で、原典の語ではない） |
| ソース欄 | 「その他」→ matrix は `unspecified`、blocker `BASE_SAUCE_UNSPECIFIED`、`BLOCKED_PRODUCT_DECISION`（Phase-2 は `BLOCKED_EVIDENCE`、証跡区分 B = 比較表のみ） |
| 生地 | 薄めの生地（本ゲームは丸 1 種。再現しない） |
| 個数・焼成条件・投入タイミング・下ごしらえ | **記載なし**（matrix の `prep` / `postBakeFinish` は空） |
| 補足 | `梅肉` は「肉」の字を含むが**梅の果肉**（`false_friend_not_meat`。肉 family に入れてはならない） |

以下の個数・焼成窓・ソースの扱い・色・投入タイミングは **すべて GAMEPLAY ASSUMPTION / 未確定**。「既存資料に根拠がない」項目は §9 の Owner 判断にした。

## 1. 最新状況・重複・claim

| 項目 | 結果 |
|---|---|
| main | `079da33`。#730（炙り Production ON）・#729（蒸す S1）が merge 済み。`PINSA_PRODUCTION = true` / `LATE_CATALOG_PRODUCTION = true` / `FREE_COOK_FINISH_PRODUCTION = true` / `SEAR_EXPERIENCE_PRODUCTION = true`、`PREP_EXPERIENCE_PRODUCTION = false` / `STEAM_EXPERIENCE_PRODUCTION = false`（コードの値。先行レポートの「late・FINISH は本番 OFF」という書き方は現状と合わない） |
| 重複 | `ume-shiso` / 梅 を含む open PR・branch・Issue **なし**。出荷済みレシピにもなし。B16 専用の Issue・claim は**未作成**（調査のみのため。実装 GO 時に起票） |
| Batch 15 #731 との関係 | **意図的に重複を避けた**: B15 は ladder step を作らない（ladder 73 のまま）。B16 は新材料で ordinary step を 1 つ増やす。B15 の変更範囲（`recipes.ts` 末尾、`B15_BATCH`、各 pin、golden）と **ファイルが重なる**ため、**#731 を先に merge → B16 が main を取り込む**（`Depends-on: #731`）を提案。B16 の manifest は `afterRecipeId: "nigerian-suya-pizza"` になる |
| 有効な claim | #726（蒸す、S1 は merge 済み）、#728（B15、PR #731）。B16 のファイルと #726 の steam 系ファイルは重ならない |
| 先行資料の訂正 | Spec / Verification Result で「B16 の ume-shiso は step 74」と書いたのは**誤り**。ordinary ladder は 66 step なので、新しい ordinary step は **67**（late の導出番号が +1 され、ladder 総数 73 → 74） |

## 2. 材料

| 材料 | 状態 | 備考 |
|---|---|---|
| mozzarella | 既存（starter） | |
| shiso 大葉 | 既存（ordinary step 54、herb、`shiso-leaf` SVG） | shirasu-pizza と共有 |
| whitebait しらす | 既存（step 54、seafood、`whitebait-school` SVG） | shirasu-pizza の Research cohort key |
| **umeboshi-paste 梅肉** | **新食材 1 つが必要**（repo に存在しない） | §4 |

→ **既存食材だけでは追加できない（新食材 1）**。新調理法は不要（§3）。

## 3. 調理工程

- 既存の SAUCE（PAINT）→ CHEESE → TOPPING → BAKE で表現でき、新しい機構は不要（matrix: `FULL`、`requiredCapabilities` 空）。炒め（Prep）・炙り（Sear）・蒸し（Steam）は対象外（それぞれ beef / sausage / clam・mussel のみ）。
- **投入タイミングは原典に記載なし。** 既存の中継証跡（#587、ChatGPT 取得・独立再取得なし）は別レシピについて: shirasu-pizza は「しらす: 仕上げ数分前」「大葉: 指定なし」、ikura-salmon は「いくらと大葉は焼成後」。梅しそピザ自体の証跡はない。
- 出荷済みの shirasu-pizza（shiso・whitebait）は **全て焼成前**（Owner OD-B8）。同じ素材の組み合わせなので、**焼成前に揃えるのが既定案**。ただし FINISH（後乗せ、`FREE_COOK_FINISH_PRODUCTION = true`、late catalog の `bbq-chicken-pizza` の cilantro が前例）が使える状態なので、大葉を POST_BAKE にする選択肢もある（原典根拠なし → Owner 判断 D4）。

## 4. 新食材 umeboshi-paste の扱い（最大の論点）

ソース欄「その他」と 梅肉 の関係は 2 通りに読める。**どちらも資料に根拠はない**（Owner 方針: 「ソース未指定は一律 NO_SAUCE にしない」）。

| 案 | 内容 | 長所 | 短所・リスク |
|---|---|---|---|
| **O1: ソース（spread・PAINT）** | `umeboshi-paste` を sauce 型の新食材にし、SAUCE 工程で塗る。ソース欄「その他」を「梅肉のペースト」と読む（**推測**） | NO_SAUCE 例外が**不要**。既存の PAINT のみ。sauce は topping family を持たないため **family の Owner 承認（L1）が不要**（`false_friend_not_meat` に触れない）。新 SVG 不要（sauce は emoji 表示、豆板醤 🫙 と同じ） | 「原典の梅肉は塗るのか」は未確認。sauce が 1 つ増える（Hint 5.0 の BASE 段・DH4 の sauce 件数に影響、要検証）。色の識別（§4.1） |
| O2: トッピング（scatter）+ NO_SAUCE | 新 SVG（梅肉の小片）、family を Owner が決める（果実系は repo に枠がなく、`other` を選ぶと DH4 gate の月見型抵触の恐れ）、NO_SAUCE は**suya に続く 2 件目の例外** | 原典の「ソース無し」にも読める | **例外の増加**（Owner 方針に反する方向）、family 承認と DH4 検証、新 SVG・HV の追加作業。大きい |
| O3: 保留 | 原典確認を待つ | 仮定ゼロ | B16 が進まない |

**推奨（整理）: O1。** 理由: 追加の例外・family 承認・SVG が要らず、既存機構だけで済む。ただし「梅肉をソースとして塗る」は**推測**なので、Owner の明示承認が前提（B14 の「白ソース = fromage-blanc-sauce」と同じ種類の 1 件限りの判断）。

### 4.1 色（O1 の場合・暫定）
識別の目安として CIE76 ΔE を計算した（暫定色。確定は実機 HV）:

| 候補色 | vs tomato-sauce `#c73b2e` | vs doubanjiang `#8a2b1c` | vs 生地 `#e8c98f` | vs curry-ketchup |
|---|---|---|---|---|
| `#b8405a`（赤みの強い梅色） | 29 | 26 | 64 | 58 |
| `#c9506b` | 31 | 31 | 61 | 58 |
| `#a83250`（濃い） | 31 | 25 | 67 | 61 |

doubanjiang の検討では「トマトとの ΔE 22 は可、10 は不可」だった。上の候補は 25–31 で、**トマト・豆板醤・生地のいずれとも識別できる見込み**。ただし赤紫系の「焼いた後の色」は未測定。**emoji は G18（他食材と重複不可）**: 候補 🍑（1F351）・🌸（1F338）は `ingredients.ts` で未使用（確認済み）。名称は原典語の「梅肉」が第一候補（Research ラベルは `？？？ピザ（梅肉）`）。

## 5. 既存レシピとの類似性

識別集合（ソースを含む食材 id、個数無視）を既存 85 レシピ（late catalog 含む）と比較（O1 / O2 とも項目は同じ `{mozzarella, shiso, umeboshi-paste, whitebait}`）:

| 比較 | 結果 |
|---|---|
| 完全一致 | なし |
| 部分集合・上位集合 | **なし**（sauce を含めた集合では、shirasu-pizza `{lemon, mozzarella, shiso, whitebait}` と互いに部分集合でない） |
| 最近傍 Jaccard | **shirasu-pizza 0.60**（mozzarella / shiso / whitebait が共通、lemon ↔ 梅肉が違い）。次点は yuzu-shrimp 0.33 |

- **0.4 以上の近傍が shirasu-pizza 1 件になる**（B15 の suya = rendang 0.60 と同型）。Owner 方針「Jaccard 0.4 未満の全体基準は変更しない」に対し、**B15 と同じく ume-shiso 限定の差別化例外**が要る（D3）。構造的保証（同一集合なし・部分集合なし・上位集合なし）は B15 のテスト形をそのまま使える。
- 補足（実装後に測るべき点。**今回は scratch を作っていないため未測定**）:
  - 「おしい」判定の差分: ume-shiso が加わると、shirasu の周辺（例 `mozzarella+shiso+whitebait`＝lemon なし・ソースなし）で、shirasu 側は ADD_ONE（d1）、ume-shiso 側は SAUCE_ONLY/ADD（d1）の**同点**になる。同点は hint 順（先に出荷された shirasu）が優先されるため、**既存の体験は変わらない見込み**（B15 の rendang と同じ仕組み）。実プール全体での測定は B15 の `expansionBatch15.step58.test.ts` と同形のテストで行う。
  - Hint の自動ターゲット: 新 step 67 では ume-shiso のほか、late の `wasabi-beef-pizza`（`LATE_ENTITLEMENT_FLOORS` の wasabi / soy-sauce が 67）も同時に makeable になる**可能性**がある（B14 の step 66 = moussaka + bbq-chicken と同型）。実装時に Inspector で確認が必要。

## 6. Research 表示

- 新 step 67 の**唯一の新材料が umeboshi-paste**で、これが ume-shiso の「最後に解禁される材料」（cohort key）。cohort は **単独メンバー → 文字なし**: `？？？ピザ（梅肉）`。
- **既存レシピのラベルは動かない**（B15 の rendang のような shift は発生しない見込み。shirasu の cohort key は whitebait で別）。`acceptedLetterShifts` は不要の見込み。実装時に全 ladder prefix で走査して固定する（B15 / B10 と同じテスト）。
- ラベルに recipe 名・id は出ない（INV-B7）。

## 7. 保存互換

- schema v2 のまま。新 id（食材 `umeboshi-paste`、レシピ `ume-shiso-pizza`）の追加のみ。save key・migration なし。
- 旧版で開いた保存は未知 ID として保持される（#674 の機構。`persistence.batch13` / `batch15` と同形のテストで固定）。
- **既存プレイヤーへの見え方**: 「発見数 ≥ 67」に達している保存は、ショップに梅肉が **NEW** として出る（他の batch と同じ。データは消えない）。第 4 章の総数が増えるため、**第 4 章を全達成済みの保存は未達成に戻る**（表示は導出）。
- late の導出番号が +1 される: `LATE_ENTITLEMENT_FLOORS` は不変で、既存の late 材料の解禁が後退しないことをテストで固定する（B13 / B14 の手順）。
- credited: 新材料の key recipe なので credited にする想定（B-1 / B13 / B14 と同じ。credited 76 → 77 〔#731 後〕）。**star gate は付けない**。

## 8. 実装計画（Owner 承認後。本書では未実施）

**前提**: #731 が merge 済み。D1〜D7 の Owner 判断。実装前に **scratch 検証（DH4 / 「おしい」/ Research）の承認**を得る（新食材のため B15 より重い。#578 B-1 では DH4 の旧ガード件数ピンが動いた前例）。

| 段階 | 内容 |
|---|---|
| S0 | 専用 Issue と claim（`recipes.ts`・`ingredients.ts`・`discoveryLadder.ts`・`App.css`（HOT）・`IngredientGlyph.tsx` は触らない見込み、`PROJECT_HANDOFF.md` は Owner 指示がなければ触らない）。`Depends-on: #731` |
| S1（データ、O1 の場合） | `ingredients.ts`（`umeboshi-paste`: sauce・spread・色・emoji）、`recipeSauceProfiles.ts`（ingredientId の型に追加＋ `ume-shiso-pizza: PAINT`）、`discoveryLadder.ts`（ordinary step 67 = umeboshi-paste、key `ume-shiso-pizza`、T4・星ゲートなし）、`recipes.ts`（mozzarella 2 / shiso 2 / whitebait 4 の 8 ピース案 + sauce 1、bake 58–78、credited、`lunchRush:false`、CUT なし、key-free）、`referencePizza.ts`・`orders.ts`・`discoveryCatalog.ts`・`recipeHintRoles.ts`。`requiredIngredients` の順は sauce → cheese → toppings（B14 の順序バグの教訓。Rule W と旧 Hint 2.0 H4 の一致を `selectableHint` / `hintFactMigration` で確認） |
| S2（pin・golden） | `catalogLedger`（recipes / ingredients 96 / ladder steps 74 / credited / 第 4 章）、`materialShop`（梅肉の行 + late +1）、`lateFloor`、CUT 非適格一覧、Lunch Rush opt-out 一覧、multi-recipe step 一覧（67）、manifest `B16_BATCH`（`afterRecipeId: "nigerian-suya-pizza"`）、Hint 5.0 golden（挿入のみを差分で確認）、DH4 audit（sauce 件数の番号シフト）、`deductionGuard.gate` の旧ガード件数ピンの原因分解（privacy assertion は緩めない） |
| S3（新規テスト） | `expansionBatch16.test.ts`（構成・非 NO_SAUCE・ソース = 梅肉・差別化: 同一 / 部分 / 上位集合なし + shirasu 0.60 の名前つき例外・既存の 0.4 基準は不変）、`persistence.batch16.test.ts`、cohort 文字（既存ラベル不変を全 prefix で）、step 67 の実プールでの「おしい」/ Hint / Research（B15 と同形）、色の識別テスト（ΔE の下限）、matcher / discoveryCatalog の承認例外（ume-shiso のみ） |
| S4（検証） | 全 Vitest を Pinsa ON / OFF、`tsc -b`、`oxlint`、`vite build`、Chromium E2E（390×844 / 360×800: ショップ NEW → 購入 → Research（漏えいなし）→ 梅肉を塗る → チーズ → 具材 → 焼成 → NEW DISCOVERY → 図鑑）、WebKit は CI、HV 動画（390×844）と before/after スクリーンショット |
| S5（Owner） | iPhone Safari 実機 HV、共有 Preview 更新の承認、merge 判断（HV 結果は Owner の言葉で記録） |

**O2 を選ぶ場合**は S1 に「新 SVG（`IngredientGlyph.tsx`・`App.css` の補正・ingredient-icons）」「`ingredientTaxonomy.ts` の family 行（Owner 承認）」「`toppingSizeClass`」「NO_SAUCE の suya 以外の例外」が加わり、DH4 の追加検証が必要（規模は B14 の cinnamon 相当 + family 判断）。

**変更が触る既存ファイル数の見込み**: O1 は B-1（豆板醤）と同程度（`ingredients` / `ladder` / `recipes` / `recipeSauceProfiles` / `referencePizza` / `orders` / `discoveryCatalog` / `recipeHintRoles` + テスト・golden）。`ingredientTaxonomy.ts` は sauce なので変更不要の見込み（B-1 では青ねぎの行だけが入った）。

## 9. Owner 判断が必要な事項（資料に根拠がなく、本書で確定していない）

| # | 判断 | 備考 |
|---|---|---|
| **D1** | 梅肉を **ソース（O1）/ トッピング + NO_SAUCE（O2）/ 保留（O3）** のどれにするか | O1 を整理上の第一候補としたが、「梅肉を塗る」は**推測**。「ソース未指定は一律 NO_SAUCE にしない」方針と整合するのは O1 |
| D2 | 1 件限りの承認として「ソース欄『その他』= 梅肉ペースト」と読むこと（B14 の白ソース充当と同種の承認） | matrix は `BLOCKED_PRODUCT_DECISION` のまま。承認例外を `discoveryCatalog.test` / `matcher.test` に ume-shiso のみ追加 |
| D3 | shirasu-pizza との Jaccard 0.60 を **ume-shiso 限定の差別化例外**として承認するか（0.4 の全体基準は不変、同一 / 部分 / 上位集合なしをテストで固定） | B15 と同形 |
| D4 | 大葉・しらすの投入タイミング: **全て焼成前（既定案、shirasu と同じ）** / 大葉を POST_BAKE（FINISH）にするか | 原典に記載なし。#587 の中継証跡は別レシピ（ikura: 大葉は焼成後、shirasu: しらすは仕上げ数分前・大葉指定なし） |
| D5 | 個数（仮案 mozzarella 2 / shiso 2 / whitebait 4 + 梅肉 1）、焼成窓 58–78、名称・説明文 | すべて暫定。原典に個数なし |
| D6 | 食材の名称（梅肉 / 梅干し / 梅ペースト）、emoji（🍑 or 🌸 など未使用のもの）、暫定色（`#b8405a` 付近） | 色・emoji は実機 HV で確定 |
| D7 | credited（key recipe。star gate なし、T4）でよいか | 新材料の batch は credited が前例 |
| D8 | 実装前に **scratch 検証（DH4 / 「おしい」/ Research / 新 step 67 の multi-recipe 確認）を行うことの承認** | 本調査では実施していない（新食材の追加を伴うため） |
| D9 | **#731 を先に merge する順序**（B16 は `Depends-on: #731`） | 件数 pin・manifest・golden が重なる |
| D10 | 原典確認: pizzadb.jp をネットワーク許可に追加して個別ページを確認するか | 現状は未確認のまま |

## 10. 実施しなかったこと

コード・テスト・データ・docs（本書以外）・`PROJECT_HANDOFF.md`・ladder・保存仕様の変更、レシピ・食材・step の追加、scratch 実装、Issue・PR の作成、merge、Production・共有 Preview 更新、CI 再実行、Monitor 作成、pizzadb.jp の取得（到達不可）、#731・#726・#728 など他の PR / Issue の変更。S2（蒸す Phase 1 S2）の設計書整理は、先に出た依頼（Batch 16 調査）を優先して**まだ着手していない**。
