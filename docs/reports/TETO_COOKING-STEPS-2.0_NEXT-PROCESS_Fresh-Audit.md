# TETO Cooking Steps 2.0 — 次期調理工程・調理法拡張 Fresh Audit（docs-only）

Status: **調査・設計のみ。実装前に Owner へ報告して停止。** `src/**` / CSS / runtime / e2e の変更なし。新規 PR・merge・deploy なし。
Issue #294 / #465 項目 10 / #489 の続き。Owner Decision はここでは行わない（§8 は選択肢と推奨のみ）。

| 項目 | 値 |
|---|---|
| 監査対象 main | `d0da093`（`git fetch origin main` で再取得。PR #487 の squash） |
| 読んだ authority | Issue #294（本文＋コメント 3 件）、#465、#495、`docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md`、`docs/decisions/TETO_COOKING-STEPS-2.0_FINISH-ENGINE_OWNER-DECISIONS.md`、`docs/reports/TETO_COOKING-STEPS-2.0_FINISH-Pilot_Pre-Implementation-Design.md`、CS-4a / sauce B1・B2 の Result |
| 実コード確認 | `finishEngine.ts` / `cookingProfiles.ts` / `gameReducer.ts`（FINISH 分岐）/ `postBakeView.ts` / `techniques.ts` / `signature.ts` / `sauceLedger.ts` / `testSupport/finishFixture.ts` |
| 分類の再計算 | 既存の read-only classifier を `d0da093` に対して実行（出力はリポジトリ外）。**結果は §3.2 の既存値と同一**（下記） |
| 触っていない対象 | #487、#468、#494、#438（および #478 / #489 系の open PR） |

---

## A. PR #487 の残確認

| 項目 | 結果 |
|---|---|
| E2E WebKit (Cooking UI 1-Screen) **run #831** | **completed / success**（run id 38656522163、attempt 1、head `d0da093`、push to main、2026-10-14 23:50Z 開始 → 2026-10-15 00:07Z 更新） |
| 同コミットの Deploy to GitHub Pages | run #344 completed / success |
| 再実行 | 不要（success のため実施していない） |

→ **記録して完了。** failure の分類は不要。

---

## B. Fresh Audit — 既に実装済みのもの（未実装として扱わない）

> **ドキュメント側の古い記述（要訂正、本 PR では訂正しない）**
> - Issue #294 本文の「No phase has started」と、設計 §14 の「CS-1a ◻ not started」は古い。
> - 実際は CS-1a（#464）、CS-1b（#490）、FINISH D1a（#491）、D1b（#497）、CS-4a（#499）、sauce B1（#498）/ B2（#500）が main にある。
> - #465 の項目 10（FINISH）は未チェックのままだが、engine 部分（D1a/D1b）は merged。UI（D2）と有効化（P4）が未了。

### B.1 工程別の現状（`d0da093`）

| # | 工程 | 現状 | 根拠 |
|---|---|---|---|
| 1 | **FINISH engine** | **engine は実装済み・本番では不活性。UI は未着手。** | 下記 B.2 |
| 2 | **後乗せ調理法 TQ-2** | **未着手。** 調理法レジストリは `no-sauce` のみ。TQ-2 の Issue も存在しない（Pilot §7.3 どおり、Owner の了承待ちで未起票）。`late` 軸は `FIXED_BY_FLOW` のまま | `src/data/techniques.ts`（`TechniqueId = "no-sauce"`）、`signature.ts:96` |
| 3 | **複数回のソース塗布 TQ-3** | **プレイヤー側の土台のみ実装済み、レシピ側は未実装。** 下記 B.3 | `sauceLedger.ts`、B1/B2 Result |
| 4 | **生地の種類・形状変更** | **未実装。** 生地は 1 種類（`dough: "standard"`、`FIXED_BY_FLOW: one dough style only (no DOUGH_VARIANT)`）。D3A の自由な手伸ばしはあるが「種類」ではない。形状目標・形状対応 CUT もない | `signature.ts:72,96` |
| 5 | **調理順序の変更** | **未実装。** `deriveCoreSteps` は DOUGH→SAUCE→CHEESE→TOPPING 固定。`COOKING_PROFILE_OVERRIDES` は空。`layerOrder` は `FIXED_BY_FLOW` | `cookingProfiles.ts` |
| 6 | その他 | 下記 B.4 | 分類 JSON |

### B.2 FINISH engine — 実装済みの範囲と未了の範囲

**main にあるもの（Owner Decision OD-CS-3/11/7 = A に従う）**

| 層 | 内容 | PR |
|---|---|---|
| データ | `RecipeRequirement.applicationPhase?: "POST_BAKE"`（レシピ側。食材マスタには置かない） | #491 |
| 純粋層 | `finishEngine.ts`: `hasPostBakeRequirement` / `withoutPostBakeRequirements`（暫定判定）/ `pizzaForFinalEvaluation`（双方向のフェーズ制限）/ `finishAllowedForRound` / `roundRunsFinish`（Guided のみ）/ `postBakePieces` | #491, #497 |
| 工程導出 | `deriveCoreSteps` が後乗せ要件で `FINISH` を末尾に追加（CUT より前）。後乗せ要件は元カテゴリの工程を作らない | #491 |
| ピース | `PlacedTopping.stage?: "post"`、在庫の post 専用ゲート／消費、FINISH 限定 Undo | #491 |
| 確定 | `finalizeRound({ finalization: "PROVISIONAL" \| "FINAL" })`（後方互換。既存全レシピ × 4 モードで deep-equal） | #490, #491 |
| reducer | `GameState.bakeValue`（transient）、`CONFIRM_BAKE` で PROVISIONAL、FINISH 確定時に FINAL を 1 回、`PLACE_TOPPING` の FINISH 分岐、焼成失敗で FINISH スキップ（OD-CS-7）、Dinner は fail-closed | #497 |
| タブ | `STEP_LABEL.FINISH = "仕上げ"`、FINISH のタブ色、7 タブ用 T3 圧縮チップ（fixture のみ。本番上限 `MAX_VISIBLE_COOKING_TABS = 6` は不変） | #499 |
| テスト | BBQ 型 test-only fixture（`finishFixture.ts`: tomato-sauce / mozzarella / chicken + parsley 後乗せ）、`finishEngine.test.ts`、`gameReducer.finish.test.ts`。`RECIPES` に後乗せ要件が無いことを invariant で固定 | #491, #497 |

**未了（= 次の実装候補）**

| 項目 | 状態 |
|---|---|
| **FINISH の画面** | なし。`postBakeView.renderedPostBakeStep()` は CUT 以外 `null`（コメントに「FINISH has no UI」）。`GameScreen` / `IngredientTray` / `PizzaStage` に `stage === "post"` の参照が無い |
| **焼成後に置いたピースの描画** | 未確認＝未実装（PizzaStage に post の扱いが無い。焼き色を付けない「新鮮な」見た目が必要） |
| FINISH のヒント | なし（reducer に「FINISH has no hint yet (D2)」） |
| 暫定スコアの表示 | #495（Scoring 2.0 が後乗せ要件を除いた Reference を扱えない）。**UI に暫定値を出す場合のみ必要**。engine には不要 |
| FREE の仕上げ UI | UD-B 未決定（FREE は `roundRunsFinish` で除外中） |
| ガイドの仕上げ表示範囲 | UD-E 未決定 |
| Lunch Rush / Dinner の扱い | UD-I 未決定（現状 fail-closed で除外） |
| 本番レシピでの有効化 | P4b。TQ-2 と同時（OD-CS-1 = A） |

### B.3 複数ソース — 何が済んでいて、何が無いか

| 層 | 状態 |
|---|---|
| 1 枚のピザに複数ソースを載せる（ledger、種類別 100% 上限、全体上限 2.0 暫定、種類ごと在庫消費、Gate／採点は必須ソース自身の deposit で判定） | **実装済み（B1 #498）** |
| 種類ごとの描画レイヤー（alpha 重ね） | **実装済み（B2 #500）**。O4（alpha か multiply か）は Owner 判断待ち |
| ソース残量ゲージ | **未了（B3）**。#494 は HOLD（ledger に置き換えられる） |
| レシピが複数ソースを**要求**する | **未実装。** 要件・基準ピザ・採点は 1 ソース前提。現状、2 種目のソースは Recipe 成分の「余分な種類」として**減点**され、どのカタログ target とも一致しない（B1 Result の記述） |
| ドリズル（焼成後のソース）／`PAINT_TEMPORARY` | 未実装。タイミングは証拠に無い（OD-CS-14） |
| 技法 TQ-3 | 未着手。Hint 5.0 の SAUCE rung が「2 ソース」を露出するため G7 の再監査が要る |

→ **#489 の B1/B2 は TQ-3 の足場だが TQ-3 そのものではない。** 重複起票しないこと。

> 確認事項（断定しない）: B1 Result は「B1 は B2 なしでプレイヤーに出さない」としていた。B2 は main にあり、B3（ゲージ）は未了。`d0da093` の Deploy run は success だが、複数ソースが現在の本番でプレイヤーに見えているか（B3 前に公開してよいか）は、本調査では本番を操作していないため未確認。#489 側の Owner 判断事項。

### B.4 172 レシピ拡張を妨げる主要工程（再計算済み）

`d0da093` で classifier を再実行。クラス分けは設計 §3.2 と同一（`runtimeRecipeId` が付いた行は 51）。

| Class | 行数 | 意味 |
|---|---:|---|
| CURRENT_ENGINE | 32 | 現行 engine のまま（うち 29 は既に runtime、3 は未出荷: supreme / pizza-baiana / pizza-chilena） |
| DATA_ONLY | 42 | 食材・単一ソース追加、no-sauce（TQ-1D 出荷済み）。**engine 不要** |
| SMALL_ENGINE | 19 | 生地 13、後乗せ 4、順序 1、ゾーン 1 |
| MAJOR | 30 | 複数ソース 14、パン 8、形状 5、包む 4、mid-bake／prep／fry |
| AUTHORITY_GAP | 49 | ソース未特定 33、機構の解釈 11、他。解決後の基底: CURRENT 3 / DATA 29 / SMALL 9 / MAJOR 7 / 残 1 |

メカニクス別（行数）: DOUGH_VARIANT 33、MULTI_SPREAD_LAYER 17、LATE post_bake 8、PAN 8、DOUGH_SHAPE 5、ENCLOSE 5、LATE mid_bake 3、PREP 3、STEP_ORDER 2、FRY／LAMINATE／ZONED 各 1、LATE 未確定 1、NO_SAUCE 44（出荷済み）。

**重要な読み取り:** 即時に件数を最も動かすのは engine ではなく **DATA_ONLY 42 + CURRENT_ENGINE のうち未出荷分**（レシピ Batch、Batch 7a #492 の続き）。engine 側で最大の塊は **生地の種類（33 行）**、次が **複数ソース（17 行）**。後乗せは 8（+ mid-bake 3）行と少ないが、FINISH は engine が既にあるため最小の追加で効く。

---

## C. 次期実装計画

### C.1 工程一覧

| 工程 | 現在の実装状況 | 追加できるレシピの具体例 | プレイヤー操作 | 既存 UI との整合 | 難易度 | 依存 |
|---|---|---|---|---|---|---|
| **FINISH（後乗せ）UI＝D2** | engine 済み・UI なし | **BBQ チキン**（`bbq-chicken-pizzadb`: BBQ ソース・鶏・パクチーを後乗せ、**6 タブ・CUT なし**）。他: wasabi-beef（7 タブ）、black-truffle（5 タブ。no-sauce と二重技法）、nutella-dessert（要新素材 3） | 焼成後に「仕上げ」タブへ。既存のトレイから既存のピース配置操作で置く。1 つ戻す（既存 Undo）。「次へ」で確定 | 工程タブ（`STEP_LABEL.FINISH` 済み）、トレイ、Undo、`CONFIRM_MAKING_STEP` を再利用。**新規 UI 部品はほぼ不要**。ただし `GameScreen` / `IngredientTray`（#478 が編集中）と `PizzaStage`（#468 が編集中）に触れる | 中 | #478、#468 の決着。UD-E |
| **TQ-2 後乗せ調理法（有効化）** | 未着手 | 同上（有効化＝初の本番後乗せレシピ） | 発見時に「調理法」として Dex に出る | RESULT の技法ステージ、Dex 調理法欄（`no-sauce` の前例） | 中〜大 | FINISH UI、UD-D/G/F/I、OD-CS-4..8、Hint 再監査（G7 を赤で確認）、新素材 `bbq-sauce` `cilantro`（recipes.ts は Batch と衝突注意） |
| **TQ-3 複数ソース（レシピ側）** | 足場のみ（B1/B2） | burrata-pizza（トマト＋オリーブオイル、新素材 1）、grandma。8 行がトマト＋オイル | 既存のソース塗りを種類を切り替えて複数回 | SAUCE 工程内で完結（B2 の重ね描画）。ドリズルを FINISH にすると 7 タブ | **大**（複数ソースの要件モデル・基準ピザ・採点・Hint SAUCE rung） | B3、OD-CS-14、Hint OD-H5-P4／G7、TQ-2 後 |
| **生地の種類** | 未実装 | pinsa-romana、piadina（no-sauce と組合せ）、ny-style、st-louis ほか 13 行（SMALL） | 生地の選択（材料として／DOUGH 工程内の選択）は未決 | DOUGH 工程の既存 UI。Hint に生地 rung が無く隠れた識別次元になる（H9） | 中（材料化なら大） | **OD-CS-12**（#216 の解禁、PR #255 taxonomy、Hint 5.0） |
| **生地の形状変更** | 未実装 | turkish-pide（舟形、未解決素材 2）、al-taglio（角形） | 目標形状に合わせて伸ばす | 形状対応 CUT／配置境界が必要 | 大 | OD-CS-17、パン工程 |
| **調理順序の変更** | 未実装 | trenton-tomato-pie（チーズ→ソース。既存素材 2 のみ）。chicago-deep-dish は MAJOR（パン併用） | 工程タブの順序が変わるだけ | `deriveCoreSteps` / `COOKING_PROFILE_OVERRIDES`（空）に入口あり。タブ上限と無関係 | **小** | 独立。レシピ側 `layerOrder` 軸の扱いのみ監査 |
| ゾーン配置 | 未実装 | quattro-stagioni（新素材 1） | 4 区画に別々の具材 | 配置規則と基準レイアウト | 中 | 順序変更と同時に監査可 |
| パン／包む／prep／mid-bake／fry／laminate | 未実装（`FOLD/SEAL/EDGE_FILL` はラベルのみ） | montreal、calzone、yakiniku、mentaiko-cream、pizza-fritta | 各々新ジェスチャ／新フェーズ | 新 UI 多数 | 大 | 工程ごとに Fresh Audit（OD-CS-16..18） |
| **レシピ Batch（engine 不要）** | 継続中（#492） | CURRENT_ENGINE 未出荷 3 + DATA_ONLY 42 のうち未出荷 | 既存操作のまま | 変更なし | 小（データ） | 通常のレシピ Gate、no-sauce は TQ-1D 出荷済み |

### C.2 推奨実装順

1. **（並行可・小）レシピ Batch**: engine 不要の件数が最大。
2. **FINISH D2（UI）** — 下記の最小単位に分割。TQ-2 の前提。
3. **TQ-2 起票 → 有効化（BBQ チキン）**: Owner の了承後に Issue 起票（現状存在しない）。
4. **調理順序（Trenton）**: 小さく独立。D2 と並行でも衝突しない（`cookingProfiles.ts` のみ）が、新しい識別次元（`layerOrder`）の扱いに Owner 判断が要る。
5. **生地の種類**: 件数は最大だが OD-CS-12 が重い。Fresh Audit を先に。
6. **TQ-3**: B3 とゲージ決着後。
7. **MAJOR 群**: 個別監査。

### C.3 FINISH の最小の次期実装単位（提案）

engine は既にあるため、**足りないのは「見える・置ける」だけ**。1 PR にまとめず、衝突面の異なる 2 つに分ける。どちらも本番レシピには FINISH を出さず、**fixture ハーネス限定**（CS-4a の `e2e/harness/cs4-tabs` と同じ手法）。

| 単位 | 内容 | 触るファイル | 衝突 | HV |
|---|---|---|---|---|
| **D2-1 FINISH 画面の接続** | `renderedPostBakeStep` が FINISH を返す（プロファイルに FINISH がある時のみ）。FINISH 中は既存トレイ（トッピングのみ）と既存の配置・Undo・「次へ」を有効化。ヒント行は空のまま。**Guided のみ**（`roundRunsFinish`） | `postBakeView.ts`、`GameScreen.tsx`、（必要なら）`IngredientTray.tsx` | **#478 が `GameScreen` / `IngredientTray` を編集中** → #478 の決着後 | fixture ハーネスで 390×844 動画＋ before/after（本番画面は不変のため、変化なしの証明） |
| **D2-2 後乗せピースの描画** | `stage === "post"` のピースは焼き色・焦げ・溶けを適用しない（新鮮な見た目）。それ以外の描画は byte 同一（既存 golden） | `PizzaStage.tsx` | **#468（Canvas チーズ、`PizzaStage`）・#494（`PizzaStage`）** → 両方の決着後 | 同上（見た目が変わる部分があるため動画必須） |

順序は **D2-1 → D2-2**、またはどちらも未着手の間に **D2-0（先行できる非 UI 部分）**:

- **D2-0（衝突なし、先行可能）**: FINISH ヒント行の方針（空／固定文言）の純粋関数化と、`renderedPostBakeStep` に FINISH を足した場合の `postBakeView.test` 拡張のみ。
  - 実質的な価値は小さい。**推奨は D2-0 を作らず、#478 の決着を待って D2-1 から**。
- #495（暫定スコアの Reference）は D2 では**不要**。暫定値を UI に出さない限り着手しない。

受け入れ条件（案）: 本番 `RECIPES` に `applicationPhase` が無い invariant を維持／全プロファイルの 6 タブ上限テスト不変／golden（`finalizeRound`・PizzaStage 単一ソース）無編集／fixture で「配置→Undo→確定→FINAL 採点→在庫 1 回」が通る／WebKit Gate green。

### C.4 Owner 判断が必要な事項

**D2 着手前（またはその判断が D2 の形を決める）**

| ID | 論点 | 推奨 |
|---|---|---|
| 競合方針 | #478（GameScreen / Tray）・#468・#494（PizzaStage）の決着を待つか | 待つ（Owner Decision 2026-10-14 の実装ガード 3 と同じ） |
| **UD-E** | ガイド（レシピ指定）の仕上げ表示: 後乗せレシピのみ／全レシピ常設 | 後乗せレシピのみ（現行レシピの見た目を変えない） |

**有効化（P4 / TQ-2）前**

| ID | 論点 | 推奨 |
|---|---|---|
| UD-B | FREE の仕上げ UI（常設タブ A／二択パネル B） | A（FREE は D·S·C·T·焼く·仕上げ＝6 タブ） |
| UD-D | 後乗せ出荷の帰属（TQ-2 Issue の起票） | engine は CS、有効化は TQ-2。**TQ-2 Issue の起票可否** |
| UD-F | BBQ 型の材料条件（`starGates`、価格、キー素材） | Batch 6 前例（Owner 数値） |
| UD-G | 新技法の名称・なぞかけ・Dex 文言 | Owner 文言 |
| UD-I / OD-CS-5/6 | Dinner／Lunch Rush の後乗せレシピ | 両方除外 |
| OD-CS-4 | FREE のトレイ（全所持トッピング） | 全所持（識別漏れ防止） |
| OD-CS-8 | FINISH 時間を Cooking Time に含めるか | 含めない（CUT と同じ） |
| OD-CS-10 | 後乗せ代表 | BBQ チキン（rucola は証拠なし） |

**その他**

| ID | 論点 |
|---|---|
| OD-CS-12 | 生地の種類モデル（材料／DOUGH 内選択／レシピ固定）。33 行に効く最大論点 |
| OD-CS-14 | 複数ソースのタイミング（SAUCE 内／FINISH ドリズル）。TQ-3 設計時 |
| OD-CS-9 (b) | 7 タブ UI の本番化（CS-4a は fixture のみ）。wasabi-beef 等が必要になった時 |
| #489 O4 | 重なりの見た目（alpha／multiply）、B3、複数ソースの公開時期 |
| 順序変更 | `layerOrder` を識別次元にするか（Hint／Dex への影響） |
| ドキュメント訂正 | #294 本文・設計 §14・#465 項目 10 の状態更新を行うか（別の docs PR） |

---

## D. 重複確認

- 起票なし。既存の受け皿: #294（Cooking Steps 全体）、#465（ロードマップ）、#495（暫定スコア）、#489（複数ソースの足場）、#474/#475/#476（人間の手触り）。
- TQ-2／TQ-3 の Issue は存在しない（検索で該当なし）。起票は Owner の了承後。
- 本調査が作ったのは本ファイルのみ。

## E. 制限の遵守

src／CSS／e2e／runtime は未変更。PR 作成・merge・deploy なし。#487・#468・#494・#438 は未変更。ブランチ push は docs の記録のみ。
