# Pilot E-0 Style Lock 追補 — Result Report（docs-only、Issue #712）

Status: **Owner 決定（2026-10-31）を Style Lock V2 §11 に記録。Pilot E の実装は開始していない。** merge は Owner 承認待ち。
本番コード・既存 SVG・ゲーム挙動は変更していない（`src/` の差分 0、既存の `references/` の SVG は未変更）。#711 / #709 / #708 のブランチには触れていない。新規 Issue は作っていない（#712 を使用）。
Base: `main` `d044719`。

## 1. 採用案（Owner 決定 2026-10-31）

| 項目 | 決定 | 記録先 |
|---|---|---|
| ピーマン `green-pepper` | **GP-A2 採用**（緑の細切り） | Style Lock §11.1 / §11.2 |
| パプリカ `bell-pepper` | **BP-B2 条件付き採用**（1.65em を起点にサイズ確認。20〜24px の読みやすさが確認項目） | 同上 / §11.3 |
| パイナップル `pineapple` | **PA-A2 採用**（実機で果肉としての識別性を確認） | 同上 / §11.5 |
| チキン | **既存のドラムスティック承認（§1b A）を維持。** 骨なし候補は比較資料のみ | §11.1 / §11.4 / §11.6 |
| NO_SAUCE N-A | **条件付き採用**（INV-D4 / INV-D7 の追加検証） | §11.7、[`NO-SAUCE 提案書`](../design/TETO_NO-SAUCE_COMMON-GUIDANCE_PROPOSAL.md) |

## 2. 保留事項
- **焼成後の表現**（焼き色・チーズとのなじみ・立体感）: #421 / PR #468（HOLD）の方針確認まで実装しない。
- **チキンの骨なし化**: Owner の承認なしに変更しない。進めるなら B1 / B2 の磨き込みが先（Owner の指示後）。
- **NO_SAUCE の実装**: INV-D7 の解釈（N-A のまま／N-D 全工程共通）、表示場面、文言の最終形、#489 との置き場所の調整が未決。
- **参照 SVG への昇格**: Pilot E の実装 PR（bell-pepper のサイズ確認の後）。
- **未確認**: トマト（`tomato-slice`）・`beef-slices` との識別、焼け過ぎ（heat 2.0）での見え方、iPhone Safari・WebKit の見え方。

## 3. 本 PR の内容（docs-only）

| ファイル | 内容 |
|---|---|
| `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md` | **§11 を追記**（Owner 決定、追加対象 3 食材、サイズ補正の起点、既存承認との整合、識別確認項目、保留）と、§5 に 1 行の追記。**既存の節の変更は 0 行**（追加 68 行、削除 0 行） |
| `docs/design/TETO_INGREDIENT-ICON-2.0_PILOT-E_IMPLEMENTATION-PLAN.md` | Pilot E の実装範囲・変更ファイル・影響範囲・テスト計画・ファイル競合・実装順・リスク・Owner 起票用の Issue 案 |
| `docs/design/TETO_NO-SAUCE_COMMON-GUIDANCE_PROPOSAL.md` | N-A の文言確認、条件付きの条件、追加検証の計画（T1〜T7）、実装前の判断事項 |
| `docs/design/candidates/ingredient-icons-2.0-pilot-e0/` | 候補 SVG 11 点（採用 3 点を含む）と README（状態表） |
| `docs/reports/TETO_PILOT-E0_ROUND2_Result.md` | 第 2 回の比較結果（所見・指標・契約確認・Owner 決定） |
| `docs/reports/screenshots/ingredient-icons-pilot-e0/` | 比較画像 10 枚（約 3.9 MB） |
| 本書 | Result Report |

## 4. 既存の Style Lock との整合確認

| 確認 | 結果 |
|---|---|
| 既存の節の変更 | **なし**（差分は追加のみ。§5 に 1 行、末尾に §11） |
| §1b `chicken` = A 案ドラムスティック | **変更なし**（§11.4 で明記。改訂には §1d / §10.3b と同じ手順の別記録が必要） |
| §2 共通仕様（64×64・透明背景・接地影・`id` / gradient / `<defs>` / `url(#` なし・文字なし） | 候補 SVG **11 点すべて**で機械的に確認 |
| 26 種の対象（§1 / §1b / §9）、§10.2 の追加対象 | 変更なし。3 食材は 26 種の外（§10.2 と同じ追加扱い） |
| G18（グリフ一意性） | `emoji` フィールドは変更しないため影響なし |
| §7（実装は最新 main から、実装 Issue は Owner が起票） | 守っている（実装を開始していない。Issue 案のみ） |
| §10.8（`PROJECT_HANDOFF.md` は HOT のため別の docs-only PR） | 触れていない |
| 内部リンク | 新規・変更の 5 つの md ファイルで**リンク切れなし** |
| 「Pilot E」の名称 | 既存の文書に無く、衝突なし |

## 5. ファイル競合の確認（2026-10-31）

- **本 docs PR**: open PR のうち Style Lock・`references/`・`candidates/` を触るものは**なし**（#709 のファイル一覧と、docs 系の open PR を確認）。競合なし。
- **Pilot E 実装時**: #709（`IngredientGlyph.tsx` / `.test.tsx` / `ingredients.ts` / `toppingSizeClass.ts`）、#708（`ingredients.ts` / `IngredientGlyph.tsx` / `App.css` の見込み）と重なる → **#709 → #708 の merge 後に着手**。#468（`App.css` のモッツァレラ規則、HOLD）、#478（`IngredientTray.tsx`、HOLD・古い）、#34（古い土台）は、規則・ファイルが別または既に衝突済みで影響なし。#711 は競合なし。詳細は実装計画 §6。

## 6. 次の実装計画（Pilot E。詳細は実装計画書）
1. Owner が実装 Issue を起票（案は計画書 §9）。依存: #709 → #708 の merge。
2. 実装（1 PR・1 回の HV）: `ingredients.ts`（型 + 3 行）、`IngredientGlyph.tsx`（3 visual）、`App.css`（個別規則: 1.45 / 1.65 / 1.45em を起点）、テストの意図的な pin 更新（pineapple を approved emoji から外す）、`lateCatalog.offSurface.json` の digest 再生成（差分は `pieceVisual` の 3 件のみ）。
3. 検証: typecheck / lint / build、focused unit、代表 E2E（390 / 360）、Pinsa ON / OFF の全テストを最後に 1 回、WebKit は CI。
4. HV: before / after（実画面）、390×844 の動画（Owner へ直接）、Owner の実機 HV（パイナップルの果肉識別、パプリカの小サイズ）。
5. 実機 HV と最終承認の後に merge（Owner 承認なしに merge しない）。

## 7. CI・レビュー
PR 作成後に確認し、PR コメントとチャットで報告する（本書をコミットした後の結果は、HEAD を変えないようここには書かない）。
