# TETO FULL-EXPANSION 177 — PR #787 merge・未解決 433 件の再判定・Research 19 品・工程 M1〜M6 Result（#780）

2026-11-08 / 基準 main = **`4348e27`**（PR #787 の squash merge）。Owner 判断（2026-11-08）: PR #787 の Staging 基盤としての merge を条件付き承認。本番カタログへの昇格・Production ON・共有 Preview 更新は未承認。

凡例: 【実測】テスト・スクリプトの出力（golden に固定）、【推論】解釈。本書の「解決」はすべて**暫定ルールによる提案**で、staged データ自体は変更していない（ID・除外・昇格は何も確定していない）。

## 0. 結果（実測）

| 項目 | 値 |
|---|---|
| PR #787 | merge 済み（`4348e27`、squash、head `80bcbc7` を指定して merge） |
| main の Deploy（`4348e27`） | 成功（dist は main と同一内容のため本番の挙動は不変） |
| main の WebKit E2E（`4348e27`） | 1 回目: 1 件失敗（既知の間欠失敗 #570）→ 失敗ジョブを 1 回だけ再実行（§1） |
| 再判定した依存 | **433 / 433** |
| 暫定ルールだけで自動解決 | **11**（＋ルールが結論を決め、作業だけ残るもの 2） |
| 重複計上（同じ問いを別の依存として数えていたもの） | 24（ソース未特定 = 同じレシピの R-1）。ほかに R-7 と未解決トークンの重なり 16、ID 接尾辞が R-5 に従う 7 |
| Owner 判断が必要（例外を含む） | 97 ＋ 例外 37。重なりを除いた実質の問いは **約 74 ＋ 例外 16 品** |
| 重複ゲート 193 件のうち本当に例外判断が要るもの | **21 件（16 品）**。他は工程・後乗せの軸で区別できる見込み 43、staged 同士の選択 123、R-3 HOLD 6 |
| ルール上 Owner 判断が残らないレシピ | **24 / 84**（工程・in-flight・staged 同士の選択だけを待つ） |
| 依存がすべてルールで解消するレシピ | **2**（taco-pizza、okonomiyaki-style-pizza。残りは新食材の登録＝昇格作業のみ） |
| Research 正準順で文字が変わる出荷済み | **19 品**、原因の staged は **25 品**（§5 に全件） |

## 1. PR #787 の merge と main の確認【実測】

| 確認項目 | 結果 |
|---|---|
| 最新 HEAD | `80bcbc737ad9f94f33d4c3cf5c9092301acaeddd`（変化なし） |
| CI | 11/11 成功（WebKit 6 shard・layout-chromium・Layout Contract Gate・WebKit Gate・classify・build） |
| Codex | `80bcbc7` で指摘 0（`91345f2` の P2 は修正・解決済み） |
| 競合 | `mergeable_state: clean`。base は `e6b205c` のまま |
| PR #783 とのファイル衝突 | **0**（#783 の差分ファイルと #787 の差分ファイルに共通部分なし） |
| B20-A とのファイル衝突 | **0**（B20-A はブランチ・PR なし。claim は `docs/reports/TETO_NEXT-RECIPE_T5_*` のみ） |
| 操作 | Draft 解除 → タイトルの「マージ禁止」を外す → `expectedHeadSha=80bcbc7` で squash merge → `4348e27` |
| main: Deploy to GitHub Pages | 成功（run 42429393068） |
| main: E2E WebKit | 1 回目は 8 ジョブ中 7 成功・`webkit-390x844 shard 3/3` が失敗。失敗は `e2e/sauce-gauge-489.spec.ts:22`（ゲージのずれ 10、上限 8）の 1 件で、211 件合格。Issue #570 と同じ症状・同じ値。`4348e27` の本番 dist は直前の main と同一内容なので本 merge が原因になりえない。失敗ジョブを 1 回だけ再実行（結果は PR 本文） |

PR #783・B20-A・他の PR は merge していない。

## 2. 433 件の再判定（`src/data/staged/stagedRejudge.ts`、golden `__golden__/rejudge.json`）【実測】

機械的に適用した規則（ルール文だけで決まるもの）:
- **R-1**: ソースの系統が「その他」＝料理の正体となるソースが無い → NO_SAUCE（6 品: jerusalem-mixed-grill・caponata・banh-mi・palmitos-salsa-golf・natto・lomo-saltado）。ルールに名前が出ている照り焼き・プルコギ → 新ソース（結論はルールで決定、ソース食材の作成が残る: 2 品）。ホット・カレー・デザート・ホワイト・ほかの甘辛だれ（16 品）は Owner。
- **R-6**: 時期が「焼成中か後か未確定」のうなぎ → 既存の後乗せ（POST_BAKE）。これで eel-pizza の MID_BAKE 待ちも消える。taco は E0 で適用済み。後乗せする材料が書かれていないサラダ系 9 品は Owner。
- **R-7**: 候補 id が 1 つ・出荷済み・置換しても重複ゲートに 1 件も当たらない場合だけ置換（I-1 と同じ条件）→ 「青のり」→ nori の 1 件。「ナッツ」→ walnut は B20-A 待ち。他 19 トークン（唐辛子 7・ひき肉 5・チーズ 3 など）は候補 id が未出荷か、置換すると重複ゲートに当たるため Owner。

判定の内訳:

| 判定 | 件数 | 意味 |
|---|---|---|
| AUTO_RESOLVED | 11 | 暫定ルールだけで解決（R-1 6・R-6 2・R-7 1・トークン 1・MID_BAKE 1） |
| RULE_DECIDED_WORK | 2 | 結論はルールで決定（新ソース）、ソース食材の作成が残る |
| DUPLICATE_COUNT | 24 | ソース未特定＝同じレシピの R-1（重複計上） |
| WAITS_MECHANIC | 58 | 工程 M1〜M6 待ち |
| WAITS_IN_FLIGHT | 10 | PR #783（burrata）・B20-A（honey・walnut）待ち |
| AXIS_CONDITIONAL | 71 | 出荷済みと重なるが、工程・後乗せの軸で区別できる見込み（R-3 の線。工程と一緒に判断） |
| STAGED_PAIR | 123 | staged 同士の重なり。候補の選び方で解決し、出荷済みへの例外ではない |
| EXCEPTION_NEEDED | 37 | 出荷済みと重なり、区別する軸が無い（16 品） |
| OWNER_DECISION | 97 | その他 Owner 判断（R-5 14・R-1 16・R-7 16＋トークン 19・R-6 9・R-8 8・ID 7・R-3 HOLD 2＋その 2 品の重複ゲート 6） |
| 計 | **433** | |

ルール別: R-1 は自動 6・ルール決定 2・Owner 16／R-2 は工程軸 14・例外 5／R-3 は工程軸 3・HOLD 2（cauliflower・fathead はルール文で HOLD）／R-4 は工程軸 11・例外 11／R-5 は Owner 14（比較先の Phase 0a 候補の材料表がリポジトリに無く、機械比較できない）／R-6 は自動 2・Owner 9／R-7 は自動 1・in-flight 1・Owner 16／R-8 は Owner 8。

## 3. 重複ゲート 193 件の種類別整理【実測、提案後の集合で再測定】

| 種類 | 出荷済みと | staged 同士と |
|---|---|---|
| 同一集合 | 工程軸 3・R-3 HOLD 2 | 8 |
| 部分集合 | 工程軸 11・**例外 4**・HOLD 2 | 13 |
| 上位集合 | 工程軸 7・**例外 1** | 61 |
| 1 材料差 | 工程軸 11・**例外 6**・HOLD 2 | 28 |
| Jaccard > 0.4 | 工程軸 11・**例外 10** | 13 |

- staged 同士の 123 件（レシピ×種類の数）を、重なっている**レシピの組**で数え直すと、同一 4 組・部分／上位 181 組・1 材料差 30 組・Jaccard 10 組。多いのは材料が mozzarella だけの quad-cities・colorado（各 58 件）、mozzarella＋トマトの trenton・ny-style（各 20 件）、old-forge（18）、keema（16）。**材料集合が小さい「生地が正体」のレシピが原因**で、生地の種類（M1）を識別軸にすれば大半が区別できる【推論】。
- **本当に例外判断が要る 16 品（出荷済みと重なり、工程・後乗せの軸が無い）:**

| staged | 出荷済みとの重なり（種類:相手(Jaccard)） |
|---|---|
| sfincione | Jaccard: brazilian-calabresa(0.429)、上位集合: fugazza(0.6)、Jaccard: napoletana(0.5) |
| pizza-baiana | 1 材料差: aussie・polish-kielbasa・spanish-chorizo(0.6)、Jaccard: full-english(0.5)・pizza-portuguesa(0.429) |
| thai-chicken-pizza | Jaccard: bbq-chicken(0.5)・reina-pepiada(0.429) |
| keema-pizza | 部分集合 15 件（aussie・bacalhau・curry-pizza-japan ほか） |
| chicken-tikka-pizza | Jaccard: bbq-chicken(0.429)・spanish-chorizo(0.5) |
| pizza-salad | Jaccard: bambino(0.429) |
| pizza-asparagi-limone | Jaccard: quattro-formaggi(0.429) |
| pizza-zucchine-menta | Jaccard: eggplant-ricotta・pizza-bianca-ricotta(0.429) |
| pizza-chilena | 1 材料差: aussie・bacalhau(0.6)、部分集合: pizza-portuguesa(0.667) |
| philly-cheesesteak-pizza | 部分集合: nigerian-suya(0.75) |
| bulgogi-pizza | 1 材料差: nigerian-suya・rendang(0.6)、Jaccard: wasabi-beef(0.5) |
| frutti-di-mare-pizzadb | Jaccard: pescatore(0.5) |
| nduja-pizza | 1 材料差: salsiccia・salsiccia-e-friarielli(0.5) |
| tsukimi-pizza | 1 材料差: aussie・breakfast(0.6)、Jaccard: full-english(0.5) |
| south-african-boerewors | 1 材料差: polish-kielbasa・spanish-chorizo(0.6) |
| hokkaido-cheese-pizza | 部分集合: potato-mayo(0.6) |

R-2（部分集合・上位集合は原則不採用）と R-4（Jaccard > 0.4 は原則不採用）をそのまま当てると、この 16 品は**不採用**になる。不可逆な除外なので、本書では除外せず「ID ごとの判断が必要」として残した。pizza-zucchine-menta は計画書で個別例外の候補として名前を挙げたもの。

## 4. ルール上 Owner 判断が残らないレシピ（24 品）【実測】

taco-pizza・okonomiyaki-style-pizza（依存なし。新食材の登録だけ）／jerusalem-mixed-grill・caponata・banh-mi（staged 同士の選択だけ）／burrata-pizza（#783 待ち）・hot-honey-pepperoni（B20-A 待ち＋工程軸）／ny-style・argentine-napolitana・palmitos-salsa-golf・piadina-romagnola・poutine・fugazzeta-rellena・chicago-stuffed・new-england-bar・pizza-al-taglio-romana・montreal-style（M1 ほか）／scacciata-ragusana（M3）／natto（M4）／pizza-fritta・yakiniku（M5）／pizza-de-lomo-saltado（M4＋M5）／quattro-stagioni・trenton-tomato-pie（M6）。

ここでの「判断が残らない」は §2 の暫定ルールの範囲での話で、昇格の承認・最終 ID・個数・アイコン・Research の ID ごとの承認（§5）は別に要る。

## 5. Research 正準順で文字が変わる出荷済み 19 品（`__golden__/whatIf.research19.json`）【実測】

本番の `researchCohortLetters` を、正準の ladder 順の全段（0〜最終）で staged 全部入り／単独で実行して比較した。「原因」は**その staged レシピを単独で足したときにも**同じ出荷済みレシピの文字が変わるもの。

| 出荷済み | 変化前→後 | cohort の食材（最初に変わる段） | 原因の staged レシピ |
|---|---|---|---|
| aussie | A→C | onion（13） | pizza-baiana、pizza-chilena |
| brazilian-calabresa | B→E | onion（13） | pizza-baiana、fugazzeta-rellena、pizza-chilena |
| capricciosa | なし→A | oregano（12） | pizza-a-caballo |
| eggplant-dengaku-pizza | なし→A | white-sesame（86） | bulgogi-pizza |
| eggplant-ricotta-pizza | なし→B | mint（59） | pizza-zucchine-menta |
| napoletana | なし→C | anchovy（16） | siciliana-pizzadb、sfincione |
| palmito-pizza | なし→B | palm-heart（45） | palmitos-salsa-golf |
| pepperoni | なし→C | pepperoni（6） | st-louis-style、new-england-bar、fathead-keto、montreal-style |
| pesto-patate | なし→B | potato（22） | hokkaido-cheese-pizza |
| pizza-bianca-ricotta | なし→C | ricotta（53） | calzone-pizzadb、pizza-fritta |
| pizza-feta-eliniki | なし→B | feta（51） | greek-style-pizzadb |
| pizza-portuguesa | C→F | onion（13） | pizza-baiana、fugazzeta-rellena、pizza-chilena |
| puttanesca-pizza | なし→B | capers（24） | caponata-pizza、pizza-romana |
| salsiccia | なし→A | sausage（7） | chicago-deep-dish-pizzadb、chicago-stuffed-pizza |
| sichuan-eggplant-pizza | なし→A | green-onion（66） | tsukimi-pizza |
| spanish-chorizo-pizza | B→C | bell-pepper（30） | lahmacun |
| supreme-pizza | A→B | bell-pepper（30） | lahmacun |
| tarako-cream-pizza | なし→A | nori（94） | teriyaki-chicken-pizza |
| vongole | なし→B | parsley（29） | turkish-pide |

- 「なし→A」は、1 品だけの cohort だった出荷済みレシピに staged が加わり、文字が付くようになるもの。
- 原因の 25 品のうち、§3 の例外 16 品にも入るのは 7 品（bulgogi-pizza・hokkaido-cheese-pizza・pizza-baiana・pizza-chilena・pizza-zucchine-menta・sfincione・tsukimi-pizza）。§4 の 24 品のうち原因になるのは 7 品（caponata-pizza・chicago-stuffed-pizza・fugazzeta-rellena・montreal-style-pizza・new-england-bar-pizza・palmitos-salsa-golf・pizza-fritta）で、taco・okonomiyaki は原因ではない。
- これは staged の元の集合で測った値（§2 の提案は反映していない）。列車ごとに、その列車の集合で同じ表を作り直す。

## 6. 工程 M1〜M6 の依存と並行実装（`rejudge.json` の mechanicWaits）【実測＋推論】

| トラック | 必要とするレシピ | このトラックだけで解放（Owner 判断なし） | 既存の線 | 主なファイル |
|---|---|---|---|---|
| M1 生地の種類 | 31 | 5（ny-style・argentine-napolitana・palmitos-salsa-golf・piadina・poutine） | #577: PR #775（PD-1a、open）→ PD-1b/c → PD-2（チップ UI）→ PD-3 | `src/logic/dough/**`、PD-2 だけ `GameScreen.tsx` |
| M2 天板・形状 | 9 | 0（すべて M1 も要る） | #532 系。深型・浅型・鉄板と楕円等の目標形は設計 Issue が無い | `src/logic/pan/**` |
| M3 包む | 5 | 1（scacciata-ragusana） | #773: PR #785（F1、HOLD）、F2 ラボ claim | `src/logic/foldSeal*`、`src/labs/foldSeal/**` |
| M4 焼成中の追加 | 2（R-6 で eel が外れて 3→2） | 1（natto） | #604／#611（後乗せは出荷済み）。焼成中は Issue なし | 新規 `src/logic/midBake/**` 想定 |
| M5 下ごしらえ・揚げ | 4 | 2（pizza-fritta・yakiniku） | PREP #696・FRY #749 は実装済みで本番 OFF。#784（共通入力契約） | 既存 Gate（本番 ON は Owner） |
| M6 順序・区画・積層 | 4 | 2（quattro-stagioni・trenton-tomato-pie） | ZONED: #773／PR #620 の監査。STEP_ORDER・LAMINATE は Issue なし | 新規 `src/logic/layering/**` 想定 |

**並行に進められるもの（HOT ファイルを触らない、互いに別ディレクトリ）:**
1. M1: PD-1b／PD-1c の純粋ロジック（`src/logic/dough/**`）。前提は PR #775 の merge。解放数が最大（31 品が必要、5 品はこれだけで解放）。
2. M3: F1（PR #785）の判断と F2 ラボ（既存 claim のまま）。
3. M2: 天板 profile・目標形の設計 Issue 起票と純粋ロジック（新規ディレクトリ）。
4. M4: 焼成中追加の設計 Issue 起票と純粋ロジック（新規ディレクトリ）。対象は 2 品と少ないので優先度は低い。
5. M6: STEP_ORDER・ZONED の検証用純粋ロジック（新規ディレクトリ）。LAMINATE は feteer 1 品（R-8 保留）なので延期。
6. M5: コード作業なし。PREP／FRY の本番 ON は Owner 判断（HV を伴う）。

**直列にしか進められないもの:** ゲーム画面への接続（`GameScreen.tsx`・`App.css`・`gameReducer.ts` が HOT）。計画書どおり #738 → M1 PD-2 → M5 → M3 → M2 → M4 → M6 の順で 1 本ずつ。

## 7. Owner 判断が必要なもの（まとめて、推奨つき）

| ID | 内容 | 件数（実測） | 推奨 |
|---|---|---|---|
| D-1 | 例外 16 品（§3 の表）を R-2／R-4 どおり不採用にするか、ID ごとに例外にするか | 16 品 | 原則不採用。pizza-zucchine-menta だけ個別検討。不採用は staged に残したまま status で表す（削除しない） |
| D-2 | R-1 の残り 16 品のソース（ホット 6・カレー 2・デザート 4・ホワイト 2・甘辛だれ 2） | 16 | ホット・カレーは「料理の正体」として新ソース、デザート・ホワイトは既存（fresh-cream-sauce 等）か NO_SAUCE を個別に |
| D-3 | 未解決トークン 19（唐辛子 7 は chili-oil を新食材にするか、ひき肉 5 は beef にすると重複に当たる、チーズ 3 等） | 19 | 唐辛子は新食材 1 種（chili-oil）として 7 件をまとめて解決 |
| D-4 | R-5 の 14 品（PIZZA DB 版と別候補の構成衝突） | 14 | Phase 0a 候補の材料表が無いので、PIZZA DB 版を採用（ID は接尾辞を外す） |
| D-5 | R-6 のサラダ系 9 品で後乗せにする材料 | 9 | 生の葉物・柑橘（lettuce・arugula・fennel・orange 等）を後乗せ、他は焼成前 |
| D-6 | Research 正準順の変化 19 品（§5）の扱い | 19 品／原因 25 品 | 列車ごとに原因レシピを入れるかを決める。taco・okonomiyaki は原因でないので最初の列車候補 |
| D-7 | 最初の列車の範囲 | — | taco-pizza と okonomiyaki-style-pizza（新食材の登録・アイコン・個数の確定が必要）。昇格の実装は別承認 |

## 8. テスト（実測）

- `src/data/staged`: 8 ファイル 18 テスト（再判定 2・Research 19 品 1 を追加）。生成器に入力 3 項目（ソース系統の原文・未解決トークンの候補 id・後乗せの時期）を足したが、既存の golden 4 本は**不変**。
- `tsc -b`・`oxlint`: エラー 0。
- 全 Vitest: 634 ファイル合格・1 skip、11,573 合格・13 skip・2 todo、**失敗 0**（所要 16 分 13 秒）。Pinsa OFF 版の staged: 14 合格・4 skip（golden は Pinsa ON で測定）。`vite build` の dist は main と全ファイル一致。

## 9. 状況

- **完了**: PR #787 の確認と merge（`4348e27`）、main の Deploy 成功、433 件の再判定（自動解決 11・ルール決定 2）、重複ゲートの種類別整理（例外が要るのは 16 品）、Research 19 品の一覧、M1〜M6 の依存と並行作業の整理、本書。
- **未完了**: 本番カタログへの昇格（未承認）。D-1〜D-7 の判断。
- **ブロッカー**: §7 の Owner 判断。HOT ファイルを触る昇格は PR #783 → B20-A の後。
- **次の行動**: 本書と再判定コードを Staged Catalog 内の PR として出し、CI・Codex を確認する（merge しない）。
