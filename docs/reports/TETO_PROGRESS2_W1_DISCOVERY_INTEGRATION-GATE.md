# Progression 2.0 W1: Discovery UX Integration Gate（I5b-3 × Discovery 2.0 → I5b-4）

- 種別: Integration Gate（docs のみ）。`src/**`、`e2e/**`、CSS、runtime、tests、Playwright config、workflow は変更していない。PR も merge もしていない。I5b-4 は実装していない。
- 作業 branch: `claude/w1-discovery-integration-gate-jovdyc`（`main` 12a09de から作成。I5b-3 / I5b-4 の branch には書き込んでいない）。
- 付属データ: `docs/reports/data/TETO_PROGRESS2_W1_DISCOVERY_INTEGRATION-GATE_matrix.json`（W1-a〜g × file / function / 現状 / 必要な挙動 / data / save / migration / test / I5b-4 競合、25 recipe の ladder walk の state 派生結果、答え漏れの件数）。**runtime authority ではない。**

## 基準（fresh fetch で確認）

| 対象 | SHA | 状態（2026-09-25 の fetch 直後） |
|---|---|---|
| audited main | `12a09de2c4da8ed7e92f1ff9f47dd7bdf824a6e5` | `origin/main` の HEAD と一致（Merge PR #228、I5a） |
| I5b-3 | `5204a269a813bd4951720737ab9799949bca0f0f` | `origin/claude/teto-pizza-w1-i4a-j46ph0` の HEAD。`main` から 6 commit 先（I5b Fresh Audit → I5b-1 → I5b-2 → OD-I5B-3 → I5b-3）。**open PR なし、この SHA の CI run なし**。本監査で `npx vitest run` を実行し **3224 / 3224 pass**（scratch worktree、コード変更なし） |
| Discovery / Recipe Dex 2.0 Fresh Design | `a8ef4d9ea954f0c72a4e71936bf2ef66c28774de` | `origin/claude/discovery-recipe-dex-fresh-design-2pp4xn`。`main` から 1 commit（docs のみ） |
| I5b-4 | — | **branch なし**。参照したのは I5b-4 UI/UX Fresh Audit `0c3e01f`（`claude/teto-pizza-fresh-audit-fgqqtc`）と I5b-5 Verification Fresh Design `d4f96d0`（`claude/i5b5-verification-design-mch6ne`） |

行番号は、断りがなければ I5b-3 `5204a26` の行。

---

## 0. 結論

1. **判定: READY（条件付き）。** 条件は「I5b-3 の merge」と「OD-DISC-1 / 3 / 5 / 9 の決定」。W1-a〜f を止める技術的な blocker はない。
2. **4 状態（DISCOVERED / DISCOVERABLE / KNOWN_BUT_MISSING_MATERIAL / UNKNOWN）は、save schema を増やさずに、既存 authority（`dex`、`ownedIngredientIds`、`unlockedForShopIngredientIds`、`inventory`）だけから純粋に派生できる。** 25 recipe の実 runtime module で probe した結果、どの Dex 段階でも DISCOVERABLE と KBMM は最大 1 件で、それは常に次の ladder key recipe だった（§3）。
3. **「未発見の名前と見本を出さない / Shop で名前を教えない」は 25 recipe でも実現できる。ただし Pizza Select の表示を変えるだけでは足りない。** 答え付きの発見経路が reducer に2本ある:
   - `SELECT_RECIPE`（Dex ≥ 1 なら未発見でも guided で作れ、`REGISTER_TO_DEX` が選んだ recipe をそのまま発見として登録する。`gameReducer.ts:1108`）。
   - **新規 finding LK-8:** `nextOrderState` / `getNextOrder` は**未発見の recipe を優先して** FREE の ORDER round を作る（`orders.ts:214`）。Lunch Rush RESULT の「フリープレイへ」（`exitMissionToFree` → `PLAY_AGAIN`）で、GAME 画面に「○○（未発見の名前）」の注文が出て、「フリープレイ」→ 見本付きの guided round → 発見、と進める。Discovery 2.0 Design（a8ef4d9）はこの経路を挙げていない。
   → W1-a に **reducer の backstop（3か所）** を加える必要がある（§4 W1-a）。
4. **I5b-3 は LK-7 を現実にした。** W1 の 10 件には `unlockCondition` が無いので、ladder を ★3 で進めると、24 件の key recipe のうち **18 件が未発見のまま Pizza Select の NEW カード（名前 + 完成見本）になり**、**16 件の NEW 材料の Shop 行が「これを買うと: 🍕 ○○」で答えの recipe 名を出す**。Dex 0 では 23 枚の LOCKED カードに名前が出る（§2）。W1-a / W1-b は I5b-3 の merge 後、I5b-4 の最初に入れる必要がある。
5. **EP1 は save に一度も保存されていない**ので、display / gate から外しても save compatibility は壊れず、runtime data（`unlockCondition` / `mysteryLock`）も消さずに済む（§5）。
6. **I5b-4 との競合は Pizza Select（I5b-4c / 4d）と HOME（I5b-4a）で高い。** 別 slice にせず、W1-a / W1-c / W1-f の章は I5b-4c / 4d と**1つにまとめる**のが推奨（§6）。

---

## 1. 監査した範囲（15 項目 × I5b-3 のコード）

| # | 対象 | 主なファイル / 関数（5204a26） | I5b-3 で変わったか | Discovery 2.0 との関係 |
|---|---|---|---|---|
| 1 | Pizza Select | `src/state/pizzaSelect.ts` `recipeCardState`(:50) `unlockHintFor`(:29) `buildRecipeSections`(:122)、`src/screens/PizzaSelectScreen.tsx` `RecipeGridCard`(:93) `RecipeDetail`(:195) | 変更なし（ただし RECIPES が 25 件になり、W1 10 件は `unlockCondition` 無し → `recipeUnlocked` が常に true） | LK-1〜4、LK-7。W1-a / W1-c / W1-f |
| 2 | Recipe Dex | `src/components/DexOverlay.tsx`（`RECIPES` 順に 25 枠、未発見は `？？？ まだ見ぬピザ`） | 変更なし（25 枠になった） | 漏れなし。W1-f で章とタグを足す |
| 3 | HOME | `src/screens/HomeScreen.tsx`（props は `dex` と件数だけ。吹き出し :105、CTA :126-175、menu :180-） | 変更なし | W1-e（props の追加が要る） |
| 4 | Shop | `src/components/ShopOverlay.tsx` `unlockedRecipeNames`(:84) → `recipesUnlockedByIngredient`(`progression.ts:106`)、行の「これを買うと」(:285)、購入後の「新しいピザが作れます！」(:181) | 変更なし（W1 で漏れが増えた） | LK-5。W1-b |
| 5 | Free Cooking | `src/data/freeCook.ts`、`IngredientTray`（OWNED を全部出す、在庫 0 は disabled）、`START_FREE_COOK` / `RETRY_SAME_RECIPE`(freeCook) | 変更なし | 唯一の正規の発見経路。漏れなし |
| 6 | discovery matcher | `src/logic/discovery/matcher.ts` `matchDiscovery`(:108) `evaluateDiscovery`(:151)、`src/data/discoveryCatalog.ts`(:53) | catalog に W1 10 件の targetId を追加 | 25 target すべて ELIGIBLE、items = `requiredIngredients` の集合、重複 signature 0（probe） |
| 7 | discovery registration | `src/state/discoveryRegistration.ts` `registerDiscoveryToDex`、`src/state/dex.ts` `registerScoreToDex`(:66) | 変更なし | guided round は選んだ recipe を matcher 無しで登録する（recipe-first discovery）。W1-a で塞ぐ |
| 8 | Result | `src/components/ResultPanel.tsx`（★/点数 → NEW PIZZA banner :292 → 入荷 notice :310 → Pitz） | 変更なし | W1-d |
| 9 | reducer | `src/state/gameReducer.ts` `REGISTER_TO_DEX`(:1062) `SELECT_RECIPE`(:1199) `PLAY_AGAIN`(:1184) `nextOrderState`(:472) `BEGIN_PREPARE`(:593) `createInitialGameState`(:565) | `SELECT_RECIPE` のコメントだけ | LK-8。W1-a の backstop |
| 10 | persistence / save | `src/state/persistence.ts` `PersistentSaveV2`(:114)：`dex`、`pitzBalance`、`ownedIngredientIds`、`missionBest`、`inventory`、`starterGrantClaimedRecipeIds`、`unlockedForShopIngredientIds` | 変更なし（W1 id を known に含む） | W1 は schema を変えない |
| 11 | ladder | `src/data/discoveryLadder.ts` `DISCOVERY_LADDER = W1_25_DISCOVERY_LADDER`（24 step）、`src/state/materialEntitlement.ts` `resolveShopEntitlement`(:33) | **切り替えた**（15 → 25） | state model の UNKNOWN / KBMM の境界 |
| 12 | ingredient ownership / stock | `materialShopState`（`materialShop.ts:147`：OWNED / NEW / LOCKED）、`remainingStock`（`inventory.ts:40`）、`isRecipeAvailable` は**在庫を見ない**（`progression.ts:80`） | 変更なし | DISCOVERABLE は在庫 ≥ 1 を見る（在庫 0 は KBMM の OUT_OF_STOCK） |
| 13 | hints | `src/data/hints.ts` `FREE_COOK_DISCOVERY_HINT_LEVELS`(:38、Dex 0 だけ)、`RECIPE_HINTS`(:60、**6 件だけ**。W1 10 件は無い)、`SHOW_HINT` | 変更なし | W1 では変えない（I6）。guided を DISCOVERED だけにすれば RECIPE_HINTS は漏れにならない |
| 14 | EP1 関連 | `Recipe.unlockCondition`（旧 14 件）/ `mysteryLock`（fugazza）、`recipeUnlocked`、`unlockHintFor`、`recipesUnlockedByIngredient`、`starterStock.ts:124`、`economySimulation.ts` `EP_ERA_RECIPES` | `starterStock` と `economySimulation` が W1 を EP 対象外にした | W1-c |
| 15 | existing tests | unit 3224 件（pass）、e2e 16 file | I5b-3 で unit 38 file 変更。**e2e は未変更** | §7 |

---

## 2. 未発見 recipe の契約（25 recipe runtime で実現できるか）

### 2.1 5204a26 での実測（probe）

scratch の vitest probe で、I5b-3 の runtime module（`recipeCardState`、`recipesUnlockedByIngredient`、`resolveShopEntitlement`、`materialShopState`）を直接呼んだ。新規 save で margherita → ladder の key recipe の順に発見し、各 Dex で「入荷直後（未購入）A」と「購入後 B」を見た（★は全部 3）。結果は JSON の `stateDerivation.freshLadderWalk`。

| 漏れ | 件数（25 ladder） | 例 |
|---|---:|---|
| Pizza Select の NEW カード（名前 + `PizzaThumbnail`、guided CTA） | **18 / 24** の key recipe | funghi、melanzane-pizza、parmigiana-pizza、bambino、hawaiian、capricciosa、pizza-portuguesa、marinara、napoletana、tonno-e-cipolla、pesto-tonno、genovese、new-haven-apizza、pesto-caprese、pesto-patate、pizza-bianca、puttanesca-pizza、quattro-formaggi |
| Pizza Select の LOCKED カードの名前 | Dex 0 で **23 枚**（margherita と fugazza 以外） | W1 の LOCKED は名前だけで、理由の文言も無い |
| Dex 0 の margherita（`preDiscoveryLocked`） | 1 | 名前 + 見本（LK-4） |
| Shop の「これを買うと: 🍕 ○○」 | **16 / 24** の NEW 材料 | mushroom→フンギ、eggplant→メランザーネ、pineapple→ハワイアン、clam→ニューヘイブン … |

NEW にならない 6 件（bismarck、breakfast-pizza、pepperoni、salsiccia、meat-lovers、fugazza）は、EP1 chain / ★ がまだ閉じているだけで、★の取り方で変わる。Design §2 の「最大 18 件」は 25 recipe の実コードでもそのとおりだった。

### 2.2 契約ごとの判定

| 契約 | 5204a26 | 実現できるか | 必要な変更 |
|---|---|---|---|
| 名前を発見前に出さない | ✕（Pizza Select の NEW / LOCKED、Shop、ORDER の Teto の台詞） | **できる** | W1-a（Pizza Select は DISCOVERED だけ）、W1-b（Shop）、W1-a backstop（ORDER round を未発見で作らない） |
| 完成見本を発見前に出さない | ✕（NEW カード、Dex 0 の margherita、guided の見本 popover / mini thumbnail） | **できる** | W1-a（カードを出さない）。guided round 自体を DISCOVERED だけにすれば、`ReferencePreview` / `PlayerReferencePreview` / `RECIPE_HINTS` は触らなくてよい |
| Shop で具体的な recipe 名を教えない | ✕（LK-5） | **できる** | W1-b。`ShopOverlay` から `recipesUnlockedByIngredient` の呼び出しを外すだけ。関数と tests は残す |
| Pizza Select から discovery を迂回させない | ✕（`SELECT_RECIPE` と LK-8） | **できる。UI だけでは足りない** | ① `SELECT_RECIPE` は Dex の件数にかかわらず `isDiscovered` を要求する。② FREE の ORDER pool を「発見済み ∩ available」にする（`pickMissionOrder` と同じ規則）。③ 非 Mission の `BEGIN_PREPARE` も未発見 recipe では guided を始めない |

### 2.3 LK-8（新規）の詳細

```
Lunch Rush RESULT「フリープレイへ」 (MissionResultOverlay.tsx:106 onExit)
  → App.exitMissionToFree (App.tsx:551) → dispatch PLAY_AGAIN
  → gameReducer PLAY_AGAIN (:1184) → nextOrderState (:472)
  → getNextOrder (orders.ts:206): availableRecipeIds のうち「未発見」を優先 (:214)
  → screen は GAME のまま、phase = ORDER
     Teto:「<未発見の recipe 名>…」 (buildTetoOrderLine, dialogue.ts:30)
     [🍕 フリープレイ] → BEGIN_PREPARE → guided round（見本あり）
  → REGISTER_TO_DEX → registerScoreToDex(selected recipe) → wasNewDiscovery
```

- 類似の LK-8b: PREPARE / BAKE 中に HOME へ戻ると `PLAY_AGAIN` が同じ ORDER を作って state に残す。次に Lunch Rush の intro を「閉じる」と（`missionDispatch EXIT_TO_FREE` だけで `PLAY_AGAIN` しない）、残っていた ORDER が GAME に出る。
- 判定: コードの読解で確認（`PLAY_AGAIN` の実行と pool の優先は unit で既に固定されている: `orders.test.ts`）。実機での再現はしていない（docs-only の監査のため）。I5b-4 の reducer test で再現してから塞ぐこと。

---

## 3. State 派生の検証

### 3.1 定義（W1-a で `src/state/recipeDiscoveryState.ts` に置く想定）

入力は4つだけ: `dex`、`ownedIngredientIds`、`unlockedForShopIngredientIds`、`inventory`。**`unlockCondition` / `mysteryLock` / `totalStars` / `starterGrantClaimedRecipeIds` は読まない。**

| state | 規則 |
|---|---|
| `DISCOVERED` | `dex` の entry が `discovered` |
| `DISCOVERABLE` | 未発見で、必要な材料がすべて starter か、OWNED かつ `inventory ≥ 1`（Issue #215 OD-5: 各材料 1 個で発見になる） |
| `KNOWN_BUT_MISSING_MATERIAL` | 上のどれでもなく、有限の必要材料がすべて entitled（ledger か OWNED）。= NOT_BOUGHT か OUT_OF_STOCK |
| `UNKNOWN` | それ以外（entitled でない材料がある） |
| （一時）`NEWLY_DISCOVERED` | `state.justDiscovered && state.recipe.id`。既存のまま、保存しない |

優先: DISCOVERED > DISCOVERABLE > KBMM > UNKNOWN。

### 3.2 検証結果

| 検証 | 結果 |
|---|---|
| save schema を増やさずに派生できるか | **できる。** 4 入力はすべて `PersistentSaveV2` に既にある（`persistence.ts:114`）。新しい field も version bump も不要 |
| matcher と矛盾しないか | **しない。** `RECIPE_DISCOVERY_CATALOG` の `items` は `requiredIngredients` の集合そのもの（`discoveryCatalog.ts:53`）。25 件すべて ELIGIBLE、同じ signature の組は 0。DISCOVERABLE ⇔ Free Cooking の完全一致で発見できる |
| 新規 save の ladder walk | Dex 0〜25 の全段階で DISCOVERABLE ≤ 1、KBMM ≤ 1。A（入荷直後）では次の key recipe が KBMM、B（購入後）では DISCOVERABLE。Dex 25 は全部 DISCOVERED（JSON `freshLadderWalk`） |
| migration save（旧 15 件を発見済み、EP4 で旧材料を所持） | load 時の `resolveShopEntitlement` で eggplant / corn / pineapple が NEW（未購入）になる。state は DISCOVERED 15、**DISCOVERABLE 2**（pizza-portuguesa、pesto-tonno）、KBMM 4（melanzane、parmigiana、bambino、hawaiian）、UNKNOWN 4。現状の Pizza Select では DISCOVERABLE の 2 件が NEW カードで答えを見せる |
| EP1 に依存しないか | 派生関数は EP1 の field を読まない。I5b-4 の unit test で「`unlockCondition` を消した / 変えた RECIPES でも結果が同じ」を固定すること |
| 在庫 0 | `isRecipeAvailable` は在庫を見ないので、今の Pizza Select は在庫 0 でも NEW / COMPLETED にする。state model では OWNED で在庫 0 → KBMM（OUT_OF_STOCK）。Free Cooking の tray（在庫 0 は disabled）と一致する |
| 既存の関数との関係 | `recipeCardState` / `isRecipeAvailable` / `availableRecipeIds` は Lunch Rush と guided（DISCOVERED だけ）用に残す。Pizza Select / Dex / HOME / Shop の hint は新しい関数だけを使う |

**結論: 4 状態は既存 authority から純粋に派生できる。save impact 0、migration impact 0。**

---

## 4. W1-a〜g の mapping（I5b-3 後の実コード）

詳しい表（file / function / 現状 / 必要な挙動 / data / save / migration / test / 競合）は JSON の `w1`。ここでは要点だけ。

### W1-a: state model + Pizza Select A′

| file / function | 現状 | 必要な挙動 | 競合 |
|---|---|---|---|
| `src/state/recipeDiscoveryState.ts`（新規） | 無い | §3.1 の純関数と件数集計 | 低 |
| `pizzaSelect.ts:50` `recipeCardState` | EP1 + 所持で COMPLETED / NEW / LOCKED | DISCOVERED だけをカードにする。prompt カードの種類（Free Cooking / Shop / なし）を派生で返す | **高（I5b-4c）** |
| `PizzaSelectScreen.tsx:93-288` | 25 件を全部描く | DISCOVERED のカード + 匿名 prompt カード1枚 + 章の「発見 n/m」。Dex 0 は prompt カードだけ。props に `unlockedForShopIngredientIds` / `inventory` / `onOpenShop` を足す（`App.tsx:854`） | **高（I5b-4c）** |
| `gameReducer.ts:1199` `SELECT_RECIPE` | Dex ≥ 1 なら未発見でも可 | 未発見は常に拒否 | 中 |
| `gameReducer.ts:472` `nextOrderState` / `orders.ts:206` `getNextOrder` | 未発見を優先（LK-8） | FREE の pool = 発見済み ∩ available。空なら ORDER round を guided にしない（Dex 0 は今の preDiscovery gate と同じ扱い） | 中 |
| `gameReducer.ts:593` `BEGIN_PREPARE` | guard なし | 非 Mission で未発見なら no-op（LK-8b の保険） | 低 |

- data: 状態 model の4入力。save: なし。migration: なし（旧 save の NEW カード 2 件は prompt カード1枚に変わるだけ）。
- test: `pizzaSelect.test.ts`、`PizzaSelectScreen.test.tsx` は大半を書き直す。`w1Activation.test.tsx:110 / :154`（未発見の W1 recipe を `SELECT_RECIPE` で始める 10 + 10 ケース）は、recipe を発見済みで seed するように直す。`orders.test.ts` の「未発見を優先」ケースは意味が変わる。e2e の `startFreshMargherita`（`e2e/gestures.ts`）は margherita を発見済みで seed しているので**そのまま通る**。`progression2-p3-3-onboarding.spec.ts:65-80`（Dex 0 の margherita カード）は prompt カードに書き換える。

### W1-b: Shop から未発見 recipe 名を削除

| file / function | 現状 | 必要な挙動 |
|---|---|---|
| `ShopOverlay.tsx:84` `unlockedRecipeNames`、:231 / :285 行の文言、:132 / :181 購入後の文言 | `recipesUnlockedByIngredient` で recipe 名を出す | 名前を出さない。NEW 行は「🎨 新しいピザのヒントになるかも」（買うと DISCOVERABLE が増える材料だけ）。購入後は「📦 ○○を仕入れました！ 🎨 フリークッキングで使ってみよう」 |

- data: state model（仮に所持 + 在庫 1 にしたときの DISCOVERABLE 件数）。save / migration: なし。
- test: `ShopOverlay.test.tsx` に「recipe 名が 0 件」を足す。`progression.test.ts` の `recipesUnlockedByIngredient` の tests は関数ごと残す。
- 競合: **低**（I5b-4 の slice は Shop を触らない）。

### W1-c: EP1 を表示 / gate から外す（legacy data は残す）

| 対象 | W1 での扱い |
|---|---|
| `pizzaSelect.ts:29` `unlockHintFor`（「○○を1枚完成させると解禁」「あと★N」） | UI から呼ばない（LOCKED カードが無くなるため） |
| `progression.ts:57` `recipeUnlocked`、`:80` `isRecipeAvailable` | Lunch Rush（`lunchRush.ts:98` は発見済みに絞るので EP1 は実効なし）と guided の availability 用に残す |
| `progression.ts:106` `recipesUnlockedByIngredient` | Shop から外す。関数と tests は残す |
| `recipes.ts` の `unlockCondition` / `mysteryLock` | **変えない**（Post-W1 の cleanup） |
| `starterStock.ts:124`、`economySimulation.ts` `EP_ERA_RECIPES` | 変えない（legacy） |

- save / migration: なし（§5）。test: `pizzaSelect.test.ts` / `PizzaSelectScreen.test.tsx` の「解禁」assertion を、「EP1 の文言が 0 件」に置き換える。
- 競合: **高**（I5b-4c F-2a が同じ文言を「材料の軸」に書き換える予定。W1-a で LOCKED カードごと無くなるので、F-2a は W1-c に吸収される）。

### W1-d: Discovery Result の情報階層

| file / function | 現状 | 必要な挙動 |
|---|---|---|
| `ResultPanel.tsx:258-330`（score の分岐） | ★ / 点数 / 焼き加減 → 1行の NEW PIZZA banner → notice + 「ショップへ」→ Pitz | `lastDiscovery.kind === "NEW_DISCOVERY"` のときだけ並びを変える: stamp → 名前（2行 clamp）→「📖 ピザ図鑑に登録！ No.k（章 n/m）」→ ★・点数・Pitz（+50）を1行 → notice（2名 + ほか N種）→ CTA（入荷があれば primary = Shop、無ければ もう一度じゆうに作る）。既知 / guided は今のまま |
| `GameScreen.tsx:668`、`App.tsx` | RESULT から図鑑を開けない | `onOpenDex`（NEW の枠へスクロール）を渡す |

- data: `lastDiscovery`、`justDiscovered`、`lastMaterialUnlockNotice`（すべて一時、保存しない）、章の関数。save / migration: なし。
- test: `ResultPanel.test.tsx`、e2e `result-1screen-2.0.spec.ts`、`progression2-discovery-ladder.spec.ts` の notice / CTA の位置。**Human Verification 対象。**
- 競合: 中（I5b-4b の CTA bar in-flow の layout 契約の上に乗せる）。

### W1-e: HOME の骨格 + 派生 badge

| file / function | 現状 | 必要な挙動 |
|---|---|---|
| `HomeScreen.tsx:126-175`（CTA） | Dex 0 で DOM の順番が入れ替わる | 2+1 の骨格（I5b-4a がそのまま実装する） |
| `HomeScreen.tsx:187`（Shop カード） | 所持 Pitz だけ | `NEW n` = entitled かつ未所持の材料数（`materialShopState === "NEW"` の件数） |
| `HomeScreen.tsx:180`（図鑑カード）、:87（header pill） | 件数だけ。名前が「レシピ」「ピザ図鑑」「レシピ図鑑」で揺れる | `justDiscovered` の間 `NEW`。「ピザ図鑑」に揃える |
| `HomeScreen.tsx:105`（吹き出し） | Dex 0 / それ以外 の2文 | Dex 0 > 未購入の NEW 材料あり > DISCOVERABLE ≥ 1 > 既定、の順で1文 |

- data: `unlockedForShopIngredientIds`、`ownedIngredientIds`、`inventory`、`justDiscovered` を `App.tsx:836` から新しい props で渡す。save: なし。migration: load 時の ladder 解決で増えた入荷も、派生の badge で自動的に出る（Economy Audit §9 の「通知が無い」問題が解ける）。
- test: HOME の unit、e2e onboarding の吹き出しと CTA、I5b-5 の L-H / L-O。**Human Verification 対象。**
- 競合: **高**（I5b-4a と同じファイル・同じ DOM。I5b-4a の後に積む）。

### W1-f: Dex の未発見枠 / state tag / 章

| file / function | 現状 | 必要な挙動 |
|---|---|---|
| `DexOverlay.tsx:47-60` | `RECIPES` 順に 25 枠、未発見は `🔒 ？？？ まだ見ぬピザ` | 章ごとに並べる（「n/m」）。未発見は `？？？` + 🎨（DISCOVERABLE）/ 🏪（KBMM）のタグと小さな CTA。No. は章の中で固定。RESULT から開いたら NEW の枠へスクロール |
| `pizzaSelect.ts:102-150` `RECIPE_SECTION_BOUNDARIES` / `buildRecipeSections` | 位置で 7 / 8 / 8 / 2 | 章 = 「その recipe の材料のうち、一番遅く入荷する ladder step の price tier」（`DISCOVERY_LADDER` + `MATERIAL_PRICE_TIERS`）→ T1 / T2 / T3 = **6 / 9 / 10**。Pizza Select と Dex で同じ関数を使う |

- data: state model、ladder、price tier。save / migration: なし。
- test: `pizzaSelect.test.ts` の section tests を書き直す。DexOverlay の unit test は今 1 本も無いので新しく作る。
- 競合: 章の関数は **高**（I5b-4d。OD-PS-4 = 7 / 8 / 10 と OD-DISC-9 = 6 / 9 / 10 が食い違う）。Dex の枠は中。

### W1-g: 初回演出（optional、別扱い）

- 内容: Discovery Result の Teto の1行（Dex 1 のとき）、Shop のたまご行の coach mark、ランチラッシュ解放の toast。
- 規則: 発見数（= 1）と一時的な UI 状態だけから派生する。**「見た」flag を保存しない**（save impact 0 を守る）。
- 競合: 低。W1 の gate には含めない。I6 に回してもよい。

---

## 5. EP1 compatibility

| 問い | 答え | 根拠 |
|---|---|---|
| save compatibility を壊さないか | **壊さない** | EP1 の解放状態は save に無い（`PersistentSaveV2` に field が無い。`dex` から毎回派生）。`starterGrantClaimedRecipeIds` は EP4（退役済み）のもので、W1 の変更では触らない |
| runtime data を削除せずに済むか | **済む** | `unlockCondition` / `mysteryLock` は `recipes.ts` に残す。`recipeUnlocked` / `isRecipeAvailable` / `recipesUnlockedByIngredient` / `unlockHintFor` も関数として残せる（`unlockHintFor` は未使用になる） |
| W1 の display / gate だけから外せるか | **外せる** | EP1 を読む UI は Pizza Select（`recipeCardState` → `isRecipeAvailable` と `unlockHintFor`）と Shop（`recipesUnlockedByIngredient`）の2つだけ。W1-a / W1-b でどちらも state model に切り替わる。Lunch Rush は発見済みに絞るので EP1 は実効なし。matcher / Free Cooking は EP1 を読まない |
| 残るもの | `SELECT_RECIPE` の availability（`isRecipeAvailable`）は DISCOVERED だけに効く。A2（発見済み ⇒ unlocked、`progression.ts:57`）で常に true なので、実質は「材料を所持しているか」だけになる | |
| 注意 | `Ingredient.unlockCondition`（材料側）は EP1 とは別物。`isFiniteMaterial` と `obtainableIngredientIds` が使う。**触らない** | `materialEntitlement.ts:29 / :92` |

---

## 6. I5b-4 との競合と実装順

### 6.1 競合

| 場所 | Discovery 2.0（W1-*） | I5b-4 Audit の slice | 衝突 | 解決案 |
|---|---|---|---|---|
| `pizzaSelect.ts`、`PizzaSelectScreen.tsx` | W1-a、W1-c | I5b-4c（4状態、READY のシルエット、材料の軸の文言） | **高**。I5b-4c は READY（= DISCOVERABLE）を名前付きシルエットで出し、LOCKED で次の2 step の名前を出す（OD-PS-2 / 3）。Design は名前を出さない（OD-DISC-1 / 3） | **1つの slice にまとめる**。OD-DISC-1 / 3 が決まるまで着手しない |
| 章の境界 | W1-f（6 / 9 / 10） | I5b-4d（7 / 8 / 10） | **高**（OD-PS-4 と OD-DISC-9 が食い違う） | OD-DISC-9 で決める。どちらでも「章を決める関数」を1つにする |
| `HomeScreen.tsx`、`App.css` | W1-e（badge、吹き出し） | I5b-4a（2+1 骨格、「切る」） | **高**（同じ DOM） | I5b-4a を先に入れ、W1-e を上に積む |
| `ResultPanel.tsx`、`GameScreen.tsx`、`App.css` | W1-d | I5b-4b（CTA bar の in-flow、stage の flex） | 中 | I5b-4b を先に。W1-d は RESULT だけを触る |
| `gameReducer.ts`、`orders.ts` | W1-a の backstop | I6-a（hint、`SHOW_HINT`） | 低〜中 | 別の case なので行の衝突は小さい |
| `ShopOverlay.tsx`、`DexOverlay.tsx` | W1-b、W1-f | なし | 低 | いつでも |
| I5b-3 branch | — | — | I5b-3 はまだ open PR が無い。W1-* はすべて I5b-3 の後 | I5b-3 の merge を待つ |

### 6.2 I5b-4 の実装順（推奨）

| 順 | slice | 内容 | 依存 |
|---|---|---|---|
| 0 | 前提 | I5b-3 を merge する（CI を通す。§7.3 の e2e の問題を含む）。OD-DISC-1 / 3 / 5 / 9 を決める | — |
| 1 | **W1-a1** | `recipeDiscoveryState.ts`（純関数）と unit | 0 |
| 2 | **W1-a2** | reducer の backstop（`SELECT_RECIPE`、FREE の order pool、`BEGIN_PREPARE`）と fixture の修正 | 1 |
| 3 | **W1-b** | Shop の文言 | 1 |
| 4 | **W1-a3 + W1-c + 章の関数**（= I5b-4c + I5b-4d） | Pizza Select A′、EP1 文言を消す、章 | 1、2、OD-DISC-1 / 3 / 9 |
| 5 | I5b-4a → **W1-e** | HOME の骨格 → badge / 吹き出し | 1 |
| 6 | **W1-f** | Dex の章 / 枠 / タグ | 1、4 の章の関数 |
| 7 | I5b-4b → **W1-d** | Cooking の layout 契約 → Discovery Result | OD-DISC-6 |
| 8 | W1-g（任意） | 初回演出 | 5、7 |
| 9 | I5b-5 | 検証 | すべて |

1〜3 は UI の見た目が変わらない（Shop の1行を除く）ので、Human Verification は 3 と 4 以降に集中する。LK-7 / LK-8 を閉じるのは 2 + 3 + 4 で、ここまでを W1 の最小ラインにする。

---

## 7. Test plan

### 7.1 unit（Vitest）

| 対象 | assertion |
|---|---|
| state model | 25 recipe × Dex 0 / 1 / 5 / 15 / 24 / 25 × 入荷直後 / 購入後 で、JSON `freshLadderWalk` と同じ state と件数になる。migration save（Dex 15）で DISCOVERABLE 2 / KBMM 4。在庫 0 → KBMM。`unlockCondition` / `mysteryLock` を消した RECIPES でも結果が同じ |
| matcher との一致 | DISCOVERABLE の recipe はどれも、その材料の集合で `NEW_DISCOVERY` になる |
| reducer backstop | 未発見への `SELECT_RECIPE` は Dex の件数にかかわらず no-op。`PLAY_AGAIN` / `createInitialGameState` の ORDER は発見済みだけ。未発見の ORDER で `BEGIN_PREPARE` しても guided にならない。Lunch Rush →「フリープレイへ」の reducer 列で未発見の recipe が出ない（LK-8） |
| Pizza Select | どの Dex でも、未発見の recipe の名前 / thumbnail / EP1 文言が 0 件。prompt カードは 0 か 1 枚で、種類が state と一致する。Dex 0 は prompt カードだけ |
| Shop | NEW 行と購入後の feedback に recipe 名が 0 件 |
| HOME | Shop の `NEW n` = entitled かつ未所持の数。load 時の migration でも出る |
| Dex | 章の件数（OD-DISC-9 の決定どおり）。タグは DISCOVERABLE / KBMM の枠だけ |
| Result | NEW_DISCOVERY の並び順。既知 / guided は今と同じ |
| save | W1-a〜g のどれでも `PersistentSaveV2` の key と roundtrip が変わらない（I5b-5 R-11） |

### 7.2 e2e（Playwright、Chromium + WebKit）

- 未発見の名前 / 見本が Pizza Select・Shop・ORDER の吹き出しに 0 件（新規 save の Dex 0 → 1 → 2、migration save）。
- 新規 save: HOME → Free Cooking → margherita の Discovery Result → Shop（たまごの行に recipe 名なし）→ HOME（Shop `NEW 1`）→ Free Cooking → bismarck。
- Lunch Rush →「フリープレイへ」で、未発見の注文が出ない（LK-8）。
- I5b-5 の L-H / L-L / L-O（HOME の骨格、長い名前、2+1）はそのまま。

### 7.3 既存 tests への影響（書き換えが要るもの）

| file | 理由 |
|---|---|
| `src/state/pizzaSelect.test.ts`、`src/screens/PizzaSelectScreen.test.tsx` | NEW / LOCKED / `preDiscoveryLocked` / 「解禁」/ 章 |
| `src/state/w1Activation.test.tsx:110`、`:154` | 未発見の W1 recipe を `SELECT_RECIPE` で始めている → 発見済みで seed する |
| `src/data/orders.test.ts`、`gameReducer*.test.ts` のうち `PLAY_AGAIN` が未発見を選ぶ前提のもの | FREE の order pool の変更 |
| `src/App.test.tsx`、`App.materialEntitlement.test.tsx`、`App.fullGameReset.test.tsx`、`App.humanFeelFix3.test.tsx`、`App.playerReference.test.tsx` | Pizza Select のカード / badge / `preDiscoveryLocked` を使っている |
| `e2e/progression2-p3-3-onboarding.spec.ts:65-80` | Dex 0 の margherita カード → prompt カード |
| `e2e/progression2-discovery-ladder.spec.ts:188-236` | **I5b-3 の時点で既に古い**: 「step 14 で 3 種のチーズ」を期待しているが、25 ladder の step 14 は garlic。I5b-3 は e2e を変えていないので、I5b-3 の最初の e2e CI で赤くなる見込み（コードの読解。I5b-5 R-13 が置き換えを計画済み） |
| `e2e/gestures.ts` `startFreshMargherita` | 変更不要（margherita を発見済みで seed している。コメントの「napoletana」は古い記述） |

### 7.4 Human Verification

W1-a（Pizza Select）、W1-b（Shop の1行）、W1-d、W1-e、W1-f、W1-g は UI 変更なので `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` の対象。390×844 の動画はユーザーに直接渡し、before / after の screenshot は `docs/reports/screenshots/<task-name>/` に置く。W1-a1 / W1-a2 は UI が変わらないので対象外（reducer と純関数）。

---

## 8. Blockers

| 種類 | 内容 |
|---|---|
| 技術的な hard blocker | **なし** |
| gating（着手の条件） | (1) I5b-3 の merge（open PR なし、`5204a26` の CI なし。unit はローカルで 3224 / 3224 pass）。(2) OD-DISC-1（Pizza Select の役割）、OD-DISC-3（名前の公開時期）、OD-DISC-5（EP1）、OD-DISC-9（章）。I5b-4 の OD-PS-2 / 3 / 4 と食い違うので、どちらを採るかを先に決める |
| 既知のリスク | e2e `progression2-discovery-ladder` の 3 材料 notice（§7.3）。LK-8 は実機で再現していない（I5b-4 の reducer test で再現してから塞ぐ） |
| 後回し（W1 の gate ではない） | OD-DISC-6（Result の primary CTA）は W1-d の前、OD-DISC-7 / 8（おしい / hint）は I6 |

## 9. 判定

**READY（条件付き）**: I5b-3 の merge と OD-DISC-1 / 3 / 5 / 9 の決定の後、§6.2 の順で I5b-4 に入れる。W1 の最小ラインは W1-a（backstop を含む）+ W1-b + W1-c。

---

## 10. このレポートの範囲

- 追加したもの: 本ファイルと `docs/reports/data/TETO_PROGRESS2_W1_DISCOVERY_INTEGRATION-GATE_matrix.json`。
- 変更していないもの: `src/**`、`e2e/**`、CSS、runtime、tests、Playwright config、workflow、I5b-3 の branch。I5b-4 の branch は存在しない。
- probe と unit の実行は scratch の worktree（`5204a26` を detached で checkout）で行い、何も commit していない。
- PR は作っていない。merge もしていない。

STOP GATE: Integration Gate はここで終わり。
