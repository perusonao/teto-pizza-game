# B案再構成 Phase 3a — 厳選 60 品のカタログと段階割り当て Result Report（2026-11-26）

- 親 Issue: #901／設計: `docs/design/TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md` §3.2.4・§4（Phase 3 を 3a〜3e に分割）・§6
- 基準: `main` = `828702a`（Phase 2b PR #910 がマージ済み）
- PR: #912（**Draft。マージと Draft 解除は Owner 承認待ち**）
- 対象は **shop モード（`?progression=shop`、Preview / DEV）だけ**です。フラグ OFF（本番既定 legacy）の挙動と文言は変えていません

## 1. やったこと

| 項目 | 内容 |
|---|---|
| カタログ | `src/data/menuCatalog.ts` の `MENU_CATALOG`（`curated-60-v1`）に Owner の 60 品を 5 段階 × 12 品で投入。凍結し、一覧・段階・順序をテストで固定（`menuCatalog.test.ts`） |
| 段階の割り当て | shop の `chapterOf` はカタログの段階を返す（Phase 2a の暫定＝現行章 1〜4 から切り替え）。段階が開く評判（0／40／110／210／340）と称号ラダーは変えていない |
| 注文・Lunch Rush | Phase 2a で接続済みの `menuRecipeIds` がカタログを読むので、メニュー＝（初期メニュー ∪ 付与 ∪ 開発済み）∩ 60 品。注文（FREE の Mito 注文）と Lunch Rush の候補は 60 品からだけ出る |
| 図鑑 | `ProgressionModel.catalogRecipes()` を追加（legacy は `RECIPES` そのもの、shop は 60 品）。図鑑・HOME の図鑑ピルとカード・Pizza Select（練習）は shop で 60 品・5 段階 × 12 を数えて表示。RESULT の図鑑スロット（第○章 No.○）は、不採用レシピなら出さない |
| レシピデータ | 削除していない。不採用レシピは `RECIPES`・`ORDERS`・matcher・Dex に残る（legacy と追加配信用） |
| 材料 | **変えていない（Phase 3b）**。材料の段階は Phase 2a の暫定規則（全レシピの legacy 章の最小値）のまま。`ShopCatalog.materialEntries` に暫定カタログを置き、全評判で entitlement が Phase 2a と同じことをテストで固定 |

### 段階と評判

| 段階 | 評判 | 12 品 |
|---|---:|---|
| 第1段階 | 0 | margherita, marinara, funghi, bismarck, breakfast-pizza, pepperoni, salsiccia, bambino, hawaiian, melanzane-pizza, parmigiana-pizza, fugazza |
| 第2段階 | 40 | napoletana, tonno-e-cipolla, genovese, capricciosa, meat-lovers, pizza-portuguesa, aussie, brazilian-calabresa, grandma-pizza, pizza-bianca, quattro-formaggi, pesto-caprese |
| 第3段階 | 110 | spinach-artichoke-pizza, full-english-pizza, pesto-pollo, pesto-gamberi, puttanesca-pizza, vongole, chilean-napolitana, new-haven-apizza, pesto-vegetariana, ratatouille-pizza, prosciutto-funghi, veggie-supreme-pizza |
| 第4段階 | 210 | flammkuchen, sichuan-eggplant-pizza, curry-pizza-japan, cuban-pizza, california-style-pizza, shirasu-pizza, yuzu-shrimp-pizza, boscaiola, pescatore, frutti-di-mare, peking-duck-pizza, thai-chicken-pizza |
| 第5段階 | 340 | diavola-pizza, porcini-pizza, goulash-pizza, baingan-bharta-pizza, pesto-burrata-pizza, pesto-noci-pizza, buffalo-chicken, speck-e-brie, apple-cinnamon-dessert, peruvian-aji-amarillo, south-african-boerewors, ikura-salmon-pizza |

## 2. 範囲外（変えていないもの）

- 食材の段階解禁（77 種、第4段階の評判 275 分割）＝ Phase 3b
- 研究ポイント・判明ヒント ＝ Phase 3c・3d
- Dinner のメニュー経由解放、ヒント／開発対象の 60 品への絞り込み、不採用の完全一致をオリジナルピザ扱いにする件（Q4）＝ Phase 3e
  - そのため、図鑑の集約 🎨 カード・研究エントリ・HOME の「開発できるメニューがあるよ」吹き出しは `RECIPES` を読むまま
- Scoring、調理システム、legacy の挙動と文言

## 3. 論点（Owner 判断・3b 以降で扱う想定）

1. **材料が段階より遅いレシピ**（材料が Phase 2a の暫定規則のままのため）：16 品
   - 第1段階：marinara・pepperoni・salsiccia・bambino・hawaiian・fugazza（材料は第2段階）
   - 第2段階：napoletana・tonno-e-cipolla・genovese・pizza-bianca・quattro-formaggi・pesto-caprese（第3段階）
   - 第3段階：spinach-artichoke-pizza・full-english-pizza・prosciutto-funghi・veggie-supreme-pizza（第4段階）
   - 第5段階の 12 品は、材料がすべて第4段階（評判 210）でそろう
2. **メニューは段階で閉じていない**（設計どおり、段階は材料経由で効く）。3b で材料の段階を厳選カタログから導いた場合でも、材料だけでは段階より早く開発できるものが 6 品ある：第2段階 meat-lovers・aussie・grandma-pizza（第1段階の材料でそろう）、第3段階 chilean-napolitana（第2段階）、第5段階 porcini-pizza・baingan-bharta-pizza（第4段階）。`MATERIAL_CHAPTER_OVERRIDES` で寄せるか、メニューに段階の条件を足すか
3. **不採用レシピを完全一致で作った場合**：3a では従来どおり Dex に記録されるが、メニュー・注文・shop の図鑑には出ない（オリジナルピザ扱いは 3e）
4. R4 読み替え表の結論が必要になった判断は無い
5. `canEnableShopProgression()`（Production 切替の前提条件）は、カタログが入ったので true になった。Production 既定は `legacy` のまま（`progressionModelFlag.ts`）

（参考）3b で材料を厳選カタログから導くと、段階ごとの新しい材料は 14／9／13／23／15 種（計 74 種。開始時の材料を除く）。

## 4. テスト

| ファイル | 件数 | 内容 |
|---|---:|---|
| `src/data/menuCatalog.test.ts` | 8 | 60 品の一覧・段階・順序、12 品ずつ、マルゲリータは第1段階、凍結、上書き表は空、不採用レシピが `RECIPES` に残る |
| `src/logic/progression/shopProgression.test.ts` | （置換 3） | 厳選カタログがレシピを決める／不採用は段階なし／材料は全評判で Phase 2a と同じ |
| `src/state/gameReducer.shopCatalog3a.test.ts`（新） | 9 | shop：不採用はメニュー外・ガイド不可、注文 80 回が全部採用レシピ、Lunch Rush の候補、段階＝カタログ、評判の区切り、到達可能性（第5段階の評判で 60 品すべての材料が売られる） |
| `src/components/shopModelUi.phase3a.test.tsx`（新） | 8 | shop：図鑑・HOME・Pizza Select が 60 品・5 段階 × 12、不採用は数えない・スロットなし |
| `src/components/shopModelUi.phase3a.legacy.test.tsx`（新） | 6 | legacy：`dexRecipes()` は `RECIPES` そのもの、章・数・HOME・図鑑・Pizza Select が従来どおり |
| `e2e/shop-catalog-3a.spec.ts`（新） | 4 | 実ブラウザ：legacy の図鑑は全件／shop の HOME ピル 2/60、図鑑 5 段階 × 12、Pizza Select の x/12 |

### 既存テストの変更（理由）

- `menuCatalog.test.ts`「Phase 1b: empty」：空であることが前提だったので、60 品の固定に置き換え
- `shopProgression.test.ts`「curated catalog is still empty → interim」：同上。材料が Phase 2a と一致することの確認を追加
- `reputationTable.gate.test.ts`：`MENU_CATALOG` が空で gate が false、という前提を、空のカタログでは false・60 品で true に変更（判定関数は不変）
- `gameReducer.shopService.test.ts`：`interim` が true の確認を、false かつ 60 品に変更

削除・スキップ・緩和はしていない。

## 5. Human Verification

- スクリーンショット：`docs/reports/screenshots/b-phase-3a-catalog/`（before 6 枚 = `main` `828702a`、after 6 枚。390×844）

| # | 画面 | before | after |
|---|---|---|---|
| 01 | HOME（legacy） | レシピ 3/116 | 変化なし |
| 02 | 図鑑（legacy） | 第1章 1/6 … 第4章 1/79 | 変化なし |
| 03 | HOME（shop） | レシピ 3/116、開発 3/116 | レシピ 2/60、開発 2/60（不採用の pizza-salad は数えない） |
| 04・05 | 図鑑（shop） | 4 章 6／12／19／79（116 品） | 5 段階 × 12（60 品） |
| 06 | Pizza Select（shop） | 開発 1/6・1/12・0/19・1/79 | 開発 1/12・1/12・0/12・0/12・0/12 |

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `B-PHASE-3A_shop-catalog-60_390x844.mp4`（H.264） | 390×844 | 39.2 s | 0.93 MB | PASS |

Download: セッション内で直接提出しました（リポジトリには commit していません）。

Video Verification: PASS

確認ポイント（動画の順。評判 45、マルゲリータ・カプリチョーザ・不採用の pizza-salad を開発済みのセーブ）:
1. legacy の HOME と図鑑は変わっていない（「発見 3 / 116」、第1章 1/6 … 第4章）
2. shop の HOME：「レシピ 2/60」「開発 2/60」（pizza-salad は数えない）
3. shop の図鑑：第1章〜第5章、各 12 枠（1/12・1/12・0/12・0/12・0/12）
4. Pizza Select（練習）：各章「開発 x/12」、カードはメニューのレシピだけ
5. 「注文を受ける」：注文は採用レシピ（マルゲリータ）

## 6. ローカルの結果

（PR 本文の「検証」を参照）
