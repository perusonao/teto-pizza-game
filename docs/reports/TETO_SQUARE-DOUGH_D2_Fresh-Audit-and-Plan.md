# Square-Pan Dough D2（四角ピザの調理工程・描画）— Fresh Audit と実装計画

Status: **READ-ONLY audit + plan（docs-only）。`src/**` / `e2e/**` / CSS / レシピ / save は未変更。** PR なし、共有 Preview 未更新、main へのマージなし。Owner 承認待ち。
Base: `origin/main` `9c20633`（2026-10-19 fetch）。Epic #532、子 Issue #537（D）。
用語: ここでの「D2」は Issue #537 の **D2（描画）**。FINISH 系の `D2-0〜D2-3`（`TETO_FINISH-D2_OWNER-DECISION-TABLE.md`）とは無関係。

## 0. 結論（先に）

- main では、四角ピザは **DOUGH 工程の中だけ**が四角で、**ソース以降（SAUCE / CHEESE / TOPPING / BAKE / RESULT / サムネイル）は丸いまま**。しかも C（#558）が未マージのため、四角ラウンドは「次へ」が常に無効（`nextStepReady = !squareDoughRound && …`、`GameScreen.tsx:380`）で、そもそも DOUGH から先へ進めない。
- ロジック側（D1-a / D1-b / F4-a）は準備済みで再利用できる。**未配線**なのは入力座標（`PizzaStage` / `App.tsx`）と描画（canvas・CSS・サムネイル・RESULT）。
- 独立して先行できる最初の単位は **D2-a1「四角の描画プリミティブ（新規ファイルのみ・Production inert）」**。#558 / #553 / F4-b / #518 のどのファイルにも触れない。

## 1. 調査結果（調査対象 1〜9）

### 1. 四角い生地 → ソース工程への遷移
- 未対応。`GameScreen.tsx:375` `squareDoughRound = activePanShape(recipe) === "square"` → `nextStepReady` が常に false。遷移できない（C #558 の担当）。
- `pizza.squareDough`（厚みグリッド）は `showSquareDough = isDoughStep && squareDough !== undefined`（`PizzaStage.tsx:1398`）でのみ使われ、**DOUGH 以降はどこも読まない**。DOUGH を抜けると `.pizza-dough` は `border-radius: 50%`（`App.css:243`）の円に戻る。
- `PizzaStage` に `panShape` を受ける prop がない。「今は四角ラウンドか」を DOUGH 以降の描画へ渡す経路が未整備。

### 2. 四角い天板上のソース塗布
| 部分 | 状態 |
|---|---|
| 指標 `computeSquareSauceMetrics`、境界 `isSquareSauceCellVisible`、表示 `buildSquareSauceDisplayPixels`（D1-a） | **済（純ロジック、未配線）** |
| 入力座標: `PizzaStage.tsx:661` / `:757` / `:795` / `:900` が `isInsideDough`（円 r=48）、`:909` が `clampToDough` | **未対応。四角の四隅（中心から約62）は円の外なので、押下そのものが無視される** |
| ソース canvas（`SauceHeatmapCanvas` / `SauceMergedCanvas`）は 8 点 `doughShape`（円基準）で可視セルを判定 | **未対応**（`isCellVisible` 引数は既にあるので差し替え可能） |
| はみ出し表示 `SauceMergedOverflowCanvas`（`insideDoughShapeFraction`） | 未対応（円基準） |
| ガイド `sauce-target-guide`（`<circle r=SAUCE_TARGET_RADIUS>`）、`.pizza-sauce-layer` の `clip-path: circle(…)` 展開アニメ | 未対応 |
| reducer の `APPLY_SAUCE` / `COMMIT_SAUCE_DISPENSE` | 境界チェックなし（はみ出しは指標で扱う設計）。変更不要 |
| `App.tsx:1106` の `computeSauceMetrics`（Reference モード）は円基準 | 未対応。ただし採点・Reference は D4 により E（#521）まで不変。D2 では触れない |

### 3. チーズ・トッピング配置と当たり判定
| 部分 | 状態 |
|---|---|
| reducer `PLACE_TOPPING` の境界と空き位置探索（D1-b、`getPanGeometry(activePanShape(recipe))`） | **済** |
| 四角ラウンドの CUT 無効（`cookingProfileForPan`、D1-b） | **済**（Dinner × 四角は意図的に未対応、D1-b に記載） |
| 物理ドラッグ `App.tsx:281 resolvePhysicalDrop` | **未対応**（`resolvePieceDrop` = 円のまま）。`resolvePieceDropForPan` は D1-b で用意済み・未配線 |
| タップ配置 `PizzaStage.tsx:900` | 未対応（上記 `isInsideDough`） |
| `CheesePoolCanvas` / `cheesePoolReachPercent`（円の溶け広がり） | 未対応 |
| ガード判定に `effectivePanShape`（F4-a）を使う箇所 | 未配線。reducer / GameScreen は現状 `activePanShape` のみ |

### 4. 焼成中の四角いピザ表示
未対応。円依存の CSS（`App.css`）: `.pizza-dough`（243）、`.pizza-char-spots`（446）、`.pizza-sauce-layer`（460）、`.pizza-paint-trail` の `clip-path: circle(48%)`（508）、`.pizza-cut-layer`（537）、`.pizza-cheese`（764）、`.pizza-cheese--fontina`（818）、`.pizza-bake-overlay`（929）、`.pizza-perfect-glow`（945）ほか。
焼成色の `filter`（`.pizza-dough--raw/--perfect/--burnt`、337/346/354 行）は `.pizza-dough` 自体に付いており、**`border-radius` を差し替えても filter の階層は動かない**。D2 は filter ブロックに触れない（Owner 判断 2026-10-18）。

### 5. RESULT での四角いピザ表示
未対応。`.pizza-stage--result .pizza-dough`（`App.css:319`）の縮尺が四角の天板で比率を保つか未検証（Issue #537 受け入れ条件「縮尺 0.75 でも四角比が保たれる」）。F3（#553）が RESULT に出す中立文言は `ResultPanel` の文言行のみで、描画とは独立。

### 6. 丸いピザとの状態・描画の分離
- 状態: `PizzaState.squareDough`（DOUGH 専用・非保存）と `PizzaState.pan`（F1、同定軸）が分離済み。丸いラウンドでは `squareDough` / `pan` とも undefined。
- 描画: 四角専用の描画は `SquareDough*`（DOUGH 専用）のみ。ソース以降は共有コンポーネントに四角分岐がない。
- 方針: 丸い側の関数・クラスを編集せず、**四角専用の新規コンポーネント / 新規 CSS を `panShape === "square"` のときだけ差し込む**（A の方針と同じ）。丸い 57 レシピは byte-identical を維持。

### 7. F4-b・#558・#553 との統合依存
| 項目 | 内容 |
|---|---|
| **#558（C）** open、head `86bbe26` | 触る: `App.css`（+117）、`PizzaStage.tsx`（+3）、`GameScreen.tsx`（+21）、`SquareDough{Layer,Gauge,Guide,Canvas}`、`pressGesture` ほか。**D2 の前提**（これが無いと四角ラウンドが SAUCE に進めず、通し検証できない） |
| **#553（F3）** open、head `895287e` | 触る: `ResultPanel.tsx`（+5）、`GameScreen.tsx`（+2）、`panShapeNotice.ts`（新規）。D2 と描画面では独立。`GameScreen.tsx` の隣接行のみ注意 |
| **F4-b**（○/□ 選択 UI） | 調査時点で open PR を確認できなかった（ブランチ未確認）。`SELECT_PAN` と、**四角ラウンド判定 3 か所のガード差し替え**（`GameScreen` の `squareDoughRound`、`COMMIT_SQUARE_DOUGH`、`cookingProfileForPan`/`PLACE_TOPPING` の `activePanShape`）を担当 |
| #518（焼成 filter） | PR なし。D2 は filter に触れずに進める（停止条件つき）。`finishD2Inert.test.ts` にも触れない |
| #540（旧 Grandma） | マージしない。ゴールデンは F1 以前の base なので移植しない |

**最重要の継ぎ目**: 「このラウンドは四角か」の判定が現状 `activePanShape(recipe)` で、F4-b が `effectivePanShape(recipe, pizza)` に替える。D2 が新しく読む箇所（`PizzaStage` / `App.resolvePhysicalDrop` / canvas）が個別に判定すると、F4-b でガードの差し替え漏れが起きる。**D2 の描画・入力は判定を自前で行わず、`panShape` を prop / 引数で受ける**（判定は GameScreen 1 か所＝F4-b の差し替え対象のみ）。

### 8. iPhone 390×844・360×800
- `.pizza-dough` は `min(78vw, 300px)`：390 幅で 300px、360 幅で 280px。四角の半辺 44%（`SQUARE_PAN_HALF_SIDE`）なら天板一辺 ≈ 264px / 246px。四隅のタッチ領域は %基準で決まるので、44px 目安を 360 でも満たす想定（実測は D2-a2 で）。
- 四隅は円の外なので、`PizzaStage` の外側（`pizza-stage` / ステージ余白）で切れないか、`overflow` と RESULT 縮尺で潰れないかの実画面確認が必要。`touch-action` / `user-select` / `-webkit-touch-callout` は B2 の `.square-dough-layer` に前例あり（SAUCE 以降の入力面にも同じ扱いが要る）。
- 検証は Playwright 4 プロジェクト（chromium 390/360、webkit 390/360）＋実機 HV（390×844 動画は Owner へ直接、360×800 も確認、before/after は `docs/reports/screenshots/<task>/`）。#519 の教訓どおり **CSS filter 後の実画面ピクセル**で判定する。WebKit 360×800 の既知の間欠失敗（#529 / #531）はマスクしない。
- 注意: 今回は静的な読解による監査で、アプリを起動しての実測はしていない（四角ラウンドは #558 前は DOUGH から進めず、SAUCE 以降を実画面で再現できない）。

### 9. 再利用できる既存部分
| 既存 | 再利用 |
|---|---|
| D1-a `squareSauce.ts`（`isSquareSauceCellVisible`、`computeSquareSauceMetrics`） | canvas の可視セル判定・（E 以降の）指標 |
| D1-a `squareSauceDisplay.ts`（`buildSquareSauceDisplayPixels`、`squarePanMask`） | ソース canvas のラスタライズそのもの |
| D1-a / D1-b `panPlacement.ts`（`resolveGeometryPieceDrop`、`findOpenSpotOnPan`、`resolvePieceDropForPan`） | `resolvePhysicalDrop` とタップ配置 |
| D1-b `panProfile.ts`（`cookingProfileForPan`） | CUT 無効（済） |
| A `panGeometry.ts`（`getPanGeometry`、`SQUARE_PAN_HALF_SIDE`、`SQUARE_TARGET_HALF_SIDE`、`SQUARE_PAN_CORNERS`） | ガイド枠・クリップ・入力境界の唯一の数値源 |
| F4-a `effectivePan.ts`（`effectivePanShape`） | F4-b 経由で判定 1 か所に使う |
| B2 `.pizza-dough--square-pan`（`border-radius:10%`、天板色）と `.square-dough-layer` の touch 設定 | 天板見た目・touch 抑止の前例 |

## 2. 対応済み / 未対応 まとめ
- 対応済み（ロジックのみ・見た目なし）: 形状基盤、DOUGH のタップ／長押し、ソース指標・表示ラスタ・ドロップ判定、reducer の具材配置境界と CUT 無効、`effectivePanShape`、`pan` 同定軸、Technique 登録。
- 未対応（D2 の範囲）: DOUGH 以降の四角ステージ（天板・生地の四角表示の持続）、SAUCE/CHEESE/TOPPING の入力座標、ソース canvas・ガイド・チーズ溜まり、焼成の円依存 CSS、RESULT 縮尺、サムネイル（Recipe Select / Dex / RESULT / Reference）、Dinner × 四角（意図的に対象外）。
- 他レーン: DOUGH からの遷移・完成判定（C #558）、RESULT 文言（F3 #553）、○/□ 選択と判定の一本化（F4-b）、レシピ（E #521）。

## 3. 変更予定ファイル（案）
| 単位 | 新規 | 変更（最小） |
|---|---|---|
| **D2-a1** 描画プリミティブ | `src/components/square/SquareSauceCanvas.tsx`、`SquareTargetGuide.tsx`（四角のターゲット枠）、`squareCheeseReach.ts`（四角の溶け広がり範囲）、`SquareThumbnailBase.tsx`、`src/styles/squarePanStage.css`、各 `.test.ts(x)` | なし（`sauceField.ts` も触らない） |
| **D2-a2** ステージ配線 | `e2e/square-pan-stage.spec.ts` | `PizzaStage.tsx`（`panShape` prop 追加・分岐のみ）、`GameScreen.tsx`（`panShape` を渡す 1 行）、`App.tsx`（`resolvePhysicalDrop` を `resolvePieceDropForPan` 経由に） |
| **D2-b** 焼成・RESULT・サムネイル | `src/styles/squarePanBake.css`、e2e、スクリーンショット | サムネイル各 `.tsx` に `shape` prop（`PizzaThumbnail` / `ReferenceThumbnail` / `ReferencePreview` / `PlayerReferencePreview`）、`ResultPanel` のステージ縮尺クラス |
- CSS は `App.css` に追記せず、**新規 CSS ファイルをコンポーネントから import**する（#558 が `App.css` 末尾に追記しているため、同じ末尾への追記は衝突しやすい）。`.pizza-dough--square-pan …` の子孫セレクタで `border-radius` / `clip-path` だけを四角に上書きし、filter は一切書かない。

## 4. 競合リスク
| 相手 | リスク | 対策 |
|---|---|---|
| #558 | `PizzaStage.tsx`（+3）、`GameScreen.tsx`（+21）、`App.css` 末尾（+117）。**高**: D2-a2 は同ファイルの同領域 | D2-a1 は新規ファイルのみ。D2-a2 は #558 のマージ後に着手（またはその branch を base にしない）。CSS は別ファイル |
| #553 | `GameScreen.tsx` の import 近傍（+2） | 低。D2-a2 の `GameScreen` 変更は別行 |
| F4-b | 四角判定のガード 3 か所（`GameScreen:375` ほか）。**中**: D2 が判定を増やすと差し替え漏れ | D2 は `panShape` を prop で受けるのみ。判定箇所を増やさないことを F4-b と合意 |
| #518 | `.pizza-dough` の filter | 触れない。filter 移動／描画階層の変更／`finishD2Inert.test.ts` が必要になったら **停止して再判断**（Owner 判断どおり） |
| #521 S1（#524） | per-layer ソース canvas | 変更しない。四角は別コンポーネント |
| #429 / #467 | CUT | 触れない（四角は CUT 無効のまま） |
| 2 つの Anti-Oracle gate | `PAN_TRAY_RECIPE_IDS` が別定義（E の領域） | D2 は触れない |

## 5. 推奨する実装順序
1. **D2-a1**（新規ファイルのみ・inert、HV 不要）— 今すぐ着手可。
2. **#558 のマージ後**: **D2-a2**（DOUGH 以降の四角ステージ、入力座標、ソース canvas・ガイド・チーズ溜まり、`resolvePhysicalDrop`）。Preview 限定（`?pan=square`）。HV 必須。
3. **D2-b**（焼成・char・RESULT 縮尺・サムネイル）。D2-a2 の後。filter 非接触。HV 必須（390×844 動画 + before/after、360×800）。
4. F4-b は D2 と並行可（判定 1 か所の合意のみ）。F3 #553 は独立。
5. その後に E（#521）。

## 6. 独立して着手できる最初の実装単位: D2-a1
- 内容: `buildSquareSauceDisplayPixels` を使う `SquareSauceCanvas`、`SQUARE_TARGET_HALF_SIDE` を使う四角ターゲット枠、四角の溶け広がり範囲、四角サムネイル基底、`squarePanStage.css`。**どこからも import されない**（D1-a と同じ方式）。
- 完了条件: 丸い側のファイルを 1 行も編集しない／四隅セルが塗られる・天板外は描かれないピクセルテスト／`tsc -b`・`oxlint`・Vitest 全体 green／既存テスト無編集。
- HV: 不要（見た目・挙動の変化なし。`TETO_HUMAN-VERIFICATION-POLICY.md` §2）。
- 前提: Owner 承認のみ。#558 / #553 / F4-b / #518 に依存しない。

## 7. Owner 確認事項
1. D2-a1 の着手承認。
2. D2-a2 を #558 のマージ後に着手する順序でよいか。
3. 四角の焼成色（焼き色・焦げ・char の見え方）の扱い。filter 非接触だと、四角でも `.pizza-dough` 全体に同じ filter が掛かる。これで HV に出してよいか。
4. D2 は `panShape` を prop で受け、判定は F4-b の 1 か所に任せる方針でよいか（F4-b 側にも共有）。
5. Dinner × 四角（D1-b で意図的に未対応）を D2 でも対象外のままにするか。

## 8. この監査でやっていないこと
`src` / `e2e` / CSS の変更、PR 作成、#558 / #553 / F4-b ブランチへの接触、#540 のマージ、Preview リポジトリの作成、共有 Preview の更新、main へのマージ。アプリの実画面起動（上記 §1-8 参照）。
