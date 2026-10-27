# 発見失敗後の案内 — C1 / C3 実装前 Gate（Issue #676、docs-only）

Status: **実装前 Gate の提出。runtime は実装しない。** `src/**`・`e2e/**`・CSS・テスト・golden は無変更。merge・deploy・CI 再実行・Monitor 作成なし。
基準 `main` = `9761d03`（#673 merge 後。Deploy to GitHub Pages run #461 は success）。設計 Gate: `TETO_DISCOVERY-FAILURE-GUIDANCE_DESIGN-GATE_2026-10-26.md`。
**「推奨」「判定」は助言であり、実装開始は Owner の明示的な指示を要する。**

## 0. Owner 判断（2026-10-27）

- **C1「💡 ヒントを見る」（FAILED 画面）と C3 固定文（標的なし ORIGINAL）を実装候補として確定**する（実装の開始ではない）。
- **C3 の文言は確定:** 「**ヒントを見ながら、次に試す材料を考えてみよう。**」（現行の注記「図鑑のピザと同じ組み合わせで作ると「発見」＆Pitzがもらえるよ。」を置き換える）。
- 標的なし Free Cook でヒントシートが**実際に使えるか**を確認し、**表示条件を設計**する（§1・§2）。
- **既存 `handleRetryWithHint` の利用を優先**する（新しい action・reducer 変更を作らない）。
- Contract 2.1、INV-D7、AC-P1〜P6 を維持する。
- **まず本 Gate を提出し、未確認の状態では runtime を実装しない**（§5 の未確認事項）。
- C2・C4〜C6 は見送りのまま。

## 1. ヒントシートが使えるかの確認（実画面。コード無変更のブラウザ操作）

`tools/discovery-failure-guidance-audit/retrypath.spec.ts`（結果: `docs/reports/screenshots/discovery-failure-guidance/retrypath-390x844.json`、画面 `retry-*-O1-sheet.png` / `retry-*-F2-sheet.png`）。**本番で到達できる状態**（テストフックなし。HOME「レシピ発見」または図鑑の研究開始）の 3 つで、3 つの経路を比べた:

- **O1:** ORIGINAL → 結果画面の既存「💡 ヒントを見る」
- **O2:** ORIGINAL → 「もう一度試す」→ PREPARE の「ヒント」
- **F2:** FAILED（生焼け）→ 「もう一度試す」→ PREPARE の「ヒント」（C1 が 1 クリックで行うことと同じ 2 つの dispatch）

| 状態 | 結果画面（ORIGINAL / FAILED） | FAILED に「ヒントを見る」 | シートが開く（F2） | O1 = O2 | **O2 = F2（シートの全文が同一）** |
|---|---|---|---|---|---|
| 新規保存（標的なし、図鑑 0/68） | original / failed | **なし**（現状） | **開く** | 同一 | **同一** |
| 図鑑にマルゲリータのみ、ショップ新入荷（標的なし） | original / failed | なし | 開く | 同一 | **同一** |
| Research（研究対象 1 件） | original（research）/ failed | なし | 開く（研究文脈つき） | 同一 | **同一** |

読み取り:

1. **FAILED からもヒントシートは使える。** 「もう一度試す」で新しい PREPARE に入り、そこでヒントシートが開く。
2. **結果が ORIGINAL か FAILED かで、開くシートの内容は変わらない**（全文一致、3 状態）。C1 は新しい情報を出さず、すでに PREPARE の「ヒント」ボタンから見えるシートへの近道。これは AC-P1 の経験的な裏付け（同一の pizza 構成で bake だけ変えた比較）。
3. 既存の ORIGINAL の「💡 ヒントを見る」（O1）は、「もう一度試す」→「ヒント」（O2）と**同じシート**を出す（`handleRetryWithHint` = `RETRY_SAME_RECIPE` + `SHOW_HINT` の確認）。
4. 新規保存では、シートに既存の Margherita 導入のヒント（「ソースは トマトソース みたい」「材料は全部で3種類。チーズを使うみたい」、「✨ はじめてのピザはヒント無料！」）が出る。これは既存の onboarding の仕様で、C1 が新しく出す情報ではない（PREPARE の「ヒント」からも同じ）。本 Gate では変更しない。

コード上の根拠: PREPARE の「ヒント」ボタンは `state.dinner === null` のとき常に出る（`GameScreen.tsx`）。`SHOW_HINT` は `freeCook` かつ PREPARE でのみシートを開く（`gameReducer.ts`、`isHintSheetVisible`）。`handleRetryWithHint` は `state.freeCook` のみを条件にする（`App.tsx`）。結果画面の `onShowHint` は `state.freeCook ? onRetryWithHint : undefined`（`GameScreen.tsx`）。

## 2. 表示条件の設計（C1 / C3）

### C1（FAILED のヒント行）

| 項目 | 設計 |
|---|---|
| 表示条件 | **`freeCook` かつ `onShowHint` あり**（ORIGINAL の `hintRow(null, true)` と同じ条件）。結果画面の `onShowHint` は既に `freeCook` のときだけ渡されるため、**`GameScreen.tsx`・`App.tsx` の変更は不要**。変更は `ResultPanel.tsx` の FAILED 分岐のみ |
| 部品 | 既存 `hintRow(null, true)`（`.result-near-miss` + `.result-near-miss__cta`）、既存文言「💡 ヒントを見る」。**新しい文言・CSS・action・reducer 変更なし** |
| クリック | 既存 `onShowHint`（= `handleRetryWithHint`）。`RETRY_SAME_RECIPE` + `SHOW_HINT` |
| 位置 | `.result-panel__headline` の直後、`.pitz-credit-summary` の前（ORIGINAL が headline の直後に hintRow を置くのと同じ位置関係）。「もう一度試す」を含むボタン列の上 |
| 両方の FAILED 分岐 | Research（`failedResearch`、試作ノートのボタンあり）と標的なし（`actions` を使う）の両方。ボタン列の構成は不変 |
| 表示しない | 案内対象外: Guided（`freeCook` が false）、Lunch Rush、Dinner。NEW_DISCOVERY・ALREADY_DISCOVERED・Research ORIGINAL は不変 |
| 空の pizza の FAILED | 「材料が入っていません」でも表示する（FAILED の種類で出し分けない。出し分けると種類の情報になる） |

### C3（標的なし ORIGINAL の固定文）

| 項目 | 設計 |
|---|---|
| 文言 | 「ヒントを見ながら、次に試す材料を考えてみよう。」（Owner 確定） |
| 置き場所 | 定数 1 つ（`originalResultCopy.ts`）。`ResultPanel.tsx` の `original-pizza__note`（`research ? RESEARCH_UX_COPY.resultNote : <この定数>`）で、現行の直書き文字列を置き換える |
| 範囲 | 標的なし Free Cook の ORIGINAL（ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH を含む）のみ。Research の `resultNote` は不変。FAILED・ALREADY_DISCOVERED・NEW_DISCOVERY・Dinner / Lunch Rush は不変 |
| 同一性 | 3 種の ORIGINAL で DOM が byte 同一（AC-P3） |

## 3. レイアウト予算（390×844 / 360×800、ブラウザ内の DOM 実験）

`tools/discovery-failure-guidance-audit/layoutbudget.spec.ts`（結果 `layoutbudget.json`、画面 `c1-experiment-*.png` / `c3-experiment-*.png`）。実際の変更をせず、ブラウザ内で ORIGINAL と同じ `hintRow` の HTML を FAILED カードに挿入して測った。

| 画面 | 余白（内容末尾 → ボタン列の上端）: 現状 → 追加後 | ページ縦スクロール | 横オーバーフロー | ヒントボタン | ボタン列との重なり |
|---|---|---|---|---|---|
| Research FAILED 390×844 | 117.8 → **71.8** px | 0 → 0 | 0 | 36 × 113px | なし |
| 標的なし FAILED 390×844 | 295 → 249 px | 0 → 0 | 0 | 同上 | なし |
| Research FAILED 360×800（最も詰まる） | 73.8 → **27.8** px | 0 → 0 | 0 | 同上 | なし |
| 標的なし FAILED 360×800 | 251 → 205 px | 0 → 0 | 0 | 同上 | なし |
| C3: 標的なし ORIGINAL 390×844 | 278 → **293** px（+15、新文が短い） | 0 → 0 | 0 | — | — |
| C3: 標的なし ORIGINAL 360×800 | 234 → **249** px（+15） | 0 → 0 | 0 | — | — |

- C1 の追加は 46px。最も詰まる 360×800 の Research FAILED でも **27.8px 残り、AC-L2（16px 以上）を満たす**。
- **C3 は注記が短くなるため、高さがむしろ 15px 減る。**
- ヒントボタンは既存クラスのまま高さ 36px（`.result-near-miss__cta`、ORIGINAL と同一）。44px の推奨より小さいが既存の仕様で、**CSS は変更しない**（変える場合は `App.css`（HOT）の変更になり、別判断）。
- 実験は Chromium。WebKit / 実機は未確認（§5）。

## 4. 受け入れ条件（確定済みの AC に、この Gate の確認結果を紐づけ）

| AC | 内容（設計 Gate §7） | この Gate での状態 |
|---|---|---|
| AC-L1〜L4 | 縦スクロール・横オーバーフローなし、360×800 の Research FAILED で余白 16px 以上、ボタン 36px 以上・重ならない、C3 の行数 | §3 で Chromium の DOM 実験により**満たされる見込みを確認**。実装後の実測は実装 PR で再確認 |
| AC-P1 | FAILED から開いたシートが ORIGINAL からと同一 | §1 で**経験的に確認**（3 状態、全文一致）。実装 PR で reducer / e2e テストとして固定 |
| AC-P2 | FAILED カードの不漏えい | 未実装のため未確認（実装 PR で `research-failed-trial` の走査を維持） |
| AC-P3 | C3 の固定性（3 種の ORIGINAL で byte 同一、禁止語なし） | 文言確定。テストは実装 PR |
| AC-P4 | INV-D7（直接の「なし」を出さない） | C3 の文言と C1 の既存文言に該当表現なし（目視）。テストは実装 PR |
| AC-P5 | 見送り候補（C2・C4・C5）の否定テスト | 実装 PR |
| AC-P6 | 他画面の byte 同一 | 実装 PR（FAILED と標的なし ORIGINAL 以外は不変） |
| AC-B1 | FAILED のヒントは `handleRetryWithHint` と同一動作 | §1 で経路の同値を確認。実装は既存関数の再利用のみ |
| AC-B2 | 在庫・Pitz・保存・Dex・Notebook・採点に変更なし | 設計上、新しい dispatch・保存項目なし |

**C3 の禁止語の確認:** 文言は禁止語 `あと|おしい|近い|遠い|惜|合って|できて|ほぼ|\d+(種|個|件|%)` を含まない。「見ながら」「考えてみよう」は判定の約束ではなく、ヒントを手がかりにする表現。

## 5. 未確認事項（これが解消されるまで runtime を実装しない）

1. **製品内で FAILED の「ヒントを見る」を実際にクリックした動作**（ボタンがまだ無い。§1 は同じ 2 つの dispatch を既存 UI で再現した等価確認）。
2. **WebKit・実機 iPhone での見え方**（§3 は Chromium）。#554 の実機チェックリストの項目 C（dock）と同じ画面。
3. **本番 DOM golden への影響**（FAILED カードと標的なし ORIGINAL の DOM が変わる。再基準化の要否は実装 PR で確定）。
4. **既存テストの更新範囲**: `ResultPanel.research.test.tsx:68`（旧注記の文言を固定）、`ResultPanel.researchFailed.test.tsx`、`ResultPanel.test.tsx`（FAILED の分岐）、e2e `research-failed-trial` / `completion-gate-partial-quantity` / `cut-skip-failed-bake` / `free-cooking-phase3-2` / `result-1screen-2.0`（FAILED カードのボタン構成・レイアウトを見るもの）。全件を実際に実行して確認したものではない。
5. **Research で研究対象が開始時に無効だった場合**の FAILED → ヒントの挙動（シートは CHOOSE_RESEARCH 等になる可能性。本 Gate では未確認）。
6. **ヒントの購入操作**（シート内の「たずねる」）を FAILED 経由で行ったときの会計（既存仕様で変わらない見込みだが未確認）。

## 6. 既存 PR との HOT ファイル競合（確認）

実装予定のファイル: `ResultPanel.tsx`、`originalResultCopy.ts`、関連テスト（`GameScreen.tsx`・`App.tsx`・`App.css` は不要の見込み）。open PR の変更ファイル（merge-base からの差分）で重なるもの:

| PR | 状態 | 重なるファイル |
|---|---|---|
| #468（モッツァレラ溶解 Pilot） | open（2026-10-12 以降更新なし） | `ResultPanel.tsx`、`researchUxCopy.ts`、`ResultPanel.researchFailed.test.tsx`、`ResultPanel.test.tsx`、`originalResultCopy.test.ts` ほか |
| #478（トレイドラッグ統一） | Draft | `ResultPanel.tsx`、`ResultPanel.test.tsx`、`originalResultCopy.test.ts` ほか |
| #540（グランマ） | Draft・HOLD | `ResultPanel.tsx`、`originalResultCopy.test.ts` ほか |
| #581（四角天板 UX） | open（HOLD 扱い） | `originalResultCopy.test.ts`（`App.tsx`・`GameScreen.tsx`・`App.css` は本件では触れない） |
| #674（Dex 生エントリ） | open | 重ならない（`persistence.ts` のみ） |
| #673 | merged | — |

方針: Draft / HOLD の PR は先に merge される予定がなく、実装側が最新 main を前提に進め、重なった場合は古い側が追従する（SESSION-OPERATIONS §1）。#468 は Draft でなく古い open PR で、`ResultPanel.tsx` を触る。**実装の着手前に #468 の扱い（merge 予定・失効・クローズ）を Owner に確認する**（本 Gate の質問）。

## 7. 判定

**技術的には実装可能と判断する（GO 候補）。ただし実装の開始は Owner の明示的な指示を要する。** 根拠: C1 は既存の部品と動作だけで構成でき（新しい action・CSS・reducer 変更なし）、FAILED と ORIGINAL でシートが同一であることを実画面で確認し、レイアウト予算は最悪の画面でも 27.8px 残る。C3 は高さを減らす。**未確認事項（§5）は実装 PR の受け入れ条件に入れる**。

## 8. Owner への質問（残る判断）

1. 実装を開始してよいか（本 Gate を承認するか）。
2. #468 の扱い（`ResultPanel.tsx` が重なる古い open PR）。
3. HV の動画・スクリーンショットの範囲（設計 Gate §7.4 のとおりでよいか）。
