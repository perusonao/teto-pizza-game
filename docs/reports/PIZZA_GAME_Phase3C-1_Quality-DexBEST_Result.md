# Phase 3C-1: ★1〜★5 Quality Scoring + Dex BEST — Result

Status: 実装完了（Final Verdict は本レポート末尾を参照）
関連ドキュメント: `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`（第4章 Quality, 第15章 Dex BEST）/
`docs/design/PIZZA_GAME_SSOT.md`

## Base / Branch / Commit

- Base SHA: `e5ac1a6af2bfe444f47b9474b5f50ce4b74c7ab2`（origin/main, 期待値と一致）
- Final branch: `claude/phase-3c1-quality-dex-gm36l2`
- Commit SHA: 本レポートをコミットした時点のHEAD（PR側の最新コミットを参照）

## Scope（今回やったこと / やらなかったこと）

実装したのは指示どおり次の2点のみ:

- ★1〜★5 Quality スコアリング（Recipe correctness / Purity / Placement / Bake の4軸）
- Dex BEST（発見済みレシピごとの最高スコア・最高★・作成回数）

今回やっていない（指示どおり）:

- Pitz、localStorage永続化、Ingredient Shop、LOCKED/AVAILABLE_TO_BUY/OWNED、Lunch Rush、
  レシピ#7（サラミ）
- Sauce Painting の軌跡/coverage採点（stateに保存していないため対象外のまま）
- 大規模UI redesign、詳細な採点ダッシュボード

## Changed files

```
.github/workflows/ci.yml         (+1)   npm test を lint と build の間に追加
package.json                     (+2)   "test": "vitest run" スクリプト追加
package-lock.json                       vitest追加に伴う依存解決
src/App.css                      (+55)  ★5表示・スコア数値・Dex BEST/NEW BESTのスタイル追加
src/App.tsx                      (+9/-4) DexOverlayへdexEntry配列を渡す・NEW BESTバナー追加
src/components/DexOverlay.tsx    (+31/-14) BEST★/BESTスコア/timesMade表示、NEW BESTバッジ
src/components/ResultPanel.tsx   (+39/-20) ★1-5+数値スコアを主役に、具材/配置/焼きの3行に整理
src/data/dialogue.ts             (+7/-6)  classifyBlueBandを1-5スター前提に再マッピング
src/logic/scoring.ts             (書き換え) 35/15/20/30の重み付け・★1-5しきい値・perfect bake cap
src/logic/placement.ts           (新規)   Placement score（0-100）純粋関数
src/state/dex.ts                 (新規)   DexEntry/DexState/registerScoreToDex 純粋関数
src/state/gameReducer.ts         (+35/-8) dexをDexEntry[]化、REGISTER_TO_DEXでBEST更新をatomicに
vitest.config.ts                 (新規)   vitest設定（src/**/*.test.ts）
src/logic/scoring.test.ts        (新規)   ★しきい値・perfect bake cap・weighted formula
src/logic/placement.test.ts      (新規)   Placement algorithmの単体テスト
src/state/dex.test.ts            (新規)   Dex BEST登録ロジックの単体テスト
src/state/gameReducer.test.ts    (新規)   REGISTER_TO_DEXのreducer統合・atomicity テスト
docs/reports/PIZZA_GAME_Phase3C-1_Quality-DexBEST_Result.md (新規) 本レポート
```

## Quality formula

`src/logic/scoring.ts` の `scorePizza()` を、既存の3指標（`matchScore` / `ingredientScore` /
`bakeScore`、いずれも0-100）を壊さずに、新たに `placementScore`（0-100）を追加した4指標構成に
拡張した。

| 指標 | 内容 | 重み |
|---|---|---|
| `matchScore`（Recipe correctness） | 既存ロジックそのまま：必須食材が `minCount` 以上使われているか | 35 |
| `ingredientScore`（Purity） | 既存ロジックそのまま：使用食材のうち想定外食材の割合による減点 | 15 |
| `placementScore`（Placement） | 新規：`logic/placement.ts`（下記） | 20 |
| `bakeScore`（Bake） | 既存ロジックそのまま：焼き加減の目標レンジからの距離 | 30 |

```
total = (matchScore*35 + ingredientScore*15 + placementScore*20 + bakeScore*30) / 100
```

いずれの指標も0-100スケールを維持しているため、`ResultPanel` の既存バー表示ロジック
（`width: ${score}%`）を変更せずにそのまま流用できている。重みはSSOT・タスク指示どおり
`35/15/20/30`（合計100）で定数化（`WEIGHT_MATCH` 等）。

## ★1〜★5 のしきい値

`starsFromTotal(total)` に一元化（`STAR_THRESHOLDS` 定数テーブル）:

| total | Quality |
|---|---|
| 0–39 | ★1 |
| 40–59 | ★2 |
| 60–74 | ★3 |
| 75–89 | ★4 |
| 90–100 | ★5 |

さらに `capStarsForBake(stars, bakeState)` で「焼きが `perfect` でなければ ★5 禁止（最大★4）」を
一元管理。`scorePizza()` 内でのみ呼ばれ、UI側（`ResultPanel` / `DexOverlay`）は計算済みの
`stars` を表示するだけで、星の補正ロジックを一切持たない（指示の「UIだけで補正しない」を満たす）。

## Placement algorithm（`src/logic/placement.ts`）

対象は `pizza.toppings`（scatter配置されたチーズ＋トッピング。ソースは "spread" 配置で
座標配列を持たないため、そもそもこの指標の対象外）。0-100点、containment/distributionの
2要素に分解:

- **Containment（50点満点）**: 全トッピングのうち生地の円内（`isInsideDough`）に収まっている
  割合 × 50。
- **Distribution（50点満点）**: トッピングが2個以上のときのみ、全ペアの平均距離を
  `CLUSTER_DISTANCE`（= 既存の `MIN_TOPPING_DISTANCE` = 9）〜`SPREAD_DISTANCE`（30）の
  区間で線形マップし、下限 `DISTRIBUTION_FLOOR`（20点）〜満点（50点）に変換。
  トッピングが0〜1個のときは常に満点（「クラスター」という概念が成立しないため）。

このアルゴリズムの設計方針（すべてテストで担保、詳細は後述）:

- トッピングが存在しないレシピ・ラウンドはこの指標で **常に満点（100）**
  （構造的な不利を作らない）。
- トッピングが1個だけのレシピでも **満点（100）を理論上取得可能**。
- 生地の外に置かれたトッピングは containment 経由で減点される。
- 一点集中の配置より、適度に分散した配置のほうが必ず高スコアになるが、下限
  （`DISTRIBUTION_FLOOR`）を設けているため、クラスター配置でも0点にはならない
  （「ピクセル単位の正解位置当てゲーム」にしないためのforgiving設計）。

magic numberはすべて `placement.ts` 内で定数化済み（`CLUSTER_DISTANCE` /
`SPREAD_DISTANCE` / `DISTRIBUTION_FLOOR` / `PLACEMENT_CONTAINMENT_WEIGHT` /
`PLACEMENT_DISTRIBUTION_WEIGHT`）。

## Dex BEST model（`src/state/dex.ts`）

`GameState.dex` を `string[]` から `DexState`（= `readonly DexEntry[]`）へ拡張:

```ts
interface DexEntry {
  recipeId: string;
  discovered: boolean;
  bestScore: number;
  bestStars: QualityStars; // 1-5
  timesMade: number;
}
```

- `registerScoreToDex(dex, recipeId, score)` が唯一の書き込み経路。初回は
  `discovered: true, bestScore: score.total, bestStars: score.stars, timesMade: 1` で新規作成。
  既存エントリがある場合は `score.total > existing.bestScore` のときだけ `bestScore`/`bestStars`
  を更新し、`timesMade` は常に+1（BESTが更新されたかどうかに関わらず）。
- `discoveredRecipeIds(dex)` / `isDiscovered(dex, id)` は既存コードが期待していた
  「発見済みID配列」「発見済みか」という形を維持するための派生ヘルパー。
  `src/data/orders.ts`（次の注文の抽選）と `src/data/dialogue.ts`
  （Mitoのリピート注文セリフ）は **一切変更していない** — どちらも従来どおり
  `dex: string[]` を受け取るシグネチャのまま、呼び出し側（`gameReducer.ts` / `App.tsx`）で
  `discoveredRecipeIds(state.dex)` を渡すことで吸収した。
- Phase 3C-2 でそのまま `JSON.stringify` できるプレーンなデータ形状（クラス・メソッドなし）
  にしてある（SSOT第14章の「壊れたデータでもフォールバックできる」ための前提）。

## Reducer / state changes（`src/state/gameReducer.ts`）

- `GameState.dex: DexState` に変更。`justGotNewBest: boolean` を追加
  （BESTが更新された・または初回発見のとき true。RESULT/DISCOVERED UIの
  「NEW BEST!」表示に使用）。
- `REGISTER_TO_DEX` アクションを次のように変更し、**1ラウンドにつき正確に1回だけ**
  Dexへ反映されることを保証:
  - `state.phase !== "RESULT" || !state.score` のときは **状態を一切変更せず** `state` を
    そのまま返す（同一参照）。これにより「RESULTの後、既にDISCOVEREDに遷移した状態へ
    誤って再ディスパッチされても二重カウントされない」ことをreducerレベルで保証。
  - 通常経路では `registerScoreToDex(state.dex, state.recipe.id, state.score)` を呼び、
    その結果（新しいdex配列・`wasNewDiscovery`・`isNewBest`）をそのままstateに反映する
    だけ。BEST比較ロジック自体はreducerに一切持たず、`state/dex.ts` の純粋関数に委譲。
- `nextOrderState` / `createInitialGameState` は `dex: DexState` を受け取り、
  `getNextOrder` に渡す直前だけ `discoveredRecipeIds(dex)` へ変換する形にして、
  `orders.ts` 側のインターフェースを変更せずに済ませた。

## Existing behavior compatibility

- order match / ingredient correctness / bake doneness / raw・perfect・burnt の分類ロジック
  （`classifyBake`）は無変更。
- キャラクターダイアログ: `buildBlueResultLine` の `classifyBlueBand` を、
  「raw/burntは常にそれ専用のセリフを優先」→「★4以上でhigh」→「★3でmid」→「それ以外low」
  という優先順位に更新（旧: `stars===3` でhigh判定だったのを5段階に自然拡張）。
  raw/burntのセリフが常に優先される点は既存挙動と同じ（旧コードでも
  `stars===3`は焼きperfect時にしか成立し得なかったため、実質的に同じ優先順位だった）。
- Sauce Painting / FTU sauce auto-select: 無変更（`APPLY_SAUCE`ロジック・関連コンポーネント
  未変更）。
- 旧★1〜3表示は`ResultPanel`/`DexOverlay`とも★1〜5表示に置き換え済み。

## Tests

`vitest` を新規導入（`npm test` → `vitest run`）。既存にテストフレームワークが
無かったため今回追加し、CI（`.github/workflows/ci.yml`）にも `npm run lint` の直後・
`npm run build` の前段として `npm test` を追加した。

```
$ npm test

 Test Files  4 passed (4)
      Tests  33 passed (33)
```

### `src/logic/scoring.test.ts`

- `starsFromTotal`: 0/39→★1, 40/59→★2, 60/74→★3, 75/89→★4, 90/100→★5（指示の境界値を網羅）
- `capStarsForBake`: perfect→そのまま5, raw/burnt→5を4に強制、4以下はそのまま
- `scorePizza`: 全条件を満たした満点ケース（100/★5）、35/15/20/30の重み付け計算の直接検証、
  「90以上・raw」「90以上・burnt」が実際に total≥90 かつ ★4止まりになることを統合的に確認

### `src/logic/placement.test.ts`

- トッピング0個→満点、単一トッピング（内側）→満点
- 単一トッピングが外側→減点
- 一部が外側のレイアウトは全内側のレイアウトより低スコア
- 分散した配置 > 病的な一点集中配置
- 一点集中でも0点にはならない（distribution floorの検証）

### `src/state/dex.test.ts`

- 初回結果でBESTエントリが作成される
- より高いスコアでBESTが更新される
- より低いスコアではBESTを上書きしない（が`timesMade`は増える）
- レシピごとにBEST/timesMadeが独立している
- `discoveredRecipeIds` / `isDiscovered` が発見済みのみを反映する

### `src/state/gameReducer.test.ts`

- 初回RESULT→REGISTER_TO_DEXで、そのラウンドのスコアがそのままBESTとして登録される
- 同じRESULTに対して`REGISTER_TO_DEX`を2回ディスパッチしても`timesMade`が1のまま
  （2回目は状態変更なしの同一参照を返す）＝二重カウント防止のatomicity
- RESULT以外のフェーズで`REGISTER_TO_DEX`をディスパッチしても状態が変化しない

既存のスコアリング・reducerロジック（order match, ingredient correctness, bake doneness等）は
上記テストと `npm run build`（`tsc -b`の型チェック含む）で退行がないことを確認済み
（新規テストフレームワーク導入のため、既存の自動リグレッションテストは元々存在しない）。

## 390×844 mobile verification（Playwright / Chromium）

`/opt/pw-browsers/chromium` を使い、390×844のビューポートで `npm run dev` 起動中のアプリを
実際に操作して確認（スクリーンショット取得・console error監視付き）。

実施した内容:

1. **Round 1（マルゲリータ, 初回注文, 完全な具材+perfect焼き）**:
   `★★★★★ 99`、具材100/配置94/焼き100、「✨マルゲリータを発見しました！」、
   Dexに `発見 1/6`・`NEW`バッジ・`★★★★★ BEST 99 1回作成` を確認。
2. **Round 2〜8（別レシピ, perfect焼き, 一部は同じレシピをリピート）**:
   全レシピ（マルゲリータ以外の5種）を発見し `🏆 6/6 コンプリート！` まで到達。
   クアトロフォルマッジ・ジェノベーゼを2回作成した際に `timesMade` が正しく2に、
   BESTスコアも独立に保持されることを確認。リピート時は「また上手にできたね！」の
   Mitoセリフに切り替わることも確認（既存NEW semantics継続）。
3. **低スコア→高スコアの検証（別セッション）**: マルゲリータをバジル抜き+生焼けで
   プレイ →`★★★☆☆ 62`（具材77/配置87/焼き20, "生焼け"バッジ）でBEST 62として登録
   されることを確認。
4. **90+ burnt が★4止まりになることの実機確認**: 別レシピ（ビスマルク）を全具材+
   焦げ焼きでプレイし、`total 94` にもかかわらず `★★★★☆`（★5禁止）と
   `🔥 焼き加減: 焦げ` が同時に表示されることを確認 — perfect bake capがUIレベルで
   正しく効いていることの直接証拠。
5. 全ラウンドを通して **console error 0件**、**横方向overflowなし**
   （`scrollWidth <= clientWidth`）を確認。
6. PLAY AGAIN（「もう一度作る」）による次ラウンドへの遷移、Dexオーバーレイの開閉、
   いずれも正常動作。

注記: PLAY_AGAIN は直前レシピを除外して抽選するため、同一セッション内で
「マルゲリータを連続して2回プレイし、しかも2回目のほうが高スコアで NEW BEST! バナーが
出る」というシナリオは、乱数の巡り合わせ上、本セッションの実機確認では再現できなかった
（6回試行して再度マルゲリータが引かれなかった）。この「低→高でBEST更新・NEW BEST」の
ロジック自体は `src/state/dex.test.ts`（`registerScoreToDex`が同一レシピに対して
BESTを正しく更新するテスト）で厳密に検証済みであり、UI側の表示コード
（`App.tsx`のDISCOVEREDバナー、`DexOverlay`の`NEW BEST!`バッジ）は
`justGotNewBest` / `newBestRecipeId` という、reducerテストで正しさを検証済みの
boolean値をそのまま描画するだけの分岐であるため、リスクは低いと判断した。

## Regression results

- `npm run lint`（oxlint）: ✅ pass, exit code 0
- `npm test`（vitest）: ✅ 33/33 pass
- `npm run build`（`tsc -b && vite build`）: ✅ pass（テストファイルを含む全srcの型チェックも通過）
- `git diff --check`: ✅ no whitespace errors
- 実機確認（390×844, Chromium）: console error 0件、overflowなし（上記参照）

## Known issues

- P2: 同一セッション内でPLAY_AGAINが直前レシピを除外する設計上、「同じレシピを連続で
  再挑戦してBESTを更新する」フローは実機テストでは低確率でしか再現できない
  （ロジック自体は単体テストで担保済み、UI表示上のリスクは低いと判断）。
- P2: Placement scoreのしきい値（`CLUSTER_DISTANCE=9`, `SPREAD_DISTANCE=30`,
  `DISTRIBUTION_FLOOR=20`）は「forgivingであること」を優先して選定した初期値であり、
  実プレイフィールに応じたチューニングの余地がある（既存6レシピでは全て
  配置スコア90前後で安定しており、体感上の違和感は今回のプレイ確認では見られなかった）。
- P2: `ResultPanel` の「具材」フィードバック行は表示専用の合成値
  （`matchScore*0.7 + ingredientScore*0.3`）であり、`ScoreBreakdown`本体には含まれない
  （採点ダッシュボード化を避けるための意図的な設計）。将来的に内訳をより詳しく
  見せたくなった場合は、この合成ロジックをどこに置くか再検討が必要。
- Pitz・localStorage・Shop・Lunch Rush・レシピ#7は本フェーズの非スコープであり、
  未実装（意図通り）。

## Final Verdict

**A. READY TO MERGE**

- スコープ（★1-5 Quality + Dex BEST のみ）を逸脱していない
- 既存の6レシピ・全ゲームループ（ORDER→PREPARE→BAKE→RESULT→DISCOVERED）を破壊していない
- lint / test / build すべてグリーン
- 390×844実機確認で指定項目（★5表示・数値スコア・Dex BEST・timesMade・NEW/発見数・
  PLAY AGAIN・overflowなし・console error 0件）を確認済み
- Known issuesはいずれもP2（ブロッカーなし）
