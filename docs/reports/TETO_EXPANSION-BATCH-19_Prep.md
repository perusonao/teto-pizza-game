# Expansion Batch 19 — 実装前準備（食材・レシピ重複検査／アイコン仕様／調理工程／受入条件／テスト計画）

**改訂 5（2026-11-06）:** main への取り込み（docs-only）のための状態更新のみ。#759 の merge（`785d7956`）、#758 の claim release、D 番号体系の注記、GitHub 未記録の決定の明記を追記した。**Owner 決定の内容・仕様・受入条件は変更していない。** 過去の記述は履歴として残し、更新箇所に「【Rev 5 更新】」を付した。将来の近傍増加リスク（`burrata-pizza`）は §2.3.1 末尾に追記。

**改訂 4（2026-11-06）:** Owner 判断 P1・P2（承認）を追記。AC-8b の合格基準を「SAUCE または CHEESE の有料ヒント 1 段で合理的に区別できる」に確定し、検証項目（Hint 5.0・旧 Hint 経路・表示内容・コスト）を明記。AC-8 に非正準差分の報告形式（ID・レシピ・取得順・変更前後）と **未承認差分が残れば Gate HOLD** を追記。それ以外（実装禁止、#759 の merge と Owner の明示 GO を待つ方針）は変更なし。

**改訂 3（2026-11-06）:** Owner 判断 Q1〜Q4 を反映し、最新 GitHub 状態を Fresh Audit（§1.2）。AC-8 を Q2 に合わせて改め、AC-8b（Research ヒントによる 2 レシピの区別）を追加。**実装は引き続き禁止**（#759 の merge 前、かつ Owner の明示 GO まで）。改訂 2 の要約は以下のとおり。

**改訂 2（2026-11-06）:** Owner 判断 D1〜D9 の確定を反映。D2（crudaiola の類似度例外）は近傍 4 件ごとの根拠表（§2.3.1）を追加し、実装開始条件・claim・競合状況（§7.0）を再確認した。初版は `7afbfc5`。

**種類:** docs-only。`src/`・`e2e/`・CSS・ゲームロジック・テストは変更していません。食材・レシピの実装、Production ON、共有 Preview 更新、merge は行っていません。
**ブランチ:** `claude/teto-pizza-batch-19-prep-xvizrg`（`origin/main` `fa67c72`＝#765 取り込み後から作成。**改訂 3 の時点で `origin/main` は `c308a3f`（#761 merge）に進んでいる**が、本ブランチはドキュメントのみで #761 の変更ファイルと重ならないため再ベースしていない。PR #759・#761 のブランチには触れていません）。
**入力（Owner 承認済みの設計資料）:**
- Issue #748 の Owner 決定: 2026-11-05 16:45 UTC「Parallel Investigation」（コメント 6663697601）と 2026-11-06 00:48 UTC「R2 preflight」（コメント 6673566588）。
- ハーブ 4 食材 R2: ブランチ `claude/herb-icons-compare-docs-8auzii` の `c9351e4`（`docs/reports/TETO_HERB-ICONS-COMPARE_2026-11-05_R2_Result.md`）。
- ブッラータ R2: ブランチ `claude/burrata-preflight-docs-8auzii` の `d39a680`（`docs/reports/TETO_BURRATA-PREFLIGHT_2026-11-05_R2_Result.md`、`docs/design/TETO_FINISH-CHEESE_FUTURE-TASK_2026-11-05.md`）。
- 候補 SVG: 上記 2 ブランチの `docs/design/candidates/ingredient-icons-2.0-{herbs,burrata}/`（**どちらも未 merge**。実装時に必要なファイルだけを移す）。

**原典:** pizzadb.jp は未確認です。根拠は 172 matrix の 2 行（`pesto-burrata-pizzadb-p12`、`pizza-alla-crudaiola-pizzadb-p8`）だけで、個数・焼成窓・価格・色はすべて **GAMEPLAY ASSUMPTION** です。

---

## 0. 要約（改訂 2：Owner 判断 D1〜D9 反映後）

1. **Batch 19 = 新食材 1（ブッラータ／`burrata`）＋ 新レシピ 2（pesto-burrata-pizza、pizza-alla-crudaiola）＋ 通常 ladder step 1。新しい調理工程は不要**（SAUCE ×2 → CHEESE → TOPPING → BAKE。FINISH・後乗せ・下ごしらえ・生地は使わない）。2 レシピとも維持（D8）。
2. **ハーブ 4 種（rosemary B / oregano B / spinach A2 / artichoke A2）は B19 のレシピが使わない食材**で、**別 PR・#759 merge 後**（D5）。描画のみで ladder・Research・保存に影響しない。ブッラータの専用 SVG（C）だけは B19 の PR に入る。
3. **重複検査:** 完全一致・部分集合・上位集合・1 材料差は 0 件（main 88 件、B18 反映後 90 件の両方）。pesto-burrata の最大 Jaccard は 0.333、crudaiola は 0.429。
4. **D2／Q1（確定）:** crudaiola の類似度例外は、近傍 4 件（pinsa-romana・jamon-serrano-pizza・grandma-pizza、バッチ内 pesto-burrata）について **C1〜C5 つきで条件付き承認**（Q1、pesto-burrata 近傍を含む）。4 件とも対称差 4、同一／部分集合／上位集合／1 材料差は 0。**受入条件に AC-8b を追加**: Research のヒントで 2 レシピを合理的に区別できること（§5.2）。
5. **Research ラベル（Q2、確定）:** 正準順序での意図しない既存ラベル変化は **0 件必須**。非正準順序の差分は**全件列挙し、1 件ずつ Owner の個別承認**が必要（B18 の「集合として一括承認」より厳しい。未承認の差分が 1 件でも残れば Gate 失敗）。
6. **実装開始条件（Q3・Q4、確定）:** **Owner の明示 GO が必須**。**#748 の claim 期限にかかわらず、PR #759 の merge 前に Batch 19 を実装しない**。Fresh Audit（§1.2）の時点で #759 は **Draft／HOLD・未 merge**（#761 は 2026-11-06 07:35Z に merge 済み）。 【Rev 5 更新・2026-11-06】**#759 は 2026-11-06T13:15:08Z に squash merge 済み（main `785d7956`）。Q4 の条件は充足。** 上の「Draft／HOLD・未 merge」は Rev 3 時点の記録。
7. **P1・P2（承認済み）:** AC-8b は「SAUCE または CHEESE の有料ヒント 1 段で合理的に区別できれば合格」（無料ラベル・所持食材での区別は不要）。非正準ラベル差分は 1 件ごとに ID・レシピ・取得順・変更前後を Result Report に記載し、Owner の個別承認を得る。**未承認差分が残れば Gate HOLD**。Owner への未回答の確認事項は、本書時点でなし（§8.2）。

### 0.1 Owner 判断 D1〜D9（2026-11-06 確定）と反映箇所

> 【Rev 5 更新・2026-11-06】**本書の D1〜D9 は、R2 決定記録（`docs/decisions/TETO_ICONS-HERBS-BURRATA_R2_OWNER-DECISIONS_2026-11-06.md`）の D1〜D9 とは別の番号体系**です（例：本書 D2＝crudaiola の類似度例外、R2 D6＝同じ決定。R2 D5＝burrata 案 C、D7＝crudaiola の 2 層・焼成前、D8＝pesto-burrata の 2 層、D9＝FINISH チーズ保留）。内容の矛盾はありません。引用時は番号でなく内容を併記してください。**D1・D3・D4・D7・D9 と Q1・Q2・P1・P2 は Owner のチャット指示に基づく記録で、#748 の GitHub コメントには記録がありません**（一次証拠は未確認）。

| # | 確定内容 | 反映 |
|---|---|---|
| D1 | 食材名「**ブッラータ**」 | §3.1・§4.3。`nameJa: "ブッラータ"`。Research ラベルは「？？？ピザ A（ブッラータ）」。matrix の「ブラータ」表記は検索エイリアスに残す提案（§4.3、実装時に既存の `ingredientSearchAliases` の作法を確認） |
| D2 | crudaiola 限定の類似度例外を**条件付き承認**。近傍 4 件との違いを文書化し、根拠が不足すれば再判断 | §2.3.1（近傍ごとの根拠・条件・再判断トリガー）。pesto-burrata 近傍は **Q1 で C1〜C5 つき条件付き承認** |
| D3 | pesto-burrata-pizza＝**ペスト・ブッラータピザ**、pizza-alla-crudaiola＝**ピッツァ・アッラ・クルダイオーラ**（暫定） | §4.2。id・日本語名とも暫定。実装 PR で「暫定」と明記 |
| D4 | 個数・窓・価格・色は暫定実装可、Preview HV で調整 | §4.2・§4.3・AC（§5）。GAMEPLAY ASSUMPTION として記録 |
| D5 | ハーブ 4 種は別 PR、#759 merge 後 | §7.1・§7.2 |
| D6 | Research ラベル監査は**必須 Gate**。既存ラベルの**意図しない変化 0 件** | §2.4・AC-8・§6.1。**Q2 で確定**（正準順 0 件必須、非正準は全件列挙＋個別承認） |
| D7 | pesto-burrata のチーズはブッラータのみ（mozzarella を足さない） | §4.2 |
| D8 | 2 レシピ維持 | §7.1 から縮小案を削除 |
| D9 | #759 merge 後の Issue 起票を承認 | §7.0 の開始条件。起票と claim は #759 merge 後の実装セッションが行う（本書では起票しない） |


### 0.2 Owner 判断 Q1〜Q4・P1・P2（2026-11-06 確定）と反映箇所

| # | 確定内容 | 反映 |
|---|---|---|
| Q1 | pesto-burrata 近傍の例外を **C1〜C5 つきで条件付き承認**。**Research ヒントで両レシピを合理的に区別できることを受入条件に追加** | §2.3.1（判定を「条件付き承認済み」に更新）、AC-8b（§5.2）、§6.2 のテスト、T3 を「AC-8b を満たせない場合」に更新 |
| Q2 | 正準順序での意図しない Research ラベル変化は **0 件必須**。非正準順序の差分は**全件列挙し、個別 Owner 承認が必要** | §2.4、AC-8（§5.2）、§6.1、§7.0 の S-6。個別承認の運用は §8.2 P2 |
| Q3 | Batch 19 の実装開始には **Owner の明示 GO が必須** | §7.0 S-7（「推奨」から「必須」へ） |
| Q4 | #748 の claim 期限にかかわらず、**#759 の merge 前には実装しない** | §7.0 S-1（claim の期限・解放と独立の必須条件）、S-3 の位置づけ |
| P1 | AC-8b の合格基準: **SAUCE または CHEESE の有料ヒント 1 段**で pesto-burrata と crudaiola を合理的に区別できれば合格。**無料ラベルや所持食材で区別できる必要はない**。Hint 5.0・旧 Hint 経路・表示内容・コストを**実装時に検証** | AC-8b（§5.2）、§6.2、T3 |
| P2 | 非正準順序の Research ラベル差分は、**1 件ごとに ID・レシピ・取得順・変更前後**を Result Report に記載し、Owner の個別承認を得る。**未承認差分が残る場合は Gate HOLD** | AC-8（§5.2）、§6.1、§7.0 S-6 |

---

## 1. 現在の main と B18 後の想定

本節の件数・step は `fa67c72` 時点で計算した値。改訂 3 の時点の `main` は `c308a3f`（#761 のみ追加。`src/App.css`・e2e・docs の変更で、`src/data/*` と ladder は不変）なので、**数値は変わらない**。

| 項目 | main（`fa67c72`／`c308a3f`、B18 未反映） | #759 merge 後（B18 報告の数値） | Batch 19 後（**想定・実装時に再計測**） |
|---|---|---|---|
| レシピ（Pinsa 開／閉） | 88／87（通常 80＋late 8／7） | 90／89 | 92／91 |
| credited | 78 | 79 | **80**（pesto-burrata のみ credited） |
| 食材 id | 97 | 97 | **98**（burrata） |
| 通常 ladder step | 68（sour-cream／goulash） | 69（cilantro／baingan） | **70（burrata／pesto-burrata）** |
| late の導出番号 | 69–75 | 70–76 | 71–77（+1） |
| 章サイズ（最終章） | 51 | 53 | 55（B18 が 2 レシピで +2 だった前例に倣う想定） |
| Lunch Rush プール | 25 | 25 | 25（両レシピ `lunchRush:false`） |

- main の 88 は `recipes.ts` の `id:` 80 件と `lateCatalog.ts` の 8 件（pinsa-romana を含む）を数えた値。B18 の数値は PR #759 の Result Report を引用したもので、**この環境で #759 を検証し直してはいません**。
- #759 は **Draft／HOLD**（iPhone Safari HV と Owner の merge 承認待ち）。B18 が merge されなければ burrata は step 69 になり、本書の step 番号・件数は全て 1 つずれます。**実装開始時に必ず再計算**してください（B18 Design-Audit と同じ運用）。 【Rev 5 更新・2026-11-06】#759 は merge 済み。想定どおり burrata は通常 step 70 になる見込み（**未実測**、実装時に再計算）。
- 食材の追加は ordinary 側 1（burrata）だけで、late カタログ・`LATE_ENTITLEMENT_FLOORS` には触れません（案 P、§4.2）。

### 1.1 干渉の確認（2026-11-06 時点）

| 対象 | 状態 | 本準備との関係 |
|---|---|---|
| PR #759（B18） | Draft／HOLD、HEAD `d9679e6` | 本ブランチは `docs/reports/` と `docs/reports/data/` の新規ファイルのみ。**ファイル重なりなし**。B19 実装の前提（§7） |
| PR #761（#758 大葉 1.35em） | **merge 済み**（2026-11-06 07:35Z、`c308a3f`）。`src/App.css`・e2e・docs | 重なりなし。herb／ブッラータの描画補正が `App.css`（HOT）を触る場合は、`c308a3f` を含む main から開始 |
| #760（牛肉・ピーマン）／#765（360px はみ出し） | **main に取り込み済み** | 前提は充足 |
| #763・#757・#756・#762（Steam V2/V3 Lab）、#746（DRIZZLE）、#738（Steam S3） | Draft／Open | B19 は `src/data/*`・描画・テストのみ。重なりなし（`main.tsx`・`PizzaStage.tsx`・`src/preview/*` に触れない） |
| #753（Style Lock V2 §12）／#751（Fry 視覚） | Open | `docs/` のみ。アイコン仕様の文書化は #753 merge 後に追記するのが衝突しにくい |
| claim | #748 の claim（`recipes.ts`・`ingredients.ts`・`lateCatalog.ts` ほか、期限 2026-11-19） | **B19 の実装は #759 の merge 後（Q4: claim の期限・解放と独立）。claim の解放・失効も確認する**。本準備は docs のみで重ならない |

**改訂 2 での再確認（2026-11-06、改訂 3 の Fresh Audit〔§1.2〕で更新済み：#761 はその後 merge、`origin/main` は `c308a3f`）:** `origin/main` は `fa67c72` だった。PR #761 の HEAD は `e96318c` に更新（`src/App.css` の `shiso-leaf` 個別ルールのコメントから PROVISIONAL を除去し、Owner の iPhone Safari デザイン HV PASS〔統合 Preview #760+#761+#765〕を記録）。PR #759 は HEAD `d9679e6`・Draft・`mergeable_state: unstable`・base は `fa67c72`。詳細な claim 状況は §7.0。

本ブランチは claim コメントを投稿していません（docs-only の準備で、`docs/reports/TETO_EXPANSION-BATCH-19_*` は他セッションの claim と重ならないため）。実装セッションが使う claim 文案は §7.4 に置いています。

---

### 1.2 Fresh Audit（改訂 3、2026-11-06 に GitHub から取得）

| 項目 | 結果 |
|---|---|
| `origin/main` | **`c308a3f`**（#761 merge）。直前は `fa67c72`（#765）、`537ed09`（#760） |
| PR #761 | **merge 済み**（`merged_by: perusonao`、2026-11-06T07:35:30Z）。Owner の iPhone Safari デザイン HV PASS は #761 の Result Report に記録 |
| PR #759（B18） | **Open／Draft、未 merge**。HEAD `d9679e6`、base `fa67c72`、`mergeable_state: unstable`、最終更新 2026-11-06T05:58Z。【Rev 5 更新・2026-11-06】**merge 済み**（`785d7956`、最終 HEAD `c533a4f1`、2026-11-06T13:15:08Z）。左は Rev 3 時点の記録 |
| #759 の Gate（HEAD `d9679e6`、check runs 11 件） | Codex レビュー: **指摘 0 件**（受領コメント 6677278855）。build・classify・layout-chromium・Layout Contract Gate・WebKit 360×800 の 3 shard・390×844 の shard 1・3: success。**WebKit 390×844 shard 2/3 と WebKit Gate: failure** |
| WebKit shard 2/3 の失敗 | attempt 1 は `lunch-rush-r8-restore.spec.ts:154`（G-6）、attempt 2 は `failed-hint-676.spec.ts:91`（C1）で、**別のテスト**。#759 の調査コメント（6678125549）は B18 起因の証拠なしとし、既知の不安定さ（#394・#680）の候補として扱う。**Owner は「PASS 扱いにはしない」と判断済み**で、追加の再実行は許可されていない |
| #759 の iPhone Safari 実機 HV | **Owner 判定 PASS**（今回の指示）。ただし **GitHub 上（PR #759・Issue #748）にはその記録を取得できなかった**（#759 の最新コメントは 05:58Z の WebKit 調査）。本書は指示を根拠とし、PR 側への記録は #759 の担当セッションの仕事 |
| #759 の merge 承認 | **未確認**。Draft のまま、merge 承認の記録なし。**S-1 は未充足** 【Rev 5 更新・2026-11-06】**merge 済み（Owner が 13:15:08Z に merge）。S-1 は充足** |
| Issue #748 | コメント 7 件のまま（新規なし）。最新の claim は 2026-11-05 のコメント 6650377722（期限 2026-11-19T00:00Z、B18 セッション）。解放の投稿なし |
| 他の open PR | #763・#762・#757・#756（Steam Lab）、#746（DRIZZLE）、#738（Steam S3）、#753・#751・#747（docs）ほか。いずれも更新なし。`src/data/*` を触る見込みのものは #759 のみ（変更ファイル一覧を取得したのは #759・#761。他は題名・更新日による判断で、厳密な確認は Owner Gate の dry-run） |

**含意:** 実装開始の前提のうち、#760・#765・#761 は充足。**残るブロッカーは #759 の merge**（Q4 により claim と独立）で、加えて Owner の明示 GO（Q3）。#759 の WebKit Gate は赤のままで、Owner が受容するか基盤対策を先に merge するかを #759 側で決める。B19 はその結果を待つだけで、独自の対応はしない。

## 2. 食材・レシピの重複検査（最新 main 基準）

### 2.1 Issue／PR 検索

`burrata`・`crudaiola`・`ブッラータ`・`ブラータ`・`rosemary`・`oregano`・`spinach`・`artichoke`・`ハーブ`（Issue と PR を別々に検索）。

- burrata／crudaiola を**専用に扱う Issue・PR は無し**。ヒットは #748（B18、Owner 決定コメントに burrata 記述）、#521（Multi-Sauce 計画）、#707、#183・#196（過去の docs）のみ。
- ハーブ 4 食材に関係する open Issue は **#417（Ingredient Icons 2.0 の追跡）**、#479（Topping Size Classes）、#436（Hint 5.0 L2）。実装 PR は #417 を参照する。
- **重複する実装 PR／Issue は無し**。ただし B19 専用の Issue は未作成（D9）。

### 2.2 食材の重複

| 候補 | 既存との重なり | 結論 |
|---|---|---|
| `burrata` | `ingredients.ts`・`lateCatalog.ts`・`ingredientTaxonomy.ts`・`toppingSizeClass.ts` のいずれにも**存在しない**。マスターカタログ（`data/recipes/ingredient_master_catalog.json`）にも無し | 新食材として追加可 |
| 他のチーズとの混同 | 既存チーズは mozzarella・fontina・feta・ricotta・ricotta-salata・cream-cheese・catupiry・goat-cheese・paneer・swiss-cheese ほか（`toppingSizeClass.ts` で `l`）。**burrata は既存の `pieceVisual` チーズ（feta-cubes・ricotta-mound・cream-cheese-block ほか）と形で区別する**（§3、案 C） | 混同は絵で解決（名前・色の重複ではない） |
| ハーブ 4 食材 | 既存 id を変更しない（絵のみ）。**現在 4 つとも `pieceVisual` なし。絵文字の共有: rosemary と artichoke が 🌱、oregano と spinach が 🍃**（`ingredients.ts` のコメントも「told apart by name / colour」） | id・保存・採点は不変。絵だけ専用 SVG に変更 |

### 2.3 レシピの重複（識別集合・Jaccard）

方法: `recipes.ts`（80）と `lateCatalog.ts`（8）の `requiredIngredients` の ingredientId 集合を抽出し、候補との完全一致・部分集合・上位集合・1 材料差・Jaccard を計算（`docs/reports/data/TETO_EXPANSION-BATCH-19_PREP_jaccard.json`）。B18 の 2 レシピ（#759 のレシピ構成）を加えた 90 件でも同じ計算を行いました。

候補の識別集合（matrix 行どおり、代用なし）:
- **pesto-burrata** = `pesto`・`olive-oil`・`burrata`・`fresh-tomato`（4）
- **pizza-alla-crudaiola** = `tomato-sauce`・`olive-oil`・`mozzarella`・`burrata`・`fresh-tomato`・`arugula`（6）

| 候補 | 完全一致 | 部分集合／上位集合 | 1 材料差 | 最大 Jaccard と近傍（main／B18 後で同じ） |
|---|---|---|---|---|
| pesto-burrata | なし | なし | なし | **0.333**（pesto-caprese・pesto-pollo・pesto-gamberi・pesto-trapanese）。基準 0.4 未満 |
| pizza-alla-crudaiola | なし | なし | なし | **0.429**（pinsa-romana〔late〕・jamon-serrano-pizza・grandma-pizza）、**＋バッチ内 pesto-burrata 0.429** |

- burrata を含む既存レシピは 0 件なので、**burrata が入るレシピは必ず新規集合**になります。発見判定は一意です。
- crudaiola の共有素材: pinsa-romana ＝ tomato-sauce・mozzarella・arugula、jamon-serrano ＝ 同上、grandma ＝ tomato-sauce・mozzarella・olive-oil、**pesto-burrata ＝ olive-oil・burrata・fresh-tomato（非スターター 3 つ）**。
- ⚠ **バッチ内の近傍（R2 preflight にない）:** pesto-burrata が crudaiola の 4 件目の近傍（0.429）になる。R2 の根拠はそのまま当てはまらないため、近傍ごとの根拠を **§2.3.1** に整理した。
- 回避策の評価（R2 §3.3 の再確認）: オイルを抜く／トマトソースを抜く案は、原典（matrix の 2 層）から離れるか jamon-serrano との類似をむしろ悪化させる（0.5）。pesto-burrata の 2 層（ペスト＋オイル）は Owner が採用済み。例外承認（このレシピ限り）が最も原典に近い、という R2 の結論は維持。
- 例外の枠: B18 の OD-B18-3（baingan 0.43）と同様、「**このレシピ限り**」「全体 0.4 基準・同一／部分集合／上位集合の禁止・Research 規則は不変」とし、`expansionBatch19.test.ts` に近傍 4 件を名前付きで固定する。

### 2.3.1 D2 — crudaiola の類似度例外：近傍 4 件ごとの根拠（改訂 2）

Owner D2: 「crudaiola 限定の類似度例外を**条件付き承認**。近傍 4 件との違いを文書化し、根拠が不足すれば再判断」。以下はこの条件に対する根拠表です（計算は `docs/reports/data/TETO_EXPANSION-BATCH-19_PREP_jaccard.json` の `d2Neighbours`）。スターター素材は tomato-sauce・mozzarella・basil（`ingredients.ts` で `unlockCondition` を持たないもの）。

crudaiola = {tomato-sauce, olive-oil, mozzarella, burrata, fresh-tomato, arugula}（6）。

| # | 近傍 | 共有素材 | 近傍にだけある | crudaiola にだけある | 対称差 | Jaccard | スターター除外 | 識別・体験上の違い |
|---|---|---|---|---|---|---|---|---|
| 1 | **pinsa-romana**（late、Pinsa 開のときのみ） | tomato-sauce・mozzarella・arugula | prosciutto-crudo | olive-oil・burrata・fresh-tomato | 4 | 0.429 | 0.2（共有 arugula 1） | ピンサ生地（`doughKind: material-multigrain-long-ferment`）、**arugula は POST_BAKE**、prosciutto 3、2 層ソースなし |
| 2 | **jamon-serrano-pizza** | tomato-sauce・mozzarella・arugula | prosciutto-crudo | olive-oil・burrata・fresh-tomato | 4 | 0.429 | 0.2（共有 arugula 1） | 生ハムの有無、ソースは tomato-sauce のみ（オイルなし）、チーズは mozzarella のみ |
| 3 | **grandma-pizza** | tomato-sauce・olive-oil・mozzarella | garlic | burrata・fresh-tomato・arugula | 4 | 0.429 | 0.2（共有 olive-oil 1） | **角型の天板焼き**（`panShape: "square"`／`pan: "tray"` の識別軸）、garlic 2、burrata なし。※ソース構造（tomato-sauce＋olive-oil の 2 層）は同じ |
| 4 | **pesto-burrata-pizza**（同一バッチ） | olive-oil・burrata・fresh-tomato | pesto | tomato-sauce・mozzarella・arugula | 4 | 0.429 | **0.6**（共有 3） | **主ソースが違う**（pesto の緑 vs tomato-sauce の赤橙。Reference 判定の対象ソース）、crudaiola は mozzarella と arugula を持つ。同じ step で同時解禁、同じ Research cohort（A／B） |

共通の事実: 4 件とも**同一・部分集合・上位集合・1 材料差は 0**（発見判定は素材集合で一意）。対称差は全て 4（1 材料差の基準 = 差 1 から十分離れている）。

#### 近傍ごとの充足判定

| # | 判定 | 理由 |
|---|---|---|
| 1 pinsa-romana | **充足** | R2 の根拠どおり（共有は starter 2＋非スターター 1、スターター除外 0.2）。加えて生地軸（ピンサ）と POST_BAKE の arugula が別軸。late 側で、Pinsa が閉じていれば近傍は 3 件に減るだけ |
| 2 jamon-serrano | **充足** | 同上。prosciutto の有無と、crudaiola 側の 3 素材（olive-oil・burrata・fresh-tomato）が別 |
| 3 grandma | **充足（注記つき）** | 共有の非スターターは olive-oil 1。**ソースの 2 層構造が同じ**点が最も近いが、grandma は天板（pan 軸）・garlic・burrata なしで別。pan 軸は `signature.ts` が観測する識別軸 |
| 4 pesto-burrata | **条件付き承認済み（Q1、2026-11-06）** | R2 の根拠（非スターター 1 素材・スターター除外 0.2）が**当てはまらない**。非スターター 3 素材を共有し（burrata・fresh-tomato・olive-oil）、同じ step・同じ cohort で並ぶ。構造上は安全（対称差 4、1 材料差なし）だが、**知覚上の近さ**が残る。下の追加根拠・緩和と **AC-8b（Research ヒントによる区別）** を条件に承認 |

#### pesto-burrata 近傍の追加根拠と緩和（Q1：C1〜C5 つきで条件付き承認、2026-11-06）

**Q1 で追加された受入条件:** Research のヒントで 2 レシピを合理的に区別できること（AC-8b、§5.2）。Hint 5.0 の SAUCE 段（every sauce）と CHEESE 段（every cheese）は、2 レシピで答えが異なる（pesto＋olive-oil と tomato-sauce＋olive-oil、burrata のみと mozzarella＋burrata）ため、**SAUCE または CHEESE の有料ヒント 1 段（`hint5Ladder.ts` の記載で各 10 Pitz）で区別できる**設計（P1 で合格基準として確定。無料ラベル・所持食材での区別は不要）。段の内容・表示・コストの実測は実装 PR のテストで確認する（本書では実行していない）。


- 区別軸は**主ソース**。pesto-burrata は pesto（緑）が Reference 対象、crudaiola は tomato-sauce（橙〜赤）。どちらも 2 本目は olive-oil で、**2 層の面の色が違う**（R2 は crudaiola のトマト＋オイル面が橙になると確認、pesto 面の見え方は実装 HV で確認）。
- 具材・チーズも違う（pesto-burrata は burrata のみ＋fresh-tomato、crudaiola は mozzarella＋burrata＋fresh-tomato＋arugula）。D7 により pesto-burrata に mozzarella は入らない。
- 両レシピは burrata の step で**同時に解禁**され、Research は「？？？ピザ A（ブッラータ）」「？？？ピザ B（ブッラータ）」の 2 件になる。**どちらがどちらかはソース・他素材から推理させる設計**（Hint は key-free で素材名を出さない）。これは B14 の moussaka＋bbq の同時解禁と同種で、混同ではなく**推理の対象**になる。
- 緩和（実装 PR の AC に入れる）: (a) 対称差 4 の回帰固定、(b) 4 件の近傍を名前付きでテストに固定、(c) HV で 2 件の Research と調理の区別を確認、(d) Research の監査（D6）で ladder 順・非正準順の影響を数える。

#### 例外承認の条件（条件付き承認の「条件」として固定する案）

| 条件 | 内容 |
|---|---|
| C1 | 対象は `pizza-alla-crudaiola` **のみ**。全体の 0.4 基準、同一／部分集合／上位集合の禁止、Research の規則は不変。将来のレシピへの一括承認ではない |
| C2 | 近傍は 4 件を**名前付きで固定**（上表）。5 件目が現れる、または 4 件のいずれかの Jaccard が 0.429 を超える、対称差が 4 を下回る場合は**例外の範囲外 → 再判断** |
| C3 | 4 件とも同一・部分集合・上位集合・1 材料差が 0（テストで固定。late 側は Pinsa 開閉の両方） |
| C4 | 近傍ごとの区別軸を `expansionBatch19.test.ts` のコメントと Result Report に記録する（上表） |
| C5 | 素材集合は matrix 行どおり（代用なし）。olive-oil・arugula・fresh-tomato を外して Jaccard を調整しない（外すと jamon-serrano との類似が 0.5 に上がる等、原典から離れる） |

> 【Rev 5 更新・2026-11-06】**将来リスク:** matrix 行 117 の `burrata-pizza-pizzadb-p10`（tomato-sauce・basil・burrata・olive-oil）が追加されると、crudaiola との Jaccard が 0.429（共有 tomato-sauce・burrata・olive-oil、union 7）で**近傍 5 件目**となり、C2 により再判断になる。B19 のスコープは変えない。

#### 再判断のトリガー（根拠不足とみなす場合）

- T1: 実装直前の main／カタログで、近傍が同一・部分集合・上位集合・1 材料差になった（B18 の rebase、他バッチの merge による）。
- T2: 近傍が 5 件以上になった、または C2 の数値が崩れた。
- T3: **AC-8b を満たせない**（SAUCE・CHEESE のどちらの有料ヒント 1 段でも 2 レシピを合理的に区別できない）、または Owner が実装 HV 後に pesto-burrata 近傍の根拠を不十分と判断した。
- T4: 実装 HV で pesto-burrata と crudaiola の区別（Research・調理・結果）が困難と判明した。
- T5: レシピの素材集合を変更する提案が出た（個数だけの変更は対象外）。
- 再判断になった場合の選択肢: (i) 例外を維持（追加の緩和策つき）、(ii) 素材集合の変更（原典から離れるため Owner の再承認が必要）、(iii) crudaiola を保留。**D8 により 2 レシピ維持が既定**なので、(iii) は Owner が明示した場合のみ。

#### 承認文案（B19 用に更新）

> **OD-B19-2（条件付き承認・Q1 で pesto-burrata 近傍を含め確定、2026-11-06）:** `pizza-alla-crudaiola` の Jaccard 0.429 を、このレシピ限りの例外として承認する。近傍は pinsa-romana・jamon-serrano-pizza・grandma-pizza・pesto-burrata-pizza の 4 件で、いずれも対称差 4、同一／部分集合／上位集合／1 材料差は 0。スターター除外の Jaccard は既存 3 件が 0.2、バッチ内 pesto-burrata が 0.6（主ソースの違いと推理設計で補う）。条件 C1〜C5 を満たす限り有効で、T1〜T5 のいずれかに該当した場合は再判断する。全体の 0.4 基準は変更しない。　**追加条件: Research ヒントで 2 レシピを合理的に区別できること（AC-8b）。**

### 2.4 Research ラベルへの影響（見込みと必要な監査）

- burrata のステップで解禁されるのは pesto-burrata と crudaiola の 2 件（必要な他の素材は全て既存）。cohort は {pesto-burrata, crudaiola} の 2 メンバーなので、**新規 2 件は文字付き（A／B）**になります（Research 表示例「？？？ピザ A（ブッラータ）」）。
- 既存レシピの文字は、**正準 ladder 順では動かない**はず（burrata は既存レシピに含まれない）が、非正準な取得順では共有素材（olive-oil・fresh-tomato・arugula・pesto・tomato-sauce・mozzarella）経由で変わりうる。R2 preflight の見込みは「正準順 0 件、非正準 23 件」（#759 HEAD `33bc275` 基準）。**この数値は本準備で再計測していません**（`researchLabelAudit.ts` が #759 にしか無く、main では実行できないため）。
- B18 の OD-B18-4 は「**将来のバッチで新たな既存レシピが影響を受ける場合は改めて監査と Owner Gate が要る**」と明記している。**Q2（確定）:** (a) **正準 ladder 順での意図しない既存ラベル変化は 0 件が必須**（1 件でも出たら停止して報告）。(b) **非正準の取得順で変わりうる既存ラベルは全件を列挙**（レシピ、取得順の条件、変更前→変更後）し、**1 件ずつ Owner の個別承認**を得る。B18 の「集合として一括承認」では足りない。(c) 承認されていない差分が残れば Gate 失敗（テストの固定集合は承認済みの項目のみ）。R2 preflight の見込み（非正準 23 件）は未再計測で、実装 PR で実数を確定する。

---

## 3. アイコン仕様

共通: Style Lock V2（`docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`）§2 の 64×64、透明背景、輪郭 2.4 基調、足元の影楕円、`id`／gradient／`<defs>` なし。**色はすべて仮の値**。表示サイズは 1.2em の箱（レイアウト上の占有 1em、`margin:-0.1em`）を基準に開始し、実寸の焼成後・RESULT で検証する（Owner 2026-11-06「Start at 1.2em」）。**id・保存・採点・size class・ladder は変更しない（描画のみ）**。

### 3.1 一覧

| 食材 | 現状（main） | 採用（Owner 承認 2026-11-06） | 候補ファイル | 提案する visual 名（仮） | size class | 実装 PR |
|---|---|---|---|---|---|---|
| rosemary | 🌱（`pieceVisual` なし）、family herb | **B**（2 枝） | `rosemary-B.svg` | `rosemary-sprigs` | `xs`（現状維持） | Icons PR |
| oregano | 🍃、family herb | **B**（乾燥フレークの小山） | `oregano-B.svg` | `oregano-flakes` | `xs` | Icons PR |
| spinach | 🍃、family **vegetable**、星ゲート 130⭐（step 51） | **A2**（濃い葉 2 枚＋明るい内縁＋葉脈） | `spinach-A2.svg` | `spinach-leaves` | `xl` | Icons PR |
| artichoke | 🌱、family **vegetable** | **A2**（断面 1/4＋明るい内縁） | `artichoke-A2.svg` | `artichoke-quarter` | `m` | Icons PR |
| ブッラータ `burrata`（新、D1） | 存在しない | **C**（裂け口・クリームが見える玉） | `burrata-C.svg` | `burrata-torn-ball` | `l`（チーズの前例: ricotta・feta などと同じ） | **B19 PR** |

- 「ハーブ 4 種」は Owner の通称です。**分類上のハーブは rosemary・oregano の 2 つで、spinach・artichoke は `vegetable`**（`ingredientTaxonomy.ts`）。絵文字の共有（🌱／🍃）を解消する対象という意味で 4 種に含めます。family の変更は不要・禁止（Hint 5.0 の人数に影響）。
- visual 名は**仮**です（実装 PR で `DedicatedIngredientVisual` の既存命名〔`cilantro-leaf`・`ricotta-mound` など〕に合わせて確定）。

### 3.2 実測の基準値（R2、Chromium 390×844、駒 2 個のうち小さい方の「見える面積／グレー面積(px²)」）

実装 PR の受入では、**この値を回帰の基準**にします（絶対値の再現ではなく、実寸での目視確認と同方向であること）。

| 食材 | 焼成前 | 焼成後 | RESULT | 備考 |
|---|---|---|---|---|
| rosemary B | 320・184 | 332・174 | 192・86 | 現行 🌱 は 200・33／208・152／129・22 |
| oregano B | 206・112 | 259・146 | 122・111 | 現行 🍃 は 178・58／337・248／103・48。**焼成後は現行の方がグレー面積が大きい**（146 < 248） |
| spinach A2 | 1025・440 | 1053・378 | 631・238 | **現行の絵文字（446／292）にはグレー面積が届かない**（Owner は承知のうえで A2 を承認、実装 HV で実寸確認） |
| artichoke A2 | 634・370 | 722・455 | 438・260 | A（前回）より焼成前・焼成後が改善、RESULT は同程度 |
| burrata C（リコッタ表示を差し替えて測定） | S1: 399・360／530・485／458・377 | S2: 397・355／527・471／458・359 | — | 面積の差は他案と ±10%。**案の決め手は目視の形の識別** |

### 3.3 実装上の確認事項（描画のみのため軽いが、漏れやすい点）

1. `DedicatedIngredientVisual`（`ingredients.ts` L27 付近の union）に visual を追加し、`IngredientGlyph.tsx` に描画を足す。**ハーブ 4 種と burrata が同じ 3 ファイル（`ingredients.ts`・`IngredientGlyph.tsx`・`App.css`）を触る**ため、PR は順番に分ける（§7）。
2. `App.css` の 1.2em グループ（L828–840 付近、`shiso-leaf` ほか 8 visual）に追加するか、個別ルールを設けるかを実測で決める。**#761 が同ファイルの `shiso-leaf` を個別ルールに変更中**なので、#761 の merge 後に rebase。
3. 絵文字の共有を解消した後、`ingredients.ts` の `emoji` は**テキストのフォールバック**として残す（`pieceVisual` がある食材の既存作法）。G18（絵文字・class symbol の一意性）テストが共有を許していた前提のコメント（"told apart by name / colour"）を更新する。
4. spinach は星ゲート 130⭐（step 51 の `starGates`）。E2E では**星 130 以上のセーブ**でショップ購入・トレイ・焼成後・RESULT・図鑑・ヒントを確認する。
5. burrata の色は `color` 属性（ショップ・図鑑の色味）にも使う。**仮の値**として実装し HV で調整。
6. 焼成後に消えにくくする `bakeRoastResistant` の付与は**今回提案しない**（R2 §5-3。必要性が未確認で、データ変更になる）。

---

## 4. 調理工程と新レシピの仕様（暫定・原典未確認）

### 4.1 共通の前提

- 工程は既存の **DOUGH → SAUCE → CHEESE → TOPPING → BAKE（→ CUT は任意）**。**新工程なし**。
- **すべての材料を焼く前に置く**（Owner 2026-11-06「All crudaiola ingredients are pre-bake」。pesto-burrata も matrix に後乗せの根拠なし）。`POST_BAKE` なし → FINISH 工程なし。FINISH でのチーズ対応（`TETO_FINISH-CHEESE_FUTURE-TASK`）は**別の将来タスクで、B19 は依存しない**。
- `bakeTarget` は汎用 Free Cooking 窓 **58–78**、`baseRewardPitz` 100、`lunchRush:false`、CUT なし、Hint は **key-free**（pesto-burrata／crudaiola とも）。
- 複数ソース（SAUCE ×2）は **grandma-pizza（#521）と同じ方式**: 主ソースだけ `RECIPE_SAUCE_PROFILES` に載せて Reference 判定し、2 本目の olive-oil は `requiredIngredients` に含めて「使ったかどうか」で判定する。`requiredIngredients` の順は **主ソース → 2 本目のソース → チーズ → 具材**（Rule W の予約素材とレガシー Hint 2.0 H4 の抜き出し素材を一致させる。B14 moussaka の教訓）。
- チーズが burrata だけのレシピは前例あり: **eggplant-ricotta-pizza**（ricotta が唯一のチーズ、olive-oil の PAINT_TEMPORARY）。`pieceVisual` を持つチーズのみで CHEESE 工程が成立する。

### 4.2 レシピ別

| 項目 | pesto-burrata | pizza-alla-crudaiola |
|---|---|---|
| matrix 行 | `pesto-burrata-pizzadb-p12`（ペストブラータピザ）、ソース「バジル → pesto」 | `pizza-alla-crudaiola-pizzadb-p8`（ピッツァ・アッラ・クルダイオーラ）、ソース「トマトソース → tomato-sauce」 |
| recipe id（D3、暫定） | `pesto-burrata-pizza` | `pizza-alla-crudaiola` |
| 日本語名（D3、暫定） | **ペスト・ブッラータピザ** | **ピッツァ・アッラ・クルダイオーラ** |
| 主ソース（PAINT、Reference 対象） | `pesto`（`recipeSauceProfiles.ts` に追加） | `tomato-sauce` |
| 2 本目ソース（PAINT_TEMPORARY、presence 判定） | `olive-oil` | `olive-oil` |
| チーズ | ブッラータのみ（**D7**: mozzarella を足さない） | mozzarella ＋ ブッラータ |
| 具材 | fresh-tomato | fresh-tomato・arugula |
| 暫定の個数（**ASSUMPTION**） | pesto 1／olive-oil 1／burrata 2／fresh-tomato 2 | tomato-sauce 1／olive-oil 1／mozzarella 2／burrata 2／fresh-tomato 2／arugula 2（非ソース 8＝8 スロットのリング） |
| ladder | **step 70 の key**（credited） | `ladderCredit:false`（porcini-pizza・grandma と同じ前例） |
| Research | cohort {pesto-burrata, crudaiola}、burrata が cohort key（文字 A／B） | 同左 |
| 例外 | なし（Jaccard 最大 0.333） | **Jaccard 0.429 の個別例外（D2 条件付き承認、§2.3.1）** |

- **個数は未確定の仮置き**です（R2 は pesto-burrata の例だけを示し、crudaiola の個数は決めていません）。Reference の 8 点リングとの整合、焼成の見え方は Preview HV で調整する前提で、実装 PR の本文に「暫定」と明記します。
- 説明文（`description`）は Anti-Oracle のため**調理時期・材料名を出さない**（既存レシピと同じ）。
- 2 つのレシピは同じ step で同時に解禁されます（B14 の moussaka＋bbq と同様の「同時解禁」）。Owner が既に承認した形ですが、報告に明記します。

### 4.3 新食材 burrata のデータ仕様（提案）

- `nameJa: "ブッラータ"`（D1）。matrix・一般の表記「ブラータ」は検索エイリアスとして残す提案（`ingredientSearchAliases.ts` の既存作法に合わせる。実装時に確認）。
- `category:"cheese"`、`placement:"scatter"`、`pieceVisual:"burrata-torn-ball"`（仮）、`unlockCondition:{minTotalStars:0}`、emoji は共有の 🧀（テキストのフォールバック）、**価格 T4（120／60 Pitz）、星ゲートなし**（ladder step 70 の単独素材）。
- `toppingSizeClass.ts`: `l`。`ingredientTaxonomy.ts`: チーズは行を持たない慣例（family 行なし）— 実装時に既存の cheese の扱いを確認。
- **ミスしやすい点:** ricotta／feta 等は `.pizza-cheese--glyph` の経路で描かれる（`App.css` L979 コメント）。burrata も同じ経路に載るので新しい描画基盤は不要。

---

## 5. 受入条件（Acceptance Criteria）

### 5.1 データ・識別（B19 実装 PR）

- AC-1 新食材は `burrata` の 1 つだけ。他の id・価格・size class・family を変更しない。
- AC-2 新レシピは 2 件。識別集合は §2.3 のとおり。**完全一致・部分集合・上位集合・1 材料差が 0**。
- AC-3 通常 ladder の step 1〜（B18 後の最終 step）が**凍結・不変**。新 step は末尾に 1 つ（B18 後なら 70）。late の導出番号は +1。`LATE_ENTITLEMENT_FLOORS` は変更しない。
- AC-4 pesto-burrata は `ladderCredit:true`（step の key）、crudaiola は `false`。`lunchRush:false`、CUT なし、key-free。
- AC-5 Jaccard: pesto-burrata は 0.4 以下。crudaiola は**近傍 4 件を名前付きで固定**した個別例外（Owner が承認した文面と一致）。global の 0.4 基準は変更しない。
- AC-6 すべての材料が焼く前（`applicationPhase` に `POST_BAKE` なし）。`lateCatalog.ts`・late の golden は変更しない。
- AC-7 pesto を主ソースとする 2 ソース・レシピで、**Reference 判定と `completionGate` が grandma と同様に働く**（pesto 版のガードテストを追加。既存の `multiSauce.guards.test.ts` は tomato-sauce 主の合成レシピ）。

### 5.2 Research・Hint・保存・採点

- AC-8 Research（Q2）: 新 2 件が「A／B（ブッラータ）」で出る（D1）。未発見レシピ名・材料の漏えいなし。**正準 ladder 順で既存レシピのラベル変化 0 件**（全 prefix、通常／late、Pinsa ON／OFF）。**非正準順の差分は全件を一覧化し、1 件ずつ Owner の個別承認を得る**（承認済みの項目だけをテストの固定集合に入れる。未承認の変化が 1 件でも残れば不合格）。
  - **差分の報告形式（P2）:** 非正準順の差分は、実装 PR の Result Report に表で記載する。列は **差分 ID（例: B19-LD-01）・既存レシピ・取得順（最後に入手した共有素材と、それ以前の順序）・変更前ラベル→変更後ラベル・文字なし→ありか否か**。Owner は ID ごとに承認／却下を返す。承認された ID だけをテストの固定集合に入れる。**未承認の差分が 1 件でも残る場合は Gate HOLD**（merge・次工程に進まない）。却下された ID は設計変更（実装の修正）か停止。
- **AC-8b Research ヒントによる 2 レシピの区別（Q1・P1）:** **SAUCE または CHEESE の有料ヒント 1 段**で、プレイヤーが pesto-burrata-pizza と pizza-alla-crudaiola を**合理的に区別**できれば合格。**無料ラベル（「（ブッラータ）」）や所持食材で区別できる必要はない**（同じ cohort の推理設計を保つ）。実装時の検証項目: (1) **Hint 5.0:** `buildHint5Ladder` で 2 レシピの SAUCE 段・CHEESE 段を比較し、少なくとも一方の段の答えが 2 レシピで異なり、その 1 段だけで一意に区別できること（期待: SAUCE は pesto＋olive-oil と tomato-sauce＋olive-oil、CHEESE は burrata のみと mozzarella＋burrata。**実測で確認し、期待と違えば AC-8b 不合格として報告**）。(2) **コスト:** 該当段の実コスト（`hint5Ladder.ts` の記載は各 10 Pitz）と、プレイヤーが支払える範囲か。購入手段・無料枠・既存の「購入済み事実」との整合（`discoveryHintFacts` への記録を含む）。(3) **表示内容:** 実際の Hint シートの表示（素材名か分類名か、2 本目の olive-oil の見え方）が、区別に足りる内容であること。HV（390×844）で実画面を確認。(4) **旧 Hint 経路:** `hints.ts` の per-recipe（2 ソース）で、主ソース→オリーブオイルの案内が pesto 版・tomato 版とも成立し、`hints.multiSauce.test.ts` の 2 ソース許可リストの追加を Owner に明示する。旧経路が Research では使われない場合は、その事実を Result Report に記録する。(5) **漏えいなし:** どのヒントも未発見レシピ名や、2 レシピのどちらかを断定する文言を出さない（Anti-Oracle、key-free を維持）。(6) HV で、ヒントを見た人が 2 レシピを取り違えないことを確認する。
- AC-9 Hint 5.0: ladder golden は**挿入のみ**（既存エントリ変更 0）。`alphaFamilyOnly`・DH4 audit の変化は理由を Result Report に記録する。
- AC-10 保存: schema v2 のまま。新 id の追加だけ。旧版セーブの読み込み・再保存（在庫・Dex・entitlement ledger）がバイト単位で保存される（`persistence.batch19.test.ts`）。
- AC-11 採点・Pitz・在庫・経済の既存仕様は不変。`referencePizza.ts` に 2 件のリングを追加するだけ。

### 5.3 見た目・UX（HV Policy 対象）

- AC-12 burrata 専用 SVG が、トレイ・ピザ上・焼成後・RESULT・ショップ・図鑑・ヒントで描かれ、feta・ricotta・cream-cheese・goat-cheese・mozzarella と**形で区別できる**（390×844／360×800）。
- AC-13 2 レシピを Shop NEW → 購入 → Research → ソース PAINT（2 層）→ チーズ → 具材 → 焼成 → 発見 → 図鑑まで通せる。2 層の面（トマト＋オイル）の見え方を確認。
- AC-14 横スクロールなし（390×844／360×800）、console error なし。長い名前「ピッツァ・アッラ・クルダイオーラ」が NEW RECIPE・図鑑で切れない。
- AC-15 HV 動画（390×844、Owner へ直接。**リポジトリに入れない**）と、変更前後のスクリーンショット（`docs/reports/screenshots/<task-name>/`）。iPhone Safari の PASS は **Owner が記録**する。

### 5.4 Icons PR（ハーブ 4 種）

- AC-I1 4 食材の `pieceVisual` と描画のみ。id・family・size class・価格・ladder・保存・採点が不変（差分が `ingredients.ts` の visual 追加、`IngredientGlyph.tsx`、`App.css` のみ）。
- AC-I2 トレイ（chip の寸法不変）・ピザ上・焼成後・RESULT・ショップ・図鑑・ヒントの実寸確認。近い系統（cilantro・parsley・basil・shiso・mint・arugula）と識別できる。
- AC-I3 oregano の焼成後と spinach の焼成後・RESULT の可視性を実寸で確認し、不足があれば**色の微調整だけ**で対処する（データ変更はしない）。

### 5.5 共通

- AC-X1 skip／retry／タイムアウト延長／assertion 緩和で通さない。既存テストの更新は件数 pin・step 番号・golden の挿入に限り、assertion の意味を弱めない。
- AC-X2 Pinsa ON／OFF の両方で Vitest が通る。typecheck／lint／build が通る。WebKit は CI のシャード全体で確認する。
- AC-X3 merge・Production ON・共有 Preview 更新は Owner の明示承認まで行わない。

---

## 6. テスト計画

### 6.1 実装前の scratch 測定（最初の作業。結果が Owner 判断に影響する）

1. **Research ラベル監査（必須 Gate、Q2・P2）**: #759 の `researchLabelAudit.ts` を使い、B19 前後の既存ラベル差を数える（正準順＋非正準の全パターン。予備: 乱数順 600 通り）。正準順で 1 件でも動けば**停止して報告**。非正準順の差分は**全件を ID 付きの一覧（レシピ・取得順・変更前後）にして Owner の個別承認を待つ**（承認前に実装 PR を進めない。未承認が残れば Gate HOLD）。
2. **2 ソースの pesto 主ガード**: 合成レシピまたは実レシピ案で、主ソース pesto＋olive-oil の `completionGate`・Reference・塗り判定が grandma と同様に成立するか。
3. **burrata のみのチーズ工程**: eggplant-ricotta-pizza と同様に Canvas のチーズ判定が成立するか。
4. **Jaccard 再計算**: 実装直前の main／カタログで、§2.3 の表を再現（`docs/reports/data/TETO_EXPANSION-BATCH-19_PREP_jaccard.json` と同じ手順）。
5. ladder 反映の安全確認: late OFF ビルドで挙動が従来どおり、late ON で全レシピが到達可能（B18 §10-2 と同じ）。

### 6.2 Vitest

| ファイル | 内容 |
|---|---|
| 新規 `expansionBatch19.test.ts` | 識別（完全一致／部分集合／上位集合／1 材料差 0）、Jaccard の名前付き固定（crudaiola の近傍 4 件、pesto-burrata の最大値）、ladder の step 凍結と新 step、credited／non-credit、key-free、Reference の点数、Rule W／H4 の一致、Hint の許可リスト、全材料が焼く前 |
| 新規 `persistence.batch19.test.ts` | 旧順序・在庫・Dex・entitlement ledger の保存、新 id の追加だけ |
| 新規（pesto 主の 2 ソース） | `multiSauce.guards` 相当の pesto 版 |
| 新規（Research ヒントの区別、AC-8b） | 2 レシピの Hint 5.0 の SAUCE 段・CHEESE 段の比較（少なくとも一方が異なり 1 段で一意）、段のコスト・表示内容の固定、旧 Hint 経路（`hints.ts`）の 2 ソース案内、漏えいなし、`hints.multiSauce.test.ts` の許可リスト追加 |
| `researchLabelAudit` 固定集合（`recipeBatchManifest.ts` に `B19_BATCH` ほか） | 正準順 0 件、承認済み非正準集合を固定 |
| `IngredientGlyph.test.tsx`／`IngredientPieceVisual.test.tsx` | burrata の描画、visual の網羅（ハーブ 4 種は Icons PR） |
| 既存テストの追従（assertion を弱めない） | `catalogLedger`、`recipeChapters`、`discoveryCatalog`（`*_PHASE2_BLOCKED_OWNER_APPROVED`）、`matcher`（`ownerApproved`）、`ingredients.test`、`ingredientShelf`、hint5 ladder golden（挿入のみ）、`alphaFamilyOnly`、DH4 audit |

実行: Pinsa ON と `TETO_PINSA_OFF=1` の両方で全体、`tsc -b`、`npm run lint`、`npm run build`。

### 6.3 E2E

- 新規 `e2e/b19.spec.ts`（Chromium 390×844／360×800、WebKit は CI）: 2 レシピを購入 → Research（漏えいなし）→ 2 層ソース → チーズ → 具材 → 焼成 → 発見 → 図鑑。burrata の絵が各面で出る。横はみ出しなし。
- 関連 spec の回帰: `b18`、`b17`、`b16`、`new-bbq`、`late4`、`cooking-screen-sideways`（#765）、`viewport-1screen`、`layout-contract`。
- Icons PR: 4 食材の代表 E2E（`issue-758-shiso.spec.ts` と同型。em 比率、chip の寸法、chip 内に収まること、近接 piece との重なり、横スクロールなし）。spinach は星 130 以上のセーブ。

### 6.4 HV（Human Verification）

- UI 変更（アイコン・新レシピ）なので `TETO_HUMAN-VERIFICATION-POLICY.md` の対象。**本準備（docs-only）は対象外**（Policy の「docs-only の変更」）。
- B19 PR と Icons PR それぞれで、390×844 の HV 動画（人の速さ、Owner へ直接。repo に入れない）と before／after スクショ（`docs/reports/screenshots/<task-name>/`）。iPhone Safari の実機確認は Owner の判断（PASS／FAIL／waived）。
- 共有 Preview は使わない。独立した確認ページ（非公開 Artifact）か、Owner 承認済みの方法に限る。保存データ切り替えの警告を明記。

---

## 7. 実装順序と依存関係

### 7.0 実装開始条件・claim・競合の確認（改訂 3、2026-11-06 時点。Q3・Q4 反映）

#### claim の状況（Issue #748 の全 7 コメントとコメント本文の claim ブロックを確認）

| claim | 保持者 | 対象 | 期限 | 状態 |
|---|---|---|---|---|
| #748 本文（teto-claim:v1） | B18 セッション（`session_013m8Cb66Bu5f1XXHC2xCiLL`） | `recipes.ts`・`ingredients.ts`・`lateCatalog.ts`・`discoveryLadder.ts`・`referencePizza.ts`・`ingredientTaxonomy.ts`・`toppingSizeClass.ts`・`__golden__/**`・`docs/*BATCH-18_*` | 2026-11-18T00:00Z | 初回 claim（更新済みのため参考） |
| #748 コメント 6632087637（2026-11-04） | 同上 | 同上 | 2026-11-18T00:00Z | 更新により置換 |
| **#748 コメント 6650377722（2026-11-05 05:17 UTC、最新の claim）** | 同上 | 上記＋`e2e/b18.spec.ts`・`e2e/new-bbq.spec.ts`・`docs/reports/screenshots/b18/**` | **2026-11-19T00:00:00Z** | **有効**。`pr` は null のまま（#759 は claim ブロックに未記入）。解放（`released:true`）の投稿は確認できない |
| #758（`src/App.css`、e2e、docs） | #761 のセッション | `src/App.css`・`e2e/issue-758-shiso.spec.ts` ほか | 2026-11-08（#761 の Result Report の記載） | 有効（本書では #758 のコメントを直接読んでいない。PR #761 の Result Report からの引用） 【Rev 5 更新・2026-11-06】**release 済み**（#758 コメント 6679761024、2026-11-06T07:35:47Z） |

- 他の Owner 決定コメント（6650593172、6651668675、6656496881、6663697601、6673566588）には claim ブロックが無い。R2（6673566588）は「現在の claims が解放されてから」「refresh main/claims」を実装の前提としている。
- claim は**警告のみで、ブロックではない**（SESSION-OPERATIONS §1）が、B19 は `recipes.ts`・`ingredients.ts`・`discoveryLadder.ts` などの **HOT ファイル**を #759 と共有する。**期限（2026-11-19）は #759 の merge 時期次第で超える可能性がある**（**Q4: #759 が未 merge のまま claim が失効しても、B19 は #759 の merge 前に着手しない**）。B18 セッションが claim を更新するか解放するかは本書の範囲外。
- B19 の claim は #759 merge 後に新しい Issue（D9）へ投稿し、`dependsOn:[759]`、`pr` を記入、HOT 重なりのある PR との merge 順を明記する（§7.4）。

#### 競合する open PR（2026-11-06 に一覧取得）

- 変更ファイル一覧を取得して確認したのは **#759 と #761**。他は一覧の題名・更新日による判断で、`src/data/*` を触る見込みの open PR は #759 のみ（Steam／DRIZZLE／docs は題名どおり別領域）。**厳密な重なりは Owner Gate（dry-run）の実行で確認**してください。
- #759: B18 の本体。`recipes.ts`・`ingredients.ts`・`lateCatalog.ts`・`discoveryLadder.ts`・golden ほか 94 ファイル。**B19 と HOT 重なり**（だから merge 後）。
- #761: `src/App.css` の `shiso-leaf` ルール。B19 のレシピ・データとは重ならない。ハーブ／ブッラータの描画補正が `App.css` を触る場合のみ、#761 の merge 後に rebase。
- #763・#762・#757・#756（Steam Lab）、#746（DRIZZLE）、#738（Steam S3）、#753・#751・#747（docs）: B19 の予定ファイルと重ならない。

#### 実装開始条件（すべて満たしたときに着手）

| # | 条件 | 現状（2026-11-06） |
|---|---|---|
| S-1 | **#759 が Owner の承認で merge されている**。**Q4: #748 の claim の期限・解放状況にかかわらず、merge 前には実装しない**（iPhone Safari HV の PASS 判定〔指示で報告済み〕と最終 merge 承認を含む） | **未充足**（2026-11-06 の Fresh Audit: Draft／HOLD・未 merge・WebKit Gate 赤〔Owner は PASS 扱いにしない〕） 【Rev 5 更新・2026-11-06】**充足**（#759 merged、main `785d7956`。main の WebKit E2E run 42223996134 は SUCCESS と Owner が確認） |
| S-2 | #760・#765 が merge 済み（Owner 指示 2026-11-06）。#761 も merge 済み | **充足**（#760・#765 は `fa67c72`、#761 は `c308a3f` に含まれる） |
| S-3 | 他セッションの claim が B19 の予定ファイルと重ならない（#748 の claim は **S-1 とは独立**：S-1 が満たされない限り、claim が失効・解放されても着手しない。S-1 の後に、解放・失効を確認する） | **未確認**（B18 の claim が 2026-11-19 まで有効、解放の投稿なし） 【Rev 5 更新・2026-11-06】**未充足のまま**（#748 のコメント 6650377722 が有効、解放の投稿なし。期限 2026-11-19） |
| S-4 | B19 用 Issue を起票済み（D9）、claim を投稿済み | 未着手（#759 merge 後に実装セッションが行う） |
| S-5 | 最新 `main` で、ladder step・件数・Jaccard・Research 監査・Hint を**再検証**（§6.1） | #759 merge 後に実施 |
| S-6 | D2 の条件 C1〜C5（Q1 で確定）を実装に反映し、Research ラベル監査の結果を Owner が確認し、**非正準差分を ID ごとに個別承認**している（Q2・P2。未承認が残れば Gate HOLD） | 実装前の scratch 測定の後に実施 |
| S-7 | **Owner が実装 GO を明示する（Q3、必須）**。条件が揃っても自動では着手しない | 未取得 |
| S-8 | ハーブ 4 種の Icons PR は、S-1・S-3 に加えて Owner 承認（D5）。ブッラータの SVG は B19 の PR | 同上 |

禁止（B19 の全期間）: merge、Production ON、共有 Preview の更新は、Owner の明示承認なしに行わない。

### 7.1 順序

```
[今] 本準備 (docs-only)  ──Owner 判断 D1〜D9・Q1〜Q4 確定済み──┐
                                                  │
G0  #759 (B18) の Owner merge 承認 → merge                    ← 唯一の未充足の前提 (Q4)
    └ #760・#765 は main に取り込み済み
    └ #761 は merge 済み (c308a3f)
    └ #748 の claim の解放・失効、他 claim の再確認（S-3。claim は G0 の代わりにならない）
    └ Owner の明示 GO (Q3)
                                                  │
S1  最新 main に更新 → B19 Issue 起票（D9）→ claim 投稿 → 重複検査・step 番号・件数の再計算
S2  scratch 測定（§6.1）→ 差が出たら Owner に提示して停止
S3  PR-I  Icons 2.0 ハーブ 4 種（描画のみ）          ← B19 と独立。S4 の前でも後でもよい
S4  PR-B  B19: burrata（＋専用 SVG C）＋ 2 レシピ＋ step 70
S5  CI（Pinsa ON/OFF、WebKit 全シャード）、最新 HEAD の Codex レビュー、Owner HV → merge 判断
```

- **PR-I と PR-B は同じ 3 ファイル（`ingredients.ts`・`IngredientGlyph.tsx`・`App.css`）を触る**ため、同時に出さず**順番に**進める（後の PR が rebase）。どちらを先にしてもよいが、**PR-I を先に推奨**（描画のみで ladder・Research に影響せず、PR-B の rebase 範囲が小さい）。PR-B は `recipes.ts`（HOT）・`PROJECT_HANDOFF.md`（HOT）を触るので、他の PR との merge 順を claim に明記する。
- D8 により 2 レシピ維持。縮小案（burrata＋pesto-burrata のみ）は採用しない。D2 の再判断トリガー（§2.3.1 T1〜T5）に該当した場合のみ、Owner の判断で再検討する。

### 7.2 依存関係表

| 依存 | 種別 | 理由 |
|---|---|---|
| #759 merge → B19 | **必須（ブロッカー）** | step 番号（70）、`researchLabelAudit.ts`、`B18_BATCH`、cilantro の昇格が前提。Owner の順序指示 |
| #760・#765 → B19／Icons | 充足（main 取り込み済み） | `IngredientGlyph.tsx`・`App.css` の競合回避 |
| #761 → App.css の補正 | **充足**（merge 済み、`c308a3f`） | 補正が必要なら `c308a3f` を含む main から開始 |
| Owner の明示 GO（Q3）→ B19 実装 | **必須** | D1〜D9・Q1〜Q4 は確定済み。S-1〜S-6 が揃った後に GO を取る |
| Owner 承認（Icons の最終選択を含む）→ Icons PR | 必須 | 現状は「設計候補の承認」で、実装マージの承認ではない |
| FINISH チーズ拡張 → B19 | **依存しない** | 全材料が焼く前（Owner 承認） |
| Steam #756／#757／#763、DRIZZLE #746、Fry #749 | 干渉なし | 触るファイルが異なる。ただし claim の再確認は S1 で毎回行う |

### 7.3 見積りとリスク

- 変更ファイル（B19 PR、予定）: `recipes.ts`、`ingredients.ts`、`discoveryLadder.ts`、`discoveryCatalog.ts`、`recipeSauceProfiles.ts`、`recipeHintRoles.ts`、`hints.ts`（2 ソースの missing 文面）、`referencePizza.ts`、`orders.ts`、`ingredientTaxonomy.ts`／`toppingSizeClass.ts`、`IngredientGlyph.tsx`、`App.css`（必要な場合）、`recipeBatchManifest.ts`、golden JSON、テスト、docs、`PROJECT_HANDOFF.md` addendum（HOT）。
- 主なリスク: (1) 非正準順の Research ラベル変化（監査と Owner Gate が必須）、(2) pesto 主の 2 ソースが未検証（テストなし）、(3) crudaiola の例外根拠（D2 の条件付き承認。pesto-burrata 近傍は Q1 で C1〜C5 つき承認済み。AC-8b を満たせない場合は T3 で再判断）、(4) 個数・窓・色が暫定、(5) #759 の merge タイミング（遅れれば全体が遅れる）、(6) 2 ソースの Hint 文面（`hints.ts` に grandma 専用のエントリがある。pesto 版の文面が必要）。

### 7.4 claim 文案（実装セッション用。本ブランチでは投稿していません）

```
<!-- teto-claim:v1 {"session":"<session id>","issue":<B19 issue>,"pr":null,"branch":"<branch>",
  "files":["src/data/recipes.ts","src/data/ingredients.ts","src/data/discoveryLadder.ts","src/data/discoveryCatalog.ts",
  "src/data/recipeSauceProfiles.ts","src/data/recipeHintRoles.ts","src/data/hints.ts","src/data/referencePizza.ts",
  "src/data/orders.ts","src/data/toppingSizeClass.ts","src/data/ingredientTaxonomy.ts","src/components/IngredientGlyph.tsx",
  "src/logic/catalog/testSupport/recipeBatchManifest.ts","src/logic/discovery/__golden__/**","e2e/b19.spec.ts",
  "docs/reports/TETO_EXPANSION-BATCH-19_*","docs/decisions/TETO_EXPANSION-BATCH-19_*","docs/reports/screenshots/b19/**"],
  "dependsOn":[759],"expires":"<最大 14 日>"} -->
```

---

## 8. Owner 判断の状況

### 8.1 確定済み（D1〜D9、2026-11-06）

§0.1 の表のとおり。本書の該当箇所に反映済みです。

### 8.2 運用の提案（P1・P2）— 承認済み（2026-11-06）

| # | 内容 | 状態 |
|---|---|---|
| **P1** | AC-8b の合格基準: SAUCE または CHEESE の有料ヒント 1 段で合理的に区別できれば合格。無料ラベル・所持食材での区別は不要。Hint 5.0・旧 Hint 経路・表示内容・コストを実装時に検証 | **承認**（§5.2 AC-8b に反映） |
| **P2** | 非正準順序の Research ラベル差分は、1 件ごとに ID・レシピ・取得順・変更前後を Result Report に記載し、Owner の個別承認を得る。未承認差分が残る場合は Gate HOLD | **承認**（§5.2 AC-8 に反映） |

本書時点で、Owner への**未回答の確認事項はありません**。実装の開始条件は §7.0 のとおり（**#759 の merge**、Owner の**明示 GO**、claim・競合の確認など）。この方針は変更していません。

### 8.3 D1〜D9 に関する補足（確認ではなく提案）

- D3 の id・日本語名は「暫定」のまま実装し、実装 PR の本文とコードコメントに暫定と明記する（B16〜B18 の作法）。
- D4 の個数（§4.2）は R2 preflight の例示を出発点にした仮置きで、Preview HV の後に調整する。
- D5: ハーブ 4 種の PR は B19 より先に出すことを推奨（§7.1）。順序の最終判断は Owner。いずれも #759 の merge 後で、実装には別途 Owner の明示 GO が要る（Q3 は B19 について確定。ハーブ PR の GO も同様に取る提案）。

---

## 9. 本準備で実施したこと／していないこと

**実施（初版）:** Issue #748 の全コメント・PR #759／#761 の変更ファイル・R2 の 2 つの Result Report・FINISH チーズの将来タスク文書の読み取り。`recipes.ts`／`lateCatalog.ts` からの識別集合の抽出と Jaccard 計算（`docs/reports/data/TETO_EXPANSION-BATCH-19_PREP_jaccard.json`）。`ingredients.ts`・`toppingSizeClass.ts`・`ingredientTaxonomy.ts`・`recipeSauceProfiles.ts`・`App.css` の現状確認。Issue／PR の検索と open PR の一覧確認。

**実施（改訂 2）:** Owner 判断 D1〜D9 の反映。D2 の近傍 4 件の共有素材・対称差・Jaccard・スターター除外値の再計算（JSON の `d2Neighbours`）と、`jamon-serrano-pizza`・`grandma-pizza`・`pinsa-romana` の素材・pan／dough 軸の確認。#748 の全コメントの claim ブロックの再確認、`origin/main`（`fa67c72`）・PR #759（HEAD `d9679e6`）・PR #761（HEAD `e96318c`）の再確認。実装開始条件（§7.0）の明文化。

**実施（改訂 3）:** GitHub の Fresh Audit（`origin/main`、#761・#759 の状態と check runs、#759 の最新コメント、#748 のコメント、open PR 一覧）。Q1〜Q4 の反映と、関連する AC・テスト計画・開始条件・競合表の整合性確認（旧版の確認事項の記号は Q1〜Q4 に統一）。

**実施（改訂 4）:** P1・P2 の追記のみ（AC-8・AC-8b、§0、§0.2、§6、§7.0 の S-6、§8.2）。GitHub の再取得・コード確認・検証は行っていない（改訂 3 の Fresh Audit の内容が最新）。

**未実施（明示）:** テストの実行（docs-only のため `src/` 無変更）／#759 の検証のやり直し／Research ラベル監査の再計測／画像・SVG の再測定（R2 の値を引用）／iPhone Safari の確認／#748 の claim の更新・解放（B18 セッションの権限）／claim・Issue・コメントの投稿（D9 の Issue は #759 merge 後）／#758 のコメントの直接確認／#759 の iPhone HV PASS の GitHub 上の記録の取得（指示を根拠とした）／全 open PR の変更ファイル一覧の取得（#759・#761 のみ）／食材・レシピの実装／Production ON／共有 Preview 更新／merge。

**注意:** R2 の SVG 候補・画像は **未 merge の 2 ブランチ**にあります。実装 PR では必要なファイルだけを移し、無関係なファイルを持ち込まないでください（Owner 2026-11-05 の指示）。本書の数値のうち B18 反映後の件数・step は #759 の Result Report からの引用で、本環境では検証していません。
