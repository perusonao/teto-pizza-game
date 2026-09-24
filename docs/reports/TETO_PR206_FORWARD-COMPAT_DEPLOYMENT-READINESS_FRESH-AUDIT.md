# PR #206 Forward-Compatibility Deployment Readiness — Fresh Re-Audit

- **種別:** 監査のみ。PR #206 / #217 / `src/**` / save schema は**変更していない**。merge・deploy・PR 作成・Owner Decision の確定もしていない。
- **目的:** PR #206 を Progression 2.0 より**先に単独で deploy する** forward-compatibility layer として安全に使えるかを、事実で判定する。
- **機械可読版:** `docs/reports/data/TETO_PR206_FORWARD-COMPAT_SIMULATION.json`
- **再現用 harness:** `tools/pr206-forward-compat-sim/`（`src/**` の外。`npm test` には含まれない）

## 0. 基準（2026-09-24 に GitHub で確認）

| 対象 | SHA / 状態 |
|---|---|
| main | `dff233c042d2df6ee1c3a92f2d2419830aa05460` |
| **PR #206 HEAD（監査対象）** | `4c1da8703bb22a2be7cad911f92ec33cb0f0485d`（OPEN、1 commit、base `d6b6ef9`、mergeable_state clean、CI: build / classify / webkit / WebKit Gate すべて success） |
| PR #217 HEAD | `a39932d6b750cd0dd16b63e8635ac40c53a9fb70`（OPEN、base `dff233c`） |
| Save Migration Fresh Audit | branch `claude/teto-pizza-save-audit-7krsua`、commit `9eaf3ea`（`TETO_PROGRESS2_SAVE-MIGRATION_FRESH-AUDIT.md` / `..._MATRIX.json`） |

- #206 の base `d6b6ef9` と main `dff233c` の間の差分は、`lunchRush.ts` / `gameReducer.ts`（Issue #200 の Mission pool）と test だけ。`persistence.ts` は変わっていない。
- `git merge-tree` の結果、main へのマージは**コンフリクトなし**（tree `438f729`）。
- ビルドは 3 つ。**A** = main `dff233c`。**B** = main + #206（ローカルでマージしただけで push していない）。**C** = 将来の Progression 2.0。C は fixture の JSON だけで表し、production の field は実装していない。
- B のツリーで `npm test`（vitest）を実行: **126 files / 2430 tests pass**。`tsc -b` も pass。

## 1. #206 の差分（`src/state/persistence.ts` だけ。+144/−5 行）

1. `sanitizeDexEntry` が recipe id の判定関数を引数で受け取れるようになった（既定は今までどおり `isKnownRecipeId`）。
2. `extractForwardCompatExtras(raw)` を追加。raw storage から「未知だが形式が正しい」データを取り出す。
   - 対象は root の `schemaVersion` が 1 か 2 で、`dex` が配列のときだけ。それ以外は `null`。
   - top-level: `KNOWN_SAVE_KEYS`（7 個）以外の key を**そのまま**取り出す。中身は検証しない。`__proto__` は捨てる。
   - `dex`: 未知の recipeId で、既知の entry と同じ検証（discovered / bestScore / bestStars / timesMade）を通るもの。重複は除く。
   - `ownedIngredientIds` / `starterGrantClaimedRecipeIds`: 未知の id で、`^[a-z0-9][a-z0-9_-]{0,63}$` に一致するもの。
   - `inventory`: 未知の id で、値が 0 以上の整数のもの。
3. `writeSave(storage, next)` を追加。書き込むたびに raw を読み直し、extras を後ろに付け足して `setItem` を**1 回だけ**呼ぶ。既知の値が常に優先され、extras は付け足されるだけ。
4. `persistDex` / `persistProgress` / `persistMissionBest` の 3 つの書き込み経路は、すべて `writeSave` を通るようになった。
5. `loadSave()` の戻り値は変わらない。`GameState` には未知のデータが入らない。

**変更していないもの:** 読み込み時の検証、no-op の書き込みを省く処理、`schemaVersion`（2 のまま）、`missionBest` の検証（未知の mission key は main でも残る）、reset。

## 2. read → write → read の保持表（S1。3 つの書き込み経路で結果は同じ）

C の fixture（`tools/pr206-forward-compat-sim/fixtures.ts`）を storage に置き、各ビルドで書き込みを 1 回して、raw をもう一度読んだ結果。

| probe | A（main） | B（#206） |
|---|---|---|
| 未知の top-level `unlockedForShopIngredientIds` | **消える** | **残る**（そのまま） |
| 未知の top-level カウンタ `lifetimePitzEarned` | 消える | 残る（そのまま。B は値を更新しない） |
| 未知の top-level の入れ子 object `futureMeta` | 消える | 残る（そのまま） |
| `dex`: 未知の recipe id、entry は正しい | 消える | **残る** |
| `dex`: entry の中の追加 field（未知 / 既知どちらの recipe でも） | 消える | **消える** |
| `ownedIngredientIds`: 未知の id、pattern に一致 | 消える | **残る** |
| `ownedIngredientIds`: 未知の id、pattern に不一致（大文字、`:`） | 消える | 消える |
| `inventory`: 未知の id、整数 | 消える | **残る** |
| `inventory`: 未知の id、小数 | 消える | 消える |
| `inventory`: 既知の id、小数（既存 field の意味の変更） | 消える | 消える |
| `missionBest`: 未知の mission key、整数 | 残る | 残る |
| `missionBest`: 未知の mission key、整数でない | 消える | 消える |
| `starterGrantClaimedRecipeIds`: 未知の recipe id | 消える | **残る** |

- `loadSave()` の結果（`GameState` から見える値）は、A と B で同じだった。
- **#217 の id との照合:** #217 の matrix にある材料 id 105 件と将来の recipe id 101 件は、**すべて #206 の pattern に一致する**。一致しないのは capability / dough / pan の node id 23 件（例: `pan:tray`、`dough:thick`、`ZONED_PLACEMENT`）。これらは新しい top-level field に入れれば残るが、既存の配列や map に入れると消える。

## 3. future entitlement のシミュレーション（`unlockedForShopIngredientIds: ["future-ingredient-a","future-ingredient-b"]`、schemaVersion 2）

### 3.1 unit（S2。実際の `persistence` / `starterStock` / `gameReducer` / `dex` モジュールで、App.tsx と同じ手順を再現）

| step | 書き込み | A の結果 | B の結果 |
|---|---|---|---|
| 1 起動 + EP4 catch-up（`bismarck`、`funghi` を grant） | あり | **起動しただけで**未知の top-level と未知の id がすべて消える | すべて残る |
| 2 pizza 完成（REGISTER_TO_DEX 相当） | あり | 消えたまま | 残る |
| 3 Shop（mushroom を補充、Pitz 400 → 250） | あり | 消えたまま | 残る |
| 4 Lunch Rush（CLAIM_MISSION_REWARD + `persistMissionBest` 640） | あり | 消えたまま | 残る |
| 5 HOME | なし | — | — |
| 6 再起動 | なし（grant 済み） | 消えたまま | 残る。`GameState` の owned と dex に未知の id は入らない |

### 3.2 実ブラウザ（Chromium 390×844、dev server、実際の UI 操作）

`tools/pr206-forward-compat-sim/e2e/futureSaveSession.spec.ts`。fixture を 1 回だけ seed し、起動 → FREE で margherita を完成 → Shop で補充（にんにく）→ Lunch Rush を RESULT まで → ホームへ → reload の順に操作した。各 step の後に raw save を記録。

| | A | B |
|---|---|---|
| Dex pill | 2/15（未知の recipe は数えない） | 2/15（同じ） |
| step 1（起動。EP4 の書き込み）の後の `unlockedForShopIngredientIds` | `null`（消えた） | `["future-ingredient-a","future-ingredient-b"]` |
| step 1〜6 の未知の Dex / owned / inventory / ledger / カウンタ / `futureMeta` | step 1 からずっとない | 6 step すべてで残る |
| Pitz（400 → 450 → 360）と既知の Dex の更新 | 反映される | 反映される（未知のデータと共存する） |

補足: Lunch Rush の step でも書き込みはあった（margherita の timesMade が 3 → 4）。ただしこの run の score は 500 を超えなかったので、`missionBest` は書かれていない。`persistMissionBest` の経路は unit の S1 / S2 で確認済み。

**結論（future-field / unknown-ID の保持）:** B は、実際の起動・EP4・pizza・Shop・Lunch Rush・HOME・再起動を通して、未知の top-level field と形式の正しい未知 id を**すべて保持した**。保持しないものは §2 の「消える」の 5 種類（entry の中の field、pattern 外の id、整数でない値、既存 field の意味の変更、v3 の root）。

## 4. old-tab / deploy 順のシナリオ（A = main、B = #206、C = 将来）

| # | シナリオ | C に戻ったときの結果 |
|---|---|---|
| S3a | C の save → B で起動し、pizza と Shop → C | entitlement、カウンタ、未知の Dex / owned / inventory / ledger、`futureMeta` は**すべて残る**。Pitz は B で使った分だけ減る（正しい） |
| S3b | **古い B のタブ**（C の書き込みより前に開いていた）が、C が解放料を払った（Pitz 400 → 300、entitlement を追加、margherita の BEST を 5★ に更新、`future-recipe-c` を発見）後に 1 回書く | entitlement は**残る**。`future-recipe-c` も残る。しかし **`pitzBalance` は 400 に戻る**（解放料が返ってくる）。**margherita の BEST も 3★ / timesMade 2 に戻る**。既知の field は古いタブの値が最後に勝つ（main の時点からある問題。#206 は直していない） |
| S3c | C の save → **A に rollback** → C | EP4 の起動時の書き込みだけで、未知の top-level と未知の id がすべて消える（`missionBest` の未知の key だけは残る） |
| S3d | C → B → **A** → B → C | A が 1 回書いた時点で消える。その後 B に戻しても**復元されない** |
| S3e | B の deploy より前から開いていた **A のタブ**が、C の save に書く | S3c と同じく消える |
| S5 | C → B の往復を 5 回 | 重複はできない（dex / owned / ledger）。C の field の更新は毎回残る |

### rollback floor

- **C を出す前:** B から A への rollback は安全。未知のデータがない save では、起動・pizza・Shop・Lunch Rush の各書き込みで、**B は A とバイト単位で同じ内容を書く**（S6）。
- **C を 1 回でも出した後:** floor は **B（#206 の `writeSave` を含む build）**。A、#206 の revert、`workflow_dispatch` で古い SHA を出す、のどれでも最初の書き込みで C のデータが消え、元に戻せない（S3c / S3d）。
- **古いタブ:** B の deploy より前に開いた A のタブは、rollback と同じ働きをする（S3e）。アプリに service worker や強制 reload の仕組みはないので、時間（soak）をおいて減るのを待つしかない。

## 5. schemaVersion（S4）

- **2 のままで、field を足すだけの migration は成立する。** S1〜S3、S5、実ブラウザのすべてで、C の field は B を通っても残った。v1 の root に未知の top-level があっても、B は v2 に migrate しながら残す。
- **root が v3 の場合:** A でも B でも、起動時には書き込まない。しかし**最初の本当の書き込みで save 全体が既定値に置き換わる**（Dex、Pitz、所有、entitlement がすべて消える）。#206 はここを変えていない。したがって「bump しない」は C 側の制約として残る。
- 本監査では schema の bump をしていない。

## 6. Save Migration Audit の P0-1〜P0-7 に対する判定

| P0 | 判定 | 根拠 |
|---|---|---|
| P0-1（#206 が未 merge。main がすべての書き込みで未知のデータを捨てる） | **PARTIALLY_RESOLVES** | コードの原因は B で解消している（3 経路すべて。unit と Chromium で確認）。残りは diff では片付かない運用の作業: merge、C より前の別 deploy、A のタブがなくなるまでの soak、rollback floor の規則 |
| P0-2（entitlement の key を知っている build が、それより新しい id を捨てる） | **DOES_NOT_RESOLVE** | この問題は C が key を既知として登録したときに C の中で起きる。#206 は使い回せる部品（`unknownIdsIn`、`appendNew`、`KNOWN_SAVE_KEYS`）を用意しているが、拡張するのは C。B と C の間では、B は key を知らないので配列をまるごと残し、問題は起きない |
| P0-3（`schemaVersion` の bump） | **DOES_NOT_RESOLVE** | #206 は 2 のまま。v3 の root は B でも消える（S4）。bump 禁止は C の制約として残る |
| P0-4（`OWNED ⇒ UNLOCKED` の grandfather） | **DOES_NOT_RESOLVE** | C のロジック。B の Shop は、rollback 中は既知の材料を解放料なしで買える。そのため C の I-1 は一層必要になる |
| P0-5（解放料と entitlement を 1 回の書き込みで保存） | **DOES_NOT_RESOLVE** | `writeSave` は 1 key・1 `setItem` を守っている。しかし古い B のタブは、entitlement を残したまま C の解放料の支払い（`pitzBalance`）を元に戻せる（S3b） |
| P0-6（EP4 ledger の saturation） | **PARTIALLY_RESOLVES** | B は未知の recipe id の ledger を残すので、C が将来の id まで saturate した ledger は B の書き込みを生き残る。既知の id の ledger は A でも残る。saturation そのもの（3-4C）は #206 にない |
| P0-7（3 状態と 5 状態の矛盾） | **DOES_NOT_RESOLVE** | Owner Decision（OD-SM-1）。save 層のコードでは決まらない |

## 7. Deployment Gate（推奨の順位ではなく、各選択肢が成り立つ条件と違い）

### A: #206 をそのまま先に deploy できる

次の**すべて**が成り立つときに限る。

1. C が `schemaVersion` 2 を保つ（bump しない）。
2. C の新しいデータは、**新しい top-level key** として足す（`unlockedForShopIngredientIds`、カウンタ、capability の集合など）。
3. C は、既存の Dex entry や他の既存 map の値の**中に** field を足さない（§2: B で消える）。
4. C が `dex` / `ownedIngredientIds` / `inventory` / `starterGrantClaimedRecipeIds` に入れる id は `^[a-z0-9][a-z0-9_-]{0,63}$` に一致する（#217 の材料 id と recipe id はすべて一致する。capability / dough / pan の node id はこれらの配列に入れない）。
5. C は既存 field の意味や値の範囲を変えない（`inventory` は M4 の整数の個数、`missionBest` は整数のまま。#214 D-2 と #217 の方針に一致）。
6. 複数タブでは既知の field を最後に書いたタブが勝つ。そのため、古いタブで解放料が戻り entitlement は残る、BEST や timesMade が巻き戻る、ということが起きる。これを受け入れるか、C の側で対処する。
7. #206 を C より前に単独で deploy し、soak 期間をおき、C を出した後は B を rollback floor とする。
8. #217 が #206 に求めている「downgrade / write / reload で entitlement が残るテスト」について、#206 のテストは汎用の `futureLedger` key を使っている。この harness の結果を証拠として受け入れるかどうかを、Owner が判断する。

### B: 小さな forward-compat 修正の後に先に deploy できる

修正は `persistence.ts` と test の中に収め、`loadSave` の出力を変えず、bump もせず、#206 の 14 件と本 harness を通したままにする。その修正で消える条件を除き、A の他の条件はすべて残る。候補は次の 4 つ（それぞれ独立）。

| 候補 | 内容 | A の条件のうち消えるもの |
|---|---|---|
| B-1 | Dex entry の中の未知の field を残す（既知 / 未知の recipe の両方） | 条件 3（Dex について） |
| B-2 | `unlockedForShopIngredientIds` という名前で downgrade / write / reload のテストを足す（テストだけ） | 条件 8 |
| B-3 | id の pattern を広げる（`:` を許すなど）。C が名前空間つきの id を既存の配列に入れたい場合だけ | 条件 4 の一部 |
| B-4 | `writeSave` で、単調に増える既知の集合（owned、ledger）を raw と union する | 条件 6 の一部（owned / ledger の巻き戻り）。`pitzBalance` と Dex の BEST には効かない |

### C: Progression 2.0 のために作り直しが必要

次のどれか 1 つでも要件になるなら、#206 の「未知のデータを中身を見ずに残す」方式では足りない。

- Progression 2.0 で `schemaVersion` の bump が必要になる。
- 既存 field の意味を変える（portion 単位の在庫、小数の値など）。
- 複数のタブが同時に開いていても、有料解放を安全に保つ必要がある（古いタブで解放料が戻ってはいけない）。これにはタブ間の調整（`storage` イベントでの再読み込み、解放料の ledger、単調な merge など）が必要。
- 古い build に entitlement を**守らせる**必要がある（残すだけでは足りない）。

| | A | B | C |
|---|---|---|---|
| #206 の変更 | なし | `persistence.ts` とテストを少し | 設計から |
| C 側の制約 | 条件 1〜6 | 条件 1〜6 から、選んだ修正の分が減る | 要件次第 |
| 残るリスク | 古いタブ（既知の field）、A のタブ | 同じ（B-4 なら一部が減る） | 設計次第 |

## 8. 本監査で確認していないこと・残るリスク

- WebKit と 360×800 では実行していない（Chromium 390×844 だけ）。#206 自身の CI では WebKit Gate が success。
- C は fixture だけ。実際の C の reducer や UI の振る舞い（grandfather、解放料）は検証していない。
- A のタブがいつなくなるかは測れない（service worker も強制 reload もない）。

## 9. 再現手順

```bash
npm ci
SIM_WORK=$(mktemp -d) tools/pr206-forward-compat-sim/run.sh       # unit: A / B の worktree を作り S1〜S6 を実行
SIM_WORK=<same dir>  tools/pr206-forward-compat-sim/run-e2e.sh    # Chromium 390x844: A と B の実ブラウザ session
python3 tools/pr206-forward-compat-sim/combine.py <same dir> docs/reports/data/TETO_PR206_FORWARD-COMPAT_SIMULATION.json
```

本 branch に commit したもの: この report、simulation の JSON、`tools/pr206-forward-compat-sim/`（fixture、harness、設定、script）。`src/**`、#206、#217、その他の PR は変更していない。
