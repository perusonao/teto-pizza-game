# TETO Cooking Techniques 1.0 — TQ-1C Fresh Pre-Implementation Gate

> **audited main:** `bcac961`（PR #271 TQ-1B merge）、2026-09-28。
> **範囲:** 監査と設計の確定だけ。src / e2e / CSS / production runtime は変更しない。Preview / production deploy もしない。実装 PR は作らない。
> authority の要約: `TETO_COOKING-TECHNIQUES_1.0_SSOT.md`（本 gate と同時に作成。main への取り込みを OD-TQ1C-1 として提案する）。

## 0. 結論

**判定: B. OWNER DECISIONS REQUIRED。**

TQ-1C の runtime wiring 自体は、main の現状のまま実装できる状態にある:

- 依存先はすべて merged。
- #284 は merged。
- 保存の atomicity は成立している。
- INV-TQ-4 によって production では不活性。
- scoring / Reference の変更は不要。

ただし、着手前に次の 3 点を Owner に決めてもらう必要がある。

- **OD-TQ1C-1:** authority が main に無い。取り込み方を決める。
- **OD-TQ1C-2:** near-miss の k 規則の範囲と時期。一律に適用すると、今の production の文言が変わる（実測: canonical ladder 上の SAUCE_ONLY 44 件中 12 件）。
- **OD-TQ1C-3:** guided round の扱い。authority の「guided では検出しない」と INV-TQ-1 が、main の実装上で衝突しうる。

推奨案（§9）がそのまま承認されれば、次の判定は **A. READY FOR IMPLEMENTATION** になる。

---

## 1. Fresh State Audit（STEP 1）

| 項目 | 状態（GitHub / main を fresh に確認） |
|---|---|
| latest main | `bcac961`（#271）← `73c8ad0`（#273）← `037eea2`（#284 DH4-2C）← … ← `4f7443a`（#268）。post-merge の CI、E2E WebKit、Deploy はすべて success |
| Duplicate gate（Issue） | 「Cooking Technique discovery TQ-1C runtime wiring technique ledger」の検索 → #262 / #263（いずれも closed）だけ。**TQ-1C の Issue は存在しない** |
| Duplicate gate（open PR） | 19 本。TQ-1C の対象ファイルと重なりうるのは **#275**（`gameReducer.ts` +40、`completionGate.ts`）だけ（§5）。#272（`src/logic/catalog/*` の新規ファイルのみ）と #255（docs）は重ならない |
| #284 DH4-2C | **merged `037eea2`（2026-09-28 09:35）**。未 merge による block はない |
| #260 mechanic_matrix drift | **open のまま、未修正**（指示どおり触れていない）。TQ-1C の blocker ではない |
| LAD-1 / TQ-1A / TQ-1B | すべて main に入っている。3 本の tests、parity、architecture test は main `bcac961` で pass（210 files / 4449 passed / 1 skipped） |
| DM-4-3 | `persistProgress({…, dinnerMissionRecordUpdates, requireDinnerRecords: true})`（`App.tsx:349-381`）。拒否されたら何も書かず、`DINNER_RECORDS_REFUSED` で memory 側を合わせる |
| DH4 Hint privacy | DH4-2C は presentation のみ。構成 / 特徴 は DEV / Preview の flag の内側。near-miss（`src/state/resultNearMiss.ts`）は DH4 で変わっていない |
| runtime の境界 | Free Cooking = `state.freeCook === true`。guided FREE = `!freeCook && !isMissionRound && roundKind !== DINNER`。Lunch Rush = `isMissionRound`。Dinner = `isDinnerRound(state)`（`freeCook: false`） |
| 設計ツール | `tools/cooking_techniques_audit.py --check` と `tools/cooking_techniques_tq1_gate.py --check` は、main を取り込んだ design branch 上でどちらも pass |

### 旧設計資料と main の差分（main と最新の Owner Decision を優先）

| 旧資料の記述 | main の実態 | 扱い |
|---|---|---|
| Owner Decision Gate §9: TQ-1B が `ReferencePizza.sauce` を nullable にし、UI に null guard を入れる | TQ-1B は型を nullable に**していない**（`ScoringReferencePizza` の seam だけ）。逆に、Reference registry の deep-freeze と readonly 型が加わった | nullable 化は TQ-1D に移す（Final Gate §3.3 と SSOT §3 に一致）。TQ-1C では触らない |
| Owner Decision Gate §9: TQ-1C が near-miss privacy を wiring する | k 規則をどこまで適用するかで、TQ-1C が不活性でなくなる（§6） | OD-TQ1C-2 |
| Owner Decision Gate §8: 「Lunch Rush / guided: 検出しない」 | main の REGISTER_TO_DEX は、guided round でも matcher 経由で**別のレシピを新しく発見しうる**（`registerDiscoveryToDex`） | OD-TQ1C-3 |
| src のコメントが `docs/design/TETO_COOKING-TECHNIQUES_1.0_FINAL-IMPLEMENTATION-GATE.md §1` を参照している（`src/data/techniques.ts` ほか） | **そのファイルは main に存在しない**（design branch にしかない） | OD-TQ1C-1 |

---

## 2. Authority Placement（STEP 2）

**現状:** TQ-1C の詳細な authority は、今も `claude/cooking-techniques-design-n0qfwj` にしかない（PR 無し。main の `PROJECT_HANDOFF.md` にも技法の記述はない）。main にあるのは、TQ-1A / TQ-1B の Result Report とコードのコメントだけ。

**提案（OD-TQ1C-1）:** TQ-1C の実装より前に、次を **docs-only PR** で main に取り込む。

| 取り込むもの | 理由 |
|---|---|
| `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`（新規。本 gate で作成） | ご指定の 11 原則を P1〜P11 として 1 枚に固定する。本書が優先、と明記する |
| `_DESIGN.md`、`_OWNER-DECISION-GATE.md`、`_FINAL-IMPLEMENTATION-GATE.md`、本 gate | src が参照しているファイルを main で実在させる（dangling な参照を解消する） |
| `docs/design/data/*.json`、`_ROWS.md`、`_TQ1_GATE_TABLES.md`、`tools/cooking_techniques_*.py` | 監査の再現性（`--check` が main 上で回る） |
| `PROJECT_HANDOFF.md` の Cooking Techniques 節 | 新しい session の startup checklist から辿れるようにする |

代替案: SSOT と本 gate だけを取り込み、詳細文書は design branch に残す（src のコメントは SSOT を指すように直す）。量は小さいが、src の参照の修正が別途必要になる。

SSOT に固定した原則とその対応（ご指定の 11 項目）:

| ご指定 | SSOT |
|---|---|
| Recipe discovery = what / Technique discovery = how | P1 |
| Technique は購入・直接教授しない | P2 |
| recipe discovery と technique discovery は独立 | P3（INV-TQ-NB） |
| 同時発見時は Technique → Recipe の順 | P5 |
| Original pizza でも Technique を発見可能 | P4（INV-TQ-6） |
| discovery 前の操作は可能だが、名称・説明は出さない | P6 |
| near-miss は privacy の k 規則を守る | P7（範囲は OD-TQ1C-2） |
| Dinner / Lunch Rush では Technique discovery を発生させない | P8 |
| TQ-1 では production recipe に Technique requirement をまだ追加しない | P9 |
| INV-TQ-4 を維持する | P10 |

---

## 3. Runtime Wiring Map（STEP 3）

行番号は main `bcac961` のもの。

| # | 論点 | 設計（TQ-1C） | 根拠（main） |
|---|---|---|---|
| 1 | detection を呼ぶタイミング | **REGISTER_TO_DEX の中だけ**（RESULT → DISCOVERED の 1 遷移）。CONFIRM_BAKE では呼ばない（CONFIRM_BAKE の段階では、まだ「成功」が確定していない） | `gameReducer.ts:1237`。FREE は `handleConfirmBake` の直後に REGISTER_TO_DEX を dispatch する |
| 2 | successful cooking の定義 | REGISTER_TO_DEX が受理された round のうち、(a) **ORIGINAL**: recipe を使わない Completion Gate が PASS し、`resolveFreeCookPizza` が `ORIGINAL`（`:1258-1263`）、または (b) **一致したレシピ**: `score` が非 null で、`completion` が FAILED でない（`:1264-1277`）。AMBIGUOUS / INCOMPLETE_MATCH / FAILED は発見 0（fail-closed）。#275 の焼成失敗による CUT skip も FAILED なので 0 | 既存の exactly-once guard（`phase === "RESULT"`）をそのまま使う |
| 3 | ORIGINAL での技法発見 | ORIGINAL 分岐（`:1258-1263`）の中で `registerTechniqueDiscovery({matchedTarget: null, completionPassed: true, isAffordanceOpen})` を呼ぶ。Dex / Pitz は今までどおり触らない | Owner Decision Gate §8 の ORIGINAL 経路 |
| 4 | 同時発見の表示順 | TQ-1C は transient な `lastTechniqueDiscovery: TechniqueId[]`（registry 順）を、`lastDiscovery` と**同じ遷移で**立てる。表示順は pure selector `discoveryRevealOrder(state) → ["TECHNIQUE", "RECIPE"]` で固定し、UI（技法段）は TQ-1D で実装する | P5 |
| 5 | `discoveredTechniqueIds` への保存 | `GameState.discoveredTechniqueIds`（新設）を REGISTER_TO_DEX で更新する。App の `persistProgress` の snapshot に `discoveredTechniqueIds` を渡し、effect の deps にも加える。**dex / pitz と同じ 1 回の write** | `App.tsx:349-381`、`persistence.ts:1070-1075`（union） |
| 6 | reload 後の再表示防止 | `lastTechniqueDiscovery` は保存しない（`lastDiscovery` と同じ扱い）。台帳は保存済みなので、次の round で `registerTechniqueDiscovery` が同じ技法を再び報告することはない（INV-TQ-2） | `registration.ts:40-47` |
| 7 | Full Reset | `resetSave` が key ごと削除し、次の mount で `[]` になる。affordance は派生値なので、別にリセットするものはない | `App.tsx:876-885`、`persistence.resetSave` |
| 8 | 未知 / 将来の id の保持 | GameState には**既知の id だけ**を持つ（`knownTechniqueIds`）。未知の id は `writeSave` の extras merge で storage 側に残る。snapshot 側は union なので下がらない | `persistence.ts:711, 782-785` |
| 9 | Dinner / Lunch Rush の除外 | technique registration の呼び出しは REGISTER_TO_DEX の `!state.isMissionRound` の内側にだけ置く。Dinner は、(a) REGISTER_TO_DEX を reducer の guard 集合で拒否し（`:1755-1771`）、(b) case ごとの `isDinnerRound` backstop（`:1251`）もある。二重に遮断されている。`MISSION_NEXT_ORDER` は台帳に触れない | §4 |
| 10 | Free Cooking だけで発見する境界 | **使用経路**（`detectTechniquesUsed` × affordance）は `state.freeCook === true` の時だけ。**レシピ経路**（INV-TQ-1）の扱いは OD-TQ1C-3 | Owner Decision Gate §8 |
| 11 | INV-TQ-4 | affordance = `techniqueAffordanceStep("no-sauce", RECIPE_DISCOVERY_CATALOG, id => starter ? 0 : materialLadderStep(id))`。**実測: 25 target 中、技法を要求するものは 0。affordance は `null`** → 使用経路は常に閉じ、レシピ経路も要求 0。**TQ-1C は production で何も記録しない** | 本 gate で実測（§8） |
| 12 | TQ-1A をどこで接続するか | 5 か所（下表） | — |

### TQ-1A の接続点（TQ-1C の変更予定ファイル）

| ファイル | 変更 |
|---|---|
| `src/state/gameReducer.ts` | `GameState` に `discoveredTechniqueIds` と `lastTechniqueDiscovery` を追加。`createInitialGameState` に引数を追加。`ProgressionCarry` と `carryOf` で運ぶ。REGISTER_TO_DEX の 2 つの出口（ORIGINAL と一致レシピ）から `registerTechniqueDiscovery` を呼ぶ。新しい round（`buildOrderState`）で `lastTechniqueDiscovery = null` に戻す |
| `src/App.tsx` | 初期化時に `save.discoveredTechniqueIds` を渡し、`backfillTechniqueLedger(ledger, 発見済み target)` を適用する（INV-TQ-1、今は no-op）。`persistProgress` の snapshot と deps に追加する |
| `src/logic/techniques/affordance.ts`（新規、pure） | catalog と ladder から affordance step を派生させ、`isAffordanceOpen(id, discoveredCount)` を提供する。`discoveredCount` には **round 前の Dex** を使う |
| `src/state/discoveryReveal.ts`（新規、pure） | `discoveryRevealOrder` |
| `src/state/resultNearMiss.ts` | OD-TQ1C-2 の結論による（推奨案では TQ-1C で変更しない） |

`discovery/**`、`discoveryCatalog`、`recipes`、`completionGate`、`discoveryRegistration`、`scoringV2/**`、`pitzReward`、`dex.ts` は**変更しない**（architecture test の対象）。

---

## 4. DM-4-3 Atomic Save Gate（STEP 4）

| 観点 | 監査結果 |
|---|---|
| 書き込み単位 | App の effect 1 回 = `persistProgress` 1 回 = `writeSave` 1 回。dex、pitz、台帳、Dinner records は **同じ snapshot** に入る |
| 拒否時 | `persistProgress` は `requireDinnerRecords && refused` の時、`writeSave` の前に return する（`persistence.ts:1080`）。`writeSave` も storage に対して再検査し、拒否なら `setItem` をしない（`:750-753`）。**どちらの拒否でも何も書かれない**。台帳だけ、あるいは dex だけが保存される経路はない |
| 拒否後 | `DINNER_RECORDS_REFUSED` → state が変わる → effect が再実行され、台帳を含む残りが（union で）書かれる。台帳は下がらない |
| Dinner で技法が起きない保証 | **runtime guard**: (1) REGISTER_TO_DEX は Dinner の guard 集合にあるので拒否される。(2) case ごとの `isDinnerRound` backstop。(3) TQ-1C では、technique registration を `!isMissionRound && !isDinnerRound(state)` の内側にだけ置き、さらに自前の assert（Dinner なら台帳を変えない）を足す。**test**: Dinner の CLEAR / FAIL / 放棄の全経路で、台帳と `lastTechniqueDiscovery` が不変であること |
| 部分保存の否定 test | 「FREE で技法を発見した直後の write」と「Dinner record の拒否」が同じ effect で起きた場合 → storage は完全に不変、その後の再試行で台帳と dex が一緒に保存される |

**結論:** DM-4-3 との統合で新しく設計する箇所はない。台帳は既存の snapshot に 1 field 足すだけで all-or-nothing に乗る。

---

## 5. Conflict Map（STEP 5）

| ファイル | TQ-1C | #284（merged） | #275（open） | 判定 |
|---|---|---|---|---|
| `gameReducer.ts` | REGISTER_TO_DEX、`GameState`、carry、init | 変更なし | import ブロック、CONFIRM_BAKE の CUT skip、Dinner resolve | **hunk は別**。import ブロックは textual に衝突しうるが自明に解ける |
| `resultNearMiss.ts` | OD-TQ1C-2 による | 変更なし | 変更なし | 衝突なし |
| `App.tsx` | 初期化、persist の snapshot と deps | `family` を渡す（merged） | 変更なし | 衝突なし |
| `persistence.ts` | 変更なし（TQ-1A で完了） | 変更なし | 変更なし | 衝突なし |
| Hint privacy（`discovery/*`） | 変更なし | presentation のみ | 変更なし | 衝突なし |
| `completionGate.ts` | 変更なし | — | `bakeCompletionFailure` の追加 | 衝突なし。意味上も整合する（焼成失敗 → FAILED → 技法 0） |

**順序:** #284 は merged なので、block はない。#275 との順序はどちらでもよい。**推奨: TQ-1C は、実装する時点の最新 main を取り込んでから着手する**。#275 が先に merge されれば、その CUT skip も焼成失敗の test に含める。

---

## 6. Privacy Gate（STEP 5 続き）

### 6.1 検証した案: SAUCE_ONLY を含む技法関連の文言すべてに k 規則を一律に適用する

main の `resultNearMiss` で、技法の軸を示すのは **SAUCE_ONLY だけ**（ADD_ONE / REMOVE_ONE / CLOSE / FAR_KEY_UNUSED は、ソースや技法の軸を名指ししない）。したがって「一律に適用する」とは、**SAUCE_ONLY を出す前に毎回 `sauceAxisAnswerCount ≥ 2` を要求し、k < 2 なら fallback にする**ことを意味する。

**実測**（main `bcac961`、canonical ladder の step 0〜24。所持 = starters ＋その step までの材料、所持品はすべて在庫あり。各 DISCOVERABLE target について、その target とはソースだけが違うピザ（ソース無し、または所持している他のソース）を作り、`classifyNearMiss` → `sauceAxisAnswerCount` を計算した）:

| 指標 | 値 |
|---|---|
| SAUCE_ONLY が出るケース | 44 |
| そのうち k < 2（一律に適用すると fallback に変わる） | **12（27%）**。すべて「ソースを塗り忘れた」ピザで、所持しているソースがトマトだけの step 1〜12 に集中している |

**評価:**

| 観点 | 一律に適用 | 技法に限定（Owner Decision Gate §7.3） |
|---|---|---|
| 今の production の文言 | **変わる**（上記の 12 ケースで「ソースを変えると…」が fallback になる）→ UI/UX の変更なので HV policy の対象になる。TQ-1C は不活性ではなくなる | 変わらない（技法を要求する target が 0 なので no-op） |
| side channel | ない（k だけで決まり、target が技法を要求するかどうかに依存しない） | ある: TQ-1D 以降、同じ k < 2 の状況で「sauce レシピなら SAUCE_ONLY、技法レシピなら fallback」になり、fallback の出現そのものが「近くに技法レシピがある」ことを示唆しうる |
| 実装 | `resultNearMiss` だけで完結する（`discovery/**` は不変） | 最近傍 target の id を `classifyNearMiss` から外に出す必要がある（`discovery/nearMiss.ts` の変更。architecture test の範囲内だが、match 側 module を触る） |
| onboarding | 「ソースを塗り忘れた」時の具体的な誘導が消え、「おしい！」だけが残る | 今のまま |
| Owner の文言（OD-TQ-P1） | 文字どおりに一致する（「候補 ≥ 2 の時だけ軸別の guidance を許す」） | §7.3 の限定条件付きの解釈 |

**推奨（OD-TQ1C-2 = 案 α）:** **一律に適用する（fail-closed、side channel なし）**。ただし production の文言が変わるので、**TQ-1C には入れず、HV を伴う TQ-1D の PR に含める**（TQ-1D で loop を有効にするのと同時に文言が変わるので、HV を 1 回で済ませられる）。TQ-1C は不活性のまま保つ。

代替案:

- **β:** 一律に適用し、TQ-1C に入れる（HV 必須）。
- **γ:** 技法に限定し、TQ-1C に入れる（不活性。side channel は残る）。

### 6.2 k < 2 の時の fail-closed

k < 2 の時は SAUCE_ONLY を出さず、fallback「おしい！あと少し、なにかが違うみたい…？」を出す。

- 軸名（ソース）、技法名、具体操作は含めない。
- 所持しているソースは単調に増えるだけなので、一度 k ≥ 2 で出した文言が後で k < 2 に戻ることはない（DH4 と同じく単調に安全）。
- k の計算で `NaN` や非有限値が出た場合も fallback にする（`axisGuidanceAllowed` がすでにそう実装している）。

### 6.3 TQ-1D への持ち越し（TQ-1C では到達しない）

no-sauce の target が production に現れるのは TQ-1D。次は TQ-1D の Fresh Audit で再確認する:

- DH4 の「ソース」family が no-sauce target に何と答えるか;
- Selectable Hint の sauce category;
- Hint 2.0 の `COUNT_CHEESE` 行（「材料は全部で N 種類」）。OD-TQ-P2 で許容済み。

---

## 7. Scoring / Reference Boundary（STEP 6）

**TQ-1C では scoring / Reference は変更不要。**

| 項目 | TQ-1C での扱い |
|---|---|
| frozen な Reference registry、readonly な `ReferencePizza` | 読みもしない（技法は Reference を使わない） |
| freeze された weight profiles | 触らない |
| canonical な pieceGroups、`minCount` と positions の整合、canonical な tolerance band、ingredient ごとの tolerance、canonical な sauce target | 触らない |
| 既存 25 recipe の parity | `scoreParity.main-7bb0116.json` の test が TQ-1C の CI でも走る。変化があれば fail |
| `ReferencePizza.sauce` の nullable 化 | **行わない**（TQ-1D） |
| INV-TQ-3 | architecture test（`scoringV2/**`、`pitzReward`、`scoring`、`mastery`、`dex.ts` は技法に言及しない）が TQ-1C の変更も検査する |

---

## 8. Test / Mutation / E2E Plan（STEP 7）

reducer の test は、production catalog（不活性の確認）と、注入した synthetic catalog / affordance（loop 全体の確認）の 2 系統で行う。technique registration の入口は、catalog と affordance 関数を注入できる形にする（`discovery/**` は変えない）。

| # | ケース | 期待 |
|---|---|---|
| T1 | first technique discovery（synthetic、ORIGINAL、affordance open） | 台帳 `["no-sauce"]`、`lastTechniqueDiscovery = ["no-sauce"]` |
| T2 | repeat | 2 回目の round では `lastTechniqueDiscovery = []`、台帳は不変 |
| T3 | REGISTER_TO_DEX の二重 dispatch | 2 回目は state が不変（既存の RESULT guard） |
| T4 | technique と recipe の同時発見（synthetic の no-sauce recipe に一致） | 同じ遷移で `lastDiscovery.kind = NEW_DISCOVERY` と `lastTechniqueDiscovery = ["no-sauce"]`。affordance が閉じていても記録される（INV-TQ-1） |
| T5 | 表示順 | `discoveryRevealOrder` = `["TECHNIQUE", "RECIPE"]`（技法のみ → `["TECHNIQUE"]`、レシピのみ → `["RECIPE"]`） |
| T6 | ORIGINAL で affordance が閉じている | 記録しない（INV-TQ-6） |
| T7 | invalid / failed pizza | Completion Gate が FAILED（欠品、生焼け、焦げ、#275 の CUT skip）、AMBIGUOUS、INCOMPLETE_MATCH、空のピザ → 記録 0 |
| T8 | Lunch Rush | `MISSION_NEXT_ORDER` と Lunch Rush round の REGISTER_TO_DEX で台帳が不変 |
| T9 | Dinner | CLEAR / FAIL / 時間切れ / 放棄で台帳と `lastTechniqueDiscovery` が不変。REGISTER_TO_DEX は拒否される |
| T10 | guided round | OD-TQ1C-3 の結論どおり（推奨案: 使用経路は 0。レシピ経路は INV-TQ-1 のとおり記録する） |
| T11 | reload | 保存 → 再 mount → 台帳は保持され、`lastTechniqueDiscovery` は `[]`。再 bake しても再発見しない |
| T12 | Full Reset | `[]` に戻る |
| T13 | 未知 / 将来の id | 未知の id を含む save → GameState には既知の id だけ → write 後も storage に未知の id が残る |
| T14 | DM-4-3 | 技法の発見と Dinner record の拒否が同時 → storage 完全に不変 → 再試行で台帳と dex が一緒に保存される |
| T15 | k < 2 の privacy | OD-TQ1C-2 による（案 α なら TQ-1D の test。pure 部分は TQ-1A で test 済み） |
| T16 | INV-TQ-4（production） | production catalog の affordance は `null`。production で「ソースを塗らないオリジナルピザ」を作っても台帳は `[]`。すべての production target で `requiredTechniquesOf = []` |
| T17 | 現行 production の挙動が不変 | 既存の reducer / App / e2e test がすべて pass。`lastDiscovery`、Dex、Pitz、★ の結果は TQ-1C 前と deep-equal（production catalog の全 target の ideal pizza × FREE / guided で比較） |
| T18 | 25 recipe の scoring parity | `scoringV2.noSauceParity.test.ts`（225 行）が pass |
| T19 | load 時の backfill | 壊れた save（Dex に synthetic no-sauce recipe、台帳は空）→ load 後の台帳が `["no-sauce"]`。production では no-op |
| T20 | architecture | 既存 test を維持する。加えて `resultNearMiss.ts` 以外の `state/*` の表示用 module が台帳を直接読まないこと |

**Mutation targets**（手で入れて失敗を確認し、元に戻す）:

- M1: 使用経路の affordance 条件を削除 → T6 と T16 が fail。
- M2: `!isMissionRound` の guard を削除 → T8 が fail。
- M3: Dinner の自前 assert を削除し、Dinner の guard 集合から REGISTER_TO_DEX を外す → T9 が fail。
- M4: `lastTechniqueDiscovery` を保存対象にする → T11 が fail。
- M5: persist の deps から台帳を外す → T11 と T14 が fail。
- M6: `completionPassed` を true に固定 → T7 が fail。
- M7: レシピ経路を削除 → T4 と T19 が fail。

**E2E:** TQ-1C は不活性で UI も変えないので、**新しい e2e は不要**（既存の WebKit / Layout Contract が退行を検出する）。loop 全体の e2e（ソースを飛ばして Aussie → 技法段 → レシピ段 → Dex → reload → retry）は TQ-1D で行う。**HV:** 案 α なら TQ-1C は UI/UX/gameplay の変更を持たないので、policy の対象外（Result Report に明記する）。

---

## 9. Owner Decisions

| ID | 論点 | 推奨 | 代替案 |
|---|---|---|---|
| **OD-TQ1C-1** | authority の取り込み | TQ-1C の前に、SSOT、設計 3 文書、本 gate、data / tools、handoff 節を docs-only PR で main へ入れる | SSOT と本 gate だけを入れ、src のコメントを SSOT 参照に直す |
| **OD-TQ1C-2** | near-miss の k 規則の範囲と時期 | **α: SAUCE_ONLY に一律で適用し、TQ-1D（HV あり）で出す**。TQ-1C は不活性のまま | β: 一律に適用し TQ-1C で出す（HV 必須）。γ: 技法に限定し TQ-1C で出す（side channel が残る） |
| **OD-TQ1C-3** | guided round（Free Cooking 以外の FREE） | **使用経路（オリジナルな使い方の認識）は Free Cooking だけ。レシピ経路（INV-TQ-1）は、レシピを新しく発見しうる FREE の全 round で記録する**。authority の「guided: 検出しない」を「guided では使用経路を検出しない」と明確にする。Lunch Rush と Dinner は両経路とも 0 | guided では両経路とも 0 にし、INV-TQ-1 は load 時の backfill だけで保証する（次の load まで一時的に INV-TQ-1 が破れる） |

OD-TQ1C-3 の背景: main の REGISTER_TO_DEX は、guided round でも `evaluateDiscovery` → `registerDiscoveryToDex` で、選んだレシピとは**別のレシピを新しく発見しうる**（`gameReducer.ts:1280-1308`）。そのレシピが技法を要求していた場合（TQ-1D 以降）、guided で何も記録しないと、INV-TQ-1（発見済みのレシピ ⇒ その技法も発見済み）がその session の間だけ破れる。

---

## 10. Implementation Slices

| Slice | 内容 | 依存 | HV |
|---|---|---|---|
| **TQ-1C-0**（docs-only） | OD-TQ1C-1 の取り込み PR | Owner の承認 | 不要 |
| **TQ-1C**（runtime wiring、不活性） | §3 の 5 ファイル。`GameState` と carry、REGISTER_TO_DEX の 2 出口、App の init / backfill / persist、pure affordance、reveal order。tests T1〜T14、T16〜T20 と M1〜M7 | TQ-1C-0、最新 main | 不要（UI 変更なし。Result Report に明記） |
| TQ-1D | Aussie、`ReferencePizza.sauce` の nullable 化、技法段、Dex の「調理法」、RESULT の sauce 行、near-miss の k 規則（案 α）、DH4 / Selectable の no-sauce 監査 | TQ-1C | 必要 |
| TQ-1E | HV（390×844 動画、スクショ、R-S1 の★の体感） | TQ-1D | 本体 |

Issue: TQ-1C の Issue は未作成（duplicate gate: 0 件）。**作成を提案する**が、Owner Decision の後にする（本 gate では作らない）。

---

## 11. Final Verdict

**B. OWNER DECISIONS REQUIRED** — OD-TQ1C-1（authority の main への取り込み）、OD-TQ1C-2（near-miss の k 規則の範囲と時期）、OD-TQ1C-3（guided round のレシピ経路）。

- #284 は merged、#260 は blocker ではない、#275 との衝突は自明な範囲。したがって C ではない。
- 設計の見直しは不要。したがって D ではない。
- 3 件が推奨どおり承認されれば、**A. TQ-1C READY FOR IMPLEMENTATION**（TQ-1C-0 の docs-only PR の後）。
