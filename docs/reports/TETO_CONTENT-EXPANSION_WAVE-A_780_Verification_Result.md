# Content Expansion #780 — Workstream A (Wave A recipes) 再検証 Result

日付 2026-11-06 / main `5eade46`（#777 取り込み後）。**docs-only・新規ファイル 1 本のみ。** `recipes.ts` / `ingredients.ts` / `discoveryLadder.ts` / `catalogLedger.test.ts` / `PROJECT_HANDOFF.md`（HOT）は編集していない。
この文書は実装・merge・Production ON・共有 Preview 更新の承認ではない。

## 1. 結論

**今回のセッションで実装したレシピは 0。** 理由は実装を止める側の事実で、いずれも Owner の判断領域:

1. #780 が言及する「Owner 判断不要の 9 品」の**一覧は main にも open PR にも存在しない**（Fresh Audit 2026-11-07 の本体は未取り込み）。9 品を推測で確定しない。
2. 代わりに、最新 main のコードと 172 行マトリクスを機械的に突き合わせた（§3）。**「既存食材のみ・工程追加なし・ブロッカーなし・READY」を満たす行は 0。** 既存の S2 調査（`claude/teto-pizza-parallel-plan-sh894e`、`TETO_CONTENT-POOL_S2_Result.md` §1）の結論と一致する。
3. 唯一ゲートを通る burrata 系（Batch 19、#774）は **Owner GO 未取得**。実装開始条件 5 件中 4 件が未成立（§2）。

## 2. Batch 19（#774）承認状態

| 開始条件 | 状態 |
|---|---|
| Owner の明示 GO（Q3） | **未取得**（#774 のコメントは Prep の参照先の案内のみ。#748 の 2026-11-06 の R2 決定は「#765・#759・#760 の merge と claim 解消まで runtime 実装なし」） |
| #748 claim 解放 | **済**（#748 コメント 6689217829、Owner 指示による代行 release） |
| #759 merge（Q4） | 済（`785d7956`） |
| #760・#765 merge | #774 本文では済。ただし R2 決定の「#760 icon PR」は **#778 / #779 が open の別 PR** で、ハーブ配線の merge 順は未宣言 |
| ハーブ PR と `IngredientGlyph.tsx` / `ingredients.ts` の merge 順の宣言 | **未成立**（#778 と #779 が同じ配線で重複、#779 は `ingredients.ts` を触る可能性あり。どちらを先にするかは Owner 判断） |
| 新 claim | Owner 承認後のため未投稿 |

→ Batch 19 は **HOLD のまま**。着手しない。

## 3. Duplicate Gate / 依存確認（静的、最新 main）

方法: `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（172 行）の `canonicalIngredientIds` + `spreadLayers` を `src/data/ingredients.ts`（85 id + late）と `recipes.ts` / `lateCatalog.ts` の既存 id に照合。**近似であり、実装 PR では実コードの Jaccard テスト・`researchLabelAudit`・Hint 5.0 で再測定する。**

新食材 0・ブロッカー 0・READY の未出荷行は次の 6 行のみ（いずれも実装不可）:

| 行 | 実装できない理由 |
|---|---|
| quattro-stagioni | `funghi` を内包する上位集合（Duplicate Gate 禁止、S2 §1） |
| tsukimi-pizza | `breakfast-pizza`・`aussie` と Jaccard 0.60（Owner 例外が要る）。OD-DH4-2-9 の other-unreachable 契約との衝突（Batch 3 で保留済み） |
| piadina-romagnola | 生地バリアント `flatbread-unleavened`（DOUGH_VARIANT 3 値目、#577 の Gate G5〜G8 は HOLD） |
| fugazzeta-rellena | 生地 `thick-fluffy` ＋ NOT_REPRESENTABLE（ENCLOSE 系の工程） |
| montreal-style-pizza | 生地 `thick` ＋ NOT_REPRESENTABLE |
| pizza-fritta | FRY_COOK（#749 Phase 2、別 Owner Gate） |

追加で、S2 の「ソース未特定ほか 9 レシピ」（bulgogi / teriyaki / keema / philly / chilena / baiana / de-cancha / hokkaido / zucchine-menta）は、規則上禁止 4・Owner 例外が要る 4・要判断 1（teriyaki: 新ソース or NO_SAUCE と後乗せの解釈）。**Owner の例外・ソース判断が前提のため、実装しない。** `caponata` は #706 / FRY の HOLD。

## 4. 競合しない最初のバッチの選定

- **実装可能なバッチ: なし。**
- catalog / ladder の**書き込み担当の一本化**は次の運用を提案する（Owner 承認後に claim 投稿）: Wave A の `recipes.ts` / `ingredients.ts` / `lateCatalog.ts` / `discoveryLadder.ts` / `referencePizza.ts` / `ingredientTaxonomy.ts` / `toppingSizeClass.ts` / `__golden__/**` / `catalogLedger.test.ts` は **1 セッション（Batch 19 の担当）のみが claim**。ハーブ配線 PR（#778 / #779）は `ingredients.ts` の merge 順を claim に明記し、先に merge する側を Owner が決める。他のワークストリーム（B 食材 SVG、C 基盤、D 調理法）はこれらのファイルを claim しない。
- 現在の open PR / claim との重なり: #775（`isDoughKind`）・#776（DRIZZLE D1）・#738（STEAM S3）・#746・#778・#779 は、本文書のファイルと重ならない。

## 5. 数値

| 項目 | 値 |
|---|---|
| 今回の実装レシピ数 | 0 |
| 残りレシピ数（#780 基準） | 目標 177 − 本番 90 = 87（Wave A 46 / B 26 / C 15 の内訳は Fresh Audit 本体が未取り込みのため未再集計） |
| 判断不要で今すぐ実装可能 | 0（本書の静的ゲート） |
| burrata 系（GO 後） | 2 レシピ＋食材 1 |

## 6. ブロッカー（Owner 判断）

1. **「判断不要 9 品」の一覧の所在**（Fresh Audit 2026-11-07 を main に取り込むか、9 品の id をこの Issue に提示する）。
2. Batch 19 の実装 GO（Q3）と、ハーブ PR #778 / #779 のどちらを先に merge するか。
3. 新工程（DOUGH_VARIANT 3 値目、FRY、late）の決定。これが 87 品のうち実装できる数の上限を決める。
4. Jaccard 例外（bulgogi・keema・zucchine・tsukimi）と teriyaki のソース判断。

## 7. 次のバッチ候補

| 順 | 候補 | 前提 |
|---|---|---|
| 1 | Batch 19: burrata ＋ pesto-burrata ＋ pizza-alla-crudaiola | 上記 2 の GO と merge 順 |
| 2 | B20 案 B: honey ＋ walnut ＋ pesto-noci（walnut の SVG は #777 で merge 済み・未配線） | Owner 選択 |
| 3 | B20 案 A: teriyaki（ソース判断後）、caponata（#706 解除後） | Owner 判断 |
| 4 | DOUGH_VARIANT 解禁後: manakish・piadina・poutine | #577 Gate G5〜G8 |

## 8. 検証

コードを変更していないため、テスト・typecheck・build は未実行（`node_modules` も未導入）。HV（動画・スクリーンショット）は UI/ゲームプレイ変更がないため対象外。

---

## 9. 再開時の照合（2026-11-07、main `06cfc066`）

**最新 main:** `06cfc066`（#778 ハーブ 4 種の配線を squash merge）。上記 §1〜§8 の数値・静的測定は `5eade46` 時点で、#778 は描画のみのため catalog・ladder の判定は変わらない（`ingredients.ts` の id 集合は不変、実測は未再実行）。

### 9.1 claim の照合（#774・#780 のコメント、すべて Owner アカウント投稿）

| claim | 保持セッション | 範囲 | 本ブランチとの関係 |
|---|---|---|---|
| #774 T1（コメント 6691358861。GO は 6691439274 で維持） | `session_016YrGi37oV1zQLYSQserkSG` | Batch 19 実装: `ingredients.ts`・`recipes.ts`・`discoveryLadder.ts`・`IngredientGlyph.tsx`・`App.css`・`catalogLedger.test.ts`・`recipeBatchManifest.ts`・golden・Batch 19 の Result／e2e。branch `claude/b19-burrata-774` | **重なりなし**。本セッション（`session_016YrGi4BCurwdvYZFnYeftN`）は Batch 19 を実装しない・これらのファイルに触れない。branch は origin にまだ無く、PR も無い（実装の進捗は未確認＝**未着手または未 push**） |
| #780 T2（コメント 6691363845） | 同上 `…37oV1z…` | 87 行の再判定と PD-1b/c 設計: `TETO_POOL-REJUDGE_87_*`・`TETO_DOUGH-KIND_PD1BC_*`。branch `claude/pool-rejudge-87-780`（origin に未 push） | **調査の主題が重複**。本書の名前空間（`TETO_CONTENT-EXPANSION_WAVE-A_780_*`）はファイルが衝突しないが、87 行の再判定は T2 に任せ、本書では**これ以上の再測定をしない** |
| #748 B18 | 解放済み | — | 無し |
| #779 | 不採用（Owner 指示） | `ingredients.ts` 等 | 触れない。固有成果物の保全と claim 解放後に整理 |

注: 上記 2 つの claim のセッション ID は本セッション（`…4BCurwdvYZFnYeftN`）とは**別**である（先頭が似ているだけ）。本セッションは claim を投稿していない。

### 9.2 「判断不要 9 品」の再確認

- main、open PR（#650・#738・#746・#751・#775・#776・#779 ほか）、#774・#780・#748 の全コメントを再読した。**9 品の id を列挙した資料は無い。** #780 本文の「Fresh Audit 2026-11-07（main `ed159e9`）」の本体も main に無い。
- 規定どおり**推測しない・実装しない**。§3 の機械照合（READY・新食材 0 は 6 行、いずれも不可）は参考値であり、「9 品」の代替ではない。
- T2 の停止条件（87 行の出所が再構成できなければ停止して報告）と同じ結論。9 品・87 行の定義は **Owner が Fresh Audit 本体を提示（または main へ取り込み）** するまで確定しない。

### 9.3 87 品の再判定状況

| 項目 | 状況 |
|---|---|
| 担当 | T2（`…37oV1z…`）。成果物は未 push（`TETO_POOL-REJUDGE_87_*`） |
| 本書の寄与 | 172 行マトリクスの静的照合（§3）と S2 の再利用のみ。87 行の再集計は**していない** |
| 母集団の定義 | 未確定（上記） |

### 9.4 Batch 19 の進捗

Owner GO 済み。実装は T1 が担当（merge 順 #778 → Batch 19 は充足）。origin に branch／PR が未作成のため、**進捗は外部から未確認**。本セッションは重複実装を避け、データも PR も作っていない。報告すべき HEAD・CI・Codex・iPhone HV の証跡は、T1 の PR 作成後にそちらで出る。

### 9.5 次の実装可能バッチ

1. **Batch 19（burrata ＋ pesto-burrata ＋ pizza-alla-crudaiola）— T1 が実施中。本セッションの担当ではない。**
2. 本セッションが根拠をもって進められる追加レシピ実装は**なし**（§1・§3）。
3. その次の候補は §7 のまま（B20 案 B → 案 A → DOUGH_VARIANT 後）。いずれも Owner 判断または新工程の決定が先で、Batch 19 の merge 後に catalog 書き込み担当を一本化して着手する。
