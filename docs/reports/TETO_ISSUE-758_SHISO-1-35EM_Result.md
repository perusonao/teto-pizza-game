# Issue #758 — 大葉 `shiso-leaf` を 1.35em に（描画のみ）Result

- 日付: 2026-11-05 / base: main `d85b957` / ブランチ: `claude/issue-758-shiso-1-35em`
- 調査: `claude/shiso-leaf-visibility-investigation-w7qok9` の `6878e74`（`docs/reports/TETO_ISSUE-758_SHISO-VISIBILITY_Result.md`、1.2 / 1.35 / 1.5em の比較と 20〜48px シート）
- 状態: **実装・Chromium 検証済み。Owner の iPhone Safari 実機デザイン HV は PASS（2026-11-06、#760+#761+#765 の統合 Preview での確認。PR コメント参照）。PROVISIONAL コメントは除去済み。** merge・Production・共有 Preview の更新は行っていない。
- Refs #758 / #417 / #739

## 1. 変更

| ファイル | 内容 |
|---|---|
| `src/App.css` | `.ingredient-glyph--shiso-leaf` の個別ルールを追加した（`width/height: 1.35em; margin: -0.175em`）。しらすのルール（#739）の直後に置き、同じ値・同じ方式にした。8 visual の共通ルール（1.2em）は変更していない（後に書いた個別ルールが勝つ。しらすと同じ扱い）。負マージンにより、レイアウト上の占有は 1em のまま |
| `e2e/issue-758-shiso.spec.ts`（新規） | HV 用の代表 E2E（3 テスト × 2 viewport）。em 比率（computed width / font-size）、chip の寸法、chip 内に収まること、しらすとの重なり、横スクロールなし、を確認する。`SHISO_EXPECT_EM=1.2` で main の before も同じ spec で記録できる |
| `docs/reports/TETO_ISSUE-758_SHISO-1-35EM_Result.md`、`docs/reports/screenshots/issue-758-shiso/` | 本書と before/after 画像・実測 JSON |

**変更していないもの:** 他の食材の glyph、8 visual の共通ルール、size class（`toppingSizeClass.ts`、shiso = xs）、`IngredientGlyph.tsx`（SVG）、`ingredients.ts`、食材 ID・レシピ・採点・セーブ・Dex・Research・Inventory・Economy、Style Lock V2（#753 との重複を避けて別途、§6）。

## 2. 実測（Chromium、DSF 1。before = main `d85b957`、after = 本ブランチ）

| 場所 | font | before 1.2em | after 1.35em |
|---|---:|---:|---:|
| トレイ chip | 26px | 31.2 | 35.1（しらすと同じ） |
| ピザ上（焼成前） | 19.6px | 23.5 | **26.5** |
| 焼成後 RESULT | 14.7px | 17.6 | **19.8** |
| 後乗せ（FINISH、`.pizza-post-layer`、たらこクリームピザ） | 19.6px | 23.5 | 26.5 |
| 後乗せの RESULT | 14.7px | 17.6 | 19.8 |
| ショップの行 | 14px | 16.8 | 18.9 |
| 図鑑カードの食材 pill | 11px | 13.2 | 14.8 |
| ヒントの chip（これまでにわかったこと） | 16px | 19.2 | 21.6 |

- 390×844 と 360×800 で同じ値（ピザ上の glyph は viewport で大きさが変わらない）。
- トレイ chip の外寸は before / after とも 118×64（390）/ 108×64（360）。glyph は chip の内側に収まる。全画面で横スクロールなし。
- ショップ・図鑑・ヒントの行の高さと配置は before / after で変わらない（`ba-shop-dex-hint-*.png`）。

**しらすとの重なり**（glyph の外接矩形で、大葉の箱のうち他の piece と重なる最大割合）

| 配置 | before | after |
|---|---:|---:|
| 梅しそピザ（レシピどおり）焼成前・RESULT | 0 | **0**（E2E で assert） |
| 密集（しらすの真横）390 焼成前 | 3.5–3.8% | 8.7–8.9% |
| 密集 360 焼成前 | 10.5–10.8% | 14.9–15.1% |
| 密集 RESULT | 18.5–20.1% | 22.0–23.5% |

外接矩形には SVG の余白が含まれる。画像で見ると、after でも葉と魚の絵は接しない（`ba-dense-*.png`）。調査時の値と一致した。

## 3. 画像

`docs/reports/screenshots/issue-758-shiso/`（各シートは左から before / after の順に並べた）

| ファイル | 内容 |
|---|---|
| `ba-tray-topped-result-{390x844,360x800}.png` | 梅しそピザ: トレイ（具材）、生地の上、焼成後 RESULT |
| `ba-zoom-result-{…}.png` | RESULT のピザ部分 ×2（梅しそ・たらこクリーム） |
| `ba-dense-{…}.png` | 密集配置の焼成前と RESULT |
| `ba-postbake-{…}.png` | たらこクリームピザ: FINISH で大葉を後乗せ、RESULT |
| `ba-shop-dex-hint-{…}.png` | ショップの行、図鑑カード（しらすピザ）、ヒント |
| `before/*.json`, `after/*.json` | E2E が記録した実測値 |

## 4. 検証

- `npx tsc -b`: exit 0
- `npm run lint`（oxlint）: exit 0（既存の warning のみ）
- `npm run build`: 成功
- Vitest（focused）: `IngredientGlyph.test.tsx`、`App.css` を読む 11 ファイル、`expansionBatch16.test.ts` — **13 files / 366 passed**。全件の Vitest は CI の `build` に任せた
- Chromium E2E（390×844 / 360×800）: `issue-758-shiso`、`b16`、`expansion-batch8b`、`late4`、`new-sauces-u1/u2/u3/b1`、`new-bbq`、`pilot-e-ingredient-icons`、`cooking-tray-family-row-stable`、`finish-tray-finb`、`viewport-1screen` — **98 passed / 16 skipped / 0 failed**
  - 撮影中、`expansion-batch8b` が 1 回だけ console の 404（リソースの読み込み失敗）で失敗した。main でも本ブランチでも同じように起き、上の一括実行では両 viewport とも pass した。大葉のサイズとは無関係
- `issue-758-shiso` は main の CSS では `SHISO_EXPECT_EM=1.2` でのみ pass し、1.35em を期待する既定値では落ちる。変更を検出できることを確認した
- Owner Gate（dry-run）: run 41988333827 が success。artifact はこの環境のネットワーク制限で取得できなかったため、claim と open PR の重複は手動で確認した（§5）
- iPhone Safari 実機: **PASS**（Owner、2026-11-06。統合 Preview #760+#761+#765 での確認で、#761 単独 HEAD ではない）

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `issue-758-shiso-390x844.mp4` | 390×844 | 97.0s | 1.69 MB | PASS |

Download: セッション内で直接提出（リポジトリには入れていない）

Video Verification: PASS（H.264 / 390×844。フレームを抜き出して、ショップ → ヒント → トレイ → 生地の上 → RESULT → 密集配置 → 後乗せの順に映っていることを確認した）

この動画で確認すること:
- ショップ・ヒントの「大葉」の葉が、隣の食材と同じくらいの大きさで読めるか
- 具材トレイの大葉 chip がしらす・青ねぎの chip と同じ大きさで並び、chip が崩れないか
- 梅しそピザの生地の上と焼成後で、大葉が「葉」として読めるか。しらすとの大小関係が不自然でないか
- しらすの真横に置いても、葉と魚が重ならないか
- たらこクリームピザで大葉を後乗せ（仕上げ）したときの大きさ

## 5. 競合の確認

- **#760（#733 牛肉・ピーマン）**: `IngredientGlyph.tsx` / `CookingPrep.css` など。`App.css` は変更しない。重なりなし
- **#748 / PR #759（Batch 18）**: `ingredients.ts`・`toppingSizeClass.ts` など。重なりなし（本件は size class を変えない）
- **PR #468（mozzarella melt pilot）**: `App.css` を共有する（HOT）。ただし差分は `.pizza-cheese--mozzarella` で、glyph のルールとは別の箇所。どちらが先に merge されても、後の側が rebase する
- **PR #34**（2026-09 から停止中）: `App.css` を含むが古い
- **#753（Style Lock V2 §12、docs-only）**: 本 PR は Style Lock V2 に触れない
- claim: Issue #758 comment 6652448757（`src/App.css`、本 spec・report、期限 2026-11-08）

## 6. Owner 判断事項

| # | 判断 | 推奨 |
|---|---|---|
| OD-758-2 | iPhone Safari 実機 HV での採用確定 | 動画の確認項目で判断。**PASS（2026-11-06）**。`App.css` の「PROVISIONAL」を除去済み |
| OD-758-4 | Style Lock V2 §10.2 の記述更新（「1.2em・RESULT 約 17.6px」→「1.35em・約 19.8px」） | **#753 の merge 後に docs-only で行う**（本 PR には含めない） |
| — | merge・Production・共有 Preview | Owner の承認まで行わない |
