# Discovery 3.0 — Pre-PR4 Gate (dry-run of the 26th recipe)

- **種別:** dry-run の記録（docs / tools のみ）。**production は一切変更していない。brazilian-calabresa は production に無い。**
- **audited main:** `a0201e35473ea0f7d27bf9d1c054587b4cfe23e2`（PR-1 #322 `ae62bb6` / PR-2 #323 `500fca7` / PR-3 #324 `a0201e3` が main に存在することを確認）。
- **方法:** `origin/main` の temporary worktree に brazilian-calabresa を 26 番目として仮追加（`tools/discovery3-prepr4/scratch-26th-recipe.patch`）。**quantity（1/2/2/2/1）と bake（58–78）、reference の座標は dry-run を動かすためだけの値で、authority ではない**（OD-D3-24）。実測は `tools/discovery3-prepr4/preP4.dry.test.ts` / `measure.json`、失敗の全件は `unit-failures-26.json`。
- **main `a0201e3` の post-merge WebKit:** attempt 1 は `webkit-360x800 shard 1/2` が**原因未確認の失敗**。同一 commit の attempt 2 は 390×844 / 360×800 の全 shard と WebKit Gate が success。「flake だった」とは断定せず、**原因未確認の再実行成功**として記録する（Owner 承認済みで本 Gate に進んだ）。

## 1. 仮追加した temporary data

| ファイル | 仮追加 |
|---|---|
| `recipes.ts` | `brazilian-calabresa`（末尾 = Dex No. 26）。tomato-sauce 1 / sausage 2 / onion 2 / black-olive 2 / oregano 1、bake 58–78（**placeholder**）、`ladderCredit: false` |
| `discoveryCatalog.ts` | target id `brazilian-calabresa-pizzadb-p10` |
| `recipeSauceProfiles.ts` | tomato-sauce / PAINT |
| `recipeHintRoles.ts` | `{ keyFree: true }`（**型を `Record<RecipeId, HintRoles>` に広げる必要があった** — §3 の発見） |
| `referencePizza.ts` | 7 piece を ring 上に置いた scratch reference（**authority ではない**）と `REFERENCE_PIZZAS` への登録 |
| `orders.ts` | order 1 行（scratch の台詞） |
| `cookingProfiles.ts` | 別実行で `CUT_ELIGIBLE_RECIPE_IDS` に 1 行（§6） |

型強制だけで足りるもの: `RECIPE_DISCOVERY_TARGET_IDS` / `RECIPE_SAUCE_PROFILES` / `RECIPE_HINT_ROLES`。**型で強制されず、テストで初めて分かるもの:** `REFERENCE_PIZZAS`（登録漏れ）、`orders`、`CUT_ELIGIBLE_RECIPE_IDS`。

## 2. 25 → 26 の失敗（unit 140 件 / 43 ファイル、E2E 29 件。tsc / build は production が通り、テスト側の型のみ失敗。lint は新規なし）

分類: **MECHANICAL = 固定値・fixture・snapshot の更新だけで済む**、**SEMANTIC = pool > 1 によって前提そのものが壊れる**。

### 2.1 MECHANICAL（unit 65 件 / 33 ファイル）

| 種別 | 代表（test file → 理由 → 修正） |
|---|---|
| 件数 pin 25 → 26 | `recipes.test`、`discoveryLadder.test`（data / logic）、`recipeSauceProfiles.test`、`referencePizza.w1.test`、`completionGate.test`（27）、`economySimulation.test`、`efficiency.test`、`pizzaSelect.test`、`w1Activation.test`、`deductionGuard.test`、`deductionProduction.gate.test`（25 / 24）、`dinnerResultDetection.test`（2）、`w1LadderEconomy.test`（件数 2）、`w1Reachability.test`（8: 「25 に到達」→ 26。**到達自体は 26 / 26 で成功** = ladder は softlock しない） |
| chapter 6/9/10 → 6/10/10 | `recipeChapters.test`、`PizzaSelectScreen.test`、`DexOverlay.discovery.test`（2）、`largeCatalogFixtures.test`（2）、`App.test` / `App.fullGameReset.test`（Dex pill `/25`） |
| 表・集合の追加 | `cookingProfiles.test`（eligibility 集合 / `RECIPE_STEP_MATRIX` の行 / 「CUT 対象か否かを明示せよ」= 設計上の強制）、`hintSteps.test`（NO_CHEESE リスト）、`progression.test`（gate なしの recipe 一覧）、`selectableHint.test`（paid target の unlock 合計 515 → 550 = +35、calabresa の 5 + 5 + 5×4 + …）、`hint5Ladder.keyFree.test` の production-25 golden（calabresa が production roles に入るので **shipped 25 に絞る**必要）、`discoveryLadder.ladderCredit.test`（「production に `ladderCredit: false` が無い」ガードを意図的に更新 = 4 件） |
| snapshot の拡張 | `scoringV2.noSauceParity.test`（225 → 234 行）。**既存行の diff を行単位で確認してから足す（盲目的な再生成は禁止）** |
| fixture id の衝突 | `persistence.forwardCompat.test`（7）、`persistence.discoveryHintFacts.test`（2）、`persistence.discoveryHintPurchases.test`（1）、e2e `save-forward-compat-3-4b`: **「将来の未知 recipe id」として brazilian-calabresa を使っている**。id が既知になると前提が崩れる → fixture id を別の架空 id へ |
| E2E | Dex pill `N/25` → `N/26`（10 ファイル 25 件）、`rt01-reference-capacity`（25 → 26 case）、`discovery-hint-sheet` の COMPLETE（「25 件発見 = COMPLETE」の fixture に calabresa が要る） |

### 2.2 SEMANTIC（unit 75 件 / 14 ファイル、E2E 3 件）

| test file | 失敗の理由 | 必要な修正 |
|---|---|---|
| `hintTarget.test`（26）| 「Dex 12〜24 の target は next ladder key recipe **ただ 1 件**」。実測: Dex 12 の候補順は `[calabresa, portuguesa]`（材料の種類数が少ない順）で、**自動 target は ladder の key recipe ではなく calabresa になる** | pool > 1 の target 規則を決め（Owner 判断 §9）、test を population パラメトリックに |
| `nearMiss.test`（13）| 同上（target が 1 件前提） | 同上 |
| `DexOverlay.hint.test`（15）、`DexOverlay.discovery.test`（DOM sweep 1）| 「DISCOVERABLE card はちょうど 1 枚、Free Cooking CTA が重複しない」。実測: step 12 で 🎨 カードが **2 枚** | 2 枚を正とする UI 仕様の決定（候補名は事前表示しない）と test の書き直し |
| `discoveryHint.test`（3）、`discoveryHint.walk.test`（1）| 「各 stage に DISCOVERABLE target が 1 つ、完了で COMPLETE」。pool > 1 では途中の stage でも別の候補が残る | walk が pool の全候補を巡る形に |
| `hint5Ladder.test`（3）、`hint5Production.gate.test`（G4 / C / G15）、`hint5Taxonomy.gate.test`（G17 / C1-P / G2）、`HintSheet.hint5.test`（1）| 「全 production recipe が固定 4 rung + 手書きの key / sub order を持つ」「**STRUCTURE より前の offer と board の形は全 target で同一（H5-INV-5 FREE LEAK）**」。key-free の calabresa は rung 2 が STRUCTURE。**OD-D3-21 が承認した「rung の欠落そのものが情報」は、この不変条件の意図的な緩和** | 不変条件を「key あり recipe 群」と「key-free recipe」に分けて書き直す。G15 は緩和の範囲を明示 |
| `hint5Economy.sim.test`（3）、`discoveryHintEconomy.sim.test`（1）| economy sim が「固定 4 rung の価格表」「全 recipe が Dex 25 に到達」を前提 | key-free の ladder 形（SAUCE 10 / STRUCTURE 5 / SUB_CLASS 5×4 = 35）に対応 |
| `techniques.tq1c.test`（1）| **Owner が決定した TQ-1D 監査基準「SAUCE_ONLY 44 件・うち k<2 が 12 件」が、pool = 2 の 13 step（count 12〜24）で 77 件になる**（candidate が 2 件になるため） | 基準値の再監査（TQ-1D の前に）。PR-4 を直接止めるものではないが **Owner の確定数字が動く** |
| `w1LadderEconomy.test`（REC-04 の導出 1）| 「key-recipe の導出規則が W1 ladder を再現する」。導出の入力 population に `ladderCredit: false` の recipe が入る | 導出を ladder-credit の recipe に限る（test 側） |
| E2E `discovery-hint5-ladder`（2: marinara / quattro-formaggi）| step 14 の Dex で、auto target が marinara → calabresa に変わる | target を明示（Dex の ？？？ カードから）して固定する |

## 3. step 12 の pool = 2（実測）

| 項目 | 結果 |
|---|---|
| onion 解放時（Dex 12 = margherita + step 1〜11 の key recipe） | **calabresa と portuguesa が同時に DISCOVERABLE（pool = 2）**。1 つ前（Dex 11）は `[capricciosa]` のみ（calabresa は UNKNOWN） |
| baseline（25 件）の最大 pool | 1 |
| pool = 2 の継続（calabresa を後回しにした場合） | **13 step（count 12〜24）**。calabresa を早く取る歩きでは pool = 2 は 1 局面だけ |
| 自動 hint target（step 12） | `calabresa` が先（材料 5 種 < portuguesa 6 種）。候補順 `[calabresa, portuguesa]` |
| 型の発見 | `RECIPE_HINT_ROLES: Record<RecipeId, RecipeHintRoles>` のままでは key-free の entry を production に置けない。**PR-4 で型を `HintRoles`（union）に広げる必要がある**（PR-3 #324 は injected roles のみを対象にした）。広げると `hintKeyToppingId` を読むテスト 5 ファイルが型エラー（§2.2） |

## 4. 発見の順序と ladderCredit（実測）

| 順序 | Dex / ladder count / step | next material | pool |
|---|---|---|---|
| (開始) Dex 12 | 12 / 12 / step 12 | step 13 まであと 1 | `[calabresa, portuguesa]` |
| A: calabresa → | Dex 13 / **ladder 12** / step 12（**変化なし**） | step 13（変化なし） | `[portuguesa]` |
| A: → portuguesa | Dex 14 / ladder 13 / step 13 | step 14 | `[fugazza]` |
| B: portuguesa → | Dex 13 / ladder 13 / step 13（portuguesa で 1 段進む） | step 14 | `[calabresa, fugazza]` |
| B: → calabresa | Dex 14 / **ladder 13（変化なし）** | step 14 | `[fugazza]` |

- 2 つの順序の最終 ledger は一致（`orderSameFinalLedger = true`）。calabresa 単独の発見で ledger（Shop entitlement）は不変。
- 全歩き（calabresa を後回し / 早取り）とも、Dex 26 / ladder count 25 / step 24 / ledger 26 で完了。**calabresa は W1 progression を 1 段も早めない**。reducer 経由（`REGISTER_TO_DEX`）でも ladder count 12 のまま、`unlockedForShopIngredientIds` は不変。
- 残り未知: Dex 12 で 12 件、両方発見後は 11 件。

## 5. Discovery 体験（calabresa）

| 項目 | 実測 |
|---|---|
| matcher identity の衝突 | **0**（26 件。items + sauceBase が calabresa と一致する他 recipe は無い）。target は `ELIGIBLE` |
| Hint 5.0（key-free）| `SAUCE → STRUCTURE → SUB_CLASS×4`（oregano / onion / sausage / black-olive、catalog 順）。**KEY_TOPPING なし、empty rung なし、「なし」の dummy なし**。board に `none: true` なし |
| Hint 価格 | 10 / 5 / 5×4 = **35**（既存の rung 種別の価格のまま） |
| Hint 3.0（既存の path）| `COUNT_CHEESE: 材料は全部で5種類。チーズは使わないみたい` を出す（marinara と同じ既存挙動）。**Hint 5.0 の「rung の欠落」とは別に、3.0 の行は明示的に「使わない」と言う**（既存仕様。新規ではない） |
| Notebook | 正しい構成 + 薄いソース（INCOMPLETE_MATCH）も `NEW` で記録、再試行で `DUPLICATE`。誤った構成（ORIGINAL）も同じ `NEW`（OD-D3-23 のとおり） |
| oracle | 正しい構成 + 薄いソース = `INCOMPLETE_MATCH`、別の構成 + 薄いソース = `ORIGINAL`。**near/far の行は、INCOMPLETE が FAR（他候補から遠い）、別構成が ADD_ONE（calabresa に近い）で、行の種類は異なる**が、行の種類は「その pizza が他の候補にどれだけ近いか」であり、INCOMPLETE であることを表さない（正しい構成だから FAR になる、という逆の情報は無い）。PR-1 の同値テスト（funghi fixture）は変更なしで有効 |
| discovery | 正しい構成 = `NEW_DISCOVERY`（Dex 12 → 13、ladder 12 のまま） |
| 事前表示 | 候補 recipe 名をプレイヤーへ事前表示する仕組みは**追加していない**（Dex は「まだ見ぬピザ」×2） |

## 6. 統合への影響

| 領域 | 実測 / 判断 |
|---|---|
| Dex numbering / chapter | calabresa = **No. 26**（末尾追加）、chapter 2 の slot 10。chapter は **6 / 10 / 10**。既存の No. は不変 |
| referencePizza | `REFERENCE_PIZZAS` への登録が必要（**型では強制されない**。テストが強制）。7 piece（sausage 2 / onion 2 / black-olive 2 / oregano 1）の配置は dry-run の ring で **authority ではない** |
| orders | order の台詞が必要（`findOrderForRecipe`。テストが強制）。台詞は未作成 |
| recipeSauceProfiles / discoveryCatalog / recipeHintRoles | 型強制（§1） |
| **Lunch Rush** | **発見後に自動で候補に入る**（discovered かつ材料を持つ recipe 全て）。dry-run: 13 件の pool に `brazilian-calabresa` が含まれる。発見前は入らない。**意図した production behavior か Owner の確認が要る**（§9） |
| **Dinner** | **入らない**。Dinner の mission は dm-a / dm-b が `targetRecipeIds` を手書きしており、新 recipe は自動で入らない（S2 Gate の「Dinner の候補に入る」は誤り。本書で訂正）。Dinner 側のテストは count pin のみ |
| inventory / economy | 新しい在庫種なし。初回発見の報酬は既存式。**ladder が進まないので W1 の economy は不変**（§4） |
| save compatibility | 既存 save は変更なし（Dex は recipe id で保持。calabresa が無い save はそのまま）。**「未知の将来 id」fixture が calabresa を使っているテスト 10 件 + e2e 1 件は、id を変えないと前提が崩れる**（§2.1） |
| CUT eligibility | 1 行（`CUT_ELIGIBLE_RECIPE_IDS`）で、cookingProfiles / pizzaSelect / dinner の残りの失敗は集合 pin と matrix 行のみ。tab 数は DOUGH / SAUCE / TOPPING / BAKE / CUT = **5**（#295 の上限 6 以内） |

## 7. #295 / cookingProfiles（Fresh 確認）

- #295: **open、mergeable_state = dirty、head `13d6836`、base `86b48fd`（古い）。** main との merge は、**calabresa と無関係に既に 2 ファイル conflict**（`src/screens/GameScreen.tsx`、`docs/PROJECT_HANDOFF.md`）。
- `cookingProfiles.ts`: #295 は**ファイル末尾**に `MAX_VISIBLE_COOKING_TABS` / `visibleCookingTabCount` を足す。`CUT_ELIGIBLE_RECIPE_IDS` は**別の hunk**。**CUT の 1 行を足した main と #295 の merge-tree で、`cookingProfiles.ts` は自動 merge できた**（conflict は #295 の既存の 2 ファイルのみ）。
- #295 の tab gate（6 tab 上限）は calabresa（5 tab）に影響しない。
- 判断: **PR-4 で CUT profile の 1 行だけを安全に足せる**（#295 の解決を待つ必要は技術的には無い）。ただし OD-D3-22 のとおり PR-4 の最後の commit にし、**#295 は merge も変更もしない**。#295 の `GameScreen.tsx` conflict は #295 側の既存問題。

## 8. Authoring Gate（placeholder 採用禁止）

| 項目 | 状態 | 根拠 / 内容 |
|---|---|---|
| sauce | **CONFIRMED**（matrix 由来） | tomato-sauce。PIZZA DB の材料の列には sauce が無く、172 matrix の `family_derived`（spread 層 1）から決まる |
| cheese | **CONFIRMED**（project の evidence に cheese なし）／**要注意** | PIZZA DB の材料は「ソーセージ・玉ねぎ・オリーブ・オレガノ」。cheese の記載が無いので recipe に cheese を入れない。ただし一般に流通する同名の pizza が cheese を使う可能性は evidence の外にあり、Hint の rung 構成（CHEESE rung の有無）を決めるので、Owner の再確認を推奨 |
| toppings: sausage / onion / oregano | **CONFIRMED** | PIZZA DB 材料 |
| toppings: black-olive | **UNCERTAIN** | evidence は単に「オリーブ」。canonicalization 規則は `オリーブ → black-olive` を「confidence-flagged match, not exact」としている（catalog 唯一の olive 系だから）。OD-D3-18 で使用は決定済みだが、**不確実性は維持**。緑オリーブが別食材として入る将来は identity の再確認が要る |
| quantity（minCount）| **OWNER/CALIBRATION NEEDED** | evidence に量なし。`1/2/2/2/1` は placeholder で **採用しない**。k（pack 量）への影響（sausage 3 / onion 4 / black-olive 2 / oregano 2）は量が決まってから再確認 |
| dough | **CONFIRMED** | 「薄めの生地」→ class `standard` / variant `thin`。`requiredCapabilities` なし（現行フローで FULL）。thin に固有の mechanic は不要 |
| shape | **CONFIRMED** | round / open-round |
| bake（bakeTarget）| **OWNER/CALIBRATION NEEDED** | evidence なし。`58–78` は tomato 系の慣習で **採用しない**。gameplay の calibration（Completion Gate / bake の窓）が要る |
| placement / reference | **OWNER/CALIBRATION NEEDED** | evidence なし。8 slot の ring に収まる配置を authoring し、Completion Gate / Scoring 2.0 の reference として calibration（座標・tolerance） |
| CUT eligibility | 方向 **CONFIRMED**（OD-D3-22）／規則の解釈 **UNCERTAIN** | 「薄めの生地」を standard の evidence として扱ってよいか（W1 の規則は「標準の丸い生地の evidence」）。実装は PR-4 の最後の commit |

**evidence（authoritative）と gameplay calibration の分離:** 上の CONFIRMED / UNCERTAIN の行は evidence の範囲。OWNER/CALIBRATION の 3 項目（quantity / bake / placement）は evidence から導けず、**PR-4 の前に authoring → calibration → Owner 確認**を行う。

## 9. 未決の Owner Decision（この Gate で新たに必要になったもの）

1. **pool > 1 の自動 target 規則**: 現行は「材料の種類数が少ない順」で、Dex 12 は calabresa（key recipe ではない）が先。このままか、ladder の key recipe を先にするか、明示選択だけにするか（OD-D3-10 の具体化）。
2. **Dex の 🎨 カードが 2 枚並ぶ**ことの UI 仕様（候補名の事前表示はしない前提）。
3. **Lunch Rush の候補に自動で入る**ことが意図した production behavior か。order の台詞の authoring。
4. **cheese なしの確認**（§8）と OD-D3-24 の 3 項目（quantity / bake / placement）。
5. **TQ-1D の監査基準**（SAUCE_ONLY 44 → 77、pool = 2 の 13 step）の再監査は TQ-1D の前（PR-4 を止めない）。
6. CUT の「薄めの生地 ≈ standard」の解釈（OD-D3-22 の実装規則）。

## 10. PR split の判断

**推奨: Option B（PR-4a → PR-4b）。**

- SEMANTIC が **75 件 / 14 ファイル**（+ E2E 3 件）。mechanical だけなら Option A でも書けるが、semantic は「テストの前提そのものの書き直し」で、**recipe を足す PR に混ぜると、失敗の原因が data か前提か切り分けられず、切り戻しの単位も違う**。
- さらに production の型変更（`RECIPE_HINT_ROLES` を `HintRoles` に広げる）と、H5-INV-5 の緩和（G15）、「未知の将来 id」fixture の入れ替えが要る。

| PR | 内容 | HV |
|---|---|---|
| **PR-4a** | pool > 1 / 26 件を扱える test foundation。premise-sensitive なテスト（§2.2）を **population パラメトリック**にし、**25 件（現状）と 25 + 合成の branching recipe の両方で通す**。`RECIPE_HINT_ROLES` の型を `HintRoles` に広げる（production の挙動は不変）。forward-compat fixture の id 差し替え。pool > 1 の target 規則（§9-1）の実装。**production recipe は足さない** | 不要（見える変化なし。ただし §9-1/2 の UI を変えるなら要） |
| **PR-4b** | brazilian-calabresa の追加 + mechanical な pin 更新（§2.1）+ reference / order / CUT 1 行（最後の commit） | **必要**（§11） |

PR-4a は **PR-4b の前提を main に確定**させる。PR-4b は mechanical + data だけになり、HV に集中できる。

## 11. Preview / iPhone HV 計画（次の implementation PR = PR-4b）

production merge の**前に** dedicated Preview（既存の Preview helper / seed / badge の運用。H5-5 と同じ形）へ deploy し、Owner が iPhone 実機（390×844 を主）で確認する。

| # | 確認項目 | 期待 |
|---|---|---|
| 1 | onion を解放（Shop）| Dex に「まだ見ぬピザ」の 🎨 カードが 2 枚。名前は出ない |
| 2 | FREE で自由に試作 | 材料 4 種（sausage / onion / black-olive / oregano）+ tomato-sauce で試作できる |
| 3 | key-free Hint | ヒント 1 = ソース、ヒント 2 = 構成、ヒント 3〜 = サブトッピングの分類。**チーズ / キートッピングの rung も、空の rung も「なし」も出ない** |
| 4 | Trial Notebook | 試作が記録され、再試行で「試作 #n」の通知。正解構成 + 薄いソースでも通常の ORIGINAL と同じ見た目 |
| 5 | calabresa の発見 | NEW_DISCOVERY の演出、Dex 登録（No. 26 / 第 2 章） |
| 6 | **W1 unlock が加速しない** | 発見の**前後で Shop の「次の素材」の表示が同じ**（あと N 種類）。portuguesa を発見したときだけ 1 段進む |
| 7 | 順序 | calabresa 先 / portuguesa 先の両方で最終 ledger が同じ |
| 8 | Lunch Rush（§9-3 の決定に応じて）| calabresa が注文に出る / 出ない |

動画は 390×844 で、repo には commit しない（Policy）。before / after の screenshot は `docs/reports/screenshots/<task>/`。PR-4a は見える変化が無ければ HV 不要。

## 12. PR-4 の判断

- **PR-4（production への brazilian-calabresa 追加）は NO-GO のまま。** 理由: (1) OD-D3-24 の quantity / bake / placement が未 authoring、(2) pool > 1 の semantic な前提が 14 ファイル / 75 件で未対応（PR-4a が先）、(3) 新しい Owner Decision（§9）。
- 前提の PR-1 / 2 / 3 は main に存在し、post-merge の Deploy / WebKit は green（WebKit は attempt 1 が原因未確認で、attempt 2 が success）。
