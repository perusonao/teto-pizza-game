# M7 POSTBAKE_SAUCE の影響範囲／D-ING-1 R1 の差分見積もり／B22・#800・DRIZZLE との競合（#780、docs-only）

2026-11-09 / 基準 `origin/main` = `71141335`。コード・テスト・golden・HOT ファイルは変更していない。凡例: 【実測】取得した値、【推論】解釈・見積もり、【未確認】。

## 1. 競合の確認【実測】
| 相手 | 状態 | 触るファイル | M7／R1 との関係 |
|---|---|---|---|
| **B22**（#801、#780 claim 6738640959） | Draft・docs のみ。HOT 編集は**仕様承認後、#800 の merge 後**に予約 | `ingredients.ts`・`recipes.ts`・`lateCatalog.ts`・`discoveryLadder.ts`（data）・`discoveryCatalog.ts`・`IngredientGlyph.tsx`・golden ほか | **R1 は `discoveryLadder.ts` を 2 つとも触るため B22 の HOT 予約と重なる**。M7 の buffalo-sauce は B22 の食材候補でもある（#801 が調査中） |
| **#800**（tortilla-chips の SVG 配線） | Draft、claim 6738179452 | `lateCatalog.ts`（`pieceVisual` のみ）・`ingredients.ts`・`IngredientGlyph.tsx` | M7 の食材登録（`ingredients.ts`・`lateCatalog.ts`）と同じファイル |
| **DRIZZLE D1**（#776）／**Lab**（#746） | どちらも Open（Draft でない）。main に **`src/logic/drizzle/` は無い**。claim は 11/06 に release 済み、#579 の D2〜D5 は HOLD | `src/logic/drizzle/**`・`drizzleExperienceGate.ts`、`src/preview/DrizzleLab.tsx`・`src/main.tsx` | M7 は液体の型・軌跡・ジェスチャーを**実装しない**（設計書 §2）。#776 が main に入るまで M7 の実装は始められない |
| #794〜#796（U1〜U3 工程） | Issue のみ・claim なし | 生地・天板／PREP・FRY／ENCLOSE 等 | detroit-style は M1・M2（U1）待ち。buffalo／hot-honey は無関係 |
| T-FX（staged、〜11/21） | 有効 | `src/data/staged/**` | B22 merge 後の基準値更新は T-FX |

## 2. M7 POSTBAKE_SAUCE の影響範囲【実測＋推論】
**対象レシピ（RB-18）:** buffalo-chicken-pizzadb（buffalo-sauce、新食材）・hot-honey-pepperoni（honey、出荷済み）・detroit-style-pizza（tomato-sauce 後がけ、M1・M2 待ち）。
**現行の仕組み【実測】:** 後乗せ要件は `applicationPhase: "POST_BAKE"`（`lateCatalog.ts` の型、`validateLateCatalog` が検証）。FINISH で扱えるのは**トッピングのみ**（ソース・液体は扱えない＝M7 が必要な理由）。
| 区分 | 変更内容 | 前提 | HOT |
|---|---|---|---|
| 検証 | `validateLateCatalog` に「液体の許可リストの食材は POST_BAKE 要件として許可」を 1 点追加【推論】 | #776 の許可リスト（`POST_BAKE_LIQUID_INGREDIENT_IDS`）が main に必要 | `lateCatalog.ts` |
| 食材 | buffalo-sauce を**液体**として登録（family なし、T4） | B22 の食材登録と同じ手順 | `ingredients.ts`・`lateCatalog.ts` |
| 許可リスト | `olive-oil` に buffalo-sauce・honey を追加（Owner 判断 M7-b） | #776 | `src/logic/drizzle/postBakeLiquid.ts`（#776） |
| UI／採点／識別／在庫 | DRIZZLE D2〜D5（HOLD）の範囲。**M7 では実装しない** | D2〜D5 の Owner ゲート | — |
| Research／Hint 5.0／DH4 | 新ソースの family 分布が動く可能性（B13 の前例）【未確認、staged what-if で実測が必要】 | — | golden |
**結論:** M7 の実装は **#776 の merge と D2〜D5 の Owner ゲート後**。それまでにできるのは docs（本書・影響調査）のみ。

## 3. D-ING-1 R1 の差分見積もり【推論（実測の行数に基づく）】
R1 = 設計書 §3.4 の「`riderRegistry.ts`（空）＋型＋検証緩和＋免除テスト、挙動不変」。
| ファイル | 現行 | 見積もり | HOT |
|---|---|---|---|
| `src/data/riderRegistry.ts`（新規、空配列＋型） | — | +15 行 | なし |
| `src/data/discoveryLadder.ts`（型 `MaterialProgressionStep` は `ingredientIds` のみ） | 240 行 | 型は**変えず**登録簿で識別すれば 0〜+5 行（任意フィールド案なら +10） | **HOT** |
| `src/logic/discoveryLadder.ts`（`validateLadderProgression` の `UNUSED_MATERIAL` は 309 行目付近） | 324 行 | 免除リスト引数＋判定で +25〜40 行、`appendLadderSteps`／`validateAppendOnlyExtension` は変更なし（フィールド追加なしの場合） | **HOT** |
| 新規テスト `riderRegistry.test.ts`（宿主が未出荷／出荷済みなら自動で外れる／1 step の上限 4／key 材料より前） | — | +80〜120 行 | なし |
| 既存テストの改定 | `ingredientCollectionCount.test.ts`（入手可能 = 本番レシピが使う食材）ほか | 登録簿が**空**の間は変更不要（空なら現行と同一）【推論】 | なし |
**合計:** 新規 2 ファイル＋既存 HOT 2 ファイルの小変更、約 +130〜180 行。**挙動不変**（登録簿が空）。dist 比較で本番不変を確認する。
**競合:** `discoveryLadder.ts`（data／logic）は B22 の HOT 予約と同じ。B22 が新 step を追加する PR と**同じ関数を読む**ため、直列にするのが安全（B22 の merge 後に R1）。R1 は Owner 承認（D-ING-1a）が先。

## 4. 並行できる作業と順序
1. **今すぐ・並行可（docs のみ）:** 本書、M7 の許可リスト拡張案（M7-b）の調査、R1 の差分の詳細化。
2. **直列:** #800 merge → B22 の仕様承認 → B22 の HOT 編集 → D-ING-1 R1（承認後）。
3. **待ち:** M7 実装 ← #776 merge ← DRIZZLE D2〜D5 の Owner ゲート。
4. **未承認の HOT 編集は行わない。** 本 PR は docs のみ。

## 5. Owner 判断（推奨つき）
| ID | 論点 | 推奨 |
|---|---|---|
| X-1 | #776（DRIZZLE D1、新規ファイルのみ・未配線）を先に merge するか（M7 の前提） | 判断が必要（#776 の CI・Codex の確認は別途） |
| X-2 | D-ING-1 R1 を B22 の HOT 編集の**後**にするか | 後（同じファイル、直列） |
| X-3 | M7-b: 許可リスト拡張を buffalo-sauce と honey から | 推奨どおり |
