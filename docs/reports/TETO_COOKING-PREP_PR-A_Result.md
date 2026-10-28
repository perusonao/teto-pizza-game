# Cooking Prep Phase 1 PR-A Result — 純粋層 + reducer（内部ロジックのみ）

Status: **実装済み・自動検証済み。UI・CSS・描画なし。フラグ OFF（本番既定）。Owner の最終承認まで merge しない。**
基準: `origin/main` = `c907314`（#691 merge 後）。ブランチ `claude/cooking-prep-phase1-pra-hjigwi`。仕様: `docs/design/TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md`（P-1〜P-10、AC-1〜AC-19、§18）。
Owner 承認（2026-10-28）: O-2 は **PR-A のみ**。PR-B（S3〜S5: 描画・UI・CSS・`BeefSlices` の変数化・E2E・HV）は未承認で、本 PR に含めない。

## 内容
| ファイル | 内容 |
|---|---|
| `src/data/prepIngredients.ts`（新規） | `canPrepIngredient(id)` = 炒め対象リスト（Phase 1: `beef`）∧ 専用 SVG（`pieceVisual`）あり。id だけから導出。`ingredients.ts` は読むだけ |
| `src/data/prepExperienceGate.ts`（新規） | `PREP_EXPERIENCE_PRODUCTION = false`、`prepExperienceEnabled()` |
| `src/preview/prepPreview.ts`（新規） | Preview / DEV 限定の opt-in `?cookPrep=on`（`?freeFinish=on` と同型。本番ビルドは `import.meta.env` の静的分岐でクエリ名ごと除去） |
| `src/state/gameReducer.ts`（HOT、追加のみ） | `GameState.preparedIngredientIds?`、`PREP_INGREDIENT`、`RESET_PIZZA` でプロパティ自体を除去 |
| `src/logic/prep/*.test.ts`、`src/preview/prepPreview*.test.ts` | テスト（後述）。B11 S1（#693）の claim の glob と重ならない場所 |
| 仕様書 §18.2 | 古い状態表（#691 open・条件 2 未・O-2 未承認）を訂正 |

## reducer の規則（`PREP_INGREDIENT`）
拒否はすべて**同一参照の state を返す**。許可条件はすべての AND:
フラグ ON（本番 OFF の間は Preview opt-in のみ）／`phase === "PREPARE"` ／ `makingStep === "TOPPING"` ／ `roundKind` が GUIDED か FREE_COOK ／ `canPrepIngredient` ／ `ownedIngredientIds` に含まれる ／ 未炒め。
- LUNCH_RUSH・DINNER は拒否。`DINNER_COOKING_ACTIONS` には載せず、アクション自身が `roundKind` で拒否する（スパイクの方針どおり）。
- **所持の判定は `ownedIngredientIds`。在庫は見ず、消費もしない**（在庫 0 でも所持なら通る。テストで固定）。
- 失敗状態・時間切れ・やり直しの強制はどこにも存在しない。炒めなしでも配置から結果まで従来どおり。

## Owner 判断の反映
| 判断 | 反映 |
|---|---|
| フラグ OFF 時は reducer が拒否 | 実装。`flagOff.test.ts` で同一参照を確認。ガードを外す変異で 3 件が落ちることを確認済み（戻した） |
| フラグ + Preview opt-in の基盤は PR-A | 実装。本番既定 OFF |
| 判定は `src/data/`、テストは B11 の claim と競合しない場所 | `src/logic/prep/`・`src/preview/` |
| 所持は `ownedIngredientIds`、在庫は消費しない | 実装 |
| UI・CSS・BeefSlices は PR-B | 触れていない |

**Preview のクエリ名は `?cookPrep=on`**（§18.1 O-7 が「実装 PR の Result で最終確認」としていた点）。仕様の暫定名 `?prep=on` は短く、本番バンドルに文字列が現れないことを検査する gate test（`"prep"` は無関係な語に一致する）が成り立たないため。Owner が別名を望む場合は `PREP_PARAM` 1 か所と gate test の期待値を変える。

## 検証
- `tsc -b`: エラー 0。`oxlint`: エラー 0（警告は既存のみ。新規ファイルに警告なし）。
- 新規テスト **37 件 / 6 ファイル** すべて pass:
  - `canPrepIngredient.test.ts`（4）: beef のみ true、既存の全食材で他は false、SVG なしで休眠（`getIngredient` をモックして `pieceVisual` を外す）、id のみを引数に取る。
  - `prepIngredient.reducer.test.ts`（フラグ ON をモック）: GUIDED / FREE_COOK で許可・冪等、LUNCH_RUSH / DINNER / DOUGH・SAUCE / PREPARE 外 / 非対象 / 未所持を同一参照で拒否、**炒めあり・なしで `pizza` / `score` / `scoringV2Result` / `completion` / `inventory` / `dex` / `pitzBalance` と状態全体（連番を正規化）が同一**、配置済み beef があっても許可（P-4）、`RESET_PIZZA` でプロパティ消滅、`PLAY_AGAIN` / `RETRY_SAME_RECIPE` / 新 Free Cooking で非持ち越し、pending-round の journal が炒めの有無で同一かつ炒め状態を含まない、journal から復元した pizza に炒めなし。
  - `prepIngredient.flagOff.test.ts`: 本番リテラルが `false`、実ゲートで拒否（同一参照）、通常ラウンドの状態に `preparedIngredientIds` が出ない、`?cookPrep=on` のときだけ ON（この suite は DEV）。
  - `prepIngredient.architecture.test.ts`（AC-6）: `preparedIngredientIds` を参照する非テストのソースは reducer と prep モジュールだけ。`pendingRound` / `persistence` / scoring は参照しない。
  - `prepPreview.test.ts`: クエリの解決（1 回の `on` だけ ON）。
  - `prepPreview.gate.test.ts`: **実 `vite build` 2 本。本番バンドルに `cookPrep` が無い／Preview バンドルには有る（陽性対照）**。
- 全 Vitest（`vitest run`）: **545 ファイル pass（1 skipped）/ 10,256 テスト pass**（13 skipped・2 todo）、931 秒。既存テストは無修正。
- 既存の `pendingRound` 行列・golden・anti-spoiler 系は無修正で通過（上の全件に含まれる）。

## 受け入れ条件の対応（PR-A の分）
AC-1（状態: フラグ OFF で拒否・状態不変。DOM は UI が無く不変）／AC-2／AC-3／AC-4／AC-5／AC-6／AC-7／AC-19（保存・journal に出ない、復元で炒めなし）／AC-14 の前半（通常の git リポジトリで全 Vitest を実行）。
PR-B に回すもの: AC-8〜13、AC-15〜17（UI・HV）。AC-18 は PR-B（描画）で扱う。**HV は不要**（UI・見た目・操作が一切変わらない内部ロジックのみ。HV Policy §2「原則不要」）。

## B11 S1 との関係
B11 S1 は #693（`src/data/*`・`IngredientGlyph.tsx`・`App.css` ほか）。本 PR は `src/state/gameReducer.ts` と新規ファイルだけで、重なるファイルはない。#611 に claim を投稿した（コメント `6482743240`）。

## 残課題 / 未実施
- WebKit・Playwright E2E は未実行（本 PR は DOM を変えない。CI に任せる）。
- PR-B（描画・UI・`BeefSlices` の変数化・HV）は Owner の別途承認待ち。本番有効化（`PREP_EXPERIENCE_PRODUCTION = true`）も別の明示承認が必要。
- 仕様 AC-14 の「git archive 環境の 1 件の失敗」は、今回の通常リポジトリでの全件実行で再現せず（全件 pass）。
