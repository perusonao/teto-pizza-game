# Wave 2 — W2-A Authoring Gate

Status: **判定 B → Owner が A1〜A8 を確定（§13）。W2-A0 完了。**（元の判定は §12）production 実装・PR・merge・deploy はしていない。
変更は docs / data / tools だけ（src / e2e / CSS 変更なし）。

| 項目 | 値 |
|---|---|
| 監査した main | **`7bb0116`**（Merge PR #264 DH4-2A）。作業中に `51e0923` から進んだので merge し直して再検証した |
| branch | `claude/wave2-runtime-recipe-design-os06j1` |
| Owner Authority の記録 | `docs/design/TETO_WAVE2_OWNER-DECISION-LEDGER.md`（OD-W2-1〜9、Large Catalog 方針） |
| authoring 候補（単一の入力） | `tools/wave2-w2a/w2a_authoring_candidates.json`（値ごとに EVIDENCE / DERIVED / OWNER_REQUIRED） |
| 検証出力 | `docs/design/data/TETO_WAVE2_W2A_OWNER-GATE.json`（progression・collision）、`docs/reports/data/TETO_WAVE2_W2A_CALIBRATION.json`（Scoring / Completion / save）、`docs/reports/data/TETO_WAVE2_W2A_UI-PROBE.json`（白ソース・tray 実測） |
| 検証 tool | `tools/progression2_wave2_w2a_gate.py --check`、`npx vitest run --config tools/wave2-w2a/vitest.harness.config.ts`（21/21）、`npx playwright test -c tools/wave2-w2a/playwright.probe.config.ts`（48/48） |
| screenshot | `docs/reports/screenshots/wave2-w2a-authoring/`（白ソース 8 案 × 4 viewport + RESULT、tray 16 状態） |

tool は **src を 1 行も変えずに** 本番コードを動かす: harness は `getReferencePizza` だけを mock して W2-A 候補 reference を返し、probe は dev server の `src/data/ingredients.ts` の応答をブラウザ内で書き換えて 8 材料を足す。

## 0. Fresh GitHub state と依存

| 対象 | 状態（2026-09-27） | W2-A への影響 |
|---|---|---|
| main | `51e0923` → **`7bb0116`**: PR #265（DH4-2 authority docs）、PR #264（DH4-2A pure logic、`deductionGuard.ts` / `deductionRequest.ts`、unwired） | `src/data/**`・ladder・matcher・Shop・persistence は無変更。W2 の 2 つの tool は `--check` で byte 一致のまま。DH4-2 の partition guard は候補集合 W から決まる（population 非依存）が、DH4-2 audit（`dh4_2_topping_count_audit.py`）は 25-recipe snapshot で pin されている → W2-A 実装時に 34-recipe で再監査が必要（§11 の test） |
| PR #255（172 taxonomy audit、OPEN） | OD-TAX-1..9 承認済み（authority ではない）。DH4-2 が docs 差分案（OD-DH4-2-12）を main に置いた | OD-W2-5 の 7 行はすべて #255 の `PROPOSED / high` と一致、DH4-1 の 7 family と矛盾なし。DH4-2 は「DH4-1 行を変えない」だけで新規行の追加は妨げない（§2.1） |
| Large Catalog UX（`claude/large-catalog-ux-design-sq8saf`、未 PR） | Fresh Design: LC-0〜LC-9、「topping > 24 で 5 ページ目」を LC-1〜3 の目安にしている | Owner 決定（OD-W2-LC）で W2-A の blocker にはしない。§4 で実測して再判定 |
| Cooking Techniques（`claude/cooking-techniques-design-n0qfwj`、未 PR） | 172 行の technique audit | W2-A は technique を使わない（OD-W2-7: 生ハム・ルッコラは焼く前）。競合なし |
| Dinner（PR #259 DM-4-1 OPEN、`dm5-1` branch、Issue #257/#258） | settlement pure layer / Human Timing | mission 定義は `w1-25` のまま。W2-A は Dinner の tray（recipe-free）を 5 ページにする（§4） |
| Issue #256 焼成失敗でも CUT（gate branch あり） | 実装 gate 段階 | CUT ありの W2-A 7 recipe も同じ扱いになる。W2-A 側の変更は不要 |
| Issue #260（OPEN、Owner 作成） | `progression2_mechanic_matrix.py --check` drift | §10。phase2 tool の drift は #260 に含まれていない |
| deploy | `.github/workflows/deploy.yml` は **main への push で公開** | W2-A の slice は merge ＝ 即公開。slice 設計に反映（§9） |

## 1. 9 recipes（1 件ずつ）

値の状態: **EVIDENCE**（PIZZA DB / Phase-1 から読んだ）、**DERIVED**（既存の承認済み rule を機械的に適用、rule を明記）、**OWNER_REQUIRED**（evidence と既存 rule では決まらない。候補は示すが採用しない）。
使った rule（`w2a_authoring_candidates.json` `rules`）:

- **R-MC（minCount）**: W1 の authoring rule（#221 authoring tool / REC-01..03 で承認）— sauce 1、mozzarella 2、secondary cheese 2、名前の主役 topping 3、supporting 2、herb baseline 2、egg 1。oregano は accent 1（runtime 4 件中 3 件）。
- **R-BT（bakeTarget）**: REC-01 で「game authoring、外部 evidence ではない」。catalog の bakeProfile か、同じ base + 同じ主役の runtime recipe がある時だけ DERIVED、それ以外は OWNER_REQUIRED。幅は全 runtime recipe と同じ 20。
- **R-REF（配置）**: authoring しない。RT-01 `assignReferenceSlots` に sauce → mozzarella → evidence 順の非 sauce 材料と minCount を渡した結果（W1 と同じ）。葉物は LIGHT_LEAF、他は HEAVY_SQUASH、許容 8/22。
- **R-CUT**: OD-W2-4。**R-NAME**: nameJa は PIZZA DB。runtime の Recipe / Ingredient 型に英語名 field はないので、英語名は情報のみ。

### 1.1 ブラジリアン・カラブレーザ — `brazilian-calabresa`

| 項目 | 値 | 状態 |
|---|---|---|
| canonical recipe ID | `brazilian-calabresa`（discovery target `brazilian-calabresa-pizzadb-p10`） | EVIDENCE（Phase-1 canonicalCandidateId） |
| 日本語名 | ブラジリアン・カラブレーザ（13 文字） | EVIDENCE（PIZZA DB nameJa） |
| 英語名 | Brazilian Calabresa (informational; not in evidence) | runtime に英語名 field なし（情報のみ。production 不要） |
| source / evidence | https://pizzadb.jp/compare/world-pizzas/page/10/、comparison_table_sample、Phase-1 READY_WITH_REVIEW、token exact_alias, likely_alias、likely alias オリーブ->black-olive | MEDIUM |
| ingredients（identity set） | black-olive, onion, oregano, sausage, tomato-sauce | EVIDENCE |
| sauce / base | `tomato-sauce` ×1、PAINT | EVIDENCE + DERIVED（R-MC） |
| cheese | なし（CHEESE step なし） | EVIDENCE |
| toppings / minCount | sausage ×3, onion ×2, black-olive ×2, oregano ×1 | DERIVED |
| bake target | 62–82（Completion Gate 許容 ±10） | DERIVED: R-BT: runtime salsiccia (tomato-sauce base, sausage primary) 62-82 |
| piece layout / reference | 8 pieces、RT-01 legacy ring: sausage [(50, 24), (73, 36), (76, 63)] HEAVY_SQUASH; onion [(58, 79), (38, 79)] HEAVY_SQUASH; black-olive [(22, 63), (25, 36)] HEAVY_SQUASH; oregano [(50, 52)] HEAVY_SQUASH | DERIVED（R-REF、minCount 確定で決まる） |
| CUT | あり（6 slices）（dough evidence: 薄めの生地） | DERIVED（OD-W2-4） |
| cooking profile | DOUGH → SAUCE → TOPPING → CUT | DERIVED（deriveCoreSteps） |
| discovery identity | items {black-olive, onion, oregano, sausage, tomato-sauce}、sauceBase [tomato-sauce]、default dimensions。exact collision 0 | 検証済み |
| expected Completion Gate | reference-accurate: FREE PASS / Order PASS。1 個ずつ: FREE PASS / Order FAILED。sauce を一点に: FAILED（INSUFFICIENT_SAUCE）。bake +15: FAILED。主役欠け: FAILED | harness 実測 |
| expected Scoring 2.0 | 正確 99.5 / good 70.6 / sauce 雑 65.2 / 配置 雑 89.9 / 1 個ずつ 65.4 / 主役欠け 46.6。類似 W1 `salsiccia` と同じ曲線 | harness 実測 |
| expected ★ range | 正確 ★5、good ★3、配置 雑 ★4、1 個ずつ ★3、主役欠け ★2（→ ★2〜5） | harness 実測 |
| unlock prerequisite | key step 12（発見数 ≥ 12）: onion | 検証済み（append） |
| new ingredient dependency | なし（W1 材料だけ） | — |
| chapter | 第2章（T2） | OD-W2-2 |
| collision | exact 0 / nested: なし / 1 材料差: なし | 検証済み |
| Dinner matcher | 作ると UNIQUE_MATCH（target 外 recipe）。BAKE window 62–82、CUT あり | 影響なし（mission 定義は w1-25） |
| Lunch Rush | 発見後に pool 入り。order policy は minCount 必須、pack = 10×k で 1 pack 10 枚分 | 互換 |
| Guided | 1 category 最大 4 chip → 1 ページ。CHEESE step なし | 互換 |
| Free Cooking | FREE 判定は generic window 60–80 + 完全一致。topping tray は 5 ページ（§4） | 互換 |
| unresolved | オリーブ -> black-olive is a likely_alias (colour not stated in PIZZA DB); NAMING_CLUSTER NC-4-calabresa (アルゼンチン風カラブレーサ is a blocked sibling); no cheese in evidence -> no CHEESE step (same as marinara / puttanesca) | — |
| description draft | 「トマトソースにソーセージ、たまねぎ、ブラックオリーブ、オレガノをのせた、サンパウロ生まれのチーズを使わない一枚。」 | **OWNER_REQUIRED** |

### 1.2 ヴォンゴレピザ — `vongole`

| 項目 | 値 | 状態 |
|---|---|---|
| canonical recipe ID | `vongole`（discovery target `vongole-pizzadb`） | EVIDENCE（Phase-1 canonicalCandidateId） |
| 日本語名 | ヴォンゴレピザ（7 文字） | EVIDENCE（PIZZA DB nameJa） |
| 英語名 | Vongole Pizza (informational) | runtime に英語名 field なし（情報のみ。production 不要） |
| source / evidence | https://pizzadb.jp/compare/world-pizzas/ (original Phase 0B sample batch, page 1)、comparison_table_sample、Phase-1 READY、token phase0b_sample_canonical | HIGH |
| ingredients（identity set） | clam, garlic, olive-oil, parsley | EVIDENCE |
| sauce / base | `olive-oil` ×1、PAINT_TEMPORARY | EVIDENCE + DERIVED（R-MC） |
| cheese | なし（CHEESE step なし） | EVIDENCE |
| toppings / minCount | clam ×3, garlic ×2, parsley ×2 | DERIVED |
| bake target | 62–82（Completion Gate 許容 ±10） | DERIVED: R-BT: runtime new-haven-apizza (olive-oil base, clam primary) 62-82 |
| piece layout / reference | 7 pieces、RT-01 legacy ring: clam [(50, 24), (73, 36), (76, 63)] HEAVY_SQUASH; garlic [(58, 79), (38, 79)] HEAVY_SQUASH; parsley [(22, 63), (25, 36)] LIGHT_LEAF | DERIVED（R-REF、minCount 確定で決まる） |
| CUT | なし（dough evidence: なし） | DERIVED（OD-W2-4） |
| cooking profile | DOUGH → SAUCE → TOPPING | DERIVED（deriveCoreSteps） |
| discovery identity | items {clam, garlic, olive-oil, parsley}、sauceBase [olive-oil]、default dimensions。exact collision 0 | 検証済み |
| expected Completion Gate | reference-accurate: FREE PASS / Order PASS。1 個ずつ: FREE PASS / Order FAILED。sauce を一点に: FAILED（INSUFFICIENT_SAUCE）。bake +15: FAILED。主役欠け: FAILED | harness 実測 |
| expected Scoring 2.0 | 正確 99.5 / good 70.6 / sauce 雑 65.2 / 配置 雑 90.5 / 1 個ずつ 65.1 / 主役欠け 45.6。類似 W1 `new-haven-apizza` と同じ曲線 | harness 実測 |
| expected ★ range | 正確 ★5、good ★3、配置 雑 ★5、1 個ずつ ★3、主役欠け ★2（→ ★2〜5） | harness 実測 |
| unlock prerequisite | key step 30（発見数 ≥ 30）: parsley | 検証済み（append） |
| new ingredient dependency | parsley | — |
| chapter | 第4章（T4） | OD-W2-2 |
| collision | exact 0 / nested: なし / 1 材料差: なし | 検証済み |
| Dinner matcher | 作ると UNIQUE_MATCH（target 外 recipe）。BAKE window 62–82、CUT なし | 影響なし（mission 定義は w1-25） |
| Lunch Rush | 発見後に pool 入り。order policy は minCount 必須、pack = 10×k で 1 pack 10 枚分 | 互換 |
| Guided | 1 category 最大 3 chip → 1 ページ。CHEESE step なし | 互換 |
| Free Cooking | FREE 判定は generic window 60–80 + 完全一致。topping tray は 5 ページ（§4） | 互換 |
| unresolved | sauce family label is ノンソース but olive-oil is a listed spread layer; represented as the olive-oil PAINT_TEMPORARY base like fugazza / new-haven (Phase-1 FULL); a drizzle reading would move it to W2-D; dough evidence absent -> no CUT under the New Haven precedent (OD-W2-4); no cheese -> no CHEESE step | — |
| description draft | 「オリーブオイルを塗った生地に、あさり、にんにく、パセリをのせて焼き上げた、チーズを使わない魚介の一枚。」 | **OWNER_REQUIRED** |

### 1.3 タルトフランベ — `flammkuchen`

| 項目 | 値 | 状態 |
|---|---|---|
| canonical recipe ID | `flammkuchen`（discovery target `flammkuchen-pizzadb`） | EVIDENCE（Phase-1 canonicalCandidateId） |
| 日本語名 | タルトフランベ（7 文字） | EVIDENCE（PIZZA DB nameJa） |
| 英語名 | Flammkuchen / Tarte flambée (informational) | runtime に英語名 field なし（情報のみ。production 不要） |
| source / evidence | https://pizzadb.jp/compare/world-pizzas/ (original Phase 0B sample batch, page 5)、comparison_table_sample、Phase-1 READY、token phase0b_sample_canonical | HIGH |
| ingredients（identity set） | bacon, fromage-blanc-sauce, onion | EVIDENCE |
| sauce / base | `fromage-blanc-sauce` ×1、PAINT (new profile) | EVIDENCE + DERIVED（R-MC） |
| cheese | なし（CHEESE step なし） | EVIDENCE |
| toppings / minCount | bacon ×3, onion ×2 | **OWNER_REQUIRED** |
| minCount の未決理由 | two co-defining toppings (bacon + onion); R-MC has one primary. Candidate bacon 3 / onion 2; alternatives 2/3 or 3/3 | **OWNER_REQUIRED** |
| bake target | 56–76（Completion Gate 許容 ±10） | **OWNER_REQUIRED**: no white-sauce analog and no catalog bakeProfile; candidate = breakfast-pizza (bacon) 56-76, alternative fugazza (onion, painted base) 63-83 |
| piece layout / reference | 5 pieces、RT-01 legacy ring: bacon [(50, 24), (73, 36), (76, 63)] HEAVY_SQUASH; onion [(58, 79), (38, 79)] HEAVY_SQUASH | DERIVED（R-REF、minCount 確定で決まる） |
| CUT | なし（dough evidence: なし） | DERIVED（OD-W2-4） |
| cooking profile | DOUGH → SAUCE → TOPPING | DERIVED（deriveCoreSteps） |
| discovery identity | items {bacon, fromage-blanc-sauce, onion}、sauceBase [fromage-blanc-sauce]、default dimensions。exact collision 0 | 検証済み |
| expected Completion Gate | reference-accurate: FREE PASS / Order PASS。1 個ずつ: FREE PASS / Order FAILED。sauce を一点に: FAILED（INSUFFICIENT_SAUCE）。bake +15: FAILED。主役欠け: FAILED | harness 実測 |
| expected Scoring 2.0 | 正確 99.5 / good 70.6 / sauce 雑 65.2 / 配置 雑 88.7 / 1 個ずつ 65 / 主役欠け 43.8。類似 W1 `breakfast-pizza / fugazza` と同じ曲線 | harness 実測 |
| expected ★ range | 正確 ★5、good ★3、配置 雑 ★4、1 個ずつ ★3、主役欠け ★2（→ ★2〜5） | harness 実測 |
| unlock prerequisite | key step 26（発見数 ≥ 26）: fromage-blanc-sauce | 検証済み（append） |
| new ingredient dependency | fromage-blanc-sauce | — |
| chapter | 第3章（T3） | OD-W2-2 |
| collision | exact 0 / nested: なし / 1 材料差: なし | 検証済み |
| Dinner matcher | 作ると UNIQUE_MATCH（target 外 recipe）。BAKE window 56–76、CUT なし | 影響なし（mission 定義は w1-25） |
| Lunch Rush | 発見後に pool 入り。order policy は minCount 必須、pack = 10×k で 1 pack 10 枚分 | 互換 |
| Guided | 1 category 最大 2 chip → 1 ページ。CHEESE step なし | 互換 |
| Free Cooking | FREE 判定は generic window 60–80 + 完全一致。topping tray は 5 ページ（§4） | 互換 |
| unresolved | first non-tomato/pesto/oil PAINT sauce: RecipeSauceProfile.ingredientId union must widen; white-on-dough visibility needs a Human Visual check (olive-oil needed a --oil class, PR #45); dough evidence absent -> no CUT (real-world flammkuchen is often rectangular; evidence is silent on shape, so round is kept); no cheese -> no CHEESE step | — |
| description draft | 「フロマージュブランを塗った生地に、ベーコンとたまねぎをのせて焼き上げた、アルザス生まれの白い一枚。」 | **OWNER_REQUIRED** |

### 1.4 ペストガンベリピザ — `pesto-gamberi`

| 項目 | 値 | 状態 |
|---|---|---|
| canonical recipe ID | `pesto-gamberi`（discovery target `pesto-gamberi-pizzadb-p11`） | EVIDENCE（Phase-1 canonicalCandidateId） |
| 日本語名 | ペストガンベリピザ（9 文字） | EVIDENCE（PIZZA DB nameJa） |
| 英語名 | Pesto Gamberi (informational) | runtime に英語名 field なし（情報のみ。production 不要） |
| source / evidence | https://pizzadb.jp/compare/world-pizzas/page/11/、comparison_table_sample、Phase-1 READY、token exact_alias | HIGH |
| ingredients（identity set） | fresh-tomato, garlic, pesto, shrimp | EVIDENCE |
| sauce / base | `pesto` ×1、PAINT | EVIDENCE + DERIVED（R-MC） |
| cheese | なし（CHEESE step なし） | EVIDENCE |
| toppings / minCount | shrimp ×3, fresh-tomato ×2, garlic ×2 | DERIVED |
| bake target | 50–70（Completion Gate 許容 ±10） | DERIVED: R-BT: runtime pesto-tonno (pesto base, seafood primary) 50-70 |
| piece layout / reference | 7 pieces、RT-01 legacy ring: shrimp [(50, 24), (73, 36), (76, 63)] HEAVY_SQUASH; fresh-tomato [(58, 79), (38, 79)] HEAVY_SQUASH; garlic [(22, 63), (25, 36)] HEAVY_SQUASH | DERIVED（R-REF、minCount 確定で決まる） |
| CUT | あり（6 slices）（dough evidence: ナポリピッツァ生地） | DERIVED（OD-W2-4） |
| cooking profile | DOUGH → SAUCE → TOPPING → CUT | DERIVED（deriveCoreSteps） |
| discovery identity | items {fresh-tomato, garlic, pesto, shrimp}、sauceBase [pesto]、default dimensions。exact collision 0 | 検証済み |
| expected Completion Gate | reference-accurate: FREE PASS / Order PASS。1 個ずつ: FREE PASS / Order FAILED。sauce を一点に: FAILED（INSUFFICIENT_SAUCE）。bake +15: FAILED。主役欠け: FAILED | harness 実測 |
| expected Scoring 2.0 | 正確 99.5 / good 70.6 / sauce 雑 65.2 / 配置 雑 90.5 / 1 個ずつ 65.1 / 主役欠け 45.6。類似 W1 `pesto-tonno` と同じ曲線 | harness 実測 |
| expected ★ range | 正確 ★5、good ★3、配置 雑 ★5、1 個ずつ ★3、主役欠け ★2（→ ★2〜5） | harness 実測 |
| unlock prerequisite | key step 28（発見数 ≥ 28）: shrimp | 検証済み（append） |
| new ingredient dependency | shrimp | — |
| chapter | 第3章（T3） | OD-W2-2 |
| collision | exact 0 / nested: なし / 1 材料差: なし | 検証済み |
| Dinner matcher | 作ると UNIQUE_MATCH（target 外 recipe）。BAKE window 50–70、CUT あり | 影響なし（mission 定義は w1-25） |
| Lunch Rush | 発見後に pool 入り。order policy は minCount 必須、pack = 10×k で 1 pack 10 枚分 | 互換 |
| Guided | 1 category 最大 3 chip → 1 ページ。CHEESE step なし | 互換 |
| Free Cooking | FREE 判定は generic window 60–80 + 完全一致。topping tray は 5 ページ（§4） | 互換 |
| unresolved | no cheese in evidence -> no CHEESE step | — |
| description draft | 「ジェノベーゼソースにエビ、トマト、にんにくを合わせた、香りの立つ魚介のペストピザ。」 | **OWNER_REQUIRED** |

### 1.5 ペストポッロピザ — `pesto-pollo`

| 項目 | 値 | 状態 |
|---|---|---|
| canonical recipe ID | `pesto-pollo`（discovery target `pesto-pollo-pizzadb-p12`） | EVIDENCE（Phase-1 canonicalCandidateId） |
| 日本語名 | ペストポッロピザ（8 文字） | EVIDENCE（PIZZA DB nameJa） |
| 英語名 | Pesto Pollo (informational) | runtime に英語名 field なし（情報のみ。production 不要） |
| source / evidence | https://pizzadb.jp/compare/world-pizzas/page/12/、comparison_table_sample、Phase-1 READY、token exact_alias | HIGH |
| ingredients（identity set） | chicken, fresh-tomato, mozzarella, pesto | EVIDENCE |
| sauce / base | `pesto` ×1、PAINT | EVIDENCE + DERIVED（R-MC） |
| cheese | mozzarella ×2 | DERIVED |
| toppings / minCount | chicken ×3, fresh-tomato ×2 | DERIVED |
| bake target | 50–70（Completion Gate 許容 ±10） | **OWNER_REQUIRED**: pesto recipes are 50-70 except pesto-patate 58-78 (dense primary); chicken has no runtime analog. Candidate 50-70 (pesto-caprese, same pesto + mozzarella + fresh-tomato) |
| piece layout / reference | 7 pieces、RT-01 legacy ring: mozzarella [(50, 24), (73, 36)] HEAVY_SQUASH; chicken [(76, 63), (58, 79), (38, 79)] HEAVY_SQUASH; fresh-tomato [(22, 63), (25, 36)] HEAVY_SQUASH | DERIVED（R-REF、minCount 確定で決まる） |
| CUT | あり（6 slices）（dough evidence: ナポリピッツァ生地） | DERIVED（OD-W2-4） |
| cooking profile | DOUGH → SAUCE → CHEESE → TOPPING → CUT | DERIVED（deriveCoreSteps） |
| discovery identity | items {chicken, fresh-tomato, mozzarella, pesto}、sauceBase [pesto]、default dimensions。exact collision 0 | 検証済み |
| expected Completion Gate | reference-accurate: FREE PASS / Order PASS。1 個ずつ: FREE PASS / Order FAILED。sauce を一点に: FAILED（INSUFFICIENT_SAUCE）。bake +15: FAILED。主役欠け: FAILED | harness 実測 |
| expected Scoring 2.0 | 正確 99.5 / good 70.6 / sauce 雑 65.2 / 配置 雑 90.2 / 1 個ずつ 65.1 / 主役欠け 45.6。類似 W1 `pesto-caprese` と同じ曲線 | harness 実測 |
| expected ★ range | 正確 ★5、good ★3、配置 雑 ★5、1 個ずつ ★3、主役欠け ★2（→ ★2〜5） | harness 実測 |
| unlock prerequisite | key step 29（発見数 ≥ 29）: chicken | 検証済み（append） |
| new ingredient dependency | chicken | — |
| chapter | 第3章（T3） | OD-W2-2 |
| collision | exact 0 / nested: なし / 1 材料差: なし | 検証済み |
| Dinner matcher | 作ると UNIQUE_MATCH（target 外 recipe）。BAKE window 50–70、CUT あり | 影響なし（mission 定義は w1-25） |
| Lunch Rush | 発見後に pool 入り。order policy は minCount 必須、pack = 10×k で 1 pack 10 枚分 | 互換 |
| Guided | 1 category 最大 2 chip → 1 ページ。 | 互換 |
| Free Cooking | FREE 判定は generic window 60–80 + 完全一致。topping tray は 5 ページ（§4） | 互換 |
| unresolved | なし | — |
| description draft | 「ジェノベーゼソースにチキン、トマト、モッツァレラを合わせた、食べごたえのあるペストピザ。」 | **OWNER_REQUIRED** |

### 1.6 ラタトゥイユピザ — `ratatouille-pizza`

| 項目 | 値 | 状態 |
|---|---|---|
| canonical recipe ID | `ratatouille-pizza`（discovery target `ratatouille-pizza-pizzadb-p13`） | EVIDENCE（Phase-1 canonicalCandidateId） |
| 日本語名 | ラタトゥイユピザ（8 文字） | EVIDENCE（PIZZA DB nameJa） |
| 英語名 | Ratatouille Pizza (informational) | runtime に英語名 field なし（情報のみ。production 不要） |
| source / evidence | https://pizzadb.jp/compare/world-pizzas/page/13/、comparison_table_sample、Phase-1 READY、token exact_alias | HIGH |
| ingredients（identity set） | bell-pepper, eggplant, oregano, tomato-sauce, zucchini | EVIDENCE |
| sauce / base | `tomato-sauce` ×1、PAINT | EVIDENCE + DERIVED（R-MC） |
| cheese | なし（CHEESE step なし） | EVIDENCE |
| toppings / minCount | eggplant ×2, zucchini ×2, bell-pepper ×2, oregano ×1 | **OWNER_REQUIRED** / DERIVED |
| minCount の未決理由 | three co-equal vegetables, no name-giving primary. Candidate 2/2/2; alternative one of them 3 | **OWNER_REQUIRED** |
| bake target | 58–78（Completion Gate 許容 ±10） | DERIVED: R-BT: runtime melanzane-pizza (tomato-sauce base, eggplant) 58-78 |
| piece layout / reference | 7 pieces、RT-01 legacy ring: eggplant [(50, 24), (73, 36)] HEAVY_SQUASH; zucchini [(76, 63), (58, 79)] HEAVY_SQUASH; bell-pepper [(38, 79), (22, 63)] HEAVY_SQUASH; oregano [(25, 36)] HEAVY_SQUASH | DERIVED（R-REF、minCount 確定で決まる） |
| CUT | あり（6 slices）（dough evidence: ナポリピッツァ生地） | DERIVED（OD-W2-4） |
| cooking profile | DOUGH → SAUCE → TOPPING → CUT | DERIVED（deriveCoreSteps） |
| discovery identity | items {bell-pepper, eggplant, oregano, tomato-sauce, zucchini}、sauceBase [tomato-sauce]、default dimensions。exact collision 0 | 検証済み |
| expected Completion Gate | reference-accurate: FREE PASS / Order PASS。1 個ずつ: FREE PASS / Order FAILED。sauce を一点に: FAILED（INSUFFICIENT_SAUCE）。bake +15: FAILED。主役欠け: FAILED | harness 実測 |
| expected Scoring 2.0 | 正確 99.5 / good 70.6 / sauce 雑 65.2 / 配置 雑 91.1 / 1 個ずつ 73.8 / 主役欠け 46.6。類似 W1 `melanzane-pizza` と同じ曲線 | harness 実測 |
| expected ★ range | 正確 ★5、good ★3、配置 雑 ★5、1 個ずつ ★3、主役欠け ★2（→ ★2〜5） | harness 実測 |
| unlock prerequisite | key step 31（発見数 ≥ 31）: bell-pepper+zucchini | 検証済み（append） |
| new ingredient dependency | bell-pepper, zucchini | — |
| chapter | 第4章（T4） | OD-W2-2 |
| collision | exact 0 / nested: なし / 1 材料差: なし | 検証済み |
| Dinner matcher | 作ると UNIQUE_MATCH（target 外 recipe）。BAKE window 58–78、CUT あり | 影響なし（mission 定義は w1-25） |
| Lunch Rush | 発見後に pool 入り。order policy は minCount 必須、pack = 10×k で 1 pack 10 枚分 | 互換 |
| Guided | 1 category 最大 4 chip → 1 ページ。CHEESE step なし | 互換 |
| Free Cooking | FREE 判定は generic window 60–80 + 完全一致。topping tray は 5 ページ（§4） | 互換 |
| unresolved | no cheese in evidence -> no CHEESE step | — |
| description draft | 「トマトソースにナス、ズッキーニ、パプリカ、オレガノを合わせた、プロヴァンス風の野菜たっぷりの一枚。」 | **OWNER_REQUIRED** |

### 1.7 ペストベジタリアーナピザ — `pesto-vegetariana`

| 項目 | 値 | 状態 |
|---|---|---|
| canonical recipe ID | `pesto-vegetariana`（discovery target `pesto-vegetariana-pizzadb-p12`） | EVIDENCE（Phase-1 canonicalCandidateId） |
| 日本語名 | ペストベジタリアーナピザ（12 文字） | EVIDENCE（PIZZA DB nameJa） |
| 英語名 | Pesto Vegetariana (informational) | runtime に英語名 field なし（情報のみ。production 不要） |
| source / evidence | https://pizzadb.jp/compare/world-pizzas/page/12/、comparison_table_sample、Phase-1 READY、token exact_alias | HIGH |
| ingredients（identity set） | bell-pepper, eggplant, mozzarella, pesto, zucchini | EVIDENCE |
| sauce / base | `pesto` ×1、PAINT | EVIDENCE + DERIVED（R-MC） |
| cheese | mozzarella ×2 | DERIVED |
| toppings / minCount | zucchini ×2, bell-pepper ×2, eggplant ×2 | **OWNER_REQUIRED** |
| minCount の未決理由 | three co-equal vegetables. Candidate 2/2/2 (8 pieces) | **OWNER_REQUIRED** |
| bake target | 50–70（Completion Gate 許容 ±10） | **OWNER_REQUIRED**: pesto 50-70 (pesto-caprese) vs 58-78 (pesto-patate, dense vegetable). Candidate 50-70 |
| piece layout / reference | 8 pieces、RT-01 legacy ring: mozzarella [(50, 24), (73, 36)] HEAVY_SQUASH; zucchini [(76, 63), (58, 79)] HEAVY_SQUASH; bell-pepper [(38, 79), (22, 63)] HEAVY_SQUASH; eggplant [(25, 36), (50, 52)] HEAVY_SQUASH | DERIVED（R-REF、minCount 確定で決まる） |
| CUT | あり（6 slices）（dough evidence: ナポリピッツァ生地） | DERIVED（OD-W2-4） |
| cooking profile | DOUGH → SAUCE → CHEESE → TOPPING → CUT | DERIVED（deriveCoreSteps） |
| discovery identity | items {bell-pepper, eggplant, mozzarella, pesto, zucchini}、sauceBase [pesto]、default dimensions。exact collision 0 | 検証済み |
| expected Completion Gate | reference-accurate: FREE PASS / Order PASS。1 個ずつ: FREE PASS / Order FAILED。sauce を一点に: FAILED（INSUFFICIENT_SAUCE）。bake +15: FAILED。主役欠け: FAILED | harness 実測 |
| expected Scoring 2.0 | 正確 99.5 / good 70.6 / sauce 雑 65.2 / 配置 雑 89.7 / 1 個ずつ 73.5 / 主役欠け 46.6。類似 W1 `pesto-caprese / pesto-patate` と同じ曲線 | harness 実測 |
| expected ★ range | 正確 ★5、good ★3、配置 雑 ★4、1 個ずつ ★3、主役欠け ★2（→ ★2〜5） | harness 実測 |
| unlock prerequisite | key step 31（発見数 ≥ 31）: bell-pepper+zucchini | 検証済み（append） |
| new ingredient dependency | bell-pepper, zucchini | — |
| chapter | 第4章（T4） | OD-W2-2 |
| collision | exact 0 / nested: なし / 1 材料差: なし | 検証済み |
| Dinner matcher | 作ると UNIQUE_MATCH（target 外 recipe）。BAKE window 50–70、CUT あり | 影響なし（mission 定義は w1-25） |
| Lunch Rush | 発見後に pool 入り。order policy は minCount 必須、pack = 10×k で 1 pack 10 枚分 | 互換 |
| Guided | 1 category 最大 3 chip → 1 ページ。 | 互換 |
| Free Cooking | FREE 判定は generic window 60–80 + 完全一致。topping tray は 5 ページ（§4） | 互換 |
| unresolved | なし | — |
| description draft | 「ジェノベーゼソースにズッキーニ、パプリカ、ナス、モッツァレラを合わせた、野菜が主役のペストピザ。」 | **OWNER_REQUIRED** |

### 1.8 プロシュットフンギ — `prosciutto-funghi`

| 項目 | 値 | 状態 |
|---|---|---|
| canonical recipe ID | `prosciutto-funghi`（discovery target `prosciutto-funghi-pizzadb-p11`） | EVIDENCE（Phase-1 canonicalCandidateId） |
| 日本語名 | プロシュットフンギ（9 文字） | EVIDENCE（PIZZA DB nameJa） |
| 英語名 | Prosciutto e Funghi (catalog nameOriginal) | runtime に英語名 field なし（情報のみ。production 不要） |
| source / evidence | https://pizzadb.jp/compare/world-pizzas/page/11/、comparison_table_sample、Phase-1 READY_WITH_REVIEW、token exact_alias | MEDIUM |
| ingredients（identity set） | mozzarella, mushroom, prosciutto-crudo, tomato-sauce | EVIDENCE |
| sauce / base | `tomato-sauce` ×1、PAINT | EVIDENCE + DERIVED（R-MC） |
| cheese | mozzarella ×2 | DERIVED |
| toppings / minCount | prosciutto-crudo ×2, mushroom ×3 | **OWNER_REQUIRED** |
| minCount の未決理由 | two name-giving toppings. Candidate: prosciutto 2 / mushroom 3 (keeps funghi's mushroom 3, so the recipe reads as funghi + prosciutto); alternative 3/2 | **OWNER_REQUIRED** |
| bake target | 58–78（Completion Gate 許容 ±10） | **OWNER_REQUIRED**: catalog funghi 58-78 (= runtime funghi) vs catalog prosciutto 55-75. Candidate 58-78 |
| piece layout / reference | 7 pieces、RT-01 legacy ring: mozzarella [(50, 24), (73, 36)] HEAVY_SQUASH; prosciutto-crudo [(76, 63), (58, 79)] HEAVY_SQUASH; mushroom [(38, 79), (22, 63), (25, 36)] HEAVY_SQUASH | DERIVED（R-REF、minCount 確定で決まる） |
| CUT | あり（6 slices）（dough evidence: ナポリピッツァ生地） | DERIVED（OD-W2-4） |
| cooking profile | DOUGH → SAUCE → CHEESE → TOPPING → CUT | DERIVED（deriveCoreSteps） |
| discovery identity | items {mozzarella, mushroom, prosciutto-crudo, tomato-sauce}、sauceBase [tomato-sauce]、default dimensions。exact collision 0 | 検証済み |
| expected Completion Gate | reference-accurate: FREE PASS / Order PASS。1 個ずつ: FREE PASS / Order FAILED。sauce を一点に: FAILED（INSUFFICIENT_SAUCE）。bake +15: FAILED。主役欠け: FAILED | harness 実測 |
| expected Scoring 2.0 | 正確 99.5 / good 70.6 / sauce 雑 65.2 / 配置 雑 89.6 / 1 個ずつ 65.1 / 主役欠け 45.6。類似 W1 `funghi` と同じ曲線 | harness 実測 |
| expected ★ range | 正確 ★5、good ★3、配置 雑 ★4、1 個ずつ ★3、主役欠け ★2（→ ★2〜5） | harness 実測 |
| unlock prerequisite | key step 25（発見数 ≥ 25）: prosciutto-crudo | 検証済み（append） |
| new ingredient dependency | prosciutto-crudo | — |
| chapter | 第3章（T3） | OD-W2-2 |
| collision | exact 0 / nested: funghi ⊂ prosciutto-funghi / 1 材料差: funghi | 検証済み |
| Dinner matcher | 作ると UNIQUE_MATCH（target 外 recipe）。BAKE window 58–78、CUT あり | 影響なし（mission 定義は w1-25） |
| Lunch Rush | 発見後に pool 入り。order policy は minCount 必須、pack = 10×k で 1 pack 10 枚分 | 互換 |
| Guided | 1 category 最大 2 chip → 1 ページ。 | 互換 |
| Free Cooking | FREE 判定は generic window 60–80 + 完全一致。topping tray は 5 ページ（§4） | 互換 |
| unresolved | SAME_INGREDIENT_SET_AS_CATALOG_RECIPE prosciutto-e-funghi (catalog-only, not runtime): naming decision; prosciutto-crudo is post-bake in catalog finishing tags; this row has no REQUIRED late-addition evidence, so it is placed pre-bake (OD-TAX-6: timing is not identity); one ingredient from runtime funghi (near-miss ADD_ONE / REMOVE_ONE neighbour) | — |
| description draft | 「トマトソースとモッツァレラに、生ハムとマッシュルームを合わせた、イタリア定番の組み合わせの一枚。」 | **OWNER_REQUIRED** |

### 1.9 ハモンセラーノピザ — `jamon-serrano-pizza`

| 項目 | 値 | 状態 |
|---|---|---|
| canonical recipe ID | `jamon-serrano-pizza`（discovery target `jamon-serrano-pizza-pizzadb-p7`） | EVIDENCE（Phase-1 canonicalCandidateId） |
| 日本語名 | ハモンセラーノピザ（9 文字） | EVIDENCE（PIZZA DB nameJa） |
| 英語名 | Jamón Serrano Pizza (informational) | runtime に英語名 field なし（情報のみ。production 不要） |
| source / evidence | https://pizzadb.jp/compare/world-pizzas/page/7/、comparison_table_sample、Phase-1 READY、token exact_alias | HIGH |
| ingredients（identity set） | arugula, mozzarella, prosciutto-crudo, tomato-sauce | EVIDENCE |
| sauce / base | `tomato-sauce` ×1、PAINT | EVIDENCE + DERIVED（R-MC） |
| cheese | mozzarella ×2 | DERIVED |
| toppings / minCount | prosciutto-crudo ×3, arugula ×2 | DERIVED |
| bake target | 55–75（Completion Gate 許容 ±10） | DERIVED: R-BT: catalog 'prosciutto' (crudo e rucola: tomato, mozzarella, prosciutto-crudo, arugula, parmigiano) bakeProfile 55-75 |
| piece layout / reference | 7 pieces、RT-01 legacy ring: mozzarella [(50, 24), (73, 36)] HEAVY_SQUASH; prosciutto-crudo [(76, 63), (58, 79), (38, 79)] HEAVY_SQUASH; arugula [(22, 63), (25, 36)] LIGHT_LEAF | DERIVED（R-REF、minCount 確定で決まる） |
| CUT | あり（6 slices）（dough evidence: 薄めの生地） | DERIVED（OD-W2-4） |
| cooking profile | DOUGH → SAUCE → CHEESE → TOPPING → CUT | DERIVED（deriveCoreSteps） |
| discovery identity | items {arugula, mozzarella, prosciutto-crudo, tomato-sauce}、sauceBase [tomato-sauce]、default dimensions。exact collision 0 | 検証済み |
| expected Completion Gate | reference-accurate: FREE PASS / Order PASS。1 個ずつ: FREE PASS / Order FAILED。sauce を一点に: FAILED（INSUFFICIENT_SAUCE）。bake +15: FAILED。主役欠け: FAILED | harness 実測 |
| expected Scoring 2.0 | 正確 99.5 / good 70.6 / sauce 雑 65.2 / 配置 雑 90.2 / 1 個ずつ 65.1 / 主役欠け 45.6。類似 W1 `hawaiian (structure)` と同じ曲線 | harness 実測 |
| expected ★ range | 正確 ★5、good ★3、配置 雑 ★5、1 個ずつ ★3、主役欠け ★2（→ ★2〜5） | harness 実測 |
| unlock prerequisite | key step 27（発見数 ≥ 27）: arugula | 検証済み（append） |
| new ingredient dependency | arugula, prosciutto-crudo | — |
| chapter | 第3章（T3） | OD-W2-2 |
| collision | exact 0 / nested: なし / 1 材料差: なし | 検証済み |
| Dinner matcher | 作ると UNIQUE_MATCH（target 外 recipe）。BAKE window 55–75、CUT あり | 影響なし（mission 定義は w1-25） |
| Lunch Rush | 発見後に pool 入り。order policy は minCount 必須、pack = 10×k で 1 pack 10 枚分 | 互換 |
| Guided | 1 category 最大 2 chip → 1 ページ。 | 互換 |
| Free Cooking | FREE 判定は generic window 60–80 + 完全一致。topping tray は 5 ページ（§4） | 互換 |
| unresolved | reserves the P0-COLL-4 pair: pinsa-romana can later ship only with DOUGH_VARIANT; arugula / prosciutto-crudo are post-bake in catalog finishing tags; no REQUIRED evidence here -> pre-bake | — |
| description draft | 「トマトソースとモッツァレラに、生ハムとルッコラを合わせた、スペイン風のシンプルな一枚。」 | **OWNER_REQUIRED** |

## 2. 8 ingredients

| canonical ID | 日本語名 | 英語名 | type | taxonomy | visual（emoji 候補 / 衝突 / 専用 visual） | shop | unlock step | buy / refill | unit | starter | Hint/DH4 | Large Catalog |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `prosciutto-crudo` | 生ハム | Prosciutto crudo | topping / scatter | meat / meat.cured | U+1F953 (collides with bacon)、**衝突: bacon**、**専用 visual 必要** | step 到達で NEW、初回パック購入 | 25 | 100 / 50（T3） | piece (scatter, k = max minCount) | いいえ（starter は tomato-sauce/mozzarella/basil のみ） | family meat（k≥2 guard 対象） | topping 29 個目までに入る（append なら 4–5 ページ目） |
| `fromage-blanc-sauce` | フロマージュブラン | Fromage blanc | sauce / spread | category: sauce / sauce.cream-dairy | U+1F95B (chip only; sauce is drawn by colour) | step 到達で NEW、初回パック購入 | 26 | 100 / 50（T3） | use (spread, k=1) | いいえ（starter は tomato-sauce/mozzarella/basil のみ） | sauce: DH4 は category レベル | SAUCE tab 4 個（1 ページ） |
| `arugula` | ルッコラ | Arugula | topping / scatter | vegetable / vegetable.leafy | U+1F96C | step 到達で NEW、初回パック購入 | 27 | 100 / 50（T3） | piece (scatter, k = max minCount) | いいえ（starter は tomato-sauce/mozzarella/basil のみ） | family vegetable（k≥2 guard 対象） | topping 29 個目までに入る（append なら 4–5 ページ目） |
| `shrimp` | エビ | Shrimp | topping / scatter | seafood / seafood.shellfish | U+1F990 | step 到達で NEW、初回パック購入 | 28 | 100 / 50（T3） | piece (scatter, k = max minCount) | いいえ（starter は tomato-sauce/mozzarella/basil のみ） | family seafood（k≥2 guard 対象） | topping 29 個目までに入る（append なら 4–5 ページ目） |
| `chicken` | チキン | Chicken | topping / scatter | meat / meat.poultry | U+1F357 | step 到達で NEW、初回パック購入 | 29 | 100 / 50（T3） | piece (scatter, k = max minCount) | いいえ（starter は tomato-sauce/mozzarella/basil のみ） | family meat（k≥2 guard 対象） | topping 29 個目までに入る（append なら 4–5 ページ目） |
| `parsley` | パセリ | Parsley | topping / scatter | herb / herb.leaf | U+1F33F (collides with basil and pesto)、**衝突: basil, pesto**、**専用 visual 必要** | step 到達で NEW、初回パック購入 | 30 | 120 / 60（T4） | piece (scatter, k = max minCount) | いいえ（starter は tomato-sauce/mozzarella/basil のみ） | family herb（k≥2 guard 対象） | topping 29 個目までに入る（append なら 4–5 ページ目） |
| `bell-pepper` | パプリカ | Bell pepper | topping / scatter | vegetable / vegetable.fruiting | U+1FAD1 | step 到達で NEW、初回パック購入 | 31 | 120 / 60（T4） | piece (scatter, k = max minCount) | いいえ（starter は tomato-sauce/mozzarella/basil のみ） | family vegetable（k≥2 guard 対象） | topping 29 個目までに入る（append なら 4–5 ページ目） |
| `zucchini` | ズッキーニ | Zucchini | topping / scatter | vegetable / vegetable.fruiting | U+1F952 (cucumber glyph as zucchini, like eggplant/potato whole glyphs in W1) | step 到達で NEW、初回パック購入 | 31 | 120 / 60（T4） | piece (scatter, k = max minCount) | いいえ（starter は tomato-sauce/mozzarella/basil のみ） | family vegetable（k≥2 guard 対象） | topping 29 個目までに入る（append なら 4–5 ページ目） |

### 2.1 taxonomy の Fresh 確認（OD-W2-5）

PR #255 の JSON（head `e221e36`）: arugula `vegetable.leafy`、bell-pepper / zucchini `vegetable.fruiting`、chicken `meat.poultry`、prosciutto-crudo `meat.cured`、shrimp `seafood.shellfish`、parsley `herb.leaf` — 7 件とも `PROPOSED`・confidence high・DH4-1 の family id と一致。fromage-blanc-sauce は `sauce.cream-dairy`（sauce は DH4-1 の方針で family 行なし）。
DH4-2（main）は「DH4-1 の既存行を変えない」「Human Classification Gate（OD-TAX-7）は残す」。W2-A の 7 行は **この scoped 判断（OD-W2-5）で production 化してよい**、矛盾なし。追加後の family サイズ: vegetable 8→11、meat 4→6、seafood 3→4、herb 4→5（fruit / spice / other は変化なし）。k≥2 guard は強くなる方向。

### 2.2 asset gate

runtime の材料 visual は「emoji + color」が基本で、W1 の capers / clam / fresh-tomato だけ `IngredientGlyph.tsx` の専用 SVG（`pieceVisual`）。外部画像 asset はない。

| 材料 | 今ある asset | 不足 | 分類 |
|---|---|---|---|
| prosciutto-crudo | なし | 🥓 は bacon と同じ、🍖 は ham と同じ → **専用 `pieceVisual` が必要**（または衝突を Owner が許容） | Owner 判断 + UI 実装（外部 asset 待ちではない） |
| parsley | なし | 🌿 は basil・pesto、🍃 は oregano、🌱 は rosemary → **専用 `pieceVisual` が必要**（または許容） | 同上 |
| arugula | なし | 🥬 は未使用 | Human Visual のみ |
| shrimp | なし | 🦐 は未使用 | Human Visual のみ |
| chicken | なし | 🍗 は未使用 | Human Visual のみ |
| bell-pepper | なし | 🫑 は未使用（Unicode 13。🫒 olive-oil と同世代なので表示可） | Human Visual のみ |
| zucchini | なし | 🥒（きゅうり glyph で代用。W1 の eggplant / potato と同じ扱い） | Human Visual のみ |
| fromage-blanc-sauce | なし | chip は 🥛、塗りは color（§3） | Human Visual（§3） |

**blocker 分類**: どれも外部 asset 待ちではない（C ではない）。材料データ（W2-A1）は emoji fallback で実装できるが、OD-W2-6 により「未確定の art を production に入れない」ので、**emoji 承認と 2 件の専用 visual の方針は実装前の Owner 決定**（§12 A6）。

## 3. 白ソース（フロマージュブラン）の視認性 — prototype 実測

方法: probe が本物の Free Cooking で本物の塗り gesture（4 リング）を使い、塗る前後の生地を同じ位置で撮影し、中心円（半径 28%）の各 pixel の CIE76 ΔE と輝度コントラストを出した。基準は出荷済み（Human Feel 通過済み）の tomato / pesto / olive-oil。

| 候補 | 色 | CSS（prototype のみ） | 390x844 | 360x800 | 390x664 | 360x640 |
|---|---|---|---|---|---|---|
| B-tomato (shipped) | — | — | ΔE 51.5 / 100% / 2.63 | ΔE 51.5 / 100% / 2.62 | ΔE 51.5 / 100% / 2.62 | ΔE 51.5 / 100% / 2.62 |
| B-pesto (shipped) | — | — | ΔE 32.4 / 100% / 2 | ΔE 32.4 / 100% / 2 | ΔE 32.4 / 100% / 2 | ΔE 32.4 / 100% / 2 |
| B-olive-oil (shipped) | — | — | ΔE 23.5 / 100% / 1.04 | ΔE 23.5 / 100% / 1.04 | ΔE 23.5 / 100% / 1.04 | ΔE 23.5 / 100% / 1.04 |
| W0-plain | #f4efe4 | — | ΔE 22.5 / 100% / 1.24 | ΔE 22.5 / 100% / 1.24 | ΔE 22.5 / 100% / 1.24 | ΔE 22.5 / 100% / 1.24 |
| W1-bright | #fffdf7 | — | ΔE 26.1 / 100% / 1.36 | ΔE 26.1 / 100% / 1.36 | ΔE 26.1 / 100% / 1.36 | ΔE 26.1 / 100% / 1.36 |
| W2-cool-tint | #eef1f4 | — | ΔE 28.4 / 100% / 1.25 | ΔE 28.3 / 100% / 1.25 | ΔE 28.3 / 100% / 1.25 | ΔE 28.3 / 100% / 1.25 |
| W3-outline | #f7f3ea | `blur(3px) contrast(1.15) drop-shadow(0 0 1.5px rgba(120, 86, 44, 0.75)) drop-shadow(0 0 3px rgba(120, 86, 44, 0.35))` | ΔE 25.4 / 100% / 1.16 | ΔE 25.4 / 100% / 1.16 | ΔE 25.4 / 100% / 1.16 | ΔE 25.4 / 100% / 1.16 |
| W4-outline-opaque | #fbf8f1 | `blur(2px) contrast(1.35) brightness(1.04) drop-shadow(0 0 1px rgba(110, 78, 40, 0.9)) drop-shadow(0 1px 2px rgba(110, 78, 40, 0.45))` | ΔE 27.5 / 100% / 1.12 | ΔE 27.5 / 100% / 1.12 | ΔE 27.4 / 100% / 1.12 | ΔE 27.4 / 100% / 1.12 |

（ΔE 平均 / ΔE > 10 の pixel 率 / 輝度コントラスト比。4 viewport で同値なのは、dough element 内の比率で測っているため。）

所見:
- **白系はどの候補でも出荷済み olive-oil（ΔE 23.5）と同等以上に見える。** W0（実物に近い #f4efe4）でも ΔE 22.5、輝度コントラストは olive-oil（1.04）より高い 1.24。「見えない」ことはない。
- ただし見え方は「生地が明るくなった」で、塗った感が弱い（`sauce_W0-plain_prepare_*.png`）。RESULT（焼成後）も同様に淡い円（`sauce_*_result_*.png`）。
- **CSS なしで最も差が大きいのは W2 cool tint（#eef1f4、ΔE 28.3）**。データ（color）だけで済み、production CSS 変更が不要。
- outline 系（W3/W4）は縁が締まって「塗った範囲」は分かりやすいが、灰色っぽく汚れて見える（`sauce_W4-outline-opaque_prepare_390x844.png`）。CSS modifier（olive-oil の `--oil` と同型）が必要。
- texture は canvas 描画の変更になるので今回は測っていない（候補として残す）。

**推奨: W2 cool tint を第一候補（data のみ）、W3 outline を fallback（CSS modifier 1 個）。** 決定は Human Visual（390×844 実機）で Owner（§12 A5）。production CSS は変えていない。

## 4. W2-A 後の tray 実測（Free Cooking / Dinner）

所持: runtime 29 + W2-A 8 = 37（topping 29）。probe で 8 材料を INGREDIENTS に注入し、本物の画面で測った。「append」= 新材料を INGREDIENTS 末尾（W1 と同じ追加方法）、「prepend」= 先頭。

| mode / 並び | viewport | topping pager | 新材料までの tap（最初 / 最後） | stage 高 | dough 径 | 横 overflow | 縦 scroll |
|---|---|---|---|---|---|---|---|
| dinner / append | 360x640 | 1 / 5 | 3 / 4 | 249 | 241 | なし | なし |
| dinner / append | 360x800 | 1 / 5 | 3 / 4 | 388 | 274 | なし | なし |
| dinner / append | 390x664 | 1 / 5 | 3 / 4 | 273 | 265 | なし | なし |
| dinner / append | 390x844 | 1 / 5 | 3 / 4 | 432 | 290 | なし | なし |
| dinner / prepend | 360x640 | 1 / 5 | 0 / 1 | 249 | 241 | なし | なし |
| dinner / prepend | 360x800 | 1 / 5 | 0 / 1 | 388 | 274 | なし | なし |
| dinner / prepend | 390x664 | 1 / 5 | 0 / 1 | 273 | 265 | なし | なし |
| dinner / prepend | 390x844 | 1 / 5 | 0 / 1 | 432 | 290 | なし | なし |
| free / append | 360x640 | 1 / 5 | 3 / 4 | 253 | 245 | なし | なし |
| free / append | 360x800 | 1 / 5 | 3 / 4 | 401 | 274 | なし | なし |
| free / append | 390x664 | 1 / 5 | 3 / 4 | 277 | 269 | なし | なし |
| free / append | 390x844 | 1 / 5 | 3 / 4 | 445 | 290 | なし | なし |
| free / prepend | 360x640 | 1 / 5 | 0 / 1 | 253 | 245 | なし | なし |
| free / prepend | 360x800 | 1 / 5 | 0 / 1 | 401 | 274 | なし | なし |
| free / prepend | 390x664 | 1 / 5 | 0 / 1 | 277 | 269 | なし | なし |
| free / prepend | 390x844 | 1 / 5 | 0 / 1 | 445 | 290 | なし | なし |

- **4 viewport すべてで横 overflow なし、縦 scroll なし。stage・dough の大きさはページ送りの前後で変わらない**（dock が 2 行 + pager で固定）。
- ステージ高・dough 径は Large Catalog UX の現行 UI 実測（29 材料所持、360×640 stage 253px）と同じ → W2-A で縮まない。
- topping は **5 ページ**（今 4）。append だと新材料の最初（生ハム）まで **3 tap**、全部まで 4 tap。prepend なら 0 tap / 1 tap。
- 360×640（最小）: Free stage 253 / dough 245、Dinner stage 249 / dough 241（Dinner は target 行の分だけ小さい。dock の高さは材料数に依存しない構造なので W2-A 前と同じ）。

**再判定: LC-2 / LC-3 を W2-A の blocker へ昇格する必要はない。** 壊れるものはなく、コストは「ページ送り 1 枚分」だけ。Large Catalog UX の Fresh Design が目安にした「topping > 24」を超えるが、それは探索コストの目安で、レイアウトの破綻点ではない（実測で確認）。Wave 3 前に LC を入れる Owner 方針（OD-W2-LC）で足りる。
軽い緩和策（Owner 判断、§12 A7）: 新材料を topping の先頭側に並べる（データ順だけ、tap 3→0）。代わりに既存材料の位置がずれる。

## 5. Discovery collision（34 recipe 全組み合わせ）

| 種類 | W1 25 のみ | W2-A 後 34 | W2-A を含む組 |
|---|---|---|---|
| exact identity（= matcher collision） | 0 | **0** | 0 |
| nested identity（完全な部分集合） | 8 | 9 | **1: funghi ⊂ prosciutto-funghi** |
| 1 材料差（near-miss d=1） | 3 | 4 | **1: funghi ↔ prosciutto-funghi** |
| d = 2 | 13 | 16 | 3 |

### 5.1 funghi ↔ prosciutto-funghi のテスト設計（W2-A2 で追加する test）

| # | 盛り付け（tomato-sauce + mozzarella は共通） | 期待 |
|---|---|---|
| T-1 | mushroom | `UNIQUE_MATCH` funghi |
| T-2 | mushroom + prosciutto-crudo | `UNIQUE_MATCH` prosciutto-funghi（funghi ではない。部分集合で誤発見しない） |
| T-3 | prosciutto-crudo のみ | `NO_MATCH`（ORIGINAL）。near-miss: prosciutto-funghi が DISCOVERABLE なら ADD_ONE（d=1）、funghi とは d=2 |
| T-4 | mushroom + prosciutto-crudo + basil | `NO_MATCH`（superset は original）。near-miss REMOVE_ONE（prosciutto-funghi に対して d=1） |
| T-5 | T-2 を funghi が未発見・prosciutto-funghi が発見済みで | near-miss は DISCOVERABLE だけを見るので funghi に対して REMOVE_ONE（d=1）、名前は出ない |
| T-6 | T-1 を prosciutto-funghi が DISCOVERABLE の時 | funghi に UNIQUE_MATCH（d=0 が常に優先。`classifyNearMiss` は null） |
| T-7 | Dinner round で T-2 | Stage A で prosciutto-funghi の BAKE window・CUT を採用、target 外として判定 |
| T-8 | pin | 34 recipe の exact identity 一意性（既存 `discoveryCatalog.test.ts` の一意性 test が 34 で通る） |

## 6. Progression

- **W1 step 1〜24 の byte parity**: `W1_25_DISCOVERY_LADDER` を parse して正規化 JSON の sha256 = `0e8f352b9adb74a5d5e64dde7594da75cd949b0fa95d587e91d8c3eb72b7d58f`。REC-04 rule の再導出と一致、append 後の先頭 24 step と一致（semantic parity: 同じ材料・同じ key recipe・同じ番号）。実装時の test はこの fixture を固定値として pin し、「rule(RECIPES 全体) = DISCOVERY_LADDER」の pin は「W1 fixture + rule(delta)」に置き換える。

| step | unlock | 必要発見数 | 価格（pack / refill） | 章 | 新たに作れる recipe |
|---|---|---|---|---|---|
| 25 | prosciutto-crudo | 25 | 100 / 50（T3） | 第3章 | prosciutto-funghi |
| 26 | fromage-blanc-sauce | 26 | 100 / 50（T3） | 第3章 | flammkuchen |
| 27 | arugula | 27 | 100 / 50（T3） | 第3章 | jamon-serrano-pizza |
| 28 | shrimp | 28 | 100 / 50（T3） | 第3章 | pesto-gamberi |
| 29 | chicken | 29 | 100 / 50（T3） | 第3章 | pesto-pollo |
| 30 | parsley | 30 | 120 / 60（T4） | 第4章 | vongole |
| 31 | bell-pepper, zucchini | 31 | 120 / 60（T4） | 第4章 | pesto-vegetariana, ratatouille-pizza |

- **softlock / unreachable（0〜34 発見の全状態）**: 発見数 c ごとに「starter + step ≤ c の材料で作れる recipe 数 ≥ c + 1」を確認（どの発見順でも次が必ずある条件）。c = 0〜33 で成立（slack ≥ 0）、c = 34 で全 34 発見。**softlock 0、unreachable 0**。`deadlockCurve` に全状態を出力。
- 既存 save の次 unlock: 発見数 0〜23 は W1 と同じ step、24 以上で初めて step 25 以降（`existingSaveNextUnlock`）。
- ブラジリアン・カラブレーザは自前 step なし（key step 12 = onion）。W1 途中で発見されると W1 の各 step に 1 発見早く届く（順番は不変）。

## 7. Save compatibility

実測（harness が本番の `loadSave` / `persistDex` / `resolveShopEntitlement` を実行）:

| save | 発見数 | W1 部分の entitlement | W2-A 後に増える entitlement | 今の build で読み込み | 書き込み後の未知 id |
|---|---|---|---|---|---|
| Dex 0 | 0 | 不変（0） | なし | schemaVersion 2 | — |
| W1 途中 | 10 | 不変（10） | なし | 2 | — |
| W1 完了 | 25 | 不変（26 材料） | prosciutto-crudo（step 25） | 2 | — |
| 未来 id 保持（W1 完了 + W2-A 3 件発見・W2-A 材料所持） | 28 | 不変 | step 25–28 の 4 材料 | 2（既知 Dex 25 件） | **Dex・所持とも保持**（P3-4B forward-compat） |

- ladder・章・価格は保存しない（発見数から毎回導く）ので、append は migration 不要。
- **schemaVersion は上げない**（上げると旧 build が save を既定値扱いにして上書きする。P3-4B の既存 authority「Progression 2.0 は schemaVersion を上げない」）。
- W2-A を revert しても、W2-A で発見・購入した id は forward-compat extras として保持され、再 merge で復活する。

## 8. Scoring / Completion Gate の校正

harness が本番の `computeScoringV2` / `toLegacyScoreBreakdown` / `evaluatePizzaCompletion` を、候補値で作った reference に対して実行した（`TETO_WAVE2_W2A_CALIBRATION.json`）。同じ 11 通りの操作を W1 の類似 recipe（本物の reference）にも適用して比較。

| recipe | 正確 | good | sauce 一点 | 配置 雑 | 1 個ずつ | +2 主役 | bake 端+4 | bake +15 | bake −15 | 主役欠け | sauce なし |
|---|---|---|---|---|---|---|---|---|---|---|---|
| brazilian-calabresa | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★4 | 65 ★3 | 88 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 47 ★2 ✗ | 46 ★2 ✗ |
| vongole | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★5 | 65 ★3 | 87 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 46 ★2 ✗ | 45 ★2 ✗ |
| flammkuchen | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 89 ★4 | 65 ★3 | 86 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 44 ★2 ✗ | 44 ★2 ✗ |
| pesto-gamberi | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★5 | 65 ★3 | 87 ★4 | 98 ★4 | 94 ★4 ✗ | 94 ★4 ✗ | 46 ★2 ✗ | 45 ★2 ✗ |
| pesto-pollo | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★5 | 65 ★3 | 87 ★4 | 98 ★4 | 94 ★4 ✗ | 94 ★4 ✗ | 46 ★2 ✗ | 45 ★2 ✗ |
| ratatouille-pizza | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 91 ★5 | 74 ★3 | 82 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 47 ★2 ✗ | 46 ★2 ✗ |
| pesto-vegetariana | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★4 | 74 ★3 | 82 ★4 | 98 ★4 | 94 ★4 ✗ | 94 ★4 ✗ | 47 ★2 ✗ | 46 ★2 ✗ |
| prosciutto-funghi | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★4 | 65 ★3 | 87 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 46 ★2 ✗ | 45 ★2 ✗ |
| jamon-serrano-pizza | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★5 | 65 ★3 | 87 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 46 ★2 ✗ | 45 ★2 ✗ |
| （W1）salsiccia | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★4 | 65 ★3 | 86 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 44 ★2 ✗ | 44 ★2 ✗ |
| （W1）new-haven-apizza | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★5 | 65 ★3 | 87 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 46 ★2 ✗ | 45 ★2 ✗ |
| （W1）breakfast-pizza | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 89 ★4 | 66 ★3 | 87 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 46 ★2 ✗ | 45 ★2 ✗ |
| （W1）pesto-tonno | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★5 | 65 ★3 | 87 ★4 | 98 ★4 | 94 ★4 ✗ | 94 ★4 ✗ | 46 ★2 ✗ | 45 ★2 ✗ |
| （W1）pesto-caprese | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★5 | 65 ★3 | 87 ★4 | 98 ★4 | 94 ★4 ✗ | 94 ★4 ✗ | 46 ★2 ✗ | 45 ★2 ✗ |
| （W1）melanzane-pizza | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★5 | 65 ★3 | 87 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 46 ★2 ✗ | 45 ★2 ✗ |
| （W1）funghi | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 89 ★4 | 65 ★3 | 86 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 44 ★2 ✗ | 44 ★2 ✗ |
| （W1）hawaiian | 100 ★5 | 71 ★3 | 65 ★3 ✗ | 90 ★4 | 65 ★3 | 87 ★4 | 98 ★4 | 95 ★4 ✗ | 95 ★4 ✗ | 46 ★2 ✗ | 45 ★2 ✗ |

（✗ = Completion Gate FAILED（FREE / recipe policy）。「1 個ずつ」は FREE では PASS、Lunch Rush（order policy = minCount 必須）では FAILED。）

- **reference 通りの操作は 9 件とも Completion PASS（FREE / Order とも）・★5・約 99.5 点。**
- careless との差: sauce を一点に落とす → INSUFFICIENT_SAUCE で FAILED、配置を片寄せ → 90 前後、1 個ずつ → 65〜74、主役欠け → FAILED・★2、bake ±15 → FAILED。
- W2-A 候補の曲線は **W1 類似 recipe と一致**（同じ Scoring 2.0 authority・同じ RT-01 配置・同じ sauce reference）。W2-A 専用の新しい scoring 値は作っていない → 「既存 authority から説明できる値だけ」の条件を満たす。
- ratatouille / pesto-vegetariana の 2/2/2 案は「1 個ずつ」でも 74（他は 65）: 3 個の主役がいないため。minCount 決定（A1）の判断材料。
- 既存の性質（W1 と同じ、W2-A 固有ではない）: 配置を片寄せても 90 点前後で ★5 に届く recipe がある（Pieces weight 16）。bake を大きく外すと Completion は FAILED だが点数は 94〜95 のまま（FAILED なので score は付かない）。
- **CUT boundary**: `computeScoringV2` は CUT を読まない（`scoringV2/index.ts` に cut の参照なし）。CUT は POST_BAKE の別評価で、★・Completion に影響しない。CUT の有無（7 あり / 2 なし）は scoring を変えない。Issue #256（焼成失敗でも CUT）は既存挙動としてそのまま。
- **quantity**: 主役 +2 は 86〜88（★4）、1 個ずつは FREE PASS / Order FAILED — W1 と同じ。

## 9. 実装 slice 設計（実装はしない）

制約: main への merge は即公開（`deploy.yml`）。gameplay 変更は Human Verification が DoD（`TETO_HUMAN-VERIFICATION-POLICY.md`）。`discoveryLadder.test.ts` は「ladder = rule(RECIPES)」を pin しているので、recipe 追加と ladder の append は同じ slice に入れないと test が壊れる。

| slice | 内容 | files | tests | 依存 | revert | save | mobile gate |
|---|---|---|---|---|---|---|---|
| **W2-A0** Authoring / Authority | 本 gate + §12 の Owner 回答を `w2a_authoring_candidates.json` に反映し、全値を DERIVED / APPROVED にする | docs / tools のみ | `progression2_wave2_w2a_gate.py --check`、harness 21/21 | Owner 回答 | 容易 | なし | なし |
| **W2-A1** 材料データ + visual（まだ入手不可） | 8 材料行（emoji / color / landing / roast 耐性）、専用 `pieceVisual` 2 件（生ハム・パセリ、A6 次第）、taxonomy 7 行、`RecipeSauceProfile.ingredientId` union に fromage-blanc-sauce、白ソースの色（A5） | `src/data/ingredients.ts`、`ingredientTaxonomy.ts`、`recipeSauceProfiles.ts`（型のみ）、`components/IngredientGlyph.tsx`（専用 visual の場合） | `ingredients.test`、taxonomy coverage、DH4-1/DH4-2 audit（k≥2・partition guard 0 leak を再実行）、materialOffer が null（k = 0 で Shop に出ない）を pin | A0 | 容易（どの recipe も使っていない） | なし（forward-compat 済み） | 材料 visual の Human Visual Gate（W1 I5a と同型、静止画）。材料は入手不可なのでプレイには出ない |
| **W2-A2** レシピ + ladder append（公開される slice） | 9 recipe、9 reference（RT-01 literal + parity test）、9 sauce profile、CUT allowlist 7、discovery target id 9、ladder を「W1 固定 fixture + step 25〜31」に、`populationId` `w2a-34` | `recipes.ts`、`referencePizza.ts`、`recipeSauceProfiles.ts`、`cookingProfiles.ts`、`discoveryCatalog.ts`、`discoveryLadder.ts` + test、e2e の 25 固定 9 spec（Dex pill `/25` 7 spec、LC-5 と RT-01 harness の `toHaveCount(25)`） | recipes / reference parity / discoveryCatalog 一意性 / ladder（W1 sha pin + append）/ materialShop / recipeChapters / Dinner validator / §5.1 T-1〜T-8 / deadlock・unreachable / e2e 全体 + Layout Contract 7 profile + WebKit | A1 | 1 PR revert で戻る（未知 id は save に保持） | 追加のみ、schema 変更なし | **HV 必須**: 390×844 動画（W2-A recipe の発見・Shop NEW・白ソース・CUT なし 2 件・tray 5 ページ）、360×800 / 390×664 / 360×640 の screenshot |
| W2-A3（任意）tray 並び | 新材料を先頭側に（A7 で採用した場合のみ） | `ingredients.ts` の順序 | tray paging test、Layout Contract | A2 と同時でも可 | 容易 | なし | Free / Dinner tray の HV |

Large Catalog UX（LC-1〜3）とは独立。LC が先に入っても W2-A の data はそのまま使える（LC は表示層だけ）。

## 10. 既存 tool drift（W2-A とは分離）

| tool | clean main（`7bb0116`）で `--check` | 原因 | 既存 Issue |
|---|---|---|---|
| `progression2_mechanic_matrix.py` | 失敗（JSON が再生成と違う） | src を読む field（`shippedRecipeIdsInSrc`、`newContentIngredientIds`、`ingredientIdsNotYetInShippedGame`）。分類は不変 | **#260（OPEN、Owner 作成）が該当** → 新規 Issue は不要 |
| `progression2_phase2_progression.py` | 失敗（W1 10 recipe を `shipped:<id>` と PIZZA DB 行の両方にして collision を 10 件誤報、JSON / MD drift） | 同じ種類（src を読む） | **#260 に含まれていない** |

duplicate gate: issue 検索で #260 と closed #188 のみ、PR 検索 0 件。**修正も Issue 作成もしていない。** 提案: phase2 tool 分を #260 に追記する（コメント案）:

> 同じ原因の drift が `tools/progression2_phase2_progression.py --check` にもある（clean main `7bb0116`）。W1 I5b-3 以降、W1 の 10 recipe が src 由来の `shipped:<id>` target と PIZZA DB evidence target の両方になり、「SHIPPED_KEEP: runtime signature collisions」10 件（bambino, hawaiian, melanzane-pizza, new-haven-apizza, parmigiana-pizza, pesto-caprese, pesto-patate, pesto-tonno, pizza-portuguesa, puttanesca-pizza）と JSON / `TETO_PROGRESSION2_PHASE2_UNLOCK-GRAPH.md` の drift を報告する。W2-A（9 recipe）を入れると同じ形で 9 件増える。#260 の (b)（src 由来 field の分離）で両 tool をまとめて直すのがよい。W2-A 実装には混ぜない。

## 11. W2-A 実装で追加 / 更新が必要な test（まとめ）

- ladder: W1 fixture の sha pin、append 7 step、次 unlock 不変（発見数 0〜25）、softlock / unreachable（0〜34）。
- discovery: 34 件の exact identity 一意性、§5.1 T-1〜T-8。
- reference: 9 件の RT-01 literal = generator 出力（`referencePizza.w1.test.ts` と同型）。
- scoring / completion: 9 件の Golden（perfect > good > poor > empty）と Completion PASS（harness の V0〜V10 を unit test 化）。
- DH4: `dh4_2_topping_count_audit.py` を 34-recipe で再実行（今は 25-recipe snapshot で pin）、`deductionGuard.audit.test.ts` の population。
- Dinner: validator（title にレシピ名がない、w1-25 mission は不変）、T-7。
- e2e: Dex pill `/34`（7 spec、onboarding 4 箇所を含む）、Pizza Select 34 枚、RT-01 reference-capacity harness 34 件、Layout Contract 7 profile（L-L: 最長 nameJa が 12 → 13 文字「ブラジリアン・カラブレーザ」になるので 2 行以内を確認）、WebKit。


## 12. 判定

**B. OWNER DECISIONS REQUIRED**

できたこと（実装準備としては揃っている）:
- 9 recipe の identity・sauce・cheese・CUT・cooking profile・discovery・progression・章・collision・mode 互換はすべて EVIDENCE か DERIVED で確定し、機械検証済み（collision 0、softlock 0、unreachable 0、W1 byte parity、save 互換、Scoring / Completion は W1 類似と同じ曲線）。
- 8 材料の category・taxonomy（#255 と整合）・価格・unlock step・単位・starter 扱いは確定。
- 白ソースは見えることを実測（olive-oil 以上）。tray は壊れず、LC-2/3 を blocker にする必要はない。
- asset は外部待ちではない（C ではない）。設計の作り直しも不要（D ではない）。

A にしなかった理由: OD-W2-6（「未確定値を推測して production に入れない」）により、以下は Owner の決定がないと実装を始められない。

| ID | 決める内容 | 候補（推奨を先頭） | 根拠 |
|---|---|---|---|
| **A1** minCount（4 recipe） | 主役が 1 つに決まらない recipe | flammkuchen: bacon 3 / onion 2（alt 2/3, 3/3）。ratatouille: eggplant / zucchini / bell-pepper 2/2/2（alt どれか 3）。pesto-vegetariana: 2/2/2。prosciutto-funghi: prosciutto 2 / mushroom 3（alt 3/2） | R-MC は主役 1 つ前提。他 5 recipe は R-MC で DERIVED |
| **A2** bakeTarget（4 recipe） | 類似 recipe / catalog が 1 つに決まらない | flammkuchen 56–76（alt 63–83）、pesto-pollo 50–70、pesto-vegetariana 50–70（alt 58–78）、prosciutto-funghi 58–78（alt 55–75） | 他 5 recipe は R-BT で DERIVED |
| **A3** description（9 件） | 日本語説明文（game authoring） | §1 の draft を承認 / 修正 | W1 も REC-01 で Owner sign-off |
| **A4** 表示名 | nameJa は evidence のまま使うか | そのまま（「ブラジリアン・カラブレーザ」13 文字は現行最長 12 を超える → W2-A2 の Layout Contract L-L で確認） | R-NAME |
| **A5** 白ソースの表現 | fromage-blanc の color / CSS | W2 cool tint #eef1f4（data のみ）/ W3 outline（CSS modifier 1 個）/ W0 | §3 実測。最終は 390×844 の Human Visual |
| **A6** 材料 visual | emoji 6 件の承認、生ハム・パセリ | 生ハム・パセリは専用 `pieceVisual`（W1 capers/clam 型）/ emoji 衝突を許容 | §2.2 |
| **A7** tray の並び | 新材料の位置 | 末尾（従来どおり、新材料まで 3 tap）/ topping の先頭（0 tap、既存位置がずれる） | §4 |
| **A8** tool drift | #260 への追記 | §10 のコメント案を #260 に追記 / 別 Issue | W2-A とは分離 |

A1〜A7 が決まれば W2-A0 で候補 JSON を確定値に更新し、W2-A1 → W2-A2 の実装に入れる（その時点で判定 A 相当）。

ここで STOP。production 実装・PR・merge・deploy はしていない。

## 13. Owner Decision（2026-09-27）— W2-A0 完了

Owner が A1〜A8 をすべて確定した。記録: `docs/design/TETO_WAVE2_OWNER-DECISION-LEDGER.md`。値の正本: `tools/wave2-w2a/w2a_authoring_candidates.json`（旧 OWNER_REQUIRED はすべて `APPROVED_OWNER`）。

| ID | 確定内容 |
|---|---|
| A1 | §12 推奨の minCount を採用。W2-A 専用の scoring rule は作らない |
| A2 | §12 推奨の bakeTarget を採用。W2-A 固有の焼き仕様は追加しない |
| A3 | 9 件の説明文 draft を承認。HV で表示・改行・意味の自然さを確認 |
| A4 | 「ブラジリアン・カラブレーザ」を正式名称。短縮しない。W2-A2 の Layout Contract で 2 行以内を確認 |
| A5 | 白ソースは `#eef1f4`。W2-A では追加 CSS / outline なし（HV で問題が出た時だけ follow-up） |
| A6 | emoji 6 件を承認。生ハム・パセリは capers / clam と同じ方針の専用 visual。外部 asset 依存は作らない |
| A7 | 新材料を tray 先頭へ移動しない（deterministic order 維持、最大 3 tap を許容） |
| A8 | phase2 tool drift を Issue #260 に追記。W2-A の blocker にしない |

**W2-A0 判定: A. W2-A AUTHORING COMPLETE — IMPLEMENTATION READY。** 次は W2-A1（材料データ + visual、まだ入手不可）→ 検証 → W2-A2（9 recipes + ladder append）。
W2-A2 の ladder は PR #268（LAD-1、append-only ladder foundation、OPEN）の `POST_W1_APPENDED_STEPS` に載せる（重複実装しない）。
