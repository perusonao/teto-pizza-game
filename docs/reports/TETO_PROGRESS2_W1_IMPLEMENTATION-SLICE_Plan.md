# Progression 2.0 W1 Content Wave — Implementation Readiness / Slice Plan

Status: **設計・計画のみ（docs-only）**。production `src/**` は変更していない。merge しない。
Issue: #182（子成果物。新規 Issue は作成していない — §9 Duplicate Gate 参照）
前提 PR: **#220（Fresh Review 中・PASS 扱いにしない）**

## 0. 結論（TL;DR）

- **#220 Fresh Review PASS 待ち。** 本書は #220 HEAD `e49dab9` の値を入力にした「PASS 直後に着手するための準備」であり、#220 の結論を確定扱いしない。
- #220 HEAD の値を再確認した。**W1=10 / W2=11 / W3=45 / W4=80 / W5=16、first-10 = W1 全件、新 ingredient 7 種**（`capers` `clam` `corn` `eggplant` `fresh-tomato` `pineapple` `potato`）。想定値と一致。
- **「data-only」という分類名は実装範囲を過小評価している。** 使い捨て worktree で 1 recipe を足して実測した結果、**production 3 ファイルで型エラー、既存 test 20 件（16 ファイル）が失敗**した（§2）。recipe 1 件の追加に最低でも **production 6 ファイル**（recipes / recipeSauceProfiles / discoveryCatalog / referencePizza / orders / cookingProfiles）が必要。
- **UI capacity:** 390×844 / 360×800 の実測では、W1 追加後（25 recipes / 29 ingredients）も page scroll・overflow は発生しない。W1 の前に UI Phase を入れる必要は**ない**。ただし Dex は約 5.6 画面分（4,214px / 4,517px）になり、W2（36 recipes）の前には Recipe Select / Dex の UI Phase を分けるべき（§4）。
- **推奨は C（vertical slice → 残り）**。最初の slice は **Pizza Portuguesa + Pesto Tonno（新 ingredient 0）**。Shop / Inventory / 価格決定を含まず、recipe 側のすべての接点（discovery、reference/scoring、Completion Gate、unlock chain、Recipe Select、Dex、Lunch Rush pool）を最小差分で通せる（§5, §6）。最終判断は Owner。
- **Blocker（§8）:** ①#220 PASS、②#206 merge（rollback floor）、③新 recipe の unlock 配置（Owner 決定）、④`オリーブ→black-olive` likely-alias の承認、⑤新 ingredient の `pricePitz` / `restockQuantity`（Slice 2 以降）。
- **#221 は #220 の初版 `d3a2c8f` を元にしていて、現在の #220 HEAD とずれている**（W1 の構成が 5/10 件違う。sauceless recipe を 5 件含む。7/10 件が 8-piece ceiling を超える）。#221 は変更していない。Owner の判断が必要（§8 B-6）。

## 1. 監査基準 / GitHub 実状態（2026-09-24 取得）

| 対象 | 状態 |
|---|---|
| `main` | `dff233c042d2df6ee1c3a92f2d2419830aa05460` |
| PR #220 | OPEN / mergeable clean / HEAD `e49dab96bd9b26dc0f520349cf09d1160c3519f5`（4 commits）。Codex review は usage limit で未完了。**Fresh Review 未 PASS** |
| PR #221 | OPEN / HEAD `279b6b17…`。W1 authoring audit。base は #220 **初版** `d3a2c8f` の first-10（§8 B-6） |
| PR #206 | OPEN（3-4B save forward-compat）。自身の Result に「Progression 2.0 content を出荷する前の rollback floor」と記載 |
| PR #205/#209/#211/#213/#214/#217/#218/#219 | OPEN。本作業では変更していない |
| Issue #182 | OPEN（本作業の親） |

**変更していないもの:** #220 / #218 / #205 / #206 / #209 / #211 / #213 / #214 / #217 / #219 / #221 の各ブランチ、production code。merge もしていない。

## 2. 「実装できる」の意味 — 実際の変更ファイル（Fresh Audit）

### 2.1 実測方法

使い捨ての `git worktree`（scratchpad、commit なし・削除済み）で `main` に `pizza-portuguesa` を 1 件だけ追加した（新 ingredient 0。#220 の分類では `RECIPE_DATA_ONLY`）。その上で `tsc -b` と `vitest run` を実行した。

### 2.2 結果

**型エラー（exhaustive `Record<RecipeId, …>`）— 3 ファイル**
- `src/data/recipeSauceProfiles.ts`（`RECIPE_SAUCE_PROFILES`）
- `src/data/discoveryCatalog.ts`（`RECIPE_DISCOVERY_TARGET_IDS`）← **#220 の change map にない**（`src/logic/discovery/*` のみ記載）
- `src/data/cookingProfiles.test.ts`（`RECIPE_STEP_MATRIX`）

**型を埋めた後の test 失敗 — 20 件 / 16 ファイル**

| 失敗理由 | test（ファイル） | 必要な production 変更 |
|---|---|---|
| Reference Pizza 未登録（scoring / Completion Gate / discovery の SSOT） | referencePizza.test, discoveryCatalog.test #12, gameReducer.discovery.test #12, completionGate.test #27, efficiency.test, gameReducer.commitSauceDispense.test, playerReference.test | **`src/data/referencePizza.ts`**：piece 座標・`interaction.landingStyle`・`matching` 半径を手で作る |
| Order 未登録（Pizza Select から開始不可：`startPreparingRecipe` が `null` を返す） | recipes.test「every recipe has exactly one order」 | **`src/data/orders.ts`** |
| CUT allowlist | cookingProfiles.test ×2 | **`src/data/cookingProfiles.ts`**（`CUT_ELIGIBLE_RECIPE_IDS`） |
| 件数の固定 | recipes.test, recipeSauceProfiles.test, economySimulation.test, pizzaSelect.test（章分割）, PizzaSelectScreen.test, progression.test（14 件）, App.test / App.fullGameReset.test（`1 / 15`） | test 側の更新のみ |
| economy simulation の固定値 | economySimulation.test（★3 cap の最終 totalStars が 37→40） | test 更新 ＋ unlock 配置の決定（§8 B-3） |

**e2e 側の固定値（未実行・grep で確認）:** `e2e/progression2-p3-3-onboarding.spec.ts` の `0/15`・`1/15`（4 箇所）、`e2e/viewport-1screen.spec.ts` のコメント。#206 の新 e2e も `1/15` を assert している。

### 2.3 1 recipe を足すときの最小 change set（新 ingredient 0 の場合）

| 区分 | ファイル |
|---|---|
| production（必須） | `src/data/recipes.ts`, `src/data/recipeSauceProfiles.ts`, `src/data/discoveryCatalog.ts`, `src/data/referencePizza.ts`, `src/data/orders.ts`, `src/data/cookingProfiles.ts` |
| production（推奨） | `src/data/hints.ts`（任意 entry だが、無いと SAUCE/TOPPING の案内文が generic になる） |
| test（必須更新） | recipes, recipeSauceProfiles, cookingProfiles, referencePizza, playerReference, discoveryCatalog, completionGate, efficiency, economySimulation, progression, pizzaSelect, PizzaSelectScreen, gameReducer.discovery, gameReducer.commitSauceDispense, App, App.fullGameReset |
| e2e（必須更新） | progression2-p3-3-onboarding（`/15` pill） |

**新 ingredient を 1 種足すと、さらに以下が増える:** `src/data/ingredients.ts`（`unlockCondition` / `pricePitz` / `restockQuantity` / `starterGrantOnly`、emoji・color）、`ingredients.test.ts`（`toHaveLength(22)`）、`InventoryOverlay.test.tsx`（`toBe(22)`）、`economySimulation.test.ts`（`19 finite`）。加えて Shop・Inventory・Starter Grant・Free Cook tray に実際の影響が出る。

→ **結論:** #220 の `RECIPE_DATA_ONLY` / `NEW_INGREDIENT_DATA_ONLY` は「新 mechanic が不要」という意味で正しい。ただし「変更が data ファイル 1〜2 個で済む」という意味ではない。実装 PR の見積もりでは **「recipe 1 件 = production 6 ファイル + test 約 16 ファイル + e2e 1 ファイル + Reference 座標の authoring」** を基準にすること。

## 3. W1 10 レシピ一覧（#220 HEAD `e49dab9` から再取得）

evidence status はすべて `FULL` + `READY`。collision は #220 の判定ではすべて `LOW`（production との比較のみ。W1 同士の近さは §3.2）。mechanic dependency はすべてなし。

| # | recipe | recipe ID（候補） | evidence id | 既存 ingredient | 新 ingredient | sauce（profile） | #220 最近傍（Jaccard） | 実装種別 |
|---|---|---|---|---|---|---|---|---|
| 1 | ニューヘイブンアピッツァ | `new-haven-apizza` | new-haven-apizza-pizzadb | garlic, olive-oil, parmigiano | **clam** | olive-oil（PAINT_TEMPORARY） | quattro-formaggi 0.29 | NEW_INGREDIENT |
| 2 | ハワイアンピザ | `hawaiian` | hawaiian-pizzadb-row | ham, mozzarella, tomato-sauce | **pineapple** | tomato-sauce（PAINT） | meat-lovers 0.43 | NEW_INGREDIENT |
| 3 | パルミジャーナピザ | `parmigiana-pizza` | parmigiana-pizza-pizzadb-p7 | basil, mozzarella, parmigiano, tomato-sauce | **eggplant** | tomato-sauce | margherita 0.60 | NEW_INGREDIENT |
| 4 | バンビーノ | `bambino` | bambino-pizzadb-p7 | ham, mozzarella, tomato-sauce | **corn** | tomato-sauce | meat-lovers 0.43 | NEW_INGREDIENT |
| 5 | ピッツァ・ポルトゲーザ | `pizza-portuguesa` | pizza-portuguesa-pizzadb-p9 | black-olive, egg, ham, mozzarella, onion, tomato-sauce | — | tomato-sauce | capricciosa 0.50 | RECIPE_DATA_ONLY |
| 6 | プッタネスカ | `puttanesca-pizza` | puttanesca-pizza-pizzadb-p10 | anchovy, black-olive, garlic, tomato-sauce | **capers** | tomato-sauce | marinara 0.33 | NEW_INGREDIENT |
| 7 | ペストカプレーゼピザ | `pesto-caprese` | pesto-caprese-pizzadb-p11 | basil, mozzarella, pesto | **fresh-tomato** | pesto（PAINT） | margherita 0.40 | NEW_INGREDIENT |
| 8 | ペストトンノピザ | `pesto-tonno` | pesto-tonno-pizzadb-p12 | black-olive, onion, pesto, tuna | — | pesto | tonno-e-cipolla 0.33 | RECIPE_DATA_ONLY |
| 9 | ペストパターテピザ | `pesto-patate` | pesto-patate-pizzadb-p12 | bacon, mozzarella, pesto | **potato** | pesto | genovese 0.40 | NEW_INGREDIENT |
| 10 | メランザーネピザ | `melanzane-pizza` | melanzane-pizza-pizzadb-p13 | basil, mozzarella, tomato-sauce | **eggplant** | tomato-sauce | margherita 0.75 | NEW_INGREDIENT |

Phase-2 matrix（`docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json`）の SHIPPED_KEEP / EVIDENCE_STRICT 両 profile に、10 件とも同じ target id と items が存在する（`source: pizzadb-172`、`capabilities: []`）。したがって `discoveryCatalog.test` の「Phase-2 target と一致」は、target id を evidence id にすれば構造を変えずに満たせる（実測済み：型を埋めた後の discoveryCatalog.test の失敗は Reference 未登録による #12 のみ）。

### 3.1 required quantity（`minCount`）

**evidence に数量はない。すべて AUTHORING_REQUIRED。** 以下は production 制約を満たすように作った **PROPOSAL（Owner review 用、未確定）**:
- sauce を含む ingredient 種類数 ≤ `MAX_INGREDIENT_PALETTE_SLOTS`（6）
- sauce 以外の piece 合計 ≤ 8（`PIECE_RING_POSITIONS` の 8 slot。超えると player reference / thumbnail の配置が重なる）
- sauce ×1 は既存 15 recipe と同じ

| recipe | PROPOSAL（sauce 以外の piece 合計） | bakeTarget の考え方 |
|---|---|---|
| new-haven-apizza | olive-oil×1, clam×4, garlic×2, parmigiano×2（8） | olive-oil 系（fugazza / pizza-bianca）と同じ幅 |
| hawaiian | tomato×1, mozzarella×2, ham×3, pineapple×3（8） | tomato 系 60–80 |
| parmigiana-pizza | tomato×1, mozzarella×2, eggplant×3, parmigiano×1, basil×2（8） | 58–78 |
| bambino | tomato×1, mozzarella×2, ham×3, corn×3（8） | 60–80 |
| pizza-portuguesa | tomato×1, mozzarella×2, ham×2, egg×1, onion×1, black-olive×2（8、6 種類で上限ちょうど） | capricciosa と同じ 58–78 |
| puttanesca-pizza | tomato×1, anchovy×2, black-olive×2, capers×2, garlic×2（8） | cheese なし、marinara 寄り 45–65 |
| pesto-caprese | pesto×1, mozzarella×2, fresh-tomato×3, basil×2（7） | genovese と同じ 50–70 |
| pesto-tonno | pesto×1, tuna×3, black-olive×2, onion×2（7） | 50–70 |
| pesto-patate | pesto×1, mozzarella×2, potato×3, bacon×2（7） | 55–75 |
| melanzane-pizza | tomato×1, mozzarella×2, eggplant×3, basil×2（7） | 58–78 |

`minCount` の意味は #218（Completion Gate partial-quantity、OPEN）の決定に依存する。数量は #218 の結論と整合させてから確定すること（§8 B-7）。

### 3.2 類似度 — production + W1 同士（本書で追加計算）

discovery は **ingredient set の完全一致**（`matcher.ts` 規則 1。superset/subset は ORIGINAL）なので、10 件とも自動 collision は 0。ただし差分 1〜2 の近さは、プレイヤーの混乱と「既存レシピに 1 品足すと別レシピとして発見される」挙動変化の原因になる。

| 組 | 対称差 | 影響 |
|---|---|---|
| margherita ⊂ melanzane ⊂ parmigiana | eggplant / parmigiano の各 1 品 | Margherita に eggplant を足すと **Melanzane として NEW_DISCOVERY**（選択レシピと異なる discovery は `registerDiscoveryToDex` が Completion Gate を通したうえで書き込む）。regression test 必須 |
| hawaiian ↔ bambino | pineapple ↔ corn | ham+mozz+tomato の上に 1 品だけ違う。Dex / 選択画面で見分けられるか visual QA |
| pesto-caprese ↔ genovese | basil + fresh-tomato ↔ cherry-tomato | fresh-tomato と cherry-tomato の意味的な近さ。§3.3 の emoji 衝突と合わさる |

#220 の collision 判定は production との比較のみで、W1 同士の近さを含まない（#220 への指摘として記録。#220 は変更していない）。

### 3.3 新 ingredient 一覧（7 種）

| id | 使う W1 recipe | category / placement（案） | emoji 候補と既存との衝突 | 備考 |
|---|---|---|---|---|
| `eggplant` | parmigiana, melanzane | topping / scatter | 🍆（衝突なし） | 1 種で 2 recipe。amortization 最良 |
| `pineapple` | hawaiian | topping / scatter | 🍍（衝突なし） | |
| `corn` | bambino | topping / scatter | 🌽（衝突なし） | |
| `potato` | pesto-patate | topping / scatter | 🥔（衝突なし） | W0_CORRESPONDENCE 側でも new 扱い |
| `clam` | new-haven-apizza | topping / scatter | 🦪 は牡蠣。専用 emoji なし | 名前で具体性を補う |
| `capers` | puttanesca | topping / scatter | 専用 emoji なし。🟢 等。**black-olive ⚫ と同じ recipe に並ぶ** | 小粒の丸の見分け |
| `fresh-tomato` | pesto-caprese | topping / scatter | **🍅 は tomato-sauce と cherry-tomato が既に使用**（3 重衝突） | 要 visual 決定。さらに **pesto 🌿 と basil 🌿 が既に同じ emoji で、pesto-caprese は両方を使う** |

`IngredientPieceVisual` は topping を data の `color` + `emoji` で描くため、専用 bitmap は不要（#220 と同じ結論）。ただし上の 3 種（clam / capers / fresh-tomato）と pesto+basil の組には visual authoring の判断が必要。

## 4. UI capacity assessment（実測）

**方法:** `main` を dev server で起動し、全 15 recipe discovered・全 19 finite ingredient owned の save を注入した。Chromium の 390×844 と 360×800 で実測した。W1 追加後の件数は、実 DOM の card/row を clone して再計測した（production code は変更していない。scratch spec は scratchpad のみ）。

| 画面 | 件数（現 → W1後） | 390×844 scroll 高 / 可視高 | 360×800 scroll 高 / 可視高 | page scroll | 判定 |
|---|---|---|---|---|---|
| Recipe Select（2 列 grid、card 168px、row 178px） | 15 → 25 | 1,508 → **2,398** / 788（約 3.0 画面） | 1,555 → **2,445** / 744（約 3.3 画面） | なし | **収容可**。内部 scroll のみ |
| Shop（1 列、row 84px、pitch 92px） | 19 → 26 行（全 owned 時） | 1,675 → **2,319** / 756（約 3.1 画面） | 1,787 → **2,431** / 712（約 3.4 画面） | なし | **収容可**。category tab あり |
| Inventory（3 列 grid） | 22 → 29 | 846 → **1,034** / 756 | 859 → **1,047** / 712 | なし | **収容可**（jsdom でも 62 件 fixture の test あり） |
| Dex（1 列 card 約 165–177px、filter なし） | 15 → 25 | 2,615 → **4,214** / 756（約 5.6 画面） | 2,800 → **4,517** / 712（約 6.3 画面） | なし | **収容可だが長い**。W2 前に UI Phase を推奨 |
| Ingredient Tray（PREPARE、6 slot/page） | recipe ごとに 6 種以下 | — | — | — | 構造上は影響なし（W1 は最大 6 種＝Portuguesa） |
| Free Cook tray（owned 全部、category ごとに paging） | topping 15 → 22 | — | — | — | 約 3 → 4 page。機能上は問題なし（App.freeCookTrayPaging.test で担保） |

**Recipe Select の章分割:** `RECIPE_SECTION_FALLBACK_CHUNK_SIZE=8` なので、25 件は「第1章 7 / 第2章 8 / **第3章 8 / 第4章 2**」になる。表示は破綻しないが、2 件だけの第4章が生じる。Progression 2.0（発見ベース）で「章」が何を意味するかは Owner 判断（§8 B-8）。

**結論:** W1（+10 recipe / +7 ingredient）の前に**必須の UI Phase はない**。W1 の各 slice の Human Verification で Recipe Select・Shop・Inventory・Dex の 390×844 / 360×800 scroll 到達を確認すれば足りる。**W2（累計 36 recipe / 約 46 ingredient）の前に**、以下を別 Phase として分けることを推奨する。
- **UI-A: Dex 2.0**（discovered / undiscovered filter、または gallery 化。既存ロードマップの「Dex Gallery 1A/1B」）
- **UI-B: Recipe Select section 意味付け**（章 → 発見状態・材料カテゴリ等。既存ロードマップの「Recipe Select 2.0B」）

## 5. A/B/C implementation comparison

| 観点 | A: 10 件一括 | B: 5 + 5 | C: 2〜3 件の vertical slice → 残り（推奨） |
|---|---|---|---|
| regression risk | 高。production 6 ファイル × 10 件、Reference 10 件、新 ingredient 7 種を同時に入れる | 中。どちらの半分にも新 ingredient が入る | **低**。Slice 1 は既存 ingredient のみで、recipe 側の全接点を 2 件で検証できる |
| UI 確認量 | Recipe Select +10 / Shop +7 / Inventory +7 / Dex +10 を 1 回で | 2 回に分かれるが、各回に Shop 変化が入る | Slice 1 は Recipe Select / Dex のみ。Shop / Inventory は Slice 2 から |
| ingredient 追加量 | 7 | 3〜4 / 3〜4 | **0** → 1（eggplant）→ 残り 6 |
| Shop への影響 | 7 行増。価格 7 件を同時に決める必要 | 各回 3〜4 件 | Slice 1 は**影響なし**。価格決定は Slice 2 の 1 件から |
| Inventory への影響 | +7 finite、Starter Grant 7 種 | 半分ずつ | Slice 1 は**影響なし**（既存 finite の grant 量が増えるだけ） |
| recipe selector への影響 | +10（第3章・第4章が同時に出現） | +5 / +5 | +2（第3章に 2 件） |
| scoring 確認 | Reference 10 件の座標 / landingStyle / 半径 | 5 件ずつ | 2 件。Completion Gate の PASS/FAIL を recipe ごとに確認 |
| visual QA | 新 emoji 7 種＋衝突 3 件を同時に | 分散 | Slice 1 は既存 emoji のみ。衝突がある 3 種は後ろの slice に回せる |
| test 量 | 固定値の更新は 1 回で済むが、1 PR に集中 | 2 回 | 3〜5 回（固定値の更新を毎回繰り返す）。各 PR は小さい |
| rollback しやすさ | 低（Dex / inventory / grant に 10 recipe・7 ingredient 分の save data） | 中 | **高**。ただし #206 merge が前提（§8 B-2） |
| Owner 決定の待ち | 価格 7 件・visual 3 件・alias・unlock 配置が全部揃うまで着手できない | 半分ずつ | Slice 1 は **alias 承認と unlock 配置だけ**で着手可能 |

**推奨: C。** 理由: 最初の PR が「既存 ingredient のみ」で済むこと。これで Economy / Shop / 価格の未決定（#217 / #216 系）から切り離して、recipe 追加の配管（6 ファイル＋固定 test）を 1 度確立できる。**最終決定は Owner に残す。**

## 6. 最小 implementation slice の設計

### Phase 0 — 着手前提（コード変更なし／他 PR の決定）
- #220 Fresh Review **PASS**
- **#206 merge**（Progression 2.0 content を出荷する前の rollback floor。未 merge のまま W1 を出すと、rollback したビルドが最初の write で新 recipe の Dex / claimed ledger を消す）
- Owner 決定: 新 recipe の unlock 配置（§8 B-3）、`オリーブ→black-olive` の alias 承認（§8 B-4）

### Phase 1 — Slice 1: Pizza Portuguesa + Pesto Tonno（新 ingredient 0）

| 項目 | 変更 | 内容 |
|---|---|---|
| recipes | **あり** | `recipes.ts` に 2 件。`unlockCondition` は B-3 の決定に従う（現行 EP1 の +3 step を延長する場合: meat-lovers → portuguesa 39 → pesto-tonno 42） |
| ingredients | なし | 既存のみ（ham / egg / onion / black-olive / tuna / pesto / mozzarella / tomato-sauce） |
| sauce profiles | **あり** | tomato-sauce / PAINT、pesto / PAINT。`recipeSauceProfiles.test` の件数更新 |
| inventory | なし（コード） | 既存 finite ingredient の Starter Grant 量が recipe 分だけ増える（`minCount × 10`）。economy simulation の固定値を更新 |
| shop | なし | 新しい行なし |
| scoring | **あり（data）** | `referencePizza.ts` に Reference 2 件（8 slot 座標、landingStyle、matching 8/22） |
| discovery | **あり** | `discoveryCatalog.ts` に target id（evidence id）2 件。W1 同士・production との近傍 regression（Portuguesa ↔ capricciosa / bismarck、Pesto Tonno ↔ tonno-e-cipolla） |
| UI | **あり（表示件数）** | Recipe Select +2（第3章 出現）、Dex 17 件、HOME pill `/17`。UI コード変更はなし |
| orders / cooking | **あり** | `orders.ts` に 2 件、`cookingProfiles.ts` の CUT allowlist に 2 件、`hints.ts`（推奨） |
| tests | **あり** | §2.3 の固定 test 約 16 ファイル ＋ 新規: 2 recipe の reference が自身として discovery されること、Completion Gate PASS/FAIL、近傍 recipe に誤 match しないこと |
| E2E | **あり** | `progression2-p3-3-onboarding` の `/15` 更新。新規 1 本: Recipe Select から Portuguesa を開始 → 完成 → Dex 登録（390×844 / 360×800） |
| visual verification | **あり** | Human Verification Policy 適用（Recipe Select / Dex / gameplay）。MP4 はユーザーに直接提出、before/after screenshot は `docs/reports/screenshots/<task>/` |

### Phase 2 — Slice 2: eggplant + Melanzane + Parmigiana（新 ingredient 1 → 2 recipe）
- ingredients **あり**（eggplant: `unlockCondition` / `pricePitz` / `restockQuantity=minCount×3` / `starterGrantOnly: true`、emoji 🍆）
- shop / inventory **あり**（restock 行 +1、Inventory +1、Starter Grant）
- discovery **あり**。**Margherita + eggplant → Melanzane、Melanzane + parmigiano → Parmigiana** の境界 regression が必須
- それ以外は Phase 1 と同じ構成。**blocker: eggplant の価格（§8 B-5）**

### Phase 3 — Slice 3: pineapple / corn → Hawaiian + Bambino
- 新 ingredient 2、recipe 2。Hawaiian ↔ Bambino の見分けを visual QA する

### Phase 4 — Slice 4: potato → Pesto Patate、clam → New Haven Apizza
- New Haven は olive-oil / PAINT_TEMPORARY（既存 3 件と同じ系統）。clam の emoji 判断

### Phase 5 — Slice 5: capers → Puttanesca、fresh-tomato → Pesto Caprese
- **visual 決定が最も重い 2 種**（capers と black-olive の並び、fresh-tomato 🍅 の 3 重衝突、pesto と basil の 🌿 重複）を最後に回す

各 slice で「Progression / Economy 依存」を再確認すること:
- unlock: 現行 production は EP1 chain（`requiresRecipeId` + `minTotalStars`）。`economySimulation.test` は**全 recipe が chain 上にあること**を要求する。Progression 2.0 rule layer（#205）は unwired
- **discovery と unlock の非対称:** `registerDiscoveryToDex` は `recipeUnlocked` を見ない。材料を持っていれば、Free Cook で chain 解放前に新 recipe を発見できる（Slice 1 は既存材料のみなので実際に起こりうる）。仕様として許容するかを Owner が確認すること（§8 B-3 に含む）
- 価格: ingredient の `pricePitz` は Economy Tuning 1 の tier 慣例で決めるか、#216 / #217 の新 economy を待つか（§8 B-5）

## 7. 次の Issue / PR 候補（作成はしていない）

| 候補 | 種別 | 前提 |
|---|---|---|
| **P2-W1-S1**: Pizza Portuguesa + Pesto Tonno（既存 ingredient） | 実装 PR（Refs #182） | #220 PASS、#206 merge、B-3、B-4 |
| P2-W1-S2: eggplant + Melanzane + Parmigiana | 実装 PR | S1 merge、B-5（eggplant 価格） |
| P2-W1-S3〜S5 | 実装 PR ×3 | 前の slice、価格・visual 決定 |
| P2-W1-AUTH: W1 authoring の再生成（#220 HEAD 基準、8-piece ceiling / supported sauce 制約つき） | docs PR（#221 の後継 or #221 の更新） | Owner が #221 の扱いを決定（B-6） |
| UI-A: Dex 2.0 / UI-B: Recipe Select section | UI Phase | **W2 着手前**（W1 には不要） |

全て #182 の子として管理可能なため、**新規 Issue は作らない**（§9）。実装 PR 作成時に Owner が Issue 分割を望む場合は、その時点で Duplicate Gate を再実施する。

## 8. Blocker

| ID | 内容 | 種別 | 影響 slice |
|---|---|---|---|
| B-1 | **#220 Fresh Review 未 PASS**（Codex review は usage limit で未完了） | Review | 全部 |
| B-2 | **#206 未 merge**（rollback floor） | 前提 PR | 全部（出荷前） |
| B-3 | **新 recipe の unlock 配置**: EP1 chain 延長（例: +3 step）か、Progression 2.0 wiring（#205 / #214 / #217）を待つか。Free Cook による chain 前の発見を許容するか | Owner 決定 | 全部 |
| B-4 | `オリーブ`→`black-olive` likely-alias の承認（Portuguesa / Pesto Tonno / Puttanesca） | Owner / evidence | S1, S5 |
| B-5 | 新 ingredient の `pricePitz` / `restockQuantity`（`economySimulation.test` は正の整数を要求） | Owner / Economy | S2 以降 |
| B-6 | **#221 が #220 初版 `d3a2c8f` を元にしている**: W1 構成が現 HEAD と 5 件違う（aussie / bacalhau / full-english-pizza / polish-kielbasa / tsukimi-pizza は現 HEAD では 5 件とも `SAUCELESS_RECIPE_CONTRACT` で W4）。`sauceProfileRequired: false` は現行の exhaustive Record 契約と矛盾。10 件中 7 件の minCount 候補が 8-piece ceiling を超える（9〜10 piece） | Owner 判断（本作業では #221 を変更しない） | authoring 入力 |
| B-7 | #218（Completion Gate partial-quantity）の決定で `minCount` の意味が変わる可能性 | Owner 決定 | 数量確定 |
| B-8 | Recipe Select の「章」の意味（25 件で 第4章 = 2 件） | Owner 決定（非 blocking） | UI-B |
| B-9 | visual: fresh-tomato の emoji 衝突、pesto と basil の 🌿 重複、capers / clam に専用 emoji がない | Owner / visual | S4, S5 |

## 9. Duplicate Gate / Issue 管理

- open Issue 一覧と `W1 / Content Wave / content readiness / recipe addition` の検索を実施した。該当は #182（親）と #216（economy design）のみ。
- #220 / #221 とも「#182 で管理可能、新規 Issue 不要」と結論しており、本書も同じ判断。**新規 Issue は作成していない。**

## 10. PR #220 Fresh Review との依存関係

| 本書の項目 | #220 への依存 | #220 の結論が変わった場合 |
|---|---|---|
| W1 10 件 / 新 ingredient 7 種（§3） | **直接依存**（HEAD `e49dab9` の値） | §3〜§6 を再生成。slice 構成も再評価 |
| 「data-only」の過小評価（§2） | 独立（main の実測） | 影響なし |
| UI capacity（§4） | 件数（+10 / +7）のみ依存 | 件数が変われば clone 数を変えて再計測 |
| 最小 slice = Portuguesa + Pesto Tonno | #220 で両者が `RECIPE_DATA_ONLY` であること | どちらかが W1 から外れたら Slice 1 を差し替え |
| #221 との不整合（B-6） | #220 HEAD が正であることが前提 | #220 が初版側に戻れば B-6 は解消 |
| #220 への指摘（Review 入力として記録。#220 は変更していない） | — | ① change map に `src/data/discoveryCatalog.ts`・`referencePizza.ts`・`orders.ts`・`cookingProfiles.ts` がない。② collision が production 比較のみで W1 同士（Δ1: margherita ⊂ melanzane ⊂ parmigiana、hawaiian ↔ bambino）を含まない |

**状態: #220 Fresh Review PASS 待ち。** 本書は PASS を前提にしていない。PASS 後に §1 の SHA を再確認してから Phase 0 に進むこと。

## 11. Validation / 証跡

- `git fetch` 後の SHA: main `dff233c`、#220 `e49dab9`、#221 `279b6b1`
- #220 各 commit の `first10CandidateSet` を比較: `d3a2c8f` は 6 ingredient（aussie 系）、`4b777fe` 以降は 7 ingredient（現行）
- 1 recipe 追加の実測: scratch worktree で `tsc -b` → 3 error、`vitest run` → 20 failed / 2,399 passed（125 files）。worktree は削除済みで、commit していない
- UI 実測: Chromium 390×844 / 360×800、scratch Playwright spec（scratchpad のみ、repo 外）
- production code の変更: なし。本 PR（branch）は本ファイルのみ
