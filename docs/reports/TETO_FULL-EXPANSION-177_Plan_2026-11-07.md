# TETO FULL-EXPANSION 177 — 全量先行・機能別一括実装 計画と依存関係表（#780、docs-only）

2026-11-07 / 基準 `origin/main` = **`e6b205c`**（#786 まで）。変更は本書と `docs/reports/data/TETO_FULL-EXPANSION-177_plan.{json,py.txt}` の新規 3 ファイルのみ。`src/`・`e2e/`・既存 docs・HOT ファイル・他 claim の成果物には触れていない。**本書は計画であり、実装・merge・Production ON・共有 Preview 更新の承認ではない。**

凡例: 【実測】コード／データから機械的に確認、【推論】実測からの解釈、【未確認】この環境では確かめていない。

再現: PR #781 の `TETO_POOL-REJUDGE_87_script.py.txt` を `e6b205c` で再実行 → #781 の `rows.json` と**バイト単位で一致**【実測】（#786 はテスト分割のみでデータ不変）。本書の表はその rows を入力に `python3 -I docs/reports/data/TETO_FULL-EXPANSION-177_plan.py.txt <rows.json> <out.json>` で生成。87 行の母集団・重複ゲート・工程判定は **#781 を再利用し再測定していない**（§8 Efficient flow 1）。

---

## 0. 結論

1. **177 = 出荷済み 90 + 未実装 87**（87 = 172 設計行 − 出荷済みに紐づく 85 行。#781 の定義 A）【実測】。うち 3 行（pesto-burrata・crudaiola＝PR #783、pesto-noci＝B20-A HOLD）は**既存の作業が持つので本計画の実装対象から外す**。本計画の実装対象は **84 レシピ**。
2. **未実装食材候補 73 種は再現できた**（87 行の `newIngredients` の和集合がちょうど 73）【実測】。burrata（#783）・honey／walnut（B20-A）を除く **70 種**が本計画の対象。ただし 10 種は既存食材の別名候補、8 種はペア統合候補、5 種は調理済み複合食材で、**Owner の一括ルール次第で 約 55〜70 種**に収まる【推論】。さらに identity set が未確定の 40 行（主にソース未特定）は**73 が下限**で、判断後に増えうる【実測＋推論】。
3. **工程の不足は 6 トラック（M1〜M6）に集約できる**。84 行中 **41 行は新工程不要**（R-A 11 行：新食材も不要／R-B 30 行：新食材のみ）、43 行が工程待ち。最大は DOUGH_VARIANT（M1、31 行、#577）。新規 Issue が必要なのは mid_bake・STEP_ORDER・LAMINATE と、天板 profile／生地形状ターゲットの設計 Issue【実測】。
4. **ボトルネックは実装量ではなく Owner 判断**: 87 行中 **81 行が Owner 判断待ち**（FULL＝判断不要は 0 件、#781）。行ごとに聞くと 81 回になるので、**13 種類の判断理由を 16 件の一括判断（§9）**にまとめて 1 回で決めてもらう設計にした。
5. 実装方式: **① 全 84 レシピと ② 全 70 食材を、Production から import されない「Staged Catalog」（新ディレクトリ）へ先に一括登録**し、③ 工程は既存の Gate（本番 OFF の定数）で並行実装する。依存（食材・工程・Owner 判断）がすべて揃ったレシピだけを **「リリース列車（Release Train）」単位で本番カタログへ昇格**する。これで HOT ファイル（`recipes.ts` 等）を触る PR は列車ごとの 1 本に絞られ、PR 数は従来見込みの **約 45 本 → 約 18 本**、手動 HV は **約 40 回 → 約 7 回**に減る見込み【推論・§8】。

---

## 1. 確認した最新状態（2026-11-07、GitHub を正とする）

| 対象 | 状態 | 本計画での扱い |
|---|---|---|
| main | `e6b205c`（#786）。本番 90 レシピ／97 食材 | 基準 |
| PR #783 Batch 19（#774） | Draft、HEAD `abb3da5a`、実機 HV 待ち。burrata + pesto-burrata + crudaiola、約 80 ファイル（`recipes.ts`・`ingredients.ts`・`discoveryLadder.ts`・hint5 golden 等） | **別途 Final Gate を維持。重複させない。**本計画の HOT ファイル編集はすべて #783 merge 後に rebase |
| B20-A（#780 T5） | honey + walnut + pesto-noci。Owner: **#783 merge まで HOLD** | 対象外（列車 PT-1 の前に B20-A が走る順序を固定） |
| PR #781（T2） | 87 行再判定、docs-only、open | 母集団の SSOT として読み取り専用で再利用 |
| #772 claim（`TETO_CONTENT-POOL_*`） | 他 session | 読み取りのみ。編集しない |
| PR #785 / F2 lab claim（#773 FOLD+SEAL） | F1 HOLD・Draft、F2 は `src/labs/foldSeal/**` | M3（ENCLOSE）はこの線に乗せる。新規に別実装しない |
| PR #775（#577 PD-1a） | open | M1 の起点 |
| PR #776 / #746（#579 DRIZZLE） | open | honey・balsamic・condensed-milk の後がけ液体（M4 隣接） |
| PR #738 / #747 / #755 系（#726 STEAM） | open／Draft | 87 行は STEAM を要求しない【実測】。影響なし |
| #749 FRY、#696 PREP、#784 T9（操作の共通入力契約） | Gate OFF／設計中 | M5 は既存 Gate の本番 ON 判断に依存 |
| #417 icons（PR #782 eggplant ほか） | 進行中 | 新食材の SVG は #417 のサブレーンとして扱う（§6） |
| #675（トレイ 75 食材 UX）・#369（HAND） | 調査中 | **食材 97→約 165 で必須の前提**（§7 リスク） |

## 2. 177 母集団の確定（重複と既存実装の除外）【実測】

| 区分 | 数 | 扱い |
|---|---|---|
| 172 設計行（`TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`） | 172 | |
| うち出荷済みレシピに紐づく行 | 85 | 除外（実装済み）。うち構成が出荷版と食い違う「PIZZA DB 版」9 行は**出荷済みとして数え、177 には足さない**（#780 本文どおり別途 Owner 判断） |
| 出荷済みだが 172 行に無い 5 品（funghi・napoletana・pepperoni・pizza-bianca・salsiccia） | 5 | 出荷済み 90 に含む |
| **未実装** | **87** | 177 = 90 + 87 |
| うち既存作業が所有 | 3 | pesto-burrata・crudaiola（#783）、pesto-noci（B20-A） |
| **本計画の実装対象** | **84** | |

注意: Sept の Phase-2「証拠が揃った 87 行」は**同じ数の別集合**（61 行は出荷済み）。こちらを使うと 61 行を二重計上する（#781 §1）。Wave A 46／B 26／C 15・「判断不要 9 品」は**UNVERIFIED のまま使わない**（Owner 6691497411・6705255833）。本計画のレーン（R-A/R-B/R-C）は Wave の代用ではなく、依存関係だけから機械的に決めた区分。

## 3. レーン（依存の形）別の件数【実測】

| レーン | 定義 | 件数 | 解放条件 |
|---|---|---|---|
| IN_FLIGHT | 既存 PR／claim が所有 | 3 | 各自の Gate |
| **R-A** | 新食材なし・新工程なし | **11** | Owner 判断のみ |
| **R-B** | 新食材あり・新工程なし | **30** | Owner 判断 + WS-I の食材 |
| R-C:M1 | DOUGH_VARIANT のみ | 20 | + M1 |
| R-C:M1+M2 | 生地 + 天板 profile／形状 | 8 | + M1, M2 |
| R-C:M1+M3 | 生地 + 包む | 3 | + M1, M3 |
| R-C:M3 | 包む（ENCLOSE）のみ | 2 | + M3 |
| R-C:M4 / M4+M5 | 焼成中の追加（mid_bake）／+PREP | 2 / 1 | + M4（+M5） |
| R-C:M5 | PREP（2）・FRY（1） | 3 | + M5（既存 Gate の本番 ON） |
| R-C:M2+M6 / M6 | 工程順・ゾーン・積層 | 1 / 3 | + M6 |
| 計 | | **87** | |

工程トラック別の依存行数（重複あり）: M1 = 31、M2 = 9、M3 = 5、M4 = 3、M5 = 4、M6 = 4。

## 4. 食材 73 種の再監査（要約。全行は付録 B）【推論、使用数は実測】

- 使用数: honey 5・walnut 4・lettuce 3・burrata 3、2 回が 4 種（blue-cheese-dressing・carrot・cucumber・french-fries）、**残り 65 種は 1 レシピ専用**。1 レシピ専用食材はレシピが Owner 判断で落ちれば一緒に落ちるので、**食材の登録はレシピ判断の後に確定**させる（データは先に staged へ入れ、ステータスで管理）。
- 種別: 野菜 15・ソース 13・チーズ 9・調理済み複合 8・果物 7・スパイス 5・液体 4・魚介 4・デザート 4・肉 2・ナッツ 2。
- **別名候補（既存 id を再利用できうる）10**: ground-beef→beef、spicy-salami→salami/pepperoni、mentaiko→cod-roe、chili-powder→paprika-powder、cotija→feta、brick-cheese→mozzarella、pecorino→grana-padano/parmigiano、salsa→fresh-tomato/tomato-sauce、blue-cheese-dressing→gorgonzola、chicken-tikka→chicken（+PREP）。**再利用すると重複ゲート（部分集合・上位集合）に当たる行が増える**ので、ルール I-1（§9）で一括判断。
- **ペア統合候補 8**: cabbage／red-cabbage、chicory／puntarelle／radicchio、chocolate／nutella-spread、lime／lemon（出荷済み）。
- **調理済み複合 5（+性質が近い 3）**: french-fries・tortilla-chips・graham-cracker・liver-pate・peking-duck（+chicken-tikka・natto・mochi・truffle の形状）。french-fries は「potato + FRY（#749）」で表すか、完成品として持つかが論点。
- **ソース系 13**: 新ソースは既存の New Sauces 手順（#578、`TETO_NEW-SAUCES-B_U0-GATE`、`recipeSauceProfiles.ts`）に乗る。液体 4（honey・balsamic・condensed-milk・melted-butter）は焼成前ソースか後がけ（#579 DRIZZLE）かの区別が必要。
- 統合後の目安: 別名をすべて再利用し、ペアを統合すると **約 55 種**、すべて独立なら **70 種**（in-flight の 3 種を除く）。食材総数は **97 → 約 150〜170**。

## 5. 調理法の不足機能と既存 Issue の対応【実測＋推論】

| トラック | 不足機能 | 現状 | 既存 Issue／PR | 依存行 | 新規 Issue |
|---|---|---|---|---|---|
| **M1** 生地の種類 | 3 種目以降の `DoughKind`（NY・ローマ・ピアディーナ・カリフラワー・ケト等） | standard／Pinsa の 2 種のみ | #577 PR #775（PD-1a）→ PD-1b/c → PD-2（チップ UI、`GameScreen.tsx` HOT）→ PD-3 データ | 31 | 不要（#577 の PD-3 を「全生地一括」に拡張） |
| **M2** 天板 profile・形状 | 深型・浅型・鉄板、楕円／舟形／長方形ターゲット | 四角天板（tray）のみ | #532／#536／#538、#773 | 9 | **要**: 天板 profile と生地形状ターゲットの設計 Issue（#532 の子） |
| **M3** 包む | ENCLOSE（calzone・stuffed 系） | 無し | #773 FOLD+SEAL（PR #785 F1、F2 lab claim） | 5 | 不要（#773 の F3 以降で「ゲーム接続」） |
| **M4** 焼成中の追加 | mid_bake | post_bake は出荷済み | #604／#611（後乗せ） | 3 | **要**: mid_bake（#604 の子） |
| **M5** 下ごしらえ・揚げ | PREP・FRY の本番 ON | 実装済み・Gate OFF | #696（PREP）、#749（FRY）、#784（共通入力契約） | 4 | 不要（Owner の本番 ON 判断） |
| **M6** 工程順・ゾーン・積層 | STEP_ORDER（チーズ→ソース）、ZONED（クアトロ・スタジオーニ）、LAMINATE（フティール）、3 層目 | 2 層ソースのみ出荷済み | #773・PR #620（ZONED 監査）、#521 | 4 | **要**: STEP_ORDER、LAMINATE（1 行のみ → 後回し候補） |
| （横断）ソース追加 | 新ソース 13 種のペイント・profile | 手順あり | #578、U0 Gate | 約 20 | 不要 |
| （横断）後がけ液体 | honey 等 | D1 純粋ロジック | #579 PR #776／#746 | 5+ | 不要 |

STEAM（#726）・SEAR（#724/#727）は 87 行のどれも要求しない【実測】。

## 6. 3 ワークストリームとファイル担当（競合の固定）

Owner 指定の優先順（① レシピ → ② 食材 → ③ 調理法）は**登録の順序**として守る。本番への**昇格**は依存がそろった順（§8 の列車）に行う。①②は互いのファイルに触れないので並行でき、③は既存 Gate の PR 線で並行する。

| WS | 内容 | 成果物（新規） | 着手条件 |
|---|---|---|---|
| **E0 基盤**（WS-R が担当） | Staged Catalog の器・検証・隔離テスト・what-if 測定 | `src/data/staged/{types,validate}.ts`・`*.test.ts` | Owner G-1 |
| **WS-R ① レシピ全量登録** | 84 レシピを staged に一括登録（構成・ソース・生地・工程依存・判断ステータス・出典）。最終 `RecipeId` をここで確定（以後変更禁止） | `src/data/staged/stagedRecipes.ts` | E0 |
| **WS-I ② 食材全量登録** | 70 食材を staged に一括登録（カテゴリ・family 暫定・サイズ・検索別名・絵文字の仮アイコン・ステータス）。SVG は #417 のサブレーン | `src/data/staged/stagedIngredients.ts`、新規 SVG ファイル | E0（WS-R と並行） |
| **WS-M ③ 調理法** | M1〜M6 を既存の Issue／PR 線で実装（本番 OFF の Gate 定数） | 各トラックの `src/logic/<mechanic>/**`・`src/data/*Gate.ts` | 各トラックの既存 Gate |
| **Catalog Integrator**（単一担当） | 列車ごとに staged → 本番カタログへ昇格 | HOT ファイル群の編集 | #783 → B20-A の merge 後 |

| ファイル／領域 | 担当（固定） | 規則 |
|---|---|---|
| `src/data/staged/stagedRecipes.ts` | WS-R | WS-I は読むだけ |
| `src/data/staged/stagedIngredients.ts` | WS-I | WS-R は読むだけ |
| `src/data/staged/{types,validate}.ts`・テスト | E0（WS-R） | 変更は WS-R の PR のみ |
| **HOT カタログ群**: `recipes.ts`・`ingredients.ts`・`discoveryLadder.ts`・`discoveryCatalog.ts`・`orders.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`toppingSizeClass.ts`・`ingredientTaxonomy.ts`・`ingredientSearchAliases.ts`・`hints.ts`・`__golden__/hint5.*`・`recipeBatchManifest.ts`・`catalogLedger.test.ts`・`expansionBatch*.test.ts` | **Catalog Integrator のみ**（同時に 1 session） | 列車 PR でだけ触る。#783 と B20-A が先、各列車は直前の列車の merge 後に rebase |
| `IngredientGlyph.tsx`・アイコン配線 | #417 線 | 新規 SVG ファイルは並行可。配線は Integrator の列車 PR か #417 の配線 PR のどちらか一方（列車ごとに事前に決める） |
| `src/logic/dough/**`・生地データ | M1（#577） | PD-2 の `GameScreen.tsx` は下の直列規則 |
| `src/labs/foldSeal/**`・`src/logic/foldSeal*` | M3（#773 既存 claim） | 新規に別実装しない |
| `GameScreen.tsx`・`App.css`・`gameReducer.ts` | **直列**: 工程 UI の接続は 1 本ずつ。順序 #738 → M1 PD-2 → M5 → M3 → M2 → M4 → M6 | 後の PR は先の PR の merge 後に rebase（Session Ops §1 HOT 規則） |
| `persistence.ts` | どの WS も触らない | 必要なら別 Owner 承認 |
| `src/main.tsx`・`src/preview/**`・`src/devtools/**` | #738／#746 の領域 | 触らない |

## 7. 未完成データの隔離と保存データの保護

1. **Staged Catalog は本番コードから import されない**（Phase 1）。アーキテクチャテストで「`src/data/staged/**` を import してよいのは `*.test.ts` と `staged` 自身だけ」を固定。`RECIPES`／`INGREDIENTS`／`DISCOVERY_LADDER` とそれ由来の Dex・Shop・Research・Hint・在庫は**今と同じオブジェクト**のまま【設計】。
2. **what-if 測定はテスト内だけ**: テストで staged を本番カタログにメモリ上で足し、重複ゲート（同一／部分／上位集合・Jaccard）、Research ラベル（cohort 文字）、Hint 5.0・DH4、ladder 到達性を**84 件まとめて 1 回**測る。結果はテストの期待値（golden）として staged 側にだけ置く。従来は各 Batch で個別に測っていた（B19 の差分は約 15 個の batch テストと hint5 golden を編集）【実測】。
3. **ID は staged 登録時に確定・以後変更禁止**。昇格は追加のみ（削除・改名なし）。`catalogLedger.test.ts` の合計を列車ごとに更新。
4. **工程待ちレシピは Gate 付きで昇格**: `lateCatalog.ts`／`pinsaGate.ts` と同じ「Gate OFF なら base 配列そのもの」パターン（`lateCatalog.offGolden.test.ts` 相当の OFF golden を各トラックに用意）。lateCatalog の既知の限界（Gate 付き項目の ladder 番号が通常の追加でずれる）は、**昇格を列車順の追加だけにし、列車外の通常 Batch を止める**ことで避ける（Owner G-2）。
5. **保存データ**: `sanitizeDex`／所持食材の sanitizer は未知の id を落とす【実測、`persistence.ts`】。したがって (a) staged id を Production の保存に書かせない（Phase 1 は import 自体が無い）、(b) Gate 付き列車を本番 ON にする前に **#668（Dex の raw エントリ保持）**を入れ、Gate を OFF に戻したときに Dex が消えないようにする（ロールバック可能性の前提）。Preview は別キー（`teto-pizza-preview-save-v1`）だが全 Preview で共有なので、検証はローカル／CI の成果物で行い、**共有 Preview は使わない**（Session Ops §5）。

## 8. 統合 Gate（PR 数と手動 HV の削減）

| Gate | いつ | 内容 | 手動 HV |
|---|---|---|---|
| **Gate S（Staging）** | E0 + WS-R + WS-I の PR（最大 3 本、UI 変更なし） | CI、データ検証、隔離テスト、what-if 一括測定、Codex（最新 HEAD） | **なし**（UI・ゲーム挙動の変更なし。HV Policy の適用外であることを PR に明記） |
| **Gate T（Train）** | 列車ごとに 1 PR | CI（WebKit 含む既存条件）、Codex、**列車内の全レシピを 390×844 で自動プレイする parameterized e2e**（Guided → RESULT → Dex のスクリーンショットを全件、`docs/reports/screenshots/<train>/` に commit）、新食材の**アイコン一覧シート 1 枚**（ピザ上・トレイ上の実寸） | **列車ごとに Owner iPhone HV 1 回**: 代表レシピ（新しい工程・新しい食材種別ごとに 1 品）+ 一覧シートの目視。動画（390×844）は直接ユーザーへ |
| **Gate P（Production ON）** | 工程 Gate の本番 ON | 変更なし（既存手順・Gate ごとの Owner 承認） | 既存どおり |

列車（Release Train）案:

| 列車 | 内容 | 件数（上限） | 前提 |
|---|---|---|---|
| PT-0 | Batch 19（#783）→ B20-A | 3 | 既存 Gate（本計画は触らない） |
| PT-1a | R-A 11 + R-B のうち新食材が野菜・果物・チーズ・魚介・肉・ナッツ・スパイス・デザートだけのもの 11 | 22 | Owner R/I ルール、WS-R・WS-I 登録済み |
| PT-1b | R-B の残り（新ソース・後がけ液体・調理済み複合食材を含む） | 19 | + New Sauces 手順、#579（液体を後がけにする行） |
| PT-2 | M1 生地（R-C:M1 の 20 + 他トラックがそろったもの） | 約 20〜31 | #577 PD-1b/c・PD-2・PD-3 |
| PT-3 | M2 天板・形状 + M3 包む | 約 13 | M2 設計・#773 F3 |
| PT-4 | M4 mid_bake + M5 PREP／FRY | 約 6 | 各 Gate |
| PT-5 | M6 工程順・ゾーン・積層（LAMINATE は延期候補） | 約 4 | M6 設計 |

見積もり【推論】: 従来方式（2 品／Batch、各 PR に HV）は 84 品で約 42 PR + 約 42 HV。本方式は Gate S 3 本 + 列車 6 本 + 工程の接続 PR 約 6 本（M トラックの既存 PR は数えない）+ アイコン配線 約 3 本 ≒ **18 本**、手動 HV は列車 6 回 + アイコン一覧 1 回 ≒ **7 回**。
**注意**: Gate T の「代表レシピだけを実機で見る（他は自動スクリーンショット）」は HV の新しい運用なので **Owner 承認が必要**（Session Ops §8.8、#443）。承認されない場合は列車ごとの HV 対象が増えるだけで、他の設計は変わらない。

## 9. Owner 一括判断表（1 回で決める。各に推奨つき）

87 行の判断理由（主因）: ソース未特定 21・構成衝突 13・工程解釈 11・未解決食材 11・上位集合 5・Jaccard>0.4 6・同一集合（生地軸差）5・部分集合 2・証拠欠落 2・範囲 2・発見規則衝突 1・レビュー項目 2【実測、#781】。

| ID | 論点 | 対象 | 推奨 |
|---|---|---|---|
| **G-1** | 全量先行・Staged Catalog・列車方式への移行 | 全体 | 承認（§6〜§8） |
| **G-2** | 列車外の通常 Batch を止め、ladder は列車順の追加のみ | 全体 | 承認（PT-0 の #783・B20-A は例外として先行） |
| **P-1** | 暫定仕様（原典 pizzadb.jp 未確認）での登録を OD-B9-17 パターンで 84 件包括承認 | 84 | 承認。各列車の Result に「暫定」を明記 |
| **R-1** | ソース未特定 | 21（+identity 未確定 40 行の多く） | 料理の正体がソースのもの（照り焼き・プルコギ等）だけ新ソース、他は既存ソースかNO_SAUCE。#772 S2 §3 の 9 件調査を正とする |
| **R-2** | 部分集合／上位集合（禁止） | 主因 7、全体 19 | 原則不採用。生地軸で分けられ、その生地が R-3 で認められた行だけ救う |
| **R-3** | 同一集合で生地軸だけ違う | 5 | 生地が見て分かる別技法のとき（#577 D-F4）だけ許可。cauliflower・fathead は HOLD |
| **R-4** | Jaccard > 0.4 | 主因 6、全体 23 | 原則不採用（#772 S2 推奨を維持）。個別例外はこの表で列挙したもの（crudaiola＝承認済み、zucchine-menta）だけ |
| **R-5** | 構成衝突（候補が複数） | 13 | 新食材が少ない方の構成を採用 |
| **R-6** | 工程の解釈（生野菜・サラダ系など） | 11 | 既存の post_bake（後乗せ）で表す。新工程を作らない |
| **R-7** | 未解決食材 | 11 | まず既存 id で解決（I-1）。無理なら新食材 |
| **R-8** | 範囲・証拠欠落・発見規則衝突・レビュー項目 | 8 | 最終列車まで保留。feteer（LAMINATE）・focaccia・peking-duck は除外候補 |
| **I-1** | 別名候補 10 種の既存 id 再利用 | 10 | 重複ゲートに当たらない場合だけ再利用、当たるなら新 id |
| **I-2** | ペア統合 8 種 | 8 | chicory／puntarelle は統合、radicchio は別、chocolate／nutella-spread は統合、cabbage／red-cabbage は別（色で区別）、lime は別 |
| **I-3** | 調理済み複合食材 | 5〜8 | 完成品として 1 食材で持つ（french-fries を FRY 依存にしない） |
| **M-0** | 工程トラックの優先順 | M1〜M6 | M1 > M5 > M3 > M2 > M4 > M6。LAMINATE は延期 |
| **H-1** | Gate T の HV 運用（代表サンプル + 自動スクショ全件 + アイコン一覧） | 列車 | 承認（§8 注意） |

## 10. 依存関係と実行順

```
[Owner 一括判断 G/P/R/I/M/H]
        │
        ├─► E0 Staged 基盤 ─┬─► WS-R ① 84 レシピ登録 ─┐
        │                    └─► WS-I ② 70 食材登録 ───┼─► Gate S（what-if 一括測定）─► 列車ごとの最終リスト
        │                                              │
        ├─► WS-M ③ M1 #577: PR #775 → PD-1b/c → PD-2(GameScreen, #738 後) → PD-3
        ├─► WS-M ③ M5 #696/#749/#784 → Owner 本番 ON
        ├─► WS-M ③ M3 #773: F1(#785) → F2 lab → F3 接続
        ├─► WS-M ③ M2 / M4 / M6: 設計 Issue 新設 → 実装
        └─► #668 Dex raw 保持（Gate 付き列車の本番 ON 前）

PR #783（B19, 別 Final Gate）─► B20-A ─► PT-1a ─► PT-1b ─► PT-2(M1) ─► PT-3(M2/M3) ─► PT-4(M4/M5) ─► PT-5(M6)
```

- E0・WS-R・WS-I は HOT ファイルに触らないので、**#783 の merge を待たずに着手できる**（Owner G-1 後）。HOT を触る列車 PR だけが #783 → B20-A を待つ。
- 本計画の claim は Owner 承認後に #780 へ投稿する（予定範囲: `src/data/staged/**`・`docs/reports/TETO_FULL-EXPANSION-177_*`・`docs/reports/data/TETO_FULL-EXPANSION-177_*`）。現時点で既存 claim との重なりはない【実測、§1】。

## 11. 状況（完了／未完了／ブロッカー／次の行動）

- **完了**: 最新 main・CLAUDE.md・PROJECT_HANDOFF・Session Ops・#780 の claim と Owner コメント・open PR を確認。177（90+87）と 73 食材を `e6b205c` で再現。84 レシピ×依存（食材・工程・判断）の全量表、73 食材の再監査、工程 6 トラックと既存 Issue の対応、3 WS 分割・ファイル担当・隔離・統合 Gate を設計（本書・付録）。
- **未完了**: 実装（E0／WS-R／WS-I）は未着手。原典 pizzadb.jp は全 87 行で未確認。Research ラベル・Hint 5.0 は静的近似のみ（Gate S で実測予定）。
- **ブロッカー**: §9 の Owner 一括判断（特に G-1・P-1・R-1〜R-4・H-1）。HOT ファイルを触る列車は PR #783 → B20-A の merge 待ち。
- **次の行動**: Owner 判断を受けて #780 に claim を出し、E0 → WS-R／WS-I を 1 PR（または 3 PR）で Gate S に出す。merge・Production ON・共有 Preview 更新はしない。

---

## 付録（生成表。`TETO_FULL-EXPANSION-177_plan.py.txt` の出力）

食材の「種別」「重複・別名リスク」は手作業の判断【推論】。レーン・新食材・不足工程・Owner 判断の主因・重複ゲートは #781 の rows から機械的に導出【実測】。

### A. レシピ全量依存表（87 行）

| # | evidenceId | 名前 | レーン | 新食材 | 不足工程（トラック） | ソース | Owner判断 | 重複ゲート |
|---|---|---|---|---|---|---|---|---|
| 1 | `pesto-burrata-pizzadb-p12` | ペストブラータピザ | IN_FLIGHT | burrata | - | family_derived | - | NONE |
| 2 | `pesto-noci-pizzadb-p12` | ペストノーチピザ | IN_FLIGHT | honey, walnut | - | family_derived | - | NONE |
| 3 | `pizza-alla-crudaiola-pizzadb-p8` | ピッツァ・アッラ・クルダイオーラ | IN_FLIGHT | burrata | - | family_derived | dup:JACCARD_OVER_0.4_EXCEPTION | JACCARD_OVER_0.4_EXCEPTION |
| 4 | `bulgogi-pizza-pizzadb-p11` | プルコギピザ | R-A | - | - | unspecified | BASE_SAUCE_UNSPECIFIED | JACCARD_OVER_0.4_EXCEPTION |
| 5 | `caponata-pizza-pizzadb-p2` | カポナータピザ | R-A | - | - | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 6 | `hokkaido-cheese-pizza-pizzadb-p15` | 北海道チーズピザ | R-A | - | - | none | UNRESOLVED_INGREDIENT | SUBSET_OF_SHIPPED_FORBIDDEN |
| 7 | `keema-pizza-pizzadb-p2` | キーマピザ | R-A | - | - | unspecified | BASE_SAUCE_UNSPECIFIED | SUBSET_OF_SHIPPED_FORBIDDEN |
| 8 | `philly-cheesesteak-pizza-pizzadb-p9` | フィリーチーズステーキピザ | R-A | - | - | none | UNRESOLVED_INGREDIENT | SUBSET_OF_SHIPPED_FORBIDDEN |
| 9 | `pizza-baiana` | ピッツァ・バイアーナ | R-A | - | - | family_derived | UNRESOLVED_INGREDIENT | JACCARD_OVER_0.4_EXCEPTION |
| 10 | `pizza-chilena-pizzadb-p8` | ピッツァ・チレーナ | R-A | - | - | family_derived | UNRESOLVED_INGREDIENT | SUBSET_OF_SHIPPED_FORBIDDEN |
| 11 | `pizza-zucchine-menta-pizzadb-p8` | ピッツァ・コン・ズッキーネ・クルーデ・エ・メンタ | R-A | - | - | none | MECHANIC_INTERPRETATION | JACCARD_OVER_0.4_EXCEPTION |
| 12 | `sfincione-pizzadb` | スフィンチョーネ | R-A | - | - | family_derived | dup:SUPERSET_OF_SHIPPED_FORBIDDEN | SUPERSET_OF_SHIPPED_FORBIDDEN |
| 13 | `teriyaki-chicken-pizza-pizzadb-p14` | 照り焼きチキンピザ | R-A | - | - | unspecified | COMPOSITION_CONFLICT_CANDIDATE | NONE |
| 14 | `tsukimi-pizza-pizzadb-p14` | 月見ピザ | R-A | - | - | none | dup:JACCARD_OVER_0.4_EXCEPTION | JACCARD_OVER_0.4_EXCEPTION |
| 15 | `apple-cinnamon-dessert-pizzadb` | アップルシナモンデザートピザ | R-B | apple, walnut | - | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 16 | `banh-mi-pizza-pizzadb-p6` | バインミーピザ | R-B | carrot, daikon, liver-pate | - | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 17 | `black-truffle-pizza-pizzadb-p14` | 黒トリュフピザ | R-B | truffle | - | none | COMPOSITION_CONFLICT_CANDIDATE | NONE |
| 18 | `buffalo-cauliflower-pizza-pizzadb-p6` | バッファローカリフラワーピザ | R-B | blue-cheese-dressing, cauliflower | - | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 19 | `buffalo-chicken-pizzadb` | バッファローチキンピザ（PIZZA DB版） | R-B | blue-cheese-dressing, buffalo-sauce | - | listed | COMPOSITION_CONFLICT_CANDIDATE | NONE |
| 20 | `burrata-pizza-pizzadb-p10` | ブラータピザ | R-B | burrata | - | family_derived | - | NONE |
| 21 | `chicken-tikka-pizza-pizzadb-p5` | チキンティッカピザ | R-B | chicken-tikka | - | unspecified | BASE_SAUCE_UNSPECIFIED | JACCARD_OVER_0.4_EXCEPTION |
| 22 | `diavola-pizza-pizzadb-p5` | ディアボラ | R-B | spicy-salami | - | family_derived | COMPOSITION_CONFLICT_CANDIDATE | NONE |
| 23 | `frutti-di-mare-pizzadb-p11` | フルッティディマーレ | R-B | squid | - | family_derived | COMPOSITION_CONFLICT_CANDIDATE | JACCARD_OVER_0.4_EXCEPTION |
| 24 | `hot-honey-pepperoni-pizzadb-p12` | ホットハニーペパロニピザ | R-B | honey | - | family_derived | dup:SUPERSET_OF_SHIPPED_FORBIDDEN | SUPERSET_OF_SHIPPED_FORBIDDEN |
| 25 | `jerusalem-mixed-grill-pizza-pizzadb-p1` | エルサレムミックスグリルピザ | R-B | cumin | - | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 26 | `mentaiko-mochi-pizza` | 明太子もちピザ | R-B | mentaiko, mochi | - | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 27 | `mexican-elote-pizza-pizzadb-p13` | メキシカンエロテピザ | R-B | chili-powder, cotija, lime | - | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 28 | `nashville-hot-chicken-pizza-pizzadb-p6` | ナッシュビルホットチキンピザ | R-B | honey | - | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 29 | `nduja-pizza-pizzadb-p14` | ンドゥイヤピザ | R-B | honey | - | unspecified | BASE_SAUCE_UNSPECIFIED | JACCARD_OVER_0.4_EXCEPTION |
| 30 | `nutella-dessert-pizza-pizzadb-p6` | ヌテラデザートピザ | R-B | banana, nutella-spread, powdered-sugar | - | listed | COMPOSITION_CONFLICT_CANDIDATE | NONE |
| 31 | `okonomiyaki-style-pizza-pizzadb-p1` | お好み焼き風ピザ | R-B | bonito-flakes, cabbage, okonomiyaki-sauce | - | listed | UNRESOLVED_INGREDIENT | NONE |
| 32 | `peking-duck-pizza` | 北京ダックピザ | R-B | cucumber, peking-duck, sweet-bean-sauce | - | listed | review:PREPARED_COMPOSITE_INGREDIENT | NONE |
| 33 | `peruvian-aji-amarillo-pizzadb-p12` | ペルーアヒアマリージョピザ | R-B | aji-amarillo | - | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 34 | `pizza-asparagi-limone-pizzadb-p8` | ピッツァ・コン・アスパラージ・クルーディ・エ・リモーネ | R-B | asparagus | - | none | MECHANIC_INTERPRETATION | JACCARD_OVER_0.4_EXCEPTION |
| 35 | `pizza-cavolo-carote-pizzadb-p8` | ピッツァ・コン・カーヴォロ・ロッソ・エ・カローテ | R-B | carrot, red-cabbage, sunflower-seeds | - | none | MECHANIC_INTERPRETATION | NONE |
| 36 | `pizza-finocchi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・フィノッキ | R-B | fennel, orange | - | none | MECHANIC_INTERPRETATION | NONE |
| 37 | `pizza-radicchio-noci-pizzadb-p8` | ピッツァ・コン・ラディッキオ・クルード・エ・ノーチ | R-B | balsamic-vinegar, radicchio, walnut | - | none | MECHANIC_INTERPRETATION | NONE |
| 38 | `pizza-salad-pizzadb-p7` | ピザサラダ | R-B | cucumber, lettuce, yogurt-sauce | - | family_derived | dup:JACCARD_OVER_0.4_EXCEPTION | JACCARD_OVER_0.4_EXCEPTION |
| 39 | `smore-dessert-pizza-pizzadb-p4` | スモアデザートピザ | R-B | chocolate, graham-cracker, marshmallow | - | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 40 | `south-african-boerewors-pizzadb-p14` | 南アフリカボアヴォースピザ | R-B | chutney | - | unspecified | BASE_SAUCE_UNSPECIFIED | JACCARD_OVER_0.4_EXCEPTION |
| 41 | `speck-e-brie-pizzadb-p4` | スペックエブリー | R-B | brie, walnut | - | none | COMPOSITION_CONFLICT_CANDIDATE | NONE |
| 42 | `swedish-kebab-pizza-pizzadb-p4` | スウェディッシュケバブピザ | R-B | kebab-sauce, lettuce | - | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 43 | `taco-pizza-pizzadb` | タコピザ | R-B | cheddar, ground-beef, lettuce, salsa, tortilla-chips | - | listed | MECHANIC_INTERPRETATION | NONE |
| 44 | `thai-chicken-pizza-pizzadb-p4` | タイチキンピザ | R-B | peanut-sauce | - | listed | UNRESOLVED_INGREDIENT | JACCARD_OVER_0.4_EXCEPTION |
| 45 | `argentine-napolitana-pizzadb-p1` | アルゼンチン風ナポリターナ | R-C:M1 | - | DOUGH_VARIANT(M1) | none | dup:SUPERSET_OF_SHIPPED_FORBIDDEN | SUPERSET_OF_SHIPPED_FORBIDDEN |
| 46 | `cauliflower-crust-pizza-pizzadb-p2` | カリフラワークラストピザ | R-C:M1 | - | DOUGH_VARIANT(M1) | family_derived | dup:IDENTICAL_SET_AXIS_SEPARATED | IDENTICAL_SET_AXIS_SEPARATED |
| 47 | `colorado-mountain-pie-pizzadb-p3` | コロラドマウンテンパイ | R-C:M1 | - | DOUGH_VARIANT(M1) | family_derived | EVIDENCE_GAP | SUBSET_OF_SHIPPED_FORBIDDEN |
| 48 | `fathead-pizza-keto-pizzadb-p9` | ファットヘッドピザ（ケト風） | R-C:M1 | - | DOUGH_VARIANT(M1) | family_derived | dup:IDENTICAL_SET_AXIS_SEPARATED | IDENTICAL_SET_AXIS_SEPARATED |
| 49 | `focaccia-genovese-pizzadb-p10` | フォカッチャジェノヴェーゼ | R-C:M1 | rock-salt | DOUGH_VARIANT(M1) | listed | SCOPE_QUESTION | SUPERSET_OF_SHIPPED_FORBIDDEN |
| 50 | `fruit-dessert-pizza-pizzadb-p11` | フルーツデザートピザ | R-C:M1 | blueberry, kiwi, strawberry | DOUGH_VARIANT(M1) | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 51 | `fugazzetta-pizzadb-p10` | フガゼッタ | R-C:M1 | - | DOUGH_VARIANT(M1) | none | DISCOVERY_COLLISION | JACCARD_OVER_0.4_EXCEPTION |
| 52 | `lahmacun` | ラフマジュン | R-C:M1 | - | DOUGH_VARIANT(M1) | family_derived | MECHANIC_INTERPRETATION | NONE |
| 53 | `manakish` | マナキーシュ | R-C:M1 | halloumi, zaatar | DOUGH_VARIANT(M1) | listed | review:SOURCE_INCONSISTENCY | NONE |
| 54 | `ny-style-pizzadb` | ニューヨークスタイルピザ（PIZZA DB版） | R-C:M1 | - | DOUGH_VARIANT(M1) | listed | dup:SUBSET_OF_SHIPPED_FORBIDDEN | SUBSET_OF_SHIPPED_FORBIDDEN |
| 55 | `palmitos-salsa-golf-pizzadb-p7` | パルミートス・イ・サルサ・ゴルフ | R-C:M1 | - | DOUGH_VARIANT(M1) | unspecified | BASE_SAUCE_UNSPECIFIED | JACCARD_OVER_0.4_EXCEPTION |
| 56 | `piadina-romagnola-pizzadb-p7` | ピアディーナ・ロマニョーラ | R-C:M1 | - | DOUGH_VARIANT(M1) | none | - | NONE |
| 57 | `pizza-carciofi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・カルチョーフィ | R-C:M1 | celery | DOUGH_VARIANT(M1) | none | MECHANIC_INTERPRETATION | NONE |
| 58 | `pizza-cicoria-limone-pizzadb-p8` | ピッツァ・コン・チコリア・エ・リモーネ | R-C:M1 | chicory, pecorino | DOUGH_VARIANT(M1) | none | MECHANIC_INTERPRETATION | NONE |
| 59 | `pizza-de-cancha` | ピッツァ・デ・カンチャ | R-C:M1 | - | DOUGH_VARIANT(M1) | family_derived | UNRESOLVED_INGREDIENT | JACCARD_OVER_0.4_EXCEPTION |
| 60 | `pizza-puntarelle-pizzadb-p8` | ピッツァ・コン・プンタレッレ | R-C:M1 | puntarelle | DOUGH_VARIANT(M1) | none | MECHANIC_INTERPRETATION | NONE |
| 61 | `pizza-romana-pizzadb-p9` | ピッツァ・ロマーナ | R-C:M1 | - | DOUGH_VARIANT(M1) | family_derived | COMPOSITION_CONFLICT_CANDIDATE | SUPERSET_OF_SHIPPED_FORBIDDEN |
| 62 | `poutine-pizza-pizzadb-p10` | プーティンピザ | R-C:M1 | cheese-curd, french-fries, gravy-sauce | DOUGH_VARIANT(M1) | listed | - | NONE |
| 63 | `quad-cities-style-pizza-pizzadb-p2` | クアッドシティーズスタイルピザ | R-C:M1 | - | DOUGH_VARIANT(M1) | family_derived | UNRESOLVED_INGREDIENT | SUBSET_OF_SHIPPED_FORBIDDEN |
| 64 | `st-louis-style-pizza-pizzadb-p4` | セントルイススタイルピザ | R-C:M1 | - | DOUGH_VARIANT(M1) | family_derived | UNRESOLVED_INGREDIENT | SUBSET_OF_SHIPPED_FORBIDDEN |
| 65 | `detroit-style-pizza-pizzadb-p5` | デトロイトスタイルピザ | R-C:M1+M2 | brick-cheese | DOUGH_SHAPE_TARGET(M2),DOUGH_VARIANT(M1),PAN_BAKE:other(M2) | family_derived | COMPOSITION_CONFLICT_CANDIDATE | JACCARD_OVER_0.4_EXCEPTION |
| 66 | `greek-style-pizzadb` | グリークスタイルピザ（PIZZA DB版） | R-C:M1+M2 | - | DOUGH_VARIANT(M1),PAN_BAKE:other(M2) | listed | COMPOSITION_CONFLICT_CANDIDATE | JACCARD_OVER_0.4_EXCEPTION |
| 67 | `montreal-style-pizza-pizzadb-p13` | モントリオールスタイルピザ | R-C:M1+M2 | - | DOUGH_VARIANT(M1),PAN_BAKE:other(M2) | listed | dup:SUPERSET_OF_SHIPPED_FORBIDDEN | SUPERSET_OF_SHIPPED_FORBIDDEN |
| 68 | `new-england-bar-pizza-pizzadb-p6` | ニューイングランドバーピザ | R-C:M1+M2 | - | DOUGH_VARIANT(M1),PAN_BAKE:other(M2) | family_derived | dup:IDENTICAL_SET_AXIS_SEPARATED | IDENTICAL_SET_AXIS_SEPARATED |
| 69 | `old-forge-style-pizza-pizzadb-p1` | オールドフォージスタイルピザ | R-C:M1+M2 | - | DOUGH_SHAPE_TARGET(M2),DOUGH_VARIANT(M1) | family_derived | UNRESOLVED_INGREDIENT | SUBSET_OF_SHIPPED_FORBIDDEN |
| 70 | `pizza-al-taglio-romana-pizzadb-p9` | ピッツァアルタリオローマーナ | R-C:M1+M2 | - | DOUGH_SHAPE_TARGET(M2),DOUGH_VARIANT(M1) | family_derived | dup:IDENTICAL_SET_AXIS_SEPARATED | IDENTICAL_SET_AXIS_SEPARATED |
| 71 | `siciliana-pizzadb` | シチリアンピザ（PIZZA DB版） | R-C:M1+M2 | - | DOUGH_SHAPE_TARGET(M2),DOUGH_VARIANT(M1),PAN_BAKE:other(M2) | listed | COMPOSITION_CONFLICT_CANDIDATE | JACCARD_OVER_0.4_EXCEPTION |
| 72 | `turkish-pide-pizzadb-p5` | トルコピデ | R-C:M1+M2 | - | DOUGH_SHAPE_TARGET(M2),DOUGH_VARIANT(M1) | family_derived | UNRESOLVED_INGREDIENT | NONE |
| 73 | `chicago-stuffed-pizza-pizzadb-p3` | シカゴスタッフドピザ | R-C:M1+M3 | - | DOUGH_VARIANT(M1),ENCLOSE(M3) | family_derived | dup:IDENTICAL_SET_AXIS_SEPARATED | IDENTICAL_SET_AXIS_SEPARATED |
| 74 | `fugazzeta-rellena` | フガゼッタ・レジェーナ | R-C:M1+M3 | - | DOUGH_VARIANT(M1),ENCLOSE(M3) | none | dup:JACCARD_OVER_0.4_EXCEPTION | JACCARD_OVER_0.4_EXCEPTION |
| 75 | `pizza-a-caballo` | ピッツァ・ア・カバージョ | R-C:M1+M3 | - | DOUGH_VARIANT(M1),ENCLOSE(M3) | none | EVIDENCE_GAP | SUBSET_OF_SHIPPED_FORBIDDEN |
| 76 | `chicago-deep-dish-pizzadb` | シカゴディープディッシュ（PIZZA DB版） | R-C:M2+M6 | - | PAN_BAKE:other(M2),STEP_ORDER(M6) | listed | COMPOSITION_CONFLICT_CANDIDATE | SUBSET_OF_SHIPPED_FORBIDDEN |
| 77 | `calzone-pizzadb` | カルツォーネ（PIZZA DB版） | R-C:M3 | - | ENCLOSE(M3) | listed | COMPOSITION_CONFLICT_CANDIDATE | JACCARD_OVER_0.4_EXCEPTION |
| 78 | `scacciata-ragusana-pizzadb-p4` | スカッチャラグザーナ | R-C:M3 | caciocavallo | ENCLOSE(M3) | family_derived | dup:JACCARD_OVER_0.4_EXCEPTION | JACCARD_OVER_0.4_EXCEPTION |
| 79 | `eel-pizza-pizzadb-p1` | うなぎピザ | R-C:M4 | eel, sansho-pepper | LATE_ADDITION:mid_bake(M4) | unspecified | MECHANIC_INTERPRETATION | NONE |
| 80 | `natto-pizza` | 納豆ピザ | R-C:M4 | natto, okra | LATE_ADDITION:mid_bake(M4) | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 81 | `pizza-de-lomo-saltado` | ロモ・サルタード・ピザ | R-C:M4+M5 | french-fries | LATE_ADDITION:mid_bake(M4),PREP_STEP(M5) | unspecified | BASE_SAUCE_UNSPECIFIED | JACCARD_OVER_0.4_EXCEPTION |
| 82 | `kimchi-pizza-pizzadb-p2` | キムチピザ | R-C:M5 | kimchi | PREP_STEP(M5) | unspecified | BASE_SAUCE_UNSPECIFIED | NONE |
| 83 | `pizza-fritta-pizzadb-p9` | ピッツァフリッタ | R-C:M5 | - | FRY_COOK(M5) | family_derived | - | NONE |
| 84 | `yakiniku-pizza` | 焼肉ピザ | R-C:M5 | yakiniku-sauce | PREP_STEP(M5) | listed | dup:JACCARD_OVER_0.4_EXCEPTION | JACCARD_OVER_0.4_EXCEPTION |
| 85 | `feteer-meshaltet-pizzadb-p10` | フェテイールメシャルテル | R-C:M6 | condensed-milk, honey, melted-butter | LAMINATE(M6),MULTI_SPREAD_LAYER(M6) | unspecified | SCOPE_QUESTION | NONE |
| 86 | `quattro-stagioni-pizzadb` | クアトロスタジオーニ（PIZZA DB版） | R-C:M6 | - | ZONED_PLACEMENT(M6) | listed | dup:SUPERSET_OF_SHIPPED_FORBIDDEN | SUPERSET_OF_SHIPPED_FORBIDDEN |
| 87 | `trenton-tomato-pie-pizzadb` | トレントントマトパイ | R-C:M6 | - | STEP_ORDER(M6) | listed | dup:SUBSET_OF_SHIPPED_FORBIDDEN | SUBSET_OF_SHIPPED_FORBIDDEN |

### B. 食材 73 種の再監査

| # | id | 使用数 | 種別 | 重複・別名リスク | 依存レシピのレーン |
|---|---|---|---|---|---|
| 1 | `honey` | 5 | LIQUID | OK | IN_FLIGHT, R-B, R-C:M6 |
| 2 | `walnut` | 4 | NUT | OK | IN_FLIGHT, R-B |
| 3 | `burrata` | 3 | CHEESE | OK | IN_FLIGHT, R-B |
| 4 | `lettuce` | 3 | VEG | OK | R-B |
| 5 | `blue-cheese-dressing` | 2 | SAUCE | ALIAS:gorgonzola | R-B |
| 6 | `carrot` | 2 | VEG | OK | R-B |
| 7 | `cucumber` | 2 | VEG | OK | R-B |
| 8 | `french-fries` | 2 | COMPOSITE | COMPOSITE (=potato+FRY? #749) | R-C:M1, R-C:M4+M5 |
| 9 | `aji-amarillo` | 1 | SAUCE | SAUCE_LINE | R-B |
| 10 | `apple` | 1 | FRUIT | OK | R-B |
| 11 | `asparagus` | 1 | VEG | OK | R-B |
| 12 | `balsamic-vinegar` | 1 | LIQUID | OK (#579 DRIZZLE) | R-B |
| 13 | `banana` | 1 | FRUIT | OK | R-B |
| 14 | `blueberry` | 1 | FRUIT | OK | R-C:M1 |
| 15 | `bonito-flakes` | 1 | SEAFOOD | OK | R-B |
| 16 | `brick-cheese` | 1 | CHEESE | ALIAS:mozzarella (Detroit only) | R-C:M1+M2 |
| 17 | `brie` | 1 | CHEESE | OK | R-B |
| 18 | `buffalo-sauce` | 1 | SAUCE | SAUCE_LINE | R-B |
| 19 | `cabbage` | 1 | VEG | PAIR:red-cabbage | R-B |
| 20 | `caciocavallo` | 1 | CHEESE | OK | R-C:M3 |
| 21 | `cauliflower` | 1 | VEG | OK | R-B |
| 22 | `celery` | 1 | VEG | OK | R-C:M1 |
| 23 | `cheddar` | 1 | CHEESE | OK | R-B |
| 24 | `cheese-curd` | 1 | CHEESE | OK | R-C:M1 |
| 25 | `chicken-tikka` | 1 | COMPOSITE | ALIAS:chicken (+PREP/sauce) | R-B |
| 26 | `chicory` | 1 | VEG | PAIR:puntarelle/radicchio | R-C:M1 |
| 27 | `chili-powder` | 1 | SPICE | ALIAS:paprika-powder | R-B |
| 28 | `chocolate` | 1 | DESSERT | PAIR:nutella-spread | R-B |
| 29 | `chutney` | 1 | SAUCE | SAUCE_LINE | R-B |
| 30 | `condensed-milk` | 1 | LIQUID | OK | R-C:M6 |
| 31 | `cotija` | 1 | CHEESE | ALIAS:feta | R-B |
| 32 | `cumin` | 1 | SPICE | OK | R-B |
| 33 | `daikon` | 1 | VEG | OK | R-B |
| 34 | `eel` | 1 | SEAFOOD | OK | R-C:M4 |
| 35 | `fennel` | 1 | VEG | OK | R-B |
| 36 | `graham-cracker` | 1 | DESSERT | COMPOSITE | R-B |
| 37 | `gravy-sauce` | 1 | SAUCE | SAUCE_LINE | R-C:M1 |
| 38 | `ground-beef` | 1 | MEAT | ALIAS:beef | R-B |
| 39 | `halloumi` | 1 | CHEESE | OK | R-C:M1 |
| 40 | `kebab-sauce` | 1 | SAUCE | SAUCE_LINE | R-B |
| 41 | `kimchi` | 1 | VEG | OK | R-C:M5 |
| 42 | `kiwi` | 1 | FRUIT | OK | R-C:M1 |
| 43 | `lime` | 1 | FRUIT | PAIR:lemon(shipped) | R-B |
| 44 | `liver-pate` | 1 | COMPOSITE | COMPOSITE | R-B |
| 45 | `marshmallow` | 1 | DESSERT | OK | R-B |
| 46 | `melted-butter` | 1 | LIQUID | OK | R-C:M6 |
| 47 | `mentaiko` | 1 | SEAFOOD | ALIAS:cod-roe | R-B |
| 48 | `mochi` | 1 | COMPOSITE | OK | R-B |
| 49 | `natto` | 1 | COMPOSITE | OK | R-C:M4 |
| 50 | `nutella-spread` | 1 | SAUCE | PAIR:chocolate | R-B |
| 51 | `okonomiyaki-sauce` | 1 | SAUCE | SAUCE_LINE | R-B |
| 52 | `okra` | 1 | VEG | OK | R-C:M4 |
| 53 | `orange` | 1 | FRUIT | OK | R-B |
| 54 | `peanut-sauce` | 1 | SAUCE | SAUCE_LINE | R-B |
| 55 | `pecorino` | 1 | CHEESE | ALIAS:grana-padano/parmigiano (Hint class) | R-C:M1 |
| 56 | `peking-duck` | 1 | COMPOSITE | COMPOSITE | R-B |
| 57 | `powdered-sugar` | 1 | DESSERT | OK | R-B |
| 58 | `puntarelle` | 1 | VEG | PAIR:chicory | R-C:M1 |
| 59 | `radicchio` | 1 | VEG | PAIR:chicory | R-B |
| 60 | `red-cabbage` | 1 | VEG | PAIR:cabbage | R-B |
| 61 | `rock-salt` | 1 | SPICE | OK | R-C:M1 |
| 62 | `salsa` | 1 | SAUCE | ALIAS:fresh-tomato/tomato-sauce | R-B |
| 63 | `sansho-pepper` | 1 | SPICE | OK | R-C:M4 |
| 64 | `spicy-salami` | 1 | MEAT | ALIAS:salami/pepperoni | R-B |
| 65 | `squid` | 1 | SEAFOOD | OK | R-B |
| 66 | `strawberry` | 1 | FRUIT | OK | R-C:M1 |
| 67 | `sunflower-seeds` | 1 | NUT | OK | R-B |
| 68 | `sweet-bean-sauce` | 1 | SAUCE | SAUCE_LINE | R-B |
| 69 | `tortilla-chips` | 1 | COMPOSITE | COMPOSITE | R-B |
| 70 | `truffle` | 1 | COMPOSITE | OK (form: shaved/oil undecided) | R-B |
| 71 | `yakiniku-sauce` | 1 | SAUCE | SAUCE_LINE | R-C:M5 |
| 72 | `yogurt-sauce` | 1 | SAUCE | SAUCE_LINE | R-B |
| 73 | `zaatar` | 1 | SPICE | OK | R-C:M1 |

```json
{
 "baseline": {
  "mainCommit": "e6b205c",
  "shippedIngredients": 97,
  "shippedRecipes": 90,
  "target": 177,
  "unshippedRows": 87
 },
 "identityIncompleteRows": 40,
 "ingredientCount": 73,
 "ingredientKindCounts": {
  "CHEESE": 9,
  "COMPOSITE": 8,
  "DESSERT": 4,
  "FRUIT": 7,
  "LIQUID": 4,
  "MEAT": 2,
  "NUT": 2,
  "SAUCE": 13,
  "SEAFOOD": 4,
  "SPICE": 5,
  "VEG": 15
 },
 "ingredientRiskCounts": {
  "ALIAS": 10,
  "COMPOSITE": 5,
  "OK": 40,
  "PAIR": 8,
  "SAUCE_LINE": 10
 },
 "laneCounts": {
  "IN_FLIGHT": 3,
  "R-A": 11,
  "R-B": 30,
  "R-C:M1": 20,
  "R-C:M1+M2": 8,
  "R-C:M1+M3": 3,
  "R-C:M2+M6": 1,
  "R-C:M3": 2,
  "R-C:M4": 2,
  "R-C:M4+M5": 1,
  "R-C:M5": 3,
  "R-C:M6": 3
 },
 "ownerDecisionRows": 81,
 "ownerReasonCounts": {
  "BASE_SAUCE_UNSPECIFIED": 21,
  "COMPOSITION_CONFLICT_CANDIDATE": 13,
  "DISCOVERY_COLLISION": 1,
  "EVIDENCE_GAP": 2,
  "MECHANIC_INTERPRETATION": 11,
  "SCOPE_QUESTION": 2,
  "UNRESOLVED_INGREDIENT": 11,
  "dup:IDENTICAL_SET_AXIS_SEPARATED": 5,
  "dup:JACCARD_OVER_0.4_EXCEPTION": 6,
  "dup:SUBSET_OF_SHIPPED_FORBIDDEN": 2,
  "dup:SUPERSET_OF_SHIPPED_FORBIDDEN": 5,
  "review:PREPARED_COMPOSITE_INGREDIENT": 1,
  "review:SOURCE_INCONSISTENCY": 1
 },
 "singleUseIngredients": 65,
 "trackCounts": {
  "M1": 31,
  "M2": 9,
  "M3": 5,
  "M4": 3,
  "M5": 4,
  "M6": 4
 }
}
```
