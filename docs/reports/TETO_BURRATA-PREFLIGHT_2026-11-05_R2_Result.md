# burrata ＋ pesto-burrata / crudaiola — Owner 判断の反映（第 2 回、Result Report・docs-only）

**種類:** docs-only。`src/`・CSS・ゲームロジック・テストは変更していません。**新レシピは実装していません。** merge・Production ON・共有 Preview の更新もしていません。
**ブランチ:** `claude/burrata-preflight-docs-8auzii`（第 1 回 `9e3fad9` の続き。base は `main` `d85b957`）
**入力:** 第 1 回 `docs/reports/TETO_BURRATA-PREFLIGHT_2026-11-05_Result.md` への Owner 判断。
**確認したこと:** 最新の main は変わらず `d85b957`。PR #759 / #760 / #761 / #763 の HEAD は変わっていません（`33bc275` / `5ac2462` / `468dfec` / `b1fc588`）。claims は、`ingredients.ts` が #748、`IngredientGlyph.tsx` が #733、`App.css` が #758 と **#764（PR #765、WebKit 360×800 の横はみ出しの修正）**。本作業は `docs/` 配下の新規・更新だけで、どの claim とも重なりません。
**原典:** pizzadb.jp には到達できず未確認です。根拠は 172 matrix の行だけで、個数・焼成窓・placement はすべて GAMEPLAY ASSUMPTION です。比較の基準は第 1 回と同じ、PR #759 HEAD `33bc275`（読み取りのみ）の B18 後のカタログです。

## 0. Owner 判断と、その反映

| Owner 判断 | 反映 |
|---|---|
| pesto-burrata はペスト＋オイルの 2 層 | **採用として記録**（§1）。grandma-pizza と同じ 2 ソース方式で実装できることを再確認 |
| burrata は専用 SVG を用意する | 候補 3 点（A 丸ごと／B 断面／C 裂け口）を作り、ゲーム内で比較（§2）。**C を推奨** |
| crudaiola は元データのトマト＋オイル 2 層を維持し、Jaccard 0.429 の例外根拠を調査 | §3。**例外承認の根拠は成立する**と評価（先例との比較、非スターターの重なり 0.2、同一／部分集合／上位集合 0） |
| FINISH でチーズを置く拡張は別の将来タスク | 別ドキュメントに整理（`docs/design/TETO_FINISH-CHEESE_FUTURE-TASK_2026-11-05.md`）。今回の burrata 系はこれに依存しない |
| 現時点では新レシピを実装しない | そのとおり。実装計画は §4 に記録するだけ |

## 1. pesto-burrata（ペスト＋オイル 2 層）— 採用の記録

- 構成（matrix の 2 層どおり）: `pesto`（主、PAINT）＋ `olive-oil`（2 本目、PAINT_TEMPORARY）＋ `burrata` ＋ `fresh-tomato`。grandma-pizza（#521）の「主ソースを Reference で判定し、2 本目は使ったかどうかで判定する」方式です。
- Free Cooking で 2 層を塗り、RESULT に 2 つのソースが出ることは第 1 回で確認済みです。第 2 回の撮影（`s1-pesto-oil-confusables`）でも同じ盤面が再現しました。
- 既存レシピとの重なり: 最大 **0.333**（pesto-caprese / pesto-pollo / pesto-gamberi）。基準 0.4 を下回り、同一・部分集合・上位集合は 0 です（B18 後のカタログ、`docs/reports/data/TETO_BURRATA-PREFLIGHT-20261105_R2-jaccard.json`）。
- **要確認（実装 PR の仕事）:** 2 ソースの recipe で、主ソースが `pesto` のときに Reference の判定と完成判定（`completionGate`）が grandma と同様に働くこと。grandma の保証テスト（`multiSauce.guards.test.ts`）は tomato-sauce を主に想定した合成レシピで書かれているため、pesto 版の同等テストを追加する必要があります。個数（例: ペスト 1・オイル 1・burrata 2・トマト 2）は未確定の仮置きです。

## 2. burrata の専用 SVG 候補

候補は `docs/design/candidates/ingredient-icons-2.0-burrata/`（`README.md` に状態を記載）。Style Lock V2 §2 の仕様で、輪郭は温かい茶（`#85694a`）、色は仮です。

**方法:** burrata はまだカタログにないため、**リコッタの表示（`ricotta-mound`）を、撮影時に候補 SVG へ差し替え**ました（テスト専用の DOM 差し込みで `src` は無変更。リコッタは `pieceVisual` を持つチーズなので、トレイ・ピザ上・焼成後・RESULT が同じ経路で描かれます）。2 つの盤面を 390×844 と 360×800 で撮影しました。
- **S1 ペスト＋オイル**: 白いチーズ類と同居（モッツァレラ 3、burrata 代用 2、ヤギ・パニール・フェタ・クリームチーズ 各 1、トマト 2）。混同の確認用。
- **S2 トマト＋オイル（crudaiola 構成）**: モッツァレラ 3、burrata 代用 2、トマト 2、ルッコラ 2（すべて焼く前）。

| 案 | 内容 | 所見 |
|---|---|---|
| A 丸ごと | 玉＋結び目 | 既存の mozzarella の球（上に小さな突起）と 26px で近い。ゲーム内でも「白い丸いもの」に寄る。**不採用方向** |
| B 断面 | 割った玉＋クリーム | 形は独立だが、28px では「器に入った卵黄」に見える。輪郭の内側が黄色く、焼成後も見えるが、チーズらしさは弱い |
| **C 裂け口** | 玉の上が裂けてクリームが溢れる | **推奨。** 白い円盤（ヤギ・パニール）、フェタの角切り、クリームチーズの箱、リコッタの山のどれとも形が違い、S1 の盤面で並べても識別できる。焼成後も温かい茶の輪郭が残る |

**計測（390×844、駒 2 個のうち小さい方。見える面積 px²／グレー面積 px²＝背景と明度差 15 超の面積。`docs/reports/data/TETO_BURRATA-PREFLIGHT-20261105_R2-icon-metrics-*.json`）:**

| 案 | S1 焼成前 | S1 焼成後 | S1 RESULT | S2 焼成前 | S2 焼成後 | S2 RESULT |
|---|---|---|---|---|---|---|
| 現行（リコッタ） | 401・303 | 507・441 | 438・358 | 398・340 | 508・425 | 440・348 |
| A | 398・349 | 524・470 | 451・370 | 395・349 | 520・462 | 455・358 |
| B | 386・325 | 508・442 | 438・344 | 384・328 | 505・429 | 442・327 |
| **C** | 399・**360** | 530・**485** | 458・**377** | 397・**355** | 527・**471** | 458・**359** |

読み方: **面積の差は ±10% 以内で、指標だけでは案を分けられません。** 白いチーズは溶けたモッツァレラの白に近いので、どの案も RESULT でグレー面積が 330〜380 に収まります。C が最も大きいのは、溢れるクリームの黄色が背景との明度差を作るためです。**案を分ける根拠は、混同しない形（目視）です。** 360×800 は差が 0〜2% で同じ傾向です。

その他の所見:
- **トマト＋オイルの 2 層の面は橙色**になります（S2 の背景。トマトソースだけの赤とは違います）。crudaiola の見た目は、この橙の上に白いチーズと赤・緑の具材がのる盤面になります。2 層の組み合わせは grandma-pizza も同じですが、grandma の見え方との比較は今回していません。
- 実装時は、`ingredients.ts` の `burrata` に `pieceVisual: "burrata-ball"` 相当を付け、`IngredientGlyph.tsx` に描画を足し、チーズ用の size class と `.ingredient-glyph--…` の補正（必要なら）を決めます。CSS の `.pizza-cheese--glyph` の経路に載るので、**新しい描画基盤は不要**です。

画像: `docs/reports/screenshots/burrata-icons-compare-20261105/`（`burrata-icons-compare-{390x844,360x800}.jpg`＝トレイ・焼成前・焼成後・RESULT の候補比較、`burrata-candidate-sheet.jpg`＝実寸シート、`{current,candC}-{s1,s2}-*.png` ほか＝画面全体）。

## 3. crudaiola（トマト＋オイル）— Jaccard 0.429 の例外根拠の調査

### 3.1 事実（B18 後の 90 レシピ、`..._R2-jaccard.json`）

crudaiola = `tomato-sauce`・`olive-oil`・`mozzarella`・`burrata`・`fresh-tomato`・`arugula`（6 素材）。

| 近傍 | Jaccard | 共通の素材 | うちスターター以外 | スターター除外の Jaccard |
|---|---|---|---|---|
| pinsa-romana（late） | 0.429 | tomato-sauce・mozzarella・arugula | arugula | 0.2 |
| jamon-serrano-pizza | 0.429 | 同上 | arugula | 0.2 |
| grandma-pizza | 0.429 | tomato-sauce・mozzarella・olive-oil | olive-oil | 0.2 |

- 0.4 以上は **この 3 件だけ**です。**同一・部分集合・上位集合は 0 件**です。
- 3 件とも、共通するのは**スターター素材（tomato-sauce と mozzarella）と、スターター以外の 1 素材だけ**です。burrata（このゲームで pesto-burrata にしかない素材）と fresh-tomato の組は、どの近傍にもありません。
- 0.4 のテストは `ORDINARY`（late を除く）に対して書かれる前例なので、通常レシピ側の名前つき固定は **jamon-serrano-pizza と grandma-pizza の 2 件**になり、pinsa-romana（late）は別枠です。late のレシピ自身を対象にする場合の扱いは先例がないため、**3 件すべてをテストで固定する**案を勧めます。

### 3.2 先例との比較

| 先例 | Jaccard | 共通の素材 | スターター除外の Jaccard | 承認の形 |
|---|---|---|---|---|
| B15 suya | 0.60（rendang）、0.50（tandoori-paneer） | beef・mozzarella・onion ほか | — | suya 限定の Owner 例外（NO_SAUCE と併せて） |
| B16 ume-shiso | **0.60**（shirasu-pizza） | mozzarella・shiso・whitebait | 0.5 | B16 限定の Owner 例外 |
| B18 baingan-bharta | **0.429**（rendang・curry-pizza-japan） | curry-ketchup・mozzarella・onion | 0.333 | OD-B18-3、このレシピ限りの例外 |
| **crudaiola（案）** | **0.429**（3 件） | スターター 2 素材＋非スターター 1 素材 | **0.2** | （Owner 判断待ち） |

**評価:** 先例の中で最も軽い部類です。値は B18 の baingan と同じ 3/7 で、スターター除外の重なり（0.2）は baingan（0.333）や ume-shiso（0.5）より小さく、近傍 1 件につき共通の非スターター素材は 1 つだけです。B18 の例外は「代用ソースを変えると Owner 決定に反する」ために承認されましたが、crudaiola のオイルは **matrix に書かれた素材そのもの**で、代用でもありません。

### 3.3 例外を避ける代替案と、その悪さ

| 代替 | Jaccard | 評価 |
|---|---|---|
| オイルを抜く（トマトのみ） | jamon-serrano と **0.500** | 悪化する |
| トマトソースを抜く（オイルのみ。第 1 回の案） | 0.333 | 基準は満たすが、matrix のトマト＋オイル 2 層と食い違う。Owner の方針と合わない |
| arugula か fresh-tomato を外す | 構成が原典から離れる | 避ける |
| pesto と並べて別素材を足す | 原典にない素材を足す | 避ける |

→ **例外承認（このレシピ限り）が最も原典に近い。** 全体の 0.4 基準は変えません。

### 3.4 例外承認の文案（Owner 用・実装 PR で `expansionBatch19.test.ts` と `recipes.ts` のコメントに記録）

> **OD-B19-x（案）:** `pizza-alla-crudaiola` の Jaccard 0.429（jamon-serrano-pizza・grandma-pizza・pinsa-romana）を、**このレシピ限りの例外として承認する**。根拠: 共通の素材はスターター 2 つと非スターター 1 つだけ（スターター除外で 0.2）、同一・部分集合・上位集合は 0、素材は 172 matrix 行のとおり（代用なし）。全体の 0.4 基準、同一／部分集合／上位集合の禁止、Research の規則は変更しない。将来の recipe の一括承認ではない。

### 3.5 発見（識別）への影響

識別は素材の集合（と late 軸など）で決まり、Jaccard は設計上の目安です。crudaiola は 3 件のどれとも集合が違うので、発見判定は一意です。pinsa-romana とは、arugula を共有しても、ピンサ生地（dough 軸）と prosciutto があるため別です。

### 3.6 訂正: crudaiola の置く順序（第 1 回の推奨を見直します）

第 1 回は「crudaiola は late にして fresh-tomato と arugula を後乗せ」を推奨しましたが、**matrix の crudaiola 行は `postBakeFinish: []` で、後乗せの根拠は料理名（クルダイオーラ＝生）からの解釈だけです**。ほかの批准済み batch（B17・B18）は「原典に投入の時期がなければ、すべて焼く前」を前例としています。Owner 判断が「元データのまま」なので、次の 2 案を並べます。

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| **P（通常・全部焼く前、推奨）** | crudaiola は通常レシピ。burrata は step 70 の 1 素材を pesto-burrata が key とし、crudaiola は `ladderCredit: false`（porcini-pizza と同じ前例）。late のカタログに触れない | **原典の根拠どおり。`lateCatalog.ts` も validator も触れない。FINISH の制約と無関係** | 「生」の料理名と食い違う（焼くと rucola がしなびる） |
| L（late） | fresh-tomato と arugula を後乗せ。第 1 回の構成 1 | 名前に忠実 | **後乗せの根拠は matrix にない。** 後から P に戻すと、識別の late 軸が変わるため、**既存の発見・図鑑に影響する**。late のカタログと FINISH のテストが増える |

→ **P を推奨。** 実装前に決める必要があります（実装後の変更は識別と保存に響くため）。どちらも Jaccard・Research は同じ値です（集合が同じ）。**Owner 判断事項**に入れます。

## 4. 実装計画（記録のみ・今回は実装しない）

推奨構成（§3.6 の P）での、第 1 回の変更ファイル表からの差分:
- `lateCatalog.ts`・late の golden は**不要**になる（P の場合）。
- `recipes.ts`: pesto-burrata（key、credited、通常 step 70）と pizza-alla-crudaiola（`ladderCredit:false`）を追加。`recipeSauceProfiles.ts`: pesto-burrata は pesto（主）、crudaiola は tomato-sauce（主）。2 本目の olive-oil は両方で `requiredIngredients` に含める（grandma 方式）。
- `ingredients.ts`: burrata（cheese、`pieceVisual`、T4 の価格、サイズクラス `l` 相当）。`IngredientGlyph.tsx`: §2 の C。
- `discoveryLadder.ts`: step 70。`recipeHintRoles.ts`: 2 件とも key-free。`referencePizza.ts`・`orders.ts`・dialogue・golden。
- テスト: `expansionBatch19.test.ts`（Jaccard の名前つき固定、同一／部分集合／上位集合 0、step 70）、persistence の round trip、`researchLabelAudit` の固定集合（実装 PR で再実行して確定。第 1 回の見込みは正準順 0 件・非正準 23 件）、2 ソースの完成判定テスト（pesto 版）、`e2e/b19.spec.ts`。
- 着手の前提: #759（B18）の merge、その前提の #765（WebKit のはみ出し修正）、#760（`IngredientGlyph.tsx`）、§5 の判断。

## 5. Owner 判断事項（推奨つき）

1. **burrata の専用 SVG は C（裂け口）を採用候補にするか。** 推奨 Yes。A は不採用、B は予備。
2. **crudaiola の Jaccard 0.429（jamon-serrano・grandma・pinsa）を、このレシピ限りの例外として承認するか**（§3.4 の文案）。推奨 Yes。
3. **crudaiola の素材をすべて焼く前にする（案 P）か、fresh-tomato と arugula を後乗せにする（案 L）か。** 推奨 P（matrix に後乗せの根拠がないため）。実装後は変えにくいので実装前に決める。
4. 2 ソース（pesto＋オイル）の主ソースは pesto にする。推奨 Yes（§1）。
5. FINISH でチーズを置く拡張は、後乗せのチーズを使うレシピが決まるまで着手しない。推奨 Yes（`docs/design/TETO_FINISH-CHEESE_FUTURE-TASK_2026-11-05.md`）。
6. 着手は #759・#765・#760 の後。推奨 Yes。

## 6. 成果物

- 候補 SVG: `docs/design/candidates/ingredient-icons-2.0-burrata/`（`burrata-A/B/C.svg`、`README.md`）
- 将来タスク: `docs/design/TETO_FINISH-CHEESE_FUTURE-TASK_2026-11-05.md`
- 画像: `docs/reports/screenshots/burrata-icons-compare-20261105/`
- データ・再現: `docs/reports/data/TETO_BURRATA-PREFLIGHT-20261105_R2-*`（Jaccard、計測、撮影 spec、比較スクリプト）

UI は変更しておらず、HV 動画の対象外です（HV Policy §2「docs-only」）。**画像はいずれも Chromium で、iPhone Safari の実機では確認していません。burrata の絵はリコッタの表示を差し替えた代用です。**

## 7. ステータス

- **完了:** Owner 判断の記録、burrata の候補 3 点とゲーム内比較、Jaccard 例外の根拠の調査（承認文案つき）、crudaiola の順序の訂正、FINISH チーズの将来タスク整理。
- **未完了:** Owner の最終選択（§5）、実装、iPhone Safari の確認。
- **ブロッカー:** #759 / #765 / #760 の merge（claim）。
- **次の行動:** §5 の判断を受けて、#759 の merge 後に実装 PR を作る。実装 PR で Research の監査をもう一度実行して固定集合を確定する。
