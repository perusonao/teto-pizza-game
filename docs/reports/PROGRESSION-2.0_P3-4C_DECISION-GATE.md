# Progression 2.0 Phase 3-4C — Decision Gate（OD-03 / 在庫の単位 / Shop の数量）

- 初版: 2026-09-23 / Rev.2（runtime の再監査と M4）/ Rev.3（D-1〜D-3 の記録）/ **Rev.4（Shop の数量の決定、仕様決定完了）: 2026-09-23**
- 監査対象 `origin/main`: **`dff233c042d2df6ee1c3a92f2d2419830aa05460`**（PR #210 の merge。Rev.4 の開始時にも変わっていないことを確認）
- Branch: `claude/teto-pizza-p3-4c-decision-foc6x9`（docs-only、PR #214）
- Machine-readable: `docs/reports/data/PROGRESSION-2.0_P3-4C_DECISION-GATE.json`

| PR / Issue | 状態（Rev.4 開始時） | head | 本書での使い方 |
|---|---|---|---|
| #205 Phase 3-4A | OPEN・未マージ | `9035606` | M4 に合わせる修正計画（§4） |
| #206 Phase 3-4B | OPEN・未マージ | `4c1da87` | save の forward-compat |
| #209 OD-03 Decision Brief | OPEN・未マージ | `d719f1d` | Option A の数値 |
| #211 3-4C Integration Preflight | OPEN・未マージ | `27e0916` | 3-4C の仕様の土台（M4 で変わる箇所は §5） |
| #213 3-4F Fresh Audit | OPEN・未マージ | `7ccf5df` | 在庫つき mission pool の判定 |
| **Issue #215** | **OPEN（本タスクで作成）** | — | Completion / Scoring の見直し（D-3） |

> 本書は owner の決定を**記録する**だけで、新しい判断はしない。
> runtime（`src/**`、`e2e/**`、`.github/**`）は変更していない。#205/#206/#209/#211/#213 には push していない。
> merge も rebase もしていない。3-4C には着手していない。CI と WebKit は実行していない。

---

## 0. 結論

**3-4C の Decision Gate: 仕様決定完了（product decision の未決定は 0 件）。**
**実装の Go はまだ出さない。** 次は technical gate（§7.2）を順番に通す: #205 の M4 修正 → #205 を最新 main で gate → #205 merge → #206 を最新 main で gate して merge → #206 を production に deploy。

| Decision | 内容 | 状態 |
|---|---|---|
| **D-1 OD-03** | Option A。authority の固定 ⭐gate。後から上げない。再ロックは構造的に起きない。entitlement は不要 | **FINAL** |
| **D-2 在庫の単位** | M4。材料の個数のまま。migration しない。実際に置いた個数だけ消費。Lunch Rush の「作れる」も個数。M1/M2/M3 は不採用。#205 の「1 pizza = 1 use」は採用しない | **FINAL** |
| **D-3 Completion / Scoring** | 3-4C から分離。3-4C では Completion Gate を変えない。見直しは **Issue #215** | **FINAL（分離）** |
| **D-4 Shop の購入・補充の数量** | 材料ごとの**固定の個数**としてデータに持つ。初期値は `10 × k` 個（k = 3-4C 移行時点の、その材料の最大 `minCount`）。runtime で毎回計算しない。recipe が増えても自動では変えない。変えるときは balance の変更として明示的に行う | **FINAL** |

---

## 1. 確定した Decision

### D-1: OD-03 = Option A（FINAL）

- 今の 15 recipe を特別扱いしない。authority の固定 ⭐gate を維持する
- recipe が増えると獲得できる ⭐ が増え、それで新しい材料が自然に解放される
- gate の値を後から引き上げない
- ⭐ = Σmax(2, BEST) で、BEST は最高記録なので減らない。gate も固定なので、**一度購入可能になった材料がロックに戻ることは構造的に起きない**。persisted entitlement は不要

帰結（#209 の数値）:

| 項目 | 値 |
|---|---|
| 新規プレイヤーが発見できる数 | ★1–2: 10/15 / ★3: 11/15 / ★5: 13/15（上限 65⭐） |
| content が増えるまで新規には発見できない | genovese（cherry-tomato ⭐76）、quattro-formaggi（fontina/gorgonzola ⭐102） |
| ★≤3 の skill lock | marinara、napoletana、pizza-bianca（BEST を上げれば届く） |
| 既存 save との差 | ある（既存 save は EP4 で上記の材料を持っている。補充もできる） |
| 3-4C の gate 関数 | authority の値をそのまま返す。⭐ だけの純関数。追加の永続データなし |
| 3-4C の Pizza Select | 「今は作れない」を正直に出す（#211 §9 の A 列の要件）。「今後のアップデートで追加」「BEST を上げると次の材料が入荷」の本格的な案内は 3-4E |

### D-2: 在庫 = M4（FINAL）

| 項目 | 決定 |
|---|---|
| 正式な単位 | 材料の個数（spread の sauce、olive-oil、pesto は 1 回分 = 1）。今と同じ |
| migration | しない。save の形式、key、`schemaVersion`（2）は変えない |
| 消費 | 実際に置いた個数だけ、`CONFIRM_BAKE` で減らす（今の EP2 のまま。PASS でも FAILED でも同じ） |
| 置ける個数 | 残りの個数まで（今の EP3 Stock Gate のまま） |
| Lunch Rush の「作れる」 | discovered ∧ 全材料 OWNED ∧ 有限の具材ごとに `在庫 ≥ 完成に必要な最低量`。3-4C では Completion Gate を変えないので、最低量 = `minCount` |
| pizza ○枚分 / use への換算 | しない |

不採用:

| 方式 | 内容 | 不採用の理由 |
|---|---|---|
| M1 | 既存の `inventory` key の意味を use に変える | rollback で単位が混ざり、二重変換が起きる（初版のモデルで 2000 通り中 1982 通りが不一致） |
| M2 | use を新しい key に保存し、旧 key に個数を書き続ける | 1 枚 = 1 use のゲーム性を採らなかった。migration、突き合わせ、#206 の 4 か所への登録も必要 |
| M3 | 個数で保存し、1 枚 = 1 use で遊ぶ | 1 枚 = 1 use のゲーム性を採らなかった |

### D-3: Completion / Scoring を分離（FINAL）

- 3-4C では Completion Gate を**変更しない**（理想量 = `minCount`。不足すると FAILED のまま）
- 見直しは **Issue #215「Completion Gate: 理想量より少ない具材でも完成できるようにする — Fresh Audit」**（https://github.com/perusonao/teto-pizza-game/issues/215）
- #215 の実装は 3-4C の merge の後に行う。#215 で最低量が変わったら、3-4F の `requiredStockUnits` の値だけを差し替える

### D-4: Shop の購入・補充の数量 = 材料ごとの固定の個数（FINAL）

| 項目 | 決定 |
|---|---|
| 単位 | 個数 |
| 持ち方 | 材料ごとの**固定データ**（`purchaseQuantity` と `refillQuantity`）。runtime で `10 × max(minCount)` を計算しない |
| 初期値 | authority の `purchaseGrantPortions = 10` と `refillPortions = 10` を、3-4C 移行時点の k（その材料を使う shipped recipe の最大 `minCount`。spread は 1）で個数にした値: **`10 × k` 個** |
| recipe が追加されたとき | 既存の材料の数量は**自動では変えない**（例: pepperoni を 6 個使う recipe が増えても、40 個のまま。60 個にはしない） |
| 数量を変えたいとき | 将来の balance 変更として、データを明示的に変える |
| 価格 | authority のまま（購入 = tier の価格。補充 = ceil(価格 × 0.5)） |
| 在庫と消費 | D-2 のまま（実個数。置いた個数だけ減る） |

初期値の表（3-4C 移行時点の k。`src/data/recipes.ts` を main `dff233c` で照合済み）:

| 材料 | k | 購入（個） | 補充（個） | 参考: 今の EP3 補充量（`restockQuantity` = 3 × k） |
|---|---:|---:|---:|---:|
| pepperoni | 4 | 40 | 40 | 12 |
| onion | 4 | 40 | 40 | 12 |
| mushroom | 3 | 30 | 30 | 9 |
| sausage | 3 | 30 | 30 | 9 |
| bacon | 3 | 30 | 30 | 9 |
| garlic | 3 | 30 | 30 | 9 |
| cherry-tomato | 3 | 30 | 30 | 9 |
| anchovy | 3 | 30 | 30 | 9 |
| tuna | 3 | 30 | 30 | 9 |
| rosemary | 3 | 30 | 30 | 9 |
| oregano | 2 | 20 | 20 | 6 |
| gorgonzola | 2 | 20 | 20 | 6 |
| parmigiano | 2 | 20 | 20 | 6 |
| fontina | 2 | 20 | 20 | 6 |
| black-olive | 2 | 20 | 20 | 6 |
| egg | 1 | 10 | 10 | 3 |
| ham | 1 | 10 | 10 | 3 |
| olive-oil（spread） | 1 | 10 | 10 | 3 |
| pesto（spread） | 1 | 10 | 10 | 3 |

- 無限の starter 3 件（tomato-sauce、mozzarella、basil）には行がない（売り物ではない）
- authority にだけある 83 件（runtime にない材料）にも行を作らない。その材料が runtime に追加されるときに、その時点で数量を決めて行を足す
- 理想量どおりに置けば、1 回の購入で**10 枚以上**焼ける（`minCount ≤ k`）。authority の simulation（#196）は下限として成り立つ。載せすぎる人は早く減る

---

## 2. 現在の runtime の事実（Rev.2 の要約。main `dff233c` が source of truth）

- 15 recipe のすべての scatter 具材で `minCount` = 理想量（Reference Pizza のお手本の個数）。ずれは 0 件
- 同じ具材でも recipe によって必要量が違う（pepperoni 4 / 1、onion 4 / 2、oregano 2 / 1、mushroom 3 / 2、sausage 3 / 2、bacon 3 / 2）
- 置ける数の上限は在庫と生地の空きスペースだけ。焼くボタンは具材の数を確認しない
- Completion Gate: 0 個は `MISSING_REQUIRED_INGREDIENT`、`minCount` 未満は `INSUFFICIENT_REQUIRED_AMOUNT` で FAILED。多すぎる場合は PASS
- Scoring 2.0: 1 個多いごとに約 1.6〜2 点下がる（Pieces、重み 16）。実測値は JSON の `runtimeFacts.measured`
- 消費: `CONFIRM_BAKE` で置いた個数だけ。spread は 1。無限の starter 3 件は減らない
- Shop: 有限の 19 件は今は `starterGrantOnly`（EP4 grant で `minCount × 10` 個）。補充は `restockQuantity`（3 × k）個

---

## 3. 3-4C の在庫・Shop の仕様（D-2 と D-4 から）

| 項目 | 3-4C の仕様 | 由来 |
|---|---|---|
| `inventory` の key、単位、値 | 変えない | D-2 |
| 消費 | `consumePizzaInventory`（置いた個数）をそのまま使う | D-2 |
| Stock Gate | `canPlaceIngredient` をそのまま使う | D-2 |
| 「有限在庫かどうか」の判定 | `unlockCondition` ではなく authority の `initialOwned`（3 件）で判定する | #211 P0-S3 |
| 初回購入 | Pitz −価格 → OWNED → +`purchaseQuantity` 個（固定データ） | D-4 |
| 補充 | Pitz −ceil(価格 × 0.5) → +`refillQuantity` 個（固定データ） | D-4 |
| 数量の行がない材料 | 購入も補充もできない（`NOT_FOR_SALE`。fail closed） | D-4 |
| 今の `Ingredient.restockQuantity`（EP3、3 × k） | Progression 2.0 の Shop では使わない。3-4C で EP3 の補充経路と一緒に撤去するか、参照を外す | D-4 |
| EP4 grant | 撤去する。ledger は saturate する | #211 P0-S2 |
| Lunch Rush の「作れる」 | 有限の具材ごとに `在庫 ≥ minCount`（#213 の `requiredStockUnits` の seam を個数のまま使う） | D-2、D-3 |
| save | migration なし。`schemaVersion` 2。新しい key なし | D-2 |

---

## 4. #205 の M4 修正計画（確定。まだ #205 は変更しない）

### 4.1 方針

- gate、価格、⭐、状態遷移（`progressionUnlocks.ts`、`progressionStars.ts`、`progressionIngredientState`、`progressionRefillPricePitz`）は**変えない**
- 在庫の部分を「個数」にし、購入・補充の数量を**固定データ**から読む（D-4）
- 「1 pizza = 1 use」の API は**削除する**。消費は runtime の `consumePizzaInventory` が担う（3-4C で配線）
- #205 は引き続き**未配線**のまま（どこからも import されない）

### 4.2 変更するファイル

**(1) 新規 `src/data/progressionStockQuantities.ts`**

```ts
export interface ProgressionStockQuantity {
  ingredientId: string;
  /** Pieces granted by the first purchase. Fixed balance data (D-4). */
  purchaseQuantity: number;
  /** Pieces granted by one refill. Fixed balance data (D-4). */
  refillQuantity: number;
}
export const PROGRESSION_STOCK_QUANTITIES: readonly ProgressionStockQuantity[] = [ /* §1 D-4 の 19 行 */ ];
export function getProgressionStockQuantity(ingredientId: string): ProgressionStockQuantity | undefined;
```

- ヘッダーのコメントに書くこと: 初期値は authority の 10 portions × 3-4C 移行時点の k。runtime では計算しない。recipe の追加で自動では変えない。変えるときは balance の変更として、このファイルを明示的に変える
- `RECIPES` を import しない（自動で追従しないことをコードの構造で保証する）

**(2) `src/logic/progressionEconomy.ts`**

| # | 変更 |
|---|---|
| A-1 | ヘッダーのコメントを書き換える: 在庫は個数。購入・補充は `PROGRESSION_STOCK_QUANTITIES` の固定の個数。消費は runtime の `consumePizzaInventory`（置いた個数）で、このモジュールには消費の関数はない |
| A-2 | `PROGRESSION_PURCHASE_GRANT_USES` → `PROGRESSION_PURCHASE_GRANT_PORTIONS` に改名（値は 10。authority の `purchaseGrantPortions` との parity 用。在庫の加算には使わない） |
| A-3 | `PROGRESSION_REFILL_USES` → `PROGRESSION_REFILL_PORTIONS` に改名（同上） |
| A-4 | `PROGRESSION_USES_PER_PIZZA` を削除 |
| A-5 | `ProgressionStock` のコメントを「個数」に直す（型は `Readonly<Record<string, number>>` のまま） |
| A-6 | `remainingPizzaUses` を削除 |
| A-7 | `purchaseProgressionIngredient`: 加算量を `getProgressionStockQuantity(id)?.purchaseQuantity` にする。行がないか、値が正の整数でなければ `NOT_FOR_SALE`（Pitz を払わない）。判定の順番は `INVALID_BALANCE` → `ALREADY_OWNED` / `LOCKED` → `NOT_FOR_SALE`（価格、または数量）→ `INSUFFICIENT_FUNDS` |
| A-8 | `refillProgressionIngredient`: 加算量を `refillQuantity` にする。行がなければ `NOT_FOR_SALE`。順番は A-7 と同じ考え方 |
| A-9 | `consumePizzaUse` と `ProgressionUseResult` を削除 |
| A-10 | `sanitizeUses` → `sanitizeCount` に改名（挙動は同じ） |

**(3) テスト**

| # | ファイル / ブロック | 変更 |
|---|---|---|
| T-1 | `progressionEconomy.test.ts` の購入ブロック | describe の名前を「OWNED + purchaseQuantity pieces」に。egg（10 個）の期待値はそのまま。**pepperoni（⭐6、60 Pitz）で +40 個**のケースを追加。数量の行がない材料（例: authority にだけある `fresh-tomato`）は `NOT_FOR_SALE` で Pitz を払わないケースを追加 |
| T-2 | 同 補充ブロック | egg（+10、2 回で +20）はそのまま。**pepperoni で半額 30 Pitz、+40 個**を追加。行がない材料は `NOT_FOR_SALE` |
| T-3 | 同「pizza uses (1 pizza = 1 use)」ブロック | **削除** |
| T-4 | 同「audit §5.1 opening」 | 期待値（egg +10、残り 10 Pitz）はそのまま。コメントの use を個数に直す |
| T-5 | `progressionUnlocks.test.ts` の「S10_R10」 | authority との parity は残す。import を `…_PORTIONS` に直す |
| T-6（新規） | `progressionStockQuantities.test.ts` | (a) 行があるのは、runtime の `INGREDIENTS` のうち authority で `initialOwned: false` の 19 件だけ（starter 3 件と、runtime にない 83 件には行がない）。(b) 19 行の値を**そのまま固定**する（literal の snapshot。§1 D-4 の表）。(c) どの行も正の整数。(d) **不変条件:** `purchaseQuantity` と `refillQuantity` は、その材料を使う shipped recipe の `minCount` 以上（1 回の購入で最低 1 枚は焼ける）。**`10 × max(minCount)` との一致はテストしない**（recipe の追加で自動的に変えないため）。(e) `progressionStockQuantities.ts` と `progressionEconomy.ts` が `recipes` を import していない |

### 4.3 #205 の修正後の確認（ローカル。CI の再実行は technical gate で行う）

- `npx tsc -b`、`npm run lint`、`npx vitest run`（unit 全件）
- #205 は未配線なので E2E への影響はない。E2E と WebKit は technical gate の CI で確かめる
- PR #205 の本文を M4 と D-4 に合わせて更新する

---

## 5. #211 / #213 の前提のうち、D-2 / D-4 で変わるもの

これらの PR は変更しない。3-4C の Issue を切るときに、以下を仕様として書く。

| PR | 箇所 | 3-4C での扱い |
|---|---|---|
| #211 | P0-S1（在庫の単位の migration）、§7、§13 の在庫の行 | **不要** |
| #211 | §5.1 の置き換え表（`consumePizzaUse` の集約、use 単位の Stock Gate、+10 use） | 消費と Stock Gate は今の `consumePizzaInventory` / `canPlaceIngredient` を残す。購入と補充は D-4 の固定の個数 |
| #211 | §10 の 5（1 枚 = 1 use）と 6（M-max の migration） | 5 は「置いた個数だけ消費。Stock Gate は残りの個数まで」。6 は削除 |
| #211 | T-C4/T-C5（+10 use） | D-4 の固定の個数（k > 1 のケースを含む） |
| #211 | T-C6/T-C7 | 今のルール（置いた個数を消費、残りの個数まで置ける）に書き直す |
| #211 | T-C8/T-C9（migration、dual-write） | 削除 |
| #211 | §11.2 の新規 spec、§12 の Human Replay 2 | egg（k = 1）の「1 減る」はそのまま。k > 1 の具材（例: pepperoni を 5 個置いて 5 減る。購入で +40）を足す |
| #211 | §6.2（#206 e2e の書き込み契機） | 「購入」だけ（migration の書き込みがないため） |
| #211 | P0-S2、P0-S3、F-1〜F-8、`schemaVersion` 2 | **そのまま必要** |
| #213 | §2 と §8 の「3-4C の後、`requiredStockUnits` は 1 use」 | 不要。seam は個数のまま（`minCount`） |
| #213 | B2（在庫が最低量に足りない） | 実際に起きる状態として残る。pool は除外する |

---

## 6. Completion / Scoring の見直し: Issue #215

- 作成済み: **#215** https://github.com/perusonao/teto-pizza-game/issues/215
- 内容: 現状（不足は FAILED、過剰は約 −2 点、不足の減点は −0.5〜−1.2 点しかない）、owner の方向（2 個でも完成、不足と過剰は Scoring 2.0 で減点、失敗の境界は Fresh Audit で決める）、10 項目の scope、guardrail（Fresh Audit では runtime を変えない。gameplay の変更は 3-4C の merge の後）、deliverable、exit report
- 3-4C とは分離している

---

## 7. 3-4C の判定（Rev.4）

### 7.1 Decision Gate: **仕様決定完了**

| # | product decision | 状態 |
|---|---|---|
| 1 | OD-03 | ✅ D-1: Option A |
| 2 | 再ロックの方針 | ✅ 起きない設計。entitlement は不要 |
| 3 | 在庫の単位と消費 | ✅ D-2: M4 |
| 4 | Completion Gate の扱い | ✅ D-3: 3-4C では変えない（#215） |
| 5 | Shop の購入・補充の数量 | ✅ D-4: 材料ごとの固定の個数（初期値 10 × k） |

**owner に残る product decision: 0 件。**

3-4C の Issue を切るときに範囲として書くもの（product decision ではない）:
- 3-4C の Pizza Select では「今は作れない」を出す（#211 §9 の A 列の要件）。「今後追加」「BEST を上げる」の本格的な案内は 3-4E
- §3 の在庫・Shop の仕様と、§5 の #211/#213 の差分

### 7.2 実装: **まだ Go ではない。** 次の technical gate を順番に通す

| # | technical gate | 完了の条件 | 必要なもの |
|---|---|---|---|
| TG-1 | **#205 の M4 修正** | §4 の変更（A-1〜A-10、T-1〜T-6）を #205 の branch に push。ローカルで typecheck、lint、unit が green | owner の許可（#205 の変更） |
| TG-2 | **#205 を最新 main で gate** | #205 に最新の main を merge commit で取り込む（rebase はしない）。GitHub の CI（build、`WebKit Gate` を含む 4 shard の Full WebKit）が green | TG-1 |
| TG-3 | **#205 merge** | owner が merge | TG-2 |
| TG-4 | **#206 を最新 main で gate して merge** | #206 に最新の main（#205 を含む）を取り込み、CI（`WebKit Gate` を含む）が green。owner が merge | TG-3 |
| TG-5 | **#206 を production に deploy** | production の build が #206 の `writeSave`（未知 id と未知 key の保持）を含む。main の post-merge Full WebKit が green | TG-4 |
| TG-6 | 3-4C の実装を Go | 3-4C の Issue を、#205/#206 を含む最新の main から切る。§3 と §5 を仕様として書く | TG-5 |

---

## 付録 A. 版の履歴

- **Rev.1:** OD-03 の A/B/C1/C2 の比較と、在庫の M1/M2/M3 の比較。rollback のモデル（M1 1982/2000、M2 0、M2 の marker だけの場合 994/997、M3 0）
- **Rev.2:** runtime の再監査（`minCount` = 理想量、不足は FAILED、過剰は約 −2 点、置いた個数を消費）、M4 の追加、1-use で変わる挙動
- **Rev.3:** D-1 = A、D-2 = M4、D-3 = Completion の分離を記録。#205 の矛盾の洗い出し。#211/#213 の差分。Issue 案
- **Rev.4（本版）:** D-4 = Shop の数量を固定の個数に。Issue #215 を作成。#205 の修正計画を確定。仕様決定完了。technical gate の順番を明記

## 付録 B. スコープと検証

- 変更したファイル: 本レポートと JSON だけ（docs-only）
- #205 の内容は `git show origin/claude/progression-2-0-phase-3-4a-km8q1c:<path>`（head `9035606`）で読んだ
- authority の stock policy: `docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json` の `policy`（`stockPolicy: "S10_R10"`、`purchaseGrantPortions: 10`、`refillPortions: 10`、`refillPriceFactor: 0.5`）
- UI/UX/gameplay は変更していないので、Human Verification policy の対象外
