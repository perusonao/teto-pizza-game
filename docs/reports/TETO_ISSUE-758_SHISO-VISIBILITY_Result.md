# Issue #758 — 大葉 `shiso-leaf` の視認性 調査 Result（調査・画像比較のみ。runtime 変更なし）

- 日付: 2026-11-05 / base: main `d85b957`
- 種別: **調査のみ**（docs + screenshot）。`src/`・`App.css`・ゲームロジック・Style Lock V2 は変更していない。比較用の一時 spec（CSS 注入）は commit していない。
- HV 動画: 本件は runtime を変えないため HV Policy §2「原則不要（docs-only）」。動画は実装 PR で撮る。
- Refs #758 / #417 / #739 / #733

## 0. 結論（要約）

| 項目 | 結果 |
|---|---|
| 推奨 | **1.35em（margin −0.175em）**。しらす `whitebait-school` の現行値（#740、`App.css` の個別ルール）と同じ値・同じ方式 |
| 効果 | ピザ上 23.5 → **26.5px**（+13%）、RESULT 17.6 → **19.8px**。トレイ chip 31.2 → 35.1px（しらすと同じ） |
| 重なり | レシピどおりの配置（梅しそ）では**重なり 0**（1.2 / 1.35 / 1.5em とも）。しらすの真横に置いた密集配置では、1.35em で箱の重なりが少し増える（390: 3.5→8.7%、360: 10.5→14.9%）。それでも葉と魚の間に隙間が残る。**1.5em では葉と魚が接する** |
| 1.5em | 参考値。ピザ上 29.4px でしらす（32.1px）に近づくが、密集時に接するため推奨しない |
| 実装の可否 | **可能（CSS 1 ルール）。** ただし `App.css` は HOT ファイル。Owner の承認・claim・Owner Gate 確認の後に着手する（§6） |

## 1. 確認したもの

- `CLAUDE.md`、`docs/PROJECT_HANDOFF.md`（Ingredient Icon 2.0 節、startup checklist）、`TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`（§3 追記、§10.2、§11.3）、`TETO_HUMAN-VERIFICATION-POLICY.md`、`TETO_SESSION-OPERATIONS_1.0.md`（§1・§8）
- 前回の調査 `docs/reports/TETO_INGREDIENT-ICONS_733-739_Design-Comparison_Result.md`（ブランチ `claude/teto-pizza-ingredient-icons-q7c1je`、`be64b35`）の OD-5
- 最新 main `d85b957`。open PR 20 件、#733 / #748 / #753 / #758 / #739 の claim

## 2. 現在の描画（実測、Chromium、DSF 1）

描画サイズの計算: ピザ上の font は `28px × piece-scale × rank-scale`。shiso は size class `xs`（本番 B = 0.7）で 19.6px。その 1.2em（`App.css` 828–841 の 8 visual 共通ルール）で、描画箱は **23.5px** になる。RESULT は ×0.75 で 14.7px、描画箱は **17.6px**。

| 場所 | 大葉 1.2em（現行） | 1.35em | 1.5em | しらす（現行 1.35em、class s） |
|---|---:|---:|---:|---:|
| トレイ chip（font 26px） | 31.2 | 35.1 | 39.0 | 35.1 |
| ピザ上（焼成前） | **23.5** | 26.5 | 29.4 | 32.1 |
| 焼成後 RESULT | **17.6** | 19.8 | 22.0 | 24.1 |

- chip の外寸は全条件で 118×64（390）/ 108×64（360）のまま。横スクロールなし（`scrollWidth − clientWidth = 0`）。
- 390 と 360 で、ピザ上の glyph の px は同じ（ピザの大きさは viewport で変わらない）。

## 3. 比較画像

`docs/reports/screenshots/issue-758-shiso-visibility/`

| ファイル | 内容 |
|---|---|
| `sheet-390x844-ume.png` / `sheet-360x800-ume.png` | 梅しそピザ（梅肉ソース、モッツァレラ 2・しらす 4・大葉 2、レシピどおり）。1.2 / 1.35 / 1.5em × トレイ chip・ピザ上・中央 ×2・RESULT・RESULT ×2 |
| `sheet-390x844-dense.png` / `sheet-360x800-dense.png` | 密集配置: 大葉 4 枚を、しらす 4 か所の真横（生地の箱の約 10% の間隔）に置いた悪い条件 |
| `sheet-sizes-20-48.png` | 64-box の参照 SVG を font 20 / 24 / 28 / 32 / 48px で並べたもの。大葉 1.2 / 1.35 / 1.5em と、しらす・青ねぎ・パクチー・バジル 🌿 を、生地・ソース・焼成色の上でカラーとグレースケールの両方で表示 |
| `{390x844,360x800}-ume-{1_2,1_35}em-{1-tray,2-topped,3-result}.png` | 元の画面全体（現行と推奨案） |

`sheet-sizes-20-48.png` は `docs/design/references/ingredient-icons-2.0/` の参照 SVG を使った。しらすの絵は runtime（#740 案 D）と少し違う可能性がある。大葉の参照 SVG は runtime と同じ形。

撮影方法: 既存 `e2e/b16.spec.ts` と同じセーブ・手順の一時 spec で、`.ingredient-glyph--shiso-leaf` の width / height / margin だけを `addInitScript` で上書きした。spec は撮影後に削除しており、commit していない。

## 4. 評価

- **トレイ**: 現行の 1.2em でも名前つき chip で読める。1.35em でしらす・青ねぎの chip と同じ大きさになり、並びがそろう。1.5em は chip 内では大きく見えすぎる。
- **ピザ上（焼成前）**: 現行は、しらす（32px）と比べて葉が「小さな緑の点」に近い。**1.35em では鋸歯と葉脈が読める**。しらすより少し小さいままなので、主役（しらす）と添え物（大葉）の大小関係は保たれる。
- **焼成後（RESULT）**: 現行 17.6px では「緑の点」に見える。1.35em（19.8px）で葉の形が分かる最小の大きさに届く。HV Policy の 20px 目安にほぼ等しい。1.5em（22px）はさらに読みやすい。
- **識別性**: パクチー（1.2em、切れ込みの多い葉）とは、1 枚の鋸歯の葉という形で区別できる。バジル 🌿 は枝の形なので混同しない。グレースケールでも輪郭線（#245f2c）で形が残る。梅肉・トマトのソース上では、緑と赤の明度が近く面のコントラストは弱い。それでも輪郭で読める（1.35em で改善）。
- **重なり（実測、glyph 外接矩形の最大重なり率）**:

| 配置 | 1.2em | 1.35em | 1.5em |
|---|---:|---:|---:|
| 梅しそ（レシピどおり）焼成前・RESULT | 0 | 0 | 0 |
| 密集 390 焼成前 | 3.5% | 8.7% | 12.8% |
| 密集 360 焼成前 | 10.5% | 14.9% | 18.4% |
| 密集 RESULT（両 viewport） | 18.5–20.1% | 22.0–23.5% | 24.8–26.2% |

  外接矩形には SVG の余白が含まれるため、絵が実際に重なる量はこれより小さい。画像で見ると、1.35em では葉と魚の間に隙間が残る。1.5em では接する。
- **ピザ全体**: 1.35em で緑のアクセントが増え、白いしらす・赤いソースの中で大葉が「載っている」と分かる。密度が過剰になる印象はない。

## 5. 未確認（本調査の範囲外）

- **iPhone Safari 実機**（Issue の受入条件。Owner HV で判断）
- shirasu-pizza（ソースなし、生地の上の大葉 1 枚）。生地上の見え方は 20–48px シートの「生地」行で代用した
- `lateCatalog.ts` の POST_BAKE で大葉を使う 3 レシピ（後乗せ層 `.pizza-post-layer`。本番で無効なら影響なし）
- Shop / Inventory / Dex / Reference mini pizza / Hint など、他の glyph 用途。CSS のクラスは **shiso-leaf が描かれる全箇所**に効く（しらすの #740 と同じ）

## 6. 実装する場合の変更ファイルと競合リスク

**変更ファイル（1 ファイル）: `src/App.css` のみ**
1. 828–841 の共通ルール（8 visual）から `.ingredient-glyph--shiso-leaf` を外す
2. 843–848 のしらすの個別ルールに `.ingredient-glyph--shiso-leaf` を足す（`1.35em / -0.175em`）。または同じ値の独立ルールを作る。コメントに #758 を付ける
- 変更しないもの: `IngredientGlyph.tsx`（SVG）、`ingredients.ts`、`toppingSizeClass.ts`（xs のまま）、`IngredientGlyph.test.tsx`（サイズの assertion なし）、食材 ID・採点・セーブ・Dex・Research・Inventory・Economy
- e2e: 大葉のサイズを assert している spec はない（`expansion-batch8b` / `b16` / `late4` / `new-sauces-u1` は存在だけを確認）
- docs: Style Lock V2 §10.2 の「1.2em・約 17.6px」の記述を更新する。ただし #753 の merge 後に行う

**競合リスク**

| 相手 | 内容 | リスク |
|---|---|---|
| #733（牛肉・ピーマン、別セッション、claim は 11/08 まで） | claim は `IngredientGlyph.tsx` / test / e2e / report。**`App.css` は claim に含まない**。ただし牛肉・ピーマンにサイズ補正を入れるなら、同じ `App.css` の glyph 補正ブロックに触れる可能性がある | **中**（HOT。#733 を先に merge し、本件はその上に rebase するのが安全） |
| #748 / PR #759（Batch 18、claim は 11/19 まで） | `ingredients.ts`・`toppingSizeClass.ts` など。`App.css` は変更していない | **低**（本案は size class を変えない。xs → s で大きくする別案は #748 と衝突するため採らない） |
| #753（Style Lock V2 §12 eggplant、docs-only） | Style Lock V2 文書 | **低**（本件の文書更新は #753 の merge 後） |
| PR #468（mozzarella melt pilot、10/12 から停止中） | `App.css` の piece 系の範囲（800–1000 行付近）に差分あり | **低〜中**（古い PR。先に merge される場合は rebase で吸収） |
| #757 / #756 / #738 / #746（Steam / DRIZZLE） | `App.css` 差分なし | なし |

## 7. Owner 判断事項（推奨つき）

| # | 判断 | 推奨 |
|---|---|---|
| OD-758-1 | 採用するサイズ | **1.35em**（しらすと同じ値・方式）。1.5em は密集時に接するため採らない |
| OD-758-2 | 実装の可否 | **実装してよい**（CSS 1 ルール、描画のみ）。採用確定は iPhone Safari 実機 HV の後 |
| OD-758-3 | 実装の時期 | **#733 の merge 後**（`App.css` HOT の重複を避ける）。#733 が `App.css` を変えないと分かった時点で並行着手も可能。いずれも着手前に claim（`src/App.css` + 本件の e2e / report）と Owner Gate を確認する |
| OD-758-4 | Style Lock V2 の記述更新 | 実装 PR に含める。**#753 の merge 後** |
| OD-758-5 | 実機 HV の確認項目 | ① 梅しそ / しらすピザで、焼成前と RESULT の大葉が「葉」と読めるか ② しらすとの大小関係が不自然でないか ③ Shop / Dex の大葉 chip |
