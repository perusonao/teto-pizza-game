# Progression 2.0 — Save / Persistence Migration Fresh Audit（永久材料アンロック）

- **Audited main:** `dff233c042d2df6ee1c3a92f2d2419830aa05460`（"Dev CI Phase 2A … (#210)"）
- **目的:** 材料の永久アンロック状態（`unlockedForShopIngredientIds` 相当）を追加するとき、既存ユーザーの save を壊さずに移行する方法を設計する。
- **種別:** 監査のみ。`src/**`、save schema、#206、#217、その他の OPEN PR は**変更していない**。Owner Decision は**確定していない**（候補と推奨だけを書く）。Full E2E は実行していない。
- **機械可読版:** `docs/reports/data/TETO_PROGRESS2_SAVE-MIGRATION_MATRIX.json`（field ごとの persisted/derived・default・migration source・rollback・corruption、シナリオ表、P0、change-map）

### 読んだもの

| 対象 | 状態 | 使った箇所 |
|---|---|---|
| Issue #216 | OPEN | 5 状態の lifecycle、「解放料の権利は恒久・re-lock しない」、非⭐条件の候補 |
| PR #217 `a39932d` | OPEN（Codex review: 指摘なし） | `unlockedForShopIngredientIds` を恒久 entitlement 集合とする方針、#206 への要求（未知 field の保持） |
| PR #206 `4c1da87` | OPEN・未 merge（base `d6b6ef9`） | `writeSave` / `extractForwardCompatExtras` / `KNOWN_SAVE_KEYS` の差分を読んだ |
| `src/state/persistence.ts`（main） | — | schema v2 全体、load/write/reset の経路 |
| `src/state/inventory.ts`、`starterStock.ts`、`progression.ts`、`dex.ts`、`logic/economy.ts`、`data/ingredients.ts`、`data/recipes.ts`、`App.tsx` | — | 派生値と保存値の区別、mount 時の書き込み |
| 参考: #204 / #205 / #211 / #214（読んだだけ） | OPEN | #211 §6 の F-1〜F-8、P0-S2（ledger saturation）、#214 D-1「persisted entitlement 不要」、D-2（M4・migration なし） |

---

## 0. 結論（TL;DR）

1. **現行 schema:** localStorage の 1 key（`teto-pizza-save-v1`）に JSON 1 個。`schemaVersion: 2`。field は `dex`、`pitzBalance`、`ownedIngredientIds`、`missionBest`、`inventory`、`starterGrantClaimedRecipeIds` の 6 つ。材料の LOCKED/AVAILABLE_TO_BUY は**保存していない**（`ownedIngredientIds` と Dex から毎回導出）。
2. **「解放料を払った事実」は必ず永続化する。** 条件から再計算できない「出来事」（Pitz を払った）であり、しかも「恒久・re-lock しない」ことが要件だから。fee の curve が F0（0 Pitz）になっても、条件値の再調整で re-lock が起きないように、保存は必要。
3. **AVAILABLE_TO_UNLOCK は保存しない（導出する）。** ただし、条件が**保存済みの単調な事実**だけで書かれている場合に限る。⭐、発見数、特定 recipe の発見、特定 recipe の BEST、Dex 数は今の `dex` から導出できる。**累計 Pitz 獲得・Lunch Rush 累計 serve・（ORIGINAL を含む）累計完成枚数は今の save に存在しない**ので、条件に使うなら新しい単調カウンタを保存する必要がある（§4.3）。
4. **OWNED と UNLOCKED の関係:** `OWNED ⇒ UNLOCKED` を不変条件にする。既存 save の OWNED（EP4 grant で無料で得たもの 19 件を含む）は、解放料を払ったものとして扱う（grandfather）。在庫 0 でも OWNED のまま（REFILL の対象）。
5. **main の現状では、新しい field を足すと rollback で消える。** main の `loadSave` は未知の top-level key と未知の id を捨て、すべての書き込みがその結果を元に書く。EP4 の catch-up があると**起動するだけで**書き込みが起きる。→ **#206 を先に（別の deploy として）出すことが最大の P0**。
6. **`schemaVersion` は 2 のまま（bump しない）。** bump すると、#206 より前の build も #206 の build も root を認識できず、save 全体が既定値で上書きされる。
7. **P0 blocker は 7 件**（§9）。いちばん重いのは P0-1（#206 未 merge）と P0-7（#214 D-1「entitlement 不要」と #216 の有料解放の矛盾。3-state を先に出すと、既に AVAILABLE_TO_BUY だったユーザーが後退する）。

---

## 1. 実際の保存境界（調査項目 13）

| 保存先 | 中身 | 書く人 | Progression と関係 |
|---|---|---|---|
| `localStorage["teto-pizza-save-v1"]`（本番） | save JSON 1 個 | `persistence.ts` の `persistDex` / `persistProgress` / `persistMissionBest` の 3 経路。どれも `setItem` を 1 回だけ呼ぶ | **ある（唯一の永続先）** |
| `localStorage["teto-pizza-preview-save-v1"]` | 同じ形 | preview build（`VITE_PREVIEW_MODE`） | 同じ origin（`perusonao.github.io`）で本番の save と混ざらないようにするためのもの |
| Firebase Auth（SDK が IndexedDB 等に保持） | 匿名 uid | Firebase SDK | ない。Full Game Reset でも消えない（reset は save key だけを消す） |
| Firestore（server） | ranking、displayName | Cloud Functions | ない |
| メモリだけ（保存しない） | 進行中の round、Lunch Rush run、`lastPitzCredit` など | — | Lunch Rush の累計 serve は**どこにも残らない** |

- Service Worker・PWA cache は**ない**。配信は GitHub Pages（`deploy.yml`: main への push と `workflow_dispatch`）。rollback の手段は「古い commit を deploy し直す」か「revert を main に push する」。
- **deploy をまたいで開いたままのタブ**は古い JS のまま動き続け、書き込みもする。rollback をしなくても、deploy のたびに「新しい save を古いコードが書く」状況が起きる（§6 と P0-1 で重要）。
- localStorage の `setItem` は key 単位で atomic。1 key に 1 JSON なので、**途中まで書かれた save はアプリからは発生しない**。quota 超過などで `setItem` が throw すると、その書き込みはまるごと失われる（try/catch で握りつぶす）。memory 上の状態は進むが、storage は前の状態のまま＝整合は保たれる。

## 2. 現行 save schema / version（調査項目 1）

`SAVE_STORAGE_KEY = "teto-pizza-save-v1"`（key 名の "v1" は歴史的なもの。schema の version とは別）。`CURRENT_SCHEMA_VERSION = 2`。

| field | 型 | 既定値 | 読み込み時の検証（main） | 未知 id / 未知 key（main） |
|---|---|---|---|---|
| `schemaVersion` | `2`（v1 は migrate） | 2 | 1 → `migrateV1toV2`、2 → そのまま、それ以外 → **save 全体を既定値に** | — |
| `dex` | `DexEntry[]`（recipeId, discovered, bestScore 0–100, bestStars 1–5 の整数, timesMade ≥0 の整数） | `[]` | 配列でなければ**save 全体を既定値に**。要素ごとに検証、不正は捨てる、重複は先勝ち | 未知の recipeId は**捨てる** |
| `pitzBalance` | number | 0 | 有限かつ ≥0。それ以外は 0（**小数も通る**） | — |
| `ownedIngredientIds` | string[] | starter 3 件 | 既知の id だけ残す。starter 3 件を**必ず追加** | 未知 id は**捨てる** |
| `missionBest` | Record<missionId, int> | `{}` | key ごとに ≥0 の整数だけ残す | 未知の mission id は**残る**（key を検査しないため） |
| `inventory` | Record<ingredientId, int> | `{}` | 既知 かつ 非 starter かつ ≥0 の整数だけ | 未知 id は**捨てる**、starter id も捨てる |
| `starterGrantClaimedRecipeIds` | string[] | `[]` | 既知の recipe id だけ、重複は除く | 未知 id は**捨てる** |
| （その他の top-level key） | — | — | `sanitizeSave` が決まった key だけで object を作り直す | **捨てる** |

v1 → v2 の migration（`migrateV1toV2`）: 4 field をそのまま引き継ぎ、非 starter の OWNED には `inventory = 4` を付け、ledger は `[]`。

## 3. 保存されている Progression 関連の値と、導出される値（調査項目 2）

| 概念 | 保存 / 導出 | 出どころ |
|---|---|---|
| Dex の発見・BEST・timesMade | **保存** | `dex` |
| ⭐ 合計（`totalStars`、将来の `Σmax(2,BEST)`） | 導出 | `dex` の BEST |
| recipe の unlock（EP1 `recipeUnlocked`） | 導出 | `dex`（発見の連鎖と ⭐ 下限） |
| 材料の LOCKED / AVAILABLE_TO_BUY / OWNED（`ingredientState`） | 導出。ただし OWNED は保存 | `ownedIngredientIds` + ⭐ |
| recipe を作れるか（`isRecipeAvailable`） | 導出 | 上の 2 つの AND |
| 在庫 | **保存** | `inventory`（M4: 個数。#214 D-2 で「migration なし」と決定済み） |
| Pitz 残高 | **保存** | `pitzBalance` |
| Starter Grant 済みの recipe | **保存** | `starterGrantClaimedRecipeIds` |
| Mission BEST | **保存** | `missionBest` |
| 累計 Pitz 獲得 / 支払い履歴 | **どこにもない** | — |
| Lunch Rush 累計 serve | **どこにもない**（run はメモリだけ） | — |
| ORIGINAL（未一致）を含む累計完成枚数 | **どこにもない**。`timesMade` は「一致して PASS した round」だけを数える（`REGISTER_TO_DEX` は FAILED と未一致を登録しない） | — |

現在の材料データ: starter（`unlockCondition` なし・無限在庫）は `tomato-sauce`、`mozzarella`、`basil` の 3 件。有限の 19 件はすべて `starterGrantOnly: true`。つまり**今の本番では、材料を「最初に買う」ことはできない**。所有は EP4 の無料 grant だけで起き、Shop でできるのは補充だけ。→ 既存 save に「AVAILABLE_TO_BUY のまま買っていない」という状態の材料は存在しない（移行を考えるうえで有利）。

## 4. lifecycle のどの情報を永続化すべきか（本題）

```
LOCKED ──(条件達成)──▶ AVAILABLE_TO_UNLOCK ──(解放料を1回払う)──▶ AVAILABLE_TO_BUY ──(初回在庫を買う)──▶ OWNED ──▶ REFILL
```

### 4.1 状態ごとの判定

| 状態 | 保存するか | 判定式（提案） | 理由 |
|---|---|---|---|
| LOCKED | **導出** | `¬OWNED ∧ ¬UNLOCKED ∧ ¬eligible` | 何も起きていない状態。保存する情報がない |
| AVAILABLE_TO_UNLOCK | **導出**（条件つき、§4.2） | `¬OWNED ∧ ¬UNLOCKED ∧ eligible(保存済みの単調な事実)` | 条件が単調な保存済みの事実だけでできていれば、いつ計算しても同じ結果になる |
| AVAILABLE_TO_BUY | **保存（新規）** | `¬OWNED ∧ UNLOCKED` | 「解放料を払った」は出来事。条件からは再現できない（§4.4） |
| OWNED | **保存（既存）** | `id ∈ ownedIngredientIds`（starter は常に） | 既存のまま。永久・削除しない |
| 在庫 / REFILL | **保存（既存）** | `inventory[id]`（無い key は 0） | M4。OWNED ∧ 在庫 0 は正当な状態 = REFILL の対象 |

`UNLOCKED`（実効値）= `unlockedForShopIngredientIds ∪ (ownedIngredientIds ∖ starter)`。starter は常に OWNED なので、UNLOCKED かどうかは問題にならない。

### 4.2 「AVAILABLE_TO_UNLOCK」は条件から再計算できるか — **できる。ただし条件の種類による**

| #216 の非⭐条件の候補 | 今の save から導出できるか | 必要な保存 |
|---|---|---|
| ⭐（`totalStars` / `Σmax(2,BEST)`） | **できる**（`dex` の BEST。BEST は減らない） | なし |
| 発見した recipe の数 | **できる**（`dex[].discovered`） | なし |
| 特定の recipe を発見した | **できる** | なし |
| 特定の recipe の BEST に到達した | **できる**（`bestStars` / `bestScore`） | なし |
| Dex の到達数 | **できる** | なし |
| 累計完成枚数 | 定義が「一致して PASS した枚数」なら **できる**（`Σ timesMade`）。ORIGINAL/未一致を含めるなら**できない** | 含めるなら新しいカウンタ |
| Lunch Rush 累計 serve | **できない** | 新しいカウンタ `lifetimeLunchRushServes` |
| 累計 Pitz 獲得 | **できない**（残高しかない） | 新しいカウンタ `lifetimePitzEarned` |

**推奨:** AVAILABLE_TO_UNLOCK そのものは保存しない。条件は最初の段階では「`dex` から導出できるもの」だけにしておくと、新しい永続 field は entitlement の 1 つだけで済む。カウンタが必要な条件（下 3 行）は、OD216-2 でそれを選んだ場合にだけ追加する（§4.3）。

導出にする場合の注意（受け入れる前提として明記する）:
- **まだ払っていない**適格状態は、将来 build で条件値を上げたり ⭐ の式を変えたりすると LOCKED に戻り得る。#216 が禁止しているのは「払った権利の re-lock」なので、仕様違反ではない。ただし UX 上は「解放できる」表示が消える。これを避けたいなら、条件値を「後から上げない」運用ルールにするか（#214 D-1 と同じ考え方）、「一度適格になった」ことを保存する（`eligibleIngredientIds`）。**どちらにするかは Owner 判断の候補**（OD-SM-2）。本監査の推奨は「保存しない＋条件値は上げない運用」。
- NEW バッジ用の「見た」記録が欲しい場合は、**権威を持たない** UX 用の集合として別に持つ。gate の判定には使わない。

### 4.3 条件でカウンタを使う場合（OD216-2 次第）

| 候補 field | 型 | 既定値 | 既存 save の migration source | 性質 |
|---|---|---|---|---|
| `lifetimePitzEarned` | 非負整数 | 0 | **正確な値は復元できない。** 下限として `pitzBalance` を入れる（支払額の履歴がないため）。より大きい推定値（所有材料の価格の合計を足すなど）は、EP4 で無料取得した分を数えてしまうので使わない | 単調。書き込みは max-merge |
| `lifetimeLunchRushServes` | 非負整数 | 0 | 復元できない。0 から（`missionBest > 0` なら 1 以上にする程度の下限は可能） | 単調 |
| `lifetimeCompletedPizzas` | 非負整数 | 0 | 下限 `Σ dex[].timesMade` | 単調 |

- 既存プレイヤーが**本来より遅く**適格になることはあるが、払った権利を失うことはない。
- #206 より前の build に rollback すると、これらのカウンタは消える（P0-1）。未払いの AVAILABLE_TO_UNLOCK が LOCKED に戻る。
- カウンタを選ばなければ、この節の field はすべて不要。

### 4.4 「解放料を払った事実」は永久 entitlement として**必ず保存する**

理由:
1. **再計算できない。** 条件を満たしていることと、Pitz を払ったことは別。支払いは `pitzBalance` を減らすだけで、痕跡が残らない。
2. **恒久が要件。** 条件の値や ⭐ の式は、content が増えるたびに見直される可能性がある（#209/#214/#217 でも候補の段階）。導出だけで持つと、見直しのたびに「払ったのに LOCKED」が起き得る。
3. **fee の curve と無関係にする。** F0（0 Pitz）でも保存する。そうしておけば、後で F0 から F2 に変えても、既に解放した人を再課金しない。
4. **rollback で消えると二重課金になる。** entitlement が消えると、roll-forward したときに同じ材料が AVAILABLE_TO_UNLOCK に戻り、もう一度払わせることになる。

## 5. OWNED と UNLOCKED の違い、starter との関係（調査項目 6・8）

| | UNLOCKED（新） | OWNED（既存） | 在庫（既存） |
|---|---|---|---|
| 意味 | Shop で初回在庫を買う権利（解放料を払った） | 初回在庫を買った、または grant で得た | 残りの個数 |
| 増える契機 | `UNLOCK_INGREDIENT`（解放料） / grandfather | 初回購入 / EP4 grant（撤去予定） | 購入 / 補充 / grant |
| 減るか | **減らない** | **減らない** | 消費で減る。0 でも OWNED のまま |
| starter | 対象外（暗黙に UNLOCKED） | 常に OWNED（load 時に必ず追加） | 無限。`inventory` に key を持たない |

**不変条件（実装時にテストで固定する）:**

- **I-1** `OWNED ⇒ UNLOCKED`。導出は `effectiveUnlocked = persisted ∪ (owned ∖ starter)` で行う。OWNED なのに解放料を要求する表示や取引が起きてはならない。
- **I-2** UNLOCKED と OWNED は減らない（sanitizer が既知の正しい id を落とすことはない。catalog から消えた id は、#206 の保持で残る）。
- **I-3** starter 3 件は unlocked 集合に書かない。読み込んだら無視する（`sanitizeInventory` と同じく取り除く）。
- **I-4** 解放料の支払いと entitlement の追加は、reducer の 1 回の遷移で行い、`persistProgress` の 1 回の `setItem` で保存する。2 回目の dispatch は `ALREADY_UNLOCKED` で拒否し、課金しない。
- **I-5** 在庫 0 の OWNED は REFILL の対象であり、AVAILABLE_TO_BUY には戻らない（初回購入の価格を二度払わせない）。
- **I-6** `unlockedForShopIngredientIds` を load 時に書き戻すことはしない（grandfather は導出で行い、次の自然な書き込みのときに実体化してよい）。#206 の「load だけでは書き込まない」を守る。

## 6. `unlockedForShopIngredientIds` の形の候補（調査項目 7）

| 案 | 形 | 長所 | 短所 | 評価 |
|---|---|---|---|---|
| **A（推奨）** | top-level の `string[]`（材料 id の集合） | `ownedIngredientIds`・ledger と同じ形。#206 の `unknownIdsIn` の考え方をそのまま使える。重複除去・並び順非依存の比較（`sameStringSet`）も流用できる | 払った額や時刻は残らない | 採用候補 |
| B | `Record<id, { feePaid: number }>` | 監査・返金に使える | 値の検証と未知 id 保持を新しく書く必要がある。時刻を入れると決定性（テスト）が崩れる | 不要 |
| C | 1 つの状態 map `ingredientProgress: Record<id, "UNLOCKED"｜"OWNED">` に統合 | 状態が 1 か所 | 既存の `ownedIngredientIds` と二重管理になる。古い build は owned しか読めないので、rollback の整合を取るのが難しい | 不採用 |
| D | 新しい localStorage key に分ける | — | 1 key でないと、支払い（`pitzBalance`）と entitlement の書き込みが別々になり、途中で失敗すると不整合になる | **不採用（P0-5）** |

field 名 `unlockedForShopIngredientIds` は #216/#217 の仮称。名前の確定は実装時。

## 7. load のシナリオ（調査項目 5・9・11・12）

新しい build = 「#206 を含み、`unlockedForShopIngredientIds` を known key として読み書きする build」。

| # | 入力 | 新 build の結果 | 書き込み |
|---|---|---|---|
| L0 | save なし / Full Game Reset 後 | 既定値。`unlockedForShopIngredientIds: []`、OWNED = starter 3 件、Pitz 0 | mount では書かない |
| L1 | v1 save | `migrateV1toV2`（既存）→ entitlement は無いので `[]`。I-1 により、OWNED の非 starter はすべて UNLOCKED | 差分がなければ書かない |
| L2 | v2（EP4 より前。ledger なし） | 今と同じ（EP4 がまだあれば catch-up）。3-4C の後は #211 §8 E3 のとおり grant を払わず、ledger を saturate | 3-4C の規則に従う |
| L3 | v2（今の本番。EP4 で 19 件のうちいくつかを OWNED） | entitlement は `[]`。grant で得た OWNED はすべて grandfather（解放料なしで UNLOCKED）。在庫はそのまま（M4、変換なし） | 差分がなければ書かない |
| L4 | v2 + 3-4C の 3 状態 build で「⭐を満たして AVAILABLE_TO_BUY、まだ買っていない」 | **5 状態では AVAILABLE_TO_UNLOCK に後退する**（解放料を要求される）。→ P0-7。3-4C と同時に 5 状態を出すか、cutover で 1 回だけ grandfather する（その時点の AVAILABLE_TO_BUY を entitlement に入れ、marker を残す） | grandfather するなら 1 回だけ |
| L5 | v2 + 未知 id（#206 の extras） | 未知 id は gameplay に入らず、書き込みのときに保持 | — |
| L6 | v2 + 新しい field が不正（配列でない、など） | その field は `[]`。I-1 で OWNED 分は救われるが、**払ったが未購入の材料は失われる**（P1-2） | 次の書き込みで正規化 |
| L7 | v2 だが `dex` が配列でない / `schemaVersion` が未知 / JSON が壊れている | save 全体を既定値に（今と同じ）。次の書き込みで元のデータは上書きされる | 今と同じ |
| L8 | field がない（missing） | field ごとに既定値（§8 の表）。どれも「field がない＝何も起きていない」と読めば安全な向き | — |

**missing field の原則:** 新しく追加するどの field も「無い = 空 / 0 = 何も起きていない」と読めること。そう読んで安全でない field（たとえば「無い = 全部解放済み」）は作らない。

## 8. 新しい save を古い build が読んだ場合（調査項目 4・10）

| 古い build | 読み込み | 最初の書き込みで起きること | roll-forward した後 |
|---|---|---|---|
| **R1: 今の main `dff233c`（#206 なし）** | `schemaVersion 2` なので読める。新しい field と未知 id は memory から捨てる | **どの書き込みでも**（Dex 更新、補充、Pitz 報酬、そして**EP4 catch-up が起きれば起動しただけで**）`unlockedForShopIngredientIds`・新しいカウンタ・未知 id の Dex/OWNED/在庫/ledger が**消える** | 払ったが未購入の材料が AVAILABLE_TO_UNLOCK に戻り、**もう一度解放料を取られる**。OWNED のものは I-1 で救われる。→ **P0-1** |
| **R2: #206 を含む build（field を知らない）** | 同じく memory には入らない | `writeSave` が未知の top-level key を**そのまま**保持する。Pitz などの既知 field は古い build の値で更新される | entitlement は残る。古い build では解放料を払えないので、値が古くなることもない |
| **R3: 3-4C の 3 状態 build（#206 あり、entitlement なし）** | 同上 | 同上。加えて、この build では**解放料なしで**初回購入ができる | 買った材料は OWNED → I-1 で UNLOCKED になる。rollback 中だけの抜け道。プレイヤーに有利な方向なので、許容して記録する（P1-4） |
| **R4: EP4 がある build（ledger を saturate していない save）** | 同上 | load 時の catch-up が、unlock 済みの recipe の材料を**無料で OWNED にする** | I-1 と合わせると**解放料を払わずに恒久 UNLOCKED** になる。→ #211 P0-S2 の saturation はこの監査でも **P0**（P0-6） |
| **R5: 開いたままの古いタブ**（deploy より前に開いたもの） | その build の R1/R2/R3 と同じ | rollback をしなくても毎回起きる | #206 が**前の deploy で**入っていれば R2 になる。同じ deploy で入れると、deploy 前から開いているタブは R1 になる |

**forward compatibility の要約:** #206 がない build（R1）は、新しい field を 1 回の書き込みで消す。#206 がある build（R2）は、未知の top-level key をまるごと保持する。`schemaVersion` を 3 に上げると、R1 も R2 も save 全体を既定値で上書きする（`toIntermediateV2` が null を返す）ので、**bump は禁止**（P0-3）。

**rollback の下限（rollback floor）:** entitlement を出したあとに rollback してよい先は、「#206 を含む build」まで。それより古い SHA を `workflow_dispatch` で deploy したり、#206 を revert したりしてはいけない。

## 9. P0 blocker（migration）

| ID | 内容 | 放置した場合 | 必要な対応 |
|---|---|---|---|
| **P0-1** | **#206 が未 merge。** main はすべての書き込みで未知の top-level key と未知 id を捨てる。EP4 catch-up があると起動しただけで書き込む | rollback や古いタブで entitlement が消え、二重課金になる | #206 を merge し、entitlement を出す build **より前の deploy** で本番に出す。rollback floor を #206 の SHA にする |
| **P0-2** | entitlement の key を「知っている」build（T1）が、それより新しい材料の id（T2）を捨てる | T2 で払った解放料が T1 への rollback で消える | 新しい key を `KNOWN_SAVE_KEYS`・`sanitizeSave`・`createDefaultSave`・`ProgressionSnapshot` に**同時に**登録し、`extractForwardCompatExtras` に「集合の中の未知 id を保持する」処理を足す（#211 F-3/F-4 と同じ） |
| **P0-3** | `schemaVersion` の bump | 今のすべての build で save 全体が消える | 2 のまま。field の追加だけで行う |
| **P0-4** | 不変条件 `OWNED ⇒ UNLOCKED`（grandfather）がないと、既存 save の OWNED（EP4 grant の最大 19 件）が「OWNED なのに未解放」という矛盾状態になる | 既存ユーザーに解放料を請求する、または状態機械が壊れる | 導出で union を取る（I-1）。既存 save を変換する migration は不要 |
| **P0-5** | 解放料の支払いと entitlement の追加が別々の書き込みになる | 途中の失敗や二重 dispatch で、「払ったのに未解放」または二重課金 | 1 回の reducer 遷移、1 回の `setItem`、1 key（I-4）。別の key に分けない |
| **P0-6** | EP4 ledger を saturate しないまま EP4 を撤去する（#211 P0-S2） | EP4 build に rollback すると、無料 grant → I-1 で解放料を払わない恒久 UNLOCKED | 3-4C で ledger を saturate し、field を残す（#211 F-1/F-2） |
| **P0-7** | **#214 D-1「persisted entitlement 不要」と #216 の有料解放が矛盾している。** 3 状態（⭐ で AVAILABLE_TO_BUY）を先に本番に出し、あとで 5 状態にすると、既に AVAILABLE_TO_BUY だったユーザーが AVAILABLE_TO_UNLOCK に後退する | 利用者から見ると「一度買えた材料がまた買えなくなる」＝ re-lock | 5 状態を 3-4C と**同じ cutover**で出すか、段階的に出すなら cutover で 1 回だけ grandfather（marker つき）。**Owner 判断が必要（OD-SM-1）。本監査では決めない** |

### P1 / P2（blocker ではないが実装時に扱う）

| ID | 内容 | 推奨 |
|---|---|---|
| P1-1 | カウンタ条件（累計 Pitz・LR serve・ORIGINAL を含む完成枚数）は既存 save から正確に復元できない。#206 より前への rollback で消える | 最初は Dex から導出できる条件だけにする。使うなら下限で backfill し、max-merge で書く（§4.3） |
| P1-2 | `unlockedForShopIngredientIds` が壊れていると、払ったが未購入の材料の権利は復元できない | 要素ごとに検証し、1 つの不正で全体を捨てない。冗長化はしない（壊れた save は現状でも稀） |
| P1-3 | 複数タブ: 最後に書いたタブが勝つ（今もある問題）。#206 の build でも、古いタブの Pitz と OWNED の値で上書きされる。entitlement は extras として残るので、多くの場合プレイヤーに有利な方向にずれる | 今回のスコープ外。必要なら `storage` イベントでの再読み込み、または単調な集合（owned / unlocked / ledger）だけ union で書く |
| P1-4 | 3-4C の 3 状態 build への rollback 中は、解放料なしで初回購入ができる | 許容して記録する（プレイヤーに有利、rollback 中だけ） |
| P1-5 | 能力（capability）の解放の保存は OD216-3 次第。A（有料）は材料と同じく**保存が必須**。C（tutorial）は「tutorial を終えた」という出来事の保存が必要。B（自動）は条件が導出できれば保存不要 | OD216-3 が決まったら、`unlockedCapabilityIds` / `completedTutorialIds` を本監査と同じ規則（A 案の形、#206 の保持、bump なし）で追加する |
| P2-1 | `pitzBalance` は小数でも通る（`sanitizePitzBalance`） | 解放料を入れるときに、整数でない値の扱いを決める（#205 は `INVALID_BALANCE` で拒否している） |
| P2-2 | v2 で `dex` が配列でないと save 全体が既定値になる | 今の方針のまま（壊れた root は信用しない） |

## 10. reset / new game（調査項目 11）

- Full Game Reset（`resetSave` → `removeItem` → 本当に消えたか確認 → reload）は **save key を丸ごと消す**。entitlement も一緒に消える。これは意図どおり（新規ゲーム）。
- reset の後は L0 と同じ。`createDefaultSave` に `unlockedForShopIngredientIds: []`（と、採用するならカウンタの 0）を足す。ledger の saturation（P0-6）は新規 save にも必要。
- Firebase の匿名 uid、ranking、displayName は reset の対象外（今と同じ）。Progression とは関係しない。
- preview build は別の key なので、本番の entitlement には触れない。

## 11. corrupted / partial save（調査項目 12）

| 壊れ方 | 結果（新 build） |
|---|---|
| JSON として壊れている / root が object でない / `schemaVersion` が未知 / `dex` が配列でない | save 全体を既定値に（今と同じ）。次の書き込みで上書き |
| `unlockedForShopIngredientIds` が配列でない | `[]`。OWNED は I-1 で救われる。払ったが未購入の分は失われる（P1-2） |
| 要素が文字列でない / 空 / 形式が不正 | その要素だけ捨てる |
| starter id が入っている | 取り除く（I-3） |
| 未知だが形式の正しい id | gameplay には入れず、書き込みで保持（#206 の規則。P0-2） |
| 途中まで書かれた JSON | アプリからは発生しない（1 key・1 `setItem`）。外部から改変された場合は「JSON として壊れている」と同じ |
| `setItem` の失敗（quota など） | その書き込みがまるごと失われる。支払いと entitlement は同じ書き込みなので、両方とも失われて整合は保たれる（I-4） |

## 12. field 別 migration matrix（要約。完全版は JSON）

| field | persisted / derived | default | migration source | rollback（#206 なし / あり） | corruption |
|---|---|---|---|---|---|
| `schemaVersion` | persisted | 2 | v1 → 2 | 2 のまま出せば両方とも読める。bump すると両方とも全消去 | 未知なら全体を既定値に |
| `dex` | persisted | `[]` | そのまま | 未知の recipe は消える / 保持 | 要素ごと。配列でなければ全体を既定値に |
| `pitzBalance` | persisted | 0 | そのまま | 古い build の値で上書き（両方） | 0 |
| `ownedIngredientIds` | persisted | starter 3 件 | そのまま | 未知 id は消える / 保持 | 要素ごと。starter は必ず追加 |
| `inventory` | persisted | `{}` | そのまま（M4、変換なし） | 未知 id は消える / 保持 | 要素ごと |
| `missionBest` | persisted | `{}` | そのまま | 残る（両方） | key ごと |
| `starterGrantClaimedRecipeIds` | persisted（3-4C 後は saturate して残す） | `[]`（3-4C 後は全 shipped recipe） | そのまま + saturate | 未知 id は消える / 保持 | 要素ごと |
| **`unlockedForShopIngredientIds`（新）** | **persisted** | `[]` | 無い → `[]`。実効値は `∪ (owned ∖ starter)` | **消える（P0-1）** / 保持 | 要素ごと。starter は除く |
| `lifetimePitzEarned`（候補） | persisted（OD216-2 次第） | 0 | 下限 `pitzBalance` | 消える / 保持 | ≥0 の整数でなければ 0 |
| `lifetimeLunchRushServes`（候補） | persisted（OD216-2 次第） | 0 | 0 | 消える / 保持 | 同上 |
| `lifetimeCompletedPizzas`（候補） | persisted（OD216-2 次第、ORIGINAL を含む定義の場合だけ） | 0 | 下限 `Σ timesMade` | 消える / 保持 | 同上 |
| `unlockedCapabilityIds` / `completedTutorialIds`（候補） | persisted（OD216-3 が A/C の場合だけ） | `[]` | `[]`（既存の 15 recipe に必要な capability はない） | 消える / 保持 | 要素ごと |
| ⭐ / 発見数 / BEST 到達 / Dex 数 | **derived** | — | — | — | — |
| LOCKED / AVAILABLE_TO_UNLOCK | **derived** | — | — | 未払いの適格は条件値の変更で戻り得る（OD-SM-2） | — |
| AVAILABLE_TO_BUY | derived（`UNLOCKED ∧ ¬OWNED`。UNLOCKED は保存） | — | — | — | — |

## 13. 実装時の change-map（実装はしない）

前提: #206 が merge・deploy 済み（P0-1）。3-4C と同時か後か（P0-7 / OD-SM-1）。

| # | ファイル | 変更 | テスト |
|---|---|---|---|
| C-1 | `src/state/persistence.ts` | `PersistentSaveV2` に `unlockedForShopIngredientIds: string[]` を追加（bump なし）。`createDefaultSave` に `[]`。`sanitizeUnlockedForShopIngredientIds`（既知・非 starter・重複除去・要素ごと） | 欠落 / 非配列 / 不正要素 / starter / 重複 |
| C-2 | 同上（#206 の部分） | `KNOWN_SAVE_KEYS` に追加。`ForwardCompatExtras` と `extractForwardCompatExtras` に unlocked の未知 id を追加。`writeSave` で `appendNew` | #206 の 14 件をすべて通したまま、「T2 の id が T1 の書き込みを生き残る」を 3 経路すべてで追加 |
| C-3 | 同上 | `ProgressionSnapshot` に追加。`persistProgress` の変更検出に `sameStringSet` を追加 | mount だけでは書き込まない（I-6） |
| C-4 | `src/state/progression.ts`（または #205 の `progressionEconomy.ts`） | `IngredientState` に `AVAILABLE_TO_UNLOCK` を追加。`effectiveUnlocked = persisted ∪ (owned ∖ starter)`。判定は §4.1 | 5 状態 × starter / 有限 / 在庫 0 の表 |
| C-5 | `src/logic/economy.ts` | `unlockIngredient`（解放料）を新設し、`purchaseIngredient` は `UNLOCKED ∧ ¬OWNED` のときだけ許可。失敗理由 `NOT_ELIGIBLE` / `ALREADY_UNLOCKED` / `INSUFFICIENT_FUNDS` | 二重 dispatch で二重課金しない。残高不足で状態が変わらない |
| C-6 | `src/state/gameReducer.ts` | `GameState.unlockedForShopIngredientIds`、`UNLOCK_INGREDIENT` action。Pitz と集合を 1 回の遷移で更新 | I-4 |
| C-7 | `src/App.tsx` | hydration（`createInitialGameState` に渡す）と `persistProgress` の依存配列に追加 | reload 後も AVAILABLE_TO_BUY のまま |
| C-8 | `src/components/ShopOverlay.tsx` など UI | AVAILABLE_TO_UNLOCK の行と解放ボタン（UI 変更なので Human Verification の対象） | HV 動画・screenshot は policy に従う |
| C-9 | `e2e/gestures.ts` の seed、`e2e/save-forward-compat-3-4b.spec.ts` | seed に新しい field を任意で入れられるようにする。forward-compat の e2e に「entitlement が実際の書き込みと reload を生き残る」を追加。書き込みの契機は EP4 に頼らない（#211 §6.2） | Chromium 390×844 / 360×800 |
| C-10 | （OD216-2 がカウンタ条件を選んだ場合）`persistence.ts`、`gameReducer.ts`、`App.tsx`（Lunch Rush） | カウンタを追加。単調・max-merge・§4.3 の下限 backfill | 単調性、rollback 後の roll-forward |
| C-11 | （OD216-3 が A/C の場合） | capability の集合を C-1〜C-3 と同じ規則で追加 | 同上 |
| C-12 | 回帰テスト（fixture） | 「entitlement あり・未購入」の save を R1（#206 なし）・R2（#206 あり）の書き込みで模擬し、roll-forward 後の状態を固定。R1 で消えることを**既知の制約として**テストに書く（rollback floor の根拠） | unit |

**deploy 順序:** ① #206（単独で deploy。soak 期間を置く）→ ② 3-4C（ledger saturate を含む）＋ 5 状態（OD-SM-1 次第で同じ cutover）→ ③ content tranche（T2 の id）。

## 14. Owner 判断が必要な候補（本監査では決めない）

| ID | 内容 | 選択肢 | 本監査の推奨（未確定） |
|---|---|---|---|
| OD-SM-1 | 3 状態（#214 D-1）と 5 状態（#216）の出し方 | (a) 3-4C で 5 状態を同時に出す / (b) 3 状態を先に出し、5 状態の cutover で 1 回だけ grandfather / (c) 3 状態を先に出し、grandfather しない | (a)。(c) は re-lock に見えるので避ける |
| OD-SM-2 | 未払いの AVAILABLE_TO_UNLOCK を、条件値の変更で LOCKED に戻してよいか | (a) 導出のみ（戻り得る）＋条件値は上げない運用 / (b) 「一度適格になった」を保存する | (a) |
| OD-SM-3 | 非⭐条件にカウンタ（累計 Pitz・LR serve・ORIGINAL を含む完成枚数）を使うか（OD216-2 の一部） | 使う / Dex から導出できる条件だけ | 最初は Dex から導出できる条件だけ |
| OD-SM-4 | rollback floor を運用ルールとして明文化するか | PROJECT_HANDOFF に書く / 書かない | 書く |

#217 の OD216-1〜4（fee の curve、非⭐条件、capability、k 値）は、この監査の結論に影響しない。**どの選択肢でも entitlement の保存は必要**（§4.4）。

## 15. やっていないこと

- `src/**` の変更、save schema の実装、#206/#217/その他 OPEN PR の変更、PR の作成、Owner Decision の確定、Full E2E の実行。
- 本 branch に commit したのは、この report と `docs/reports/data/TETO_PROGRESS2_SAVE-MIGRATION_MATRIX.json` だけ。
