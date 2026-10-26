# New Sauces Phase B U3 — ナスとタヒニのピザ + タヒニ + ザクロ（late catalog 方式、S2）Result Report

Issue #578（claim 投稿済み: https://github.com/perusonao/teto-pizza-game/issues/578#issuecomment-6418627022）。ブランチ `claude/u3-eggplant-tahini-s2`、基準 `main` `28f04f4f`。**未 merge・共有 Preview 未更新・本番変更なし。** late catalog は本番 ON のため、merge は**即公開**になる。Owner の実機 HV と最終承認までは merge しない。
Authority: Owner 承認（2026-10-26）「U3 暫定仕様」＋ `docs/design/TETO_NEW-SAUCES-U3_FINAL-DESIGN-GATE_2026-10-26.md`。

## 1. 何を出したか

| 項目 | 値 |
|---|---|
| レシピ | `eggplant-tahini-pizza`（ナスとタヒニのピザ）、late catalog、全体 69 番目（Pinsa の前、Pinsa ON 時）、第 4 章の 33 件目 |
| 構成（**GAMEPLAY ASSUMPTION**、原典未確認） | タヒニ 1（焼成前 **PAINT**）/ ナス 3（焼成前・事前加熱なし）/ パセリ 1（焼成前）/ ザクロ 2（**焼成後 FINISH、POST_BAKE**）。チーズなし |
| 焼成窓・CUT | 58–78 / CUT なし。Lunch Rush・Dinner 対象外（`lunchRush:false`） |
| 新素材 | `tahini`（タヒニ）: late 専用ソース（spread）、色 `#7b6a58`（**Owner 承認 2026-10-26**、実機 HV 後に PR #673 で `#a58a63` から変更。§6b）、emoji 🥣（トレイ／ショップ用の代替のみ）。`pomegranate`（ザクロ）: late 専用トッピング（scatter）、色 `#c4163f`、family `fruit`、size class `xs`、専用描画 `pomegranate-aril`（**候補 A′**、`docs/design/references/ingredient-icons-2.0/pomegranate.svg`）、emoji 🟥（表示されない代替のみ、G18 重複なし） |
| ladder | late step（dengaku の次）に 2 材料（tahini → pomegranate）。番号は**導出**（現在 60）、星ゲートなし、T4、credited、key-free。Research コホートの鍵は `pomegranate`（単独メンバー、既存レシピの文字は動かない） |
| 価格・補充 | T4 規則。タヒニ 初回 120 Pitz = 10 回分、補充 60。ザクロ 初回 120 Pitz = 10 ピザ分（k=2）、補充 60 |
| 互換下限 | `LATE_ENTITLEMENT_FLOORS` に `tahini: 60` / `pomegranate: 60` を追加。57 / 58 / 59 / 59 は**不変** |
| Reference | 6 ピース（ナス 3 / パセリ 1 / ザクロ 2）。**パセリは `LIGHT_LEAF`**（葉もの規則）、ザクロは `HEAVY_SQUASH` |
| 触れていないもの | 採点・経済・保存形式（schema v2）・既存 floors・エンジン（reducer / FINISH / ladder 純粋層）・DH4 gate の assertion・Pinsa・`recipes.ts`（HOT）・`PROJECT_HANDOFF.md`・Style Lock 本文（別 docs-only PR） |

エンジンのコード変更はない（データ表の追記、描画 1 件、CSS 1 セレクタ、テスト pin の更新、テスト支援の許可リスト／manifest 追記）。

## 2. 原典で確認できた事実と GAMEPLAY ASSUMPTION の区別

- **原典（pizzadb.jp）は本セッションから到達できず（HTTP 403）、個別ページは未確認。** 取得を偽っていない。
- 原典の構成（ナス / タヒニ / パセリ / ザクロ）は repo 内の中継証跡に基づく。**未確認のものはすべてゲーム独自の暫定仕様**（Owner 承認済み）: タヒニの使い方（→ 焼成前 PAINT）、ナスの事前加熱（→ なし）、パセリの時期（→ 焼成前）、ザクロの時期（→ 焼成後 FINISH）、個数 1 / 3 / 1 / 2、焼成窓 58–78、色。
- 説明文は時機を名指ししない（Anti-Oracle）。

## 3. 既存セーブ・Dex・Research・ladder への影響

| 観点 | 結果 |
|---|---|
| 既存セーブの解禁 | 台帳は縮まない。floors は 57 / 58 / 59 / 59 / 60 / 60。`lateCatalog.tahini.test.ts` で floors を exact 固定、`materialEntitlement.lateFloor.test.ts` は既存 4 値を `toMatchObject` で固定（新値の追加を許す） |
| Dex / 保存 | schema v2 のまま。Dex 項目・未知 ID は保持。通常 ladder は変更なし |
| 図鑑の章 | 第 4 章 32→33（Pinsa ON）。章クリアの印は後退しない（late recipe は印に不要、K2） |
| Research | タヒニピザのコホートは単独（文字なし）。既存レシピの文字は動かない（前後比較テスト、manifest 検証） |
| ヒント | 永久 key-free。Hint 5.0 golden は**追記のみ**（`hint5.ladders55.json` +202 / −0、`hint5.alphaFamilyOnly.json` +1 キー） |
| FINISH 以外の工程 | Free Cooking は常に CHEESE タブを提示する（このレシピはチーズなし → スキップ）。Guided は `DOUGH → SAUCE → TOPPING → FINISH`（CHEESE・CUT なし）|

## 4. DH4 / privacy（gate は緩和していない）

- privacy 系 gate（`deductionProduction.gate` 全件）と hardened guard の `toEqual([])` は、**全構成（下記 4 パターン）で通過**。privacy の assertion は 1 行も変更していない。
- **`deductionGuard.gate` の件数 pin 165 → 132 の原因分解**（OD-B9-15。同一ツリーで材料・レシピを別々に加えて測定。テスト内コメントにも記録）:

| 構成 | DH4-2A 旧件数 | 差分と原因 |
|---|---|---|
| 追加なし（main） | 165 | — |
| tahini のみ | 173 | +8（`zeroTopping` が全ソースを走査） |
| pomegranate のみ | 119 | −46（合成 family は TOPPINGS を**配列添字で**切るため、topping が 1 件増えると再編される。privacy ではない） |
| 両材料 | 127 | = 165 + 8 − 46（加法的） |
| 両材料 + レシピ | **132** | +5（仮説の母集団の公開カタログが 1 レシピ増える） |

  更新したのはこの pin 1 箇所のみ。いずれの構成でも他の 15 件（privacy 含む）は通過。
- 許可リスト `LATE_ADDITION_RECIPE_IDS` に `eggplant-tahini-pizza` を追加（privacy assertion は不変）。
- DH4 監査 JSON は件数の導出差のみ（category 候補 +1、aroma グループ候補 +1 など。意味の変更なし）。

## 5. 更新した pin（assertion は弱めていない）

`catalogLedger`（recipes 69 / credited 63 / ingredients 75 / toppings 56 / ladder 60 / 第 4 章 33、sauce 8、fruit 3）、`catalogShelf` / `largeCatalogFixtures`（sauce 8）、`lateCatalog.*`（exact 一覧にタヒニ追加、yuzu / dengaku は「末尾から N 番目」に更新）、`pinsa.production` / `e5.ikuraProduction` / `lateAxis` / `recipeChapters` / `materialShop`（offers に 2 行、`nextMaterialHint`）/ `referencePizza.test`（sauce 集合）/ `hint5Ladder.baseCompat`（key-free 43、sauce only 8）/ `techniqueAllowlists.test` / `IngredientGlyph.test`、golden 3 件（追記のみ）。`recipeBatchManifest` に `EGGPLANT_TAHINI_BATCH` を追加し、yuzu / dengaku の `followedBy` と Pinsa の `afterRecipeId` を更新。`e2e/new-sauces-u2.spec.ts` は「最後の step」前提を「味噌 step を導出」に直した。

## 6. 検証

| 項目 | 結果 |
|---|---|
| 新規テスト | `lateCatalog.tahini.test.ts` 18 件（OFF で無痕跡、データ・表・identity の一意性、色・family・size class・emoji 一意（G18）、Shop T4、Research、manifest、floors、**実 reducer の Free Cooking**: NEW_DISCOVERY / 後乗せ記録 / ザクロを焼成前・タヒニなし・FINISH 空・**パセリを焼成後**・ナス／パセリ欠落は ORIGINAL、Guided 再生） |
| 型・build | `tsc -b` 通過、`npm run build` 通過 |
| Vitest・E2E | 最終値は §6a |
| WebKit | サンドボックスに無く未実行（CI のみ） |

### 6a. 最終値（最終コード）

| 項目 | 結果 |
|---|---|
| フル Vitest | **531 files、9,812 tests passed、13 skipped、4 todo、0 failed**（`lcHandPreview.gate` の `.env` 検査は git 無しのコピー上でのみ環境依存のため、本ブランチ側は実 git ツリーで評価） |
| lint | `oxlint` エラーなし（既存 warning 2 件のみ） |
| E2E（Chromium 全体、iphone-390x844） | **534 passed / 96 skipped / 0 failed / 0 flaky**。新規 `e2e/new-sauces-u3.spec.ts`（390×844 / 360×800 各 2 本）通過。末尾の `console.error` 空判定は sandbox の外部アセット 404 で**散発的に**失敗しうる（`new-sauces-u1` / `u2` は無変更の main でも同様。通過した回の方が多い） |

### 6b. タヒニ色の変更（Owner HV 後、承認 2026-10-26）

実機 HV で「タヒニの塗りと生地の境界が分かりにくい」との所見。ゲーム内のソースは半透明で重なるため、設計時の予測（ΔE 約 29）より低く、`#a58a63` の塗りは素の生地との差が約 17〜18 だった。同一操作（半径 25%・16 タップ、390×844、Chromium）で `ingredient.color` のみを差し替えて実画面で測定（CIE76、塗り vs 同画面の素の生地）:

| | 未焼成 | 焼成後 | 味噌だれとの差（未焼成 / 焼成後） |
|---|---|---|---|
| 旧 `#a58a63` | 17.2 | 18.4 | 14.3 / 15.8 |
| 案 1 `#8a7152` | 23.1 | 24.1 | 13.0 / 15.1 |
| **案 2 `#7b6a58`（採用）** | **26.5** | **29.3** | 16.7 / 20.1 |
| 案 3 `#6b5d4a` | 29.2 | 31.4 | 17.4 / 20.4 |
| 参考: 味噌だれ / オリーブ油 | 27.9 / 30.4 | 26.4 / 25.4 | — |

案 2 は素の生地との差が味噌だれ・オリーブ油と同等で、味噌だれとは灰みの色相で区別できる。案 3 は焼成後に濁る、案 1 は味噌だれに寄る。**変更は `lateCatalog.ts` の色定数 1 つ**（とコメント、固定値テスト、スクリーンショット）のみ。ザクロ（`xs`）・パセリ・発見条件・採点・塗布量のしきい値・floors は不変。

## 7. Human Verification（`TETO_HUMAN-VERIFICATION-POLICY.md`）

- スクリーンショット（committed）: `docs/reports/screenshots/new-sauces-u3/`（390×844、Shop NEW / Research エントリ / トレイ（ソース 2 ページ目にタヒニ）/ タヒニ塗布後 / 具材後 / FINISH / FINISH ザクロ / NEW RECIPE / 図鑑）＋比較図 `u3-comparison.png`（ザクロ A′ を 18 / 24 / 32 / 64px でいくら・しそ・ねぎと並置、タヒニ `#7b6a58` を既存ソース色と並置。生地色は説明用の概算値で実測ではない）＋色比較 `u3-tahini-color-compare.png`（現行 `#a58a63` / 案 1〜3 / オリーブ油 / 味噌だれを、同一操作で未焼成・焼成後に並置）。新規レシピ・新材料のため before は無い。
- 動画（**repository に commit しない**。Owner へ直接提出）: `u3-hv-390x844.webm`（390×844）。
- **実機（iPhone Safari）で確認してほしいこと**: ①タヒニ `#7b6a58` が生地・味噌だれ・オリーブ油と見分けられるか、②**FINISH のザクロ 2 個**（`xs`）が焼き上がりの生地の上で読めるか、③パセリ（焼成前）の見え方、④トレイが長くなった（75 種）際の操作性、⑤チーズなしレシピで CHEESE タブをスキップする流れ。
- **Owner の実機 HV は未実施。**

## 8. リスクと注意

1. **merge = 即公開**（late catalog は本番 ON）。HV 前の merge は禁止。
2. **原典未確認**: タヒニ／ザクロの時期が後から確認された場合、構成の再分類が必要（通常 ladder への移行は late step 番号が変わり floors の再検討を伴う）。
3. **ザクロの視認性**（`xs`、2 個）と**タヒニの色**は HV で確認。`s` への変更・色の再調整は Owner 判断。
4. トレイは 75 種で長い。late 材料は末尾。
5. HOT ファイル（`App.css` に 1 セレクタ追記）を触れている。他 PR と衝突する場合は後から merge する側が追従する。`recipes.ts` / `PROJECT_HANDOFF.md` は未変更。
6. Style Lock v2 本文への追補（ザクロ A′）は SL-8 により別 docs-only PR とした。参照 SVG は `docs/design/references/ingredient-icons-2.0/pomegranate.svg`。
7. WebKit は CI のみで確認。

## 9. Owner 判断事項

1. 実機 HV（タヒニの色・ザクロの視認性・FINISH の操作）と最終承認。HV 後に merge。
2. HV 用の隔離 Artifact / 共有 Preview の承認（本セッションは未実施）。
3. 暫定値（個数・焼成窓・色・ザクロの size class）の確定、または原典確認後の再設計。
4. 本ブランチの push / PR 作成の承認（本セッションは未実施）。
