# Progression 2.0 Phase 3-4C — Decision Gate（OD-03 / inventory 単位）

- 初版: 2026-09-23 / **追加監査（Rev.2）: 2026-09-23**
- 監査対象 `origin/main`: **`dff233c042d2df6ee1c3a92f2d2419830aa05460`**（PR #210 の merge。Rev.2 の開始時にも変わっていないことを確認）
- Branch: `claude/teto-pizza-p3-4c-decision-foc6x9`（docs-only、PR #214）
- Machine-readable: `docs/reports/data/PROGRESSION-2.0_P3-4C_DECISION-GATE.json`

| PR / Issue | 状態（Rev.2 開始時） | head | 本書での使い方 |
|---|---|---|---|
| #205 Phase 3-4A | OPEN・未マージ | `9035606` | use 単位の API（§4.4 で影響を整理） |
| #206 Phase 3-4B | OPEN・未マージ | `4c1da87` | save の forward-compat |
| #209 OD-03 Decision Brief | OPEN・未マージ | `d719f1d` | Option A の数値 |
| #211 3-4C Integration Preflight | OPEN・未マージ | `27e0916` | P0-S1〜S3、在庫の変換表 |
| #213 3-4F Fresh Audit | OPEN・未マージ | `7ccf5df` | 在庫つき mission pool の判定 |
| Issue #212 | OPEN | — | 3-4F の親 Issue |

> **Rev.2 の変更点**
> 1. OD-03 は owner が **Option A** に決めた。本書に反映した（§1）。
> 2. owner から「理想量と違う個数でも完成できるゲームで、『1 pizza = 1 use』は合っているのか」という指摘があった。
>    これを受けて、**過去資料の結論を前提にせず、現在の runtime をもう一度確かめた**（§2）。そのうえで 1-use 化そのものを再検証した（§3）。
>    M4（個数のまま）を加えて比較した（§4）。
> 3. owner への質問を、ゲームでの挙動がわかる 2 問に絞った（§6）。
>
> 本書は M2/M3/M4 のどれも採用しない。runtime（`src/**`、`e2e/**`、`.github/**`）は変更していない。
> #205/#206/#209/#211/#213 には push していない。merge も rebase もしていない。3-4C には着手していない。CI と WebKit は実行していない。
> §2.3 の数値は、一時的な vitest ファイル（`src/__tmp__/`、実行後に削除。commit していない）で production のコードを呼んで測った。

---

## 0. 結論（1 画面）

| | 内容 |
|---|---|
| **現在の runtime の事実** | 15 recipe のすべての具材で、**理想量（お手本の個数）= `minCount`**。だから「理想 3 個の具材を 2 個で焼く」と、今のゲームでは **FAILED（完成しない）**になる。スコアも報酬も Dex 登録もない。**理想より多い**（4 個）場合は完成し、1 個多いごとに約 1.6〜2 点（100 点満点）下がる。在庫は**実際に置いた個数**だけ減る |
| **owner の想定との差** | 「2 個でも低スコアで完成」は**今の仕様ではない**。そうするには、Completion Gate の最低量を理想量より下げる、ゲーム性の変更が必要になる。これは在庫の単位とは別の問題（§2.5） |
| **1-use 化で変わること** | スコアの付け方は変わらない（個数と配置の評価はそのまま）。変わるのは「在庫のコスト」: 多く載せても在庫の減りは同じになる。在庫が途中で足りなくなる状態がなくなる。共有材料の recipe ごとの消費差（ミートラバーズはペパロニ 1 個、ペパロニピザは 4 個）がなくなる（§3） |
| **M2/M3/M4** | M3 と M4 は**保存形式が同じ（個数）**。違うのは「1 枚焼いたら何個減るか」だけ。M4 は migration が不要で、今のゲームそのまま。M2 だけが保存形式を変える（§4） |
| **OD-03** | **決定済み: Option A**。gate は authority の固定値で、後から上げない。⭐（Σmax(2,BEST)）は減らないので、再ロックは**構造的に起きない**。persisted entitlement は不要 |
| **3-4C Go/No-Go** | **No-Go**（在庫の単位が未決定。#205/#206 が未マージで、#206 は未 deploy）。OD-03 の項目は解消した |

---

## 1. Decision 1: OD-03 — **決定済み（Option A）**

### 1.1 owner の方針

- **Option A** を採る。今の 15 recipe を特別扱いしない
- authority の固定 ⭐gate を維持する
- recipe が増えれば、獲得できる ⭐ が自然に増え、後半の材料もそれで解放される
- gate の値そのものを後から引き上げない
- したがって、一度購入可能になった材料がロックに戻ることは起きない。persisted entitlement は原則として不要

### 1.2 この決定から導かれること（#209 の数値の再掲。新しい判断はしていない）

| 項目 | Option A での結果 |
|---|---|
| 新規プレイヤーが発見できる数 | ★1–2: **10/15**（20⭐ で止まる。次は garlic/parmigiano ⭐28）。★3: **11/15**（anchovy ⭐40）。★5: **13/15**（上限 65⭐。cherry-tomato ⭐76） |
| 誰も新規には発見できない recipe | **genovese、quattro-formaggi**（recipe が増え、獲得できる ⭐ が 76 / 102 に届くまで） |
| ★≤3 の skill lock | marinara、napoletana、pizza-bianca。BEST を上げれば届く |
| 再ロック | **起きない。** gate は固定。⭐ = Σmax(2,BEST) で、BEST は最高記録なので減らない。購入済み（OWNED）は永続 |
| persisted entitlement | **不要**（本書初版 §1.3 の R1/R1'/R2 は取り下げる） |
| 既存 save との差 | ある。既存 save は EP4 で cherry-tomato/fontina/gorgonzola を持っているので、Genovese/Quattro Formaggi を作れる（補充もできる）。新規プレイヤーは作れない |
| 101 件になったとき | authority そのもの（#196 の simulation がそのまま成り立つ） |
| 3-4C の実装 | `effectiveIngredientGate` は `PROGRESSION_INGREDIENT_UNLOCKS` の値をそのまま返す（#211 §9 の A 列）。gate は ⭐ だけの純関数。追加の永続データはない |
| 3-4E で必要な案内 | 「今後のアップデートで追加」（hard lock の 2 件）と、「BEST を上げると次の材料が入荷」（★≤3） |
| 必須テスト | 新規プレイヤーの「届かない recipe」の集合を BEST ごとに固定する（★5 で {genovese, quattro-formaggi}）。既存 save の差（#211 E4）も固定する |

**残りの項目（owner への質問にはしない）:** 3-4E の案内を 3-4C と同時に出すかどうか（#209 Q8、#211 G-2）。3-4C の Issue を切るときに範囲として決めればよい。最小案は、Pizza Select に「今は作れない」を正直に出すことで、これは #211 §9 がすでに A の行で求めている。

---

## 2. 現在の runtime の事実（main `dff233c` が source of truth）

### 2.1 recipe ごとの必要量（`src/data/recipes.ts` の `minCount` と、`src/data/referencePizza.ts` のお手本の個数）

「理想量」は Reference Pizza の `pieceGroups[].positions.length`（Scoring 2.0 の `targetCount`）。

| recipe | 有限の具材（最低量 = 理想量） | 無限の starter |
|---|---|---|
| margherita | — | mozzarella 3、basil 2、tomato-sauce |
| bismarck | egg 1 | mozzarella 3、tomato-sauce |
| breakfast-pizza | egg 1、bacon 3 | mozzarella 2、tomato-sauce |
| pepperoni | pepperoni 4 | mozzarella 2、tomato-sauce |
| salsiccia | sausage 3 | mozzarella 2、tomato-sauce |
| meat-lovers | bacon 2、ham 1、pepperoni 1、sausage 2 | mozzarella 2、tomato-sauce |
| funghi | mushroom 3 | mozzarella 2、tomato-sauce |
| capricciosa | mushroom 2、oregano 1、ham 1、black-olive 2 | mozzarella 2、tomato-sauce |
| fugazza | onion 4、oregano 1、olive-oil（spread） | — |
| tonno-e-cipolla | onion 2、tuna 3 | mozzarella 2、tomato-sauce |
| marinara | garlic 3、oregano 2 | tomato-sauce |
| napoletana | anchovy 3、oregano 1 | mozzarella 2、tomato-sauce |
| pizza-bianca | rosemary 3、olive-oil（spread） | — |
| genovese | cherry-tomato 3、pesto（spread） | mozzarella 2 |
| quattro-formaggi | gorgonzola 2、parmigiano 2、fontina 2、olive-oil（spread） | mozzarella 2 |

- **すべての scatter 具材で `minCount` = 理想量**（ずれは 0 件）。「最低必要量」と「理想量」は、今のデータでは同じ値
- **同じ具材でも recipe によって必要量が違う:** pepperoni 4 / 1、onion 4 / 2、oregano 2 / 1、mushroom 3 / 2、sausage 3 / 2、bacon 3 / 2
- spread（sauce、olive-oil、pesto）は「塗ったかどうか」が完成の条件で、量は sauce の品質（Completion Gate の `INSUFFICIENT_SAUCE` とスコア）として別に評価する

### 2.2 PREPARE（置く操作）と焼く操作

| 項目 | 今の挙動 | 根拠 |
|---|---|---|
| 置ける個数 | 上限は (1) 在庫（Stock Gate: 置いた数が残りの在庫を超えない。無限の starter は制限なし）と (2) 生地の空きスペースだけ。**recipe の理想量で止めることはしない** | `gameReducer.ts` `PLACE_TOPPING`、`inventory.ts` `canPlaceIngredient` |
| 焼くボタン | 具材の数を確認しない。**0 個でも、足りなくても焼ける** | `START_BAKE` には具材の guard がない |
| 完成の判定（Completion Gate） | 必要な具材ごとに、0 個なら `MISSING_REQUIRED_INGREDIENT`、**1 個以上でも `minCount` 未満なら `INSUFFICIENT_REQUIRED_AMOUNT`** で FAILED。多すぎる場合は判定しない（PASS） | `completionGate.ts:175-181` |
| FAILED の扱い | 「★1 のピザ」ではなく「ピザではない」: スコアなし、報酬なし、Dex/BEST 登録なし。Lunch Rush では quality 0 の serve。Free Cooking では `INCOMPLETE_MATCH`（発見にならない） | `completionGate.ts` のヘッダー、`freeCook.ts` |
| スコアの判定（Scoring 2.0） | Completion Gate とは独立。PASS のときだけプレイヤーの結果になる | `CONFIRM_BAKE` |

**完成の判定とスコアの判定は分かれているが、今のデータでは「最低量 = 理想量」なので、理想量より少ないと必ず FAILED になる。**

### 2.3 スコアへの影響（実測。production の `computeScoringV2` / `evaluatePizzaCompletion` / `consumePizzaInventory` を呼んだ）

条件: 他の具材はお手本の位置にちょうど置き、焼き加減は最適、sauce は付けたが塗りの記録はない（sauce の点は全行で同じなので、**差分だけを見る**）。1 個目から理想量までは、お手本の位置に置いた。理想量を超える分は、空いている位置に置いた。

| recipe / 具材（理想） | 置いた数 | 完成 | 合計点の差（理想との差） | その具材の Pieces group の点 | 在庫の減り |
|---|---:|---|---:|---:|---:|
| funghi / mushroom（3） | 1 | **FAILED**（不足） | −1.2 | 85 | 1 |
|  | 2 | **FAILED**（不足） | −0.6 | 92.5 | 2 |
|  | 3 | PASS | 0 | 100 | 3 |
|  | 4 | PASS | **−2.0** | 75 | 4 |
|  | 5 | PASS | −4.0 | 50 | 5 |
|  | 6 | PASS | −6.0 | 25 | 6 |
| pepperoni / pepperoni（4） | 3 | **FAILED**（不足） | −0.5 | 94 | 3 |
|  | 4 | PASS | 0 | 100 | 4 |
|  | 5 | PASS | −1.6 | 80 | 5 |
|  | 6 | PASS | −3.2 | 60 | 6 |
| meat-lovers / pepperoni（1） | 2 | PASS | −1.6 | 50 | 2 |
|  | 3 以上 | PASS | −3.2（下限） | 0 | 置いた数 |

- 個数の差は、Scoring 2.0 の **Pieces**（重み 16/100）の中の「数」（30%）と「多すぎるときの配置の割引」でだけ評価される。**Recipe の要素（重み 12）は種類があるかどうかしか見ない**
- **1 個多いと、100 点満点で約 1.6〜2 点下がる。** ★の閾値（90/75/60/40）の近くにいるときだけ、★が 1 つ変わりうる
- 理想量より少ない場合、スコアの計算上はわずかな減点（−0.5〜−1.2）にすぎない。**しかし Completion Gate が FAILED にするので、そのスコアはプレイヤーに届かない**

### 2.4 在庫の消費と Shop

| 項目 | 今の挙動 | 根拠 |
|---|---|---|
| 消費のタイミング | `CONFIRM_BAKE` の 1 か所だけ（phase の guard で 1 回だけ）。PASS でも FAILED でも同じ | `gameReducer.ts:940`、`:1009` |
| 何を何個 | **実際に置いた個数**（scatter）、sauce id ごとに 1（spread）。`minCount` は使わない | `inventory.ts` `consumePizzaInventory` |
| 無限の starter 3 件 | 消費しない（`unlockCondition` がない = 無限。#211 P0-S3 の問題箇所） | 同上 |
| 在庫の単位 | 個数（spread は 1 回分 = 1） | — |
| 入手 | 有限の 19 件はすべて `starterGrantOnly`。Shop で新しく買うことはできず、recipe の unlock 時の EP4 grant（`minCount × 10` 個。spread は 10）で手に入る | `starterStock.ts` `starterGrantForRecipe` |
| 補充（Shop） | `restockQuantity` 個を `pricePitz` で。値は**どれも「一番多く使う recipe の 3 枚分」**（例: pepperoni 12、mushroom 9、oregano 6、egg 3、olive-oil 3） | `ingredients.ts`、`economy.ts` `restockIngredient` |

### 2.5 owner の想定と今の runtime の対応

| owner の想定 | 今の runtime | 一致 |
|---|---|---|
| 理想 3 個を 2 個で完成できる | **FAILED**（`INSUFFICIENT_REQUIRED_AMOUNT`） | ✗ |
| 理想 3 個を 4 個で完成できる | PASS（−2 点程度） | ✓ |
| 個数の差は主にスコアに反映する | 多い場合は反映する（小さい）。少ない場合はスコアの前に失敗になる | 半分 |
| 理想量と違うだけでは失敗にしない | 少ない場合は失敗にする | ✗ |

**「2 個で低スコア完成」を実現するには、在庫の単位とは関係なく、Completion Gate の最低量（`minCount`）を理想量から切り離す変更が必要になる。** 例: 最低量 1 個（種類があれば完成）、理想量はお手本の個数のまま。これは Completion Gate と Human Feel（「ちゃんとしたピザでないと完成しない」）に関わるゲーム性の変更で、3-4C の範囲外。決める場合は別のタスクで Human Verification の対象になる（policy §2）。

---

## 3. 「1 pizza = 1 use」で失われる挙動・変わる挙動

1-use（#205 `PROGRESSION_USES_PER_PIZZA = 1`。1 枚に 1 個でも置けば、その具材を 1 use 消費する）を今のゲームに当てはめた場合:

| # | 挙動 | 今（個数） | 1-use | 評価 |
|---|---|---|---|---|
| L-1 | 多く載せたときの在庫のコスト | 置いた分だけ減る（4 個なら 4） | 何個でも 1 use | **失われる。** 多く載せても損をしなくなる。スコアの減点（約 2 点/個）だけが残る |
| L-2 | 在庫が途中で足りなくなる | ある（在庫 2 個で理想 3 の recipe は完成できない。#213 B2: その 2 個も FAILED で消える） | なくなる（1 use あれば何個でも置ける） | **変わる**（soft-lock と浪費がなくなるので、プレイヤーにはむしろ親切） |
| L-3 | 共有材料の recipe ごとの消費差 | ミートラバーズはペパロニ 1 個、ペパロニピザは 4 個 | どちらも 1 use | **失われる。** 少しだけ使う recipe が相対的に高くつく |
| L-4 | 具材の種類が多い recipe のコスト | meat-lovers は bacon 2 + ham 1 + pepperoni 1 + sausage 2 = 6 個 | 4 use | 数え方が変わる |
| L-5 | FAILED のピザ | 置いた個数だけ減る | 置いた種類ごとに 1 use | 1 個だけ置いて失敗しても 1 枚分減る |
| L-6 | 理想量より少なく載せて在庫を節約する | 今はそもそも完成しない | 節約にならない（1 use は同じ） | **owner の想定（少なく載せて低スコア完成）を採る場合、1-use ではこの選択に在庫面の意味がなくなる** |
| L-7 | スコアでの腕前の表現（個数と配置） | Pieces で評価 | **変わらない**（スコアは在庫を見ない） | 維持される |
| L-8 | 既存 save | そのまま | 変換が必要（`ceil(個数 / k)`） | 移行のリスクが生まれる（本書初版 §2） |

**まとめ:** 1-use 化で、スコアとしての腕前の表現は失われない。失われるのは「在庫の使い方」という経済的な腕前（多すぎれば損、少なく載せれば節約）と、recipe ごとの消費量の差。一方で、#213 が見つけた「在庫が中途半端に残って作れない」状態は、1-use ではなくなる。

---

## 4. inventory 方式の再比較（M1 は初版で除外済み。rollback で壊れるため）

### 4.1 定義

| | 保存（`inventory` の値） | 1 枚焼いたときの消費 | 置ける個数 | 購入・補充 | migration |
|---|---|---|---|---|---|
| **M2** | 新しい key `stockUses`（use）+ 旧 `inventory` に `use × k` 個を書き続ける | 置いた種類ごとに 1 use | 1 use あれば何個でも | +10 use | 必要（材料ごとの突き合わせあり。初版 §2.3） |
| **M3** | 旧 `inventory` に個数（常に `use × k`）。読むときに `ceil(個数/k)` で use に | 置いた種類ごとに 1 use（= k 個） | 1 use あれば何個でも | +10 use（= 10k 個） | 不要（読み込み時の換算だけ） |
| **M4** | 旧 `inventory` に個数（今のまま） | **置いた個数**（今の EP2 のまま） | 残りの個数まで（今の Stock Gate のまま） | **個数で**（例: 10k 個 = 一番多く使う recipe の 10 枚分） | **不要** |

k = その具材の「1 枚あたりの最大 minCount」（初版 §2.1 の凍結表: pepperoni/onion 4、mushroom/sausage/bacon/garlic/cherry-tomato/anchovy/tuna/rosemary 3、oregano/gorgonzola/parmigiano/fontina/black-olive 2、egg/ham/olive-oil/pesto 1）。

**重要: M3 と M4 は保存形式が同じ（個数）。** 違いは「焼いたときに何個減らすか」と「何個置けるか」という、ゲームのルールだけ。だから M3 か M4 を選んでおけば、あとでもう一方に変えても save の migration は要らない（ルールを差し替えるだけ）。M2 だけが保存形式を変えるので、あとで戻すには逆向きの migration が要る。

### 4.2 比較表

| 観点 | M2（use を新 key に） | M3（個数で保存、use で遊ぶ） | **M4（個数で保存、個数で遊ぶ）** |
|---|---|---|---|
| 今のゲームとの整合 | 消費のルールが変わる（§3 の L-1〜L-6） | 同左 | **今と同じ**（EP2 の消費と EP3 の Stock Gate をそのまま使う） |
| skill expression | スコアは維持。在庫面は失われる | 同左 | **スコアも在庫面も維持**。owner が「少なく載せて低スコア完成」を採る場合は、在庫の節約という選択肢も生まれる |
| existing save | 変換が 1 回（`stockUses` を作って書き込む） | 読み込み時に換算するだけ。書き込みなし | **何もしない** |
| rollback / roll-forward | 突き合わせのルールがあれば安全（初版のモデルで不一致 0/2000） | 安全（同 0/2000） | **安全**（どの build も同じ単位と同じルール。変換がないので二重変換もない） |
| #206 forward compatibility | `stockUses` を 4 か所に登録し、未知 id を保持（#211 F-3/F-4） | 追加の登録は不要 | **追加の登録は不要** |
| schemaVersion | 2 のまま | 2 のまま | 2 のまま |
| #205 への影響 | そのまま使える | そのまま使える（読み書きのときに換算する層を足す） | **use 単位の API（購入 +10 use、補充 +10 use、1 枚 1 use、`remainingPizzaUses`、`consumePizzaUse`）が合わない。** 使わないか、個数の単位に直す必要がある（§4.4） |
| #211 への影響 | §7 のまま（突き合わせを追加） | §7.3 を M3 に差し替え | **P0-S1、§7、T-C8/T-C9 が不要になる。** §10 の 5（「1 片でも置けば 1 use」）、T-C6/T-C7、§12 の Human Replay 2 を今のルールに差し替える |
| #213 / 3-4F への影響 | seam の中身を use に差し替え（`requiredStockUnits = 1`） | 同左 | **seam は個数のまま（`requiredStockUnits = minCount`）。3-4C での差し替えが不要。** 在庫が中途半端に残る状態（B2）は残り、3-4F の pool が除外する |
| Shop の UX | 「○枚分」で表示・購入 | 同左 | 「○個」で表示・購入（今と同じ）。「何枚分」は recipe によって違う（ペパロニ 12 個 = ペパロニピザ 3 枚、ミートラバーズ 12 枚）ので、1 つの数では出せない |
| inventory の UI | 「○枚分」 | 同左 | 「○個」（今と同じ）。必要なら recipe を選んだときに「このピザならあと○枚」を出す（recipe ごとに計算） |
| テスト | migration、突き合わせ、#206 の登録、seam の差し替え | 換算の往復、k 表の snapshot、seam の差し替え | **最小。** 今の EP2/EP3 のテストがそのまま使える。代わりに購入量（個数）と、authority の経済との整合（§4.3）のテストが要る |
| 経済（authority の simulation） | そのまま（10 use/購入） | そのまま | 購入 = 10k 個なら、理想量どおりに置く限り 1 回の購入で**10 枚以上**焼ける（k は最大 minCount なので）。authority の simulation は下限として成り立つ。多く載せる人は早く減る |
| 実装の複雑さ | 高 | 中 | **低**（今のコードの在庫部分を変えない。購入量の定義だけ） |
| future cleanup | 旧 key の書き込みをいつやめるか | k 表は消せない | k 表は購入量の計算にだけ使う（凍結しなくても save は壊れない） |

### 4.3 M4 の仕様（M4 を選ぶ場合。採用はしない）

| 項目 | 仕様 |
|---|---|
| 正式な単位 | 具材の個数（spread は 1 回分 = 1）。今と同じ |
| 消費 | `CONFIRM_BAKE` で、置いた個数だけ減らす（EP2 の `consumePizzaInventory` のまま）。無限の starter は減らさない（判定は `initialOwned` に変える。#211 P0-S3） |
| Stock Gate | 残りの個数までしか置けない（EP3 のまま） |
| 購入（新規） | authority の「+10 use」を「+10 × k 個」と読み替える案が、数の上ではもっとも近い（一番多く使う recipe で 10 枚分）。価格は authority のまま |
| 補充 | authority の「半額で +10 use」を「半額で +10 × k 個」と読み替える。今の `restockQuantity`（3 枚分）は Progression 2.0 で置き換わる |
| Lunch Rush の「作れる」 | discovered ∧ 全材料 OWNED ∧ 有限の具材ごとに `在庫 ≥ 完成に必要な最低量`（今は `minCount`）。#213 の seam そのまま |
| save | 変更なし。migration なし。新しい key なし |

### 4.4 Lunch Rush / #213 の「作れる」の定義の再検討

3 つの量を分けて考える:

| 量 | 今の値 | 使いみち |
|---|---|---|
| 完成に必要な最低量 | `minCount` | Completion Gate |
| 高スコアのための理想量 | お手本の個数（今は `minCount` と同じ） | Scoring 2.0 の Pieces |
| 実際に使った量 | 置いた個数 | 在庫の消費 |

**mission pool の「作れる」は「完成に必要な最低量の在庫があるか」で決めるべき**（理想量でも「1 use」でもない）。理由: 最低量があれば、プレイヤーは完成させられる（スコアは腕次第）。最低量がなければ、どう置いても FAILED になるので、注文すると soft-lock になる。

| 方式 × ゲーム性 | 「作れる」の条件（有限の具材ごと） |
|---|---|
| M4 × 今のゲーム（最低量 = 理想量） | 在庫 ≥ `minCount` 個（#213 の今の seam と同じ） |
| M4 × owner の想定（最低量を理想量より下げる） | 在庫 ≥ 新しい最低量（例: 1 個）。理想 3 個の具材が 2 個しかなくても pool に入る |
| M2/M3 × どちらのゲーム性でも | 在庫 ≥ 1 use（1 use あれば何個でも置けるので、最低量は常に満たせる） |

**結論:** `remaining ≥ 1 use` が必要になるのは M2/M3 を選んだ場合だけ。M4 なら「最低量の個数」が正しい条件で、#213 の seam はそれをすでに表現できている。どちらの場合も、#213 の Option B（注文ごとに再評価）と zero-candidate の方針は変わらない。

---

## 5. #205 / #211 / #213 で修正が必要になる前提

| PR | M2 / M3 を選んだ場合 | M4 を選んだ場合 | owner が「少なく載せて低スコア完成」を採った場合（方式を問わず） |
|---|---|---|---|
| **#205**（3-4A） | 変更不要 | `PROGRESSION_PURCHASE_GRANT_USES` / `PROGRESSION_REFILL_USES`（10 use）、`PROGRESSION_USES_PER_PIZZA`（1）、`remainingPizzaUses`、`consumePizzaUse`、それらのテストが個数の単位と合わない。**merge 前に #205 を直すか、3-4C でこれらを使わず、購入・補充の量を個数で定義し直す**。gate、価格、状態遷移（LOCKED→AVAILABLE→OWNED）、⭐ の式はそのまま使える | 影響なし |
| **#211**（3-4C preflight） | M2: §7.3 に突き合わせのルールを追加（初版 §2.3）。M3: §7.3 を差し替え | P0-S1 と §7（migration）、T-C8/T-C9（migration と dual-write）が**不要**。§10 の 5 と 6、T-C6/T-C7、§11.2 の新規 spec（「在庫が 1 減る」→「置いた個数だけ減る」）、§12 の Human Replay 2 を今のルールに合わせる。#206 e2e の書き込み契機（§6.2）は購入にする。P0-S2（ledger）と P0-S3（`initialOwned`）はそのまま必要 | Completion Gate の変更は 3-4C の範囲外（別タスク） |
| **#213**（3-4F） | §2 のとおり（3-4C の後、seam は 1 use） | seam は個数のまま。「3-4C の後は use」という記述（§2、§8）が不要になる。B2（在庫が最低量に足りない）は実際に起きる状態として残り、pool が除外する | seam の `requiredStockUnits` を「新しい最低量」にする。B2 の多くは作れる側に移る |
| **#209**（OD-03） | 影響なし（A に決定） | 影響なし | 影響なし |

---

## 6. owner に回答してほしい質問（2 問）

**Q1. 理想 3 個の具材を 2 個だけ載せたピザは、「完成（スコアは低め）」にしますか？ それとも今と同じく「失敗（スコアなし・報酬なし・図鑑に登録されない）」のままにしますか？**

- **今の実際の挙動:** 15 種類すべてで「理想の個数 = 完成に必要な最低の個数」。だから 2 個では**失敗**になる（例: キノコ 3 個のフンギを 2 個で焼くと「キノコが足りない」で失敗）。理想より多い 4 個なら完成し、1 個多いごとに 100 点中 約 2 点下がる
- (a) **今のまま**: 足りなければ失敗。多すぎれば少し減点
- (b) **変える**: 1 個でも載っていれば完成。理想の個数との差はスコアで評価する（少なくても多くても減点）。ゲームの判定の変更なので、3-4C とは別のタスクで行い、Human Verification の対象になる

**Q2. 具材の在庫は、「実際に載せた個数だけ減る」今の仕組みのままにしますか？ それとも「ピザ 1 枚につき 1 枚分減る（何個載せても同じ）」に変えますか？**

- (a) **載せた個数だけ減る（今のまま）**: ペパロニを 6 個載せれば 6 個減る。多く載せると在庫もスコアも損をする。ミートラバーズ（ペパロニ 1 個）とペパロニピザ（4 個）で減り方が違う。在庫が中途半端に残ると（キノコ 2 個など）、足りない recipe は Lunch Rush の注文から外れる。Shop は「○個」で買う。セーブデータの変換はない
- (b) **1 枚につき 1 枚分**: 何個載せても 1 枚分しか減らない。多く載せてもスコアが少し下がるだけ。在庫は「○枚分」で表示され、中途半端な残りは起きない。既存プレイヤーの在庫は「一番多く使うピザで何枚焼けるか」に換算する（例: ペパロニ 12 個 → 3 枚分）
- 補足: Q1 で (b) を選ぶ場合、(a) なら「少なく載せて在庫を節約する（スコアは下がる）」という選択肢が生まれる。(b) では節約にならない

（技術名との対応: Q2 の (a) = M4、(b) = M3（保存は個数のまま）。M2 は (b) と同じ遊び方で保存形式だけが違い、利点が少ないので質問からは外した。M3 と M4 は保存形式が同じなので、あとで変えても save の変換は要らない）

---

## 7. 3-4C Go/No-Go（Rev.2）

**No-Go。**

| # | 条件 | 状態 |
|---|---|---|
| 1 | OD-03 が決まっている | ✅ **Option A**（2026-09-23、owner） |
| 2 | 再ロックの方針 | ✅ 起きない設計（A の固定 gate）。entitlement は不要 |
| 3 | 在庫の単位と消費のルール（Q2） | ❌ 未回答 |
| 4 | 完成の最低量（Q1） | ❌ 未回答。ただし (b) は 3-4C の範囲外なので、**3-4C の開始を止めるのは Q2 だけ**。Q1 は Q2 の判断材料と、#213 の seam の値に関わる |
| 5 | Q2 が (a)（M4）の場合、#205 の use 単位の API をどう扱うか（直すか、使わないか） | ❌ Q2 次第 |
| 6 | #205 / #206 が最新の main で CI green（sharded WebKit を含む）になり、merge されている | ❌ OPEN |
| 7 | #206 が 3-4C より先に production に deploy されている | ❌（M4 では在庫の rollback 安全性に関係しないが、P0-S2 の ledger と未知 id の保持のために引き続き必要） |
| 8 | 3-4E の案内を 3-4C と同時に出す範囲（#211 G-2） | ⏳ 3-4C の Issue で決める（最小案: Pizza Select に「今は作れない」） |
| 9 | #211 §10 の OD-03 に依存しない仕様（ledger の saturation、`initialOwned` での有限判定、`schemaVersion` 2、gate の読み取りを 1 関数に） | ⏳ #211 で提案済み |

Q2 に回答があれば、残りは #205 の扱いの確定（M4 の場合）、#205/#206 の merge、#206 の deploy になる。

---

## 付録 A. 初版（Rev.1）からの変更

- §1: A/B/C1/C2 の比較表と参考案（R1/R1'/R2）を、「Option A に決定」とその帰結に置き換えた。比較は #209 と本書の git 履歴に残っている
- §2: 新設（現在の runtime の事実）
- §3: 新設（1-use 化で変わる挙動）
- §4: M4 を追加。初版の M2 の突き合わせルールと rollback のモデル（M1 1982/2000、M2 0、M2 marker だけ 994/997、M3 0）は結論として引き続き有効。M1 は初版どおり除外
- §6: 質問を 4 問から 2 問にした。OD-03 の質問は決定済みなので削除した

## 付録 B. スコープと検証

- 変更したファイル: 本レポートと JSON だけ（docs-only）
- §2.3 の測定: 一時的な vitest ファイルで `computeScoringV2`、`evaluatePizzaCompletion`、`consumePizzaInventory` を production のデータで呼んだ。ファイルは削除した（commit していない）
- §2.1 の表: `src/data/recipes.ts` の `minCount` と `src/data/referencePizza.ts` の `positions` を突き合わせた（ずれは 0 件）
- UI/UX/gameplay は変更していないので、Human Verification policy の対象外
