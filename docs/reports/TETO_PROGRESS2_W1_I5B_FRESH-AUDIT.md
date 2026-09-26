# Progression 2.0 W1 I5b — 10 New Recipes / 25 Recipe Integration: Fresh Audit

Status: **Fresh Audit 承認済み（owner、2026-09-25）。OD-I5B-1 / OD-I5B-2 とも RESOLVED。I5b は slice 単位で実装中（I5b-1 から）。**

- OD-I5B-1 = **RESOLVED**（Mito の注文セリフ 10 件を承認）
- OD-I5B-2 = **RESOLVED**

この文書は docs のみの記録です。`src/**` と `e2e/**` は変更していません。

## 0. 監査の基準

| 項目 | 値 |
|---|---|
| audited main | `12a09de2c4da8ed7e92f1ff9f47dd7bdf824a6e5`（PR #228 = I5a の merge） |
| 本番の現状 | ingredient catalog 29 / RECIPES 15 / 入手可能な材料 22 / `DISCOVERY_LADDER` = shipped-15（14 step） |
| REC-01〜03 の authority | `35bc937`（branch `claude/w1-fresh-audit-rec-6u420b`。main には入っていない） |
| REC-04 の authority | `6fe02e2`（branch `claude/rec-04-fresh-design-gz6em4`。main には入っていない） |
| RT-01 の authority | `745fbd7`（main に入っている）。RT-01a/b は実装済み |
| REC-03 の実装 gate | #222 の Completion Gate は main に入っている（I1） |
| W1 の visual | `3fc02a0`（7/7 HUMAN_PASS）。I5a で実装済み |
| #221 | `070afc0827f382bec8bc813d62e7fafe663a0991`。**参照のみ**で、merge も cherry-pick もしない |

数値は scratchpad 上で本番の純関数（`materialOffer`、`resolveShopEntitlement`、`buildKeyRecipeLadder`、`assignReferenceSlots`）を使って計算した。

## 1. 10 recipe の確定定義

| id | nameJa | requiredIngredients（minCount） | bakeTarget | CUT |
|---|---|---|---|---|
| new-haven-apizza | ニューヘイブンアピッツァ | olive-oil 1, parmigiano 2, clam 3, garlic 2 | 62–82 | **なし** |
| hawaiian | ハワイアンピザ | tomato-sauce 1, mozzarella 2, ham 2, pineapple 3 | **60–80** | 6 |
| parmigiana-pizza | パルミジャーナピザ | tomato-sauce 1, mozzarella 2, eggplant 3, parmigiano 2, basil 2（ソース以外 9 個） | 58–78 | 6 |
| bambino | バンビーノ | tomato-sauce 1, mozzarella 2, ham 2, corn 3 | 56–76 | 6 |
| pizza-portuguesa | ピッツァ・ポルトゲーザ | tomato-sauce 1, mozzarella 2, ham 3, egg 1, onion 2, black-olive 2（10 個） | 58–78 | 6 |
| puttanesca-pizza | プッタネスカ | tomato-sauce 1, anchovy 3, black-olive 2, capers 2, garlic 2（9 個） | 50–70 | 6 |
| pesto-caprese | ペストカプレーゼピザ | pesto 1, mozzarella 2, fresh-tomato 3, basil 2 | 50–70 | 6 |
| pesto-tonno | ペストトンノピザ | pesto 1, tuna 3, black-olive 2, onion 2 | 50–70 | 6 |
| pesto-patate | ペストパターテピザ | pesto 1, mozzarella 2, potato 3, bacon 2 | 58–78 | 6 |
| melanzane-pizza | メランザーネピザ | tomato-sauce 1, mozzarella 2, eggplant 3, basil 2 | 58–78 | 6 |

- **description:** #221 の authored 値を使う。New Haven だけは 35bc937 の文言にする: 「オリーブオイルを塗った生地に、あさり、にんにく、パルミジャーノをのせて香ばしく焼き上げたニューヘイブン風の一枚。」
- **`baseRewardPitz`:** 100（Issue #38 V1 の本番の慣例で、全 recipe が同額）。
- **`unlockCondition`:** なし（OD-I5B-2）。`mysteryLock` もなし。
- **Discovery target id:** #221 の `evidenceId` を使う。
  - `new-haven-apizza-pizzadb`
  - `hawaiian-pizzadb-row`
  - `parmigiana-pizza-pizzadb-p7`
  - `bambino-pizzadb-p7`
  - `pizza-portuguesa-pizzadb-p9`
  - `puttanesca-pizza-pizzadb-p10`
  - `pesto-caprese-pizzadb-p11`
  - `pesto-tonno-pizzadb-p12`
  - `pesto-patate-pizzadb-p12`
  - `melanzane-pizza-pizzadb-p13`
- **材料集合の重複:** 25 recipe の中で、材料集合が完全に一致する組は 0。Discovery は完全一致の signature で判定するので、Melanzane ⊂ Parmigiana や Margherita ⊂ Melanzane のような部分集合の関係は衝突しない。

## 2. #221 の古い判断（authority として採用しない）

| #221 の値 | 現在の authority |
|---|---|
| Hawaiian の bakeTarget 58–78 | 60–80（35bc937 Q1） |
| New Haven の説明文「…アメリカ・ニューヘイブン風…」（61 文字） | 「アメリカ・」を削除（56 文字） |
| 10 件すべて `STANDARD_ROUND_6_SLICES` | 9 件を CUT、New Haven は CUT なし（35bc937 Q3） |
| `completionGateEffect: OWNER_DECISION_REQUIRED_ISSUE_218` | REC-03 は RESOLVED。#222 は main に入っている |
| progression の `pitzPrice / unlockFee / starGate: TBD`、`nonStarUnlockCondition: OWNER_DECISION_REQUIRED` | REC-04（ladder、解放料 0、tier 価格）と OD-I5B-2 |
| `referenceCapacity fits:false / REFERENCE_RING_CAPACITY` | RT-01a/b は main に実装済み。残りは RT-01c（fixture）だけ |
| ING-02/03/07/08/09/10/11 が未解決、emoji 候補 🟢/🦪/🍅 | Human Visual（3fc02a0）と I5a の専用 visual |
| `baseRewardPitz: OUT_OF_SCOPE_PROGRESSION_DECISION` | 本番の慣例 100 |
| 変更の分け方（slice A〜E）、`sanitizeInventory` が未知 id を捨てるという注意書き | I0 / I4 / I5a で解消済み |

## 3. 25 recipe / 24 step の Discovery Ladder

production の 15 recipe に W1 の 10 recipe の材料集合を足して `buildKeyRecipeLadder` をかけた。結果は `REC04_W1_25_LADDER_FIXTURE` と完全に一致し、`validateDiscoveryLadder` のエラーは 0 件だった。

- Margherita は starter だけで作れるので、step を持たない。
- 発見数が N 以上になると step N が解放される。1 回の発見で 1 step 進む。
- 解放されるのは MATERIAL だけで、⭐ は条件に使わない。一度解放されたものは relock しない。

| step | 材料 | key recipe | tier |
|---|---|---|---|
| 1 | egg | bismarck | T1 |
| 2 | bacon | breakfast-pizza | T1 |
| 3 | mushroom | funghi | T1 |
| 4 | **eggplant** | melanzane-pizza | T1 |
| 5 | parmigiano | parmigiana-pizza | T1 |
| 6 | pepperoni | pepperoni | T2 |
| 7 | sausage | salsiccia | T2 |
| 8 | ham | meat-lovers | T2 |
| 9 | **corn** | bambino | T2 |
| 10 | **pineapple** | hawaiian | T2 |
| 11 | black-olive + oregano | capricciosa | T2 |
| 12 | onion | pizza-portuguesa | T2 |
| 13 | olive-oil | fugazza | T2 |
| 14 | garlic | marinara | T2 |
| 15 | anchovy | napoletana | T3 |
| 16 | tuna | tonno-e-cipolla | T3 |
| 17 | pesto | pesto-tonno | T3 |
| 18 | cherry-tomato | genovese | T3 |
| 19 | **clam** | new-haven-apizza | T3 |
| 20 | **fresh-tomato** | pesto-caprese | T3 |
| 21 | **potato** | pesto-patate | T3 |
| 22 | rosemary | pizza-bianca | T3 |
| 23 | **capers** | puttanesca-pizza | T3 |
| 24 | fontina + gorgonzola | quattro-formaggi | T3 |

## 4. 新 7 材料の activation mapping

共通の流れ:

- step に達すると RESULT に通知が出る（「🆕 新しい材料が入荷：…」）。
- Shop に「NEW 入荷」行が出る。在庫は 0 で、無料の grant はない。
- 初回パックを買う。
- Free Cooking の tray に出る。所持していれば在庫 0 でも出る。

在庫の単位は 7 つとも scatter なので個数。

| 材料 | step | tier | 初回 | パック（10 × k） | 補充 | 発見につながる recipe |
|---|---|---|---|---|---|---|
| eggplant | 4 | T1 | 60 | 30（k=3） | 30 | melanzane-pizza。その後 parmigiano（step 5）と合わせて parmigiana-pizza |
| corn | 9 | T2 | 80 | 30 | 40 | bambino |
| pineapple | 10 | T2 | 80 | 30 | 40 | hawaiian |
| clam | 19 | T3 | 100 | 30 | 50 | new-haven-apizza |
| fresh-tomato | 20 | T3 | 100 | 30 | 50 | pesto-caprese |
| potato | 21 | T3 | 100 | 30 | 50 | pesto-patate |
| capers | 23 | T3 | 100 | 20（k=2） | 50 | puttanesca-pizza |

I5a で k が 0 だったのは、使う recipe が RECIPES になく、ladder にもなかったから。RECIPES の追加と ladder の切り替えを同時に行えば、自動的に販売対象になる。I5a の save 互換（既知 id、round-trip、I0）は変わらない。

## 5. 既存材料の step / tier / 価格の変化（shipped-15 → 25 ladder）

| 材料 | step | tier | 初回 / 補充 |
|---|---|---|---|
| parmigiano | 14 → 5 | T2 → **T1** | 80/40 → **60/30**（値下がり） |
| pepperoni | 4 → 6 | T1 → **T2** | 60/30 → **80/40** |
| sausage | 5 → 7 | T1 → **T2** | 60/30 → **80/40** |
| anchovy | 9 → 15 | T2 → **T3** | 80/40 → **100/50** |
| tuna | 12 → 16 | T2 → **T3** | 80/40 → **100/50** |
| pesto | 13 → 17 | T2 → **T3** | 80/40 → **100/50** |
| cherry-tomato | 13 → 18 | T2 → **T3** | 80/40 → **100/50** |
| rosemary | 11 → 22 | T2 → **T3** | 80/40 → **100/50** |
| fontina | 14 → 24 | T2 → **T3** | 80/40 → **100/50** |
| gorgonzola | 14 → 24 | T2 → **T3** | 80/40 → **100/50** |
| ham | 6 → 8 | T2 | 80/40（変わらない） |
| oregano / black-olive | 7 → 11 | T2 | 変わらない |
| onion | 10 → 12 | T2 | 変わらない |
| olive-oil | 10 → 13 | T2 | 変わらない |
| garlic | 8 → 14 | T2 | 変わらない |
| egg / bacon / mushroom | 変わらない | T1 | 変わらない |

- 価格が変わるのは 10 材料（値下がり 1、値上がり 9）。
- entitlement の migration とは別の話。解放済み、所持、在庫、Pitz は一切減らない（ledger は union で、relock しない）。変わるのは、この先の購入・補充の価格だけ。
- **Owner Decision は不要と判断した。**
  - tier は REC-04 authority（ladder step の帯で決める）から導かれる結果。
  - REC-04 の authority ladder は最初から 25 recipe のもので、shipped-15 は I4b の暫定状態。
  - 既存材料の価格を据え置く（grandfather）案は、仕組みが増えるので推奨しない。

## 6. k / パック量

- 既存材料で k が変わるのは **ham の 1 → 3 だけ**（pizza-portuguesa が ham ×3）。
  - パックは 10 → 30。価格は T2 の 80/40 のまま。
  - REC-04 が「W1 の data slice で明示的な balance 変更として行う」と推奨しているとおり。
- その他の既存材料の k は変わらない。
  - bacon 3、garlic 3、black-olive 2、onion 4、parmigiano 2、egg 1、pesto 1、tuna 3、mozzarella は starter。
- 新 7 材料の k は §4 のとおり（capers 2、ほかは 3）。

## 7. RT-01c

main（RT-01a/b）にすでにあるもの:

- `getReferenceSlots`（9 個以上は Candidate B の multi-ring）
- `assignReferenceSlots`（interleave）
- `playerReference` / `PizzaThumbnail` の切り替え
- 1〜8 個のときの従来配置との一致（legacy parity）

I5b で RT-01c として追加するものは、Parmigiana / Portuguesa / Puttanesca の生成結果を `referencePizza.ts` に**リテラルとして固定すること**だけ。

| recipe | 個数 | layout | 最小間隔（目標 18.2） | 最大半径（上限 34） |
|---|---|---|---|---|
| parmigiana-pizza | 9 | multi-ring | 21.43 | 28.0 |
| pizza-portuguesa | 10 | multi-ring | 19.15 | 28.0 |
| puttanesca-pizza | 9 | multi-ring | 21.43 | 28.0 |

- `referencePizza.ts` は layout module を import しない（Meat Lovers の前例）。
- 許容は full 8 / zero 22。
- 生成結果とリテラルが一致することを test で固定する。
- 生成器の再実装はしない。

## 8. MD-01 — Scoring 2.0 reference fixture

10 件すべてに `REFERENCE_PIZZAS` の fixture が必要。`referencePizza.test` は「RECIPES の全件に fixture がある」ことを強制する。

fixture は見本（mini 見本 / popover）の表示と、score の目標を兼ねる（Reference Truth #167）。

| 項目 | 方針 |
|---|---|
| sauce | `computeMechanicalSauceReference` で導出する（機械的な導出で、数値は作らない） |
| pieceGroups | 7 件は従来の ring（最小間隔 20.0、最大半径 31.4）。3 件は §7 の multi-ring。どちらもリテラルで固定する |
| landing | basil は LIGHT_LEAF、それ以外は HEAVY_SQUASH |
| tolerance | 8/22。**egg だけは 14/30**（OD-I5B-3。bismarck / breakfast-pizza と同じ） |
| sauceProfile | tomato-sauce / pesto は PAINT。New Haven の olive-oil は既存 3 件と同じ PAINT_TEMPORARY |
| 依存するもの | Completion Gate の `checkSauceQuantity`、#222 の Q factor（minCount = `positions.length`）、bake target、RESULT の score / ★ |

自動生成してはいけないもの:

- 実行時の座標計算
- fixture の動的生成
- sauce の数値の新規作成

どれも Reference Truth と score の安定性を壊す。既存 15 件の fixture は変更不要。

## 9. CUT mapping

- `CUT_ELIGIBLE_RECIPE_IDS` に 9 件を追加する（6 切れ）。
- New Haven は追加しない。`postBakeSteps` が空になり、runtime はすでにこの経路に対応している。
- 本番で CUT なしの recipe は New Haven が最初なので、e2e での確認が必要。
- `cookingProfiles.test` の「全 recipe が CUT 対象」という前提は書き換える。
- 新しい cut の仕組みは作らない。

## 10. Cooking Steps との整合

10 件とも既存の仕組みで表現できる（`deriveCoreSteps`）。

- puttanesca / pesto-tonno: チーズなしで DOUGH→SAUCE→TOPPING（marinara と同じ）。
- pesto 系: genovese と同じ。
- New Haven: olive-oil を塗り、CUT なし。

late topping などの要件は authority にない。新しい Cooking Step は不要で、blocker ではない。

## 11. Save migration（`resolveShopEntitlement`、25 ladder に切り替えた場合）

| ケース | 切り替えで増える解放 | 失うもの | 進捗ヒント |
|---|---|---|---|
| A 新規 save | なし | なし | step 1 |
| B Margherita だけ | なし | なし | step 2 |
| C Dex 5（旧 ladder で進行中） | eggplant, parmigiano | なし | あと 3 つ発見で step 8 |
| D 15 件すべて発見 | eggplant, corn, pineapple | なし | あと 4 つ発見で step 19（16〜18 は解放済みなので飛ばす） |
| E EP4 save | なし | なし | step 4 |
| F I5a の材料を持つ future save | なし（clam / corn を所持 → OWNED、補充可） | なし | step 3 |
| G 未知 id | なし（保持される） | なし | step 2 |

- deadlock、relock、無料 grant、在庫消失はどれも 0。
- **シミュレーション:** 旧 ladder でランダムに進めたところから 25 recipe に切り替えるプレイを 2,000 通り試し、stuck 0 件、全件が 25/25 に到達した。
- **詰まない理由:** 発見数が N なら、step 1〜N の key recipe（N 件）と Margherita の、合わせて N + 1 件が作れる。したがって未発見の recipe が必ず 1 件は残る。
- ロード時に増えた解放には通知が出ない（Shop の「NEW 入荷」表示のみ）。これは I4b の EP4 migration と同じ扱い。
- Pitz、Lunch Rush の記録、`starterGrantClaimedRecipeIds` は変わらない。schemaVersion は 2 のまま。

## 12. Onboarding

変わらない。starter（tomato-sauce / mozzarella / basil）だけで作れるのは、25 件の中で Margherita だけ。

Dex 0 → Free Cooking → Margherita → step 1（egg）という流れも同じ。

## 13. UI / layout のリスク（390×844 / 360×800）

- **recipe 名の最長が 10 → 12 文字になる（ニューヘイブンアピッツァ）。** 影響する場所:
  - Pizza Select のカード
  - RESULT の見出し
  - Dex
  - 発見済みの注文セリフ（`MITO_REPEAT_ORDER_VARIANTS` は recipe 名を差し込む）
- **Pizza Select の章:** 既定の fallback のままだと、第 3 章 8 件と第 4 章 2 件に分かれる（実装の既定値。owner が変更してもよい）。
- **Shop:** 最大 26 行（スクロール）。
- **tray:** topping は 22 種で、4 ページになる。
- **件数表示:** Home と Inventory は「所持 N/29種」、Home と Dex は「レシピ N/25」になる。どちらも自動で追従する。
- **NEW MATERIAL 通知:**
  - 最大で 2 材料になる（step 11 / 24）。
  - 3 材料の通知は、本番の流れでは出なくなる。既存 e2e の「step 14 で 3 材料」の scenario は差し替える。
  - 3 材料のときの layout は component test で守る。
- **Lunch Rush:** 在庫を見ずに注文を選ぶので、在庫 0 の W1 recipe が注文されることがある。既存の制約で、stock-aware Lunch Rush は範囲外。
  - ruleset の bump は不要（式・gate・時間は変わらない）。Issue #224 は範囲外。

## 14. 自動テストの計画

**Unit:**

- 10 recipe の定義（bake、説明文、9 / 10 / 9 の数）
- 注文が 1 件ずつあること、sauceProfile、discovery id
- ladder が導出結果および fixture と一致すること
- 26 材料の offer 表（tier / 価格 / k / パック、ham は 30）
- entitlement の migration A〜G
- A2: 25 件とも、発見済みなら unlocked
- Lunch Rush の pool = 発見済み ∩ 作れるもの
- fixture の形（最小間隔、半径、生成結果との一致）
- 置けば Pieces が 100 になる回帰
- CUT の allowlist（9 件 + New Haven の POST_BAKE が空）
- save の round-trip
- I5a の catalog-only guard を「activation 後の挙動」の test に置き換える

**Integration:**

- 新規 save からの進行
- 15 → 25 の migration（ケース D から eggplant を買って Melanzane を発見）
- 新 7 材料それぞれの 解放 → 購入 → 補充 → 発見

**E2E（390×844 / 360×800）:**

- progression2 の ladder spec を更新する
- rt01 harness を実物の eggplant に更新する
- New Haven の CUT なしの flow
- 長い名前の layout
- Chromium full と Full WebKit（classifier に従う）

## 15. Human Verification の計画（必須）

新しい材料 7 種と新しい recipe 10 件が、初めてゲームの中で見えるようになる。そのため次を用意する。

- 390×844 の動画（長い名前と通知は 360×800 でも撮る）。動画は repository に commit しない。
- `docs/reports/screenshots/progression2-w1-i5b/` に before / after を置く。

動画のシナリオ案:

1. Dex 15 の migration 済み save
   - eggplant / corn / pineapple が NEW 入荷になっている
   - 値上がりした価格
   - Pizza Select の 25 カードと章
2. step 3 → 4
   - 通知 → Shop → eggplant を買う → Melanzane を発見
   - RESULT の score / ★ → CUT
3. Parmigiana（9）/ Portuguesa（10）/ Puttanesca（9）
   - mini 見本 → popover → 配置 → 焼く → RESULT
4. New Haven
   - olive-oil、clam の SVG、CUT なしで RESULT
5. capers / clam / fresh-tomato の専用 visual
   - tray、生と焼成後の pizza、Shop、RESULT
6. W1 recipe の初回注文セリフ（Pizza Select）と、Lunch Rush の繰り返し注文

## 16. 実装の slice

レシピ追加と ladder 切り替えは 1 コミットにまとめ、その前後を分ける。理由は次の 2 つ。

- 型が結びついている（`Record<RecipeId>` / `Map<RecipeId>`: sauceProfiles、discovery id、fixture）。
- test の不変条件が結びついている（全 RECIPES に fixture がある、ladder が全材料をカバーする）。

| slice | 内容 | 主なファイル | 前提 | rollback の範囲 |
|---|---|---|---|---|
| **I5b-1** | 25 ladder を本番 data の定数として追加（未接続）。導出・fixture との一致と、tier / k / 価格表を pure test で固定 | `src/data/discoveryLadder.ts`（+test）、`materialShop.test` | なし | 本番の挙動は不変 |
| **I5b-2** | 10 件の fixture（MD-01 / RT-01c）を、文字列 key のリテラル data として未接続のまま作る。形の test を付ける | `src/data/w1ReferenceFixtures.ts`（新規）+test | I5b-1 | 本番の挙動は不変 |
| **I5b-3** | 本番への接続（1 コミット）: RECIPES、ORDERS、sauceProfiles、discovery id、`REFERENCE_PIZZAS`、CUT 9 件、`DISCOVERY_LADDER` の切り替え。I5a の guard の置き換え、migration A〜G の test | recipes / orders / recipeSauceProfiles / discoveryCatalog / cookingProfiles / referencePizza / discoveryLadder と、それぞれの test | I5b-1・2、OD-I5B-1 | 1 コミットの revert |
| **I5b-4** | UI: 長い名前と章の確認・修正。3 材料通知の component test | 該当する画面と `App.css` | I5b-3 | UI のみ |
| **I5b-5** | e2e の更新・追加、Chromium 390/360、Full WebKit、before / after、Human 動画 | `e2e/*`、docs | I5b-4 | docs / e2e |

## 17. Owner Decisions

### OD-I5B-3 — RESOLVED（owner、2026-09-25。Pizza Portuguesa の egg tolerance）

Pizza Portuguesa の egg の matching tolerance は **14/30 を維持する**。既存の egg の precedent（Bismarck / Breakfast Pizza）と同じ扱い。

- RT-01 の「standard 8/22」は、「multi-ring 化によって tolerance を変えない」という意味として扱う。egg 固有の 14/30 を上書きするものではない。
- 固定している test: `src/data/w1ReferenceFixtures.test.ts`（「8/22 everywhere except egg」）と、I5b-3 以降の production lookup 経由の test。

### OD-I5B-2 — RESOLVED（owner、2026-09-25）

**新しい 10 recipe には、EP1 の star gate / recipe-chain gate を追加しない。**

- 新 10 recipe に ⭐ の解放条件を付けない。`unlockCondition` もなし。
- W1 の主な進行は **Discovery → Material Unlock → Shop → Free Cooking → New Discovery**。
  - 材料は Progression 2.0 の Discovery Ladder で解放される。
  - 材料は Shop で手に入れる。
  - 必要な材料がそろうと、新しい pizza を発見できるようになる。
- 発見済みの recipe は A2 により常に unlocked。
- 未発見の recipe に新しい star requirement を追加しない。
- EP1 の star chain を W1 の新 10 recipe に延長しない（既存 15 件の EP1 chain は変更しない）。
- 帰結:
  - Pizza Select では、材料を持っていない W1 recipe は既存どおり LOCKED 表示になる。材料がそろうと NEW になる。
  - Lunch Rush の pool は、発見済みかつ作れるもの。

### OD-I5B-1 — RESOLVED（owner、2026-09-25。Mito の注文セリフ）

Mito の注文セリフは、どの authority（#221、35bc937、6fe02e2）にもない。

一方で、注文のない recipe は Pizza Select から開始できない（`startPreparingRecipe` が null を返す）。`recipes.test` も「1 recipe に 1 order」を必須にしている。

そのため owner による文言の承認が必要だった。owner は下の 10 件を **提示どおり承認** した。

**表示される場面（監査の結果）:**

- `lineJa` が表示されるのは、未発見の recipe を注文したとき（Pizza Select の recipe mode）だけ。
- 発見済みの recipe、つまり Lunch Rush の注文はすべて、`MITO_REPEAT_ORDER_VARIANTS` の汎用テンプレートに recipe 名を差し込んだものになる。

したがって、この候補が表示されるのは「材料をそろえた後、初めて作るとき」に限られる。未解放の材料をネタバレする余地は小さい。

**既存 15 件の文体の監査:**

- 24〜47 文字、中央値は 35。
- 全件が recipe 名を直接言う。
- 句読点は全角の「！」「、」「。」「〜」。末尾は「！」か「。」。
- テトに呼びかけるのは Margherita（初回）だけ。

主なパターン:

- **P1 名前 + 食べたい:** margherita
- **P2 特徴 + の気分:** marinara, funghi, pepperoni
- **P3 特徴 + 名前が食べたい + 焼き方などのお願い:** quattro-formaggi, salsiccia, capricciosa, meat-lovers
- **P4 特徴への興味 + 作ってみて:** genovese, bismarck, napoletana, pizza-bianca
- **P5 材料 + 名前、感想 + 食べてみたい:** tonno-e-cipolla, breakfast-pizza
- **P6 入荷の話題:** fugazza

**承認済みの注文セリフ（authority。I5b-3 で `ORDERS` の `lineJa` にこのまま使う）:**

- 説明文（#221 / 35bc937）にある事実だけを使った。
- 量をほのめかす表現（「たっぷり」「強め」など）は避けた。Q factor の関係で、多く置かせるような誘導にならないようにするため。

| recipe id | 表示名 | 提案セリフ | 文字数 | 近いパターン |
|---|---|---|---|---|
| new-haven-apizza | ニューヘイブンアピッツァ | あさりとにんにくのニューヘイブン風ピザが食べたいな！香ばしく焼いてね！ | 35 | P3 |
| hawaiian | ハワイアンピザ | パイナップルがのったハワイアンピザ、甘じょっぱくて気になるな！作ってみて！ | 37 | P4 |
| parmigiana-pizza | パルミジャーナピザ | ナスとパルミジャーノのパルミジャーナピザ、南イタリア風で気になるな！作ってみて！ | 40 | P4 |
| bambino | バンビーノ | ハムとコーンのバンビーノ、やさしい甘さで食べやすそう！食べてみたいな！ | 35 | P5 |
| pizza-portuguesa | ピッツァ・ポルトゲーザ | ブラジル定番のピッツァ・ポルトゲーザが食べたいな！ハムも卵ものせてね！ | 35 | P3 |
| puttanesca-pizza | プッタネスカ | アンチョビとケッパーがきいたプッタネスカ、塩味と香りが強いんだって！作ってみて！ | 40 | P4 |
| pesto-caprese | ペストカプレーゼピザ | ジェノベーゼソースにトマトをのせたペストカプレーゼピザ、さわやかで気になるな！ | 39 | P4 |
| pesto-tonno | ペストトンノピザ | ジェノベーゼソースとツナのペストトンノピザ、さわやかそう！食べてみたいな！ | 37 | P5 |
| pesto-patate | ペストパターテピザ | じゃがいもとベーコンのペストパターテピザ、ほくほくで食べてみたいな！ | 34 | P5 |
| melanzane-pizza | メランザーネピザ | ナスがのったメランザーネピザが食べたいな！バジルの香りもお願いね！ | 33 | P3 |

**取り違えを避けるための配慮:**

- pesto-tonno と tonno-e-cipolla: pesto-tonno 側で「ジェノベーゼ」を明示した。
- parmigiana と melanzane: 「パルミジャーノ」と「バジル」で区別した。
- New Haven: 名前の全文は繰り返さず、説明文にある「ニューヘイブン風」を使った。

長さは 33〜40 文字で、既存の中央値（35）と最大値（47）の範囲に収まる。

- `ORDERS` への接続は I5b-3 で行う。order id は既存の慣例どおり `order-<recipeId>`、`requestedBy: "mito"` とする。
- 文言は上の表から一字一句変えない。

## 18. STOP

Fresh Audit の commit（`cc9dfaa`）の時点では、ここで STOP した。OD-I5B-1 の承認後、owner の指示で I5b-1 から slice 単位の実装を始めた。

- 各 slice の終わりで STOP し、報告する。
- `src/**` / `e2e/**` の変更はない。
- PR は作らない。main へ merge しない。
