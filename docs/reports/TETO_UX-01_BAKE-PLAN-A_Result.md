# TETO-UX-01 — BAKE 案A（成功帯 幅40点・ゾーン常時表示）＋ Scoring 2.0 Debug 既定非表示 — Result Report

Status: **Draft PR・Owner 承認待ち（merge / Draft 解除 / Production ON / 共有 Preview 更新は未実施・禁止）**
Base: `main` 68c057b（#876）。作業ブランチ: `claude/pizza-bake-tuning-debug-f0qzfo`
独立: #874 / #875（topping-visuals）とは別 PR（ファイル重複なし）

## 1. 変更内容

### タスク1 — 焼き（Owner 決定「案A」。Issue #419 の「ゾーンを消して見た目で判断」を覆す仕様変更）
- `bakeTarget`（**直書きデータ**。算出ロジックなし）を全 116 レシピ（`recipes.ts` + `lateCatalog.ts`）で **幅20点→40点、中心不変**（start −10 / end +10）。中心は 55〜75 のため 35〜95 に収まり、クランプ・中心移動は不要だった。`staged/stagedPromotionCandidates.ts`（出荷済みレシピとの一致テストあり）と `src/trainKit/landed/*.json` も同様に追従。
- FREE の汎用窓 `FREE_COOK_BAKE_TARGET` は各レシピ窓の中央値から**算出**されているため、算出ロジックは無変更で自動的に **48–88（幅40・中心68）**。
- `BAKE_DURATION_S = 3` は不変。
- ゾーンのフェードを廃止（`BAKE_ZONE_FADE_START_S` / `_END_S` / `computeBakeZoneOpacity` と `BakeOverlay` の描画条件を削除。CUT 用 `bakeGuideFade.ts` は無変更）。緑ゾーンと JUST 帯が焼き終わりまで常時表示。
- `JUST_HALF_WIDTH_PT`（独立定数）を 3 → **7**。表示・5段階ラベル専用で `classifyBake`・Scoring 2.0 には供給されない。
- 焼きキャプションを Owner 承認文言「**緑のゾーンで焼き上げよう！**」へ。
- 予告表現（色変化・音）は入れていない（ゾーンが常時見えるため）。
- `tools/train-kit` の既定 `bakeTarget` を 48–88 へ（Owner 承認）。未適用の列車（Batch 26 等）が幅20で生成されるのを防ぐ。

### タスク2 — デバッグ表示
- `ScoringV2DebugPanel` は「`VITE_PREVIEW_MODE` が真 **かつ** URL `?debug=1`」のときだけ描画（`URLSearchParams`）。`VITE_PREVIEW_MODE` フラグ自体と PreviewBadge / SauceMetricsPanel / persistence は無変更。本番ビルドでの静的除去は維持（`dist` に文字列 0 件を確認）。
- 描画箇所は `GameScreen` の 1 箇所で、通常結果（発見・ガイド付き）と Lunch Rush の結果の両方を担う。

## 2. 最新 HEAD / コミット
| コミット | 内容 |
|---|---|
| 092a44d | タスク2: debug を `?debug=1` のみに |
| 3033461 | タスク1: 案A（幅40・フェード廃止・JUST ±7） |
| 2a216e7 | キャプション変更 |
| 6c5e2b7 | E2E 4 ファイルの窓の取り直し |
| （本レポート＋スクリーンショットのコミット） | 最新 HEAD は PR 本文を参照 |

## 3. 競合確認
- 最新 `main` = 68c057b（当ブランチは遅れ 0）。
- mid-bake #829 / #830 / #832 / #834（+ docs #827）: 触るのは新規 `src/logic/midBake/**`・`src/components/midBakeLab/**`・`src/preview/**` と `main.tsx` 等。`bakeProgress` からは `BAKE_DURATION_S` と `clampBakeFrameDt` のみを import しており、**どちらも残している**。Lab の窓は独自の 0.65–0.9 で `bakeTarget` と無関係。競合なし。
- #874 / #875（topping-visuals）: `IngredientPieceVisual*` 等。#875 の E2E は `FREE_COOK_BAKE_TARGET`（定数）経由で、窓が変わっても追従する。競合なし。
- 食材・レシピ追加系: 未マージの追加 PR は docs/計画のみ（#813 / #859 / #781 等）。**Batch 26（#866）の `apply` は claim で HOLD**。適用時は Train Kit 既定（今回 48–88）が使われ、幅40で生成される。リポジトリ内に 58–78 を明記した未適用 spec は見つからなかった。
- 関連 open Issue: #482（bake failure policy＝窓の外は必ず失敗）は今回の変更と整合（窓が広がるだけ）。
- Owner Gate（read-only dry-run）の最新レポートは Actions 実行が必要で、このセッションからは未実行。HOT 重複（`recipes.ts` 等）は上記のとおり競合する open PR なし。

## 4. 検証結果
| 項目 | 結果 |
|---|---|
| 全 116 レシピ 幅40・中心 55–75・0〜100 内 | PASS（`src/data/bakeTargetWidth.test.ts`。中心不変は書き換えスクリプトで assert 済み） |
| Vitest 全体（最終） | 12,729 passed / 20 skipped / 2 todo、失敗 0（一時ファイルを拾った 1 件を除く） |
| `tsc -b` | exit 0 |
| `oxlint` | 既存警告のみ（エラー 0） |
| `npm run build` | 成功。`dist` に「Scoring 2.0 Debug」0 件 |
| Chromium E2E 390×844 | 792 件中 690 passed / 98 skipped / **4 failed → 修正後に該当 5 ファイルを再実行して 44/44 PASS**（失敗は旧窓前提の狙い値だった） |
| Chromium E2E 360×800 | 792 件中 660 passed / 132 skipped / 0 failed |
| **WebKit E2E** | **ローカル未実施**（このコンテナに WebKit が無い）。CI の `e2e-webkit.yml`（PR ごと）を権威とする |
| 発見モード・ガイド付き・Lunch Rush・CUT・自由調理・デバッグ | 下記 |

- 通常 URL: 発見（採点あり／なし）・Lunch Rush の結果に「Scoring 2.0 Debug」**0 件**（390×844 / 360×800）。
- `?debug=1`: 発見（レシピ一致＝採点あり）・ガイド付き・Lunch Rush の結果に **1 件**表示。
- 採点なしの「オリジナルピザ」結果は元々パネルが出ない（main でも 0 件）。今回の変更ではない。
- CUT: ガイド付き・Lunch Rush とも、窓内の取り出し → CUT → 結果の流れを実ブラウザで確認（動画に含む）。窓外は CUT スキップ（既存 E2E 通過）。

## 5. Scoring 2.0 / ★ / Pitz への影響（main と本ブランチを同一入力で比較）
全 116 レシピ × 焼き位置 0〜100（2.5 刻み）、理想のピザ、計 4,756 点。

| 区分 | 件数 | total / ★ / Pitz |
|---|---:|---|
| 旧窓の内側（合格 → 合格） | 901 | **差分 0**（完全一致） |
| 窓の中心 | 116 | **差分 0** |
| 旧窓の外側 → 新窓の内側（失敗 → 合格） | 880 | 全て ★5・Pitz 120（理想のピザ）。以前は失敗＝報酬 0 |
| 失敗 → 失敗 | 2,975 | 計算上の total は動くが、失敗は採点・報酬が付かないので影響なし |

- **式・係数は無変更**。Bake 成分は窓内で常に 100 点（既存仕様）なので、新たに合格になる帯は満点側になる。
- `FREE` の判定窓が 58–78 → 48–88 になったため、`sauceB1.singleSource.json`（golden）の **marinara の `free` 10 行のみ**が変化（中心55で焼くと旧窓は生焼け失敗→新窓は合格）。差分はその 10 行のみであることを確認して更新。
- `lateCatalog.offSurface.json` の recipes ダイジェストも更新。窓を元の幅に戻すと旧ダイジェストと**完全一致**するので、差分は `bakeTarget` のみ。

## 6. Human Verification

### Human Verification Videos
| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| teto-ux01-bake-plan-a-hv-390x844.mp4 | 390×844 | 63.2 s | 1.80 MB | PASS |
| teto-ux01-bake-plan-a-hv-360x800.mp4 | 360×800 | 62.6 s | 1.71 MB | PASS |

Download: セッション内直接提出（動画は repository に commit しない）。コーデック H.264、30fps。Playwright の WebM を ffmpeg で MP4 化。Preview ビルド（`VITE_PREVIEW_MODE`）での実時間操作。

Video Verification: PASS（存在・サイズ>0・最後まで再生・viewport 全体・対象操作が映る を確認）

この動画で確認できること:
1. 焼き中、緑ゾーンと濃い JUST 帯が最後まで見え続ける（旧: 約1.2秒で消える）
2. 新キャプション「緑のゾーンで焼き上げよう！」
3. ガイド付きマルゲリータ: 窓内で取り出し → CUT → 結果（焼き加減: ジャスト）
4. 通常 URL の発見・Lunch Rush 結果にデバッグ表示が出ない
5. `?debug=1` のガイド付き・Lunch Rush 結果、発見（採点あり）で「Scoring 2.0 Debug」が出る

### Screenshots（`docs/reports/screenshots/bake-plan-a/`、24 枚）
`before-` / `after-` × {390×844, 360×800}。焼き針 8 / 36 / 60 点での Before/After、窓内の取り出し、デバッグ非表示／表示の結果画面。

## 7. レビュー
- Codex: PR 作成後に依頼（結果は PR 参照）。利用不可の場合は別コンテキストの読み取り専用エージェントで独立レビュー。

## 8. 残課題
- **WebKit E2E は CI での確認待ち**。実機（iPhone）の Human Feel は Owner 判断。
- **バランス**: 窓が 1.2 秒になり、窓内は常に Bake 100 点なので ★5 に届きやすくなる（Bake 以外の成分は無変更）。「簡単すぎる／見た目で判断する楽しさが消えた」と感じた場合の最小の巻き戻しは、幅40のまま**フェードだけ復活**。
- Preview ビルドでは `CutDebugPanel` / `SauceMetricsPanel` は引き続き常時表示（今回の範囲外）。
- `PROJECT_HANDOFF.md`（HOT ファイル）には追記していない（並行 PR との衝突回避）。過去の Result（#419 等）はフェード前提の記述が残る（履歴として未改変）。
- E2E フルラン中に既存スクリーンショット（`cooking-tray-family-filter`）が書き換わる副作用があるが、本 PR には含めていない。

## 9. プロンプト往復数
ユーザー指示 3 回（初回タスク、精査版 v2 プロンプト、TETO-UX-01 の承認と指示）。
