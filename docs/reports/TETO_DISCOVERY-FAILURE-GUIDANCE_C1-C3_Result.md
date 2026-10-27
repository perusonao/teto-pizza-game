# 発見失敗後の案内 C1 / C3 — Result Report（Issue #676）

Issue #676（claim: https://github.com/perusonao/teto-pizza-game/issues/676#issuecomment-6430847118）。ブランチ `claude/c1c3-discovery-failure-hint`、基準 `main` `9761d030`。**未 merge。共有 Preview・Production・Firebase には触れていない。** Owner 承認（2026-10-27）: C1 と C3 を実装。設計: `TETO_DISCOVERY-FAILURE-GUIDANCE_DESIGN-GATE_2026-10-26.md` / `..._C1-C3_PRE-IMPLEMENTATION-GATE_2026-10-27.md`（別ブランチ `claude/teto-pizza-improvements-research-mxq1wu-b`、docs-only）。

## 1. 何を変えたか

| | 変更 |
|---|---|
| **C1** | Free Cook の **FAILED カード**（Research / 標的なしの両方）に、ORIGINAL カードと同じ既存の行 `hintRow(null, true)` =「💡 ヒントを見る」を追加。位置は失敗理由の直後、Pitz サマリーの前。クリックは既存の `onShowHint`（= `handleRetryWithHint` = `RETRY_SAME_RECIPE` + `SHOW_HINT`）をそのまま呼ぶ。表示条件は `freeCook` かつ `onShowHint` あり（`onShowHint` は Free Cook のときだけ渡される）。新しい action・reducer・保存項目・CSS・文言はない |
| **C3** | 標的なし Free Cook の ORIGINAL の注記を、固定文「**ヒントを見ながら、次に試す材料を考えてみよう。**」に置き換え（定数 `NO_TARGET_ORIGINAL_NOTE_JA`、`originalResultCopy.ts`）。Research の注記は不変。Free Cook でないカードは従来の注記のまま |

変更した本体ファイルは `ResultPanel.tsx`（+10 行）と `originalResultCopy.ts`（定数 1 つ）のみ。`GameScreen.tsx`・`App.tsx`・`App.css`・reducer・採点・保存形式・Dex・Notebook・Hint 5.0 は変更なし。C2・C4〜C6 は実装していない。

## 2. 契約の維持（Anti-Oracle Contract 2.1 / INV-D7）

- FAILED のヒント行は **CTA のみ**（近さ・距離・個数・Near/Far の行は出さない）。FAILED の種類（生焼け・焦げ・材料なし）で出し分けない（種類の情報にならない）。FAILED カードは hidden recipe・候補・残りを含まない（`ResultPanel.failureGuidance.test.tsx`）。
- 開くヒントシートは直前の試作結果を読まない。ORIGINAL でも FAILED でも同じ入力から同じシート（設計 Gate §1 で 3 状態を実画面で確認）。C1 は新しい情報を出さず、PREPARE の「ヒント」への近道。
- C3 の文言は禁止語（あと・おしい・惜・近い・遠い・合って・できて・ほぼ・個数/件数/%・「ありません」「なし」）を含まず、3 種の ORIGINAL（ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH）で DOM が byte 同一。試作ノート（C2）への言及もない。

## 3. 検証

| 項目 | 結果 |
|---|---|
| 新規テスト | `ResultPanel.failureGuidance.test.tsx`（14 件: C1 の表示・クリック・位置・非表示条件・種類で変わらない・不漏えい、C3 の固定文・3 種同一・禁止語・Research/非 Free Cook の不変、C2/C4/C5 の否定、PASS カードの不変）。`e2e/discovery-failure-guidance.spec.ts`（390×844 と 360×800 各 3 本） |
| 更新した既存テスト | `ResultPanel.research.test.tsx`（標的なしの注記の期待文）、`ResultPanel.nearMiss.test.tsx`（「FAILED にヒント行なし」→「FAILED は近さの行なし・CTA のみ、Guided / ハンドラなしは行なし」。近さの行が出ないことの assertion は維持） |
| フル Vitest | **532 files、9,827 passed、0 failed** |
| 型・lint・build | `tsc -b` 通過、`oxlint` エラーなし、`npm run build` 通過 |
| E2E（Chromium） | 新規 spec 6/6 通過（390×844、360×800）。FAILED のヒントボタンが操作ボタン列と重ならない（4px 以上上）、横オーバーフローなし、ページ縦スクロール追加なし、ボタン高さ 32px 以上、クリックでヒントシートが開く。標的なし ORIGINAL の注記が新文で、旧文が残らない。CI の WebKit は PR で確認 |
| 余白（設計 Gate AC-L2） | Research FAILED（最も詰まる画面）360×800 でボタン列との間に余白あり、スクロールなし（上のスクリーンショット参照）。ヒントボタンの高さは既存 `.result-near-miss__cta` の 36px（CSS 変更なし） |
| DOM golden | フル Vitest で影響なし（golden の再基準化は不要） |

## 4. Human Verification（`TETO_HUMAN-VERIFICATION-POLICY.md`）

- スクリーンショット（committed）: `docs/reports/screenshots/discovery-failure-guidance-c1c3/`（`before-*` / `after-*`、390×844 と 360×800 の Research FAILED・標的なし FAILED・標的なし ORIGINAL、比較シート `before-after-sheet.png`）。
- 動画（repository に commit しない。Owner へ直接提出）: 390×844 の WebM 3 本（標的なし FAILED → ヒント、Research FAILED → ヒント、標的なし ORIGINAL の新注記）。
- **Owner の実機（iPhone）HV は未実施。** 確認してほしい点: ①FAILED カードの「💡 ヒントを見る」の位置・押しやすさ（Research FAILED の 360 幅で最も詰まる）、②押したときのヒントシートの開き方、③ORIGINAL の新しい注記の読みやすさ。
- WebKit・実機は未確認（設計 Gate §5 の未確認事項 2）。

## 5. 残る未確認事項（設計 Gate §5 のうち）

- 研究対象が開始時に無効だった場合の FAILED → ヒントの挙動: 本実装は既存の `handleRetryWithHint` のままで新しい分岐はないが、この条件の実画面確認はしていない。
- ヒントの購入（シート内「たずねる」）を FAILED 経由で行ったときの会計: 既存仕様で変わらない見込み（新しい dispatch なし）。未実測。

## 6. リスク

1. **merge = 即公開**: 本番に入る UI 変更。Owner の実機 HV と最終承認まで merge しない。
2. ヒントボタンの高さ 36px は ORIGINAL と同じ既存仕様（44px 推奨より小さい）。変える場合は `App.css`（HOT）の別判断。
3. 別セッションの docs claim（設計 Gate、`docs/design/**`・`tools/**`）とファイルは重ならない。
