# 新工程の候補比較 — STEAM・FRY の次に何を足すか（#773、docs-only）

作成: 2026-11-06 / 基準 `main` = `ed159e9`（#753）/ ブランチ `claude/teto-pizza-issue-773-61yp79` / 管理 Issue **#773**（担当枠 S6）
性質: **調査と比較のみ。** `src/**`・`e2e/**`・データ・CSS・テスト・既存 PR・共有 Preview・Production は変更していない。新規ファイルは本書のみ（`docs/reports/TETO_NEW-PROCESS_*`、#773 の claim の範囲内）。
HV: docs-only のため対象外（`TETO_HUMAN-VERIFICATION-POLICY.md` §2）。
「推奨」は助言であり Owner Decision ではない。**Owner 承認前に実装しない。** 数値は【実測】【推論】【未確認】で区別する。

親資料（再監査しない。`TETO_SESSION-OPERATIONS_1.0.md` §8-1）:
`TETO_COOKING-METHODS-AFTER-STEAM_Design-Audit.md`（揚げる選定）、`TETO_COOKING-FRY_PHASE1_F1_Result.md`、`TETO_COOKING-PROCESS-EXPANSION_Fresh-Audit.md`（+ Pre-Implementation-Verification）、`TETO_PIADINA-577_DESIGN-GATE_2026-10-26.md`、`TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`。#579 の DRIZZLE 価値監査（Issue コメント 2026-10-27）。#521 / #532 の引き継ぎコメント。

---

## 0. 結論（先に）

1. **推奨: 「生地の種類（Dough Kind）の 3 値目 = ピアディーナ」＋ N 値への一般化（#577 の続き）。** 測定できる範囲で、新食材 0・ブロッカー 0 で解放できる行が最も多い（DOUGH_VARIANT 単独 5 行 + 他機構との複合 5 行）。Pinsa（出荷済み）という実績ある型があり、PR を 4 つに割れて、最初の 2 つは本番に影響しない。
2. **ただし正直な限界が 2 つ。**
   - **これは「新しい遊び（ミニゲーム）」ではない。** STEAM・FRY は「手を動かす調理」だが、Dough Kind は選択チップと識別軸の追加で、操作の楽しさは小さい。Owner の目的が「新調理ミニゲームをもう 1 種」なら、次点の **ZONED（区画に具を置く）** か **炒め本番化** を選ぶべき（§4、判断 O-1）。
   - **そもそも新しい調理法を「要求する」レシピはほぼ無い。** 未出荷 94 行【実測・概算】のうち、揚げ 1（`pizza-fritta`＝FRY #749 の Phase 2）・炒め 2〜3（PREP_STEP）だけ。茹でる／煮込む／蒸すを要求する行は 0。工程を足す価値は「レシピ解放」より「遊びの幅」で測るのが実情。
3. **除外（重複・既追跡）:** FRY（#749）、STEAM（#738/#726）、PAN_BAKE（Epic #532 が進行中）、MULTI_SAUCE（#521 は #532 の子で、同 Epic の完了待ち）、POST_BAKE（既に本番 ON）、DRIZZLE（#579 価値監査で必須行 0 → 保留、#746 は Gesture Lab として別走）、「散らす」（撤回済み）。いずれも**新規 Issue を作らず既存に紐づける**（§5）。
4. **実装担当への最小の次タスク:** Owner が O-1〜O-3 に答えたら、#577 の PD-1（`DoughKind` 3 値目＋技法定義＋検出・シミュレータの一般化、**データなし・本番影響なし**）。新規ファイル中心で、#738/#746/#749 の HOT ファイルに触れない（§7）。

---

## 1. Fresh Audit（現況）

### 1.1 確認範囲
| 区分 | 読んだもの | できなかったこと |
|---|---|---|
| 規則 | `CLAUDE.md`、`SESSION-OPERATIONS_1.0`（全文）、HV Policy（冒頭）、`scripts/ops/hot-files.json` | `PROJECT_HANDOFF.md` 全 1147 行（古い現況は信用せず main のコードと Issue を正とした） |
| GitHub | #773 本文・claim、#579（本文＋全コメント）、#749（本文＋claim）、#696（本文＋全コメント）、#532 本文、#521 コメント 8 件、open PR 一覧、#738 の変更ファイル一覧 | #577・#620 の本文、#738/#746 の PR 本文・レビュー、claim 全件（コメント全文は上記の範囲のみ） |
| コード（読み取り） | `src/data/*ExperienceGate.ts`、`src/logic/{fry,steam,prep,pan}`、`recipes.ts`／`ingredients.ts` の id 走査 | アプリ実行・テスト実行・実機（**未実施**。`node_modules` なし） |
| マトリクス | 172 行の `requiredCapabilities`／`blockers`／食材の既存照合 | 原典 pizzadb.jp（**原典未確認**） |

### 1.2 main の事実【実測】
- 調理系ゲート: `SEAR_EXPERIENCE_PRODUCTION = true`（ON）、`PREP_`／`STEAM_`／`FRY_EXPERIENCE_PRODUCTION = false`（OFF）。FRY は F1（純粋ロジック・未配線）のみ main。**対象 eggplant は専用の絵待ち**で休眠（#749）。#753 が eggplant 輪切り案を Style Lock に採用記録したので絵の障害は動き始めている【Result は未読】。
- Piadina は `src/` に存在しない（`grep -ri piadina src` → 0 件）。`DoughKind` は `standard` / `material-multigrain-long-ferment`（Pinsa）の 2 値、Pinsa は `PINSA_PRODUCTION = true`。
- open PR のうち本件と HOT で重なる可能性があるもの: **#738**（Steam S3: `src/App.tsx`／`PizzaStage.tsx` を追加のみ変更）、#746（DRIZZLE Lab・独立画面）、#756/#757/#762/#763（Steam V2/V3 draft）、#581（pan・四隅）、#540（Grandma HOLD）、#478（`GameScreen.tsx`）。**docs-only の本書はいずれとも重ならない。**
- claim: #773 に S6 の claim（branch `claude/teto-pizza-parallel-plan-sh894e`、`docs/reports/TETO_NEW-PROCESS_*`）。本書は同じ glob の範囲。#749 の claim は F1 のみ（2026-11-18 まで）。#696 の claim は解除済み。

### 1.3 172 マトリクスの実測【実測 + 概算】
未出荷判定は「`src/data/*.ts` に id 文字列が無い」で行った。別名・late 専用 id の取りこぼしがありうるため **概算**（AFTER-STEAM の 109 より厳しく、94 行）。「clean」= 新食材 0 かつ `blockers` 0。
| 要求機構 | 未出荷行 | clean | clean の行 |
|---|---|---|---|
| DOUGH_VARIANT 単独 | 19 | **5** | ny-style★, argentine-napolitana, cauliflower-crust-pizza, **piadina-romagnola**, fathead-pizza-keto |
| DOUGH_VARIANT + PAN_BAKE | 3 | 2 | new-england-bar-pizza, montreal-style-pizza |
| DOUGH_VARIANT + ENCLOSE | 3 | 2 | fugazzeta-rellena, chicago-stuffed-pizza |
| DOUGH_SHAPE_TARGET + DOUGH_VARIANT + PAN_BAKE | 3 | 1 | pizza-al-taglio-romana |
| MULTI_SPREAD_LAYER | 11 | 1 | sfincione（根拠未確認と #521 に記録） |
| ZONED_PLACEMENT | 1 | 1 | quattro-stagioni |
| STEP_ORDER | 1 | 1 | trenton-tomato-pie（READY_WITH_REVIEW） |
| FRY_COOK | 1 | 1 | pizza-fritta（= FRY Phase 2） |
| PREP_STEP（単独 2 + LATE との複合 1） | 3 | 0 | yakiniku-pizza は新食材 2、他は BLOCKED |
| LATE_ADDITION ほか | 7+ | 0 | — |

注意【推論】: ★ ny-style は食材が `mozzarella + tomato-sauce` で、出荷済みの標準生地レシピと**食材集合が衝突**する可能性が高い（マトリクスの `collisionLedger` で未確認）。「clean」は構造上の話で、**識別の衝突・原典未確認は別途**。1 行 = 1 レシピ解放だが、DOUGH_VARIANT の種類数（ここでは variant 値 5 種）と生地種別の数は一致しない【未確認】。

---

## 2. 候補ごとの事実と重複確認

「新食材」「レシピ」は §1.3。「干渉」は HOT 表（`hot-files.json`）に対して。

| 候補 | 既存の追跡（重複確認） | 解放できる未出荷レシピ | 新食材 | 干渉する HOT／進行中 PR |
|---|---|---|---|---|
| **A. Dough Kind 3 値目（ピアディーナ）＋一般化** | #577（Pinsa 出荷済み）、Design Gate 2026-10-26。専用 Issue なし | 直接 1（piadina）、一般化後に最大 +4〜9【推論】 | **0**（prosciutto-crudo／arugula／cream-cheese は ingredients.ts に存在【実測】） | 案 P なら `recipes.ts`、案 F なら `lateCatalog.ts`（非 HOT）。UI（PD-2）で `GameScreen.tsx` に追加のみ |
| B. ZONED（区画配置） | #620（docs、結論は POST_BAKE 先行）、`PROCESS-EXPANSION` §9「✕ 対象外」 | 1（quattro-stagioni、READY） | 0 | `PizzaStage.tsx`・`GameScreen.tsx`・Reference/採点（四分割の目標座標）。**#738 と同一ファイル** |
| C. 炒め本番化＋yakiniku-pizza | #696（Phase 1B 出荷、claim 解除済み）、`COOKING-PREP_PHASE1_SPEC` | 1（yakiniku、READY） | **2**（yakiniku-sauce、white-sesame。絵も要る） | `ingredients.ts`・`recipes.ts`（HOT）。識別に PREP を入れるなら DH4／Hint に波及 |
| D. POST_BAKE／DRIZZLE | #579、PR #746（Lab）、#654 ほか（POST_BAKE は本番 ON）。価値監査: **必須行 0・機構 XL** | **0**（代替で足りる） | 0 | `gameReducer.ts`（FINISH は topping のみ）、保存・在庫・識別の設計判断待ち |
| E. MULTI_SAUCE | #521（HOLD、#532 の子）、#540（Draft HOLD）、#620 | 1（sfincione、根拠未確認）。grandma は #532 の完了待ち | 0 | `recipes.ts`、DH4 ゲート再実行。**#532 が前提** |
| F. PAN_BAKE | #532 Epic（A/B1 済み、B2・F2 は open の記録、C・D 未着手）、#538 | grandma（#521）。複合 3 行は DOUGH_VARIANT も要る | 0 | `PizzaStage.tsx`、`App.css`、Technique 一式。**進行中の Epic** |
| G. 茹でる／煮込む | #216・#294（古い一般設計）。専用なし | **0**（原典に要求行なし） | 0 | SAUCE 境界（煮込み）。Anti-Oracle 抵触の恐れ |

### 除外と理由（要約）
- **FRY／STEAM**: 入力が STEAM・FRY そのもの（#749・#738）。FRY Phase 2（`pizza-fritta`）は #749 の別 Gate として既に載っている。
- **D DRIZZLE**: 価値監査で「DRIZZLE が必須な行 0」。Owner が #746 を Lab として走らせている最中で、統合の判断資料（`postBakeLiquids`）は未承認。**本比較では点数を付けて保留**。
- **E・F**: 新しい判断ではなく、Epic #532 の完了を待つ既存計画。ここで別案として推すと #532/#521 と二重になる。
- **G**: レシピ 0。遊びとしての価値は未検証。

---

## 3. 実際のピザ作りとの整合【推論 — 原典・一般知識。原典は未確認】

| 候補 | 整合 | 注意 |
|---|---|---|
| A ピアディーナ | ○ ロマーニャの薄い無発酵の平パン。実際は鉄板（teglia）で焼き、焼いた後に生ハム・ルッコラ等をのせるのが一般的 | 「焼成後にのせる」は**一般知識で原典未確認**（Design Gate §7）。ゲームの案 P/F の選択は Owner 判断 D-P3 |
| B クアトロスタジオーニ | ◎ 四季＝4 区画に別の具をのせる、が料理の本質 | 4 区画の個数・面積配分は未確認 |
| C 炒め＋焼肉 | ○ 牛肉を先に炒めてのせる（PREP の実装と一致） | 焼肉のたれは新ソース扱い |
| D DRIZZLE | ○ はちみつ・オイルを焼成後にかける | 原典での時機が未確認（#579 の L2b 21 行） |

---

## 4. 操作・楽しさの設計と採点

### 4.1 操作案（390×844、既存の流儀: 新タブを足さない／transient／Anti-Oracle）
- **A（推奨）**: 操作は既存の DOUGH 工程内の**チップ選択のみ**（「ふつうの生地」「ほかの生地…」→ 開いた先で選ぶ。§5 の案 B 相当を助言）。新ジェスチャーなし。**楽しさは「生地を選ぶ→違う生地だと別のピザになる」という発見の幅**で、手触りの新しさはない【正直な評価】。
- **B ZONED（次点・遊びの新しさ）**: TOPPING で「4 つの区画のうち 1 つをタップ→具をその区画にドラッグまたはタップ配置」。指 1 本、既存の配置ジェスチャーの拡張。楽しさは「分けて盛る」構成遊び。ただし採点（Reference の目標座標）と識別（placement 軸）の設計が要る【大】。
- **C 炒め**: 既存実装を ON にするだけ（Owner の HV 待ち）。**新しい操作はなし**。

### 4.2 採点（0〜5、重み付き。主観を含む【推論】）
| 基準（重み） | A Dough Kind | B ZONED | C 炒め＋焼肉 | D DRIZZLE | G 茹で／煮込み |
|---|---|---|---|---|---|
| 解放レシピ（25） | 4 → 20 | 1 → 5 | 1 → 5 | 0 → 0 | 0 → 0 |
| 実装しやすさ（20） | 3 → 12 | 2 → 8 | 3 → 12 | 1 → 4 | 2 → 8 |
| 遊びの新しさ・iPhone 適性（15） | 1 → 3 | 4 → 12 | 1 → 3 | 4 → 12 | 3 → 9 |
| 他 PR・HOT との独立（15） | 4 → 12 | 1 → 3 | 2 → 6 | 2 → 6 | 3 → 9 |
| Owner 判断の少なさ（15） | 2 → 6 | 2 → 6 | 3 → 9 | 1 → 3 | 2 → 6 |
| 保存・採点・識別リスクの小ささ（10） | 3 → 6 | 2 → 4 | 3 → 6 | 1 → 2 | 3 → 6 |
| **合計（100）** | **59** | 38 | 41 | 27 | 38 |

読み方: 点差の主因は「解放できる行数」。**A は遊びの新しさで最低点**。感度分析【計算済み】: 「遊びの新しさ」の重みを 15→35 に上げても A 63 / B 54 で順位は変わらない。つまり点数では A が優位だが、O-1 は点数の問題ではなく**目的**（解放か、新しい遊びか）の問題で、Owner が後者と決めたなら A を選ぶ根拠は弱い。

---

## 5. 推奨と既存 Issue への紐づけ

**推奨 = A（#577 の続き。新規 Issue は作らない）。**
- 追加は **#577 へのコメント 1 件（claim と PD-1 の宣言）** で足りる。専用 Issue は不要（Pinsa と同じ #577 配下）。
- B ZONED は #620 への後追い（Issue 新設なし）。C は #696 再利用（Owner が 11/04 に指定済み）。D は #579 に保留記録済み。E・F は #532 / #521 の既存計画に従う。
- したがって**新規 Issue 数 = 0**。実装 PR は PD-1〜PD-4（#577 に紐づく）。

### 重なりの明記（#773 作業項目 2）
| 対象 | A（PD-1/PD-2/PD-3）との関係 |
|---|---|
| STEAM #738 | `App.tsx`／`PizzaStage.tsx` を追加のみ変更中。**PD-1・PD-3 は触れない。PD-2 は `GameScreen.tsx` に追加するので、#738 の merge 後に着手** |
| FRY #749 | F1 は新規ファイルのみ。**重ならない**。F2（`gameReducer.ts`）と PD-2（`GameScreen.tsx`）は別 HOT ファイル |
| DRIZZLE #746 | 独立画面。重ならない |
| `src/main.tsx`／`PizzaStage.tsx`／`GameScreen.tsx` | A は PD-2 のみ `GameScreen.tsx`・`doughSwitch.ts`・`DoughKindSwitch.tsx`。`main.tsx`・`PizzaStage.tsx` は触れない見込み【推論、Design Gate §3 の 14 ファイル表を未再確認】 |
| Batch 18/19（#748） | データ側（`recipes.ts`／`ingredients.ts`）。案 F（`lateCatalog.ts`）なら重ならない |

---

## 6. 実装担当向け Issue 案（#577 へのコメントまたは子 PR 本文として使う）

> **#577 Dough Kind 3 値目（ピアディーナ）— PD-1 着手**
>
> **目的:** `DoughKind` を 3 値以上に一般化し、ピアディーナ（`piadina-romagnola`、READY、新食材 0）を出せる土台を作る。Production は変えない。
>
> **前提（Owner 判断、`TETO_PIADINA-577_DESIGN-GATE_2026-10-26.md` §9）:** D-P1（チップ設計）、D-P2（1 生地 1 技法）、D-P3（案 P／F）、D-P4（保存互換）、D-P6（公開ゲート `PIADINA_PRODUCTION`）が決まっていること。D-P3 は原典確認（または暫定仕様の承認、OD-B9-17 パターン）に依存。
>
> **スライス:** PD-1 データなし（`doughKind.ts`・`techniques.ts`・検出・シミュレータ一般化）→ PD-2 チップ UI＋漏えい防止テスト（#738 merge 後）→ PD-3 データ＋専用ゲート OFF → PD-4 公開（Owner の実機 HV と承認、1 リテラル）。
>
> **触らない:** #738・#746・#749 の PR・claim、`src/App.tsx`・`PizzaStage.tsx`、共有 Preview、Production。
>
> **claim:** `src/logic/dough/**`、`src/data/techniques.ts`、`src/logic/techniques/**`、`src/logic/discovery/**`（PD-1 の範囲のみ。PD-2 以降は別 claim）。

### 受入条件（案）
1. `DoughKind` が 3 値目を受け付け、**どのレシピも 3 値目を使わない状態で**全既存 Vitest／tsc／oxlint／build が無修正で通る（PD-1 時点で本番バンドルの挙動はバイト同一）。
2. 3 値目の技法 id は 1 技法 1 生地。Pinsa の検出（`dough-pinsa-romana`）は変更なし（Pinsa の既存テスト無修正）。
3. `discoveryHintEconomySim`／`hint5EconomySim`／`researchAttemptSim` が 3 値に対して Pinsa と同一の不変条件を満たす。DH4 掃引（`GATE_STATES`）を 3 値目で再実行し、掃引状態数を Result に記録。
4. Anti-Oracle: チップ表示条件は「いずれかの生地技法の affordance が開いた」に統一し、どの生地かを DOM（`data-dough-choice`）・文言・タブ数で出さない（D-P1 の決定に従う）。
5. 保存互換: `pendingRound` の `dough` 検証の扱いが D-P4 のとおり。旧ビルドに戻した場合の挙動を Result に明記。
6. PD-3 以降: `PIADINA_PRODUCTION = false` で DOM・採点・識別・在庫が従来とバイト同一。ON 時のみレシピが発見可能。Lunch Rush 除外（`lunchRush:false`）、`ladderCredit:false`。
7. UI を触る PD-2/PD-4 は HV Policy に従う（390×844 動画は Owner へ直接、前後スクリーンショットを `docs/reports/screenshots/<task>/`、実機 HV は Owner 判定）。
8. 360×800・390×844 の WebKit CI が通る。失敗の再実行は失敗 job のみで、閾値・timeout・retry は変更しない（`SESSION-OPERATIONS` §2）。

---

## 7. 実装順（推奨）

| 順 | 内容 | 依存 | 本番影響 |
|---|---|---|---|
| 0 | Owner 判断 O-1〜O-4（§8）と、ピアディーナの原典確認（Owner／ChatGPT 側。§8-O-4） | — | なし |
| 1 | **PD-1**（土台・データなし） | 0 | なし |
| 2 | PD-2（チップ UI。`GameScreen.tsx` 追加のみ） | #738 merge 後、D-P1 | なし（affordance 閉） |
| 3 | PD-3（データ・専用ゲート OFF） | PD-1/2、D-P3、原典 | なし |
| 4 | PD-4（公開 1 リテラル） | 実機 HV、Owner 承認 | あり |
| 並行 | FRY F2 以降（#749 の HOLD 解除後）、炒め／蒸すの実機 HV | 各 Owner | — |
| 後続 | 2 つ目以降の生地種（4 行の clean）。**1 種 = PD-3 相当の小さな PR**【推論】 | PD-1/2 | — |

並行 PR の上限 2 件（#696 コメント 11/04）に対し、#738・#746 が HV 待ちなので、**PD-1 は新規ファイル中心で HOT 干渉なし**として先行可。PD-2 は #738 を待つ。

---

## 8. Owner 判断が必要な点（まとめて、各に推奨つき）

| ID | 論点 | 推奨 |
|---|---|---|
| **O-1** | 目的は「新レシピの解放」か「新しい調理ミニゲーム」か。Dough Kind は前者の最短路だが**新しい遊びではない** | 解放優先なら A。ミニゲーム優先なら B（ZONED）か、FRY F2 以降／炒め本番化の HV を進める（D の DRIZZLE は保留のまま） |
| O-2 | Dough Kind を「新工程」の 1 枠として数えるか | 数える場合のみ A を実装。数えないなら本書の対象は B/C に移る |
| O-3 | D-P1（チップ設計 A/B/C）、D-P2（1 生地 1 技法）、D-P4（保存互換 a/b/c）、D-P6（専用ゲート） | D-P1=案 B（「ほかの生地」1 個→開いた先で選ぶ）、D-P2=はい、D-P4=案 (b)（前提の #666 は merge 済み）または (a)、D-P6=はい（Pinsa 踏襲）。いずれも Design Gate §9 の助言どおり |
| O-4 | D-P3（案 P: 全て焼成前 / 案 F: ルッコラ・生ハムを焼成後）と原典確認 | 原典が取れるまで **案 F（late catalog、Pinsa と同型、HOT 回避）を暫定**とし、「暫定仕様」であることを明記（OD-B9-17 パターン）。原典取得は担当セッションが先に試み、不可なら URL とエラーを渡して ChatGPT 側へ（§8-2） |
| O-5 | eggplant の絵（#753 で採用記録済み）の実装 Gate を FRY F2 の前に切るか | A とは独立。#749 の別 Gate として Owner が指示 |

**未確認事項（正直に）:** 楽しさ・疲労は設計上の見込みで実測なし／原典 pizzadb.jp は全て未確認／未出荷 94 行は id 一致の概算／採点の重みは主観／ny-style 等の識別衝突は未確認／PD-1 の 14 ファイル影響表は 10/26 時点で、main の進行後の再確認はしていない／#577・#620・#738・#746 の本文と claim 全件は未読。

## 9. 禁止事項の遵守
`src/**`・`e2e/**`・データ・テスト・既存 PR（#738・#746・#749・#756/#757/#762/#763）への変更なし／merge・Production ON・共有 Preview 更新なし／新規 Issue・PR は作っていない。新規ファイルは本書のみ。
