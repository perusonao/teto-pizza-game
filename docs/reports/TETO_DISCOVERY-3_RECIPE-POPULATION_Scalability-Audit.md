# Discovery 3.0 — Recipe Population Scalability Audit（25 → 26 → 27 → 28 → 30 → 35、並行監査）

- **日付:** 2026-10-01
- **audited `main`:** `52d14f9ef085b2c3c81e4e11e3f555ecc17a1e57`（Merge PR #327 = Discovery 3.0 PR-4a pool foundation）
- **性格:** 監査 / レポートのみ。**production コードは無変更**（この PR/branch の差分は本ファイル 1 本だけ）。PR は作らない。main へ merge しない。
- **方法:** `origin/main` の使い捨て worktree（repo の外、scratch）に合成レシピを足して段階実測した。どの branch にも commit していない。worktree は破棄済み。
- **分類:** A = MECHANICAL（件数・`N/25`・固定配列・snapshot）/ B = AUTHORING（量・bake・placement・profile・CUT 等 recipe 固有データ）/ C = SEMANTIC（recipe 数や branching で production 挙動そのものが変わる）/ D = FLAKE・INFRA。
- **やらなかったこと:** PR-4b / brazilian-calabresa 作業、#217/#218/#219/#220/#221、#295、旧 Progression PR には触れていない。production の仕様判断（credit 方針・onboarding・sauceless 等）は決めていない。C の項目は「最小再現条件・player 可視の影響・解決の方向候補」だけを書く。

---

## 0. Fresh Gate（記録）

| # | 項目 | 結果 |
|---|---|---|
| 1 | `git fetch origin main` | 完了 |
| 2 | exact main SHA | **`52d14f9ef085b2c3c81e4e11e3f555ecc17a1e57`**（`Merge pull request #327 … discovery3-pr4a-pool-foundation`）|
| 3 | working tree | clean（作業 branch `claude/discovery-recipe-scalability-audit-ao9lfz` は main と同一 SHA から開始）|
| 4 | open PR / branch の重複 | open PR 23 件（#321 #319 #307 #296 #295 #293 #272 #255 #220 #219 #218 #217 #214 #211 #209 #208 #205 #204 #105(draft) #72 #46 #34 #3）に PR-4b / population 監査と同じ題材のものは**無い**。remote branch に `brazilian` / `pr4b` を含むものは**無い**。**重複に近い 1 本を確認:** `claude/discovery3-pr4a-population-parametric`（`8bd7be9`、unmerged、main から 7 commit・40 file、2026-10-01 02:55–04:38 の作業。test を population-parametric にし、hint5-ladder / hint-sheet / save-forward-compat の **e2e seed を pool 対応**にする内容）。本監査の e2e 指摘（§4.4）はこの branch が既に扱っている種類のもの。**この branch は stat を見ただけで、読み込み・変更はしていない。** |
| 5 | production recipe 数 | **25**（`RECIPES` = 25 / ladder 24 step / 材料 29 / `ladderCredit:false` は 0 件）|
| 6 | 主要テスト | 下表 |

**主要テスト（関連 unit / e2e の特定）**

| 領域 | unit | e2e（390×844 Chromium で実行したもの）|
|---|---|---|
| Discovery / matcher / 近似 | `discovery/matcher` `signature` `nearMiss` `attemptFingerprint` `branchingPool`、`state/gameReducer.discovery` `trialNotebook` `resultNearMiss` `oracleNeutralization` `originalResultCopy` | `discovery-near-miss-result` `discovery3-oracle-neutralization` `free-cooking-phase3-2` `original-result-duplicate-notice` |
| Hint | `discovery/hintTarget` `selectableHint` `hint5Ladder(.keyFree)` `hint5Production.gate` `hint5Taxonomy.gate` `deduction*`、`state/discoveryHint(.walk)` `gameReducer.hint*`、sim 2 本 | `discovery-hint-sheet` `discovery-hint5-ladder` `discovery-dex-hint` `discovery-hint-facts-save` |
| Dex / Pizza Select | `components/DexOverlay.*` `state/recipeChapters` `recipeDiscoveryState` `pizzaSelect` `screens/PizzaSelectScreen` | `discovery-dex-hint` `progression2-p3-3-onboarding` |
| Shop / progression | `logic/discoveryLadder(.appendOnly)` `materialShop` `w1LadderEconomy` `w1Reachability` `state/materialEntitlement` `progression` `starterStock` | `progression2-discovery-ladder` `ingredient-shelf-shop` |
| Lunch Rush | `mission/lunchRush` `gameReducer.missionShortage` `lunchRushScoring` | `lunch-rush-material-shortage` `lunch-rush-result-ranking-phase4` |
| Dinner | `mission/dinner/*`（`dinnerMission` `dinnerResultDetection` …）`gameReducer.dinner*` | `dinner-mission` `dinner-settlement-dm4-3` |
| save | `state/persistence.*`（forwardCompat / hintFacts / purchases / ownedOrder / shopEntitlement …）`App.w1Migration` | `save-forward-compat-3-4b` `discovery-hint-facts-save` |

e2e は全 40 spec を回さず、上の 17 spec（67 test）だけを実行した（baseline = 25）。layout は Dex / Hint sheet / Shop を個別に 390×844 で採取した（§4.5）。

---

## 1. 方法

### 1.1 scratch と再現性
- `git worktree add --detach <scratchpad>/wt origin/main`（repo の外）→ `npm ci`。段階ごとに `git checkout -- . && git clean -fdq src` で main に戻してから合成を再注入するため、段階間の汚染はない。
- 注入点（7 箇所 + 1 test 表）: `recipes.ts`（末尾追記）/ `discoveryCatalog.ts`（`RECIPE_DISCOVERY_TARGET_IDS`）/ `recipeSauceProfiles.ts` / `recipeHintRoles.ts`（型を `Record<RecipeId, HintRoles>` に広げ、`{keyFree:true}` を許す）/ `referencePizza.ts`（定数 + `REFERENCE_PIZZAS` 登録）/ `orders.ts` / `cookingProfiles.test.ts` の `RECIPE_STEP_MATRIX`。新材料 1 件のみ `ingredients.ts` に追記。
- 各段階で `tsc -b` → **全 unit（vitest、3 project: default / hand-on-9 / hand-on-12）→ JSON 出力**。失敗は test 単位で分類スクリプトに掛けた（file・test 名・先頭の assertion message で規則分類 → 手で目視確認）。
- baseline（無改造 main）: unit **5506 pass / 1 skipped / 0 fail**（約 3 分 17 秒、288 file）、e2e 17 spec: **66 pass / 1 skipped / 0 fail / flaky 0**（約 2 分 41 秒）。

### 1.2 合成レシピ（既存材料だけ。構造差を意図して入れた）

| 追加順 | id（scratch 内のみ）| 構成 | credit | key topping | cheese | sauce | key step / chapter | 狙い |
|---|---|---|---|---|---|---|---|---|
| 26 | `sx-26-nocredit-keyfree` | tomato-sauce, sausage×2, onion×2, black-olive×2, oregano | **non-credit** | **key-free** | なし | tomato | 12 / 第2章 | PR-4b と同形（portuguesa と pool=2）|
| 27 | `sx-27-pesto-keyed-dup21` | pesto, mozzarella×2, potato×2, ham | credit | あり（potato）| あり | pesto | 21 / 第3章 | **credited 同士が同じ key step**（pesto-patate と同時に DISCOVERABLE）|
| 28 | `sx-28-nosauce` | mozzarella×3, ham, pineapple, corn | credit | あり | あり | **なし** | 10 / 第2章 | sauce なし |
| 29 | `sx-29-starter-only` | tomato-sauce, mozzarella×2 | credit | なし | あり | tomato | **0** / 第1章 | **starter だけで作れる 2 件目**（margherita の部分集合）|
| 30 | `sx-30-ch1-keyed` | tomato-sauce, mozzarella×2, mushroom×2, eggplant | credit | あり | あり | tomato | 4 / 第1章 | 章差（第1章へ追加）|
| 31 | `sx-31-nocredit-keyed` | tomato-sauce, mozzarella×2, pepperoni×2, ham | **non-credit** | あり | あり | tomato | 8 / 第2章 | non-credit かつ key あり |
| 32 | `sx-32-newingredient` | tomato-sauce, mozzarella×2, **sx-artichoke×2（新材料）**, onion | credit | あり | あり | tomato | — | 新材料 + ladder 追加 step |
| 33 | `sx-33-twosauce` | tomato-sauce, **olive-oil**, mozzarella×2, garlic | credit | あり | あり | **2 種** | 14 / 第2章 | sauce が 2 種 |
| 34 | `sx-34-highmin-9pieces` | tomato-sauce, mozzarella×3, **ham×5**, pineapple | credit | あり | あり | tomato | 10 / 第2章 | 既存材料の `minCount` を引き上げ・9 piece |
| 35 | `sx-35-cheese-only` | olive-oil, gorgonzola×2, fontina×2, parmigiano×2 | credit | **なし（topping 無し）**| あり | olive-oil | 24 / 第3章 | 構成の端 |

段階 = 26: +#26 / 27: +#27 / 28: +#28 / 30: +#29,#30 / 35: +#31..#35。

加えて **「clean 35」**（§3.3）: 上のうち安全な構造（#26 #27 #30 #31 #35）に、新規の安全な 5 件（既存材料・sauce 1 種・集合が一意）を足した 35 件。「構造上の地雷を避ければ 35 件はどこまで素直に入るか」の対照。

---

## 2. 結果（25 / 26 / 27 / 28 / 30 / 35）

### 2.1 段階別（unit は全件実行）

| 段階 | typecheck | unit（失敗 / 全 test、失敗 file）| A | B | C | D | 判定 |
|---|---|---|---|---|---|---|---|
| **25**（baseline）| OK | 0 / 5507 | 0 | 0 | 0 | 0 | 全 pass |
| **26** | OK | **45** / 5518（32 file）| 41 | 4 | **0** | 0 | 機械的 pin + authoring のみ。意味的な unit 失敗なし |
| **27** | OK | **61** / 5528（38）| 47 | 4 | **10** | 0 | credited 同士の同 key step で pool>1 の unique-next 前提が割れ始める |
| **28** | OK | **119** / 5539（47）| 50 | 4 | **65** | 0 | sauce なしで TQ-1D の gate 群が発火（44 件）|
| **30** | OK | **286** / 5557（67）| 53 | 4 | **229** | 0 | starter-only の 2 件目で onboarding 系が一斉に割れる（137 件）|
| **35** | OK | **367** / 5607（83）| 87 | 35 | **245** | 0 | 上記 + 新材料 / identity 衝突 / 量の連動 |
| clean 35 | OK | 133 / 5611（43）| 53 | 4 | 76 | 0 | pool>1 の unique-next 系が主（§3.3）|

- 件数は **failing test 数**。分類は file・test 名・message による規則分類で、sub-cause の件数は概数（file 単位の帰属）。段階別の raw 結果（JSON）は scratch に保存していたが repo には載せない（容量とノイズ）。
- 分類の内訳（35）: A 87 =（件数 / `N/25` pin 71 + 材料数 pin 12 + snapshot 4）、B 35 =（新材料の authoring 16 + 量の連動 8 + identity 衝突 5 + CUT / evidence id / key table / profile / reference 各 1〜2）、C 245 =（S1 141 + S2 66 + S3 11 + S4 26 + S7 1）。
- **D = 0。** 失敗 message に timeout / ECONN / ENOSPC 等は 0 件。baseline の再実行は不要だった（baseline が全段階で安定）。e2e も `flaky: 0`（4 回の実行すべて）。infra 上の注意は jsdom の `HTMLCanvasElement.getContext` 警告（既存・無害）のみ。

### 2.2 e2e（390×844 Chromium、17 spec / 67 test）

| 条件 | pass / fail | 内訳 |
|---|---|---|
| 25（baseline）| 66 / 0（1 skipped）| — |
| 26（`N/25` pin だけ spec 側で `/26` に直した）| 63 / **3** | 3 件とも **pool>1 の seed 前提**（C: S2 の test 側表れ）: `discovery-hint-sheet` の COMPLETE、`discovery-hint5-ladder` の marinara（P4-CHEESE）と quattro（P4b）。auto target が key-free の新レシピに移るため。|
| 35（そのまま）| 35 / 31 | 11 件が Dex pill `N/25`（A）。残り 20 件は下 |
| 35（pill だけ直した）| 46 / **20** | C 19（S1 = ORIGINAL 空間 / Dex-0 onboarding 9 件、S2 = pool>1 の target 10 件）+ B 1（`dinner-mission` R7/R8/R13: 「未発見」の hawaiian が合成 34 と identity 衝突 → AMBIGUOUS）|

---

## 3. SEMANTIC（C）の発見 — production は変更していない

各項目に「最小再現 / player 可視の影響 / 解決の方向（候補。**決めていない**）」を書く。

### S1. 2 件目の starter-only レシピが Dex-0 onboarding を壊す（段階 30 で発火、最重要）
- **最小再現:** starter（tomato-sauce / mozzarella / basil）だけで作れる recipe を margherita 以外に 1 件足す。starter は 3 種で margherita はその全部なので、**他の starter-only recipe は必ず margherita の真部分集合になり、`distinctIngredientCount` が小さい側が auto target を取る**（`compareHintCandidates`: key step 0 同点 → 材料数 asc）。
- **player 可視（390×844 で再現・確認済み）:**
  - 新規 save（Dex 0, 0 Pitz）で Free Cooking → 「ヒント」を開くと、**25 件では「✨ はじめてのピザはヒント無料！」（TARGET）／35 件では「ヒント1: ソース ／ たずねる 10 Pitz ／ 所持 0 Pitz — Pitzがたまったら、またためしてね」（SELECTABLE・有料）**。無料 onboarding は `ONBOARDING_RECIPE_ID = "margherita"` かつ Dex 0 に固定（`hintPurchase.ts:45` / `hintSteps.ts:45`）で、auto target が margherita でなくなると外れる。0 Pitz の新規 player はヒントを 1 つも買えない。
  - 新規 save の `availableRecipeIds` / 注文候補が 2 件になり、最初の注文が margherita とは限らない（`gameReducer.test` の order selection、`orders.test`）。
  - onboarding の作法「ソース + モッツァレラ（バジル無し）= ORIGINAL → 3 回失敗でヒントが段階的に開く」が成立しない: その組み合わせ自体が recipe になり **NEW_DISCOVERY** になる（`progression2-p3-3-onboarding` e2e、`trialNotebook` 18 / `resultNearMiss` 19 / `oracleNeutralization` 6 / `duplicateNotice` 15 の unit が同じ原因）。
  - Hint 3.0（rollback 経路）の「無料 key（最後に解禁された材料）」が**存在しない**（`selectableHint` の「every paid target shows its key for free」が `sx-29` で null）。
- **解決の方向（候補）:** (a) Dex 0 の target / 無料 onboarding を auto 選択ではなく明示固定にする、(b) starter-only の追加 recipe は margherita 発見後まで DISCOVERABLE にしない（gate）、(c) starter-only は margherita 1 件に限るという authoring 制約を CI で守る、(d) tie-break を「Dex 0 のときは onboarding recipe 優先」にする。**どれを採るかは Owner 判断。**

### S2. pool>1 の「unique-next」前提（段階 27 から）— auto target と near-miss の相手が変わる
- **最小再現:** 既存の W1 recipe と同じ key step で DISCOVERABLE になる recipe を足す（credit の有無を問わない）。例: `sx-27`（key 21、pesto-patate と同時）→ DISCOVERABLE が 2 件。
- **何が割れるか:** 本番コードは pool を扱える（auto target は `key step asc → 材料数 asc → 宣言順` で決定的、Dex カードの pin は有効）。割れるのは**挙動の前提**: ① hint の自動 target が「次の ladder の key recipe」でなくなる（`hintTarget.test` 52 件、e2e 10 件）、② empty state（SHOP_NEW / REFILL / COMPLETE）に到達する条件が「W1 の 25 件を全部見つけた時」ではなくなる（COMPLETE が 25/25 では出ない）、③ near-miss の「最も近い DISCOVERABLE 候補」が変わる（`nearMiss` T-20 は Dex 1〜24 の各段で ADD_ONE / REMOVE_ONE の期待が割れる。starter-only や 1 材料差の recipe（距離 1 の組が production 3 → 35 件時 11）で顕著）。
- **player 可視:** 同じ手持ちでも hint sheet の対象が key recipe 以外になる。Dex に 🎨（DISCOVERABLE）カードが複数並ぶ（Dex 11 で production 1 枚 → 35 件で **6 枚**、390×844 で確認）。
- **PR-4b との関係:** PR-4a は「non-credit の新 recipe」について pool 契約（pool member を返す・決定的・pin 可能）を固定済み。**credited の新 recipe が同 key step に入った場合は、`W1_RECIPES = RECIPES.filter(countsTowardLadder)`（test support）が「credited = W1」と同一視しているため、W1 walk 系が再び割れる**（`hintTarget.test` の失敗: 27 で 8 件 → 28 で 30 件 → 30 以降 52 件）。
- **解決の方向（候補）:** test support の `W1_RECIPES` を「credit で filter」ではなく**明示の 25 id**にする。本番側は現行の pool 契約を仕様として文書化（auto target の優先順位に「ladder を進める recipe 優先」を入れるかは Owner 判断。入れない場合は「non-credit が先に提示される」現行を仕様として確認）。

### S3. credited の追加は ladder を「先行」させる（lead）
- **最小再現:** 材料が既にそろっている credited recipe を足す。**lead = credited 件数 − ladder step 数（24）**。production は 1（margherita が step を持たない分）。実測（全 recipe を発見した walk）: 25→**1** / 26→**1**（non-credit なので増えない）/ 27→**2** / 28→**3** / 30→**5** / 35→**9**（実測 8 は `sx-32` が未到達で 1 件欠けたため）。
- **player 可視:** 材料が recipe より先に解禁される（その step の key recipe を発見する前に step が進む）。ladder は 24 件で終わり、25 件目以降の発見は材料を何も解禁しない。Shop の進捗行（「あと N つ発見で新しい材料が入荷」）は count 24 で消える（25 件 / 35 件のどちらでも、Dex 24 の時点で行が出ないことを確認）。`discoveryHint.walk` の「各 step で Shop 訪問」不変条件は、新材料を要さない credited recipe の発見で成立しなくなる。
- **W1 は「ゼロ余裕の一本道」:** production ladder は**全 24 step で「その step 直前に作れる recipe 数 = step 番号」**（余裕 0、実測）。`validateLadderProgression` の SOFTLOCK 検査は **credit を見ない**（non-credit も作れる recipe として数える）ため、余裕 0 の W1 に non-credit を混ぜる設計変更をすると、検査は通るのに実際は詰む構成を見逃しうる。
- **解決の方向（候補）:** (a) 以降の recipe は non-credit を原則にする、(b) credited にするなら `POST_W1_APPENDED_STEPS` で step を追加して lead を相殺する、(c) lead を許容して copy を調整する。(d) `validateLadderProgression` を credit-aware にする。**方針は Owner 判断（OD-D3-17 O3 の延長）。**

### S4. sauce なし / sauce 2 種 は TQ-1D の gate（段階 28 から）
- **最小再現:** sauce-category の材料を含まない recipe（28）／ sauce を 2 種含む recipe（33）。
- **挙動:** sauce なし → Hint 5.0 の SAUCE rung が `RESERVED_EMPTY_RUNG`（0 Pitz）、**production の文脈で Technique `no-sauce` が ledger に記録される**（INV-TQ-4 の破れ）、Technique affordance が step 10 で開く、Completion Gate / Reference / `RECIPE_SAUCE_PROFILES`（型が sauce 1 種を強制）の前提が崩れる。sauce 2 種 → `Reference.sauce` が 1 材料しか持てず、**理想の pizza を Completion Gate が FAILED と判定**（`completionGate` の「all recipes PASS for an ideal pizza」、`partialQuantity`）。
- **これは既知の gate:** `hint5Production.gate` の G7（「production recipe は単一 sauce・技術不要。違うなら OD-H5-P4 を先に決める」）と `deductionProduction.gate` が**意図的に tripwire**になっている。隠れた前提ではなく、設計済みの「通行止め」。
- **解決の方向:** TQ-1D / OD-H5-P4-SAUCE を決めるまで sauce なし・2 種の recipe は入れない（W1 追加分の制約として明文化）。

### S7（小）. 既に完了した章が未完了に戻る
- 第1章に recipe を足すと、既に「6/6 ✓」だった player の章が「6/8」になる（390×844 の Dex で確認、`DexOverlay.discovery` の「complete chapter is checked」）。同様に **Dex 25/25 の完了済み player は 25/35 になり、hint sheet は「🏆 図鑑コンプリート！」から target 提示に戻る**（e2e で確認）。PR-4b でも 25/25 → 25/26 で同じことが起きる。**仕様として許容か、HV で確認する項目。**

> **S5 / S6 は挙動というより authoring 制約なので §4 の B に置いた**（identity 衝突・pack size の連動。件数は B に計上）。

---

## 4. 隠れた前提（hidden assumptions）の一覧と、領域別の監査結果

### 4.1 重点領域別（依頼リスト）

| 領域 | 結果 |
|---|---|
| **hard-coded 25** | production（非 test）のロジックには**無い**。`DexOverlay` は `RECIPES.length`。残るのは data 側の名前 `populationId: "w1-25"`（ladder・Dinner mission 2 件）と tier 境界（T3 = step 15〜29）だけ。**25 / 24 / 6-9-10 の pin はすべて test 側**（約 45 file）。|
| **ladder 完了条件** | ladder は step 24 で終わる。recipe 数とは無関係（credited が 24 を超えても何も起きない）。Shop 進捗行は count 24 で消える。**ladder 完了 = 全 recipe 発見ではない**。新材料を持つ recipe は `POST_W1_APPENDED_STEPS` で step を足さないと永久に UNKNOWN（§4.2 H9）。|
| **chapter counts** | 章 = 「key step が属する価格 tier」で**自動導出**（OD-DISC-9）。35 件で 8/15/12（clean 35 は 7/13/15）。第4章は **step 30 以上の材料が必要**（新材料 6 件を append して初めて発生。T4 の価格・章 4 の導出自体は `recipeChapter` / `materialOffer` で確認済み）。UI は `buildRecipeChapters()` の map で章数に依存せず、390×844 で第1〜3章のまま横 overflow なし（`scrollWidth 390`、Dex 本体は内部 scroll）。|
| **unique-next 前提** | **test 側に強く焼き込まれている**（§3 S2）。本番コードは pool を扱える。|
| **auto-target 選択** | 決定的（key step → 材料数 → 宣言順）。population に敏感（S1 / S2）。Dex 0 の無料 onboarding だけが margherita 固定。|
| **pool>1** | 27 で 2、28 で 3、30 で 5〜6、35 で最大 8〜10（walk の方針による）。**詰み（softlock）は credited の範囲では 0 件**（credit-aware 余裕は常に ≥ 0）。35 で未完になった 1 件は新材料の未到達（S/B: 下）。|
| **Dex の ？？？ カード** | **leak 無し**: 全 ladder Dex・arrived/bought で、未発見 recipe の名前・説明・材料 glyph が DOM に出ない（count pin を外した `DexOverlay.discovery` の privacy test が 35 件でも pass）。🎨 カードの数は増える（上記）。|
| **Hint rung 生成** | key-free（26・clean 35）は PR-3 の契約どおり動く（SAUCE → STRUCTURE → SUB…、空 rung なし）。keyed + topping 無し（35 の cheese-only）・key null（29 / 35）も rung 生成は成立。sauce なしだけが gate（S4）。|
| **credited / non-credit の分岐** | S3。non-credit は Dex 件数だけ増えて ladder は進まない。auto target で non-credit が先に出る（PR-4a で仕様化済み）。|
| **Shop progression** | entitlement は union で縮まない（append-only で保存と互換）。`materialK`（pack size）は**全 recipe の最大 `minCount`**（H8）。|
| **Lunch Rush 候補 pool** | 「発見済み ∩ 所持 ∩ 解禁」を `RECIPES` 順に導出。**新 recipe は（unlockCondition なしなら）発見した瞬間から自動で候補に入る**。non-credit も同じ。recipe ごとの除外・重みづけは無い。ranking の式（`servedCount×100 + 品質`）は recipe 非依存で、サーバ側にも recipe の許可リストは**無い**（`recipeId` は任意の非空 string）。|
| **Dinner の target 選択** | **自動選択は無い**（mission は target id を明示する定義: dm-a / dm-b）。recipe 数が増えても mission は不変。影響は ① matcher の identity 衝突（AMBIGUOUS）② ORIGINAL 空間の fixture のみ。`dinnerMission.test` は 35 件でも pass。|
| **save 互換** | population 依存の永続フィールドは**無い**（Dex / 在庫 / 台帳は id キー、未知 id は forward-compat で保持）。`persistence.*` と `App.w1Migration` は全段階で pass。25 件で作った save を 35 件の build に読み込んで Dex 25/35・各画面とも正常（e2e 確認）。**注意:** 未知 id を「将来の id」fixture に使うと、その id が実在した瞬間に fixture が意味を変える（PR-4a が `brazilian-calabresa` で既に踏んだ）。|

### 4.2 新しく見つかった hidden assumption

| # | 前提 | 壊れる条件 | 区分 |
|---|---|---|---|
| H1 | **Dex 0 の onboarding = margherita 固定**（`ONBOARDING_RECIPE_ID`、free hint、最初の注文、ORIGINAL の砂場）| starter-only recipe の 2 件目 | C: S1 |
| H2 | **W1 は「ゼロ余裕の一本道」**（全 24 step で作れる recipe 数 = step 番号）。pool>1 が本番で起きなかったのは REC-04 の導出結果にすぎない | 材料が既にそろった recipe の追加（credit を問わず）| C: S2 / S3 |
| H3 | **`validateLadderProgression` は credit を見ない**（non-credit も進捗に数える）| 余裕 0 の W1 に non-credit 依存の設計 | C: S3 |
| H4 | test support の **`W1_RECIPES` は credit で filter**（= W1 と同一視）| 最初の credited な非 W1 recipe | C: S2 |
| H5 | **recipe の同一性 = 材料の集合（+ sauceBase）。量は無視** | 量だけ違う recipe（hawaiian と `sx-34` が同じ集合 → **AMBIGUOUS**、Dinner の「未発見の hawaiian」が ORIGINAL にならない）。防ぐのは test（`originalResultCopy` の canary / `w1Activation`）だけ。`identityDimensions` の拡張（量・技法）が将来必要 | B: S5 |
| H6 | **pack size k = その材料を使う全 recipe の最大 `minCount`**（`materialK`）| 既存材料の `minCount` を引き上げる recipe（ham 3→5 で pack が 30→50、価格据え置き）。**既存 player の Shop 経済が全員いっせいに動く**。逆に k が減る変更は発見済み recipe の調理可否に効く | B: S6（経済は C 相当）|
| H7 | **ORDERS / `REFERENCE_PIZZAS` 登録 / `CUT_ELIGIBLE_RECIPE_IDS` は型で強制されない** | 追加を忘れても `tsc -b` は通る（実験で確認: ORDERS と Reference 登録を外しても exit 0）。検出するのは「25 件に pin された」`w1Activation` 等だけ。**pin を派生に弱めると、この漏れが無音になる** | B |
| H8 | `RECIPE_DISCOVERY_TARGET_IDS`（型強制）は **Phase-2 JSON に同 targetId の行**が無いと `discoveryCatalog.test` が落ちる（外部 data への依存）。calabresa には行が**ある**（`brazilian-calabresa-pizzadb-p10`）| JSON に無い recipe | B |
| H9 | **新材料は ladder に step を足さない限り永久に UNKNOWN**。さらに `recipeKeyStep` は ladder に無い材料を**無視**（fail-open）して章を決める（実測: 追加前は第2章、step 25 を足すと第3章）。到達不能時の hint empty state は「SHOP_NEW」のまま行き止まり（`emptyKind` の注記「not expected」）。**防ぐのは CI の `UNREACHABLE` 検査だけ**。新材料にはさらに shelf・taxonomy family 行・材料数 pin・価格表が要る（失敗 message が一覧になる）| 新材料を持つ recipe | B（新材料 16 件）|
| H10 | **recipe の宣言順が authority**（hint の最終 tie-break、Dex の章内 No.）| 途中への挿入（既存の No. が動く）。**末尾追加なら不変** | 注意 |
| H11 | `sauceBase.length > 0`（全 target は sauce を持つ）、Reference.sauce は 1 材料、`RecipeSauceProfile` は 1 材料 | S4 | C: S4 |
| H12 | **count pin が「最初の失敗」で後続の assertion を隠す**。pin を外すと 27 件が緑に戻り、その下に「sauce 2 種の理想 pizza が FAILED」「Dex 5 章に割れる legacy section」等が現れた | pin を更新する時に後続を読まずに数字だけ直す | 運用 |
| H13 | **pin の更新が 1 recipe ごとに繰り返される**（26 件目で 32 file、35 件目で 83 file が赤）| W1 約 10 件の連続追加 | 運用 |
| H14 | Lunch Rush は**全 recipe 同重み**で、新 recipe は ORDERS さえあれば自動参加（難易度・bake 窓の校正が未了でも入る）| authoring が未確定の recipe の先行追加 | C 相当（要判断）|

---

## 5. 判定（依頼の報告項目）

### 5.1 35 件に増やすうえでの blocker
production の**コードに変更を要する blocker は無い**（clean 35 が typecheck を通り、残る失敗は pin / authoring / pool の前提だけ）。ただし次の**入れ方の制約**が blocker になる:
1. **sauce なし / sauce 2 種の recipe**（TQ-1D・OD-H5-P4-SAUCE が決まるまで不可）。
2. **starter-only の 2 件目**（onboarding 契約が決まるまで不可。S1）。
3. **新材料を持つ recipe**（`POST_W1_APPENDED_STEPS` + shelf + taxonomy 行 + 価格・件数 pin が 1 セット）。
4. **集合が既存と同じ recipe**（identity 衝突。量だけの違いは不可）。
5. **既存材料の `minCount` 引き上げ**（Shop の pack 経済が動く）。
6. **credit 方針**（non-credit か、credited + step 追加か、lead 許容か。S3）。
7. 運用面: 1 recipe あたりの pin 更新（約 30 file）。

### 5.2 PR-4b の前に直す必要があるもの
**production 側: 無し。** PR-4b の形（non-credit・key-free・既存材料・sauce あり cheese なし・key step 12・非 starter）は、段階 26 で **A 41 / B 4 / C 0 / D 0**（unit）と e2e 3 件（pool seed）に収まる。前提を崩さないよう、**次の条件を PR-4b の受け入れ条件として確認すること**: starter-only でない／sauce が 1 種／既存の recipe と集合が一致しない／既存材料の `minCount` を最大値以下にする（k を変えない）／`ORDERS`・`REFERENCE_PIZZAS`・Phase-2 evidence の 3 点が揃っている（型は強制しない）。
**e2e の pool 対応 seed 3 件**（discovery-hint-sheet の COMPLETE、discovery-hint5-ladder の marinara / quattro）は PR-4b 側で更新が要る。未 merge の `claude/discovery3-pr4a-population-parametric` が同種を扱っているので**二重にやらない**よう確認が要る（本監査は触れていない）。

### 5.3 PR-4b の後でよいもの
- test の **pin を派生へ置換**（`RECIPES.length` / credited id 集合 / 章は `buildRecipeChapters` から導出）し、**「全 recipe が ORDERS・Reference・profile・hint roles・CUT 判断を持つ」完全性 test は RECIPES 由来のまま残す**（H7・H12）。
- `W1_RECIPES` を明示 25 id にする（H4）。`validateLadderProgression` を credit-aware にする（H3）。
- Dex 0 onboarding の契約を明文化する（S1）。完了済み save が戻る仕様の確認（S7）。
- identity の量・技法 dimension（H5）、`materialK` の連動を文書化（H6）。

### 5.4 W1 約 10 recipe を連続実装できる状態か
**まだ「連続して安全に」は入れられない（条件付き）。**
- 構造の制約（§5.1 の 1〜5）を満たす 10 件なら、production コードの変更なしで入る（clean 35 = 1 回で 10 件追加し typecheck OK、残りは pin / authoring / pool 前提のみ）。
- ただし **1 件ごとに約 30 file の pin 更新**が要り、**credit 方針（S3）が未決**で、credited を入れるたびに `hintTarget` 等の unique-next 前提が割れる（clean 35 で 133 失敗のうち 76 が C）。pin の派生化（5.3）と credit 方針の決定が先。

### 5.5 推奨する次の Gate
**Discovery 3.0 — Population Scalability Gate（PR-4b merge 後）**: ① 「test の population 化」（pin → 派生、`W1_RECIPES` の明示化、完全性 test は残す）を test のみの PR として独立させる、② Owner Decision を 3 点だけ先に取る: **(OD-S1)** Dex 0 onboarding の契約（starter-only の追加を許すか／許すなら target をどう固定するか）、**(OD-S3)** 以降の recipe の credit 方針（non-credit 原則 / credited + 追加 step / lead 許容）、**(OD-S4)** sauce なし・2 種の扱い（TQ-1D 前に入れない、で確定でよいか）。③ その後に W1 追加バッチ（1 バッチ = 1 PR、構造制約をバッチの受け入れ条件に）。PR-4b の HV には S7（Dex 25/25 の完了済み save が 25/26 に戻る）と pool=2 の hint sheet / 🎨 カードを入れる。

---

## 6. 限界
- 合成レシピの量・bake・placement は**仮値**（production authority ではない）。B（authoring）の失敗は合成の作りに由来するものを含む（例: reference の `LIGHT_LEAF`、CUT 未登録）。C の判定に使ったのは、それらと独立に説明できるもの（pool / onboarding / sauce / credit）に限った。
- unit の分類は規則 + 目視の概数。件数の絶対値より「段階ごとに何が増えたか」を読むこと。
- e2e は関連 17 spec（67 test）のみ。残り約 23 spec は未実行（静的調査: Dex pill の `N/25` は 7 spec で pin）。WebKit は未実行（CI が authority）。
- 合成の新材料は 1 件（`sx-artichoke`）のみ。T4（step 30 以上）の章 4 は、ladder を差し替えた関数呼び出しで導出を確認しただけで、UI の第4章表示は未確認。
- 「全 recipe を発見する walk」は pure な導出関数で行い、reducer 全経路ではない（PR-4a の `branchingPool` と sim が reducer 経路を持つ）。
- scratch は main `52d14f9` 上。PR-4b / 次の追加の開始時に再測定すること。
