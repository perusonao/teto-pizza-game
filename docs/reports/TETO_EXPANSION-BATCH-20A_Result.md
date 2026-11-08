# Expansion Batch 20-A — Result Report（#790、暫定仕様・原典未確認）

**状態:** PR は Draft・**Gate HOLD（merge 不可）**。Owner の merge 判断待ち。iPhone Safari の実機 HV・CI（WebKit）・Codex は未実施（§6）。
**ブランチ:** `claude/teto-pizza-b20-a-m48qbl`（main `4ba0559` 基準。作業中に main は動いていない）。
**根拠:** Owner 判断 2026-11-08（Issue #790 の本文と実装 GO）、承認表 `docs/reports/TETO_B20A_OWNER-DECISION-TABLE_2026-11-08.md`（B20A-LD-01〜10 を承認）。
**claim:** #774（6691358861・6701234362）と #417（6688256290・6689297059・6689676327）の release を確認してから #790 に claim（コメント 6720288727、更新 6720615107）。

## 1. 実装内容

| 項目 | 内容 |
|---|---|
| 新食材 1 | `honey`（はちみつ、**sauce**・spread、色 `#e8a93a`、専用絵なし、family 行なし）。**ordinary step 71**（星ゲートなし）、T4 |
| 新食材 2 | `walnut`（くるみ、topping・scatter、**family `spice`**（Owner 最終判断 2026-11-08。`other` は撤回、§2.1）、size `s`、専用 SVG `walnut-kernel` ＝ #777 の部品を**形・色を変えずに**配線）。step 71、T4 |
| 新レシピ | `pesto-noci-pizza`（ペスト・ノーチピザ、**credited**、step 71 の key）。pesto 1 ／ honey 1 ／ gorgonzola 2 ／ walnut 3。**mozzarella は追加していない** |
| 工程 | SAUCE×2（pesto を塗る → honey を塗る）→ CHEESE → TOPPING → BAKE。全材料が焼く前。FINISH・prep・steam・sear なし。**既存の 2 ソース工程のまま成立**（B19 と同型、新しい機構なし） |
| 共通 | `lunchRush:false`・CUT なし・key-free Hint・焼成窓 58–78（汎用）・報酬 100 Pitz |
| ソース | pesto を主ソース（PAINT、Reference の対象）、honey は存在判定（`recipeSauceProfiles` に行なし、grandma-pizza／B19 と同じ）。`MULTI_SAUCE_RECIPE_IDS` に追加 |
| Reference | gorgonzola 2・walnut 3 ＝ 5 個を RT-01 の 8 リングの先頭 5 スロットに連続割当 |
| 件数（実測） | recipes 93（Pinsa 開）/ 92、credited 81、ingredients 100、toppings 69、ladder steps 78、章サイズ [6, 12, 19, 56]（Pinsa 閉は 55）、棚: sauce 16・spice 7。late の導出番号は +1（72–78）、`LATE_ENTITLEMENT_FLOORS` は不変 |

変更ファイル: `ingredients.ts`・`recipes.ts`・`discoveryLadder.ts`・`discoveryCatalog.ts`・`recipeSauceProfiles.ts`・`recipeHintRoles.ts`・`hints.ts`・`referencePizza.ts`・`orders.ts`・`ingredientTaxonomy.ts`・`toppingSizeClass.ts`・`IngredientGlyph.tsx`・`walnutGlyph/WalnutGlyph.tsx`（`<g>` の切り出し、見た目は不変）・`recipeBatchManifest.ts`・`requiredSauces.ts`。**`App.css` は変更していない**（walnut は 1em のまま。サイズは HV で判断）。

**暫定表記:** id・日本語名・個数・焼成窓・色（honey `#e8a93a`、walnut `#9a6a3c`）は GAMEPLAY ASSUMPTION。原典（pizzadb.jp）は未確認で、根拠は 172 matrix の 1 行（`pesto-noci-pizzadb-p12`）のみ。説明文は調理時期・材料量を出さない（Anti-Oracle）。

## 2. Research（承認の範囲内であること）

| 項目 | 結果 |
|---|---|
| 正準順の既存ラベル変化 | **0 件**（ordinary・full catalog とも、全 prefix。停止条件に当たらない） |
| 非正準順の変化 | 既存 **10 品**のみ（pesto-caprese・pesto-tonno・pesto-vegetariana・quattro-formaggi・genovese・pesto-patate・pesto-salmone・pesto-pollo・pesto-trapanese・pesto-burrata-pizza）。**承認表の ID と変化内容（`-→A`、`A→B`、`B→C` …）に完全一致**。`expansionBatch20.test.ts` が ID 集合と ID ごとの変化内容を固定し、1 つでも違えば失敗する（STOP） |
| 新レシピ自身 | honey・walnut はどの既存レシピにも無く、1 レシピのコホート（文字なし）。ラベルは「？？？ピザ（くるみ）」または「（はちみつ）」（最後に取得した素材） |

この測定は実装 PR の正式測定であり、承認表の一時測定（main `4ba0559`、honey・walnut を mock した版）と一致した。

## 2.1 walnut の family: `spice` で確定（`other` は実測で DH4-PROD gate に抵触、Owner 最終判断 2026-11-08）

| 項目 | 内容（実測） |
|---|---|
| Owner 最終判断 | **walnut = `spice`**。先の `other` 指示は撤回。理由: OD-B9-8（DH4-PROD gate の緩和禁止）・OD-B9-12（`other` の再分類禁止）・`other` では OD-DH4-2-9 に違反。almond・pine-nuts（`other`）と family が異なる点は**例外として記録** |
| `other` の実測 | 全 Vitest（Pinsa 開、HEAD `adabf10` の `other` 版）で `deductionProduction.gate.test.ts`「「その他」(provisional copy, OD-DH4-2-9) is unreachable」**1 件のみ失敗**（11,707 passed / 1 failed）。期待値だけの失敗（棚の分布・ナッツ一覧・alpha golden・DH4-1 監査）は別途更新で済む性質 |
| 原因 | `pesto-noci-pizza` は key-free で topping は walnut だけ。Rule W の予約材料が walnut になり、旧 Hint 4.0 の「特徴」の答え `attr:family:other` が到達可能になる（tsukimi-pizza の Batch 3 保留と同型）。並びを変えても予約は変わらない |
| `spice` の実測 | gate は通過。全 Vitest 11,708 passed・0 failed（`2eac8982`）。副作用は測定用 golden のみ（`hint5.alphaFamilyOnly.json` の late 2 レシピ値の増加、DH4-1 監査の候補数 +1） |
| gate・テスト | 弱めていない |

## 3. その他のゲート

| 項目 | 結果 |
|---|---|
| Duplicate Gate | 同一・部分集合・上位集合・1 材料差 **0**。最大 Jaccard 0.167（genovese）。例外なし |
| Hint 5.0（AC-3） | SAUCE 段の 10 Pitz で {pesto, honey} が出る。honey は他のどのレシピにも無いため、SAUCE 段だけで他の pesto 系と区別できる。CHEESE→STRUCTURE の順。ladder golden は**挿入のみ**（既存の entry の変更なし）。walnut `spice` の影響: `alphaFamilyOnly` の spice family が 1 つ増える（`hint5.alphaFamilyOnly.json` 5 行）。`hint5Production.gate` の合成カタログでは walnut も合成の再割当に加えた（mayo・cinnamon と同じ扱い）。DH4-1 の監査 JSON は候補数が +1 になるのみ |
| 保存安全性 | schema v2 のまま（`persistence.batch20.test.ts`）。旧セーブ（honey・walnut なし）は順序・Dex を保って読み書きでき、未知 id は保持（rollback safe） |
| Anti-Oracle | 説明文・ヒント文に調理時期・材料量・レシピ名を出さない（テスト固定）。Research の入口は「？？？ピザ」＋素材名のみ |
| staged（#780） | in-flight 待ち 9→2、blockingDeps 407→400。**pizza-radicchio-noci・speck-e-brie-pizzadb の walnut 待ちが解消**（昇格可能になったわけではなく、他の依存は残る）。staged データ本体は未変更・昇格なし。golden の再生成のみ |

## 4. 既存テストの更新（意味は不変）

件数・step 番号・late の導出番号（+1）・id リスト・golden への挿入のみ。主な対象: `catalogLedger`、各 `expansionBatchNN`、`lateCatalog.*`、`materialShop`（honey・walnut の行と late +1）、`materialEntitlement.*`、`progression`、`recipes`、`lunchRush.exclusion`、`researchLabels.batch8a`、`hint5Ladder.baseCompat`、`catalogShelf`、`largeCatalogFixtures`、`cookingProfiles`、`discoveryCatalog`（pesto-noci も 2 ソースの形）、`expansionBatch18/19`（B18 の Research 監査から B20-A の recipe を除外、B19 の step 70 判定を「最後から 2 番目」に）。`WalnutGlyph.test.tsx` の「未配線」の検査は「`IngredientGlyph.tsx` だけが import する」に置換。

## 5. テスト結果

| 項目 | 結果 |
|---|---|
| 全 Vitest（Pinsa 開） | **639 files passed / 11,708 tests passed / 0 failed**（13 skipped・2 todo は既存、約 1,116 秒） |
| Pinsa 閉（`TETO_PINSA_OFF=1`） | data・state・logic/discovery・logic/catalog・materialShop・mission・dev・IngredientGlyph の 330 files を実行: **329 passed・1 skipped／6,957 tests passed・0 failed**（Pinsa の有無で件数が変わる箇所は `pinsa ? … : …` で両対応済み） |
| `tsc -b` | 0 error |
| lint（`oxlint`） | error 0（既存の warning のみ） |
| E2E（Chromium、`e2e/b20a.spec.ts`） | iphone-390x844 と iphone-360x800 の各 1 本、**2/2 pass**（Shop NEW 2 行〔くるみは専用 SVG〕→ 購入 → Research〔漏えいなし〕→ pesto → honey の順に塗る → チーズ → 具材 → 焼成 → NEW DISCOVERY → 図鑑。横スクロールなし、console error なし） |
| WebKit | この環境では実行不可。CI の `e2e-webkit` を PR で確認する |

ローカルの Playwright は事前インストールの Chromium（`/opt/pw-browsers/chromium`）を `executablePath` で指定して実行（一時設定、リポジトリには含めない）。

## 6. 未実施・限界（正直な記載）

- **iPhone Safari の実機 HV は未実施（PASS 0）。** 静止画は Chromium（390×844・360×800）で `docs/reports/screenshots/b20/` に保存した。実機の見え方の代わりにはならない。HV 動画は repo に含めない（Policy）。
- **CI（WebKit 6 shard を含む全チェック）・Codex レビューは PR 作成後に確認する。**
- 原典（pizzadb.jp）は未確認。個数・窓・色・名前は暫定。
- 画面で確認した所見（Chromium の静止画）: honey のチップはハチの絵文字 🐝（`miso-sauce` が 🍯 を使っており、G18＝代替表示の一意性を守るため。**Owner 判断: 🐝 のままか、別の表現か**）。walnut は専用 SVG が 1em で表示され、トレイ・ショップ・生地上で判別できる。生くるみ×焼成チーズの塗りコントラストは弱く（#777 の実測 1.10）、外線で成立している。**実機で小さすぎる場合の拡大（1.2em 化）は HV 後の別判断**（`App.css` は未変更）。
- walnut の `baked` パレット（#777）は使っていない（ゲームは共通の焼成フィルタで焼く）。

## 7. Owner 判断（merge 前）

| # | 判断 | 推奨 |
|---|---|---|
| 1 | honey の代替表示 🐝（トレイ・ショップに出る） | 承認（実機で違和感があれば再判断） |
| 2 | walnut のサイズ（1em）と色（PROVISIONAL） | 実機 HV の結果で判断 |
| 3 | iPhone Safari の実機 HV（Shop 2 行・トレイ名の幅・2 層ソース・walnut の視認性・RESULT） | 実施 |
| 4 | merge | CI 全 green・Codex 最新 HEAD の指摘 0・HV 後に判断 |
