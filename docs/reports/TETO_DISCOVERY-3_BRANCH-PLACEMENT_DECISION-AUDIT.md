# Discovery 3.0 — Branch Placement Decision Audit（DECISION AUDIT / DOCS ONLY）

**種別:** 判断材料の整理のみ（docs/data only）。production code・recipe・ingredient・ladder・save schema は未変更。PR / Issue 未作成。**No.28 は選ばない。candidate は選ばない・順位付けしない・推奨しない。** 配置（どの Step に分岐を置くか）・`ladderCredit`・no-sauce の扱いは全て **Owner 未決定**。R6 / IP-2 へは進まない。

| 項目 | 値 |
|---|---|
| 基準 `origin/main` | `262b09fcb78d98c7b12ea4e5b51c2da1bca9d37e`（fresh fetch で一致を確認） |
| production | 27 recipes / 30 ingredients / 25 ladder steps（step 25 = `chicken` → `pesto-pollo`）。non-credit は `brazilian-calabresa` のみ |
| 機械可読 companion | `docs/reports/data/TETO_DISCOVERY-3_BRANCH-PLACEMENT.json`（Step 別 map・35 candidate の分類・scenario 指標） |
| 再利用した既存成果物（再抽出・再監査なし） | ① `TETO_DISCOVERY-3_BRANCHING-EXPANSION_DESIGN.md` / `…BRANCHING-EXPANSION.json`（`origin/claude/discovery-3-branching-design-hv8sly` @ `eea7c98`、**main 未取り込み**。35 candidate・slot probe の元）② `TETO_DISCOVERY-3_CANDIDATE-COUNT-LEAK-GUARD_FRESH_AUDIT.md`（`origin/claude/discovery-candidate-count-audit-76uwlw`、**main 未取り込み**。契約は #345 で実装済み）③ `TETO_DISCOVERY-3_UNLOCK-DISCOVERY-EXPERIENCE_FRESH_AUDIT.md`（`origin/claude/teto-discovery-3-audit-uzr1za` @ `84e5091`、**main 未取り込み**）④ 172 readiness JSON（`origin/claude/discovery-3-172-recipe-readiness-audit` @ `cceedce`。branching JSON 経由で利用、再監査なし） |

## 0. 方法

- 既存の使い捨て harness 方式を踏襲し、production の述語（`recipeDiscoveryState` / `selectHintTarget` / `resolveShopEntitlement` / `reachedStepNumber` / `isHintOnboardingFree` / `countsTowardLadder`）を **read-only** で実行した。harness は commit していない。`RECIPES` / ladder は変更していない。
- 追加 recipe の「もしも」は **合成 recipe**（`tomato-sauce + mozzarella + その Step の新材料` だけ。個数・bakeTarget は無関係）を `recipes` 引数へ注入して評価した。**位置（slot）の事実であり、candidate の選定ではない。**
- **Pool** = 「その Step の材料を全て購入した直後に DISCOVERABLE な未発見 recipe の集合」。**U** = calabresa 未発見、**D** = calabresa 発見済み。型は A（候補 1）／B（以前から発見可能な未発見が残るため複数）／C（その Step で新規に 2 件以上が同時に DISCOVERABLE = 発見履歴に依存せず必ず複数）。
- 35 candidate = 現 production 30 材料だけで identity set が成立する未実装 recipe（branching JSON）。candidate 分類は readiness の既存フィールド（authority / mechanicDependencies / identityCollisions）から機械的に導出（§5）。
- pool 件数は **監査値（dev / audit 専用）**。player-facing に件数を出す提案ではない（§9）。

## 1. STEP 1 — Latest-main confirmation

**結論: material difference なし。再監査していない。**

| 確認項目 | 既存監査の基準（`544db65`, #343 merge 後） | 最新 main `262b09f` の production authority | 差分 |
|---|---|---|---|
| recipes / ingredients / ladder | 27 / 30 / 25 | **27 / 30 / 25**（read-only 実行） | なし |
| step 25 | `chicken` → `pesto-pollo` | `{ingredientIds:["chicken"], keyRecipeId:"pesto-pollo"}` | なし |
| non-credit | `brazilian-calabresa` のみ | `brazilian-calabresa` のみ | なし |
| Step 1–11 / 12 / 13–25 の型 | A / C / conditional B | §2 の map を production predicate で再計算し、既存監査の map と **全 25 行一致**（U/D pool・hint 種別・購入前窓とも） | なし |
| #345 の差分 | — | `544db65..262b09f` は `src/state/pizzaSelect.ts`（`PizzaSelectPrompt` の `DISCOVERABLE`/`SHOP` から `count` を削除、`> 0` の存在判定のみ）と guard test `pizzaSelect.promptCountGuard.test.ts`（新規）の **2 ファイルのみ**。`src/data/*`（recipes / ingredients / ladder）・pool / hint / Dex / persistence は未変更。コミットメッセージも "No player-facing change" | **player-facing behavior / ladder / pool に変化なし** |

step 12 の購入前窓（既存性質の再確認）: step 12 は U/D とも購入前 pool が空で `SHOP_NEW`（calabresa を購入前に発見できない唯一の step）。step 13–25 の U は購入前 pool = {calabresa} 単独 → `TARGET`、購入後は `OPEN_POOL`。


## 2. STEP 2 — Placement-first map（Step 1〜25）

列の読み方: **U pool / D pool** = 現 production（追加なし）の購入後 pool。**追加時の型変化** = 既存材料だけの recipe をその Step（= その recipe の earliest step）に 1 件足した場合の `U → 追加後` / `D → 追加後`。**未発見のまま影響する Step 数** = その recipe を発見しない間 pool に載り続ける Step 数（k〜25 = 26−k）。**ladderCredit:false** でその recipe を発見すれば、k と step 12 以外は A に戻る（§6/§7）。**現 30 材料の candidate** = earliest step がちょうど k の件数（うち READY）／ k までの累計。

| Step k | 解除材料 | key recipe | U pool（現） | D pool（現） | 追加時の型変化（U / D） | 未発見で影響する Step 数 | 現30材料 candidate（READY）/ 累計 |
|---|---|---|---|---|---|---|---|
| 0（開始時） | starter のみ | —（margherita） | — | — | A1→B2 / A1→B2（**開始 pool が 2 件**。Dex 0 に接触、§3） | 26（開始〜25） | 6（0）/ 6 |
| 1 | egg | bismarck | bismarck (A1) | bismarck (A1) | A1→C2 / A1→C2 | 25 | 0（0）/ 6 |
| 2 | bacon | breakfast-pizza | breakfast-pizza (A1) | breakfast-pizza (A1) | A1→C2 / A1→C2 | 24 | 0（0）/ 6 |
| 3 | mushroom | funghi | funghi (A1) | funghi (A1) | A1→C2 / A1→C2 | 23 | 0（0）/ 6 |
| 4 | eggplant | melanzane-pizza | melanzane-pizza (A1) | melanzane-pizza (A1) | A1→C2 / A1→C2 | 22 | 0（0）/ 6 |
| 5 | parmigiano | parmigiana-pizza | parmigiana-pizza (A1) | parmigiana-pizza (A1) | A1→C2 / A1→C2 | 21 | 0（0）/ 6 |
| 6 | pepperoni | pepperoni | pepperoni (A1) | pepperoni (A1) | A1→C2 / A1→C2 | 20 | 4（0）/ 10 |
| 7 | sausage | salsiccia | salsiccia (A1) | salsiccia (A1) | A1→C2 / A1→C2 | 19 | 2（0）/ 12 |
| 8 | ham | meat-lovers | meat-lovers (A1) | meat-lovers (A1) | A1→C2 / A1→C2 | 18 | 1（0）/ 13 |
| 9 | corn | bambino | bambino (A1) | bambino (A1) | A1→C2 / A1→C2 | 17 | 0（0）/ 13 |
| 10 | pineapple | hawaiian | hawaiian (A1) | hawaiian (A1) | A1→C2 / A1→C2 | 16 | 0（0）/ 13 |
| 11 | black-olive+oregano | capricciosa | capricciosa (A1) | capricciosa (A1) | A1→C2 / A1→C2 | 15 | 1（0）/ 14 |
| 12 | onion | pizza-portuguesa | pizza-portuguesa+brazilian-calabresa (C2) | pizza-portuguesa+brazilian-calabresa (C2) | C2→C3 / C2→C3 | 14 | 8（1）/ 22 |
| 13 | olive-oil | fugazza | fugazza+brazilian-calabresa (B2) | fugazza (A1) | B2→C3 / A1→C2 | 13 | 1（0）/ 23 |
| 14 | garlic | marinara | marinara+brazilian-calabresa (B2) | marinara (A1) | B2→C3 / A1→C2 | 12 | 3（0）/ 26 |
| 15 | anchovy | napoletana | napoletana+brazilian-calabresa (B2) | napoletana (A1) | B2→C3 / A1→C2 | 11 | 2（0）/ 28 |
| 16 | tuna | tonno-e-cipolla | tonno-e-cipolla+brazilian-calabresa (B2) | tonno-e-cipolla (A1) | B2→C3 / A1→C2 | 10 | 0（0）/ 28 |
| 17 | pesto | pesto-tonno | pesto-tonno+brazilian-calabresa (B2) | pesto-tonno (A1) | B2→C3 / A1→C2 | 9 | 0（0）/ 28 |
| 18 | cherry-tomato | genovese | genovese+brazilian-calabresa (B2) | genovese (A1) | B2→C3 / A1→C2 | 8 | 0（0）/ 28 |
| 19 | clam | new-haven-apizza | new-haven-apizza+brazilian-calabresa (B2) | new-haven-apizza (A1) | B2→C3 / A1→C2 | 7 | 0（0）/ 28 |
| 20 | fresh-tomato | pesto-caprese | pesto-caprese+brazilian-calabresa (B2) | pesto-caprese (A1) | B2→C3 / A1→C2 | 6 | 2（0）/ 30 |
| 21 | potato | pesto-patate | pesto-patate+brazilian-calabresa (B2) | pesto-patate (A1) | B2→C3 / A1→C2 | 5 | 1（0）/ 31 |
| 22 | rosemary | pizza-bianca | pizza-bianca+brazilian-calabresa (B2) | pizza-bianca (A1) | B2→C3 / A1→C2 | 4 | 0（0）/ 31 |
| 23 | capers | puttanesca-pizza | puttanesca-pizza+brazilian-calabresa (B2) | puttanesca-pizza (A1) | B2→C3 / A1→C2 | 3 | 2（0）/ 33 |
| 24 | fontina+gorgonzola | quattro-formaggi | quattro-formaggi+brazilian-calabresa (B2) | quattro-formaggi (A1) | B2→C3 / A1→C2 | 2 | 1（0）/ 34 |
| 25 | chicken | pesto-pollo | brazilian-calabresa+pesto-pollo (B2) | pesto-pollo (A1) | B2→C3 / A1→C2 | 1 | 1（0）/ 35 |

読み取り（事実のみ）:
- **Step 1–11:** U/D とも A。どこに 1 件足しても **A→C**（履歴非依存で必ず複数）。足した recipe を発見しない間、k〜25 まで pool 2 件以上が続く（k=1 なら 25 Step、k=11 なら 15 Step）。
- **Step 12:** 既に C。1 件足すと C2→C3（C step の数は増えない。件数だけ増える）。
- **Step 13–25:** U は B2→C3、**D（calabresa 発見済み）は A1→C2**。= calabresa を早く見つけたプレイヤーに **新しく** 複数 recipe の推理場所を作れるのは、この「既存材料を足す」追加だけ（既存の B は calabresa 依存で、発見すると消える）。
- **現 30 材料に candidate が 0 件の位置:** Step 1–5、9–10、16–19、22（位置としては置けても、既存材料だけで成立する recipe が現 candidate に無い）。
- **pool ≥ 3 は現在どの Step にも無い**（現状の最大 pool = 2、step 12–25 の U）。

## 3. STEP 3 — Onboarding boundary

### 3.1 production code / docs で確認できた事実（Step との対応）

| # | 事実 | Step への対応 | 根拠（production code / docs） |
|---|---|---|---|
| F1 | Dex 0 では margherita だけが DISCOVERABLE。hint の自動 target = margherita、**free（無料・非永続）** の Hint 2.0 reveal（OD-HE-5）。`isHintOnboardingFree(0,"margherita")` = true。Pizza Select は未発見 recipe を隠す pre-discovery gate、Free Cooking が主導線、pre-first-discovery の 4 段階 hint escalation | **Step 0（Dex 0）** | `hintPurchase.ts:50`、`discoveryHint.ts` L19-38、`TETO_PROGRESSION2_P3-3_ONBOARDING_Result.md`、`TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md`（OD-HE-5 は維持） |
| F2 | **Dex 0 の開始 pool に starter だけで成立する recipe を 1 件足すと**、`selectHintTarget` は `OPEN_POOL`（現 production は `TARGET:margherita`）。target が無いので free な margherita 無料 reveal の前提（session target = margherita）が成立しない。（Dex 1 で margherita 発見済みなら、その足した recipe は単独 `TARGET` になる） | k=0 を作ると Step 0 の onboarding が変わる | probe（`dex0WithStarterOnlyExtra` = {"kind": "OPEN_POOL"}） |
| F3 | 初回発見で **Pitz +50 の first-discovery bonus**。hint は Dex ≥ 1 から有料（`isHintOnboardingFree(1,…)` = false）。Selectable / Hint 5.0 の rung 価格は rung 種別で固定（H5-0 §G-PRICE） | Step 1 以降は常に「有料 hint」 | `pitzReward.ts:44`、`hintPurchase.ts`、H5-0 §G-PRICE |
| F4 | Shop（REC-04 材料 Shop）は **Dex（credited）≥ 1 で最初の材料（step 1）** が entitle される。結果画面の NEW MATERIAL notice、HOME の Shop 「NEW n」バッジが初出 | **Step 1**（= 発見 1 件目の直後） | `discoveryLadder.ts`（OD-REC04-1）、`materialEntitlement.ts`、`ResultPanel.tsx` / `HomeScreen.tsx` |
| F5 | Trial Notebook の入口（📓 試作ノートを見る）は **Hint シートのヘッダに常設**（FREE cooking の PREPARE 中、どの hint 種別でも）。ただし **ノートの存在を文章で案内するのは OPEN_POOL の固定文言**（`OPEN_POOL_ACTIONS.notebook`）。A 区間（pool 1）では案内文が出ない | 入口は常時。**案内の初出 = 最初の OPEN_POOL（現 production では step 12）** | `HintSheet.tsx` L278 / L379-382、`openPoolCopy.ts` |
| F6 | 食材庫（pantry）は **所持材料がカテゴリ内で 6 超**（`MAX_INGREDIENT_PALETTE_SLOTS = 6`）で `pantryWorthwhile`。全購入前提の所持数（sauce/cheese/topping）は step 6 で topping=6、**step 7 で topping=7（初めて 6 超）**。OPEN_POOL からの食材庫導線は `pantryWorthwhile` でのみ出る（それ以前の OPEN_POOL は 固定文言 + ノート案内のみ。導線ボタンなし） | **Step 7 以降**（全購入した場合。未購入なら遅れる） | `pantryAvailability.ts`、`GameScreen.tsx` L347-361、`HintSheet.tsx` L383-392。probe の所持数: 全購入前提 |
| F7 | 現 production の **最初の複数候補（OPEN_POOL）は step 12**（= credited 発見 12 件後、ladder の半ばより手前）。つまり production は「Step 1–11 は単線のまま 11 回の発見を重ねてから最初の選択」という経験を既に持つ | Step 12（既存の唯一の C） | §2、`discoveryProgressionModel.ts`（A/B/C 分類） |
| F8 | OPEN_POOL / Dex 集約カード（pool ≥ 2）の文言は固定で、件数・slot・recipe を持たない（#345 契約）。**A→C 型へ変わっても player-facing UI の種類は増えない**（pool 1 ↔ 2+ の既存 2 値のまま） | 全 Step | `openPoolCopy.ts`、`DexOverlay.tsx`（aggregateUnknown）、leak-guard audit |

### 3.2 A（保護）/ B（移行）/ C（本格）に分けられるか

- **A. onboarding 保護区間 — authority あり（Step 0 / Dex 0 のみ）:** F1・F2。Dex 0 の free margherita onboarding と pre-discovery gate は P3-3 / OD-HE-5 の確定仕様で、開始 pool を 1 件（margherita）のまま保つことが前提。**これより先の「保護 Step 数」を定めた authority は docs / code のどこにも存在しない**（`PROJECT_HANDOFF.md` にも numeric な保護範囲の記述なし）。
- **B. 移行区間 / C. 本格区間 — authority なし → OWNER DECISION REQUIRED。** 事実としての境界候補（どれも根拠のある「出来事」であって UX 判断ではない）:
  | 境界の目印 | Step | 意味（事実のみ） |
  |---|---|---|
  | 最初の材料 Shop・有料 hint・NEW MATERIAL notice | 1 | F3・F4。Dex 1 の直後に 3 つが同時に初出 |
  | 食材庫が worthwhile になる最初の Step | 7（全購入時） | F6。ここより前の OPEN_POOL は食材庫導線なし |
  | 現 production の最初の OPEN_POOL / ノート案内 | 12 | F5・F7。既存の「複数候補」初体験 |
  | ladder 凍結範囲（LAD-1）の終端 | 24（`W1_FIXED_STEP_COUNT`） | step 25 は append 済み（既存 ladder の変更は不要という事実） |
- したがって **Step 1〜11 を「全部同じ」扱いにはできない**（Step 1 / 〜6 / 〜11 で出来事が異なる）が、**どこからを B・C と呼ぶかは判断材料（上表）だけでは決まらない** → **OD-BRANCH-1**（§8）。


## 4. STEP 4 — Candidate intersection（Step × candidate。ランキングなし）

「**k までに解除済みの材料だけで成立**」= earliest step ≤ k（累計）。「**ちょうど k**」= earliest step = k（その Step で新規 DISCOVERABLE になる = C 型を作れる位置）。分類記号は §5（R=READY / A=BLOCKED-AUTHORITY / M=BLOCKED-MECHANIC / I=BLOCKED-IDENTITY / X=BLOCKED-MULTIPLE）。

| Step k | 累計（≤k） | ちょうど k | ちょうど k の candidate id（分類） |
|---|---|---|---|
| 0 | 6 | 6 | `cauliflower-crust-pizza-pizzadb-p2`（X）<br>`colorado-mountain-pie-pizzadb-p3`（X）<br>`ny-style-pizzadb`（X）<br>`pizza-al-taglio-romana-pizzadb-p9`（X）<br>`quad-cities-style-pizza-pizzadb-p2`（X）<br>`trenton-tomato-pie-pizzadb`（X） |
| 1 | 6 | 0 | —（0 件） |
| 2 | 6 | 0 | —（0 件） |
| 3 | 6 | 0 | —（0 件） |
| 4 | 6 | 0 | —（0 件） |
| 5 | 6 | 0 | —（0 件） |
| 6 | 10 | 4 | `fathead-pizza-keto-pizzadb-p9`（X）<br>`montreal-style-pizza-pizzadb-p13`（M）<br>`new-england-bar-pizza-pizzadb-p6`（X）<br>`st-louis-style-pizza-pizzadb-p4`（X） |
| 7 | 12 | 2 | `chicago-deep-dish-pizzadb`（X）<br>`chicago-stuffed-pizza-pizzadb-p3`（X） |
| 8 | 13 | 1 | `bismarck-pizza-pizzadb-p7`（I） |
| 9 | 13 | 0 | —（0 件） |
| 10 | 13 | 0 | —（0 件） |
| 11 | 14 | 1 | `pizza-a-caballo`（X） |
| 12 | 22 | 8 | `aussie-pizzadb`（R）<br>`fugazza-pizzadb-p10`（X）<br>`fugazzeta-rellena`（M）<br>`fugazzetta-pizzadb-p10`（X）<br>`keema-pizza-pizzadb-p2`（A）<br>`old-forge-style-pizza-pizzadb-p1`（X）<br>`pizza-baiana`（A）<br>`pizza-chilena-pizzadb-p8`（A） |
| 13 | 23 | 1 | `margherita-pizzadb-row`（X） |
| 14 | 26 | 3 | `grandma-pizza-pizzadb`（M）<br>`marinara-pizza-pizzadb-p13`（X）<br>`pizza-de-cancha`（X） |
| 15 | 28 | 2 | `sfincione-pizzadb`（X）<br>`siciliana-pizzadb`（X） |
| 16 | 28 | 0 | —（0 件） |
| 17 | 28 | 0 | —（0 件） |
| 18 | 28 | 0 | —（0 件） |
| 19 | 28 | 0 | —（0 件） |
| 20 | 30 | 2 | `argentine-napolitana-pizzadb-p1`（X）<br>`chilean-napolitana-pizzadb`（I） |
| 21 | 31 | 1 | `hokkaido-cheese-pizza-pizzadb-p15`（A） |
| 22 | 31 | 0 | —（0 件） |
| 23 | 33 | 2 | `caponata-pizza-pizzadb-p2`（A）<br>`pizza-romana-pizzadb-p9`（X） |
| 24 | 34 | 1 | `quattro-formaggi-pizzadb`（I） |
| 25 | 35 | 1 | `curry-pizza-japan-pizzadb-p2`（A） |

### 4.1 candidate 全 35 件の属性（earliest step 昇順。`…BRANCHING-EXPANSION.json` の再利用。再抽出なし）

blocker の種類: **AUTH** = authority 不完全（identity set 未確定 / 曖昧 token / sauce base 未指定 / evidence gap）、**MECH** = 現行調理手順で表せない capability 依存、**ID** = 既存 recipe・他 candidate・名称系統との識別問題。special: **no-sauce**（identity set に sauce 材料なし）／ **no-cheese** ／ **thin**（thin 生地記述）／ late-topping（該当 0 件）。

| row id | earliest | required ingredients | sauce / base | authority | mechanic dependency | identity / naming collision | special | 分類 |
|---|---|---|---|---|---|---|---|---|
| `cauliflower-crust-pizza-pizzadb-p2` | 0 | basil, mozzarella, tomato-sauce | tomato-sauce | MODERATE_WITH_CAVEATS | DOUGH_VARIANT | MATRIX_COLLISION_LEDGER:P0-COLL-2; SAME_SET_AS_PRODUCTION:margherita; SAME_SET_AS_ROWS:pizza-al-taglio-romana-pizzadb-p9 | — | BLOCKED-MULTIPLE |
| `colorado-mountain-pie-pizzadb-p3` | 0 | mozzarella | なし（family_derived） | INCOMPLETE / EVIDENCE_GAP | DOUGH_VARIANT | — | no-sauce | BLOCKED-MULTIPLE |
| `ny-style-pizzadb` | 0 | mozzarella, tomato-sauce | tomato-sauce | STRONG | DOUGH_VARIANT | MATRIX_COLLISION_LEDGER:P0-COLL-1; SAME_SET_AS_ROWS:trenton-tomato-pie-pizzadb | thin | BLOCKED-MULTIPLE |
| `pizza-al-taglio-romana-pizzadb-p9` | 0 | basil, mozzarella, tomato-sauce | tomato-sauce | MODERATE_WITH_CAVEATS | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | MATRIX_COLLISION_LEDGER:P0-COLL-2; SAME_SET_AS_PRODUCTION:margherita; SAME_SET_AS_ROWS:cauliflower-crust-pizza-pizzadb-p2 | — | BLOCKED-MULTIPLE |
| `quad-cities-style-pizza-pizzadb-p2` | 0 | mozzarella ※不完全 | なし（family_derived） | INCOMPLETE / UNRESOLVED_INGREDIENT | DOUGH_VARIANT | — | no-sauce, thin | BLOCKED-MULTIPLE |
| `trenton-tomato-pie-pizzadb` | 0 | mozzarella, tomato-sauce | tomato-sauce | STRONG | STEP_ORDER | MATRIX_COLLISION_LEDGER:P0-COLL-1; SAME_SET_AS_ROWS:ny-style-pizzadb | — | BLOCKED-MULTIPLE |
| `fathead-pizza-keto-pizzadb-p9` | 6 | mozzarella, pepperoni, tomato-sauce | tomato-sauce | MODERATE_WITH_CAVEATS | DOUGH_VARIANT | MATRIX_COLLISION_LEDGER:P0-COLL-3; SAME_SET_AS_PRODUCTION:pepperoni; SAME_SET_AS_ROWS:new-england-bar-pizza-pizzadb-p6 | — | BLOCKED-MULTIPLE |
| `montreal-style-pizza-pizzadb-p13` | 6 | mozzarella, mushroom, pepperoni, tomato-sauce | tomato-sauce | MODERATE_WITH_CAVEATS | DOUGH_VARIANT, PAN_BAKE | — | — | BLOCKED-MECHANIC |
| `new-england-bar-pizza-pizzadb-p6` | 6 | mozzarella, pepperoni, tomato-sauce | tomato-sauce | MODERATE_WITH_CAVEATS | DOUGH_VARIANT, PAN_BAKE | MATRIX_COLLISION_LEDGER:P0-COLL-3; SAME_SET_AS_PRODUCTION:pepperoni; SAME_SET_AS_ROWS:fathead-pizza-keto-pizzadb-p9 | thin | BLOCKED-MULTIPLE |
| `st-louis-style-pizza-pizzadb-p4` | 6 | pepperoni ※不完全 | なし（family_derived） | INCOMPLETE / UNRESOLVED_INGREDIENT | DOUGH_VARIANT | — | no-sauce, no-cheese, thin | BLOCKED-MULTIPLE |
| `chicago-deep-dish-pizzadb` | 7 | mozzarella, pepperoni, sausage, tomato-sauce | tomato-sauce | STRONG / COMPOSITION_CONFLICT_CANDIDATE | PAN_BAKE, STEP_ORDER | COMPOSITION_CONFLICT_CANDIDATE; NAMING_CLUSTER:NC-7-chicago | — | BLOCKED-MULTIPLE |
| `chicago-stuffed-pizza-pizzadb-p3` | 7 | mozzarella, sausage, tomato-sauce | tomato-sauce | MODERATE_WITH_CAVEATS | DOUGH_VARIANT, ENCLOSE | NAMING_CLUSTER:NC-7-chicago; SAME_SET_AS_PRODUCTION:salsiccia | — | BLOCKED-MULTIPLE |
| `bismarck-pizza-pizzadb-p7` | 8 | egg, ham, mozzarella, mushroom, tomato-sauce | tomato-sauce | MODERATE_WITH_CAVEATS / COMPOSITION_CONFLICT_SHIPPED | — | COMPOSITION_CONFLICT_SHIPPED | — | BLOCKED-IDENTITY |
| `pizza-a-caballo` | 11 | black-olive, mozzarella, oregano | なし（none） | INCOMPLETE / EVIDENCE_GAP | DOUGH_VARIANT, ENCLOSE | — | no-sauce | BLOCKED-MULTIPLE |
| `aussie-pizzadb` | 12 | bacon, egg, mozzarella, onion | なし（none） | STRONG | — | — | no-sauce | READY |
| `fugazza-pizzadb-p10` | 12 | mozzarella, onion, oregano | なし（none） | MODERATE / COMPOSITION_CONFLICT_SHIPPED; DISCOVERY_COLLISION | DOUGH_VARIANT | COMPOSITION_CONFLICT_SHIPPED; DISCOVERY_COLLISION; MATRIX_COLLISION_LEDGER:P0-COLL-5; SAME_SET_AS_ROWS:fugazzetta-pizzadb-p10 | no-sauce | BLOCKED-MULTIPLE |
| `fugazzeta-rellena` | 12 | ham, mozzarella, onion, oregano | なし（none） | STRONG | DOUGH_VARIANT, ENCLOSE | — | no-sauce | BLOCKED-MECHANIC |
| `fugazzetta-pizzadb-p10` | 12 | mozzarella, onion, oregano | なし（none） | MODERATE / COMPOSITION_CONFLICT_CANDIDATE; DISCOVERY_COLLISION | DOUGH_VARIANT | COMPOSITION_CONFLICT_CANDIDATE; DISCOVERY_COLLISION; MATRIX_COLLISION_LEDGER:P0-COLL-5; SAME_SET_AS_ROWS:fugazza-pizzadb-p10 | no-sauce | BLOCKED-MULTIPLE |
| `keema-pizza-pizzadb-p2` | 12 | mozzarella, onion ※不完全 | なし（unspecified） | INCOMPLETE / BASE_SAUCE_UNSPECIFIED; UNRESOLVED_INGREDIENT | — | — | no-sauce, thin | BLOCKED-AUTHORITY |
| `old-forge-style-pizza-pizzadb-p1` | 12 | onion ※不完全 | なし（family_derived） | INCOMPLETE / UNRESOLVED_INGREDIENT | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | — | no-sauce, no-cheese | BLOCKED-MULTIPLE |
| `pizza-baiana` | 12 | egg, mozzarella, onion, sausage ※不完全 | なし（family_derived） | INCOMPLETE / UNRESOLVED_INGREDIENT | — | — | no-sauce, thin | BLOCKED-AUTHORITY |
| `pizza-chilena-pizzadb-p8` | 12 | black-olive, egg, mozzarella, onion ※不完全 | なし（family_derived） | INCOMPLETE / UNRESOLVED_INGREDIENT | — | — | no-sauce, thin | BLOCKED-AUTHORITY |
| `margherita-pizzadb-row` | 13 | basil, mozzarella, olive-oil, tomato-sauce | olive-oil, tomato-sauce | MODERATE_WITH_CAVEATS / COMPOSITION_CONFLICT_SHIPPED | MULTI_SPREAD_LAYER | COMPOSITION_CONFLICT_SHIPPED | thin | BLOCKED-MULTIPLE |
| `grandma-pizza-pizzadb` | 14 | garlic, mozzarella, olive-oil, tomato-sauce | olive-oil, tomato-sauce | STRONG | MULTI_SPREAD_LAYER | — | — | BLOCKED-MECHANIC |
| `marinara-pizza-pizzadb-p13` | 14 | garlic, olive-oil, oregano, tomato-sauce | olive-oil, tomato-sauce | MODERATE_WITH_CAVEATS / COMPOSITION_CONFLICT_SHIPPED | MULTI_SPREAD_LAYER | COMPOSITION_CONFLICT_SHIPPED | no-cheese | BLOCKED-MULTIPLE |
| `pizza-de-cancha` | 14 | garlic, olive-oil, oregano ※不完全 | olive-oil | INCOMPLETE / UNRESOLVED_INGREDIENT | DOUGH_VARIANT, MULTI_SPREAD_LAYER | — | no-cheese | BLOCKED-MULTIPLE |
| `sfincione-pizzadb` | 15 | anchovy, olive-oil, onion, oregano, tomato-sauce | olive-oil, tomato-sauce | MODERATE_WITH_CAVEATS | MULTI_SPREAD_LAYER | NAMING_CLUSTER:NC-3-sicilian | no-cheese | BLOCKED-MULTIPLE |
| `siciliana-pizzadb` | 15 | anchovy, mozzarella, onion, tomato-sauce | tomato-sauce | STRONG / COMPOSITION_CONFLICT_CANDIDATE | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, PAN_BAKE | COMPOSITION_CONFLICT_CANDIDATE; NAMING_CLUSTER:NC-3-sicilian | — | BLOCKED-MULTIPLE |
| `argentine-napolitana-pizzadb-p1` | 20 | fresh-tomato, garlic, mozzarella, oregano, parmigiano | なし（none） | MODERATE_WITH_CAVEATS | DOUGH_VARIANT | NAMING_CLUSTER:NC-1-napoletana | no-sauce | BLOCKED-MULTIPLE |
| `chilean-napolitana-pizzadb` | 20 | fresh-tomato, mozzarella, oregano | なし（none） | STRONG | — | NAMING_CLUSTER:NC-1-napoletana | no-sauce | BLOCKED-IDENTITY |
| `hokkaido-cheese-pizza-pizzadb-p15` | 21 | bacon, corn, potato ※不完全 | なし（none） | INCOMPLETE / UNRESOLVED_INGREDIENT | — | — | no-sauce, no-cheese, thin | BLOCKED-AUTHORITY |
| `caponata-pizza-pizzadb-p2` | 23 | black-olive, capers, eggplant, mozzarella ※不完全 | なし（unspecified） | INCOMPLETE / BASE_SAUCE_UNSPECIFIED | — | — | no-sauce | BLOCKED-AUTHORITY |
| `pizza-romana-pizzadb-p9` | 23 | anchovy, capers, mozzarella, oregano, tomato-sauce | tomato-sauce | MODERATE_WITH_CAVEATS / COMPOSITION_CONFLICT_CANDIDATE | DOUGH_VARIANT | COMPOSITION_CONFLICT_CANDIDATE | thin | BLOCKED-MULTIPLE |
| `quattro-formaggi-pizzadb` | 24 | fontina, gorgonzola, mozzarella, parmigiano | なし（none） | STRONG / COMPOSITION_CONFLICT_SHIPPED | — | COMPOSITION_CONFLICT_SHIPPED | no-sauce | BLOCKED-IDENTITY |
| `curry-pizza-japan-pizzadb-p2` | 25 | chicken, mozzarella, onion ※不完全 | なし（listed_unresolved） | INCOMPLETE / UNRESOLVED_INGREDIENT | — | — | no-sauce, thin | BLOCKED-AUTHORITY |

## 5. STEP 5 — Clean / Blocked separation（採用判断ではない）

導出規則（readiness の既存フィールドのみ。主観判断なし）: **AUTH** = `authority.strength = INCOMPLETE` または identity set 不完全、**MECH** = `mechanicDependencies` が空でない、**ID** = `identityCollisions` が空でない。blocker 0 = READY、1 種 = BLOCKED-その種、2 種以上 = BLOCKED-MULTIPLE。

| 分類 | 件数 | 内訳（row id） |
|---|---|---|
| READY | 1 | `aussie-pizzadb` |
| BLOCKED-AUTHORITY | 6 | `keema-pizza-pizzadb-p2`, `pizza-baiana`, `pizza-chilena-pizzadb-p8`, `hokkaido-cheese-pizza-pizzadb-p15`, `caponata-pizza-pizzadb-p2`, `curry-pizza-japan-pizzadb-p2` |
| BLOCKED-MECHANIC | 3 | `montreal-style-pizza-pizzadb-p13`, `fugazzeta-rellena`, `grandma-pizza-pizzadb` |
| BLOCKED-IDENTITY | 3 | `bismarck-pizza-pizzadb-p7`, `chilean-napolitana-pizzadb`, `quattro-formaggi-pizzadb` |
| BLOCKED-MULTIPLE | 22 | `cauliflower-crust-pizza-pizzadb-p2`（MECHANIC+IDENTITY）<br>`colorado-mountain-pie-pizzadb-p3`（AUTHORITY+MECHANIC）<br>`ny-style-pizzadb`（MECHANIC+IDENTITY）<br>`pizza-al-taglio-romana-pizzadb-p9`（MECHANIC+IDENTITY）<br>`quad-cities-style-pizza-pizzadb-p2`（AUTHORITY+MECHANIC）<br>`trenton-tomato-pie-pizzadb`（MECHANIC+IDENTITY）<br>`fathead-pizza-keto-pizzadb-p9`（MECHANIC+IDENTITY）<br>`new-england-bar-pizza-pizzadb-p6`（MECHANIC+IDENTITY）<br>`st-louis-style-pizza-pizzadb-p4`（AUTHORITY+MECHANIC）<br>`chicago-deep-dish-pizzadb`（MECHANIC+IDENTITY）<br>`chicago-stuffed-pizza-pizzadb-p3`（MECHANIC+IDENTITY）<br>`pizza-a-caballo`（AUTHORITY+MECHANIC）<br>`fugazza-pizzadb-p10`（MECHANIC+IDENTITY）<br>`fugazzetta-pizzadb-p10`（MECHANIC+IDENTITY）<br>`old-forge-style-pizza-pizzadb-p1`（AUTHORITY+MECHANIC）<br>`margherita-pizzadb-row`（MECHANIC+IDENTITY）<br>`marinara-pizza-pizzadb-p13`（MECHANIC+IDENTITY）<br>`pizza-de-cancha`（AUTHORITY+MECHANIC）<br>`sfincione-pizzadb`（MECHANIC+IDENTITY）<br>`siciliana-pizzadb`（MECHANIC+IDENTITY）<br>`argentine-napolitana-pizzadb-p1`（MECHANIC+IDENTITY）<br>`pizza-romana-pizzadb-p9`（MECHANIC+IDENTITY） |

- blocker 種別の延べ数（複数 blocker の行は重複計上）: AUTH = 12 / MECH = 25 / ID = 19。
- **READY = 1 件（`aussie-pizzadb`、earliest step 12）。ただし特殊条件 = no-sauce**（identity set `bacon, egg, mozzarella, onion` に sauce 材料がなく、`RECIPE_SAUCE_PROFILES` は「sauce なし」を持たない total Record のため **no-sauce の engine 経路は未実証**。calabresa が証明したのは「cheese なし」まで）。したがって READY は「mechanic / authority / identity の blocker が無い」の意味で、**no-sauce を今回 解禁対象に含めるかは OD-BRANCH-3**。
- READY を **採用候補と読まないこと**: 「READY だから採用」とはしていない。READY の位置は step 12 のみ = **新しい C step を作らない**（step 12 は既に C。C2→C3 になるだけ）。
- 特殊条件の分布（35 件中、重複あり）: no-sauce = 18 / no-cheese = 6 / thin 生地記述 = 11 / late-topping = 0。no-sauce でない 17 件は全ていずれかの blocker を持つ（blocker 0 の READY は no-sauce の `aussie-pizzadb` のみ）。
- **位置別の READY 件数:** step 0 = 0、1–11 = 0（candidate がある step 6/7/8/11 も READY 0）、12 = 1、13–25 = 0。つまり **現 production の mechanic / authority だけで置ける位置は step 12 のみ**で、Step 1–11 と 13–25 に分岐を置くには少なくとも 1 つの blocker 解決（または現 30 材料外の追加）が必要。

## 6. STEP 6 — Branching scenarios（事実比較。ランキング・点数・winner なし）

**位置だけの比較**（合成 recipe。candidate 不問）。各指標の定義:
- **必ず複数（C step）** = 発見履歴に依存せず、その Step で新規 2 件以上が DISCOVERABLE になる Step。
- **calabresa 発見済みでも branching が残る Step（D, branch 未発見）** = calabresa だけ発見し、追加 branch recipe を未発見のとき pool ≥ 2 の Step。
- **conditional** = 全未発見（U）で pool ≥ 2 になる Step 数 − 必ず複数の Step 数（発見順で変わる Step）。
- **最大 pool** = 全未発見（U）の最大 pool（監査値）。
- 「ladderCredit:false 前提」の数値。true は §7。


### 6.1 Scenario 一覧

| Scenario | 追加位置 | 必ず複数（C step）（数） | D・branch未発見で複数の Step 数 | conditional Step 数 | 最大 pool（U・全未発見） | onboarding への接触 | blocker 解決の必要性 |
|---|---|---|---|---|---|---|---|
| **A** 現状維持（No.28 以降は末尾追加） | （なし） | 12（1） | 1 | 13 | 2 | 接触なし | 不要（現状維持） |
| **B** 中盤に C 型 1 か所 | {13} | 12, 13（2） | 14 | 12 | 3 | Step ≥12（既存 OPEN_POOL 以降。F7） | 13: candidate 1 件（READY 0） |
| **B** | {14} | 12, 14（2） | 13 | 12 | 3 | Step ≥12（既存 OPEN_POOL 以降。F7） | 14: candidate 3 件（READY 0） |
| **B** | {16} | 12, 16（2） | 11 | 12 | 3 | Step ≥12（既存 OPEN_POOL 以降。F7） | 16: **現30材料に candidate 0 件** |
| **B** | {19} | 12, 19（2） | 8 | 12 | 3 | Step ≥12（既存 OPEN_POOL 以降。F7） | 19: **現30材料に candidate 0 件** |
| **B** | {22} | 12, 22（2） | 5 | 12 | 3 | Step ≥12（既存 OPEN_POOL 以降。F7） | 22: **現30材料に candidate 0 件** |
| **B** | {24} | 12, 24（2） | 3 | 12 | 3 | Step ≥12（既存 OPEN_POOL 以降。F7） | 24: candidate 1 件（READY 0） |
| **C** 中盤に C 型 複数 | {15,20} | 12, 15, 20（3） | 12 | 11 | 4 | Step ≥12（既存 OPEN_POOL 以降。F7） | 15: candidate 2 件（READY 0）<br>20: candidate 2 件（READY 0） |
| **C** | {14,17,20,23} | 12, 14, 17, 20, 23（5） | 13 | 9 | 6 | Step ≥12（既存 OPEN_POOL 以降。F7） | 14: candidate 3 件（READY 0）<br>17: **現30材料に candidate 0 件**<br>20: candidate 2 件（READY 0）<br>23: candidate 2 件（READY 0） |
| **C** | {13,16,19,22} | 12, 13, 16, 19, 22（5） | 14 | 9 | 6 | Step ≥12（既存 OPEN_POOL 以降。F7） | 13: candidate 1 件（READY 0）<br>16: **現30材料に candidate 0 件**<br>19: **現30材料に candidate 0 件**<br>22: **現30材料に candidate 0 件** |
| **C**（同 step に重ねる） | {12,12,12} | 12（1） | 14 | 13 | 5 | Step ≥12（既存 OPEN_POOL 以降。F7） | 12: candidate 8 件（READY 1）・**要 3 件** |
| **D** 序盤にも C 型 | {0} | 12（1） | 25 | 24 | 3 | **Dex 0（F1/F2）** | 0: candidate 6 件（READY 0） |
| **D** | {3} | 3, 12（2） | 23 | 21 | 3 | Step 3〜: Shop/有料hint 初出直後（F3/F4）、食材庫導線なし（F6: Step 6 以前） | 3: **現30材料に candidate 0 件** |
| **D** | {6} | 6, 12（2） | 20 | 18 | 3 | Step 6〜: Shop/有料hint 初出直後（F3/F4）、食材庫導線なし（F6: Step 6 以前） | 6: candidate 4 件（READY 0） |
| **D** | {9} | 9, 12（2） | 17 | 15 | 3 | Step 9〜: 食材庫導線あり（F6）、現 OPEN_POOL(12) より前（F7） | 9: **現30材料に candidate 0 件** |
| **D** | {11} | 11, 12（2） | 15 | 13 | 3 | Step 11〜: 食材庫導線あり（F6）、現 OPEN_POOL(12) より前（F7） | 11: candidate 1 件（READY 0） |
| **D**（複数） | {3,14,20} | 3, 12, 14, 20（4） | 23 | 19 | 5 | Step 3〜: Shop/有料hint 初出直後（F3/F4）、食材庫導線なし（F6: Step 6 以前） | 3: **現30材料に candidate 0 件**<br>14: candidate 3 件（READY 0）<br>20: candidate 2 件（READY 0） |
| **D** | {7,15,20} | 7, 12, 15, 20（4） | 19 | 15 | 5 | Step 7〜: 食材庫導線あり（F6）、現 OPEN_POOL(12) より前（F7） | 7: candidate 2 件（READY 0）<br>15: candidate 2 件（READY 0）<br>20: candidate 2 件（READY 0） |
| **D** | {3,9,15,21} | 3, 9, 12, 15, 21（5） | 23 | 18 | 6 | Step 3〜: Shop/有料hint 初出直後（F3/F4）、食材庫導線なし（F6: Step 6 以前） | 3: **現30材料に candidate 0 件**<br>9: **現30材料に candidate 0 件**<br>15: candidate 2 件（READY 0）<br>21: candidate 1 件（READY 0） |
| **D** | {5,12,19,25} | 5, 12, 19, 25（4） | 21 | 17 | 6 | Step 5〜: Shop/有料hint 初出直後（F3/F4）、食材庫導線なし（F6: Step 6 以前） | 5: **現30材料に candidate 0 件**<br>12: candidate 8 件（READY 1）<br>19: **現30材料に candidate 0 件**<br>25: candidate 1 件（READY 0） |

注: Scenario の「中盤」「序盤」の Step 範囲は **本書では定義していない**（§3 の通り authority なし）。上表は位置ごとの事実を並べたもので、B = {13..24} の単独位置、C = 中盤位置の複数、D = Step ≤ 11（または Dex 0）を含むものとして例示した。`D:0` は開始 pool が 2 件になるため「必ず複数」の step 表現が他と異なる（Dex 0 から常時 pool 2 → Step 1 以降は常に複数、25 Step）。

### 6.2 Scenario 別の事実まとめ

| | A 現状維持 | B 中盤 1 か所 | C 中盤 複数 | D 序盤にも |
|---|---|---|---|---|
| calabresa 発見済みでも branching が残る Step | step 12 のみ（1 Step） | step 12 と位置 k。**branch 未発見の間は k〜25 が連続**（k=13 → 14 Step、k=24 → 3 Step）。branch 発見後（false）は 12 と k のみ | 同左の和。例 {14,17,20,23}: 未発見の間 13 Step（12, 14〜25）、全発見後は 5 Step（12,14,17,20,23） | 位置 k〜25 が連続（k=3 → 23 Step、k=11 → 15 Step）。D:0 は 25 Step |
| 必ず複数（C）Step 数 | 1 | 2 | 3〜5（{12,12,12} の同 step 重ねは件数が増えるだけで C step は 1 のまま） | 2〜5（`{0}` は開始 pool が 2 件のため別扱い） |
| conditional Step 数 | 13（13–25） | 12 | 9〜13（stack {12,12,12} が 13） | 13〜24（`{0}` が 24） |
| 最大 pool（U・全未発見） | 2 | 3 | 4〜6（stack は 5） | 3〜6 |
| onboarding への接触 | なし | なし（k=13–24 は全て F7 = 既存 OPEN_POOL 以降） | なし（全位置 ≥12） | **あり**（F1〜F6。位置により Dex 0 / Step 1 の Shop・有料 hint 初出 / 食材庫導線なし区間） |
| blocker 解決の必要性 | 不要 | 位置 13/14/15/20/21/23/24/25 は candidate 1〜3 件だが **全て BLOCKED**（READY 0）。16–19・22 は candidate 0 件 | 位置を 2〜4 か所持つため 2〜4 件分の blocker 解決が必要（READY は step 12 の `aussie-pizzadb` のみ） | 位置 6/7/8/11 は candidate あるが全 BLOCKED。1–5・9–10 は candidate 0 件。位置 0 の 6 件も全 BLOCKED（MULTIPLE） |

ここで表中の数値（B の conditional / C の最大 pool など）は §6.1 の実測行から範囲だけ取った。**どの Scenario も採用していない。**

## 7. STEP 7 — ladderCredit: false / true（採用判断なし）

production の規則（変更なし）: step s は **credited な発見数 ≥ s** で到達。`false` は Dex の発見数には入るが ladder count に入らない（calabresa 型）。`true`（既定）は count +1（pesto-pollo 型）。以下は production authority（`resolveShopEntitlement` / `reachedStepNumber` / `recipeDiscoveryState` / `selectHintTarget`）での probe。プレイヤー行動は 3 方針で比較: 「branch を発見しない（KEY_FIRST）」「branch を出た瞬間に発見（EXTRA_FIRST）」「calabresa だけ発見（CAL_ONLY）」。毎 Step 材料は全購入する仮定。

| 追加位置 | credit | branch を即発見したとき複数候補の Step 数 | 先行（lead）= 発見した credited branch の分だけ「key recipe 未発見のまま次 Step へ進める」最大数 | key 未発見が重なる延べ Step 数（先行がある Step の延べ） |
|---|---|---|---|---|
| {14} | false | 2 | 0 | 0 |
| {14} | **true** | 13 | **1** | 11 |
| {19} | false | 2 | 0 | 0 |
| {19} | **true** | 8 | **1** | 6 |
| {24} | false | 2 | 0 | 0 |
| {24} | **true** | 3 | **1** | 1 |
| {15,20} | false | 3 | 0 | 0 |
| {15,20} | **true** | 12 | **2** | 15 |
| {14,17,20,23} | false | 5 | 0 | 0 |
| {14,17,20,23} | **true** | 13 | **4** | 26 |
| {12,12,12} | false | 1 | 0 | 0 |
| {12,12,12} | **true** | 14 | **3** | 36 |
| {3} | false | 2 | 0 | 0 |
| {3} | **true** | 23 | **1** | 22 |
| {11} | false | 2 | 0 | 0 |
| {11} | **true** | 15 | **1** | 14 |
| {3,14,20} | false | 4 | 0 | 0 |
| {3,14,20} | **true** | 23 | **3** | 38 |
| {3,9,15,21} | false | 5 | 0 | 0 |
| {3,9,15,21} | **true** | 23 | **4** | 52 |

事実（probe の結果）:
1. **false:** 全 Scenario で lead = 0。branch を発見すると pool から外れ、**k と step 12（C）以外は A に戻る**（例 {14}: 発見後の複数候補は {12,14} の 2 Step のみ）。ladder の到達タイミングは追加前と同一。
2. **true:** 発見した credited branch 1 件ごとに **ちょうど 1 Step 先行**（lead = 発見した credited branch の数。probe 全行で lead = 追加位置の数: 1 件→1、{15,20}→2、{3,14,20}→3、{14,17,20,23}→4）。先行した分、**直前 Step の key recipe が未発見のまま次 Step の材料・key が出る**ため、pool は A に戻らず（key recipe が残る）、branch を発見しても複数候補が戻らない（{14}: false 2 Step → true 13 Step）。
3. **上限:** lead ≤ 追加した credited branch の数 M。ladder は 25 Step のまま（Step 25 = credited 25 件）で、ladder が進んだ時点で「それ以前の Step の key が未発見」の件数が最大 M 件になり得る（probe の lead）。複数追加するほど先行が **累積**（M=4 の {14,17,20,23} で lead 4、延べ 26 Step が「前 Step の key 未発見」状態）。
4. **early 位置 × true:** 位置が早いほど先行を持つ Step が長く続く（{3} 延べ 22、{14} 延べ 11、{24} 延べ 1）。{3,9,15,21} は延べ 52。
5. **Step 25 の特殊性:** k=25 は ladder の終端で、先行の効果が現れない（true でも false でも同じ pool）。
6. **material 経済:** true は Shop の「次の材料」が 1 発見ぶん早く進む（`nextMaterialHint`）。Dex の総数（章の件数・「あと N 種類」）は false/true とも +M。
7. **blocker に依らない一般事実:** `ladderCredit` は `Recipe` の静的 data（保存されない）。既存セーブで step k より先にいるプレイヤーは追加 recipe が最初から pool に載る（B 型）。

**採用は未決定 → OD-BRANCH-2。**


## 8. STEP 8 — Owner Decision が必要な項目（勝手に決めない。No.28 も選ばない）

| ID | 決めること | 判断材料（本書の根拠） | 選択肢（採用はしていない） |
|---|---|---|---|
| **OD-BRANCH-1** | **最初の追加 branching を序盤 / 中盤 / 後半のどこから始めるか**（＋ B/C 区間の境界の定義） | §3: authority があるのは **Dex 0 のみ**。Step 1 = Shop・有料 hint 初出、Step 7 = 食材庫導線が出る最初の Step、Step 12 = 既存の最初の OPEN_POOL。§6: D 型（≤11）は Dex 0/Step 1〜 の onboarding に接触、B/C 型（≥13）は接触しない | (a) Step ≥13 のみ（既存 OPEN_POOL 以降）／(b) Step 7〜11（食材庫導線あり・OPEN_POOL 前）／(c) Step 1〜6 以前も含める／(d) Step 0 まで含める（F2 により Dex-0 onboarding の設計変更が必要） |
| **OD-BRANCH-2** | branch recipe を `ladderCredit:false` を基本とするか | §7: false = lead 0・発見で A に戻る。true = 発見しても複数が戻らず先行が累積（M 件 → 最大 M Step 先行） | false を既定／true を既定／位置・件数で使い分け（その場合のルール） |
| **OD-BRANCH-3** | **no-sauce** を今回の branching expansion の解禁対象に含めるか | §5: 現 production で blocker 0 の候補（READY）は no-sauce の `aussie-pizzadb` 1 件のみ。no-sauce の engine 経路は未実証。no-sauce 候補は 35 件中 18 件、no-sauce を除くと READY は 0 件 | 含める（経路の実証が前提）／含めない／別 gate で実証してから |
| **OD-BRANCH-4** | 1 回の拡張で入れる **C 位置の数・同 step への重ね方**（M） | §6: 位置が増えるほど最大 pool と（true 時の）先行が累積。同 step 重ねは C step 数を増やさず件数だけ増やす | 1 か所／少数／多数。pool 上限の設定の要否 |
| **OD-BRANCH-5** | blocker を **どこまで解決してから** 配置するか（現 candidate の READY は step 12 の 1 件のみ） | §4/§5: 位置別 READY は 12 のみ。mechanic/authority/identity の解決を別 task にするか、現 30 材料外の追加で位置を埋めるか | blocker 解決を先行／READY のみで進める（= step 12 の C3 化のみ）／材料追加（ladder 拡張は別 gate） |

上記以外は本書の範囲外（lunchRush の参加、No.28 の選定、hint/Notebook の新仕様、Dex 章の再編）。


## 9. Candidate Count 契約（#345 後）との整合

- 本書は docs / data のみで、player-facing 表示・文言・DOM を **新設も変更もしていない**。
- 配置や `ladderCredit` を変えても player-facing 表現は既存の **pool 1 ↔ 2+ の 2 値**（TARGET / OPEN_POOL、Dex の単独 slot / 集約カード）のまま。pool 2・3・4・5・6 は player 視点で区別できない（`selectHintTarget` は pool ≥ 2 で recipe id 無しの `OPEN_POOL` のみ。leak-guard audit の既存結論。本書の sim でも pool 2〜6 で hint 種別は `OPEN_POOL` で同一）。
- 本書内の pool 件数・distance 相当の数値は **監査値**（Dev Inspector と同じ扱い）。candidate identity / candidate count / exact distance / similarity / Near-Far / correct ingredient count を Discovery oracle として復活させる提案はない。
- 将来の実装 task では、PR #345 の guard（`PizzaSelectView.prompt` に count を持たせない）を維持すること。

## 10. 本書がしなかったこと / 限界

- No.28 の選定、candidate の ranking・推奨・scoring、配置・`ladderCredit`・`lunchRush`・no-sauce の決定、recipe / ingredient / ladder / save schema の変更、PR / Issue。
- 35 candidate の再抽出・172 母集団の再監査（既存 JSON を再利用。ただしその JSON は main 未取り込みの branch 上にある）。
- full Vitest / E2E / WebKit / build / Codex review / Human Verification / screenshots / Preview（docs/audit task のため不要と指示された）。使い捨て probe（vitest 2 ファイル）は commit していない。
- 数値の前提: 毎 Step 材料を全購入する／合成 recipe は `tomato-sauce + mozzarella + その Step の新材料`。pool サイズは購入を遅らせると購入前窓（既存性質）で小さく見える。F6 の食材庫 Step は全購入前提。
- onboarding の「保護 Step 数」は authority が無いため確定していない（§3.2）。

**STOP:** 指定の 8 項目（latest-main 確認／Step 1〜25 placement map／onboarding boundary／Step × candidate intersection／READY・BLOCKED 分類／Scenario A/B/C/D 比較／ladderCredit false/true／Owner Decision）を報告したので停止する。No.28 は選んでいない。R6 / IP-2 へは進まない。
