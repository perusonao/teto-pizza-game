# Large Catalog R6 — Pin / Hand Production Readiness Fresh Audit

**AUDIT / DESIGN ONLY。** src / e2e / CSS 変更なし・PR なし・merge なし・実装なし。
`HAND_ENFORCEMENT_ENABLED` は `false` のまま・**capacity 9 / 12 は決めない（winner なし）**。
Discovery 3.0 IP-1（PR #333、別セッション）の branch / files には触れていない（PR 一覧と file 一覧の読み取りのみ）。

目的: 現在 FLAG OFF の「Pantry → pin / unpin → selected strip → hand（working set）→ FREE tray」を production ON にするために **残っている作業を正確に確定**し、最小 Completion Plan を作る。

---

## 1. Audited SHA / Fresh Gate

| 項目 | 結果 |
|---|---|
| expected main | `93ca1e404c4e942e48b69506ff600bd8fcdfbb51` |
| `origin/main`（fresh fetch） | `93ca1e404c4e942e48b69506ff600bd8fcdfbb51` — **一致** |
| 作業 branch | `claude/teto-r6-production-audit-1x3hwv`（main と同一 SHA から開始） |
| open な関連 PR | **#319**（R6-b）、**#333**（Discovery IP-1、別セッション・触れない） |
| 検証方法 | main の source を直接読み、#319 は使い捨て worktree（scratchpad、repo 外・削除済み）で **main + #319 を merge した tree** を実行検証 |

main に取り込み済みのもの: R0〜R5-e / R5-e-h（hand / pin / tray の dormant 実装、hand-on 9 / 12 の Vitest project、H-1〜H-8）。**R6-a 〜 R6-e は main に何も無い**（R6-a の監査と OD-R6a-1〜7 は後述 §3.2 のとおり main の docs tree に存在しない）。

---

## 2. #319（R6-b）の現状

| 項目 | 事実 |
|---|---|
| state | open / non-draft / `mergeable_state: clean` |
| head / base | head `c5d2da7e44b0b647ad0f48ddd55ed858a955d729` / **base `6abddc7`（現 main `93ca1e4` より 41 commit 古い）** |
| 変更 | 24 files / +886 −18。**production src は 3 files**（`handPolicy.ts`、`PreviewBadge.tsx`、新規 `src/preview/lcHandPreview.ts`）。残りは test / e2e / tooling / docs / screenshot |
| CI（head `c5d2da7`） | check run 9/9 success（WebKit Gate・webkit 390×844 / 360×800 各 shard・layout-chromium・Layout Contract Gate・classify・build）。PR comment: webkit-390 shard 1/2 が既存 spec `discovery-near-miss-result` の timeout で 1 回落ち、再実行で通過（#319 無関係と記録） |
| review comment | CI note 1 件のみ（review thread なし） |

### 2.1 Q-A: 最新 main へ取り込めば R6-b としてそのまま使えるか

**結論: 使える（Yes、ただし下記 3 条件）。**

本監査で実測した（`main 93ca1e4` + `#319 c5d2da7` の merge tree）:

| 検証 | 結果 |
|---|---|
| `git merge-tree` | 競合なし（clean） |
| 衝突しうる file | main が `6abddc7..93ca1e4` で触った hand 関連は `GameScreen.tsx`（hint notebook / executionAdvice の 2 import + 2 prop のみ）と `largeCatalogFixtures.test.ts`。#319 は `GameScreen` / `App` を一切触らない |
| `tsc -b` | clean |
| Vitest 全体 | **300 files / 5639 passed / 1 skipped**（hand-on-9 / hand-on-12、`lcHandPreview.bundle.gate`（実 vite build）含む） |
| Chromium `iphone-390x844`: `e2e/lc-hand-preview-activation.spec.ts` | **PASS** — production DOM golden（R5-e baseline `6abddc7` で採取）が **Discovery 3.0 の 41 commit 後も byte 一致**。production + variant 12 = Hand OFF、Preview + variant 12 のみ ON |
| Chromium `large-catalog-pin-dormant.spec.ts`（390） | PASS（360 は仕様どおり skip） |
| WebKit | この sandbox では実行不可（既知）。**merged head の WebKit は CI が唯一の authority** |

**条件（#319 をそのまま R6-b として確定するために）:**

1. **head を現 main に更新して CI（特に WebKit Gate）を merged head で再取得する。** 現在の green は旧 base 上の結果。上の実測は Chromium + Vitest のみ。
2. **R6-a の authority が main の docs tree に無い（SSOT gap）。** R6-a Fresh Audit（`4d2d6ae` / `7727cdc`）は R5-e PR から revert 済み（`89a23ee`）で、main の *git 履歴* には残るが `docs/reports/` には無い。`docs/PROJECT_HANDOFF.md` にも **OD-R6a-1〜7 の記載が無い**（grep: R6 の最終行は R5-e-h）。#319 の report は OD-R6a-* を authority として引用しているので、**authority が参照不能のまま merge される**。#319 の Final Gate 項目 1（再 land するか）を Owner が決める必要がある（§14 OD-1）。本監査は決めない。
3. #319 の Result は「variant SHA の実 Preview deploy / smoke は未実施」「HV video は R6-c」と明記している。**R6-b 自体は production 挙動を変えない**ので merge 可否には無関係だが、R6-c の前提（`HAND 9|12` badge の ON/OFF 判別 smoke）として R6-c の最初に 1 回やる。

**#319 が未提供のもの（R6-b に入れ損ねた R6-a 計画項目）:** `?hv=lc-22` Large Catalog 用 Preview seed（R6-a §11 は R6-b で追加と書いたが、#319 の 24 files に `hvSeeds` 変更は無い。`src/preview/hvSeeds.ts` に lc 用 seed は無い）→ R6-c / R6-d の実機 HV の前提なので **R6-c に含める**（§8）。

---

## 3. 既存実装（main `93ca1e4` で確認した事実）

### 3.1 構成

| 層 | file | 状態 |
|---|---|---|
| 容量 policy | `logic/catalog/handPolicy.ts` | `HAND_ENFORCEMENT_ENABLED = false`（literal、14 行目）。`DEFAULT_HAND_CAPACITY_CANDIDATE = 12`（**候補値・未決定**）。`handCapacityFor` は OFF なら `max(1, owned)`（常に inactive） |
| working set | `logic/catalog/workingSet.ts` | owned ≤ capacity なら inactive（今日の tray と同じ）。active: `placed > pinned > hint > favorite > recent > new > fill`。placed / pinned は在庫 0 でも残る。自動枠は在庫 0 を除外（LC-OD-17）。placed は capacity 超でも落とさない（OD-R5d-2） |
| hand session | `logic/catalog/handSession.ts` | session-only、category 別の pin id 配列。owned かつ当該 category のみ受理 |
| pin 編集 | `logic/catalog/pinEdit.ts` | Model D（tile tap = 即 toggle）。`rejected-no-stock / not-owned / capacity`。strip は `handEditing && pinCount>0` |
| tray 導出 | `logic/catalog/handTray.ts` + `App.tsx` | `resolveTrayHandIds`（flag ON ∧ FREE ∧ tray step ∧ active の時のみ non-null）、catalog 順表示（OD-R5d-1）、page-0 reset + #197 selection 規則、Model C（`pinFitsHand`） |
| tray 表示 | `IngredientTray.tsx` | `handIds` があればそれ、無ければ `trayIngredientsFor`（FREE は owned を全部、`prepareDock.ts:31`） |
| pantry | `IngredientPantry.tsx` | `handEditing` で tile が toggle button 化 / 📌 / `aria-pressed` / strip / 「おまかせに戻す」 |
| 配線 | `GameScreen.tsx:895` | `handEditing={HAND_ENFORCEMENT_ENABLED}`（**flag だけ**で決まる） |
| 資格 | `freeEligibility.ts` | `roundKind === "FREE_COOK" ∧ dinner === null` のみ。guided / Lunch Rush / Dinner は不可 |

consumer は 3 箇所のみ（`handCapacityFor`、`resolveTrayHandIds`、`handEditing`）。#319 はこの 3 consumer を変えずに flag の**値の決まり方**だけを変える設計。

### 3.2 設計・履歴

| slice | 状態 |
|---|---|
| R0〜R5-d | main（dormant 実装） |
| R5-e / R5-e-h | main（hand-on 9/12 project、mutation M1〜M114 118/118、E1〜E12 10/12、verdict A「R6 AUDIT-READY」）。OD-R5e-1〜5 確定 |
| **R6-a**（Preview activation architecture、A2 採用） | audit は commit `4d2d6ae` / `7727cdc`（main 履歴内、docs tree からは revert 済み）。OD-R6a-1〜7 CONFIRMED、BL-2（Preview repo の workflow 実物確認）RESOLVED、verdict A |
| **R6-b** | #319（open、§2） |
| R6-c / R6-d / R6-e | **未着手**（コード・docs とも無し） |

---

## 4. production OFF の理由（現在 OFF である構造と、ON の前に残る blocker）

OFF の仕組み: `HAND_ENFORCEMENT_ENABLED = false` literal → ①`handCapacityFor` が常に fit ②`trayHandIds = null` で今日の tray ③`handEditing = false` で pin UI なし。dormant UI（pin / strip）の **code 自体は既に production bundle に含まれる**（R6a-F1: 到達不能なだけ）。production から ON にする経路は現状ゼロ（URL / storage / env reader なし）。

R5-e が挙げた Activation blockers（AB-1〜6）の **main での現状**（コードで再確認）:

| # | blocker | main での現状 |
|---|---|---|
| AB-1 | capacity-full が無反応 | **未解消。** `IngredientPantry.tsx:336-340` の onClick は `togglePin(...).session` だけ使い `outcome` を捨てる。視覚・SR とも feedback なし |
| AB-2 | inactive category の no-op pin UI | **未解消。** `handEditing` は flag のみ（hand の active を見ない）。現 catalog では sauce（3）/ cheese（4）は構造上 inactive なので、ON にすると **SAUCE / CHEESE step で効かない pin UI が出る** |
| AB-3 | ON test が real 結合を見ない / OFF golden 無し | **解消済み**（R5-e-h: 実 `handPolicy.ts` を ON compile。#319: production DOM golden を committed） |
| AB-4 | 実機 Human Feel 未実施（9 vs 12、keyboard、OD-R5c-5） | **未解消**（R6-c / R6-d） |
| AB-5 | capacity 未決定 | **未解消**（Owner） |
| AB-6 | Preview で ON を出す手段なし | **#319 で解消**（merge すれば） |

加えて **OD-R5e-2 / D-1**: hand mode は「unpinned の在庫 0 topping を tray から除く」。これは EP3 の「在庫 0 は ×0 disabled で残り never hidden」（`IngredientTray` の doc comment）を hand mode で上書きする。実装は済みだが doc comment が古い（R5-e P-4）。

---

## 5. pin の現状

- 状態: `App.tsx:237` の `useState<HandSession>`。**session-only**。round / step 変更・HOME・FREE 再開・Dinner 往復では**保持**、reload / app 再起動（Full Game Reset 含む）で空。save / `GameState` に無い。
- 編集: pantry tile tap（click、scroll では toggle しない）。新規 pin は owned ∧ 在庫あり ∧ 当該 category ∧ **Model C（hand 内に収まる）**。unpin は常に可。「おまかせに戻す」は当該 category の pin のみ 1 tap 全消去（確認なし、P-5）。
- 在庫 0: 新規 pin 不可（「ざいこなし」+ `aria-disabled`）、既存 pin は残り unpin 可。
- selected strip（方式 D）: pin ≥ 1 で表示、keyboard 表示中（`pantry-sheet--fit`）は CSS で非表示、tile badge / `aria-pressed` / 再 tap unpin は残る。
- search focus 中の tile tap: 現状は keyboard を **維持する実装は無い**（`preventDefault` は検索 ✕ のみ、`IngredientPantry.tsx:244`）。OD-R6a-5（R6-c 初期挙動 = 維持）は **R6-c で実装**。
- **未実装（R6-c）**: rejection feedback、pin/unpin の SR announce、OD-R5e-1（active 時のみ pin UI）、OD-R5c-5 の既定挙動。

## 6. hand の現状

- 導出は純関数・render-phase のみ。catalog 順表示。priority は hand の**メンバーシップ**だけを決める（pin 順は表示順に影響しない）。
- 実際に使われる自動 source は **`new`（`ownedIngredientIds` の取得順から導出、cap あり）と `fill`（catalog 順、在庫あり）だけ**。`hint` は `NO_DISCLOSED_HINTS` 固定、`favorite` / `recent` は `emptyUsageSession()` で常に空（`handTray.ts`、`handSession.ts:100`）。
- 実際の hand 変化 → page 0、selection は新 page 0 にある場合のみ保持（#197 / OD-R5d-1）。pin → undo で selection は戻らない（H-7 で現仕様を固定）。
- 現 catalog（29 ingredient: sauce 3 / cheese 4 / topping 22。Discovery 3.0 後も不変）では、hand が active になるのは **TOPPING step のみ**。active 閾値: owned topping が **12 なら ≥13、9 なら ≥10**。sauce / cheese はどちらの capacity でも到達不能。
- Pantry 自体の出現条件（`pantryWorthwhile`）は「いずれかの step category で owned > 6」で、hand の active とは独立。

## 7. FREE tray への反映（Q-D）

pin した材料が tray に出るまでの経路:

1. pantry で tile tap → `togglePin`（Model C: `pinFitsHand` が「新 pin 込みで hand を再計算し、その id が見えるか」を検査）→ App の `handSession` 更新。
2. 次の render で `resolveTrayHandIds` が再計算（placed > **pinned** > … > fill）。pin は hand に必ず入る（受理時点で保証）。
3. 表示は **catalog 順**（pin した順ではない）。hand のメンバー or 順序が実際に変わったときだけ tray は page 0 に戻り、`selectedIngredientId` は新 page 0 に居なければ clear（pantry を閉じた後に気づく、F-4 / P-7）。
4. 配置済み材料は capacity を超えても hand から落ちない（安全契約）。
5. 在庫 0: pinned は ×0 disabled で hand に残り slot を消費。unpinned の在庫 0 は tray から消える（pantry には ×0 で残る）。starter（`UNLIMITED`）は常に stocked 扱いで落ちない。
6. hand が inactive（topping ≤ capacity、sauce / cheese、非 eligible）のときは今日の tray（`trayIngredientsFor` 経路）で、pin は tray に何の効果も持たない（→ AB-2）。

---

## 8. R6-b〜R6-e の残作業（Q-B）

### R6-b（#319）
- 残り: base 更新 + merged head の CI（WebKit）、R6-a docs の扱い（OD-1）、Owner による merge。
- **コード上の追加作業は不要**（hvSeed の欠落は R6-c に回す）。

### R6-c（Hand/Pin UI の Preview activation、production は dormant のまま）
R6-a §23 の定義に、本監査で main 上の事実を当てた**具体的な残り**:

| # | 作業 | 根拠 |
|---|---|---|
| c1 | `handEditing = HAND_ENFORCEMENT_ENABLED && 当該 category の hand が active`（App が既に持つ `trayHand.ids !== null` を使う。新しい判定を作らない）。現 spec を固定する E11 系 test を意図的に反転 | OD-R5e-1、AB-2 |
| c2 | capacity-full rejection UI: 数字なし、sheet 下端 overlay toast 3 秒、`role="status"` polite、copy「手元がいっぱいです。使わない食材のピンを外してね」。overlay で list 行数を減らさない | OD-R5e-3、OD-R6a-4、AB-1 |
| c3 | pin / unpin の polite announce（「〇〇を手元に追加」等） | R5-e §9 |
| c4 | OD-R5c-5 既定: search focus 中の tile tap で keyboard 維持（`pointerdown` preventDefault） | OD-R6a-5 |
| c5 | Preview 用 Large Catalog seed（`?hv=lc-22` 相当: topping 22 所持、在庫固定、3 種 ×0、1 種 stock 1）を `hvSeeds.ts` に追加 | R6-a §11（#319 に未収録） |
| c6 | test: ON-inactive ≡ OFF（pantry も）、rejection 文言に数字なし / status 領域 / 3 秒 / 次 tap で消去、keyboard 中に strip 非表示（M95 維持）、9 / 12 両方。mutant U1〜U5 | R6-a §22 |
| c7 | 390×844 と 360×800 の e2e（WebKit CI 対象）。toast が pantry list の可視行を減らさないこと | §12 |
| c8 | `IngredientTray` の「never hidden」doc comment を hand mode に合わせて更新 | R5-e P-4 / D-1 |
| c9 | **HV（必須）**: variant 12（または後述の 9+12）の Preview exact SHA で 390×844 video（ユーザー直送・repo に commit しない）+ before/after screenshot（`docs/reports/screenshots/<task>/`）。実機 Safari / standalone / 日本語 IME / VoiceOver | HV Policy、R6-a §20 |

production への影響は 0（flag false。golden と byte 同一を gate で維持）。

### R6-d（9 vs 12 実機比較）
- 作業はコードではなく **HV 運用**: variant commit `hv/lc-hand-9-*` / `hv/lc-hand-12-*`（`LC_HAND_PREVIEW_CAPACITY` 1 行差分、PR にしない・merge しない）を push し、Preview repo の `deploy-from-source.yml`（`workflow_dispatch`、`ref` に exact SHA）で順に deploy（ABBA）。
- 既存 tooling: `hand-capacity.measure.spec.ts`（geometry、9 / 12 で差 0 の回帰確認）、`r5c-geometry.measure.spec.ts`。計測 M-1〜M-9 と主観 HV-1〜HV-13（R5-e §15 / §16）。
- **Owner の許可が要る操作**: `hv/*` branch の push（この session の push 権限は指定 branch のみ）と Preview deploy の起動。
- 出力: 数値と所見のみ。**決定は Owner**。

### R6-e（capacity 決定 + production activation）
- コード変更は小さい: `HAND_ENFORCEMENT_PRODUCTION = true`、`DEFAULT_HAND_CAPACITY_PRODUCTION = <決定値>`（2 つの literal 行。hand-on transform の regex は true/false 両対応）。
- **意図的に更新が必要な test / gate**（flag false を固定している箇所）: `handTray.off.test.ts`、`App.handTray.off.test.tsx`、`hand.test.ts:115`、`pinEdit.test.ts:117`、`GameScreen.pantryShell.test.tsx:329,522`、`catalogBoundary.test.ts`、#319 の `lcHandPreview.gate.test.ts` / bundle gate の「production switch = false」assert、そして **#333（IP-1）の `GameScreen.openPoolNav.test.tsx` の `expect(HAND_ENFORCEMENT_ENABLED).toBe(false)`**。R5-e 計画どおり「shipped flag is false」→「non-eligible / inactive は flag に依らず null」へ**置換**（削除しない）。
- production DOM golden（#319）は **22 topping の FREE state では不一致になる**ため新 baseline を取り直す（non-eligible / inactive 部分は OFF 同一性の gate として残す）。
- Preview variant 機構を残すか撤去するかの決定（OD-6）。
- 最終 HV（production-equivalent build）+ merge 後の production exact SHA 確認（Deploy + WebKit）。
- mutation M1〜M114 / E1〜E12 / V1〜V13 / U1〜U5 の全 kill 維持。

---

## 9. capacity 9 vs 12 — Owner 判断に必要な比較条件（Q-C）

**winner は決めない。** 既存設計・HV・画面サイズから確定している事実と、まだ足りない入力を分ける。

### 9.1 確定している事実（比較条件の固定値）

| 軸 | 9 | 12 | 出典 |
|---|---|---|---|
| hand が active になる owned topping 数 | ≥ 10 | ≥ 13 | R5-e §2.1 |
| 1 page の chip 数 | 6（`MAX_INGREDIENT_PALETTE_SLOTS`） | 6 | `ingredients.ts` |
| hand の page 構成 | 6 + 3（page 2 は半分） | 6 + 6（2 page ちょうど） | R5-e §8.1 |
| sauce / cheese への影響 | なし（到達不能） | なし（到達不能） | 現 catalog 3 / 4 |
| stage / dock geometry（390×844, 360×800, 390×664, 360×640） | **同一** | **同一**（dough ⌀ 290 / 273.6 / 269.1 / 245.1、dock 174 / 174 / 162 / 162、scroll なし） | `HAND-CAPACITY-COMPARISON.json` |
| 今日（OFF）との比較 | 22 topping は 4 page | 同左 | — |
| 9 / 12 で変わるコード・UI copy | なし（copy に数字を出さない: OD-R5e-3 / OD-R5-7） | なし | — |
| 既存 test | 両候補で parametrize 済み（hand-on-9 / hand-on-12） | 同左 | R5-e-h |

→ **geometry・コード・copy は決め手にならない。** 差は「hand の幅（探しやすさ）」「page 2 の密度（1 行 vs 2 行）」「pin で押し出される自動枠の数」「active になる所持数の境界」だけ。

### 9.2 Owner の判断に足りない入力（本監査では未計測）

1. **所持 topping 数の分布**: プレイヤーが Dex 進行のどの段階で owned topping 10 / 13 に達するか（progression / unlock graph から決定論的に算出できる。本監査では算出していない）。これにより「9 を選ぶと何割のプレイヤーが hand mode になるか」が決まる。
2. **実機での findability**: 9 は page 2 が 1 行で「見つからない → pantry」が増えやすく、12 は page 2 を見る頻度が増えやすい、という**事前仮説**（R5-e §16-7）。HV-1〜HV-13、M-1〜M-9 で検証が必要。
3. **pin による自動枠の押し出し**: capacity 全てを pin で埋めると auto 枠（`new` / `fill`）が 0 になり、新入荷が tray に出ない（pantry からは届く）。capacity が小さいほど早く起きる。
4. **在庫 0 の消失**（HV-13）が 9 / 12 で体感差を生むか。

### 9.3 比較の運用条件（R6-a OD-R6a-3 / R5-e §16 で確定済み）

同一 PR head・同一 seed・pins 0 開始・各 run 前 reload・ABBA・実機 iPhone 390×844（Safari + standalone）必須・同時比較なし。数値は差の有無のみ報告し推奨しない。

---

## 10. inventory edge cases（Q-E）

| ケース | 挙動（コードで確認） | 状態 |
|---|---|---|
| 在庫 0 の unpinned topping | tray から除外（capacity 件まで在庫ありで補充）。pantry には ×0 表示、新規 pin 不可 | 実装済み（OD-R5e-2）。**R6 HV で「材料が消えた」感を観察（HV-13）**、doc comment 更新 |
| 在庫 0 の pinned | tray に ×0 disabled で残り **slot を消費し続ける**。unpin 可 | 実装済み。補充（Shop）まで slot を占有する点が UX 論点 |
| starter / infinite（`UNLIMITED`、現在は basil のみ topping） | stocked 扱いで自動枠から落ちない。pin 可。×N ではなく ∞ 表示 | 実装済み |
| 新規入荷（purchase / Starter Grant） | **PREPARE 中に所有・在庫は変わらない**（Shop / Dex は RESULT overlay 内のみ）。次 round から `new` tier（取得順から導出、cap あり、starter 除外）で pin の次・fill の前に入る。pin が capacity を埋めていると auto 枠 0 → tray に出ない（pantry で unpin→pin が必要） | 仕様どおり。HV で観察 |
| 消費のタイミング | `CONFIRM_BAKE` の `consumePizzaInventory` のみ（placement では減らない）。hand は round 開始時の stock から導出 → round 内で hand は安定 | 確認済み |
| category 変更（step 変更） | pin は category 別に独立（他 category を触らない）。hand / pantry の対象は `makingStepToCategory`。step 変更では hand transition を評価しない（H-3） | 実装・test 済み |
| shelf filter / search | pantry の表示絞り込みのみ。pin（OD-2）は保持。hand の中身には影響しない | 実装済み（R4 / R5-b） |
| ページング | hand 変化 = page 0。変化なしなら利用者の page を維持。priority のみの入替（同一メンバー・同一 catalog 順）は変化ではない（OD-R5d-1） | 実装・test 済み |
| placed（配置済み）材料 | capacity 超でも hand に残る（安全契約）。placed への pin は slot を消費しない（P-3: 「配置ずみ」表示の要否は非 blocking） | 実装済み |
| reload / PWA 再起動 | pin 消失（session-only）。**iOS standalone は OS が app を落とすため利用者の体感では頻繁に起きうる**（§13 H、HV 観察） | 仕様（OD-R5-9）。要 HV |
| existing pin が無効化 | 所有は増減しない（H-5）ため「効かない pin」になる経路なし。read 時に prune される | 確認済み |

---

## 11. Discovery との接続（Q-F）

事実:

- hand の入力境界は ids / category / ownership / stock / placed のみ。recipe・target・matcher・near-miss・reserve・Dinner target の入力 field は存在せず、`catalogBoundary.test.ts` が import を固定している（R5-e §4: Privacy PASS）。`hint` source は `NO_DISCLOSED_HINTS` 固定で、`disclosedHintsFromSheetView`（Hint が**表示済み**の名前のみ）は **未配線**。
- **IP-1（#333）は既に Hint(OPEN_POOL) → 既存 pantry の導線を実装中**。pantry は現在の step の category で開く・shelf「すべて」・検索なし・何も事前選択しない・OPEN_POOL view は `{kind}` のみで、導線 UI は所有 / step の画面事実だけに依存、pool 独立性を test で固定。**hidden recipe 情報を使っていない**ことを #333 の設計と test が主張している（本監査はコードを読んだが merge 前の他セッションの成果物なので、検証責任は #333 側）。

R6 側が守るべき条件（本監査の確定事項）:

1. hand の `hint` tier は R6 で有効化しない。Hint → hand（`disclosedHintsFromSheetView`）は LC-4 として別途 audit（Hint 5.0 ladder との照合、OD-B5）が要る。**R6 の範囲外**。
2. Pantry は owned 材料しか列挙しない。Discovery 導線から開いても、pin 候補・順序・強調に recipe / pool / 未開示 family を使わない（現実装は catalog 順 + shelf で、これを満たす）。
3. 用語衝突に注意: Discovery の「pin never chooses at pool>1」（PR-4b-A, OD-4b-A-2）は Discovery 側の target 選択規則で、Large Catalog の hand pin とは**別概念**。
4. **flag ON は IP-1 の導線の体験を変える**: IP-1 は「食材庫で材料を探す」を案内するが、hand ON では pantry が pin UI になる。OPEN_POOL の copy「持っている材料をさがしてみよう」と pin 操作の関係を R6-c HV で確認する（導線が pin を促すか、閲覧のみか）。
5. R6-e で #333 の `HAND_ENFORCEMENT_ENABLED === false` assert を更新する必要がある（§8）。

existing 25 / No.26 / Discovery への影響: hand は FREE の tray 表示だけを変え、recipe 判定・採点・Dex・Hint 判定・reducer を一切読まない。FREE tray は recipe を無視して owned を全表示する経路（`freeCook`）なので、hand ON でも recipe の見え方は変わらない。ただし **Discovery の試作（trial）は FREE Cooking 上で行われる**ため、「試したい材料が hand に無い → pantry で pin」という操作コストが Discovery の探索ループに乗る（§13 G-4）。No.26（brazilian-calabresa）を含む既存 recipe の ingredient は catalog の既存 29 件内で、catalog 件数は R5-e 監査時と同じ（個別の ingredient 列挙までは本監査で確認していない）。Dinner / guided / Lunch Rush は eligibility で対象外（H-6 で App-level 固定）。

---

## 12. mobile risk（390×844 / 360×800）

| 観点 | 事実 / リスク |
|---|---|
| tray geometry | 9 / 12 とも 4 viewport で stage / dock 同一、scroll なし。**geometry は capacity 判断材料にならない** |
| pantry normal | 390×844 = 7 行、360×800 = 7 行（strip なし）/ 6 行（strip あり 44px）。strip 追加で 360×800 は 1 行減る |
| pantry keyboard 表示中（K=338 simulated） | 390×844 = 3 行、360×800 = 3 行（strip なしの場合）。strip は方式 D で隠れる |
| 小画面 + 大 keyboard | 390×664 / 360×640 + K=380 で list 0 行（R5-b 由来の既存事項 F-5）。実機 HV で確認、問題なら別 slice |
| rejection toast（c2） | overlay にして list 行数を減らさないこと自体が受け入れ条件。keyboard fit 中は visual viewport 下端に追従する必要あり（未実装・要 WebKit 実機確認） |
| 実測の限界 | 上の数値は Chromium emulation / simulated keyboard。実機 keyboard は R5-b HV（PASS、Preview `7bf1486`）の範囲のみ。WebKit は sandbox で実行不可 → CI と実機 HV が authority |
| CI | webkit-390x844 / 360x800 が required（R6-c の e2e は両 viewport で書く） |

---

## 13. production ON の regression risk（Q-G）— 既存 FREE UX

hand mode になるのは **FREE ∧ TOPPING step ∧ owned topping が閾値超**のプレイヤーのみ（それ以外は byte 同一。これは golden と ON-inactive ≡ OFF gate で証明する設計）。その対象プレイヤーの既存 FREE UX は次のように変わる:

| # | 変化 | 重大度 | 緩和 / 確認 |
|---|---|---|---|
| G-1 | tray が 4 page（22 topping）→ 2 page。表示される材料の集合が変わる（`new` と catalog 順 fill） | 高（体感変化） | R6-c / R6-d HV |
| G-2 | 在庫 0 の unpinned topping が tray から消える（現行は ×0 disabled で常時表示 = EP3「never hidden」）。「材料が消えた」と感じうる | 高 | OD-R5e-2 確定済み。HV-13。pantry で到達可能 |
| G-3 | hand 変化で page 0 reset + #197 による selection clear が、pantry を閉じた後に起きる | 中 | HV-6 / HV-7、P-7 |
| G-4 | FREE の Discovery 試作で、hand に無い材料を使うには pantry → pin（2 操作）。探索ループの摩擦 | 中 | IP-1 の導線で緩和されうる。HV で M-1（目的到達 tap 数） |
| G-5 | pin で capacity を埋めると新入荷が tray に出ない | 中 | rejection copy が「ピンを外して」と誘導。HV |
| G-6 | session-only pin が iOS standalone の再起動で消える | 中〜高（体感） | **save 変更を伴う解決は OD-4（§15）**。まず HV で頻度を観察 |
| G-7 | 在庫 0 の pinned が slot を占有し続ける | 低〜中 | HV-13 / OD-9 |
| G-8 | strip（44px）による pantry list 行数減、keyboard 時の 0 行 | 中 | 方式 D、HV-8 |
| G-9 | silent rejection（AB-1）/ no-op pin（AB-2）をそのまま ON にすると「壊れている」に見える | **blocker** | R6-c c1 / c2 |
| G-10 | 初見のプレイヤーに「tray が 22 → 12 に減った」ことの説明が無い | 中 | OD-8（一度きりの案内の要否。入れるなら保存場所を決める） |
| G-11 | production golden / 既存 OFF test が flag false を前提 | 管理可能 | §8 R6-e の置換リスト |
| G-12 | guided / Lunch Rush / Dinner への漏れ | 低 | eligibility + H-6 で固定済み |

---

## 14. save schema（Q-H）

**結論: 現行の方針（pins session-only、hand は導出）のままなら save schema 変更は不要。**

根拠: `persistence.ts` / `GameState` に hand / pin の field は無い（grep）。pin は `useState` のみ。hand は毎 render の導出で、`new` tier は既存の `ownedIngredientIds` の取得順（append-order invariant、`persistence.ts:270`）から導出する（OD-R2-2: 「新 field を足さない」）。Preview は別 save key（`teto-pizza-preview-save-v1`）。schemaVersion は 2 のまま（#333 も同様に確認）。

**ただし次のいずれかを Owner が選ぶと schema 変更が必要になる**（現時点で選ばれていない）:

1. pin を reload / 再起動後も保持する（G-6）。
2. 「hand の案内を見た」ような一度きりの案内（G-10）の既読 flag。
3. `favorite` / `recent` tier（`UsageSession`）を実際に有効化する。

したがって「save schema 不要」は **R6 現行スコープ（OD-R5-9 session-only）に限った結論**で、HV 後の判断（OD-4 / OD-8）で覆る可能性がある。覆るなら R6-e の前に別 slice（migration / forward-compat を含む）が必要。

---

## 15. Owner Decisions（提案のみ。本監査は決定しない）

| # | 決定事項 | 選択肢 / 論点 | 必要なタイミング |
|---|---|---|---|
| **OD-1** | R6-a authority（`4d2d6ae` / `7727cdc`、OD-R6a-1〜7）を main の docs に再 land するか、どこで | #319 に同梱 / 別 docs PR / 本監査 report を参照して不要とする | #319 merge 前 |
| **OD-2** | R6-c と R6-d の HV を統合するか（§16 案 B）。9 と 12 の variant を同じ R6-c head から 2 つ作り、1 回の HV で UI 検証と比較を兼ねる | 統合 / R6-a 計画どおり分離（UI 修正で比較をやり直さずに済む） | R6-c 着手前 |
| **OD-3** | capacity 9 vs 12 | §9 の条件で R6-d 後に決定。追加入力: 所持 topping 数の分布 | R6-d 後 |
| **OD-4** | pin の永続化（session-only 継続 / reload 後も保持） | 継続なら save 変更なし。保持なら schema 変更 slice が R6-e 前に必要 | R6-c HV 後 |
| **OD-5** | rejection UX（toast 位置・時間・copy）と keyboard 維持（OD-R5c-5）の最終判断 | R6-c 初期値のまま / HV 結果で変更 | R6-c HV 後 |
| **OD-6** | R6-e で Preview variant 機構（`lcHandPreview.ts`）を残すか撤去するか | 残す（今後の HV に再利用）/ 撤去（dead code 削減） | R6-e |
| **OD-7** | `hv/lc-hand-9-*` / `hv/lc-hand-12-*` の push と Preview deploy 起動の許可（この session の push 権限は指定 branch のみ） | 許可 / Owner が push・dispatch | R6-c |
| **OD-8** | 初回の hand 案内（一度きり）の要否 | 不要 / 要（要なら保存場所 = save 変更 or session のみ） | R6-c HV 後 |
| **OD-9** | 在庫 0 の pinned を自動で外すか（現行は残して slot 占有）、「おまかせに戻す」に確認を付けるか、placed への pin の表示（P-3 / P-5） | 現状維持 / 変更 | R6-c HV 後 |
| **OD-10** | `hint` tier（Hint → hand）を R6 で有効化しない確認。LC-4 を別 audit に分離 | 確認 | 今 |

---

## 16. 最小 Completion Plan

### 16.1 基本案（R6-a 計画を main の現状に合わせて圧縮）

```
[0] #319 (R6-b)  : main へ更新 → CI(WebKit) green → Owner merge   （OD-1 を先に決める）
        │
[1] R6-c  (1 PR) : c1〜c8 を実装（production dormant）
        │           + Preview 用 lc seed
        │           HV: variant SHA で 390×844 video + screenshot（OD-7）
        │
[2] R6-d  (HV運用, PR なし): 9 / 12 variant を ABBA で実機比較 → 数値と所見を docs に記録
        │
[3] capacity decision (Owner, docs のみ)  ← OD-3 / OD-4 / OD-5 / OD-8 / OD-9
        │
[4] R6-e  (1 PR) : literal 2 行 + test 置換 + production golden 再取得
        │           + final HV（production-equivalent）
        │
[5] merge 後: production exact SHA 確認（Deploy + WebKit）→ production ON 完了
```

PR 数: **#319 + R6-c + R6-e = 3 本**、HV セッション 2 回（R6-c / R6-d）、Owner 決定 1 回。

### 16.2 統合案（既存 slice のうち不要または統合できるもの）

| 案 | 内容 | 効果 | リスク |
|---|---|---|---|
| **A. R6-b を R6-c に畳まない** | #319 は既に green・mergeable・production 挙動 0 変更。畳むと R6-c が大きくなり review / HV が遅れる | — | 畳む案は**非推奨** |
| **B. R6-c と R6-d の HV を 1 セッションに統合**（OD-2） | R6-c head から variant 9 / variant 12 を同時に作り、実機 HV 1 回で UI 検証と 9/12 比較を兼ねる。R6-d は「決定」だけの docs step に縮む | 実機セッションが 2 → 1 回 | HV で UI 修正が出ると比較の前提が変わる（R6-a が分離した理由）。**geometry が 9 / 12 で同一**なので、修正が findability に影響しない限り比較は再利用できる。影響する修正が出たら比較のみやり直す |
| **C. R6-d の PR 化は不要** | R6-d は PR を作らない運用（variant は merge しない）。結果は R6-e の docs に統合 | PR 1 本減（既に基本案に反映） | — |
| **D. R6-e を決定 PR と同一にする** | capacity 決定の docs と literal flip を 1 PR に（決定が docs に残り、revert 容易） | docs-only PR を 1 本省略 | 決定の review と production flip の review が混ざる（Owner が分けたければ分離） |
| **E. 不要な slice** | R6-a 独立 slice は既に完了（audit のみ）。新規の R6-a2 / R6-b2 は不要 | — | — |

**最小**: 基本案 + B + C + D を採ると、PR は **#319 / R6-c / R6-e の 3 本、実機 HV は 1 回（+ final の production-equivalent 確認）**。B / D を採るかは Owner（OD-2）。本監査はどちらも決めない。

### 16.3 production ON の完了条件（R6-e の Definition of Done）

- Owner が capacity を決定済み。
- AB-1 / AB-2 解消（c1 / c2）、R6-c HV 実施済み、final HV 実施済み。
- production DOM: non-eligible / inactive は OFF と byte 同一、active は新 golden。
- 既存 mutation 全 kill、WebKit Gate（390 / 360）green、post-merge Deploy green。
- 保存（save schema）変更なし、または OD-4 / OD-8 の結果に基づく別 slice 完了。

---

## 17. blockers

| # | blocker | 種別 | 解消 |
|---|---|---|---|
| B-1 | R6-a authority が main の docs tree に無い（OD-R6a-1〜7 が handoff / docs に無い） | docs / SSOT | OD-1 |
| B-2 | #319 の base が 41 commit 古く、WebKit green が旧 base の結果 | CI | head 更新 + CI 再取得（Owner / 担当 session） |
| B-3 | AB-1（silent rejection）/ AB-2（no-op pin UI）が production ON の blocker のまま | 実装 | R6-c |
| B-4 | Preview 用 lc seed が無い（実機 HV の前提） | 実装 | R6-c c5 |
| B-5 | `hv/*` branch の push と Preview deploy 起動の権限 | 権限 | OD-7 |
| B-6 | 実機 HV（video・VoiceOver・IME・standalone）は Owner / 実機でしかできない | 運用 | R6-c / R6-d |
| B-7 | capacity 未決定、所持 topping 数分布が未算出 | Owner | OD-3 |
| B-8 | WebKit を sandbox で実行できない | 環境 | CI が authority |

**hard blocker ではない**: #319 の merge 可否、catalog / save の構造、privacy 境界（PASS）。

---

## 18. IP-1（#333）との競合

- **本セッションは #333 の branch / files に触れていない。** 本監査が変更したのは本 report 1 file のみ。
- **file 競合**: #333 は `GameScreen.tsx`（hint → pantry の open ref / `hintPantryAccess`）、`HintSheet.tsx`、`openPoolCopy.ts`、`App.css`、新規 test / e2e / report。#319 は `handPolicy.ts` / `PreviewBadge.tsx` / `lcHandPreview.ts` / vitest 設定 / tooling で **file の重なりなし**。#319 を #333 の前後どちらで merge しても textual 競合はない見込み（#333 の head との merge-tree は未実施 — 他セッションの branch のため）。
- **将来の競合**: R6-c は `GameScreen.tsx` の `handEditing`（895 行付近）と pantry props、`IngredientPantry.tsx`、`App.css`（toast / status 領域）、`hvSeeds.ts` を触る。#333 も `GameScreen.tsx` と `App.css` を触るので、**R6-c 着手時に #333 の merge 状況を再確認**する（領域は異なるが同一 file）。`PROJECT_HANDOFF.md` は両方が追記しうる。
- **論理競合**: #333 の test が `expect(HAND_ENFORCEMENT_ENABLED).toBe(false)` を持つ → R6-e で意図的に更新が必要（§8）。#319 後も通常 build では false のまま（本監査の merged 実測で 5639 passed。ただし #333 は含まない）。

---

## 19. 最終報告（要約）

1. **audited SHA**: `93ca1e404c4e942e48b69506ff600bd8fcdfbb51`（expected と一致）
2. **#319**: open / clean / head `c5d2da7` / base `6abddc7`（41 commit 遅れ）/ CI 9/9 green（旧 base）/ production src 3 files。main + #319 の merge tree を実測: tsc clean、Vitest 300 files / 5639 passed、Chromium golden spec PASS。**そのまま R6-b として使える（条件: head 更新 + WebKit 再取得、R6-a docs の扱い決定）**
3. **既存実装**: R0〜R5-e-h が main に dormant で存在。R6-a の audit は履歴のみ、R6-c〜e は未着手
4. **production OFF の理由**: `HAND_ENFORCEMENT_ENABLED = false` literal。加えて AB-1（silent rejection）/ AB-2（no-op pin UI）/ AB-4（実機 HV 未実施）/ AB-5（capacity 未決定）が未解消
5. **pin**: session-only、Model D 即 toggle、Model C 受理、在庫 0 は新規不可、strip 方式 D。rejection / announce / keyboard 維持 / active 限定は未実装
6. **hand**: catalog 順、実効 source は placed / pinned / new / fill のみ（hint / favorite / recent は空）。active は topping のみ（≥13 or ≥10）
7. **tray 統合**: pin → Model C → hand 再導出 → catalog 順表示、変化時 page 0 + #197。在庫 0 は pinned のみ ×0 で残る
8. **R6-b〜e gap**: §8
9. **9 vs 12**: geometry・コード・copy は同一。差は page 2 密度・findability・auto 枠・閾値。足りない入力 = 所持 topping 数分布と実機 HV（§9）
10. **inventory edge**: §10（PREPARE 中は所有・在庫不変、消費は `CONFIRM_BAKE` のみ）
11. **Discovery**: hand は recipe / hint を読まない。`hint` tier は未配線のまま R6 で触らない。IP-1 の導線は #333 が別途実装、hand ON で体験が変わる点を HV で確認
12. **mobile**: §12。toast は overlay、keyboard 時の小画面 0 行は既存事項
13. **save schema**: 現行スコープ（session-only）なら不要。pin 永続化 / 初回案内 / favorite・recent 有効化を選ぶと必要
14. **最小 Completion Plan**: §16（3 PR + HV、統合案 B / D は OD）
15. **Owner Decisions**: OD-1〜OD-10（§15）
16. **blockers**: B-1〜B-8（§17、hard blocker なし）
17. **IP-1 との競合**: 現時点で file 競合なし・本セッションは未接触。R6-c 着手時と R6-e の flag assert 更新で再確認（§18）

**STOP。** 実装・PR・merge は行っていない。コミットは本 report のみ。
