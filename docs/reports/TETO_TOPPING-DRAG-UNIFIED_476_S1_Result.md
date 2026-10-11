# Topping Placement Human Feel 2.0 — S1「ドラッグ対象・モードの統一」Result（Issue #476）

- 状態: **Draft PR**。Owner の iPhone 実機 HV 前。Preview 公開・merge・本番デプロイはしていません。
- 土台: `main` = `6b86798`。Phase 0 監査と Owner 決定は Issue #476 の 2 コメントを参照（D1〜D9）。
- スコープ: S1 のみ（S2 の adjusted リングは #468 の merge 後に別 PR）。

## 1. 何を変えたか

トレイからピザへのドラッグ配置の可否を、**Reference の有無と材料 ID の固定リストから切り離し、ラウンドの種類と材料そのもので決める**ようにしました。

| 変更 | ファイル |
|---|---|
| 材料の判定を純関数 `isDraggablePiece`（`placement === "scatter"` の cheese / topping。sauce は常に対象外）に | `src/logic/pieceDrag.ts` |
| ラウンドの判定を純関数 `allowsPieceDragInRound`（Lunch Rush 以外）に | `src/state/roundKind.ts` |
| `draggableIngredientIds` prop を廃止し、チップごとに `isDraggablePiece` で判定 | `src/components/IngredientTray.tsx` |
| `physicalDragEnabled = allowsPieceDragInRound && phase==="PREPARE" && !Reference popover && !Dinner 見本 popover && !cookingInputPaused && !Dinner abandon` | `src/screens/GameScreen.tsx` |

効果:

| ラウンド | 変更前 | 変更後 |
|---|---|---|
| Guided | mozzarella / basil のみ | **全 scatter 材料** |
| Free Cooking | なし | **全 scatter 材料** |
| Research（Free Cooking の一種） | なし | **全 scatter 材料** |
| Dinner | なし | **全 scatter 材料** |
| Lunch Rush | なし | **なし（不変）** |

`GameScreen` の `referenceModeEnabled` は SauceMetrics 等の既存用途のため触っていません（ドラッグ判定にだけ使うのをやめた）。

## 2. 変更していないもの（禁止事項の確認）

- `git diff origin/main --stat` の本体差分は `GameScreen.tsx` / `IngredientTray.tsx` / `pieceDrag.ts` / `roundKind.ts` のみ（+テスト・docs・e2e）。`PizzaStage.tsx`・`App.css`・`App.tsx`・`bakeVisual.ts`・`src/state/gameReducer.ts`・`pizzaState.ts`・`scoring*`・`cut/*`・`persistence.ts`・`recipes` は**差分なし**。
- 配置座標・押し出し距離（`MIN_TOPPING_DISTANCE = 9` / `findOpenSpot`）: 不変。e2e で「離した位置にそのまま置かれる」（40%/50%、62%/52%）を固定。
- #468 A4 の mozzarella 描画: 触れていない（`PizzaStage` のピース描画・`bakeVisual.ts`・`.pizza-cheese--mozzarella`）。
- 採点・経済・保存形式・焼成 3 秒・CUT 判定・レシピ判定: 不変。
- Lunch Rush: 不変（チップにドラッグ用クラスなし、ドラッグで配置されない、tap は従来どおり）。
- 他の open PR との重複: なし（open PR / Issue を検索）。#471 は `GameScreen.tsx` の別 hunk（import と ResultPanel の props）を触るのでテキスト競合の可能性は低い。

## 3. テスト

| 種類 | 内容 | 結果 |
|---|---|---|
| Vitest 全件 | 385 ファイル | **7118 passed / 1 skipped** |
| `tsc -b` | | 通過 |
| oxlint | 変更・追加ファイル | 指摘なし（リポジトリ全体の既存警告は本変更と無関係） |
| 新規 unit `GameScreen.pieceDragModes` | 実 GameScreen＋実 reducer。Guided（Margherita / Salsiccia）・Free Cooking・Research・Dinner・Lunch Rush の 6 経路。cheese と topping をドラッグ配置、Lunch Rush は 0 個。Reference 無しで成立。sauce 非対象。取消し（ピザ外・Escape・pointercancel・Dex/Shop overlay・Reference popover・Dinner abandon・PREPARE 外）。Undo（↩）で直近のみ戻る。在庫（finite 在庫の回数だけ、チップ disabled、カテゴリ×ステップゲート）。tap（選択）は不変 | 36 件通過 |
| 新規 unit `IngredientTray.pieceDragAll` | **全 54 の scatter cheese / topping**（個別にドラッグして drop）＋全 sauce は不可＋tap 選択＋`physicalDragEnabled` off | 通過 |
| 新規 unit | `isDraggablePiece`（カタログ全件）、`allowsPieceDragInRound`（4 種） | 通過 |
| 更新した既存 unit | `IngredientTray.palette`（onion は今は draggable）、`physicalDragReset`（prop 削除） | 通過 |
| ミューテーション | `allowsPieceDragInRound` を常に true → Lunch Rush テストが失敗 / Dinner abandon ゲートを外す → 該当テストが失敗 | 検出済み |
| 新規 e2e `topping-drag-unified-476` | Chromium 390×844 / 360×800 × 6 本（Guided Salsiccia・Free・Research・Dinner・Lunch Rush・tap 不変）。cheese と非 mozzarella/basil topping のドラッグ、離した座標どおり、Escape 取消し、↩、横オーバーフローなし、チップ 44px 以上 | **12 passed** |
| 同 e2e を変更前のソースで実行 | Free / Guided Salsiccia / Research / Dinner が失敗、Lunch Rush と tap は成功 | 差が出ることを確認 |
| 既存 e2e（両 viewport） | undo-placement-449, making-ui-1screen, free-cooking-phase3-2, cooking-tray-family-row-stable, pizza-cutting-phase4b | 49 passed / 21 skipped |
| 既存 e2e（両 viewport） | dinner-mission, viewport-1screen, discovery-research-target, research-ux-phase1 | 66 passed |
| WebKit | CI の `E2E WebKit`（PR 後に確認） | 未確認 |

## 4. Human Verification

- Before/After スクリーンショット（Chromium、Free Cooking で にんにく をドラッグ中）: `docs/reports/screenshots/topping-drag-unified-476/{before,after}/`（390×844 と 360×800 の `1-topping-tray` / `2-mid-drag` / `3-after-drop`）。before はドラッグしても何も起きず 2 個、after はプレビューが出て 3 個。

### Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| topping-drag-unified-476-s1-390x844.mp4 | 390×844 | 54.6 s | 0.78 MB | PASS |

Download: セッション内直接提出（repo には commit しない）。コーデック: H.264 / yuv420p / 30fps。

Video Verification: PASS（ffprobe で codec / 解像度 / 長さ確認。再生・全 viewport 記録を確認）

この動画で確認できること:
1. Guided（Salsiccia）: mozzarella を 3 回ドラッグ配置 → ↩ で最後の 1 個を戻す → 再配置 → ソーセージ（従来は tap のみ）を 3 回ドラッグ → 焼成 → CUT → RESULT まで配置が保たれる。
2. Free Cooking: mozzarella、にんにく、たまご、マッシュルームをドラッグ配置。オレガノのドラッグ中に Escape で取消すと何も置かれない。
3. Lunch Rush（不変）: ドラッグしても何も置かれず、チップを選んで tap すると置ける。

実機 iPhone HV は **未実施**（Owner の完了条件 D9）。動画は Chromium。

## 5. 未確認・リスク

1. **iPhone 実機（Safari）**: ドラッグのつまみやすさ、プレビューが指の 30px 上に描かれる点と着地（指の真下）のずれ、押し出し（約 9%）の体感は実機で確認が必要（Phase 0 報告どおり）。
2. **`touch-action: none`**: ドラッグ対象のチップ（今は 6 個/ページ全部）に `.ingredient-chip--physical` がかかる。トレイは縦スクロールしないページ送りのグリッドで、既存の 1-screen e2e（両 viewport）は通過したが、実機の短い viewport で画面スクロールを妨げないかは要確認。
3. **WebKit**: ローカルでは未実行。CI の WebKit Gate で確認する。
4. Dinner / Research の実経路は e2e（実 Dinner、実 Dex→研究）で確認済み。unit は Free Cooking の round kind 差し替えで再現している。
5. adjusted（押し出し）は従来どおり無言（S2 の対象。#468 merge 後）。
