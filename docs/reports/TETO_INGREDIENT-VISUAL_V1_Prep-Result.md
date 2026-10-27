# Ingredient Visual V1 — 実装準備 Result Report（ピクルス / ヴルステル / パプリカパウダー）

Status: **準備のみ（docs-only）。V1 の実装は開始していない。** `src/**`・CSS・テスト・golden・データ・Preview は変更していない。merge・Production 変更・Monitor 作成・GitHub への書き込み（claim・コメント）なし。
親資料: `docs/reports/TETO_INGREDIENT-VISUAL_B10-Fresh-Audit.md`（Audit）。
確認基準: `origin/main` = `47268e3`（#684）、#679 head = `933e518`（2026-10-27 時点）。

## 1. 結論（V1 実装可否）

| 項目 | 判定 |
|---|---|
| **V1 を今すぐ実装してよいか** | **いいえ（方針 8 により保留）。** #679 が open・未マージ（`mergeable_state: clean` は #679 自身の base 基準）。実装は #679 merge 後、最新 main から |
| 技術的に今でも実装できるか | **はい。** 挿入位置を §3.2 のとおりにすれば #679 と V1 起因の衝突は 0（ドライ検証済み）。ただし Owner が方針 8 を解除した場合に限る |
| Duplicate Gate | **GREEN**（§2） |
| ブロッカー | ① #679 未 merge ② Owner による SVG 3 点の承認が未記録（Audit §9 の質問 1）③ #679 は**すでに現 main と 9 ファイルで衝突**しており、#679 担当の rebase が先（§3.1） |

## 2. Duplicate Gate

| 確認 | 結果 |
|---|---|
| 最新 main | `47268e3`（#684、テストのみ）。Audit 時点 `c6a90e2` から 2 ファイル（DH4 の pin テスト + 設計 doc）の追加のみで、描画関連の変更なし |
| 同一目的の PR | **なし。** open PR 20 件のタイトル・本文を確認し、ピクルス / ヴルステル / パプリカパウダーの描画を扱うものはない（`pickle` 等が現れるのは merge 済みの #686 のみ） |
| 同一目的の Issue | **なし。** open の関連 Issue は #438（Pilot A HV）・#623（Pilot D: salmon / cream-cheese、#621 後に着手）のみで、対象食材が異なる |
| 前例（merge 済み） | #663 arugula、#667 shrimp-curl、#503 Pilot A、#580 Batch 8b。**#667 が V1 の雛形**（§4） |
| claim | #611 の有効 claim は #679（`01E7…`、担当一本化、期限 11/03）。#679 の claim files に `IngredientGlyph.tsx`・`App.css`・`ingredients.ts` が入っており、**V1 と同一ファイル**。V1 の claim はまだ投稿していない（§8 に下書き） |
| 制限 | 検索は上位 10 件のみ取得（PR 14 件・Issue 76 件中）。タイトル・本文に対象語がある行は全件確認したが、取得外の件は未確認 |

## 3. 競合状況

### 3.1 #679 は現 main と既に衝突している（V1 とは無関係）

#679 の base は `9761d03`（#673）。その後 #686 が main に入ったため、`git merge-tree` で #679 head と現 main を合わせると **9 ファイルで衝突**する:
`TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`、`catalogLedger.test.ts`、`recipeSauceProfiles.ts`、`referencePizza.test.ts`、`catalogShelf.test.ts`、`largeCatalogFixtures.test.ts`、`hint5.alphaFamilyOnly.json`、`hint5Ladder.baseCompat.test.ts`、`materialShop.test.ts`。
→ #679 の担当（`01E7…`、他セッションは push 禁止）が main を取り込んで解消し、late step・floors を再導出する必要がある。**merge 時期は未定**（Owner の実機 HV 待ち）。本セッションは #679 へ触れない。

### 3.2 V1 と #679 の衝突（ドライ検証）

使い捨ての worktree（commit・push なし、検証後に削除）で、V1 と同じ位置に**ダミー行**だけを挿入し、#679 head と `git merge-tree` した。製品コードは書いていない。

| 変更箇所 | #679 が触る行 | 末尾追記（Audit の素朴案） | **推奨位置** |
|---|---|---|---|
| `ingredients.ts` の `DedicatedIngredientVisual` union | 末尾 `"pomegranate-aril"` の行 | **衝突** | `"hot-dog-slices"` の直後（中間） → 衝突なし |
| `IngredientGlyph.tsx` の `VISUAL_VIEWBOX` / JSX 連鎖 | 末尾 | 衝突 | `hot-dog-slices` の直後 → 衝突なし |
| `IngredientGlyph.tsx` の新コンポーネント | **ファイル末尾に `CilantroLeaf` を追記** | 衝突（末尾同士） | `HotDogSlices` と shiso 節の間 → 衝突なし |
| `App.css` の 1.2em 補正セレクタ群（823–829 行） | 末尾に `cilantro-leaf` を追記、直前のコメント 1 行も変更 | **衝突** | 既存群に足さず、独立ルールを別位置に置く → 衝突なし |

結果: **推奨位置なら #679 起因の追加衝突は 0**。末尾追記だと `App.css`・`ingredients.ts` で衝突する（実測）。
`IngredientGlyph.test.tsx` の `ALL_DEDICATED` 行（85 行）は #679 が隣の 84 行（`LATE_DEDICATED`）を変更するため、V1 が `ALL_DEDICATED` のスプレッド連鎖を変更すると隣接行衝突の可能性が高い。**#679 が先に merge される前提では rebase で自明に解決**できる（V1 を後にするのが安全な理由の 1 つ）。

### 3.3 PR-2 / その他 open PR

| 対象 | 重なり | 対応 |
|---|---|---|
| PR-2（Batch 10 PR-2、late 4 レシピ） | 設計書の claim 予定ファイルに `IngredientGlyph.tsx`・`App.css` が入る。ただし牛肉（`beef-slices`）は V1 の対象外（PR-2 側）なので、**同名 visual の重複は発生しない**。PR-2 は late catalog の step・floors・golden・DH4 で #679 に直列依存 | V1 はそれらに触れない。#679 → V1 → PR-2 の順で、PR-2 が V1 を取り込む。PR-2 設計書の「`beef` は新規」は #686 以前の記述で古い（Audit §7.2。PR-2 担当へ要連絡） |
| #540（Draft/HOLD） | データ系 4 ファイル | V1 は触れない |
| #468（open、`App.css`）・#478（Draft） | `App.css` を触る | V1 の CSS は独立ルール 1 か所のみ。後から merge する側が追従 |
| #623（Pilot D、#621 後に着手） | `IngredientGlyph.tsx`・`App.css` | 将来の競合。V1 が先なら Pilot D が取り込む |

## 4. V1 の変更仕様（確定案。実装はしていない）

雛形は #667（shrimp-curl）: union・viewBox・JSX 連鎖・コンポーネント・CSS 補正・テスト・`lateCatalog.offSurface.json` digest 再生成・Style Lock 追記。

| ファイル | 変更 |
|---|---|
| `src/data/ingredients.ts` | union に `pickle-slices` / `wurstel-links` / `paprika-powder-pile`（`hot-dog-slices` の直後）。`pickles` / `wurstel` / `paprika-powder` の 3 エントリに `pieceVisual` を**1 行ずつ追加するのみ**。`id`・`emoji`（テキストフォールバックのまま）・`color`・`placement`・`category`・`unlockCondition` は不変 |
| `src/components/IngredientGlyph.tsx` | 上記 3 visual の viewBox（64×64）・JSX・コンポーネント（Audit の候補 SVG をそのまま移植）。波刃スライスは `radialPath` 系ヘルパ流用または静的 path。`id` / gradient / `<defs>` なし |
| `src/App.css` | サイズ補正は**実測してから**。必要なら visual 個別クラスを独立ルールで（既存セレクタ群に足さない） |
| `src/components/IngredientGlyph.test.tsx` | `DEDICATED`・`ALL_DEDICATED` に 3 件、新 describe（SVG 描画・emoji 非表示・`id=`/`url(#` なし・identity 不変）。`EMOJI_ROWS` は自動で 3 件減る |
| `src/data/__golden__/lateCatalog.offSurface.json` | `ingredients` の sha256 を**意図して 1 回再生成**（arugula / shrimp と同じ理由: `pieceVisual` 追加のみ。id・順序・配置・解禁は不変）。`lateCatalog.offGolden.test.ts` のコメントに追記 |
| `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md` | §1e 相当を追記（3 種の採用・Lock 外であることの記録、#667 の §1d の型） |
| `docs/design/references/ingredient-icons-2.0/` | 3 SVG を追加（Owner 採用後） |
| `docs/reports/…` + `docs/reports/screenshots/ingredient-visual-v1/` | Result・before/after（390 / 360 × 3 状態） |

**変更しないもの（ユーザー指示 5 の確認）:** 食材 ID（`pickles` / `wurstel` / `paprika-powder`）、採点、在庫（`inventory.ts`・finite 判定）、DH4（`discoveryCatalog` / `hint5` golden / DH4 監査 JSON / 件数 pin）、レシピ定義（`recipes.ts` / `referencePizza.ts` / `recipeSauceProfiles.ts` / `lateCatalog.ts`）、ladder・floors、`toppingSizeClass`（`xs` / `s` / `m` のまま）、セーブ形式。
根拠: 描画は `pieceVisual` のみを読み id では分岐しない（`IngredientGlyph.tsx` の規約）。これは設計上の見込みで、**テストでの実測は実装時**。

grep 確認: 3 食材の emoji（🍈 🌯 🟧）を assert する既存の src / e2e / tools は `ingredients.ts` 以外にない（#667 のような e2e の書き換えは不要の見込み）。

### 4.1 候補 SVG の Style Lock v2 §2 適合チェック（機械確認）

| 候補 | `id=` | `url(#` | `<defs` | gradient | viewBox / 影楕円 |
|---|---|---|---|---|---|
| `pickle-slices.svg` | 0 | 0 | 0 | 0 | 64×64 / あり |
| `wurstel-links.svg` | 0 | 0 | 0 | 0 | 同上 |
| `paprika-powder-pile.svg` | 0 | 0 | 0 | 0 | 同上 |

線幅は 2.4 基調、2 トーン、`aria-hidden` は `IngredientGlyph` 側が付与。**Style Lock の語彙には無い新規 3 種**なので、Owner の見た目承認が前提（Style Lock §1c）。

## 5. 実画面検証の計画（未実施）

方針 8 により、3 状態 × 2 viewport の実画面検証は**実装後**にしか行えないため未実施（Audit の近似評価のまま）。実施時の計画:

- 環境: `node_modules` が無い（`npm ci` が必要）。Playwright / Chromium は導入済み。
- 経路: 既存 `e2e/expansion-batch10-pr1.spec.ts` の `HV_SCREENSHOT_DIR` 機構を再利用。cuban-pizza（ピクルス）は既存ケースで撮れる。**ヴルステル・パプリカパウダーは currywurst の経路が既存 e2e に無い**（curry-pizza-japan と cuban のみ）。使い捨ての撮影スクリプト（commit しない）または State Editor（`?dev=state`、「All Ingredients」）で撮る。
- 状態: トレイ（チップ）/ 調理中（ピザ上、xs≈20px・s≈24px・m≈28px）/ 焼成後（FINISH 前後。ソースは変わらないので topping の roast のみ）。390×844 と 360×800。
- 画像: **比較 1 案（before/after の 2 段）+ 修正 1 回まで**。`docs/reports/screenshots/ingredient-visual-v1/` に commit。動画（MP4、390×844）は Owner へ直接提出し commit しない。
- 判定基準: ①果物に見えない（ピクルス）②別料理に見えない（ヴルステル）③生地・焼成後の橙の上で輪郭が残る（パプリカパウダー、特に 360×800 の xs）④hot-dog / sausage / ズッキーニ 🥒 と取り違えない。
- テスト: 必要分のみ。`vitest run` を `IngredientGlyph.test.tsx`・`IngredientPieceVisual.test.tsx`・`ingredients.test.ts`・`lateCatalog.offGolden.test.ts`・`expansionBatch10.pr1.test.ts`・`ReferenceTruth.test.tsx` に限定、`tsc -b`、`oxlint`。e2e は上記 spec を 390 / 360 の 2 プロジェクトで。**全件 Vitest / 全件 e2e は CI に任せ、ローカルでは重複実行しない**（#667 のローカル全件実行はやらない）。

## 6. 推奨 PR 構成

| PR | 内容 | 前提 | 工数 |
|---|---|---|---|
| **V1（本件）** | 3 トッピング SVG + Style Lock 追記 + offSurface digest 再生成 + テスト + 検証画像 | #679 merge 済み（または Owner が順序を指示）、SVG の Owner 承認、claim 投稿 | 1〜1.5 日 |
| 分割しない | 3 種は同系統（emoji → 専用 SVG、チーズ・ソース経路に触れない）で、1 本の HV で並べて確認できるため 1 PR | — | — |
| V2 | 牛肉 → **PR-2 側で扱う**（本件では触れない） | — | — |
| V3 / V4 | チーズ 2 種、ソース — Audit の分割どおり後続。**マスタード色変更は保留** | — | — |

順序: **#679（rebase 含む）→ V1 → PR-2**。#679 の merge が遅れる場合の選択肢（Owner 判断）: (a) 待つ（推奨）、(b) §3.2 の推奨位置で V1 を先に出す。(b) は V1 起因の衝突 0 だが、#679 と同じ 3 ファイルを同時に触るため、#679 の担当に事前連絡と claim の重なり表明が要る。

## 7. リスク

- #679 の merge 時期が不定（Owner の実機 HV 待ち）。V1 が長く待たされる。
- 見た目の承認が未記録。承認前に `ingredients.ts` へ `pieceVisual` を入れない。
- 20px の パプリカパウダー（暗い輪郭の小山）が焼成後に暗い茶になる点は Audit で未確認の残リスク。実画面で足りなければ `s` への変更や `bakeRoastResistant` を Owner 判断で検討（V1 の範囲外にする）。
- `lateCatalog.offSurface.json` の再生成は意図的だが、#679 や PR-2 のレビューで DH4 / golden の変更に見える。PR 本文で「`pieceVisual` のみ・id / 順序 / 解禁は不変」を明記する。

## 8. claim 下書き（未投稿。Owner 承認後に #611 へ）

```
teto-claim:v1
issue: 611
pr: null
branch: claude/<v1-branch>
files:
  - src/data/ingredients.ts
  - src/components/IngredientGlyph.tsx
  - src/components/IngredientGlyph.test.tsx
  - src/App.css
  - src/data/__golden__/lateCatalog.offSurface.json
  - src/data/lateCatalog.offGolden.test.ts
  - docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md
  - docs/design/references/ingredient-icons-2.0/
overlaps:
  - "#679: IngredientGlyph.tsx / App.css / ingredients.ts（V1 は union・viewBox・JSX の中間位置と独立 CSS ルールで追記し、#679 の末尾追記と隣接しない）"
  - "PR-2: 同ファイル。牛肉 SVG は PR-2 側。V1 が先なら PR-2 が取り込む"
```

## 9. Owner に確認したいこと

1. ピクルス / ヴルステル / パプリカパウダーの SVG 3 点の採用可否（Audit の候補をそのまま実装してよいか）。
2. 順序: #679 merge を待つ（推奨）か、§3.2 の位置で V1 を先に出してよいか。
3. #679 担当（`01E7…`）への連絡: #679 が現 main と 9 ファイルで衝突していること、V1 / PR-2 が同ファイルを触ること（本セッションは GitHub へ書き込んでいない）。
4. PR-2 担当への連絡: `beef` は #686 で main に存在する（Audit §7.2）。

## 10. 実施していないこと

実装・実画面検証・テスト実行・`npm ci`・GitHub への書き込み・Preview・merge・Monitor。比較画像は新規作成なし（Audit の 1 枚 + 修正 1 回を使用済みのため、V1 の before/after は実装後に 1 案 + 修正 1 回）。
