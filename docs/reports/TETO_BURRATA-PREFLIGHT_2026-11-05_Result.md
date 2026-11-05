# burrata ＋ pesto-burrata / pizza-alla-crudaiola — 実装前検証（Result Report・docs-only）

**種類:** docs-only の実装前検証です。`src/`・CSS・ゲームロジック・テスト（spec）は変更していません。merge・Production ON・共有 Preview の更新もしていません。
**ブランチ:** `claude/burrata-preflight-docs-8auzii`（base は `main` `d85b957`）
**入力:** 並行調査 `a575960`（`docs/reports/TETO_PARALLEL-INVESTIGATION_2026-11-05_Result.md` §2 の案A）
**比較の基準:** PR #759（B18）の HEAD `33bc275e9e3ed1491ed742375d89158495e1db98` を読み取り専用の worktree で使い、**B18 の後のカタログ（90 レシピ・ladder 76 step（通常 69 ＋ late 7））**で計算しました。PR のブランチへの commit や push はしていません。
**確認したこと:** `CLAUDE.md`、`docs/PROJECT_HANDOFF.md`、HV Policy、SESSION-OPERATIONS §1/§8、最新の main（`d85b957`、前回から変化なし）、open PR（#759 / #760 / #761 / #763 の HEAD に変化なし）、claims（#748 は `ingredients.ts` ほか〜11-18、#759 の Preview seed は〜11-12、#733 は〜11-08、#758 は〜11-08）。新しい事実として、#759 は WebKit 360×800 の横はみ出しで RED です。Owner は 2026-11-05 に、`App.css` の修正を別 PR で先に行うと決定しています。
**原典:** pizzadb.jp には到達できず、未確認です。根拠は 172 matrix の行（`pesto-burrata-pizzadb-p12` / `pizza-alla-crudaiola-pizzadb-p8`、比較表 p12 / p8 の中継データ）だけです。以下の個数・焼成窓・後乗せの解釈は、すべて **GAMEPLAY ASSUMPTION** です。

## 0. 結論

| 検証項目 | 結果 |
|---|---|
| FINISH でチーズを置けるか | **置けません。** FINISH は 3 か所で topping に限定されています（§1）。実機でも、Free Cooking の FINISH トレイは topping 68/68 種を出し、チーズは 0 種でした（390×844 と 360×800 の両方）。 |
| オリーブオイルのみのソース | **構造上は成立します**（pizza-bianca や vongole など、olive-oil だけのレシピが既に 10 件あります）。ただし crudaiola の matrix はソースを「トマトソース＋オリーブオイル」の 2 層としており、**オイルのみは原典の中継データから外れる暫定の判断**です。pesto-burrata は「pesto＋オリーブオイル」の 2 層が matrix どおりで、**grandma-pizza の 2 ソース方式（主ソースを Reference で判定し、2 本目は使ったかどうかで判定）で実装できます**。Free Cooking で 2 層を塗れることも確認しました。 |
| Jaccard | 推奨構成では **pesto-burrata 0.333、crudaiola 0.333** で、基準の 0.4 を下回ります。crudaiola をトマト＋オイルにすると 0.429（jamon-serrano / grandma / pinsa）で超過します。pesto-burrata をオイルなしにすると 0.400 で、**基準ちょうどなので不合格**です。部分集合・上位集合の関係はどの構成にもありません。 |
| Research | **正準 ladder 順で既存ラベルの変化は 0 件**（3 構成とも）。新しい 2 レシピは burrata の cohort で A / B になります。非正準の取得順では、既存の **23 件**の文字が変わり得ます（前例は B15 が 19 件、B16 が 4 件、B17 が 18 件、B18 が 39 件）。B18 と同様に Owner の承認と固定テストが必要です。 |
| Hint 5.0 | 新レシピは key-free（全 late recipe とその後の batch の前例どおり）。CHEESE の段がブラータの名前を出しますが、いつ置くかは出しません（ikura / tarako と同じ性質）。 |
| 解禁 | **後乗せの構成によって制約が変わります**（§4）。2 つの late レシピが新しい late 専用素材 1 種を共有する構成は、`validateLateCatalog` が許しません。 |
| 既存 PR との重複 | 変更が必要なファイルの大半が **#759 と重なります**（`ingredients.ts`・`recipes.ts`・`lateCatalog.ts`・`discoveryLadder.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`toppingSizeClass.ts`・golden）。**実装は #759 の merge 後に限られます**。 |

**推奨（構成1）:** burrata は **通常の cheese として焼く前に置く**素材にします。**pesto-burrata** は通常レシピ（credited、通常 ladder の step 70 = burrata）、**crudaiola** は late のレシピ（`ladderCredit:false`）とし、**fresh-tomato と arugula を後乗せ**、ソースはオリーブオイルだけにします。これなら **FINISH エンジンの変更は不要**で、validator の現行規則にも合います。

## 1. FINISH でチーズを置けるか（コードと実機）

| 場所 | 現在の規則 | 根拠 |
|---|---|---|
| `src/state/gameReducer.ts` の `PLACE_TOPPING` | `if (inFinish) { if (placingIngredient.category !== "topping") return state; }`。FINISH ではチーズの配置を**拒否**します | L1110 前後（main） |
| `src/logic/prepareDock.ts` の `finishTrayIngredients` | `ingredientsByCategory("topping")` だけを、owned かつ scatter に絞って並べます。Free Cooking ではすべての topping、Guided では late requirement だけです | L51–57 |
| `src/state/undoPlacement.ts` | FINISH で 1 つ戻せるのは `stage === "post"` かつ `category === "topping"` の駒だけです | L40–48 |
| `src/components/PostBakePiece.tsx` | `IngredientPieceVisual` を style なしで描きます（焼き色は付きません）。チーズの場合は `.pizza-cheese` のラッパーに入ります。**描画自体はチーズでも成り立つ見込みです**が、未検証です | |
| 判定（`signature.ts` の `late` 軸、`finishEngine.pizzaForFinalEvaluation`） | **カテゴリに依存しません**（`stage === "post"` の id だけを見ます） | |

実機の証拠（Chromium、`docs/reports/data/TETO_BURRATA-PREFLIGHT-20261105_finish-tray.json`）: Free Cooking の FINISH トレイは 2 ケース × 2 viewport のすべてで `chips 68 / toppingsListed 68 / cheeseInFinishTray []` でした。

**burrata を後乗せにするための追加変更（構成2・3 の場合）:** 上の 3 か所に加え、Free Cooking の FINISH トレイにチーズを並べるかどうか（すべてのチーズか、一部か）の仕様、mozzarella（Canvas 描画）を後乗せで置いたときの扱い、FINISH の Undo と在庫のテスト、`gameReducer.ts`（HOT）の変更が必要です。OD-CS-3 は「後乗せは recipe 側の情報で、ingredient master に置かない」と定めているので、「後乗せできるチーズ」というフラグを素材に持たせる方式は採れません。カテゴリ単位で一般に開放することになります。

**根拠の強さ:** matrix の 2 行とも `postBakeFinish: []` で、**ブラータを後乗せする根拠はありません**（crudaiola の「生のせ」も料理名からの解釈です）。

## 2. ソース構成

| レシピ | matrix | 構成案 | 判定 |
|---|---|---|---|
| pesto-burrata | sauceFamily バジル → `pesto`。2 層 `pesto` + `olive-oil`（MULTI_SPREAD_LAYER） | **pesto（主、PAINT）＋ olive-oil（2 本目、PAINT_TEMPORARY）**。grandma と同じ方式 | 成立します。Free Cooking で 2 層を塗れて、RESULT に 2 ソースが出ることを確認しました（`pesto-burrata-standin-*`）。オイルを抜くと Jaccard 0.40 で不合格 |
| crudaiola | sauceFamily トマトソース。2 層 `tomato-sauce` + `olive-oil` | **olive-oil のみ（PAINT_TEMPORARY、pizza-bianca と同じ）** | 構造上は成立します。**matrix から外れる暫定の判断で、Owner の承認が必要です**。トマト＋オイル（grandma 方式）にすると 0.429 で、Jaccard の例外が必要 |

注: matrix の注記「current SAUCE supports exactly one」は、grandma-pizza（#521）の出荷より前の記述で、現状とは合いません。

## 3. Jaccard・Research（B18 の後のカタログ、`docs/reports/data/TETO_BURRATA-PREFLIGHT-20261105_research-audit.json`）

| 構成 | pesto-burrata の最大値 | crudaiola の最大値 | 正準順での既存の変化 | 非正準順で変わり得る既存 | 新しいレシピの文字（正準） |
|---|---|---|---|---|---|
| **V1**（pesto＋オイル／オイルのみ）**推奨** | 0.333（pesto-caprese / pollo / gamberi） | 0.333（chilean-napolitana） | **0** | 23 件 | A / B |
| V2（pesto＋オイル／トマト＋オイル） | 0.333 | **0.429**（jamon-serrano / grandma / pinsa） | 0 | 23 件 | A / B |
| V3（pesto のみ／オイルのみ） | **0.400**（基準ちょうどで不合格） | 0.333 | 0 | 23 件 | A / B |

- 方法: B18 の `researchLetterChangesAcrossOrders`（テスト支援用、本番の規則は不変）を使い、burrata を有限素材として ladder の末尾に置く mock で、正準順の全 prefix、材料の組み合わせ、乱数順 40 通りを比較しました。実装では burrata が step 70 に入るため、**実装 PR で同じ監査をもう一度実行し、固定集合を確定する必要があります**。
- 変わり得る 23 件の内訳は、オリーブオイル系（pizza-bianca / fugazza / vongole / grandma / feta-eliniki ほか）、pesto 系（genovese / pesto-pollo / patate / trapanese / salmone / caprese）、fresh-tomato・arugula 系（jamon-serrano / pinsa-romana / rucola-e-grana / california / chilean-napolitana / veggie-supreme）、baingan（B18）、quattro-formaggi です。
- 監査テストは vitest の既定タイムアウト（5 秒）を超えましたが（実行時間 9.7 秒）、最後まで完走して結果を書き出しています。

## 4. 解禁条件と ladder の構造

| 構成 | 内容 | validator・ladder | FINISH の変更 |
|---|---|---|---|
| **構成1（推奨）** | burrata は通常の cheese（`ingredients.ts`、`unlockCondition`、T4 120 Pitz、星の条件なし）で、焼く前に置く。pesto-burrata は通常レシピ（`recipes.ts`）で credited、通常 ladder の **step 70 `[burrata]`**、key は pesto-burrata。crudaiola は late（`lateCatalog.ts`）で `ladderCredit:false`、POST_BAKE は fresh-tomato と arugula、ソースは olive-oil | `ladderCredit:false` の late レシピが使うのは通常素材だけなので、P3-a2 の規則を満たします。late の step（現在 70〜76）は 71〜77 にずれます（B18 で cilantro を 69 に入れたときと同じ append の形） | **不要**（FINISH は topping だけで足ります） |
| 構成2 | burrata を後乗せにし、2 レシピとも late | 両方が late 専用の burrata を共有します。片方が key のとき、もう片方は credited だと key がなくて到達不能、uncredited だと late 専用素材を使うので違反になり、**validator が拒否します**。回避するには「late step が通常素材を名指しする」新しい形か、validator の変更が要ります | 必要（§1） |
| 構成3 | burrata を通常素材にし、2 レシピとも late・後乗せ | late step の key が要るので構成2 と同じ問題があり、通常 step が late レシピを key にできるかどうかも未確認です（`buildAppendOnlyLadder` は base の `RECIPES` から導出します） | 必要 |

## 5. 必要な変更ファイル（構成1）とリスク

| ファイル | 変更内容 | 重なり・リスク |
|---|---|---|
| `src/data/ingredients.ts` | burrata の行。`pieceVisual` を持つチーズにする（例: `burrata-ball`。CSS の白い円盤だと goat / paneer / catupiry と同じ見た目になるため。並行調査 P1） | **#748 claim（〜11-18）、#759 と重なる** |
| `src/components/IngredientGlyph.tsx` | burrata の SVG | **#733 claim（〜11-08）、#760 と重なる** |
| `src/data/recipes.ts` | pesto-burrata | #759 と重なる |
| `src/data/lateCatalog.ts` | crudaiola と discovery target id | #759 と重なる |
| `src/data/discoveryLadder.ts` | step 70 | #759 と重なる（B18 が step 69） |
| `src/data/recipeSauceProfiles.ts` | pesto（主）、olive-oil（crudaiola） | #759 と重なる |
| `src/data/recipeHintRoles.ts` | 2 件とも key-free | #759 と重なる |
| `src/data/referencePizza.ts` | Reference の座標 | #759 と重なる |
| `src/data/toppingSizeClass.ts` | burrata のクラス（チーズの `l` 相当） | #759 と重なる |
| `src/data/orders.ts`・dialogue・`completionMessages.ts` | 注文のセリフ・説明（late は Lunch Rush の対象外。pesto-burrata は `lunchRush:false` の前例に合わせる） | #759 と重なる（orders） |
| golden（`hint5.ladders55.json`・`hint5.alphaFamilyOnly.json`・catalog golden） | 再生成 | #759 と重なる |
| テスト | `expansionBatch19.test.ts`、persistence の round trip、`researchLabelAudit` での固定集合、`e2e/b19.spec.ts`（390 / 360 の WebKit） | 新規 |
| `App.css` | 原則として変更しない（必要なら glyph の補正だけ） | HOT（#761、WebKit はみ出しの修正 PR） |

**リスク:** ① #759 の merge 待ち（現在 WebKit の RED → `App.css` の修正 PR → #759 の rebase、の順で待ちが連なる）。② 焼いたブラータは、溶けたモッツァレラや淡いオイルの面の上で白どうしになって溶け込みます（代用の撮影でも確認。リコッタで代用）。並行調査の P2 と同じ問題で、専用 SVG に輪郭線を付けるのが前提です。③ crudaiola のオイルのみは原典の中継データから外れる暫定の判断です。④ 非正準順での 23 件の文字の変化は表示だけで、保存・採点・在庫は変わりません。B18 と同じく Owner の承認が必要です。

## 6. 画像（`docs/reports/screenshots/burrata-preflight-20261105/`、Chromium、DSF 2）

ブラータの ID はまだ存在しないので、**リコッタで代用**しています。Free Cooking で作った代用の盤面です。

- `pesto-burrata-standin-{1sauce,2topped,3finish-tray,4finish-placed,5result}-{390x844,360x800}.png`: pesto＋オイルの 2 層、FINISH トレイにチーズがないこと、RESULT のソース 2 種。
- `crudaiola-standin-*`: オイルのみ、FINISH でトマトとルッコラを後乗せ（焼き色なし）、RESULT。
- `burrata-preflight-strip-390x844.jpg`: 上の 2 ケースを 1 枚にまとめたもの。

UI の変更はないため、HV 動画の対象外です（HV Policy §2「docs-only」）。

## 7. Owner 判断事項（推奨つき）

1. **構成1（burrata は焼く前、crudaiola だけ late でトマトとルッコラを後乗せ）を採るか。** 推奨は Yes。FINISH の変更が不要で、現行の validator に合います。
2. **crudaiola のソースをオリーブオイルのみとする暫定判断を承認するか。** 推奨は Yes（Jaccard 0.333）。トマト＋オイルにするなら 0.429 の例外承認が必要です。
3. pesto-burrata は matrix どおり pesto＋オイルの 2 層にするか。推奨は Yes。オイルなしは 0.40 で不合格です。
4. burrata を専用 SVG のチーズにするか（CSS の円盤にしない）。推奨は Yes。白い円盤 3 種との混同を避けるためです。
5. 実装の着手は #759 の merge 後とすること（推奨）。それまでは、この検証とアイコン候補の作成だけを並行で進めます。

## 8. ステータス

- **完了:** FINISH のチーズ可否（コードと実機）、ソース構成、Jaccard と Research（B18 の後）、Hint 5.0、解禁構成、変更ファイルとリスクの整理、代用の画像。
- **未完了:** burrata の SVG 案、実装 PR、iPhone Safari の HV。
- **ブロッカー:** #759 の merge（その前提として WebKit の横はみ出しの修正 PR）、§7 の判断。
- **次の行動:** §7 の判断を受けて、#759 の merge 後に構成1 で実装し、実装 PR で Research の監査をもう一度実行して固定集合を確定する。
