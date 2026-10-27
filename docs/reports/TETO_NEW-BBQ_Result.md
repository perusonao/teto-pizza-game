# BBQ Chicken — BBQチキンピザ + バーベキューソース + パクチー（late catalog 方式）Result Report

Issue #611。ブランチ `claude/bbq-chicken-late-catalog`、基準 `main` `9761d03`。**未 merge。merge = 即公開（late catalog は本番 ON）。Owner HV・承認まで merge 禁止。**
Authority: Owner 承認（2026-10-27）Final Design Gate ＋ `docs/design/TETO_BBQ-CHICKEN_FINAL-DESIGN-GATE_2026-10-27.md`。

## 1. 何を出したか

| 項目 | 値 |
|---|---|
| レシピ | `bbq-chicken-pizza`（BBQチキンピザ）、late catalog、credited、全体 70 番目（Pinsa ON 時。Pinsa の前）、第 4 章 |
| 説明文 | 「甘辛いソースのチキンに、香菜をそえた一枚。」（時機を名指ししない） |
| 構成（**GAMEPLAY ASSUMPTION**、原典未確認） | BBQソース 1（焼成前 **PAINT**）/ モッツァレラ 2 / たまねぎ 1 / チキン 3 / パクチー 2（**焼成後 FINISH**）＝ソース以外 **8 ピース**（焼成前 6 ＋ FINISH 2） |
| 焼成窓・CUT | 58–78（Free Cooking の汎用窓と同じ）/ CUT なし / `lunchRush:false` |
| 新素材 | `bbq-sauce`（表示名「バーベキューソース」、spread、暫定色 `#7a2f1c`、emoji 🔥）、`cilantro`（表示名「パクチー」、scatter、family `herb`、size class `xs`、専用 SVG＝候補 A、プレースホルダ emoji 🌼、`bakeRoastResistant`） |
| ladder | late step（tahini の次）に 2 材料（bbq-sauce → cilantro）。番号は**導出**、星ゲートなし、T4、key-free。Research コホートの鍵は cilantro |
| 互換下限 | `LATE_ENTITLEMENT_FLOORS` に `bbq-sauce: 61` / `cilantro: 61` を追加。既存 57/58/59/59/60/60 は**不変** |
| Reference | 8 ピースの固定 8 点リング（`getReferenceSlots(8)` と完全一致、8 番目＝生地中央 (50,52)）。パクチーは `LIGHT_LEAF`、他は `HEAVY_SQUASH`、許容 8/22。**新しいピース数上限は設けていない** |
| 触れていないもの | 採点・経済・保存形式（schema v2）・エンジン（reducer / FINISH / ladder 純粋層）・DH4 gate の privacy assertion・Pinsa・`recipes.ts` |

## 2. 原典で確認できた事実と GAMEPLAY ASSUMPTION の区別

- 原典（pizzadb.jp）は本セッションから到達できず、個別ページは未確認。取得を偽っていない。
- 確認できているのは 172 レシピ matrix の行 `bbq-chicken-pizzadb` の材料（BBQソース / チキン / パクチー / モッツァレラ / たまねぎ）まで。
- **Q1–Q5（個数・焼成窓・色・タイミング等）はすべてゲーム用暫定仕様**で、原典の事実ではない。特に「パクチーを焼成後に置く」は matrix の `catalog_design_tag` 由来のゲーム設計であり、「原典が焼成後に載せる」とは書かない（コード内コメントも同様）。

## 3. 実測値（想定どおり）

| 項目 | 想定 | 実測（`catalogLedger.test.ts` で固定） |
|---|---|---|
| レシピ | 70 | **70**（credited 64） |
| 食材 | 77 | **77**（toppings 57） |
| ladder | 61 | **61**（late step 5 本、導出）|
| 第 4 章 | — | 34 件（Pinsa ON） |

## 4. 既存セーブ・Dex・Research・ladder への影響

| 観点 | 結果 |
|---|---|
| 既存セーブ | 台帳は縮まない。floors は 57/58/59/59/60/60/61/61。`lateCatalog.bbq.test.ts` で exact 固定。新 step の素材はセーブに載せず、ladder が読込時に付与（e2e で確認） |
| Dex / 保存 | schema v2 のまま。Dex 項目・未知 ID は保持 |
| Research | BBQ のコホートは単独（文字なし）。既存レシピの文字は動かない |
| ヒント | 永久 key-free。Hint 5.0 golden は**追記のみ**（`hint5.ladders55.json` +251 / −0、`hint5.alphaFamilyOnly.json` +1 キー） |
| FINISH | Free Cooking は FINISH で cilantro を置く。Guided は `DOUGH → SAUCE → CHEESE → TOPPING → FINISH`（reducer 実経路で検証） |

## 5. DH4 / privacy（gate は緩和していない）

- privacy 系 assertion は 1 行も変更していない。`deductionGuard.gate` の件数 pin は今回不変。
- `deductionProduction.gate` の「既存公開モデルで 1 候補になる」集合に `pesto-caprese` が戻った（測定値。ループ内の guard assertion はそのまま通過＝level `existence`・clause なし）。機構の詳細解析は未実施で、テスト内コメントにもそう記録。
- DH4 監査 JSON は候補件数の導出差のみ（category 55→56、family/group +1 など。cilantro が topping 母集団に増えたため）。
- 許可リスト `LATE_ADDITION_RECIPE_IDS` に `bbq-chicken-pizza` を追加。

## 6. 更新した pin（原因別）

| 原因 | 更新 |
|---|---|
| レシピ／食材／ladder 数 | `catalogLedger`（70/64/77/57/61、第 4 章 34、sauce 9、herb 9）、`catalogShelf` / `largeCatalogFixtures`（sauce 9） |
| late 末尾の増加 | `lateCatalog.{test,ikura,yuzu,dengaku,tahini}`、`e5.ikuraProduction`、`pinsa.production`、`recipeChapters`（第 4 章の late 数）、`lateAxis`、`materialShop`（offers に bbq-sauce / cilantro、最終 step 61） |
| 新 sauce／herb／sauce profile | `referencePizza.test`（sauce 集合に bbq-sauce）、`IngredientGlyph.test`（cilantro 専用 visual） |
| key-free 母集団 | `hint5Ladder.baseCompat`（44 レシピ、sauce+cheese 18） |
| golden | `hint5.ladders55`（追記のみ）、`hint5.alphaFamilyOnly`（+1 キー）、DH4 監査 JSON |
| 実装中に判明した修正 | 食材名を「BBQソース」→「**バーベキューソース**」に変更（`hintSteps` の「ヒント文に ASCII 文字を含まない」検査に抵触。検査は緩めず名称側を変更。§9 Owner 判断）／cilantro に `bakeRoastResistant` を付与（葉もの規則 `LIGHT_LEAF`、mint / shiso と同じ） |

U1〜U3 の e2e は、自分の late step を導出する形に更新（U3 のみ変更が必要）。

## 7. 検証

| 項目 | 結果 |
|---|---|
| 新規テスト | `lateCatalog.bbq.test.ts` 19 件通過 |
| フル Vitest | **532 files（531 passed / 1 skipped）、9,846 tests passed、13 skipped、4 todo、0 failed** |
| 型・lint | `tsc -b` 通過、`oxlint` エラーなし（既存 warning のみ） |
| E2E | §8 |
| WebKit | サンドボックスに無く未実行（CI のみ） |

## 8. E2E

- 新規 `e2e/new-bbq.spec.ts`（390×844 / 360×800 各 2 本）通過。Shop NEW → 購入 → Research（ID 漏れなし）→ ソース塗り → チーズ → 具材 → 焼成 → FINISH でパクチー 2 → NEW DISCOVERY → Dex。
- `console.error` 判定から、ブラウザ自身の `/favicon.ico` 404（dev server、ゲームと無関係）だけを除外した。他のエラーは従来どおり失敗扱い。
- 全体回帰（Chromium、iphone-390x844、`--workers=4`）: **525 passed / 96 skipped / 11 failed**。11 件は負荷（4 並列）または sandbox の `/favicon.ico` 404 による `console.error` 判定で、BBQ とは無関係:
  - 8 件は `--workers=2` で再実行して通過（`discovery-dex-hint`、`lunch-rush-r8-restore` ×2、`research-failed-trial`、`sauce-edge-475`、`sauce-layers-b2`、`square-dough-visual`、`expansion-grandma`）。
  - `dough-size-status-474` は 30 秒 timeout 付近（直列で通過、29.4s）。
  - `discovery-hint-sheet` と `expansion-batch8a` は `console.error` 空判定が `/favicon.ico` の 404 で失敗（既存 U1/U2 でも同じ散発事象。U3 Result に記載済み）。未変更 `main` での比較実行はしていない。
  - U1 / U2 / U3 の e2e は `new-bbq` と併せて通過（U2 の 1 回は favicon 404）。

## 9. Human Verification（`TETO_HUMAN-VERIFICATION-POLICY.md`）

- スクリーンショット（committed）: `docs/reports/screenshots/new-bbq/`（SVG と完成ピザの比較画像を含む）。
- 動画（**commit しない**。Owner へ直接提出）。
- **実機（iPhone Safari）で確認してほしいこと**: ①バーベキューソース `#7a2f1c` が生地・トマトソース・豆板醤と見分けられるか、②**FINISH のパクチー 2 個**（`xs`）の視認性、③パクチー SVG（候補 A）が焼いたピザ上で読めるか。
- **Owner の実機 HV は未実施。**

## 10. リスクと注意

1. **merge = 即公開**。HV 前の merge は禁止。
2. **原典未確認**: パクチーの時期などが後から確認された場合、構成の再分類（通常 ladder への移行は floors の再検討を伴う）が必要。
3. HOT ファイル: `lateCatalog.ts` / `referencePizza.ts` / `recipeSauceProfiles.ts` / `hint5.ladders55.json` は **Draft PR #540 も触る**。後から merge する側が追従する。`recipes.ts` は未変更。
4. #578 の U3 claim が残存（期限 11/02）。本作業は #611 に別 claim を投稿して区別する。

## 11. Owner 判断事項

1. 表示名: 「パクチー」（現状）か「香菜」か。食材名「バーベキューソース」（ASCII 検査のため変更）で良いか、あるいは検査側の例外化か。
2. 実機 HV（ソース色・パクチーの視認性・FINISH の操作）と最終承認。HV 後に merge。
3. 暫定値（個数・焼成窓・色・size class・パクチー焼成後）の確定、または原典確認後の再設計。
4. 注文文（`lineJa`）の文言確認。
5. #578 U3 claim の解放（Owner 承認が必要）。
