# Large Catalog R6 — Pin / Hand Production Readiness Fresh Audit

**AUDIT / DESIGN ONLY。** src / e2e / CSS / production flag の変更なし、PR なし、merge なし、#319 / Discovery 3.0 IP-1 には触れていない（docs-only report 1 本）。
capacity 9 / 12 は決めない。新しい仕様は作らない（既存 Owner Decision と current code の記述のみ）。

---

## 1. Fresh Gate

| 項目 | 値 |
|---|---|
| audited main (`origin/main`, fresh fetch) | **`93ca1e404c4e942e48b69506ff600bd8fcdfbb51`**（PR #332 Notebook N1 merge、2026-10-01 23:26 JST）= expected main と **一致、drift 0** |
| branch | `claude/pin-hand-readiness-audit-pi0uv0`（main から分岐、docs-only） |
| open PR | 23 本。Large Catalog 関連は **#319（R6-b）** と **#272（LC-1 / LC-1b 旧 pure model、superseded 扱い）** のみ。#321（Dough Guide Leak Fix）は Pin/Hand 無関係 |
| open Issue | 34 本。Pin/Hand / R6 専用の open Issue は無し（#269 LC-1 / #270 LC-X Undo は別件） |
| R6 関連 remote branch | `claude/lc-preview-activation-r6b-f78gdv`（#319 head `c5d2da7`）。R6-a 専用 branch は無い（R6-a は他 branch の履歴に残るのみ、§3） |
| IP-1 branch | origin に **IP-1 実装 branch / PR は存在しない**（`claude/discovery-3-*` は N1 まで。IP-1 は別 session の local / 未 push と推定）。競合は §19 |

### 1.1 Large Catalog SSOT / PROJECT_HANDOFF / ROADMAP の矛盾

| # | 記述 | current evidence | 判定 |
|---|---|---|---|
| C-1 | PROJECT_HANDOFF 「LC-R5-e-h … R6 not started — next: re-check the R6 slice boundaries from current main」 | main には R6 の docs / src が **0**（`git ls-tree origin/main docs/reports \| grep R6` = 0）。R6-b は #319 で open | handoff は「R6 not started」で正しい。ただし **R6-a / R6-b の記録が handoff に無い**（#319 head だけに handoff 2 行追加あり） |
| C-2 | R6-a Fresh Audit（`4d2d6ae` / `7727cdc`）は「R6-b と一緒に re-land」と記録 | #319 は **re-land しない**（Owner decision と PR body に明記）。`89a23ee` が main 履歴上で **revert 済み** → 内容は main tree に無い。履歴上の commit としてのみ到達可能（`git show 7727cdc:docs/reports/TETO_LARGE-CATALOG-UX_LC-R6a_…`） | R6-a の slice 定義（R6-b〜e）は main に **文書として存在しない**。本 report §16 がその代替 authority を兼ねる |
| C-3 | #319 body「R6-a audit commits … history-only authority」 | 上記と一致 | OK |
| C-4 | handoff 本文は R6 の slice 順を `R5 → R6 mobile / a11y / HV` と粗く記述 | R5-e §17 / R6-a §23 で R6-a〜e に細分化済み | 古い記述。current は R6-a〜e |
| C-5 | R5-e Fresh Audit AB-1〜AB-6（activation blocker 6 件） | 解消状況は §4.3 | — |

ROADMAP 専用ファイルは repo に無く（`docs/` に ROADMAP*.md なし）、roadmap SSOT は `docs/PROJECT_HANDOFF.md`。

---

## 2. 結論（先出し）

- **production OFF の理由**: `handPolicy.ts:14` `HAND_ENFORCEMENT_ENABLED = false`（literal）。R5-c/d は「dormant code を ship し flag で閉じる」設計で、**pin UI / hand 導出 / tray 配線 / #197 は全て production bundle に既に存在し、到達不能なだけ**。OFF の根拠は Owner Decision（OD-R5c-1: pin UI は hand 挙動と同時に公開）と、未解決の **activation blocker**（§4.3）。
- **残作業の本体**は「ロジック」ではなく ① **未実装の production UX（capacity-full の rejection feedback、inactive category の pin UI 非表示 = OD-R5e-1/3）**、② **real-device HV**、③ **Owner の capacity 決定**、④ **flag を true にする 1 行 + golden 更新**。
- Pin/Hand は hidden recipe を入力に持たず、Discovery と構造的に独立（§8）。save schema v2 は無変更で ON 可能（§9）。

---

## 3. R6 / #319 History

### 3.1 slice 別 state

| slice | 内容 | state |
|---|---|---|
| R5-a/b/c/d/e-h（前提） | pantry availability / search / dormant pin / dormant tray hand / activation hardening | **MERGED**（#308 / #310 / #312 / #314 / #318。R5-e Fresh Audit + R5-e-h は #318 `6abddc7`） |
| **R6-a** | Preview Activation Fresh Audit + Owner Decisions（verdict A、A2 案） | **DOCS-ONLY / HISTORY-ONLY**: `4d2d6ae` + `7727cdc` が一度 #318 に入り、`89a23ee` で revert。**main tree には無い**。re-land 予定だったが #319 は re-land せず（未解決。§17 OD-A-1） |
| **R6-b #319** | Preview-only Hand activation infrastructure（A2、fail closed） | **OPEN**（非 draft、approvals 0、review comment 0）。**FLAG-OFF / PREVIEW-ONLY**（production 挙動不変） |
| **R6-c** | Preview Hand/Pin UI activation（OD-R5e-1/3、rejection UI、a11y） | **NOT STARTED** |
| **R6-d** | 9 vs 12 real-device comparison | **NOT STARTED** |
| **R6-e** | Owner capacity decision + production activation | **NOT STARTED** |

「SUPERSEDED」に該当するのは #272（LC-1/1b の旧 pure model。R0 で foundation を port し直し済み。PR は open のまま）。

### 3.2 #319 詳細（変更していない・読むのみ）

| 項目 | 事実 |
|---|---|
| head / base | head `c5d2da7e` / base `6abddc71`（= R5-e #318 merge）。**main は +41 commit 進行**（`6abddc7..93ca1e4`、Discovery 3.0 PR-4a/4b、DH、Notebook N1、DM-3R 等） |
| 規模 | 2 commit、24 files、+886 / −18。production src は 3 files（`handPolicy.ts`、`PreviewBadge.tsx`、新規 `src/preview/lcHandPreview.ts`）。残りは test / e2e / tools / report / screenshot / `vitest.config.ts` / `catalogBoundary.test.ts` 追従 |
| merge conflict | `git merge-tree --write-tree origin/main origin/<head>` = **conflict なし（tree が生成された）**。GitHub `mergeable_state: clean` |
| 重なるファイル | main 側の 41 commit が触った src は 40 files だが、**`handPolicy` / `PreviewBadge` / `vitest.config.ts` / `src/logic/catalog/**`（large-catalog fixture test を除き）/ `App.tsx` は #319 と衝突する変更なし**。`GameScreen.tsx`（N1 の Hint dialog inert）は main 側のみの変更で #319 は触れない（Hand 関連行は main 側で未変更） |
| stale assumptions | ① 「production DOM golden = R5-e baseline（main `6abddc7`）」は **古い**。main の GameScreen / 各 UI が +41 commit 動いたため、golden（`…R6b_PRODUCTION-DOM-GOLDEN.json`、13 snapshot）は rebase 後に **再採取して一致確認** が必要（Hand に無関係な変更で差が出るなら golden の対象範囲が広すぎる）。② 「5410 passed」は旧 base の数字。③ #319 report の R6-a 参照先（`4d2d6ae` / `7727cdc`）は main tree に無い（C-2）。④ production recipe が 25 → 26（No.26）になり、FREE round の e2e seed / Dex 前提が増えた |
| Preview override | A2: committed 定数 `LC_HAND_PREVIEW_CAPACITY`（**main = `null`**）を `import.meta.env.VITE_PREVIEW_MODE` の後ろでのみ読む。query / storage / runtime switch なし。HV には PR head から **使い捨て variant commit**（値 9 / 12、PR / merge しない）を作り Preview repo の既存 SHA 指定 pipeline で deploy。fail-closed 証明は P-1〜P-5 + mutation 14/14 |
| checks（head `c5d2da7`） | 9 check run **全て success**（WebKit Gate、webkit 390×844 / 360×800 各 2 shard、layout-chromium、Layout Contract Gate、build、classify）。PR comment にある `webkit-390x844 shard 1/2` の失敗（`discovery-near-miss-result.spec.ts` ORIGINAL REMOVE_ONE、timeout）は **再実行で success**（check run 一覧が success） |
| review status | review 0 件、review comment 0 件、comment 1 件（上記 CI note のみ）。**人間の approval なし** |
| 取り込み再 base 量 | **小**。conflict 無し・変更は 3 production files。必要作業は ① main を merge（`update_pull_request_branch` 相当、history を書き換えない）② production DOM golden の再採取と一致確認 ③ `npm test` / WebKit 再走 ④ （任意）R6-a audit の扱い決定。再実装は不要 |
| #319 を working として使うか | **使える**。ただし本 audit は #319 の merge を要求しない（Owner の R6 進行判断）。本 audit の slice 提案（§16）は #319 を R6-b として **そのまま採用** する前提 |

---

## 4. Existing Pin Implementation（current code、`93ca1e4`）

### 4.1 分類（実装済み / flag で隠れているだけ / 未実装）

凡例: **IMPL**=実装・test 済み（現在 production bundle 内で dormant）、**HIDDEN**=flag（`HAND_ENFORCEMENT_ENABLED`）でのみ隠れている、**GAP**=Owner decision はあるが production 用 UI が未実装。

| 項目 | 実装 | 分類 |
|---|---|---|
| pin / unpin | `pinEdit.togglePin`（Model D: tile 1 tap で即編集、確認なし）。`pinned` / `unpinned` / `rejected-no-stock` / `rejected-not-owned` / `rejected-capacity` | IMPL / HIDDEN |
| selected state | tile `aria-pressed` + 📌 badge（`IngredientPantry.tsx`）、`pinTileState` | IMPL / HIDDEN |
| selected strip | 「📌 選択中」+ 〇〇を外す + 「おまかせに戻す」（`selectedStripRendered`: handEditing ∧ pin ≥ 1）。keyboard fit（`pantry-sheet--fit`）中は CSS で hide（方式 D） | IMPL / HIDDEN |
| selection ordering | `addToHand` は既存順を保ち **選択順で追記**。ただし tray の表示は **catalog order**（OD-R5d-1）。順序が効くのは「pin が capacity に入る優先」のみ（placed > pinned（選択順）> hint > favorite > recent > new > fill） | IMPL |
| duplicate handling | `cleanIds` + `addToHand` が既存 id を除外。既に pin 済みを tap = unpin（toggle） | IMPL |
| max capacity | `selectWorkingSet` + **Model C**（`pinFitsHand`: 新 pin が visible hand に入らなければ `rejected-capacity`、unpin は常に可）。placed は capacity 超でも保護（OD-R5d-2） | IMPL / HIDDEN。**拒否時の UI は無し（GAP）** |
| category ごと | `HandSession = {sauce, cheese, topping}` を別管理。操作は active category のみ。他 category の pin に触れない。**sauce(3) / cheese(4) は capacity 9/12 のどちらでも inactive**（hand 不成立）、topping(22) は owned ≥ 10（9）/ ≥ 13（12）で active | IMPL。inactive category でも pin UI が出る = **F-1（GAP）** |
| session reset | App-level `useState`（`App.tsx:237`）。**round / step / HOME / FREE restart / Dinner では reset しない**。reload / app 再起動で空 | IMPL（仕様、OD-R5-9）。§10 |
| HOME / FREE 遷移 | pins 維持、pantry は unmount、selection は round key 変化で null | IMPL（test: `App.handPins`） |
| recipe discovery 後 | `HandSession` は GameState / Dex を読まない。discovery で pin は変わらない。新 recipe が材料を unlock しても（購入されるまで）owned に入らない | IMPL（独立） |
| inventory purchase 後 | 購入で `ownedIngredientIds` に追記 → 次 round から `recentlyAcquiredIds`（`new` tier、starter 除く）に入る。**pin は自動追加されない** | IMPL。F-1 の副作用（inactive 時に pin を積みすぎると新購入 topping が hand に出ない）→ OD-R5e-1 で解消予定 |
| inventory 0 | 新規 pin 不可（「ざいこなし」+ `aria-disabled`）、既存 pin は残り unpin 可、**hand mode では unpinned ×0 topping は tray から除外**（pantry には ×0 で残る） | IMPL（OD-R5e-2、tray の doc comment は旧「never hidden」のまま = P-4 polish） |
| starter / infinite | `remainingStock`: 非 unlockCondition = `"UNLIMITED"` → `hasStock` true。starter は常に pin 可・auto-fill 対象 | IMPL |

### 4.2 「hand source」の実効（重要）

`resolveHand` は `disclosedHints = NO_DISCLOSED_HINTS` **固定**、`usage = {favorites: [], recent: [], newlyOwned}`（favorites / recent は常に空）。よって activation 時に効く tier は **placed / pinned / new / fill の 4 つだけ**。fill は catalog order + 在庫あり。→ **pin しない player が見る hand は「catalog の先頭から N 件（在庫あり）」** で、後ろの topping は pantry + pin 経由でしか tray に出ない（§6 の 62 ingredient 影響）。

### 4.3 R5-e AB-1〜AB-6（activation blocker）の current 状態

| AB | 内容 | 状態（current main） |
|---|---|---|
| AB-1 | capacity-full rejection が無反応 | **未解消**。`rejected-capacity` の outcome は `IngredientPantry.tsx` で捨てられる（`outcome` 参照 0 件を grep 確認）。文言は OD-R5e-3 で確定（数字なし）、実装は **R6-c** |
| AB-2 | inactive category の no-op pin UI | **未解消**。`GameScreen.tsx:895` `handEditing={HAND_ENFORCEMENT_ENABLED}`（flag のみ）。OD-R5e-1 で「active category のみ」確定、実装は **R6-c**（`handEditing = flag ∧ trayHand.ids !== null` 案、R6-a §13） |
| AB-3 | ON test が mock / OFF golden 不在 | **解消**（R5-e-h: `hand-on-9/12` project が real `handPolicy.ts` を ON compile。OFF golden は #319 で 13 snapshot 追加＝#319 未 merge なので main には **無い**） |
| AB-4 | real-device Human Feel 未実施 | **未解消**（R6-c/d） |
| AB-5 | capacity 未決定 | **未解消**（Owner。R6-e の前提） |
| AB-6 | Preview で ON を出す手段なし | **#319 で解消予定**（未 merge） |

---

## 5. Hand / Working Set

| 項目 | 事実 |
|---|---|
| hand derivation | 純関数 `resolveHand` → `selectWorkingSet`。入力は ids / catalog descriptor（category）/ ownership（ownedIds + stock）/ placedIds / pins / usage のみ |
| state authority | **hand 自体に state は無い**。真の state は ① `HandSession`（App `useState`、pins のみ）② GameState の `ownedIngredientIds` / `inventory` / `pizza`。hand は毎 render 導出（`App.tsx:350-366`）。`trayHandTrack` は #197 判定用の前回 list の保持のみ |
| selected / pinned の関係 | 「selected」には 2 種ある: **pantry の pin**（=`HandSession`、"pinned" として working set に入る）と **tray の `selectedIngredientId`**（配置用の選択）。両者は別物（OD-2）。pin 編集で hand が変わると #197 規則で `selectedIngredientId` が page 0 に無ければ clear |
| `trayHandIdsFor`（依頼文の `trayIngredientsFor`） | 該当名の関数は repo に無い。実体は `handTray.resolveTrayHandIds` → `IngredientTray` の `handIds` prop（`IngredientTray.tsx:160`、非 null で list を差し替え、`handKey` 変化で render-phase `setPage(0)`）。**null = 現行の tray コード経路そのまま** |
| pagination | tray は 6 件/page（`MAX_INGREDIENT_PALETTE_SLOTS=6`）。hand ≤ 12 → **最大 2 page**。tray は hand を **catalog 順**で表示（priority は membership のみ）。実変更で page 0 + selection 再評価 |
| sauce / cheese | catalog 3 / 4 件 → capacity 9/12 では **常に inactive**（hand は null、tray 不変）。flag ON でも変化なし |
| topping | 22 件。owned が capacity 超で active。**flag ON で挙動が変わるのは実質ここだけ** |
| dough | tray なし（`trayCategory = null`）。無関係 |
| current cooking step | `trayCategory` は `PREPARE ∧ makingStep ∈ {SAUCE, CHEESE, TOPPING}` のときだけ非 null。それ以外（DOUGH / 焼成 / 結果）は hand null |
| FREE only か | **Yes**。`isLargeCatalogEligible` = `roundKind === "FREE_COOK" ∧ dinner === null`（`freeEligibility.ts`）。pantry 表示（`pantryAvailable`）も同条件 |
| Guided / Lunch Rush への影響 | **なし**（eligible 外 → `resolveHand = null`、pantry 非表示。R5-e-h H-6 で App-level 固定。Lunch Rush と guided の App test は pure `:207` + H-6 で分担） |

### 5.1 production ON で変化する画面 / mode（正確な列挙）

| # | 変化 | 条件 | 変化しないもの |
|---|---|---|---|
| 1 | FREE Cooking の **TOPPING step の tray**（22 owned → 12/9 件に絞り、2 page。pager は「1 / 4」→「1 / 2」） | topping owned > capacity（12: ≥13、9: ≥10） | stage / dock geometry は 9 / 12 とも今日と同一（R5-e §8.1） |
| 2 | **pantry sheet**（食材庫）に pin UI（tile が toggle button、📌、「ざいこなし」、strip、「おまかせに戻す」） | FREE ∧ PREPARE ∧ SAUCE/CHEESE/TOPPING ∧ いずれかの category で owned > 6 | **現 code のまま ON にすると SAUCE / CHEESE step でも出る（F-1）** → R6-c で OD-R5e-1 により active category のみに絞る前提 |
| 3 | 在庫 0 の unpinned topping が tray から消える | hand active | pantry には ×0 で残る |
| 4 | pin 編集で hand が変わると tray が page 0 に戻り、page 0 に無い `selectedIngredientId` が clear | 実変更時 | priority のみの reorder は変更ではない |
| 5 | capacity full で hand 外の tile を tap | — | 現 code では **無反応**（AB-1）→ R6-c で feedback |
| 6 | 食材庫 entry / utility row | — | **変化なし**（`pantryWorthwhile` は flag と無関係、OD-R5-10） |

**変化しない**: Guided / Lunch Rush / Dinner / HOME / Shop / Dex / Hint / Notebook / Result / Save。SAUCE / CHEESE step の **tray**。

---

## 6. Capacity 9 vs 12（**Owner 未決定。winner は決めない**）

### 6.1 事実（measure 済み・current code）

| 観点 | 9 | 12 |
|---|---|---|
| tray page 数（6/page） | 2（6+3） | 2（6+6） |
| page 2 の chip 数 | 3 | 6 |
| 390×844 / 360×800 / 390×664 / 360×640 の stage ⌀ / dock / scroll | **12 と同一**（290 / 273.6 / 269.1 / 245.1、dock 174 / 174 / 162 / 162、scroll なし） | 同左 |
| 現 29 ingredient（topping 22）で topping hand が active になる owned 数 | ≥ 10 | ≥ 13 |
| sauce(3) / cheese(4) | inactive | inactive |
| pantry の行数（normal 7/7/5/5、keyboard 3/3/1/1） | 同一（capacity 非依存） | 同一 |
| selected strip の高さ（44px、keyboard 中は hide） | 同一 | 同一 |

**stage / dock / pantry geometry に 9 vs 12 の差は無い**。差は「hand に入る topping 数」「page 2 の密度」「pin 余地」だけ。

### 6.2 比較

| 観点 | 9 | 12 |
|---|---|---|
| UX 長所 | hand が小さく「今日使うもの」感が強い。page 2 が短く 1 行。認知負荷が低い方向 | 「見つからない → pantry」が起きにくい。page 2 を見る頻度は増えるが 2 page 内で完結。最小限の品揃え（現行 topping の過半）を tray 内で確保 |
| UX 短所 | **pantry + pin に出る頻度が高い**（hidden 13/22）。pin で枠を使うと auto-fill が痩せる（9 − pins）。pin 前提の導線になりやすい | page 2 が 6 件で tray が「全部入り」に近く、**hand 化の価値（絞り込み）が弱い**（hidden 10/22 しか減らない）。62 ingredient 時の相対圧縮は 9 より弱い |
| 29 ingredient（今日） | topping 22 のうち 13 件が pantry 経由 | topping 22 のうち 10 件が pantry 経由 |
| 62 ingredient（将来、topping は増える） | 隠れる割合がさらに増える。fill が catalog 先頭固定なので **後半 topping は常に pin 必須**（Owner が望む挙動かは別途確認） | 同様（割合は小さめ）。いずれも **fill が catalog order 固定 = capacity では解決しない構造** |
| 172 recipe | recipe 数は hand に影響しない（hidden recipe を入力にしない）。discovery 頻度が増える = pantry 往復が増える | 同左 |
| 実装含意 | production 定数 1 行（`DEFAULT_HAND_CAPACITY_CANDIDATE`）。**logic / UI / geometry は共通** | 同左。**現在の shipped default は 12（design candidate のみ、OD-R2-1/R5-1）** |
| test 含意 | `hand-on-9` / `hand-on-12` project が両方を既に走らせる。App-level は R5-e-h で 9 / 12 parametrize 済み。**R6-e で確定値の ON golden を新 baseline にし、他方は parametrize のまま残す**（E5 survive 方針は R5-e-h 参照）。page 2 の 3 件 / 6 件の snapshot 差のみ新規 | 同左 |

### 6.3 Owner が実機比較するための HV scenario（ABBA、同一 exact SHA の variant 2 本 = #319 A2）

共通条件: 390×844 real iPhone（Safari + standalone）必須、可能なら 360×640 相当で keyboard-open pantry のみ追加。`?hv=` seed = topping 22 owned・在庫固定（3 種 ×0、他 5、うち 1 種 stock 1）、pins 0 から開始、各 run 前に reload（pins は session-only）。9→12 と 12→9 を別日に各 1 回。video は 390×844、直接送付（repo に commit しない）。

| id | scenario | 見るもの |
|---|---|---|
| S1 | page 1 にある topping だけで 1 pizza | page 切替不要か、page 2 に気づくか |
| S2 | page 2 の topping を使う | page 切替回数、page 2 の密度（3 件 vs 6 件） |
| S3 | hand 外の topping を pantry で search → pin → tray で使う | 手数（M-1）、pin 後に page 0 へ戻ること（HV-6） |
| S4 | 手元が満杯になるまで pin → もう 1 つ tap（rejection） | 9 では早く満杯になる体感、文言（数字なし）の理解（HV-10） |
| S5 | 在庫 0 を含む意図（×0 が tray から消える） | HV-13 |
| S6 | 4 種以上の自由 pizza | 所要時間（M-9）、pantry 往復（M-6） |
| S7 | keyboard-open pantry で tile tap（OD-R5c-5） | keyboard 維持 vs blur の判定 |
| S8 | HOME → FREE → 次 round で pins 維持 | 期待とのずれ |
| 計測 | M-1〜M-9（tap 数 / page 切替 / pin 回数 / 意図しない reset / selection loss / pantry 往復 / geometry / keyboard 行数 / 所要時間）と HV-1〜HV-13（5 段階 + 自由記述）を variant ごとに記入 | **数値は差の有無のみ報告、推奨しない** |

---

## 7. Inventory Edge Cases（既存 authority と期待挙動）

| ケース | current 挙動 | authority / test |
|---|---|---|
| stock = 0 | 新規 pin 不可（「ざいこなし」、`aria-disabled`）。unpinned ×0 は tray から除外、pantry は ×0 | OD-R5-6 / OD-R5e-2 |
| starter / infinite | `"UNLIMITED"` → 常に stock あり | `remainingStock` |
| 新規購入 ingredient | `ownedIngredientIds` 末尾追記 → `new` tier（starter 除外、直近 20）で fill より優先。pin は自動追加されない | OD-R2-2 |
| bake 後に枯渇 | 消費は `CONFIRM_BAKE` のみ。**hand の stock 入力は round 開始値**（round 内 hand 不変）。次 round で ×0 になり、unpinned は tray から消える | R5-e §7、H-6（App-level 固定） |
| pin 後に 0 になる | pin は残る（明示選択は 0 stock でも保持）。tray に ×0 disabled で残り、slot を消費。unpin 可 | OD-R5e-2 |
| HOME → FREE / FREE → HOME → FREE | pins 維持、selection は null、tray page 0 | `App.handPins.test` |
| reload / new session | pins 空（useState、save 外） | OD-R5-9、M97 |
| category 変更（step 変更） | pins は category 別に保持。step 変更自体は hand transition を評価しない（key 変化は reset 側の担当、H-3 E2） | R5-d |
| search 中 | 検索は pantry 内の表示絞り込みのみ。**hand 導出に影響しない**。IME 中は list 不変 | R5-b contract |
| pagination 中 | tray の page は hand が実変化したら page 0。priority のみの変化は page 維持 | OD-R5d-1 |
| pin capacity full | `rejected-capacity`、session 不変。**UI feedback は未実装（AB-1）** | OD-R5e-3 → R6-c |
| unpin 後 | hand 再計算（placed 保護）。実変化なら page 0 + #197。配置済みは hand に残る（placed protection）| OD-R5d-2 |
| recipe discovery 後 | 変化なし（hand は Dex を読まない）。購入は別 flow | §8 |
| #197 の pin → undo | 一度 clear された selection は戻らない（H-7 で固定した現仕様） | 違和感は HV-11 で観察 |

---

## 8. Discovery Integration（privacy）

| 確認 | 結果 |
|---|---|
| 入力 | hand / pin core（`workingSet` / `handSession` / `handTray` / `pinEdit` / `handPolicy` / `freeEligibility` / `usageSignals`）の import を実読: `ingredientShelf`（category 判定）、`ingredients`（palette 定数 / ingredient lookup）、`roundKind`、**type-only** の `state/discoveryHint`（`hintDisclosure` の `HintSheetView` 型のみ）。**recipe / matcher / target / candidate / Dex / near-miss を import していない** |
| hidden recipe を入力にしない | **Yes**。`WorkingSetInput` は recipe / target / reserve 系の field を持たず、宣言 field を名前で読む（余分な property は結果を変えない）。R5-e Privacy audit PASS、`catalogBoundary.test.ts` が import 境界を CI で固定 |
| 禁止項目（candidate recipe / count / hidden target / ingredient の intersection・union / similarity / distance / correct 判定） | いずれも hand / pin の計算に **存在しない** |
| hint tier | `NO_DISCLOSED_HINTS` 固定 → **hint は hand に何も寄与しない**（`handSession.ts:100`）。`disclosedHintsFromSheetView` は存在するが production 未配線（"unwired"）。**将来配線するときは Hint 5.0 ladder との整合 audit が必須**（hintDisclosure の header に明記）。本 audit の範囲では **配線しない前提** |
| player 自身の選択だけで成立 | **Yes**: owned ids + stock + player の pins + placed。fill は catalog 順（recipe 非依存） |
| 注意（Discovery 3.0 の "pin"） | Discovery 側の「pin」（`selectHintTarget` の recipe pin、PR-4b-A OD-4b-A-2）は **Hint 対象 recipe の pin** で、Large Catalog の ingredient pin とは **別概念・別 state**。UI 文言上の語彙衝突（📌 / 「ピン」）が Hint sheet / Notebook に出る場合は R6-c で語彙確認を推奨（Owner Decision OD-C） |

---

## 9. Save / Persistence

| 確認 | 結果 |
|---|---|
| save schema v2 を変えずに production ON 可能か | **可能**。`persistence.ts`（schemaVersion 2）/ `GameState` に hand / pin の field なし（grep 0 件）。pins は App-level `useState` のみ。flag 反転は save の読み書きに触れない |
| reload で pin/hand が消えるのは intentional か | **Yes**（OD-R2-3 / OD-R5-9 / LC-OD-5: session-only）。hand 自体は毎回導出なので「消える」のは pins のみ |
| persistence を追加しない場合の UX | reload / app 再起動後は pins が空 → 「catalog 先頭 N 件（+ new tier）」の auto hand に戻る。一度 pantry で pin した topping は pin し直し。**HV で観察のみ**（R5-e Risks）。追加の save 設計は **提案しない**（指示どおり） |
| 既存 save への影響 | **なし**。新 field なし、既存 save はそのまま。owned / inventory は読み取りのみ |
| Preview save | Preview は別 save key（`teto-pizza-preview-save-v1`）。HV で production save を汚さない |

---

## 10. Session / reset behavior

- pins: App-level `useState`。**reset されない**: round 変更 / step 変更 / HOME / FREE restart / Dinner 往復。**reset される**: reload / app 再起動（Full Game Reset は reload を伴うので空）。
- `selectedIngredientId`: round key / step 変更で null（hand とは独立）、hand 実変化時に #197 で再評価。
- 「新 session」= reload。pins 空、`new` tier は `ownedIngredientIds` の acquisition order から再導出（**save の既存 field のみ**）。

---

## 11. Mobile / Layout（production ON で確認が必要な画面）

| 画面 / 要素 | viewport | 既存根拠 | R6 での確認 |
|---|---|---|---|
| FREE tray（TOPPING、2 page、pager「1 / 2」） | 390×844 / 360×800（必須）、390×664 / 360×640（参考） | stage / dock は 9 / 12 とも同一（R5-e §8.1） | ON build で `hand-capacity.measure.spec.ts` 再測（差 0 の回帰確認） |
| pantry sheet（pin UI normal） | 同上 | normal list 7 / 7 / 5 / 5 行（strip 無）、strip 44px で 7 / 6 / 4 / 4 | strip あり時の行数、scroll |
| selected strip（pin ≥ 1） | 360×800 で list 6 行、390×664 / 360×640 で 4 行 | R5-c geometry | 実機 screenshot |
| search + keyboard（Mode C fit） | 360×640 相当 K≈338: list 1 行（strip hide）。**K≈380 で 390×664 / 360×640 は strip 無しでも 0 行（F-5、R5-b 由来の既存事項）** | R5-b real-iPhone HV PASS（範囲限定） | 実機 HV-8。問題なら別 slice |
| category chips（ShelfChips） | 同上 | R4 / R5-b | pin UI と chips の縦並び |
| 9 / 12 選択 | — | geometry 同一 | video で目視 |
| 長い ingredient 名 | tile / strip の折返し・chip 幅 | R5-b / R5-c で一部、strip の「〇〇を外す」長名は **未計測** | 長名 fixture で strip / tile / rejection 文言の折返し確認（R6-c） |
| bottom CTA / sheet scroll | pantry は overlay、tray utility row 28px 予約 | R3 / R5-a | sheet 内 scroll と rejection toast（overlay、list を押さない設計）が重ならないこと |
| rejection feedback（未実装） | 全 viewport | — | R6-c で実装後、keyboard 中に見えるか（R6-a §15 の案: overlay toast + `role="status"`、**これは R6-a の設計案であり Owner 決定済みなのは「数字を出さない文言」まで**） |

---

## 12. Regression Surface

| 面 | 影響 | 固定先 |
|---|---|---|
| FREE（TOPPING tray / pantry） | **直接変化** | unit（既存 hand-on-9/12）+ **E2E（WebKit 390×844 / 360×800）** + HV |
| FREE（SAUCE / CHEESE） | tray 不変、pin UI は OD-R5e-1 で非表示になるはず | unit（U1: inactive に pin UI なし）+ DOM golden |
| Guided | 変化なし | App test（H-6）+ production DOM golden（ON build でも同一） |
| Lunch Rush | 変化なし（pantry 非表示） | App test（H-6）+ golden。**Lunch Rush App-level の pins 保持中テストが薄い（G-3）→ R6-c で追加** |
| Dinner | 変化なし（`dinner === null` gate） | App test（既存、`handTray.test:350`）+ golden |
| Inventory | 消費（`CONFIRM_BAKE`）は不変。hand は stock を読むだけ | unit + App test（次 round で ×0 が消える） |
| Discovery / Hint / Notebook | 構造的に独立（§8）。ただし **FREE の pantry は IP-1 の OPEN_POOL → Pantry 導線の着地点**（§15）。Hint sheet / Notebook に 📌 語彙が出ない確認 | catalogBoundary（既存）+ 語彙 grep gate（任意） |
| onboarding | FTU / Dex-0 の導線は FREE tray 前提。topping が 22 owned になる前（starter のみ）は hand inactive → 変化なし | E2E（既存 FTU spec が ON build で同一） |
| save / load | 変化なし | persistence test + 「flag 反転で save が byte 同一」確認 |
| existing 25 / No.26 | 変化なし。No.26 は non-credit recipe で FREE tray の ingredient 構成（catalog）は未確認変更なし（`ingredients.ts` の topping は 22 のまま） | 既存 golden / scoreParity。R6-e の ON golden は No.26 込みで再採取 |

固定レイヤの方針: **unit** = 既に厚い（hand-on 9/12、M1〜M114）。**E2E** = production build の DOM golden（13 snapshot 相当、rebase 後再採取）+ Preview ON smoke。**HV** = rejection feedback / keyboard / 9 vs 12 / ×0 の見え方 / #197 の違和感。

---

## 13. 残作業まとめ（production ON に必要なもの）

| # | 必要事項 | 種別 |
|---|---|---|
| 1 | OD-R5e-1: pin UI を active category のみ（F-1 / AB-2） | production src（dormant 内） |
| 2 | OD-R5e-3: capacity-full rejection feedback（数字なし文言 + `role="status"`）（AB-1） | production src（dormant 内）+ a11y |
| 3 | a11y: pin / unpin の polite announce、tile accessible name（polish は HV 判定） | src |
| 4 | OD-R5c-5: keyboard 中の tile tap（R6-a 案は keyboard 維持）→ real-device HV で判定 | HV |
| 5 | #319 の rebase/merge（Preview 切替機構、OFF DOM golden の再採取） | infra |
| 6 | real-device HV（ON 状態の 390×844 video + screenshot、9 vs 12） | HV |
| 7 | **Owner の capacity 決定** | Owner |
| 8 | 最終 flag 反転（`HAND_ENFORCEMENT_PRODUCTION = true` + `DEFAULT_HAND_CAPACITY_PRODUCTION = <確定値>`）、OFF test を「inactive / non-eligible は flag に依らず null」へ置換、ON golden 新 baseline | src 数行 + test |
| 9 | doc 更新: `IngredientTray.tsx` の「never hidden」コメント（P-4）、handoff / SSOT の R6 記録 | docs |

---

## 14. Mobile / HV 必須項目（Policy）

UI/UX 変更なので `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` に従い、**390×844 video（ユーザーへ直接送付、repo 非 commit）+ before/after screenshot（`docs/reports/screenshots/<task>/`）**が各 ON 化 slice の DoD。本 audit は docs-only のため video / screenshot は対象外。

---

## 15. Discovery 3.0 IP-1 との接続

- IP-1（OPEN_POOL → Notebook / Pantry navigation）は **「食材庫へ誘導する」だけ**で、hand / pin を読み書きしない前提。Pin/Hand 側は **pin → FREE hand → 試作**を担当。
- 接続点: ① pantry sheet の **入口 / 起動 API**（IP-1 が pantry を開く導線を足す場合、`GameScreen.tsx` の `pantryOpen` / `pantryVisible` 周辺）② Hint sheet / Notebook に pantry への動線が出る場合の **📌 語彙衝突**（§8 注意）③ OPEN_POOL 中も `selectedIngredientId` / pins が recipe を知らないこと。
- **IP-1 → R6 の順序依存はない**。IP-1 は flag に依存せず（pantry は production で既に使える）、R6 は pin UI を足すだけ。ただし **同じファイル（`GameScreen.tsx`、`IngredientPantry.tsx`、`App.css`）を触る可能性** があるため、R6-c の実装は IP-1 の merge 後に main から切る（§19 競合）。

---

## 16. Minimum Completion Plan（R6-b → R6-c → capacity decision → R6-d → R6-e は妥当か）

**評価: 概ね妥当。ただし R6-c と R6-d を 1 回の HV にまとめられる余地、R6-e の小ささから、以下の統合案を推奨。**

### 16.1 現行案（R6-a §23）

R6-b（#319 infra）→ R6-c（Preview UI 完成 + HV）→ R6-d（9/12 実機比較）→ Owner capacity 決定 → R6-e（production flag）。

- 妥当な点: 「UI 修正が出たら 9/12 比較をやり直さない」ために R6-c（UI 確定）→ R6-d（比較）の順。fail-closed を R6-b で先に証明。
- 過剰な点: **R6-d は「実装なし・計測のみ」**で独立 PR を要しない（variant commit は PR / merge しない）。**R6-e は実質 3 行 + golden** で、HV が production-equivalent の最終確認を兼ねる。

### 16.2 推奨（統合案）

| slice | purpose | changed area | dependencies | verification | Owner Decision | merge order |
|---|---|---|---|---|---|---|
| **R6-b #319（既存）** | Preview-only 切替（A2）+ OFF DOM golden | `handPolicy` / `lcHandPreview` / badge / e2e / tools | main へ rebase（conflict 0）、golden 再採取 | P-1〜P-5、mutation 14/14、WebKit（既に全 green、rebase 後に再走） | OD-A-1（R6-a audit を main に残すか。§18） | **1** |
| **R6-c（UI 完成・dormant）** | OD-R5e-1（active のみ pin UI）、OD-R5e-3（rejection feedback + SR）、a11y announce、OD-R5c-5 既定、inactive ≡ OFF、E11 反転 | `GameScreen.tsx:895` 周辺、`IngredientPantry.tsx`、`App.css`、test、mutation U1〜U5 | R6-b merge、**IP-1 merge 後に main から切る** | unit（9/12）、golden 同一（production は不変）、Preview variant で **HV 1 回目（capacity 12 variant、§6.3 S1〜S8 の一部 + rejection / keyboard / ×0）** | OD-C（pin 文言 / 語彙）、OD-R5c-5 判定 | **2** |
| **R6-d（比較、PR 不要）** | 9 vs 12 実機比較 | なし（variant 使い捨て commit のみ）、計測 tooling の再実行 | R6-c merge | §6.3 ABBA、M-1〜M-9 / HV-1〜HV-13、video 2 本 | **OD-1: capacity 9 / 12** | **3（docs report のみ）** |
| **R6-e（production ON）** | flag + 確定 capacity、OFF test 置換、ON golden | `handPolicy.ts` literal 2 行、test、golden、docs | R6-d + OD-1 | production-equivalent build の最終 HV（video + screenshot）、post-merge Deploy / WebKit、**ロールバック手順（flag 1 行 revert）の確認** | OD-2: 公開タイミング | **4** |

- **R6-c と R6-d を統合しない理由**: R6-c の HV で UI 修正が出るのは確実なため、9 / 12 比較は確定 UI で 1 回。**ただし R6-d 用 variant（9 と 12）は R6-c の HV と同じ build 基盤を再利用**でき、追加実装ゼロ。
- **R6-b を R6-c に吸収する案は非推奨**: #319 は既に green・conflict 無しで、infra と UI を分けるほうが fail-closed の証明が独立する。
- 統合しても良い唯一の点: **R6-e の ON golden / OFF test 置換は R6-c の中で「ON 時の期待 golden」を先に作っておき**、R6-e は flag 反転 + 差分確認だけにする。

---

## 17. Owner Decisions（本 audit で新たに要るもの、**Owner 未決定**）

| id | 決定 | 影響 | 推奨（決定ではない） |
|---|---|---|---|
| **OD-1** | capacity 9 / 12 | R6-e の定数 | R6-d の実機比較後に決定（本 audit は決めない） |
| **OD-A-1** | R6-a audit（`4d2d6ae` / `7727cdc`、revert 済み）を main に残すか | R6-b〜e の slice 定義の authority の置き場 | **本 report を main に入れる（または #319 に R6-a を re-land）**。そうしないと R6 slice 定義が main に存在しない（C-2） |
| OD-B | IP-1 と R6-c の merge 順 | `GameScreen` / pantry の touch 競合 | IP-1 merge 後に R6-c を main から切る |
| OD-C | pin の語彙（📌 / 「ピン」/ 「手元」）が Hint sheet / Notebook / Discovery の「pin」と衝突しないか | R6-c の文言 | R6-c の HV で確認 |
| OD-D | #319 の扱い（main merge で進めるか、audit の結論を待つか） | R6-b の時期 | 本 audit は #319 を変更しない |
| OD-2 | production 公開タイミング（Discovery 3.0 の他 slice との兼ね合い） | R6-e の時期 | HV 後に Owner 判断 |
| （確定済み、再議しない）OD-R5c-1〜5、OD-R5d-1〜3、OD-R5e-1〜5、OD-R2-1/2/3 | — | — | — |

---

## 18. Blockers

| # | blocker | 解消 |
|---|---|---|
| B-1 | #319（R6-b）未 merge | Owner review / merge。conflict 無し |
| B-2 | AB-1（rejection 無反応）/ AB-2（no-op pin UI）が production 用に未実装 | R6-c |
| B-3 | real-device HV 未実施（9/12、keyboard、OD-R5c-5） | R6-c / R6-d |
| B-4 | capacity 未決定 | Owner（OD-1） |
| B-5 | R6 slice 定義が main に無い（C-2 / OD-A-1） | 本 report の merge |
| B-6 | #319 の production DOM golden が古い base（main `6abddc7`）基準 | rebase 後に再採取 |

**IP-1 に対する blocker は無い**（IP-1 は Pin/Hand に依存しない）。

---

## 19. IP-1 との競合有無

| 項目 | 結果 |
|---|---|
| 本 audit の変更 | docs-only 1 file（`docs/reports/TETO_LARGE-CATALOG_R6_PIN-HAND_PRODUCTION-READINESS_AUDIT.md`）。src / e2e / CSS / flag / #319 / IP-1 branch 無接触 |
| ファイル競合（現時点） | **なし**（IP-1 branch は origin に存在しない。docs 新規 file は他と衝突しない。`docs/PROJECT_HANDOFF.md` は **触っていない**） |
| 将来の競合候補 | `GameScreen.tsx`（pantry 周辺）、`IngredientPantry.tsx`、`App.css`、`docs/PROJECT_HANDOFF.md`。R6-c は IP-1 の merge 後に切ることで回避（OD-B） |
| 論理競合 | なし（IP-1 は pantry を開く導線のみ、R6 は pantry 内の pin。Hint の recipe 情報は hand に入らない） |

---

## 20. 最終判定

**R6 は「ロジック完成・UX 未完成・実機未検証・capacity 未決定」。** production ON には ① R6-c の dormant UI 完成（AB-1 / AB-2）、② #319 merge（Preview 手段 + OFF golden）、③ real-device HV、④ Owner の capacity 決定、⑤ flag 反転の 5 点が残り、**新しいロジック設計・save 変更・Discovery 側の変更は不要**。#319 は rebase せずとも merge 可能な状態（conflict 無し、CI 全 green、approval 無し）。次アクション候補（実装せず提案のみ）: (1) OD-A-1 / OD-D の判断、(2) #319 を main に追従させて golden 再採取、(3) IP-1 merge 後に R6-c 開始。
