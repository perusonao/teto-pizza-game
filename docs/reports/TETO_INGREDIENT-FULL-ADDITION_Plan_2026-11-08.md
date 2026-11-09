# TETO 食材全量追加 実装計画（未実装 70 種・11 バッチ）と Result Report（#780）

2026-11-08 / 基準 `origin/main` = **`348b1e4`**（#792 B20-A merge 後）。変更は本書 1 ファイルのみ（docs-only・新規。`src/`・`e2e/`・既存 docs・HOT ファイル・他 claim の成果物には触れていない）。**本書は計画であり、実装・merge・Production ON・共有 Preview 更新の承認ではない。**
凡例: 【実測】コード／データ／GitHub の読取り、【推論】実測からの解釈・見積もり。本セッションでは Vitest／CI は実行していない（依存未インストール。staged の数値は main 同梱の golden の読取り）。

Owner の既定方針（食材の**全量**追加が目標・新しい方針変更ではない・レシピ／調理法と並行・調査の繰り返しでなく実装へつなぐ）と既存の Owner 決定（G-1/G-2/P-1/R-1〜R-8/I-1〜I-3/M-0/H-1、D-1〜D-7、B19/B20-A の決定）は**変更していない**。全量を一部食材の優先追加に縮小していない（70/70 を下表で割当、対象漏れ 0 を機械検証）。

---

## 0. 報告（要約）

| 項目 | 値 |
|---|---|
| 最新の実装済み食材数 | **100**（`catalogLedger.test.ts`）。監査時点 97 + burrata(#783) + honey・walnut(#792) |
| 監査時点の未実装候補 | 73 |
| うち最新 main で実装済み | **3**（honey・walnut・burrata）【実測：`ingredients.ts` と 73 件の ID 照合】 |
| **未実装食材数（最新）** | **70** |
| 70 の内訳 | 新規 ID 追加 **63** ／ 既存 ID 再利用・統合（新規 ID なし）**7**（salsa・ground-beef・blue-cheese-dressing・chili-powder・cotija＝別名、nutella-spread・puntarelle＝統合） |
| 全バッチ | **B21〜B31 の 11 バッチ、合計 70 件**（§2。重複・漏れ 0） |
| 最初に実装するバッチ | **B21**（taco-pizza・okonomiyaki-style-pizza、食材 6 + 再利用 2）。staged で 8 項目確認済み。開始前提は §7 |
| 全量完了予定 | **中央値 2026-12-24**（楽観 12-12、悲観 2027-01-25）。算出根拠 §5 |
| Owner 判断が必要な項目 | §6（開始前提 4・全体 5） |

分類（70 件）: 実装済み 3（別枠）／未実装 70 = 新規 63 + 重複(再利用・統合) 7。「要判断」は 70 件中、判断待ちレーンの B23〜B26 に属する **28 件**（食材 25 + 再利用 3）が主で、B21/B22 の 19 件（新規 16 + 再利用 3）は準備済み、B27〜B31 の 23 件（新規 22 + 統合 1）は工程待ち（判断ではなく実装順）。

## 1. 確認した最新状態【実測】

| 対象 | 状態 | 本計画での扱い |
|---|---|---|
| main | `348b1e4`。recipes 93(Pinsa 開)/92、ingredients 100、ladder 78、late 導出番号は B20-A で +1 | 基準 |
| #780 本文＋コメント 8 件 | 全量先行・Staged Catalog・T-FX claim（`src/data/staged/**`、〜11/21）。Owner: 87/9 品の出所は未検証のものを使わない | 読み取り専用で再利用。T-FX の namespace に書かない |
| #792（B20-A） | **merge 済み**（`348b1e4`）。ただし実装 session の claim 6720288727／6720615107（HOT 全般・〜11/20）は **release 未確認** | **B21 開始前に release 確認が必要**（§7 前提 A） |
| #793 | B20-A の重複、close（branch 保持） | 対象外 |
| open PR | #775(PD-1a)・#776(DRIZZLE D1)・#738(STEAM S3)・#746(DRIZZLE lab)・#781(87 行再判定 docs)・#782(eggplant 未配線、変更は新規 glyph ファイルのみ)・#785(FOLD+SEAL F1 HOLD)。いずれも `ingredients.ts`/`recipes.ts` 等の HOT カタログを変更しない（#782 は変更ファイル一覧で確認） | 競合なし。`GameScreen.tsx` 等は直列規則（§4） |
| #417 icons / #778 / #779 | ハーブ #778 は merge 済み（`06cfc06`）。walnut SVG #777 は B20-A で配線済み | 新食材の専用 SVG は #417 のサブレーン |
| staged（T-FX） | 84 レシピ・70 食材を隔離登録済み。残件 343（#792 後）。`ready` 6 + `readyWithWork` 2 | 割当の入力。**staged 側の golden 再基準化は T-FX の担当** |

## 2. バッチ一覧（B21〜B31）【実測の依存＋推論の割当】

割当規則（決定的）: ① staged で全依存解決済みの宿主レシピを持つ食材 → B21/B22、② 追加の工程が不要で Owner 判断だけ待つ → B23〜B26（種別で束ねる）、③ 工程待ち → M-0 の順（M1>M5>M3>M2>M4>M6）に B27〜B31。1 食材 1 バッチ。再利用・統合は宿主レシピのあるバッチで「新規 ID なし」として完了扱い。

| バッチ | 内容 | 新規 | 再利用/統合 | 計 | 宿主レシピ（そのバッチで完成するもの）【推論】 | 解放条件 | 工程 |
|---|---|---|---|---|---|---|---|
| **B21** | 準備済み 1st train | 6 | 2 | **8** | taco-pizza・okonomiyaki-style-pizza | Q-1〜Q-5 承認 + 前提 A | 既存（late 1 段・PAINT・後乗せ） |
| **B22** | 準備可の残り | 10 | 1 | **11** | pizza-finocchi-salad・pizza-cavolo-carote・pizza-radicchio-noci・black-truffle-pizza・speck-e-brie-pizzadb・buffalo-chicken-pizzadb（ID 改名 2 件を先に） | B21 と同じ確認 8 項目、truffle の形（スライス／オイル）決定、balsamic の扱い（焼成前／後がけ #579） | 既存 |
| **B23** | デザート系 | 6 | 1 | **7** | apple-cinnamon-dessert・smore-dessert-pizza・nutella-dessert-pizza | D-1 個別判定、R-1 ソース（D-2 原典調査） | 既存 |
| **B24** | 生野菜・柑橘・スパイス | 6 | 2 | **8** | pizza-asparagi-limone・buffalo-cauliflower-pizza・jerusalem-mixed-grill-pizza・mexican-elote-pizza（lime は D-5 後乗せ、cotija→feta／chili-powder→paprika-powder は I-1 の Gate 次第） | D-1／D-3（唐辛子）／D-5 | 既存（後乗せ） |
| **B25** | 新ソース 6 種 | 6 | 0 | **6** | swedish-kebab・thai-chicken・peruvian-aji-amarillo・south-african-boerewors（+pizza-salad・peking-duck は B24/B26 待ち） | D-2 原典調査 22 件、New Sauces U0 手順（#578、`recipeSauceProfiles.ts`） | 既存（新ソース PAINT profile） |
| **B26** | 肉・魚介・調理済み複合 | 7 | 0 | **7** | chicken-tikka・diavola・frutti-di-mare・mentaiko-mochi・banh-mi(B22/B24 待ち)・peking-duck(B24/B25 待ち) | I-1 別名 Gate（chicken-tikka→chicken、spicy-salami→salami、mentaiko→cod-roe）、I-3 複合食材 | 既存 |
| **B27** | 生地の種類（M1） | 12 | 1 | **13** | fruit-dessert・poutine・manakish・pizza-carciofi-salad・cicoria-limone・puntarelle・focaccia-genovese（focaccia は R-8 除外候補）ほか | #577 PR #775 → PD-1b/c → PD-2（#738 後）→ PD-3 | M1 DOUGH_VARIANT |
| **B29** | 下ごしらえ（M5） | 2 | 0 | **2** | kimchi-pizza・yakiniku-pizza | #696 PREP の本番 ON 判断 | M5 PREP |
| **B30** | 包む／天板（M3+M2） | 2 | 0 | **2** | scacciata-ragusana・detroit-style-pizza | #773 F3 接続、M2 設計 Issue（要新設） | M3 ENCLOSE／M2 |
| **B28** | 焼成中（M4） | 4 | 0 | **4** | eel-pizza・natto-pizza（pizza-de-lomo-saltado は M4+M5） | M4 mid_bake 設計 Issue（要新設） | M4 MID_BAKE |
| **B31** | 工程順・積層（M6） | 2 | 0 | **2** | feteer-meshaltet（LAMINATE、R-8 除外候補・延期） | M6 設計 Issue（要新設） | M6 |
| **計** | | **63** | **7** | **70** | | | |

番号は種別順（B28 は M4、実行順は B29→B30→B28→B31＝M-0 の優先順）。実行順の累計（食材の新規 + 再利用）: B21 8 → B22 19 → B23 26 → B24 34 → B25 40 → B26 47 → B27 60 → B29 62 → B30 64 → B28 68 → B31 70。**工程不要の B21〜B26 で 47/70（67%）**。

食材を持たず既存食材だけで完成するレシピ（約 43 品）は食材の全量完了に影響せず、レシピ側ワークストリーム（A）が並行して扱う。

## 3. 全 70 件の分類・割当表（対象漏れ 0）

「新規追加」＝新しい ingredient id、「再利用/統合」＝既存 id の再利用または staged 内ペア統合で新規 id なし。別名候補付きの新規は重複 Gate（同一・部分・上位集合・1 材料差・Jaccard）に当たらない場合だけ再利用に切り替える（I-1）。実装済み 3 種（honey・walnut・burrata）は本表の外（別枠、二重計上なし）。

| # | id | 種別 | バッチ | 分類 | 種別/配置 | 宿主レシピ（staged） |
|---|---|---|---|---|---|---|
| 1 | `cheddar` | CHEESE | B21 | 新規追加 | cheese/scatter | taco-pizza |
| 2 | `lettuce` | VEG | B21 | 新規追加 | topping/scatter | taco-pizza, swedish-kebab-pizza, pizza-salad |
| 3 | `tortilla-chips` | COMPOSITE | B21 | 新規追加 | topping/scatter | taco-pizza |
| 4 | `okonomiyaki-sauce` | SAUCE | B21 | 新規追加 | sauce/spread | okonomiyaki-style-pizza |
| 5 | `cabbage` | VEG | B21 | 新規追加 | topping/scatter | okonomiyaki-style-pizza |
| 6 | `bonito-flakes` | SEAFOOD | B21 | 新規追加 | topping/scatter | okonomiyaki-style-pizza |
| 7 | `salsa` | SAUCE | B21 | 再利用/統合(新規IDなし) | sauce/spread | — (別名/統合先の側で使用) |
| 8 | `ground-beef` | MEAT | B21 | 再利用/統合(新規IDなし) | topping/scatter | — (別名/統合先の側で使用) |
| 9 | `fennel` | VEG | B22 | 新規追加 | topping/scatter | pizza-finocchi-salad |
| 10 | `orange` | FRUIT | B22 | 新規追加 | topping/scatter | pizza-finocchi-salad |
| 11 | `carrot` | VEG | B22 | 新規追加 | topping/scatter | banh-mi-pizza, pizza-cavolo-carote |
| 12 | `red-cabbage` | VEG | B22 | 新規追加 | topping/scatter | pizza-cavolo-carote |
| 13 | `sunflower-seeds` | NUT | B22 | 新規追加 | topping/scatter | pizza-cavolo-carote |
| 14 | `radicchio` | VEG | B22 | 新規追加 | topping/scatter | pizza-radicchio-noci |
| 15 | `balsamic-vinegar` | LIQUID | B22 | 新規追加 | sauce/spread | pizza-radicchio-noci |
| 16 | `truffle` | COMPOSITE | B22 | 新規追加 | topping/scatter | black-truffle-pizza |
| 17 | `brie` | CHEESE | B22 | 新規追加 | cheese/scatter | speck-e-brie-pizzadb |
| 18 | `buffalo-sauce` | SAUCE | B22 | 新規追加 | sauce/spread | buffalo-chicken-pizzadb |
| 19 | `blue-cheese-dressing` | SAUCE | B22 | 再利用/統合(新規IDなし) | sauce/spread | — (別名/統合先の側で使用) |
| 20 | `apple` | FRUIT | B23 | 新規追加 | topping/scatter | apple-cinnamon-dessert |
| 21 | `banana` | FRUIT | B23 | 新規追加 | topping/scatter | nutella-dessert-pizza |
| 22 | `chocolate` | DESSERT | B23 | 新規追加 / 統合:nutella-spread | topping/scatter | smore-dessert-pizza, nutella-dessert-pizza |
| 23 | `graham-cracker` | DESSERT | B23 | 新規追加 | topping/scatter | smore-dessert-pizza |
| 24 | `marshmallow` | DESSERT | B23 | 新規追加 | topping/scatter | smore-dessert-pizza |
| 25 | `powdered-sugar` | DESSERT | B23 | 新規追加 | topping/scatter | nutella-dessert-pizza |
| 26 | `nutella-spread` | SAUCE | B23 | 再利用/統合(新規IDなし) | sauce/spread | — (別名/統合先の側で使用) |
| 27 | `asparagus` | VEG | B24 | 新規追加 | topping/scatter | pizza-asparagi-limone |
| 28 | `cauliflower` | VEG | B24 | 新規追加 | topping/scatter | buffalo-cauliflower-pizza |
| 29 | `cucumber` | VEG | B24 | 新規追加 | topping/scatter | pizza-salad, peking-duck-pizza |
| 30 | `daikon` | VEG | B24 | 新規追加 | topping/scatter | banh-mi-pizza |
| 31 | `lime` | FRUIT | B24 | 新規追加 | topping/scatter | mexican-elote-pizza |
| 32 | `cumin` | SPICE | B24 | 新規追加 | topping/scatter | jerusalem-mixed-grill-pizza |
| 33 | `chili-powder` | SPICE | B24 | 再利用/統合(新規IDなし) | topping/scatter | — (別名/統合先の側で使用) |
| 34 | `cotija` | CHEESE | B24 | 再利用/統合(新規IDなし) | cheese/scatter | — (別名/統合先の側で使用) |
| 35 | `aji-amarillo` | SAUCE | B25 | 新規追加 | sauce/spread | peruvian-aji-amarillo |
| 36 | `chutney` | SAUCE | B25 | 新規追加 | sauce/spread | south-african-boerewors |
| 37 | `kebab-sauce` | SAUCE | B25 | 新規追加 | sauce/spread | swedish-kebab-pizza |
| 38 | `peanut-sauce` | SAUCE | B25 | 新規追加 | sauce/spread | thai-chicken-pizza |
| 39 | `sweet-bean-sauce` | SAUCE | B25 | 新規追加 | sauce/spread | peking-duck-pizza |
| 40 | `yogurt-sauce` | SAUCE | B25 | 新規追加 | sauce/spread | pizza-salad |
| 41 | `chicken-tikka` | COMPOSITE | B26 | 新規(別名候補: chicken / Gate次第) | topping/scatter | chicken-tikka-pizza |
| 42 | `liver-pate` | COMPOSITE | B26 | 新規追加 | topping/scatter | banh-mi-pizza |
| 43 | `mentaiko` | SEAFOOD | B26 | 新規(別名候補: cod-roe / Gate次第) | topping/scatter | mentaiko-mochi-pizza |
| 44 | `mochi` | COMPOSITE | B26 | 新規追加 | topping/scatter | mentaiko-mochi-pizza |
| 45 | `peking-duck` | COMPOSITE | B26 | 新規追加 | topping/scatter | peking-duck-pizza |
| 46 | `spicy-salami` | MEAT | B26 | 新規(別名候補: salami / Gate次第) | topping/scatter | diavola-pizza |
| 47 | `squid` | SEAFOOD | B26 | 新規追加 | topping/scatter | frutti-di-mare-pizzadb |
| 48 | `blueberry` | FRUIT | B27 | 新規追加 | topping/scatter | fruit-dessert-pizza |
| 49 | `kiwi` | FRUIT | B27 | 新規追加 | topping/scatter | fruit-dessert-pizza |
| 50 | `strawberry` | FRUIT | B27 | 新規追加 | topping/scatter | fruit-dessert-pizza |
| 51 | `celery` | VEG | B27 | 新規追加 | topping/scatter | pizza-carciofi-salad |
| 52 | `cheese-curd` | CHEESE | B27 | 新規追加 | cheese/scatter | poutine-pizza |
| 53 | `gravy-sauce` | SAUCE | B27 | 新規追加 | sauce/spread | poutine-pizza |
| 54 | `french-fries` | COMPOSITE | B27 | 新規追加 | topping/scatter | poutine-pizza, pizza-de-lomo-saltado |
| 55 | `halloumi` | CHEESE | B27 | 新規追加 | cheese/scatter | manakish |
| 56 | `zaatar` | SPICE | B27 | 新規追加 | topping/scatter | manakish |
| 57 | `chicory` | VEG | B27 | 新規追加 / 統合:puntarelle | topping/scatter | pizza-cicoria-limone, pizza-puntarelle |
| 58 | `pecorino` | CHEESE | B27 | 新規(別名候補: grana-padano / Gate次第) | cheese/scatter | pizza-cicoria-limone |
| 59 | `rock-salt` | SPICE | B27 | 新規追加 | topping/scatter | focaccia-genovese |
| 60 | `puntarelle` | VEG | B27 | 再利用/統合(新規IDなし) | topping/scatter | — (別名/統合先の側で使用) |
| 61 | `eel` | SEAFOOD | B28 | 新規追加 | topping/scatter | eel-pizza |
| 62 | `sansho-pepper` | SPICE | B28 | 新規追加 | topping/scatter | eel-pizza |
| 63 | `natto` | COMPOSITE | B28 | 新規追加 | topping/scatter | natto-pizza |
| 64 | `okra` | VEG | B28 | 新規追加 | topping/scatter | natto-pizza |
| 65 | `kimchi` | VEG | B29 | 新規追加 | topping/scatter | kimchi-pizza |
| 66 | `yakiniku-sauce` | SAUCE | B29 | 新規追加 | sauce/spread | yakiniku-pizza |
| 67 | `caciocavallo` | CHEESE | B30 | 新規追加 | cheese/scatter | scacciata-ragusana |
| 68 | `brick-cheese` | CHEESE | B30 | 新規(別名候補: mozzarella / Gate次第) | cheese/scatter | detroit-style-pizza |
| 69 | `condensed-milk` | LIQUID | B31 | 新規追加 | topping/scatter | feteer-meshaltet |
| 70 | `melted-butter` | LIQUID | B31 | 新規追加 | sauce/spread | feteer-meshaltet |

## 4. 食材データ・アイコン・描画・調理操作・レシピ依存

| 観点 | 現状（実装済み規約）【実測】 | 70 件への適用 |
|---|---|---|
| **食材データ** | 1 食材 = `ingredients.ts` の行 + `ingredientTaxonomy.ts`（family）+ `toppingSizeClass.ts` + ladder の新 step（key 材料）+ Hint 5.0/Research 測定 + `catalogLedger.test.ts`。staged は family 暫定。walnut の例のとおり family 変更は DH4-PROD gate（OD-DH4-2-9）で測る | 各バッチで family を 1 回測定。`other` を key にする組合せは到達不能ゲートに当たりうる |
| **アイコン** | 専用 SVG は `pieceVisual` ＋ `IngredientGlyph.tsx`（#417）。ない食材は一意な絵文字フォールバック（G18 で重複禁止）。B21 の 6 種は絵文字決定済み（🔶🪴🔺🍶🥬🪶） | 列車には絵文字（G18 一意）で載せ、専用 SVG は #417 サブレーン（新規ファイルは並行可、`IngredientGlyph.tsx` の配線は Integrator の列車 PR か #417 配線 PR のどちらか一方） |
| **描画** | spread（ソース・液体、`recipeSauceProfiles.ts`）／scatter（トッピング・チーズ、`toppingSizeClass`）。POST_BAKE は late カタログ（`lateCatalog.ts`、late 専用食材は通常レシピ不可） | ソース 13＋液体 3＝spread、他は scatter。lettuce・tortilla-chips・nori は後乗せ（B21）。balsamic・condensed-milk・melted-butter は後がけ（#579）か焼成前かの区別が要（Owner 判断 O-5） |
| **調理操作** | 既存: PAINT／scatter／POST_BAKE。ゲート OFF で実装済み: PREP・FRY・STEAM・SEAR | B21〜B26 は**新操作不要**。B27 DOUGH_VARIANT、B29 PREP、B30 ENCLOSE/PAN、B28 MID_BAKE、B31 STEP_ORDER/ZONED/LAMINATE |
| **レシピ依存** | 食材は ladder の key レシピと同時に出る（単独追加は不可）。複数バッチにまたがる宿主（pizza-salad=B21+B24+B25、banh-mi=B22+B24+B26、peking-duck=B24+B25+B26）は**最後の食材のバッチで完成** | 先に出た食材は別宿主（または late 項目）で key になる必要がある。単独出荷を許すかは Owner 判断 O-6 |

## 5. 担当分担・競合回避・実行順

| ワークストリーム | 担当（固定） | 範囲 | 競合確認 |
|---|---|---|---|
| **Catalog Integrator（単一 session）** | B21〜B31 の昇格 PR を**直列**で担当 | HOT カタログ群・`catalogLedger.test.ts`・`expansionBatch*.test.ts`・hint5 golden（plan §6 の固定表） | 他 claim と HOT の重なりなし（§1）。ただし #792 session の claim が残る間は不可（前提 A） |
| **T-FX（既存 claim）** | staged の保守・golden 再基準化・what-if 測定 | `src/data/staged/**`、`TETO_FULL-EXPANSION-177_*` | **claim は奪わない**。各バッチ merge 後の staged 期待値の更新は T-FX へ依頼（B19／B20-A の先例どおり、PR で最小の期待値編集だけを許す場合は claim コメントに明記） |
| **#417 icons** | 新食材の専用 SVG（新規ファイル）。B21→B22 の順に | `src/components/<name>Glyph/**` | #782（eggplant）と別名前空間 |
| **WS-M 調理法** | M1 #577（PR #775 起点）／M5 #696・#749・#784／M3 #773（F1=#785 HOLD）／M2・M4・M6 は設計 Issue 新設後 | `src/logic/<mechanic>/**`、各 Gate 定数 | 既存 PR 線を尊重。`GameScreen.tsx`・`App.css`・`gameReducer.ts` は**直列**（#738 → M1 PD-2 → M5 → M3 → M2 → M4 → M6） |
| **レシピ WS-R（A）** | 食材を持たない約 43 レシピ。本計画と同じ Integrator の列車に相乗り | 食材全量の完了に影響しない | レシピは列車の空き枠（各 PR 2〜6 品）で並行 |
| **Owner** | 一括判断（§6）、列車ごとの iPhone HV 1 回、merge | — | 無断 merge・Production ON・共有 Preview 更新は禁止 |

実行順: B21 → B22 → B23 → B24 → B25 → B26 →（M1 完了後）B27 →（M5 本番 ON 判断後）B29 →（M3/M2 後）B30 →（M4 後）B28 →（M6 後）B31。HOT を触る PR は常に 1 本、直前の merge 後に rebase。B23 以降の宿主レシピは、D-6（Research 正準順の変化は未承認）で止まる 26 品を避けて選ぶ（出荷済みの文字は動かさない）。

## 6. 見積もり【推論】

**実績（git／GitHub の実測）**: 通常バッチの merge は B12（10-31）〜B20-A（11-09 02:02 JST）で約 9 バッチ／10 日。直近の間隔は B18（11-06 22:15）→ B19（11-08 14:58）が約 40 時間、B19 → B20-A が約 11 時間（B20-A は HOLD 明け）。直近の Owner HV は B19 が 12/12 PASS、B20-A が 6/6 PASS（#790 の記録）。B20-A が B19 の merge を待った HOLD 時間を除くと、律速は CI・Codex ではなく Owner の HV／判断の到着と見られる（推論）。

**前提**: 1 列車 = CI（WebKit 含む）＋ Codex ＋ iPhone HV 1 回。HOT 直列のため列車間は 1 本ずつ。サイクルは中央 1.7 日（実績の最大側を採用）、楽観 1.0 日、悲観 3.0 日。一括判断は中央 11-14、楽観 11-11、悲観 11-21 に届くとする。

| バッチ | 内容 | 楽観 | **中央** | 悲観 | 律速 |
|---|---|---|---|---|---|
| B21 | taco・okonomiyaki | 11-10 | **11-11** | 11-15 | 前提 A・Q-1〜Q-5、HV |
| B22 | 準備可 6 品 | 11-11 | **11-13** | 11-18 | HV |
| B23 | デザート | 11-13 | **11-16** | 11-24 | D-1／D-2 |
| B24 | 生野菜・スパイス | 11-15 | **11-18** | 11-27 | D-1／D-3 |
| B25 | 新ソース | 11-17 | **11-22** | 12-05 | D-2 原典調査、U0 |
| B26 | 肉・魚介・複合 | 11-19 | **11-25** | 12-10 | I-1 Gate、I-3 |
| B27 | M1 生地 | 11-30 | **12-06** | 12-25 | #775 → PD-1b/c → PD-2（#738 後）→ PD-3 |
| B29 | M5 PREP | 12-01 | **12-10** | 12-31 | PREP 本番 ON 判断 |
| B30 | M3+M2 | 12-05 | **12-17** | 01-15 | F3 接続・M2 設計 Issue |
| B28 | M4 | 12-08 | **12-20** | 01-20 | M4 設計 Issue |
| B31 | M6 | 12-12 | **12-24** | 01-25 | M6 設計 Issue、LAMINATE 延期 |
| **全量（70/70）** | | **12-12** | **12-24** | **2027-01-25** | クリティカルパスは工程側（GameScreen 直列 6 本 × 約 4 日 ≈ 24 日、#738 の merge 後起算） |

工程不要の B21〜B26（47/70）は中央 **11-25**。#780 の仮見積もり 35／70／140 日（起算 11-06）は 12-11／01-15／03-26 で、本見積もりの楽観(12-12)≒35 日、中央(12-24)は 35〜70 日の間、悲観(01-25)は 70 日以内。サンプルは約 9 バッチ・1 リポジトリで少なく、工程トラックは実績のない新規 Issue を含むため、**工程側の日付は B21〜B26 より精度が低い**。各バッチ merge ごとに実測で更新する（#780 のチェックポイント「35／70／140 日の見積もり更新」に対応）。

## 7. Owner 判断が必要な項目（一括・推奨つき・既存決定は再質問しない）

**開始前提（B21 を始めるために必要）**

| ID | 内容 | 推奨 |
|---|---|---|
| **A** | #792 session の claim（6720288727／6720615107、HOT 全般、〜11/20）の release。PR は merge 済み。release 後に B21 の claim を #780 に新規投稿 | release を承認（B19 時の代理 release 先例どおり） |
| **Q-1** | taco／okonomiyaki を late カタログに置く（nori を後乗せ） | late カタログ |
| **Q-2** | Research 非正準順で文字が変わる出荷済み 17 ID の個別承認（正準順 0。ID 一覧は `src/data/staged/__golden__/firstTrain.research.json`） | 承認（Batch 19 AC-8 と同じ扱い） |
| **Q-3** | 暫定の数量・名前・色・絵文字（原典 pizzadb.jp 未確認） | 承認。専用 SVG は後で #417 |

**全体（B22 以降）**

| ID | 内容 | 推奨 |
|---|---|---|
| O-4 | D-1 個別判定 39 品（資料は staged golden `d1Dossier`）。B23〜B26 の宿主を決める | 工程差のある 21 品から先に判定 |
| O-5 | 液体 3＋balsamic の扱い（焼成前ソース／後がけ #579）、truffle の形 | truffle=スライス（トッピング）、液体は #579 の後 |
| O-6 | 食材の単独出荷（宿主レシピが後のバッチ）を許すか | 宿主が揃うバッチまで出荷しない（B25/B26 の跨ぎ宿主は最後の食材のバッチ） |
| O-7 | D-2 原典調査（22 品）の担当：ChatGPT 側 web 調査へ引き渡し（Session Ops §8.2） | 引き渡し。未確認は未確認のまま |
| O-8 | M2／M4／M6 の設計 Issue 新設と、LAMINATE（feteer）・focaccia・peking-duck の R-8 除外扱い（B27/B31 の件数に影響：除外すると食材 melted-butter・condensed-milk・rock-salt・peking-duck が「全量」から外れる） | **除外は Owner が決める**（本計画は 70/70 を維持し、除外は縮小に当たるため勝手に行わない） |

## 8. 最初のバッチ B21 — 実装開始キット

**宿主**: `taco-pizza`（tomato-sauce 1 PAINT／cheddar 2／beef 3／fresh-tomato 2／lettuce 2 POST_BAKE／tortilla-chips 2 POST_BAKE）と `okonomiyaki-style-pizza`（okonomiyaki-sauce 1 PAINT／cabbage 3／pork 3／mayo 1／bonito-flakes 2／nori 1 POST_BAKE）。配置は late カタログ。数量・窓（58〜78）・報酬 100 Pitz・Lunch Rush なし・CUT なし・key-free Hint は `src/data/staged/stagedPromotionCandidates.ts` が正本（そのまま複写）。

**確認済み（staged、`stagedPromotion.firstTrain.test.ts`）【実測 golden 読取り】**: `validateLateCatalog` 問題 0／材料参照・数量・ソース 1 つ／絵文字 G18 重複なし／重複 Gate 0／Research 正準順で既存ラベル変化 0（非正準順 17 品は Q-2）／Hint 5.0 対象・既存 ladder 影響なし／保存安全性（未知 id 保持・読込で書込なし）。

**編集ファイル（`PROMOTION_TOUCHES`）**: `lateCatalog.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`catalogLedger.test.ts`・golden、必要なら `recipes.ts`（HOT）。`src/data/staged/**` は期待値の最小追従のみ（T-FX 先例、claim コメントに明記）。

**手順**: 前提 A・Q-1〜Q-3 の承認 → #780 に claim（下記ドラフト）→ main から branch → candidates を late カタログへ複写 → 件数・golden 追従 → Vitest／tsc／lint → PR（Draft）→ CI・Codex（最新 HEAD）→ 代表レシピで 390×844 自動プレイ＋スクリーンショット（`docs/reports/screenshots/b21/`）→ Owner iPhone HV 1 回（動画は直接 Owner へ、repo にコミットしない）。

**停止条件**: claim 競合／正準順の既存 Research ラベル変化 1 件でも／非正準順が Q-2 の 17 ID と不一致／重複 Gate 該当／保存互換性の問題。**含めない**: merge・Production ON・共有 Preview 更新・B22 の 4 品・専用 SVG 配線。

**claim ドラフト（承認後に #780 へ投稿。本セッションでは投稿していない）**:
```
claim（B21: taco-pizza・okonomiyaki-style-pizza の昇格、late カタログ）
branch claude/b21-taco-okonomiyaki-780 / base main 348b1e4
files: src/data/lateCatalog.ts, src/data/recipeHintRoles.ts, src/data/recipeSauceProfiles.ts, src/data/referencePizza.ts,
  src/data/recipes.ts(必要時), src/data/catalogLedger.test.ts, src/data/expansionBatch*.test.ts, src/data/lateCatalog.*.test.ts,
  src/data/__golden__/**, src/logic/discovery/__golden__/**, src/data/staged/__golden__/**(期待値追従のみ),
  e2e/b21*.spec.ts, docs/reports/TETO_EXPANSION-BATCH-21_*, docs/reports/screenshots/b21/**
dependsOn: #792 claim release
```

## 9. Result Report（#780 整合・四項目）

- **完了**: 最新 main `348b1e4` で食材 100 を確認し、73 候補を ID 照合（実装済み 3／未実装 70）。70 件を 11 バッチに割当（新規 63・再利用／統合 7、重複・漏れ 0 を機械検証）。データ・アイコン・描画・操作・レシピ依存の整理、担当分担と実行順、バッチ別／全量の見積もり、B21 の開始キットを作成。
- **未完了**: 実装（B21〜B31）は未着手。原典 pizzadb.jp は未確認（暫定仕様）。D-1 個別判定 39 品・D-2 原典調査 22 品。M2／M4／M6 の設計 Issue 未起票。本セッションでは Vitest／CI を実行していない。
- **ブロッカー**: 前提 A（#792 claim の release）、Q-1〜Q-3、一括判断 O-4〜O-8。B27 以降は各工程トラックの既存 Gate（#775／#738／#696／#773）。
- **次の行動**: Owner が前提 A と Q-1〜Q-3 を承認 → #780 に B21 claim → B21 を実装（Draft PR まで）。merge・Production ON・共有 Preview 更新は行わない。
