# 新食材描画 Fresh Visual Audit（Batch 10 PR-1 の 8 食材 + 既存 emoji 暫定表示）

Status: **調査と設計のみ（docs-only）。** `src/**`・CSS・テスト・データ・Preview は変更していない。merge・Monitor 作成なし。
基準: `main` = `c6a90e2`（#688、#686 取り込み済み）。作業ブランチ `claude/teto-pizza-visual-audit-g7wntq`。
Human Verification Policy: audit-only のため動画・Preview は対象外（`PROJECT_HANDOFF.md` の免除どおり）。比較シートは静止画 1 枚。

成果物:
- 比較シート（1 枚、修正 1 回）: `docs/reports/screenshots/ingredient-visual-fresh-audit/b10-ingredient-visual-comparison-sheet.png`
- 推奨 SVG 8 点（**候補・Owner 未承認**）: `docs/design/candidates/ingredient-visual-b10-fresh-audit/*.svg`

## 0. 方法と限界（先に明記）

- 実装調査: `ingredients.ts` / `IngredientGlyph.tsx` / `IngredientPieceVisual.tsx` / `bakeVisual.ts` / `toppingSizeClass.ts` / `App.css` を読んだ。
- 見え方: **ゲームを実起動していない。** 390×844・360×800 は #686 がコミット済みの `docs/reports/screenshots/expansion-batch10-pr1/b10-*` の目視と、ソース上のサイズ（ピース基準 28px × 倍率表 B: xs 0.7 / s 0.85 / m 1 / l 1.15 → 約 20 / 24 / 28 / 32px）から評価した。
- 焼成後: 実画面ではなく、`toppingVisualFrame(heat=2.0)` の値（brightness .78 / saturate .8 / sepia .2）を橙の生地色 `#d99a4d`（既存 baked スクショの実測 `(217,152,77)`）の上で再現した**近似**。チーズの溶け（`cheeseVisualFrame`）とソースのヒートマップ焼成色は再現していない。
- 色の ΔE は CIE76。塗布後のソース色は、#686 のスクショ実測から有効アルファ約 0.55 と推定（カレー実測 `(227,166,87)`、マスタード `(224,190,81)`、生地 `(234,201,141)`）。
- Style Lock v2 の豚肉・ハム・フェタ・フォンティーナ SVG は **Owner 採用済みだが `src/` 未移植**。比較シートでは参照アートとして載せている。
- GitHub の claim コメント（#611 / #578）は読んでいない。競合は open PR 一覧と #679 の変更ファイル一覧、`TETO_PR2-LATE4_DESIGN-GATE_2026-10-27.md` から調べた。

## 1. 描画方式の現状

| 経路 | 内容 |
|---|---|
| 唯一の入口 | `IngredientGlyph`（`pieceVisual` あり → インライン SVG、なし → `ingredient.emoji` の素のテキスト）。ピース・トレイチップ・ドラッグ preview・RESULT・Pizza Select・Inventory・Shop・Dex がすべてここを通る |
| 専用 SVG | 現在 15 種（main 12 + late 3）。`DedicatedIngredientVisual` の union、`VISUAL_VIEWBOX`、JSX の `&&` 連鎖、`App.css` の 1.2em 補正セレクタ（823–829 行）の **4 か所に追記**する方式 |
| チーズ | `pieceVisual` なし → `.pizza-cheese` の CSS 円（色 = `ingredient.color`）。あり（feta / ricotta）→ 同じラッパー内で SVG（`.pizza-cheese--glyph`、28px 固定ボックス） |
| 焼成 | トッピングは形不変で filter のみ（`toppingVisualFrame`）。チーズは溶け・色変化。ソースは `ingredient.color` のヒートマップ塗り（actually painted 色） |
| 新 8 食材 | **すべて emoji のみ**（`pieceVisual` なし）。#686 のコメントはいずれも「Provisional glyph（HV で確認）」 |

emoji の重複（`ingredients.ts` + `lateCatalog.ts`、全 83 件）: 🧀 ×13（mozzarella / gorgonzola / parmigiano / fontina / cashew / grana / cream / catupiry / feta / ricotta / goat / **paneer / swiss**）、🍅 ×3、🌿 ×2、🍃 ×3、🌱 ×2。feta / ricotta は SVG あり、他の 11 種のチップは同一の 🧀。

## 2. 食材別の問題一覧（新 8 食材）

評価軸: トレイ（白チップ・64px）/ 調理中（生地上・約 20〜32px）/ 焼成後（橙）。深刻度 H = 別物・誤認、M = 識別困難、L = 軽微。

| 食材 | 現状 emoji | 問題 | 深刻度 |
|---|---|---|---|
| **ピクルス** | 🍈 メロン（色 `#7a8f2a` の暫定。コメントに「melon-green stand-in」） | 果物に見える（ユーザー指摘どおり）。薄緑の網目で、きゅうりの酢漬けの要素（濃緑の皮・種・ブツブツ）が一切ない。ベジ系の 🥒（ズッキーニ）とも別物のまま。焼成後は褪せた緑茶色 | **H** |
| **ヴルステル** | 🌯 ブリトー | 別の料理（トルティーヤ包み）に見える。ソーセージ系（🌭 sausage 専用 SVG・🍢 hot-dog 専用 SVG）と並んで、ヴルステルだけ肉に見えない。チップでも具が見えて「ブリトー」と読める | **H** |
| **パプリカパウダー** | 🟧 橙の角丸四角 | 食べ物に見えず、「橙の板」。xs（約 20px）では UI の色タイルと区別がつかない。焼成後は filter で茶色の板になり、**焼け焦げた生地片**に見える。ベルペパー（🫑 パプリカ）との系統も表せない | **H**（視認性）|
| **牛肉** | 🐄 牛（動物全身） | 肉でなく**動物**。28px では白黒のまだら＝「牛の柄」。豚肉 🐖（豚）と対になる動物 emoji で、食材のシリーズとして不統一（ハム 🍖 / チキン 🍗 は料理の形） | **M〜H** |
| **スイスチーズ** | 🧀 | チップが他の 11 種のチーズと同一。**ピザ上は CSS の淡色円**（`#f1dfa0`）で、パニール（`#f6f1de`）・モッツァレラ（`#fdf6e3`）と並ぶとほぼ区別不能（#686 の cuban スクショでも黄白の円が 2 つ並ぶだけ）。「穴」というスイスの識別点が出ない | **M〜H** |
| **パニール** | 🧀 | 上記と同じ。さらに、パニールは**穴のない白い塊**なのに、🧀 は穴あきの黄色 wedge でスイスの特徴そのもの＝**意味が逆**（パニールに穴付きが出る） | **M〜H** |
| **カレーケチャップ** | 🍛 カレーライス皿 | 皿の料理になり、「ソース」でなく「完成料理」に見える。同じトレイの 🍅（トマトソース）・🫙（豆板醤）は調味料の形。塗布色 `#d9892b` は生地との ΔE ≈ 20 で、塗り後は薄橙。#686 スクショで塗り領域は読めるが弱い | **M** |
| **マスタード** | 🟡 黄丸（図形） | 食べ物でなく「黄色い丸」。トレイ内の他ソースが形を持つ中で唯一の図形。塗布後は生地と ΔE ≈ 23 の黄土色で、カレーケチャップと並ぶと**塗布色の ΔE は約 16〜18**（実測 17.8）。cuban の 1 ソースだけなら読めるが、HV 比較（`#d4b020` vs `#d9892b` の「ΔE ~27」）は未塗布の素の色での値で、塗布後は近い | **M** |

### 2.1 重点項目への回答

1. **ピクルスが果物に見える**: 原因は emoji の選択（🍈）そのもの。色の調整では直らない。→ 専用 SVG（ガーキン 1 本 + 波刃スライス 1 枚、濃い緑の皮・淡黄緑の断面・種の輪）。ズッキーニ 🥒 とは「表面のイボ + 波刃の縁 + 種の輪」で区別する。
2. **ヴルステル**: 🌯 を捨て、「切れ目（斜めの飾り包丁）の入った淡橙のフランクフルト 2 本」にする。hot-dog（均一な円 3 枚）・sausage（不規則な 2 塊、断面に粒）とは「丸ごと 2 本・細長い・斜め切れ目」で区別（グレースケールでも棒状の 2 本として残る）。
3. **パプリカパウダー**: 角丸四角をやめ、「赤橙の粉の小山 + 周囲に散る粉粒」。暗い赤の輪郭（`#6a1a0a`）と明暗 2 色の粒で、橙の生地・焼成後の茶色の上でも輪郭が残る。xs（約 20px）では山のシルエットのみ読めれば良い。サイズクラス `xs` は据え置き（§5 参照）。
4. **豚肉・ハム・牛肉の区別**: 現状は 🐖 / 🍖 / 🐄（動物 2・骨付き 1）で互いに別物には見えるが、**牛と豚が動物**で、肉として並べると系統が崩れる。さらに 🍖（ハム）と 🍗（チキン）は焼成後の濃い茶でシルエット・色がほぼ同じ。案は Style Lock v2 の語彙に合わせる: 豚肉 = 焼き皮付きポルケッタ断面（採用済み `pork.svg`、円・渦）、ハム = 骨付きもも（`ham.svg`、淡桃）、**牛肉 = 暗い赤褐色の厚切り 2 枚 + 白い脂身の縁・霜降りの筋**（新規）。明度が豚 > ハム > 牛の順でグレースケールでも分かれる。ベーコン（赤 + クリームの波帯）・サラミとは「霜降りの白筋 + 脂身の縁」で区別。
5. **スイスチーズとパニールの区別**: 形で分ける。スイス = **正方形のスライス 2 枚（大きな円形の穴）**、パニール = **角の立った立方体 3 個（穴なし、焼き目の茶筋）**。フェタ（採用済み、冷たいグレー輪郭の白い角切り 2 個）とは「暖色の輪郭 + 3 個 + 焼き目」で、フォンティーナ（採用済み、橙の皮の扇形）とは「正方形・皮なし」で区別。
6. **カレーケチャップとマスタードの色・質感**: 形で分ける（シルエットが変われば、塗布色が近くても取り違えにくい）。カレーケチャップ = **艶のある橙赤のソース（器に入った丸い水面 + 光沢 + スパイス粒）**、マスタード = **マット・太い黄色のジグザグ絞り**。色は**マスタードのみ `#d4b020` → `#e8c814` を推奨**（塗布後の ΔE がカレーとの間で約 16 → 約 24、生地との間で約 23 → 約 31。Owner 承認が必要）。カレー側を赤寄り（`#c9571e` 等）にする案は検討したが、**トマトソース `#c73b2e` と ΔE 17.9** まで近づくため採らない。

### 2.2 トレイ / 調理中 / 焼成後の比較

- **トレイ（64px、白チップ）**: emoji は Noto の彩色で十分大きく読めるが、**意味が合っていない**（メロン、ブリトー、牛、カレーライス）。専用 SVG は意味が合う代わりに、白地では淡色（パニール・スイス・ヴルステル）が弱く見えるため輪郭を濃く（`#6b4e22` 等、線幅 2.4〜2.6）している。
- **調理中（生地上、約 20〜32px）**: emoji は彩度が高く目立つ（🟧 `#ff9800` 級、🍈 淡緑）。SVG は小さくなるほど内部の細部が潰れる（牛肉の霜降り、スイスの穴、ピクルスの種）。シルエットが成立することを基準にした（Style Lock §2: 「20px では系統が識別できれば良い」）。
- **焼成後**: トッピング全般が茶に寄る（`sepia .2, brightness .78`）。emoji 側は 🟧 が茶の板、🍈 が泥色、🍛 が埃っぽい白に変質して**元の意味が消える**。SVG は暗い輪郭 + 2 トーンのため識別が残る。ただしパプリカパウダー（暗赤）と牛肉（暗赤褐色）は焼成後に近づく（§6 のリスク）。
- **ソースの塗布**: ソースは glyph ではなく `ingredient.color` のヒートマップで塗られるので、**glyph を SVG にしてもピザ上のソースの見た目は変わらない**。SVG 化の効果が出るのは Tray / Shop / Dex / Inventory のチップだけ。ピザ上の取り違えを減らすのは色（マスタードの `#e8c814`）。

### 2.3 390×844 と 360×800

- 描画サイズは viewport に依らず同じ（ピース基準 28px × 倍率）。360×800 ではピザ自体が 390 比で約 6% 小さい（スクショ: 直径 約 270 vs 288px）ので、**ピース間の余白が減る**。
- 比較したコミット済みスクショ（`b10-cuban-pizza-tray-topping`・`-topped`・`-sauce-painted`）は 390 / 360 とも**同じ構成**で、新たな崩れ（チップの折り返し・はみ出し）は見当たらない。チップは 360 で幅 約 108px（390 で約 118px）。
- したがって 360×800 固有の問題は**ない**。ただし最も小さい xs（約 20px → 360 ではやや小さい）のパプリカパウダーが両 viewport で最も厳しい。

## 3. 既存の暫定 emoji 表示（新 8 食材以外）

| グループ | 該当 | 問題 | 優先 |
|---|---|---|---|
| **全チーズ 🧀** | mozzarella / gorgonzola / parmigiano / fontina / cashew-cheese / grana-padano / cream-cheese / catupiry / goat-cheese（+ 新 2）。feta・ricotta のみ SVG 済 | チップ 11 種が同一。ピザ上は CSS 円の色違いのみ。Style Lock v2 で **Owner 採用済みの SVG が 8 種（mozzarella / grana / parmigiano / gorgonzola / fontina / cashew / cream / catupiry）あるが未移植**（goat-cheese は未デザイン） | 高（最大の未解決群） |
| 動物 emoji の肉 | pork 🐖 / lamb 🐑 / （新）beef 🐄 | 動物で、食材に見えない | 中（pork は採用済み SVG あり） |
| 肉の類似 | ham 🍖 / chicken 🍗 | 焼成後に同シルエット | 中（両方採用済み SVG あり） |
| 別物の emoji | prosciutto-crudo 🍥（なると）/ baked-beans 🫘 / sauerkraut 🥫（缶）/ palm-heart 🌴（ヤシの木）/ jalapeno 🟩 / pepperoni 🔴 / salami 🟤 / black-olive ⚫ / zucchini 🥒（きゅうり）/ pine-nuts 🌰（栗）/ almond 🥜（落花生） | 図形・缶・木など食材に見えないもの。prosciutto・pepperoni・salami・black-olive は採用済み SVG あり（Style Lock §1b） | 中〜低 |
| emoji 共有 | 🍅 ×3（tomato-sauce / cherry-tomato / fresh-tomato は SVG 済）/ 🌿 ×2（pesto / basil）/ 🍃 ×3 / 🌱 ×2 | 同一 emoji の別食材。トレイ内で並ぶと区別できない | 低〜中 |
| ソース | olive-oil 🫒 / pesto 🌿 / fromage-blanc 🥛 / doubanjiang 🫙 / tomato-sauce 🍅 | 形を持つが料理の emoji ではない。新 2 ソース（🍛 / 🟡）だけが外れている | — |

結論: **新 8 食材は「暫定の度合いが最も大きい」**（既存のどの暫定よりも誤認度が高い）。既存の暫定表示は大半が Style Lock v2 の採用済み SVG の移植待ちで、新規デザインは不要（移植コストのみ）。本 audit の対象範囲を超えるため、移植は §5 の「別枠」として記載する。

## 4. 推奨 SVG 表現

共通: viewBox 64×64、地面の影楕円（`#000` opacity .15）、線幅 2.4（粉・パニールは 2.4〜2.6）、2 トーン、`id` / gradient / `<defs>` なし（`IngredientGlyph` の既存規約と Style Lock §2）。**`pieceVisual` 名は ingredient id と独立**。サイズ補正（`.ingredient-glyph--<visual>` の 1.2em + -0.1em）が要るかは HV で判断する（既定は補正なし）。

| 食材 | `pieceVisual` 案 | 形・色（要点） | 識別のキー | ファイル |
|---|---|---|---|---|
| ピクルス | `pickle-slices` | 濃緑 `#6f9230` のガーキン 1 本（イボ・ハイライト）+ 波刃の円スライス 1 枚（皮 `#5f7d24`、断面 `#cfdc86`、種の輪 `#f4f2c0`） | 波刃の縁 + 種の輪 | `pickle-slices.svg` |
| ヴルステル | `wurstel-links` | 淡橙 `#e79a68` のフランクフルト 2 本、輪郭 `#7f3519`、斜め切れ目 `#b3582f`、端の締め | 細長い 2 本 + 斜め切れ目（hot-dog の円・sausage の塊と別） | `wurstel-links.svg` |
| パプリカパウダー | `paprika-powder-pile` | 赤 `#c4361a` の粉の小山、暗い輪郭 `#6a1a0a`、明暗の粒、周囲に散る粉粒 | 小山 + 散る粒（板状でない） | `paprika-powder-pile.svg` |
| 牛肉 | `beef-slices` | 暗い赤褐色 `#7a221e` の厚切り 2 枚、内側 `#c24a40`、脂身の縁 `#f4dcc8`、霜降りの白筋 | 脂身の縁 + 白筋（ベーコンの縞・黒オリーブの黒丸と別） | `beef-slices.svg` |
| スイスチーズ | `swiss-slices` | 淡黄 `#fbe99a` の正方形スライス 2 枚（厚みの側面 `#e0b84c`、大きな円形の穴） | 正方形 + 穴（フォンティーナの扇形・皮と別） | `swiss-slices.svg` |
| パニール | `paneer-cubes` | クリーム `#fff3c8` の立方体 3 個（側面 `#e3cf94` / `#c9b075`、暖色輪郭 `#6b4e22`）、天面に焼き目 `#a8641e` | 3 個の整った立方体 + 焼き目（フェタの 2 個・冷たい輪郭と別） | `paneer-cubes.svg` |
| カレーケチャップ | `curry-ketchup-bowl` | クリーム色の小鉢 + 橙赤 `#c9571e`/`#df7430` の光沢のある水面、スパイス粒、白いハイライト | 器 + 光沢（マスタードの絞りと別） | `curry-ketchup-bowl.svg` |
| マスタード | `mustard-ribbon` | 黄 `#ecc81a`/`#f3d52a` の太いジグザグ絞り 2 本、暗い黄褐の輪郭 `#7d6400`、マットな薄いハイライト | 絞りのジグザグ（器と別・グレーでも波形） | `mustard-ribbon.svg` |

- 比較シートで確認した事項: 白チップ 64px・生地上 28/20px・焼成後（近似）28/20px・グレースケール。**修正 1 回**: パニールの生地上コントラスト不足（輪郭を暖色の濃色へ、側面を濃く）、牛肉が黒オリーブ風に見えた（脂身の縁と白筋を追加）、カレーケチャップが茶色の塊に見えた（鉢 + 水面へ変更）、および推奨色パネルをカレー据え置きへ訂正（カレーを赤寄りにするとトマトソースに近づくため）。
- 未解決（HV 要確認）: ピクルスの 20px はきゅうりと読める程度で、ズッキーニ 🥒 との差は SVG の波刃に頼る。牛肉の 20px は「暗赤の小片」で、霜降りは潰れる。パプリカパウダーは焼成後に暗い茶の小山になり牛肉と近づく。
- パプリカパウダーは `bakeRoastResistant` を付けて焼け色を緩める案も HV で検討する余地がある（`bakeVisual.ts` の HERB 曲線。ハーブと同じ緩い曲線）が、今回は提案のみで、仕様変更は Owner 判断。

## 5. 優先度・実装工数

工数は S ≈ 0.5 日 / M ≈ 1 日（SVG 実装 + union・viewBox・JSX・CSS 補正・テスト更新 + 390/360 スクショ + HV 動画）。Owner の SVG 承認待ちは別。

| 順 | 食材 | 優先 | 工数 | 備考 |
|---|---|---|---|---|
| 1 | ピクルス | P0 | S | 果物誤認の解消（最重要の指摘） |
| 2 | ヴルステル | P0 | S | 別料理の解消 |
| 3 | パプリカパウダー | P0 | S | 視認性。`xs` → `s` へのクラス変更は不要（0.7 倍 = 約 20px のままシルエットで読める）が、HV で足りなければ `s`（`toppingSizeClass.ts` 1 行、Owner 判断） |
| 4 | 牛肉 | P0 | S | **PR-2 と重複（§7）。** 先に出す方が `beef-slices` を持つ |
| 5 | スイスチーズ + パニール | P1 | M | チーズの `pieceVisual` はピザ上でも SVG を描く（`.pizza-cheese--glyph`、28px 固定ボックス、`l` クラス 約 32px、溶け filter の影響）。2 種を同一 PR にして HV で並べて確認する（feta / ricotta の前例どおり） |
| 6 | マスタード色変更 + 両ソースのチップ SVG | P1 | S | 色は `ingredients.ts` 1 行（Owner 承認）+ チップ SVG 2 つ。色は #686 で「HV で確定」とされた暫定値 |
| — | 既存 emoji の採用済み SVG 移植（チーズ 8 / 肉 7 / 魚介 5） | 別枠 | 各 S〜M | 本 audit の範囲外。チーズ群を新 2 種と同時にやると PR が大きくなるので分ける |

## 6. リスク

- 新規 SVG 8 点は **Owner の見た目承認が前提**（Style Lock §1c: 形・色の変更は Owner 承認）。本書の SVG は採用済みではない。
- 焼成後の見えは近似であり、実機で調理 → 焼成を撮るまで確定しない（特にパプリカ・牛肉の近接）。
- マスタード色の変更は「#686 の Owner 承認済みの暫定色」を変えるので、Owner の再承認が必要。`ingredient.color` が採点・発見・テストの pin に使われているかは**未確認**（実装 PR の最初に grep で確認する。ソースの塗りヒートマップが使うことは `PizzaStage.tsx` で確認済み）。
- チーズを SVG 化するとピザ上の溶けの filter・Reference 経路（`renderPizzaVisualPieces`）・RESULT スケールに波及する（feta / ricotta は前例あり、#438 の Owner HV 結果が未記録）。

## 7. PR-2 とのファイル競合

ここでの PR-2 = Batch 10 PR-2（late 4 レシピ + 新 7 食材。設計は `docs/design/TETO_PR2-LATE4_DESIGN-GATE_2026-10-27.md`）と解釈した。別の PR を指す場合は指示してほしい。

### 7.1 競合するファイル

| ファイル | 本 audit の実装 PR | PR-2（設計書 §10-3 の claim 予定） | #679（BBQ、open） |
|---|---|---|---|
| `src/components/IngredientGlyph.tsx` | union 外の `VISUAL_VIEWBOX`・JSX 連鎖・新コンポーネントを追記 | 同（`beef-slices` / `wasabi-dab` / `cod-roe-mass` / `nori-strips`） | 同（cilantro、39 行変更） |
| `src/App.css` | 補正クラス（823–829 行のセレクタ群の末尾） | 同 | 同（3 行変更） |
| `src/data/ingredients.ts`（`DedicatedIngredientVisual`、各食材の `pieceVisual`） | 追記 | PR-2 の食材は `lateCatalog.ts` 側 | 2 行変更 |
| `src/components/IngredientGlyph.test.tsx` | 件数・一覧 | 同 | 1 行変更 |
| `docs/design/references/…` / candidates | 新規ファイル（衝突なし） | 参照 SVG 4 点 | `cilantro.svg` |

**競合は同一行の追記**（union 末尾・viewBox 表末尾・JSX 連鎖末尾・CSS セレクタ群末尾）に集中する。git は隣接行の追記を衝突として扱う。

### 7.2 `beef` の重複（要対応）

PR-2 の設計書（基準 `f243c52`、#686 の前）は「`beef` は main に無い・新規」としているが、**main には #686 で `beef`（🐄、family meat、step 58、size m）が既に追加済み**。PR-2 は `beef` を再定義すると id 重複で失敗する（`ingredients.ts` / taxonomy / size class に既存）。PR-2 の設計は「既存の `beef` に `beef-slices` の `pieceVisual` を付与する」へ書き直す必要がある。設計書の emoji 注意（🥩 は meat family 記号で G18 違反）は、既存 `beef` が 🐄 を持つので解消している。

→ **牛肉の SVG は PR-2 と本 audit の両方が `beef-slices` を提案している。** 先に出る PR が実装し、もう一方は取り下げる。推奨は本 audit 側（牛肉は既に main にあり、PR-2 の late 食材ではないため）。PR-2 の担当に連絡が必要（本セッションは GitHub への書き込みをしていない）。

### 7.3 回避策

1. **順序:** #679 の merge → 本 audit の実装 PR（V1 以降）→ PR-2。PR-2 は late catalog の step・floors・golden が #679 に直列依存（設計書 §9）で、すでに #679 待ち。本 audit の PR はデータ系を触らない（`ingredients.ts` の `pieceVisual` 追記と色 1 行のみ）ので、#679 の後に入れれば、PR-2 は取り込みで済む。
2. **隣接行を避ける:** 新コンポーネントは `IngredientGlyph.tsx` 末尾ではなく専用ファイル（例 `IngredientGlyph.b10.tsx`）に置き、`IngredientGlyph.tsx` 側は union / viewBox / JSX の各 1 行の登録に留める。CSS は既存セレクタ群に足さず、独立ブロックで追記する。登録行は #679 / PR-2 と**同じ位置に追記しない**（アルファベット順で中間に挿す等）。
3. **claim:** 着手前に #611 に `teto-claim`（files = `IngredientGlyph.tsx`・`App.css`・`ingredients.ts`・`IngredientGlyph.test.tsx`）。PR-2 の claim 予定ファイル一覧と重なるので、重複しない時期に取る。
4. **DH4 / golden / 件数 pin:** 本 audit の実装は食材・レシピ・step を増減しないので、`hint5.ladders55.json`・DH4 監査 JSON・`catalogLedger.test.ts` の件数 pin には**触れない**（PR-2 との競合なし）。ただし `IngredientGlyph.test.tsx` に `pieceVisual` の件数・一覧 pin がある場合のみ更新が要る。
5. **#540（Draft/HOLD）・#684:** `recipes.ts`・`recipeSauceProfiles.ts` 等のデータ系。本 audit は触らないので競合しない。

## 8. 独立 PR への分割案

すべて「#679 merge 後・最新 main から」。UI/UX 変更なので各 PR に Human Verification（390×844 の MP4 をユーザーへ直接、動画は commit しない + before/after スクショを `docs/reports/screenshots/<task>/` に commit）が必要（`TETO_HUMAN-VERIFICATION-POLICY.md`）。

| PR | 内容 | 変更ファイル | 工数 | 依存・注意 |
|---|---|---|---|---|
| **V0**（任意） | 本書 + 候補 SVG の docs-only 取り込み + Style Lock v2 追記（§10 に 8 種を「候補」として）| docs のみ | 0.2 日 | Owner の SVG 承認が記録できる。実装 PR の前提 |
| **V1** | ピクルス + ヴルステル + パプリカパウダー（3 種のトッピング SVG） | `IngredientGlyph(.b10).tsx`・`ingredients.ts`（3 行）・`App.css`・test | 1〜1.5 日 | 同系統（emoji → 専用 SVG、チーズ・ソース経路に触れない）。1 本の HV で 3 種を並べて撮れる |
| **V2** | 牛肉（`beef-slices`） | 同上（1 種） | 0.5 日 | **PR-2 と調整してどちらか 1 本に**（§7.2）。PR-2 が先に出るなら V2 は不要 |
| **V3** | スイスチーズ + パニール（チーズ `pieceVisual`） | 同上 + チーズ経路の確認（`.pizza-cheese--glyph`、Reference、RESULT） | 1〜1.5 日 | feta / ricotta の前例。#438 の Owner HV 未記録（Style Lock §0-7(e)）に注意 |
| **V4** | マスタード色（`#e8c814`）+ 両ソースのチップ SVG | `ingredients.ts`（色 1 行 + 2 行）・glyph・test | 0.5〜1 日 | **色は Owner 再承認**。ピザ上の塗り色の変化を 390/360 で確認 |
| 別枠 | 既存 emoji の採用済み SVG 移植（チーズ 8・肉 7・魚介 5） | — | 各群 1〜2 日 | 本 audit の対象外。V3 の後 |

各 PR は食材・レシピ・step・floors・golden・DH4 を変更しない純粋な描画 PR（セーブ互換・採点・発見への影響なし）。`pieceVisual` は identity と独立（`IngredientGlyph.tsx` の規約）。

## 9. Owner に確認したいこと

1. 本書の SVG 8 点の採用可否（特に牛肉・ピクルス・パプリカは小サイズでの見えが未確認）。
2. マスタードの色を `#d4b020` → `#e8c814` に変更してよいか（カレーは据え置き）。
3. PR-2 の `beef` の扱い（既存 `beef` に `pieceVisual` を付与、牛肉 SVG は本 audit 側 or PR-2 側のどちらか）。
4. 分割は V1〜V4 のうち、まず V1 のみで良いか。
