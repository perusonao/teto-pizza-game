# Ingredient Icons 2.0 — Tray / Raw / Baked 3 層ビジュアル Design Audit

Status: **設計案（docs-only）。Owner 承認までランタイム実装なし。** 既存の SVG 化作業（Style Lock V2 のバッチ移行）は継続し、
**データ構造の大きな変更だけ保留**する。
Base: `main` `0016222`（2026-11-04）。Refs #417、Style Lock V2、#438。

## 1. 現在の描画構造（調査結果）

### 1.1 アイコンと on-pizza は、チーズ以外は同じ SVG を共有している

| 経路 | 描画コンポーネント | 非チーズ | チーズ |
|---|---|---|---|
| Tray チップ | `IngredientTray.tsx:524-534` | `IngredientGlyph`（= `pieceVisual` or 絵文字） | `pieceVisual` なし → `IngredientPieceVisual`（CSS `.pizza-cheese` 形状）／あり → `IngredientGlyph` |
| Drag preview | `IngredientTray.tsx:705` | `IngredientPieceVisual` | 同左 |
| Shop / Dex / Research / RESULT 一覧 / Inventory / Hint | `IngredientGlyph` 直接 | SVG or 絵文字 | `IngredientGlyph`（チーズも SVG or 絵文字） |
| ピザ上（PREPARE〜RESULT） | `PizzaStage.tsx:1477` `IngredientPieceVisual` | `.ingredient-piece-visual__emoji` 内に `IngredientGlyph` | `.pizza-cheese` ラッパー（CSS 形状 or その中に SVG） |
| 後乗せ（FINISH `stage:"post"`） | `PostBakePiece.tsx`（style を渡さない） | 同上 | 同上 |
| Reference / サムネイル | `renderPizzaVisualPieces` → `IngredientPieceVisual` | 同上 | 同上 |

- `.emoji` を読むのは `IngredientGlyph` の 1 箇所のみ（`IngredientGlyph.tsx:22`）。
- **モッツァレラが既に「Tray と on-pizza が別」の参照実装**。Tray は CSS 形状チップ、ピザ上は `.pizza-cheese` の物理形状、
  さらに opt-in で `CheesePoolCanvas`（`cheesePoolBake.ts` が `bakeHeat` から melt / toast / char を算出）。
  この分離は「`pieceVisual` を持たないチーズ → CSS 形状」という**既存の分岐**で成立しており、専用の分離システムではない。
- 非チーズの Tray / ピザ上の分離は**現状ない**（同じ SVG）。

### 1.2 焼成表現の既存の仕組み（再利用対象）

- `computeBakeHeat(progress, target)`（`bakeVisual.ts`）: 0 = 生、1 = 目標中心、2 = 焦げ。**連続スカラー、境界での跳びなし**。
  `meltIntensity` / `toastIntensity` / `charIntensity` も同ファイル。
- `PizzaStage.tsx:1090` `toppingPieceStyle(ingredient)`: 非チーズ具材に `toppingVisualFrame(heat, roastResistant)` の
  `filter`（brightness / saturate / sepia + drop-shadow）を当てる。**全具材共通の色変化のみ。形状変化なし。**
- `bakeProgress`（`App.tsx:1227`）は BAKE 中は live、POST_BAKE / RESULT / DISCOVERED では**凍結した `pizza.bakeResult`**。
  → 焼成後の見た目は CUT / RESULT まで自動的に引き継がれる。サムネイル / Reference / Dex / Shop は `bakeProgress` を受け取らず**生のまま**。
- 具材ごとの個別ルックの先例が 2 つある:
  - sear（`sausageSear.ts` + `Sear.css`）: `searedPieceVisual(id, amount)` が **class + CSS 変数**を返し、`Sear.css` が
    SVG の `path:nth-of-type(n)` に `fill: var(--sear-*)` を上書き（SVG 本体は無改変）。
  - prep（`beefDoneness.ts` の `preparedPieceVisual`）: 同方式（`--beef-*`）。
  - どちらも `PizzaStage` で `{ ...toppingPieceStyle(ingredient), ...look.style }` と**合成**される。
- 後乗せは `toppingPieceStyle` も `cheeseStyle` も受けない（`PostBakePiece.tsx`）→ **焼成変化の対象外は既に構造で保証済み**。

### 1.3 重要な制約

- `IngredientPieceVisual` のラッパー（`--piece-rank-scale` / `--piece-phase-scale`、size class、CUT の half クリップ）は
  ピザ上のサイズ・カット判定に使われる。**ラッパーの寸法は変えず、内側の SVG だけを変化させる**必要がある。
- `toppingPieceStyle` の `filter` が全具材に掛かる。個別ルックを足すと**二重に暗くなる**ため、個別ルック対象では基準 `filter` を弱める規則が要る。
- ホットファイル: `PizzaStage.tsx`（1817 行）、`App.css`、`ingredients.ts`、`IngredientGlyph.tsx`。

## 2. 既存機能の再利用方針（新しい描画システムは作らない）

| 要件 | 再利用するもの |
|---|---|
| Tray Visual | 既存 `pieceVisual` + `IngredientGlyph`（変更なし） |
| Raw Piece Visual | 既定は Tray と同じ SVG（既存どおり）。形が違うときだけ別 SVG（§3 の任意フィールド） |
| Baked Piece Visual | **同じ SVG を CSS 変数で変化**（sear / prep と同方式）。専用 SVG の二重管理はしない |
| 焼成進行度 | 既存 `bakeHeat`（`PizzaStage` が毎フレーム算出済み）。新しい rAF / タイマーは作らない |
| 焼成後の保持 | 既存の凍結 `bakeResult` |
| 後乗せ除外 | 既存 `PostBakePiece`（style を渡さない） |
| チーズ | `CheesePoolCanvas` / `.pizza-cheese` には**触れない**。mozzarella は参照実装のまま |

## 3. 推奨データ構造（Owner 承認後）

**`Ingredient` 型・`ingredients.ts` は原則変更しない**（HOT。Batch 18 / SVG レーンと同じファイル）。

1. **Tray Visual = `pieceVisual`（変更なし）。**
2. **Baked ルックのレジストリ（新規 1 ファイル）** `src/logic/pieceBakeLook.ts`:
   ```ts
   // キーは DedicatedIngredientVisual（VISUAL_VIEWBOX と同じ軸。食材 id では分岐しない）
   export const PIECE_BAKE_LOOK: Partial<Record<DedicatedIngredientVisual, PieceBakeLookSpec>>;
   interface PieceBakeLookSpec {
     /** SVG の部位（CSS 変数名）ごとに [raw, good, burnt] の色 */
     colors: Record<string, readonly [string, string, string]>;
     /** 縮み・反り等: heat 0 / 1 / 2 での値（scale / scaleY / rotate は SVG 内側のみ） */
     shape?: { shrink?: readonly [number, number, number]; cup?: readonly [number, number, number] };
     /** 油・つやなどのオーバーレイ不透明度 [raw, good, burnt] */
     overlay?: Record<string, readonly [number, number, number]>;
   }
   export function pieceBakeLookStyle(visual, heat): CSSProperties | null; // 純関数・CSS 変数のみを返す
   ```
3. **CSS は専用ファイル**（`src/components/PieceBake.css`。`Sear.css` / `Steam.css` と同じ流儀。`App.css` は触らない）。
   `.ingredient-piece--baked-look .ingredient-glyph--<visual> [data-bake="skin"] { fill: var(--bake-skin, <原色>) }` のように、
   **変数が無ければ原色**＝未適用時は DOM・見た目が現状と同一。
4. SVG 側の変更は **部位への `data-bake` 属性付与のみ**（`path:nth-of-type` に依存せず、sear より壊れにくい）。
5. **別 SVG が必要な場合だけ**（Owner 判断）任意フィールド `pizzaVisual?: DedicatedIngredientVisual` を `Ingredient` に追加。
   例: Tray は「1 枚の丸ごと」、ピザ上は「適度にカットした切れ」にしたいとき。Pilot 3 種では**不要**の見込み（§4）。
6. `IngredientPieceVisual` に `surface?: "tray" | "pizza"` を追加するかは Phase 2 で判断（ピザ上のみ `pizzaVisual` を読む）。

## 4. Pilot 候補の比較（最大 3 食材）

| 食材 | 現状 | 焼成変化の見え方 | 難度 | Tray SVG | 備考 |
|---|---|---|---|---|---|
| **bacon** | 🥓 絵文字 | 縮み + 脂が透明→焼き色 + 端の焦げ。**変化量が最大で一目瞭然** | 中 | 参照 SVG あり（Style Lock 承認済）→移植が先 | 色 + 縮みの両方を検証できる |
| **pepperoni** | 🔴 絵文字 | 縁の反り（cupping）+ 表面の油つや + 縁の褐変。最も代表的なトッピング | 中〜高 | 参照 SVG あり（承認済）→移植が先 | 反り = 楕円化 + 影、油 = オーバーレイ。salami との 20px 識別 HV 未了（§1c） |
| **mushroom** | 🍄 絵文字 | 縮み + 色の深まり | 中 | **参照 SVG なし**（porcini は別物）→新デザイン | Style Lock 外のため Owner のデザイン判断が先。Pilot からは外す |
| **shrimp** | `shrimp-curl`（SVG 済） | 灰→ピンク→焼き色、形は既に丸まっている | 低 | あり | **アセット依存ゼロ**。色の機構だけを最小リスクで検証できる |
| **green-pepper** | `green-pepper-strips`（Pilot E、暫定） | しんなり（わずかな垂れ + 彩度低下） | 低 | あり | #733 / Pilot E の値が PROVISIONAL のまま。変化が小さく機構の検証力が弱い。後続に回す |
| **mozzarella** | CSS 形状 + Canvas | 既存実装（melt / toast / char） | — | — | **Pilot 対象外。参照実装**。同じ `bakeHeat` 閾値の流儀に合わせる |

### 推奨 Pilot 3 種: **shrimp → bacon → pepperoni**（この順）

- **shrimp**: 既存 SVG のみで機構（CSS 変数・レジストリ・基準 filter の抑制）を最小リスクで証明。
- **bacon**: 色 + 縮み。Style Lock 承認済みの SVG を移植（既存の SVG 化レーン Batch 2 と同一作業）。
- **pepperoni**: 形状変化（反り）+ オーバーレイ（油）。機構の上限を試す。
- mushroom は新デザイン、green-pepper は暫定値のため後続バッチ。

## 5. 焼成アニメーション方式

- **入力は `bakeHeat`（0〜2）のみ**。既存の `PizzaStage` の毎フレーム再計算に相乗りし、**新しい rAF・タイマー・状態は作らない**。
- **色・形・オーバーレイはすべて連続補間**（`bakeVisual.ts` の既存方針どおり、`classifyBake` の境界での跳びを作らない。
  採点境界で「答えが見える」のを避ける）。キーは heat 0 / 1 / 2 の 3 点（既存の `TOPPING_FRAMES` と同じ流儀）。
- 変更は **SVG の内側のみ**（`transform-box: fill-box` + 内側 `<g>` の `scale` / `rotate`）。**ラッパー寸法・`--piece-rank-scale` は不変**
  → 配置・当たり・CUT 判定・RESULT 縮尺は変わらない。
- **個別ルックがある具材は、基準 `toppingVisualFrame` の `filter` を弱める**（drop-shadow は維持）。二重に暗くならない。
- **コスト**: 具材単位で 1 フレーム 1 回だけ `pieceBakeLookStyle` を計算し、同一具材の全ピースで共有（ピース数 ≤ 約 30）。
- sear / prep ルックとの合成: キー名前空間を分ける（`--bake-*` と `--sear-*` / `--beef-*`）。sausage / beef は Pilot に入れない。
- `prefers-reduced-motion` は連続補間なので追加の対応不要（ただし CSS `transition` は付けない）。
- 焼成後 = 凍結 `bakeResult` により CUT / RESULT で同じ見た目が保たれる。

### 表示面ごとの扱い（Owner 判断あり）

| 面 | 提案 |
|---|---|
| Tray / Shop / Dex / Research / Hint / Notebook / RESULT 一覧 | **常に Tray Visual（生の食材）**。焼成変化を一切反映しない（識別性維持） |
| ピザ上 PREPARE | Raw（= 既定の SVG） |
| ピザ上 BAKE〜CUT〜RESULT | `bakeHeat` に追従（凍結値を含む） |
| 後乗せ（FINISH `post`） | 対象外（既存構造のまま。**回帰テストで固定**） |
| Reference / レシピカードのサムネイル | Raw のまま（**Baked にするかは Owner 判断**） |
| Finished pizza の保存・スコア | **変更なし**（描画のみ） |

## 6. 不変条件（実装時の受入基準）

- 食材 id・`pieceVisual`・保存 schema・在庫・採点・解禁・Research identity を変更しない。
- 焼成前後で id を変えない（`data-topping-id` 不変）。
- `bakeProgress === null`、または Pilot 対象外の具材 → **DOM・style が現状とバイト同一**（テストで固定）。
- 後乗せ具材は `--bake-*` 変数を持たない（テスト）。
- `CheesePoolCanvas` / `.pizza-cheese*` / `cheesePoolBake.ts` は無変更。
- 390×844 / 360×800。Tray チップの寸法・タップ領域は不変。
- Steam / Fry / DRIZZLE / Batch 18 のファイルに触らない（§8）。

## 7. 97 食材への展開計画（現状: SVG 35 / 絵文字 62）

Baked ルックは **SVG がある食材だけ**が対象。SVG 化（既存レーン）とは独立に進め、先にルックが要る食材から追加する。

| 段階 | 内容 |
|---|---|
| L0 | レジストリ + CSS + 純関数 + テスト（Pilot なし。全具材 no-op を証明） |
| L1 | Pilot: shrimp |
| L2 | Pilot: bacon（SVG 移植を含む）→ pepperoni |
| L3 | Owner の HV 後、肉類（ham / sausage の sear 合成 / chicken / salami / prosciutto-crudo / pork）|
| L4 | 魚介（anchovy / tuna / sardine / salt-cod / whitebait / mussel / clam）|
| L5 | 野菜・キノコ（green-pepper / bell-pepper / mushroom / porcini / onion / eggplant 等） |
| L6 | 粉・ソース系は対象外または色のみ（`paprika-powder` / `cinnamon` はルック不要の可能性） |
| 永続 | 新食材は追加時に SVG とルック有無を同時に決める（Future Asset Rule に 1 行追記） |

チーズ（mozzarella 以外の `pieceVisual` 付きチーズ: feta / ricotta / cream-cheese 等）は `cheeseStyle` / Canvas の方針を踏襲するため、別途 Owner 判断。

## 8. 変更ファイルと他セッションとの競合

### 実装時に触るファイル（見込み）

| ファイル | 内容 | 競合リスク |
|---|---|---|
| `src/logic/pieceBakeLook.ts`（新規）+ test | レジストリ・純関数 | なし |
| `src/components/PieceBake.css`（新規） | 変数駆動のスタイル | なし（`App.css` を回避） |
| `src/components/IngredientGlyph.tsx` | 部位への `data-bake` 付与のみ | **中**: SVG 化レーンと Batch 18（#748）が同ファイルに visual を追加 |
| `src/components/PizzaStage.tsx` | `toppingPieceStyle` 周辺の約 10 行 | **高**: 1817 行の HOT。**open PR #738（Steam S3）が `PizzaStage.tsx` / `App.tsx` / `Steam.css` を変更中** |
| `src/data/ingredients.ts` | **変更しない**（§3） | — |
| `src/App.css` | **変更しない** | — |

### 他セッション・PR

- **#738（Steam S3）**: `PizzaStage.tsx` が重なる。→ #738 の merge 後に L0 以降へ着手し、claim に merge 順を明記。
- **#746（DRIZZLE Gesture Lab）**: `src/preview/*`・`main.tsx` のみ。重ならない。
- **#747**: docs のみ。重ならない。
- **Batch 18（#748、Issue のみ・PR なし）**: `ingredients.ts` / `IngredientGlyph.tsx`（cilantro 昇格）。L0 は `ingredients.ts` を触らないので影響は `IngredientGlyph.tsx` の追記位置のみ。
- **Fry（#749）**: PR 未作成。揚げ物の piece ルックを足す場合、同じ `PizzaStage` の合成点（sear / prep と同じ位置）を使う想定。**先に合成規則（§5）を固定**して衝突を避ける。
- 本ドキュメントは docs-only で他の PR と衝突しない。

## 9. 実装フェーズと必要な Owner 判断

| フェーズ | 内容 | Owner 判断 |
|---|---|---|
| P0（本書） | 設計監査 | **設計全体の承認**（特に §3 の「`Ingredient` を変えずレジストリ方式」） |
| P1 | L0: レジストリ・CSS・no-op テスト | #738 merge 後に着手してよいか |
| P2 | Pilot shrimp（Preview / HV） | 実機 iPhone Safari HV の方式（V1-LAN） |
| P3 | Pilot bacon / pepperoni | Style Lock 承認済み SVG の移植順（Batch 2 と同時か） |
| P4 | 展開（L3〜L5） | Pilot HV PASS 後にバッチ範囲を決定 |

### Owner に決めてほしい点

1. **方式**: 「同一 SVG + CSS 変数」（推奨）か、「Raw / Baked の SVG 2 枚をクロスフェード」か。
2. **Pilot 3 種**: shrimp → bacon → pepperoni（推奨）でよいか。mushroom は新デザインが要るため Style Lock の対象に加えるか。
3. **`pizzaVisual`（別 SVG）フィールド**を、必要になるまで保留してよいか。
4. **サムネイル / Reference を Baked 表示にするか**（推奨: Raw のまま）。
5. **混在の許容**: ルック付き食材と無しの食材が同じ皿で混在する期間を許容するか。
6. **既存の基準 `filter` の弱め方**（個別ルック対象のみ）に異論がないか。
7. **#738 の merge 後に L0 着手**でよいか。

## 10. 未確認事項

- 実機 iPhone Safari での `transform-box: fill-box` / 内側 `<g>` の変形の挙動（Phase P2 の HV で確認）。
- `PizzaStage` の毎フレーム再計算に追加する計算コストの実測（L0 でベンチ）。
- bacon / pepperoni の Style Lock 参照 SVG が Baked 変化の「部位分け」（`data-bake`）に耐える構造か（移植時に確認）。

---
_Generated by [Claude Code](https://claude.ai/code)_
