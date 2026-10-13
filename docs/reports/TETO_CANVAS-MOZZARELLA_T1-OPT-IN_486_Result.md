# Issue #486 T1 — Canvas モッツァレラ 本番 opt-in 基盤（既定 OFF）

設計は PR #487（`TETO_CANVAS-MOZZARELLA_PRODUCTION-GATE_486.md`、案B）。Owner 決定（Issue #486 コメント）: 案B採用 / #468 HOLD 維持 / Reference・図鑑・サムネイルは M1 維持 / 実機 HV は独立した本番ビルド相当 Preview / 共有 Preview #471 は不変。

## 変更（本番既定は M1 のまま）
| 項目 | 内容 |
|---|---|
| G1 対策 | `CheesePoolCanvas`: 描画直後に `getImageData` で読み戻し、alpha が全て 0 なら共有ビットマップを 1 回だけ作り直して再描画 → なお空なら（または読み戻し不可・例外）M1 piece に置換。`visibilitychange`(visible) / `pageshow` でも再描画・再検証。置換後は再描画しない（ループなし） |
| opt-in | `cheeseRenderMode.ts`: キー `teto-pizza-cheese-canvas`（`c64`/`c96` のみ Canvas、`0`・他・未設定・storage 不可は M1）。保存データとは別キー（Full Reset で消えない） |
| 定数 | `CHEESE_CANVAS_PRODUCTION_ENABLED = false`（コミット値）。false の間、本番ビルドに Canvas 経路は入らない |
| Preview/DEV | 従来の `?cheese=c64|c96|m1` が優先（明示 `m1` は保存済み opt-in より強い）。`cheese` クエリが無いときだけ opt-in キーを読む |
| 本番 opt-in のクエリ | `CHEESE_CANVAS_PRODUCTION_ENABLED=true` のときだけ、`?cheese=c64|c96` がキーを保存して有効化、`?cheese=0|m1` で `0` を保存（実機で Inspector 不要）。false の間は本番バンドルに存在しない |
| 不変 | scoring / recipes / save / economy / progression / bake / CUT geometry、`PizzaVisualPieces`・Reference・図鑑・サムネイル |

## テスト
- `CheesePoolCanvas.test.tsx`（12）: 透明読み戻し→再試行 1 回→M1、再構築で復帰、`getImageData` 欠落/例外→M1、`pageshow` 再検証と置換後の非再描画、fallback 無しは置換しない。
- `cheeseRenderMode.test.ts`: 定数 false、キー名、`resolveCheeseOptIn`（c64/c96 のみ Canvas）。
- `cheeseCanvas.bundle.gate.test.ts`（実 vite build）: 本番バンドルに opt-in キー・Canvas 文字列 0 件 / Preview には有る / 定数を in-memory で true にすると本番にも入る（false が効いている証明）。
- `PizzaStage.cheeseCanvas.test.tsx`: キー無し=M1、c64=未カット・6 ピース（CUT/RESULT）で全モッツァレラが Canvas・バジルは不変・構造不変、透明読み戻し／2D 不可=全ピース M1、`0`/他値=M1。
- `e2e/cheese-canvas-optin.spec.ts`（Chromium 390×844・360×800 通過、WebKit は CI）: キー無し/`0`=M1、c64=全 Canvas に画素あり・6 ピース・横スクロール無し・消去後の `pageshow` で再描画。

## 未実施／残リスク
- iOS の実際の backing store 破棄は実機再現手段なし（読み戻し検査を単体・e2e で固定）。実機の性能・低スペック Android・古い WebView は未測定。
- 視覚（色・形）は #421 S2-B3a から不変のため再測定していない。
- 密集配置での塊表現（S3）、他表示面との不整合は設計書 R3/R4 のとおり許容。

## Owner HV 手順（本番ビルド相当 Preview・独立。共有 Preview #471 は変更しない）
1. 本番ビルド相当（`VITE_PREVIEW_MODE` なし）で、HV 専用の使い捨てコミットで `CHEESE_CANVAS_PRODUCTION_ENABLED = true` にしたビルドを独立 Preview に出す（Owner 承認後。この PR には入れない）。
2. iPhone Safari で `https://<独立Preview>/?cheese=c64` を一度開く。`CHEESE_CANVAS_PRODUCTION_ENABLED=true` のビルドでは、このクエリがキー `teto-pizza-cheese-canvas` に `c64` を保存して Canvas を有効にする（以後はクエリ無し・ホーム画面起動でも保持）。`?cheese=0`（または `m1`）で kill switch（`0` を保存）。
3. 確認: 2/6 ピース・CUT〜RESULT・煙あり・チーズが透明でない・ホーム画面起動後も opt-in 保持・アプリ切替で戻った後もチーズが消えない・操作の引っかかり無し。
4. rollback: キー削除または `"0"`、または定数を false に戻す 1 行 PR。
