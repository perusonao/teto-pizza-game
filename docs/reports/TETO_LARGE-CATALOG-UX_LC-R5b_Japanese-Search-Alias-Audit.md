# Large Catalog UX — LC-R5-b Japanese Search Alias Authority Fresh Audit

Status: **READ-ONLY / docs-only audit.** production code / CSS / test / e2e / save 変更なし。PR なし。R5-a・R5-b 実装には触れていない。
機械可読の監査表: `docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R5b_JAPANESE-SEARCH-ALIAS-AUDIT.json`（既存の docs data 置き場に合わせた。`docs/data/` は repo に存在しない）。

## 0. Authority と方法

| Authority | branch | commit |
|---|---|---|
| LC-R5 Fresh Audit | `claude/lc-r5-fresh-audit-z4bga9` | `b584b7a` |
| LC-R5 Implementation Verification Plan | `claude/lc-r5-implementation-verification-jo557t` | `855e9fb` |
| LC-R5-b PreAudit（§15.2 / §15.4 / §16 G-D7 が本書の依頼元）| `claude/lc-r5b-pre-audit-mbinf3` | `c57548f` |

監査対象 main は `12725eb`（LC-R4 merged）。方法（すべて静的 + 既存コードの読み取り実行のみ）:

1. 現行 production 29 材料 = `src/data/ingredients.ts`。62 = `data/recipes/ingredient_master_catalog.json`。172 = `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` の全 172 行が参照する **distinct 168 ingredient id**。
2. 「別表記の根拠」は **repo に既にある証跡だけ**から集めた（§3）。**私（Claude）は読み・別名・漢字表記を 1 件も創作していない。** 証跡が無いものは「証跡なし」と書く。
3. 各（nameJa, 別表記）について、**実物の `src/logic/catalog/catalogText.ts` の `matchesSearch`** を `node --experimental-strip-types` で読み取り実行し、現行で当たるかを実測した（コード変更なし）。

## 1. 結論（要約）

1. **「たまねぎ → 玉ねぎ確定で 0 件」は実在し、Unicode 正規化では原理的に解けない**（漢字↔かなは辞書が要る）。実測: `たまねぎ` の名前に `玉ねぎ` は **不一致**、`卵` も `たまご` に **不一致**。
2. 既存の `readingJa?`（LC-OD-15）**だけでは動機の事例を解けない**。`readingJa` は「漢字を含む名前」に**かなの読み**を足す道具（名前=漢字 → 検索=かな）で、本件は逆向き（名前=かな → 検索=漢字）。`たまねぎ` の readingJa は `たまねぎ` で、`玉ねぎ` を含まない。
3. 問題は **3 種類**に分かれ、規模はどれも小さい（§4〜§7）:
   - **K（かな名 ← 漢字/別語で検索）**: production 29 のうち **2 件**（onion `玉ねぎ` / egg `卵`）。
   - **S（名前より長い別表記、`…チーズ` 付き）**: production 29 のうち **4 件**（mozzarella / gorgonzola / parmigiano / fontina）。
   - **R（漢字を含む名前 ← かなで検索）**: production 29 では **0 件**（全 29 名がかな/カタカナのみ）。62 では 6 件、172 では 32 件。**repo に読みの証跡は 0 件**。
4. **必要 alias の規模**: production 29 → **6 材料 / 6 表記**（21%）。62 → **15 材料 / 15 表記**。172 → **17 材料 / 17 表記**（証跡ベース。172 側は nameJa 自体が未確定なので下限）。**大規模な読み仮名システムは不要**（疎なテーブルで足りる）。
5. **推奨: B（検索専用の別 authority map）。ingredientShelf.ts と同型**（id キー、`INGREDIENTS` に対する fail-closed な検証テスト、catalogSource が値を copy するだけ）。alias の値は **Owner 承認済みの出所からのみ**入れる。docs 上の staging には本書の JSON を使う。
6. **alias の値そのものは Owner がまだ承認していない**（本書の候補はすべて `PROPOSED_NOT_OWNER_APPROVED`）。よって **VERDICT = B. OWNER DECISION REQUIRED**（§13）。

## 2. 現行データの実物（field 棚卸し）

### 2.1 production ingredient（29 件）

`Ingredient` 型の field（`src/data/ingredients.ts`）: `id, category, nameJa, color, emoji, placement, unlockCondition?, pricePitz?, restockQuantity?, starterGrantOnly?, bakeRoastResistant?, pieceVisual?`。**`nameEn` / `label` / `alias` / `reading` 系は存在しない**（grep 0 件、`ingredients.ts` の `alias` は `fresh-tomato` の注記コメント 1 行のみ）。

- 名前の文字種: **全 29 件がかな/カタカナのみ**（カタカナ 24・ひらがな 5、漢字 0、ラテン 0）。
- `catalogSource.runtimeCatalog()` は `id/category/nameJa/shelf/catalogIndex` だけを `CatalogIngredient` に写す。**`readingJa` は本番で 1 件も設定されていない**。
- `src/data/ingredientTaxonomy.ts` / `ingredientShelf.ts` の `labelJa` は **棚（フィルタ）のラベル**であり材料の別名ではない。

### 2.2 `catalogText.ts` の現状

`normalizeForSearch`: NFKC → lower → カタカナ→ひらがな → `ー`/空白/`・` 等の除去。`matchesSearch` は **正規化後の substring**（`nameJa` と任意の `readingJa`）。**query が name の部分文字列であること**が条件（name が query を含む）。→ 「名前より**長い** query」は当たらない（S 種）。

`compareReading` は `readingJa ?? nameJa` を **並べ替え**に使う。**`readingJa` を検索 alias に流用すると sort 順も変わる**ので、alias は別 field に分ける方が安全（§9）。

### 2.3 テスト内の「茄子」に注意

`catalogQuery.test.ts` / `catalogText.test.ts` の fixture にある `nameJa:"茄子", readingJa:"なす"` は**合成 fixture**であり repo 内に他の出所が無い。**alias の証跡として扱わない**（production の eggplant は `ナス`、master catalog は `なす`。この 2 つは正規化で同一になり alias 不要）。

### 2.4 62 catalog（`ingredient_master_catalog.json`）

field: `id, nameJa, nameOriginal(英), aliases[], category, placementType, inventoryUnit, usedByRecipeIds, existingInGame, …`。
- `aliases` は 62 件中 **3 件だけ非空**: `ham→["prosciutto cotto"]`, `bell-pepper→["peperoni (vegetable, …)"]`, `prosciutto-crudo→["prosciutto"]`。**すべて英語/イタリア語で日本語 alias は 0 件**。
- 仕様は `docs/design/TETO_RECIPE-MASTER-CATALOG.md` §139: 「**重複した材料登録を防ぐため**の別名」。**検索 UX 用の意味ではない**。JSON は src に未接続。
- production との差: 62 ∩ production = **26**、production のみ **3**（`capers`, `clam`, `fresh-tomato`）、62 のみ **36**。和集合 **65**。nameJa の不一致は `eggplant`（`ナス` vs `なす`）の 1 件のみ（正規化で同一）。

### 2.5 172 authority

- 172 行が参照する distinct id は **168**。production ∩ 168 = 27、62 ∩ 168 = 51、**production でも 62 でもない id = 114**。
- 168 のうち **4 id（`cheddar`, `curry-ketchup`, `ground-beef`, `salsa`）は authority のどこにも nameJa が無い**（Phase 0B が id だけ導入。`LIKELY_ALIAS_TABLE` の値側に出てくるのみ）。→ **nameJa 未確定の id に alias を付けることはできない**（alias は「確定した名前に対する別表記」）。
- 172 側の材料名（`nameJa`）は**取り込み元 PIZZA DB のトークンの初出**であり、**承認済みの表示名ではない**。
- `TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json` の 105 材料は 168 の部分集合（103）+ production のみの 2（`cherry-tomato`, `pesto`）。検索 alias の母集団としては 168 を使う。

## 3. 既存の「別表記」の出所（唯一の証跡）

repo で日本語の別表記を人間がレビュー可能な形で持っているのは、**Progression 2.0 の取り込みツール**だけである。

| 出所 | 性質 | 件数 | 検索 alias の権威になれるか |
|---|---|---|---|
| `tools/progression2_ingredient_canonicalizer.py` `ORTHOGRAPHIC_EQUIVALENTS`（rule 1b）| 「同一語の表記揺れ」（`玉ねぎ→たまねぎ`, `卵→たまご`, `海苔→のり`, `蜂蜜→はちみつ`, `モッツァレラチーズ→モッツァレラ`, `ナス→なす`, `イチゴ→いちご`, `リコッタ→リコッタチーズ`）| 8 | **証跡としては最強**（PR #183 で Owner レビュー済みの docs tooling）。ただし方向は「取り込み元 → 既存 nameJa」で、**runtime 用ではない**（Python・src 未接続・キーが id でなく nameJa）|
| 同 `LIKELY_ALIAS_TABLE`（rule 2）| 別語/接尾辞違い。**各行に根拠コメント付き**、ただし `confidence-flagged`（`オリーブ→black-olive` 等）| 20 | 証跡にはなるが、**同一性が確定していないものが混じる**（`甘めのトマトソース`＝派生、`オリーブ`＝色不明）。個別に Owner 承認が必要 |
| 同 `AMBIGUOUS_TABLE`（rule 3）| `肉` `チーズ` `唐辛子` `ひき肉` `ナッツ` `チーズソース` …**総称/クラス語** | 14 | **alias にしてはいけない**（§10 Hint5 境界）|
| `PHASE0B1_ingredient-universe-diff.json` / `PHASE0B3_canonicalization-results.json` / 172 matrix `tokenTrace` | 取り込み元の実際の表記と canonicalId の対応（例: `玉ねぎ` は 172 中 37 回出現）| 36 + 145 + 全 172 行 | **観測された表記**の証跡（誰が実際にその表記で書くか）|
| `ingredient_master_catalog.json` `aliases` | 重複登録防止。日本語 0 | 3 | **不適**（意味が違う・空）|
| レシピ側 | `pizza_master_catalog.json` の `aliases` は**英語のピザ名**。`src/data/recipes.ts` に alias 無し | — | **不適**（対象がレシピ）|

> 重要: これらの表記は **「その表記が材料 X を指す」という同一性の証跡**であって、「検索でその表記を許可する」という**プロダクト判断ではない**。後者は Owner 承認が要る（§13）。

## 4. 問題の分解（実測）

| 種 | 例（production）| 現行 `matchesSearch` | 正規化で解ける？ | 必要な道具 |
|---|---|---|---|---|
| **F（正規化で同一）** | `ナス`/`なす`、`あさり`/`アサリ`、`ﾍﾞｰｺﾝ`/`ベーコン`、`ジャガイモ`/`じゃがいも`、`タマネギ`/`たまねぎ`、`たま ねぎ` | **一致** | 既に解決済み | 不要 |
| **P（部分一致で足りる）** | `オリーブ`→`ブラックオリーブ`、`トマト`→`トマトソース` 等 | **一致** | 既に解決済み | 不要（alias を足しても冗長）|
| **K（かな名 ← 漢字）** | `玉ねぎ`→`たまねぎ`、`卵`→`たまご` | **不一致** | **不可**（辞書が要る）| alias（別表記 list）|
| **S（query が name より長い）** | `モッツァレラチーズ`→`モッツァレラ` 他 | **不一致** | 不可（部分一致は name ⊇ query）| alias。**alias があれば query が alias の部分文字列で当たるので、途中入力 `モッツァレラチ` も自然に当たる** |
| **R（漢字名 ← かな）** | `生ハム`←`なまはむ`、`粉砂糖`←`こなざとう` | **不一致** | 不可 | reading（Owner 供給。証跡 0 件）|

`ペペロニ`(`ペパロニ`)、`パルメザン`、`ニンニク` 以外の綴り違い等の **typo / 表記揺れの一般知識ベースの別名は repo 内に証跡が無い**（grep 済み: `ペペロニ` `パルメザン` `馬鈴薯` `大蒜` `玉葱` `ジェノバ` すべて 0 件）。**本書はそれらを候補にしない**。必要なら Owner が指名し、その時点で Owner 承認済みの出所になる（§9 契約 R2）。

## 5. production 29 材料 — 別表記が必要な材料の一覧

（JSON の `production29` に 29 件全行あり。ここでは判定のみ。）

**別表記が必要（証跡あり・PROPOSED）— 6 材料 / 6 表記**

| id | 現行 nameJa | 別表記（証跡どおり）| 種 | 現行 hit | 証跡 tier |
|---|---|---|---|---|---|
| onion | たまねぎ | **玉ねぎ** | K | ✗ | T1 orthographic（rule 1b）+ 172 中 37 回出現 |
| egg | たまご | **卵** | K | ✗ | T1 orthographic（rule 1b）|
| mozzarella | モッツァレラ | **モッツァレラチーズ** | S | ✗ | T1 orthographic（rule 1b）。172 中 117 回出現 |
| gorgonzola | ゴルゴンゾーラ | ゴルゴンゾーラチーズ | S | ✗ | T2 likely_alias（チーズ suffix 変種）|
| parmigiano | パルミジャーノ | パルミジャーノチーズ | S | ✗ | T2 likely_alias |
| fontina | フォンティーナ | フォンティーナチーズ | S | ✗ | T2 likely_alias |

**別表記が現行で既に当たる／alias 不要（証跡あり）— 4 材料**
`eggplant`(`なす`=F)、`clam`(`アサリ`=F)、`black-olive`(`オリーブ`=P)、`tomato-sauce` の `甘めのトマトソース`（**alias 化しない**: 甘い派生であり同一性が違う。query が長いため一致もしない。**除外理由を JSON `excludedFromAlias` に記録**）。

**証跡のある別表記なし — 19 材料**
`olive-oil, pesto, basil, garlic, oregano, cherry-tomato, mushroom, sausage, pepperoni, anchovy, tuna, rosemary, bacon, ham, capers, corn, fresh-tomato, pineapple, potato`。
これらに「ありそうな別表記」（`ニンニク` は正規化で同一、`馬鈴薯`/`大蒜`/`ペペロニ` 等）はあるが、**repo 証跡が無いので本書は挙げない**。→ Owner が要否を判断する（§13 OD-A2）。

**R 種（漢字名 ← かな）: production 29 では 0 件。** よって **R5-b の日本語検索スライスに読み（reading）の authoring は要らない**。

## 6. 62 材料の規模

| 項目 | 件数 |
|---|---|
| 62 材料 | 62 |
| 証跡のある別表記が現行で**不一致**（alias 提案）| **15 材料 / 15 表記**（= production の 6 + `honey 蜂蜜`, `nori 海苔`, `porcini ポルチーニ茸`, `chicken 鶏肉`, `ricotta-salata …チーズ`, `caciocavallo カチョカヴァッロチーズ`, `cilantro コリアンダー`, `spicy-salami サラミピカンテ`, `nutella-spread ヘーゼルナッツチョコレートスプレッド`）|
| 証跡 tier | T1 orthographic **5**（玉ねぎ・卵・海苔・蜂蜜・モッツァレラチーズ）、T2 likely_alias **10** |
| R 種（名前に漢字）| **6**: `prosciutto-crudo 生ハム`, `spicy-salami サラミ（ピリ辛）`, `breadcrumb パン粉`, `steak ステーキ肉`, `teriyaki-sauce 照り焼きソース`, `powdered-sugar 粉砂糖`（+ Latin 名 `BBQソース` は `ビービーキュー` で不一致だが本書では別枠）|
| 現行で解決済み（F/P）| 上記以外 |

注意: T2 の `コリアンダー→cilantro`、`ヘーゼルナッツチョコレートスプレッド` 等は**別語/語順違い**で、同一性の判断が入る。**T1 のみを既定候補**とし T2 は個別承認とするのが妥当。

## 7. 172 — 未完成なので「将来の authoring contract」だけ定義する

- 172 側の既存証跡で alias 提案になるのは **17 材料 / 17 表記**（62 の 15 + `shiso 大葉`(T2) + `green-onion 万能ねぎ`(T3: 取り込みトークンのみ・分類証跡なし)）。ただし **168 のうち 138 id は第二の表記の証跡が無い**（nameJa 自体が取り込み初出トークンで未承認）。**172 の全 alias を今作る根拠は無い → 作らない**。
- R 種: 172 の名前が漢字を含む id は **32**（`牛肉`, `豚肉`, `大根`, `納豆`, `豆板醤`, `柚子胡椒` …）。**読みの証跡 0 件**。nameJa 確定時に Owner が読みを供給する。
- 4 id は nameJa 自体が無い。

### 7.1 将来の authoring contract（172 用、値は含まない）

| # | 契約 |
|---|---|
| **C1 同一性のみ** | alias は「その 1 つの材料の同一語の別表記」だけ。**総称・クラス・棚名・料理名・派生・複数材料を指す語は禁止**（`AMBIGUOUS_TABLE` 14 語、棚/family/class ラベル、`甘めのトマトソース` 型の派生）。 |
| **C2 証跡 or Owner 指名** | 値は (a) 既存 evidence ファイルに**そのまま存在**するか、(b) Owner が明示指名したもの。Claude / 実装者が一般知識で足さない。各 alias に `provenance`（出所ファイル+tier または `owner-nominated`）を必須にする。 |
| **C3 nameJa 確定が先** | nameJa が承認されていない id に alias を付けない。alias は承認済み nameJa **に対する**別表記。 |
| **C4 ship 時に一緒に承認** | 材料が `INGREDIENTS` に入る PR で、その材料の alias も Owner 承認を経て入れる。**未 ship の材料の alias は本番 bundle に入れない**（docs の staging JSON に留める）。 |
| **C5 冗長禁止** | alias 正規化後が nameJa 正規化後と同一、または nameJa で既に部分一致する alias は入れない（P/F 種）。 |
| **C6 疎** | 全材料に alias を要求しない。空が既定（現行の証跡率: 29→21%、62→24%、168→約 10%）。 |
| **C7 読み（R 種）** | 漢字を含む nameJa の読みは **Owner 供給のみ**。ひらがな。 |
| **C8 検証の自動化** | §12 のテストを alias 追加の必須ゲートにする。 |

## 8. 選択肢の比較

評価: ◎ 良 / ○ 可 / △ 難あり / ✗ 不可。

| 評価軸 | A. ingredient data に `searchAliasesJa`/`readingJa` | B. 検索専用の別 authority map | C. 既存 alias authority 再利用 | D. Unicode/正規化のみ | E. B + descriptor 経由の最小接続（=推奨形）|
|---|---|---|---|---|---|
| SSOT | ○ 1 行に集約。ただし gameplay 型に検索用途が混ざる | ◎ ingredientShelf と同型の「検索 alias の唯一の場所」 | ✗ 意味の異なる 3 系統（重複防止 / 取り込み用 Python / 英語 alias）に分裂 | — | ◎ |
| 推測不要 | ○（人が書く）| ○（人が書く + provenance 必須）| ○ 既存値だが「検索許可」の承認が別途要る | ✓ 値が無い | ◎ provenance を型で強制 |
| 29→62→172 拡張 | △ 62/172 は `INGREDIENTS` に未存在。ship 前の置き場が別に要る | ◎ 疎テーブル。key ⊆ `INGREDIENTS` を検証、未 ship は docs staging | △ Python/JSON は未接続で bundle 不可 | ✗ 拡張しても K/S/R が解けない | ◎ |
| authoring 負荷 | ○ 同じ行に書ける | ○ 1 表のみ（現時点 6 行）| △ 型/意味の変換作業 | ◎ ゼロ | ○ |
| typo/表記揺れ | ○ alias で | ○ | ○ | △ 全半角・かな/カナ・長音・空白のみ | ○ |
| kanji/kana | ○ | ○ | ○ | **✗（玉ねぎ不可）** | ○ |
| katakana/hiragana | ○（重複不要）| ○ | ○ | ◎（既に実装済）| ◎ |
| 長音/空白 | ○ 既存正規化を共有 | ◎ 既存正規化を共有 | ○ | ◎ | ◎ |
| privacy | ○ 行ごと shipping | ◎ 検索は所持のみ・値は同一性のみ。別ファイルで境界テスト可能 | △ 未 ship 材料の値が混入しやすい | ◎ | ◎ |
| Hint5 leakage | ○ | ◎ 禁止語彙リストと**別モジュール**で境界テスト | △ `AMBIGUOUS_TABLE` と同居 | ◎ | ◎ |
| save 互換 | ◎ 影響なし（save は id のみ）| ◎ 影響なし | ◎ | ◎ | ◎ |
| deterministic testability | ○ | ◎ 純データ表テスト | △ | ◎ | ◎ |
| 変更範囲/リスク | △ `Ingredient`（経済/在庫/価格の共有型）を触る | ◎ 新規 data + catalogSource の 1 行 | ✗ 大 | ◎ | ◎ |

**判定**
- **A**: 動くが、`Ingredient` は解錠・価格・在庫・描画が共有する中核型で、検索 UX の field を足すのは責務混在。ingredientShelf 導入時に「メンバーシップは別 authority」と決めた既存方針（`catalogTypes.ts` 冒頭コメント）とも逆。**採用しない**（ただし次善）。
- **B**: 既存 architecture に最も合う。**推奨**。
- **C**: **runtime SSOT としては不採用**。ただし**証跡（provenance）の供給源としては使う**（§3）。特に master catalog の `aliases` は「重複登録防止」の意味で、検索 alias に転用すると意味が汚れる。
- **D**: 単独では **K 種 0/2 を解けない**。既に実装済みの F/P 部分は維持。**S 種だけなら「逆方向の部分一致（query ⊇ name）」で解けるが**、`ブラックオリーブオイル` が `ブラックオリーブ` と `オリーブオイル` の両方に当たる等の予期しない一致を生み、新しい match 規則（Gate §10「新 operator なし」に抵触し得る）なので**推奨しない**。
- **E**: B の値を `CatalogIngredient` の**新 field（例 `aliasesJa?`）**として `catalogSource` が copy（`shelf` と同じ経路）、`matchesSearch` が `nameJa`/`readingJa`/`aliasesJa` の**いずれかの部分一致**を見る。**`readingJa` とは別 field**にして `compareReading` の並びを変えない。`catalogText` は純関数のまま。

## 9. 推奨（B/E の具体形。実装は R5-b の別スライス）

- 置き場: `src/data/ingredientSearchAliases.ts`（仮称、id キーの疎テーブル `Record<id, readonly {alias, provenance}[]>`）。`ingredientShelf.ts` と同格の data authority。
- 接続: `catalogSource.runtimeCatalog()` が値を copy（catalog モジュールが許可されている import に本 module を 1 つ加える。境界テストの更新は R5-b 側）。
- 既存 `readingJa?` は**変更しない**。R 種が将来必要になったら、**Owner 供給の読み**を同じ table の別 kind で扱うか `readingJa` に入れるかは、その時に決める（production 29 には R 種が 0 件なので R5-b では不要）。
- **R5-b の最小スコープ**: T1（5 表記）のうち production に存在する 3（`玉ねぎ`, `卵`, `モッツァレラチーズ`）+ Owner が承認した S 種。T2 は個別承認。

## 10. privacy / Hint5 / Discovery / save の境界

- **Discovery/privacy**: 検索は `queryCatalog` が **owned のみ**を最初に絞る（PreAudit §6.11）ので、**未所持材料の alias は結果に現れない**。alias の**値は材料自身の別表記**であり、レシピ id / `usedByRecipeIds` / discovery 状態 / hint target を**一切含まない**。B の module は `recipes` / `discoveryCatalog` / `hints` / `state/discoveryHint` を import しない（既存 `catalogBoundary.test.ts` と同じ形で機械検証できる）。**未 ship 材料の alias は bundle に入れない**（C4）ので、未発売材料の存在が alias から漏れない。
- **Hint5 taxonomy**: 棚/family/class のラベル（`肉` `魚介` `野菜・きのこ` `果物` `ハーブ・香味` `スパイス・薬味`、`肉系` 等）と `AMBIGUOUS_TABLE` の総称語は **alias にできない**（C1）。alias を許すと「`肉` と打つと肉系の所持材料が全部出る」= 属性検索になり、Gate §10「属性検索なし」と Hint5 の段階開示に反する。現行の `肉` 検索が `ステーキ肉` に当たるのは**名前の部分一致**であり alias とは無関係。
- **save**: `persistence.ts` が保存するのは ingredient **id**（`schemaVersion: 2` の `inventory: Record<id, number>` 等）。`nameJa` は保存されない。**alias は data のみ → save schema 変更なし・migration 不要**。alias の追加/削除で既存 save は壊れない。
- **副作用なし**: alias は表示に使わない（画面上の名前は `nameJa` のまま）。

## 11. IME との関係（PreAudit §6.12 I-2 の解消経路）

漢字変換中の `input.value` が `玉ねぎ` になる場合、alias に `玉ねぎ` があれば**変換途中でも確定後でも 1 件に絞れる**（query が alias の部分文字列なので `玉` だけでも当たる）。alias が無い材料の変換候補では 0 件になるため、**H-5 の合格条件は「Owner が承認した alias の範囲で、漢字確定でも当たる」**に置き換えるのが妥当。alias 未承認の材料は従来どおり（名前が kana のみ）。composition 中の filter 凍結（I-1）は G-D5 の実測課題で、本書の範囲外。

## 12. 決定的なテスト（B/E を実装する時のゲート案）

| # | テスト | 目的 |
|---|---|---|
| T-1 | 全 key ∈ `INGREDIENTS` の id、重複 alias なし | 孤児/未 ship の混入防止 |
| T-2 | 各 alias の `normalizeForSearch` が非空 | 空一致（全件ヒット）事故防止 |
| T-3 | alias 正規化後 ≠ nameJa 正規化後、かつ `matchesSearch(nameJaのみ, alias)` が **false**（冗長禁止）| C5 |
| T-4 | alias 正規化後が他材料の nameJa/alias と**衝突しない**（意図した衝突は許可リスト）| 別材料への誤ヒット防止 |
| T-5 | alias ∉ 禁止語彙（棚/family/class ラベル、`AMBIGUOUS_TABLE` 総称語）| C1 / Hint5 |
| T-6 | 全 alias に `provenance` があり、`owner-approved` 以外は本番 table に無い | C2 / C4 |
| T-7 | `catalogSource` の値が table と一致、`shelf`/`readingJa` 無変更 | 接続 |
| T-8 | golden: `玉ねぎ`→onion、`卵`→egg、`モッツァレラチーズ`→mozzarella、`たまねぎ`/`ﾀﾏﾈｷﾞ`→onion、`ペペロニ`→（table に無ければ）0 件 | 決定性 + 「推測しない」確認 |
| T-9 | 境界テスト: alias module が recipes/discovery/hint を import しない | privacy |
| T-10 | Mutation: alias 判定を `nameJa` と OR 以外にする / 未所持を含める / 総称語を許す → 上記のどれかが落ちる | 検出力 |

## 13. Owner Decision（選択肢と推奨）

**OD-A1 — alias authority の置き場**
| 案 | 内容 | 推奨 |
|---|---|---|
| **B（推奨）** | 検索専用の別 data authority（id キー疎テーブル）。`ingredientShelf.ts` と同型 | ◎ 理由: (1) 既存の「membership は別 authority」方針と整合、(2) `Ingredient`（経済の共有型）を触らない、(3) 未 ship 材料の値を bundle に入れずに済む、(4) 境界テストが 1 module で完結、(5) 29→62→172 で疎のまま増やせる |
| A | `Ingredient` に `searchAliasesJa?` | 次善。孤児が出ない利点はあるが型の責務が混ざる |
| C / D | 既存 alias 再利用 / 正規化のみ | 不採用（§8）|

**OD-A2 — production 29 に入れる alias の承認**（候補は §5 の 6 件。**Owner の承認があって初めて入れる**）
- 推奨: **T1 の 3 件（`玉ねぎ`→onion、`卵`→egg、`モッツァレラチーズ`→mozzarella）を R5-b で承認**。理由: (1) 3 件とも rule 1b（表記揺れ）として PR #183 で Owner レビュー済みの出所、(2) `玉ねぎ` は依頼文の動機そのもの、(3) `モッツァレラチーズ` は 172 中 117 回出現する実在表記。
- T2 の 3 件（ゴルゴンゾーラ/パルミジャーノ/フォンティーナ +`チーズ`）: 推奨は**承認**（`…チーズ` suffix は「同一語の接尾辞違い」で同一性の疑いが無い）。ただし T2 は confidence-flagged の表に載っているため**個別の Owner 確認**を求める。
- production 29 のその他 19 件に「Owner が追加したい別表記」があれば**ここで指名**する（指名された値は Owner 承認済み出所になる）。無ければ空のまま（推奨: **空のまま。推測しない**）。

**OD-A3 — S 種（`…チーズ` 付き）を alias で扱うか、逆方向部分一致で扱うか**
- 推奨: **alias（データ）で扱う**。理由: 逆方向部分一致は新しい match 規則で、予期しない多重ヒット（`ブラックオリーブオイル` 等）を生み、Gate §10（新 operator なし）と衝突し得る。alias なら決定的で監査可能。

**OD-A4 — R 種（漢字名 ← かな）**
- production 29 は 0 件なので **R5-b では扱わない**。62/172 の nameJa 確定時に、**Owner が読みを供給**する契約（C7）とすることを推奨。

**OD-A5 — 62/172 の扱い**
- 推奨: **T1/T2 の一覧は本書 JSON を staging として保持し、各材料が ship する PR で Owner 承認して初めて本番 table に入れる**（C4）。172 の全 alias の事前作成はしない（C3: nameJa 未確定）。

**OD-A6 — G-D7 の解釈**
- 推奨: PreAudit §16 G-D7 は「Fresh Audit 完了 + Owner が結論を承認」。**本書の結論を OD-A1〜A3 で承認すれば G-D7 は満たされる**。R5-b の高さ/keyboard 実装（G-D1〜D6）は alias に**依存しない**ので、alias の実装は別スライス（または同スライスの後段）に分けて進められる。

## 14. 監査の限界

- **一般知識で候補を足していない**ので、「ありそうだが証跡の無い別表記」（`馬鈴薯`、`ペペロニ` 等）は**意図的に候補外**。網羅性ではなく**証跡の確かさ**を優先した。したがって 6/15/17 は**下限**。
- 172 の nameJa は未承認・4 id は名前なし。172 の alias 規模は**確定値ではない**。
- 「実際にユーザーが iOS IME で何に変換するか」は実機データが無い。PreAudit の Real-Device Discovery（D-6/D-8）で `玉ねぎ`/`玉葱` 等の実確定形を観察できる。**観察した表記を alias にする場合も Owner 指名（C2）を経る**。
- `node_modules` 未導入のため vitest / build は未実行。`catalogText.ts` を strip-types で直接読み取り実行した結果のみを実測値とした（表は JSON に全行）。
- production code / CSS / test / e2e / save / R5-a / R5-b は一切変更していない（本書と JSON の追加のみ）。

## 15. FINAL VERDICT

**B. OWNER DECISION REQUIRED**

- 技術的な結論（B: 検索専用の別 authority map + `catalogSource` 経由の最小接続、値は Owner 承認済み出所のみ、大規模読み仮名システムは不要）は確定できる。
- ただし **alias の値そのもの（§5 の 6 件、特に T2）と authority の置き場（OD-A1）は Owner の承認が要る**。承認後は A. ALIAS AUTHORITY READY に更新できる。
- STOP。
