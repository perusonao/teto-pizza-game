# Cooking Tray family row — stable row (Issue #447) — Result Report

Base `origin/main` **`44879be`** (Batch 6 PR-3 反映後)。Branch `claude/pizza-game-ux-mobile-audit-cj3d55`。PR は Owner HV 承認までマージしない。
Owner Decision: 改善案 B（トレイ 2 行固定 + family 毎の y を検証する E2E + docs 整合）。**dead code 整理、#380 / #369 のクローズは対象外**。

## 0. 問題

Research UX Fresh Audit（読み取り専用、main `44879be`）で発見。分類タブで結果が 3 件以下の family（1 行）を選ぶと、タブ行が 70px 下へ移動する。

| viewport | 状態 | タブ行 y | トレイ y | トレイ高さ |
|---|---|---:|---:|---:|
| 390×844 | すべて / 4〜6 件の family | 548 | 594 | 134 |
| 390×844 | 果物系（1 行） | **618（+70）** | 664 | 64 |
| 360×800 | すべて / 4〜6 件の family | 504 | 550 | 134 |
| 360×800 | 果物系（1 行） | **574（+70）** | 620 | 64 |

原因: `.prepare-dock` は `justify-content: flex-end`（トレイが CTA に張り付く）で dock は 216px 固定（2 行分を予約済み）。トレイは 1 行（≤ 3 件）で 64px、2 行（4〜6 件）で 134px に伸縮し、タブ行はトレイ直上にあるためトレイが縮むと 70px 引き下げられる。
見逃した理由: `cooking-tray-family-expanded.spec.ts` の "nothing moves per family" は、全 family を巡回して「すべて」へ戻した**後**の dock / trayTop / barTop だけを比べ、途中の family のタブ行 y を見ていなかった。

## 1. 変更

- `src/App.css`（CSS のみ、DOM 変更なし）:
  `.ingredient-panel:has(> .tray-family-row) .ingredient-tray { min-height: calc(2 * var(--chip-h) + var(--tray-gap)); align-content: start; }`
  タブ行が表示されている間だけトレイを常に 2 行分（64px 系 134px / 短い高さの 58px 系 122px）に固定。カードは枠の上端に並び、余った行は空。dock は元から 2 行分を予約しているので、dock 全体の高さ・ピザ・pager・bake bar は変わらない。タブが出ない場合（所持 6 件以下）や Guided / Lunch Rush のトレイには適用されない。
- 変更していないもの: ラベル・family 分類・`chipRowAlign` のスクロール / フェード挙動・ページング・Pantry（食材庫は復活させていない）・データ・save・Production DOM golden（DOM 差分なし）。
- 新規 E2E `e2e/cooking-tray-family-row-stable.spec.ts`（既存 spec は無改変）。
- docs: `docs/PROJECT_HANDOFF.md` に現行仕様の addendum、`TETO_COOKING-TRAY-FAMILY-MOBILE-UX_Result.md` §8 と `TETO_COOKING-TRAY-FAMILY-FILTER_Result.md` 末尾に追記（過去の記録は無改変。#399 後の「常にトレイの上」への変更、食材庫廃止、`familyRowFits` が呼ばれていないことを明記）。

## 2. 実測（修正後、Chromium）

| viewport | タブ行 y（全 family で） | トレイ高さ | dock | ピザ |
|---|---:|---:|---:|---:|
| 390×844 | 548 | 134 | 216 | 290 |
| 360×800 | 504 | 134 | 216 | 273.6 |

390×664 / 360×640 でも各 family でタブ行 y は一定（トレイ 122px）。

## 3. 回帰テスト

`cooking-tray-family-row-stable.spec.ts`（390×844 / 360×800 / 短い 390×664 / 360×640 × FREE all owned / FREE 8 chips / Research ＋ 最終ページまでのページ送り）:
- 到着時のスタック（タブ行 y・高さ、トレイ上端・高さ、先頭カード上端、pager y、dock 高さ、bake bar y）を記録し、**family を切り替える度に**同じ値かを検証（途中の family、再訪の順序を変えた巡回を含む）。ピザ幅も各ステップで検証。
- カバレッジも assert（1〜3 件の family、4〜6 件の family、「すべて」の満ページを含むこと）。含まないデータでは失敗するので、偶然通らない。
- **修正前（main の CSS）では family 巡回 12 件が失敗**（`Expected 548 / Received 618`、差 70）、修正後は 16 件すべて PASS。

## 4. 検証結果

| 項目 | 結果 |
|---|---|
| `tsc -b` | クリーン |
| oxlint | エラー 0（既存の警告 3 件のみ、今回の差分に無関係） |
| `npm run build` | OK |
| Vitest 全体 | 370 files 中 369 PASS / 6887 PASS、1 FAIL。FAIL は `HintSheet.test.tsx` の anti-spoiler DOM sweep の **5000ms タイムアウト**（全体並列の負荷による。単独では 33/33 PASS、変更を除いた main でも単独で PASS）。今回の変更（CSS のみ）との関係は無い |
| Chromium E2E（iphone-390x844 / 360x800 / layout-chromium）: 新規 spec、`cooking-tray-family-{filter,expanded,mobile-ux,responsive}`、`family-layout-contract`、`layout-contract` | 79 passed / 66 skipped（既存の OD-V-6 once-per-engine skip）/ 0 failed |
| 追加 Chromium E2E: `free-cooking-phase3-2`、`dinner-mission`、`research-*`、`layout-invariants-lb` | 本書末尾の追記を参照 |
| WebKit E2E | **ローカル未実行**（この環境に WebKit が無い）。PR の CI（`e2e-webkit.yml`）の結果で確認する |

## Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `tray-family-row-stable-after-390x844.mp4` | 390×844 | 34.0 s | 329 KB | H.264 | PASS |
| `tray-family-row-stable-before-390x844.mp4` | 390×844 | 34.4 s | 339 KB | H.264 | PASS |
| `tray-family-row-stable-after-360x800.mp4` | 360×800 | 34.2 s | 317 KB | H.264 | PASS |
| `tray-family-row-stable-before-360x800.mp4` | 360×800 | 34.5 s | 329 KB | H.264 | PASS |

Download: セッション内直接提出（コミットしない）。before = main の CSS、after = 修正後。Playwright の WebM を ffmpeg で MP4/H.264 へ変換（ffprobe で codec / 解像度 / 長さを確認、フレームを抽出して内容を確認）。

Video Verification: PASS

確認してほしいこと（動画の流れ）: 具材ステップ到着 → 肉系（4〜6 件）→ 果物系（2 件）→ スパイス・薬味系（1 件）→ ちょっと変わった材料（3 件）→ ハーブ → 魚介 → 果物系でパイナップルを置く → すべて → ページ送りで最終ページ → 前ページ → 焼く。
- 画面に重ねた赤い破線は、到着時のタブ行の y（検証用に Playwright で重ねたもの。アプリ自体には無い）。**before ではタブ行が 1〜3 件の family で破線より下へ落ち、after では常に破線上にある**。
- カードが 1 行の時はトレイ枠の上端に並び、下に空の 1 行分が残る（見た目の差はこの空白のみ）。
- ピザの大きさ、pager、焼くボタンの位置が変わらない。

Screenshots（コミット済み）: `docs/reports/screenshots/cooking-tray-family-row-stable/`
- `before-<viewport>-*` / `after-<viewport>-*`: 01 すべて、02 肉系（4〜6）、03 果物系（1 行）、04 スパイス（1 件）、05 ちょっと変わった（3 件）、06 配置後のすべて、07 最終ページ、08 焼く
- `compare-<viewport>-fruit-1row-before-after.png`（左 before、右 after）

実機 HV 要否: 見た目・タップ操作感の確認が必要（UI 変更）。Owner の判断項目。

## 5. 残るリスク

- 1 行の family では、トレイ下に 64px 分の空白が出る（dock の予約高さ内。pager は従来どおり下端）。
- `:has()` を使用（既存 CSS で使用済み。Safari 15.4+）。WebKit は CI で確認。
- `familyRowFits` ほか dead code は残したまま（Owner 指示により別件）。
