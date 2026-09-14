# Phase 3C-5: Pitz Rewards and Ingredient Shop — Result

Status: 実装完了（Final Verdict は本レポート末尾を参照）
関連ドキュメント: `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`（第3・6〜9章）/
`docs/reports/PIZZA_GAME_Phase3C-3_Mastery-Availability_Result.md` /
`docs/reports/PIZZA_GAME_Phase3C-4_Lunch-Rush_Result.md`

## Base / Branch / Commit

- Base SHA: `c7466aab8fdb42fc9a5ed0ce138279953b487cde`（origin/main, 期待値と一致）
- Branch: `claude/pizza-game-pitz-shop-z0eoxh`
- Commit SHA: 本レポートをコミットした時点のHEAD（PR側の最新コミットを参照）

## Scope（今回やったこと / やらなかったこと）

指示どおり、Progressionを「🍕作る → ⭐ Dex BEST/totalStars → 🔓 AVAILABLE_TO_BUY →
⏱️ Lunch Rush → 🪙 Pitz獲得 → 🛒 Shopで購入 → OWNED」までつなぐ、経済ループの実装のみを行った。

今回やっていない（指示どおり、非スコープ）:

- salami・Recipe #7の実データ追加（3C-6のscope）
- 素材消費・在庫・stock/count
- 実課金・アプリ内購入とPitzの交換
- マイルストーンミッション（一度きり達成型）— SSOT第8章の初期案から外した（後述）

## Changed files

```
src/logic/economy.ts                    (新規) calculateMissionReward() / purchaseIngredient()
                                         をpure functionとして実装
src/logic/economy.test.ts               (新規) 上記の単体テスト（26件）
src/data/ingredients.ts                 (+8)   Ingredient.pricePitz?フィールド追加
src/state/gameReducer.ts                (+138/-16) GameState.pitzBalance /
                                         lastClaimedMissionRunId追加、PURCHASE_INGREDIENT /
                                         CLAIM_MISSION_REWARDアクション追加、
                                         buildOrderState等をProgressionCarryへリファクタ
src/state/gameReducer.test.ts           (+135) 上記の単体テスト（22件）
src/state/persistence.ts                (+90/-6) persistProgress()（canonical patch API）
                                         追加、pitzBalance/ownedIngredientIdsのdocコメント更新
src/state/persistence.test.ts           (+80)  persistProgressの単体テスト（8件）
src/state/progression.test.ts           (+62)  purchase→OWNED→recipe availableの統合テスト（3件）
src/mission/lunchRush.ts                (+14/-2) MissionState.runId追加（START毎に増分、
                                         EXIT_TO_FREEでは保持）
src/mission/lunchRush.test.ts           (+58/-6) runId関連テスト追加・既存リテラルへrunId付与
src/components/ShopOverlay.tsx          (新規) Shop overlay component
src/components/MissionResultOverlay.tsx (+14)  pitzReward/pitzBalance props・表示追加
src/App.tsx                             (+76/-9) header Pitzチップ/Shopボタン、Shop overlay
                                         配線、purchase/claim reward dispatch、
                                         persistDex→persistProgress置き換え
src/App.css                             (+146)  header actions・Shop overlay・
                                         Mission Result Pitz行のスタイル
docs/design/PIZZA_GAME_PROGRESSION_SSOT.md (+36/-11) 第8章をLunch Rush run単位の報酬方式に
                                         更新（改訂履歴v1.2、詳細は後述）
docs/reports/PIZZA_GAME_Phase3C-5_Pitz-Shop_Result.md (新規) 本レポート
```

既存6レシピ・既存13食材のデータ（`src/data/recipes.ts`）は無変更。`src/data/ingredients.ts`は
`pricePitz?`フィールドの型定義追加のみで、13件のオブジェクトリテラル自体は変更していない。

## Economy architecture

指示（第15章）どおり、経済ルールを`src/logic/economy.ts`へpure functionとして集約した。

```
src/logic/economy.ts (新規, pure)
  calculateMissionReward(metrics: MissionMetrics): number
  purchaseIngredient(input): PurchaseIngredientResult

src/state/progression.ts (既存, 無変更)
  ingredientState() / isRecipeAvailable() / availableRecipeIds()
  -- economy.tsのpurchaseIngredient()がingredientState()を呼ぶ形で再利用

src/state/gameReducer.ts (既存, 拡張)
  PURCHASE_INGREDIENT: economy.purchaseIngredient()の結果を適用するだけ
  CLAIM_MISSION_REWARD: 金額計算はApp.tsx側（economy.calculateMissionReward()）、
                         reducerはidempotent guardと加算のみ

src/App.tsx (既存, 最小限の配線のみ追加)
  handlePurchaseIngredient() -- 1行のdispatch
  CLAIM_MISSION_REWARDを飛ばすuseEffect -- calculateMissionReward()を呼ぶだけ
```

App.tsxに経済ルール（価格判定・報酬計算式）そのものは一切書いていない。`gameReducer.ts`も
「pure functionの結果を適用する」以上のロジックを持たない。

## Reward formula

`src/logic/economy.ts`の`calculateMissionReward(metrics: MissionMetrics)`:

```ts
export const MISSION_REWARD_BASE_PITZ = 40;
export const MISSION_REWARD_QUALITY_BONUS_PER_10_AVG_QUALITY = 5;
export const MISSION_REWARD_SERVE_BONUS_PER_PIZZA = 5;
export const MISSION_REWARD_SERVE_BONUS_CAP = 10;

function calculateMissionReward(metrics) {
  if (metrics.servedCount <= 0) return 0;
  const qualityBonus = Math.floor(averageQualityScore(metrics) / 10) * 5;
  const serveBonus = Math.min(metrics.servedCount, 10) * 5;
  return 40 + qualityBonus + serveBonus;
}
```

指示の推奨candidateをそのまま採用した（調整不要と判断）。

- **0枚提供で大量Pitz禁止** → `servedCount <= 0`は常に0 Pitz（調整前のcandidateは
  0枚でもbase 40を返す形だったため、実装時にこの1行のガードを追加した）。
- **通常プレイで極端に稼げない** → 上限は `40 + 50 + 50 = 140`（average Quality 100 かつ
  10枚以上提供）で頭打ち。`serveBonus`は10枚でキャップするため、40秒runでも140枚runでも
  同じ上限になる。
- **1〜3 Missionで初期Shop商品を買える** → 下記「Reward examples」参照。
- Mission Score（`missionScore()`, `src/logic/missionScoring.ts`）とPitz rewardは完全に別の
  pure function。前者は上限のないセッション内リーダーボード的スコア、後者は1 runあたり
  上限付きの通貨報酬。両者の値を混同・流用していない（`calculateMissionReward`は
  `missionScore`を一切呼ばない）。

## Reward examples

`src/logic/economy.test.ts`と手動検証で以下を確認（`averageQualityScore`は0-100スケール）:

| シナリオ | servedCount | 平均Quality | Pitz reward |
|---|---|---|---|
| 0枚提供 | 0 | - | **0** |
| 初心者（低品質・少数） | 2 | 45 | 70 |
| 普通 | 4 | 65 | 90 |
| 上手 | 8 | 85 | 120 |
| 理論上限（10枚以上・満点） | 12 | 100 | **140**（上限） |
| 1枚のみ・低品質 | 1 | 10 | 50 |

実機ブラウザ検証（後述）での実測値: 1 run目 提供3枚・平均61点 → **+85 Pitz**、
2 run目（累計） → 残高 165 Pitz（1 run目85 + 2 run目80）。
いずれも「約50〜150 Pitz/Mission」の目安に収まる。

## One-shot semantics（最重要）

指示第13章に従い、**effectが一度だけ動くことに依存しない**、状態レベルでのidempotent guard
として実装した。

1. `MissionState.runId`（`src/mission/lunchRush.ts`）: `START`アクション毎に`+1`。
   通常開始・Retryのいずれも新しい`runId`を得る。`EXIT_TO_FREE`では**リセットしない**
   （同一セッション内で後のrunが過去のrunIdと衝突しないようにするため）。
2. `GameState.lastClaimedMissionRunId`（`src/state/gameReducer.ts`）: 最後に報酬を適用した
   `runId`を記録。`CLAIM_MISSION_REWARD`アクションは
   `state.lastClaimedMissionRunId === action.runId`なら**完全なno-op**（`pitzBalance`も
   `lastClaimedMissionRunId`も変更しない）。
3. `App.tsx`の granting effect は`mission.mode === "RESULT"`のたびに
   `dispatch({ type: "CLAIM_MISSION_REWARD", runId: mission.runId, amount: calculateMissionReward(mission.metrics) })`
   を呼ぶだけ。**この効果が何度発火しても**（rerender・StrictMode二重呼び出し・
   Dex/Shop開閉による再render等）、`useReducer`のdispatchはstateに対して順番に適用される
   ため、2回目以降は`lastClaimedMissionRunId`が既に一致し安全にno-opになる。

「1 runにつき一度だけ」という保証は、React effectの実行回数ではなく、
**reducerの状態そのもの**に持たせている。

### Tests（one-shot関連）

- `src/state/gameReducer.test.ts`「CLAIM_MISSION_REWARD」: 同一runIdを10回連続dispatchしても
  合計が1回分にしかならないことを確認（`amount: 90`を10回 → `pitzBalance`は90のまま）。
- Retry後（新しいrunId）に前runのidを再dispatchしても変化なし、新runIdでは正しく加算される
  ことを確認。
- `src/mission/lunchRush.test.ts`「runId」: START毎に+1、SERVE/TICKでは変化しない、
  EXIT_TO_FREEでは保持されることを確認。
- ブラウザ実機検証で、Mission Result画面に留まったまま残高が変化しないこと（2回読み取って
  同値）、Retry直後に前run分が再付与されないこと（Retry直後の残高が変化しないこと）、
  2 run目終了時に新reward分だけ増えることを確認済み（後述）。

## Purchase transaction

`purchaseIngredient({ ingredient, ownedIngredientIds, totalStars, pitzBalance })`:

```ts
function purchaseIngredient(input) {
  const state = ingredientState(ingredient, ownedIngredientIds, totalStars);
  if (state === "OWNED") return { success: false, reason: "ALREADY_OWNED" };
  if (state === "LOCKED") return { success: false, reason: "LOCKED" };
  if (!isValidPrice(ingredient.pricePitz)) return { success: false, reason: "NOT_FOR_SALE" };
  if (pitzBalance < ingredient.pricePitz) return { success: false, reason: "INSUFFICIENT_FUNDS" };
  return {
    success: true,
    nextOwnedIngredientIds: [...ownedIngredientIds, ingredient.id],
    nextPitzBalance: pitzBalance - ingredient.pricePitz,
  };
}
```

- Pure function。成功/失敗いずれも「次の状態」を返すだけで、入力を一切mutateしない。
- `isValidPrice`は正の整数のみを受け付ける（欠損・0・負・NaN・小数は全て`NOT_FOR_SALE`）。
- `gameReducer`の`PURCHASE_INGREDIENT`はこの結果を適用するだけ:
  失敗時は`state`を完全に不変のまま返す（部分的失敗状態は存在しない）。
- **二重tap対策**: `purchaseIngredient`自体は同一入力に対し常に同じ結果を返す（副作用なし）
  ため、二重防止は「呼び出し側が結果を適用してから次を呼ぶ」構造に依存する。
  `useReducer`のdispatchは順番に適用されるため、1回目の適用後（`ownedIngredientIds`に
  追加済み）に2回目が来ても`ingredientState`は`OWNED`を返し、`ALREADY_OWNED`で拒否される。
  `src/logic/economy.test.ts`で「同一preState入力への2回呼び出し」と
  「実際の連続呼び出し（1回目の結果を2回目の入力にする）」の両方を検証済み。

### Tests（Purchase関連）

`src/logic/economy.test.ts`（26件）で以下を網羅:

- LOCKED購入拒否 / AVAILABLE+残高十分で成功 / ちょうどの残高で成功（残高0に）/
  残高不足拒否 / OWNED再購入拒否 / 価格なし・0・負・NaN・小数いずれも拒否 /
  価格を1回だけ正確に減算 / ingredient idを1回だけ追加 / 入力を変更しない /
  Starter Set 13食材は全てOWNED済みのため購入不可（回帰確認）

`src/state/progression.test.ts`（追加3件）で「Progression: purchase → OWNED → dependent
recipe available」を、テスト専用のmock ingredient/mock recipeを使い確認（`recipeUnlocked`の
ような専用フィールドは一切追加していないことも合わせて確認 — `isRecipeAvailable`が
`ownedIngredientIds`だけから毎回re-deriveされることをコードレビューとテストの両方で保証）。

`src/state/gameReducer.test.ts`（追加）でreducer配線自体（unknown id拒否・既にOWNEDな
Starter食材への購入がno-op・失敗時に`pitzBalance`/`ownedIngredientIds`が一切変化しない）を
確認。**本番データ上は購入可能な食材が0件**（Starter 13食材は全てOWNED、3C-6まで新食材を
追加しない指示のため）なので、実際に「購入成功」する経路のreducerレベルテストは、
mock ingredientを使う`economy.test.ts`側で担保している（指示第16章の「test fixture / pure
test用mock ingredientでLOCKED/AVAILABLE/purchaseを検証する」に対応）。

## Shop UX

`src/components/ShopOverlay.tsx`（新規）。既存`DexOverlay`と同じ
`position: absolute; inset: 0`のbottom-sheetパターンを再利用し、独自の巨大画面は作っていない。

- 入口: header（既存の📖レシピ図鑑ボタンの隣）に🛒 Shopボタンを追加。ORDER/PREPARE/BAKE/
  RESULT/DISCOVERED いずれのフェーズでも常時アクセス可能（Mission PLAYING中も同様）。
  Mission Result表示中はMission Result自体がz-index上位のフルスクリーンoverlayのため、
  その間はheaderへ到達できない（既存のDex overlayと全く同じ制約 — 仕様どおり）。
- header: 🪙残高チップ + 🛒 Shop + 📖レシピ図鑑、の3要素を横並びで表示（`flex-wrap: wrap`で
  390px幅でも折り返し安全）。
- Shop header: `🛒 SHOP` + `🪙 N Pitz`。
- 商品row: `INGREDIENTS.filter(i => i.unlockCondition)`（Starter Setを除く全食材）を
  `ingredientState()`でLOCKED/AVAILABLE_TO_BUY/OWNEDに分類して表示。
  - LOCKED: `🔒 あと★N`（`minTotalStars - totalStars`をderive）
  - AVAILABLE_TO_BUY: `🪙 N Pitz` + `[購入]`ボタン（残高不足時は`disabled`）
  - OWNED: `✓ 購入済み`
- production商品は現状0件（Starter 13食材のみ、3C-6まで新食材を追加しない指示のため）。
  0件でもクラッシュせず、「新しい素材は、ピザの腕前が上がると入荷します」という空状態文言を
  表示する（実機確認済み、後述）。debug/mock商品はproduction側に一切出していない。

## Persistence

- `PersistentSaveV1.pitzBalance` / `ownedIngredientIds`（Phase 3C-2で予約済みフィールド）を
  正式に読み書きする。`schemaVersion`は`1`のままbumpしていない（フィールド形状は無変更、
  内容の検証・読み書きロジックのみ追加したため）。
- **canonical persistence API**: `src/state/persistence.ts`に`persistProgress(snapshot)`を
  新規追加。`GameState`自身が持つ3つの永続フィールド（`dex` / `pitzBalance` /
  `ownedIngredientIds`）を、現在のsaveを1回読み込んだ上で1回のmergeでまとめて書き込む。
  `App.tsx`は従来の`persistDex`単独呼び出しから、この`persistProgress`呼び出しに置き換えた
  （`persistDex`自体は既存テストのため関数として残置、production配線からは外した）。
- **既存fieldをclobberしない**: `persistProgress`は`missionBest`を一切触らず
  （`...current`でそのまま引き継ぐ）、逆に`persistMissionBest`も`dex`/`pitzBalance`/
  `ownedIngredientIds`を一切触らない。どちらも「現在のsaveを読んでから該当フィールドだけ
  書き換える」パターンのため、Pitz更新・購入・Mission BEST更新が互いを踏みつけることはない
  （単体テストで相互非干渉を確認、後述）。
- 不要な書き込みをスキップするno-op guard（`dex`/`pitzBalance`/`ownedIngredientIds`の
  いずれも変化がなければ`setItem`を呼ばない）は既存`persistDex`のパターンを踏襲。
- 壊れた/未知schemaVersionのsaveに対するフォールバック（`loadSave`が例外を投げない、
  無効なsaveをdefaultで上書きしない既存保証）は無変更。

### Tests（Persistence関連）

`src/state/persistence.test.ts`に「persistProgress (Phase 3C-5)」を追加（8件）:

- pitzBalanceのroundtrip / ownedIngredientIdsのroundtrip / Pitz更新がDexをclobberしない /
  Pitz更新がmissionBestをclobberしない / `persistMissionBest`がpitzBalance/
  ownedIngredientIdsをclobberしない（逆方向） / 変化なしなら書き込みしない /
  storage例外時にthrowしない / 未知schemaVersionのsaveを上書きしない

## Recipe availability integration

購入成功後は`ownedIngredientIds`を更新するのみで、`recipeUnlocked`のような専用boolean
フィールドは一切追加していない。既存`isRecipeAvailable()` / `availableRecipeIds()`
（`src/state/progression.ts`, 無変更）が`ownedIngredientIds`から毎回re-deriveする構造を
そのまま利用しているため、購入直後から該当レシピが（必要食材が揃えば）自動的にavailableになる
——`src/state/progression.test.ts`の統合テストで確認済み（上記Purchase節参照）。

## Tests

```
$ npm test
 Test Files  11 passed (11)
      Tests  206 passed (206)
```

既存153テストは無変更のまま全てpass。新規53テストの内訳:

- `src/logic/economy.test.ts`（新規, 26件）: reward計算（0枚・境界・上限・単調性・
  純粋性・整数性）+ purchase transaction（LOCKED/AVAILABLE/OWNED/価格バリデーション/
  二重tap耐性/Starter Set回帰）
- `src/state/gameReducer.test.ts`（追加, 22件）: `createInitialGameState`のpitzBalance
  hydration、PLAY_AGAIN/MISSION_*でのpitzBalance carry-over、PURCHASE_INGREDIENTの
  reducer配線（no-op guard）、CLAIM_MISSION_REWARDの加算・idempotency・retry後の新規付与・
  0/負amountの扱い・Dex/ownedIngredientIdsへの非干渉
- `src/state/persistence.test.ts`（追加, 8件）: persistProgressのroundtrip・非clobber・
  no-op skip・例外安全性・未知schemaVersion保護
- `src/state/progression.test.ts`（追加, 3件）: purchase→OWNED→recipe available統合
- `src/mission/lunchRush.test.ts`（追加, 8件・既存リテラル修正含む）: runIdの増分・保持・
  SERVE/TICKでの不変性

## 390×844 browser verification (Playwright / Chromium)

`/opt/pw-browsers/chromium`を使い、390×844のビューポートで`npm run dev`起動中のアプリを
実際に操作して確認（console/page error監視、`scrollWidth <= clientWidth`によるoverflow
判定つき、全チェックで自動アサーション）。検証用の一時スクリプトはコミットに含めていない
（devサーバーでの手動確認用途のため、Phase 3C-4までと同じ方針）。

1. **Fresh load**: 新規セッションでheaderに`🪙 0`が表示されることを確認。
2. **既存6レシピ引き続きplayable**: FREE playで1ラウンド（マルゲリータ）を最後まで実行し、
   RESULTからDex登録まで確認。
3. **Pitz balance表示**: header常時表示チップで残高を確認（fresh load時`0`、Mission後
   実際の値に更新）。
4. **Shop開く**: header🛒Shopボタンからoverlayが開くことを確認。
5. **0商品state**: production商品0件で「新しい素材は、ピザの腕前が上がると入荷します」が
   正しく表示されることを確認（スクリーンショット: `shop-2-empty.png`）。
6. **Shop閉じる**: 閉じるボタンでoverlayが消えることを確認。
7. **Lunch Rush開始**: `?missionDuration=6`のdev短縮設定でMission Intro→スタートを確認。
8. **2枚以上提供**: 1 run目で3枚提供を確認。
9. **Mission Result表示**: タイマー切れでMission Result overlayへ遷移することを確認
   （スクリーンショット: `shop-4-mission-result.png`）。
10. **Pitz reward表示**: `🪙 +85 Pitz`が正しく表示されることを確認（提供3枚・平均61点から
    導出される40+30+15=85と一致）。
11. **残高が1回だけ増加**: `localStorage`の`pitzBalance`が85（0→85）へ1回だけ変化したことを
    確認。
12. **Mission Result画面に留まっても増えない**: 同画面で2回連続してheader残高を読み取り、
    完全に同値であることを確認（Dex/Shopはこの画面の上には開けない仕様——後述Known issues
    参照——のため、この形で「反復してもreward re-grantされない」ことを検証）。
12b. **FREEへ戻った後のDex開閉でも残高不変**: Exit後、Dexを開いて閉じても残高が変化しない
    ことを確認。
13. **Retryで前run報酬が再付与されない**: 「もう一度」クリック直後、残高が前run終了時点の
    値（85）のまま変化しないことを確認。
14. **2回目のMission終了で新reward分だけ増加**: 2 run目終了後、残高が85→165（+80）へ、
    ちょうど新run分だけ増加したことを確認（累積であって前run分の再付与ではないことを確認）。
15. **リロード後も残高維持**: reload後、`pitzBalance`が165のまま、header表示も`🪙 165`の
    ままであることを確認（スクリーンショット: `shop-5-after-reload.png`）。
16. **Dex BEST/timesMade維持**: reload前後で`dex`のJSON文字列が完全一致することを確認。
17. **Mission BEST維持**: reload前後で`missionBest`のJSON文字列が完全一致することを確認。
18. **FREE playでPitz増加なし**: FREE play 1ラウンド完走後、`pitzBalance`が0のままである
    ことを確認（save自体が存在しない場合は0として扱う——`persistProgress`の
    no-op skipにより、デフォルト値から何も変化していない場合はそもそも書き込みが
    発生しないため）。
19. **console/page error 0件**: 全シナリオを通して確認。
20. **horizontal overflowなし**: 全チェックポイントで`scrollWidth <= clientWidth`を確認
    （header 3要素+タイトルが390px幅で折り返しなく収まることを確認）。

```
=== SUMMARY ===
console errors: none
page errors: none
overflow findings: none
ALL CHECKS PASSED
```

### 購入flowの実機確認について

指示どおり、production商品が0件のため、購入成功フロー自体は実機（ブラウザ）では検証していない
（salami等をproductionへ仮追加してbrowser検証することも行っていない）。購入成功/失敗の
全パターンはunit test（`economy.test.ts`のmock ingredient、`progression.test.ts`の統合
テスト）で網羅的に検証済み。

## Balance sanity

「Reward examples」節の表のとおり、初心者〜上手いずれのプレイパターンでも
50〜150 Pitz/Missionの目安に収まることを確認した（実測でも1 run目85 Pitz・2 run目80 Pitz）。
formula調整は不要と判断した。3C-6での最初のShop商品価格は本PRでは確定しないが、
1〜3 Mission（約85〜420 Pitz程度）で購入できる設計余地は十分にある。

## FREE regression

- 6 Starter recipes・13 Starter ingredients・Sauce Painting・★1〜5採点・Dex BEST・
  timesMade・totalStars・persistence・recipe availability・Lunch Rush（既存の全機能）は
  無変更（既存153テスト + 今回のbrowser verificationで確認）。
- FREE playは常に0 Pitzのまま（実機・単体テスト両方で確認）。
- header見た目の変更は、既存📖レシピ図鑑ボタンの隣に🪙残高チップと🛒Shopボタンが増えたのみ。

## SSOTとの整合（第19章対応）

実装中、`docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`第8章の初期案（v1.0時点）
「常設ミッション: RESULT確定のたびに★に応じたPitzを即時付与」が、本チケットの確定事項
（第2章「Pitz source = Mission only」「FREE = 0 Pitz」、第4章「Lunch Rush終了時にPitz
reward」）と矛盾していた。具体的には、初期案の「常設ミッション」はFREE playのRESULTでも
Pitzを付与しうる設計であり、本チケットが明示する「FREE play: 0 Pitz」と両立しない。

指示第19章「軽微で明白ならSSOTを実装に合わせて更新」に従い、以下の判断でSSOT側を更新した
（production codeの再設計は行っていない — 元よりチケットの確定事項どおりに実装している）:

- **軽微・明白と判断した理由**: 本チケット自体が「Pitz source = Mission only」
  「FREE = no Pitz」を明示的に「今回確定する内容」として指定しており、SSOT第8章の初期案は
  「Phase 3C-5で確定する」と明記されたプレースホルダ（設計時点の一案）に過ぎなかったため。
  骨格（Missionが唯一の入手経路・Shopでの恒久購入・OWNED=永久所有等）自体への変更はない。
- SSOT第8章を「Lunch Rush 1 run単位・Mission Result到達時に一度だけ付与」という、
  本実装の実際の方式に置き換え、旧「常設ミッション」「マイルストーンミッション」案は
  「Phase 3C-5では不採用」として打ち消し線付きで残した（変更履歴として保持）。
- 改訂履歴にv1.2エントリを追加。

大きな矛盾（骨格レベルの食い違い）は見つからなかったため、STOPしての報告は不要と判断した。

## Known issues

- **P2**: Mission Result表示中はheader（Dex/Shopボタン含む）へ到達できない
  （`.mission-overlay`がz-index 25、header/Dex/Shopはそれより下）。これはPhase 3C-4の
  P2-2対応（「Dexを開いたままMission開始→新runにDexが再浮上しない」）と同じ設計判断の
  延長で、意図的な挙動（Mission Resultは常に最前面で完結させる）。指示第17章の「12. Dex
  open/closeしても増えない」は、この制約のため文字どおりのUI操作としては再現できず、
  「Mission Result画面に留まったまま残高が変化しないこと」+「FREEへ戻った後のDex開閉で
  残高が変化しないこと」の2つに分けて検証した（詳細は「390×844 browser verification」
  節の12/12b参照）。「同一runIdでのCLAIM_MISSION_REWARD反復dispatchが安全」という核心の
  保証自体は`gameReducer.test.ts`で直接・網羅的に検証済み。
- **P2**: 現在Shopの購入対象は0件（指示どおり、3C-6まで新食材を追加しない）。そのため
  購入成功フローの実機確認はunit testのみで担保している（上記「購入flowの実機確認に
  ついて」参照）。3C-6で実データ食材が追加された時点で、実機での購入フロー確認を
  追加することを推奨する。
- **P2**: マイルストーンミッション（「はじめてのピザを完成させる」等、SSOT第8章旧案の
  もう一方）は本フェーズでは実装していない（指示の「今回確定する内容」に一度きり
  ミッションは含まれていなかったため、意図的に見送り）。将来必要になれば別途検討する。
- **P2**: `pricePitz`は現在どの本番食材にも設定されていない（Starter 13食材は全て
  `unlockCondition`なし=常にOWNEDのため、価格自体が無意味）。3C-6で最初の商品を追加する際、
  具体的な価格は本PRでは確定していない（指示どおり「今回は価格確定不要」）。
- Pitz・Shop UI以外の要素（salami・Recipe #7・素材消費/在庫・実課金連携）は本フェーズの
  非スコープであり未実装（意図通り）。

P0/P1: 0件。

## Final Verdict

**A. READY TO MERGE**

- スコープ（Mission→Pitz付与・Shop購入UI・購入→OWNED→recipe availability連携）を逸脱して
  いない。salami/Recipe #7・素材消費/在庫・マイルストーンミッションは追加していない。
- 既存5フェーズ状態機械・既存6レシピ・既存13食材・既存採点ロジック・既存Lunch Rush
  timer/one-shot semantics（PR #18のdeadline後serve拒否・one-shot finish・Dex close on
  retry）を破壊していない（実機・単体テスト両方でFREE/Mission regressionを確認済み）。
- Pitz reward付与は「1 runにつき一度だけ」をreducer状態のidempotent guard
  （`MissionState.runId` + `GameState.lastClaimedMissionRunId`）で構造的に保証しており、
  React effectの実行回数に依存していない（rerender/StrictMode二重effect/retry全てを
  単体テスト・実機の両方で確認済み）。
- 購入transactionはpure functionとして実装し、atomic（成功/失敗の中間状態がない）。
  二重tap耐性は`useReducer`のdispatch順序保証に基づく設計で、単体テストで検証済み。
- Canonical（`ownedIngredientIds` / `pitzBalance`）とderived
  （`IngredientState` / recipe availability）の境界を守り、`recipeUnlocked`のような
  重複stateは作っていない。
- 経済ルールをApp.tsxへ直接書かず、`src/logic/economy.ts`のpure functionへ集約した
  （指示第15章の設計方針に準拠）。
- 既存fieldのclobber防止を単体テストで直接検証（Pitz更新がDex/missionBestを、
  Mission BEST更新がpitzBalance/ownedIngredientIdsを、それぞれ壊さないことを確認）。
- schemaVersionをbumpせずに互換性を確保。
- lint / test / build すべてグリーン（206/206テスト、既存153件を維持しつつ新規53件追加）。
- 390×844実機確認で指定20項目（fresh load・Shop開閉・0商品state・Mission reward表示・
  残高1回だけ増加・Retry非再付与・2回目run新規加算・reload後維持・FREE play残高不変・
  console/page error 0件・overflowなし）を確認済み。
- P0: 0件 / P1: 0件。残るKnown issuesはいずれもP2（ブロッカーなし）。
