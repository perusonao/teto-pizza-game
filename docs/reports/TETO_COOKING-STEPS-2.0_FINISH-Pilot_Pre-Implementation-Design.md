# TETO Cooking Steps 2.0 — FINISH Pilot 実装前設計（docs-only）

**Status:** 実装前設計のみ。実装・PR作成・merge は行っていない。`src/**` / `e2e/**` / save / Issue / 他branchは無変更。
**Audited main SHA:** `44879be0c0cd038a50fc224c7b2ca1442285510f`（`git fetch origin main` で再確認。前回監査から進んでいない）
**Branch:** `claude/cooking-steps-2-audit-design-gzc9rp`（docs-only）
**前提レポート:** `docs/reports/TETO_COOKING-STEPS-2.0_Fresh-Audit-Design.md`（以下「前回監査」）
**HV:** docs-only のため対象外（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` §2）。§8 の HV 条件は *実装時* のもの。

> **更新 (2026-10-10, `main` `e0397ae`):** P1 Undo は #451 で merge 済み（UD-A 実装済み）。#275 は merge 済み。UD-C = C1 を Owner が採用（P2a / P2b は別PR、本ファイルは PR-A で main に取り込み）。UD-B / D / E / F / G / H / I は **未決定のまま**（§9）。`44879be` 基準の記述は履歴。

> 証拠の区別: 【main】= `44879be` のコードを読んだ/実行した事実。【#295】= PR #295 branch（未main）の内容。【実測】= 隔離worktreeで実際に適用・実行した結果（worktreeは削除済み、リポジトリには何も残していない）。

---

## 0. 結論

1. **Owner方針（FINISH先行・Undo先行・#294分担維持・6タブ・推理保護）はすべて両立できる。** 構成は 5 PR（Phase 1 Undo → Phase 2 土台 → Phase 3 FINISH engine（inert）→ Phase 4a 技法TQ-2基盤（inert）→ Phase 4b 有効化）。本番で見えるのは Phase 1 と Phase 4b だけ。
2. **PR #295 の CS-1a は 55 レシピ環境へ再基準化できる。** 実測: コード差分 5 ファイル（+163/−10）が main へほぼそのまま当たる。競合は `GameScreen.tsx` の import 1 行のみ。`tsc -b` / oxlint clean、関連 19 ファイル 342 テスト通過。**失敗するのは tab-gate テストのハードコード（25 レシピ・18/7 件）だけ**で、main が「カタログ件数を固定しない」方針のため、導出式へ直す修正が要る。PR #295 自体は触らず、**CS-1a のコードを新PRへ移植する**ことを推奨（§2）。
3. **前回監査の訂正:** 前回「FREE に仕上げタブを常設すると全 FREE が 7 タブ」と書いたのは**誤り**。実測で **Free Cooking は 5 タブ**（DOUGH/SAUCE/CHEESE/TOPPING/焼く、CUT なし）。常設の仕上げタブを足しても **6 タブで上限内**（§4）。前回レポートの該当箇所は本コミットで訂正済み。
4. **Undo は履歴スタックを持たない設計が成立する。** `pizza.toppings` は追記専用・カテゴリでゲート済みなので、「現ステップのカテゴリの最後の1個」を配列から導出できる。新しい保存状態・schema 変更はなし。`44879be` 時点の main には Undo が存在せず、この設計が最初の Undo になった。**Undo（P1）は #451 で実装・merge 済み**（§3 は設計の根拠）。
5. **FINISH の最大の設計難所は「確定のタイミング」**。main の `CONFIRM_BAKE` はスコア・完成判定・在庫消費・FREE の識別を一括で確定する。後乗せレシピは焼成後の素材が無い状態では判定できない。OD-CS-2=B（通常レシピは現状どおり、後乗せだけ暫定→FINISH後に再確定）を、**「FINISH を含むプロファイルでは、0 個のスキップを含め FINISH の確認のたびに、後乗せ要件を含む完全な最終評価を必ず再実行する」**という形で具体化した（§5.3）。暫定評価は後乗せ要件を除いているため、0 個を「暫定＝最終」とみなすと必須の後乗せ素材が未配置のまま完成扱いになる。在庫消費は未消費の後乗せ piece の差分だけで、再確認しても冪等。FINISH を含まない既存の全レシピは再評価の対象外で、現行とバイト同一のまま。
6. **焼成失敗時の FINISH スキップは、#256 の `bakeCompletionFailure()` をそのまま再利用すれば新しい閾値なしで実現できる**（§5）。
7. **Owner 未決定事項は 7 件**（UD-B / D / E / F / G / H / I、§9）。UD-A（Undo の対象モード）は #451 で実装済み、UD-C（#295 の扱い）は Owner が C1 で決定済み。着手前（P2 まで）に Owner 回答が必須の未決定事項は残っていない。FINISH engine（P3）の前には UD-H、有効化（P4b）の前には UD-B / D / E / F / G / I が必要（§9）。

---

## 1. 最新状態の確認（STEP 1）

### 1.1 GitHub / main

| 対象 | 状態 | 本設計への影響 |
|---|---|---|
| main | `44879be`（前回監査と同一） | 前回の事実はそのまま有効 |
| **Issue #294** Post-W1 Cooking Steps | open。OD-CS-1/2/9(a)/20 記録済み（コメント 2026-09-28）。CS-1b は「#275 待ち」で WAIT | **ブロッカーは解消**: 【実測】PR #275 は **MERGED（2026-09-30）**、main に `bakeCompletionFailure` が反映済み（`gameReducer.ts:1327`） |
| **Issue #270** Undo last placement | open、2026-09-27 から更新なし。Owner判断待ち3点（Lunch Rush、UI位置、HV範囲） | Phase 1 の親Issue。§3 で3点に回答案 |
| **PR #295** | open、head `13d6836`、base `86b48fd`（main の約1,880ファイル前）、CS-1a のみ、**未merge・Owner review待ち** | §2 で再基準化を監査 |
| `claude/cooking-interaction-fresh-audit-18pfmn`（Cooking Interaction 2.0 Fresh Audit + Owner Decisions OD-CI-1..9） | 未main。**こねる/ちぎる/チーズ/Undo方針の関連資料** | 重複回避のため参照のみ（§1.2）。触れていない |
| Issue #447（Cooking Tray の family タブ 70px 移動） | open（Owner Decision 済み） | トレイ高さを2行固定する変更。**Undo ボタンをトレイ行に置かない**理由の一つ（§3.6） |
| PR #445 / Issue #442 #443 #446 / Batch 7 branch | **触れていない** | — |

### 1.2 関連する既存の方針（重複・矛盾の確認）

- **Cooking Interaction 2.0（未main）** の OD-CI-4 は「*CUT 確定後の Undo は廃止方向*」、OD-CI-10 は「*操作は原則不可逆＋救済は別レイヤー（assist）*」を候補原則とする。
  - 【main】には CUT の Undo も含め **Undo は一切ない**（`UNDO_*` / `undo*` / 「1本戻す」を grep して 0 件）。つまり OD-CI-4 は main では実質実現済み。（`44879be` 時点。#451 で配置に限った Undo が追加された）
  - 本設計の Undo は「**配置（位置の決定）に限った assist**」と位置づければ、OD-CI-4/10 と矛盾しない。ただし**原則の例外を明記**する必要がある（UD-A に含める）。
  - 同 audit の OD-CI-8（CHEESE 工程の統合）は保留。本設計は CHEESE 工程を変更しない。
- **こねる / ちぎる** は Owner 方針どおり**本パイロットに含めない**（独立した操作体験改善として別トラック）。前回監査 §3.2 の評価（こねる=作らない、ちぎる=演出から）を維持。
- **Techniques（main）**: `techniques.ts` は `no-sauce` のみ。TQ-1D（Aussie）は本番稼働済み。TQ-2（後乗せ）の Issue は存在しない（検索で未検出）。

### 1.3 前回監査との差分（訂正）

| 項目 | 前回 | 実測（main `44879be`） |
|---|---|---|
| FREE のタブ数 | 「7タブ化する恐れ」 | **5**（steps = DOUGH/SAUCE/CHEESE/TOPPING + 焼く）。仕上げ常設で **6** |
| 55 レシピのタブ分布 | 未集計（#294 は 25 レシピ時点で 6タブ18 / 5タブ7） | **4タブ 18 / 5タブ 19 / 6タブ 18**、最大 6 |
| 172 行の分類（#295 の classifier を main に再実行） | CURRENT 15 / DATA 59 / SMALL 19 / MAJOR 30 / GAP 49 | **CURRENT 32 / DATA 42 / SMALL 19 / MAJOR 30 / GAP 49**。**mechanic が要る行（SMALL/MAJOR/GAP）の数は不変**で、DATA→CURRENT の 17 行が出荷済み化しただけ |
| BBQチキンの新素材 | 「2素材（chicken は既存）」 | 同じ。実測 classifier も `newIngredientCount: 2`（`bbq-sauce`、`cilantro`）、class SMALL_ENGINE |

---

## 2. PR #295（CS-1a）の再基準化監査（STEP 2）

### 2.1 方法

PR #295 のコード差分（`86b48fd..13d6836` の `src/` のみ、5 ファイル）を、**隔離 worktree に取った main `44879be`** へ `git apply --3way` で適用。PR branch・main・他 branch には何も書いていない。

### 2.2 結果【実測】

| 項目 | 結果 |
|---|---|
| 適用 | `cookingProfiles.ts` は clean。**`GameScreen.tsx` は import 1 行のみ競合**（main 側が import を増やしていた）。両方残して解決 |
| `GameScreen` の CUT 判定 6 箇所 | main でも同じ構造で、すべて `renderedPostBakeStep()` 経由に変換済み（直書き `makingStep === "CUT"` は残らない） |
| `tsc -b` | clean |
| oxlint（`src/screens`, `cookingProfiles.ts`） | 指摘なし |
| Vitest（`src/screens`, `MakingStepTabs`, `cookingProfiles`, `App.test`） | 19 ファイル / 342 テスト通過 |
| `cookingProfiles.tabGate.test.ts` | **2 件失敗（ハードコードのみ）**: ① `recipeProfiles` の長さ `25`（main は 55）② 「18 レシピが6タブ、7レシピが5タブ」（main は 18 / 19）。**ゲート自体（最大6）は 55 レシピ全部で満たされる** |
| `postBakeView.test.ts` | 通過 |
| Playwright / WebKit | 未実行（本セッションの対象外。移植PRで実行） |

### 2.3 再基準化に必要な修正（移植PRの内容）

1. tab-gate テストの件数固定を撤廃: `toHaveLength(25)` → `RECIPES.length`、18/7 の固定 → 「最大が `MAX_VISIBLE_COOKING_TABS` に**到達している**」+ 「超過ゼロ」のみ。main の方針（`catalogDerived.ts` / `catalogLedger.test.ts` 以外でカタログ件数を固定しない、handoff 2026-10-07 addendum）に合わせる。
2. `GameScreen.tsx` の import 競合解決（機械的）。
3. 7 タブ fixture（`FINISH` + `CUT` を持つ架空プロファイル）が「ゲートが失敗する」ことを示すテストは、そのまま有効（OD-CS-9(a) の担保）。
4. `docs/PROJECT_HANDOFF.md` は #295 も main も更新する**競合の温床**。移植PRでは触らず、handoff 追記は別途最後に1回で行う。

### 2.4 #295 のドキュメント資産の扱い

| 資産 | 再利用可否 | 理由 |
|---|---|---|
| `TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md`（CS-0〜9、OD-CS-1..20、§13 Owner Decisions） | **authority として必要**（未main） | 本設計は OD-CS-1/2/9(a)/20 を前提にする。main に無い authority への dangling reference を避けるため、**docs だけ先に main へ入れる**のが望ましい（TQ-1C-0 の前例） |
| 172 行 classifier / JSON / rows.md | **要再生成** | 25 レシピ時点の `runtimeRecipesMatched`。【実測】classifier は main で問題なく動き、結果は §1.3 のとおり。再生成して置き換える |
| CS-1 Pre-start Gate / PHASE1 Fresh Audit | 参考（履歴） | 「#275 待ち」は解消済みのため、状態表の更新が必要 |
| CS-1a Result とスクリーンショット | 参考 | 移植PRでは再撮影（55レシピ環境の before/after） |

### 2.5 推奨（UD-C）

**案 C1（推奨）:** #295 には触れず、(a) docs だけの小PR（authority 取り込み＋classifier 再生成）、(b) CS-1a の**コード移植PR**（§2.3 の修正込み）の 2 つに分ける。#295 はその時点で Owner が閉じる。
**案 C2:** Owner が #295 を main へ rebase/merge してから進める。PR は 7,000 行超（docs 中心）で、`PROJECT_HANDOFF.md` 競合と stale な 25 レシピ値を含むため、レビュー負荷が大きい。
**案 C3:** CS-1a を飛ばして Phase 3 へ。**非推奨**（FINISH の UI が 6 箇所の CUT 直書きに分岐を足すことになり、まさに CS-1a が防ぐ状況）。

---

## 3. Undo 設計（STEP 3）

### 3.1 位置づけ

- Issue #270 の提案（`UNDO_LAST_PLACEMENT`）と同一課題。**配置（位置の決定）専用の assist**。
- 対象外: ソース（堆積は piece ではない。やり直しは明示 reset＝OD-CI-6 の方向）、生地（D3A で可逆）、CUT（main に Undo なし、OD-CI-4）、BAKE、**確定済みステップへの遡り**（フローは一方向）。

### 3.2 対象操作

| ステップ | Undo される単位 | Phase |
|---|---|---|
| CHEESE | 直近に置いた cheese 1個 | 1 |
| TOPPING | 直近に置いた topping 1個 | 1 |
| FINISH（焼成後） | 直近に置いた *後乗せ* 1個（`stage: "post"`） | 3 |
| DOUGH / SAUCE / BAKE / CUT | なし（ボタンは無効） | — |

### 3.3 履歴管理: スタックを持たない

【main】`PLACE_TOPPING` は `pizza.toppings` に**追記するだけ**で、並べ替え・挿入はない。さらに同アクションはカテゴリをステップで検証する（cheese は CHEESE のみ、topping は TOPPING のみ）。よって：

- 「現ステップのカテゴリに一致する、配列の最後の要素」＝直近の配置。**別の履歴配列は不要**。
- 前ステップの piece は別カテゴリなので、構造上巻き戻せない（一方向フローの担保が型ではなく構造で成立）。
- 連続 Undo はそのまま成立（現ステップの piece が尽きれば対象なし → ボタン無効）。Redo は作らない。
- ID は単調増加（`topping-N`）。Undo は採番を戻さない。再配置は新ID。

> 例外の検討: FREE の TOPPING で cilantro を焼成前に置いた場合も、FINISH で置いた場合も category は `topping`。Phase 3 で `stage` を導入するのはこのため（FINISH の Undo は `stage==="post"` だけを対象にし、焼成前の piece を巻き込まない）。

### 3.4 アクション契約

```
{ type: "UNDO_LAST_PLACEMENT" }          // payload なし
```

- ガード（reducer が最終防壁。UI の disabled に依存しない）: `phase==="PREPARE"`、`makingStep ∈ {CHEESE, TOPPING}`、対象 piece が存在すること。Dinner は `DINNER_COMPOSITION_ACTIONS` に追加（#270 の指示どおり、PREPARE 外では拒否）。
- 効果: 対象 piece を除去、`hint` を `buildHintLine` で再計算（`PLACE_TOPPING` と同じ）、`placement: null`、進行中ジェスチャを無効化するトークンを更新。
- トークン: #270 は「`resetToken` / `makingStepToken` のように」。`makingStepToken` は PizzaStage/IngredientTray のジェスチャ中断に使われるが、PizzaStage には CUT の guide-fade も同トークンに依存する箇所がある（`PizzaStage.tsx:478`）。CHEESE/TOPPING では無害だが、**専用の `undoToken` を新設するか既存を流用するかは Phase 1 着手時の監査項目**にする（どちらでも動く）。

### 3.5 副作用マトリクス

| 系 | 影響 | 根拠 |
|---|---|---|
| 在庫 | **なし**。消費は `CONFIRM_BAKE` の一括のみ | #270 Audit、`gameReducer.ts:1296` 付近 |
| Stock Gate | 自然に枠が戻る | `canPlaceIngredient` は `pizza.toppings` の個数を数える（`inventory.ts:76`） |
| Scoring / Completion Gate / Discovery matcher | 最終ピザだけを見るため影響なし | #270 Audit |
| Cooking Timing / Efficiency | 時計は触らない（`RESET_PIZZA` と同じ）。操作回数は評価に使われない | Cooking Steps 1.0 §22.1 |
| Research / Notebook / Hint 事実 | RESULT 時にのみ記録。PREPARE 中の Undo は残らない | `CONFIRM_BAKE` / `REGISTER_TO_DEX` の記録点 |
| Dex / Pitz / 技法台帳 | なし | — |
| **保存（save）** | **なし。schema 変更なし**。`GameState` は保存されない | `persistence.ts`（`PersistentSaveV2` に GameState なし） |
| 既存レシピ・既存セーブ | 変化なし（新アクション追加のみ） | — |

### 3.6 UI 配置

- **`.prepare-bake-bar`（固定下部バー）内**に ↩ アイコンボタン（44×44、`aria-label="1つ戻す"`）。#270 の「既存 bake bar 内・ステージを失わない」に一致。
- バーは max-width 390、左右 16px パディング → 内幅は 390 で 358px、360 で 328px。現状ボタンは「やり直す」「次へ→/焼く！」「ヒント」の最大 3 個（Dinner は「ヒント」なし）。↩ 追加で 4 個になるため **360 幅での実測が受け入れ条件**（§8 AC-U5）。入らない場合の退避は「ヒント」を文字からアイコンに縮める（挙動不変）。
- **トレイ行には置かない**: Issue #447（family タブ行の 70px 移動）でトレイ高さが変更中で、トレイ周辺のレイアウトは別PRの係争地。バー内ならそれと独立。
- 位置: 「やり直す」の隣（破棄系の操作を左にまとめる）。CTA（次へ/焼く）の x 位置はステップ間で動かさないため、**↩ のスロットは全 PREPARE ステップで常に確保し、対象外ステップでは disabled** にする（非表示にするとバー幅が変わり CTA がずれる）。

### 3.7 モード別の扱い（UD-A）

| モード | 推奨 | 理由 |
|---|---|---|
| Guided / Free Cooking / Research | **含める** | 本パイロットの目的 |
| Dinner | 含める（#270 の記述どおり。reducer で PREPARE 外を拒否） | 構成アクションの一つ。ただし難度が下がるため Owner 確認 |
| **Lunch Rush** | **当面含めない** | 時間競争の公平性。ランキング `lunch-rush-v1` の分布が変わる可能性（#224 と同じ論点）。サーバーは serve 記録から再計算するため機能的には影響しないが、競技性の判断は Owner |

### 3.8 FINISH への拡張（Phase 3）

- `PlacedTopping` に `stage?: "pre" | "post"`（absent = pre）。既存レシピ・既存の描画・スコア入力は不変。
- ガードを `phase==="POST_BAKE" && makingStep==="FINISH"` にも許可し、対象を `stage==="post"` の最後の1個に限定。
- **Stock Gate の修正が必要**: 焼成前 piece の在庫は `CONFIRM_BAKE` で消費済み。FINISH の `canPlaceIngredient` が `pizza.toppings` 全体を数えると、同じ素材を焼成前にも使うレシピで二重計上になる。**FINISH では `stage==="post"` の個数だけを残在庫と比較**する。
- 見た目: 後乗せ piece は焼き色を受けない（`bakeRoastResistant` は素材単位のため、`stage` による描画分岐が必要）。
- 焼成前の piece は FINISH から**除去できない**（誤って焼成前の素材を消さない）。

### 3.9 Undo のテスト

reducer（ガード・対象選択・カテゴリ境界・連続Undo・空のとき no-op・Dinner/PREPARE外拒否）、`canPlaceIngredient` 回帰、在庫不変（`CONFIRM_BAKE` 前後）、cookingTiming 不変、コンポーネント（disabled 状態・44px）、E2E（配置→Undo→再配置、ドラッグ中の Undo でセッション中断）、既存回帰（全 PREPARE E2E）。

---

## 4. FREE の仕上げ UI（STEP 4）

### 4.1 制約

- 最大 6 タブ（OD-CS-9(a)、テスト不変条件）。**FREE は現在 5 タブ**。
- FREE/Research は「どのピザが後乗せを要するか」を事前に示してはならない（OD-TQ-5/6/16、推理情報保護）。
- 後乗せレシピは**ラウンド開始時点で正体が不明**（FREE にレシピはない）。したがって「仕上げ」を出す条件に *所持素材・レシピ・ヒント* を使うと漏洩する。
- 技法 Discovery は Free Cooking のみ（OD-TQ-10改）。FREE で仕上げ不能＝後乗せレシピは発見不能。

### 4.2 比較

| 案 | 内容 | タブ数 | 漏洩 | 発見可能性 | 追加操作（FREE毎回） | 実装差分 | 評価 |
|---|---|---:|---|---|---|---|---|
| **A. 常設・スキップ可のタブ** | FREE の steps に常に `FINISH` を付ける。何も置かず「次へ」で完了できる（SAUCE の「なしでもOK」＝OD-TQ-16 と同じ型） | **6** | **なし**（全 FREE が同一） | ◎ | +1 タップ（確認）、約1秒 | 小〜中。`MakingStepTabs`/CS-1a の post-bake view を流用 | **推奨** |
| B. タブなしの二択パネル | 焼成直後に「仕上げる / このまま完成」の 2 ボタンを常に表示。「仕上げる」でトレイが開く | 5 | なし | ◎ | +1 タップ | 中。新コンポーネント、a11y・レイアウト新規 | フォールバック |
| C. 所持素材連動 | 後乗せ可能な素材を所持しているときだけ仕上げを出す | 5↔6 | **あり**（所持＝後乗せ素材の存在を示す。Shop 購入が識別手がかりに） | ○ | 条件付き | 小 | **却下**（OD-CS-3 の「素材側に後乗せフラグを持たせない」とも衝突） |
| D. ガイド専用（FREE なし） | レシピ指定ラウンドでのみ仕上げ | 5 | 低 | **✕**（FREE で後乗せ不能＝発見不能） | 0 | 小 | **却下**（OD-CS-4 b、技法は「やって発見する」原則に反する） |
| E. 焼きタブに吸収 | 「焼く」ステップ内で仕上げ窓を開く | 5 | なし | ○ | 0〜+1 | 大（BAKE 画面の再設計、needle 操作と競合） | 却下（#294 が mid-bake を別トラックにしている理由と同じ） |

### 4.3 推奨: 案 A（常設・スキップ可の「仕上げ」タブ）

- **漏洩なし・6タブ上限内・実装が最小**。CS-1a の post-bake view を `FINISH` に拡張するだけ。
- 仕上げ素材のトレイは FREE では **所持する全具材**（OD-CS-4 a。「どれが後乗せか」を絞らない）。
- ガイド（レシピ指定）ラウンドは**レシピ固有プロファイル**: 後乗せ要件を持つレシピだけ `FINISH` を持つ（BBQ型＝D·S·C·T·焼く·仕上げ＝6）。持たないレシピ（現行55）は**現状のまま**で、仕上げタブは付かない。
- Dinner は仕上げを持たない（OD-CS-5 a。Stage A が START_BAKE で識別するため、後乗せ素材が焼成後にしか来ない設計と相容れない）。Lunch Rush も除外（`lunchRush:false`）。
- **将来のトリップワイヤ:** FREE に CUT が入った場合は 5+CUT+仕上げ＝7 となりゲートで落ちる。その時点で案 B（または CS-4 のタブ UI）へ切り替える。この前提を AC に固定する（§8 AC-F4）。
- 要確認（UD-B に含める）: ガイドの Pizza Select で、未発見レシピが**名前つきで選べるのか**。選べない（`？？？` ロック）なら、ガイドの仕上げタブ表示は識別に影響しない。

---

## 5. 焼成失敗時の FINISH スキップ（STEP 5）

### 5.1 既存の仕組み【main】

`CONFIRM_BAKE` は `postBake = bakeCompletionFailure(completion) ? [] : postBakeSteps(profile)`（`gameReducer.ts:1327`）。`bakeCompletionFailure` は Completion Gate の `failures` に `UNDERBAKED`/`OVERBAKED` があるときだけ値を返す（`completionGate.ts:254`）。構成不足のみの失敗は CUT を残す。Dinner は同じ判定を Stage B へ `cutWaivedFor` として渡す（fail-closed）。FREE の失敗（`resolveFreeCookPizza` が `FAILED`）は現状 CUT がないため、そのまま RESULT へ行く。

### 5.2 設計

**FINISH は CUT と同じ単一判定を共有し、新しい閾値・帯域計算を持たない。**

| 状況 | 結果 |
|---|---|
| ガイド/レシピ: 焼成失敗（生焼け/焦げ） | FINISH スキップ → RESULT（FAILED）。`bakeCompletionFailure()` が非 null |
| ガイド: 構成のみ失敗（暫定判定で後乗せ素材が未配置は**失敗にしない**、§5.3） | FINISH へ進む |
| FREE: `freeCook.kind==="FAILED"`（焼成帯域外 or 空ピザ） | FINISH スキップ → RESULT（FAILED） |
| FREE: 焼成成功 | FINISH へ（案 A の常設タブ） |
| FINISH 中に放棄（ホーム） | CUT と同じ。在庫は `CONFIRM_BAKE` で消費済み、Dex は RESULT まで登録されない |

- 結果として**焼成に失敗したピザでは後乗せレシピは完成しない**（技法も発見されない）。これは「失敗ピザに素材を足して救済できる」という不整合を避ける（OD-CS-7 の推奨と同じ）。
- 順序は **FINISH → CUT**（Cooking Steps 1.0 §1.1）。FINISH をスキップしたら CUT も #256 の判定どおり。

### 5.3 暫定判定（OD-CS-2=B の具体化）

現状の `CONFIRM_BAKE` は ① FREE の識別（`resolveFreeCookPizza`）② Scoring 2.0 ③ Completion Gate ④ 在庫消費 を一度に行う。後乗せ素材が未配置の時点でこれらをそのまま走らせると、BBQ型は構成不足で FAILED/ORIGINAL になってしまう。

| 項目 | 設計 |
|---|---|
| 暫定判定 | `CONFIRM_BAKE` では `applicationPhase==="POST_BAKE"` の要件を**除いて**評価する（通常レシピは該当要件なし＝現行どおり）。FREE は暫定識別を行い、結果は FINISH 確定までは**表示しない**（RESULT は FINISH 後） |
| 再確定 | **FINISH を含むプロファイルでは、FINISH の確認（置いた piece が 0 個のスキップも含む）のたびに、後乗せ要件を含む完全な最終評価（`finalizeRound`）を必ず再実行する。** 暫定判定は後乗せ要件を除いて評価しているため、0 個を「暫定＝最終」とみなすと必須の後乗せ素材が未配置のまま完成扱いになる（Codex P1, PR #452）。0 個なら必須後乗せ要件が未充足として評価され、`MISSING` 相当の失敗になる（新しい閾値は作らない）。FINISH を含まないプロファイル（現行の全レシピ）は再評価の対象外で、現行とバイト同一 |
| 在庫 | `CONFIRM_BAKE` が焼成前 piece を消費 → FINISH 確認が `stage==="post"` の差分だけを消費（純関数を2回に分割。**各 piece は1回しか数えない**） 。再確定は評価の再計算であり消費ではない: 消費は `stage==="post"` の未消費差分だけで、FINISH 確認を重ねても冪等（0 個なら消費 0） |
| スコア | 既存の Pieces/Recipe 成分で構造的に採点（OD-CS-11 案。新ボーナスなし、ruleset 不変）。後乗せ piece は最終判定の入力に入る |
| REGISTER_TO_DEX | 既に「最後の post-bake 確認後に RESULT になった時」に発火する構造（`App.tsx` `handleConfirmMakingStep`）。変更不要 |
| 前提 | `finalizeRound()` の抽出と golden 固定（#294 の CS-1b）。**Phase 2 で先に行う** |

---

## 6. BBQチキン型の影響（STEP 6）

> 本番導入は Phase 4b。以下は設計上の確認で、**決定ではない**。

### 6.1 材料・ショップ・進行

| 項目 | 内容 |
|---|---|
| 構成（matrix 証拠、`catalog_design_tag`、READY） | `bbq-sauce`（新）、`chicken`（既存）、`mozzarella`、`onion`、`cilantro`（新・焼成後） |
| 新素材 | **2つ**。Batch 6 前例と同じ**1ステップに複数素材**（`{ ingredientIds: ["bbq-sauce","cilantro"], keyRecipeId }`）。ladder は追記専用・次ステップ（52）。T4 価格、`starGates` の要否は Owner（OD-420-1 は Batch 6 の2素材限定の例外） |
| ソース | `bbq-sauce` は `category:"sauce"`。ソース描画は素材の `color` で決まり**描画コードの追加は不要**。変更が要るのは `RecipeSauceProfile.ingredientId` の**型ユニオン**（現在 3 値）、基準ピザ（reference fixture）、ソース量プロファイル |
| 分類 | `cilantro` は family「ハーブ・香味系」、`bbq-sauce` は sauce 扱い。Ingredient Icons 2.0 の Style Lock（#417/#438）に従うアイコン方針の確認が必要 |
| 生地根拠なし | CUT なし（REC-02 / OD-W2-4）→ タブは D·S·C·T·焼く·仕上げ＝**6** |
| Lunch Rush / Dinner | `lunchRush:false`、Dinner 対象外 |
| Batch 7 との競合 | ladder は追記専用で順序が固定される。Batch 7 の着地順で step 番号が決まる。**Batch 7 実装branchには触れていない**ため、Phase 4b 着手時に最新 ladder 末尾を再確認 |

### 6.2 技法（TQ-2）

- OD-TQ-2 により後乗せは技法。**新技法 id（例 `late-addition`）を `techniques.ts` に追加**し、Dex の「調理法」に未発見＝「？？？」＋なぞかけで表示（nameJa/riddleJa は Owner copy）。
- 検出: `signature.ts` の `late` 軸（現在 `FIXED_BY_FLOW`、`late: []`）を `OBSERVED` 化し、`stage==="post"` の素材 id 集合から導出。`RUNTIME_SUPPORTED_CAPABILITIES` に `LATE_ADDITION` を追加すると、これを要求する discovery target が初めてマッチ可能になる（現状は「どの target も required capability を満たせず unmatchable」な安全設計）。
- 技法は購入しない・★/Pitz なし・Free Cooking のみ（OD-TQ-1/7/10改）。
- **Cooking Steps（#294）側: FINISH engine は inert まで。有効化と技法の authority は TQ-2**（OD-CS-1=A）。本設計の Phase 3 と Phase 4 の境界がこれに一致。

### 6.3 採点

- 通常レシピの点数は**数学的に不変**（後乗せ要件を持たないため新項は常に 0）。
- 後乗せ piece は既存 Pieces/Recipe 成分で構造的に評価。新しい FINISH ボーナスは作らない（重み 52/16/12/20 不変、`lunch-rush-v1` 不変）。
- CUT の `cutScore` は別軸のまま。FINISH→CUT の順序は #288 の round-end 再確定とも整合する。

### 6.4 Hint 5.0 / Discovery / Research の推理情報保護

| リスク | 設計上の対策 |
|---|---|
| 「仕上げ」タブの出現で後乗せレシピが分かる | 案 A（常設）で全 FREE 同一。素材所持に連動させない（案 C 却下） |
| `attr:category` / `attr:group` ヒントから後乗せが漏れる | 後乗せを**レシピ側の `applicationPhase`** に置く（素材側にフラグを持たせない＝OD-CS-3）。新しい分類カテゴリ（「仕上げ素材」等）を作らない |
| STRUCTURE（材料総数）が後乗せを除外/別集計 | 後乗せ素材も**材料総数に含める**（`meta:ingredient-total` 不変） |
| 焼成前に cilantro を置く（同じ材料集合・時機だけ違う） | 識別は材料集合＋`late` 軸。`late` が違えばマッチしない。near-miss は **DIMENSION 系の「おしい」**にしつつ、候補が1つのままだと答えが特定されるため **k 規則（OD-TQ1C-2: 候補<2 は fail-closed＝汎用文言「おしい！あと少し、なにかが違うみたい…？」）**を適用 |
| Research の ○× 台帳 | 材料の○×は変えず、時機の違いは台帳に出さない（時機は軸であって素材ではない） |
| 失敗ピザからの情報 | FINISH はスキップされ、後乗せ情報は一切開示されない |
| Hint 5.0 tripwire | `G7`（ソース数≠1）は BBQ=1 ソースで通る見込みだが、**新ソース・新素材・新技法で `deductionProduction.gate` が赤になるのは想定内**。弱めず再監査して緑にする（#294 §10 H11） |
| 技法台帳の公開 | 「調理法」欄は未発見＝「？？？」。なぞかけは動作を名指ししない（OD-TQ-5/6） |

### 6.5 保存互換

`discoveredTechniqueIds` は schema bump なしで既に可変集合（未知 id も forward-compat 保持）。新技法 id の追加は既存セーブに影響しない。ほかに永続状態を増やさない。

---

## 7. Phase 1〜4 の Issue/PR 分割（STEP 7）

### 7.1 概要

```
Phase 0  Owner 判断（UD-A..UD-I）                         docs / Issue 起票は Owner 判断後  ※ UD-A 実装済み・UD-C 決定済み（2026-10-10）
Phase 1  Undo last placement                    [本番可視]  親: #270
Phase 2  Cooking Steps 土台（CS-1a 移植 → CS-1b） [不可視]    親: #294
Phase 3  FINISH engine（inert, fixture 検証）    [不可視]    親: #294
Phase 4a 技法 TQ-2 基盤（検出/軸/near-miss/Dex）  [不可視]    親: 新規（TQ-2）
Phase 4b 有効化（素材2・レシピ・FREE 仕上げ・HV） [本番可視]  親: 新規（TQ-2）
```

依存: P1 ⟂ P2（並行可）。P3 ← P2。P4a ← P3。P4b ← P4a ＋ Owner 決定（UD-B/D/E/F）。**P1 は他に依存しない**ので最初に出せる。

### 7.2 各 Phase

| Phase | 範囲 | 依存 | 主なテスト | HV |
|---|---|---|---|---|
| **P1 Undo** | `UNDO_LAST_PLACEMENT`（CHEESE/TOPPING）、↩ ボタン、Dinner ガード、トークン | なし | §3.9。既存 PREPARE E2E 全回帰。**Production DOM golden の再基準化が要る可能性**（バーにボタン追加）→ 項目ごとに確認 | **必須**（390×844 動画: 配置→Undo→再配置→ドラッグ中Undo→RESULT。360×800 は幅の実測のため追加）＋ before/after |
| **P2a 移植** | CS-1a（tab gate、`renderedPostBakeStep`）を main へ。tab-gate の導出化（§2.3） | UD-C | Vitest、`tsc`、`layout-contract` / `dynamic-cooking-steps` / `pizza-cutting-phase4b` が無改変で緑 | 不要（内部refactor・見た目不変、既存DOM同一） |
| **P2b CS-1b** | `finalizeRound()` 抽出、golden（55 × FREE/LR/Dinner × bake {生/適正/焦げ}） | P2a | golden の before/after バイト一致、`App.dinner`/`App.techniques` 無改変 | 不要 |
| **P3 FINISH engine** | `RecipeRequirement.applicationPhase?`、`deriveCoreSteps` が FINISH を付与、`PlacedTopping.stage?`、FINISH 配置＋Undo 拡張、暫定判定/再確定（§5.3）、在庫の差分消費、fresh 描画、reducer ガード。**検証は test-only の BBQ型 fixture（`RECIPES` に入れない）** | P2b | 「本番プロファイルに FINISH を含むものがない」不変条件、7タブ fixture でゲート失敗、再確定の golden、在庫の二重計上なし | 不要（本番で見えない） |
| **P4a TQ-2 基盤** | 新技法 id、`late` 軸 OBSERVED、`LATE_ADDITION` を supported に、near-miss DIMENSION＋k 規則、Dex 調理法。**合成カタログで検証（TQ-1C の前例）** | P3 | 検出・台帳 union・近似 near-miss・Research 台帳不変、Hint tripwire の「赤を確認」 | 不要（INV-TQ-4: 本番で不活性） |
| **P4b 有効化** | `bbq-sauce`・`cilantro`・ladder 追記・BBQ型レシピ・基準ピザ・FREE 仕上げタブ（案 A）・ガイドの仕上げ・Hint/Discovery 再監査・コピー | P4a、UD-B/D/E/F | 全層（pure/reducer/component/App/E2E/WebKit）＋Hint 5.0 gate | **必須**（FREE と ガイド、390×844＋360×800。Research 匿名ラウンドで仕上げタブが同一に見えること、焼成失敗でのスキップ、後乗せ発見→調理法の同時発見表示順） |

### 7.3 Issue 方針

- P1 → 既存 #270 に紐づけ。P2/P3 → 既存 #294（CS 番号に合流）。P4 → **TQ-2 の Issue は未存在**のため、Owner の了承後に起票（本セッションでは作成しない）。

---

## 8. 受け入れ条件

### 8.1 Undo（P1）

| ID | 条件 |
|---|---|
| AC-U1 | `UNDO_LAST_PLACEMENT` は CHEESE/TOPPING の現ステップのカテゴリの直近1個だけを除去する。前ステップの piece は除去されない |
| AC-U2 | 連続 Undo が可能。現ステップに対象がなければ no-op（state 参照不変）、ボタンは disabled |
| AC-U3 | 在庫・cookingTiming・Dex・Pitz・技法台帳・保存は不変。`CONFIRM_BAKE` 時の消費は Undo の有無にかかわらず最終ピザに対して 1 回だけ |
| AC-U4 | PREPARE 以外、DOUGH/SAUCE ステップ、Lunch Rush（UD-A 決定に従う）では reducer が拒否する。Dinner は PREPARE 内のみ |
| AC-U5 | 390×844・360×800 で ↩ が 44×44 を満たし、他ボタン・CTA と重ならない。CTA の x 位置がステップ間で動かない。ピザ直径（290 / 273.6）・dock 高さ（216）・バー高さが変わらない（`layout-contract`） |
| AC-U6 | ドラッグ中の Undo でセッションが中断され、遅れて来た commit が適用されない |
| AC-U7 | 保存データ・schema 無変更。旧セーブでの挙動不変 |

### 8.2 土台（P2）

| ID | 条件 |
|---|---|
| AC-B1 | 55 レシピ（導出）の最大可視タブ数 ≤ 6、かつ 6 に到達していること。FREE と全 Dinner ストリップも ≤ 6。7 タブ fixture でゲートが失敗する |
| AC-B2 | `finalizeRound` 抽出の前後で、55 レシピ × {FREE, Lunch Rush, Dinner} × {生/適正/焦げ} の `CONFIRM_BAKE` 結果が deep-equal |
| AC-B3 | 既存 E2E（layout-contract、dynamic-cooking-steps、pizza-cutting、dinner）が**無改変**で緑 |

### 8.3 FINISH engine（P3）

| ID | 条件 |
|---|---|
| AC-F1 | `RecipeRequirement.applicationPhase` が absent の全レシピで、プロファイル・スコア・完成判定・在庫・Dex が変更前と同一 |
| AC-F2 | FINISH は `POST_BAKE` かつ `makingStep==="FINISH"` でのみ配置可。在庫0・カテゴリ違い・所持外は reducer が拒否 |
| AC-F3 | FINISH を含むプロファイルでは、FINISH の確認ごと（0 個のスキップを含む）に完全な最終評価が再計算される。必須の後乗せ素材が 0 個ならば完成扱いにならず失敗として評価される（暫定の成功を引き継がない）。在庫は後乗せ piece の未消費差分だけ消費（各 piece 1 回、再確認しても冪等） |
| AC-F4 | 焼成失敗（`bakeCompletionFailure` 非 null / FREE の FAILED）では FINISH を含む post-BAKE が出ず RESULT へ。新しい閾値を持たない |
| AC-F5 | 焼成前に置いた同一素材と FINISH で置いた素材が Stock Gate で二重計上されない |
| AC-F6 | FINISH の Undo は `stage==="post"` の piece だけを戻し、焼成前 piece を除去しない |
| AC-F7 | `RECIPES` と `FREE` の本番プロファイルに FINISH を含むものがない（不変条件）。FREE に CUT が入って 7 タブになる変更はゲートで落ちる |
| AC-F8 | 後乗せ piece は焼き色を受けない描画（fixture 検証） |

### 8.4 有効化（P4b）

| ID | 条件 |
|---|---|
| AC-A1 | 全 FREE/Research ラウンドで「仕上げ」タブが同一に表示され、素材所持・レシピ・ヒント購入状況に依存しない。何も置かずに完了できる |
| AC-A2 | 焼成後に cilantro を置いた BBQ型でレシピと技法が同時発見され、表示順が ① 技法 → ② レシピ。焼成前に置いた場合は発見されず、候補<2 の汎用 near-miss 文言になる |
| AC-A3 | Research ○× 台帳・Notebook・Hint 事実・STRUCTURE 件数に時機の情報が出ない。`deductionProduction.gate` / Hint 5.0 G7 は再監査後に緑（弱めていない） |
| AC-A4 | 既存レシピの点数・ランキング・Pitz は不変（`lunch-rush-v1` 不変） |
| AC-A5 | HV（390×844 動画＋360×800、before/after）。FREE・ガイド・焼成失敗スキップ・Undo in FINISH を含む |

---

## 9. Owner 未決定事項（2026-10-10 更新: 未決定は UD-B / D / E / F / G / H / I の 7 件。UD-A・UD-C は決定済み）

| ID | 論点 | 選択肢 | 推奨（助言のみ） | 必要時期 |
|---|---|---|---|---|
| ~~UD-A~~ | Undo の対象モード、および OD-CI-4/10（不可逆原則）への位置づけ | (a) FREE/Guided/Research＋Dinner、Lunch Rush なし (b) FREE系のみ (c) 全モード | (a)。「配置に限った assist」を原則の例外として明記 | **決定済み・実装済み（#451: Guided / Free / Research / Dinner、Lunch Rush なし）** |
| **UD-B** | FREE の仕上げ UI | 案 A（常設タブ）／案 B（二択パネル） | A。FREE に CUT が入る時点で B/CS-4 へ | P4b 前 |
| ~~UD-C~~ | PR #295 の扱い | C1（docs 先行＋コード移植）／C2（#295 を rebase して merge）／C3 | C1 | **決定済み: C1（2026-10-10, Owner）** |
| **UD-D** | 後乗せの本番出荷の帰属（TQ-2 Issue の起票者） | #294 OD-CS-1=A 踏襲（engine は CS、有効化は TQ-2） | 踏襲 | P4a 前 |
| **UD-E** | ガイド（レシピ指定）の仕上げ表示 | 後乗せレシピのみ表示／全レシピ常設 | 後乗せレシピのみ（現行レシピの見た目を変えない） | P4b 前 |
| **UD-F** | BBQ型の材料条件 | `starGates` の有無、T4 価格、1 ステップ 2 素材、キー素材 | Batch 6 前例踏襲（Owner 数値） | P4b 前 |
| **UD-G** | 新技法の名称・なぞかけ・Dex 表示コピー | Owner 文言 | — | P4a/P4b |
| **UD-H** | 失敗ピザの FINISH スキップ | スキップ／許可 | スキップ（§5） | P3 前 |
| **UD-I** | 後乗せレシピの Dinner / Lunch Rush | 両方除外／Dinner のみ再設計 | 両方除外（OD-CS-5/6 案） | P4b 前 |

---

## 10. 既存Issue/PRとの対応（重複確認のみ・変更なし）

| 対象 | 関係 | 扱い |
|---|---|---|
| #294 / PR #295 | 本設計の土台（CS-1a/1b/2、OD-CS-1..20） | 参照のみ。PR #295 は無変更 |
| #270 | P1 の親 | 参照のみ |
| Cooking Interaction 2.0 audit（`claude/cooking-interaction-fresh-audit-18pfmn`） | Undo 方針・チーズ工程・こねる/ちぎる周辺 | 参照のみ |
| #288 / #256（merged #275） / #320 | CUT の round-end 再確定／失敗時スキップ | 整合を確認 |
| #447 | トレイ高さ変更（Undo をトレイ行に置かない理由） | 参照のみ。触れていない |
| #216 / #182 / #292 | 新素材の解禁・Hint 5.0 再監査 | 参照のみ |
| #421 | チーズの食欲表現（ちぎり演出の合流先候補） | 本パイロット外 |
| PR #445 / Issue #442 #443 #446 / Batch 7 branch | — | **触れていない** |

**重複確認の結果:** 「Undo」「仕上げ/FINISH」「TQ-2」「finalizeRound」を主題とする open Issue/PR は #270・#294・PR #295 以外に無い（検索で未検出）。**新規Issueは作成していない。**

---

## 11. 限界

- Playwright / WebKit は本セッションで未実行（再基準化の確認は Vitest・tsc・oxlint まで）。
- `PizzaStage.tsx:478` の guide-fade とトークン共有の影響、360 幅でのバー内 4 ボタンの収まり、`Production DOM golden` の再基準化範囲は、**実装時の実測項目**。
- pizzadb.jp へは本セッションから接続していない。レシピ証拠は repo に取り込み済みのデータに依存。
- Cooking Interaction 2.0 audit の Owner Decisions は「未main branch 上の記録」であり、main の authority ではない。
