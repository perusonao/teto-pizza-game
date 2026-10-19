# Square Dough F4-b — ○/□ 生地選択 UI（Issue #538 / Epic #532）

Base: `origin/main` `9c20633`。#558（C）とは独立ブランチ。#558 の `squareDoughSpread` / `squareDoughDrag` / Canvas・操作判定、D2、Grandma レシピ、丸い生地の物理は未変更。

## Fresh Audit
- Open PR のうち重複なし。#558（C: 四隅ドラッグ・完成判定）と #553（F3: RESULT 文言）が近傍。F4-a（#555）・B2（#546）・F2（#548）は main に merge 済み。
- F4-a の `effectivePanShape` / `isPanSwitchVisible` / `isTrayAffordanceOpen` を再利用（変更なし）。

## 仕様（切替時の状態）
| 項目 | 動作 |
|---|---|
| 表示条件 | PREPARE ∧ DOUGH ∧ Free Cooking/Research ∧ 導出 affordance 開（`techniqueAffordanceStep`、step 番号は直書きしない）∧ レシピ自身が四角でない。材料の所持・購入は不問 |
| 非表示 | Guided / Lunch Rush / Dinner、DOUGH 以外、affordance 閉（本番は天板を要求するレシピが 0 件なので全員閉） |
| ○→□→○ | `pizza.pan` のみ変更。`doughShape`（○）と `squareDough`（□）は**両方保持**。○に戻すと `pan` キーを削除（未切替と deep-equal） |
| cookingProfile | □中は CUT なし、○に戻すとレシピ本来の profile / cutState に復元 |
| 「次へ」 | DOUGH を出ると SELECT_PAN は no-op（形状確定、O-7） |
| 「やり直す」 | pizza ごと破棄 → ○（pan も消える）。profile も復元 |
| 保存 | `pizza` は非永続。save スキーマ変更なし |

## 変更ファイル
- 新規: `src/state/panSelection.ts`, `src/components/PanSwitch.tsx`, `src/state/gameReducer.selectPan.test.ts`, `src/screens/GameScreen.panSwitch.test.tsx`, `e2e/pan-switch-f4b.spec.ts`
- 変更: `src/state/gameReducer.ts`（`SELECT_PAN`、3 か所のガードを `effectivePanShape` へ、RESET_PIZZA）, `src/screens/GameScreen.tsx`, `src/App.tsx`, `src/App.css`（末尾追記のみ）, `src/preview/panShapePreview.ts`（`?panSwitch=open`、Preview/DEV 限定）, `panShapePreview.gate.test.ts`

## #558 との競合
- `GameScreen.tsx`: 両 PR が編集（#558 は +21 行）。同一箇所は `squareDoughRound` の定義行（本 PR: `activePanShape` → `effectivePanShape`）。#558 の `activePanShape` import 行も隣接 → **競合の可能性が高いが機械的に解消可能**。
- `App.css`: 両方末尾追記 → 競合するが両方残すだけ。
- `PizzaStage.tsx` / `squareDough*` / Canvas / `pressGesture`: 本 PR は未変更。
- 統合順序（推奨）: #558 → F4-b。#558 の完成判定・「次へ」が入るまで、□選択中は「次へ」が無効（B2 仕様のまま）。○に戻せば常に進める。本番では affordance 閉のため到達不能。

## 未実装・Owner 判断が必要
1. **初回解禁案内は追加していない**（保存データ互換性＋一度だけ表示には新しい永続フラグが必要で、「save スキーマ変更なし」に反する。切替の出現自体が案内）。追加するなら方式の判断が必要。
2. □選択時、PizzaStage の丸い生地が四角天板の下に見える（B2 の既存描画。`PizzaStage` は #558 領域のため未変更）→ #558 統合後に再確認。
3. E2E / HV のため `?panSwitch=open`（Preview/DEV 限定、本番 bundle 非含有をゲートテストで固定）を追加。本番の実 affordance は #521 E 後。

## 検証
tsc -b / oxlint 新規警告 0 / `npm run build` 通過 / Vitest 全体（修正後に関連 133 files・2936 tests 通過、全体は RESET_PIZZA の既存 cutState 参照テストを修正して再通過）/ Playwright（chromium 390×844・360×800: 新規 10 + 既存 square-dough-b 通過）。**WebKit は本環境にバイナリ無しで未実行**（CI 要）。スクショ: `docs/reports/screenshots/square-dough-f4b/`。
HV 動画（390×844）は本環境から未取得・Owner 実機 HV 必須。

## 統合計画（#558 が先に merge された場合）
試行 merge（#558 head `9035dd1`）で競合は **2 ファイルのみ**: `src/screens/GameScreen.tsx`（2 箇所: `squareDoughRound` 定義付近、DOUGH dock の SquareDough 部品の並び）、`src/App.css`（末尾追記同士）。
1. `main`（#558 入り）を F4-b ブランチへ **merge**（rebase しない）。
2. GameScreen: #558 側の変更を残し、`squareDoughRound` は `effectivePanShape(state.recipe, state.pizza) === "square"` を維持。dock には #558 の部品の後に `PanSwitch` を並べる。
3. App.css: 両方の追記を残す。
4. 解消後: tsc / lint / 全 Vitest / `e2e/pan-switch-f4b` + `e2e/square-dough-corners` を再実行。□ 選択中に #558 の完成判定で「次へ」が有効になること、○ へ戻して復元されることを確認。
F4-b が先に merge された場合は #558 側で同じ 2 ファイルを解消する（同手順）。

## 既知課題
- □ 選択時、四角天板の下に丸い生地が見える（B2 既存描画。`PizzaStage` は #558 領域のため本 PR では未変更）。#558 統合後に再確認。
- 初回解禁案内は追加しない（永続フラグが必要で save 形式を変えるため）。保存形式は不変。
