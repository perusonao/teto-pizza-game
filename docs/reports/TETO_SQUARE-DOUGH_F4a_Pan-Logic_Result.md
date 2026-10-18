# Square Dough F4-a — 形状選択の純ロジック（Issue #538 / Epic #532）

Base: `origin/main` `d611839`。重複 PR なし（open の #546 / #553 とファイルが重ならない）。見た目・挙動の変更なし（呼び出し元なし）。

## 追加（新規ファイルのみ）
| ファイル | 内容 |
|---|---|
| `src/logic/pan/effectivePan.ts` | `effectivePanShape(recipe, pizza)`: `activePanShape(recipe)` が square ならそのまま、そうでなければ明示の `pan === "tray"` のみ square、それ以外 round。`squareDough` は読まない。`pan` 未指定なら `activePanShape(recipe)` と同値 |
| `src/logic/techniques/panSwitch.ts` | `isTrayAffordanceOpen(dex, context)`（導出された affordance、credited count）／`isPanSwitchVisible({phase, makingStep, eligibility, affordanceOpen})`: PREPARE ∧ DOUGH ∧ `FREE_COOK` ∧ affordance 開のときだけ true。target・ヒント・マッチ結果は入力に無い |
| 同名 `.test.ts` ×2 | 18 テスト |

## 範囲外（F4-b 以降）
`SELECT_PAN` action、切替 UI、reducer / GameScreen / CSS の変更、3 か所のガード差し替え。B2 #546 の実機 HV PASS・マージ後に開始。Research G2 は F5。F3 #553 の文言は不変。

## 検証
`tsc -b` 通過／`npm run build` 通過／`oxlint` 新規警告 0／Vitest 全体 451 files passed・8523 tests passed（失敗 0）。既存 `squareDough.test.ts` の「pan モジュールは state を import しない」ガードに合わせ、`effectivePan.ts` は `pan` を構造的な型で受ける。

Human Verification: 不要（呼び出し元が無く、見た目・操作が変化しない）。
