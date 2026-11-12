# #577 Dough Kind PD-1b／PD-1c — 設計・影響調査（docs-only、実装なし、Refs #577 #773 #780）

2026-11-07、基準 `origin/main` = `06cfc066`。変更は新規 docs のみ。**PD-1b／PD-1c は実装していない（Owner 決定: 設計・影響調査のみ GO）。** `src/`・`e2e/`・既存 docs・他セッションの branch／claim には触れていない。PD-1a は PR #775（別セッション、open、head `9e77805`）で、本書はそれを前提にするが編集しない。
凡例: 【実測】コードを読み grep で確認、【推論】実測からの解釈、【未確認】この環境で確かめていない。「推奨」は助言で Owner 決定ではない。

定義の出典: #773 統合判断書 §4.3（branch `claude/teto-pizza-issue-773-61yp79`）。PD-1b＝技法の対応表化（`detection.ts`・`doughSwitch.ts`＋既存テスト）、PD-1c＝シミュレータの一般化（`lateFinishSim.ts`・`researchAttemptSim.ts`＋その test）。いずれも**挙動バイト同一・値を増やさない・3 値目を追加しない**。

## 0. 結論（先に）

1. **PD-1b は定義どおり 2 ファイル（＋テスト）で足りる**【実測】。ただし `doughChipOtherLabel` の複数値時の挙動は D-P1（チップ設計）に依存するため、PD-1b は**対応表を 1 行のまま**にし、2 行目が入った時点で落ちる固定テストを置くのが安全【推論】。
2. **PD-1c は定義のファイル一覧より広い**【実測】。`answerVariantOf` の戻り値型が `discoveryHintEconomySim.ts`・`hint5EconomySim.ts` に流れ込み、さらにテスト側の `discoveryHint.walk.test.ts` に同じ文字列リテラルがある。型の波及を含めて**実質 4 ソース＋1〜2 テスト**。挙動は変えずに済む。
3. **PD-1b／c が単独で解放できるレシピは 0 件**（値もデータも足さないため）。最初に解放できるのは PD-3（データ）＋PD-2（UI）以降で、**生地 1 種につき解放できるレシピは最大 1 件**（§6）。最初の候補は piadina。
4. **PD-1a（#775）との依存は型だけ**: #775 は `DoughKind` を `DOUGH_KINDS` 由来にする。PD-1b／c はそれを前提に「対応表の網羅性」を型で守れるので、**#775 の merge 後に着手するのを推奨**（ファイルは重ならないので技術的には並行可）。
5. 停止条件（§7）と Owner 判断（§8）を一括で示す。

## 1. 現状（main `06cfc066`）【実測】

- `DoughKind` は 2 値（`standard`／`material-multigrain-long-ferment`）。#775 後は `DOUGH_KINDS`（`as const` タプル）から導出され、`isDoughKind` は `DOUGH_KINDS` 参照になる（挙動は同一、PR 本文で旧実装を oracle にして固定）。
- 生地リテラル `"material-multigrain-long-ferment"` が現れるファイル（grep）: 非テスト 7（`DoughKindSwitch.tsx`・`lateCatalog.ts`・`detection.ts`・`doughOutline.ts`・`doughKind.ts`・`lateFinishSim.ts`・`researchAttemptSim.ts`）、テスト 18。
- 技法 id `dough-pinsa-romana` は `detection.ts`（`DOUGH_TECHNIQUE_ID`）、`techniques.ts`（`TechniqueId` の union と registry）、各テストにある。生の id は DOM に出さない契約（`TechniqueReveal.test.tsx`、`e2e/dough-kind-chips-p2.spec.ts` が `romana|multigrain|ferment` の不在を検査）。
- 本番: `LATE_CATALOG_PRODUCTION = true`、`PINSA_PRODUCTION = true`。dough 技法を要求する本番レシピは `pinsa-romana` のみ（`techniqueAllowlists.ts` の `DOUGH_PINSA_ROMANA_RECIPE_IDS`）。

## 2. 変更が及ぶファイル（現行コードを読んで実測）

行番号は `06cfc066`。「区分」は §3 の分割への割り当て案。

| ファイル | 該当箇所 | 内容 | 区分 |
|---|---|---|---|
| `src/logic/techniques/detection.ts` | L50 `DOUGH_TECHNIQUE_ID`、L53 `PINSA_DOUGH`、L56–59 `usesPinsaDough`、L61–63 `requiresPinsaDough`、L85・L97 の `t.id === "dough-pinsa-romana"` | 生地値↔技法 id の対が 1 組だけリテラルで埋まっている | **PD-1b** |
| `src/logic/techniques/doughSwitch.ts` | L13 import、L20 `techniqueAffordanceStep(DOUGH_TECHNIQUE_ID, …)`、L41–42 `doughChipOtherLabel` | 親和（affordance）と 2 つ目のチップの文言が**単一の技法 id**前提 | **PD-1b**（ただし複数値の挙動は PD-2／D-P1） |
| `src/logic/testSupport/lateFinishSim.ts` | L28 `answerVariantOf` の戻り値型 `dough?: "material-multigrain-long-ferment"`、L32–33 | 回答→プレイヤー操作（後乗せ食材＋選ぶ生地）の唯一の変換 | **PD-1c** |
| `src/logic/testSupport/researchAttemptSim.ts` | L55 `MakeVariant.dough` 型、L280–281、L491 `targetDough`、L506 `isDoughAffordanceOpen` を使う試行列 | Research の「生地を変えて試す」プレイヤーモデル | **PD-1c** |
| `src/logic/testSupport/discoveryHintEconomySim.ts`（L258）・`hint5EconomySim.ts`（L162） | `answerVariantOf` の結果を展開して `pizza.dough` に入れる | リテラルは無く、**型が流れるだけ**。`PizzaState.dough` は `DoughKind` 型なので型の整合は取れている | PD-1c の影響（変更不要の見込み、型検査で確認）【推論】 |
| `src/state/discoveryHint.walk.test.ts` | L74–84 `doughOf`・`bake` の引数型 | テスト内に同じリテラル | PD-1c（テストのみ） |
| `src/logic/catalog/testSupport/lateIds.ts` | L57–58 | 既に `recipe.doughKind !== "standard"` で一般的に書かれている | 変更不要 |
| `src/logic/discovery/signature.ts` L176、`identityKeys.ts` L19、`discoveryCatalog.ts` L176 | `resolveDoughKind` 経由 | 一般的に書かれている（値の追加で壊れない） | 変更不要 |
| `src/components/DoughKindSwitch.tsx` L27 | チップ 2 個を固定リテラルで配列化 | N 値化の本体は UI の設計 | **PD-2** |
| `src/logic/dough/doughOutline.ts` L17 | `OVAL_DOUGH_KINDS` に Pinsa のみ（楕円は Pinsa 固有の見た目） | 値ごとの見た目は PD-3 | PD-3 |
| `src/state/pendingRound.ts` L233、`doughSelection.ts` | `isDoughKind` で保存値を検証。未知値は `unresolvable` | 保存互換（G6／D-P4）。PD-1a で参照先が `DOUGH_KINDS` になるだけ | PD-2／D-P4 |
| `src/screens/GameScreen.tsx` L1138 | チップの `selected` | HOT。#738 の merge 後 | PD-2 |
| `src/data/techniques.ts` L14・L41 | `TechniqueId` の union と registry | 新しい技法 id は**データ追加**（PD-3） | PD-3 |
| `src/logic/testSupport/techniqueAllowlists.ts` L18 | `DOUGH_PINSA_ROMANA_RECIPE_IDS` | 新レシピごとに DH4／Hint 5.0 の再実行とセットで追加（ファイル冒頭のコメントが明記） | PD-3 |

PD-1b／c で**触らない**: `techniques.ts`（技法定義の追加は PD-3）、`registration.ts`・`runtime.ts`・`dexView.ts`（技法 id に対して一般的に書かれている【実測】）、`matcher.ts`、`signature.ts`、`discoveryCatalog.ts`、`lateCatalog.ts`、HOT ファイル。

## 3. 設計案（コードは書かない）

### 3.1 PD-1b — 技法の対応表化
- 「生地値 → 技法 id」の対応表を `detection.ts` に 1 つ置く（`standard` を除く `DoughKind` をキーに取り、型で**網羅**。#775 の `DOUGH_KINDS` 導出がこれを可能にする【推論】）。行は Pinsa の 1 行のみ。
- `usesPinsaDough`／`requiresPinsaDough` は「対応表を引いて技法 id を返す」関数に置き換え、`detectTechniquesUsed`／`requiredTechniquesOf` の `TECHNIQUES.filter(...)` の枝は「対応表が返す id の集合に含まれるか」に統一する。**結果の配列と順序（registry order）は不変**にする。順序は `registerTechniqueDiscovery` の `newlyDiscovered` と既存テスト（`["dough-pinsa-romana","late-addition"]`）が固定している【実測】。
- `DOUGH_TECHNIQUE_ID` 単一定数は、`doughSwitch.ts` が使う。N 値では「いずれかの生地技法の親和が開いているか」が正しい（G5 の案 B と整合）。PD-1b では対応表の技法 id 一覧から導出する関数に置き換え、**1 行のときは従来と同値**。
- `doughChipOtherLabel`（2 つ目のチップが技法名になる規則）は、技法が複数あるときに**どの名前を出すか**が D-P1／D-F1 の決定事項。PD-1b は決めない。代わりに「対応表が 1 行ちょうどであること」を固定するテストを置き、2 行目が入る PD-3 で意図的に更新させる（そのとき D-P1 が決まっていなければ落ちる＝ゲートになる）【推論】。
- 検出条件の細部は不変: 現行の `usesPinsaDough` は `dough.status === "OBSERVED"` かつ値一致かつ `ingredientSet` 非空。

### 3.2 PD-1c — シミュレータの一般化
- `answerVariantOf` の戻り値の `dough` を「`standard` を除く `DoughKind`」型にし、`doughKind` が `standard` 以外なら素通しにする（現行は Pinsa との一致比較）。`MakeVariant.dough`・`targetDough` も同じ型にする。現行値では結果が同一。
- **プレイヤーモデルの N 値化はしない**。`researchAttemptSim.ts` の「他の生地だけ→他の生地＋後乗せ 1 つ→標準生地＋後乗せ 1 つ」の試行列は、候補の生地が 1 つであることを前提にしている。生地が N 種になると、生地を知らないプレイヤーは「どの生地か」を試す必要があり、1 回の Research の試行数が増える【推論。目安: 従来 `1 + 2×|ids|` 試行が、非標準生地 N 種を総当たりすると `N×(1+|ids|) + |ids|` 前後】。これは Research の難度と Hint 5.0 の経済に効くので、**PD-3 の前提作業として別に設計・計測する**（PD-1c の範囲に含めない）。
- 同様に `discoveryHintEconomySim.ts`／`hint5EconomySim.ts` の経済値（ヒント消費・試行回数）は、データが増えない PD-1c では**動かない**ことを、既存の `*.sim.test.ts` が変わらず通ることで示す。

### 3.3 挙動不変の示し方（PD-1a と同じ方式）
旧実装を oracle として残し、全入力（技法あり／なし、観測／非観測、`ingredientSet` 空／非空、未知値）で新旧の出力が一致することをテストで固定する。加えて `TETO_PINSA_OFF=1` でも全 Vitest を通す（`vitest.config.ts` の既存手段）。

## 4. Research ラベル／Hint 5.0／DH4／golden への影響

| 対象 | PD-1b／c の影響 | 根拠 | PD-3（最初のデータ）での影響 |
|---|---|---|---|
| Research の cohort 文字（`researchCohortLetters`） | **なし**（レシピ追加なし） | 文字は所有食材（`unlockIngredientOf`）だけから計算され、生地を読まない【実測】 | 追加レシピが既存 cohort に入れば**既存メンバーの文字が動く**。`recipeBatchValidator` の `COHORT_LETTER_SHIFT` が検出し、`acceptedLetterShifts` に明示承認が要る。piadina の cohort は解放食材（arugula 33・prosciutto-crudo 31・cream-cheese 37 の最後＝cream-cheese）で決まるが、他の同 cohort メンバーは**未計測**【未確認】 |
| Hint 5.0 | **なし** | ヒント経路は技法状態を読まないことをテスト（`deductionProduction.gate.test.ts` の「hint path never reads Technique state」）が固定【実測】。PD-1b は技法層のみ | 新レシピごとに `hint5Production.gate.test.ts` を再実行（`techniqueAllowlists.ts` に id を足すと両ゲートが再実行される設計） |
| DH4（`deductionProduction.gate`・`deductionGuard.gate`） | **なし**（`GATE_STATES` は ladder 状態と全レシピ×全素材で、技法の親和は INV-TQ-4 の期待値で検査） | 同上【実測】 | 新しい生地技法は `TECHNIQUE_REQUIRING_RECIPE_IDS` の更新と、親和ステップの期待値（Pinsa は `materialStep("arugula")` = 33）の追加が要る。DH4 の重いテストは過去計測で 17〜41 秒（並列）【過去資料】 |
| golden | **なし** | `sauceB1.singleSource.json`・`lateCatalog.offSurface.json` に dough／multigrain の語は 0 件【実測】 | PD-3 でも dough 軸が golden に出るかは**未確認**（`pinsaGate.test.ts` が OFF 状態の面を固定している） |
| Anti-Oracle（チップ・DOM） | なし（UI を触らない） | 生の id／値は DOM に出さない既存テストが維持される | **PD-2** で案 A／B／C（D-P1）により漏えい面が変わる |
| Dex／技法欄 | なし | `techniqueDexViews` は registry を反復する | 技法が増えると Dex の技法欄が増える（D-F1） |
| 保存 | なし（PD-1b／c は保存を触らない） | — | 値が増えるたびに旧ビルドで `pendingRound.dough` が `unresolvable` になる（G6／D-P4）。**値を実際に選べるようになるまで保存されない**ので、PD-3 の公開（PD-4）までは影響が出ない【推論】 |

## 5. PD-1a（PR #775）との依存【実測＋推論】

| 項目 | 状態 |
|---|---|
| #775 の状態 | open、head `9e77805`、変更 2 ファイル（`doughKind.ts`・`doughKind.test.ts`）。CI／Codex の最終結果は本書では確認していない【未確認】 |
| ファイルの重なり | PD-1b／c と**重ならない**（#775 は `src/logic/dough/doughKind*` のみ） |
| 型の依存 | PD-1b の対応表を `Exclude<DoughKind,"standard">` のキーで網羅検査する案は、#775 が `DoughKind` を `DOUGH_KINDS` から導出することに依存する。#775 が無くても動くが網羅検査が弱くなる |
| 推奨 | #775 の merge を待ってから PD-1b／c を別 PR で開始（`SESSION-OPERATIONS` §8: 待ちは必要な作業だけ HOLD）。待っている間に着手できるのは、本書の設計の Owner レビューまで |
| 他の open PR との競合 | #776（DRIZZLE D1、新規ロジック）・#738（Steam）・#746（Lab）・#775 の変更ファイルに `detection.ts`・`doughSwitch.ts`・`lateFinishSim.ts`・`researchAttemptSim.ts` は含まれないと認識している（#775 のみ API で本文を確認、他は PR 題名と既知の範囲から。古い open PR は未確認）。着手時に `git diff --name-only` で再確認する |

## 6. 最初に解放できるレシピ数（DOUGH_VARIANT 行の分類）【実測・静的】

87 行（`TETO_POOL-REJUDGE_87_Result.md`）のうち DOUGH_VARIANT を要求するのは **31 行、生地の種類は 22 種**。生地 1 種ごとに必要な PD-3（技法定義・チップ・公開ゲート）を考えると、**1 種で解放できるのは最大 1 レシピ**（同じ生地を共有するのは thick-fluffy 6 行、thick 3 行、roman 3 行だが、2 行目以降はすべてブロッカーまたは別工程が要る）。

| 区分 | 件数 | 行 |
|---|---|---|
| DOUGH だけが未対応で、matrix のブロッカーなし | **7**（7 種の生地） | piadina（READY、新食材 0）、poutine（READY、新食材 3）、manakish（新食材 2、出典不一致）、argentine-napolitana（上位集合の重複あり）、ny-style（生地原文なし、部分集合の重複あり）、cauliflower-crust（`margherita` と同一集合）、fathead（`pepperoni` と同一集合） |
| DOUGH＋他の未対応工程 | 11 | chicago-stuffed・fugazzeta-rellena（ENCLOSE）、new-england-bar・montreal・siciliana・greek-style・detroit-style（PAN／SHAPE）、pizza-al-taglio・old-forge（SHAPE。天板は tray 系で出荷済み扱い、`TETO_POOL-REJUDGE_87_Result.md` §10）、turkish-pide（SHAPE）、pizza-a-caballo（ENCLOSE、証拠欠落） |
| DOUGH だけ未対応だが matrix のブロッカーあり | 13 | st-louis・quad-cities・colorado・pizza-de-cancha・palmitos・pizza-carciofi/cicoria/puntarelle（roman）・pizza-romana・focaccia-genovese・fugazzetta・fruit-dessert・lahmacun |

**最初に解放するなら piadina 1 件**: 新食材 0・READY・重複ゲート通過（Jaccard 0.40、`rucola-e-grana` と）。ただし piadina の解放には、PD-1a→1b→1c→PD-2（チップ UI、#738 merge 後）→PD-3（データ＋専用ゲート OFF）→PD-4（公開、実機 HV）が要り、**投入時機（P-2：案 P＝全て焼成前、案 F＝後乗せ）・NO_SAUCE（D-F2）・原典（G8、暫定仕様）**の Owner 判断も要る（Rev 5 の提案では 4 問）。PD-1b／c の GO 自体は、これらの判断を待たない。

## 7. 停止条件（実装フェーズに入った場合に適用する案）

次のいずれかなら即停止し、報告する（続行しない）:
1. 既存テストのどれかが**変更なしで**落ちる（特に `techniques.test.ts` の registry 順、`doughSwitch.test.ts`、`discoveryHint.walk.test.ts`、`*.sim.test.ts`、`deduction*.gate`、`hint5Production.gate`、`TETO_PINSA_OFF=1` の全体）。テストを書き換えて通すのは禁止。
2. 対応表が 2 行以上になる、または `DOUGH_KINDS` が 2 値以外になる必要が出る（＝PD-3 の領域）。
3. `GameScreen.tsx`・`App.tsx`・`gameReducer.ts`・`pendingRound.ts`・`recipes.ts` などの HOT ファイルや UI を触る必要が出る（＝PD-2 の領域）。
4. #775 が merge 前に設計を変える（`DOUGH_KINDS` の形が変わる）、または別セッションが `detection.ts`／`doughSwitch.ts`／該当シミュレータを触る claim／PR を出す。
5. Research の試行数や Hint の経済値が変わる（経済シミュレータの出力差分が出る）。
6. 型の波及が `discoveryHintEconomySim.ts`／`hint5EconomySim.ts` で型エラーを起こし、挙動変更なしに直せない。

## 8. Owner 判断表（各に推奨つき）

| ID | 論点 | いつ要るか | 推奨 |
|---|---|---|---|
| P-1 | PD-1b を PD-1c と**別 PR**にするか（#773 の分割どおり）、1 PR にまとめるか | PD-1b 着手前 | 別 PR（ファイル集合が交わらない。レビューとロールバックが容易）。ただし同時実装枠が逼迫するなら順番に |
| P-2 | PD-1b／c の GO を #775 の merge まで待つか | 今 | 待つ（型の網羅検査が使える。技術的な必須ではない） |
| P-3 | PD-1c の範囲を、定義の 2 ファイルから「型が流れる 2 ソース＋`discoveryHint.walk.test.ts`」まで広げてよいか（挙動変更なし） | PD-1c 着手前 | 広げる（広げないと型エラーで通らない可能性）。型検査で必要な場合のみ |
| P-4 | PD-1b で「対応表が 1 行ちょうど」を固定するテスト（2 行目で落ちる）を置いてよいか | PD-1b 着手前 | 置く（D-P1 未決のまま複数値が入るのを防ぐゲート） |
| P-5 | Research のプレイヤーモデルの N 値化（試行数の増加）を PD-3 の前提作業として別に設計・計測する | PD-3 の前 | 別タスクで実施（本書では未計測）。試行数が増えれば Hint 経済の再計算が要る |
| P-6 | 最初の生地を piadina とし、その前提（投入時機 P-2、NO_SAUCE D-F2、暫定仕様 G8）を Owner が先にまとめて決める | PD-3 の前 | まとめて 4 問（Rev 5 §5）で決める。PD-1b／c の GO とは独立 |
| P-7 | 同時実装枠（上限 2 件）に PD-1b／c をどう入れるか（#738・#746・#776・#775 が既に枠を使っている） | GO 時 | PD-1b → PD-1c の順で 1 件ずつ。#775 の merge 後 |

## 9. 未確認事項

- #775 の CI／Codex の最終結果、merge 状態の将来変化。
- 古い open PR（#540・#478・#321 など）の変更ファイルとの重なりの再確認。
- piadina の cohort の同居メンバーと、cohort 文字のずれ（実装 PR の `recipeBatchValidator` で実測する）。
- 新しい生地技法の Dex 表示・チップ文言（D-P1／D-F1）。
- Research の試行数の増加（P-5）の実測値。
- 原典 pizzadb.jp は 31 行すべてで未確認。
- テスト実行・アプリ実行・HV はしていない（docs-only）。
