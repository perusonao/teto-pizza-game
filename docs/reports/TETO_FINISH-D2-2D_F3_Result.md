# FINISH D2-2d F-3 — CUT 線・ナイフを後乗せより前面に出す（Issue #597、本番では不活性）

base `main` `38bbe3c`（PR #596 = F-2 の merge 後）。Owner 判断（確定）: ① 案 A（cut layer / tool layer の**移設**。複製はしない）、② 貫通カットの離れ目の影は範囲外（必要なら後日別 Issue）、③ RESULT でも確定済みの部分カット溝を後乗せより前面に表示、④ 実装前に bake none / raw / perfect / burnt の現状を測定、⑤ pointer-events・連続ドラッグ・WebKit の clipPath 参照を検証、⑥ 後乗せなしの DOM・画素不変と F-2 の後乗せ画素バイト一致を維持。FINISH 本体は有効化しない（`finishD2Inert.test.ts` は変更なし）。#468 / #478 / #584 / Pinsa P3 には触れていない。共有 Preview は更新していない。**#518 は close しない。**

## 原因（再掲）

`.pizza-post-layer` は `.pizza-dough` の兄弟で、dough は bake `filter` で stacking context を作る。dough 内の `.pizza-cut-layer`（z 4）・`.pizza-cut-tool-layer`（z 6）は、兄弟の後乗せレイヤーより常に下に描かれる。bake なし（filter なし）では dough が context を作らず、cut layer は既に上にあった。

## 実装前の現状測定（Owner 判断 4）

後乗せ piece の矩形内で、cut 描画を出した場合と隠した場合の画素差（実 cooking skeleton の harness、ガイド線を不透明で固定、閾値 12）。数値は画素数。

| 場面 | viewport | none | raw | perfect | burnt |
|---|---|---:|---:|---:|---:|
| ガイド線（修正前） | 390×844 | 350 | 114 | 106 | 76 |
| ガイド線（修正前） | 360×800 | 340 | 119 | 114 | 85 |
| ガイド線（F-3 後） | 390×844 | 350 | 350 | 345 | 283 |
| ガイド線（F-3 後） | 360×800 | 340 | 345 | 342 | 278 |

- 修正前は bake なしだけが前面で、raw / perfect / burnt は後乗せの下に隠れていた（約 1/3）。F-3 後は 4 状態とも bake なしと同水準（burnt が低いのは、暗い生地の上で溝と地の差が小さいため）。
- 同じ測定でプレビュー線 + ナイフ（390: 455 → 450 前後）、部分カットの溝（413 → 408 前後）も、F-3 後は 4 状態でほぼ同じ。

## 変更

| ファイル | 内容 |
|---|---|
| `src/components/PizzaStage.tsx` | cut layer と tool layer を `renderCutLayer()` / `renderCutTool()` に関数化（JSX・ref・座標は同じ）。`separatePostLayer`（後乗せあり）のときだけ `.pizza-post-layer` の末尾（後乗せ piece の後）に描き、dough 内には描かない。後乗せなしは従来どおり dough 内。`.pizza-cut-hit-zone` は dough に残す（pointer イベントが dough のハンドラへ届くため） |
| `src/App.css` | `.pizza-cut-layer--front`、`.pizza-cut-tool-layer--front`（レイヤーは dough の border-box なので `inset: 0`、`z-index: auto`）。レイヤーに filter / opacity は付けない |
| テスト | vitest（`PizzaStage.postBakePiece.test.tsx` に F-3 の 5 件）、`e2e/post-layer-d22a.spec.ts`（F-3 の 6 件 × 2 viewport） |
| 検証 | `tools/finishD22dHvVideo.mjs`、`docs/reports/screenshots/d2-2c-f3-cut-front/`（修正前 | 修正後の並べ画像 12 枚） |

ref（`cutGuideGroupRef` / `cutPreviewLineRef` / `cutCutterIconRef`）は 1 組のまま。DOM は 1 組なので flash も二重にならない。

## 検証結果（Chromium、390×844 / 360×800）

| 受け入れ条件 | 結果 |
|---|---|
| ガイド / プレビュー線 + ナイフ / 部分カットの溝が、後乗せの上に見える（bake 4 状態） | **PASS**（上表。e2e: raw / perfect / burnt が bake なしの 0.6 倍超） |
| DOM: cut 描画は post layer の中で後乗せの後ろ、dough 内になし | **PASS**（vitest + e2e、カット 0 / 2 本） |
| cut layer の箱が dough の border-box と一致 | **PASS**（≤0.5px、丸・四角） |
| pointer-events | **PASS**: cut layer / tool layer とも `none`、filter なし、hit-zone は dough 内のまま |
| 連続ドラッグ | **PASS**: 3 本連続（bake 焦げ + 後乗せ）で本数が 1 → 2 → 3、ドラッグ中のプレビュー線 opacity 1・ナイフ表示、離すとプレビュー opacity 0 |
| RESULT（確定溝の残存） | **PASS**: CUT を出た後も部分カットの溝が後乗せの上に残り、ガイド・ナイフは消える（vitest の RESULT ケース + harness の CUT を出た状態）。実 RESULT 画面（後乗せなし）は既存の `pizza-cutting-phase4b` Scenario A〜D が PASS |
| 四角天板 + 後乗せ + CUT | **PASS**（箱一致、後乗せ上の描画画素 >40） |
| 後乗せなしの DOM・画素 | **PASS**: 両 viewport × 丸・四角 × bake 4 状態 × 4 場面（ガイド / ドラッグ中 / 溝 / 3 本カット）= 64 枚が main とバイト一致 |
| F-2 の後乗せ画素バイト一致 | **PASS**: raw / perfect / burnt × カット 0〜3 本（`post-layer-d22a` の F-2 のテスト、両 viewport） |
| F-1 の寸法 / F-2 の座標・タップ透過 | **PASS**（同 spec の既存 F-1 / F-2 テスト） |
| テストの感度 | 修正（`PizzaStage.tsx` / `App.css`）を外すと F-3 の e2e 5 件が失敗（「後乗せなしは dough 内」の 1 件は修正前でも通るのが正しい） |

テスト結果: `tsc -b` OK、oxlint は既存の警告のみ、vitest（`src/components` + `src/preview` + `src/App`）124 ファイル / 1784 PASS（F-3 の 5 件を含む）、Playwright Chromium: `post-layer-d22a` 40 件（F-3 を含む）PASS、既存 CUT 系（`pizza-cutting-phase4b` / `cut-regions-427` / `cut-topping-reach-s3` / `cut-home-leave-confirm` / `cut-skip-failed-bake`）33 PASS（1 件は既存のスキップ）。

## WebKit の clipPath 参照（Owner 判断 5）

この環境には WebKit がない（Chromium のみ）。cut layer は `style={{ clipPath: url(#doughClipId) }}` で dough 内の `<svg><defs><clipPath>` を参照する。F-3 は参照元の svg を dough の外（post layer）へ移すだけで、参照先は同じ文書内の同じ id なので、文書スコープの `url(#id)` 参照という既存の仕組みは変わらない。ただし**実 WebKit での確認は CI の WebKit shard（`webkit-390x844` / `webkit-360x800`）が権威**。既存の e2e は WebKit では後乗せなしの経路しか通らないため、F-3 の e2e を WebKit shard で走らせて確認する（PR 後）。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `finish-f3-390x844.mp4` | 390×844 | 92.2s | 1,100,889 B | PASS |
| `finish-f3-360x800.mp4` | 360×800 | 91.7s | 991,250 B | PASS |

Download: セッション内で直接提出（commit しない。Policy §6）。codec: H.264（libx264, yuv420p, faststart）、音声なし。`ffprobe` で codec / 解像度 / 長さ、`ffmpeg -f null` で最後までのデコードを確認（エラーなし）。

Video Verification: PASS

動画で確認できること（画面上部のキャプションに場面名）: ① CUT 開始のガイド線が後乗せの上（焼成なし / 生焼け / ジャスト / 焦げ）、② ドラッグ中のプレビュー線とナイフが後乗せの上、③ 部分カットの溝が後乗せの上に残る（bake 切替でも同じ、切り直しで消える）、④ 連続ドラッグと貫通カット 1〜3 本（後乗せの色は不変、分割）、⑤ カット後の bake 切替、⑥ CUT を出た後も確定溝が残る、⑦ 後乗せなしの通常 CUT（従来どおり）、⑧ 四角天板 + 後乗せ。重大な視覚的不具合なし。

比較画像: `docs/reports/screenshots/d2-2c-f3-cut-front/compare-<場面>-<bake>-<viewport>.png`（左 = 修正前の main、右 = F-3。場面: 1-guide / 2-drag / 3-groove、bake: raw / burnt）。

## 既知・範囲外

- **貫通カットの離れ目の影**（`.pizza-pieces` の SVG lighting と 1.5px の離れ）は後乗せの上に出さない（Owner 判断 2。必要なら別 Issue）。貫通カットで cut layer に描かれるのは flash のみで、離れ目そのものは dough 側の piece。
- 後乗せ piece の縁にはカット面のレリーフが付かない（F-2 の Owner 判断どおり）。
- 実 RESULT 画面（GameScreen）での後乗せは、FINISH が本番に無いため未到達（D2-2 本体は未着手）。harness の「CUT を出た状態」と vitest の RESULT ケースで代替した。
- FINISH 本番有効化、D2-2 本体、共有 Preview の更新は行っていない。
