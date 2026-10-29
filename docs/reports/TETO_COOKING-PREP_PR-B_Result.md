# Cooking Prep Phase 1 PR-B Result — 炒める UI・牛肉の炒め具合の色（S3〜S5）

Status: **実装済み・自動検証済み（Vitest 全件 / Chromium E2E / tsc / lint / build）。WebKit は CI、実機 HV は Owner 待ち。本番フラグは OFF。Owner の最終承認まで merge しない。**
基準: `origin/main` = `3e346569`（PR-A #694 merge 後）。ブランチ `feature/cooking-prep-prb-phase1`。仕様: `docs/design/TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md`（§19 に S0b の Owner 決定を記録）。

## 経緯（S0 → S0b → 実装）
- **S0:** 中央配置のピルは、360×800 の丸・四角で家族チップ（`tray-family-chip`）との間隔が **9.1px（< 16px）**。実装を停止して Owner に報告した。
- **S0b:** 案 B（ピル下端 = ステージ下端 − 18px）を 6 パターン（2 画面 × 丸・四角・ピンサ）で検証。16.0px / 44px を満たし、入力の漏れは 0 件。**Owner が案 B を正式採用**（案 A は不採用）。
- **実装（S3〜S5）:** 下記。

## 実装内容
| 区分 | ファイル | 内容 |
|---|---|---|
| S3 色 | `src/logic/prep/beefDoneness.ts` | `doneness`（0〜1）→ 色の純関数（線形補間、`color-mix()` 不使用）。0 = `BeefSlices` 現行色（#691、HV 合格）、1 = 仕様 §4.4 の暫定目標色。`PREP_HEAT_OFFSET = 0`（P-7） |
| S3 色 | `src/components/CookingPrep.css` | `.ingredient-piece--prepared` 内の `BeefSlices` の 4 つの `path` を CSS の `fill` / `stroke` で上書き（CSS は SVG の属性より優先）。つやは `drop-shadow`。**`IngredientGlyph.tsx` / `BeefSlices` の SVG は無変更** |
| S3 描画 | `src/components/PizzaStage.tsx` | 任意 prop `preparedIngredientIds`（炒め済みの食材の置いたピースに色の class と変数）と `overlay`（ステージ内・生地の後ろ）。未指定は現行と同一 |
| S4 UI | `src/components/CookingPrepLayer.tsx` | ピル「🍳 炒める」／「✓ 炒め済み」／パン画面（3 タップ）。`prepOffer.ts` が表示条件の純関数 |
| S4 配線 | `src/screens/GameScreen.tsx`、`src/App.tsx` | `onPrepIngredient`（任意 prop）→ `PREP_INGREDIENT`。`prepBusy` で dock を `inert` に。各数行 |
| テスト | 下記 | Vitest 4 ファイル、Playwright 1 ファイル、PR-A の architecture test の許可リスト更新 |

### 仕様どおりの挙動（確認済み）
- **ピル**: beef を選択中・TOPPING・GUIDED/FREE_COOK・beef 所持のときだけ。高さ 44px、水平中央、`bottom: 18px`。他の食材を選ぶと消える。
- **パン画面**: `.pizza-stage` の内側全面。3 回タップで完了（どこでも）。120ms 未満の連続入力は 1 回。時間制限・失敗状態なし。× は 44×44 で、中止すると何も残らない。完了時は「ジュッ！」（0.7 秒）→ 自動で閉じる。
- **誤タップ防止（AC-16）**: ピルは「ピル上で押して、ピル上で離した」ときだけ開始（キーボードは Enter / Space）。完了後 300ms は stage と dock が入力を無視（`cooking-prep-guard` と dock の `inert`）。「✓ 炒め済み」は押しても何も起きない。
- **中断（AC-10）**: 工程の切替・「やり直す」（トークン変更でコンポーネントが再マウント）、ウィンドウの blur、画面が hidden になった場合は、dispatch せずに破棄。
- **アクセシビリティ**: ピル・タップ面は `button`。読み上げは「フライパンです。3回タップして炒めます」→「1 / 3」→「炒め済み」。`prefers-reduced-motion` でトス・湯気・ポップを無効化（色の段階変化と文字は残る）。
- **P-4**: 炒めると、配置済みの beef もまとめて炒め済みの色になる（食材単位）。後から置いた beef も炒め済み。

### 厳守事項の確認
| 項目 | 結果 |
|---|---|
| `PREP_EXPERIENCE_PRODUCTION` | `false` のまま（変更なし。PR-A の flagOff テストも通過） |
| セーブ・採点・在庫・Dex | 変更なし。炒め状態は `GameState` の transient のみ。E2E で炒める前後の保存データが同一であることを確認。`pendingRound` / journal に出ない（PR-A のテスト + architecture test） |
| フラグ OFF の DOM・描画 | 現行と同一。`CookingPrepLayer` は `null` を返し、`PizzaStage` は prop 未指定で同じマークアップ（Vitest で `innerHTML` を比較）、dock に `inert` 属性なし（E2E で確認） |
| `BeefSlices` / `IngredientGlyph.tsx` / `ingredients.ts` / `App.css` / `bakeVisual.ts` | 無変更 |
| 既存のドラッグ操作 | 変更なし（E2E: チップをドラッグしてピル上で離しても配置 0・ピルの click 0。ピルを押して生地上で離しても 0。S0b で確認、`cooking-prep.spec.ts` の既存フローも通過） |
| Monitor | 作成していない |

## 実測値（Chromium、案 B、全食材所持の最悪ケース）
| 画面 | 生地 | ピル高さ | ピル下端→家族チップ | ピル→生地 box 下端 | 重なり |
|---|---|---|---|---|---|
| 390×844 | 丸 / 四角 | 44 | 16.0 | 18.0 | なし |
| 390×844 | ピンサ | 44 | 16.0 | 66.3 | なし |
| 360×800 | 丸 / 四角 | 44 | 16.0 | **4.2（既知リスク）** | なし |
| 360×800 | ピンサ | 44 | 16.0 | 49.8 | なし |

- E2E（`cooking-prep.spec.ts`）が丸・ピンサ・四角で、ピル高さ ≥ 44、水平中央、`stage.b − pill.b = 18 ± 0.5`、家族チップまで ≥ 15.9、生地 box と重ならない、を検証。ピルの有無で stage / dock / bar / 生地の寸法が不変、タブ 6、横・縦のはみ出し 0 も確認。
- パン画面の寸法 = stage、× は 44×44 以上で stage 内、dock は `inert`、パン画面中の生地へのタップは配置 0（トスとして扱われる）。
- WebKit は**ローカルでは動かせない**ため、WebKit の寸法確認は CI の WebKit シャード（390×844・360×800）に依存する（本 spec も対象）。

## テスト結果
| 項目 | 結果 |
|---|---|
| `tsc -b` | エラー 0 |
| `oxlint` | 追加ファイルに警告 0（既存の警告のみ） |
| `npm run build` | 成功 |
| 全 Vitest | **553 files pass（1 skipped） / 10,546 tests pass**（13 skipped・2 todo）、1,250 秒。既存テスト無修正（PR-A の architecture test の許可リストのみ更新） |
| 新規 Vitest | 4 ファイル + 既存 prep 系を含む 11 ファイル / 108 tests pass（beefDoneness、prepOffer、CookingPrepLayer、PizzaStage の炒め済み描画、PR-A の prep 系） |
| Playwright 新規 `e2e/cooking-prep.spec.ts` | Chromium 2 画面で **18 / 18 pass**（本番既定で DOM なし、ピルの配置（丸・ピンサ・四角）、パン画面・inert・漏れなし・× で中止、3 タップで炒め済み・色の変化・保存データ不変・ガード、スキップ、キーボード、reduced motion） |
| Playwright 既存（関連 spec 11 本 + 新規） | Chromium 2 画面で **162 pass / 70 skip / 0 fail**（`cooking-tray-family-*`、`cut-topping-reach-s3`、`family-layout-contract`、`making-ui-1screen`、`pan-switch-f4b`、`pinsa-oval-dough`、`undo-placement-449`、`viewport-1screen`） |
| WebKit | **未実行（ローカル不可）。CI の WebKit Gate で確認** |

## HV 資料（Owner 判定用）
- 動画（リポジトリには入れない）: `cooking-prep-hv-390x844.mp4`（390×844、35 秒、H.264）。炒めなし（本番既定）で配置・焼成 → ピル → パン画面 → 3 タップ → 炒め済み → 配置・焼成、の順。
- 比較画像（コミット済み）: `docs/reports/screenshots/cooking-prep-prb/`
  - `sheet-flow-{390x844,360x800}.png`: 前（炒めなし）→ ピル → パン 1/3 → 2/3 → 炒め済み → 焼成後。
  - `sheet-baked-*.png`: 焼成後の炒めなし／炒め済み。`zoom-beef-*.png`: 盤面の牛肉 2 倍拡大。ほか個別フレーム。
- **実機 HV 手順（iPhone Safari、Preview の URL に `?cookPrep=on`。共有 Preview の更新は Owner 承認が必要）**
  1. 牛肉の所持した状態で Free Cooking か Guided（ルンダン / わさび牛）の具材工程へ。牛肉を選ぶとピルが出る。他の食材では出ない。
  2. ピルを押す → パン画面。3 回タップで完了、ゆっくりでも完了する。途中で × → 何も残らず戻る。
  3. 炒め済みで、盤面の牛肉（置いた後・置く前どちらも）が茶色になる。焼く → 結果で差が残るか。
  4. **誤操作の確認（既知リスク）**: 360×800 相当の画面で、生地の一番下の縁に牛肉を置くときにピルを押してしまわないか。ピルと家族チップの間隔 16px で、家族チップを押してしまわないか。
  5. 判定項目（仕様 §6.3・P-10）: 視覚反応、視認性（20px 級で炒め済みが分かる）、誤操作、1 画面表示、既存機能との互換性、操作時間（目安 8 秒以内）。「動きを減らす」設定も確認。

## 既存 PR との競合
- open PR（27 件）で、本 PR が触る `GameScreen.tsx`・`PizzaStage.tsx`・`App.tsx` に実質的に重なるのは **#478（Draft、`GameScreen.tsx` / `roundKind.ts`）と #468（`PizzaStage.tsx` / `App.css`）**。いずれも既存の変更には**手を入れていない**。本 PR の変更は各ファイルの小さな追加（GameScreen: import・prop・state・オーバーレイ要素・dock の `inert`、PizzaStage: 2 prop と 1 箇所のスタイル合成、App: 1 行）で、先に merge された側に後から merge する側が追従する。#611 の claim（PR-B、期限 11/05）のとおり。
- `App.css` は触っていない（#468 / B11 S1 の領域）。新規 CSS は `src/components/CookingPrep.css` に分離。

## 残存リスク・未確認
1. **360×800 の丸・四角で、ピルと生地 box の間が 4.2px**（Owner が既知リスクとして承認）。生地の最下端を狙った指がピルに当たる誤タップはありうる。被害は「パン画面が開く → × で戻る」まで（状態不変）。実機 HV の確認項目。
2. ピルと家族チップの 16.0px は余裕 0。家族チップの誤タップは絞り込みが変わるだけ。実機の指での感触は HV で確認（AC-16 の調整は Owner 承認済み）。
3. **炒め済みの色（目標色・つや）は暫定**（仕様 §4.4）。Chromium では生の赤 → 焼き目の茶の差は 2 倍拡大でも 1 倍でも見える（比較画像）が、iPhone 実機での視認性・焼成後の差の残り方は HV で確定する。
4. WebKit での `inert`・`pointerdown`・CSS の `container-type` / `cqw`（パン画面の寸法）の挙動は未確認。CI の WebKit と実機 HV に依存。`cqw` が使えない場合は 230px にフォールバック。
5. 入力ガード 300ms と、ピルの「押して離す」規則は初期設計値（AC-16、HV で調整可）。
6. 既知の間欠 WebKit 失敗（#680: `lunch-rush-r8-restore` G-6、390×844 shard 2/3）が CI で再発する可能性がある。本 PR の変更とは無関係（Lunch Rush には `PREP_INGREDIENT` が無い）。再発した場合は #680 のとおり扱い、再実行は Owner 承認の 1 回まで。
7. 本番有効化（`PREP_EXPERIENCE_PRODUCTION = true`）は別の Owner 明示承認。merge も Owner の明示承認後（Squash merge）。
