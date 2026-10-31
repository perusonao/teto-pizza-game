# Ingredient Icon 2.0 — Style Lock v2 (Issue #417)

Status: **Owner 承認済みの設計 authority（Style Lock）。26 種の対象が全て確定（8 + 17 + clam 既存維持）。既存 26 種類のデザインは確定済み、27 種類目の goat-cheese は未デザイン（§9）。Pilot A = hot-dog / sausage / feta / ricotta（§5、2026-10-08 Owner 決定）。**実装状況（main `d70bd20`、2026-10-22 時点。§10）: Pilot A の 4 種は main に実装済み。26 種のうち未実装は 21 種。26 種の外で shiso / whitebait が実装済み、salmon-roe は PR #584（HOLD）内。次の実装は salmon + cream-cheese（Pilot D、**#621 の merge 後**、§0-7 / §10.3）。Pilot B は #438 の Owner HV 結果の記録まで HOLD。#423 の実装ガードは解除済み（§7）。**
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
7. **2026-10-22 Owner 決定（本書の正本。§10 は経緯と規則のみで、決定を繰り返さない）:**
   - (a) **PR #584 は HOLD（merge しない・close しない）。** salmon-roe を含む Batch 8c（いくらとサーモンのピザ）の**正規の実装経路は Issue #621**（FIN-E4b-ikura）。`salmon-roe` の食材・SVG・taxonomy 行は #584 から流用（コピー）される。
   - (b) shiso / whitebait / salmon-roe を Style Lock に追記する（§10.2）。
   - (c) **salmon / cream-cheese の専用 SVG 化を採用（Pilot D）。両食材に個別の 1.2em 補正を採用**（`.ingredient-glyph--<visual>` 個別クラス）。`cream-cheese.svg` の無描画 `<path>`（`stroke-width="0"`）は削除可（実装時に移植しない。見た目は不変）。
   - (d) **Pilot D の実装追跡先は Issue #623。着手は #621 の merge 後**（最新 main から。それまで runtime 実装は禁止）。
   - (e) **Pilot B は #438 の Owner HV 結果が記録されるまで HOLD。** 2026-10-22 時点で #438 / #417 に HV 結果の記録は無い。**PASS 扱いにしない（Owner 確認待ち）。**
   - (f) #468 / #478 は保留。見かけ補正 Candidate C（`?toppingScale=c`）の既定値は変更しない（Preview / DEV 限定のまま、本番は倍率表 B）。
   - (g) 本書の docs-only PR の作成を許可。**runtime 実装と merge は許可していない。**

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
| `cream-cheese` | クリームチーズ | cheese | **C1（2026-10-30 に A から差し替え）** | `cream-cheese.svg`（A 案の旧参照。現行の描画は `IngredientGlyph.tsx` の `CreamCheeseBlock`） | 温かい白の本体＋**下半分だけ銀紙**で包んだブロック（旧 A 案の「青みのある銀紙包みの角丸ブロック」は金属の缶に見えたため廃止） |
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
| `shrimp` | エビ | seafood | A → **§1d で変更（むきエビ）** | `shrimp.svg`（参照のみ。実装は `shrimp-curl` = むきエビ版） | 橙の丸まった海老（節・尾・目）→ 淡ピンクの身・橙の輪郭の細身 C 字（§1d） |
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

## 1d. 2026-10-25 Owner 決定 — `shrimp` を「むきエビ」に変更（`shrimp-curl`）

| 項目 | 内容 |
|---|---|
| 理由 | OS 絵文字・§1b 採用案（A）はどちらも**殻付きの赤橙の海老**に見える。レシピ側の意図は「殻と背わたを取ったえび」（`yuzu-shrimp-pizza`、`lateCatalog.ts`）で、PIZZA DB の説明とも合わない。Owner が比較試作で案1（細身 C 字）を採用 |
| 採用 | 比較試作 `shrimp-p1`（細身 C 字・淡ピンクの身・橙の輪郭）。案2（太め・節線）は不採用（28px でチーズ寄りに見え、20px で細部が潰れる） |
| `pieceVisual` | `"shrimp-curl"`（64×64） |
| Lock（§1b A 案）との**差分** | ① 色: 殻の橙〜赤（`#f8905e` / `#d9532c`、輪郭 `#8a2f1c`）→ 淡ピンク `#fdd9d0` ＋ 節 `#f2a99b`、輪郭は橙 `#e8793f` ② **削除**: 目（円）・触角・足 ③ 尾: 足つきの尾 → 小さな扇（`#f9b98f`）④ 白いハイライトを追加 ⑤ 構図（C 字の曲線 `M42 14C58 18 60 44 38 48 26 50 14 44 14 34`・64×64・床影）は維持 |
| 原典との関係 | 原典（PIZZA DB）の説明は「殻・背わたを取ったエビ」。むきエビ表現は原典に近づく方向。ただしアイコン指定は原典にないため提案の範囲（Owner 承認済み） |
| サイズ補正 | `.ingredient-glyph--shrimp-curl` を 1.2em / margin -0.1em（shiso 等と同じグループ）。クラスは `m` のまま |
| 影響レシピ | `pesto-gamberi`、`yuzu-shrimp-pizza`（描画のみ。判定・スコア・材料ID・レシピ・セーブ形式は不変） |
| 視認性 | 28px: 橙の輪郭でチーズ（クリーム〜白の楕円）と区別できる。20px: C 字の形が残る。焼成後（生地・チーズが黄色寄り）は淡色のコントラストがやや下がるが輪郭で判別可。**実機 HV で確認** |
| §2 の規約 | `id` / gradient / `<defs>` なし、`aria-hidden`、描画は `pieceVisual` のみを読む。いずれも維持 |

## 1e. 2026-10-28 Owner 決定 — Batch 10 の 3 食材（`pickles` / `wurstel` / `paprika-powder`）を専用 SVG に（Ingredient Visual V1、PR #690）

| 項目 | 内容 |
|---|---|
| 理由 | #686（Batch 10 PR-1）で入った 3 食材は絵文字の暫定表示（🍈 / 🌯 / 🟧）で、メロン・ブリトー・オレンジ色の四角に見えた（Fresh Visual Audit） |
| 採用 | `pickles` = `pickle-slices`（緑のガーキン + 波刃の輪切り）、`wurstel` = `wurstel-links`（切れ目入りの淡橙のソーセージ 2 本）、`paprika-powder` = `paprika-powder-pile`（赤い粉の小山）。Audit の候補をそのまま採用 |
| 採用の経緯 | 2026-10-27 Owner が暫定採用 → 2026-10-28 Owner の画像 HV（390×844 の焼成後の比較画像）で **A ピクルス / B ヴルステル / C パプリカパウダー すべて PASS**。サイズ補正 1.2em を維持 |
| `pieceVisual` | `"pickle-slices"` / `"wurstel-links"` / `"paprika-powder-pile"`（いずれも 64×64）。参照 SVG は `docs/design/references/ingredient-icons-2.0/` の `pickles.svg` / `wurstel.svg` / `paprika-powder.svg` |
| Lock（§1 / §1b）との関係 | Lock の 26 種の外にある新規 3 種。語彙は既存と同じ（2.4 基調の輪郭、2 トーン、足元の影楕円、`id` / gradient / `<defs>` なし）。Lock の既存 26 種は変更しない |
| サイズ補正 | `.ingredient-glyph--pickle-slices` / `--wurstel-links` / `--paprika-powder-pile` を 1.2em / margin -0.1em（**独立ルール**。shiso 等のグループには足していない） |
| 不変 | 食材 ID・`nameJa`・`emoji`（テキストフォールバック）・`color`・`placement`・family・サイズクラス・在庫・採点・DH4・レシピ・ladder・セーブ形式（描画のみ。`lateCatalog.offSurface.json` の再生成も不要） |
| HV の範囲 | 390×844 の焼成後の比較画像（Owner、2026-10-28）= PASS。360×800 は既存の撮影結果（`docs/reports/screenshots/ingredient-visual-v1/`、3 状態）を維持。**Safari 実機での動作確認は未実施** |
| §2 の規約 | `id` / gradient / `<defs>` なし、`aria-hidden`、描画は `pieceVisual` のみを読む。いずれも維持 |
| 既知の懸念（記録） | **360×800 のパプリカパウダー**は、トマトソース上の盤面で赤どうしになり小さく見えて目立ちにくい（トレイでは識別できる）。Owner 判断（2026-10-28）で描画変更は行わず、懸念として記録のみ（画像 HV は PASS、Safari 実機は未実施） |

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
| **B**（**HOLD**: #438 の Owner HV 結果の記録待ち） | `grana-padano`, `parmigiano`, `gorgonzola` | 形で区別する組（grana↔parmigiano）を同時に実機確認できる |
| **C** | `mozzarella` | 序盤の高露出具材（Starter Stock 等）。A / B で共通基盤が固まってから最後に切り替える |

Pilot A は共通基盤（型・viewBox 表・チーズ分岐変更・テスト更新）を含む。B / C は visual 追加のみ。残り 17 種（§1b）の Pilot 割当は未定（Owner が A〜C の HV 後に決める）。

**2026-10-22 追記: Pilot D = `salmon`, `cream-cheese`（Owner 優先、§0-7 / §10.3）。** 実施順は **D → B → C**。D は #621 の merge 後に着手（同じファイルに触れるため）。**B は #438 の Owner HV 結果が記録されるまで HOLD。** B / C の対象は変更しない。

**2026-10-31 追記: Pilot E = `green-pepper`, `bell-pepper`, `pineapple`（26 種の外、§11）。** 既存の B / C の対象と順序は変更しない（B は HOLD のまま）。E の着手は #709 → #708 の merge 後（ファイルが重なるため）。計画: [`TETO_INGREDIENT-ICON-2.0_PILOT-E_IMPLEMENTATION-PLAN.md`](../design/TETO_INGREDIENT-ICON-2.0_PILOT-E_IMPLEMENTATION-PLAN.md)。

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
- 実装は**最新 main** から開始する。実装 Issue は Owner が起票する（Pilot D = #623）。
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

## 10. 現行実装との照合・追加対象・規則（2026-10-22）

Base: `main` `d70bd20`。**決定は §0-7 が正本**（ここでは繰り返さない）。調査と比較の数値・画像は報告書にあり、本書は規則と状態だけを持つ:
[`TETO_INGREDIENT-VISUAL-LANE_Fresh-Audit.md`](../reports/TETO_INGREDIENT-VISUAL-LANE_Fresh-Audit.md)（棚卸し・PR 案）、[`TETO_INGREDIENT-VISUAL-LANE_SALMON-CREAM-CHEESE_Comparison.md`](../reports/TETO_INGREDIENT-VISUAL-LANE_SALMON-CREAM-CHEESE_Comparison.md)（Pilot D 比較）。報告書と本書が食い違う場合は本書が正。

### 10.1 実装状況（main）

| 区分 | 食材 | 状態 |
|---|---|---|
| 実装済み（26 種） | hot-dog, sausage, feta, ricotta（Pilot A） | main。`pieceVisual` あり。**Owner HV 結果は未記録（#438）** |
| 既存維持 | clam / tomato-slice / caper-cluster（32×32） | 変更なし |
| 実装済み（26 種の外） | shiso, whitebait | main（Batch 8b、OD-B8-2 amended）。§10.2 |
| 未マージ（26 種の外） | salmon-roe | main に食材 ID も SVG も無い。**#621 経由で入る**（#584 は HOLD） |
| **未実装（26 種のうち 21 種）** | Pilot B: grana-padano, parmigiano, gorgonzola（**HOLD**）／ Pilot C: mozzarella ／ Pilot D: **salmon, cream-cheese**（#621 の後）／ 残り 15: fontina, cashew-cheese, catupiry, pepperoni, bacon, ham, chicken, salami, prosciutto-crudo, pork, anchovy, sardine, tuna, shrimp, salt-cod | 参照 SVG は `docs/design/references/ingredient-icons-2.0/`（27 点: 25 + shiso + whitebait） |
| 未デザイン | goat-cheese（§9） | CSS 表示のまま |

### 10.2 追加対象（shiso / whitebait / salmon-roe）

Lock 由来ではなく **OD-B8-2 追記（Batch 8b / 8c）で認可された専用 visual** として、§1b と同じ扱いの追加対象にする。共通仕様（§2）に従う。

| ingredient id | 日本語名 | `pieceVisual` | 参照 SVG | 識別の要点 | 状態 |
|---|---|---|---|---|---|
| `shiso` | 大葉 | `shiso-leaf` | `shiso.svg`（main） | 鋸歯のある緑の葉 + 中央の葉脈 | 本番 |
| `whitebait` | しらす | `whitebait-school` | `whitebait.svg`（main） | 白い小魚 3 匹 | 本番 |
| `salmon-roe` | いくら | `salmon-roe-grains`（#584 での名称。#621 で確定） | `salmon-roe.svg`（**#584 ブランチにのみ存在。#621 の実装で main に入る**） | 橙の粒 6 つの小山 | #621 待ち |

- 参照 SVG 4 点（shiso / whitebait / salmon / cream-cheese）と salmon-roe の #584 版は、いずれも共通仕様（64×64、`id` / gradient / `<defs>` / `url(#` なし）に適合することを確認済み。
- **salmon-roe の参照 SVG は本書の PR では main に入れない**（#584 と add/add で競合するため。#621 が入れる）。最終デザインは #621 の Owner HV で確認され、**本書は確定しない**。
- サイズ補正: shiso / whitebait は `.ingredient-glyph--<visual>` の 1.2em（§3 追記）。クラス倍率は shiso = xs、whitebait = s。RESULT では ×0.75 も重なり、shiso の描画箱は約 17.6px。20px 未満での識別性は未計測。
- 色の住み分け: salmon-roe（橙の丸粒）と salmon（桃橙の切り身）は同系色。**形で区別する**（丸粒の山 vs 縞のある楕円）。焼けた生地（橙）に対する明度コントラストは低く、識別は暗い輪郭と形に依存する。

### 10.3b 2026-10-30 Owner 決定 — cream-cheese を C1 へ（Pilot D2、Issue #703）

実機画像で、A 案のクリームチーズが銀色の金属の箱・缶に見えたため、Owner が **C1 最終案**を承認した（形・色の変更。§1c の「Owner の明示承認」に当たる）。サーモンは変更しない。
- 本体: 前面 `#fff4e2`（承認案は `#fff1d2` だったが、焼成後のチーズ用フィルタ（brightness 1.06 / saturate 1.12 / sepia .14）で黄緑寄りのレモン色になりバターに見えたため、実装時に調整）、上面 `#fffcf4`、輪郭 `#7a6548`（2.4）、上面のハイライト `#f6e6bd`、前面の切り口の線 `#ecd9aa`。
- 銀紙: 前面の下約半分だけ。ぎざぎざの上端、`#d3d9df`、輪郭 `#6b7380`（2.2）、ハイライト `#f1f4f7`。
- 64×64、影楕円、`id` / gradient / `<defs>` なし。`pieceVisual` `cream-cheese-block`、食材 id、保存・レシピ・採点・在庫は不変。個別の 1.2em 補正（§0-7(c)）も維持。
- 比較資料: `docs/reports/TETO_INGREDIENT-VISUAL_PILOT-D2_Result.md`。

### 10.3 Pilot D = `salmon`, `cream-cheese`

決定は §0-7(c)(d)。ここには設計規則だけを置く。

1. 参照 SVG は §1b で採用済み（A 案）。**デザインは変更しない。** `pieceVisual` 名の案: `salmon-fillet` / `cream-cheese-block`（#623 で確定）。
2. 方式は Pilot A / 8b と同じ（`pieceVisual` 1 行 + visual コンポーネント + `VISUAL_VIEWBOX` に 64）。cream-cheese は `pieceVisual` ありのチーズとして §0-6 / §4.4 の経路（`.pizza-cheese` ラッパー内 SVG）に乗る。
3. 実装対象 4 ファイル: `ingredients.ts` / `IngredientGlyph.tsx` / `IngredientGlyph.test.tsx` / `App.css`（HOT）。`toppingSizeClass.ts` は変更しない（salmon = l、cream-cheese = l は既に表にある）。**4 ファイルとも #621（と #584）の変更と重なるため、着手は #621 の merge 後。**
4. 比較結果（数値・画像）と受け入れ条件は比較レポート §3〜§5 と Issue #623。**補正は 1.2em の個別クラス**で、Candidate C の倍率（Preview 限定）とは別の層。
5. Pilot D の HV は **iPhone Safari 実機を完了条件**とする（§10.5 の延期の対象外）。
6. 同一皿での混在（SL-4 の整理）: #621 の Owner 決定で、**E4b では「roe・shiso = 専用 SVG、salmon = 絵文字、cream-cheese = CSS 形状」の混在を暫定許容**。解消は Pilot D（#621 の後）。#621 の本番有効化（E5）前までに解消するかは、Owner の記録に無いため本書では決めない。

### 10.4 後乗せ（post-bake）層の描画規則（SL-3）

Cooking Steps の FINISH（`stage: "post"`）で置かれる piece の規則。**本番は OFF**（`FREE_COOK_FINISH_PRODUCTION = false`。main のコードで確認）。

- 後乗せ piece は `PostBakePiece` が専用の層（`.pizza-post-layer`、CUT 線より後ろ）に描く。焼成由来のスタイル（`toppingPieceStyle`、チーズの melt、Canvas mozzarella）は**届かない**。`IngredientPieceVisual` に `style` を渡さず、PREPARE と同じ未焼成の見た目を保つ。位置・回転・サイズ区分・RESULT の縮尺（#514）は焼成前の piece と同じ。
- したがって専用 visual の見え方は **焼成前（焼成フィルタあり）と後乗せ（フィルタなし）の 2 面**で確認する。§4.2-3 の接地影の判断と、コントラスト測定は 2 面に分ける。
- **salmon-roe は後乗せで使われるため、raw / perfect / burnt の 3 状態を再測定する**（#621 の AC-8。#584 の測定は焼成フィルタ内の見え方で、後乗せには流用できない）。shiso は焼成前（shirasu）と後乗せ（ikura）の両方で使われ、同じ食材が焼成の有無で見え方が違うのは意図どおり。
- 食材の「識別」（Research / Hint / Dex）は後乗せの有無を見た目から漏らさない（Anti-Oracle は別 authority。本書は見た目の規則のみ）。

### 10.5 HV 要件の延期（SL-6）— #621 に限る

§6 の「UI 変更は HV を完了条件に含む」に対する例外: **#621（FIN-E4b-ikura）は本番 OFF の間、実機動画の HV を延期し、E5（本番有効化）の前に必須とする**（#621 Q-8）。例外は #621 の PR 本文に明記する。**Pilot D（#623）には適用しない**（本番に出る描画変更のため、通常どおり HV 必須）。

### 10.6 テスト規約（SL-7）

`IngredientGlyph.test.tsx` の dedicated 集合（§6-1）には、Batch 8b で shiso / whitebait が追加済み。#621 は salmon-roe を、Pilot D は salmon / cream-cheese を、それぞれ自分の PR で追加する。「emoji 行 DOM 完全一致」（§6）は dedicated になった分だけ集合が変わる。

### 10.7 #621 設計報告の追補案（SL-1/2/3/6）との対応

出典: `claude/teto-pizza-cooking-audit-5qb1ol` の `docs/reports/TETO_COOKING-STEPS-NEW-PROCESSES_Phase1-Fresh-Design-Audit.md` §14.5（PR #620、未 merge）。**追補は並行作業で、#621 の merge の必須条件ではない**（#621 コメント）。

| 追補 | 本書での扱い |
|---|---|
| SL-1 Status / 実装状況 | ヘッダ、§0-7、§3、§4.1、§4.4、§5、§7、§10.1 で反映済み |
| SL-2 Batch 8 の専用 visual | §10.2 に反映（OD-B8-2 追記で認可。salmon-roe は #621 で main へ） |
| SL-3 後乗せ層の描画規則 | §10.4 |
| SL-4 同一皿での混在（Owner 判断） | §10.3-6（E4b では暫定許容。解消は Pilot D） |
| SL-5 1.2em 補正と G18 | 補正方式は §3。G18（グリフ一意性）の gate は実装 PR の AC（本書では内容を確認していない） |
| SL-6 HV の延期 | §10.5（#621 に限る） |
| SL-7 テスト規約 | §10.6 |
| SL-8 編集権限 | 本書は docs-only PR で変更する。#621 / #623 の実装 PR に混ぜない |

### 10.8 本版で直していないもの

- `docs/PROJECT_HANDOFF.md` の「Ingredient Icon 2.0」節（「Implementation has not started」ほか）は古いが、**HOT file のため本 PR では触れない**。別の docs-only PR（#621 / #584 の扱いが決まった後）で更新する。

## 11. Pilot E-0 追補（2026-10-31 Owner 決定、Issue #712）

Base: `main` `d044719`。**本節は Owner 決定の記録（docs-only）。** runtime・既存 SVG・ゲーム挙動は変更しない。§1b の既存承認（特に `chicken` = A 案ドラムスティック）は**一切変更しない**。比較の根拠と画像: [`TETO_PILOT-E0_ROUND2_Result.md`](../reports/TETO_PILOT-E0_ROUND2_Result.md)、候補 SVG: [`candidates/ingredient-icons-2.0-pilot-e0/`](../design/candidates/ingredient-icons-2.0-pilot-e0/)。

### 11.1 Owner 決定（2026-10-31）

| 項目 | 決定 |
|---|---|
| ピーマン `green-pepper` | **GP-A2（緑の細切り）を採用** |
| パプリカ `bell-pepper` | **BP-B2（赤の四つ割り）を条件付き採用。** 補正 **1.65em を起点**にサイズを確認する（20〜24px で小さくなる点が確認項目） |
| パイナップル `pineapple` | **PA-A2（外皮を弱めたくさび形）を採用。** **実機で「果肉としての識別性」を確認** |
| チキン `chicken` | **既存の承認（§1b A = ドラムスティック）を維持。** 骨なし候補 CH-B1 / CH-B2 は比較資料にとどめ、Owner の承認なしに変更しない |
| 焼成後の表現 | **保留**（#421 / PR #468 の方針確認まで実装しない） |
| NO_SAUCE の共通案内 | **N-A「塗らずに 次へ 進んでもOK」を条件付き採用。** INV-D4 / INV-D7 の追加検証が必要（本書の対象外。§11.7） |

### 11.2 追加対象（26 種の外。§10.2 と同じ扱い）

| ingredient id | 日本語名 | `pieceVisual`（案） | 候補 SVG（`candidates/ingredient-icons-2.0-pilot-e0/svg/`） | 識別の要点 | 状態 |
|---|---|---|---|---|---|
| `green-pepper` | ピーマン | `green-pepper-strips` | `green-pepper-a2-strips.svg` | 緑の弧状の細切り 3 本（先端に薄緑の断面） | Owner 採用。実装は Pilot E |
| `bell-pepper` | パプリカ | `bell-pepper-quarter` | `bell-pepper-b2-quarter.svg` | ヘタ付きの赤の四つ割り（薄橙の空洞と種） | **条件付き採用**（サイズ確認）。実装は Pilot E |
| `pineapple` | パイナップル | `pineapple-wedges` | `pineapple-a2-wedges.svg` | 輪切りを切り分けたくさび形 2 個（外皮の淡い帯と点、繊維の筋） | Owner 採用。実機で識別性を確認。実装は Pilot E |

- `pieceVisual` 名は**案**（id と独立の原則。実装 Issue で確定）。
- **参照 SVG（`references/ingredient-icons-2.0/`）への昇格は実装 PR で行う**（本書の PR は `candidates/` に置くのみ。`references/` は「採用済みで実装される絵」の置き場のため、bell-pepper のサイズ確認と最終形の確定を待つ）。昇格時のファイル名は `green-pepper.svg` / `bell-pepper.svg` / `pineapple.svg`。
- 作図仕様は §2 に適合（64×64、透明背景、線幅 2.4、接地影、`id` / gradient / `<defs>` / `url(#` なし、文字なし）。**11 点の候補 SVG すべてで機械的に確認済み。**
- 食材 id・`emoji`・`color`・保存・採点・レシピ・在庫・Dex は変更しない。

### 11.3 サイズ補正の起点（§3 の個別補正の延長。値は実装 PR の Human Verification で確定）

| 食材 | 起点 | 備考 |
|---|---|---|
| `green-pepper` | 1.45em + 負マージン（`-(em-1)/2`） | 仮合成で青ねぎ・ハラペーニョと釣り合った |
| `pineapple` | 1.45em | 同上 |
| `bell-pepper` | **1.65em** | 余白を増やして約 62% に縮めた絵のため。ピザ上では GP-A2 と釣り合うが、20〜24px では小さな赤い点になる。**小サイズでの読みやすさが条件** |

- 前例: 1.2em（shiso 等）、arugula 1.75em / `-0.375em`（`App.css`）。トレイ chip では別規則（arugula の例）が要るかを実装時に確認する。
- 補正値は、390×844 / 360×800 の実画面で、チップの高さ・幅・タップ領域を悪化させないことが条件。

### 11.4 既存承認との整合（確認結果）

| 確認 | 結果 |
|---|---|
| §1b の `chicken` = A 案ドラムスティック | **変更なし。** 骨なし化は、§1d / §10.3b と同じ手順（Owner の明示承認 → 本書に改訂を記録）が別途必要 |
| §1 / §1b の 25 種と、§10.2 の追加対象 | **変更なし。** 本節の 3 食材は 26 種の外（§10.2 と同じ追加扱い） |
| 色・形の衝突 | ピーマン↔青ねぎ（採用済み）は形で区別（細切り vs 輪の房）。ただし**緑同士で色は近く**（ΔE 14〜15）、識別は形に頼る。パイナップル↔フェタ（採用済み）は形・色とも別（形 0.26 / ΔE 62）。最近傍はフォンティーナ（形 0.42 / ΔE 14）で、外皮の濃い帯の有無で区別 |
| G18（グリフ一意性） | `emoji` フィールドは変更しない（🌶️ / 🫑 / 🍍 はテキストのフォールバックとして残る）ため影響なし |
| §7（実装は最新 main から。実装 Issue は Owner が起票） | 本節は実装を開始しない。Pilot E の実装 Issue は Owner が起票する（#712 は docs-only の追跡先） |
| 既存テストの意図 | 実装時、`ingredients.test.ts` の EMOJI_ROWS と `IngredientGlyph.test.tsx` の「approved emoji」から **pineapple を外す**変更が必要（意図的な pin の更新。計画書に記載） |

### 11.5 実装時の識別確認項目（Human Verification）
- ピーマン: 青ねぎ・ハラペーニョ（🟩）・パクチー・大葉・ピクルスと、32 / 28 / 24 / 20px で形が区別できるか。
- パプリカ: ピーマン（GP-A2）と並べて区別できるか。ペパロニ（赤い丸、色差 ΔE 16）と取り違えないか。トマト（`tomato-slice`）との比較は**未実施**（実装時に確認）。
- パイナップル: **実機（iPhone Safari）で「果肉」と認識できるか。** 葉つきの絵文字より離れて見たときに分かりにくくなる点を、トレイ chip（名前つき）・ピザ上・RESULT で確認。フェタ・コーン・フォンティーナ・カシューとの識別。
- 全体: Chromium / WebKit の 390×844 と 360×800、焼成前・焼成後（heat 適正）、RESULT、Dex、Shop、Research、Hint / Notebook。焼け過ぎ（heat 2.0）での見え方は未確認のため、実装時に確認。

### 11.6 保留
- **焼成後の表現**（焼き色・チーズとのなじみ・立体感）: #421 / PR #468（HOLD）の方針確認まで保留。本 Pilot では行わない。
- **チキンの骨なし候補**: 比較資料としてのみ保持。承認なしに変更しない。磨き込みも Owner の指示後。

### 11.7 NO_SAUCE（参照のみ。本書は決定の記録だけを置く）
N-A を条件付きで採用。契約（Anti-Oracle Contract 2.1 の INV-D4 / INV-D7）の追加検証が必要で、**実装はまだ行わない**。検討・検証計画: [`TETO_NO-SAUCE_COMMON-GUIDANCE_PROPOSAL.md`](../design/TETO_NO-SAUCE_COMMON-GUIDANCE_PROPOSAL.md)。実装 Issue は Owner が起票する。

### 11.8 編集権限
本節は docs-only の PR で変更する。Pilot E の実装 PR（`src` / CSS）に混ぜない（SL-8 と同じ扱い）。
