# Issue #739 — 梅肉の専用 SVG としらすの視認性改善 Result Report

Status: **実装・自動検証・Chromium の HV 証跡（390×844 / 360×800）まで完了。Owner の承認と iPhone Safari 実機 HV の前は merge しない。共有 Preview・Production は更新していない。**
Branch `claude/issue-739-umeboshi-whitebait-icons` / 基準 `main` `4ac767c`。#738 のブランチ（`claude/cooking-steam-s3-ui`）には触れていない。`PROJECT_HANDOFF.md` は変更していない。
Owner 方針（P1）: 梅肉は「ペースト＋梅の花」の専用 SVG、しらすは比較案 D、**大葉は対象外**。

## 1. 変更（描画のみ）

| 対象 | 変更 |
|---|---|
| 梅肉 `umeboshi-paste`（sauce） | `pieceVisual: "umeboshi-paste-dab"` を追加。ペースト色 `#b8405a` の塊に 5 弁の梅の花。`App.css` に `.ingredient-glyph--umeboshi-paste-dab`（1.5em、負マージンでレイアウト箱は 1em）。🍑 はテキスト fallback として残り、DOM には出ない（G18 の一意性も維持） |
| しらす `whitebait-school` | 魚のスケール 1.3 → 1.5、輪郭 `#4d4837` / 2.1 → `#2e2a1d` / 2.8、箱 1.2em → 1.35em（専用ルールで上書き。共有グループは無変更）。size class `s` は変更なし |
| 参照 SVG | `docs/design/references/ingredient-icons-2.0/` に `umeboshi-paste.svg` を追加、`whitebait.svg` を更新、README に追記 |
| テスト | `IngredientGlyph.test.tsx`（新規 7 件 + `ALL_DEDICATED` に追加）、`expansionBatch16.test.ts` の「梅肉に `pieceVisual` なし」の 1 assertion を「`umeboshi-paste-dab`」に更新（意図した変更） |

**触れていない:** レシピ、保存形式、採点、Research、privacy、ladder、梅肉の色 `#b8405a`、大葉、#738。

## 2. 必須条件の確認

| # | 条件 | 結果 |
|---|---|---|
| 1 | sauce の `IngredientGlyph` 経路 | **確認済み。** 成分の絵文字を読むのは `IngredientGlyph` のみ。sauce チップ（`IngredientTray` の非 cheese 枝）、Shop、Dex、Inventory、Hint はすべてここを通る。`pieceVisual` は ingredient 共通の型で、sauce でも追加の経路変更は不要だった。sauce の「塗り」は canvas で、影響を受けない |
| 2 | 梅肉の専用 SVG | 追加済み。id / gradient / defs なし、viewBox 64×64、`aria-hidden`（テストで固定） |
| 3 | しらすの輪郭・サイズ・コントラスト | 案 D を適用。トレイ・生地上とも大きく・濃くなった（§3） |
| 4 | 8 スロットで重ならない | **確認済み。** B16 の 8 スロット（モッツァレラ 2・しらす 4・大葉 2）で、全ピースの SVG の外接矩形を測定。しらすと他のピースの重なりは 0。唯一の重なりは既存のモッツァレラ同士（390: 6.1% / 360: 9.4%）で、変更前と同値 |
| 5 | 390×844 / 360×800 の before/after | §3 とスクリーンショット |
| 6 | 既存食材への回帰 | 全 Vitest（§4）、B16 E2E（両 viewport）。絵文字経路の全食材の DOM が変更前と同一であることは既存テスト（`IngredientGlyph.test` の EMOJI_ROWS）が固定 |
| 7 | HV Policy | 動画（直接提出）とスクリーンショット（コミット）。§5 |
| 8 | テスト・型・lint・build | §4 |

## 3. before / after（同じ B16 のフローを main と本ブランチで実行）

- しらす: 生地上の幅 28.5px → 32.1px（390 / 360 とも）。輪郭が濃くなり、梅肉ソースの上でも焼いた生地の上でも輪郭で魚が判別できる。トレイのチップも同様に大きく・濃くなった。
- 梅肉: ソーストレイとショップの 🍑 が、ペースト＋梅の花に変わった。桃に見える問題は解消。1.1em では絵文字より小さく見えたため 1.5em に調整した（絵文字と同程度の幅）。
- 画像: `docs/reports/screenshots/issue-739-icons/`（`before-*` / `after-*` と、各 viewport のコンタクトシート）。
- 比較検討（案 A〜D、梅肉 4 案）の元画像は調査時に Owner へ提出済み。

## 4. 検証（本セッション）

| 検証 | 結果 |
|---|---|
| 全 Vitest（Pinsa ON） | **11,310 passed・0 failed**（13 skipped / 2 todo、608 files） |
| 全 Vitest（Pinsa OFF） | **未実行**（見た目のみの変更で ON と差が出ない見込みだが、CI で確認） |
| `tsc -b` / `oxlint` / `npm run build` | exit 0 / exit 0（既存の warning のみ、本変更で新規なし） / 成功 |
| Chromium E2E `e2e/b16.spec.ts`（390×844 / 360×800） | **4/4 passed**（変更前の main でも 4/4） |
| WebKit E2E / CI | PR の CI で確認 |
| iPhone 実機 Safari | **未実施**（Owner の HV）。Apple の絵文字・フォントは本環境と異なる |

注意: 本環境は Playwright 既定の chromium の版が合わないため、一時 config（未コミット、削除済み）で `/opt/pw-browsers/chromium` を使用した。

## 5. Human Verification 証跡

- **動画（Owner へ直接提出済み、リポジトリには入れていない）:** `issue-739-icons-390x844.mp4`、390×844、H.264、24.3 秒、約 530 KB。ショップ NEW の梅肉 → 購入 → 図鑑 / Research → 梅肉を塗る → チーズ → しらす 4・大葉 2 → 焼成 → NEW DISCOVERY → 図鑑。
- スクリーンショット: 上記ディレクトリ（各 390×844 / 360×800）。

## 6. 残るリスクと Owner の確認事項

1. **実機 Safari 未確認。** 特に、26px のチップでペーストと梅の花が梅として読めるか、しらすの輪郭が濃すぎないか。
2. 焼成後（ロースト色フィルター下）のしらすの見え方は、HV 動画の範囲でのみ確認。
3. 大葉（`shiso`）は対象外のまま、生地上で小さい（約 23px）。別件で扱う場合は別 Issue 推奨。
4. 梅肉 SVG の色（ペースト `#b8405a`）はソースの塗り色と同一で、変更していない。焼成後にトマトに近づく件は #739 の Non-goal どおり。
5. merge は Owner 承認待ち。
