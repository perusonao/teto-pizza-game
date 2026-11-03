# Cooking Sear Production ON — Result（Issue #727）

Status: **実装・自動検証済み。PR は merge しない。Production Deploy は未実施。** merge と公開は Owner の別承認待ち。
Issue #727（Refs #724）/ 基準 main `cfbb0830cb395f9deb7aa36e3bfdf195217523b7`（#725 merge）/ ブランチ `claude/teto-pizza-game-searing-prod-idclmi`。

## 1. 変更（これだけ）
| ファイル | 内容 |
|---|---|
| `src/data/searExperienceGate.ts` | `SEAR_EXPERIENCE_PRODUCTION = false → true`（コメントのみ追加） |
| `src/logic/sear/searIngredient.flagOn.test.ts`（旧 `flagOff` を改名・書換） | リテラル true を固定／クエリ・タブ記憶なしで ON／`?cookSear=off` で消えない／GUIDED・FREE_COOK で受理／炙った回と炙らない回の採点・消費・完了が一致／炒める flag は OFF のまま |
| `src/logic/sear/searIngredient.reducer.test.ts` | ゲート閉（ロールバック状態）で同一参照を返す OFF テストを追加（SearLayer 側の OFF テストは既存） |
| `src/preview/searPreview.gate.test.ts` | Production ON 後も本番ビルドに `cookSear` / `cookSearMs` が無いこと＋炙り UI（`cooking-sear-pill`）は載ることを実ビルドで確認 |
| `e2e/cooking-sear.spec.ts` | 「クエリ無しでピルが出ない」「`?cookPrep=on` で炙りが ON にならない」を ON の事実に合わせて書換（緩和・skip なし） |
| 画面証跡 | `docs/reports/screenshots/cooking-sear-production-on/` |

**変更していない:** GameScreen / App / reducer / recipes / ingredients（git diff 上 0）、炒める、蒸す（#726）、Batch 15、`docs/PROJECT_HANDOFF.md`、`persistence.ts`。

## 2. 保存互換性・既存調理法への影響
- 保存: `searedLook` は一時項目で保存されない（schema v2 不変）。ON 後も E2E（`cooking-sear.spec.ts`）で保存内容・採点が生と同一であることを確認。ON→OFF の巻き戻しにデータ移行は不要。
- 対象は sausage のみ・TOPPING の GUIDED / FREE_COOK のみ。Lunch Rush / Dinner / 他食材は reducer が拒否（`searIngredient.reducer.test.ts`）。
- 炒める（`PREP_EXPERIENCE_PRODUCTION`）は OFF のまま。ピルは食材で住み分け（sausage=炙る、beef=炒める、同時に出ない）。
- 変わるのは「Production の全プレイヤーが、sausage 選択時に任意の『🔥 炙る』ピルを見る」点のみ。
- Preview/DEV の `?cookSear=on` / `?cookSearMs=` / `?cookSearHv=1` は従来どおり Preview/DEV 限定（本番ビルドに存在しないことを実ビルドで確認）。

## 3. 検証（コード HEAD は本 PR の最終 commit。数値は実測）
| 項目 | 結果 |
|---|---|
| 全 Vitest | 589 files passed / 1 skipped、**11,043 tests passed**（13 skipped / 2 todo は既存）、失敗 0。※この後 reducer の OFF テスト 2 件を追加し、`searIngredient.reducer.test.ts`（25 件）は個別に通過 |
| `tsc -b` | エラーなし |
| lint | エラーなし（既存の警告のみ） |
| `npm run build` | 成功 |
| E2E（Chromium、390×844 / 360×800）炙り 3 spec ＋ 炒める・焼成・FINISH・Lunch Rush 系 | **150 passed / 0 failed**（12 skipped は既存）。既存テストの緩和・skip・timeout 延長なし |
| 画面証跡 | 下記 §4 |
- 実行環境メモ: 同梱の Chromium のバージョン差のため、repo 外の一時 config（`executablePath` のみ差し替え）で実行。repo の設定は無変更。
- CI（Vitest・WebKit 6 shard・Layout Contract）と Codex レビューは PR の Final Gate 節に記録する。

## 4. 画面証跡（`docs/reports/screenshots/cooking-sear-production-on/`）
- `before-*-00-feature-off.png`: Phase 1（OFF）のソーセージ選択後（ピル無し）。
- `after-*-00-production-default-pill.png`: **クエリ無し**でソーセージ選択 → 「🔥 炙る」ピル表示（390×844 / 360×800、目視確認済み）。
- `after-*-01-…raw-piece`／`03-screen-idle`／`05-holding-golden`／`06-released`／`07-seared-on-pizza`: 長押し→確定→盤面の流れ。
- HV 動画: **今回は撮っていない**（Policy は動画をユーザーへ直接提出する運用。コードの挙動は #725 から不変でフラグのみの変更。要否は Owner 判断）。

## 5. Owner の実機確認（merge・公開の前に必要）
既存の iPhone Safari HV 証跡（#724 / PR #725、Preview `2000dba4`）は再利用可との Owner 判断。ただし次は**未確認**:
1. **Safari ツールバー開閉時のピル表示**（帯⇄角の切替）: 未確認として記録（PASS 扱いにしない）。
2. 公開後の Production での最終確認（§6）。Owner の判定語（PASS / waived・日付・head SHA）は Owner が記録する。

## 6. 公開後の検証手順（Owner 承認で merge・Deploy した後）
1. `Deploy to GitHub Pages` が success、`E2E WebKit` の結果を確認。
2. Production をクエリ無しで開く（iPhone Safari と 390×844 / 360×800）。Free Cooking → TOPPING → ソーセージ選択 →「🔥 炙る」→ 短いタップで何も残らない → 約 3 秒の長押し → 離して「炙り済み」→ 盤面の色 → 焼成 → RESULT。
3. ソーセージ以外・Lunch Rush・Dinner でピルが出ない。炒めは出ない（OFF のまま）。
4. 炙った後にリロードしても Dex・所持数・進行が変わらず、得点・★・Pitz が生と同一。
5. 配信中の JS に `cookSear` / `cookSearHv` / `cookSearMs` が無い。
6. Safari ツールバーの出し入れでピルが画面外・生地の上に出ない。

## 7. ロールバック
1. **第一手段:** `SEAR_EXPERIENCE_PRODUCTION = false`（または本 PR の squash commit を revert）→ main → `deploy.yml` が再デプロイ（約 2.5 分）。
2. 巻き戻し後の挙動はテストで固定済み: reducer は `SEAR_INGREDIENT` を同一参照で拒否（`searIngredient.reducer.test.ts`）、UI はピルを出さない（`SearLayer.test.tsx`）。
3. 保存は炙りで書かれないため、データ復旧・移行は不要。
4. 緊急時: 直前コミット `cfbb083` の Deploy run の再実行（Owner 承認要。次の push で上書き）。

## 8. 未解決事項
- Safari ツールバー開閉時の表示は未確認（上記）。
- HV 動画は未提出（要否は Owner 判断）。
- Production DOM への影響: 全 Vitest・E2E で差分検知なし（専用の Production DOM golden は炙りに関して見つからず）。
- merge・Production Deploy は未実施（Owner の別承認が必要）。
