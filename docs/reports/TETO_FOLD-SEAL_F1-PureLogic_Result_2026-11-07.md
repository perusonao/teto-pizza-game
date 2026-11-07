# FOLD＋SEAL F1 純粋ロジック Result Report（Refs #773）

2026-11-07、基準 main `06cfc06`（不変）、branch `claude/teto-pizza-t5-t6-r9qup3`（docs HEAD `4a5bec8` の上に別コミット）。
根拠: Owner 指示 #773 コメント 6703657422／決定 6703653150。実装専用 claim: コメント 6703665181（`src/logic/foldSeal/**` ＋ `TETO_FOLD-SEAL_*` ＋ `TETO_COOKING-OP_T6_*`）。
**PR・merge・Production ON・共有 Preview 更新・UI マウントなし。**

## 範囲

- 追加のみ（全て新規ファイル）: `src/logic/foldSeal/` の 5 ソースと 3 テスト、`index.ts`、本書。
- **変更なし**: `src/main.tsx`・`src/App.tsx`・reducer・`PizzaStage`・調理 runtime・CSS・golden・e2e・既存の全ファイル。どこからも import されない（未配線、テストで固定）。
- 保存・採点・Dex・在庫・Research・ヒントに触れない。`calzone` のレシピ・食材追加なし、重複 Gate の例外なし（Jaccard 0.5 の件は Owner 判断待ちのまま）。

## 実装

| ファイル | 内容 |
|---|---|
| `foldSealConstants.ts` | 暫定値の一覧（`FOLD_D_MIN = 14`、`FOLD_GRAB_MARGIN = 6`、`FOLD_THETA_COMMIT = 0.88π`、`SEAM_BINS = 36`、`SEAM_BAND = 8`、`SEAL_MAX_INTERP = π/2`、ボタン 4 段、`OPEN_RUN_MIN_BINS = 3`、UI 用の時間）。全て HV 前の初期値 |
| `foldSealGeometry.ts` | 注入する輪郭のインターフェース、`circleGeometry`、余白つきの内外判定 |
| `foldSealDoughShape.ts` | 手で伸ばした生地（8 点の `DoughShape`）を輪郭に変換するアダプタ。既存の純粋関数 `doughShapeRadiusAtAngle` の読み取り利用のみ |
| `foldSealSeam.ts` | 縁を西→東の 36 ビンに分ける純粋関数（角度→ビン、帯判定、補間用の埋め、被覆率、未封止の run） |
| `foldSealMachine.ts` | 状態機械本体。`idle → folding → folded ⇄ sealing`。イベント 13 種、`foldSealReduce`、導出（`foldAngleFromFinger`・`sealCoverage`・`sealOpenRuns`・`stepIsComplete`）、描画の唯一の出口 `foldSealVisual`、不変条件チェック |
| `index.ts` | 公開口 |

設計との対応（`TETO_FOLD-SEAL_Design-Acceptance_2026-11-07.md`）:

- 水平折り線・上半分を引き下ろし・指の y が角度を直接決める（§3.2）。**離した時に確定**、未満はバネ戻り、失敗状態なし。
- 封止は同一画面の副段階（`sealing`）。縁は 36 ビン、帯内を通ったビンのみ封止、連続する帯内サンプルは補間、離れすぎた 2 点は補間しない、帯外に出たら一筆を切る。進捗は離す・キャンセルでも保持。
- ジェスチャとボタン（折る／とじる 4 段）は**同じ状態機械・同じイベント**。ボタンで折った状態は、ドラッグで折った状態と `foldedVia` 以外が等しく、ボタン 4 回は全周ドラッグとビン単位で一致（テストで固定）。
- やり直し: `REOPEN`（折り全体）、`SEAL_RESET`（封止のみ）。中断: `CANCEL`（折りの最中は戻る、封止の最中は進捗保持）。前段の変更: `INVALIDATE`（別の revision で全破棄、古い pointer イベントは復活させない）。
- 封止不足は `foldSealVisual` の `gaps`（目に見える run のみ）に出るだけで、`stepIsComplete` を妨げない。出力には得点・フラグ・id を持たない。

設計書からの差分（1 点）: `stepIsComplete` は設計書の `phase === "folded"` ではなく **`folded` または `sealing`**（折りが確定済み）。封止の一筆の最中に先へ進むことを妨げないため。

## 検証

| 項目 | 結果 |
|---|---|
| 対象 Vitest `src/logic/foldSeal` | **3 ファイル・71 テスト 全て pass** |
| 型チェック `npx tsc -b` | **エラー 0** |
| lint `npx oxlint` | foldSeal 配下の警告・エラー **0**（既存の他ファイルの警告は変更なし） |
| 全 Vitest | **626 ファイル pass／1 skipped（627）、11626 テスト pass／13 skipped／2 todo、失敗 0**（所要 約 23 分。既存テストは変更なし） |

テストの内容:
- 幾何: 角度式の端点・単調性・クランプ・非有限入力、コミット閾値の境界、`D_MIN`・グラブ余白の境界、手伸ばし輪郭への追従。
- 折り: ドラッグ／ボタンの収束、離した時のみ確定、可逆、横成分の無視、2 本目の指の無視、範囲外・非有限入力の無視。
- 封止: 帯の境界、西→東の番号、全周で被覆率 1、双方向の補間、不連続は補間しない、帯外で一筆を切る、離す／キャンセルで進捗保持、ボタン 4 段の一致、ボタンとの併用で単調。
- 部分封止: 全未封止でも完了、run の列挙と可視ギャップの違い、スキップ、描画出力のキー固定。
- 中断・再試行: RESET／REOPEN／CANCEL／INVALIDATE（全 phase から、同一・非整数 revision は無変化）、古いイベントの無視。
- 冪等性・純粋性: 終端イベントの 2 回適用、凍結入力で例外なし、再生の決定性、未知イベントの無視。
- ファズ: 2000 系列 × 60 イベント（非有限値を含む）で全不変条件が維持され、被覆率はリセット系以外で減らない。
- 構造: ソースの import は兄弟と `../doughShape` のみ。DOM・時計・乱数・保存・ネットワークを使わない。得点・経済・保存・発見・カタログの語を含まない。**ゲームの他のファイルが `foldSeal` を import していない**。

## 残る課題・ゲート

- 数値は全て暫定で未検証。実機の親指の可動域・手の影・端スワイプは F3 の HV まで不明。
- F2（Preview/DEV 限定の実験画面）は未着手。マウントには `src/main.tsx`／`src/App.tsx`（#738・#746 と HOT 共有）が必要で、Owner の別指示と merge 順の確認が前提。
- F4（統合）、円形採点・CUT との整合（G6）、描画、`calzone` の構成（原典・重複監査、Jaccard 0.5）は未決・HOLD。
- 本ブランチは設計 docs と同居（別コミット）。実装だけを別ブランチへ移す必要があれば cherry-pick 可能。
- テストは Vitest（jsdom 環境の既存設定）で実行。WebKit・実機は未実施。
