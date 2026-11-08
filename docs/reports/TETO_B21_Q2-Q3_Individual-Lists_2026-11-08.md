# B21 未承認事項の個別一覧 — Q-2（17 ID の Research 文字変化）と Q-3（暫定値）（#780）

2026-11-08 / main `348b1e4`。Owner 決定（2026-11-08）: **Q-1 承認済み**（taco・okonomiyaki は late カタログ、nori は後乗せ）。**Q-2 は個別一覧を提示し、個別承認が必要な変更はそれまで保留。Q-3 は具体的な一覧を提示し、未承認項目を確定扱いにしない。** 本書は一覧の提示のみで、B21 の HOT 編集・claim 投稿は**Q-2・Q-3 の承認まで行わない**。

## Q-2 Research 文字変化の個別一覧【実測】

測定: `stagedPromotion.firstTrain.test.ts`（main `348b1e4` で staged 9 ファイル 30 件合格を本セッションで再実行。golden `src/data/staged/__golden__/firstTrain.research.json` と一致）。

- **正準順（既存の ladder ＋ B21 の 2 つの late step）で出荷済みの文字が変わる件数: 0**（停止条件に当たらない）。
- **非正準順**（Batch 18/19 と同じ、材料をカタログ順と異なる順序で取得した場合の 10 シナリオ）で、出荷済み 17 レシピの Research Entry 文字が変わる。カタログ順どおりに進めたプレイヤーには**影響しない**。「なし」は同一の解放材料の兄弟がいない（文字なしの 1 品コホート）状態。

| # | レシピ ID | 変更前→変更後（シナリオにより複数） | 承認 |
|---|---|---|---|
| 1 | `baingan-bharta-pizza` | なし→A | □ 承認　□ 保留 |
| 2 | `california-style-pizza` | なし→A | □ 承認　□ 保留 |
| 3 | `chilean-napolitana` | なし→A | □ 承認　□ 保留 |
| 4 | `cuban-pizza` | なし→B、A→B | □ 承認　□ 保留 |
| 5 | `goulash-pizza` | なし→A | □ 承認　□ 保留 |
| 6 | `nigerian-suya-pizza` | なし→A | □ 承認　□ 保留 |
| 7 | `pesto-burrata-pizza` | B→C、C→D | □ 承認　□ 保留 |
| 8 | `pesto-caprese` | なし→A | □ 承認　□ 保留 |
| 9 | `pizza-alla-crudaiola` | なし→A | □ 承認　□ 保留 |
| 10 | `pizza-feta-eliniki` | B→C、C→D | □ 承認　□ 保留 |
| 11 | `porchetta-pizza` | なし→B、B→C | □ 承認　□ 保留 |
| 12 | `potato-mayo-pizza` | なし→B | □ 承認　□ 保留 |
| 13 | `reina-pepiada-pizza` | なし→A | □ 承認　□ 保留 |
| 14 | `rendang-pizza` | なし→A | □ 承認　□ 保留 |
| 15 | `tarako-cream-pizza` | なし→A | □ 承認　□ 保留 |
| 16 | `veggie-supreme-pizza` | なし→A | □ 承認　□ 保留 |
| 17 | `wasabi-beef-pizza` | なし→B、B→C | □ 承認　□ 保留 |

読み方: たとえば `pesto-burrata-pizza: B→C、C→D` は、非正準順では同じ解放材料のコホートに新しい兄弟が加わり、既存の文字が後ろにずれうることを示す。Research の文字は保存されない公開表示 ID（Research 2.0 OD-R2-2）で、保存データ・スコア・Pitz には影響しない。B19（#783 AC-8）と B20-A（承認表 10 ID）と同じ扱いで、**ID ごとの承認が必要**。承認が出た ID の集合が測定結果と 1 件でも違えば、B21 のテストは失敗して停止する（`expansionBatch21` 相当の ID 集合固定テストを B21 で追加）。

- 承認の形: 上の表の「承認」欄を Owner が埋める、または「17 件すべて承認」／「#3, #7 は保留」と書く。**保留の ID があれば、B21 はその ID に影響しない構成に変えられるか再測定してから進める**（勝手に承認扱いにしない）。

## Q-3 暫定値の具体一覧（すべて GAMEPLAY ASSUMPTION・原典 pizzadb.jp 未確認）

出所: `src/data/staged/stagedPromotionCandidates.ts`。共通: late カタログの 1 段、焼成窓 58〜78、報酬 100 Pitz、Lunch Rush なし、CUT なし、key-free Hint、アンロック ⭐0。

### 食材 6 種
| # | id | 名前 | 種別/配置 | 色 | 文字代替（非表示のフォールバック、G18 一意） | 専用 SVG（P-2、未配線） | 承認 |
|---|---|---|---|---|---|---|---|
| 1 | `cheddar` | チェダーチーズ | cheese / scatter | `#f2a33a` | 🔶 | `cheddar-cubes`（PROVISIONAL、パレット `#f2a33a`） | □ |
| 2 | `lettuce` | レタス | topping / scatter | `#9fd36b` | 🪴 | `lettuce-leaf`（`#9fd36b`） | □ |
| 3 | `tortilla-chips` | トルティーヤチップス | topping / scatter | `#e8c25a` | 🔺 | `tortilla-chip-triangles`（`#e3b955`、色が少し違う） | □ |
| 4 | `okonomiyaki-sauce` | お好み焼きソース | sauce / spread | `#5a3420` | 🍶 | なし（チップ面は別判断） | □ |
| 5 | `cabbage` | キャベツ | topping / scatter | `#c9e3a3` | 🥬 | `cabbage-shreds`（`#c9e3a3`） | □ |
| 6 | `bonito-flakes` | かつお節 | topping / scatter | `#c98f5a` | 🪶 | `bonito-flake-curls`（`#c98f5a`） | □ |

再利用（新規 id なし）: matrix の `salsa`→既存 `tomato-sauce`、`ground-beef`→既存 `beef`（I-1。重複 Gate 非該当を確認済み）。

### レシピ 2 品
| # | id | 名前 | 材料と数量（暫定） | 承認 |
|---|---|---|---|---|
| 7 | `taco-pizza` | タコピザ | tomato-sauce 1（塗る）／cheddar 2／beef 3／fresh-tomato 2／lettuce 2（後乗せ）／tortilla-chips 2（後乗せ） | □ |
| 8 | `okonomiyaki-style-pizza` | お好み焼き風ピザ | okonomiyaki-sauce 1（塗る）／cabbage 3／pork 3／mayo 1／bonito-flakes 2／nori 1（後乗せ）。**チーズなし**（行に無いため追加しない）。キャベツは焼成前（固有調理法、D-5） | □ |

説明文（Anti-Oracle: 調理時期・量を出さない）: taco =「牛ひき肉とチェダーに、レタスとトルティーヤチップスをあわせた一枚。」okonomiyaki =「お好み焼きソースにキャベツと豚肉、マヨネーズとかつお節をのせた一枚。」

### 未承認の扱い
- 上の 8 項目は**暫定のまま**。承認が出た項目だけが B21 の実装対象。名前・数量・文字代替・色のどれかが「保留」なら、その項目は B21 に入れない（または Owner の別案で置き換える）。
- SVG の色・形は P-2 により先行制作されるが、**配線は Q-3 の承認後**で、iPhone HV 前に確定扱いにしない。tortilla-chips の SVG 色はフォールバック色と少し違う（`#e3b955` と `#e8c25a`）ため、どちらに揃えるかも Q-3 の確認事項。

## 次の行動
Q-2・Q-3 の回答（表の □ を埋める、または包括の一文）を受けて、S1 が #780 に列車シリーズ claim を投稿し B21 を実装する。それまで HOT ファイルは編集しない。
