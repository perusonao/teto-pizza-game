# Progression 2.0 Phase 3-4F — Lunch Rush Stock-Aware Mission Pool: Fresh Audit / Pre-Implementation Design

- **Audited main SHA:** `dff233c042d2df6ee1c3a92f2d2419830aa05460`（PR #210 のマージ。その 1 つ前が PR #202 のマージ `66abe43`）
- **Branch:** `claude/lunch-rush-stock-audit-4gd20m`（docs のみ）
- **種別:** Fresh Audit と実装前設計。**production runtime の変更はなし。**
- **触っていない PR:** #205（3-4A）、#206（3-4B）、#209（OD-03 brief）、#211（3-4C preflight）。どれも読んだだけ。3-4C の実装や OD-03 の決定はしていない。
- **Machine-readable 版:** `docs/reports/data/PROGRESSION-2.0_P3-4F_SCENARIO-MATRIX.json`（シナリオ matrix、テスト matrix、Human Replay、シミュレーションの生の結果）
- **シミュレーションの再現:** `docs/reports/data/PROGRESSION-2.0_P3-4F_simulation.test.ts.txt`。一時的に `src/` の直下のサブディレクトリ（例: `src/__tmp__/sim.test.ts`。import が `../state/...` の相対パスのため）へコピーし、`P34F_OUT=<path> npx vitest run <file>` で実行する。production の reducer とデータをそのまま使う。コミットされた `src/**` はない。

GitHub の状態（2026-09-23、`list_pull_requests` と `git log origin/main` で確認）:

| PR | 状態 | この監査との関係 |
|---|---|---|
| #202 | MERGED（`66abe43`） | Mission pool = discovered ∩ available。空なら fail-closed |
| #210 | MERGED（`dff233c`） | Full WebKit は 2 viewport × 2 shard の 4 job。必須チェックは `WebKit Gate` |
| #205 | OPEN | 3-4A の pure API（`remainingPizzaUses`、`consumePizzaUse` など）。main では使われていない |
| #206 | OPEN | save の forward-compat。未知 id は保持するが `GameState` には入れない |
| #209 | OPEN | OD-03 は未決定 |
| #211 | OPEN | 3-4C preflight。§4.1 と §9 の 10 で「在庫を考慮した pool は 3-4F」としている |

---

## 0. 結論（先に）

1. **現在の pool rule:** `pickMissionOrder(availableRecipeIds(dex, owned), discovered, prevRecipeId)`。候補は discovered ∩ available（EP1 の `recipeUnlocked` AND 必要な材料がすべて OWNED）で、**在庫（`inventory`）は一切見ていない。**
2. **soft-lock は production のデータで再現した。** OWNED だが在庫が 0（または minCount に足りない）の発見済み recipe が、普通に注文される。その注文は Stock Gate のせいで材料を置けず、Completion Gate で必ず **FAILED** になる（0 点の serve）。skip の手段はなく、Mission 中は Shop も開けない。
   - 2 recipe のうち 1 つが作れない場合: 注文の **50%** が作れない。直前と同じ recipe を避ける仕組みのせいで、作れる方の次は**必ず**作れない方になる（確率 100/100）。
   - 6 recipe のうち 2 つが作れない場合: 注文の **33.7%** が作れない（600 回引いた結果）。
3. **作れる recipe が 0 件（E）の状況は、今の main では到達できない。** 発見済みの Margherita は starter の無限在庫で必ず作れるからだ。ただし 3-4C（`recipeUnlocked` の撤去）と A-01/OD-03 の結果によっては到達可能になる。そのときに備えて、pool が空のときの処理にある**潜在的なバグを 2 つ**確認した（§3 の E2/E3）。
4. **推奨:** **Option B（注文を作るたびに、在庫を考慮した pool を評価し直す）と、Zero-candidate policy「開始をブロック / 途中なら run を早めに終える」の組み合わせ。** Option C（注文の差し替えや skip）は 3-4F には入れない。
5. **3-4F の実装: Go（条件付き）。** 在庫の単位（片数から use へ）は、`requiredStockUnits` という 1 か所の seam の裏に閉じ込める。こうすれば 3-4C より前でも後でも merge できる。OD-03 の決定は待たなくてよい。

---

## 1. 現在の Lunch Rush pool の生成経路（PR #202 の後の main が SSOT）

```
HOME 「ランチラッシュ」
  └ App.handleStartLunchRush  (src/App.tsx:760)   guard: hasAnyDiscovery (App.tsx:165)
      └ missionDispatch SHOW_INTRO → MissionIntroOverlay
          └ App.startMission (App.tsx:470)
              ├ missionDispatch START            → mode PLAYING, 新しい clock, runId+1
              └ dispatch MISSION_RESET_ORDER     (gameReducer.ts:1299)
                  └ nextMissionOrderState(state) (gameReducer.ts:475)
                      ├ ids  = availableRecipeIds(dex, owned)        (progression.ts:82)
                      │         = RECIPES.filter(recipeUnlocked && ingredientsOwned)
                      ├ disc = discoveredRecipeIds(dex)
                      ├ order = pickMissionOrder(ids, disc, state.recipe.id)   (lunchRush.ts:87)
                      │         pool = ids ∩ disc; 空なら null (lunchRush.ts:99)
                      │         getNextOrder({ availableRecipeIds: pool, excludeRecipeId })
                      │           → availableOrders → avoidRepeat → pickRandom   (orders.ts:129-158)
                      └ order が null なら `return state`（fail-closed、gameReducer.ts:482）
                        そうでなければ buildOrderState(order, carry, isMissionRound=true)

1 枚ごと: PREPARE → BAKE → CONFIRM_BAKE (gameReducer.ts:940)
          ├ phase guard `state.phase !== "BAKE"` なら no-op（二重消費を防ぐ）
          ├ completion = evaluatePizzaCompletion
          └ inventory = consumePizzaInventory(pizza, inventory)  (gameReducer.ts:1009) ← 唯一の消費点
        [CUT がある recipe は POST_BAKE → CONFIRM_MAKING_STEP → RESULT]

「次の注文へ」 App.handleMissionServeNext (App.tsx:514)
  ├ missionDispatch SERVE（FAILED なら qualityTotal 0、metrics には数えない）
  └ 締め切り前なら:
      ├ dispatch MISSION_NEXT_ORDER (gameReducer.ts:1265)
      │   ├ guard: phase === RESULT && score
      │   ├ registerScoreToDex、applyStarterGrants（EP4）
      │   └ nextMissionOrderState(...)   ← 消費した後の inventory で pool を評価する
      └ dispatch BEGIN_PREPARE (App.tsx:549)   ← MISSION_NEXT_ORDER が no-op でも無条件に出る
```

各項目のまとめ:

| 項目 | 現在の実装 |
|---|---|
| available recipes | `availableRecipeIds` = EP1 の `recipeUnlocked`（Dex の連鎖と totalStars）AND `ingredientsOwned`。**在庫は見ない** |
| discovered recipes | `dex[].discovered === true` |
| mission candidate pool | available ∩ discovered（#202） |
| immediate-repeat avoidance | `avoidRepeat`: 直前の recipe を除く。除くと空になる場合（pool が 1 件）は除かない |
| mission start | `MISSION_RESET_ORDER`。pool が空なら no-op。ただし App 側は `hasAnyDiscovery` しか見ずに START してしまう（§3 E2） |
| mission completion（1 枚） | `CONFIRM_BAKE` で消費。`SERVE` で metrics。`MISSION_NEXT_ORDER` で Dex 登録と次の注文 |
| next mission generation | 毎回 `nextMissionOrderState` が pool を**一から導出する**。キャッシュも、run 開始時のスナップショットもない |

**重要な構造上の事実:** 次の注文は毎回、**直前の pizza の `CONFIRM_BAKE` で在庫を消費した後の state** から導出される（MISSION_NEXT_ORDER は CONFIRM_BAKE の後にしか通らない。RESULT guard があるため）。つまり今のコードは「完了のたびに pool を評価し直す」形になっている。足りないのは**在庫を見る predicate だけ**だ。

---

## 2. 「作れる」の定義を分解する

| # | 条件 | 現在の main での判定 | pool の判定に含めるか |
|---|---|---|---|
| 1 | Dex discovered | `isDiscovered`。#202 で pool に入った | **含める**（#202 を維持） |
| 2 | recipe unlocked | EP1 の `recipeUnlocked`。3-4C で撤去予定（#211 §4） | 含める（`isRecipeAvailable` を通して。3-4C で自然に消える） |
| 3 | 必要な材料がすべて OWNED | `ingredientsOwned` | **含める**（今も含まれている） |
| 4 | finite の在庫が残っている | **判定していない** | **含める（3-4F の本体）** |
| 5 | starter の無限材料 | `!ingredient.unlockCondition` なら `hasStock` は常に true（今は tomato-sauce、mozzarella、basil。3-4A の `initialOwned` と同じ 3 つ） | 無限なので自動的に満たす。判定から除く |
| 6 | sauce / dough / topping | sauce（spread）は 1 枚で 1 unit。cheese と topping（scatter）は置いた片数ぶん消費。dough は材料ではない（在庫の概念がない） | spread と scatter の両方を判定する。dough は対象外 |
| 7 | 数量 | 今の単位は**片数**。PASS には scatter なら `minCount` 片、spread なら 1 が要る（Completion Gate が `INSUFFICIENT_REQUIRED_AMOUNT` を判定するため） | **含める。** 在庫 ≥ `requiredStockUnits` |
| 8 | 1-pizza-use 方式 | 3-4A（#205）: `PROGRESSION_USES_PER_PIZZA = 1`、`remainingPizzaUses`。3-4C で片数から use に切り替わる | `requiredStockUnits` の実装を差し替えるだけで対応できるようにする（§8） |
| 9 | Completion Gate の他の条件（sauce の量、焼き加減） | プレイヤーの腕で決まる | **含めない**（作れるかどうかではなく、上手く作れるかどうかの問題） |

**3-4F の makeability（pool の判定）:**

```
isRecipeMakeable(recipe, ctx) :=
     isDiscovered(ctx.dex, recipe.id)
  && isRecipeAvailable(recipe, ctx.dex, ctx.owned)          // 2 + 3（3-4C の後は 3 だけ）
  && recipe.requiredIngredients.every(req =>
        isUnlimited(ing(req)) ||
        remaining(ing(req), ctx.inventory) >= requiredStockUnits(ing(req), req))
```

`requiredStockUnits`（seam）:
- **今の main（片数）:** scatter なら `req.minCount`、spread なら `1`。これは `canPlaceIngredient` と `consumePizzaInventory` の数え方と、Completion Gate の `minCount` に合わせたもの。
- **3-4C の後（use）:** 材料が何であっても `PROGRESSION_USES_PER_PIZZA`（= 1）。

この定義は **PASS できる材料が揃っているか**を見るもので、「材料を 1 片でも置けるか」ではない。B2（在庫 2 < minCount 3）は Stock Gate で 2 片までは置けるが、必ず FAILED になる。だから作れない側に入れる必要がある。

---

## 3. soft-lock の再現（production の reducer とデータを使ったシミュレーション）

finite の材料は 19 種類、無限（starter）は 3 種類（tomato-sauce、mozzarella、basil）。全材料が無限の recipe は **Margherita だけ**。残りの 14 recipe はどれも finite の材料が 1 つ以上ある。

| # | シナリオ | 設定 | 結果（main `dff233c`） | 判定 |
|---|---|---|---|---|
| A | 発見済みだが、必要な材料を買っていない | dex={margherita, funghi}、mushroom を所持していない | funghi は `available` に入らない。200 回すべて margherita | **soft-lock しない**（OWNED の判定がすでに防いでいる）。ただし今の EP4 では、発見済みで未所持の状態自体がまず起きない |
| B | OWNED だが在庫 0 | mushroom は OWNED、在庫 0 | 200 回中 funghi が 100 回（**50%**）。mushroom は 3 片とも Stock Gate で拒否され、**FAILED（MISSING_REQUIRED_INGREDIENT）** | **soft-lock を確認** |
| B2 | OWNED だが在庫が minCount に足りない | mushroom 2 < funghi の minCount 3 | 2 片は置けるが 3 片目で拒否され、**FAILED（INSUFFICIENT_REQUIRED_AMOUNT）**。**しかも残りの 2 片を消費して在庫が 0 になる** | **soft-lock を確認**。在庫の浪費もある |
| C | 複数の recipe のうち、一部だけ作れる | 6 件発見、starter grant の後で mushroom=0、egg=0 | pool 6 件のうち 2 件が作れない。600 回中 202 回（**33.7%**）が作れない注文 | **soft-lock を確認** |
| D | 作れる recipe が 1 件だけ | 作れる = {margherita}、作れない = {funghi} | funghi と margherita が交互に出る。注文の **50%** が必ず FAILED | **soft-lock を確認** |
| D' | pool 自体が 1 件（#202 の one-recipe 仕様） | pool = {margherita} | 50 回すべて margherita。同じ recipe の連続は 49 回 | 正常（#202 のとおり） |
| E | 作れる recipe が 0 件 | dex={funghi} だけ、mushroom の在庫 0 | **今の main:** EP1 の `recipeUnlocked(funghi)` には margherita の発見が必要なので、pool は空になり `MISSION_RESET_ORDER` は no-op。**3-4C 後の予測:**（available = 全材料 OWNED）では pool={funghi} で 50/50 回 funghi、毎回 FAILED | 今の main では到達しない。**3-4C の後、A-01/OD-03 によっては到達しうる** |
| E2 | pool が空の状態で開始する（潜在） | 合成した状態: margherita を発見済み、basil がない | `MISSION_RESET_ORDER` は同じ参照を返す（`isMissionRound=false` の FREE の round のまま）。App 側は `hasAnyDiscovery` しか見ないので、**START して PLAYING になる。FREE の round の上で Mission が走る** | **潜在バグ**（今のデータでは到達しない） |
| E3 | run の途中で pool が空になる（潜在） | 合成した状態: Mission の RESULT の後で pool が空になる | `MISSION_NEXT_ORDER` が phase=RESULT のまま返る（Dex は登録済みで timesMade=2）。続く `BEGIN_PREPARE` で、**焼いた後の pizza（score と bakeResult 60 を持ったまま）が PREPARE に戻る**。もう一度 serve すると同じ pizza が二重に登録される | **潜在バグ。在庫を考慮した pool を入れると到達可能になる**（G と E の組み合わせ）。3-4F で必ず直す |
| F | 直前と同じ recipe しか作れない | 直前 = margherita、作れるのは margherita だけ | 次の注文は **100/100 回 funghi（作れない）** | **soft-lock を確認**（repeat avoidance が作れることより優先されている） |
| G | Mission 中に最後の在庫を使い切る | mushroom 3（funghi 1 枚ぶん） | funghi は PASS し、在庫 3 → 0。その後も funghi が 50% の確率で注文される | **soft-lock を確認** |
| H | reload の後 | 永続化された在庫 mushroom=0、grant は受け取り済み | load 時の `applyStarterGrants` は補充しない（受け取り済みのため）。reload 後の pool は同じで、50% が作れない。Mission の run の状態は永続化されないので、reload すると HOME に戻り、run は失われる | **soft-lock を確認**（reload しても直らない。悪化もしない） |

補足:
- FAILED の serve でも、置いた finite の材料は消費される（EP2 の仕様どおり）。B2 のように「足りない在庫を置いた結果、0 になって FAILED」という浪費が起きる。
- Mission 中は Shop に入れない（`onOpenShop` は HOME にしかない）。skip の action もない。作れない注文を抜ける手段は「FAILED のまま serve する」か「HOME に戻る（run を放棄）」の 2 つだけだ。
- soft-lock といっても、進行が完全に止まる hard-lock ではない。run は FAILED の serve で進められる。ただしその注文はスコアが確実に 0 になり、時間と材料も失う。ゲーム体験の上では「作れない注文が出る」という致命的な UX 不具合だ。

---

## 4. Mission Pool の仕様案の比較

- **Option A:** run を開始するときだけ「今作れる recipe」で pool を確定し（スナップショット）、run の間は固定する。
- **Option B:** 注文を作るたび（開始時と、各 serve の後）に、その時点の state から作れる pool を評価し直す。
- **Option C:** 注文を決めた後に材料が足りなくなったら、注文を差し替えるか skip できるようにする。
- **Option D（追加）:** 在庫は見ずに、作れない注文の重みだけを下げる（ソフトな重み付け）。

| 観点 | A: 開始時のスナップショット | **B: 注文ごとに再評価（推奨）** | C: 差し替え / skip | D: 重み付け |
|---|---|---|---|---|
| soft-lock | G（run 中の枯渇）が**残る** | **全部なくなる**（B/B2/C/D/F/G/H） | 注文が出た後で回避するので、1 回は作れない注文が出る | 残る（確率が下がるだけ） |
| gameplay | run の途中で作れない注文が出る | 常に作れる注文だけが出る。自然 | skip の UI と罰則を新しく設計する必要がある。テンポが悪い | 予測できない |
| determinism | 開始時に確定する | 同じ state と同じ乱数なら同じ結果（pure な関数） | skip の入力に依存する | 同左 |
| save/reload | run 自体が永続化されないので、reload すると関係ない | reload 後も永続化された在庫から同じように導出される | 同左 | 同左 |
| testability | スナップショットの状態が増える | **pure な predicate + 既存の reducer test** | UI と action が増える | 確率のテストが要る |
| complexity | `MissionState` に pool を持たせる必要がある | **最小:** predicate を 1 つ足して、`nextMissionOrderState` の入力を差し替えるだけ | 大きい（action、UI、スコアの扱い） | 小さいが効果がない |
| future 101 recipes | pool が大きくなっても同じ問題が残る | O(recipes × required) で毎回導出。101 × 数件程度なら軽い | 同左 | 同左 |
| inventory 消費との競合 | 開始後の消費を反映しない | **注文は常に前の CONFIRM_BAKE の後に導出される**ので、競合しない（§7） | 作っている途中の差し替えは、消費との整合性がややこしい | — |

**推奨: Option B。** 今のコードはすでに「毎回導出する」構造なので、predicate を足すだけで済む。Option C は、B を入れると必要になる場面がない（注文を決めてから bake するまでに、在庫がその pizza 以外の理由で減る経路がない。§7）。A は G を解決しない。D は soft-lock そのものを残す。

---

## 5. Zero-candidate policy

「作れない recipe を注文して続行する」は**禁止**とする（今の E の 3-4C 後の予測と同じ状態で、毎回 FAILED の run になるため）。

### 5.1 開始時（makeable pool = 0）
| 候補 | 評価 |
|---|---|
| **Lunch Rush を開始させない + 次の行動を案内する（推奨）** | 既存の `lunchRushLocked` と同じ見せ方（ボタンを disabled にし、理由を 1 行出す）。CTA は 🛒 ショップ（補充）と 🎨 フリークッキング |
| 開始してすぐ終了する | タイマーと報酬の扱いが不自然 |
| fallback の recipe（Margherita を強制する） | 未発見のまま注文させると #202 の方針に反する。発見済みなら、そもそも 0 件にならない |
| inventory refill CTA だけ | Pitz が足りないとまた詰まる。Free Cooking も併記すべき |

具体的な仕様:
- `canStartLunchRush(state) = makeableMissionRecipeIds(state).length > 0`（pure）。
- HOME: `lunchRushLocked`（未発見）とは**別の理由**として `lunchRushOutOfStock` を足す。ボタンは disabled にし、ヒントは「🛒 材料が足りないよ。ショップで補充するか、フリークッキングで作ろう」。「ショップ」の CTA は既存の `onOpenShop` を使う。
- App の guard: `handleStartLunchRush` と `startMission`（retry を含む）の**両方**で `canStartLunchRush` を確認する（UI だけに頼らない。E2 を直す）。
- retry（「もう一度」、RESULT から）でも同じ判定をする。0 件なら retry ボタンを disabled にし、同じ案内を出す。

### 5.2 run の途中（serve の後に makeable pool = 0）
| 候補 | 評価 |
|---|---|
| **run を早めに終えて RESULT に進む（推奨）** | metrics、報酬、ranking の送信は既存の RESULT の経路をそのまま使う。`clientDurationMs` は参考値で、上限しか検証されないので、早めに終えても送信は成立する（`functions/src/submitLunchRushScore.ts:212-220`） |
| Mission を中断して HOME に戻す | それまでの serve の報酬を失う。不公平 |
| 作れない注文を出す | 禁止 |

具体的な仕様:
- `missionRunReducer` に `END_EARLY { reason: "NO_MAKEABLE_ORDER", now }` を足す。PLAYING なら RESULT に移る。一度しか遷移しない guard は TICK と同じにする。
- `MISSION_NEXT_ORDER` は、pool が空なら **Dex への登録と grant だけを行い、`phase: "RESULT"` のまま返す**（今と同じ）。そのうえで App（`handleMissionServeNext`）は、**次の注文が出たことを確認できたときだけ `BEGIN_PREPARE` を出す**。出せなかった場合は `END_EARLY` を出す（E3 を直す）。確認の方法は、pure な `canStartLunchRush(nextState)` を先に評価する方法を推奨する。reducer の結果を見てから分岐する方法ではない。
- RESULT のオーバーレイに、早めに終わった理由を 1 行出す: 「材料がなくなったので今日のランチラッシュはここまで！」。
- 今のデータ（Margherita を発見済み = 常に作れる）では、run の途中で 0 件にはならない。上の処理は、3-4C と OD-03 の後のための防御になる。

---

## 6. one-recipe pool

- **makeable を先に適用し、そのあとで repeat avoidance をかける。** これで「作れることが repeat avoidance より優先される」が構造的に成り立つ。`getNextOrder` の `avoidRepeat` はもともと「除くと空になるなら除かない」なので、pool を makeable の集合に絞ってから渡すだけでよい（F: 次の注文が 100% funghi だったものが、100% margherita になる）。
- **#202 との整合:** #202 の one-recipe 仕様（pool が 1 件なら連続を許す、`lunchRush.ts` の doc と `orders.ts:129-135`）を、「discovered ∩ available」から「discovered ∩ makeable」に広げるだけだ。挙動としての契約は変わらない。#202 のテスト（pool が 1 件なら同じ recipe を繰り返す）はそのまま通るはず。
- 同じ recipe が連続すると単調にはなるが、soft-lock よりはるかにましだ。Human Replay の 2 番で確認する。

---

## 7. inventory の atomicity

| 事象 | 今の挙動 | 3-4F（Option B）との関係 |
|---|---|---|
| bake 時の消費 | `CONFIRM_BAKE` だけで消費する（phase guard で 1 回だけ）。PREPARE 中の配置は予約扱いで、消費しない | 次の注文は、必ずこの消費の**後**の state から導出される（MISSION_NEXT_ORDER には RESULT guard がある） |
| 注文を決めてから bake するまでの在庫の変化 | Mission 中に在庫を増減させる経路は「その pizza 自身の CONFIRM_BAKE」だけだ（Shop は HOME にしかない。grant は MISSION_NEXT_ORDER の中で pool を評価する前に適用される） | **競合しない。** 注文したときに作れた recipe は、その pizza の bake までずっと作れる |
| retry（もう一度） | `START` と `MISSION_RESET_ORDER`。作りかけの pizza は捨てられ、消費しない | 開始時の判定（§5.1）をもう一度通る |
| cancel / HOME に戻る | `EXIT_TO_FREE` と `PLAY_AGAIN`。CONFIRM_BAKE の前なら消費しない | 影響なし |
| 締め切りの後の serve | CONFIRM_BAKE で消費済み。SERVE は拒否され、MISSION_NEXT_ORDER も出ない | 影響なし（今の仕様: 締め切りの後に焼いた材料は戻らない。3-4F の対象外） |
| reload | run の状態は永続化されない。在庫は `persistProgress` で CONFIRM_BAKE の直後に保存される | reload 後の判定は永続化された在庫から導出される。二重消費や消費漏れはない |
| mission transition（serve → 次の注文） | MISSION_NEXT_ORDER（登録、grant、注文）と BEGIN_PREPARE | 0 件なら BEGIN_PREPARE を出さず、`END_EARLY` を出す（§5.2） |
| double consumption | CONFIRM_BAKE の `phase !== "BAKE"` guard | 3-4F は消費経路に触らない |
| FAILED の serve での消費 | 置いた分は消費する（EP2 の仕様） | 3-4F で作れない注文がなくなるので、B2 のような浪費は大きく減る |

結論として、Option B は消費の transaction boundary（CONFIRM_BAKE）に**一切触らない**。読み取り専用の predicate を足すだけで済む。

---

## 8. #205（3-4A）との接続点

- 3-4A の関数のうち使えるもの:
  - `remainingPizzaUses(unlock, stock)`: 無限なら `"UNLIMITED"`、そうでなければ use の数を返す。3-4C の後の `remaining` にそのまま使える。
  - `PROGRESSION_USES_PER_PIZZA`（= 1）: 3-4C の後の `requiredStockUnits`。
  - `consumePizzaUse`: 消費の側なので、3-4F は使わない。
- **ただし #205 は未マージで、runtime の在庫はまだ片数の単位だ。** 3-4F で #205 を import すると、#205 の merge 順に縛られる。
- **Layer の設計（推奨）:**
  - `src/state/progression.ts` に `isRecipeMakeable(recipe, dex, owned, inventory)` と `makeableRecipeIds(...)` を置く。`isRecipeAvailable` と `availableRecipeIds` の隣だ。「作れるかどうか」の SSOT を progression.ts の 1 か所に保つため。
  - 単位の差は `src/state/inventory.ts` の `requiredStockUnits(ingredient, requirement)` と `remainingStockUnits(ingredient, inventory)` に閉じ込める。これは `hasStock` と `remainingStock` の隣に置き、今は片数の単位で実装する。3-4C は、この 2 つの関数の中身を `remainingPizzaUses` と `PROGRESSION_USES_PER_PIZZA` に差し替えるだけで済む。そうすれば pool の判定も一緒に use の単位に移る。
  - `src/mission/lunchRush.ts` の `pickMissionOrder(availableRecipeIds, discoveredRecipeIds, exclude)` はシグネチャを変えない。`nextMissionOrderState` が `availableRecipeIds(...)` の代わりに `makeableRecipeIds(...)` を渡す。これで #202 のテストをそのまま再利用できる。
  - 新しい pure 関数 `canStartLunchRush(state)`（または `makeableMissionRecipeIds(state)`）を `lunchRush.ts` に置き、App の guard と HOME の表示から使う。
- **#205 を変更する必要はない。**
- merge の衝突: 3-4C は `progression.ts` から `recipeUnlocked` を消す。3-4F と 3-4C はどちらも `progression.ts` と `gameReducer.ts:nextMissionOrderState` のあたりを触る。後から merge する方が小さな rebase を引き受ける（意味の上では独立している）。

---

## 9. #206（3-4B）との接続点

- #206 の方針: 未知の recipe、ingredient、inventory、ledger は raw の save に**保持する**が、`loadSave()` の結果（そして `GameState`）には**入れない**。
- 3-4F の predicate は `GameState` の `dex`、`ownedIngredientIds`、`inventory` と、build が知っている `RECIPES` と `INGREDIENTS` だけを読む。したがって:
  - 未来の recipe の Dex エントリは `GameState.dex` に現れない。pool の候補にも、「発見済み」の数にもならない。
  - 未来の ingredient の在庫も `GameState.inventory` に現れない。今ある recipe の makeability に影響しない。
  - 今ある recipe の `requiredIngredients` が未知の ingredient id を参照することは、この build ではありえない（データは build に含まれている）。念のため `getIngredient(id)` が undefined のときは **作れない（fail-closed）** として扱う。`consumePizzaInventory` は未知の id を「消費しない」扱いにしているが、makeability では安全側に倒すのが正しい。
- **未知の id を runtime の GameState に入れない、という方針はそのまま維持できる。** 3-4F は新しい save key を足さない（pool は毎回導出するので、永続化しない）。#211 の F-3/F-7（新しい key や書き込み経路の登録漏れ）には当たらない。
- テスト（T-F9）: #206 の fixture（未来の recipe、ingredient、stock を含む save）で load した後、`makeableRecipeIds` が未来のデータのない save と同じになること。

---

## 10. テストマトリクス（3-4F を実装するとき）

### Unit（Vitest）
| ID | 対象 | 内容 |
|---|---|---|
| U-1 | `isRecipeMakeable` | 未発見なら false。OWNED でない材料があれば false。在庫 0 なら false。在庫 < minCount（片数）なら false。在庫 ≥ minCount なら true。無限の材料だけなら常に true |
| U-2 | 同上 | spread（sauce）は 1 unit が必要。scatter は minCount が必要 |
| U-3 | 同上 | 未知の ingredient id → false（fail-closed） |
| U-4 | `requiredStockUnits` / `remainingStockUnits` | 片数の単位の契約を固定する（3-4C で差し替えるときの回帰防止） |
| U-5 | `pickMissionOrder` + makeable | B/C/D/F/G/H のシミュレーションをテストにしたもの。作れない注文が 0 回。F: 次の注文が 100% 作れる recipe |
| U-6 | one-recipe | makeable の pool が 1 件なら同じ recipe を繰り返す（#202 のテストを維持し、拡張する） |
| U-7 | `nextMissionOrderState` | makeable の pool が空なら fail-closed（同じ参照か RESULT を維持）。未発見の fallback が起きないこと |
| U-8 | `MISSION_NEXT_ORDER` | 在庫を最後の 1 回ぶん使い切った後は、その recipe を注文しない（G） |
| U-9 | `missionRunReducer` の `END_EARLY` | PLAYING のときだけ RESULT に移る。2 回目は no-op。metrics と serves を保持する |
| U-10 | `canStartLunchRush` | 0 件なら false。1 件以上なら true |
| U-11 | reload | 永続化した在庫から `createInitialGameState` を作り直しても、makeable の集合が同じになること（H） |
| U-12 | #206 | 未来のデータを含む save と含まない save で、`makeableRecipeIds` が同じになること |
| U-13 | 回帰 | 消費経路（`consumePizzaInventory` と CONFIRM_BAKE の guard）が変わっていないこと。既存のテストがそのまま通ること |

### Component（Vitest + RTL, `App.test.tsx` / `HomeScreen.test.tsx`）
| ID | 内容 |
|---|---|
| C-1 | HOME: makeable が 0 件なら「ランチラッシュ」を disabled にし、在庫切れの案内とショップの CTA を出す。未発見のロック（`lunchRushLocked`）とは表示を分ける |
| C-2 | App: makeable が 0 件の state で `handleStartLunchRush` や `startMission` を呼んでも、`mission.mode` が PLAYING にならない（E2） |
| C-3 | App: serve の後に pool が 0 件になったら、`BEGIN_PREPARE` を出さずに Mission の RESULT に移る。早めに終わった理由の文言を出す（E3） |
| C-4 | RESULT の「もう一度」: 0 件なら disabled にし、案内を出す |
| C-5 | 2 件発見・片方の在庫 0: Mission の最初の注文が作れる方になること（Math.random を固定して確認） |

### E2E（Chromium, 390×844 と 360×800）
| ID | 内容 |
|---|---|
| E-1 | Human Replay 1（2 件のうち 1 件が在庫 0 → 作れる方だけ注文される）。localStorage の seed を使う |
| E-2 | Human Replay 3（0 件 → 開始できない → Shop への導線） |
| E-3 | Human Replay 4（最後の 1 回を消費 → 次の注文で評価し直す） |
| E-4 | Human Replay 5（reload → 同じ在庫の状態から正常に戻る） |
| E-5 | 既存の `lunch-rush-result-ranking-phase4.spec.ts` がそのまま通る（回帰） |

### WebKit（#210 の Full WebKit、2 viewport × 2 shard + `WebKit Gate`）
- 3-4F は `src/**` と `e2e/**` を変えるので、classify で Full が必要と判定されるはず。**4 つの shard すべてが green で、`WebKit Gate` も green であること**を merge の条件にする。merge の後、main での Full WebKit Gate も green であること。
- 新しい E-1〜E-4 は 4 つの shard のどこかに自動で割り振られる。shard evidence（`webkit-shard-evidence.mjs`）で、listed = ran が確認できればよい。
- WebKit を個別に見る観点: localStorage の seed と reload（E-4）、disabled ボタンの見え方（E-2）。

---

## 11. Human Replay（3-4F を実装したときに撮るもの）

基本は 390×844。1 と 3 は 360×800 でも撮る（ボタンと案内文の折り返しを確認するため）。seed は localStorage の save を直接書く（E2E の seed と同じ形式）。

| # | シナリオ | seed | 手順 | 期待する結果 |
|---|---|---|---|---|
| HR-1 | 2 件発見・片方の在庫 0 → 作れる方だけ注文される | dex={margherita, funghi}、mushroom は OWNED、inventory.mushroom=0 | HOME → ランチラッシュ → 開始 → 3 枚 serve | 注文はすべて Margherita（連続してよい）。Funghi は 1 回も出ない |
| HR-2 | 作れる recipe が 1 件だけ → 同じ recipe が続いても soft-lock しない | HR-1 と同じ | 5 枚連続で serve | Margherita が 5 回続く。すべて PASS できる |
| HR-3 | 作れる recipe が 0 件 → 安全に止まり、次の行動が分かる | 3-4F のテスト用の合成 seed（例: dex={funghi}、mushroom=0。今の main では EP1 のため pool が空になる状態） | HOME を見る → ランチラッシュを押す | ボタンが disabled で、在庫切れの案内が出る。ショップへの CTA で Shop が開く。Mission は始まらない |
| HR-4 | Lunch Rush 中に最後の 1 回を使い切る → 次の注文で評価し直す | dex={margherita, funghi}、mushroom=3（funghi 1 枚ぶん） | Funghi の注文が出るまで進める（Math.random を固定するか、何度か引く）→ Funghi を作る → serve | それ以降、Funghi は注文されない |
| HR-5 | reload → 同じ在庫の状態から正常に戻る | HR-4 の後の状態 | HOME で reload → ランチラッシュ | 在庫 0 のまま。Funghi は注文されず、Margherita だけになる |

UI/UX の変更（HOME の在庫切れ表示、Mission RESULT の文言）を含むので、`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` に従い、動画（390×844。ユーザーに直接渡し、repo にはコミットしない）と、before/after のスクリーンショット（`docs/reports/screenshots/<task-name>/`）が 3-4F の DoD になる。**この監査は docs のみなので、動画もスクリーンショットも対象外。**

---

## 12. 3-4F の最小仕様（実装してよいもの）

1. `inventory.ts`: `requiredStockUnits` と `remainingStockUnits`（片数の単位。3-4C で差し替えるための seam）。
2. `progression.ts`: `isRecipeMakeable` と `makeableRecipeIds`（pure）。
3. `gameReducer.ts:nextMissionOrderState`: `availableRecipeIds` の代わりに `makeableRecipeIds` を渡す（`pickMissionOrder` のシグネチャは変えない）。
4. `lunchRush.ts`: `canStartLunchRush` と `END_EARLY` action。
5. `App.tsx`: `handleStartLunchRush` と `startMission` の guard。`handleMissionServeNext` は、次の注文を出せないときに `END_EARLY` を出し、`BEGIN_PREPARE` は出さない。
6. `HomeScreen.tsx`: 在庫切れのロック表示とショップの CTA。Mission RESULT に早めに終わった理由の 1 行。

**やらないこと:** Option C（skip / 差し替え）、消費経路の変更、在庫の単位の移行（3-4C）、OD-03、新しい save key、Free play の注文（`nextOrderState`）への makeability の適用（Pizza Select と FREE は別の話。必要なら別の issue にする）。

---

## 13. Go / No-Go

**Go（条件付き）。**

- Go の理由: soft-lock は production で再現しており、修正は読み取り専用の predicate を 1 つ足すことと、App の guard 2 つで済む。消費の transaction にも save にも触れず、OD-03 とも独立している。
- 条件:
  1. 在庫の単位を seam（`requiredStockUnits` / `remainingStockUnits`）に閉じ込め、#205 を直接 import しないこと。3-4C より先に merge してもよいし、後でもよい。
  2. E3（pool が空のときに RESULT から PREPARE に戻ってしまう）の修正を、**同じ PR** に入れること。在庫を考慮した pool を入れると E3 が到達可能になるため、分けてはいけない。
  3. Full WebKit（4 shard）と `WebKit Gate` が green であること。HR-1〜HR-5 の動画があること。
- No-Go になる条件: 3-4C が先に merge されて、在庫の単位が use に変わっていた場合、seam の中身を use の単位に合わせてから着手する（ブロックではなく、前提の更新）。
