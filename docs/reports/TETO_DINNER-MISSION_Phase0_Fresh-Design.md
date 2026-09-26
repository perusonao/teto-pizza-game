# Dinner Mission — Phase 0 Fresh Design（設計・監査のみ）

- **Audited main:** `42feec70f4e2b659c590b1c236116c0bf579200a`（Merge PR #235: Lunch Rush material-shortage skip, #212）
- **Branch:** `claude/dinner-mission-phase-0-design-ryqsnc`（docs-only）
- **Scope:** 設計と監査だけを行った。production code、save schema、PR #235 / Issue #212 / Issue #234 は変更していない。PR の作成と merge もしていない。
- **Machine-readable data:** `docs/reports/data/TETO_DINNER-MISSION_PHASE0_mission-candidates.json`
- **STOP 判定:** **A. READY FOR OWNER DECISIONS**（§16）

GitHub の状態は次のとおり確認した（2026-09-26）。

- `origin/main` = `42feec7`。このブランチの HEAD と同じ
- #212 は closed（completed、PR #235 で解決）。#234 は open
- "Dinner Mission" に該当する既存の Issue / PR は無い

---

## 1. Current runtime facts（`42feec7` の実コードから確認したもの）

| 項目 | 実状態 | 根拠 |
|---|---|---|
| recipe 数 | **25**（shipped 15 + W1 10） | `src/data/recipes.ts` の `RECIPES` |
| starter（無限在庫） | `tomato-sauce` / `mozzarella` / `basil` の 3 つだけ | `STARTER_INGREDIENT_IDS` は `unlockCondition` を持たない食材から導出される |
| 有限在庫の食材 | それ以外の 26 種。すべて `unlockCondition` を持つ | `src/data/ingredients.ts` |
| mozzarella | **starter（無限）**。依頼文の例「mozzarella ×1 を A と B が共有する」は、現在の runtime では起きない。同じ構造は egg / ham / olive-oil / pesto などで起きる | 同上 |
| 素材の unlock | Discovery Ladder `W1_25_DISCOVERY_LADDER`（24 step）。step `s` は「Dex の発見数 ≥ s」で到達する。★ は素材 unlock の条件ではない | `src/data/discoveryLadder.ts`、`src/logic/discoveryLadder.ts` |
| recipe の発見 | Free Cooking の matcher だけで発見される。guided round は **DISCOVERED ∧ cookable** の recipe しか開始できない（LK-8） | `canStartGuidedRound`（`src/state/recipeDiscoveryState.ts`） |
| EP1 の recipe chain（`unlockCondition` / minTotalStars） | shipped 15 recipe にはまだ残っている。ただし `recipeUnlocked` は発見済みなら true を返すので、発見済みを前提とする Dinner には影響しない | `src/state/progression.ts` |
| 素材 pack | 1 pack = `10 × k`。k はその素材の全 recipe 中の最大 minCount。価格帯 T1 60/30、T2 80/40、T3 100/50（初回購入 / refill） | `src/logic/materialShop.ts` |
| 在庫の消費 | `CONFIRM_BAKE` の `consumePizzaInventory` だけが消費する。**scatter は実際に置いた個数**（minCount ではない）、sauce は 1 pizza につき 1 単位、starter は消費しない。FAILED の pizza も消費する | `src/state/inventory.ts`、`gameReducer.ts` |
| 配置時の在庫 gate | `canPlaceIngredient` は在庫を超える配置だけを拒否する。**minCount を超える配置（余分な置きすぎ）は在庫がある限り許される** | `src/state/inventory.ts` |
| Completion Gate の policy | `"order"` = minCount が必要（Lunch Rush）。`"recipe"` = 1 個あればよい（FREE / Free Cooking） | `src/logic/completionGate.ts` |
| CUT | 25 recipe 中 24 が CUT 対象。**`new-haven-apizza` だけ CUT が無い**（BAKE → RESULT） | `CUT_ELIGIBLE_RECIPE_IDS`（`src/data/cookingProfiles.ts`） |
| sauce の系統 | tomato 17 / olive-oil 4（fugazza, pizza-bianca, new-haven, quattro-formaggi）/ pesto 4（genovese, pesto-tonno, pesto-caprese, pesto-patate）。olive-oil と pesto は有限（k=1、pack 10） | recipes / ingredients |
| Lunch Rush の run | `missionRunReducer` は App 内の `useReducer` で、**保存されない**。時計は `Date.now()` を使う壁時計（180 秒）。HOME に戻るときは confirm を出して `EXIT_TO_FREE` する。reward を受け取らないまま終わる | `src/mission/lunchRush.ts`、`App.tsx` |
| Lunch Rush の round flag | `GameState.isMissionRound: boolean`。この 1 つの flag で、completion policy、FREE Pitz の抑止、CT1/CT2 の抑止、REGISTER_TO_DEX の抑止、SOLD OUT をまとめて切り替えている | `gameReducer.ts` |
| Lunch Rush の reward | `calculateMissionReward` = 40 + ⌊平均品質 / 10⌋×5 + min(提供数, 10)×5。最大 140 Pitz/run。1 run につき 1 回（`CLAIM_MISSION_REWARD` の runId guard） | `src/logic/economy.ts` |
| FREE の reward | pizza 1 枚ごとに `baseRewardPitz(100) × 品質倍率(0/0.5/0.8/1.0/1.2)`、下限 20。初発見 +50。CT2 手際ボーナスも加算される。**いずれも FREE だけ**（`isMissionRound` のときは null） | `src/logic/pitzReward.ts`、`efficiency.ts` |
| Hint Economy | H1–H4 = 5 / 10 / 20 / 40 Pitz | `src/logic/discovery/hintPurchase.ts` |
| progression ★ | `totalStars` = 発見済み Dex の `bestStars` の合計。EP1 の recipe chain と onion の `minTotalStars` が参照する | `src/logic/mastery.ts` |
| #234 | Lunch Rush では FAILED の pizza でも `MISSION_NEXT_ORDER` で Dex（timesMade / BEST）が更新される。**open、未決** | Issue #234 |
| Save | `schemaVersion: 2`。ledger 系の field は bump せずに追加してきた前例がある（EP4 / I4b / HE）。`writeSave` は未知の top-level key を保持する（forward-compat） | `src/state/persistence.ts` の `KNOWN_SAVE_KEYS` / `extractForwardCompatExtras` |
| `missionBest` | `Record<missionId, number>`。単調増加（"never goes down"）で、キーは任意の文字列 | `persistMissionBest` |
| Layout（実測） | Lunch Rush の DOUGH step で header 56 / HUD 33（y=64）/ step tabs 44 / order card 78 / stage が残りを吸収（390×844 で 552px、360×800 で 508px）/ CTA bar 70。どちらの幅でも page scroll は 0 | scratch の Playwright で実測（repo には commit していない） |

---

## 2. #212 の在庫プリミティブの監査と再利用設計

### 2.1 そのまま再利用できるもの

| primitive | 現在の意味 | Dinner での使い方 |
|---|---|---|
| `recipeStockShortage(recipe, {ownedIngredientIds, inventory})` | 1 枚分の不足を、食材ごとの `{ingredientId, need, have}` で返す。need は scatter が `max(1,minCount)`、sauce が 1。starter はスキップ、未所有は have 0、未知 id は need 1 / have 0 | **need の算出規則をそのまま使う**（Dinner も `"order"` policy で完成判定するので、need と完成に必要な最低量が一致する）。ただし 1 recipe 単位の関数なので、集合の判定には足りない |
| `isRecipeCookable` | 上の関数の `length === 0` のラッパー | Dinner では「次に選べるターゲット」の個別表示に使うだけ。**集合判定には使わない** |
| `canStartGuidedRound` | DISCOVERED ∧ cookable | Dinner のターゲットは定義上すべて DISCOVERED なので、そのまま backstop として使える |
| `consumePizzaInventory` / `canPlaceIngredient` | 消費のトランザクション / 配置時の上限 | 消費は変えない。配置時の上限には「予約（reserve）」の引数を追加する案がある（§4.3） |
| `recipeDiscoveryState` / `isDiscovered` | 発見状態の導出 | unlock の導出に使う（§5） |

### 2.2 足りないもの（依頼文の CRITICAL の再確認）

`isRecipeCookable` を recipe ごとに当てはめても、集合として作れるかは分からない。実データの例を挙げる。

- DM-A（margherita / bismarck / breakfast-pizza / funghi）では、`egg` を bismarck が 1、breakfast-pizza が 1 使う。
- egg の在庫が 1 のとき、bismarck と breakfast-pizza はそれぞれ単独では cookable だが、両方は作れない。

### 2.3 提案する pure helper（未実装。置き場所は `src/state/recipeSetFeasibility.ts` を想定）

```ts
/** 1 枚分の有限在庫の need（starter は含めない。未知 id は need 1 で fail closed）。
 *  recipeStockShortage の need 規則を 1 か所にまとめたもの。 */
export function recipeFiniteNeed(recipe: Recipe): Readonly<Record<string, number>>;

/** 集合の need を足し合わせたもの（同じ recipe が 2 回あれば 2 回分）。 */
export function aggregateFiniteNeed(recipes: readonly Recipe[]): Readonly<Record<string, number>>;

export interface SetIngredientShortage {
  ingredientId: string;
  need: number;          // 集合全体の合計
  have: number;          // 今使える量（未所有なら 0）
  recipeIds: string[];   // この素材を必要とする recipe（UI の説明用。Dinner では全員発見済み）
}

/** 集合全体の不足。空なら集合として完走できる。 */
export function recipeSetStockShortage(
  recipes: readonly Recipe[],
  inputs: { ownedIngredientIds: readonly string[]; inventory: InventoryState },
): SetIngredientShortage[];

export function isRecipeSetCookable(recipes, inputs): boolean; // shortage.length === 0

/** 配置時の予約: `current` を作っている最中に、残りのターゲット（current を除く）の分として
 *  とっておく量。canPlaceIngredient に渡す上限 = 在庫 - reserve。 */
export function reservedStockFor(remainingExcludingCurrent: readonly Recipe[]): Readonly<Record<string, number>>;
```

リファクタの方針（DM-1 で行う）:

- `recipeStockShortage` の need 規則を `requirementUnits(ingredient, minCount)` に切り出し、新旧の関数で共有する。
- 等価性を property test で固定する: どの recipe `r` と在庫についても `isRecipeCookable(r) === isRecipeSetCookable([r])`、かつ不足リストの `{ingredientId, need, have}` が一致すること。これで Lunch Rush の挙動は変わらない。

---

## 3. Completion-feasibility algorithm

### 3.1 判定

```
remaining = まだ完成していない target recipe の集合
need(m)   = Σ_{r ∈ remaining} need_r(m)        （m は有限素材。starter は数えない）
have(m)   = m を所有していれば inventory[m]、していなければ 0
feasible  ⇔ すべての m について need(m) ≤ have(m)
```

### 3.2 これで正確である理由（search が要らない理由）

- 各 recipe の必要量は固定されたベクトルで、代替素材（OR 条件）が無い。各ターゲットはちょうど 1 回作る。
- **必要条件:** 消費は足し算でしか増えない。mission 中の Shop を禁止すれば（OD-DM-8）在庫が増える経路も無い。
- **十分条件:** 各 pizza を minCount ちょうどで作れば、消費量の合計は need と等しくなる。
- したがって **作る順番は完走できるかどうかに影響しない**。ナップサック問題にも組合せ探索にもならず、計算量は O(Σ requiredIngredients) で済む。

この結果から設計上の重要な点が出てくる（§14 の R-1）。**現在のデータでは「在庫管理が攻略要素」とは、実際には「無駄遣いしないこと」を意味する。** 順番を選ぶ戦略は完走の可否には効かない。順番で可否が変わるのは次の 3 つの場合だけ。

1. **置きすぎ**: scatter を minCount より多く置くと、その分だけ実際に消費される
2. **FAILED の pizza**: 消費だけして、ターゲットは完了しない（OD-DM-4）
3. **mission 中の在庫補充**（許可する場合）

### 3.3 判定するタイミング

| タイミング | 入力 | 失敗したとき |
|---|---|---|
| Mission Detail / START | 全ターゲットと現在の在庫 | START を無効にし、不足（集合全体の need/have）を表示し、Shop へ案内する（§6 OD-DM-2） |
| ターゲットを選んだとき | `remaining`（予約の計算用） | ―（START で feasible なので、置きすぎを防いでいれば不変条件は保たれる） |
| 配置（PREPARE 中） | `current` の置いた数と `reserve(remaining \ {current})` | その 1 個を置けなくし、「残りのピザのためにとっておこう」と表示する（F2 の予防、§4.3） |
| `CONFIRM_BAKE` の後 | `remaining'` と消費後の在庫 | PASS なら `remaining' = remaining \ {current}` で判定する。予約の guard があれば常に true になる。FAILED で current が残る場合は `remaining` 全体を再判定し、false なら **MISSION FAILED（INFEASIBLE）** |

### 3.4 将来の拡張への備え（101 / 172）

- recipe に代替素材や可変量が入ると、判定は二部マッチング、フロー、ILP の問題になる。
- API は最初から **構造化された結果**（不足リストと、その素材を使う recipe）を返すようにしておき、判定アルゴリズムだけを差し替えられるようにする。
- 172 の Mechanic Matrix に「どちらか一方」の要件があるかどうかは、DM-1 の時点で再確認する（今回の範囲外）。

---

## 4. Recommended Dinner Mission core loop

### 4.1 流れ（推奨）

```
HOME → 🍽️ディナーミッション → Mission Select
     → Mission Detail（ターゲット、制限時間、報酬、在庫チェック）
     → START（feasible なときだけ）
     → Target Board（✓ 済み / ○ 未完成。次に作るものをタップ）
     → guided round（ターゲットの recipe に固定。Completion policy は "order"）
         DOUGH → SAUCE → CHEESE → TOPPING → BAKE → (CUT)
     → 完成パネル（PASS: ✓ を付ける / FAILED: ターゲットは未完成のまま）
     → Target Board に戻る … 全部 ✓ になったら CLEAR
```

### 4.2 設計原則

- **調理順は自由（第一候補を採用する）。** 完走の可否は順番に依存しない（§3.2）ので、自由にしても公平性は崩れない。
- **ターゲットを選んでから作る。** Free Cooking は使えない。そのため、F3（違う pizza）と F5（対象外の pizza）は **構造的に起きない**。
- **Lunch Rush とは run の reducer を分ける。** `dinnerRunReducer`（pure）を新しく作る。`MissionMode` / `missionRunReducer` は Lunch Rush 専用のまま残す。
- **round の種別を明示する。** `isMissionRound: boolean` に Dinner の意味を重ねると、Lunch Rush が壊れる危険が大きい（R-2）。`roundKind: "FREE" | "LUNCH_RUSH" | "DINNER"` を導入するか、`dinnerRound: {missionId} | null` を追加する案を DM-2 で監査する。

### 4.3 F2 の予防: 予約つきの配置 gate（推奨）

`canPlaceIngredient` に `reserve` を渡し、scatter の上限を `inventory[m] - reserve[m]` にする。reserve が 0 なら今と同じ挙動になる。

- 置きすぎで残りのターゲットが作れなくなる状況を、**罰するのではなく予防する**。
- 置けないときは、既存の在庫 gate と同じ UI 経路で理由を表示する。
- sauce は 1 pizza につき 1 単位で、塗り直しても再消費されないので、予約の対象は「新しく塗る」ときだけになる（既存の `canPlaceIngredient` の sauce 分岐と対称）。

---

## 5. Unlock design

| 項目 | 提案 |
|---|---|
| 条件 | `unlock = targetRecipeIds.every(id => isDiscovered(dex, id))`。**導出するだけで保存しない**（Dex が SSOT） |
| 条件の型 | `unlock: { kind: "ALL_TARGETS_DISCOVERED" }` の判別 union。将来 `MIN_DISCOVERED_COUNT` や「前の mission を clear」を追加できる |
| 匿名の進捗 | 発見済みのターゲットは名前と画像を出す。未発見のものは「？？？」のシルエットにする。バッジは「あと N 種類のピザを発見すると解放」 |
| 漏らしてはいけないもの | 未発見 recipe の nameJa / description / id / 画像 / reference。**DOM の属性（data-*、aria-*、key）も含む**（`e2e/support/antiSpoiler.ts` の `expectNoUndiscoveredIdentity` と同じ基準） |
| mission のタイトル | recipe 名を含めない（素材名は公開情報なので使ってよい。例:「たまごのディナー」）。`validateDinnerMissions` で、**どのタイトルにもどの recipe の nameJa も含まれていない**ことを静的に検査する |
| locked の Detail | 開けない。Select のカードだけを出す（ターゲット数と発見済みの名前だけ） |
| N 自体が漏れにならないか | ターゲットの **数** は identity ではない（Discovery 2.0 の基準で許容される）。ただし「N = 1 のとき、未発見の 1 つが何かを素材から推測できるか」は Hint Economy の範囲の話で、Dinner は素材も表示しない |
| 表示の範囲 | OD-DM-12: 全 mission を匿名カードで出す / 1 つでも発見済みのターゲットがある mission だけ出す / 解放されるまで隠す |

---

## 6. Failure semantics（F1–F6）

| # | 事象 | 選択肢 | 推奨 |
|---|---|---|---|
| F1 | 制限時間が 0 になる | a) 即 FAILED（作りかけは破棄）/ b) 作業中の 1 枚だけ猶予 | **a**。Lunch Rush の期限切れ（SERVE 時の deadline 検査）と同じにする。bake 済みで未完成の 1 枚の消費はそのまま残る |
| F2 | 消費によって残りが完走不能になる | a) 即 FAILED / b) 予約 gate で予防し、a は backstop / c) 警告だけ | **b**。置きすぎは起こらないので、F2 が起きるのは F4 の FAILED が消費した場合だけになる |
| F3 | 違う pizza を作る | ― | ターゲットを選んでから guided round に入るので **起きない** |
| F4 | quality FAILED（Completion Gate FAILED） | a) mission 即 FAILED / b) ターゲットは未完成のまま再挑戦できる（消費は残る。再判定で不能なら F2）/ c) 完成扱いにする | **b**。1 回のミスで全体を落とさず、代償として在庫と時間を失う。c は Completion Gate の意味を壊すので不可 |
| F4' | 品質が低い（PASS だが ★ が低い） | a) PASS なら完成 / b) ★ の下限を設ける | **a**（Phase 1）。品質は reward 側で扱う案がある（OD-DM-9） |
| F5 | 対象外の pizza を作る | ― | F3 と同じく **起きない** |
| F6 | reload / navigation / HOME | a) 放棄 = FAILED（reward なし、消費は残る）+ HOME は confirm / b) run を保存して再開（壁時計が進む）/ c) pause | **a**。Lunch Rush と同じで、run の保存は不要。reload で消費を取り消すことはできない（在庫は各 `CONFIRM_BAKE` で保存済み）。FAILED 時に何も支払わないので、reload しても得にはならない |

FAILED 画面には理由（TIME_UP / INFEASIBLE / ABANDONED）、作った ✓、消費した素材の注記を出す。「もう一度」は、再判定で feasible なときだけ有効にし、そうでなければ Shop へ案内する（#212 の Mission RESULT の前例と同じ）。

---

## 7. Time / reward design alternatives

### 7.1 制限時間（まだ数値は決めない）

- 候補は **導出式**: `timeLimit = slack × Σ_r budget(r)`、`budget(r) = 準備の目安(r) + bake + CUT の分(r)`。
- 準備の目安は CT2（`efficiencyThresholdsForRecipe`）の `comfortableMs = 25s + 3s × Σ minCount` を流用できる。ただし CT2 の計測窓は **BAKE を含まない**（CUT の扱いも要確認）ので、bake と CUT の分は HV で実測してから決める。
- New Haven は CUT が無いので budget が小さくなる。導出式なら自然に反映される。
- 候補ごとの参考値（Σ comfortable、秒）は JSON に載せた。例: DM-A 172 秒、DM-D 144 秒。**確定値ではない。**

### 7.2 Reward の代替案

| 案 | 式 | 利点 | 欠点 |
|---|---|---|---|
| RW-1 段階（Gold / Silver / Bronze / Clear / Failed） | `base × rankMultiplier(残り時間の割合)` | 分かりやすい。境界の test が書きやすい | 境界の 1 秒で報酬が跳ねる |
| RW-2 連続関数 | `base + ⌊maxBonus × 残り時間 / 制限時間⌋` | 公平で、なめらか | 表示が数値だけになり、達成感が弱い |
| RW-3 **改善時だけ払う**（推奨） | 初回 clear: `firstClear + rankBonus(rank)`。それ以降は **自己ベストの rank が上がったときだけ差額** を払う。繰り返しの clear は小さい固定額（素材費の補填程度）か 0 | 周回によるインフレが起きない。Lunch Rush（繰り返し稼ぐ場）と役割が分かれる | 周回の動機が弱い。best の記録が必要（§9） |

### 7.3 既存の報酬との重複・インフレの監査

| 既存 | Dinner との関係 | 推奨 |
|---|---|---|
| FREE の pizza ごとの Pitz と CT2 手際ボーナス | Dinner の round にも付けると二重取りになる | **付けない**（Lunch Rush と同じ抑止） |
| Lunch Rush の run reward（最大 140） | Dinner の repeat reward が大きいと、稼ぎ場が Dinner に移る | RW-3 で repeat を抑える |
| 初発見の +50 | Dinner は発見済みしか作らない | 関係なし |
| Hint Economy（5–40） | 1 回きりの報酬なら、hint の価値は崩れない | ― |
| 素材の消費 | 1 mission の refill 相当コストは約 12–51 Pitz（JSON の `refillCostPitz`） | 基準: `clearReward ≥ 素材コスト` の範囲で決める。周回は「素材費 ≈ 報酬」付近に保つ |
| progression ★（`totalStars`） | Dinner の rank を ★ で表すと、Dex の ★ / totalStars と混同する（EP1 chain や onion の gate が ★ を読む） | **★ を使わない**（🥇🥈🥉、または「金 / 銀 / 銅」の皿）。OD-DM-10 |
| Dex BEST / timesMade | Dinner の pizza を Dex に登録するか | #234 の結論に合わせる。推奨は「PASS のときだけ登録」（OD-DM-11） |

---

## 8. Mission data model

```ts
export interface DinnerMissionDefinition {
  /** 固定の id。一度使った id は再利用しない（保存記録のキーになる）。 */
  missionId: string;
  /** targets や timeLimit を変えたら上げる。記録の扱いは OD-DM-15。 */
  revision: number;
  /** 3〜5 件。重複なし。RECIPES に存在すること（validate）。 */
  targetRecipeIds: readonly string[];
  timeLimit:
    | { mode: "FIXED"; seconds: number }
    | { mode: "DERIVED"; slack: number };        // §7.1 の式
  /** 数値を直書きしない。中央の reward table を参照する（tuning を 1 か所にまとめる）。 */
  reward: { tableId: string };
  unlock: { kind: "ALL_TARGETS_DISCOVERED" };    // 判別 union で拡張できる
  display: {
    titleJa: string;                              // recipe 名を含めない（validate）
    order: number;
    band?: "EARLY" | "MID" | "LATE";              // Select での並びとグループ
    themeIngredientIds?: readonly string[];       // 素材名は公開情報
  };
  /** どの content wave 向けに作った定義か（ladder の populationId と同じ考え方）。 */
  populationId: string;
}
```

- recipe catalog と密結合しないように、mission は **recipe id だけ** を参照する。必要量、CUT、sauce は実行時に `RECIPES` と `getCookingProfile` から導出する。
- `validateDinnerMissions(missions, recipes)`（`validateDiscoveryLadder` と同じ形の pure 関数）で次を検査する。
  - 未知の recipe id がないこと
  - ターゲットの重複がないこと、件数が範囲内であること
  - `missionId` が重複していないこと
  - タイトルに recipe 名が含まれていないこと
  - `DERIVED` の slack が 1 より大きいこと
  - **pack 1 つで完走できる**こと（`aggregateFiniteNeed ≤ packQuantity`）。新規プレイヤーが Shop で 1 pack ずつ買えば挑戦できる、という保証になる

---

## 9. Mission set design（25 recipe の実データから）

実データは `recipes.ts`、`W1_25_DISCOVERY_LADDER`、`materialShop.ts`、`CUT_ELIGIBLE_RECIPE_IDS` から vitest 経由で取り出した。「最短 Dex 数」は、その集合を全部発見できる最小の発見数。ladder の step `s` の素材は発見数 `s` で解放されるので、recipe を作れるのは早くても `s + 1` 件目の発見になる。

| ID | ターゲット | 共有する有限素材 | 集合の need | 最短 Dex | CUT | 素材費 | 位置づけ |
|---|---|---|---|---:|---|---:|---|
| **DM-A** | margherita / bismarck / breakfast-pizza / funghi | egg ×2（k=1、pack 10） | egg 2, bacon 3, mushroom 3 | 4 | 全部あり | ≈12 | **最初の mission**。ladder の step 0–3 の key recipe そのもの。starter だけの margherita（F）と、共有 egg（D/E）の test を 1 つで書ける |
| **DM-B** | margherita / funghi / melanzane-pizza / parmigiana-pizza | eggplant ×6 | mushroom 3, eggplant 6, parmigiano 2 | 6 | 全部あり | ≈12 | 早期の 2 本目。scatter の共有 |
| **DM-C** | meat-lovers / bambino / hawaiian / capricciosa | **ham ×6（4 recipe すべて）** | ham 6 ほか 8 素材 | 12 | 全部あり | ≈30 | 中盤。共有素材を管理する見本 |
| **DM-D** | bismarck / breakfast-pizza / pizza-portuguesa | **egg ×3**（k=1、Lunch Rush で最も減りやすい） | egg 3, bacon 3, ham 3, onion 2, black-olive 2 | 13 | 全部あり | ≈22 | 中盤。k=1 の素材が不足する体験 |
| DM-E | genovese / pesto-tonno / pesto-caprese / pesto-patate | **pesto ×4**（sauce、k=1） | pesto 4 ほか 7 素材 | 22 | 全部あり | ≈48 | 終盤。sauce の共有 |
| DM-G | marinara / napoletana / puttanesca-pizza | garlic 5 / anchovy 6 / oregano 3 | 5 素材 | 24 | 全部あり | ≈32 | 終盤。3 素材が重なって共有される |
| DM-F | fugazza / pizza-bianca / new-haven-apizza / quattro-formaggi | **olive-oil ×4**（k=1）、parmigiano 4 | 9 素材 | 25 | **new-haven は無し** | ≈51 | 全発見の記念。**CUT なしの recipe が混ざる唯一の候補**（S/T の test） |

所見:

- **pack の大きさ（10 × k）に比べると、4 枚分の need は小さい。** 満タンの在庫なら、どの候補も余裕で作れる。不足の緊張が生まれるのは、Lunch Rush や FREE で消耗した後だけ（R-1）。
- 候補の中で最も「足りない」が起きやすいのは、k=1 の素材（egg / olive-oil / pesto）を複数の recipe が共有する DM-D / DM-E / DM-F。
- 最短 Dex は目安にすぎない。発見の順番は player ごとに違う（同じ発見数でも、どの recipe を見つけたかは異なる）。unlock は「その集合を発見したか」だけで決まる。

**Phase 1 の推奨:** DM-A と DM-B（早期、共有 1 素材、全部 CUT あり）。DM-C / DM-D は中盤の候補とし、DM-E / DM-F / DM-G は後で追加する。

### 9.1 101 / 172 への拡張

- mission の定義は `populationId` ごとに管理する（ladder と同じ方針）。W2 以降の content wave で追加する。
- `tools/` に候補を生成する script を置き、ladder の帯（T1–T4）、sauce の系統、共有素材の数で候補を出す。そこから **人が選んで pin する**（ladder の key-recipe 規則と同じく、生成規則を test で固定する）。
- recipe が改名・削除されたら、`validateDinnerMissions` の test が build 時に落ちる。
- `materialK` は全 recipe の最大 minCount から導出されるので、**catalog が増えると pack の大きさが変わる**。「pack 1 つで完走できる」の検査は、wave ごとに再計算する必要がある。
- CUT なし、calzone、fold などの新しい mechanic の recipe は、cooking profile が recipe ごとに決まるので、Dinner 側で特別扱いする必要はない。ただし制限時間の budget には反映させる。

---

## 10. Persistence proposal（今回は変更しない）

| 項目 | 保存するか | 方式 |
|---|---|---|
| mission の unlock | **保存しない**（Dex から導出） | ― |
| best clear time / best rank / clear 回数 | 保存する | 新しい top-level field `dinnerMissionRecords: Record<missionId, { clears: number; bestClearMs: number \| null; bestRank: "GOLD" \| "SILVER" \| "BRONZE" \| "CLEAR" \| null; firstClearClaimed: boolean; revision: number }>` |
| reward の受取 | 保存する（初回 clear と rank 改善の差額について exactly-once） | 上の record の `firstClearClaimed` と `bestRank`。同じ run の二重付与は runId guard で防ぐ（`CLAIM_MISSION_REWARD` と同じ形） |
| 中断した run | **保存しない**（F6-a） | ― |

互換性の確認（`schemaVersion 2`）:

- EP4 / I4b / HE の ledger と同じく、**bump せずに追加できる**。値が無い・壊れている場合は `{}` として読む。record 単位で sanitize する（`sanitizeMissionBest` と同じ流儀）。
- この build が知らない mission id は、forward-compat の id パターンに合えば保持する。
- 古い build は未知の top-level key を `extractForwardCompatExtras` で保持するので、新しい build が書いた記録は消えない（DM-4 で e2e を追加して確認する。`save-forward-compat-3-4b.spec.ts` と同じ方式）。
- 代替案として、`missionBest["dinner:<id>"]` に残り時間の ms を単調増加で入れる方法もある。これなら field を追加しなくて済むが、clear 回数と受取 flag を持てないので **推奨しない**。
- Pitz の付与と record の更新は **1 回の `writeSave`** で行う。途中で失敗したときに、初回報酬が二重に付くのを防ぐため。

---

## 11. UI proposal（390×844 / 360×800 が第一級の対象）

| 画面 | 提案 | 監査結果 |
|---|---|---|
| HOME | menu grid（今は図鑑 / ショップ / 材料 / ランキングの 2×2）に「🍽️ ディナーミッション」を足す。もしくはランチラッシュの隣の secondary CTA にする | 360×800 の HOME では menu が y≈600 で終わり、下に余白がある。1 行足しても scroll は出ない見込み。LC-4 の更新が必要 |
| Mission Select | カード一覧。状態は LOCKED（あと N 種類）/ READY / 材料不足 / CLEAR 済み（最高 rank と時間）。4 件までは 1 画面に収める。それを超えたら Pizza Select の pager（UX-4）を再利用する | ― |
| Mission Detail | ターゲットの 2×2 サムネイル（最大 4）、制限時間、報酬、**在庫チェック表**（素材ごとの集合 need/have に ✓ または ⚠）、START、材料不足のときは「ショップへ」 | 在庫チェック表は `MissionShortagePanel` の chip（glyph + 名前 + have/need）を再利用し、need を集合の値にする |
| Target Board | ✓/○ のリスト（サムネイル + 名前）。○ をタップすると作り始める。予約込みで今作れないもの（通常は起きない）は disabled にする | 調理画面とは別の画面（Lunch Rush の ORDER 画面に相当）にする |
| In-mission HUD | `MissionHud` を一般化する: 左がタイマー、右が「1/4」の進捗（Lunch Rush は 🍕 の提供数のまま） | HUD は **33px の 1 行** で、右側の枠を差し替えるだけなので、高さは増えない |
| Cooking | 既存の guided round をそのまま使う。order card にターゲット名が出る | 実測では、stage が残りの高さをすべて吸収している。ターゲット一覧を常時表示するチップ列（+28px 程度）を足すと、stage が縮む（360×800 で 508→約 480）。**推奨しない**。一覧は Target Board に置き、調理中は HUD の「1/4」だけにすれば、timer と進捗と調理 UI が 1 画面に収まる |
| 完成パネル | `MissionServePanel` の skeleton（L-A: CTA は常に最下部で in-flow）を再利用し、「ターゲット一覧へ」にする | ― |
| CLEAR | 時間、rank、reward の内訳、NEW BEST | `MissionResultOverlay` は Lunch Rush 固有（ranking と submit がある）なので、skeleton だけ再利用して別の component にする |
| FAILED | 理由、作った ✓、消費した素材の注記、再挑戦（feasible のときだけ）、Shop | ― |

Lunch Rush の HUD を再利用できるかどうか: **可能**。props を `{remainingSeconds, rightLabel}` に一般化するか、Dinner 用の wrapper を作る。`MissionIntroOverlay` / `MissionResultOverlay` は Lunch Rush の文言と ranking に依存しているので、再利用するのは skeleton と CSS token だけにする。

---

## 12. Test matrix（DM-1 以降で実装する）

| ID | 内容 | 層 | 主な assertion |
|---|---|---|---|
| A | mission が locked | pure、UI、E2E | unlock=false。Detail を開けない。**anti-spoiler sweep**（未発見 recipe の名前、id、説明が DOM と属性に無い） |
| B | 最後のターゲットの発見 → unlock | reducer、App | REGISTER_TO_DEX の後に導出値が true になる。save に unlock の field が増えていない |
| C | 在庫が十分 | pure | `recipeSetStockShortage = []`、START が有効 |
| D | 共有の有限素材がちょうど足りる | pure | DM-A で egg=2 → feasible |
| E | 共有の有限素材が 1 足りない | pure、UI | egg=1 → `{egg, need 2, have 1, recipeIds:[bismarck, breakfast]}`。**単独ではどちらも cookable**（`isRecipeCookable` は true）。START が無効になる |
| F | starter だけ | pure | margherita だけの集合は在庫 `{}` で feasible。starter は need に現れない |
| G | ターゲットを 1 つ完成させる | run reducer、App | ✓ が付き、remaining が 1 減る |
| H | 違う順番で作る | run reducer（property） | どの順列でも、minCount ちょうどなら CLEAR する（順番に依存しないことの証明） |
| I | 在庫の消費 | reducer | 消費は `consumePizzaInventory` と一致する（置いた数） |
| J | 完成後も残りの集合が feasible | pure、reducer | 予約 gate があれば常に true |
| K | 完成によって残りが不能になる | reducer | 予約 gate を無効にした条件、または FAILED の消費で INFEASIBLE → MISSION FAILED |
| K' | 予約 gate | pure、reducer | reserve を超える配置が拒否され、reserve=0 なら既存の `canPlaceIngredient` と同一の結果になる |
| L | タイマー切れ | run reducer、App（固定 `Date.now`） | FAILED(TIME_UP)。期限後の完成は数えない |
| M | 時間内に clear | run reducer | CLEAR。clearMs が記録される |
| N | reward の境界 | pure | rank の境界の前後 ±1ms。RW-3 の改善差額、二重付与が起きないこと |
| O | quality FAILED | reducer、App | ターゲットは未完成のまま、消費は残る。再判定を行う |
| P | 違う pizza | reducer | ターゲット以外の `SELECT` は拒否される（構造的に起きないことの backstop） |
| Q | reload | App、E2E | run は消え、reward は無く、消費は残る。records は変わらない |
| R | HOME / navigation | App、E2E | confirm → 放棄。reward は無い |
| S | CUT のある recipe | E2E | CUT の後に完成パネル |
| T | CUT の無い recipe | E2E | New Haven は BAKE の後に直接完成パネル（DM-F） |
| U | 390×844 | E2E、Layout Contract | Select / Detail / Board / HUD+PREPARE / CLEAR / FAILED で scroll 0、CTA は in-flow |
| V | 360×800 | 同上 | 同上。safe-area の profile（E360i）も含む |
| W | WebKit | CI（`E2E WebKit` → `WebKit Gate`） | 全 spec が両方の viewport で通る |
| X | Lunch Rush の回帰 | 既存の suite | `isRecipeCookable ≡ isRecipeSetCookable([r])`。#212 の test がすべて変わらず通る |
| Y | Save の互換 | persistence | field が無い / 壊れている → `{}`。未知の mission id を保持する。古い build が書いても消えない |

---

## 13. Risks

| # | リスク | 対策 |
|---|---|---|
| R-1 | **在庫の緊張が弱い。** pack が 10 × k なので、4 枚分の need は満タンの在庫にはほぼ影響しない。完走の可否は順番に依存しない（§3.2）。「在庫管理が攻略要素」は、実際には「無駄遣いしない」と「事前に補充する」に限られる | Owner が次のどちらかを選ぶ: (a) それを受け入れ、Dinner の軸は時間と段取りに置く / (b) 将来、mission 専用の「持ち込み枠」（例: 各素材を X 個まで持ち込み）を追加して緊張を作る。(b) は Phase 1 の範囲外 |
| R-2 | `isMissionRound` という 1 つの flag に意味が重なり、Lunch Rush の回帰を起こす | round の種別を明示する（§4.2）。Lunch Rush の suite を回帰の gate にする |
| R-3 | #234 が未決で、Dinner の Dex の意味が決まらない | OD-DM-11 を #234 と一緒に決める |
| R-4 | 発見情報の漏れ（タイトル、属性、サムネイル、ターゲット数） | validate、anti-spoiler の E2E、locked の Detail は開かせない |
| R-5 | reload すると run が消え、消費だけが残る（プレイヤーには損失に見える） | START 前の注意書き、HOME の confirm、FAILED 画面での説明 |
| R-6 | 制限時間と報酬の数値に根拠が無い | 導出式と HV での実測（DM-5）。今回は数値を決めない |
| R-7 | catalog の拡張で `materialK` と pack が変わる | wave ごとに「pack 1 つで完走できる」を再検査する |
| R-8 | HOME の Layout Contract（LC-4）が変わる | DM-3 で LC を追加・更新する |
| R-9 | CUT の有無で時間が変わる（New Haven） | budget を recipe ごとに導出する |
| R-10 | ranking（Firebase）と混同される | Dinner は server に送らない（OD-DM-18） |
| R-11 | Completion policy の不一致。Dinner が `"recipe"`（1 個でよい）を使うと、feasibility の need（minCount）が過剰な予約になる | Dinner は `"order"` にする（OD-DM-5） |

---

## 14. Owner Decisions

| OD | 決めること | 推奨 |
|---|---|---|
| OD-DM-1 | 調理順 | **自由** |
| OD-DM-2 | START の gate | **不能なら START を無効にし、不足を表示して Shop へ案内する**。途中で FAILED させる案は、開始時点で分かっている失敗を後回しにするだけで、学びが無い |
| OD-DM-3 | F2 | **予約 gate で予防し、FAILED は backstop** |
| OD-DM-4 | F4（Completion FAILED） | **ターゲットは未完成のまま再挑戦できる。消費は残る** |
| OD-DM-5 | 完成の基準 | **Completion PASS（`"order"` policy）。★ の下限は設けない** |
| OD-DM-6 | F3 / F5 | **ターゲットを選んでから作るので、構造的に起きない** |
| OD-DM-7 | F6（reload / HOME） | **放棄 = FAILED。reward は無し、消費は残る。HOME は confirm** |
| OD-DM-8 | mission 中の Shop | **禁止**（在庫は減るだけにする） |
| OD-DM-9 | reward の方式 | **RW-3（初回 + rank 改善の差額、repeat は小額か 0）** |
| OD-DM-10 | 評価の記号 | **★ とは別にする（🥇🥈🥉 / 金・銀・銅）** |
| OD-DM-11 | Dinner の pizza を Dex に登録するか | **PASS のときだけ登録する**（#234 の結論に合わせる） |
| OD-DM-12 | locked の見せ方 | **全 mission を匿名カードで出し、「あと N 種類」を表示する** |
| OD-DM-13 | Phase 1 の mission | **DM-A、DM-B**（中盤の DM-C / DM-D は次の段階） |
| OD-DM-14 | 制限時間 | **導出式 + slack。数値は HV で実測してから決める** |
| OD-DM-15 | 記録の保存 | **`dinnerMissionRecords` を v2 に bump なしで追加する。revision が変わったら best をリセットするかどうか** |
| OD-DM-16 | 在庫の緊張（R-1） | **(a) 受け入れる**。(b) の持ち込み枠は将来の検討事項 |
| OD-DM-17 | HOME の入口 | menu grid のカード or secondary CTA |
| OD-DM-18 | FREE の Pitz / CT2 / ranking | **どれも付けない。server にも送らない** |

---

## 15. Recommended implementation phases

| Phase | 内容 | 変更する層 | Done の条件 |
|---|---|---|---|
| **DM-1 Pure core** | `recipeSetFeasibility.ts`（`recipeStockShortage` の need 規則を共有するようにリファクタ）、`DinnerMissionDefinition` と `validateDinnerMissions`、unlock の導出、`dinnerRunReducer`、reward の計算（数値は placeholder） | pure だけ。UI も save も変えない | unit test（A–N の pure 部分、X の等価性、H の property） |
| **DM-2 Reducer integration** | round の種別、ターゲットを選ぶ action、予約つき配置 gate、`"order"` policy、bake 後の再判定、FREE Pitz と CT2 の抑止 | `gameReducer`、App の配線 | reducer / App の test（G–R）、Lunch Rush の回帰が全部通る |
| **DM-3 UI** | HOME の入口、Select、Detail（在庫チェック）、Target Board、HUD の一般化、完成パネル、CLEAR / FAILED | component、CSS | E2E（S/T/U/V）、Layout Contract の追加、WebKit Gate、**HV 動画（390×844）と before/after のスクリーンショット**（Human Verification Policy） |
| **DM-4 Persistence & reward** | `dinnerMissionRecords`、exactly-once の受取、NEW BEST | persistence | Y の test、forward-compat の e2e |
| **DM-5 Tuning / Human Feel** | 制限時間の slack、reward の数値、中盤の mission（DM-C / DM-D） | data だけ | 実測の表と Owner の承認 |

DM-1 と DM-2 は UI 変更を含まない（HV の対象外）。DM-3 以降は HV Policy の対象になる。

---

## 16. STOP 判定

**A. READY FOR OWNER DECISIONS**

- 実データ（`42feec7`）による監査は完了した。「推測で recipe set を作らない」という条件も満たしている（§9 と JSON）。
- 実装に進むには OD-DM-1〜18 の決定が必要。特に **OD-DM-3 / 4 / 9 / 11 / 16** は、DM-1 の API の形に影響する。
- Dinner Mission の production 実装には進んでいない。

---

## 17. Owner Decisions（2026-09-26 Owner Review — AUTHORITY）

Owner Review で §14 の OD-DM-1〜18 を次のように決定した。**この節は §1〜§16 の推奨より優先する authority である。** 推奨と異なる決定には「推奨から変更」と記す。

### 17.1 中心体験

「制限時間内に指定された pizza を全種類完成させる」＋「有限 inventory を自分で管理する」。Lunch Rush とは明確に分離する。

| | Lunch Rush | Dinner Mission |
|---|---|---|
| 注文 | 次々と来る注文を処理する | target set は固定 |
| 不足 | skip する | **FAILED** |
| 評価 | score / ranking | 全種類完成で CLEAR。clear time で mission reward |
| 順番 | ― | 自由 |

### 17.2 決定一覧

| OD | 決定 |
|---|---|
| OD-DM-1 | 調理順は **自由** |
| OD-DM-2 | mission 開始前に、target set 全体を最低必要量で完走できる場合だけ START できる |
| **OD-DM-3** | **推奨から変更。** 予防型（予約 gate）は **採用しない**。置きすぎを自動的に禁止してプレイヤーを救済しない。「残りの target set を現在庫で完走できなくなった時点で即 FAILED」とする。例: 残り A と B が egg を 1 個ずつ必要で在庫が 2 のとき、A に egg を 2 個使うと、A 完成後に egg = 0 になり、B を作れないのでその時点で MISSION FAILED。starter の無限在庫は既存の authority どおり不足判定から除く |
| OD-DM-4 | 品質 FAILED の pizza は target 完成として扱わない。通常の在庫消費は残る。再挑戦できる。消費後に残りの target を完走できなければ即 FAILED、できれば target 選択に戻る。**#234 の FAILED → Dex mutation を Dinner にコピーしない** |
| OD-DM-5 | 完成は Completion PASS（`"order"` policy）とする |
| OD-DM-6 | プレイヤーは target を選んでから作る。target 外の pizza を自由に作るモードにはしない |
| OD-DM-7 | 中断した run は保存しない。reload = abandon、reward なし。HOME = 確認 → abandon、reward なし |
| OD-DM-8 | mission 中の Shop 補充は **不可** |
| **OD-DM-9** | Phase 1 は **段階制**（CLEAR ＋ 完成時間 tier: GOLD / SILVER / BRONZE）。tier の境界秒数、Pitz 額、初回 bonus、repeat reward の値は **未決定**（DM-5 で実測してから決める）。DM-1 では reward 計算の interface と data shape だけを作る |
| OD-DM-10 | 評価は progression ★ とは別の記号・概念にする。Dinner の評価を progression ★ に加算しない |
| **OD-DM-11** | Dinner で完成した pizza を timesMade / bestScore に記録するかは **保留**（#234 との整理が必要）。DM-1 では Dinner core が Dex mutation に依存しない構造にする。**Dinner の FAILED path では Dex mutation を絶対に行わない** |
| OD-DM-12 | unlock = targetRecipeIds がすべて DISCOVERED。Dex から導出し、保存しない。未発見 recipe の情報を漏らさない |
| OD-DM-13 | Phase 1 の対象は **DM-A**（margherita / bismarck / breakfast-pizza / funghi）と **DM-B**（margherita / funghi / melanzane-pizza / parmigiana-pizza）。本 report で実データから算出した定義を使い、素材の必要量は再定義しない |
| OD-DM-14 | 制限時間、tier 境界、報酬額は DM-5 で実プレイ時間を計測してから決める |
| OD-DM-15 | 保存（`dinnerMissionRecords`）は DM-4 で扱う。DM-1 では save schema を変更しない |
| **OD-DM-16** | R-1（在庫の緊張の弱さ）は **Phase 1 では受け入れる**。Shop の pack size、ingredient の price、refill の price、starter の無限ルール、global な在庫バランスは変更しない。Dinner 専用の仮想 inventory も作らない。必要なら DM-5 の後に別途調整する |
| OD-DM-17 | HUD はタイマー ＋ 完成数/総数（例: 1/4）。target 一覧は調理中は常時表示せず、target selection 画面に表示する。Lunch Rush の HUD を Dinner flag で流用せず、round / mode の authority を明示的に設計する。`isMissionRound` に Dinner の意味を足さない。390×844 / 360×800 が第一級の対象 |
| OD-DM-18 | Dinner の Pitz 払い出しと records は DM-4 以降で扱う（DM-1 では払い出さない） |

### 17.3 §3 / §4 / §6 / §12 への影響

- §3.3 の「配置（PREPARE 中）」の行と §4.3 の予約つき配置 gate は **不採用**。§2.3 の `reservedStockFor` は実装しない。
- 完走できるかは「pizza の結果（PASS / FAILED）を確定した時点で、残りの target set を消費後の在庫で判定する」ことで決める。
- F2 は「即 FAILED」になる（§6 の F2-a）。
- §12 の K' は削除する。代わりに「置きすぎによる消費の後に即 FAILED」の test を必須にする。
