# Dinner Mission DM-4-2 — Record Persistence: Result

- **Issue:** #274（DM-4-2）。親は #257
- **Branch:** `claude/dinner-mission-dm4-2-persist-0dotex`。fresh な `origin/main` `e0e695f`（PR #259 DM-4-1 の merge）から作った
- **Authority:**
  - Phase 4-0 Plan §6
  - DM-4-1 の `DinnerMissionRecord` / `dinnerMissionRecordProblems`（変更していない）
  - Owner Decisions（2026-09-27）:
    - **Revision policy は V-1 を正式採用する**
    - **壊れた saved record は fail-closed**
- **Type:** save / persistence のみ。runtime、UI、gameplay の変更はない。そのため Human Verification の対象外（HV Policy）。

## 1. 変更したもの

| file | 変更 |
|---|---|
| `src/state/dinnerMissionRecordsSave.ts`（新規） | pure。`parseDinnerMissionRecords`、`isDinnerMissionRecordBlocked`、`mergeDinnerMissionRecord`、`mergeDinnerMissionRecordsForWrite` |
| `src/state/persistence.ts` | 下の表を参照 |
| `src/state/persistence.dinnerMissionRecords.test.ts`（新規） | 44 tests（review 対応後） |
| `src/state/saveIdGrammar.ts`（新規） | save が信頼する id 文法 `SAVE_ID_PATTERN` を 1 か所にまとめた（forward-compat と Dinner records で共有する。review #7） |
| `e2e/save-dinner-records-dm4-2.spec.ts`（新規） | 実 browser での forward-compat（2 tests × 2 viewport） |
| `src/state/persistence.test.ts`、`persistence.forwardCompat.test.ts`、`persistence.discoveryHintPurchases.test.ts`、`phase4a1b.regression.test.ts` | schema key の guard 3 件と、fixture 3 件を更新した（§4） |

`persistence.ts` の変更点:

- `PersistentSaveV2.dinnerMissionRecordsState` を追加した。中身は **parse 済みの state**（読める records、blocked の mission、container が壊れているか）。
  - 保存する key（`dinnerMissionRecords`）とは **わざと別の名前** にしている（review #1）。in-memory の state が誤って records の位置に保存されないようにするため。
- `KNOWN_SAVE_KEYS` に 2 つの key を追加した。
  - `dinnerMissionRecords`
  - `dinnerMissionRecordsState`（保存されない名前。紛れ込んだ copy は読まず、carry もしない）
- default / v1 migration は空の state にする。
- sanitize は **root が保存している値**（v1 / v2 とも）を parse する。migration 後の中間値は parse しない。
- forward-compat の extras に、保存されている生の値を追加した。
- `writeSave` は Dinner の値を **保存値への merge** で書く。
- `ProgressionSnapshot.dinnerMissionRecordUpdates?` を追加した（Pitz と同じ `writeSave` に乗る）。
- `persistProgress` は `{ refusedDinnerMissionIds }` を返すようにした（review #2）。
- `dinnerRecordForSettlement(state, id)` を追加した。`{ blocked: true }` か `{ blocked: false, record }` を返す（review #2）。

**変更していないもの:**

- DM-4-1 の pure settlement（`dinnerSettlement.ts`）
- reducer / runtime、UI / CSS、報酬の値、DM-5 の値、clock
- Dex、Scoring、Lunch Rush、Free Cooking

`dinnerMissionRecordUpdates` を渡している production code はまだない（test で固定している）。settlement を配線するのは DM-4-3。

## 2. 保存形式と規則

保存形式（save v2、top-level、schema の bump なし）:

```ts
dinnerMissionRecords: { [missionId]: { revision, clears, bestClearMs, bestTier, firstClearRewarded } }
```

schema は広げていない。DM-4-1 の 5 field だけ。

| 場面 | 規則 |
|---|---|
| **load: key が無い**（DM-4-2 より前のすべての save と v1） | 空の state |
| **load: 有効な record** | `records` に入れる（この build が知っている id も、形式の正しい未来の id も） |
| **load: 壊れた record** | **fail-closed。** `blockedMissionIds` に入れるだけで、`records` には入れない。`{}` や fresh な record、`firstClearRewarded = false` として扱うことは **しない**。保存値はそのまま残す |
| **load: container が壊れている**（null、数値、文字列、配列） | `containerCorrupt`。Dinner の全 mission を blocked にする。保存値はそのまま残す。**他のゲームモードは block しない** |
| **load: id の文法に合わない key** | 読まない。blocked にもしない。保存値には残す |
| **write: merge**（`mergeDinnerMissionRecord`） | `firstClearRewarded` は OR（一度払ったら二度と false に戻らない）<br>`clears` は max<br>同じ revision の間は、best time が min、best tier が良い方<br>revision が違うときは **新しい revision** の best を使う（V-1。settlement で既にリセット済み。古い revision が新しい revision を上書きすることはない） |
| **write: 保存値の保全** | 壊れた record、未来の id、文法外の key、record の中の未知 field は、すべてそのまま残す。`__proto__` は copy しない |
| **write: blocked な mission への更新** | 拒否する（上書きしない）。それ以外の field（Pitz など）は通常どおり保存する。blocked な mission だけへの更新なら、書き込み自体が起きない |
| **write: 不正な record** | 拒否する（書かない） |
| **write: 原子性** | Pitz と records は `persistProgress` の 1 回の `writeSave` で書く |
| **write: 冪等性** | 同じ内容の再書き込みはスキップし、bytes も変わらない |
| **Dinner を一度も触っていない save** | key を書かない。既存の save の bytes と key の集合が変わらない |
| **Full Reset** | `resetSave` で save ごと消える |
| **revision（V-1）** | load では migration しない（保存された revision のまま）。V-1 は settlement（DM-4-1）が適用し、write の merge は `firstClearRewarded` / `clears` を必ず保持する |

**DM-4-3 への約束:**

- settlement に渡す record は、**必ず** `dinnerRecordForSettlement(state, missionId)` で取る。blocked なら精算しない（Pitz 0、record を書かない）。
- `records[id]` を直接読むと、blocked な mission が「record 無し = 初回」に見えてしまう。
- `persistProgress` の `refusedDinnerMissionIds` が空であることを assert できる。

DM-4-1 の `decideDinnerSettlement` も、壊れた record を INVALID_INPUT で拒否する（二重の fail-closed）。

## 3. Tests（必須の 20 項目との対応）

| # | 項目 | test |
|---|---|---|
| 1 | fresh save | load「1」 |
| 2 | 古い save（key が無い） | load「2」、v1、既存の round-trip test 2 件（§4） |
| 3 | 有効な record の round-trip | load「3」、write「3」（Pitz と同じ 1 回の write） |
| 4 | 複数の mission | load「4」 |
| 5 | 未知 / 未来の mission id | forward「5」2 件（未来の id、文法外の key） |
| 6 | 未知 / 未来の field | forward「6」（この build が更新するときも残る） |
| 7〜10 | flag / clears / best time / best tier の保持 | load「3」、write「7-10」（stale な snapshot が進捗を下げない、field ごとの merge） |
| 11 | V-1 の revision migration | write「11」2 件（新しい revision、stale な write で初回が再取得できない、load で migration しない） |
| 12 | 壊れた record は fail-closed | 「12」と 9 種類の壊れ方 |
| 13 | 壊れた record を自動で削除しない | 「13」3 件（全 write 経路で残る、上書きを拒否、blocked だけへの更新は write 0） |
| 14 | 壊れた record から初回報酬を再取得できない | 「14」（blocked かつ DM-4-1 が INVALID_INPUT） |
| 15 | Full Reset | 「15」 |
| 16 | 無関係な field は不変 | 「16」2 件 |
| 17 | 既存の save の意味は不変 | 「16 / 17」（key の集合と bytes）、既存 suite 全体 |
| 18 | write / read / write の冪等性 | 「18」 |
| 19 | forward compatibility | 「19」、E2E（valid / broken / future id / future field / 文法外の key が、実際の mount write と reload で verbatim に残る） |
| 20 | DM-1〜DM-3 の runtime は不変 | import の境界（records-save を import しているのは persistence だけ、`dinnerMissionRecordUpdates` を渡す production code は 0）、Dinner E2E 全体（R1〜R27）が green |

**追加で固定したこと:**

- container の破損（4 種）が Dinner だけを block し、Pitz などの保存は続くこと。
- `__proto__` が copy されないこと。
- settlement → 保存 → reload → 次の clear が REPEAT になる、という DM-4-1 との往復。

## 4. 既存 test の更新（削除はしていない）

| test | 理由 |
|---|---|
| `persistence.test.ts` の schema key guard、`phase4a1b.regression.test.ts` の save schema guard | 意図した新しい key `dinnerMissionRecords` を、理由のコメント付きで allowlist に追加した |
| `persistence.forwardCompat.test.ts`「a brand-new player's first write is exactly the default shape」 | Dinner の key は record ができるまで書かないので、期待値を「default から `dinnerMissionRecords` を除いたもの」にした（既存 save の bytes が変わらないことの固定） |
| `persistence.test.ts` の v2 round-trip 2 件 | fixture を「DM-4-2 より前の保存形式」（`Omit<…, "dinnerMissionRecords">`）として型付けした。load 結果は空の Dinner state を持つ = 必須 2 |
| `persistence.discoveryHintPurchases.test.ts` の round-trip | in-memory の `PersistentSaveV2` をそのまま stringify していた。Dinner の field は parse 済みの state で、保存形式ではない。production では `writeSave` だけが merge で serialize するので、fixture を保存形式に直した |

**実装中に test が見つけた bug（修正済み）:**

- v1 の save は `migrateV1toV2` を通る。その中間値が持つ「空の state」を、保存値として再 parse していた。
- その結果、`records` という名前の mission が blocked になっていた。
- sanitize は **v2 root が保存している値だけ** を読むように直した（mutation P3 で固定）。

## 5. Mutation

各 mutant を入れて、関係する 3 つの test file を実行し、元に戻した（完全一致を確認した）。

| mutant | 結果 |
|---|---|
| R1: 壊れた record を blocked にせず、fresh 扱いにする | DETECTED（12） |
| R2: 壊れた record を「初回未払い」の record に repair する | DETECTED（12） |
| R3: blocked な mission を上書きする | DETECTED（1） |
| R4: 壊れた container を上書きする | DETECTED（1） |
| R5: 壊れた container を空として読む | DETECTED（1） |
| R6: flag を OR しない | DETECTED（2） |
| R7: clears を max にしない | DETECTED（2） |
| R8 / R9: best time / best tier を単調にしない | DETECTED（2 / 1） |
| R10: 古い revision が新しい revision を上書きする | DETECTED（1） |
| R11: 未知 field を落とす | DETECTED（1） |
| R12: 文法外の key を落とす | DETECTED（1） |
| R13: 空の key を常に書く | DETECTED（3） |
| R14: 不正な incoming record を書く | DETECTED（1） |
| R15: `__proto__` を copy する | DETECTED（1） |
| P1: `writeSave` が保存値を無視して `next` を serialize する | DETECTED（6） |
| P2: `persistProgress` が Dinner の変更を skip 判定に含めない | DETECTED（4） |
| P3: v1 の中間値を再 parse する | DETECTED（1） |
| P4: snapshot の blocked filter を外す | 最初は **SURVIVED**（害のない余分な write が 1 回起きるだけ）。「blocked だけへの更新は write 0」の test を追加して DETECTED（1） |
| P5: `KNOWN_SAVE_KEYS` から key を外す | **equivalent**。`writeSave` の明示的な merge が常にこの key を所有するので、観測できる差が無い |

**結果（初回）: 19 / 19 の非 equivalent mutant が DETECTED。** review 対応後は §8。

## 6. Verification

| check | result |
|---|---|
| focused（`src/state`） | 53 files、1205 passed（review 対応前） |
| full Vitest | 197 files、4250 passed / 1 skipped（review 対応前）→ **4255 passed / 1 skipped**（review 対応後。skip は既存のもの） |
| `tsc -b` | clean |
| `oxlint` | 0 warnings / 0 errors |
| `npm run build` | success |
| E2E（Chromium、iphone-390x844 と iphone-360x800） | 新しい spec、`save-forward-compat-3-4b`、`dinner-mission`（DM-3R-2 の全件）: **28 passed** |
| E2E 回帰（iphone-390x844） | `discovery-hint-facts-save`、`progression2-discovery-ladder`、`lunch-rush-material-shortage`、`free-cooking-phase3-2`、`progression2-p3-3-onboarding`: **16 passed** |

## 7. Follow-up（DM-4-2 には含めない。Owner Decision に従う）

- **壊れた record の recovery UI、または明示的な reset policy。** 今は壊れた record の mission は settlement を拒否し続ける。Full Reset では消える。必要になったら別の Issue で決める。
- **DM-4-3:** runtime で `isDinnerMissionRecordBlocked` と `decideDinnerSettlement` を CLEAR 遷移で 1 回だけ呼び、Pitz と `dinnerMissionRecordUpdates` を同じ state step で `persistProgress` に渡す。

## 8. Independent review（`80e923d` の diff に対するもの。PR #276）

`/code-review high` で 8 件の指摘が出た。修正は `80e923d` の次の commit で行った。

| # | 指摘 | 判断 | 対応 |
|---|---|---|---|
| 1 | in-memory の state が保存 key と同じ名前 `dinnerMissionRecords` を使っている。save object を stringify した fixture が state を保存し、次の load で `records` という mission が blocked になる | **妥当（P2）** | in-memory の field 名を `dinnerMissionRecordsState` に変えた。保存 key は `writeSave` の merge だけが作る。`dinnerMissionRecordsState` は `KNOWN_SAVE_KEYS` に入れ、紛れ込んだ copy は読まず、保持もしない。先に入れていた `discoveryHintPurchases` の fixture の変更は、不要になったので revert した |
| 2 | `persistProgress` が拒否された更新を報告しない。blocked な mission には読める record が無いので、DM-4-3 が `records[id]` を読むと初回扱いで支払ってしまいうる | **妥当（P2。runtime の部分は DM-4-3）** | 型で blocked の処理を強制する `dinnerRecordForSettlement` を追加した。`persistProgress` は `{ refusedDinnerMissionIds }` を返す |
| 3 | `clears` の max merge では、2 つの tab から同時に clear すると 1 回分が失われる | **設計どおり（P3）** | 単調な merge では増分を足せない（ledger が必要）。`clears` に支払いは掛かっていないので exploit にはならない。既知の制限として記録する |
| 4 | snapshot の merge が record を独自に再 merge していた。そのため、文法外の key や `__proto__` が in-memory の state に入りうる | **妥当（P2）** | 次の state を、1 回の write merge の結果から parse して作るようにした。#6 の二重 merge も同時に解消した |
| 5 | v1 root に key がある場合、load（無視）と write（merge）で見え方が違う | **妥当（P3）** | 認識できる root（v1 / v2）すべてで、保存値を parse するようにした |
| 6 | merge の二重実装 | #4 で解消 | ― |
| 7 | id 文法の重複 | **妥当（P3）** | `saveIdGrammar.ts` の `SAVE_ID_PATTERN` を共有するようにした |
| 8 | 保存値を二重に parse し、`includes` で O(n·m) の検索をしている | P3 | blocked の検索を `Set` にした。二重 parse は数件の mission なので無視できる |

**追加した test（5 件）:**

- #1: stringify された in-memory の save が records を植え付けないこと。stray な key が落ちること
- #2: accessor が blocked を「record 無し」として見せないこと（4 通り）
- #2: `persistProgress` が拒否を報告すること（blocked、不正な record、壊れた container、全件保存時は空）
- #4: 文法外の key と `__proto__` が state にも storage にも入らないこと
- #5: v1 root の key が load と write で一致すること

**Mutation（review 対応後）: 22 / 22 の非 equivalent mutant が DETECTED。**

新しく加えた mutant:

- N1: in-memory の key を extra として carry する
- N2: accessor が blocked を無視する
- N3: 拒否を報告しない
- N5 / P3b: v1 root を読まない / 中間値を再 parse する

**equivalent mutant:**

- **N4**（次の state を生の incoming から作る）: `writeSave` が保存値に対して全 record を再 filter・再検証するので、in-memory の中間値は外から観測できない。
- **P5**（`KNOWN_SAVE_KEYS` から保存 key を外す）: 明示的な merge が常にこの key を所有するので、差が出ない。

**Verification（review 対応後）:**

| check | result |
|---|---|
| full Vitest | 197 files、**4255 passed / 1 skipped** |
| `tsc -b` | clean |
| `oxlint` | 0 / 0 |
| build | success |
| E2E（Chromium 390×844 と 360×800） | 新しい spec、`save-forward-compat-3-4b`、`dinner-mission`、`discovery-hint-facts-save`: **30 passed** |

