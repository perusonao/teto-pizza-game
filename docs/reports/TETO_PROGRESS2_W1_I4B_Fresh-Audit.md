# Progression 2.0 W1 Integration I4b: Fresh Audit と実装計画（STOP GATE）

- 種別: Fresh Audit と実装計画のみ。runtime（`src/**` の production code）は変更していない。PR も merge もしていない。
- 監査日: 2026-09-25。GitHub の実状態を取り直してから開始した。
- authority: REC-04 = RESOLVED（OD-REC04-1〜3、Owner Decision commit `6fe02e2d23610e926bab2367405fe9f717d25421`、branch `claude/rec-04-fresh-design-gz6em4`）。新しい Owner Decision は作らない。
- 参考資料: #205（`9035606`）。**参考にしただけで、merge はしない。** ⭐ による material unlock、60/100/140/180、「1枚 = 1回分」モデルは obsolete。

## 0. 状態

| 項目 | 値 |
|---|---|
| current main | `82fe7885c51cb7496ffa114f31be414abcf3d695`（Merge PR #222、I1） |
| I1 post-merge WebKit run 36113812904 | completed / **success**（head `82fe788`） |
| I1 Pages deploy run 36113812876 | completed / **success**（head `82fe788`） |
| I1 | **COMPLETE** |
| I4a implementation | `442aa7ede48ba775b82844030707352b9a444101`（base `46513b1`） |
| I4a integration | `6816d1760bd0aae88c3b0b32a46751ead59d4428`（`origin/main` 82fe788 を通常の merge commit で取り込み。rebase / force-push はしていない） |

### I4a の統合結果

- main に対する差分は I4a の5ファイルだけ（+932 行）。5ファイルの中身は `442aa7e` と完全に同じ。
- I0（`persistence.ts` の forward-compat extras）、I3（`IngredientGlyph`）、I2（`getReferenceSlots` / multi-ring）、I1（Completion Gate の partial quantity）は main 側のまま残っている。
- 検証:
  - focused: 76/76
  - full Vitest: 135 files / **2700 tests** pass（main の 2624 に I4a の 76 を足した数）
  - `tsc -b`、oxlint、`vite build` はすべて通った
- production runtime:
  - `src/**` のうち test 以外に、`discoveryLadder` を import しているファイルは0件（テストで確認）。
  - **`dist/` の16ファイルは、main `82fe788` の build と sha256 で完全に一致する。** runtime の差分はない。
- WebKit / Human Verification: 使われていない純粋関数を足しただけなので、実行していない。

## 1. 今の progression / economy の構成（main 82fe788）

| 軸 | 実装 | 役割 |
|---|---|---|
| recipe の解放（EP1） | `Recipe.unlockCondition = { requiresRecipeId, minTotalStars? }`、`recipeUnlocked()`（`src/state/progression.ts`） | Pizza Select（recipe-first）と Lunch Rush の出題候補を絞る。⭐ を使う |
| 材料の状態 | `ingredientState(ingredient, owned, totalStars)`: 所持していれば OWNED、`unlockCondition` が無ければ OWNED、⭐ が `minTotalStars` 以上なら AVAILABLE_TO_BUY、それ以外は LOCKED | Shop と `purchaseIngredient` |
| 材料の入手（EP4） | `applyStarterGrants()`（`src/state/starterStock.ts`）。EP1 で解放された recipe ごとに1回だけ、材料を OWNED にして `max(在庫, minCount×10)` を付与。台帳は `starterGrantClaimedRecipeIds` | 有限の19材料は**すべて** `starterGrantOnly`。Shop には補充しかない |
| 購入 | `purchaseIngredient`（`src/logic/economy.ts`）: LOCKED / ALREADY_OWNED / NOT_FOR_SALE（`starterGrantOnly` はすべてここ）/ INSUFFICIENT_FUNDS。在庫は付与しない | 今の production では、実質1件も成立しない |
| 補充（EP3） | `restockIngredient`: 所持済みで有限の材料に `+restockQuantity`（= 3×minCount）。価格は `pricePitz`（材料ごとの手入力で 55〜170） | Shop の OWNED 行 |
| 在庫 | `inventory: Record<id, number>`。単位は scatter なら個数、spread なら回数。有限かどうかは `unlockCondition` の有無で決まる。`CONFIRM_BAKE` の `consumePizzaInventory` で減る | Stock Gate（`hasStock` / `canPlaceIngredient`） |
| 発見 | recipe-first の登録（`REGISTER_TO_DEX`）、別 recipe との signature 一致（`registerDiscoveryToDex`）、Free Cooking（`resolveFreeCookPizza`） | **Free Cooking と signature 一致による発見は、EP1 の `recipeUnlocked` を見ない** |
| Pitz | FREE: `applyPitzCredit`（下限 20、初回発見 +50）と CT2 の Efficiency bonus。Lunch Rush: `calculateMissionReward` | REC-04 では変えない |
| Lunch Rush | `pickMissionOrder(availableRecipeIds ∩ discovered)`。Dex が変わる箇所は `MISSION_NEXT_ORDER` | 出題候補は発見済みの recipe だけなので、新しい発見は起きない |

材料データ（22件）:

- starter の3件（tomato-sauce / mozzarella / basil）は `unlockCondition` を持たない。無限で、常に OWNED。
- 残りの19件は `unlockCondition`（`minTotalStars` は 0。onion だけ 12 で、どちらも実質使われていない）、`pricePitz`、`restockQuantity`、`starterGrantOnly: true` を持つ。

### EP4 の現在の配線

`applyStarterGrants` を呼んでいるのは次の3箇所だけ。

1. `gameReducer` の `REGISTER_TO_DEX`（`src/state/gameReducer.ts:1114`）。Dex の更新と同じ遷移の中で呼ぶ。`lastStarterGrantNotice` を作る。
2. `gameReducer` の `MISSION_NEXT_ORDER`（`:1288`）。
3. `App.tsx` の load-time catch-up（`src/App.tsx:143`）。`createInitialGameState` の前に呼ぶ。

表示は `ResultPanel` の `starterGrantNotice`（`GameScreen.tsx:679` から渡す）。保存は `persistProgress` の snapshot にある `starterGrantClaimedRecipeIds`。

### 重大な発見: EP1 の recipe chain と Discovery Ladder が衝突する

- ladder の順番（bismarck → breakfast → funghi → pepperoni → …）と、EP1 の chain（margherita → funghi → marinara → bismarck → …、⭐ 最大36）は、まったく別の順番になっている。
- Free Cooking での発見は EP1 を見ないので、ladder 自体は詰まない。I4a のテストで確認済み。
- ただし、発見した recipe が EP1 の `recipeUnlocked` では false のままになる。その間は次の状態になる。
  - Pizza Select に LOCKED（「○○を1枚完成させると解禁」「あと★N」）と表示され、作り直せない。
  - `availableRecipeIds` から外れるので、Lunch Rush の出題候補にも入らない。
- ladder の順番どおりに発見した場合の件数（`recipes.ts` からの計算）:

| 毎回の品質 | 発見数 1〜15 のそれぞれで「発見済みなのに LOCKED」の件数 |
|---|---|
| ★1 | 0,1,2,2,3,4,5,6,5,6,7,8,9,9,**7** |
| ★3 | 0,1,2,2,3,3,4,5,4,4,3,2,1,1,0 |

★1 の player は、15件すべて発見した後も7件を作り直せない。I4b では何らかの対応が必要になる（§3 A2）。

## 2. 監査項目ごとの結論

| 項目 | 現状 | I4b への影響 |
|---|---|---|
| Dex の発見が確定する箇所 | Dex を書くのは `REGISTER_TO_DEX`（recipe-first、signature 一致、Free Cooking の MATCHED）と `MISSION_NEXT_ORDER` の2つの case だけ | ladder の解決はこの2箇所と load 時に置く。EP4 と同じ位置 |
| recipe の発見 event | 遷移ごとの `justDiscovered` と `lastDiscovery`。どちらも保存しない | NEW MATERIAL 通知も同じく保存しない transient な field にする |
| `ownedIngredientIds` | 保存する。starter は必ず入れ直す。一度入れた id は消さない。unknown id は I0 の extras に残る | 意味を「初回パックを買った材料（または旧 EP4 で付与された材料）」にする |
| `unlockedForShopIngredientIds` | **存在しない** | 新しい top-level field。schema bump なし（EP4 の台帳と同じやり方）。I0 の forward-compat に組み込む |
| inventory | 単位は個数 / 回数。unknown id は I0 で残る | 単位は変えない。パックで `10×k` を足すだけ |
| starter grant / EP4 | 上に書いた3箇所 | 3箇所とも止める。台帳は保存したまま carry-through する（rollback 用） |
| Shop の LOCKED / NEW / OWNED | `starterGrantOnly` かつ未所持の材料は Shop に出さない。LOCKED の文言は「あと★N」 | ⭐ を使わない、entitlement による3状態にする |
| Shop の購入処理 | `PURCHASE_INGREDIENT` → `purchaseIngredient`（在庫なし）、`RESTOCK_INGREDIENT` → `restockIngredient` | 同じ action を使い、純関数の中身を初回パック / 補充に替える |
| Pitz 残高と支払い | reducer の1遷移の中で原子的に処理。不足なら INSUFFICIENT_FUNDS | 金額だけ tier 価格に替える |
| Full Game Reset | `resetSave()` が save key ごと削除して reload する（`App.tsx:704`） | 新しい field は save の中にあるので、自動で消える。追加の作業はない |
| persistence / writeSave | `persistProgress` の snapshot を丸ごと書く。`writeSave` は extras と merge してから書く | snapshot、`KNOWN_SAVE_KEYS`、`ForwardCompatExtras`、sanitize に新しい field を足す |
| onboarding | Dex 0 では Margherita だけが作れる。発見前は Pizza Select のカードが `preDiscoveryLocked` になり、Free Cooking へ誘導される | 変えない。Margherita の発見で ≥70 Pitz（下限20 + 初回50）入り、step 1 の egg（60）を買える |
| Lunch Rush | 出題候補は「作れる recipe ∩ 発見済み」。Dex を書き換えるのは timesMade / BEST だけで、新しい発見は起きない | ladder は進まない。A2 の変更で、発見済みの recipe は出題候補に入るようになる。在庫0の recipe が出題される既存の課題（#213）はこの slice の範囲外 |

## 3. I4b の実装計画（最小）

新しい材料（W1 の7材料）と新しい recipe（W1 の10件）は追加しない。今の15 recipe / 22 材料だけで配線を完成させる。

| # | 内容 | 変更（予定） |
|---|---|---|
| **A. ladder から shop entitlement へ** | `resolveMaterialUnlocks({ ladder: DISCOVERY_LADDER, discoveredCount: discoveredRecipeCount(dex), alreadyUnlockedMaterialIds })` を、`REGISTER_TO_DEX` / `MISSION_NEXT_ORDER` / load 時に呼ぶ。`GameState.unlockedForShopIngredientIds` を追加する | `gameReducer.ts`、`App.tsx` |
| **A2. 発見済みの recipe は作り直せる** | `recipeUnlocked(recipe, dex)` を、発見済みなら true にする（追加だけの変更）。EP1 の chain は、未発見の recipe の recipe-first 誘導にだけ残す。§1 の衝突を解消する最小の変更 | `progression.ts` |
| **B. 発見時の NEW MATERIAL 判定** | `newlyUnlockedMaterialIds` から、transient な `lastMaterialUnlockNotice` を作る。`lastStarterGrantNotice` と同じく、新しいラウンドで null に戻し、保存しない | `gameReducer.ts`、`ResultPanel.tsx`、`GameScreen.tsx` |
| **C. EP4 の starter grant を止める** | 3箇所の `applyStarterGrants` 呼び出しを外す。`starterGrantClaimedRecipeIds` は読み込んで、そのまま保存し続ける（旧 build に rollback しても二重に付与しないため）。`starterStock.ts` は残すが、runtime からは呼ばない | `gameReducer.ts`、`App.tsx` |
| **D. 解放時の在庫は 0** | entitlement に入れるだけで、`inventory` と `ownedIngredientIds` には触らない | A と同じ |
| **E. パックの量** | 純関数 `packQuantity(ingredient) = 10 × k`。k は `RECIPES` の中でのその材料の最大 minCount（データから計算し、手入力の表は作らない）。今の値: sauce 系は 10、ham / egg は 10、onion / pepperoni は 40、mushroom などは 30、oregano などは 20 | 新規 `src/logic/materialShop.ts`（仮） |
| **F. 初回パックと補充の価格** | tier は、`DISCOVERY_LADDER` でのその材料の step から決める（step 1〜5 は T1 = 60 / 30、6〜14 は T2 = 80 / 40、15〜29 は T3 = 100 / 50、30 以上は T4 = 120 / 60）。ladder に無い材料は NOT_FOR_SALE。補充の量は初回パックと同じ `10×k` | 同上、`economy.ts` |
| **G. Shop の LOCKED / NEW / OWNED** | OWNED = 所持済みで補充できる。NEW = entitlement にあって未所持（「NEW 入荷」、例「🍕ピザ10枚分（30個） 🪙60」）。LOCKED = どちらでもない。LOCKED の行は今と同じく出さず、「あと1つ発見で入荷」の1行だけ出す。⭐ の文言はすべてやめる | `ShopOverlay.tsx`、`progression.ts`（`ingredientState` の置き換え） |
| **H. save と persistence** | `unlockedForShopIngredientIds: string[]` を追加する。known id は検証し、unknown id は I0 の extras で残す。starter は入れない。snapshot と no-op 判定にも足す。**unknown id を捨てる経路を作らない** | `persistence.ts` |
| **I. Full Game Reset** | コードの変更なし。reset 後の初期状態（entitlement が空）をテストで確認する | テストのみ |
| **J. onboarding との互換** | starter の3件と Margherita だけの開始状態は変えない。最初の発見で egg が NEW になるまでを、E2E と HV で確認する | テストと HV |
| **K. 既存 save の移行** | 下の「移行の方針」を参照 | `App.tsx`、`persistence.ts` |

### 移行の方針（K）

load 時の entitlement は次の union にする。

```
所持済みの有限材料 ∪ 保存済みの unlockedForShopIngredientIds ∪ ladder(発見数)
```

- EP4 で付与された材料と在庫は、そのまま残す（OWNED、在庫もそのまま）。以後の補充は新しい価格と量になる。
- ladder で届いていて未所持の材料は NEW になる（在庫 0）。
- 例: 発見数 5 の旧 player は、egg / bacon / mushroom / pepperoni / sausage のうち、未所持のものが NEW になる。
- EP1 で解放済みなのに付与されていない recipe（EP4 より前の save）は、もう付与しない。材料は ladder から入荷する。
- rollback:
  - 旧 build は新しい top-level field を I0 のしくみで残す。
  - 旧 build は台帳を読んで付与を再開するが、台帳に記録済みの recipe には付与しない。
  - もう一度この build に戻ると、union なので何も戻らない。
- 保存単位と Pitz は変えない。個数 / 回数の単位移行はしない。

### I4b で変更するファイルの候補

- production:
  - `src/state/gameReducer.ts`
  - `src/state/progression.ts`
  - `src/logic/economy.ts`（または新規 `src/logic/materialShop.ts`）
  - `src/state/persistence.ts`
  - `src/App.tsx`
  - `src/components/ShopOverlay.tsx`
  - `src/components/ResultPanel.tsx`
  - `src/screens/GameScreen.tsx`
  - `src/data/ingredients.ts`（doc の更新のみ。`pricePitz` / `restockQuantity` / `starterGrantOnly` は runtime から読まれなくなる。削除は後の slice）
- 変更しないもの: `src/state/starterStock.ts`（呼ばれなくなるだけ）、`src/state/pizzaSelect.ts`（A2 の副作用を確認するだけ）
- 更新が見込まれる test:
  - `economy.test.ts`、`gameReducer.restock.test.ts`、`gameReducer.test.ts`、`starterStock.test.ts`（EP4 の配線を前提にした部分）
  - `progression.test.ts`、`persistence*.test.ts`
  - `App.test.tsx`、`App.inventoryOverlay.test.tsx`、`App.fullGameReset.test.tsx`
  - `economySimulation.test.ts`、`data/ingredients.test.ts`
- 確認が見込まれる e2e（どれも所持材料を明示的に seed しているので、動くと想定。I4b で確認する）:
  - `e2e/gestures.ts`、`free-cooking-phase3-2.spec.ts`、`dynamic-cooking-steps.spec.ts`、`save-forward-compat-3-4b.spec.ts`

## 4. Human Verification が必要になる点

`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` の対象。390×844 の動画はユーザーに直接渡し、before / after の screenshot は `docs/reports/screenshots/<task>/` に置く。

1. 新規 save: Margherita を発見 → 「🆕 たまご が入荷！」の通知 → Shop へ → NEW 行（「🍕ピザ10枚分（10個） 🪙60」）→ 購入 → Free Cooking で Bismarck を発見 → 次の NEW
2. Shop の3状態（OWNED の補充 / NEW / LOCKED のヒント）、Pitz 不足、購入と補充のフィードバック
3. Pizza Select: 発見済みの recipe が作り直せる（A2）。未発見の recipe の EP1 誘導は今と同じ
4. 既存 save（EP4 の付与あり）の読み込み: OWNED と在庫がそのまま残り、NEW が出る
5. Lunch Rush が今と同じように動く（開始、出題、報酬）
6. Full Game Reset の後に onboarding が今と同じに戻る

## 5. blockers と未解決の Owner Decision

- **blocker: なし。** I4b は REC-04 の決定だけで実装できる。
- **新しい Owner Decision: 必須のものはない。**
- 実装時の判断として記録するもの（REC-04 の範囲内で、既定値として採用する。owner が異議を出した場合だけ見直す）:
  1. **A2（発見済み ⇒ `recipeUnlocked`）。** OD-REC04-2 の導線（入荷 → 購入 → Free Cooking）と、#198 の「発見は Free Cooking で行う」から導かれる整合のための修正。未発見の recipe に対する EP1 の chain を撤去するかどうかは product 判断なので、I4b では撤去しない。
  2. **LOCKED 行は出さない。** 「あと1つ発見で入荷」の1行だけ出す（材料名を先に見せない）。表示の細部なので HV で確認する。
- W1 へ持ち越すもの（I4b の blocker ではない）:
  - tier を ladder から求めると、25 recipe の ladder で既存材料の tier が変わる（例: tuna は T2 → T3、parmigiano は T2 → T1）。REC-04 §10 は「tier を変えない」を PROPOSED としている。W1 の data slice で、tier を固定するかどうかを決める。
  - ham の k を 1 → 3 にする（REC-04 `hamKChangeForW1`、PROPOSED）。
  - 在庫を考慮した Lunch Rush の出題候補（#213）。

## 6. 推奨する実装 slice

各 slice を独立 commit にし、それぞれ focused test、full Vitest、tsc、lint、build を通す。

1. **I4b-1 純関数（配線なし）:** `packQuantity`、`materialTier` / `packPrice` / `refillPrice`、`shopIngredientState(owned, entitled)`、`purchaseFirstPack` / `refillPack`。production bundle が変わらないことを確認する。
2. **I4b-2 persistence:** `unlockedForShopIngredientIds` の sanitize、I0 extras、snapshot、forward-compat と rollback の test。まだ配線しない。
3. **I4b-3 reducer の配線:** entitlement の解決（A / D）、A2、EP4 の停止（C）、購入と補充の置き換え（E / F）、`lastMaterialUnlockNotice`（B のデータ部分）、load 時の移行（K）。既存 test の更新はこの slice で行う。
4. **I4b-4 UI:** Shop の3状態（G）、NEW MATERIAL 通知と Shop への導線（B の UI）、⭐ の文言の撤去。
5. **I4b-5 検証:** Chromium と WebKit の E2E、Human Verification（§4）、Result report。そのうえで PR を作り、merge は owner の判断を待つ。
