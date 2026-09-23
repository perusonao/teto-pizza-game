# Progression 2.0 Phase 3-4C — Decision Gate（OD-03 / inventory 単位）

- 初版: 2026-09-23 / Rev.2（runtime の再監査と M4 の追加）: 2026-09-23 / **Rev.3（owner decision の記録）: 2026-09-23**
- 監査対象 `origin/main`: **`dff233c042d2df6ee1c3a92f2d2419830aa05460`**（PR #210 の merge。Rev.3 の開始時にも変わっていないことを確認）
- Branch: `claude/teto-pizza-p3-4c-decision-foc6x9`（docs-only、PR #214）
- Machine-readable: `docs/reports/data/PROGRESSION-2.0_P3-4C_DECISION-GATE.json`

| PR / Issue | 状態（Rev.3 開始時） | head | 本書での使い方 |
|---|---|---|---|
| #205 Phase 3-4A | OPEN・未マージ | `9035606` | M4 と矛盾する API とテストの洗い出し（§4） |
| #206 Phase 3-4B | OPEN・未マージ | `4c1da87` | save の forward-compat |
| #209 OD-03 Decision Brief | OPEN・未マージ | `d719f1d` | Option A の数値 |
| #211 3-4C Integration Preflight | OPEN・未マージ | `27e0916` | 3-4C の仕様の土台（M4 で変わる箇所は §5） |
| #213 3-4F Fresh Audit | OPEN・未マージ | `7ccf5df` | 在庫つき mission pool の判定 |
| Issue #212 | OPEN | — | 3-4F の親 Issue |

> 本書は owner の決定を**記録する**だけで、新しい判断はしない。
> runtime（`src/**`、`e2e/**`、`.github/**`）は変更していない。#205/#206/#209/#211/#213 には push していない。
> merge も rebase もしていない。3-4C には着手していない。CI と WebKit は実行していない。

---

## 0. 結論（1 画面）

| | 内容 |
|---|---|
| **D-1 OD-03** | **DECIDED: Option A**（authority の固定 ⭐gate。後から上げない。再ロックは構造的に起きない。entitlement は不要） |
| **D-2 在庫の単位** | **DECIDED: M4**（正式な単位は材料の個数のまま。migration しない。実際に置いた個数だけ消費。Shop も個数。Lunch Rush の「作れる」も個数で判定。#205 の「1 pizza = 1 use」は採用しない）。**M1/M2/M3 は不採用** |
| **D-3 Completion / Scoring** | **3-4C から分離。** 3-4C では Completion Gate を変えない（理想量 = `minCount`、不足すると失敗、のまま）。見直しは新しい Issue で行う（§6 に Issue 案） |
| **#205** | **修正してから merge すべき。** gate、価格、⭐、状態遷移はそのまま使える。在庫の部分（+10 use、1 pizza = 1 use、`consumePizzaUse`、`remainingPizzaUses`）と、その 5 つのテストブロックが M4 と矛盾する（§4） |
| **3-4C Go/No-Go** | **No-Go。** 残りの blocker: #205 の修正と merge、#206 の merge と deploy、#205/#206 の最新 main での CI、購入・補充 1 回あたりの個数（§3.2。本書の提案は「10 × k 個」）の確認 |

---

## 1. 確定した Decision

### D-1: OD-03 = Option A（DECIDED）

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
| 3-4E の案内 | 「今後のアップデートで追加」と「BEST を上げると次の材料が入荷」。3-4C と同時に出す範囲は 3-4C の Issue で決める（最小案: Pizza Select に「今は作れない」） |

### D-2: 在庫 = M4（DECIDED）

| 項目 | 決定 |
|---|---|
| 正式な単位 | **材料の個数**（spread の sauce、olive-oil、pesto は 1 回分 = 1）。今と同じ |
| migration | **しない。** save の形式、key、`schemaVersion`（2）は変えない |
| 消費 | **実際に置いた個数だけ**、`CONFIRM_BAKE` で減らす（今の EP2 のまま。PASS でも FAILED でも同じ） |
| 置ける個数 | 残りの個数まで（今の EP3 Stock Gate のまま） |
| Shop | 個数で購入・補充する |
| Lunch Rush の「作れる」 | discovered ∧ 全材料 OWNED ∧ 有限の具材ごとに `在庫 ≥ 完成に必要な最低量`。3-4C の時点では Completion Gate を変えないので、最低量 = `minCount` |
| #205 の「1 pizza = 1 use」 | **採用しない** |

### D-2 で不採用になった方式

| 方式 | 内容 | 不採用の理由 |
|---|---|---|
| M1 | 既存の `inventory` key の意味を use に変える | rollback で単位が混ざり、二重変換が起きる（初版のモデルで 2000 通り中 1982 通りが不一致） |
| M2 | use を新しい key に保存し、旧 key に個数を書き続ける | 1 枚 = 1 use のゲーム性（載せすぎても在庫は減らない、recipe ごとの消費の差がなくなる）を owner が採らなかった。さらに migration、突き合わせのルール、#206 の 4 か所への登録が必要 |
| M3 | 個数で保存し、1 枚 = 1 use で遊ぶ | 同じく 1 枚 = 1 use のゲーム性を採らなかった |

M1〜M3 の比較と rollback のモデルは、本書の git 履歴（Rev.1/Rev.2）に残っている。

### D-3: Completion / Scoring を 3-4C から分離

- 3-4C では Completion Gate を**変更しない**
- 見直しの方向（owner）: 理想 3 個に対して 2 個でも完成できるようにする。不足と過剰は Scoring 2.0 で減点する。0 個や、recipe として成り立たない状態をどこで失敗にするかは Fresh Audit で決める
- Issue 案は §6

---

## 2. 現在の runtime の事実（Rev.2 の再掲。main `dff233c` が source of truth）

- 15 recipe のすべての scatter 具材で `minCount` = 理想量（Reference Pizza のお手本の個数）。ずれは 0 件
- 同じ具材でも recipe によって必要量が違う（pepperoni 4 / 1、onion 4 / 2、oregano 2 / 1、mushroom 3 / 2、sausage 3 / 2、bacon 3 / 2）
- 置ける数の上限は在庫と生地の空きスペースだけ。焼くボタンは具材の数を確認しない
- Completion Gate: 0 個は `MISSING_REQUIRED_INGREDIENT`、`minCount` 未満は `INSUFFICIENT_REQUIRED_AMOUNT` で FAILED（スコア・報酬・Dex なし）。多すぎる場合は PASS
- Scoring 2.0: 1 個多いごとに約 1.6〜2 点下がる（Pieces、重み 16）。実測値は Rev.2 の §2.3（git 履歴）と JSON の `runtimeFacts.measured`
- 消費: `CONFIRM_BAKE` で置いた個数だけ。spread は 1。無限の starter 3 件（tomato-sauce、mozzarella、basil）は減らない
- Shop: 有限の 19 件は今は `starterGrantOnly`（EP4 grant で `minCount × 10` 個を入手）。補充は `restockQuantity` 個 = 一番多く使う recipe の 3 枚分

**M4 は、この在庫と消費のルールをそのまま維持する。**

---

## 3. 3-4C における M4 の仕様

### 3.1 変えないもの

- `inventory` の key、単位、値。`consumePizzaInventory`（置いた個数だけ減らす）。`canPlaceIngredient`（Stock Gate）
- `schemaVersion` 2。save の migration はない
- Completion Gate（D-3）

### 3.2 3-4C で変えるもの（在庫に関係する部分）

| 項目 | 3-4C の仕様 | 備考 |
|---|---|---|
| 「有限在庫かどうか」の判定 | `unlockCondition` ではなく、authority の `initialOwned`（3 件）で判定する | #211 P0-S3。EP1 の撤去と同時に必須。M4 でも変わらない |
| 初回購入 | Pitz −価格（authority のまま）→ OWNED → **+`purchaseGrantPortions` × k 個** | authority の「10 portions」を個数に換算する |
| 補充 | Pitz −ceil(価格 × 0.5) → **+`refillPortions` × k 個** | 同上 |
| k（1 portion あたりの個数） | その具材を使う shipped recipe の `minCount` の最大値。spread は 1 | 値: pepperoni/onion 4、mushroom/sausage/bacon/garlic/cherry-tomato/anchovy/tuna/rosemary 3、oregano/gorgonzola/parmigiano/fontina/black-olive 2、egg/ham/olive-oil/pesto 1 |
| Lunch Rush の「作れる」 | 有限の具材ごとに `在庫 ≥ minCount` | #213 の `requiredStockUnits` の seam を**個数のまま**使う |
| EP4 grant | 撤去する。ledger は saturate する | #211 P0-S2。M4 でも変わらない |

**「10 × k 個」について（owner の確認が必要）:** authority の stock policy（`S10_R10`）は「10 portions（ピザ 10 枚分）」で決めている。
M4 では「1 portion = 一番多く使う recipe の 1 枚分の個数（k）」と読み替えるのが、数の上ではもっとも近い。
- 理想量どおりに置く限り、1 回の購入で**10 枚以上**焼ける（`minCount ≤ k` のため）。authority の simulation（#196）は下限として成り立つ
- 載せすぎる人は早く減る（M4 のゲーム性）
- 今の補充量（`restockQuantity` = 3 × k）とも同じ換算になっている

k を凍結する必要は、M4 ではない（save の値の意味は変わらないので）。ただし、recipe の追加で k が変わると購入量が変わる。これを許すかどうかも、購入量の確認と合わせて決める。

### 3.3 3-4F / #213 との整合

- `requiredStockUnits` は個数のまま（`minCount`）。「3-4C の後は 1 use に差し替える」という #213 の前提は不要になる
- 在庫が最低量に足りない状態（#213 の B2。例: mushroom 2 個で funghi）は実際に起きる。3-4F の pool はそれを除外する
- 将来 D-3 の Issue で最低量が下がった場合は、seam の値をその最低量にする（例: 1 個）。構造は変わらない

---

## 4. #205 と M4 の矛盾

### 4.1 そのまま使えるもの

| ファイル / API | 判定 |
|---|---|
| `src/data/progressionUnlocks.ts`（gate、価格、tier、`initialOwned`） | そのまま使える。D-1（A）は authority の値をそのまま使う |
| `src/logic/progressionStars.ts`（Σmax(2, BEST)） | そのまま使える |
| `progressionIngredientState`（LOCKED → AVAILABLE_TO_BUY → OWNED） | そのまま使える |
| `progressionRefillPricePitz`（ceil(価格 × 0.5)） | そのまま使える |
| 購入・補充の失敗理由と判定順（`INVALID_BALANCE`、`ALREADY_OWNED`、`LOCKED`、`NOT_FOR_SALE`、`INSUFFICIENT_FUNDS`、`UNLIMITED`、`NOT_OWNED`） | そのまま使える |

### 4.2 M4 と矛盾する API（`src/logic/progressionEconomy.ts`）

| # | 箇所 | 今の #205 | M4 との矛盾 | 必要な修正 |
|---|---|---|---|---|
| A-1 | ファイルヘッダーのコメント | 「Stock unit: 1 use = 1 pizza」「+10 uses」「how the runtime inventory moves to pizza uses is Phase 3-4C's decision」 | 採用しない単位を仕様として書いている | 「在庫は個数。購入・補充は portions × k 個。消費は runtime の `consumePizzaInventory`（置いた個数）」に書き換える |
| A-2 | `PROGRESSION_PURCHASE_GRANT_USES = 10` | use の数 | 単位が use | `PROGRESSION_PURCHASE_GRANT_PORTIONS` に改名する（authority の `purchaseGrantPortions` と同じ意味）。個数への換算は別にする |
| A-3 | `PROGRESSION_REFILL_USES = 10` | 同上 | 同上 | `PROGRESSION_REFILL_PORTIONS` に改名する |
| A-4 | `PROGRESSION_USES_PER_PIZZA = 1` | 1 枚 = 1 use | M4 では消費は置いた個数 | **削除** |
| A-5 | `ProgressionStock` 型（「Stock in pizza uses」） | use の map | 単位が use | 「個数の map」にコメントを直す（型は `Record<string, number>` のままでよい） |
| A-6 | `remainingPizzaUses` | 残りの use、または `"UNLIMITED"` | use という概念がない | **削除**するか、`remainingPieces` に改名する（意味: 残りの個数、または `"UNLIMITED"`） |
| A-7 | `purchaseProgressionIngredient` | 在庫に +10 | 個数では +10 × k | 付与量を入力に加える（例: `grantPieces`）か、k を引数で受け取って `portions × k` を足す。#205 は recipe のデータを読まないので、**k は呼び出し側（3-4C）が渡す形**がよい |
| A-8 | `refillProgressionIngredient` | 在庫に +10 | 同上 | A-7 と同じ |
| A-9 | `consumePizzaUse` と `ProgressionUseResult`（`OUT_OF_STOCK`） | 1 枚で 1 use 減らす。0 なら失敗 | M4 の消費は runtime の `consumePizzaInventory`（置いた個数。0 で止まる。失敗しない） | **削除** |
| A-10 | `sanitizeUses`（内部関数） | use の sanitize | 名前だけの問題 | `sanitizeCount` などに改名（挙動は同じでよい） |

### 4.3 M4 と矛盾するテスト

| # | ファイル / ブロック | 内容 | 必要な修正 |
|---|---|---|---|
| T-1 | `progressionEconomy.test.ts` の `describe("purchaseProgressionIngredient (first purchase → OWNED + 10 uses)")`（約 62〜143 行） | egg で `nextStock: { egg: 10 }`、`{ egg: 13 }`、`{ bacon: 4, egg: 10 }` | egg は k = 1 なので**数値は M4 でも同じ**。ただし名前と意味が use。**k > 1 の具材（例: pepperoni で +40 個）のケースを追加**し、名前を portions / 個数に直す |
| T-2 | 同 `describe("refillProgressionIngredient (+10 uses at half price)")`（約 146〜206 行） | egg で +10、2 回で +20 | T-1 と同じ（数値はそのまま、k > 1 のケースを追加） |
| T-3 | 同 `describe("pizza uses (1 pizza = 1 use)")`（約 209〜252 行） | `consumePizzaUse` で 1 枚 1 use、「10 uses で 10 枚焼いたら OUT_OF_STOCK」、`remainingPizzaUses` | **ブロックごと削除**（A-4、A-6、A-9）。個数の消費のテストは runtime の `consumePizzaInventory` 側に既にある |
| T-4 | 同 `describe("audit §5.1 opening")`（約 255〜271 行） | 最初の購入で `nextStock: { egg: 10 }` | egg は k = 1 なので値はそのまま。コメントの use を個数に直す |
| T-5 | `progressionUnlocks.test.ts` の「stock policy is S10_R10」（約 62〜67 行）と import | `authority.policy.purchaseGrantPortions` を `PROGRESSION_PURCHASE_GRANT_USES` と比べる | authority との parity は残す。import を A-2/A-3 の新しい名前にする |

`progressionStars.test.ts` と、`progressionUnlocks.test.ts` の残り（105 行の parity、gate、価格）は M4 と矛盾しない。

### 4.4 #205 をそのまま merge できるか

**判定: 修正してから merge すべき。**

| 観点 | そのまま merge | 修正してから merge |
|---|---|---|
| runtime への影響 | ない（どこからも import されていない） | ない |
| main の SSOT | 採用しなかった「1 pizza = 1 use」が、テストで固定された仕様として main に入る | 決定と一致する |
| 3-4C の作業 | 3-4C で A-1〜A-10 と T-1〜T-5 を消したり直したりする必要があり、3-4C の diff が大きくなる | 3-4C は配線だけに集中できる |
| リスク | 3-4C の実装者が `consumePizzaUse` を配線してしまう（#211 §5.1 の置き換え表もそう書いている） | ない |
| 修正の量 | — | `progressionEconomy.ts` と 2 つのテストファイルだけ。gate、価格、⭐ の部分は触らない |

修正は #205 の branch で行う必要がある。本タスクでは #205 を変更しない。owner の許可があれば、別のタスクで行う。

---

## 5. #211 / #213 の前提のうち、D-2（M4）で変わるもの

| PR | 箇所 | M4 での扱い |
|---|---|---|
| #211 | P0-S1（在庫の単位の migration） | **不要** |
| #211 | §7（変換式、保存の形）、§13 の在庫の行 | **不要**（在庫の rollback は単位が同じなので安全） |
| #211 | §5.1 の置き換え表: `purchaseIngredient` → `purchaseProgressionIngredient`「+10 use」、`restockIngredient` → `refillProgressionIngredient`「+10 use」、`consumePizzaInventory` → 「`consumePizzaUse` を pizza 単位で集約」、`canPlaceIngredient` → 「use 単位の判定」 | 購入と補充は「+portions × k 個」。**消費と Stock Gate は今の `consumePizzaInventory` と `canPlaceIngredient` を残す**（有限の判定だけ `initialOwned` に変える） |
| #211 | §10 の 5（「1 枚 = 1 use。1 片でも置けば 1 use」）と 6（M-max の migration） | 5 は「置いた個数だけ消費。Stock Gate は残りの個数まで」。6 は削除 |
| #211 | T-C6（「同じ材料を何片置いても 1 use」）、T-C7（「use が 1 以上なら何片でも置ける」）、T-C8、T-C9 | T-C6/T-C7 は今のルール（置いた個数を消費、残りの個数まで置ける）に書き直す。T-C8/T-C9 は削除 |
| #211 | T-C4/T-C5（購入 +10 use、補充 +10 use） | +portions × k 個（k > 1 のケースを含む） |
| #211 | §11.2 の新規 spec（「egg の在庫が 1 減る」）、§12 の Human Replay 2 | egg は k = 1 なので「1 減る」はそのまま成り立つ。k > 1 の具材でのシナリオ（例: pepperoni を 5 個置いて 5 減る）を足す |
| #211 | §6.2（#206 e2e の書き込み契機を「migration の書き込み」か「購入」に） | 「購入」だけ（migration の書き込みがないため） |
| #211 | P0-S2（ledger の saturation）、P0-S3（`initialOwned`）、F-1〜F-8、`schemaVersion` 2 | **そのまま必要** |
| #213 | §2 と §8 の「3-4C の後、`requiredStockUnits` は 1 use」 | **不要。** seam は個数のまま（`minCount`） |
| #213 | B2（在庫が最低量に足りない）、HR のシナリオ | 実際に起きる状態として残る。pool は除外する |

---

## 6. 新 Issue 案: Completion / Scoring の見直し（まだ runtime を実装しない）

以下は Issue の本文案。本タスクでは Issue を作成していない。

---

**Title:** Completion Gate: 理想量より少ない具材でも完成できるようにする — Fresh Audit

**Purpose**

今の Completion Gate は、具材の最低量（`minCount`）を理想量（Reference Pizza のお手本の個数）と同じにしている。
そのため、理想 3 個の具材を 2 個で焼くと `INSUFFICIENT_REQUIRED_AMOUNT` で FAILED になり、スコア・報酬・Dex 登録がない。
owner の想定するゲーム性は「理想量と違っても完成し、差はスコアで評価する」。この差を Fresh Audit で整理し、仕様を決める。

**Current baseline（main `dff233c`）**

- `src/logic/completionGate.ts:175-181`: 0 個なら `MISSING_REQUIRED_INGREDIENT`、`minCount` 未満なら `INSUFFICIENT_REQUIRED_AMOUNT`
- 15 recipe のすべての scatter 具材で `minCount` = お手本の個数（ずれは 0 件）
- Scoring 2.0: 個数の差は Pieces（重み 16）の「数」（30%）と「多すぎるときの配置の割引」だけで評価する。1 個多いと約 −2 点。少ない場合の減点は −0.5〜−1.2 点しかない（今は FAILED になるので表に出ない）。Recipe の要素（重み 12）は種類があるかどうかだけを見る
- 在庫: 置いた個数だけ消費する（Progression 2.0 の D-2 = M4。変更しない）
- Free Cooking の discovery: 最低量に届かないと `INCOMPLETE_MATCH`

**Direction（owner）**

- 理想 3 個に対して 2 個でも、ピザとして完成できるようにする
- 不足と過剰は Scoring 2.0 で減点する
- 0 個や、recipe として成り立たない状態をどこで失敗にするかは、この Fresh Audit で決める

**Scope: Fresh Audit / Pre-Implementation Design first**

1. 「最低量」「理想量」「実際に使った量」を分ける。データの持ち方（`minCount` を最低量として残し、理想量は Reference から取るなど）
2. 失敗にする境界の候補の比較: 0 個だけ / 理想量の一定割合未満 / 具材ごとの最低量 / 「recipe として成り立つか」（主役の具材がない、など）
3. Scoring 2.0 の不足時の減点の再設計: 今の −0.5〜−1.2 点では「足りなくても損をしない」ので、量の評価の重みと形を見直す。★ の閾値（90/75/60/40）への影響
4. Free Cooking の discovery（matcher、`INCOMPLETE_MATCH`）との整合。少ない個数で「発見」してよいか
5. Lunch Rush: 3-4F の「作れる」判定（`在庫 ≥ 最低量`）の値が変わる。`requiredStockUnits` の seam の値だけの差し替えで済むことを確認する
6. 在庫（M4）: 少なく載せると在庫を節約できる。経済（authority の simulation）への影響
7. Completion の文言（`completionMessages.ts`）、hint、Result の表示
8. Ranking（Lunch Rush の submit）への影響
9. unit / component / Chromium / WebKit のテスト matrix
10. Human Replay のシナリオ（2 個で完成、0 個で失敗、多すぎて減点、Lunch Rush での少量完成）

**Guardrails**

- Fresh Audit の段階では runtime を変更しない
- Progression 2.0 Phase 3-4C では Completion Gate を変更しない（本 Issue とは別に進める）
- 3-4C の実装と衝突しないよう、`completionGate.ts`、`scoringV2/**`、`recipes.ts` の `minCount` の変更は、3-4C の merge の後に行う
- UI/UX/gameplay の変更なので、実装フェーズでは Human Verification policy の対象になる

**Deliverable**

`docs/reports/TETO_COMPLETION-GATE_PARTIAL-QUANTITY_Fresh-Audit.md`（名前は仮）

**Exit report**

失敗の境界の候補と推奨、スコアの再設計案、discovery と Lunch Rush への影響、テスト matrix、Human Replay、実装の Go/No-Go。

---

## 7. 3-4C Go/No-Go（Rev.3）

**No-Go。**

| # | 条件 | 状態 |
|---|---|---|
| 1 | OD-03 | ✅ Option A |
| 2 | 再ロックの方針 | ✅ 起きない設計。entitlement は不要 |
| 3 | 在庫の単位 | ✅ M4 |
| 4 | Completion Gate の扱い | ✅ 3-4C では変えない（別 Issue） |
| 5 | **購入・補充 1 回あたりの個数**（本書の提案: `portions × k`。k は shipped recipe の最大 `minCount`。recipe の追加で k が変わることを許すかどうかも含む） | ❌ owner の確認が必要 |
| 6 | **#205 を M4 に合わせて修正する**（§4.2 の A-1〜A-10、§4.3 の T-1〜T-5） | ❌ 未着手（#205 の変更には owner の許可が必要） |
| 7 | #205 / #206 が最新の main で CI green（sharded WebKit を含む）になり、merge されている | ❌ OPEN |
| 8 | #206 が 3-4C より先に production に deploy されている | ❌（M4 では在庫の rollback の安全性とは関係ない。P0-S2 の ledger と未知 id の保持のために引き続き必要） |
| 9 | 3-4C の Issue に、§3 の M4 の仕様と §5 の #211 の差分を書く | ⏳ 3-4C の Issue を切るとき |
| 10 | 3-4E の案内を 3-4C と同時に出す範囲（#211 G-2） | ⏳ 3-4C の Issue で決める（blocker ではない） |

---

## 付録 A. 版の履歴

- **Rev.1:** OD-03 の A/B/C1/C2 の比較と、在庫の M1/M2/M3 の比較。rollback のモデル（M1 1982/2000、M2 0、M2 の marker だけの場合 994/997、M3 0）
- **Rev.2:** runtime の再監査（`minCount` = 理想量、不足は FAILED、過剰は約 −2 点、置いた個数を消費）、M4 の追加、1-use で変わる挙動（L-1〜L-8）
- **Rev.3（本版）:** owner の決定（D-1 = A、D-2 = M4、D-3 = Completion を分離）の記録、#205 の矛盾の洗い出しと merge の判定、#211/#213 の差分、Completion / Scoring の Issue 案、Go/No-Go の再判定

## 付録 B. スコープと検証

- 変更したファイル: 本レポートと JSON だけ（docs-only）
- #205 の内容は `git show origin/claude/progression-2-0-phase-3-4a-km8q1c:<path>`（head `9035606`）で読んだ。行番号はその時点のもの
- authority の stock policy: `docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json` の `policy`（`stockPolicy: "S10_R10"`、`purchaseGrantPortions: 10`、`refillPortions: 10`、`refillPriceFactor: 0.5`）
- UI/UX/gameplay は変更していないので、Human Verification policy の対象外
