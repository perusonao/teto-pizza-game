# #577 P3-a1 — Guided 開始時の生地（`PizzaState.dough`）設定 Result

Refs #577。基準 `main` `a6c1463`。Owner 決定 D5（2026-10-23）。決定記録は `docs/decisions/TETO_PINSA-577_P3_L1-DECISIONS_2026-10-23.md`（P3-0、#638）。**Pinsa のデータ本体（P3-b）は HOLD で、追加していない。** 本番 FINISH / Late Catalog は OFF のまま。

## 変更
- `src/state/doughSelection.ts`: `startingPizzaFor(recipe)` を追加。`createEmptyPizza()` に、レシピの `doughKind`（`resolveDoughKind` が唯一の読み手）が標準でないときだけ `dough` を足す。標準レシピ・未知の値・`null`・Free Cooking のレシピは、従来どおり `dough` キーなしの `createEmptyPizza()` を返す。
- `src/state/gameReducer.ts`（HOT。局所変更のみ）:
  - `buildOrderState` の `pizza: createEmptyPizza()` → `startingPizzaFor(recipe)`。`SELECT_RECIPE` / `RETRY_SAME_RECIPE` / `BEGIN_PREPARE` / 次の注文など、ラウンド開始の全経路がここを通る。
  - `RESET_PIZZA` の `createEmptyPizza()` → `startingPizzaFor(state.recipe)`（作り直しはレシピ自身の生地から再開する。設計書 §6.5）。
- 保存形式・schema・採点・matcher・`lateCatalog.ts`・本番スイッチは変更していない。`pendingRound` は既に `pizza.dough` を保存・復元する（変更なし。テストで固定）。

## 本番での挙動
`doughKind` を持つレシピは出荷されていないため、**本番の挙動は変わらない**（どのラウンドの pizza にも `dough` キーは付かない）。

## テスト（`src/state/gameReducer.guidedDough.test.ts`、19 件）
出荷レシピの `jamon-serrano-pizza` に `doughKind` を与えるのは**テスト内の mock のみ**（データは変更していない）。
- `startingPizzaFor`: 標準・未知の種類・null・undefined は `createEmptyPizza()` と deep-equal で `dough` キーなし／Pinsa は `dough` だけが足される。
- `SELECT_RECIPE`: Guided 開始の pizza が `{...createEmptyPizza(), dough}`。標準レシピは `dough` キーなし。識別軸 `dough` が値を読み、他の軸は動かない。cookingProfile・pan に影響しない。
- `RETRY_SAME_RECIPE`: ソース適用後でも新しい pizza で生地から再開。標準レシピは不変。
- `RESET_PIZZA`: 置いた piece は消え、レシピの生地は残る。標準の Guided と Free Cooking の reset は `createEmptyPizza()` と deep-equal（`dough` キーなし）。
- Free Cooking の開始・初期状態に `dough` キーなし。
- Guided ではチップが出ず（Preview の opt-in `?doughSwitch=open` でも）、`SELECT_DOUGH` が Guided の生地を変えない（同じ state object）。
- DOUGH 確定後・topping 配置後も生地が保持される。pending-round journal が生地を保存し、JSON 往復（リロード）で復元する。標準 Guided の journal に `dough` キーなし（保存形状は不変）。
- **変更を外すと 8 件が失敗する**ことを確認（テストが実際に本体を縛っている）。

## 検証
- `npx vitest run src/state/gameReducer.guidedDough.test.ts`: 19/19。
- `npx tsc -b`、`npm run build`: 問題なし。`npx oxlint`: 既存の warning のみ（このファイルの指摘なし）。
- Playwright（Chromium、iphone-390x844）: `e2e/dough-kind-chips-p2.spec.ts`（Guided でチップが出ないケースを含む）と `e2e/free-cooking-phase3-2.spec.ts` の計 9 件 pass。
- 全 Vitest: 510 files passed, 1 skipped（9433 passed, 2 skipped, 4 todo）。

## 範囲外・未実施
- Pinsa のレシピ・食材・order・表・Reference・discovery target（P3-b、HOLD）。`discoveryIdentityOf` が `doughKind` を読むこと（P3-a2）。したがって Guided の Pinsa が `pinsa-romana` として**発見される**ことのテストは P3-b で行う（本 PR は「pizza に生地が設定される」ことまで）。
- WebKit E2E は CI で確認する（このセッションでは未実施）。
- HV: 本番で見た目・操作が変わらないため不要（`TETO_HUMAN-VERIFICATION-POLICY.md` §2）。
