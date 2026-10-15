# FINISH D2-0 — 選択ロジック / 描画区分 / 仕上げヒント（純粋層・未配線）(#294)

**Scope:** 純粋関数とテストのみ。`PizzaStage.tsx` / `GameScreen.tsx` / `IngredientTray.tsx` / `App.css` / reducer / `RECIPES` は無変更。UI・描画・操作は変わらない（HV 対象外: `TETO_HUMAN-VERIFICATION-POLICY.md` の「見た目が変わらない内部変更」）。
Owner Decision（OD-CS-3 / 11 / 7 / 1 / 2 / 9(a) / 20）は変更しない。

| 追加 | 内容 |
|---|---|
| `src/screens/postBakeView.ts` | `finishStepAvailable(round, profileSteps)`（Guided かつ profile に FINISH がある時だけ true）、`selectPostBakeStep(phase, step, finishRendered)`。`renderedPostBakeStep` は無変更で、GameScreen は従来どおりそれを使う |
| `src/state/pieceBakeClass.ts` | `pieceBakeClass` / `partitionPiecesByBakeClass` / `bakeProgressForPiece`（後乗せ piece は焼成値で着色しない） |
| `src/data/finishHint.ts` | `buildFinishHintLine`。Guided のレシピが後乗せ要件を持つ時だけ材料名を出し、Free Cooking は材料名を出さない。`buildHintLine` は無変更 |
| テスト | 各単体テスト + `src/state/finishD2Inert.test.ts`（RECIPES × Guided/Lunch Rush/Dinner、Free Cooking で FINISH が有効にならないこと、6 タブ上限、本番コードが新ヘルパーを参照していないこと） |

次: D2-1（PizzaStage の後乗せ描画、#468 / #494 の後）、D2-2（GameScreen / トレイ、#478 の後）、D2-3（Free Cooking の仕上げタブ、UD-B 決定後）。
