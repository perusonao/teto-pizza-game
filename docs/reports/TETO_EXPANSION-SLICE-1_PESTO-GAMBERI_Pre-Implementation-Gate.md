# TETO Expansion Slice 1 — `pesto-gamberi` + `shrimp` — Pre-Implementation Gate Report

**更新（C1〜C7 すべて Owner 確定、C3 = A を反映。実装前 Gate は全 PASS）。**
**docs / data / audit tool のみ。runtime（`src/**`）・save・schema・CSS・テスト・e2e・PR は変更していない。実装は開始していない。**
Human Verification: N/A（UI / UX / gameplay 変更なし。実装 slice の DoD には適用される、§11）。
既存の Owner Decision（OD-T1〜T8、OD-W2-1、OD-DISC-9、OD-5、OD-378-1〜6、OD-P1 / P2 / P4 / P5 / P6 / P8 / P9 ほか）は **再決定していない**。根拠のない値は決めていない（C1〜C7 はすべて Owner が確定）。

| 成果物 | パス |
|---|---|
| 本書 | `docs/reports/TETO_EXPANSION-SLICE-1_PESTO-GAMBERI_Pre-Implementation-Gate.md` |
| companion JSON | `docs/reports/data/TETO_EXPANSION-SLICE-1_PESTO-GAMBERI_Gate-Audit.json` |
| 生成ツール（`--check` あり） | `tools/expansion_slice1_pesto_gamberi_gate_audit.py`（`tools/post_prod27_53_scale_audit.py` の parse / ladder 規則を再利用） |
| Owner Decision の記録先 | `docs/PROJECT_HANDOFF.md`（2026-10-03 addendum）、Decision Packet 冒頭の決定済み欄 |

---

## 0. 結論

- **authority 監査は PASS**: composition・shrimp・taxonomy・ladder・Shop・Research / Contract 2.1 / Hint / Dex・HAND 12・save 互換に **blocker はない**。
  27 → 28 は ladder step 26（`shrimp`、key = `pesto-gamberi`、T3）の追加だけで、**凍結 step 1〜25 は不変、全 step の pool は変わらない**。
- **Owner が C1〜C7（7 項目）を確定した**（§12）。minCount / bakeTarget / ladderCredit / Lunch Rush / CUT / Hint roles は **解決済み**。C8（description / order 文言）は実装 PR で提示し Owner 確認を取る扱い（実装前 Gate ではない）。
  - 訂正: 前版は「6 件」と書いたが、確認シートの項目は **C1〜C7 の 7 項目**（+ C8）。本版で 7 項目に整合させた。
- **C3 = A を Owner が確定**（🦐 U+1F990 / `#f4977c` / dedicated SVG は Slice 1 では作らない）。**C1〜C7 はすべて Owner 確定**。source に無い値は Owner の決定としてのみ記録した。
  絵文字は端末差があるため **最終的な見た目は実装後の Human Verification 対象**。**実装開始を止める Gate ではない**。
- **Slice 1 の実装着手と Production release は別**。**#378 は open・実装 PR なし・OD-378-6 の Audit 未実施 → Production release blocker のまま維持**（OD-P6、2026-10-04 に再確認）。実装着手の blocker ではない。
- C8（description / order 文言）は **実装 PR で提示し Owner 確認を取る契約を維持**（実装前 Gate ではない）。

**EXPANSION SLICE 1 IMPLEMENTATION READY: YES**（authority / Owner Decision 上の実装前 blocker なし。実装・PR は未着手。Production release は #378 完了後）

---

## 1. 記録した Owner Decision

| ID | 内容（要約） | 記録先 |
|---|---|---|
| OD-P1 | 固定の「53 到達」は実装単位にしない。capability / authority 単位の Wave。53 catalog は候補源、catalog 所属は ship 条件ではない | HANDOFF addendum |
| OD-P2 | composition は PIZZA DB / 172 authority 優先。catalog-only は自動採用せず slice ごとに Owner 承認 | 同上 |
| OD-P4 | 現 role・mechanic で安全に表現できない recipe（finishing / second sauce / spread 材料 等）は mechanic / authority が決まるまで ship と ladder 母集団から除外 | 同上 |
| OD-P5 | identity collision のある recipe は、操作または観測可能な mechanic / dimension で一意化できるまで ship しない | 同上 |
| OD-P6 | #378 既決案 1 を、最初の Expansion Slice の Production release より先に完了 | 同上（§10 に release blocker を明記） |
| OD-P8 | 新材料を導入する recipe を優先。既存材料だけの recipe を無計画に足さない。ladder credit / T4 条件は各 slice 前の authority 確認 Gate | 同上 |
| OD-P9 | first slice = `pesto-gamberi`。`ai-carciofi` は不採用 | 同上 |
| OD-P3 / P7 / P10 | defer。必要になる直前に Decision Gate（§9） | 同上 |
| C1〜C7（Slice 1 の実装パラメータ） | minCount / bakeTarget / credit 付与 / Lunch Rush 非参加 / CUT なし / key-free / **shrimp の見た目 = 🦐 `#f4977c`（C3 = A）** をすべて確定 | HANDOFF addendum（追記）、§12 |

---

## 2. 監査基準

| 項目 | 値 |
|---|---|
| audited main SHA | `b8617ac0218bf20eb53f68ed12dea09db20e3fa8`（fetch 済み。前回監査から main に新規 commit なし、`src/**` 差分なし） |
| #378 | GitHub で再確認: **open**、assignee / 実装 PR なし、Owner コメント（OD-378-1〜6）のみ。OD-378-6（「次のピザを作る」の Fresh Audit）は **未実施** |
| source の再取得 | `pizzadb.jp` は egress proxy で遮断（`EGRESS_BLOCKED`）。**独立した再 fetch は不可**。172 evidence の `verifiedAt` = 「2026-09-22 (relayed, not independently re-fetched by this Claude session)」、`corroborationCount` = 0。**No.27（`pesto-pollo-pizzadb-p12`）と同一の provenance**（同じ `comparison_table_sample`） |
| 方法 | 静的 parse + Python。ladder 規則の port は Production 25 step を再現済み（前回監査）。vitest / tsc / e2e は未実行（`node_modules` なし） |

---

## 3. Gate 一覧

| # | Gate | 結果 | 備考 |
|---|---|---|---|
| G1 | recipe composition の authority | **PASS** | §4 |
| G2 | shrimp の authority | **PASS**（見た目 = Owner C3 = A） | §4 |
| G3 | 27 → 28 の影響（identity / ladder / pool / Dex） | **PASS** | §5 |
| G4 | ladder step 候補 | **PASS**（step 26、append-only 規則で導出） | §5 |
| G5 | `ladderCredit` | **PASS**（Owner C4 = 付与） | §5.3 / §12 |
| G6 | Shop unlock / 価格 / 初回 pack | **PASS**（T3 = 100 / 50、shrimp k = 3 → pack 30 個） | §6 |
| G7 | 較正値（minCount / bakeTarget / 見た目 / copy） | minCount・bakeTarget・見た目は **PASS**（C1 / C2 / C3）、copy は実装 PR（C8） | §6 / §12 / §13 |
| G8 | taxonomy role / family | **PASS** | §7 |
| G9 | Research Entry / Contract 2.1 / Hint / Dex | **PASS**（Hint roles = key-free、Owner C7） | §8 |
| G10 | Hint roles・Lunch Rush・CUT | **PASS**（Owner C7 = key-free、C5 = 非参加、C6 = CUT なし） | §8 / §12 |
| G11 | HAND 12 | **PASS** | §8 |
| G12 | save forward compatibility | **PASS** | §8 |
| G13 | #378 | **Production release blocker**（開始 blocker ではない） | §10 |
| G14 | 回帰 gate（実装時に通すもの） | 実装時 | §11 |

---

## 4. composition と shrimp の authority（G1 / G2）

### 4.1 composition（authority から確定できる範囲）

出典: 172 evidence `pesto-gamberi-pizzadb-p11`（`TETO_PIZZADB_172_MASTER-EVIDENCE.json`）と 172 matrix（`TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`）。

| 項目 | 値 |
|---|---|
| 名称（source） | ペストガンベリピザ（nameJa、origin: イタリア / 各地） |
| 材料（source の `ingredientsJa`） | エビ / トマト / にんにく |
| base sauce（source `sauceFamily`） | バジル → **pesto**（`family_derived`。バジル系 11 行はすべてペスト名の料理で、既存 base は pesto = ジェノベーゼソース。No.27 と同じ導出） |
| 正規化（canonicalizer の `exact_alias`） | エビ → `shrimp`、トマト → `fresh-tomato`、にんにく → `garlic` |
| **identity set** | **`fresh-tomato` `garlic` `pesto` `shrimp`**、sauceBase = `pesto` |
| チーズ | **なし**（source に cheese の材料なし。mozzarella を足さない） |
| 生地 | ナポリピッツァ生地（standard / neapolitan / round） |
| matrix 判定 | representability **FULL** / productDecision **READY** / requiredCapabilities **[]** / blockers **[]** / reviewItems **[]** / collisionRefs **[]** / conflictRefs **[]** |
| recipe id / discovery target id | `pesto-gamberi` / `pesto-gamberi-pizzadb-p11`（matrix の `canonicalCandidateId` と evidence id。No.27 と同じ付け方） |

**authority が持たない値**（§12 で扱う）: 各材料の `minCount`、`bakeTarget`、description / order の文言、reference の配置、shrimp の emoji / color。
`baseRewardPitz` は **100**（Pitz Reward V1: 全 27 recipe 同値 = 既存 authority。新規決定ではない）。

### 4.2 shrimp の authority

| 項目 | 値 | 出典 |
|---|---|---|
| id | `shrimp`（独立 id） | OD-T1 |
| role | topping（player-facing 「具材」） | catalog `category`（Production の他の具材と同じ。sauce / cheese ではないので OD-T5 の確認対象外） |
| family | **`seafood`**（魚介） | **OD-T1（Owner 確定）**。#255 PROPOSED と一致 |
| placement / 単位 | scatter / piece | catalog |
| 表示名 | **エビ** | catalog `nameJa` = PIZZA DB のトークン（一致） |
| 近似 id | なし（`ham` 等との alias 化はしない。OD-T1 の独立 id 規則） | OD-T1 |
| 他の利用 | catalog 上は `frutti-di-mare` / `shrimp-mayo` が使うが、いずれも本 slice の対象外（OD-P4 / P5 の除外 class） | Fresh Audit |
| 見た目 | color `#f4977c` / emoji 🦐（U+1F990）。source には無く、**Owner が C3 = A で確定**（authority は Owner 決定） | §13 |

---

## 5. 27 → 28 の影響（G3 / G4 / G5）

### 5.1 数の変化

| 項目 | 27（現在） | 28（本 slice 後） |
|---|---:|---:|
| recipe | 27 | **28** |
| ingredient | 30（sauce 3 / cheese 4 / 具材 23） | **31**（具材 24） |
| ladder step | 25 | **26** |
| credited recipe | 26（`brazilian-calabresa` のみ非 credit） | 27（`ladderCredit` を維持する場合） |
| 「所持 N/M種」の M（obtainable） | 30 | 31 |
| 第 3 章の recipe 数 | 11 | **12**（pesto-gamberi = 第 3 章 No.12。Dex の pill は N/27 → N/28） |
| seafood family | 3 | 4（shelf chip の枠は増えない） |
| 全材料 refill 目安 | 1,150 Pitz | 1,200 Pitz（step 26 は T3 = refill 50） |

### 5.2 identity と ladder（G3 / G4）

- **identity collision なし**（既存 27 と set 完全一致 0、strict subset 0、strict superset 0。最も近いのは `pesto-pollo` / `pesto-caprese` の Jaccard 0.33）。
  → OD-P5 の除外 class に当たらない。default dimension のまま ELIGIBLE にできる（capability 不要、`RUNTIME_SUPPORTED_CAPABILITIES = []` でよい）。
- **append-only 規則（OD-W2-1 / LAD-1）で step 26 = `shrimp`、key recipe = `pesto-gamberi`** が導出される（port 済みの `buildAppendOnlyLadder` 相当）。他に必要な新材料なし。
  **凍結 step 1〜25 は不変**（`validateAppendOnlyExtension` 相当で確認）。
- **OD-P8 との整合**: 新材料（shrimp）を導入する recipe であり、既存材料のみで作れる recipe の追加ではない → **凍結 step の pool は不変**（全 25 step で pool = 1 のまま、step 26 も pool = 1）。
  Research Entry の最大同時数は 1（Production と同じ）。
- **SOFTLOCK なし**: step 26 は credited 発見数 26 で到達し、そのとき makeable な credited recipe は 26（= 全既存）。shrimp 購入後に 27 番目として `pesto-gamberi` が発見可能。
- **T4 / 第 4 章には入らない**（step 26 < 30）。OD-P8 の「T4 条件」は本 slice では N/A。

### 5.3 `ladderCredit`（G5）— Owner C4 = **付与（true）**

`pesto-gamberi` は **step 26 の正式な progression recipe**（`ladderCredit` を省略 = credit）。credited recipe は 26 → 27。監査では SOFTLOCK なし・凍結 step の pool 不変（非 credit でも安全だったが、採用は credit）。

---

## 6. Shop unlock / 価格 / 初回 pack（G6 / G7）

| 項目 | 結果 | 根拠 |
|---|---|---|
| unlock | step 26 到達（credited 発見 ≥ 26）で `shrimp` が Shop で NEW（entitlement は union。再 lock なし） | `resolveShopEntitlement` |
| 在庫 | **unlock は在庫を付与しない**（stock 0。初回 pack を買うまで OWNED にならない）。EP4 の Starter Grant は退役済み | OD-REC04-2 |
| 価格 | **T3: 初回 100 Pitz / 補充 50 Pitz**（step 26 ∈ 15–29。**`pricePitz` / `restockQuantity` は `Ingredient` に書かない**：ladder tier から導出） | OD-REC04-3、`materialOffer` |
| pack 量 | **10 × k**（k = shrimp の最大 `minCount` = **3**〔Owner C1〕）→ **30 個 = 10 ピザ分**、初回 100 Pitz / 補充 50 Pitz | `materialK` |
| minCount（Owner C1） | pesto 1 / fresh-tomato 2 / garlic 2 / shrimp 3。**既存 k（pesto 1 / fresh-tomato 3 / garlic 3）を超えない → 既存材料の pack・価格は不変**（監査で確認）。非 sauce 7 枚（≤ 8 枠）。量感は Human Verification で問題があれば別途調整 | §12 |
| 既存 pack の不変条件 | `pesto-gamberi` の `minCount` を pesto ≤ 1 / fresh-tomato ≤ 3 / garlic ≤ 3 に収めれば、既存材料の k（現在 pesto 1 / fresh-tomato 3 / garlic 3）は動かず pack・価格は不変（No.27 が pin した方式） | `materialK` |
| `Ingredient` に書くもの | `id` `category:"topping"` `nameJa:"エビ"` `placement:"scatter"` `unlockCondition:{minTotalStars:0}`（No.27 の chicken と同形の finite 材料）＋ **color `#f4977c` / emoji 🦐 `\u{1F990}`（Owner C3 = A、plain emoji、`pieceVisual` なし）** | `ingredients.ts` の型 |

---

## 7. taxonomy（G8）

| 項目 | 結果 |
|---|---|
| role | 具材（topping） |
| family / shelf | `seafood` / `seafood`（OD-T1 確定）。分類可能、**新 family id 不要**（`attr:family:<id>` は不変） |
| 追加する row | `ingredientTaxonomy.ts` に `["shrimp", "seafood"]` を **同一 PR で**（OD-T7） |
| 同一 PR で更新するもの | `tools/ingredient_taxonomy_hcg_authority_audit.py` の pin（hash / 件数 / `SHIPPED_SINCE_AUDIT`）、`hint5Taxonomy.gate`（具材は family ちょうど 1）、DH4 audit JSON、shelf の auditShelfAuthority |
| family 内訳 | meat 5 / seafood 3 → **4** / vegetable 8 / fruit 1 / herb 4 / spice 1 / other 1（計 23 → 24） |
| 検索 alias / reading | **不要**（「エビ」はカタカナのみ。OD-A: alias は Owner 承認済みのみ → 追加なし） |
| Owner Decision | **不要**（OD-T1 で確定済み。OD-P3 の対象外） |

---

## 8. Research Entry / Contract 2.1 / Hint / Dex / HAND / save（G9〜G12）

### 8.1 Research Entry / Contract 2.1（G9）

- **Research Entry**: 全 finite 材料（`garlic` step 14・`pesto` 17・`fresh-tomato` 20・`shrimp` 26）を所持した時点で登録（在庫は見ない）。unlock fact は最後に取得した finite 材料（どの材料でも true な fact）。
- **Contract 2.1 ○ / ×**: canonical(T) = `{pesto, fresh-tomato, garlic, shrimp}`。
  - ソース行は 1 件（pesto）。**チーズ行は、recipe がチーズを持たないため、使ったチーズは全件 ×**（no-cheese の前例 6 recipe: marinara / fugazza / pizza-bianca / pesto-tonno / puttanesca-pizza / brazilian-calabresa）。
  - 未知の具材は最大 3（unlock fact が pesto のとき 3、それ以外 2）。**K = 3 を超えない**（over-cap なし）。
  - Notebook の最悪ケースは Production と同じ **109 字**（`エビ` は最長 3 具材に入らない。上限 200）。保存は ○ の `ing:<id>` のみ（schema 不変）。
- **Anti-Oracle**: 追加の leak 面なし。「チーズなし」の直接表示はしない（INV-D7）。プレイヤーが「チーズを使わない」と推理するのは既決の accepted consequence。

### 8.2 Hint / Dex（G9 / G10）

- Hint 5.0: no-cheese recipe は CHEESE rung が無い（key-free の前例 = `brazilian-calabresa`）。key-free の rung は **SAUCE → STRUCTURE → SUB_CLASS ×3**（garlic = ハーブ、fresh-tomato = 野菜、shrimp = 魚介。3 family は互いに異なる）。
  `RECIPE_HINT_ROLES` は `Record<RecipeId, …>` で **行が型で必須**。**Owner C7 = key-free**（KEY_TOPPING なし。`RECIPE_HINT_ROLES` に `{ keyFree: true }` の行を足す）。
- pool: step 26 以前で `pesto-gamberi` は未 entitled のため既存の pool は不変。shrimp 購入後は pool = 1 → 自動 target（No.27 の Case B と同じ）。
- Dex: 第 3 章 No.12（Pizza Dex pill N/27 → N/28、chapter progress 11/11 → 12/12 を要 pin 更新）。discovery target id = `pesto-gamberi-pizzadb-p11`、items = 4、sauceBase = `[pesto]`、dimension は default。

### 8.3 HAND 12（G11）

- 容量は **12 のまま（変更しない）**。具材の owned は 23 → 24 で、hand は既に step 12 から活性。全 owned 時の hand 外は 11 → 12。
- shrimp は購入直後（在庫 ≥ 1）に `new` source で hand に入る。以降は pin / 検索（「エビ」）/ 魚介 shelf chip で到達可能。1 recipe の具材は 3 種で、placed 保護と pin 枠に余裕がある。
- Dinner / Lunch Rush の paged tray は 4 ページのまま（24 / 6）。

### 8.4 save forward compatibility（G12）

- `schemaVersion` 2 のまま、新 field・migration なし。id `pesto-gamberi` / `shrimp` は `SAVE_ID_PATTERN` に適合。
- 既知 id の whitelist は `RECIPES` / `INGREDIENTS` から導出される。**古い build が新 save を読んでも、未知の dex / inventory / ownedIngredientIds の順序 / `unlockedForShop` / hint purchase・fact は forward-compat で保持される**（rollback 安全）。
- 既存 save が credited ≥ 26 なら、次の resolve で `shrimp` が entitled（Shop の NEW、在庫 0）。在庫は付与されない。
- 永続化される fact: `ing:shrimp`（○ が開示された後のみ）。`attr:family:seafood` は既存。`GameState` は永続化されない。

---

## 9. Defer した Decision の Gate（必要になる直前に設ける）

| ID | Gate を設ける trigger | 本 slice |
|---|---|---|
| OD-P3（13 材料の role） | **sauce / cheese の新材料、または OD-T1 / T2 で family 確定していない材料**を導入する最初の slice の前 | shrimp は OD-T1 確定の具材 → **trigger 非該当** |
| OD-P7（Research Entry 匿名ラベル 10 件超） | slice の母集団を ladder 規則で simulate し、**最小発見経路の最大同時 Research Entry が 10（最後の丸数字）に達しうる**時点の前 | 現在 1 → 28 recipe でも 1。**非該当** |
| OD-P10（Cooking Steps 導入順） | **新しい Cooking Step / identity dimension / 技法**（FINISH・zone・pan・no-sauce など）を要する最初の slice の前。および PR #295（未 merge の設計）の採否が必要になった時 | 標準工程のみ → **非該当** |

---

## 10. #378（Production release blocker）

- 状態: **open**、実装 PR なし、OD-378-6 の Fresh Audit **未実施**。
- 既決: OD-378-1〜6（案 1 採用、案 2・3 不採用、save 変更なし）。**本書は再決定しない**。
- OD-P6 により、**#378 案 1 の完了が Slice 1 の Production release より先**。したがって **#378 が完了するまで本 slice は Production release できない**（Preview での検証・実装準備は可）。
- 依存の順序: ① OD-378-6 の Fresh Audit（「次のピザを作る」）→ ② #378 案 1 実装 → ③ Slice 1 の Production release。Slice 1 の実装と #378 の実装が同じ画面（Dex の Research カード / Shop）に触れる場合は conflict を避ける順序管理が要る。
- 本 slice は stall 点を 1 箇所増やす（key recipe 1 件の単一 chokepoint が step 26 にも立つ）。#378 が先に入ることで、増えた点にも案内が効く。

---

## 11. 実装時のスコープ予測と回帰 gate（実装は未着手）

- **data file（No.27 前例の 9 ファイル）**: `recipes.ts` / `ingredients.ts` / `ingredientTaxonomy.ts` / `discoveryLadder.ts`（`POST_W1_APPENDED_STEPS` に 1 件）/ `discoveryCatalog.ts` / `recipeSauceProfiles.ts`（pesto・PAINT）/ `recipeHintRoles.ts` / `orders.ts` / `referencePizza.ts`。
  reducer / persistence / component / mechanic の変更は不要の見込み（capability 不要、標準工程のみ）。
- **テスト pin の移行**: 27 / 30 / 25 などの件数を固定しているテストが約 68 ファイル（grep 概算）。No.27 では約 55 本を移行した。`discoveryNo27.pestoPollo.test.ts` に相当する新規テストと score parity fixture が要る。
- **通すべき gate**: ladder の SOFTLOCK / KEY_RECIPE / UNREACHABLE（`validateLadderProgression`）、append-only の凍結（`validateAppendOnlyExtension`）、`hint5Taxonomy.gate` と DH4 guard、`ingredientShelf.auditShelfAuthority`、matcher の AMBIGUOUS 回帰（collision 0 の確認）、Production 27 deadlock fixture の再実行、save forward-compat テスト、`recipeChapters` / Dex pill / e2e の件数。
- **Human Verification**（`TETO_HUMAN-VERIFICATION-POLICY.md`）: Shop の NEW 行・購入・在庫、FREE round、Research RESULT ○×、Notebook、NEW PIZZA、Dex を **390×844 動画 + before / after screenshot**（動画は repo にコミットしない）。No.27 の e2e（390×844 / 360×800）に相当する spec を足す。
- **CUT**: Owner C6 により **Slice 1 は CUT なし**（`CUT_ELIGIBLE_RECIPE_IDS` に追加しない。5 tab）。`lunchRush:false`（C5）、`ladderCredit` は省略 = credit（C4）。

---

## 12. Owner 確認シート（確定記録）

Owner が 2026-10-03 に確定。**C1〜C7 の 7 項目**と C8。

| # | 項目 | Owner の決定 | 状態 |
|---|---|---|---|
| C1 | `minCount` | pesto = **1** / fresh-tomato = **2** / garlic = **2** / shrimp = **3**（既存較正に合わせる。量感の問題は Human Verification で別途調整） | **確定** |
| C2 | `bakeTarget` | **50–70**（既存 pesto 系の焼成窓） | **確定** |
| C3 | shrimp の color / emoji | **A を採用**: 🦐（U+1F990）/ `#f4977c` / dedicated SVG は Slice 1 では作らない。端末差があるため最終的な見た目は実装後の Human Verification（実装開始の Gate ではない）。Human Feel で問題があれば後続 slice で dedicated SVG を検討 | **確定** |
| C4 | `ladderCredit` | **付与（true）**。step 26 の正式な progression recipe | **確定** |
| C5 | Lunch Rush | **Slice 1 では非参加**（`lunchRush:false`）。Expansion / Discovery の vertical slice の検証に Lunch Rush の population 変更を混ぜない。**将来の参加を禁止する決定ではない** | **確定** |
| C6 | CUT | **Slice 1 では CUT なし**（No.27 の前例。CUT authority の変更を混ぜない。将来の Cooking Steps / CUT 再監査を妨げない） | **確定** |
| C7 | Hint roles | **key-free**（現 Discovery / Hint authority を維持、KEY_TOPPING なし） | **確定** |
| C8 | description / order 文言 | 実装 PR で提示し Owner 確認を取る（実装前 Gate ではない） | 実装 PR |

`baseRewardPitz` = 100（Pitz Reward V1、既存 authority）。

再確認した不変条件（`tools/expansion_slice1_pesto_gamberi_gate_audit.py`）: 既存材料の k を超えない／非 sauce 7 枚／shrimp の pack = 30 個（10 ピザ分）／step 26 は T3（100 / 50 Pitz）。

---

## 13. C3 shrimp の見た目 — 候補と Owner 決定（**A 採用**）

**Owner 決定: A**（🦐 U+1F990 / `#f4977c` / dedicated SVG なし）。理由: エビとして最も直感的、既存 seafood と識別しやすい、pesto / fresh-tomato / garlic と組み合わせても視認しやすい、plain emoji の既存規約に沿う、Slice 1 に新しい描画 system を持ち込まない。以下は決定前に示した候補の記録（B・C は不採用）。

### 13.1 既存 visual system の事実（コード確認）

- 具材は **絵文字（または dedicated SVG）で描かれる**。`IngredientGlyph` が唯一の入口で、ピース 28px・tray chip 26px・RESULT / Inventory / Shop / Dex も同じ glyph。焼成で `brightness 0.78 / saturate 0.8 / sepia 0.2`（heat 2）まで roast tint が掛かる。
- **`color` は具材では描画に使われない**（sauce の paint と cheese の `--cheese-color` のみ。非 test の参照を grep で確認）。具材の `color` は現状メタデータ。→ 見た目の識別は **ほぼ絵文字で決まる**。
- dedicated SVG は 3 件だけ（`fresh-tomato` / `capers` / `clam`）。いずれも **W1 Visual Gate で Human 承認された後**に型へ追加された。他 27 材料は plain emoji。
- 既存の魚介: `anchovy` 🐟 `#8ba3b8`（青灰）、`tuna` 🐠 `#5b7c99`（青）、`clam` 🦪 dedicated SVG（砂色 `#c9b89a`）。**いずれも寒色 / 中性色**。

### 13.2 候補

色の ΔE は CIE Lab ΔE76 で、**既存の全具材との最近傍**（値が大きいほど識別しやすい。色は描画に使われないので参考値）。

| | A. 🦐（推奨） | B. 🍤 | C. 🦐 + dedicated SVG |
|---|---|---|---|
| emoji | U+1F990 エビ | U+1F364 エビフライ | U+1F990（fallback）+ 新 `pieceVisual` `shrimp-curl` |
| 候補 color | `#f4977c`（サーモン / 珊瑚） | `#e3a857`（きつね色） | `#f4977c` |
| 最近傍 ΔE（既存具材） | bacon 17.0 / chicken 19.9 / ham 21.0 | chicken 11.6 / potato 18.5 / egg 21.8 | A と同じ |
| ingredient tile（26px + 「エビ」） | 橙〜桃色の丸まった海老。**一目でエビと読める** | 衣をまとった金茶の揚げ物。「エビ」の名札と合うが **揚げ物（調理済み）に見える** | A と同じ（SVG は 1em で同寸） |
| pizza 上（28px、3 枚） | pesto の緑・fresh-tomato の赤・garlic の白に対し **橙桃が最も目立つ**。焼成で暗い橙〜茶に寄るが **丸まった輪郭は残る** | 金茶で pesto の緑には映えるが、焼成でさらに茶色へ寄り **chicken 🍗 / bacon 🥓 と同系の茶色の塊**になりやすい | A と同じ。SVG なら焼成 filter 下でも形を作り込める |
| 既存 seafood との識別 | 🐟🐠 は **楕円の魚**、🦪 は **砂色の貝**。🦐 は **暖色で曲線の輪郭**なので形・色とも別。**暖色の肉系（🍗🍖🥓）とは輪郭が別**（骨 / 帯 vs 丸まった海老）で、色の近さが唯一の懸念 | 輪郭は別だが **「魚介」より「揚げ物」と読まれる**。魚介 shelf に入る材料として意味がずれる | A と同じ。ただし dedicated 化は **型 + 描画 + Human Visual Gate が必要**で Slice 1 の範囲を超える |
| 実装量 | 小（`emoji` / `color` のみ、他 27 材料と同じ plain emoji 規約） | 小 | **大**（型追加 + `IngredientGlyph` 描画 + Visual Gate + テスト） |
| 懸念 | OS による絵文字の描画差（橙の濃淡）。暖色肉系との色の近さ | 意味のずれ（調理済み）、焼成で茶色化 | Slice 1 に混ぜると vertical slice の検証範囲が広がる |

### 13.3 見方（Human Feel で確認してほしい点）

1. tray chip で「エビ」と一目で読めるか（26px、魚介 shelf の 🐟🐠🦪 と並べて）。
2. pizza 上の 3 枚が pesto の緑・fresh-tomato の赤に対して識別できるか（未焼成 / 焼成後）。
3. 焼きすぎ時に chicken / bacon / ham と混同しないか。
4. （後続 slice）dedicated SVG を作る価値があるか。**A を選んでも C は後続 slice で追加可能**（`emoji` は fallback として必ず残る設計）。

1〜3 は **実装後の Human Verification** で確認する（端末差があるため実機が正）。

---

## 14. 限界

- source の独立再取得は不可（§2）。provenance は No.27 と同格（relayed、corroboration 0）。
- vitest / tsc / e2e は未実行。発見 attempt 数・Pitz 経済は未算出。Dex 画面高・実機 HV は実装 slice で測る。
- 絵文字の見え方は OS / 端末で異なる。§13 の記述は設計上の見込みで、**実機の Human Feel が正**。

## 15. 最終 Gate 状態

| 区分 | 内容 |
|---|---|
| **EXPANSION SLICE 1 IMPLEMENTATION READY** | **YES** |
| 実装時 gate（実装 PR の中で満たす） | C8 description / order 文言を PR で提示し Owner 確認／実装後の Human Verification（shrimp の最終的な見た目、390×844 動画 + before / after screenshot）／回帰 gate（ladder SOFTLOCK・append-only 凍結・matcher の AMBIGUOUS 回帰・`hint5Taxonomy.gate`・DH4 guard・shelf audit・save forward-compat・件数 pin 約 68 ファイルの移行・Production 27 deadlock fixture の再実行）／taxonomy audit tool の pin を同一 PR で更新（OD-T7） |
| **Production release blocker** | **#378**（open、実装 PR なし、OD-378-6 の Audit 未実施）。OD-P6: #378 案 1 の完了が Slice 1 の Production release より先 |
| 推奨 Slice 1 実装 scope | §11（data 9 ファイル + 新規テスト + 件数 pin 移行 + e2e 1 本）。**含めない**: reducer / persistence / component / mechanic 変更、CUT、Lunch Rush、dedicated SVG、sauce / cheese の新材料 |

実装・PR は未着手。STOP。
