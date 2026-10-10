# Shop: 購入・補充ボタン 44px + カテゴリタブ sticky（Issue #455）— Result

Base: main `e0397ae`。出典: 図鑑・食材ショップ Fresh Audit（read-only）の P2-1 / P2-2。Owner 方針により最小実装のみ。

## 変更
- **P2-1**: `.shop-item__buy-button` / `.shop-item__restock-button` を `min-height: 44px`（36px → 44px、CSS のみ）。実測 77×44px（390×844 / 360×800、有効・無効とも）。
- **P2-2**: `ShopOverlay` のタブ・空メッセージ・リストを `div.shop-overlay__shelf` で包み、`.shop-overlay__shelf > .shelf-tabs` だけを `position: sticky; top: 0`（Shop 限定のセレクタ）。タブはスクロール中も本体の上端に固定され、LOCKED セクションの手前で解放される（タブは LOCKED に作用しないため）。固定時の高さは1段 56px / 2段（具材の分類あり）約 105px。
- `ShelfTabs`、Inventory、Dex、LOCKED 表示、購入・補充ロジック、資金不足表示、save / schema は変更なし。表示される情報量は不変（Anti-Oracle Contract 2.1 に影響なし）。
- 対象外（Owner 方針）: 検索、並び順、Dex 章ジャンプ、LOCKED 表示変更。

## テスト
- 新規 `e2e/shop-buttons-sticky-tabs-455.spec.ts`（Chromium 390×844 / 360×800、各5件）: ボタン高さ・幅・viewport 内・重なりなし / 購入・補充・資金不足表示 / スクロール中のタブ固定と絞り込み（すべて→具材→肉系→すべて）/ LOCKED 手前での解放 / Inventory のタブが `static` のまま。変更を外すと P2-1・P2-2 の3件が fail（対照確認済み）。
- 既存 e2e（390×844 / 360×800）: `shop-locked-422`、`ingredient-shelf-shop`、`ingredient-shelf-inventory`、`inventory-modal-stable-bounds`、`dex-silhouette-422`、`batch6-pr3-hv` + 新規 = 50 passed。`layout-contract` LC-5（Shop 最終行、7 profile）pass。
- Vitest（Shop / Inventory / ShelfTabs / ShelfChip / DexOverlay / App.test / App.inventoryOverlay / App.materialEntitlement）18 files / 324 tests pass。`tsc -b` クリーン。`oxlint` は既存 warning のみ（本変更由来なし）。
- Vitest 全体と WebKit は PR の CI に委ねる（ローカル未実行）。

## Human Verification（`TETO_HUMAN-VERIFICATION-POLICY.md`）
- スクリーンショット: `docs/reports/screenshots/shop-buttons-sticky-tabs-455/{before,after}/`（390 / 360。01 先頭、02 スクロール中、03 具材+family 行で固定）。before は同じセーブを main で撮影。
- 動画: 390×844 MP4/H.264 約47秒。Shop を開く → スクロール → タブ固定のまま 具材/肉系/すべて → LOCKED で解放 → 仕入れ → 資金不足行 → 補充行 → Dex → 材料（Inventory）。Owner へ直接提出（repo に含めない）。Playwright の自動操作で、各状態の保持は 1.5〜2.5 秒。
- Owner HV: **未実施**（承認前の merge は不可）。

## Owner 判断として残るもの
- Shop 下部で購入すると、確認メッセージ（リスト先頭）が画面外になり、行が NEW → OWNED へ移動する。今回は対象外。
