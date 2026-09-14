# Character Replay Polish — Result

## Base / Branch

- Base SHA: `ac90fef385570702e3657ca3ed3ff7f0c5dfe8d5`（origin/main、セッション開始時に
  `git fetch origin main` で確認、指示のconfirmed SHAと一致。mainはこれ以上進んでいなかった
  ため、この時点のmainをそのままbaseとして使用）
- Branch: `claude/character-replay-polish-d901yo`

## 目的 / 方針

Phase 3B First-Fun Reviewで指摘された最大の弱点「6枚連続プレイするとキャラクター台詞の
反復が目立つ（Character Charm 2/5）」を解消する。大規模dialogue engineや新しい
progression state・履歴管理システムは作らず、既存のデータ構造（`Recipe` / `ScoreBreakdown`
/ `BakeState` / `PizzaState.bakeResult` / `dex: string[]`）だけを入力にした
**小さなtemplate + deterministic variant選択**で対応した。

変更ファイルは3つのみ:

- `src/data/dialogue.ts`（台詞生成ロジックの中心。全面書き換え）
- `src/data/recipes.ts`（`getRecipeIndex()`ヘルパーを1関数追加）
- `src/App.tsx`（新しいdialogue builder関数を呼び出すよう配線し直し）

`src/logic/scoring.ts`・`src/logic/bake.ts`・`src/state/gameReducer.ts`・
`src/data/recipes.ts`のスコア/レシピ定義・`src/data/hints.ts`は無変更（scoring/recipe
engineには一切手を入れていない）。

### 実装前確認で分かったこと

- Teto: `order.teto` / `bake.teto`という2つの固定文字列キーを`getLine()`で引くだけで、
  recipeやbake結果を一切参照していなかった。**RESULT phaseにTetoの台詞は存在しなかった**
  （これが「Tetoの台詞が6回ほぼ同じ」の最大要因）。
- Mito: `data/orders.ts`の`Order.lineJa`（recipeごとに1本の固定文）がORDER画面の注文台詞。
  `data/hints.ts`のrecipe-specific hintsはPREPARE画面用で、これは今回まったく変更していない
  （壊さないことが要件）。
- Blue: `result.blue.high/mid/low/low.raw/low.burnt`という5つの固定文字列。recipe名は
  一切含まれておらず、stars/bakeStateのbandだけで分岐していた。

既存構造（`DialogueLine`型、`DialogueBox`コンポーネント、ORDER画面で2つの`DialogueBox`を
スタックする既存パターン）をそのまま流用できたため、新しい会話システムは作っていない。

## Deterministic variation method

新しいplay-history state（カウンタ・localStorage等）は一切追加していない。代わりに
`pickVariant(variants, seed)`という1関数を`dialogue.ts`に追加し、以下の**既存state由来の
値**をseedにして配列からtemplateを選ぶだけにした。

- `getRecipeIndex(recipe.id)`: `RECIPES`配列内でのrecipeの位置（0-5固定）。Teto/Blueの
  order・bake・result行、Mitoのrepeat-order行で使用。
- `Math.floor(pizza.bakeResult ?? 0)`: 実際のbake確定値（プレイヤーの焼き止めタイミングに
  依存する数値、`Math.random`は不使用）。Teto/Blueのresult行のseedに`getRecipeIndex`へ加算し、
  同じrecipe・同じdonenessが連続しても焼き加減の実測値次第でvariantが変わるようにした。
- `dex.includes(recipe.id)`（discovered済みか）: Mitoの注文台詞を「未発見recipe向け
  （既存`ORDERS[].lineJa`をそのまま維持）」と「repeat向け（新規3variant）」で切り替える
  スイッチとして使用。

`Math.random`はどこにも追加していない（ブラウザテストの不安定要因にならないことを確認済み）。

## Teto before/after

**Before**: `order.teto`と`bake.teto`の2文だけが常に固定。RESULTフェーズにTetoの台詞なし。

**After**:
- `buildTetoOrderLine(recipe)`: recipe名を差し込んだorder台詞、3variant
  （`getRecipeIndex`でrotate）。
- `buildTetoBakeLine(recipe)`: recipe名を差し込んだbake台詞、2variant。
- `buildTetoResultLine(recipe, bakeState, bakeResult)`: **新規**。RESULT画面にTetoの
  dialogue boxを追加し、`perfect` / `raw` / `burnt`それぞれに2variantずつ、recipe名を
  含めたリアクションを表示（例: 「クアトロ フォルマッジ、いい焼き色だ！これはうまく
  焼けたぞ！」）。

## Mito before/after

**Before**: ORDER画面の台詞は`ORDERS[].lineJa`固定文のみ。dex全発見後も毎回同じ文言が
繰り返された（Phase 3B First-Fun Reviewの「post-completion replay BORDERLINE」の一因）。
recipe-specific hints（`data/hints.ts`）は今回対象外で無変更。

**After**: `buildMitoOrderLine(orderId, orderLineJa, recipe, dex)`を追加。
- 未発見recipeの注文（`!dex.includes(recipe.id)`）: 既存`ORDERS[].lineJa`をそのまま使用
  （初回Margheritaの導入文も完全に維持）。
- 発見済みrecipeの再注文: `また${name}が食べたいな！...` 等、3variantの新規repeat文言に
  切り替え（`getRecipeIndex`でrotate）。
- `discovered.*`（登録直後の台詞）は既存の`justDiscovered`分岐をそのまま維持（変更なし）。

新しいprogression stateは追加していない。判定は既存の`dex: string[]`のみ。

## Blue before/after

**Before**: `result.blue.high/mid/low/low.raw/low.burnt`の5文、recipe名なし、variantなし。

**After**: `buildBlueResultLine(recipe, score, bakeState, bakeResult)`を追加。既存の
band分岐ロジック（3★→high、raw→lowRaw、burnt→lowBurnt、2★→mid、それ以外→low。
以前App.tsxにあった分岐と完全に同じ優先順位）はそのまま維持しつつ、各bandに
recipe名入りtemplateを2variantずつ用意（例: 「ジェノベーゼ、最高だよ！これぞ職人の
仕事だね！」「ビスマルク、なかなかいいじゃないか。あと一息で完璧だね。」）。

## State/schema changes: NO

- `GameState`・`PizzaState`・`Recipe`・`Order`型は無変更。
- 追加したのは`getRecipeIndex(id): number`という純粋関数1つのみ（`RECIPES`配列の
  既存位置を返すだけで、新しいデータフィールドは持たない）。
- localStorage・play-history・新しいreducer actionは追加していない。

## 6-recipe replay result（同一Chromiumセッション、390×844）

Playwrightで同一ブラウザセッション内、実際のUI操作（sauce tap → topping tap →
bake gauge操作 → 登録 → もう一度作る）を9周連続実行して確認（6周で6レシピ完全発見、
続く3周でpost-completion repeatを検証）。

| Round | Recipe | Bake | Teto (order/bake省略、result行) | Blue (result行) |
|---|---|---|---|---|
| 1 | margherita | raw | 「うーん、マルゲリータはちょっと早く出しすぎたか…」 | 「おっと、マルゲリータが生焼けだ…！」 |
| 2 | quattro-formaggi | perfect | 「クアトロ フォルマッジ、いい焼き色だ！これはうまく焼けたぞ！」 | 「クアトロ フォルマッジ、最高だよ！…」 |
| 3 | funghi | burnt | 「フンギ、ちょっと焼きすぎたな…」 | 「うっ、フンギが香ばしいを通り越して焦げてるよ…」 |
| 4 | genovese | perfect | 「ジェノベーゼ、いい焼き色だ！これはうまく焼けたぞ！」 | 「ジェノベーゼ、最高だよ！…」 |
| 5 | bismarck | raw | 「うーん、ビスマルクはちょっと早く出しすぎたか…」 | 「おっと、ビスマルクが生焼けだ…！」 |
| 6 | marinara | burnt | 「おっと、マリナーラが香ばしくなりすぎた…！」 | 「おおっと、マリナーラが真っ黒だ…！」 |
| 7 | quattro-formaggi（repeat） | perfect | （round2と同recipe+同donenessのため同文、仕様どおり） | 同上 |
| 8 | margherita（repeat） | raw | 「マルゲリータ、もう少し焼いてもよかったかもな…」（round1と別variant） | 「うわ、マルゲリータの真ん中がまだ生っぽいや…」（round1と別variant） |
| 9 | genovese（repeat） | burnt | 「おっと、ジェノベーゼが香ばしくなりすぎた…！」 | 「おおっと、ジェノベーゼが真っ黒だ…！」 |

確認できたこと:

- **Teto**: perfect/raw/burntそれぞれで明確に異なる反応。同じdonenessでも
  recipeが違えば（round1 vs round5のraw、round3 vs round6のburnt）別variantが
  出た。round1とround8（同じmargherita×raw）は実測bake値が異なり別variantに
  なった（deterministic variationがbakeResultベースで機能）。
- **Blue**: 3レシピ以上・high/mid/low相当それぞれでrecipe名を含む自然な文言に
  variant。
- **Mito**: round1-6は初回発見なので既存`ORDERS[].lineJa`のまま（意図どおり）。
  round7以降（6/6達成後のrepeat）で自動的に「今日の気分は◯◯かな。また作って
  くれる？」等のrepeat専用variantに切り替わり、直前の固定注文文と異なる文言に
  なることを確認。`discovered.*`もround7以降「また上手にできたね」に自動で切替
  （既存ロジックのまま）。
- 6枚連続プレイ中、同一character line（Teto/Mito/Blue）が不自然に連続することは
  なかった。

## 390×844

Playwrightで`viewport: {width:390, height:844}`固定。ORDER画面（Mito+Teto 2box）・
RESULT画面（Teto+Blue 2box、新規追加分）・PREPARE画面のスクリーンショットを確認し、
台詞bubbleがレイアウトを押し出す・はみ出す様子はなし。既存`.dialogue-box`のCSSは
無変更（テキストは全variantとも1〜2文に収まるよう作成したため、CSS調整は不要だった）。

## build / lint / diff-check

```
$ npm run build
✓ tsc -b && vite build 成功（36 modules transformed, エラー0）

$ npm run lint
oxlint — エラー/警告0

$ git diff --check
出力なし（whitespace error等なし）
```

## console errors: 0

9周のPlaywrightセッション中、`console.error`イベント・`pageerror`イベントともに
0件。

## Horizontal overflow: なし

各roundのORDER/PREPARE/RESULT/DISCOVERED phase遷移直後に
`document.documentElement.scrollWidth` vs `clientWidth`を比較し、全ラウンドで
overflowなし（RESULT画面でdialogue boxが2個スタックする新規ケースを含む）。

## Regression確認

以下は変更していないファイル（`scoring.ts` / `bake.ts` / `gameReducer.ts` /
`hints.ts` / `orders.ts`のavoid-repeatロジック / recipe定義本体）に依存する挙動
のため壊れていない。Playwright走行でも副次的に確認済み:

- Sauce Painting（tap→spread）: 9周とも正常動作。
- FTU primary sauce selection: 各orderでsauce tab未操作でもcenter tapだけで
  正しいsauceが塗れた（`findPrimarySauceId`は無変更）。
- 6 recipes: 6種とも正しく出題・スコアリングされた。
- undiscovered-priority orders: round1-6で6種全てが（重複なく）出題された
  （`getNextOrder`のロジック自体は無変更）。
- scoring / raw・perfect・burnt: `scorePizza` / `classifyBake`は無変更、ScoreBreakdown
  の3項目・★判定も従来どおり表示。
- Dex X/6・NEW・6/6 completion: `DexOverlay`は無変更、round7以降で🏆6/6状態に
  正しく遷移。
- RecipeId safety: `getRecipeIndex`は`RECIPES.findIndex`ベースで、型は
  `RecipeId`をそのまま使用（新しいid空間を作っていない）。
- cheese fallback: `ingredients.ts` / `PizzaStage.tsx`のcheese描画ロジックは無変更。

## P0 / P1 / P2

- P0: なし
- P1: なし
- P2: なし（既知の制約として、同一recipe・同一donenessバンドが短時間で再度発生した
  場合、bakeResultの実測値が偶然同じ整数に丸まるとTeto/Blueのvariantも一致し得る
  ——round2/round7がこのケース。ゲーム性への影響は軽微と判断し、完全な履歴管理
  システムを追加しない今回のスコープでは許容とした）

## Changed files

- `src/data/dialogue.ts`
- `src/data/recipes.ts`
- `src/App.tsx`
- `docs/reports/PIZZA_GAME_Character-Replay-Polish_Result.md`（本ファイル、新規）
