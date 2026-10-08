# Ingredient Icon 2.0 — Style Lock v2 (Issue #417)

Status: **Owner 承認済みの設計 authority（Style Lock）。26 種の対象が全て確定（8 + 17 + clam 既存維持）。Pilot A = hot-dog / sausage / feta / ricotta（§5、2026-10-08 Owner 決定）。実装は未着手。Production コード実装は #423 完了まで禁止（§7）。**
Path: `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`
Design reference (SVG + comparison sheet): [`docs/design/references/ingredient-icons-2.0/`](../design/references/ingredient-icons-2.0/)
Remaining-17 comparison sheets / candidates: [`docs/design/candidates/ingredient-icons-2.0-remaining/`](../design/candidates/ingredient-icons-2.0-remaining/)
Related: [`TETO_HUMAN-VERIFICATION-POLICY.md`](./TETO_HUMAN-VERIFICATION-POLICY.md)

> **比較履歴（v1 / v2 の before/after スクリーンショット）はこのリポジトリに含まれない。** 履歴は未マージの別ブランチ `claude/ingredient-icon-comparison-qqjfch`（commit `1e758f3dfe471c08a028942329742c3637d210e9`）にのみ存在する。authority ではなく、採用判断は本書と `docs/design/references/ingredient-icons-2.0/` の SVG / 比較シートが正。以前ここにあった `docs/reports/screenshots/ingredient-icons-2-style-lock/` へのリンクは、そのパスが main にも本ブランチにも無いため削除した。

## 0. 2026-10-08 Owner 決定（本版で反映）

1. **Pilot A は `hot-dog` / `sausage` / `feta` / `ricotta` の 4 種**とする（旧: hot-dog / feta / ricotta）。sausage を A へ前倒しし、Issue の受入条件「hot-dog と sausage の区別」を Pilot A の HV で判定できるようにする。
2. **チーズのアイコンは、Tray チップ・在庫（Inventory）・Shop・Dex 等の「アイコン用途」で SVG を使う。**
3. **ピザ上のチーズ・ドラッグ preview・完成ピザサムネイルは従来の CSS 物理形状（`.pizza-cheese` / `.pizza-cheese--<id>`）を維持する。**（§2、§4.4）
4. **#418 起因の実装禁止ゲートは解除する**（#418 は #425 として main に取り込み済み）。ただし **#423 が完了するまで Production コード実装は禁止**（§7）。
5. デザイン資産は **docs-only PR で main に取り込む**（本書・参照 SVG・比較シートを含む）。

## 1. 決定（Owner）

食材アイコン2.0 の最終デザインとして、比較シート v2 の以下 **8 種類**を Style Lock v2 として採用する。

| ingredient id | 日本語名 | 系統 | 参照 SVG | 識別の要点 |
|---|---|---|---|---|
| `mozzarella` | モッツァレラ | cheese | `mozzarella.svg` | 白い丸玉 + 上部の結び目 |
| `ricotta` | リコッタ | cheese | `ricotta.svg`（**v2**） | 粒のある山。皿は小さく薄く（目立たせない） |
| `grana-padano` | グラナ・パダーノ | cheese | `grana-padano.svg` | 平らな薄黄の板 + 側面の皮 |
| `parmigiano` | パルミジャーノ | cheese | `parmigiano.svg` | ギザギザに砕けた橙寄りの塊 + 欠片 |
| `gorgonzola` | ゴルゴンゾーラ | cheese | `gorgonzola.svg` | くさび形 + 青緑のカビ筋 |
| `feta` | フェタ | cheese | `feta.svg` | 白い角切り 2 個 |
| `sausage` | ソーセージ | meat | `sausage.svg`（**v2**） | 不規則な 2 塊、粗挽きの断面（白い脂塊 + 暗い粒） |
| `hot-dog` | ホットドッグ | meat | `hot-dog.svg`（**v2**） | 均一な滑らかな円形 3 枚（パンなし） |

- `grana-padano` と `parmigiano` は**形**で区別する（板 vs 砕けた塊）。
- `mozzarella` と `ricotta` は形（丸玉 vs 山）で区別する。ricotta の皿は v1 より控えめにした。
- `sausage` / `hot-dog` は 20px でも **塊数（2 vs 3）・輪郭の不規則さ・明度** で区別できる。
- **sausage の赤背景での暗さは現状維持。追加の色調整は行わない**（Owner 決定）。
- チーズ 6 種は暫定採用から **確定**。確認済み: 64 / 28 / 24 / 20px、赤背景、sausage↔hot-dog のグレースケール。

## 1b. 残り 17 種の決定（Owner、比較シート ①②を確認して採用）

| ingredient id | 日本語名 | 系統 | 採用 | 参照 SVG | 識別の要点 |
|---|---|---|---|---|---|
| `fontina` | フォンティーナ | cheese | A | `fontina.svg` | 穴あきの黄色い扇形 + 橙の皮 |
| `cashew-cheese` | カシューチーズ | cheese | A | `cashew-cheese.svg` | 小さな丸塊 + カシュー 2 粒 |
| `cream-cheese` | クリームチーズ | cheese | A | `cream-cheese.svg` | 青みのある銀紙包みの角丸ブロック |
| `catupiry` | カトゥピリ | cheese | A | `catupiry.svg` | 渦巻き状に盛った滑らかなクリーム |
| `pepperoni` | ペパロニ | meat | A | `pepperoni.svg` | 明るい赤橙の円 2 枚 + 脂の斑点 |
| `bacon` | ベーコン | meat | A | `bacon.svg` | 赤 + クリーム縞の波打つ帯 2 本 |
| `ham` | ハム | meat | A | `ham.svg` | 骨付きもも（桃色の塊 + 骨） |
| `chicken` | チキン | meat | A | `chicken.svg` | ドラムスティック |
| `salami` | サラミ | meat | **B** | `salami.svg` | 暗い赤紫のログ + 断面スライス（白い脂粒） |
| `prosciutto-crudo` | 生ハム | meat | **B** | `prosciutto-crudo.svg` | ひだ状に重なる薄切りリボン |
| `pork` | 豚肉 | meat | **B** | `pork.svg` | ポルケッタ断面（渦巻き + 焼き皮） |
| `anchovy` | アンチョビ | seafood | A | `anchovy.svg` | 細い S 字の茶色いフィレ 2 本 |
| `sardine` | イワシ | seafood | **B** | `sardine.svg` | 青背の銀魚 1 匹 |
| `tuna` | ツナ | seafood | A | `tuna.svg` | 赤身ブロック（白い筋目） |
| `shrimp` | エビ | seafood | A | `shrimp.svg` | 橙の丸まった海老（節・尾・目） |
| `salmon` | サーモン | seafood | A | `salmon.svg` | 橙 + 白い脂の縞 + 銀の皮 |
| `salt-cod` | 塩ダラ | seafood | **B** | `salt-cod.svg` | 白い切り身 + 粗塩の結晶 |

不採用（`docs/design/candidates/ingredient-icons-2.0-remaining/svg-not-adopted/`）: ham-B, prosciutto-crudo-A, pork-A, salami-A, sardine-A, tuna-B, salt-cod-A。

### clam（既存維持）

`clam` は既存 32×32 の `clam-valve` を**維持し変更しない**（Owner 決定）。新規 64×64 は作らない。

### 26 種の対象の確定状況（照合）

| 系統 | 対象 | 確定 8（v2） | 新規 17 | 既存維持 |
|---|---|---|---|---|
| cheese | 10 | mozzarella, ricotta, grana-padano, parmigiano, gorgonzola, feta（6） | fontina, cashew-cheese, cream-cheese, catupiry（4） | — |
| meat | 9 | sausage, hot-dog（2） | pepperoni, bacon, ham, chicken, salami, prosciutto-crudo, pork（7） | — |
| seafood | 7 | — | anchovy, sardine, tuna, shrimp, salmon, salt-cod（6） | clam（1） |
| 計 | **26** | **8** | **17** | **1** |

8 + 17 + 1 = 26。重複・漏れなし（`src/data/ingredientTaxonomy.ts` / `ingredients.ts` の cheese 10・meat 9・seafood 7 と一致）。
`tomato-slice` / `caper-cluster` は 26 種の対象外（既存 32×32 のまま）。

### 既存 v2 の 8 種との整合

- 17 種の参照 SVG も §2 の共通仕様（64×64・透明背景・線幅 2.4・接地影・2 トーン・`id` / gradient / `<defs>` なし）を満たす。`docs/design/references/ingredient-icons-2.0/` に 8 + 17 = 25 点の SVG が揃った（clam は既存のため参照 SVG なし）。
- 色の住み分け（v2 の 8 種との衝突確認）: 白〜淡黄のチーズは形が全て異なる（扇形 / 丸塊 + ナッツ / 銀紙ブロック / 渦盛り vs 球 / 山 / 角切り / 板 / 砕けた塊 / くさび）。丸スライス系（pepperoni / hot-dog / sausage）は色で区別。
- v2 の 8 種は変更していない。

## 1c. 今後のゲーム内 Human Verification 項目（デザイン時点の既知リスク）

実装 Pilot の HV（390×844 動画 + before/after screenshot）で、実機の描画サイズ・背景で必ず確認する。

1. **salami B の 20px 識別性**: ログ + スライスの構図が 20px でブロック状に潰れ、salami と読めるか。pepperoni A（明るい赤橙の円）・sausage / hot-dog（確定）と並んだ時に区別できるか（グレースケール含む）。不足なら Owner に再デザインを諮る（形・色の変更は Owner 承認が必要）。
2. **salt-cod B とチーズ類の類似**: 白い切り身 + 粗塩が feta / cream-cheese / mozzarella / ricotta（確定）と 20〜24px・淡色/赤背景で混同されないか。チップ・在庫・Dex で系統（魚介 vs チーズ）が取り違えられないか。
3. （参考・比較シートで指摘済み）anchovy ↔ bacon のグレースケール近似、pepperoni ↔ salami の色頼りの差。

HV で問題が出た場合も、Style Lock 済みデザインの変更は Owner の明示承認を要する。

## 2. 共通仕様（確定方針の再掲）

- 新規 SVG は **64×64（`viewBox="0 0 64 64"`）・透明背景**。
- **既存 3 種（`tomato-slice` / `caper-cluster` / `clam-valve`）の 32×32 SVG は変更しない**（viewBox・描画・CSS とも現状維持）。
- **ピザ上のチーズ CSS 表現（`.pizza-cheese` / `.pizza-cheese--<id>`）は変更しない。** チーズのアイコンは「アイコン用途」（Tray チップ / 在庫 / Shop / Dex / Hint / Notebook / Research / RESULT 一覧 / MissionShortage）にのみ使い、**ピザ上のチーズ・ドラッグ preview・完成ピザ（Pizza Select）サムネイルは CSS 物理形状のまま**にする（詳細 §4.4）。
- 拡張方式は **`pieceVisual` 拡張方式**（既存の `Ingredient.pieceVisual` を使う。新フィールドは作らない）。
- 20px では「食材の系統が識別できる」ことを基準とし、細部（脂塊・カビ筋の粒）が潰れることは許容する。
- SVG に `id` / gradient / `<defs>` を使わない（同一ページに何個あっても衝突しない。`IngredientGlyph.tsx` 既存規約）。参照 SVG 8 点は全て満たしている。
- 装飾扱い（`aria-hidden="true"` / `focusable="false"`）。名前は各 call site の `nameJa` が担う。
- 描画は `pieceVisual` のみを読み、`id` では分岐しない（discovery / save / inventory の identity と描画を独立に保つ）。

## 3. 既存 32×32 SVG を維持する方針（記録）

- 現行 `IngredientGlyph` は全 visual に固定で `viewBox="0 0 32 32"` を与えている。2.0 の 64×64 を追加しても、既存 3 種の markup / CSS / テスト（`IngredientGlyph.test.tsx`）は**一切書き換えない**。
- 32px と 64px の共存は **visual ごとの viewBox テーブル** で解決する（§4）。既存 3 種は 32、新規は 64。表示サイズは両方 `1em`（`.ingredient-glyph`）なので呼び出し側の font-size はそのまま効く。
- `.ingredient-glyph--tomato-slice` の 1.15em / 負マージンは既存のまま。新規 visual にサイズ補正が要るかは Pilot の Human Verification で判断する（初期値は補正なし = 1em）。

## 4. IngredientGlyph 拡張計画（確定）

### 4.1 型 / データ

`src/data/ingredients.ts` の `DedicatedIngredientVisual` に 8 値を追加する（visual 名は ingredient id と独立。将来別 ingredient が同形を共有できる）。

| ingredient id | `pieceVisual` |
|---|---|
| `mozzarella` | `mozzarella-ball` |
| `ricotta` | `ricotta-mound` |
| `grana-padano` | `grana-slab` |
| `parmigiano` | `parmigiano-chunk` |
| `gorgonzola` | `gorgonzola-wedge` |
| `feta` | `feta-cubes` |
| `sausage` | `sausage-slices` |
| `hot-dog` | `hot-dog-slices` |

各 ingredient 行は `pieceVisual: "<visual>"` を 1 行足すだけ（`emoji` は必須テキストとして残す。既存 capers / clam / fresh-tomato と同じ扱い）。

残り 17 種（§1b）の `pieceVisual` 名（案。実装 Issue で確定。visual 名は id と独立の原則を維持）:
`fontina-wedge` / `cashew-cheese-wheel` / `cream-cheese-block` / `catupiry-swirl` / `pepperoni-slices` / `bacon-strips` / `ham-leg` / `chicken-drumstick` / `salami-log` / `prosciutto-ribbon` / `porchetta-roll` / `anchovy-fillets` / `sardine-fish` / `tuna-block` / `shrimp-curl` / `salmon-fillet` / `salt-cod-fillet`。`clam` は既存 `clam-valve`（32×32）のまま。

### 4.2 コンポーネント

`src/components/IngredientGlyph.tsx`:

1. `VISUAL_VIEWBOX: Record<DedicatedIngredientVisual, string>` を追加（既存 3 種 = `"0 0 32 32"`、新規 8 種 = `"0 0 64 64"`）。`<svg viewBox>` はこの表から引く。
2. visual ごとの小コンポーネント（`MozzarellaBall` 等）を追加し、`DedicatedIngredientSvg` の分岐に足す。中身は `docs/design/references/ingredient-icons-2.0/*.svg` の子要素をそのまま JSX 化する（属性は camelCase: `stroke-width` → `strokeWidth` 等）。
3. 参照 SVG の接地影（`<ellipse … opacity=".15"/>`）は**そのまま移植する**。ピザ上の見え方は Pilot の HV で確認し、不要なら影だけを削る（形状・色は変えない）。
4. `className` は既存規則 `ingredient-glyph ingredient-glyph--<visual>` を維持。
5. emoji パス（`pieceVisual` なし）は 1 バイトも変えない。

### 4.3 触らないもの

`.pizza-cheese*` CSS、Save スキーマ（`pieceVisual` は save に出さない）、discovery / recipe / shop のロジック、既存 3 種の描画。

### 4.4 チーズの描画範囲（2026-10-08 Owner 決定）

現行コードは、チーズを次の 4 か所で `category === "cheese"` により `IngredientPieceVisual`（CSS 物理形状）へ分岐している（実装前の調査結果。本 PR では変更しない）。

| 場所 | 現行 | 決定後 |
|---|---|---|
| Tray チップ（`IngredientTray.tsx`） | CSS（`ingredient-chip__cheese-slot`） | **SVG アイコン**（実装で分岐を変更） |
| 在庫（`InventoryOverlay.tsx`） | CSS（`inventory-card__cheese-slot`） | **SVG アイコン**（実装で分岐を変更） |
| Shop / Dex / Hint / Notebook / Research / RESULT 一覧 / MissionShortage | `IngredientGlyph`（emoji 🧀） | **SVG アイコン**（`pieceVisual` で自動） |
| ピザ上のチーズ | CSS（`.pizza-cheese`） | **CSS のまま** |
| ドラッグ preview（`IngredientTray.tsx`） | CSS | **CSS のまま** |
| 完成ピザ / Pizza Select サムネイル（`PizzaThumbnail.tsx`） | CSS | **CSS のまま** |

- 実装上の要点: Tray チップと在庫の cheese 分岐を `IngredientGlyph` 経由に切り替える。ピース・ドラッグ preview・サムネイルの分岐は触らない。
- 非チーズ（sausage / hot-dog 等）は従来どおり `IngredientPieceVisual` → `IngredientGlyph` を通るので、ピザ上のピースにも SVG が出る（接地影の見え方は §8 の HV 項目）。

## 5. Pilot 実装順序

3 Pilot に分け、各 Pilot で 1 PR・1 回の Human Verification とする。

| Pilot | 対象 | 理由 |
|---|---|---|
| **A** | `hot-dog`, `sausage`, `feta`, `ricotta` | 64px viewBox 共存の仕組み（§4.2-1）と、チーズのアイコン用途の分岐変更（§4.4）を最小の種類数で検証する。**hot-dog と sausage を同時に出し、受入条件「hot-dog / sausage の区別」を A の HV で判定する**（2026-10-08 Owner 決定で sausage を C から前倒し） |
| **B** | `grana-padano`, `parmigiano`, `gorgonzola` | 形で区別する組（grana↔parmigiano）を同時に実機確認できる |
| **C** | `mozzarella` | 序盤の高露出具材（Starter Stock 等）。A / B で共通基盤が固まってから最後に切り替える |

Pilot A は共通基盤（型・viewBox 表・チーズ分岐変更・テスト更新）を含む。B / C は visual 追加のみ。残り 17 種（§1b）の Pilot 割当は未定（Owner が A〜C の HV 後に決める）。

## 6. 最小テスト（各 Pilot 共通）

`src/components/IngredientGlyph.test.tsx` を更新・追加する（新規テストファイルは作らない）。

1. **dedicated 集合の更新**: 「only capers / clam / fresh-tomato declare a dedicated visual」の期待マップ（`W1_DEDICATED`）に、その Pilot の ingredient を足す。それ以外が `pieceVisual` を持たないこと（emoji 行の DOM 完全一致、既存の `it.each(EMOJI_ROWS)`）はそのまま通ること。
2. **visual ごとの描画**: 各新 visual を `fixture({ pieceVisual })` で描画し、`svg[data-ingredient-visual]` / `class` / `aria-hidden` / `focusable` が既存 3 種と同じ規約であること、`viewBox` が `VISUAL_VIEWBOX` どおり（新規 = `0 0 64 64`、既存 3 種 = `0 0 32 32` のまま）であること。
3. **id 非依存**: 同じ visual を別 ingredient id で描画しても markup が一致する（既存 `tomato-slice` テストと同形）。
4. **衝突なし**: 描画結果に `id=` 属性・`url(#` 参照が無い。
5. **テキスト規約**: RESULT / チップ等の文字列は `pieceVisual` あり ` ${nameJa}`（emoji なし）、なしは `${emoji} ${nameJa}`（既存の期待式）のまま通ること。
6. **save 不変**: `JSON.stringify(createDefaultSave())` に `pieceVisual` が現れない（既存）。

実行は変更ファイルの focused unit test（`IngredientGlyph.test.tsx`, `ingredients.test.ts`）+ typecheck / lint / build。UI 変更なので完了条件に **Human Verification（390×844 動画 + before/after screenshot）** を含む（`CLAUDE.md` / HUMAN-VERIFICATION-POLICY 準拠）。

## 7. 実装開始の前提 / ガード

- **#418 起因の実装禁止ゲートは解除済み**（2026-10-08 Owner 決定。#418 は #425 として main に取り込み済み）。
- **ただし #423（RESULT: 詳細展開時に固定ボタンが内容に重なる）が完了するまで、Production コード（`src` / CSS / runtime）の実装は禁止。** #423 の作業ブランチには触れない。
- 実装は #423 完了後の**最新 main** から開始する。実装 Issue は Owner が起票する（Pilot A から）。
- 本書とデザイン資産（参照 SVG・比較シート・候補）は docs-only PR で main に取り込む。この PR に `src` / CSS / runtime の変更は含めない。merge と deploy は Owner の判断で行う。

## 8. 未確定（実装前に Owner / Pilot HV で確認）

- 接地影のピザ上での見え方（§4.2-3）。
- 新 visual に `.ingredient-glyph--<visual>` のサイズ補正が必要か（§3）。
- ~~残り 18 種のデザイン比較の順序~~ → §1b で全て確定（clam は既存維持）。実装の Pilot 順は §5 を 26 種へ拡張する際に別途 Owner と決める。
- Tray チップ・在庫の cheese 分岐を SVG に切り替えた後の、チップ幅・タップ領域・行高への影響（§4.4。390×844 / 360×800）。
- sausage ↔ hot-dog の 20px 識別（Pilot A の HV で判定）。
