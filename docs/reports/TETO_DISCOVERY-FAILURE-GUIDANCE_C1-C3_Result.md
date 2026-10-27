# 発見失敗後の案内 C1 / C3 — Result Report（Issue #676、Final Gate で停止）

base `main` `9761d03`（#673 merge 後）。Owner 実装 GO（2026-10-27）。設計: `TETO_DISCOVERY-FAILURE-GUIDANCE_DESIGN-GATE_2026-10-26.md`、実装前 Gate: `TETO_DISCOVERY-FAILURE-GUIDANCE_C1-C3_PRE-IMPLEMENTATION-GATE_2026-10-27.md`（ブランチ `claude/teto-pizza-improvements-research-mxq1wu-b`、main には未 merge）。
**merge・deploy は Owner の追加承認まで行わない。**

## 変更（製品コード 2 ファイル + 限定的な CSS 1 ルール）

| ファイル | 内容 |
|---|---|
| `src/state/originalResultCopy.ts` | 定数 `TARGETLESS_ORIGINAL_NOTE` =「ヒントを見ながら、次に試す材料を考えてみよう。」（C3、Owner 確定） |
| `src/components/ResultPanel.tsx` | ① 標的なし ORIGINAL の注記を上の定数に置き換え（直書きの旧文を削除）。② **bake-FAILED カードに既存の `hintRow(null, true)` を追加**（C1）。条件は ORIGINAL と同じ `freeCook` かつ `onShowHint` あり。位置は `.result-panel__headline` の直後・Pitz 概要の前 |

**変更していない:** `GameScreen.tsx`、`App.tsx`、reducer、保存、採点、経済、`handleRetryWithHint`（既存のまま再利用。`onShowHint` は既に `freeCook` のときだけ渡される）。新しい action・文言（C3 の 1 文以外）・CSS はない。見送りの C2・C4・C5・C6 は実装していない。

## Contract 2.1 / INV-D7 / AC-P1〜P6

| AC | 状態 | 証跡 |
|---|---|---|
| AC-P1 FAILED から開いたシートが ORIGINAL からと同一 | **満たす** | reducer: `gameReducer.failedHint676.test.ts`（標的なし・Research の 2 状態で `hintSheetView`・session・フラグが一致）。e2e: `failed-hint-676.spec.ts`（本番で到達できる新規保存・Research で、FAILED 後のシート全文 = ORIGINAL 後のシート全文） |
| AC-P2 FAILED カードの不漏えい | 満たす | 部品テスト（数字・あと・おしい・近い、レシピ名・id、`data-kind` 等の属性、matcher 結果・near-miss 行によらず byte 同一）、e2e の走査 |
| AC-P3 C3 の固定性 | 満たす | ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH が byte 同一、禁止語・数字・材料名を含まない |
| AC-P4 INV-D7 | 満たす | 「なし」「不要」を含まない（部品テスト・e2e） |
| AC-P5 見送り候補の否定 | 満たす | 標的なしに試作ノート・図鑑ボタンがない、FAILED に焼き助言がない |
| AC-P6 他画面の不変 | 満たす | Research ORIGINAL の注記、ALREADY_DISCOVERED に C3 の文がない、Guided / Lunch Rush / Dinner（`freeCook` が false）に行がない。既存の全テスト（下記）が無変更で通る（更新した 2 件は意図的） |
| AC-L1〜L4 レイアウト | 満たす | e2e（390×844 / 360×800）: 縦スクロール・横オーバーフローなし、ヒント行がボタン列と重ならず、**Research FAILED でも上の余白 16px 以上**（実測 360×800: 73.8 → 27.8px）、C3 は注記が短くなり +15px |
| AC-B1/B2 | 満たす | 既存の再利用のみ。Pitz・Dex・保存・在庫に変更なし（reducer テスト） |

## 更新した既存テスト（意図的・2 件）

- `ResultPanel.research.test.tsx`: 標的なし ORIGINAL の注記が旧文から新文へ。
- `ResultPanel.nearMiss.test.tsx`:「FAILED: no near-miss, no hint row」を「FAILED: never a near-miss line（hint 行は CTA のみ・文言なし）」へ。FAILED にヒント行が出るのが新仕様。near-miss の文が出ないことは維持。

## 検証

| 項目 | 結果 |
|---|---|
| `tsc -b` | 通過 |
| `npm run build` | 通過（chunk size 警告は既存） |
| `oxlint` | エラーなし（既存の警告 3 件のみ） |
| **Vitest 全体** | **532 files passed / 1 skipped、9,832 tests passed / 13 skipped / 4 todo、0 failed**（本 PR の新規: 部品 14 + reducer 6 = 20 件を含む）。本番 DOM golden の再基準化は不要（既存 golden が無変更で通る） |
| **新規 e2e**（`e2e/failed-hint-676.spec.ts`、Chromium 390×844 / 360×800） | **6/6 passed**（標的なし FAILED、Research FAILED、標的なし ORIGINAL × 2 viewport） |
| 回帰 e2e（Chromium 390×844 / 360×800、関連 16 spec: research-failed-trial、discovery-near-miss-result、discovery3-oracle-neutralization、free-cooking-phase3-2、completion-gate-partial-quantity、cut-skip-failed-bake、result-1screen-2.0、discovery-research-result / -rows、research-ux-phase1、discovery-recipe-discovery-s0、discovery-hint-sheet、finish-flow-find、lunch-rush-result-ranking-phase4、lunch-rush-material-shortage、home-research-entry-parity） | **109 passed / 17 skipped（既存の viewport 限定 skip）/ 0 failed** |
| **WebKit 390×844 / 360×800** | **ローカルでは WebKit を取得できないため未実行。CI（E2E WebKit）の結果を正とする。** 本 PR の CI 結果はこの Result 作成時点で未確認 |
| 実機 iPhone Safari | **未実施**（Owner の HV。PASS を主張しない） |

ローカルの注意: Playwright の同梱 Chromium とバージョンが異なるため、事前インストール版 `/opt/pw-browsers/chromium` を指定する一時的な設定ファイルで実行した（コミットしていない）。

### 追補（Owner 判断 2026-10-27）: 重複 PR #678 からの移植と、AC-L2 の WebKit 不足の修正

- **WebKit 360×800 の Research FAILED で、本 PR 自身の e2e（AC-L2: 余白 16px 以上）が 14px で失敗**（Chromium は 27.8px）。**閾値は緩和しない。** 余白を増やすため、Free Cook の FAILED カード（hint 行を持つもの）にだけ修飾クラス `result-panel--failed-hint` を付け、そのカードの flex gap を 10px → 6px にした（`App.css` に 1 ルール、隙間 1 つにつき −4px、Research カードは 4 つで +16px）。Guided / Lunch Rush / Dinner の FAILED カード（`freeCook` が false か `onShowHint` なし）は修飾クラスなしで不変。Chromium の実測（同じ e2e の gap）: Research FAILED 360×800 は 27.8 → **43.8px**、390×844 は 71.8 → 87.8px、標的なし FAILED は 249 → 261（390）、205 → 217（360）。WebKit は 14 → 約 30px の見込み（**CI の WebKit で確認する**）。
- **#678 から移植:** ① 非 Free Cook の ORIGINAL カードは従来の注記のまま（新文は Free Cook のみ。`freeCook ? TARGETLESS_ORIGINAL_NOTE : 旧文`）。② PASS カード（NEW_DISCOVERY）に hint 行と新文が出ない否定テスト。③ 修飾クラスが Free Cook + 手順あり の FAILED カードにだけ付くテスト。新規の部品テストは 4 件追加（部品 18 + reducer 6 = 24 件。④ #678 の「失敗理由で hint 行が変わらない」テストも移植）。
- 検証（追補後）: フル Vitest 9,836 passed / 0 failed、`tsc -b`・build 通過、Chromium e2e（`failed-hint-676`）6/6。

## Human Verification（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`）

- 前後スクリーンショット（committed）: `docs/reports/screenshots/failed-hint-676/`。`before-*` は main `9761d03` の同じ画面（Research FAILED、標的なし FAILED、標的なし ORIGINAL × 390 / 360。調査時の撮影）、`*-c1-*` / `*-c3-*` は本 PR（FAILED カード、FAILED から開いたシート、標的なし ORIGINAL）。
- 動画（**repo には含めず Owner へ直接提出**）:

| 動画 | viewport | 長さ | サイズ | codec | 検証 |
|---|---|---|---|---|---|
| `failed-hint-676-hv-390x844.mp4` | 390×844 | 37.4 s | 0.65 MB | H.264 | ffprobe・フレーム確認（Research のラウンド）。**Owner の目視確認は未了** |

内容: 標的なし FAILED →「💡 ヒントを見る」→ シートが開く → 閉じる → Research FAILED → 同様 → 標的なし ORIGINAL（ヒント行と新しい注記）。

## 残りのリスク・Owner 判断

- WebKit（CI）と実機 iPhone の見え方は未確認（ヒントボタンの高さは既存クラスのまま 36px。ORIGINAL と同一）。
- C1 のボタンは「もう一度 + ヒント」を起動するため、FAILED の「もう一度試す」と並ぶ（ORIGINAL と同じ構成）。
- 新規保存でシートに既存の Margherita 導入ヒント（「ソースは…」「材料は全部で…」）が出るのは既存仕様（C1 が新しく出す情報ではない）。
- **Final Gate: merge は Owner の承認後。**
