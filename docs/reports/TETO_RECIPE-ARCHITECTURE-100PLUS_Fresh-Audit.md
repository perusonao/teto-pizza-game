# Recipe Architecture 100+ — Fresh Audit（Recipe Identity / Completion / Cooking Step Engine / Original Pizza / My Recipe）

- 作成: 2026-09-24
- 種別: **監査・設計のみ（docs-only）**。production code、PR #218 / #220 / #221、他の保護対象 PR は変更していない。merge していない。新しい Issue / PR は作っていない。
- 監査基準: `main` = `dff233c042d2df6ee1c3a92f2d2419830aa05460`（GitHub から取得して確認）
- Human Verification: docs-only なので不要（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` §2「docs-only の変更」）。
- Owner Decision はどれも**確定扱いにしていない**。本書の「推奨」は候補で、決定ではない。

---

## 0. GitHub の実状態（2026-09-24 に取得）

| 対象 | 状態 | 確認した内容 |
|---|---|---|
| `main` | `dff233c` | 最後の merge は #210（Dev CI Phase 2A）。#202 以降、recipe 系の merge はない |
| PR #218（Completion Gate partial-quantity Fresh Audit） | OPEN、HEAD `5105771d37577ad353e869ea35295a4ea18bbce9` | **前回 PASS した HEAD から動いていない**。Decision Sheet の OD-1〜OD-5 は `OWNER_REQUIRED` のまま |
| PR #220（Content Readiness / Implementation Wave） | OPEN、HEAD `e49dab96bd9b26dc0f520349cf09d1160c3519f5` | **前回 PASS した HEAD から動いていない**。W1 = 10 recipes / 新 ingredient 7 種 |
| PR #221（W1 content authoring） | OPEN、HEAD `279b6b17188ed3572b27c1ba91b2c4983723ddc0` | 最後のコメントは 10:37Z の re-review 依頼。Codex は usage limit で未 review |
| PR #217（Issue #216 paid unlock Fresh Design） | OPEN、`a39932d` | capability の unlock policy（OD216-3: A_PAID / B_AUTO / C_TUTORIAL）が `OWNER_REQUIRED` |
| PR #206（save forward-compat, 3-4B） | OPEN、`edfca8b`、clean | 未 merge。My Recipe の保存の前提になる（§14） |
| PR #205 / #211 / #213 / #214 | OPEN | Progression 2.0 の 3-4A / 3-4C / 3-4F。未 merge |
| Issue #182 | OPEN | 172 recipes、Free Cooking による発見、mechanic 依存、実装の PR 分割の親 Issue |
| Issue #215 | OPEN | Completion Gate の少ない量（#218 の親） |
| Issue #216 / #212 / #176 | OPEN | 有料 unlock + 新工程の解放 / Lunch Rush の在庫 pool / Scoring 3.0 |

**OD-4b（Lunch Rush でも過剰の罰を品質点へ適用する案）について:** #218 の HEAD `5105771` の Decision Sheet（§13）には **OD-4b という項目はない**。§7.4 の LR-A〜LR-E にも、過剰の罰を Lunch Rush に適用する案はない。本書では「未登録の候補」として扱い、§19 で owner が登録するかどうかを決める項目に入れた。

---

## 1. Executive Summary

1. **Recipe Identity の骨組みは main に既にある。** `src/logic/discovery/signature.ts` + `matcher.ts` は、ingredient set（base sauce を含む）+ 11 の identity dimensions + capabilities で判定する。完全一致だけを見て、材料だけで判定するフォールバックはない。数量は identity に入れていない（`ingredientCounts` は "Not identity"）。Free Cooking の `ORIGINAL`（Original Pizza）も既にある。つまり、**「数量不足だから別 recipe になる」は今のコードでは起きない。** 起きているのは「数量不足だから `INCOMPLETE_MATCH` になり、Original として表示される」で、原因は Completion Gate（#218 の範囲）。
2. **Cooking Step のデータ駆動の土台も main に既にある。** `CookingProfile.steps`（`src/data/cookingProfiles.ts`）、`POST_BAKE` phase、order に依存しない `nextStepWithin`、9 値の `MakingStep`（FOLD / SEAL / EDGE_FILL / FINISH は予約済みで、まだ実装がない）、そして実際に動いている CUT。**`Recipe.cookingSteps` を新しく作る必要はない。** 足りないのは次の 3 つ。
   - **(a) 工程の観測:** `PizzaState` に「いつ・どの工程で置いたか」の記録がない。
   - **(b) dimension ごとの比較の方針:** 今は 11 の dimension をすべて厳密に比較する。dimension を 1 つでも観測するようにすると、既存の 15 recipe がその default 値を要求してしまう（§5.3）。
   - **(c) Free Cooking で任意の工程を選ぶ UI:** Free Cooking は `DEFAULT_COOKING_PROFILE` の固定 4 工程で、BAKE の後の工程がない。
3. **今の構成のまま 100+ recipes にするのは CONDITIONAL。** scratch で main に recipe を 1 件（新 ingredient 0）足すと、次のようになった。
   - 型エラー: 3 件（production 2 件: `recipeSauceProfiles.ts` / `discoveryCatalog.ts`、test 1 件: `cookingProfiles.test.ts`）
   - それを埋めた後: **16 test files / 21 tests が失敗**
   - 登録が要る場所: 手作業で 6 系統（recipes / recipeSauceProfiles / discoveryCatalog / referencePizza / orders / cookingProfiles の CUT allowlist）と、「15」を固定した test が 13 ファイル。
   - **最大のリスクは Reference Pizza。** Reference がない recipe は、runtime では**エラーにならずに 0 点・★1** になる。test だけが防いでいる。
4. **sauce を使わない recipe は、今の Scoring V2 では高い ★ に届かない。** sauce の重みは 52/100。`ReferenceSauce` は必須で、`RecipeSauceProfile.ingredientId` は 3 値の closed union（sauce profile がないと型エラーにもなる）。
   - #220 はこれを `SAUCELESS_RECIPE_CONTRACT`（W4）に分類している。
   - **#221 の 10 件のうち 5 件（aussie / bacalhau / full-english / polish-kielbasa / tsukimi）は、#220 では W4 の sauce なし recipe。** #221 は Aussie を READY / slice A にしている。
   - #221 は「#220 の first-10 を再監査した」と書いているが、**今の HEAD 同士では、W1 の集合は 10 件中 5 件しか重ならない**（Portuguesa / Pesto Tonno / Puttanesca / Parmigiana / Melanzane）。
5. **Pizza Portuguesa は具の数が 10 個で、今の 8 スロットの ring（`PIECE_RING_POSITIONS`）を超える。** Player Reference と Pizza Select のサムネイルで、駒が重なって表示される。今の最大は 8 個。
6. **Collision:** 172 行のうち ingredient set が完全な 120 行で、**同じ ingredient set の組が 5 組、真部分集合の組が 89 組**ある。材料だけの identity は成り立たない（#189 の collision ledger でも、区別できるのは STEP_ORDER / DOUGH_VARIANT の後）。
   - 推奨: **ingredient set は完全一致（B）+ 工程の dimension は specificity（A）+ STRICT / LENIENT の 2 つの dimension class + 決まらなければ Original**（D）。
7. **Reference Pizza:** 15 件、手書きで 643 行（平均 43 行/件）。駒の座標以外はほぼ ingredient で決まる。
   - landingStyle は ingredient ごとに 100% 一定。tolerance は 40 group 中 38 が 8/22。
   - 推奨: **D（procedural generation + recipe override）**。既存の 15 件は override として byte 単位でそのまま残せるので、Scoring V2 は変わらない。
8. **最初の mechanic の Vertical Slice 推奨: STEP_ORDER × トレントン・トマトパイ**（`trenton-tomato-pie-pizzadb`）。理由は §9.2。
   - 新 ingredient 0、新しい gesture 0、Save の変更 0、Scoring の式の変更 0、Lunch Rush の変更 0。
   - Starter の 3 材料で作れる。#217 の C_TUTORIAL の想定と一致する。
   - 「同じ材料でも、工程で別の recipe になる」を最小の構成で証明できる。
   - 再利用できる recipe 数が一番多いのは LATE_ADDITION（12 行、単独で 9 行）。ただし、新 ingredient 0 で作れる行がなく、多くの行で sauce ID の拡張も要る。**2 番目の mechanic として推奨する。**
9. **W1 Slice 1（Portuguesa / Pesto Tonno）は「今の構成の延長」として実装する方がよい。** 新しい構成の最初の Vertical Slice にはしない。どちらの recipe も工程の mechanic を使わない。ただし、Portuguesa には §5 の問題（ring を超える）と、Bismarck ⊂ Portuguesa の二重の登録（§10.4）がある。

---

## 2. Current Recipe Architecture（main `dff233c`）

### 2.1 データ（authoring 層）

| 系統 | ファイル | 形 | recipe を追加したときに漏れると |
|---|---|---|---|
| Recipe の本体 | `src/data/recipes.ts` | `RECIPES as const` → `RecipeId` をここから作る | — |
| Ingredient | `src/data/ingredients.ts` | `INGREDIENTS[]`（category: sauce / cheese / topping、placement: spread / scatter） | 新 ingredient のときだけ |
| Sauce の interaction | `src/data/recipeSauceProfiles.ts` | `Readonly<Record<RecipeId, …>>`、`ingredientId` は `"tomato-sauce" \| "pesto" \| "olive-oil"` | **型エラー**（漏れない） |
| Discovery の target ID | `src/data/discoveryCatalog.ts` | `Readonly<Record<RecipeId, string>>`。catalog は `RECIPES` から作る | **型エラー** |
| Reference Pizza | `src/data/referencePizza.ts` | `ReadonlyMap<RecipeId, ReferencePizza>`。sauce は共通の fixture から機械的に作り、駒の座標は手書き | runtime では **0 点・★1 になるだけでエラーにならない**。test（coverage）で検出 |
| 注文 | `src/data/orders.ts` | `ORDERS[]`（1 recipe = 1 order、`lineJa` は手書き） | test（id の整合）で検出。`findOrderForRecipe` が undefined |
| Cooking Profile | `src/data/cookingProfiles.ts` | `deriveCoreSteps`（category から自動で作る）+ `CUT_ELIGIBLE_RECIPE_IDS`（opt-in の Set）+ `COOKING_PROFILE_OVERRIDES`（空の Map） | CUT が**付かないだけでエラーにならない**。test で検出 |
| Hint | `src/data/hints.ts` | `RECIPE_HINTS: Record<string, …>`（なくてもよい） | 汎用の文言になる（問題なし） |
| Player Reference / サムネイル | `src/data/playerReference.ts` / `src/logic/pizzaReferenceLayout.ts` | `minCount` から 8 スロットの ring に並べる | 具が 9 個以上だと、座標が重なる |
| 自動で作る値 | `starterStock.ts`（`minCount × 10`）、`efficiency.ts`（`25s + 3s × Σ minCount`）、`pizzaSelect.ts`（章を index で分ける）、`FREE_COOK_BAKE_TARGET`（全 recipe の median） | recipe から自動で計算 | 値が静かに変わる（例: median） |

### 2.2 実行時（runtime 層）

- **状態:** `GameState.phase` = `ORDER → PREPARE → BAKE → [POST_BAKE] → RESULT → DISCOVERED`。
- **PREPARE の中:** `makingStep` が `preBakeSteps(cookingProfile)` を一方向に進む。
- **POST_BAKE:** CUT がある recipe のときだけ入る（今は 15 件すべて）。
- **`PizzaState`:** `doughShape`、`sauceIds`（**1 種類だけ**。新しい sauce は前のものを置き換える）、`sauceDeposits`、`toppings[{id, ingredientId, x, y}]`、`bakeResult`。**いつ・どの工程で置いたかは記録していない。**

---

## 3. Dependency Map（Recipe 1 件の経路）

```
[登録]  recipes.ts ──┬─ recipeSauceProfiles.ts (Record・型で強制)
                     ├─ discoveryCatalog.ts   (Record・型で強制) ──> RECIPE_DISCOVERY_CATALOG
                     ├─ referencePizza.ts     (Map・test のみ)
                     ├─ orders.ts             (配列・test のみ)
                     ├─ cookingProfiles.ts    (CUT allowlist・test のみ)
                     └─ (自動) starterStock / efficiency / pizzaSelect の章 / FREE_COOK_BAKE_TARGET / playerReference
[選択]  progression.isRecipeAvailable (unlockCondition AND 材料を所有) → pizzaSelect → PizzaSelectScreen
        → SELECT_RECIPE → buildOrderState: getCookingProfile / findOrderForRecipe / createCutState
[調理]  gameReducer: COMMIT_DOUGH_STRETCH / COMMIT_SAUCE_DISPENSE (recipeSauceProfile) /
        PLACE_TOPPING (category × makingStep の gate、inventory.canPlaceIngredient) / CONFIRM_MAKING_STEP
        表示: GameScreen … referencePizza ?? getPlayerReferencePizza(recipe)、hints
[判定]  CONFIRM_BAKE → completionGate.evaluatePizzaCompletion(recipe)
          (requiredIngredients.minCount / referencePizza.sauce / bakeTarget)
        Free Cooking: discovery/freeCook.resolveFreeCookPizza
          (汎用の完成判定 → matcher → その recipe の Completion Gate)
[発見]  signatureOfPizza → matchDiscovery(RECIPE_DISCOVERY_CATALOG) → evaluateDiscovery
        recipe mode の別 recipe の発見: discoveryRegistration.registerDiscoveryToDex
[採点]  scoringV2.computeScoringV2 (referencePizza が必須。sauce 52 / pieces 16 / recipe 12 / bake 20)
        → toLegacyScoreBreakdown → ★ / pitzReward(baseRewardPitz) / efficiency
[Dex]   dex.registerScoreToDex → DexOverlay (RECIPES.map) / mastery.totalStars / starterStock
[Lunch Rush]  lunchRush.pickMissionOrder (作れる ∩ 発見済み) → orders
              → SERVE (Completion Gate) → missionScoring (served×100+Σquality)
              → shared/lunchRushScoring (recipeId は任意の文字列) → functions/submitLunchRushScore
[Save]  persistence: dex[] (isKnownRecipeId) / starterGrantClaimedRecipeIds / missionBest / inventory
        (#206 が merge されるまで、知らない id と知らない top-level key は書き込みのときに消える)
```

**前回の scratch 検証（6 系統）を最新の main で再確認した:** 同じ 6 系統に影響がある。今回の scratch の手順は次のとおり（production には入れていない。scratch の worktree は削除済み）。

1. `pesto-tonno`（新 ingredient 0）を `RECIPES` に追加 → `tsc -b` で 3 件の型エラー。
2. production の 2 つの Record を埋める → `vitest run` で **21 failed / 2398 passed（16 files）**。

失敗した test の内訳:

- **coverage 系:** referencePizza の 7/7 coverage、playerReference の scope guard、order の id の整合、CUT の allowlist の網羅、sauce profile の網羅
- **件数を固定した test:** `toHaveLength(15)` など
- **振る舞いの test:** 章を 7/8 に分ける、economySimulation の 15 recipe の chain、efficiency の閾値、progression の新規 save、discovery の 12 番、App / Dex の表示

---

## 4. Current limitations（100+ にするときに効くもの）

| # | 制約 | 根拠 | 影響 |
|---|---|---|---|
| L1 | Reference がないと runtime では 0 点・★1 になり、エラーにならない | `scoringV2/index.ts`（`available:false` → `toLegacyScoreBreakdown` の total = 0） | 100+ の手作業で 1 件漏れると、本番で気づけない（今は test だけが防いでいる） |
| L2 | sauce なしの recipe を作れない | `ReferenceSauce` が必須、sauce の重み 52、`RecipeSauceProfile.ingredientId` が closed union | 172 行のうち `sauceBase.status=none` の行（#220 の `SAUCELESS_RECIPE_CONTRACT`）、#221 の 5 件 |
| L3 | sauce は 1 種類だけ | `PizzaState.sauceIds`、`spreadLayers` は FIXED_BY_FLOW | MULTI_SPREAD_LAYER（17 行） |
| L4 | 工程の観測がない | `PizzaState` に stage / step の記録がない | identity の dimension を OBSERVED にできない |
| L5 | dimension をすべて厳密に比較する | `matcher.compareDimensions` | dimension を 1 つ観測しただけで、既存の 15 recipe が default 値を要求するようになる（§5.3） |
| L6 | Free Cooking の工程が固定 | `getCookingProfile("free-cook")` → `DEFAULT_COOKING_PROFILE`（CUT なし、POST_BAKE なし） | 工程で identity が決まる recipe を、Free Cooking で発見できない |
| L7 | 8 スロットの ring | `PIECE_RING_POSITIONS`（8 点）、`playerReference.ts` は `slot % 8` | 具が 9 個以上の recipe（Portuguesa = 10）で座標が重なる |
| L8 | 「15」の固定 | 13 ファイル（unit と e2e の `/15`） | 追加のたびに test が変わる |
| L9 | recipe mode で 2 つの recipe に登録される | `REGISTER_TO_DEX` は、選んだ recipe を signature に関係なく登録し、別 recipe の発見も同じ pizza で登録する | 部分集合の組が 89 あるので、「base の recipe + 具を 1 つ足す」で、1 回の調理が 2 つの Dex に効く |
| L10 | recipe の unlock が手書きの chain | `unlockCondition.requiresRecipeId` の一本道 | Progression 2.0（#205 / #214 / #217）で置き換える前提。本書では扱わない |
| L11 | Original Pizza は採点しない・保存しない | `CONFIRM_BAKE`（free cook で MATCHED 以外なら `score: null`） | My Recipe、Original の Pitz（#217 の文言「positive-Pitz original bake」とのずれ。§8.4） |

---

## 5. Recipe Identity model

### 5.1 目標モデルと今のコードの対応

| 目標モデル | 今のコード | 差 |
|---|---|---|
| ingredient identity | `RuntimeSignature.ingredientSet` + `sauceBase`（OBSERVED） | なし。数量は identity ではない（既にそうなっている） |
| cooking step identity | `IdentityDimensions` の 11 軸（dough / pan / layerOrder / zones / late / prep / enclosure / shape / cook / laminate / spreadLayers）と、target の `capabilities` | 軸は全部あるが、**全部が FIXED_BY_FLOW か UNAVAILABLE**。`RUNTIME_SUPPORTED_CAPABILITIES = []` |
| unsupported mechanic を除外 | capability を満たさない target は候補にしない | なし（既にある） |
| blocked 行 | `eligibility: BLOCKED` と重なったら AMBIGUOUS | なし（既にある） |

**結論: identity の型を新しく作る必要はない。** 足りないのは次の 3 つ。

1. 工程の観測を `PizzaState` から signature へ渡す（L4）
2. dimension ごとの比較の方針（L5）
3. capability の registry を runtime の実装と連動させる

### 5.2 工程の観測（最小の変更案）

- **`PlacedTopping` に `stage` を付ける:** `"PREPARE" | "FINISH"`、ない場合は PREPARE。transient で、save しない（`GameState` は永続化しない）。
  - これで `late` の dimension が OBSERVED になる。
- **`PizzaState` に `stepLog` を足す:** 実行した `MakingStep` の順番の配列。`CONFIRM_MAKING_STEP` の reducer だけが書く。
  - これで `layerOrder` / `enclosure` / `prep` が OBSERVED になる。
  - 1 つの配列なので、FOLD / SEAL / PREP など工程が増えても型は変わらない。
- **`signatureOfPizza` の変更:** `RUNTIME_DIMENSION_OBSERVATION` の該当する軸を OBSERVED にして、値を `stepLog` と `stage` から作る。
  - 軸は、その mechanic を実装する PR で**1 軸ずつ** OBSERVED にする。

### 5.3 必須の設計: dimension の比較の方針（STRICT / LENIENT）

**今の問題:** 軸を 1 つ OBSERVED にすると、`compareDimensions` はすべての target にその軸の一致を求める。例:

- Free Cooking で、焼いた後に basil をのせたマルゲリータ → `late=[post_bake,[basil]]` になり、マルゲリータの default（`[]`）と一致しない → **マルゲリータと判定されなくなる**。これは回帰。
- 逆に、材料がマルゲリータと同じで、生地を折りたたんだ pizza は、マルゲリータと判定**されてはいけない**。

**提案:** 軸ごとに、target が値を宣言しなかったときの扱いを決める。

| class | 対象の軸（#189 の `structural` と対応） | target が宣言しない場合 |
|---|---|---|
| **STRICT** | enclosure（ENCLOSE）、cook（FRY_COOK）、pan（PAN_BAKE）、shape（DOUGH_SHAPE_TARGET）、laminate（LAMINATE） | default 値が必要。default でない pizza は、その target と一致しない |
| **LENIENT** | layerOrder（STEP_ORDER）、late（LATE_ADDITION）、prep（PREP_STEP）、zones（ZONED_PLACEMENT）、spreadLayers（MULTI_SPREAD_LAYER）、dough（DOUGH_VARIANT） | 比較しない。値の違いは Completion / Quality 側で扱ってよい |

- target は `identityDimensions` の中で、**宣言した軸（`declaredDimensions`）だけを厳密に比べる。**
- STRICT の軸は、宣言がなくても default と比べる。
- **Calzone の例:** Calzone は enclosure を宣言する。材料が一致しても折っていなければ一致しない。折ったマルゲリータは、STRICT の軸が default でないので、マルゲリータとも一致しない → **Original**。
- **STEP_ORDER で「順番が identity の recipe」と「順番が品質だけの recipe」を分ける方法:**
  - Trenton は `layerOrder` を宣言する（identity）。
  - Chicago のように順番を品質だけに効かせたい recipe は、宣言しない（LENIENT で無視する）。
  - `CookingProfile` に `orderPolicy: "IDENTITY" | "QUALITY" | "NONE"` を持たせる。
- DOUGH_VARIANT を LENIENT にするかどうか（例: カリフラワー生地のマルゲリータをマルゲリータと判定するか）は、ゲームの意図の判断なので、**OD-A11（§19）**にした。

### 5.4 例（ユーザーが挙げた 4 例と、#189 の証拠との対応）

| recipe | steps（`CookingProfile.steps`、BAKE は phase） | identity が宣言する軸 | #189 の行 |
|---|---|---|---|
| Margherita | DOUGH → SAUCE → CHEESE → TOPPING ‖ BAKE ‖ CUT | なし（全部 default） | shipped |
| Calzone | DOUGH → SAUCE → CHEESE → TOPPING → FOLD → SEAL ‖ BAKE（CUT なし） | enclosure = fold（STRICT） | `calzone-pizzadb`（ENCLOSE。ricotta と salami が新 ingredient。BLOCKED_PRODUCT_DECISION） |
| Chicago Deep Dish | DOUGH(pan) → CHEESE → TOPPING → SAUCE ‖ BAKE(pan) ‖ CUT | pan = deep-pan（STRICT）、layerOrder（LENIENT。宣言する） | `chicago-deep-dish-pizzadb`（STEP_ORDER + PAN_BAKE。BLOCKED） |
| Taco Pizza | DOUGH → SAUCE → CHEESE → TOPPING ‖ BAKE ‖ FINISH ‖ CUT | late（宣言する） | **#189 の `taco-pizza-pizzadb` は `requiredCapabilities=[]`（PARTIAL。salsa が未対応の sauce）で、LATE_ADDITION の証拠はない。** ここでは説明のための例として扱い、データの根拠にはしない |

---

## 6. Completion model

### 6.1 分け方

| 層 | 問い | 入力 | 今の場所 |
|---|---|---|---|
| Identity | 何のピザか | ingredient set + 宣言した工程の軸 | `signature` / `matcher` |
| Completion | 料理として完成しているか | 必須の材料が 0 個でない（#218 の G1 候補）、sauce の最低量、焼き加減の範囲、**必須の工程**（ENCLOSE で閉じていない、など） | `completionGate.ts` |
| Quality | どれだけ上手に作れたか | 数量（#218 の Q / 過剰の罰の候補）、配置、sauce の coverage、dough、bake、cut、**工程の品質** | `scoringV2` + 工程ごとの bonus（Cooking Steps 1.0 §10 の案 C） |

### 6.2 「同じ recipe だが Completion が低い」は成り立つか → **成り立つ（条件つき）**

- identity は、数量に今も依存していない。
- 今は、Free Cooking で「種類がそろっていて数量が足りない」と `INCOMPLETE_MATCH` になる。原因は、`resolveFreeCookPizza` がその recipe の Completion Gate（理想量）を使っているから。
- #218 の OD-1（G1）+ OD-5（D-A）が採用されれば、「同じ recipe で ★ が低い」になる。**これは owner の決定待ちで、本書では確定扱いにしない。**
- 工程の Completion は `CompletionFailureReason` に追加する（`UNCLOSED_FOLD` など。Cooking Steps 1.0 §11）。`CookingProfile` に `requiredForCompletion` を持たせる。

### 6.3 #218 の各候補と工程の関係（決定ではなく、整合の確認）

| 候補 | 工程が増えたときの整合 |
|---|---|
| OD-1 G1（必須材料 0 個だけ FAILED） | 工程は別の軸（identity か step completion）なので衝突しない |
| OD-2 Q = 0.5 / OD-3 過剰 0.15 | FINISH で置いた駒も、`countUsedIngredient` の数量に含めるか決める必要がある。**含める案を推奨**（late も材料） |
| OD-4 LR-A | Lunch Rush は「注文」の policy。工程が必須の recipe は、Lunch Rush でも工程が必須 |
| OD-4b（未登録） | #218 に項目がない。LR-A の下で過剰の罰だけを Lunch Rush の品質点に効かせると、ranking の ruleset（`LUNCH_RUSH_RULESET_VERSION`）への影響を再評価する必要がある（§19） |
| OD-5 D-A | 工程で identity が決まる recipe では「種類がそろっていて、宣言した工程も実行した」が発見の条件。数量は Quality |

---

## 7. Cooking Step Engine 案

### 7.1 方針: 「mechanic = 再利用できる Step Module」

recipe ごとの if 文は作らない。mechanic ごとに、次の 1 つのモジュールだけを作る。

```
StepModule {
  capability: "LATE_ADDITION" | "STEP_ORDER" | ...   // #189 の ID をそのまま使う
  makingSteps: MakingStep[]         // 例: LATE_ADDITION → ["FINISH"]、ENCLOSE → ["FOLD","SEAL"]
  phase: "PREPARE" | "POST_BAKE"    // 既存の POST_BAKE_STEPS と同じ規則
  observes: IdentityDimensionKey    // 例: late / layerOrder / enclosure
  dimensionClass: "STRICT" | "LENIENT"
  completion?: (profile, pizza) => CompletionFailureDetail | null
  qualityBonus?: (profile, pizza) => number   // 案 C: core score は変えずに追加する
  ui: { tabLabel, tray?: "INGREDIENTS" | "NONE", gesture: "SCATTER" | "PAINT" | "DRAG" | "TRACE" | "SWIPE" }
}
```

- recipe が持つのは `CookingProfile` の `steps` と、step ごとの config（Cooking Steps 1.0 §7 の案 C。既に採用されている）だけ。
- `RUNTIME_SUPPORTED_CAPABILITIES` は、登録された StepModule から作る。すると、**「新しい mechanic を 1 つ実装すると、その capability だけを要求していた行が、matcher で自動的に候補になる」**。

### 7.2 今の固定のフローとの関係

- 今の概念上のフロー `DOUGH → SAUCE → (CHEESE) → TOPPING → BAKE → CUT` は、既に次の 2 つで表されている。**固定の配列はもう残っていない。**
  - `deriveCoreSteps`: 必要な category から作る
  - CUT の allowlist
- 固定されているのは次の 3 つ。
  1. **`deriveCoreSteps` の順番:** SAUCE → CHEESE → TOPPING。STEP_ORDER は `COOKING_PROFILE_OVERRIDES` で上書きすれば足りる（Map は既にあって空）。
  2. **`POST_BAKE_STEPS`:** CUT / FINISH。
  3. **Free Cooking の profile:** 固定の 4 工程（L6）。

### 7.3 Free Cooking の工程の UI（案の比較）

| 案 | 内容 | 利点 | 欠点 |
|---|---|---|---|
| F1: 全部の工程をいつもタブで出す | 解放済みの mechanic の工程をすべて並べる | 分かりやすい | 360px に入らない。毎回のタップが増える |
| **F2: 任意の工程を「＋工程」チップで出す（推奨）** | core の 4 工程はそのまま。解放済みの mechanic だけ、その phase の終わりにスキップできるチップを出す（例: 焼いた後の「仕上げをする？」、TOPPING の後の「包む？」） | 未解放の工程は出さない。答えを見せずに行動だけを渡せる | STEP_ORDER のように「順番」の mechanic は、チップでは表せない |
| F2' | STEP_ORDER だけ、Free Cooking の SAUCE と CHEESE を「どちらから始めるか」選べるようにする（最初に触った方を `stepLog` に記録） | gesture を増やさない | 一方向の step の契約を Free Cooking で緩める |

---

## 8. Original Pizza model

### 8.1 今の状態

- Free Cooking の `resolveFreeCookPizza` → `ORIGINAL`（NO_MATCH / AMBIGUOUS / INCOMPLETE_MATCH）。
- ResultPanel の ORIGINAL カードに、材料の一覧と near-miss の文言を出す。
- `score = null`、Dex / Pitz / Save には何も書かない。
- recipe mode では Original にならない（選んだ recipe として採点する）。

### 8.2 PizzaBlueprint を新しい型として足すか → **足さない（最小の変更案）**

`PizzaBlueprint` の要素は、既にある型から作れる。

| Blueprint の要素 | 既存の出どころ |
|---|---|
| ingredients / quantities | `RuntimeSignature.ingredientSet` / `ingredientCounts` |
| cookingSteps / step order | §5.2 の `stepLog`（新しく足す 1 フィールド） |
| placement | `PizzaState.toppings[].x/y`（と `stage`） |
| bake | `PizzaState.bakeResult` |
| cut | `GameState.cutState` |

- **最小の変更:** `signatureOfPizza` の出力（`RuntimeSignature`）を拡張して、Blueprint の役を兼ねさせる。新しい型を足して並行させると、drift の原因になる。
- **matcher の流れ:** 一致すれば Official（発見 / 発見済み）、一致しなければ Original。これは `evaluateDiscovery` そのもの。

### 8.3 Scoring V2 との整合

- Original には Reference がない → Scoring V2 は `available:false` になる。
- 案:
  - **O1:** 今のまま採点しない（推奨の既定値）
  - **O2:** Reference を使わない部分だけで ★ を出す（bake、sauce の evenness / edge、cut）
  - **O3:** Blueprint 自身を Reference にする（自分と比べるので意味がない）
- **O2 にするかは owner の判断（OD-A7）。** Dex には書かないので、⭐ の式（#209 / #214）には影響しない。

### 8.4 Pitz との seam

#217 の本文には「positive-Pitz original bake」とある。一方、main では Original の Pitz は 0。

#217 の simulation（`earn_bake(False)`）は、実際には「発見済みの recipe の再調理」でも成り立つ。したがって、**deadlock がないという結論は Original の Pitz に依存しない**と読める。ただし、文言が今のコードとずれているので、#217 の決定時に確認する（OD-A7 に含める）。

---

## 9. My Recipe future model（今回は実装しない）

### 9.1 モデル

```
MyRecipeV1 {                       // save の top-level に新しいキー "myRecipes" を足す（schemaVersion は上げない）
  id: "myr-<base36>"               // RecipeId と重ならない接頭辞。#206 の unknown-id の正規表現に合う
  name: string                     // 例: テトスペシャル（表示名の検証は src/shared/displayNameValidation.ts と同じ方針）
  items: { ingredientId, count }[] // sauce は count 1
  steps: MakingStep[]              // 宣言した工程（stepLog を正規化したもの）
  layout?: { ingredientId, x, y }[]// 任意。なければ procedural の Reference（§11 D）
  bakeTarget?: { start, end }      // なければ FREE_COOK_BAKE_TARGET
  cut?: { requestedSliceCount }
  createdFromSignatureHash: string // 公式 recipe と一致したら保存させない（公式と二重にしない）
  best?: { score, stars }
}
```

- **Free Cooking で再現する:** `MyRecipeV1` を合成の `Recipe`（`requiredIngredients` = items、`bakeTarget`）+ `CookingProfile`（steps）+ procedural の Reference に変換する。変換すれば、**今の Completion / Scoring V2 / step のパイプラインをそのまま通せる**。
  - Reference の案 D（§11）が、My Recipe の採点の前提にもなる。
- **店のメニュー → Lunch Rush の注文:** 次の 3 点が壁。**実装しない前提で、影響だけ記録する。**
  1. `Order.recipeId: RecipeId` の型
  2. ranking の公平性: server（`submitLunchRushScore`）は `recipeId` を任意の文字列として受け取る。1 材料の My Recipe を作れば、ranking が崩れる
  3. `LUNCH_RUSH_RULESET_VERSION`

### 9.2 Save schema への影響と migration のリスク

| リスク | 内容 | 対策 |
|---|---|---|
| S1 古い build が消す | main の `sanitizeSave` は、決まったキーだけで object を作り直す → **main に rollback すると `myRecipes` が消える** | **PR #206（forward-compat）が merge されてから**にする。#206 は知らない top-level key を「そのまま保持し、読まない」 |
| S2 schemaVersion を上げると全消去 | 知らない `schemaVersion` は既定値に戻る（`toIntermediateV2` → null） | **version は上げない**（#204 / #206 の「no bump」と同じ） |
| S3 dex に混ぜる | `myr-…` を `dex[]` に入れると、今の build は `isKnownRecipeId` で落とす。#206 の後でも「知らない recipe」として保持されるだけで、意味がずれる | top-level の別キーにする。dex / ⭐ / mastery には入れない |
| S4 ingredient の改名・削除 | 保存した `ingredientId` が後で消える | load 時に知らない ingredient を含む My Recipe は「再現できない」と表示するだけにして、消さない |
| S5 容量 | 1 件あたり約 0.3〜1 KB（layout を含めると最大約 1 KB） | 上限の件数（例: 50）は owner の判断 |
| S6 公式 recipe が後から追加される | 保存済みの My Recipe が、新しい公式 recipe と同じ signature になる | load 時に signature で照合し、「公式のレシピになりました」と表示する（データは消さない） |

---

## 10. Collision resolution

### 10.1 実データ（W1 の再確認。#220 の W1 10 件 + production 15 件）

- **真部分集合:**
  - Margherita ⊂ Melanzane（+eggplant）⊂ Parmigiana（+parmigiano）
  - Margherita ⊂ Parmigiana
  - Bismarck ⊂ **Portuguesa**（+black-olive, ham, onion）
  - production 同士: Bismarck ⊂ Breakfast、Funghi ⊂ Capricciosa、Salsiccia / Pepperoni ⊂ Meat Lovers
- **材料を 1 つ入れ替えた関係（包含ではない）:**
  - **Hawaiian ↔ Bambino**（pineapple ↔ corn）
  - production の Margherita / Bismarck / Funghi / Salsiccia / Pepperoni の 5 件は、互いに 1 つ入れ替えた関係
- **同じ ingredient set:** W1 + production では 0 件。172 行（set が完全な 120 行）では 5 組。例: `ny-style` と `trenton-tomato-pie` は、どちらも {mozzarella, tomato-sauce}。

### 10.2 比較

| 方式 | Original との境界 | 部分集合 / 上位集合 | 入れ替え（Hawaiian ↔ Bambino） | 同じ set（ny ↔ trenton） | 評価 |
|---|---|---|---|---|---|
| A: 最も specific な recipe（材料で上位集合を許す） | ほぼ消える（何か足せば、たいてい何かの上位集合になる） | Margherita + 何か → Melanzane / Parmigiana に吸われる | 両方を入れると AMBIGUOUS | 区別できない | ✗ Original が成り立たない |
| B: 完全一致だけ（今の main） | はっきりしている | 足した分があれば Original | 区別できる | **区別できない**（工程がないと AMBIGUOUS） | ○ ただし工程の軸が要る |
| C: weighted similarity | 閾値しだい（調整が終わらない） | 近いものに吸われる | 同点になる | 区別できない | ✗ 決定的でない。authoring のたびに再調整が要る |
| **D: B + 工程の軸の specificity + STRICT / LENIENT + 決まらなければ Original（推奨）** | B と同じ | B と同じ | B と同じ | **宣言した工程で区別する**（cheese-first → Trenton。標準の順番で DOUGH_VARIANT がない → Original） | ◎ |

**D の規則:**

1. ingredient set と sauce base が完全に一致する target だけを候補にする。
2. STRICT の軸が一致しない target を除く。
3. LENIENT の軸は、target が宣言したものだけを比べる。
4. 残った候補のうち、一致した宣言軸が最も多いものを選ぶ。同点なら AMBIGUOUS → Original。blocked の行が残っていれば、今と同じく AMBIGUOUS。
5. 数量・配置・焼き・カットは、identity には絶対に使わない。
6. near-miss（Hawaiian に corn、など）の案内は、similarity を**表示だけ**に使ってよい（identity の判定は変えない）。

### 10.3 test の不変条件（100+ でも機械的に守る）

- catalog のすべての ELIGIBLE target の組について、**D で同じ結果になる組が 0 件**であること（今の「recipe ごとの Reference は、その recipe としてだけ発見される」test（discoveryCatalog.test #12）を一般化する）。

### 10.4 recipe mode の二重の登録（L9）

- 例: Margherita を選んで eggplant を 3 個足す。
  - Margherita として採点される（recipe の component が purity 3/4 → −3 点程度）。
  - 同時に、Melanzane が別 recipe として新しく発見され、Dex に登録される。
- 部分集合の組が 89 あると、これは体系的な近道になる。
- **案:**
  - M1: 今のまま（発見のボーナスとして許す）
  - M2: signature が選んだ recipe と違うなら、選んだ recipe の登録を「別の料理になりました」に変える
  - M3: 選んだ recipe だけを登録し、別の recipe は発見のお知らせだけにする
- **owner の判断（OD-A8）。**

---

## 11. Reference Pizza scalability

### 11.1 実測（main）

- 15 件、手書きのデータは 643 行（平均 43 行/件）。ファイルの合計は 973 行。
- piece group は 40、座標は 86 点。
- sauce の Reference は、**全 recipe が同じ fixture から機械的に作られる**（`computeMechanicalSauceReference`）。
- `landingStyle`: 19 ingredient のすべてで、ingredient ごとに 1 値に決まっている（HEAVY_SQUASH か LIGHT_LEAF）。
- tolerance: 40 group 中 38 が 8/22。例外は 2 件（egg の 14/30）。
- `positions.length === minCount` を test で固定している（`playerReference.test.ts:40`）。

**→ recipe ごとに違うのは、駒の座標だけ。**

### 11.2 比較（100 recipes のとき）

| 案 | 100 件の authoring | Scoring V2 との互換 | リスク |
|---|---|---|---|
| A: 全部手作業 | 約 4,300 行（43 × 100）+ recipe ごとの review | そのまま | 漏れると ★1 になる（L1）。review が詰まる |
| B: ingredient ごとの配置の template | ingredient ごとに landing / tolerance / 形（中心・外周・散らす）を 1 回だけ書く（今の 22 種 + 新しい種類） | 座標が変わる → 既存の 15 件の点数が変わる | B だけでは、同じ recipe の中の group 同士の衝突を解けない |
| C: recipe archetype の template | 「中心に 1 個」「均等な ring」「外周」などの型を選ぶ | 同じ | 型の数が増えやすい |
| **D: procedural generation + recipe override（推奨）** | 生成器 1 つ（B の ingredient の属性 + ring / 中心 / 外周の配置規則。最小距離 9、生地の半径の内側）。**既存の 15 件は override としてそのまま残す** | **既存の 15 件は byte 単位で同じ**（override が優先）。新しい recipe だけが生成される | 生成した配置の見た目は、Human Verification で確認する |

### 11.3 D への移行（Scoring V2 を壊さない順番）

1. `getReferencePizza` を `override ?? generate(recipe)` にする。
   - 生成器は、今の `PIECE_RING_POSITIONS` の考え方を N 個に拡げる（L7 の 8 個の制限もここで解く）。
2. Player Reference / サムネイル / Scoring が**同じ Reference を読む**ようにする（Reference Truth、PR-B の方針をそのまま広げる）。
3. 既存の 15 件の golden test: `computeScoringV2` の結果が、移行の前後で一致すること。
4. `SCORING_V2_RULESET_VERSION` は上げない（既存の recipe の点数が変わらないので）。

---

## 12. W1 との統合方法

### 12.1 #220 と #221 の不一致（今の HEAD で確認）

| | #220（`e49dab9`） | #221（`279b6b1`） |
|---|---|---|
| 10 件 | new-haven, hawaiian, parmigiana, bambino, **portuguesa**, puttanesca, pesto-caprese, **pesto-tonno**, pesto-patate, melanzane | aussie, bacalhau, parmigiana, **portuguesa**, puttanesca, full-english, **pesto-tonno**, polish-kielbasa, melanzane, tsukimi |
| 新 ingredient | 7（capers, clam, corn, eggplant, fresh-tomato, pineapple, potato） | 6（baked-beans, capers, eggplant, green-onion, salt-cod, sauerkraut） |

- 共通は **5 件**: portuguesa、puttanesca、pesto-tonno、parmigiana、melanzane。
- **#221 の aussie / bacalhau / full-english / polish-kielbasa / tsukimi は、#220 の CSV では `wave=W4`、`runtime_contract_dependencies=SAUCELESS_RECIPE_CONTRACT`。**
  - 本書の L2（sauce の重み 52、`ReferenceSauce` が必須）でも、そのままでは ★ の上限が低い。
  - **#221 の slice A（Aussie を READY）は、今の runtime とは合っていない。**
- **#221 の change map の漏れ:**
  - slice A: `recipeSauceProfiles.ts` / `discoveryCatalog.ts` / `referencePizza.ts` / `orders.ts` が入っていない。
  - slice B: `discoveryCatalog.ts` / `referencePizza.ts` / `orders.ts` が入っていない。
  - §3 の scratch では、この 4 つのファイルすべてが必須だった。
- **本書では #220 / #221 を変更しない。** どちらを正にするかは owner の判断（OD-A1）。

### 12.2 Slice 1（Pizza Portuguesa + Pesto Tonno、新 ingredient 0）を「今の構成の延長」にするか、「新しい構成の最初の Vertical Slice」にするか

| 観点 | 今の構成の延長（推奨） | 新しい構成の最初の Vertical Slice |
|---|---|---|
| mechanic の検証 | 不要（2 件とも工程を使わない。`requiredCapabilities=[]`） | **検証にならない**（工程がないので、Step Engine が動かない） |
| 変更の量 | データ 6 系統 + test | Engine の変更と一緒になり、rollback の単位が大きくなる |
| 価値 | 「100+ の content pipeline」の Vertical Slice にはなる（登録の漏れを検出する test の効果を確かめられる） | — |
| 先に要るもの | ① L7（Portuguesa は具が 10 個で 8 スロットを超える）の修正か、Reference の案 D の生成器 ② #221 の REC-06 / REC-09（オリーブ → black-olive の alias の証拠） ③ Progression 2.0 の unlock の形（`unlockCondition` の chain のままでよいか。#205 / #214） | 同左 + Engine |
| collision の test | **Bismarck ⊂ Portuguesa**（L9 の二重の登録）、Pesto Tonno ↔ Tonno e Cipolla（sauce が違う: pesto / tomato。`sauceBase` で区別できる） | 同左 |

**推奨:**

- Slice 1 は、**今の構成の延長（content-only）**として実装する。ただし、§17 の P1（content contract の強化）を先に入れる。
- Pesto Tonno は、具 7 個・pesto・cheese なし → `deriveCoreSteps` は [DOUGH, SAUCE, TOPPING]。8 スロットに入るので、**Pesto Tonno 単独なら P1 なしでも入れられる**。
- Portuguesa は、L7 を解いてから入れる。

---

## 13. Migration risks

| ID | リスク | 起きる条件 | 防ぎ方 |
|---|---|---|---|
| R1 | 軸を OBSERVED にすると、既存の 15 recipe の発見が壊れる | §5.3 の方針なしで `late` / `layerOrder` を観測する | STRICT / LENIENT を先に入れる。15 件の Reference pizza が、自分の recipe として発見され続ける test |
| R2 | Reference を生成にすると、点数が変わる | override を残さずに作り直す | 15 件は override のまま。golden test |
| R3 | Reference の漏れで ★1 | 手作業の追加 | 生成の fallback（D）、または runtime の assert |
| R4 | Lunch Rush の ranking の比較ができなくなる | Completion / Quality の式を変える（#218 の LR-C / D、OD-4b） | ruleset の version。LR-A の場合は影響なし |
| R5 | save が消える | #206 の前に新しい top-level key を書く / version を上げる | #206 が先。no bump |
| R6 | Free Cooking の工程の UI で、毎回のタップが増える | 全工程をいつも出す（F1） | F2（解放済みだけ、スキップできるチップ） |
| R7 | test の churn | 「15」の固定（13 ファイル） | P1 で `RECIPES.length` に基づく形に書き換える |
| R8 | CUT が静かに付かない | allowlist の漏れ | CUT を StepModule の既定にするか、allowlist を網羅する test（既にある）を残す |
| R9 | 2 つの W1 集合のうち、違う方を実装する | #220 / #221 の不一致 | OD-A1 |
| R10 | sauce なしの recipe の ★ の上限 | L2 を解かずに W4 の行を入れる | `SAUCELESS_RECIPE_CONTRACT` を先に設計する（sauce の重みを再配分する案は、既存の 15 件の点数を変えない形にする必要がある） |

---

## 14. Save compatibility

- **Identity / Completion / Step Engine / Reference の案 D:** **save の変更なし。** `stepLog` / `stage` / `cookingProfile` / `cutState` はどれも transient（`GameState` は永続化しない）。
- **新しい recipe:** `dex[].recipeId` が増えるだけ。rollback すると、今の main は知らない recipe の Dex を**消す**。#206 が merge された後は、保持する。
  - したがって、**W1 を含む recipe の追加は #206 の後に出すのが安全**（#206 の本文の「rollback の下限」と同じ結論）。
- **My Recipe:** §9.2。top-level key を 1 つ足す。**#206 の後、no bump。**
- **Original Pizza（O2 の採点）:** 保存しなければ save の変更なし。「最近の Original」を保存するなら、My Recipe と同じ扱いにする。

---

## 15. UI implications（390×844 / 360×800）

- **Cooking Step のナビゲーション:**
  - 今のタブ（`MakingStepTabs`）は、recipe の profile に必要な工程だけを出す（`deriveCoreSteps`）。「必要な step だけを出す」方式は、**既に採用されている**。
  - タブの数:
    - Margherita: 生地 / ソース / チーズ / 具材 / 焼く / カット = 6
    - LATE_ADDITION の recipe: 7（+ 仕上げ）
    - Calzone: 生地 / ソース / チーズ / 具材 / 折りたたみ / とじる / 焼く = 7（カットなし）
  - 360px で 7 タブは、1 タブ約 50px。Cooking Steps 1.0 §9 の「5 個以上なら、active / next / 完了以外はアイコンのチップにする」を採用する前提で、上限は 8 程度。
  - **全工程をいつも出す必要はない。** Free Cooking は F2（§7.3）。
- **Recipe Select:** 章は 8 件ずつ自動で作られる（`pizzaSelect.ts`）。100+ だと約 13 章。検索 / 材料での絞り込み / 「工程アイコン」は、#182 の UI 方針に合わせる。
- **Free Cooking:** tray には所有しているすべての材料を出す（今もそう）。100+ の材料のページ送りは、既存の Issue（#182）の範囲。
- **Result:** 工程の品質の行（例: 「仕上げ ◎」「包み ○」）を、Result 1-Screen 2.0 の 1 画面に入れるには、行を増やさずに Pieces の行に含める必要がある。
- **Dex:** `RECIPES.map` のグリッド。100+ にはページか章のタブが要る。Dex のカードに、必要な工程のアイコンを出す（未発見でも、工程の解放の目安になる）。
- **Original Pizza Result:** 既存の ORIGINAL カード（材料の一覧 + near-miss）を使う。将来、「My Recipe に保存」の CTA を 1 つ足す。360px でも 1 画面に入る範囲（ボタン 1 つ）。
- **実装する slice はすべて、Human Verification（390×844 の動画 + before / after のスクリーンショット）が DoD に入る。**

---

## 16. Test strategy

| 層 | 内容 |
|---|---|
| Content contract（unit） | 1 つの test で、すべての `RecipeId` が 6 系統（sauce profile / discovery ID / Reference（override または生成）/ order / CUT の判定 / Player Reference）に解決されることを確かめる。「15」の固定を `RECIPES.length` に置き換える |
| Matcher（unit、表形式） | STRICT / LENIENT × 宣言あり / なし × 観測値の組み合わせ。§10.3 の「同じ結果になる組 0 件」の不変条件（catalog 全体） |
| 15 件の回帰（golden） | 15 件の Reference pizza について、発見 / Completion / Scoring V2 の total が移行の前後で一致する |
| Reference の生成器（property） | 座標の数 = `minCount`、最小距離 ≥ 9、生地の半径の内側、決定的（同じ入力で同じ出力） |
| StepModule（unit + reducer） | 工程ごとに: phase の gate、`stepLog` / `stage` の記録、Completion の失敗理由、Quality の bonus。core score は変わらない |
| Scratch 追加 test | 「recipe を 1 件足すと何が壊れるか」を CI で再現する（本書 §3 の手順を fixture にする） |
| E2E（Chromium 390×844 / 360×800） | mechanic ごとに、Free Cooking で発見する経路と、recipe mode で作る経路 |
| WebKit | 既存の Dev CI の gate（#207 / #219） |
| Human Verification | 工程が見えるすべての slice |

---

## 17. Recommended implementation phases

| Phase | 内容 | UI / HV | 先に要るもの |
|---|---|---|---|
| **P0** | Owner Decision（§19） | — | — |
| **P1 Content contract の強化** | content contract の test、「15」の固定を外す、Reference の生成器 + override（既存の 15 件は byte 単位で同じ）、ring の 8 個の制限を外す、Reference の漏れを runtime で検出 | **UI の変更なし** → HV 不要（Player Reference が生成に切り替わる場合だけ見た目の確認が要る） | なし（Progression 2.0 と独立） |
| **P2 W1 Slice 1** | Pesto Tonno（P1 がなくても可）→ Pizza Portuguesa（P1 の後） | 新しい recipe の見た目 → HV | P1、REC-06 / 09、OD-A1、Progression 2.0 の unlock の形、#206 |
| **P3 Step Engine の土台** | `stepLog` / `stage`、STRICT / LENIENT、`declaredDimensions`、StepModule の registry → `RUNTIME_SUPPORTED_CAPABILITIES`。**mechanic 0 個で入れる**（どの軸も OBSERVED にしない = 振る舞いの変更なし） | なし | OD-A2 |
| **P4 最初の mechanic: STEP_ORDER + Trenton Tomato Pie** | `COOKING_PROFILE_OVERRIDES` に [DOUGH, CHEESE, SAUCE]、`layerOrder` を OBSERVED、Free Cooking の F2'、描画の順番（sauce の canvas を cheese の駒より上にするか） | あり → HV | P3、OD-A3 / A4 / A5 |
| **P5 2 番目の mechanic: LATE_ADDITION（post_bake だけ）** | FINISH の工程、`stage`、焼いた見た目から除く、late の group の Reference。mid_bake は後回し | あり → HV | P4、新 ingredient と sauce ID の拡張（最初の recipe の候補: bbq-chicken / wasabi-beef は、新 ingredient が 3 種 + 未対応の sauce ID） |
| P6 以降 | MULTI_SPREAD_LAYER / DOUGH_VARIANT（再利用が最も多い: 単独で 13 / 20）→ ENCLOSE → PAN_BAKE → … | あり | #217 の OD216-3 |
| 並行 | #218 の実装（OD-1〜5 が決まった後。#215 の guardrail どおり 3-4C の後） | あり | #218 の OD |

- **DOUGH_VARIANT / MULTI_SPREAD_LAYER の方が、再利用できる recipe が多い**（#189 の greedy 順で 1 位 / 2 位）。
- それでも P4 を STEP_ORDER にする理由: ユーザーが指定した候補 A〜D の中で**最も安全**で、かつ Engine の核心（「材料が同じで、工程で identity が変わる」）を最小の構成で証明できるから。
- DOUGH_VARIANT を P4 の候補に加えるかどうかも、owner に確認する（OD-A3）。

---

## 18. Smallest safe next task

**P1-a: 「Recipe Content Contract」test + 「15」の固定の除去（production の振る舞いは変えない）**

- 変更: `src/**/*.test.ts(x)` と e2e の `/15` の固定だけ。**production code は変更しない。**
- 追加: すべての `RecipeId` について、次の 6 つを確かめる 1 つの test。
  1. `getRecipeSauceProfile`
  2. `RECIPE_DISCOVERY_TARGET_IDS`
  3. `getReferencePizza !== null`
  4. `findOrderForRecipe`
  5. CUT の判定
  6. Player Reference の座標が重ならない（**Portuguesa を足すと、ここで落ちる**）
- 効果: W1 でも 100+ でも、recipe を追加するときの漏れを 1 箇所で検出できる（§3 の 16 ファイル / 21 tests の分散を集約する）。
- UI の変更なし → HV は不要。rollback は test ファイルを戻すだけ。
- Issue: 新しく作らない。**Issue #182（実装の PR 分割）で管理できる。**

mechanic の最初の Vertical Slice は **STEP_ORDER × トレントン・トマトパイ**（P4）。ただし、P3（Engine の土台）と OD-A2〜A5 の後に行う。

---

## 19. Blockers / Owner Decisions

### 19.1 既存の Owner Decision（本書では決めていない）

| ID | 出どころ | 内容 | 本書との関係 |
|---|---|---|---|
| OD-1〜OD-5 | #218 §13 | G1 / Q = 0.5 / 過剰 0.15 / LR-A / D-A（どれも**候補**） | §6。Step Engine の設計は、どの選択肢でも成り立つ |
| OD-4b | 本依頼の中の候補（**#218 には未登録**） | Lunch Rush でも過剰の罰を品質点に適用する | 登録するなら、#218 の Decision Sheet に追加する。ranking の ruleset への影響の再評価が要る |
| OD216-3 | #217 | capability の unlock policy（A_PAID / B_AUTO / C_TUTORIAL） | C_TUTORIAL は、STEP_ORDER を Trenton で教える想定。P4 と一致する |
| 価格 / unlock / star gate | #217 / #220 / #221 | TBD | W1 を実装する前に要る |

### 19.2 本書で新しく見つかった判断（owner の判断が要るもの）

| ID | 判断 | 選択肢 | 推奨（候補） |
|---|---|---|---|
| **OD-A1** | W1 の 10 件は #220 と #221 のどちらを正にするか。#221 の sauce なしの 5 件を W1 に入れるか | #220 の集合 / #221 の集合 / 共通の 5 件だけ | **#220 の集合**（runtime の契約と合っている）。#221 の sauce なしの 5 件は W4 に戻す |
| **OD-A2** | identity の軸の比較の方針 | STRICT / LENIENT の 2 class（§5.3）/ 全部 STRICT（今の main）/ 全部 LENIENT | **2 class** |
| **OD-A3** | 最初の mechanic | STEP_ORDER（Trenton）/ LATE_ADDITION / DOUGH_VARIANT / その他 | **STEP_ORDER**（§9 の比較） |
| **OD-A4** | Free Cooking で工程をどう選ぶか | F1 / F2 / F2'（§7.3） | **F2 + STEP_ORDER だけ F2'** |
| **OD-A5** | cheese を先に置く recipe で、sauce を cheese の上に描くか | 描画を変える / 今の描画のまま（identity だけ変わる） | Human Verification で決める |
| **OD-A6** | Reference Pizza の authoring 方式 | A / B / C / D | **D**（既存の 15 件は override のまま） |
| **OD-A7** | Original Pizza の採点と Pitz | O1（採点しない、Pitz 0）/ O2（Reference なしの部分だけで ★、Pitz なし）/ O2 + Pitz | O1 のまま。#217 の「positive-Pitz original bake」の文言は確認が要る |
| **OD-A8** | recipe mode の二重の登録（§10.4） | M1 / M2 / M3 | 判断材料を示すだけで、推奨はしない（ゲームの意図の判断） |
| **OD-A9** | My Recipe を作るか、いつ作るか | 作らない / #206 の後 / Lunch Rush まで広げる | 作る場合は #206 の後。Lunch Rush は ranking の外で |
| **OD-A10** | sauce なしの recipe の契約 | sauce の重みを再配分する / sauce の component を「不要なら満点」にする / 当面は作らない | 当面は作らない（W4 のまま） |
| **OD-A11** | DOUGH_VARIANT を LENIENT にするか（カリフラワー生地のマルゲリータをマルゲリータと判定するか） | LENIENT / STRICT | 判断材料を示すだけで、推奨はしない |

### 19.3 Blockers（実装の前に解消するもの）

1. #206 が未 merge: 新しい recipe の Dex と My Recipe の rollback の安全性。
2. #220 と #221 の W1 集合の不一致（OD-A1）。
3. #221 の REC-06 / REC-09（Slice 1 の alias の証拠）。
4. Progression 2.0 の unlock の形（#205 / #214 / #217）。新しい recipe の `unlockCondition` をどう書くか。
5. #218 の OD-1〜OD-5（Completion の統合。W1 は今の gate でも出せるが、後から揃える必要がある）。

### 19.4 Issue / PR の管理

- **新しい Issue / PR は不要。**
  - 本書の内容（content contract、Step Engine、Original / My Recipe）は、Issue #182（mechanic 依存と実装の PR 分割）と Issue #176（調理工程の再設計）の範囲で管理できる。
  - Completion の部分は Issue #215 / PR #218 で管理できる。
- My Recipe を実装すると決めた場合だけ、既存の Issue に明示的な範囲がないので、そのときに専用の Issue を作るかを判断する。

---

## 最終回答

- **A. 今の architecture のまま 100+ recipes まで増やせるか → CONDITIONAL**
  - identity（matcher）と工程（`CookingProfile`）の骨組みは、100+ に耐える。
  - 次の条件が要る:
    1. content contract の強化（1 件の追加で 6 系統 + 16 ファイル / 21 tests。Reference の漏れは runtime で ★1 になるだけで、エラーにならない）
    2. Reference の生成（手作業だと約 4,300 行）
    3. sauce なし / 複数 sauce の契約
    4. ring の 8 個の制限の解消
- **B. Cooking Step Engine は必要か → YES**
  - 172 行のうち 55 行が PARTIAL、16 行が NOT_REPRESENTABLE（#189 の matrix）。
  - ingredient set が同じ組が 5 組あり、工程がないと区別できない。
  - ただし新しく作るのではなく、既存の `CookingProfile` / `POST_BAKE` / `IdentityDimensions` に、「観測」「STRICT / LENIENT」「StepModule の registry」を足す。
- **C. Original Pizza を今から考慮すべきか → YES**
  - 既に runtime にある（Free Cooking の ORIGINAL）。
  - collision の方式（D）と STRICT の軸は、Original との境界そのもの。後から足すと、発見の結果が変わる。
- **D. W1 を先に実装してよいか → CONDITIONAL**
  - content-only の延長として可。条件:
    - Pesto Tonno: #221 の REC-09 + Progression 2.0 の unlock の形 + #206
    - Portuguesa: 上記 + ring の 8 個の制限（P1）+ REC-06
    - W1 の全体: OD-A1（#220 と #221 の不一致）を解消してから
- **E. 最初に実装すべき最小の Vertical Slice**
  - **mechanic: STEP_ORDER × recipe: トレントン・トマトパイ**（`trenton-tomato-pie-pizzadb`。{mozzarella, tomato-sauce}、cheese → sauce）
    - 新 ingredient 0、新しい gesture 0。
    - save / Scoring の式 / Lunch Rush の変更 0。
    - Starter の材料で作れる。
    - ny-style / Margherita との collision を工程で分けることを実証できる。
  - その前に、**P1-a（content contract の test。production の変更なし）→ P3（Engine の土台。振る舞いの変更なし）**を入れる。
  - 2 番目の mechanic は LATE_ADDITION（post_bake だけ）。
- **F. 次に Owner が決めること**
  1. **OD-A1**（W1 は #220 と #221 のどちらの集合を正にするか）
  2. **OD-A2**（STRICT / LENIENT）
  3. **OD-A3**（最初の mechanic）
  4. **OD-A4**（Free Cooking で工程をどう選ぶか）
  5. #218 の **OD-1〜OD-5**
  6. **OD-4b** を正式な項目として登録するか
  7. #217 の **OD216-3**
  8. **OD-A6〜A11** は、P1 / P4 に入る前に決めればよい
