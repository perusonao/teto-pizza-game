# Expansion Batch 19 — 実装前準備（食材・レシピ重複検査／アイコン仕様／調理工程／受入条件／テスト計画）

**種類:** docs-only。`src/`・`e2e/`・CSS・ゲームロジック・テストは変更していません。食材・レシピの実装、Production ON、共有 Preview 更新、merge は行っていません。
**ブランチ:** `claude/teto-pizza-batch-19-prep-xvizrg`（`origin/main` `fa67c72`＝#765 取り込み後から作成。PR #759・#761 のブランチには触れていません）。
**入力（Owner 承認済みの設計資料）:**
- Issue #748 の Owner 決定: 2026-11-05 16:45 UTC「Parallel Investigation」（コメント 6663697601）と 2026-11-06 00:48 UTC「R2 preflight」（コメント 6673566588）。
- ハーブ 4 食材 R2: ブランチ `claude/herb-icons-compare-docs-8auzii` の `c9351e4`（`docs/reports/TETO_HERB-ICONS-COMPARE_2026-11-05_R2_Result.md`）。
- ブッラータ R2: ブランチ `claude/burrata-preflight-docs-8auzii` の `d39a680`（`docs/reports/TETO_BURRATA-PREFLIGHT_2026-11-05_R2_Result.md`、`docs/design/TETO_FINISH-CHEESE_FUTURE-TASK_2026-11-05.md`）。
- 候補 SVG: 上記 2 ブランチの `docs/design/candidates/ingredient-icons-2.0-{herbs,burrata}/`（**どちらも未 merge**。実装時に必要なファイルだけを移す）。

**原典:** pizzadb.jp は未確認です。根拠は 172 matrix の 2 行（`pesto-burrata-pizzadb-p12`、`pizza-alla-crudaiola-pizzadb-p8`）だけで、個数・焼成窓・価格・色はすべて **GAMEPLAY ASSUMPTION** です。

---

## 0. 要約（先に結論）

1. **Batch 19 = 新食材 1（burrata）＋ 新レシピ 2（pesto-burrata、pizza-alla-crudaiola）＋ 通常 ladder step 1。新しい調理工程は不要**（SAUCE ×2 → CHEESE → TOPPING → BAKE。FINISH・後乗せ・下ごしらえ・生地は使わない）。
2. **ハーブ 4 種（rosemary B / oregano B / spinach A2 / artichoke A2）は Batch 19 のレシピが使わない食材**です。描画のみの別 PR（Icons 2.0）にでき、ladder・Research・保存に影響しません。burrata の専用 SVG（C）だけは新食材と同じ PR に入ります。
3. **重複検査: 完全一致・部分集合・上位集合・1 材料差は 0 件**（main 88 件＝通常 80＋late 8、および B18 反映後の 90 件の両方で確認）。Jaccard は pesto-burrata が最大 0.333、crudaiola が 0.429。
4. **新しい発見（R2 preflight にない点）:** crudaiola の 0.429 の近傍が **バッチ内の pesto-burrata（0.429）を含めて 4 件**になります。R2 の例外根拠は既存 3 件だけで書かれているため、承認文案を 4 件に更新して再確認してもらう必要があります（§2.3、Owner 判断 D2）。
5. **着手の前提は #759（B18）の merge**。ladder step が 69（cilantro／baingan）→ **70（burrata）**になり、監査ツール `researchLabelAudit.ts` や `B18_BATCH` も #759 にしかありません。Owner の 2026-11-06 の順序指示（#765・#759・#760 の merge 後）のうち、**#760・#765 は main に取り込み済み、残りは #759**です。
6. Owner 判断が必要な事項は **§8 の D1〜D9**。特に D1（表記「ブッラータ」か matrix の「ブラータ」か）は食材名・レシピ名・Research ラベルに出るため実装前に必須です。

---

## 1. 現在の main（`fa67c72`）と B18 後の想定

| 項目 | main `fa67c72`（B18 未反映） | #759 merge 後（B18 報告の数値） | Batch 19 後（**想定・実装時に再計測**） |
|---|---|---|---|
| レシピ（Pinsa 開／閉） | 88／87（通常 80＋late 8／7） | 90／89 | 92／91 |
| credited | 78 | 79 | **80**（pesto-burrata のみ credited） |
| 食材 id | 97 | 97 | **98**（burrata） |
| 通常 ladder step | 68（sour-cream／goulash） | 69（cilantro／baingan） | **70（burrata／pesto-burrata）** |
| late の導出番号 | 69–75 | 70–76 | 71–77（+1） |
| 章サイズ（最終章） | 51 | 53 | 55（B18 が 2 レシピで +2 だった前例に倣う想定） |
| Lunch Rush プール | 25 | 25 | 25（両レシピ `lunchRush:false`） |

- main の 88 は `recipes.ts` の `id:` 80 件と `lateCatalog.ts` の 8 件（pinsa-romana を含む）を数えた値。B18 の数値は PR #759 の Result Report を引用したもので、**この環境で #759 を検証し直してはいません**。
- #759 は **Draft／HOLD**（iPhone Safari HV と Owner の merge 承認待ち）。B18 が merge されなければ burrata は step 69 になり、本書の step 番号・件数は全て 1 つずれます。**実装開始時に必ず再計算**してください（B18 Design-Audit と同じ運用）。
- 食材の追加は ordinary 側 1（burrata）だけで、late カタログ・`LATE_ENTITLEMENT_FLOORS` には触れません（案 P、§4.2）。

### 1.1 干渉の確認（2026-11-06 時点）

| 対象 | 状態 | 本準備との関係 |
|---|---|---|
| PR #759（B18） | Draft／HOLD、HEAD `d9679e6` | 本ブランチは `docs/reports/` と `docs/reports/data/` の新規ファイルのみ。**ファイル重なりなし**。B19 実装の前提（§7） |
| PR #761（#758 大葉 1.35em） | Open、HEAD `468dfec`、`src/App.css`＋e2e＋docs | 重なりなし。ただし herb／burrata の描画補正が `App.css`（HOT）を触る場合は #761 の merge 後に rebase |
| #760（牛肉・ピーマン）／#765（360px はみ出し） | **main に取り込み済み** | 前提は充足 |
| #763・#757・#756・#762（Steam V2/V3 Lab）、#746（DRIZZLE）、#738（Steam S3） | Draft／Open | B19 は `src/data/*`・描画・テストのみ。重なりなし（`main.tsx`・`PizzaStage.tsx`・`src/preview/*` に触れない） |
| #753（Style Lock V2 §12）／#751（Fry 視覚） | Open | `docs/` のみ。アイコン仕様の文書化は #753 merge 後に追記するのが衝突しにくい |
| claim | #748 の claim（`recipes.ts`・`ingredients.ts`・`lateCatalog.ts` ほか、期限 2026-11-19） | **B19 の実装は #748 の claim 解放後**。本準備は docs のみで重ならない |

本ブランチは claim コメントを投稿していません（docs-only の準備で、`docs/reports/TETO_EXPANSION-BATCH-19_*` は他セッションの claim と重ならないため）。実装セッションが使う claim 文案は §7.4 に置いています。

---

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
- ⚠ **バッチ内の近傍（新規）:** R2 preflight の Jaccard 調査は 3 件（`..._R2-jaccard.json`）で、同じバッチの pesto-burrata を入れていません。pesto-burrata との共有は **非スターター 3 素材（olive-oil・burrata・fresh-tomato）**で、R2 が根拠にした「非スターター 1 素材だけ」「スターター除外 0.2」は **この近傍には当てはまりません**（スターターを除いた集合は pesto-burrata が {pesto, burrata, fresh-tomato, olive-oil}、crudaiola が {olive-oil, burrata, fresh-tomato, arugula} 〔tomato-sauce・mozzarella を除く〕で、Jaccard 3/5 = 0.6）。Owner が承認した「0.429」の数値自体は同じですが、**根拠の説明を更新して再確認してもらう必要があります**（D2）。
- 回避策の評価（R2 §3.3 の再確認）: オイルを抜く／トマトソースを抜く案は、原典（matrix の 2 層）から離れるか jamon-serrano との類似をむしろ悪化させる（0.5）。pesto-burrata の 2 層（ペスト＋オイル）は Owner が採用済み。例外承認（このレシピ限り）が最も原典に近い、という R2 の結論は維持。
- 例外の枠: B18 の OD-B18-3（baingan 0.43）と同様、「**このレシピ限り**」「全体 0.4 基準・同一／部分集合／上位集合の禁止・Research 規則は不変」とし、`expansionBatch19.test.ts` に近傍 4 件を名前付きで固定する。

### 2.4 Research ラベルへの影響（見込みと必要な監査）

- burrata のステップで解禁されるのは pesto-burrata と crudaiola の 2 件（必要な他の素材は全て既存）。cohort は {pesto-burrata, crudaiola} の 2 メンバーなので、**新規 2 件は文字付き（A／B）**になります（Research 表示例「？？？ピザ A（ブッラータ）」）。
- 既存レシピの文字は、**正準 ladder 順では動かない**はず（burrata は既存レシピに含まれない）が、非正準な取得順では共有素材（olive-oil・fresh-tomato・arugula・pesto・tomato-sauce・mozzarella）経由で変わりうる。R2 preflight の見込みは「正準順 0 件、非正準 23 件」（#759 HEAD `33bc275` 基準）。**この数値は本準備で再計測していません**（`researchLabelAudit.ts` が #759 にしか無く、main では実行できないため）。
- B18 の OD-B18-4 は「**将来のバッチで新たな既存レシピが影響を受ける場合は改めて監査と Owner Gate が要る**」と明記しています。**B19 は新規の監査と Owner Gate が必要**です（D6）。

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
| burrata（新） | 存在しない | **C**（裂け口・クリームが見える玉） | `burrata-C.svg` | `burrata-torn-ball` | `l`（チーズの前例: ricotta・feta などと同じ） | **B19 PR** |

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
| 提案 recipe id | `pesto-burrata-pizza`（仮） | `pizza-alla-crudaiola` |
| 主ソース（PAINT、Reference 対象） | `pesto`（`recipeSauceProfiles.ts` に追加） | `tomato-sauce` |
| 2 本目ソース（PAINT_TEMPORARY、presence 判定） | `olive-oil` | `olive-oil` |
| チーズ | burrata（唯一） | mozzarella ＋ burrata |
| 具材 | fresh-tomato | fresh-tomato・arugula |
| 暫定の個数（**ASSUMPTION**） | pesto 1／olive-oil 1／burrata 2／fresh-tomato 2 | tomato-sauce 1／olive-oil 1／mozzarella 2／burrata 2／fresh-tomato 2／arugula 2（非ソース 8＝8 スロットのリング） |
| ladder | **step 70 の key**（credited） | `ladderCredit:false`（porcini-pizza・grandma と同じ前例） |
| Research | cohort {pesto-burrata, crudaiola}、burrata が cohort key（文字 A／B） | 同左 |
| 例外 | なし（Jaccard 最大 0.333） | **Jaccard 0.429 の個別例外**（§2.3、D2） |

- **個数は未確定の仮置き**です（R2 は pesto-burrata の例だけを示し、crudaiola の個数は決めていません）。Reference の 8 点リングとの整合、焼成の見え方は Preview HV で調整する前提で、実装 PR の本文に「暫定」と明記します。
- 説明文（`description`）は Anti-Oracle のため**調理時期・材料名を出さない**（既存レシピと同じ）。
- 2 つのレシピは同じ step で同時に解禁されます（B14 の moussaka＋bbq と同様の「同時解禁」）。Owner が既に承認した形ですが、報告に明記します。

### 4.3 新食材 burrata のデータ仕様（提案）

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

- AC-8 Research: 新 2 件が「A／B（ブッラータ）」で出る（D1 の表記に従う）。未発見レシピ名・材料の漏えいなし。**正準 ladder 順で既存レシピの文字の変化 0**。非正準順の変化は監査（`researchLabelAudit`）で数え、Owner の承認範囲に**固定**する。
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

1. **Research ラベル監査**: #759 の `researchLabelAudit.ts` を使い、B19 前後の既存ラベル差を数える（正準順＋非正準の全パターン。予備: 乱数順 600 通り）。正準順で 1 件でも動けば**停止して報告**。
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

### 7.1 順序

```
[今] 本準備 (docs-only PR)  ──Owner 判断 D1〜D9──┐
                                                  │
G0  #759 (B18) の iPhone HV PASS + Owner merge 承認 → merge     ← 唯一の未充足の前提
    └ #760・#765 は main に取り込み済み
    └ #761 (App.css) は merge または rebase 方針を決める
    └ #748 の claim 解放（期限 2026-11-19）、他 claim の再確認
                                                  │
S1  最新 main に更新 → claim 投稿 → 重複検査・step 番号・件数の再計算
S2  scratch 測定（§6.1）→ 差が出たら Owner に提示して停止
S3  PR-I  Icons 2.0 ハーブ 4 種（描画のみ）          ← B19 と独立。S4 の前でも後でもよい
S4  PR-B  B19: burrata（＋専用 SVG C）＋ 2 レシピ＋ step 70
S5  CI（Pinsa ON/OFF、WebKit 全シャード）、最新 HEAD の Codex レビュー、Owner HV → merge 判断
```

- **PR-I と PR-B は同じ 3 ファイル（`ingredients.ts`・`IngredientGlyph.tsx`・`App.css`）を触る**ため、同時に出さず**順番に**進める（後の PR が rebase）。どちらを先にしてもよいが、**PR-I を先に推奨**（描画のみで ladder・Research に影響せず、PR-B の rebase 範囲が小さい）。PR-B は `recipes.ts`（HOT）・`PROJECT_HANDOFF.md`（HOT）を触るので、他の PR との merge 順を claim に明記する。
- 代替（Owner が crudaiola の例外を承認しない場合）: PR-B を「burrata＋pesto-burrata」に縮小し、crudaiola は別 PR（または取りやめ）にする。ladder step は burrata の 1 つで同じ。ただし crudaiola を後から足すと、**同時解禁ではなく cohort の文字が変わりうる**ため、その場合も Research の監査を再実行する。

### 7.2 依存関係表

| 依存 | 種別 | 理由 |
|---|---|---|
| #759 merge → B19 | **必須（ブロッカー）** | step 番号（70）、`researchLabelAudit.ts`、`B18_BATCH`、cilantro の昇格が前提。Owner の順序指示 |
| #760・#765 → B19／Icons | 充足（main 取り込み済み） | `IngredientGlyph.tsx`・`App.css` の競合回避 |
| #761 → App.css の補正 | 条件付き | `App.css`（HOT）の `shiso-leaf` 周辺を触る。補正が必要なら #761 の後 |
| Owner 判断 D1・D2・D3 → B19 実装 | 必須 | 表記・例外文・recipe id は実装後に変えにくい（保存・識別・Research ラベルに影響） |
| Owner 承認（Icons の最終選択を含む）→ Icons PR | 必須 | 現状は「設計候補の承認」で、実装マージの承認ではない |
| FINISH チーズ拡張 → B19 | **依存しない** | 全材料が焼く前（Owner 承認） |
| Steam #756／#757／#763、DRIZZLE #746、Fry #749 | 干渉なし | 触るファイルが異なる。ただし claim の再確認は S1 で毎回行う |

### 7.3 見積りとリスク

- 変更ファイル（B19 PR、予定）: `recipes.ts`、`ingredients.ts`、`discoveryLadder.ts`、`discoveryCatalog.ts`、`recipeSauceProfiles.ts`、`recipeHintRoles.ts`、`hints.ts`（2 ソースの missing 文面）、`referencePizza.ts`、`orders.ts`、`ingredientTaxonomy.ts`／`toppingSizeClass.ts`、`IngredientGlyph.tsx`、`App.css`（必要な場合）、`recipeBatchManifest.ts`、golden JSON、テスト、docs、`PROJECT_HANDOFF.md` addendum（HOT）。
- 主なリスク: (1) 非正準順の Research ラベル変化（監査と Owner Gate が必須）、(2) pesto 主の 2 ソースが未検証（テストなし）、(3) crudaiola の例外根拠の更新（D2）、(4) 個数・窓・色が暫定、(5) #759 の merge タイミング（遅れれば全体が遅れる）、(6) 2 ソースの Hint 文面（`hints.ts` に grandma 専用のエントリがある。pesto 版の文面が必要）。

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

## 8. Owner 判断が必要な事項

| # | 判断事項 | 推奨 | 理由 |
|---|---|---|---|
| **D1** | **表記: 食材名・レシピ名を「ブッラータ」にするか、matrix の「ブラータ」にするか**（Issue 指示は「ブッラータ」、matrix のレシピ名は「ペストブラータピザ」） | 食材名は **ブッラータ**（原語 burrata の促音を表す）、レシピ名は matrix に合わせて **ペストブッラータピザ**／**ピッツァ・アッラ・クルダイオーラ**（要確認） | 表記は Research ラベル（「？？？ピザ A（ブッラータ）」）・ショップ・図鑑・検索エイリアスに出る。実装後の変更は保存・テストに波及する |
| **D2** | **crudaiola の Jaccard 0.429 の例外を、近傍 4 件（pinsa-romana・jamon-serrano・grandma・バッチ内 pesto-burrata）で再承認** | Yes（このレシピ限り）。承認文案を §2.3 に合わせて更新 | R2 の承認根拠は 3 件・「非スターター 1 素材」。バッチ内の pesto-burrata は**非スターター 3 素材**を共有するため、説明が変わる |
| **D3** | recipe id と日本語名の確定（`pesto-burrata-pizza`／`pizza-alla-crudaiola`） | §4.2 の提案 | id は保存・Dex に残る |
| **D4** | 個数・焼成窓 58–78・価格 T4（120／60）・色を「暫定（GAMEPLAY ASSUMPTION）」として実装し、Preview HV で調整してよいか | Yes | 原典未確認。B13〜B18 と同じ扱い |
| **D5** | Icons PR（ハーブ 4 種）を **B19 と別 PR**にし、先に進めてよいか。#759 の merge 前に着手してよいか | 別 PR を推奨。着手は #759 の merge 後（Owner の順序指示のとおり） | 同じ 3 ファイルを触るため順番に出す。描画のみで ladder に影響しない |
| **D6** | **B19 の Research ラベル監査を新たな Owner Gate として扱う**（B18 の OD-B18-4 は B18 限りで、新たな既存レシピへの影響は再承認が必要） | Yes。実装 PR で正準順 0 件を確認し、非正準の影響集合を Owner に提示 | OD-B18-4 の「黙って広げない」原則。R2 の見込み（非正準 23 件）は未再計測 |
| **D7** | pesto-burrata に mozzarella を足さない（burrata が唯一のチーズ）でよいか | Yes | matrix に mozzarella が無く、eggplant-ricotta-pizza の前例がある |
| **D8** | crudaiola を承認しない場合、B19 を「burrata＋pesto-burrata」に縮小してよいか | Yes（代替案） | §7.1 |
| **D9** | B19 専用の Issue を #759 merge 後に起票してよいか（#748 は B18 のタイトルのまま） | Yes。起票と claim は実装セッションが行う | 重複検索は本書 §2.1 で実施済み |

---

## 9. 本準備で実施したこと／していないこと

**実施:** Issue #748 の全コメント・PR #759／#761 の変更ファイル・R2 の 2 つの Result Report・FINISH チーズの将来タスク文書の読み取り。`recipes.ts`／`lateCatalog.ts` からの識別集合の抽出と Jaccard 計算（`docs/reports/data/TETO_EXPANSION-BATCH-19_PREP_jaccard.json`）。`ingredients.ts`・`toppingSizeClass.ts`・`ingredientTaxonomy.ts`・`recipeSauceProfiles.ts`・`App.css` の現状確認。Issue／PR の検索と open PR の一覧確認。

**未実施（明示）:** テストの実行（docs-only のため `src/` 無変更）／#759 の検証のやり直し／Research ラベル監査の再計測／画像・SVG の再測定（R2 の値を引用）／iPhone Safari の確認／claim・Issue・コメントの投稿／食材・レシピの実装／Production ON／共有 Preview 更新／merge。

**注意:** R2 の SVG 候補・画像は **未 merge の 2 ブランチ**にあります。実装 PR では必要なファイルだけを移し、無関係なファイルを持ち込まないでください（Owner 2026-11-05 の指示）。本書の数値のうち B18 反映後の件数・step は #759 の Result Report からの引用で、本環境では検証していません。
