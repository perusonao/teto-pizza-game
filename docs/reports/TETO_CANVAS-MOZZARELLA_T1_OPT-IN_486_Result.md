# Issue #486 T1 — Canvas モッツァレラ 本番 opt-in（既定 OFF）Result

設計: `TETO_CANVAS-MOZZARELLA_PRODUCTION-GATE_486.md`（推奨案 B）。Owner 方針: 案 B 採用、#468 は HOLD 維持、Reference / 図鑑 / サムネイルは M1 のまま、実機 HV は本番ビルド相当の独立 Preview（共有 Preview #471 は変更しない）。

## 変更
| 領域 | 内容 |
|---|---|
| G1（最優先）`CheesePoolCanvas.tsx` | 描画のたびに可視 canvas を `getImageData` で読み戻し、alpha が全て 0（ブラウザが canvas を破棄）なら、オフスクリーン bitmap を作り直して **1 回だけ**再描画。なお空 / 読み戻しが throw なら M1 piece に置換（既存の `drawFailed` 経路）。`visibilitychange` / `pageshow` で戻った時にも読み戻し、空なら同じ手順 |
| opt-in `cheeseRenderMode.ts` | 専用キー `teto-pizza-cheese-canvas`（`"1"` のみ ON）。`?cheeseCanvas=1` で ON を保存、`?cheeseCanvas=0` でキー削除。**既定 OFF（M1）**。storage 不可・未知の値は M1。ON は Canvas 64×64・既定サイズ。セーブ（`teto-pizza-save-v1`）とは別キーで、採点・保存・経済・進行は読まない |
| `PizzaStage.tsx` | `CHEESE_CANVAS_ALLOWED`（Preview/DEV 限定ゲート）を削除し、`CHEESE_RENDER_MODE.kind === "canvas"` のみで分岐。M1 fallback は維持 |
| Preview/DEV | `?cheese=c64|c96|m1&cheesePx=` の比較スイッチは従来どおり（優先）。**本番バンドルには入らない**（静的 env 分岐で畳まれる） |

## 検証（exact HEAD は PR 本文）
- Vitest 全件: 395 files / 7203 passed / 2 skipped、`tsc -b` clean、`oxlint` エラー 0（`only-export-components` 警告が `hasVisiblePixels` で 1 件増、既存 export と同種）、`npm run build` 通過。
- 新規 Vitest: opt-in の ON / OFF / 未知値 / storage 例外 / セーブ非干渉 / 本番での `?cheese=` 無視、G1（空読み戻し→再試行→M1、1 回目のみ空→維持、読み戻し throw→M1、`pageshow` で健全なら再描画なし・空なら M1）、**本番バンドル gate**（本番: opt-in キーと Canvas 経路あり・`cheesePx` なし、Preview: 両方あり）。
- 新規 e2e `canvas-mozzarella-optin-486.spec.ts`（Chromium 390×844 / 360×800 各 3、全通過）: 既定は canvas 0・キー未設定／`?cheeseCanvas=1` で BAKE・CUT 後・RESULT の全 canvas に実ピクセル、3 個、横オーバーフローなし、キー保存と `=0` で解除、cheese 関連の localStorage キーは opt-in キーのみ／読み戻しを空にした環境で canvas 0・M1 が 3 個以上。
- 既存回帰（Chromium 両ビューポート）: `cut-regions-427` / `cut-skip-failed-bake` / `finished-pizza-visual-2.0` / `pizza-cutting-phase4b` / `result-1screen-2.0` = 47 passed、1 skipped（既存の条件付き）。
- 再利用（再測定せず）: 性能・複数ピース・縁寄り・密集・c64 / c96 比較・S2-B3a の iPhone Safari HV は #485 / S2-B2 / #421 の結果。
- 画像: `docs/reports/screenshots/canvas-mozzarella-prod-486/`（既定 M1 / opt-in ON の焼成後と RESULT、両ビューポート）。

## 未解決リスク
- G1 の検出は単体・Chromium（読み戻しを空にした模擬）で固定。**実機 iOS の canvas 破棄は再現できておらず、実機での確認は HV 待ち**。
- 読み戻しのコスト（64×64、描画ごと）は実機未測定。WebKit CI は assertion のみ、画像の目視は未実施。
- opt-in の保持は localStorage 依存（無効な環境では M1 に戻る＝安全側）。
- Reference / 図鑑 / サムネイル / トレイは M1 のまま（Owner 決定）。密集時にチーズが塊に見える点は S3 の範囲。

## Owner HV（本番ビルド相当の独立 Preview）
1. Preview リポジトリで、この PR の exact HEAD を **新規の独立 Preview** として build・deploy（共有 Preview #471 は変更しない。Owner 承認後）。
2. iPhone Safari でその URL を `?cheeseCanvas=1` 付きで開く（ホーム画面追加も試す）。以降はクエリ無しでも ON が保持されること。
3. マルゲリータで 焼成 → CUT → RESULT。チーズが透明・欠落・点滅しないこと、M1 の白い円でなく溶けたチーズに見えること、操作に引っかかりがないこと。
4. アプリを別アプリへ切り替えて戻した後、チーズが消えていないこと（G1 の実機確認）。
5. `?cheeseCanvas=0` で M1 に戻ること。
6. 390×844 の動画を Owner へ直接送付（repo にはコミットしない）。
