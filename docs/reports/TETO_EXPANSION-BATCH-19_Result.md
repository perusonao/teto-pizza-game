# Expansion Batch 19 — Result Report（#774、暫定仕様・原典未確認）

**状態:** PR 作成済み・**Gate HOLD（merge 不可）**。理由は AC-8 の非正準順ラベル差分 20 件が Owner の個別承認待ちであること（Q2・P2）。merge、Production ON、共有 Preview 更新は行っていない。
**ブランチ:** `claude/b19-pizza-774-resume-yq1ykd`（main `06cfc066`＝#778 merge 後から作成。再確認時点で `origin/main` は `06cfc066` のまま）。
**担当:** Issue #774 の最終 Owner 決定（コメント 6701826602）により `session_016YrGhysskJ41tUDUZwM9gL`。旧 T1（`session_016YrGi37oV1zQLYSQserkSG`）は編集・push・PR 作成を停止し WIP を保全。

## 1. 実装内容

| 項目 | 内容 |
|---|---|
| 新食材 | `burrata`（ブッラータ、チーズ、専用 SVG `burrata-torn-ball`＝候補 C、size `l`、T4、家族行なし）。**ordinary step 70**（単独素材、星ゲートなし） |
| 新レシピ 1 | `pesto-burrata-pizza`（ペスト・ブッラータピザ、**credited**、step 70 の key）。pesto 1 / olive-oil 1 / burrata 2 / fresh-tomato 2 |
| 新レシピ 2 | `pizza-alla-crudaiola`（ピッツァ・アッラ・クルダイオーラ、`ladderCredit:false`）。tomato-sauce 1 / olive-oil 1 / mozzarella 2 / burrata 2 / fresh-tomato 2 / arugula 2 |
| 共通 | 2 層ソース（主ソース PAINT＋olive-oil は存在判定、grandma-pizza と同じ方式）、全材料が焼く前、`lunchRush:false`、CUT なし、key-free Hint、焼成窓 58–78（汎用） |
| 変更ファイル | `ingredients.ts`・`recipes.ts`・`discoveryLadder.ts`・`discoveryCatalog.ts`・`recipeSauceProfiles.ts`・`recipeHintRoles.ts`・`hints.ts`・`referencePizza.ts`・`orders.ts`・`toppingSizeClass.ts`・`IngredientGlyph.tsx`・`App.css`、テスト支援（`recipeBatchManifest.ts`〔`B19_BATCH`〕・`requiredSauces.ts`〔`MULTI_SAUCE_RECIPE_IDS` に 2 件追加〕・`researchAttemptSim.ts`） |
| 件数（実測） | recipes 92（Pinsa 開）/ 91、credited 80、ingredients 98、toppings 68、ladder steps 77、章サイズ [6, 12, 19, 55]（Pinsa 閉は 54）。late の導出番号は +1（71–77）、`LATE_ENTITLEMENT_FLOORS` は不変 |

**暫定表記:** id・日本語名・個数・焼成窓・色（`#fdf9ee`）は GAMEPLAY ASSUMPTION（D3・D4）。原典（pizzadb.jp）は未確認で、根拠は 172 matrix の 2 行のみ。説明文は調理時期・材料量を出さない（Anti-Oracle）。ペストの表示名は食材名に合わせて「ジェノベーゼソース」とした。

## 2. 旧・新 WIP の比較と統合

- 旧 WIP `claude/b19-wip-handoff-4cdb9f8`（`4cdb9f8c`、親 `5eade46`＝#778 より前）と新 WIP（本ブランチ）を比較。**データの中身（id・個数・step 70・色・size class）は同一**。
- 差分は文言（説明文・注文台詞）と arugula の着地スタイルのみ。**arugula は `HEAVY_SQUASH`**（旧 WIP が正しい。`referencePizza.w1.test` が「LIGHT_LEAF は焼成に強い葉ものだけ」と固定しているため）。新 WIP の `LIGHT_LEAF` は誤りだったので直した。
- 旧 WIP の App.css 1.2em ルール（burrata を既存の 64-box グループへ）は同内容を取り込んだ。旧 WIP はハーブの SVG を削除する差分を含むが、これは #778 より前を基準にしたためで、**取り込んでいない**。
- 両ブランチは削除していない（Owner 指示）。

## 3. テスト結果

| 項目 | 結果 |
|---|---|
| 全 Vitest（Pinsa 開） | **11627 passed / 0 failed**（13 skipped・2 todo は既存） |
| 全 Vitest（`TETO_PINSA_OFF=1`） | 初回 1 件失敗を発見・修正（`expansionBatch19.test.ts` の監査範囲が Pinsa 閉で `pinsa-romana` を含めていた）。修正後、当該ファイルは Pinsa 開閉とも 42/42。**修正後の全体再実行はこの環境では未実施**で、CI で確認する |
| typecheck / lint / build | `tsc -b` 0 error、`npm run lint` exit 0（既存 warning のみ）、`npm run build` exit 0 |
| E2E（Chromium、`e2e/b19.spec.ts`） | iphone-390x844 と iphone-360x800 の各 2 本、**4/4 pass**（Shop NEW → 購入 → Research〔漏えいなし〕→ 2 層ソース → チーズ → 具材 → 焼成 → NEW DISCOVERY → 図鑑。横スクロールなし、console error なし）。この環境の Playwright は既定のブラウザが無いため、リポジトリ外の一時設定で `/opt/pw-browsers/chromium` を指定して実行した |
| WebKit | この環境では実行不可。CI（e2e-webkit）の結果を PR で確認する |

**既存テストの更新は件数・step 番号・id リスト・golden への挿入に限る**（assertion の意味は弱めていない）。主な更新: `catalogLedger`、各 `expansionBatchNN`（step 長・late 番号）、`materialShop`、`lateCatalog.*`、`materialEntitlement.*`、`recipes`・`progression`・`lunchRush.exclusion`・`researchLabels.batch8a`・`discoveryProgressionModel`・`DiscoveryProgressionInspector`、`IngredientGlyph`、`discoveryCatalog`（2 ソースの行は grandma と同様に `capabilities: []`・`spreadLayers: null`）、`cookingProfiles`（CUT なし）、`recipeBatchManifest` の `followedBy`（B11〜B18 に B19 の 2 id を追記）、B18 の Research 監査（B19 の 2 レシピを除外して「B18 前後」の比較に保つ）。

**研究シミュレーションの修正（テスト支援）:** `researchAttemptSim.ts` の最終段は、2 本目のソースを「1 回に 1 種ずつ」探していた。2 ソース・レシピでは Dex 90–91 番目で偽の「情報なし」停止が 11 件出た。Research の行は未知のソースを**上限なしで全部判定する**契約（`researchResultRows`、OD-RB-12）なので、最終失敗後は残りの未知ソースを 1 回でまとめて置く設定に直した。単一ソースのレシピは通らない経路。修正後の sweep は 72 件全て pass。

## 4. 重複検査（Duplicate Gate）— 合格

全レシピ（late・Pinsa 含む 92 件）に対し、完全一致・部分集合・上位集合・1 材料差は **0 件**（`expansionBatch19.test.ts`）。

| レシピ | 最大 Jaccard と近傍 |
|---|---|
| pesto-burrata-pizza | **0.333**（pesto-caprese・pesto-pollo・pesto-gamberi・pesto-trapanese）。バッチ内 crudaiola とは 0.429（対称差 4） |
| pizza-alla-crudaiola | **0.429**: jamon-serrano-pizza・grandma-pizza・pesto-burrata-pizza・pinsa-romana（Pinsa 開のみ）。各 対称差 4、0.4 超は**この名前付き 4 件のみ**（C1〜C5、OD-B19-2） |

## 5. AC-8b（SAUCE または CHEESE の有料ヒント 1 段で区別）— 合格（実測）

- Hint 5.0 の key-free ladder は両レシピとも `SAUCE → CHEESE → STRUCTURE → SUB_CLASS…`。SAUCE・CHEESE は各 **10 Pitz**。
- **SAUCE 段だけ**で区別可: pesto-burrata は {ジェノベーゼソース, オリーブオイル}、crudaiola は {トマトソース, オリーブオイル}。
- **CHEESE 段だけ**でも区別可: {burrata} と {mozzarella, burrata}。
- どの段の表示も未発見レシピ名を出さない（board は材料 id と構造のみ）。旧 Hint 経路（`hints.ts`）は 2 ソース用に「オリーブオイルも塗ってみよう！」を両レシピに追加（レシピ名・材料名は出さない。grandma と同じ作法）。`MULTI_SAUCE_RECIPE_IDS` へ追加済みで、`deductionProduction.gate`・`hint5Production.gate` は全て pass。
- 実機 HV（ヒントを見た人が取り違えないか）は未実施。

## 6. AC-8 Research ラベル監査 — **正準順 0 件（合格）／非正準順 20 件は Owner の個別承認待ち（Gate HOLD）**

- 新 2 件は「？？？ピザ A／B（ブッラータ）」で出る（D1）。全 ladder prefix（通常・late、Pinsa 開閉）で既存ラベルの変化は **0 件**。ランダム 40 順でも一度付いた文字は変わらない。
- 非正準順（共有素材を最後に入手）では、既存 **20 レシピ**の文字が変わり得る。監査方法は B18 と同じ（`researchLabelAudit.ts`: 共有素材ごとの所持順・正準順・固定 seed の乱数順）。**以下は範囲の固定であり、承認ではない**（`expansionBatch19.test.ts` の `B19_ALTERNATE_ORDER_LETTER_CHANGES_PENDING_OWNER`）。1 レシピを 1 つの ID とし、Owner は ID ごとに承認／却下を返す。承認された ID だけを承認済み定数へ移す。**未承認が 1 件でも残れば merge しない。**

| 差分 ID | 既存レシピ | 変化数 | 変更前→変更後（取得順の例、先頭 3 件） | 文字なし→あり |
|---|---|---|---|---|
| B19-LD-01 | `quattro-formaggi` | 1 | `-->A`（quattro-formaggi + pesto-burrata-pizza materials only, olive-oil last） | あり |
| B19-LD-02 | `fugazza` | 6 | `D->E`（every ladder material, olive-oil last）<br>`-->A`（fugazza + pesto-burrata-pizza materials only, olive-oil last）<br>`-->B`（fugazza + pesto-burrata-pizza materials + arugula, olive-oil last）<br>ほか 3 件 | あり |
| B19-LD-03 | `pizza-bianca` | 5 | `C->D`（every ladder material, olive-oil last）<br>`B->C`（quattro-formaggi + pizza-alla-crudaiola materials + rosemary, olive-oil last）<br>`A->B`（fugazza + pizza-alla-crudaiola materials + rosemary, olive-oil last）<br>ほか 2 件 | あり |
| B19-LD-04 | `vongole` | 7 | `K->M`（every ladder material, olive-oil last）<br>`C->D`（new-haven-apizza + pesto-burrata-pizza materials + parsley, olive-oil last）<br>`B->C`（vongole + pesto-burrata-pizza materials only, olive-oil last）<br>ほか 4 件 | なし |
| B19-LD-05 | `baba-ganoush-pizza` | 8 | `J->L`（every ladder material, olive-oil last）<br>`-->B`（baba-ganoush-pizza + pesto-burrata-pizza materials only, olive-oil last）<br>`B->C`（baba-ganoush-pizza + pesto-burrata-pizza materials + garlic, olive-oil last）<br>ほか 5 件 | あり |
| B19-LD-06 | `pizza-feta-eliniki` | 10 | `H->I`（every ladder material, olive-oil last）<br>`I->J`（every ladder material, fresh-tomato last）<br>`-->A`（pizza-feta-eliniki + pesto-burrata-pizza materials only, olive-oil last）<br>ほか 7 件 | あり |
| B19-LD-07 | `pizza-bianca-ricotta` | 8 | `I->K`（every ladder material, olive-oil last）<br>`B->C`（pizza-bianca + pesto-burrata-pizza materials + ricotta, olive-oil last）<br>`C->D`（pizza-bianca-ricotta + pesto-burrata-pizza materials + garlic, olive-oil last）<br>ほか 5 件 | なし |
| B19-LD-08 | `eggplant-ricotta-pizza` | 6 | `G->H`（every ladder material, olive-oil last）<br>`-->A`（eggplant-ricotta-pizza + pesto-burrata-pizza materials only, olive-oil last）<br>`-->B`（eggplant-ricotta-pizza + pesto-burrata-pizza materials + arugula, olive-oil last）<br>ほか 3 件 | あり |
| B19-LD-09 | `grandma-pizza` | 7 | `F->G`（every ladder material, olive-oil last）<br>`B->C`（quattro-formaggi + pizza-alla-crudaiola materials + garlic, olive-oil last）<br>`C->D`（new-haven-apizza + pizza-alla-crudaiola materials + rosemary, olive-oil last）<br>ほか 4 件 | あり |
| B19-LD-10 | `boscaiola` | 7 | `E->F`（every ladder material, olive-oil last）<br>`-->A`（boscaiola + pesto-burrata-pizza materials only, olive-oil last）<br>`-->B`（boscaiola + pesto-burrata-pizza materials + arugula, olive-oil last）<br>ほか 4 件 | あり |
| B19-LD-11 | `pesto-caprese` | 1 | `-->A`（pesto-caprese + pesto-burrata-pizza materials only, pesto last） | あり |
| B19-LD-12 | `pesto-pollo` | 5 | `G->H`（every ladder material, fresh-tomato last）<br>`B->C`（pesto-caprese + pizza-alla-crudaiola materials + chicken, fresh-tomato last）<br>`C->D`（pesto-pollo + pizza-alla-crudaiola materials + oregano, fresh-tomato last）<br>ほか 2 件 | なし |
| B19-LD-13 | `pesto-trapanese` | 3 | `E->F`（every ladder material, fresh-tomato last）<br>`C->D`（pesto-gamberi + pizza-alla-crudaiola materials + almond, fresh-tomato last）<br>`B->C`（pesto-trapanese + pesto-burrata-pizza materials + arugula, fresh-tomato last） | なし |
| B19-LD-14 | `veggie-supreme-pizza` | 5 | `H->I`（every ladder material, fresh-tomato last）<br>`B->C`（veggie-supreme-pizza + pesto-burrata-pizza materials + arugula, fresh-tomato last）<br>`-->B`（veggie-supreme-pizza + pizza-alla-crudaiola materials only, fresh-tomato last）<br>ほか 2 件 | あり |
| B19-LD-15 | `california-style-pizza` | 5 | `D->E`（every ladder material, fresh-tomato last）<br>`C->D`（every ladder material, arugula last）<br>`B->C`（california-style-pizza + pesto-burrata-pizza materials only, fresh-tomato last）<br>ほか 2 件 | あり |
| B19-LD-16 | `chilean-napolitana` | 6 | `F->G`（every ladder material, fresh-tomato last）<br>`B->C`（pesto-caprese + pizza-alla-crudaiola materials + oregano, fresh-tomato last）<br>`C->D`（pesto-gamberi + pizza-alla-crudaiola materials + oregano, fresh-tomato last）<br>ほか 3 件 | あり |
| B19-LD-17 | `jamon-serrano-pizza` | 3 | `B->C`（jamon-serrano-pizza + pizza-alla-crudaiola materials only, arugula last）<br>`C->D`（jamon-serrano-pizza + pizza-alla-crudaiola materials + grana-padano, arugula last）<br>`D->E`（every ladder material, arugula last） | なし |
| B19-LD-18 | `pinsa-romana` | 2 | `A->B`（jamon-serrano-pizza + pizza-alla-crudaiola materials only, arugula last）<br>`B->C`（jamon-serrano-pizza + pizza-alla-crudaiola materials + grana-padano, arugula last） | なし |
| B19-LD-19 | `rucola-e-grana` | 1 | `A->B`（jamon-serrano-pizza + pizza-alla-crudaiola materials + grana-padano, arugula last） | なし |
| B19-LD-20 | `baingan-bharta-pizza` | 1 | `-->A`（baingan-bharta-pizza + pizza-alla-crudaiola materials only, fresh-tomato last） | あり |

（`pinsa-romana`〔LD-18〕は Pinsa ゲートが開いているときだけ存在する。文字なし→ありは `-->` で表示。完全な一覧はテストが実行時に再計算する。）

## 7. その他の確認

- **保存:** schema v2 のまま、migration なし。`persistence.batch19.test.ts` で、旧セーブの所持順・Dex・在庫の保持、新 id の読み書き、未知 id の保持（ロールバック安全）、ラベルを保存しないことを確認。
- **採点・Pitz・経済:** 変更なし。`referencePizza.ts` に 2 件のリングを追加しただけ（pesto-burrata は 4 点、crudaiola は 8 点＝8 スロットのリング）。
- **Hint 5.0 golden:** `hint5.ladders55.json` は **挿入のみ**（368 行追加、削除 0、新規 id 2 件）。`hint5.alphaFamilyOnly.json` は 2 行追加（新レシピの値）。DH4-1 監査は category の値が +1 になっただけ。DH4-2A の旧 leak 件数は 211 → 225 に再計測（ハード化したガードの assertion は全て不変で pass）。
- **burrata の絵:** 盤面で mozzarella（白い円盤）と形で区別できること、Shop に「ブッラータ NEW」が出ることをスクリーンショットで確認（`docs/reports/screenshots/batch19/`、390×844／360×800）。焼成後・RESULT の実寸確認と、feta・ricotta との並べた比較は未実施。
- **claim・競合:** #774 の claim 6691358861 を維持。引き継ぎ・訂正・最終決定（6701234362／6701288678／6701826602）の経緯は Issue に記録済み。PR #779 には触れていない。

## 8. Owner に残る判断

1. **AC-8: 非正準順ラベル差分 20 件（B19-LD-01〜20）の ID ごとの承認／却下。** 未承認が残れば Gate HOLD。
2. **検索 alias「ブラータ」:** 旧担当セッションは「承認済み」と伝えたが、リポジトリ・Issue に Owner の記録が見つからないため **追加していない**（`ingredientSearchAliases` は「Owner 承認済みのみ」の規則）。必要なら承認を記録してください。
3. **iPhone Safari 実機 HV と HV 動画**（390×844、リポジトリに入れない）は未実施。画面確認は Chromium の E2E とスクリーンショットまで。
4. 暫定値（個数・焼成窓・色・id・日本語名）の最終確認と、crudaiola の例外（OD-B19-2、条件 C1〜C5）の維持。
5. 将来 `burrata-pizza`（matrix 行 117）を足すと crudaiola の 5 件目の近傍（0.429）になり C2 により再判断。

## 9. HEAD・PR

実装 HEAD と PR URL、CI・Codex の結果は PR 本文と Issue #774 のコメントに記す。
