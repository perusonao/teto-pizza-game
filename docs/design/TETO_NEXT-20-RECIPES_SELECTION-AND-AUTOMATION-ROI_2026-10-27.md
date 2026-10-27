# 次の 20 レシピの選定・バッチ順・自動化の費用対効果（docs-only）

Status: **調査と提案のみ（docs-only）。** `src/**`・`e2e/**`・CSS・テスト・データ・golden・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更。実装・PR 作成・merge・Monitor 作成・CI 再実行・Issue/PR へのコメント投稿・claim 投稿はしていない。新規ファイルは本書 1 件のみ。
**PR-1（B10 通常）・#679（BBQ）・#684（DH4 pin）の担当ブランチには触れていない**（`origin` の履歴を読んだだけ）。
基準 `main` = `f243c52`（#683 merge 後、2026-10-27）。**「推奨」は Owner Decision ではない。** 未回答を承認済みとみなさない。
**既存調査の再利用:** 新規に調べたのは「PR-1/PR-2 の 9 件を除いた次の 20 件」「自動化の費用対効果」「10 件単位と 20 件単位の比較」だけ。次は読んだだけで、やり直していない。
`claude/teto-pizza-fresh-audit-wboqxo`（B10 計画 第 3 版・実装前監査 = PR-1/PR-2 の 9 件の出典）、`claude/teto-pizza-recipe-expansion-n2i6ee`（バッチ拡張 Fresh Audit・pin 14 箇所の実測・自動化案 A1〜A9）、`TETO_STATE-SYNC_2026-10-26.md`、172 matrix。

**方法の限界.** 依存関係（`node_modules`）は入れておらず、テスト・gate は実行していない。件数は `src/data/*.ts` の静読と matrix JSON の Python 集計、`catalogLedger.test.ts` による。材料集合の近接（Jaccard）は B10 計画で測定済みの値だけ引用し、本書の 20 件については**実装前 Gate での機械検査が必要**（§3 の注）。**工数は見積もりであり測定値ではない**（§5 の式と前提を明記）。原典（pizzadb.jp）は未確認で、構成・個数・投入時機はすべて GAMEPLAY ASSUMPTION。

---

## 0. 結論（先に）

1. **実装済みは 69 レシピ**（通常 64 + late 5）。#679 が入ると 70。PR-1/PR-2（9 件）が入ると 79。
2. **未実装 108 行のうち、決定なしで出せる行はほぼ無い。** 既存工程だけで出せる行は 1（`sfincione`、複数ソース carve-out つき）、新食材のみ 4、新工程 39、仕様未確定 46、PR-1/PR-2 が 9、HOLD・重複が 9。**律速は機構ではなく Owner の決定**（特に「基底ソース未特定は一律 NO_SAUCE にしない」という既存の Owner 決定により、未特定 19 行は 1 行ずつ決めることになる）。
3. **次の 20 件（§3）** は「決定パッケージ 5 つ」でまとまる行を選んだ。新食材は延べ 12 種で、B10（約 14 種）より少ない。0 新食材が 6 件（grandma 型の広い波及が出るので A2 の後）。
4. **バッチは 10 + 10（Batch C = 6 + 4 件、Batch D = 10 件）。** 前半は決定が軽い順、後半は組成衝突・トークン決定が要る行。
5. **自動化の上位 3（§6）:** ① A2 pin の導出化（純削減 約 +1〜+2 PE、C の前提）、② A1+A4 Preflight（工数 2〜3 PE、29 件の範囲では収支均衡、以降の約 88 行に効く）、③ A6+A7 マニフェスト駆動 E2E と Reference 座標の下書き（純削減 約 +0.3〜+0.8 PE）。A3（golden 再生成）は `toMatchFileSnapshot` で**既に `vitest -u` で再生成できる**ため、新規の価値は append-only 検査だけ。
6. **PR 構成は 10 + 10 が最小コスト**（見積もり 約 7.2 PE、20 件 1 本は 約 8.5 PE、5×4 は 約 8.0 PE、1 件 1 本は 約 14.4 PE）。
7. **ブロッカー（§8）:** #679・PR-1 の merge、A2、決定パッケージ P-A〜P-E、#675（トレイ 75 食材）。

---

## 1. 実装済みレシピの正確な数

| 項目 | 数 | 根拠 |
|---|---|---|
| `src/data/recipes.ts` の通常レシピ | **64** | `id:` の列挙（重複 0） |
| late catalog（`lateCatalog.ts`） | **5** | ikura-salmon-pizza、yuzu-shrimp-pizza、eggplant-dengaku-pizza、eggplant-tahini-pizza、pinsa-romana |
| **合計（本番、`PINSA_PRODUCTION = true`）** | **69** | `catalogLedger.test.ts`: `recipes: pinsa ? 69 : 68`。Pinsa OFF で 68 |
| credited / ingredients / toppings / ladder step | 63 / 75 / 56 / 60 | 同 ledger |
| 章の人数 | [6, 12, 18, 33]（Pinsa OFF は 32） | 同 ledger |
| Lunch Rush プール | 25 | 同 ledger |
| 172 matrix との突き合わせ | 172 行のうち 64 行が出荷済みに対応 + BBQ（#679）= 65。**未実装 108 行（BBQ を除く）** | `cand.py` 相当の集計。n2i6ee の「109」は BBQ を含む数 |
| 未 merge で数が動くもの | #679 → 70 / 77 / step 61。PR-1 → +5、PR-2 → +4 | #679 本文、B10 計画 |

`STATE-SYNC` の「68」は #673（tahini）前の値で、現在は 69。

## 2. 未実装 108 行の分類

優先順位: 新工程 > 仕様未確定 > 新食材のみ > 既存工程（1 行を 1 区分にだけ入れる。副次の理由は §3 の表）。PR-1/PR-2 の 9 件と HOLD・重複は先に除く。

| 区分 | 行数 | 内容 |
|---|---|---|
| **既存工程で実装可能** | **1** | `sfincione`（トマト + オリーブ油の 2 ソース = グランマの presence-only carve-out が要る。新食材 0） |
| **新食材のみ必要** | **4** | `pescatore`（mussel、2 ソース）、`pizza-salad`（yogurt-sauce 等 3 種、2 ソース）、`pesto-noci`（honey・walnut = `other` 家族リスク）、`peking-duck-pizza`（新食材 3、PREPARED_COMPOSITE） |
| **新工程必要** | **39** | DOUGH_VARIANT（ピアディーナ型・#577 HOLD）、STEP_ORDER、ZONED、PAN_BAKE、DOUGH_SHAPE_TARGET、ENCLOSE、PREP_STEP、LAMINATE、FRY_COOK のいずれかが必須。NOT_REPRESENTABLE 16 行を含む |
| **仕様未確定** | **46** | 基底ソース未特定のみ 19、組成衝突のみ 8、未解決トークンのみ 7、機構解釈（サラダ系 p8 ほか）のみ 6、複合 6。**うち late（FINISH）で出せるのは `teriyaki-chicken`・`eel`・`natto` 等だが、いずれも仕様未確定** |
| **PR-1/PR-2（9 件）** | 9 | curry-pizza-japan、rendang、currywurst、tandoori-paneer、cuban、bulgogi、yakiniku、wasabi-beef、mentaiko-cream |
| **HOLD・重複** | 9 | `tsukimi`（OD-B9-8/12）、`bianca`（出荷済みと材料完全一致）、`goulash`・`nigerian-suya`（E-3 保留）、ブッラータ系 3（`burrata-pizza`・`pizza-alla-crudaiola`・`pesto-burrata`）、`hot-honey-pepperoni`、`piadina-romagnola`（#577 HOLD） |
| 計 | 108 | |

**読み取り:** 「新食材のみ」で決定を要しない行は無く、4 行とも 2 ソース carve-out（D4）か `other` 家族か PREPARED_COMPOSITE の判断が付く。したがって次の 20 件は**「決定パッケージを 1 つ通すと複数行が開く」行**を選ぶのが最短。決定のレバレッジは matrix §7.1 の「唐辛子 7 行・ひき肉 5 行」と同じ考え方。

## 3. 次の 20 件（PR-1/PR-2 の 9 件を除く）

選定基準: ① 新工程を要しない（通常フロー、2 ソースは presence のみ）② 新食材 0〜1 を優先し、新食材を複数レシピで共有 ③ 決定パッケージが少ない ④ `other` 家族（egg・almond・pine-nuts）に触れる材料（honey・walnut・mayo）を避ける ⑤ ブッラータ・月見・DRIZZLE・生地種別・goulash/suya は含めない。
**注:** 「必要な決定」は**提案であり決定ではない**。matrix の「その他」ソースを一律 NO_SAUCE にすることは禁止（既存の Owner 方針）なので、基底ソースは各行の欄で個別に提案した。

**決定パッケージ:** **P-A** 基底ソースの個別決定 / **P-B** 未解決トークンの決定（チーズ→mozzarella、ひき肉→`ground-beef`、唐辛子→`chili`、ホワイトソース→`fromage-blanc-sauce`）/ **P-C** 組成衝突の個別決定（catalog 候補との DIVERGENT）/ **P-D** 複数ソース carve-out（グランマの M-2 を一般化、presence のみ）/ **P-E** 代用（`chicken-tikka` → `chicken`）。

| # | レシピ（matrix id） | 新食材 | 基底ソース（提案） | 必要な決定 | 前提・備考 |
|---|---|---|---|---|---|
| 1 | `sfincione` | 0 | tomato-sauce + olive-oil（2 ソース） | P-D | 命名クラスタ（Sicilian）。非 credit 想定（D3） |
| 2 | `baingan-bharta-pizza` | 0 | curry-ketchup（PR-1 の材料。D-B3 の検証が前提） | P-A | **#679（cilantro）と PR-1 が前提**。既存 cohort（fresh-tomato）へ参加の見込み |
| 3 | `chicken-tikka-pizza` | 0（代用時） | curry-ketchup | P-A、P-E | `chicken-tikka` は PREPARED_COMPOSITE。代用しない場合は新食材 1。#679・PR-1 が前提（cilantro・curry-ketchup） |
| 4 | `caponata-pizza` | 0 | 個別決定（オリーブ油 or 個別 NO_SAUCE） | P-A | 既存 cohort（capers = puttanesca）へ参加の見込み |
| 5 | `jamaican-jerk-chicken-pizza` | 0 | 個別決定（ジャーク系ソースを足す場合は +1） | P-A | 既存 cohort（green-pepper）へ参加の見込み。hawaiian に近い（B10 計画の測定 0.33） |
| 6 | `hokkaido-cheese-pizza` | 0 | なし（チーズ主体） | P-B（チーズ→mozzarella） | 材料: potato・corn・bacon・mozzarella。**P-B 1 つで 3 行（hokkaido・pide・philly）に効く** |
| 7 | `ume-shiso-pizza` | umeboshi-paste（1） | 個別決定（梅をソースにするか） | P-A | 近接: shirasu 0.60（B10 計画）。差別化が弱い。梅の色の ΔE を測る |
| 8 | `jerusalem-mixed-grill-pizza` | cumin（1、spice） | 個別決定 | P-A | cohort 新。parsley 再利用 |
| 9 | `peruvian-aji-amarillo` | aji-amarillo（1、**ソース**、色駆動） | aji-amarillo | P-A | 家族判断。ソース色の ΔE（トマト・豆板醤・BBQ 暫定・味噌・タヒニ） |
| 10 | `south-african-boerewors` | chutney（1） | 個別決定（chutney をソースにするか） | P-A | name-specificity gap（matrix） |
| 11 | `moussaka-style-pizza` | cinnamon（1、spice） | fromage-blanc-sauce（D-B5 と同系） | P-B（ホワイトソース） | lamb・feta・eggplant は再利用 |
| 12 | `pizza-alla-norma` | ricotta-salata（1、cheese） | tomato-sauce | P-C | 近接: melanzane 0.60。組成衝突（catalog 候補との DIVERGENT） |
| 13 | `thai-chicken-pizza` | peanut-sauce（1、sauce）+ `chili` | peanut-sauce | P-B（唐辛子） | cilantro = #679 |
| 14 | `pizza-baiana` | `chili`（13・15 と共有） | tomato-sauce | P-B（唐辛子） | sausage・egg・onion・mozzarella は再利用。近接は要 Gate |
| 15 | `keema-pizza` | `ground-beef`（16 と共有） | curry-ketchup | P-A、P-B（ひき肉・唐辛子） | **PR-1 の curry-ketchup が前提** |
| 16 | `pizza-chilena` | `ground-beef` | tomato-sauce | P-B（ひき肉） | onion・egg・olive・mozzarella |
| 17 | `porcini-pizza` | porcini（18 と共有） | なし（チーズ主体） | P-C | 組成衝突（DIVERGENT） |
| 18 | `boscaiola-pizzadb` | porcini | なし | P-C | 組成衝突。sausage・olive-oil |
| 19 | `pescatore` | mussel（20 と共有） | tomato-sauce + olive-oil（2 ソース） | P-D | **材料 8 種で Reference が混む**（B10 計画 R5）。HV で確認 |
| 20 | `frutti-di-mare-pizzadb` | mussel + squid | tomato-sauce | P-C | 組成衝突 + 命名クラスタ（Frutti di Mare / Pescatore） |

- **新食材は延べ 12 種:** umeboshi-paste、cumin、aji-amarillo、chutney、cinnamon、ricotta-salata、peanut-sauce、`chili`、`ground-beef`、porcini、mussel、squid。0 新食材は 6 件（#1〜#6）。
- **予備（20 に入れない）:** `speck-e-brie`（walnut = `other` リスク）、`diavola`（spicy-salami 未解決）、`peking-duck`（新食材 3 + 合成材料）、`nashville-hot-chicken`（honey）、`banh-mi`（新食材 3）、`buffalo-cauliflower`（新食材 2 + 基底未特定）、`teriyaki-chicken`・`eel`（late、決定多数）、`supreme`（組成衝突）、`pizza-salad`・`pesto-noci`。
- **含めなかった理由:** サラダ系 p8（機構解釈）、デザート系（デザートソース家族が未決）、`kimchi`（PREP_STEP）、`lomo-saltado`（PREP + 後乗せ + 基底未特定）、`natto`（mid-bake）。
- **注:** #2〜#6・#14〜#16 の cohort 移動（既存プレイヤーの「？？？ピザ（○○）」の文字が動く可能性）は静読による見込みで、**実装前 Gate で Preflight（§6 A1）により確認する**。近接 Jaccard も同様に、B10 計画で測定済みの行以外は未測定。

## 4. バッチ順（食材・ソースの共有率と依存関係）

共有: `ground-beef` ×2（#15・#16）、`porcini` ×2（#17・#18）、`mussel` ×2（#19・#20）、`chili` ×3（#13・#14・#15）、`curry-ketchup`（PR-1 から #2・#3・#15）、`cilantro`（#679 から #2・#3・#13）、`fromage-blanc-sauce`（既存から #11）。

| バッチ | 件数 | 構成 | 新食材 | 新 ladder step | 必要な決定 | 前提 |
|---|---|---|---|---|---|---|
| **C（前半）** | 10 | #1〜#6（新食材 0 の 6 件）+ #7〜#10（鍵 4 件） | 4（umeboshi-paste、cumin、aji-amarillo、chutney） | 4（鍵材料ごとに 1） | P-A、P-D、P-B（チーズ→mozzarella のみ）、P-E | **A2（導出化）**・PR-1 merge（#2・#3 は curry-ketchup）・#679 merge（#2・#3 は cilantro） |
| **D（後半）** | 10 | #11〜#20（鍵 3 + 共有クラスタ 7） | 8（cinnamon、ricotta-salata、peanut-sauce、`chili`、`ground-beef`、porcini、mussel、squid） | 8 | P-B（唐辛子・ひき肉・ホワイトソース）、P-C（組成衝突 4 行）、P-D | C の merge、PR-1（#15） |

- **順序の理由:** (1) C は P-A 中心で軽く、D は組成衝突（P-C）と複数のトークン決定（P-B）が要るので、決定の準備時間を稼ぐ。(2) 新食材 0 の 6 件は A2 の後（grandma 型の波及を避ける）。(3) 共有クラスタは同じバッチに入れる（`ground-beef`・`porcini`・`mussel`・`chili` は 1 バッチ内で閉じる）。
- **0 新食材のレシピは ladder step を持たない**ので `ladderCredit: false`（グランマ・8a の前例、D3 の a）。credited の増加は C で 4（#7〜#10）、D で 3〜5（#11・#12・#13、クラスタの鍵）。slack は保たれる見込みだが、**ON/OFF 両方で `ladderReachability.starGate` を実測する**。
- 通常 step が増えると late 材料の導出 step 番号が +N ずれる（`LATE_ENTITLEMENT_FLOORS` が既存セーブを守る）。**PR-1 と C、D の各 PR で floor の不後退テストを走らせる**。

## 5. 繰り返し作業の洗い出し（足りない部分だけ）

既存調査（n2i6ee §5.1）の pin 14 箇所の実測は再測定せず、**現行 main で自動化がどこまで既にあるか**だけ確認した。

| 作業 | 現行 main の状態 | 本書の確認 |
|---|---|---|
| 件数 pin | `catalogDerived.ts` と `catalogLedger.test.ts`（唯一の手書き正本）で導出化済み | 維持。ledger は 1 バッチ 1 回の手更新 |
| golden | `hint5.ladders55.json` は `toMatchFileSnapshot`（`hint5Ladder.golden55.test.ts:71`）。**`vitest -u` で再生成できる**。`UPDATE_SAUCE_B1_GOLDEN=1` の前例もある | 再生成の仕組みは**既にある**。無いのは「既存エントリが byte 同一（追記のみ）」の検査 |
| Recipe Batch Validator | `recipeBatchManifest.ts`（80 行）+ `recipeBatchValidator.ts`。バッチ宣言の planned→landed | 維持。manifest を A6 の入力に使える |
| レシピごとの手書き pin | tahini（#673）で hand 編集が必要だったファイルは **15 件**（`pinsaGate.test`・`catalogLedger.test`・`pinsa.production.test`・`e5.ikuraProduction.test`・`recipeChapters.test`・`recipeBatchManifest`・`lateAxis.test`・`hint5Ladder.baseCompat.test`・`deductionGuard.gate.test`・`techniqueAllowlists`(+test)・`recipeSauceProfiles`・`recipeHintRoles`・`referencePizza`・`e2e/new-sauces-u3.spec.ts`） | これが A2 の対象。late 側は `pinsaGate.test.ts` の OFF 一覧が厳密リストで、2 箇所に追記（#683 の注記） |
| E2E | レシピ（または 1 PR）ごとに新規 spec ≈ **195〜204 行**（u2 196・u3 195・grandma 204・new-bbq 200） | ほぼ同型。A6 の入力 |
| 画像・HV | 1 PR あたり 9〜19 枚の 390×844 スクリーンショット + 動画（Owner へ直接）。`tools/finish*.mjs` は機能ごとの使い捨て | 汎用化されていない。HV の粒度（D6）の Owner 判断に依存 |
| Reference 座標 | `referencePizza.ts` 4,283 行。レシピごとに +60 行前後。`getReferenceSlots(n)`（`pizzaReferenceLayout.ts`）が座標を生成 | A7 で下書き生成可能 |
| 測定ツール | `npx vite-node tools/<name>/check.ts` の型が #611 の BBQ gate にある（`ingredients`・`DISCOVERY_LADDER`・`LATE_*` を直接 import） | A1 の土台。基盤の新設は不要 |
| ON/OFF 行列 | `npm run test:pinsa-off` は**CI で走らない**。main が OFF 側で赤になった前例（#683） | A5（npm script 1 本）で足りる |

## 6. 自動化の費用対効果（上位 3 件）

**単位:** PE = 直近の late 1 レシピ PR（約 50 ファイル、うち src の 70〜90 % がテスト・golden）1 本分の作業量。内訳の前提（**見積もり、測定ではない**）: 固定部分 0.40（ledger・manifest・golden 再生成・ON/OFF 全件・CI 往復・PR 文・Result）+ レシピ固有 0.20 + 新食材 1 つあたり 0.20 を、新食材 2 つの 1 レシピ PR で足して 1.0。
**対象:** 本書の 20 件 + PR-1/PR-2 の 9 件 = 29 レシピ、PR 約 4 本（PR-1・PR-2・C・D）。

| 案 | 内容 | 工数 | 削減（29 レシピ・4 PR） | 純削減 | 比 | 備考 |
|---|---|---|---|---|---|---|
| **A2（1 位）** | pin の導出化。「全部見つけた」seed を `allDiscoveredIds()` 1 つに、Dex ピル・Pizza Select の件数を `CATALOG_COUNTS` に、`EXPECTED_OFFERS` を ladder と tier 規則から導出、`researchLabels.batch8a` の件数を ledger に統合、`recipes.test` のバッチ配列をマニフェストに | **2〜3** | 4 PR × 0.16 + 29 × 0.07 = **約 2.7**、+ 新食材 0 の 6 件による波及の回避 **約 1.4**（grandma #655 は 121 ファイル、新食材ありの PR は 44〜62。波及源は e2e 17 ファイル）= **約 4.1** | **約 +1.1〜+2.1** | 1.4〜2.0 | **assertion は弱めない**（導出値が従来の手書き値と一致する期間を 1 PR 設けて等価性を確認）。C の #1〜#6 が前提にするため先行必須 |
| **A1+A4（2 位）** | Preflight（`vite-node` の読み取り専用ツール）: 材料集合の衝突（完全一致・Jaccard）、cohort 鍵と**文字移動**、slack、`other` 家族の露出、ソース色の ΔE、emoji の G18 一意性、トレイ件数・ページ数、価格 tier の表。A4 = `deductionGuard.gate` の原因分解（5 構成）を同じ出力に | **2〜3**（土台の型が #611 にある） | PR ごとの事前調査 約 0.5 × 4 = **2.0**。**加えて残り約 88 行のすべての将来バッチに効く**（再利用）。ミスの前倒し検出（#683 型の赤・近接の見落とし）は未算入 | **約 −1〜0（29 件の範囲）、以降は正** | 0.7〜1.0（29 件）／ 将来 1.5 超 | 判定は緩めない（赤は赤のまま）。B10 の Python 手計算を置き換える。A5（ON/OFF 行列の npm script、工数 0.3）を同梱 |
| **A6+A7（3 位）** | マニフェスト駆動の E2E 1 本（レシピごとに Shop NEW → 購入 → Reference どおりに調理 → NEW_DISCOVERY → Dex の No./章 → Research ラベル、390×844 / 360×800 のトレイ溢れ・ページ数）+ `getReferenceSlots(n)` からの座標の下書き | **1.5〜2** | 現状は 1 レシピあたり spec 約 200 行 + 座標 60 行 ≈ 0.08 PE × 29 = **約 2.3**、残余 0.01 × 29 | **約 +0.3〜+0.8** | 1.2〜1.5 | 新規 spec のみ（既存 assertion は触らない）。座標は下書きで、最終は人の目 |

**順位の根拠:** 純削減は A2 が最大で、C の前提でもある。A1+A4 は 29 件の範囲では収支が均衡に近いが、残り約 88 行に効き、B10 で Python を手書きした分析を再現可能にするので 2 位。A6+A7 は同型 spec の繰り返し（195〜204 行 ×4）が実測で確認でき、収支は小さく正。
**上位に入れなかったもの:** A3（golden 再生成は既にある。append-only 検査だけなら 0.3 で A1 に同梱）、A8（HV 資料の一括生成。HV の粒度が Owner 判断 D6 で、工数 2.5 に対し削減 約 2.0 で比 0.8）、A9（claim の雛形、投稿は人）。
**感度:** 固定部分を 0.5 に上げると A2 の削減は 約 +0.5、下げると −0.5。A2 の工数が 3 を超え、波及回避が効かない（新食材 0 の件を C に入れない）場合は純削減が 0 に近づく。上の比は**見積もりの幅**として読むこと。

## 7. 10 件単位と 20 件単位の PR 構成

モデル: PR の工数 = 固定 0.40 + 0.20 × レシピ数 + 0.20 × 新食材数。20 件の新食材は 12。リスク係数は 1 PR のレシピ数で変える（≤ 10 件で 1.0、20 件で 1.25。根拠: 121 ファイルの #655 は 1 レシピでも大きく、20 件は 150〜250 ファイル見込みで WebKit 間欠失敗 #394 系の再実行・レビューの負荷が増える。**係数は仮定**）。

| 案 | PR 数 | 固定 | 変動 | 小計（PE） | リスク係数 | 見積もり（PE） | Owner の HV 回数 | HOT ファイルの直列化 | 主なリスク |
|---|---|---|---|---|---|---|---|---|---|
| 1 件 1 本 | 20 | 8.0 | 4.0 + 2.4 | 14.4 | 1.0 | **14.4** | 20 | 20 回（`recipes.ts`・`ingredients.ts`・`referencePizza.ts`・`App.css`・`lateCatalog.ts`） | pin の衝突解消の反復。late の導出 step が毎回動く |
| 5 件 ×4 | 4 | 1.6 | 6.4 | 8.0 | 1.0 | **8.0** | 4 | 4 回 | 決定パッケージごとに PR を切りにくい |
| **10 件 ×2（推奨）** | 2 | 0.8 | 6.4 | 7.2 | 1.0 | **7.2** | 2 | 2 回 | C は軽く先に出せる。D は組成衝突の決定待ちで遅れ得るが C を止めない |
| 20 件 ×1 | 1 | 0.4 | 6.4 | 6.8 | 1.25 | **8.5** | 1 | 1 回 | 巨大 PR、全決定の待ち合わせ（P-C・P-B が揃うまで C の 10 件も出せない）、WebKit 再実行、巻き戻し困難 |

**推奨は 10 ×2。** 20 ×1 は固定費は最小だが、決定の準備が遅い D の 10 件が C の 10 件を止める。5 ×4 は決定パッケージで綺麗に切れず、HV が 4 回になる。
前提の違い: A2 が先に入ると各案の変動部が約 0.07 × 20 = 1.4 PE 下がるが、案の順位は変わらない。HV の粒度（D6: バッチ 1 本の動画か、レシピごとか）は Owner 判断で、バッチ 1 本なら 10 ×2 の HV 負担が一番軽い。

## 8. ブロッカーと Owner 判断

**着手の前提（技術）**

1. **#679（BBQ）の merge**（C の #2・#3、D の #13 が cilantro を使う。`lateCatalog.ts` ほか HOT ファイルを共有）。
2. **PR-1（B10 通常）の merge**（C の #2・#3、D の #15 が curry-ketchup を使う。通常 step が増えると late の導出 step がずれる）。
3. **A2 の merge**（C の新食材 0 の 6 件の前提）。A1 は C の Final Design Gate 前に欲しい。
4. **`test:pinsa-off` の基準:** #683 は main に merge 済み（`f243c52`）。各バッチ PR での ON/OFF 両方の全件実行の記録（CI が守らない）。
5. **#675（トレイ 75 食材 UX の実測）**: 食材が 75 → 約 90 になる前に実測する。チーズ棚（11 → 13）・spice（2 → 4）の偏り。
6. **#544 / D-R1**（§15 の複数ソース前提の再計算）: C は 2 ソース（#1）、D も 2 ソース（#19）を含む。B10 の前提として扱う決定に従う。

**Owner 判断（提案。回答の形式は「P-A = 個別、D6 = a」のように 1 行で選べる）**

| ID | 内容 | 助言 |
|---|---|---|
| **N-1** | 本書の 20 件と C/D の 10 ×2 構成でよいか。差し替え候補は §3 の予備 | はい |
| **N-2** | P-A: 基底ソース未特定の 8 行（#4・#5・#7〜#10、#2・#3 は D-B3 に連動）を**行ごと**に決める。「その他 → NO_SAUCE」の一律変換は禁止のまま | 行ごと。本書の提案欄を叩き台にする |
| **N-3** | P-B: トークン決定の 4 件（チーズ→mozzarella、ひき肉→`ground-beef`、唐辛子→`chili`、ホワイトソース→`fromage-blanc-sauce`） | 4 件を一度に決める（1 決定で複数行が開く） |
| **N-4** | P-C: 組成衝突 4 行（norma・porcini・boscaiola・frutti）の組成をどちらに寄せるか（catalog 候補 / PIZZA DB） | D の前に必要 |
| **N-5** | P-D: 複数ソース carve-out（presence のみ）の一般化を #1・#19 に適用するか | 適用。ただし #19 は HV で混み具合を確認 |
| **N-6** | P-E: `chicken-tikka` を `chicken` で代用してよいか | はい（新食材 −1） |
| **N-7** | 新食材 12 種の家族・価格 tier の L1 承認（`other` に入れない。`chili`・`chutney`・`peanut-sauce` の category を含む）。SVG 方針（形が特徴的な porcini・mussel・squid・ricotta-salata だけ専用、他は G18 を通す emoji） | Preflight の一覧を見て承認 |
| **N-8** | 新食材 0 の 6 件を非 credit にする（D3 = a） | はい |
| **N-9** | HV の粒度（D6）: バッチ 1 本の動画 + レシピごとのスクリーンショット | はい。Policy の解釈なので Owner が決める |
| **N-10** | 自動化の着手順: A2 → A1+A4(+A5) → A6+A7。いずれも test/tools のみで、ランタイムは変えない（HV Policy の適用判断は Owner） | はい |

## 9. 推定削減工数（まとめ）

§7 のモデルで 4 PR（PR-1: 5 件・新食材 約 8、PR-2: 4 件・約 6、C: 10 件・4、D: 10 件・8）の手作業は 0.4 + 0.2 × 件数 + 0.2 × 新食材で 3.0 + 2.4 + 3.2 + 4.0 = **約 12.6 PE**（29 レシピ）。

| 項目 | 見積もり（PE） |
|---|---|
| 自動化 3 件の総削減（A2 約 4.1 + A1/A4 約 2.0 + A6/A7 約 2.3） | **約 8.4** |
| 自動化 3 件の工数（A2 2〜3 + A1/A4 2〜3 + A6/A7 1.5〜2、A5 同梱 0.3） | **5.5〜8.3** |
| **29 レシピの範囲での純削減** | **約 +0.1〜+2.9**（ほぼ回収されるだけ） |
| 以降の 1 バッチ（10 件・新食材 約 5）あたり | 手作業 約 3.4 → 自動化後 約 1.6〜2.0（約 1.4〜1.8 の削減）。残り約 88 行 ≈ 9 バッチなら **約 12〜16 PE** |

**読み方:** 29 レシピの範囲では投資はほぼ回収されるだけ。**効果が出るのは残りの将来バッチ**。したがって A2（C の前提で必須）を先に入れ、A1+A4 は C の Final Design Gate 前、A6+A7 は D に間に合えばよい。**投資の判断は「29 件で止めるか、172 行まで続けるか」で変わる**（Owner の方針）。削減はすべて§6 の前提に依存する見積もりで、測定値ではない。

## 10. 触れていないもの

`src/**`、`e2e/**`、CSS、テスト、データ、golden、workflow、本番スイッチ、共有 Preview、Production、Firebase、保存データ、`docs/PROJECT_HANDOFF.md`、既存の決定記録、PR-1 / #679 / #684 の各ブランチと担当セッション、Issue/PR へのコメント・クローズ・claim 投稿。merge・deploy・CI 再実行・Monitor 作成はしていない。
