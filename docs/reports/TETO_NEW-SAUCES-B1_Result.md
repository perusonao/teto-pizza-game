# New Sauces Phase B-1 — 四川風ナスピザ + doubanjiang + green-onion（Result Report）

Issue #578（tracking。claim: https://github.com/perusonao/teto-pizza-game/issues/578#issuecomment-6373908627）。ブランチ `claude/recipe-expansion-prep-3i9dyz`、基準 `main` `3570f44`。**merge・共有 Preview・本番は Owner 承認待ち（未実施）。**
Authority: Owner GO 2026-10-23（`docs/decisions/TETO_EXPANSION-BATCH-9_OWNER-DECISIONS.md` OD-B9-3 / 13〜17）。監査: `TETO_RECIPE-EXPANSION_SICHUAN-EGGPLANT_Provisional-Spec-Audit.md`、`..._DH4-Preflight.md`。

## 0. 原典について（**確定情報ではない**）
pizzadb.jp の該当ページ（`https://pizzadb.jp/pizzas/sichuan-eggplant/`）は本環境から到達できず、**Q1〜Q4 は未確認**。次は**暫定仮定**であり、PIZZA DB の確定情報ではない: ①青ねぎは焼成前 ②豆板醤は SAUCE 工程で塗る ③ナスは事前調理なし ④材料 5 種（172 マトリクスの証跡、中継 2026-09-22）。個数・焼成窓・色・CUT なしも暫定。仮定が崩れた場合（青ねぎが焼成後、豆板醤を炒める、ナスを事前調理）は通常 ladder に入れず新工程候補へ再分類する（OD-B9-16）。

## 1. 追加したもの
| 項目 | 内容 |
|---|---|
| レシピ | `sichuan-eggplant-pizza`（No.63、章 4）。doubanjiang 1（SAUCE の PAINT）/ mozzarella 2 / eggplant 3 / garlic 1 / green-onion 2（非ソース 8 片 = リング 8）、焼成 58–78、CUT なし、`lunchRush:false`、credited、key-free |
| 新ソース | `doubanjiang`（豆板醤）: `category:"sauce"`、`placement:"spread"`、既存 PAINT、色 `#8a2b1c`（**仮**）。taxonomy family なし。価格・補充は T4 規則（初回 120 / 補充 60、10 回分） |
| 新トッピング | `green-onion`（青ねぎ）: family `herb`（L1）、size class `xs`、専用 `pieceVisual: "green-onion-slices"`（小口切りの輪）、`bakeRoastResistant`、参照 SVG `docs/design/references/ingredient-icons-2.0/green-onion.svg`。T4（k=2 → 20 個 / 120 / 補充 60） |
| ladder | **通常 step 56**（`["doubanjiang","green-onion"]`、星ゲートなし、cohort key = green-onion）。**番号は最新 main の ladder 長から導出（予約なし）**。1–55 凍結、追記専用 |
| 表 | `recipes` / `recipeSauceProfiles`（union + PAINT 行）/ `discoveryCatalog` / `referencePizza`（8 スロットリング、green-onion は LIGHT_LEAF）/ `recipeHintRoles` / `orders` / `ingredientTaxonomy` / `toppingSizeClass` / validator manifest（`new-sauces-b1`） |
| 追加していない | 新しい工程・ジェスチャー・保存形式（schema v2）・採点・経済・FINISH / 後乗せ / Pinsa / 四角い生地 / 複数ソース、DH4 gate の緩和、`other` family の変更、月見（HOLD） |

合計（`catalogLedger.test.ts` が単一台帳）: **63 レシピ / 69 食材（topping 53、sauce 5）/ 56 ladder step / credited 59 / 章 6・11・18・28 / Lunch Rush プール 25**。

## 2. 件数ピン（deductionGuard.gate）の変更理由 — 4 構成の分解測定
`deductionGuard.gate.test.ts` の `dh42aLeaks`（**旧 DH4-2A ガード**の漏えい件数という測定スナップショット）が 156 → **123**。**hardened ガードの `toEqual([])`（漏えいゼロ）は全構成・全状態で成立**（失敗はいずれも最終行の件数ピンのみ）。数値の置換だけで済ませず、同一ツリー・同一テストで構成だけ変えて測定した（使い捨てコピー、リポジトリ外）:

| 構成 | 旧ガード漏えい件数 | hardened | 差の原因 |
|---|---|---|---|
| 追加なし（main） | **156** | 0（16/16 pass） | ベースライン |
| green-onion のみ | **120**（−36） | 0 | 合成 family は本番 TOPPINGS を**配列添字**（`i%3` `i%4` と `%len`）で切り出す。topping が 1 つ増えると sauceless が 22 件入れ替わり、cheeseBase +1、multiSauce +12/−3 など合成レシピが再編される |
| doubanjiang のみ | **164**（+8） | 0 | `zeroTopping` は SAUCES を全走査する。sauce が 1 つ増えて +3 レシピ（ソース + チーズのみ）。`multiSauce` は `SAUCES[0..2]` 固定で無関係（末尾追加のため） |
| 両方（食材のみ） | **128**（= 156 − 36 + 8、加法的） | 0 | 上 2 つの合算 |
| 両方 + 四川風ナスのレシピ（本 PR） | **123**（−5） | 0 | 仮説の母集団が使う公開カタログにレシピが 1 つ増える |

- 結果は TOPPINGS / SAUCES の**配列内の位置**で決まる。本 PR は両材料を `BASE_INGREDIENTS` の**末尾**（`fromage-blanc-sauce` の後、`doubanjiang` → `green-onion` の順）に追加。位置を変えると件数は別の値になる。
- 更新は件数ピン 1 箇所のみ（テスト内コメントに分解を記録）。他の gate 定数・assertion は変更していない。DH4 production gate（`deductionProduction.gate`）は事前検証どおり 14/14 pass、Hint 5.0 G18 を含む全体 Vitest も pass。

## 3. 検証
| 検証 | 結果 |
|---|---|
| `tsc -b`（型） | pass |
| `oxlint` | exit 0（既存の warning のみ） |
| `npm run build` | pass |
| Vitest 全体 | **510 files passed / 1 skipped、9,450 tests passed、0 failed**（golden 更新後）。初回は 24 件の件数 pin が想定どおり失敗 → 下記のとおり更新 |
| 更新した pin（assertion の削除・緩和なし） | `catalogLedger`（recipes 62→63、credited 58→59、ingredients 67→69、ladder 55→56、章 4 = 28、sauce 4→5、herb 7→8）、`catalogShelf` / `largeCatalogFixtures`（sauce 5）、`recipes.test`（No.63）、`referencePizza.test`（sauce 集合に doubanjiang）、`cookingProfiles.test`、`materialShop.test`（2 材料の offer、nextMaterialHint 56）、`materialEntitlement.batch6`（ladder 56）、`progression.test`、`lunchRush.exclusion`（opt-out 37→38）、`researchLabels.batch8a`（59 / 56 / 63）、`hint5Ladder.baseCompat`（key-free 37→38、sauce+cheese 13→14）、validator manifest / test、`newSaucesA.flammkuchen.test`（後続追記に依存しない形へ。契約は同じ） |
| golden | `hint5.ladders55.json` **+251 行 / 削除 0**（追記のみ）、`hint5.alphaFamilyOnly.json` に 1 キー追記（`sichuan-eggplant-pizza`: 317）、DH4-1 audit JSON は件数 34 箇所（catalog comparison の category / family / group の +1。意味変更なし） |
| ★ゲート到達性 | `ladderReachability.starGate` は無改変で pass（63 レシピの一律 ★2 = 126★ でも gate 値・衝突・ブロックは不変） |
| Research / Shop / ladder / Lunch Rush | 上の pin と新規 `newSaucesB1.sichuan.test.ts`（食材 / offer / 識別（部分集合・上位集合なし）/ ladder 1 step・番号導出 / 章 4 / 既存 Dex 不変）で pass。Research cohort は単独（文字なし）、既存エントリの文字は動かない |
| e2e（Chromium 390×844 / 360×800、`e2e/new-sauces-b1.spec.ts` ほか関連 11 spec） | **68 passed / 12 failed**。12 件はすべて**終盤の `console.error` 空判定が `Failed to load resource: 404` で落ちる**もので、**本 PR で触っていない `expansion-batch7a` / `8a` / `8b` のみ**。**無改変の `origin/main` の 8b でも同じ 404 で落ちる**（本サンドボックスのネットワーク制限に起因、確認済み）。四川風ナスの spec と `new-sauces-a` は通過 |
| WebKit | サンドボックスに無く未実行（CI のみ） |
| e2e の既存 spec の更新 | `new-sauces-a.spec.ts` の章 4 サイズ pin（27 / 26/27）を `CATALOG_COUNTS` からの導出へ（#634 が 8b の spec にした変更と同じ種類。後続追記で壊れないため） |

## 4. 影響の要約
- **ladder**: 追記専用。ikura（late、OFF）の late step 番号が +1（OFF では無影響。E5 前の既知宿題、`lateCatalog.ts` KNOWN LIMIT）。
- **Shop**: step 56 の NEW 行に 2 材料。初回 120 × 2。
- **Hint 5.0 / DH4**: 永久 key-free、golden 追記専用。sauce は topping family を持たない。
- **図鑑 / 章**: 章 4 は 27→28（導出表示。保存は schema v2 のまま、既存セーブ無影響。`new-sauces-a` と同じ契約）。
- **Lunch Rush**: プール 25 のまま。

## 5. Human Verification（`TETO_HUMAN-VERIFICATION-POLICY.md`）
- スクショ（committed）: `docs/reports/screenshots/new-sauces-b1/` — Shop NEW（豆板醤 / 青ねぎ）、Research Entry、トレイ（ソース / 具材）、ソース塗布、具材、NEW DISCOVERY、図鑑、各 390×844 と 360×800。**before/after**: 新規レシピ・新材料のため before は無く、他画面は既存 spec が回帰を見ている。
- **表示比較資料**: `b1-compare-sauce-and-glyph.png` — 豆板醤と他 4 種のソース（薄塗り α0.46 / 濃塗り α0.85）、ΔE 表（豆板醤は素の色でトマトと ΔE≈22、生地とは薄塗り ≈31 / 濃塗り ≈58）、青ねぎ / 大葉 / しらすの絵柄（24px と 64px）。
- 動画（**未 commit**、Owner へ直接）: `new-sauces-b1-sichuan-390x844.mp4`（H.264、390×844、約 34 秒、616 KB）。購入 → Research → 塗布 → チーズ → 具材 → 焼成 → NEW DISCOVERY → 図鑑。`Video Verification`: ファイルあり・再生可・全画面・ソースと青ねぎが視認できる。
- **実機（iPhone Safari）HV は未実施。** 確認してほしい点: ①豆板醤 `#8a2b1c` の色（薄塗り / 濃塗り / 焼成後 raw・perfect・burnt、トマト・ペストとの見分け）②青ねぎの小口切りの輪の見え方（`xs` は小さく、暗いソース上でトッピング後に目立ちにくい。スクショ `b1-topped` で中央付近の 1 片がほぼ見えない）③焼き色（`bakeRoastResistant`）④トレイの豆板醤の絵（🫙 の text fallback）⑤個数 / 焼成窓。

## 6. Owner に残る判断
1. **原典 Q1〜Q4**（青ねぎの投入タイミング、豆板醤の使い方、ナスの調理、材料一致）。崩れたら通常 ladder から外して再分類。
2. 色 `#8a2b1c`、個数、焼成窓、CUT なし（暫定）。
3. 青ねぎの視認性（`xs` のまま / 見た目の調整）。
4. 豆板醤のトレイ絵柄（現状は emoji fallback。専用 SVG にするか）。
5. merge と共有 Preview の更新（未実施）。
