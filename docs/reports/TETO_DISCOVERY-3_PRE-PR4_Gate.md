# Discovery 3.0 — Pre-PR4 Gate（25 → 26 の scratch dry-run）

- **日付:** 2026-10-01 / **base:** main `a0201e35`（PR-1 #322 `ae62bb6`、PR-2 #323 `500fca7`、PR-3 #324 `a0201e3` を含む）
- **方法:** main から使い捨ての worktree を作り、`brazilian-calabresa` を **placeholder 値**で足して実測した（recipes / discoveryCatalog / recipeSauceProfiles / recipeHintRoles（`{ keyFree: true }`）/ referencePizza（暫定の 7 点 ring）/ orders）。**どの branch にも commit していない。worktree と branch は破棄済み。production は無変更。**
- **placeholder の注意:** quantity（sauce 1 / sausage 2 / onion 2 / black-olive 2 / oregano 1）、bake 58–78、placement はすべて**仮**で、OD-D3-24 により production authority ではない。実測は「26 件目が入ると何が動くか」を見るためのもので、値の採用ではない。

## 結果

| 項目 | 結果 |
|---|---|
| A unit | **44 file / 140 test が失敗**（5342 pass）。`tsc -b` も 6 file で型エラー |
| B e2e | 5 spec を実行（chromium 系 390×844）: 4 spec が失敗（すべて `N/25` pin と `25` 件の枚挙）。ladder の spec（`progression2-discovery-ladder`）は **全 pass**。残りの spec は未実行（静的調査: Dex pill `N/25` は 7 spec） |
| C count pin | `25` を pin する unit: recipes / discoveryLadder（×2）/ recipeSauceProfiles / referencePizza.w1 / completionGate / economySimulation / efficiency / pizzaSelect / w1Activation / w1Reachability / w1LadderEconomy / largeCatalogFixtures / deductionGuard / deductionProduction.gate / hint5Taxonomy.gate / dinnerResultDetection / techniques.tq1c / scoringV2.noSauceParity / cookingProfiles / App / PizzaSelectScreen / Dex chapter（`第2章 x/9` → `x/10`）ほか。**意図的な pin なので数値を明示更新する（派生に弱めない）** |
| D step 12 pool = 2 | **成立**。step 12 で DISCOVERABLE = `[brazilian-calabresa, pizza-portuguesa]`。自動 target は calabresa（材料 5 種 < portuguesa 6 種） |
| E ladder lead = 0 | **成立**。calabresa 発見前後で `discoveredRecipeCount`（credit あり）= 12 → 12、reached step = 12 → 12。credit なしの raw count は 13（Dex 表示用） |
| F Shop entitlement | **不変**（発見前後の `resolveShopEntitlement` が一致） |
| G key-free Hint | `ヒント1: ソース` → `2: 構成（材料の数）` → `3〜6: サブトッピング①〜④の分類`（oregano / onion / sausage / black-olive）。**CHEESE rung なし、KEY_TOPPING なし、空 rung なし**（OD-D3-21） |
| H matcher collision | **0 件**（items + sauceBase の identity は 26 件で一意） |
| I Dex / chapter | recipe index 25（末尾追加で既存の番号は不変）。key step 12 → 第 2 章。章の件数 6 / 9 / 10 → **6 / 10 / 10** |
| J Lunch Rush | 候補は「発見済み ∩ 利用可能 ∩ 調理可能」。**発見前は不変、発見後に 13 件目として加わる**（`unlockCondition` なし）。ranking の ruleset は不変 |
| K Dinner | mission は target id を明示した定義なので**自動では候補に入らない**。影響は `dinnerResultDetection.test`（25 件 pin）のみ |
| L CUT / #295 | 下記 |
| M authoring の欠け | 下記 |
| N black-olive | 下記 |

## 失敗の分類（unit 44 file）

1. **純粋な 25 → 26 の count pin（機械的）**: 約 25 file。数値を更新するだけ。
2. **pool > 1 の挙動依存（設計判断を含む）**: 約 14 file — `hintTarget.test`（26 test）、`nearMiss.test`（13）、`DexOverlay.hint.test`（15）、`discoveryHint.test` / `discoveryHint.walk.test`（`SHOP_NEW` と `COMPLETE` の期待）、`hintSteps.test`、`selectableHint.test`、`persistence.*.test`（target が calabresa になる）、`discoveryHintEconomy.sim.test`（`expected [0,5,15,35,75] to include 10`）、`hint5Economy.sim.test`（3）、`recipeDiscoveryState.test`、`progression.test`。**sim の 2 本は key-free の価格表（SAUCE 10 / CHEESE 無し）を前提にしておらず、書き換えが必要。**
3. **key-free による型の拡張**: production table の型を `Record<RecipeId, HintRoles>` に広げると、`hintKeyToppingId` / `hintSubToppingOrder` を直接読む test 5 file（`HintSheet.hint5.test`、`hint5Ladder.test`、`hint5Production.gate.test`、`hint5Taxonomy.gate.test`）が型エラーになる。`hint5Ladder.test` の「最初の 4 rung が固定」、`hint5Production.gate` の rung 構成の仮定は、key-free で成立しない。
4. **この PR 群自身の不変条件**: `discoveryLadder.ladderCredit.test`（「production recipe は `ladderCredit` を持たない」「全 recipe が credit 対象」。calabresa が最初の `ladderCredit: false`）、`hint5Ladder.keyFree.test` の golden（RECIPES 全件を走査しているため 26 件目で不一致 → **25 件の id に固定する**必要がある）。

## 25 → 26 の移行範囲（production data）

`recipes.ts`（末尾に 1 件）/ `discoveryCatalog.ts` / `recipeSauceProfiles.ts` / `recipeHintRoles.ts`（型を union へ）/ `referencePizza.ts`（reference と `REFERENCE_PIZZAS` の登録。**型では強制されない**）/ `orders.ts`（台詞）/ `cookingProfiles.test.ts` の step 表（型で強制）。`cookingProfiles.ts` の CUT eligibility は OD-D3-22 により PR-4 の最後の別 commit（#295 次第）。

## M. quantity / bake / placement の未決（OD-D3-24）

- `minCount`（5 材料の量）、`bakeTarget`、**placement**（各 piece の位置、interaction、tolerance）、order の台詞、description、`baseRewardPitz`（既定 100 でよいか）、Lunch Rush / Dinner への出し方。
- inventory の pack 量 k は、量が既存の最大（sausage 3 / onion 4 / black-olive 2 / oregano 2）以下なら不変。**量を決めたら k を再確認する。**
- reference の piece 数は 8 slot の ring 以内に収める必要がある（placeholder は 7）。

## L. CUT / #295

- `CUT_ELIGIBLE_RECIPE_IDS`（`cookingProfiles.ts`）への追加は PR-4 の最後の 1 行。**#295（open、head `13d6836`）が変更するのは `cookingProfiles.ts` と `cookingProfiles.tabGate.test.ts` のみで、PR-4 のほかのファイルとは重ならない。** 衝突は CUT の 1 行に限られ、#295 の merge 後に rebase / merge すれば足りる。OD-D3-22 は「CUT 対象の方向」で、実装は PR-4 まで行わない。

## N. black-olive の不確実性

PIZZA DB の材料は「オリーブ」（色・品種の指定なし）。canonicalizer は `オリーブ → black-olive` を「confidence-flagged match, not exact」と記録している（OD-D3-18）。calabresa の identity は `black-olive` 前提で、portuguesa / capricciosa / pesto-tonno / puttanesca と食材を共有する。緑オリーブが別食材で入る将来は identity の再確認が要る。recipe の evidence comment と Result Report に明記する。

## 判断: PR-4 を 1 本にするか、4a / 4b に分けるか

**推奨: 4a / 4b に分割。**

- 失敗は 44 file / 140 test で、Gate の目安（10 file 超、または sim の書き換え）を**両方**超えた。sim 2 本の書き換えと、pool > 1 の期待値（hintTarget / nearMiss / Dex hint など約 14 file）は、recipe の追加と混ぜると review できない。
- **4a（test foundation、production 挙動の変更なし）:** pool > 1 と key-free を扱えるテスト基盤。count pin を「populations の注入」または明示の定数に整理し、25 件に固定すべき golden / 不変条件（`hint5Ladder.keyFree` の golden、`ladderCredit` の不変条件）を 25 件の id へ固定する。`HintRoles` の union 型に対する test の narrowing。sim を key-free / pool 2 に対応させる。recipe は足さない。
- **4b（recipe の追加、HV あり）:** calabresa（OD-D3-24 の確定値）、reference、order、26 件の pin の明示更新、e2e の `N/25` → `N/26`、CUT の 1 行（#295 次第）、HV。
- 4a は production の見え方が変わらないため HV なし。4b だけ HV（Dex の新しい「？？？」、step 12 の pool = 2、Shop の次の素材が加速しないこと、空 rung が出ないこと）。

## 限界

- e2e は 5 spec のみ実測（全 40 file ではない）。残りは静的調査。
- unit の失敗は placeholder 値での実測で、量 / bake / placement が変われば sim 系の失敗の中身は変わりうる（ただし pool = 2 に起因する失敗は変わらない）。
- scratch は main `a0201e3` 上。PR-4 の開始時に再実測する。
