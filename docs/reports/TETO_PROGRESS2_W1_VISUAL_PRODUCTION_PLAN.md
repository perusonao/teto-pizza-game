# Progression 2.0 W1 — Ingredient Visual Production Implementation: Fresh Audit + Plan（Phase B）

Status: **監査と計画のみ**。production の `src/**` はまだ変更していない。前提になる Phase A は `3fc02a0`（Human Visual Verification を 7/7 HUMAN_PASS として同期し、Owner Decision を確定した）で、clean な worktree で検証済み。

## 結論（最初に）

- **P1（visual の抽象化と、専用 visual 3 種の移植）: READY**
  - 追加する ingredient row はない。production の既存 22 ingredient（master catalog は 62 件）の見た目を 1 つも変えずに、`ingredient.emoji` を直接描いている 8 箇所を 1 つの component に集約する。
  - Human PASS を受けた 3 つの SVG（fresh-tomato B / capers / clam B）を、正式な production code として実装する。
- **P2（7 ingredient を production に登録する）: NOT READY**
  - visual の承認は済んだ。しかし #221 の change map（slice B）は ingredient record の前提として **Progression 2.0 の Owner Decision（REC-04: Pitz 価格、unlock 料金、star gate）** を挙げており、これがまだ決まっていない。
  - さらに `starterGrantOnly` の ingredient は、W1 の recipe（slice C: REC-01〜04 と RT-01 がまだ未解決）が入るまではプレイヤーが一度も所持できない。そのため production で Human 確認をする経路がない。
- まとめると、**production implementation は P1 について READY、P2 以降は NOT READY**。

## 0. 監査の基準

| 対象 | 値 |
|---|---|
| main | `1e53baa`（#223 は CI のみの変更。pin しているファイルは `dff233c` と同一） |
| #220 / #221 | `e49dab9` / `070afc0`（どちらも変更していない） |
| Human evidence | `docs/reports/data/TETO_PROGRESS2_W1_HUMAN_VISUAL_VERIFICATION.json`（7/7 HUMAN_PASS） |
| Owner Decision | OD-CLAM-GLYPH = DEDICATED_CLAM_B、OD-TOMATO-REPRESENTATION = DEDICATED_FRESH_TOMATO_B、OD-CAPERS-VISUAL = DEDICATED_CAPER_CLUSTER |
| Preview の実装 | `visual-gate/w1/`（preview 専用。source は `fe80e3c`） |

## 1. production で emoji を描いている全箇所（再監査）

`ingredient.emoji` を読んで描画している箇所は、Visual Gate の時点から変わらず **8 箇所**。

| # | file:line | 文脈 | 見た目の大きさ（CSS） |
|---|---|---|---|
| 1 | `src/components/IngredientPieceVisual.tsx:41` | pizza 上の piece（PizzaStage の raw / baked / RESULT）、reference の 3 view（ReferenceThumbnail、ReferencePreview、PlayerReferencePreview。いずれも `renderPizzaVisualPieces` 経由） | `.ingredient-piece-visual__emoji` 28px × `--piece-scale`、bake 中の `filter` は PizzaStage の `toppingPieceStyle` |
| 2 | `src/components/IngredientTray.tsx:455` | tray chip（FREE / Recipe / Lunch Rush 共通） | `.ingredient-chip__emoji` 26px |
| 3 | `src/components/IngredientTray.tsx:538` | 物理ドラッグのプレビュー | `.piece-drag-preview__emoji` |
| 4 | `src/components/ResultPanel.tsx:222` | RESULT の「使った材料」リスト（文字列 `${emoji} ${nameJa}`） | 行の中に入る文字サイズ |
| 5 | `src/components/PizzaThumbnail.tsx:63` | Pizza Select のカードの thumbnail（cheese 以外は IngredientPieceVisual を**経由しない**） | `.pizza-thumbnail__piece-emoji` 28 × `--thumb-piece-scale` × 1.7 |
| 6 | `src/components/InventoryOverlay.tsx:90` | 材料（在庫）画面 | `.inventory-card__emoji` |
| 7 | `src/components/ShopOverlay.tsx:245` | Shop | `.shop-item__emoji` |
| 8 | `src/components/DexOverlay.tsx:74` | Dex カードの材料 chip（`{emoji} {nameJa}`） | `.dex-card__ingredient` 11px |

その他の文脈:

- **Lunch Rush** は GameScreen / IngredientTray / PizzaStage / ResultPanel を共通で使う。Mission の画面（HUD、Serve、Result overlay）は ingredient の emoji を描かない。
- **Free Cooking** は同じ tray と stage を使う。
- **hints**（`src/data/hints.ts`）は category と nameJa だけを使う。
- **reference caption**（`buildPieceCountLabels`）は nameJa の文字列だけを使う。
- **discovery**（`matcher.ts` / `signature.ts`）は ingredient **id** の集合だけを使い、visual は読まない。
- **save**（`persistence.ts`）は id と在庫数だけを保存し、`KNOWN_INGREDIENT_IDS` で読み込み時に照合する。visual は保存しない。

emoji の文字列そのものを assert している test:

- `src/components/IngredientPieceVisual.test.tsx`: basil の textContent が emoji と一致すること。
- `src/components/ReferenceTruth.test.tsx:139`: reference の piece の textContent が `ingredient.emoji` と一致すること。

## 2. Preview の transform から production に移すもの

| Preview（`visual-gate/w1/W1Glyph.tsx`） | production への移し方 |
|---|---|
| `TomatoSliceFinal`（Human PASS した **B**） | 専用 visual `tomato-slice` として移す（名前から "final" を外す） |
| `CaperCluster` | 専用 visual `caper-cluster` |
| `AsariValve`（clam **B**） | 専用 visual `clam-valve` |
| `.w1-glyph` の 1em box と、tomato B だけ 1.15em にする size parity（負の margin） | App.css の `.ingredient-glyph--dedicated` と、visual ごとの size rule |
| 「専用 visual が無い ingredient は、元の emoji 文字をそのまま返す」という契約 | 新しい component の既定の挙動（既存 22 ingredient の見た目が 1 つも変わらないことを保証する） |
| 8 箇所の差し替え地点（transform の置換表） | 8 箇所のコードを**直接**書き換える |

## 3. 移してはいけない Preview 専用の部分

- **Vite の `transform` による source の書き換え**、`REWRITES` の表、`buildEnd` の検査。production では明示的な component にする。
- `?clam=` / `?tomato=` / `?w1visual=` / `?seed=all` の URL 切り替え、`W1VisualOverride` context、`activeDedicatedVisuals`。
- **不採用の visual**: tomato の candidate A（`tomato-slice`）、🦪 A、🐚、🟢、🍅 の共有。
- `inject.ts` による runtime の `INGREDIENTS.push`、`PREVIEW_STOCK_FIELDS`（price 90 / restock 9 などの仮の値）。
- save key の書き換え（`teto-pizza-w1-visual-gate-save-v1`）、Hub / Board / Ribbon / HV 動画用の caption と cursor。
- Preview の candidate row の `emoji` 値は、そのまま production の値として扱わない（登録する時点で決める。§5 の P2 を参照）。

## 4. production の最小 architecture

**方針**: ingredient の identity（`id`）と、描き方（visual）を分ける。既定値は「emoji」。専用 visual が必要な ingredient だけが明示的に opt-in する。

```ts
// src/data/ingredients.ts（型を 1 つと、optional の field を 1 つ追加するだけ）
export type IngredientPieceVisualKey = "tomato-slice" | "caper-cluster" | "clam-valve";
export interface Ingredient {
  // ...existing fields unchanged...
  /** 専用の（emoji ではない）描き方。無い場合は `emoji` で描く。identity・discovery・save には使わない。 */
  pieceVisual?: IngredientPieceVisualKey;
}
```

```tsx
// src/components/IngredientGlyph.tsx（新規。emoji を描く唯一の入口）
export function IngredientGlyph({ ingredient }: { ingredient: Ingredient }) {
  if (!ingredient.pieceVisual) return <>{ingredient.emoji}</>;   // 既存 22 ingredient は今と同じ DOM
  return <DedicatedIngredientSvg visual={ingredient.pieceVisual} />; // 1em の SVG、aria-hidden
}
```

- 描く場所の CSS（font-size）がそのまま SVG の大きさになる（1em）。bake 中の `filter` は親の span にかかる。どちらも Preview で Human PASS を受けた条件と同じ。
- **cheese の branch**（`.pizza-cheese` の物理 piece）は変えない。
- 変えないもの: descriptor や registry の汎用化、Ingredient の visual を別ファイルの表に分けること、theme 対応。今必要なのは 3 種だけなので、過剰な設計は避ける。
- `emoji` の field は必須のまま残す。専用 visual を持つ ingredient でも、fallback や将来のテキスト用途のために残し、描画には使わない。

## 5. 変更予定のファイル（slice ごと）

**P1（READY）: visual の抽象化と専用 visual**

| file | 変更 |
|---|---|
| `src/data/ingredients.ts` | `IngredientPieceVisualKey` 型と optional の `pieceVisual` を追加。**row は 1 つも追加・変更しない** |
| `src/components/IngredientGlyph.tsx`（新規） | 上の component と、3 つの SVG（Preview の B を移植） |
| `src/components/IngredientPieceVisual.tsx` | 41 行目の `{ingredient.emoji}` を `<IngredientGlyph>` に |
| `src/components/IngredientTray.tsx` | 455 行目と 538 行目 |
| `src/components/ResultPanel.tsx` | 222 行目（文字列の結合をやめて、glyph と名前の 2 要素にする） |
| `src/components/PizzaThumbnail.tsx` | 63 行目 |
| `src/components/InventoryOverlay.tsx` / `ShopOverlay.tsx` / `DexOverlay.tsx` | 各 1 箇所 |
| `src/App.css` | `.ingredient-glyph--dedicated` の sizing（1em、tomato は 1.15em で負の margin） |
| 新規 test | `src/components/IngredientGlyph.test.tsx` |

**P2（NOT READY）: 7 ingredient の登録** — `src/data/ingredients.ts` に 7 row を追加する。うち 3 row に `pieceVisual` を付ける。`src/data/ingredients.test.ts`、economy / shop の test も対象。前提は REC-04（価格・unlock・star gate）が決まっていること。W1 recipe（slice C）と一緒に入れるかどうかは Owner が判断する。

## 6. 必要な test

- **P1 の不変条件**（`IngredientGlyph.test.tsx`）:
  - production の既存 **22 ingredient すべて**について、`IngredientGlyph` の出力の textContent と DOM が「emoji 文字だけ」であること（見た目に回帰がないことを全件で保証する）。
  - `pieceVisual` を持つ fixture の ingredient（id は `fresh-tomato` / `capers` / `clam` 相当）が、それぞれの SVG を描き、emoji の文字を描かないこと。
  - 専用 visual の key が、Human PASS した 3 種（`tomato-slice` / `caper-cluster` / `clam-valve`）と一致すること。
- 8 箇所すべてが `IngredientGlyph` を通ること:
  - 各 component の既存 test に 1 つずつ assert を足す。
  - あるいは `src/**` に `.emoji}` の直接描画が残っていないことを確かめる静的検査（grep 型の test）を置く。
- `IngredientPieceVisual.test.tsx` と `ReferenceTruth.test.tsx` は変更不要（既存 ingredient はすべて emoji 経路のまま）。
- **Identity と discovery**: `src/logic/discovery/matcher.test.ts` を変えずに PASS すること。evidence generator の `--check`（discovery probe）も PASS すること。
  - REC-08 の `portableTestCases` の移植は、recipe を入れる slice C で行う。
- **fresh-tomato ≠ cherry-tomato**: P2 のときに、id が別で alias が無いこと、cherry-tomato は 🍅 のまま `pieceVisual` を持たないこと、を data test で固定する。
- **save**: `persistence` の既存 test が変更なしで PASS すること（schema は変えない）。
- **E2E**: `e2e/` の既存 spec（viewport-1screen、free-cooking、finished-pizza-visual-2.0 など）が Chromium 390×844 / 360×800 で PASS すること。

## 7. Safari / WebKit のリスク

| リスク | 対策 |
|---|---|
| inline の SVG を `display:block` の span の中に置き、1em で大きさを決める。WebKit では emoji の文字と行の高さ（line box）の扱いが違い、縦位置がずれることがある | `display:inline-block` と `vertical-align:-0.125em` の組み合わせは Preview と同じ。WebKit の E2E で bounding box を assert する |
| bake 中の `filter`（brightness / saturate / sepia / drop-shadow）を、SVG を含む span にかける | Preview と同じ構造。Human PASS は iPhone Safari 上で確認済み。WebKit CI で screenshot をとって確認する |
| 負の margin（tomato の 1.15em）が、tray の grid で重なりや overflow を起こす | layout 用の box は 1em のまま。P4 で 360×800 の overflow を assert する |
| SVG の `id` が重複する | gradient や id を**使わない**設計（Preview と同じ）。test で `id=` が無いことを assert する |
| iOS の text-size-adjust や、アクセシビリティ設定の文字サイズ変更 | 大きさは em 基準なので追従する。実機の Human 確認の項目に入れる |

`src/**` を変えるので、**WebKit を Final Gate にする**（`.github/workflows/e2e-webkit.yml` は PR ごとに実行される）。

## 8. Save の互換性

- visual は保存しない。`pieceVisual` は静的なデータで、save schema も `CURRENT_SCHEMA_VERSION` も変えない。
- P1 は ingredient row を足さないので、`KNOWN_INGREDIENT_IDS` も変わらない。
- P2 で ingredient を追加するのは、id を足すだけ。既存の save には影響しない。古い build が新しい id を含む save を読んだときの扱いは、#206（save の forward-compat、OPEN）の範囲になる。

## 9. Rollback の方法

- P1 は **1 commit で revert できる**。既存 22 ingredient は emoji 経路のままなので、revert しても見た目は変わらない。
- 緊急時は、P2 で付けた `pieceVisual` を 3 row から外すだけで、その ingredient は emoji に戻る（データを 1 行ずつ変える rollback）。identity と save には影響しない。
- Preview（`visual-gate/w1`）は production と独立しているので、残しておいても消しても production に影響しない。

## 10. Implementation slices（改善案）

| slice | 内容 | 状態 | 完了条件 |
|---|---|---|---|
| **P1** | `IngredientGlyph` と `pieceVisual` 型、3 つの SVG、8 箇所を集約。**row の追加はしない** | **READY** | 既存 22 ingredient の DOM が同一、vitest / tsc / lint / build、Chromium E2E が PASS |
| **P1-V** | P1 の Human Preview: 既存 `deploy-from-source.yml` で production build を preview に出し、既存 ingredient に回帰がないかを見る（見た目が変わらないことの確認） | P1 の後 | 390×844 の動画、WebKit CI |
| P2 | 7 ingredient の登録（3 つに `pieceVisual`）と、その data / economy test | **NOT READY**（REC-04） | Owner が REC-04 を決める。W1 recipe（slice C）と同時に入れるかも決める |
| P3 | focused test と discovery regression（REC-08 の portable case を移す） | P2 / slice C と同時 | matcher の test と probe が PASS |
| P4 | Chromium 390×844 / 360×800 で Human Preview（7 材料が production build の中で見えること） | P2 の後 | 動画、実機 Human |
| P5 | WebKit Final Gate | P1 と P2 の各 PR で | `e2e-webkit.yml` が green |

P1 を先に独立させる理由:

- 描画経路の集約は、W1 の content decision（REC-01〜04、RT-01）と無関係に安全に入れられる。
- 既存の見た目が変わらないことを test で証明できる。
- P2 を入れるときの差分が、データの row の追加だけになる。

## 11. 触らないもの

- ingredient の ID、recipe の scoring、inventory の数量ロジック、Completion Gate / quantity scoring（#215 / #222）。
- discovery matcher の identity（visual を一切読まない）、save schema、OD-S1 = A、RT-01、REC-01〜04、W1 の recipe set と recipe 数。
- #220 / #221 / #222。

## READY / NOT READY

| 項目 | 判定 | 根拠 |
|---|---|---|
| Phase A（evidence / decision） | **GREEN** | `3fc02a0` を clean な worktree で検証した。`--check`、40/40、catalog、invariants、canonicalizer、#221 の checker がすべて PASS |
| **P1**（visual の抽象化と専用 visual 3 種） | **READY** | Human PASS と Owner Decision が確定した。変更範囲が 8 箇所と CSS と型 1 つに閉じる。既存の見た目を変えないことを test で保証できる。save も identity も影響しない |
| **P2**（7 ingredient の登録） | **NOT READY** | REC-04（Pitz 価格、unlock、star gate）が未解決。#221 の change map で slice B の前提になっている。W1 recipe が無いと、プレイヤーがその ingredient に到達できない |
| W1 recipe（slice C） | **NOT READY** | REC-01〜04 と RT-01 が未解決。READY 0 / REVIEW 10 / BLOCKED 0 |

→ **production implementation: READY（P1 のみ）/ NOT READY（P2 以降）**
