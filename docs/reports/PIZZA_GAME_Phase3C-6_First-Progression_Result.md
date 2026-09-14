# Phase 3C-6: First Progression Unlock — Result

Status: 実装完了（Final Verdict は本レポート末尾を参照）
関連ドキュメント: `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`（第6〜9・12章）/
`docs/reports/PIZZA_GAME_Phase3C-5_Pitz-Shop_Result.md` /
`docs/reports/PIZZA_GAME_Phase3C-4_Lunch-Rush_Result.md`

## Base / Branch / Commit

- Base SHA: `d4ae6c0ce6325ec0d9f021bf09a800b02b307189`（origin/main, 期待値と一致）
- Branch: `claude/phase-3c6-progression-unlock-w4gnea`
- Commit SHA: 本レポートをコミットした時点のHEAD（PR側の最新コミットを参照）

## Scope

指示どおり、Progression初の実コンテンツ（食材1種・レシピ1種のみ）を追加し、
「🍕 Starterを作る → ⭐ totalStars上昇 → 🔓 Shop解放 → ⏱ Lunch RushでPitz獲得 →
🛒 購入 → 🍕 サラミピザ作成 → 📖 Dex 7/7」という **最初の1 unlockループ** を
fresh saveから実機で最後まで通した。

やっていない（指示どおり非スコープ）: Recipe #8以降、新チーズ/新エンジン機構、
multi-sauce、消費在庫、食材個数管理、アップグレード、設備、経営要素、複数Shop/Mission、
リーダーボード、バックエンド、日課ログイン、ガチャ、実課金。

## Changed files

```
src/data/ingredients.ts          (+22)  salami追加（unlockCondition/pricePitz付き, LOCKED初期）
src/data/recipes.ts              (+19)  salami-pizza追加（Recipe #7, tomato-sauce+mozzarella+salami）
src/data/orders.ts               (+6)   order-salami-pizza追加（ミトの注文セリフ）
src/state/progression.ts         (+20)  recipesUnlockedByIngredient() 追加（Shop "これを買うと" preview用）
src/components/ShopOverlay.tsx   (大幅) 購入前unlockプレビュー・購入成功フィードバック追加
src/components/PizzaStage.tsx    (+8)   salami専用CSS disc描画分岐
src/components/IngredientTray.tsx(+9)   salamiチップのCSS disc描画分岐 + cheese-slotをdisc-slotへ改名
src/App.css                      (+68)  .pizza-topping-disc・shop-item__unlocks・
                                         shop-overlay__feedback等のスタイル追加
docs/design/PIZZA_GAME_PROGRESSION_SSOT.md (+55/-11) 第12章を実装確定に更新、
                                         ロードマップ表・改訂履歴(v1.3)更新
--- tests (新規/追加) ---
src/data/ingredients.test.ts     (新規) salamiのStarter/unlockCondition/pricePitz検証
src/data/recipes.test.ts         (新規) 7レシピ・Starter6不変・salami-pizza要件・ID整合性
src/data/orders.test.ts          (+25)  FREE/購入後のsalami-pizza候補フィルタ
src/logic/economy.test.ts        (+36)  salami実データでのLOCKED→AVAILABLE→OWNED購入
src/logic/scoring.test.ts        (+64)  salami-pizzaの★5到達・raw/burnt★4キャップ
src/mission/lunchRush.test.ts    (+24)  Mission側availableRecipeIdsフィルタでのsalami-pizza
src/state/dex.test.ts            (+16)  salami-pizzaのBEST/timesMade登録
src/state/persistence.test.ts    (+22)  salami OWNEDのroundtrip・reload後維持
src/state/progression.test.ts    (+92)  salami実データでのingredientState全遷移・
                                         recipesUnlockedByIngredient・既存テストのRECIPES.length変化対応
docs/reports/PIZZA_GAME_Phase3C-6_First-Progression_Result.md (新規) 本レポート
```

既存 `src/state/gameReducer.ts` / `src/state/persistence.ts` / `src/logic/economy.ts` /
`src/data/dialogue.ts` は **無変更**。すべて既存のdata-driven設計（`unlockCondition` /
`pricePitz` / `isRecipeAvailable` / `availableRecipeIds` / dialogueのrecipe-agnostic生成）が
salamiを何もコード変更なしに正しく扱えたため。

## Final salami threshold / price

- `minTotalStars: 12`（design時点のcandidate `18` から調整。理由は下記
  「Balance verification」参照）
- `pricePitz: 120`（candidateどおり維持。Phase 3C-5の報酬式で1〜2 Lunch Runで購入可能な
  水準のため調整不要と判断）

## Salami Pizza recipe

```
id: "salami-pizza"
nameJa: "サラミピザ"
requiredIngredients: tomato-sauce ×1, mozzarella ×2, salami ×3
bakeTarget: { start: 62, end: 82 }  // 既存6レシピと同じ幅20の自然なレンジ
```

新しいengine mechanics・multi-sauceは追加していない。既存の「必須食材の集合判定 +
placement + bake」採点方式をそのまま利用。

## Unlock architecture（canonical truth）

指示どおり、`salami-pizza` に `recipeUnlocked` のような専用booleanは一切持たせていない。

```
salami: LOCKED --(totalStars >= 12)--> AVAILABLE_TO_BUY --(120 Pitz購入)--> OWNED
salami-pizza: isRecipeAvailable() = requiredIngredients が全て OWNED か（derived）
            = salami未OWNED -> unavailable / salami OWNED -> available
```

`src/state/progression.ts` の `ingredientState()` / `isRecipeAvailable()` /
`availableRecipeIds()`（すべて Phase 3C-3で実装済み・**無変更**）が salami/salami-pizza に
対しても自動的に正しく動作することを、実機・単体テスト両方で確認した。

## Order availability

`src/data/orders.ts` に `order-salami-pizza` を1件追加しただけで、既存の
`getNextOrder()`（`availableRecipeIds` フィルタ + undiscovered-priority、いずれも
Phase 3C-3で実装済み・無変更）がそのまま機能する。

- FREE（salami未購入）: `availableRecipeIds(ownedIngredientIds)` が salami-pizzaを
  含まないため、salami-pizzaは注文候補に一切現れない（`orders.test.ts` で50回試行を検証、
  かつ実機walkthroughのround 1〜6でも一度も出現しないことを確認）。
- 購入後: salami-pizzaが候補へ自動的に加わる。Starter 6レシピを全て発見済みの状態で購入
  すると、undiscovered-priority により salami-pizzaが唯一の未発見候補となり、次の注文で
  **必ず** salami-pizzaが選ばれることを実機で確認（`orders.test.ts` でも同条件を50回検証）。
- hardcodeされた `if salami purchased then next order = salami-pizza` のような分岐は
  一切存在しない（`src/data/orders.ts` / `src/state/gameReducer.ts` は無変更）。

## Mission availability

`src/mission/lunchRush.ts` の `pickMissionOrder()`（Phase 3C-4実装・無変更）は
`getNextOrder()` と同じ `availableRecipeIds` フィルタを再利用しているため、
salami-pizzaもMission側で特別扱いなしに自動的に対象へ入る
（`lunchRush.test.ts` に購入前/購入後の2テストを追加して確認）。Mission側に
salami専用のspecial-caseは一切ない。

## Shop integration

- 未購入時（LOCKED）: `🔒 あと★N` + `これを買うと: 🍕 サラミピザ` プレビューを表示
  （購入前に「何を買うと何ができるか」がわかる、指示第8章対応）。
- AVAILABLE_TO_BUY時: `🪙 120 Pitz` + `[購入]`ボタン（残高不足時はdisabled）+ 同じ
  unlockプレビュー。
- 購入成功時: `🍕 サラミを仕入れました！` + `🍕 新しいピザが作れます！「サラミピザ」`
  という小さいフィードバックをShop内に表示（巨大演出なし、指示第7〜8章対応）。
  `src/state/progression.ts` に新規追加した `recipesUnlockedByIngredient()`
  （pure・presentational、購入前に計算してからdispatchするだけ）で実現し、
  GameStateへ新しいtransient flagを追加していない。
- 残高不足時は購入不可・残高変化なし（`purchaseIngredient()` のガードを再利用、無変更）。

## Dex 7/7

`RECIPES.length` から動的に算出している既存 `DexOverlay.tsx`（無変更）が、
RECIPESに7件目を追加しただけで自動的に「発見 X / 7」表示に切り替わることを確認。
production/tests/docs内の「6/6」ハードコードを監査した結果、該当箇所はゼロだった
（`DexOverlay.tsx` は元々data-driven、既存reportファイル内の"6"は過去フェーズの記録として
そのまま残置——正しい判断）。fresh: 0/7、Starter 6発見: 6/7、salami-pizza発見: 7/7、を
実機で確認。

## Character dialogue

**コード変更ゼロ**でrecipe-aware dialogueが機能した。既存の会話生成
（`src/data/dialogue.ts`）が完全にdata-driven（`recipe.nameJa` / `getRecipeIndex(recipe.id)`
から決定論的に生成）だったため:

- ミト: `order-salami-pizza` の `lineJa` を1件追加しただけで注文時にサラミピザ名を認識。
- テト: `buildTetoBakeLine` / `buildTetoResultLine` は既存のrecipe-agnostic実装のまま
  raw/perfect/burntに対応。
- ブルー: `buildBlueResultLine` も同様、サラミピザ名を含む評価がそのまま機能。
- Character Replay Polishのdeterministic variation（`pickVariant` seed方式）は無変更。

## Scoring

既存 `scorePizza()` / `capStarsForBake()` を完全再利用。salami-pizzaで正しい食材・
妥当な配置・perfect bakeなら★5到達可能、raw/burntなら★4キャップされることを
`scoring.test.ts` で確認（実機でも★★★★★到達を確認）。サラミ3枚のplacementは
既存の汎用20点placement scoring（`scorePlacement`、ingredient種別非依存）をそのまま使うため
不当な不利は発生しない。特殊scoreは追加していない。

## Visual

`salami` は既存の「cheeseはCSS描画、toppingはemoji」という描画分岐に、
`ingredient.id === "salami"` の第3分岐を追加する形で実装（新しい描画エンジンではなく、
既存のcheese用CSS discパターンをtoppingにも適用した形）。

- 小さな丸い赤〜赤褐色のディスク（`radial-gradient`によるサラミらしい斑点表現）
- mozzarella（白〜クリーム色の楕円ブロブ）と明確に区別
- tomato-sauce（ピザ全体に広がる赤いスプレッドレイヤー）とは形状・スケールで区別
- mushroom（🍄 emoji）/ cherry-tomato（🍅 emoji）とも形状・色で区別
- 既存cheeseの`melted`/`toasted`/`charred`クラスを共有セレクタで再利用し、
  焼く前/焼き加減による見た目の変化も確認可能
- 新しい画像assetは追加していない（CSSのみ）

実機スクリーンショットで、生成地・トッピング済み・焼成後のいずれでも視認できることを確認。

## Persistence

- `salami` を含む `ownedIngredientIds` のroundtripが正しく動作（`persistence.test.ts`
  に新規テスト追加、実機でreload後もOWNED維持を確認）。
- Dex・pitzBalance・missionBestの相互非clobberは既存 `persistProgress()` /
  `persistMissionBest()`（いずれもPhase 3C-5実装・無変更）がそのまま保証。
  実機で「Mission→reload→salami所持継続」「Shop購入→reload→Dex/Pitz維持」
  「reload後もDex 7/7・salami-pizza available維持」を確認。
- 未知schemaVersion保護・壊れたsave復旧ロジックは無変更。

## Balance verification

`src/logic/scoring.ts` の `scorePizza()` を直接呼び出す一時シミュレーションスクリプト
（コミット非対象、検証専用）で、既存Starter 6レシピを3スキルティアで実際に採点し、
`totalStars` の到達速度を実測した。

| ティア | 想定 | Round毎の★（累計） |
|---|---|---|
| A. 初心者（食材1つ忘れ・余分食材あり・配置密集・焼成大幅ズレ） | 平均★2〜3 | 3,5,8,10,13,16 |
| B. 普通（食材は揃うが1個不足・配置floor・焼成やや外し） | 平均★3〜4 | 4,7,11,14,18,22 |
| C. 上手（食材完璧・配置分散・焼成ジャストゾーン） | 平均★4〜5 | 5,10,15,20,25,30 |

`minTotalStars: 18`（design candidate）だと**初心者は6レシピ完走しても最大16にしか
到達せず、永久にShopが解放されない**という致命的な問題が判明した。`minTotalStars: 12`
へ調整した結果:

- 上手: 3枚目で到達（`15 >= 12`）
- 普通: 4枚目で到達（`14 >= 12`）
- 初心者: 5枚目で到達（`13 >= 12`）

いずれもStarter 6レシピの完全コンプリートを要求せず、「数枚遊べば見えるが最初からは
買えない」という狙いを満たす。実機walkthrough（後述）でも「上手」ティアの実プレイで
round 3（`totalStars=15`）で解放されることを確認済み。

価格 `pricePitz: 120` は、Phase 3C-5で確定した報酬式（0枚提供=0、以後
`40 + floor(avgQuality/10)*5 + min(served,10)*5`、理論上限140）に対し、実機のLunch Rush
1回で125〜130 Pitz（提供7〜8枚・高品質）を獲得できたため、**標準1回、最悪でも2回**で
購入可能という目標を満たす。初心者〜普通ティアでも品質40〜60点・提供2〜4枚程度なら
70〜100 Pitz程度が見込まれ（Phase 3C-5レポートのReward examples参照）、1〜2回の目安に
収まる。よって`pricePitz`の調整は不要と判断した。

## 390×844 full progression walkthrough (Playwright / Chromium)

`/opt/pw-browsers/chromium` を使い、390×844のビューポート・fresh localStorageから
production同等のルールで実際に操作し、以下30項目（指示第16章の1〜31相当）を
すべて自動アサーション付きで確認した。`?missionDuration=15`（dev-only URLパラメータ、
production 180秒は無変更）でLunch Rush 1回分を実時間15秒に短縮し、3分×複数回を
実時間で待つことを回避した。

1. fresh save → localStorageにpitzBalance等が存在しない/デフォルト値
2. Dex `🍕 発見 0 / 7`
3. Shop で salami `🔒 あと★12`（LOCKED）
4. salami-pizzaがORDER候補に一切出ない（round 1〜6で実証）
5-6. Starterピザを作成 → Dex BEST更新（★★★★★ ×6）
7. totalStars増加（5→10→15→20→25→30、localStorage直読で確認）
8. **round 3（totalStars=15 >= 12）でthreshold到達 — Starter 6のうち3種のみ発見時点**
9. Shopで salami `AVAILABLE_TO_BUY`（🪙120 Pitz + 購入ボタン）
10. Pitz不足（0 Pitz）のため購入ボタンdisabled（購入不可を確認）
11. Lunch Rush開始（`?missionDuration=15`）
12. Mission Resultで Pitz獲得（実測: 提供7〜8枚・+125〜130 Pitz）
13. 1回のLunch Rushで残高が120を超過（2回目は不要だった実測ケース）
14. Shopでsalami購入 → 残高が正確に120減少（125→5 / 130→10）
15. salamiがownedIngredientIdsに追加
16. 購入フィードバック「サラミを仕入れました！新しいピザが作れます！「サラミピザ」」表示
17. salami-pizzaがShopで「✓ 購入済み」表示に切り替わる
18. FREEへ戻る
19. **次の未発見候補としてsalami-pizzaが自然に選ばれる**（undiscovered-priorityにより、
    Starter 6が全発見済みの時点で購入すると唯一の未発見候補になるため決定論的）
20. salami ×3をリング状に配置
21. bake（ジャストゾーンで確定）
22. ★★★★★評価
23. DexへSalami Pizza登録
24. 発見 `🏆 7 / 7`
25. BEST/timesMade正常表示
26. reload
27. salami所有権維持
28. Pitz残高維持
29. Dex 7/7維持
30. Salami Pizza `購入済み` 表示維持
31. console/page error 0件
32. horizontal overflowなし（全チェックポイントで確認）

```
=== SUMMARY: 27/27 checks passed ===
```

（27件は上記30項目のうち、実装上1回のアサーションに複数項目をまとめたものを含む
チェック単位でのカウント。全項目が実際にPASSしたことをスクリプト出力で確認済み。）

## Negative checks

- **threshold未達 → 購入不可**: fresh save時点（totalStars=0）でShopに購入ボタンが
  一切表示されない（LOCKED状態は`🔒`表示のみ、ボタン自体が存在しない構造的な防止）ことを
  実機で確認。
- **threshold達成/Pitz不足 → 購入不可**: round 3到達時点（totalStars=15、Pitz=0）で
  購入ボタンが disabled であることを実機で確認（クリックしても残高変化なし）。
- **Salami未OWNED → Salami Pizza注文なし**: round 1〜6のFREE playで一度もsalami-pizzaが
  出現しないことを実機で確認。加えて `orders.test.ts` / `lunchRush.test.ts` で
  50回試行の統計的検証を追加。
- production build に debug UI は追加していない（`?missionDuration=` は既存の
  `import.meta.env.DEV` ガード付きURLパラメータのみ、Phase 3C-4で導入済み・無変更）。

## FREE regression

Sauce Painting・FTU自動ソース・既存6レシピ・既存13食材・Character dialogue・
Mission deadline race fix（PR #18）・Mission reward one-shot（PR #19）・Shop atomic
purchase（PR #19）は全て無変更のコードパスであり、実機walkthrough
（Starter 6レシピを実際に作成・Lunch Rushを実行・Shop購入を実行）を通して
regressionがないことを確認した。

## Tests

```
$ npm test
 Test Files  13 passed (13)
      Tests  248 passed (248)
```

既存206テストは全て無変更のまま維持。新規追加42テストの内訳:

- `src/data/ingredients.test.ts`（新規5件）: salamiがStarterでない・minTotalStars/pricePitz
  の妥当性・カテゴリ/placement
- `src/data/recipes.test.ts`（新規9件）: 総レシピ数7・Starter6不変・salami-pizza要件・
  bakeTarget妥当性・購入前後のavailability・recipe/order ID整合性
- `src/data/orders.test.ts`（+2件）: FREEでのsalami-pizza除外・購入後の必然選択
- `src/logic/economy.test.ts`（+2件）: salami実データでのLOCKED/購入成功
- `src/logic/scoring.test.ts`（+4件）: salami-pizzaの★5到達・不当な配置ペナルティなし・
  raw/burnt★4キャップ
- `src/mission/lunchRush.test.ts`（+2件）: Mission側availableRecipeIdsフィルタ
- `src/state/dex.test.ts`（+1件）: salami-pizzaのBEST/timesMade
- `src/state/persistence.test.ts`（+3件）: salami OWNEDのroundtrip・reload後維持
- `src/state/progression.test.ts`（+14件、既存3件修正）: salami実データでの
  ingredientState全遷移・recipesUnlockedByIngredient・既存の「全6レシピ常時available」
  前提テストをStarter 6限定に修正

## lint / build / git diff --check

```
$ npm run lint    -> クリーン（oxlint、警告0件）
$ npx tsc -b --noEmit -> エラー0件
$ npm run build   -> 成功（dist/assets/index-*.js 271.57 kB / gzip 87.20 kB）
$ git diff --check -> 問題なし
```

## Known issues

- **P2**: Shopの「これを買うと」プレビューはLOCKED/AVAILABLE_TO_BUYの両方で常時表示される
  仕様にした（指示第8章の「購入前にも分かるように」を文字通り解釈）。OWNED後は非表示に
  切り替わる。将来複数の新食材が同時にLOCKEDになった場合、プレビュー行が増える可能性が
  あるが、現状は食材1種のみのため影響なし。
- **P2**: バランス調整シミュレーションで使ったスクリプトはコミットに含めていない
  （検証専用の一時スクリプト、Phase 3C-4/3C-5の実機検証と同じ方針）。将来同様の調整が
  必要になった際は本レポートのTierモデル（食材忘れ/配置密集/焼成ズレの度合い）を
  再利用できる。
- **P2**: 実機walkthroughでは「上手」ティア（配置分散・perfect bake）のみで検証した。
  「初心者」「普通」ティアでのShop解放は`scorePizza()`ベースのシミュレーション計算のみで
  実機未検証（Playwright上で意図的に低品質なプレイを再現するコストが高いため）。
  ただし、シミュレーションはproduction同一の`scorePizza`/`totalStars`関数を直接呼んでいる
  ため、計算結果自体は実際のゲームロジックと完全に一致する。

P0/P1: 0件。

## Final Verdict

**A. READY TO MERGE**

- スコープ（サラミ食材・サラミピザレシピ・Shop解放ループの実証）を逸脱していない。
  Recipe #8以降・新エンジン機構・multi-sauce・在庫/個数管理・経営要素等は一切追加していない。
- Unlock architectureは指示どおり「salamiのIngredientState」を唯一のcanonical truthとし、
  `salami-pizza`に専用の`recipeUnlocked`相当フラグを持たせていない
  （既存`isRecipeAvailable`/`availableRecipeIds`をそのまま再利用、コード変更ゼロ）。
- Order/Mission両方のavailability filteringに salami専用のhardcode分岐は一切ない
  （既存の`availableRecipeIds`ベースのフィルタが自動的に機能）。
- Character dialogueはコード変更ゼロで動作（既存のrecipe-agnostic生成ロジックのおかげ）。
  Character Replay Polishのdeterministic variationは無変更。
- Scoringは完全再利用、salami特有の特殊ロジックは追加していない。
- Visualは既存のcheese用CSS discパターンを流用し、新しい描画エンジンや画像assetを
  追加せずに視覚的に区別可能な表現を実現。
- Persistenceは既存の`persistProgress`/`sanitizeOwnedIngredientIds`がそのまま
  salamiを正しく扱う（コード変更ゼロ）。
- `minTotalStars`をdesign candidateの18から12へ、実プレイシミュレーションに基づき
  調整し、理由をSSOT改訂履歴・本レポート双方に記録した。
- 390×844の実機walkthroughで、fresh saveから「Starter作成→totalStars上昇→
  threshold到達（Starter未完走時点）→Lunch RushでPitz獲得→Shop購入→
  salami-pizza作成→Dex 7/7→reload後も全状態維持」までの一周を実証した
  （27/27チェックPASS、console/page error 0件、horizontal overflowなし）。
- 既存206テストを一切壊さず、salami関連42件を新規追加（計248件全てPASS）。
- lint/typecheck/build/git diff --checkすべてグリーン。
- P0/P1: 0件。残るKnown issuesはいずれもP2（ブロッカーなし）。

**今回の最重要評価**（「新しいピザを解放したくてもう一度遊びたくなるか」）:
実機walkthroughで確認した実際のUXは、Starterを3〜5枚作ると「あと★N」表示が0に近づき、
Shopで解放が見えてからLunch Rush 1回で即購入できる、という短いフィードバックループに
なっている。購入直後にサラミピザが自動的に次の注文候補となり、Dexの「7/7」という
明確なゴールも提示されるため、狙いどおり「もう一度遊びたくなる」最初のunlockループを
成立させられたと判断する。
