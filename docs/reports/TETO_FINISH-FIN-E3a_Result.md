# FINISH FIN-E3a — Free Cooking の FINISH 工程（reducer・プロファイル・識別の遅延、本番 OFF 固定、#294 / TQ-2 #604）

base `main` `075da8b`（FIN-E2 #606 merge 後）。Owner は 2026-10-21 に FIN-E3 Fresh Audit の設計方針 1〜6 を承認し、**E3a のみ**を指示した。
UI・CSS・save・共有 Preview・本番有効化・E3b は対象外。FINISH の Free Cooking は **本番 OFF のまま**（`FREE_COOK_FINISH_PRODUCTION = false`）。

## Duplicate Gate（2026-10-21）

- open PR 26 件を確認。E3a の対象ファイルと重なるものなし（`main` は `075da8b` から不変）。
- #478（`GameScreen.tsx` / `IngredientTray.tsx` / `roundKind.ts`）は **編集しない**（述語は `finishEngine.ts`）。#584（`recipes.ts` / `cookingProfiles.test.ts` / `PROJECT_HANDOFF.md`）も編集しない。#581 は SquareDough のみで無関係。
- claim: #604 のコメントに記録（branch `claude/fin-e3-fresh-audit-4hain4`）。`gameReducer.ts` は HOT file だが他の claim / PR なし。

## 変更

| ファイル | 内容 |
|---|---|
| `src/data/freeCookFinishGate.ts`（新規） | 単一ゲート。`FREE_COOK_FINISH_PRODUCTION = false`、`freeCookFinishEnabled()` = 本番定数 または Preview/DEV の明示 opt-in |
| `src/preview/freeFinishPreview.ts`（新規） | opt-in `?freeFinish=on`（ちょうど 1 回のみ）。`import.meta.env.DEV \|\| VITE_PREVIEW_MODE` の静的分岐で、本番ビルドからクエリ名ごと除去される |
| `src/data/cookingProfiles.ts` | `freeCookingProfile(profile, enabled)`: OFF は同一オブジェクトを返す、ON は FINISH を 1 つ追加（共有 `DEFAULT_COOKING_PROFILE` は変更しない） |
| `src/state/finishEngine.ts` | `roundRunsFinish` をプロファイル連動に（Free は profile に FINISH があるときだけ true。Lunch Rush / Dinner は従来どおり常に false） |
| `src/screens/postBakeView.ts` | `finishStepAvailable` を同じ述語に連動（判定ロジックのみ、描画は無変更） |
| `src/state/finishFreeCook.ts`（新規） | `deferFreeCookAtBake`: 焼成の成否だけを判定し、成功なら識別せずに FINISH へ（焼成前ピースのみ消費） |
| `src/state/finalizeRound.ts` | Free の `finalization: "FINAL"` を許可（識別・採点・Gate を完成した pizza で実行。未マッチ時の在庫は FINISH 分のみ消費） |
| `src/state/gameReducer.ts` | `roundCookingProfile`（3 か所のプロファイル導出を 1 関数に）、CONFIRM_BAKE の Free 分岐、未マッチ副作用を `unmatchedFreeCookPatch` に抽出（焼成時と完成時で同一コードを使い、二重実行しない）、完成時に Free を識別して recipe を差し替え |

## 設計

- **焼成成否と最終識別の分離**: CONFIRM_BAKE は `resolveFreeCookPizza` を「焼成失敗（UNDERBAKED / OVERBAKED）か」の判定にだけ使い、結果は破棄する。失敗なら FINISH を飛ばして従来どおり 1 パスで確定（OD-CS-7 = A）。組成だけの失敗（空の pizza など）は FINISH へ進む。
- **漏えいなし**: FINISH 中は `recipe`（センチネル）、`score`、`scoringV2Result`、`completion`、`dex`、ヒント試行カウンタ、Research 行・事実・Notebook をいずれも書き換えない。
- **在庫**: 焼成時に焼成前ピースを 1 回、完成時に FINISH ピースを 1 回（合計 = pizza 全体の 1 回消費と一致）。FINISH 途中で離脱した場合、焼成前に消費した分は戻らず（Guided の FINISH / CUT と同じ）、FINISH で置いた分は消費されない。
- **識別**: D-1 strict（FIN-E2）のとおり、焼成後に置いた piece は識別に含まれる。後乗せレシピは E4 まで存在しないため、ゲートを ON にすると Free での後乗せ pizza は ORIGINAL になる。**ON にするのは E4 のデータの後（E5）**。

## 検証

結果は PR 本文の Final Gate に記載。

## 独立レビュー（blocker / P1 / P2 なし）

低重大度 4 件のうちテスト弱点 3 件（parity の比較キー追加、Research の held-bake 断言の無条件化、anti-oracle の対象拡大）を反映。残り 1 件は **E4 の入力**として記録する:

- **E4 で対処（今は到達不能）**: Free の識別（`resolveFreeCookPizza`）は pizza 全体でマッチと Gate を判定する一方、FINAL の採点は `pizzaForFinalEvaluation` を通す。`applicationPhase: "POST_BAKE"` を持つ本番レシピ（現在 0 件）で、その食材を焼成前に置いたピースがあると、INCOMPLETE_MATCH ではなく MATCHED → FAILED になりうる。後乗せレシピ追加（E4）の前に、識別側にも同じ phase 制限を入れるか判断する。
- 参考: FINISH 途中で離脱すると、焼成時に消費した在庫は戻らない（Guided の FINISH / CUT と同じ）。FINISH で置いた分は消費されず、試行・Notebook・ヒントカウンタも記録されない。
