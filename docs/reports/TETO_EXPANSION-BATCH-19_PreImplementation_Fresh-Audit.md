# Expansion Batch 19 — 実装前 Fresh Audit（docs-only）

**種類:** docs-only。`src/`・`e2e/`・CSS・JSON・SVG・テストは変更していません。PR 作成・merge・Production ON・共有 Preview 更新・既存 PR ブランチへの push・claim の取得／変更は行っていません。実装は開始していません。
**ブランチ:** `claude/teto-pizza-batch-19-audit-u2ylym`（`origin/main` `785d7956` から作成。作業ツリーは clean を確認）。
**既存資料との関係:** Batch 19 Prep Rev 4（`claude/teto-pizza-batch-19-prep-xvizrg` の `9903b33`、`docs/reports/TETO_EXPANSION-BATCH-19_Prep.md`）と R2 Owner 決定記録（`claude/r2-owner-decisions-docs-8auzii` の `2f29318`）が詳細仕様の権威。**本書はそれらを再掲せず、2026-11-06 時点の差分・再計測・矛盾点・判定だけを書く。**
**限界:** 実装コードの実行（vitest・E2E）はしていません。件数・Jaccard は `recipes.ts`／`lateCatalog.ts` の静的解析（§4）。「実装時に実測する」と書いた項目は未測定です。原典 pizzadb.jp は未確認で、個数・窓・価格・色はすべて GAMEPLAY ASSUMPTION。

---

## 1. Audit 日時と main SHA

| 項目 | 結果 |
|---|---|
| Audit 日時 | 2026-11-06 13:27 UTC（GitHub／`git fetch` で取得） |
| `origin/main` | **`785d7956b42eac97e42dbd138818262a16c0a91c`**（`feat(recipes): Batch 18 …（#759）`）。直前は `8210d66b`（#768）、`c308a3f7`（#761） |
| PR #759（Batch 18） | **Squash merge 済み**（`merged_by: perusonao`、`merged_at 2026-11-06T13:15:08Z`、HEAD `c533a4f1`）。依頼文の「merge commit `785d7956`」と一致 |
| main の Deploy（run 42223996114） | **success**（13:15–13:18Z） |
| main の WebKit E2E（run 42223996134、`785d7956`） | **進行中（未完了）**。classify・layout-chromium・Layout Contract Gate は success、WebKit 6 shard は実行中（13:19Z 時点）。**結果は未確定**。直近の完了済み 2 回（`8210d66b`、`c308a3f7`）は success |
| 作業ツリー | 他タスクの変更なし（`git status` clean）。監査用ブランチは `origin/claude/teto-pizza-batch-19-audit-u2ylym` が `785d7956` で存在し、本レポートのみ追加 |

**重要:** Prep Rev 4 と R2 決定記録の「#759 未 merge」は**陳腐化**しています。Q4（#759 merge 前は実装しない）の条件は**充足**。

---

## 2. 確認した資料・Issue・PR

| 種別 | 対象 | 取得結果 |
|---|---|---|
| 指示 | `CLAUDE.md`、`docs/decisions/TETO_SESSION-OPERATIONS_1.0.md`（§1 claim）、`docs/PROJECT_HANDOFF.md`（先頭） | 読了。PROJECT_HANDOFF は 2026-09-18 版が先頭に残り、Batch 18 時点の更新は未確認 |
| Prep | Batch 19 Prep Rev 4（`9903b33`） | **main には無い**（ブランチのみ）。内容は §3〜§5 に反映 |
| Owner 決定 | `docs/decisions/TETO_ICONS-HERBS-BURRATA_R2_OWNER-DECISIONS_2026-11-06.md` | **main には無い**。`claude/r2-owner-decisions-docs-8auzii`（`2f29318`）のみ。**現在も有効（Owner 決定 D1〜D9 の内容）だが §2 の状態表は陳腐化**（§3.2） |
| Issue #748 | コメント 7 件を全読 | Owner 決定（B18 OD-B18-1〜4、HV seed、Parallel Investigation 2026-11-05 16:45Z、R2 preflight 2026-11-06 00:48Z）。claim 2 件（§7） |
| PR #759 | 取得 | merged（上記） |
| Issue #764／#758／#394 | 取得 | §7 |
| open PR | 一覧（30 件、更新順） | #738・#746・#747・#751・#753・#756・#757・#762・#763 ほか。`src/data/*` を触る open PR は**無し**（確認できた範囲、§7） |
| main 上の burrata／crudaiola | `git grep` | `src`・`e2e` に **0 件**（docs のみ。§4.4 で重要な発見） |
| Actions | main の Deploy／WebKit E2E | §1 |

---

## 3. Batch 19 の確定仕様と未確定事項

### 3.1 確定（Owner 決定または Prep Rev 4 の Owner 承認事項）

| 項目 | 内容 | 出典の確認 |
|---|---|---|
| 内容 | 新食材 1（`burrata`・ブッラータ・cheese）＋新レシピ 2＋通常 ladder step 1。**新しい調理工程なし**（SAUCE×2→CHEESE→TOPPING→BAKE、全食材を焼成前に配置） | R2 決定 D7・D8、Prep §0 |
| burrata の SVG | **案 C**（上が裂けてクリームが溢れる玉）。専用 SVG は **Batch 19 の PR に入る** | R2 決定 D5、#748 comment 6673566588 |
| ハーブ 4 種 | rosemary B／oregano B／spinach A2／artichoke A2、初期 **1.2em**。**別 PR**・#759 merge 後（描画のみ） | R2 決定 D1–D4 |
| pesto-burrata | ペスト＋オリーブオイルの 2 層、主ソース pesto | R2 決定 D8 |
| crudaiola | トマトソース＋オリーブオイルの 2 層、全食材焼成前、late カタログに入れない。**Jaccard 0.429 をこのレシピ限り例外承認** | R2 決定 D6・D7 |
| 開始条件 | #759 merge 前は実装しない（Q4）／**Owner の明示 GO 必須**（Q3） | Prep Rev 3 |
| 受入 | AC-8（正準順で既存ラベル変化 0 件、非正準差分は全件列挙＋1 件ずつ個別承認、未承認 1 件で Gate HOLD）、AC-8b（SAUCE または CHEESE の有料ヒント 1 段で 2 レシピを合理的に区別） | Prep Rev 4 の P1・P2 |

### 3.2 矛盾・陳腐化（Owner 確認または文書修正が必要）

| # | 内容 | 影響 |
|---|---|---|
| X1 | **R2 決定記録の D 番号と Prep の D 番号が別物。** R2: D6＝crudaiola 例外、D7＝crudaiola 2 層、D8＝pesto-burrata 2 層、D9＝FINISH チーズ保留。Prep: D2＝crudaiola 例外、D7＝pesto-burrata は burrata のみ、D8＝2 レシピ維持、D9＝#759 後の Issue 起票承認 | 実装 PR・テストコメントで「D6」等を引くと取り違える。**番号でなく内容で引用する**ことを推奨 |
| X2 | Prep の D1（名称「ブッラータ」）・D3（暫定 id・日本語名）・D4（個数・窓・価格・色は暫定実装可）・D7（pesto-burrata に mozzarella を入れない）・D9（Issue 起票承認）は、**GitHub 上の Owner 決定コメントでは確認できなかった**（#748 にあるのは 2026-11-05 16:45Z と 2026-11-06 00:48Z の 2 件のみ）。Prep はこれらを Owner の指示（チャット）としている | 私は**独立に検証できない**。実装前に Owner が #748 等に記録するか、Prep の記述を権威として承認するか |
| X3 | Prep・R2 決定は**どちらも main に無い**（未 merge のブランチ上）。実装セッションが「SSOT を読む」手順（CLAUDE.md）で見つけられない | docs-only の取り込み PR（別途）が必要。本監査は PR を作らない |
| X4 | R2 決定 §2.1 は「#759 open／Draft」。実際は merged | §1 のとおり更新が必要（実装前に docs 更新） |
| X5 | 通常 ladder step 番号：Prep は「B18 後は burrata が step 70」。#759 が merged なので**想定どおり 70**になる見込み。ただし**未実測**（実装時に再計算） | Prep の警告どおり、step・件数は実装時に再計測 |

### 3.3 未確定（Owner 判断または実装時の実測が必要）

- burrata の個数・価格・サイズクラス・焼成窓・色（GAMEPLAY ASSUMPTION、Prep D4 に依存、X2）。
- 実装時の Research ラベル全数監査の結果（正準順 0 件、非正準順の列挙）。
- AC-8b の実測（Hint 5.0 の SAUCE／CHEESE 段で 2 レシピが区別できるか）。
- pesto を主ソース、olive-oil を副ソースとする Reference／完成判定の挙動（既存の olive-oil 副ソース例：grandma-pizza〔presence-only、`referencePizza.ts`〕）。**pesto 主ソース＋oil 副の組は既存に無い**ため、実装時に先例テストの流用可否を確認。
- 実機（iPhone Safari）での burrata の視認性（HV）。

---

## 4. 重複・Jaccard 監査結果

### 4.1 方法
`src/data/recipes.ts`＋`src/data/lateCatalog.ts` から `requiredIngredients` の ingredientId 集合を静的に抽出（**90 件＝Batch 18 反映後の main と一致**）。候補は matrix 行どおり（代用なし）。

### 4.2 結果（main `785d7956`）

| 候補 | 集合 | 最大 Jaccard と近傍 | 同一／部分／上位／1 材料差 |
|---|---|---|---|
| pesto-burrata-pizza | pesto, olive-oil, burrata, fresh-tomato | **0.333**（pesto-caprese・pesto-pollo・pesto-gamberi・pesto-trapanese、対称差 4） | **0 件** |
| pizza-alla-crudaiola | tomato-sauce, olive-oil, mozzarella, burrata, fresh-tomato, arugula | **0.429**（jamon-serrano-pizza・grandma-pizza・pinsa-romana、対称差 4） | **0 件** |
| （バッチ内） | pesto-burrata ↔ crudaiola | **0.429**（対称差 4。共有 olive-oil・burrata・fresh-tomato） | — |

- **Prep の値を Batch 18 反映後の実カタログで再現しました**（前回は B18 を想定で足した計算）。近傍・値は Prep と同一。
- 例外は R2 決定 D6（crudaiola のみ）＋Prep Q1（pesto-burrata 近傍 4 件目に C1〜C5）で既に承認済み。**近傍は名前付き 4 件固定。5 件目、または 0.429 超・対称差 4 未満で再判断。**
- 全体 0.4 基準・同一／部分集合／上位集合の禁止・Research 規則は不変。**pesto-burrata は 0.4 未満で例外不要。**

### 4.3 判定
**Jaccard 判定：条件付き承認済みの範囲内（新たな違反なし）。** ただし例外は Owner が「根拠不足なら再判断」とした条件付きであり、AC-8b を満たせることが前提（T3）。

### 4.4 本監査の新発見 — 将来の近傍増加リスク
matrix には burrata を使う**別レシピ**が READY で残っています（`burrata-pizza-pizzadb-p10`＝tomato-sauce＋basil・burrata・olive-oil、行 117）。Progression 2.0 の設計資料（`TETO_PROGRESSION2_PHASE2_UNLOCK-GRAPH.md` ほか）には **burrata を「step 11・mid・星ゲート」で解禁する旧計画**も残っています（現行の通常 ladder は別方式）。
- `burrata-pizza` を将来足すと crudaiola との Jaccard は **0.429**（共有 tomato-sauce・burrata・olive-oil、union 7）で、**例外 C2「近傍 5 件目」に該当し再判断になる**。
- 影響：Batch 19 のスコープは変えない。**Owner は「burrata-pizza を将来入れる可能性」を承知のうえで crudaiola 例外を維持するか**を確認（§10）。
- 旧 Progression 2.0 の burrata 解禁計画は現行の ladder 方式と矛盾する記述として残る（実装根拠にしない。X6）。

### 4.5 食材の重複
`burrata` は `ingredients.ts`・`lateCatalog.ts` に**存在しない**（`src`・`e2e` で 0 件）。既存チーズとの機能的重複なし（mozzarella 等と別 id、`cheese` カテゴリ）。**区別は絵で解決**（§6）。

---

## 5. Research／Hint／Cooking Steps への影響

| 領域 | 判定 | 根拠・条件 |
|---|---|---|
| Cooking Steps | **新工程なし** | 全食材焼成前。FINISH・後乗せ・下ごしらえ・生地不使用（R2 D7、D9＝FINISH チーズは保留）。arugula は crudaiola では焼成前（既存の jamon-serrano 等は late／POST_BAKE の扱いがあるため、**実装時に arugula の配置工程が「焼成前」で既存テストと矛盾しないか確認**） |
| 2 層ソース | 既存機構を流用可の見込み | olive-oil 副ソース先例は多数（grandma・boscaiola 等）。**pesto 主＋oil 副**は先例なし（§3.3） |
| Research | **必須 Gate（AC-8）** | 解禁は「？？？ピザ A／B（ブッラータ）」の 2 件。正準 ladder 順で既存ラベル変化 **0 件必須**。非正準順は B15（19）・B16（4）・B17（18）・B18（39）の前例どおり**発生し得る**ため、全件列挙＋**1 件ずつ個別承認**（B18 の「集合承認」より厳格）。未承認が 1 件でも残れば Gate HOLD。B18 の `researchLabelAudit.ts` が main にあり**再利用できる** |
| Hint | **AC-8b を実測必須** | Hint 5.0 の SAUCE 段（pesto＋oil vs tomato-sauce＋oil）または CHEESE 段（burrata のみ vs mozzarella＋burrata）の有料 1 段で区別できること。無料ラベル・所持食材での区別は不要（P1）。旧 Hint 経路・表示内容・コストも確認。**未実測** |
| 保存／Dex／Inventory | 影響小の見込み | 新 id 追加のみ。既存 id・保存 schema は不変の想定。B18 の `persistence.batch18.test.ts` 方式（旧セーブのバイト保存）を踏襲。Dex の raw 保持（#668）は未実装のため、旧版での書き込みで新 Dex が落ちる既知リスクは Batch 19 でも存在 |
| 番号安定性 | 通常 step 1〜69 は凍結 | burrata は step 70、late の導出番号は +1（71–77 見込み）。B18 では REC-04 の tie-break で凍結 prefix を延長した前例があるため、**実装時に step 1–69 一致を測定**。pesto-burrata のみ credited、crudaiola は `ladderCredit:false`（Prep §4.2） |
| 新 ingredient 追加時の連動ファイル | B18 の変更範囲に準拠 | `ingredients.ts`・`recipes.ts`・`discoveryLadder.ts`・`discoveryCatalog.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`orders.ts`・`ingredientTaxonomy.ts`・`toppingSizeClass.ts`・`IngredientGlyph.tsx`・golden（`hint5.ladders55.json` ほか）・新規テスト |

---

## 6. 食材 SVG（burrata 案 C）の受入条件

R2 決定 D5 を前提に、実装 PR の受入条件を次のとおり提案します（**Owner 決定の変更ではない**）。

| # | 条件 |
|---|---|
| S1 | 専用 SVG は案 C。`DedicatedIngredientVisual` に新しい id を追加し、`pieceVisual` で参照。**候補 SVG は未 merge の `claude/burrata-preflight-docs-8auzii`（`d39a680`）にあるため、実装時に必要ファイルだけを移す**（取得できることを実装開始時に再確認） |
| S2 | 初期サイズは 1.2em（既存チーズ・ハーブ群と同じ）、占有 1em。最終値は実寸 HV で決める（大葉が 1.2em→1.35em に変わった前例＝#758／#761。**サイズ補正が必要なら `App.css`〔HOT〕に個別ルール**） |
| S3 | トレイ（約 26px）・ピザ上・焼成後・RESULT・ショップ・図鑑・ヒント表示で、**mozzarella／ricotta／feta／cream-cheese 等の白系チーズと識別できる**輪郭（上の裂け目と溢れるクリーム）が保たれること。グレースケールでも判別できること |
| S4 | 識別テスト（#733 と同方式）：burrata の描画が既存チーズ描画と別であること。食材 id・`emoji`・色・family・サイズクラス・採点・保存は変更しない（新規 id なので emoji／color は新規に決める） |
| S5 | 焼成後の見え方（溶けて広がる mozzarella〔#468 の Pilot は open PR〕との混同）を確認。`.pizza-cheese--mozzarella` は #468 が `App.css` で触る領域 |
| S6 | 360×800・390×844 の両方でトレイの 1 画面 UX を維持（#764／#765 で 390px 未満はチップ名 10px・余白 3px。名称「ブッラータ」の幅は未測定のため、WebKit 360×800 で実測） |

---

## 7. claim・競合マトリクス

### 7.1 claim と状態（GitHub で確認）

| 対象 | 状態 | claim | Batch 19 への影響 |
|---|---|---|---|
| #748／PR #759（B18） | **merged** | Issue #748 の claim（セッション A、branch `claude/teto-pizza-game-content-9ctr2x`、files: `recipes.ts`・`ingredients.ts`・`lateCatalog.ts`・`discoveryLadder.ts`・`referencePizza.ts`・`ingredientTaxonomy.ts`・`toppingSizeClass.ts`・golden ほか）。**期限 2026-11-19T00:00Z。#748 に release コメントは無い**（コメント 7 件を全読） | **未解放の claim が Batch 19 の主要ファイルと完全に重なる。** PR は merged なので役目は終わっているが、開始前に**解放の投稿または期限切れの確認が必要**（私は他担当の claim を変更しない） |
| #733（牛肉・ピーマン） | PR #760 merged（`537ed090`）。Issue #733 は open（コメント 0 件取得） | 取得できた claim なし | `IngredientGlyph.tsx` の最新状態は main に取り込み済み |
| #758（大葉） | PR #761 merged（`c308a3f7`）。Issue open | **claim は 2026-11-06 07:35Z に release 済み** | `App.css` の大葉ルールは main。Style Lock V2 §10.2 の更新は #753 merge 後の docs-only（B19 と無関係） |
| #764（360px はみ出し） | PR #765 merged（`fa67c72a`）。Issue はまだ open | claim `claude/webkit-360-cooking-overflow`、files は e2e／docs のみ、**期限 2026-11-12** | `App.css` の 390px 未満ルール（チップ名 10px・余白 3px）は main。Batch 19 の食材名追加は影響小。claim の files は B19 と重ならない |
| #738（Steam S3） | open（Draft ではない） | 取得せず | `src/components/PizzaStage.tsx`・`PizzaStage.SteamLook.test.tsx` を変更（変更ファイル一覧は 100 件上限で取得、**PizzaStage 以外の data／CSS／IngredientGlyph は含まれず**）。**B19 が `PizzaStage.tsx` を触る場合のみ競合** |
| #749（Fry） | Issue open、PR は一覧に無し | 取得せず | 食材（eggplant 等）のデータに触れる可能性があるが、burrata・新 2 レシピとは別 |
| #394／#680（WebKit 間欠） | open。#768 が RAW_BAKE の窓を調整（merged） | — | 新しい E2E は WebKit の既知の間欠性を踏まえて設計。**CI の赤は隠さず原因を分けて報告**（#759 の WebKit shard 2/3 は PASS 扱いにしないと Owner 判断済み） |
| #763・#762・#757・#756（Steam Lab）、#746（DRIZZLE） | open／Draft | 取得せず | #763 は 53 ファイル、#746 は 16 ファイル。どちらも `src/data`・`App.css`・`IngredientGlyph`・`PizzaStage.tsx` を**含まない**（`src/main.tsx` のみ該当） |
| #753／#751 | open（docs） | — | `docs/` のみ。アイコン仕様の文書化は #753 merge 後が衝突しにくい |
| #468（モッツァレラ溶け） | open（2026-10-12 から更新なし） | — | `.pizza-cheese--mozzarella`（`App.css`）。burrata の焼成後描画と近い領域。**B19 が `App.css` を触るなら先に調整** |
| #766 | open（新規） | — | 結果画面の「ヒントを見る」が短い画面で隠れる（390×664）。B19 の HV 範囲外だが、**ヒントを確認する HV で再現し得る**ので撮影時の注意に記載（§9） |

### 7.2 ファイル競合の見立て

| ファイル | Batch 19 | 他の進行中作業 | 判定 |
|---|---|---|---|
| `src/data/ingredients.ts`・`recipes.ts`・`discoveryLadder.ts`・`referencePizza.ts` ほかカタログ | 編集 | **#748 の未解放 claim（期限 11-19）のみ**。open PR に無し | **claim の解放確認が必須**。HOT ファイル（`recipes.ts`） |
| `src/components/IngredientGlyph.tsx` | burrata の SVG を追加 | ハーブ 4 種 PR（描画のみ、未着手）が同ファイルを共有 | **ハーブ PR と B19 を同時に始めない。先に merge する側を claim に宣言** |
| `src/App.css`（HOT） | サイズ補正が必要な場合のみ | #468 が別セレクタ、ハーブ PR も補正 | 最小限・個別ルール。実装時に再確認 |
| `src/components/PizzaStage.tsx` | **触らない見込み**（burrata の描画は `IngredientGlyph`＋`pieceVisual` 経由） | #738（変更中） | **B19 では編集を禁止**する（同時編集禁止） |
| `src/main.tsx` | 触らない | #746・#763 | B19 では編集禁止 |
| `src/preview/*`・HV seed | **撮影目的の新規 seed は今回禁止**。実装時は Owner 承認後（B18 は approach A の前例） | #757 ほか | 実装 PR での要否は §8 Phase 5 で判断 |
| Research／Hint（`discoveryCatalog.ts`・`hint5Ladder.ts` 系・golden） | 影響を受ける（golden 更新） | #759 で挿入のみの更新済み | main 最新から開始。rebase 時に golden の再生成 |
| 保存関連（`persistence.ts` 等） | **変更しない見込み** | #668・#664・#560（open Issue、実装は Owner 判断待ち） | B19 では変更禁止。保存影響テストのみ追加 |

**同時編集を禁止すべきファイル:** `PizzaStage.tsx`・`main.tsx`・`gameReducer.ts`・`persistence.ts`（Batch 19 のスコープ外）。**先に決めるべき順序:** ハーブ 4 種 PR と B19 は `IngredientGlyph.tsx`・`ingredients.ts` を共有するため、どちらを先に merge するかを B19 claim に明記。

### 7.3 先に必要な merge／独立して進められる作業

- **先に merge が必要なもの：なし**（#759・#760・#761・#765 は完了）。ただし #748 の claim の解放（merge ではない）と WebKit E2E（`785d7956`）の完了確認が先。
- **独立して進められる作業:** ハーブ 4 種の描画 PR（B19 と別 PR）、#753 後の Style Lock V2 docs、本監査・取り込み用の docs-only PR。

---

## 8. Phase 別実装計画（Owner の明示 GO まで実装しない）

前提：390×844 と 360×800 の 1 画面 UX を維持。各 Phase は独立コミット・独立レビュー可能な単位にする。

### Phase 0：実装前条件の解消
- **対象:** docs と GitHub のみ（コード変更なし）。
- **作業:** (a) `785d7956` の WebKit E2E の完了確認（赤なら原因を分離、PASS 扱いにしない）。(b) #748 の claim の解放を担当セッションが投稿／期限切れを確認。(c) Prep Rev 4・R2 決定記録を main へ取り込む docs-only PR（別途）と、X1〜X4 の整理。(d) 新規 Issue 起票（Prep D9 で承認とされるが X2 により要確認）と**新しい claim**（files：§7.2 の編集対象、期限 14 日以内）。(e) Owner の明示 GO。(f) main 最新・open PR・claim の再確認、`docs/PROJECT_HANDOFF.md` の起動チェックリスト。
- **受入:** §10 の P0 項目に回答があり、claim が有効で重ならない。
- **リスク:** claim 未解放による同時編集、Prep と R2 決定の番号取り違え（X1）。
- **Owner 判断:** GO、X2 の承認、claim の扱い。

### Phase 1：burrata のデータ・専用 SVG
- **対象:** `ingredients.ts`（新規 id・`pieceVisual`・価格・補充数）、`IngredientGlyph.tsx`（案 C）、`ingredientTaxonomy.ts`・`toppingSizeClass.ts`・`ingredientSearchAliases.ts`（「ブラータ」を検索エイリアスに）、識別テスト。`App.css` は補正が必要な場合のみ。
- **依存:** Phase 0。候補 SVG の移植（S1）。
- **受入:** §6 の S1〜S6。ingredient 追加後も既存全テスト緑。
- **リスク:** 既存チーズ描画との混同、トレイで 1 画面を超える、`IngredientGlyph.tsx` の共有。
- **Owner 判断:** 個数・価格・サイズクラス（暫定）、初期サイズの最終値。

### Phase 2：2 レシピの追加
- **対象:** `recipes.ts`（2 件）、`discoveryLadder.ts`（step 70、key は pesto-burrata）、`referencePizza.ts`・`recipeSauceProfiles.ts`・`recipeHintRoles.ts`・`orders.ts`・`discoveryCatalog.ts`、`expansionBatch19.test.ts`（近傍 4 件の名前固定、C1〜C5）、`recipeBatchManifest.ts` の B19 エントリ。
- **依存:** Phase 1。
- **受入:** Jaccard・同一／部分／上位／1 材料差の回帰固定、step 1–69 一致、credited 80・レシピ 92／91（Pinsa 開／閉）は**実測で更新**。`lunchRush:false`。
- **リスク:** pesto 主＋oil 副の Reference、step 番号のずれ、通常 ladder の tie-break で凍結 prefix が動く。
- **Owner 判断:** 暫定 id・日本語名・窓・価格の承認（X2）。

### Phase 3：Research／Hint／Dex／Inventory との統合
- **対象:** golden（`hint5.ladders55.json` ほか）、`researchLabelAudit.ts` による取得順監査、AC-8／AC-8b のテスト、`persistence.batch19.test.ts`（既存セーブのバイト保存）。
- **受入:** AC-8（正準順 0 件、非正準順は全件列挙）、**未承認差分 0 件**、AC-8b、既存 Dex・在庫・保存が不変。
- **リスク:** 非正準順の差分が大量に出る（B18 は 39 件）。Owner の個別承認が必要でバッチの進行を止める。
- **Owner 判断:** 非正準ラベル差分の 1 件ごとの承認（ID・レシピ・取得順・変更前後）。

### Phase 4：単体テスト・E2E・WebKit
- **対象:** `e2e/b19.spec.ts`（調理〜結果、2 レシピ）、`new-bbq`／既存の件数 pin の追従、390×844／360×800（Chromium）と WebKit 全 shard。
- **受入:** Vitest（Pinsa 開／閉）・tsc・lint・build、CI の全 check green。**WebKit の間欠失敗は隠さず原因を分ける（#394・#680、PASS 扱いにしない）**。Codex レビュー指摘 0。
- **リスク:** WebKit の既知の間欠、`webkit-360x800` の横はみ出し再発（#764）。
- **Owner 判断:** 間欠失敗の受容方針。

### Phase 5：画像・動画による HV と Final Gate
- **対象:** `docs/reports/screenshots/b19/`（before／after）、Result Report、390×844 の動画（**repo に commit しない**、Owner へ直接）。
- **受入:** HV ポリシー（`TETO_HUMAN-VERIFICATION-POLICY.md`）の充足。iPhone Safari は Owner の実機 HV。**Chromium の確認を実機 HV の合格として記録しない。**
- **リスク:** 実機 HV 用の入口（seed）が必要になる場合、B18 のように Preview 限定 seed を実装 PR 内で作る必要があるが、**これは別の Owner 承認事項**。共有 Preview の上書きは禁止。
- **Owner 判断:** HV 用 seed の要否と方式、merge 承認（別途）。

### 撮影計画（今回は撮影のためのコード変更・共有 Preview 更新を行わない）
撮影は実装後（Phase 5）に実施。今回は計画のみ。

| # | 画面 | サイズ | 内容 |
|---|---|---|---|
| 1 | ショップ（NEW burrata） | 390×844／360×800 | 購入前後。名称の表示 |
| 2 | 調理（チーズ工程）トレイ | 同 | burrata と mozzarella・ricotta・feta・cream-cheese の並び |
| 3 | 生地の上（配置後） | 同 | burrata が 1 つ・複数 |
| 4 | 焼成後・RESULT | 同 | クリームの見え方、白系チーズとの区別 |
| 5 | Research 一覧 | 同 | 「？？？ピザ A／B（ブッラータ）」の 2 件 |
| 6 | Hint（SAUCE 段・CHEESE 段） | 同 | AC-8b。**#766（結果画面の「ヒントを見る」が隠れる）に注意し、高さ 664 でない通常サイズで撮る** |
| 7 | 図鑑・在庫 | 同 | 新規エントリの表示 |
| 8 | 動画 | 390×844 | 発見→調理→RESULT の人間のペース（pesto-burrata／crudaiola の各 1 本） |

before は main（`785d7956`）、after は実装 HEAD。画像は repo、動画は直接配布。

---

## 9. 必要なテスト・HV

| 区分 | 項目 |
|---|---|
| Vitest | `expansionBatch19.test.ts`（近傍固定・Jaccard・step・credited・件数 pin）、Research 全数監査（`researchLabelAudit`）、AC-8b、`persistence.batch19.test.ts`、burrata 識別テスト、golden 追従（assertion の意味は弱めない）、Pinsa 開／閉の両方 |
| E2E | 2 レシピの通し（Chromium 390×844／360×800）、Free Cooking での burrata 配置、横はみ出し（#764 のスペック流用）、WebKit 全 shard |
| HV（Owner 実機） | iPhone Safari：トレイ・ピザ上・焼成後・RESULT での burrata の視認性、2 レシピの Research・調理・発見、AC-8b の Hint の分かりやすさ |
| 禁止 | Production ON、共有 Preview 更新、HV の Chromium 代替記録、CI 赤の隠蔽（retry・timeout・skip・Gate 緩和による回避） |

---

## 10. Owner 判断事項（優先順位順）

| 順位 | 事項 | 推奨 |
|---|---|---|
| **1** | **実装の明示 GO**（Q3）。条件は P0 の完了後 | P0 完了後に出す（本書は GO を要求しない） |
| **2** | **#748 の未解放 claim（期限 11-19、B19 の主要ファイルと完全重複）の扱い**：担当セッションに解放を投稿させる／期限まで待つ／Owner が失効を宣言する | 解放の投稿（他担当の claim を私が変更しない） |
| **3** | **Prep の D1・D3・D4・D7・D9（X2）を権威として承認するか**。GitHub 上で確認できない決定の記録 | #748 に Owner 決定として記録、または Prep の該当節を承認する旨を明記 |
| **4** | **Prep Rev 4 と R2 決定記録の main 取り込み**（X1・X3・X4 の修正込み、docs-only）。D 番号は内容で引用 | 別の docs-only PR で取り込み、#759 merged を反映 |
| **5** | `785d7956` の **WebKit E2E の結果**の扱い。赤なら B19 開始の前に原因の切り分け | 完了後に確認。赤は PASS 扱いにしない |
| **6** | **crudaiola 例外の維持**。将来 `burrata-pizza`（matrix 行 117、READY）を足すと近傍 5 件目になり再判断（§4.4） | 維持。将来の burrata-pizza の扱いは別 Issue で |
| **7** | 暫定仕様（個数・価格・サイズクラス・窓・id・日本語名）を実装 PR で確定させる範囲 | PR に「暫定・原典未確認」と明記、HV 後に調整 |
| **8** | **非正準ラベル差分の個別承認**（Phase 3）。差分の件数が多い場合の進め方 | 件数に応じて Owner が方式を決める（未承認があれば HOLD） |
| **9** | **HV 用 seed**の要否（B18 は approach A）と、別オリジンの Preview の可否 | 実装計画の Phase 5 で別途提案 |
| **10** | **ハーブ 4 種 PR と B19 の順序**（`IngredientGlyph.tsx`・`ingredients.ts` を共有） | B19 を先（Owner の優先順位：新食材・新レシピが先） |

Owner の優先順位（①新食材 ②新レシピ ③新調理工程）に対し、Batch 19 は ①②を満たし、③は不要。

---

## 11. 判定

### **CONDITIONAL GO**

**GO にできる根拠:** #759・#760・#761・#765 は merge 済み。main の Deploy は success。Jaccard・重複は Prep と同じ結果で、同一・部分・上位・1 材料差は 0 件。新調理工程が不要で、**`src/data/*` を触る他の open PR は確認できた範囲で無い**。burrata は案 C、2 レシピは Owner 承認済み。

**HOLD にしない理由:** Q4（#759 merge 前は実装しない）は充足した。Research ラベル・AC-8b は実装時の測定と承認で扱える設計になっている。

**GO にしない（CONDITIONAL）理由 — 実装開始前に解消すべき条件:**
1. Owner の**明示 GO**（Q3）。
2. **#748 の claim の解放確認**（期限 11-19、主要ファイル重複）。
3. `785d7956` の **WebKit E2E の完了確認**（現時点で進行中）。
4. Prep の記述のうち GitHub で確認できない Owner 決定（X2）の承認。
5. Prep／R2 決定の main 取り込みと陳腐化の修正（X1・X3・X4、推奨だが開始の必須条件にするかは Owner 判断）。
6. 実装直前に main・open PR・claim を再取得し、レシピ件数・step 70・Jaccard を**再計測**（実装時に再実施）。

**Owner の明示承認までは実装しません。** 本書の判定は実装開始の許可ではありません。

---

# 追記 1 — Phase 0 ブロッカー解消準備（2026-11-06 13:31 UTC）

**範囲:** コメント案・結果確認・Owner 判断表・docs 取り込み案の整理のみ。claim の投稿・解放、Issue／PR 作成、コード変更、merge、Preview 更新は行っていません。本節の GitHub 情報は 13:31 UTC 時点で取得。

## A1. #748 の担当セッション宛て — claim 解放確認のコメント案（**未投稿**）

**宛先の特定（#748 のコメント全 7 件を再確認、新規コメントなし）:** 有効な claim は 1 件。コメント 6650377722（2026-11-05T05:17:56Z）、`session_013m8Cb66Bu5f1XXHC2xCiLL`（B18 セッション A）、branch `claude/teto-pizza-game-content-9ctr2x`、`pr: null`、`expires 2026-11-19T00:00:00Z`。`released: true` の投稿はありません。PR #759 の merge（13:15:08Z）後も claim は有効のままです。
**投稿方針:** claim の解放は担当セッションだけが行えます（SESSION-OPERATIONS §1：同じ `session` ＋ `issue` で `released: true` を投稿）。本案は**確認の依頼**で、**live な claim ブロックを含めません**（下の解放用ブロックはコードフェンス内で、運用規約上 live になりません）。Owner が投稿を承認した場合のみ、投稿してください。

```markdown
@B18 担当セッション向け（Batch 19 の実装前確認）

PR #759（Batch 18）は 2026-11-06T13:15:08Z に squash merge されました（main `785d7956`）。
#748 の最新 claim（コメント 6650377722、`session_013m8Cb66Bu5f1XXHC2xCiLL`、期限 2026-11-19T00:00Z）が
`recipes.ts`・`ingredients.ts`・`lateCatalog.ts`・`discoveryLadder.ts`・`referencePizza.ts`・
`ingredientTaxonomy.ts`・`toppingSizeClass.ts`・`__golden__/**` ほかを保持したままです。
次の Expansion Batch 19（burrata＋2 レシピ、未着手・Owner の明示 GO 待ち）が同じ HOT ファイルを使うため、確認をお願いします。

1. #759 の追加作業（B18 の follow-up、Production／Preview 関連を含む）で、上記ファイルを今後も編集する予定はありますか。
2. 予定がなければ、claim の解放（`released: true`）をお願いします。予定がある場合は、対象ファイルと期限を更新してください。
3. 担当が不在・不明な場合は、Owner の判断（失効宣言など）に委ねます。**この確認は claim を解放するものではありません。**

（参考）解放の書式。担当セッション自身が投稿する場合のみ使用してください:
<!-- teto-claim:v1 {"session":"session_013m8Cb66Bu5f1XXHC2xCiLL","issue":748,"pr":759,"branch":"claude/teto-pizza-game-content-9ctr2x","files":[],"released":true} -->
（上の 1 行は、このコメント案ではフェンス内の例示です。投稿時に live にするかは担当セッションが決めます）

Refs #748 #759
```

> 注: 上のコメント案の最後の `<!-- … -->` は、投稿する場合は**削除**して送るのが安全です（確認依頼と解放を混同しないため）。担当セッションが解放する際に自分で書き直します。

## A2. main `785d7956` の WebKit E2E run 42223996134 — 最新結果（13:31 UTC）

| ジョブ | 状態 |
|---|---|
| classify | success |
| layout-chromium | success |
| webkit-390x844 shard 1/3 | **success**（13:29:38Z 完了） |
| webkit-390x844 shard 2/3 | **success**（13:29:38Z 完了） |
| webkit-360x800 shard 1/3 | **success**（13:30:28Z 完了） |
| webkit-390x844 shard 3/3 | **実行中**（13:16:55Z 開始） |
| webkit-360x800 shard 2/3 | **実行中**（13:17:12Z 開始） |
| webkit-360x800 shard 3/3 | **実行中**（13:17:01Z 開始） |
| Layout Contract Gate | success（13:19:32Z。WebKit 完了前の評価で、WebKit Gate の代わりではない） |
| WebKit Gate | **未実行／未確定** |
| Deploy to GitHub Pages（run 42223996114） | success |

**判定:** 完了 shard は 3/6 が success、3 shard が実行中（約 14 分経過。完了済み shard は約 13 分で終了しており、異常な長さではない）。**run 全体の結論は未確定**です。待機ループは行わず、最終結果は Owner／担当が確認するか、次回の確認時に再取得してください。赤になった場合は PASS 扱いにせず、#394・#680 の既知の間欠性と切り分けます。

## A3. Owner 判断表（Prep Rev 4 × R2 決定記録 × #748 コメント）

**証拠の凡例:** [GH]＝#748 の Owner コメントで確認（6663697601＝2026-11-05 16:45Z「Parallel Investigation」、6673566588＝2026-11-06 00:48Z「R2 preflight」）。[R2]＝R2 決定記録（未 merge ブランチ）。[Prep]＝Prep Rev 4 のみ。[B18]＝B18 の Owner コメント（6650593172・6651668675・6656496881）。**GitHub 上の Owner コメントで確認できたものだけを「承認済み（GH 確認）」とします。** Prep／R2 の記載は Owner 承認の*記録*だが GitHub 上の一次証拠がないものは「承認記録あり・GH 未確認」とし、私は検証できません。

### A3.1 承認済み（GH で確認）

| 項目 | 内容 | 証拠 |
|---|---|---|
| burrata の専用 SVG | **案 C**（上が裂けてクリームが見える）。ただし「実装時の見た目 HV 待ち」（pending real implementation visual HV） | [GH 6673566588][R2 D5] |
| ハーブ 4 種 | rosemary B／oregano B／spinach A2／artichoke A2。初期 1.2em、実寸の焼成後・RESULT は実装 HV で検証。**デザイン候補の承認で、iPhone HV PASS や merge ではない** | [GH 6673566588][R2 D1–D4] |
| pesto-burrata の構成 | pesto＋olive-oil | [GH 6673566588][R2 D8] |
| crudaiola の Jaccard 例外 | **0.429、このレシピ限り**。近傍の根拠を文書化、同一／部分集合／上位集合なし。トマト＋オリーブオイルの構成を維持 | [GH 6673566588][R2 D6・D7] |
| crudaiola の配置 | 全食材**焼成前**（未対応の後乗せはしない） | [GH 6673566588][R2 D7] |
| FINISH のチーズ対応 | 別の将来タスク。B19 は依存しない | [GH 6673566588][R2 D9] |
| 実装の順序条件 | #765・#759・#760 が**それぞれの Owner 承認つきで merge**され、**現在の claim が解消**されるまで実装しない。実装前に main・claim を更新し、**step・Research ラベル・Hint・重複ゲートを再検証** | [GH 6673566588]。#765・#760・#761・#759 は merge 済み（#759 は Owner〔perusonao〕が 13:15:08Z に merge）。**claim の解消は未了** |
| 調査の範囲 | burrata と 2 レシピの preflight 調査 GO のみ（実装・PR は未許可）。#759 の merge 依存を尊重 | [GH 6663697601] |
| 一般の運用制約 | merge・Production ON・共有 Preview 上書きは別途 Owner 承認 | [GH 6663697601・6673566588] |

### A3.2 承認記録あり・GH で未確認（Prep／R2 の記載のみ）

| 項目 | 内容 | 出典 | 扱い |
|---|---|---|---|
| Prep D1 | 食材名「**ブッラータ**」（matrix の「ブラータ」は検索エイリアス案） | [Prep] | **要確認**。R2 では未記載 |
| Prep D3 | id `pesto-burrata-pizza`／`pizza-alla-crudaiola`、名称「ペスト・ブッラータピザ」「ピッツァ・アッラ・クルダイオーラ」（暫定） | [Prep] | **要確認**（暫定のまま） |
| Prep D4 | 個数・窓・価格・色は暫定実装可、Preview HV で調整 | [Prep] | **要確認**。R2 にも明記なし |
| Prep D7 | pesto-burrata のチーズは burrata のみ（mozzarella を足さない） | [Prep] | **要確認**。R2 では未記載 |
| Prep D8 | 2 レシピとも維持 | [Prep]（#748 6663697601 は「2 レシピ」を調査対象としている） | 実質的に支持される。実装 GO で確認 |
| Prep D9 | #759 merge 後の B19 Issue 起票の承認 | [Prep] | **要確認**（起票は GO 後） |
| Prep D5 | ハーブ 4 種は別 PR・#759 merge 後 | [Prep]、[R2 §3] も「別 PR 維持」 | R2 に記録あり。GH 上は確認できず |
| Prep Q1 | pesto-burrata 近傍（4 件目）の例外を C1〜C5 つき条件付き承認、AC-8b 追加 | [Prep] | **要確認** |
| Prep Q2 | 正準順の既存ラベル変化 0 件、非正準は全件列挙＋個別承認 | [Prep]。B18 では OD-B18-4 が**セット承認**だった[B18]ため、B19 の「個別承認」は**より厳しい方針の Prep 記載** | **要確認** |
| Prep Q3 | **Owner の明示 GO が実装の必須条件** | [Prep]、[R2 §2.2 3.] | 一貫（R2 に同記載）。GO 自体は未取得 |
| Prep Q4 | #759 merge 前は実装しない（claim 期限と独立） | [Prep]、[GH 6673566588] の順序条件と整合 | 条件は充足済み |
| Prep P1 | AC-8b の合格基準：SAUCE または CHEESE の有料ヒント 1 段 | [Prep] | **要確認** |
| Prep P2 | 非正準差分は 1 件ごとに ID・レシピ・取得順・変更前後を報告、未承認は Gate HOLD | [Prep] | **要確認** |

### A3.3 暫定仕様（Owner の承認対象ではなく、実装 PR で「暫定」と明記）

原典（pizzadb.jp）未確認。個数（Prep §4.2 の仮置き：pesto-burrata＝pesto 1／olive-oil 1／burrata 2／fresh-tomato 2、crudaiola＝tomato-sauce 1／olive-oil 1／mozzarella 2／burrata 2／fresh-tomato 2／arugula 2）、焼成窓 58–78、価格（T4 の提案）、burrata のサイズクラス `l`、色・emoji（🧀 フォールバック）、`pieceVisual` の id（仮 `burrata-torn-ball`）、recipe id・日本語名、`lunchRush:false`、通常 step 70・`ladderCredit`（pesto-burrata のみ credited）、Research ラベル「？？？ピザ A／B（ブッラータ）」。**R2 は個数を決めていない**（Prep 自身も「仮置き」）。

### A3.4 未承認・未回答（Owner の判断が要るもの）

| # | 項目 | 備考 |
|---|---|---|
| U1 | **実装の明示 GO**（Q3） | 未取得。P0 完了後 |
| U2 | **#748 の未解放 claim の扱い**（A1） | GH 6673566588 が「claims が解消されてから」を条件にしており、**現状は未充足** |
| U3 | Prep 記載の決定（A3.2）を Owner が権威として承認、または #748 へ記録 | 要確認項目 11 件 |
| U4 | 将来の `burrata-pizza`（matrix 行 117）追加時の扱い（crudaiola の近傍 5 件目になり例外 C2 に抵触、Jaccard 0.429） | 本監査（§4.4）の新発見 |
| U5 | ハーブ 4 種 PR と B19 の順序（`IngredientGlyph.tsx`・`ingredients.ts` 共有） | Owner の優先順位に従えば B19 先 |
| U6 | HV 用 seed の要否・方式（main に `src/preview/b18HvSeeds.ts` が既にあり、B18 の approach A が前例） | Phase 5 で別途提案 |
| U7 | docs 取り込み PR の作成許可（A4）と、Prep／R2 の修正の承認 | 本追記では PR 未作成 |

**矛盾の整理:** R2 と Prep で**番号は異なるが内容は一致**する項目：R2 D5＝burrata C／D6＝crudaiola 例外／D7＝crudaiola 2 層・焼成前／D8＝pesto-burrata 2 層／D9＝FINISH チーズ保留。Prep の D2＝crudaiola 例外、D7＝pesto-burrata に mozzarella なし、D9＝#759 後の Issue 起票。**内容の矛盾はなし**（番号の取り違えのみ。R2 D7 の「案 P」は late に入れない意で Prep §4.1 と一致）。

## A4. docs-only 資料を main へ取り込む最小差分と修正案（**未実施**）

### A4.1 最小差分（新規ファイルのみ、既存ファイルとの衝突なし）

両ブランチとも**追加のみ**で main の既存ファイルを変更しません（`git diff --stat origin/main...` で確認：R2＝1 ファイル +69、Prep＝2 ファイル +831）。

| # | ファイル | 出典ブランチ | 取り込み方針 |
|---|---|---|---|
| 1 | `docs/reports/TETO_EXPANSION-BATCH-19_Prep.md`（497 行） | `claude/teto-pizza-batch-19-prep-xvizrg` `9903b33f` | **修正して取り込む**（A4.2）。Rev 5 として |
| 2 | `docs/reports/data/TETO_EXPANSION-BATCH-19_PREP_jaccard.json`（334 行） | 同上 | **無修正で取り込み可**。ただし B18 反映後の再計測値は本監査で同じ結果（§4）。再生成は不要 |
| 3 | `docs/decisions/TETO_ICONS-HERBS-BURRATA_R2_OWNER-DECISIONS_2026-11-06.md`（69 行） | `claude/r2-owner-decisions-docs-8auzii` `2f29318f` | **修正して取り込む**（A4.2） |
| 4 | `docs/reports/TETO_EXPANSION-BATCH-19_PreImplementation_Fresh-Audit.md`（本書） | 本ブランチ | そのまま |

- **取り込まないもの:** ハーブ・burrata の候補 SVG と R2 Result Report（`claude/herb-icons-compare-docs-8auzii` `c9351e4`、`claude/burrata-preflight-docs-8auzii` `d39a680`、`docs/design/candidates/**`）。これらは**実装 PR で必要なファイルだけを移す**（Owner 2026-11-05 の指示）。参照はブランチ名とコミット SHA で残し、取り込みの対象外とする。
- **ベース:** 4 ファイルは別々のブランチにある（Prep は `fa67c72`、R2 は `d85b9575` から分岐）。**推奨：`origin/main`（`785d7956`）から新しい docs ブランチを切り、3 ブランチのファイルを `git checkout <branch> -- <path>` で持ち込み、A4.2 の修正を 1 コミット**にする。ブランチをそのまま merge すると、旧 main のコミットが混ざるため避ける。
- **CI への影響:** `docs/` のみの変更なので、WebKit の classify が docs-only と判定する見込み（過去の docs-only PR と同様。**この環境では未確認**）。`src/` の import／スキャンに影響するテストが docs を読む場合は取り込み前に Vitest の該当を確認（未実行）。
- **PR の作成・merge は Owner の許可後**（U7）。本監査では作成していません。

### A4.2 古い記述と D 番号の修正案

**Prep Rev 4 → Rev 5（修正案）**

| # | 箇所 | 現状 | 修正案 |
|---|---|---|---|
| P-1 | 先頭の「ブランチ」「入力」 | 準備ブランチと `fa67c72` ベースの説明 | 「main `785d7956`（#759 merge 後）に取り込み。出典コミット `9903b33f`」に更新 |
| P-2 | §0 項目 6、§1.2、§7.0 S-1・S-3、§8.2 末尾 | 「#759 は Draft／HOLD・未 merge」「S-1 未充足」 | 「#759 は 2026-11-06T13:15:08Z に merge（`785d7956`）。**S-1 は充足**。S-3（claim 解消）は未充足（#748 の 6650377722 が有効）」 |
| P-3 | §1 の表（「#759 merge 後（B18 報告の数値）」列） | #759 の Result Report の引用で「検証し直していない」 | 「**main `785d7956` で確認**（レシピ 90＝本監査の静的解析で一致）。credited・食材 id・ladder step 69・章サイズ 53 は #759 の Result Report の値で、**本監査では未再計測**」と区別 |
| P-4 | §1.1 の「#758」行 | claim 有効（〜2026-11-08） | **release 済み**（#758 コメント 6679761024、2026-11-06T07:35:47Z） |
| P-5 | §1.2 の #759 行 | HEAD `d9679e6`、WebKit shard 2/3 failure の記述 | 過去の時点の記録として「Rev 3 時点」と明記し、**最終 merge HEAD は `c533a4f1`**、現在の main の WebKit run は追記 1 A2 の状態、と追記 |
| P-6 | D 番号の注記 | D1〜D9 が R2 と別内容 | 「**本書の D1〜D9 は R2 決定記録の D1〜D9 とは別の番号体系**。R2 の D5＝burrata C、D6＝crudaiola 例外 など。引用時は内容を併記する」を §0.1 の見出し直後に追加。**Prep の D 番号は変更しない**（既存の引用を壊さないため）。代わりに R2 側に対応表を追加 |
| P-7 | §0.1 の根拠 | D1・D3・D4・D7・D9 の出典 | 「出典：Owner のチャット指示（#748 の GitHub コメントでは未記録）」と明記 |
| P-8 | 付録 | 本監査の発見 | §4.4（burrata-pizza の将来リスク）と、crudaiola 例外 C2 に「burrata-pizza 追加も 5 件目に該当」を追記 |
| P-9 | §9 | 「実施／未実施」 | Rev 5 では「docs 取り込み」「再計測（Jaccard、静的解析）」を追記 |

**R2 決定記録（修正案）**

| # | 箇所 | 現状 | 修正案 |
|---|---|---|---|
| R-1 | 冒頭 Status | 「実装は未着手・HOLD（開始条件の一部が完了、残りは §2）」 | 「#759 merge 済み。残りは claim の解消と Owner の明示 GO」 |
| R-2 | §2.1 表 | #759「未完了（open・Draft／HOLD）」、main `c308a3f7` | #759「**完了**（`785d7956`、2026-11-06T13:15:08Z）」、main `785d7956`。#748 の claim「〜2026-11-18」は**「〜2026-11-19、`6650377722`、解放の投稿なし」**に訂正（期限日の誤記） |
| R-3 | §2.2 | 3 条件（#759 merge、claims、GO） | 条件 1 を「**充足**」にし、残り 2 条件を維持 |
| R-4 | §3 の「main（`c308a3f`）で変わった共有ファイル」 | #759 の変更ファイルは main 未反映と記載 | 「#759 の変更は main に取り込み済み（`recipes.ts`・`ingredients.ts`・`lateCatalog.ts`・`discoveryLadder.ts`・golden ほか）」 |
| R-5 | 対応表の追加 | なし | Prep の D 番号との対応表（上の A3 の「矛盾の整理」）を §1 に追加 |

**修正しないもの:** Owner 決定の内容（D1〜D9）。変更・解釈の追加は行わず、状態の更新と対応表だけにします。

## A5. 実装開始に残るブロッカー

1. **Owner の明示 GO**（Q3、必須）— 未取得。
2. **#748 の未解放 claim**（`6650377722`、期限 11-19、主要カタログ・golden と重複）— GH 6673566588 の「claims 解消」条件が未了。担当セッションの解放、または Owner の判断が必要（A1）。
3. **main `785d7956` の WebKit E2E の完了確認** — 3/6 shard は success、3 shard 実行中、WebKit Gate は未確定（A2）。
4. **GitHub で確認できない Prep 記載の決定の承認**（D1・D3・D4・D7・D9、Q1・Q2・P1・P2：A3.2、U3）。
5. **docs 取り込み（Prep／R2 の main 反映と陳腐化の修正）**— 開始の必須条件にするかは Owner 判断（U7、推奨は取り込み後に実装）。
6. **実装直前の再計測**（step 70・件数・Jaccard・Research 監査・Hint）— 実装セッションの作業で、現時点の未了は仕様上のもの。

**ブロッカーではないもの:** #759・#760・#761・#765 の merge（完了）、Jaccard・重複（再現済み・新たな違反なし）、他 open PR とのファイル競合（`src/data/*`・`IngredientGlyph.tsx`・`App.css` を触る open PR は確認範囲で無し）。

---

# 追記 2 — Phase 0 続き（2026-11-06）：claim コメント最終案・未確認項目の分類・docs 取り込み PR の準備

**前提（Owner 確認済み）:** main `785d7956` の WebKit E2E run 42223996134 は **SUCCESS**。再実行・再確認は不要（追記 1 A2 の「未確定」は解消）。
**範囲:** コメント案の最終化、分類と判断案、docs 取り込みブランチのローカル準備まで。**PR は作成していません。claim・Issue・コメントは投稿していません。**

## B1. #748 claim 解放確認のコメント — 最終案（**未投稿・Owner 提示用**）

- 投稿先：Issue #748。claim は担当セッション（`session_013m8Cb66Bu5f1XXHC2xCiLL`）だけが解放できるため、本コメントは**確認依頼**です。
- 追記 1 の案からの変更：(a) 実在ユーザーに通知が飛ぶ恐れのある `@` を削除、(b) **claim ブロック（解放の書式例）を本文から削除**（確認依頼と解放の混同を防ぐ）、(c) #759 の最終 HEAD と WebKit E2E の結果を追記、(d) 担当不在時の選択肢を Owner 判断に限定。
- 投稿時は、本書の規約（末尾に Generated by Claude Code 表記）に従ってください。

```markdown
Batch 19 開始前の claim 確認です（B18 の担当セッション向け）。

PR #759（Batch 18）は 2026-11-06T13:15:08Z に squash merge されました（main `785d7956`、PR の最終 HEAD `c533a4f1`）。
main の WebKit E2E（run 42223996134）は SUCCESS と Owner が確認しています。

一方、#748 の最新 claim（コメント 6650377722、session `session_013m8Cb66Bu5f1XXHC2xCiLL`、branch
`claude/teto-pizza-game-content-9ctr2x`、期限 2026-11-19T00:00Z）は、解放の投稿がないまま残っています。
対象には `src/data/recipes.ts`・`ingredients.ts`・`lateCatalog.ts`・`discoveryLadder.ts`・`referencePizza.ts`・
`ingredientTaxonomy.ts`・`toppingSizeClass.ts`・`src/logic/discovery/__golden__/**`・`e2e/b18.spec.ts`・
`e2e/new-bbq.spec.ts` などが含まれ、次の Expansion Batch 19 が同じ HOT ファイルを使う予定です
（Batch 19 は未着手で、Owner の明示 GO と claim の解消が開始条件です）。

次のどちらかを、このスレッドでお知らせください。
1. 上記ファイルの編集予定がない → 担当セッション自身が claim を解放（同じ session・issue で `released: true` を投稿）。
2. 編集予定がある → 対象ファイルと期限を更新（Batch 19 側の `dependsOn`・merge 順の調整に使います）。

担当セッションが応答できない場合の扱い（失効の宣言など）は Owner の判断に委ねます。
**このコメントは claim を解放・変更するものではありません。**

Refs #748 #759

---
_Generated by [Claude Code](https://claude.ai/code)_
```

## B2. Prep のみに記載された項目の分類と判断案

**数え方の訂正:** 追記 1 の「要確認 11 件」は誤りでした。A3.2 の表は 13 行で、「要確認」と付けたのは **9 件**（D1・D3・D4・D7・D9・Q1・Q2・P1・P2）、残り 4 件（D5・D8・Q3・Q4）は既存決定で支持されていました。本節では **13 項目すべて**を分類します。

**証拠の追加:** 今回のセッションで Owner が示した指示（STEP 3「AC-8：有料 Hint で SAUCE と CHEESE を区別できること」「Research canonical ラベルの予期しない変化がないこと」「非 canonical ラベルの変更は Owner の明示承認が必要」「Jaccard 例外は必要性と根拠を個別に確認すること」）を、[SES] として証拠に含めます。**[SES] は GitHub 上の記録ではなく、このセッションの指示**です（一次記録として #748 に残す提案は B2.3）。

### B2.1 分類（13 項目）

| 項目 | 内容 | 分類 | 根拠 | 判断案 |
|---|---|---|---|---|
| Prep D1 | 食材名「ブッラータ」（「ブラータ」は検索エイリアス） | **承認が必要** | ユーザーに見える名称。GH・R2 に記録なし。matrix は「ブラータ」表記 | 「ブッラータ」を承認、「ブラータ」を検索エイリアスに |
| Prep D3 | id `pesto-burrata-pizza`／`pizza-alla-crudaiola`、日本語名 | **承認が必要（id）／暫定（日本語名）** | **recipe id は保存データ（Dex・在庫）に残るため、確定後は変更できない**。日本語名は後から変更可。GH に記録なし | id を承認（命名は既存の `-pizza` 慣例と matrix の id に準拠）。日本語名は暫定 |
| Prep D9 | #759 merge 後の B19 Issue 起票の承認 | **承認が必要（GO と同時）** | Issue 起票は外部公開の操作。GH に記録なし。#759 merge は充足 | 起票は **U1（実装 GO）と同時に承認**し、GO までは起票しない |
| Prep Q1 | pesto-burrata を crudaiola の 4 件目の近傍とする例外の条件（C1〜C5）＋ AC-8b | **承認が必要** | GH 6673566588 は crudaiola の**既存 3 近傍**の根拠を承認。pesto-burrata は**同バッチ内の新しい近傍**で、R2 の根拠が当てはまらない（Prep §2.3.1）。[SES]「Jaccard 例外は必要性と根拠を個別に確認」 | C1〜C5 を承認。ただし AC-8b を満たせない場合は再判断（T3） |
| Prep D4 | 個数・窓・価格・色は暫定実装可、Preview HV で調整 | **実装時の暫定値** | 原典未確認。B16〜B18 で同じ扱い（#748 6650593172「出典の正確さは承認しない」）。GH 6673566588 も「HV で検証」 | 暫定値で実装し、PR 本文とコードコメントに「暫定・原典未確認」を明記。承認不要（承認の対象は暫定扱いの方針のみ） |
| Prep D7 | pesto-burrata のチーズは burrata のみ（mozzarella を足さない） | **既存決定から導ける** | matrix 行 137 の素材は burrata・fresh-tomato・olive-oil（mozzarella なし）、R2 は「原典の構成を維持」（GH 6673566588、pesto＋オイル）。Prep C5「代用なし」 | 導出どおり。確認のみ |
| Prep D5 | ハーブ 4 種は別 PR・#759 merge 後 | **既存決定から導ける** | R2 §3「A と B は別 PR のまま維持（Owner、2026-11-06）」、GH 6673566588 の順序条件 | 導出どおり |
| Prep D8 | 2 レシピとも維持 | **既存決定から導ける** | GH 6663697601（2 レシピを調査対象）、6673566588（両レシピの構成と crudaiola 例外を承認） | 導出どおり |
| Prep Q2 | 正準順で既存ラベル変化 0 件、非正準は全件列挙＋個別承認 | **既存決定から導ける（粒度のみ後で確認）** | #748 6651668675：「正準順の変化は 0 件を維持」「新しい差分は新しい監査と Owner Gate」「将来バッチの一括承認ではない」。[SES]「非 canonical は Owner の明示承認」。B18 は「監査済み集合」の承認だった | 方針は導出どおり。「1 件ずつ」か「集合で」かは、**Phase 3 で実際の件数が出てから** Owner が選ぶ |
| Prep Q3 | Owner の明示 GO が実装の必須条件 | **既存決定から導ける** | R2 §2.2 の条件 3、[SES]「GO が出ても明示承認まで実装しない」 | 導出どおり |
| Prep Q4 | #759 merge 前は実装しない | **既存決定から導ける（充足済み）** | GH 6673566588 の順序条件。#759 は merged | 解消済みとして記録 |
| Prep P1 | AC-8b：SAUCE または CHEESE の有料ヒント 1 段で区別できれば合格 | **既存決定から導ける** | [SES]「AC-8：有料 Hint で SAUCE と CHEESE を区別できること」。合格基準を「どちらか 1 段」とする緩和は Prep の解釈 | 基準の文言（「どちらか 1 段」）だけ、Q1 の承認時に確認 |
| Prep P2 | 非正準ラベル差分は 1 件ごとに報告、未承認が残れば Gate HOLD | **既存決定から導ける** | [SES]「非 canonical の変更は Owner の明示承認が必要」。#748 6651668675 の「無断の拡大禁止」 | 導出どおり |

**集計:** 承認が必要 4（D1、D3〔id〕、D9、Q1）／既存決定から導ける 8（D5、D7、D8、Q2、Q3、Q4、P1、P2）／実装時の暫定値 1（D4。D3 の日本語名を含めると 2）。

### B2.2 Owner に求める判断（最小）

1. D1：名称「ブッラータ」（エイリアス「ブラータ」）を承認するか。
2. D3：recipe id 2 つを承認するか（日本語名は暫定）。
3. Q1：pesto-burrata 近傍の例外（C1〜C5）と AC-8b を承認するか。
4. D9：Issue 起票を GO と同時に承認とするか。
5. 「導ける」8 件を、このとおり確定として良いか（異論がなければ記録のみ）。

### B2.3 記録方法の提案

Owner の回答を **#748 に 1 件のコメントとして記録**する（本セッションは投稿しない）。実装 PR のテスト・コメントは「Owner 決定（#748 コメント）」を一次証拠として引用でき、Prep の D 番号に依存しない。

## B3. docs-only 取り込み PR の準備（**ローカルで準備済み・PR 未作成・未 push**）

**準備ブランチ:** `claude/teto-pizza-batch-19-docs-import-prep`（`origin/main` `785d7956` から作成、作業ツリーは `/tmp/…/scratchpad/wt`。**リモートへは push していません**：指定の開発ブランチ以外への push は許可がないため。push と PR 作成は Owner の許可後）。

### B3.1 変更ファイル一覧（4 ファイル、すべて新規追加。main の既存ファイルは変更しない）

| # | ファイル | 出典 | 変更 |
|---|---|---|---|
| 1 | `docs/reports/TETO_EXPANSION-BATCH-19_Prep.md` | `claude/teto-pizza-batch-19-prep-xvizrg` `9903b33f` | **Rev 5 に更新**（B3.2） |
| 2 | `docs/reports/data/TETO_EXPANSION-BATCH-19_PREP_jaccard.json` | 同上 | **無修正**（`diff` で出典と同一を確認） |
| 3 | `docs/decisions/TETO_ICONS-HERBS-BURRATA_R2_OWNER-DECISIONS_2026-11-06.md` | `claude/r2-owner-decisions-docs-8auzii` `2f29318f` | **状態を更新**（B3.2） |
| 4 | `docs/reports/TETO_EXPANSION-BATCH-19_PreImplementation_Fresh-Audit.md` | 本ブランチ | 本書（追記 1・2 を含む最終版を取り込み時に反映） |

**含めないもの（Owner 判断）:** ハーブ・burrata の R2 Result Report、FINISH チーズの将来タスク文書、候補 SVG／画像（`claude/herb-icons-compare-docs-8auzii` は 89 ファイル、`claude/burrata-preflight-docs-8auzii` は 73 ファイルで PNG を多数含む）。Prep と R2 記録は、これらを「ブランチ名＋コミット SHA」で参照している。取り込み後も、次の参照は main 上では解決しない：`docs/reports/TETO_HERB-ICONS-COMPARE_2026-11-05_R2_Result.md`、`docs/reports/TETO_BURRATA-PREFLIGHT_2026-11-05_R2_Result.md`、`docs/design/TETO_FINISH-CHEESE_FUTURE-TASK_2026-11-05.md`（参照切れの確認済み。`e2e/b19.spec.ts` は将来のファイル）。**選択肢:** (a) 取り込まず、ブランチ参照のまま（推奨：PR を小さく、PNG を持ち込まない）、(b) テキスト 3 文書だけ追加で取り込む、(c) 画像込みで全取り込み。

### B3.2 修正内容

**Prep Rev 5**（過去の記述は履歴として残し、更新箇所に「【Rev 5 更新】」を付与。10 か所）
- 先頭に「改訂 5」の説明（状態更新のみ、Owner 決定・仕様・受入条件は不変）。
- §0 項目 6、§1 の「#759 は Draft／HOLD」、§1.2 の #759 行・merge 承認行、§7.0 S-1（**充足**）・S-3（**未充足のまま**）：#759 merged（`785d7956`、2026-11-06T13:15:08Z、最終 HEAD `c533a4f1`、main の WebKit E2E は SUCCESS）を反映。
- §7.0 の #758 claim 行：**release 済み**（コメント 6679761024）を反映。
- §0.1 の直後に **D 番号の注記**（本書の D1〜D9 は R2 記録の D1〜D9 と別の番号体系、対応関係、D1・D3・D4・D7・D9 と Q1・Q2・P1・P2 は GitHub 未記録）。**Prep の D 番号自体は変更しない**（既存の引用を壊さないため）。
- §2.3.1 に将来リスク（`burrata-pizza`＝matrix 行 117 を足すと crudaiola の近傍 5 件目、Jaccard 0.429、C2 により再判断）。

**R2 決定記録**（Owner 決定 D1〜D9 の内容は**変更しない**）
- Status：「#759 は merge 済み。残りは claim の解消と Owner の明示 GO」。
- §2.1：#759 を**完了**（`785d7956`）、最新 main を `785d7956`、#748 claim の期限を「〜2026-11-18」から **「〜2026-11-19（最新コメント 6650377722、解放の投稿なし）」へ訂正**、#758 claim の release を追記。
- §2.2 条件 1 に「充足」を追記。§2.4 を新設し、**Prep の D 番号との対応表**を追加。

### B3.3 競合状態

| 観点 | 結果 |
|---|---|
| main との衝突 | **なし**。4 ファイルとも `origin/main` に存在しない新規ファイル（`git status` で未追跡のみ） |
| open PR・ブランチとの同名ファイル | 同名のファイルを持つ open PR は確認範囲でなし（Batch 19 関連のリモートブランチは 2 つの準備ブランチと本監査ブランチのみ） |
| 他の docs PR との重なり | #753・#751・#747 は別ファイル。`PROJECT_HANDOFF.md` など HOT の docs は**変更しない** |
| claim | docs のファイルは #748 claim の対象（`docs/reports/TETO_EXPANSION-BATCH-18_*`）と重ならない。B19 の `docs/reports/TETO_EXPANSION-BATCH-19_*` は未 claim。**docs-only のため新規 claim は不要**（SESSION-OPERATIONS は任意の警告）。Owner が望む場合は PR 作成時に投稿 |
| PR テンプレート | リポジトリに PR テンプレートなし（`.github/PULL_REQUEST_TEMPLATE*`、`pull_request_template.md` を確認） |

### B3.4 検証計画と事前確認の結果

| 項目 | 結果 |
|---|---|
| CI classify（`scripts/ci/classify-ci-docs-only.mjs`、ローカル実行） | **JSON を含めると `docs_only=false`**（「`docs/reports/data/…jaccard.json` は documentation-only ではない」）→ **ci.yml の lint／Vitest／build が走る**。JSON を除いた 3 つの Markdown だけなら `docs_only=true`（スキップ） |
| WebKit classify（`scripts/ci/classify-webkit.mjs`） | 4 ファイルとも **`webkit_required=false`**（docs/** のため WebKit をスキップ） |
| ファイルを読むテストへの影響 | `src/` の `docs/` 読み取りは**固定パス**（例：`TETO_LARGE-CATALOG-UX_SCALE-MODEL.json`）で、ディレクトリ走査は確認できず。新規ファイルが既存テストに影響する根拠なし（**Vitest は未実行**：`node_modules` が無いため） |
| JSON の一致 | 出典ブランチの JSON と**バイト一致** |
| 参照パスの確認 | `src/`・`docs/` の実在パスは解決。解決しないものは B3.1 のとおり（意図的） |
| 取り込み後の CI | PR 作成後、**ci.yml の全ジョブ（JSON を含む場合）と Codex レビュー**を確認。赤は隠さず原因を分離。**merge は Owner の承認後** |
| 選択肢 | **(i) JSON も含める**（ci.yml が走るが問題なしの見込み、推奨：Prep の参照を完結させる）、(ii) JSON を除く（CI を軽くできるが Prep の参照が切れる） |

### B3.5 PR の下書き（**未作成**）

- **タイトル案:** `docs(batch19): Batch 19 Prep Rev 5・R2 Owner 決定記録・実装前 Fresh Audit を main へ取り込み（docs-only、Refs #748 #417）`
- **ベース:** `main`（`785d7956`）／**ブランチ:** `claude/teto-pizza-batch-19-docs-import-prep`（push は許可後）
- **本文の要点:** 4 ファイルの新規追加・状態更新のみ、`src/`・`e2e/`・CSS・テスト変更なし、実装・Production ON・共有 Preview 更新・merge なし、Owner の明示 GO まで Batch 19 は実装しない、取り込まないもの（B3.1）、検証（B3.4）、`Depends-on` なし。
- 末尾にこのセッションの PR 用の署名行を付ける。

## B4. 実装開始に残るブロッカー（更新）

| # | ブロッカー | 状態 |
|---|---|---|
| 1 | **Owner の明示 GO** | 未取得 |
| 2 | **#748 の未解放 claim**（`6650377722`、期限 11-19） | 未解消。B1 のコメント案を Owner が承認して投稿、または Owner が失効を判断 |
| 3 | **Owner 承認が必要な 4 項目**（D1・D3 の id・D9・Q1）と、導出 8 件の確定 | 未回答（B2.2）。#748 への 1 コメント記録を提案 |
| 4 | **docs 取り込み PR の作成許可**（push 許可を含む）と、B3.1／B3.4 の選択（参照 3 文書・JSON の扱い） | 未許可。PR 作成直前で停止中 |
| 5 | 実装直前の再計測（step 70・件数・Jaccard・Research・Hint） | 実装セッションの作業 |

**解消済み:** #759 merge、main の WebKit E2E（SUCCESS、Owner 確認）、#758 の claim release、Q4。
