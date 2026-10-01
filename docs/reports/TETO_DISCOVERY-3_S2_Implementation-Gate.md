# Discovery 3.0 S2 — Implementation Gate

- **種別:** 実装前の gate（docs のみ）。production は変更していない。brazilian-calabresa はまだ production に無い。
- **latest main:** `5c8190ff8e0e094baab6e563e06e1a11c16c4a57`（2026-10-01、fetch し直して確認。S1 以降 drift なし）。
- **前提の決定:** `docs/decisions/TETO_DISCOVERY-3_OWNER-DECISIONS.md` 末尾「Decisions confirmed after the S1 review」（OD-D3-15 / 16 / 17 / 18 / 19 / 20 を確定）。
- **結論:** S2 を **1 つの PR にしない**。4 本に分ける（§12）。**最初の実装 PR は「oracle の無効化」（PR-1）**。brazilian-calabresa を足す PR-4 は、PR-1〜3 の後（**今は NO-GO**）。PR-1 と PR-2 は今すぐ始められる。

## 1. Fresh Gate

| 対象 | 状態 |
|---|---|
| `origin/main` | `5c8190f`（変更なし）。audit branch は main + docs commit のみ（`src` / `e2e` / CI の差分 0） |
| PR #295（Cooking Steps 設計 + CS-1a） | open、head `13d6836`、base `86b48fd`（古い）。更新なし。`src/data/cookingProfiles.ts` を変更中 |
| PR #319（LC-R6-b） | open、`clean`、head `c5d2da7`、base `6abddc7`。`handPolicy.ts` / `PreviewBadge.tsx` / `lcHandPreview.ts` のみ |
| PR #321（Dough Guide Leak Fix） | open、`clean`、head `d7fc86a`、base = 現在の main。`PizzaStage.tsx` のみ |
| 追記 | この Gate では **production source を一切編集していない**。「26 件を足したら何が落ちるか」の dry-run は、変更権限の確認が通らなかったので行っていない（§8 は静的な調査）。実装 PR の開始時に実測できる |

**S2 の変更ファイルと open PR の衝突:**

| open PR | 触るファイル | PR-1〜4 との重なり |
|---|---|---|
| #295 | `cookingProfiles.ts`（tab gate）、`GameScreen.tsx`（postBakeView）、docs | PR-4 が `cookingProfiles.ts` の `CUT_ELIGIBLE_RECIPE_IDS` に 1 行足すなら**同じファイル**（別の箇所。textual 衝突の可能性は低いが実在）。PR-1 は `GameScreen.tsx` の RESULT 周りに触れる可能性があり、#295 の `GameScreen.tsx` 変更と**近接** |
| #319 | `handPolicy.ts` ほか | なし |
| #321 | `PizzaStage.tsx` | なし |

## 2. 確定した決定の反映（実装への含意）

| 決定 | 実装への含意 |
|---|---|
| OD-D3-17 O3 | `Recipe` の authoritative data に「ladder の count を進めるか」を持たせる。calabresa = 進めない。**最小の変更**（§4） |
| OD-D3-18 | id `brazilian-calabresa`、表示名「ブラジリアン・カラブレーザ」、`black-olive` を使用、新 olive 食材は作らない。evidence の確度を recipe の evidence に明記（§6, §7） |
| OD-D3-19 A | 既存 25 件の Hint 5.0 は不変。新 recipe は key-free の authority。`hintKeyIngredientId` には触れない。**空の rung を出さない**（§5） |
| OD-D3-20 | 「構成が正解」を無料で知らせない。Discovery の成立条件は変更しない。「低品質でも登録」は採用しない（§3） |
| OD-D3-15 / 16 | hard 閾値なし。3 区分（DIRECT_ANSWER / USEFUL_INFERENCE / TOO_BROAD）で計測可能にするだけ。32 / 128 を採用しない。Mastermind 型 feedback は新設計で禁止 |

## 3. oracle fix を S2 より先に分離すべきか — **先行させる（PR-1）**

**判断: 先行させる。** 理由は 3 つ。

1. **oracle は今の production に既にある**（25 件で再現済み）。calabresa とは無関係に直す価値がある。
2. **calabresa は oracle の対象を 1 件増やし、pool = 2 でさらに使いやすくする**（2 つの未知レシピの正誤を、品質の低い安い試作で確かめられる）。
3. **修正は S2 と別の領域**（RESULT の表示、near-miss、Notebook の記録）で、混ぜると 1 つの PR が巨大になり、HV の対象も混ざる。

### 3.1 S1 で再現した「正誤が分かる経路」は 3 つある

S1 の観測データ（`TETO_DISCOVERY-3_S1_ORACLE.json`）を見直すと、**文言以外にも漏れている**。lead の文言だけを直しても oracle は残る。

| 経路 | 構成が recipe と完全一致して gate で落ちたとき | 誤った構成のとき |
|---|---|---|
| (1) lead の文言 | 「図鑑のピザまであと少し…」 | 「図鑑にはまだ載っていないピザ！」 |
| (2) near/far の行 | **出ない**（`classifyNearMiss` は d = 0 で `null`。INCOMPLETE は「行なし」と定義されている） | 必ず出る（「あと1つ…」「別の組み合わせも…」など） |
| (3) Notebook | **記録されない**（再試行しても「試作#n」の通知が出ない。OD-P3-16） | 記録され、再試行で通知が出る |

→ **(1) だけを中立にしても、(2) 行の欠落と (3) 通知の欠落が同じ情報を漏らす。**（S1 の K1 と K2 の観測値で確認できる: K1 は near/far = なし・通知なし、K2 は両方あり。）

### 3.2 PR-1 の最小境界（oracle の無効化）

INCOMPLETE_MATCH を、**プレイヤーから見て通常の ORIGINAL と区別できないもの**にする。Discovery の成立条件（`resolveFreeCookPizza`、Completion Gate）は**変更しない**。

| 変更 | 内容 |
|---|---|
| (1) lead | `ORIGINAL_LEAD_COPY.INCOMPLETE_MATCH` を中立の文言（`NEUTRAL_LEAD`）にする |
| (2) near/far の行 | INCOMPLETE のとき、**一致した recipe を候補から除いて**近さを計算する（通常の ORIGINAL と同じ入力形になる）。結果が無ければ通常の ORIGINAL と同じ generic の行 |
| (3) Notebook | INCOMPLETE も記録の対象にする（`isTrialRecordEligible`）。**これは OD-P3-16 の変更**（INCOMPLETE を記録しない、という決定の反転）。Owner の確認が要る（OD-D3-23） |
| (4) 実行の助言（任意だが推奨） | recipe と**独立**した助言を足す。例: **自分の pizza のソースが薄い**（全 recipe 共通の理想値に対する量・範囲が `SAUCE_MIN_RATIO` 未満）ときに「ソースが薄いかも」。全 recipe の reference は同じ理想 fixture から作られている（`computeMechanicalSauceReference`）ので、**識別と無関係な共通の基準で判定できる**。構成が正しくても誤っていても、ソースが薄ければ同じように出る |
| (5) 焼きの窓 | recipe 固有の焼きの窓の外（かつ汎用の窓の内）で INCOMPLETE になる経路は、**助言を出さない**（recipe 固有の窓を使うと識別性が漏れる）。結果は中立の ORIGINAL になる。**実行の助言が無い代わりに、構成が正しいのに登録されない失敗が残る**（OD-D3-23 で Owner 確認） |

**触るファイル（想定）:** `src/state/originalResultCopy.ts`、`src/state/resultNearMiss.ts`、`src/state/trialRecord.ts`、`src/components/ResultPanel.tsx`（助言の行）、`src/screens/GameScreen.tsx`（relay が要るなら）、`src/App.css`（1 ルール）、新規の pure（自分の pizza → 助言。例 `src/state/executionAdvice.ts`）。

**既存テストの更新（想定）:** `originalResultCopy.test`、`resultNearMiss.test` / `.p2.test`、`trialRecord.test` / `.gate.test`、`gameReducer.trialNotebook.test`、`gameReducer.freeCook.test`、`ResultPanel.test` / `.p2.test` / `.nearMiss.test` / `.duplicateNotice.test`、`GameScreen.duplicateNotice.test`、`FreeCook.ui.test`、e2e `discovery-near-miss-result.spec`（INCOMPLETE の文言）、`original-result-duplicate-notice.spec`（INCOMPLETE の通知が出ない、という期待の反転）。新規テスト: **「INCOMPLETE と通常 ORIGINAL の DOM が（助言の有無を除き）byte 単位で同じ」**の性質テスト、助言が識別と無関係であることのテスト（構成の正誤を変えても助言が同じ）。

**HV: 必要**（RESULT の見え方が変わる）。390×844 の動画（正しい構成 + ソースが薄い、誤った構成 + ソースが薄い → 2 つの結果が区別できない）と before / after のスクリーンショット。

## 4. OD-D3-17 O3 の最小 implementation boundary（PR-2）

**現状（実コードで確認）:** ladder の count の入力は `discoveredRecipeCount(dex)` ただ 1 つで、呼び出しは **2 箇所だけ**（`src/state/materialEntitlement.ts:41`、`src/components/ShopOverlay.tsx:104`）。他の「発見数」（Dex の表示、hint の onboarding など）は別の計算で、ladder とは独立。

**最小の変更:**

| 場所 | 変更 |
|---|---|
| `src/data/recipes.ts` | `Recipe` に任意の `ladderCredit?: false`（**省略 = 数える**）。production の 25 件は無変更（フィールドを足さない） |
| `src/data/recipes.ts`（または小さな helper） | `countsTowardLadder(recipeId): boolean`。`RECIPES` に無い id、`ladderCredit` が無い id は true（**既存 save・未知 id の挙動を変えない**） |
| `src/logic/discoveryLadder.ts` | `discoveredRecipeCount(dex, counts = () => true)` のように述語を任意引数で受ける（既定は現状と同じ）。ladder の純関数（`reachedStepNumber` など）は**無変更** |
| 呼び出し 2 箇所 | 述語に `countsTowardLadder` を渡す |

**変更しないもの:** `W1_25_DISCOVERY_LADDER`、`DISCOVERY_LADDER`、`validateLadderProgression`（認識する makeable の集合は変えない）、save schema（count は Dex から導出され、保存されない）、Shop / entitlement の union（再ロックなし）。**汎用の progression framework は作らない**（フィールド 1 つと述語 1 つ）。

**テスト:** 合成 recipe（`ladderCredit: false`）で、(a) 発見しても count が進まない、(b) 既存 25 件で結果が不変（全 save 形式で `discoveredRecipeCount` が従来と一致する性質テスト）、(c) 述語を渡さない呼び出しが従来どおり、(d) `materialEntitlement` / `ShopOverlay` の次の素材ヒントが O3 に従う。**production の見え方は変わらない**（`ladderCredit: false` の recipe が production に無いため）ので、HV は不要（内部変更の免除に該当）。

**S1 の測定との整合:** O3 で lead = 0、pool は発見後に 1 へ戻る。

## 5. 新 recipe 用 key-free Hint schema の最小 boundary（PR-3）

**現状（実コードで確認）:**

- `buildHint5Ladder(recipeId, recipes, roles)` は**固定の 4 rung**（SAUCE, CHEESE, KEY_TOPPING, STRUCTURE）+ SUB_CLASS を作る。`recipes` と `roles` を**引数で差し替えられる**ので、合成 recipe でテストできる。
- 位置に依存する箇所は **1 箇所だけ**: `hint5Presentation` の `own.statuses[HINT5_FIXED_RUNG_KINDS.indexOf("STRUCTURE")]`。それ以外の ownership / request は rung の `kind` で動く（`hint5Ladder.ts:305` の `kind === "KEY_TOPPING"` は空 rung の扱い）。
- HintSheet は**次の 1 rung だけ**を提示し、rung の総数や後続を見せない（「Nothing here shows a rung count, what comes later」）。行のラベルは `SAUCE / CHEESE / KEY_TOPPING` の表を持つが、key-free の recipe では KEY_TOPPING の行は生まれない。
- save の fact 記録（`h5:sauce` / `h5:cheese` / `h5:structure` / `cls:<ingredientId>`）は、key-free でも**同じ形式で足りる**（新しい fact の種類は不要）。

**最小の schema（提案。OD-D3-21 で Owner 確認）:**

| 項目 | 内容 |
|---|---|
| `RECIPE_HINT_ROLES` の型 | 既存の `{ hintKeyToppingId, hintSubToppingOrder }`（25 件、不変）と、**key-free のマーカー**（例 `{ keyFree: true }`）の union。`Record<RecipeId, …>` の型強制は維持される |
| 組み立て | key-free の recipe の rung 列 = **SAUCE（ソースがあるとき）→ CHEESE（チーズがあるとき）→ STRUCTURE → SUB_CLASS（全トッピングを catalog 順）**。**存在しない要素の rung は作らない**（空の rung も「なし」の回答も無い） |
| 価格 | 既存の rung 種別の価格をそのまま使う（10 / 10 / 5 / 5）。**価格の再設計（OD-D3-14）は未決のまま**触らない |
| 並び | 手書きの順序データを持たない（catalog 順で決定的）。key の指定も不要（**新 recipe に hint の手書きデータが要らない**） |
| T-COV | トッピングに family が無い recipe は target にしない（既存の fail-fast を維持） |
| 無ソース | ソースが無い recipe は、Technique `no-sauce` の領域なので key-free でも**今は target にしない**（TQ-1D まで。既存の RESERVED の扱いを維持） |

**変更するもの（想定）:** `src/data/recipeHintRoles.ts`（型）、`src/logic/discovery/hint5Ladder.ts`（builder、検証、`hint5Presentation` の位置依存を kind 基準に）、テスト: `hint5Ladder.test`、`hint5Taxonomy.gate.test`（G17 の key 検証を key-free に対応）、`hint5Ladder.migration.test`（旧 facts の読み取りが不変であること）、`gameReducer.hint5.invalidTaxonomy.test`、`HintSheet.hint5.test`。

**不変であることを pin するテスト（migration A の核心）:** 既存 25 件の `buildHint5Ladder` と `hint5Presentation` の出力が、この PR の前後で**完全に同じ**（スナップショットの等価性）。key-free の機構は、production に key-free の recipe が無い間は**到達しない**。

**HV: 不要**（production の見え方が変わらない。合成 fixture のテストで検証）。最初に目に見えるのは PR-4。

**Owner が知っておくべき帰結:** key-free の recipe（calabresa）では、チーズの rung がそもそも出ない。**提示されない rung の欠落そのものが、「チーズが無い」という情報になる**（既存のプレイヤーが標準の順序を知っていれば推測できる。cheese なし = 2.32 bit）。OD-D3-1 の「存在しない要素を出さない」を採った場合の本質的な帰結で、避けるには空の rung を出すしかない（OD-D3-19 が禁止）。**この点を OD-D3-21 で確認してほしい。**

## 6. brazilian-calabresa の authoritative recipe evidence

| 項目 | 値 / 出典 |
|---|---|
| identity set | `black-olive, onion, oregano, sausage, tomato-sauce`（172 matrix `brazilian-calabresa-pizzadb-p10`。`identityIngredientSet`） |
| sauce / base | `tomato-sauce`（`family_derived`、spread 層 1） |
| cheese | **なし**（matrix の材料に cheese 系が無い。PIZZA DB の材料は「ソーセージ・玉ねぎ・オリーブ・オレガノ」の 4 つ） |
| 材料の日本語（PIZZA DB master evidence） | ソーセージ / 玉ねぎ / オリーブ / オレガノ。`ingredientsCanonical` は null（matrix 側で解決） |
| 名前 / 産地 | ブラジリアン・カラブレーザ / ブラジル・サンパウロ |
| 生地 | 「薄めの生地」→ class `standard`、variant `thin`、shape `round`、form `open-round`。**追加の mechanic は不要**（`requiredCapabilities` = なし、現行フローで FULL） |
| 現行フローでの表現 | FULL。blockers なし。status `READY_WITH_REVIEW`（naming cluster NC-4 のみ） |
| 出典 URL | `https://pizzadb.jp/compare/world-pizzas/page/10/`（comparison table sample、corroboration 0 件） |
| **evidence に無いもの** | `minCount`（量）、`bakeTarget`、reference の配置。**authoring の決定が要る**（placeholder 案: tomato-sauce 1 / sausage 2 / onion 2 / black-olive 2 / oregano 1 = ソース 1 + 7 piece。8 slot の ring に収まる。bake 58–78 は tomato 系の既存 recipe の慣習。**Owner 確認 = OD-D3-24**） |

recipe 内の evidence コメント（PR-4）には、上の出典と、§7 の確度を書く。

## 7. black-olive の不確実性

- **evidence:** PIZZA DB の材料は「オリーブ」で、色・品種を指定しない。canonicalization の規則（`TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES` / `progression2_ingredient_canonicalizer.py`）は `オリーブ → black-olive` を **「confidence-flagged match, not exact」**（「既存の catalog の唯一の olive 系」だから）と明記している。
- **決定（OD-D3-18）:** `black-olive` を使う。新しい olive 食材は作らない。**不確実性を decision と recipe evidence に明記する**（本書と decision record に記録済み。PR-4 の recipe のコメントと Result Report にも書く）。
- **影響:** identity が `black-olive` 前提で、pizza-portuguesa / capricciosa / pesto-tonno / puttanesca と食材を共有する（`black-olive` は step 11 で解放）。**緑オリーブが別食材として入る将来**には、calabresa の identity の再確認が必要。本書は「evidence が確定ではない」ことを残す（根拠の確度は上げない）。

## 8. 26 件への移行（count / test）の範囲

**production のデータ変更（静的に確認）:**

| ファイル | 変更 | 型強制 |
|---|---|---|
| `src/data/recipes.ts` | recipe 1 件を末尾に追加（Dex の No. は末尾追加で既存の番号が不変） | — |
| `src/data/discoveryCatalog.ts` | `RECIPE_DISCOVERY_TARGET_IDS` に `brazilian-calabresa-pizzadb-p10` | `Record<RecipeId, string>` |
| `src/data/recipeSauceProfiles.ts` | tomato-sauce / PAINT | `Record<RecipeId, …>` |
| `src/data/recipeHintRoles.ts` | key-free のマーカー（PR-3 の schema） | `Record<RecipeId, …>` |
| `src/data/referencePizza.ts` | calabresa の reference と、`REFERENCE_PIZZAS` の登録（無いと Completion Gate のソース量・Scoring 2.0 の reference が `null`） | **型では強制されない**（テストで強制） |
| `src/data/orders.ts` | order の台詞 1 件（`findOrderForRecipe`） | テストで強制 |
| `src/data/cookingProfiles.ts` | `CUT_ELIGIBLE_RECIPE_IDS` に追加するか（§10） | — |

**自動で追従するもの:** `RECIPE_DISCOVERY_CATALOG`（`RECIPES` から導出）、matcher、Dex の合計（`RECIPES` 由来）、Dinner の catalog（実行時に導出）、`playerReference`（生成）、chapter の分割（key step 12 → 第 2 章が 9 → 10 件。「6 / 9 / 10」→「6 / 10 / 10」）。

**テストの更新（S1 の一覧を再掲、`src` の unit 26 ファイル + e2e 10 ファイル）:** 件数を pin しているもの（`recipes.test`、`discoveryLadder.test`、`recipeSauceProfiles.test`、`referencePizza.w1.test` の piece 数表、`cookingProfiles.test` の step 表、`dinnerResultDetection.test` の「0 identical signatures」、`pizzaSelect.test` ほか）と、e2e の Dex ピル `N/25`（10 ファイル）。これは**意図的な pin**で、数値を明示的に更新する（派生に置き換えて pin を弱めない）。

**挙動が変わりうるもの（静的には確定できない）:** 「25 件を歩く」シミュレーション / walk 系（`w1LadderEconomy.test`、`w1Reachability.test`、`discoveryHint.walk.test`、`hint5Economy.sim.test`、`discoveryHintEconomy.sim.test`、`w1Activation.test`、`deduction*`）は、**step 12 で DISCOVERABLE が 2 件になる**（これまで常に 1 件）ことを前提としていない可能性がある。**これが PR-4 の最大の不確実性**で、実装の開始時に実測する。失敗するファイルが多い（目安 10 超）か、シミュレーションの書き換えが必要なら、PR-4 を「4a: pool > 1 に対応するテスト基盤」と「4b: recipe の追加」に分ける。

**ladder の検証:** S1 で、26 件（calabresa 込み）でも `validateDiscoveryLadder` と `validateLadderProgression`（SOFTLOCK を含む）が問題 0 であることを確認済み。`POST_W1_APPENDED_STEPS` は空のまま。

## 9. matcher / Dex / inventory / economy

| 領域 | 影響 |
|---|---|
| matcher | 変更なし。identity（材料 + sauceBase）の衝突は 26 件で 0 件（S1）。calabresa は `UNIQUE_MATCH`。`RECIPE_DISCOVERY_CATALOG` は自動 |
| Dex | 合計が 26。第 2 章が 10 件。既存の No. は不変（末尾追加）。「？？？」のカードが step 12 で 2 枚になる |
| hint target | 自動 target は `recipeKeyStep` → 材料の種類数の順なので、step 12 で **calabresa（5 種）が portuguesa（6 種）より先**（S1）。OD-D3-10 により、Hint / Notebook / Dex では選択可能にしてよい。自動 target の順序をそのまま使うか、明示の選択を前提にするかは PR-4 の設計 |
| inventory | 新しい在庫の種類なし（4 食材は既存）。k（pack 量）は placeholder の量が既存の最大以下なので不変（sausage 3 / onion 4 / black-olive 2 / oregano 2）。**量を変える場合は k を再確認** |
| economy | 初回発見で品質 70 のとき 130 Pitz（80 + 初回 50）。O3 で ladder は進まないので、W1 の経済は不変。**ただし calabresa は Lunch Rush / Dinner の recipe 候補に入る**（W1 の 10 件と同じく `unlockCondition` なし。Lunch Rush のランキング ruleset は不変だが、注文の分布に 1 件増える） |

## 10. CUT eligibility

- 現在の `CUT_ELIGIBLE_RECIPE_IDS` は 25 件中 24 件（`new-haven-apizza` は生地の evidence が無いので対象外）。W1 の規則（REC-02）は「標準の丸い生地の evidence がある recipe だけ」。
- calabresa の生地の evidence は「薄めの生地」= standard / thin / round / open-round。matrix の `cutServe` は `existing-round-cut-optional`。**W1 の規則に従えば対象**（portuguesa など同系統の recipe は対象）。
- **提案:** 対象にする（`CUT_ELIGIBLE_RECIPE_IDS` に 1 行）。**ただし Owner の確認が要る**（OD-D3-22。「薄い生地」を standard の evidence として扱ってよいか。除外するなら、同じ系統の recipe と CUT の体験が異なる）。
- **衝突:** `cookingProfiles.ts` は PR #295 も変更中。追加するなら、PR-4 の最後の小さな commit にして、#295 の merge 状況を見てから行う。CUT の追加で tab 数は 5（DOUGH, SAUCE, TOPPING, BAKE, CUT）で、#295 の上限 6 を超えない（チーズ段階がないため）。

## 11. Human Verification の範囲

| PR | HV | 内容 |
|---|---|---|
| PR-1 | **必要** | RESULT の見え方の変更。390×844 の動画: (a) 正しい構成 + ソース薄 (b) 誤った構成 + ソース薄 → 区別できない / 助言は同じ。before / after のスクリーンショット（S1 の K1 / K2 を基準に） |
| PR-2 | 不要 | 内部変更（production に `ladderCredit: false` の recipe が無い）。ただしテストで既存 25 件の挙動が不変であることを示す |
| PR-3 | 不要 | 内部変更（production に key-free の recipe が無い）。既存 25 件の ladder / presentation の等価性テスト |
| PR-4 | **必要** | Dex に新しい「？？？」、step 12 の pool = 2、calabresa の発見、Shop の次の素材が加速しないこと、Hint sheet に空の rung が出ないこと、Notebook。390×844（と 360×800）の動画と before / after のスクリーンショット。ladder が進まないこと（O3）を、**発見の前後の Shop の「次の素材」の表示**で示す |

## 12. 推奨する PR 分割

```
PR-1  oracle の無効化 + recipe 非依存の実行助言        (HV あり)   ┐
PR-2  O3: ladderCredit の authority + pure logic         (HV なし)   ├ 並行可（ファイルが重ならない）
PR-3  key-free Hint schema（合成 fixture で検証）        (HV なし)   ┘
          ↓ すべて merge 後
PR-4  brazilian-calabresa の追加（data + reference + 26 件の pin 移行）(HV あり)
          （pool > 1 のテスト基盤が必要なら 4a / 4b に分割）
```

| PR | 範囲 | production の挙動の変化 | 依存 |
|---|---|---|---|
| PR-1 | §3.2 | あり（RESULT の文言・near/far・Notebook の記録） | なし |
| PR-2 | §4 | なし | なし |
| PR-3 | §5 | なし | なし（OD-D3-21 の確認後） |
| PR-4 | §6〜§10 | あり（新 recipe） | PR-1, 2, 3 + OD-D3-22 / 24 |

**混ぜない理由:** oracle の修正（表示と記録）、progression の authority（count の定義）、Hint の schema、新 recipe の追加は、**失敗したときの切り戻しの単位が違う**。PR-1 の HV で RESULT を確認し、PR-2 / 3 は内部変更として等価性テストで守り、PR-4 でだけ新 recipe の見え方を HV する。

**最初の実装 PR は PR-1**（oracle は production で現在も有効で、他の PR と独立に直せる）。PR-2 は小さく安全なので並行で進められる。

## 13. Gate が提案する Owner 確認事項（新規。確定ではない）

| ID | 内容 | 推奨 |
|---|---|---|
| OD-D3-21 | key-free の Hint の rung 規則（§5）: SAUCE（あれば）→ CHEESE（あれば）→ STRUCTURE → SUB_CLASS（全トッピング、catalog 順）、価格は既存、空の rung なし。**rung の欠落自体が情報になる**帰結の承認 | 承認 |
| OD-D3-22 | calabresa の CUT 対象（§10） | 対象にする（W1 の規則どおり）。PR-4 の最後の commit |
| OD-D3-23 | oracle の無効化の詳細（§3.2）: (a) INCOMPLETE を通常の ORIGINAL と同じ表示にする、(b) **INCOMPLETE を Notebook に記録する（OD-P3-16 の変更）**、(c) recipe 非依存のソース薄の助言を足す、(d) recipe 固有の焼きの窓だけで失敗した場合は助言なし | 承認（(b) は特に確認） |
| OD-D3-24 | calabresa の量（minCount）と bakeTarget の authoring（placeholder: 1 / 2 / 2 / 2 / 1、58–78）。Lunch Rush / Dinner の候補に入ること | 承認（量は S2 の実装前に Owner が最終確認） |

## 14. S2 の blocker（残り）

| # | blocker | 状態 |
|---|---|---|
| 1 | OD-D3-17 / 18 / 19 / 20 / 15 / 16 | **確定済み** |
| 2 | PR-1（oracle の無効化）の merge | 未着手。**PR-4 の前提** |
| 3 | PR-2（O3）の merge | 未着手。**PR-4 の前提** |
| 4 | PR-3（key-free schema）の merge と OD-D3-21 | 未着手 / 未確認。**PR-4 の前提** |
| 5 | OD-D3-23（oracle の詳細、とくに Notebook の記録） | 未確認。PR-1 の前提 |
| 6 | OD-D3-22（CUT）、OD-D3-24（量・bake・Lunch Rush） | 未確認。PR-4 の前提 |
| 7 | pool > 1 のテスト基盤（シミュレーション / walk 系）の範囲 | 不確実。PR-4 の開始時に実測し、必要なら 4a / 4b に分割 |
| 8 | #295 との衝突（`cookingProfiles.ts`） | CUT に追加するなら PR-4 の最後に、#295 の状況を見て |
| 9 | 26 件の pin（unit 26 + e2e 10）の更新 | PR-4 の作業（範囲は §8） |
| 10 | HV（PR-1、PR-4） | 実装時 |
| 未決のまま | OD-D3-4 / 9 / 11 / 12 / 13 / 14 | 本 slice の対象外 |

## 15. S2 GO / NO-GO

| 対象 | 判定 |
|---|---|
| **PR-1（oracle の無効化）** | **GO**（OD-D3-23 の確認だけ先に。特に INCOMPLETE を Notebook に記録する点） |
| **PR-2（O3）** | **GO**（確認事項なし。小さい） |
| **PR-3（key-free schema）** | **GO（OD-D3-21 の承認後）** |
| **PR-4（brazilian-calabresa の追加）** | **NO-GO**（PR-1〜3 の後。OD-D3-22 / 24 の確認も要る） |

## 16. 限界

- 26 件を足したときの test の失敗は**静的な調査**で、実測していない（dry-run の変更権限が確認できなかった）。最大の不確実性は §8 の pool > 1 のテスト基盤。
- PR-1 の「ソース薄」の助言は、全 recipe が同じ理想 fixture から reference を作る（`computeMechanicalSauceReference`）ことに依存する。ソースの reference が recipe ごとに異なる将来には、この前提を再確認する。
- 焼きの窓だけで失敗する構成が、助言なしで通常の ORIGINAL と同じに見える点は、プレイヤーの体験としては退行になりうる（正しい構成なのに登録されない理由が見えない）。Discovery の成立条件を変えない、という制約の下での設計で、HV で確認する。
