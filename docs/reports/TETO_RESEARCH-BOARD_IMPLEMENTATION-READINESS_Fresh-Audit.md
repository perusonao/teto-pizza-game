# Research Board — Implementation Readiness Fresh Audit（READ-ONLY / docs-only）

- Audited main: **`9e7484b39fd81c31e8b84a18c6b961f5f3bc24a8`**（`origin/main`、#404 DEV State Editor merge、2026-10-06 00:55 JST）
- Audit branch: `claude/research-board-fresh-audit-cs5djx`（main から切った docs-only branch。本ファイル 1 つだけを追加）
- 日付: 2026-10-05（Owner の Research 2.0 Gate 承認日と同日の post-#404 再確認）
- 手法: 静的読解のみ。`node_modules` なし、test / build / CI / Preview は実行していない。実装・Issue・PR なし。
- 並行作業の保護: PR #401（head `abb323b`、base `a0bc900`）は **変更・checkout・merge・rebase していない**（変更ファイル一覧の読み取りのみ）。
  Cooking Steps audit branch `claude/teto-cooking-steps-audit-alf9mi`（`8739b90`）にも触れていない。

## 0. 判定サマリ

| 項目 | 結果 |
|---|---|
| Research Board authority | `docs/decisions/TETO_RESEARCH-2.0_OWNER-DECISIONS.md`（OD-R1-1〜4 / OD-R3-1〜3 / INV-B1〜B9）＋ Anti-Oracle Contract 2.1。設計の再オーサリングはしていない |
| 設計 vs 最新 main | 中核（ledger 方針・schemaVersion 2・加算 key・INV-B1〜B9）は **STILL VALID**。食い違いは文言ステータス 3 件（STALE）、Notebook footer の copy 1 件（CONFLICT）、DEV State Editor の取り扱い 1 件（CONFLICT・技術的に解消可能）、設計細部 3 件（OWNER DECISION REQUIRED） |
| schema migration | **不要**（v1→v2 step・`schemaVersion` bump ともに不要。新 key は加算のみ） |
| persistence 変更 | 必要（`persistence.ts` に加算 ledger 1 つ。§3） |
| #401 競合 | 実装 Phase 2（domain/storage）は **ファイル競合ゼロ**。Phase 3（UI）は `GameScreen.tsx` / `App.css` / `PROJECT_HANDOFF.md` が #401 と重なる（§9） |
| STOP 条件 | #401 / Cooking Steps 変更 = 不要、schema migration = 不要、privacy contract = 満たせる。**Owner 判断なしで解消できない authority 差分が Phase 3 に 3 件**（§6） |
| **実装開始可否** | **Phase 2（S1〜S3）= GO ／ Phase 3（Notebook UI）= HOLD（§6 の OD-RBF-1〜3 待ち）** |

## 1. Authority と分類の凡例

優先順: Research 2.0 Owner Decisions（2026-10-05）＞ Contract 2.1 のうち同書が上書きしない部分 ＞ 現行コード。
分類: **STILL VALID**（最新 main でも成立）／ **STALE**（事実関係が古い。仕様は不変）／ **CONFLICT**（設計と最新 main の食い違い）／ **OWNER DECISION REQUIRED**。

## 2. 監査対象ごとの確認（最新 main）

| 対象 | main での事実 | 分類 |
|---|---|---|
| Research 2.0 Phase 0 + 1 | #402（`a0bc900`）で **merge 済み**。`researchEntryLabel` が唯一の label authority | STILL VALID |
| Owner Decisions 文書の status 欄 | 「Phase 0 + 1 が実装対象」「本 PR」「基準 main `d144f08`」のまま。実際は #402 merge 済み、現 main は `9e7484b` | **STALE**（文言のみ） |
| `PROJECT_HANDOFF.md` addendum 5 | 「PR pending Final Gate」「Phase 1 (this PR)」のまま | **STALE**（文言のみ） |
| Owner Decisions §6 の「Phase 2 まで ×は session のみ」 | 現行コードは× を **永続化していない**（`researchResultRows` の `persistFactIds` は POSITIVE のみ）。Contract 2.1 §6 の記述が現行挙動 | STILL VALID |
| `deriveResearchEntries` / `researchCohortLetters` / `researchLetter` / `researchEntryLabel`（`src/logic/discovery/researchEntry.ts`） | 導出のみ・save しない。`opaqueHash`（FNV-1a）で cohort 内 sort。`ResearchEntry` に recipe 名 / No. / count は無い | STILL VALID |
| Research Hint / Hint authority | `discoveryHintFacts`（`ing:<id>`、`cls:<id>`、`meta:ingredient-total`）が○と△の唯一の保存元。Hint の価格・ladder・ALREADY_KNOWN は× を読まない | STILL VALID |
| Notebook | `trialNotebook` は session-only。`TrialNotebookSheet` は GameScreen 経由で HintSheet / RESULT から開く read-only。`feedback` は `{kind, textJa}`。`trialNotebook.gate.test.ts` が **importer allow-list**（`trialRecord.ts` / `gameReducer.ts` / `GameScreen.tsx` / `HintSheet.tsx` / `TrialNotebookSheet.tsx` / `trialNotebookDiff.ts`）を固定 | STILL VALID（制約として §7 に反映） |
| `persistence.ts` | `schemaVersion` は 1 or 2 のみ認識。加算 key は `KNOWN_SAVE_KEYS` への追加と `writeSave` の merge で扱う確立パターンあり（`discoveryHintFacts` / `dinnerMissionRecords`） | STILL VALID |
| 未知 top-level key の保持 | `extractForwardCompatExtras` が `KNOWN_SAVE_KEYS` 外の key を verbatim 保持。未知 recipe / ingredient id も `SAVE_ID_PATTERN` を満たせば保持 | STILL VALID |
| Discovery state / Research state | `RecipeDiscoveryState` と `RecipeResearchState` は直交。Board は後者の derived のみを読む | STILL VALID |
| ORIGINAL 結果 | `REGISTER_TO_DEX` の free-cook ORIGINAL 分岐（`gameReducer.ts:1351–1379`）で `researchAttemptResult` → `discoveryHintFacts` に○だけ追加。RESULT guard により exactly-once | STILL VALID |
| FAILED 結果 | `CONFIRM_BAKE` の非 MATCHED 分岐（`:1229–1251`）で `phase: "RESULT"` へ。`REGISTER_TO_DEX` は FAILED で `state.completion.status !== "PASS"` → return。**研究記録は未実装**（OD-R3 = Phase 4） | STILL VALID |
| inventory consumption | FAILED でも `consumePizzaInventory` は実行される（`:1247`）。OD-R3-2 と一致 | STILL VALID |
| Technique discovery | 研究記録とは別経路（`roundTechniques`）。ORIGINAL かつ outcome が `ORIGINAL` のときだけ。AMBIGUOUS / INCOMPLETE は発見なし | STILL VALID |
| Pitz reward | free-cook ORIGINAL は無報酬。FAILED も無報酬。Board は Pitz に触れない | STILL VALID |
| #398 NO_SAUCE（`aussie`） | `researchResultRows` が「sauce row はプレイヤーが sauce を使ったときだけ」「『ソースなし』と言わない」を明示。INV-D7 / OD-TQ1D-4 維持 | STILL VALID（§5 に privacy 整合） |
| #402 Cohort Letter | label は unlock 材料名 + letter のみ。×ledger は recipe id キーで label を持たない（Owner §4） | STILL VALID |
| #404 DEV State Editor | `EditableState` は 9 field。`HANDLED_TOP_LEVEL_KEYS` に新 key は無い。**新 key の入れ方次第で ledger が消える**（§4） | **CONFLICT**（技術的、§4.5） |
| #401 Family Filter 境界 | #401 は Cooking Tray の chip row（`IngredientTray` / `ShelfChipRow` / `chipRowAlign` / `prepareDock` / `GameScreen.tsx` / `App.css` / e2e / docs）。persistence・reducer・devtools・Notebook に触れない | STILL VALID（§9） |
| 現行 32 recipes | `RECIPES` は 32 件（margherita … aussie）。ledger の key は recipe id だが、どの導出も件数に依存しない | STILL VALID |
| 172 recipe への前方互換 | §8 | 下記 |

## 3. persisted negative ledger の最小データ構造

Owner が承認した形（OD-R1-2 / §5）に **そのまま従う**。追加の設計はしない。

```
researchExclusions: { [recipeId: string]: string[] }   // value = ingredient id（sauce / cheese / topping 共通）
```

- 新しい **top-level key**。`schemaVersion` は **2 のまま**。`KNOWN_SAVE_KEYS` に追加。
- 値は表示済み NEGATIVE の ingredient id の**集合**（重複なし、順序は初出）。
- merge は recipe ごとの **set union**（削除しない）。`persistProgress` の `ProgressionSnapshot` に optional field として追加（`discoveryHintFacts` と同じ流儀: 未指定なら stored を維持）。
- 全リセットは `resetSave`（key ごと消す）で自動的に消える。
- sanitize: recipe key は `SAVE_ID_PATTERN`、値は `SAVE_ID_PATTERN` を満たす string のみ。**既知 recipe の stale な× は読み込み時には消さず、表示時に静かに外す**（Owner §5。保存はしない・書き換えない）。
- 未知 recipe id / 未知 ingredient id は `extractForwardCompatExtras` 系で verbatim 保持（`discoveryHintFacts` と同形の `hintFactsFor`-like helper）。
- **`discoveryHintFacts` には× を絶対に入れない**（INV-B9）。`ing:` prefix も使わない（Hint ledger との混線防止。値は bare id）。
- **per-recipe cap は 64 を流用しない**。`MAX_STORED_HINT_FACTS_PER_RECIPE = 64` は「1 recipe の fact 数」の上限で、× は「試して外れた材料数」なので 172 population（材料 168）で 64 を超え得る。専用 cap（カタログ全材料数以上、例 256）を別定数で持つこと（§8 参照）。
- 保存形の「書き込み有無」: **空のときは key を書かない**（`dinnerMissionRecords` の precedent「持っていない save は key なしのまま」）。理由は §4.5（DEV State Editor）。
- migration: 旧 save（key なし）= 空 ledger。v1→v2 の `migrateV1toV2` は変更不要（key なしで足りる）。

## 4. 質問 1〜12 への回答

### 4.1 Board を追加するために必要な runtime 変更箇所

| 層 | ファイル | 変更 |
|---|---|---|
| domain | 新規 `src/logic/discovery/researchBoard.ts`（read model）、新規 `researchExclusions.ts`（ledger の純粋 helper） | read model: `deriveResearchEntries` + `discoveryHintFacts`（○ `ing:` / 購入済み `cls:` / `meta:ingredient-total`）+ ledger（×）→ Board view |
| writer | `src/state/gameReducer.ts` `researchAttemptResult`（`:1815`）に **NEGATIVE rows の追記** を足す（返り値に `researchExclusions` を追加） | `REGISTER_TO_DEX` の ORIGINAL 分岐で state に反映 |
| state | `GameState` / `ProgressionCarry` / `carryOf` / `createInitialGameState`（現在 10 個の positional 引数）に field 追加 | 引数追加は呼び出し元（`App.tsx` 1 箇所 + test）に波及 |
| persistence | `persistence.ts`: `PersistentSaveV2`・`createDefaultSave`・`sanitizeSave`・`KNOWN_SAVE_KEYS`・`extractForwardCompatExtras`・`writeSave`・`ProgressionSnapshot`・`persistProgress` | §3 |
| App | `App.tsx`: 初期 state への受け渡しと `persistProgress` の snapshot / effect deps に追加 | 数行 |
| UI（Phase 3） | `TrialNotebookSheet.tsx` に Board section（新 component `ResearchBoard.tsx`）、`HintSheet.tsx` / `GameScreen.tsx` に props 中継、CSS | §9 |
| devtools | `saveMerge.ts`（§4.5） | 小 |
| tests/gates | 新 gate（§7）、`trialNotebook.gate.test.ts` の allow-list 影響の確認 | |

### 4.2 persisted negative ledger の最小データ構造
§3 の通り。

### 4.3 schemaVersion 2 を維持できるか
**できる。** 認識する `schemaVersion` は 1 と 2 のみで、加算 key は `KNOWN_SAVE_KEYS` に足すだけ（EP4 / H3-2 / TQ-1A / DM-4-2 が同じ手順で入った precedent）。bump すると `toIntermediateV2` が未認識 version を fresh default に落とすため、**bump は逆に禁止**（旧 build が全 progression を失う）。

### 4.4 unknown IDs / unknown keys を保持できるか
**できる。** 1) 旧 build が新 key を知らない場合: `extractForwardCompatExtras` が未知 top-level key として verbatim 持ち回る。2) 新 build が将来の recipe / ingredient id を見る場合: `SAVE_ID_PATTERN` を満たす未知 id は `writeSave` の merge で union 保持（`discoveryHintFacts` と同形）。3) `KNOWN_SAVE_KEYS` に入れた新 key は `extras.topLevel` から外れるため、`dinnerMissionRecordsRaw` と同様に **stored の生値を読み出して write 時に union** する経路を足すこと（足さないと未知 id が消える）。

### 4.5 DEV State Editor が新 ledger を壊さず保持できるか — **CONFLICT（技術的・解消可能）**
- `EditableState`（9 field）に ledger は無い。ledger は編集対象外 = **保持対象**。
- `mergeEditedSave` は `Object.assign(out, preservedExtras, base)` で **canonical（`persistProgress` を空の scratch storage に走らせた出力）が preservedExtras を上書き**する。
  - 新 key を「常に `{}` で書く」設計にすると canonical が `researchExclusions: {}` を出し、**stored の ledger が消える**。
  - 「空なら書かない」設計（§3）なら canonical は key を出さず、`HANDLED_TOP_LEVEL_KEYS` 外の未知 key として preserved される（現状のままでも壊れない）。
- ただし `ReviewPanel` の「未知のキー / 未知の id を保持」チェックボックスを OFF にすると未知 key として落ちる。Board ledger は game-owned の progression なので、`missionBest` / `dinnerMissionRecords` と同様に **`HANDLED_TOP_LEVEL_KEYS` に明示して常に stored から持ち回す**のが安全（`preserveUnknown` と独立）。
- 必要な変更: `saveMerge.ts` の `HANDLED_TOP_LEVEL_KEYS` に追加 + 持ち回りの 3 行 + `saveMerge.test.ts` / `apply.test.ts` に回帰 test（新 key あり / なし、`preserveUnknown=false`、`verify` 経路）。`apply.ts` の verify（`editableFromSave(loadSave) == loadCanonical`）は `EditableState` に ledger が無いので影響なし。
- HV 用: 現行 preset（`step12-abc-undiscovered` / `step12-b-discovered` ほか）は ledger を出さない。× 入りの Board を作るには **実プレイで× を出す**か preset を足す。preset への ledger 追加は devtools の仕様変更なので OWNER DECISION（OD-RBF-3）。

### 4.6 Cohort Letter との privacy 整合 — **整合する（STILL VALID）**
- ledger は recipe id キーで、label・letter・hash を保存しない（Owner §4）。letter は導出のみで catalog revision に追従する。
- Board の見出しは既存の `researchLabelJa`（label authority）をそのまま使う。Board 専用の識別子・並び・件数を作らない。
- 注意: ledger の key に recipe id が入る点は INV-B7 の文言（「recipe id を … persistence へ出さない」）と**字面で衝突**するが、INV-B7 の主語は「label」であり、`discoveryHintFacts`・`discoveryHintPurchases` も同じ recipe-id キーで既に保存されている。Owner §4 が「recipe id キーで label を持たない」と明記しているため **STILL VALID**。実装 PR の Result Report に「INV-B7 = label の不変条件」と明記すること。

### 4.7 NO_SAUCE との privacy 整合 — **整合する（STILL VALID）**
- × は「プレイヤーが実際に使い、画面に出た NEGATIVE row」だけ。`aussie` を target にして、プレイヤーが sauce を使えばその sauce が通常の × になる。sauce を使わなかった attempt は row ゼロで、何も書かれない（「ソースなし」の statement は生成されない）。
- Board は **カテゴリ単位の結論を持たない**（INV-B3）。具体的には: 空カテゴリの見出し・注記を出さない、「ソース: すべて除外」「ソース未確認」「チーズなし」を出さない、× が 0 件でも 「なし」 を出さない。Board の group 見出しは「そのカテゴリに表示すべき行があるときだけ」。
- 既存 gate（INV-D7 の「『なし』が DOM / aria / Notebook / save に無い」系 test）の対象に Board を含める。

### 4.8 FAILED Research 実装前でも Board 単独で実装可能か — **可能**
- 現行 writer の入口は `REGISTER_TO_DEX` の ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH だけ。そこから× を書くのが Phase 2。
- Phase 4 は同じ helper を `CONFIRM_BAKE` の FAILED 分岐から呼ぶ形で後付けできる。そのため **ledger への追記は 1 つの純粋関数に閉じる**（Phase 4 が `researchResultRows` 結果から同じ関数を呼べる）。
- 依存は Phase 2 → 3 → 4 の直列（Owner §8）。Phase 3 が Phase 4 を待つ必要はない。

### 4.9 #401 Family Filter とのファイル競合可能性
§9 の表。Phase 2 は競合ゼロ。Phase 3 は `GameScreen.tsx` / `App.css` / `PROJECT_HANDOFF.md` が重なる。

### 4.10 172 recipe へ増えた場合の問題
- **cap**: §3 の通り per-recipe cap を `MAX_STORED_HINT_FACTS_PER_RECIPE`（64）と共有しない。172 matrix は材料 168 個。
- **save サイズ**: ledger は「研究した recipe × 試した外れ材料」だけ。最大 172 × 168 id ≈ 29k 個 × ~15 byte ≈ 0.4 MB が理論上限で、localStorage（~5 MB）に対して実用上は問題にならないが、**recipe ごとの cap と recipe 数の上限（例: 既知 + 未知の合計 ≤ カタログ件数 + 余裕）を決めて sanitize で効かせる**こと。
- **letter**: ledger は letter に依存しないので、cohort letter の再 sort（Owner §4 / §7）は ledger に影響しない。ただし Board の見出し（label）は letter 変動で変わり得る → Board は label を保存しない（毎回導出）ので整合。
- **Fresh Gate の trigger（§7 of Owner doc）**: 53 / 172 population 導入前に Research identifier compatibility を再監査する義務は **別 Gate として残る**。本 Board 実装はそれを満たさない・不要にもしない。
- **stale ×**: 172 では recipe 定義の改訂が増える。表示時 drop が実際に動く（membership を読むため、Board read model の import 境界を gate で固定すること。§7）。
- **Board の表示量**: ✓ は recipe あたり最大 ~8、× は上記。表示数の上限（スクロール）は Phase 3 UI で扱う。

### 4.11 save migration が本当に不要か — **不要**
- 旧 save に key が無い = 空 ledger として扱える（加算 key の precedent）。
- 過去の attempt の × は **遡及しない**（INV-B1 = 開示 = 保存。過去に表示された× は session 消失済みで復元不可）。これは仕様であり migration 不要の根拠でもある。
- 新 build が書いた key を旧 build が持ち回ることは §4.4 で担保される。

### 4.12 INV-B1〜B9 を現在コードへ対応付け

| INV | 現在コード上の対応 | Phase 2 で必要な担保 |
|---|---|---|
| B1 書き込み = 表示された NEGATIVE のみ | `researchResultRows` の `rows`（NEGATIVE）が RESULT 表示（`lastResearchRows`）と Notebook line（`researchRowsFeedback`）の**同じ入力** | ledger 追記は `result.rows` の NEGATIVE から導出する **1 関数**にし、`persistFactIds` と対称に `persistExclusionIds` を `researchResultRows` 側から出す（別計算しない） |
| B2 未試行 / K=3 超過 / 既知は書かない | `researchResultRows` が known をスキップ、`toppingOverCap` のとき topping rows を空にする | 同上。over-cap の attempt で ledger が増えない test |
| B3 カテゴリ結論なし | 現行 UI / copy に無い（INV-D7 test が守る） | Board の group 見出し規則 + gate test（§7） |
| B4 Technique なし | Board の入力は `discoveryHintFacts` / ledger / entries のみ。Technique ledger を import しない | importer gate（§7） |
| B5 Hint の価格・可否は× に非依存 | `hint5Ladder` / `discoveryHint` は `discoveryHintFacts` を読み ledger を読まない | ledger を `discoveryHint.ts` / `hint5Ladder.ts` / `selectableHint.ts` が import しない gate |
| B6 FAILED でも byte 同一 | 未実装（Phase 4） | Phase 4 |
| B7 label は unlock 材料 + letter のみ | `researchEntryLabel`（#402 で実装・test 済み） | Board が label を独自に組み立てない（既存 label を使う） |
| B8 Notebook は Board を参照しない | `trialNotebook.ts` model は Board を知らない。UI の `TrialNotebookSheet` は別 component を **配置するだけ** | Board を `trialNotebook` model に入れない。`feedback` の `{kind, textJa}` 不変 |
| B9 save 差分は× ledger の追加のみ、× は `discoveryHintFacts` に入らない | 現行は× を保存しない | 保存 diff test（旧 save + 1 attempt → 差分 = 新 key のみ、`discoveryHintFacts` 不変） |

## 5. privacy 整合（Cohort Letter / NO_SAUCE / Anti-Oracle）のまとめ

| 禁止情報 | Board の入力に存在するか | 結論 |
|---|---|---|
| trial count / last trial | ledger・facts に無い。Notebook model は Board が読まない | 出ない |
| Technique | 入力に無い | 出ない |
| remaining candidates / hidden candidate count | `ResearchEntry` に count 無し（`totalIngredientCount` は購入済み `meta:ingredient-total` のときだけ） | △ の「総数」は購入済みのときだけ |
| 未開示 recipe identity / name / number | Board は `recipeId` を key にのみ使う（opaque）。表示は label | 出ない |
| hidden matcher 情報 | `researchResultRows` は outcome を入力に持たない | 出ない |
| 「なし」表現 | group 見出しは行があるときだけ | 規則化が必要（§7 の gate） |

## 6. 食い違い一覧と Owner 判断

### STALE（仕様は不変、文言だけ更新が必要）
- S-1 Owner Decisions 文書: status 欄が「Phase 0 + 1 が実装対象 / 本 PR / 基準 main `d144f08`」のまま（#402 は merge 済み）。
- S-2 `PROJECT_HANDOFF.md` addendum 5: 「PR pending Final Gate」「(this PR)」のまま。
- S-3 Owner Decisions §8 の Phase 表: Phase 0 / 1 が「本 PR」。
→ いずれも Phase 2 PR の docs 更新に含められる（仕様の変更ではない）。

### CONFLICT
- C-1（copy）`TrialNotebookSheet` の footer 「この記録は、ゲームを読み込みなおすと消えるよ」（`trialNotebookCopy.ts` `sessionOnly`）は sheet 全体に掛かる。Board は永続なので**偽の記述になる**。Board を sheet に置く以上、footer の掛かる範囲を「試作の履歴」だけに限定する（Board section には掛けない）必要がある。→ OD-RBF-2。
- C-2（devtools）§4.5。技術的に解消可能（ledger を「空なら書かない」＋ `HANDLED_TOP_LEVEL_KEYS` に追加）。仕様変更ではなく、Phase 2 の slice に含める。

### OWNER DECISION REQUIRED（Phase 3 = UI の前に必要。Phase 2 は不要）
- **OD-RBF-1 Board の対象範囲**: Owner 文書は「target ごとの一覧」。現行 Notebook は「いまの研究対象」1 件の header（`researchLabelJa`）を持ち、Hint sheet / RESULT からしか開けない。Board は **(A) いまの研究対象のみ** か **(B) 登録済み Research Entry すべて** か。推奨は (A)（現行の sheet 構造・1 target = 1 label に素直に載る。(B) は sheet の複数 label 化と Dex / HOME との導線が増える）。
- **OD-RBF-2 footer の文言**: C-1 の解消案（試作履歴にだけ掛かる文言へ変更。例: Board と履歴の間に区切り、footer は履歴の直下）。copy は player-facing のため Owner 確認が必要（Human Verification で確認可能）。
- **OD-RBF-3 DEV State Editor で ledger を編集 / preset 化するか**: 既定は「編集しない・常に持ち回る」（推奨。HV は実プレイで× を出す）。HV の効率を優先して Step 12 などの preset に× を足すなら devtools の仕様拡張になる。

> 上の 3 件はどれも「既存の承認済み設計を変える」ものではなく、設計の空白を埋めるもの。Owner 判断が出るまで Phase 3 は着手しない。

## 7. 必要な gate / test（Phase 2 で追加）

1. `researchExclusions` の importer allow-list gate（`persistence.ts` / `gameReducer.ts` / `App.tsx` / board read model / devtools `saveMerge.ts` のみ）。`discoveryHint.ts` / `hint5Ladder.ts` / `selectableHint.ts` / `deductionHint.ts` / `techniques/*` は **import 禁止**（INV-B4 / B5）。
2. Board read model の import gate: `trialNotebook*` を import しない（`trialNotebook.gate.test.ts` の allow-list を壊さない）。recipe の membership は stale 判定の 1 箇所だけ、出力に membership 由来の値が出ないことを test。
3. 保存 diff test: 旧 save（key なし）+ 1 attempt → 差分は `researchExclusions` のみ、`discoveryHintFacts` は○のみ増える。
4. forward-compat test: 未知 recipe key / 未知 ingredient id / 敵対 key（`__proto__`）/ 不正値（非 string・巨大・重複）を保持または drop。`persistence.forwardCompat.test.ts` と同形。
5. ledger が増える条件: RESULT に表示された NEGATIVE のみ（K=3 超過・既知・未試行で増えない）。
6. `saveMerge.test.ts` / `apply.test.ts`: §4.5 の回帰。
7. e2e（privacy）: 2 attempt（× を出す）→ reload → ledger が残る、Notebook 履歴は消える、DOM / aria / save に recipe 名 / No. / 件数 / 「なし」が無い。

## 8. 172 recipe 前方互換（まとめ）

| 懸念 | 影響 | 対応 |
|---|---|---|
| per-recipe cap | 64 では不足し得る | 別 cap（カタログ全材料数以上） |
| letter 変動 | ledger に無影響 | 保存しない（Owner §4） |
| stale × 増加 | 表示時 drop が頻発 | 保存は不変・表示のみ。read model の gate |
| unlock 名の情報量 | 材料 168 個のうち 98 個が 1 recipe 専用 → unlock 名が recipe を特定し得る | **Board の問題ではなく label（#402）の既知の再監査 trigger（Owner §7）**。53 / 172 導入前の Fresh Gate で扱う |
| save サイズ | 理論上限でも ~0.4 MB | recipe 数 / per-recipe cap を sanitize で固定 |

## 9. #401 との競合リスク

PR #401（head `abb323b`、base `a0bc900`）の変更ファイル: `src/App.css` / `src/components/IngredientTray.tsx` / `ShelfChipRow.tsx`(+test) / `IngredientTray.familyFilter.test.tsx` / `src/logic/chipRowAlign.ts`(+test) / `prepareDock.ts`(+test) / `src/screens/GameScreen.tsx` / e2e 6 本 + `e2e/support/familyTray.ts` / docs（`PROJECT_HANDOFF.md`、Result、Production DOM golden JSON、screenshots）。

| Board が触るファイル | #401 と重なるか | 競合リスク |
|---|---|---|
| `src/state/persistence.ts` / `gameReducer.ts` / `App.tsx` | **なし** | なし |
| `src/logic/discovery/*`（新規 file） | なし | なし |
| `src/devtools/saveMerge.ts` | なし（#404 は #401 の base より後の main。#401 は devtools を触らない） | なし |
| `src/components/TrialNotebookSheet.tsx` / `HintSheet.tsx` / `trialNotebookCopy.ts` | なし | なし |
| `src/screens/GameScreen.tsx` | **あり**（Tray の layout 周り） | 低〜中。Board の変更は Notebook 呼び出し（`:1122` / `:1194`）と `HintSheet` props 中継のみで、#401 の hunk とは別領域の見込み。ただし同一ファイルなので #401 の merge 後に rebase 前提 |
| `src/App.css` | **あり** | 中。`App.css` の末尾追加は双方が同じ位置に足すと衝突する。**Board の CSS は新規ファイル（例 `src/components/researchBoard.css`）に分ける**（`discoveryProgressionInspector.css` / `stateEditorShell.css` の precedent）。 |
| `docs/PROJECT_HANDOFF.md` | **あり**（addendum を冒頭近くに足す） | 中。#401 merge 後に addendum を足す |
| Production DOM golden（`..._PRODUCTION-DOM-GOLDEN.json`） | #401 が rebaseline | 低。Notebook は閉じた状態で golden に出ない見込みだが、実装時に確認 |
| e2e | #401 は `layout-contract.spec.ts` 等を更新 | Board は新規 spec のみ → なし |

→ **Phase 2 は #401 の merge を待たずに着手可能。Phase 3 は #401 merge 後が安全。**
- #401 の base は `a0bc900`（#404 より前）で、#401 と #404 / Board のファイルは重ならない。#401 を変更する必要はない。

## 10. 実装スライス案（実装はしない）

| Slice | 内容 | 触るファイル | 依存 | tests | privacy risk | #401 競合 |
|---|---|---|---|---|---|---|
| **S1** Board read model（純粋・unwired） | `researchBoard.ts`: entries + facts + ledger → view（✓ / ✗ / △）。group 見出しは行があるときだけ。stale × の表示時 drop | 新規 `src/logic/discovery/researchBoard.ts`（+ test、+ unwired gate） | なし | 単体、privacy（禁止情報が view に無い）、stale、cohort 兄弟、NO_SAUCE、172 fixture | 低（view の型に禁止 field が無いことを test で固定） | なし |
| **S2** persisted negative ledger + persistence | `researchExclusions` の型・sanitize・merge・forward-compat・cap・空なら書かない。`ProgressionSnapshot` / `persistProgress` | `persistence.ts`（+ `persistence.researchExclusions.test.ts`、`persistence.forwardCompat.test.ts` 追加） | なし（S1 と並行可） | 保存 diff、未知 id / key、敵対値、cap、reset、旧 save 読み込み | 中（INV-B9: `discoveryHintFacts` に× を入れない） | なし |
| **S3** writer + state 配線 + DEV editor 保持 | `researchResultRows` から `persistExclusionIds`、`researchAttemptResult` で ledger 追記、`GameState` / `carryOf` / `createInitialGameState` / `App.tsx`、`saveMerge.ts` の `HANDLED_TOP_LEVEL_KEYS` | `researchResultRows.ts`、`gameReducer.ts`、`App.tsx`、`devtools/saveMerge.ts`（+ 各 test、importer gate） | S1 の型 / S2 | INV-B1/B2/B4/B5/B9 の reducer test、`saveMerge`/`apply` 回帰、Hint 非依存（B5）、1 attempt exactly-once | **中〜高**（書き込み = 開示 の対称性。同じ `rows` から導出する 1 関数で担保） | なし |
| **S4** Notebook UI（Board section） | `ResearchBoard.tsx`（新）、`TrialNotebookSheet` 上部に配置、footer 範囲限定、props 中継、CSS 新規 file | `TrialNotebookSheet.tsx`、`HintSheet.tsx`、`GameScreen.tsx`、`trialNotebookCopy.ts`、新規 css（+ component test） | S1〜S3、**OD-RBF-1/2** | component test、aria / DOM privacy、Notebook 空でも Board 表示、390×844 / 360×800 | 中（DOM に禁止情報なし、「なし」規則） | **GameScreen.tsx（要 #401 後）** |
| **S5** privacy E2E + HV | 2 attempt → reload → 永続、履歴は消える。HV 動画 390×844 + before/after screenshots（HV policy） | 新規 e2e spec、`docs/reports/screenshots/…`、Result Report | S4 | e2e（Chromium / WebKit）、privacy sweep | 高（総合） | e2e は新規 file のみ。screenshots / handoff は #401 後 |

S1 と S2 は独立。S3 は S1 の型に依存。S4 以降は **HOLD**（OD-RBF-1/2 と #401 merge 待ち）。FAILED（Phase 4）は別 Gate。

## 11. STOP 条件の確認

| STOP 条件 | 結果 |
|---|---|
| #401 への変更が必要 | **不要** |
| Cooking Steps branch への変更が必要 | **不要** |
| authority conflict を Owner 判断なしで解消する必要 | Phase 2 は**なし**。Phase 3 に OD-RBF-1/2 の 2 件（HOLD の理由） |
| schema migration が必要 | **不要** |
| privacy contract を満たせない | **満たせる**（§5） |

## 12. 実装開始可否

- **Phase 2（S1〜S3: Board read model / persisted negative ledger / writer + DEV editor 保持）= GO**。#401 と競合せず、migration 不要、privacy contract を満たす。
- **Phase 3（S4: Notebook UI）= HOLD**。Owner の OD-RBF-1（Board の対象範囲）・OD-RBF-2（footer 文言）の回答と、#401 の merge を待つ。
- **Phase 4（FAILED）**は Owner doc の通り別 Gate。

## 13. 参照した authority / コード

- `docs/decisions/TETO_RESEARCH-2.0_OWNER-DECISIONS.md`、`TETO_ANTI-ORACLE-CONTRACT_2.1.md`、`PROJECT_HANDOFF.md`（addendum 4 / 5）
- `src/logic/discovery/researchEntry.ts`、`researchResultRows.ts`、`researchResultFeedback.ts`、`trialNotebook.gate.test.ts`
- `src/state/gameReducer.ts`（`CONFIRM_BAKE` `:1210`、`REGISTER_TO_DEX` `:1330`、`researchAttemptResult` `:1815`、`carryOf` `:1844`）、`src/state/persistence.ts`（`KNOWN_SAVE_KEYS` `:619`、`extractForwardCompatExtras` `:654`、`writeSave` `:733`、`persistProgress` `:1018`）、`src/state/trialRecord.ts`
- `src/devtools/saveMerge.ts`、`stateModel.ts`、`apply.ts`、`presets.ts`、`ReviewPanel.tsx`
- `src/components/TrialNotebookSheet.tsx`、`HintSheet.tsx`、`trialNotebookCopy.ts`、`src/screens/GameScreen.tsx`
- PR #401 変更ファイル一覧（読み取りのみ）
