# FINISH D2-2c F-3 — CUT 線を後乗せ食材より前面に表示する（Issue #597、本番では不活性）

base `main` `38bbe3c`（PR #596 = F-2 の merge 後）。Owner 承認: **案 A（CUT layer / tool layer の移設）**。FINISH は有効化しない（`finishD2Inert.test.ts` は変更なし）。後乗せへの bake filter / SVG lighting は適用しない。貫通カットの離れ目の影（`.pizza-pieces` の relief）は F-3 の範囲外。#468 / #478 / #584 / Pinsa P3 には触れていない。共有 Preview は更新していない。**#518 は close しない。**

## Duplicate Gate

- 開いている PR の変更ファイルを API で全件確認。F-3 のファイルに触れるのは #584（`App.css` ~L753）、#468（`PizzaStage.tsx` / `App.css`、Pilot。触れない）、#321 / #34（古い）のみ。#595（F-2 の重複）は close 済み・再 open しない。
- Issue #597 に claim コメントはなし（Owner の引き継ぎコメント 1 件のみ）。F-2 の実装コードは #595 から移植していない。

## 現状測定（修正前）

`e2e/harness/finish-hv.html?onguide=1`（後乗せがガイド線 0 / 60 / 120° と中心の上にある）。`tools/finishD22cF3Measure.mjs` で「CUT 描画が変える画素のうち後乗せ piece の上にあるもの（差 > 60）」を数える。

**事実: bake=none の CUT 線は元から後乗せの前面だった。** `.pizza-dough` は bake のときだけ `filter` で stacking context を作る。none では作らず、dough 内の `.pizza-cut-layer`（z-index 4）/ `.pizza-cut-tool-layer`（6）が stage の stacking context に出て、兄弟の後乗せレイヤー（z-index auto）より上に描かれる。raw / perfect / burnt では dough が context を作るため、dough 内の CUT 描画は兄弟の後乗せの**下**になる（→ F-3）。

| シナリオ（390×844） | none | raw | perfect | burnt |
|---|---|---|---|---|
| ガイド線 + 中心 | 196 | 56 | 51 | 16 |
| ドラッグ中（プレビュー + ナイフ） | 562 | 181 | 168 | 125 |
| 部分カットの溝 | 529 | 56 | 123 | 115 |
| 貫通カット直後（flash） | 326 | 122 | 145 | 176 |
| 3 本カット後 | 370 | 96 | 128 | 163 |

360×800 も同傾向（none 177 / 510 / 495 / 288 / 330 に対し raw〜burnt は 0.1〜0.5 倍）。

## 変更

| ファイル | 内容 |
|---|---|
| `src/components/PizzaStage.tsx` | CUT 描画（`.pizza-cut-layer` と `.pizza-cut-tool-layer`）の JSX を `cutLayer` / `cutToolLayer` に切り出し（中身・ref・条件は無変更）。後乗せなし: 従来どおり dough 内の同じ位置。後乗せあり: `.pizza-post-layer` の末尾（後乗せ piece の後）に置く。capture zone（`.pizza-cut-hit-zone`）は dough 内のまま |
| `src/App.css` | `.pizza-post-layer > .pizza-cut-layer` / `> .pizza-cut-tool-layer`: `inset: 0`、cut layer は `100%` 寸法、`z-index: auto`（レイヤーが既に dough の border-box のため outset 不要。重なりは DOM 順で決める） |
| `src/components/PizzaStage.postBakePiece.test.tsx` | F-3 の 4 件（移設先・DOM 順・同一の描画・RESULT・後乗せなしで不変） |
| `e2e/post-layer-d22a.spec.ts` | F-3 の実画素 / 実 DOM テスト 8 件 × 2 viewport |
| `e2e/harness/finish-hv.tsx` | `step=RESULT&cuts=0..3`（確定済みカットの RESULT 表示）を追加（テスト用ハーネスのみ） |
| `tools/finishD22cF3{Measure,Shots,Video}.mjs` | 測定・比較画像・動画の検証ドライバ（dev のみ） |
| `docs/reports/screenshots/d2-2c-f3-cut-front/` | before（左）\| after（右）の比較 24 枚（raw / burnt × 6 場面 × 2 viewport） |

既存のカット状態・ref（`cutGuideGroupRef` / `cutPreviewLineRef` / `cutCutterIconRef`）・描画関数は再利用。ポインタ計算は dough の rect を使い続けるので変わらない。F-2 のコード（`.pizza-post-layer__pieces` 等）は変更なし。

## 検証

| 項目 | 結果 |
|---|---|
| 修正後の測定（同じ指標） | **PASS**: raw / perfect / burnt が none と同水準に（390×844: ガイド 202 / 192 / 155、プレビュー + ナイフ 567 / 555 / 524、溝 508 / 531 / 513、flash 321 / 326 / 338、3 本 356 / 374 / 383。none は前後とも同一値）。360×800 も同様 |
| 前面表示のテスト（実画素） | 4 場面 × 4 bake で、raw / perfect / burnt の「後乗せ上の CUT 描画」が none の 0.6 倍以上（修正前は 0.08〜0.5 倍）。変更を戻すと失敗することを確認 |
| ガイド線・プレビュー線・ナイフ・部分カット溝・flash・3 本・RESULT | **PASS**（e2e + 動画 + 比較画像）。ナイフ先端はプレビュー終点と ±1.5px、溝の終点は指を離した位置 |
| 後乗せ位置の連続性 | **PASS**: ドラッグ中・部分カット後は後乗せが動かない（< 0.05px）。貫通カット確定で各 whole は piece の離れ（≤ 1.5px、全員 < 1.6px、名目位置 + translate と ±0.5px）のみ。ジャンプなし |
| F-2 の後乗せ画素不変 | **PASS**: CUT 描画を隠した状態で、カット 0 / 3 本 × raw / perfect / burnt の後乗せ画素が none とバイト一致（F-2 の既存 4 件も PASS） |
| 後乗せなしの画素 | **PASS**: main（`38bbe3c`）と 18 枚中 15 枚が一致。残りの 3 枚（焦げ 2 枚 = 煙アニメーションのノイズ、390×844 の CUT 3 本 1 枚 = 6 値・最大差 2）は、同一 build（本 PR）の再撮影同士でも同程度の差が出る（再撮影では main との差の出る枚が入れ替わる）。後乗せなしの DOM は不変（unit + e2e で cut layer / knife が dough 内、stage は flex） |
| レイヤーの寸法 | cut layer / knife layer の矩形 = dough の矩形（±0.05px、390×844 / 360×800、丸・四角天板）。F-1 の dough 寸法は不変 |
| タップ透過・連続ドラッグ | **PASS**: capture zone は dough 内に維持。後乗せ上の `elementFromPoint` はレイヤー外、間を空けずの 3 連続ドラッグ（先頭は後乗せ上）が 3 本として確定、CUT 描画の `pointer-events: none` |
| 四角天板 + 後乗せ + CUT | 丸と同様（描画はレイヤー内・dough の矩形・後乗せの前面）。観察のみ、追加 Issue なし |
| `tsc -b` / oxlint | PASS / 新規警告なし |
| vitest（`src/components` + `finishD2Inert`、86 ファイル） | 1434 PASS |
| e2e（`post-layer-d22a` + 既存 CUT 4 spec、2 viewport） | 63 PASS / 5 skipped（既存） |
| 実 WebKit | 未確認（このセッションは Chromium）。CI の WebKit shard に任せる |

## 副作用（想定内・記録）

- 後乗せがあるときだけ、CUT 描画（ガイド・溝・プレビュー・flash）に dough の bake filter（saturate / brightness / contrast）が掛からなくなる。bake=none の見た目（元から filter なし）と同じになり、raw / perfect / burnt でも CUT 線の色が bake で変わらない。後乗せなしの画面は不変。
- 貫通カットの離れ目の影（`.pizza-pieces` の relief）は dough 内のままで、後乗せの下（F-3 の範囲外、Owner 指示どおり）。

## Human Verification

390×844 / 360×800 の動画（各 約 51 秒、H.264 / yuv420p / faststart、音声なし、`ffprobe` / 最後までのデコード確認済み）をセッション内で直接提出（commit しない。Policy §6）。場面: ① ガイド線（生焼け / ジャスト / 焦げ）、② ドラッグ中のプレビュー線とナイフ → 部分カット、③ 貫通カットと flash・3 本、④ 切った後の bake 切替（後乗せの色不変）、⑤ 切り直し・溝、⑥ RESULT（生焼け / 焦げ）、⑦ 四角天板。

## 範囲外

貫通カットの離れ目の影、FINISH 本番有効化、D2-2 本体（GameScreen の FINISH 画面）、共有 Preview の更新。#518 は OPEN のまま。
