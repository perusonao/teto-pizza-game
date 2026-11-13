# Cooking Fry — F2 前の非 HOT 拡張 Result Report (Issue #749)

Status: **MERGED**（Owner 承認の Squash merge、PR #839、main `03f32e1941b45e9e12fc213a8dc089181a97f700`、承認対象 HEAD `6d9499ab864fc76c4aaa0b710d2049466e3500e4`）。Production OFF・未配線。PR 作成時の base = `main` `cf0c865`（merge 時の base は `81974d0`）。
Claim: Issue #749 コメント 6831100109（#839 専用。本訂正 PR の後に release）。

> 訂正（2026-11-13）: 初版は PR 作成時点の「Draft PR・merge は Owner 承認待ち」のままだった。上記の merge 済みの状態と、下の §4 の merge 後 CI・Codex の記録に改めた。§1〜§3 の監査・変更の記述は初版のまま（監査は main `cf0c865` 時点）。

## 1. 監査（着手前）

| 項目 | 結果 |
|---|---|
| 既存 FRY 実装 | F1 は #750 で main 済み（`src/logic/fry/**`、`fryIngredients`、`fryExperienceGate`、`fryPreview`）。reducer / UI 配線なし。`FRY_EXPERIENCE_PRODUCTION=false` |
| eggplant | `pieceVisual` なし → `canFryIngredient("eggplant")===false`（休眠）。専用 SVG は別ブランチ（`claude/eggplant-ingredient-svg-13rbjw`、#782）。本 PR は `ingredients.ts` を編集しない |
| 他 PR との重複 | open PR（#836〜）に FRY 系なし。#795 MID_BAKE 系（#829〜#834）、#738、#746 と変更ファイルの重なりなし。`midBakeArchitecture.test.ts` / `drizzle.architecture.test.ts` の fry 禁止検査は通る |
| claim の重なり | F1 claim（6633217463、〜11/18）と同一ファイルを編集。F1 は merge 済み、保持者へ直接連絡不可のため専用 claim に明記。Lab claim（6691360461）の `fryLab/**` / `main.tsx` とは重ならない |
| 未承認事項 | Lab 用 `LATER_SLICES` 2 行追加（コメント 6701290104）は**承認が無いため実施していない** |

## 2. 変更（テスト中心、挙動は不変）

- `data/fryIngredients.ts`: `fryTargetStatus()`（`not-target` / `dormant` / `active`）を追加。`canFryIngredient` は同じ規則のまま `status === "active"` に。
- `logic/fry/fryOffer.ts`: 任意の `pieceVisualOf` テスト seam を追加（本番の呼び出しは未指定）。
- テスト: 登録の整合（実在・重複なし・topping・理由の名前付け）、offer の有効側（GUIDED / FREE_COOK のみ、LUNCH_RUSH / DINNER は常に null、done 表示、各拒否条件、返り値に recipe / score を含まない）、fried look（決定性、単調性、有限小数、`--fry-*` のみ）。
- architecture test: `--fry-*` / `ingredient-piece--fried` の他ファイル混入禁止、opt-in 名の漏れ禁止、本番スイッチが `false` で gate の ON 経路が Preview/DEV のみ、offer / 登録が recipe・score・Research を読まない、登録の import が catalog の読み取り 1 件のみ。

## 3. 触っていないもの
`gameReducer.ts`、`GameScreen.tsx`、`PizzaStage.tsx`、`App.tsx`、`App.css`、`ingredients.ts`、Production 配線、共有 Preview、`fryPot/fryTap/fryDrag/fryPreview/fryExperienceGate`。

## 4. 検証
- 検出力: `App.css` に `--fry-` を追記 → architecture test が失敗、`FRY_EXPERIENCE_PRODUCTION=true` に変更 → 失敗（いずれも元に戻して確認）。
- 対象 Vitest（fry / fryIngredients / fryPreview / midBake / drizzle）: 15 files・190 tests pass。`tsc -b` clean、`oxlint` は既存警告のみ。
- 全 Vitest（ローカル）: 663 files passed | 3 skipped、12283 tests passed | 20 skipped | 2 todo、失敗 0。
- PR の CI（HEAD `6d9499a`）: required 11/11 success（classify、build、layout-chromium、Layout Contract Gate、WebKit Gate、webkit-390x844 / 360x800 の各 shard 1〜3）。旧 HEAD `02a885f` の run が `cancelled` になったのは、2 回目の push による取り消しで、テスト失敗ではない。
- merge 後（main `03f32e1`）: Deploy to GitHub Pages（run 43326548587）success、E2E WebKit（run 43326548601）success。Owner はこれを merge 後 Gate の最終実績とした（2026-11-13）。

### Codex レビューの扱い
- **採用した根拠**: HEAD `6d9499a` への有効な receipt「Didn't find any major issues」（2026-11-12 18:05 UTC、コメント 6831804531）、サマリーは `status: completed` / `has_unresolved_findings: false`。未解決レビュースレッド 0 件。
- **自動レビューの失敗**: Draft 解除（23:10:08 UTC）で Codex が同じ HEAD に対して自動実行され、23:10:10 に Failed。理由は Codex の利用上限（「You have reached your Codex usage limits for code reviews」）で、レビュー指摘ではない。サマリーの `has_unresolved_findings: true` は失敗時の表示。この通知は merge（23:10:20）の約 10 秒前で、merge 前には確認できていなかった。HEAD は変わらず、新しい指摘もないため、18:05 の同一 HEAD の有効 receipt を採用した。Owner は 2026-11-13 に merge 後 Gate を GREEN と判定し、この扱い（利用上限による失敗であること、18:05 の同一 HEAD の有効 receipt を採用したこと）を記録するよう指示した。

## 5. HV
UI / ゲームプレイ / 見た目の変更なし（未配線のロジックとテストのみ）のため、HV 動画・スクリーンショットは対象外（`TETO_HUMAN-VERIFICATION-POLICY.md` の適用範囲外）。実機 iPhone の確認は主張しない。

## 6. 未完了作業と Owner 判断（実装なし・依存関係の整理のみ）

Issue #749 は F2 などが未完了のため open のまま。以下は未承認・未着手。詳細な選択肢と推奨は #749 コメント 6831885202。

| 作業 | 依存（先に必要なもの） | 必要な Owner 判断 |
|---|---|---|
| Lab 用 `LATER_SLICES` 追加（`fry.architecture.test.ts`） | Lab の実装（`claude/fry-lab-749` は未 push）。#839 は merge 済みで、新規検査は `!LATER_SLICES.has(f)` 形式のため `has` 形式と互換 | 追加の形式（接頭辞か、steam と同じファイル名列挙か。推奨は列挙）、F1 claim 保持者（連絡不可）の了承に代わる Owner の記録 |
| eggplant 専用絵（G2、`ingredients.ts` / `IngredientGlyph.tsx` / CSS） | #748 の `ingredients.ts` claim の失効または解除、#738（`PizzaStage.tsx`）の merge、bake Audit との変数・属性名の統一 | G2 の時期、`friedLook` の `--fry-bright/sat/sepia` を Style Lock §12.1（ナスは部位色が主・二重 filter 防止）に合わせる方法、実機 HV |
| FRY F2（reducer `FRY_INGREDIENT`、HOT） | 最新 main と HOT claim の再監査と専用 claim。#738・#764・#766 との順序（F3 は #738 後） | F2 を #738 より先に進めるか（推奨は条件付き先行）、F3 の前提 |

Production ON・共有 Preview 更新・merge は引き続き Owner 承認が必要。
