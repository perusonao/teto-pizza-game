# レシピ バッチ拡張 — Fresh Audit と拡張計画（5〜10 レシピ単位、docs-only）

Status: **調査と計画のみ（docs-only）。** `src/**`・`e2e/**`・CSS・テスト・データ・golden・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更。実装・PR 作成・merge・Monitor 作成・CI 再実行・Issue/PR へのコメント投稿・claim 投稿はしていない。新規ファイルは本書 1 件のみ（#677 / #679 とファイルが重ならない）。
基準 `main` = `de87234`（#674 merge 後、2026-10-27）。**「推奨」「助言」は Owner Decision ではない。** 未回答を承認済みとみなさない。
`CLAUDE.md` の規則どおり、実装時の UI/UX/gameplay 変更は `TETO_HUMAN-VERIFICATION-POLICY.md` に従う（本書は docs-only のため HV 対象外）。

## 0. 結論（先に）

1. **1 バッチ 10 レシピは可能。ただし「172 行から機械的に READY を拾う」方式では 10 件に届かない。** 未出荷 109 行のうち、ブロッカーが 1 つも無い FULL 行は 5 行（月見＝HOLD、`bianca`＝出荷済みの重複、ペキンダック＝新食材 4、`cuban` と `currywurst`＝新食材 3 ずつ）。一方で **FULL でブロッカーが「ベースソース未特定（`BASE_SAUCE_UNSPECIFIED`）」だけの行が 22 行** あり、Owner が 1 つ規則を決めれば解ける（§4 の D1。#611 の Owner 判断リスト 6 とも同じ論点）。
2. **新食材 0〜1 個で組める候補は 15 行**（0 個 4 行、1 個 11 行。ソース規則の仮定つき）。**共有する新食材が少ないほど 1 バッチの工数が下がる**ので、候補は「新食材を何個のレシピで使い回せるか」で選んだ（`beef` 1 個で 5 行、`burrata` 1 個で 3 行など）。
3. **新食材ゼロのレシピは安くない。** `grandma-pizza`（新食材 0、非 credit）の PR は 121 ファイル（src 86・e2e 17）で、新食材ありの PR（44〜62 ファイル）より大きかった。早い step で作れるようになり、「全部見つけた」seed save・Dex 件数・Research 入口が全部動くため。→ **新食材ゼロの候補は、テスト側の導出化（§5 の A2）を先に入れてから**第 2 バッチに置いた。
4. **推奨案: 第 1 バッチ = 新しい鍵材料 8 個＋10 レシピ（Fresh cohort 中心）、第 2 バッチ = 使い回し 10 レシピ。** 先に test/tools だけの準備 PR（§5）を入れる。第 1 バッチの着手は **#679（BBQ）の merge 後**（共有ファイルが多い）。
5. **Owner 判断が要るのは 10 件**（§8）。そのうち着手を止めているのは D1（ソース規則）・D2（バッチ構成）・D3（credit 方針）・D4（複数ソースの一般化）・D8（SVG 方針）。

## 1. 確認した範囲（Fresh state）

| 項目 | 内容 |
|---|---|
| `CLAUDE.md` / `PROJECT_HANDOFF.md` | 読了。HANDOFF は冒頭が 2026-09-18 のまま古い（`TETO_STATE-SYNC_2026-10-26.md` §5 の指摘どおり）。**現況は state-sync と `src/` を正**とした |
| 現行 main | 通常レシピ 64 ＋ late 5（ikura / yuzu-shrimp / eggplant-dengaku / eggplant-tahini / pinsa-romana）。`catalogLedger.test.ts`: recipes **69**（Pinsa OFF で 68）/ credited 63 / ingredients **75** / toppings 56 / ladder **60 step**（通常 56 ＋ late 4）/ 章 [6, 12, 18, 33 or 32] / Lunch Rush プール 25 |
| 本番スイッチ | `LATE_CATALOG_PRODUCTION` = true、`FREE_COOK_FINISH_PRODUCTION` = true、`PINSA_PRODUCTION` = true、`HAND_ENFORCEMENT_PRODUCTION` = false（state-sync §1。`lateCatalog.ts` の定数は本書で再確認） |
| 172 候補 | `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（172 行）を現行 `recipes.ts` / `ingredients.ts` / `lateCatalog.ts` と機械照合。**未出荷 109 行**。matrix は古い基準（出荷 15 件）で作られているため、**行単位の判定は実装前に再確認が必要**（優先度表の「115 行」は U3 前・別の突き合わせ方法による値で、本書と食い違う） |
| open PR（30 件） | #679（BBQ、late）、#677（発見失敗後の案内）、docs 系（#651 #650 #620 #612 #587）、HOLD 系（#581 #540）、古い設計 PR（#296 #295 #293 #255 ほか）。**レシピを追加する PR は #679 のみ** |
| open Issue（98 件） | 関連: #611（BBQ・後乗せ・Task C）、#578（New Sauces、U3 claim が 11/02 まで残存）、#577（Dough Kind、ピアディーナ HOLD）、#675（トレイ 75 食材の UX 実測）、#544（Research identifier 再監査）、#561（星ゲート slack）、CI 間欠失敗 #394 系 |
| claim | #611 Task C（docs の 3 ファイル、11/03 まで）、#578 U3（`01Dzqcs…`、11/02、**未 release**）。#578 の B-1 / U1 / U2 は Owner 承認で代理 release 済み（#611 のコメント）。レシピ系ファイルの新しい claim は無し |
| 原典 | `pizzadb.jp` は本環境から **HTTP 403（`CONNECT tunnel failed`）**。取得を偽らない。候補の材料・ソース欄は repo の中継証跡（matrix）のみで、**投入時機・個数・焼成条件は全て未確認**（§3 の脚注）。OD-B9-11（main の記述は「Owner のページ共有を優先」、#651 は未 merge で「担当セッションが先に取得、不能なら URL とエラーを報告して ChatGPT 側へ」）。いずれにせよ本書は URL（`https://pizzadb.jp/pizzas/<名>/`、比較表 `…/compare/world-pizzas/page/N/`）とエラーを報告するにとどめる |

## 2. 抽出の方法と母集団の絞り込み

未出荷 109 行の内訳（matrix の分類）:

| 区分 | 行数 | 本計画での扱い |
|---|---|---|
| FULL（現行フローで表現可能） | 43 | 主対象 |
| ├ ブロッカー無し | 5 | 月見（HOLD、OD-B9-8/12）、`bianca`（`pizza-bianca-ricotta` と材料完全一致の重複）、ペキンダック（新食材 4・PREPARED_COMPOSITE）、`cuban`・`currywurst`（新食材 3） |
| ├ **`BASE_SAUCE_UNSPECIFIED` のみ** | **22** | **D1 で解ける** |
| └ その他のブロッカー（組成衝突・未解決食材ほか） | 16 | 原則対象外（`caponata` など一部は D1 とセット） |
| PARTIAL（LATE_ADDITION / MULTI_SPREAD_LAYER / DOUGH_VARIANT 等が要る） | 50 | late（FINISH は本番 ON）と複数ソース（グランマの前例）で出荷できるものだけ拾う。DOUGH_VARIANT（ピアディーナ等＝#577 HOLD）、DRIZZLE（#579、価値監査で保留推奨）、半焼成（mid_bake）は除外 |
| NOT_REPRESENTABLE | 16 | 対象外（折り込み・フライ・包み・パン焼き等） |

除外（理由つき）: #679 が出荷する **BBQチキン**（`bbq-sauce` / `cilantro`）、保留中の **月見・柚子えび（出荷済み）**、**ピアディーナ**、**DRIZZLE が要る** `hot-honey-pepperoni`・サラダ系。
**`other` 家族（egg / almond / pine-nuts、sweets 系）に触れる材料は避けた**（`honey`・`walnut`・`mayo` を含む行は予備に回した）。月見で実測された DH4 の「その他は到達不能」（OD-DH4-2-9）への抵触が、一般則としては未証明のため、含む候補は実装前に必ず scratch 検証（Owner 承認が要る）が前提になる。

## 3. 候補 20 種類の比較表

凡例. **新食材** = 現行 75（＋#679 の 2）に無い材料。**ソース仮定** = 原典のソース欄が「その他 / 未特定」のため、`NO_SAUCE`（`aussie` / `shirasu` の前例）または既存ソースへ置く仮定が必要（D1）。**最近接** = 既存 69 レシピとの材料集合の Jaccard（1.0 = 同一。完全一致は 0 件）。**cohort** = Research コホート（その step の最後の有限材料が鍵）。「新」= 新しい単独 cohort（既存レシピの文字は動かない）、「既存へ参加」= 既存の cohort の文字が動く（`acceptedLetterShifts` の対象）。
**脚注:** 材料は matrix の中継証跡で、個別ページは未確認。個数・投入時機・焼成窓は全て GAMEPLAY ASSUMPTION（OD-B9-17 の型）。「SVG」は専用描画が要りそうな新食材の数の**見積もり**（Style Lock v2 の最終判断は Owner）。

### 第 1 バッチ候補（A1〜A10）

| # | レシピ | 工程 | 新食材（家族の見込み） | SVG | ソース仮定 | 最近接（J） | cohort | 差別化 | 主なリスク |
|---|---|---|---|---|---|---|---|---|---|
| A1 | `pizza-alla-norma` ノルマ | 通常（トマトソース） | ricotta-salata（チーズ） | 0〜1 | 不要（トマト） | melanzane 0.60 | 新 | **中**（ナス＋トマトで melanzane に近い） | 組成衝突（未出荷の catalog 候補との DIVERGENT 判断）。差別化が弱い |
| A2 | `moussaka-style-pizza` ムサカ風 | 通常 | cinnamon（スパイス） | 0〜1 | 「ホワイトソース」＝既存 `fromage-blanc-sauce` か（要確認） | flammkuchen 0.14 | 新 | 高 | white-sauce が曖昧（matrix で `listed_unresolved`）。lamb / feta / eggplant の再利用は良い |
| A3 | `jerusalem-mixed-grill-pizza` | 通常（チーズ無し） | cumin（スパイス） | 0〜1 | NO_SAUCE 仮定 | fugazza 0.17 | 新 | 高 | チーズ無し（flammkuchen の前例）。parsley 再利用 |
| A4 | `ume-shiso-pizza` 梅しそ | 通常 | umeboshi-paste（ソースかトッピングか＝要判断） | 0〜1 | NO_SAUCE または梅＝ソース | **shirasu 0.60** | 新 | **低〜中**（shiso・whitebait が shirasu と共通） | 家族判断。梅の色（ΔE）。差別化が弱い |
| A5 | `burrata-pizza` ブラータ | 通常＋**2 ソース**（トマト＋オリーブ油） | burrata（チーズ） | 1 | 不要 | margherita 0.40 | 新（鍵） | 中 | 複数ソースの一般化（D4）。ブラータの絵（球） |
| A6 | `pizza-alla-crudaiola` | 〃 | —（burrata 共有） | 0 | 不要 | pinsa 0.43 | 兄弟（A5 と同 cohort） | 中〜高 | 6 種類で Reference が多リング。兄弟は非 credit 案 |
| A7 | `nigerian-suya-pizza` | 通常 | beef（肉） | 1 | NO_SAUCE 仮定 | veggie-supreme 0.38 | 新（鍵） | 中 | 牛肉の絵（既存の肉と差を出す）。スパイス粉の表現は無し |
| A8 | `rendang-pizza` | 通常 | —（beef 共有） | 0 | NO_SAUCE 仮定（カレー系は曖昧） | tonno-e-cipolla 0.40 | 兄弟（A7 と同 cohort） | **低**（beef・onion・mozzarella の 3 種のみ） | 証跡が薄い。差し替え候補: `philly-cheesesteak`（§3 末尾） |
| A9 | `tandoori-paneer-pizza` | 通常 | paneer（チーズ） | 1 | NO_SAUCE（カレー系は曖昧） | veggie-supreme 0.38 | 新 | 中 | チーズ棚が 14 種に。絵（さいの目） |
| A10 | `peruvian-aji-amarillo-pizza` | 通常（唐辛子ソース） | aji-amarillo（**ソース**、色駆動で専用 SVG 不要） | 0 | ソース＝aji-amarillo（ホットソース） | palmito 0.40 | 新 | 高 | ソース色の識別（トマト・豆板醤・BBQ 暫定 `#7a2f1c`・味噌・タヒニと ΔE を測る。黄橙で差は出やすい見込み）。家族判断 |

### 第 2 バッチ候補（B1〜B10）

| # | レシピ | 工程 | 新食材 | SVG | ソース仮定 | 最近接（J） | cohort | 差別化 | 主なリスク |
|---|---|---|---|---|---|---|---|---|---|
| B1 | `pesto-burrata-pizza` | 通常＋2 ソース（ペスト＋オリーブ油） | —（burrata 既出） | 0 | 不要 | pesto-trapanese 0.33 | 既存（A5 の cohort） | 高 | 3 つ目の burrata 系。兄弟が増えすぎないか |
| B2 | `bulgogi-pizza` | **late**（白ごま焼成後） | —（beef 既出、`miso-sauce`・`white-sesame` は late 既存） | 0 | 甘辛だれ＝`miso-sauce`（田楽と同じ家族） | **dengaku 0.50** | late（既存の田楽 cohort へ参加） | 中 | 田楽の牛肉版に見える。cohort 参加の文字移動。late 軸の検証 |
| B3 | `wasabi-beef-pizza` | late（わさび焼成後） | soy-sauce, wasabi | 1〜2 | ソース欄は「その他」＝soy-sauce 仮定 | tonno-e-cipolla 0.29 | 新（late） | 高 | 投入時機は matrix のみ（#611 のタグと同じ質）。ペーストの絵 |
| B4 | `baingan-bharta-pizza` | 通常 | —（**#679 の `cilantro`** 再利用） | 0 | NO_SAUCE 仮定（カレー系） | veggie-supreme 0.33 | 既存へ参加（fresh-tomato step 20） | 高 | #679 の merge が前提。cohort 文字移動（`pesto-caprese`・`chilean-napolitana`） |
| B5 | `chicken-tikka-pizza` | 通常 | chicken-tikka（**PREPARED_COMPOSITE**。`chicken` で代用すれば新食材 0） | 0〜1 | NO_SAUCE 仮定 | **spanish-chorizo 0.50** | 新 または 既存 | 中 | 代用の可否は Owner（D7） |
| B6 | `caponata-pizza` | 通常 | —（新食材 0） | 0 | NO_SAUCE 仮定（「その他」） | palmito 0.40 | **既存へ参加**（capers step 23＝`puttanesca-pizza`） | 中 | **grandma 型の広い波及**（§1 の 121 ファイル）。puttanesca の Research 文字が動く |
| B7 | `jamaican-jerk-chicken-pizza` | 通常 | —（0） | 0 | NO_SAUCE 仮定 | pesto-pollo / hawaiian 0.33 | **既存へ参加**（green-pepper step 32＝`veggie-supreme-pizza`） | 中 | 同上。hawaiian に近い（pineapple＋chicken） |
| B8 | `philly-cheesesteak-pizza` | 通常 | —（beef 既出） | 0 | 「チーズソース」が曖昧（mozzarella か？） | veggie-supreme 0.38 | 兄弟 | 中 | チーズ欄の解釈（D1 とセット）。差し替え用 |
| B9 | `goulash-pizza` | 通常 | paprika-powder（スパイス）, sour-cream | 1 | NO_SAUCE 仮定 | fugazza 0.17 | 新 | 高 | 新食材 2。sour-cream の家族（`other` に入れない） |
| B10 | `currywurst-pizza` | 通常（カレーケチャップ） | curry-ketchup（ソース）, wurstel（肉）, paprika-powder 共有 | 1 | ソース＝curry-ketchup（`READY`） | salsiccia 系 0.17 | 新 | 高 | 新食材 3（B9 と 1 つ共有）。matrix 上 READY 行 |

**予備（20 に入れない）:** `nduja`（honey）、`potato-mayo`・`venezuelan-reina-pepiada`（mayo、家族が `other` になり得る）、`cuban`（mustard・pickles・swiss-cheese の 3）、`boerewors`（chutney）、`pescatore`（mussel、材料 8 種で Reference が混む）、`frutti-di-mare`（組成衝突）、`thai-chicken`（peanut-sauce・唐辛子が曖昧）、`hot-honey-pepperoni` ほかサラダ系（DRIZZLE 前提）。

## 4. 5 軸の評価（要約）

| 軸 | 第 1 バッチ | 第 2 バッチ |
|---|---|---|
| **新食材数** | 8（ricotta-salata, cinnamon, cumin, umeboshi-paste, burrata, beef, paneer, aji-amarillo）。**通常 ladder の新 step 8 本**（A6・A8 は兄弟＝step 無し） | 7（soy-sauce, wasabi, chicken-tikka, paprika-powder, sour-cream, curry-ketchup, wurstel）。chicken-tikka を `chicken` で代用すれば 6。**通常 step 3〜4 本＋late step 1 本**（B3） |
| **既存工程との互換性** | 全て通常フロー（DOUGH→SAUCE→CHEESE→TOPPING→BAKE）。A5・A6 は 2 ソース（グランマの前例、`MULTI_SPREAD_LAYER` は runtime 非対応の capability のため、グランマと同じ「presence のみ」の扱いが要る＝D4）。新工程・新ジェスチャーなし | B2・B3 は late（FINISH、本番 ON）。B1 は 2 ソース。他は通常 |
| **食材 SVG の必要数** | 見積もり 3〜5（burrata, beef, paneer, 必要なら cinnamon / cumin の粉）。ソース 2 種（aji-amarillo、umeboshi）は色駆動 | 見積もり 2〜4（wasabi, wurstel, paprika / sour-cream の判断）。葉の emoji は既存で使い切り（#611 の BBQ gate の記述）。**G18（emoji 一意）に通る代替が少ない** |
| **レシピの差別化** | 高 5 / 中 4 / 低 1（A8 rendang）。**低〜中の A1・A4 は材料が既存と近い**（0.60） | 高 5 / 中 5。B2（田楽の牛肉版）・B5（chorizo に近い）は注意 |
| **解禁順への影響** | 通常 ladder が 56 → 64 step。**late の step 番号が +8**（現 57〜60 → 65〜68。#679 が入れば更に +1）。`LATE_ENTITLEMENT_FLOORS` が既到達・既解禁を守る（後退しない）。未到達の late 材料の必要発見数が増えるのは #611 の決定（「+1 は許容、既到達は後退させない」）の範囲。**星ゲートは新設しない**（slack = 1 のまま、§7） | 通常 +3〜4 step、late +1 step。同上 |

## 5. 件数 pin・golden・ladder・shop・hint・privacy gate・E2E の更新作業と自動化案

### 5.1 実測: 1 レシピ追加 PR が触る範囲（直近 7 PR、`git show --stat`）

| PR | 内容 | 全ファイル | src | うち test/golden | e2e | docs | 画像 |
|---|---|---|---|---|---|---|---|
| #649 四川風ナス | 新食材 2・レシピ 1 | 62 | 32 | 20 | 2 | 9 | 19 |
| #634 フラムクーヘン | 新食材 1・レシピ 1 | 48 | 30 | 22 | 2 | 2 | 14 |
| #662 柚子えび | late・新食材 1 | 44 | 32 | 28 | 1 | 2 | 9 |
| #669 ナス田楽 | late・新食材 2 | 54 | 31 | 24 | 3 | 2 | 18 |
| #673 タヒニ | late・新食材 2 | 50 | 30 | 23 | 2 | 3 | 15 |
| #655 グランマ | **新食材 0**・2 ソース | **121** | **86** | 76 | **17** | 0 | 18 |
| `faaafa4` ピンサ（データ・ゲート OFF） | 生地 | 15 | 14 | 9 | 0 | 1 | 0 |

→ **src の 70〜90 % がテスト・golden・テスト支援**。1 レシピごとに触る hand pin は次の約 14 箇所（#649 の diff で確認）:

| # | 場所 | 内容（手書き pin） | 性質 |
|---|---|---|---|
| 1 | `catalogLedger.test.ts` | 全体の件数 ＋ 家族別の件数 | **唯一の正本**（意図どおり手書き） |
| 2 | `recipes.test.ts` | バッチごとの id 配列と `slice(a, b)`、「それ以外」の除外リスト | バッチごとに 1 つずつ増える |
| 3 | `cookingProfiles.test.ts` | `RECIPE_STEP_MATRIX`・`EXPECTED_NOT_CUT_ELIGIBLE` | レシピごと |
| 4 | `materialShop.test.ts` | `EXPECTED_OFFERS`（step / tier / pack / 価格）・`nextMaterialHint` の範囲 | 材料ごと ＋ 範囲の定数 |
| 5 | `lunchRush.exclusion.test.ts` | opt-out の一覧と合計 | レシピごと |
| 6 | `researchLabels.batch8a.test.ts` | credited 件数・step 数・RECIPES 件数 | **件数の重複 pin**（#1 と二重） |
| 7 | `hint5Ladder.baseCompat.test.ts` | key-free の件数・sauce/cheese の内訳 | レシピごと |
| 8 | `deductionGuard.gate.test.ts` | 旧ガード件数 pin（OD-B9-15 の原因分解が必須） | **毎回手測定** |
| 9 | `recipeBatchManifest.ts` ＋ `recipeBatch.validator.test.ts` | バッチ宣言（planned→landed） | 構造的 |
| 10 | `hint5.ladders55.json`・`hint5.alphaFamilyOnly.json`・`TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json` | golden（**追記専用**） | 手生成 |
| 11 | `lateCatalog.*.test.ts`・`techniqueAllowlists`・`LATE_ENTITLEMENT_FLOORS` | late のときだけ | late |
| 12 | `referencePizza.ts` | レシピごとの座標（#649 で +67 行） | レシピごと（`getReferenceSlots` で導出可） |
| 13 | e2e の「全部見つけた」seed ・Dex ピル件数・Pizza Select の `toHaveCount(N)` | 新食材 0 のレシピ（#655）で 17 ファイルに波及 | **最大の波及源** |
| 14 | `IngredientGlyph.tsx` / `.test` / `App.css` | 専用 SVG 1 食材ごとに +24〜28 行、`App.css` に 1 セレクタ | 食材ごと（HOT） |

バッチ化の利点は、**共有 pin（#1・#2・#4・#6・#7・#8・#10・#13）を 10 回ではなく 1 回だけ更新する**こと。HOT ファイル（`recipes.ts` `ingredients.ts` `App.css` ほか）を触る PR の直列化と、HV の 10 往復も減る。

### 5.2 自動化案（優先順。**各々は test/tools のみ。ランタイム・本番スイッチ・既存 assertion は変えない**）

| # | 案 | 狙い | 範囲と制約 |
|---|---|---|---|
| A1 | **Preflight（読み取り専用ツール）** `tools/recipe-batch/preflight.mjs` | 本書で手作業した分析を再現可能にする: 識別集合の衝突（完全一致と Jaccard）、cohort 鍵と**文字移動**、slack、`other` 家族への露出、ソース色の ΔE、emoji の G18 一意性、トレイ件数・ページ数、価格 tier → Result 表を自動生成 | 出力はテキストのみ。判定を自動で緩めない（赤は赤のまま） |
| A2 | **pin の導出化（テスト側）** — #13 の「全部見つけた」を `allDiscoveredIds()` の 1 ヘルパーに、Dex ピル・Pizza Select の件数を `CATALOG_COUNTS` に、#4 の `EXPECTED_OFFERS` を ladder と tier 規則から導出、#6 を #1 に統合、#3 の step matrix を「必須カテゴリ→steps」の導出＋例外表に、#2 をマニフェストに | 新食材 0 のレシピで 17 ファイルに波及する原因を断つ。**assertion は弱めない**（導出値が従来の手書き値と一致する期間を 1 PR 設けて等価性を確認してから切り替える） | `catalogLedger.test.ts` は唯一の手書き正本として残す。lunch-rush の opt-out 一覧は意図的な pin なので維持 |
| A3 | **golden 再生成スクリプト＋追記専用検証** `UPDATE_HINT5_GOLDEN=1`（既存の `UPDATE_SAUCE_B1_GOLDEN` と同型） | #10 の手生成をやめる。出力と旧 golden の差分が**追加のみ**でなければ失敗（既存エントリの変更を CI で拒否） | 既存の golden 内容は変えない |
| A4 | **旧ガード件数の原因分解スクリプト** | OD-B9-15 の「5 構成（追加なし / topping のみ / sauce のみ / 両方 / 両方＋レシピ）」測定を自動化し、表をそのまま Result に貼れる形にする | **hardened の `toEqual([])` は全構成で同 run に確認**。pin の単純置換は不可（OD-B9-15 のまま） |
| A5 | **バッチ ON/OFF 行列ゲート** | Pinsa ON/OFF（`test:pinsa-off`）× late ON を、バッチで触る test 群に対して必ず回す。privacy: `deductionProduction.gate` 14/14 ＋ hardened 漏えい 0 を**バッチ全体の追加状態で** 1 回 | 新しい CI check を必須化するかは Owner 判断（既存の 11 check・WebKit 6 シャードは不変） |
| A6 | **バッチ E2E 雛形（マニフェスト駆動）** | 現状は `expansion-*.spec.ts` がバッチごとに 1 本（8b 前例）。レシピごとに「Shop で NEW → 購入 → Reference どおりに調理 → NEW_DISCOVERY → Dex の No./章 → Research ラベル」を 1 つの parametrize で回し、390×844 / 360×800 のトレイ溢れ・ページ数も測る | 新規 spec のみ。既存 spec の assertion は触らない |
| A7 | **Reference 座標の生成補助** | `referencePizza.ts` の座標を `getReferenceSlots(n)` から下書き生成（n ≤ 8 は厳密リング、≥ 9 は複数リング。上限を新設しない） | 出力は下書き。最終は人の目で確認 |
| A8 | **HV 資料の一括生成** | 既存の `tools/finish*.mjs` 型を流用して、バッチの全レシピの 390×844 スクリーンショット（前後）と、**バッチ 1 本の動画**（各レシピの基準調理を連結）を作る | **HV Policy の運用解釈**（レシピごとに 1 本か、バッチ 1 本か）は D6 で Owner 判断 |
| A9 | **claim の雛形生成** | `teto-claim:v1` のファイル一覧を、マニフェストから生成（HOT 重複の警告を事前に見る） | 投稿は人が行う |

**着手順の提案（各 PR は小さく独立）:** ①A2（導出化、等価性確認）→ ②A1＋A4（測定ツール）→ ③A3＋A5 → ④A6＋A7＋A8。①〜④は test/tools のみで HV 不要（見た目・操作が変わらないため HV Policy §2「原則不要」）だが、**Policy の適用判断は Owner**。

## 6. 10 レシピ × 2 バッチの追加計画

### 6.1 第 1 バッチ（Batch A）— 「鍵材料 8 つ」

| 項目 | 内容 |
|---|---|
| 対象 | A1〜A10（§3）。鍵（key recipe）は norma / moussaka / jerusalem / ume-shiso / burrata-pizza / suya / tandoori / peruvian の 8、兄弟は crudaiola（burrata）・rendang（beef） |
| 件数の変化（#679 merge 後 70/77/61 を起点） | recipes 70 → **80**、ingredients 77 → **85**、通常 ladder 56 → **64**、credited +8（兄弟を非 credit にした場合。slack は不変）、章 4 は +10 |
| 順序 | 通常 ladder の末尾（step 57〜64）に追記。**1 step = 1 鍵材料**（`beef` は A7、`burrata` は A5 が鍵）。late の step は +8 で後ろへ |
| 前提 | #679 merge、A2（導出化）、D1・D2・D3・D4・D8 の回答、D10（claim） |
| 検証 | 全体 Vitest ＋ `test:pinsa-off` ＋ 全 E2E（Chromium 2 viewport）＋ WebKit（CI のみ）＋ DH4 14/14 ＋ hardened 漏えい 0（バッチ全体の追加状態で）＋ `ladderReachability.starGate`（slack ≥ 1）＋ 実機 HV |

### 6.2 第 2 バッチ（Batch B）— 「使い回し」

| 項目 | 内容 |
|---|---|
| 対象 | B1〜B10。**通常 8（B1 B4〜B10）＋ late 2（B2 B3）** |
| 件数の変化（A 後 80/85/64 を起点） | recipes 80 → **90**、ingredients 85 → **92**（chicken-tikka を `chicken` に代用すれば 91）、通常 +3〜4 step、late +1 step |
| 順序 | A の後。B4 は #679 の cilantro が入っていること。B6・B7（新食材 0）は A2 の導出化が入った後にだけ（§0 の 3） |
| 追加の注意 | B2・B6・B7 は**既存の Research cohort の文字が動く**（`acceptedLetterShifts`、Q7 の確定方針：自動分類を維持）。#544 の再監査項目 |

### 6.3 バッチ分割の代替（D2）

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| **P（推奨）** | A（10）→ B（10） | 共有 pin の更新が各 1 回。HV 2 回 | 1 PR が大きい（約 130〜180 ファイル見込み） |
| Q | 5 ＋ 5 を 4 回 | PR が小さい。HV 単位が細かい | 共有 pin 4 回。HOT の直列化 |
| R | A だけ先に（B は様子見） | 学びを B に反映 | 工数は P と同じ |

## 7. 既存契約の維持（確認結果と制約）

| 契約 | 維持の確認 / 計画上の制約 |
|---|---|
| **Contract 2.1**（INV-D1〜D7、INV-4/5） | 計画は `src/` のロジックを変えない。**INV-D7（「なし」を直接出さない）**: NO_SAUCE 仮定の候補（A3 A8 A9 B4〜B7 B9）も、パネル・aria・Notebook・保存に「ソースなし」相当を置かない（`aussie` と同じ扱い）。**INV-D3（verdict parity）・INV-D6** は matcher 側で不変。**Hint 5.0**: 新レシピは key-free（BASE rung は固定形）で golden は追記専用。**privacy gate**: `deductionProduction.gate` の assertion・hardened の `toEqual([])` を弱めない。`deductionGuard.gate` の件数 pin は OD-B9-15 の原因分解を必須とする（単純置換は不可）。**OD-DH4-2-9**（`other` は到達不能）は緩めない・`other` を再分類しない（OD-B9-12）。`other` を含む候補は計画から外した |
| **Pinsa ON/OFF** | 全 pin は既に `pinsaEnabled()` の分岐を持つ。バッチの追加分は両状態で同じ差分（recipes・章）になるよう、**ON/OFF の両方で A5 の行列ゲートを回す**。Pinsa ゲート自体（`pinsaGate.ts`）・Pinsa のデータは触らない。ピアディーナ（#577 3 値目の生地）は HOLD のまま巻き込まない |
| **保存互換性** | schema v2 のまま、新 key なし。Dex の生エントリ保持（#674）で、旧版が新レシピの Dex を消さない。**ladder は追記専用**（step 1〜56 凍結）。late の step 番号が変わっても `LATE_ENTITLEMENT_FLOORS`（57/58/59/59/60/60）で既到達者は後退しない（`materialEntitlement.lateFloor.test.ts`）。新しい通常 step の材料は旧セーブに未解禁として現れるだけ。**ordinary のレシピには本番スイッチが無い（merge = 即公開）**ので、HV は merge 前に必須（D6・D9） |
| **slack（#561）** | credited − step − 星ゲート直接 = 1（現行）。**新しい星ゲートは作らない**。鍵のみ credited なら slack は不変、兄弟も credited にすれば増える（安全側）。ただし credited を増やすと解禁が早まる＝進行ペースの変更なので D3 |

## 8. 工数とリスクの比較

**工数は見積もりであり測定値ではない。** 単位は「直近の 1 レシピ PR 1 本（約 50 ファイル）」。根拠は §5.1 の実測と、共有 pin（14 箇所のうち共有 8）が 1 回で済む想定。

| 案 | 内容 | 実作業の相対量（見積もり） | HV 回数 | HOT 直列化 | 主なリスク |
|---|---|---|---|---|---|
| O1 | 現状維持（1 レシピ 1 PR × 20） | 約 20〜24 | 20 | 20 回（recipes.ts ほか全 PR が衝突） | 共有 pin の衝突解消の繰り返し。件数 pin のズレ。late の step 番号が毎回動く |
| O2 | バッチ 10 ×2、手作業のみ | 約 11〜14（1 バッチ 5〜7） | 2 | 2 回 | 1 PR が巨大でレビュー負荷。pin の更新漏れ。新食材 0 のレシピの波及（B6・B7）で膨らむ |
| **O3（推奨）** | **準備 PR（A2 A1 A4 A3 A5、test/tools のみ）＋ バッチ 10 ×2** | 準備 約 3〜4 ＋ バッチ 約 4〜5 ×2 ＝ **約 11〜14（以後の各バッチは 約 3〜4）** | 2 | 2 回 | 準備 PR の等価性確認に時間。自動化が緩い判定を生まないよう「緑のまま変えない」規則を守る必要 |
| O4 | 5 ×4 | 約 12〜16 | 4 | 4 回 | O2 と O1 の中間 |

| リスク | 重大度 | 内容 | 緩和 |
|---|---|---|---|
| R1 ソース規則（D1） | **高** | 22 行が `BASE_SAUCE_UNSPECIFIED`。NO_SAUCE 仮定が原典と違う可能性。A/B のうち 12 レシピが依存 | 暫定仕様（OD-B9-17 の型）として明記。仮定が外れても **データの 1 行修正**で済むよう、ソースを `recipeSauceProfiles.ts` の 1 行に集約 |
| R2 Research cohort の文字移動 | 中 | B2 B4 B6 B7 が既存 cohort に参加。既存プレイヤーの「？？？ピザ（○○）」表記が「A（○○）」に変わる | Q7 の方針どおり `acceptedLetterShifts` に明記。Preflight（A1）で事前列挙。#544 の再監査に載せる |
| R3 DH4 `other` 家族 | 中 | 月見の実測抵触が一般則か未特定 | `other` を含む材料を計画から除外。バッチ全体の追加状態で DH4 14/14 を 1 回確認（A4/A5）。Owner の scratch 検証承認が必要（OD-B9-9/12 の型） |
| R4 トレイの肥大化 | 中 | 75 → 約 92 食材。#675（75 食材 UX の実測）が未実施 | A は #675 の結果を待つか、並行して実測。チーズ棚（11 → 14）・スペイス（1 → 3 以上）の分類タブが偏る |
| R5 差別化の弱い候補 | 低〜中 | A1（0.60）・A4（0.60）・A8（rendang）・B2（0.50）・B5（0.50） | 差し替え候補（予備）を明記。Owner が 1 件ずつ外せる粒度にする |
| R6 SVG のコスト | 中 | 1 食材あたり 24〜28 行（コード）＋ 参照 SVG ＋ 1.2em 補正の測定。葉の emoji が尽きている | D8。新食材 15 個のうち必要数の絞り込み |
| R7 late の step 番号シフト | 低 | 既知の制限（`lateCatalog.ts` 冒頭）。floors で既到達者は守られる | floors の更新は不要（追加は ordinary のため）。`lateFloor.test` を回す |
| R8 #679・#677・他との競合 | 中 | #679 は `ingredients.ts` `lateCatalog.ts` `IngredientGlyph.tsx` `App.css` `referencePizza.ts` ほか、#677 は `ResultPanel.tsx` と `App.css` の 1 ルール | 本書は競合なし。バッチは #679 の merge 後に着手（stack ではなく rebase）。#540（Draft・HOLD）は `recipes.ts` 等で重なる＝後から入る側が追従 |
| R9 WebKit 間欠失敗（#394 系） | 中 | 大きなバッチの E2E は shard が増える | 失敗は記録（再実行は失敗時のみ・Gate の規則どおり）。閾値は緩めない |
| R10 原典未確認 | 中 | 個別ページ未取得（403） | 全レシピを「暫定仕様・原典未確認」と明記し、原典を根拠にしない。取得できたら別途分岐（後乗せ判明＝late へ移動）。OD-B9-16 |

## 9. 最初のバッチ（Batch A）を始めるための Owner 判断事項

**回答の形式の提案:** 「D1 = a、D2 = P、D3 = a …」のように 1 行で選べるようにした。**助言は Owner Decision ではない。**

| ID | 判断 | 選択肢 | 助言 |
|---|---|---|---|
| **D1** | **ベースソース未特定（matrix 33 行）の規則**（#611 の Owner 判断リスト 6 と同一） | a. 原典のソース欄が「その他 / 未特定」は `NO_SAUCE` の暫定仕様とする（`aussie`・`shirasu` の前例）／b. 行ごとに Owner 確認／c. 該当候補を外す | **a**（仮定は `recipeSauceProfiles.ts` の 1 行で戻せる）。カレー系（rendang / tandoori / baingan）だけ b |
| **D2** | **バッチ構成**（§3・§6） | P（A→B の 10 ×2）／Q／R。A の個別の入替（A1・A4・A8 の差し替え、予備の採否） | **P**。差し替えは A8→`philly-cheesesteak` を最初に検討 |
| **D3** | **兄弟・新食材 0 のレシピを credited にするか** | a. 鍵のみ credited、兄弟・新食材 0 は非 credit（8a / グランマの前例）／b. 全て credited（slack が増え、解禁が早まる） | **a**。b は進行ペースの変更なので別判断 |
| **D4** | **複数ソースの一般化**（グランマの M-2 を A5・A6・B1 に適用） | a. 適用（presence のみ・トマト／ペスト＋オリーブ油）／b. 適用せず burrata 系を外す | **a**（`MULTI_SPREAD_LAYER` は runtime 非対応 capability のままで、グランマと同じ carve-out が必要＝実装前 Gate で確認） |
| **D5** | **暫定仕様の扱い**（原典未確認のまま進める） | a. OD-B9-17 の型を全 20 レシピに適用（PR・Result・コードに「GAMEPLAY ASSUMPTION」を明記、原典を根拠にしない）／b. 1 件ずつ原典確認を待つ | **a**。原典の取得は OD-B9-11 の最新の運用に従う |
| **D6** | **HV の粒度**（HV Policy の運用解釈） | a. バッチ 1 本の動画（各レシピの基準調理を連結、390×844）＋レシピごとのスクリーンショット／b. レシピごとに動画 | **a**。ただし Policy の解釈なので Owner が決める。merge は実機 HV と最終承認後（ordinary は即公開） |
| **D7** | **新食材の家族・価格 tier の L1 承認**（OD-B7-1 型の「バッチ限定の承認」） | cinnamon / cumin（spice）、ricotta-salata / burrata / paneer（cheese）、umeboshi-paste、aji-amarillo（sauce）、beef（meat）、chicken-tikka を `chicken` で代用するか | 一覧を Preflight で出し、Owner が承認（`other` に入れない） |
| **D8** | **新食材の描画方針**（SVG か emoji か） | a. 形が特徴的なものだけ専用 SVG（見積もり 3〜5）、他は G18 を通す emoji／b. 全て専用 SVG／c. emoji のみ | **a**（葉の emoji は尽きている） |
| **D9** | **着手順** | a. #679 merge ＋ A2（導出化）を先に／b. #679 に stack | **a**（shared files が多い） |
| **D10** | **claim と準備** | #578 U3 の claim（11/02、`01Dzqcs…`）の扱い、Batch A の新規 claim の投稿、準備 PR（§5.2）の着手 GO | U3 の claim が解けてから投稿（`recipes.ts` `ingredients.ts` が重なる） |

追加の確認（小）: 本計画で `other` 家族を避けたこと（`honey` `walnut` `mayo` を含む候補を予備にした）に異論が無いか。月見・柚子えび・ピアディーナ・DRIZZLE は HOLD のまま（本書は触れていない）。

## 10. 実施しなかったこと

コード・テスト・e2e・workflow・データ・golden の変更、実装、PR の作成、merge、Monitor の作成、CI の再実行、Owner Gate の実行、Issue/PR へのコメント投稿、claim の投稿、共有 Preview・Production の操作、`PROJECT_HANDOFF.md`（HOT）の更新、pizzadb.jp の再取得（403）、DH4 の scratch 検証（Owner 承認が必要）。

## 11. 方法の限界

- **工数は見積もり**（§8）。直近 7 PR の実測ファイル数からの類推で、バッチ PR の実測値は無い。
- 候補の「新食材」「最近接」「cohort」は matrix（古い基準）と現行 `src/data/*.ts` の**機械照合**（正規表現による抽出）。依存先の `node_modules` が無いため、**Vitest・tsc・Preflight に相当する検証は実行していない**。実装前に Preflight（A1）で再計算する。
- Jaccard は材料集合（starter を含む）の単純比較で、数量・工程・ソース量の差は反映していない。cohort 鍵は ladder の step 番号（通常 56 ＋ late 4）からの導出で、実際の `researchCohortLetters` の出力とは照合していない。
- SVG 数・家族・色の ΔE は見込み。ブラータ・牛肉などの絵、ソース色は実機 HV で確認する。
- 原典（pizzadb.jp）は未確認。ソース欄・投入時機は全て中継証跡（matrix）のみ。
