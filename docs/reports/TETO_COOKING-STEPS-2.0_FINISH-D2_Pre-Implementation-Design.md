# TETO Cooking Steps 2.0 — FINISH D2 実装準備（競合調査・最小仕様・分割 PR 計画, docs-only）

Status: **設計・競合調査のみ。実装開始前に Owner へ報告して停止。** `src` / CSS / runtime / e2e の変更なし。PR 作成・merge・deploy なし。
前提: `docs/reports/TETO_COOKING-STEPS-2.0_NEXT-PROCESS_Fresh-Audit.md`（以下「前回 Audit」）。

| 項目 | 値 |
|---|---|
| 基準 main | `d0da093`（`git fetch origin main` で再取得済み。前回 Audit から変化なし） |
| 方法 | PR #478 / #468 / #494 の head を fetch し、**`git merge-tree --write-tree` で現 main への実マージを模擬**、各 PR の差分ファイル・hunk を D2 の編集予定箇所と突き合わせた。実装はしていない |
| Owner 方針（今回） | ① #478 と GameScreen の競合を先に解決 ② #468/#494 は全面完了を待たず D2-2 との実競合を監査 ③ UD-E = ガイドの「仕上げ」は後乗せレシピのみ ④ TQ-2 は重複確認後に起票可（本番有効化は禁止）⑤ 複数ソースの新規本番有効化は B3 と採点ルール整備まで保留 |

---

## 1. 競合調査（実測）

### 1.1 現 main へ実マージした結果

| PR | 状態 | base からの遅れ | 現 main へのマージ | 競合ファイル |
|---|---|---|---|---|
| **#478** (#476 S1, draft) | OPEN / draft。Owner の iPhone 実機 HV 未実施 | main より 16 commit 遅れ（base `6b86798`） | **クリーン（競合なし）** | なし |
| **#468** (#421 Pilot) | OPEN | 17 commit 遅れ（base `41efe27`） | **競合** | `src/components/PizzaStage.tsx`（`App.css` は自動マージ） |
| **#494** (#489 gauge Phase 2) | OPEN / HOLD | 8 commit 遅れ（base `2db1a52`） | **競合** | `src/components/PizzaStage.tsx`（`App.css` は自動マージ） |

- #468 と #494 の競合は、**main 側で B1/B2/#487 が `PizzaStage` を変えたため PR 自身が抱える rebase 課題**で、D2 とは無関係。
- #494 は B1 の ledger に置き換えられる（#498 Result: 「#494 の accumulate-across-switch logic is superseded by the ledger」）。D2 から見れば無関係。

### 1.2 D2-1（GameScreen 側）と #478 の関係

#478 の `GameScreen.tsx` 差分は 2 hunk のみ（実測）:

| #478 の hunk | 内容 | D2-1 との関係 |
|---|---|---|
| ~L381 | 新規 `pieceDragEnabled = allowsPieceDragInRound(state) && **state.phase === "PREPARE"** && …` | **実質的に衝突する。** FINISH は `phase === "POST_BAKE"` なので、ドラッグを FINISH で効かせるには、この式を D2-1 が編集する必要がある（#478 が入る前は別の式 `referenceModeEnabled && …` と `draggableIngredientIds={["mozzarella","basil"]}`） |
| ~L866 | `<IngredientTray … physicalDragEnabled=…>` の props（`draggableIngredientIds` 廃止） | D2-1 が FINISH 用に同じ `<IngredientTray>` を複数箇所で使う場合、隣接行の編集になる |

さらに、トレイ・Undo・下部バーは `state.phase === "PREPARE" && (...)` ブロック（L829〜）の内側にあり、**FINISH 用に POST_BAKE 側へ並置する**必要がある。この領域は #478 が props を変えた直近である。

**結論（Owner 方針 1）: #478 を先に main へ入れてから D2-1 を始めるのが最小コスト。** #478 はクリーンにマージ可能で、残る作業は Owner の iPhone 実機 HV と draft 解除のみ（私は merge しない）。#478 を待たずに D2-1 を始める場合は、ドラッグなし（タップ配置のみ）に限定すれば `pieceDragEnabled` を触らずに済むが、同じファイルの隣接領域を触るため、後から結局 rebase が要る。

### 1.3 D2-2（PizzaStage 側）と #468 / #494 の実競合

D2-2 の編集予定箇所は **2 点のみ**:

1. `toppingPieceStyle`（`PizzaStage.tsx` ~L966）: `stage === "post"` のピースには焼き色フィルタを掛けない。
2. そのピースを描く箇所（~L1190）: 呼び出しに piece（`t.stage`）を渡す。

| PR | D2-2 との重なり | 判定 |
|---|---|---|
| **#468** | **~L1190 の同一式**を変更している: `style={ingredient.category === "cheese" ? cheesePieceStyle(…) : toppingPieceStyle(ingredient)}`。import 行（L18）と bake 付近（L953）にも hunk | **重なるのは 1 式のみ（実害は小さい）**。#468 が書き換えるのは **cheese 分岐**で、D2-2 が触るのは **非 cheese 分岐の `toppingPieceStyle` 呼び出し**。FINISH は topping カテゴリ限定（`PLACE_TOPPING` の FINISH 分岐と Undo が topping のみ）なので、意味上の衝突はない。テキスト上は後から入る側が 1 行を解決すればよい |
| **#494** | 重ならない。hunk は import / `committedTotalRef` / SAUCE 派生ブロック / JSX 末尾（ゲージ）のみ | **D2-2 と無関係** |
| #487（merged） | `cheesePool` / Canvas 経路。FINISH のピースは cheese ではないので通らない | 無関係 |

**結論（Owner 方針 2）: D2-2 は #468 / #494 の完了を待つ必要がない。** 軽減策として、D2-2 は `toppingPieceStyle` の**シグネチャ変更ではなく、呼び出し 1 箇所の引数追加のみ**に留め、PR 本文に「#468 と同一式を触る」と明記する。#468 と #478 は互いに独立（ファイル集合が別）、D2-1 と D2-2 もファイル集合が別（GameScreen/postBakeView と PizzaStage）なので、**2 つの PR は並行・順不同で進められる**。

---

## 2. D2-1 の最小実装仕様（FINISH 画面の接続）

目標: Guided の後乗せレシピで、焼成後に「仕上げ」を**見て・置いて・戻して・確定**できる。**本番 `RECIPES` には FINISH を出さない**（fixture のみ）。

### 2.1 変更範囲（予定）

| ファイル | 変更 |
|---|---|
| `src/screens/postBakeView.ts` | `RenderedPostBakeStep = "CUT" \| "FINISH"`。`makingStep === "FINISH"` を `"FINISH"` として返す。reducer は `roundRunsFinish` かつプロファイルに FINISH があるときしか FINISH に入れないため、追加のガードは不要（二重ガードは持たない） |
| `src/screens/GameScreen.tsx` | `isFinishStep`。`roomyStage` は **FINISH では false**（トレイの高さを確保するため。`roomy` は BAKE/CUT 専用の大きいステージ）。`PizzaStage compact` は FINISH でも true（PREPARE と同じ寸法）。FINISH 用のドック＋下部バーを POST_BAKE 側に追加（§2.2） |
| `src/components/MakingStepTabs`（props 経由のみ） | `nextReady`: `POST_BAKE` で CUT のときは `cutConfirmReady`、FINISH のときは §2.3 の `finishConfirmReady` |
| `src/App.tsx` | **変更不要の見込み**: `makingStepToCategory(FINISH)` は既に `topping`（`default`）、`handleTapPizza` / `handlePhysicalDrop` は `PLACE_TOPPING` を送るだけ、ホーム離脱確認は POST_BAKE で既に無条件（#453） |
| `src/components/IngredientTray.tsx` | 原則変更なし（props のみ）。#478 後は `physicalDragEnabled` を FINISH でも true にする式の変更が GameScreen 側に入る |
| `src/App.css` | **変更しない目標**（既存の `prepare-dock` / `prepare-bake-bar` を再利用）。レイアウト計測で不足が出た場合のみ、最小の追加を Owner に確認してから |
| reducer / `finishEngine` / scoring / save / ladder | 変更なし（D1a/D1b で完了済み） |

### 2.2 FINISH の画面構成（既存 UI の再利用）

```
[工程タブ: 生地 ✓ | ソース ✓ | チーズ ✓ | 具材 ✓ | 焼く ✓ | 仕上げ(active) | (カット)]   ← 既存 MakingStepTabs（FINISH 色・短縮ラベル済み, CS-4a）
[order-card: レシピ名 / 「仕上げの具材をのせよう！」]                                    ← CUT と同じ order-card を再利用。具材名は書かない
[PizzaStage (compact, interactive)]                                                       ← 焼成済みの見た目のまま、タップ/ドラッグで配置
[prepare-dock: IngredientTray (activeCategory = topping)]                                 ← 既存トレイ。在庫は焼成後の在庫（D1b）
[prepare-bake-bar: 「1つ戻す」 / 「仕上げ完了 →」]                                         ← 「やり直す」は置かない（RESET_PIZZA は PREPARE 専用）
```

- 「1つ戻す」は既存の `handleUndoPlacement`（`undoablePlacementIndex` が FINISH 分岐で `stage === "post"` のトッピングのみ返す。D1a で実装済み）。Lunch Rush では `showUndoButton` が false（既存どおり）。
- 「仕上げ完了」は `onConfirmMakingStep`（`CONFIRM_MAKING_STEP`）。FINISH を抜けるときに reducer が FINAL 評価を 1 回だけ実行する（D1b）。
- **ヒント行は出さない**（reducer の `hint` は FINISH では据え置き）。文言は**固定の汎用文**とし、食材名・数・カテゴリを含めない（識別漏れ防止。後乗せレシピであること自体は UD-E で表示を許容済み）。
- UD-E: FINISH タブは `deriveCoreSteps` が後乗せ要件から導出するため、**後乗せレシピ以外には自然に出ない**（追加実装不要。回帰テストで固定する）。

### 2.3 「仕上げ完了」を 0 個でも押せるか（実装時に確認する点）

- reducer は「0 個は FAILED であって、暫定成功の継承ではない」と固定済み（D1a/D1b のテスト）。
- 既存の SAUCE/CHEESE の「次へ」は未配置でも押せる（reducer が backstop）。**同じ流儀で、`finishConfirmReady` は常に true を推奨**（Owner 方針の範囲内。ボタンを無効にすると「何を置けばよいか」を UI が教えることになり、識別漏れに近づく）。変更したい場合は Owner 判断。

### 2.4 テスト計画（D2-1）

| 層 | 内容 |
|---|---|
| unit `postBakeView.test` | FINISH を返す／CUT は不変／PREPARE・BAKE・RESULT は null |
| component（実 GameScreen＋実 reducer, fixture） | FINISH で: タブ active が仕上げ、ドックとバーが出る、「やり直す」が無い、タップで `stage:"post"` が付く、「1つ戻す」で FINISH ピースだけ戻る、「仕上げ完了」で FINAL 評価が 1 回走り CUT（またはRESULT）へ、ホーム離脱は確認ダイアログ。**CUT のみの既存レシピは DOM が byte 同一**（既存 GameScreen テスト無編集） |
| 回帰（無編集で通ること） | `finishEngine.test` / `gameReducer.finish.test` / `finalizeRound` golden / `cookingProfiles.tabGate.test`（上限 6）/ UD-E: `RECIPES` のどのプロファイルにも FINISH が出ない invariant |
| e2e（Chromium 390×844・360×800） | 本番アプリでは FINISH に到達できないため **dev/test 専用ハーネス**（CS-4a の `e2e/harness/cs4-tabs` と同じ手法）に実 `GameScreen` を fixture 状態で載せる。置く→戻す→確定、タブ幅・はみ出しなし、スクロール幅 ≤ viewport。**既存 e2e は無編集で green** |
| WebKit | 既存 Gate を通す（`src` 変更のため必須） |
| Human Verification | 本番の画面は不変（FINISH は fixture のみ）だが、**ハーネス上の FINISH 画面は新規 UI** → 390×844 動画（Owner へ直接提出、repo には commit しない）＋ before/after スクリーンショット（`docs/reports/screenshots/finish-d2-1/`）。HV Policy §2 に従い、本番 CUT 画面が不変であることの before/after も添える |

リスク（実装時に実測する）: ① `dockReserve`（ドックの予約高さ）が FINISH で正しく計算されるか／固定高が足りるか ② 360×800 でバーの 2 ボタン＋ドックが収まるか ③ ハーネスで `GameScreen` の props（約 60 個）をどこまで noop にできるか。③ が重い場合は component テスト（`GameScreen.keyboardSpreadRepeat.test` の前例）＋ `MakingStepTabs` ハーネスの組合せに縮小し、その旨を Result に書く。

---

## 3. D2-2 の描画依存関係と最小仕様

| 依存 | 現状 | D2-2 の扱い |
|---|---|---|
| ピースの段階 | `PlacedTopping.stage?: "post"`、`isPostBakePiece()` が `pizzaState.ts` にある（D1a） | そのまま読む |
| 焼成済みの見た目 | App.tsx は POST_BAKE の間 `bakeProgress = state.pizza.bakeResult`（PR-E）。つまり FINISH 中も全ピースに焼き色フィルタが掛かる | **後乗せピースだけ掛けない**のが D2-2 の中身 |
| ピースの描画 | `PizzaStage.tsx` の `toppingPieceStyle(ingredient)`（`bakeProgress` と `bakeHeat` を参照）。CUT 後のピース別描画も同じ関数を通る | 引数に piece を足し、`stage === "post"` なら `undefined`（= CSS 既定の `drop-shadow` のみ）を返す |
| 全体オーバーレイ | `pizza-char-spots`（焦げ斑点）・煙・生地/チーズ色は**ピザ全体**に掛かる | 触らない。焦げ（OVERBAKED）ピザは失敗でそもそも FINISH に入らない（OD-CS-7）ので、FINISH 中に出るオーバーレイは軽微 |
| cheese Canvas（#487）／融解（#468） | cheese カテゴリのみ | FINISH は topping 限定なので影響なし |

**D2-2 の最小仕様:** (1) `stage === "post"` のピースは焼き色フィルタなし。(2) `stage` を持たない既存ピースは**出力が byte 同一**（既存 `PizzaStage` golden（sauceRender・bakeVisual 系）を無編集で通す）。(3) 本番では FINISH に到達できないため完全に不活性。

テスト: component（`stage:"post"` のピースはフィルタ無し、通常ピースは従来と同一、CUT 後のピース別描画も同様）／既存 PizzaStage テスト 152 件＋ golden 無編集／mutation（`stage` 条件を外すと落ちる）。HV: 本番画面は不変のため「不要（内部描画、本番不活性）」とし、D2-1 のハーネス動画で後乗せピースの見た目も同時に確認してもらう（Result に明記）。

---

## 4. 分割 PR 計画

PR は作らない（計画のみ）。各 PR は単独で revert 可能。

| PR | 内容 | 触るファイル | 依存 | 本番への影響 | HV |
|---|---|---|---|---|---|
| **D2-0 docs 訂正** | §6 の古い記述の更新 | docs のみ | なし（いつでも可） | なし | 不要（docs） |
| **D2-2 後乗せピースの描画** | §3 | `PizzaStage.tsx` ＋テスト | **なし**（#468 と 1 式で重なるが意味上は独立）。**#478 とは無関係で並行可** | なし（不活性） | 不要（D2-1 のハーネスで併せて確認） |
| **D2-1 FINISH 画面の接続** | §2 | `postBakeView.ts` / `GameScreen.tsx` / ハーネス / e2e | **#478 の merge 後**（§1.2）。D2-2 は不要だが、見た目確認は両方が揃ってから | なし（fixture のみ） | **必須**（390×844 動画＋ screenshots） |
| 後続（本計画の外） | #495（暫定スコア）／FREE の仕上げ UI（UD-B）／TQ-2 有効化 | — | D2-1/2 後、Owner 決定後 | 有効化は禁止（Owner 方針 4） | — |

**順序の推奨:** D2-0 と D2-2 は今すぐ並行で始められる。D2-1 は #478 の決着待ち。D2-1 と D2-2 の両方が merge され、ハーネスで FINISH が通しで確認できた時点で、D2 完了。

---

## 5. TQ-2 の重複確認と起票案

- 検索: `"TQ-2" in:title,body`（4 件ヒット）／`後乗せ in:title`（0 件）／`FINISH in:title`（0 件）／前回の open Issue 全件（40 件）。
- ヒットした 4 件（#262 TQ-1A、#263 TQ-1B、#285 TQ-1C-0、#287 TQ-1C）はすべて **closed** で、本文中に「TQ-2 / TQ-3 は範囲外」と書かれているだけ。**TQ-2 を主題とする Issue / PR は存在しない**。Pilot §7.3 の記録とも一致。
- **起票はしていない。** 今回の作業指示は「重複を確認する」までで、Owner 方針 4 は起票を「可」としたに過ぎない。下記の文面で良ければ「起票してよい」の一言で作成する（本番有効化を禁じる範囲を明記してある）。

> **Title:** TQ-2: 後乗せ（Late Addition）調理法 — 技法の基盤と Hint/Discovery 再監査（本番有効化は別 Owner Gate）
>
> **背景:** FINISH engine は D1a/D1b で main にあり不活性（OD-CS-1 = A: 有効化の権限は TQ-2）。本 Issue は技法側の作業を追跡する。#294（Cooking Steps 全体）と #465（ロードマップ）が親。
> **範囲（案）:** 新技法 id、`late` 軸 OBSERVED、近似 near-miss（DIMENSION＋k 規則）、Dex 調理法欄、Hint 5.0 G7 / `deductionProduction.gate` の再監査計画、UD-D/G/F/I の Owner 決定の記録。合成カタログで検証（TQ-1C の前例）。
> **範囲外・禁止:** 本番レシピでの有効化（BBQ チキン等）、FREE の仕上げ UI（UD-B）、Dinner/Lunch Rush、複数ソース（TQ-3。B3 と採点ルール整備まで保留）、7 タブ本番 UI。
> **前提:** FINISH D2（UI）。**関連:** #294, #465, #495, #489。
> **重複確認:** 「TQ-2」「後乗せ」「FINISH」で検索し、該当する open/closed Issue・PR なし（#262/#263/#285/#287 は範囲外として言及のみ）。

複数ソース（Owner 方針 5）: TQ-3 は起票しない。#489（B3 と O4）と採点ルール整備（要件・基準ピザ・Recipe 成分の扱い）が決着するまで、新規の本番有効化は保留として記録する。

---

## 6. 古い記述の更新案（本 PR では書き換えない）

| 場所 | 現在の記述 | 提案 |
|---|---|---|
| Issue #294 本文 | 「**Status: CS-0 design done (docs only). STOP before implementation.** No phase has started.」 | 「CS-0〜CS-1b・FINISH D1a/D1b・CS-4a は main にある（#464 #490 #491 #497 #499）。次: FINISH D2（UI）。本番有効化は TQ-2。」へ。**本文の編集は Owner の可否を確認してから**（コメント追記で足りるなら本文は触らない） |
| Issue #294 の Phases 表 | CS-1 が「Next implementable」、CS-2 が「Blocked」、CS-4 が「Blocked: OD-CS-9 (b)」 | CS-1a/1b ✅、CS-2（engine）✅（D1a/D1b、不活性）、CS-4a ✅（7 タブは fixture のみ。上限 6 は不変） |
| 設計書 `NEXT-PHASE_DESIGN.md` L3 | 「Status: **Design complete — STOP before implementation.**」 | 「Design (history). 実装状況は §14 と Result Reports を参照」 |
| 同 §14 の Phase status | CS-1a「◻ not started on `main`」／CS-1b「⏸ not started」／CS-2「not started」 | CS-1a ✅ #464、CS-1b ✅ #490、CS-2 engine ✅ #491/#497（D2 = UI は未着手）、CS-4a ✅ #499 |
| `AUTHORITY-INDEX.md` L9–35 | 「FINISH (CS-2) cannot start until …」「Open: OD-CS-3 …」 | OD-CS-3/7/11 は決定済み（Issue #294 コメント 2026-10-14、`FINISH-ENGINE_OWNER-DECISIONS.md`）。UD-E の決定（今回）を追記 |
| `FINISH-ENGINE_OWNER-DECISIONS.md` | D1a/D1b の slice 表 | 今回の **UD-E = 後乗せレシピのみ表示**、**複数ソース新規本番有効化は B3＋採点ルール整備まで保留**、**TQ-2 起票可（有効化禁止）** を追記。D2 を D2-1/D2-2 に分けて記載 |
| Issue #465 項目 10 | 「PR-D — FINISH工程（未作成、Owner Decision必要）」 | 「D1a #491 ✅ / D1b #497 ✅ / D2-1・D2-2 未着手」。実現順の項目を分割 |
| `PROJECT_HANDOFF.md` | 2026-10-13 の addendum までで、D1a/D1b/CS-4a/B1/B2 の記載なし | 各 PR の 1 行 addendum |
| 前回 Audit（本ブランチ） | — | 今回の分割（D2-1/D2-2）と UD-E 決定を反映した差分は不要（本ファイルが後続） |

提案: **D2-0 の docs PR 1 本で、リポジトリ内の文書（設計書・Index・Owner Decisions・HANDOFF）を更新**し、Issue #294 / #465 は**コメントで状態を追記**する（本文の改変は Owner が望む場合のみ）。

---

## 7. 実装開始可能な条件と残るブロッカー

### 7.1 開始条件

| 作業 | 開始できるか | 条件 |
|---|---|---|
| **D2-0（docs 訂正）** | **今すぐ可** | Owner の了承（PR 作成は未許可のため、PR 化の可否も） |
| **D2-2（後乗せピースの描画）** | **技術的には今すぐ可**（#478/#494 と無関係、#468 とは 1 式のみ） | Owner の「実装開始」指示。#468 と同一式を触ることを PR に明記 |
| **D2-1（FINISH 画面）** | **#478 の merge 後** | #478 が draft 解除・Owner iPhone 実機 HV・merge されること（私は merge しない）。ドラッグなしの縮小版を先行する場合は Owner の判断 |

### 7.2 残るブロッカー

| # | ブロッカー | 担当 | 影響 |
|---|---|---|---|
| 1 | **#478**: draft、Owner の iPhone 実機 HV 未実施、main より 16 commit 遅れ（クリーンにマージ可能） | Owner | D2-1 |
| 2 | 実装開始の Owner 指示（今回は設計まで） | Owner | D2-0/1/2 |
| 3 | TQ-2 Issue の起票可否（文面は §5） | Owner | 技法側の追跡のみ（D2 は不要） |
| 4 | 「仕上げ完了」を 0 個でも押せるか（推奨: 押せる＝無効化しない） | Owner（軽微） | D2-1 の UI 仕様 |
| 5 | D2-1 の HV（390×844 動画）は Owner が確認 | Owner | D2-1 の完了条件 |
| 6 | 他の open 事項は **D2 の範囲外**: UD-B（FREE）、UD-D/F/G/I、OD-CS-4/5/6/8/10、#495（暫定値を UI に出す場合のみ）、#489 の B3 と O4、複数ソースの採点ルール | Owner | 有効化（P4）以降 |

### 7.3 守ること（Owner 決定の再確認）

- 本番 `RECIPES` に `applicationPhase` を出さない（invariant を維持）。FINISH は fixture のみ。
- 本番有効化（TQ-2）・TQ-3・FREE の仕上げ UI・Dinner/Lunch Rush の FINISH・7 タブ本番化は、いずれも D2 に含めない。
- #487・#468・#494・#438・#478 は変更しない（調査のため head を fetch しただけ）。
