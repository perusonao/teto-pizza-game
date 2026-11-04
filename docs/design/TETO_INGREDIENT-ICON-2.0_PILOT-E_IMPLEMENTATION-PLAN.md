# Ingredient Icon 2.0 — Pilot E 実装計画（docs-only）

Status: **計画のみ。Pilot E の実装は開始していない。** 決定の正本は [`Style Lock V2 §11`](../decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md)（Owner 決定 2026-10-31、Issue #712）。本書は実装範囲・影響範囲・テスト計画・ファイル競合・順序を整理する。
Base: `main` `d044719`。実装 Issue は Owner が起票する（Style Lock §7）。

## 1. 範囲

| 区分 | 内容 |
|---|---|
| **対象（Pilot E）** | `green-pepper`（GP-A2、緑の細切り）、`bell-pepper`（BP-B2、赤の四つ割り。**条件付き**）、`pineapple`（PA-A2、くさび形のカット果肉）。候補 SVG: `docs/design/candidates/ingredient-icons-2.0-pilot-e0/svg/` |
| 非対象 | `chicken`（既存の承認 §1b A を維持。骨なし化は承認なしに行わない）、焼成後の表現（#421 / #468 の方針確認まで保留）、NO_SAUCE の案内（別計画: [`TETO_NO-SAUCE_COMMON-GUIDANCE_PROPOSAL.md`](./TETO_NO-SAUCE_COMMON-GUIDANCE_PROPOSAL.md)）、他食材の SVG、`PROJECT_HANDOFF.md`（HOT） |
| 条件 | bell-pepper は **1.65em を起点にサイズ確認**。pineapple は **実機で果肉としての識別性を確認** |

## 2. 着手条件
1. Owner が Pilot E の実装 Issue を起票する（#712 は docs-only の追跡先）。
2. **#709 → #708 が main に merge された後**に開始する（§6 のファイルが重なる）。Owner の既定の merge 順は #706 → #709 → #708。
3. 最新 main から開始し、Duplicate Gate と claim を投稿する（`App.css` は HOT ファイル。SESSION-OPERATIONS §1）。
4. 実装時に最新 main で再確認する: `DedicatedIngredientVisual` の現行の値、`IngredientGlyph.tsx` の末尾、`App.css` の個別規則、影響レシピの再集計。

## 3. 変更ファイル（想定）

| ファイル | 変更 | 備考 |
|---|---|---|
| `src/data/ingredients.ts` | `DedicatedIngredientVisual` に 3 値を追加（案: `green-pepper-strips` / `bell-pepper-quarter` / `pineapple-wedges`）、3 行に `pieceVisual` を追加 | `emoji` は残す。`green-pepper` の 🌶️ / `bell-pepper` の 🫑 に関する「暫定の妥協」コメントを更新 |
| `src/components/IngredientGlyph.tsx` | `VISUAL_VIEWBOX` に 3 件（`0 0 64 64`）、3 つの小コンポーネント、`DedicatedIngredientSvg` の分岐 | 候補 SVG の子要素をそのまま JSX 化（camelCase）。接地影も移植。`id` / gradient / `<defs>` なし |
| `src/App.css` | 3 visual の個別サイズ規則（独自ブロック。起点: green-pepper / pineapple 1.45em、bell-pepper 1.65em、負マージン `-(em-1)/2`） | 既存の規則群（shiso 等、V1、arugula）には触れず、末尾に独立ブロックとして追記。トレイ chip で別規則が要るかを HV で確認（arugula の例） |
| `src/components/IngredientGlyph.test.tsx` | 専用 visual の期待マップに 3 件、visual ごとの描画テスト（viewBox・`aria-hidden`・`id=` / `url(#` なし・id 非依存）、「approved emoji」から pineapple を外す | 意図的な pin の更新（Style Lock §6 の規約に従う） |
| `src/data/ingredients.test.ts` | EMOJI_ROWS から pineapple を外す | 同上 |
| `src/data/__golden__/lateCatalog.offSurface.json` | `ingredients` の prefix digest を**意図的に再生成** | 差分は `pieceVisual` の 3 件のみであることを示す（arugula / shrimp / Pilot D と同じ前例）。`lateCatalog.offGolden.test.ts` の経緯コメントに追記 |
| `docs/design/references/ingredient-icons-2.0/` | 採用デザインの 3 SVG を `green-pepper.svg` / `bell-pepper.svg` / `pineapple.svg` として昇格、README の点数を更新 | 最終形の確定後（bell-pepper のサイズ確認後） |
| `docs/reports/…PILOT-E_Result.md` と `docs/reports/screenshots/ingredient-visual-pilot-e/` | Result と before / after の画像 | CLAUDE.md の HV 規則に従う |

**変更しないもの**: 食材の id・`emoji`・`color`・`category`、`toppingSizeClass.ts`（3 食材とも `m`。変更が必要なら Owner 判断）、`IngredientPieceVisual.tsx` / `PizzaStage.tsx` / `bakeVisual.ts`（描画経路は共通）、保存、採点、レシピ、在庫、Dex、Research、解禁順、経済、Hint 5.0 の golden / DH4 audit（絵は identity に関与しない見込み）。

## 4. 影響範囲

- **画面（自動）**: `pieceVisual` の 1 経路を通る 17 ファイル（Shop・Tray・Research・Hint・Notebook・RESULT・PizzaStage・Pizza / Reference サムネイル・PostBakePiece・CookingPrepLayer・Inventory・Dex ほか）。1 食材に `pieceVisual` を足すと全画面で同時に変わる。
- **レシピ**（Pilot E-0 時点の `main` + #711: 実装時に最新 main で再集計）: green-pepper 3（veggie-supreme-pizza / tandoori-paneer-pizza / jamaican-jerk-chicken-pizza）、bell-pepper 4（pesto-vegetariana / ratatouille-pizza / vegan-cashew-cheese-pizza / spanish-chorizo-pizza）、pineapple 3（hawaiian / pizza-overload / jamaican-jerk-chicken-pizza）。#709（supreme-pizza ほか）・#708 の merge 後に増える可能性がある。
- **影響しない**: 採点（位置・個数のみ）、保存 schema（`pieceVisual` は保存されない。旧版が新版の保存を読んでも id のみ）、Research の identity（絵は identity ではない。Research 画面に出るのは解禁素材の絵のみ）、解禁順・経済・ショップの価格。
- **ゴールデン**: `lateCatalog.offSurface.json` の ingredients digest のみ（上記）。Hint 5.0 の golden は食材 id を含むが絵・emoji を含まないため不変の見込み（実装時に確認）。

## 5. テスト計画

| 層 | 内容 |
|---|---|
| focused unit | `IngredientGlyph.test.tsx`、`ingredients.test.ts`（G18 の絵文字一意性を含む）、`lateCatalog.offGolden.test.ts`（digest の再生成後） |
| 静的 | `tsc -b`、`oxlint`、`vite build` |
| 代表 E2E | 3 食材のトレイ chip が専用 SVG（`svg.ingredient-glyph--<visual>`）を描く、横スクロールなし（390×844 / 360×800）。`e2e/b11-s1.spec.ts` の型（`HV_SCREENSHOT_DIR` / `HV_VIDEO`）。WebKit は既存の CI シャードで実行 |
| 全テスト | `ingredients.ts`（共有データ）とゴールデンに触れるため、**最後に 1 回** Pinsa ON / OFF（`npm run test:pinsa-off`）。#417 の Verification Budget に沿い、アイコン差し替えだけを理由にフル実行を反復しない |
| Visual HV（CLAUDE.md / HV Policy） | 390×844 の動画（Owner へ直接。リポジトリに含めない）＋ before / after 画像（`docs/reports/screenshots/ingredient-visual-pilot-e/`）。Chromium・WebKit の 390×844 と 360×800 |
| 識別の確認（Style Lock §11.5） | ピーマン↔青ねぎ・ハラペーニョ・パクチー・大葉・ピクルス／パプリカ↔ピーマン・ペパロニ・トマト／パイナップル↔フェタ・コーン・フォンティーナ・カシュー。20〜32px、焼成前・焼成後、グレースケール |
| Owner 実機 HV | iPhone Safari。**パイナップルが果肉として識別できるか**、**パプリカの 20〜24px での読みやすさ**、補正値（1.45 / 1.65em）の妥当性 |

before の基準画像: Pilot E-0 の Human Feel 素材（`docs/reports/screenshots/ingredient-icons-pilot-e0/` の Before 列、および PR #711 の `docs/reports/screenshots/b12/`）。実装後は同一シナリオ（保存・具材配置・DPR 3・viewport）を main ビルドと実装ビルドで撮り、切り出し・拡大・配置・注釈のみの比較シートにする。

## 6. ファイルの競合（2026-10-31 時点）

| 相手 | 重なるファイル | 状態 | 対応 |
|---|---|---|---|
| **#709**（ricotta-salata ほか） | `IngredientGlyph.tsx`、`IngredientGlyph.test.tsx`、`ingredients.ts`、`toppingSizeClass.ts` | open | **#709 の merge 後に着手**。各リストの末尾に追記して衝突を避ける |
| **#708**（mayo、未実装・待機中） | `ingredients.ts`、`IngredientGlyph.tsx`、`App.css`、`toppingSizeClass.ts`（Issue の記述からの推定） | 待機 | **#708 の merge 後に着手**。mayo の SVG と並ぶ |
| #711（B12） | なし（recipes・件数 pin・golden・manifest・docs のみ） | open | 競合なし。ジャークは 3 食材すべてを使うので、実装後の before / after の撮影に使える |
| #468（モッツァレラの溶け、HOLD） | `App.css`（`.pizza-cheese--mozzarella` の規則） | open（HOLD） | 規則が別（モッツァレラ）。HOLD のまま。再開した場合は rebase |
| #478（トレイドラッグ統一、HOLD） | `IngredientTray.tsx` ほか | open（古い） | Pilot E は `IngredientTray.tsx` に触れない。競合なし |
| #34（Reference visual、古い土台） | `App.css`、`IngredientPieceVisual.tsx` ほか | open（古い） | 既に main と衝突している古い PR。Pilot E は影響を受けない |
| **本 docs PR** | `docs/decisions/…STYLE-LOCK-V2.md`、`docs/design/…`、`docs/reports/…` | — | open PR で Style Lock・`references/`・`candidates/` を触るものはなし（確認済み）。競合なし |

- HOT ファイル（`scripts/ops/hot-files.json`）: `App.css`、`recipes.ts`、`PROJECT_HANDOFF.md` ほか。Pilot E は `App.css` を触るため、claim で「#709 / #708 の後に rebase」を明記する。

## 7. 実装順（1 PR・1 回の HV。Style Lock §5 の Pilot の単位）
1. データと描画: `ingredients.ts`（型・3 行）、`IngredientGlyph.tsx`（3 visual）、`App.css`（個別規則）、`IngredientGlyph.test.tsx` / `ingredients.test.ts`。
2. ゴールデン: `lateCatalog.offSurface.json` の ingredients digest を再生成（差分が `pieceVisual` の 3 件のみであることを確認）。
3. 検証: typecheck / lint / build、focused unit、代表 E2E、Pinsa ON / OFF の全テスト（1 回）。
4. HV: 実画面の before / after、390×844 の動画（Owner へ直接）、画像（`docs/reports/screenshots/ingredient-visual-pilot-e/`）、Result。
5. docs: 参照 SVG の昇格、Style Lock §11 の状態更新（別の docs-only PR でもよい）。
6. Owner の実機 HV と最終承認の後に merge（Owner 承認なしに merge しない）。

## 8. リスクと緩和

| リスク | 緩和 |
|---|---|
| bell-pepper（BP-B2）が 20〜24px で小さい | 補正 1.65em を起点に実画面で確認。小サイズ重視なら、縮小前の初稿 BP-B の大きさに戻す選択肢（Owner 判断） |
| pineapple（PA-A2）が離れて見ると「果肉」と分かりにくい | トレイ chip は名前つき。実機で識別性を確認（条件）。必要なら色・外皮の調整を Owner に提案 |
| ピーマンが緑の食材（青ねぎ・ハラペーニョ）と混同 | 形（細切り）で区別。色は近い（ΔE 14〜15）ため、20px の読みを HV で確認 |
| 補正値（em）がチップの高さ・幅を悪化させる | 負マージンで行ボックスを維持（前例）。390 / 360 で chip の寸法を前後で比較 |
| `overflow: visible` の SVG が WebKit で異なる見え方 | CI の WebKit シャード＋実機 HV |
| #709 / #708 と衝突 | merge 後に着手。リストの末尾に追記、独立ブロックで CSS を追加 |

## 9. Owner 起票用の実装 Issue 案（作成はしていない）

**タイトル案**: `Ingredient Icons 2.0 Pilot E 実装: green-pepper / bell-pepper / pineapple の専用 SVG（個別補正、描画のみ、Refs #712）`
- 親: #417。依存: #709、#708 の merge。
- 範囲: 本書 §3。非対象: chicken、焼成後、NO_SAUCE。
- 受入条件: 3 食材が全画面で専用 SVG を描く／食材 id・保存・採点・レシピは不変／識別確認項目（Style Lock §11.5）を満たす／bell-pepper の補正が確定／pineapple が実機で果肉として識別できる／ゴールデンの差分が `pieceVisual` の 3 件のみ／Pinsa ON / OFF の全テストが通る／HV（動画・画像）／Owner の実機 HV。

## 10. 保留
- 焼成後の表現（#421 / #468）、チキンの骨なし化、NO_SAUCE の案内の実装。
