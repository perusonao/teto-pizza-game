# D-ING-1 — 食材単独追加（ingredient-first）の設計案と影響範囲（#780、docs-only・設計のみ）

2026-11-08 / 基準 `origin/main` = `348b1e4`。**本書は設計案であり決定ではない。** コード・テスト・golden・既存 docs・HOT ファイルは変更していない。ラダー規則（OD-REC04-1、LAD-1 append-only、key レシピ規則）は**変更しない前提**で、それを壊さずに「レシピ登場を待たず食材を追加する」方法を比較する。

凡例: 【実測】コード・テストの読取り、【推論】実測からの解釈、【未確認】測定していない。

---

## 1. 拘束条件（実コードで確認した事実）【実測】

| # | 規則 | 場所 | 食材単独追加への効き方 |
|---|---|---|---|
| C1 | 各 step は**key レシピを新たに完成**させる（`KEY_RECIPE`）。key が無い step は不正（`has no keyRecipeId`） | `src/logic/discoveryLadder.ts` `validateDiscoveryLadder` / `validateLadderProgression` | 食材だけの step は作れない |
| C2 | ラダーの材料は**どれかのレシピが使う**（`UNUSED_MATERIAL`）。テストが「入手可能な食材 = 本番レシピが使う食材」を固定 | 同上、`src/state/ingredientCollectionCount.test.ts` の "parity: equals every ingredient the production recipes use" | 「ラダーに載せたが誰も使わない食材」は不可 |
| C3 | step *s* は**クレジット済み発見数 ≥ s** で到達。発見数の源はレシピ（`ladderCredit:false` は数えない） | `creditedDiscoveredCount` | 食材の step を増やすと、**レシピを発見しないと届かない閾値**が増える |
| C4 | ラダーの余裕（スラック）は**クレジット済みレシピ数 − step 数 − 直接ゲート済み 2 = 1** で、テストの最小値 `ACCEPTED_MIN_SLACK = 1` ちょうど | `src/logic/ladderReachability.starGate.test.ts`、`catalogLedger.test.ts`（credited 81／ladderSteps 78） | **新しい step を 1 つ足すたびに、クレジットされるレシピを 1 つ足す必要がある**（食材だけの step は 1 つ入れた時点で 0 になりテストが落ちる） |
| C5 | 既存 step は凍結（append-only）。後から既存 step に食材を足す・順序を変えるのは不可 | `validateAppendOnlyExtension`（LAD-1、OD-W2-1） | 過去の step に「後付けで食材を載せる」ことはできない |
| C6 | `unlockCondition` を持つのにラダーに無い食材は**入手不能**（`obtainableIngredientIds` が除外）。ただし同関数のテストは「入手可能 = 全カタログ」も固定 | `src/state/materialEntitlement.ts` `obtainableIngredientIds`、`ingredientCollectionCount.test.ts` | 「カタログにあるが入手不能」の状態は現行テストの不変条件に反する |
| C7 | 価格は step 番号の段（T4 = step 30 以降 120／60 Pitz）で決まる | `src/logic/materialShop.ts` | 新食材はすべて T4 |
| C8 | late の step 番号は「通常 step 数 + k」で**通常バッチごとに +1 ずれる**。互換のため固定の下限（`LATE_ENTITLEMENT_FLOORS`）がある | `src/data/lateCatalog.ts` | step を増やす案は late の番号と互換下限に波及 |

C3＋C4 が決定的: **ラダーはレシピ発見数で進むので、食材だけの step を足しても、対応するレシピが無い間は誰も到達できず、しかも余裕 1 を使い切る。** 「先行追加」は step を増やす方法では原理的に成立しない。

---

## 2. 案の比較

| 案 | 内容 | ラダー規則 | 判定 |
|---|---|---|---|
| **A 現行（宿主レシピと同時）** | 食材は最初に使うレシピの step で出荷 | 維持 | 規則は守れるが、食材ラインがレシピの列車に完全従属（独立性なし） |
| **B 食材専用 step** | 新 step 種別（key レシピなし）で食材だけ解放 | **C1・C2・C4 を破る** | **不可**。C3 により届かない閾値になり、スラックも 0 になる |
| **C ダーク登録** | 食材をカタログに入れるが解放しない（入手不能） | C6 のテスト不変条件と衝突（要テスト改定） | プレイヤー価値ゼロ（見えない）。データ・タクソノミー・G18 の検証を前倒しできるだけで、それは既に staged で実施済み |
| **D 同乗解放（rider）★推奨** | 食材を**これから追加する通常／late step に相乗り**させる。新 step は増やさず、key レシピは宿主のまま。相乗り食材は「宿主レシピを待つ」と登録簿に明記 | C1・C3・C4・C5 を維持。**C2 だけ**を「登録簿の食材に限る期限つき例外」に緩和 | 規則の緩和が最小。ただし「宿主レシピの 1 列車前」までしか先行できない（§3.3） |
| **E 並行棚トラック** | ラダーとは別の解放経路（星・Pitz・日替わり等） | OD-REC04-1（星は解放条件にしない）に**別の Owner 権威**が要る | 影響が最大。独立性は最も高いが、新しい経済設計 |

---

## 3. 推奨設計 — D 同乗解放（rider ingredients）

### 3.1 仕組み

1. **登録簿**（新規データ、HOT でない新ファイル案 `src/data/riderRegistry.ts`）: `{ ingredientId, hostRecipeId, addedInStepKey, owner: "D-ING-1" }[]`。`hostRecipeId` は staged の候補レシピ（まだ出荷されていない）。
2. **step への相乗り**: 新しく追加する step（通常 step または late step）の `ingredientIds` に、key 材料のあと／前の位置規則を決めて rider を並べる。**key レシピは常に宿主**のまま（C1 維持）。**新しい step 番号は増えない**（C3・C4 維持）。
3. **検証の緩和は 1 点だけ**（C2）: `UNUSED_MATERIAL` を「`riderRegistry` に載っている食材は免除」にする。免除は次を**テストで強制**する:
   - rider の `hostRecipeId` が staged に存在し、まだ出荷されていない。
   - 宿主レシピが出荷された時点で registry から**自動的に外れる**（外れていなければテストが落ちる＝掃除忘れの防止）。
   - 1 step あたりの rider 数の上限（案: 4、Owner 判断）。
   - rider は `ingredientIds` の **key 材料より前**に置く（コホートキー＝step の最後の材料、の規則を乱さない）。
4. **プレイヤーから見える効果**: rider はその step に到達した時点で Shop に出る。まだ宿主レシピが無いので、**Free Cooking／Research では使えるが、既存レシピの材料にはならない**（ORIGINAL ピザとして扱われる）。「所持 N/M 種」の M が増える。

### 3.2 影響範囲

| 区分 | 内容 | HOT |
|---|---|---|
| 型 | `MaterialProgressionStep` に任意の `riderIngredientIds`（または `ingredientIds` のまま登録簿で識別）。`appendLadderSteps`／`validateAppendOnlyExtension` は新フィールドを同一比較に含める | `src/data/discoveryLadder.ts`、`src/logic/discoveryLadder.ts` |
| 検証 | `validateLadderProgression` に免除リストの引数。免除テスト（上記 3 点）を新規ファイルで追加 | `src/logic/discoveryLadder.ts` |
| テストの不変条件の改定 | ① `ingredientCollectionCount.test.ts`（入手可能 = 本番レシピが使う食材）を「+ 登録簿の rider」に、② `discoveryLadder.test.ts`（ラダーを本番レシピから導出して固定）が rider を無視して導出できるか確認、③ `catalogLedger.test.ts` の合計 | テスト |
| Hint 5.0／Research／DH4 | rider は未出荷の宿主のために出る食材。タクソノミー（family）と Hint 5.0 の family 分布は食材が**カタログに入った時点**で動く（B13 で spice 4→5 になった前例）。Research のコホート文字は「step の最後の材料」が key なので、rider を key の前に置けば既存ラベルは動かないはずだが**【未確認】—staged の what-if ハーネス（`whatIfSupport.ts`）で実測が必要** | golden（hint5 は insert-only） |
| 経済 | rider も T4（120／60 Pitz）。購入者が先に買っても害は無いが、Pitz の使途が増える。economySimulation の再測定 | `economySimulation` テスト |
| 保存 | 未知 id は読み込みで落ちる（`persistence.ts` の sanitizer）。rider は出荷後は既知なので問題なし。宿主が出荷される前に rider を出す場合、**保存のロールバック（旧版で読む）**は Dex raw 保持（PR #674）で保護済み | 変更なし（`persistence.ts` は触らない） |
| UI | Shop／Inventory の件数表示のみ。新画面なし。HV は「新食材が Shop に並び、Free Cooking で置ける」ことの 1 本 | HV 対象 |
| late | rider を late step に載せる場合、late の互換下限 `LATE_ENTITLEMENT_FLOORS` に rider の固定値が要る（C8） | `lateCatalog.ts` |

### 3.3 限界（正直な評価）

- **先行できる幅は「宿主レシピの 1 列車前まで」。** step を増やせない（C3・C4）ので、rider は「これから追加される step」にしか載らない。70 食材のうち、RB-01（taco・okonomiyaki）より後の列車に属する食材は、**それ以前の列車の step に載せれば**早く出せるが、載せられる数は「列車数 × 1 step あたりの上限」で決まる（17 列車 × 4 = 68 ≒ 70）。理論上は全 70 食材を宿主より早く出せるが、実際は列車の進行と並走する。
- **完全な独立（レシピ 0 のまま食材だけを大量に出す）は案 E（新しい解放権威）でしかできない。** これは OD-REC04-1 の変更にあたるので Owner の判断事項（D-ING-1c）。

### 3.4 実装段階（承認後・各段階が独立 PR）

| 段階 | 内容 | 種別 | HOT |
|---|---|---|---|
| R0 | 設計 Gate（本書の Owner 承認）と rider 上限の決定 | docs | なし |
| R1 | `riderRegistry.ts`（空）＋型＋検証緩和＋免除テスト。**挙動不変**（registry が空なら現行と同一）。dist 比較で本番不変を確認 | コード | `discoveryLadder.ts` ×2 |
| R2 | staged の what-if で Research／Hint 5.0／DH4／経済を rider 付きで実測（golden 追加） | テスト | なし |
| R3 | 最初の rider 利用（RB-01 の step に、RB-02 の食材 1〜4 個を相乗り）。実機 HV 1 回 | コード | HOT（列車 PR に同梱） |

停止条件: R2 の実測で出荷済みの Research 文字・Hint 5.0 既存項目が動く場合／スラック < 1／registry の自動掃除テストが組めない場合。

### 3.5 Owner 判断（推奨つき）

| ID | 論点 | 推奨 |
|---|---|---|
| D-ING-1a | 案 D（同乗解放）で進めるか。進めないなら食材は案 A（宿主と同時） | 進める。R1 は挙動不変で低リスク |
| D-ING-1b | 1 step あたりの rider 上限 | 4 |
| D-ING-1c | 宿主 0 の食材単独解放（案 E）を将来の別トラックとして検討するか | 保留。D と R2 の実測後に判断 |
| D-ING-1d | rider は Free Cooking／Research で使えるが既存レシピの材料にならないことの確認（ORIGINAL ピザ扱い） | 確認（体験としては「新食材で試作できる」） |
