# Progression 2.0 Phase 3-4C — Decision Gate（OD-03 / inventory migration）

- 作成日: 2026-09-23
- 監査対象 `origin/main`: **`dff233c042d2df6ee1c3a92f2d2419830aa05460`**（PR #210 の merge）
- Branch: `claude/teto-pizza-p3-4c-decision-foc6x9`（docs-only）
- Machine-readable: `docs/reports/data/PROGRESSION-2.0_P3-4C_DECISION-GATE.json`
- 参照（すべて読んだだけ。push、merge、rebase はしていない）:

| PR / Issue | 状態（作業開始時） | head | 本書での使い方 |
|---|---|---|---|
| #205 Phase 3-4A | OPEN・未マージ | `9035606` | `progressionEconomy.ts` の use 単位の API |
| #206 Phase 3-4B | OPEN・未マージ | `4c1da87` | `writeSave` の forward-compat（未知の top-level key と未知 id の保持） |
| #209 OD-03 Decision Brief | OPEN・未マージ | `d719f1d` | A/B/C1/C2 の数値（§3〜§9）をそのまま再利用 |
| #211 3-4C Integration Preflight | OPEN・未マージ | `27e0916` | P0-S1（在庫の単位）、§7 の変換表、§13 の rollback 表 |
| #213 3-4F Fresh Audit | OPEN・未マージ | `7ccf5df` | 在庫を mission pool の判定に使う将来仕様（`requiredStockUnits` seam） |
| Issue #212 | OPEN | — | 3-4F の親 Issue |

> **本書は何も決定しない。** OD-03 の Option は採用しない。新しい Option も採用しない。
> runtime（`src/**`、`e2e/**`、`.github/**`）は変更していない。3-4C には着手していない。
> 新しい Fresh Audit はしていない（#209/#211/#213 の数値を再利用した）。CI と WebKit は実行していない。
> 追加で行ったのは、Decision 2 の rollback 挙動を確かめる使い捨ての Python モデル（scratchpad のみ。commit していない）だけ。

---

## 0. 結論（1 画面）

| | 内容 |
|---|---|
| Decision 1（OD-03） | 既存の A / B / C1 / C2 のうち、**「15 種類すべて発見可能」と「一度買える状態になった材料を将来ロックに戻さない」を同時に満たすものはない**（§1.2）。両方を求めるなら、既存 Option に何かを足した派生案が要る（参考: B + persisted entitlement。§1.3。採用はしない） |
| Decision 2（在庫 migration） | M1（同じ key の意味を変える）は rollback で**単位が混ざり、二重変換が起きる**ので不適。M2（新しい key + 旧 key の互換書き込み）は、#211 の「key があれば変換済み」という marker だけでは**#206 入り build に rollback したときに、その間の購入・補充を失う**（§2.3）。M3（旧 key を「k 個 = 1 枚分」の固定倍率で使い続ける。新しい key なし）は、同じ保証をより少ない仕組みで満たす（§2.4） |
| Cross-check | 3-4C の構造が変わるのは「新しい永続 key が何個増えるか（0〜2）」「load 時に書き込みが起きるか」「gate 判定が save の状態を読むか」の 3 点だけ（§3）。3-4F の在庫つき pool 判定とは、どの組み合わせでも矛盾しない。ただし M1 だけは rollback 後に pool の判定が狂う |
| 3-4C Go/No-Go | **No-Go**（OD-03 と migration 方式が未決定。#205/#206 が未マージ、#206 が未 deploy） |

---

## 1. Decision 1: OD-03（⭐ 入荷ゲート）

数値はすべて PR #209 の §3〜§9 から。本書では再計算していない（§1.4 の「T1 で上がる gate の数」だけ #209 §3 の B / B' 列を数え直した）。

### 1.1 圧縮比較表

| 観点 | **A** 承認済みの値のまま | **B** 現在の 15 件で再計算 | **C1** 届かない 3 件だけ上書き | **C2** ★1–2 で届かない 7 件を上書き |
|---|---|---|---|---|
| 新規プレイヤーが 15 件すべて発見できるか | **できない**（★5 でも 13/15） | できる | ★4–5 ならできる。★1–3 はできない | できる |
| ★1–2 で発見できる数 | 10/15（20⭐ で停止。次は garlic/parmigiano ⭐28） | 15/15 | 11/15（22⭐ で停止。garlic/parmigiano ⭐28） | 15/15 |
| ★3 で発見できる数 | 11/15（33⭐ で停止。anchovy ⭐40） | 15/15 | 13/15（39⭐ で停止。anchovy ⭐40 まであと 1⭐） | 15/15 |
| ★5 で発見できる数 | 13/15（65⭐ が上限。cherry-tomato ⭐76） | 15/15（75⭐） | 15/15 | 15/15 |
| 誰も発見できない recipe | **genovese、quattro-formaggi**（hard lock。recipe が増えるまで） | なし | なし（★≤3 の skill lock は残る） | なし |
| 101 件（authority の全量）まで増えたとき | authority そのもの | authority の seq 順に追加すれば authority と完全一致 | 上書き 3 件を解除すれば一致 | 上書き 7 件を解除すれば一致 |
| 将来 recipe を追加したときの gate の上昇 | **なし** | **毎回ある**。T1（+3 件）だけで 19 件中 16 件の gate が上がる（例: pepperoni 4→6、anchovy 14→18、cherry-tomato 16→20） | 上書きを解除したときだけ（cherry-tomato 16→76、fontina/gorgonzola 18→102） | 上書きを解除したときだけ（7 件。anchovy 14→40、cherry-tomato 16→76 など） |
| 「買える」になったが未購入の材料がロックに戻るか | **戻らない** | **戻りうる**（追加のたび） | 解除時に戻りうる | 解除時に戻りうる |
| 購入済み（OWNED）の材料 | 永続（全 Option 共通） | 同左 | 同左 | 同左 |
| 既存 save との差 | **あり**。既存 save は EP4 で cherry-tomato/fontina/gorgonzola を持っているので Genovese/Quattro Formaggi を作れる。新規プレイヤーは作れない | なし | なし | なし |
| 既存 save の再ロック（3-4C の切り替え時） | なし（⭐ = Σmax(2,BEST) ≥ ΣBEST） | なし | なし | なし |
| 承認済み（PR #196）の値の変更 | なし | 16 件 | 3 件 | 7 件 |
| seq 順の gate の単調性 | 保たれる | 保たれる | 崩れる（Genovese が Marinara より先に開く） | 崩れる（tuna 18 → garlic 12） |
| 3-4E で必要になる案内 | **必須:**「今後のアップデートで追加」（hard lock 2 件）と「BEST を上げると次の材料が入荷」（★≤3 の skill lock） | 通常は「材料を買う / Pitz を貯める」だけ。**追加のたびに**「入荷条件が変わりました」の説明が要る（再ロックを許す場合） | 「BEST を上げると次の材料が入荷」（★≤3）。解除時の説明 | B と同じ。解除時の説明 |

### 1.2 「15 件すべて到達可能」かつ「一度到達した材料を将来ロックに戻さない」を同時に満たせるか

| Option | 15 件すべて到達可能 | 将来ロックに戻さない | 両方 |
|---|:---:|:---:|:---:|
| A | ✗（hard lock 2 件） | ✓ | **✗** |
| B | ✓ | ✗（追加のたびに gate が上がる） | **✗** |
| C1 | ✗（★1–3 では 11〜13 件） | ✗（解除時） | **✗** |
| C2 | ✓ | ✗（解除時） | **✗** |

**結論: 既存の A/B/C だけでは満たせない。**
C2 は「上書きを永久に解除しない」とすれば満たせるが、それは「暫定の上書き」という C2 の定義から外れ、authority との永久的なずれになる。つまり別の案であり、既存の C2 とは言えない。

### 1.3 参考案（既存 Option とは別。採用判断はしない）

| 参考案 | 中身 | 満たすか | 代償 |
|---|---|---|---|
| **R1: B + persisted entitlement** | 材料が一度でも「買える」（⭐ ≥ gate）になったら、その材料 id を save の新しい top-level key（例: `reachedIngredientIds`）に記録する。状態は OWNED ＞ 記録済みなら AVAILABLE ＞ ⭐ ≥ gate なら AVAILABLE ＞ それ以外は LOCKED | ✓ / ✓ | 新しい永続 key が 1 つ増える（#206 の `KNOWN_SAVE_KEYS`、sanitizer、既定値、未知 id の保持の 4 か所に登録。#211 F-3/F-4）。3-4C の切り替え時に既存 save を backfill（その時点の gate で届く材料をすべて記録）。gate 判定が「⭐ だけの純関数」から「⭐ と save の状態」になる。#206 より前の build に rollback すると key が消えるので、その間に gate が上がると再ロックが起きうる（#206 を先に deploy すれば回避できる） |
| R1': C2 + persisted entitlement | 同じ仕組みを C2 に足す。解除しても記録済みの材料はロックに戻らない | ✓ / ✓ | R1 と同じ。加えて上書き 7 件の管理 |
| R2: B + gate の ratchet（save を変えない） | build 時の gate 表を「過去に出荷した値より上げない」（新しい値 = min(前の値, 式の値)）にする | ✓ / ✓ | save は変わらないが、gate が上がらないので **101 件になっても authority に収束しない**（永久にずれる）。表の履歴を repo で管理する必要がある |

### 1.4 補足: B の gate が T1 で上がる件数

#209 §3 の B（15 件）と B'（T1 の 3 件を足した 18 件）を比べると、19 件中 **16 件**で gate が上がる（上がらないのは egg/bacon/onion の 3 件だけ）。#209 §6 は例として 4 件だけを挙げていたので、ここで件数を明記する。

---

## 2. Decision 2: inventory migration（片数 → 1 枚分 = use）

### 2.1 前提（#211 §7 を再利用）

- 今の `inventory` は**片数**（scatter）と**1 枚 = 1**（spread）が混ざった単位。3-4C で「1 枚 = 1 use」に統一する（#205 `PROGRESSION_USES_PER_PIZZA = 1`、購入・補充は +10 use）
- 変換の倍率 k = その材料の「1 枚あたりの最大 minCount」（#211 の M-max）。`src/data/recipes.ts` と照合した値:

| k | 材料 |
|---:|---|
| 4 | pepperoni、onion |
| 3 | mushroom、sausage、bacon、garlic、cherry-tomato、anchovy、tuna、rosemary |
| 2 | oregano、gorgonzola、parmigiano、fontina、black-olive |
| 1 | egg、ham、olive-oil（spread）、pesto（spread） |
| — | tomato-sauce、mozzarella、basil（無限の starter。変換しない） |

- **k は 3-4C の時点で定数表として凍結する**（`RECIPES` から毎回計算しない）。後で recipe が増えて「最大 minCount」が変わっても、保存済みの値の意味が変わらないようにするため。凍結しないと、k が変わった瞬間に全 save で実質的な二重変換が起きる
- 現在の production は #206 **より前**の build。#206 より前の build は、未知の top-level key を書き込み時に**消す**。#206 入りの build は**保持するが更新しない**

### 2.2 比較表

| 観点 | **M1** 既存 `inventory` の意味を use に変える（in-place） | **M2** 新しい key（例: `stockUses`）を追加し、旧 `inventory` を互換用に書き続ける | **M3** 旧 `inventory` を「k 個 = 1 use」の固定倍率で使い続ける（新しい key なし） |
|---|---|---|---|
| existing save | load 時に 1 回だけ `ceil(片数/k)` に書き換え、marker（例: `inventoryUnit: "use"`）を付ける | load 時に `stockUses = ceil(片数/k)` を作り、1 回だけ書き込む | **変換の書き込みはない。** load のたびに `use = ceil(片数/k)` で GameState に読み込む。次の書き込みで `inventory = use × k` になる |
| new save | `inventory: {}` + marker | `stockUses: {}` + `inventory: {}` | `inventory: {}` |
| migration の冪等性 | marker に依存する。marker が消えると再変換 | §2.3 のルールがあれば冪等。marker（key の有無）だけでは不十分 | 変換を保存しないので常に冪等（`ceil(use×k / k) = use`） |
| rollback（3-4C を revert） | **壊れる。** 古い build が use を片数として読む（pepperoni 3 use → 3 片。pepperoni pizza は 4 片必要なので 0 枚） | 古い build は `inventory`（= use × k 片）をそのまま使える | 古い build は `inventory` をそのまま使える（1 use = 最も多く使う recipe 1 枚分の片数） |
| roll-forward（再 upgrade） | #206 より前の build が marker を消す → **二重変換**（3 use → ceil(3/4) = 1）。#206 入りの build は marker を残したまま片数を書く → **片数を use として読む**（単位の混在） | §2.3 のルールがあれば、rollback 中の消費・購入・補充をすべて反映して正しく戻る | rollback 中の消費・購入・補充をすべて反映して正しく戻る（`ceil(残りの片数/k)`） |
| double conversion | **起きる**（上記） | 起きない（§2.3） | 起きない（変換を保存しないので構造上ありえない）。ただし k の凍結が条件 |
| #206 forward compatibility | marker は未知の top-level key と同じ扱い（#206 入りなら保持される）。値は `inventory` の既存の保持ルールで保持 | `stockUses` を `KNOWN_SAVE_KEYS`、sanitizer、既定値、未知 id の保持の 4 か所に登録する必要がある（#211 F-3/F-4）。忘れると load で失われる | **追加の登録は不要。** `inventory` の未知 id の保持は #206 に既にある |
| schemaVersion | 2 のまま（上げると古い build で save 全体が既定値に戻る。#211 F-5） | 2 のまま | 2 のまま |
| storage size | 変わらない（+ marker） | 在庫の map がもう 1 つ（有限 19 件で数百 byte） | 変わらない |
| implementation complexity | 低いが、正しくするには rollback 対策が別途必要で、結局高くつく | 中〜高: load 時の突き合わせ（§2.3）、二重書き込み、4 か所の登録、1 回だけの書き込み（#211 F-8） | 低: 読み込み時の `ceil(片数/k)` と書き込み時の `use × k` の 2 関数と、凍結した k 表 |
| testability | rollback の組み合わせが多く、テストしにくい | 純関数でテストできるが、「#206 あり / なしの古い build が書いた save」の fixture が必要 | 純関数 2 つと往復のテストで済む。古い build が書いた save も同じ 2 関数で読める |
| future cleanup | — | rollback の保証期間が終わったら `inventory` の書き込みをやめ、`stockUses` を唯一の key にする | 保存形式が「k 倍の片数」のまま残る。やめたくなった時点で M2 相当の移行（1 回）をする。k 表は削除できない |
| 3-4C の #206 e2e（§6.2 of #211）の書き込み契機 | migration の書き込み | migration の書き込み | load では書き込まないので、**Shop での購入を契機にする** |

**使い捨てモデルでの確認**（scratchpad。commit していない）: 有限 19 件の在庫をランダムに 2000 通り作り、「3-4C の build で読み書き → 古い build（#206 あり / なし）で片数を消費 → 再 upgrade」を行って、期待値（`ceil(残りの片数/k)`）と比べた。

| 方式 | 不一致 |
|---|---|
| M1（marker つき in-place） | 1982 / 2000 |
| M2（§2.3 のルールあり） | 0 / 2000 |
| M2（#211 の「key があれば変換済み」だけ） | #206 より前の build: 0 / 1003。**#206 入りの build: 994 / 997** |
| M3 | 0 / 2000 |

### 2.3 M2 の仕様（M2 を選ぶ場合）

| 項目 | 仕様 |
|---|---|
| **migration marker は必要か** | **独立した marker は不要。** ただし「`stockUses` があれば変換済み」だけでは足りない。#206 入りの古い build は `stockUses` を**保持するが更新しない**ので、rollback 中に `inventory` だけが変わり、再 upgrade で古い `stockUses` が勝つ。rollback 中の消費は無視され（プレイヤーに有利）、**購入と補充は失われる**（プレイヤーに不利。Pitz を払ったのに在庫が戻る）。#211 §7.3/§13 は前者だけを想定していた |
| 突き合わせのルール | load 時に材料ごとに `inventory[id] === stockUses[id] × k` を確かめる。一致すれば `stockUses[id]` を使う。**一致しなければ、古い build が書いたと見なして `ceil(inventory[id] / k)` を使う**（その材料だけ legacy が勝つ）。`stockUses` がなければ全材料を legacy から変換する |
| source of truth | 通常は `stockUses`。上のルールで不一致の材料だけ `inventory` |
| old piece key をいつまで更新するか | 3-4C の build を含め、**rollback を保証する期間中はすべての書き込みで** `inventory[id] = use × k` を書く。終わりの条件の例: 「EP 系（3-4C より前）の build に戻す可能性がなくなったと owner が判断した時点」。それまでは書き込みをやめない |
| rollback した旧 build が書き込んだ後の再 upgrade | #206 より前の build: `stockUses` が消える → 全材料を `inventory` から変換。#206 入りの build: `stockUses` は残るが、変わった材料だけ突き合わせで `inventory` が勝つ |
| `ceil(pieceCount / maxMinCount)` 変換 | k は §2.1 の凍結表。`ceil` なので 1 片でもあれば 1 use（端数はプレイヤーに有利に丸める。最大 k−1 片分）。EP4 の grant（`minCount × 10`、共有材料は最大値）はちょうど 10 use に戻る |
| owned だが piece inventory なし | key がない、または 0 → **0 use**（OWNED のまま。補充を案内）。無料で在庫を足さない（R-03） |
| 無限の starter 3 件 | `stockUses` にも `inventory` にも書かない。既存の save に値があっても読まない（#206 の保持ルールにより書き込み時は残る） |
| unknown future ingredient IDs | k がわからないので**変換しない**。`inventory` と `stockUses` の両方で、#206 と同じ「形式が正しい未知 id と非負整数の値」を保持する（#211 F-4）。その材料を知っている将来の build が、自分の k 表で扱う |
| 書き込みの回数 | 変換や突き合わせで値が変わったときだけ 1 回書く。差がなければ書かない（#206 の「mount だけでは書き込まない」テストを守る。#211 F-8） |

### 2.4 M3 の仕様（M3 を選ぶ場合）

| 項目 | 仕様 |
|---|---|
| 保存形式 | `inventory[id]` = 片数（今と同じ key、同じ意味）。3-4C の build は常に `use × k` を書く |
| GameState | load 時に `use = ceil(inventory[id] / k)` に変換して持つ。3-4A の `remainingPizzaUses` / `consumePizzaUse` と 3-4F の `requiredStockUnits` はすべて use 単位の GameState を読む |
| migration marker | **不要**（変換結果を保存しないので、何回読んでも同じ） |
| source of truth | `inventory` だけ |
| rollback / 再 upgrade | 古い build は片数をそのまま使う。再 upgrade は同じ式で読むだけ。端数は `ceil` なので、rollback 中に k 片未満だけ使った分はプレイヤーに有利に丸まる（1 材料あたり最大 1 use） |
| owned だが inventory なし / starter 3 件 / 未知 id | M2 と同じ（0 use、読まない、#206 の既存ルールで保持） |
| 制約 | k 表は**追加だけ**（既存の値を変えない）。3-4G 以降の新しい材料は、出荷時に k を決めて凍結する（例: 1）。古い build はその材料を知らないので影響しない |

### 2.5 どれを選んでも共通の条件（#211 §10、§13 を再確認）

- `schemaVersion` は 2 のまま
- EP4 の ledger（`starterGrantClaimedRecipeIds`）を全 shipped recipe で saturate する（P0-S2。rollback で無料 grant が起きないように）
- 「有限在庫かどうか」は `unlockCondition` ではなく `initialOwned` で判定する（P0-S3）
- **#206 を 3-4C より先に production に deploy する**（#211 G-4）。M1 は deploy しても直らない。M2/M3 は #206 がなくても安全（M3 は完全に、M2 は §2.3 のルールがあれば）

---

## 3. Cross-check: OD-03 × migration で 3-4C の実装構造が変わる箇所だけ

OD-03 と migration は大部分が独立している（gate は「買えるか」、migration は「何枚分残っているか」）。構造が変わるのは次の 3 点だけ。

| # | 変わる箇所 | A / B / C1 / C2 | R1 / R1'（entitlement つき参考案） | M1 | M2 | M3 |
|---|---|---|---|---|---|---|
| X-1 | **新しい永続 top-level key の数**（#206 の 4 か所への登録、未知 id の保持、rollback で消えるリスク） | 0 | +1（`reachedIngredientIds`） | +1（marker） | +1（`stockUses`） | 0 |
| X-2 | **load 時の書き込みの有無**（#211 F-8、#206 e2e の書き込み契機 §6.2） | なし | backfill で 1 回 | 変換で 1 回 | 変換・突き合わせで差があるときだけ | **なし**（e2e は購入を契機にする） |
| X-3 | **gate 判定の入力**（`effectiveIngredientGate` の形。#211 §5.2） | ⭐ だけの純関数（B は runtime の recipe 数も入力） | ⭐ + save の記録（純関数ではなくなる） | 影響なし | 影響なし | 影響なし |

組み合わせで見ると:

| 組み合わせ | 3-4C で増える永続 key | load 時の書き込み | 備考 |
|---|---:|---|---|
| A/B/C1/C2 × M3 | 0 | なし | 最小の構造。#206 の登録作業なし |
| A/B/C1/C2 × M2 | 1 | 差があるときだけ | |
| R1/R1' × M3 | 1 | backfill の 1 回 | |
| R1/R1' × M2 | 2 | 1 回（両方をまとめて） | hydration の順序: `loadSave → 在庫の変換・突き合わせ → entitlement の backfill → createInitialGameState`。1 回の `writeSave` にまとめる |
| 何か × M1 | 1〜2 | 1 回 | rollback で壊れるので、どの組み合わせでも不適 |

**上記以外（Shop の購入・補充、Stock Gate、CONFIRM_BAKE の消費、⭐ の式、Pitz、Lunch Rush の pool）は、OD-03 と migration のどの組み合わせでも同じ実装になる。**

### 3.1 3-4F（在庫を mission pool の判定に使う将来仕様）との整合

#213 §2 と §8 の仕様: `isRecipeMakeable = discovered ∧ 必要な材料がすべて OWNED ∧ 有限の材料はそれぞれ remaining ≥ requiredStockUnits`。単位の差は `requiredStockUnits` / `remainingStockUnits` の seam に閉じ込め、3-4C の後は `requiredStockUnits = 1 use`。

| 確認項目 | 結果 |
|---|---|
| OD-03 が pool の判定に入るか | **入らない。** gate は「買えるか」だけを決める。pool は「発見済み ∧ OWNED ∧ 在庫あり」で、gate も entitlement も読まない。A の hard lock の材料は未発見なので、もともと pool に入らない |
| A の既存 save（hard lock の材料を EP4 で所有） | Genovese/Quattro Formaggi を発見済みで在庫があれば pool に入る。在庫が 0 なら 3-4F が除外する。補充（R10）はどの Option でもできる。矛盾なし |
| 0 件の pool（#213 E） | Margherita は無限の starter だけで作れるので、発見済みなら pool は 0 にならない。OD-03 の Option によって変わらない |
| M2 / M3 | GameState の在庫は use 単位の 1 つの map。3-4F の seam は `remaining = GameState.inventory[id]` になる。rollback 後も §2.3 / §2.4 の読み込みで正しい use に戻るので、pool の判定も正しい |
| M1 | rollback と再 upgrade で単位が混ざると、pool の判定が狂う（例: 片数 12 を use 12 と読み、作れない回数を作れると判定する、またはその逆）。**3-4F と組み合わせると誤判定が表に出る** |
| 3-4F を 3-4C より先に merge した場合 | seam は片数の単位（scatter は `minCount`）で動く。3-4C は seam の中身を use に差し替える。M3 なら差し替えは `ceil(片数/k) ≥ 1` と同じ意味になり、M2 なら `stockUses` を読む。どちらでも 3-4F のテストは単位の fixture を差し替えるだけ |

**結論: 3-4F の将来仕様と矛盾するのは M1 だけ。** OD-03 のどの Option とも矛盾しない。

---

## 4. 未解決のリスク

| ID | リスク | 影響する選択 | 状態 |
|---|---|---|---|
| U-1 | OD-03 が未決定。A/C1 なら 3-4E の案内を 3-4C と同時に出すかも未決定（#209 Q8） | Decision 1 | owner の回答待ち |
| U-2 | 「15 件すべて」と「再ロックしない」を両方求める場合、既存 Option では満たせない。参考案（R1/R1'/R2）はどれも新しい仕組みか authority からのずれを伴う | Decision 1 | owner の回答待ち |
| U-3 | #211 の M2 の marker（key の有無）だけでは、#206 入りの build に rollback すると購入・補充が失われる | Decision 2（M2） | 本書 §2.3 で突き合わせのルールを追加。M2 を選ぶなら 3-4C の必須テストにする |
| U-4 | k 表を凍結しないと、recipe 追加で k が変わり、実質的な二重変換が起きる | Decision 2（M2/M3） | 3-4C の必須テストにする（k 表の snapshot） |
| U-5 | #206 が未 deploy。#206 より前の build に rollback すると、新しい top-level key（`stockUses`、`reachedIngredientIds`）は消える | M2、R1/R1' | M3 + A/B/C は影響なし。それ以外は #206 の先行 deploy（#211 G-4）で緩和 |
| U-6 | `ceil` の端数で、rollback 中に 1 材料あたり最大 1 use がプレイヤーに有利に増える | M2/M3 | 許容範囲と判断（#211 §13 と同じ方向）。owner が不可とするなら `floor` だが、その場合 1〜k−1 片の在庫が 0 use になる |
| U-7 | #205/#206 の CI は古い base（`d6b6ef9`）で、sharded WebKit を通っていない | 3-4C 全体 | #211 G-3 のまま |
| U-8 | 本書の数値は #209（main `66abe43`）の再利用。`dff233c` までの差分は CI と #202 の mission pool で、recipe・材料・gate のデータは変わっていない（`src/data/recipes.ts` の minCount を本書で照合済み） | — | 確認済み |

---

## 5. owner に回答してほしい質問（最大 4 問）

**Q1. 今の 15 種類は、新規プレイヤーでも全部発見できるようにしますか？**
- (a) はい、★1〜2 しか取れない人でも 15 種類すべて発見できるようにする → B か C2（承認済みの入荷条件の数値を変更する）
- (b) ★4〜5 を取れる人なら全部、★3 以下は途中で「ベストを上げると次が入荷」で止まってよい → C1
- (c) いいえ、承認済みの数値を守る。ジェノベーゼとクアトロ・フォルマッジは、レシピが増えるまで新規プレイヤーは発見できない（既存プレイヤーは作れる）。代わりに「今後追加予定」の案内を出す → A

**Q2.（Q1 で (a) の場合）入荷が早まるのは、後半の 7 材料だけにしますか？ 序盤の材料も含めて全体を早めますか？**
- 後半だけ: ペパロニやマッシュルームなどの序盤は今の承認値のまま（例: ペパロニは ⭐6）。ガーリック、アンチョビ、ローズマリーなどの 7 材料だけ早く入荷する → C2
- 全体: 序盤から入荷が早くなる（例: ペパロニ ⭐6 → ⭐4）。15 種類に合わせて全体のテンポをそろえる → B

**Q3. アップデートでレシピが増えたとき、一度「購入可能」になった材料が、未購入のまま「⭐不足で買えない」に戻ることを許しますか？**
- 許す: 追加のたびに入荷条件が上がることがある（B なら次の 3 件追加だけで 16 材料の条件が上がる）。そのとき「入荷条件が変わりました」と説明する
- 許さない: A を選ぶか、B/C2 に「一度買えるようになった材料は記録して、ずっと買えるままにする」仕組み（セーブデータの項目が 1 つ増える）を足す
- （購入済みの材料は、どの場合でもずっと使える）

**Q4. 在庫が「何個」から「何枚分」の表示に変わるとき、既存プレイヤーの在庫はどう保存しますか？**
- (a) 保存の中身は今の「個数」のまま残し、ゲームの中だけ「一番多く使うピザで何枚焼けるか」に換算する（例: ペパロニ 12 個 → 3 枚分。1 個でも残っていれば 1 枚分）。アップデートを取り消しても、元のゲームは同じ保存データでそのまま遊べる。セーブの項目は増えない → M3
- (b) 「何枚分」を新しい項目に保存し、元の「個数」も互換のために書き続ける。取り消し後に戻ったときは、どちらが新しいかを材料ごとに見比べて合わせる → M2
- （保存の中身をそのまま「何枚分」に書き換える方式 M1 は、取り消し時に在庫が減ったり二重に換算されたりするので、選択肢から外すことを提案する）

---

## 6. 3-4C Go/No-Go

**No-Go。**

| # | 条件 | 状態 |
|---|---|---|
| 1 | OD-03 の決定（Q1〜Q3）。R1/R1'/R2 のような派生案を採る場合はその定義も | ❌ 未回答 |
| 2 | 在庫 migration の方式（Q4）。M2 の場合は §2.3 の突き合わせルールを含む | ❌ 未回答 |
| 3 | #205 / #206 が最新の main で CI green（sharded WebKit を含む）になり、merge されている | ❌ OPEN |
| 4 | #206 が 3-4C より先に production に deploy されている | ❌ |
| 5 | #211 §10 の OD-03 に依存しない仕様（ledger の saturation、`initialOwned` での有限判定、`schemaVersion` 2、gate の読み取りを 1 関数に集約） | ⏳ #211 で提案済み。3-4C の着手時に確定 |

Q1〜Q4 に回答があれば、残りは #205/#206 の merge と #206 の deploy だけになる。

---

## 7. スコープと検証

- 変更したファイル: 本レポートと `docs/reports/data/PROGRESSION-2.0_P3-4C_DECISION-GATE.json` だけ（docs-only）
- UI/UX/gameplay は変更していないので、Human Verification policy の対象外
- CI / WebKit は実行していない（docs-only）
- #205/#206/#209/#211/#213 には push していない。merge も rebase もしていない
