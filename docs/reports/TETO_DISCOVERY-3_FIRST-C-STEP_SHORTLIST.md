# Discovery 3.0 — First C-Step Candidate Shortlist（DECISION SUPPORT / DOCS ONLY）

**種別:** 判断材料のみ。production code / recipe / ingredient / ladder / save schema は未変更。Issue / PR 未作成。**No.28 は選ばない。recipe は採用しない。ランキングなし。** R6 / IP-2 へは進まない。

| 項目 | 値 |
|---|---|
| audited `origin/main` | `262b09fcb78d98c7b12ea4e5b51c2da1bca9d37e`（fresh fetch で一致） |
| 再利用（read-only） | Branch Placement Audit `db956ee`（`…BRANCH-PLACEMENT_DECISION-AUDIT.md` / `…BRANCH-PLACEMENT.json`）、その元の BRANCHING-EXPANSION JSON の candidate 属性（`eea7c98`） |
| 再実行したもの | なし。pool / hint / persistence の数値は placement audit が **同一 main SHA** の production 述語（`recipeDiscoveryState` / `selectHintTarget` / `resolveShopEntitlement`）で出した値。35 candidate・172 recipe は再抽出・再監査していない |
| companion data | `docs/reports/data/TETO_DISCOVERY-3_FIRST-C-STEP_SHORTLIST.json` |

件数は全て **audit 内部値**。player-facing に candidate 数を出す提案ではない（#345 契約維持）。

## 0. Provisional Owner Direction との整合

OD-BRANCH-1〜5 を前提とした。**既存 authority との矛盾は見つからなかった。** ただし前提の**含意**を 2 点報告する（矛盾ではない）:

1. **calabresa は Step 12 到達前には発見できない**（最後の材料 onion が Step 12。placement audit の Step 12 `Dnote`）。よって Step ≤ 11 に C を置いても「calabresa 発見済みのプレイヤー」は存在せず、今回の目的（calabresa 発見済みでも複数 recipe から推理）が文字通り成立するのは **Step ≥ 13 のみ**。
2. 同じ理由で、Step ≤ 11 に C を置くと **既存 authority「最初の OPEN_POOL / Trial Notebook 案内 = Step 12」（F5/F7）が前倒しされる**。禁止ではなく Owner 判断事項（§2）。

## 1. STEP 1 — Candidate Step eligibility（Step 0〜25）

用語: U = calabresa 未発見 / D = 発見済みの購入後 pool（現 production、追加なし）。candidate 欄 = **その Step が earliest step の candidate**（= その Step で新規に DISCOVERABLE になり C を作れる）を `数: id(blocker)` で。blocker は既存 35 candidate 分類（MECH / ID / AUTH / MULTI）。

現 branching type: Step 1–11 = A（pool 1）、Step 12 = **C**（pizza-portuguesa + calabresa）、Step 13–25 = U は B（key + calabresa）／D は A。

| Step | 解除材料 | current key | U pool | D pool | candidate | 判定 |
|---|---|---|---|---|---|---|
| 0 | starter | （margherita） | — | — | 6: 全 MULTI | EXCLUDED: **Dex 0 保護**（F1/F2。開始 pool を 2 件にすると free Margherita hint の前提が崩れる。OD-BRANCH-1） |
| 1 | egg | bismarck | bismarck | bismarck | 0: — | EXCLUDED: current-material candidate 0 |
| 2 | bacon | breakfast-pizza | breakfast-pizza | breakfast-pizza | 0: — | EXCLUDED: current-material candidate 0 |
| 3 | mushroom | funghi | funghi | funghi | 0: — | EXCLUDED: current-material candidate 0 |
| 4 | eggplant | melanzane-pizza | melanzane-pizza | melanzane-pizza | 0: — | EXCLUDED: current-material candidate 0 |
| 5 | parmigiano | parmigiana-pizza | parmigiana-pizza | parmigiana-pizza | 0: — | EXCLUDED: current-material candidate 0 |
| 6 | pepperoni | pepperoni | pepperoni | pepperoni | 4: fathead-pizza-keto-p9(MULTI), montreal-style-pizza-p13(MECH), new-england-bar-pizza-p6(MULTI), st-louis-style-pizza-p4(MULTI/no-sauce) | **SHORTLIST** |
| 7 | sausage | salsiccia | salsiccia | salsiccia | 2: chicago-deep-dish(MULTI), chicago-stuffed-pizza-p3(MULTI) | NOT SHORTLISTED: every sauce-bearing candidate is BLOCKED-MULTIPLE |
| 8 | ham | meat-lovers | meat-lovers | meat-lovers | 1: bismarck-pizza-p7(ID) | **SHORTLIST** |
| 9 | corn | bambino | bambino | bambino | 0: — | EXCLUDED: current-material candidate 0 |
| 10 | pineapple | hawaiian | hawaiian | hawaiian | 0: — | EXCLUDED: current-material candidate 0 |
| 11 | black-olive+oregano | capricciosa | capricciosa | capricciosa | 1: pizza-a-caballo(MULTI/no-sauce) | EXCLUDED: no-sauce candidates only |
| 12 | onion | pizza-portuguesa | pizza-portuguesa + brazilian-calabresa | pizza-portuguesa + brazilian-calabresa | 8: aussie(READY/no-sauce), fugazza-p10(MULTI/no-sauce), fugazzeta-rellena(MECH/no-sauce), fugazzetta-p10(MULTI/no-sauce), keema-pizza-p2(AUTH/no-sauce), old-forge-style-pizza-p1(MULTI/no-sauce), pizza-baiana(AUTH/no-sauce), pizza-chilena-p8(AUTH/no-sauce) | EXCLUDED: already C (pizza-portuguesa + brazilian-calabresa) |
| 13 | olive-oil | fugazza | fugazza + brazilian-calabresa | fugazza | 1: margherita-row(MULTI) | NOT SHORTLISTED: every sauce-bearing candidate is BLOCKED-MULTIPLE |
| 14 | garlic | marinara | marinara + brazilian-calabresa | marinara | 3: grandma-pizza(MECH), marinara-pizza-p13(MULTI), pizza-de-cancha(MULTI) | **SHORTLIST** |
| 15 | anchovy | napoletana | napoletana + brazilian-calabresa | napoletana | 2: sfincione(MULTI), siciliana(MULTI) | NOT SHORTLISTED: every sauce-bearing candidate is BLOCKED-MULTIPLE |
| 16 | tuna | tonno-e-cipolla | tonno-e-cipolla + brazilian-calabresa | tonno-e-cipolla | 0: — | EXCLUDED: current-material candidate 0 |
| 17 | pesto | pesto-tonno | pesto-tonno + brazilian-calabresa | pesto-tonno | 0: — | EXCLUDED: current-material candidate 0 |
| 18 | cherry-tomato | genovese | genovese + brazilian-calabresa | genovese | 0: — | EXCLUDED: current-material candidate 0 |
| 19 | clam | new-haven-apizza | new-haven-apizza + brazilian-calabresa | new-haven-apizza | 0: — | EXCLUDED: current-material candidate 0 |
| 20 | fresh-tomato | pesto-caprese | pesto-caprese + brazilian-calabresa | pesto-caprese | 2: argentine-napolitana-p1(MULTI/no-sauce), chilean-napolitana(ID/no-sauce) | EXCLUDED: no-sauce candidates only |
| 21 | potato | pesto-patate | pesto-patate + brazilian-calabresa | pesto-patate | 1: hokkaido-cheese-pizza-p15(AUTH/no-sauce) | EXCLUDED: no-sauce candidates only |
| 22 | rosemary | pizza-bianca | pizza-bianca + brazilian-calabresa | pizza-bianca | 0: — | EXCLUDED: current-material candidate 0 |
| 23 | capers | puttanesca-pizza | puttanesca-pizza + brazilian-calabresa | puttanesca-pizza | 2: caponata-pizza-p2(AUTH/no-sauce), pizza-romana-p9(MULTI) | NOT SHORTLISTED: every sauce-bearing candidate is BLOCKED-MULTIPLE |
| 24 | fontina+gorgonzola | quattro-formaggi | quattro-formaggi + brazilian-calabresa | quattro-formaggi | 1: quattro-formaggi(ID/no-sauce) | EXCLUDED: no-sauce candidates only |
| 25 | chicken | pesto-pollo | brazilian-calabresa + pesto-pollo | pesto-pollo | 1: curry-pizza-japan-p2(AUTH/no-sauce) | EXCLUDED: no-sauce candidates only |

**除外理由の集計**
- Dex 0: 保護（OD-BRANCH-1）。
- candidate 0 件: Step 1–5, 9, 10, 16–19, 22（位置としては置けるが現 30 材料に成立 recipe が無い）。
- 既に C: Step 12。
- no-sauce candidate のみ: Step 11, 20, 21, 24, 25（OD-BRANCH-3）。
- sauce-bearing candidate はあるが **全て BLOCKED-MULTIPLE**: Step 7, 13, 15, 23（§3.5）。

**SHORTLIST の機械的ルール:** sauce-bearing candidate のうち blocker 種別がちょうど 1 種のものが 1 件以上ある Step → **Step 6 / 8 / 14 のみ**。順位ではなく条件の充足。

### 1.1 補足列

| Step | 追加 recipe 未発見時の branch persistence（audit 内部値） | onboarding authority との接触 |
|---|---|---|
| 6 | Step 6〜25 の **20 Step** で pool ≥ 2（Step 12 は C3） | Step 7（食材庫導線）の**手前**。**最初の OPEN_POOL が Step 12 → 6 に移る**（F5/F7） |
| 8 | Step 8〜25 の **18 Step** | Step 7 の後。**最初の OPEN_POOL が Step 12 → 8 に移る** |
| 14 | Step 14〜25 の **12 Step**（Step 12 は既存 C） | **なし**（Step 12 の既存 OPEN_POOL / Notebook 案内の後） |

## 2. STEP 2 — Onboarding evidence

placement audit §3 の F1〜F8 を再利用:

| 境界 | 事実 | 本 shortlist への含意 |
|---|---|---|
| Dex 0 | free・非永続 Margherita hint（`isHintOnboardingFree(0,"margherita")`）。開始 pool を複数にすると `OPEN_POOL` になる（F2） | Step 0 除外 |
| Step 1 | Shop / 有料 hint / NEW MATERIAL notice 初出（F3/F4） | Step 6/8/14 はいずれも後 |
| Step 7 | 全購入前提で食材庫導線が初めて成立（topping 7 > 6、F6） | Step 6 は手前、8 / 14 は後 |
| Step 12 | 現 production 初の OPEN_POOL / Trial Notebook 案内（F5/F7） | Step 6・8 は**前倒し**、Step 14 は**後** |

これ以外に明確な保護境界は無い。**Step 1〜11 のどこまでを保護とするか、Step 12 の「最初の OPEN_POOL」体験を動かしてよいかは OWNER DECISION。** OPEN_POOL の文言は固定で件数・recipe を持たず（#345）、pool 1 ↔ 2+ の 2 値のまま。C 型を増やしても新しい UI 種別は増えない（F8）。

## 3. STEP 3 — Blocker cost（shortlist された Step の candidate）

分類は既存 35 candidate audit のまま。「何を解決すれば production vertical slice になるか」を候補ごとに記す（採用ではない）。

### 3.1 Step 6 — `montreal-style-pizza-pizzadb-p13`（BLOCKED-MECHANIC）
- identity set: mozzarella, mushroom, pepperoni, tomato-sauce（全て既存、Step 6 までに解除済み。**ingredient 追加不要**）。
- authority: MODERATE_WITH_CAVEATS（caveat は `likely_alias×1` のみ。issue なし、未解決 token なし、identity set 完全）。**identity set の不足は無い**。
- identity: 衝突なし（production に同 set 無し。funghi / pepperoni は部分集合で、matcher 規則 1 により別 pizza）。
- mechanic: DOUGH_VARIANT（thick）+ PAN_BAKE。`RUNTIME_SUPPORTED_CAPABILITIES = []`（`src/logic/discovery/signature.ts:87`）で、matcher 規則 2「未対応 capability を要する target は match しない」により **capability 付きのままでは発見不能**。
- 解決の選択肢: (a) DOUGH_VARIANT / PAN_BAKE を実装（172 matrix 上 DOUGH_VARIANT = S、PAN_BAKE = M。**新 mechanic**）／(b) calabresa（production-only target）と同様に capability を外し、**default 次元の production-only target として authoring**（authority からの意図的な簡略化。Owner 判断）。
- 同 Step の他 3 件（fathead / new-england-bar / st-louis）は MULTI で対象外。

### 3.2 Step 8 — `bismarck-pizza-pizzadb-p7`（BLOCKED-IDENTITY）
- identity set: egg, ham, mozzarella, mushroom, tomato-sauce（全て既存）。mechanic dependency **なし**。
- authority: MODERATE_WITH_CAVEATS（caveat は `sauce_from_family_label`：sauce は「トマトソース」という family 表記から導出。issue / 未解決 token なし）。出典は comparison table sample（`corroborationCount: 0`）。
- identity の中身: Phase-2 ledger で `BLOCKED_PRODUCT_DECISION` / `COMPOSITION_CONFLICT_SHIPPED`（shipped:bismarck と **同名「ビスマルク」・同 canonical**）。
  - **matcher 上の衝突ではない**: shipped bismarck = tomato-sauce + mozzarella + egg。p7 はそれに ham + mushroom を足した集合で、matcher 規則 1（superset は original pizza）により一意に区別できる。
  - 問題は **表示名 / 製品判断**（同名 2 recipe の Dex 表示、新 id と nameJa、shipped 側との関係）。
- 解決内容: Owner の命名・製品判断のみ。mechanic・ingredient・matcher の変更は不要。
- `ZONED_PLACEMENT`（卵を中央に置く）は 172 matrix で candidate capability として記載されるが未 promote。shipped bismarck も zone 無しで成立している、という事実のみ記す。

### 3.3 Step 14 — `grandma-pizza-pizzadb`（BLOCKED-MECHANIC）
- identity set: garlic, mozzarella, olive-oil, tomato-sauce（全て既存。Step 14 の garlic で成立）。
- authority: **STRONG**、issue なし、identity set 完全。identity 衝突なし。
- mechanic: MULTI_SPREAD_LAYER（olive-oil と tomato-sauce の 2 spread layer）。`RECIPE_SAUCE_PROFILES` は recipe あたり `ingredientId` 1 つの total Record（`src/data/recipeSauceProfiles.ts`）で、**2 つ目の spread を表す場所が現 engine に無い**。matcher の `sauceBase` は配列なので識別自体は可能だが、塗布・採点・reference の経路は単一 base 前提。
- 解決の選択肢: (a) 多重 spread を実装（**新 mechanic**。paint controller / scoring / reference layout に波及）／(b) 単一 base に畳む（authority の identity を変える。Owner 判断）。
- 同 Step の他 2 件（marinara-pizza / pizza-de-cancha）は MULTI で対象外。

### 3.4 3 件共通で authority の外にあるもの
- **個数・bake window は source authority に無い。** calabresa（D-6）/ pesto-pollo（No.27）と同様 **GAMEPLAY CALIBRATION** として authoring が要る（`minCount`、`bakeTarget`。8 スロット ring の容量内）。blocker の差ではなく 3 件共通。
- 追加の source corroboration が要るか（3 件とも `corroborationCount: 0`）は Owner 判断。

### 3.5 NOT SHORTLISTED の Step の blocker（参考）

| Step | candidate（sauce-bearing は全て MULTI） | 2 種 blocker の内訳 |
|---|---|---|
| 7 | chicago-deep-dish / chicago-stuffed | MECH（PAN_BAKE+STEP_ORDER / DOUGH_VARIANT+ENCLOSE）+ ID（NC-7 命名クラスタ、composition conflict） |
| 13 | margherita-pizzadb-row | MECH（MULTI_SPREAD）+ ID（composition conflict shipped） |
| 15 | sfincione / siciliana | MECH（MULTI_SPREAD / PAN_BAKE+DOUGH）+ ID（NC-3 命名クラスタ、composition conflict） |
| 23 | pizza-romana（他に no-sauce の caponata = AUTH） | MECH（DOUGH_VARIANT thin）+ ID（composition conflict candidate） |

## 4. STEP 4 — Discovery value facts（`ladderCredit:false` で 1 件追加。audit 内部値）

placement audit §2 / §7 の production 述語結果（同一 main）。合成 recipe は位置の事実であり candidate 選定ではない。

| Step k | 追加時の型（U / D） | calabresa 発見済み・branch 未発見 | branch 発見後（false） |
|---|---|---|---|
| 6 | A1 → **C2** / A1 → C2 | **この状態が存在しない**（calabresa は Step 12 まで発見不能）。Step 6〜11 は key + branch の 2 件、Step 12 は C3 | 発見した時点で pool は key 単独（A）に戻る。k と Step 12 以外は A。ladder 到達タイミングは追加前と同一（lead 0） |
| 8 | A1 → C2 / A1 → C2 | 同上（Step 8〜11 が 2 件、Step 12 は C3） | 同上 |
| 14 | **B2 → C3 / A1 → C2** | **Step 14〜25 の 12 Step で pool 2 件（key + branch）が持続**。Step 12 は既存 C | 発見した時点で A に戻る。Step 14 と Step 12 以外は A（lead 0） |

- branch 未発見の間は k〜25 まで毎 Step 2 件以上が続く（k=6 → 20 Step、k=8 → 18 Step、k=14 → 12 Step。Step 12 は常に C）。
- baseline への復帰は **branch を発見した時点**（Step の到達を待たない）。`ladderCredit:false` は全 probe で lead 0。
- 既存セーブで Step k より先にいるプレイヤーは追加 recipe が最初から pool に載る（B 型）。save schema 変更は不要。

## 5. STEP 5 — First C-Step shortlist（順位なし）

| Step | 分類 | 残る理由（事実） | 成立し得る candidate（採用ではない） | 解決すべき blocker | onboarding | persistence |
|---|---|---|---|---|---|---|
| 6 | **SHORTLIST** | sauce-bearing で blocker 1 種の candidate が 1 件。ingredient 追加不要 | `montreal-style-pizza-pizzadb-p13` | MECH: DOUGH_VARIANT + PAN_BAKE を実装、または default 次元の production-only として authoring（Owner） | Step 7 の手前。最初の OPEN_POOL が Step 12 → 6 | 20 Step |
| 8 | **SHORTLIST** | blocker 1 種（ID）、mechanic 不要、ingredient 追加不要 | `bismarck-pizza-pizzadb-p7` | ID: 同名「ビスマルク」の命名・製品判断（matcher 衝突なし） | Step 7 の後。最初の OPEN_POOL が Step 12 → 8 | 18 Step |
| 14 | **SHORTLIST** | blocker 1 種 + authority STRONG。**今回の目的（calabresa 発見済み）が文字通り成立する位置**。onboarding 接触なし | `grandma-pizza-pizzadb` | MECH: MULTI_SPREAD_LAYER を実装、または単一 base へ畳む（Owner） | Step 12 の後。接触なし | 12 Step |
| 1–5, 9, 10, 16–19, 22 | NOT SHORTLISTED | candidate 0 件 | — | — | — | — |
| 7, 13, 15, 23 | NOT SHORTLISTED | sauce-bearing は全て BLOCKED-MULTIPLE | — | — | — | — |
| 11, 20, 21, 24, 25 | NOT SHORTLISTED | no-sauce のみ（OD-BRANCH-3） | — | — | — | — |
| 12 | NOT SHORTLISTED | 既に C | — | — | — | — |
| 0 | NOT SHORTLISTED | Dex 0 保護 | — | — | — | — |

3 Step を同程度とは言っていない。blocker の**種類**（mechanic / identity / mechanic）と onboarding 接触が異なる。1 つへは絞っていない。

## 6. STEP 6 — Vertical slice cost

基準: No.26 calabresa（c0c4f88）と No.27 pesto-pollo（a8637c6）で実際に触ったファイル群。**既存 30 材料のみ。3 Step とも ingredient 追加は不要**（identity set が全て既存材料で完結。ingredient 追加が必要になる場合は shortlist 条件から外れる）。

| 作業 | Step 6 | Step 8 | Step 14 |
|---|---|---|---|
| authority 追加だけで足りるか | 不可（mechanic） | **可**（命名判断のみ） | 不可（mechanic） |
| recipe data（`recipes.ts`。counts / bake calibration、`ladderCredit:false`、`lunchRush`） | 要 | 要 | 要 |
| 総 Record（`RECIPE_SAUCE_PROFILES` / `RECIPE_HINT_ROLES` / `RECIPE_DISCOVERY_TARGET_IDS` / `orders.ts`） | 要 | 要 | 要（olive-oil の扱いが mechanic 課題） |
| `referencePizza.ts` の reference layout + scoreParity JSON | 要 | 要 | 要 |
| matcher / catalog test、ladder・Dex・hint 既存 test の件数更新 | 要 | 要 | 要 |
| discovery state / Hint / Notebook / Pantry・Search | 既存経路で足りる（新 UI なし） | 同左 | 同左 |
| 新 mechanic | **有（(a) の場合）** DOUGH_VARIANT + PAN_BAKE | **無** | **有（(a) の場合）** MULTI_SPREAD_LAYER |
| 簡略化（(b) の場合） | dough / pan 次元を落とす | — | 2 spread を 1 base に畳む |
| `ladderCredit:false` | 要（OD-BRANCH-2） | 要 | 要 |
| economy / shop 変更 | 無 | 無 | 無 |
| save migration | 無 | 無 | 無 |
| Step 12 体験の変更 | **有**（最初の OPEN_POOL 前倒し） | **有** | 無 |
| E2E / HV | pool 2 件の Hint / Dex 集約 / Notebook / Trial の実機確認（390×844）+ Step 12 前倒しの体験確認 | 同左 | 同左（Step 12 体験は不変） |

mechanic を新設する Step 6 / 14 では、vertical slice に recipe 以外の作業が混ざる。簡略化 (b) を許すか否かは次の Decision（recipe 採用）に分離する。

## 7. STEP 7 — Owner Decision

### OD-FIRST-C-STEP
最初の追加 C 型 Step を **{Step 6, Step 8, Step 14}** のどこにするか。

| | Step 6 | Step 8 | Step 14 |
|---|---|---|---|
| 解除材料 / key | pepperoni | ham / meat-lovers | garlic / marinara |
| calabresa 発見済みで複数推理（今回の目的） | 成立しない（状態が存在しない） | 成立しない | **成立** |
| Step 12 の「最初の OPEN_POOL」 | **前倒しされる** | **前倒しされる** | 不変 |
| Step 7 食材庫導線との前後 | 手前 | 後 | 後 |
| onboarding authority との接触 | F5/F7（+ F6 の手前） | F5/F7 | なし |
| 成立し得る candidate（採用ではない） | montreal-style（MECH） | bismarck-p7（ID） | grandma（MECH） |
| 解決内容 | 新 mechanic ×2 または簡略化 | 命名・製品判断のみ | 新 mechanic ×1（多重 spread）または簡略化 |
| authority 強度 | MODERATE_WITH_CAVEATS | MODERATE_WITH_CAVEATS | STRONG |
| 未発見時の persistence | 20 Step | 18 Step | 12 Step |
| ingredient 追加 / save migration / economy 変更 | 無 / 無 / 無 | 無 / 無 / 無 | 無 / 無 / 無 |

**別 Decision に分離（今回は決めない）:** どの recipe を採用するか、blocker の解決方法（mechanic 実装か簡略化か、命名）、個数・bake window、`lunchRush`、No.28 の確定。Step 6/8 を選ぶ場合は「最初の OPEN_POOL を Step 12 より前倒ししてよいか」が前提として付随する。

## 8. 本書がしなかったこと / 限界

- recipe 選定・ranking・推奨・`ladderCredit` / `lunchRush` の確定・実装・Issue / PR・R6 / IP-2。
- production 述語の再実行（placement audit の値を同一 main SHA 前提で再利用）。35 candidate / 172 recipe の再抽出・再監査。
- 数値前提: 毎 Step 材料を全購入／合成 recipe は `tomato-sauce + mozzarella + その Step の新材料`（audit §0）。
- full Vitest / E2E / WebKit / build / HV / screenshots / Preview は docs-only のため未実施。一時 script は commit していない。
