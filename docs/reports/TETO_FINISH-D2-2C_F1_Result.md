# FINISH D2-2c F-1 — 後乗せありの roomy（CUT）で dough が広がる問題の修正（Issue #592、本番では不活性）

base `main` `073a1d0`（PR #591 merge 後）。Owner 判断: F-1 の実装を承認。F-2 / F-3 は含めない。FINISH 本体は有効化しない（`finishD2Inert.test.ts` は変更なし）。#468 / #478 / #584 / Pinsa P3 には触れていない。共有 Preview は更新していない。**#518 は close しない。**

## 変更（`src/` は `App.css` の 8 行のみ）

| ファイル | 内容 |
|---|---|
| `src/App.css` | `.pizza-stage--post-layer` に `grid-template-columns: minmax(0, max-content)`、`.pizza-stage--post-layer > .pizza-dough { max-width: 100% }` を追加（コメント付き）。`PizzaStage.tsx` は変更なし |
| `e2e/post-layer-d22a.spec.ts` | F-1 の回帰テスト 5 件 × 2 viewport |
| `docs/reports/screenshots/d2-2c-f1-roomy/` | roomy（CUT）の before / after / 後乗せなしの基準 |

後乗せがないときは `.pizza-stage--post-layer` が付かないので、通常画面の CSS・DOM は変わらない（クラスが付かない限りこの 2 ルールは効かない）。

## 原因と効き方

従来の stage は flex 行で、dough の幅（`min(92vw, 380px, …)` = 358.8 / 331.2）が stage の内容幅（358 / 328）を超えると flex-shrink で幅だけ縮む。`.pizza-stage--post-layer`（#588）は grid のため縮まず、dough が円（358.8² / 331.2²）になっていた。1 列を `minmax(0, max-content)`（dough の希望幅まで・stage の幅は超えない）にし、dough を列幅で頭打ち（`max-width: 100%`）にすることで、flex 時と同じ「stage の幅まで縮む」挙動に揃えた。レイヤーは同じ列に stretch するので dough と一致する。

## 実測（実 cooking skeleton の harness、Chromium）

harness は `e2e/harness/finish-hv.html`（実 `PizzaStage` × 実 cooking skeleton、各ブロック高さは実ゲームの実測値。D2-2b で実ゲームと dough 矩形が完全一致することを確認済み）。

| viewport / モード | 後乗せなし（flex） | 後乗せあり: 修正前 | 後乗せあり: 修正後 | レイヤー = dough（修正後） | 後乗せ座標誤差（修正後） |
|---|---|---|---|---|---|
| 390×844 compact | 290 × 290 @ (50, 262.5) | 同じ（差 0） | 同じ（差 0） | 一致 | 0.01px |
| 390×844 roomy | 358 × 358.8 @ (16, 265.09) | 358.8 × 358.8 @ (15.61, …)（+0.8） | **358 × 358.8 @ (16, 265.09)（差 0）** | 一致 | 0.01px |
| 360×800 compact | 273.59² @ (43.2, 248.7) | 同じ（差 0） | 同じ（差 0） | 一致 | 0.01px |
| 360×800 roomy | 328 × 331.19 @ (16, 256.91) | 331.19 × 331.19 @ (14.41, …)（+3.19） | **328 × 331.19 @ (16, 256.91)（差 0）** | 一致 | 0.01px |

四角天板（`?pan=square`）も compact / roomy × 2 viewport で、後乗せあり / なしの dough 矩形が一致し、レイヤー = dough（テストで確認）。

## 回帰

| 項目 | 結果 |
|---|---|
| 後乗せなし（焼成 4 状態）、通常 CUT（0 本 / 3 本）、四角天板（後乗せなし: 焼成なし / 焦げ / CUT）の画素、両 viewport | **18 枚すべて main（`073a1d0`）と画素一致**（`tools/finishD22bHvCompare.mjs`: ALL IDENTICAL） |
| D2-2a / D2-2b の既存の後乗せレイヤー検証（色が焼成で変わらない、座標、タップ透過、後乗せなしの flex） | PASS（`post-layer-d22a.spec.ts` の既存 5 件 × 2 viewport） |
| `PizzaStage.postBakePiece.test.tsx`（11 件）、`tsc -b` | PASS |

追加テストの感度: `App.css` の変更を外すと、roomy の 4 件（CUT / CUT 四角天板 / roomy の幅）× 2 viewport が失敗し、compact は元から通ることを確認した（compact に差は無い）。

## Human Verification

動画は撮っていない。理由: 変化は roomy で最大 3.2px の dough 寸法のみで、Issue #592 の受け入れ条件でも動画 HV は不要（スクリーンショットと実測）としている。before / after のスクリーンショット（390×844 / 360×800、roomy）は `docs/reports/screenshots/d2-2c-f1-roomy/`。HV Policy の動画要件に対する扱いは Owner 判断（この変更だけでは FINISH 画面が出ないため、動画 HV は FINISH 画面の実装時にまとめて行う）。

## 範囲外・残り

- F-2（CUT 後の後乗せ変色。カット時の後乗せ専用レイヤー、SVG lighting は後乗せに適用しない）、F-3（CUT 線を後乗せより前面に出す案 (b)）は別 Issue / PR。
- FINISH 本番有効化、D2-2 本体（GameScreen の FINISH 画面）は未着手。
- 実 WebKit での確認は CI の WebKit shard に任せる（このセッションは Chromium）。
