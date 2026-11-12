# MID_BAKE 段階B — Fresh Audit（保存・在庫・Research・Hint）とレシピ計画

Issue #795 ／ 作成: 2026-11-12 ／ 基準 `main` `4314ca2` ／ docs-only（読み取り調査のみ）
claim: Issue #795 コメント 6823593886（`:stage-b`）
関連: 判断表 `TETO_MID-BAKE_OWNER-DECISION-TABLE_2026-11-12.md`（Q9・Q12 はこの監査の結果で確定する）

**方法と限界**: コードと既存コメントの読み取りのみ。実行テスト・実機確認はしていない。
「確認した」はソースの記述を読んだ範囲、「未確認」は読んでいない／実行していない範囲。

---

## 1. 保存と在庫（Q9 の材料）

### 1.1 確認した事実

1. **在庫の消費は `CONFIRM_BAKE` ただ 1 か所。** `gameReducer.ts` の `CONFIRM_BAKE` にコメント「CONFIRM_BAKE is the sole inventory-consumption transaction boundary … PREPARE-time placement never touches `inventory`」。`state.phase !== "BAKE"` なら何もしない（二重消費の防止）。
2. **消費量は「ピザに実際に置かれた数」から計算される。** `inventory.ts` の `consumePizzaInventory`（`CONFIRM_BAKE` が呼ぶ）は、`PlacedTopping` の実数を数える（レシピの `minCount` ではない）。
3. **置く時点のゲート `canPlaceIngredient` は、消費ではなく「在庫を超えないか」の確認だけ。** 散らす食材は `pizza.toppings` 中の同 ID の数を毎回数え直す（別カウンタを持たない）。ゲートと消費が食い違わない設計だとコメントに明記。
4. **保存は `CONFIRM_BAKE` の後。** `pendingRound`（Save R8）は `CONFIRM_BAKE` の時点で、post-BAKE ステップ（CUT／FINISH）が残る Guided／Free の回にだけ作られる。`pendingRound` のコメントに「消費した在庫と同じ `setItem` で焼いたピザを書く」とある。Lunch Rush は `unservedConsumption` を提供まで保持、Dinner は journal を持たない。
5. **BAKE 中の途中状態を保存する仕組みは見つからなかった。** `bakeState`／`bakeValue` は transient とコメントされ、`progressionSnapshotOf` は `pendingRound` を取るが BAKE 中のピザは取らない。

### 1.2 結論（案）

- **MID_BAKE の追加を「`stage` を持つ `PlacedTopping` として `state.pizza.toppings` に追加する」設計にすれば、在庫は既存の仕組みでそのまま足りる。** ADD 時に `canPlaceIngredient` を呼べば（置く時点のゲート）、`CONFIRM_BAKE` の消費が実数から計算され、「予約」状態を新設する必要はない。判断表 §2 D6 の「予約」案は不要になる見込み。
- **BAKE 中に離脱・再読み込みすると、その回は保存されず在庫は減らない**（1.1 の 1・5 から読める挙動）。追加済みの食材が消えるのは「回の破棄」であり、在庫の不整合にはならない見込み。ただし**実機・実行テストでは未確認**。段階 D の前に確認テストが必要。
- 保存スキーマ変更は不要の見込み。`pendingRound` は `PlacedTopping[]` を保存するため、**新しい `stage` 値を足す場合、`pendingRound` の読み戻し検証（`PendingRoundPizza.toppings` の検証）が新しい値を受け入れる必要がある**（要確認。受け入れなければ保存済みの回が復元されない）。

### 1.3 リスク・要確認

| 項目 | 内容 |
|---|---|
| `PlacedTopping.stage` | 現在は `"pre" \| "post"`（`pizzaState.ts`）。mid_bake 用に値を足すか、別の印を付けるかは設計判断。HOT ではないが、採点・保存・描画の多くが読む型 |
| `pendingRound` の検証 | 上記。新しい値の読み戻し可否 |
| 追加後の「半焼き」表現 | `pieceBakeClass` は PRE／POST の 2 値で、POST は焼き色を付けない。mid_bake の食材は「途中から焼く」見た目が要る（`bakeProgressForPiece` の拡張が必要） |
| 在庫不足時 | ADD のゲートで拒否する場合、BAKE 中に在庫不足が判明する。PREPARE の別枠選択時点で確認する方が安全（段階 C 設計で扱う） |

## 2. Research と Hint（Q12 の材料）

### 2.1 確認した事実

1. レシピ要件の `applicationPhase` は `"PRE_BAKE" \| "POST_BAKE"`（`trainSpec.ts` の型、`recipes.ts` の要件型）。`POST_BAKE` の要件を持つレシピは、発見カタログで `late` 軸（`[["POST_BAKE", lateIds]]`）と `LATE_ADDITION` 能力を宣言する（`discoveryCatalog.ts` の `discoveryIdentityOf`）。
2. `cookingProfiles.ts` は `POST_BAKE` の要件を見て FINISH ステップを足す。`POST_BAKE_STEPS` は CUT／FINISH のみ。
3. Hint: `finishHint.ts` の `buildFinishHintLine` は、`POST_BAKE` の要件が足りない食材を名指しで案内する（Guided のみ、Free Cooking には出さない）。BAKE 中の Hint 経路は読み取っていない。
4. Research: `researchResultRows.ts` と `discoveryHint.ts` が発見カタログを読む。`late` 軸の扱いの細部は読み切っていない（**未確認**）。

### 2.2 結論（案）

- **mid_bake の食材は、`applicationPhase` に第 3 の値を足すか、`POST_BAKE` と同じ `late` 軸に入れるかを決める必要がある。** 後者は変更が小さいが、「焼成中」と「焼成後」を区別できず、同じ食材が別の時機で作られたピザを同一視する。前者は型・カタログ・採点・保存を横断する変更（HOT の `recipes.ts` を含む）。
- 推奨（案）: **Lab と段階 B〜C の間は型を変えず、レシピ計画を `src/logic/midBake/**` の別データ（`MidBakePlan`）に持つ。** `applicationPhase` の拡張は、Lab の HV が PASS して Owner が機構を採用した後に、段階 D の一部として行う。
- Hint: `finishHint.ts` を参考に、「焼成中に加える」ことだけを示す別 Hint（個数・タイミングは示さない）を足す案。段階 D。
- Research: 発見カタログに mid_bake 軸を足すかは、`late` 軸の読み取り（未確認部分）を調べてから。Research 対象になるのは promoted 済みのレシピのみのはずで、staged のうちは影響しない見込み（未確認）。

**Owner 判断（Q12 確定に必要）**: ① 型を拡張するか既存 `late` 軸を流用するか ② Hint に出す情報量 ③ Research の扱い。

## 3. レシピ計画（`MidBakePlan` 案）

エンジンの `MidBakePlan`（`recipeId`・`totalBakeMs`・`window`・`requirements`）に合わせた計画。**データとしての実装は、型の判断（上記）と Owner 承認の後。** `totalBakeMs` は BAKE の時計（`BAKE_DURATION_S` × 1000 = 3000 ms）から導出し、固定値を二重に持たない。

| レシピ | requirements | requiredState | 状態 | 備考 |
|---|---|---|---|---|
| `natto-pizza` | `natto` × 2 | `ready` | **最初の検証対象** | 原典に「仕上げ数分前」あり（ただし併記の 1 つ）。`okra`×2・`nori`×2・`green-onion`×2・`mozzarella`×3 は必須だがタイミング未確認。okra の扱いは Owner 判断 |
| `eel-pizza` | （なし） | — | **POST_BAKE 近似のまま** | 原典は「仕上げにのせる」。mid_bake の機構は不要 |
| okra／sansho-pepper | 単独の計画なし | — | 同上 | okra は未確認。sansho は POST_BAKE と整合 |
| `pizza-de-lomo-saltado` | `french-fries` × 2 | `fried` | **最後。PREP／FRY 統合後** | 工程タグ（PREP のみか FRY も）未確定。R-1・R-4・重複ゲートの Owner 判断が先 |

計画の検証（段階 B の完了条件案）:
1. 全 `requirements` が staged データの `requiredIngredients` に含まれる（食い違いを検出するテスト）。
2. `requiredState` が付く食材は、FRY を import せずに表現される（既存のアーキテクチャテストの範囲内）。
3. 計画データが catalog・HOT を import しない。

## 4. 段階 B で未完了のこと（次の行動）

1. 上記の「要確認」（`pendingRound` の `stage` 検証、`late` 軸の読み切り）は段階 D の前の確認テストとして別 claim で行う。
2. `MidBakePlan` データの実装は Owner 承認後（claim の範囲は `src/logic/midBake/**`）。
3. Owner 判断: Q9（既存ゲートで足りるとする結論の確認）、Q12（型の方針）。
