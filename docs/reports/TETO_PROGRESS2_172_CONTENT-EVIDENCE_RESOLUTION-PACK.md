# Progression 2.0 / 172 recipes — Content Evidence Resolution Pack（Fresh Audit）

## 0. 結論

監査の基準は PR #220 head `e49dab96bd9b26dc0f520349cf09d1160c3519f5`（OPEN・変更なし）と、roadmap commit `d5909ece70b0dc57efadcd17715493ea882daf4f`（branch `claude/teto-pizza-resolution-roadmap-yf4l4i`）。どちらも GitHub 上の最新状態と一致することを確認した。main は `dff233c042d2df6ee1c3a92f2d2419830aa05460`。本書は実装タスクではない。runtime 実装より前に解くべき content / evidence / decision 問題を、**同じ調査・同じ Owner Decision でまとめて解ける単位（Evidence Batch）** に組み直した。

- 最優先 3 分類は primaryClass で sauce selection **28**・composition disagreement **23**・ingredient alias **20** 行。primary 以外の分類も数えた問題 item では sauce **33**（33 行）・composition **27**（27 行）・alias **24**（21 行）。
- runtime 以外の evidence / decision item は全部で 142 件ある。これを **Evidence Batch 19 件** に割り当てた。最優先 3 分類を扱うのは EB-01〜EB-13 の 13 件。
- alias 24 件はすべて **unresolved** のままとした。exact / likely_alias に当たるものは無い（canonicalizer の判定は `ambiguous`）。relatedIds はあくまで候補で、canonical 化はしていない。
- sauce 33 件のうち、supported union（tomato-sauce / pesto / olive-oil）を選べる余地があるのは family `その他` の 10 件だけ。残り 23 件は family label と矛盾しない結論がすべて **unsupported/new sauce** になるため、evidence を確定しても `UNSUPPORTED_SAUCE_ID_CONTRACT` が残る。
- 最優先の EB-01〜EB-13 を解いた場合、content authoring へ進める行は次のとおり。
  - 結論に関係なく進める: **3 行**
  - runtime を伴わない結論になった場合に進める: **14 行**（上の 3 行を含む）
  - shipped keep（shipped recipe を変えない）なら correspondence として閉じ、authoring 自体が要らない: **9 行**
  - evidence / decision は閉じても runtime capability が残る: **43 行**（最良ケース）
  - 他の batch の item がまだ残る: **38 行**
- 全 19 batch を解いた場合は次のとおり。
  - content authoring へ進める: 結論に関係なく **8 行**、runtime を伴わない結論なら最大 **20 行**
  - correspondence として閉じ得る: **9 行**
  - runtime capability がまだ必要: 最良ケース **75 行** / 最悪ケース **94 行**（最悪ケースには W0 の adopt 7 行を含む）
- roadmap の判定と違う点（§9 で詳述）:
  - composition で catalog 側（A）を選ぶと、5 行（speck-e-brie / boscaiola / porcini / fugazzetta / black-truffle）で `SAUCELESS_RECIPE_CONTRACT` の確定依存が消える。A の sauce が supported union 内にあるため。
  - shipped の quattro-formaggi / fugazza で PIZZA DB 側を adopt すると `SAUCELESS_RECIPE_CONTRACT` が新たに必要になる。
  - 唐辛子系 token を scatter の新 id として確定すれば runtime は要らない。
- minCount / bakeTarget の値は今回決めていない。数えたのは authoring に進める行数だけ。canonical id・sauce id・composition A/B・mechanic confirm/drop はいずれも確定していない。

## 1. 基準・入力の確認

| 項目 | 指定値 | GitHub 最新 | 判定 |
|---|---|---|---|
| PR #220 head | `e49dab96bd9b26dc0f520349cf09d1160c3519f5` | `e49dab96bd9b26dc0f520349cf09d1160c3519f5`（OPEN, mergeable_state=clean, 4 commits） | 一致 |
| roadmap branch `claude/teto-pizza-resolution-roadmap-yf4l4i` | `d5909ec` | `d5909ece70b0dc57efadcd17715493ea882daf4f` | 一致 |
| roadmap doc / JSON | `TETO_PROGRESS2_172_UNRESOLVED_RESOLUTION-ROADMAP.{md,json}` | d5909ec に存在 | 一致 |
| PR #220 base (main) | — | `dff233c042d2df6ee1c3a92f2d2419830aa05460` | roadmap basis と一致 |

roadmap JSON の `basis.inputs`（#220 UNRESOLVED / WAVES JSON、#189 matrix）の sha256 を git object から計算し直し、一致を確認した。本書で使った入力とその sha256 は JSON の `basis.inputs` に記録してある。PIZZA DB の行データは、以前の session が中継したものをそのまま使っている（本 session では外部から再取得していない）。

制約の遵守: `src/**` と `e2e/**` は変更していない。runtime 実装なし。PR #220 と既存 PR は変更していない。PR は作成していない。Full CI / WebKit は実行していない。canonical id・sauce・composition の Owner Decision は確定していない。

## 2. 現行 sauce contract との関係

`src/data/recipeSauceProfiles.ts`（main, read-only）の内容:

- `RecipeSauceProfile.ingredientId` は closed union `olive-oil | pesto | tomato-sauce`
- `RECIPE_SAUCE_PROFILES` は exhaustive Readonly<Record<RecipeId, RecipeSauceProfile>>
- test は、profile の ingredientId が recipe の sauce-category 必須 ingredient と一致することを assert している
- interaction は tomato-sauce / pesto が PAINT、olive-oil が PAINT_TEMPORARY

| sauce の結論 | contract 上の扱い | runtime |
|---|---|---|
| tomato-sauce | content only (profile entry) | 不要（content） |
| pesto | content only (profile entry) | 不要（content） |
| olive-oil | content only (profile entry, PAINT_TEMPORARY) | 不要（content） |
| sauceless | SAUCELESS_RECIPE_CONTRACT (type + test change) | 必要 |
| unsupported/new sauce | UNSUPPORTED_SAUCE_ID_CONTRACT (union widening) + new sauce ingredient authoring | 必要 |
| second spread layer | MULTI_SPREAD_LAYER (single ingredientId -> ordered list) | 必要 |

このため、sauce の evidence を確定しても、runtime が要らなくなるのは結論が tomato-sauce / pesto / olive-oil のいずれかになった場合だけである。

## 3. Sauce selection（33 item / 33 行、primary 28）

### 3.1 family 別の構造

| family | 行 | #189 family 候補 id | 結論の範囲（evidence と矛盾しないもの） | batch |
|---|---:|---|---|---|
| その他 | 10 | `(any listed spread)` | tomato-sauce / pesto / olive-oil / sauceless / unsupported・new のすべてが構造上可能 | EB-01 |
| カレー | 5 | `curry-ketchup` | unsupported・new sauce のみ（tomato / pesto / olive-oil / sauceless は family label と矛盾） | EB-02 |
| ホワイトソース | 4 | `fresh-cream-sauce`, `fromage-blanc-sauce` | unsupported・new sauce のみ（tomato / pesto / olive-oil / sauceless は family label と矛盾） | EB-03 |
| ホットソース | 6 | `buffalo-sauce`, `chili-oil`, `doubanjiang` | unsupported・new sauce のみ（tomato / pesto / olive-oil / sauceless は family label と矛盾） | EB-04 |
| 甘辛だれ | 4 | `miso-sauce`, `okonomiyaki-sauce`, `sweet-bean-sauce`, `teriyaki-sauce`, `yakiniku-sauce` | unsupported・new sauce のみ（tomato / pesto / olive-oil / sauceless は family label と矛盾） | EB-05 |
| デザートソース | 4 | `nutella-spread` | unsupported・new sauce のみ（tomato / pesto / olive-oil / sauceless は family label と矛盾） | EB-06 |

ambiguity type: `SINGLE_CANDIDATE_FAMILY` 8 / `MULTI_CANDIDATE_FAMILY+LISTED_SPREAD_MAY_BE_BASE` 10 / `MULTI_CANDIDATE_FAMILY` 4 / `OPEN_FAMILY_ANY_SPREAD` 10 / `SINGLE_CANDIDATE_FAMILY+LISTED_SPREAD_MAY_BE_BASE` 1。`+LISTED_SPREAD_MAY_BE_BASE` は、行内に列挙された spread（mayo / honey / kebab-sauce / chutney / blue-cheese-dressing / melted-butter）が base そのものなのか、追加の層なのかが未確定であることを表す。追加の層なら `MULTI_SPREAD_LAYER` が必要になる。

### 3.2 行別（sauce option matrix）

列の見方: **T / P / O / 無 / 新** は、それぞれ tomato-sauce / pesto / olive-oil / sauceless / unsupported・new sauce を結論として選べるか。○ = evidence と矛盾せず選べる、× = family label と矛盾する。

| evidenceId | nameJa | wave | family | 行内 spread | T | P | O | 無 | 新（候補） | evidence status | 共通判断 | 固有判断 | 解決後に残るもの（min / max） | batch |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `banh-mi-pizza-pizzadb-p6` | バインミーピザ | W3 | その他 | — | ○ | ○ | ○ | ○ | ○（新 id（dish 固有ソース）） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 0; rt なし / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-01 |
| `caponata-pizza-pizzadb-p2` | カポナータピザ | W3 | その他 | — | ○ | ○ | ○ | ○ | ○（新 id（dish 固有ソース）） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 0; rt なし / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-01 |
| `goulash-pizza-pizzadb-p3` | グヤーシュピザ | W3 | その他 | — | ○ | ○ | ○ | ○ | ○（新 id（dish 固有ソース）） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 0; rt なし / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-01 |
| `jamaican-jerk-chicken-pizza-pizzadb-p3` | ジャマイカンジャークチキンピザ | W3 | その他 | — | ○ | ○ | ○ | ○ | ○（新 id（dish 固有ソース）） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 0; rt なし / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-01 |
| `jerusalem-mixed-grill-pizza-pizzadb-p1` | エルサレムミックスグリルピザ | W3 | その他 | — | ○ | ○ | ○ | ○ | ○（新 id（dish 固有ソース）） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 0; rt なし / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-01 |
| `natto-pizza` | 納豆ピザ | W4 | その他 | — | ○ | ○ | ○ | ○ | ○（新 id（dish 固有ソース）） | 個別profile・裏付け1件 | PARTIAL | YES | open 0; rt LATE_ADDITION / LATE_ADDITION, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-01 |
| `nigerian-suya-pizza-pizzadb-p5` | ナイジェリアンスヤピザ | W3 | その他 | — | ○ | ○ | ○ | ○ | ○（新 id（dish 固有ソース）） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 0; rt なし / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-01 |
| `palmitos-salsa-golf-pizzadb-p7` | パルミートス・イ・サルサ・ゴルフ | W4 | その他 | — | ○ | ○ | ○ | ○ | ○（新 id（dish 固有ソース）） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 0; rt DOUGH_VARIANT / DOUGH_VARIANT, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-01 |
| `pizza-de-lomo-saltado` | ロモ・サルタード・ピザ | W4 | その他 | — | ○ | ○ | ○ | ○ | ○（新 id（dish 固有ソース）） | 個別profile・裏付け1件 | PARTIAL | YES | open 0; rt LATE_ADDITION, PREP_STEP / LATE_ADDITION, PREP_STEP, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-01 |
| `ume-shiso-pizza-pizzadb-p14` | 梅しそピザ | W3 | その他 | — | ○ | ○ | ○ | ○ | ○（新 id（dish 固有ソース）） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 0; rt なし / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-01 |
| `baingan-bharta-pizza-pizzadb-p6` | バインガンバルタピザ | W3 | カレー | — | × | × | × | × | ○（curry-ketchup, 新 id） | 比較表のみ・裏付け0件 | YES | CONDITIONAL | open 0; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-02 |
| `chicken-tikka-pizza-pizzadb-p5` | チキンティッカピザ | W3 | カレー | — | × | × | × | × | ○（curry-ketchup, 新 id） | 比較表のみ・裏付け0件 | YES | CONDITIONAL | open 1; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-02 |
| `keema-pizza-pizzadb-p2` | キーマピザ | W3 | カレー | — | × | × | × | × | ○（curry-ketchup, 新 id） | 比較表のみ・裏付け0件 | YES | CONDITIONAL | open 2; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-02 |
| `rendang-pizza-pizzadb-p14` | ルンダンピザ | W3 | カレー | — | × | × | × | × | ○（curry-ketchup, 新 id） | 比較表のみ・裏付け0件 | YES | CONDITIONAL | open 0; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-02 |
| `tandoori-paneer-pizza-pizzadb-p5` | タンドリーパニールピザ | W3 | カレー | — | × | × | × | × | ○（curry-ketchup, 新 id） | 比較表のみ・裏付け0件 | YES | CONDITIONAL | open 0; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-02 |
| `mentaiko-mochi-pizza` | 明太子もちピザ | W3 | ホワイトソース | mayo | × | × | × | × | ○（fresh-cream-sauce, fromage-blanc-sauce, mayo, 新 id） | 個別profile・裏付け1件 | YES | PARTIAL | open 1; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-03 |
| `mexican-elote-pizza-pizzadb-p13` | メキシカンエロテピザ | W3 | ホワイトソース | mayo | × | × | × | × | ○（fresh-cream-sauce, fromage-blanc-sauce, mayo, 新 id） | 比較表のみ・裏付け0件 | YES | PARTIAL | open 1; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-03 |
| `potato-mayo-pizza-pizzadb-p3` | じゃがマヨピザ | W3 | ホワイトソース | mayo | × | × | × | × | ○（fresh-cream-sauce, fromage-blanc-sauce, mayo, 新 id） | 比較表のみ・裏付け0件 | YES | PARTIAL | open 1; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-03 |
| `venezuelan-reina-pepiada-pizzadb-p12` | ベネズエラレイナペピアーダピザ | W3 | ホワイトソース | mayo | × | × | × | × | ○（fresh-cream-sauce, fromage-blanc-sauce, mayo, 新 id） | 比較表のみ・裏付け0件 | YES | PARTIAL | open 1; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-03 |
| `buffalo-cauliflower-pizza-pizzadb-p6` | バッファローカリフラワーピザ | W3 | ホットソース | blue-cheese-dressing | × | × | × | × | ○（buffalo-sauce, chili-oil, doubanjiang, blue-cheese-dressing, 新 id） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 1; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-04 |
| `kimchi-pizza-pizzadb-p2` | キムチピザ | W4 | ホットソース | — | × | × | × | × | ○（buffalo-sauce, chili-oil, doubanjiang, 新 id） | 比較表のみ・裏付け1件 | PARTIAL | YES | open 0; rt PREP_STEP, UNSUPPORTED_SAUCE_ID_CONTRACT / PREP_STEP, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-04 |
| `nashville-hot-chicken-pizza-pizzadb-p6` | ナッシュビルホットチキンピザ | W3 | ホットソース | honey | × | × | × | × | ○（buffalo-sauce, chili-oil, doubanjiang, honey, 新 id） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 1; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-04 |
| `nduja-pizza-pizzadb-p14` | ンドゥイヤピザ | W3 | ホットソース | honey | × | × | × | × | ○（buffalo-sauce, chili-oil, doubanjiang, honey, 新 id） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 2; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-04 |
| `peruvian-aji-amarillo-pizzadb-p12` | ペルーアヒアマリージョピザ | W3 | ホットソース | — | × | × | × | × | ○（buffalo-sauce, chili-oil, doubanjiang, 新 id） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 0; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-04 |
| `swedish-kebab-pizza-pizzadb-p4` | スウェディッシュケバブピザ | W3 | ホットソース | kebab-sauce | × | × | × | × | ○（buffalo-sauce, chili-oil, doubanjiang, kebab-sauce, 新 id） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 2; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-04 |
| `bulgogi-pizza-pizzadb-p11` | プルコギピザ | W3 | 甘辛だれ | — | × | × | × | × | ○（miso-sauce, okonomiyaki-sauce, sweet-bean-sauce, teriyaki-sauce, yakiniku-sauce, 新 id） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 0; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-05 |
| `eel-pizza-pizzadb-p1` | うなぎピザ | W4 | 甘辛だれ | — | × | × | × | × | ○（miso-sauce, okonomiyaki-sauce, sweet-bean-sauce, teriyaki-sauce, yakiniku-sauce, 新 id） | 比較表のみ・裏付け1件 | PARTIAL | YES | open 1; rt LATE_ADDITION, UNSUPPORTED_SAUCE_ID_CONTRACT / LATE_ADDITION, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-05 |
| `south-african-boerewors-pizzadb-p14` | 南アフリカボアヴォースピザ | W3 | 甘辛だれ | chutney | × | × | × | × | ○（miso-sauce, okonomiyaki-sauce, sweet-bean-sauce, teriyaki-sauce, yakiniku-sauce, chutney, 新 id） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 2; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-05 |
| `teriyaki-chicken-pizza-pizzadb-p14` | 照り焼きチキンピザ | W4 | 甘辛だれ | mayo | × | × | × | × | ○（miso-sauce, okonomiyaki-sauce, sweet-bean-sauce, teriyaki-sauce, yakiniku-sauce, mayo, 新 id） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 2; rt LATE_ADDITION, UNSUPPORTED_SAUCE_ID_CONTRACT / LATE_ADDITION, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-05 |
| `apple-cinnamon-dessert-pizzadb` | アップルシナモンデザートピザ | W3 | デザートソース | — | × | × | × | × | ○（nutella-spread, 新 id） | 比較表のみ・裏付け1件 | PARTIAL | YES | open 0; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-06 |
| `feteer-meshaltet-pizzadb-p10` | フェテイールメシャルテル | W5 | デザートソース | honey, melted-butter | × | × | × | × | ○（nutella-spread, honey, melted-butter, 新 id） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 2; rt LAMINATE, MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT / LAMINATE, MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-06 |
| `fruit-dessert-pizza-pizzadb-p11` | フルーツデザートピザ | W4 | デザートソース | — | × | × | × | × | ○（nutella-spread, 新 id） | 比較表のみ・裏付け0件 | PARTIAL | YES | open 0; rt DOUGH_VARIANT, UNSUPPORTED_SAUCE_ID_CONTRACT / DOUGH_VARIANT, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-06 |
| `smore-dessert-pizza-pizzadb-p4` | スモアデザートピザ | W4 | デザートソース | — | × | × | × | × | ○（nutella-spread, 新 id） | 比較表のみ・裏付け1件 | PARTIAL | YES | open 0; rt LATE_ADDITION, UNSUPPORTED_SAUCE_ID_CONTRACT / LATE_ADDITION, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-06 |

「解決後に残るもの」は、その sauce item だけを解いた場合の値。open は同じ行に残る evidence / decision item の数、rt は runtime unit（min = runtime を最小にする結論 / max = runtime を最大にする結論）。

## 4. Ingredient alias（24 item / 21 行、primary 20）

canonicalizer（`tools/progression2_ingredient_canonicalizer.py`, main）の `AMBIGUOUS_TABLE` に入っている token は、どれも **exact でも likely_alias でもない**。本書ではすべて `unresolved` として扱い、relatedIds は候補として記録するだけにした。

### 4.1 token 別

| token | 行数 | alias status | canonical candidate（relatedIds） | ambiguity type | taxonomy flag | canonicalizer の理由（要約） | 下流 runtime（min / max） | batch |
|---|---:|---|---|---|---|---|---|---|
| ひき肉 | 5 | unresolved | `ground-beef` | GENERIC_UNSPECIFIED | — | Phase 0B's 'ground-beef' is taco-specific; ひき肉 (ground meat) is generic and could be pork/mixed -- not merged  | なし / なし | EB-07 |
| 唐辛子 | 5 | unresolved | `chili-oil` | CLASS_MISMATCH_SCATTER_VS_SPREAD | — | Plain 'chili pepper' (color/type unspecified) -- part of the existing chili/chili-oil naming-ambiguity group ( | なし / MULTI_SPREAD_LAYER | EB-08 |
| チーズ | 3 | unresolved | `mozzarella` | GENERIC_UNSPECIFIED | generic_unspecified | GENERIC 'cheese' with no specific variety named -- cannot be resolved to one canonical cheese id without more  | なし / なし | EB-09 |
| ホワイトソース | 2 | unresolved | `fromage-blanc-sauce` | SAUCE_NOT_TOPPING | sauce_not_topping | GENERIC 'white sauce' -- may or may not be the same as the specific fromage-blanc-sauce Phase 0B introduced fo | UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-03 |
| カレーソース | 1 | unresolved | `curry-ketchup` | SAUCE_NOT_TOPPING | sauce_not_topping | A more generic curry sauce than the specific curry-ketchup Phase 0B introduced for currywurst -- not merged. | UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-02 |
| スパイシーソーセージ | 1 | unresolved | `sausage` | DISTINCT_VARIANT_OF_RELATED_ID | — | A spicier variant of existing sausage -- not confirmed to be the same game ingredient. | なし / なし | EB-10 |
| チーズソース | 1 | unresolved | `mozzarella` | SAUCE_NOT_TOPPING | sauce_not_topping | TAXONOMY: this is a SAUCE (cheese sauce), not a scatter topping -- flagged, not merged into any cheese topping | なし / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-09 |
| ナッツ | 1 | unresolved | `walnut` | GENERIC_UNSPECIFIED | generic_unspecified | GENERIC 'nuts' with no specific variety named. | なし / なし | EB-10 |
| プロヴェルチーズ | 1 | unresolved | `provolone` | DISTINCT_VARIANT_OF_RELATED_ID | — | 'Provel' is a real, distinct St. Louis-style cheese blend, commonly confused with provolone by name similarity | なし / なし | EB-09 |
| 肉 | 1 | unresolved | `beef`, `pork`, `chicken`, `ground-beef` | GENERIC_UNSPECIFIED | generic_unspecified | GENERIC 'meat' with no specific variety named -- not defaulted to any one meat id. | なし / なし | EB-10 |
| 赤唐辛子 | 1 | unresolved | `chili-oil` | CLASS_MISMATCH_SCATTER_VS_SPREAD | — | Red chili variant -- same ambiguity group as 青唐辛子. | なし / MULTI_SPREAD_LAYER | EB-08 |
| 青のり | 1 | unresolved | `nori` | DISTINCT_VARIANT_OF_RELATED_ID | — | Aonori is a related but visually/culinarily distinct seaweed condiment from plain nori -- not merged. | なし / なし | EB-10 |
| 青唐辛子 | 1 | unresolved | `chili-oil` | CLASS_MISMATCH_SCATTER_VS_SPREAD | — | Green chili variant -- part of the existing chili/chili-oil naming-ambiguity group (see also 'チリ' above), kept | なし / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-08 |

ambiguity type の内訳: `CLASS_MISMATCH_SCATTER_VS_SPREAD` 7 / `GENERIC_UNSPECIFIED` 10 / `DISTINCT_VARIANT_OF_RELATED_ID` 3 / `SAUCE_NOT_TOPPING` 4。

- `GENERIC_UNSPECIFIED`（チーズ / 肉 / ナッツ / ひき肉）: source に具体名が無い。既定値を置くかどうかは owner policy（canonicalizer は mozzarella などへの既定化を禁止している）。
- `CLASS_MISMATCH_SCATTER_VS_SPREAD`（唐辛子系）: 候補の chili-oil は spread だが、token は scatter 具材の可能性がある。scatter の新 id にすれば runtime は要らない。chili-oil にすると spread layer が増える。
- `SAUCE_NOT_TOPPING`（ホワイトソース / カレーソース / チーズソース）: sauce の選定と同じ問題なので、sauce batch（EB-02 / EB-03）と EB-09 で扱う。
- `DISTINCT_VARIANT_OF_RELATED_ID`（プロヴェルチーズ / 青のり / スパイシーソーセージ）: related id とは別物である可能性が注記されている。特にプロヴェルは provolone とは別物と明記されている。

### 4.2 行別（行内の全 token を exact / likely_alias / unresolved に分けたもの）

| evidenceId | nameJa | wave | 問題 token | exact | likely_alias | unresolved | 新規 id | evidence status | 解決後に残るもの（min / max） | batch |
|---|---|---|---|---|---|---|---|---|---|---|
| `curry-pizza-japan-pizzadb-p2` | カレーピザ | W3 | カレーソース | チキン→chicken, 玉ねぎ→onion, モッツァレラチーズ→mozzarella | — | カレーソース | — | 比較表のみ・裏付け0件 | open 0; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-02 |
| `breakfast-pizza-pizzadb-p11` | ブレックファーストピザ | W0_CORRESPONDENCE | ホワイトソース | 卵→egg, ベーコン→bacon, ソーセージ→sausage | チェダーチーズ→cheddar | ホワイトソース | — | 比較表のみ・裏付け1件 | open 1; rt なし / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-03 |
| `moussaka-style-pizza-pizzadb-p13` | ムサカ風ピザ | W3 | ホワイトソース | ナス→eggplant, シナモン→cinnamon | フェタ→feta | ホワイトソース | ラム肉→lamb | 比較表のみ・裏付け0件 | open 0; rt UNSUPPORTED_SAUCE_ID_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-03 |
| `feteer-meshaltet-pizzadb-p10` | フェテイールメシャルテル | W5 | ひき肉 | 蜂蜜→honey | — | ひき肉 | 溶かしバター→melted-butter, コンデンスミルク→condensed-milk | 比較表のみ・裏付け0件 | open 2; rt LAMINATE, MULTI_SPREAD_LAYER / LAMINATE, MULTI_SPREAD_LAYER | EB-07 |
| `keema-pizza-pizzadb-p2` | キーマピザ | W3 | ひき肉 | 玉ねぎ→onion, モッツァレラチーズ→mozzarella | — | ひき肉, 青唐辛子 | — | 比較表のみ・裏付け0件 | open 2; rt なし / なし | EB-07 |
| `lahmacun` | ラフマジュン | W4 | ひき肉 | トマト→fresh-tomato, パプリカ→bell-pepper, パセリ→parsley | — | ひき肉, 唐辛子 | — | 個別profile・裏付け1件 | open 3; rt DOUGH_VARIANT, MULTI_SPREAD_LAYER / DOUGH_VARIANT, MULTI_SPREAD_LAYER | EB-07 |
| `pizza-chilena-pizzadb-p8` | ピッツァ・チレーナ | W3 | ひき肉 | 玉ねぎ→onion, 卵→egg, モッツァレラチーズ→mozzarella | オリーブ→black-olive | ひき肉 | — | 比較表のみ・裏付け0件 | open 0; rt なし / なし | EB-07 |
| `turkish-pide-pizzadb-p5` | トルコピデ | W5 | ひき肉 | トマト→fresh-tomato, パセリ→parsley | — | ひき肉, チーズ | — | 比較表のみ・裏付け0件 | open 1; rt DOUGH_SHAPE_TARGET, DOUGH_VARIANT / DOUGH_SHAPE_TARGET, DOUGH_VARIANT | EB-07 |
| `diavola-pizza-pizzadb-p5` | ディアボラ | W3 | 唐辛子 | モッツァレラチーズ→mozzarella | サラミピカンテ→spicy-salami | 唐辛子 | — | 比較表のみ・裏付け0件 | open 1; rt なし / MULTI_SPREAD_LAYER | EB-08 |
| `keema-pizza-pizzadb-p2` | キーマピザ | W3 | 青唐辛子 | 玉ねぎ→onion, モッツァレラチーズ→mozzarella | — | ひき肉, 青唐辛子 | — | 比較表のみ・裏付け0件 | open 2; rt なし / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-08 |
| `lahmacun` | ラフマジュン | W4 | 唐辛子 | トマト→fresh-tomato, パプリカ→bell-pepper, パセリ→parsley | — | ひき肉, 唐辛子 | — | 個別profile・裏付け1件 | open 3; rt DOUGH_VARIANT, MULTI_SPREAD_LAYER / DOUGH_VARIANT, MULTI_SPREAD_LAYER | EB-08 |
| `pizza-baiana` | ピッツァ・バイアーナ | W3 | 唐辛子 | ソーセージ→sausage, 卵→egg, 玉ねぎ→onion, モッツァレラチーズ→mozzarella | — | 唐辛子 | — | 個別profile・裏付け2件 | open 0; rt なし / MULTI_SPREAD_LAYER | EB-08 |
| `pizza-cicoria-limone-pizzadb-p8` | ピッツァ・コン・チコリア・エ・リモーネ | W4 | 唐辛子 | にんにく→garlic, オリーブオイル→olive-oil | — | 唐辛子 | ペコリーノチーズ→pecorino, チコリ→chicory, レモン→lemon | 比較表のみ・裏付け0件 | open 1; rt DOUGH_VARIANT, SAUCELESS_RECIPE_CONTRACT / DOUGH_VARIANT, MULTI_SPREAD_LAYER, SAUCELESS_RECIPE_CONTRACT | EB-08 |
| `pizza-de-cancha` | ピッツァ・デ・カンチャ | W4 | 唐辛子 | にんにく→garlic, オレガノ→oregano, オリーブオイル→olive-oil | — | 唐辛子 | — | 個別profile・裏付け1件 | open 0; rt DOUGH_VARIANT, MULTI_SPREAD_LAYER / DOUGH_VARIANT, MULTI_SPREAD_LAYER | EB-08 |
| `thai-chicken-pizza-pizzadb-p4` | タイチキンピザ | W3 | 赤唐辛子 | チキン→chicken, モッツァレラチーズ→mozzarella | コリアンダー→cilantro | 赤唐辛子 | ピーナッツソース→peanut-sauce | 比較表のみ・裏付け1件 | open 0; rt UNSUPPORTED_SAUCE_ID_CONTRACT / MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-08 |
| `hokkaido-cheese-pizza-pizzadb-p15` | 北海道チーズピザ | W3 | チーズ | じゃがいも→potato, コーン→corn, ベーコン→bacon | — | チーズ | — | 比較表のみ・裏付け0件 | open 0; rt SAUCELESS_RECIPE_CONTRACT / SAUCELESS_RECIPE_CONTRACT | EB-09 |
| `old-forge-style-pizza-pizzadb-p1` | オールドフォージスタイルピザ | W5 | チーズ | 玉ねぎ→onion | — | チーズ | — | 比較表のみ・裏付け0件 | open 0; rt DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE / DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | EB-09 |
| `philly-cheesesteak-pizza-pizzadb-p9` | フィリーチーズステーキピザ | W3 | チーズソース | 玉ねぎ→onion | — | チーズソース | 牛肉→beef, ピーマン→green-pepper | 比較表のみ・裏付け0件 | open 0; rt SAUCELESS_RECIPE_CONTRACT / UNSUPPORTED_SAUCE_ID_CONTRACT | EB-09 |
| `st-louis-style-pizza-pizzadb-p4` | セントルイススタイルピザ | W4 | プロヴェルチーズ | ペパロニ→pepperoni | — | プロヴェルチーズ | — | 比較表のみ・裏付け0件 | open 0; rt DOUGH_VARIANT / DOUGH_VARIANT | EB-09 |
| `turkish-pide-pizzadb-p5` | トルコピデ | W5 | チーズ | トマト→fresh-tomato, パセリ→parsley | — | ひき肉, チーズ | — | 比較表のみ・裏付け0件 | open 1; rt DOUGH_SHAPE_TARGET, DOUGH_VARIANT / DOUGH_SHAPE_TARGET, DOUGH_VARIANT | EB-09 |
| `nutella-dessert-pizza-pizzadb-p6` | ヌテラデザートピザ | W4 | ナッツ | 粉砂糖→powdered-sugar | ヘーゼルナッツチョコレートスプレッド→nutella-spread | ナッツ | バナナ→banana | 比較表のみ・裏付け0件 | open 1; rt LATE_ADDITION, UNSUPPORTED_SAUCE_ID_CONTRACT / LATE_ADDITION, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-10 |
| `okonomiyaki-style-pizza-pizzadb-p1` | お好み焼き風ピザ | W4 | 青のり | マヨネーズ→mayo | — | 青のり | キャベツ→cabbage, 豚肉→pork, お好み焼きソース→okonomiyaki-sauce, かつお節→bonito-flakes | 比較表のみ・裏付け0件 | open 0; rt MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT / MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT | EB-10 |
| `quad-cities-style-pizza-pizzadb-p2` | クアッドシティーズスタイルピザ | W4 | スパイシーソーセージ | モッツァレラチーズ→mozzarella | — | スパイシーソーセージ | — | 比較表のみ・裏付け0件 | open 0; rt DOUGH_VARIANT / DOUGH_VARIANT | EB-10 |
| `swedish-kebab-pizza-pizzadb-p4` | スウェディッシュケバブピザ | W3 | 肉 | モッツァレラチーズ→mozzarella, レタス→lettuce | — | 肉 | ケバブソース→kebab-sauce | 比較表のみ・裏付け0件 | open 2; rt なし / なし | EB-10 |

likely_alias 列の token は、canonicalizer の curated synonym table で canonical 化済みのもの（例: 鶏肉→chicken）。本書では再検証していないため、状態は likely のまま。

## 5. Composition disagreement（27 item / 27 行、primary 23）

A = shipped recipe または catalog 候補の composition、B = PIZZA DB 行の composition。どちらを採るかは決めていない。表には、決めるのに必要な evidence と、それぞれを選んだときの runtime への影響を載せた。

| evidenceId | nameJa | wave | catalog | relation | A（spread） | B の差分 | B の sauce | A/B を決める evidence | 選択による runtime 影響 | batch |
|---|---|---|---|---|---|---|---|---|---|---|
| `teriyaki-chicken-pizza-pizzadb-p14` | 照り焼きチキンピザ | W4 | `teriyaki-chicken`（candidate） | INDETERMINATE_UNSPECIFIED_SAUCE_BASE | mayo, teriyaki-sauce | — | 甘辛だれ/unspecified | 先に alias / sauce batch（EB-05）で PIZZA DB 側 identity set を確定。その後に A/B を比較 | A/B の一方 で +UNSUPPORTED_SAUCE_ID_CONTRACT/MULTI_SPREAD_LAYER | EB-05 |
| `diavola-pizza-pizzadb-p5` | ディアボラ | W3 | `diavola`（candidate） | INDETERMINATE_UNRESOLVED_TOKENS | chili-oil, tomato-sauce | 未解決:唐辛子 | トマトソース/family_derived | 先に alias / sauce batch（EB-08）で PIZZA DB 側 identity set を確定。その後に A/B を比較 | A/B の一方 で +UNSUPPORTED_SAUCE_ID_CONTRACT/MULTI_SPREAD_LAYER | EB-08 |
| `nutella-dessert-pizza-pizzadb-p6` | ヌテラデザートピザ | W4 | `nutella-dessert`（candidate） | INDETERMINATE_UNRESOLVED_TOKENS | nutella-spread | 未解決:ナッツ | デザートソース/listed | 先に alias / sauce batch（EB-10）で PIZZA DB 側 identity set を確定。その後に A/B を比較 | 差なし | EB-10 |
| `bismarck-pizza-pizzadb-p7` | ビスマルク | W0_CORRESPONDENCE | `bismarck`（shipped） | PIZZADB_SUPERSET | tomato-sauce | +ham, +mushroom | トマトソース/family_derived | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +ham, +mushroom が dish の標準形に含まれるかの evidence; B/C を選ぶ場合: shipped recipe の save / Dex / mission migration review | A（keep）なら correspondence として閉じる | EB-11 |
| `breakfast-pizza-pizzadb-p11` | ブレックファーストピザ | W0_CORRESPONDENCE | `breakfast-pizza`（shipped） | INDETERMINATE_UNRESOLVED_TOKENS | tomato-sauce | 未解決:ホワイトソース | ホワイトソース/listed_unresolved | 先に alias / sauce batch（EB-11）で PIZZA DB 側 identity set を確定。その後に A/B を比較; B/C を選ぶ場合: shipped recipe の save / Dex / mission migration review | B/C で +UNSUPPORTED_SAUCE_ID_CONTRACT; A（keep）なら correspondence として閉じる | EB-11 |
| `capricciosa-pizzadb` | カプリチョーザ（PIZZA DB版） | W0_CORRESPONDENCE | `capricciosa`（shipped） | DIVERGENT | tomato-sauce | +artichoke, +egg, -oregano | トマトソース/listed | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +artichoke, +egg, -oregano が dish の標準形に含まれるかの evidence; B/C を選ぶ場合: shipped recipe の save / Dex / mission migration review | A（keep）なら correspondence として閉じる | EB-11 |
| `fugazza-pizzadb-p10` | フガザ | W0_CORRESPONDENCE | `fugazza`（shipped） | DIVERGENT | olive-oil | +mozzarella, -olive-oil | チーズ/none | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +mozzarella, -olive-oil が dish の標準形に含まれるかの evidence; B/C を選ぶ場合: shipped recipe の save / Dex / mission migration review | B/C で +DOUGH_VARIANT/SAUCELESS_RECIPE_CONTRACT; A（keep）なら correspondence として閉じる | EB-11 |
| `margherita-pizzadb-row` | マルゲリータ | W0_CORRESPONDENCE | `margherita`（shipped） | PIZZADB_SUPERSET | tomato-sauce | +olive-oil | トマトソース/family_derived | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +olive-oil が dish の標準形に含まれるかの evidence; B/C を選ぶ場合: shipped recipe の save / Dex / mission migration review | B/C で +MULTI_SPREAD_LAYER; A（keep）なら correspondence として閉じる | EB-11 |
| `marinara-pizza-pizzadb-p13` | マリナーラ | W0_CORRESPONDENCE | `marinara`（shipped） | PIZZADB_SUPERSET | tomato-sauce | +olive-oil | トマトソース/family_derived | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +olive-oil が dish の標準形に含まれるかの evidence; B/C を選ぶ場合: shipped recipe の save / Dex / mission migration review | B/C で +MULTI_SPREAD_LAYER; A（keep）なら correspondence として閉じる | EB-11 |
| `meat-lovers-pizza-pizzadb-p13` | ミートラバーズピザ | W0_CORRESPONDENCE | `meat-lovers`（shipped） | DIVERGENT | tomato-sauce | +beef, -mozzarella | トマトソース/family_derived | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +beef, -mozzarella が dish の標準形に含まれるかの evidence; B/C を選ぶ場合: shipped recipe の save / Dex / mission migration review | A（keep）なら correspondence として閉じる | EB-11 |
| `pesto-genovese-pizza-pizzadb-p11` | ペストジェノヴェーゼピザ | W0_CORRESPONDENCE | `genovese`（shipped） | DIVERGENT | pesto | +pine-nuts, +potato, -cherry-tomato | バジル/family_derived | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +pine-nuts, +potato, -cherry-tomato が dish の標準形に含まれるかの evidence; B/C を選ぶ場合: shipped recipe の save / Dex / mission migration review | A（keep）なら correspondence として閉じる | EB-11 |
| `quattro-formaggi-pizzadb` | クアトロフォルマッジ（PIZZA DB版） | W0_CORRESPONDENCE | `quattro-formaggi`（shipped） | PIZZADB_SUBSET | olive-oil | -olive-oil | チーズ/none | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 -olive-oil が dish の標準形に含まれるかの evidence; B/C を選ぶ場合: shipped recipe の save / Dex / mission migration review | B/C で +SAUCELESS_RECIPE_CONTRACT; A（keep）なら correspondence として閉じる | EB-11 |
| `black-truffle-pizza-pizzadb-p14` | 黒トリュフピザ | W4 | `al-tartufo`（candidate） | DIVERGENT | olive-oil | +mozzarella, +parmigiano, -fontina, -olive-oil | チーズ/none | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +mozzarella, +parmigiano, -fontina, -olive-oil が dish の標準形に含まれるかの evidence | A で SAUCELESS_RECIPE_CONTRACT が不要 | EB-12 |
| `boscaiola-pizzadb-p12` | ボスカイオーラ | W3 | `boscaiola`（candidate） | DIVERGENT | tomato-sauce | +olive-oil, +porcini, -mushroom, -tomato-sauce | チーズ/none | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +olive-oil, +porcini, -mushroom, -tomato-sauce が dish の標準形に含まれるかの evidence | A で SAUCELESS_RECIPE_CONTRACT が不要 | EB-12 |
| `frutti-di-mare-pizzadb-p11` | フルッティディマーレ | W3 | `frutti-di-mare`（candidate） | DIVERGENT | olive-oil | +clam, +mussel, +squid, +tomato-sauce, -garlic, -olive-oil, -parsley | トマトソース/family_derived | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +clam, +mussel, +squid, +tomato-sauce, -garlic, -olive-oil, -parsley が dish の標準形に含まれるかの evidence | 差なし | EB-12 |
| `fugazzetta-pizzadb-p10` | フガゼッタ | W4 | `fugazzeta`（candidate） | PIZZADB_SUBSET | olive-oil | -olive-oil | チーズ/none | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 -olive-oil が dish の標準形に含まれるかの evidence | A で SAUCELESS_RECIPE_CONTRACT が不要 | EB-12 |
| `pizza-alla-norma-pizzadb-p9` | ピッツァアッラノルマ | W3 | `alla-norma`（candidate） | DIVERGENT | olive-oil | +tomato-sauce, -mozzarella, -olive-oil | トマトソース/family_derived | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +tomato-sauce, -mozzarella, -olive-oil が dish の標準形に含まれるかの evidence | 差なし | EB-12 |
| `porcini-pizza-pizzadb-p13` | ポルチーニ茸のピザ | W3 | `ai-funghi-porcini`（candidate） | DIVERGENT | tomato-sauce | +garlic, +parsley, -tomato-sauce | チーズ/none | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +garlic, +parsley, -tomato-sauce が dish の標準形に含まれるかの evidence | A で SAUCELESS_RECIPE_CONTRACT が不要 | EB-12 |
| `speck-e-brie-pizzadb-p4` | スペックエブリー | W3 | `speck-e-brie`（candidate） | DIVERGENT | olive-oil | +mozzarella, +prosciutto-crudo, -arugula, -olive-oil, -speck | チーズ/none | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +mozzarella, +prosciutto-crudo, -arugula, -olive-oil, -speck が dish の標準形に含まれるかの evidence | A で SAUCELESS_RECIPE_CONTRACT が不要 | EB-12 |
| `buffalo-chicken-pizzadb` | バッファローチキンピザ（PIZZA DB版） | W4 | `buffalo-chicken`（candidate） | DIVERGENT | buffalo-sauce, olive-oil | +blue-cheese-dressing, -gorgonzola, -olive-oil | ホットソース/listed | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +blue-cheese-dressing, -gorgonzola, -olive-oil が dish の標準形に含まれるかの evidence | 差なし | EB-13 |
| `calzone-pizzadb` | カルツォーネ（PIZZA DB版） | W5 | `calzone`（candidate） | DIVERGENT | tomato-sauce | +salami, -ham | トマトソース/listed | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +salami, -ham が dish の標準形に含まれるかの evidence | 差なし | EB-13 |
| `chicago-deep-dish-pizzadb` | シカゴディープディッシュ（PIZZA DB版） | W5 | `chicago-deep-dish`（candidate） | PIZZADB_SUPERSET | tomato-sauce | +pepperoni | トマトソース/listed | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +pepperoni が dish の標準形に含まれるかの evidence | 差なし | EB-13 |
| `detroit-style-pizza-pizzadb-p5` | デトロイトスタイルピザ | W5 | `detroit-style`（candidate） | DIVERGENT | tomato-sauce | +brick-cheese, -mozzarella | トマトソース/family_derived | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +brick-cheese, -mozzarella が dish の標準形に含まれるかの evidence | 差なし | EB-13 |
| `greek-style-pizzadb` | グリークスタイルピザ（PIZZA DB版） | W5 | `greek-style`（candidate） | PIZZADB_SUPERSET | tomato-sauce | +black-olive, +feta | トマトソース/listed | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +black-olive, +feta が dish の標準形に含まれるかの evidence | 差なし | EB-13 |
| `pizza-romana-pizzadb-p9` | ピッツァ・ロマーナ | W4 | `romana`（candidate） | PIZZADB_SUPERSET | tomato-sauce | +capers, +mozzarella | トマトソース/family_derived | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +capers, +mozzarella が dish の標準形に含まれるかの evidence | 差なし | EB-13 |
| `siciliana-pizzadb` | シチリアンピザ（PIZZA DB版） | W5 | `siciliana`（candidate） | DIVERGENT | tomato-sauce | +mozzarella, +onion, -breadcrumb, -caciocavallo | トマトソース/listed | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 +mozzarella, +onion, -breadcrumb, -caciocavallo が dish の標準形に含まれるかの evidence | 差なし | EB-13 |
| `supreme-pizzadb` | スプリームピザ | W3 | `supreme`（candidate） | PIZZADB_SUBSET | tomato-sauce | -mozzarella | トマトソース/listed | catalog 側 composition の出典（Phase 0A catalog の根拠）と PIZZA DB 行の出典を並べ、独立した第 3 source で差分 ingredient の有無を確認; 差分 -mozzarella が dish の標準形に含まれるかの evidence | 差なし | EB-13 |

ambiguity type: `SHIPPED_VS_PIZZADB:DIVERGENT` 4 / `CANDIDATE_VS_PIZZADB:DIVERGENT` 10 / `SHIPPED_VS_PIZZADB:PIZZADB_SUBSET` 1 / `CANDIDATE_VS_PIZZADB:PIZZADB_SUPERSET` 3 / `CANDIDATE_VS_PIZZADB:PIZZADB_SUBSET` 2 / `SHIPPED_VS_PIZZADB:PIZZADB_SUPERSET` 3 / `CANDIDATE_VS_PIZZADB:INDETERMINATE_UNRESOLVED_TOKENS` 2 / `SHIPPED_VS_PIZZADB:INDETERMINATE_UNRESOLVED_TOKENS` 1 / `CANDIDATE_VS_PIZZADB:INDETERMINATE_UNSPECIFIED_SAUCE_BASE` 1。

- `INDETERMINATE_*` の 4 件（diavola / nutella-dessert / breakfast / teriyaki-chicken）は、PIZZA DB 側の identity set が alias か sauce の未解決で確定していない。先にそれぞれの alias / sauce batch（EB-08 / EB-10 / EB-11 / EB-05）で B を確定しないと、A と B を比較できない。
- base sauce が食い違う候補 7 行は EB-12 にまとめた。このうち 5 行（speck-e-brie / boscaiola / porcini / fugazzetta / black-truffle）は A の sauce が supported union 内にあり、A を選べば `SAUCELESS_RECIPE_CONTRACT` の確定依存が消える。B を選べば依存は残る。

## 6. Evidence Batch

batchType は 4 種類:

- `SHARED_DECISION`: 1 つの判断で全 item が決まる
- `SHARED_EVIDENCE_SOURCE`: 同じ種類の source 確認でまとめて処理できるが、結論は行ごとに出る
- `BUNDLE_PER_ROW_EVIDENCE`: 共通判断は無く、同じ session で処理するための便宜的な束
- `BUNDLE_OWNER_REVIEW`: 1 回の owner review で扱える束（判断は cluster ごと・行ごと）

「rows unlocked」は、その batch だけを解いたときに evidence / decision item が 0 になる行。runtime の状態で次のように分けた。

- guaranteed: どの結論でも runtime が 0
- best-case: runtime を伴わない結論なら runtime が 0
- correspondence: shipped keep なら閉じる
- runtime: runtime unit が残る

| batch | 対象 | type | items | rows | 単独で閉じる行 | guaranteed | best-case | correspondence | 閉じた行に残る runtime（min） |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| EB-01 | sauceFamily「その他」10 行の base sauce 特定 | SHARED_EVIDENCE_SOURCE | 10 | 10 | 10 | 0 | 7 | 0 | LATE_ADDITION 2, DOUGH_VARIANT 1, PREP_STEP 1 |
| EB-02 | curry sauce の canonical id（family カレー 5 行 + token カレーソース 1 行） | SHARED_DECISION | 6 | 6 | 4 | 0 | 0 | 0 | UNSUPPORTED_SAUCE_ID_CONTRACT 4 |
| EB-03 | white sauce の canonical id と mayo-as-base（family 4 行 + token 2 行 + spread 確認 4 行） | SHARED_DECISION | 10 | 6 | 5 | 0 | 0 | 0 | UNSUPPORTED_SAUCE_ID_CONTRACT 5 |
| EB-04 | hot sauce base の特定（family ホットソース 6 行 + name specificity 1 + spread 確認 4） | SHARED_EVIDENCE_SOURCE | 11 | 6 | 5 | 0 | 0 | 0 | UNSUPPORTED_SAUCE_ID_CONTRACT 5, PREP_STEP 1 |
| EB-05 | tare 系 base の特定（family 甘辛だれ 4 行 + teriyaki composition + name specificity + spread 確認） | SHARED_EVIDENCE_SOURCE | 8 | 4 | 3 | 0 | 0 | 0 | UNSUPPORTED_SAUCE_ID_CONTRACT 3, LATE_ADDITION 1 |
| EB-06 | dessert base の特定（family デザートソース 4 行 + feteer scope） | SHARED_EVIDENCE_SOURCE | 5 | 4 | 3 | 0 | 0 | 0 | UNSUPPORTED_SAUCE_ID_CONTRACT 3, DOUGH_VARIANT 1, LATE_ADDITION 1 |
| EB-07 | token『ひき肉』の canonical 化（5 行） | SHARED_DECISION | 5 | 5 | 1 | 1 | 1 | 0 | — |
| EB-08 | 唐辛子 / 赤唐辛子 / 青唐辛子 の canonical 化（7 行 + diavola composition） | SHARED_DECISION | 8 | 7 | 4 | 0 | 2 | 0 | DOUGH_VARIANT 1, MULTI_SPREAD_LAYER 1, UNSUPPORTED_SAUCE_ID_CONTRACT 1 |
| EB-09 | generic チーズ / チーズソース / プロヴェルチーズ（5 行） | SHARED_EVIDENCE_SOURCE | 5 | 5 | 4 | 0 | 0 | 0 | SAUCELESS_RECIPE_CONTRACT 2, DOUGH_VARIANT 2, DOUGH_SHAPE_TARGET 1, PAN_BAKE 1 |
| EB-10 | 肉 / ナッツ / 青のり / スパイシーソーセージ（4 行 + nutella composition） | BUNDLE_PER_ROW_EVIDENCE | 5 | 4 | 3 | 0 | 0 | 0 | UNSUPPORTED_SAUCE_ID_CONTRACT 2, LATE_ADDITION 1, MULTI_SPREAD_LAYER 1, DOUGH_VARIANT 1 |
| EB-11 | shipped 9 recipe と PIZZA DB 行の食い違い（keep / adopt / both） | SHARED_DECISION | 13 | 10 | 8 | 0 | 0 | 8 | — |
| EB-12 | 候補 recipe の base sauce 食い違い（catalog vs PIZZA DB, 7 行） | SHARED_EVIDENCE_SOURCE | 7 | 7 | 4 | 1 | 3 | 0 | LATE_ADDITION 1 |
| EB-13 | 候補 recipe の topping / cheese 食い違い（8 行） | BUNDLE_PER_ROW_EVIDENCE | 8 | 8 | 6 | 1 | 1 | 0 | DOUGH_VARIANT 3, LATE_ADDITION 2, PAN_BAKE 2, MULTI_SPREAD_LAYER 1, UNSUPPORTED_SAUCE_ID_CONTRACT 1, ENCLOSE 1, DOUGH_SHAPE_TARGET 1 |
| EB-14 | LATE_ADDITION の mechanic 解釈 confirm / drop（12 行） | SHARED_DECISION | 12 | 12 | 9 | 0 | 0 | 0 | SAUCELESS_RECIPE_CONTRACT 7, MULTI_SPREAD_LAYER 2, DOUGH_VARIANT 2, UNSUPPORTED_SAUCE_ID_CONTRACT 1 |
| EB-15 | SERVE_FORM の confirm / drop（2 行） | SHARED_DECISION | 2 | 2 | 0 | 0 | 0 | 0 | — |
| EB-16 | naming cluster の区別・統合（NC-1〜NC-7, 14 行） | BUNDLE_OWNER_REVIEW | 12 | 12 | 7 | 2 | 2 | 0 | SAUCELESS_RECIPE_CONTRACT 3, MULTI_SPREAD_LAYER 2, DOUGH_VARIANT 1 |
| EB-17 | 調理済み composite ingredient（3 行） | SHARED_DECISION | 3 | 3 | 2 | 1 | 1 | 0 | UNSUPPORTED_SAUCE_ID_CONTRACT 1 |
| EB-18 | recipe evidence 再取得（4 行） | BUNDLE_PER_ROW_EVIDENCE | 4 | 4 | 4 | 0 | 0 | 0 | DOUGH_VARIANT 4, ENCLOSE 1, SAUCELESS_RECIPE_CONTRACT 1 |
| EB-19 | 同一 ingredient set 行の識別判断（8 行） | BUNDLE_OWNER_REVIEW | 8 | 8 | 6 | 1 | 1 | 0 | DOUGH_VARIANT 4, PAN_BAKE 2, DOUGH_SHAPE_TARGET 1, STEP_ORDER 1 |

### EB-01 — sauceFamily「その他」10 行の base sauce 特定

- **type**: `SHARED_EVIDENCE_SOURCE`、items 10
- **affected recipes（10）**: `banh-mi-pizza-pizzadb-p6`, `caponata-pizza-pizzadb-p2`, `goulash-pizza-pizzadb-p3`, `jamaican-jerk-chicken-pizza-pizzadb-p3`, `jerusalem-mixed-grill-pizza-pizzadb-p1`, `natto-pizza`, `nigerian-suya-pizza-pizzadb-p5`, `palmitos-salsa-golf-pizzadb-p7`, `pizza-de-lomo-saltado`, `ume-shiso-pizza-pizzadb-p14`
- **decision**: family label が『その他』の行について、base sauce が supported（tomato-sauce / pesto / olive-oil）・sauceless・unsupported/new のどれかを行ごとに確定する。evidence が無い行へ一律の既定値を置くかは owner policy。
- **evidence to check**: PIZZA DB 個別 profile ページ（10 行中 8 行は comparison table のみが出典）の sauce/base 記述 / 独立した第 2 source での base（トマト系/オイル/ソース無し/固有ソース）
- **Owner Decision**: YES — evidence が沈黙する行に既定 sauce を置くか（例: 『その他は source 記述が無ければ採用しない』）は owner policy
- **共通判断**: PARTIAL — 『evidence 無し時の扱い』は共通 policy 化できるが、値そのものは行ごと。**recipe 固有判断**: YES — dish ごとに base が異なり得る（例: goulash の paprika 系, banh-mi の pâté 系）
- **rows unlocked**（単独で evidence / decision が閉じる行 10）: guaranteed —; best-case `banh-mi-pizza-pizzadb-p6`, `caponata-pizza-pizzadb-p2`, `goulash-pizza-pizzadb-p3`, `jamaican-jerk-chicken-pizza-pizzadb-p3`, `jerusalem-mixed-grill-pizza-pizzadb-p1`, `nigerian-suya-pizza-pizzadb-p5`, `ume-shiso-pizza-pizzadb-p14`; correspondence —; runtime が残る `natto-pizza`, `palmitos-salsa-golf-pizzadb-p7`, `pizza-de-lomo-saltado`
- **remaining blockers**: 他の batch の item なし。閉じた行に残る runtime は min LATE_ADDITION 2, DOUGH_VARIANT 1, PREP_STEP 1 / max UNSUPPORTED_SAUCE_ID_CONTRACT 10, LATE_ADDITION 2, DOUGH_VARIANT 1, PREP_STEP 1

### EB-02 — curry sauce の canonical id（family カレー 5 行 + token カレーソース 1 行）

- **type**: `SHARED_DECISION`、items 6
- **affected recipes（6）**: `baingan-bharta-pizza-pizzadb-p6`, `chicken-tikka-pizza-pizzadb-p5`, `curry-pizza-japan-pizzadb-p2`, `keema-pizza-pizzadb-p2`, `rendang-pizza-pizzadb-p14`, `tandoori-paneer-pizza-pizzadb-p5`
- **decision**: 『カレー』系 base を 1 つの generic curry sauce id で表すか、既存 Phase 0B の curry-ketchup（currywurst 固有）に寄せるか、dish ごとに別 id にするか。
- **evidence to check**: 各行 source の sauce 名称（例: tikka masala / keema curry / rendang paste の区別有無） / canonicalizer 注記: curry-ketchup は currywurst 固有で generic カレーソースとは merge しない
- **Owner Decision**: YES — id 粒度（generic 1 id か dish 別か）は content/product decision
- **共通判断**: YES — 粒度 policy が決まれば 6 行に同じ id を適用可能。**recipe 固有判断**: CONDITIONAL — dish 別 id を選ぶ場合のみ行ごと
- **rows unlocked**（単独で evidence / decision が閉じる行 4）: guaranteed —; best-case —; correspondence —; runtime が残る `baingan-bharta-pizza-pizzadb-p6`, `curry-pizza-japan-pizzadb-p2`, `rendang-pizza-pizzadb-p14`, `tandoori-paneer-pizza-pizzadb-p5`
- **remaining blockers**: 他の batch の item EB-07×1, EB-08×1, EB-17×1。閉じた行に残る runtime は min UNSUPPORTED_SAUCE_ID_CONTRACT 4 / max UNSUPPORTED_SAUCE_ID_CONTRACT 4
- **note**: どの結論でも supported union 外 → UNSUPPORTED_SAUCE_ID_CONTRACT が残る（sauce 無し/トマトとする evidence が出ない限り）

### EB-03 — white sauce の canonical id と mayo-as-base（family 4 行 + token 2 行 + spread 確認 4 行）

- **type**: `SHARED_DECISION`、items 10
- **affected recipes（6）**: `breakfast-pizza-pizzadb-p11`, `mentaiko-mochi-pizza`, `mexican-elote-pizza-pizzadb-p13`, `moussaka-style-pizza-pizzadb-p13`, `potato-mayo-pizza-pizzadb-p3`, `venezuelan-reina-pepiada-pizzadb-p12`
- **decision**: (a) token/family『ホワイトソース』を fresh-cream-sauce / fromage-blanc-sauce / 新 white-sauce id のどれにするか。(b) mayo を列挙する 4 行で、mayo 自体が base（1 層）か、別の white sauce + mayo（2 層）か。
- **evidence to check**: 各行 source の base 記述（béchamel / cream / mayo の区別） / canonicalizer 注記: ホワイトソースは fromage-blanc-sauce（flammkuchen 固有）と未確認のため merge しない
- **Owner Decision**: YES — white sauce id の粒度、および mayo を base とみなすかは content decision
- **共通判断**: YES — (a)(b) とも共通 policy で全行に適用可能。**recipe 固有判断**: PARTIAL — (b) は mayo 列挙行ごとに source の層構造確認が必要
- **rows unlocked**（単独で evidence / decision が閉じる行 5）: guaranteed —; best-case —; correspondence —; runtime が残る `mentaiko-mochi-pizza`, `mexican-elote-pizza-pizzadb-p13`, `moussaka-style-pizza-pizzadb-p13`, `potato-mayo-pizza-pizzadb-p3`, `venezuelan-reina-pepiada-pizzadb-p12`
- **remaining blockers**: 他の batch の item EB-11×1。閉じた行に残る runtime は min UNSUPPORTED_SAUCE_ID_CONTRACT 5 / max MULTI_SPREAD_LAYER 4, UNSUPPORTED_SAUCE_ID_CONTRACT 5
- **note**: どの結論でも supported union 外。mayo-as-base を採ると MULTI_SPREAD_LAYER の conditional が 4 行で消える

### EB-04 — hot sauce base の特定（family ホットソース 6 行 + name specificity 1 + spread 確認 4）

- **type**: `SHARED_EVIDENCE_SOURCE`、items 11
- **affected recipes（6）**: `buffalo-cauliflower-pizza-pizzadb-p6`, `kimchi-pizza-pizzadb-p2`, `nashville-hot-chicken-pizza-pizzadb-p6`, `nduja-pizza-pizzadb-p14`, `peruvian-aji-amarillo-pizzadb-p12`, `swedish-kebab-pizza-pizzadb-p4`
- **decision**: generic hot sauce を 1 つの新 id で表すか、#189 family 候補（buffalo-sauce / chili-oil / doubanjiang）や行内列挙品（アヒアマリージョ, ケバブソース, nduja 自体）に割り当てるか。
- **evidence to check**: 各行 source の sauce 名称 / nduja: 『ンドゥイヤ』がペースト spread か scatter 具材かの記述（NAME_SPECIFICITY_GAP） / 列挙された spread（honey / blue-cheese-dressing / kebab-sauce）が base か追加層か
- **Owner Decision**: YES — generic hot-sauce id を作るかは content decision
- **共通判断**: PARTIAL — 『generic hot sauce id』policy は 6 行共通化可能。**recipe 固有判断**: YES — dish 名が特定 sauce を示唆する行（buffalo / aji amarillo / kebab / nduja）は行ごとに evidence 確認
- **rows unlocked**（単独で evidence / decision が閉じる行 5）: guaranteed —; best-case —; correspondence —; runtime が残る `buffalo-cauliflower-pizza-pizzadb-p6`, `kimchi-pizza-pizzadb-p2`, `nashville-hot-chicken-pizza-pizzadb-p6`, `nduja-pizza-pizzadb-p14`, `peruvian-aji-amarillo-pizzadb-p12`
- **remaining blockers**: 他の batch の item EB-10×1。閉じた行に残る runtime は min UNSUPPORTED_SAUCE_ID_CONTRACT 5, PREP_STEP 1 / max MULTI_SPREAD_LAYER 3, UNSUPPORTED_SAUCE_ID_CONTRACT 5, PREP_STEP 1
- **note**: どの結論でも supported union 外 → UNSUPPORTED_SAUCE_ID_CONTRACT

### EB-05 — tare 系 base の特定（family 甘辛だれ 4 行 + teriyaki composition + name specificity + spread 確認）

- **type**: `SHARED_EVIDENCE_SOURCE`、items 8
- **affected recipes（4）**: `bulgogi-pizza-pizzadb-p11`, `eel-pizza-pizzadb-p1`, `south-african-boerewors-pizzadb-p14`, `teriyaki-chicken-pizza-pizzadb-p14`
- **decision**: tare を dish 別 id（teriyaki-sauce / yakiniku-sauce / 新 unagi tare 等）にするか generic tare 1 id にするか。teriyaki-chicken は catalog 候補 composition（teriyaki-sauce + mayo）と PIZZA DB（base 未特定）の選択を含む。
- **evidence to check**: 各行 source の tare 名称 / boerewors: sausage 種別（NAME_SPECIFICITY_GAP）と chutney が base か追加層か / #189 family 候補: miso-sauce / okonomiyaki-sauce / sweet-bean-sauce / teriyaki-sauce / yakiniku-sauce
- **Owner Decision**: YES — tare id 粒度と teriyaki composition A/B
- **共通判断**: PARTIAL — generic tare policy は共通化可能だが、family 候補が 5 種あり dish 対応は行ごと。**recipe 固有判断**: YES
- **rows unlocked**（単独で evidence / decision が閉じる行 3）: guaranteed —; best-case —; correspondence —; runtime が残る `bulgogi-pizza-pizzadb-p11`, `south-african-boerewors-pizzadb-p14`, `teriyaki-chicken-pizza-pizzadb-p14`
- **remaining blockers**: 他の batch の item EB-14×1。閉じた行に残る runtime は min UNSUPPORTED_SAUCE_ID_CONTRACT 3, LATE_ADDITION 1 / max UNSUPPORTED_SAUCE_ID_CONTRACT 3, MULTI_SPREAD_LAYER 2, LATE_ADDITION 1
- **note**: どの結論でも supported union 外 → UNSUPPORTED_SAUCE_ID_CONTRACT

### EB-06 — dessert base の特定（family デザートソース 4 行 + feteer scope）

- **type**: `SHARED_EVIDENCE_SOURCE`、items 5
- **affected recipes（4）**: `apple-cinnamon-dessert-pizzadb`, `feteer-meshaltet-pizzadb-p10`, `fruit-dessert-pizza-pizzadb-p11`, `smore-dessert-pizza-pizzadb-p4`
- **decision**: dessert 系 base を nutella-spread / 行内列挙品（cream-cheese, chocolate, honey, condensed milk, melted-butter）/ 新 id / sauceless のどれにするか。feteer は dessert か savory（ひき肉を含む）かの scope 判断を含む。
- **evidence to check**: 各行 source の base 記述 / feteer-meshaltet: dessert 版と savory 版の区別（SCOPE_QUESTION）
- **Owner Decision**: YES — dessert base policy と feteer scope
- **共通判断**: PARTIAL — 『行内列挙 spread を base とみなす』policy は共通化可能。**recipe 固有判断**: YES
- **rows unlocked**（単独で evidence / decision が閉じる行 3）: guaranteed —; best-case —; correspondence —; runtime が残る `apple-cinnamon-dessert-pizzadb`, `fruit-dessert-pizza-pizzadb-p11`, `smore-dessert-pizza-pizzadb-p4`
- **remaining blockers**: 他の batch の item EB-07×1。閉じた行に残る runtime は min UNSUPPORTED_SAUCE_ID_CONTRACT 3, DOUGH_VARIANT 1, LATE_ADDITION 1 / max UNSUPPORTED_SAUCE_ID_CONTRACT 3, DOUGH_VARIANT 1, LATE_ADDITION 1
- **note**: sauceless を選ぶと SAUCELESS_RECIPE_CONTRACT、列挙 spread/新 id を選ぶと UNSUPPORTED_SAUCE_ID_CONTRACT。runtime-free の結論は無い

### EB-07 — token『ひき肉』の canonical 化（5 行）

- **type**: `SHARED_DECISION`、items 5
- **affected recipes（5）**: `feteer-meshaltet-pizzadb-p10`, `keema-pizza-pizzadb-p2`, `lahmacun`, `pizza-chilena-pizzadb-p8`, `turkish-pide-pizzadb-p5`
- **decision**: generic『ひき肉』を既存 Phase 0B の ground-beef（taco 固有）に寄せるか、新 generic ground-meat id にするか、dish ごとに畜種を分けるか。
- **evidence to check**: 各行 source の畜種記述（牛/羊/豚/合挽き） / canonicalizer 注記: ground-beef は taco 固有、ひき肉は generic で product decision なしに merge しない
- **Owner Decision**: YES — id 粒度
- **共通判断**: YES — 粒度 policy で 5 行同時に解決。**recipe 固有判断**: CONDITIONAL — 畜種別 id を選ぶ場合のみ行ごと
- **rows unlocked**（単独で evidence / decision が閉じる行 1）: guaranteed `pizza-chilena-pizzadb-p8`; best-case `pizza-chilena-pizzadb-p8`; correspondence —; runtime が残る —
- **remaining blockers**: 他の batch の item EB-02×1, EB-06×2, EB-08×2, EB-09×1, EB-14×1, EB-15×1。閉じた行に残る runtime は min なし / max なし
- **note**: runtime 影響なし（scatter ingredient）

### EB-08 — 唐辛子 / 赤唐辛子 / 青唐辛子 の canonical 化（7 行 + diavola composition）

- **type**: `SHARED_DECISION`、items 8
- **affected recipes（7）**: `diavola-pizza-pizzadb-p5`, `keema-pizza-pizzadb-p2`, `lahmacun`, `pizza-baiana`, `pizza-cicoria-limone-pizzadb-p8`, `pizza-de-cancha`, `thai-chicken-pizza-pizzadb-p4`
- **decision**: 生唐辛子系 token を scatter の新 id（色別 or 共通）にするか、既存 chili-oil（spread）に寄せるか。diavola は catalog 候補（chili-oil）と PIZZA DB（唐辛子）の composition 選択を含む。
- **evidence to check**: 各行 source で唐辛子が生/乾燥/フレーク/オイルのどれか / canonicalizer 注記: チリ系は scatter topping の可能性が高く chili-oil（spread）とは class が違う
- **Owner Decision**: YES — scatter 新 id か chili-oil か、色別 id を分けるか
- **共通判断**: YES — 1 policy で 7 行 + diavola に適用可能。**recipe 固有判断**: PARTIAL — オイル状と明記された行があれば行ごとに例外
- **rows unlocked**（単独で evidence / decision が閉じる行 4）: guaranteed —; best-case `diavola-pizza-pizzadb-p5`, `pizza-baiana`; correspondence —; runtime が残る `pizza-de-cancha`, `thai-chicken-pizza-pizzadb-p4`
- **remaining blockers**: 他の batch の item EB-02×1, EB-07×2, EB-14×2, EB-15×1。閉じた行に残る runtime は min DOUGH_VARIANT 1, MULTI_SPREAD_LAYER 1, UNSUPPORTED_SAUCE_ID_CONTRACT 1 / max MULTI_SPREAD_LAYER 4, UNSUPPORTED_SAUCE_ID_CONTRACT 2, DOUGH_VARIANT 1
- **note**: chili-oil を選ぶと MULTI_SPREAD_LAYER（または sauce contract）conditional が確定。scatter 新 id なら runtime 不要

### EB-09 — generic チーズ / チーズソース / プロヴェルチーズ（5 行）

- **type**: `SHARED_EVIDENCE_SOURCE`、items 5
- **affected recipes（5）**: `hokkaido-cheese-pizza-pizzadb-p15`, `old-forge-style-pizza-pizzadb-p1`, `philly-cheesesteak-pizza-pizzadb-p9`, `st-louis-style-pizza-pizzadb-p4`, `turkish-pide-pizzadb-p5`
- **decision**: generic『チーズ』3 行の具体 cheese、philly の『チーズソース』（sauce taxonomy）、st-louis の『プロヴェルチーズ』（provolone とは別物と canonicalizer が明記）の canonical 化。
- **evidence to check**: 各行 source の cheese 名称 / philly: チーズソースが base sauce か topping か（sauce なら SAUCELESS → UNSUPPORTED に変わる）
- **Owner Decision**: YES — generic チーズを既定 cheese に寄せるか（canonicalizer は mozzarella への既定化を禁止）
- **共通判断**: PARTIAL — generic チーズ 3 行は共通 policy 可。**recipe 固有判断**: YES — プロヴェル / チーズソースは行固有
- **rows unlocked**（単独で evidence / decision が閉じる行 4）: guaranteed —; best-case —; correspondence —; runtime が残る `hokkaido-cheese-pizza-pizzadb-p15`, `old-forge-style-pizza-pizzadb-p1`, `philly-cheesesteak-pizza-pizzadb-p9`, `st-louis-style-pizza-pizzadb-p4`
- **remaining blockers**: 他の batch の item EB-07×1。閉じた行に残る runtime は min SAUCELESS_RECIPE_CONTRACT 2, DOUGH_SHAPE_TARGET 1, DOUGH_VARIANT 2, PAN_BAKE 1 / max SAUCELESS_RECIPE_CONTRACT 1, DOUGH_SHAPE_TARGET 1, DOUGH_VARIANT 2, PAN_BAKE 1, UNSUPPORTED_SAUCE_ID_CONTRACT 1
- **note**: philly: チーズソースを base とすると SAUCELESS_RECIPE_CONTRACT → UNSUPPORTED_SAUCE_ID_CONTRACT に置き換わる（runtime 必要は不変）

### EB-10 — 肉 / ナッツ / 青のり / スパイシーソーセージ（4 行 + nutella composition）

- **type**: `BUNDLE_PER_ROW_EVIDENCE`、items 5
- **affected recipes（4）**: `nutella-dessert-pizza-pizzadb-p6`, `okonomiyaki-style-pizza-pizzadb-p1`, `quad-cities-style-pizza-pizzadb-p2`, `swedish-kebab-pizza-pizzadb-p4`
- **decision**: 行固有 token の canonical 化。共通判断は無く、同じ source 再確認 session で処理できるだけの bundle。
- **evidence to check**: swedish-kebab: 肉の畜種 / nutella: ナッツの種類（catalog 候補は nutella-spread / powdered-sugar / strawberry で nut 無し） / okonomiyaki: 青のりを nori と別 id にするか / quad-cities: スパイシーソーセージを sausage と同一視するか
- **Owner Decision**: PARTIAL — nutella の composition A/B は owner
- **共通判断**: NO。**recipe 固有判断**: YES
- **rows unlocked**（単独で evidence / decision が閉じる行 3）: guaranteed —; best-case —; correspondence —; runtime が残る `nutella-dessert-pizza-pizzadb-p6`, `okonomiyaki-style-pizza-pizzadb-p1`, `quad-cities-style-pizza-pizzadb-p2`
- **remaining blockers**: 他の batch の item EB-04×2。閉じた行に残る runtime は min LATE_ADDITION 1, UNSUPPORTED_SAUCE_ID_CONTRACT 2, MULTI_SPREAD_LAYER 1, DOUGH_VARIANT 1 / max LATE_ADDITION 1, UNSUPPORTED_SAUCE_ID_CONTRACT 2, MULTI_SPREAD_LAYER 1, DOUGH_VARIANT 1

### EB-11 — shipped 9 recipe と PIZZA DB 行の食い違い（keep / adopt / both）

- **type**: `SHARED_DECISION`、items 13
- **affected recipes（10）**: `bismarck-pizza-pizzadb-p7`, `breakfast-pizza-pizzadb-p11`, `capricciosa-pizzadb`, `fugazza-pizzadb-p10`, `fugazzetta-pizzadb-p10`, `margherita-pizzadb-row`, `marinara-pizza-pizzadb-p13`, `meat-lovers-pizza-pizzadb-p13`, `pesto-genovese-pizza-pizzadb-p11`, `quattro-formaggi-pizzadb`
- **decision**: shipped recipe に対応する PIZZA DB 行を (A) shipped keep（行は correspondence として閉じる）/ (B) adopt（shipped 変更 + migration review）/ (C) 別 dish として両立、のどれにするか。ZONED_PLACEMENT 確認（capricciosa, bismarck）と fugazza/fugazzetta collision（P0-COLL-5）を含む。
- **evidence to check**: 独立 source での各 dish の標準 composition（例: margherita / marinara の仕上げ olive oil） / adopt の場合: save / Dex / mission への影響 review
- **Owner Decision**: YES — shipped を PIZZA DB で変更するかは owner decision（一律 policy 可）
- **共通判断**: YES — 『shipped は keep』等の一律 policy で 9 行同時に解決可能。**recipe 固有判断**: CONDITIONAL — adopt/both を選ぶ行のみ行ごと
- **rows unlocked**（単独で evidence / decision が閉じる行 8）: guaranteed —; best-case —; correspondence `bismarck-pizza-pizzadb-p7`, `capricciosa-pizzadb`, `fugazza-pizzadb-p10`, `margherita-pizzadb-row`, `marinara-pizza-pizzadb-p13`, `meat-lovers-pizza-pizzadb-p13`, `pesto-genovese-pizza-pizzadb-p11`, `quattro-formaggi-pizzadb`; runtime が残る —
- **remaining blockers**: 他の batch の item EB-03×1, EB-12×1。閉じた行に残る runtime は min なし / max ZONED_PLACEMENT 2, DOUGH_VARIANT 1, SAUCELESS_RECIPE_CONTRACT 2, MULTI_SPREAD_LAYER 2
- **note**: A(keep) なら行は既存 recipe の corroboration として閉じ、authoring 不要。B/C は quattro-formaggi・fugazza で SAUCELESS_RECIPE_CONTRACT、margherita・marinara で MULTI_SPREAD_LAYER が必要になる

### EB-12 — 候補 recipe の base sauce 食い違い（catalog vs PIZZA DB, 7 行）

- **type**: `SHARED_EVIDENCE_SOURCE`、items 7
- **affected recipes（7）**: `black-truffle-pizza-pizzadb-p14`, `boscaiola-pizzadb-p12`, `frutti-di-mare-pizzadb-p11`, `fugazzetta-pizzadb-p10`, `pizza-alla-norma-pizzadb-p9`, `porcini-pizza-pizzadb-p13`, `speck-e-brie-pizzadb-p4`
- **decision**: catalog 候補と PIZZA DB で base sauce（olive-oil / tomato-sauce / 無し）が食い違う候補 recipe の composition 選択。
- **evidence to check**: 独立 source での各 dish の base（bianca か rossa か、olive oil base か）
- **Owner Decision**: YES — composition A/B は owner
- **共通判断**: PARTIAL — 『catalog olive-oil vs PIZZA DB 無し』の 3 行（speck-e-brie, fugazzetta, black-truffle）は共通 policy 可。**recipe 固有判断**: YES — tomato 有無（boscaiola, porcini, alla-norma, frutti-di-mare）は dish ごと
- **rows unlocked**（単独で evidence / decision が閉じる行 4）: guaranteed `pizza-alla-norma-pizzadb-p9`; best-case `boscaiola-pizzadb-p12`, `pizza-alla-norma-pizzadb-p9`, `porcini-pizza-pizzadb-p13`; correspondence —; runtime が残る `black-truffle-pizza-pizzadb-p14`
- **remaining blockers**: 他の batch の item EB-11×1, EB-16×2。閉じた行に残る runtime は min LATE_ADDITION 1 / max LATE_ADDITION 1, SAUCELESS_RECIPE_CONTRACT 3
- **note**: catalog 側 (A) を選ぶと speck-e-brie / boscaiola / porcini / fugazzetta / black-truffle の SAUCELESS_RECIPE_CONTRACT 依存が消える（A の sauce は supported union 内）

### EB-13 — 候補 recipe の topping / cheese 食い違い（8 行）

- **type**: `BUNDLE_PER_ROW_EVIDENCE`、items 8
- **affected recipes（8）**: `buffalo-chicken-pizzadb`, `calzone-pizzadb`, `chicago-deep-dish-pizzadb`, `detroit-style-pizza-pizzadb-p5`, `greek-style-pizzadb`, `pizza-romana-pizzadb-p9`, `siciliana-pizzadb`, `supreme-pizzadb`
- **decision**: catalog 候補と PIZZA DB で topping / cheese が食い違う候補 recipe の composition 選択（base sauce は一致）。
- **evidence to check**: 独立 source での各 dish の標準 topping / mozzarella 暗黙扱い（source が cheese を省略した場合）の policy
- **Owner Decision**: YES — composition A/B は owner
- **共通判断**: PARTIAL — 『source が mozzarella を省略した場合の扱い』だけは共通 policy 可（supreme, detroit ほか）。**recipe 固有判断**: YES
- **rows unlocked**（単独で evidence / decision が閉じる行 6）: guaranteed `supreme-pizzadb`; best-case `supreme-pizzadb`; correspondence —; runtime が残る `buffalo-chicken-pizzadb`, `calzone-pizzadb`, `detroit-style-pizza-pizzadb-p5`, `greek-style-pizzadb`, `pizza-romana-pizzadb-p9`
- **remaining blockers**: 他の batch の item EB-16×2。閉じた行に残る runtime は min LATE_ADDITION 2, MULTI_SPREAD_LAYER 1, UNSUPPORTED_SAUCE_ID_CONTRACT 1, ENCLOSE 1, DOUGH_SHAPE_TARGET 1, DOUGH_VARIANT 3, PAN_BAKE 2 / max LATE_ADDITION 2, MULTI_SPREAD_LAYER 1, UNSUPPORTED_SAUCE_ID_CONTRACT 1, ENCLOSE 1, DOUGH_SHAPE_TARGET 1, DOUGH_VARIANT 3, PAN_BAKE 2
- **note**: どちらを選んでも runtime 依存は変わらない（行の確定 runtime 依存はそのまま残る）

### EB-14 — LATE_ADDITION の mechanic 解釈 confirm / drop（12 行）

- **type**: `SHARED_DECISION`、items 12
- **affected recipes（12）**: `eel-pizza-pizzadb-p1`, `hot-honey-pepperoni-pizzadb-p12`, `lahmacun`, `pizza-asparagi-limone-pizzadb-p8`, `pizza-carciofi-salad-pizzadb-p8`, `pizza-cavolo-carote-pizzadb-p8`, `pizza-cicoria-limone-pizzadb-p8`, `pizza-finocchi-salad-pizzadb-p8`, `pizza-puntarelle-pizzadb-p8`, `pizza-radicchio-noci-pizzadb-p8`, `pizza-zucchine-menta-pizzadb-p8`, `taco-pizza-pizzadb`
- **decision**: 焼成後追加（post-bake finish）の evidence を mechanic として扱うか。
- **evidence to check**: 各行 source の『焼き上がり後にのせる』記述の有無
- **Owner Decision**: YES — confirm/drop
- **共通判断**: YES — 解釈 policy は共通。**recipe 固有判断**: PARTIAL — evidence 有無は行ごと
- **rows unlocked**（単独で evidence / decision が閉じる行 9）: guaranteed —; best-case —; correspondence —; runtime が残る `hot-honey-pepperoni-pizzadb-p12`, `pizza-asparagi-limone-pizzadb-p8`, `pizza-carciofi-salad-pizzadb-p8`, `pizza-cavolo-carote-pizzadb-p8`, `pizza-finocchi-salad-pizzadb-p8`, `pizza-puntarelle-pizzadb-p8`, `pizza-radicchio-noci-pizzadb-p8`, `pizza-zucchine-menta-pizzadb-p8`, `taco-pizza-pizzadb`
- **remaining blockers**: 他の batch の item EB-05×1, EB-07×1, EB-08×2, EB-15×1。閉じた行に残る runtime は min MULTI_SPREAD_LAYER 2, SAUCELESS_RECIPE_CONTRACT 7, DOUGH_VARIANT 2, UNSUPPORTED_SAUCE_ID_CONTRACT 1 / max LATE_ADDITION 9, MULTI_SPREAD_LAYER 2, SAUCELESS_RECIPE_CONTRACT 7, DOUGH_VARIANT 2, UNSUPPORTED_SAUCE_ID_CONTRACT 1

### EB-15 — SERVE_FORM の confirm / drop（2 行）

- **type**: `SHARED_DECISION`、items 2
- **affected recipes（2）**: `lahmacun`, `ny-style-pizzadb`
- **decision**: 巻く・折る等の提供形態を mechanic として扱うか。
- **evidence to check**: lahmacun / ny-style の提供形態記述
- **Owner Decision**: YES
- **共通判断**: YES。**recipe 固有判断**: PARTIAL
- **rows unlocked**（単独で evidence / decision が閉じる行 0）: guaranteed —; best-case —; correspondence —; runtime が残る —
- **remaining blockers**: 他の batch の item EB-07×1, EB-08×1, EB-14×1, EB-19×1。閉じた行に残る runtime は min なし / max なし

### EB-16 — naming cluster の区別・統合（NC-1〜NC-7, 14 行）

- **type**: `BUNDLE_OWNER_REVIEW`、items 12
- **affected recipes（12）**: `argentine-napolitana-pizzadb-p1`, `bianca-pizzadb-row`, `brazilian-calabresa-pizzadb-p10`, `calabresa-argentina-pizzadb`, `chicago-deep-dish-pizzadb`, `chicago-stuffed-pizza-pizzadb-p3`, `chilean-napolitana-pizzadb`, `frutti-di-mare-pizzadb-p11`, `pescatore-pizzadb-p11`, `sfincione-pizzadb`, `siciliana-pizzadb`, `speck-e-brie-pizzadb-p4`
- **decision**: 同名系 cluster の discovery identity を区別するか統合するか。
- **evidence to check**: 各 cluster の区別次元 evidence
- **Owner Decision**: YES
- **共通判断**: PARTIAL — cluster 単位。**recipe 固有判断**: YES — cluster ごと
- **rows unlocked**（単独で evidence / decision が閉じる行 7）: guaranteed `brazilian-calabresa-pizzadb-p10`, `calabresa-argentina-pizzadb`; best-case `brazilian-calabresa-pizzadb-p10`, `calabresa-argentina-pizzadb`; correspondence —; runtime が残る `argentine-napolitana-pizzadb-p1`, `bianca-pizzadb-row`, `chilean-napolitana-pizzadb`, `pescatore-pizzadb-p11`, `sfincione-pizzadb`
- **remaining blockers**: 他の batch の item EB-12×2, EB-13×2, EB-19×1。閉じた行に残る runtime は min DOUGH_VARIANT 1, SAUCELESS_RECIPE_CONTRACT 3, MULTI_SPREAD_LAYER 2 / max DOUGH_VARIANT 1, SAUCELESS_RECIPE_CONTRACT 3, MULTI_SPREAD_LAYER 2

### EB-17 — 調理済み composite ingredient（3 行）

- **type**: `SHARED_DECISION`、items 3
- **affected recipes（3）**: `chicken-tikka-pizza-pizzadb-p5`, `peking-duck-pizza`, `pizza-overload-pizzadb-p7`
- **decision**: 北京ダック / チキンティッカ / ホットドッグ を単一 scatter ingredient とするか分解するか。
- **evidence to check**: 各 dish の source 記述
- **Owner Decision**: YES
- **共通判断**: YES — 1 policy で 3 行。**recipe 固有判断**: PARTIAL
- **rows unlocked**（単独で evidence / decision が閉じる行 2）: guaranteed `pizza-overload-pizzadb-p7`; best-case `pizza-overload-pizzadb-p7`; correspondence —; runtime が残る `peking-duck-pizza`
- **remaining blockers**: 他の batch の item EB-02×1。閉じた行に残る runtime は min UNSUPPORTED_SAUCE_ID_CONTRACT 1 / max UNSUPPORTED_SAUCE_ID_CONTRACT 1

### EB-18 — recipe evidence 再取得（4 行）

- **type**: `BUNDLE_PER_ROW_EVIDENCE`、items 4
- **affected recipes（4）**: `colorado-mountain-pie-pizzadb-p3`, `focaccia-genovese-pizzadb-p10`, `manakish`, `pizza-a-caballo`
- **decision**: EVIDENCE_GAP / SCOPE_QUESTION / SOURCE_INCONSISTENCY の行ごとの一次 source 再確認。
- **evidence to check**: pizza-a-caballo / colorado-mountain-pie の ingredient list / focaccia-genovese の scope / manakish の source 間不一致
- **Owner Decision**: PARTIAL — scope は owner
- **共通判断**: NO。**recipe 固有判断**: YES
- **rows unlocked**（単独で evidence / decision が閉じる行 4）: guaranteed —; best-case —; correspondence —; runtime が残る `colorado-mountain-pie-pizzadb-p3`, `focaccia-genovese-pizzadb-p10`, `manakish`, `pizza-a-caballo`
- **remaining blockers**: 他の batch の item なし。閉じた行に残る runtime は min DOUGH_VARIANT 4, ENCLOSE 1, SAUCELESS_RECIPE_CONTRACT 1 / max DOUGH_VARIANT 4, ENCLOSE 1, SAUCELESS_RECIPE_CONTRACT 1

### EB-19 — 同一 ingredient set 行の識別判断（8 行）

- **type**: `BUNDLE_OWNER_REVIEW`、items 8
- **affected recipes（8）**: `cauliflower-crust-pizza-pizzadb-p2`, `chicago-stuffed-pizza-pizzadb-p3`, `fathead-pizza-keto-pizzadb-p9`, `new-england-bar-pizza-pizzadb-p6`, `ny-style-pizzadb`, `pizza-al-taglio-romana-pizzadb-p9`, `prosciutto-funghi-pizzadb-p11`, `trenton-tomato-pie-pizzadb`
- **decision**: 既存/候補 recipe と同一 ingredient set の行を capability で区別するか、統合/drop するか。
- **evidence to check**: 区別次元（dough / step order / pan）の evidence
- **Owner Decision**: YES — 統合/drop か capability 待ちか
- **共通判断**: NO。**recipe 固有判断**: YES
- **rows unlocked**（単独で evidence / decision が閉じる行 6）: guaranteed `prosciutto-funghi-pizzadb-p11`; best-case `prosciutto-funghi-pizzadb-p11`; correspondence —; runtime が残る `cauliflower-crust-pizza-pizzadb-p2`, `fathead-pizza-keto-pizzadb-p9`, `new-england-bar-pizza-pizzadb-p6`, `pizza-al-taglio-romana-pizzadb-p9`, `trenton-tomato-pie-pizzadb`
- **remaining blockers**: 他の batch の item EB-15×1, EB-16×1。閉じた行に残る runtime は min DOUGH_VARIANT 4, PAN_BAKE 2, DOUGH_SHAPE_TARGET 1, STEP_ORDER 1 / max DOUGH_VARIANT 4, PAN_BAKE 2, DOUGH_SHAPE_TARGET 1, STEP_ORDER 1
- **note**: capability で区別する限り runtime 必須。統合/drop を選ぶと行自体が消える（authoring 対象外）

## 7. 集計: batch 解決後の行の状態

| 状態 | baseline | EB-01〜13 解決後 | EB-01〜19 解決後 |
|---|---:|---:|---:|
| `AUTHORING_READY_GUARANTEED` | 0 | 3 | 8 |
| `AUTHORING_READY_IF_RUNTIME_FREE_OUTCOME` | 0 | 11 | 12 |
| `CLOSED_AS_CORRESPONDENCE_OR_AUTHORING_READY` | 0 | 2 | 2 |
| `CLOSED_AS_CORRESPONDENCE_IF_KEEP_ELSE_RUNTIME` | 0 | 7 | 7 |
| `RUNTIME_REQUIRED` | 0 | 43 | 75 |
| `OPEN_EVIDENCE_OR_DECISION` | 104 | 38 | 0 |
| **合計** | 104 | 104 | 104 |

| 指標 | EB-01〜13 解決後 | EB-01〜19 解決後 |
|---|---:|---:|
| content authoring へ進める（結論に関係なく） | 3 | 8 |
| content authoring へ進める（runtime を伴わない結論の場合、上の行を含む） | 14 | 20 |
| shipped keep で correspondence として閉じる（authoring 不要） | 9 | 9 |
| evidence は閉じたが runtime capability が必要（最良ケース） | 43 | 75 |
| evidence は閉じたが runtime capability が必要（最悪ケース、W0 の adopt を含む） | 61 | 94 |
| 他の batch の evidence / decision が残る | 38 | 0 |

EB-01〜19 解決後に runtime unit が必要になる行数（行は複数の unit に重複して数える）:

| unit | 最良ケース | 最悪ケース |
|---|---:|---:|
| `UNSUPPORTED_SAUCE_ID_CONTRACT` | 31 | 44 |
| `DOUGH_VARIANT` | 27 | 28 |
| `MULTI_SPREAD_LAYER` | 9 | 25 |
| `LATE_ADDITION` | 9 | 20 |
| `SAUCELESS_RECIPE_CONTRACT` | 14 | 20 |
| `PAN_BAKE` | 7 | 7 |
| `DOUGH_SHAPE_TARGET` | 5 | 5 |
| `ENCLOSE` | 3 | 3 |
| `PREP_STEP` | 2 | 2 |
| `ZONED_PLACEMENT` | 0 | 2 |
| `SERVE_FORM` | 0 | 2 |
| `STEP_ORDER` | 2 | 2 |
| `LAMINATE` | 1 | 1 |

### 7.1 authoring へ進める行（EB-01〜19 解決後）

- **結論に関係なく進める（8）**: `calabresa-argentina-pizzadb`, `supreme-pizzadb`, `pizza-overload-pizzadb-p7`, `pizza-chilena-pizzadb-p8`, `pizza-alla-norma-pizzadb-p9`, `brazilian-calabresa-pizzadb-p10`, `frutti-di-mare-pizzadb-p11`, `prosciutto-funghi-pizzadb-p11`
- **runtime を伴わない結論なら進める（12）**:
  - `pizza-baiana`（ピッツァ・バイアーナ）: 最悪ケースで MULTI_SPREAD_LAYER
  - `speck-e-brie-pizzadb-p4`（スペックエブリー）: 最悪ケースで SAUCELESS_RECIPE_CONTRACT
  - `jerusalem-mixed-grill-pizza-pizzadb-p1`（エルサレムミックスグリルピザ）: 最悪ケースで UNSUPPORTED_SAUCE_ID_CONTRACT
  - `caponata-pizza-pizzadb-p2`（カポナータピザ）: 最悪ケースで UNSUPPORTED_SAUCE_ID_CONTRACT
  - `goulash-pizza-pizzadb-p3`（グヤーシュピザ）: 最悪ケースで UNSUPPORTED_SAUCE_ID_CONTRACT
  - `jamaican-jerk-chicken-pizza-pizzadb-p3`（ジャマイカンジャークチキンピザ）: 最悪ケースで UNSUPPORTED_SAUCE_ID_CONTRACT
  - `diavola-pizza-pizzadb-p5`（ディアボラ）: 最悪ケースで MULTI_SPREAD_LAYER, UNSUPPORTED_SAUCE_ID_CONTRACT
  - `nigerian-suya-pizza-pizzadb-p5`（ナイジェリアンスヤピザ）: 最悪ケースで UNSUPPORTED_SAUCE_ID_CONTRACT
  - `banh-mi-pizza-pizzadb-p6`（バインミーピザ）: 最悪ケースで UNSUPPORTED_SAUCE_ID_CONTRACT
  - `boscaiola-pizzadb-p12`（ボスカイオーラ）: 最悪ケースで SAUCELESS_RECIPE_CONTRACT
  - `porcini-pizza-pizzadb-p13`（ポルチーニ茸のピザ）: 最悪ケースで SAUCELESS_RECIPE_CONTRACT
  - `ume-shiso-pizza-pizzadb-p14`（梅しそピザ）: 最悪ケースで UNSUPPORTED_SAUCE_ID_CONTRACT
- **shipped keep で correspondence として閉じる（9）**:
  - `pesto-genovese-pizza-pizzadb-p11`: adopt / both を選んだ場合 なし
  - `meat-lovers-pizza-pizzadb-p13`: adopt / both を選んだ場合 なし
  - `capricciosa-pizzadb`: adopt / both を選んだ場合 ZONED_PLACEMENT
  - `quattro-formaggi-pizzadb`: adopt / both を選んだ場合 SAUCELESS_RECIPE_CONTRACT
  - `margherita-pizzadb-row`: adopt / both を選んだ場合 MULTI_SPREAD_LAYER
  - `bismarck-pizza-pizzadb-p7`: adopt / both を選んだ場合 ZONED_PLACEMENT
  - `fugazza-pizzadb-p10`: adopt / both を選んだ場合 DOUGH_VARIANT, SAUCELESS_RECIPE_CONTRACT
  - `breakfast-pizza-pizzadb-p11`: adopt / both を選んだ場合 UNSUPPORTED_SAUCE_ID_CONTRACT
  - `marinara-pizza-pizzadb-p13`: adopt / both を選んだ場合 MULTI_SPREAD_LAYER

### 7.2 最優先 batch（EB-01〜13）だけで authoring へ進める行

- 結論に関係なく進める（3）: `supreme-pizzadb`, `pizza-chilena-pizzadb-p8`, `pizza-alla-norma-pizzadb-p9`
- runtime を伴わない結論なら進める（11）: `pizza-baiana`, `jerusalem-mixed-grill-pizza-pizzadb-p1`, `caponata-pizza-pizzadb-p2`, `goulash-pizza-pizzadb-p3`, `jamaican-jerk-chicken-pizza-pizzadb-p3`, `diavola-pizza-pizzadb-p5`, `nigerian-suya-pizza-pizzadb-p5`, `banh-mi-pizza-pizzadb-p6`, `boscaiola-pizzadb-p12`, `porcini-pizza-pizzadb-p13`, `ume-shiso-pizza-pizzadb-p14`

数量（minCount）と bakeTarget は、上のどの行でも authoring が必要（#189 matrix の evidence は 0 件）。値は本書では決めていない。

## 8. Owner Decision が必要な項目

| # | 判断 | 関連 batch | 効く行・item | 共通 policy で決められるか |
|---:|---|---|---|---|
| 1 | shipped recipe を PIZZA DB 行で変えるか（keep / adopt / both） | EB-11 | 9 行（W0） | 可（一律 keep などにできる） |
| 2 | family『その他』で evidence が無いときの sauce の扱い（既定値を置くか / 行ごとの evidence を必須にするか） | EB-01 | 10 行 | 可（policy）。値は行ごと |
| 3 | curry / white / hot / tare / dessert sauce を generic 1 id にするか dish 別にするか | EB-02〜06 | 33 行（sauce item）+ alias 2 件 | 粒度 policy は可 |
| 4 | 列挙された spread（mayo / honey 等）を base とみなすか追加の層とみなすか | EB-03 / 04 / 05 / 06 | MULTI_SPREAD_LAYER confirm 10 件 | 可 |
| 5 | generic token（チーズ / 肉 / ナッツ / ひき肉）に既定 id を置くか | EB-07 / 09 / 10 | 10 item | 可（canonicalizer は既定化を禁止しているため、置くなら owner の明示判断が必要） |
| 6 | 唐辛子系を scatter 新 id にするか chili-oil（spread）にするか | EB-08 | 7 行 + diavola composition | 可 |
| 7 | 候補 recipe の composition A/B（catalog か PIZZA DB か） | EB-12 / 13 ほか | 18 件 | 一部可（olive-oil base・mozzarella 暗黙化の扱い） |
| 8 | mechanic 解釈の confirm / drop（LATE_ADDITION / SERVE_FORM / ZONED_PLACEMENT） | EB-14 / 15 / 11 | 16 件 | 解釈 policy は可 |
| 9 | naming cluster の区別 / 統合、prepared composite、同一 set 行の統合 / drop、recipe scope | EB-16〜19 | 27 件 | cluster ごと |
| 10 | Pitz price / unlock fee / star gate / non-star condition / Completion Gate | — | 全体 | PR #220 同様 TBD / OWNER_DECISION_REQUIRED |

## 9. roadmap（d5909ec）との差分として記録する事実

roadmap の分類そのものは変更していない。以下は、本書で item の結論ごとに runtime への影響を展開した結果、新たに見えた点である。

1. **composition A を選ぶと SAUCELESS 依存が消える行が 5 行ある**: speck-e-brie / boscaiola / porcini / fugazzetta / black-truffle。roadmap ではこの 5 行の `SAUCELESS_RECIPE_CONTRACT` を確定依存としていた。しかし catalog 側の composition は olive-oil または tomato-sauce（supported union）を含むので、A を選べば依存は発生しない。このうち speck-e-brie / boscaiola / porcini は、A を選ぶと runtime 依存が 0 になる。
2. **W0 の adopt で新たに runtime が必要になる**: quattro-formaggi と fugazza は、shipped では olive-oil（PAINT_TEMPORARY）を使っている。一方 PIZZA DB 行は family `チーズ`（sauce 無し）なので、adopt を選ぶと `SAUCELESS_RECIPE_CONTRACT` が必要になる。margherita / marinara は adopt で `MULTI_SPREAD_LAYER`、breakfast は adopt で white sauce（union 外）が必要になる。keep を選べば、どれも correspondence として閉じる。
3. **唐辛子系は runtime を伴わずに解決できる**: roadmap は `ALIAS:唐辛子` の runtimeFreeOption を null としていた。しかし canonicalizer の注記（チリ系は scatter topping の可能性が高い）に沿って scatter の新 id と確定すれば、runtime は要らない。本書ではこれを min 側の結論として数えた（確定したわけではない）。
4. **philly-cheesesteak のチーズソース**: sauce として base 扱いにすると、必要な contract が `SAUCELESS_RECIPE_CONTRACT` から `UNSUPPORTED_SAUCE_ID_CONTRACT` に置き換わる。runtime が必要な点は変わらない。
5. **sauce family `その他` 以外の 23 item は、evidence を確定しても runtime が残る**: family label と矛盾しない結論がすべて supported union の外にあるため。runtime-free にするには、family label を否定する evidence（例: 実際はトマトベース）が別途必要になる。

## 10. 本書が決めないこと

- canonical ingredient id（全 alias）
- sauce id（全 sauce item）
- composition A/B/C（全 27 件）
- mechanic confirm/drop
- minCount / bakeTarget の値
- Pitz price / unlock fee / star gate / non-star condition / Completion Gate
- 実装順

## 11. Validation

- 入力の sha256 を再検証した（roadmap の basis.inputs 3 件、および本書の入力 8 件）
- `RecipeSauceProfile.ingredientId` の union を `src/data/recipeSauceProfiles.ts` から読み取り、`olive-oil | pesto | tomato-sauce` であることを assert した
- 104 行すべてが rowOutcomes に含まれ、各状態の合計が 104 になることを確認した
- runtime 以外の item 142 件は、すべてちょうど 1 つの batch に割り当てた
- EB-01〜19 解決後の guaranteed 8 行は、roadmap の contentOnlyResolvable=YES（8 行）と同じ集合である
- 生成 script は scratchpad にだけ置いた（docs / data のみ commit する制約のため）。再現に必要な入力の ref と sha256 は JSON に記録してある

## 12. Machine-readable

`docs/reports/data/TETO_PROGRESS2_172_CONTENT-EVIDENCE_RESOLUTION-PACK.json` の主なキー:

- `basis`: 入力 ref / sha256
- `currentSauceContract`
- `counts`
- `scenarioTotals`: baseline / EB-01〜13 / EB-01〜19
- `cumulativeByBatchOrder`
- `evidenceBatches[]`: affectedRecipes / items / rowsClosedByThisBatchAlone / rowsUnlockedForAuthoringByThisBatchAlone / remainingBlockers / runtimeEffect
- `problems.{sauce,alias,composition}[]`: 問題ごとの source token / candidates / evidenceStatus / ambiguityType / 共通判断・固有判断 / readinessEffectIfResolvedAlone / downstreamCapabilityDependency
- `rowOutcomes[]`: 104 行それぞれの afterPriority / afterAll の状態
