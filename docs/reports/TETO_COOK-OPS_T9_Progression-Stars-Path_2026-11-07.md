# T9 — 星（★）から Progression への現行の経路（読み取り調査）

Status: **docs-only の調査。コード・テスト・既存 docs の変更なし。共有 Preview 未更新。PR・merge・Production ON なし。**
Branch `claude/teto-pizza-t7-t9-audit-12by6f` / 基準 `main` `06cfc06` / Issue #784 / claim: #784 コメント 6706450380（`TETO_COOK-OPS_T9_*`）。
根拠: Owner 決定 #784 コメント 6706418089（現行の Progression の星の経路を docs-only で読み取り調査）。前回の `TETO_COOK-OPS_T9_SA-Impact-Plan_Stars-LunchRush-MultiSauce_2026-11-07.md` §2 Q2 の「未確認」を解消する。

## 0. 結論（先に）

1. **1 枚の星は「Dex の BEST 星」にだけ記録され、その合計 `totalStars(dex)` が唯一の進行の入力**。保存されるのは Dex の行（`bestScore`／`bestStars`／`timesMade`／`discovered`）だけで、星の合計は保存せず毎回導出する。
2. **星が現在の進行に効く場所は 3 つだが、実効があるのは 1 つ（ショップ）に近い**:
   - **ショップの素材（Discovery Ladder の `starGates`）: 実効あり**。ただし対象は **`goat-cheese`（120★）と `spinach`（130★）の 2 素材だけ**。
   - **レシピ解放（`Recipe.unlockCondition.minTotalStars` 8〜36）: ほぼ無効**。「発見済みのレシピは常に解放」の規則（I4b-3）により、星の床は**まだ発見していないレシピ**にしか働かず、現在の発見の主経路（フリークッキング）は星を見ない。
   - **素材の `unlockCondition.minTotalStars`: ほぼ無効**。97 件が 0、1 件のみ 12。
3. **S-A が星を上げやすくても、進行への影響は小さい**。星の合計で何かが決まる閾値は **120★・130★（2 素材）**と、未発見レシピの床（8〜36）だけ。BEST は**最大値のみ**を保存する（単調）ので、**1 回の高得点（スタンプ）が永続的に星の合計を押し上げ、元に戻らない**。ここが影響の核心。
4. 星の合計の**最大値**は recipe 数 × 5。ホーム画面の表示は「発見 0/90」（90 recipe）なので理論上の最大は 450★で、120★・130★ は到達可能（到達までの典型的な回数は未計算）。

## 1. 経路（コードで確認・main `06cfc06`）

### 1.1 星の生成

| 段 | 内容 | 出所 |
|---|---|---|
| ① 採点 | `finalizeRound` が `computeScoringV2(recipe, pizza)` を計算し、`toLegacyScoreBreakdown(...)` で `score`（`total`・`stars`）に変換 | `src/state/finalizeRound.ts:126-127` |
| ② 星 | `starsFromTotal(total)`: 90↑＝5、75↑＝4、60↑＝3、40↑＝2、他＝1。**5★は焼成が perfect でなければ 4★に切り下げ**（`capStarsForBake`） | `src/logic/scoring.ts:28-50`、`scoringV2/toLegacyScoreBreakdown.ts:56-57` |
| ③ 登録 | `registerScoreToDex(dex, recipeId, score)`: **新しい最高なら** `bestScore`／`bestStars` を更新。そうでなければ維持（`timesMade` は毎回 +1）。**BEST は下がらない** | `src/state/dex.ts:66-94` |
| ④ 合計 | `totalStars(dex) = Σ（discovered の bestStars）`。**保存しない・導出**。繰り返しプレイで BEST を超えない限り変わらない | `src/logic/mastery.ts` |

### 1.2 星の消費先（`totalStars` の読み手）

`totalStars(` の呼び出し（テスト・devtools を除く）:

| 読み手 | 用途 | 実効 |
|---|---|---|
| `state/materialEntitlement.ts:62` | ショップの解放の導出（`resolveMaterialUnlocks` の `totalStars` 入力。Discovery Ladder の **`starGates`**） | **あり**（下記） |
| `components/ShopOverlay.tsx:136` | 「次の星ゲート」のヒント表示（`nextStarGateHint`） | 表示のみ |
| `components/DexOverlay.tsx:194` | 図鑑の「マスタリー」表示 | 表示のみ |
| `state/progression.ts:62`（`recipeUnlocked`・`ingredientState`） | 未発見レシピの解放（`Recipe.unlockCondition.minTotalStars`）、素材の `AVAILABLE_TO_BUY`（`Ingredient.unlockCondition.minTotalStars`） | **ほぼ無効**（下記） |
| `state/pizzaSelect.ts:37,46` | ピザ選択画面の「あと ★N」表示 | 表示のみ |
| `logic/economySimulation.ts` | 経済シミュレーション | 解析のみ |

### 1.3 各ゲートの実態

**(a) Discovery Ladder の `starGates`**（`src/data/discoveryLadder.ts:191-192`）:
- step（`california-style-pizza`）: `goat-cheese` は **120★** 以上でショップに出る。
- step（`spinach-artichoke-pizza`）: `spinach` は **130★** 以上でショップに出る。
- 仕組み（`resolveMaterialUnlocks`）: ステップに到達（発見数 ≥ step）**かつ** `totalStars ≥ starGates[id]` のとき解放。**一度解放されたものは再ロックされない**（`alreadyUnlockedMaterialIds` との和集合）。星は消費されず、累積の達成。`starGates` を持つのは**この 2 素材のみ**。
- 追加の床 `LATE_ENTITLEMENT_FLOORS`（`lateCatalog.ts`）は**発見数**の床で星ではない。

**(b) レシピの `unlockCondition.minTotalStars`**（`recipes.ts`）: 値は 8／12／15／18／21／24／27／30／33／36 の 14 件。**ただし `recipeUnlocked`**（`progression.ts:48-`）は「**発見済みのレシピは常に解放**」で、星の床は**未発見のレシピだけ**に作用する。フリークッキングの発見はこの鎖を見ずに Ladder 順で発見するため、**現在の発見の主経路では星の床は効かない**（`progression.ts` のコメント: I4b-3 A2）。ピザ選択画面で「あと ★N」と表示される未発見レシピにだけ意味がある。

**(c) 素材の `unlockCondition.minTotalStars`**（`ingredients.ts`・`lateCatalog.ts`）: **97 件が 0、1 件が 12**。実質ゲートではない（ほぼ全素材が星 0 で AVAILABLE_TO_BUY）。素材の実際の解放は (a) の Ladder（発見数）が担う。

**(d) Lunch Rush**: ロックは `!hasAnyDiscovery`（`App.tsx:1322`）で、**星ではない**。LR の run スコアは `servedCount×100 + Σ品質`（星ではなく品質 total）。

### 1.4 保存

- 保存されるのは `dex`（`bestScore`／`bestStars`／`timesMade`／`discovered`）など。星の合計・ゲートの達成状況は**別に保存しない**（導出）。`unlockedForShopIngredientIds`（ショップ解放の台帳）は保存され、**一度解放されたら戻らない**。
- **含意**: S-A（またはどんな入力）で一度高い BEST を取ると、**Dex の BEST は永続**し、**台帳の解放も戻らない**。やり直しても星の合計は下がらない。したがって「ズルいスタンプで 5★を取った」を後から取り消す仕組みは、現状**存在しない**。

## 2. S-A への含意【算術＋読み取り。ゲーム実測ではない】

| 論点 | 見立て |
|---|---|
| 進行への影響の大きさ | 星の合計で決まる実効ゲートは **120★・130★（goat-cheese・spinach）の 2 素材だけ**。S-A が星を押し上げる影響は、その 2 素材の解放時期と、図鑑の見かけの星の合計に限られる |
| 到達の早さ | 120★ に到達するには、星が平均で何枚の recipe に必要かは recipe 数（`RECIPES`）に依存。**前回の M1 の星の算術**（ソース成分 1 点＝total 0.52 点、境目 約 29 点刻み）で、スタンプが 4★→5★へ押し上げる割合が増えると、**同じ recipe 数で 120★ に早く着く**。具体的な早まり方は、人の分布（M2）が無いと見積もれない【未確認】 |
| BEST の永続性 | 一度の高得点が永続する（§1.4）。**S-A の有利さは「平均」ではなく「最高点を 1 回取れれば足りる」形で効く**。したがって S6（許容する有利さ）の判断では、**分布の上限（最高点）**が重要で、中央値ではない |
| Lunch Rush | 星は関係しない（品質 total のみ）。ただし品質 total は星と同じ `score.total` 由来 |
| 星の刻み | 星は 5 段階の閾値（90／75／60／40）で、**同じ recipe を何度も作って BEST を更新**できる。スタンプの「簡単さ」は、**繰り返し練習で自然ジェスチャでも到達できる最高点**との差が実質の問題 |
| 取り消し | なし（§1.4）。**一度付与された解放・BEST を後から調整するなら、保存の移行が必要**（ここでは提案しない） |

## 3. 推奨する次工程（docs のみ）

1. S6 の判断材料として「**最高点（人の最高）**」を M2 で取る（中央値でなく上限）。R1（既存 6 点）の最良は 92。
2. 星の合計が 120★・130★ に達するまでの**平均の必要 recipe 数**を、recipe 数と星の分布の仮定から**算術で見積もる**（コード変更なし）。
3. 「S-A は BEST を更新しない（練習扱い）」「星の算出は S-A でも同じ」の**どちらの設計か**を Owner が決める（後者は星・解放を押し上げうる）。

## 4. 未確認事項

- 現行の recipe 数と、星の合計で 120★・130★ に到達するまでの典型的な回数。
- `LATE_ENTITLEMENT_FLOORS` の具体値（発見数の床。星ではないため本件の影響は小さい）。
- 他の保存項目（`discoveryHintPurchases` など）が星に依存するか（読んだ範囲では依存しない）。
- 実機・Preview での星の表示。

## 5. Owner 判断事項

1. S-A が BEST／星を更新するか（する／練習モードとして更新しない）。
2. S6 の判断に「最高点」を使ってよいか（中央値より適切と考える）。
3. 120★・130★ に到達するまでの算術見積もり（docs のみ）を進めてよいか。

---
_docs-only の読み取り調査。実測・実機は未取得。_
