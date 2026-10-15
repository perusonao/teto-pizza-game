# Issue #486 — Canvas モッツァレラ本番採用 Gate・段階的切替設計

- 種別: **docs only**（コード・テスト・CSS・保存・採点・レシピ・経済・進行・焼成・CUT 幾何は変更なし）
- 監査基準: `main` = `cbf3e37`（#485 squash）。本書は本番有効化を **しない**。本番既定化・merge は Owner 承認が必要。
- 方針: 既存の #421 S1〜S2-B3a の Result・Owner HV を再利用し、重複測定はしない。本書で新規に確認したのは §2 の「今回再確認」欄のみ。

## 1. Fresh Audit（重複・競合）

| 項目 | 結果 |
|---|---|
| 同一スコープの Issue / PR | **なし**。「Canvas モッツァレラ 本番」で検索して #486 のみ。重複作成・実装はしない |
| #485 | merged（`cbf3e37`）。Preview/DEV 限定、本番既定は M1 |
| #468（CSS 方式 Pilot、M1 `d1ff57f`） | open・HOLD。Owner HV「判断できない」。同じ `PizzaStage.tsx` / `App.css` を編集。**base が古い（`41efe27`）。本件の本番採用が決まれば #468 は close 推奨（Owner 判断）。merge すると CSS 方式が Canvas の fallback と二重になる** |
| #34（Issue #32 Phase 1） | open・古い土台。`.pizza-cheese--mozzarella` の規則を編集。Canvas 本番化の PR と hunk 競合しうる（Canvas 側は `.pizza-cheese-canvas` を足すのみで、M1 規則は触らない設計なので実害は #34 側の rebase） |
| #421 の残スコープ | モッツァレラ形状（#485 で Preview 達成）。ソース／クラストの焼成表現は **別スコープ**（A 系統保留項目）。本書の対象外 |
| #467（古い WebView / LINE） | 低優先度で保留。**Canvas は SVG filter・疑似要素・mix-blend-mode を使わないため #467 の疑いとは別軸**だが、`getContext` 不可環境の M1 fallback は実装・単体テスト済み |

## 2. ビルド境界・fallback・クエリ

| 項目 | 結論 | 根拠 |
|---|---|---|
| Preview/DEV と production の境界 | **安全** | `CHEESE_CANVAS_ALLOWED = DEV \|\| VITE_PREVIEW_MODE`（静的）。`cheeseRenderMode.ts` も同条件。**今回再確認**: `npm run build`（`VITE_PREVIEW_MODE` なし）後、`dist/assets/*.js` に `cheesePx` / `pizza-cheese-canvas` / `renderCheesePool` = **0 件**。CSS に `.pizza-cheese-canvas` 規則 1 つのみ残る（未使用で無害） |
| URL クエリの扱い | **本番の既定化には不適**。読み込み時 1 回のみ・Preview/DEV 限定。ホーム画面起動・クエリ無し URL・遷移で M1 に戻る（S2-B2 HV FAIL の一因候補）。本番採用にはクエリ以外の切替機構が必要（§4） |
| `getContext("2d")` 不可 | **fallback 済み**: `canvas2dAvailable()` が false、または描画が throw → M1 piece に置換（単体テスト 7 件。**今回再確認**: cheesePool / CheesePoolCanvas / preview の 118 tests pass） |
| **未カバー: 無音の空描画** | **要対策（本番化の Gate 条件 G1）**。`bitmapOf()` は `WeakMap` にオフスクリーン canvas を保持する。iOS Safari はメモリ逼迫時に canvas の backing store を破棄しうる。その場合 `drawImage` は **例外を出さず透明を描く** ため、`drawFailed` fallback が働かず「透明なチーズ」になる（不変条件違反）。対策案: ① `visibilitychange` / `pageshow` で再描画、② 描画直後に 1 画素読み戻して alpha=0 なら `drawFailed`（コスト小・64×64）、③ ビットマップを `WeakMap` ではなく都度 `putImageData` する（キャッシュ縮小）。①+②推奨。実機再現手段が無いため、**単体テストで「読み戻し alpha=0 → fallback」を固定**する |
| reduced motion | 実装・単体テスト済み（一過性オーバーシュート省略、完成形は同一）。OS 設定で切替のため追加 UI 不要 |
| 他の表示面 | Result 画面のステージ・CUT ピースは `PizzaStage` 経由で Canvas。**ただし Reference / サムネイル / トレイ / 図鑑 / `PizzaVisualPieces` 経由の表示は M1 のまま**。Canvas 既定化すると「ステージの溶けたチーズ」と「図鑑・サムネイルの白い楕円」が併存する。**初期段階では許容（スコープ外）として Owner 判断、全面適用は別 Issue** |

## 3. 検証状況（再利用 / 未実施）

| 項目 | 状態 | 出典 |
|---|---|---|
| c64 / c96、焼成前後、CUT、RESULT、390×844 / 360×800 | 検証済み（Chromium） | #485 本文、S2-B / S2-B2 Result、`docs/reports/screenshots/cheese-pool-s2b-421/` |
| 焼成中の性能（M1 比 +7.8% 1× / +2.0% 4×） | 測定済み（Chromium ソフトウェア描画） | S2-B2 Result |
| CUT〜RESULT +30% | 交互測定で再現せず（原因未特定） | S2-B2 Result |
| 複数ピース・縁寄り・密集 | 検証済み。密集では同色で塊に見える（融合 S3 は未着手） | S2-B Result §3.1 |
| iPhone Safari 実機 | **S2-B3a PASS**（`PREVIEW・7a4f366`）。ただし **クエリ有効だったかの機械的確認手段なし** | #421 コメント |
| WebKit CI | #485 の CI で確認（assertion）。**画像の目視は未実施**（artifact ホスト 403） | #468 / #421 履歴 |
| 実機の性能・低スペック Android・古い WebView | **未測定** | — |
| 今回の新規 e2e / スクショ再取得 | **未実施**（docs-only の範囲。既存結果が S2-B3a の HEAD に対するものであり、再取得は重複作業と判断） | — |

**注意**: 上表の視覚・性能結果は S2-B3a 時点のもので、本書では再測定していない。実装 PR（§5）では exact HEAD で必ず再取得する。

## 4. 本番採用の推奨案

| 案 | 内容 | 評価 |
|---|---|---|
| A. M1 維持 | 本番は現状のまま | 安全だが #421 の目的（白い円問題）が本番で未解決。HV PASS 済みの成果が活きない |
| **B. 段階的 opt-in（推奨）** | Canvas 経路を本番ビルドに含めるが **既定 OFF**。Owner/テスターのみ永続 opt-in（Hint 5.0 の `hint5PreviewOptIn` 方式を踏襲: 専用 localStorage キー、保存データとは別、Full Reset で消えない）。実機で本番 URL 上で HV → 既定 ON 化は別 PR | 本番既定を変えずに「クエリ依存」問題を解消でき、rollback が即時（キー削除／定数 OFF）。先例（Hint 5.0 H5-5/H5-6）あり |
| C. 即 Canvas 既定化 | 既定 ON | G1（無音空描画）・実機性能・他表示面の整合が未解決のため **非推奨** |

**推奨: B。** 手順:
1. **PR-1（実装・本番 dark）**: ① G1 対策、② 切替を `cheeseRenderMode` に追加（本番では opt-in キー `teto-pizza-cheese-canvas`、既定 M1。`?cheese=` クエリは Preview/DEV のみ従来通り）、③ 定数 `CHEESE_CANVAS_PRODUCTION_ENABLED = false`（これを true にするまで本番バンドルは opt-in 経路を持つが誰も有効化できない）、④ 本番バンドル gate テスト（既定で M1 のみ描画されることを pin。`previewIsolation.gate.test.ts` と同型）。保存スキーマ・採点・レシピ・経済は無変更。
2. **Owner HV（本番ビルド相当の Preview、opt-in ON）**: iPhone Safari。チーズが透明でないこと、RESULT/CUT、ホーム画面起動での opt-in 保持。
3. **PR-2（既定化）**: 定数／既定値を ON。Owner 承認後のみ。M1 fallback と kill 手段（キー `0` で M1）を保持。

## 5. リスクと rollback 条件

| # | リスク | 重大度 | 緩和 |
|---|---|---|---|
| R1 | iOS で canvas backing store 破棄 → 透明チーズ | 高 | G1（①再描画 ②読み戻し検査 + テスト固定） |
| R2 | 低スペック端末で CUT〜RESULT が重い（Node/Chromium の推定のみ） | 中 | 64×64 既定、メモ共有 `drawImage`。実機計測を PR-1 の Gate に追加 |
| R3 | 密集配置で塊に見える・個数が読めにくい | 中 | 既知（S3 融合は別スコープ）。許容可否を Owner が HV で判断 |
| R4 | Result/図鑑/サムネイルで M1 と不整合 | 中 | 初期段階は許容。全面適用は別 Issue |
| R5 | #468 / #34 との hunk 競合 | 低 | #468 は Owner 判断で close、#34 は rebase |
| R6 | opt-in の保持失敗（storage 不可）で M1 に戻る | 低 | 設計上 M1 に倒れるのみ（安全側） |

**rollback 条件（いずれか 1 つで即 M1 へ戻す／既定化を取り下げ）**
- 実機でチーズが透明・欠落・点滅する（1 件でも）
- ゲーム操作（配置・焼成・CUT・RESULT）に引っかかりが出る、または p95 フレーム時間が M1 比 +10% 超（同一端末の交互測定）
- 横スクロール・ステージサイズ変化・CUT の欠け
- 採点・保存・経済・進行に差分が出る（出たら即停止。設計上ゼロであるべき）
- WebKit CI の恒常的失敗が Canvas 起因と判明
- rollback 手段: ① opt-in キー/既定値を OFF（コード 1 行の PR、または Owner 端末のキー削除）、② 最悪 revert。**保存データ変更が無いので data 移行は不要**。

## 6. 次の実装タスク（明確化）

**T1（PR-1、最小差分）**: §4-1 の 4 点。変更ファイル見込み: `CheesePoolCanvas.tsx`（G1）、`cheeseRenderMode.ts`（opt-in 解決）、`PizzaStage.tsx`（`CHEESE_CANVAS_ALLOWED` を「Preview/DEV または本番 opt-in」に）、新規テスト 3 本。検証: Vitest focused → `tsc -b` / `oxlint` / `npm run build` → Chromium 390×844・360×800（既存 spec 再利用）→ WebKit は CI の自動実行のみ（**手動 rerun 禁止**）→ Codex review → Owner iPhone HV。HV 動画（390×844）は Policy に従い Owner へ直接送付し repo にはコミットしない。スクリーンショットは `docs/reports/screenshots/canvas-mozzarella-prod-486/`。
**T2（Owner 判断待ち）**: #468 の扱い、#34 の rebase/close、Reference/サムネイルへの適用範囲。
**T3（PR-2）**: 既定 ON。Owner 承認後。

## 7. Owner への確認事項（本書では実行しない）

1. 推奨案 B（本番 opt-in 先行 → 既定化は別 PR）で進めてよいか。
2. #468 を close してよいか。
3. 初期段階で Reference／図鑑／サムネイルが M1 のままで許容か。
4. PR-1 の実機 HV は本番ビルド相当の Preview で良いか。
