# B10 実装前の最終調査 — #544 再監査・curry-ketchup・family 分類・PR-1 / PR-2 の必須ゲート（docs-only）

Status: **調査と整理のみ。runtime は実装していない**（`src/**`・`e2e/**`・CSS・テスト・データ・golden・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更）。実装・PR 作成・merge・Monitor 作成・Issue/PR へのコメント・claim 投稿はしていない。**#679（BBQ）と #683（Pinsa OFF スイートの修正）の担当セッション、およびそのブランチには触れていない**（GitHub の PR 情報を読んだだけ）。
基準 `main` = `08cd46d`。姉妹資料: `TETO_NEXT-BATCH-10_EXPANSION-PLAN_2026-10-27.md`（第 3 版の更新あり）、`TETO_WASABI-BEEF_FINAL-DESIGN-GATE_2026-10-27.md`。
**仕様は確定していない**（Owner: E-1 は検証の承認であって仕様確定ではない）。原典（pizzadb.jp）は未確認で、本セッションは到達していない。matrix の記述を原典の事実として断定しない。すべて GAMEPLAY ASSUMPTION として扱う。「推定」は測定値ではない。「推奨」は助言で、Owner Decision ではない。

## 0. Owner 判断（2026-10-27 第 3 弾）と本資料での扱い

| 判断 | 扱い |
|---|---|
| E-1 カレー→curry-ketchup の**検証を承認**（仕様確定はまだ） | §3 で検証。結果は「検証に通る見込み。実測が要る項目あり」。仕様は確定しない |
| E-2 cuban の 360 Pitz を**暫定承認** | 構成に cuban を残す（暫定） |
| E-3 goulash・suya は **HOLD** | 構成・ladder から外す。再開は個別の基底ソース決定後 |
| E-4 sour-cream・nori・pickles・mustard の **family 監査を承認** | §4 |
| E-5 #544 の再監査を**実装前の必須条件**とする | §2。**identifier 互換性の再監査は本資料で実施した**。§15 の再計算（OD-544-8）は未実施のまま（§2.1） |
| E-6 通常 5 + late 4 の 9 件を暫定採用（tandoori-paneer を含む）。10 件目は保留 | 構成を 9 件に更新 |
| E-7 通常 PR → late PR の 2 PR 構成を承認。**公開ゲート省略は未承認** | §5.5 に公開ゲートの選択肢と費用 |

## 1. 事前確認

| 確認 | 結果 |
|---|---|
| `CLAUDE.md` / `PROJECT_HANDOFF.md` | 読了。HANDOFF 冒頭は 9/18 だが、現況の正は GitHub と `TETO_STATE-SYNC_2026-10-26.md`（HANDOFF 自身が明記） |
| 最新 main | `08cd46d`（#677）。本ブランチは取り込み済み |
| open PR | **#679 BBQ**（別担当。claim は #611 で一本化、HEAD `933e518`）、**#683**（`pinsaGate.test.ts` の late 一覧 2 箇所の追随。別担当、テストのみ、mergeable `unstable`）、#682（w1Reachability の分割、別担当）、#651 / #650 / #620 / #612 / #587（docs-only）、#581、#540（Draft・HOLD）ほか古い PR |
| open Issue | #544（本調査の対象。未クローズ）、#611、#578（U3 claim が 11/02 まで）、#577、#521、#394 / #680 / #681（CI の間欠失敗） |
| claim | #611: BBQ は #679 のセッションに一本化。**B10 用の claim は誰も出していない**（本調査は新規ファイルのみで、既存 claim と重ならない） |
| 本調査が使った実行環境 | `npm ci` で依存関係を入れ、**読み取り専用の確認スクリプト（scratch、コミットしない）**を実行した。リポジトリのソース・テストは変更していない |

## 2. #544 Research identifier compatibility の再監査

### 2.1 #544 の未実施項目の洗い出し

#544 本文（4 項目）、`TETO_RESEARCH-2.0_FRESH-AUDIT-544_Result.md`、OD-544-1〜8 の状態を現行 main と突き合わせた。

| # | 項目 | 状態（現行 main） | 本調査 |
|---|---|---|---|
| 1 | cohort letter の安定性を catalog 全体で再監査（57 → 現在 69 recipes） | **本番カタログでは 2026-10-18 に 57 件で実施済み。現行 69 件と追加予定 9 件では未実施だった** | **実施した（§2.2）** |
| 2 | Anti-Oracle §15 の期待 attempt 数を**複数ソース前提**で再計算 | **未実施。** §15 は旧前提のまま。OD-544-8 は「E の Final Gate 前に必須」だったが、E（グランマ、#655）は 2026-10-24 に merge 済みで、#655 の本文・Result に再計算の記録は無い。記録上は未実施のまま E が入った | **実施していない**（§2.4）。Owner 判断 D-R1 |
| 3 | 全 cohort で INV-B7（label は unlock 材料と文字以外を出さない）を確認 | 既存テストは step 12 / 25 / 28 の fixture のみ（`researchCohortLetter.test.ts`）。**全 cohort を一括で見る検査と、cohort 構成の golden は無い** | 静読と実測で確認（§2.3）。**PR-1 の必須テストとして追加を提案** |
| 4 | Validator の必須チェック化 / 例外の書式 | **実装済み**: `COHORT_LETTER_SHIFT` / `COHORT_UNLOCK` と、Owner 承認の `acceptedLetterShifts`（Pinsa の `jamon-serrano-pizza: "-->B"` が前例、`recipeBatchManifest.ts`） | B10 は例外**なし**で通る見込み（§2.2） |
| 5 | letter は購入順に依存する表示用識別子、と明文化 | **済み**（OD-544-4 / 5、`TETO_RESEARCH-2.0_OWNER-DECISIONS.md` §4.1） | 変更なし |
| 6 | `PAN_TRAY_RECIPE_IDS` の共有化、multi-sauce allowlist（OD-544-1 / 2） | E で実装済み（`MULTI_SAUCE_RECIPE_IDS = ["grandma-pizza"]`、`PAN_TRAY_RECIPE_IDS` は共有定数） | B10 は multi-sauce を使わない |
| 7 | G2 共通文言・購入ゼロ〜全購入の timing parity（OD-544-7 / F4） | F4 側の受け入れ条件（B10 の対象外） | — |

### 2.2 実測: 現行カタログと追加予定 9 件の cohort 互換性

方法: 本番の `researchCohortLetters`（`src/logic/discovery/researchEntry.ts`）と**同じ規則の複製**（cohort = 登録可能な recipe を「プレイヤーが最後に取得した有限材料」で束ね、`opaqueHash`（FNV-1a）の順に A, B, …）を書き、**まず本番の実装と一致することを確認**した（現行カタログで、ladder 順 1 回 + ランダムな取得順 40 回、**不一致 0 件**）。そのうえで、追加予定の 9 件（currywurst・curry-pizza-japan・rendang・tandoori-paneer・cuban・bulgogi・yakiniku・wasabi-beef・mentaiko-cream）と、計画どおりの ladder（通常 5 step を通常 ladder の末尾に、late 4 step を既存の late の後に）を足した合成カタログで計算した。BBQ（#679、未 merge）を足した場合も計算した。合成材料はすべて有限材料（`unlockCondition` あり）とした。

| 確認 | 結果 |
|---|---|
| 現行（69 recipes / 75 ingredients / 60 ladder steps）の文字つき cohort | 6 cohort・13 recipes: garlic（marinara A / grandma-pizza B）、onion（aussie A / brazilian-calabresa B / pizza-portuguesa C）、fresh-tomato（pesto-caprese / chilean-napolitana）、zucchini（ratatouille-pizza / pesto-vegetariana）、arugula（pinsa-romana / jamon-serrano-pizza）、catupiry（brazilian-catupiry-corn-pizza / frango-catupiry） |
| 追加予定 9 件を足した後（ladder 順） | **新しい文字つき cohort は発生しない。既存 recipe の文字の変化は 0 件**。新規 9 件はすべて「文字なし」。BBQ を足しても同じ |
| `acceptedLetterShifts` の要否 | **不要（空のまま）**。観測された変化は `COHORT_LETTER_SHIFT` として失敗させる運用でよい |
| 同一 save 内の安定性（ランダム取得順 400 通り × 全 prefix、約 3.5 万チェック） | **一度付いた文字が変わる / 外れる事象は 0 件**（9 件のみ・BBQ 込みの両方） |
| 取得順への依存（OD-544-4 / 5 の範囲） | 増えている: 最大 cohort サイズ **12 → 18**（BBQ 込みで 19）、1 recipe が取り得る文字の種類の最大 **11 → 17**（18）、平均 **4.7 → 5.4**（5.6）。**26 を超えず、`AA` 以降は発生しない**。2026-10-18 の監査（57 件、最大 10 種類）から、カタログの成長とともに増えている |

**判定: identifier 互換性は PASS（確認できた範囲）。** 条件: (1) 実装時に本番の `researchCohortLetters` で同じ確認をやり直す（合成材料は `nameJa`・`unlockCondition` を持たない仮置き）、(2) 取得順への依存が増えている点は OD-544-4 / 5 の許容範囲内だが、**26 に近づく前（約 85〜90 件）に再監査**する。

### 2.3 INV-B7（label の情報量）
`researchEntryLabel` は `？？？ピザ［文字］（解禁の材料名）` だけを返し、recipe 名・id・No.・件数・cohort の大きさ・hash を出さない（静読）。B10 の新しい label の形: `（カレーケチャップ）`（curry-pizza-japan）、`（牛肉）`（rendang）、`（わさび）`（wasabi-beef）など。**投入の時機（焼成後）は label に出ない**（late も通常と同じ形）。注意点: `nameJa` は label にそのまま出るので、**新材料の `nameJa` が recipe 名と同じ語になる場合（例: 材料名がレシピ名と一致する）は INV-B7 の観点で確認する**。B10 の 15 材料に該当は無い（`wurstel` ≠ `currywurst` 等）。

### 2.4 §15（OD-544-8）の再計算: 未実施
- 既存の `src/logic/testSupport/researchAttemptSim.ts` は、**実 reducer を通す fresh save → Dex の walk** で、複数ソース（Multi-Sauce S3 の「2 つ目のソース」）と late の FINISH（`lateFinishSim.ts`）の戦略を持っている。つまり**再計算の道具はある**。ただし、既存の walk テスト（`researchAttempt.sim.test.ts`）は「Dex 28 に到達する」前提で、現行の 69 件全体を歩く形には**なっていない**（test 名とコメントからの読み取り。本セッションでは実行していない）。
- 再計算は、そのシミュレータを 69 件（と B10 後の約 78 件）に拡張して走らせる**テスト基盤の作業**で、docs-only では完了しない。**D-R1: B10 の前提にするか。** 助言: **PR-1 の Final Gate 前に実施する**（カタログが 70 件に達し、これ以上延ばす前に数値を更新するため）。ただし #544 自体と E-5 の「identifier 互換性」は §2.2 で満たしたので、§15 は**別の前提条件として切り分ける**のが整理しやすい。

## 3. curry-ketchup の検証（E-1、仕様確定はしない）

### 3.1 既存の定義
- **ランタイムに定義は無い**（`src/` に `curry-ketchup` は出ない。`ingredients.ts`・`lateCatalog.ts`・taxonomy のいずれにも無い）。出てくるのは設計資料だけ: 172 品 matrix（`spreadLayerIngredientIds`、`sauceFamilyTable` の「カレー」）、`TETO_RECIPE_172_RUNTIME-SNAPSHOT.json`、**旧 Progression 2.0 の設計**（`TETO_PROGRESSION2_PHASE2_UNLOCK-GRAPH.md` で step 66・endgame、`TETO_PROGRESSION2_PHASE34_UNLOCKS.md` で累計 ★180 — **現行の追記専用 ladder には引き継がれていない過去の案**）。
- したがって curry-ketchup は**新しい sauce 材料**（カテゴリ `sauce`、PAINT）で、「既存の定義との整合」は matrix 上の整合を指す。

### 3.2 カレー系レシピとの整合
- matrix の `sauceFamilyTable`: 「カレー」は**ちょうど 1 つ `["curry-ketchup"]` に対応**し、規則は「汎用のカレーソース。**列挙されたカレーソースだけが満たす**」。**172 品の世界にカレー系のソース id は curry-ketchup しかなく、競合する候補が無い**。
- カレー family の行: currywurst（curry-ketchup が列挙）、curry-pizza-japan（「カレーソース」を列挙、id は未解決 `listed_unresolved`、関連 id = curry-ketchup）、keema / tandoori-paneer / chicken-tikka / baingan-bharta / rendang（**基底ソースが未特定**）。
- **D-B3 は、matrix の規則（列挙されたものだけが満たす）を「未特定の行にも curry-ketchup を当てはめる」と拡張する仮定**。curry-pizza-japan は列挙があるので最も自然、残り（rendang・tandoori）は**仮定**。
- 忠実度の注意（GAMEPLAY ASSUMPTION として明記する）: curry-ketchup はドイツのカリーヴルスト用のソースで、日本のカレー・タンドリー・ルンダンの基底に使うのは**ゲーム上の簡略化**。4 レシピのソースが同じ色になるため、**識別は材料で行う**（材料集合は既存 69 件と一致・近接なし、Python で確認済み）。
- 材料集合の衝突（合成）: curry-pizza-japan と rendang は beef ↔ chicken の差（2 差）。tandoori-paneer と rendang は 3 差。**同一 base の「1 材料差」の対は無い。**

### 3.3 描画
- ソースは**色駆動**（専用 SVG なし、`color` が canvas に塗られる）。色は**暫定**で実機 HV で確定。
- 候補 `#d9892b`（琥珀）: 既存ソースとの色差（CIE76 ΔE、sauce 間）— miso 30.0 / tomato 37.8 / yuzu 42.9。**30 以上**で、BBQ の暫定（#679）や soy-sauce の暫定とも離れる。焼成後の生地（`#e2b878`）との差は 29.8、こんがり（`#c98a4b`）との差は **17.5 と小さい** → **焼き色の濃い生地の上では見づらくなりうる。実画面で測る**。
- 観察（#679 の担当への情報。本調査では触れない）: 既存の sauce 間の最小色差は **doubanjiang と BBQ の暫定 `#7a2f1c` の 8.9** で、他の組より小さい。
- mustard（cuban の基底、§4）を `#d4b020` とした場合、curry-ketchup（琥珀）との ΔE は 27.4。**黄褐色が 2 つ並ぶ**ので、HV で見比べる。

### 3.4 調理工程
- **新しい工程は不要。** 通常フロー `DOUGH → SAUCE（PAINT）→ CHEESE → TOPPING → BAKE`（`deriveCoreSteps`）。`recipeSauceProfiles.ts` の `ingredientId` の union に `curry-ketchup` を足す（U1〜U3・BBQ と同じ型）。CUT なし・`lunchRush: false`（Batch 8a と同じ。Lunch Rush のプール 25 は不変）。
- Hint 5.0 の key-free BASE 段（全ソース + 全チーズ、10 Pitz）に curry-ketchup が加わる。**4 つのカレー系レシピで同じソース候補**になるが、それ自体は情報漏えいではない（ソース行は「使った sauce の全件」を判定する構造）。

### 3.5 判定
**検証に通る見込み（条件付き）。** 条件: (1) 実装時に DH4 / Hint 5.0 の gate を実データで回す、(2) 色は実機 HV で確定、(3) `nameJa`（例: 「カレーケチャップ」）は Owner 確認、(4) rendang・tandoori に当てはめるのは**仮定**であり、curry-pizza-japan だけが matrix に列挙された根拠を持つ（これを PR・Result に明記）。**仕様は確定しない。**

## 4. sour-cream・nori・pickles・mustard の family 監査

### 4.1 規則（コードの静読）
- `ingredientTaxonomy.ts` の冒頭: family は **topping にだけ**付く。**sauce と cheese はカテゴリがそのまま属性**で、family 行を持たない。
- `hint5Taxonomy.gate.test.ts`: **G1 / INV-T1**「実行時の topping はすべて**ちょうど 1 つ**の有効な family に解決される」、**G24 / INV-T2**「family の行は**すべて topping**（sauce・cheese の行は不可）」、**G18**「分類の emoji が食材の emoji と重ならない」。
- `deductionProduction.gate.test.ts`: 「その他」（family `other` / group `other`）は**どの状態でも答えに現れない**（OD-DH4-2-9）。現在 `other` は egg・almond・pine-nuts の 3 件。月見が保留されているのは、egg が `other` で、月見を足すと 1 状態でこの gate に抵触したため。
- 現在の family の大きさ（topping）: vegetable 21、meat 10、seafood 9（roe を含む）、herb 8、fruit 3、spice 2（capers・white-sesame）、other 3。**B10 の新 topping を足しても k ≥ 2 の保護（`MIN_ATTRIBUTE_CANDIDATES`）に問題は出ない**。

### 4.2 分類（提案）

| 材料 | 現在の matrix | 選択肢と帰結 | 助言 |
|---|---|---|---|
| **mustard** | **spread 系**（`spreadLayerIngredientIds` に含まれる。cuban の基底として列挙） | `sauce` カテゴリ → family 不要、DH4・Hint の `other` リスクなし。色は暫定（黄褐色） | **`sauce`（PAINT）。family なし。** 低リスク |
| **pickles** | topping（cuban）。spread ではない | `vegetable`（前例: sauerkraut・baked-beans・palm-heart・jalapeno・artichoke・avocado は `vegetable`） | **`vegetable`。** 低リスク |
| **nori** | topping（mentaiko-cream ほか。3 行で後乗せの記録）。spread ではない | `vegetable`（海藻 = 植物性、group `produce`）/ `spice`（薬味として使う、group `aroma`。shiso=herb・白ごま=spice の前例）/ `seafood`（魚介ではないので非推奨）。**`other` にはしない** | **`vegetable`（第一候補）、`spice` も妥当。** どちらでも `other` に触れない。Owner の L1 決定 |
| **sour-cream** | goulash のみ。**spread 系ではない**（`spreadLayerIngredientIds` に無い） | **topping にすると family が `other` しか無い**（乳製品）→ OD-DH4-2-9 に抵触する（月見と同じ構造）。`cheese` カテゴリ（前例: cream-cheese・ricotta・catupiry・feta は cheese）なら family 不要。`sauce` カテゴリなら family 不要で、**goulash の基底ソースの未特定も解消する**（NO_SAUCE にしなくてよい） | **topping にはしない。** `sauce` か `cheese`。**goulash は HOLD なので、カテゴリの決定は goulash の再開まで不要**。`sauce` にする場合は `fromage-blanc-sauce`（ΔE 5.2、ほぼ同色）と見分けがつかない点に注意 |

**他の新 topping（参考）:** beef・wurstel = `meat`、paprika-powder・wasabi = `spice`、cod-roe = `seafood`、いずれも `other` には入らない。

### 4.3 DH4 / Research privacy への影響
- **DH4:** 上の分類（mustard = sauce、pickles = vegetable、nori = vegetable か spice、sour-cream は topping にしない）なら、**`other` への新規流入はなく**、OD-DH4-2-9 の gate（「その他は到達不能」）は維持される見込み。**実データでの gate 実行は実装 PR で行う**（本セッションはソースを変更していないため、新材料を含む実測は未実施）。`deductionGuard.gate` の旧件数 pin は動くので、**材料別の原因分解**（U1〜U3 の前例）を行う。
- **Research privacy:** family は Research の label（INV-B7）に出ない。family の答えは DH4 の「特徴ヒント」（有料）にだけ出る。新材料の追加で INV-D1〜D7 は変わらない。
- **Hint 5.0:** 新 topping はすべて「ちょうど 1 つの family」が必要（G1）。nori・pickles の family 行を `ingredientTaxonomy.ts` に足す（PR-1 は pickles、PR-2 は nori）。

### 4.4 ベースライン gate（現行 main、本セッションで実行）
`hint5Taxonomy.gate.test.ts`・`deductionProduction.gate.test.ts`・`researchCohortLetter.test.ts` を現行 main に対して実行した結果: **3 files・47 tests すべて pass**（約 112 秒。`hint5Taxonomy` の G1 / G24 / G18、DH4 の「その他は到達不能」を含む）。**新材料を足した状態での実行ではない**（ソースは変更していない）ので、B10 の材料を含む gate の結果は実装 PR での実測になる。

## 5. PR-1 / PR-2 の必須ゲート

### 5.1 構成（9 件、E-6）と依存

| PR | レシピ | step（ladder） | 材料 | 前提 |
|---|---|---|---|---|
| **PR-1（通常）** | curry-pizza-japan | `[curry-ketchup]` | 1 | D-B3 の検証（実測）、**#683 の merge**（Pinsa OFF スイートの基準が赤のため） |
| | rendang-pizza（**beef の導入役**） | `[beef]` | 1 | 同上、curry-pizza-japan の step が前 |
| | currywurst | `[paprika-powder, wurstel]` | 2 | 同上 |
| | tandoori-paneer-pizza | `[paneer]` | 1 | 同上 |
| | cuban-pizza | `[mustard, pickles, swiss-cheese]` | 3（360 Pitz、暫定承認） | pickles の family |
| **PR-2（late）** | bulgogi-pizza | late `[soy-sauce]` | 1 | PR-1 merge（beef）、**#679 merge**（late 一覧の pin・floor の導出）、D-B1 / D-B4 の検証 |
| | yakiniku-pizza | late `[yakiniku-sauce]` | 1 | 同上 + D-B4 |
| | wasabi-beef-pizza | late `[wasabi]` | 1 | 同上 |
| | mentaiko-cream-pizza | late `[cod-roe, nori]` | 2 | 同上 + D-B5、nori の family |

**保留（構成外）:** goulash・suya（E-3）、10 件目（E-6）。

### 5.2 PR-1 と PR-2 の依存関係と並行性
- **PR-1 は #679 に依存しない**（late catalog を使わない）が、**`RECIPES` / `ingredients.ts` / ladder / golden を #679 と共有する**。両方が hot file を触るので、**後に merge する側が golden・件数 pin を再生成して追従**する（既存規則）。
- **PR-1 の ordinary step を足すと、既存の late 材料の導出 step 番号が +5 ずれる**（通常 56 → 61。`lateCatalog.ts` の KNOWN LIMIT）。**PR-1 は late catalog が本番 ON になってから初めての通常バッチ**で、互換下限（`LATE_ENTITLEMENT_FLOORS`、`salmon-roe: 57` ほか）が実戦で試される。必須テスト: 既存セーブ（クレジット数 56〜61 付近、late 材料が既解禁・未解禁の両方）で **late 材料の解禁が後退しない**こと、新しい通常 step が追加で解禁されること。lateCatalog の各テストが**絶対 step 番号を pin している箇所は導出に直す**（実装時に洗い出す）。
- **PR-2 は PR-1 の beef に依存**（通常側の beef が無いと late 3 件が出せない）。

### 5.3 Pinsa ON/OFF
- **`npm run test:pinsa-off`（`TETO_PINSA_OFF=1`）は CI で走らない**（#683 の本文）。そのため **main は OFF 側で 2 件失敗したまま**で、#683 が直している（`pinsaGate.test.ts` の late 一覧）。**B10 の各 PR は ON・OFF の両方を手元で全件走らせ、結果を PR に記録する**（CI が守らないため）。
- **`pinsaGate.test.ts` の OFF 専用テストは late recipe の厳密な一覧**（`LATE_RECIPES` の id と `RECIPES.at(-1)`・ladder の最後の key）を pin している。**PR-2 は late 4 件を、BBQ（#679）の分と合わせて 2 箇所に追記**する（#683 の注記と同じ）。PR-1（通常）は一覧に触れないが、**件数 pin は ON / OFF で 1 差**（pinsa-romana）なので `catalogDerived` 系の導出で書く。
- B10 は Pinsa の材料・生地・技法を使わず、Pinsa は late step を持たない（`ladderCredit: false`）ので、**ON / OFF で late step の導出番号は動かない**。cohort も arugula 系に触れない（§2.2）。ロールバック（`PINSA_PRODUCTION = false`）後も B10 は成立する。

### 5.4 保存互換性
- **schema は v2 のまま**。B10 に save の追加・migration はない。
- **旧ビルドで新しい save を開く場合（rollback の安全性）:** `persistence.ts` の `unknownIdsIn(raw.ownedIngredientIds, KNOWN_INGREDIENT_IDS)` が**未知の食材 id を保持する**（`ownedIngredientIds` の読み書きで落とさない）。Dex は #674（R4/R5、merge 済み）で**未知のレシピを raw のまま保持**する。**PR-1・PR-2 で「新しい save を B10 前のビルドが開いて再保存しても、B10 の食材・Dex が落ちない」ことをテストで固定する**（#674 の前例）。
- **取得順が cohort の権威**（`persistence.ownedOrder.test.ts`）。通常 step の挿入で**既存プレイヤーの取得順は変わらない**（追記のみ）。
- 表示のみの変化: 既に章を完了しているプレイヤーの Dex 章の分母が増える（例: 24/24 → 24/25）。データは消えない（Batch 8c 計画の前例）。

### 5.5 公開ゲート（E-7: **省略は未承認**）

| 案 | 内容 | 費用 | 助言 |
|---|---|---|---|
| **G-0** | 公開ゲートなし（現行運用）。merge = 即公開、Owner の実機 HV と最終承認まで merge しない | なし | PR-1・PR-2 とも可能。Owner が承認していないので**決定が要る** |
| **G-1（PR-2 のみ）** | Pinsa と同じ**専用リテラル**（例: 「B10 late の公開」）+ OFF ロールバック用の test project | 小〜中（`pinsaGate.ts` 型の 1 ファイル、vitest の rollback plugin、OFF 用テスト）。**late catalog の機構（`mergeLate`）の上でだけ可能** | PR-2 だけなら現実的 |
| **G-2（PR-1）** | 通常レシピのためのゲート | **新しい基盤が要る**: `RECIPES` / `INGREDIENTS` / `DISCOVERY_LADDER` は静的な `as const` で、late のような「ビルド時定数で合流」する仕組みは通常レシピに無い（#611 §3 の案 1 が late 用に作った機構）。**通常側にゲートを作るのは別の設計課題（M 以上）** | **PR-1 に公開ゲートは付けにくい**。付けるなら先に基盤の設計 Gate が要る |

→ **D-G1: 公開ゲートの扱い。** 助言: PR-1 は G-0（HV の後に merge）、PR-2 は G-0 か G-1 を Owner が選ぶ。G-2 は B10 のために作らない。

### 5.6 golden・pin・E2E
| ゲート | PR-1 | PR-2 | 測定・備考 |
|---|---|---|---|
| `hint5.ladders55.json`（`hint5Ladder.golden55.test.ts`） | **`RECIPES` の順に出力されるため、新しい通常 5 件は late 4 件（ikura 〜 eggplant-tahini）の前に挿入される**（既存エントリの中身は不変、ファイル先頭からの追記ではない）。生成物なので再生成し、既存エントリが byte 同一であることを差分で確認 | late 4 件（と BBQ）は末尾に追記 | 手書きしない。Pinsa は golden の対象外 |
| `hint5.alphaFamilyOnly.json`・DH4 監査 JSON（`docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`） | 要再生成 | 要再生成 | U1〜U3 の前例 |
| `catalogLedger.test.ts`（期待総数の唯一の台帳）、`recipeBatchManifest.ts`（`planned` → `landed`）、Recipe Batch Validator | 要更新（ledger は導出に寄せる） | 要更新 | `acceptedLetterShifts` は空 |
| `deductionGuard.gate` の件数 pin | 材料別の原因分解 | 同左 | privacy assertion は緩和しない（OD-B9-15） |
| `ladderReachability.starGate`・`ACCEPTED_MIN_SLACK`（= 1） | credited +5 / step +5 | credited +4 / step +4 | ON / OFF 両方で実測 |
| `materialEntitlement.lateFloor.test.ts`・lateCatalog 各テストの絶対 step 番号 | **導出に直す（§5.2）** | floor を足す（出荷時の導出値） | 既存セーブ互換 |
| `pinsaGate.test.ts`（OFF の exact list） | 触れない | **追記（BBQ 分と合わせて）** | #683 が先 |
| 新規テスト | table 駆動の recipe テスト、cohort の**全 cohort 一括の INV-B7 検査と cohort 構成 golden**（§2.1-3）、旧ビルド読み込みの round trip、late 材料の解禁不後退 | 同左 + FINISH の実 reducer テスト | — |
| E2E（Chromium 390×844 / 360×800、WebKit は CI） | 新規 spec 1 本。**既存 spec への影響: 新しい文字つき cohort が出ないので Research の label 系は変わらない見込み**（実行して確認）。**tray のページ数・Shop の一覧・Dex の章**は増える（#675: 75 食材 UX） | 同左 | WebKit の間欠失敗（#394 / #680 / #681）は再実行ではなく記録（SESSION-OPERATIONS） |
| HV | 動画 390×844（Owner へ直接）+ 前後スクリーンショット（390 / 360）。**iPhone 実機は Owner** | 同左 | 色（curry-ketchup・mustard・soy-sauce）と SVG（beef・wasabi）を HV で確定 |

## 6. PR-1 の着手可否

**判定: 設計は着手可能（PR-1 の Final Design Gate は提出できる）。実装の着手は、次が揃うまで「不可」。**

1. Owner の明示的な実装開始の指示。
2. **#683 が merge される**（`test:pinsa-off` の基準が main で赤のため。#683 は別担当で、私は触らない）。
3. §7 の Owner 判断のうち、PR-1 に必要な 5 件（R-1〜R-5）。
4. D-B3 の**実測検証**（curry-ketchup を足した DH4 / Hint 5.0 gate、色の HV）— 仕様は E-1 のとおり確定しない。
5. **D-R1**（§15 の再計算を前提にするか）の決定。助言は「PR-1 の Final Gate 前に実施」。

PR-1 は #679 と独立に進められる（ただし hot file の merge 順で追従が要る）。PR-2 は PR-1 と #679 の merge 後。

## 7. 残る Owner 判断（最小化）

| ID | 内容 | 必要な PR | 助言 |
|---|---|---|---|
| **R-1** | curry-ketchup の `nameJa`（例「カレーケチャップ」）と、暫定色 `#d9892b`（実機 HV で確定）を受け入れるか | PR-1 | はい |
| **R-2** | mustard = `sauce`（PAINT、暫定色 `#d4b020` 前後・HV で確定）、pickles = `vegetable` | PR-1 | はい（低リスク） |
| **R-3** | nori の family: `vegetable` か `spice`（`other` にはしない） | PR-2 | `vegetable` |
| **R-4** | PR-1 の構成（5 件）、`lunchRush: false`・CUT なし | PR-1 | はい |
| **R-5** | **D-R1**: §15（複数ソース前提）の再計算を B10 の前提にするか。#544 の identifier 互換性は本資料で満たした | PR-1 の Final Gate 前 | 前提にする（別の前提条件として） |
| **R-6** | **D-G1**: 公開ゲート。PR-1 は G-0（HV 後に merge）、PR-2 は G-0 か G-1 | PR-1 / PR-2 | PR-1 = G-0。PR-2 は Owner が選ぶ |
| **R-7** | PR-2 の前提として D-B1（甘辛だれ→soy-sauce）・D-B4（白ごま→POST_BAKE）・D-B5（明太子→fromage-blanc-sauce）の検証結果の確認。**D-B1 は matrix の「甘辛だれ」候補に soy-sauce が含まれず（miso・okonomiyaki・sweet-bean・teriyaki・yakiniku）、yakiniku-sauce を選ぶと bulgogi と yakiniku の材料集合が同一になり衝突する**（本調査で確認）。soy-sauce は衝突を避けられる選択肢だが、matrix の候補外 | PR-2 | 検証を進める（Owner の承認が要る） |
| **R-8** | sour-cream のカテゴリ（`sauce` / `cheese`）は **goulash の再開まで不要**（HOLD） | — | 保留 |

**Owner の決定が要らず、実装前 Gate で機械的に行うもの:** DH4 / Hint 5.0 gate の実データ実行、`ladderReachability.starGate`、`test:pinsa-off`、cohort の再実測（本番の `researchCohortLetters`）、golden の再生成と差分確認。

## 8. 触れていないもの

`src/**`、`e2e/**`、CSS、テスト、データ、golden、workflow、本番スイッチ、共有 Preview、Production、Firebase、保存データ、`docs/PROJECT_HANDOFF.md`、既存の決定記録、**#679 と #683 のブランチ・担当セッション**、Issue/PR へのコメント・クローズ。scratch の確認スクリプト（cohort の複製と実測）はコミットしていない。merge・deploy・CI 再実行・Monitor 作成はしていない。
