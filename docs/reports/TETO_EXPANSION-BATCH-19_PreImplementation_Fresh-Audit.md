# Expansion Batch 19 — 実装前 Fresh Audit（docs-only）

**種類:** docs-only。`src/`・`e2e/`・CSS・JSON・SVG・テストは変更していません。PR 作成・merge・Production ON・共有 Preview 更新・既存 PR ブランチへの push・claim の取得／変更は行っていません。実装は開始していません。
**ブランチ:** `claude/teto-pizza-batch-19-audit-u2ylym`（`origin/main` `785d7956` から作成。作業ツリーは clean を確認）。
**既存資料との関係:** Batch 19 Prep Rev 4（`claude/teto-pizza-batch-19-prep-xvizrg` の `9903b33`、`docs/reports/TETO_EXPANSION-BATCH-19_Prep.md`）と R2 Owner 決定記録（`claude/r2-owner-decisions-docs-8auzii` の `2f29318`）が詳細仕様の権威。**本書はそれらを再掲せず、2026-11-06 時点の差分・再計測・矛盾点・判定だけを書く。**
**限界:** 実装コードの実行（vitest・E2E）はしていません。件数・Jaccard は `recipes.ts`／`lateCatalog.ts` の静的解析（§4）。「実装時に実測する」と書いた項目は未測定です。原典 pizzadb.jp は未確認で、個数・窓・価格・色はすべて GAMEPLAY ASSUMPTION。

---

## 1. Audit 日時と main SHA

| 項目 | 結果 |
|---|---|
| Audit 日時 | 2026-11-06 13:2x UTC（GitHub／`git fetch` で取得） |
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
| S6 | 360×800・390×844 の両方でトレイの 1 画面 UX を維持（#764／#765 で 390px 未満はチップ名 10px・余白 3px。**「ブッラータ」は 5 文字で既存最長名より短く、横はみ出しの再発リスクは低い**が WebKit 360×800 で実測） |

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
