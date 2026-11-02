# Expansion — 次期レシピ拡張 Research（Batch 15 以降の候補選定、docs-only）

Status: **調査のみ。レシピ追加・step 変更・ladder 変更・PR 作成・merge・Production / 共有 Preview 更新はしていない。**
基準 `origin/main` = `cfbb083`（#725 Cooking Sear Phase 1 まで。#723 Batch 14 / #716 Batch 13 は merge 済み）。日付 2026-11-02。
本ファイルは `docs/reports/` の新規 1 ファイルのみ（`PROJECT_HANDOFF.md`・`src/`・`e2e/`・`data/`・`docs/design/data/` は未変更）。
UI/UX/gameplay の変更ではないため、HV 動画・スクリーンショットは対象外（`TETO_HUMAN-VERIFICATION-POLICY.md` の適用外、docs-only）。

## 0. 原典の扱い（最初に読むこと）

- **pizzadb.jp には到達していない（本セッションでは取得せず、過去の Reselection 文書では 403）。** 食材・ソース欄の根拠は
  `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（172 行、ChatGPT 中継の証跡、独立再取得なし）だけ。
- 以下の **個数・焼成窓（既定 58–78）・NO_SAUCE 判断・ソース充当・色・名称・投入タイミング（焼成前 / 後）はすべて GAMEPLAY ASSUMPTION**。原典の事実ではない。
- 「ソース欄 = その他 / 未指定」の行（matrix の `BASE_SAUCE_UNSPECIFIED`）は、Batch 12（jamaican）・13（potato-mayo）・14（moussaka）で **Owner が 1 件ずつ**判断してきた。本書はその前例を「仮の提案」として使うだけで、方針としては決めない（§7 の Owner 判断 1）。

## 1. Fresh Audit の結果（事実）

| 項目 | 確認結果 |
|---|---|
| 読んだもの | `CLAUDE.md`、`docs/PROJECT_HANDOFF.md`（冒頭の addendum 群）、`TETO_SESSION-OPERATIONS_1.0.md`、Batch 12 / 14 Result、`NEXT-CANDIDATES-3_Reselection`、172 matrix、`src/data/recipes.ts` / `lateCatalog.ts` / `discoveryLadder.ts` / `ingredients.ts` |
| 既存レシピ | `recipes.ts` に 78 件（Batch 14 の moussaka まで）＋ late catalog（bbq-chicken / eggplant-dengaku / eggplant-tahini / ikura / yuzu-shrimp / wasabi-beef / tarako-cream / pinsa-romana）。B14 Result の件数: recipes 85（Pinsa gate 開）/ 84、credited 76、ingredients 95、ladder 73 step |
| 未マージ Batch | **なし。** open PR に expansion 系は 0 件。#709/#711（B12）・#716（B13）・#723（B14）は main に入っている。#717（B13 重複実装）は closed・未 merge。#584（8c）は closed（`#627` に置換）。#540（Multi-Sauce S3 グランマ）は **HOLD / Draft** |
| open Issue | #724（Sear、claim 済み・PR #725 は main に merge 済み）、#708 / #707 / #706（B13 / B12 の Issue。merge 済みだが **open のまま**＝Issue の後始末が未了）、#527、#578、#621、#604/#608/#579（後乗せ）、#696（Prep 1B）、#521/#532/#536-538（Multi-Sauce・Square Dough） |
| 有効な claim | #724 のみ（`src/logic/sear/**`、`SearLayer`、`PizzaStage.tsx`、`GameScreen.tsx`、`gameReducer.ts`、`App.tsx`、`src/preview/cookSear*`、`e2e/cooking-sear*` ほか。期限 2026-11-16）。**本書のファイルとの重なりなし** |
| 172 matrix の未実装 | 172 行のうち、同 id・同名の出荷済みを除いた **95 行**（機械照合。late 出荷分の取りこぼしがあり得るため件数は目安） |
| 「既存食材のみ ∧ 新機構なし」 | **ごく少数**（§3）。B12 の選定理由にある通り、Phase-2 承認済みで新機構不要の行はほぼ出荷済み。残りは `BASE_SAUCE_UNSPECIFIED` の Owner 判断待ちか、新機構待ち |

### 1.1 Fresh Audit で見つけた不整合（直していない・報告のみ）

1. **`LATE_CATALOG_PRODUCTION`**: `lateCatalog.ts:33` のコメントは「`false` in Production」だが、リテラルは **`true`**。`recipes.ts` は `mergeLate(..., lateCatalogEnabled())` なので、現在の main の `RECIPES` に late レシピが入る。コメントと値のどちらが正か、Owner / 実装側の確認が必要（本 Research は変更しない）。
2. **`PROJECT_HANDOFF.md` の addendum**: B13（#716）・B14（#723）が「pending Owner HV / merge」のまま。main には両方 merge 済み（`82665c8` / `167cf74`）。handoff の更新は別セッションの hot file 作業にする。
3. **Issue #706 / #707 / #708 が open のまま**（merge 済み PR に対応）。クローズ判断は Owner。

## 2. 重複・衝突の確認（Duplicate Gate）

識別集合（食材 id の集合。個数は無視）で、出荷済み 78 件と全比較した。

| 候補 | 出荷済みとの一致 | 部分集合 / 上位集合 | 備考 |
|---|---|---|---|
| nigerian-suya（NO_SAUCE） | なし | なし | — |
| caponata（NO_SAUCE） | なし | なし | 保留理由は別（§3 A-2） |
| pesto-genovese | なし | なし | **名称が既存 `genovese`（ジェノベーゼ）と近い**（B12 の supreme と同型の DOM 部分文字列衝突に注意） |
| philly-cheesesteak（チーズ = mozzarella と仮定） | なし | なし | **nigerian-suya と識別集合が完全一致**（beef / green-pepper / mozzarella / onion）。どちらか一方のみ |
| ume-shiso / goulash / boerewors | なし | なし | — |
| hokkaido-cheese（チーズ = mozzarella と仮定） | なし | `potato-mayo-pizza` の部分集合 | **除外**（B13 に包含される） |

名称クラスタ・Discovery 衝突は matrix の `collisionLedger` を再確認していない（本書は matrix の blocker 欄を信頼）。実装前に Duplicate Gate（open PR / Issue 検索を含む）を必ず再実行すること。

## 3. 候補 10 品（優先順）

凡例: ソース = `SAUCE 工程で塗るもの`、「なし」= NO_SAUCE。個数は「非ソース 8 ピース = 8 スロットのリング」（B12–14 の慣例）に合わせた**仮置き**。焼成窓は一律 58–78（汎用窓）の仮置き。「key」= その Batch で新たに解禁される材料（= ladder の新 step が必要な場合）。

### Track A — 新食材 0・新調理法 0（既存食材だけ）

| # | 候補（matrix 行） | ソース | チーズ | キートッピング | サブトッピング | 新食材 | 状態・注意 |
|---|---|---|---|---|---|---|---|
| A-1 | **nigerian-suya-pizza** ナイジェリアンスヤ（`…-pizzadb-p5`） | なし（matrix「その他」→ NO_SAUCE を仮定。jamaican #711 の前例） | mozzarella 2 | **beef 3**（step 58、rendang の step と共通） | green-pepper 1 / onion 2 | 0 | FULL・出荷済み機構のみ。**推奨**。注意: 実際のスヤはピーナッツ系のスパイス衣が特徴で、材料欄にそれが無い（名称の期待値と食い違い）。beef step 58 で rendang と同時に makeable（pool 2。B14 の step 66 と同型で前例あり） |
| A-2 | caponata-pizza カポナータ（`…-p2`） | なし（同上） | mozzarella 2 | **eggplant 3** | capers 2 / black-olive 1 | 0 | **Owner 保留中**。#706: 解禁が capers（step 23）で、初期 25 step の発見 pool が 2 つになり「ペスト・ポッロが唯一の候補」という案内と固定テスト約 50 件が壊れる。**初期オンボーディング変更の Owner 承認が前提**。本 Batch には入れない |
| A-3 | pesto-genovese-pizza ペストジェノヴェーゼ（`…-p11`） | pesto 1 | mozzarella 2 | **pine-nuts 3** | potato 3 | 0 | `BLOCKED`（COMPOSITION_CONFLICT_SHIPPED = DIVERGENT、pesto-patate / pesto-trapanese との関係）。識別集合は未重複。**名称を `genovese` と区別する Owner 判断**が要る。pine-nuts（baba-ganoush の step）が key のため pool 2 |
| A-4 | philly-cheesesteak-pizza（`…-p9`） | なし | チーズソース（matrix は曖昧）→ mozzarella を仮定 | **beef 3** | green-pepper 2 / onion 1 | 0（チーズソースを新規にするなら 1） | **A-1 と排他**（識別集合が一致）。差別化するなら「チーズソース」を別材料にする Owner 判断が必要。予備扱い |
| A-5 | tsukimi-pizza 月見（`…-p14`） | なし | mozzarella | egg 1 | bacon / green-onion | 0 | **Owner HOLD（DH4 の `other` 家族 gate、OD-DH4-2-9）**。gate 緩和は禁止。推奨しない |

### Track A′ — 新食材 1（既存機構のまま）

| # | 候補 | ソース | チーズ | キートッピング | サブトッピング | 新食材 | 状態・注意 |
|---|---|---|---|---|---|---|---|
| A′-1 | **ume-shiso-pizza** 梅しそ（`…-p14`） | **umeboshi-paste 1（PAINT）を仮定**（matrix「その他」） | mozzarella 2 | **umeboshi-paste**（新 step の key） | shiso 2 / whitebait 3（既存 B8b） | `umeboshi-paste`（sauce 型） | FULL。**和のテーマで出荷済みの shirasu-pizza と素材を共有**しつつ識別集合は別。色: 梅肉の赤紫は tomato-sauce / 生地との識別を実機で要確認（doubanjiang の ΔE 検討と同型）。「ペーストをソースにするか topping にするか」は Owner 判断 |
| A′-2 | goulash-pizza グヤーシュ（`…-p3`） | なし（「その他」→ NO_SAUCE を仮定） | なし（matrix に無し。mozzarella を足すかは Owner 判断） | **sour-cream 1**（新 step の key） | beef 3 / onion 2 / paprika-powder 2 | `sour-cream`（topping・dairy 系） | FULL。注意: 白い塊が既存 `cream-cheese` と見分けにくい（視覚差別化の追加作業）。beef・paprika-powder は B10 で導入済み |
| A′-3 | south-african-boerewors-pizza（`…-p14`） | **chutney 1（PAINT、matrix「甘辛だれ」）を仮定** | mozzarella 2 | **chutney**（新 step の key） | sausage 4 / onion 2 | `chutney`（sauce 型） | matrix に `NAME_SPECIFICITY_GAP`（名称が曖昧）。ソース色（茶系）が既存ソースと近い恐れ。**優先度低** |

### Track B — 新しい調理法・機構と組み合わせる（別枠）

| # | 候補 | 必要な機構（現状） | ソース / チーズ / key / sub | 新食材 | 判定 |
|---|---|---|---|---|---|
| B-1 | **hot-honey-pepperoni-pizza**（`…-p12`、`READY_WITH_REVIEW`） | **FINISH（後乗せ）の液体対応**（#579 DRIZZLE 候補、#604 / #608）。late catalog は main にあるが、FINISH の本番 ON は別 gate | tomato-sauce 1 / mozzarella 2 / **pepperoni 4（既存）** + **honey 2（焼成後ドリズル）** | `honey`（liquid、FINISH 専用の可能性） | **honey は 3 レシピの前提**（他: nashville-hot-chicken、nduja）。FINISH の液体対応が決まるまで着手不可 |
| B-2 | **yakiniku-pizza** 焼肉（`yakiniku-pizza`、`READY` / PARTIAL） | **Cooking Prep（炒め）**: #696 Phase 1B（`PREP_EXPERIENCE_PRODUCTION = false`、目標は beef のみ）。さらに `white-sesame` は late 材料 | yakiniku-sauce 1 / mozzarella 2 / **beef 3（炒め）** / onion 2 / white-sesame 1 | `yakiniku-sauce`（+ late の white-sesame） | **B12 で Owner HOLD**。Prep の本番化と white-sesame の ladder 化が前提。bulgogi（`BASE_SAUCE_UNSPECIFIED`）も同系 |
| B-3 | **sfincione** スフィンチョーネ（matrix `PARTIAL`、`READY_WITH_REVIEW`） | **MULTI_SPREAD_LAYER**（2 本目の塗り層。Multi-Sauce #521 / #540 HOLD） | tomato-sauce 1 + olive-oil 1（2 層）/ チーズなし（matrix 無し）/ **anchovy 3** / onion 3 / oregano 2 | 0（食材は既存のみ） | 機構待ち。burrata 系（crudaiola / pesto-burrata / burrata-pizza）は同じ機構＋ `burrata`（新食材 1）で 3 レシピ |
| B-4 | **kimchi-pizza**（`…-p2`） | **Prep（水切り・炒め）の対象拡張**（現状 beef のみ）＋ソース未指定 | ホットソース（未指定）/ mozzarella 2 / **kimchi 3** / pork 2 / green-onion 1 | `kimchi` | 二重の未決（Prep 対象・ソース）。後回し |

注: **Sear（#724 / #725）は Preview/DEV 限定の Phase 1（対象 sausage のみ）で、どのレシピも必須としていない。** 「炙りを必須とするレシピ」は今は成立しない（Phase 2 は保留）。Sear / Prep は「任意の下ごしらえ」なので、レシピの識別を変えないうちは候補の依存に含めない。

### 除外（理由つき）

月見（HOLD）、quattro-stagioni（ZONED が必要）、frutti-di-mare（pescatore と命名クラスタ、B12 で除外済み）、pizza-asparagi-limone / pizza-zucchine-menta（「生（crudo）」の機序解釈が原典未確認）、eggplant-dengaku / eggplant-tahini / ikura / yuzu-shrimp / tarako（late catalog に出荷済み）、DOUGH_VARIANT / PAN_BAKE / ENCLOSE / FRY_COOK を要する行（Pinsa 系・シカゴ・デトロイト・カルツォーネ・ピッツァフリッタ等）、baingan-bharta / venezuelan-reina-pepiada（**late 専用の cilantro** に依存。ソース未指定も重なる）、hokkaido-cheese（B13 に包含）。

## 4. 新食材・新調理法の要否

| 区分 | 候補 | 新食材 | 新調理法・機構 | 既存食材だけで追加できるか |
|---|---|---|---|---|
| Track A | A-1 suya / A-2 caponata / A-3 genovese / A-4 philly | 0 | なし | **はい**（ただし A-2 はオンボーディング承認、A-3 は名称判断、A-4 は A-1 と排他） |
| Track A′ | umeboshi-paste / sour-cream / chutney | 各 1 | なし | いいえ（新 step・新 SVG・ladder 追記が必要） |
| Track B | honey（+FINISH 液体）/ yakiniku-sauce（+Prep・late 材料）/ burrata（+MULTI_SPREAD）/ kimchi（+Prep 拡張） | 1 前後 | あり | いいえ |

「既存食材のみ ∧ Owner 判断が最小」で、いま Batch にできるのは **A-1（nigerian-suya）だけ**。それ以外は Owner 判断が先に要る。

## 5. 実装順と依存関係の提案

```
Owner 判断 D1（ソース未指定の方針）──┬─> Batch 15: A-1 nigerian-suya（単品、新食材 0）
                                    ├─> Batch 16: A′-1 ume-shiso（新食材 1）＋ 任意で A′-2 goulash
                                    └─> A-3 pesto-genovese（D2 名称判断が追加で要る）
Owner 判断 D3（caponata の初期 pool 変更）──> A-2 caponata（承認が出た場合のみ。それまで保留）
FINISH 液体対応（#579 / #604 / #608 の gate）──> honey 導入 ──> hot-honey-pepperoni、nashville、nduja
Cooking Prep 本番化（#696 → PREP flag）＋ white-sesame の ladder 化 ──> yakiniku / bulgogi
Multi-Sauce / MULTI_SPREAD（#521 / #540 HOLD）──> sfincione、burrata 系 3 品
```

| 順 | Batch | 内容 | 前提（満たされているか） |
|---|---|---|---|
| 1 | **B15** | `nigerian-suya-pizza`（新食材 0、非 credit にするかは Owner 判断。B12 supreme は非 credit、jamaican は credit） | D1 の Owner 承認。他の open PR と衝突なし（現状） |
| 2 | **B16** | `ume-shiso-pizza` + `umeboshi-paste`（任意で `goulash-pizza` + `sour-cream` を別 Batch に分離） | D1、sauce vs topping の判断、視覚差別化の方針 |
| 3 | B17 | `pesto-genovese-pizza`（名称は D2 で決める） | D2 |
| 4 | 保留 | caponata | D3 |
| 5 | 機構待ち | honey 系 / yakiniku 系 / burrata 系 / kimchi | それぞれ §5 の矢印の前提 |

各 Batch の実装時に共通で必要なもの（B13 / B14 の実績どおり）: ladder は append-only（現在 73 step、新 step は 74 以降）、`catalogLedger.test.ts` 更新、Hint 5.0 golden は挿入のみ、DH4 audit の番号シフト、Research コホート（新 key 1 材料なら文字なし）、Lunch Rush opt-out の宣言、`requiredIngredients` の順序（sauce → cheese → toppings。B14 で Rule W と旧 Hint 2.0 H4 の不一致バグが出た箇所）、実装前の Duplicate Gate。**`recipes.ts` / `ingredients.ts` / `PROJECT_HANDOFF.md` は hot file**。

## 6. セッション重なりの確認

- 現在の有効な claim は #724（Sear）のみで、本書のファイルと重ならない。claim は投稿していない（docs-only・新規 1 ファイルのため）。
- 本書が触るのは `docs/reports/TETO_EXPANSION-NEXT-BATCH-15_Research_2026-11-02.md` の 1 ファイルだけ。`PROJECT_HANDOFF.md` などの hot file は未変更。
- 「セッション A / B」が具体的にどの claim / ブランチを指すかは、リポジトリ上では特定できなかった（claim は #724 のみ）。別に走っている作業があれば、そのファイル範囲を教えてほしい。
- `perusonao/teto-pizza-game-preview` は変更していない。

## 7. Owner に確認したいこと

1. **D1 ソース未指定の扱い**: 「その他 / 未指定」の行（suya、caponata、goulash、boerewors、ume-shiso ほか約 28 行）を、今後は一律「NO_SAUCE（または専用ソース）」とするか、これまで通り 1 件ずつ判断するか。方針が決まれば候補が大きく増える。
2. **D2** pesto-genovese の名称（既存 `ジェノベーゼ` との区別）。
3. **D3** caponata のための初期オンボーディング（発見 pool）変更を認めるか。
4. B15 を **A-1 単品**で進めてよいか（A-4 philly は A-1 と排他のため見送り）。
5. §1.1 の 3 点（`LATE_CATALOG_PRODUCTION`、handoff の addendum、open のまま残る Issue）の扱い。

## 8. 実施しなかったこと

コード・テスト・e2e・workflow・データの変更、レシピ・食材・step・ladder の追加、PR 作成、merge、Production・共有 Preview 更新、claim の投稿、pizzadb.jp の取得、`gh` / API による他セッションのブランチ変更。
