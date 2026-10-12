# Issue #421 — モッツァレラ「motion-first prototype」（第3試作）Result

- ブランチ: `claude/issue-421-mozzarella-motion-proto3`（最新 main `279ed48` + PR #468 の M1 `d1ff57f` = `2b8bc1f` の上に作成。第2試作（静的な羽化スカート）は引き継がず、独立）。PR #468 は HOLD のまま未変更。PR 作成・Ready 化・merge・deploy・共有 Preview 切替はしていません。
- 状態: **試作。Owner が比較動画を見て判断する段階**（採用ではありません）。iPhone Safari の HV は未実施。
- 動画は、Owner の明示指示（GitHub に保存して直接開けるリンクを報告）により `docs/reports/videos/` にコミットしました（人間検証ポリシーの「動画はリポジトリに入れない」の例外。計 約 5MB）。

## 1. 方針（Issue #421 最新コメント）
静的な輪郭・ぼかしの微調整は止め、**時間変化（動き）**で「焼成前の小さく厚い塊 → 平たく不規則に広がる → 控えめな焼き色」を分かりやすくする。既存の焼成 3 秒の `heat`（針位置）をそのまま使い、新しい状態は作らない。

## 2. 実装（モッツァレラの描画のみ）
- **transform だけ**で表現（追加のぼかし・疑似要素・追加 DOM・SVG なし）。M1 のぼかしローブ 5 層（1px blur）と halo は削除（box-shadow は 10 → 5 層）。
- 動きの振付（`bakeVisual.ts` の `cheeseMeltCssVars`、変数は TypeScript で finished な数値/`deg`、CSS は `var()` で受けるだけ）:
  1. **締まる（puff）**: 針 約 17〜35（heat 0.1〜0.5、溶ける前）に、やや細く・背が高く・落ち影が濃く（小さく厚い塊）。
  2. **広がる**: 溶け（heat 0.5〜0.9。針 35〜63 ≒ 0.85 秒）で、幅 ×約 1.34、高さ ×約 0.85（平たく横に）。
  3. **オーバーシュート→落ち着く**: 溶けの中盤に幅が少し行き過ぎて戻る（`sin` 曲線）。
  4. **不規則さ**: ピースごとに skew 向き（±10°）・幅/高さの揃わなさ・溶け始めのタイミングの前後（中盤のみ、両端は一致）・アスペクト差。`ingredientId:x:y` の決定的ハッシュ（`Math.random` 不使用）。
  5. 焼き色（斑点）は従来のまま控えめ。
- CSS: `.pizza-cheese--mozzarella` の `transform`（`scale` + `skewX`）と `transition`（90ms linear。0.3s の緩やかな遅れだと 1 秒未満の溶けの振付が消えるため）。
- **prefers-reduced-motion**: `--cheese-motion: 0` かつ `transition: none`。一過性の動き（締まり・オーバーシュート・揺れ）は無効になり、最終形（平たく広い）だけ残る。
- 生（melt 0・puff 0）は全項が中立。PREPARE / トレー / Reference / サムネイル / 他の食材は変数未設定で従来どおり。
- **変更していないもの**: 焼成 3 秒、採点（`classifyBake` 含む）、CUT、保存、経済、`BakeOverlay`、非モッツァレラ食材。`PizzaStage.tsx` は `bakeHeat` を渡す 1 引数の追加のみ。

## 3. 比較動画（M1 と動き版、同じピザ・同じ配置・同じ針の進行）
撮影方法: 偽の時計を 33ms ずつ進め（ゲージ 33.3pt/s → 30fps = 実速度）、各フレームを撮影。CSS の transition はキャプチャ時のみ無効（実時間で進むため）で、両ビルドの**目標の振付**を並べている。実機の 90ms（動き版）と 0.3s（M1）の遅れは含まない。DPR 2。冒頭に生の 0.67 秒、末尾に 1 秒のホールドを付加。
- 390×844: 実速度 `compare-390x844-realspeed.mp4` / 0.33 倍速 `compare-390x844-slow-0.33x.mp4`
- 360×800: 実速度 `compare-360x800-realspeed.mp4` / 0.33 倍速 `compare-360x800-slow-0.33x.mp4`
- 代表静止画（針 8 / 30 / 40 / 48 / 56 / 64 / 72 / 86）: `stills-390x844.png`、`stills-360x800.png`。CUT / RESULT: `compare-<viewport>-6-cut.png`、`compare-<viewport>-7-result.png`。
- 保存先: `docs/reports/videos/mozzarella-motion-proto3-421/`。

## 4. 見た目（Chromium のみ）
- **分かりやすくなった点**: M1 は丸い塊がほぼそのまま少し大きくなるだけだが、動き版は 生（丸）→ 締まる（細く厚い）→ 平たく横へ広がる → 落ち着く、が針 30〜64 の間で明確に見える。ピースごとに傾き・幅・タイミングが違い、整った楕円の「揃い」が崩れる。
- **残る違和感・限界**:
  1. 溶けの本体は約 0.85 秒（焼成 3 秒のうち）で短い。動画は通常速度では一瞬で、0.33 倍速の方が確認しやすい。
  2. 輪郭は楕円の変形（skew・非一様スケール）で、「縁が薄く流れる」「膜」の表現はしていない（ぼかしを増やさない方針のため）。
  3. 幅が広がる分、隣のピースやバジルに近づく（RESULT でバジルの横に重なって見える配置あり）。最終幅は 1.4→1.34 に抑えた。
  4. 実物写真との比較は未完了（写真ホストに接続不可）。
  5. iPhone Safari の実機・実時間（CSS transition 込み）での見え方は未確認。

## 5. 描画コスト（Chromium トレース・ソフトウェアラスタ・iPhone ではない）
- 方法: 第2試作と同じ `e2e/mozzarella-motion-proto-perf.spec.ts`。焼成中に 16ms × 150 フレーム、`Paint`/`PrePaint`/`Layerize`/`RasterTask` の合計、各版 3 回の中央値（M1 と交互実行）。
| 版 | box-shadow 層 | 390×844 | 360×800 |
|---|---|---|---|
| M1 | 10 | 1105 ms（1061〜1152） | 1164 ms（1083〜1194） |
| 動き版 | 5 | 1206 ms（1197〜1446） | 1106 ms（1028〜1534） |
- 解釈: M1 と有意な差は見えない（390 で +9%、360 で −5%、ばらつきの範囲内）。ぼかし層を増やさず、むしろ box-shadow を半減。第2試作（M1 比 +15〜20%）より軽い方向。実機の GPU 値は未計測。

## 6. 検証（先に実施）
| 項目 | 結果 |
|---|---|
| `tsc -b` / `npm run build` | 通過 |
| oxlint | 変更ファイルに指摘なし（既存 3 warning のみ） |
| Vitest 全件 | 390 files / 7165 passed / 1 skipped |
| 単体テスト | 振付（締まり→広がり→オーバーシュート→落ち着き）、単調性、境界（幅・高さ・skew の上限）、ピース差、生の中立、ローブ/halo 無し |
| e2e（Chromium 390×844 / 360×800）: `mozzarella-melt-421`、finished-pizza-visual-2.0、pizza-cutting-phase4b、cut-regions-427、result-1screen-2.0、cut-skip-failed-bake、**sauce-edge-475** | 61 passed / 1 skipped |
| WebKit | 動画・結果をブロックしない。この試作ブランチへの CI 手動実行は別途（下記） |

### 関連する WebKit の状況（第2試作・対照）
- run 38249436268（第2試作 `2bdc4de`）: failure。`sauce-edge-475.spec.ts:124`（SAUCE→BAKE→CUT→RESULT、モッツァレラを置く）が 60 秒タイムアウト（webkit-360×800 shard 2/2）。他は通過。
- 対照 run 38253509107（M1+main `2b8bc1f`）: failure。**別のテスト** `expansion-batch6.spec.ts:73`（Shop、モッツァレラと無関係）が webkit-390×844 shard 1/2 で失敗。
- run 38253505419（第2試作調整後 `5085407`）: failure。webkit-390×844 shard 2/2 は「テスト一覧ファイルが無い（ENOENT）」というインフラ側の失敗で、テストは実行されていない。
- 3 回とも失敗の中身が異なり、M1 でも失敗するため、**第2試作の描画が WebKit で原因とは断定できません**（WebKit 実行の不安定さを示唆するが、証明ではない）。
