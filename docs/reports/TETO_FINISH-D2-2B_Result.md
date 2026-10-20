# FINISH D2-2b — 後乗せレイヤーの動画 Human Verification と原因調査（検証のみ、runtime 変更なし）

base `main` `8de0162`（#588 = D2-2a の merge 後）。Owner 指示: D2-2b は動画 HV と原因調査を中心に進め、CUT 対応の実装修正は別 PR に分離する。#478 は待たない。#468・#478・#584・Pinsa P3 には触れていない。共有 Preview は更新していない。**#518 は close しない**（FINISH 画面・有効化が残っている）。

**runtime のソース（`src/`）は 1 行も変更していない。** 追加したのは検証用の harness と driver だけ（下記）。

## 事前確認

- CLAUDE.md / PROJECT_HANDOFF.md / D2-2a Result Report / PR #588 の代替レビュー結果（blocker・major なし、minor 2・nit 3）を確認。
- Duplicate Gate: open PR に D2-2b / 後乗せ関連なし（#581 = 四角天板 UX、#579 = 液体の後乗せ、いずれも別件。#468 / #478 / #584 / #540 には触れない）。

## 検証方法（実画面との対応）

FINISH 画面は GameScreen にまだ無い（D2-2）ため、実ゲームでは後乗せを出せない。そこで **本物の `PizzaStage` を、本物の cooking skeleton（`.app-frame > .game-screen.game-screen--cooking`）に入れた harness**（`e2e/harness/finish-hv.html`）で検証した。skeleton の各ブロック高さは実ゲーム（マルゲリータ、TOPPING / CUT）を 390×844・360×800 で実測した値（header 56 / tabs 44 / order-card 78→CUT 44 / dock 132 / cut-readout 24 / action-row 70）。

**忠実度の確認:** 後乗せなしの harness の dough 矩形は、実ゲームの実測と**完全一致**した。

| 画面 | 390×844 実ゲーム = harness | 360×800 実ゲーム = harness |
|---|---|---|
| compact（PREPARE / TOPPING） | 290×290 @ (50, 262.5) | 273.6×273.6 @ (43.2, 248.7) |
| roomy（CUT） | 358×358.8 @ (16, 265.1) | 328×331.2 @ (16, 256.9) |

## 結果一覧（PASS / FAIL / 対象外）

| # | 項目 | 結果 | 根拠 |
|---|---|---|---|
| 1 | Duplicate Gate | **PASS** | 重複なし |
| 2 | 動画 HV（390×844 / 360×800） | **PASS** | 下記「Human Verification Videos」 |
| 3 | raw / perfect / burnt で後乗せの色が変わらない | **PASS** | 後乗せ piece の画素が 4 状態（なし含む）でバイト一致、平均 RGB も同一（186.23, 180.74, 129.42）。#588 以前は raw (+8.5 B) / burnt (−11.6 R) など変色。比較: `screenshots/d2-2b-finish-hv/compare-A-bake-states-*.png` |
| 4 | CUT 前の後乗せと `pizza-cut-layer` の重なり順 | **PASS（仕様どおりだが、挙動が変わった = F-3）** | 下記 F-3。後乗せが cut layer の**上**になる（#588 以前は下） |
| 5 | CUT 後に後乗せが piece 内描画へ戻り bake filter が再適用される | **再現・原因特定（FAIL = 既知の穴 F-2）** | 下記 F-2 |
| 6a | 実画面 cqh cap（compact） | **PASS** | 後乗せあり / なしで dough 寸法差 0px、レイヤー = dough |
| 6b | 実画面 cqh cap（roomy / CUT） | **FAIL（新規 F-1）** | 後乗せがあると dough が +0.8px（390）/ +3.2px（360）広がる |
| 6c | 座標 | **PASS** | 後乗せ全 piece の位置誤差 ≤ 0.01px（両 viewport・compact / roomy） |
| 6d | タップ透過 | **PASS** | TOPPING: piece 中心の `elementFromPoint` = `.pizza-dough`、クリックで `onTap` が piece 位置で発火。CUT: `.pizza-cut-hit-zone` に届き、カットのドラッグも成立 |
| 7a | 後乗せなしの回帰（焼成 4 状態、通常 CUT 0 / 3 本） | **PASS** | #588 の前後で画素一致（焦げのみ最大 3 レベルの差。煙アニメーションのノイズで、同一 build の撮り直しでも最大 38〜80 揺れる） |
| 7b | 四角天板 + 後乗せなし | **PASS** | 画素一致（none / burnt / CUT） |
| 7c | 四角天板 + 後乗せあり | **対象外（観察のみ）** | 配置・色は丸と同様（レイヤー = dough 矩形、後乗せは変色しない）。四角天板の CUT と後乗せの同居は範囲外 |
| 8 | 動画・比較画像・結果の整理 | **PASS** | 本書 + `screenshots/d2-2b-finish-hv/` |
| 9 | CUT 対応の変更範囲と受け入れ条件の提案 | **PASS** | 下記「別 PR の提案」 |

## 発見事項

### F-1（新規・minor）roomy で後乗せがあると dough が広がる（grid 化の副作用）

- 再現: 390×844 の CUT（roomy）で 358.0 → 358.8px、360×800 で 328.0 → 331.2px。compact は 0px。
- 原因: 従来の stage は flex 行で、`.pizza-dough` の幅（92vw = 358.8 / 331.2）が stage の内容幅（358 / 328）を超えると flex-shrink で幅だけ縮む（実ゲームの dough が 358×358.8 / 328×331.2 の楕円になっている既存挙動）。#588 の `.pizza-stage--post-layer` は grid のため縮まず、dough が円（358.8² / 331.2²）に変わる。
- 影響: FINISH は post-bake（roomy）なので、最初の後乗せを置いた瞬間に dough が最大 3.2px 広がる。D2-2a の独立レビューは「grid / flex で寸法一致」と報告したが、それは stage 幅に余裕のある条件での測定だった（実 skeleton ではない）。
- 修正案（CSS 注入のみで検証済み。コードは未変更）: `.pizza-stage--post-layer { grid-template-columns: minmax(0, max-content) }` と `.pizza-stage--post-layer > .pizza-dough { max-width: 100% }`。4 条件（2 viewport × compact / roomy）すべてで dough が flex 時と**完全一致**し、レイヤーも dough と一致した。

### F-2（既知の穴・FINISH 有効化前に必須）CUT で 1 本切ると後乗せの変色が戻る

- 再現: CUT で rim-to-rim の線を 1 本引くと（`pieceLayout` が非 null）、後乗せの平均色が変わる。390×844 / 360×800 とも同値。

| bake | 切る前（後乗せ平均 RGB） | 切った後 | 差 |
|---|---|---|---|
| raw | 186.2, 180.7, 129.3 | 184.1, 179.0, 143.0 | B +13.7 |
| perfect | 同上 | 182.6, 176.5, 130.8 | R −3.6, G −4.2 |
| burnt | 同上 | 171.0, 166.2, 131.7 | R −15.2, G −14.6 |

- 原因（コードで特定）: `PizzaStage.tsx` の `separatePostLayer = !pieceLayout && postBakeToppings.length > 0`。カット済み（`pieceLayout` あり）では別レイヤーを描かず、従来の `renderPostPieces(piece)` が `.pizza-piece-body` の中（= `.pizza-dough` の子孫）に戻る。実測した filter の祖先: `.pizza-pieces`（`url(#…) drop-shadow(…)` = カット面のレリーフ）と `.pizza-dough`（bake の `saturate / brightness / contrast`）。#588 は意図的にこの経路を残した（カットとの同居は範囲外）。
- #588 の前後で挙動は同じ（回帰ではない）。D2-2b の動画 ⑤ で確認できる。

### F-3（minor・Owner 判断）CUT 前の重なり順: 後乗せが cut layer の上になる

- 事実: `.pizza-cut-layer`（ガイド線・中心マーカー・プレビュー線）は `.pizza-dough` の子で、後乗せレイヤーは dough の兄弟（DOM 上で後）。dough は `filter` で stacking context を作るため、**兄弟の後乗せは常に dough 内の全要素より上**になる。ガイド線に重ねた後乗せ piece 上の cut layer の変化画素: #588 以前 364 / 353（390 / 360）→ 現在 96 / 100（半透明の縁のみ）。
- 影響: ガイド線 / カット中のプレビュー線が後乗せ piece の下に隠れる。焼成前 piece では線が piece の上に描かれる（不一致）。入力は影響なし（`pointer-events: none`）。
- 選択肢（別 PR / Owner 判断）: (a) 許容（piece は小さく、線は他の部分で見える）。(b) 後乗せレイヤーの上に cut 用オーバーレイ（ガイド・ツール・プレビュー）を複製して描く。

### 付記

- 焦げ状態の煙（`.pizza-smoke`）は dough 内の bake effect のまま。後乗せはその上に描かれる（動画の焦げ場面で確認）。
- 実ゲームの CUT roomy の dough が 360×800 で 328×331.2 の楕円なのは既存挙動（本件と無関係）。

## 別 PR の提案（runtime 修正。本 PR では実装しない）

### PR-A: roomy の寸法ずれ修正（F-1、小）

- 範囲: `src/App.css` の `.pizza-stage--post-layer` と `> .pizza-dough` の 2 ルール（上記の修正案）。`PizzaStage.tsx` は変更なし。
- 受け入れ条件: 後乗せあり / なしで dough 矩形が 390×844・360×800 × compact / roomy の 4 条件で一致（±0.05px）し、レイヤー = dough。後乗せなしの DOM / 画素が不変。`e2e/post-layer-d22a.spec.ts` に roomy の実 skeleton ケースを追加（`e2e/harness/finish-hv.tsx` を利用）。HV は不要に近い（見た目の変化は 3px 以内）。

### PR-B: CUT と後乗せの同居（F-2、中。FINISH 有効化の前提）

- 範囲: `PizzaStage.tsx`（`separatePostLayer` から `!pieceLayout` を外し、カット時の後乗せ用レイヤーを描く）、`App.css`、テスト。`finishD2Inert.test.ts` は外さない。
- 設計: 後乗せレイヤーに、`.pizza-pieces` と同じ構造（`pizza-piece-clip` の clip-path 連鎖、`PIECE_SEPARATION_PX` の translate、`pizza-piece-body` の padding box inset）の後乗せ専用コピーを置く。レイヤーの外箱は dough の border-box にする（clip 多角形は dough-percent）。半端に跨る piece（`half`）も従来の `piecesIn` と同じ判定。bake filter は掛けない。
- Owner 判断が要る点: カット面のレリーフ（`.pizza-pieces` の SVG lighting）を後乗せにも掛けるか（掛けなければ後乗せは影のないフラットな見た目になる）。
- 受け入れ条件: raw / perfect / burnt × カット 0〜3 本で、後乗せの画素が「カットなし」と一致（色が変わらない、レリーフを掛けない場合）。カット線 1 本ごとに後乗せが別 piece へ移っても色が不変。座標誤差 ≤ 0.5px、タップ透過、通常 CUT（後乗せなし）の画素不変、四角天板の画素不変。動画 HV 必須（カットの前後）。

### PR-C（任意）: cut オーバーレイの重なり順（F-3）

- Owner が (b) を選んだ場合のみ。範囲は `PizzaStage.tsx` の cut layer の複製と `App.css`。PR-B と同時にやると衝突が大きいので、PR-B の後に分離する。

## FINISH 本番有効化までの残課題

1. F-1 修正（PR-A）。
2. F-2 修正（PR-B）と、F-3 の Owner 判断（PR-C 要否）。
3. D2-2 本体: GameScreen の FINISH 画面 / トレイ / 完了ボタン / タップ配置、cooking profile への FINISH 追加（UD-B / UD-E 確定済み、#478 は待たない）。
4. `finishD2Inert.test.ts`（本番プロファイルに FINISH を含めない）を外す Owner 承認と、本番プロファイルへの有効化。有効化前に Preview での 390×844 / 360×800 の実画面 HV（FINISH 画面そのもの、動画）。
5. 実 WebKit での画素一致は未確認（この検証は Chromium。#588 の CI WebKit shard は GREEN）。#394 / #590 の間欠失敗は別途。

次の実装 PR の推奨: **PR-A（F-1）を先に**（小さく独立）、続けて **PR-B（F-2）**。D2-2 本体は PR-B の方針（レリーフの扱い）が決まってから。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `finish-d22b-390x844.mp4` | 390×844 | 49.2s | 560,577 B | PASS |
| `finish-d22b-360x800.mp4` | 360×800 | 49.7s | 535,073 B | PASS |

Download: セッション内で直接提出（commit しない。Policy §6）。codec: H.264（libx264, yuv420p, faststart）、音声なし。`ffprobe` で codec / 解像度 / 長さ、`ffmpeg -f null` で最後までのデコードを確認（エラーなし）。

Video Verification: PASS

動画で確認できること（画面上部のキャプションに場面名）:

- ① 後乗せなしの通常画面で、生焼け / ジャスト / 焦げ（既存画面の見た目）。
- ② 後乗せあり: 上段 = 後乗せ（変色しない）/ 下段 = 焼成前（焼き色が変わる）、3 状態。
- ③ 後乗せの上をタップ → 下の生地に届く（カウンタが増える）。
- ④ CUT（線を引く前）: ガイド線と後乗せの重なり（F-3）。
- ⑤ 1 本切ると後乗せが再び変色し、焼成なしに戻すと元の色、焦げに戻すとまた変色（F-2）。
- ⑥ 四角天板 + 後乗せ（観察）。

## 追加物

| ファイル | 内容 |
|---|---|
| `e2e/harness/finish-hv.{html,tsx}` | 実 PizzaStage × 実 cooking skeleton の harness（dev / test 専用、アプリの build には入らない。`?bake=&post=&step=&pan=square&onguide=1`） |
| `tools/finishD22bHv.mjs` / `finishD22bHvCompare.mjs` / `finishD22bHvVideo.mjs` | 検証 driver（画素・幾何・回帰の facts 出力、2 build の画素比較、動画撮影） |
| `docs/reports/screenshots/d2-2b-finish-hv/` | before / after の比較シート（焼成 4 状態 × 2 viewport）、CUT 前の重なり、カット後の変色、四角天板 |

再現: 比較対象の build（`ee7eb34` の worktree に harness をコピー）と現在の build でそれぞれ `node tools/finishD22bHv.mjs <base> <tag> <out>` を実行し、`node tools/finishD22bHvCompare.mjs <out> before after`。
