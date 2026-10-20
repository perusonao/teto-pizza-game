# FINISH D2-2a — 後乗せ専用レイヤーを `.pizza-dough` の外へ分離（#518 案 (b)、本番では不活性）

base `main` `ee7eb34`。Owner 指示（#518）: 分離方式は案 (b)（後乗せ専用レイヤーを `.pizza-dough` の外に置く）。FINISH 画面・本番有効化・CUT / 四角天板との同居・merge・共有 Preview の更新は範囲外。#584 と Pinsa P3 は HOLD のまま（触れていない）。

## 重複確認

open PR / Issue を確認: #518 に claim なし、D2-2 / 後乗せ分離の PR・ブランチなし。`PizzaStage.tsx` / `App.css` に触れる open PR は #468（HOLD、D2-1 の時点から `PizzaStage.tsx` に 1 か所 conflict あり・触れていない）と #478（Draft）。#581 / #540 / #584 / #587 は本 PR のファイル（`PizzaStage.tsx` / `main.tsx` / 追加する `App.css` ブロック）と重ならない。

## 変更

| ファイル | 内容 |
|---|---|
| `src/components/PizzaStage.tsx` | カットなし（`pieceLayout` なし）で後乗せ piece があるときだけ、`.pizza-dough` の**兄弟**として `.pizza-post-layer`（> `.pizza-post-layer__frame` > `PostBakePiece`）を描く。`.pizza-stage` に `pizza-stage--post-layer` を付与。後乗せがなければ DOM は従来と同一。カット時は従来の piece 内描画のまま（同居は範囲外） |
| `src/App.css` | `.pizza-stage--post-layer`（1 セルの grid にして、層が各サイズ修飾子 roomy / compact / result / cooking の cap で決まった `.pizza-dough` の箱そのものを取る。サイズを再定義しない）と `.pizza-post-layer`（`pointer-events: none`、filter / opacity なし）。frame は dough の padding box（`inset: var(--dough-border-width)`）で、`left/top: x%/y%` の基準が dough 内と同じ |
| `src/dev/PostLayerBench.tsx` + `src/main.tsx` | **DEV / Preview 限定の確認用入口** `?dev=postlayer&bake=raw\|perfect\|burnt\|none[&post=0]`。固定の 1 枚を描くだけで、保存データの読み書き・seed なし（Inspector / DEV State Editor と同じ静的 env ゲート。本番 build からは消える） |
| テスト | `PizzaStage.postBakePiece.test.tsx`（D2-1 の順序テストを新構造に更新、D2-2a の 4 件追加）、`devtoolsAccess.test.ts`（main.tsx の seed 条件）、`previewIsolation.gate.test.ts`（bench の mark を本番 bundle 禁止リストへ）、`e2e/post-layer-d22a.spec.ts`（実画素 5 件 × 2 viewport） |

`finishD2Inert.test.ts`（本番プロファイルに FINISH を含めない）は外していない。bake の `filter`（`.pizza-dough--raw/--perfect/--burnt`）、`PostBakePiece`、reducer、`RECIPES`、`cookingProfiles`、Canvas モッツァレラ / #468 の処理は変更なし。

## 検証（実描画）

390×844 / 360×800。後乗せ 3 piece（basil / bell-pepper / fresh-tomato）を `bake=none` と raw / perfect / burnt で描き、dough 面・焼成前 piece・bake overlay を CSS で除いて**後乗せ piece の画素だけ**を比較。

| 比較 | 結果 |
|---|---|
| after: raw / perfect / burnt vs `none` の画素 | **バイト一致**（両 viewport、`changed = 0`） |
| before（main に同じ bench を載せた build）: raw / perfect / burnt vs `none` | 色が変わる（最大差 15〜39 / 255、約 6.5〜6.9 千 値が変化）。`.pizza-dough` の filter が後乗せにも掛かっていた |
| 座標: 後乗せ 3 piece の `getBoundingClientRect` before = after | 両 viewport で**完全一致** |
| タップ透過: piece 中心の `elementFromPoint` | `.pizza-dough`。クリックで dough の `onTap` が piece 位置の座標で発火 |
| 後乗せなし（焼成前 piece のみ）の画面 before / after | 画素差 **0**（両 viewport）。DOM も従来どおり（`.pizza-post-layer` なし、stage は flex のまま） |

結果の実測値は上記のとおりで、環境依存の閾値は使っていない（同一ブラウザ内の画素一致のみ）。

## テスト

- `npx vitest run`: 489 ファイル通過 / 1 スキップ、9035 テスト通過 / 2 スキップ / 6 todo。失敗 0。
- `npx tsc -b`: エラーなし。`oxlint`: 既存の warning のみ（`CheesePoolCanvas.tsx`）。`vite build`: 成功。
- Playwright（Chromium 390×844 / 360×800）: 新 spec 10 件通過。既存 `making-ui-1screen` / `result-1screen-2.0` / `pizza-cutting-phase4b` / `finished-pizza-visual-2.0` 41 件通過・5 スキップ（既存）。WebKit は未実行（CI の WebKit shard に任せる）。

## Human Verification

動画は D2-2b にまとめる（Owner 指示）。今回は画素比較 + スクリーンショットで確認。

Screenshots: `docs/reports/screenshots/d2-2a-post-layer/` — `before|after-{390x844,360x800}-{raw,perfect,burnt}.png`（後乗せ 3 piece 入り）、`before|after-*-nopost.png`（後乗せなし、画素一致）。before = main + 同じ bench。
見るところ: before は焦げ / 生焼けで bell-pepper が灰色にくすむ、after は 3 状態とも同じ色。

## 残り（D2-2b 以降）

FINISH 画面・tray・完了ボタン、動画 HV、本番プロファイルへの有効化（`finishD2Inert.test.ts` を外す）、CUT・四角天板との同居（カット時の隙間 `PIECE_SEPARATION_PX` と `pizza-piece-clip` の再現）。
