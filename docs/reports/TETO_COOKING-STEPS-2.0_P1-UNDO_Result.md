# TETO Cooking Steps 2.0 Phase 1 — Undo last placement（↩ 1つ戻す）実装結果

**Issue:** #449（親 #270、トラック #294） / **Base:** main `44879be0c0cd038a50fc224c7b2ca1442285510f`
**Branch:** `claude/cooking-steps-p1-undo-449`
**設計:** `docs/reports/TETO_COOKING-STEPS-2.0_FINISH-Pilot_Pre-Implementation-Design.md` §3 / §8.1（branch `claude/cooking-steps-2-audit-design-gzc9rp`、未main）
**Owner 採用方針:** UD-A（Guided / Free Cooking / Research / Dinner。Lunch Rush は対象外）

## 1. 変更内容

| 項目 | 内容 |
|---|---|
| ルール | `src/state/undoPlacement.ts`（純関数）。`PREPARE` かつ `makingStep ∈ {CHEESE, TOPPING}` かつ Lunch Rush でないとき、`pizza.toppings` の末尾から見て**現ステップのカテゴリに一致する最初の piece**が対象。履歴スタックなし |
| Reducer | `UNDO_LAST_PLACEMENT`（payload なし）。対象 piece を除去し、`hint` を再計算、`placement: null`。ルールが −1 なら state 不変（同一参照）。Dinner は `DINNER_COMPOSITION_ACTIONS` に追加（PREPARE 外・非 PLAYING では拒否） |
| UI | `.prepare-bake-bar` に **↩ ボタン**（`aria-label="1つ戻す"`、44×44、`やり直す` の隣）。Lunch Rush の PREPARE では描画しない。それ以外の PREPARE の全ステップで**スロット固定**（対象外は disabled）。タップで `pizzaResetToken` を更新し、飛行中のトレイドラッグを無効化（`やり直す` と同じ世代トークン） |
| CSS | `.prepare-undo-button`、`.prepare-bake-bar--undo`（↩ があるバーだけ gap 6px / 側面 padding 10・12px / CTA `nowrap`） |

**対象外（実装していない）:** 焼成、ソース、DOUGH、CUT、確定済みステップへの遡り、FINISH、`stage`、TQ-2、BBQチキン型、こねる/ちぎる。

## 2. 実測で見つけた問題と対処（360×800）

↩ を単純に足すと、360 幅（内幅 328px）で CTA が 151px → 97px に縮み、「🔥 焼く！」が 2 行に折り返してバー高が 54 → 70px になった。**↩ があるバーに限り** gap と側面 padding を詰め、CTA を `nowrap` にして解消（360: CTA 125px、390: 155px、バー高は全ステップで一定）。Lunch Rush のバー（↩ なし）は従来どおり。

| 360×800 の各ボタン幅 | やり直す | ↩ | CTA | ヒント |
|---|---:|---:|---:|---:|
| main | 85 | — | 151 | 72 |
| 本PR | 77 | 44 | 125 | 64 |

全ボタン高さ ≥ 44px、重なりなし、横オーバーフローなし（E2E で全ステップ検証）。

## 3. 不変であること

- **スコア / Completion Gate / Discovery / Technique / Dex / Pitz:** 最終ピザのみが入力。コード変更なし（`CONFIRM_BAKE` 以降は無変更）。
- **在庫:** PREPARE 中は触らない。「置く→戻す→置く」で `CONFIRM_BAKE` の消費は 1 回（テスト）。Stock Gate は piece 個数を数えるので戻すと枠が空く（テスト）。
- **Cooking Timing:** 触らない（`RESET_PIZZA` と同じ）。
- **保存:** `GameState` は保存されない。schema・save 変更なし。
- **既存レシピ・既存セーブ:** 新アクション追加のみ。

## 4. テスト

| 種別 | 結果 |
|---|---|
| 新規 Vitest（reducer 12 件 / GameScreen 6 件） | 18 件 PASS |
| Vitest 全体 | **372 files / 6906 passed, 1 skipped** |
| `tsc -b` / `vite build` | clean / 成功 |
| oxlint | 新規の指摘なし（既存 warning 3 件のみ: `scoringV2.noSauceProfile.test.ts`、`expansion-batch6.spec.ts`） |
| 新規 E2E `e2e/undo-placement-449.spec.ts`（390×844 / 360×800 の Chromium、各 4 件） | 8 件 PASS |
| 既存 E2E（Chromium 390/360/layout-chromium）: `layout-contract`（7 profiles）, `making-ui-1screen`, `dynamic-cooking-steps`, `viewport-1screen` | 全 PASS（69 passed, 7 skipped） |
| 既存 E2E: `dinner-mission`, `cooking-tray-family-expanded`, `pizza-cutting-phase4b`, `layout-invariants-lb` | 全 PASS（81 passed, 45 skipped） |
| WebKit | **ローカル未実行**（CI の WebKit ジョブが権威） |

新規テストの要点: 直近 1 個のみ除去／連続 Undo 後は no-op（同一 state）／前ステップの cheese に届かない／DOUGH・SAUCE・BAKE 以降は拒否／pizza・hint・placement 以外の state が不変／Lunch Rush 拒否・Free Cooking・Dinner 許可／ボタンの有効・無効・Lunch Rush 非表示／E2E でステップ間のボタン位置・44px・重なり・オーバーフロー。

## 5. Human Verification 素材

- スクリーンショット（committed）: `docs/reports/screenshots/cooking-steps-p1-undo-449/{before,after}/`（390×844 と 360×800。DOUGH / CHEESE 空 / CHEESE 3個 / [after のみ] ↩後 / TOPPING / [after のみ] ↩で全部戻して cheese が残り ↩ が disabled / RESULT）
- 動画（**commit しない**、Owner へ直接提出）: `artifacts/review/undo-449-390x844.mp4`（H.264、12.96s）、`artifacts/review/undo-449-360x800.mp4`（360 幅の収まり確認用）。シナリオ: 生地→ソース→チーズ 3 個→↩→再配置→具材 2 個→↩×2（↩ が disabled、cheese は残る）→再配置→焼成→CUT→RESULT
- 備考: 動画は Playwright の合成入力で撮影（実機の指操作ではない）。実機での片手操作感は Owner HV で確認。

## 6. 未実施 / 次の確認

- 最新 HEAD の CI（WebKit、Layout）と Codex レビュー、Owner HV。merge は Owner 承認まで行わない。
- `docs/PROJECT_HANDOFF.md` は競合しやすいため本PRでは更新していない（merge 後に 1 回で追記する想定）。
- プレイヤー向け changelog への追記は Owner 判断。
- 関連 open PR #448（#447 トレイ高さ）はトレイ領域のみで、本PRの下部バーとは別領域（ファイル重複は `App.css` の別ブロック）。
