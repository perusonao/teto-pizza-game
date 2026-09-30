# Cooking Interaction 2.0 — Fresh Audit（docs-only / 判断資料）

- **種別:** 監査・設計判断のみ。production code・test・data・設定は一切変更していない。PR作成なし、既存PRのmergeなし。
- **Audited main SHA:** `6abddc71f2b71fbd7a04844db390986d709f69e3`
  （`Merge pull request #318 … lc-r5-e-fresh-audit`、`git fetch origin main` で取得した最新）
- **Authority viewport:** 390×844（本監査は読み取り専用のため Preview / 動画は対象外。HV policy §2「docs-only は原則不要」）
- **証拠の種類を次の記号で分ける:**
  - 【実測】 一時テストを書いて実際に描画し、結果を観測した（実行後に削除済み。repoには残していない）
  - 【コード】 production code を読んだ結果
  - 【doc】 過去 docs / Issue / PR に記載がある
  - 【推定】 コードからの推論で、実測していない
- **「コードがそうなっている」と「仕様として意図されている」は §0.2 の表で明示的に分けた。**

---

## 0. 結論サマリ

### 0.1 一覧分類

| # | テーマ | 判定 | 一行要約 |
|---|---|---|---|
| A | 生地ガイドの1周/2周 | **CHANGE RECOMMENDED**（バグ寄り） | 内円は生地用ではなく**ソース用ガイド(`.sauce-target-guide`)が生地工程に漏れている**だけ。仕様上の根拠なし。判定・スコア・gateに無関係 |
| B-1 | 別ソース選択で旧ソースが消える | **KEEP（現状の挙動）/ 表現は CHANGE RECOMMENDED** | 実装は「1ピザ=1ソース、新ソースが旧ソースを置換」が明示仕様。ただし guided では別ソースを**選べない**ので、Owner が見た現象は FREE Cooking 固有 |
| B-2 | 「塗った後は別ソース選択で消えない」方針 | **OWNER DECISION REQUIRED** | 実現は容易。ただし multi-spread(TQ-3) との整合の取り方を先に決める必要がある |
| C-1 | cheese を「具材の1カテゴリー」に分類変更 | **CHANGE RECOMMENDED**（表示・棚のみ） | 棚(shelf)としては既にそうなっている。データ上の `category` 廃止は別問題で今は不要 |
| C-2 | 工程から CHEESE を消し INGREDIENTS に統合 | **OWNER DECISION REQUIRED** | hint / 判定 / 焼き見た目 / Large Catalog の4系統が `category==="cheese"` に依存。工程統合は分類変更より一段重い |
| D-1 | 焼きゲージの折り返し | **CHANGE RECOMMENDED** | 折り返しは**内部 position 自体**で起きている（visualだけではない）。しかもピザの焼き色も折り返しに追従して「生に戻る」 |
| D-2 | 一方向進行＋ガイドfade | **OWNER DECISION REQUIRED** | ガイドfadeは**既に実装済み**（3.6〜7.2秒、全モード共通）。残る論点は「時間→進行度の再設計」と初心者向け扱い |
| E-1 | 軌跡でなぞるCUT | **CHANGE RECOMMENDED（段階導入）** | 入力は軌跡、**採点幾何は直線近似のまま**が最小リスク。CUT-S2 の測定資産をほぼ再利用できる |
| E-2 | CUT の Undo 廃止 | **OWNER DECISION REQUIRED** | 「1本戻す」は設計doc §8.4 の明示仕様。廃止するなら誤操作・アクセシビリティの代替（確定前プレビュー等）を先に決める |
| 原則 | 「料理中の物理操作と時間は基本的に不可逆」 | **KEEP（候補原則として採用可）／運用は工程ごと** | 不可逆化自体を目的にしない。救済は別レイヤー |

### 0.2 「コードがそうなっている」vs「仕様として意図されている」

| 事項 | コード上の事実 | 意図された仕様か | 根拠 |
|---|---|---|---|
| 生地工程で円が1本(FREE Cooking) | `.dough-target-guide` のみ描画 | **Yes** | D1 Result 「DOUGH step shows a dashed ring at DOUGH_RADIUS」【doc】 |
| 生地工程で円が2本(recipe 指定のround) | `.dough-target-guide` + `.sauce-target-guide` | **No（実装の漏れ）** | sauce 円の gate に `makingStep` が無い。コメントは「player can actually paint」のときだけ出す意図【コード】 |
| 別ソース選択で旧ソース置換 | `isFreshApplication` で `sauceDeposits` を破棄 | **Yes（「1ピザ=1ソース」）** | `signature.ts` の `spreadLayers: "one sauce per pizza (a new sauce replaces the old)"`【コード】、P3-1 Result 同文【doc】 |
| guided で別ソースが選べない | tray が recipe の必須材料のみ表示 | **Yes（Issue #159 の明示仕様）** | #159 Result §2-1 / `IngredientTray.recommendedOther.test.tsx`【doc】【コード】 |
| 焼きゲージが右端で折り返す | `BakeOverlay` の ping-pong | **意図は記録されているが仕様として検討された痕跡は薄い** | M3A Fresh Audit は Guide fade のみ議論。折り返し自体の是非は見当たらない【doc】 |
| CUT が始点/終点の直線 | `buildRimToRimCutLine` | **Yes（設計doc §2.2）** | Cutting 1.0 設計doc の候補比較で採用【doc】 |
| CUT の Undo | `UNDO_CUT_LINE`（直近1本のみ） | **Yes（設計doc §8.4 で「推奨」）** | 「no-undo は『多少ズレても…』に反する」と明示的に却下されている【doc】 |

---

## 1. 前提（取得した事実）

### 1.1 main / open PR / 関連 Issue

- main = `6abddc71…`（2026-10-01 00:56 JST, PR #318 merge）。
- open PR（抜粋・本件に関係するもの）:
  - **#319** LC-R6-b Preview-only Hand activation（R6）
  - **#275** `claude/teto-pizza-cut-ux-audit-1fdxaw` — #256「bake 失敗時に CUT を skip」＋ Dinner UI Polish（`gameReducer.ts` / `completionGate.ts` / `DinnerGameUi.tsx` / `dinnerResultDetection.ts` / `dinnerView.ts` / `App.css` を変更する）
  - **#295** Post-W1 Cooking Steps design (CS-0, #294)
  - #296 172 Recipe Taxonomy / HCG、#293 Hint 5.0 taxonomy、他多数の docs PR
- **CUT-S2 branch = `claude/cut-scoring-audit-drh1e2`**（main 未merge・PR 無し。`5657019` "CUT-S2 Owner HV (#288): Preview-only CUT shadow page"）。本監査では `git show` / `git diff` による**読み取りのみ**。checkout・変更はしていない。
- 関連 Issue: #288(Scoring 3.0 CUT skill score)、#256(失敗ピザの CUT skip)、#294(Cooking Steps)、#176(Gameplay UX / Scoring 3.0)、#37/#33(Making Game / Dough)、#159(Cooking UI 1-Screen)、#270(Undo last placement)。
- 隔離遵守: R6 (#319) / CUT-S2 / Dinner #275 / Trial Notebook のどの branch にも変更を入れていない。本レポートは `claude/cooking-interaction-fresh-audit-18pfmn`（main 起点）のみ。

### 1.2 読んだ既存 docs

`docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md`、`TETO_PIZZA-CUTTING_1.0.md`、`docs/reports/TETO_ISSUE-33_DOUGH-D1_Result.md`、`…D3A_REVERSIBLE-DOUGH_Fresh-Audit.md`、`TETO_M3A_BAKE-JUDGMENT_Fresh-Audit.md`、`PIZZA_GAME_Phase4A-1B2_Sauce-Interaction-Parity_Result.md`、`TETO_ISSUE-159_COOKING-UI-1SCREEN_Result.md`、`TETO_INGREDIENT-CATEGORY-TABS_*`、CUT-S2 Result（branch上）、#295 の Next-Phase Design（branch上）、`TETO_HUMAN-VERIFICATION-POLICY.md`。

---

## 2. A. 生地ガイド（1周 / 2周）

### 2.1 Q1: 1本/2本を決めている production code

| 円 | 要素 | 描画条件（`src/components/PizzaStage.tsx`） | 半径 |
|---|---|---|---|
| 外円（破線） | `.dough-target-guide` | `isDoughStep && interactive` | `DOUGH_RADIUS` = 48 |
| 内円（破線） | `.sauce-target-guide` | `referenceModeEnabled && interactive` | `SAUCE_TARGET_RADIUS` = 40 |

- 2つの `<svg>` は**別の機能が別の条件で出している**。`.sauce-target-guide` 側の条件に **`makingStep` が含まれていない**。
- `referenceModeEnabled` は `App.tsx` で `referencePizza !== null && !isMissionActive`。`getReferencePizza(recipeId)` は現在 **25レシピ全て**に Reference があるため、**recipe 指定の非Lunch Rush round では常に true**。`free-cook` sentinel（`FREE_COOK_RECIPE_ID`）は `RECIPES` に無く `getReferencePizza` が null を返す → false。
- スタイルは両者同一（`stroke: rgba(107,66,38,.4)`, `stroke-width:1.1`, `stroke-dasharray:3 2.4`）。**見た目で区別できない**。

### 2.2 Q2: モード別の本数【実測】

一時テスト（`PizzaStage` を各条件で描画し `.dough-target-guide` / `.sauce-target-guide` を数えた。実行後に削除）:

| round | referenceModeEnabled | DOUGH | SAUCE | TOPPING |
|---|---|---|---|---|
| FREE Cooking（free-cook sentinel） | false | dough1 + sauce0 = **1本** | 0 | 0 |
| Guided（margherita / capricciosa / hawaiian 実測） | true | dough1 + sauce1 = **2本** | sauce1 | sauce1 |
| Lunch Rush | `!isMissionActive` で false | **1本**【コード・未実測】 | — | — |
| Dinner | 当初「recipe に Reference があれば2本」と**推定**していたが、Dinner slice の実測（下記 §15）で **recipe-free round のため sauce guide は出ない = 1本**と判明（この行は訂正済み） | **1本**【実測: Dough Guide Leak Fix e2e】 | — | — |

**追加発見（Owner 報告外）:** guided では SAUCE だけでなく **CHEESE / TOPPING / CUT でも sauce 円が出続ける**（実測: margherita TOPPING で sauce=1）。`interactive` は PREPARE 全体と CUT で true になるため。Owner が見た「生地で2本」は氷山の一角。

### 2.3 Q3/Q4/Q5/Q6: 内円・外円の意味と判定との連動

| 円 | 意味 | dough 判定との連動 |
|---|---|---|
| 外円 r=48 | 「ここまで伸ばそう」の**理想サイズ**。`DOUGH_COMPLETION_THRESHOLD`(0.75)は `mean(radii)/DOUGH_RADIUS` で測る = 外円基準 | **間接連動**: CTA(次へ)の解除条件が外円基準。ただし外円に届く必要はなく、平均半径が 0.75×48=36 に達すれば解除 |
| 内円 r=40 | **ソース塗りの目標範囲**（`edgeAmount/edgeRatio` の基準半径）。生地とは無関係 | **連動なし** |
| 2本の間 (40〜48) | 「合格範囲」ではない。どの判定にも使われていない | — |

- 生地工程に**「合格範囲」は存在しない**。生地は size-only gate（平均半径≥0.75）のみで、形の良し悪しは見ない（`doughShape.ts` のコメント "deliberately does not evaluate roundness/evenness/symmetry"）。
- D3A で `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS`=58 まで伸ばせるので、外円は hard stop ですらなく「目安」。

### 2.4 Q7: dough score / recipe validation / completion gate への影響

- **dough score は存在しない。** `grep` の結果、`doughShape` を読む scoring は無い（`signature.ts` は `shape: UNAVAILABLE, reason: "doughShape radii exist but no shape classification rule"`）。
- Completion Gate（`completionGate.ts`）は生地を見ない（sauce 量・材料数・bake のみ）。
- 生地形状が影響するのは **(a) DOUGH の CTA 解除、(b) ソース描画の境界（`isInsideDoughShape`）、(c) CUT geometry の silhouette 参照**のみ。いずれも円の本数とは無関係。
- → **内円の有無は判定・スコア・gate に一切影響しない。純粋に視覚。**

### 2.5 Q8/Q9: FREEだけ1本である仕様上の根拠はあるか

- **無い。** 1本になるのは `free-cook` に Reference が無いという**副作用**。
- 経緯【doc/コード】: sauce 円は Human Feel Fix 2（Phase 4A-1B, 当時は Margherita 限定 Reference）で追加され、コメントは「player can actually paint (referenceModeEnabled + interactive), never during BAKE/RESULT」。その後 Issue #33 D1 が DOUGH 工程を**追加**し、同時に「tray / SauceMetricsPanel を DOUGH で隠す」対応はしたが（D1 Result §受入表）、この円の gate は更新されなかった。`PizzaStage.doughStretch.test.tsx` は `referenceModeEnabled={false}` 固定で、2本目を検出するテストが存在しない。
- Reference が25レシピに拡大（B2 / W1）した結果、当初は Margherita だけだった「漏れ」が**ほぼ全 guided round に拡大**した。
- 表示文言「生地を伸ばしたり縮めたりして形を整えよう」（`hints.ts` `DOUGH_HINT`）は両モード共通で、2本目を説明していない。

### 2.6 評価: 2本で意味が伝わるか

**伝わらない。** 同一スタイルの破線が2本あると、ユーザーは自然に「内外の間が合格帯」と解釈する（Owner もその前提で質問している）。実際は内円=ソース用で生地に無関係。仮に「2本が許容範囲」という仕様にするなら、帯の塗り分け・ラベル・判定への実連動が必要だが、現状の dough 判定は帯を持たない。

### 2.7 推奨

- **CHANGE RECOMMENDED（小・低リスク）:** `.sauce-target-guide` の条件に `makingStep === "SAUCE"` を追加（生地・チーズ・具材・CUT での漏れを止める）。または表示をSAUCE工程限定にする。これで guided の DOUGH も1本になり FREE と一致する。
- 回帰面: `PizzaStage.tsx` の1条件、`sauceParity`/`doughStretch` テストへ「DOUGH で sauce 円が出ない」を追加、既存 Sauce HV 動画の「円が見える」前提の確認（SAUCE 工程では従来どおり出る）。**UI変更なので HV policy 適用**（390×844動画＋before/after screenshot）。
- 生地に本当に「合格帯」を持たせたいなら別設計（Owner Decision）。現状の size-only gate を変えない限り不要。

---

## 3. B. ソース

### 3.1 Q1〜Q3: state machine と別ソース選択時の挙動【コード】

- 状態: `pizza.sauceIds: string[]`（実質長さ≤1）、`pizza.sauceDeposits: SauceDeposit[]`、`sauceOrigin`、`sauceToken`。
- 入力経路は2つ: 旧 `APPLY_SAUCE`（one-shot）と `COMMIT_SAUCE_DISPENSE`（ホールド&ドラッグで1ジェスチャ分の deposits を atomic commit）。
- **`COMMIT_SAUCE_DISPENSE`**: `isFreshApplication = state.pizza.sauceIds[0] !== action.ingredientId`。
  - 同じソース → deposits を**追記**（重ね塗り）
  - 別のソース → `sauceDeposits` を**全破棄**して新ソースで置換、`sauceToken` をインクリメント
- `APPLY_SAUCE` は常に全置換。
- `RESET_PIZZA`（「やり直す」）は PREPARE 全体を戻す。ソース単独リセットは無い。

### 3.2 Q2: PAINT_TEMPORARY / commit / reset の契約【コード】

- `PAINT` / `PAINT_TEMPORARY` は `recipeSauceProfiles.ts` の**型と値だけ**。`grep` の結果、`.interaction` を読む production code は**存在しない**（型定義のみ）。どちらも同じ dispenser / heatmap パイプラインを通る。
- Phase 4A-1B2 Result: olive oil は「将来 DRIZZLE にする候補」の印として `PAINT_TEMPORARY`。**reset 契約を持つわけではない**。
- commit 契約: ジェスチャは PizzaStage が ref にバッファし、pointerup 成功時に1回だけ dispatch（中断・cancel・step切替・resetToken 変更では破棄）。reducer は `phase==="PREPARE" && makingStep==="SAUCE"` を独立に再検査。

### 3.3 Q4/Q5: 明示仕様か実装都合か、モード差

| round | 別ソースを選べるか | 結果 |
|---|---|---|
| guided / Dinner / Lunch Rush | **選べない**（tray が recipe の必須材料のみ。#159 の「recipe-lock」が明示仕様） | 置換は起きない |
| FREE Cooking | 選べる（tray が owned 全件） | 置換される（旧 deposits 破棄） |

- 「置換」自体は**明示仕様**: `signature.ts` の `spreadLayers: FIXED_BY_FLOW "one sauce per pizza (a new sauce replaces the old)"`。matcher / Trial Notebook の fingerprint も「1ソース」前提。
- ただし「選んだ瞬間には消えず、**次に塗った瞬間**に消える」点は実装（`isFreshApplication`）の帰結で、UI が警告していない。Owner が「取り消されて置き換わるように見える」のはこの挙動。
- #159 Result は「ソース確定後の別ソース変更/重ね塗り不可」を**受入条件**として記録しているが、FREE Cooking（Phase 3-2, #194）はその後に追加され、recipe-lock が効かない経路になった。**#159 の意図と FREE Cooking の挙動が食い違っている**可能性がある（意図の再確認は Owner Decision）。

### 3.4 Q6: matcher/scoring は最終的に何を見るか

- **matcher（discovery signature）:** `sauceIds` の sorted-unique 集合のみ。deposit の位置・量は見ない。
- **Scoring 2.0:** `pizza.sauceDeposits`（`computeSauceMetrics`）と `sauceIds` 由来の ingredient 一致。置換は「最終状態」だけが評価され、過去に塗ったソースは**痕跡ゼロ**。
- **Completion Gate:** `checkSauceQuantity`（量・被覆の下限）。
- → 評価は「最後に確定したソースの最終 deposits」のみ。**操作履歴は残らない。**

### 3.5 Q7: multi-spread / late addition との競合

- Cooking Steps 設計（#294/#295）は multi-spread を **Techniques TQ-3**（OD-TQ-2 approved）と位置づけ、クラス分類で MAJOR 14 行・`MULTI_SAUCE` modifier。必要なのは「2層 sauce モデル＋ drizzle gesture＋ score＋ Hint SAUCE rung」。
- 現行の `sauceIds` 長さ≤1 / `spreadLayers FIXED_BY_FLOW` / fingerprint / inventory（`sauceIds[0]` 前提の消費）/ Hint rung は**全て1ソース前提**。
- 候補方針を今入れても、TQ-3 が来たとき **データ形状（`sauceIds` 複数化・layer 順序・deposit にソース ID を持たせる）を再設計**することになる。

### 3.6 候補方針の評価

| 方針 | 可否 | 評価 |
|---|---|---|
| 塗る前なら変更可能 | 容易 | 現状でも選択だけなら state 不変（`sauceIds` は commit まで変わらない）。実質すでにそう |
| 塗った後は、別ソース選択だけでは消えない | 容易 | `isFreshApplication` で置換する代わりに、「別ソース選択時は選択 UI を無効化／確認」または「塗り済みなら別ソースの commit を拒否」のいずれか |
| 明示的な「やり直す」でソース工程をリセット | **中** | 現状の「やり直す」は `RESET_PIZZA`（PREPARE 全体）。**ソース工程単独のリセット action は未実装**（DOUGH 進行・step token・CookingTiming の reset policy と整合を取る必要あり。CT2 に RESET policy 記述あり） |
| 将来 multi-spread で複数ソースを実際に扱う | 将来 | TQ-3 の設計対象。今の `sauceIds` を配列のまま許容する形にしておけば拡張余地は残るが、今回は実装しない |

**評価:** 「不可逆」と「置換」の二択ではなく、FREE Cooking の選択肢を**塗り始めた時点でロック**し、解除は明示的リセット経由にするのが最小変更。multi-spread を入れる際は「ロック解除の条件」を recipe 側（Cooking Steps）が宣言する形にすれば競合しない。

### 3.7 分類

- 現行「置換」挙動: **KEEP**（仕様として整合。matcher/fingerprint/在庫が依存）
- FREE Cooking の「塗った後の別ソース選択」の挙動: **OWNER DECISION REQUIRED**（ロックするか／確認を出すか／現状維持か。#159 の意図との整合が論点）
- ソース単独リセット: **OWNER DECISION REQUIRED**

---

## 4. C. チーズ / 具材

### 4.1 現状の分類と工程

- `IngredientCategory = "sauce" | "cheese" | "topping"`（`ingredients.ts`）。
- 工程は `deriveCoreSteps`（`cookingProfiles.ts`）が recipe の `requiredIngredients` の category から**動的に**決定: `DOUGH`（常に）→ `SAUCE`（sauce があれば）→ `CHEESE`（cheese があれば）→ `TOPPING`（topping があれば）。**cheese なし recipe は既に CHEESE 工程を持たない**（marinara / fugazza / pizza-bianca 等）。FREE Cooking は `DEFAULT_COOKING_PROFILE`（4工程固定・CUT無し）。
- **重要:** cheese も topping も `placement: "scatter"` で、同じ `PLACE_TOPPING` action・同じ pieces 採点経路（ingredient ID 単位の group）を通る。**物理操作としての差は無い。**

### 4.2 Q1〜Q7: cheese が独立していることへの依存

| # | 依存先 | 内容 | 根拠 |
|---|---|---|---|
| 1 | production 上の理由 | 「レイヤー順（sauce→cheese→topping）を reducer が強制」と「cheese を先に置く／トッピングを先に置くの混在防止」。それ以外に**物理的必然性はない** | `gameReducer.ts` PLACE_TOPPING が `category==="cheese" && makingStep!=="CHEESE"` を拒否。`signature.ts` `layerOrder: FIXED_BY_FLOW "DOUGH -> SAUCE -> CHEESE -> TOPPING"` |
| 2 | recipe matcher | signature は `ingredientSet`（ID の集合）と `layerOrder` を見る。**cheese という分類そのものは見ない**（順序は FIXED_BY_FLOW で観測不能扱い） | `signature.ts` |
| 3 | scoring | Scoring 2.0 pieces は ingredient ID 単位の group で cheese 特別扱いなし。焼き見た目のみ差（下記） | `piecesComponent.ts` |
| 4 | Hint | Hint 5.0 の固定 rung が `SAUCE → CHEESE → KEY_TOPPING → STRUCTURE`（`inCategory("cheese")`）。`HINT_CATEGORIES`（selectable/deduction）も sauce/cheese/topping の3値。**cheese を分類から外すと Hint 5.0 の rung 定義・価格・「チーズ：なし」の empty-rung 表現（OD-H5-P4-CHEESE）・Trial Notebook の h5 key（`h5:cheese`）が影響を受ける** | `hint5Ladder.ts`, `selectableHint.ts`, `deductionGuard.ts` |
| 5 | Large Catalog / shelf | `ingredientShelf.ts` は**既に** `sauce, cheese, meat, seafood, vegetable, fruit, herb, spice, other` の棚を持つ（cheese は category 由来、topping は DH4-1 family 由来）。`catalogTypes.ts` の `CatalogCategory = sauce|cheese|topping`、`handSession` の3カテゴリ、R6 の Hand 有効化が同じ3値を前提 | `ingredientShelf.ts`, `catalog/handSession.ts`（#319 が進行中） |
| 6 | Cooking Steps | `deriveCoreSteps` と `MakingStepTabs`（≤6タブ不変条件, OD-CS-9）、`prepareDock.ts`（`CHEESE:"cheese"`）、`makingStepToCategory`。#295 は「step order (cheese→sauce) は `layerOrder` 軸」として **工程順は recipe 宣言にする**方向 | #295 design §（step order 行） |
| 7 | 将来レシピ | cheese なし: 既に動的に対応済み。複数 cheese: 既に可（scatter の複数種）。**late cheese（焼き後に足す）・cheese を先に置く順序違い**は現行の固定順では不可 → Cooking Steps の `applicationPhase` / step order modifier（#294 CS-5 / CS-2 FINISH）の領域 | Cooking Steps 1.0 §12, #295 |

- 焼き見た目: `cheeseVisualFrame` と `toppingVisualFrame` が別関数で `category==="cheese"` で分岐（`PizzaStage.tsx`, `IngredientPieceVisual.tsx`, `PizzaThumbnail.tsx`, `InventoryOverlay.tsx`）。**溶ける表現は cheese の専用描画**で、具材カテゴリに統合するなら「溶けるか」を別フラグ（ingredient の描画特性）に切り出す必要がある。

### 4.3 評価: 「分類変更」と「工程変更」は別問題

| 変更 | 内容 | 影響範囲 | 判定 |
|---|---|---|---|
| **(1) 棚の分類変更（表示）** | ユーザー向けの棚/タブで cheese を ingredients の1棚として扱う | 既に `ingredientShelf.ts` が実質そうなっている。sauce=別枠・他=棚、の表示はUIだけの話 | **CHANGE RECOMMENDED** |
| **(2) データ分類変更** | `IngredientCategory` から `cheese` を廃し `ingredients` にする | `ingredients.ts` 全件、hint5 rung、selectable/deduction、Hand、tests 多数。**価値に対しコスト大。(1) で目的は達成できる** | **KEEP（今は触らない）** |
| **(3) 工程変更** | `DOUGH→SAUCE→INGREDIENTS→BAKE→CUT` に統合し CHEESE 工程を廃止 | `MakingStepTabs`、`deriveCoreSteps`、reducer の category×step ガード、`prepareDock`、CookingTiming の step 配分、Hint 文言（`hints.ts`）、DOUGH/CHEESE を含む多数のテスト。**順序を自由にする代わりに `layerOrder` の FIXED_BY_FLOW が崩れる**（matcher が順序を観測可能にするか、固定のまま保つか要決定） | **OWNER DECISION REQUIRED** |

- 推奨モデル: **材料分類は `sauce` / `ingredients`（棚で cheese, meat, …）、データ上の `category` はまず不変、工程は現行4工程を維持しつつ、recipe ごとに「cheese を置くタイミング」を Cooking Steps の step order 宣言で指定可能にする**。つまり (1) を先行し、(3) は Cooking Steps の step order / late addition と同じ仕組みで解く。

### 4.4 「レシピ指定でチーズのタイミングを変える」の位置づけ

- #295 の分類では step order（cheese → sauce）は **layerOrder 軸**で、TQ 系 Technique との関係は OD-CS の対象。今回単独で先行実装すると Cooking Steps と競合する。**Cooking Steps の設計に含めるのが安全。**

---

## 5. D. BAKE

### 5.1 Q1/Q2: ゲージは本当に折り返すか／内部 progress も折り返すか【コード】

`src/components/BakeOverlay.tsx`:

```
const SPEED = 55; // percent per second
next = position + direction * SPEED * dt
if (next >= 100) { next = 100; direction = -1 }
else if (next <= 0) { next = 0; direction = 1 }
positionRef.current = next; setPosition(next); onTick(next)
```

- **折り返している。しかも visual のみではなく内部 `position` 自体が ping-pong する。** 「取り出す！」は `onConfirm(positionRef.current)` で**その瞬間の position を採点値**として渡す。
- 1往復は約 3.6 秒（片道約 1.8 秒）。
- `onTick` → `App.tsx` の `liveBake` → `PizzaStage.bakeProgress` → `computeBakeHeat(progress, target)`（連続関数）。**ピザの焼き色（生地色・チーズ・焦げ）も position に追従して上下する**＝「焦げたピザが戻りの途中で生に戻る」。これはゲームとして不自然（Owner 提案の動機と一致）。

### 5.2 Q3〜Q8: 判定・score・gate・モード差・CUT

- **判定:** `classifyBake(value, bakeTarget)` = `value < start` raw / `> end` burnt / else perfect。
- **score:** `scoreBakeComponentV2` は target 帯との最近接 edge 距離を `distance/center` で連続評価（raw 側・burnt 側対称）。採点値は tap 時の position。
- **Completion Gate:** `checkBake` は `margin = (end-start)*0.5`。`< start-margin` → UNDERBAKED、`> end+margin` → OVERBAKED で FAILED。
- **モード差:** `BakeOverlay` は `mode` 引数を持たず**全モード同一**（SPEED・fade 曲線・CTA）。recipe 別は `bakeTarget` のみ（FREE Cooking は全 recipe の中央値から作った generic window `FREE_COOK_BAKE_TARGET`）。FREE Cooking は CONFIRM_BAKE 時に matcher が recipe を確定し、その recipe の window で判定。
- **A/B/C/D 焼き判定:** 現行コードに A/B/C/D という区分は見当たらなかった（4段階はなく raw/perfect/burnt の3値＋連続 score＋gate の2段 margin）。Owner の言う A–D が別の docs/UI 名称なら要確認（本監査では `classifyBake` 3値 + gate 2値として扱った）。
- **CUT skip との関係:** main では bake 失敗ピザでも CUT に進む（#256 open）。**PR #275 が「Completion Gate FAILED なら CUT skip」を `gameReducer.ts` / `completionGate.ts` に入れる**。焼きを一方向 progress にしても gate の2値（UNDER/OVER）は維持できるが、`completionGate.ts` は #275 と同じファイルを触るため**実装順序で衝突**する。

### 5.3 既に実装済みのガイドfade（Owner 提案との関係）

- M3A Bake Judgment Phase 1: `bakeGuideFade.ts`。**経過時間 3.6s まで opacity 1 → 7.2s で 0**。ゲージ（zone・needle 色）・キャプション（状態を示す文言）・CTA の glow が同時にfade。完全に消えた後は中立文言「見た目で焼き加減を確かめて！」。
- 設計上の重要原則（M3A Audit §3）: **ガイド（hint）と採点 authority を分離**、fade timing を target 接近の手がかりにしない。M3A は「ピザの見た目で判断」という Owner 案の**前半はすでに実装済み**。
- ただし同 audit は「ピザの焼き色が scoring 境界で snap して答えが漏れる」問題を `computeBakeHeat`（連続・境界に継ぎ目なし）で解決済み。**ping-pong による「戻り」は想定外のまま残っている**。

### 5.4 Q9: 一方向 progress に変えた場合の影響範囲

| 面 | 影響 |
|---|---|
| `BakeOverlay`（SPEED・折り返し） | 折り返し削除、右端 clamp。**SPEED の再設計が必須**: 現 55%/s は 100 に 1.8s で到達する。一方向なら 6〜12秒かけて 0→100 となる速度（≈8–16%/s）に落とさないと「止める」難度が跳ね上がる |
| bakeTarget（recipe 15→25+ 件の window 幅） | 時間窓 = 幅 ÷ SPEED。**windowが狭い recipe は現在より狭い時間窓**になる。再 Human Feel が必須 |
| 採点 | `scoreBakeComponentV2` / `checkBake` は position→値の写像が同じなら**不変**でよい（値域 0–100 を維持）。「焦げたら回復しない」は position 単調性で自然に満たされる |
| visual | `computeBakeHeat` は単調関数なので不変。**「戻りで生に戻る」が解消する**（副作用として改善） |
| 最悪値 | 右端 clamp で 100 に張り付く＝ OVERBAKED gate に直結。**放置（tap しない）ペナルティが生まれる**ため、Lunch Rush/Dinner の時間設計・`cookingTiming`（CT1: BAKE は計測対象外）との関係を再確認する必要あり（未確認） |
| guide fade | 「初心者は長く表示」を入れるなら fade 終了時間を mode/進行度(onboarding)で可変に。現在は定数 `GUIDE_FADE_START_S/END_S`。`BakeOverlay` に prop を追加する形で局所的 |
| Dinner | #294 の指摘どおり Dinner は identity を START_BAKE で解決する。焼き中に見せる情報を変える場合は identity 漏れの再監査が必要 |
| tests | `BakeOverlay.test.tsx`, `bakeGuideFade.test.ts`, `bakeVisual.test.ts`, `PizzaStage.bakeVisual.test.tsx`, e2e の bake 系（ping-pong 前提の待ち合わせ） |

### 5.5 評価と推奨

- **候補「bake progress は単調増加／右端 clamp／焦げは回復しない」:** **CHANGE RECOMMENDED**。内部 position 自体が折り返している以上、見た目だけの修正は意味がなく、position を単調化するのが根本。採点写像が変わらないので scoring/gate への波及は小さい。
- **候補「guide 表示を途中で fade/hide／判定 authority と visual guide を分離」:** 分離原則は**既に実装済み（KEEP）**。残るのは fade 時間の可変化のみ。
- **初心者/onboarding:** guide を長く見せる案は有効。ただし**難易度設計（SPEED×窓幅）と一体**で決める必要があり、ここは **OWNER DECISION REQUIRED**（onboarding 判定条件、何回目から fade するか、Lunch Rush での扱い）。
- 新方式の HV 要否: **必須**（SPEED と窓幅は人間の操作感そのもの）。

---

## 6. E. CUT

### 6.1 Q1〜Q4: 現行処理【コード】

- **pointer → line:** `PizzaStage` の CUT mode で pointerdown の `startDough` を記録 → drag 中は `updateCutPreviewLine(start, current)` が**プレビュー線**を更新 → pointerup で `buildRimToRimCutLine(startDough, releaseDough)` を1本確定し `onAddCutLine`（`PizzaStage.tsx` ≈ L360 / L815）。
- **straight line にしている箇所:** `buildRimToRimCutLine`（`logic/cut/types.ts`）が始点→終点の方向を円の両側 rim まで**延長**して全長弦に正規化。`isEdgeToEdgeCutLine` が「両端が rim 上」であることを reducer `ADD_CUT_LINE` の契約にしている（`RIM_TOLERANCE 1e-6`）。**つまり軌跡は最初から捨て、2点だけを使っている。**
- **Undo:** `UNDO_CUT_LINE`（reducer）→ `undoLastCutLine`（`cut/state.ts`）が**直近1本のみ削除**し `evaluation` を null に戻す。UI は GameScreen の「1本戻す」。**設計doc §8.4 が authority**（「unlimited undo / no-undo の両案を却下し last-cut-only を推奨」。no-undo は「多少ズレても…」に反すると明記）。
- **line cap:** `requiredCutCount(n) = n/2`、上限 `= required + 2`。**gesture 層（`PizzaStage.tsx` `cutLimit`）と reducer の2箇所で二重に強制**。さらに `isDuplicateCutLine`（角度 mod π の近接拒否）も UI・reducer の二重。

### 6.2 Q5/Q6: 6等分前提と 4/6/8 拡張性

- `RequestedSliceCount = 4 | 6 | 8` は型として存在し、`resolveRequestedSliceCount` が唯一の解決点。**全 recipe が `STANDARD_CUT_CONFIG = {6}`**（`COOKING_PROFILE_OVERRIDES` は空）。geometry / evaluation は slice 数を一般化して実装済み（コメント上 "4/8 は pure data で追加可・engine 変更不要"）。
- **暗黙前提:** `requiredCutCount = slices / 2`＝「**全ての線が中心を通る直径**」を前提に線数を決めている。任意弦・折れ線の軌跡にすると「何本で何ピース」の関係が崩れる。`isEdgeToEdgeCutLine` も rim-to-rim 弦前提。

### 6.3 Q7: CUT-S1/S2 CutQuality への影響（branch `claude/cut-scoring-audit-drh1e2`、読み取りのみ）

CutQuality（S1, `logic/cut/quality.ts`）は `lines: CutLine[]`（始点・終点の2点）から `lineValidity / sliceCountFit / centerAccuracy / sliceUniformity` を計算する pure evaluator。**入力が2点の直線である限り、軌跡入力でも「確定 geometry を直線に落とせば」完全に再利用できる**。

**再利用できる測定結果（新方式でもそのまま有効）:**

| 資産 | 理由 |
|---|---|
| CutQuality の式・weights・tolerance（S1）と mutation 結果 | 入力が同じ `CutLine[]` |
| 分布・感度（centre 飽和、uniformity が唯一の感度）、sliver の扱い（68–70% が sliver → 無視は必要）| **確定 geometry の性質**であり入力手段に依存しない |
| `completeness` 固定20%問題の解消 | 評価式側の話 |
| 「ideal と natural が区別できない（dead zone）」の論点 | 評価式側の話 |

**再 HV / 再測定が必要な部分:**

| 項目 | 理由 |
|---|---|
| **operator model（`cutOperatorModel.ts`）** | S2 は「press/release の aim error σ=6px」という**2点入力のノイズモデル**。軌跡入力では誤差源が変わる（始点精度は重要でなくなり、軌跡の直線性・終点が rim に届くか・斜め崩れが主） |
| **real aim sigma（S2 で未測定の最大の未知数）** | S2 Result 自身が「実機で測っていない」と明記。**新方式なら実機 HV を最初から軌跡で取り直す方が効率的**。uniformity zero 0.6/0.4 の最終判断もここに依存 |
| 実 pointer の e2e（`cut-quality-shadow-s2.spec.ts`, `cut-hv-preview.spec.ts`, Preview の `?cuthv=1`） | 入力操作が変わるため再撮影。ただし**仕組み（Preview-only shadow page・隔離 gate）は流用可能** |
| 360×800 の「同じ指で dough-percent ノイズが約9%増」 | 軌跡入力での再確認 |

→ **CUT-S2 は捨てない。推奨は S2 を「評価式の確定」として完了させ、軌跡入力は「入力層の差し替え（S2 入力アダプタ）」として別 slice にする**。

### 6.4 Q8/Q9: 軌跡を保持する場合のデータ量と、軌跡そのものを採点するか

- **データ量:** 1本あたり pointermove を距離間引き（例: ≥2% dough 単位）で保存して概ね 20〜40点。最大 `required+2`=5 本で **約100〜200点 ≈ 数KB**。`cutState` は**非永続・transient**（`PersistentSaveV2` に含まれない）で save/migration 影響なし。軌跡を **描画用途のみ**に保持し、採点には渡さない設計ならさらに不要（確定時に捨ててよい）。
- **採点に軌跡が必要か:** **不要**（最終の切断 geometry で十分）。理由: (a) CutQuality が見る4信号は全て「線→ピース分割」の幾何、(b) S2 の知見で評価の差は uniformity が担い、(c) 軌跡の「揺れ」を採点すると fingertip noise をペナルティ化して unfair になりうる（S2 finding 5: dead zone が意図）。
- **採点 geometry の取り方（推奨）:** 軌跡 → **全長弦に近似**（最小二乗直線を rim まで延長、または始点・終点を結ぶ）。こうすれば `CutLine`・`isEdgeToEdgeCutLine`・`evaluateCut`・CutQuality・`requiredCutCount` を**無変更**で使える。見た目は手でなぞった軌跡、採点は近似直線。
- **軌跡を真にそのまま切断線にする**（ピザ上に曲線の溝が残る）場合は、ピース領域の算出が「弦アレンジメント」から「平面分割（ポリライン同士の交差・閉領域の面積）」に変わり、`geometry.ts`/`evaluation.ts` の書き換え＋ slice 数の定義（何本で何等分か）の再設計が必要。**別 slice / 大きな Owner Decision。**

### 6.5 Q10: Undo 廃止の誤操作/アクセシビリティ影響

| 観点 | 影響 |
|---|---|
| 誤操作 | 現状は Undo＋`requiredCutCount+2` の余裕（誤った1本を消して引き直す）で吸収。Undo 無しだと、誤った線は永続し **CUT 全体が「やり直し不可」に**。誤タップ（意図せぬ短い drag）は現状「drag 閾値未満は破棄」「近接重複は拒否」で一部防げているが、誤った**角度**は防げない |
| 上限 | `required+2` は Undo 前提のスラック。Undo 廃止なら「線の数の上限」と「失敗の扱い」を再設計（超過分の拒否、または超過を許して採点で吸収） |
| アクセシビリティ | 運動制御に困難があるユーザー、画面が小さい360×800で不利。設計doc §8.4 の却下理由（「多少のズレ」許容と整合しない）が再燃 |
| 代替案 | (a) **確定前プレビュー**: 指を離した時点で確定せず「切る／やめる」2択を出す（不可逆性を保ちつつ誤操作救済）、(b) 「CUT 全体をやり直す」（= 全線クリアして最初から。料理的には不自然だが救済レイヤーとして妥当）、(c) 初心者/アクセシビリティ設定時のみ Undo を許可（救済を別レイヤーに） |
| CUT-S4（final score）との関係 | Undo 有無は「最終線の質」を変える。採点前提（回数制限・やり直しコスト）を Owner が決める必要 |

### 6.6 評価と推奨

- 軌跡入力: **CHANGE RECOMMENDED**（入力＝軌跡、採点＝近似弦、の段階導入）。感覚的価値が高く、S1/S2 資産を温存できる。
- Undo 廃止: **OWNER DECISION REQUIRED**。「不可逆」の料理的自然さと、誤操作救済の設計はトレードオフ。**「確定前プレビュー（離す→確定ボタン or 取り消し）」が一番小さい折衷**。
- 大前提: 軌跡を**真の切断線**にする（曲線 CUT）は別テーマとして分離し、今回は扱わない。

---

## 7. 共通設計原則の評価

> 「料理中の物理操作と時間は基本的に不可逆」

| 工程 | 現状 | 不可逆にしたとき面白くなるか | 救済レイヤー案 |
|---|---|---|---|
| 生地 | **D3A で明示的に可逆**（伸ばす・縮める） | 生地は現状の可逆が「形を整える」遊びの核。**不可逆化は不適合** | — |
| ソース | 塗り足し可能・別ソースで置換 | 「塗ったら戻せない」は魅力的だが、薄塗り失敗の救済が要る | 「やり直す」(工程単独リセット) |
| 具材配置 | 配置は PLACE 単位（Undo は #270 で別 Issue 化済み） | 面白さの中心は位置決め。配置の取り消しは既に別途検討中 | LC-X Undo（#270） |
| 焼き | ping-pong で**何度でも戻る** | **一方向化は強く合う**（時間不可逆＝焼きの本質） | guide 延長（初心者） |
| 切る | Undo 1本 | 「切ったら戻せない」は料理として自然。ただし誤操作が重い | 確定前プレビュー／初心者のみ Undo |

**結論:** 原則自体は採用可（KEEP）。ただし「不可逆そのもの」を目的にせず、工程ごとに面白さを判断する。**焼きは一方向化の効果が最大、生地は不可逆化が逆効果、ソース・切る・具材は「不可逆＋救済レイヤー」の設計が必要。** 救済（誤操作・アクセシビリティ・初心者）は工程ロジックではなく別レイヤー（例: `assist` 設定）として持つのが、Cooking Steps / Techniques との整合も取りやすい。

---

## 8. 依存関係と regression surface

### 8.1 テーマ間の依存

```
A (円の漏れ)          : 独立。PizzaStage 1条件。他テーマに依存しない。
B (ソース)           ──▶ C (分類/工程) と Cooking Steps(multi-spread, TQ-3) に依存
C (cheese 分類/工程)  ──▶ Hint 5.0 / Large Catalog(R6 #319) / Cooking Steps(step order)
D (BAKE 一方向)      ──▶ completionGate(#275) / Dinner(identity@START_BAKE) / Lunch Rush time
E (CUT 軌跡/Undo)    ──▶ CUT-S1/S2/S4(#288) / completionGate & CUT skip(#275) / Cooking Steps(CS-5 FINISH→CUT)
```

### 8.2 変更別 regression surface

| 変更 | 触るファイル（予想） | 主な回帰 |
|---|---|---|
| A: sauce 円の gate | `PizzaStage.tsx`、テスト追加 | sauce 円が SAUCE で従来どおり出る／DOUGH・CHEESE・TOPPING・CUT で出ない |
| B: ソースロック | `gameReducer.ts`(COMMIT_SAUCE_DISPENSE)、`IngredientTray`、`PizzaStage`、reset 系 | `sauceToken` / 在庫 gate(`isFreshApplication`) / Trial Notebook fingerprint / Hint |
| C(1): 棚表示 | `IngredientPantry` / Shelf chips（R6 と競合） | Large Catalog 全体（#319 進行中） |
| C(3): 工程統合 | `cookingProfiles`, `gameReducer`, `MakingStepTabs`, `prepareDock`, `hints`, Hint 5.0 | 多数・Cooking Steps と同時設計が望ましい |
| D: 一方向 bake | `BakeOverlay`, `bakeGuideFade`, e2e bake 待機, Lunch Rush/Dinner 時間 | SPEED×窓幅、OVERBAKED gate、Dinner identity |
| E: 軌跡入力 | `PizzaStage` CUT gesture, `cut/types.ts`（近似関数追加）, preview 線 | `PizzaStage.cutGesture.test.tsx`, e2e cut, CUT-S2 harness |
| E: Undo 廃止 | `gameReducer`(UNDO_CUT_LINE), `GameScreen`, `cut/state.ts`, cap(`required+2`) | cut 系 tests、アクセシビリティ |

---

## 9. 進行中ワークとの競合

| 進行中 | 競合/依存 | 扱い |
|---|---|---|
| **R6 / #319**（Hand activation, `catalog/handSession`, Preview-only） | C の分類変更・棚表示は同じ `CatalogCategory = sauce/cheese/topping` と Hand に触る | **C は R6 が main に入るまで着手しない**。C(1)の棚表示は R6 後 |
| **CUT-S2 branch**（`claude/cut-scoring-audit-drh1e2`） | E の軌跡入力は S2 の operator model / e2e / Preview page を再利用したい | **S2 を先に完了**（評価式の確定）。入力アダプタは S2 merge 後の別 slice。S2 の結論は捨てない（§6.3） |
| **PR #275**（CUT skip＋Dinner UI） | D(gate) / E(CUT 工程終了条件)が `gameReducer.ts` / `completionGate.ts` を共有 | **#275 merge 後**に D/E 実装。#275 本体へは入れない |
| **Trial Notebook**（`p3-*`） | B のソース単位リセット・C の分類で fingerprint（`sauceIds`/ingredient 集合）が変わる可能性 | B/C 実装前に fingerprint 影響を再監査 |
| **Cooking Steps (#294/#295)** | B(multi-spread)・C(step order / late cheese)・E(FINISH→CUT) は CS の設計対象 | B/C(3) は **Cooking Steps 設計に合流**。先行実装しない |

---

## 10. 推奨実装順序

1. **A: 円の漏れ修正**（独立・小・リスク低）。#275 / R6 / S2 と干渉しない（`PizzaStage.tsx` の1条件）。HV 必須。
2. **D の設計確定（Owner Decision 後）** → #275 merge を待って実装。SPEED/窓幅の Human Feel を含む。
3. **E-1: CUT-S2 を「評価式確定」で完了**（実機 aim sigma 取得。可能なら軌跡入力プロトタイプを同じ HV に載せる）。
4. **E-2: 軌跡入力（近似弦）＋ Undo 方針**（S2 merge 後）。
5. **B: ソースロック／単独リセット**（FREE Cooking の挙動決定後）。multi-spread は実装しない。
6. **C(1): 棚表示**（R6 merge 後）。**C(3) 工程統合**は Cooking Steps 設計に合流。

> 各ステップは独立に revert 可能な slice にする。UI/UX/gameplay 変更は HV policy（390×844動画＋`docs/reports/screenshots/<task>/` に before/after）が Definition of Done。

---

## 11. Owner Decision が必要な項目

| ID | 質問 | 推奨 |
|---|---|---|
| OD-CI-1 | A: sauce 円を SAUCE 工程限定にする（内円の意味を廃止）か、生地工程にも「合格帯」を意図的に持たせるか | 限定にする（生地 gate は size-only のまま） |
| OD-CI-2 | B: FREE Cooking で「塗り始めたらソース選択をロック」するか。#159 の「ソース確定後は別ソース不可」を FREE Cooking にも適用する意図か | ロックし、解除は明示リセット |
| OD-CI-3 | B: ソース単独の「やり直す」を作るか（現状は PREPARE 全体リセットのみ） | 作る（小） |
| OD-CI-4 | C: 分類は表示のみ変更（データ `category` 維持）でよいか | 表示のみ |
| OD-CI-5 | C: CHEESE 工程を INGREDIENTS に統合するか、recipe 宣言の step order で解くか | step order（Cooking Steps 合流） |
| OD-CI-6 | D: 焼きを一方向 progress にするか。SPEED・窓幅の方針、放置（右端到達）時の扱い | 一方向化を採用、数値は HV で決定 |
| OD-CI-7 | D: onboarding で guide を長く出す条件（初回のみ / 最初のN枚 / recipe 未発見） | 要決定（Progression の onboarding 仕様と整合） |
| OD-CI-8 | E: CUT を「軌跡入力＋近似弦採点」にするか、「真の曲線切断」まで踏み込むか | 近似弦（曲線切断は別テーマ） |
| OD-CI-9 | E: Undo を廃止するか。廃止するなら代替（確定前プレビュー／初心者のみ Undo）を採るか | 確定前プレビュー、または初心者のみ Undo |
| OD-CI-10 | 共通: 「操作は原則不可逆＋救済は別レイヤー（assist）」を設計原則として採用するか | 採用（工程ごとに例外を明記） |
| OD-CI-11 | E/CUT-S2: uniformity zero 0.6 vs 0.4（S2 未決）を、軌跡入力の実機 HV 後に決めるか | 軌跡入力の HV 後に決定 |

---

## 12. 項目別の最終分類（再掲）

**KEEP**
- 「1ピザ=1ソース、新ソースが旧ソースを置換」という現行仕様（matcher / fingerprint / 在庫が依存）
- `IngredientCategory = sauce|cheese|topping` のデータ分類（今は触らない）
- BAKE の「採点 authority とガイド表示の分離」および Completion Gate の bake margin（position→値の写像）
- 「操作は原則不可逆＋救済は別レイヤー」という原則（運用は工程ごと）
- CUT-S1/S2 の評価式・測定結果（再利用）

**CHANGE RECOMMENDED**
- A: `.sauce-target-guide` を SAUCE 工程限定に（生地／チーズ／具材／CUT への漏れを止める）
- C(1): 棚表示として cheese を「材料の1棚」に
- D: bake position の単調化（右端 clamp、焦げは回復しない）
- E: 軌跡入力（採点は近似弦）
- B/FREE: ソース選択の見せ方（置換が起きることの可視化）

**OWNER DECISION REQUIRED**
- B: FREE Cooking のソースロック方針、ソース単独リセット
- C(3): CHEESE 工程統合 vs step order
- D: SPEED・窓幅・onboarding guide 方針
- E: Undo 廃止と救済、曲線切断の是非、uniformity zero

---

## 13. 未確認・限界

- Lunch Rush / Dinner の円の本数は**コード読みのみ**（FREE Cooking と guided margherita/capricciosa/hawaiian のみ実測）。
- A/B/C/D 焼き判定という区分はコード上見つからなかった。Owner が指す区分の定義を要確認。
- BAKE 時間と Lunch Rush MissionClock・Dinner clock の関係（一方向化で焼き時間が変わった場合の総プレイ時間への影響）は未調査。
- PR #275 の差分本体は未精読（CUT-S2 Result に記載された変更ファイル一覧と #294 の記述に依拠）。
- Preview / Human Verification は本監査の対象外（audit-only）。実装時に HV policy に従う。
- Hint 5.0・Trial Notebook の cheese / ソース関連の詳細な影響分析は §4.2 / §9 の範囲に留めた（実装前に再監査が必要）。

---

## 14. Owner Decision 記録（Fresh Audit 承認後）

Fresh Audit 結果は Owner により承認された。以下を正式に記録する。

| ID | 決定 | 状態 |
|---|---|---|
| OD-CI-1 | DOUGH 工程に漏れている sauce target guide は修正する。DOUGH は dough guide のみ、sauce target guide は SAUCE 工程だけ表示。**新しいゲーム仕様ではなく、既存 sauce guide の phase gate 不足による表示不具合**として扱う | 承認 / **実装済み（Dough Guide Leak Fix, §15）** |
| OD-CI-2 | BAKE は一方向進行へ変更する方向で設計する。右端を終端とし、焼き状態は自然に戻らない。既存 guide fade は維持候補。現在の速度はそのまま使わず Human Feel で再設計する。実装は PR #275 merge 後 | 承認 / 未実装（#275 は main に merge 済み: `5c8190f`） |
| OD-CI-3 | CUT は pointer trajectory 入力へ変更する方向。ただし scoring は trajectory そのものではなく、trajectory から導出した近似弦 / 最終 cut geometry を原則評価する。CUT-S1/S2 の評価器と HV 知見を再利用する | 承認 / 未実装 |
| OD-CI-4 | CUT 確定後 Undo は廃止方向を第一候補とする。trajectory 版の実機 HV で誤操作率を確認して最終決定。確定前キャンセル・onboarding 救済などは比較可能とする | 方向承認 / **最終決定は HV 後** |
| OD-CI-5 | CUT は 4/6/8 等分への拡張性を維持する。6 等分専用の実装にしない | 承認（制約） |
| OD-CI-6 | FREE Cooking で、別ソース選択だけで既存ソースが消える仕様は変更する方向で設計する。一度塗り始めたソースは基本的に保持し、変更には明示的な reset 操作を要求する候補。multi-spread は Cooking Steps 側で別途設計 | 方向承認 / 未実装 |
| OD-CI-7 | cheese は材料 UI 上では「具材の中の cheese shelf」へ寄せる。ただし現在の data category や matcher contract はまだ変更しない | 承認 / 未実装（R6 完了後） |
| OD-CI-8 | CHEESE 工程 → INGREDIENTS 工程統合はまだ決定しない。Large Catalog R6 完了後、Cooking Steps の step order と合わせて判断する | **保留** |
| OD-CI-9 | DOUGH の伸縮は可逆のまま維持する | 承認（KEEP） |

実装順序: 最初のスライスは「Dough Guide Leak Fix」のみ。BAKE / CUT / Sauce behavior / Cheese 工程は未着手。

## 15. Slice 1: Dough Guide Leak Fix（実装メモ）

- 変更: `src/components/PizzaStage.tsx` の `.sauce-target-guide` 描画条件に `makingStep === "SAUCE"` を追加（1条件）。scoring / dough behavior / sauce behavior / state / save は無変更。
- 回帰テスト: `src/components/PizzaStage.targetGuides.test.tsx`（FREE Cooking / guided ×2 / Dinner / Lunch Rush × DOUGH / SAUCE / CHEESE・TOPPING・CUT。修正前は 6 件 fail、修正後 18 件 pass）、`e2e/dough-guide-leak-fix.spec.ts`（実ブラウザ 390×844 / 360×800）。
- **実測で判明した訂正:** Dinner は recipe-free round で Reference が無く、sauce guide は元々 SAUCE 工程でも出ない（§2.2 の Dinner「2本」推定は誤りで、実際は 1本）。
- スクリーンショット: `docs/reports/screenshots/dough-guide-leak-fix/{before,after}/`（guided DOUGH が before 2本 → after 1本。before に guided-sauce が無いのは、修正前は e2e が DOUGH の assertion で止まるため。SAUCE の見た目は修正前後で不変）。
