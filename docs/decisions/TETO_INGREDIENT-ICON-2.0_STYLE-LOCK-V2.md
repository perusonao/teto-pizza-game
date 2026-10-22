# Ingredient Icon 2.0 — Style Lock v2 (Issue #417)

Status: **Owner 承認済みの設計 authority（Style Lock）。26 種の対象が全て確定（8 + 17 + clam 既存維持）。既存 26 種類のデザインは確定済み、27 種類目の goat-cheese は未デザイン（§9）。Pilot A = hot-dog / sausage / feta / ricotta（§5、2026-10-08 Owner 決定）。**実装状況（main `d70bd20`、2026-10-22 時点。§10）: Pilot A の 4 種は main に実装済み。26 種のうち未実装は 21 種。26 種の外で shiso / whitebait が実装済み、salmon-roe は PR #584（HOLD）内。次の実装は salmon + cream-cheese（Pilot D、§10）。#423 の実装ガードは解除済み（§7）。**
Path: `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`
Design reference (SVG + comparison sheet): [`docs/design/references/ingredient-icons-2.0/`](../design/references/ingredient-icons-2.0/)
Remaining-17 comparison sheets / candidates: [`docs/design/candidates/ingredient-icons-2.0-remaining/`](../design/candidates/ingredient-icons-2.0-remaining/)
Related: [`TETO_HUMAN-VERIFICATION-POLICY.md`](./TETO_HUMAN-VERIFICATION-POLICY.md)

> **比較履歴（v1 / v2 の before/after スクリーンショット）はこのリポジトリに含まれない。** 履歴は未マージの別ブランチ `claude/ingredient-icon-comparison-qqjfch`（commit `1e758f3dfe471c08a028942329742c3637d210e9`）にのみ存在する。authority ではなく、採用判断は本書と `docs/design/references/ingredient-icons-2.0/` の SVG / 比較シートが正。以前ここにあった `docs/reports/screenshots/ingredient-icons-2-style-lock/` へのリンクは、そのパスが main にも本ブランチにも無いため削除した。

## 0. 2026-10-08 Owner 決定（本版で反映）

1. **Pilot A は `hot-dog` / `sausage` / `feta` / `ricotta` の 4 種**とする（旧: hot-dog / feta / ricotta）。sausage を A へ前倒しし、Issue の受入条件「hot-dog と sausage の区別」を Pilot A の HV で判定できるようにする。
2. **チーズのアイコンは、Tray チップ・在庫（Inventory）・Shop・Dex 等の「アイコン用途」で SVG を使う。**
3. **ピザ上のチーズ・ドラッグ preview・完成ピザサムネイルは従来の CSS 物理形状（`.pizza-cheese` / `.pizza-cheese--<id>`）を維持する。**（§2、§4.4）**※ 2026-10-17 に `pieceVisual` を持つチーズへ限定して改訂（本節 6 項）。**
4. **#418 起因の実装禁止ゲートは解除する**（#418 は #425 として main に取り込み済み）。ただし **#423 が完了するまで Production コード実装は禁止**（§7）。
5. デザイン資産は **docs-only PR で main に取り込む**（本書・参照 SVG・比較シートを含む）。
6. **2026-10-17 Owner 決定（#503 の実機 HV を受けた改訂）:** Pilot A の HV で、feta / ricotta がトレイでは別の SVG なのにピザ上では同じ白丸（CSS 汎用円）になり区別できないと判明した。そこで **`pieceVisual` を持つチーズ（Pilot A 時点では feta / ricotta）に限り、ピザ上・ドラッグ preview・完成ピザ / Pizza Select サムネイル・Reference でも SVG を使う。** SVG は従来の `.pizza-cheese` / `.pizza-cheese--<id>` ラッパー（+ `.pizza-cheese--glyph`）の内側に描き、焼成の melt transform・filter、サイズ区分 / RESULT ×0.75 は従来どおりラッパーに掛かる。**`pieceVisual` を持たないチーズ（mozzarella を含む）と mozzarella の Canvas / M1 フォールバックは変更しない。** 将来 mozzarella に `pieceVisual` を付ける Pilot C では、Canvas / M1 フォールバックを維持する扱いを別途確認する。
7. **2026-10-22 Owner 決定:** (a) **PR #584 は HOLD（merge しない）。** (b) **salmon / cream-cheese の専用 SVG を優先する（Pilot D、§10）。** (c) **shiso / whitebait / salmon-roe を Style Lock に追記する（§10）。** (d) 本書と実装状況の食い違いを修正する（本版）。(e) #468 / #478 は保留。(f) **見かけ補正 Candidate C（`?toppingScale=c`）の既定値は変更しない**（Preview / DEV 限定のまま、本番は倍率表 B）。

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
- **`pieceVisual` を持たないチーズのピザ上 CSS 表現（`.pizza-cheese` / `.pizza-cheese--<id>`）は変更しない。**（2026-10-17: `pieceVisual` を持つチーズは同じラッパー内で SVG を描く。§0-6、§4.4） チーズのアイコンは「アイコン用途」（Tray チップ / 在庫 / Shop / Dex / Hint / Notebook / Research / RESULT 一覧 / MissionShortage）にのみ使い、**ピザ上のチーズ・ドラッグ preview・完成ピザ（Pizza Select）サムネイルは CSS 物理形状のまま**にする（詳細 §4.4）。
- 拡張方式は **`pieceVisual` 拡張方式**（既存の `Ingredient.pieceVisual` を使う。新フィールドは作らない）。
- 20px では「食材の系統が識別できる」ことを基準とし、細部（脂塊・カビ筋の粒）が潰れることは許容する。
- SVG に `id` / gradient / `<defs>` を使わない（同一ページに何個あっても衝突しない。`IngredientGlyph.tsx` 既存規約）。参照 SVG 8 点は全て満たしている。
- 装飾扱い（`aria-hidden="true"` / `focusable="false"`）。名前は各 call site の `nameJa` が担う。
- 描画は `pieceVisual` のみを読み、`id` では分岐しない（discovery / save / inventory の identity と描画を独立に保つ）。

## 3. 既存 32×32 SVG を維持する方針（記録）

- 現行 `IngredientGlyph` は全 visual に固定で `viewBox="0 0 32 32"` を与えている。2.0 の 64×64 を追加しても、既存 3 種の markup / CSS / テスト（`IngredientGlyph.test.tsx`）は**一切書き換えない**。
- 32px と 64px の共存は **visual ごとの viewBox テーブル** で解決する（§4）。既存 3 種は 32、新規は 64。表示サイズは両方 `1em`（`.ingredient-glyph`）なので呼び出し側の font-size はそのまま効く。
- `.ingredient-glyph--tomato-slice` の 1.15em / 負マージンは既存のまま。新規 visual にサイズ補正が要るかは Pilot の Human Verification で判断する（初期値は補正なし = 1em）。

**実装での追記（2026-10-22 時点）:** Batch 8b は shiso / whitebait に、64 ボックス内の余白が大きく隣の絵文字より小さく見える問題への補正として、**`.ingredient-glyph--<visual>` 個別クラスで 1.2em + 負マージン**を入れた（`App.css`）。これは「初期値は補正なし」の例外だが、**補正は visual 個別クラスに閉じる**（既存 3 種・Pilot A の 4 種は 1em のまま）という方式で一貫している。新 visual の補正の要否は Pilot ごとの HV と比較画像で決め、補正値と根拠を Result Report に残す。倍率表（`toppingSizeClass.ts`、本番は B: 0.7 / 0.85 / 1 / 1.15 / 1.3、mozzarella は免除）は glyph の font-size に掛かる別の層で、重ねて効く。

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

**実装状況（main）:** 上表のうち `ricotta-mound` / `feta-cubes` / `sausage-slices` / `hot-dog-slices` が実装済み（Pilot A）。`mozzarella-ball` / `grana-slab` / `parmigiano-chunk` / `gorgonzola-wedge` は未実装。26 種の外で `shiso-leaf` / `whitebait-school` が実装済み（§10）。

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

以下の表は **2026-10-08 時点の設計記録**（実装前の調査結果）。**ピザ上・ドラッグ preview・サムネイルの行は §0-6（2026-10-17）で改訂済み**: `pieceVisual` を持つチーズはそれらでも SVG を `.pizza-cheese` ラッパー内に描く（実装済み。`IngredientPieceVisual.tsx` / `IngredientTray.tsx` / `PizzaThumbnail.tsx`）。`pieceVisual` を持たないチーズは表の「CSS のまま」が現行。

| 場所 | 現行 | 決定後 |
|---|---|---|
| Tray チップ（`IngredientTray.tsx`） | CSS（`ingredient-chip__cheese-slot`） | **SVG アイコン**（実装で分岐を変更） |
| 在庫（`InventoryOverlay.tsx`） | CSS（`inventory-card__cheese-slot`） | **SVG アイコン**（実装で分岐を変更） |
| Shop / Dex / Hint / Notebook / Research / RESULT 一覧 / MissionShortage | `IngredientGlyph`（emoji 🧀） | **SVG アイコン**（`pieceVisual` で自動） |
| ピザ上のチーズ | CSS（`.pizza-cheese`） | `pieceVisual` あり: **同ラッパー内の SVG**（2026-10-17、実装済み）/ なし: **CSS のまま**（mozzarella は Canvas 既定 ON、失敗時 M1。#486） |
| ドラッグ preview（`IngredientTray.tsx`） | CSS | 同上 |
| 完成ピザ / Pizza Select サムネイル（`PizzaThumbnail.tsx`） | CSS | 同上 |

- 実装上の要点: Tray チップと在庫の cheese 分岐を `IngredientGlyph` 経由に切り替える。ピース・ドラッグ preview・サムネイルは `IngredientPieceVisual` の 1 か所で、`pieceVisual` ありのチーズだけラッパー内に SVG を描く（2026-10-17。`.pizza-cheese--glyph` が CSS 円の背景・白縁を消し、枠を 28px にする）。
- **未移行チーズの扱い（2026-10-09 Owner 決定）:** 上表の「SVG アイコン」は **`pieceVisual` を持つチーズにのみ**適用する。`pieceVisual` を持たない未移行チーズ（例: Pilot A 時点の mozzarella / goat-cheese）は、Tray チップ・在庫でも**従来の CSS 表示（`IngredientPieceVisual` の `.pizza-cheese--<id>`）を維持**する。全チーズを `IngredientGlyph` へ一括切替してはならない（未移行チーズが 🧀 絵文字へ退行するため）。分岐は「`category === "cheese"` かつ `pieceVisual` あり → `IngredientGlyph`、それ以外の cheese → 従来の CSS」とする。
- 非チーズ（sausage / hot-dog 等）は従来どおり `IngredientPieceVisual` → `IngredientGlyph` を通るので、ピザ上のピースにも SVG が出る（接地影の見え方は §8 の HV 項目）。

## 5. Pilot 実装順序

3 Pilot に分け、各 Pilot で 1 PR・1 回の Human Verification とする。

| Pilot | 対象 | 理由 |
|---|---|---|
| **A**（**実装済み**・main。Owner HV 結果は Issue #438 に記録なし） | `hot-dog`, `sausage`, `feta`, `ricotta` | 64px viewBox 共存の仕組み（§4.2-1）と、チーズのアイコン用途の分岐変更（§4.4）を最小の種類数で検証する。**hot-dog と sausage を同時に出し、受入条件「hot-dog / sausage の区別」を A の HV で判定する**（2026-10-08 Owner 決定で sausage を C から前倒し） |
| **B** | `grana-padano`, `parmigiano`, `gorgonzola` | 形で区別する組（grana↔parmigiano）を同時に実機確認できる |
| **C** | `mozzarella` | 序盤の高露出具材（Starter Stock 等）。A / B で共通基盤が固まってから最後に切り替える |

Pilot A は共通基盤（型・viewBox 表・チーズ分岐変更・テスト更新）を含む。B / C は visual 追加のみ。残り 17 種（§1b）の Pilot 割当は未定（Owner が A〜C の HV 後に決める）。

**2026-10-22 追記: Pilot D = `salmon`, `cream-cheese`（Owner 優先、§10）。** 実施順は **D → B → C**（D は #584 が HOLD の間も着手可能だが、`IngredientGlyph.tsx` / `ingredients.ts` / `App.css` が #584 と重なるため、競合の扱いは §10.3）。B / C の対象は変更しない。

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
- ~~ただし #423 が完了するまで Production コードの実装は禁止。~~ **#423 は 2026-10-08 に PR #430 で完了済み。ガードは解除済み**（2026-10-22 確認。Pilot A も実装済み）。
- 実装は**最新 main** から開始する。実装 Issue は Owner が起票する（Pilot D は未起票。§10）。
- 本書とデザイン資産（参照 SVG・比較シート・候補）は docs-only PR で main に取り込む。この PR に `src` / CSS / runtime の変更は含めない。merge と deploy は Owner の判断で行う。

## 8. 未確定（実装前に Owner / Pilot HV で確認）

- 接地影のピザ上での見え方（§4.2-3）。
- 新 visual に `.ingredient-glyph--<visual>` のサイズ補正が必要か（§3）。
- ~~残り 18 種のデザイン比較の順序~~ → §1b で全て確定（clam は既存維持）。実装の Pilot 順は §5 を 26 種へ拡張する際に別途 Owner と決める。
- Tray チップ・在庫の cheese 分岐を SVG に切り替えた後の、チップ幅・タップ領域・行高への影響（§4.4。390×844 / 360×800）。
- sausage ↔ hot-dog の 20px 識別（Pilot A の HV で判定）。
- **2026-10-22 時点で未解決のまま:** 上 4 項目は Pilot A が main に入った後も、Owner HV の結果（PASS / 補正の要否）が Issue #438 に記録されていない。Pilot B 着手の Gate（#438 の受入条件）として、結果の記録先を Owner が決める。

## 9. 追加決定（2026-10-09 Owner）— goat-cheese

1. `goat-cheese`（cheese、Batch 6 PR-2 / #437 で追加）を **27 種目の SVG 化対象に追加する**。§1 / §1b / 「26 種の対象の確定状況」の「26 種」「cheese 10」は 2026-10-08 時点の確定数としてそのまま残し、本節で 1 件加算する（cheese 11、計 27）。
2. **Pilot A / B / C の対象と順序（§5）は変更しない。** Pilot A は `hot-dog` / `sausage` / `feta` / `ricotta`（実装 Issue #438）のまま。goat-cheese は Pilot A / B / C に含めず、**実装時期は後続で Owner が決める**（残り 17 種の割り当てと同じ枠）。実装の優先順位は Batch 6 PR-3 が先。
3. デザインは未作成。§1b と同じ手順（比較シート → Owner 採用 → 参照 SVG）で決め、既存チーズ 10 種との識別を確認する。`pieceVisual` 名は実装 Issue で確定する（visual 名は id と独立の原則を維持）。
4. 共通仕様（§2）、cheese の描画範囲（§4.4）、`pieceVisual` 方式は変更しない。
5. SVG が採用・実装されるまで、goat-cheese は `pieceVisual` を持たない未移行チーズとして、§4.4 のとおり**従来の CSS 表示を維持**する。
6. 対象外: `artichoke` / `rosemary`（🌱）、`spinach` / `oregano`（🍃）の絵文字重複は、Owner 決定により本アイコン 2.0 の対象外とする（Owner の HV は通過済み）。

## 10. 現行実装との照合と追加決定（2026-10-22 Owner）— shiso / whitebait / salmon-roe、Pilot D

Base: `main` `d70bd20`。調査と比較画像: [`docs/reports/TETO_INGREDIENT-VISUAL-LANE_Fresh-Audit.md`](../reports/TETO_INGREDIENT-VISUAL-LANE_Fresh-Audit.md)（棚卸し）、[`docs/reports/TETO_INGREDIENT-VISUAL-LANE_SALMON-CREAM-CHEESE_Comparison.md`](../reports/TETO_INGREDIENT-VISUAL-LANE_SALMON-CREAM-CHEESE_Comparison.md)（Pilot D 比較）。

### 10.1 実装状況（main）

| 区分 | 食材 | 状態 |
|---|---|---|
| 実装済み（Style Lock 26 種） | hot-dog, sausage, feta, ricotta（Pilot A） | main。`pieceVisual` あり。Owner HV の結果記録は Issue #438 に無い |
| 既存維持 | clam / tomato-slice / caper-cluster（32×32） | 変更なし |
| 実装済み（26 種の外） | shiso, whitebait | main（Batch 8b、OD-B8-2 amended）。下記 10.2 |
| PR 中（26 種の外） | salmon-roe | PR #584（**HOLD、merge しない**）。main に食材 ID も SVG も無い |
| **未実装（26 種のうち 21 種）** | Pilot B: grana-padano, parmigiano, gorgonzola ／ Pilot C: mozzarella ／ 残り 17: fontina, cashew-cheese, cream-cheese, catupiry, pepperoni, bacon, ham, chicken, salami, prosciutto-crudo, pork, anchovy, sardine, tuna, shrimp, salmon, salt-cod | 参照 SVG は `docs/design/references/ingredient-icons-2.0/` にある（27 点: 25 + shiso + whitebait） |
| 未デザイン | goat-cheese（§9） | CSS 表示のまま |

### 10.2 Style Lock への追記（Owner 決定 2026-10-22）

`shiso` / `whitebait` / `salmon-roe` を、Style Lock v2 の対象（§1b と同じ扱いの追加対象）に追記する。共通仕様（§2: 64×64、透明背景、`id` / gradient / `<defs>` なし、接地影、2 トーン、`aria-hidden`、`pieceVisual` のみで描画）に従う。

| ingredient id | 日本語名 | 系統 | `pieceVisual` | 参照 SVG | 識別の要点 | 状態 |
|---|---|---|---|---|---|---|
| `shiso` | 大葉 | topping（leaf） | `shiso-leaf` | `shiso.svg`（main にある） | 鋸歯のある緑の葉 + 中央の葉脈 | **本番** |
| `whitebait` | しらす | seafood | `whitebait-school` | `whitebait.svg`（main にある） | 白い小魚 3 匹（青灰の背線 + 黒い目） | **本番** |
| `salmon-roe` | いくら | seafood | `salmon-roe-grains`（#584 での名称。確定は #584 の扱い次第） | `salmon-roe.svg`（**#584 のブランチにのみ存在**） | 橙の粒 6 つの小山 | **PR #584（HOLD）** |

- shiso / whitebait の描画サイズ補正は `.ingredient-glyph--shiso-leaf` / `--whitebait-school` の 1.2em（§3 追記）。クラス倍率は shiso = xs、whitebait = s（`toppingSizeClass.ts`）。RESULT では ×0.75 も重なり、shiso の描画箱は約 17.6px になる。**20px 未満での識別性は未計測**（調査記録 M4）。
- **salmon-roe の参照 SVG は、#584 の add/add 競合を避けるため、本版では main に取り込まない。** #584 の扱い（merge / 差し替え / close）が決まってから、その結果に合わせて参照ディレクトリへ置く。#584 のデザインは「Owner が #584 の HV で確認」とされており、**本書は salmon-roe の最終デザインを確定しない**（追加対象としての登録のみ）。
- 色の住み分け: salmon-roe（橙の丸粒）は salmon（桃橙の切り身）と同じ橙系。**形（丸粒の山 vs 縞のある楕円）で区別する**。焼けた生地（橙）に対する明度コントラストは両者とも低く（調査記録）、識別は暗い輪郭と形に依存する。

### 10.3 Pilot D = `salmon`, `cream-cheese`（Owner 優先、2026-10-22）

1. 対象: `salmon`（`pieceVisual` 案: `salmon-fillet`）、`cream-cheese`（案: `cream-cheese-block`）。参照 SVG は §1b で採用済み（A 案、`salmon.svg` / `cream-cheese.svg`）。**デザインは変更しない。**
2. 方式: Pilot A / 8b と同じ（`pieceVisual` 1 行 + visual コンポーネント + `VISUAL_VIEWBOX` に 64）。cream-cheese は `pieceVisual` ありのチーズとして §0-6 / §4.4 の経路（ラッパー内 SVG）に乗る。
3. **#584 との競合ファイル（HOLD の間は実装しない）:** `src/components/IngredientGlyph.tsx`、`src/components/IngredientGlyph.test.tsx`、`src/data/ingredients.ts`、`src/App.css`（HOT）。Pilot D はこの 4 ファイルすべてに触れるため、**#584 の扱いが決まるまで runtime には着手しない**。`toppingSizeClass.ts` は salmon（l）・cream-cheese（l）とも既に表にあり、Pilot D では触らない。
4. 比較結果の要点（詳細は比較レポート）:
   - 専用 SVG は現行（salmon = 🍣 絵文字、cream-cheese = 汎用円）より**描画が小さく見える**（1em のとき、RESULT で salmon は約 21×14px、cream-cheese は約 21×17px）。**1.2em の個別補正を入れると現行と同程度の存在感**になる。補正の採否は Owner（既定提案: 入れる。salmon-roe / shiso / whitebait と同じ CSS 方式）。
   - salmon ↔ salmon-roe は形で区別できる。cream-cheese は feta / ricotta / mozzarella と色（青灰の銀紙）と形で区別できる。
   - 焼き過ぎでは salmon の輪郭が暗くなる（暗い輪郭 vs 焦げた生地の明度比で約 1.4:1（焼成フィルタ前の概算））。縞の白は残るので形は読める。**色は変えない**（Style Lock 済み）。
5. 最小 PR の範囲（#584 の扱いが決まった後）: 上 3 の 4 ファイル + 必要なら catalog 系テストの期待値。Save / scoring / economy / recipes / progression / Research authority は変更しない。受け入れ条件は Fresh Audit §7「PR-1 固有」。
6. **Candidate C（見かけ補正）の既定値は変更しない**（Preview / DEV 限定、本番は表 B）。Pilot D の補正は 1.2em の個別クラス（Candidate C の倍率とは別の層）として扱う。

**Owner 決定（2026-10-22、後続）:** (a) salmon・cream-cheese の専用 SVG 化を採用。(b) **両食材に個別の 1.2em 補正を採用**（`.ingredient-glyph--<visual>` 個別クラス）。(c) `cream-cheese.svg` の無描画 `<path>`（`stroke-width="0"`）は**削除可**（実装時に移植しない。見た目は不変）。(d) **#584 との競合が解消するまで runtime 実装は禁止。** (e) **実装の追跡先は Issue #623**。(f) **Pilot B は #438 の Owner HV 結果が記録されるまで着手しない**（2026-10-22 時点で #438 / #417 にコメント 0 件。**PASS 扱いにしない。Owner 確認待ち**）。

**追加の依存（起票時に判明）:** Issue #621（FIN-E4b-ikura、#584 の再設計）が `ingredients.ts` / `IngredientGlyph.tsx` / `.test.tsx` / `App.css` に触れ、salmon-roe の SVG・CSS を #584 から流用する。Pilot D は #584 に加えて **#621 の merge 順**にも依存する（#621 の Owner 決定: 描画方式の混在 = roe・shiso は SVG、salmon は絵文字、cream-cheese は CSS 形状は E4b では暫定許容）。#621 は Style Lock 追補（SL-1/2/3/6）を並行作業としているが、その内容は本書では確認していない（別ブランチ）。重複する場合は Owner が整理する。

### 10.4 本版で直していないもの（記録）

- `docs/PROJECT_HANDOFF.md` の「Ingredient Icon 2.0」節（「Implementation has not started」ほか）は古いが、**HOT file であり #584 も変更するため本版では触れない**。#584 の扱いが決まった後の別 PR で更新する。
- `docs/design/references/ingredient-icons-2.0/README.md` は 25 点 → 27 点（shiso / whitebait 追加）に直した。salmon-roe は #584 側。
