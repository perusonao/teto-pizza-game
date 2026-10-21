# FINISH D2-2c F-2 — カット後も後乗せ食材を専用レイヤーで描く（Issue #594、本番では不活性）

base `main` `25e180b`（PR #593 = F-1 の merge 後、#592 は closed を確認）。Owner 判断: F-2 の実装を承認。F-3（CUT 線を後乗せより前面に出す案 (b)）は独立 PR として後続。**カット面の SVG lighting は後乗せに適用しない。** FINISH 本体は有効化しない（`finishD2Inert.test.ts` は変更なし）。#468 / #478 / #584 / Pinsa P3 には触れていない。共有 Preview は更新していない。**#518 は close しない。**

## 変更

| ファイル | 内容 |
|---|---|
| `src/components/PizzaStage.tsx` | `separatePostLayer = postBakeToppings.length > 0`（`!pieceLayout` を外す）。`renderBodyLayers` 末尾の後乗せ描画を削除（常に別レイヤー）。カット済みのとき `.pizza-post-layer` の中を、`.pizza-pieces` と同じ構造の**後乗せ専用コピー**にする: 各 piece → `pizza-piece`（`translate(PIECE_SEPARATION_PX × outward)`）→ `pizza-piece-clip` の clip 連鎖（`pieceClips`）→ `pizza-piece-body` → `renderPostPieces(pieceIndex)`（`half` 判定は既存 `piecesIn` と同じ）。後乗せを持たない piece は描かない。未カットの DOM（`.pizza-post-layer__frame`）は不変 |
| `src/App.css` | `.pizza-post-layer` に `--dough-border-width: 10px`（`.pizza-piece-body` の inset がこの変数を使うが、レイヤーは dough の外）、`.pizza-post-layer__pieces`（border-box、`pointer-events: none`）を追加 |
| テスト | `PizzaStage.postBakePiece.test.tsx`（D2-2a の「カットは従来経路」を F-2 に更新、F-2 の 6 件を追加）、`e2e/post-layer-d22a.spec.ts`（F-2 の 4 件 × 2 viewport） |
| 検証 | `tools/finishD22bHv.mjs`（F セクション追加、`FINISH_HV_SKIP_F=1` で F-2 前の build と比較可）、`tools/finishD22cHvVideo.mjs`、`docs/reports/screenshots/d2-2c-f2-cut/` |

後乗せレイヤーには filter / opacity を一切付けない（bake の saturate / brightness / contrast も、`.pizza-pieces` の SVG lighting + drop-shadow も届かない）。後乗せがないときは DOM・CSS とも不変。

## 原因（再掲）と効き方

`!pieceLayout` の条件のため、カット済みでは後乗せが `.pizza-piece-body`（= `.pizza-dough` の子孫）に戻り、`.pizza-dough` の bake filter と `.pizza-pieces` のレリーフ filter が掛かっていた。カット済みでも dough の兄弟のレイヤーに描き、カットの幾何（clip 連鎖と 1.5px の離れ）だけをコピーすることで、色は不変のまま piece と同じ位置・形に従う。

## 実測（実 cooking skeleton の harness、Chromium、390×844 / 360×800）

後乗せ 6 個（行 3 + ガイド線上 3: 線に跨る分は `half` に分割）。カット 0〜3 本は実際の rim-to-rim ドラッグ。

| 受け入れ条件 | 結果 |
|---|---|
| raw / perfect / burnt × カット 0 / 1 / 2 / 3 本で後乗せの色が変わらない | **PASS**: 同じカット本数で none / raw / perfect / burnt の後乗せ画素が**バイト一致**（両 viewport、全 4 本数）。修正前は 1 本切ると変色（焦げ R −15、生焼け B +14、perfect −4） |
| カットは後乗せを再着色しない（カット前との比較） | **PASS**: 線が跨らない piece（basil / pepper）の平均色の差は最大約 3.7 レベル（サブピクセルの 1.5px 移動による縁のにじみ。修正前の変色は 15） |
| ピース移動を含む座標誤差 ≤ 0.5px | **PASS**: 最大 0.014px（390）/ 0.0125px（360）。1.5px の離れが掛かる piece が 7 / 11 / 15 個（1 / 2 / 3 本）すべて含まれる |
| bake / relief filter が後乗せに届かない | **PASS**: 後乗せの祖先に filter なし、レイヤーに `style` なし、`url(#…)` 参照なし。dough の bake filter は残っている |
| タップ透過 | **PASS**: カット済みでも後乗せ上の `elementFromPoint` はレイヤー外（`.pizza-cut-hit-zone`）、次のカットのドラッグが成立（本数が増える） |
| 通常 CUT / 後乗せなし | **PASS**: 後乗せなし（焼成 4 状態）、通常 CUT 0 / 3 本、四角天板（後乗せなし）は main（`25e180b`）と画素一致。差が出た 2 枚（390 の 3 本カット 6 値・最大 2、360 の四角天板・焦げ最大 3）は同一 build の撮り直しでも出るアニメーションのノイズ（cut flash / 煙。main 同士でも 6 値ずれる） |
| 四角天板 | **PASS**: 後乗せなしは画素一致。後乗せあり + CUT 2 本でも、後乗せレイヤーだけ取り出すと none と burnt でバイト一致（両 viewport）。カットは丸と同じに動く（観察） |
| F-1 の寸法 | 維持（`e2e/post-layer-d22a.spec.ts` の F-1 テスト 10 件が PASS） |

テストの感度: `PizzaStage.tsx` / `App.css` を main の状態に戻すと、F-2 の e2e 8 件（4 件 × 2 viewport）がすべて失敗することを確認した。

## テスト結果

- `vitest`（`src/components` + `finishD2Inert` + `src/preview`）: 105 ファイル / 1599 テスト PASS。`tsc -b` OK、oxlint クリーン。
- Playwright Chromium: `post-layer-d22a.spec.ts` 28 件（D2-2a 5 + F-1 5 + F-2 4、× 2 viewport）PASS、既存の `pizza-cutting-phase4b` + `cut-regions-427` 15 件 PASS（1 件は既存のスキップ）。WebKit は CI の shard で確認する。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `finish-f2-390x844.mp4` | 390×844 | 60.2s | 740,470 B | PASS |
| `finish-f2-360x800.mp4` | 360×800 | 60.8s | 674,099 B | PASS |

Download: セッション内で直接提出（commit しない。Policy §6）。codec: H.264（libx264, yuv420p, faststart）、音声なし。`ffprobe` で codec / 解像度 / 長さ、`ffmpeg -f null` で最後までのデコードを確認（エラーなし）。

Video Verification: PASS

動画で確認できること（画面上部のキャプションに場面名）: ① カット前の焼成 3 状態（後乗せは不変・焼成前は変わる）、② CUT 工程、③ 1 / 2 / 3 本カット（後乗せの色が変わらない、線に跨る後乗せは両ピースに分割、1.5px の離れに追従）、④ カット後に 生焼け / ジャスト / 焦げ / 焼成なし（後乗せは同じ色）、⑤ 切り直しでカット前の表示に戻る、⑥ 後乗せなしの通常 CUT、⑦ 四角天板。重大な視覚的不具合なし（既知: カット線 / 離れ目の影が後乗せの下に隠れる = F-3）。

比較画像: `docs/reports/screenshots/d2-2c-f2-cut/compare-1cut-burnt-*.png`（main vs F-2、1 本カット後の焦げ）、`after-burnt-cuts0-3-*.png`（0〜3 本）。

## 既知・範囲外

- **F-3**（CUT 線・離れ目の影が後乗せの下に隠れる）は別 PR。後乗せレイヤーは dough の兄弟のため常に dough 内の cut layer より上。
- 後乗せにはカット面のレリーフ（影）が付かないため、カットされた piece の縁で後乗せがフラットに見える（Owner 判断どおり）。
- FINISH 本番有効化、D2-2 本体（GameScreen の FINISH 画面）は未着手。実 WebKit での確認は CI の WebKit shard。
