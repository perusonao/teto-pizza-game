# FINISH D2-2c F-2 — CUT 後も後乗せが焼成フィルターから独立する（Issue #594、本番では不活性）

base `main` `25e180b`（PR #593 = F-1 の merge 後）。Owner Gate: F-2 の実装を承認。F-3（CUT 線の前面表示）は含めない。FINISH は有効化しない（`finishD2Inert.test.ts` は変更なし）。#468 / #478 / #584 / Pinsa P3 には触れていない。共有 Preview は更新していない。**#518 は close しない。**

## Duplicate Gate / claim

- 開いている 26 PR の変更ファイルを API で全件確認（`gh api pulls/N/files --paginate`）。F-2 のファイルに触れるのは #584（`App.css` ~L753、後乗せ規則 L329–360 と離れている）、#468（`PizzaStage.tsx` ~L18 / ~L953 / ~L1177、`App.css` ~L778。本 PR は触れない）、#321 / #34（古い、別箇所）のみ。重複する PR / Issue なし。
- Issue #594 に claim コメントを記録（`App.css` は hot file: #584 とは hunk が離れており、先に merge された側へもう一方が追従する）。

## 変更

| ファイル | 内容 |
|---|---|
| `src/components/PizzaStage.tsx` | `separatePostLayer` から `!pieceLayout` を除去。`renderBodyLayers` 内の後乗せ描画を削除（後乗せは常に `.pizza-post-layer`）。piece の clip 連鎖 + `PIECE_SEPARATION_PX` の translate + padding-box body を `renderPieceTree` に切り出し、dough の `.pizza-pieces` と後乗せレイヤーの `.pizza-post-pieces` の両方で共用。カット時は `renderPostPieces(pieceIndex)`（`piecesIn` の `home` / `halves` 判定は従来どおり） |
| `src/App.css` | `.pizza-post-pieces`（`inset: 0`、レイヤー自体が dough の border-box）と、`.pizza-post-layer` に `--dough-border-width: 10px`（piece body の inset 用。dough の外では未定義だった） |
| `src/components/PizzaStage.postBakePiece.test.tsx` | 旧「cut は in-piece 経路」2 件を更新、F-2 の 2 件を追加（レイヤー外・filter なし・clip 連鎖 / translate が dough の `.pizza-pieces` と一致・座標が未カットと一致） |
| `e2e/post-layer-d22a.spec.ts` | F-2 の実画素テスト 5 件 × 2 viewport |
| `tools/finishD22cF2Shots.mjs` / `tools/finishD22cF2Video.mjs` | before / after と動画の検証ドライバ（dev のみ） |
| `docs/reports/screenshots/d2-2c-f2-cut/` | before（左）\| after（右）の比較 36 枚（raw / perfect / burnt × カット 0・1・3 本 × 2 viewport、通常 + 後乗せ単独） |

後乗せには bake filter（`.pizza-dough`）・カット面 relief（`.pizza-pieces` の SVG lighting）のどちらも掛からない（レイヤー内の構造要素に `filter` なし、`pointer-events: none`）。`PostBakePiece.tsx`、`finishD2Inert.test.ts`、F-1 の CSS は変更なし。後乗せがない画面は DOM 不変（`renderPieceTree` は dough の `.pizza-pieces` の DOM を変えない）。

## 検証

| 項目 | 結果 |
|---|---|
| raw / perfect / burnt / 焼成なし × CUT 0・1・2・3 本（390×844、360×800） | **PASS**: 後乗せ単独の画素が bake 4 状態で**バイト一致**。平均 RGB は未カットとの差 < 4（シームの半透明縁のみ。バグ時は 14–15 ずれる）、画素数差 < 3% |
| 座標 | **PASS**: 後乗せの中心 = 名目位置 + その piece の translate、誤差 < 0.5px（全 piece、カット 0〜3 本） |
| half 表示 | **PASS**: 線上の後乗せは 1 つが whole、残りが `.pizza-topping-half`（unit + e2e） |
| 位置の連続性（カット確定前後） | **PASS**: 1 本ごとに各 whole の移動は piece の離れ（≤ 1.5px）のみ（< 1.6px）で、ジャンプなし |
| カット操作・タップ透過 | **PASS**: カット後も後乗せ上の `elementFromPoint` はレイヤー外（dough 側）、後乗せの上を通る 2 本目のカットが成立（1 本→2 本） |
| レイヤーの構造 | **PASS**: レイヤー・コピーは dough の矩形と一致、dough 内に post piece 0 個、レイヤー内の構造要素に filter なし、`pointer-events: none`、dough の寸法はカットで不変（F-1 の矩形維持） |
| 後乗せなしの画素一致（`finishD22bHv` + `finishD22bHvCompare`、main `25e180b` と比較） | **PASS**: 18 枚中 17 枚が一致。1 枚（390×844 焦げ）は最大 3 レベルの差で、同一 build の再撮影同士でも同じ差（煙アニメーションのノイズ。D2-2b / F-1 と同じ既知事項） |
| 四角天板 + 後乗せ + CUT（観察） | 丸と同様に動作: 1 本カットで後乗せの色は bake 4 状態でバイト一致、レイヤー = dough 矩形、filter なし。追加の Issue は不要 |
| 感度 | PizzaStage 変更を戻すと F-2 の e2e 5 件がすべて失敗する。`--dough-border-width` を外すと座標テストが失敗する |
| `tsc -b` | PASS |
| vitest（`src/components`、`finishD2Inert`、86 ファイル） | 1426 PASS |
| e2e（`post-layer-d22a` 30 件、既存 CUT 4 spec 9 件） | PASS（390×844 / 360×800） |
| oxlint | 新規警告なし（既存の `CheesePoolCanvas` 警告のみ） |
| 実 WebKit | 未確認（このセッションは Chromium）。CI の WebKit shard に任せる |

## Human Verification

390×844 の動画 `finish-d22c-f2-390x844.mp4`（49.6s、H.264 / yuv420p / faststart、音声なし、`ffprobe` / 最後までのデコード確認済み）をセッション内で直接提出（commit しない。Policy §6）。場面: ① CUT 前に raw / ジャスト / 焦げ、② 1 本カット後に同じ切替、③ 3 本（後乗せが線をまたぐ）、④ 切り直し・後乗せの上を通る再カット、⑤ 四角天板 + 後乗せ + CUT。後乗せは全場面で変色しない（下段の焼成前の食材は変わる）。

## 既知・範囲外

- **F-3**: カット線（ガイド・離れ目の影）は後乗せレイヤーが dough の兄弟のため後乗せの下に隠れる（スクリーンショット右の seam が後乗せ上で途切れる）。F-3 の別 PR で対応する。
- FINISH 本番有効化、D2-2 本体（GameScreen の FINISH 画面）、共有 Preview の更新は行わない。#518 は OPEN のまま。
