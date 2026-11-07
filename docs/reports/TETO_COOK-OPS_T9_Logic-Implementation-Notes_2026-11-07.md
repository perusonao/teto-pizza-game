# T9 — D-A′・C-A′ 純粋ロジックの実装メモ（未配線・UI なし・本番 OFF）

Status: **新規ファイルのみ。既存ファイル（ゲーム本体・reducer・PizzaStage・App・main・CSS・golden・既存 docs・既存テスト）は未変更。共有 Preview 未更新。PR・merge・Production ON なし。実機 HV は Owner 担当で 0 PASS。Chromium／単体テストの結果は iPhone Safari の PASS ではない。**
Branch `claude/teto-pizza-t7-t9-audit-12by6f` / 基準 `main` `06cfc06` / Issue #784 / claim: #784 コメント 6705411933（`src/logic/doughAlt/**`・`src/logic/cutAlt/**`・`src/logic/sauceAlt/**`・`docs/reports/TETO_COOK-OPS_T9_*`）。
根拠: Owner 決定 #784 コメント 6705390298（D-A′: Δ=8・固定の押下上限なし・完成後の入力は no-op。C-A′: 切った後もアーム維持・縁スナップなし・明示の「切る」・**アーム前のタップは no-op（#418）**。キーボードのカーソル方式は別設計。いずれも新規ファイルのみ）。
設計: `TETO_COOK-OPS_T9_Design-Update_DAprime-CAprime_2026-11-07.md`。

## 1. 追加したファイル

| ファイル | 内容 |
|---|---|
| `src/logic/doughAlt/doughAltMachine.ts` | D-A′ の状態機械（純粋）。依存は `../doughShape`・`../pizzaCoordinates` のみ |
| `src/logic/doughAlt/doughAltMachine.test.ts` | 20 テスト |
| `src/logic/doughAlt/doughAlt.architecture.test.ts` | 5 テスト（未配線の固定） |
| `src/logic/doughAlt/index.ts` | 再エクスポート |
| `src/logic/cutAlt/cutAltMachine.ts` | C-A′ の状態機械（純粋）。依存は `../pizzaCoordinates`・`../cut/trace`・`../cut/types` のみ |
| `src/logic/cutAlt/cutAltMachine.test.ts` | 21 テスト |
| `src/logic/cutAlt/cutAlt.architecture.test.ts` | 5 テスト（未配線の固定） |
| `src/logic/cutAlt/index.ts` | 再エクスポート |
| `src/logic/sauceAlt/saStampGrid.measure.test.ts` | S-A M1 の測定（9 テスト）。結果は `TETO_COOK-OPS_T9_SA-M1-Grid-Result_2026-11-07.md` |
| `docs/reports/TETO_COOK-OPS_T9_CUT-Stage-Dimensions_2026-11-07.md` | CUT 工程の寸法（docs-only） |
| `docs/reports/TETO_COOK-OPS_T9_SA-M1-Grid-Result_2026-11-07.md` | S-A M1 の結果 |
| 本書 | 実装メモ |

**既存ファイルの変更は 0**（`git diff origin/main` の変更ファイルは上表の新規ファイルのみ）。

## 2. D-A′ の実装（設計との対応）

| 設計 | 実装 |
|---|---|
| Δ=8（Owner 暫定） | `DOUGH_ALT_STEP = 8` |
| 1 回の押下＝`applyStretchPoint` 1 回（C2） | `stepDoughShape(shape, dir, ±1)`＝選んだ方向の現在半径 ± 8 の点へ `applyStretchPoint`。自然なジェスチャと同じ関数。**テストで 8 方向すべての一致を固定** |
| 方向の巡回 | `DIR_NEXT`／`DIR_PREV`（mod 8）。形は不変 |
| **固定の押下上限なし** | 上限は設けていない。技術上限（半径 58）・下限（10）は `applyStretchPoint` が保証。**限界で変化しない押下は no-op（同じ state を返し、`steps` を数えない）** |
| **完成後の入力は no-op（Owner）** | 完成（平均半径 ≥ 理想の 75%）は**導出値**（`isDoughShapeComplete`）。完成中は `STEP`（＋・−）と `DIR_NEXT`／`DIR_PREV` が**同一 state を返す**（テストで `toBe`）。自然なジェスチャで縮んで未完成に戻れば（`SYNC`）、ボタンは再び有効 |
| 完成までの押下数 | 8 方向を 1 回ずつ巡回して **10 押下**（設計書の計算値と一致。テストで固定） |
| `SYNC`／`CANCEL`／`INVALIDATE` | 設計どおり（`CANCEL` は離散操作のため no-op、`INVALIDATE` は revision が変わったときだけ初期化） |
| 読み上げ | `doughAltStatus`: 方向名（右・右下・下・左下・左・左上・上・右上）、25%刻みの進捗（完成のときだけ 100）、`complete` |
| 色以外の手掛かり（C12） | `doughAltVisual` が `focusDir`／`focusAngle` を返す（強調は形で描く前提） |

不変条件（テストで固定）: 形は常に有効（半径 10〜58）、`steps` は実際に形が変わった押下だけ、入力 state を変更しない（凍結して実行）、同じ入力列は同じ結果（400 押下の疑似乱数列で確認）、不正な `delta`・不明なイベントは同じ state を返し例外を投げない。

## 3. C-A′ の実装（設計との対応）

| 設計 | 実装 |
|---|---|
| **アーム前の POINT は no-op（#418）** | `armed=false` で `POINT` は**同一 state を返す**。任意の座標・NaN・複数回・連続でテスト。`cutAltLine`／`canCommitCutAlt` も null／false |
| 切った後もアーム維持（Owner 暫定） | `commitCutAlt` は 2 点を消して `armed` を維持。**ただし切り数が上限に達した切りでは armed も終了**（設計 §3.2 の「本数上限で自動 DISARM」） |
| 縁スナップなし（Owner 暫定） | 点は**タップした座標のまま**保存（テストで縁付近の小数座標を確認） |
| 明示の「切る」 | 2 回目のタップでは確定しない。確定は `commitCutAlt(state, {linesUsed, limit})` のみ（線を返す） |
| 確定する線 | `buildTracedCutLine([a, b])` と**完全に同一**（スワイプの直線と同じ関数。縁まで延長される）。3 つの代表ペアで `toEqual` |
| 最小長 | `TRACE_MIN_LENGTH`（8）未満の終点は置かず、`hint: "too-short"` を立てる（失敗ではなく案内）。ちょうど 8 は受理（テスト） |
| 生地の外・非有限の座標 | 無視（同一 state） |
| 3 回目のタップ | 終点だけを置き換える。始点の変更は `CLEAR_POINTS`（アームは維持） |
| `CANCEL`（blur／hidden／resize／lost capture） | 点も**アームも**破棄（設計どおり） |
| `INVALIDATE` | revision が変わったときだけ初期化（アーム OFF） |
| 読み上げの語 | `cutAltPhase`（off／need-start／need-end／too-short／ready）と `CUT_ALT_PHASE_TEXT_JA` |
| キーボードのカーソル方式 | **別設計（Owner）**。ただし `POINT` は座標の出所を問わないので、将来カーソルが同じイベントを出せる |

**設計書との差（1 点）**: 設計書の「`COMMIT` イベント」は、reducer のイベントは値（線）を返せないため、**`commitCutAlt(state, ctx)` という別の純粋関数**に分けた（`{ state, line }` を返す）。意味は同じ。設計書の該当節は今回は書き換えていない（既存 docs に当たらない範囲で、ここに記録する）。

## 4. 未配線の固定（architecture テスト）

`doughAlt.architecture.test.ts`／`cutAlt.architecture.test.ts`（既存の `fry.architecture.test.ts` と同じ型）が次を固定する:
- 自分のファイル以外に、名前（`doughAlt`／`cutAlt` 等）を含む**ソースが無い**（何も import していない）。
- reducer・画面・ステージ・App・main が名前を含まない。
- 採点・識別・Discovery・ヒント・署名・保存系のモジュールが名前を含まない。
- 自分のソースの import は許可された純粋ヘルパーのみで、`Date.now`／`performance.now`／DOM／storage／`requestAnimationFrame`／タイマーを使わない。
後続の配線スライス（別承認）が入るときは、`LATER_SLICES` に対象ファイルを足す（意図的なレビュー付きの編集）。

## 5. 検証結果

| 検証 | 結果 |
|---|---|
| 新規 5 ファイル（D-A′ 機械 20＋構造 5、C-A′ 機械 21＋構造 5、S-A M1 測定 9） | **60 テスト全通過**（`npx vitest run src/logic/doughAlt src/logic/cutAlt src/logic/sauceAlt`） |
| 型検査 `npx tsc -b` | エラーなし（測定テストの 1 件を直したあと出力なし） |
| `npx oxlint`（新規 3 ディレクトリ） | 指摘なし |
| 全 Vitest（既存を含む） | 本書作成時点で**実行中**。完了結果は報告に記載（未完了のものは「未確認」） |
| E2E（Playwright）・WebKit CI | **未実行**（ゲーム本体に変更がないため。CI は PR を作っていないので走らない） |
| 実機 iPhone Safari | **未実施（Owner 担当）。PASS 0** |

## 6. 残ること・HOLD

- **配線（UI・reducer・PizzaStage・App）は HOLD**。折りたたみ UI（見出し「別の操作方法を使う」）・キーボード到達とフォーカス・初回の案内は**設計のみ**で、実装の承認はない。
- C-A′ のキーボードのカーソル方式は別設計。
- D-A′ の「完成後 no-op」は Owner 暫定。ただし完成後に「−」で縮める操作を許さない結果、完成後に形を整え直すには自然なジェスチャ（SYNC 経由）が必要になる。**この体験は実機で未確認**。
- #764・#766 を新規操作の統合より先にする方針は変わらない。

## 7. 次の Owner 判断事項

1. D-A′ の「完成後は＋・−とも no-op」で足りるか（完成後に「−」だけは許す案もある）。
2. C-A′ の設計書の差（`COMMIT` を別関数に分けた）の了承。
3. 新規ファイルを PR にまとめる時期（現在は PR なし・ブランチのみ）。**PR 作成は別途の指示を待つ。**
4. キーボードのカーソル方式の設計を次に進めるか。

---
_純粋ロジックのみ。未配線。実機未検証。_
